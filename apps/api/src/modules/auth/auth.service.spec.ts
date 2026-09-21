import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '',
    status: 'ACTIVE',
    userRoles: [],
  };

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    mockUser.passwordHash = hashedPassword;

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      session: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
              if (key === 'JWT_EXPIRATION') return '15m';
              if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
              return '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'wrong@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, userRoles: [] });
      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'INACTIVE',
        userRoles: [],
      });
      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return tokens and user on successful login', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          {
            role: {
              id: 'role-1',
              name: 'Admin',
              rolePermissions: [{ permission: { name: 'article.create' } }],
            },
          },
        ],
      });
      prisma.session.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('getMe', () => {
    it('should return user profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          {
            role: {
              id: 'role-1',
              name: 'Admin',
              rolePermissions: [{ permission: { name: 'article.create' } }],
            },
          },
        ],
      });

      const result = await service.getMe('user-1');
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when no active session exists', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', email: 'test@example.com' });
      prisma.session.findFirst.mockResolvedValue(null);
      await expect(service.refresh('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke all sessions', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.logout('user-1');
      expect(result.message).toBe('Logged out successfully');
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
