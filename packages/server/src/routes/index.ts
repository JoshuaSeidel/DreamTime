import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';
import { childRoutes } from './child.routes.js';
import { scheduleRoutes } from './schedule.routes.js';
import { sessionRoutes } from './session.routes.js';
import { calculatorRoutes } from './calculator.routes.js';
import { analyticsRoutes } from './analytics.routes.js';
import { webAuthnRoutes } from './webauthn.routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check (no prefix)
  await app.register(healthRoutes);

  // API routes will be registered here with /api prefix
  await app.register(async (api) => {
    // Auth routes
    await api.register(authRoutes, { prefix: '/auth' });

    // WebAuthn routes (Face ID, Touch ID, biometric)
    await api.register(webAuthnRoutes, { prefix: '/webauthn' });

    // User routes
    await api.register(userRoutes, { prefix: '/users' });

    // Children routes
    await api.register(childRoutes, { prefix: '/children' });

    // Schedule routes (nested under children)
    await api.register(scheduleRoutes, { prefix: '/children' });

    // Session routes (nested under children)
    await api.register(sessionRoutes, { prefix: '/children' });

    // Calculator routes (nested under children)
    await api.register(calculatorRoutes, { prefix: '/children' });

    // Analytics routes (nested under children)
    await api.register(analyticsRoutes, { prefix: '/children' });
  }, { prefix: '/api' });
}
