import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
}

export default function AdsAuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ data: AuditEntry[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['ads-audit-log', page],
    queryFn: () => apiFetch(`/ad-campaigns/audit-log/all?page=${page}&limit=50`),
  });

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><History size={24} /> Ad Audit Log</h1>
      <p className="mt-1 text-sm text-gray-500">Every campaign and placement mutation across the advertisement platform, newest first.</p>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No audit entries yet</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['When', 'Action', 'Campaign', 'Actor', 'Note'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{entry.action.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2">{entry.campaign ? <Link to={`/ads/campaigns/${entry.campaign.id}`} className="text-primary-600 hover:underline">{entry.campaign.name}</Link> : <span className="text-gray-400">Placement-level</span>}</td>
                  <td className="px-4 py-2 text-gray-600">{entry.actor?.name ?? 'system'}</td>
                  <td className="px-4 py-2 text-gray-500">{entry.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} entries)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
