import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

interface Secrets {
  jwtSecret: string;
  jwtRefreshSecret: string;
  generatedAt: string;
}

const SECRETS_DIR = process.env.SECRETS_DIR ?? join(process.cwd(), '.secrets');
const SECRETS_FILE = join(SECRETS_DIR, 'jwt-secrets.json');

function generateSecret(length = 64): string {
  return randomBytes(length).toString('base64url');
}

function loadOrCreateSecrets(): Secrets {
  // Check if secrets file exists
  if (existsSync(SECRETS_FILE)) {
    try {
      const content = readFileSync(SECRETS_FILE, 'utf-8');
      const secrets = JSON.parse(content) as Secrets;
      console.log('Loaded existing JWT secrets from', SECRETS_FILE);
      return secrets;
    } catch (error) {
      console.warn('Failed to load secrets file, generating new secrets:', error);
    }
  }

  // Generate new secrets
  console.log('Generating new JWT secrets...');
  const secrets: Secrets = {
    jwtSecret: generateSecret(),
    jwtRefreshSecret: generateSecret(),
    generatedAt: new Date().toISOString(),
  };

  // Ensure secrets directory exists
  if (!existsSync(SECRETS_DIR)) {
    mkdirSync(SECRETS_DIR, { recursive: true });
  }

  // Save secrets to file
  writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  console.log('New JWT secrets generated and saved to', SECRETS_FILE);

  return secrets;
}

// Load secrets on module initialization
const secrets = loadOrCreateSecrets();

export function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? secrets.jwtSecret;
}

export function getJwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET ?? secrets.jwtRefreshSecret;
}
