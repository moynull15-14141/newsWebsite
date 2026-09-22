import { describe, expect, it } from 'vitest';
import { analyzeArticleSeo } from './index';

const content = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context' }] }, { type: 'paragraph', content: [{ type: 'text', text: `${'Useful reporting sentence. '.repeat(90)}` }] }, { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'link', attrs: { href: '/category/news' } }], text: 'Related coverage' }] }] };
const good = { title: 'A clear Bangladesh news headline for readers', slug: 'clear-bangladesh-news-headline', excerpt: 'This concise report explains the central development, the people affected and the verified context readers need to understand today.', seoTitle: 'A clear Bangladesh news headline for readers', seoDescription: 'This concise report explains the central development, the people affected and the verified context readers need to understand today.', focusKeyword: 'Bangladesh news', content, featuredImageUrl: 'https://cdn.test/image.jpg', featuredImageAlt: 'Reporter at the scene', category: true, author: true, location: true, publishedAt: new Date(), updatedAt: new Date(), status: 'PUBLISHED', hasPublisher: true };

describe('deterministic SEO analyzer', () => {
  it('scores a complete article and keeps score separate from completion', () => { const result = analyzeArticleSeo(good); expect(result.score).toBeGreaterThan(70); expect(result.completion).toBeGreaterThan(60); });
  it.each([
    ['title', { ...good, title: '', seoTitle: '' }, 'seo-title', 'ERROR'],
    ['description', { ...good, excerpt: '', seoDescription: '' }, 'meta-description', 'ERROR'],
    ['slug', { ...good, slug: '' }, 'slug', 'ERROR'],
    ['image', { ...good, featuredImageUrl: '' }, 'featured-image', 'WARNING'],
    ['canonical', { ...good, canonicalUrl: 'javascript:bad' }, 'canonical', 'ERROR'],
    ['duplicate', { ...good, duplicateTitle: true }, 'duplicate-title', 'ERROR'],
  ])('detects %s problems', (_name, input, id, status) => expect(analyzeArticleSeo(input).checks.find((item) => item.id === id)?.status).toBe(status));
  it('does not penalize non-applicable translation checks', () => expect(analyzeArticleSeo(good).checks.find((item) => item.id === 'hreflang')?.status).toBe('NOT_APPLICABLE'));
});
