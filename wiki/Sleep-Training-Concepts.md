# Sleep Training Concepts

Understanding the sleep principles behind DreamTime's recommendations.

## Overview

DreamTime is built on established sleep consultant principles. This guide explains the core concepts that drive the app's recommendations.

---

## Wake Windows

### What Are Wake Windows?

Wake windows are the periods of time your baby is awake between sleep sessions. They're the foundation of sleep scheduling.

```
Wake ─────> NAP 1 ─────> NAP 2 ─────> BEDTIME
     WW1         WW2          WW3

WW = Wake Window
```

### Why Wake Windows Matter

| Too Short | Just Right | Too Long |
|-----------|------------|----------|
| Undertired | Easy settling | Overtired |
| Fights sleep | Falls asleep quickly | Meltdowns |
| Short naps | Good nap duration | Restless sleep |
| Night wakings | Consolidated night | Night wakings |

### Age-Appropriate Wake Windows

| Age | WW1 (Wake→Nap1) | WW2 (Nap1→Nap2) | WW3 (Last Nap→Bed) |
|-----|-----------------|-----------------|-------------------|
| 4-6 mo | 1.5-2h | 2-2.5h | 2-2.5h |
| 6-9 mo | 2-2.5h | 2.5-3h | 3-3.5h |
| 9-12 mo | 2.5-3h | 3-3.5h | 3.5-4h |
| 12-15 mo | 3-3.5h | 3.5-4h | 4-4.5h |
| 15-18 mo | 5-5.5h (single nap) | - | 4-5h |
| 18+ mo | 5-6h (single nap) | - | 4.5-5.5h |

### How DreamTime Uses Wake Windows

1. **Calculates recommendations**: Uses wake time + wake window = nap time
2. **Shows "Wait" vs "Ready"**: Based on minimum wake window
3. **Urgent warnings**: When approaching maximum wake window
4. **Flexible range**: Gives you a window, not just a single time

---

## Sleepy Cues

### Early Sleepy Cues

Watch for these signals that baby is getting tired:

| Cue | What It Looks Like |
|-----|-------------------|
| Yawning | First yawns appear |
| Eye rubbing | Hands to face |
| Ear pulling | Tugging at ears |
| Looking away | Avoiding eye contact |
| Less active | Slowing down play |

### Late Sleepy Cues (Overtired!)

If you see these, baby is past optimal sleep window:

| Cue | What It Looks Like |
|-----|-------------------|
| Fussiness | Crying, whining |
| Hyperactivity | Manic energy, can't settle |
| Clumsiness | Bumping into things |
| Clinginess | Won't be put down |
| Red eyebrows | Distinctive reddening |

### Using Cues with Wake Windows

**Best approach**: Put baby down based on wake window, even before seeing cues.

- Sleepy cues are subjective and easy to miss
- By the time you see cues, baby may be overtired
- Wake windows provide objective timing
- Trust the schedule over the cues

---

## The Crib Time Rule

### What Is It?

The 60-90 minute crib time rule means keeping baby in the crib for a minimum time period, regardless of whether they sleep.

### Why It Works

| Short Attempts | Full Crib Time |
|----------------|----------------|
| Baby learns: crying = out | Baby learns: crib = rest |
| Inconsistent message | Consistent sleep association |
| Sleep training stalls | Sleep training progresses |
| "Rescue" reinforces waking | Self-soothing develops |

### The Science

1. **Sleep associations form** when baby spends time in the crib environment
2. **Self-soothing develops** when baby has time to practice
3. **Cortisol (stress hormone)** naturally decreases after 20-30 minutes
4. **Sleep pressure** builds, making it easier to fall asleep

### DreamTime Implementation

```
┌─────────────────────────────────────┐
│  Crib Time Progress                 │
├─────────────────────────────────────┤
│                                     │
│  ████████████░░░░░░░  45m / 60m     │
│                                     │
│  15 minutes until minimum           │
│                                     │
│  [Wake Now]  (not recommended)      │
│                                     │
└─────────────────────────────────────┘
```

The app:
- Tracks time in crib from "Put Down"
- Shows countdown to minimum crib time
- Discourages early pickup
- Still allows override if needed

---

## Qualified Rest

