import { randomBytes, generateKeyPairSync } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Secrets {
  jwtSecret: string;
  jwtRefreshSecret: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  generatedAt: string;
}

// Determine secrets directory from environment
function getSecretsDir(): string {
  // SECRETS_DIR takes precedence, then DATA_DIR/secrets, then default
  if (process.env.SECRETS_DIR) {
    return process.env.SECRETS_DIR;
  }
  if (process.env.DATA_DIR) {
    return join(process.env.DATA_DIR, 'secrets');
  }
  return join(process.cwd(), 'data', 'secrets');
}

const SECRETS_DIR = getSecretsDir();
const SECRETS_FILE = join(SECRETS_DIR, 'secrets.json');

function generateSecret(length = 64): string {
  return randomBytes(length).toString('base64url');
}

function generateVapidKeys(): { publicKey: string; privateKey: string } {
  // Generate ECDH key pair for VAPID (P-256 curve as required by Web Push)
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // P-256
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  // Extract the raw public key (remove ASN.1 header - last 65 bytes for uncompressed P-256)
  const rawPublicKey = publicKey.subarray(-65);

  // Extract the raw private key (remove ASN.1 header - last 32 bytes for P-256)
  const rawPrivateKey = privateKey.subarray(-32);

  return {
    publicKey: rawPublicKey.toString('base64url'),
    privateKey: rawPrivateKey.toString('base64url'),
  };
}

function loadOrCreateSecrets(): Secrets {
  // Check if secrets file exists
  if (existsSync(SECRETS_FILE)) {
    try {
      const content = readFileSync(SECRETS_FILE, 'utf-8');
      const secrets = JSON.parse(content) as Secrets;
      console.log(`Loaded existing secrets from ${SECRETS_FILE}`);
      return secrets;
    } catch (error) {
      console.warn('Failed to load secrets file, generating new secrets:', error);
    }
  }

  // Generate new secrets
  console.log('Generating new secrets (JWT + VAPID)...');
  const vapidKeys = generateVapidKeys();

  const secrets: Secrets = {
    jwtSecret: generateSecret(),
    jwtRefreshSecret: generateSecret(),
    vapidPublicKey: vapidKeys.publicKey,
    vapidPrivateKey: vapidKeys.privateKey,
    generatedAt: new Date().toISOString(),
  };

  // Ensure secrets directory exists
  if (!existsSync(SECRETS_DIR)) {
    mkdirSync(SECRETS_DIR, { recursive: true });
    console.log(`Created secrets directory: ${SECRETS_DIR}`);
  }

  // Save secrets to file with restricted permissions
  try {
    writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    console.log(`New secrets generated and saved to ${SECRETS_FILE}`);
  } catch (error) {
    console.error('Failed to save secrets file:', error);
    console.warn('Secrets will not persist across restarts!');
  }

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

export function getVapidPublicKey(): string {
  const key = process.env.VAPID_PUBLIC_KEY ?? secrets.vapidPublicKey;
  if (!key) {
    console.error('[Secrets] VAPID public key is missing! Secrets file exists:', !!secrets, 'vapidPublicKey in secrets:', !!secrets?.vapidPublicKey);
  }
  return key;
}

export function getVapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY ?? secrets.vapidPrivateKey;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT ?? 'mailto:admin@dreamtime.app';
}

export function getSecretsPath(): string {
  return SECRETS_FILE;
}
