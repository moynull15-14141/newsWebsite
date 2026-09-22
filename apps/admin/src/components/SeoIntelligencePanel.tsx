import { useMemo, useState } from 'react';
import { analyzeArticleSeo, type SeoAnalysis, type SeoArticleInput, type SeoCategory, type SeoStatus } from '@news-platform/seo';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, MinusCircle } from 'lucide-react';

const statusStyle: Record<SeoStatus, string> = { PASS: 'text-green-700 bg-green-50', WARNING: 'text-amber-800 bg-amber-50', ERROR: 'text-red-700 bg-red-50', NOT_APPLICABLE: 'text-gray-500 bg-gray-50' };
const statusIcon = { PASS: CheckCircle2, WARNING: AlertTriangle, ERROR: AlertCircle, NOT_APPLICABLE: MinusCircle };
const labels: Record<SeoCategory, string> = { content: 'Content SEO', technical: 'Technical SEO', readiness: 'Search / Answer Engine Readiness' };

interface Props extends SeoArticleInput {
  siteUrl?: string;
  serverAnalysis?: SeoAnalysis;
  onUseTitle: () => void;
  onUseExcerpt: () => void;
  onGenerateSlug: () => void;
}

export default function SeoIntelligencePanel({ siteUrl = 'http://localhost:5173', serverAnalysis, onUseTitle, onUseExcerpt, onGenerateSlug, ...input }: Props) {
  const local = useMemo(() => analyzeArticleSeo(input), [input]);
  const analysis = useMemo(() => {
    if (!serverAnalysis) return local;
    const duplicateIds = new Set(['duplicate-title', 'duplicate-slug', 'duplicate-description']);
    const checks = local.checks.map((item) => duplicateIds.has(item.id) ? serverAnalysis.checks.find((server) => server.id === item.id) || item : item);
    return analyzeArticleSeo({ ...input, duplicateTitle: checks.find((c) => c.id === 'duplicate-title')?.status === 'ERROR', duplicateSlug: checks.find((c) => c.id === 'duplicate-slug')?.status === 'ERROR', duplicateDescription: checks.find((c) => c.id === 'duplicate-description')?.status === 'WARNING' });
  }, [input, local, serverAnalysis]);
  const [preview, setPreview] = useState<'google' | 'facebook' | 'x'>('google');
  const title = String(input.seoTitle || input.title || 'Untitled article');
  const description = String(input.seoDescription || input.excerpt || 'Add a concise search description for this article.');
  const url = input.canonicalUrl || `${siteUrl.replace(/\/$/, '')}/article/${input.slug || 'article-slug'}`;

  return <section aria-labelledby="seo-intelligence-heading" className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="seo-intelligence-heading" className="text-base font-semibold text-gray-900">SEO Intelligence</h2><p className="mt-1 text-xs text-gray-500">Deterministic editorial guidance—not a ranking guarantee.</p></div>
      <div role="status" aria-label={`SEO score ${analysis.score} out of 100; completion ${analysis.completion} percent`} className="text-right"><p className="text-3xl font-bold text-gray-900">{analysis.score}<span className="text-base text-gray-500">/100</span></p><p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{analysis.grade.replace('_', ' ')}</p></div>
    </div>
    <div className="mt-4"><div className="flex justify-between text-xs"><span>SEO completion</span><span>{analysis.completion}%</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-gray-100"><div className="h-full bg-primary-500 transition-all" style={{ width: `${analysis.completion}%` }} /></div></div>
    <div className="mt-5 space-y-3">
      {(Object.keys(labels) as SeoCategory[]).map((category) => <details key={category} open className="group rounded border border-gray-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"><span>{labels[category]} <span className="text-xs font-normal text-gray-500">({analysis.categories[category].score}/100)</span></span><ChevronDown className="h-4 w-4 group-open:rotate-180" aria-hidden="true" /></summary>
        <ul className="border-t border-gray-100">
          {analysis.checks.filter((item) => item.category === category).map((item) => { const Icon = statusIcon[item.status]; return <li key={item.id} className="border-b border-gray-100 p-3 last:border-0">
            <div className="flex items-start gap-2"><span className={`mt-0.5 rounded p-1 ${statusStyle[item.status]}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-medium">{item.label} <span className="sr-only">{item.status}</span></p><p className="text-xs text-gray-600">{item.message}</p>{item.status !== 'PASS' && item.status !== 'NOT_APPLICABLE' && item.recommendation && <p className="mt-1 text-xs text-gray-800"><span className="font-semibold">Recommendation:</span> {item.recommendation}</p>}{item.target && item.status !== 'PASS' && <button type="button" onClick={() => document.getElementById(item.target!)?.focus()} className="mt-1 text-xs font-semibold text-primary-600 hover:underline">Go to field</button>}</div></div>
          </li>; })}
        </ul>
      </details>)}
    </div>
    <div className="mt-5 flex flex-wrap gap-2" aria-label="SEO quick fixes"><button type="button" onClick={onUseTitle} className="rounded border px-2.5 py-1.5 text-xs hover:bg-gray-50">Use article title</button><button type="button" onClick={onUseExcerpt} className="rounded border px-2.5 py-1.5 text-xs hover:bg-gray-50">Use excerpt</button><button type="button" onClick={onGenerateSlug} className="rounded border px-2.5 py-1.5 text-xs hover:bg-gray-50">Generate slug</button></div>
    <div className="mt-5 border-t pt-4"><div role="tablist" aria-label="Metadata previews" className="flex gap-1">{(['google', 'facebook', 'x'] as const).map((name) => <button key={name} role="tab" aria-selected={preview === name} onClick={() => setPreview(name)} className={`rounded px-3 py-1.5 text-xs font-medium ${preview === name ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{name === 'google' ? 'Google' : name === 'facebook' ? 'Facebook / OG' : 'X / Twitter'}</button>)}</div>
      {preview === 'google' ? <div className="mt-3 rounded border p-4"><p className="truncate text-xs text-green-800">{url}</p><p className="mt-1 line-clamp-1 text-xl text-blue-800">{title}</p><p className="mt-1 line-clamp-2 text-sm text-gray-600">{description}</p></div> : <div className="mt-3 overflow-hidden rounded-xl border bg-white"><div className="flex aspect-[1.91/1] items-center justify-center bg-gray-100 text-xs text-gray-500">{input.featuredImageUrl ? <img src={input.featuredImageUrl} alt="" className="h-full w-full object-cover" /> : 'Social image preview'}</div><div className="p-3"><p className="text-xs uppercase text-gray-500">{new URL(url, siteUrl).hostname}</p><p className="line-clamp-2 font-semibold">{title}</p><p className="line-clamp-2 text-sm text-gray-600">{description}</p></div></div>}
    </div>
  </section>;
}
