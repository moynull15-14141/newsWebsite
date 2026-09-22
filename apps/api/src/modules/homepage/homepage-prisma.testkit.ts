/* eslint-disable @typescript-eslint/no-explicit-any */
import { ineligibleReason } from '../articles/public-eligibility';

/**
 * Stateful in-memory stand-in for the slice of PrismaClient used by HomepageService, the homepage
 * serializer and PublicService.getHomepageData. It models exactly what the homepage safety rules rely on:
 *   - unique configuration status, unique (configurationId, key), cascade deletes;
 *   - $transaction with rollback: if the callback throws, ALL writes made inside it are undone;
 *   - failure injection (`failOn`) to prove a mid-publish crash leaves the live homepage untouched;
 *   - nested placement filtering by public eligibility (like the real query), which can be switched off
 *     (`ignoreNestedWhere`) to simulate an article that became ineligible after the query filter ran.
 */

export interface FakeArticle {
  id: string;
  title?: string;
  slug?: string;
  status: string;
  publishedAt?: Date | null;
  categoryId?: string | null;
  locationId?: string | null;
  /** Tags the article carries, used by TAG-sourced section resolution. */
  tagIds?: string[];
  languageId?: string | null;
  translationGroupId?: string | null;
  language?: { id: string; code: string } | null;
  [key: string]: unknown;
}

interface State {
  configurations: any[];
  sections: any[];
  placements: any[];
  articles: FakeArticle[];
  categories: any[];
  locations: any[];
  tags: any[];
}

/**
 * Minimal LanguagesService double: PublicService only ever calls resolveRequested/getDefault. Plain
 * async functions (not jest.fn()) so this plain helper file — not itself a *.spec.ts — never depends on
 * jest's ambient types being resolvable outside the test runner.
 */
export function fakeLanguagesService(code = 'bn') {
  const language = { id: `lang-${code}`, code, isDefault: true };
  return { resolveRequested: async () => language, getDefault: async () => language };
}

export class FakeHomepagePrisma {
  state: State = { configurations: [], sections: [], placements: [], articles: [], categories: [], locations: [], tags: [] };
  ignoreNestedWhere = false;
  transactionsStarted = 0;
  isolationLevels: Array<string | undefined> = [];
  private failures = new Map<string, number>();
  private calls = new Map<string, number>();
  private idSeq = 0;

  /** Throw on the (afterCalls+1)-th call of `operation` (e.g. 'homepageSection.create'). */
  failOn(operation: string, afterCalls = 0) {
    this.failures.set(operation, afterCalls);
    this.calls.set(operation, 0);
  }

  private hit(operation: string) {
    const threshold = this.failures.get(operation);
    if (threshold === undefined) return;
    const seen = this.calls.get(operation) ?? 0;
    this.calls.set(operation, seen + 1);
    if (seen >= threshold) throw new Error(`injected failure: ${operation}`);
  }

  private nextId(prefix: string) {
    this.idSeq += 1;
    return `${prefix}-${this.idSeq}`;
  }

  // ------------------------------------------------------------ seeding helpers
  seedConfigurations(options: { active?: boolean; draft?: boolean } = { active: true, draft: true }) {
    if (options.active) this.state.configurations.push(this.newConfiguration('ACTIVE', 'cfg-active'));
    if (options.draft) this.state.configurations.push(this.newConfiguration('DRAFT', 'cfg-draft'));
  }

  seedArticle(article: FakeArticle) {
    this.state.articles.push({ title: article.id, slug: article.id, publishedAt: new Date('2026-01-01T00:00:00Z'), ...article });
    return article.id;
  }

  seedSection(configurationId: string, section: Partial<any> & { key: string; type: string; articleIds?: string[] }) {
    const { articleIds = [], ...rest } = section;
    const row = {
      id: this.nextId('sec'),
      configurationId,
      title: rest.key,
      enabled: true,
      sortOrder: this.state.sections.filter((s) => s.configurationId === configurationId).length,
      sourceType: 'MANUAL',
      categoryId: null,
      locationId: null,
      tagId: null,
      maxItems: 4,
      layoutType: 'FEATURED_STACK',
      cardVariant: 'AUTO',
      updatedAt: new Date(),
      ...rest,
    };
    this.state.sections.push(row);
    articleIds.forEach((articleId, index) => this.state.placements.push({ sectionId: row.id, articleId, sortOrder: index }));
    return row;
  }

  configuration(status: 'ACTIVE' | 'DRAFT') {
    return this.state.configurations.find((c) => c.status === status);
  }

