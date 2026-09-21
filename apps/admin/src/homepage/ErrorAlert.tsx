import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isApiError, isDraftConflict } from '../lib/api-error';
import { describeIssue } from './logic';
import type { Draft } from './types';

interface ErrorAlertProps {
  error: unknown;
  /** Used to name sections/stories in issue sentences. */
  draft?: Draft;
  /** Titles of articles that are not in the draft yet (e.g. a rejected picker selection). */
  articleTitles?: Record<string, string>;
  heading?: string;
  /** When given, a version conflict offers "Reload latest draft". */
  onReload?: () => void;
  onDismiss?: () => void;
}

/**
 * Shows a failed request without collapsing it to "Something went wrong": conflicts get the reload
 * explanation, structured `issues` are listed in editor language, anything else shows the server message.
 */
export default function ErrorAlert({ error, draft, articleTitles, heading, onReload, onDismiss }: ErrorAlertProps) {
  const conflict = isDraftConflict(error);
  const issues = isApiError(error) ? error.issues : [];
  const message = error instanceof Error ? error.message : 'The request failed.';

  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {heading && <p className="font-semibold">{heading}</p>}
          {conflict ? (
            <p>The homepage draft changed since you loaded it. Nothing was overwritten — reload the latest draft, then repeat your change.</p>
          ) : (
            <p>{message}</p>
          )}
          {!conflict && issues.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.articleId ?? issue.sectionKey ?? ''}-${index}`}>{describeIssue(issue, draft, articleTitles)}</li>
              ))}
            </ul>
          )}
        </div>
        {conflict && onReload && (
          <button type="button" onClick={onReload} className="inline-flex shrink-0 items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100">
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Reload latest draft
          </button>
        )}
        {!conflict && onDismiss && (
          <button type="button" onClick={onDismiss} className="shrink-0 rounded px-1.5 text-xs font-semibold text-red-800 hover:bg-red-100">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
