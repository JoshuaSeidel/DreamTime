import webpush from 'web-push';
import https from 'https';
import { createSign } from 'crypto';
import { prisma } from '../config/database.js';
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from '../config/secrets.js';

// Base64URL encoding helper
function base64UrlEncode(data: string | Buffer): string {
  const base64 = typeof data === 'string' ? Buffer.from(data).toString('base64') : data.toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate VAPID JWT with custom expiration for Apple compatibility
function generateVapidJwt(audience: string, expirationSeconds: number = 3600): string {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + expirationSeconds,
    sub: getVapidSubject(),
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Get the private key and create signature
  const privateKeyBase64Url = getVapidPrivateKey();
  const privateKeyBuffer = Buffer.from(privateKeyBase64Url, 'base64url');

  // Create the full DER-encoded private key for P-256
  // ASN.1 structure for PKCS#8 EC private key
  const privateKeyDer = Buffer.concat([
    Buffer.from('308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420', 'hex'),
    privateKeyBuffer,
  ]);

  const sign = createSign('SHA256');
  sign.update(unsignedToken);

  try {
    const signature = sign.sign({
      key: `-----BEGIN PRIVATE KEY-----\n${privateKeyDer.toString('base64')}\n-----END PRIVATE KEY-----`,
      dsaEncoding: 'ieee-p1363', // Required for ES256
    });

    return `${unsignedToken}.${base64UrlEncode(signature)}`;
  } catch (err) {
    // Fallback: return empty string to use library default
    console.warn('[NotificationService] Failed to generate custom JWT:', err);
    return '';
  }
}

// Send push notification directly to Apple (bypassing web-push library's 12-hour JWT)
async function sendToApple(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<void> {
  // Use web-push to generate the encrypted request details
  // but we'll replace the Authorization header with our own short-lived JWT
  const requestDetails = webpush.generateRequestDetails(
    subscription,
    payload,
    {
      vapidDetails: {
        subject: getVapidSubject(),
        publicKey: getVapidPublicKey(),
        privateKey: getVapidPrivateKey(),
      },
    }
  );

  // Extract the origin for JWT audience
  const endpointUrl = new URL(subscription.endpoint);
  const audience = endpointUrl.origin;

  // Generate our custom short-lived JWT (1 hour expiry instead of 12 hours)
  const jwt = generateVapidJwt(audience, 3600);

  if (!jwt) {
    throw new Error('Failed to generate VAPID JWT for Apple');
  }

  // Replace the Authorization header with our short-lived JWT
  const authHeader = `vapid t=${jwt}, k=${getVapidPublicKey()}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(subscription.endpoint);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        ...requestDetails.headers,
        Authorization: authHeader, // Override with our short-lived JWT
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          const error = new Error(`Apple push failed: ${res.statusCode} ${body}`) as Error & {
            statusCode?: number;
            body?: string;
          };
          error.statusCode = res.statusCode;
          error.body = body;
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (requestDetails.body) {
      req.write(requestDetails.body);
    }

    req.end();
  });
}

// Notification payload types
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    type: 'bedtime_reminder' | 'nap_reminder' | 'wake_window_alert' | 'session_update' | 'wake_deadline' | 'nap_cap_exceeded';
    childId?: string;
    childName?: string;
    url?: string;
  };
}

// Initialize web-push with VAPID keys
let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  const subject = getVapidSubject();

  if (!publicKey || !privateKey) {
    console.error('[NotificationService] VAPID keys not configured');
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    console.log('[NotificationService] VAPID configured successfully');
    return true;
  } catch (error) {
    console.error('[NotificationService] Failed to configure VAPID:', error);
    return false;
  }
}

/**
 * Send a push notification to a specific user
 * Will send to all their registered devices
 */
export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0 };
  }

  // Get all subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    console.log(`[NotificationService] No subscriptions for user ${userId}`);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const notificationPayload = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      // Apple's APNS requires JWT expiration within 1 hour
      // The web-push library uses 12 hours by default which Apple rejects with BadJwtToken
      // We bypass the library entirely for Apple and make direct HTTPS requests
      const isApple = sub.endpoint.includes('web.push.apple.com');

      if (isApple) {
        console.log('[NotificationService] Using direct HTTPS request for Apple push (bypassing web-push library)');
        await sendToApple(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
      } else {
        // For non-Apple endpoints, use the web-push library normally
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
      }

      // Update last used timestamp
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: {
          lastUsedAt: new Date(),
          failCount: 0,
        },
      });

      sent++;
    } catch (error: unknown) {
      failed++;
      const webPushError = error as { statusCode?: number };

      // Handle subscription expiration (410 Gone or 404 Not Found)
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        console.log(`[NotificationService] Subscription expired, removing: ${sub.endpoint.substring(0, 50)}...`);
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        // Increment fail count
        const newFailCount = sub.failCount + 1;
        if (newFailCount >= 5) {
          // Remove subscription after 5 failures
          console.log(`[NotificationService] Too many failures, removing subscription: ${sub.endpoint.substring(0, 50)}...`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { failCount: newFailCount },
          });
        }
        console.error(`[NotificationService] Failed to send to ${sub.endpoint.substring(0, 50)}...:`, error);
      }
    }
  }

  console.log(`[NotificationService] Sent ${sent}/${subscriptions.length} notifications to user ${userId}`);
  return { sent, failed };
}

/**
 * Send a bedtime reminder notification
 */
export async function sendBedtimeReminder(
  userId: string,
  childName: string,
  bedtime: string,
  childId: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `Bedtime for ${childName}`,
    body: `It's almost ${bedtime} - time to start the bedtime routine!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `bedtime-${childId}`,
    data: {
      type: 'bedtime_reminder',
      childId,
      childName,
      url: '/',
    },
  });
}

