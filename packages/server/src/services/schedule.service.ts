import { prisma } from '../config/database.js';
import { Role, ScheduleType, InviteStatus } from '../types/enums.js';
import { getEffectiveTransitionWeek } from './schedule.calculator.service.js';
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
  StartTransitionInput,
  ProgressTransitionInput,
  SleepScheduleResponse,
  TransitionResponse,
} from '../schemas/schedule.schema.js';

export class ScheduleServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ScheduleServiceError';
  }
}

// Verify user has access to child
async function verifyChildAccess(
  userId: string,
  childId: string,
  requireAdmin: boolean = false
): Promise<string> {
  const relation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: {
        childId,
        userId,
      },
    },
  });

  if (!relation || relation.status !== InviteStatus.ACCEPTED || !relation.isActive) {
    throw new ScheduleServiceError('Child not found', 'CHILD_NOT_FOUND', 404);
  }

  if (requireAdmin && relation.role !== Role.ADMIN) {
    throw new ScheduleServiceError(
      'Only admins can modify schedules',
      'FORBIDDEN',
      403
    );
  }

  // Check if user is a viewer
  if (relation.role === Role.VIEWER && requireAdmin) {
    throw new ScheduleServiceError(
      'Viewers cannot modify schedules',
      'FORBIDDEN',
      403
    );
  }

  return relation.role;
}

function formatSchedule(
  schedule: {
    id: string;
    childId: string;
    type: string;
    isActive: boolean;
    wakeWindow1Min: number;
    wakeWindow1Max: number;
    wakeWindow2Min: number | null;
    wakeWindow2Max: number | null;
    wakeWindow3Min: number | null;
    wakeWindow3Max: number | null;
    nap1Earliest: string | null;
    nap1LatestStart: string | null;
    nap1MaxDuration: number | null;
    nap1EndBy: string | null;
    nap2Earliest: string | null;
    nap2LatestStart: string | null;
    nap2MaxDuration: number | null;
    nap2EndBy: string | null;
    nap2ExceptionDuration: number | null;
    bedtimeEarliest: string;
    bedtimeLatest: string;
    bedtimeGoalStart: string | null;
    bedtimeGoalEnd: string | null;
    wakeTimeEarliest: string;
    wakeTimeLatest: string;
    mustWakeBy?: string;
    daySleepCap: number;
    napCapMinutes?: number;
    minimumCribMinutes?: number;
    napReminderMinutes?: number;
    bedtimeReminderMinutes?: number;
    wakeDeadlineReminderMinutes?: number;
    napTimingMode?: string;
    bedtimeMode?: string;
    createdAt: Date;
    updatedAt: Date;
  }
): SleepScheduleResponse {
  return {
    ...schedule,
    mustWakeBy: schedule.mustWakeBy ?? '07:30',
    napCapMinutes: schedule.napCapMinutes ?? 120,
    minimumCribMinutes: schedule.minimumCribMinutes ?? 90,
    napReminderMinutes: schedule.napReminderMinutes ?? 30,
    bedtimeReminderMinutes: schedule.bedtimeReminderMinutes ?? 30,
    wakeDeadlineReminderMinutes: schedule.wakeDeadlineReminderMinutes ?? 15,
    napTimingMode: (schedule.napTimingMode as 'WAKE_WINDOWS' | 'CONSULTANT_RULES') ?? 'WAKE_WINDOWS',
    bedtimeMode: (schedule.bedtimeMode as 'GOAL_BASED' | 'WAKE_WINDOW') ?? 'GOAL_BASED',
  };
}

