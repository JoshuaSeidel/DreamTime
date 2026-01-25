# Dashboard

The Dashboard is your main interface for tracking sleep and viewing recommendations.

## Overview

The Dashboard shows:
1. **Current Status** - Baby's current state (Awake, In Crib, Asleep)
2. **Crib Time Countdown** - Time remaining for minimum crib rule (naps only)
3. **Quick Actions** - Buttons to record sleep events
4. **Today's Summary** - Total sleep and nap count
5. **Today's Bedtime** - Calculated bedtime based on actual naps
6. **Next Recommendation** - What to do next with time window

---

## Current Status Card

Displays the baby's current state with color-coded indicator:

| State | Color | Meaning |
|-------|-------|---------|
| **Awake** | 🟢 Green | Baby is out of crib, awake |
| **In Crib** | 🔵 Blue (pulsing) | Baby placed in crib, settling |
| **Asleep** | 🟣 Purple (slow pulse) | Baby is sleeping |
| **Awake in Crib** | 🟡 Yellow | Baby woke up but still in crib |

The card also shows relevant timestamps:
- "Put down at 9:15 AM" when in crib
- "Fell asleep at 9:30 AM" when asleep

**Help Icon (?)**: Explains the 4 sleep states and how to track them.

---

## Crib Time Countdown

Appears when baby is in crib for a **nap** (not bedtime).

### What It Shows

```
┌─────────────────────────────────────┐
│  ⏱️ Crib Time                    [?]│
│                                     │
│  ████████████░░░░░  45m / 60m       │
│                                     │
│  15 minutes until minimum crib time │
│  Nap cap: 2h remaining              │
└─────────────────────────────────────┘
```

### Components

| Element | Description |
|---------|-------------|
| **Progress Bar** | Visual indicator of crib time progress |
| **Current / Target** | Minutes in crib vs. minimum required |
| **Status Message** | How long until minimum is reached |
| **Nap Cap** | Time remaining before nap should end |

### Color Changes

- **Blue**: Working toward minimum crib time
- **Green**: Minimum crib time achieved
- **Yellow**: Approaching nap cap (last 15 minutes)
- **Red**: Nap cap exceeded

### Day Sleep Budget Tracker

When baby is asleep during a nap, an additional tracker shows progress toward the daily sleep cap:

```
┌─────────────────────────────────────┐
│  Day Sleep Budget                   │
│  ████████░░░░░░░░  45m / 210m       │
│  165m remaining of 210m daily cap   │
└─────────────────────────────────────┘
```

| State | Color | Behavior |
|-------|-------|----------|
| Normal | Blue | Shows minutes used vs. remaining budget |
| Approaching (75%+) | Orange | Warning that cap is getting close |
| 5-minute warning | Red (pulsing) | Countdown timer with "Get baby soon!" alert |
| Exceeded | Red (pulsing) | "Get baby NOW!" with wake recommendation |

The 5-minute warning includes a real-time countdown timer showing exactly how long until the daily cap is reached. This helps you wake baby at the right moment to protect bedtime.

**Help Icon (?)**: Explains why the 60-90 minute crib rule matters for sleep training.

---

## Quick Actions

Large, touch-friendly buttons to record sleep events.

### Button States

| Button | When Available | What It Records |
|--------|----------------|-----------------|
| **Put Down** | When baby is awake | Starts a new session |
| **Fell Asleep** | When baby is in crib | Records asleep time |
| **Woke Up** | When baby is asleep | Records wake time |
| **Out of Crib** | When baby woke up | Ends the session |

### Button Colors

- **Blue**: Put Down
- **Purple**: Fell Asleep
- **Yellow**: Woke Up
- **Green**: Out of Crib

### Time Display

Each button shows the current time. Tap the time to adjust it:

```
┌─────────────────┐
│   Fell Asleep   │
│     9:30 AM     │  ← Tap to edit time
└─────────────────┘
```

### Editing Times

1. Tap the time on any button
2. Adjust the date and time
3. Tap **Confirm** to save

This is useful when you forgot to tap the button at the right time.

**Help Icon (?)**: Explains the tracking flow and qualified rest calculation.

---

## Ad-Hoc Nap Button

Below the quick actions:

```
┌─────────────────────────────────────┐
│  🚗 Log Car/Stroller Nap            │
└─────────────────────────────────────┘
```

### What It Does

Records naps that happen outside the crib:
- Car seat
- Stroller
- Baby carrier
- Swing
- Playpen
- Other

### How to Use

1. Tap **Log Car/Stroller Nap**
2. Select the location
3. Enter when baby fell asleep
4. Tap **Start Nap**
5. When baby wakes, tap **Awake** on the dashboard

