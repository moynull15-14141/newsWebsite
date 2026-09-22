export type SeoStatus = 'PASS' | 'WARNING' | 'ERROR' | 'NOT_APPLICABLE';
export type SeoCategory = 'content' | 'technical' | 'readiness';

export interface SeoCheck {
  id: string;
  category: SeoCategory;
  label: string;
  weight: number;
  status: SeoStatus;
  value?: string | number | boolean;
  message: string;
  recommendation?: string;
  target?: string;
}

export interface SeoArticleInput {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  noIndex?: boolean;
  status?: string | null;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string | null;
  category?: boolean;
  author?: boolean;
  location?: boolean;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  hasOpenGraph?: boolean;
  hasTwitterCard?: boolean;
  hasArticleSchema?: boolean;
  hasBreadcrumbSchema?: boolean;
  hasPublisher?: boolean;
  hasHreflang?: boolean;
  translationsCount?: number;
  duplicateTitle?: boolean;
  duplicateSlug?: boolean;
  duplicateDescription?: boolean;
}

export interface SeoAnalysis {
  score: number;
  completion: number;
  grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
  counts: Record<SeoStatus, number>;
  checks: SeoCheck[];
  categories: Record<SeoCategory, { score: number; completion: number }>;
}

type JsonNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type?: string; attrs?: Record<string, unknown> }[]; content?: JsonNode[] };

