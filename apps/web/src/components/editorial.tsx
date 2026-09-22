import { Link } from 'react-router-dom';
import { Play, ArrowRight } from 'lucide-react';
import { ImagePlaceholder } from './ImagePlaceholder';
import ArticleCard, { type ArticleCardVariant } from './ArticleCard';
import { contentLanguage } from '@/lib/content-language';
import { useLanguage } from '@/lib/i18n';
import { formatLocalizedShortDate } from '@/lib/format-date';

export interface EditorialArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  viewCount?: number;
  author?: { id: string; name: string } | null;
  category?: { id: string; name: string; slug: string } | null;
  imageUrl?: string;
  featuredImageUrl?: string;
  media?: { id: string; publicUrl: string } | null;
}

function articleImage(article: EditorialArticle) {
  return article.featuredImageUrl || article.imageUrl || article.media?.publicUrl;
}

function StoryImage({ article, className, priority = false }: { article: EditorialArticle; className: string; priority?: boolean }) {
  const src = articleImage(article);
  return src ? (
    <img src={src} alt={article.title} className={className} loading={priority ? 'eager' : 'lazy'} />
  ) : (
    <ImagePlaceholder className={className} aspect="16/9" />
  );
}

function StoryMeta({ article }: { article: EditorialArticle }) {
  const { code } = useLanguage();
  if (!article.author && !article.publishedAt) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      {article.author?.name && <span>{article.author.name}</span>}
      {article.author && article.publishedAt && <span aria-hidden="true">&middot;</span>}
      {article.publishedAt && <time dateTime={article.publishedAt}>{formatLocalizedShortDate(article.publishedAt, code)}</time>}
    </p>
  );
}

function useArticleHref(slug: string) {
  const { code, pathFor } = useLanguage();
  return pathFor(`/article/${slug}`, code);
}

export function LeadStory({ article }: { article: EditorialArticle }) {
  const href = useArticleHref(article.slug);
  return (
    <article className="min-w-0">
      <Link to={href} className="group block">
        <StoryImage article={article} priority className="aspect-video w-full object-cover" />
        <div className="pt-4">
          {article.category && <span className="text-xs font-bold uppercase text-primary-600">{article.category.name}</span>}
          <h2 lang={contentLanguage(article.title)} className="mt-1 text-2xl font-bold leading-[1.3] text-neutral-950 group-hover:text-primary-600 sm:text-3xl lg:text-[2.15rem]">
            {article.title}
          </h2>
          {article.excerpt && <p lang={contentLanguage(article.excerpt)} className="mt-3 line-clamp-3 text-base leading-7 text-neutral-600">{article.excerpt}</p>}
          <StoryMeta article={article} />
        </div>
      </Link>
    </article>
  );
}

export function StandardStory({ article, media = true }: { article: EditorialArticle; media?: boolean }) {
  const href = useArticleHref(article.slug);
  return (
    <article className="min-w-0">
      <Link to={href} className="group block">
        {media && <StoryImage article={article} className="aspect-video w-full object-cover" />}
        <h3 lang={contentLanguage(article.title)} className={`${media ? 'mt-3' : ''} text-lg font-bold leading-[1.4] text-neutral-900 group-hover:text-primary-600`}>
          {article.title}
        </h3>
        <StoryMeta article={article} />
      </Link>
    </article>
  );
}

export function StoryRow({ article, compact = false }: { article: EditorialArticle; compact?: boolean }) {
  const href = useArticleHref(article.slug);
  return (
    <article className="min-w-0 border-b border-neutral-200 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <Link to={href} className="group grid grid-cols-[minmax(0,1fr)_6.5rem] gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="min-w-0">
          {article.category && !compact && <span className="text-xs font-semibold text-primary-600">{article.category.name}</span>}
          <h3 lang={contentLanguage(article.title)} className={`${compact ? 'text-base' : 'text-lg'} font-bold leading-[1.4] text-neutral-900 group-hover:text-primary-600`}>{article.title}</h3>
          {!compact && article.excerpt && <p lang={contentLanguage(article.excerpt)} className="mt-2 hidden line-clamp-2 text-sm leading-6 text-neutral-600 sm:block">{article.excerpt}</p>}
          <StoryMeta article={article} />
        </div>
        <StoryImage article={article} className="aspect-[4/3] w-full object-cover" />
      </Link>
    </article>
  );
}

