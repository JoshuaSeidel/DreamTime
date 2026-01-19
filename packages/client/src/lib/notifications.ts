// Cache for VAPID public key fetched from server
let cachedVapidPublicKey: string | null = null;

export interface NotificationState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
}

/**
 * Fetch VAPID public key from server
 */
async function getVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublicKey) {
    return cachedVapidPublicKey;
  }

  try {
    const response = await fetch('/api/notifications/vapid-public-key');
    if (!response.ok) {
      console.error('[Notifications] Failed to fetch VAPID key:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.success && data.data?.vapidPublicKey) {
      cachedVapidPublicKey = data.data.vapidPublicKey;
      return cachedVapidPublicKey;
    }

    return null;
  } catch (err) {
    console.error('[Notifications] Error fetching VAPID key:', err);
    return null;
  }
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Check if running as installed PWA
 */
export function isRunningAsPWA(): boolean {
  // Check for standalone mode (installed PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari PWA check
  const isIOSPWA = (window.navigator as { standalone?: boolean }).standalone === true;

  return isStandalone || isIOSPWA;
}

/**
 * Request notification permission
 * MUST be called from a user interaction (click event)
 */
export async function requestNotificationPermission(): Promise<{
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  error?: string;
}> {
  console.log('[Notifications] Requesting permission...');

  if (!isPushSupported()) {
    console.log('[Notifications] Push not supported');
    return {
      success: false,
      permission: 'unsupported',
      error: 'Push notifications are not supported on this device',
    };
  }

  // Check if already granted
  if (Notification.permission === 'granted') {
    console.log('[Notifications] Already granted');
    return { success: true, permission: 'granted' };
  }

  // Check if already denied
  if (Notification.permission === 'denied') {
    console.log('[Notifications] Already denied');
    return {
      success: false,
      permission: 'denied',
      error: 'Notifications were previously denied. Please enable them in your device settings.',
    };
  }

  try {
    console.log('[Notifications] Requesting permission from browser...');
    const permission = await Notification.requestPermission();
    console.log('[Notifications] Permission result:', permission);

    if (permission === 'granted') {
      return { success: true, permission };
    } else {
      return {
        success: false,
        permission,
        error: permission === 'denied'
          ? 'Notification permission was denied'
          : 'Notification permission was dismissed',
      };
    }
  } catch (err) {
    console.error('[Notifications] Permission request error:', err);
    return {
      success: false,
      permission: Notification.permission,
      error: err instanceof Error ? err.message : 'Failed to request permission',
    };
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(accessToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[Notifications] Subscribing to push...');

  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: 'Notification permission not granted' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    console.log('[Notifications] Service worker ready');

    // Fetch VAPID key from server first
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      console.error('[Notifications] VAPID public key not available');
      return { success: false, error: 'Push notifications not configured on server' };
    }

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // Always unsubscribe and create fresh to avoid stale subscriptions
    if (subscription) {
      console.log('[Notifications] Found existing subscription, unsubscribing to create fresh...');
      try {
        await subscription.unsubscribe();
      } catch (e) {
        console.warn('[Notifications] Failed to unsubscribe existing:', e);
      }
      subscription = null;
    }

    console.log('[Notifications] Creating new subscription...');

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    console.log('[Notifications] Subscription created:', subscription.endpoint);

    // Send subscription to server with user agent for debugging
    console.log('[Notifications] Sending subscription to server...');
    const subscriptionData = {
      ...subscription.toJSON(),
      userAgent: navigator.userAgent,
    };

    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Notifications] Server error:', error);
      return { success: false, error: error.error?.message || 'Failed to register subscription' };
    }

    // Verify subscription was saved by checking status
    const statusResponse = await fetch('/api/notifications/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      if (!statusData.data?.hasSubscriptions) {
        console.error('[Notifications] Subscription not saved - status check failed');
        return { success: false, error: 'Subscription was not saved. Please try again.' };
      }
      console.log('[Notifications] Verified subscription saved, count:', statusData.data.subscriptionCount);
    }

    console.log('[Notifications] Successfully subscribed');
    return { success: true };
  } catch (err) {
    console.error('[Notifications] Subscription error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to subscribe to notifications',
    };
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(accessToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[Notifications] Unsubscribing from push...');

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      // Notify server first (before local unsubscribe, so we still have the endpoint)
      try {
        const response = await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ endpoint }),
        });

        if (!response.ok) {
          console.warn('[Notifications] Server unsubscribe returned error, continuing with local unsubscribe');
        }
      } catch (serverErr) {
        console.warn('[Notifications] Server unsubscribe failed, continuing with local unsubscribe:', serverErr);
      }

      // Unsubscribe locally
      await subscription.unsubscribe();
    }

    console.log('[Notifications] Successfully unsubscribed');
    return { success: true };
  } catch (err) {
    console.error('[Notifications] Unsubscribe error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unsubscribe',
    };
  }
}

/**
 * Check if currently subscribed to push notifications
 */
export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as unknown as BufferSource;
}

/**
 * Send a local test notification (for debugging)
 */
export async function sendTestNotification(): Promise<void> {
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('DreamTime', {
      body: 'Push notifications are working!',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    });
  }
}

/**
 * Send a server-side test push notification
 */
export async function sendServerTestNotification(accessToken: string): Promise<{
  success: boolean;
  sent?: number;
  failed?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Failed to send test notification',
      };
    }

    return {
      success: true,
      sent: data.data?.sent ?? 0,
      failed: data.data?.failed ?? 0,
    };
  } catch (err) {
    console.error('[Notifications] Test notification error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send test notification',
    };
  }
}
