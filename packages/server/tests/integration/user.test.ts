import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerCors } from '../../src/plugins/cors.js';
import { registerJwt } from '../../src/plugins/jwt.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { userRoutes } from '../../src/routes/user.routes.js';
import { prisma } from '../../src/config/database.js';

describe('User Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await registerCors(app);
    await registerJwt(app);
    registerErrorHandler(app);
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(userRoutes, { prefix: '/api/users' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  // Helper function to create a user and get access token
  async function createUserAndGetToken(): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
  }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'testuser@example.com',
        password: 'Password123',
        name: 'Test User',
        timezone: 'America/New_York',
      },
    });

    const body = JSON.parse(response.body);
    return {
      accessToken: body.data.tokens.accessToken,
      refreshToken: body.data.tokens.refreshToken,
      userId: body.data.user.id,
    };
  }

  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('testuser@example.com');
      expect(body.data.name).toBe('Test User');
      expect(body.data.timezone).toBe('America/New_York');
      expect(body.data.id).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.updatedAt).toBeDefined();
      // Password should not be returned
      expect(body.data.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update user name', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'Updated Name',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
      // Other fields should remain unchanged
      expect(body.data.email).toBe('testuser@example.com');
      expect(body.data.timezone).toBe('America/New_York');
    });

    it('should update user timezone', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          timezone: 'Europe/London',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.timezone).toBe('Europe/London');
      expect(body.data.name).toBe('Test User');
    });

    it('should update both name and timezone', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'New Name',
          timezone: 'Asia/Tokyo',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('New Name');
      expect(body.data.timezone).toBe('Asia/Tokyo');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        payload: {
          name: 'New Name',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject empty name', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should allow empty update (no changes)', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /api/users/me', () => {
    it('should delete user account', async () => {
      const { accessToken, userId } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Account deleted successfully');

      // Verify user is deleted from database
      const deletedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(deletedUser).toBeNull();
    });

    it('should delete refresh tokens when user is deleted', async () => {
      const { accessToken, userId } = await createUserAndGetToken();

      // Verify refresh tokens exist before deletion
      const tokensBefore = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokensBefore.length).toBeGreaterThan(0);

      await app.inject({
        method: 'DELETE',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Verify refresh tokens are deleted
      const tokensAfter = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokensAfter.length).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/users/me/password', () => {
    it('should change password successfully', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toContain('Password changed successfully');
    });

    it('should allow login with new password', async () => {
      const { accessToken } = await createUserAndGetToken();

      // Change password
      await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        },
      });

      // Try to login with new password
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'testuser@example.com',
          password: 'NewPassword456',
        },
      });

      expect(loginResponse.statusCode).toBe(200);
    });

    it('should reject login with old password after change', async () => {
      const { accessToken } = await createUserAndGetToken();

      // Change password
      await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        },
      });

      // Try to login with old password
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'testuser@example.com',
          password: 'Password123',
        },
      });

      expect(loginResponse.statusCode).toBe(401);
    });

    it('should revoke all refresh tokens after password change', async () => {
      const { accessToken, refreshToken, userId } = await createUserAndGetToken();

      // Create another login session
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'testuser@example.com',
          password: 'Password123',
        },
      });

      // Verify we have multiple refresh tokens
      const tokensBefore = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokensBefore.length).toBe(2);

      // Change password
      await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        },
      });

      // Verify all refresh tokens are revoked
      const tokensAfter = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokensAfter.length).toBe(0);

      // Old refresh token should not work
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      });
      expect(refreshResponse.statusCode).toBe(401);
    });

    it('should reject wrong current password', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword456',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should validate new password requirements', async () => {
      const { accessToken } = await createUserAndGetToken();

      const response = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          currentPassword: 'Password123',
          newPassword: 'weak',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        payload: {
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
