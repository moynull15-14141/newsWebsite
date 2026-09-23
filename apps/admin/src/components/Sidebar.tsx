import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardCheck, Image as ImageIcon, FolderOpen, Tag, MapPin, Users, Settings,
  MessageCircle, Megaphone, BarChart3, LayoutTemplate, Layers, Plus, Globe2, SearchCheck, X, Radio, Briefcase,
  FolderKanban, Building2, Settings2, ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

interface MenuItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  /** Also highlight this item while on a nested route, e.g. /articles/:id/edit under /articles. */
  matchPrefix?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const dashboardItem: MenuItem = { label: 'Dashboard', href: '/', icon: LayoutDashboard };

/** 21 flat links were a wall of text — grouped by task so the sidebar reads as 5 short sections instead. */
const menuGroups: MenuGroup[] = [
  {
    label: 'Content',
    items: [
      { label: 'Articles', href: '/articles', icon: FileText, matchPrefix: '/articles' },
      { label: 'Review Queue', href: '/review', icon: ClipboardCheck, permission: 'article.review' },
      { label: 'Media', href: '/media', icon: ImageIcon },
      { label: 'Comments', href: '/comments', icon: MessageCircle },
      { label: 'Collections', href: '/collections', icon: Layers },
    ],
  },
  {
    label: 'Jobs',
    items: [
      { label: 'Jobs', href: '/jobs', icon: Briefcase, permission: 'job.read' },
      { label: 'Job Categories', href: '/jobs/categories', icon: FolderKanban, permission: 'job.manage_categories' },
      { label: 'Employers', href: '/jobs/employers', icon: Building2, permission: 'job.manage_employers' },
      { label: 'Job Applications', href: '/jobs/applications', icon: Users, permission: 'job_application.view' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Ads', href: '/ads', icon: Megaphone },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'SEO Intelligence', href: '/seo', icon: SearchCheck, permission: 'analytics.view' },
    ],
  },
  {
    label: 'Site',
    items: [
      { label: 'Homepage', href: '/homepage', icon: LayoutTemplate, permission: 'homepage.manage', matchPrefix: '/homepage' },
      { label: 'Breaking News', href: '/breaking-news', icon: Radio, permission: 'breaking_news.manage' },
      { label: 'Categories', href: '/categories', icon: FolderOpen },
      { label: 'Tags', href: '/tags', icon: Tag },
      { label: 'Locations', href: '/locations', icon: MapPin },
      { label: 'Languages', href: '/languages', icon: Globe2, permission: 'settings.manage' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Platform Settings', href: '/settings/platform', icon: Settings2, permission: 'platform.settings.view' },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

function isItemActive(item: MenuItem, pathname: string) {
  return pathname === item.href || (item.matchPrefix ? pathname.startsWith(`${item.matchPrefix}/`) : false);
}

function NavItem({ item, onClick, isActive }: { item: MenuItem; onClick?: () => void; isActive: boolean }) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? 'bg-sidebar-active text-sidebar-text-active' : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
      }`}
    >
      <item.icon className="mr-3 h-5 w-5 shrink-0" />
      {item.label}
    </Link>
  );
}

function NavGroup({
  group, pathname, onItemClick, defaultOpen,
}: {
  group: MenuGroup;
  pathname: string;
  onItemClick?: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const groupHasActiveItem = group.items.some((item) => isItemActive(item, pathname));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-text/70 transition-colors hover:text-white"
      >
        <span className={groupHasActiveItem ? 'text-white' : undefined}>{group.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-out ${open ? 'rotate-180' : 'rotate-0'}`} />
      </button>
      {/* grid-rows 0fr/1fr trick: animates to/from auto height smoothly without measuring pixels. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-1 pb-1 pt-1">
            {group.items.map((item) => (
              <NavItem key={item.href} item={item} onClick={onItemClick} isActive={isItemActive(item, pathname)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  useAuthStore((state) => state.user); // re-render when the signed-in user (and so their permissions) changes

  const visibleGroups = menuGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || hasPermission(item.permission)) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <button type="button" aria-label="Close navigation overlay" onClick={onClose} className={`fixed inset-0 z-30 bg-black/40 md:hidden ${open ? 'block' : 'hidden'}`} />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto bg-sidebar-bg transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center justify-between px-6">
          <span className="text-xl font-bold text-white">BD News Admin</span>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded p-1 text-sidebar-text hover:text-white md:hidden"><X className="h-5 w-5" /></button>
        </div>
        {hasPermission('article.create') && (
          <Link
            to="/articles/new"
            onClick={onClose}
            className="mx-3 inline-flex items-center justify-center gap-2 rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            New Article
          </Link>
        )}
        <nav className="flex-1 space-y-2 px-3 py-4">
          <NavItem item={dashboardItem} onClick={onClose} isActive={location.pathname === '/'} />
          <div className="my-2 border-t border-white/10" />
          {visibleGroups.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              pathname={location.pathname}
              onItemClick={onClose}
              defaultOpen={group.items.some((item) => isItemActive(item, location.pathname))}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
