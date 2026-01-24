import { prisma } from '../config/database.js';
import { Role, ScheduleType, InviteStatus } from '../types/enums.js';
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
    targetWeeks: number;
    currentNapTime: string;
    completedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): TransitionResponse {
  return transition;
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
    notes?: string;
    completedAt?: Date;
  } = {};

  if (input.newNapTime) {
    updateData.currentNapTime = input.newNapTime;
  }

  if (input.currentWeek) {
    updateData.currentWeek = input.currentWeek;
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  if (input.complete) {
    updateData.completedAt = new Date();

    // Update the active schedule to ONE_NAP type
    await prisma.sleepSchedule.updateMany({
      where: {
        childId,
        isActive: true,
      },
      data: {
        type: ScheduleType.ONE_NAP,
      },
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
