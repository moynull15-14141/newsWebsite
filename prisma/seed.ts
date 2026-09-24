import { PrismaClient, UserStatus, LocationType, CategoryStatus, TagStatus, ArticleStatus, JobCategoryStatus } from '../node_modules/.prisma/client';
import * as bcrypt from 'bcryptjs';
import { validateProductionSeedPassword, isKnownDemoPassword } from '../apps/api/src/common/security/seed-password';
import {
  BANGLADESH_DIVISIONS,
  BANGLADESH_DISTRICTS,
  EXPECTED_DIVISION_COUNT,
  EXPECTED_DISTRICT_COUNT,
  verifyLocationSeedIntegrity,
  SeedLocationRow,
} from '../apps/api/src/common/location/bangladesh-locations';

const prisma = new PrismaClient();

// Explicit environment gate: the dev demo fallback may ONLY ever be used when
// NODE_ENV is exactly 'development'. Production always requires a strong,
// explicitly configured SEED_ADMIN_PASSWORD (enforced by the validator below).
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// SEED_SYSTEM_DATA_ONLY=true skips every demo/sample article section below, leaving only roles,
// permissions, languages, locations, categories, tags, and the initial Super Admin — the set safe to
// run against a real production database. Used by `npm run db:seed:production`
// (scripts/seed-production.js). Local/dev seeding without this flag is unchanged and still seeds the
// full demo dataset for a realistic local UI.
const systemDataOnly = process.env.SEED_SYSTEM_DATA_ONLY === 'true';

