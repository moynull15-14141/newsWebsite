import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Menu, X, Search, AlertTriangle, UserRound, Bell } from 'lucide-react';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { getHeaderControlLabels } from './header-controls';

const navItems = [
  { label: 'Bangladesh', href: '/bangladesh' },
  { label: 'World', href: '/category/world' },
  { label: 'Politics', href: '/category/politics' },
  { label: 'Business', href: '/category/business' },
  { label: 'Sports', href: '/category/sports' },
  { label: 'Technology', href: '/category/technology' },
  { label: 'Entertainment', href: '/category/entertainment' },
];

interface BreakingArticle {
  id: string;
  title: string;
  slug: string;
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const user = useReaderAuthStore((state) => state.user);
  const controlLabels = getHeaderControlLabels(searchOpen, mobileOpen);

  const { data: breakingNews } = useQuery<BreakingArticle[]>({
    queryKey: ['breaking-news'],
    queryFn: () => apiFetch('/public/breaking-news'),
    refetchInterval: 300000,
  });

  const breakingCount = breakingNews?.length || 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
      <div className="container-wide">
        <div className="flex items-center justify-between py-3 lg:py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-primary-500 lg:text-2xl">
              BD News
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

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="nav rounded px-3 py-2 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-primary-500"
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
              to={user ? '/account' : '/login'}
              className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-200"
              aria-label={user ? 'Account' : 'Sign in'}
            >
              <UserRound size={19} />
            </Link>
            {user && (
              <Link
                to="/account/notifications"
                className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-200"
                aria-label="Notifications"
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
                placeholder="Search articles..."
                aria-label="Search articles"
                autoFocus={searchOpen}
                className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <Button type="submit" variant="primary" size="sm">
                Search
              </Button>
            </form>
        </div>

        <nav
          id="mobile-navigation"
          hidden={!mobileOpen}
          className="border-t border-neutral-100 py-3 lg:hidden"
        >
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className="nav block px-3 py-2.5 text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-primary-500"
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
