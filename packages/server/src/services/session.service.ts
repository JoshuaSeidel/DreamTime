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

  if (!relation || relation.status !== InviteStatus.ACCEPTED) {
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

function formatSession(session: {
  id: string;
  childId: string;
  sessionType: string;
  state: string;
  napNumber: number | null;
  putDownAt: Date | null;
  asleepAt: Date | null;
  wokeUpAt: Date | null;
  outOfCribAt: Date | null;
  cryingMinutes: number | null;
  notes: string | null;
  totalMinutes: number | null;
  sleepMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}): SleepSessionResponse {
  return session;
}

// Calculate total time in crib and actual sleep time
function calculateDurations(
  putDownAt: Date | null,
  asleepAt: Date | null,
  wokeUpAt: Date | null,
  outOfCribAt: Date | null
): { totalMinutes: number | null; sleepMinutes: number | null } {
  let totalMinutes: number | null = null;
  let sleepMinutes: number | null = null;

  if (putDownAt && outOfCribAt) {
    totalMinutes = Math.round((outOfCribAt.getTime() - putDownAt.getTime()) / 60000);
  }

  if (asleepAt && wokeUpAt) {
    sleepMinutes = Math.round((wokeUpAt.getTime() - asleepAt.getTime()) / 60000);
  }

  return { totalMinutes, sleepMinutes };
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

  // Build update data
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
  } = {};

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
        updateData.asleepAt = input.asleepAt ? new Date(input.asleepAt) : now;
        break;

      case 'woke_up':
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

  const { totalMinutes, sleepMinutes } = calculateDurations(
    finalPutDownAt,
    finalAsleepAt,
    finalWokeUpAt,
    finalOutOfCribAt
  );

  if (totalMinutes !== null) {
    updateData.totalMinutes = totalMinutes;
  }

  if (sleepMinutes !== null) {
    updateData.sleepMinutes = sleepMinutes;
  }

  // Update the session
  const updatedSession = await prisma.sleepSession.update({
    where: { id: sessionId },
    data: updateData,
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
  });

  if (!session) {
    return null;
  }

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
