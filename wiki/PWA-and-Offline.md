# PWA & Offline Support

DreamTime is a Progressive Web App (PWA) that works offline.

## What is a PWA?

A Progressive Web App is a website that can be installed and used like a native app:
- Add to home screen
- Full-screen experience
- Push notifications
- Offline support
- Fast loading

---

## Installing the PWA

### iOS (Safari)

1. Open DreamTime in **Safari** (required)
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** in the top right

The app icon appears on your home screen.

### Android (Chrome)

1. Open DreamTime in Chrome
2. Tap the **menu** (three dots)
3. Tap **Install app** or **Add to Home screen**
4. Tap **Install**

### Desktop (Chrome)

1. Open DreamTime in Chrome
2. Click the **install icon** in the address bar (right side)
3. Click **Install**

### Desktop (Other Browsers)

- **Firefox**: Menu > More tools > Install
- **Edge**: Menu > Apps > Install this site
- **Safari (macOS)**: File > Add to Dock

---

## Benefits of Installing

### Full-Screen Experience

No browser chrome (address bar, tabs). Just the app.

### Home Screen Icon

Quick access from your home screen or dock.

### Better Notifications

Push notifications work more reliably when installed.

### Faster Loading

App resources cached locally for instant loading.

### Offline Support

Track sleep even without internet.

---

## Offline Capabilities

### What Works Offline

| Feature | Offline Support |
|---------|-----------------|
| View dashboard | Yes |
| Log sleep events | Yes (queued) |
| View schedule | Yes |
| View history | Yes (cached) |
| Change settings | Yes (queued) |
| Push notifications | No |
| Caregiver sync | No (syncs later) |

### How Offline Tracking Works

1. **You tap a button** (Put Down, Asleep, etc.)
2. **Action is queued** in IndexedDB
3. **UI updates immediately** (optimistic update)
4. **When online**, queue syncs to server
5. **Conflicts resolved** by timestamp

### Offline Indicator

When offline, you'll see:

```
┌─────────────────────────────────────┐
│  ⚠️ Offline Mode                    │
│  Changes will sync when connected   │
└─────────────────────────────────────┘
```

### Syncing When Online

Sync happens automatically when:
- Network connection restored
- App comes to foreground
- User manually refreshes

---

## Service Worker

### What is a Service Worker?

A script that runs in the background, enabling:
- Caching resources
- Offline support
- Background sync
- Push notifications

### Cache Strategy

DreamTime uses different caching strategies:

| Resource | Strategy | Description |
|----------|----------|-------------|
| App shell (HTML, CSS, JS) | Cache first | Use cache, update in background |
| API responses | Network first | Try network, fall back to cache |
| Images/icons | Cache first | Use cache, rarely changes |
| User data | Network first | Always get fresh data when possible |

### Cache Updates

When a new version is deployed:
1. Service worker detects update
2. New assets downloaded in background
3. User prompted to refresh
4. New version activates on refresh

---

## Background Sync

### What is Background Sync?

When you take actions offline, they're queued. Background sync retries sending them when online, even if the app is closed.

### Supported Actions

- Creating sleep sessions
- Updating session events
- Changing schedule settings

### Sync Priority

Actions are synced in order:
1. Oldest actions first
2. Critical actions (session events) prioritized
3. Settings changes last

### Conflict Resolution

If the same session was modified by two people offline:
- Server timestamp wins
- Latest update preserved
- No data loss for events

---

## App Updates

### Checking for Updates

Updates are checked automatically when:
- App is opened
- Page is refreshed
- App returns from background

### Update Available

When an update is available:

```
┌─────────────────────────────────────┐
│  🔄 Update Available                │
│                                     │
│  A new version of DreamTime is      │
│  ready. Refresh to update.          │
│                                     │
│         [Refresh Now]               │
│                                     │
└─────────────────────────────────────┘
```

### Force Update

If automatic update doesn't work:
1. Close all DreamTime tabs
2. Clear browser cache
3. Reopen DreamTime

For installed PWA:
1. Remove from home screen
2. Clear browser cache
3. Reinstall the PWA

---

## Storage

### Local Storage

DreamTime uses:
- **IndexedDB**: Offline queue, cached data
- **localStorage**: App settings, auth tokens
- **Cache Storage**: Static assets (JS, CSS, images)

### Storage Limits

| Platform | Typical Limit |
|----------|---------------|
| Chrome | 60% of disk space |
| Firefox | 50% of disk space |
| Safari | 1GB maximum |
| iOS Safari | Limited (varies) |

### Clearing Storage

**Careful!** This logs you out and clears offline data.

**Browser:**
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear site data"

**iOS:**
1. Settings > Safari > Clear History and Website Data

**Android:**
1. Settings > Apps > Chrome > Clear data

---

## Troubleshooting

### PWA Won't Install

1. **Check browser support** - Use Safari (iOS), Chrome (Android)
2. **Ensure HTTPS** - PWAs require secure connection
3. **Check manifest** - DevTools > Application > Manifest
4. **Clear cache** - Try fresh install

### Offline Not Working

1. **Check service worker** - DevTools > Application > Service Workers
2. **Verify registration** - Should show "activated and running"
3. **Clear cache** - DevTools > Application > Clear storage
4. **Reinstall PWA**

### Sync Stuck

1. **Check network** - Ensure internet connection
2. **Force sync** - Pull to refresh
3. **Check queued actions** - DevTools > Application > IndexedDB
4. **Clear queue** - Last resort, may lose offline data

### App Stuck on Old Version

1. **Refresh multiple times**
2. **Check for update** - DevTools > Application > Service Workers > Update
3. **Skip waiting** - Click "skipWaiting" in DevTools
4. **Unregister** - Remove service worker and refresh
5. **Clear all data** - Complete cache clear

---

## Developer Information

### Service Worker Registration

```javascript
// Registration happens in main.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### Manifest

The web app manifest (`manifest.json`) defines:
- App name and icons
- Theme colors
- Display mode (standalone)
- Start URL

### Workbox

DreamTime uses Workbox for:
- Precaching static assets
- Runtime caching strategies
- Background sync
- Update detection

### Offline Detection

```javascript
// Check online status
const isOnline = navigator.onLine;

// Listen for changes
window.addEventListener('online', () => { /* ... */ });
window.addEventListener('offline', () => { /* ... */ });
```

---

## Platform-Specific Notes

### iOS Limitations

- **Must use Safari** for PWA features
- **Limited background sync** - Only works briefly after app closes
- **Storage quota** - More restrictive than other platforms
- **No badge updates** - App icon badges not supported

### Android

- **Full PWA support** in Chrome
- **Background sync works well**
- **Notifications reliable**
- **Install prompt** shows automatically

### Desktop

- **Best overall support**
- **Most reliable notifications**
- **Largest storage quota**
- **Background sync works well**

