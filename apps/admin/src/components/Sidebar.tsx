import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Image as ImageIcon, FolderOpen, Tag, MapPin, Users, Settings, MessageCircle, Megaphone, BarChart3, LayoutTemplate, Layers, Plus } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

const menuItems: Array<{ label: string; href: string; icon: typeof LayoutDashboard; permission?: string }> = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Articles', href: '/articles', icon: FileText },
  { label: 'Media', href: '/media', icon: ImageIcon },
  { label: 'Comments', href: '/comments', icon: MessageCircle },
  { label: 'Ads', href: '/ads', icon: Megaphone },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Homepage', href: '/homepage', icon: LayoutTemplate, permission: 'homepage.manage' },
  { label: 'Collections', href: '/collections', icon: Layers },
  { label: 'Categories', href: '/categories', icon: FolderOpen },
  { label: 'Tags', href: '/tags', icon: Tag },
  { label: 'Locations', href: '/locations', icon: MapPin },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  useAuthStore((state) => state.user); // re-render when the signed-in user (and so their permissions) changes

  return (
    <aside className="flex w-64 flex-col bg-sidebar-bg">
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold text-white">BD News Admin</span>
      </div>
      {hasPermission('article.create') && (
        <Link
          to="/articles/new"
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
    </aside>
  );
}
