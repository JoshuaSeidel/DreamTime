# Push Notifications

Set up and configure push notifications for sleep reminders.

## Overview

DreamTime uses Web Push notifications to remind you when:
- It's time to prepare for a nap
- Bedtime is approaching
- Baby should be woken (wake deadline)
- Day sleep cap is being reached

---

## Supported Platforms

| Platform | Browser | Supported |
|----------|---------|-----------|
| iOS | Safari | Yes (iOS 16.4+) |
| iOS | Chrome/Firefox | No (use Safari) |
| Android | Chrome | Yes |
| Android | Firefox | Yes |
| Desktop | Chrome | Yes |
| Desktop | Firefox | Yes |
| Desktop | Safari | Yes (macOS 13+) |
| Desktop | Edge | Yes |

---

## Enabling Notifications

### Step 1: Install the PWA (Recommended)

For the best notification experience, install DreamTime as an app:

**iOS:**
1. Open DreamTime in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Tap "Add"

**Android:**
1. Open DreamTime in Chrome
2. Tap the menu (three dots)
3. Tap "Install app" or "Add to Home screen"
4. Tap "Install"

**Desktop:**
1. Open DreamTime in Chrome
2. Click the install icon in the address bar
3. Click "Install"

### Step 2: Grant Permission

1. Go to **Settings** > **Notifications**
2. Tap **Enable Notifications**
3. When prompted, tap **Allow**

```
┌─────────────────────────────────────┐
│  dreamtime.example.com wants to     │
│  send you notifications             │
│                                     │
│        [Block]    [Allow]           │
│                                     │
└─────────────────────────────────────┘
```

### Step 3: Configure Settings

```
┌─────────────────────────────────────┐
│  🔔 Notification Settings           │
├─────────────────────────────────────┤
│                                     │
│  Notifications: [Enabled ✓]         │
│                                     │
│  Nap Reminders                      │
│  [ ✓ ] Before nap window            │
│  Remind: [30] minutes before        │
│                                     │
│  Bedtime Reminders                  │
│  [ ✓ ] Before bedtime               │
│  Remind: [30] minutes before        │
│                                     │
│  Wake Reminders                     │
│  [ ✓ ] Before wake deadline         │
│  Remind: [15] minutes before        │
│                                     │
│  Nap Cap Warnings                   │
│  [ ✓ ] When approaching cap         │
│                                     │
└─────────────────────────────────────┘
```

---

## Notification Types

### Nap Reminder

**When:** Before the nap window opens

**Example:**
```
┌─────────────────────────────────────┐
│ 🌙 DreamTime                        │
│                                     │
│ Oliver's Nap 1 window opens in 30   │
│ minutes. Start winding down!        │
│                                     │
│ Tap to view schedule                │
└─────────────────────────────────────┘
```

**Timing:** Configurable (15, 30, 45, or 60 minutes before)

### Bedtime Reminder

**When:** Before recommended bedtime

**Example:**
```
┌─────────────────────────────────────┐
│ 🌙 DreamTime                        │
│                                     │
│ Oliver's bedtime is in 30 minutes.  │
│ Start the bedtime routine!          │
│                                     │
│ Recommended: 7:00 PM                │
└─────────────────────────────────────┘
```

**Timing:** Configurable (15, 30, 45, or 60 minutes before)

### Wake Deadline

**When:** Before baby must be woken

**Example:**
```
┌─────────────────────────────────────┐
│ ⏰ DreamTime                        │
│                                     │
│ Oliver's nap should end in 15       │
│ minutes to protect the schedule.    │
│                                     │
│ Wake by: 3:00 PM                    │
└─────────────────────────────────────┘
```

**Timing:** Configurable (10, 15, or 30 minutes before)

### Nap Cap Warning

**When:** Day sleep cap is being approached

**Example:**
```
┌─────────────────────────────────────┐
│ ⚠️ DreamTime                        │
│                                     │
│ Oliver is 15 minutes from the day   │
│ sleep cap. Consider waking soon.    │
│                                     │
│ Current: 3h 15m / 3h 30m cap        │
└─────────────────────────────────────┘
```

---

## Server Configuration

### VAPID Keys

Web Push requires VAPID (Voluntary Application Server Identification) keys.

