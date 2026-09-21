import { RefreshCw } from 'lucide-react';
import type { ApiError } from '../lib/api-error';

/**
 * Shown after a 409 HOMEPAGE_DRAFT_CONFLICT. Editing is locked until the editor reloads: nothing is retried
 * and nothing overwrites the other editor's work.
 */
export default function ConflictBanner({ conflict, busy, onReload }: { conflict: ApiError; busy: boolean; onReload: () => void }) {
  return (
    <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <div>
        <p className="font-semibold">The homepage draft changed since you loaded it.</p>
        <p className="mt-0.5">
          Someone else saved changes
          {conflict.currentVersion != null && conflict.expectedVersion != null ? ` (you had v${conflict.expectedVersion}, the latest is v${conflict.currentVersion})` : ''}. Your last change was not applied, and editing is paused so no
          one's work is overwritten.
        </p>
      </div>
      <button type="button" onClick={onReload} disabled={busy} className="inline-flex items-center gap-1.5 rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload latest draft
      </button>
    </div>
  );
}
