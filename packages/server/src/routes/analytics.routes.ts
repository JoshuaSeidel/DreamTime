import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  getDailySummary,
  getWeeklySummary,
  getSleepTrends,
  getAnalyticsSummary,
  getComparison,
} from '../services/analytics.service.js';
import { prisma } from '../config/database.js';
import { successResponse, errorResponse } from '../types/api.js';
import { InviteStatus } from '../types/enums.js';

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

// Helper to verify child access
async function verifyChildAccess(userId: string, childId: string): Promise<void> {
  const relation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: { childId, userId },
    },
  });

  if (!relation || relation.status !== InviteStatus.ACCEPTED) {
    throw new Error('Child not found');
  }
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const comparisonSchema = z.object({
  period1Start: dateSchema,
  period1End: dateSchema,
  period2Start: dateSchema,
  period2End: dateSchema,
});

type ComparisonInput = z.infer<typeof comparisonSchema>;

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // Get daily sleep summary
  app.get<{ Params: { childId: string }; Querystring: { date: string } }>(
    '/:childId/analytics/daily',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get daily sleep summary for a child',
        tags: ['Analytics'],
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

        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);
        const summary = await getDailySummary(userId, childId, date, timezone);

        return reply.send(successResponse(summary));
      } catch (error) {
        if (error instanceof Error && error.message === 'Child not found') {
          return reply.status(404).send(
            errorResponse('CHILD_NOT_FOUND', 'Child not found')
          );
        }
        throw error;
      }
    }
  );

  // Get weekly sleep summary
  app.get<{ Params: { childId: string }; Querystring: { weekOf: string } }>(
    '/:childId/analytics/weekly',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get weekly sleep summary for a child',
        tags: ['Analytics'],
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
            weekOf: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
          required: ['weekOf'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Querystring: { weekOf: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const { weekOf } = request.query;

        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);
        const summary = await getWeeklySummary(userId, childId, weekOf, timezone);

        return reply.send(successResponse(summary));
      } catch (error) {
        if (error instanceof Error && error.message === 'Child not found') {
          return reply.status(404).send(
            errorResponse('CHILD_NOT_FOUND', 'Child not found')
          );
        }
        throw error;
      }
    }
  );

  // Get sleep trends (7-day or 30-day)
  app.get<{ Params: { childId: string }; Querystring: { period: '7d' | '30d' } }>(
    '/:childId/analytics/trends',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get sleep trends over time',
        tags: ['Analytics'],
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
            period: { type: 'string', enum: ['7d', '30d'] },
          },
          required: ['period'],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Querystring: { period: '7d' | '30d' } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const { period } = request.query;

        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);
        const trends = await getSleepTrends(userId, childId, period, timezone);

        return reply.send(successResponse(trends));
      } catch (error) {
        if (error instanceof Error && error.message === 'Child not found') {
          return reply.status(404).send(
            errorResponse('CHILD_NOT_FOUND', 'Child not found')
          );
        }
        throw error;
      }
    }
  );

  // Get full analytics summary
  app.get<{ Params: { childId: string }; Querystring: { date: string } }>(
    '/:childId/analytics/summary',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get complete analytics summary with daily, weekly, trends, and insights',
        tags: ['Analytics'],
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

        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);
        const summary = await getAnalyticsSummary(userId, childId, date, timezone);

        return reply.send(successResponse(summary));
      } catch (error) {
        if (error instanceof Error && error.message === 'Child not found') {
          return reply.status(404).send(
            errorResponse('CHILD_NOT_FOUND', 'Child not found')
          );
        }
        throw error;
      }
    }
  );

  // Compare two date ranges
  app.post<{ Params: { childId: string }; Body: ComparisonInput }>(
    '/:childId/analytics/compare',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Compare sleep data between two date ranges',
        tags: ['Analytics'],
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
          required: ['period1Start', 'period1End', 'period2Start', 'period2End'],
          properties: {
            period1Start: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            period1End: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            period2Start: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            period2End: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: ComparisonInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = comparisonSchema.parse(request.body);

        const headerTimezone = request.headers['x-timezone'] as string | undefined;
        const timezone = await getUserTimezone(userId, headerTimezone);
        const comparison = await getComparison(
          userId,
          childId,
          input.period1Start,
          input.period1End,
          input.period2Start,
          input.period2End,
          timezone
        );

        return reply.send(successResponse(comparison));
      } catch (error) {
        if (error instanceof Error && error.message === 'Child not found') {
          return reply.status(404).send(
            errorResponse('CHILD_NOT_FOUND', 'Child not found')
          );
        }
        throw error;
      }
    }
  );
}
