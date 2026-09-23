import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { localizedField } from '@/lib/localize';
import { buildSearchUrl } from '@/lib/search-url';
import { Menu, X, Search, AlertTriangle, UserRound, Bell, ChevronDown, LogOut } from 'lucide-react';
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
  { labelKey: 'nav.jobs', href: '/jobs' },
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

interface ReaderProfileSummary {
  name: string;
  readerProfile?: { avatar?: { publicUrl: string } | null } | null;
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const user = useReaderAuthStore((state) => state.user);
  const { code, t, pathFor } = useLanguage();
  const controlLabels = getHeaderControlLabels(searchOpen, mobileOpen);
  const link = (path: string) => pathFor(path, code);

  // Keyboard users expect Escape to dismiss an open panel without hunting for the toggle button again.
  useEffect(() => {
    if (!searchOpen && !mobileOpen && !accountOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobileOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, mobileOpen, accountOpen]);

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      useReaderAuthStore.getState().clearAuth();
      setAccountOpen(false);
      setMobileOpen(false);
      navigate(link('/'));
    }
  };

  const { data: breakingNews } = useQuery<BreakingArticle[]>({
    queryKey: ['breaking-news'],
    queryFn: () => apiFetch('/public/breaking-news'),
    refetchInterval: 300000,
  });

  const breakingCount = breakingNews?.length || 0;

  // Same queryKey as ReaderProfilePage's /reader/me fetch, so the two share one cached request instead of
  // the header firing a redundant call whenever the profile page is also mounted.
  const { data: profile } = useQuery<ReaderProfileSummary>({
    queryKey: ['reader-profile'],
    queryFn: () => apiFetch('/reader/me'),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const avatarUrl = profile?.readerProfile?.avatar?.publicUrl;
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

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

          {/* Nav + search + account cluster together on the right, instead of `justify-between` spreading
              three loose groups across the whole bar and leaving awkward empty gaps on wide screens. */}
          <div className="ml-auto flex items-center gap-4">
            <nav aria-label={t('header.primaryNav')} className="hidden items-center gap-1 xl:flex">
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

            {/* Always-visible search field on larger screens, so it reads as "type here to search" rather
                than a bare icon the reader has to guess at; collapses to the icon toggle below xl. */}
            <form onSubmit={handleSearch} className="hidden xl:block">
              <label htmlFor="site-search-inline" className="sr-only">{t('header.searchAria')}</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  id="site-search-inline"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.searchArticles')}
                  maxLength={200}
                  className="w-48 rounded-full border border-neutral-300 bg-neutral-50 py-2 pl-9 pr-3 text-sm transition-colors focus:w-64 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              <IconButton
                variant="default"
                size="md"
                aria-label={controlLabels.search}
                aria-expanded={searchOpen}
                aria-controls="site-search"
                onClick={() => setSearchOpen(!searchOpen)}
                className="xl:hidden"
              >
                <Search size={20} />
              </IconButton>
              <Link to={link('/employer')} className="hidden rounded px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 md:block">
                {t('nav.forEmployers')}
              </Link>
              {!user ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <Link to={link('/login')} className="rounded px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100">
                    {t('common.signIn')}
                  </Link>
                  <Link to={link('/register')} className="rounded bg-primary-500 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                    {t('auth.register')}
                  </Link>
                </div>
              ) : (
                <div className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-expanded={accountOpen}
                    aria-controls="reader-account-menu"
                    className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-3 text-sm font-semibold text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        {initial}
                      </span>
                    )}
                    <span className="max-w-32 truncate">{user.name}</span>
                    <ChevronDown size={15} className={`transition-transform duration-200 ${accountOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Kept mounted (not conditionally rendered) so opacity/scale can transition instead of
                      the menu just popping in and out. */}
                  <nav
                    id="reader-account-menu"
                    aria-label={t('common.account')}
                    hidden={!accountOpen}
                    className={`absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-lg border border-neutral-200 bg-white p-2 shadow-lg transition duration-150 ease-out ${
                      accountOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                    }`}
                  >
                    {[
                      ['/account', t('common.account')],
                      ['/account/profile', t('account.profile')],
                      ['/account/saved', t('account.savedArticles')],
                      ['/account/saved-jobs', t('jobs.savedJobs')],
                      ['/account/applications', t('jobs.myApplications')],
                      ['/account/settings', t('account.settings')],
                    ].map(([href, label]) => (
                      <Link key={href} to={link(href)} onClick={() => setAccountOpen(false)} className="block rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">{label}</Link>
                    ))}
                    <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                      <LogOut size={16} /> Logout
                    </button>
                  </nav>
                </div>
              )}
              {user && (
                <Link
                  to={link('/account/notifications')}
                  className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-200"
                  aria-label={t('common.notifications')}
                >
                  <Bell size={19} />
                </Link>
              )}

              <Link
                to={link(user ? '/account' : '/login')}
                className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-500 sm:hidden"
                aria-label={user ? t('common.account') : t('common.signIn')}
              >
                <UserRound size={19} />
              </Link>

              <IconButton
                variant="default"
                size="md"
                aria-label={controlLabels.menu}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="xl:hidden"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </IconButton>
            </div>
          </div>
        </div>

        <div id="site-search" hidden={!searchOpen} className="border-t border-neutral-100 py-3 xl:hidden">
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
          className="border-t border-neutral-100 py-3 xl:hidden"
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
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <Link to={link('/employer')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 font-semibold text-neutral-700">{t('nav.forEmployers')}</Link>
              {user ? (
                <>
                  <Link to={link('/account')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 font-semibold text-primary-600">{t('common.account')}</Link>
                  <Link to={link('/account/profile')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 text-neutral-700">{t('account.profile')}</Link>
                  <Link to={link('/account/saved')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 text-neutral-700">{t('account.savedArticles')}</Link>
                  <Link to={link('/account/saved-jobs')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 text-neutral-700">{t('jobs.savedJobs')}</Link>
                  <Link to={link('/account/applications')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 text-neutral-700">{t('jobs.myApplications')}</Link>
                  <Link to={link('/account/settings')} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2.5 text-neutral-700">{t('account.settings')}</Link>
                  <button type="button" onClick={logout} className="w-full rounded px-3 py-2.5 text-left font-semibold text-red-600">Logout</button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 px-3">
                  <Link to={link('/login')} onClick={() => setMobileOpen(false)} className="rounded border border-neutral-300 px-3 py-2 text-center font-semibold">{t('common.signIn')}</Link>
                  <Link to={link('/register')} onClick={() => setMobileOpen(false)} className="rounded bg-primary-500 px-3 py-2 text-center font-semibold text-white">{t('auth.register')}</Link>
                </div>
              )}
            </div>
        </nav>
      </div>
    </header>
  );
}
