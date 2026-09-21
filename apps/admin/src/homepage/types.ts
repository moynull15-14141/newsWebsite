import type { ApiIssue } from '../lib/api-error';

/** Shapes returned by the Step 03B1 homepage API (GET /homepage/draft, /active, /draft/preview). */

export interface StoryArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  media?: { id: string; publicUrl: string; altText?: string | null } | null;
  category?: { id: string; name: string; slug: string } | null;
  author?: { id: string; name: string } | null;
}

export interface Placement {
  articleId: string;
  sortOrder: number;
  /** Server verdict: is this article still publicly eligible right now? */
  eligible: boolean;
  article: StoryArticle;
}

export interface DraftSection {
  id: string;
  key: string;
  type: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
  maxItems: number;
  layoutType: string;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  locationId: string | null;
  updatedAt: string;
  placements: Placement[];
}

export interface Draft {
  id: string;
  status: 'DRAFT';
  version: number;
  updatedAt: string;
  layoutPresets: string[];
  hasUnpublishedChanges: boolean;
  publishable: boolean;
  issues: ApiIssue[];
  sections: DraftSection[];
}

export interface ActiveConfiguration {
  id: string | null;
  status: 'ACTIVE';
  version: number;
  publishedAt: string | null;
  updatedAt: string | null;
  sections: DraftSection[];
}

export interface PublishResult {
  published: true;
  publishedAt: string;
  activeVersion: number;
  draftVersion: number;
  sectionCount: number;
  placementCount: number;
}

/** Article as returned by the admin catalogue (GET /articles). */
export interface CatalogueArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  media?: { id: string; publicUrl: string; altText?: string | null } | null;
  category?: { id: string; name: string; slug: string } | null;
  author?: { id: string; name: string } | null;
}

export interface CataloguePage {
  data: CatalogueArticle[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Public-shaped homepage payload produced for the draft preview. */
export interface PreviewArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  author?: { id: string; name: string } | null;
  category?: { id: string; name: string; slug: string } | null;
  media?: { id: string; publicUrl: string } | null;
}

export interface PreviewSection {
  key: string;
  type: string;
  title: string;
  layout: string;
  category: { id: string; name: string; slug: string } | null;
  articles: PreviewArticle[];
}

export interface PreviewData {
  hero: PreviewArticle | null;
  latest: PreviewArticle[];
  trending: PreviewArticle[];
  mostRead: PreviewArticle[];
  sections: Record<string, PreviewArticle[]>;
  sectionList?: PreviewSection[];
  preview: { status: 'DRAFT'; configurationId: string | null; version: number | null; updatedAt: string | null; source: 'CONFIGURED' | 'FALLBACK' };
}
