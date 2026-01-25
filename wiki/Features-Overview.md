# Features Overview

Complete list of DreamTime's capabilities.

## Core Features

### Sleep Tracking

| Feature | Description |
|---------|-------------|
| **Quick Action Buttons** | Large, touch-friendly buttons for tracking sleep state transitions |
| **State Machine** | Track baby through 4 states: In Crib → Asleep → Awake → Out |
| **Session Types** | Track naps (Nap 1, Nap 2, etc.) and night sleep separately |
| **Ad-Hoc Naps** | Log car, stroller, carrier, swing, or other non-crib naps |
| **Time Editing** | Tap the clock to adjust times retroactively |
| **Multi-Wake Tracking** | Track multiple wake-ups during night sleep |

### Smart Recommendations

| Feature | Description |
|---------|-------------|
| **Next Action** | Shows what to do next: NAP, BEDTIME, WAIT, or WAKE |
| **Time Windows** | Displays earliest, recommended, and latest times |
| **Sleep Debt Calculation** | Adjusts recommendations based on actual vs. expected sleep |
| **Qualified Rest** | Credits partial crib time toward rest totals |
| **Day Sleep Budget** | Real-time tracker showing progress toward daily cap |
| **5-Minute Warning** | Countdown timer when approaching day sleep cap |
| **Auto-Refresh** | Dashboard updates when returning from other pages/tabs |

### Schedule Management

| Feature | Description |
|---------|-------------|
| **Schedule Types** | 3-nap, 2-nap, 1-nap, and transition schedules |
| **Wake Windows** | Configure optimal awake times between sleep periods - directly controls nap timing |
| **Auto-Save** | Changes save automatically after 1 second |
| **Reset to Defaults** | One-click restore of age-appropriate wake windows |
| **Nap Constraints** | Set earliest start, latest start, max duration, end-by times |
| **Bedtime Goals** | Define target bedtime range |
| **Day Sleep Cap** | Limit total daytime sleep to protect night sleep |

### 2-to-1 Nap Transition

| Feature | Description |
|---------|-------------|
| **Guided Transition** | 4-6 week program to move from 2 naps to 1 |
| **Progress Tracking** | Current week, target nap time, completion status |
| **Fast-Track Mode** | Accelerated 2-4 week option for ready babies |
| **Readiness Analysis** | Check if baby is ready to push nap later |
| **Weekly Targets** | Automatic progression of nap times |

---

## User Management

### Authentication

| Feature | Description |
|---------|-------------|
| **Email/Password** | Traditional login with secure password hashing |
| **Passkey/WebAuthn** | Login with Face ID, Touch ID, or security key |
| **JWT Tokens** | Secure access and refresh token system |
| **Multi-Device** | Log out of individual or all devices |
| **Password Change** | Update password from settings |

### Caregiver Sharing

| Feature | Description |
|---------|-------------|
| **Invite by Email** | Send invitations to family members |
| **Role-Based Access** | Admin, Caregiver, or Viewer permissions |
| **Custom Titles** | Label caregivers as Dad, Mom, Grandma, Babysitter, etc. |
| **Temporary Disable** | Turn off access without removing the caregiver |
| **Multi-Child** | Each caregiver can access multiple children |

### Roles Explained

| Role | Can Track | Can Edit Schedule | Can Manage Caregivers | Can Delete Child |
|------|-----------|-------------------|----------------------|------------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Caregiver** | ✅ | ❌ | ❌ | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ |

---

## Analytics & History

### History View

| Feature | Description |
|---------|-------------|
| **Session List** | View all past sleep sessions |
| **Date Filtering** | Filter by specific dates |
| **Session Details** | See all timestamps and calculated durations |
| **Delete Sessions** | Remove incorrect entries |

### Analytics

| Feature | Description |
|---------|-------------|
| **Daily Summary** | Total sleep, nap count, bedtime for each day |
| **Weekly Summary** | Averages and trends over the week |
| **Sleep Trends** | Charts showing patterns over time |
| **Period Comparison** | Compare two date ranges |

---

## Notifications

### Push Notifications

