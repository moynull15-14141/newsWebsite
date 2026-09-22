import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { localizedField } from '@/lib/localize';
import { buildSearchUrl } from '@/lib/search-url';
import { Menu, X, Search, AlertTriangle, UserRound, Bell } from 'lucide-react';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { getHeaderControlLabels } from './header-controls';
import { useLanguage } from '@/lib/i18n';

/**
 * Two entries are structurally special, not categories: "Latest" is the unfiltered published feed and
 * has no taxonomy row at all; "Bangladesh" is a Location (the country), not the like-named Category —
 * `/bangladesh` is richer (it aggregates every location under it) than the Bangladesh category tag would
 * be, so the nav deliberately points there. Both are fixed; everything else is real category data below.
 */
const FIXED_NAV = [
  { labelKey: 'common.latest', href: '/latest' },
  { labelKey: 'nav.bangladesh', href: '/bangladesh' },
] as const;

/** Nav item count from real categories, capped so the desktop bar never overflows (Part 16). Editors
 *  already control which categories lead via `sortOrder` (see CategoriesPage); this just respects it. */
const MAX_CATEGORY_NAV_ITEMS = 6;

interface NavCategory {
  id: string;
  name: string;
  slug: string;
  translations?: { language?: { code: string } | null; name: string }[];
}

interface BreakingArticle {
  id: string;
  title: string;
  slug: string;
}

/** Reader-facing "বাংলা | English" toggle. A real <Link> to the equivalent page in the other language — crawlable, works without JS, and never loses the reader's place. */
function LanguageSwitcher() {
  const location = useLocation();
  const { code, languages, pathFor, t } = useLanguage();

  if (languages.length < 2) return null;

  return (
    <nav aria-label="Language" className="flex items-center gap-1 text-sm">
      {languages.map((lang, index) => (
        <span key={lang.code} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="text-neutral-300">|</span>}
          {lang.code === code ? (
            <span aria-current="true" className="px-1 font-semibold text-primary-600">{lang.nativeName}</span>
          ) : (
            <Link
              to={`${pathFor(location.pathname, lang.code)}${location.search}`}
              lang={lang.code}
              title={t('language.switchTo', { language: lang.nativeName })}
              className="px-1 text-neutral-500 transition-colors hover:text-primary-500"
            >
              {lang.nativeName}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const user = useReaderAuthStore((state) => state.user);
  const { code, t, pathFor } = useLanguage();
  const controlLabels = getHeaderControlLabels(searchOpen, mobileOpen);
  const link = (path: string) => pathFor(path, code);

  const { data: breakingNews } = useQuery<BreakingArticle[]>({
    queryKey: ['breaking-news'],
    queryFn: () => apiFetch('/public/breaking-news'),
    refetchInterval: 300000,
  });

  const breakingCount = breakingNews?.length || 0;

  // Real taxonomy, not a hardcoded list — GET /categories is already public and sortOrder-ordered
  // (editors control that order in the Admin Categories page), so the nav follows editorial curation.
  const { data: categories } = useQuery<NavCategory[]>({
    queryKey: ['nav-categories'],
    queryFn: () => apiFetch('/categories'),
    staleTime: 5 * 60_000,
  });

  const navItems = [
    ...FIXED_NAV.map((item) => ({ href: item.href, label: t(item.labelKey) })),
    ...(categories ?? [])
      .filter((category) => category.slug !== 'bangladesh') // covered by the fixed Bangladesh (location) entry above
      .slice(0, MAX_CATEGORY_NAV_ITEMS)
      .map((category) => ({ href: `/category/${category.slug}`, label: localizedField(category.name, category.translations, code, 'name') ?? category.name })),
  ];

  const isActiveNavPath = (href: string) => {
    const target = link(href);
    return location.pathname === target || location.pathname === `${target}/`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = buildSearchUrl(link('/search'), searchQuery);
    if (target) {
      navigate(target);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
      <div className="container-wide">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-1.5 text-xs">
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between py-3 lg:py-4">
          <Link to={link('/')} className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-primary-500 lg:text-2xl">
              {t('header.siteName')}
            </span>
            {breakingCount > 0 && (
              <span className="relative flex h-5 w-5 items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-error-500" />
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-error-500 text-[9px] font-bold text-white">
                  {breakingCount}
                </span>
              </span>
            )}
          </Link>

          <nav aria-label={t('header.primaryNav')} className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={link(item.href)}
                aria-current={isActiveNavPath(item.href) ? 'page' : undefined}
                className={`nav rounded px-3 py-2 transition-colors hover:bg-neutral-100 hover:text-primary-500 ${isActiveNavPath(item.href) ? 'font-semibold text-primary-600' : 'text-neutral-700'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <IconButton
              variant="default"
              size="md"
              aria-label={controlLabels.search}
              aria-expanded={searchOpen}
              aria-controls="site-search"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search size={20} />
            </IconButton>
            <Link
              to={link(user ? '/account' : '/login')}
              className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-200"
              aria-label={user ? t('common.account') : t('common.signIn')}
            >
              <UserRound size={19} />
            </Link>
            {user && (
              <Link
                to={link('/account/notifications')}
                className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-200"
                aria-label={t('common.notifications')}
              >
                <Bell size={19} />
              </Link>
            )}

            <IconButton
              variant="default"
              size="md"
              aria-label={controlLabels.menu}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </IconButton>
          </div>
        </div>

        <div id="site-search" hidden={!searchOpen} className="border-t border-neutral-100 py-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.searchArticles')}
                aria-label={t('header.searchAria')}
                maxLength={200}
                autoFocus={searchOpen}
                className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <Button type="submit" variant="primary" size="sm">
                {t('common.search')}
              </Button>
            </form>
        </div>

        <nav
          id="mobile-navigation"
          aria-label={t('header.primaryNav')}
          hidden={!mobileOpen}
          className="border-t border-neutral-100 py-3 lg:hidden"
        >
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={link(item.href)}
                onClick={() => setMobileOpen(false)}
                aria-current={isActiveNavPath(item.href) ? 'page' : undefined}
                className={`nav block px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-primary-500 ${isActiveNavPath(item.href) ? 'font-semibold text-primary-600' : 'text-neutral-700'}`}
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
