import { addMinutes, setHours, setMinutes, isAfter, isBefore, differenceInMinutes, format, parse, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { SleepScheduleResponse, TransitionResponse } from '../schemas/schedule.schema.js';
import { ScheduleType } from '../types/enums.js';

// Types for calculator results
export interface TimeWindow {
  earliest: Date;
  latest: Date;
  recommended: Date;
}

export interface NapRecommendation {
  napNumber: number;
  putDownWindow: TimeWindow;
  maxDuration: number;
  endBy: Date | null;
  notes: string[];
}

export interface BedtimeRecommendation {
  putDownWindow: TimeWindow;
  notes: string[];
}

export interface DayScheduleRecommendation {
  date: string;
  wakeTime: Date;
  naps: NapRecommendation[];
  bedtime: BedtimeRecommendation;
  totalDaySleepCap: number;
  warnings: string[];
}

export interface NextActionRecommendation {
  action: 'NAP' | 'BEDTIME' | 'WAIT';
  description: string;
  timeWindow: TimeWindow | null;
  napNumber?: number;
  minutesUntilEarliest?: number;
  notes: string[];
}

export interface TodayRecommendation {
  // Current status
  wakeTime: Date | null;
  currentState: 'awake' | 'asleep' | 'pending';
  completedNaps: number;

  // Today's nap summary
  naps: {
    napNumber: number;
    duration: number | null;
    asleepAt: Date | null;
    wokeUpAt: Date | null;
    status: 'completed' | 'in_progress' | 'upcoming';
  }[];
  totalNapMinutes: number;
  napGoalMinutes: number; // 60 min per nap for 2-nap, 90 min for 1-nap

  // Bedtime recommendation
  recommendedBedtime: Date;
  bedtimeWindow: TimeWindow;
  bedtimeNotes: string[];

  // Sleep debt info
  sleepDebtMinutes: number;
  sleepDebtNote: string | null;

  // Schedule info
  scheduleType: string;
  isOnOneNapSchedule: boolean;
}

// Helper functions
function parseTimeString(time: string, baseDate: Date, timezone: string): Date {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const zonedDate = toZonedTime(baseDate, timezone);
  const result = setMinutes(setHours(startOfDay(zonedDate), hours), minutes);
  return fromZonedTime(result, timezone);
}

function formatTimeForDisplay(date: Date, timezone: string): string {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, 'HH:mm');
}

function clampToWindow(time: Date, earliest: Date, latest: Date): Date {
  if (isBefore(time, earliest)) return earliest;
  if (isAfter(time, latest)) return latest;
  return time;
}

function averageTime(time1: Date, time2: Date): Date {
  const diff = differenceInMinutes(time2, time1);
  return addMinutes(time1, Math.round(diff / 2));
}

// Calculate nap 1 for 2-nap schedule
function calculateNap1TwoNap(
  wakeTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  baseDate: Date
): NapRecommendation {
  const notes: string[] = [];

  // Calculate based on wake window
  const earliestByWakeWindow = addMinutes(wakeTime, schedule.wakeWindow1Min);
  const latestByWakeWindow = addMinutes(wakeTime, schedule.wakeWindow1Max);

  // Apply schedule constraints
  let earliest = earliestByWakeWindow;
  let latest = latestByWakeWindow;

  if (schedule.nap1Earliest) {
    const nap1EarliestTime = parseTimeString(schedule.nap1Earliest, baseDate, timezone);
    if (isAfter(nap1EarliestTime, earliest)) {
      earliest = nap1EarliestTime;
      notes.push(`Nap 1 held until ${schedule.nap1Earliest} per schedule`);
    }
  }

  if (schedule.nap1LatestStart) {
    const nap1LatestTime = parseTimeString(schedule.nap1LatestStart, baseDate, timezone);
    if (isBefore(nap1LatestTime, latest)) {
      latest = nap1LatestTime;
    }
  }

  // Ensure earliest is not after latest
  if (isAfter(earliest, latest)) {
    latest = earliest;
    notes.push('Wake window extended - late wake time');
  }

  const recommended = averageTime(earliest, latest);

  // Calculate end by time
  let endBy: Date | null = null;
  if (schedule.nap1EndBy) {
    endBy = parseTimeString(schedule.nap1EndBy, baseDate, timezone);
  }

  return {
    napNumber: 1,
    putDownWindow: { earliest, latest, recommended },
    maxDuration: schedule.nap1MaxDuration ?? 120,
    endBy,
    notes,
  };
}

