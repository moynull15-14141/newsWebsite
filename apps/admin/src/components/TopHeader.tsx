import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { apiFetch } from '../lib/api';

export default function TopHeader({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout error
    }
    clearAuth();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'A';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center">
        <button type="button" onClick={onOpenNavigation} aria-label="Open navigation" className="mr-2 rounded p-2 text-gray-600 hover:bg-gray-100 md:hidden"><Menu className="h-5 w-5" /></button>
        <div className="hidden items-center sm:flex">
        <Search className="h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          className="ml-2 border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button className="relative rounded-md p-2 text-gray-400 hover:text-gray-600">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-medium text-white">
            {initials}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{user?.name || 'Admin'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md p-2 text-gray-400 hover:text-gray-600"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
