import { Link } from 'react-router-dom';
import { Play, ArrowRight } from 'lucide-react';
import { ImagePlaceholder } from './ImagePlaceholder';
import { contentLanguage } from '@/lib/content-language';

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

function formatStoryDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value));
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
  if (!article.author && !article.publishedAt) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      {article.author?.name && <span>{article.author.name}</span>}
      {article.author && article.publishedAt && <span aria-hidden="true">&middot;</span>}
      {article.publishedAt && <time dateTime={article.publishedAt}>{formatStoryDate(article.publishedAt)}</time>}
    </p>
  );
}

export function LeadStory({ article }: { article: EditorialArticle }) {
  return (
    <article className="min-w-0">
      <Link to={`/article/${article.slug}`} className="group block">
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
  return (
    <article className="min-w-0">
      <Link to={`/article/${article.slug}`} className="group block">
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
  return (
    <article className="min-w-0 border-b border-neutral-200 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <Link to={`/article/${article.slug}`} className="group grid grid-cols-[minmax(0,1fr)_6.5rem] gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
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
  if (!articles.length) return null;
  return (
    <aside aria-label={title} className="min-w-0">
      <h2 className="border-t-4 border-neutral-900 py-3 text-lg font-bold text-neutral-950">{title}</h2>
      <div>
        {articles.map((article) => (
          <article key={article.id} className="border-t border-neutral-200 py-3">
            <Link to={`/article/${article.slug}`} className="group block">
              <h3 lang={contentLanguage(article.title)} className="text-[0.95rem] font-semibold leading-[1.45] text-neutral-900 group-hover:text-primary-600">{article.title}</h3>
              {article.publishedAt && <time className="mt-1 block text-xs text-neutral-500" dateTime={article.publishedAt}>{formatStoryDate(article.publishedAt)}</time>}
            </Link>
          </article>
        ))}
      </div>
    </aside>
  );
}

export function RankedList({ title, articles }: { title: string; articles: EditorialArticle[] }) {
  if (!articles.length) return null;
  return (
    <aside aria-label={title} className="border-t-4 border-primary-600">
      <h2 className="border-b border-neutral-300 py-3 text-xl font-bold text-neutral-950">{title}</h2>
      <ol>
        {articles.map((article, index) => (
          <li key={article.id} className="grid grid-cols-[2.25rem_1fr] gap-3 border-b border-neutral-200 py-4 last:border-b-0">
            <span className="text-2xl font-bold leading-none text-neutral-300" aria-hidden="true">{index + 1}</span>
            <Link lang={contentLanguage(article.title)} to={`/article/${article.slug}`} className="text-sm font-bold leading-[1.45] text-neutral-900 hover:text-primary-600">{article.title}</Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function MediaStory({ article }: { article: EditorialArticle }) {
  return (
    <article className="min-w-0 bg-neutral-900 text-white">
      <Link to={`/article/${article.slug}`} className="group block">
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
export type HomepageLayoutPreset = 'FEATURED_STACK' | 'THREE_UP' | 'COMPACT_LIST';

/** Body of a homepage section for a layout preset. A single remaining story always renders as one row. */
export function SectionBody({ articles, layout }: { articles: EditorialArticle[]; layout: HomepageLayoutPreset }) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  if (articles.length === 1) return <StoryRow article={lead} />;
  if (layout === 'COMPACT_LIST') return <div>{articles.map((article) => <StoryRow key={article.id} article={article} compact />)}</div>;
  if (layout === 'THREE_UP') return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{articles.slice(0, 3).map((article) => <StandardStory key={article.id} article={article} />)}</div>;
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)] md:divide-x md:divide-neutral-200">
      <StandardStory article={lead} />
      <div className="md:pl-6">{rest.slice(0, 3).map((article) => <StoryRow key={article.id} article={article} compact />)}</div>
    </div>
  );
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