/**
 * Calculate nap 2 timing based on consultant's rules:
 *
 * Rough nap guide for timing between naps:
 * - If nap 1 skipped/protested completely: next nap 12:15/12:30pm
 * - If nap 1 is 30-45 mins (rest + 1 sleep cycle): next nap 12:30/12:45pm
 * - If nap 1 is 1 hr+ (rest + sleep): next nap 12:45/1pm
 */
function calculateNap2TwoNap(
  nap1EndTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  baseDate: Date,
  nap1WasShort: boolean,
  nap1Duration?: number
): NapRecommendation {
  const notes: string[] = [];

  // Calculate based on wake window 2
  const ww2Min = schedule.wakeWindow2Min ?? 150; // Default 2.5 hours
  const ww2Max = schedule.wakeWindow2Max ?? 210; // Default 3.5 hours

  let earliestByWakeWindow = addMinutes(nap1EndTime, ww2Min);
  let latestByWakeWindow = addMinutes(nap1EndTime, ww2Max);

  // Apply consultant's nap timing rules based on nap 1 outcome
  let recommended: Date;
  if (nap1Duration !== undefined) {
    if (nap1Duration === 0) {
      // Nap 1 skipped/protested: next nap 12:15/12:30pm
      recommended = parseTimeString('12:22', baseDate, timezone); // 12:22pm (middle)
      notes.push('Nap 1 skipped - earlier nap 2 timing');
    } else if (nap1Duration < 60) {
      // Nap 1 was 30-45 mins: next nap 12:30/12:45pm
      recommended = parseTimeString('12:37', baseDate, timezone); // 12:37pm (middle)
      notes.push(`Short nap 1 (${nap1Duration}m) - slightly earlier nap 2`);
    } else {
      // Nap 1 was 1 hr+: next nap 12:45/1pm
      recommended = parseTimeString('12:52', baseDate, timezone); // 12:52pm (middle)
      notes.push('Good nap 1 - standard nap 2 timing');
    }

    // Adjust earliest/latest based on consultant guidance
    if (nap1Duration === 0) {
      earliestByWakeWindow = parseTimeString('12:15', baseDate, timezone);
      latestByWakeWindow = parseTimeString('12:30', baseDate, timezone);
    } else if (nap1Duration < 60) {
      earliestByWakeWindow = parseTimeString('12:30', baseDate, timezone);
      latestByWakeWindow = parseTimeString('12:45', baseDate, timezone);
    } else {
      earliestByWakeWindow = parseTimeString('12:45', baseDate, timezone);
      latestByWakeWindow = parseTimeString('13:00', baseDate, timezone);
    }
  } else {
    // No nap 1 data yet - use standard wake window calculation
    recommended = averageTime(earliestByWakeWindow, latestByWakeWindow);
  }

  // Apply schedule constraints
  let earliest = earliestByWakeWindow;
  let latest = latestByWakeWindow;

  if (schedule.nap2Earliest) {
    const nap2EarliestTime = parseTimeString(schedule.nap2Earliest, baseDate, timezone);
    if (isAfter(nap2EarliestTime, earliest)) {
      earliest = nap2EarliestTime;
      notes.push(`Nap 2 held until ${schedule.nap2Earliest} per schedule`);
    }
  }

  if (schedule.nap2LatestStart) {
    const nap2LatestTime = parseTimeString(schedule.nap2LatestStart, baseDate, timezone);
    if (isBefore(nap2LatestTime, latest)) {
      latest = nap2LatestTime;
    }
  }

  // Ensure earliest is not after latest
  if (isAfter(earliest, latest)) {
    latest = earliest;
    notes.push('Wake window extended - nap timing compressed');
  }

  // Clamp recommended to window
  recommended = clampToWindow(recommended, earliest, latest);

  // Calculate end by time
  let endBy: Date | null = null;
  if (schedule.nap2EndBy) {
    endBy = parseTimeString(schedule.nap2EndBy, baseDate, timezone);
  }

  // Determine max duration (exception if nap 1 was short)
  let maxDuration = schedule.nap2MaxDuration ?? 120;
  if (nap1WasShort && schedule.nap2ExceptionDuration) {
    maxDuration = schedule.nap2ExceptionDuration;
    notes.push('Extended nap 2 allowed due to short nap 1');
  }

  return {
    napNumber: 2,
    putDownWindow: { earliest, latest, recommended },
    maxDuration,
    endBy,
    notes,
  };
}

