import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { JobCard, JobCardSkeleton, type JobCardJob } from './JobCard';
import { LanguageProvider } from '@/lib/i18n';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

const job: JobCardJob = {
  id: 'job-1',
  title: 'Senior Software Engineer',
  slug: 'senior-software-engineer-abc',
  summary: 'Build and ship reliable backend systems.',
  employmentType: 'FULL_TIME',
  workplaceType: 'HYBRID',
  salaryMin: 60000,
  salaryMax: 90000,
  salaryCurrency: 'BDT',
  deadline: '2026-12-01T00:00:00.000Z',
  featured: false,
  category: { id: 'cat-1', name: 'IT & Software', slug: 'it-software' },
  employer: { id: 'emp-1', name: 'Acme Ltd', slug: 'acme-ltd', logo: null },
  location: { id: 'loc-1', name: 'Dhaka', slug: 'dhaka' },
};

function render(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <LanguageProvider>{node}</LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('JobCard', () => {
  it('links to the job detail page by slug', () => {
    const markup = render(<JobCard job={job} />);
    expect(markup).toContain(`href="/jobs/${job.slug}"`);
  });

  it('renders title, employer, and salary range', () => {
    const markup = render(<JobCard job={job} />);
    expect(markup).toContain('Senior Software Engineer');
    expect(markup).toContain('Acme Ltd');
    expect(markup).toContain('BDT 60,000 - 90,000');
  });

  it('shows a Featured badge only when featured', () => {
    expect(render(<JobCard job={{ ...job, featured: true }} />)).toContain('Featured');
    expect(render(<JobCard job={job} />)).not.toContain('Featured');
  });

  it('falls back to a placeholder icon when the employer has no logo', () => {
    const markup = render(<JobCard job={job} />);
    expect(markup).not.toContain('<img');
  });

  it('renders an employer logo image when present', () => {
    const withLogo: JobCardJob = { ...job, employer: { ...job.employer!, logo: { publicUrl: 'https://cdn.example/logo.png' } } };
    const markup = render(<JobCard job={withLogo} />);
    expect(markup).toContain('https://cdn.example/logo.png');
  });

  it('compact variant renders a minimal single-line layout', () => {
    const markup = render(<JobCard job={job} variant="compact" />);
    expect(markup).toContain('Senior Software Engineer');
    expect(markup).toContain('Dhaka');
  });

  it('renders a skeleton for every variant without throwing', () => {
    expect(() => render(<JobCardSkeleton />)).not.toThrow();
    expect(() => render(<JobCardSkeleton variant="compact" />)).not.toThrow();
  });
});
