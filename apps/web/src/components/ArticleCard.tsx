import { Link } from 'react-router-dom';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { ImagePlaceholder } from './ImagePlaceholder';
import { contentLanguage } from '@/lib/content-language';
import { useLanguage } from '@/lib/i18n';
import { formatLocalizedShortDate } from '@/lib/format-date';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  author?: { id: string; name: string } | null;
  category?: { id: string; name: string; slug: string } | null;
  imageUrl?: string;
  featuredImageUrl?: string;
  media?: { id: string; publicUrl: string } | null;
}

export type ArticleCardVariant =
  | 'featured'
  | 'large'
  | 'horizontal'
  | 'compact'
  | 'image-top'
  | 'text-only'
  | 'video'
  | 'opinion'
  | 'standard';

interface ArticleCardProps {
  article: Article;
  variant?: ArticleCardVariant;
}

function ArticleImage({
  src,
  alt,
  className,
  aspect = '16/9',
}: {
  src?: string;
  alt: string;
  className?: string;
  aspect?: string;
}) {
  if (src) {
    return <img src={src} alt={alt} className={className} loading="lazy" />;
  }
  return <ImagePlaceholder className={className} aspect={aspect} />;
}

function ArticleMeta({ article }: { article: Article }) {
  const { code } = useLanguage();
  const { author, publishedAt } = article;
  if (!author && !publishedAt) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      {author && <span>{author.name}</span>}
      {author && publishedAt && <span>&middot;</span>}
      {publishedAt && <time dateTime={publishedAt}>{formatLocalizedShortDate(publishedAt, code)}</time>}
    </div>
  );
}

function ArticleCategory({ category }: { category?: Article['category'] }) {
  if (!category) return null;
  return (
    // max-w-full + truncate: a safety ceiling, not a visual change for real category names (they're
    // always short). Without it, this badge sits in a `min-w-0 flex-1` column next to a fixed-width
    // thumbnail — `min-w-0` lets that column shrink, but the badge itself has no width limit, so at
    // narrow tablet grid widths (3 columns) it can render wider than its shrunk column and overflow
    // past the page edge instead of the column just clipping it.
    <Badge variant="category" className="mb-2 max-w-full truncate">
      {category.name}
    </Badge>
  );
}

