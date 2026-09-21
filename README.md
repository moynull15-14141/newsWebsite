# Bangladesh News Platform

> Bangladesh-first, World-aware, modern, smart, editorial-focused digital news platform.

A production-grade, scalable digital news platform built with a monorepo architecture.

## Architecture

```
news-platform/
├── apps/
│   ├── web/          # Public-facing React website
│   ├── admin/        # Newsroom CMS admin panel
│   └── api/          # NestJS REST API backend
├── packages/
│   ├── types/        # Shared TypeScript types and enums
│   ├── config/       # Shared configuration constants
│   └── utils/        # Shared utility functions
├── prisma/           # Database schema, migrations, and seeds
└── docs/             # Documentation
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Helmet (SEO) |
| Admin | React, TypeScript, Vite, Tailwind CSS, TipTap |
| Backend | Node.js, TypeScript, NestJS, Passport, JWT |
| Database | PostgreSQL, Prisma ORM |
| State | TanStack Query, Zustand |
| Build | Turborepo |
| Storage | S3/R2 compatible (local dev fallback) |

## Local Development

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 14
- npm >= 10.0.0

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd news-platform
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your PostgreSQL credentials and other settings.

4. **Start PostgreSQL**

   Ensure PostgreSQL is running and the database specified in `DATABASE_URL` exists.

5. **Run migrations**

   ```bash
   npm run db:migrate
   ```

6. **Seed the database**

   ```bash
   npm run db:seed
   ```

   This seeds:
   - 8 roles (Super Admin through Moderator)
   - 11+ permissions (article.*, media.*, user.*, settings.*, analytics.*)
   - Bangladesh hierarchy (1 country → 8 divisions → 64 districts)
   - 15 default categories
   - 8 default tags
   - Demo admin user (admin@bdnews.com / admin123)
   - Sample published articles for testing

7. **Start development servers**

   ```bash
   # All apps
   npm run dev

   # Or individually
   npm run dev:api     # API on http://localhost:3001
   npm run dev:web     # Web on http://localhost:5173
   npm run dev:admin   # Admin on http://localhost:5174
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run typecheck` | Type-check all apps |
| `npm run test` | Run all tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:reset` | Reset and re-seed database |
| `npm run db:studio` | Open Prisma Studio |

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | No | Login with email/password |
| POST | `/api/v1/auth/refresh` | No | Refresh access token |
| POST | `/api/v1/auth/logout` | Yes | Logout and revoke session |
| GET | `/api/v1/auth/me` | Yes | Get current user profile |

### Articles

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/v1/articles` | Yes | article.create | Create article |
| GET | `/api/v1/articles` | Yes | article.read | List articles (paginated) |
| GET | `/api/v1/articles/:id` | Yes | article.read | Get article by ID |
| PATCH | `/api/v1/articles/:id` | Yes | article.edit | Update article |
| DELETE | `/api/v1/articles/:id` | Yes | article.delete | Delete article |
| POST | `/api/v1/articles/:id/submit-review` | Yes | - | Submit for review |
| POST | `/api/v1/articles/:id/approve` | Yes | article.review | Approve article |
| POST | `/api/v1/articles/:id/publish` | Yes | article.publish | Publish article |
| POST | `/api/v1/articles/:id/archive` | Yes | article.publish | Archive article |
| POST | `/api/v1/articles/:id/return-to-draft` | Yes | article.review | Return to draft |

### Media

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/v1/media` | Yes | media.upload | Upload media file |
| GET | `/api/v1/media` | Yes | media.manage | List media (paginated) |
| GET | `/api/v1/media/:id` | Yes | media.manage | Get media by ID |
| PATCH | `/api/v1/media/:id` | Yes | media.manage | Update media metadata |
| DELETE | `/api/v1/media/:id` | Yes | media.manage | Delete media file |

