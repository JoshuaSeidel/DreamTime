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

// Calculate nap 2 for 2-nap schedule
function calculateNap2TwoNap(
  nap1EndTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  baseDate: Date,
  nap1WasShort: boolean
): NapRecommendation {
  const notes: string[] = [];

  // Calculate based on wake window 2
  const ww2Min = schedule.wakeWindow2Min ?? 150; // Default 2.5 hours
  const ww2Max = schedule.wakeWindow2Max ?? 210; // Default 3.5 hours

  const earliestByWakeWindow = addMinutes(nap1EndTime, ww2Min);
  const latestByWakeWindow = addMinutes(nap1EndTime, ww2Max);

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

  const recommended = averageTime(earliest, latest);

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

// Calculate bedtime based on last nap end
function calculateBedtime(
  lastNapEndTime: Date,
  schedule: SleepScheduleResponse,
  timezone: string,
  baseDate: Date,
  totalNapMinutes: number,
  expectedNapMinutes: number
): BedtimeRecommendation {
  const notes: string[] = [];

  // Get wake window for bedtime (wake window 3 for 2-nap, wake window 2 for 1-nap)
  const wwMin = schedule.wakeWindow3Min ?? schedule.wakeWindow2Min ?? 210; // Default 3.5 hours
  const wwMax = schedule.wakeWindow3Max ?? schedule.wakeWindow2Max ?? 270; // Default 4.5 hours

  const earliestByWakeWindow = addMinutes(lastNapEndTime, wwMin);
  const latestByWakeWindow = addMinutes(lastNapEndTime, wwMax);

  // Apply schedule constraints
  let earliest = earliestByWakeWindow;
  let latest = latestByWakeWindow;

  const bedtimeEarliest = parseTimeString(schedule.bedtimeEarliest, baseDate, timezone);
  const bedtimeLatest = parseTimeString(schedule.bedtimeLatest, baseDate, timezone);

  // Clamp to schedule bedtime window
  if (isBefore(earliest, bedtimeEarliest)) {
    earliest = bedtimeEarliest;
    notes.push(`Bedtime held until ${schedule.bedtimeEarliest} per schedule`);
  }

  if (isAfter(latest, bedtimeLatest)) {
    latest = bedtimeLatest;
    notes.push(`Bedtime capped at ${schedule.bedtimeLatest} per schedule`);
  }

  // Calculate sleep debt adjustment
  const napShortfall = expectedNapMinutes - totalNapMinutes;
  if (napShortfall > 30) {
    // Move bedtime earlier for sleep debt
    const adjustment = Math.min(napShortfall, 60); // Max 1 hour earlier
    earliest = addMinutes(earliest, -adjustment);

    // But don't go earlier than schedule allows
    if (isBefore(earliest, bedtimeEarliest)) {
      earliest = bedtimeEarliest;
    }

    notes.push(`Earlier bedtime recommended due to ${napShortfall} min sleep debt`);
  }

  // Ensure earliest is not after latest
  if (isAfter(earliest, latest)) {
    latest = earliest;
  }

  // Use goal bedtime if available, otherwise calculate recommended
  let recommended: Date;
  if (schedule.bedtimeGoalStart && schedule.bedtimeGoalEnd) {
    const goalStart = parseTimeString(schedule.bedtimeGoalStart, baseDate, timezone);
    const goalEnd = parseTimeString(schedule.bedtimeGoalEnd, baseDate, timezone);
    recommended = clampToWindow(averageTime(goalStart, goalEnd), earliest, latest);
  } else {
    recommended = averageTime(earliest, latest);
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

    const nap2 = calculateNap2TwoNap(nap1EndEstimate, schedule, timezone, baseDate, nap1WasShort);
    naps.push(nap2);

    // Estimate nap 2 end time
    const nap2Duration = actualNapDurations?.[1] ?? nap2.maxDuration;
    const nap2EndEstimate = addMinutes(nap2.putDownWindow.recommended, nap2Duration);

    // Check day sleep cap
    const totalExpectedNap = nap1Duration + nap2Duration;
    if (totalExpectedNap > schedule.daySleepCap) {
      warnings.push(`Day sleep may exceed ${schedule.daySleepCap} min cap`);
    }

    // Calculate bedtime
    const expectedNapMinutes = schedule.daySleepCap;
    const actualNapMinutes = (actualNapDurations?.[0] ?? 0) + (actualNapDurations?.[1] ?? 0);
    const bedtime = calculateBedtime(
      nap2EndEstimate,
      schedule,
      timezone,
      baseDate,
      actualNapMinutes,
      expectedNapMinutes
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

    // Calculate bedtime
    const expectedNapMinutes = schedule.daySleepCap;
    const actualNapMinutes = actualNapDurations?.[0] ?? 0;
    const bedtime = calculateBedtime(
      napEndEstimate,
      schedule,
      timezone,
      baseDate,
      actualNapMinutes,
      expectedNapMinutes
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
        notes: [`Target put down: ${formatTimeForDisplay(nextNap.putDownWindow.recommended, timezone)}`],
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
      notes: [`Target bedtime: ${formatTimeForDisplay(bedtime.putDownWindow.recommended, timezone)}`],
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
  // Calculate total actual nap time
  let totalNapMinutes = 0;
  let lastNapEndTime: Date = wakeTime;

  for (const nap of actualNaps) {
    const napMinutes = differenceInMinutes(nap.wokeUpAt, nap.asleepAt);
    totalNapMinutes += napMinutes;
    if (isAfter(nap.wokeUpAt, lastNapEndTime)) {
      lastNapEndTime = nap.wokeUpAt;
    }
  }

  return calculateBedtime(
    lastNapEndTime,
    schedule,
    timezone,
    wakeTime,
    totalNapMinutes,
    schedule.daySleepCap
  );
}

// Export helper for formatting times
export { formatTimeForDisplay };
