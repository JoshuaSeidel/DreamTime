import Fastify from 'fastify';
import { env, logConfig } from './config/env.js';
import { initializeDatabase } from './config/init-db.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { registerCors } from './plugins/cors.js';
import { registerJwt } from './plugins/jwt.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerRoutes } from './routes/index.js';
import { startReminderScheduler, stopReminderScheduler } from './services/reminder.scheduler.service.js';
import { initializeMqtt, disconnectMqtt } from './services/mqtt.service.js';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Register plugins
  await registerCors(app);
  await registerJwt(app);
  await registerSwagger(app);
  registerErrorHandler(app);

  // Register routes
  await registerRoutes(app);

  return app;
}

async function start() {
  console.log('Starting DreamTime server...');
  console.log('');
  logConfig();
  console.log('');

  // Initialize database (create if needed, run migrations)
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  const app = await buildApp();

  // Connect to database
  await connectDatabase();

  // Start the reminder scheduler for push notifications
  startReminderScheduler();

  // Initialize MQTT for Home Assistant integration
  await initializeMqtt();

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'] as const;
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down...`);
      stopReminderScheduler();
      await disconnectMqtt();
      await app.close();
      await disconnectDatabase();
      process.exit(0);
    });
  });

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`API docs available at http://localhost:${env.PORT}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();

export { buildApp };