### What Is Qualified Rest?

Qualified rest is DreamTime's measurement of valuable rest time, combining actual sleep with credit for crib time.

### The Formula

```
Qualified Rest = Sleep Time + (Awake Crib Time ÷ 2)
```

### Example Calculation

| Event | Time | Duration |
|-------|------|----------|
| Put Down | 9:00 AM | - |
| Fell Asleep | 9:30 AM | 30 min in crib awake |
| Woke Up | 10:30 AM | 60 min sleeping |
| Out of Crib | 10:45 AM | 15 min in crib awake |

**Calculation:**
- Sleep: 60 minutes
- Awake crib time: 30 + 15 = 45 minutes
- Awake crib credit: 45 ÷ 2 = 22.5 minutes
- **Qualified Rest: 82.5 minutes**

### Why Credit Awake Crib Time?

1. **Quiet rest has value** - Body still recovers
2. **Reinforces sleep training** - Encourages full crib time
3. **Realistic expectations** - Not every nap is perfect
4. **Reduces parent stress** - "Failed" naps still count

---

## Sleep Debt

### What Is Sleep Debt?

Sleep debt is the cumulative deficit when baby sleeps less than their biological need.

### How It Accumulates

| Expected | Actual | Debt |
|----------|--------|------|
| Nap 1: 90 min | 60 min | +30 min debt |
| Nap 2: 90 min | 45 min | +45 min debt |
| **Total** | | **75 min debt** |

### Effects of Sleep Debt

| Mild Debt | Moderate Debt | Severe Debt |
|-----------|---------------|-------------|
| <30 min | 30-60 min | >60 min |
| Slightly fussy | Irritable | Meltdowns |
| Bedtime OK | Earlier bedtime | Very early bedtime |
| Night may be fine | Some night wakes | Fragmented night |

### How DreamTime Compensates

1. **Bedtime adjustment**: Moves bedtime 15-30 minutes earlier
2. **Visual indicator**: Shows sleep debt on dashboard
3. **Explanation**: Tells you why bedtime shifted
4. **History**: Tracks debt patterns over time

### Managing Sleep Debt

**Same-Day Recovery:**
- Move bedtime earlier (primary strategy)
- Don't extend naps past day sleep cap
- Don't add extra naps

**Long-Term Strategies:**
- Consistent wake time (no "sleeping in" to recover)
- Protect nap environment
- Address underlying issues

---

## Day Sleep Cap

### What Is It?

The day sleep cap is the maximum total nap sleep to protect nighttime sleep.

### Why Cap Day Sleep?

| No Cap | With Cap |
|--------|----------|
| Less night sleep pressure | Appropriate sleep pressure |
| May resist bedtime | Ready for bedtime |
| Night wakings | Consolidated night sleep |
| Early morning wakes | Full night sleep |

### Recommended Caps by Age

| Age | Schedule | Day Cap | Night Goal |
|-----|----------|---------|------------|
| 4-6 mo | 3-nap | 4-5 hours | 10-11 hours |
| 6-12 mo | 2-nap | 3-3.5 hours | 11-12 hours |
| 12-18 mo | 2→1 nap | 2.5-3 hours | 11-12 hours |
| 18+ mo | 1-nap | 2-2.5 hours | 11-12 hours |

### DreamTime Cap Tracking

```
┌─────────────────────────────────────┐
│  Day Sleep: 2h 15m / 3h 30m cap     │
│  █████████████░░░░░  1h 15m left    │
└─────────────────────────────────────┘
```

When approaching the cap:
- Shows "Nap Cap Warning" notification
- Recommends waking baby
- Protects remaining cap for next nap (if applicable)

---

## Bedtime Windows

### The Golden Window

Every baby has an optimal bedtime window - too early or too late causes problems.

```
Too Early          Golden Window          Too Late
   ←──────────────────┼──────────────────→

   - Bedtime fight     - Easy settling      - Overtired
   - Split nights      - Quick to sleep     - Night wakings
   - Early wakes       - Full night         - Early wakes
```

### Finding the Right Bedtime

DreamTime calculates bedtime based on:

