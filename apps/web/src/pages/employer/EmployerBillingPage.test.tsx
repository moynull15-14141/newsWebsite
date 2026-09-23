import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EmployerBillingPage from './EmployerBillingPage';
import { LanguageProvider } from '@/lib/i18n';
import type { JobPostingPlan } from './types';

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/en/employer/billing', search: '' }) }));

let plans: JobPostingPlan[];
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => (queryKey[0] === 'employer-plans' ? { data: plans, isLoading: false, isError: false } : { data: { data: [] } }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

function renderPage() {
  return renderToStaticMarkup(<LanguageProvider><EmployerBillingPage /></LanguageProvider>);
}

describe('EmployerBillingPage — plan availability', () => {
  it('marks a FREE plan as selectable and a not-yet-activated PAID plan as coming soon', () => {
    plans = [
      { id: 'p1', key: 'free', name: 'Free Listing', type: 'FREE', priceAmount: null, priceCurrency: null, durationDays: 30, isFeatured: false, available: true },
      { id: 'p2', key: 'premium', name: 'Premium Listing', type: 'PAID', priceAmount: 5000, priceCurrency: 'BDT', durationDays: 30, isFeatured: true, available: false },
    ];
    const markup = renderPage();
    expect(markup).toContain('Free Listing');
    expect(markup).toContain('Premium Listing');
    expect(markup).toContain('Coming soon');
    // The free plan's button must say "Select plan" and never claim a payment succeeded anywhere on the page.
    expect(markup).toContain('Select plan');
    expect(markup.toLowerCase()).not.toContain('payment successful');
    expect(markup.toLowerCase()).not.toContain('payment complete');
  });
});
