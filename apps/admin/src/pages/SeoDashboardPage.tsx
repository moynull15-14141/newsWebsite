import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle2, SearchCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface SiteHealth { score: number; completion: number; analyzedArticles: number; distribution: { excellent: number; good: number; needsAttention: number; critical: number }; issues: { id: string; label: string; severity: 'ERROR' | 'WARNING'; affected: number; recommendation?: string }[]; technical: Record<string, boolean | number>; generatedAt: string; limited: boolean }

export default function SeoDashboardPage() {
  const { data, isLoading, error } = useQuery<SiteHealth>({ queryKey: ['seo-health'], queryFn: () => apiFetch('/seo/health'), staleTime: 60_000 });
  if (isLoading) return <p role="status" className="text-gray-500">Analyzing site SEO…</p>;
  if (error || !data) return <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">SEO health could not be loaded.</p>;
  const distribution = [['Excellent', data.distribution.excellent], ['Good', data.distribution.good], ['Needs attention', data.distribution.needsAttention], ['Critical', data.distribution.critical]] as const;
  return <main><div className="flex items-center gap-3"><SearchCheck className="h-7 w-7 text-primary-600" /><div><h1 className="text-2xl font-bold">SEO Intelligence Center</h1><p className="text-sm text-gray-500">Actual analysis of {data.analyzedArticles} non-archived articles.</p></div></div>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border bg-white p-5 sm:col-span-2"><p className="text-sm text-gray-500">Overall site health</p><p className="mt-2 text-5xl font-bold">{data.score}<span className="text-lg text-gray-500">/100</span></p><p className="mt-2 text-sm">Completion: {data.completion}%</p></div>{distribution.map(([label, count]) => <div key={label} className="rounded-lg border bg-white p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-3xl font-bold">{count}</p></div>)}</section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-lg border bg-white p-5"><h2 className="text-lg font-semibold">Top issues</h2>{data.issues.length ? <ul className="mt-3 divide-y">{data.issues.map((item) => <li key={item.id} className="flex gap-3 py-3">{item.severity === 'ERROR' ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}<div><p className="font-medium">{item.affected} article{item.affected === 1 ? '' : 's'}: {item.label}</p>{item.recommendation && <p className="text-sm text-gray-600">{item.recommendation}</p>}</div></li>)}</ul> : <p className="mt-3 text-sm text-gray-600">No current warnings or errors.</p>}</section>
      <section className="rounded-lg border bg-white p-5"><h2 className="text-lg font-semibold">Technical readiness</h2><ul className="mt-3 space-y-3">{Object.entries(data.technical).map(([key, value]) => <li key={key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" />{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span><span className="font-semibold">{typeof value === 'boolean' ? value ? 'Ready' : 'Needs attention' : value}</span></li>)}</ul></section></div>
    <p className="mt-4 text-xs text-gray-500">Generated {new Date(data.generatedAt).toLocaleString()}{data.limited ? ' · Analysis capped at the newest 2,000 articles.' : ''}</p>
  </main>;
}
