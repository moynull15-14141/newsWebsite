import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { Briefcase, FileEdit, ClipboardCheck, CalendarClock, Globe, AlertTriangle, Archive, Users, Inbox, Plus, Building2, FolderKanban } from 'lucide-react';

interface DashboardStats {
  draft: number; inReview: number; approved: number; scheduled: number;
  published: number; expired: number; archived: number; expiringSoon: number;
  totalApplications: number; pendingApplications: number;
}

const STAT_TILES: Array<{ key: keyof DashboardStats; label: string; icon: typeof Briefcase; href: string; tone: string }> = [
  { key: 'draft', label: 'Drafts', icon: FileEdit, href: '/jobs/all?status=DRAFT', tone: 'text-gray-600' },
  { key: 'inReview', label: 'Awaiting Review', icon: ClipboardCheck, href: '/jobs/all?status=IN_REVIEW', tone: 'text-yellow-600' },
  { key: 'scheduled', label: 'Scheduled', icon: CalendarClock, href: '/jobs/all?status=SCHEDULED', tone: 'text-purple-600' },
  { key: 'published', label: 'Published', icon: Globe, href: '/jobs/all?status=PUBLISHED', tone: 'text-green-600' },
  { key: 'expiringSoon', label: 'Expiring Soon (7d)', icon: AlertTriangle, href: '/jobs/all?status=PUBLISHED', tone: 'text-orange-600' },
  { key: 'expired', label: 'Expired', icon: AlertTriangle, href: '/jobs/all?status=EXPIRED', tone: 'text-orange-700' },
  { key: 'archived', label: 'Archived', icon: Archive, href: '/jobs/all?status=ARCHIVED', tone: 'text-red-600' },
  { key: 'pendingApplications', label: 'Pending Applications', icon: Inbox, href: '/jobs/applications', tone: 'text-blue-600' },
];

export default function JobsDashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data, isLoading } = useQuery<DashboardStats>({ queryKey: ['jobs-dashboard'], queryFn: () => apiFetch('/jobs/dashboard') });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Briefcase size={24} /> Jobs</h1>
        <div className="flex gap-2">
          {hasPermission('job.create') && (
            <Link to="/jobs/new" className="inline-flex items-center gap-2 rounded-md border border-primary-500 bg-primary-500 px-4 py-2 text-sm font-bold text-black hover:bg-primary-600 hover:text-white">
              <Plus className="h-4 w-4" /> New Job
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/jobs/all" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Briefcase className="h-4 w-4" /> All Jobs
        </Link>
        {hasPermission('job.manage_categories') && (
          <Link to="/jobs/categories" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FolderKanban className="h-4 w-4" /> Categories
          </Link>
        )}
        {hasPermission('job.manage_employers') && (
          <Link to="/jobs/employers" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Building2 className="h-4 w-4" /> Employers
          </Link>
        )}
        {hasPermission('job_application.view') && (
          <Link to="/jobs/applications" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Users className="h-4 w-4" /> Applications
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data ? (
        <div className="mt-8 text-center text-gray-500">Could not load dashboard stats.</div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {STAT_TILES.map((tile) => (
            <Link key={tile.key} to={tile.href} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-primary-300 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <tile.icon className={`h-5 w-5 ${tile.tone}`} />
                <span className="text-2xl font-bold text-gray-900">{data[tile.key]}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">{tile.label}</p>
            </Link>
          ))}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="text-2xl font-bold text-gray-900">{data.totalApplications}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-600">Total Applications</p>
          </div>
        </div>
      )}
    </div>
  );
}
