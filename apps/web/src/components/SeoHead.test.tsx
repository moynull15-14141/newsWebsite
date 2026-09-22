import { renderToStaticMarkup } from 'react-dom/server';
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/lib/i18n';
import SeoHead from './SeoHead';

describe('SeoHead', () => {
  it('emits localized discovery metadata and the requested canonical URL', () => {
    const context: { helmet?: HelmetServerState | null } = {};
    const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider context={context}>
          <MemoryRouter>
            <LanguageProvider>
              <SeoHead
                title="#জরুরি সংবাদ - BD News"
                description="#জরুরি সংবাদ থেকে সর্বশেষ সংবাদ"
                url="https://example.test/tag/breaking-news"
                jsonLd={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: '#জরুরি সংবাদ' }}
              />
            </LanguageProvider>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );

    expect(context.helmet?.title.toString()).toContain('#জরুরি সংবাদ - BD News');
    expect(context.helmet?.meta.toString()).toContain('#জরুরি সংবাদ থেকে সর্বশেষ সংবাদ');
    expect(context.helmet?.link.toString()).toContain('https://example.test/tag/breaking-news');
  });
});
