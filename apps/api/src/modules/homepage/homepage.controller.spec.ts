import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

/**
 * Real Nest app: real JwtAuthGuard + JwtStrategy + RolesGuard + ValidationPipe (configured like main.ts),
 * real signed tokens, real HTTP. Only the database (users/permissions) and HomepageService are stubbed.
 */

const SECRET = 'homepage-controller-test-secret';
const SECTION_ID = '11111111-1111-4111-8111-111111111111';

const users: Record<string, { status: string; permissions: string[] }> = {
  manager: { status: 'ACTIVE', permissions: ['homepage.manage', 'article.read'] },
  editor: { status: 'ACTIVE', permissions: ['article.create', 'article.read', 'article.edit'] },
  norole: { status: 'ACTIVE', permissions: [] },
  inactive: { status: 'INACTIVE', permissions: ['homepage.manage'] },
};

const prismaStub = {
  user: {
    findUnique: jest.fn(async ({ where }: any) => {
      const user = users[where.id];
      if (!user) return null;
      return {
        id: where.id,
        status: user.status,
        userRoles: [{ role: { rolePermissions: user.permissions.map((name) => ({ permission: { name } })) } }],
      };
    }),
  },
};

const ok = { ok: true };
const serviceStub = {
  getActive: jest.fn().mockResolvedValue(ok),
  getDraft: jest.fn().mockResolvedValue(ok),
  previewDraft: jest.fn().mockResolvedValue(ok),
  createSection: jest.fn().mockResolvedValue(ok),
  updateSection: jest.fn().mockResolvedValue(ok),
  deleteSection: jest.fn().mockResolvedValue(ok),
  reorderSections: jest.fn().mockResolvedValue(ok),
  setPlacements: jest.fn().mockResolvedValue(ok),
  publish: jest.fn().mockResolvedValue(ok),
};

interface Endpoint {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  service: keyof typeof serviceStub;
}

const endpoints: Endpoint[] = [
  { name: 'read active', method: 'GET', path: '/homepage/active', service: 'getActive' },
  { name: 'read draft', method: 'GET', path: '/homepage/draft', service: 'getDraft' },
  { name: 'preview draft', method: 'GET', path: '/homepage/draft/preview', service: 'previewDraft' },
  { name: 'create section', method: 'POST', path: '/homepage/draft/sections', body: { expectedVersion: 1, type: 'CUSTOM', title: 'Special' }, service: 'createSection' },
  { name: 'update section', method: 'PATCH', path: `/homepage/draft/sections/${SECTION_ID}`, body: { expectedVersion: 1, title: 'New title' }, service: 'updateSection' },
  { name: 'delete section', method: 'DELETE', path: `/homepage/draft/sections/${SECTION_ID}?expectedVersion=1`, service: 'deleteSection' },
  { name: 'reorder sections', method: 'PUT', path: '/homepage/draft/sections/order', body: { expectedVersion: 1, sectionIds: [SECTION_ID] }, service: 'reorderSections' },
  { name: 'replace placements', method: 'PUT', path: `/homepage/draft/sections/${SECTION_ID}/placements`, body: { expectedVersion: 1, articleIds: ['a1'] }, service: 'setPlacements' },
  { name: 'publish', method: 'POST', path: '/homepage/publish', body: { expectedVersion: 1 }, service: 'publish' },
];

