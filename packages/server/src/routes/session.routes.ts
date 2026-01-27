import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createSessionSchema,
  updateSessionSchema,
  listSessionsQuerySchema,
  createAdHocSessionSchema,
  createSleepCycleSchema,
  updateSleepCycleSchema,
  type CreateSessionInput,
  type UpdateSessionInput,
  type ListSessionsQuery,
  type CreateAdHocSessionInput,
  type CreateSleepCycleInput,
  type UpdateSleepCycleInput,
} from '../schemas/session.schema.js';
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getActiveSession,
  getDailySummary,
  createAdHocSession,
  recalculateTodaySessions,
  createSleepCycle,
  updateSleepCycle,
  deleteSleepCycle,
  SessionServiceError,
} from '../services/session.service.js';
import { successResponse, errorResponse } from '../types/api.js';
import { publishState, isMqttEnabled } from '../services/mqtt.service.js';
import { prisma } from '../config/database.js';

// Helper to get user timezone
// Prefers X-Timezone header (device timezone) over stored profile timezone
// This allows the app to work correctly when traveling
async function getUserTimezone(userId: string, headerTimezone?: string): Promise<string> {
  // If client sent device timezone, use it (supports traveling)
  if (headerTimezone && isValidTimezone(headerTimezone)) {
    return headerTimezone;
  }

  // Fall back to stored user preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return user?.timezone ?? 'America/New_York';
}