| Feature | Description |
|---------|-------------|
| **Nap Reminders** | Alert before nap time window |
| **Bedtime Reminders** | Alert before bedtime window |
| **Wake Deadline** | Alert before must-wake-by time |
| **Configurable Lead Time** | Set how many minutes before to notify |
| **Test Notifications** | Send a test to verify setup |

### Notification Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `napReminderMinutes` | 30 | Minutes before nap window |
| `bedtimeReminderMinutes` | 30 | Minutes before bedtime window |
| `wakeDeadlineReminderMinutes` | 15 | Minutes before must-wake-by |

---

## PWA Features

### Offline Support

| Feature | Description |
|---------|-------------|
| **Service Worker** | Caches app for offline use |
| **Offline Tracking** | Queue actions when offline, sync when connected |
| **Cached Data** | View recent history without internet |

### Installation

| Feature | Description |
|---------|-------------|
| **Add to Home Screen** | Install as native-like app |
| **Standalone Mode** | Runs without browser UI |
| **App Icons** | Custom icons for home screen |

### Biometric Lock

| Feature | Description |
|---------|-------------|
| **Passkey Lock** | Require Face ID/Touch ID to open app |
| **Quick Unlock** | Faster than password entry |
| **Secure Storage** | Credentials stored in secure enclave |

---

## Integrations

### Home Assistant (MQTT)

| Feature | Description |
|---------|-------------|
| **State Publishing** | Publish current sleep state to MQTT |
| **Voice Commands** | "Alexa, tell DreamTime Oliver fell asleep" |
| **Automations** | Trigger HA automations based on sleep state |

### MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `dreamtime/{childId}/state` | Publish | Current state (awake, in_crib, asleep) |
| `dreamtime/{childId}/command` | Subscribe | Commands (put_down, asleep, etc.) |

---

## UI Features

### Themes

| Feature | Description |
|---------|-------------|
| **Light Mode** | Bright theme for daytime |
| **Dark Mode** | Dark theme for nighttime |
| **System Mode** | Follow device preference |

### Accessibility

| Feature | Description |
|---------|-------------|
| **Large Touch Targets** | Minimum 48px tap areas |
| **High Contrast** | Clear color differentiation |
| **Screen Reader Support** | ARIA labels throughout |

### Help System

| Feature | Description |
|---------|-------------|
| **Help Icons** | Contextual ? icons explain each section |
| **Onboarding Wizard** | 6-step tutorial for new users |
| **Re-run Tutorial** | Available from Settings |

---

## Technical Features

### Security

| Feature | Description |
|---------|-------------|
| **Password Hashing** | bcrypt with salt rounds |
| **JWT Authentication** | Short-lived access tokens |
| **Refresh Tokens** | Secure token rotation |
| **HTTPS Support** | Full TLS encryption |
| **WebAuthn** | Phishing-resistant authentication |

### Database

| Feature | Description |
|---------|-------------|
| **SQLite** | Zero-config local database |
| **PostgreSQL** | Scalable for larger deployments |
| **Migrations** | Automatic schema updates |
| **Soft Relations** | Cascade deletes for data integrity |

### API

| Feature | Description |
|---------|-------------|
| **RESTful Design** | Standard HTTP methods |
| **JSON Responses** | Consistent response format |
| **Swagger Docs** | Interactive API documentation |
| **Rate Limiting** | Protection against abuse |

---

## Platform Support

### Browsers

| Browser | Support |
|---------|---------|
| Chrome (Desktop) | ✅ Full support |
| Chrome (Android) | ✅ Full support |
| Safari (macOS) | ✅ Full support |
| Safari (iOS) | ✅ Full support |
| Firefox | ✅ Full support |
| Edge | ✅ Full support |

### Passkey Support

| Platform | Support |
|----------|---------|
| iOS 16+ | ✅ Face ID / Touch ID |
| macOS Ventura+ | ✅ Touch ID |
| Android 9+ | ✅ Fingerprint / Face |
| Windows 10+ | ✅ Windows Hello |

---

## Feature Roadmap

Future features under consideration:

- [ ] Apple Watch app
- [ ] Sleep sounds integration
- [ ] Growth tracking
- [ ] Feeding integration
- [ ] Export to PDF
- [ ] Consultant sharing mode
