import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import ToastProvider from '../components/Toaster';

export default function AdminLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader onOpenNavigation={() => setNavigationOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}
