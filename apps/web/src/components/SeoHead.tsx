import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/i18n';

export interface AlternateLanguageLink {
  code: string;
  url: string;
}

interface SeoHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'article' | 'website';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  keywords?: string;
  section?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, unknown>;
  /** Other language versions of this exact page, for hreflang. Omit on pages with no translation concept. */
  alternates?: AlternateLanguageLink[];
}

const SITE_NAME = 'BD News';
const DEFAULT_IMAGE = '/og-default.png';
const DEFAULT_DESCRIPTION = 'Bangladesh-first news, reporting and analysis from across the country and the world.';

export default function SeoHead({
  title,
  description = '',
  image,
  url,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  keywords,
  section,
  noIndex = false,
  jsonLd,
  alternates,
}: SeoHeadProps) {
  const { code, direction } = useLanguage();
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = url || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const structuredData = jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: metaDescription,
    url: typeof window !== 'undefined' ? window.location.origin : undefined,
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };

  return (
    <Helmet htmlAttributes={{ lang: code, dir: direction }}>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="robots" content={noIndex ? 'noindex,follow' : 'index,follow'} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {alternates?.map((alt) => (
        <link key={alt.code} rel="alternate" hrefLang={alt.code} href={alt.url.startsWith('http') ? alt.url : `${origin}${alt.url}`} />
      ))}
      {alternates && alternates.length > 0 && canonicalUrl && (
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      )}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image || DEFAULT_IMAGE} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={code === 'bn' ? 'bn_BD' : 'en_US'} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image || DEFAULT_IMAGE} />
      <meta name="twitter:label1" content="Published by" />
      <meta name="twitter:data1" content={SITE_NAME} />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {author && <meta name="author" content={author} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {section && <meta property="article:section" content={section} />}
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  );
}
