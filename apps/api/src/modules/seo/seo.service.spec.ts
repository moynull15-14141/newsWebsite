import { Test, TestingModule } from '@nestjs/testing';
import { SeoService } from './seo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';

describe('SeoService (language-aware sitemap)', () => {
  let service: SeoService;
  let prisma: any;
  let languagesService: any;

  beforeEach(async () => {
    prisma = { article: { findMany: jest.fn() } };
    languagesService = { getDefault: jest.fn().mockResolvedValue({ id: 'lang-bn', code: 'bn', isDefault: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoService,
        { provide: PrismaService, useValue: prisma },
        { provide: LanguagesService, useValue: languagesService },
      ],
    }).compile();

    service = module.get<SeoService>(SeoService);
  });

  describe('getSitemap', () => {
    it('keeps the default-language article URL bare', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'bn-story', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01'), language: { code: 'bn' } },
      ]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/article/bn-story</loc>');
      expect(xml).not.toContain('/bn/article/bn-story');
    });

    it('prefixes a non-default-language article URL with its language code', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'en-story', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01'), language: { code: 'en' } },
      ]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/en/article/en-story</loc>');
    });

    it('treats a legacy article with no language as the default language', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'legacy', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01'), language: null },
      ]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/article/legacy</loc>');
    });

    it('always includes the static homepage and Bangladesh URLs', async () => {
      prisma.article.findMany.mockResolvedValueOnce([]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/</loc>');
      expect(xml).toContain('<loc>http://localhost:5173/bangladesh</loc>');
    });
  });

  describe('getNewsSitemap', () => {
    it('reports each article\'s own language, not a hardcoded one', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'en-story', title: 'English story', publishedAt: new Date('2026-01-01'), language: { code: 'en' } },
        { slug: 'bn-story', title: 'বাংলা গল্প', publishedAt: new Date('2026-01-01'), language: { code: 'bn' } },
      ]);
      const xml = await service.getNewsSitemap();
      expect(xml).toContain('<news:language>en</news:language>');
      expect(xml).toContain('<news:language>bn</news:language>');
      expect(xml).toContain('http://localhost:5173/en/article/en-story');
      expect(xml).toContain('http://localhost:5173/article/bn-story');
    });
  });
});
