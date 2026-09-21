import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import StoryRow from './StoryRow';
import { canMove, describeIssue, sectionDisplayTitle } from './logic';
import { layoutMeta, sectionTypeLabel } from './labels';
import type { ApiIssue } from '../lib/api-error';
import type { Draft, DraftSection } from './types';

interface SectionCardProps {
  section: DraftSection;
  draft: Draft;
  /** Position among the listed (non-Hero) sections. */
  index: number;
  total: number;
  issues: ApiIssue[];
  disabled: boolean;
  onMove: (delta: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddStories: () => void;
  onMoveStory: (index: number, delta: -1 | 1) => void;
  onReplaceStory: (index: number) => void;
  onRemoveStory: (index: number) => void;
}

const iconButton = 'rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

/** One homepage section: metadata, ordering controls and its ordered stories. */
export default function SectionCard({ section, draft, index, total, issues, disabled, onMove, onToggle, onEdit, onDelete, onAddStories, onMoveStory, onReplaceStory, onRemoveStory }: SectionCardProps) {
  const title = sectionDisplayTitle(section);
  const full = section.placements.length >= section.maxItems;
  const hidden = !section.enabled;

  return (
    <article id={`section-${section.key}`} aria-labelledby={`title-${section.id}`} className={`overflow-hidden rounded-md border bg-white ${issues.length ? 'border-red-300' : 'border-gray-200'} ${hidden ? 'opacity-80' : ''}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex flex-col">
          <button type="button" className={`${iconButton} p-0.5`} disabled={disabled || !canMove(index, total, -1)} onClick={() => onMove(-1)} title="Move section up" aria-label={`Move section “${title}” up (now position ${index + 1} of ${total})`} data-focus-id={`section-${section.id}-up`}>
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={`${iconButton} p-0.5`} disabled={disabled || !canMove(index, total, 1)} onClick={() => onMove(1)} title="Move section down" aria-label={`Move section “${title}” down (now position ${index + 1} of ${total})`} data-focus-id={`section-${section.id}-down`}>
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <h3 id={`title-${section.id}`} className="truncate text-sm font-semibold text-gray-900">{title}</h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span>{sectionTypeLabel(section.type)}</span>
            <span aria-hidden="true">·</span>
            <span title={layoutMeta(section.layoutType).hint}>{layoutMeta(section.layoutType).label}</span>
            <span aria-hidden="true">·</span>
            <span>{section.placements.length} of {section.maxItems} stories</span>
            {section.category && <><span aria-hidden="true">·</span><span>Links to {section.category.name}</span></>}
            {hidden && <span className="inline-flex items-center gap-1 rounded bg-gray-200 px-1.5 py-0.5 font-semibold text-gray-700"><EyeOff className="h-3 w-3" aria-hidden="true" /> Hidden in draft</span>}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={section.enabled}
            title={section.enabled ? 'Visible on the homepage — click to hide' : 'Hidden — click to show'}
            aria-label={`Show “${title}” on the homepage`}
            onClick={onToggle}
            disabled={disabled}
            className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${section.enabled ? 'bg-primary-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${section.enabled ? 'left-[1.125rem]' : 'left-0.5'}`} />
          </button>
          <button type="button" className={iconButton} onClick={onEdit} disabled={disabled} title="Edit section" aria-label={`Edit section “${title}”`}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" className={`${iconButton} hover:text-red-700`} onClick={onDelete} disabled={disabled} title="Delete section" aria-label={`Delete section “${title}”`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </header>

      {issues.length > 0 && (
        <ul className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900" aria-label={`Problems in ${title}`}>
          {issues.map((issue, position) => <li key={`${issue.code}-${issue.articleId ?? ''}-${position}`}>{describeIssue(issue, draft)}</li>)}
        </ul>
      )}
      {section.type === 'LATEST' && <p className="border-b border-gray-100 px-4 py-1.5 text-xs text-gray-500">Curated: stories appear in the order you set here, not by publication time.</p>}

      {section.placements.length ? (
        <ul className="divide-y divide-gray-100" aria-label={`Stories in ${title}`}>
          {section.placements.map((placement, position) => (
            <StoryRow
              key={placement.articleId}
              placement={placement}
              index={position}
              count={section.placements.length}
              sectionTitle={title}
              disabled={disabled}
              onMove={(delta) => onMoveStory(position, delta)}
              onReplace={() => onReplaceStory(position)}
              onRemove={() => onRemoveStory(position)}
            />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-gray-500">No stories yet. Add stories to make this section appear on the homepage.</p>
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-3 py-2">
        <button type="button" onClick={onAddStories} disabled={disabled || full} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add stories
        </button>
        {full && <span className="text-xs text-gray-500">Section is full ({section.maxItems}). Raise the story limit to add more.</span>}
      </footer>
    </article>
  );
}
