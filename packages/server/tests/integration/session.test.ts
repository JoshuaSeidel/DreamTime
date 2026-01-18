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
});