### Public APIs (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/public/homepage` | Homepage data with latest + category sections |
| GET | `/api/v1/public/articles` | List published articles (paginated, searchable) |
| GET | `/api/v1/public/articles/:slug` | Get published article by slug |
| GET | `/api/v1/public/articles/:slug/related` | Get related articles |
| GET | `/api/v1/public/categories/:slug/articles` | Articles by category |
| GET | `/api/v1/public/tags/:slug/articles` | Articles by tag |
| GET | `/api/v1/public/authors/:id/articles` | Articles by author |
| GET | `/api/v1/public/locations/:slug/articles` | Articles by location |
| GET | `/api/v1/public/search?q=...` | Search articles |

### Supporting Data

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/locations` | No | List locations |
| GET | `/api/v1/categories` | No | List categories |
| GET | `/api/v1/tags` | No | List tags |
| GET | `/api/v1/users` | Yes | List users (admin) |
| GET | `/api/v1/users/authors` | Yes | List authors |

## Database Models

### Core Models

- **User** - Platform users with role-based access
- **Role** - User roles (Super Admin, Admin, Editor, etc.)
- **Permission** - Granular permissions (article.create, media.upload, etc.)
- **RolePermission** - Many-to-many role-permission mapping
- **UserRoleAssignment** - Many-to-many user-role mapping
- **Session** - Refresh token tracking with revocation support

### Content Models

- **Article** - News articles with status workflow (DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED)
- **ArticleTag** - Many-to-many article-tag relationship
- **Location** - Hierarchical Bangladesh location system (Country → Division → District → Upazila)
- **Category** - Content categories with parent/child hierarchy
- **Tag** - Reusable content tags
- **Media** - Uploaded media files (images) with metadata

### Location Hierarchy

```
Bangladesh
├── Barisal (6 districts)
├── Chattogram (11 districts)
├── Dhaka (13 districts)
├── Khulna (10 districts)
├── Mymensingh (4 districts)
├── Rajshahi (8 districts)
├── Rangpur (8 districts)
└── Sylhet (4 districts)
```

### Article Status Workflow

```
Reporter → DRAFT → IN_REVIEW → Editor → APPROVED → PUBLISHED → ARCHIVED
                ↕                              ↕
            (return to draft)
