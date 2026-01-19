import { prisma } from '../config/database.js';
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
  createdAt: Date;
  updatedAt: Date;
}

function formatSession(session: SessionWithUserInfo): SleepSessionResponse & {
  createdByUserId?: string | null;
  lastUpdatedByUserId?: string | null;
  createdByName?: string | null;
  lastUpdatedByName?: string | null;
} {
  return {
    ...session,
    createdByName: session.createdByUser?.name ?? null,
    lastUpdatedByName: session.lastUpdatedByUser?.name ?? null,
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
  input: CreateSessionInput
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
      createdByUserId: userId,
      lastUpdatedByUserId: userId,
    },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
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
        // Brief wake handling: If coming from AWAKE state (baby fell back asleep),
        // don't overwrite the original asleepAt - preserve it for accurate sleep duration
        if (currentState !== SessionState.AWAKE) {
          updateData.asleepAt = input.asleepAt ? new Date(input.asleepAt) : now;
        }
        // Clear wokeUpAt since baby is asleep again (brief wake is excluded)
        updateData.wokeUpAt = null as unknown as Date;
        break;

      case 'woke_up':
        // For ad-hoc naps (car, stroller, etc.), woke_up goes directly to COMPLETED
        // since there's no "awake in crib" phase - baby is just done sleeping
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
          const wokeUpTime = input.wokeUpAt ? new Date(input.wokeUpAt) : now;
          updateData.wokeUpAt = wokeUpTime;
          updateData.outOfCribAt = wokeUpTime; // For ad-hoc, outOfCrib = wokeUp
        } else {
          // Regular crib nap - go to AWAKE state (baby still in crib)
          newState = SessionState.AWAKE;
          if (!isValidStateTransition(currentState, newState)) {
            throw new SessionServiceError(
              `Cannot transition from ${currentState} to ${newState}`,
              'INVALID_STATE_TRANSITION',
              400
            );
          }
          updateData.state = newState;
          updateData.wokeUpAt = input.wokeUpAt ? new Date(input.wokeUpAt) : now;
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

  // Calculate durations if we have enough data
  const finalPutDownAt = updateData.putDownAt ?? session.putDownAt;
  const finalAsleepAt = updateData.asleepAt ?? session.asleepAt;
  const finalWokeUpAt = updateData.wokeUpAt ?? session.wokeUpAt;
  const finalOutOfCribAt = updateData.outOfCribAt ?? session.outOfCribAt;

  const durations = calculateDurations(
    finalPutDownAt,
    finalAsleepAt,
    finalWokeUpAt,
    finalOutOfCribAt,
    session.isAdHoc // Pass ad-hoc flag for different calculation
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

  // Update the session
  const updatedSession = await prisma.sleepSession.update({
    where: { id: sessionId },
    data: updateData,
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
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
  }
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
      createdByUserId: userId,
      lastUpdatedByUserId: userId,
    },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      lastUpdatedByUser: { select: { id: true, name: true, email: true } },
    },
  });

  return formatSession(session);
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
    },
  });

  let totalSleepMinutes = 0;
  let napCount = 0;
  let nightSleepMinutes = 0;

  for (const session of sessions) {
    if (session.sleepMinutes) {
      totalSleepMinutes += session.sleepMinutes;

      if (session.sessionType === 'NAP') {
        napCount++;
      } else if (session.sessionType === 'NIGHT_SLEEP') {
        nightSleepMinutes += session.sleepMinutes;
      }
    }
  }

  return {
    date,
    totalSleepMinutes,
    napCount,
    nightSleepMinutes,
    sessions: sessions.map(formatSession),
  };
}
