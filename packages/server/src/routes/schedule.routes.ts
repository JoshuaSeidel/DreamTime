import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createScheduleSchema,
  startTransitionSchema,
  progressTransitionSchema,
  type CreateScheduleInput,
  type StartTransitionInput,
  type ProgressTransitionInput,
} from '../schemas/schedule.schema.js';
import {
  getActiveSchedule,
  createOrUpdateSchedule,
  getAllSchedules,
  getActiveTransition,
  startTransition,
  progressTransition,
  cancelTransition,
  getTransitionHistory,
  ScheduleServiceError,
} from '../services/schedule.service.js';
import { successResponse, errorResponse } from '../types/api.js';

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  // Get active schedule for a child
  app.get<{ Params: { childId: string } }>(
    '/:childId/schedule',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get active sleep schedule for a child',
        tags: ['Schedules'],
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

        const schedule = await getActiveSchedule(userId, childId);

        if (!schedule) {
          return reply.status(404).send(
            errorResponse('SCHEDULE_NOT_FOUND', 'No active schedule found')
          );
        }

        return reply.send(successResponse(schedule));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get all schedules for a child (history)
  app.get<{ Params: { childId: string } }>(
    '/:childId/schedules',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get all schedules for a child (including history)',
        tags: ['Schedules'],
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

        const schedules = await getAllSchedules(userId, childId);

        return reply.send(successResponse(schedules));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Create or update schedule
  app.put<{ Params: { childId: string }; Body: CreateScheduleInput }>(
    '/:childId/schedule',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Create or update active sleep schedule (ADMIN only)',
        tags: ['Schedules'],
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
          required: ['type', 'wakeWindow1Min', 'wakeWindow1Max', 'bedtimeEarliest', 'bedtimeLatest', 'wakeTimeEarliest', 'wakeTimeLatest', 'daySleepCap'],
          properties: {
            type: { type: 'string', enum: ['THREE_NAP', 'TWO_NAP', 'ONE_NAP', 'TRANSITION'] },
            wakeWindow1Min: { type: 'number' },
            wakeWindow1Max: { type: 'number' },
            wakeWindow2Min: { type: 'number' },
            wakeWindow2Max: { type: 'number' },
            wakeWindow3Min: { type: 'number' },
            wakeWindow3Max: { type: 'number' },
            nap1Earliest: { type: 'string' },
            nap1LatestStart: { type: 'string' },
            nap1MaxDuration: { type: 'number' },
            nap1EndBy: { type: 'string' },
            nap2Earliest: { type: 'string' },
            nap2LatestStart: { type: 'string' },
            nap2MaxDuration: { type: 'number' },
            nap2EndBy: { type: 'string' },
            nap2ExceptionDuration: { type: 'number' },
            bedtimeEarliest: { type: 'string' },
            bedtimeLatest: { type: 'string' },
            bedtimeGoalStart: { type: 'string' },
            bedtimeGoalEnd: { type: 'string' },
            wakeTimeEarliest: { type: 'string' },
            wakeTimeLatest: { type: 'string' },
            daySleepCap: { type: 'number' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: CreateScheduleInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = createScheduleSchema.parse(request.body);

        const schedule = await createOrUpdateSchedule(userId, childId, input);

        return reply.send(successResponse(schedule));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get active transition
  app.get<{ Params: { childId: string } }>(
    '/:childId/transition',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get active schedule transition',
        tags: ['Schedules'],
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

        const transition = await getActiveTransition(userId, childId);

        if (!transition) {
          return reply.status(404).send(
            errorResponse('NO_ACTIVE_TRANSITION', 'No active transition found')
          );
        }

        return reply.send(successResponse(transition));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get transition history
  app.get<{ Params: { childId: string } }>(
    '/:childId/transitions',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get transition history',
        tags: ['Schedules'],
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

        const transitions = await getTransitionHistory(userId, childId);

        return reply.send(successResponse(transitions));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Start a transition (2-to-1 nap)
  app.post<{ Params: { childId: string }; Body: StartTransitionInput }>(
    '/:childId/transition',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Start a nap transition (e.g., 2-to-1)',
        tags: ['Schedules'],
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
          required: ['fromType', 'toType', 'startNapTime'],
          properties: {
            fromType: { type: 'string', enum: ['TWO_NAP'] },
            toType: { type: 'string', enum: ['ONE_NAP'] },
            startNapTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: StartTransitionInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = startTransitionSchema.parse(request.body);

        const transition = await startTransition(userId, childId, input);

        return reply.status(201).send(successResponse(transition));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Progress transition
  app.patch<{ Params: { childId: string }; Body: ProgressTransitionInput }>(
    '/:childId/transition',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update transition progress (push nap time, advance week)',
        tags: ['Schedules'],
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
          properties: {
            newNapTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' },
            currentWeek: { type: 'number', minimum: 1, maximum: 12 },
            notes: { type: 'string', maxLength: 500 },
            complete: { type: 'boolean' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: ProgressTransitionInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = progressTransitionSchema.parse(request.body);

        const transition = await progressTransition(userId, childId, input);

        return reply.send(successResponse(transition));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Cancel transition
  app.delete<{ Params: { childId: string } }>(
    '/:childId/transition',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Cancel active transition',
        tags: ['Schedules'],
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

        await cancelTransition(userId, childId);

        return reply.send(successResponse({ message: 'Transition cancelled' }));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );
}