async function main() {
  console.log(systemDataOnly ? '🌱 Starting seed (system-data-only mode — no demo articles)...\n' : '🌱 Starting seed...\n');

  if (isProduction) validateProductionSeedPassword(process.env.SEED_ADMIN_PASSWORD);
  else if (isDevelopment && (!process.env.SEED_ADMIN_PASSWORD || isKnownDemoPassword(process.env.SEED_ADMIN_PASSWORD))) {
    console.warn('⚠️  Development seed using demo admin credentials. Never use this configuration in production.');
  }

  // ==================== ROLES ====================
  console.log('📋 Seeding roles...');
  const roleNames = [
    { name: 'Super Admin', description: 'Full system access with all permissions' },
    { name: 'Admin', description: 'System administrator with elevated privileges' },
    { name: 'Editor-in-Chief', description: 'Head of editorial team with final publish authority' },
    { name: 'Editor', description: 'Reviews and edits articles before publication' },
    { name: 'Reporter', description: 'Creates and submits news articles' },
    { name: 'Photographer', description: 'Captures and uploads visual content' },
    { name: 'Contributor', description: 'External contributor who submits articles' },
    { name: 'Moderator', description: 'Moderates comments and user-generated content' },
  ];

  const roles: Record<string, string> = {};
  for (const role of roleNames) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roles[role.name] = r.id;
    console.log(`  ✓ Role: ${role.name}`);
  }

  // ==================== PERMISSIONS ====================
  console.log('\n🔑 Seeding permissions...');
  const permissionNames = [
    { name: 'article.create', description: 'Create new articles' },
    { name: 'article.read', description: 'Read articles' },
    { name: 'article.edit', description: 'Edit existing articles' },
    { name: 'article.review', description: 'Review articles for publication' },
    { name: 'article.publish', description: 'Publish articles to the platform' },
    { name: 'article.delete', description: 'Delete articles from the platform' },
    { name: 'audit.read', description: 'View the editorial audit trail for articles' },
    { name: 'media.upload', description: 'Upload media files (images, videos)' },
    { name: 'media.manage', description: 'Manage and organize media library' },
    { name: 'user.manage', description: 'Manage user accounts and roles' },
    { name: 'settings.manage', description: 'Manage platform settings' },
    { name: 'analytics.view', description: 'View analytics and reports' },
    { name: 'comment.moderate', description: 'Moderate reader comments' },
    { name: 'comment.delete', description: 'Delete reader comments' },
    { name: 'ad.manage', description: 'Manage advertisements (legacy flat Ad model)' },
    { name: 'ads.view', description: 'View advertisers, campaigns, creatives and placements' },
    { name: 'ads.create', description: 'Create advertisers, campaigns and creatives' },
    { name: 'ads.update', description: 'Edit advertisers, campaigns and creatives' },
    { name: 'ads.approve', description: 'Approve or reject campaigns pending review' },
    { name: 'ads.publish', description: 'Activate, schedule, pause and archive campaigns' },
    { name: 'ads.delete', description: 'Delete draft advertisers, campaigns and creatives' },
    { name: 'ads.placement.manage', description: 'Enable/disable placements and manage campaign-placement assignments' },
    { name: 'ads.analytics.view', description: 'View ad impression/click analytics' },
    { name: 'collection.manage', description: 'Manage editorial collections' },
    { name: 'homepage.manage', description: 'Manage homepage editorial sections' },
    { name: 'breaking_news.manage', description: 'Manage the public breaking-news ticker' },
    { name: 'job.create', description: 'Create new job postings' },
    { name: 'job.read', description: 'Read job postings, including unpublished ones' },
    { name: 'job.edit', description: 'Edit existing job postings' },
    { name: 'job.review', description: 'Review job postings for publication' },
    { name: 'job.publish', description: 'Publish, schedule, and archive job postings' },
    { name: 'job.delete', description: 'Delete job postings' },
    { name: 'job.manage_categories', description: 'Manage job categories' },
    { name: 'job.manage_employers', description: 'Manage employer/company records' },
    { name: 'job_application.view', description: 'View job applications' },
    { name: 'job_application.manage', description: 'Manage job application status and notes' },
    { name: 'employer.verify', description: 'Verify or reject self-service employer accounts' },
    { name: 'employer.suspend', description: 'Suspend or reactivate employer accounts' },
    { name: 'platform.settings.view', description: 'View platform feature-flag settings' },
    { name: 'platform.settings.manage', description: 'Manage platform feature-flag settings' },
  ];

  const permissions: Record<string, string> = {};
  for (const perm of permissionNames) {
    const p = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: { name: perm.name, description: perm.description },
    });
    permissions[perm.name] = p.id;
    console.log(`  ✓ Permission: ${perm.name}`);
  }

  // ==================== ROLE PERMISSIONS ====================
  console.log('\n🔗 Seeding role permissions...');
  const rolePermissionsMap: Record<string, string[]> = {
    'Super Admin': Object.keys(permissions),
    'Admin': ['article.create', 'article.read', 'article.edit', 'article.review', 'article.publish', 'article.delete', 'audit.read', 'media.upload', 'media.manage', 'user.manage', 'analytics.view', 'comment.moderate', 'comment.delete', 'ad.manage', 'ads.view', 'ads.create', 'ads.update', 'ads.approve', 'ads.publish', 'ads.delete', 'ads.placement.manage', 'ads.analytics.view', 'collection.manage', 'homepage.manage', 'breaking_news.manage', 'job.create', 'job.read', 'job.edit', 'job.review', 'job.publish', 'job.delete', 'job.manage_categories', 'job.manage_employers', 'job_application.view', 'job_application.manage', 'employer.verify', 'employer.suspend', 'platform.settings.view', 'platform.settings.manage'],
    'Editor-in-Chief': ['article.create', 'article.read', 'article.edit', 'article.review', 'article.publish', 'audit.read', 'media.upload', 'media.manage', 'analytics.view', 'breaking_news.manage', 'job.create', 'job.read', 'job.edit', 'job.review', 'job.publish', 'job.manage_categories', 'job.manage_employers', 'job_application.view', 'job_application.manage', 'employer.verify', 'employer.suspend', 'platform.settings.view', 'platform.settings.manage'],
    'Editor': ['article.create', 'article.read', 'article.edit', 'article.review', 'audit.read', 'media.upload', 'analytics.view', 'job.create', 'job.read', 'job.edit', 'job.review', 'job_application.view'],
    'Reporter': ['article.create', 'article.read', 'article.edit', 'media.upload', 'job.create', 'job.read', 'job.edit'],
    'Photographer': ['article.create', 'article.read', 'media.upload', 'media.manage'],
    'Contributor': ['article.create', 'article.read'],
    'Moderator': ['article.read', 'article.review', 'media.manage', 'comment.moderate'],
  };

  for (const [roleName, permNames] of Object.entries(rolePermissionsMap)) {
    const roleId = roles[roleName];
    if (!roleId) continue;

    for (const permName of permNames) {
      const permissionId = permissions[permName];
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
    }
    console.log(`  ✓ Role permissions: ${roleName} (${permNames.length} permissions)`);
  }

  // ==================== LANGUAGES ====================
  console.log('\n🌐 Seeding languages...');
  const languageData = [
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', isDefault: true, sortOrder: 0 },
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isDefault: false, sortOrder: 1 },
  ];
  const languages: Record<string, string> = {};
  for (const lang of languageData) {
    const l = await prisma.language.upsert({
      where: { code: lang.code },
      update: { name: lang.name, nativeName: lang.nativeName, isDefault: lang.isDefault, sortOrder: lang.sortOrder },
      create: lang,
    });
    languages[lang.code] = l.id;
    console.log(`  ✓ Language: ${lang.name} (${lang.nativeName})`);
  }
  const bnLanguageId = languages['bn'];
  const enLanguageId = languages['en'];

  // ==================== LOCATIONS (BANGLADESH) ====================
  console.log('\n🌍 Seeding locations...');

  // Create Bangladesh (country)
  const bangladesh = await prisma.location.upsert({
    where: { identityKey: 'COUNTRY:root:bangladesh' },
    update: {},
    create: {
      name: 'Bangladesh',
      slug: 'bangladesh',
      type: LocationType.COUNTRY,
      identityKey: 'COUNTRY:root:bangladesh',
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Country: Bangladesh');

  // Create all 8 divisions — dataset sourced from ./bangladesh-locations.ts
  // Identity is (type, parent, slug) via identityKey, NEVER slug alone, so a
  // division can never be matched/overwritten by a same-named district.
  const divisions = BANGLADESH_DIVISIONS;

  const divisionIds: Record<string, string> = {};
  for (const div of divisions) {
    const d = await prisma.location.upsert({
      where: { identityKey: `DIVISION:${bangladesh.id}:${div.slug}` },
      update: {},
      create: {
        name: div.name,
        slug: div.slug,
        type: LocationType.DIVISION,
        identityKey: `DIVISION:${bangladesh.id}:${div.slug}`,
        parentId: bangladesh.id,
        status: 'ACTIVE',
      },
    });
    divisionIds[div.slug] = d.id;
    console.log(`  ✓ Division: ${div.name}`);
  }

  // Create all 64 districts — dataset sourced from ./bangladesh-locations.ts
  // Upsert identity is identityKey = DISTRICT:<divisionId>:<slug>. A district
  // with the same slug as its division (e.g. dhaka/dhaka) resolves to its own
  // identityKey row and can never match or update the division record.
  const districts = BANGLADESH_DISTRICTS;

  for (const district of districts) {
    if (!divisionIds[district.division]) {
      throw new Error('Location seed failure: district references an unknown division');
    }
    await prisma.location.upsert({
      where: { identityKey: `DISTRICT:${divisionIds[district.division]}:${district.slug}` },
      update: {},
      create: {
        name: district.name,
        slug: district.slug,
        type: LocationType.DISTRICT,
        identityKey: `DISTRICT:${divisionIds[district.division]}:${district.slug}`,
        parentId: divisionIds[district.division],
        status: 'ACTIVE',
      },
    });
    console.log(`  ✓ District: ${district.name} (${district.division})`);
  }

  // P0-02 integrity gate: after upserts, re-read the full location tree and
  // verify 1 country / 8 divisions / 64 districts, correct parents, and that
  // no district ever collided with a same-named division record.
  const seededLocations = (await prisma.location.findMany({
    select: { id: true, name: true, slug: true, type: true, parentId: true },
  })) as SeedLocationRow[];
  verifyLocationSeedIntegrity(seededLocations);
  console.log(`  ✓ Location integrity verified: 1 country, ${EXPECTED_DIVISION_COUNT} divisions, ${EXPECTED_DISTRICT_COUNT} districts`);

  const findSeedLocation = async (slug: string) =>
    (await prisma.location.findFirst({ where: { slug, type: LocationType.DISTRICT } })) ||
    (await prisma.location.findFirst({ where: { slug, type: LocationType.DIVISION } })) ||
    (await prisma.location.findFirst({ where: { slug, type: LocationType.COUNTRY } }));

  // Localized (Bangla) names for Bangladesh and its divisions — the base .name/.slug stay exactly as
  // seeded above (unchanged); a translation only adds what is DISPLAYED, never a second location.
  console.log('\n🌐 Seeding Bangladesh location names (বাংলা)...');
  const bangladeshNameBn: Record<string, string> = {
    bangladesh: 'বাংলাদেশ',
    barisal: 'বরিশাল',
    chattogram: 'চট্টগ্রাম',
    dhaka: 'ঢাকা',
    khulna: 'খুলনা',
    mymensingh: 'ময়মনসিংহ',
    rajshahi: 'রাজশাহী',
    rangpur: 'রংপুর',
    sylhet: 'সিলেট',
  };
  for (const [slug, name] of Object.entries(bangladeshNameBn)) {
    const location = slug === 'bangladesh' ? bangladesh : await prisma.location.findFirst({ where: { slug, type: LocationType.DIVISION } });
    if (!location) continue;
    await prisma.locationTranslation.upsert({
      where: { locationId_languageId: { locationId: location.id, languageId: bnLanguageId } },
      update: { name },
      create: { locationId: location.id, languageId: bnLanguageId, name },
    });
  }
  console.log(`  ✓ Localized ${Object.keys(bangladeshNameBn).length} Bangladesh location names`);

  // ==================== GLOBAL LOCATIONS ====================
  // Bangladesh above is untouched — these are additional, separate top-level/nested locations so the
  // platform can also cover world news. A modest set on purpose (Part 26: don't overpopulate).
  console.log('\n🌍 Seeding global locations...');

  const continentData = [
    { slug: 'asia', name: 'Asia', nameBn: 'এশিয়া' },
    { slug: 'europe', name: 'Europe', nameBn: 'ইউরোপ' },
    { slug: 'north-america', name: 'North America', nameBn: 'উত্তর আমেরিকা' },
  ];
  const continentIds: Record<string, string> = {};
  for (const c of continentData) {
    const row = await prisma.location.upsert({
      where: { identityKey: `CONTINENT:root:${c.slug}` },
      update: {},
      create: { name: c.name, slug: c.slug, type: LocationType.CONTINENT, identityKey: `CONTINENT:root:${c.slug}`, status: 'ACTIVE' },
    });
    continentIds[c.slug] = row.id;
    await prisma.locationTranslation.upsert({
      where: { locationId_languageId: { locationId: row.id, languageId: bnLanguageId } },
      update: { name: c.nameBn },
      create: { locationId: row.id, languageId: bnLanguageId, name: c.nameBn },
    });
    console.log(`  ✓ Continent: ${c.name}`);
  }

  const countryData = [
    { slug: 'india', name: 'India', nameBn: 'ভারত', continent: 'asia', countryCode: 'IN' },
    { slug: 'china', name: 'China', nameBn: 'চীন', continent: 'asia', countryCode: 'CN' },
    { slug: 'united-kingdom', name: 'United Kingdom', nameBn: 'যুক্তরাজ্য', continent: 'europe', countryCode: 'GB' },
    { slug: 'united-states', name: 'United States', nameBn: 'যুক্তরাষ্ট্র', continent: 'north-america', countryCode: 'US' },
  ];
  const countryIds: Record<string, string> = {};
  for (const c of countryData) {
    const parentId = continentIds[c.continent];
    const row = await prisma.location.upsert({
      where: { identityKey: `COUNTRY:${parentId}:${c.slug}` },
      update: {},
      create: { name: c.name, slug: c.slug, type: LocationType.COUNTRY, parentId, identityKey: `COUNTRY:${parentId}:${c.slug}`, countryCode: c.countryCode, status: 'ACTIVE' },
    });
    countryIds[c.slug] = row.id;
    await prisma.locationTranslation.upsert({
      where: { locationId_languageId: { locationId: row.id, languageId: bnLanguageId } },
      update: { name: c.nameBn },
      create: { locationId: row.id, languageId: bnLanguageId, name: c.nameBn },
    });
    console.log(`  ✓ Country: ${c.name}`);
  }

  const regionData = [
    { slug: 'delhi', name: 'Delhi', nameBn: 'দিল্লি', type: LocationType.STATE, parent: 'india' as const, parentKind: 'country' as const },
    { slug: 'london', name: 'London', nameBn: 'লন্ডন', type: LocationType.CITY, parent: 'united-kingdom' as const, parentKind: 'country' as const },
    { slug: 'new-york', name: 'New York', nameBn: 'নিউ ইয়র্ক', type: LocationType.CITY, parent: 'united-states' as const, parentKind: 'country' as const },
  ];
  for (const r of regionData) {
    const parentId = countryIds[r.parent];
    const row = await prisma.location.upsert({
      where: { identityKey: `${r.type}:${parentId}:${r.slug}` },
      update: {},
      create: { name: r.name, slug: r.slug, type: r.type, parentId, identityKey: `${r.type}:${parentId}:${r.slug}`, status: 'ACTIVE' },
    });
    await prisma.locationTranslation.upsert({
      where: { locationId_languageId: { locationId: row.id, languageId: bnLanguageId } },
      update: { name: r.nameBn },
      create: { locationId: row.id, languageId: bnLanguageId, name: r.nameBn },
    });
    console.log(`  ✓ ${r.type === LocationType.STATE ? 'State' : 'City'}: ${r.name}`);
  }

  // ==================== CATEGORIES ====================
  console.log('\n📂 Seeding categories...');
  const categoryData = [
    { name: 'Bangladesh', slug: 'bangladesh', sortOrder: 1, nameBn: 'বাংলাদেশ' },
    { name: 'World', slug: 'world', sortOrder: 2, nameBn: 'বিশ্ব' },
    { name: 'Politics', slug: 'politics', sortOrder: 3, nameBn: 'রাজনীতি' },
    { name: 'Business', slug: 'business', sortOrder: 4, nameBn: 'ব্যবসা' },
    { name: 'Economy', slug: 'economy', sortOrder: 5, nameBn: 'অর্থনীতি' },
    { name: 'Sports', slug: 'sports', sortOrder: 6, nameBn: 'খেলা' },
    { name: 'Technology', slug: 'technology', sortOrder: 7, nameBn: 'প্রযুক্তি' },
    { name: 'Entertainment', slug: 'entertainment', sortOrder: 8, nameBn: 'বিনোদন' },
    { name: 'Education', slug: 'education', sortOrder: 9, nameBn: 'শিক্ষা' },
    { name: 'Health', slug: 'health', sortOrder: 10, nameBn: 'স্বাস্থ্য' },
    { name: 'Crime', slug: 'crime', sortOrder: 11, nameBn: 'অপরাধ' },
    { name: 'Lifestyle', slug: 'lifestyle', sortOrder: 12, nameBn: 'জীবনযাপন' },
    { name: 'Travel', slug: 'travel', sortOrder: 13, nameBn: 'ভ্রমণ' },
    { name: 'Science', slug: 'science', sortOrder: 14, nameBn: 'বিজ্ঞান' },
    { name: 'Religion', slug: 'religion', sortOrder: 15, nameBn: 'ধর্ম' },
  ];

  for (const cat of categoryData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        slug: cat.slug,
        status: CategoryStatus.ACTIVE,
        sortOrder: cat.sortOrder,
      },
    });
    // Localized names: bn gets the real Bangla word; en is recorded explicitly too (not just implied
    // by the base .name) so both languages go through the same translation relationship.
    for (const [languageId, name] of [[bnLanguageId, cat.nameBn], [enLanguageId, cat.name]] as const) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_languageId: { categoryId: created.id, languageId } },
        update: { name },
        create: { categoryId: created.id, languageId, name, slug: cat.slug },
      });
    }
    console.log(`  ✓ Category: ${cat.name} (${cat.nameBn})`);
  }

  // ==================== JOB CATEGORIES ====================
  // Its own flat taxonomy, deliberately separate from the news Category tree above (see JobCategory's
  // doc comment in schema.prisma) — reference data genuinely required to launch the Jobs platform with
  // a usable category filter, not demo content.
  console.log('\n💼 Seeding job categories...');
  const jobCategoryData = [
    { name: 'Government', slug: 'government', sortOrder: 1 },
    { name: 'Private', slug: 'private', sortOrder: 2 },
    { name: 'Bank', slug: 'bank', sortOrder: 3 },
    { name: 'NGO', slug: 'ngo', sortOrder: 4 },
    { name: 'Education', slug: 'education-jobs', sortOrder: 5 },
    { name: 'IT & Software', slug: 'it-software', sortOrder: 6 },
    { name: 'Healthcare', slug: 'healthcare', sortOrder: 7 },
    { name: 'Engineering', slug: 'engineering', sortOrder: 8 },
    { name: 'Sales & Marketing', slug: 'sales-marketing', sortOrder: 9 },
    { name: 'Accounting & Finance', slug: 'accounting-finance', sortOrder: 10 },
    { name: 'Garments & Textile', slug: 'garments-textile', sortOrder: 11 },
    { name: 'Hospitality', slug: 'hospitality', sortOrder: 12 },
    { name: 'Internship', slug: 'internship', sortOrder: 13 },
    { name: 'Remote', slug: 'remote-jobs', sortOrder: 14 },
    { name: 'Other', slug: 'other-jobs', sortOrder: 15 },
  ];
  for (const cat of jobCategoryData) {
    await prisma.jobCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { name: cat.name, slug: cat.slug, status: JobCategoryStatus.ACTIVE, sortOrder: cat.sortOrder },
    });
    console.log(`  ✓ Job category: ${cat.name}`);
  }

  // ==================== JOB POSTING PLANS (Phase 2P) ====================
  // Catalog/config row, not demo content — the single FREE plan third-party employers can post under
  // once the employer platform is enabled. Paid plans are a future admin-managed addition.
  console.log('\n💳 Seeding job posting plans...');
  await prisma.jobPostingPlan.upsert({
    where: { key: 'standard_free' },
    update: { name: 'Standard (Free)', type: 'FREE', durationDays: 30, isFeatured: false, isActive: true, sortOrder: 0 },
    create: { key: 'standard_free', name: 'Standard (Free)', type: 'FREE', durationDays: 30, isFeatured: false, isActive: true, sortOrder: 0 },
  });
  console.log('  ✓ Job posting plan: standard_free');

  // ==================== PLATFORM SETTINGS (Phase 2P) ====================
  // Safe-by-default feature flags gating the employer/third-party job-posting platform. Every switch
  // that could expose the platform to the public (registration, self-service posting, paid posting,
  // auto-publish) starts OFF; only read-only-ish/administrative defaults start ON. Pure config, upserted
  // idempotently like every other catalog row in this file — never overwritten if an admin already
  // changed it (update: {} leaves an existing row untouched on re-seed).
  console.log('\n⚙️  Seeding platform settings...');
  const platformSettingDefaults: Record<string, boolean> = {
    employer_platform_enabled: false,
    employer_registration_enabled: false,
    company_profiles_enabled: true,
    third_party_job_posting_enabled: false,
    free_job_posting_enabled: true,
    paid_job_posting_enabled: false,
    featured_job_promotion_enabled: false,
    employer_application_access_enabled: true,
    employer_dashboard_enabled: true,
    require_employer_verification: true,
    require_admin_job_approval: true,
    auto_publish: false,
  };
  for (const [key, value] of Object.entries(platformSettingDefaults)) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
    console.log(`  ✓ Platform setting: ${key} = ${value}`);
  }

  // ==================== TAGS ====================
  console.log('\n🏷️  Seeding default tags...');
  const defaultTags = [
    { name: 'Breaking News', slug: 'breaking-news', nameBn: 'জরুরি সংবাদ' },
    { name: 'Exclusive', slug: 'exclusive', nameBn: 'এক্সক্লুসিভ' },
    { name: 'Investigation', slug: 'investigation', nameBn: 'অনুসন্ধান' },
    { name: 'Opinion', slug: 'opinion', nameBn: 'মতামত' },
    { name: 'Analysis', slug: 'analysis', nameBn: 'বিশ্লেষণ' },
    { name: 'Interview', slug: 'interview', nameBn: 'সাক্ষাৎকার' },
    { name: 'Live Update', slug: 'live-update', nameBn: 'সরাসরি আপডেট' },
    { name: 'Special Report', slug: 'special-report', nameBn: 'বিশেষ প্রতিবেদন' },
  ];

  for (const tag of defaultTags) {
    const created = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: {
        name: tag.name,
        slug: tag.slug,
        status: TagStatus.ACTIVE,
      },
    });
    for (const [languageId, name] of [[bnLanguageId, tag.nameBn], [enLanguageId, tag.name]] as const) {
      await prisma.tagTranslation.upsert({
        where: { tagId_languageId: { tagId: created.id, languageId } },
        update: { name },
        create: { tagId: created.id, languageId, name, slug: tag.slug },
      });
    }
    console.log(`  ✓ Tag: ${tag.name} (${tag.nameBn})`);
  }

  // ==================== ADMIN USER ====================
  console.log('\n👤 Creating demo admin user...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const superAdminRoleId = roles['Super Admin'];
  const adminEmail = 'admin@bdnews.com';

  // ==================== AD PLACEMENT REGISTRY ====================
  // System configuration, not ad content: the fixed inventory of WHERE an ad can ever appear (Phase 2Q
  // spec). Seeded once, upserted so re-running never duplicates or wipes an admin's enabled/disabled
  // choice for an existing placement (`update: {}` — this seed never overwrites `enabled`).
  console.log('\n📐 Seeding ad placement registry...');
  const adPlacements: { key: string; label: string; group: string; description: string; width?: number; height?: number }[] = [
    { key: 'BREAKING_NEWS_BELOW', label: 'Below Breaking News', group: 'GLOBAL', description: 'Full-width banner directly under the breaking-news ticker.', width: 970, height: 90 },
    { key: 'TOP_BILLBOARD', label: 'Top Billboard', group: 'GLOBAL', description: 'Full-width billboard at the very top of every page.', width: 970, height: 250 },
    { key: 'MOBILE_STICKY', label: 'Mobile Sticky Footer', group: 'GLOBAL', description: 'Sticky banner anchored to the bottom of the viewport on mobile.', width: 320, height: 50 },
    { key: 'HOME_HERO', label: 'Homepage Hero', group: 'HOMEPAGE', description: 'Beside/below the homepage hero story.', width: 300, height: 250 },
    { key: 'HOME_FEED', label: 'Homepage Feed', group: 'HOMEPAGE', description: 'Native slot inline with the homepage latest-news feed.', width: 728, height: 90 },
    { key: 'HOME_MID_FEED', label: 'Homepage Mid-Feed', group: 'HOMEPAGE', description: 'Midway through the homepage feed.', width: 728, height: 90 },
    { key: 'HOME_SIDEBAR', label: 'Homepage Sidebar', group: 'HOMEPAGE', description: 'Homepage sidebar rail.', width: 300, height: 600 },
    { key: 'HOME_BEFORE_FOOTER', label: 'Homepage Before Footer', group: 'HOMEPAGE', description: 'Full-width banner just above the footer.', width: 970, height: 250 },
    { key: 'ARTICLE_TOP', label: 'Article Top', group: 'ARTICLE', description: 'Above the article headline.', width: 728, height: 90 },
    { key: 'ARTICLE_AFTER_INTRO', label: 'Article After Intro', group: 'ARTICLE', description: 'Directly after the opening paragraph.', width: 336, height: 280 },
    { key: 'ARTICLE_IN_CONTENT', label: 'Article In-Content', group: 'ARTICLE', description: 'Embedded within the article body.', width: 336, height: 280 },
    { key: 'ARTICLE_MID', label: 'Article Middle', group: 'ARTICLE', description: 'Roughly midway through the article body.', width: 336, height: 280 },
    { key: 'ARTICLE_END', label: 'Article End', group: 'ARTICLE', description: 'After the article body, before related stories.', width: 728, height: 90 },
    { key: 'ARTICLE_RELATED', label: 'Article Related Rail', group: 'ARTICLE', description: 'Within the related-articles rail.', width: 300, height: 250 },
    { key: 'ARTICLE_SIDEBAR', label: 'Article Sidebar', group: 'ARTICLE', description: 'Article page sidebar rail.', width: 300, height: 600 },
    { key: 'CATEGORY_TOP', label: 'Category Top', group: 'CATEGORY', description: 'Above the category feed.', width: 728, height: 90 },
    { key: 'CATEGORY_FEED', label: 'Category Feed', group: 'CATEGORY', description: 'Native slot inline with the category feed.', width: 728, height: 90 },
    { key: 'CATEGORY_MID', label: 'Category Middle', group: 'CATEGORY', description: 'Midway through the category feed.', width: 728, height: 90 },
    { key: 'CATEGORY_SIDEBAR', label: 'Category Sidebar', group: 'CATEGORY', description: 'Category page sidebar rail.', width: 300, height: 600 },
    { key: 'SEARCH_INLINE', label: 'Search Results Inline', group: 'SEARCH', description: 'Inline within search results.', width: 728, height: 90 },
    { key: 'PAGE_TOP', label: 'Generic Page Top', group: 'GENERIC', description: 'Reusable top slot for pages without a dedicated placement.', width: 728, height: 90 },
    { key: 'PAGE_CONTENT', label: 'Generic Page Content', group: 'GENERIC', description: 'Reusable in-content slot for pages without a dedicated placement.', width: 336, height: 280 },
    { key: 'PAGE_SIDEBAR', label: 'Generic Page Sidebar', group: 'GENERIC', description: 'Reusable sidebar slot for pages without a dedicated placement.', width: 300, height: 600 },
    { key: 'PAGE_BOTTOM', label: 'Generic Page Bottom', group: 'GENERIC', description: 'Reusable bottom slot for pages without a dedicated placement.', width: 728, height: 90 },
  ];
  for (const p of adPlacements) {
    await prisma.adPlacement.upsert({
      where: { key: p.key as any },
      update: { label: p.label, group: p.group as any, description: p.description, recommendedWidth: p.width, recommendedHeight: p.height },
      create: { key: p.key as any, label: p.label, group: p.group as any, description: p.description, recommendedWidth: p.width, recommendedHeight: p.height },
    });
  }
  console.log(`  ✓ Ad placements: ${adPlacements.length}`);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash: hashedPassword,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: superAdminRoleId },
    },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRoleId },
  });

  console.log(`  ✓ Admin user created: ${adminEmail}`);
  console.log(`  ✓ Role: Super Admin`);

  if (systemDataOnly) {
    console.log('\n⏭️  Skipping demo/sample articles (SEED_SYSTEM_DATA_ONLY=true).');
  } else {
  // ==================== SAMPLE ARTICLES ====================
  console.log('\n📰 Seeding sample articles...');

  const articleData = [
    {
      title: 'Bangladesh Achieves Record GDP Growth in 2024',
      slug: 'bangladesh-record-gdp-growth-2024',
      excerpt: 'Bangladesh has achieved its highest GDP growth rate in history, marking a significant milestone in the nation\'s economic development.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Economic Milestone' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Bangladesh has achieved a remarkable 8.5% GDP growth rate in 2024, the highest in the nation\'s history. This achievement places Bangladesh among the fastest-growing economies in South Asia.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The growth has been driven by strong performance in the ready-made garment sector, remittances from overseas workers, and increasing domestic consumption. The government has attributed this success to strategic economic policies and infrastructure investments.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Economists predict this trend will continue into 2025, with projections suggesting sustained growth above 8% annually.',
              },
            ],
          },
        ],
      },
      categorySlug: 'economy',
      locationSlug: 'dhaka',
      tagSlugs: ['breaking-news', 'analysis'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Chattogram Port Expansion Project Gets Final Approval',
      slug: 'chattogram-port-expansion-approved',
      excerpt: 'The government has given final approval for the expansion of Chattogram Port, which will significantly increase the country\'s trade capacity.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Port Expansion Details' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The Chattogram Port Authority has received final approval from the Cabinet Committee on Economic Affairs for a $2.5 billion expansion project. The expansion will increase the port\'s container handling capacity from 3.2 million TEUs to 6 million TEUs annually.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The project includes construction of three new berths, a container yard expansion, and modernization of cargo handling equipment. Construction is expected to begin in early 2025.',
              },
            ],
          },
        ],
      },
      categorySlug: 'business',
      locationSlug: 'chattogram',
      tagSlugs: ['special-report'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Bangladesh National Cricket Team Wins Asia Cup',
      slug: 'bangladesh-wins-asia-cup',
      excerpt: 'The Bangladesh national cricket team has won the Asia Cup 2024, defeating India in a thrilling final match.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Historic Victory' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'In a stunning display of cricket, Bangladesh defeated India by 6 wickets in the final of the Asia Cup 2024 held in Dubai. This marks Bangladesh\'s first-ever Asia Cup title.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Shakib Al Hasan was named Player of the Match for his brilliant all-round performance, taking 3 wickets and scoring 78 runs not out. Captain Litton Das praised the team\'s effort and dedication.',
              },
            ],
          },
        ],
      },
      categorySlug: 'sports',
      locationSlug: 'dhaka',
      tagSlugs: ['breaking-news', 'exclusive'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'New Metro Rail Line Opens in Dhaka',
      slug: 'dhaka-metro-rail-line-opens',
      excerpt: 'The long-awaited Metro Rail Line 6 extension has been officially opened, connecting Uttara to Motijheel.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Transportation Revolution' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The Dhaka Mass Transit Company Limited (DMTCL) has officially opened the extended Metro Rail Line 6, connecting Uttara to Motijheel. The 20-kilometer extension is expected to significantly reduce traffic congestion in the capital.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The metro can carry up to 60,000 passengers per hour in each direction and will operate from 6 AM to 10 PM daily. Ticket prices have been set at an affordable rate to encourage public usage.',
              },
            ],
          },
        ],
      },
      categorySlug: 'bangladesh',
      locationSlug: 'dhaka',
      tagSlugs: ['live-update'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Global Climate Summit: Bangladesh Leads on Adaptation',
      slug: 'global-climate-summit-bangladesh',
      excerpt: 'Bangladesh has been praised at the Global Climate Summit for its leadership in climate adaptation strategies.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'International Recognition' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'At the Global Climate Summit 2024 in Geneva, Bangladesh has been recognized as a global leader in climate adaptation. The country\'s comprehensive approach to dealing with climate change, including the Bangladesh Climate Change Strategy and Action Plan, has been held up as a model for developing nations.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Prime Minister\'s Climate Adviser highlighted Bangladesh\'s investments in flood embankments, cyclone shelters, and saline-tolerant crop varieties as key achievements.',
              },
            ],
          },
        ],
      },
      categorySlug: 'world',
      locationSlug: 'bangladesh',
      tagSlugs: ['special-report', 'interview'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'AI Revolution in Bangladeshi Healthcare',
      slug: 'ai-healthcare-bangladesh',
      excerpt: 'Artificial Intelligence is transforming healthcare delivery in Bangladesh with new diagnostic tools.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Technology Meets Medicine' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Several Bangladeshi hospitals have adopted AI-powered diagnostic tools that can detect diseases with over 95% accuracy. The technology is particularly useful in rural areas where specialist doctors are scarce.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The Ministry of Health has announced plans to deploy AI diagnostic systems in all district hospitals by 2026, marking a significant step towards modernizing healthcare in the country.',
              },
            ],
          },
        ],
      },
      categorySlug: 'technology',
      locationSlug: 'dhaka',
      tagSlugs: ['analysis', 'investigation'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Bollywood Star Visits Bangladesh for Film Festival',
      slug: 'bollywood-star-bangladesh-film-festival',
      excerpt: 'Popular Bollywood actor visits Dhaka International Film Festival, expressing admiration for Bangladeshi cinema.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Cultural Exchange' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Renowned Bollywood actor Shah Rukh Khan visited Dhaka to attend the 22nd Dhaka International Film Festival. During his visit, he praised the quality of Bangladeshi cinema and expressed interest in collaborating with local filmmakers.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The actor participated in a special screening and interacted with fans at the Bangabandhu International Conference Center.',
              },
            ],
          },
        ],
      },
      categorySlug: 'entertainment',
      locationSlug: 'dhaka',
      tagSlugs: ['exclusive'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'World Leaders Gather for UN General Assembly',
      slug: 'un-general-assembly-2024',
      excerpt: 'World leaders converge at the United Nations General Assembly to discuss pressing global issues.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Diplomatic Gathering' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The 79th session of the United Nations General Assembly has begun in New York, with world leaders gathering to address critical issues including climate change, global security, and sustainable development.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Bangladesh Foreign Minister is scheduled to address the assembly on September 25, focusing on climate justice and the rights of developing nations.',
              },
            ],
          },
        ],
      },
      categorySlug: 'world',
      locationSlug: 'bangladesh',
      tagSlugs: ['live-update', 'breaking-news'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Education Reform: New Curriculum for 2025',
      slug: 'education-reform-curriculum-2025',
      excerpt: 'The Ministry of Education has announced comprehensive reforms to the national curriculum for 2025.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Curriculum Overhaul' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The Ministry of Education has unveiled a comprehensive reform plan for the national curriculum, emphasizing critical thinking, digital literacy, and practical skills over rote memorization.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The new curriculum will be implemented in phases starting from January 2025, affecting over 40 million students across the country.',
              },
            ],
          },
        ],
      },
      categorySlug: 'education',
      locationSlug: 'dhaka',
      tagSlugs: ['special-report'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'New Medical College Opens in Sylhet',
      slug: 'new-medical-college-sylhet',
      excerpt: 'A new government medical college has been inaugurated in Sylhet to address the shortage of healthcare professionals in the region.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Healthcare Expansion' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The government has inaugurated a new medical college in Sylhet, capable of admitting 100 students annually. The college is equipped with modern facilities and teaching hospitals.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The initiative aims to address the shortage of doctors in the Sylhet division and reduce the burden on existing medical facilities.',
              },
            ],
          },
        ],
      },
      categorySlug: 'health',
      locationSlug: 'sylhet',
      tagSlugs: ['investigation'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Police Crack Down on Cybercrime Network',
      slug: 'police-cybercrime-network-crackdown',
      excerpt: 'Bangladesh Police has dismantled a major cybercrime network operating across multiple districts.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Major Operation' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The Cyber Crime Prevention Unit of Bangladesh Police has dismantled a sophisticated cybercrime network that had been defrauding citizens across the country. Twelve individuals have been arrested in connection with the operation.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The network was involved in phishing attacks, identity theft, and online financial fraud amounting to approximately BDT 50 crore.',
              },
            ],
          },
        ],
      },
      categorySlug: 'crime',
      locationSlug: 'dhaka',
      tagSlugs: ['breaking-news'],
      status: ArticleStatus.PUBLISHED,
    },
    {
      title: 'Tourism Boom in Cox\'s Bazar During Peak Season',
      slug: 'tourism-boom-coxs-bazar',
      excerpt: 'Cox\'s Bazar records its highest tourist numbers in five years during the peak season.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Record Visitors' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Cox\'s Bazar, home to the world\'s longest natural sea beach, has recorded over 500,000 visitors during the peak tourist season, the highest number in five years. The surge is attributed to improved infrastructure and promotional campaigns.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Local hotel and restaurant owners report a 40% increase in revenue compared to the same period last year.',
              },
            ],
          },
        ],
      },
      categorySlug: 'travel',
      locationSlug: 'coxs-bazar',
      tagSlugs: ['special-report'],
      status: ArticleStatus.PUBLISHED,
    },
  ];

  const adminUserId = adminUser.id;

  for (const article of articleData) {
    const category = await prisma.category.findUnique({ where: { slug: article.categorySlug } });
    const location = await findSeedLocation(article.locationSlug);

    const tags = [];
    for (const tagSlug of article.tagSlugs) {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (tag) tags.push(tag.id);
    }

    const created = await prisma.article.upsert({
      where: { slug: article.slug },
      update: {},
      create: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        status: article.status,
        authorId: adminUserId,
        categoryId: category?.id || null,
        locationId: location?.id || null,
        // Seeded prose is English; the site's default language (bn) is a separate, per-story choice
        // editors make when they actually write in Bangla (see the multilingual sample articles below).
        languageId: enLanguageId,
        publishedAt: article.status === ArticleStatus.PUBLISHED ? new Date() : null,
        reviewedAt: article.status === ArticleStatus.PUBLISHED ? new Date() : null,
        reviewedById: article.status === ArticleStatus.PUBLISHED ? adminUserId : null,
      },
    });

    for (const tagId of tags) {
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: created.id, tagId } },
        update: {},
        create: { articleId: created.id, tagId },
      });
    }

    console.log(`  ✓ Article: ${article.title}`);
  }

  // ==================== BREAKING & SCHEDULED ARTICLES ====================
  console.log('\n🚨 Seeding breaking and scheduled articles...');

  const breakingArticle = await prisma.article.upsert({
    where: { slug: 'breaking-major-flood-dhaka' },
    update: {},
    create: {
      title: 'Major Flooding Reported in Dhaka City',
      slug: 'breaking-major-flood-dhaka',
      excerpt: 'Heavy monsoon rains have caused severe flooding in multiple areas of Dhaka, displacing thousands of residents.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Flash Floods Hit Capital' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Continuous heavy rainfall over the past 48 hours has led to severe flooding in Dhaka, with several low-lying areas completely submerged. The Dhaka Water Supply and Sewerage Authority has issued emergency warnings for residents in at-risk zones.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Emergency response teams have been deployed across the city, and shelter centers have been opened in schools and community halls. The government has announced emergency relief measures for affected families.',
              },
            ],
          },
        ],
      },
      status: ArticleStatus.PUBLISHED,
      authorId: adminUserId,
      categoryId: (await prisma.category.findUnique({ where: { slug: 'bangladesh' } }))?.id || null,
      locationId: (await findSeedLocation('dhaka'))?.id || null,
      languageId: enLanguageId,
      publishedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: adminUserId,
      isBreaking: true,
      breakingPriority: 1,
      breakingStartedAt: new Date(),
    },
  });

  const scheduledArticle = await prisma.article.upsert({
    where: { slug: 'upcoming-election-preview-2026' },
    update: {},
    create: {
      title: 'Preview: Upcoming National Election 2026',
      slug: 'upcoming-election-preview-2026',
      excerpt: 'A comprehensive preview of the upcoming national elections, including key candidates and issues.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Election Preview' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'As the nation prepares for the upcoming general election, political analysts predict a closely contested race between the major parties. Key issues on the campaign trail include economic development, climate change, and healthcare reform.',
              },
            ],
          },
        ],
      },
      status: ArticleStatus.APPROVED,
      authorId: adminUserId,
      categoryId: (await prisma.category.findUnique({ where: { slug: 'politics' } }))?.id || null,
      locationId: (await findSeedLocation('dhaka'))?.id || null,
      languageId: enLanguageId,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Articles from different districts
  const districtArticles = [
    {
      title: 'Flood Relief Operations Intensify in Sylhet',
      slug: 'flood-relief-operations-sylhet',
      excerpt: 'Relief operations are underway in Sylhet division as floodwaters continue to rise in low-lying areas.',
      categorySlug: 'bangladesh',
      locationSlug: 'sylhet',
      tagSlugs: ['breaking-news', 'live-update'],
    },
    {
      title: 'Cox\'s Bazar Tourism Revenue Hits New Record',
      slug: 'coxs-bazar-tourism-record-2026',
      excerpt: 'Cox\'s Bazar tourism sector reports record revenue this quarter with international visitor numbers surging.',
      categorySlug: 'business',
      locationSlug: 'coxs-bazar',
      tagSlugs: ['analysis', 'special-report'],
    },
    {
      title: 'Chattogram Hill Tracts Development Project Launch',
      slug: 'chattogram-hill-tracts-development',
      excerpt: 'A major development project has been launched to improve infrastructure in the Chattogram Hill Tracts region.',
      categorySlug: 'bangladesh',
      locationSlug: 'chattogram',
      tagSlugs: ['interview'],
    },
    {
      title: 'Rajshahi Mango Festival Celebrates Record Harvest',
      slug: 'rajshahi-mango-festival-record',
      excerpt: 'The annual Rajshahi Mango Festival celebrates a record harvest season with over 200 varieties on display.',
      categorySlug: 'lifestyle',
      locationSlug: 'rajshahi',
      tagSlugs: ['special-report'],
    },
    {
      title: 'Khulna Sundarbans Conservation Effort Shows Results',
      slug: 'khulna-sundarbans-conservation-results',
      excerpt: 'Conservation efforts in the Sundarbans region of Khulna show promising results in protecting the mangrove forest.',
      categorySlug: 'science',
      locationSlug: 'khulna',
      tagSlugs: ['investigation', 'analysis'],
    },
  ];

  for (const article of districtArticles) {
    const category = await prisma.category.findUnique({ where: { slug: article.categorySlug } });
    const location = await findSeedLocation(article.locationSlug);

    const tags: string[] = [];
    for (const tagSlug of article.tagSlugs) {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (tag) tags.push(tag.id);
    }

    const created = await prisma.article.upsert({
      where: { slug: article.slug },
      update: {},
      create: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: article.title }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: article.excerpt }],
            },
          ],
        },
        status: ArticleStatus.PUBLISHED,
        authorId: adminUserId,
        categoryId: category?.id || null,
        locationId: location?.id || null,
        languageId: enLanguageId,
        publishedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: adminUserId,
      },
    });

    for (const tagId of tags) {
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: created.id, tagId } },
        update: {},
        create: { articleId: created.id, tagId },
      });
    }

    console.log(`  ✓ Article: ${article.title}`);
  }

  // Add shared tags to existing articles
  console.log('\n🏷️  Adding shared tags to articles...');
  const sharedTagSlugs = ['breaking-news', 'analysis', 'special-report'];
  const existingArticles = await prisma.article.findMany({
    where: { slug: { in: articleData.map((a) => a.slug) } },
    select: { id: true, slug: true },
  });

  for (const article of existingArticles.slice(0, 3)) {
    for (const tagSlug of sharedTagSlugs) {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (tag) {
        await prisma.articleTag.upsert({
          where: { articleId_tagId: { articleId: article.id, tagId: tag.id } },
          update: {},
          create: { articleId: article.id, tagId: tag.id },
        });
      }
    }
  }

  console.log(`  ✓ Added shared tags to ${Math.min(3, existingArticles.length)} articles`);

  // ==================== MULTILINGUAL SAMPLE ARTICLES ====================
  // Real Bangla-script content, so language switching is visually testable — not just English prose
  // tagged with a Bangla languageId. One pair proves the translation relationship end-to-end
  // (Part 26/27); one Bangla-only article exercises the "missing translation" fallback (Part 15).
  console.log('\n🌐 Seeding multilingual sample articles (বাংলা + English)...');

  const bangladeshCategoryId = (await prisma.category.findUnique({ where: { slug: 'bangladesh' } }))?.id || null;
  const dhakaLocationId = (await findSeedLocation('dhaka'))?.id || null;
  const rajshahiLocationId = (await findSeedLocation('rajshahi'))?.id || null;

  const metroBn = await prisma.article.upsert({
    where: { slug: 'dhaka-metro-notun-station-bn' },
    update: {},
    create: {
      title: 'ঢাকায় নতুন মেট্রোরেল স্টেশন উদ্বোধন',
      slug: 'dhaka-metro-notun-station-bn',
      excerpt: 'রাজধানী ঢাকায় মেট্রোরেলের নতুন স্টেশন চালু হয়েছে, যাত্রীদের যাতায়াত সহজ হবে বলে আশা করা হচ্ছে।',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'নতুন স্টেশন চালু' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'ঢাকা ম্যাস ট্রানজিট কোম্পানি লিমিটেড (ডিএমটিসিএল) আজ থেকে নতুন মেট্রোরেল স্টেশন যাত্রীদের জন্য উন্মুক্ত করেছে। এতে নগরীর যানজট কমবে বলে কর্তৃপক্ষ আশাবাদী।' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'নতুন স্টেশনটি প্রতিদিন হাজার হাজার যাত্রীর যাতায়াতে সহায়ক হবে এবং শহরের গণপরিবহন ব্যবস্থাকে আরও উন্নত করবে।' }] },
        ],
      },
      status: ArticleStatus.PUBLISHED,
      authorId: adminUserId,
      categoryId: bangladeshCategoryId,
      locationId: dhakaLocationId,
      languageId: bnLanguageId,
      publishedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: adminUserId,
    },
  });

  // Idempotent across re-seeds: only create the group the first time this article gets one.
  let metroGroupId = metroBn.translationGroupId;
  if (!metroGroupId) {
    const updated = await prisma.article.update({
      where: { id: metroBn.id },
      data: { translationGroup: { create: {} } },
      select: { translationGroupId: true },
    });
    metroGroupId = updated.translationGroupId;
  }

  const metroEn = await prisma.article.upsert({
    where: { slug: 'dhaka-metro-new-station-en' },
    update: { translationGroupId: metroGroupId },
    create: {
      title: 'New Metro Station Opens in Dhaka',
      slug: 'dhaka-metro-new-station-en',
      excerpt: 'A new metro rail station has opened in the capital Dhaka, expected to ease commuting for thousands of daily passengers.',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New station opens' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'The Dhaka Mass Transit Company Limited (DMTCL) has opened a new metro rail station to passengers today. Authorities expect the addition to ease traffic congestion in the capital.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: "The new station is expected to serve thousands of daily commuters and further strengthen the city's public transit network." }] },
        ],
      },
      status: ArticleStatus.PUBLISHED,
      authorId: adminUserId,
      categoryId: bangladeshCategoryId,
      locationId: dhakaLocationId,
      languageId: enLanguageId,
      translationGroupId: metroGroupId,
      publishedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: adminUserId,
    },
  });
  console.log(`  ✓ Translation pair: "${metroBn.title}" (bn) ↔ "${metroEn.title}" (en)`);

  const lightningBn = await prisma.article.upsert({
    where: { slug: 'rajshahi-bojropate-mrittu-bn' },
    update: {},
    create: {
      title: 'রাজশাহীতে বজ্রপাতে দুইজনের মৃত্যু',
      slug: 'rajshahi-bojropate-mrittu-bn',
      excerpt: 'রাজশাহীর একটি গ্রামে বজ্রপাতে দুই কৃষকের মৃত্যু হয়েছে। স্থানীয় প্রশাসন শোক প্রকাশ করেছে।',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'দুর্ঘটনার বিবরণ' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'রাজশাহীর একটি গ্রামে মাঠে কাজ করার সময় বজ্রপাতে দুই কৃষকের মৃত্যু হয়েছে। স্থানীয় প্রশাসন ক্ষতিগ্রস্ত পরিবারের পাশে দাঁড়ানোর ঘোষণা দিয়েছে।' }] },
        ],
      },
      status: ArticleStatus.PUBLISHED,
      authorId: adminUserId,
      categoryId: bangladeshCategoryId,
      locationId: rajshahiLocationId,
      languageId: bnLanguageId,
      publishedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: adminUserId,
    },
  });
  console.log(`  ✓ Bangla-only article (no translation yet): "${lightningBn.title}"`);
  } // end !systemDataOnly (demo articles)

  // ==================== SUMMARY ====================
  const counts = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.language.count(),
    prisma.location.count(),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.article.count(),
    prisma.articleTag.count(),
    prisma.jobCategory.count(),
    prisma.jobPostingPlan.count(),
    prisma.platformSetting.count(),
  ]);

  console.log('\n✅ Seed completed successfully!');
  console.log(`   Roles: ${counts[0]}`);
  console.log(`   Permissions: ${counts[1]}`);
  console.log(`   Role-Permissions: ${counts[2]}`);
  console.log(`   Languages: ${counts[3]} (bn default, en)`);
  console.log(`   Locations: ${counts[4]} (Bangladesh: 1 country + 8 divisions + 64 districts; global: 3 continents + 4 countries + 1 state + 2 cities)`);
  console.log(`   Categories: ${counts[5]}`);
  console.log(`   Tags: ${counts[6]}`);
  console.log(`   Articles: ${counts[7]} (12 original + 5 district + 1 breaking + 1 scheduled + 1 bn/en pair + 1 bn-only)`);
  console.log(`   Article-Tags: ${counts[8]}`);
  console.log(`   Job categories: ${counts[9]}`);
  console.log(`   Job posting plans: ${counts[10]}`);
  console.log(`   Platform settings: ${counts[11]}`);
  console.log('   Admin user seeded without printing credentials.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
