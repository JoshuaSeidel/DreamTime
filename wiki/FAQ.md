# Frequently Asked Questions

Common questions about DreamTime and baby sleep tracking.

---

## General Questions

### What is DreamTime?

DreamTime is a Progressive Web App (PWA) for tracking baby sleep. It helps parents:
- Log sleep events (put down, asleep, woke up, out of crib)
- Follow age-appropriate sleep schedules
- Get recommendations for nap times and bedtime
- Share tracking with caregivers
- Manage the 2-to-1 nap transition

### Is DreamTime free?

Yes, DreamTime is open-source and free to use. You self-host it on your own server.

### What devices does DreamTime work on?

DreamTime works on any device with a modern web browser:
- iPhone (Safari)
- Android (Chrome, Firefox)
- Desktop (Chrome, Firefox, Safari, Edge)
- Tablets

### Can I use DreamTime offline?

Yes! DreamTime is a PWA with offline support. Sleep events are queued and sync when you reconnect.

---

## Account & Setup

### How do I install DreamTime?

See the [Installation Guide](Installation-and-Setup) for Docker setup instructions. For end users, the admin provides a URL to access the app.

### How do I add DreamTime to my home screen?

**iOS (Safari):**
1. Open DreamTime URL in Safari
2. Tap Share button
3. Tap "Add to Home Screen"

**Android (Chrome):**
1. Open DreamTime URL in Chrome
2. Tap menu (three dots)
3. Tap "Install app" or "Add to Home screen"

### Can I change my password?

Yes. Go to Settings > Account > Change Password.

### How do I delete my account?

Contact your server administrator to delete your account and associated data.

---

## Sleep Tracking

### What are the 4 sleep states?

| State | Button | Meaning |
|-------|--------|---------|
| Awake | - | Baby is up and out of crib |
| In Crib | Put Down | Baby placed in crib, settling |
| Asleep | Fell Asleep | Baby is sleeping |
| Awake in Crib | Woke Up | Baby woke but still in crib |

### I forgot to tap a button. Can I fix it?

Yes! Tap the time displayed on any button to adjust it. You can backdate or edit times for any event.

### What's "qualified rest"?

Qualified rest = actual sleep + (awake crib time ÷ 2). This gives credit for quiet crib time even if baby didn't sleep.

### How do I log a car nap?

1. Tap "Log Car/Stroller Nap" on the dashboard
2. Select the location (car, stroller, etc.)
3. Enter when baby fell asleep
4. Tap "Awake" when baby wakes up

Ad-hoc naps count at 50% credit.

### Do I need to log night sleep?

Night sleep tracking is optional but recommended. It helps calculate total sleep and detect patterns.

---

## Schedule & Recommendations

### How are nap times calculated?

DreamTime uses:
1. Wake time (when baby woke up)
2. Wake windows (age-appropriate awake times)
3. Schedule constraints (earliest/latest times)
4. Sleep debt (adjusts bedtime if naps were short)

### What's a wake window?

A wake window is the time baby should be awake between sleep periods. Too short → undertired. Too long → overtired.

### Why is bedtime recommended so early?

If naps were shorter than expected, DreamTime moves bedtime earlier to compensate. This prevents overtiredness and protects night sleep.

### Can I customize the schedule?

Yes! Go to Schedule tab to adjust:
- Wake windows
- Nap timing constraints
- Bedtime window
- Day sleep cap
- Minimum crib time

### What schedule should I start with?

Start with the age-appropriate template:
- 4-6 months: 3-nap schedule
- 6-15 months: 2-nap schedule
- 15+ months: 1-nap schedule

Then adjust based on your baby's needs.

---

## 2-to-1 Transition

### When should I start the transition?

Most babies are ready between 14-18 months. Look for signs:
- Consistently fighting or skipping nap 2
- Taking 20+ minutes to fall asleep for nap 2
- Night sleep being affected

### How long does the transition take?

Typically 4-6 weeks with the standard pace. Fast-track is 2-4 weeks for very ready babies.

### Can I go back to 2 naps?

Yes, but try to commit for at least 2 weeks first. Some regression is normal during transition.

