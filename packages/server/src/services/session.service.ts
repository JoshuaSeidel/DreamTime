import { prisma } from '../config/database.js';
import { startOfDay, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  Role,
  SessionState,
  InviteStatus,
  isValidStateTransition,
} from '../types/enums.js';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsQuery,
  SleepSessionResponse,
  PaginatedSessions,
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

// Sleep cycle interface for responses
interface SleepCycleResponse {
  id: string;
  cycleNumber: number;
  asleepAt: Date;
  wokeUpAt: Date | null;
  sleepMinutes: number | null;
  awakeMinutes: number | null;
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
    asleepAt: Date;
    wokeUpAt: Date | null;
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
  // Calculate totals from sleep cycles if present
  let wakeUpCount = 0;
  let totalCycleSleepMinutes = 0;
  let totalAwakeMinutes = 0;

  if (session.sleepCycles && session.sleepCycles.length > 0) {
    wakeUpCount = session.sleepCycles.filter(c => c.wokeUpAt !== null).length;
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
      asleepAt: c.asleepAt,
      wokeUpAt: c.wokeUpAt,
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

        if (isNightSleep) {
          // For night sleep, create a new sleep cycle
          const lastCycle = session.sleepCycles[session.sleepCycles.length - 1];

          if (currentState === SessionState.AWAKE && lastCycle && lastCycle.wokeUpAt) {
            // Baby fell back asleep after waking - update last cycle's awake time and create new cycle
            const awakeMinutes = Math.max(0, Math.round((asleepTime.getTime() - lastCycle.wokeUpAt.getTime()) / 60000));

            await prisma.sleepCycle.update({
              where: { id: lastCycle.id },
              data: { awakeMinutes },
            });

            // Create a new cycle for this sleep period
            const newCycleNumber = lastCycle.cycleNumber + 1;
            await prisma.sleepCycle.create({
              data: {
                sessionId: session.id,
                cycleNumber: newCycleNumber,
                asleepAt: asleepTime,
              },
            });
          } else if (currentState === SessionState.PENDING) {
            // First time falling asleep - create first cycle
            await prisma.sleepCycle.create({
              data: {
                sessionId: session.id,
                cycleNumber: 1,
                asleepAt: asleepTime,
              },
            });
            updateData.asleepAt = asleepTime;
          }
        } else {
          // For naps, keep the simple approach
          if (currentState !== SessionState.AWAKE) {
            updateData.asleepAt = asleepTime;
          }
          // Clear wokeUpAt since baby is asleep again
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

          if (isNightSleep) {
            // Update the current cycle with woke up time and calculate sleep duration
            const lastCycle = session.sleepCycles[session.sleepCycles.length - 1];
            if (lastCycle && !lastCycle.wokeUpAt) {
              const sleepMinutes = Math.max(0, Math.round((wokeUpTime.getTime() - lastCycle.asleepAt.getTime()) / 60000));

              await prisma.sleepCycle.update({
                where: { id: lastCycle.id },
                data: {
                  wokeUpAt: wokeUpTime,
                  sleepMinutes,
                },
              });
            }
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

        // For night sleep, finalize any open cycle
        if (isNightSleep) {
          const lastCycle = session.sleepCycles[session.sleepCycles.length - 1];
          if (lastCycle && !lastCycle.wokeUpAt && updateData.outOfCribAt) {
            // Baby was still asleep when taken out - record final wake
            const sleepMinutes = Math.max(0, Math.round((updateData.outOfCribAt.getTime() - lastCycle.asleepAt.getTime()) / 60000));

            await prisma.sleepCycle.update({
              where: { id: lastCycle.id },
              data: {
                wokeUpAt: updateData.outOfCribAt,
                sleepMinutes,
              },
            });
          }
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

    // Settling time (first put down to first asleep)
    if (finalPutDownAt && cycles[0]) {
      updateData.settlingMinutes = Math.max(0, Math.round((cycles[0].asleepAt.getTime() - finalPutDownAt.getTime()) / 60000));
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