describe('HomepageController (authentication, permission, validation)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({ secret: SECRET, signOptions: { expiresIn: '5m' } })],
      controllers: [HomepageController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined) } },
        { provide: PrismaService, useValue: prismaStub },
        { provide: HomepageService, useValue: serviceStub },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', 'localhost');
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(serviceStub).forEach((fn) => fn.mockClear());
  });

  const tokenFor = (userId: string) => jwt.sign({ sub: userId, email: `${userId}@example.test` });

  async function call(endpoint: Pick<Endpoint, 'method' | 'path' | 'body'>, token?: string, rawBody?: string) {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: rawBody ?? (endpoint.body === undefined ? undefined : JSON.stringify(endpoint.body)),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, json: text ? JSON.parse(text) : undefined };
  }

  describe.each(endpoints)('$method $path ($name)', (endpoint) => {
    it('rejects an unauthenticated request with 401 and never reaches the service', async () => {
      const { status } = await call(endpoint);
      expect(status).toBe(401);
      expect(serviceStub[endpoint.service]).not.toHaveBeenCalled();
    });

    it('rejects a garbage / wrongly signed token with 401', async () => {
      const forged = new JwtService({ secret: 'some-other-secret' }).sign({ sub: 'manager', email: 'x@example.test' });
      expect((await call(endpoint, 'not-a-jwt')).status).toBe(401);
      expect((await call(endpoint, forged)).status).toBe(401);
      expect(serviceStub[endpoint.service]).not.toHaveBeenCalled();
    });

    it('rejects an inactive user with 401', async () => {
      expect((await call(endpoint, tokenFor('inactive'))).status).toBe(401);
      expect(serviceStub[endpoint.service]).not.toHaveBeenCalled();
    });

    it.each(['editor', 'norole'])('rejects authenticated user "%s" without homepage.manage with 403', async (user) => {
      const { status, json } = await call(endpoint, tokenFor(user));
      expect(status).toBe(403);
      expect(json.message).toMatch(/permission/i);
      expect(serviceStub[endpoint.service]).not.toHaveBeenCalled();
    });

    it('allows a user with homepage.manage', async () => {
      const { status, json } = await call(endpoint, tokenFor('manager'));
      expect(status).toBe(endpoint.method === 'POST' ? 201 : 200);
      expect(json).toEqual(ok);
      expect(serviceStub[endpoint.service]).toHaveBeenCalledTimes(1);
    });
  });

  describe('routing', () => {
    it('does not expose the legacy live-mutating routes any more', async () => {
      const token = tokenFor('manager');
      expect((await call({ method: 'GET', path: '/homepage' }, token)).status).toBe(404);
      expect((await call({ method: 'POST', path: '/homepage/sections', body: { type: 'CUSTOM', title: 'x' } }, token)).status).toBe(404);
      expect((await call({ method: 'PATCH', path: `/homepage/sections/${SECTION_ID}`, body: { enabled: false } }, token)).status).toBe(404);
      expect((await call({ method: 'PATCH', path: `/homepage/sections/${SECTION_ID}/placements`, body: { articleIds: [] } }, token)).status).toBe(404);
    });

    it('routes PUT /draft/sections/order to reorder, not to a section called "order"', async () => {
      await call(endpoints[6], tokenFor('manager'));
      expect(serviceStub.reorderSections).toHaveBeenCalledWith({ expectedVersion: 1, sectionIds: [SECTION_ID] });
      expect(serviceStub.setPlacements).not.toHaveBeenCalled();
    });

    it('marks draft, active and preview reads as no-store so shared caches never keep draft data', async () => {
      const token = tokenFor('manager');
      for (const path of ['/homepage/active', '/homepage/draft', '/homepage/draft/preview']) {
        const { headers } = await call({ method: 'GET', path }, token);
        expect(headers.get('cache-control')).toBe('no-store');
      }
    });
  });

  describe('input validation', () => {
    const manager = () => tokenFor('manager');

    it.each([
      ['create without expectedVersion', 'POST', '/homepage/draft/sections', { type: 'CUSTOM', title: 'x' }],
      ['create with an unknown section type', 'POST', '/homepage/draft/sections', { expectedVersion: 1, type: 'NOPE', title: 'x' }],
      ['create with a blank title', 'POST', '/homepage/draft/sections', { expectedVersion: 1, type: 'CUSTOM', title: '   ' }],
      ['create with an unknown layout preset', 'POST', '/homepage/draft/sections', { expectedVersion: 1, type: 'CUSTOM', title: 'x', layoutType: 'MOSAIC_XL' }],
      ['create with maxItems above the cap', 'POST', '/homepage/draft/sections', { expectedVersion: 1, type: 'CUSTOM', title: 'x', maxItems: 500 }],
      ['create with an unexpected property', 'POST', '/homepage/draft/sections', { expectedVersion: 1, type: 'CUSTOM', title: 'x', published: true }],
      ['update trying to change the type', 'PATCH', `/homepage/draft/sections/${SECTION_ID}`, { expectedVersion: 1, type: 'HERO' }],
      ['update trying to set sortOrder directly', 'PATCH', `/homepage/draft/sections/${SECTION_ID}`, { expectedVersion: 1, sortOrder: 0 }],
      ['update without expectedVersion', 'PATCH', `/homepage/draft/sections/${SECTION_ID}`, { title: 'x' }],
      ['update with a non-integer expectedVersion', 'PATCH', `/homepage/draft/sections/${SECTION_ID}`, { expectedVersion: 'abc', title: 'x' }],
      ['reorder with a non-array', 'PUT', '/homepage/draft/sections/order', { expectedVersion: 1, sectionIds: 'nope' }],
      ['placements with a non-array', 'PUT', `/homepage/draft/sections/${SECTION_ID}/placements`, { expectedVersion: 1, articleIds: 'a1' }],
      ['placements above the cap', 'PUT', `/homepage/draft/sections/${SECTION_ID}/placements`, { expectedVersion: 1, articleIds: Array.from({ length: 25 }, (_, i) => `a${i}`) }],
      ['publish without expectedVersion', 'POST', '/homepage/publish', {}],
      ['delete without expectedVersion', 'DELETE', `/homepage/draft/sections/${SECTION_ID}`, undefined],
    ])('returns 400 for %s', async (_label, method, path, body) => {
      const { status } = await call({ method, path, body }, manager());
      expect(status).toBe(400);
      Object.values(serviceStub).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    });

    it('trims titles before they reach the service', async () => {
      await call({ method: 'POST', path: '/homepage/draft/sections', body: { expectedVersion: 2, type: 'CUSTOM', title: '  Padded  ' } }, manager());
      expect(serviceStub.createSection).toHaveBeenCalledWith(expect.objectContaining({ title: 'Padded', expectedVersion: 2 }));
    });

    it('passes the delete version from the query string as a number', async () => {
      await call({ method: 'DELETE', path: `/homepage/draft/sections/${SECTION_ID}?expectedVersion=7` }, manager());
      expect(serviceStub.deleteSection).toHaveBeenCalledWith(SECTION_ID, 7);
    });
  });

  describe('error contract', () => {
    it('returns a structured 409 for a version conflict', async () => {
      serviceStub.publish.mockRejectedValueOnce(
        new ConflictException({ statusCode: 409, code: 'HOMEPAGE_DRAFT_CONFLICT', message: 'stale', expectedVersion: 1, currentVersion: 4 }),
      );
      const { status, json } = await call(endpoints[8], tokenFor('manager'));
      expect(status).toBe(409);
      expect(json).toMatchObject({ code: 'HOMEPAGE_DRAFT_CONFLICT', expectedVersion: 1, currentVersion: 4 });
    });
  });
});