function formatTransition(
  transition: {
    id: string;
    childId: string;
    fromType: string;
    toType: string;
    startedAt: Date;
    currentWeek: number;
    targetWeeks?: number | null;
    currentNapTime: string;
    completedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): TransitionResponse {
  const targetWeeks = transition.targetWeeks ?? 6;
  return {
    ...transition,
    targetWeeks,
    effectiveWeek: getEffectiveTransitionWeek({
      startedAt: transition.startedAt,
      currentWeek: transition.currentWeek,
      targetWeeks,
      completedAt: transition.completedAt,
    }),
  };
}

export async function getActiveSchedule(
  userId: string,
  childId: string
): Promise<SleepScheduleResponse | null> {
  await verifyChildAccess(userId, childId);

  const schedule = await prisma.sleepSchedule.findFirst({
    where: {
      childId,
      isActive: true,
    },
  });

  if (!schedule) {
    return null;
  }

  return formatSchedule(schedule);
}

export async function createOrUpdateSchedule(
  userId: string,
  childId: string,
  input: CreateScheduleInput | UpdateScheduleInput
): Promise<SleepScheduleResponse> {
  await verifyChildAccess(userId, childId, true);

  // Deactivate any existing active schedule
  await prisma.sleepSchedule.updateMany({
    where: {
      childId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Create new schedule
  const schedule = await prisma.sleepSchedule.create({
    data: {
      childId,
      type: input.type,
      isActive: true,

      wakeWindow1Min: input.wakeWindow1Min!,
      wakeWindow1Max: input.wakeWindow1Max!,
      wakeWindow2Min: input.wakeWindow2Min ?? null,
      wakeWindow2Max: input.wakeWindow2Max ?? null,
      wakeWindow3Min: input.wakeWindow3Min ?? null,
      wakeWindow3Max: input.wakeWindow3Max ?? null,

      nap1Earliest: input.nap1Earliest ?? null,
      nap1LatestStart: input.nap1LatestStart ?? null,
      nap1MaxDuration: input.nap1MaxDuration ?? null,
      nap1EndBy: input.nap1EndBy ?? null,

      nap2Earliest: input.nap2Earliest ?? null,
      nap2LatestStart: input.nap2LatestStart ?? null,
      nap2MaxDuration: input.nap2MaxDuration ?? null,
      nap2EndBy: input.nap2EndBy ?? null,
      nap2ExceptionDuration: input.nap2ExceptionDuration ?? null,

      bedtimeEarliest: input.bedtimeEarliest!,
      bedtimeLatest: input.bedtimeLatest!,
      bedtimeGoalStart: input.bedtimeGoalStart ?? null,
      bedtimeGoalEnd: input.bedtimeGoalEnd ?? null,

      wakeTimeEarliest: input.wakeTimeEarliest!,
      wakeTimeLatest: input.wakeTimeLatest!,

      daySleepCap: input.daySleepCap!,
      minimumCribMinutes: input.minimumCribMinutes ?? 90,
      napReminderMinutes: input.napReminderMinutes ?? 30,
      bedtimeReminderMinutes: input.bedtimeReminderMinutes ?? 30,
      wakeDeadlineReminderMinutes: input.wakeDeadlineReminderMinutes ?? 15,
    },
  });

  return formatSchedule(schedule);
}

export async function getAllSchedules(
  userId: string,
  childId: string
): Promise<SleepScheduleResponse[]> {
  await verifyChildAccess(userId, childId);

  const schedules = await prisma.sleepSchedule.findMany({
    where: { childId },
    orderBy: { createdAt: 'desc' },
  });

  return schedules.map(formatSchedule);
}

// Transition management
export async function getActiveTransition(
  userId: string,
  childId: string
): Promise<TransitionResponse | null> {
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

  return formatTransition(transition);
}

export async function startTransition(
  userId: string,
  childId: string,
  input: StartTransitionInput
): Promise<TransitionResponse> {
  await verifyChildAccess(userId, childId, true);

  // Check if there's already an active transition
  const existingTransition = await prisma.scheduleTransition.findFirst({
    where: {
      childId,
      completedAt: null,
    },
  });

  if (existingTransition) {
    throw new ScheduleServiceError(
      'A transition is already in progress',
      'TRANSITION_IN_PROGRESS',
      409
    );
  }

  // Create the transition
  const transition = await prisma.scheduleTransition.create({
    data: {
      childId,
      fromType: input.fromType,
      toType: input.toType,
      currentNapTime: input.startNapTime,
      currentWeek: 1,
      targetWeeks: input.targetWeeks ?? 6,
    },
  });

  // Update the active schedule to TRANSITION type
  await prisma.sleepSchedule.updateMany({
    where: {
      childId,
      isActive: true,
    },
    data: {
      type: ScheduleType.TRANSITION,
    },
  });

  return formatTransition(transition);
}

export async function progressTransition(
  userId: string,
  childId: string,
  input: ProgressTransitionInput
): Promise<TransitionResponse> {
  await verifyChildAccess(userId, childId, true);

  // Find the active transition
  const transition = await prisma.scheduleTransition.findFirst({
    where: {
      childId,
      completedAt: null,
    },
  });

  if (!transition) {
    throw new ScheduleServiceError(
      'No active transition found',
      'NO_ACTIVE_TRANSITION',
      404
    );
  }

  // Build update data
  const updateData: {
    currentNapTime?: string;
    currentWeek?: number;
    targetWeeks?: number;
    notes?: string;
    completedAt?: Date;
  } = {};

  if (input.newNapTime) {
    updateData.currentNapTime = input.newNapTime;
  }

  if (input.currentWeek) {
    updateData.currentWeek = input.currentWeek;
  }

  if (input.targetWeeks) {
    updateData.targetWeeks = input.targetWeeks;
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  if (input.complete) {
    updateData.completedAt = new Date();

    // Update the active schedule to ONE_NAP type AND persist consultant-aligned
    // nap/wake-window timings centered on the transition's final nap time, so
    // the calculator stops reading stale TWO_NAP values once the transition
    // record drops out of getActiveTransition().
    const finalNapTime = input.newNapTime ?? transition.currentNapTime;
    await prisma.sleepSchedule.updateMany({
      where: { childId, isActive: true },
      data: oneNapScheduleOverrides(finalNapTime),
    });
  }

  const updatedTransition = await prisma.scheduleTransition.update({
    where: { id: transition.id },
    data: updateData,
  });

  return formatTransition(updatedTransition);
}

export async function cancelTransition(
  userId: string,
  childId: string
): Promise<void> {
  await verifyChildAccess(userId, childId, true);

  // Find the active transition
  const transition = await prisma.scheduleTransition.findFirst({
    where: {
      childId,
      completedAt: null,
    },
  });

  if (!transition) {
    throw new ScheduleServiceError(
      'No active transition found',
      'NO_ACTIVE_TRANSITION',
      404
    );
  }

  // Delete the transition
  await prisma.scheduleTransition.delete({
    where: { id: transition.id },
  });

  // Revert the active schedule to TWO_NAP type
  await prisma.sleepSchedule.updateMany({
    where: {
      childId,
      isActive: true,
    },
    data: {
      type: ScheduleType.TWO_NAP,
    },
  });
}

export async function getTransitionHistory(
  userId: string,
  childId: string
): Promise<TransitionResponse[]> {
  await verifyChildAccess(userId, childId);

  const transitions = await prisma.scheduleTransition.findMany({
    where: { childId },
    orderBy: { startedAt: 'desc' },
  });

  return transitions.map(formatTransition);
}

// Returns the schedule fields that should be written when a 2-to-1 transition
// completes, given the transition's final currentNapTime. Without this, the
// schedule retains its original TWO_NAP timings (nap1Earliest ~ 08:30,
// wakeWindow1 ~ 2.5 hr) under a ONE_NAP type, and the calculator recommends
// the single nap ~2 hr after wake instead of the consultant's 12:30 target.
//
// Defaults follow the consultant's after-transition rules from CLAUDE.md:
//   single nap target: 12:30-13:00
//   max duration:      150 min (2.5 hr)
//   end by:            15:30
//   wake window:       5-5.5 hr from wake to nap
//   bedtime window:    4-5 hr from nap end to bedtime
function oneNapScheduleOverrides(currentNapTime: string): {
  type: string;
  nap1Earliest: string;
  nap1LatestStart: string;
  nap1MaxDuration: number;
  nap1EndBy: string;
  wakeWindow1Min: number;
  wakeWindow1Max: number;
  wakeWindow2Min: null;
  wakeWindow2Max: null;
  wakeWindow3Min: number;
  wakeWindow3Max: number;
  nap2Earliest: null;
  nap2LatestStart: null;
  nap2MaxDuration: null;
  nap2EndBy: null;
  nap2ExceptionDuration: null;
} {
  const [hRaw, mRaw] = currentNapTime.split(':').map(Number);
  const h = hRaw ?? 12;
  const m = mRaw ?? 30;
  const startMinutes = h * 60 + m;
  const latestStartMinutes = startMinutes + 30; // ±30-min landing window
  const latestH = Math.floor(latestStartMinutes / 60) % 24;
  const latestM = latestStartMinutes % 60;
  const nap1LatestStart = `${String(latestH).padStart(2, '0')}:${String(latestM).padStart(2, '0')}`;

  return {
    type: ScheduleType.ONE_NAP,
    nap1Earliest: currentNapTime,
    nap1LatestStart,
    nap1MaxDuration: 150,
    nap1EndBy: '15:30',
    wakeWindow1Min: 300,
    wakeWindow1Max: 330,
    wakeWindow2Min: null,
    wakeWindow2Max: null,
    wakeWindow3Min: 240,
    wakeWindow3Max: 300,
    nap2Earliest: null,
    nap2LatestStart: null,
    nap2MaxDuration: null,
    nap2EndBy: null,
    nap2ExceptionDuration: null,
  };
}

// Idempotent startup hook for the 2-to-1 transition state machine.
// Runs three passes:
//
// 1. Auto-completes any open transition whose calendar duration
//    (startedAt + targetWeeks * 7 days) has elapsed. The matching schedule
//    is flipped to ONE_NAP with consultant-aligned nap/wake-window timings
//    derived from the transition's final currentNapTime.
//
// 2. For every still-open transition, flips its active schedule from
//    TWO_NAP to TRANSITION if it's drifted out of sync (e.g. transitions
//    started before startTransition() began updating the schedule row).
//
// 3. Corrective backfill for users whose transition already completed before
//    we started persisting the ONE_NAP timings — if the active schedule is
//    ONE_NAP but its nap1Earliest still looks like a 2-nap value (before
//    11:00 or missing), re-apply the overrides from the most recent
//    completed transition.
//
// Safe to run on every server boot — it only touches affected rows.
export async function backfillTransitionScheduleTypes(): Promise<{
  schedulesFlipped: number;
  transitionsAutoCompleted: number;
}> {
  // ---- Pass 1: auto-complete expired transitions ----
  const candidates = await prisma.scheduleTransition.findMany({
    where: { completedAt: null },
    select: {
      id: true,
      childId: true,
      startedAt: true,
      targetWeeks: true,
      currentNapTime: true,
    },
  });

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  let autoCompleted = 0;

  for (const t of candidates) {
    const targetWeeks = t.targetWeeks ?? 6;
    const expectedEnd = t.startedAt.getTime() + targetWeeks * msPerWeek;
    if (expectedEnd > now.getTime()) continue;

    await prisma.$transaction([
      prisma.scheduleTransition.update({
        where: { id: t.id },
        data: { completedAt: now },
      }),
      prisma.sleepSchedule.updateMany({
        where: { childId: t.childId, isActive: true },
        data: oneNapScheduleOverrides(t.currentNapTime),
      }),
    ]);
    autoCompleted += 1;
  }

  // ---- Pass 2: flip TWO_NAP schedules under any still-open transition ----
  const stillOpen = await prisma.scheduleTransition.findMany({
    where: { completedAt: null },
    select: { childId: true },
  });

  let flippedCount = 0;
  if (stillOpen.length > 0) {
    const childIds = stillOpen.map(t => t.childId);
    const flipResult = await prisma.sleepSchedule.updateMany({
      where: {
        childId: { in: childIds },
        isActive: true,
        type: ScheduleType.TWO_NAP,
      },
      data: { type: ScheduleType.TRANSITION },
    });
    flippedCount = flipResult.count;
  }

  // ---- Pass 3: corrective backfill for already-completed transitions ----
  // Find ONE_NAP schedules whose nap1Earliest is still in the TWO_NAP morning
  // range (or missing). If the child has a completed transition, re-apply the
  // ONE_NAP overrides from the latest one. Idempotent — once nap1Earliest is
  // >= 11:00, the heuristic no longer matches.
  const stalSchedules = await prisma.sleepSchedule.findMany({
    where: {
      isActive: true,
      type: ScheduleType.ONE_NAP,
      OR: [
        { nap1Earliest: null },
        { nap1Earliest: { lt: '11:00' } }, // String comparison works for HH:mm
      ],
    },
    select: { id: true, childId: true },
  });

  let correctedCount = 0;
  for (const sched of stalSchedules) {
    const lastTransition = await prisma.scheduleTransition.findFirst({
      where: {
        childId: sched.childId,
        toType: ScheduleType.ONE_NAP,
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: { currentNapTime: true },
    });

    if (!lastTransition) continue;

    await prisma.sleepSchedule.update({
      where: { id: sched.id },
      data: oneNapScheduleOverrides(lastTransition.currentNapTime),
    });
    correctedCount += 1;
  }

  return {
    schedulesFlipped: flippedCount + correctedCount,
    transitionsAutoCompleted: autoCompleted,
  };
}
