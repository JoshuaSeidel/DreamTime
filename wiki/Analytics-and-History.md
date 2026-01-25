# Analytics & History

Track sleep patterns and view historical data.

## Overview

DreamTime provides analytics and history features to help you:
- Review past sleep sessions
- Track patterns over time
- Identify trends
- Share data with sleep consultants

---

## History Tab

### Accessing History

1. Tap the **History** tab in the bottom navigation
2. Select a date range or specific day
3. View completed sleep sessions

### Session List

```
┌─────────────────────────────────────┐
│  📅 Today - January 15              │
├─────────────────────────────────────┤
│                                     │
│  🌙 Night Sleep                     │
│  7:00 PM → 6:30 AM                  │
│  Duration: 11h 30m                  │
│  Wakes: 1                           │
│                                     │
│  ─────────────────────────          │
│                                     │
│  💤 Nap 1                           │
│  8:45 AM → 10:15 AM                 │
│  Duration: 1h 30m (1h 35m crib)     │
│  Location: Crib                     │
│                                     │
│  ─────────────────────────          │
│                                     │
│  💤 Nap 2                           │
│  1:00 PM → 2:30 PM                  │
│  Duration: 1h 30m (1h 35m crib)     │
│  Location: Crib                     │
│                                     │
└─────────────────────────────────────┘
```

### Session Details

Tap any session to see details:

```
┌─────────────────────────────────────┐
│  Nap 1 Details                      │
├─────────────────────────────────────┤
│                                     │
│  Put Down:      8:40 AM             │
│  Fell Asleep:   8:50 AM             │
│  Woke Up:       10:15 AM            │
│  Out of Crib:   10:20 AM            │
│                                     │
│  ─────────────────────────          │
│                                     │
│  Crib Time:     1h 40m              │
│  Sleep Time:    1h 25m              │
│  Qualified Rest: 1h 32m             │
│                                     │
│  Location:      Crib                │
│  Type:          NAP                 │
│                                     │
│  [Edit]                [Delete]     │
│                                     │
└─────────────────────────────────────┘
```

### Editing Sessions

1. Tap a session to open details
2. Tap **Edit**
3. Adjust any timestamp
4. Tap **Save**

### Deleting Sessions

1. Tap a session to open details
2. Tap **Delete**
3. Confirm deletion

**Warning:** Deleted sessions cannot be recovered.

---

## Daily Summary

### Metrics

Each day shows a summary:

| Metric | Description |
|--------|-------------|
| **Total Day Sleep** | Sum of all nap durations |
| **Total Qualified Rest** | Sleep + (crib time credit) |
| **Nap Count** | Number of completed naps |
| **Night Sleep** | Previous night's duration |
| **Total 24h Sleep** | Night + day combined |

### Day Sleep Progress

```
┌─────────────────────────────────────┐
│  Day Sleep Progress                 │
├─────────────────────────────────────┤
│                                     │
│  Total: 2h 45m / 3h 30m cap         │
│  ██████████████████░░░  78%         │
│                                     │
│  Remaining: 45m                     │
│                                     │
└─────────────────────────────────────┘
```

---

## Weekly View

### Weekly Summary

Swipe or tap arrows to navigate weeks:

```
┌─────────────────────────────────────┐
│  ← Week of Jan 8 - Jan 14 →         │
├─────────────────────────────────────┤
│                                     │
│  Averages:                          │
│  • Day Sleep: 2h 50m                │
│  • Night Sleep: 11h 15m             │
│  • Total: 14h 05m                   │
│  • Naps/day: 2.0                    │
│  • Bedtime: 7:05 PM                 │
│  • Wake time: 6:38 AM               │
│                                     │
└─────────────────────────────────────┘
```

### Weekly Chart

Visual representation of sleep by day:

```
Day Sleep by Day
┌─────────────────────────────────────┐
│ Mon ████████████████░░░░ 2h 45m     │
│ Tue ██████████████████░░ 3h 00m     │
│ Wed ████████████░░░░░░░░ 2h 15m     │
│ Thu ████████████████░░░░ 2h 50m     │
│ Fri ██████████████████░░ 3h 10m     │
│ Sat ████████████████░░░░ 2h 45m     │
│ Sun ██████████████████░░ 3h 00m     │
└─────────────────────────────────────┘
```

---

## Analytics

### Sleep Trends

View trends over time:

| Metric | Trend |
|--------|-------|
| Average bedtime | Getting earlier/later |
| Average wake time | Consistency |
| Nap duration | Improving/declining |
| Night wakes | Frequency changes |

### Pattern Detection

DreamTime identifies patterns:

- **Best nap times**: When baby sleeps longest
- **Trouble spots**: Times that often fail
- **Sleep debt correlation**: How debt affects night sleep
- **Wake window effectiveness**: Optimal awake times

### Export Data

Export sleep data for:
- Sharing with sleep consultants
- Personal records
- Analysis in other tools

**API Export:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://dreamtime.example.com/api/children/{id}/sessions?startDate=2024-01-01&endDate=2024-01-31"
```

---

## Night Sleep Tracking

### Night Sessions

Night sleep sessions include:
- Bedtime (put down)
- Time to fall asleep
- Night wakes (with durations)
- Morning wake time
- Total night duration

### Night Wake Logging

```
┌─────────────────────────────────────┐
│  Night Wake                         │
├─────────────────────────────────────┤
│                                     │
│  Wake 1:                            │
│  Woke: 2:30 AM                      │
│  Back to sleep: 2:45 AM             │
│  Duration awake: 15m                │
│                                     │
│  [+ Log Another Wake]               │
│                                     │
└─────────────────────────────────────┘
```

### Night Sleep Metrics

| Metric | Description |
|--------|-------------|
| **Total Duration** | Bedtime to morning wake |
| **Actual Sleep** | Total minus wake time |
| **Wake Count** | Number of night wakes |
| **Longest Stretch** | Longest continuous sleep |
| **Sleep Efficiency** | Actual sleep / total time |

---

## Filtering & Search

### Date Range Filter

```
┌─────────────────────────────────────┐
│  Filter Sessions                    │
├─────────────────────────────────────┤
│                                     │
│  From: [2024-01-01]                 │
│  To:   [2024-01-31]                 │
│                                     │
│  [Apply]                            │
│                                     │
└─────────────────────────────────────┘
```

### Type Filter

Filter by session type:
- All sessions
- Naps only
- Night sleep only
- Ad-hoc naps only

### Location Filter

Filter by location:
- Crib
- Car seat
- Stroller
- Other

---

## Sharing Analytics

### With Caregivers

All caregivers with access to a child can view:
- Complete history
- All analytics
- Daily/weekly summaries

### With Sleep Consultants

1. Export data via API
2. Share summary screenshots
3. Provide view-only access (Viewer role)

---

## Tips for Using Analytics

### Track Consistently

The more data you log, the better the analytics:
- Log every sleep session
- Include all 4 states (put down, asleep, woke, out)
- Don't skip ad-hoc naps

### Review Weekly

Set a weekly review habit:
- Check weekly averages
- Note any changes in patterns
- Adjust schedule if needed

### Look for Patterns

Ask questions like:
- Does baby sleep better after longer wake windows?
- Are certain days consistently worse?
- Is sleep improving over time?

### Use History for Debugging

When sleep goes wrong:
1. Check what happened the previous night
2. Look at nap timing and duration
3. Calculate wake windows from the data
4. Identify what was different

