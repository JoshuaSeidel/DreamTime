import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  calculateDaySchedule,
  calculateNextAction,
  calculateAdjustedBedtime,
} from '../services/schedule.calculator.service.js';
import { getActiveSchedule, getActiveTransition, ScheduleServiceError } from '../services/schedule.service.js';
import {
  getTransitionProgress,
  analyzeNapPushReadiness,
  checkCrib90Compliance,
} from '../services/transition.tracker.service.js';
import { prisma } from '../config/database.js';
import { successResponse, errorResponse } from '../types/api.js';
import { SessionState, SessionType, InviteStatus } from '../types/enums.js';

const calculateDaySchema = z.object({
  wakeTime: z.string().datetime(),
  actualNapDurations: z.array(z.number()).optional(),
});

type CalculateDayInput = z.infer<typeof calculateDaySchema>;

const calculateBedtimeSchema = z.object({
  wakeTime: z.string().datetime(),
  actualNaps: z.array(z.object({
    asleepAt: z.string().datetime(),
    wokeUpAt: z.string().datetime(),
  })),
});

type CalculateBedtimeInput = z.infer<typeof calculateBedtimeSchema>;

// Helper to get user timezone
async function getUserTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return user?.timezone ?? 'America/New_York';
}

// Helper to verify child access
async function verifyChildAccess(userId: string, childId: string): Promise<void> {
  const relation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: { childId, userId },
    },
  });

  if (!relation || relation.status !== InviteStatus.ACCEPTED) {
    throw new ScheduleServiceError('Child not found', 'CHILD_NOT_FOUND', 404);
  }
}