export function BriefList({ title, articles }: { title: string; articles: EditorialArticle[] }) {
  const { code, pathFor } = useLanguage();
  if (!articles.length) return null;
  return (
    <aside aria-label={title} className="min-w-0">
      <h2 className="border-t-4 border-neutral-900 py-3 text-lg font-bold text-neutral-950">{title}</h2>
      <div>
        {articles.map((article) => (
          <article key={article.id} className="border-t border-neutral-200 py-3">
            <Link to={pathFor(`/article/${article.slug}`, code)} className="group block">
              <h3 lang={contentLanguage(article.title)} className="text-[0.95rem] font-semibold leading-[1.45] text-neutral-900 group-hover:text-primary-600">{article.title}</h3>
              {article.publishedAt && <time className="mt-1 block text-xs text-neutral-500" dateTime={article.publishedAt}>{formatLocalizedShortDate(article.publishedAt, code)}</time>}
            </Link>
          </article>
        ))}
      </div>
    </aside>
  );
}

export function RankedList({ title, articles }: { title: string; articles: EditorialArticle[] }) {
  const { code, pathFor } = useLanguage();
  if (!articles.length) return null;
  return (
    <aside aria-label={title} className="border-t-4 border-primary-600">
      <h2 className="border-b border-neutral-300 py-3 text-xl font-bold text-neutral-950">{title}</h2>
      <ol>
        {articles.map((article, index) => (
          <li key={article.id} className="grid grid-cols-[2.25rem_1fr] gap-3 border-b border-neutral-200 py-4 last:border-b-0">
            <span className="text-2xl font-bold leading-none text-neutral-300" aria-hidden="true">{index + 1}</span>
            <Link lang={contentLanguage(article.title)} to={pathFor(`/article/${article.slug}`, code)} className="text-sm font-bold leading-[1.45] text-neutral-900 hover:text-primary-600">{article.title}</Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function MediaStory({ article }: { article: EditorialArticle }) {
  const href = useArticleHref(article.slug);
  return (
    <article className="min-w-0 bg-neutral-900 text-white">
      <Link to={href} className="group block">
        <div className="relative">
          <StoryImage article={article} className="aspect-video w-full object-cover opacity-90" />
          <span className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-950" aria-hidden="true"><Play className="h-5 w-5 fill-current" /></span>
        </div>
        <h3 lang={contentLanguage(article.title)} className="p-4 text-lg font-bold leading-[1.4] group-hover:text-primary-200">{article.title}</h3>
      </Link>
    </article>
  );
}

/**
 * Validated homepage layout presets (mirrors HOMEPAGE_LAYOUT_PRESETS in the API). Every preset listed
 * here is rendered by SectionBody below — do not add one on the API before implementing it here.
 */
export type HomepageLayoutPreset =
  | 'FEATURED_STACK'
  | 'TWO_UP'
  | 'THREE_UP'
  | 'FOUR_UP'
  | 'GRID'
  | 'COMPACT_LIST'
  | 'HORIZONTAL_LIST'
  | 'IMAGE_LED'
  | 'TEXT_LED';

/** Presentation override from the admin. 'AUTO' lets the layout choose its own NewsCard variant. */
export type HomepageCardVariant = 'AUTO' | ArticleCardVariant;

/**
 * Column tracks per layout. Every one starts single-column and only adds tracks at a breakpoint, so a
 * multi-column desktop section becomes a readable vertical stack on mobile rather than a squeezed grid.
 */
const COLUMN_CLASS: Partial<Record<HomepageLayoutPreset, string>> = {
  TWO_UP: 'grid gap-6 sm:grid-cols-2',
  THREE_UP: 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
  FOUR_UP: 'grid gap-6 sm:grid-cols-2 lg:grid-cols-4',
  GRID: 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
};

/** How many stories a fixed-column layout can show; other layouts show everything they are given. */
const COLUMN_CAP: Partial<Record<HomepageLayoutPreset, number>> = { TWO_UP: 2, THREE_UP: 3, FOUR_UP: 4 };

/**
 * Body of a homepage section.
 *
 * `layout` picks the composition; `cardVariant` optionally forces which NewsCard variant renders each
 * story, in which case the layout only supplies the container. A single remaining story always renders
 * as one row so a section never looks broken when its other stories became ineligible.
 */
export function SectionBody({
  articles,
  layout,
  cardVariant = 'AUTO',
}: {
  articles: EditorialArticle[];
  layout: HomepageLayoutPreset;
  cardVariant?: HomepageCardVariant;
}) {
  const [lead, ...rest] = articles;
  if (!lead) return null;

  // Explicit card presentation chosen in the admin: reuse the existing NewsCard variants as-is.
  if (cardVariant !== 'AUTO') {
    const cap = COLUMN_CAP[layout];
    const shown = cap ? articles.slice(0, cap) : articles;
    const columns = COLUMN_CLASS[layout];
    return (
      <div className={columns ?? 'grid gap-6'}>
        {shown.map((article) => <ArticleCard key={article.id} article={article} variant={cardVariant} />)}
      </div>
    );
  }

  if (articles.length === 1) return <StoryRow article={lead} />;

  switch (layout) {
    case 'COMPACT_LIST':
      return <div>{articles.map((article) => <StoryRow key={article.id} article={article} compact />)}</div>;

    case 'HORIZONTAL_LIST':
      return (
        <div className="grid gap-5 divide-y divide-neutral-200 [&>*:not(:first-child)]:pt-5">
          {articles.map((article) => <ArticleCard key={article.id} article={article} variant="horizontal" />)}
        </div>
      );

    case 'TEXT_LED':
      // Headline-led section: no imagery competes with the type.
      return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => <StandardStory key={article.id} article={article} media={false} />)}
        </div>
      );

    case 'IMAGE_LED':
      return (
        <div className="grid gap-7">
          <LeadStory article={lead} />
          {rest.length > 0 && (
            <div className={COLUMN_CLASS.GRID}>
              {rest.map((article) => <ArticleCard key={article.id} article={article} variant="image-top" />)}
            </div>
          )}
        </div>
      );

    case 'GRID':
      return (
        <div className={COLUMN_CLASS.GRID}>
          {articles.map((article) => <ArticleCard key={article.id} article={article} variant="image-top" />)}
        </div>
      );

    case 'TWO_UP':
    case 'THREE_UP':
    case 'FOUR_UP':
      return (
        <div className={COLUMN_CLASS[layout]}>
          {articles.slice(0, COLUMN_CAP[layout]).map((article) => <StandardStory key={article.id} article={article} />)}
        </div>
      );

    case 'FEATURED_STACK':
    default:
      return (
        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)] md:divide-x md:divide-neutral-200">
          <StandardStory article={lead} />
          <div className="md:pl-6">{rest.slice(0, 3).map((article) => <StoryRow key={article.id} article={article} compact />)}</div>
        </div>
      );
  }
}

export function EditorialSection({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="border-t-4 border-neutral-900 pt-0">
      <div className="mb-5 flex items-center justify-between border-b border-neutral-300 py-3">
        <h2 className="text-xl font-bold text-neutral-950 sm:text-2xl">{title}</h2>
        {href && <Link to={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-800">View all <ArrowRight className="h-4 w-4" /></Link>}
      </div>
      {children}
    </section>
  );
}
