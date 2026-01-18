import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  checkWebAuthnAvailable,
  generateRegistrationOptionsForUser,
  verifyAndStoreRegistration,
  generateAuthenticationOptionsForUser,
  verifyAuthentication,
  listCredentials,
  deleteCredential,
  WebAuthnServiceError,
} from '../services/webauthn.service.js';
import { generateTokens } from '../services/auth.service.js';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

// Schemas
const checkAvailableSchema = z.object({
  email: z.string().email(),
});

const verifyRegistrationSchema = z.object({
  response: z.any(), // WebAuthn response object
  friendlyName: z.string().optional(),
});

const generateAuthOptionsSchema = z.object({
  email: z.string().email(),
});

const verifyAuthenticationSchema = z.object({
  email: z.string().email(),
  response: z.any(), // WebAuthn response object
});


export async function webAuthnRoutes(fastify: FastifyInstance) {
  // Error handler for WebAuthn errors
  const handleError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof WebAuthnServiceError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  /**
   * Check if passkey authentication is available for an email
   * Public endpoint - used on login page
   */
  fastify.post(
    '/check-available',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof checkAvailableSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const { email } = checkAvailableSchema.parse(request.body);
        const result = await checkWebAuthnAvailable(email);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * Generate registration options
   * Protected - user must be logged in to add a passkey
   */
  fastify.post(
    '/register/options',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const options = await generateRegistrationOptionsForUser(userId);

        return reply.send({
          success: true,
          data: options,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * Verify registration and store credential
   * Protected - user must be logged in
   */
  fastify.post(
    '/register/verify',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const { response, friendlyName } = verifyRegistrationSchema.parse(
          request.body
        );

        const result = await verifyAndStoreRegistration(
          userId,
          response as RegistrationResponseJSON,
          friendlyName
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * Generate authentication options for login
   * Public endpoint - used on login page
   */
  fastify.post(
    '/authenticate/options',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof generateAuthOptionsSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const { email } = generateAuthOptionsSchema.parse(request.body);
        const options = await generateAuthenticationOptionsForUser(email);

        return reply.send({
          success: true,
          data: options,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * Verify authentication and log user in
   * Public endpoint - returns tokens on success
   */
  fastify.post(
    '/authenticate/verify',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof verifyAuthenticationSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, response } = verifyAuthenticationSchema.parse(
          request.body
        );

        const result = await verifyAuthentication(
          email,
          response as AuthenticationResponseJSON
        );

        if (!result.verified) {
          return reply.status(401).send({
            success: false,
            error: {
              code: 'AUTHENTICATION_FAILED',
              message: 'Authentication failed',
            },
          });
        }

        // Generate tokens just like normal login
        const tokens = await generateTokens(
          result.user.id,
          (payload) => fastify.jwt.sign(payload)
        );

        return reply.send({
          success: true,
          data: {
            user: result.user,
            ...tokens,
          },
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * List user's registered credentials
   * Protected
   */
  fastify.get(
    '/credentials',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.user;
        const credentials = await listCredentials(userId);

        return reply.send({
          success: true,
          data: credentials,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * Delete a credential
   * Protected
   */
  fastify.delete<{ Params: { credentialId: string } }>(
    '/credentials/:credentialId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { userId } = request.user;
        const { credentialId } = request.params;

        await deleteCredential(userId, credentialId);

        return reply.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}
