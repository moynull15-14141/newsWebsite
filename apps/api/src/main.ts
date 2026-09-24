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
    // Either naming is accepted (see StorageModule.resolveProviderKind) — production just needs to have
    // picked ONE of them and pointed it at real remote storage, not local disk.
    const storageProviderVar = process.env.MEDIA_STORAGE_PROVIDER ? 'MEDIA_STORAGE_PROVIDER' : 'STORAGE_PROVIDER';
    const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'WEB_URL', 'API_CORS_ORIGIN', storageProviderVar];
    const missing = required.filter((key) => !process.env[key] || process.env[key]?.includes('change-in-production'));
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
    const isLocal = process.env.MEDIA_STORAGE_PROVIDER ? process.env.MEDIA_STORAGE_PROVIDER === 'local' : process.env.STORAGE_PROVIDER === 'local';
    if (isLocal) throw new Error('Production requires MEDIA_STORAGE_PROVIDER=r2 (or STORAGE_PROVIDER=s3)');
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

  // Nest doesn't wire OnModuleDestroy (e.g. PrismaService's $disconnect) to process signals unless
  // asked to — needed so Render's SIGTERM on redeploy/restart closes the DB connection cleanly.
  app.enableShutdownHooks();

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Local media URLs are persisted as /api/v1/media/files/{storageKey}.
  const isLocalStorage = process.env.MEDIA_STORAGE_PROVIDER
    ? process.env.MEDIA_STORAGE_PROVIDER === 'local'
    : (process.env.STORAGE_PROVIDER || 'local') === 'local';
  if (isLocalStorage) {
    app.use(
      '/api/v1/media/files',
      express.static(path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads')),
    );
  }

  // Local-dev presigned-upload PUT target (see MediaLocalUploadController) — needs the raw request body,
  // not the JSON/urlencoded parsing Nest's global body parser applies. Registering this raw parser here,
  // scoped to this one path, doesn't conflict with the global parsers: bodyParser.json()/urlencoded()
  // only ever consume a request whose Content-Type matches theirs, so an image/* PUT passes through them
  // untouched and arrives here with its stream intact.
  app.use('/api/v1/media/local-upload', express.raw({ limit: '25mb', type: () => true }));

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

  // Render (and most PaaS hosts) inject PORT at runtime and require the process to bind to it;
  // API_PORT remains the local-dev override, and 3001 is the final fallback.
  const port = process.env.PORT || process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`API running on port ${port} (prefix /api/v1)`);
}
bootstrap();
