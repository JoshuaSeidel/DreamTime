import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check (no prefix)
  await app.register(healthRoutes);

  // API routes will be registered here with /api prefix
  await app.register(async (api) => {
    // Auth routes
    // await api.register(authRoutes, { prefix: '/auth' });

    // User routes
    // await api.register(userRoutes, { prefix: '/users' });

    // Children routes
    // await api.register(childrenRoutes, { prefix: '/children' });
  }, { prefix: '/api' });
}
