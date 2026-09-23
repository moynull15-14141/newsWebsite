import { Injectable, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    if (user.accountType === 'READER' && !user.verifiedAt) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createSession(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        accountType: user.accountType,
        roles: user.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          permissions: ur.role.rolePermissions.map((rp) => rp.permission.name),
        })),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const session = await this.prisma.session.findFirst({
        where: {
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!(await bcrypt.compare(refreshToken, session.tokenHash))) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not found or inactive');
      }

      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      const tokens = await this.generateTokens(user.id, user.email);
      await this.createSession(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Unable to register with these details');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.displayName.trim(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        accountType: 'READER',
        readerProfile: { create: { displayName: dto.displayName.trim() } },
        notificationPreference: { create: {} },
        emailVerificationTokens: { create: { tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      },
      select: { id: true, email: true, name: true },
    });

    return {
      user,
      message: 'Registration successful. Verify your email before logging in.',
      ...(this.configService.get('NODE_ENV') === 'development' ? { verificationToken: rawToken } : {}),
    };
  }

  async verifyEmail(token: string) {
    const candidates = await this.prisma.emailVerificationToken.findMany({ where: { usedAt: null, expiresAt: { gt: new Date() } } });
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        await this.prisma.$transaction([
          this.prisma.emailVerificationToken.update({ where: { id: candidate.id }, data: { usedAt: new Date() } }),
          this.prisma.user.update({ where: { id: candidate.userId }, data: { verifiedAt: new Date() } }),
        ]);
        return { message: 'Email verified successfully' };
      }
    }
    throw new UnauthorizedException('Invalid or expired verification token');
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    const response: Record<string, unknown> = { message: 'If the account exists, reset instructions will be available shortly.' };
    if (!user) return response;
    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: await bcrypt.hash(rawToken, 10), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
    if (this.configService.get('NODE_ENV') === 'development') response.resetToken = rawToken;
    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const candidates = await this.prisma.passwordResetToken.findMany({ where: { usedAt: null, expiresAt: { gt: new Date() } } });
    for (const candidate of candidates) {
      if (await bcrypt.compare(dto.token, candidate.tokenHash)) {
        await this.prisma.$transaction([
          this.prisma.passwordResetToken.update({ where: { id: candidate.id }, data: { usedAt: new Date() } }),
          this.prisma.user.update({ where: { id: candidate.userId }, data: { passwordHash: await bcrypt.hash(dto.password, 12) } }),
          this.prisma.session.updateMany({ where: { userId: candidate.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
        return { message: 'Password reset successfully' };
      }
    }
    throw new UnauthorizedException('Invalid or expired reset token');
  }

  async logout(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        permissions: ur.role.rolePermissions.map((rp) => rp.permission.name),
      })),
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(userId: string, refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }
}
