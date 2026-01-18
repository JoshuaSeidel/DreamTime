import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerCors } from '../../src/plugins/cors.js';
import { registerJwt } from '../../src/plugins/jwt.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { childRoutes } from '../../src/routes/child.routes.js';
import { scheduleRoutes } from '../../src/routes/schedule.routes.js';
import { prisma } from '../../src/config/database.js';

describe('Schedule Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await registerCors(app);
    await registerJwt(app);
    registerErrorHandler(app);
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(childRoutes, { prefix: '/api/children' });
    await app.register(scheduleRoutes, { prefix: '/api/children' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.sleepSession.deleteMany();
    await prisma.scheduleTransition.deleteMany();
    await prisma.sleepSchedule.deleteMany();
    await prisma.childCaregiver.deleteMany();
    await prisma.child.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  // Helper functions
  async function createUserAndGetToken(): Promise<{
    accessToken: string;
    userId: string;
  }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'testuser@example.com',
        password: 'Password123',
        name: 'Test User',
      },
    });

    const body = JSON.parse(response.body);
    return {
      accessToken: body.data.tokens.accessToken,
      userId: body.data.user.id,
    };
  }

  async function createTestChild(accessToken: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        name: 'Test Child',
        birthDate: '2023-06-15',
      },
    });

    const body = JSON.parse(response.body);
    return body.data.id;
  }

  const validSchedule = {
    type: 'TWO_NAP',
    wakeWindow1Min: 120,
    wakeWindow1Max: 150,
    wakeWindow2Min: 150,
    wakeWindow2Max: 210,
    wakeWindow3Min: 210,
    wakeWindow3Max: 270,
    nap1Earliest: '08:30',
    nap1LatestStart: '09:00',
    nap1MaxDuration: 120,
    nap1EndBy: '11:00',
    nap2Earliest: '12:00',
    nap2LatestStart: '13:00',
    nap2MaxDuration: 120,
    nap2EndBy: '15:00',
    bedtimeEarliest: '17:30',
    bedtimeLatest: '19:30',
    bedtimeGoalStart: '19:00',
    bedtimeGoalEnd: '19:30',
    wakeTimeEarliest: '06:30',
    wakeTimeLatest: '07:30',
    daySleepCap: 210,
  };

  describe('PUT /api/children/:childId/schedule', () => {
    it('should create a schedule', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('TWO_NAP');
      expect(body.data.isActive).toBe(true);
      expect(body.data.wakeWindow1Min).toBe(120);
      expect(body.data.bedtimeEarliest).toBe('17:30');
    });

    it('should replace existing schedule', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create first schedule
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      // Create second schedule
      const response = await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          ...validSchedule,
          type: 'ONE_NAP',
          daySleepCap: 150,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.type).toBe('ONE_NAP');
      expect(body.data.daySleepCap).toBe(150);

      // Verify only one active schedule exists
      const allSchedules = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/schedules`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const allBody = JSON.parse(allSchedules.body);
      const activeSchedules = allBody.data.filter((s: { isActive: boolean }) => s.isActive);
      expect(activeSchedules).toHaveLength(1);
      expect(activeSchedules[0].type).toBe('ONE_NAP');
    });

    it('should require authentication', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        payload: validSchedule,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent child', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/api/children/non-existent-id/schedule',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/children/:childId/schedule', () => {
    it('should get active schedule', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create schedule
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('TWO_NAP');
    });

    it('should return 404 when no schedule exists', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/children/:childId/schedules', () => {
    it('should list all schedules including history', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create multiple schedules
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          ...validSchedule,
          type: 'ONE_NAP',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/schedules`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(2);
    });
  });

  describe('POST /api/children/:childId/transition', () => {
    it('should start a transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create a TWO_NAP schedule first
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.fromType).toBe('TWO_NAP');
      expect(body.data.toType).toBe('ONE_NAP');
      expect(body.data.currentNapTime).toBe('11:30');
      expect(body.data.currentWeek).toBe(1);
      expect(body.data.completedAt).toBeNull();
    });

    it('should not allow multiple active transitions', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Start first transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      // Try to start another transition
      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '12:00',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /api/children/:childId/transition', () => {
    it('should get active transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Start transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.currentNapTime).toBe('11:30');
    });

    it('should return 404 when no active transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/children/:childId/transition', () => {
    it('should progress transition nap time', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Start transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      // Progress nap time
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          newNapTime: '11:45',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.currentNapTime).toBe('11:45');
    });

    it('should advance week', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Start transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      // Advance week
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentWeek: 2,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.currentWeek).toBe(2);
    });

    it('should complete transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create schedule first
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      // Start transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      // Complete transition
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          complete: true,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.completedAt).not.toBeNull();

      // Check schedule type changed to ONE_NAP
      const scheduleResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const scheduleBody = JSON.parse(scheduleResponse.body);
      expect(scheduleBody.data.type).toBe('ONE_NAP');
    });

    it('should return 404 when no active transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          newNapTime: '12:00',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/children/:childId/transition', () => {
    it('should cancel transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create schedule first
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      // Start transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      // Cancel transition
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify no active transition
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);

      // Verify schedule reverted to TWO_NAP
      const scheduleResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const scheduleBody = JSON.parse(scheduleResponse.body);
      expect(scheduleBody.data.type).toBe('TWO_NAP');
    });
  });

  describe('GET /api/children/:childId/transitions', () => {
    it('should list transition history', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create schedule
      await app.inject({
        method: 'PUT',
        url: `/api/children/${childId}/schedule`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: validSchedule,
      });

      // Start and complete a transition
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          fromType: 'TWO_NAP',
          toType: 'ONE_NAP',
          startNapTime: '11:30',
        },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/transition`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          complete: true,
        },
      });

      // Get history
      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/transitions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].completedAt).not.toBeNull();
    });
  });
});
