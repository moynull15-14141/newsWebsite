import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Megaphone, Clock, ShieldCheck, LayoutGrid, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  advertiser: { id: string; name: string };
}

interface Overview {
  activeCampaigns: number;
  scheduledCampaigns: number;
  pendingApproval: number;
  activePlacements: number;
  totalPlacements: number;
  recentCampaigns: CampaignRow[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  EXPIRED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

function StatCard({ icon: Icon, label, value, href }: { icon: typeof Megaphone; label: string; value: number; href: string }) {
  return (
    <Link to={href} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-300">
      <div className="rounded-full bg-primary-50 p-3 text-primary-600"><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </Link>
  );
}

export default function AdsOverviewPage() {
  const { data, isLoading } = useQuery<Overview>({ queryKey: ['ads-overview'], queryFn: () => apiFetch('/ad-campaigns/overview') });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Megaphone size={24} /> Advertisement Platform</h1>
          <p className="mt-1 text-sm text-gray-500">Advertisers, campaigns, creatives and the controlled placement inventory.</p>
        </div>
        <Link to="/ads/campaigns" className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
          Manage campaigns <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Megaphone} label="Active campaigns" value={data.activeCampaigns} href="/ads/campaigns?status=ACTIVE" />
            <StatCard icon={Clock} label="Scheduled campaigns" value={data.scheduledCampaigns} href="/ads/campaigns?status=SCHEDULED" />
            <StatCard icon={ShieldCheck} label="Pending approval" value={data.pendingApproval} href="/ads/campaigns?status=PENDING_REVIEW" />
            <StatCard icon={LayoutGrid} label={`Active placements (of ${data.totalPlacements})`} value={data.activePlacements} href="/ads/placements" />
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent campaigns</h2>
            </div>
            {!data.recentCampaigns.length ? (
              <p className="p-5 text-sm text-gray-500">No campaigns yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Campaign', 'Advertiser', 'Status', 'Schedule'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.recentCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><Link to={`/ads/campaigns/${c.id}`} className="font-medium text-primary-600 hover:underline">{c.name}</Link></td>
                      <td className="px-4 py-3 text-gray-600">{c.advertiser.name}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[c.status] || ''}`}>{c.status.replace('_', ' ')}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {c.startAt ? new Date(c.startAt).toLocaleDateString() : 'Not set'} – {c.endAt ? new Date(c.endAt).toLocaleDateString() : 'Open'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
