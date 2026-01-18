import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import type {
  RegisterInput,
  LoginInput,
  AuthResponse,
  AuthTokens,
  AuthUser,
} from '../schemas/auth.schema.js';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 32;

// Parse duration string to milliseconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

function userToAuthUser(user: {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    createdAt: user.createdAt,
  };
}

export async function register(
  input: RegisterInput,
  signJwt: (payload: { userId: string }) => string
): Promise<AuthResponse> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AuthServiceError(
      'An account with this email already exists',
      'EMAIL_EXISTS',
      409
    );
  }

  // Hash password
  const hashedPassword = await hashPassword(input.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      password: hashedPassword,
      name: input.name,
      timezone: input.timezone,
    },
  });

  // Generate tokens
  const tokens = await createTokens(user.id, signJwt);

  return {
    user: userToAuthUser(user),
    tokens,
  };
}

export async function login(
  input: LoginInput,
  signJwt: (payload: { userId: string }) => string
): Promise<AuthResponse> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new AuthServiceError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401
    );
  }

  // Verify password
  const isValidPassword = await verifyPassword(input.password, user.password);

  if (!isValidPassword) {
    throw new AuthServiceError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401
    );
  }

  // Generate tokens
  const tokens = await createTokens(user.id, signJwt);

  return {
    user: userToAuthUser(user),
    tokens,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  signJwt: (payload: { userId: string }) => string
): Promise<AuthTokens> {
  // Find the refresh token
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new AuthServiceError(
      'Invalid refresh token',
      'INVALID_REFRESH_TOKEN',
      401
    );
  }

  // Check if token is expired
  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    throw new AuthServiceError(
      'Refresh token has expired',
      'REFRESH_TOKEN_EXPIRED',
      401
    );
  }

  // Delete the old refresh token (rotate tokens)
  await prisma.refreshToken.delete({
    where: { id: storedToken.id },
  });

  // Generate new tokens
  return createTokens(storedToken.userId, signJwt);
}

export async function logout(refreshToken: string): Promise<void> {
  // Delete the refresh token if it exists
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  // Delete all refresh tokens for the user
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

async function createTokens(
  userId: string,
  signJwt: (payload: { userId: string }) => string
): Promise<AuthTokens> {
  // Generate access token
  const accessToken = signJwt({ userId });

  // Generate refresh token
  const refreshToken = generateRefreshToken();
  const refreshExpiresIn = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + refreshExpiresIn);

  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseDuration(env.JWT_EXPIRES_IN) / 1000, // Return in seconds
  };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return userToAuthUser(user);
}

// Cleanup expired refresh tokens (call periodically)
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}