  /** Plain-data snapshot of a configuration (keys, order, articles) for equality assertions. */
  snapshot(status: 'ACTIVE' | 'DRAFT') {
    const configuration = this.configuration(status);
    if (!configuration) return null;
    return this.state.sections
      .filter((s) => s.configurationId === configuration.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map((s) => ({
        key: s.key,
        type: s.type,
        title: s.title,
        enabled: s.enabled,
        sortOrder: s.sortOrder,
        maxItems: s.maxItems,
        layoutType: s.layoutType,
        cardVariant: s.cardVariant,
        sourceType: s.sourceType,
        categoryId: s.categoryId,
        locationId: s.locationId,
        tagId: s.tagId,
        articleIds: this.state.placements
          .filter((p) => p.sectionId === s.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => p.articleId),
      }));
  }

  private newConfiguration(status: string, id = this.nextId('cfg')) {
    return { id, status, version: 1, publishedAt: null, createdAt: new Date(), updatedAt: new Date() };
  }

  // ------------------------------------------------------------- Prisma surface
  $transaction = async (fn: (tx: any) => Promise<any>, options?: { isolationLevel?: string }) => {
    this.transactionsStarted += 1;
    this.isolationLevels.push(options?.isolationLevel);
    const before = structuredClone(this.state);
    try {
      return await fn(this);
    } catch (error) {
      this.state = before; // rollback everything written inside the transaction
      throw error;
    }
  };

  homepageConfiguration = {
    findUnique: async ({ where }: any) => this.pick(this.state.configurations.find((c) => this.matches(c, where))),
    findUniqueOrThrow: async ({ where }: any) => {
      const found = this.state.configurations.find((c) => this.matches(c, where));
      if (!found) throw new Error('not found');
      return { ...found };
    },
    create: async ({ data }: any) => {
      this.hit('homepageConfiguration.create');
      if (this.state.configurations.some((c) => c.status === data.status)) throw new Error('unique constraint: status');
      const row = this.newConfiguration(data.status);
      this.state.configurations.push(row);
      return { ...row };
    },
    update: async ({ where, data }: any) => {
      this.hit('homepageConfiguration.update');
      const row = this.state.configurations.find((c) => this.matches(c, where));
      this.applyConfigurationData(row, data);
      return { ...row };
    },
    updateMany: async ({ where, data }: any) => {
      const rows = this.state.configurations.filter((c) => this.matches(c, where));
      rows.forEach((row) => this.applyConfigurationData(row, data));
      return { count: rows.length };
    },
  };

  homepageSection = {
    findMany: async (args: any) => this.sectionsFor(args).map((section) => this.hydrateSection(section, args)),
    findFirst: async (args: any) => {
      const found = this.sectionsFor(args)[0];
      return found ? this.hydrateSection(found, args) : null;
    },
    create: async ({ data }: any) => {
      this.hit('homepageSection.create');
      if (this.state.sections.some((s) => s.configurationId === data.configurationId && s.key === data.key)) {
        throw new Error('unique constraint: configurationId+key');
      }
      const { placements, ...scalars } = data;
      const row = {
        id: this.nextId('sec'),
        enabled: true,
        sortOrder: 0,
        sourceType: 'MANUAL',
        categoryId: null,
        locationId: null,
        tagId: null,
        maxItems: 4,
        layoutType: 'FEATURED_STACK',
        cardVariant: 'AUTO',
        updatedAt: new Date(),
        ...scalars,
      };
      this.state.sections.push(row);
      for (const placement of placements?.create ?? []) this.state.placements.push({ sectionId: row.id, ...placement });
      return { ...row };
    },
    update: async ({ where, data }: any) => {
      this.hit('homepageSection.update');
      const row = this.state.sections.find((s) => s.id === where.id);
      if (!row) throw new Error('section not found');
      const { category, location, tag, ...scalars } = data;
      Object.assign(row, scalars, { updatedAt: new Date() });
      if (category) row.categoryId = category.connect ? category.connect.id : null;
      if (location) row.locationId = location.connect ? location.connect.id : null;
      if (tag) row.tagId = tag.connect ? tag.connect.id : null;
      return { ...row };
    },
    delete: async ({ where }: any) => {
      this.removeSections((s) => s.id === where.id);
    },
    deleteMany: async ({ where }: any) => {
      this.removeSections((s) => s.configurationId === where.configurationId);
    },
  };

  homepagePlacement = {
    count: async ({ where }: any) => this.state.placements.filter((p) => p.sectionId === where.sectionId).length,
    deleteMany: async ({ where }: any) => {
      this.hit('homepagePlacement.deleteMany');
      this.state.placements = this.state.placements.filter((p) => p.sectionId !== where.sectionId);
    },
    createMany: async ({ data }: any) => {
      this.hit('homepagePlacement.createMany');
      this.state.placements.push(...data.map((row: any) => ({ ...row })));
    },
  };

  /**
   * Supports the subset of article queries the homepage uses: placement hydration (`id.in`) and the
   * automatic source filters produced by `resolveSectionArticles` (status + publishedAt eligibility,
   * category, tag, location family), plus ordering by publishedAt and `take`.
   */
  article = {
    findMany: async ({ where, orderBy, take }: any = {}) => {
      let rows = this.state.articles.filter((a) => this.articleMatches(a, where));
      const orders: any[] = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
      if (orders.length) {
        rows = [...rows].sort((a, b) => {
          for (const order of orders) {
            const [field, raw] = Object.entries<any>(order)[0];
            const direction = raw && typeof raw === 'object' ? raw.sort : raw;
            const left = a[field] ? new Date(a[field] as any).getTime() : 0;
            const right = b[field] ? new Date(b[field] as any).getTime() : 0;
            const cmp = left < right ? -1 : left > right ? 1 : 0;
            if (cmp) return direction === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
      }
      return (take ? rows.slice(0, take) : rows).map((a) => ({ ...a }));
    },
  };
  category = { findUnique: async ({ where }: any) => this.state.categories.find((c) => c.id === where.id) ?? null };
  location = {
    findUnique: async ({ where }: any) => this.state.locations.find((l) => l.id === where.id) ?? null,
    findMany: async ({ where }: any = {}) =>
      this.state.locations
        .filter((l) => (where?.parentId?.in ? where.parentId.in.includes(l.parentId) : true))
        .map((l) => ({ ...l })),
  };
  tag = { findUnique: async ({ where }: any) => this.state.tags.find((t) => t.id === where.id) ?? null };

  /**
   * Recursive so it can evaluate `where.AND` (a list of sub-clauses, each ANDed in) the same way real
   * Prisma does — needed because the language filter is deliberately nested inside its own `AND` entry
   * in production code (see homepage.section-resolver.ts / public.service.ts), to avoid a plain object
   * spread silently overwriting an existing top-level `OR` (e.g. the publishedAt eligibility clause).
   */
  private articleMatches(article: FakeArticle, where: any): boolean {
    if (!where) return true;
    if (where.id?.in && !where.id.in.includes(article.id)) return false;
    if (where.status && article.status !== where.status) return false;
    if (where.categoryId && article.categoryId !== where.categoryId) return false;
    if (where.locationId?.in && !where.locationId.in.includes(article.locationId as any)) return false;
    if (where.languageId !== undefined && (article.languageId ?? null) !== where.languageId) return false;
    if (where.articleTags?.some?.tagId && !(article.tagIds ?? []).includes(where.articleTags.some.tagId)) return false;
    if (Array.isArray(where.AND) && !where.AND.every((clause: any) => this.articleMatches(article, clause))) return false;
    if (Array.isArray(where.OR) && !where.OR.some((clause: any) => this.matchesOrClause(article, clause))) return false;
    return true;
  }

  /** One arm of a top-level `OR` array: either publicArticleWhere()'s publishedAt pair or articleLanguageWhere()'s languageId pair. */
  private matchesOrClause(article: FakeArticle, clause: any): boolean {
    if ('publishedAt' in clause) {
      const published = article.publishedAt ? new Date(article.publishedAt).getTime() : null;
      if (clause.publishedAt === null) return published === null;
      if (clause.publishedAt?.lte) return published !== null && published <= new Date(clause.publishedAt.lte).getTime();
      return false;
    }
    if ('languageId' in clause) {
      return (article.languageId ?? null) === clause.languageId;
    }
    return false;
  }

  // ------------------------------------------------------------------ internals
  private matches(row: any, where: any) {
    return Object.entries(where).every(([key, value]) => row[key] === value);
  }

  private pick(row: any) {
    return row ? { ...row } : null;
  }

  private applyConfigurationData(row: any, data: any) {
    for (const [key, value] of Object.entries<any>(data)) {
      if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
      else row[key] = value;
    }
    row.updatedAt = new Date();
  }

  private removeSections(predicate: (section: any) => boolean) {
    const removed = new Set(this.state.sections.filter(predicate).map((s) => s.id));
    this.state.sections = this.state.sections.filter((s) => !removed.has(s.id));
    this.state.placements = this.state.placements.filter((p) => !removed.has(p.sectionId)); // ON DELETE CASCADE
  }

  private sectionsFor({ where = {}, orderBy }: any) {
    let rows = this.state.sections.filter((s) => Object.entries<any>(where).every(([key, value]) => s[key] === value));
    const orders: any[] = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    rows = [...rows].sort((a, b) => {
      for (const order of orders) {
        const [field, direction] = Object.entries<any>(order)[0];
        const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
        if (cmp) return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
    return rows;
  }

  private hydrateSection(section: any, { include, select }: any) {
    if (select) {
      return Object.fromEntries(Object.entries<any>(select).filter(([, on]) => on).map(([key]) => [key, section[key]]));
    }
    const result: any = { ...section };
    if (include?.category) result.category = this.state.categories.find((c) => c.id === section.categoryId) ?? null;
    if (include?.tag) result.tag = this.state.tags.find((t) => t.id === section.tagId) ?? null;
    if (include?.location) result.location = this.state.locations.find((l) => l.id === section.locationId) ?? null;
    if (include?.placements) {
      const { where, orderBy, take } = include.placements;
      let rows = this.state.placements.filter((p) => p.sectionId === section.id).sort((a, b) => a.sortOrder - b.sortOrder);
      if (orderBy?.sortOrder === 'desc') rows = rows.reverse();
      rows = rows.map((p) => ({ ...p, article: { ...this.state.articles.find((a) => a.id === p.articleId) } }));
      if (where?.article && !this.ignoreNestedWhere) rows = rows.filter((p) => ineligibleReason(p.article) === null);
      result.placements = take ? rows.slice(0, take) : rows;
    }
    return result;
  }
}
