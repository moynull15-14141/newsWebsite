import type { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ActiveConfiguration, Draft, PreviewData, PublishResult } from './types';

/**
 * Data layer for the builder. Two rules are centralised here so no component can get them wrong:
 *
 *  1. Every draft mutation is sent with the version that is in the cache AT THE MOMENT OF THE CALL
 *     (never one captured by a stale closure), and the server's response replaces the cached draft, so
 *     the next mutation automatically uses the new version.
 *  2. Nothing is optimistic: the cache only changes after the server confirmed the change.
 */

export const homepageKeys = {
  draft: ['homepage', 'draft'] as const,
  active: ['homepage', 'active'] as const,
  preview: ['homepage', 'draft', 'preview'] as const,
};

export const PATHS = {
  active: '/homepage/active',
  draft: '/homepage/draft',
  preview: '/homepage/draft/preview',
  sections: '/homepage/draft/sections',
  order: '/homepage/draft/sections/order',
  publish: '/homepage/publish',
};

export const fetchDraft = () => apiFetch<Draft>(PATHS.draft);
export const fetchActive = () => apiFetch<ActiveConfiguration>(PATHS.active);
/** The preview always reads the DRAFT preview endpoint — never /public/homepage. */
export const fetchPreview = () => apiFetch<PreviewData>(PATHS.preview);

export interface DraftRequest {
  path: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
}

/** Request builders: each receives the current draft version and produces the API call. */
export const draftRequests = {
  createSection: (input: {
    type: string;
    title: string;
    layoutType?: string;
    cardVariant?: string;
    maxItems?: number;
    sourceType?: string;
    categoryId?: string;
    tagId?: string;
    locationId?: string;
  }) => (version: number): DraftRequest => ({
    path: PATHS.sections,
    method: 'POST',
    body: { expectedVersion: version, ...input },
  }),
  updateSection: (id: string, patch: {
    title?: string;
    enabled?: boolean;
    layoutType?: string;
    cardVariant?: string;
    maxItems?: number;
    sourceType?: string;
    categoryId?: string | null;
    tagId?: string | null;
    locationId?: string | null;
  }) => (version: number): DraftRequest => ({
    path: `${PATHS.sections}/${id}`,
    method: 'PATCH',
    body: { expectedVersion: version, ...patch },
  }),
  deleteSection: (id: string) => (version: number): DraftRequest => ({
    path: `${PATHS.sections}/${id}?expectedVersion=${version}`,
    method: 'DELETE',
  }),
  reorderSections: (sectionIds: string[]) => (version: number): DraftRequest => ({
    path: PATHS.order,
    method: 'PUT',
    body: { expectedVersion: version, sectionIds },
  }),
  setPlacements: (sectionId: string, articleIds: string[]) => (version: number): DraftRequest => ({
    path: `${PATHS.sections}/${sectionId}/placements`,
    method: 'PUT',
    body: { expectedVersion: version, articleIds },
  }),
};

export function readDraftVersion(client: QueryClient): number {
  const draft = client.getQueryData<Draft>(homepageKeys.draft);
  if (!draft) throw new Error('The homepage draft has not been loaded yet.');
  return draft.version;
}

/** Sends one draft mutation with the current version and stores the server's returned draft. */
export async function runDraftMutation(client: QueryClient, build: (version: number) => DraftRequest): Promise<Draft> {
  const request = build(readDraftVersion(client));
  const next = await apiFetch<Draft>(request.path, {
    method: request.method,
    body: request.body ? JSON.stringify(request.body) : undefined,
  });
  client.setQueryData(homepageKeys.draft, next);
  return next;
}

/**
 * Publishes the draft using the current version. On success both the draft and the active configuration
 * are refetched (publish bumps both versions). Waits for the server: never optimistic.
 */
export async function publishDraft(client: QueryClient): Promise<PublishResult> {
  const version = readDraftVersion(client);
  const result = await apiFetch<PublishResult>(PATHS.publish, { method: 'POST', body: JSON.stringify({ expectedVersion: version }) });
  await Promise.all([
    client.invalidateQueries({ queryKey: homepageKeys.draft, exact: true }),
    client.invalidateQueries({ queryKey: homepageKeys.active }),
  ]);
  return result;
}
