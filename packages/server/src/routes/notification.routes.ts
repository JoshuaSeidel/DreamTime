import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getVapidPublicKey } from '../config/secrets.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

// In-memory storage for push subscriptions (in production, use database)
// For now, we'll just validate the subscription format
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /notifications/vapid-public-key
   * Returns the VAPID public key for push notification subscription
   * Public endpoint - no authentication required
   */
  app.get('/vapid-public-key', async (_request: FastifyRequest, reply: FastifyReply) => {
    const vapidPublicKey = getVapidPublicKey();

    if (!vapidPublicKey) {
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
  app.post('/subscribe', {
    preHandler: authenticateToken,
  }, async (request: FastifyRequest<{ Body: PushSubscription }>, reply: FastifyReply) => {
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
    // const userId = (request as { userId?: string }).userId;

    return reply.send({
      success: true,
      data: {
        message: 'Push subscription registered successfully',
      },
    });
  });

  /**
   * POST /notifications/unsubscribe
   * Remove a push subscription for the authenticated user
   */
  app.post('/unsubscribe', {
    preHandler: authenticateToken,
  }, async (request: FastifyRequest<{ Body: { endpoint: string } }>, reply: FastifyReply) => {
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
  });
}
