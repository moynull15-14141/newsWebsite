import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '../components/Dialog';
import { apiFetch } from '../lib/api';
import ErrorAlert from './ErrorAlert';
import { availableSectionTypes, maxItemsBounds, MAX_SECTION_ITEMS, supportsCategoryLink } from './logic';
import { layoutMeta, sectionTypeLabel } from './labels';
import type { ActionResult } from './useHomepageBuilder';
import type { Draft, DraftSection } from './types';

export interface SectionFormValues {
  type: string;
  title: string;
  layoutType: string;
  maxItems: number;
  /** null clears the link. Only meaningful for CUSTOM sections. */
  categoryId: string | null;
}

interface SectionDialogProps {
  draft: Draft;
  /** Present when editing; absent when adding a section. */
  section?: DraftSection;
  busy: boolean;
  onSubmit: (values: SectionFormValues) => Promise<ActionResult>;
  onClose: () => void;
  onReload: () => void;
}

const DEFAULT_MAX_ITEMS = 4;
const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100';

/** Add or edit a section: only the fields that make product sense, with the backend's limits applied. */
export default function SectionDialog({ draft, section, busy, onSubmit, onClose, onReload }: SectionDialogProps) {
  const editing = !!section;
  const baseId = useId();
  const types = useMemo(() => availableSectionTypes(draft), [draft]);
  const [type, setType] = useState(section?.type ?? types[0] ?? 'CUSTOM');
  const [title, setTitle] = useState(section?.title ?? (types[0] && types[0] !== 'CUSTOM' ? sectionTypeLabel(types[0]) : ''));
  const [layoutType, setLayoutType] = useState(section?.layoutType ?? draft.layoutPresets[0] ?? 'FEATURED_STACK');
  const [maxItems, setMaxItems] = useState(String(section?.maxItems ?? DEFAULT_MAX_ITEMS));
  const [categoryId, setCategoryId] = useState(section?.categoryId ?? '');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [showErrors, setShowErrors] = useState(false);

  const bounds = maxItemsBounds(section ?? { type, placements: [] });
  const needsCategory = supportsCategoryLink(type);
  const { data: categories } = useQuery<Array<{ id: string; name: string }>>({ queryKey: ['categories'], queryFn: () => apiFetch('/categories'), enabled: needsCategory });

  const trimmed = title.trim();
  const parsedMax = Number(maxItems);
  const titleError = !trimmed ? 'Enter a section title.' : trimmed.length > 120 ? 'Keep the title under 120 characters.' : '';
  const maxError = bounds.fixed ? '' : !Number.isInteger(parsedMax) || parsedMax < bounds.min || parsedMax > bounds.max ? `Enter a whole number from ${bounds.min} to ${bounds.max}.` : '';

  const changeType = (next: string) => {
    // Keep a title the editor typed; only replace the one we suggested.
    if (!title.trim() || title === (type === 'CUSTOM' ? '' : sectionTypeLabel(type))) setTitle(next === 'CUSTOM' ? '' : sectionTypeLabel(next));
    setType(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (titleError || maxError) return;
    setSubmitError(null);
    const result = await onSubmit({
      type,
      title: trimmed,
      layoutType,
      maxItems: bounds.fixed ? 1 : parsedMax,
      categoryId: needsCategory ? categoryId || null : null,
    });
    if (result.ok) onClose();
    else setSubmitError(result.error);
  };

  return (
    <Dialog
      title={editing ? `Edit section “${section.title}”` : 'Add a homepage section'}
      description={editing ? 'Changes apply to the draft only until you publish.' : 'The new section is added at the end of the draft. Reorder it afterwards.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" form={`${baseId}-form`} disabled={busy} className="rounded bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Save section' : 'Add section'}
          </button>
        </>
      }
    >
      <form id={`${baseId}-form`} onSubmit={submit} noValidate className="space-y-4">
        {!editing && (
          <div>
            <label htmlFor={`${baseId}-type`} className="block text-sm font-medium text-gray-700">Section type</label>
            <select id={`${baseId}-type`} data-autofocus value={type} onChange={(event) => changeType(event.target.value)} className={inputClass}>
              {types.map((option) => <option key={option} value={option}>{sectionTypeLabel(option)}{option === 'CUSTOM' ? ' (your own title)' : ''}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Each standard type can appear once. Custom sections can be added as often as needed. Trending, Most read and Breaking news are automatic and not listed.</p>
          </div>
        )}

        <div>
          <label htmlFor={`${baseId}-title`} className="block text-sm font-medium text-gray-700">Section title</label>
          <input
            id={`${baseId}-title`}
            data-autofocus={editing ? true : undefined}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={type === 'CUSTOM' ? 'e.g. Special Coverage' : undefined}
            aria-invalid={showErrors && !!titleError}
            aria-describedby={showErrors && titleError ? `${baseId}-title-error` : undefined}
            maxLength={120}
            className={inputClass}
          />
          {showErrors && titleError && <p id={`${baseId}-title-error`} className="mt-1 text-xs text-red-700">{titleError}</p>}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Layout</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {draft.layoutPresets.map((preset) => {
              const meta = layoutMeta(preset);
              return (
                <label key={preset} className={`flex cursor-pointer flex-col rounded-md border p-2.5 text-sm ${layoutType === preset ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <input type="radio" name={`${baseId}-layout`} value={preset} checked={layoutType === preset} onChange={() => setLayoutType(preset)} />
                    {meta.label}
                  </span>
                  <span className="mt-1 pl-6 text-xs text-gray-500">{meta.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${baseId}-max`} className="block text-sm font-medium text-gray-700">Story limit</label>
          <input
            id={`${baseId}-max`}
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            value={bounds.fixed ? 1 : maxItems}
            disabled={bounds.fixed}
            onChange={(event) => setMaxItems(event.target.value)}
            aria-invalid={showErrors && !!maxError}
            aria-describedby={`${baseId}-max-hint${showErrors && maxError ? ` ${baseId}-max-error` : ''}`}
            className={`${inputClass} max-w-[8rem]`}
          />
          <p id={`${baseId}-max-hint`} className="mt-1 text-xs text-gray-500">
            {bounds.fixed ? 'The Hero always shows exactly one story.' : `The most stories this section shows (${bounds.min}–${MAX_SECTION_ITEMS}).${editing && bounds.min > 1 ? ` It has ${bounds.min} stories now; remove some to go lower.` : ''}`}
          </p>
          {showErrors && maxError && <p id={`${baseId}-max-error`} className="mt-1 text-xs text-red-700">{maxError}</p>}
        </div>

        {needsCategory && (
          <div>
            <label htmlFor={`${baseId}-category`} className="block text-sm font-medium text-gray-700">“View all” link (optional)</label>
            <select id={`${baseId}-category`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}>
              <option value="">No link</option>
              {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Adds a “View all” link to that category on the public homepage.</p>
          </div>
        )}

        {submitError != null && <ErrorAlert error={submitError} draft={draft} onReload={onReload} />}
      </form>
    </Dialog>
  );
}
