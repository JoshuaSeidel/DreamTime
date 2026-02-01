import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerCors } from '../../src/plugins/cors.js';
import { registerJwt } from '../../src/plugins/jwt.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { childRoutes } from '../../src/routes/child.routes.js';
import { sessionRoutes } from '../../src/routes/session.routes.js';
import { prisma } from '../../src/config/database.js';

describe('Session Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await registerCors(app);
    await registerJwt(app);
    registerErrorHandler(app);
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(childRoutes, { prefix: '/api/children' });
    await app.register(sessionRoutes, { prefix: '/api/children' });

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

  describe('POST /api/children/:childId/sessions', () => {
    it('should create a NAP session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
          napNumber: 1,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.sessionType).toBe('NAP');
      expect(body.data.state).toBe('PENDING');
      expect(body.data.napNumber).toBe(1);
      expect(body.data.putDownAt).toBeDefined();
    });

    it('should create a NIGHT_SLEEP session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NIGHT_SLEEP',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.data.sessionType).toBe('NIGHT_SLEEP');
      expect(body.data.state).toBe('PENDING');
    });

    it('should create session with custom putDownAt time', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const customTime = new Date('2024-01-15T14:30:00Z').toISOString();

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
          napNumber: 1,
          putDownAt: customTime,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(new Date(body.data.putDownAt).toISOString()).toBe(customTime);
    });

    it('should require authentication', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        payload: {
          sessionType: 'NAP',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/children/:childId/sessions/:sessionId (state transitions)', () => {
    it('should transition from PENDING to ASLEEP', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create session
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      // Transition to ASLEEP
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'fell_asleep',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.state).toBe('ASLEEP');
      expect(body.data.asleepAt).toBeDefined();
    });

    it('should transition from ASLEEP to AWAKE', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create and transition to ASLEEP
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'fell_asleep',
        },
      });

      // Transition to AWAKE
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'woke_up',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.state).toBe('AWAKE');
      expect(body.data.wokeUpAt).toBeDefined();
      // Sleep minutes should be calculated
      expect(body.data.sleepMinutes).toBeDefined();
    });

    it('should transition from AWAKE to COMPLETED', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create and go through all states
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'fell_asleep',
        },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'woke_up',
        },
      });

      // Transition to COMPLETED
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'out_of_crib',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.state).toBe('COMPLETED');
      expect(body.data.outOfCribAt).toBeDefined();
      // Total minutes should be calculated
      expect(body.data.totalMinutes).toBeDefined();
    });

    it('should reject invalid state transition', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create session in PENDING state
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      // Try to skip to AWAKE (invalid transition)
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'woke_up',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should reject transition from COMPLETED', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create and complete session
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep' },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'woke_up' },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'out_of_crib' },
      });

      // Try to transition again
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          event: 'fell_asleep',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/children/:childId/sessions/:sessionId (corrections)', () => {
    it('should update crying minutes', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          cryingMinutes: 15,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.cryingMinutes).toBe(15);
    });

    it('should update notes', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          notes: 'Baby was restless',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.notes).toBe('Baby was restless');
    });
  });

  describe('GET /api/children/:childId/sessions', () => {
    it('should list sessions with pagination', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/children/${childId}/sessions`,
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          payload: {
            sessionType: 'NAP',
            napNumber: (i % 2) + 1,
          },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions?page=1&pageSize=3`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(3);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.totalPages).toBe(2);
    });

    it('should filter by sessionType', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create mixed sessions
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP' },
      });

      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NIGHT_SLEEP' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions?sessionType=NAP`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].sessionType).toBe('NAP');
    });

    it('should filter by state', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create session and leave in PENDING
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP' },
      });

      // Create session and transition to ASLEEP
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP' },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;
      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions?state=PENDING`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].state).toBe('PENDING');
    });
  });

  describe('GET /api/children/:childId/sessions/active', () => {
    it('should get active session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create a session (will be in PENDING state)
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/active`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.state).toBe('PENDING');
    });

    it('should return 404 when no active session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/active`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not return completed sessions', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Create and complete a session
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP' },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep' },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'woke_up' },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'out_of_crib' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/active`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/children/:childId/sessions/summary', () => {
    it('should return daily summary', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const today = new Date().toISOString().split('T')[0];

      // Create and complete a session
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP' },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep' },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'woke_up' },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'out_of_crib' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/summary?date=${today}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.date).toBe(today);
      expect(body.data.napCount).toBeGreaterThanOrEqual(0);
      expect(body.data.sessions).toBeDefined();
    });
  });

  describe('GET /api/children/:childId/sessions/:sessionId', () => {
    it('should get a specific session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
          notes: 'Test note',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.id).toBe(sessionId);
      expect(body.data.notes).toBe('Test note');
    });

    it('should return 404 for non-existent session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/non-existent-id`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/children/:childId/sessions/:sessionId', () => {
    it('should delete a session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          sessionType: 'NAP',
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${childId}/sessions/non-existent-id`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Wake Event Calculations (Sleep Cycles)', () => {
    /**
     * Critical test for the wake event calculation fix.
     *
     * Scenario (from user):
     * - Put down: 8:55am
     * - Baby cries at 9:21am (wake event BEFORE session.asleepAt)
     * - Baby falls asleep: 9:36am (this is both session.asleepAt AND fellBackAsleepAt on wake event)
     * - Baby wakes: 9:50am (session.wokeUpAt)
     * - Out of crib: 10:21am
     *
     * Expected results:
     * - Settling time: 41 min (8:55 → 9:36)
     * - Sleep: 14 min (9:36 → 9:50)
     * - Post-wake: 31 min (9:50 → 10:21)
     * - Total: 86 min (8:55 → 10:21)
     *
     * The bug was: when a wake event has wokeUpAt < session.asleepAt,
     * the awake time from that event was incorrectly subtracted from sleep time.
     */
    it('should correctly calculate sleep when wake event is before session.asleepAt', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Base time - 8:55am today
      const baseDate = new Date();
      baseDate.setHours(8, 55, 0, 0);

      const putDownAt = baseDate.toISOString();
      const wakeEventAt = new Date(baseDate.getTime() + 26 * 60000).toISOString(); // 9:21am (+26 min)
      const asleepAt = new Date(baseDate.getTime() + 41 * 60000).toISOString(); // 9:36am (+41 min)
      const wokeUpAt = new Date(baseDate.getTime() + 55 * 60000).toISOString(); // 9:50am (+55 min)
      const outOfCribAt = new Date(baseDate.getTime() + 86 * 60000).toISOString(); // 10:21am (+86 min)

      // Create session with all timestamps (simulating a completed session)
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          sessionType: 'NAP',
          napNumber: 1,
          putDownAt,
        },
      });

      const sessionId = JSON.parse(createResponse.body).data.id;

      // Transition through states with specific times
      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep', asleepAt },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'woke_up', wokeUpAt },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'out_of_crib', outOfCribAt },
      });

      // Now add a wake event that occurred BEFORE asleepAt (crying during settling)
      const cycleResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions/${sessionId}/cycles`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          wokeUpAt: wakeEventAt, // 9:21am - before asleepAt of 9:36am
          fellBackAsleepAt: asleepAt, // 9:36am - same as session.asleepAt
          wakeType: 'CRYING',
        },
      });

      expect(cycleResponse.statusCode).toBe(201);

      // Get the updated session
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const session = JSON.parse(getResponse.body).data;

      // Verify the calculations
      expect(session.totalMinutes).toBe(86); // 8:55 → 10:21 = 86 min
      expect(session.settlingMinutes).toBe(41); // 8:55 → 9:36 = 41 min
      expect(session.sleepMinutes).toBe(14); // 9:36 → 9:50 = 14 min (THIS IS THE CRITICAL CHECK)
      expect(session.postWakeMinutes).toBe(31); // 9:50 → 10:21 = 31 min

      // Sleep should NOT be 0 or negative (the bug we fixed)
      expect(session.sleepMinutes).toBeGreaterThan(0);
    });

    it('should correctly calculate sleep with multiple wake events including pre-sleep events', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Timeline:
      // 8:00 - Put down
      // 8:10 - Cry event 1 (pre-sleep, CRYING)
      // 8:20 - Fell asleep (first real sleep)
      // 8:40 - Woke up (wake event 2, QUIET)
      // 8:45 - Fell back asleep
      // 9:00 - Final woke up
      // 9:10 - Out of crib

      const baseDate = new Date();
      baseDate.setHours(8, 0, 0, 0);

      const putDownAt = baseDate.toISOString();
      const preSleepCry = new Date(baseDate.getTime() + 10 * 60000).toISOString(); // 8:10
      const firstAsleep = new Date(baseDate.getTime() + 20 * 60000).toISOString(); // 8:20
      const midWake = new Date(baseDate.getTime() + 40 * 60000).toISOString(); // 8:40
      const backAsleep = new Date(baseDate.getTime() + 45 * 60000).toISOString(); // 8:45
      const finalWoke = new Date(baseDate.getTime() + 60 * 60000).toISOString(); // 9:00
      const outOfCrib = new Date(baseDate.getTime() + 70 * 60000).toISOString(); // 9:10

      // Create session
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP', putDownAt },
      });
      const sessionId = JSON.parse(createResponse.body).data.id;

      // Progress through states
      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep', asleepAt: firstAsleep },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'woke_up', wokeUpAt: finalWoke },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'out_of_crib', outOfCribAt: outOfCrib },
      });

      // Add pre-sleep cry event (CRYING - 0% credit)
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions/${sessionId}/cycles`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          wokeUpAt: preSleepCry, // 8:10 - before firstAsleep
          fellBackAsleepAt: firstAsleep, // 8:20
          wakeType: 'CRYING',
        },
      });

      // Add mid-sleep wake event (QUIET - 50% credit)
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions/${sessionId}/cycles`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          wokeUpAt: midWake, // 8:40
          fellBackAsleepAt: backAsleep, // 8:45
          wakeType: 'QUIET',
        },
      });

      // Get final session
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const session = JSON.parse(getResponse.body).data;

      // Verify calculations
      // Total: 70 min (8:00 → 9:10)
      expect(session.totalMinutes).toBe(70);

      // Settling: 20 min (8:00 → 8:20)
      expect(session.settlingMinutes).toBe(20);

      // Sleep: should be (8:20 → 8:40) + (8:45 → 9:00) = 20 + 15 = 35 min
      // The mid-sleep awake time (8:40 → 8:45 = 5 min) should NOT be counted as sleep
      expect(session.sleepMinutes).toBe(35);

      // Post-wake: 10 min (9:00 → 9:10)
      expect(session.postWakeMinutes).toBe(10);

      // Verify sleep cycles
      expect(session.sleepCycles).toHaveLength(2);

      // First cycle (pre-sleep cry) should have 0 sleepMinutes since it's before first sleep
      const preSleepCycle = session.sleepCycles.find(
        (c: { wokeUpAt: string }) => new Date(c.wokeUpAt).getTime() === new Date(preSleepCry).getTime()
      );
      expect(preSleepCycle).toBeDefined();
      expect(preSleepCycle.awakeMinutes).toBe(10); // 8:10 → 8:20
      expect(preSleepCycle.wakeType).toBe('CRYING');

      // Second cycle (mid-sleep wake) should have sleep before it
      const midCycle = session.sleepCycles.find(
        (c: { wokeUpAt: string }) => new Date(c.wokeUpAt).getTime() === new Date(midWake).getTime()
      );
      expect(midCycle).toBeDefined();
      expect(midCycle.sleepMinutes).toBe(20); // 8:20 → 8:40
      expect(midCycle.awakeMinutes).toBe(5); // 8:40 → 8:45
      expect(midCycle.wakeType).toBe('QUIET');
    });

    it('should give 0% credit for CRYING wake events in qualifiedRestMinutes', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      const baseDate = new Date();
      baseDate.setHours(14, 0, 0, 0);

      // Simple scenario:
      // 14:00 - Put down
      // 14:10 - Fell asleep
      // 14:30 - Woke up crying
      // 14:40 - Fell back asleep
      // 15:00 - Final wake
      // 15:10 - Out of crib

      const putDownAt = baseDate.toISOString();
      const asleepAt = new Date(baseDate.getTime() + 10 * 60000).toISOString();
      const wokeUpCrying = new Date(baseDate.getTime() + 30 * 60000).toISOString();
      const backAsleep = new Date(baseDate.getTime() + 40 * 60000).toISOString();
      const finalWoke = new Date(baseDate.getTime() + 60 * 60000).toISOString();
      const outOfCrib = new Date(baseDate.getTime() + 70 * 60000).toISOString();

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sessionType: 'NAP', putDownAt },
      });
      const sessionId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'fell_asleep', asleepAt },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'woke_up', wokeUpAt: finalWoke },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { event: 'out_of_crib', outOfCribAt: outOfCrib },
      });

      // Add CRYING wake event
      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions/${sessionId}/cycles`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          wokeUpAt: wokeUpCrying,
          fellBackAsleepAt: backAsleep,
          wakeType: 'CRYING',
        },
      });

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const session = JSON.parse(getResponse.body).data;

      // Sleep: (14:10 → 14:30) + (14:40 → 15:00) = 20 + 20 = 40 min
      expect(session.sleepMinutes).toBe(40);

      // Awake time during CRYING: 10 min (14:30 → 14:40) - gets 0% credit
      // Settling time: 10 min (14:00 → 14:10) - gets 50% credit (no wake events here)
      // Post-wake time: 10 min (15:00 → 15:10) - gets 50% credit

      // Qualified rest = sleep + (quiet awake time * 0.5)
      // = 40 + (10 settling * 0.5) + (10 post-wake * 0.5) + (0 crying credit)
      // = 40 + 5 + 5 + 0 = 50
      expect(session.qualifiedRestMinutes).toBe(50);

      // Now let's test with QUIET wake type - should get 50% credit
      // Delete the CRYING event and add a QUIET one
      const cycle = session.sleepCycles[0];
      await app.inject({
        method: 'DELETE',
        url: `/api/children/${childId}/sessions/${sessionId}/cycles/${cycle.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions/${sessionId}/cycles`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          wokeUpAt: wokeUpCrying,
          fellBackAsleepAt: backAsleep,
          wakeType: 'QUIET',
        },
      });

      const quietResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const quietSession = JSON.parse(quietResponse.body).data;

      // Now QUIET wake gets 50% credit
      // Qualified rest = 40 + (10 settling * 0.5) + (10 post-wake * 0.5) + (10 quiet * 0.5)
      // = 40 + 5 + 5 + 5 = 55
      expect(quietSession.qualifiedRestMinutes).toBe(55);
    });
  });

  describe('Crib time without falling asleep', () => {
    it('should count crib time as 50% rest credit when baby never falls asleep', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Scenario: Baby put in crib but never fell asleep
      // Put down at 2:00pm, out of crib at 2:30pm (30 min crib time, no sleep)
      // Expected: qualifiedRestMinutes = 30 / 2 = 15

      // Create session with putDownAt
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          sessionType: 'NAP',
          putDownAt: '2024-01-15T14:00:00Z',
        },
      });
      expect(createResponse.statusCode).toBe(201);
      const session = JSON.parse(createResponse.body).data;

      // Skip directly to out of crib (baby never fell asleep)
      const outResponse = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${session.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          event: 'out_of_crib',
          outOfCribAt: '2024-01-15T14:30:00Z',
        },
      });
      expect(outResponse.statusCode).toBe(200);
      const completedSession = JSON.parse(outResponse.body).data;

      // Verify calculations
      expect(completedSession.sleepMinutes).toBeNull(); // No sleep
      expect(completedSession.settlingMinutes).toBe(30); // All 30 min as settling
      expect(completedSession.awakeCribMinutes).toBe(30);
      expect(completedSession.qualifiedRestMinutes).toBe(15); // 30 / 2 = 15
      expect(completedSession.totalMinutes).toBe(30);
    });

    it('should count longer crib time without sleep correctly', async () => {
      const { accessToken } = await createUserAndGetToken();
      const childId = await createTestChild(accessToken);

      // Scenario: Baby in crib for 60 minutes but never sleeps
      // Expected: qualifiedRestMinutes = 60 / 2 = 30

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/sessions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          sessionType: 'NAP',
          putDownAt: '2024-01-15T15:00:00Z',
        },
      });
      expect(createResponse.statusCode).toBe(201);
      const session = JSON.parse(createResponse.body).data;

      const outResponse = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}/sessions/${session.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          event: 'out_of_crib',
          outOfCribAt: '2024-01-15T16:00:00Z',
        },
      });
      expect(outResponse.statusCode).toBe(200);
      const completedSession = JSON.parse(outResponse.body).data;

      expect(completedSession.sleepMinutes).toBeNull();
      expect(completedSession.settlingMinutes).toBe(60);
      expect(completedSession.qualifiedRestMinutes).toBe(30); // 60 / 2 = 30
    });
  });
});
