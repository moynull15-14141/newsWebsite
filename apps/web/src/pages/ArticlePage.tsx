import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Copy, Check, Clock, Share2, Languages as LanguagesIcon } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import TiptapRenderer from '@/components/TiptapRenderer';
import ArticleCard from '@/components/ArticleCard';
import CommentsSection from '@/components/CommentsSection';
import AdSlot from '@/components/AdSlot';
import BookmarkButton from '@/components/BookmarkButton';
import { useLanguage } from '@/lib/i18n';
import { formatLocalizedDate } from '@/lib/format-date';

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface ArticleLanguage {
  id: string;
  code: string;
  name: string;
  nativeName: string;
}

interface ArticleTranslation {
  slug: string;
  title: string;
  language: ArticleLanguage;
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
  media?: { id: string; publicUrl: string; altText?: string; width?: number | null; height?: number | null };
  _count?: { comments: number };
  corrections?: { id: string; description: string; correctedAt: string }[];
  language?: ArticleLanguage | null;
  /** PUBLISHED sibling versions of this exact story in other languages (Part 14/17). */
  translations?: ArticleTranslation[];
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
  const { code, t, pathFor } = useLanguage();

  // Slug lookup is language-agnostic on purpose (each language version has its own slug) — see
  // apps/api/src/modules/public/public.service.ts. `code` is not sent here; it only decides how the
  // page around the article (nav, dates, notices) is presented.
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
        <p className="mt-4 text-lg text-gray-600">{t('common.404Title')}</p>
        <Link to={pathFor('/', code)} className="mt-6 inline-block text-primary-500 hover:underline">
          {t('common.goBackHome')}
        </Link>
      </div>
    );
  }

  const imageUrl = article.featuredImageUrl || article.imageUrl || article.media?.publicUrl;
  const tags = article.articleTags?.map((at) => at.tag).filter(Boolean) || [];
  const readingTime = estimateReadingTime(article.content);

  // Part 15: never fabricate a translation. The article renders exactly as stored (its own language);
  // if that differs from the reader's current site language, a plain notice says so instead of silently
  // mixing languages, and — when one exists — offers the real translation.
  const articleLanguageCode = article.language?.code;
  const languageMismatch = !!articleLanguageCode && articleLanguageCode !== code;
  const otherTranslations = (article.translations ?? []).filter((tr) => tr.language.code !== articleLanguageCode);
  const readerLanguageTranslation = otherTranslations.find((tr) => tr.language.code === code);

  const alternates = [
    ...(articleLanguageCode ? [{ code: articleLanguageCode, url: pathFor(`/article/${article.slug}`, articleLanguageCode) }] : []),
    ...otherTranslations.map((tr) => ({ code: tr.language.code, url: pathFor(`/article/${tr.slug}`, tr.language.code) })),
  ];

  const pageOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const publicUrl = article.canonicalUrl || (typeof window !== 'undefined' ? `${pageOrigin}${window.location.pathname}` : `${pageOrigin}${pathFor(`/article/${article.slug}`, code)}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle', headline: article.title, description: article.seoDescription || article.excerpt,
        image: imageUrl ? [imageUrl] : undefined, datePublished: article.publishedAt, dateModified: article.updatedAt || article.publishedAt,
        author: article.author ? { '@type': 'Person', name: article.author.name, url: `${pageOrigin}${pathFor(`/author/${article.author.id}`, code)}` } : undefined,
        publisher: { '@id': `${pageOrigin}/#publisher` }, mainEntityOfPage: publicUrl ? { '@type': 'WebPage', '@id': publicUrl } : undefined,
        articleSection: article.category?.name, keywords: tags.map((tag) => tag.name).join(', ') || article.seoKeywords, inLanguage: articleLanguageCode,
        contentLocation: article.location ? { '@type': 'Place', name: article.location.name } : undefined,
      },
      { '@type': 'NewsMediaOrganization', '@id': `${pageOrigin}/#publisher`, name: 'BD News', url: pageOrigin },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('common.home'), item: `${pageOrigin}${pathFor('/', code)}` },
        ...(article.category ? [{ '@type': 'ListItem', position: 2, name: article.category.name, item: `${pageOrigin}${pathFor(`/category/${article.category.slug}`, code)}` }] : []),
        { '@type': 'ListItem', position: article.category ? 3 : 2, name: article.title, item: publicUrl },
      ] },
    ],
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
        alternates={alternates.length > 1 ? alternates : undefined}
      />

      <article className="container-narrow py-8 lg:py-12">
        <AdSlot slot="ARTICLE_TOP" pageType="ARTICLE" categoryId={article.category?.id} locationId={article.location?.id} context={article.slug} />
        <nav className="mb-6 text-sm text-gray-500">
          <Link to={pathFor('/', code)} className="hover:text-primary-500">{t('common.home')}</Link>
          {article.category && (
            <>
              <span className="mx-2">&gt;</span>
              <Link to={pathFor(`/category/${article.category.slug}`, code)} className="hover:text-primary-500">
                {article.category.name}
              </Link>
            </>
          )}
          <span className="mx-2">&gt;</span>
          <span className="text-gray-700">{article.title}</span>
        </nav>

        {languageMismatch && article.language && (
          <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <LanguagesIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('article.notAvailableInLanguage', { language: code === 'bn' ? 'বাংলা' : 'English', original: article.language.nativeName })}</span>
            {readerLanguageTranslation && (
              <Link to={pathFor(`/article/${readerLanguageTranslation.slug}`, code)} className="font-semibold underline hover:no-underline">
                {t('article.alsoAvailableIn', { language: readerLanguageTranslation.language.nativeName })}
              </Link>
            )}
          </div>
        )}

        {article.category && (
          <span className="mb-3 inline-block rounded bg-primary-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {article.category.name}
          </span>
        )}

        <h1 lang={articleLanguageCode} className="text-3xl font-bold leading-tight text-gray-900 lg:text-4xl">
          {article.title}
        </h1>

        {article.excerpt && (
          <p lang={articleLanguageCode} className="mt-3 text-lg leading-relaxed text-gray-600">
            {article.excerpt}
          </p>
        )}

        <AdSlot slot="ARTICLE_AFTER_INTRO" pageType="ARTICLE" categoryId={article.category?.id} locationId={article.location?.id} context={article.slug} />

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {article.author && <span className="font-medium text-gray-700">{article.author.name}</span>}
          {article.author && article.publishedAt && <span>&middot;</span>}
          {article.publishedAt && <time dateTime={article.publishedAt}>{formatLocalizedDate(article.publishedAt, articleLanguageCode ?? code)}</time>}
          <span>&middot;</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t('common.minRead', { n: readingTime })}
          </span>
        </div>

        {!languageMismatch && otherTranslations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {otherTranslations.map((tr) => (
              <Link key={tr.slug} to={pathFor(`/article/${tr.slug}`, tr.language.code)} lang={tr.language.code} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                <LanguagesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {t('article.alsoAvailableIn', { language: tr.language.nativeName })}
              </Link>
            ))}
          </div>
        )}

        {imageUrl && (
          <figure className="my-8">
            {/* Real intrinsic dimensions (when known — see public-article-select.ts) let the browser
                reserve the right box before the image loads, so it doesn't jump the article text down
                once it does. Undefined width/height (an externally-set featuredImageUrl, or an older
                Media row from before dimension detection existed) just falls back to auto sizing. */}
            <img
              src={imageUrl}
              alt={article.media?.altText || article.title}
              width={article.media?.width ?? undefined}
              height={article.media?.height ?? undefined}
              className="w-full rounded-lg"
              style={{ aspectRatio: article.media?.width && article.media?.height ? `${article.media.width} / ${article.media.height}` : undefined }}
              decoding="async"
            />
          </figure>
        )}

        <div lang={articleLanguageCode} className="prose prose-lg max-w-none font-serif">
          {article.content && <TiptapRenderer content={article.content as Record<string, unknown>} />}
        </div>

        <AdSlot slot="ARTICLE_IN_CONTENT" pageType="ARTICLE" categoryId={article.category?.id} locationId={article.location?.id} context={article.slug} />

        {article.corrections?.length ? (
          <aside className="mt-8 border-l-4 border-primary-500 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold">{t('common.updated')}</p>
            <p className="mt-1">{article.corrections[0].description}</p>
          </aside>
        ) : null}

        {tags.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <span className="text-sm font-semibold text-gray-700">{t('common.tags')}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={pathFor(`/tag/${tag.slug}`, code)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <AdSlot slot="ARTICLE_MID" pageType="ARTICLE" categoryId={article.category?.id} locationId={article.location?.id} context={article.slug} />

        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex flex-wrap gap-2">
            <BookmarkButton articleId={article.id} />
            <button onClick={handleCopyLink} className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t('common.copied') : t('common.copyLink')}</button>
            <button onClick={() => handleShare('https://www.facebook.com/sharer/sharer.php?u=')} className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Share2 size={16} /> Facebook</button>
            <button onClick={() => handleShare('https://wa.me/?text=')} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">WhatsApp</button>
            {typeof navigator.share === 'function' && <button onClick={() => handleShare('native')} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('common.share')}</button>}
          </div>
        </div>
        <AdSlot slot="ARTICLE_END" pageType="ARTICLE" categoryId={article.category?.id} locationId={article.location?.id} context={article.slug} />
        <CommentsSection slug={article.slug} count={article._count?.comments} />
      </article>

      {related && related.length > 0 && (
        <section className="container-wide border-t border-neutral-200 py-12">
          <h2 className="mb-6 text-2xl font-bold text-neutral-900">{t('common.relatedArticles')}</h2>
          <AdSlot slot="ARTICLE_RELATED" pageType="ARTICLE" categoryId={article.category?.id} locationId={article.location?.id} context={article.slug} />
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
