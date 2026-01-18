import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerCors } from '../../src/plugins/cors.js';
import { registerJwt } from '../../src/plugins/jwt.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { prisma } from '../../src/config/database.js';

describe('Auth Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await registerCors(app);
    await registerJwt(app);
    registerErrorHandler(app);
    await app.register(authRoutes, { prefix: '/api/auth' });

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

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'newuser@example.com',
          password: 'Password123',
          name: 'New User',
          timezone: 'America/New_York',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe('newuser@example.com');
      expect(body.data.user.name).toBe('New User');
      expect(body.data.user.timezone).toBe('America/New_York');
      expect(body.data.user.id).toBeDefined();
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
      expect(body.data.tokens.expiresIn).toBeDefined();
      // Password should not be returned
      expect(body.data.user.password).toBeUndefined();
    });

    it('should normalize email to lowercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'UPPERCASE@EXAMPLE.COM',
          password: 'Password123',
          name: 'Test User',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.data.user.email).toBe('uppercase@example.com');
    });

    it('should use default timezone if not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.data.user.timezone).toBe('America/New_York');
    });

    it('should return 409 if email already exists', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'Password123',
          name: 'Existing User',
        },
      });

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'Password456',
          name: 'Another User',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(409);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should validate email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'Password123',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate password requirements', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'testuser@example.com',
          password: 'Password123',
          name: 'Test User',
        },
      });
    });

    it('should login with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'testuser@example.com',
          password: 'Password123',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe('testuser@example.com');
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
    });

    it('should login with case-insensitive email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'TESTUSER@EXAMPLE.COM',
          password: 'Password123',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 401 for incorrect password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'testuser@example.com',
          password: 'WrongPassword',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'Password123',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should validate email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'not-an-email',
          password: 'Password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login a test user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'refreshtest@example.com',
          password: 'Password123',
          name: 'Refresh Test User',
        },
      });

      const body = JSON.parse(registerResponse.body);
      refreshToken = body.data.tokens.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      // New refresh token should be different (token rotation)
      expect(body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should invalidate old refresh token after use', async () => {
      // Use the refresh token
      await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken,
        },
      });

      // Try to use the same refresh token again
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should require refreshToken in body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login a test user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'logouttest@example.com',
          password: 'Password123',
          name: 'Logout Test User',
        },
      });

      const body = JSON.parse(registerResponse.body);
      refreshToken = body.data.tokens.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: {
          refreshToken,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Logged out successfully');
    });

    it('should invalidate refresh token after logout', async () => {
      // Logout
      await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: {
          refreshToken,
        },
      });

      // Try to refresh with the logged-out token
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should not error when logging out with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    let accessToken: string;
    let refreshToken1: string;
    let refreshToken2: string;

    beforeEach(async () => {
      // Create a test user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'logoutalltest@example.com',
          password: 'Password123',
          name: 'Logout All Test User',
        },
      });

      const body = JSON.parse(registerResponse.body);
      accessToken = body.data.tokens.accessToken;
      refreshToken1 = body.data.tokens.refreshToken;

      // Login again to create another refresh token
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'logoutalltest@example.com',
          password: 'Password123',
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      refreshToken2 = loginBody.data.tokens.refreshToken;
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout-all',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should logout from all devices', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout-all',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Logged out from all devices');

      // Both refresh tokens should be invalid
      const refresh1Response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: refreshToken1 },
      });
      expect(refresh1Response.statusCode).toBe(401);

      const refresh2Response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: refreshToken2 },
      });
      expect(refresh2Response.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create and login a test user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'metest@example.com',
          password: 'Password123',
          name: 'Me Test User',
          timezone: 'Europe/London',
        },
      });

      const body = JSON.parse(registerResponse.body);
      accessToken = body.data.tokens.accessToken;
      userId = body.data.user.id;
    });

    it('should return current user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(userId);
      expect(body.data.email).toBe('metest@example.com');
      expect(body.data.name).toBe('Me Test User');
      expect(body.data.timezone).toBe('Europe/London');
      expect(body.data.createdAt).toBeDefined();
      // Password should not be returned
      expect(body.data.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
