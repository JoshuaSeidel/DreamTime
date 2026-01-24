import { addMinutes, differenceInDays, parse, format, isAfter, isBefore, addDays } from 'date-fns';
import { prisma } from '../config/database.js';
import type { TransitionResponse } from '../schemas/schedule.schema.js';
import { ScheduleType, InviteStatus } from '../types/enums.js';

// Transition configuration based on sleep training guidelines
export interface TransitionConfig {
  // Week 1-2 rules
  week1_2: {
    minNapEarliest: string;  // "11:30" - earliest nap allowed
    cribRule: number;        // 90 minutes minimum in crib
    maxWakeWindow: number;   // 5.5 hours from wake
  };
  // Week 2+ rules
  week2_plus: {
    minNapEarliest: string;  // "12:00" - can push nap later
    pushIntervalDays: { min: number; max: number }; // 3-7 days before pushing later
    pushAmount: number;      // 15 minutes later each push
  };
  // Fast-track rules (for accelerated transitions)
  fastTrack: {
    skipTo12pm: boolean;           // If baby handles morning well, can skip to 12pm
    fastTrackStartTime: string;    // "12:00" - start time for fast-track
    fastPushIntervalDays: number;  // 2-3 days between pushes when fast-tracking
    temperamentCheckTime: string;  // "11:30" - time to assess if baby can make it to 12pm
  };
  // Goal configuration
  goal: {
    targetNapStart: string;  // "12:30" or "13:00"
    maxNapDuration: number;  // 150-180 minutes
    napEndBy: string;        // "15:00" or "15:30"
    bedtimeWakeWindow: { min: number; max: number }; // 4-5 hours
  };
  // Temporary allowances
  temporary: {
    maxWakeTime: string;     // "08:00" allowed in first few months
  };
}

// Default transition configuration from sleep training plan
const DEFAULT_TRANSITION_CONFIG: TransitionConfig = {
  week1_2: {
    minNapEarliest: '11:30',
    cribRule: 90,
    maxWakeWindow: 330, // 5.5 hours in minutes
  },
  week2_plus: {
    minNapEarliest: '12:00',
    pushIntervalDays: { min: 3, max: 7 },
    pushAmount: 15,
  },
  fastTrack: {
    skipTo12pm: true,              // Can skip directly to 12pm if baby shows readiness
    fastTrackStartTime: '12:00',   // Start at 12pm instead of 11:30
    fastPushIntervalDays: 2,       // Can push every 2-3 days when fast-tracking
    temperamentCheckTime: '11:30', // Check temperament at 11:30 to see if baby can make it to 12pm
  },
  goal: {
    targetNapStart: '12:30',
    maxNapDuration: 150,
    napEndBy: '15:00',
    bedtimeWakeWindow: { min: 240, max: 300 }, // 4-5 hours
  },
  temporary: {
    maxWakeTime: '08:00',
  },
};

// Response types
export interface TransitionProgressResult {
  transition: TransitionResponse;
  currentPhase: 'week1_2' | 'week2_plus' | 'final';
  progress: {
    weeksCompleted: number;
    totalExpectedWeeks: { min: number; max: number };
    percentComplete: number;
  };
  currentRules: {
    minNapEarliest: string;
    cribRule: number;
    targetNapTime: string;
  };
  nextMilestone: {
    description: string;
    targetDate: Date | null;
    action: string;
  };
  recommendations: string[];
}

export interface NapPushRecommendation {
  shouldPush: boolean;
  currentNapTime: string;
  suggestedNewTime: string | null;
  reason: string;
  daysSinceLastPush: number;
  readinessIndicators: string[];
}

// Helper to parse time string to minutes from midnight
function parseTimeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

// Helper to format minutes to time string
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Verify child access
async function verifyChildAccess(userId: string, childId: string): Promise<void> {
  const relation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: { childId, userId },
    },
  });

  if (!relation || relation.status !== InviteStatus.ACCEPTED) {
    throw new Error('Child not found');
  }
}