// Calculate single nap for 1-nap schedule
function calculateSingleNap(
  wakeTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  baseDate: Date,
  transition?: TransitionResponse | null
): NapRecommendation {
  const notes: string[] = [];

  // For single nap, use wake window 1 (typically 5-5.5 hours)
  const earliestByWakeWindow = addMinutes(wakeTime, schedule.wakeWindow1Min);
  const latestByWakeWindow = addMinutes(wakeTime, schedule.wakeWindow1Max);

  // Apply schedule constraints
  let earliest = earliestByWakeWindow;
  let latest = latestByWakeWindow;

  // For transitions, use the current nap time from transition record
  if (transition && !transition.completedAt) {
    const targetNapTime = parseTimeString(transition.currentNapTime, baseDate, timezone);
    // During transition, try to hit the target time
    earliest = addMinutes(targetNapTime, -15); // Allow 15 min early
    latest = addMinutes(targetNapTime, 15);    // Allow 15 min late
    notes.push(`Transition week ${transition.currentWeek}: targeting ${transition.currentNapTime}`);
  } else if (schedule.nap1Earliest) {
    const nap1EarliestTime = parseTimeString(schedule.nap1Earliest, baseDate, timezone);
    if (isAfter(nap1EarliestTime, earliest)) {
      earliest = nap1EarliestTime;
      notes.push(`Nap held until ${schedule.nap1Earliest} per schedule`);
    }
  }

  if (schedule.nap1LatestStart) {
    const nap1LatestTime = parseTimeString(schedule.nap1LatestStart, baseDate, timezone);
    if (isBefore(nap1LatestTime, latest)) {
      latest = nap1LatestTime;
    }
  }

  // Ensure earliest is not after latest
  if (isAfter(earliest, latest)) {
    latest = earliest;
  }

  const recommended = averageTime(earliest, latest);

  // Calculate end by time
  let endBy: Date | null = null;
  if (schedule.nap1EndBy) {
    endBy = parseTimeString(schedule.nap1EndBy, baseDate, timezone);
  }

  return {
    napNumber: 1,
    putDownWindow: { earliest, latest, recommended },
    maxDuration: schedule.nap1MaxDuration ?? 180, // Single nap typically longer
    endBy,
    notes,
  };
}

/**
 * Calculate bedtime based on consultant's rules:
 *
 * For 2-nap schedule:
 * - Baseline: 6:30/7pm when naps 1&2 meet 1-hour goal
 * - If naps exceed goal and nap 2 ends 2:30pm+: 6:45/7pm
 * - If naps short of 1-hour goal: subtract shortfall from baseline
 * - Gap from nap 2 to bedtime: 4-4.5 hours (never later than 7:30pm)
 *
 * For 1-nap schedule:
 * - 2+ hour nap starting 12:30/1pm: 7:15/7:30pm
 * - ~1.5 hour nap: 7/7:15pm
 * - ~1 hour nap: 6:45/7pm
 * - 30-45 min nap: 6:15-6:45pm
 * - Repurpose lost sleep: if nap < 90 min, deduct from 7:15/7:30pm
 */
