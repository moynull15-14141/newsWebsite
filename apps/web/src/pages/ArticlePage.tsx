import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Copy, Check, Clock, Share2 } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import TiptapRenderer from '@/components/TiptapRenderer';
import ArticleCard from '@/components/ArticleCard';
import CommentsSection from '@/components/CommentsSection';
import AdSlot from '@/components/AdSlot';
import BookmarkButton from '@/components/BookmarkButton';

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  content?: Record<string, unknown>;
  publishedAt?: string;
  updatedAt?: string;
  viewCount?: number;
  author?: { id: string; name: string };
  category?: { id: string; name: string; slug: string };
  location?: { id: string; name: string; slug: string; type: string };
  articleTags?: { tag: Tag }[];
  imageUrl?: string;
  featuredImageUrl?: string;
  media?: { id: string; publicUrl: string };
  _count?: { comments: number };
  corrections?: { id: string; description: string; correctedAt: string }[];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function estimateReadingTime(content?: Record<string, unknown>): number {
  if (!content) return 1;
  const text = JSON.stringify(content);
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);

  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ['article', slug],
    queryFn: () => apiFetch(`/public/articles/${slug}`),
    enabled: !!slug,
  });

  const { data: related } = useQuery<Article[]>({
    queryKey: ['related', slug],
    queryFn: () => apiFetch(`/public/articles/${slug}/related`),
    enabled: !!slug,
  });

  useEffect(() => {
    if (article?.id) {
      apiFetch(`/public/articles/${article.slug}/view`, {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }, [article?.id, article?.slug]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (network?: string) => {
    const url = window.location.href;
    if (network === 'native' && typeof navigator.share === 'function') await navigator.share({ title: article!.title, url }).catch(() => {});
    else if (network) window.open(`${network}${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    apiFetch('/public/analytics/events', { method: 'POST', body: JSON.stringify({ eventType: 'ARTICLE_SHARE', articleId: article!.id, sessionId: localStorage.getItem('bd-news-session') || undefined }) }).catch(() => {});
  };

  if (isLoading) {
    return (
      <div className="container-narrow py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-gray-200" />
          <div className="h-10 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="mt-8 aspect-[16/9] rounded-lg bg-gray-200" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container-narrow py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-lg text-gray-600">Article not found</p>
        <Link to="/" className="mt-6 inline-block text-primary-500 hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  const imageUrl = article.featuredImageUrl || article.imageUrl || article.media?.publicUrl;
  const tags = article.articleTags?.map((at) => at.tag).filter(Boolean) || [];
  const readingTime = estimateReadingTime(article.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    author: article.author ? { '@type': 'Person', name: article.author.name } : undefined,
    datePublished: article.publishedAt,
    image: imageUrl,
    publisher: {
      '@type': 'Organization',
      name: 'BD News',
    },
  };

  return (
    <>
      <SeoHead
        title={article.seoTitle || article.title}
        description={article.seoDescription || article.excerpt}
        image={imageUrl}
        url={article.canonicalUrl}
        type="article"
        publishedTime={article.publishedAt}
        modifiedTime={article.updatedAt}
        author={article.author?.name}
        keywords={article.seoKeywords}
        section={article.category?.name}
        noIndex={article.noIndex}
        jsonLd={jsonLd}
      />

      <article className="container-narrow py-8 lg:py-12">
        <AdSlot slot="ARTICLE_TOP" pageType="article" categoryId={article.category?.id} locationId={article.location?.id} />
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/" className="hover:text-primary-500">Home</Link>
          {article.category && (
            <>
              <span className="mx-2">&gt;</span>
              <Link to={`/category/${article.category.slug}`} className="hover:text-primary-500">
                {article.category.name}
              </Link>
            </>
          )}
          <span className="mx-2">&gt;</span>
          <span className="text-gray-700">{article.title}</span>
        </nav>

        {article.category && (
          <span className="mb-3 inline-block rounded bg-primary-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {article.category.name}
          </span>
        )}

        <h1 className="text-3xl font-bold leading-tight text-gray-900 lg:text-4xl">
          {article.title}
        </h1>

        {article.excerpt && (
          <p className="mt-3 text-lg leading-relaxed text-gray-600">
            {article.excerpt}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {article.author && <span className="font-medium text-gray-700">{article.author.name}</span>}
          {article.author && article.publishedAt && <span>&middot;</span>}
          {article.publishedAt && <time>{formatDate(article.publishedAt)}</time>}
          <span>&middot;</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readingTime} min read
          </span>
        </div>

        {imageUrl && (
          <figure className="my-8">
            <img src={imageUrl} alt={article.title} className="w-full rounded-lg" />
          </figure>
        )}

        <div className="prose prose-lg max-w-none font-serif">
          {article.content && <TiptapRenderer content={article.content as Record<string, unknown>} />}
        </div>

        {article.corrections?.length ? (
          <aside className="mt-8 border-l-4 border-primary-500 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold">Updated</p>
            <p className="mt-1">{article.corrections[0].description}</p>
          </aside>
        ) : null}

        {tags.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <span className="text-sm font-semibold text-gray-700">Tags:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/tag/${tag.slug}`}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex flex-wrap gap-2">
            <BookmarkButton articleId={article.id} />
            <button onClick={handleCopyLink} className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied!' : 'Copy link'}</button>
            <button onClick={() => handleShare('https://www.facebook.com/sharer/sharer.php?u=')} className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Share2 size={16} /> Facebook</button>
            <button onClick={() => handleShare('https://wa.me/?text=')} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">WhatsApp</button>
            {typeof navigator.share === 'function' && <button onClick={() => handleShare('native')} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Share</button>}
          </div>
        </div>
        <AdSlot slot="ARTICLE_BOTTOM" pageType="article" categoryId={article.category?.id} locationId={article.location?.id} />
        <CommentsSection slug={article.slug} count={article._count?.comments} />
      </article>

      {related && related.length > 0 && (
        <section className="container-wide border-t border-neutral-200 py-12">
          <h2 className="mb-6 text-2xl font-bold text-neutral-900">Related Articles</h2>
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
            {related.slice(0, 4).map((a) => (
              <ArticleCard key={a.id} article={a} variant="standard" />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