**Auto-Generated (Default):**
```env
# Keys are auto-generated on first startup
# Stored in ./data/secrets/vapid.json
```

**Manual Configuration:**
```env
VAPID_PUBLIC_KEY=BEl62i...your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### Generating Keys Manually

```bash
# Using web-push npm package
npx web-push generate-vapid-keys
```

Output:
```
Public Key:
BEl62i...

Private Key:
UUxI4O8...
```

### Important Notes

- Keep VAPID keys consistent across deployments
- Changing keys invalidates all existing subscriptions
- Users would need to re-enable notifications

---

## Troubleshooting

### Notifications Not Appearing

**Check Browser Permissions:**

1. **Chrome:** Settings > Privacy > Site Settings > Notifications
2. **Firefox:** Settings > Privacy > Permissions > Notifications
3. **Safari:** System Preferences > Notifications > Safari

**Check OS Permissions:**

1. **iOS:** Settings > DreamTime > Notifications
2. **Android:** Settings > Apps > DreamTime > Notifications
3. **macOS:** System Preferences > Notifications > Browser
4. **Windows:** Settings > System > Notifications

**Verify in DreamTime:**

1. Go to Settings > Notifications
2. Check that notifications are enabled
3. Try disabling and re-enabling

### Notifications Delayed

Push notifications may be delayed on mobile:
- iOS batches notifications for battery efficiency
- Android doze mode may delay notifications
- Low battery mode affects delivery

**Improve Reliability:**

1. Install as PWA (more reliable than browser)
2. Disable battery optimization for DreamTime (Android)
3. Keep the app open in background

### iOS-Specific Issues

**Requirements:**
- iOS 16.4 or later
- Safari browser
- Must be installed as PWA (Add to Home Screen)

**Troubleshooting:**
1. Ensure using Safari (not Chrome/Firefox)
2. Ensure PWA is installed
3. Check Focus mode isn't blocking notifications
4. Restart the PWA

### Android-Specific Issues

**Check Chrome Settings:**
1. Open Chrome
2. Go to Settings > Notifications
3. Ensure "Show notifications" is enabled
4. Check site-specific permissions

**Battery Optimization:**
1. Go to Settings > Apps > DreamTime
2. Battery > Don't optimize
3. This prevents notification delays

---

## Multiple Devices

### Syncing Subscriptions

Each device has its own push subscription:
- Enable notifications on each device separately
- Notification preferences sync across devices
- All enabled devices receive notifications

### Managing Subscriptions

To see active subscriptions:
1. Go to Settings > Notifications
2. View "Active Devices" (if available)

To disable on a specific device:
1. Open DreamTime on that device
2. Go to Settings > Notifications
3. Toggle off notifications

---

## Privacy

### What's Sent

Push notifications contain:
- Child's name
- Notification type (nap, bedtime, etc.)
- Relevant time

### What's NOT Sent

Notifications do not contain:
- Detailed sleep data
- Your account information
- Location data

### Data Storage

- Push subscriptions stored encrypted
- Subscriptions linked to your user account
- Subscriptions deleted when you disable notifications

---

## Testing Notifications

### Manual Test

1. Go to Settings > Notifications
2. Tap "Send Test Notification"
3. A notification should appear within 5 seconds

### Verifying Schedule

To verify notification timing:
1. Check the dashboard for next recommendation
2. Calculate when notification should arrive
3. Set a phone alarm as backup

### Debug Mode

For developers, enable debug logging:
```javascript
// In browser console
localStorage.setItem('debug-push', 'true');
```

This logs push events to the console.

---

## API for Developers

### Subscribe

```javascript
// Get VAPID public key
const vapidKey = await fetch('/api/push/vapid-public-key');

// Register service worker
const registration = await navigator.serviceWorker.register('/sw.js');

// Subscribe to push
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidKey
});

// Send to server
await fetch('/api/push/subscribe', {
  method: 'POST',
  body: JSON.stringify({ subscription })
});
```

### Unsubscribe

```javascript
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.getSubscription();

if (subscription) {
  await subscription.unsubscribe();
  await fetch('/api/push/subscribe', { method: 'DELETE' });
}
```

### Service Worker

The service worker handles incoming notifications:

```javascript
// sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      data: data.url
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
```

