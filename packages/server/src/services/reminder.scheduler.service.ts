import { prisma } from '../config/database.js';
import { sendBedtimeReminder, sendNapReminder, sendWakeDeadlineAlert, sendNapCapExceededAlert, sendDaySleepCapWarningAlert, sendDaySleepCapExceededAlert } from './notification.service.js';
import { calculateDaySchedule } from './schedule.calculator.service.js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfDay, format, differenceInMinutes, addMinutes, isAfter, isBefore, parse } from 'date-fns';
import type { TransitionResponse } from '../schemas/schedule.schema.js';
import { ScheduleType } from '../types/enums.js';

// Track which reminders have been sent to avoid duplicates
// Key format: `${childId}-${type}-${date}` where type is 'nap1', 'nap2', 'bedtime', 'wake_deadline', 'nap_cap'
const sentReminders = new Map<string, Date>();

// Clean up old entries every hour
setInterval(() => {
  const cutoff = addMinutes(new Date(), -120); // Keep last 2 hours
  for (const [key, sentAt] of sentReminders) {
    if (isBefore(sentAt, cutoff)) {
      sentReminders.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Configuration
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
// Default values if schedule doesn't have custom settings
// Based on consultant's routine recommendations:
// - Bedtime routine: 15-20 minutes → remind 20 min before
// - Nap routine: 5-10 minutes → remind 10 min before
const DEFAULT_NAP_REMINDER_MINUTES = 10;
const DEFAULT_BEDTIME_REMINDER_MINUTES = 20;
const DEFAULT_WAKE_DEADLINE_REMINDER_MINUTES = 15;

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

type ReminderType = 'nap1_30' | 'nap1_15' | 'nap2_30' | 'nap2_15' | 'bedtime_30' | 'bedtime_15' | 'wake_deadline_30' | 'wake_deadline_15' | 'nap_cap' | 'day_sleep_cap_warning' | 'day_sleep_cap_exceeded';

/**
 * Check if we should send a reminder for a specific event
 */
function shouldSendReminder(
  childId: string,
  type: ReminderType,
  eventTime: Date,
  now: Date,
  minutesBefore: number = DEFAULT_NAP_REMINDER_MINUTES
): boolean {
  const key = `${childId}-${type}-${format(eventTime, 'yyyy-MM-dd')}`;

  // Already sent this reminder today
  if (sentReminders.has(key)) {
    return false;
  }

  // Check if we're within the reminder window
  const reminderTime = addMinutes(eventTime, -minutesBefore);
  const reminderWindowEnd = eventTime;

  // Send if current time is between reminderTime and eventTime
  return isAfter(now, reminderTime) && isBefore(now, reminderWindowEnd);
}

/**
 * Check if we should send a one-time alert (already past threshold)
 */
function shouldSendOneTimeAlert(
  childId: string,
  type: ReminderType,
  dateKey: string
): boolean {
  const key = `${childId}-${type}-${dateKey}`;
  return !sentReminders.has(key);
}

/**
 * Mark a reminder as sent
 */
function markReminderSent(childId: string, type: ReminderType, eventTime: Date): void {
  const key = `${childId}-${type}-${format(eventTime, 'yyyy-MM-dd')}`;
  sentReminders.set(key, new Date());
}

/**
 * Mark a one-time alert as sent
 */
function markOneTimeAlertSent(childId: string, type: ReminderType, dateKey: string): void {
  const key = `${childId}-${type}-${dateKey}`;
  sentReminders.set(key, new Date());
}

/**
 * Process reminders for a single child
 */
async function processChildReminders(
  childId: string,
  childName: string,
  timezone: string
): Promise<void> {
  const now = new Date();

  // Get the child's active schedule
  const schedule = await prisma.sleepSchedule.findFirst({
    where: {
      childId,
      isActive: true,
    },
  });

  if (!schedule) {
    return; // No active schedule
  }

  // Get active transition if schedule is TRANSITION type
  let transition: TransitionResponse | null = null;
  if (schedule.type === ScheduleType.TRANSITION || schedule.type === ScheduleType.ONE_NAP) {
    const activeTransition = await prisma.scheduleTransition.findFirst({
      where: {
        childId,
        completedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (activeTransition) {
      transition = {
        id: activeTransition.id,
        childId: activeTransition.childId,
        fromType: activeTransition.fromType,
        toType: activeTransition.toType,
        startedAt: activeTransition.startedAt,
        currentWeek: activeTransition.currentWeek,
        targetWeeks: activeTransition.targetWeeks ?? 6,
        currentNapTime: activeTransition.currentNapTime,
        completedAt: activeTransition.completedAt,
        notes: activeTransition.notes,
        createdAt: activeTransition.createdAt,
        updatedAt: activeTransition.updatedAt,
      };
      console.log(`[ReminderScheduler] ${childName}: Active transition found, targeting nap at ${transition.currentNapTime}`);
    }
  }

  // Get today's sessions to determine wake time and completed naps
  const todayStart = fromZonedTime(startOfDay(toZonedTime(now, timezone)), timezone);

  // Query for sessions created today
  const todayCreatedSessions = await prisma.sleepSession.findMany({
    where: {
      childId,
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: 'asc' },
  });

  // ALSO query for night sleep that started yesterday but woke up today
  // Night sessions are created when baby is put down (yesterday evening)
  // but wokeUpAt is set today morning - so we need to find these separately
  const nightSessionFromYesterday = await prisma.sleepSession.findFirst({
    where: {
      childId,
      sessionType: 'NIGHT_SLEEP',
      createdAt: { lt: todayStart }, // Created before today (yesterday)
      OR: [
        { wokeUpAt: { gte: todayStart } }, // Woke up today
        { state: { not: 'COMPLETED' } }, // Or still active
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // Combine: use night session from yesterday if found, plus today's sessions
  const sessions = nightSessionFromYesterday
    ? [nightSessionFromYesterday, ...todayCreatedSessions.filter(s => s.id !== nightSessionFromYesterday.id)]
    : todayCreatedSessions;

  // Find morning wake time (use wokeUpAt, not outOfCribAt - wake time is when baby woke, not left crib)
  let wakeTime: Date;
  const nightSession = sessions.find(s => s.sessionType === 'NIGHT_SLEEP' && s.wokeUpAt);

  if (nightSession?.wokeUpAt) {
    wakeTime = nightSession.wokeUpAt;
    console.log(`[ReminderScheduler] ${childName}: Using recorded wake time ${format(toZonedTime(wakeTime, timezone), 'h:mm a')}`);
  } else {
    // Use schedule's earliest wake time as default
    const [hours, minutes] = schedule.wakeTimeEarliest.split(':').map(Number);
    const zonedToday = toZonedTime(now, timezone);
    const wakeZoned = new Date(zonedToday);
    wakeZoned.setHours(hours ?? 6, minutes ?? 30, 0, 0);
    wakeTime = fromZonedTime(wakeZoned, timezone);

    // If wake time is in the future, use now
    if (isAfter(wakeTime, now)) {
      wakeTime = now;
    }
    console.log(`[ReminderScheduler] ${childName}: WARNING - No night session with wokeUpAt found, using schedule default ${schedule.wakeTimeEarliest}`);
  }

  // Get completed naps today
  const completedNaps = sessions.filter(
    s => s.sessionType === 'NAP' && s.state === 'COMPLETED'
  ).length;

  // Check if child is currently in a nap session (any state except COMPLETED)
  // PENDING = put down but not asleep, ASLEEP = sleeping, AWAKE = woke but still in crib
  const currentNapSession = sessions.find(
    s => s.sessionType === 'NAP' && s.state !== 'COMPLETED'
  );

  // Check if child is currently in night sleep (any state except COMPLETED)
  const currentNightSession = sessions.find(
    s => s.sessionType === 'NIGHT_SLEEP' && s.state !== 'COMPLETED'
  );

  // Get caregivers for notifications
  const caregivers = await prisma.childCaregiver.findMany({
    where: {
      childId,
      isActive: true,
      status: 'ACCEPTED',
    },
    select: { userId: true },
  });

  // Check nap cap - if child is currently napping and exceeded cap
  if (currentNapSession?.asleepAt && schedule.napCapMinutes) {
    const napDurationMinutes = differenceInMinutes(now, currentNapSession.asleepAt);

    if (napDurationMinutes >= schedule.napCapMinutes) {
      // Send alert once per nap session
      const napKey = `${currentNapSession.id}`;
      if (shouldSendOneTimeAlert(childId, 'nap_cap', napKey)) {
        for (const caregiver of caregivers) {
          await sendNapCapExceededAlert(
            caregiver.userId,
            childName,
            napDurationMinutes,
            schedule.napCapMinutes,
            childId
          );
        }
        markOneTimeAlertSent(childId, 'nap_cap', napKey);
        console.log(`[ReminderScheduler] Sent nap cap exceeded alert for ${childName} (${napDurationMinutes}min)`);
      }
    }
  }

  // Check day sleep cap - if child is currently napping, check total sleep budget
  if (currentNapSession?.asleepAt && schedule.daySleepCap) {
    const currentNapMinutes = differenceInMinutes(now, currentNapSession.asleepAt);

    // Get completed nap sleep from today (before current nap)
    const completedNapSleepToday = sessions
      .filter(s => s.sessionType === 'NAP' && s.state === 'COMPLETED' && s.sleepMinutes)
      .reduce((sum, s) => sum + (s.sleepMinutes ?? 0), 0);

    const totalSleepToday = completedNapSleepToday + currentNapMinutes;
    const remainingBudget = schedule.daySleepCap - totalSleepToday;

    // Send 5-minute warning
    if (remainingBudget <= 5 && remainingBudget > 0) {
      const warningKey = `${currentNapSession.id}-5min`;
      if (shouldSendOneTimeAlert(childId, 'day_sleep_cap_warning', warningKey)) {
        for (const caregiver of caregivers) {
          await sendDaySleepCapWarningAlert(
            caregiver.userId,
            childName,
            remainingBudget,
            totalSleepToday,
            schedule.daySleepCap,
            childId
          );
        }
        markOneTimeAlertSent(childId, 'day_sleep_cap_warning', warningKey);
        console.log(`[ReminderScheduler] Sent day sleep cap 5-min warning for ${childName} (${remainingBudget}min remaining)`);
      }
    }

    // Send exceeded alert
    if (remainingBudget <= 0) {
      const exceededKey = `${currentNapSession.id}-exceeded`;
      if (shouldSendOneTimeAlert(childId, 'day_sleep_cap_exceeded', exceededKey)) {
        for (const caregiver of caregivers) {
          await sendDaySleepCapExceededAlert(
            caregiver.userId,
            childName,
            totalSleepToday,
            schedule.daySleepCap,
            childId
          );
        }
        markOneTimeAlertSent(childId, 'day_sleep_cap_exceeded', exceededKey);
        console.log(`[ReminderScheduler] Sent day sleep cap exceeded alert for ${childName} (${totalSleepToday}min total, cap: ${schedule.daySleepCap}min)`);
      }
    }
  }

  // Check wake deadline for night sleep - send reminders at 30 and 15 minutes before
  if (currentNightSession?.asleepAt && schedule.mustWakeBy) {
    // Parse mustWakeBy time for today
    const [hours, minutes] = schedule.mustWakeBy.split(':').map(Number);
    const zonedToday = toZonedTime(now, timezone);
    const mustWakeByZoned = new Date(zonedToday);
    mustWakeByZoned.setHours(hours ?? 7, minutes ?? 30, 0, 0);
    const mustWakeByTime = fromZonedTime(mustWakeByZoned, timezone);

    // Only check if we haven't passed the deadline yet
    if (isBefore(now, mustWakeByTime)) {
      const minutesUntilDeadline = differenceInMinutes(mustWakeByTime, now);

      // Send 30-minute reminder
      if (minutesUntilDeadline <= 30 && minutesUntilDeadline > 15) {
        if (shouldSendReminder(childId, 'wake_deadline_30', mustWakeByTime, now, 30)) {
          for (const caregiver of caregivers) {
            await sendWakeDeadlineAlert(
              caregiver.userId,
              childName,
              minutesUntilDeadline,
              schedule.mustWakeBy,
              childId
            );
          }
          markReminderSent(childId, 'wake_deadline_30', mustWakeByTime);
          console.log(`[ReminderScheduler] Sent 30-min wake deadline alert for ${childName} (${minutesUntilDeadline}min remaining)`);
        }
      }

      // Send 15-minute reminder
      if (minutesUntilDeadline <= 15) {
        if (shouldSendReminder(childId, 'wake_deadline_15', mustWakeByTime, now, 15)) {
          for (const caregiver of caregivers) {
            await sendWakeDeadlineAlert(
              caregiver.userId,
              childName,
              minutesUntilDeadline,
              schedule.mustWakeBy,
              childId
            );
          }
          markReminderSent(childId, 'wake_deadline_15', mustWakeByTime);
          console.log(`[ReminderScheduler] Sent 15-min wake deadline alert for ${childName} (${minutesUntilDeadline}min remaining)`);
        }
      }
    }
  }

  // If child is currently asleep, don't send nap/bedtime reminders
  if (currentNapSession || currentNightSession) {
    return;
  }

  // Separate scheduled naps from ad-hoc naps (same logic as calculator.routes.ts today-summary)
  const napSessions = sessions.filter(s => s.sessionType === 'NAP');
  const scheduledNaps = napSessions.filter(s => !s.isAdHoc);
  const adHocNaps = napSessions.filter(s => s.isAdHoc && s.state === 'COMPLETED');

  // Get completed scheduled naps
  const completedScheduledNaps = scheduledNaps.filter(
    s => s.state === 'COMPLETED' && s.asleepAt && s.wokeUpAt
  );

  // Use qualifiedRestMinutes instead of raw sleepMinutes (matches dashboard logic)
  // Qualified Rest = (Awake Crib Time ÷ 2) + Actual Sleep Time
  const scheduledNapDurations = completedScheduledNaps.map(s => s.qualifiedRestMinutes ?? s.sleepMinutes ?? 0);
  const adHocNapDurations = adHocNaps.map(s => s.qualifiedRestMinutes ?? 0);
  const napDurations = [...scheduledNapDurations, ...adHocNapDurations];

  // Get actual nap end times (wokeUpAt) for precise timing calculations
  const actualNapEndTimes: Date[] = completedScheduledNaps
    .map(s => s.wokeUpAt)
    .filter((t): t is Date => t !== null);

  // Calculate day schedule with actual nap data and transition info
  const daySchedule = calculateDaySchedule(
    wakeTime,
    schedule as any, // Type coercion for schedule response
    timezone,
    transition, // Pass transition data for correct nap time calculation
    napDurations.length > 0 ? napDurations : undefined,
    actualNapEndTimes.length > 0 ? actualNapEndTimes : undefined
  );

  // Apply ad-hoc bedtime bump (15 min if any ad-hoc nap >= 30 min) - same as dashboard
  const hasSignificantAdHocNap = adHocNaps.some(s => (s.sleepMinutes ?? 0) >= 30);
  if (hasSignificantAdHocNap) {
    const bump = 15 * 60000; // 15 minutes in ms
    daySchedule.bedtime.putDownWindow.earliest = new Date(daySchedule.bedtime.putDownWindow.earliest.getTime() + bump);
    daySchedule.bedtime.putDownWindow.latest = new Date(daySchedule.bedtime.putDownWindow.latest.getTime() + bump);
    daySchedule.bedtime.putDownWindow.recommended = new Date(daySchedule.bedtime.putDownWindow.recommended.getTime() + bump);
    daySchedule.bedtime.notes.push('+15 min bump for ad-hoc nap (30+ min)');
  }

  // Log schedule calculation for debugging
  const scheduleType = schedule.type as ScheduleType;
  const isTransitionOrOneNap = scheduleType === ScheduleType.TRANSITION || scheduleType === ScheduleType.ONE_NAP;
  if (isTransitionOrOneNap && daySchedule.naps.length > 0) {
    const nap1Time = format(toZonedTime(daySchedule.naps[0]!.putDownWindow.recommended, timezone), 'h:mm a');
    console.log(`[ReminderScheduler] ${childName}: ${scheduleType} schedule - Nap 1 calculated at ${nap1Time}${transition ? ` (transition target: ${transition.currentNapTime})` : ''}`);
  }

  // Get reminder lead times from schedule (with defaults for backwards compatibility)
  const napReminderMinutes = schedule.napReminderMinutes ?? DEFAULT_NAP_REMINDER_MINUTES;
  const bedtimeReminderMinutes = schedule.bedtimeReminderMinutes ?? DEFAULT_BEDTIME_REMINDER_MINUTES;

  // Check each nap - send reminders at 30 and 15 minutes before (for 5-10 min routine)
  // For TRANSITION and ONE_NAP schedules, only process nap 1 (single nap)
  const maxNapsToProcess = isTransitionOrOneNap ? 1 : daySchedule.naps.length;

  for (let i = 0; i < maxNapsToProcess && i < daySchedule.naps.length; i++) {
    const nap = daySchedule.naps[i]!;
    if (nap.napNumber <= completedNaps) {
      continue; // Already completed
    }

    const napTime = nap.putDownWindow.recommended;
    const minutesUntilNap = differenceInMinutes(napTime, now);
    const timeStr = format(toZonedTime(napTime, timezone), 'h:mm a');

    // Send 30-minute nap reminder (start thinking about routine)
    if (minutesUntilNap <= 30 && minutesUntilNap > 15) {
      const napType30 = `nap${nap.napNumber}_30` as 'nap1_30' | 'nap2_30';
      if (shouldSendReminder(childId, napType30, napTime, now, 30)) {
        for (const caregiver of caregivers) {
          await sendNapReminder(caregiver.userId, childName, nap.napNumber, timeStr, childId);
        }
        markReminderSent(childId, napType30, napTime);
        console.log(`[ReminderScheduler] Sent 30-min nap ${nap.napNumber} reminder for ${childName}`);
      }
    }

    // Send 15-minute nap reminder (start routine now - 5-10 min routine)
    if (minutesUntilNap <= 15 && minutesUntilNap > 0) {
      const napType15 = `nap${nap.napNumber}_15` as 'nap1_15' | 'nap2_15';
      if (shouldSendReminder(childId, napType15, napTime, now, 15)) {
        for (const caregiver of caregivers) {
          await sendNapReminder(caregiver.userId, childName, nap.napNumber, timeStr, childId);
        }
        markReminderSent(childId, napType15, napTime);
        console.log(`[ReminderScheduler] Sent 15-min nap ${nap.napNumber} reminder for ${childName}`);
      }
    }
  }

  // Check bedtime - send reminders at 30 and 15 minutes before (for 15-20 min routine)
  const bedtime = daySchedule.bedtime.putDownWindow.recommended;
  const minutesUntilBedtime = differenceInMinutes(bedtime, now);
  const bedtimeStr = format(toZonedTime(bedtime, timezone), 'h:mm a');

  // Debug logging for bedtime calculation
  if (minutesUntilBedtime <= 60 && minutesUntilBedtime > 0) {
    console.log(`[ReminderScheduler] ${childName}: Bedtime ${bedtimeStr}, ${minutesUntilBedtime} min away, qualified rest: [${napDurations.join(', ')}]${hasSignificantAdHocNap ? ' (+15m ad-hoc bump)' : ''}`);
  }

  // Send 30-minute bedtime reminder (get ready for routine)
  if (minutesUntilBedtime <= 30 && minutesUntilBedtime > 15) {
    if (shouldSendReminder(childId, 'bedtime_30', bedtime, now, 30)) {
      for (const caregiver of caregivers) {
        await sendBedtimeReminder(caregiver.userId, childName, bedtimeStr, childId);
      }
      markReminderSent(childId, 'bedtime_30', bedtime);
      console.log(`[ReminderScheduler] Sent 30-min bedtime reminder for ${childName}`);
    }
  }

  // Send 15-minute bedtime reminder (start routine now - 15-20 min routine)
  if (minutesUntilBedtime <= 15 && minutesUntilBedtime > 0) {
    if (shouldSendReminder(childId, 'bedtime_15', bedtime, now, 15)) {
      for (const caregiver of caregivers) {
        await sendBedtimeReminder(caregiver.userId, childName, bedtimeStr, childId);
      }
      markReminderSent(childId, 'bedtime_15', bedtime);
      console.log(`[ReminderScheduler] Sent 15-min bedtime reminder for ${childName}`);
    }
  }
}

/**
 * Main scheduler loop - checks all children for pending reminders
 */
async function runSchedulerTick(): Promise<void> {
  try {
    // Get all children with active schedules
    const children = await prisma.child.findMany({
      where: {
        schedules: {
          some: {
            isActive: true,
          },
        },
        caregivers: {
          some: {
            isActive: true,
            status: 'ACCEPTED',
          },
        },
      },
      include: {
        caregivers: {
          where: {
            isActive: true,
            status: 'ACCEPTED',
          },
          include: {
            user: {
              select: { timezone: true },
            },
          },
        },
      },
    });

    for (const child of children) {
      // Use the first caregiver's timezone (or default)
      const timezone = child.caregivers[0]?.user?.timezone ?? 'America/New_York';

      await processChildReminders(child.id, child.name, timezone);
    }
  } catch (error) {
    console.error('[ReminderScheduler] Error in scheduler tick:', error);
  }
}

/**
 * Start the reminder scheduler
 */
export function startReminderScheduler(): void {
  if (isRunning) {
    console.log('[ReminderScheduler] Already running');
    return;
  }

  console.log('[ReminderScheduler] Starting reminder scheduler...');
  isRunning = true;

  // Run immediately
  runSchedulerTick();

  // Then run every minute
  intervalId = setInterval(runSchedulerTick, CHECK_INTERVAL_MS);

  console.log('[ReminderScheduler] Scheduler started (checking every minute)');
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(): void {
  if (!isRunning) {
    return;
  }

  console.log('[ReminderScheduler] Stopping reminder scheduler...');

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  isRunning = false;
  console.log('[ReminderScheduler] Scheduler stopped');
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger a check (for testing)
 */
export async function triggerSchedulerCheck(): Promise<void> {
  await runSchedulerTick();
}
