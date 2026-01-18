import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getVapidPublicKey } from '../config/secrets.js';

// Push subscription format from the browser
interface PushSubscriptionBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UnsubscribeBody {
  endpoint: string;
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /notifications/vapid-public-key
   * Returns the VAPID public key for push notification subscription
   * Public endpoint - no authentication required
   */
  app.get('/vapid-public-key', async (_request: FastifyRequest, reply: FastifyReply) => {
    const vapidPublicKey = getVapidPublicKey();
    console.log('[Notifications] VAPID public key request, key exists:', !!vapidPublicKey, 'key length:', vapidPublicKey?.length || 0);

    if (!vapidPublicKey) {
      console.error('[Notifications] VAPID public key not configured - check secrets generation');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'PUSH_NOT_CONFIGURED',
          message: 'Push notifications are not configured on the server',
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        vapidPublicKey,
      },
    });
  });

  /**
   * POST /notifications/subscribe
   * Register a push subscription for the authenticated user
   */
  app.post<{ Body: PushSubscriptionBody }>(
    '/subscribe',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Register a push notification subscription',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: { type: 'string' },
            keys: {
              type: 'object',
              required: ['p256dh', 'auth'],
              properties: {
                p256dh: { type: 'string' },
                auth: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: PushSubscriptionBody }>, reply: FastifyReply) => {
      const subscription = request.body;

      // Validate subscription format
      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION',
            message: 'Invalid push subscription format',
          },
        });
      }

      // TODO: Store subscription in database associated with user
      // For now, we'll just acknowledge the subscription

      return reply.send({
        success: true,
        data: {
          message: 'Push subscription registered successfully',
        },
      });
    }
  );

  /**
   * POST /notifications/unsubscribe
   * Remove a push subscription for the authenticated user
   */
  app.post<{ Body: UnsubscribeBody }>(
    '/unsubscribe',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Remove a push notification subscription',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['endpoint'],
          properties: {
            endpoint: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UnsubscribeBody }>, reply: FastifyReply) => {
      const { endpoint } = request.body;

      if (!endpoint) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Endpoint is required',
          },
        });
      }

      // TODO: Remove subscription from database
      // For now, we'll just acknowledge the unsubscribe

      return reply.send({
        success: true,
        data: {
          message: 'Push subscription removed successfully',
        },
      });
    }
  );
}
