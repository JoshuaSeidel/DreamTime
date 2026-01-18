import { prisma } from '../config/database.js';
import type { UpdateUserInput, UserProfile } from '../schemas/user.schema.js';

export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

function userToProfile(user: {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return userToProfile(user);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserInput
): Promise<UserProfile> {
  // Verify user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Build update data
  const updateData: { name?: string; timezone?: string } = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (input.timezone !== undefined) {
    updateData.timezone = input.timezone;
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return userToProfile(updatedUser);
}

export async function deleteUser(userId: string): Promise<void> {
  // Verify user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Delete user - cascade will handle related records
  // Note: Prisma's cascading delete handles:
  // - RefreshTokens (onDelete: Cascade)
  // - ChildCaregiver (onDelete: Cascade)
  await prisma.user.delete({
    where: { id: userId },
  });
}

// Search users by name or email (for adding caregivers)
export interface UserSearchResult {
  id: string;
  email: string;
  name: string;
}

export async function searchUsers(
  currentUserId: string,
  query: string,
  limit: number = 10
): Promise<UserSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  // SQLite doesn't support mode: 'insensitive', so we use LOWER() in raw query
  // or do a case-insensitive search using contains with lowercase comparison
  const lowerQuery = query.toLowerCase();

  const users = await prisma.user.findMany({
    where: {
      AND: [
        // Exclude current user
        { id: { not: currentUserId } },
        // Search by name or email (SQLite LIKE is case-insensitive by default)
        {
          OR: [
            { name: { contains: lowerQuery } },
            { email: { contains: lowerQuery } },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
    take: limit,
    orderBy: { name: 'asc' },
  });

  return users;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const bcrypt = await import('bcrypt');

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new UserServiceError(
      'Current password is incorrect',
      'INVALID_PASSWORD',
      401
    );
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Revoke all refresh tokens (force re-login on all devices)
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}
