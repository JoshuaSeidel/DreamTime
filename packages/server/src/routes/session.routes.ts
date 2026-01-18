import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createSessionSchema,
  updateSessionSchema,
  listSessionsQuerySchema,
  type CreateSessionInput,
  type UpdateSessionInput,
  type ListSessionsQuery,
} from '../schemas/session.schema.js';
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getActiveSession,
  getDailySummary,
  SessionServiceError,
} from '../services/session.service.js';
import { successResponse, errorResponse } from '../types/api.js';

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

        const session = await createSession(userId, childId, input);

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
}