export async function calculatorRoutes(app: FastifyInstance): Promise<void> {
  // Calculate day schedule recommendations
  app.post<{ Params: { childId: string }; Body: CalculateDayInput }>(
    '/:childId/calculator/day',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Calculate recommended nap and bedtime schedule for the day',
        tags: ['Calculator'],
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
          required: ['wakeTime'],
          properties: {
            wakeTime: { type: 'string', format: 'date-time' },
            actualNapDurations: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: CalculateDayInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = calculateDaySchema.parse(request.body);

        // Get schedule and transition
        const [schedule, transition, timezone] = await Promise.all([
          getActiveSchedule(userId, childId),
          getActiveTransition(userId, childId),
          getUserTimezone(userId),
        ]);

        if (!schedule) {
          return reply.status(404).send(
            errorResponse('SCHEDULE_NOT_FOUND', 'No active schedule found')
          );
        }

        const wakeTime = new Date(input.wakeTime);
        const recommendation = calculateDaySchedule(
          wakeTime,
          schedule,
          timezone,
          transition,
          input.actualNapDurations
        );

        return reply.send(successResponse(recommendation));
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

  // Get next action recommendation
  app.get<{ Params: { childId: string } }>(
    '/:childId/calculator/next-action',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get recommendation for what to do next (nap, bedtime, or wait)',
        tags: ['Calculator'],
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

        // Get schedule and today's sessions
        const [schedule, transition, timezone] = await Promise.all([
          getActiveSchedule(userId, childId),
          getActiveTransition(userId, childId),
          getUserTimezone(userId),
        ]);

        if (!schedule) {
          return reply.status(404).send(
            errorResponse('SCHEDULE_NOT_FOUND', 'No active schedule found')
          );
        }

        // Get today's sessions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySessions = await prisma.sleepSession.findMany({
          where: {
            childId,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        // Find wake time from night sleep or use schedule default
        let wakeTime = new Date();
        wakeTime.setHours(7, 0, 0, 0); // Default

        const nightSession = todaySessions.find(
          s => s.sessionType === SessionType.NIGHT_SLEEP && s.wokeUpAt
        );
        if (nightSession?.wokeUpAt) {
          wakeTime = nightSession.wokeUpAt;
        }

        // Separate scheduled naps from ad-hoc naps (same logic as today-summary)
        const napSessions = todaySessions.filter(s => s.sessionType === SessionType.NAP);
        const scheduledNaps = napSessions.filter(s => !s.isAdHoc);
        const adHocNaps = napSessions.filter(s => s.isAdHoc && s.state === SessionState.COMPLETED);

        // Count completed SCHEDULED naps only (ad-hoc don't count toward nap 1/2)
        const completedNaps = scheduledNaps.filter(
          s => s.state === SessionState.COMPLETED
        ).length;

        // Check if currently asleep and if it's night sleep
        const asleepSession = todaySessions.find(s => s.state === SessionState.ASLEEP);
        const currentlyAsleep = asleepSession !== undefined;
        const isNightSleep = asleepSession?.sessionType === SessionType.NIGHT_SLEEP;

        // Calculate day schedule using qualified rest
        // Scheduled naps count as nap 1/2 for sequence timing
        // Ad-hoc naps contribute to total rest credit for sleep debt/bedtime calculation
        // IMPORTANT: Must match today-summary logic exactly - include all completed naps
        const completedScheduledNaps = scheduledNaps.filter(s => s.state === SessionState.COMPLETED);
        const scheduledNapDurations = completedScheduledNaps.map(s => s.qualifiedRestMinutes ?? s.sleepMinutes ?? 0);
        // Get actual nap end times (wokeUpAt) for precise timing calculations
        const scheduledNapEndTimes = completedScheduledNaps
          .map(s => s.wokeUpAt)
          .filter((t): t is Date => t !== null);
        const adHocNapDurations = adHocNaps.map(s => s.qualifiedRestMinutes ?? 0);
        // Combine for total rest credit (same as today-summary)
        const napDurations = [...scheduledNapDurations, ...adHocNapDurations];

        const daySchedule = calculateDaySchedule(
          wakeTime,
          schedule,
          timezone,
          transition,
          napDurations.length > 0 ? napDurations : undefined,
          scheduledNapEndTimes.length > 0 ? scheduledNapEndTimes : undefined
        );

        // Calculate ad-hoc bedtime bump (15 min if any ad-hoc nap >= 30 min)
        const hasSignificantAdHocNap = adHocNaps.some(s => (s.sleepMinutes ?? 0) >= 30);
        const adHocBedtimeBumpMinutes = hasSignificantAdHocNap ? 15 : 0;

        // Apply ad-hoc bump to daySchedule bedtime before calculating next action
        if (adHocBedtimeBumpMinutes > 0) {
          const bump = adHocBedtimeBumpMinutes * 60000; // Convert to ms
          daySchedule.bedtime.putDownWindow.earliest = new Date(daySchedule.bedtime.putDownWindow.earliest.getTime() + bump);
          daySchedule.bedtime.putDownWindow.latest = new Date(daySchedule.bedtime.putDownWindow.latest.getTime() + bump);
          daySchedule.bedtime.putDownWindow.recommended = new Date(daySchedule.bedtime.putDownWindow.recommended.getTime() + bump);
          daySchedule.bedtime.notes.push('+15 min bump for ad-hoc nap (30+ min)');
        }

        const nextAction = calculateNextAction(
          new Date(),
          daySchedule,
          completedNaps,
          currentlyAsleep,
          timezone,
          isNightSleep,
          schedule.mustWakeBy ?? undefined
        );

        return reply.send(successResponse(nextAction));
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

  // Get today's detailed recommendation with consultant's logic
  app.get<{ Params: { childId: string } }>(
    '/:childId/calculator/today-summary',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get detailed today\'s recommendation including bedtime calculation based on actual nap data',
        tags: ['Calculator'],
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

        // Get schedule and today's sessions
        const [schedule, transition, timezone] = await Promise.all([
          getActiveSchedule(userId, childId),
          getActiveTransition(userId, childId),
          getUserTimezone(userId),
        ]);

        if (!schedule) {
          return reply.status(404).send(
            errorResponse('SCHEDULE_NOT_FOUND', 'No active schedule found')
          );
        }

        // Get today's sessions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySessions = await prisma.sleepSession.findMany({
          where: {
            childId,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        // Find wake time from night sleep or use schedule default
        let wakeTime: Date | null = null;
        const nightSession = todaySessions.find(
          s => s.sessionType === SessionType.NIGHT_SLEEP && s.wokeUpAt
        );
        if (nightSession?.wokeUpAt) {
          wakeTime = nightSession.wokeUpAt;
        }

        // Get nap sessions - separate scheduled vs ad-hoc
        const napSessions = todaySessions.filter(s => s.sessionType === SessionType.NAP);
        const scheduledNaps = napSessions.filter(s => !s.isAdHoc);
        const adHocNaps = napSessions.filter(s => s.isAdHoc && s.state === SessionState.COMPLETED);
        const completedNaps = scheduledNaps.filter(s => s.state === SessionState.COMPLETED);
        const inProgressNap = scheduledNaps.find(s => s.state === SessionState.ASLEEP || s.state === SessionState.PENDING);

        // Determine current state
        let currentState: 'awake' | 'asleep' | 'pending' = 'awake';
        if (todaySessions.some(s => s.state === SessionState.ASLEEP)) {
          currentState = 'asleep';
        } else if (todaySessions.some(s => s.state === SessionState.PENDING)) {
          currentState = 'pending';
        }

        // Build nap durations for bedtime calculation
        // Use qualifiedRestMinutes which accounts for awake crib time:
        // Qualified Rest = (Awake Crib Time ÷ 2) + Actual Sleep Time
        // This gives credit for rest even when baby doesn't sleep
        const scheduledNapDurations = completedNaps.map(s => s.qualifiedRestMinutes ?? s.sleepMinutes ?? 0);
        // Get actual nap end times (wokeUpAt) for precise timing calculations
        const scheduledNapEndTimes = completedNaps
          .map(s => s.wokeUpAt)
          .filter((t): t is Date => t !== null);
        const adHocNapDurations = adHocNaps.map(s => s.qualifiedRestMinutes ?? 0);
        const napDurations = [...scheduledNapDurations, ...adHocNapDurations];
        const totalQualifiedRestMinutes = napDurations.reduce((sum, d) => sum + d, 0);
        // Also track actual sleep for display (includes both scheduled and ad-hoc)
        const scheduledActualSleepMinutes = completedNaps.reduce((sum, s) => sum + (s.sleepMinutes ?? 0), 0);
        const adHocActualSleepMinutes = adHocNaps.reduce((sum, s) => sum + (s.sleepMinutes ?? 0), 0);
        const totalActualSleepMinutes = scheduledActualSleepMinutes + adHocActualSleepMinutes;

        // Determine schedule type
        const scheduleType = schedule.type;
        const isOnOneNapSchedule = scheduleType === 'ONE_NAP' || scheduleType === 'TRANSITION';

        // Calculate expected nap goal
        const napGoalMinutes = isOnOneNapSchedule ? 90 : 60; // 90 min for 1-nap, 60 min per nap for 2-nap
        const expectedTotalNapMinutes = isOnOneNapSchedule ? 90 : 120; // Single 90min nap or 2x60min naps

        // Sleep debt calculation - use qualified rest for debt calculation
        let sleepDebtMinutes = 0;
        let sleepDebtNote: string | null = null;

        if (completedNaps.length > 0 || adHocNaps.length > 0) {
          sleepDebtMinutes = Math.max(0, expectedTotalNapMinutes - totalQualifiedRestMinutes);
          if (sleepDebtMinutes > 0) {
            // Build a clear explanation of how rest credit was calculated
            // Goal is expectedTotalNapMinutes, got totalQualifiedRestMinutes, debt is the difference
            sleepDebtNote = `${sleepDebtMinutes} min short of ${expectedTotalNapMinutes} min goal (got ${totalQualifiedRestMinutes} min credit) - earlier bedtime recommended`;
          }
        }

        // Calculate recommended bedtime using actual nap data
        const defaultWakeTime = new Date();
        defaultWakeTime.setHours(7, 0, 0, 0);
        const effectiveWakeTime = wakeTime || defaultWakeTime;

        const daySchedule = calculateDaySchedule(
          effectiveWakeTime,
          schedule,
          timezone,
          transition,
          napDurations.length > 0 ? napDurations : undefined,
          scheduledNapEndTimes.length > 0 ? scheduledNapEndTimes : undefined
        );

        // Determine if bedtime is finalized
        // For 2-nap schedule, bedtime is only finalized after nap 2 is complete
        // For 1-nap schedule, bedtime is finalized after nap 1 is complete
        const requiredNapsForBedtime = isOnOneNapSchedule ? 1 : 2;
        const isBedtimeFinalized = completedNaps.length >= requiredNapsForBedtime;
        const bedtimeStatus = isBedtimeFinalized ? 'finalized' : 'estimated';

        // Build naps summary
        const expectedNapCount = isOnOneNapSchedule ? 1 : 2;
        const naps = [];

        for (let i = 0; i < expectedNapCount; i++) {
          const napNum = i + 1;
          const completedNap = completedNaps.find(n => n.napNumber === napNum);
          const isInProgress = inProgressNap?.napNumber === napNum;

          if (completedNap) {
            naps.push({
              napNumber: napNum,
              duration: completedNap.sleepMinutes,
              asleepAt: completedNap.asleepAt,
              wokeUpAt: completedNap.wokeUpAt,
              status: 'completed' as const,
            });
          } else if (isInProgress) {
            naps.push({
              napNumber: napNum,
              duration: null,
              asleepAt: inProgressNap?.asleepAt || null,
              wokeUpAt: null,
              status: 'in_progress' as const,
            });
          } else {
            naps.push({
              napNumber: napNum,
              duration: null,
              asleepAt: null,
              wokeUpAt: null,
              status: 'upcoming' as const,
            });
          }
        }

        // Build ad-hoc naps summary for display
        const adHocNapsSummary = adHocNaps.map(s => ({
          id: s.id,
          location: s.location,
          asleepAt: s.asleepAt,
          wokeUpAt: s.wokeUpAt,
          sleepMinutes: s.sleepMinutes,
          qualifiedRestMinutes: s.qualifiedRestMinutes,
        }));

        // Calculate bedtime bump for ad-hoc naps 30+ minutes (max 15 min bump per consultant)
        // Any ad-hoc nap >= 30 min adds a 15-min bump to bedtime
        const hasSignificantAdHocNap = adHocNaps.some(s => (s.sleepMinutes ?? 0) >= 30);
        const adHocBedtimeBumpMinutes = hasSignificantAdHocNap ? 15 : 0;

        // Apply the bump to bedtime recommendations
        let adjustedRecommendedBedtime = daySchedule.bedtime.putDownWindow.recommended;
        let adjustedBedtimeWindow = { ...daySchedule.bedtime.putDownWindow };
        const bedtimeNotesWithBump = [...daySchedule.bedtime.notes];

        if (adHocBedtimeBumpMinutes > 0) {
          adjustedRecommendedBedtime = new Date(adjustedRecommendedBedtime.getTime() + adHocBedtimeBumpMinutes * 60000);
          adjustedBedtimeWindow = {
            earliest: new Date(adjustedBedtimeWindow.earliest.getTime() + adHocBedtimeBumpMinutes * 60000),
            latest: new Date(adjustedBedtimeWindow.latest.getTime() + adHocBedtimeBumpMinutes * 60000),
            recommended: adjustedRecommendedBedtime,
          };
          bedtimeNotesWithBump.push(`+15 min bump for ad-hoc nap (30+ min)`);
        }

        const response = {
          wakeTime,
          currentState,
          completedNaps: completedNaps.length,
          naps,
          // Ad-hoc naps (car, stroller, etc.) - shown separately
          adHocNaps: adHocNapsSummary,
          totalAdHocMinutes: adHocActualSleepMinutes,
          totalAdHocCreditMinutes: adHocNapDurations.reduce((sum, d) => sum + d, 0),
          adHocBedtimeBumpMinutes, // 15 min bump if any ad-hoc nap was 30+ min
          totalNapMinutes: totalQualifiedRestMinutes, // Qualified rest for bedtime calculation
          totalActualSleepMinutes, // Actual sleep time for display
          napGoalMinutes,
          recommendedBedtime: adjustedRecommendedBedtime,
          bedtimeWindow: adjustedBedtimeWindow,
          bedtimeNotes: bedtimeNotesWithBump,
          bedtimeStatus, // 'finalized' when all required naps complete, 'estimated' otherwise
          sleepDebtMinutes,
          sleepDebtNote,
          scheduleType,
          isOnOneNapSchedule,
        };

        return reply.send(successResponse(response));
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

  // Calculate adjusted bedtime based on actual naps
  app.post<{ Params: { childId: string }; Body: CalculateBedtimeInput }>(
    '/:childId/calculator/bedtime',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Calculate recommended bedtime based on actual nap data',
        tags: ['Calculator'],
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
          required: ['wakeTime', 'actualNaps'],
          properties: {
            wakeTime: { type: 'string', format: 'date-time' },
            actualNaps: {
              type: 'array',
              items: {
                type: 'object',
                required: ['asleepAt', 'wokeUpAt'],
                properties: {
                  asleepAt: { type: 'string', format: 'date-time' },
                  wokeUpAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { childId: string }; Body: CalculateBedtimeInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { childId } = request.params;
        const input = calculateBedtimeSchema.parse(request.body);

        const [schedule, timezone] = await Promise.all([
          getActiveSchedule(userId, childId),
          getUserTimezone(userId),
        ]);

        if (!schedule) {
          return reply.status(404).send(
            errorResponse('SCHEDULE_NOT_FOUND', 'No active schedule found')
          );
        }

        const wakeTime = new Date(input.wakeTime);
        const actualNaps = input.actualNaps.map(nap => ({
          asleepAt: new Date(nap.asleepAt),
          wokeUpAt: new Date(nap.wokeUpAt),
        }));

        const bedtime = calculateAdjustedBedtime(wakeTime, schedule, timezone, actualNaps);

        return reply.send(successResponse(bedtime));
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

  // Get transition progress and analysis
  app.get<{ Params: { childId: string } }>(
    '/:childId/calculator/transition-progress',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get detailed transition progress with recommendations',
        tags: ['Calculator'],
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

        const progress = await getTransitionProgress(userId, childId);

        if (!progress) {
          return reply.status(404).send(
            errorResponse('NO_ACTIVE_TRANSITION', 'No active transition found')
          );
        }

        return reply.send(successResponse(progress));
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

  // Analyze if ready to push nap time later
  app.get<{ Params: { childId: string } }>(
    '/:childId/calculator/nap-push-readiness',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Analyze if baby is ready to push nap time later during transition',
        tags: ['Calculator'],
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

        const analysis = await analyzeNapPushReadiness(userId, childId);

        if (!analysis) {
          return reply.status(404).send(
            errorResponse('NO_ACTIVE_TRANSITION', 'No active transition found')
          );
        }

        return reply.send(successResponse(analysis));
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

  // Check crib 90 compliance for a session
  app.get<{ Params: { childId: string; sessionId: string } }>(
    '/:childId/calculator/crib90/:sessionId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Check if a session meets the crib 90 rule',
        tags: ['Calculator'],
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

        const compliance = await checkCrib90Compliance(userId, childId, sessionId);

        return reply.send(successResponse(compliance));
      } catch (error) {
        if (error instanceof ScheduleServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        if (error instanceof Error && error.message === 'Session not found') {
          return reply.status(404).send(
            errorResponse('SESSION_NOT_FOUND', 'Session not found')
          );
        }
        throw error;
      }
    }
  );
}
