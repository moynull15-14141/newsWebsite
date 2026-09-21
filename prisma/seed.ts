import { PrismaClient, UserStatus, LocationType, CategoryStatus, TagStatus, ArticleStatus } from '../node_modules/.prisma/client';
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

async function main() {
  console.log('🌱 Starting seed...\n');

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
    { name: 'media.upload', description: 'Upload media files (images, videos)' },
    { name: 'media.manage', description: 'Manage and organize media library' },
    { name: 'user.manage', description: 'Manage user accounts and roles' },
    { name: 'settings.manage', description: 'Manage platform settings' },
    { name: 'analytics.view', description: 'View analytics and reports' },
    { name: 'comment.moderate', description: 'Moderate reader comments' },
    { name: 'comment.delete', description: 'Delete reader comments' },
    { name: 'ad.manage', description: 'Manage advertisements' },
    { name: 'collection.manage', description: 'Manage editorial collections' },
    { name: 'homepage.manage', description: 'Manage homepage editorial sections' },
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
    'Admin': ['article.create', 'article.read', 'article.edit', 'article.review', 'article.publish', 'article.delete', 'media.upload', 'media.manage', 'user.manage', 'analytics.view', 'comment.moderate', 'comment.delete', 'ad.manage', 'collection.manage', 'homepage.manage'],
    'Editor-in-Chief': ['article.create', 'article.read', 'article.edit', 'article.review', 'article.publish', 'media.upload', 'media.manage', 'analytics.view'],
    'Editor': ['article.create', 'article.read', 'article.edit', 'article.review', 'media.upload', 'analytics.view'],
    'Reporter': ['article.create', 'article.read', 'article.edit', 'media.upload'],
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

  // ==================== CATEGORIES ====================
  console.log('\n📂 Seeding categories...');
  const categoryData = [
    { name: 'Bangladesh', slug: 'bangladesh', sortOrder: 1 },
    { name: 'World', slug: 'world', sortOrder: 2 },
    { name: 'Politics', slug: 'politics', sortOrder: 3 },
    { name: 'Business', slug: 'business', sortOrder: 4 },
    { name: 'Economy', slug: 'economy', sortOrder: 5 },
    { name: 'Sports', slug: 'sports', sortOrder: 6 },
    { name: 'Technology', slug: 'technology', sortOrder: 7 },
    { name: 'Entertainment', slug: 'entertainment', sortOrder: 8 },
    { name: 'Education', slug: 'education', sortOrder: 9 },
    { name: 'Health', slug: 'health', sortOrder: 10 },
    { name: 'Crime', slug: 'crime', sortOrder: 11 },
    { name: 'Lifestyle', slug: 'lifestyle', sortOrder: 12 },
    { name: 'Travel', slug: 'travel', sortOrder: 13 },
    { name: 'Science', slug: 'science', sortOrder: 14 },
    { name: 'Religion', slug: 'religion', sortOrder: 15 },
  ];

  for (const cat of categoryData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        slug: cat.slug,
        status: CategoryStatus.ACTIVE,
        sortOrder: cat.sortOrder,
      },
    });
    console.log(`  ✓ Category: ${cat.name}`);
  }

  // ==================== TAGS ====================
  console.log('\n🏷️  Seeding default tags...');
  const defaultTags = [
    { name: 'Breaking News', slug: 'breaking-news' },
    { name: 'Exclusive', slug: 'exclusive' },
    { name: 'Investigation', slug: 'investigation' },
    { name: 'Opinion', slug: 'opinion' },
    { name: 'Analysis', slug: 'analysis' },
    { name: 'Interview', slug: 'interview' },
    { name: 'Live Update', slug: 'live-update' },
    { name: 'Special Report', slug: 'special-report' },
  ];

  for (const tag of defaultTags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: {
        name: tag.name,
        slug: tag.slug,
        status: TagStatus.ACTIVE,
      },
    });
    console.log(`  ✓ Tag: ${tag.name}`);
  }

  // ==================== ADMIN USER ====================
  console.log('\n👤 Creating demo admin user...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const superAdminRoleId = roles['Super Admin'];
  const adminEmail = 'admin@bdnews.com';

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

  // ==================== SUMMARY ====================
  const counts = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.location.count(),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.article.count(),
    prisma.articleTag.count(),
  ]);

  console.log('\n✅ Seed completed successfully!');
  console.log(`   Roles: ${counts[0]}`);
  console.log(`   Permissions: ${counts[1]}`);
  console.log(`   Role-Permissions: ${counts[2]}`);
  console.log(`   Locations: ${counts[3]} (1 country + 8 divisions + 64 districts)`);
  console.log(`   Categories: ${counts[4]}`);
  console.log(`   Tags: ${counts[5]}`);
  console.log(`   Articles: ${counts[6]} (12 original + 5 district + 1 breaking + 1 scheduled)`);
  console.log(`   Article-Tags: ${counts[7]}`);
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
