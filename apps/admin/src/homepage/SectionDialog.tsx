import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '../components/Dialog';
import { apiFetch } from '../lib/api';
import ErrorAlert from './ErrorAlert';
import { availableSectionTypes, isManualSource, maxItemsBounds, MAX_SECTION_ITEMS, requiredSourceLink, resolveDefaultSourceForType, supportsCategoryLink } from './logic';
import { cardVariantLabel, layoutMeta, sectionTypeLabel, sourceTypeMeta } from './labels';
import type { ActionResult } from './useHomepageBuilder';
import type { Draft, DraftSection, SourceType } from './types';

export interface SectionFormValues {
  type: string;
  title: string;
  layoutType: string;
  cardVariant: string;
  maxItems: number;
  sourceType: SourceType;
  /** null clears the link. Required for CATEGORY / TAG / LOCATION sources. */
  categoryId: string | null;
  tagId: string | null;
  locationId: string | null;
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

interface Named {
  id: string;
  name: string;
  slug?: string;
}
interface LocationOption extends Named {
  type: string;
  parent?: { id: string; name: string } | null;
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
  const [cardVariant, setCardVariant] = useState(section?.cardVariant ?? 'AUTO');
  const [maxItems, setMaxItems] = useState(String(section?.maxItems ?? DEFAULT_MAX_ITEMS));
  const [sourceType, setSourceType] = useState<SourceType>(section?.sourceType ?? 'MANUAL');
  const [categoryId, setCategoryId] = useState(section?.categoryId ?? '');
  const [tagId, setTagId] = useState(section?.tagId ?? '');
  const [locationId, setLocationId] = useState(section?.locationId ?? '');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [showErrors, setShowErrors] = useState(false);

  const bounds = maxItemsBounds(section ? { ...section, sourceType } : { type, placements: [], sourceType });
  const requiredLink = requiredSourceLink(sourceType);
  const isHero = type === 'HERO';
  // The Hero is always one hand-picked story; offering it a query would contradict that.
  const sourceOptions = isHero ? (['MANUAL'] as SourceType[]) : draft.sourceTypes;
  // A category link doubles as the section's "View all" target, so it stays offered for manual sections.
  const showOptionalCategory = !requiredLink && supportsCategoryLink(type);

  // Also fetched (not just when the matching source is already selected) whenever a section is being
  // added: `changeType` below needs both lists on hand to auto-apply a preset type's default source
  // (e.g. "Bangladesh" -> Location "Bangladesh") the moment the editor picks the type, rather than
  // silently leaving the section unscoped until they separately think to set it themselves.
  const { data: categories } = useQuery<Named[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
    enabled: sourceType === 'CATEGORY' || showOptionalCategory || !editing,
  });
  const { data: tags } = useQuery<Named[]>({ queryKey: ['tags'], queryFn: () => apiFetch('/tags'), enabled: sourceType === 'TAG' });
  const { data: locations } = useQuery<LocationOption[]>({ queryKey: ['locations'], queryFn: () => apiFetch('/locations'), enabled: sourceType === 'LOCATION' || !editing });

  // Country-level rows (just "Bangladesh" today) were previously left out of this list entirely, so a
  // section whose sourceType/locationId already pointed at one (see SECTION_TYPE_DEFAULT_SOURCE above)
  // rendered as if nothing were selected — nothing here forced the mis-scoped "Latest" bug on its own, but
  // it meant there was no way to knowingly pick "the whole country" versus a specific division/district.
  const countries = useMemo(() => (locations ?? []).filter((location) => location.type === 'COUNTRY'), [locations]);
  const divisions = useMemo(() => (locations ?? []).filter((location) => location.type === 'DIVISION'), [locations]);
  const districts = useMemo(() => (locations ?? []).filter((location) => location.type === 'DISTRICT'), [locations]);

  const trimmed = title.trim();
  const parsedMax = Number(maxItems);
  const titleError = !trimmed ? 'Enter a section title.' : trimmed.length > 120 ? 'Keep the title under 120 characters.' : '';
  const maxError = bounds.fixed ? '' : !Number.isInteger(parsedMax) || parsedMax < bounds.min || parsedMax > bounds.max ? `Enter a whole number from ${bounds.min} to ${bounds.max}.` : '';
  const linkValue = requiredLink === 'categoryId' ? categoryId : requiredLink === 'tagId' ? tagId : requiredLink === 'locationId' ? locationId : '';
  const linkError = requiredLink && !linkValue
    ? `Choose a ${requiredLink === 'categoryId' ? 'category' : requiredLink === 'tagId' ? 'tag' : 'location'} for this section to pull stories from.`
    : '';