// Get transition progress and analysis
export async function getTransitionProgress(
  userId: string,
  childId: string,
  config: TransitionConfig = DEFAULT_TRANSITION_CONFIG
): Promise<TransitionProgressResult | null> {
  await verifyChildAccess(userId, childId);

  const transition = await prisma.scheduleTransition.findFirst({
    where: {
      childId,
      completedAt: null,
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!transition) {
    return null;
  }

  const daysSinceStart = differenceInDays(new Date(), transition.startedAt);
  const currentWeek = Math.ceil(daysSinceStart / 7) || 1;
  const recommendations: string[] = [];
  const targetWeeks = transition.targetWeeks ?? 6;
  const isFastTracked = targetWeeks <= 4; // Fast-track if 4 weeks or less

  // Determine current phase
  let currentPhase: 'week1_2' | 'week2_plus' | 'final';
  let minNapEarliest: string;
  let cribRule: number;

  if (currentWeek <= 2) {
    currentPhase = 'week1_2';
    cribRule = config.week1_2.cribRule;

    if (isFastTracked) {
      // Fast-track: Can potentially skip to 12pm if baby shows readiness
      minNapEarliest = config.fastTrack.fastTrackStartTime;
      recommendations.push('Fast-track mode: If temperament is good at 11:30am, try pushing to 12pm');
      recommendations.push('If baby can make it to 12/12:15pm comfortably, you can fast-track the process');
      recommendations.push('Enforce the crib 90 rule - minimum 90 minutes in crib');
      recommendations.push('Some morning rest/nap can help baby stay well-rested even during transition');
    } else {
      // Standard pace: Start at 11:30am
      minNapEarliest = config.week1_2.minNapEarliest;
      recommendations.push('Keep nap no earlier than 11:30am');
      recommendations.push('Enforce the crib 90 rule - minimum 90 minutes in crib');
      recommendations.push('Expect some adjustment difficulties this week - this is normal');
      recommendations.push('Morning rest/nap can help baby stay more well-rested');
    }
  } else {
    const targetMinutes = parseTimeToMinutes(config.goal.targetNapStart);
    const currentMinutes = parseTimeToMinutes(transition.currentNapTime);

    if (currentMinutes >= targetMinutes) {
      currentPhase = 'final';
      minNapEarliest = config.goal.targetNapStart;
      cribRule = config.week1_2.cribRule;
      recommendations.push('Transition nearly complete!');
      recommendations.push('Maintain consistent nap timing');
      recommendations.push('Consider completing transition if baby is thriving');
    } else {
      currentPhase = 'week2_plus';
      minNapEarliest = config.week2_plus.minNapEarliest;
      cribRule = config.week1_2.cribRule;

      if (isFastTracked) {
        // Fast-track: Can push more frequently
        const pushDays = config.fastTrack.fastPushIntervalDays;
        recommendations.push(`Fast-track: Can push nap later every ${pushDays}-3 days if baby adapts well`);
        recommendations.push('If doing well at 12/12:15pm for a few days, start bumping to 12:30pm');
        recommendations.push('Watch for signs baby is ready: good temperament, waking happy');
      } else {
        // Standard pace
        recommendations.push('Can push nap later every 3-7 days');
        recommendations.push('Watch for signs baby is ready: waking happy, good nap length');
      }
    }
  }

  // Calculate progress
  const startMinutes = parseTimeToMinutes('11:30');
  const goalMinutes = parseTimeToMinutes(config.goal.targetNapStart);
  const currentMinutes = parseTimeToMinutes(transition.currentNapTime);
  const totalProgressNeeded = goalMinutes - startMinutes;
  const progressMade = currentMinutes - startMinutes;
  const percentComplete = Math.min(100, Math.max(0, (progressMade / totalProgressNeeded) * 100));

  // Calculate next milestone
  let nextMilestone: { description: string; targetDate: Date | null; action: string };

  if (currentPhase === 'week1_2') {
    nextMilestone = {
      description: 'Complete first 2 weeks of transition',
      targetDate: addDays(transition.startedAt, 14),
      action: 'Maintain consistent schedule and crib 90 rule',
    };
  } else if (currentPhase === 'week2_plus') {
    const nextNapTime = minutesToTimeString(Math.min(currentMinutes + 15, goalMinutes));
    nextMilestone = {
      description: `Push nap time to ${nextNapTime}`,
      targetDate: addDays(new Date(), config.week2_plus.pushIntervalDays.min),
      action: 'Push nap 15 minutes later when ready',
    };
  } else {
    nextMilestone = {
      description: 'Complete transition',
      targetDate: null,
      action: 'Mark transition as complete when baby is consistently thriving',
    };
  }

  return {
    transition: {
      id: transition.id,
      childId: transition.childId,
      fromType: transition.fromType,
      toType: transition.toType,
      startedAt: transition.startedAt,
      currentWeek: transition.currentWeek,
      targetWeeks: transition.targetWeeks ?? 6,
      currentNapTime: transition.currentNapTime,
      completedAt: transition.completedAt,
      notes: transition.notes,
      createdAt: transition.createdAt,
      updatedAt: transition.updatedAt,
    },
    currentPhase,
    progress: {
      weeksCompleted: currentWeek - 1,
      totalExpectedWeeks: { min: 2, max: transition.targetWeeks ?? 6 },
      percentComplete: Math.round(percentComplete),
    },
    currentRules: {
      minNapEarliest,
      cribRule,
      targetNapTime: transition.currentNapTime,
    },
    recommendations,
    nextMilestone,
  };
}

// Analyze if it's time to push the nap later
export async function analyzeNapPushReadiness(
  userId: string,
  childId: string,
  config: TransitionConfig = DEFAULT_TRANSITION_CONFIG
): Promise<NapPushRecommendation | null> {
  await verifyChildAccess(userId, childId);

  const transition = await prisma.scheduleTransition.findFirst({
    where: {
      childId,
      completedAt: null,
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!transition) {
    return null;
  }

  const readinessIndicators: string[] = [];

  // Get recent sessions to analyze
  const recentSessions = await prisma.sleepSession.findMany({
    where: {
      childId,
      sessionType: 'NAP',
      state: 'COMPLETED',
      createdAt: {
        gte: addDays(new Date(), -7),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Analyze nap quality
  let goodNapCount = 0;
  let totalNaps = recentSessions.length;
  let avgNapLength = 0;

  for (const session of recentSessions) {
    if (session.sleepMinutes && session.sleepMinutes >= 90) {
      goodNapCount++;
    }
    avgNapLength += session.sleepMinutes ?? 0;
  }

  avgNapLength = totalNaps > 0 ? avgNapLength / totalNaps : 0;

  if (goodNapCount >= 3 && totalNaps >= 5) {
    readinessIndicators.push('Good nap lengths (90+ min) consistently');
  }

  if (avgNapLength >= 90) {
    readinessIndicators.push(`Average nap length: ${Math.round(avgNapLength)} minutes`);
  }

  // Check days since last push (approximated by checking update date)
  const daysSinceLastPush = differenceInDays(new Date(), transition.updatedAt);

  if (daysSinceLastPush >= config.week2_plus.pushIntervalDays.min) {
    readinessIndicators.push(`${daysSinceLastPush} days since last schedule change`);
  }

  // Calculate current and suggested times
  const currentMinutes = parseTimeToMinutes(transition.currentNapTime);
  const goalMinutes = parseTimeToMinutes(config.goal.targetNapStart);

  // Determine if we should push
  const currentWeek = Math.ceil(differenceInDays(new Date(), transition.startedAt) / 7) || 1;
  const targetWeeks = transition.targetWeeks ?? 6;
  const isFastTracked = targetWeeks <= 4;
  const minPushInterval = isFastTracked
    ? config.fastTrack.fastPushIntervalDays
    : config.week2_plus.pushIntervalDays.min;

  let shouldPush = false;
  let reason = '';
  let suggestedNewTime: string | null = null;

  if (currentWeek <= 2 && !isFastTracked) {
    shouldPush = false;
    reason = 'Still in first 2 weeks of transition - maintain current schedule';
  } else if (currentWeek <= 2 && isFastTracked) {
    // Fast-track mode: Can potentially push earlier if baby shows readiness
    const fastTrackMinutes = parseTimeToMinutes(config.fastTrack.fastTrackStartTime);
    if (currentMinutes < fastTrackMinutes && goodNapCount >= 2) {
      shouldPush = true;
      suggestedNewTime = config.fastTrack.fastTrackStartTime;
      reason = 'Fast-track: Baby showing good temperament - can try pushing to 12pm';
      readinessIndicators.push('Fast-track mode enabled');
    } else if (currentMinutes >= fastTrackMinutes) {
      // Already at 12pm, check if ready to push to 12:15/12:30
      if (daysSinceLastPush >= minPushInterval && goodNapCount >= 2) {
        shouldPush = true;
        const newMinutes = Math.min(currentMinutes + config.week2_plus.pushAmount, goalMinutes);
        suggestedNewTime = minutesToTimeString(newMinutes);
        reason = 'Fast-track: Doing well at current time, ready to push later';
      } else {
        shouldPush = false;
        reason = `Fast-track: Wait ${minPushInterval} days at current time before pushing (${daysSinceLastPush} days so far)`;
      }
    } else {
      shouldPush = false;
      reason = 'Check baby\'s temperament at 11:30am - if good, can try pushing to 12pm';
    }
  } else if (currentMinutes >= goalMinutes) {
    shouldPush = false;
    reason = 'Nap time has reached goal - consider completing transition';
  } else if (daysSinceLastPush < minPushInterval) {
    shouldPush = false;
    reason = `Wait at least ${minPushInterval} days between pushes (${daysSinceLastPush} days so far)`;
  } else if (goodNapCount < 3 || totalNaps < 5) {
    shouldPush = false;
    reason = isFastTracked
      ? 'Wait for a few more good naps before pushing - some adjustment is normal'
      : 'Wait for more consistent good naps before pushing later';
  } else {
    shouldPush = true;
    const newMinutes = Math.min(currentMinutes + config.week2_plus.pushAmount, goalMinutes);
    suggestedNewTime = minutesToTimeString(newMinutes);
    reason = isFastTracked
      ? 'Fast-track: Baby adapting well - ready to push nap time later'
      : 'Baby showing good signs of readiness';
  }

  return {
    shouldPush,
    currentNapTime: transition.currentNapTime,
    suggestedNewTime,
    reason,
    daysSinceLastPush,
    readinessIndicators,
  };
}

// Get default transition schedule for starting a new transition
export function getDefaultTransitionSchedule(
  currentScheduleType: ScheduleType,
  wakeTimeEarliest: string = '06:30'
): {
  type: ScheduleType;
  wakeWindow1Min: number;
  wakeWindow1Max: number;
  wakeWindow2Min: number;
  wakeWindow2Max: number;
  nap1Earliest: string;
  nap1LatestStart: string;
  nap1MaxDuration: number;
  nap1EndBy: string;
  bedtimeEarliest: string;
  bedtimeLatest: string;
  bedtimeGoalStart: string;
  bedtimeGoalEnd: string;
  daySleepCap: number;
  wakeTimeEarliest: string;
  wakeTimeLatest: string;
} {
  // Default 2-to-1 transition schedule based on sleep training guidelines
  return {
    type: ScheduleType.TRANSITION,
    wakeWindow1Min: 300, // 5 hours to single nap
    wakeWindow1Max: 330, // 5.5 hours max
    wakeWindow2Min: 240, // 4 hours from nap to bedtime
    wakeWindow2Max: 300, // 5 hours max
    nap1Earliest: '11:30', // Week 1-2 earliest
    nap1LatestStart: '13:00',
    nap1MaxDuration: 150, // 2.5 hours
    nap1EndBy: '15:00',
    bedtimeEarliest: '18:45',
    bedtimeLatest: '19:30',
    bedtimeGoalStart: '19:00',
    bedtimeGoalEnd: '19:30',
    daySleepCap: 150, // 2.5 hours during transition
    wakeTimeEarliest,
    wakeTimeLatest: '08:00', // Temporary allowance during transition
  };
}

// Calculate crib 90 compliance
export async function checkCrib90Compliance(
  userId: string,
  childId: string,
  sessionId: string
): Promise<{
  compliant: boolean;
  minutesInCrib: number;
  requiredMinutes: number;
  recommendation: string;
}> {
  await verifyChildAccess(userId, childId);

  const session = await prisma.sleepSession.findFirst({
    where: {
      id: sessionId,
      childId,
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const requiredMinutes = DEFAULT_TRANSITION_CONFIG.week1_2.cribRule;
  let minutesInCrib = 0;
  let recommendation = '';

  if (session.putDownAt && session.outOfCribAt) {
    minutesInCrib = Math.round(
      (session.outOfCribAt.getTime() - session.putDownAt.getTime()) / 60000
    );
  } else if (session.putDownAt) {
    // Session still in progress
    minutesInCrib = Math.round(
      (new Date().getTime() - session.putDownAt.getTime()) / 60000
    );
  }

  const compliant = minutesInCrib >= requiredMinutes;

  if (compliant) {
    recommendation = 'Crib 90 rule met!';
  } else {
    const remaining = requiredMinutes - minutesInCrib;
    recommendation = `Keep in crib for ${remaining} more minutes to meet crib 90 rule`;
  }

  return {
    compliant,
    minutesInCrib,
    requiredMinutes,
    recommendation,
  };
}

export { DEFAULT_TRANSITION_CONFIG };
