import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { BarChart3, FileText, Clock, CheckCircle, AlertTriangle, Eye, TrendingUp, MessageCircle, Megaphone } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  viewCount?: number;
  publishedAt?: string;
}

interface DashboardStats {
  publishedToday: number;
  drafts: number;
  inReview: number;
  approved: number;
  archived: number;
  scheduled: number;
  breaking: number;
  viewsToday: number;
  mostRead: Article[];
  myDrafts: DashboardArticle[];
  myAssigned: DashboardArticle[];
  recentlyUpdated: DashboardArticle[];
  recentlyPublished: DashboardArticle[];
  scheduledPublishing: DashboardArticle[];
  breakingActivity: BreakingActivity[];
}

interface DashboardArticle extends Article { status: string; updatedAt?: string; scheduledAt?: string; }
interface BreakingActivity { id: string; headline: string; isActive: boolean; updatedAt: string; }

interface EngagementStats {
  totalComments: number;
  activeAds: number;
  adImpressions: number;
  adClicks: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch('/articles/stats'),
  });
  const { data: engagement } = useQuery<EngagementStats>({
    queryKey: ['dashboard-engagement'],
    queryFn: () => apiFetch('/analytics/overview?days=1'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-6">
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Published Today', value: stats?.publishedToday ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Drafts', value: stats?.drafts ?? 0, icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'In Review', value: stats?.inReview ?? 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Archived', value: stats?.archived ?? 0, icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Scheduled', value: stats?.scheduled ?? 0, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Breaking News', value: stats?.breaking ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Views Today', value: stats?.viewsToday ?? 0, icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Approved Comments', value: engagement?.totalComments ?? 0, icon: MessageCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Active Ads', value: engagement?.activeAds ?? 0, icon: Megaphone, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary-500" />
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {stats && (
        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ArticlePanel title="My Drafts" articles={stats.myDrafts} />
          <ArticlePanel title="My Assigned Articles" articles={stats.myAssigned} />
          <ArticlePanel title="Recently Updated" articles={stats.recentlyUpdated} />
          <ArticlePanel title="Recently Published" articles={stats.recentlyPublished} />
          <ArticlePanel title="Scheduled Publishing" articles={stats.scheduledPublishing} />
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">Breaking News Activity</h2>
            <div className="mt-3 divide-y divide-gray-100">
              {stats.breakingActivity.length ? stats.breakingActivity.map((item) => (
                <a key={item.id} href="/breaking-news" className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary-600">
                  <span className="truncate">{item.headline}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.isActive ? 'Active' : 'Inactive'}</span>
                </a>
              )) : <p className="py-3 text-sm text-gray-500">No breaking-news activity.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats?.mostRead && stats.mostRead.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">Most Read Articles</h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.mostRead.map((article, idx) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <a href={`/articles/${article.id}/edit`} className="text-sm font-medium text-gray-900 hover:text-primary-500">
                        {article.title}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      {(article.viewCount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticlePanel({ title, articles }: { title: string; articles: DashboardArticle[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 divide-y divide-gray-100">
        {articles.length ? articles.map((article) => (
          <a key={article.id} href={`/articles/${article.id}/edit`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary-600">
            <span className="truncate">{article.title}</span>
            <span className="shrink-0 text-xs text-gray-500">{article.status}</span>
          </a>
        )) : <p className="py-3 text-sm text-gray-500">No articles.</p>}
      </div>
    </div>
  );
}
