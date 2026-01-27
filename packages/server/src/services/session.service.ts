import { prisma } from '../config/database.js';
import { startOfDay, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  Role,
  SessionState,
  InviteStatus,
  WakeType,
  isValidStateTransition,
} from '../types/enums.js';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsQuery,
  SleepSessionResponse,
  PaginatedSessions,
  CreateSleepCycleInput,
  UpdateSleepCycleInput,
  SleepCycleResponse,
} from '../schemas/session.schema.js';

export class SessionServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SessionServiceError';
  }
}

// Verify user has access to child and check role
async function verifyChildAccess(
  userId: string,
  childId: string,
  requireWriteAccess: boolean = false
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
    throw new SessionServiceError('Child not found', 'CHILD_NOT_FOUND', 404);
  }

  if (requireWriteAccess && relation.role === Role.VIEWER) {
    throw new SessionServiceError(
      'Viewers cannot modify sessions',
      'FORBIDDEN',
      403
    );
  }

  return relation.role;
}

interface SessionWithUserInfo {
  id: string;
  childId: string;
  sessionType: string;
  state: string;
  napNumber: number | null;
  isAdHoc: boolean;
  location: string;
  putDownAt: Date | null;
  asleepAt: Date | null;
  wokeUpAt: Date | null;
  outOfCribAt: Date | null;
  cryingMinutes: number | null;
  notes: string | null;
  timezone: string | null;
  totalMinutes: number | null;
  sleepMinutes: number | null;
  settlingMinutes: number | null;
  postWakeMinutes: number | null;
  awakeCribMinutes: number | null;
  qualifiedRestMinutes: number | null;
  createdByUserId: string | null;
  lastUpdatedByUserId: string | null;
  createdByUser?: { id: string; name: string; email: string } | null;
  lastUpdatedByUser?: { id: string; name: string; email: string } | null;
  sleepCycles?: Array<{
    id: string;
    cycleNumber: number;
    wokeUpAt: Date;
    fellBackAsleepAt: Date | null;
    wakeType: string;
    sleepMinutes: number | null;
    awakeMinutes: number | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

function formatSession(session: SessionWithUserInfo): SleepSessionResponse & {
  createdByUserId?: string | null;
  lastUpdatedByUserId?: string | null;
  createdByName?: string | null;
  lastUpdatedByName?: string | null;
  sleepCycles?: SleepCycleResponse[];
  wakeUpCount?: number;
  totalCycleSleepMinutes?: number;
  totalAwakeMinutes?: number;
} {
  // Calculate totals from wake events (sleep cycles) if present
  let wakeUpCount = 0;
  let totalCycleSleepMinutes = 0;
  let totalAwakeMinutes = 0;

  if (session.sleepCycles && session.sleepCycles.length > 0) {
    wakeUpCount = session.sleepCycles.length; // Each cycle is a wake event
    totalCycleSleepMinutes = session.sleepCycles.reduce((sum, c) => sum + (c.sleepMinutes ?? 0), 0);
    totalAwakeMinutes = session.sleepCycles.reduce((sum, c) => sum + (c.awakeMinutes ?? 0), 0);
  }

  return {
    ...session,
    createdByName: session.createdByUser?.name ?? null,
    lastUpdatedByName: session.lastUpdatedByUser?.name ?? null,
    sleepCycles: session.sleepCycles?.map(c => ({
      id: c.id,
      cycleNumber: c.cycleNumber,
      wokeUpAt: c.wokeUpAt,
      fellBackAsleepAt: c.fellBackAsleepAt,
      wakeType: c.wakeType,
      sleepMinutes: c.sleepMinutes,
      awakeMinutes: c.awakeMinutes,
    })),
    wakeUpCount: session.sleepCycles ? wakeUpCount : undefined,
    totalCycleSleepMinutes: session.sleepCycles ? totalCycleSleepMinutes : undefined,
    totalAwakeMinutes: session.sleepCycles ? totalAwakeMinutes : undefined,
  };
}

// Calculate total time in crib, actual sleep time, and qualified rest
//
// For CRIB naps (scheduled):
//   Qualified rest = (awake crib time ÷ 2) + actual sleep time
//   This is a sleep training methodology where rest in crib has half value
//
// For AD-HOC naps (car, stroller, etc.):
//   - Under 15 min: 0 credit (just lowers sleep pressure slightly, doesn't count)
//   - 15+ min: sleepMinutes ÷ 2 (half credit of actual sleep only)
//   - No crib time rules apply
function calculateDurations(
  putDownAt: Date | null,
  asleepAt: Date | null,
  wokeUpAt: Date | null,
  outOfCribAt: Date | null,
  isAdHoc: boolean = false
): {
  totalMinutes: number | null;
  sleepMinutes: number | null;
  settlingMinutes: number | null;
  postWakeMinutes: number | null;
  awakeCribMinutes: number | null;
  qualifiedRestMinutes: number | null;
} {
  let totalMinutes: number | null = null;
  let sleepMinutes: number | null = null;
  let settlingMinutes: number | null = null;
  let postWakeMinutes: number | null = null;
  let awakeCribMinutes: number | null = null;
  let qualifiedRestMinutes: number | null = null;

  // Total time (in crib for scheduled naps, or total duration for ad-hoc)
  if (putDownAt && outOfCribAt) {
    totalMinutes = Math.max(0, Math.round((outOfCribAt.getTime() - putDownAt.getTime()) / 60000));
  }

  // Actual sleep time
  if (asleepAt && wokeUpAt) {
    sleepMinutes = Math.max(0, Math.round((wokeUpAt.getTime() - asleepAt.getTime()) / 60000));
  }

  if (isAdHoc) {
    // Ad-hoc naps (car, stroller, etc.): simpler calculation
    // - Under 15 min: 0 credit (just lowers sleep pressure)
    // - 15+ min: half credit of actual sleep time
    // No settling/awake crib time calculations for ad-hoc naps
    if (sleepMinutes !== null) {
      if (sleepMinutes < 15) {
        qualifiedRestMinutes = 0;
      } else {
        qualifiedRestMinutes = Math.round(sleepMinutes / 2);
      }
    }
  } else {
    // Scheduled crib naps: full calculation with crib time credit

    // Settling time (put down to fell asleep)
    if (putDownAt && asleepAt) {
      settlingMinutes = Math.max(0, Math.round((asleepAt.getTime() - putDownAt.getTime()) / 60000));
    }

    // Post-wake time (woke up to out of crib)
    if (wokeUpAt && outOfCribAt) {
      postWakeMinutes = Math.max(0, Math.round((outOfCribAt.getTime() - wokeUpAt.getTime()) / 60000));
    }

    // Total awake time in crib
    if (settlingMinutes !== null || postWakeMinutes !== null) {
      awakeCribMinutes = (settlingMinutes ?? 0) + (postWakeMinutes ?? 0);
    }

    // Qualified rest = (awake crib time ÷ 2) + actual sleep
    // This gives "credit" for time spent resting in crib even if not sleeping
    // Only count explicitly tracked awake crib time (settling + post-wake)
    const actualSleep = sleepMinutes ?? 0;
    const awakeCrib = awakeCribMinutes ?? 0; // Don't guess - only use tracked time
    qualifiedRestMinutes = Math.round((awakeCrib / 2) + actualSleep);
  }

  return {
    totalMinutes,
    sleepMinutes,
    settlingMinutes,
    postWakeMinutes,
    awakeCribMinutes,
    qualifiedRestMinutes,
  };
}

export async function listSessions(
  userId: string,
  childId: string,
  query: ListSessionsQuery
): Promise<PaginatedSessions> {
  await verifyChildAccess(userId, childId);

  // Build where clause
  const where: {
    childId: string;
    createdAt?: { gte?: Date; lte?: Date };
    sessionType?: string;
    state?: string;
  } = { childId };

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) {
      where.createdAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      where.createdAt.lte = new Date(query.endDate);
    }
  }

