import { AlertTriangle } from 'lucide-react';
import { describeIssue } from './logic';
import type { Draft } from './types';

/** The server's validation result for the draft, shown prominently but compactly. */
export default function IssuesPanel({ draft }: { draft: Draft }) {
  if (!draft.issues.length) return null;
  return (
    <section aria-labelledby="issues-heading" className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <h2 id="issues-heading" className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {draft.issues.length} problem{draft.issues.length === 1 ? '' : 's'} must be fixed before this draft can be published
      </h2>
      <ul className="mt-2 space-y-1">
        {draft.issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.articleId ?? ''}-${issue.sectionKey ?? ''}-${index}`} className="flex flex-wrap items-baseline gap-x-2">
            <span>{describeIssue(issue, draft)}</span>
            {issue.sectionKey && (
              <a href={`#section-${issue.sectionKey}`} className="text-xs font-semibold text-red-800 underline">Go to section</a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
