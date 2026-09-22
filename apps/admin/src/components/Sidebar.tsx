import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Image as ImageIcon, FolderOpen, Tag, MapPin, Users, Settings, MessageCircle, Megaphone, BarChart3, LayoutTemplate, Layers, Plus, Globe2, SearchCheck, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

const menuItems: Array<{ label: string; href: string; icon: typeof LayoutDashboard; permission?: string }> = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Articles', href: '/articles', icon: FileText },
  { label: 'Media', href: '/media', icon: ImageIcon },
  { label: 'Comments', href: '/comments', icon: MessageCircle },
  { label: 'Ads', href: '/ads', icon: Megaphone },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'SEO Intelligence', href: '/seo', icon: SearchCheck, permission: 'analytics.view' },
  { label: 'Homepage', href: '/homepage', icon: LayoutTemplate, permission: 'homepage.manage' },
  { label: 'Collections', href: '/collections', icon: Layers },
  { label: 'Categories', href: '/categories', icon: FolderOpen },
  { label: 'Tags', href: '/tags', icon: Tag },
  { label: 'Locations', href: '/locations', icon: MapPin },
  { label: 'Languages', href: '/languages', icon: Globe2, permission: 'settings.manage' },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  useAuthStore((state) => state.user); // re-render when the signed-in user (and so their permissions) changes

  return (
    <><button type="button" aria-label="Close navigation overlay" onClick={onClose} className={`fixed inset-0 z-30 bg-black/40 md:hidden ${open ? 'block' : 'hidden'}`} />
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
      <nav className="flex-1 space-y-1 px-3 py-4">
        {menuItems.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href === '/articles' && location.pathname.startsWith('/articles/')) ||
            (item.href === '/homepage' && location.pathname.startsWith('/homepage/'));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-active text-sidebar-text-active'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside></>
  );
}
