import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the root directory of the monorepo
function getMonorepoRoot(): string {
  // In production (compiled), __dirname points to dist/config
  // In development (tsx), import.meta.url is used
  const currentDir = typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

  // Navigate up from packages/server/src/config (or dist/config) to root
  return join(currentDir, '..', '..', '..', '..');
}

function getPrismaSchemaPath(): string {
  return join(getMonorepoRoot(), 'prisma', 'schema.prisma');
}

export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const schemaPath = getPrismaSchemaPath();

  console.log('Initializing database...');
  console.log(`Using Prisma schema: ${schemaPath}`);

  // Detect database type
  const isSqlite = databaseUrl.startsWith('file:');
  const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');

  if (isSqlite) {
    await initializeSqlite(databaseUrl);
  } else if (isPostgres) {
    await initializePostgres(databaseUrl);
  } else {
    throw new Error(`Unsupported database URL: ${databaseUrl}`);
  }

  // Run migrations
  await runMigrations();
}

async function initializeSqlite(databaseUrl: string): Promise<void> {
  // Extract file path from URL (format: file:./path/to/db.db)
  const filePath = databaseUrl.replace('file:', '');

  if (!existsSync(filePath)) {
    console.log('SQLite database does not exist, will be created on first migration');
  } else {
    console.log('SQLite database exists at', filePath);
  }
}

async function initializePostgres(databaseUrl: string): Promise<void> {
  // Parse connection string to extract database name
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1); // Remove leading /

  // Create connection string without the database name (connect to postgres db)
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  console.log(`Checking if PostgreSQL database '${dbName}' exists...`);

  try {
    // Try to connect to the target database
    const { PrismaClient } = await import('@prisma/client');
    const testClient = new PrismaClient();
    await testClient.$connect();
    await testClient.$disconnect();
    console.log(`Database '${dbName}' exists and is accessible`);
  } catch (error: unknown) {
    const err = error as { code?: string };
    // Database doesn't exist, try to create it
    if (err.code === 'P1003' || (error instanceof Error && error.message.includes('does not exist'))) {
      console.log(`Database '${dbName}' does not exist, attempting to create...`);

      try {
        // Use psql to create the database
        const createDbCommand = `psql "${adminUrl.toString()}" -c "CREATE DATABASE ${dbName};"`;
        execSync(createDbCommand, { stdio: 'pipe' });
        console.log(`Database '${dbName}' created successfully`);
      } catch (createError) {
        // Try alternative: use node-postgres if available
        console.log('Attempting to create database using direct connection...');
        await createPostgresDatabase(adminUrl.toString(), dbName);
      }
    } else {
      throw error;
    }
  }
}

async function createPostgresDatabase(adminUrl: string, dbName: string): Promise<void> {
  // Dynamic import to avoid issues if pg is not installed
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: adminUrl });

    await client.connect();

    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully`);
    } else {
      console.log(`Database '${dbName}' already exists`);
    }

    await client.end();
  } catch {
    console.warn('Could not create database automatically. Please ensure the database exists.');
    console.warn('You can create it manually with: CREATE DATABASE ' + dbName);
  }
}

async function runMigrations(): Promise<void> {
  const schemaPath = getPrismaSchemaPath();
  const schemaArg = `--schema="${schemaPath}"`;
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, skip automatic migrations to avoid watch loop issues
    // Developers should run `npx prisma migrate dev` manually when schema changes
    console.log('Development mode: Skipping automatic migrations');
    console.log('Run "npx prisma migrate dev" manually to apply schema changes');

    // Just verify the connection works
    try {
      const { PrismaClient } = await import('@prisma/client');
      const client = new PrismaClient();
      await client.$connect();
      await client.$disconnect();
      console.log('Database connection verified successfully');
    } catch (error) {
      console.error('Database connection failed. Run migrations first:');
      console.error('  npx prisma migrate dev');
      throw error;
    }
  } else {
    // In production, run migrate deploy
    console.log('Running database migrations...');

    try {
      execSync(`npx prisma migrate deploy ${schemaArg}`, {
        stdio: 'inherit',
        env: { ...process.env },
        cwd: getMonorepoRoot(),
      });
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }

    // Generate Prisma client in production
    console.log('Ensuring Prisma client is up to date...');
    execSync(`npx prisma generate ${schemaArg}`, {
      stdio: 'inherit',
      env: { ...process.env },
      cwd: getMonorepoRoot(),
    });
  }
}
