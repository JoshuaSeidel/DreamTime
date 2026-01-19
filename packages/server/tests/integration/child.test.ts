import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerCors } from '../../src/plugins/cors.js';
import { registerJwt } from '../../src/plugins/jwt.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { childRoutes } from '../../src/routes/child.routes.js';
import { prisma } from '../../src/config/database.js';

describe('Child Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await registerCors(app);
    await registerJwt(app);
    registerErrorHandler(app);
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(childRoutes, { prefix: '/api/children' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data in correct order (respect foreign keys)
    await prisma.sleepSession.deleteMany();
    await prisma.scheduleTransition.deleteMany();
    await prisma.sleepSchedule.deleteMany();
    await prisma.childCaregiver.deleteMany();
    await prisma.child.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  // Helper function to create a user and get access token
  async function createUserAndGetToken(email: string = 'testuser@example.com'): Promise<{
    accessToken: string;
    userId: string;
  }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'Password123',
        name: 'Test User',
        timezone: 'America/New_York',
      },
    });

    const body = JSON.parse(response.body);
    return {
      accessToken: body.data.tokens.accessToken,
      userId: body.data.user.id,
    };
  }

  // Helper function to create a child
  async function createTestChild(accessToken: string): Promise<{
    id: string;
    name: string;
    birthDate: string;
  }> {
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
    return body.data;
  }

  describe('POST /api/children', () => {
    it('should create a new child', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'Baby Oliver',
          birthDate: '2023-06-15',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Baby Oliver');
      expect(body.data.birthDate).toContain('2023-06-15');
      expect(body.data.role).toBe('ADMIN');
      expect(body.data.id).toBeDefined();
    });

    it('should create child with photo URL', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'Baby Oliver',
          birthDate: '2023-06-15',
          photoUrl: 'https://example.com/photo.jpg',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.data.photoUrl).toBe('https://example.com/photo.jpg');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/children',
        payload: {
          name: 'Baby Oliver',
          birthDate: '2023-06-15',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate birth date format', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'Baby Oliver',
          birthDate: 'invalid-date',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/children', () => {
    it('should list all children for user', async () => {
      const { accessToken } = await createUserAndGetToken();

      // Create two children
      await createTestChild(accessToken);
      await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'Second Child',
          birthDate: '2024-01-01',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('should return empty array for user with no children', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(0);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/children',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/children/:id', () => {
    it('should get child details', async () => {
      const { accessToken } = await createUserAndGetToken();
      const child = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(child.id);
      expect(body.data.name).toBe('Test Child');
      expect(body.data.caregivers).toBeDefined();
      expect(body.data.caregivers).toHaveLength(1);
      expect(body.data.caregivers[0].role).toBe('ADMIN');
    });

    it('should return 404 for non-existent child', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/children/non-existent-id',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for child not belonging to user', async () => {
      const { accessToken: token1 } = await createUserAndGetToken('user1@example.com');
      const { accessToken: token2 } = await createUserAndGetToken('user2@example.com');

      const child = await createTestChild(token1);

      const response = await app.inject({
        method: 'GET',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${token2}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/children/:id', () => {
    it('should update child name', async () => {
      const { accessToken } = await createUserAndGetToken();
      const child = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'Updated Name',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.name).toBe('Updated Name');
    });

    it('should update child birth date', async () => {
      const { accessToken } = await createUserAndGetToken();
      const child = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          birthDate: '2023-12-01',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data.birthDate).toContain('2023-12-01');
    });

    it('should return 403 for non-admin caregiver', async () => {
      const { accessToken: adminToken, userId: adminId } = await createUserAndGetToken('admin@example.com');
      const { accessToken: caregiverToken, userId: caregiverId } = await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // Share with caregiver and have them accept
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/accept`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      // Try to update as caregiver
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
        payload: {
          name: 'Hacked Name',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/children/:id', () => {
    it('should delete child', async () => {
      const { accessToken } = await createUserAndGetToken();
      const child = await createTestChild(accessToken);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);

      // Verify child is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 403 for non-admin', async () => {
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      const { accessToken: caregiverToken } = await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // Share and accept
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/accept`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      // Try to delete as caregiver
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${child.id}`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/children/:id/share', () => {
    it('should invite a caregiver', async () => {
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('caregiver@example.com');
      expect(body.data.role).toBe('CAREGIVER');
      // Caregivers are granted immediate access (auto-accepted)
      expect(body.data.status).toBe('ACCEPTED');
    });

    it('should invite a viewer', async () => {
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      await createUserAndGetToken('viewer@example.com');

      const child = await createTestChild(adminToken);

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'viewer@example.com',
          role: 'VIEWER',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.data.role).toBe('VIEWER');
    });

    it('should return 404 for non-existent user email', async () => {
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      const child = await createTestChild(adminToken);

      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'nonexistent@example.com',
          role: 'CAREGIVER',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 for already invited user', async () => {
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // First invite
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      // Second invite should fail
      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/children/:id/accept', () => {
    it('should return error for already accepted caregiver', async () => {
      // In the current implementation, caregivers are auto-accepted when shared
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      const { accessToken: caregiverToken } = await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // Share with caregiver (auto-accepts)
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      // Trying to accept should return error since already accepted
      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/accept`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ALREADY_ACCEPTED');

      // Verify caregiver can already see the child (immediate access)
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(1);
    });
  });

  describe('POST /api/children/:id/decline', () => {
    it('should return error when declining already accepted access', async () => {
      // In the current implementation, caregivers are auto-accepted when shared
      // So declining will fail because status is not PENDING
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      const { accessToken: caregiverToken } = await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // Share with caregiver (auto-accepts)
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      // Decline invitation should fail since already accepted
      const response = await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/decline`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_STATUS');

      // Verify caregiver still has access
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(1);
    });
  });

  describe('GET /api/children/invitations', () => {
    it('should return empty array since caregivers are auto-accepted', async () => {
      // In the current implementation, caregivers are auto-accepted when shared
      // So there are no pending invitations
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      const { accessToken: caregiverToken } = await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // Share with caregiver (auto-accepts)
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/children/invitations',
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      const body = JSON.parse(response.body);

      // No pending invitations since caregiver was auto-accepted
      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(0);

      // Verify caregiver already has access via regular list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].name).toBe('Test Child');
      expect(listBody.data[0].role).toBe('CAREGIVER');
    });

    it('should return empty array when no pending invitations', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/children/invitations',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('DELETE /api/children/:id/caregivers/:caregiverId', () => {
    it('should remove a caregiver', async () => {
      const { accessToken: adminToken } = await createUserAndGetToken('admin@example.com');
      const { accessToken: caregiverToken, userId: caregiverId } = await createUserAndGetToken('caregiver@example.com');

      const child = await createTestChild(adminToken);

      // Share and accept
      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/share`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          email: 'caregiver@example.com',
          role: 'CAREGIVER',
        },
      });

      await app.inject({
        method: 'POST',
        url: `/api/children/${child.id}/accept`,
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      // Remove caregiver
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${child.id}/caregivers/${caregiverId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify caregiver can no longer see the child
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/children',
        headers: {
          authorization: `Bearer ${caregiverToken}`,
        },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(0);
    });

    it('should not allow removing self as admin', async () => {
      const { accessToken: adminToken, userId: adminId } = await createUserAndGetToken('admin@example.com');
      const child = await createTestChild(adminToken);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/children/${child.id}/caregivers/${adminId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