function calculateBedtime(
  lastNapEndTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  baseDate: Date,
  totalNapMinutes: number,
  expectedNapMinutes: number,
  scheduleType?: ScheduleType,
  napDurations?: number[]
): BedtimeRecommendation {
  const notes: string[] = [];

  // Get schedule type
  const type = scheduleType ?? (schedule.type as ScheduleType);

  // Get wake window for bedtime (4-4.5 hours is the consultant's recommendation)
  const wwMin = schedule.wakeWindow3Min ?? schedule.wakeWindow2Min ?? 240; // 4 hours
  const wwMax = schedule.wakeWindow3Max ?? schedule.wakeWindow2Max ?? 270; // 4.5 hours

  const earliestByWakeWindow = addMinutes(lastNapEndTime, wwMin);
  const latestByWakeWindow = addMinutes(lastNapEndTime, wwMax);

  // Get schedule constraints
  const bedtimeEarliest = parseTimeString(schedule.bedtimeEarliest, baseDate, timezone);
  const bedtimeLatest = parseTimeString(schedule.bedtimeLatest, baseDate, timezone);

  // Calculate recommended bedtime based on consultant's rules
  let recommended: Date;

  if (type === ScheduleType.ONE_NAP || type === ScheduleType.TRANSITION) {
    // 1-nap schedule bedtime calculation
    const napDuration = napDurations?.[0] ?? totalNapMinutes;
    const baselineBedtime = parseTimeString('19:15', baseDate, timezone); // 7:15pm baseline

    if (napDuration >= 120) {
      // 2+ hour nap: 7:15/7:30pm
      recommended = parseTimeString('19:22', baseDate, timezone); // 7:22pm (middle of 7:15-7:30)
      notes.push('Great nap (2+ hrs)! Standard bedtime');
    } else if (napDuration >= 90) {
      // ~1.5 hour nap: 7/7:15pm
      recommended = parseTimeString('19:07', baseDate, timezone); // 7:07pm
      notes.push('Good nap (90+ min), slightly earlier bedtime');
    } else if (napDuration >= 60) {
      // ~1 hour nap: 6:45/7pm
      recommended = parseTimeString('18:52', baseDate, timezone); // 6:52pm
      const sleepDebt = 90 - napDuration;
      notes.push(`1-hour nap: ${sleepDebt} min sleep debt, earlier bedtime`);
    } else if (napDuration >= 30) {
      // 30-45 min nap: 6:15-6:45pm
      const sleepDebt = 90 - napDuration;
      recommended = addMinutes(baselineBedtime, -sleepDebt);
      notes.push(`Short nap (${napDuration}m): ${sleepDebt} min sleep debt`);
    } else if (napDuration > 0) {
      // Very short nap: earliest reasonable bedtime
      recommended = parseTimeString('18:15', baseDate, timezone);
      notes.push('Very short nap - early bedtime to catch up');
    } else {
      // No nap data yet - use goal or baseline
      if (schedule.bedtimeGoalStart) {
        recommended = parseTimeString(schedule.bedtimeGoalStart, baseDate, timezone);
      } else {
        recommended = baselineBedtime;
      }
    }

  } else if (type === ScheduleType.TWO_NAP) {
    // 2-nap schedule bedtime calculation
    const nap1Duration = napDurations?.[0] ?? 0;
    // Check if nap 2 data exists (not just undefined but actually provided)
    const hasNap2Data = napDurations !== undefined && napDurations.length >= 2;
    const nap2Duration = hasNap2Data ? (napDurations[1] ?? 0) : 0;
    const nap1Goal = 60; // 1 hour goal per nap
    const nap2Goal = 60;
    const baselineBedtime = parseTimeString('18:45', baseDate, timezone); // 6:45pm baseline (conservative)

    // Check if nap 2 ended after 2:30pm
    const nap2EndedAfter230 = hasNap2Data && isAfter(lastNapEndTime, parseTimeString('14:30', baseDate, timezone));

    // Calculate shortfall from 1-hour goal for each nap
    const nap1Shortfall = Math.max(0, nap1Goal - nap1Duration);
    // Only count nap 2 shortfall if nap 2 actually happened
    const nap2Shortfall = hasNap2Data ? Math.max(0, nap2Goal - nap2Duration) : 0;

    // If nap 1 completed but nap 2 hasn't happened yet, we need to show estimated bedtime
    // based on nap 1's debt. Don't assume nap 2 will make up for it.
    const hasNap1Data = napDurations !== undefined && napDurations.length >= 1;

    if (!hasNap1Data) {
      // No nap data yet - use goal or baseline
      if (schedule.bedtimeGoalStart) {
        recommended = parseTimeString(schedule.bedtimeGoalStart, baseDate, timezone);
      } else {
        recommended = baselineBedtime;
      }
    } else if (!hasNap2Data) {
      // Nap 1 completed but nap 2 hasn't happened yet
      // Calculate CURRENT debt from nap 1, and show what bedtime would be if nap 2 meets its goal
      // This gives a realistic "best case" estimate
      const currentDebt = nap1Shortfall;
      if (currentDebt > 0) {
        // Show early bedtime estimate based on current nap 1 debt
        // Assuming nap 2 will meet its 60-minute goal
        recommended = addMinutes(baselineBedtime, -currentDebt);
        notes.push(`Nap 1 debt: ${currentDebt} min - early bedtime (assuming nap 2 meets goal)`);
      } else {
        // Nap 1 met/exceeded goal, bedtime depends on when nap 2 ends
        recommended = baselineBedtime;
        notes.push('Good nap 1! Bedtime depends on nap 2');
      }
    } else if (nap1Shortfall + nap2Shortfall === 0 && nap2EndedAfter230) {
      // Both naps met/exceeded goal AND nap 2 ended after 2:30pm
      recommended = parseTimeString('18:52', baseDate, timezone); // 6:52pm
      notes.push('Great naps! Standard bedtime (6:45-7pm)');
    } else if (nap1Shortfall + nap2Shortfall === 0) {
      // Both naps met goal but nap 2 ended early
      recommended = parseTimeString('18:30', baseDate, timezone); // 6:30pm
      notes.push('Good naps, early end - slightly earlier bedtime');
    } else {
      // Subtract total shortfall from baseline
      const totalShortfall = nap1Shortfall + nap2Shortfall;
      recommended = addMinutes(baselineBedtime, -totalShortfall);
      if (totalShortfall > 0) {
        notes.push(`${totalShortfall} min nap shortfall - earlier bedtime`);
      }
    }

    // Ensure wake window constraint (4-4.5 hours from nap 2 end, max 7:30pm)
    // Only apply this if nap 2 has actually completed
    if (hasNap2Data) {
      const minBedtimeByWakeWindow = addMinutes(lastNapEndTime, wwMin);
      if (isAfter(minBedtimeByWakeWindow, recommended)) {
        recommended = minBedtimeByWakeWindow;
        notes.push('Adjusted for minimum 4hr wake window');
      }
    }

  } else {
    // Default calculation for other schedule types
    if (schedule.bedtimeGoalStart && schedule.bedtimeGoalEnd) {
      const goalStart = parseTimeString(schedule.bedtimeGoalStart, baseDate, timezone);
      const goalEnd = parseTimeString(schedule.bedtimeGoalEnd, baseDate, timezone);
      recommended = averageTime(goalStart, goalEnd);
    } else {
      recommended = averageTime(earliestByWakeWindow, latestByWakeWindow);
    }
  }

  // Clamp recommended to schedule bounds first
  if (isBefore(recommended, bedtimeEarliest)) {
    recommended = bedtimeEarliest;
    notes.push(`Held to earliest bedtime ${schedule.bedtimeEarliest}`);
  }
  if (isAfter(recommended, bedtimeLatest)) {
    recommended = bedtimeLatest;
    notes.push(`Capped at latest bedtime ${schedule.bedtimeLatest}`);
  }

  // Create a tight 15-minute window centered on recommended time
  // This matches consultant guidance for precise bedtime targets
  const WINDOW_HALF_WIDTH = 7; // 7 minutes each side = 14 min window (rounds to ~15)
  let earliest = addMinutes(recommended, -WINDOW_HALF_WIDTH);
  let latest = addMinutes(recommended, WINDOW_HALF_WIDTH);

  // Apply schedule bounds to the window
  if (isBefore(earliest, bedtimeEarliest)) {
    earliest = bedtimeEarliest;
  }
  if (isAfter(latest, bedtimeLatest)) {
    latest = bedtimeLatest;
  }

  // Ensure earliest is not after latest
  if (isAfter(earliest, latest)) {
    latest = earliest;
  }

  return {
    putDownWindow: { earliest, latest, recommended },
    notes,
  };
}

