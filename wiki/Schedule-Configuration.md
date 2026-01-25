# Schedule Configuration

Configure your child's sleep schedule to get accurate recommendations.

## Accessing Schedule Settings

1. Open DreamTime
2. Select your child from the dropdown
3. Tap the **Schedule** tab in the bottom navigation
4. Make changes — they save automatically after 1 second

---

## Schedule Types

DreamTime supports three schedule types based on your child's age and development.

### 3-Nap Schedule (4-6 months)

Shortest wake windows, three naps per day.

| Setting | Typical Range |
|---------|---------------|
| Wake to Nap 1 | 1.5-2 hours |
| Nap 1 to Nap 2 | 2-2.5 hours |
| Nap 2 to Nap 3 | 2-2.5 hours |
| Nap 3 to Bedtime | 2-2.5 hours |
| Day Sleep Cap | 4-5 hours |

### 2-Nap Schedule (6-15 months)

Standard schedule for most babies. Two naps with longer wake windows.

| Setting | Typical Range |
|---------|---------------|
| Wake to Nap 1 | 2-2.5 hours |
| Nap 1 to Nap 2 | 2.5-3.5 hours |
| Nap 2 to Bedtime | 3.5-4.5 hours |
| Day Sleep Cap | 3-3.5 hours |

### 1-Nap Schedule (15+ months)

Single midday nap with longer wake windows.

| Setting | Typical Range |
|---------|---------------|
| Wake to Nap | 5-5.5 hours |
| Nap to Bedtime | 4-5 hours |
| Day Sleep Cap | 2-2.5 hours |

---

## Wake Windows

Wake windows are the time your baby should be awake between sleep periods.

### Configuration

```
┌─────────────────────────────────────┐
│  ⏰ Wake Windows                 [?]│
├─────────────────────────────────────┤
│                                     │
│  Wake → Nap 1                       │
│  Min: [2h 0m]  Max: [2h 30m]        │
│                                     │
│  Nap 1 → Nap 2                      │
│  Min: [2h 30m]  Max: [3h 30m]       │
│                                     │
│  Nap 2 → Bedtime                    │
│  Min: [3h 30m]  Max: [4h 30m]       │
│                                     │
└─────────────────────────────────────┘
```

### Fields

| Field | Description |
|-------|-------------|
| **Minimum** | Earliest time baby should be put down |
| **Maximum** | Latest time before baby becomes overtired |

### How It Works

- **Before minimum**: App shows "Wait" recommendation
- **At minimum**: Nap window opens, app shows "Ready for nap"
- **At maximum**: App shows urgent "Put down now" warning

### Wake Windows Control Nap Timing

Wake windows are the primary factor in calculating nap recommendations. The app uses your configured wake windows to determine when baby is ready for sleep:

**Nap 1 Calculation:**
- **Earliest nap time** = Wake time + Wake Window 1 Minimum
- **Latest nap time** = Wake time + Wake Window 1 Maximum

**Example**: If baby wakes at 6:30 AM with a 2h-2.5h wake window:
- Earliest Nap 1: 8:30 AM (6:30 + 2h)
- Latest Nap 1: 9:00 AM (6:30 + 2.5h)

When you adjust wake window settings, nap recommendations shift accordingly. The app also respects your configured earliest/latest time constraints as a safety net.

### Reset to Defaults

Each wake window section includes a **Reset to Default** button that restores age-appropriate values for your selected schedule type.

### Tips

1. **Start with age-appropriate defaults** - Use the schedule type presets
2. **Observe sleepy cues** - Yawning, eye rubbing, fussiness
3. **Adjust based on results** - If baby fights sleep, wake window may be too short
4. **Be consistent** - Stick to windows for 3-5 days before adjusting

---

## Nap Settings

Configure timing constraints for each nap.

### Nap 1 Settings

```
┌─────────────────────────────────────┐
│  💤 Nap 1 Settings                  │
├─────────────────────────────────────┤
│                                     │
│  Earliest Start: [08:30 AM]         │
│  Latest Start:   [09:00 AM]         │
│                                     │
│  Max Duration:   [2h 0m]            │
│  End By:         [11:00 AM]         │
│                                     │
└─────────────────────────────────────┘
```

### Fields

| Field | Description |
|-------|-------------|
| **Earliest Start** | Won't recommend nap before this time |
| **Latest Start** | Urgently recommends nap by this time |
| **Max Duration** | Nap cap notification triggers at this duration |
| **End By** | Hard deadline for nap to end |

