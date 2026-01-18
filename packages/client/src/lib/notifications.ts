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

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[Notifications] Creating new subscription...');

      // Fetch VAPID key from server
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        console.error('[Notifications] VAPID public key not available');
        return { success: false, error: 'Push notifications not configured on server' };
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      console.log('[Notifications] Subscription created');
    }

    // Send subscription to server
    console.log('[Notifications] Sending subscription to server...');
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Notifications] Server error:', error);
      return { success: false, error: error.error?.message || 'Failed to register subscription' };
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
      // Unsubscribe locally
      await subscription.unsubscribe();

      // Notify server
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
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
 * Send a test notification (for debugging)
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
