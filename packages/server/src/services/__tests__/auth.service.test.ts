import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcrypt';
import {
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  AuthServiceError,
} from '../auth.service.js';

// Mock Prisma
vi.mock('../../config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock environment
vi.mock('../../config/env.js', () => ({
  env: {
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

describe('auth.service', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 12);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword456';
      const hash = await bcrypt.hash(password, 12);

      const result = await verifyPassword(wrongPassword, hash);

      expect(result).toBe(false);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token', () => {
      const token = generateRefreshToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateRefreshToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should generate base64url encoded tokens', () => {
      const token = generateRefreshToken();
      // base64url uses only A-Z, a-z, 0-9, -, _
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });
  });

  describe('AuthServiceError', () => {
    it('should create an error with code and status', () => {
      const error = new AuthServiceError('Test error', 'TEST_ERROR', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('AuthServiceError');
    });

    it('should default statusCode to 400', () => {
      const error = new AuthServiceError('Test error', 'TEST_ERROR');

      expect(error.statusCode).toBe(400);
    });

    it('should be an instance of Error', () => {
      const error = new AuthServiceError('Test error', 'TEST_ERROR');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AuthServiceError).toBe(true);
    });
  });
});

describe('auth.service with mocked database', () => {
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    // Import the mocked prisma
    const databaseModule = await import('../../config/database.js');
    prisma = databaseModule.prisma as typeof prisma;
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        createdAt: new Date(),
        password: 'hashed-password',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        userId: mockUser.id,
        token: 'refresh-token',
        expiresAt: new Date(),
      });

      const { register } = await import('../auth.service.js');

      const mockSignJwt = vi.fn().mockReturnValue('mock-access-token');
      const result = await register(
        {
          email: 'test@example.com',
          password: 'TestPassword123',
          name: 'Test User',
          timezone: 'America/New_York',
        },
        mockSignJwt
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockSignJwt).toHaveBeenCalledWith({ userId: mockUser.id });
    });

    it('should throw error if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const { register } = await import('../auth.service.js');
      const mockSignJwt = vi.fn();

      await expect(
        register(
          {
            email: 'test@example.com',
            password: 'TestPassword123',
            name: 'Test User',
          },
          mockSignJwt
        )
      ).rejects.toThrow(AuthServiceError);
    });

    it('should normalize email to lowercase', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        createdAt: new Date(),
        password: 'hashed-password',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        userId: mockUser.id,
        token: 'refresh-token',
        expiresAt: new Date(),
      });

      const { register } = await import('../auth.service.js');
      const mockSignJwt = vi.fn().mockReturnValue('mock-access-token');

      await register(
        {
          email: 'TEST@EXAMPLE.COM',
          password: 'TestPassword123',
          name: 'Test User',
        },
        mockSignJwt
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        createdAt: new Date(),
        password: hashedPassword,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        userId: mockUser.id,
        token: 'refresh-token',
        expiresAt: new Date(),
      });

      const { login } = await import('../auth.service.js');
      const mockSignJwt = vi.fn().mockReturnValue('mock-access-token');

      const result = await login(
        {
          email: 'test@example.com',
          password: 'TestPassword123',
        },
        mockSignJwt
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw error for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const { login } = await import('../auth.service.js');
      const mockSignJwt = vi.fn();

      await expect(
        login(
          {
            email: 'nonexistent@example.com',
            password: 'TestPassword123',
          },
          mockSignJwt
        )
      ).rejects.toThrow(AuthServiceError);
    });

    it('should throw error for incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
      });

      const { login } = await import('../auth.service.js');
      const mockSignJwt = vi.fn();

      await expect(
        login(
          {
            email: 'test@example.com',
            password: 'WrongPassword456',
          },
          mockSignJwt
        )
      ).rejects.toThrow(AuthServiceError);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const mockStoredToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 86400000), // 1 day in future
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      prisma.refreshToken.delete.mockResolvedValue(mockStoredToken);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'new-token-123',
        userId: 'user-123',
        token: 'new-refresh-token',
        expiresAt: new Date(),
      });

      const { refreshAccessToken } = await import('../auth.service.js');
      const mockSignJwt = vi.fn().mockReturnValue('new-access-token');

      const result = await refreshAccessToken('valid-refresh-token', mockSignJwt);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(prisma.refreshToken.delete).toHaveBeenCalled();
    });

    it('should throw error for invalid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const { refreshAccessToken } = await import('../auth.service.js');
      const mockSignJwt = vi.fn();

      await expect(
        refreshAccessToken('invalid-token', mockSignJwt)
      ).rejects.toThrow(AuthServiceError);
    });

    it('should throw error for expired refresh token', async () => {
      const mockStoredToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'expired-refresh-token',
        expiresAt: new Date(Date.now() - 86400000), // 1 day in past
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      prisma.refreshToken.delete.mockResolvedValue(mockStoredToken);

      const { refreshAccessToken } = await import('../auth.service.js');
      const mockSignJwt = vi.fn();

      await expect(
        refreshAccessToken('expired-refresh-token', mockSignJwt)
      ).rejects.toThrow(AuthServiceError);
    });
  });

  describe('logout', () => {
    it('should delete refresh token', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const { logout } = await import('../auth.service.js');

      await logout('some-refresh-token');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
      });
    });

    it('should not throw if token does not exist', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const { logout } = await import('../auth.service.js');

      await expect(logout('nonexistent-token')).resolves.not.toThrow();
    });
  });

  describe('logoutAllDevices', () => {
    it('should delete all refresh tokens for user', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const { logoutAllDevices } = await import('../auth.service.js');

      await logoutAllDevices('user-123');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        createdAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const { getUserById } = await import('../auth.service.js');

      const result = await getUserById('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        createdAt: mockUser.createdAt,
      });
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const { getUserById } = await import('../auth.service.js');

      const result = await getUserById('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return count', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 10 });

      const { cleanupExpiredTokens } = await import('../auth.service.js');

      const result = await cleanupExpiredTokens();

      expect(result).toBe(10);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