function walkContent(value: unknown) {
  let text = '';
  let links = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  let images = 0;
  let imagesWithoutAlt = 0;
  const headings: number[] = [];
  const paragraphs: string[] = [];
  const walk = (node: JsonNode) => {
    if (node.type === 'text' && node.text) text += ` ${node.text}`;
    if (node.type === 'heading') headings.push(Number(node.attrs?.level || 2));
    if (node.type === 'paragraph') {
      const paragraphText = collectText(node);
      if (paragraphText) paragraphs.push(paragraphText);
    }
    if (node.type === 'image') {
      images += 1;
      if (!String(node.attrs?.alt || '').trim()) imagesWithoutAlt += 1;
    }
    const href = String(node.attrs?.href || '');
    const markedHref = String(node.marks?.find((mark) => mark.type === 'link')?.attrs?.href || '');
    const linkHref = href || markedHref;
    if (linkHref) {
      links += 1;
      if (/^https?:\/\//i.test(linkHref)) externalLinks += 1;
      else if (linkHref.startsWith('/')) internalLinks += 1;
    }
    node.content?.forEach(walk);
  };
  const collectText = (node: JsonNode): string => `${node.text || ''}${(node.content || []).map(collectText).join(' ')}`.trim();
  let parsed = value;
  if (typeof parsed === 'string') {
    const raw = parsed;
    try { parsed = JSON.parse(raw); } catch { text = raw.replace(/<[^>]+>/g, ' '); }
  }
  if (parsed && typeof parsed === 'object') walk(parsed as JsonNode);
  const cleanText = text.replace(/\s+/g, ' ').trim();
  return { text: cleanText, words: cleanText ? cleanText.split(/\s+/).length : 0, headings, paragraphs, links, internalLinks, externalLinks, images, imagesWithoutAlt };
}

function check(id: string, category: SeoCategory, label: string, weight: number, status: SeoStatus, message: string, recommendation?: string, value?: SeoCheck['value'], target?: string): SeoCheck {
  return { id, category, label, weight, status, message, recommendation, value, target };
}

function lengthStatus(value: string, goodMin: number, max: number): SeoStatus {
  if (!value.trim()) return 'ERROR';
  if (value.length < goodMin || value.length > max) return 'WARNING';
  return 'PASS';
}

export function analyzeArticleSeo(input: SeoArticleInput): SeoAnalysis {
  const title = (input.seoTitle || input.title || '').trim();
  const description = (input.seoDescription || input.excerpt || '').trim();
  const slug = (input.slug || '').trim();
  const keyword = (input.focusKeyword || '').split(',')[0].trim().toLocaleLowerCase();
  const body = walkContent(input.content);
  const normalizedBody = body.text.toLocaleLowerCase();
  const keywordApplicable = keyword ? undefined : 'Add one primary focus phrase only when it reflects the story naturally.';
  const headingHierarchyValid = body.headings.every((level, index) => index === 0 || level <= body.headings[index - 1] + 1);
  const sentences = body.text.split(/[.!?।]+/).map((item) => item.trim()).filter(Boolean);
  const avgSentenceWords = sentences.length ? body.words / sentences.length : 0;
  const longParagraphs = body.paragraphs.filter((paragraph) => paragraph.split(/\s+/).length > 120).length;
  const indexable = input.status === 'PUBLISHED' && !input.noIndex;

  const checks: SeoCheck[] = [
    check('seo-title', 'content', 'SEO title', 10, lengthStatus(title, 30, 65), title ? `${title.length} characters.` : 'SEO title is missing.', title ? 'Keep the search title concise (about 30–65 characters).' : 'Add a clear SEO title or use the article title.', title.length, 'seo-title'),
    check('meta-description', 'content', 'Meta description', 10, lengthStatus(description, 100, 165), description ? `${description.length} characters.` : 'Meta description is missing.', 'Write a useful summary of approximately 120–160 characters.', description.length, 'seo-description'),
    check('slug', 'content', 'URL slug', 5, !slug ? 'ERROR' : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 ? 'PASS' : 'WARNING', slug || 'Slug is missing.', 'Use a short, lowercase, hyphen-separated slug.', slug.length, 'article-slug'),
    check('focus-keyword', 'content', 'Focus phrase', 4, keyword ? 'PASS' : 'WARNING', keyword || 'No focus phrase is set.', keywordApplicable, keyword || undefined, 'seo-keywords'),
    check('keyword-title', 'content', 'Focus phrase in title', 2, !keyword ? 'NOT_APPLICABLE' : title.toLocaleLowerCase().includes(keyword) ? 'PASS' : 'WARNING', keyword ? 'Checks natural title usage.' : 'No focus phrase to evaluate.', 'Use the phrase in the title only if it reads naturally.'),
    check('keyword-description', 'content', 'Focus phrase in description', 2, !keyword ? 'NOT_APPLICABLE' : description.toLocaleLowerCase().includes(keyword) ? 'PASS' : 'WARNING', keyword ? 'Checks natural summary usage.' : 'No focus phrase to evaluate.', 'Mention the phrase naturally in the summary.'),
    check('keyword-content', 'content', 'Focus phrase in content', 2, !keyword ? 'NOT_APPLICABLE' : normalizedBody.includes(keyword) ? 'PASS' : 'WARNING', keyword ? 'Checks natural body usage.' : 'No focus phrase to evaluate.', 'Cover the focus topic naturally; do not repeat it artificially.'),
    check('headings', 'content', 'Semantic headings', 5, body.headings.length === 0 ? 'WARNING' : headingHierarchyValid ? 'PASS' : 'ERROR', `${body.headings.length} section heading(s).`, 'Add descriptive H2/H3 sections and avoid skipping heading levels.'),
    check('content-length', 'content', 'Meaningful content', 10, body.words === 0 ? 'ERROR' : body.words < 120 ? 'WARNING' : 'PASS', `${body.words} words detected.`, 'Ensure the story fully answers its editorial purpose; short briefs may remain short.', body.words),
    check('readability', 'content', 'Readability heuristics', 5, body.words === 0 ? 'ERROR' : avgSentenceWords > 35 || longParagraphs > 0 ? 'WARNING' : 'PASS', `Average sentence: ${Math.round(avgSentenceWords)} words; long paragraphs: ${longParagraphs}.`, 'Break long sentences and wall-of-text paragraphs into readable sections.'),
    check('internal-links', 'content', 'Internal links', 5, body.words < 120 ? 'NOT_APPLICABLE' : body.internalLinks ? 'PASS' : 'WARNING', `${body.internalLinks} internal link(s).`, 'Link to a relevant category, explainer, location, or related report where useful.'),
    check('external-links', 'content', 'External references', 3, body.words < 300 ? 'NOT_APPLICABLE' : body.externalLinks ? 'PASS' : 'WARNING', `${body.externalLinks} external link(s).`, 'For claims relying on outside material, link to an authoritative source.'),
    check('featured-image', 'content', 'Featured image', 4, input.featuredImageUrl ? 'PASS' : 'WARNING', input.featuredImageUrl ? 'Featured image is available.' : 'No featured image.', 'Choose a representative public image.'),
    check('image-alt', 'content', 'Image alternative text', 3, !input.featuredImageUrl && body.images === 0 ? 'NOT_APPLICABLE' : input.featuredImageUrl && !input.featuredImageAlt || body.imagesWithoutAlt ? 'ERROR' : 'PASS', `${body.imagesWithoutAlt + (input.featuredImageUrl && !input.featuredImageAlt ? 1 : 0)} image(s) missing ALT text.`, 'Describe each meaningful image for accessibility and discovery.'),
    check('duplicate-title', 'content', 'Unique SEO title', 2, input.duplicateTitle === undefined ? 'NOT_APPLICABLE' : input.duplicateTitle ? 'ERROR' : 'PASS', input.duplicateTitle ? 'Another article uses this SEO title.' : 'No duplicate SEO title found.', 'Use a distinct title that identifies this story.'),
    check('duplicate-slug', 'content', 'Unique slug', 2, input.duplicateSlug === undefined ? 'NOT_APPLICABLE' : input.duplicateSlug ? 'ERROR' : 'PASS', input.duplicateSlug ? 'Another article uses this slug.' : 'No duplicate slug found.', 'Generate a unique public slug.'),
    check('duplicate-description', 'content', 'Unique description', 1, input.duplicateDescription === undefined ? 'NOT_APPLICABLE' : input.duplicateDescription ? 'WARNING' : 'PASS', input.duplicateDescription ? 'Another article uses this description.' : 'No duplicate description found.', 'Summarize what is unique about this story.'),
    check('canonical', 'technical', 'Canonical URL', 7, input.canonicalUrl && !/^https?:\/\//i.test(input.canonicalUrl) ? 'ERROR' : slug ? 'PASS' : 'ERROR', input.canonicalUrl || 'Canonical will use the article route.', 'Use an absolute override only when the canonical differs from the article URL.', undefined, 'canonical-url'),
    check('indexability', 'technical', 'Indexability', 5, input.noIndex ? 'WARNING' : 'PASS', input.noIndex ? 'This article requests noindex.' : 'Indexing is allowed.', input.noIndex ? 'Remove noindex when this article should appear in search.' : undefined, !input.noIndex),
    check('sitemap-eligibility', 'technical', 'Sitemap eligibility', 4, input.status && input.status !== 'PUBLISHED' ? 'NOT_APPLICABLE' : indexable ? 'PASS' : 'WARNING', indexable ? 'Eligible for the article sitemap.' : 'Only published, indexable articles enter the sitemap.', 'Publish and allow indexing when editorially ready.'),
    check('open-graph', 'technical', 'Open Graph metadata', 3, input.hasOpenGraph === false ? 'ERROR' : 'PASS', 'Public article template supplies Open Graph metadata.', 'Provide title, description, URL, and image.'),
    check('twitter-card', 'technical', 'X/Twitter card', 2, input.hasTwitterCard === false ? 'ERROR' : 'PASS', 'Public article template supplies a large-image card.', 'Provide card title, description, and image.'),
    check('article-schema', 'technical', 'NewsArticle schema', 5, input.hasArticleSchema === false ? 'ERROR' : 'PASS', 'NewsArticle structured data is configured.', 'Provide headline, dates, author, publisher, image, and main entity URL.'),
    check('breadcrumb-schema', 'technical', 'Breadcrumb schema', 3, input.hasBreadcrumbSchema === false ? 'WARNING' : 'PASS', 'Breadcrumb structured data is configured.', 'Represent the visible article hierarchy as BreadcrumbList.'),
    check('hreflang', 'technical', 'Language alternates', 2, (input.translationsCount || 0) === 0 ? 'NOT_APPLICABLE' : input.hasHreflang === false ? 'ERROR' : 'PASS', (input.translationsCount || 0) ? `${input.translationsCount} translation(s).` : 'No related translation.', 'Emit alternates only for actual translated siblings.'),
    check('summary', 'readiness', 'Answer-friendly summary', 6, description.length >= 80 ? 'PASS' : description ? 'WARNING' : 'ERROR', description ? `${description.length} summary characters.` : 'No summary.', 'Open with a concise, factual summary of the central development.'),
    check('entity-context', 'readiness', 'Entity context', 4, input.category && (input.location || body.words < 200) ? 'PASS' : input.category ? 'WARNING' : 'ERROR', `Category: ${input.category ? 'yes' : 'no'}; location: ${input.location ? 'yes' : 'no'}.`, 'Assign a category and, when the story is location-specific, its location.'),
    check('attribution', 'readiness', 'Author attribution', 4, input.author ? 'PASS' : 'ERROR', input.author ? 'Author is attributed.' : 'Author is missing.', 'Assign the responsible author.'),
    check('publisher', 'readiness', 'Publisher identity', 2, input.hasPublisher === false ? 'ERROR' : 'PASS', 'Publisher identity is available.', 'Configure a stable publisher name and logo.'),
    check('publication-dates', 'readiness', 'Publication and modified dates', 4, input.status && input.status !== 'PUBLISHED' ? 'NOT_APPLICABLE' : input.publishedAt && input.updatedAt ? 'PASS' : 'ERROR', input.publishedAt ? 'Publication timestamp is available.' : 'Publication timestamp is missing.', 'Published stories must expose reliable published and modified dates.'),
  ];

  const applicable = checks.filter((item) => item.status !== 'NOT_APPLICABLE');
  const totalWeight = applicable.reduce((sum, item) => sum + item.weight, 0);
  const earned = applicable.reduce((sum, item) => sum + item.weight * (item.status === 'PASS' ? 1 : item.status === 'WARNING' ? 0.5 : 0), 0);
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
  const completion = applicable.length ? Math.round((applicable.filter((item) => item.status === 'PASS').length / applicable.length) * 100) : 0;
  const categoryNames: SeoCategory[] = ['content', 'technical', 'readiness'];
  const categories = Object.fromEntries(categoryNames.map((category) => {
    const list = applicable.filter((item) => item.category === category);
    const weight = list.reduce((sum, item) => sum + item.weight, 0);
    const points = list.reduce((sum, item) => sum + item.weight * (item.status === 'PASS' ? 1 : item.status === 'WARNING' ? 0.5 : 0), 0);
    return [category, { score: weight ? Math.round(points / weight * 100) : 0, completion: list.length ? Math.round(list.filter((item) => item.status === 'PASS').length / list.length * 100) : 0 }];
  })) as SeoAnalysis['categories'];
  const counts = { PASS: 0, WARNING: 0, ERROR: 0, NOT_APPLICABLE: 0 };
  checks.forEach((item) => { counts[item.status] += 1; });
  return { score, completion, grade: score >= 90 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 50 ? 'NEEDS_ATTENTION' : 'CRITICAL', counts, checks, categories };
}
