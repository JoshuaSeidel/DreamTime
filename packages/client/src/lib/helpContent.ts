// Help content for contextual help icons throughout the app
// Based on sleep consultant principles and guidance

export const HELP_CONTENT = {
  // Dashboard sections
  currentStatus: {
    title: 'Sleep States',
    description:
      'Track baby through 4 states: In Crib (settling), Asleep, Awake (still in crib), Out of Crib. Each transition helps calculate qualified rest time.',
  },
  cribTime: {
    title: 'Minimum Crib Time',
    description:
      "The 60-90 minute crib rule ensures baby has enough opportunity to sleep. Even quiet rest time builds the crib-sleep association for sleep training.",
  },
  quickActions: {
    title: 'Tracking Sleep',
    description:
      'Tap buttons in order: Put Down \u2192 Fell Asleep \u2192 Woke Up \u2192 Out of Crib. The app calculates "qualified rest" = sleep + (awake crib time \u00f7 2).',
  },
  todaySummary: {
    title: 'Daily Summary',
    description:
      'Total sleep from completed sessions. Sleep debt (naps shorter than goal) shifts bedtime earlier to prevent overtiredness.',
  },
  nextRecommendation: {
    title: 'Recommendations',
    description:
      'Based on wake windows (time since last sleep) and your schedule. Shows earliest, latest, and recommended target times.',
  },

  // Schedule sections
  scheduleType: {
    title: 'Schedule Types',
    description:
      '3-nap (4-6mo): shorter wake windows. 2-nap (6-15mo): standard schedule. 1-nap (15mo+): single midday nap. Choose based on age and readiness.',
  },
  wakeWindows: {
    title: 'Wake Windows',
    description:
      'Maximum awake time before sleep pressure builds. Too short = undertired fights. Too long = overtired meltdowns. The range gives flexibility.',
  },
  sleepCaps: {
    title: 'Day Sleep Cap',
    description:
      'Capping day sleep protects night sleep. 2-nap: ~3-3.5 hours total. 1-nap: ~2-2.5 hours. Ensures enough sleep pressure for 11-12 hour nights.',
  },
  minimumCribTime: {
    title: 'Crib Time Rule',
    description:
      "The 60-90 minute minimum teaches baby that crib = sleep. Short attempts don't build the association. Staying in crib builds the habit.",
  },
  transitionProgress: {
    title: '2-to-1 Transition',
    description:
      'Transition over 4-6 weeks by pushing single nap later (11:30am \u2192 12:30pm). Expect earlier bedtimes initially. Fast-track for babies showing strong readiness.',
  },
  transitionPace: {
    title: 'Transition Pace',
    description:
      'Standard: 6 weeks, pushing 15min later every 5-7 days. Fast-track (2-4 weeks): push every 3-4 days if baby handles it well. Check temperament at 11:30am.',
  },

  // History sections
  sessionHistory: {
    title: 'Session History',
    description:
      'View all past sleep sessions with durations and times. Use this to spot patterns and see how sleep is improving over time.',
  },

  // Analytics sections
  analytics: {
    title: 'Sleep Analytics',
    description:
      'Track sleep patterns over time. Look for trends in nap duration, bedtime consistency, and total daily sleep to optimize the schedule.',
  },

  // Notification settings
  notifications: {
    title: 'Reminder Notifications',
    description:
      'Get push notifications before nap time, bedtime, and morning wake deadline. Adjust lead times to fit your routine.',
  },

  // Weekly plan during transition
  transitionWeeklyPlan: {
    title: "This Week's Plan",
    description:
      'Follow the target nap time for this week. The 90-minute crib rule still applies \u2013 even if baby doesn\'t sleep, the rest time matters.',
  },

  // Ad-hoc naps
  adHocNaps: {
    title: 'Car & Stroller Naps',
    description:
      'Motion sleep counts at half credit. Under 15 min: 0 credit. 15+ min: half credit. Naps 30+ min push bedtime 15 minutes later.',
  },
} as const;

export type HelpContentKey = keyof typeof HELP_CONTENT;

/**
 * Onboarding wizard step content
 */
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to DreamTime!',
    description:
      "DreamTime helps you track your baby's sleep and follow your sleep consultant's schedule. Let's take a quick tour of the key concepts.",
  },
  {
    id: 'states',
    title: 'Understanding Sleep States',
    description:
      'When tracking sleep, you\'ll move through 4 states:\n\n\u2022 In Crib - Baby placed down, settling\n\u2022 Asleep - Baby is sleeping\n\u2022 Awake - Baby woke up, still in crib\n\u2022 Out of Crib - Session complete\n\nTap the buttons in order to track each transition.',
  },
  {
    id: 'wakeWindows',
    title: 'What are Wake Windows?',
    description:
      "Wake windows are the time between sleep periods. Each age has optimal ranges:\n\n\u2022 Too short = baby isn't tired enough\n\u2022 Too long = overtired and harder to settle\n\nThe app recommends nap times based on these windows.",
  },
  {
    id: 'cribTime',
    title: 'The Crib Time Rule',
    description:
      'For sleep training success, use the 60-90 minute crib rule:\n\n\u2022 Keep baby in crib for minimum time\n\u2022 Even if baby doesn\'t sleep, quiet rest counts\n\u2022 This builds the "crib = sleep" association\n\nThe app tracks this for you automatically.',
  },
  {
    id: 'recommendations',
    title: 'Smart Recommendations',
    description:
      'The dashboard shows your next action:\n\n\u2022 NAP - Time for a nap (with time window)\n\u2022 BEDTIME - Time for bed\n\u2022 WAIT - Not ready for sleep yet\n\u2022 WAKE - Time to wake baby up\n\nRecommendations adjust based on actual sleep.',
  },
  {
    id: 'getStarted',
    title: "You're Ready!",
    description:
      'Quick tips to get started:\n\n\u2022 Add your child in Settings\n\u2022 Set up their schedule in the Schedule tab\n\u2022 Tap ? icons anytime for help\n\u2022 Track sleep from the Dashboard\n\nHappy sleeping!',
  },
] as const;