  const changeType = (next: string) => {
    // Keep a title the editor typed; only replace the one we suggested.
    if (!title.trim() || title === (type === 'CUSTOM' ? '' : sectionTypeLabel(type))) setTitle(next === 'CUSTOM' ? '' : sectionTypeLabel(next));
    setType(next);
    if (next === 'HERO') {
      setSourceType('MANUAL');
      return;
    }
    // A preset type (e.g. "Bangladesh") has an obvious real-world source — pick it automatically so the
    // section is scoped correctly from the moment it's created, instead of defaulting to unfiltered
    // "Latest" until someone notices and fixes it separately (see resolveDefaultSourceForType's comment).
    const resolved = resolveDefaultSourceForType(next, categories, locations);
    if (resolved) {
      setSourceType(resolved.sourceType);
      setCategoryId(resolved.categoryId ?? '');
      setLocationId(resolved.locationId ?? '');
      setTagId('');
    } else {
      setSourceType('MANUAL');
      setCategoryId('');
      setTagId('');
      setLocationId('');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (titleError || maxError || linkError) return;
    setSubmitError(null);
    const result = await onSubmit({
      type,
      title: trimmed,
      layoutType,
      cardVariant,
      maxItems: bounds.fixed ? 1 : parsedMax,
      sourceType,
      // Only the link the source actually uses is sent; the others are cleared so a switched source
      // never keeps a stale link.
      categoryId: sourceType === 'CATEGORY' ? categoryId || null : showOptionalCategory ? categoryId || null : null,
      tagId: sourceType === 'TAG' ? tagId || null : null,
      locationId: sourceType === 'LOCATION' ? locationId || null : null,
    });
    if (result.ok) onClose();
    else setSubmitError(result.error);
  };

  const linkSelect = () => {
    if (sourceType === 'CATEGORY') {
      return (
        <SourceLink id={`${baseId}-category`} label="Category" error={showErrors ? linkError : ''} hint="Stories in this category, newest first.">
          <select id={`${baseId}-category`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-invalid={showErrors && !!linkError} className={inputClass}>
            <option value="">Choose a category…</option>
            {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </SourceLink>
      );
    }
    if (sourceType === 'TAG') {
      return (
        <SourceLink id={`${baseId}-tag`} label="Tag" error={showErrors ? linkError : ''} hint="Stories carrying this tag, newest first.">
          <select id={`${baseId}-tag`} value={tagId} onChange={(event) => setTagId(event.target.value)} aria-invalid={showErrors && !!linkError} className={inputClass}>
            <option value="">Choose a tag…</option>
            {tags?.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </SourceLink>
      );
    }
    if (sourceType === 'LOCATION') {
      return (
        <SourceLink id={`${baseId}-location`} label="Location" error={showErrors ? linkError : ''} hint="A division also includes stories from its districts.">
          <select id={`${baseId}-location`} value={locationId} onChange={(event) => setLocationId(event.target.value)} aria-invalid={showErrors && !!linkError} className={inputClass}>
            <option value="">Choose a location…</option>
            {countries.length > 0 && (
              <optgroup label="Whole country">
                {countries.map((location) => <option key={location.id} value={location.id}>{location.name} (all divisions/districts)</option>)}
              </optgroup>
            )}
            <optgroup label="Divisions">
              {divisions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </optgroup>
            <optgroup label="Districts">
              {districts.map((location) => (
                <option key={location.id} value={location.id}>{location.name}{location.parent ? ` (${location.parent.name})` : ''}</option>
              ))}
            </optgroup>
          </select>
        </SourceLink>
      );
    }
    return null;
  };

  return (
    <Dialog
      title={editing ? `Edit section “${section.title}”` : 'Add a homepage section'}
      description={editing ? 'Changes apply to the draft only until you publish.' : 'The new section is added at the end of the draft. Reorder it afterwards.'}
      size="lg"
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
          <legend className="text-sm font-medium text-gray-700">Where the stories come from</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {sourceOptions.map((option) => {
              const meta = sourceTypeMeta(option);
              return (
                <label key={option} className={`flex cursor-pointer flex-col rounded-md border p-2.5 text-sm ${sourceType === option ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <input type="radio" name={`${baseId}-source`} value={option} checked={sourceType === option} onChange={() => setSourceType(option)} />
                    {meta.label}
                  </span>
                  <span className="mt-1 pl-6 text-xs text-gray-500">{meta.hint}</span>
                </label>
              );
            })}
          </div>
          {editing && isManualSource(section.sourceType) && !isManualSource(sourceType) && section.placements.length > 0 && (
            <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900" role="status">
              Saving this will remove the {section.placements.length} hand-picked {section.placements.length === 1 ? 'story' : 'stories'} from this section. It will then fill itself automatically.
            </p>
          )}
          {isHero && <p className="mt-1 text-xs text-gray-500">The Hero is always one story you pick yourself.</p>}
        </fieldset>

        {linkSelect()}

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
          <label htmlFor={`${baseId}-card`} className="block text-sm font-medium text-gray-700">Card presentation</label>
          <select id={`${baseId}-card`} value={cardVariant} onChange={(event) => setCardVariant(event.target.value)} className={inputClass}>
            {draft.cardVariants.map((variant) => <option key={variant} value={variant}>{cardVariantLabel(variant)}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">Leave on automatic unless this section needs a specific card style.</p>
        </div>

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
            {bounds.fixed
              ? 'The Hero always shows exactly one story.'
              : `The most stories this section shows (${bounds.min}–${MAX_SECTION_ITEMS}).${editing && isManualSource(sourceType) && bounds.min > 1 ? ` It has ${bounds.min} stories now; remove some to go lower.` : ''}`}
          </p>
          {showErrors && maxError && <p id={`${baseId}-max-error`} className="mt-1 text-xs text-red-700">{maxError}</p>}
        </div>

        {showOptionalCategory && (
          <div>
            <label htmlFor={`${baseId}-viewall`} className="block text-sm font-medium text-gray-700">“View all” link (optional)</label>
            <select id={`${baseId}-viewall`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}>
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

/** Label + control + hint/error for the link an automatic source queries by. */
function SourceLink({ id, label, hint, error, children }: { id: string; label: string; hint: string; error: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
