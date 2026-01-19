import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createChildSchema,
  updateChildSchema,
  shareChildSchema,
  toggleCaregiverAccessSchema,
  updateCaregiverTitleSchema,
  updateCaregiverRoleSchema,
  type CreateChildInput,
  type UpdateChildInput,
  type ShareChildInput,
  type ToggleCaregiverAccessInput,
  type UpdateCaregiverTitleInput,
  type UpdateCaregiverRoleInput,
} from '../schemas/child.schema.js';
import {
  listChildren,
  createChild,
  getChild,
  updateChild,
  deleteChild,
  shareChild,
  removeCaregiver,
  acceptInvitation,
  declineInvitation,
  getPendingInvitations,
  toggleCaregiverAccess,
  updateCaregiverTitle,
  updateCaregiverRole,
  ChildServiceError,
} from '../services/child.service.js';
import { successResponse, errorResponse } from '../types/api.js';

export async function childRoutes(app: FastifyInstance): Promise<void> {
  // List all children for the current user
  app.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'List all children for the current user',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
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
                    name: { type: 'string' },
                    birthDate: { type: 'string' },
                    photoUrl: { type: 'string', nullable: true },
                    role: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user;
      const children = await listChildren(userId);
      return reply.send(successResponse(children));
    }
  );

  // Create a new child
  app.post<{ Body: CreateChildInput }>(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Create a new child profile',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'birthDate'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            birthDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            photoUrl: { type: 'string', format: 'uri' },
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
                  id: { type: 'string' },
                  name: { type: 'string' },
                  birthDate: { type: 'string' },
                  photoUrl: { type: 'string', nullable: true },
                  role: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateChildInput }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const input = createChildSchema.parse(request.body);
        const child = await createChild(userId, input as unknown as CreateChildInput);
        return reply.status(201).send(successResponse(child));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Get pending invitations
  app.get(
    '/invitations',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get pending caregiver invitations',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
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
                    child: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                    role: { type: 'string' },
                    invitedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user;
      const invitations = await getPendingInvitations(userId);
      return reply.send(successResponse(invitations));
    }
  );

  // Get a specific child
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get child details',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
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
                  name: { type: 'string' },
                  birthDate: { type: 'string' },
                  photoUrl: { type: 'string', nullable: true },
                  role: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  caregivers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        userId: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string' },
                        role: { type: 'string' },
                        status: { type: 'string' },
                        title: { type: 'string', nullable: true },
                        isActive: { type: 'boolean' },
                        invitedAt: { type: 'string' },
                        acceptedAt: { type: 'string', nullable: true },
                      },
                    },
                  },
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = request.user;
      const { id } = request.params;

      const child = await getChild(userId, id);

      if (!child) {
        return reply.status(404).send(
          errorResponse('CHILD_NOT_FOUND', 'Child not found')
        );
      }

      return reply.send(successResponse(child));
    }
  );

  // Update a child
  app.patch<{ Params: { id: string }; Body: UpdateChildInput }>(
    '/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update child profile (ADMIN only)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            birthDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            photoUrl: { type: 'string', format: 'uri', nullable: true },
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
                  name: { type: 'string' },
                  birthDate: { type: 'string' },
                  photoUrl: { type: 'string', nullable: true },
                  role: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateChildInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { id } = request.params;
        const input = updateChildSchema.parse(request.body);

        const child = await updateChild(userId, id, input as unknown as UpdateChildInput);

        return reply.send(successResponse(child));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Delete a child
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Delete child profile (ADMIN only)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const { id } = request.params;

        await deleteChild(userId, id);

        return reply.send(successResponse({ message: 'Child profile deleted successfully' }));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Share child with another user
  app.post<{ Params: { id: string }; Body: ShareChildInput }>(
    '/:id/share',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Add a caregiver by userId or email (ADMIN only)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['CAREGIVER', 'VIEWER'] },
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
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  invitedAt: { type: 'string' },
                  acceptedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: ShareChildInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { id } = request.params;
        const input = shareChildSchema.parse(request.body);

        const caregiver = await shareChild(userId, id, input);

        return reply.status(201).send(successResponse(caregiver));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Remove a caregiver
  app.delete<{ Params: { id: string; caregiverId: string } }>(
    '/:id/caregivers/:caregiverId',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Remove a caregiver (ADMIN only)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            caregiverId: { type: 'string' },
          },
          required: ['id', 'caregiverId'],
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
    async (
      request: FastifyRequest<{ Params: { id: string; caregiverId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { id, caregiverId } = request.params;

        await removeCaregiver(userId, id, caregiverId);

        return reply.send(successResponse({ message: 'Caregiver removed successfully' }));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Accept invitation
  app.post<{ Params: { id: string } }>(
    '/:id/accept',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Accept a caregiver invitation',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
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
                  name: { type: 'string' },
                  birthDate: { type: 'string' },
                  photoUrl: { type: 'string', nullable: true },
                  role: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const { id } = request.params;

        const child = await acceptInvitation(userId, id);

        return reply.send(successResponse(child));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Decline invitation
  app.post<{ Params: { id: string } }>(
    '/:id/decline',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Decline a caregiver invitation',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const { id } = request.params;

        await declineInvitation(userId, id);

        return reply.send(successResponse({ message: 'Invitation declined' }));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Toggle caregiver access (enable/disable)
  app.patch<{ Params: { id: string; caregiverId: string }; Body: ToggleCaregiverAccessInput }>(
    '/:id/caregivers/:caregiverId/access',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Enable or disable caregiver access (ADMIN only)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            caregiverId: { type: 'string' },
          },
          required: ['id', 'caregiverId'],
        },
        body: {
          type: 'object',
          required: ['isActive'],
          properties: {
            isActive: { type: 'boolean' },
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
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  title: { type: 'string', nullable: true },
                  isActive: { type: 'boolean' },
                  invitedAt: { type: 'string' },
                  acceptedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; caregiverId: string }; Body: ToggleCaregiverAccessInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { id, caregiverId } = request.params;
        const input = toggleCaregiverAccessSchema.parse(request.body);

        const caregiver = await toggleCaregiverAccess(userId, id, caregiverId, input.isActive);

        return reply.send(successResponse(caregiver));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Update caregiver title
  app.patch<{ Params: { id: string; caregiverId: string }; Body: UpdateCaregiverTitleInput }>(
    '/:id/caregivers/:caregiverId/title',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update caregiver title (ADMIN can update any, users can update their own)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            caregiverId: { type: 'string' },
          },
          required: ['id', 'caregiverId'],
        },
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 50 },
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
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  title: { type: 'string', nullable: true },
                  isActive: { type: 'boolean' },
                  invitedAt: { type: 'string' },
                  acceptedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; caregiverId: string }; Body: UpdateCaregiverTitleInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { id, caregiverId } = request.params;
        const input = updateCaregiverTitleSchema.parse(request.body);

        const caregiver = await updateCaregiverTitle(userId, id, caregiverId, input.title);

        return reply.send(successResponse(caregiver));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );

  // Update caregiver role (promote to admin, etc.)
  app.patch<{ Params: { id: string; caregiverId: string }; Body: UpdateCaregiverRoleInput }>(
    '/:id/caregivers/:caregiverId/role',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Update caregiver role (ADMIN only)',
        tags: ['Children'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            caregiverId: { type: 'string' },
          },
          required: ['id', 'caregiverId'],
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['ADMIN', 'CAREGIVER', 'VIEWER'] },
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
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  title: { type: 'string', nullable: true },
                  isActive: { type: 'boolean' },
                  invitedAt: { type: 'string' },
                  acceptedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; caregiverId: string }; Body: UpdateCaregiverRoleInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.user;
        const { id, caregiverId } = request.params;
        const input = updateCaregiverRoleSchema.parse(request.body);

        const caregiver = await updateCaregiverRole(userId, id, caregiverId, input.role);

        return reply.send(successResponse(caregiver));
      } catch (error) {
        if (error instanceof ChildServiceError) {
          return reply.status(error.statusCode).send(
            errorResponse(error.code, error.message)
          );
        }
        throw error;
      }
    }
  );
}
