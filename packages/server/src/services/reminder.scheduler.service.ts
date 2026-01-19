import { prisma } from '../config/database.js';
import { sendBedtimeReminder, sendNapReminder, sendNotificationToCaregivers } from './notification.service.js';
import { calculateDaySchedule, calculateNextAction } from './schedule.calculator.service.js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfDay, format, differenceInMinutes, addMinutes, isAfter, isBefore } from 'date-fns';

// Track which reminders have been sent to avoid duplicates
// Key format: `${childId}-${type}-${date}` where type is 'nap1', 'nap2', 'bedtime'
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
const REMINDER_MINUTES_BEFORE = 15; // Send reminder 15 minutes before
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Check if we should send a reminder for a specific event
 */
function shouldSendReminder(
  childId: string,
  type: 'nap1' | 'nap2' | 'bedtime',
  eventTime: Date,
  now: Date
): boolean {
  const key = `${childId}-${type}-${format(eventTime, 'yyyy-MM-dd')}`;

  // Already sent this reminder today
  if (sentReminders.has(key)) {
    return false;
  }

  // Check if we're within the reminder window
  const reminderTime = addMinutes(eventTime, -REMINDER_MINUTES_BEFORE);
  const reminderWindowEnd = eventTime;

  // Send if current time is between reminderTime and eventTime
  return isAfter(now, reminderTime) && isBefore(now, reminderWindowEnd);
}

/**
 * Mark a reminder as sent
 */
function markReminderSent(childId: string, type: 'nap1' | 'nap2' | 'bedtime', eventTime: Date): void {
  const key = `${childId}-${type}-${format(eventTime, 'yyyy-MM-dd')}`;
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

  // Get today's sessions to determine wake time and completed naps
  const todayStart = fromZonedTime(startOfDay(toZonedTime(now, timezone)), timezone);

  const sessions = await prisma.sleepSession.findMany({
    where: {
      childId,
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Find morning wake time (either from night sleep end or use schedule default)
  let wakeTime: Date;
  const nightSession = sessions.find(s => s.sessionType === 'NIGHT_SLEEP' && s.outOfCribAt);

  if (nightSession?.outOfCribAt) {
    wakeTime = nightSession.outOfCribAt;
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
  }

  // Get completed naps today
  const completedNaps = sessions.filter(
    s => s.sessionType === 'NAP' && s.state === 'COMPLETED'
  ).length;

  // Check if child is currently asleep
  const currentlyAsleep = sessions.some(
    s => s.state === 'ASLEEP'
  );

  if (currentlyAsleep) {
    return; // Don't send reminders while child is sleeping
  }

  // Calculate day schedule
  const daySchedule = calculateDaySchedule(
    wakeTime,
    schedule as any, // Type coercion for schedule response
    timezone
  );

  // Check each nap
  for (const nap of daySchedule.naps) {
    if (nap.napNumber <= completedNaps) {
      continue; // Already completed
    }

    const napType = `nap${nap.napNumber}` as 'nap1' | 'nap2';
    const napTime = nap.putDownWindow.recommended;

    if (shouldSendReminder(childId, napType, napTime, now)) {
      const timeStr = format(toZonedTime(napTime, timezone), 'h:mm a');

      // Get all caregivers for this child
      const caregivers = await prisma.childCaregiver.findMany({
        where: {
          childId,
          isActive: true,
          status: 'ACCEPTED',
        },
        select: { userId: true },
      });

      for (const caregiver of caregivers) {
        await sendNapReminder(caregiver.userId, childName, nap.napNumber, timeStr, childId);
      }

      markReminderSent(childId, napType, napTime);
      console.log(`[ReminderScheduler] Sent nap ${nap.napNumber} reminder for ${childName}`);
    }
  }

  // Check bedtime
  const bedtime = daySchedule.bedtime.putDownWindow.recommended;

  if (shouldSendReminder(childId, 'bedtime', bedtime, now)) {
    const timeStr = format(toZonedTime(bedtime, timezone), 'h:mm a');

    // Get all caregivers for this child
    const caregivers = await prisma.childCaregiver.findMany({
      where: {
        childId,
        isActive: true,
        status: 'ACCEPTED',
      },
      select: { userId: true },
    });

    for (const caregiver of caregivers) {
      await sendBedtimeReminder(caregiver.userId, childName, timeStr, childId);
    }

    markReminderSent(childId, 'bedtime', bedtime);
    console.log(`[ReminderScheduler] Sent bedtime reminder for ${childName}`);
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
