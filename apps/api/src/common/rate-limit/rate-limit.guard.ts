import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimiter, RATE_LIMIT_RULES } from './rate-limiter';

/**
 * Throttles authenticated state-changing requests, keyed by user id rather than IP — an editorial team
 * often shares an office/VPN egress IP, so an IP-only limit would either be too loose (shared by many
 * real users) or punish everyone behind it for one person's mistake. Registered as the third global
 * APP_GUARD (see app.module.ts), after JwtAuthGuard and RolesGuard, so it only ever runs once a request
 * has already been authenticated and authorized — its only job is throttling, never access control.
 * Public/pre-auth traffic (login, search, public reads) is handled by the IP-keyed middleware in
 * main.ts instead, since request.user doesn't exist yet at that point in the pipeline.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter = new RateLimiter();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.method === 'GET' || request.method === 'HEAD') return true;

    const userId = request.user?.userId;
    if (!userId) return true; // no authenticated user (e.g. a @Public() write) — not this guard's concern

    const isUpload = request.originalUrl?.includes('/media') && request.method === 'POST';
    const rule = isUpload ? RATE_LIMIT_RULES.UPLOAD : RATE_LIMIT_RULES.MUTATION;
    const key = `${isUpload ? 'upload' : 'mutation'}:${userId}`;

    const result = this.limiter.check(key, rule);
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      throw new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests. Please slow down.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
