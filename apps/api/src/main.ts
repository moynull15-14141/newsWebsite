import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'WEB_URL', 'API_CORS_ORIGIN', 'STORAGE_PROVIDER'];
    const missing = required.filter((key) => !process.env[key] || process.env[key]?.includes('change-in-production'));
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
    if (process.env.STORAGE_PROVIDER === 'local') throw new Error('Production requires STORAGE_PROVIDER=s3');
  }
}

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Local media URLs are persisted as /api/v1/media/files/{storageKey}.
  if ((process.env.STORAGE_PROVIDER || 'local') === 'local') {
    app.use(
      '/api/v1/media/files',
      express.static(path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads')),
    );
  }

  // CORS
  app.enableCors({
    origin: process.env.API_CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  });

  const requestCounts = new Map<string, { count: number; resetAt: number }>();
  app.use((request: any, response: any, next: () => void) => {
    const requestId = request.header('x-request-id') || randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy-Report-Only', "default-src 'self'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' https:");
    if (request.method === 'GET') {
      const path = request.originalUrl || request.url;
      if (path.includes('/public/') || path.includes('/seo/')) {
        response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      } else if (path.includes('/auth/') || path.includes('/reader/') || path.includes('/admin') || path.includes('/articles')) {
        response.setHeader('Cache-Control', 'no-store');
      }
    }

    const sensitive = /\/auth\/(login|refresh|forgot-password|reset-password)|\/public\/(search|articles\/[^/]+\/view|analytics\/events)|\/comments/;
    if (sensitive.test(request.originalUrl || request.url)) {
      const now = Date.now();
      const key = `${request.ip}:${request.path}`;
      const current = requestCounts.get(key);
      if (!current || current.resetAt <= now) requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
      else if (current.count >= 60) {
        response.status(429).json({ statusCode: 429, message: 'Too many requests' });
        return;
      } else current.count += 1;
    }
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

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}
bootstrap();