```

## RBAC System

### Roles

| Role | Permissions |
|------|-------------|
| Super Admin | All permissions |
| Admin | article.*, media.*, user.manage, analytics.view |
| Editor-in-Chief | article.create/edit/review/publish, media.*, analytics.view |
| Editor | article.create/edit/review, media.upload, analytics.view |
| Reporter | article.create/edit, media.upload |
| Photographer | article.create, media.upload/manage |
| Contributor | article.create |
| Moderator | article.review, media.manage |

### Permissions

- `article.create`, `article.read`, `article.edit`, `article.review`, `article.publish`, `article.delete`
- `media.upload`, `media.manage`
- `user.manage`
- `settings.manage`
- `analytics.view`

## Project Structure

### `apps/api/`

NestJS REST API with modular architecture:

```
src/
├── common/
│   ├── decorators/    # CurrentUser, RequirePermissions, Public
│   ├── guards/        # JwtAuthGuard, RolesGuard
│   └── storage/       # S3/R2 compatible storage abstraction
├── prisma/            # Prisma service and module
├── modules/
│   ├── auth/          # Login, refresh, logout, JWT strategy
│   ├── articles/      # Article CRUD, status workflow
│   │   ├── services/  # PublishingService, BreakingNewsService, TrendingService,
│   │   │              # MostReadService, ArticleViewService, ArticleRevisionService
│   │   └── schedulers/# ScheduledPublishingScheduler (cron)
│   ├── users/         # User management
│   ├── health/        # Health check endpoint
│   ├── locations/     # Location hierarchy
│   ├── categories/    # Category management
│   ├── tags/          # Tag management
│   ├── media/         # Media upload, CRUD, RBAC
│   └── public/        # Public APIs (no auth required)
├── app.module.ts
└── main.ts
```

### `apps/web/`

Public-facing React website:

```
src/
├── components/        # Header, Footer, ArticleCard, ArticleList, TiptapRenderer, SeoHead
│                      # BreakingNewsBanner
├── layouts/           # MainLayout
├── pages/             # HomePage, ArticlePage, CategoryPage, TagPage, AuthorPage, LocationPage, SearchPage
├── lib/               # API client
├── App.tsx
└── main.tsx
```

### `apps/admin/`

Newsroom CMS admin panel:

```
src/
├── components/        # Sidebar, TopHeader, ProtectedRoute, RichTextEditor
│                      # LocationSelector, CategorySelector, TagSelector
├── layouts/           # AdminLayout
├── pages/             # LoginPage, DashboardPage, ArticlesPage, ArticleEditorPage, MediaPage, RevisionsPage
├── stores/            # Zustand auth store
├── lib/               # API client with auto token refresh
├── App.tsx
└── main.tsx
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `JWT_EXPIRATION` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token lifetime | `7d` |
| `API_URL` | API base URL | `http://localhost:3001` |
| `API_PORT` | API server port | `3001` |
| `API_CORS_ORIGIN` | Allowed CORS origins | `http://localhost:5173,http://localhost:5174` |
| `WEB_URL` | Web app URL | `http://localhost:5173` |
| `GOOGLE_NEWS_PUBLICATION_NAME` | Google News publication label | `BD News` |
| `ADMIN_URL` | Admin app URL | `http://localhost:5174` |
| `NODE_ENV` | Environment mode | `development` |
| `SEED_ADMIN_PASSWORD` | Admin password for seed | `admin123` |
| `STORAGE_PROVIDER` | Storage backend (`local` or `s3`) | `local` |
| `S3_ENDPOINT` | S3/R2 endpoint URL | - |
| `S3_REGION` | S3 region | `auto` |
| `S3_BUCKET` | S3 bucket name | - |
| `S3_ACCESS_KEY_ID` | S3 access key | - |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | - |
| `S3_PUBLIC_BASE_URL` | Public URL base for media | - |
| `LOCAL_STORAGE_PATH` | Local file storage path | `./uploads` |

Production requires `STORAGE_PROVIDER=s3` plus bucket, credentials, region, and public base URL. Local storage is development-only. Use `npm run db:verify-seed` after development/staging seeding to verify 1 country, 8 divisions, and 64 districts. Use `npm run db:backup` and the isolated `npm run db:restore:verify` procedure documented in [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md).

## Demo Credentials

- Development only: **Email:** admin@bdnews.com, **Password:** admin123
- Production seeding requires an explicit `SEED_ADMIN_PASSWORD`.

## Production SEO and health endpoints

- `GET /api/v1/health` - liveness
- `GET /api/v1/health/readiness` - database readiness
- `GET /api/v1/seo/robots.txt` - environment-aware crawler policy
- `GET /api/v1/seo/sitemap.xml` - published article sitemap, batched from PostgreSQL
- `GET /api/v1/seo/news-sitemap.xml` - published articles from the last 48 hours

The deployment proxy should map `/robots.txt`, `/sitemap.xml`, and `/news-sitemap.xml` to the corresponding API endpoints when hosting the public site separately.

## Tests

```bash
# Run all API tests
cd apps/api && npm test

# Run specific test suites
cd apps/api && npm test -- --testPathPattern=auth
cd apps/api && npm test -- --testPathPattern=articles
cd apps/api && npm test -- --testPathPattern=media
cd apps/api && npm test -- --testPathPattern=public
cd apps/api && npm test -- --testPathPattern=breaking
cd apps/api && npm test -- --testPathPattern=trending
cd apps/api && npm test -- --testPathPattern=most-read
cd apps/api && npm test -- --testPathPattern=article-view
cd apps/api && npm test -- --testPathPattern=article-revision
cd apps/api && npm test -- --testPathPattern=publishing
```

