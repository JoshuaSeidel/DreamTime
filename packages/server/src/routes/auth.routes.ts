import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  type RegisterInput,
  type LoginInput,
  type RefreshTokenInput,
} from '../schemas/auth.schema.js';
import {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAllDevices,
  AuthServiceError,
} from '../services/auth.service.js';
import { successResponse, errorResponse } from '../types/api.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Register
  app.post<{ Body: RegisterInput }>(
    '/register',
    {
      schema: {
        description: 'Register a new user account',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 1 },
            timezone: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      timezone: { type: 'string' },
                      createdAt: { type: 'string' },
                    },
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
      try {
        // Validate input
        const input = registerSchema.parse(request.body);

        // Register user
        const result = await register(input, (payload) => app.jwt.sign(payload));

        return reply.status(201).send(successResponse(result));
      } catch (error) {
        if (error instanceof AuthServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Login
  app.post<{ Body: LoginInput }>(
    '/login',
    {
      schema: {
        description: 'Login with email and password',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      timezone: { type: 'string' },
                      createdAt: { type: 'string' },
                    },
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) => {
      try {
        // Validate input
        const input = loginSchema.parse(request.body);

        // Login user
        const result = await login(input, (payload) => app.jwt.sign(payload));

        return reply.send(successResponse(result));
      } catch (error) {
        if (error instanceof AuthServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Refresh token
  app.post<{ Body: RefreshTokenInput }>(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token using refresh token',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RefreshTokenInput }>, reply: FastifyReply) => {
      try {
        // Validate input
        const input = refreshTokenSchema.parse(request.body);

        // Refresh tokens
        const tokens = await refreshAccessToken(
          input.refreshToken,
          (payload) => app.jwt.sign(payload)
        );

        return reply.send(successResponse(tokens));
      } catch (error) {
        if (error instanceof AuthServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Logout
  app.post<{ Body: RefreshTokenInput }>(
    '/logout',
    {
      schema: {
        description: 'Logout and invalidate refresh token',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RefreshTokenInput }>, reply: FastifyReply) => {
      const input = refreshTokenSchema.parse(request.body);
      await logout(input.refreshToken);
      return reply.send(successResponse({ message: 'Logged out successfully' }));
    }
  );

  // Logout all devices (requires authentication)
  app.post(
    '/logout-all',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Logout from all devices',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user;
      await logoutAllDevices(userId);
      return reply.send(successResponse({ message: 'Logged out from all devices' }));
    }
  );

  // Get current user (requires authentication)
  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get current authenticated user',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  timezone: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user;

      const user = await import('../services/auth.service.js').then((m) =>
        m.getUserById(userId)
      );

      if (!user) {
        return reply.status(404).send(errorResponse('USER_NOT_FOUND', 'User not found'));
      }

      return reply.send(successResponse(user));
    }
  );
}
