import { Link } from 'react-router-dom';
import { AlertOctagon, CheckCircle2, CircleDot, Eye, Loader2, Upload } from 'lucide-react';
import type { ApiError } from '../lib/api-error';
import ConflictBanner from './ConflictBanner';
import { formatDate, publishState, type PublishTone } from './logic';
import type { ActiveConfiguration, Draft } from './types';

const toneClasses: Record<PublishTone, string> = {
  ok: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
};
const toneIcons: Record<PublishTone, typeof CheckCircle2> = { ok: CheckCircle2, warning: CircleDot, danger: AlertOctagon, neutral: CircleDot };

const blockedText = {
  conflict: 'Reload the latest draft before publishing.',
  issues: 'Fix the validation issues before publishing.',
  'no-changes': 'There are no unpublished changes to publish.',
  busy: 'A change is still being saved.',
  ready: '',
} as const;

interface StatusBarProps {
  draft: Draft;
  active?: ActiveConfiguration;
  pending: string | null;
  /** Set after a 409: the banner is rendered here, inside the sticky bar, so it stays in view while scrolled. */
  conflict: ApiError | null;
  onReload: () => void;
  onPublish: () => void;
}

/** Top of the workspace: where the editor stands (draft vs live) and the two primary actions. */
export default function StatusBar({ draft, active, pending, conflict, onReload, onPublish }: StatusBarProps) {
  const state = publishState(draft, { pending: !!pending, conflict: !!conflict });
  const Icon = toneIcons[state.tone];

  return (
    <section aria-label="Draft status" className="sticky top-0 z-20 -mx-6 -mt-6 mb-5 border-b border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-bold text-gray-900">Homepage Builder</h1>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">Editing draft</span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClasses[state.tone]}`} role="status">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {state.label}
          </span>
          {pending && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500" aria-live="polite">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> {pending}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/homepage/preview" className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Eye className="h-4 w-4" aria-hidden="true" /> Preview draft
          </Link>
          <button
            type="button"
            onClick={onPublish}
            disabled={!state.canPublish}
            aria-describedby="publish-hint"
            className="inline-flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload className="h-4 w-4" aria-hidden="true" /> Publish homepage
          </button>
          <span id="publish-hint" className="sr-only">{state.canPublish ? 'Publishes the draft homepage.' : blockedText[state.reason]}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Draft v{draft.version} · {active?.publishedAt ? `Live: published ${formatDate(active.publishedAt)} (v${active.version})` : 'Nothing has been published from the builder yet'} · Changes stay in the draft until you publish.
      </p>
      {conflict && <ConflictBanner conflict={conflict} busy={false} onReload={onReload} />}
    </section>
  );
}