### Test Coverage

- **Auth:** Login, JWT validation, session management, password hashing
- **Articles:** CRUD, status workflow, slug uniqueness, filtering, RBAC
- **Media:** Upload validation (mime type, size), CRUD, storage integration
- **Public:** Published article filtering, category/tag/author/location filtering, search, homepage data, related articles
- **Breaking News:** Mark/remove, priority, expiration, public display, unauthorized access
- **Trending:** Scoring algorithm, recency, engagement, location filtering
- **Most Read:** Time windows, view-based ranking, published-only filtering
- **Article Views:** Record, deduplication, statistics
- **Revisions:** Create, list, restore, version incrementing
- **Publishing:** Schedule, publish, archive, cron execution

## Completed Phases

### Phase 1: Monorepo Foundation ✅
- Turborepo monorepo setup
- NestJS API shell with health endpoint
- React web and admin shells
- Prisma schema (User, Role, Permission, UserRoleAssignment, Location, Category, Tag)
- Bangladesh location hierarchy seeded (8 divisions, 64 districts)
- Shared packages (types, config, utils)
- RBAC guard infrastructure

### Phase 2: Core CMS Backend + Admin UI ✅
- JWT authentication (login, refresh, logout, me)
- Role-based access control (8 roles, 11 permissions)
- Article CRUD with status workflow (DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED)
- User management
- TipTap rich text editor in admin
- Article management UI (list, editor, selectors)
- Auth flow (login, protected routes, token refresh)

### Phase 3: Public Website, Media, SEO ✅
- Storage abstraction (S3/R2 compatible with local dev fallback)
- Media module (upload, CRUD, RBAC, validation)
- Public module (no-auth article APIs)
- Public website: HomePage, ArticlePage, CategoryPage, TagPage, AuthorPage, LocationPage, SearchPage
- TipTap JSON content renderer (safe, handles all block types)
- SEO meta tags with React Helmet
- JSON-LD structured data for articles
- robots.txt and sitemap foundation
- Admin media library with upload, metadata editing, deletion
- Featured image selector in article editor
- Sample published articles seeded
- 55 backend tests passing

### Phase 4: News Intelligence + Editorial Control ✅
- Breaking news system (mark/remove, priority, expiration, public display)
- Article view tracking with fingerprint-based deduplication
- Trending algorithm (logarithmic scoring: views × recency)
- Most Read rankings (today/24h/7d time windows)
- Scheduled publishing (server-side cron, automatic publication)
- Article revision history (create, list, restore with safety)
- Publishing service (centralized workflow management)
- Improved homepage feed (breaking, hero, latest, trending, most read, sections)
- Improved related articles (category → tags → location → recency scoring)
- Improved search (category, division, district, date range filters)
- Admin dashboard with real metrics
- Admin article editor with breaking news controls, scheduling, revision saving
- Admin revisions page with restore functionality
- 111 tests passing (12 suites)
- All builds passing

## Future Roadmap

### Phase 5: Advanced Features
- Article revision diff comparison (side-by-side view)
- Comments system
- Advertisement management
- Full analytics dashboard
- Elasticsearch integration
- Push notifications
- Social sharing optimization
- Advanced trending with ML
- Redis caching layer
- Multi-language support

### Phase 5: Production
- Performance optimization
- Security hardening
- Monitoring and logging
- CI/CD pipeline
- Deployment configuration
- CDN integration

## Phase 8 launch documentation

- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - environment matrix, deployment, CDN, migration, and rollback procedure
- [PRODUCTION_SMOKE_TEST.md](PRODUCTION_SMOKE_TEST.md) - post-deployment public, reader, admin, and infrastructure checks
- [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) - backup, restore, RPO/RTO, and storage recovery procedure
- [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) - implemented controls and provider verification checklist
- [PHASE8_REPORT.md](PHASE8_REPORT.md) - evidence, results, limitations, and launch recommendation

## License

Private - All rights reserved.