// Validate timezone string is a valid IANA timezone
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // List sessions with pagination and filtering
  app.get<{ Params: { childId: string }; Querystring: ListSessionsQuery }>(
    '/:childId/sessions',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'List sleep sessions for a child',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            sessionType: { type: 'string', enum: ['NAP', 'NIGHT_SLEEP'] },
            state: { type: 'string', enum: ['PENDING', 'ASLEEP', 'AWAKE', 'COMPLETED'] },
            page: { type: 'number', default: 1 },
            pageSize: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Querystring: ListSessionsQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const query = listSessionsQuerySchema.parse(request.query);

        const result = await listSessions(userId, childId, query);

        return reply.send({
          success: true,
          data: result.sessions,
          pagination: result.pagination,
        });
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get active (non-completed) session
  app.get<{ Params: { childId: string } }>(
    '/:childId/sessions/active',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get active (non-completed) session',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { childId: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;

        const session = await getActiveSession(userId, childId);

        if (!session) {
          return reply.status(404).send(
            errorResponse('NO_ACTIVE_SESSION', 'No active session found')
          );
        }

        return reply.send(successResponse(session));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get daily summary
  app.get<{ Params: { childId: string }; Querystring: { date: string } }>(
    '/:childId/sessions/summary',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get daily sleep summary',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        querystring: {
          type: 'object',
          properties: {
            date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
          required: ['date'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Querystring: { date: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const { date } = request.query;

        const summary = await getDailySummary(userId, childId, date);

        return reply.send(successResponse(summary));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get a specific session
  app.get<{ Params: { childId: string; sessionId: string } }>(
    '/:childId/sessions/:sessionId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get a specific sleep session',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['childId', 'sessionId'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string; sessionId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId, sessionId } = request.params;

        const session = await getSession(userId, childId, sessionId);

        if (!session) {
          return reply.status(404).send(
            errorResponse('SESSION_NOT_FOUND', 'Session not found')
          );
        }

        return reply.send(successResponse(session));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Create a new session (put down)
  app.post<{ Params: { childId: string }; Body: CreateSessionInput }>(
    '/:childId/sessions',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Create a new sleep session (put down)',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        body: {
          type: 'object',
          required: ['sessionType'],
          properties: {
            sessionType: { type: 'string', enum: ['NAP', 'NIGHT_SLEEP'] },
            napNumber: { type: 'number', minimum: 1, maximum: 3 },
            putDownAt: { type: 'string', format: 'date-time' },
            notes: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: CreateSessionInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = createSessionSchema.parse(request.body);

        // Get device timezone from header for storing with session
        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);

        const session = await createSession(userId, childId, input, timezone);

        // Publish state change to MQTT for Home Assistant
        if (isMqttEnabled()) {
          publishState(childId).catch((err) => {
            request.log.error('Failed to publish MQTT state:', err);
          });
        }

        return reply.status(201).send(successResponse(session));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Update a session (state transition or correction)
  app.patch<{ Params: { childId: string; sessionId: string }; Body: UpdateSessionInput }>(
    '/:childId/sessions/:sessionId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update a sleep session (state transition or correction)',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['childId', 'sessionId'],
        },
        body: {
          type: 'object',
          properties: {
            event: { type: 'string', enum: ['fell_asleep', 'woke_up', 'out_of_crib'] },
            putDownAt: { type: 'string', format: 'date-time' },
            asleepAt: { type: 'string', format: 'date-time' },
            wokeUpAt: { type: 'string', format: 'date-time' },
            outOfCribAt: { type: 'string', format: 'date-time' },
            cryingMinutes: { type: 'number', minimum: 0, maximum: 180 },
            notes: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string; sessionId: string }; Body: UpdateSessionInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId, sessionId } = request.params;
        const input = updateSessionSchema.parse(request.body);

        const session = await updateSession(userId, childId, sessionId, input);

        // Publish state change to MQTT for Home Assistant
        if (isMqttEnabled()) {
          publishState(childId).catch((err) => {
            request.log.error('Failed to publish MQTT state:', err);
          });
        }

        return reply.send(successResponse(session));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Create an ad-hoc nap (car, stroller, etc.)
  // Two modes:
  // 1. Start mode: location + asleepAt only - starts real-time tracking in ASLEEP state
  // 2. Complete mode: location + asleepAt + wokeUpAt - logs completed nap after the fact
  app.post<{ Params: { childId: string }; Body: CreateAdHocSessionInput }>(
    '/:childId/sessions/adhoc',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Create an ad-hoc nap (car, stroller, etc.) - either start real-time tracking or log after it happens',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        body: {
          type: 'object',
          required: ['location', 'asleepAt'],
          properties: {
            location: { type: 'string', enum: ['CAR', 'STROLLER', 'CARRIER', 'SWING', 'PLAYPEN', 'OTHER'] },
            asleepAt: { type: 'string', format: 'date-time' },
            wokeUpAt: { type: 'string', format: 'date-time' }, // Optional - if omitted, starts in ASLEEP state
            notes: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: CreateAdHocSessionInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = createAdHocSessionSchema.parse(request.body);

        // Get device timezone from header for storing with session
        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);

        const session = await createAdHocSession(userId, childId, input, timezone);

        // Publish state change to MQTT for Home Assistant
        if (isMqttEnabled()) {
          publishState(childId).catch((err) => {
            request.log.error('Failed to publish MQTT state:', err);
          });
        }

        return reply.status(201).send(successResponse(session));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Recalculate today's sessions (fix qualified rest after bug fix)
  app.post<{ Params: { childId: string } }>(
    '/:childId/sessions/recalculate',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Recalculate qualifiedRestMinutes for today\'s completed sessions',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;

        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);
        const result = await recalculateTodaySessions(userId, childId, timezone);

        return reply.send(successResponse(result));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Delete a session
  app.delete<{ Params: { childId: string; sessionId: string } }>(
    '/:childId/sessions/:sessionId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Delete a sleep session',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['childId', 'sessionId'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string; sessionId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId, sessionId } = request.params;

        await deleteSession(userId, childId, sessionId);

        // Publish state change to MQTT for Home Assistant
        if (isMqttEnabled()) {
          publishState(childId).catch((err) => {
            request.log.error('Failed to publish MQTT state:', err);
          });
        }

        return reply.send(successResponse({ message: 'Session deleted successfully' }));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // =====================================================
  // Sleep Cycle Routes (for retroactive editing)
  // =====================================================

  // Create a sleep cycle for a session
  app.post<{
    Params: { childId: string; sessionId: string };
    Body: CreateSleepCycleInput;
  }>(
    '/:childId/sessions/:sessionId/cycles',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Add a sleep cycle to a session (retroactive editing from video review)',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['childId', 'sessionId'],
        },
        body: {
          type: 'object',
          required: ['asleepAt'],
          properties: {
            asleepAt: { type: 'string', format: 'date-time' },
            wokeUpAt: { type: 'string', format: 'date-time' },
            wakeType: {
              type: 'string',
              enum: ['QUIET', 'RESTLESS', 'CRYING'],
              description: 'QUIET = 50% rest credit, RESTLESS/CRYING = 0% credit',
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { childId: string; sessionId: string };
        Body: CreateSleepCycleInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId, sessionId } = request.params;
        const input = createSleepCycleSchema.parse(request.body);

        const cycle = await createSleepCycle(userId, childId, sessionId, input);

        return reply.status(201).send(successResponse(cycle));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Update a sleep cycle
  app.patch<{
    Params: { childId: string; sessionId: string; cycleId: string };
    Body: UpdateSleepCycleInput;
  }>(
    '/:childId/sessions/:sessionId/cycles/:cycleId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update a sleep cycle',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            sessionId: { type: 'string' },
            cycleId: { type: 'string' },
          },
          required: ['childId', 'sessionId', 'cycleId'],
        },
        body: {
          type: 'object',
          properties: {
            asleepAt: { type: 'string', format: 'date-time' },
            wokeUpAt: { type: 'string', format: 'date-time' },
            wakeType: {
              type: 'string',
              enum: ['QUIET', 'RESTLESS', 'CRYING'],
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { childId: string; sessionId: string; cycleId: string };
        Body: UpdateSleepCycleInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId, sessionId, cycleId } = request.params;
        const input = updateSleepCycleSchema.parse(request.body);

        const cycle = await updateSleepCycle(userId, childId, sessionId, cycleId, input);

        return reply.send(successResponse(cycle));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Delete a sleep cycle
  app.delete<{
    Params: { childId: string; sessionId: string; cycleId: string };
  }>(
    '/:childId/sessions/:sessionId/cycles/:cycleId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Delete a sleep cycle',
        tags: ['Sessions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            sessionId: { type: 'string' },
            cycleId: { type: 'string' },
          },
          required: ['childId', 'sessionId', 'cycleId'],
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { childId: string; sessionId: string; cycleId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId, sessionId, cycleId } = request.params;

        await deleteSleepCycle(userId, childId, sessionId, cycleId);

        return reply.send(successResponse({ message: 'Cycle deleted successfully' }));
      } catch (error) {
        if (error instanceof SessionServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );
}
