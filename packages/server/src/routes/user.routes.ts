import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  updateUserSchema,
  type UpdateUserInput,
} from '../schemas/user.schema.js';
import {
  getUserProfile,
  updateUserProfile,
  deleteUser,
  changePassword,
  searchUsers,
  completeOnboarding,
  UserServiceError,
} from '../services/user.service.js';
import { successResponse, errorResponse } from '../types/api.js';

// Schema for change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Get current user profile
  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get current user profile',
        tags: ['Users'],
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
                  onboardingCompleted: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
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

      const user = await getUserProfile(userId);

      if (!user) {
        return reply.status(404).send(
          errorResponse('USER_NOT_FOUND', 'User not found')
        );
      }

      return reply.send(successResponse(user));
    }
  );

  // Update current user profile
  app.patch<{ Body: UpdateUserInput }>(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update current user profile',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            timezone: { type: 'string' },
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
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  timezone: { type: 'string' },
                  onboardingCompleted: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UpdateUserInput }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const input = updateUserSchema.parse(request.body);

        const user = await updateUserProfile(userId, input);

        return reply.send(successResponse(user));
      } catch (error) {
        if (error instanceof UserServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Delete current user account
  app.delete(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Delete current user account',
        tags: ['Users'],
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
      try {
        const { userId } = request.user;

        await deleteUser(userId);

        return reply.send(
          successResponse({ message: 'Account deleted successfully' })
        );
      } catch (error) {
        if (error instanceof UserServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Search users (for adding caregivers)
  app.get<{ Querystring: { q: string; limit?: string } }>(
    '/search',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Search users by name or email',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 2 },
            limit: { type: 'string' },
          },
          required: ['q'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { q: string; limit?: string } }>, reply: FastifyReply) => {
      const { userId } = request.user;
      const { q, limit } = request.query;

      const users = await searchUsers(userId, q, limit ? parseInt(limit, 10) : 10);

      return reply.send(successResponse(users));
    }
  );

  // Complete onboarding
  app.post(
    '/me/onboarding-complete',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Mark onboarding as completed',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  onboardingCompleted: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.user;

        await completeOnboarding(userId);

        return reply.send(successResponse({ onboardingCompleted: true }));
      } catch (error) {
        if (error instanceof UserServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Change password
  app.post<{ Body: ChangePasswordInput }>(
    '/me/password',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Change password',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
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
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ChangePasswordInput }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const input = changePasswordSchema.parse(request.body);

        await changePassword(userId, input.currentPassword, input.newPassword);

        return reply.send(
          successResponse({
            message: 'Password changed successfully. Please log in again on all devices.',
          })
        );
      } catch (error) {
        if (error instanceof UserServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );
}
