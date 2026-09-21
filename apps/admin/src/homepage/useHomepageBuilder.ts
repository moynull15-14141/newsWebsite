import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/toast-context';
import { isApiError, isDraftConflict, type ApiError } from '../lib/api-error';
import { draftRequests, fetchActive, fetchDraft, homepageKeys, publishDraft, runDraftMutation } from './draft-client';
import { heroSection, moveItem, placementIds, reorderSectionIds } from './logic';
import type { Draft, DraftSection, PublishResult, StoryArticle } from './types';

export type ActionResult = { ok: true } | { ok: false; error: unknown };

export interface Rejection {
  /** Which action was refused, for the alert heading. */
  label: string;
  error: unknown;
}

/**
 * Orchestrates every builder action. State that is NOT server state is limited to: "a request is in
 * flight", "the draft version conflicted", and "the last change was refused". Whether there are
 * unpublished changes, whether publishing is possible and which issues exist all come from the server.
 */
export function useHomepageBuilder() {
  const client = useQueryClient();
  const toast = useToast();
  const draftQuery = useQuery({ queryKey: homepageKeys.draft, queryFn: fetchDraft, staleTime: 0, refetchOnWindowFocus: false });
  const activeQuery = useQuery({ queryKey: homepageKeys.active, queryFn: fetchActive, staleTime: 0, refetchOnWindowFocus: false });

  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const latest = () => client.getQueryData<Draft>(homepageKeys.draft);
  const latestSection = (id: string): DraftSection | undefined => latest()?.sections.find((section) => section.id === id);

  /**
   * Runs one server action. Actions never overlap (each needs the version the previous one returned), and
   * nothing runs while a conflict is unresolved. A conflict always raises the reload banner; other failures
   * become a `rejection` unless the caller shows them inline (dialogs).
   */
  const run = useCallback(
    async (label: string, work: () => Promise<void>, options: { inline?: boolean } = {}): Promise<ActionResult> => {
      if (busy.current) return { ok: false, error: new Error('Another change is still being saved.') };
      busy.current = true;
      setPending(label);
      setRejection(null);
      try {
        await work();
        return { ok: true };
      } catch (error) {
        if (isDraftConflict(error)) setConflict(error);
        else if (!options.inline) setRejection({ label, error });
        return { ok: false, error };
      } finally {
        busy.current = false;
        setPending(null);
      }
    },
    [],
  );

  const mutate = (label: string, build: Parameters<typeof runDraftMutation>[1], done?: string, options?: { inline?: boolean; announce?: string }) =>
    run(
      label,
      async () => {
        await runDraftMutation(client, build);
        if (done) toast.show(done);
        if (options?.announce) setAnnouncement(options.announce);
      },
      options,
    );

  const reload = useCallback(async () => {
    setConflict(null);
    setRejection(null);
    await Promise.all([client.invalidateQueries({ queryKey: homepageKeys.draft, exact: true }), client.invalidateQueries({ queryKey: homepageKeys.active })]);
  }, [client]);

  const setPlacements = (section: DraftSection, ids: string[], done?: string, announce?: string) =>
    mutate('Saving…', draftRequests.setPlacements(section.id, ids), done, { announce });

  return {
    draft: draftQuery.data,
    active: activeQuery.data,
    isLoading: draftQuery.isLoading,
    loadError: draftQuery.error,
    reloadDraft: () => draftQuery.refetch(),
    pending,
    conflict,
    rejection,
    dismissRejection: () => setRejection(null),
    announcement,
    reload,

    // ---- sections
    toggleEnabled: (section: DraftSection) =>
      mutate('Saving…', draftRequests.updateSection(section.id, { enabled: !section.enabled }), `“${section.title}” ${section.enabled ? 'hidden from' : 'shown on'} the draft homepage.`),

    moveSection: (section: DraftSection, delta: -1 | 1) => {
      const draft = latest();
      const ids = draft && reorderSectionIds(draft, section.id, delta);
      if (!ids) return Promise.resolve<ActionResult>({ ok: false, error: new Error('This section cannot move further.') });
      return mutate('Saving…', draftRequests.reorderSections(ids), undefined, { announce: `Moved section “${section.title}” ${delta < 0 ? 'up' : 'down'}.` });
    },

    createSection: (input: Parameters<typeof draftRequests.createSection>[0]) =>
      mutate('Saving…', draftRequests.createSection(input), `Section “${input.title}” added to the draft.`, { inline: true }),

    updateSection: (section: DraftSection, patch: Parameters<typeof draftRequests.updateSection>[1]) =>
      mutate('Saving…', draftRequests.updateSection(section.id, patch), `Section “${patch.title ?? section.title}” updated.`, { inline: true }),

    deleteSection: (section: DraftSection) => mutate('Saving…', draftRequests.deleteSection(section.id), `Section “${section.title}” deleted from the draft.`, { inline: true }),

    // ---- stories
    moveStory: (section: DraftSection, index: number, delta: -1 | 1) => {
      const current = latestSection(section.id) ?? section;
      const title = current.placements[index]?.article.title ?? 'Story';
      return setPlacements(current, moveItem(placementIds(current), index, delta), undefined, `Moved “${title}” to position ${index + delta + 1} of ${current.placements.length}.`);
    },

    removeStory: (section: DraftSection, index: number) => {
      const current = latestSection(section.id) ?? section;
      const title = current.placements[index]?.article.title ?? 'Story';
      return setPlacements(current, placementIds(current).filter((_, position) => position !== index), `Removed “${title}” from “${current.title}”.`);
    },

    replaceStory: (section: DraftSection, index: number, article: StoryArticle) => {
      const current = latestSection(section.id) ?? section;
      const ids = placementIds(current);
      ids[index] = article.id;
      return mutate('Saving…', draftRequests.setPlacements(current.id, ids), `Replaced with “${article.title}”.`, { inline: true });
    },

    addStories: (section: DraftSection, articles: StoryArticle[]) => {
      const current = latestSection(section.id) ?? section;
      const ids = [...placementIds(current), ...articles.map((article) => article.id)];
      return mutate('Saving…', draftRequests.setPlacements(current.id, ids), articles.length === 1 ? `Added “${articles[0].title}” to “${current.title}”.` : `Added ${articles.length} stories to “${current.title}”.`, { inline: true });
    },

    // ---- hero
    /** Sets the single Hero story, creating the Hero section first if the draft has none. */
    setHero: (article: StoryArticle) =>
      run(
        'Saving…',
        async () => {
          const current = latest();
          let hero = current ? heroSection(current) : undefined;
          if (!hero) {
            const created = await runDraftMutation(client, draftRequests.createSection({ type: 'HERO', title: 'Homepage Hero', layoutType: 'FEATURED_STACK' }));
            hero = heroSection(created);
          }
          if (!hero) throw new Error('The hero section could not be created.');
          await runDraftMutation(client, draftRequests.setPlacements(hero.id, [article.id]));
          toast.show(`Hero set to “${article.title}”.`);
        },
        { inline: true },
      ),

    removeHero: (section: DraftSection) => setPlacements(section, [], 'Hero story removed. The homepage falls back to the latest curated story until you choose one.'),

    // ---- publishing
    publish: (): Promise<ActionResult> =>
      run(
        'Publishing…',
        async () => {
          let result: PublishResult;
          try {
            result = await publishDraft(client);
          } catch (error) {
            // The draft changed under us (e.g. a story was archived): refresh so the server's issues show.
            if (isApiError(error) && error.status === 422) await client.invalidateQueries({ queryKey: homepageKeys.draft, exact: true });
            throw error;
          }
          toast.show(`Homepage published (${result.sectionCount} sections, ${result.placementCount} stories). Public caches may take about a minute to refresh.`);
        },
        { inline: true },
      ),
  };
}

export type HomepageBuilder = ReturnType<typeof useHomepageBuilder>;
