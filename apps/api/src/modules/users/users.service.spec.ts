import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      role: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userRoleAssignment: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates user with assigned role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'Reporter' });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'Reporter Joe',
        email: 'joe@news.com',
        status: 'ACTIVE',
        userRoles: [{ role: { id: 'role-1', name: 'Reporter' } }],
      });

      const result = await service.create({
        name: 'Reporter Joe',
        email: 'joe@news.com',
        password: 'password123',
        roleId: 'role-1',
      });

      expect(result.id).toBe('user-1');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('throws ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-old', email: 'joe@news.com' });

      await expect(
        service.create({
          name: 'Reporter Joe',
          email: 'joe@news.com',
          password: 'password123',
          roleId: 'role-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('prevents self-deactivation', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-me', email: 'me@news.com' });

      await expect(
        service.update('user-me', { status: 'INACTIVE' }, 'user-me'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates user role successfully', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', email: 'user@news.com' });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-editor', name: 'Editor' });
      prisma.user.update.mockResolvedValue({
        id: 'user-2',
        name: 'User 2',
        email: 'user@news.com',
        status: 'ACTIVE',
        userRoles: [{ role: { id: 'role-editor', name: 'Editor' } }],
      });

      const result = await service.update('user-2', { roleId: 'role-editor' }, 'admin-1');
      expect(result.id).toBe('user-2');
    });
  });

  describe('remove', () => {
    it('prevents self-suspension/deletion', async () => {
      await expect(service.remove('user-me', 'user-me')).rejects.toThrow(BadRequestException);
    });

    it('suspends user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-target', name: 'Target' });
      prisma.user.update.mockResolvedValue({ id: 'user-target', status: 'SUSPENDED' });

      const result = await service.remove('user-target', 'admin-1');
      expect(result.message).toContain('suspended');
    });
  });
});