1. **Wake time**: When baby woke up
2. **Nap times**: When and how long baby napped
3. **Wake windows**: Age-appropriate awake times
4. **Sleep debt**: Short naps = earlier bedtime
5. **Schedule limits**: Your configured earliest/latest times

### Recommended Bedtimes

| Age | Earliest | Ideal | Latest |
|-----|----------|-------|--------|
| 4-6 mo | 6:00 PM | 6:30-7:30 PM | 8:00 PM |
| 6-12 mo | 5:30 PM | 6:30-7:30 PM | 8:00 PM |
| 12-18 mo | 5:30 PM | 6:45-7:30 PM | 8:00 PM |
| 18+ mo | 6:00 PM | 7:00-8:00 PM | 8:30 PM |

### Emergency Early Bedtime

When baby has severe sleep debt, an early bedtime (5:30-6:30 PM) can:
- Prevent overtiredness spiral
- Allow recovery sleep
- Reset for the next day

DreamTime will suggest emergency bedtimes when appropriate.

---

## Consistency & Routine

### Why Consistency Matters

Babies thrive on predictability. Consistent routines:
- Build sleep associations
- Reduce anxiety
- Signal "sleep is coming"
- Make falling asleep easier

### Sample Nap Routine (10-15 minutes)

```
1. Diaper change
2. Close blinds / darken room
3. Sleep sack on
4. White noise on
5. Brief song or phrase
6. Into crib
```

### Sample Bedtime Routine (20-30 minutes)

```
1. Bath (optional, not nightly)
2. Diaper and pajamas
3. Feed (if applicable)
4. Brush teeth
5. Dim lights, quiet play
6. Books (2-3 short books)
7. Song and cuddle
8. Into crib
```

### DreamTime Routine Support

- **Notifications**: Remind you before routine should start
- **Consistent timing**: Recommendations account for routine length
- **Tracking**: Log when you start routine, not just put-down time

---

## Environment

### Optimal Sleep Environment

| Factor | Recommendation |
|--------|----------------|
| **Darkness** | Very dark - can't see your hand |
| **Temperature** | 68-72°F (20-22°C) |
| **White Noise** | Continuous, moderate volume |
| **Crib Contents** | Empty - no blankets, toys, bumpers |
| **Sleep Sack** | Appropriate TOG for temperature |

### Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Room too bright | Early wakes, short naps | Blackout curtains |
| Too warm | Restless sleep | Lower temperature, lighter TOG |
| Silence | Wakes to house noises | Add white noise |
| Crib toys | Distraction, safety risk | Remove all items |

### Environment Consistency

Keep sleep environment the same:
- Between naps and night
- At home and when traveling
- For all caregivers

---

## Common Challenges

### False Starts

**What**: Baby wakes 30-45 minutes after bedtime
**Why**: Overtired, bedtime too late
**Fix**: Earlier bedtime, protect afternoon nap

### Split Nights

**What**: Baby awake for 1-2 hours in middle of night
**Why**: Undertired at bedtime, too much day sleep
**Fix**: Later bedtime, enforce day sleep cap

### Early Morning Wakes

**What**: Baby waking before 6 AM and won't resettle
**Why**: Overtired, bedtime too late, or light exposure
**Fix**: Earlier bedtime, blackout curtains, treat as night until desired wake time

### Short Naps

**What**: Naps under 45 minutes consistently
**Why**: Undertired, overtired, or sleep association issues
**Fix**: Adjust wake windows, use crib time rule, consistent routine

---

## Glossary

| Term | Definition |
|------|------------|
| **Wake Window** | Time baby should be awake between sleep periods |
| **Sleep Pressure** | Biological need for sleep that builds during wake time |
| **Sleep Debt** | Accumulated deficit from insufficient sleep |
| **Qualified Rest** | DreamTime's measure combining sleep + crib time credit |
| **Day Sleep Cap** | Maximum daytime sleep to protect night sleep |
| **Crib Time Rule** | Minimum 60-90 minutes in crib per nap attempt |
| **Sleep Association** | Conditions baby associates with falling asleep |
| **Self-Soothing** | Baby's ability to fall asleep independently |
| **Sleep Regression** | Temporary disruption in established sleep patterns |
| **Circadian Rhythm** | Internal clock regulating sleep-wake cycles |