### Why These Matter

- **Earliest**: Prevents undertired early naps
- **Latest Start**: Protects the day's schedule
- **Max Duration**: Preserves sleep pressure for night
- **End By**: Ensures enough awake time before next sleep

---

## Bedtime Settings

Configure the bedtime window and goals.

```
┌─────────────────────────────────────┐
│  🌙 Bedtime Settings                │
├─────────────────────────────────────┤
│                                     │
│  Earliest Bedtime: [5:30 PM]        │
│  Latest Bedtime:   [7:30 PM]        │
│                                     │
│  Goal Window                        │
│  Start: [7:00 PM]  End: [7:30 PM]   │
│                                     │
└─────────────────────────────────────┘
```

### Fields

| Field | Description |
|-------|-------------|
| **Earliest** | Emergency early bedtime floor |
| **Latest** | Never recommend bedtime after this |
| **Goal Start** | Optimal bedtime begins |
| **Goal End** | Optimal bedtime ends |

### Sleep Debt Adjustments

When naps are shorter than expected, bedtime moves earlier:

| Sleep Debt | Bedtime Adjustment |
|------------|-------------------|
| 0-15 minutes | No change |
| 15-30 minutes | 15 minutes earlier |
| 30-45 minutes | 30 minutes earlier |
| 45+ minutes | 45 minutes earlier |

---

## Morning Wake Time

Configure the expected morning wake time.

```
┌─────────────────────────────────────┐
│  🌅 Morning Wake                    │
├─────────────────────────────────────┤
│                                     │
│  Earliest: [6:30 AM]                │
│  Latest:   [7:30 AM]                │
│  Must Wake By: [7:30 AM]            │
│                                     │
└─────────────────────────────────────┘
```

### Fields

| Field | Description |
|-------|-------------|
| **Earliest** | Recommended wake time start |
| **Latest** | End of ideal wake window |
| **Must Wake By** | Deadline to protect the day's schedule |

### Why Wake Deadlines Matter

- Sleeping too late compresses wake windows
- Late wakes push naps later, causing cascading delays
- Bedtime gets pushed past the goal window

---

## Day Sleep Cap

The maximum total day sleep to protect night sleep.

```
┌─────────────────────────────────────┐
│  📊 Day Sleep Cap                   │
├─────────────────────────────────────┤
│                                     │
│  Maximum Day Sleep: [3h 30m]        │
│                                     │
│  Current: 2h 15m of 3h 30m          │
│  ████████████░░░░  Remaining: 1h 15m│
│                                     │
└─────────────────────────────────────┘
```

### Recommended Caps

| Schedule Type | Day Sleep Cap |
|--------------|---------------|
| 3-Nap | 4-5 hours |
| 2-Nap | 3-3.5 hours |
| 1-Nap | 2-2.5 hours |

### How It Works

1. App tracks total qualified rest across all naps
2. Remaining cap shown on dashboard
3. When cap is reached, app recommends waking baby
4. Nap cap notifications alert you before exceeding

---

## Minimum Crib Time

The 60-90 minute crib rule for sleep training.

```
┌─────────────────────────────────────┐
│  🛏️ Crib Time Rule               [?]│
├─────────────────────────────────────┤
│                                     │
│  Minimum Crib Time: [60] minutes    │
│                                     │
│  Baby should stay in crib for at    │
│  least this long, even if not       │
│  sleeping, to build the sleep       │
│  association.                       │
│                                     │
└─────────────────────────────────────┘
```

### Recommended Settings

| Situation | Minimum |
|-----------|---------|
| Starting sleep training | 60 minutes |
| Established routine | 60-90 minutes |
| 2-to-1 transition | 90 minutes |

### Benefits

- Teaches baby that crib = sleep time
- Prevents "rescue" reinforcement
- Counts quiet rest as valuable rest

---

## Notification Settings

Configure reminders for sleep events.

```
┌─────────────────────────────────────┐
│  🔔 Notifications                   │
├─────────────────────────────────────┤
│                                     │
│  Nap Reminder:     [30] min before  │
│  Bedtime Reminder: [30] min before  │
│  Wake Deadline:    [15] min before  │
│                                     │
└─────────────────────────────────────┘
```

### Notification Types

| Notification | When It Fires |
|--------------|---------------|
| **Nap Reminder** | X minutes before nap window opens |
| **Bedtime Reminder** | X minutes before recommended bedtime |
| **Wake Deadline** | X minutes before must-wake time |
| **Nap Cap Warning** | When approaching day sleep cap |

