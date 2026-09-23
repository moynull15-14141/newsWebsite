import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildSecurityHeaders } from './common/security/security-headers';
import { RateLimiter, RATE_LIMIT_RULES, classifyPublicRoute } from './common/rate-limit/rate-limiter';
import { formatRequestLog, sanitizePathForLogging } from './common/logging/request-logger';

function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'WEB_URL', 'API_CORS_ORIGIN', 'STORAGE_PROVIDER'];
    const missing = required.filter((key) => !process.env[key] || process.env[key]?.includes('change-in-production'));
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
    if (process.env.STORAGE_PROVIDER === 'local') throw new Error('Production requires STORAGE_PROVIDER=s3');
  }

  // Fail fast rather than risk another database-safety incident (see docs/DATABASE-SAFETY.md):
  // SHADOW_DATABASE_URL/TEST_DATABASE_URL/STAGING_DATABASE_URL must never resolve to the same database
  // as DATABASE_URL — Prisma resets whatever it is told is the shadow database.
  const dbUrl = process.env.DATABASE_URL;
  for (const key of ['SHADOW_DATABASE_URL', 'TEST_DATABASE_URL', 'STAGING_DATABASE_URL']) {
    const value = process.env[key];
    if (dbUrl && value && value === dbUrl) {
      throw new Error(`${key} must not be set to the same value as DATABASE_URL — see docs/DATABASE-SAFETY.md`);
    }
  }
}

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Local media URLs are persisted as /api/v1/media/files/{storageKey}.
  if ((process.env.STORAGE_PROVIDER || 'local') === 'local') {
    app.use(
      '/api/v1/media/files',
      express.static(path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads')),
    );
  }

  // CORS — production requires API_CORS_ORIGIN (enforced by validateEnvironment above); the localhost
  // fallback only ever applies when that variable is unset, i.e. local development.
  app.enableCors({
    origin: process.env.API_CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  });

  const securityHeaders = buildSecurityHeaders(isProduction);
  // Public/pre-auth traffic only — authenticated mutations are throttled per-user by RateLimitGuard
  // instead (see its own comment for why: req.user doesn't exist yet at the middleware stage).
  const publicRateLimiter = new RateLimiter();
  setInterval(() => publicRateLimiter.sweep(), 5 * 60_000).unref();

  app.use((request: any, response: any, next: () => void) => {
    const start = process.hrtime.bigint();
    const requestId = request.header('x-request-id') || randomUUID();
    response.setHeader('X-Request-Id', requestId);
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);

    const originalUrl: string = request.originalUrl || request.url;
    if (request.method === 'GET') {
      if (originalUrl.includes('/public/') || originalUrl.includes('/seo/')) {
        response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      } else if (originalUrl.includes('/auth/') || originalUrl.includes('/reader/') || originalUrl.includes('/admin') || originalUrl.includes('/articles')) {
        response.setHeader('Cache-Control', 'no-store');
      }
    }

    const tier = classifyPublicRoute(request.method, originalUrl);
    if (tier) {
      const rule = RATE_LIMIT_RULES[tier];
      const result = publicRateLimiter.check(`${tier}:${request.ip}`, rule);
      response.setHeader('X-RateLimit-Limit', result.limit);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
      if (!result.allowed) {
        response.status(429).json({ statusCode: 429, message: 'Too many requests. Please try again shortly.' });
        return;
      }
    }

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      // eslint-disable-next-line no-console
      console.log(formatRequestLog({
        requestId,
        method: request.method,
        path: sanitizePathForLogging(originalUrl),
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs),
        actorId: request.user?.userId ?? null,
      }));
    });

    next();
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}
bootstrap();