### Sleep Credit

Ad-hoc naps count at half credit:
- Under 15 minutes: 0 credit
- 15+ minutes: Duration ÷ 2

Additionally, ad-hoc naps 30+ minutes push bedtime 15 minutes later.

---

## Today's Summary Card

Shows sleep totals for today:

```
┌─────────────────────────────────────┐
│  ⏰ Today's Summary              [?]│
├─────────────────────────────────────┤
│  ┌─────────┬─────────┐             │
│  │  2h 15m │    2    │             │
│  │  Sleep  │  Naps   │             │
│  └─────────┴─────────┘             │
└─────────────────────────────────────┘
```

### Metrics

| Metric | Description |
|--------|-------------|
| **Total Sleep** | Sum of all sleep minutes today |
| **Naps** | Count of completed naps |

**Help Icon (?)**: Explains how sleep debt affects bedtime recommendations.

---

## Today's Bedtime Card

Shows calculated bedtime based on actual naps:

```
┌─────────────────────────────────────┐
│  🌙 Today's Bedtime                 │
├─────────────────────────────────────┤
│                                     │
│  Recommended: 6:45 PM               │
│  Window: 6:30 PM - 7:30 PM          │
│                                     │
│  ⚠️ Sleep debt: 30m                 │
│  Bedtime moved 15m earlier          │
└─────────────────────────────────────┘
```

### Components

| Element | Description |
|---------|-------------|
| **Recommended** | Optimal bedtime based on last nap |
| **Window** | Acceptable range (earliest to latest) |
| **Sleep Debt** | How much sleep baby missed vs. goal |
| **Adjustment** | How much bedtime shifted due to debt |

---

## Next Recommendation Card

Shows what action to take next:

### NAP Recommendation

```
┌─────────────────────────────────────┐
│  🔵 Nap 2                        [?]│
│                                     │
│  Oliver should be ready for Nap 2   │
│  Target: 12:30 PM (in 45m)          │
│                                     │
│  • Wake window: 2.5-3.5h            │
│  • Currently awake: 2h 15m          │
└─────────────────────────────────────┘
```

### BEDTIME Recommendation

```
┌─────────────────────────────────────┐
│  🟣 Bedtime                      [?]│
│                                     │
│  Oliver should be ready for bed     │
│  Target: 7:00 PM (in 1h 30m)        │
│                                     │
│  • Sleep debt: 15m - earlier bed    │
└─────────────────────────────────────┘
```

### WAIT Recommendation

```
┌─────────────────────────────────────┐
│  ⏳ Wait                         [?]│
│                                     │
│  Oliver isn't ready for sleep yet   │
│  Next window opens at 9:30 AM       │
│                                     │
│  • Currently awake: 1h 45m          │
│  • Minimum wake window: 2h          │
└─────────────────────────────────────┘
```

### WAKE Recommendation

```
┌─────────────────────────────────────┐
│  🔴 Wake Now!                    [?]│
│                                     │
│  Oliver has reached the wake        │
│  deadline and should be woken       │
│                                     │
│  • Must wake by: 7:30 AM            │
│  • Current time: 7:35 AM            │
└─────────────────────────────────────┘
```

**Help Icon (?)**: Explains how recommendations are calculated.

---

## Child Selector

Top-right corner dropdown to switch between children:

```
[Oliver ▼]
├── Oliver    ← Current
├── Emma
└── + Add Child
```

The selected child is remembered across sessions.

---

## No Child State

If no child is added yet:

```
┌─────────────────────────────────────┐
│                                     │
│         👶 Welcome to DreamTime!    │
│                                     │
│  Add your child to start tracking   │
│  their sleep patterns.              │
│                                     │
│       [ + Add Your Child ]          │
│                                     │
└─────────────────────────────────────┘
```

---

## Auto-Refresh Behavior

The Dashboard automatically stays up-to-date:

| Trigger | What Happens |
|---------|--------------|
| **Every 30 seconds** | Background refresh of all data |
| **Return to tab** | Immediate refresh when you switch back to the app |
| **Return from other page** | Refresh when navigating back to Dashboard |

This ensures:
- Schedule changes made on the Schedule page are immediately reflected
- Multi-caregiver tracking stays in sync
- Recommendations update as time passes

---

## Tips for Dashboard Use

1. **Keep It Open** - DreamTime auto-refreshes every 30 seconds
2. **Use Time Editing** - Don't worry about tapping exactly on time
3. **Watch the Recommendations** - They get more accurate as you track more data
4. **Enable Notifications** - Get reminded before sleep windows
5. **Check After Schedule Changes** - Dashboard refreshes automatically when you return from Schedule page