// Main function to calculate full day schedule
export function calculateDaySchedule(
  wakeTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  transition?: TransitionResponse | null,
  actualNapDurations?: number[] // Actual nap durations if naps already happened
): DayScheduleRecommendation {
  const baseDate = wakeTime;
  const warnings: string[] = [];
  const naps: NapRecommendation[] = [];

  const scheduleType = schedule.type as ScheduleType;

  if (scheduleType === ScheduleType.TWO_NAP) {
    // Calculate 2-nap schedule
    const nap1 = calculateNap1TwoNap(wakeTime, schedule, timezone, baseDate);
    naps.push(nap1);

    // Estimate nap 1 end time (use actual if provided, otherwise max duration)
    const nap1Duration = actualNapDurations?.[0] ?? nap1.maxDuration;
    const nap1EndEstimate = addMinutes(nap1.putDownWindow.recommended, nap1Duration);
    const nap1WasShort = nap1Duration < 60;

    // Pass nap1Duration to get consultant's timing recommendations
    const nap2 = calculateNap2TwoNap(
      nap1EndEstimate,
      schedule,
      timezone,
      baseDate,
      nap1WasShort,
      actualNapDurations?.[0] // Only pass if we have actual data
    );
    naps.push(nap2);

    // Estimate nap 2 end time
    const nap2Duration = actualNapDurations?.[1] ?? nap2.maxDuration;
    const nap2EndEstimate = addMinutes(nap2.putDownWindow.recommended, nap2Duration);

    // Check day sleep cap
    const totalExpectedNap = nap1Duration + nap2Duration;
    if (totalExpectedNap > schedule.daySleepCap) {
      warnings.push(`Day sleep may exceed ${schedule.daySleepCap} min cap`);
    }

    // Calculate bedtime with consultant's logic
    const expectedNapMinutes = schedule.daySleepCap;
    const actualNapMinutes = (actualNapDurations?.[0] ?? 0) + (actualNapDurations?.[1] ?? 0);
    const bedtime = calculateBedtime(
      nap2EndEstimate,
      schedule,
      timezone,
      baseDate,
      actualNapMinutes,
      expectedNapMinutes,
      ScheduleType.TWO_NAP,
      actualNapDurations
    );

    return {
      date: format(wakeTime, 'yyyy-MM-dd'),
      wakeTime,
      naps,
      bedtime,
      totalDaySleepCap: schedule.daySleepCap,
      warnings: [...warnings, ...nap1.notes, ...nap2.notes, ...bedtime.notes],
    };

  } else if (scheduleType === ScheduleType.ONE_NAP || scheduleType === ScheduleType.TRANSITION) {
    // Calculate 1-nap schedule (or transition)
    const nap1 = calculateSingleNap(wakeTime, schedule, timezone, baseDate, transition);
    naps.push(nap1);

    // Estimate nap end time
    const napDuration = actualNapDurations?.[0] ?? nap1.maxDuration;
    const napEndEstimate = addMinutes(nap1.putDownWindow.recommended, napDuration);

    // Calculate bedtime with consultant's logic
    const expectedNapMinutes = schedule.daySleepCap;
    const actualNapMinutes = actualNapDurations?.[0] ?? 0;
    const bedtime = calculateBedtime(
      napEndEstimate,
      schedule,
      timezone,
      baseDate,
      actualNapMinutes,
      expectedNapMinutes,
      scheduleType,
      actualNapDurations
    );

    return {
      date: format(wakeTime, 'yyyy-MM-dd'),
      wakeTime,
      naps,
      bedtime,
      totalDaySleepCap: schedule.daySleepCap,
      warnings: [...warnings, ...nap1.notes, ...bedtime.notes],
    };

  } else if (scheduleType === ScheduleType.THREE_NAP) {
    // TODO: Implement 3-nap schedule if needed
    warnings.push('3-nap schedule calculation not yet implemented');

    // Return a basic recommendation
    const nap1 = calculateNap1TwoNap(wakeTime, schedule, timezone, baseDate);
    naps.push(nap1);

    return {
      date: format(wakeTime, 'yyyy-MM-dd'),
      wakeTime,
      naps,
      bedtime: {
        putDownWindow: {
          earliest: parseTimeString(schedule.bedtimeEarliest, baseDate, timezone),
          latest: parseTimeString(schedule.bedtimeLatest, baseDate, timezone),
          recommended: parseTimeString(schedule.bedtimeGoalStart ?? schedule.bedtimeEarliest, baseDate, timezone),
        },
        notes: [],
      },
      totalDaySleepCap: schedule.daySleepCap,
      warnings,
    };
  }

  throw new Error(`Unknown schedule type: ${scheduleType}`);
}

