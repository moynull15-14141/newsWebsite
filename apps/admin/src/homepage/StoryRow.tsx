import { ArrowDown, ArrowLeftRight, ArrowUp, X } from 'lucide-react';
import Thumb from './Thumb';
import { canMove, contentLang, formatDate } from './logic';
import { STORY_STATUS_LABELS } from './labels';
import type { Placement } from './types';

interface StoryRowProps {
  placement: Placement;
  index: number;
  count: number;
  /** Used only to make button names unambiguous, e.g. “Move “X” up in “Latest””. */
  sectionTitle: string;
  disabled: boolean;
  onMove: (delta: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
}

const iconButton = 'rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

/** One placed story: position, thumbnail, headline, category, date, and keyboard-accessible controls. */
export default function StoryRow({ placement, index, count, sectionTitle, disabled, onMove, onReplace, onRemove }: StoryRowProps) {
  const { article } = placement;
  const focusBase = `story-${placement.articleId}`;
  const meta = [article.category?.name, article.author?.name, formatDate(article.publishedAt)].filter(Boolean).join(' · ');

  return (
    <li className={`flex items-center gap-3 px-3 py-2 ${placement.eligible ? '' : 'bg-red-50'}`} data-row={placement.articleId}>
      <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-gray-400" aria-hidden="true">{index + 1}</span>
      <Thumb url={article.media?.publicUrl} />
      <div className="min-w-0 flex-1">
        <p lang={contentLang(article.title)} className="truncate text-sm font-medium text-gray-900" title={article.title}>{article.title}</p>
        <p className="truncate text-xs text-gray-500">
          {meta}
          {!placement.eligible && (
            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
              {STORY_STATUS_LABELS[article.status] ?? article.status} — not eligible for the homepage
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <button type="button" className={iconButton} disabled={disabled || !canMove(index, count, -1)} onClick={() => onMove(-1)} title="Move up" aria-label={`Move “${article.title}” up in “${sectionTitle}” (now position ${index + 1} of ${count})`} data-focus-id={`${focusBase}-up`}>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={iconButton} disabled={disabled || !canMove(index, count, 1)} onClick={() => onMove(1)} title="Move down" aria-label={`Move “${article.title}” down in “${sectionTitle}” (now position ${index + 1} of ${count})`} data-focus-id={`${focusBase}-down`}>
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={iconButton} disabled={disabled} onClick={onReplace} title="Replace story" aria-label={`Replace “${article.title}” in “${sectionTitle}”`}>
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={`${iconButton} hover:text-red-700`} disabled={disabled} onClick={onRemove} title="Remove from section" aria-label={`Remove “${article.title}” from “${sectionTitle}”`}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