### Why is bedtime so early during transition?

Without the second nap, baby has a long afternoon awake window. Early bedtime (6:00-6:30 PM) prevents overtiredness while they adjust.

---

## Sharing & Caregivers

### Can multiple people track the same baby?

Yes! The child owner (Admin) can invite caregivers who get their own login but share the same child data.

### What's the difference between Caregiver and Viewer?

- **Caregiver**: Can view and track sleep
- **Viewer**: Can only view (no tracking)

### How do I invite a caregiver?

1. Go to Settings
2. Find your child
3. Tap "Caregivers"
4. Tap "Invite Caregiver"
5. Enter their email and select role

### Can caregivers change the schedule?

No, only Admins can edit the schedule. Caregivers can track sleep but not change settings.

---

## Notifications

### Why am I not getting notifications?

Check:
1. DreamTime Settings > Notifications enabled
2. Device Settings > DreamTime > Notifications allowed
3. Browser notification permissions
4. Focus/Do Not Disturb mode disabled

### Can I customize notification times?

Yes. Go to Settings > Notifications to set how many minutes before each event you want to be reminded.

### Do all caregivers get notifications?

Each user controls their own notification preferences. Enable notifications on each device where you want them.

---

## Technical Questions

### What data is stored?

DreamTime stores:
- User accounts (email, name, timezone)
- Child profiles (name, birth date)
- Sleep sessions (timestamps, duration)
- Schedule configurations
- Push notification subscriptions

### Is my data secure?

Yes. DreamTime uses:
- JWT authentication with refresh tokens
- WebAuthn/passkeys for passwordless login
- HTTPS encryption (when properly configured)
- Self-hosted means you control your data

### Can I export my data?

Currently, data export is available via the API. A built-in export feature is planned.

### Can I use my own database?

Yes. DreamTime supports:
- SQLite (default, no setup required)
- PostgreSQL (for larger deployments)

### Does DreamTime work with Home Assistant?

Yes! Enable MQTT integration to:
- Control sleep tracking via voice
- Automate nursery lights and sounds
- Display status on HA dashboards

---

## Troubleshooting

### The app is stuck loading

1. Pull down to refresh (mobile)
2. Clear browser cache
3. Log out and log back in
4. Reinstall the PWA

### My passkey stopped working

1. Go to Settings > Security
2. Remove the passkey
3. Add a new passkey
4. Make sure you're using HTTPS

### Recommendations seem wrong

1. Check schedule configuration matches your baby's age
2. Verify sleep times were logged correctly
3. Review the current sleep debt
4. Try resetting to a schedule template

### I lost my data

If self-hosting, check for backups in `data/database/`. Contact your administrator for help.

---

## Feature Requests

### How can I request a feature?

Open an issue on [GitHub](https://github.com/JoshuaSeidel/DreamTime/issues) with the "enhancement" label.

### What features are planned?

See the GitHub repository for the roadmap. Commonly requested:
- Apple Watch app
- Data export
- More analytics charts
- Multi-language support

---

## Sleep Training Questions

### Is DreamTime only for sleep training?

No! DreamTime works for any sleep tracking approach. The crib time rule and schedule features support sleep training, but you can use it as a simple sleep log too.

### What sleep method does DreamTime use?

DreamTime is method-agnostic. It supports:
- Wake windows (age-appropriate awake times)
- Crib time rule (60-90 minute minimum)
- Sleep debt tracking

You can disable any feature you don't use.

### My baby's schedule doesn't match the app

Every baby is different. The app provides evidence-based defaults, but you should:
1. Observe your baby's sleepy cues
2. Adjust wake windows based on results
3. Work with your pediatrician or sleep consultant

### Can I use DreamTime with a sleep consultant?

Yes! DreamTime can implement any schedule your consultant provides. Share the schedule configuration with them.

---

## Getting More Help

### Where can I get support?

- **This Wiki**: Comprehensive documentation
- **Troubleshooting**: Common issues and solutions
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Community support

### How do I report a bug?

1. Check [existing issues](https://github.com/JoshuaSeidel/DreamTime/issues)
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Device/browser information

