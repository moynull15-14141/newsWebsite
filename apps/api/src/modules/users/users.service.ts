import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoles() {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.roleId) {
      where.userRoles = {
        some: { roleId: params.roleId },
      };
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params?.page) {
      const page = Math.max(1, params.page);
      const limit = Math.max(1, params.limit || 20);

      const [total, data] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            accountType: true,
            verifiedAt: true,
            createdAt: true,
            updatedAt: true,
            userRoles: {
              include: {
                role: { select: { id: true, name: true, description: true } },
              },
            },
            _count: {
              select: {
                authoredArticles: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        accountType: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        accountType: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            authoredArticles: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAuthors() {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        status: dto.status ?? 'ACTIVE',
        accountType: dto.accountType ?? 'STAFF',
        userRoles: {
          create: {
            roleId: dto.roleId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        accountType: true,
        createdAt: true,
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateUserDto, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (id === currentUserId && dto.status && dto.status !== 'ACTIVE') {
      throw new BadRequestException('You cannot suspend or deactivate your own account');
    }

    if (dto.email && dto.email.trim().toLowerCase() !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (existing) {
        throw new ConflictException(`Email "${dto.email}" is already in use`);
      }
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.roleId) {
        const role = await tx.role.findUnique({ where: { id: dto.roleId } });
        if (!role) {
          throw new NotFoundException('Role not found');
        }
        await tx.userRoleAssignment.deleteMany({ where: { userId: id } });
        await tx.userRoleAssignment.create({
          data: { userId: id, roleId: dto.roleId },
        });
      }

      return tx.user.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          email: dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined,
          passwordHash,
          status: dto.status !== undefined ? dto.status : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          accountType: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
        },
      });
    });
  }

  async remove(id: string, currentUserId?: string) {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete or suspend your own account');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete / suspend
    await this.prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    return { message: `User "${user.name}" suspended successfully` };
  }
}
