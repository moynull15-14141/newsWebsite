import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SeoDashboardPage from './SeoDashboardPage';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { score: 81, completion: 74, analyzedArticles: 12, distribution: { excellent: 2, good: 5, needsAttention: 4, critical: 1 }, issues: [{ id: 'image-alt', label: 'Image alternative text', severity: 'ERROR', affected: 3, recommendation: 'Describe each image.' }], technical: { robots: true, sitemap: true, indexablePublishedArticles: 9 }, generatedAt: '2026-09-22T00:00:00Z', limited: false }, isLoading: false, error: null }) }));

describe('SeoDashboardPage', () => {
  it('renders real aggregate fields returned by the API', () => {
    const html = renderToStaticMarkup(<SeoDashboardPage />);
    expect(html).toContain('81');
    expect(html).toContain('12 non-archived articles');
    expect(html).toContain('3 articles: Image alternative text');
    expect(html).toContain('Indexable Published Articles');
  });
});
