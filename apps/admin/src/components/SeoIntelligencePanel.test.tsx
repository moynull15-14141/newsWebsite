import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SeoIntelligencePanel from './SeoIntelligencePanel';

const base = { title: 'Bangladesh climate report explains new coastal measures', slug: 'bangladesh-climate-report', excerpt: 'A concise explanation of new coastal measures, who they affect and what officials have confirmed about the implementation timeline.', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changes' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Bangladesh climate report '.repeat(80) }] }] }, seoTitle: 'Bangladesh climate report explains coastal measures', seoDescription: 'A concise explanation of new coastal measures, who they affect and what officials have confirmed about the implementation timeline.', focusKeyword: 'Bangladesh climate report', category: true, location: true, author: true, featuredImageUrl: 'https://cdn.test/coast.jpg', featuredImageAlt: 'Coastal embankment', status: 'PUBLISHED', publishedAt: '2026-09-20', updatedAt: '2026-09-21', hasOpenGraph: true, hasTwitterCard: true, hasArticleSchema: true, hasBreadcrumbSchema: true, hasPublisher: true };

describe('SeoIntelligencePanel', () => {
  it('renders score, completion, categories, recommendations and preview tabs', () => {
    const html = renderToStaticMarkup(<SeoIntelligencePanel {...base} onUseTitle={() => {}} onUseExcerpt={() => {}} onGenerateSlug={() => {}} />);
    expect(html).toContain('SEO Intelligence');
    expect(html).toContain('SEO completion');
    expect(html).toContain('Content SEO');
    expect(html).toContain('Technical SEO');
    expect(html).toContain('Search / Answer Engine Readiness');
    expect(html).toContain('Google');
    expect(html).toContain('Facebook / OG');
  });

  it('shows actionable errors for an incomplete draft', () => {
    const html = renderToStaticMarkup(<SeoIntelligencePanel title="" slug="" content="" status="DRAFT" onUseTitle={() => {}} onUseExcerpt={() => {}} onGenerateSlug={() => {}} />);
    expect(html).toContain('Recommendation:');
    expect(html).toContain('SEO title is missing');
    expect(html).toContain('Go to field');
  });
});