---

## 2-to-1 Nap Transition

Special mode for transitioning from 2 naps to 1.

### Starting the Transition

1. Go to **Schedule** tab
2. Scroll to **Nap Transition** section
3. Tap **Start 2-to-1 Transition**
4. Select your pace (Standard or Fast-Track)

### Transition Settings

```
┌─────────────────────────────────────┐
│  🔄 2-to-1 Transition            [?]│
├─────────────────────────────────────┤
│                                     │
│  Status: Week 2 of 6                │
│  ████████░░░░░░░░  33% Complete     │
│                                     │
│  Current Target: 11:45 AM           │
│  Goal: 12:30 PM                     │
│                                     │
│  Push Interval: Every 5 days        │
│  Push Amount: 15 minutes            │
│                                     │
│  [Adjust Pace]  [End Transition]    │
│                                     │
└─────────────────────────────────────┘
```

### How It Works

1. **Week 1-2**: Single nap at 11:30 AM
2. **Every 5-7 days**: Push nap 15 minutes later
3. **Week 3-4**: Single nap around 12:00 PM
4. **Week 5-6**: Single nap at 12:30-1:00 PM (goal)

### Pace Options

| Pace | Duration | Push Interval | Best For |
|------|----------|---------------|----------|
| **Standard** | 6 weeks | Every 5-7 days | Most babies |
| **Fast-Track** | 2-4 weeks | Every 3-4 days | Very ready babies |

### Readiness Signs

Your baby may be ready for transition if:
- Consistently skipping or fighting nap 2
- Taking very long time to fall asleep for nap 2
- Nap 2 is getting very short (< 30 minutes)
- Nighttime sleep is being affected
- Baby is 14-18 months old

### Tips for Success

1. **Expect earlier bedtimes** - First few weeks may need 6:00-6:30 PM bedtime
2. **Use the 90-minute crib rule** - Baby needs time to adjust
3. **Allow rescue naps sparingly** - Occasional car naps are okay
4. **Watch for overtiredness** - Meltdowns mean pushing too fast
5. **Be patient** - The transition takes 4-6 weeks

---

## Schedule Templates

DreamTime includes pre-configured templates.

### Using Templates

1. Go to **Schedule** tab
2. Tap **Schedule Type** dropdown
3. Select a template
4. Adjust values as needed
5. Tap **Save Schedule**

### Available Templates

| Template | Age Range | Naps |
|----------|-----------|------|
| 3-Nap Standard | 4-6 months | 3 |
| 2-Nap Standard | 6-15 months | 2 |
| 1-Nap Standard | 15+ months | 1 |
| 2-to-1 Transition | 14-18 months | 1-2 |

---

## Saving and Syncing

### Auto-Save Behavior

Schedule changes are saved automatically:

| Action | What Happens |
|--------|--------------|
| **Change any setting** | Auto-save triggers after 1 second |
| **Success** | "Schedule updated - Changes saved automatically" toast appears |
| **Error** | Error message shown, changes preserved locally |

This means you can:
- Adjust multiple settings quickly without clicking save
- See changes reflected in Dashboard recommendations immediately
- Return to Dashboard and see updated nap/bedtime times

### Dashboard Updates

When you return to the Dashboard after changing schedule settings:
- Recommendations refresh automatically
- New wake windows are used for calculations
- Bedtime adjusts based on updated settings

### Per-Child Settings

- Each child has their own schedule
- Switch children to see/edit different schedules
- Caregivers see the same schedule as the owner

---

## Troubleshooting

### Schedule Not Saving

1. Check your internet connection
2. Make sure all fields have valid values
3. Try refreshing the page
4. Check if another caregiver made changes

### Recommendations Not Updating After Schedule Change

1. Return to Dashboard — it auto-refreshes when you navigate back
2. If still stale, pull down to refresh or switch tabs
3. Verify the change actually saved (check for success toast)
4. Try switching to another child and back

### Recommendations Seem Wrong

1. Verify wake windows match your baby's needs — these directly control nap timing
2. Check that nap times were logged correctly (use actual wake time, not out-of-crib time)
3. Ensure schedule type matches your child's age
4. Review the day sleep cap setting
5. Check that morning wake time was tracked (affects all subsequent recommendations)

### Notifications Not Working

1. Check browser notification permissions
2. Verify notifications are enabled in Settings
3. Make sure the PWA is installed
4. Check that reminder times are set correctly

