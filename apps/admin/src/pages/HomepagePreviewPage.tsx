import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import ErrorAlert from '../homepage/ErrorAlert';
import PreviewCanvas, { type PreviewMode } from '../homepage/PreviewCanvas';
import { fetchPreview, homepageKeys } from '../homepage/draft-client';
import { ALGORITHMIC_NOTICE } from '../homepage/labels';
import { formatDate } from '../homepage/logic';

/**
 * Renders the DRAFT homepage from GET /homepage/draft/preview (protected, no-store). It never reads
 * /public/homepage and never writes anything, so opening it cannot change the draft or the live site.
 */
export default function HomepagePreviewPage() {
  const [mode, setMode] = useState<PreviewMode>('desktop');
  const { data, error, isLoading, isFetching, refetch } = useQuery({ queryKey: homepageKeys.preview, queryFn: fetchPreview, staleTime: 0, refetchOnWindowFocus: false });

  const toggle = (value: PreviewMode, label: string, Icon: typeof Monitor) => (
    <button
      key={value}
      type="button"
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${mode === value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  );

  return (
    <div>
      <div role="status" className="-mx-6 -mt-6 mb-4 flex flex-wrap items-center justify-center gap-x-3 bg-amber-400 px-6 py-2 text-sm font-bold text-gray-900">
        <span className="tracking-wide">DRAFT PREVIEW</span>
        <span className="font-medium">Not live until published</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/homepage" className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to builder
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Draft homepage preview</h1>
        </div>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Preview size" className="inline-flex overflow-hidden rounded border border-gray-300">
            {toggle('desktop', 'Desktop', Monitor)}
            {toggle('mobile', 'Mobile', Smartphone)}
          </div>
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {isLoading && <div className="h-96 animate-pulse rounded-md bg-gray-100" aria-label="Loading preview" />}
      {error && <ErrorAlert error={error} heading="The draft preview could not be loaded" />}

      {data && (
        <>
          <p className="mb-3 text-xs text-gray-500">
            Draft v{data.preview.version} · updated {formatDate(data.preview.updatedAt)} · {ALGORITHMIC_NOTICE}
            {data.preview.source === 'FALLBACK' && ' This draft has no visible sections, so the public homepage would use its automatic layout.'}
          </p>
          <div className="overflow-x-auto rounded-md bg-gray-200 p-4">
            <div className={`mx-auto overflow-hidden rounded-md border border-gray-300 shadow-sm ${mode === 'mobile' ? 'w-[390px]' : 'w-full max-w-[1180px]'}`} aria-label={`${mode} preview`}>
              <PreviewCanvas data={data} mode={mode} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
