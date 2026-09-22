import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { localizedField } from '@/lib/localize';
import { useLanguage } from '@/lib/i18n';

/** "Bangladesh" here is the Location (country), not the like-named Category — see Header.tsx. */
const FIXED_QUICK_LINKS = [{ labelKey: 'common.latest', href: '/latest' }, { labelKey: 'nav.bangladesh', href: '/bangladesh' }] as const;
const MAX_CATEGORY_QUICK_LINKS = 3;

interface NavCategory {
  id: string;
  name: string;
  slug: string;
  translations?: { language?: { code: string } | null; name: string }[];
}

export default function Footer() {
  const { code, t, pathFor } = useLanguage();

  // Same query key as Header's nav fetch — one shared cache entry, not a second request (Part 17).
  const { data: categories } = useQuery<NavCategory[]>({
    queryKey: ['nav-categories'],
    queryFn: () => apiFetch('/categories'),
    staleTime: 5 * 60_000,
  });

  const quickLinks = [
    ...FIXED_QUICK_LINKS.map((item) => ({ href: item.href, label: t(item.labelKey) })),
    ...(categories ?? [])
      .filter((category) => category.slug !== 'bangladesh')
      .slice(0, MAX_CATEGORY_QUICK_LINKS)
      .map((category) => ({ href: `/category/${category.slug}`, label: localizedField(category.name, category.translations, code, 'name') ?? category.name })),
  ];

  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="container-wide py-12 lg:py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link to={pathFor('/', code)} className="text-xl font-bold text-white">
              {t('header.siteName')}
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={pathFor(link.href, code)}
                    className="text-sm text-neutral-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.about')}
            </h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t('footer.aboutText')}
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} {t('header.siteName')}. {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
}
