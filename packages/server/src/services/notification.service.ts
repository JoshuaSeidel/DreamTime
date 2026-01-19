import webpush from 'web-push';
import { prisma } from '../config/database.js';
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from '../config/secrets.js';

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