// Calculate what the user should do next
export function calculateNextAction(
  currentTime: Date,
  daySchedule: DayScheduleRecommendation,
  completedNaps: number,
  currentlyAsleep: boolean,
  timezone: string
): NextActionRecommendation {
  const notes: string[] = [];

  // If child is currently asleep, recommend waiting
  if (currentlyAsleep) {
    return {
      action: 'WAIT',
      description: 'Child is currently sleeping',
      timeWindow: null,
      notes: ['Monitor for wake signs'],
    };
  }

  // Find the next nap that hasn't been completed
  const nextNap = daySchedule.naps.find(nap => nap.napNumber > completedNaps);

  if (nextNap) {
    const minutesUntilEarliest = differenceInMinutes(nextNap.putDownWindow.earliest, currentTime);

    if (minutesUntilEarliest > 30) {
      // Not time for nap yet
      return {
        action: 'WAIT',
        description: `Nap ${nextNap.napNumber} in ${minutesUntilEarliest} minutes`,
        timeWindow: nextNap.putDownWindow,
        napNumber: nextNap.napNumber,
        minutesUntilEarliest,
        notes: nextNap.notes, // Use nap calculation notes, not redundant target time
      };
    }

    // Within nap window
    return {
      action: 'NAP',
      description: `Time for nap ${nextNap.napNumber}`,
      timeWindow: nextNap.putDownWindow,
      napNumber: nextNap.napNumber,
      minutesUntilEarliest: Math.max(0, minutesUntilEarliest),
      notes: nextNap.notes,
    };
  }

  // All naps done, check bedtime
  const { bedtime } = daySchedule;
  const minutesUntilBedtime = differenceInMinutes(bedtime.putDownWindow.earliest, currentTime);

  if (minutesUntilBedtime > 30) {
    return {
      action: 'WAIT',
      description: `Bedtime in ${minutesUntilBedtime} minutes`,
      timeWindow: bedtime.putDownWindow,
      minutesUntilEarliest: minutesUntilBedtime,
      notes: bedtime.notes, // Use bedtime calculation notes, not redundant target time
    };
  }

  // Within bedtime window
  return {
    action: 'BEDTIME',
    description: 'Time for bedtime',
    timeWindow: bedtime.putDownWindow,
    minutesUntilEarliest: Math.max(0, minutesUntilBedtime),
    notes: bedtime.notes,
  };
}

// Calculate bedtime given actual nap data
export function calculateAdjustedBedtime(
  wakeTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  actualNaps: { asleepAt: Date; wokeUpAt: Date }[]
): BedtimeRecommendation {
  // Calculate total actual nap time and individual durations
  const napDurations: number[] = [];
  let totalNapMinutes = 0;
  let lastNapEndTime: Date = wakeTime;

  for (const nap of actualNaps) {
    const napMinutes = differenceInMinutes(nap.wokeUpAt, nap.asleepAt);
    napDurations.push(napMinutes);
    totalNapMinutes += napMinutes;
    if (isAfter(nap.wokeUpAt, lastNapEndTime)) {
      lastNapEndTime = nap.wokeUpAt;
    }
  }

  // Determine schedule type from schedule configuration
  const scheduleType = schedule.type as ScheduleType;

  return calculateBedtime(
    lastNapEndTime,
    schedule,
    timezone,
    wakeTime,
    totalNapMinutes,
    schedule.daySleepCap,
    scheduleType,
    napDurations
  );
}

// Export helper for formatting times
export { formatTimeForDisplay };