export function ArticleCardSkeleton({ variant = 'standard' }: { variant?: ArticleCardVariant }) {
  const mediaTop = variant === 'featured' || variant === 'large' || variant === 'image-top' || variant === 'video';
  const horizontal = variant === 'compact' || variant === 'horizontal' || variant === 'standard';
  const textOnly = variant === 'text-only' || variant === 'opinion';

  return (
    <div aria-hidden="true" data-layout={mediaTop ? 'media-top' : horizontal ? 'horizontal' : 'text'} data-variant={variant}>
      {mediaTop && (
        <div className="space-y-3">
          <Skeleton className={`${variant === 'featured' || variant === 'large' ? 'h-[300px]' : 'h-[200px]'} w-full rounded-lg`} />
          {variant !== 'featured' && variant !== 'large' && (
            <>
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </>
          )}
        </div>
      )}
      {horizontal && (
        <div className="flex gap-4">
          <Skeleton className={`${variant === 'compact' ? 'h-16 w-20' : 'h-28 w-36'} flex-shrink-0 rounded`} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      )}
      {textOnly && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
    </div>
  );
}

export default function ArticleCard({ article, variant = 'standard' }: ArticleCardProps) {
  const { code, pathFor } = useLanguage();
  const articleHref = pathFor(`/article/${article.slug}`, code);
  const imageUrl = article.featuredImageUrl || article.imageUrl || article.media?.publicUrl;

  const renderImage = (className: string, aspect = '16/9') => (
    <ArticleImage src={imageUrl} alt={article.title} className={className} aspect={aspect} />
  );

  if (variant === 'featured' || variant === 'large') {
    return (
      <Link to={articleHref} className="group block min-w-0">
        <article className="relative overflow-hidden rounded-lg">
          {renderImage('h-[300px] w-full object-cover transition-transform duration-300 group-hover:scale-105', '16/9')}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <ArticleCategory category={article.category} />
            <h2 lang={contentLanguage(article.title)} className={`text-white ${variant === 'featured' ? 'text-2xl font-bold' : 'text-xl font-bold'}`}>
              {article.title}
            </h2>
            {article.excerpt && (
              <p lang={contentLanguage(article.excerpt)} className="mt-2 line-clamp-3 text-white/90">{article.excerpt}</p>
            )}
            <ArticleMeta article={article} />
          </div>
        </article>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link to={articleHref} className="group flex min-w-0 gap-4">
        <article className="flex w-full gap-4">
          {renderImage('h-16 w-20 flex-shrink-0 rounded object-cover', '4/3')}
          <div className="min-w-0 flex-1">
            <ArticleCategory category={article.category} />
            <h3 lang={contentLanguage(article.title)} className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-800 transition-colors group-hover:text-primary-500">
              {article.title}
            </h3>
            {article.publishedAt && (
              <time className="mt-1 block text-xs text-neutral-500">
                {formatLocalizedShortDate(article.publishedAt, code)}
              </time>
            )}
          </div>
        </article>
      </Link>
    );
  }

  if (variant === 'horizontal') {
    return (
      <Link to={articleHref} className="group block min-w-0">
        <article className="flex w-full gap-6">
          {renderImage('h-24 w-32 flex-shrink-0 rounded object-cover', '4/3')}
          <div className="min-w-0 flex-1">
            <ArticleCategory category={article.category} />
            <h3 lang={contentLanguage(article.title)} className="text-base font-bold leading-snug text-neutral-800 transition-colors group-hover:text-primary-500">
              {article.title}
            </h3>
            {article.excerpt && (
              <p lang={contentLanguage(article.excerpt)} className="mt-2 line-clamp-2 text-sm text-neutral-600">{article.excerpt}</p>
            )}
            <ArticleMeta article={article} />
          </div>
        </article>
      </Link>
    );
  }

  if (variant === 'image-top') {
    return (
      <Link to={articleHref} className="group block min-w-0">
        <article className="overflow-hidden rounded-lg">
          {renderImage('h-[200px] w-full object-cover', '16/9')}
          <div className="p-5">
            <ArticleCategory category={article.category} />
            <h3 lang={contentLanguage(article.title)} className="card-title text-neutral-800 mb-3 group-hover:text-primary-500">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="mb-4 line-clamp-3 text-neutral-600">{article.excerpt}</p>
            )}
            <ArticleMeta article={article} />
          </div>
        </article>
      </Link>
    );
  }

  if (variant === 'text-only') {
    return (
      <Link to={articleHref} className="group block min-w-0">
        <article className="p-6">
          <ArticleCategory category={article.category} />
          <h2 className="heading-2 text-neutral-800 mb-4 group-hover:text-primary-500">
            {article.title}
          </h2>
          {article.excerpt && (
            <p lang={contentLanguage(article.excerpt)} className="mb-6 line-clamp-4 text-neutral-600">{article.excerpt}</p>
          )}
          <ArticleMeta article={article} />
        </article>
      </Link>
    );
  }

  if (variant === 'video') {
    return (
      <Link to={articleHref} className="group block min-w-0">
        <article className="overflow-hidden rounded-lg">
          <div className="relative h-[200px] w-full">
            {renderImage('h-[200px] w-full object-cover', '16/9')}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <div className="p-5">
            <ArticleCategory category={article.category} />
            <h3 lang={contentLanguage(article.title)} className="card-title text-neutral-800 mb-3 group-hover:text-primary-500">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="mb-4 line-clamp-3 text-neutral-600">{article.excerpt}</p>
            )}
            <ArticleMeta article={article} />
          </div>
        </article>
      </Link>
    );
  }

  if (variant === 'opinion') {
    return (
      <Link to={articleHref} className="group block min-w-0">
        <article className="overflow-hidden rounded-lg border-l-4 border-primary-500">
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                Opinion
              </span>
              <ArticleCategory category={article.category} />
            </div>
            <h3 lang={contentLanguage(article.title)} className="card-title text-neutral-800 mb-3 group-hover:text-primary-500">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="mb-4 line-clamp-3 text-neutral-600">{article.excerpt}</p>
            )}
            <ArticleMeta article={article} />
          </div>
        </article>
      </Link>
    );
  }

  // Standard variant (default)
  return (
    <Link to={articleHref} className="group block min-w-0">
      <article className="flex w-full gap-5">
        {renderImage('h-28 w-36 flex-shrink-0 rounded object-cover sm:h-32 sm:w-40', '4/3')}
        <div className="min-w-0 flex-1">
          <ArticleCategory category={article.category} />
          <h3 lang={contentLanguage(article.title)} className="line-clamp-2 text-base font-bold leading-snug text-neutral-800 transition-colors group-hover:text-primary-500">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{article.excerpt}</p>
          )}
          <ArticleMeta article={article} />
        </div>
      </article>
    </Link>
  );
}

export { ImagePlaceholder };
