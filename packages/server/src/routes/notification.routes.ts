import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getVapidPublicKey } from '../config/secrets.js';
import { prisma } from '../config/database.js';
import { sendNotificationToUser, getSubscriptionCount } from '../services/notification.service.js';

// Push subscription format from the browser
interface PushSubscriptionBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
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
      const userId = request.user.userId;

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

      try {
        // Upsert the subscription (update if endpoint exists, create if not)
        await prisma.pushSubscription.upsert({
          where: { endpoint: subscription.endpoint },
          update: {
            userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: subscription.userAgent,
            failCount: 0, // Reset fail count on re-subscribe
            updatedAt: new Date(),
          },
          create: {
            userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: subscription.userAgent,
          },
        });

        console.log(`[Notifications] Subscription saved for user ${userId}`);

        return reply.send({
          success: true,
          data: {
            message: 'Push subscription registered successfully',
          },
        });
      } catch (error) {
        console.error('[Notifications] Failed to save subscription:', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SUBSCRIPTION_SAVE_FAILED',
            message: 'Failed to save push subscription',
          },
        });
      }
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
      const userId = request.user.userId;

      if (!endpoint) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Endpoint is required',
          },
        });
      }

      try {
        // Delete the subscription if it exists and belongs to this user
        const deleted = await prisma.pushSubscription.deleteMany({
          where: {
            endpoint,
            userId,
          },
        });

        if (deleted.count === 0) {
          console.log(`[Notifications] No subscription found for endpoint (user ${userId})`);
        } else {
          console.log(`[Notifications] Subscription removed for user ${userId}`);
        }

        return reply.send({
          success: true,
          data: {
            message: 'Push subscription removed successfully',
          },
        });
      } catch (error) {
        console.error('[Notifications] Failed to remove subscription:', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'UNSUBSCRIBE_FAILED',
            message: 'Failed to remove push subscription',
          },
        });
      }
    }
  );

  /**
   * POST /notifications/test
   * Send a test notification to the current user
   */
  app.post(
    '/test',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Send a test push notification to yourself',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  sent: { type: 'number' },
                  failed: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.userId;

      // Check if user has any subscriptions
      const count = await getSubscriptionCount(userId);
      if (count === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_SUBSCRIPTIONS',
            message: 'No push subscriptions found. Please enable notifications first.',
          },
        });
      }

      const result = await sendNotificationToUser(userId, {
        title: 'Test Notification',
        body: 'Push notifications are working! You will receive bedtime and nap reminders.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'test-notification',
        data: {
          type: 'session_update',
          url: '/settings',
        },
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * GET /notifications/status
   * Get notification status for the current user
   */
  app.get(
    '/status',
    {
      onRequest: [app.authenticate],
      schema: {
        description: 'Get push notification status for current user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  subscriptionCount: { type: 'number' },
                  hasSubscriptions: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.userId;
      const count = await getSubscriptionCount(userId);

      return reply.send({
        success: true,
        data: {
          subscriptionCount: count,
          hasSubscriptions: count > 0,
        },
      });
    }
  );
}
