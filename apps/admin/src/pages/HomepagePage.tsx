import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import ArticlePicker from '../homepage/ArticlePicker';
import ConfirmDialog from '../homepage/ConfirmDialog';
import ErrorAlert from '../homepage/ErrorAlert';
import HeroPanel from '../homepage/HeroPanel';
import IssuesPanel from '../homepage/IssuesPanel';
import SectionCard from '../homepage/SectionCard';
import SectionDialog from '../homepage/SectionDialog';
import StatusBar from '../homepage/StatusBar';
import { ALGORITHMIC_NOTICE, CACHE_NOTICE } from '../homepage/labels';
import { heroSection, issuesForSection, listedSections, placementIds, summarizeDraft } from '../homepage/logic';
import type { ActionResult } from '../homepage/useHomepageBuilder';
import { useHomepageBuilder } from '../homepage/useHomepageBuilder';

type PickerState = { kind: 'hero' } | { kind: 'add'; sectionId: string } | { kind: 'replace'; sectionId: string; index: number };
type SectionDialogState = { mode: 'create' } | { mode: 'edit'; sectionId: string };

/**
 * Homepage Builder: a curation workspace over the DRAFT homepage. Every change is saved to the draft with
 * the server's current version; nothing reaches readers until "Publish homepage" is confirmed.
 */