  if (query.sessionType) {
    where.sessionType = query.sessionType;
  }

  if (query.state) {
    where.state = query.state;
  }

  // Get total count
  const total = await prisma.sleepSession.count({ where });

  // Get paginated sessions
  const skip = (query.page - 1) * query.pageSize;
  const sessions = await prisma.sleepSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: query.pageSize,
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  return {
    sessions: sessions.map(formatSession),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getSession(
  userId: string,
  childId: string,
  sessionId: string
): Promise<SleepSessionResponse | null> {
  await verifyChildAccess(userId, childId);

  const session = await prisma.sleepSession.findFirst({
    where: {
      id: sessionId,
      childId,
    },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  if (!session) {
    return null;
  }

  return formatSession(session);
}

export async function createSession(
  userId: string,
  childId: string,
  input: CreateSessionInput,
  timezone?: string
): Promise<SleepSessionResponse> {
  await verifyChildAccess(userId, childId, true);

  const putDownAt = input.putDownAt ? new Date(input.putDownAt) : new Date();

  const session = await prisma.sleepSession.create({
    data: {
      childId,
      sessionType: input.sessionType,
      state: SessionState.PENDING,
      napNumber: input.napNumber ?? null,
      putDownAt,
      notes: input.notes ?? null,
      timezone: timezone ?? null, // Store timezone for historical accuracy
      createdByUserId: userId,
      lastUpdatedByUserId: userId,
    },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  return formatSession(session);
}

export async function updateSession(
  userId: string,
  childId: string,
  sessionId: string,
  input: UpdateSessionInput
): Promise<SleepSessionResponse> {
  await verifyChildAccess(userId, childId, true);

  // Find the session with existing sleep cycles
  const session = await prisma.sleepSession.findFirst({
    where: {
      id: sessionId,
      childId,
    },
    include: {
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  if (!session) {
    throw new SessionServiceError('Session not found', 'SESSION_NOT_FOUND', 404);
  }

  const isNightSleep = session.sessionType === 'NIGHT_SLEEP';

  // Build update data - always track who made the update
  const updateData: {
    state?: string;
    putDownAt?: Date;
    asleepAt?: Date;
    wokeUpAt?: Date;
    outOfCribAt?: Date;
    cryingMinutes?: number | null;
    notes?: string | null;
    totalMinutes?: number | null;
    sleepMinutes?: number | null;
    settlingMinutes?: number | null;
    postWakeMinutes?: number | null;
    awakeCribMinutes?: number | null;
    qualifiedRestMinutes?: number | null;
    lastUpdatedByUserId?: string;
  } = {
    lastUpdatedByUserId: userId,
  };

  // Handle state transition events
  if (input.event) {
    const currentState = session.state as SessionState;
    let newState: SessionState;
    const now = new Date();

    switch (input.event) {
      case 'fell_asleep':
        newState = SessionState.ASLEEP;
        if (!isValidStateTransition(currentState, newState)) {
          throw new SessionServiceError(
            `Cannot transition from ${currentState} to ${newState}`,
            'INVALID_STATE_TRANSITION',
            400
          );
        }
        updateData.state = newState;

        const asleepTime = input.asleepAt ? new Date(input.asleepAt) : now;

        if (isNightSleep && currentState === SessionState.AWAKE) {
          // Baby fell back asleep after waking - update last wake event's fellBackAsleepAt
          const lastWakeEvent = session.sleepCycles[session.sleepCycles.length - 1];
          if (lastWakeEvent && !lastWakeEvent.fellBackAsleepAt) {
            const awakeMinutes = Math.max(0, Math.round((asleepTime.getTime() - lastWakeEvent.wokeUpAt.getTime()) / 60000));

            await prisma.sleepCycle.update({
              where: { id: lastWakeEvent.id },
              data: {
                fellBackAsleepAt: asleepTime,
                awakeMinutes,
              },
            });
          }
        } else if (currentState === SessionState.PENDING) {
          // First time falling asleep - just set session.asleepAt
          updateData.asleepAt = asleepTime;
        } else if (!isNightSleep && currentState !== SessionState.AWAKE) {
          // For naps, set asleepAt
          updateData.asleepAt = asleepTime;
        }

        // Clear wokeUpAt since baby is asleep again (for naps)
        if (!isNightSleep) {
          updateData.wokeUpAt = null as unknown as Date;
        }
        break;

      case 'woke_up':
        const wokeUpTime = input.wokeUpAt ? new Date(input.wokeUpAt) : now;

        // For ad-hoc naps, woke_up goes directly to COMPLETED
        if (session.isAdHoc) {
          newState = SessionState.COMPLETED;
          if (!isValidStateTransition(currentState, newState)) {
            throw new SessionServiceError(
              `Cannot transition from ${currentState} to ${newState}`,
              'INVALID_STATE_TRANSITION',
              400
            );
          }
          updateData.state = newState;
          updateData.wokeUpAt = wokeUpTime;
          updateData.outOfCribAt = wokeUpTime;
        } else {
          // Regular crib nap/night sleep - go to AWAKE state
          newState = SessionState.AWAKE;
          if (!isValidStateTransition(currentState, newState)) {
            throw new SessionServiceError(
              `Cannot transition from ${currentState} to ${newState}`,
              'INVALID_STATE_TRANSITION',
              400
            );
          }
          updateData.state = newState;
          updateData.wokeUpAt = wokeUpTime;

          // For night sleep, create a wake event
          // Sleep duration will be calculated by recalculateSessionFromCycles
          if (isNightSleep) {
            const cycleCount = session.sleepCycles.length;
            await prisma.sleepCycle.create({
              data: {
                sessionId: session.id,
                cycleNumber: cycleCount + 1,
                wokeUpAt: wokeUpTime,
                wakeType: 'QUIET',
              },
            });
          }
        }
        break;

      case 'out_of_crib':
        newState = SessionState.COMPLETED;
        if (!isValidStateTransition(currentState, newState)) {
          throw new SessionServiceError(
            `Cannot transition from ${currentState} to ${newState}`,
            'INVALID_STATE_TRANSITION',
            400
          );
        }
        updateData.state = newState;
        updateData.outOfCribAt = input.outOfCribAt ? new Date(input.outOfCribAt) : now;

        // If coming from ASLEEP state (baby was still asleep), set wokeUpAt to outOfCribAt
        if (currentState === SessionState.ASLEEP && !session.wokeUpAt) {
          updateData.wokeUpAt = updateData.outOfCribAt;
        }
        break;
    }
  }

  // Handle direct field updates (for corrections)
  if (input.putDownAt) {
    updateData.putDownAt = new Date(input.putDownAt);
  }

  if (input.asleepAt) {
    updateData.asleepAt = new Date(input.asleepAt);
  }

  if (input.wokeUpAt) {
    updateData.wokeUpAt = new Date(input.wokeUpAt);
  }

  if (input.outOfCribAt) {
    updateData.outOfCribAt = new Date(input.outOfCribAt);
  }

  if (input.cryingMinutes !== undefined) {
    updateData.cryingMinutes = input.cryingMinutes;
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  // Calculate durations
  // For night sleep with cycles, calculate from cycles
  // For naps, use the simple calculation
  const finalPutDownAt = updateData.putDownAt ?? session.putDownAt;
  const finalAsleepAt = updateData.asleepAt ?? session.asleepAt;
  const finalWokeUpAt = updateData.wokeUpAt ?? session.wokeUpAt;
  const finalOutOfCribAt = updateData.outOfCribAt ?? session.outOfCribAt;

  if (isNightSleep && session.sleepCycles.length > 0) {
    // Fetch updated cycles
    const cycles = await prisma.sleepCycle.findMany({
      where: { sessionId: session.id },
      orderBy: { cycleNumber: 'asc' },
    });

    // Calculate total sleep from all cycles
    let totalSleepMinutes = 0;
    let totalAwakeMinutes = 0;

    for (const cycle of cycles) {
      totalSleepMinutes += cycle.sleepMinutes ?? 0;
      totalAwakeMinutes += cycle.awakeMinutes ?? 0;
    }

    updateData.sleepMinutes = totalSleepMinutes;
    updateData.awakeCribMinutes = totalAwakeMinutes;

    // Total time in crib
    if (finalPutDownAt && finalOutOfCribAt) {
      updateData.totalMinutes = Math.max(0, Math.round((finalOutOfCribAt.getTime() - finalPutDownAt.getTime()) / 60000));
    }

    // Settling time (put down to first asleep) - uses session.asleepAt, not cycle data
    if (finalPutDownAt && finalAsleepAt) {
      updateData.settlingMinutes = Math.max(0, Math.round((finalAsleepAt.getTime() - finalPutDownAt.getTime()) / 60000));
    }

    // Post wake time (last cycle woke up to out of crib)
    const lastCycle = cycles[cycles.length - 1];
    if (lastCycle?.wokeUpAt && finalOutOfCribAt) {
      updateData.postWakeMinutes = Math.max(0, Math.round((finalOutOfCribAt.getTime() - lastCycle.wokeUpAt.getTime()) / 60000));
    }

    // Qualified rest for night sleep
    const awakeCrib = (updateData.settlingMinutes ?? 0) + (updateData.postWakeMinutes ?? 0) + totalAwakeMinutes;
    updateData.awakeCribMinutes = awakeCrib;
    updateData.qualifiedRestMinutes = Math.round((awakeCrib / 2) + totalSleepMinutes);
  } else {
    // For naps, use the simple calculation
    const durations = calculateDurations(
      finalPutDownAt,
      finalAsleepAt,
      finalWokeUpAt,
      finalOutOfCribAt,
      session.isAdHoc
    );

    if (durations.totalMinutes !== null) {
      updateData.totalMinutes = durations.totalMinutes;
    }

    if (durations.sleepMinutes !== null) {
      updateData.sleepMinutes = durations.sleepMinutes;
    }

    if (durations.settlingMinutes !== null) {
      updateData.settlingMinutes = durations.settlingMinutes;
    }

    if (durations.postWakeMinutes !== null) {
      updateData.postWakeMinutes = durations.postWakeMinutes;
    }

    if (durations.awakeCribMinutes !== null) {
      updateData.awakeCribMinutes = durations.awakeCribMinutes;
    }

    if (durations.qualifiedRestMinutes !== null) {
      updateData.qualifiedRestMinutes = durations.qualifiedRestMinutes;
    }
  }

  // Update the session
  const updatedSession = await prisma.sleepSession.update({
    where: { id: sessionId },
    data: updateData,
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  return formatSession(updatedSession);
}

export async function deleteSession(
  userId: string,
  childId: string,
  sessionId: string
): Promise<void> {
  await verifyChildAccess(userId, childId, true);

  // Find the session
  const session = await prisma.sleepSession.findFirst({
    where: {
      id: sessionId,
      childId,
    },
  });

  if (!session) {
    throw new SessionServiceError('Session not found', 'SESSION_NOT_FOUND', 404);
  }

  await prisma.sleepSession.delete({
    where: { id: sessionId },
  });
}

export async function getActiveSession(
  userId: string,
  childId: string
): Promise<SleepSessionResponse | null> {
  await verifyChildAccess(userId, childId);

  // Find any session that's not completed (PENDING, ASLEEP, or AWAKE)
  const session = await prisma.sleepSession.findFirst({
    where: {
      childId,
      state: {
        not: SessionState.COMPLETED,
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  if (!session) {
    return null;
  }

  return formatSession(session);
}

// Create an ad-hoc nap (car, stroller, etc.)
// Two modes:
// 1. Start mode: Just location + asleepAt - creates session in ASLEEP state for real-time tracking
// 2. Complete mode: location + asleepAt + wokeUpAt - creates completed session (logged after the fact)
export async function createAdHocSession(
  userId: string,
  childId: string,
  input: {
    location: string;
    asleepAt: string;
    wokeUpAt?: string; // Optional - if not provided, starts in ASLEEP state
    notes?: string;
  },
  timezone?: string
): Promise<SleepSessionResponse> {
  await verifyChildAccess(userId, childId, true);

  const asleepAt = new Date(input.asleepAt);

  // If wokeUpAt is provided, create a completed session
  if (input.wokeUpAt) {
    const wokeUpAt = new Date(input.wokeUpAt);

    // Calculate durations for the ad-hoc nap
    const durations = calculateDurations(
      asleepAt, // For ad-hoc, putDown = asleep (no settling)
      asleepAt,
      wokeUpAt,
      wokeUpAt, // For ad-hoc, outOfCrib = woke up (no post-wake in crib)
      true // isAdHoc = true
    );

    const session = await prisma.sleepSession.create({
      data: {
        childId,
        sessionType: 'NAP',
        state: SessionState.COMPLETED,
        napNumber: null, // Ad-hoc naps don't count as nap 1/2
        isAdHoc: true,
        location: input.location,
        putDownAt: asleepAt,
        asleepAt,
        wokeUpAt,
        outOfCribAt: wokeUpAt,
        notes: input.notes ?? null,
        timezone: timezone ?? null, // Store timezone for historical accuracy
        totalMinutes: durations.totalMinutes,
        sleepMinutes: durations.sleepMinutes,
        settlingMinutes: 0,
        postWakeMinutes: 0,
        awakeCribMinutes: 0,
        qualifiedRestMinutes: durations.qualifiedRestMinutes,
        createdByUserId: userId,
        lastUpdatedByUserId: userId,
      },
      include: {
        createdByUser: { select: { id: true, name: true, email: true } },
        lastUpdatedByUser: { select: { id: true, name: true, email: true } },
        sleepCycles: { orderBy: { cycleNumber: 'asc' } },
      },
    });

    return formatSession(session);
  }

  // No wokeUpAt - start an ad-hoc nap in ASLEEP state (real-time tracking)
  const session = await prisma.sleepSession.create({
    data: {
      childId,
      sessionType: 'NAP',
      state: SessionState.ASLEEP,
      napNumber: null, // Ad-hoc naps don't count as nap 1/2
      isAdHoc: true,
      location: input.location,
      putDownAt: asleepAt, // For ad-hoc, putDown = asleep
      asleepAt,
      notes: input.notes ?? null,
      timezone: timezone ?? null, // Store timezone for historical accuracy
      createdByUserId: userId,
      lastUpdatedByUserId: userId,
    },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  return formatSession(session);
}

// Recalculate qualifiedRestMinutes for today's sessions
// Used to fix sessions after a calculation bug fix
export async function recalculateTodaySessions(
  userId: string,
  childId: string,
  timezone: string = 'America/New_York'
): Promise<{ recalculated: number; sessions: Array<{ id: string; oldQualifiedRest: number | null; newQualifiedRest: number | null }> }> {
  await verifyChildAccess(userId, childId, true);

  // Use user's timezone for "today" boundaries
  const nowInUserTz = toZonedTime(new Date(), timezone);
  const todayStartInUserTz = startOfDay(nowInUserTz);
  const today = fromZonedTime(todayStartInUserTz, timezone);
  const tomorrow = fromZonedTime(addDays(todayStartInUserTz, 1), timezone);

  // Get today's completed NAP sessions
  const sessions = await prisma.sleepSession.findMany({
    where: {
      childId,
      sessionType: 'NAP',
      state: SessionState.COMPLETED,
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  const results: Array<{ id: string; oldQualifiedRest: number | null; newQualifiedRest: number | null }> = [];

  for (const session of sessions) {
    const oldQualifiedRest = session.qualifiedRestMinutes;

    // Recalculate durations
    const durations = calculateDurations(
      session.putDownAt,
      session.asleepAt,
      session.wokeUpAt,
      session.outOfCribAt,
      session.isAdHoc
    );

    // Update the session
    await prisma.sleepSession.update({
      where: { id: session.id },
      data: {
        settlingMinutes: durations.settlingMinutes,
        postWakeMinutes: durations.postWakeMinutes,
        awakeCribMinutes: durations.awakeCribMinutes,
        qualifiedRestMinutes: durations.qualifiedRestMinutes,
      },
    });

    results.push({
      id: session.id,
      oldQualifiedRest,
      newQualifiedRest: durations.qualifiedRestMinutes,
    });
  }

  return { recalculated: results.length, sessions: results };
}

export async function getDailySummary(
  userId: string,
  childId: string,
  date: string
): Promise<{
  date: string;
  totalSleepMinutes: number;
  napCount: number;
  nightSleepMinutes: number;
  nightWakeCount: number;
  totalAwakeMinutes: number;
  sessions: SleepSessionResponse[];
}> {
  await verifyChildAccess(userId, childId);

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const sessions = await prisma.sleepSession.findMany({
    where: {
      childId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
      sleepCycles: { orderBy: { cycleNumber: 'asc' } },
    },
  });

  let totalSleepMinutes = 0;
  let napCount = 0;
  let nightSleepMinutes = 0;
  let nightWakeCount = 0;
  let totalAwakeMinutes = 0;

  for (const session of sessions) {
    if (session.sleepMinutes) {
      totalSleepMinutes += session.sleepMinutes;

      if (session.sessionType === 'NAP') {
        napCount++;
      } else if (session.sessionType === 'NIGHT_SLEEP') {
        nightSleepMinutes += session.sleepMinutes;
        // Count wake-ups from sleep cycles (excluding the final wake)
        if (session.sleepCycles && session.sleepCycles.length > 1) {
          nightWakeCount += session.sleepCycles.length - 1;
        }
        // Sum up awake time during night
        if (session.sleepCycles) {
          for (const cycle of session.sleepCycles) {
            totalAwakeMinutes += cycle.awakeMinutes ?? 0;
          }
        }
      }
    }
  }

  return {
    date,
    totalSleepMinutes,
    napCount,
    nightSleepMinutes,
    nightWakeCount,
    totalAwakeMinutes,
    sessions: sessions.map(formatSession),
  };
}

// =====================================================
// Sleep Cycle CRUD Operations (for retroactive editing)
// =====================================================

// Calculate qualified rest accounting for wakeType
// QUIET wake periods: 50% credit (existing behavior)
// RESTLESS/CRYING wake periods: 0% credit
function calculateQualifiedRestWithCycles(
  cycles: Array<{
    sleepMinutes: number | null;
    awakeMinutes: number | null;
    wakeType: string;
  }>,
  settlingMinutes: number,
  postWakeMinutes: number
): number {
  let totalSleepMinutes = 0;
  let qualifiedAwakeMinutes = 0;

  for (const cycle of cycles) {
    totalSleepMinutes += cycle.sleepMinutes ?? 0;

    // Only count awake time for QUIET periods (50% credit)
    // RESTLESS and CRYING get 0% credit
    if (cycle.wakeType === WakeType.QUIET) {
      qualifiedAwakeMinutes += cycle.awakeMinutes ?? 0;
    }
  }

  // Settling and post-wake time always get 50% credit
  const totalAwakeCrib = qualifiedAwakeMinutes + settlingMinutes + postWakeMinutes;

  return Math.round(totalAwakeCrib / 2 + totalSleepMinutes);
}

// Recalculate session durations from wake events (cycles)
// Wake events are ordered by wokeUpAt time. Sleep periods are calculated as:
// - First sleep: session.asleepAt → first cycle.wokeUpAt
// - Between wakes: previous cycle.fellBackAsleepAt → current cycle.wokeUpAt
// - Final sleep (if applicable): last cycle.fellBackAsleepAt → session.wokeUpAt
async function recalculateSessionFromCycles(
  sessionId: string,
  userId: string
): Promise<void> {
  const session = await prisma.sleepSession.findUnique({
    where: { id: sessionId },
    include: { sleepCycles: { orderBy: { wokeUpAt: 'asc' } } },
  });

  if (!session) return;

  const cycles = session.sleepCycles;

  if (cycles.length === 0) {
    // No wake events - use session timestamps directly
    const durations = calculateDurations(
      session.putDownAt,
      session.asleepAt,
      session.wokeUpAt,
      session.outOfCribAt,
      session.isAdHoc
    );

    await prisma.sleepSession.update({
      where: { id: sessionId },
      data: {
        sleepMinutes: durations.sleepMinutes,
        settlingMinutes: durations.settlingMinutes,
        postWakeMinutes: durations.postWakeMinutes,
        awakeCribMinutes: durations.awakeCribMinutes,
        qualifiedRestMinutes: durations.qualifiedRestMinutes,
        lastUpdatedByUserId: userId,
      },
    });
    return;
  }

  // Calculate sleep and awake durations for each wake event
  let totalSleepMinutes = 0;

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    if (!cycle) continue;

    // Determine when sleep started before this wake
    let sleepStartTime: Date | null;
    if (i === 0) {
      // First wake - sleep started at session.asleepAt
      sleepStartTime = session.asleepAt;
    } else {
      // Subsequent wake - sleep started when they fell back asleep after previous wake
      const prevCycle = cycles[i - 1];
      sleepStartTime = prevCycle?.fellBackAsleepAt ?? null;
    }

    // Calculate sleep duration before this wake
    let sleepMinutes: number | null = null;
    if (sleepStartTime) {
      sleepMinutes = Math.max(
        0,
        Math.round((cycle.wokeUpAt.getTime() - sleepStartTime.getTime()) / 60000)
      );
      totalSleepMinutes += sleepMinutes;
    }

    // Calculate awake duration for this wake event
    let awakeMinutes: number | null = null;
    if (cycle.fellBackAsleepAt) {
      awakeMinutes = Math.max(
        0,
        Math.round((cycle.fellBackAsleepAt.getTime() - cycle.wokeUpAt.getTime()) / 60000)
      );
    }

    // Update cycle with calculated durations
    await prisma.sleepCycle.update({
      where: { id: cycle.id },
      data: { sleepMinutes, awakeMinutes, cycleNumber: i + 1 },
    });
  }

  // Check if there's final sleep after last wake event
  const lastCycle = cycles[cycles.length - 1];
  if (lastCycle?.fellBackAsleepAt && session.wokeUpAt) {
    // Baby fell back asleep and then had final wake at session.wokeUpAt
    const finalSleepMinutes = Math.max(
      0,
      Math.round((session.wokeUpAt.getTime() - lastCycle.fellBackAsleepAt.getTime()) / 60000)
    );
    totalSleepMinutes += finalSleepMinutes;
  }

  // Settling time: put down to first asleep (session level, unchanged)
  const settlingMinutes = session.putDownAt && session.asleepAt
    ? Math.max(0, Math.round((session.asleepAt.getTime() - session.putDownAt.getTime()) / 60000))
    : 0;

  // Post-wake time: final wake to out of crib
  // If there are wake events, the "final wake" might be the last cycle if they didn't fall back asleep
  // Or it's session.wokeUpAt if they fell back asleep after last wake event
  let postWakeMinutes = 0;
  const finalWakeTime = (lastCycle && !lastCycle.fellBackAsleepAt)
    ? lastCycle.wokeUpAt  // Last wake event was the final wake
    : session.wokeUpAt;   // They fell back asleep, so session.wokeUpAt is final wake

  if (finalWakeTime && session.outOfCribAt) {
    postWakeMinutes = Math.max(
      0,
      Math.round((session.outOfCribAt.getTime() - finalWakeTime.getTime()) / 60000)
    );
  }

  // Refetch cycles with updated values
  const updatedCycles = await prisma.sleepCycle.findMany({
    where: { sessionId },
    orderBy: { wokeUpAt: 'asc' },
  });

  // Calculate total awake time in crib (from wake events)
  let wakeEventAwakeMinutes = 0;
  for (const cycle of updatedCycles) {
    wakeEventAwakeMinutes += cycle.awakeMinutes ?? 0;
  }
  const awakeCribMinutes = settlingMinutes + postWakeMinutes + wakeEventAwakeMinutes;

  // Calculate qualified rest with wakeType consideration
  const qualifiedRestMinutes = calculateQualifiedRestWithCycles(
    updatedCycles,
    settlingMinutes,
    postWakeMinutes
  );

  // Update session with calculated values
  await prisma.sleepSession.update({
    where: { id: sessionId },
    data: {
      sleepMinutes: totalSleepMinutes,
      settlingMinutes,
      postWakeMinutes,
      awakeCribMinutes,
      qualifiedRestMinutes,
      lastUpdatedByUserId: userId,
    },
  });
}

// Create a wake event (sleep cycle)
// A wake event represents when the baby woke up during the sleep session.
// The system auto-calculates sleep durations from the timeline.
export async function createSleepCycle(
  userId: string,
  childId: string,
  sessionId: string,
  input: CreateSleepCycleInput
): Promise<SleepCycleResponse> {
  await verifyChildAccess(userId, childId, true);

  const session = await prisma.sleepSession.findFirst({
    where: { id: sessionId, childId },
  });

  if (!session) {
    throw new SessionServiceError('Session not found', 'SESSION_NOT_FOUND', 404);
  }

  const wokeUpAt = new Date(input.wokeUpAt);
  const fellBackAsleepAt = input.fellBackAsleepAt ? new Date(input.fellBackAsleepAt) : null;

  // Create the wake event
  const cycle = await prisma.sleepCycle.create({
    data: {
      sessionId,
      cycleNumber: 0, // Will be renumbered by recalculate
      wokeUpAt,
      fellBackAsleepAt,
      wakeType: input.wakeType ?? WakeType.QUIET,
    },
  });

  // Recalculate session durations (this also renumbers cycles by wokeUpAt order)
  await recalculateSessionFromCycles(sessionId, userId);

  // Fetch the updated cycle
  const updatedCycle = await prisma.sleepCycle.findUnique({
    where: { id: cycle.id },
  });

  if (!updatedCycle) {
    throw new SessionServiceError('Cycle not found after creation', 'CYCLE_NOT_FOUND', 404);
  }

  return {
    id: updatedCycle.id,
    cycleNumber: updatedCycle.cycleNumber,
    wokeUpAt: updatedCycle.wokeUpAt,
    fellBackAsleepAt: updatedCycle.fellBackAsleepAt,
    wakeType: updatedCycle.wakeType,
    sleepMinutes: updatedCycle.sleepMinutes,
    awakeMinutes: updatedCycle.awakeMinutes,
  };
}

// Update a wake event (sleep cycle)
export async function updateSleepCycle(
  userId: string,
  childId: string,
  sessionId: string,
  cycleId: string,
  input: UpdateSleepCycleInput
): Promise<SleepCycleResponse> {
  await verifyChildAccess(userId, childId, true);

  const cycle = await prisma.sleepCycle.findFirst({
    where: { id: cycleId, sessionId },
    include: { session: true },
  });

  if (!cycle || cycle.session.childId !== childId) {
    throw new SessionServiceError('Cycle not found', 'CYCLE_NOT_FOUND', 404);
  }

  const updateData: {
    wokeUpAt?: Date;
    fellBackAsleepAt?: Date | null;
    wakeType?: string;
  } = {};

  if (input.wokeUpAt) {
    updateData.wokeUpAt = new Date(input.wokeUpAt);
  }

  if (input.fellBackAsleepAt !== undefined) {
    updateData.fellBackAsleepAt = input.fellBackAsleepAt ? new Date(input.fellBackAsleepAt) : null;
  }

  if (input.wakeType) {
    updateData.wakeType = input.wakeType;
  }

  await prisma.sleepCycle.update({
    where: { id: cycleId },
    data: updateData,
  });

  // Recalculate session durations (this also renumbers cycles by wokeUpAt order)
  await recalculateSessionFromCycles(sessionId, userId);

  // Fetch updated cycle
  const finalCycle = await prisma.sleepCycle.findUnique({
    where: { id: cycleId },
  });

  if (!finalCycle) {
    throw new SessionServiceError('Cycle not found after update', 'CYCLE_NOT_FOUND', 404);
  }

  return {
    id: finalCycle.id,
    cycleNumber: finalCycle.cycleNumber,
    wokeUpAt: finalCycle.wokeUpAt,
    fellBackAsleepAt: finalCycle.fellBackAsleepAt,
    wakeType: finalCycle.wakeType,
    sleepMinutes: finalCycle.sleepMinutes,
    awakeMinutes: finalCycle.awakeMinutes,
  };
}

// Delete a wake event (sleep cycle)
export async function deleteSleepCycle(
  userId: string,
  childId: string,
  sessionId: string,
  cycleId: string
): Promise<void> {
  await verifyChildAccess(userId, childId, true);

  const cycle = await prisma.sleepCycle.findFirst({
    where: { id: cycleId, sessionId },
    include: { session: true },
  });

  if (!cycle || cycle.session.childId !== childId) {
    throw new SessionServiceError('Cycle not found', 'CYCLE_NOT_FOUND', 404);
  }

  await prisma.sleepCycle.delete({ where: { id: cycleId } });

  // Recalculate session durations (this also renumbers remaining cycles)
  await recalculateSessionFromCycles(sessionId, userId);
}
