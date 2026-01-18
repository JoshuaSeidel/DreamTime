import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from '../config/database.js';

// Configuration - should be set via environment variables in production
const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'DreamTime';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

// Challenge expiry in milliseconds (5 minutes)
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

export class WebAuthnServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'WebAuthnServiceError';
  }
}

/**
 * Check if WebAuthn/passkeys are available for a user (by email)
 */
export async function checkWebAuthnAvailable(
  email: string
): Promise<{ available: boolean; credentialCount: number }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      webAuthnCredentials: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    return { available: false, credentialCount: 0 };
  }

  return {
    available: user.webAuthnCredentials.length > 0,
    credentialCount: user.webAuthnCredentials.length,
  };
}

/**
 * Generate registration options for a new credential
 * Called when user wants to add Face ID / biometric
 */
export async function generateRegistrationOptionsForUser(
  userId: string
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      webAuthnCredentials: true,
    },
  });

  if (!user) {
    throw new WebAuthnServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Convert existing credentials to exclude them from registration
  const excludeCredentials = user.webAuthnCredentials.map((cred) => ({
    id: cred.credentialId,
    transports: cred.transports
      ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.name,
    // Don't allow re-registering existing credentials
    excludeCredentials,
    // Prefer platform authenticators (Face ID, Touch ID)
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    // We support ES256 and RS256 algorithms
    supportedAlgorithmIDs: [-7, -257],
  });

  // Store the challenge temporarily for verification
  await prisma.user.update({
    where: { id: userId },
    data: {
      webAuthnChallenge: options.challenge,
      webAuthnChallengeExpiry: new Date(Date.now() + CHALLENGE_EXPIRY_MS),
    },
  });

  return options;
}

/**
 * Verify and store a new credential registration
 */
export async function verifyAndStoreRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  friendlyName?: string
): Promise<{ success: boolean; credentialId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new WebAuthnServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  if (!user.webAuthnChallenge) {
    throw new WebAuthnServiceError(
      'No registration challenge found. Please start registration again.',
      'NO_CHALLENGE',
      400
    );
  }

  if (
    user.webAuthnChallengeExpiry &&
    new Date() > user.webAuthnChallengeExpiry
  ) {
    throw new WebAuthnServiceError(
      'Registration challenge expired. Please start again.',
      'CHALLENGE_EXPIRED',
      400
    );
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.webAuthnChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (error) {
    throw new WebAuthnServiceError(
      `Registration verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'VERIFICATION_FAILED',
      400
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new WebAuthnServiceError(
      'Registration verification failed',
      'VERIFICATION_FAILED',
      400
    );
  }

  const {
    credential,
    credentialDeviceType,
    credentialBackedUp,
  } = verification.registrationInfo;

  // Store the credential
  const stored = await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: response.response.transports
        ? JSON.stringify(response.response.transports)
        : null,
      friendlyName: friendlyName || getDefaultDeviceName(),
    },
  });

  // Clear the challenge
  await prisma.user.update({
    where: { id: userId },
    data: {
      webAuthnChallenge: null,
      webAuthnChallengeExpiry: null,
    },
  });

  return { success: true, credentialId: stored.id };
}

/**
 * Generate authentication options for login
 */
export async function generateAuthenticationOptionsForUser(
  email: string
): Promise<PublicKeyCredentialRequestOptionsJSON & { userId?: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      webAuthnCredentials: true,
    },
  });

  if (!user) {
    throw new WebAuthnServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  if (user.webAuthnCredentials.length === 0) {
    throw new WebAuthnServiceError(
      'No passkeys registered for this account',
      'NO_CREDENTIALS',
      400
    );
  }

  const allowCredentials = user.webAuthnCredentials.map((cred) => ({
    id: cred.credentialId,
    transports: cred.transports
      ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'required',
  });

  // Store the challenge temporarily
  await prisma.user.update({
    where: { id: user.id },
    data: {
      webAuthnChallenge: options.challenge,
      webAuthnChallengeExpiry: new Date(Date.now() + CHALLENGE_EXPIRY_MS),
    },
  });

  return { ...options, userId: user.id };
}

/**
 * Verify authentication response and return user
 */
export async function verifyAuthentication(
  email: string,
  response: AuthenticationResponseJSON
): Promise<{
  verified: boolean;
  user: { id: string; email: string; name: string; timezone: string };
}> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      webAuthnCredentials: true,
    },
  });

  if (!user) {
    throw new WebAuthnServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  if (!user.webAuthnChallenge) {
    throw new WebAuthnServiceError(
      'No authentication challenge found. Please start login again.',
      'NO_CHALLENGE',
      400
    );
  }

  if (
    user.webAuthnChallengeExpiry &&
    new Date() > user.webAuthnChallengeExpiry
  ) {
    throw new WebAuthnServiceError(
      'Authentication challenge expired. Please start again.',
      'CHALLENGE_EXPIRED',
      400
    );
  }

  // Find the credential being used
  const credential = user.webAuthnCredentials.find(
    (cred) => cred.credentialId === response.id
  );

  if (!credential) {
    throw new WebAuthnServiceError(
      'Credential not found',
      'CREDENTIAL_NOT_FOUND',
      400
    );
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.webAuthnChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.credentialPublicKey, 'base64url'),
        counter: credential.counter,
        transports: credential.transports
          ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });
  } catch (error) {
    throw new WebAuthnServiceError(
      `Authentication verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'VERIFICATION_FAILED',
      400
    );
  }

  if (!verification.verified) {
    throw new WebAuthnServiceError(
      'Authentication verification failed',
      'VERIFICATION_FAILED',
      400
    );
  }

  // Update the counter and last used timestamp
  await prisma.webAuthnCredential.update({
    where: { id: credential.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  // Clear the challenge
  await prisma.user.update({
    where: { id: user.id },
    data: {
      webAuthnChallenge: null,
      webAuthnChallengeExpiry: null,
    },
  });

  return {
    verified: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
    },
  };
}

/**
 * List all credentials for a user
 */
export async function listCredentials(
  userId: string
): Promise<
  Array<{
    id: string;
    friendlyName: string | null;
    deviceType: string;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>
> {
  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: {
      id: true,
      friendlyName: true,
      deviceType: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return credentials;
}

/**
 * Delete a credential
 */
export async function deleteCredential(
  userId: string,
  credentialId: string
): Promise<void> {
  const credential = await prisma.webAuthnCredential.findFirst({
    where: {
      id: credentialId,
      userId,
    },
  });

  if (!credential) {
    throw new WebAuthnServiceError(
      'Credential not found',
      'CREDENTIAL_NOT_FOUND',
      404
    );
  }

  await prisma.webAuthnCredential.delete({
    where: { id: credentialId },
  });
}

/**
 * Get default device name based on current time
 */
function getDefaultDeviceName(): string {
  return `Device added ${new Date().toLocaleDateString()}`;
}