export default function HomepagePage() {
  const builder = useHomepageBuilder();
  const { draft, pending, conflict } = builder;

  const [picker, setPicker] = useState<PickerState | null>(null);
  const [sectionDialog, setSectionDialog] = useState<SectionDialogState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dialogError, setDialogError] = useState<unknown>(null);
  const focusRequest = useRef<{ primary: string; fallback: string } | null>(null);

  // After a reorder the row re-renders in its new place; put keyboard focus back on the control that moved.
  // Wait until the save has finished (`pending` cleared): while it is in flight every control is disabled,
  // and a disabled button cannot take focus.
  useEffect(() => {
    const request = focusRequest.current;
    if (!request || pending) return;
    const find = (id: string) => document.querySelector<HTMLElement>(`[data-focus-id="${id}"]:not(:disabled)`);
    (find(request.primary) ?? find(request.fallback))?.focus();
    focusRequest.current = null;
  }, [pending, draft?.version]);

  const locked = !!pending || !!conflict;
  const closeDialogs = () => {
    setPicker(null);
    setSectionDialog(null);
    setDeleteId(null);
    setPublishOpen(false);
    setDialogError(null);
  };
  const dialogOpen = !!(picker || sectionDialog || deleteId || publishOpen);

  const reload = async () => {
    if (dialogOpen && !window.confirm('Reloading the latest draft discards what you have not saved in the open dialog. Continue?')) return;
    closeDialogs();
    await builder.reload();
  };

  const settle = (result: ActionResult) => {
    if (result.ok) closeDialogs();
    else setDialogError(result.error);
  };

  if (builder.isLoading) return <BuilderSkeleton />;
  if (!draft) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-bold text-gray-900">Homepage Builder</h1>
        <ErrorAlert error={builder.loadError ?? new Error('The homepage draft could not be loaded.')} heading="The homepage draft could not be loaded" />
        <button type="button" onClick={() => builder.reloadDraft()} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Try again</button>
      </div>
    );
  }

  const hero = heroSection(draft);
  const sections = listedSections(draft);
  const sectionById = (id: string) => draft.sections.find((section) => section.id === id);
  const pickerSection = picker && picker.kind !== 'hero' ? sectionById(picker.sectionId) : undefined;
  const editing = sectionDialog?.mode === 'edit' ? sectionById(sectionDialog.sectionId) : undefined;
  const deleting = deleteId ? sectionById(deleteId) : undefined;
  const summary = summarizeDraft(draft);

  const moveWithFocus = async (id: string, delta: -1 | 1, run: () => Promise<ActionResult>) => {
    focusRequest.current = { primary: `${id}-${delta < 0 ? 'up' : 'down'}`, fallback: `${id}-${delta < 0 ? 'down' : 'up'}` };
    const result = await run();
    if (!result.ok) focusRequest.current = null;
  };

  const confirmPicker = async (articles: Parameters<typeof builder.addStories>[1]) => {
    if (!picker) return;
    setDialogError(null);
    if (picker.kind === 'hero') return settle(await builder.setHero(articles[0]));
    const section = sectionById(picker.sectionId);
    if (!section) return;
    settle(picker.kind === 'add' ? await builder.addStories(section, articles) : await builder.replaceStory(section, picker.index, articles[0]));
  };

  return (
    <div>
      <StatusBar draft={draft} active={builder.active} pending={pending} conflict={conflict} onReload={reload} onPublish={() => { setDialogError(null); setPublishOpen(true); }} />

      {builder.rejection && !conflict && <ErrorAlert error={builder.rejection.error} draft={draft} heading="That change was not saved" onDismiss={builder.dismissRejection} />}
      <div className={builder.rejection && !conflict ? 'mt-5' : ''}><IssuesPanel draft={draft} /></div>

      <HeroPanel
        section={hero}
        disabled={locked}
        onChoose={() => { setDialogError(null); setPicker({ kind: 'hero' }); }}
        onRemove={() => hero && builder.removeHero(hero)}
        onShow={() => hero && builder.toggleEnabled(hero)}
      />

      <section aria-labelledby="sections-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="sections-heading" className="text-sm font-bold uppercase tracking-wide text-gray-700">Homepage sections</h2>
            <p className="text-xs text-gray-500">Sections appear in this order below the Hero. {ALGORITHMIC_NOTICE}</p>
          </div>
          <button type="button" onClick={() => { setDialogError(null); setSectionDialog({ mode: 'create' }); }} disabled={locked} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add section
          </button>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">This draft has no sections yet.</p>
            <p className="mt-1">Add a section such as Latest or a custom section, then place stories in it. Until then the public homepage uses its automatic layout.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                draft={draft}
                index={index}
                total={sections.length}
                issues={issuesForSection(draft, section.key)}
                disabled={locked}
                onMove={(delta) => moveWithFocus(`section-${section.id}`, delta, () => builder.moveSection(section, delta))}
                onToggle={() => builder.toggleEnabled(section)}
                onEdit={() => { setDialogError(null); setSectionDialog({ mode: 'edit', sectionId: section.id }); }}
                onDelete={() => { setDialogError(null); setDeleteId(section.id); }}
                onAddStories={() => { setDialogError(null); setPicker({ kind: 'add', sectionId: section.id }); }}
                onMoveStory={(position, delta) => moveWithFocus(`story-${section.placements[position].articleId}`, delta, () => builder.moveStory(section, position, delta))}
                onReplaceStory={(position) => { setDialogError(null); setPicker({ kind: 'replace', sectionId: section.id, index: position }); }}
                onRemoveStory={(position) => builder.removeStory(section, position)}
              />
            ))}
          </div>
        )}
      </section>

      <p role="status" aria-live="polite" className="sr-only">{builder.announcement}</p>

      {picker?.kind === 'hero' && (
        <ArticlePicker
          title={hero?.placements.length ? 'Replace the Hero story' : 'Choose the Hero story'}
          description="The Hero leads the homepage. Pick one published story."
          mode="single"
          excludeIds={hero ? placementIds(hero) : []}
          confirmLabel={hero?.placements.length ? 'Use as Hero' : 'Set as Hero'}
          busy={!!pending}
          error={dialogError}
          draft={draft}
          onConfirm={confirmPicker}
          onClose={closeDialogs}
          onReload={reload}
        />
      )}
      {picker?.kind === 'add' && pickerSection && (
        <ArticlePicker
          title={`Add stories to “${pickerSection.title}”`}
          description={`${pickerSection.placements.length} of ${pickerSection.maxItems} stories used.`}
          mode="multiple"
          capacity={pickerSection.maxItems - pickerSection.placements.length}
          excludeIds={placementIds(pickerSection)}
          confirmLabel="Add to section"
          busy={!!pending}
          error={dialogError}
          draft={draft}
          onConfirm={confirmPicker}
          onClose={closeDialogs}
          onReload={reload}
        />
      )}
      {picker?.kind === 'replace' && pickerSection && (
        <ArticlePicker
          title={`Replace a story in “${pickerSection.title}”`}
          description={`Replacing “${pickerSection.placements[picker.index]?.article.title ?? 'story'}”.`}
          mode="single"
          excludeIds={placementIds(pickerSection).filter((_, position) => position !== picker.index)}
          confirmLabel="Replace story"
          busy={!!pending}
          error={dialogError}
          draft={draft}
          onConfirm={confirmPicker}
          onClose={closeDialogs}
          onReload={reload}
        />
      )}

      {sectionDialog?.mode === 'create' && (
        <SectionDialog
          draft={draft}
          busy={!!pending}
          onClose={closeDialogs}
          onReload={reload}
          onSubmit={(values) => builder.createSection({
            type: values.type,
            title: values.title,
            layoutType: values.layoutType,
            cardVariant: values.cardVariant,
            maxItems: values.maxItems,
            sourceType: values.sourceType,
            ...(values.categoryId ? { categoryId: values.categoryId } : {}),
            ...(values.tagId ? { tagId: values.tagId } : {}),
            ...(values.locationId ? { locationId: values.locationId } : {}),
          })}
        />
      )}
      {sectionDialog?.mode === 'edit' && editing && (
        <SectionDialog
          draft={draft}
          section={editing}
          busy={!!pending}
          onClose={closeDialogs}
          onReload={reload}
          onSubmit={async (values) => {
            const patch = {
              ...(values.title !== editing.title ? { title: values.title } : {}),
              ...(values.layoutType !== editing.layoutType ? { layoutType: values.layoutType } : {}),
              ...(values.cardVariant !== editing.cardVariant ? { cardVariant: values.cardVariant } : {}),
              ...(editing.type !== 'HERO' && values.maxItems !== editing.maxItems ? { maxItems: values.maxItems } : {}),
              ...(values.sourceType !== editing.sourceType ? { sourceType: values.sourceType } : {}),
              // Links are sent whenever they differ, including when cleared, so switching source never
              // leaves a stale category/tag/location behind.
              ...(values.categoryId !== editing.categoryId ? { categoryId: values.categoryId } : {}),
              ...(values.tagId !== editing.tagId ? { tagId: values.tagId } : {}),
              ...(values.locationId !== editing.locationId ? { locationId: values.locationId } : {}),
            };
            return Object.keys(patch).length ? builder.updateSection(editing, patch) : ({ ok: true } as ActionResult);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.title}” from the homepage draft?`}
          confirmLabel="Delete section"
          tone="danger"
          busy={!!pending}
          error={dialogError}
          draft={draft}
          onCancel={closeDialogs}
          onReload={reload}
          onConfirm={async () => settle(await builder.deleteSection(deleting))}
        >
          <p>This removes the section{deleting.placements.length ? ` and its ${deleting.placements.length} ${deleting.placements.length === 1 ? 'story' : 'stories'}` : ''} from the <strong>draft</strong> only. The live homepage does not change until you publish.</p>
          <p>To keep the section but stop showing it, hide it instead.</p>
        </ConfirmDialog>
      )}

      {publishOpen && (
        <ConfirmDialog
          title="Publish homepage?"
          confirmLabel="Publish homepage"
          busy={!!pending}
          error={dialogError}
          draft={draft}
          onCancel={closeDialogs}
          onReload={reload}
          onConfirm={async () => settle(await builder.publish())}
        >
          <p>This will make the current draft homepage live.</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Hero: {summary.heroTitle ? `“${summary.heroTitle}”` : 'none selected'}</li>
            <li>{summary.enabledSections} of {summary.sections} sections visible, {summary.stories} stories in total</li>
          </ul>
          <p className="text-xs text-gray-500">{CACHE_NOTICE} It is not instant.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading homepage draft" className="space-y-4">
      <div className="h-10 w-1/3 animate-pulse rounded bg-gray-200" />
      <div className="h-28 animate-pulse rounded-md bg-gray-100" />
      {[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-md bg-gray-100" />)}
    </div>
  );
}
