import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicArticleQueryDto } from './dto/public-query.dto';
import { ArticleViewService } from '../articles/services/article-view.service';
import { TrendingService } from '../articles/services/trending.service';
import { MostReadService } from '../articles/services/most-read.service';
import { BreakingNewsService } from '../articles/services/breaking-news.service';
import { LanguagesService } from '../languages/languages.service';
import { loadConfiguredSections, serializeHomepageSections } from '../homepage/homepage.serializer';
import { resolveSectionArticles } from '../homepage/homepage.section-resolver';
import { ARTICLE_SELECT } from './public-article-select';
import { articleLanguageWhere } from '../../common/i18n/article-language';

const ARTICLE_DETAIL_SELECT = {
  ...ARTICLE_SELECT,
  content: true,
  featuredImageId: true,
  breakingEndsAt: true,
  reviewedBy: { select: { id: true, name: true } },
  corrections: { select: { id: true, description: true, correctedAt: true }, orderBy: { correctedAt: 'desc' as const } },
};

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articleViewService: ArticleViewService,
    private readonly trendingService: TrendingService,
    private readonly mostReadService: MostReadService,
    private readonly breakingNewsService: BreakingNewsService,
    private readonly languagesService: LanguagesService,
  ) {}

  /**
   * Every public article listing goes through here, and every one resolves `?lang=` the same way:
   * an unknown/omitted/disabled code falls back to the platform default rather than 404ing or
   * silently mixing languages. Legacy rows with no `languageId` count as the default language.
   */
  async getArticles(query: PublicArticleQueryDto, extraWhere: any = {}): Promise<{ data: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const { page = 1, limit = 20, search, sort = 'publishedAt', order = 'desc', lang } = query;
    const skip = (page - 1) * limit;
    const language = await this.languagesService.resolveRequested(lang);

    const where: any = {
      status: 'PUBLISHED',
      ...extraWhere,
      AND: [articleLanguageWhere(language), ...(extraWhere.AND ?? [])],
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = { [sort]: order };

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: ARTICLE_SELECT,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Slug lookup is language-agnostic on purpose: each language version of a story has its OWN slug, so
   * the slug alone already picks the language. `translations` lists the PUBLISHED sibling versions (in
   * other languages) so the reader can switch, and SEO can emit hreflang — draft siblings are never
   * exposed publicly.
   */
  async getArticleBySlug(slug: string): Promise<any> {
    const article = await this.prisma.article.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: ARTICLE_DETAIL_SELECT,
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const translations = article.translationGroupId
      ? await this.prisma.article.findMany({
          where: { translationGroupId: article.translationGroupId, status: 'PUBLISHED', id: { not: article.id } },
          select: { slug: true, title: true, language: { select: { code: true, name: true, nativeName: true } } },
        })
      : [];

    return { ...article, translations };
  }

  async getArticlesByCategory(categorySlug: string, query: PublicArticleQueryDto): Promise<{ data: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) throw new NotFoundException('Category not found');

    return this.getArticles(query, { categoryId: category.id });
  }

  async getArticlesByTag(tagSlug: string, query: PublicArticleQueryDto) {
    const tag = await this.prisma.tag.findUnique({ where: { slug: tagSlug } });
    if (!tag) throw new NotFoundException('Tag not found');

    return this.getArticles(query, {
      articleTags: { some: { tagId: tag.id } },
    });
  }

  async getArticlesByAuthor(authorId: string, query: PublicArticleQueryDto) {
    const author = await this.prisma.user.findUnique({ where: { id: authorId } });
    if (!author) throw new NotFoundException('Author not found');

    return this.getArticles(query, { authorId });
  }

  async getArticlesByLocation(locationSlug: string, query: PublicArticleQueryDto, locationType?: string) {
    const location = await this.prisma.location.findFirst({ where: { slug: locationSlug, ...(locationType ? { type: locationType as any } : {}) } });
    if (!location) throw new NotFoundException('Location not found');

    const childLocations = await this.prisma.location.findMany({
      where: { parentId: location.id },
      select: { id: true },
    });
    const locationIds = [location.id, ...childLocations.map((l) => l.id)];

    return this.getArticles(query, {
      locationId: { in: locationIds },
    });
  }

  async search(query: PublicArticleQueryDto) {
    const { category, division, district, dateFrom, dateTo, ...rest } = query;
    const extraWhere: any = {};

    if (category) {
      const cat = await this.prisma.category.findUnique({ where: { slug: category } });
      if (cat) extraWhere.categoryId = cat.id;
    }

    if (district) {
      const loc = await this.prisma.location.findFirst({ where: { slug: district, type: 'DISTRICT' } });
      if (loc) extraWhere.locationId = loc.id;
    } else if (division) {
      const loc = await this.prisma.location.findFirst({ where: { slug: division, type: 'DIVISION' } });
      if (loc) {
        const childLocations = await this.prisma.location.findMany({
          where: { parentId: loc.id },
          select: { id: true },
        });
        extraWhere.locationId = { in: [loc.id, ...childLocations.map((l) => l.id)] };
      }
    }

    if (dateFrom || dateTo) {
      extraWhere.publishedAt = {};
      if (dateFrom) extraWhere.publishedAt.gte = new Date(dateFrom);
      if (dateTo) extraWhere.publishedAt.lte = new Date(dateTo);
    }

    return this.getArticles(rest, extraWhere);
  }

  async getBreakingNews(limit = 5, langCode?: string) {
    const language = await this.languagesService.resolveRequested(langCode);
    return this.breakingNewsService.getActiveBreakingNews(limit, language);
  }

  async trackView(articleSlug: string, fingerprint?: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug: articleSlug, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    return this.articleViewService.recordView(article.id, undefined, fingerprint);
  }

  async getMostRead(options: { limit?: number; window?: 'today' | '24h' | '7d'; lang?: string } = {}) {
    const language = await this.languagesService.resolveRequested(options.lang);
    return this.mostReadService.getMostRead({ ...options, language });
  }

  async getTrending(options: { limit?: number; locationSlug?: string; lang?: string } = {}) {
    const language = await this.languagesService.resolveRequested(options.lang);
    return this.trendingService.getTrending({ ...options, language });
  }

  /** Related stories stay in the same language as the article being read — a reader of the English
   * story should never be offered Bangla-only "related" links they cannot read. */
  async getRelatedArticles(articleId: string, categoryId?: string, tagIds?: string[], locationId?: string, languageId?: string | null) {
    const where: any = {
      status: 'PUBLISHED',
      id: { not: articleId },
      OR: [],
    };
    if (languageId !== undefined) where.languageId = languageId;

    if (categoryId) {
      where.OR.push({ categoryId });
    }
    if (tagIds?.length) {
      where.OR.push({ articleTags: { some: { tagId: { in: tagIds } } } });
    }
    if (locationId) {
      where.OR.push({ locationId });
    }

    if (where.OR.length === 0) {
      where.OR.push({ status: 'PUBLISHED' });
    }

    return this.prisma.article.findMany({
      where,
      take: 5,
      orderBy: { publishedAt: 'desc' },
      select: ARTICLE_SELECT,
    });
  }

  /**
   * Public homepage. Reads ONLY the ACTIVE configuration — never the editable draft. Editors' draft
   * edits are invisible here until HomepageService.publish() atomically replaces the ACTIVE sections.
   */
  async getHomepageData(langCode?: string) {
    const language = await this.languagesService.resolveRequested(langCode);
    const { sections } = await loadConfiguredSections(this.prisma, 'ACTIVE');
    return this.buildHomepage(sections, new Date(), language);
  }

  /**
   * Shared composition used by the public endpoint and the admin draft preview so both return the same
   * contract. `configuredSections` is a loaded configuration (see loadConfiguredSections); when it has
   * no enabled sections the dynamic latest/category fallback is returned instead.
   *
   * Every section's stories — editor-picked placements and automatic category/tag/location/latest
   * sources alike — are resolved in one centralized pass before serialization, so the public homepage
   * and the admin draft preview always agree and no section fetches its own content. `language` decides
   * which article variant each section (and the fallback path) shows; trending, most-read and breaking
   * news stay algorithmic but are filtered to the same language.
   */
  async buildHomepage(configuredSections: any[], now: Date = new Date(), language?: { id: string; code: string; isDefault: boolean }) {
    const resolvedLanguage = language ?? (await this.languagesService.getDefault());

    if (configuredSections.length) {
      const resolved = await resolveSectionArticles(this.prisma, configuredSections, now, resolvedLanguage);
      const { hero, latest, sections, sectionList } = serializeHomepageSections(configuredSections, resolved, now, resolvedLanguage.code);
      const [breakingNews, trending, mostRead] = await Promise.all([
        this.breakingNewsService.getActiveBreakingNews(5, resolvedLanguage),
        this.trendingService.getTrending({ limit: 6, language: resolvedLanguage }),
        this.mostReadService.getMostRead({ limit: 6, window: '24h', language: resolvedLanguage }),
      ]);
      return { hero, breakingNews, latest, trending, mostRead, sections, sectionList };
    }

    const langQuery = { lang: resolvedLanguage.code };
    const [
      hero,
      latest,
      breakingNews,
      trending,
      mostRead,
      bangladesh,
      world,
      politics,
      business,
      sports,
      technology,
      entertainment,
    ] = await Promise.all([
      this.prisma.article.findFirst({
        where: { status: 'PUBLISHED', ...articleLanguageWhere(resolvedLanguage) },
        orderBy: { publishedAt: 'desc' },
        select: ARTICLE_SELECT,
      }),
      this.prisma.article.findMany({
        where: { status: 'PUBLISHED', ...articleLanguageWhere(resolvedLanguage) },
        take: 10,
        orderBy: { publishedAt: 'desc' },
        select: ARTICLE_SELECT,
      }),
      this.breakingNewsService.getActiveBreakingNews(5, resolvedLanguage),
      this.trendingService.getTrending({ limit: 6, language: resolvedLanguage }),
      this.mostReadService.getMostRead({ limit: 6, window: '24h', language: resolvedLanguage }),
      this.getArticlesByCategory('bangladesh', { limit: 6, ...langQuery } as PublicArticleQueryDto),
      this.getArticlesByCategory('world', { limit: 6, ...langQuery } as PublicArticleQueryDto),
      this.getArticlesByCategory('politics', { limit: 6, ...langQuery } as PublicArticleQueryDto),
      this.getArticlesByCategory('business', { limit: 6, ...langQuery } as PublicArticleQueryDto),
      this.getArticlesByCategory('sports', { limit: 6, ...langQuery } as PublicArticleQueryDto),
      this.getArticlesByCategory('technology', { limit: 6, ...langQuery } as PublicArticleQueryDto),
      this.getArticlesByCategory('entertainment', { limit: 6, ...langQuery } as PublicArticleQueryDto),
    ]);

    return {
      hero,
      breakingNews,
      latest,
      trending,
      mostRead,
      sections: {
        bangladesh: bangladesh.data,
        world: world.data,
        politics: politics.data,
        business: business.data,
        sports: sports.data,
        technology: technology.data,
        entertainment: entertainment.data,
      },
    };
  }
}
