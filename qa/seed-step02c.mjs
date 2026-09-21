import { PrismaClient } from '@prisma/client';
import { stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const prefix = 'qa-bn-step02c-';
const mediaPrefix = 'media/qa-step02c/';
const localStorageRoot = resolve('apps/api/uploads');

const mediaSpecs = [
  ['library-landscape.png', 1672, 941, 'আলোয় ভরা একটি আধুনিক পাঠাগারের পাঠকক্ষ'],
  ['agriculture-portrait.png', 1086, 1448, 'ধানের চারা ও কৃষিকাজের উপকরণ'],
  ['wetland-square.png', 1254, 1254, 'জলাভূমির পাশে সৌরবিদ্যুৎ ও আবহাওয়া পর্যবেক্ষণ কেন্দ্র'],
  ['riverside-wide.png', 1983, 793, 'নদীর পাশে সবুজ হাঁটার পথ ও বিশ্রামের বেঞ্চ'],
  ['robotics-landscape.png', 1448, 1086, 'শিক্ষার্থীদের রোবটিকস শেখার পরীক্ষামূলক আয়োজন'],
];

const articleSpecs = [
  {
    key: 'library', category: 'education', media: 0,
    title: 'গ্রন্থাগার থেকে ডিজিটাল শ্রেণিকক্ষ: ২০২৬ সালে শিক্ষার্থীদের জ্ঞানচর্চায় নতুন সম্ভাবনার বিস্তার',
    excerpt: 'শহর ও গ্রামের পাঠাগার, প্রশিক্ষণকেন্দ্র এবং অনলাইন শিক্ষাসেবাকে যুক্ত করার একটি নমুনা পরিকল্পনা নিয়ে এই পরীক্ষামূলক প্রতিবেদন।',
  },
  {
    key: 'river-path', category: 'bangladesh', media: 3,
    title: 'নদীতীরের হাঁটার পথ',
    excerpt: 'স্থানীয় উন্নয়ন, সবুজ পরিসর ও নাগরিকদের নিরাপদ চলাচল নিয়ে একটি সংক্ষিপ্ত QA প্রতিবেদন।',
  },
  {
    key: 'robotics', category: 'technology', media: 4,
    title: 'AI ও 5G প্রযুক্তির সঙ্গে শিক্ষার্থীদের রোবটিকস প্রশিক্ষণ',
    excerpt: 'প্রযুক্তিশিক্ষায় কৃত্রিম বুদ্ধিমত্তা, প্রোগ্রামিং এবং হাতে-কলমে যন্ত্র নির্মাণের সমন্বয় পরীক্ষা করা হচ্ছে।',
  },
  {
    key: 'agriculture', category: 'business', media: 1,
    title: 'কৃষকের ক্ষেতে নতুন সেচপ্রযুক্তি',
    excerpt: 'পরিমিত পানি ব্যবহার, বীজ সংরক্ষণ ও কৃষিপণ্যের ন্যায্যমূল্য নিয়ে স্থানীয় উদ্যোগের নমুনা বিশ্লেষণ।',
  },
  {
    key: 'wetland', category: 'bangladesh', media: 2,
    title: 'জলাভূমি রক্ষায় সৌরশক্তি ও আবহাওয়া পর্যবেক্ষণের সমন্বিত উদ্যোগ',
    excerpt: 'পরিবেশ, জীববৈচিত্র্য এবং স্থানীয় জনগোষ্ঠীর অংশগ্রহণ কীভাবে একই পরিকল্পনায় যুক্ত হতে পারে, তার একটি QA উদাহরণ।',
  },
  {
    key: 'culture', category: 'bangladesh',
    title: 'সংস্কৃতির প্রাঙ্গণে শিশুদের চিত্রাঙ্কন, সংগীত ও নাট্যচর্চা',
    excerpt: 'সৃজনশীল শিক্ষার পরিবেশে বাংলা ভাষা, গল্প বলা এবং মঞ্চাভিনয়ের ভূমিকা নিয়ে নমুনা লেখা।',
  },
  {
    key: 'digital-class', category: 'technology',
    title: 'প্রত্যন্ত অঞ্চলের শ্রেণিকক্ষে বাংলা কনটেন্টসহ অফলাইন ডিজিটাল শিক্ষা',
    excerpt: 'ইন্টারনেট সীমিত হলেও শিক্ষক ও শিক্ষার্থীরা কীভাবে মানসম্মত ডিজিটাল উপকরণ ব্যবহার করতে পারেন, তা যাচাইয়ের নমুনা।',
  },
  {
    key: 'sports', category: 'sports',
    title: 'ক্রীড়াঙ্গনে তারুণ্যের অংশগ্রহণ',
    excerpt: 'নিয়মিত অনুশীলন, পুষ্টি ও দলগত শৃঙ্খলা নিয়ে একটি নিরপেক্ষ সম্পাদকীয় QA লেখা।',
  },
  {
    key: 'market', category: 'business',
    title: 'ক্ষুদ্র উদ্যোক্তার বাজার: পণ্য, প্রশিক্ষণ ও ডিজিটাল লেনদেন',
    excerpt: 'স্থানীয় পণ্যের বিপণন এবং নিরাপদ অনলাইন লেনদেনের সুযোগ নিয়ে পরীক্ষামূলক কনটেন্ট।',
  },
  {
    key: 'route', category: 'bangladesh',
    title: 'ঢাকা–চট্টগ্রাম পথে গণপরিবহন ব্যবস্থাপনা: সময়, নিরাপত্তা ও যাত্রীসেবার ১০টি বিবেচ্য বিষয়',
    excerpt: 'দীর্ঘ শিরোনাম, বাংলা সংখ্যা, বিরামচিহ্ন ও যৌগিক অক্ষরের responsive wrapping যাচাইয়ের জন্য প্রস্তুত QA নিবন্ধ।',
  },
];

async function cleanup() {
  const articles = await prisma.article.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } });
  await prisma.homepagePlacement.deleteMany({ where: { articleId: { in: articles.map(({ id }) => id) } } });
  await prisma.article.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.media.deleteMany({ where: { storageKey: { startsWith: mediaPrefix } } });
  for (const [filename] of mediaSpecs) await unlink(resolve(localStorageRoot, mediaPrefix, filename)).catch(() => {});
  console.log(`Removed ${articles.length} Step 02C QA articles and associated QA media.`);
}