/**
 * Send a nap reminder notification
 */
export async function sendNapReminder(
  userId: string,
  childName: string,
  napNumber: number,
  napTime: string,
  childId: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `Nap ${napNumber} for ${childName}`,
    body: `It's almost ${napTime} - time for nap ${napNumber}!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `nap-${childId}-${napNumber}`,
    data: {
      type: 'nap_reminder',
      childId,
      childName,
      url: '/',
    },
  });
}

/**
 * Send a wake window alert when baby has been awake too long
 */
export async function sendWakeWindowAlert(
  userId: string,
  childName: string,
  minutesAwake: number,
  childId: string
): Promise<void> {
  const hours = Math.floor(minutesAwake / 60);
  const mins = minutesAwake % 60;
  const awakeTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  await sendNotificationToUser(userId, {
    title: `Wake Window Alert`,
    body: `${childName} has been awake for ${awakeTime}. Consider putting them down soon.`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `wake-window-${childId}`,
    data: {
      type: 'wake_window_alert',
      childId,
      childName,
      url: '/',
    },
  });
}

/**
 * Send notification to all caregivers of a child
 */
export async function sendNotificationToCaregivers(
  childId: string,
  payload: NotificationPayload,
  excludeUserId?: string
): Promise<{ totalSent: number; totalFailed: number }> {
  // Get all active caregivers for this child
  const caregivers = await prisma.childCaregiver.findMany({
    where: {
      childId,
      isActive: true,
      status: 'ACCEPTED',
    },
    select: {
      userId: true,
    },
  });

  let totalSent = 0;
  let totalFailed = 0;

  for (const caregiver of caregivers) {
    if (caregiver.userId === excludeUserId) continue;

    const result = await sendNotificationToUser(caregiver.userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}

/**
 * Get count of active subscriptions for a user
 */
export async function getSubscriptionCount(userId: string): Promise<number> {
  return prisma.pushSubscription.count({
    where: { userId },
  });
}

/**
 * Send wake deadline alert (approaching must-wake-by time)
 */
export async function sendWakeDeadlineAlert(
  userId: string,
  childName: string,
  minutesRemaining: number,
  mustWakeByTime: string,
  childId: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `Wake ${childName} Soon`,
    body: `${minutesRemaining} minutes until ${mustWakeByTime} wake deadline!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `wake-deadline-${childId}`,
    data: {
      type: 'wake_deadline',
      childId,
      childName,
      url: '/',
    },
  });
}

/**
 * Send nap cap exceeded alert
 */
export async function sendNapCapExceededAlert(
  userId: string,
  childName: string,
  napDurationMinutes: number,
  napCapMinutes: number,
  childId: string
): Promise<void> {
  const overMinutes = napDurationMinutes - napCapMinutes;
  await sendNotificationToUser(userId, {
    title: `Nap Cap Reached`,
    body: `${childName} has been napping ${napDurationMinutes} min (${overMinutes} min over ${napCapMinutes} min cap). Time to wake!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `nap-cap-${childId}`,
    data: {
      type: 'nap_cap_exceeded',
      childId,
      childName,
      url: '/',
    },
  });
}