async function seed() {
  const author = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!author) throw new Error('An existing author is required');
  const categories = await prisma.category.findMany({ where: { slug: { in: [...new Set(articleSpecs.map(({ category }) => category))] } } });
  const categoryIds = new Map(categories.map(({ slug, id }) => [slug, id]));
  if (categoryIds.size !== new Set(articleSpecs.map(({ category }) => category)).size) throw new Error('Required existing categories are missing');

  const media = [];
  for (const [filename, width, height, altText] of mediaSpecs) {
    const storageKey = `${mediaPrefix}${filename}`;
    const file = await stat(resolve(localStorageRoot, storageKey));
    media.push(await prisma.media.upsert({
      where: { storageKey },
      create: { filename, originalFilename: filename, mimeType: 'image/png', size: file.size, width, height, storageKey, publicUrl: `http://localhost:3001/api/v1/media/files/${storageKey}`, altText, credit: 'AI-generated neutral QA asset', uploadedById: author.id },
      update: { size: file.size, width, height, altText, credit: 'AI-generated neutral QA asset' },
    }));
  }

  const articles = [];
  for (const [index, spec] of articleSpecs.entries()) {
    const slug = `${prefix}${spec.key}`;
    const publishedAt = new Date(Date.now() - index * 45 * 60 * 1000);
    const data = {
      title: spec.title, excerpt: spec.excerpt,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${spec.excerpt} এটি কেবল স্থানীয় UI পরীক্ষার জন্য তৈরি নমুনা কনটেন্ট; বাস্তব সংবাদ নয়।` }] }] },
      status: 'PUBLISHED', noIndex: true, authorId: author.id, categoryId: categoryIds.get(spec.category),
      featuredImageId: spec.media === undefined ? null : media[spec.media].id,
      publishedAt, reviewedAt: publishedAt, reviewedById: author.id, viewCount: 20 - index,
    };
    articles.push(await prisma.article.upsert({ where: { slug }, create: { slug, ...data }, update: data }));
  }

  await prisma.articleView.deleteMany({ where: { articleId: { in: articles.map(({ id }) => id) } } });
  await prisma.articleView.createMany({ data: articles.flatMap((article, index) => Array.from({ length: 10 - index }, (_, view) => ({ articleId: article.id, sessionId: `qa-step02c-${index}-${view}`, viewedAt: new Date() }))) });

  const byKey = new Map(articleSpecs.map((spec, index) => [spec.key, articles[index].id]));
  const sections = [
    ['HERO', 'প্রধান খবর', ['library']],
    ['LATEST', 'সর্বশেষ', articleSpecs.map(({ key }) => key)],
    ['BANGLADESH', 'বাংলাদেশ', ['river-path', 'wetland', 'culture', 'route']],
    ['BUSINESS', 'অর্থনীতি', ['agriculture', 'market']],
    ['SPORTS', 'খেলা', ['sports']],
    ['TECHNOLOGY', 'প্রযুক্তি', ['robotics', 'digital-class']],
  ];
  // Homepage curation lives in two configurations (see HomepageConfiguration): ACTIVE is what the public
  // site reads, DRAFT is the editors' working copy. Local QA seeds both so they start identical.
  for (const status of ['ACTIVE', 'DRAFT']) {
    const configuration = (await prisma.homepageConfiguration.findUnique({ where: { status } })) ?? (await prisma.homepageConfiguration.create({ data: { status } }));
    for (const [sortOrder, [type, title, keys]] of sections.entries()) {
      const key = type.toLowerCase();
      // Step 02 alternates "featured + stack" / "three-up" below the hero.
      const layoutType = sortOrder > 0 && sortOrder % 2 === 0 ? 'THREE_UP' : 'FEATURED_STACK';
      const data = { type, title, enabled: true, sortOrder, maxItems: keys.length, layoutType };
      const section = await prisma.homepageSection.upsert({
        where: { configurationId_key: { configurationId: configuration.id, key } },
        create: { configurationId: configuration.id, key, ...data },
        update: data,
      });
      await prisma.homepagePlacement.deleteMany({ where: { sectionId: section.id } });
      await prisma.homepagePlacement.createMany({ data: keys.map((articleKey, index) => ({ sectionId: section.id, articleId: byKey.get(articleKey), sortOrder: index })) });
    }
  }
  console.log(`Upserted ${articles.length} Bengali QA articles, ${media.length} media records, and ${sections.length} homepage sections.`);
}

try {
  if (process.argv.includes('--cleanup')) await cleanup();
  else await seed();
} finally {
  await prisma.$disconnect();
}
