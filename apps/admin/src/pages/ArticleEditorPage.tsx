import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { isArticleVersionConflict } from '../lib/api-error';
import { useAuthStore } from '../stores/auth-store';
import { validateArticleDraft } from '../lib/articles';
import RichTextEditor, { type RichTextEditorHandle } from '../components/RichTextEditor';
import LocationSelector from '../components/LocationSelector';
import CategorySelector from '../components/CategorySelector';
import TagSelector from '../components/TagSelector';
import SeoIntelligencePanel from '../components/SeoIntelligencePanel';
import type { SeoAnalysis } from '@news-platform/seo';
import { Save, Send, Check, Globe, ArrowLeft, Image as ImageIcon, X, Clock, AlertTriangle, History, Link as LinkIcon, Languages as LanguagesIcon, Plus } from 'lucide-react';

interface MediaItem {
  id: string;
  publicUrl: string;
  originalFilename: string;
  altText: string | null;
}

interface ArticleLanguage {
  id: string;
  code: string;
  name: string;
  nativeName: string;
}

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  /** The API returns the TipTap document as real JSON (a Prisma `Json` column), not a string — the
   * editor's `content` state stores it serialized, so this must be re-stringified on load, never
   * assigned directly (Phase 2H editor upgrade fix: assigning it as-is silently emptied the editor
   * for every article that already had real content). */
  content: unknown;
  status: string;
  categoryId: string;
  locationId: string;
  location?: { id: string; parentId: string | null; type: string } | null;
  authorId: string;
  featuredImageId: string | null;
  media?: MediaItem | null;
  isBreaking: boolean;
  breakingPriority: number | null;
  breakingEndsAt: string | null;
  scheduledAt: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  articleTags: { tag: { id: string; name: string } }[];
  language?: ArticleLanguage | null;
}

interface TranslationRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  language: ArticleLanguage;
}

interface ReadinessIssue {
  code: string;
  message: string;
}

interface ReadinessResult {
  blocking: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

interface ExistingCoverageArticle {
  id: string;
  title: string;
  status: string;
  language?: ArticleLanguage | null;
  translationGroupId: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

interface EditorialNote {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
}

interface CorrectionEntry {
  id: string;
  description: string;
  correctedAt: string;
  correctedBy: { id: string; name: string };
}

const auditActionLabels: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Edited',
  LIVE_CONTENT_EDITED: 'Edited live content',
  SUBMITTED_FOR_REVIEW: 'Submitted for review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  RETURNED_TO_DRAFT: 'Returned to draft',
  SCHEDULED: 'Scheduled',
  SCHEDULE_CANCELLED: 'Schedule cancelled',
  CORRECTED: 'Correction posted',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const translationStatusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

export default function ArticleEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  // Slug follows the title automatically until the user types into the slug field themselves; loading
  // an existing article also locks it, so re-editing the title never silently changes a live URL.
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [noIndex, setNoIndex] = useState(false);
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState('');
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  // 'featured' picks the article's featured image; 'body' inserts into the TipTap content at the
  // cursor — same picker, same upload flow, just a different action on selection (Part 10/12).
  const [mediaBrowserMode, setMediaBrowserMode] = useState<'featured' | 'body' | null>(null);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const richTextEditorRef = useRef<RichTextEditorHandle>(null);
  const [isBreaking, setIsBreaking] = useState(false);
  const [breakingPriority, setBreakingPriority] = useState<number>(1);
  const [breakingEndsAt, setBreakingEndsAt] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [returnReasonPromptOpen, setReturnReasonPromptOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  // The updatedAt this editor session last loaded — sent back on save so the API can detect and
  // reject a stale write instead of silently overwriting someone else's newer save (Phase 2H).
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newCorrection, setNewCorrection] = useState('');
  // Before writing a brand-new article, let the reporter check whether the same story already
  // exists in another language — otherwise nothing on this page ever surfaces that (Phase 2H).
  const [coverageSearch, setCoverageSearch] = useState('');

  const { data: article, isLoading } = useQuery<ArticleData>({
    queryKey: ['article', id],
    queryFn: () => apiFetch(`/articles/${id}`),
    enabled: !!id,
  });

  const { data: serverSeoAnalysis } = useQuery<SeoAnalysis>({
    queryKey: ['article-seo', id],
    queryFn: () => apiFetch(`/seo/articles/${id}`),
    enabled: !!id && hasPermission('article.read'),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSlug(article.slug);
      setSlugTouched(true);
      setLoadedUpdatedAt(article.updatedAt ?? null);
      setExcerpt(article.excerpt || '');
      setSeoTitle(article.seoTitle || '');
      setSeoDescription(article.seoDescription || '');
      setSeoKeywords(article.seoKeywords || '');
      setCanonicalUrl(article.canonicalUrl || '');
      setNoIndex(article.noIndex || false);
      // article.content is a Prisma Json column: normally a real object, but some existing rows were
      // corrupted by a save-path bug that stored it pre-stringified (see buildSavePayload below) — load
      // defensively so both shapes render instead of double-encoding an already-string value.
      setContent(
        typeof article.content === 'string'
          ? article.content
          : article.content ? JSON.stringify(article.content) : '',
      );
      setCategoryId(article.categoryId || '');
      setLocationId(article.locationId || '');
      if (article.location?.type === 'DISTRICT') {
        setDivisionId(article.location.parentId || '');
        setDistrictId(article.location.id);
      } else {
        setDivisionId(article.location?.id || '');
        setDistrictId('');
      }
      setTagIds(article.articleTags?.map((t) => t.tag.id) || []);
      setFeaturedImageId(article.featuredImageId || null);
      setIsBreaking(article.isBreaking || false);
      setBreakingPriority(article.breakingPriority || 1);
      setBreakingEndsAt(article.breakingEndsAt ? article.breakingEndsAt.slice(0, 16) : '');
      setScheduledAt(article.scheduledAt ? article.scheduledAt.slice(0, 16) : '');
    }
  }, [article]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch<{ id: string }>('/articles', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate(`/articles/${data.id}/edit`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch<{ updatedAt?: string }>(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      if (data?.updatedAt) setLoadedUpdatedAt(data.updatedAt);
    },
    onError: (err: unknown) => {
      if (isArticleVersionConflict(err)) setVersionConflict(true);
    },
  });

  const reloadAfterConflict = () => {
    setVersionConflict(false);
    queryClient.invalidateQueries({ queryKey: ['article', id] });
  };

  const workflowMutation = useMutation({
    mutationFn: (action: string) => apiFetch(`/articles/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
  });

  const returnToDraftMutation = useMutation({
    mutationFn: (reason: string) => apiFetch(`/articles/${id}/return-to-draft`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['article-audit-log', id] });
      setReturnReasonPromptOpen(false);
      setReturnReason('');
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (scheduledAt: string) =>
      apiFetch(`/articles/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: () => apiFetch(`/articles/${id}/cancel-schedule`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const saveRevisionMutation = useMutation({
    mutationFn: (changeReason?: string) =>
      apiFetch(`/articles/${id}/revisions`, {
        method: 'POST',
        body: JSON.stringify({ changeReason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisions', id] });
    },
  });

  const { data: translations } = useQuery<TranslationRow[]>({
    queryKey: ['article-translations', id],
    queryFn: () => apiFetch(`/articles/${id}/translations`),
    enabled: !!id,
  });

  const { data: activeLanguages } = useQuery<ArticleLanguage[]>({
    queryKey: ['languages'],
    queryFn: () => apiFetch('/languages'),
    enabled: hasPermission('article.create'),
  });

  const { data: readiness } = useQuery<ReadinessResult>({
    queryKey: ['article-readiness', id],
    queryFn: () => apiFetch(`/articles/${id}/readiness`),
    enabled: !!id && hasPermission('article.read'),
  });

  const { data: auditLog } = useQuery<AuditLogEntry[]>({
    queryKey: ['article-audit-log', id],
    queryFn: () => apiFetch<{ data: AuditLogEntry[] }>(`/articles/${id}/audit-log`).then((r) => r.data),
    enabled: !!id && hasPermission('article.read'),
  });

  const { data: editorialNotes } = useQuery<EditorialNote[]>({
    queryKey: ['article-notes', id],
    queryFn: () => apiFetch(`/editorial/articles/${id}/notes`),
    enabled: !!id && hasPermission('article.read'),
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => apiFetch(`/editorial/articles/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-notes', id] });
      setNewNote('');
    },
  });

  const { data: corrections } = useQuery<CorrectionEntry[]>({
    queryKey: ['article-corrections', id],
    queryFn: () => apiFetch(`/editorial/articles/${id}/corrections`),
    enabled: !!id && article?.status === 'PUBLISHED' && hasPermission('article.review'),
  });

  const addCorrectionMutation = useMutation({
    mutationFn: (description: string) => apiFetch(`/editorial/articles/${id}/corrections`, { method: 'POST', body: JSON.stringify({ content: description }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-corrections', id] });
      setNewCorrection('');
    },
  });

  const createTranslationMutation = useMutation({
    mutationFn: (languageId: string) => apiFetch<{ id: string }>(`/articles/${id}/translations`, { method: 'POST', body: JSON.stringify({ languageId }) }),
    onSuccess: (created) => navigate(`/articles/${created.id}/edit`),
  });

  const { data: coverageResults, isFetching: coverageSearching } = useQuery<{ data: ExistingCoverageArticle[] }>({
    queryKey: ['existing-coverage', coverageSearch],
    queryFn: () => apiFetch(`/articles?search=${encodeURIComponent(coverageSearch.trim())}&limit=6`),
    enabled: !id && coverageSearch.trim().length >= 3,
  });

  const startTranslationMutation = useMutation({
    mutationFn: ({ sourceId, languageId }: { sourceId: string; languageId: string }) =>
      apiFetch<{ id: string }>(`/articles/${sourceId}/translations`, { method: 'POST', body: JSON.stringify({ languageId }) }),
    onSuccess: (created) => navigate(`/articles/${created.id}/edit`),
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', mediaPage, mediaSearch],
    queryFn: () =>
      apiFetch<{
        data: MediaItem[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(`/media?page=${mediaPage}&limit=12${mediaSearch ? `&search=${encodeURIComponent(mediaSearch)}` : ''}`),
    enabled: mediaBrowserMode !== null,
  });

  /** Featured-image mode sets the article's image; body mode inserts into the TipTap content instead. */
  const applyMediaSelection = (media: MediaItem) => {
    if (mediaBrowserMode === 'body') {
      richTextEditorRef.current?.insertImage(media.publicUrl, media.altText ?? undefined);
    } else {
      setUploadedMedia(media);
      setFeaturedImageId(media.id);
    }
    setMediaBrowserMode(null);
  };

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<MediaItem>('/media', { method: 'POST', body: formData });
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      applyMediaSelection(media);
    },
  });

  const selectedMedia = featuredImageId
    ? mediaData?.data?.find((m) => m.id === featuredImageId) ||
      (uploadedMedia?.id === featuredImageId ? uploadedMedia : null) ||
      article?.media
    : null;

  /** `content` holds the editor's own JSON.stringify()'d document (see RichTextEditor's onChange). It
   * must be parsed back into a real object here before the API request — the whole payload gets
   * JSON.stringify()'d again for the HTTP body, so sending the string as-is would nest it as an
   * escaped string value instead of a JSON object (exactly the corruption a legacy version of this
   * bug already wrote into some existing articles — the loader above tolerates that shape, but new
   * saves must never produce it again). */
  const parseContentForSave = (): unknown => {
    if (!content) return undefined;
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  };

  const buildSavePayload = (): Record<string, unknown> => ({
    title,
    slug: slug || undefined,
    excerpt: excerpt || undefined,
    seoTitle: seoTitle || undefined,
    seoDescription: seoDescription || undefined,
    seoKeywords: seoKeywords || undefined,
    canonicalUrl: canonicalUrl || undefined,
    noIndex,
    content: parseContentForSave(),
    categoryId: categoryId || undefined,
    locationId: locationId || undefined,
    tagIds,
    featuredImageId: featuredImageId || undefined,
    isBreaking,
    breakingPriority: isBreaking ? breakingPriority : undefined,
    breakingEndsAt: breakingEndsAt || undefined,
  });

  const handleSave = async () => {
    const errors = validateArticleDraft({ title });
    setValidationErrors(errors);
    if (errors.length > 0) return;

    const data = buildSavePayload();

    if (id) {
      await updateMutation.mutateAsync({ ...data, expectedUpdatedAt: loadedUpdatedAt || undefined });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  // "Add other language" from the brand-new (never-saved) editor: save this draft first — same
  // validation as a normal Save Draft — then immediately branch it into a translation, so the
  // reporter never has to save, wait, then hunt for the Translations panel (Phase 2H).
  const saveAndAddLanguageMutation = useMutation({
    mutationFn: async (languageId: string) => {
      const errors = validateArticleDraft({ title });
      setValidationErrors(errors);
      if (errors.length > 0) throw new Error(errors[0]);
      const created = await apiFetch<{ id: string }>('/articles', { method: 'POST', body: JSON.stringify(buildSavePayload()) });
      return apiFetch<{ id: string }>(`/articles/${created.id}/translations`, { method: 'POST', body: JSON.stringify({ languageId }) });
    },
    onSuccess: (translation) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate(`/articles/${translation.id}/edit`);
    },
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    // An emptied slug field resumes auto-following the title, matching the "reset to default" pattern
    // most editors expect instead of leaving the slug permanently stuck blank.
    setSlugTouched(value.trim().length > 0);
  };

  if (id && isLoading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/articles')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {id ? 'Edit Article' : 'New Article'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSave()}
            disabled={createMutation.isPending || updateMutation.isPending}
            title={article?.status === 'PUBLISHED' ? 'This article is live — saving updates the published version immediately.' : undefined}
            className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              article?.status === 'PUBLISHED'
                ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {article?.status === 'PUBLISHED' ? <Globe className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {!id ? 'Save Draft' : article?.status === 'PUBLISHED' ? 'Update & Republish' : article?.status === 'DRAFT' ? 'Save Draft' : 'Save Changes'}
          </button>
          {id && article?.status === 'DRAFT' && article?.authorId === currentUserId && (
            <button
              onClick={() => workflowMutation.mutate('submit-review')}
              disabled={workflowMutation.isPending || !!readiness?.blocking.length}
              title={readiness?.blocking.length ? readiness.blocking.map((b) => b.message).join(' ') : undefined}
              className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Submit Review
            </button>
          )}
          {id && ['IN_REVIEW', 'APPROVED'].includes(article?.status || '') && hasPermission('article.review') && (
            <button
              onClick={() => setReturnReasonPromptOpen(true)}
              disabled={returnToDraftMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Request Changes
            </button>
          )}
          {id && article?.status === 'IN_REVIEW' && hasPermission('article.review') && (
            <button
              onClick={() => workflowMutation.mutate('approve')}
              disabled={workflowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Approve
            </button>
          )}
          {id && article?.status === 'APPROVED' && hasPermission('article.publish') && (
            <button
              onClick={() => workflowMutation.mutate('publish')}
              disabled={workflowMutation.isPending || !!readiness?.blocking.length}
              title={readiness?.blocking.length ? readiness.blocking.map((b) => b.message).join(' ') : undefined}
              className="inline-flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
            >
              <Globe className="h-4 w-4" />
              Publish
            </button>
          )}
          {id && article?.status === 'PUBLISHED' && hasPermission('article.publish') && (
            <button
              onClick={() => { if (window.confirm('Unpublish this article? It will return to Draft and stop appearing publicly.')) workflowMutation.mutate('unpublish'); }}
              disabled={workflowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
          {id && article?.status === 'PUBLISHED' && hasPermission('article.publish') && (
            <button
              onClick={() => { if (window.confirm('Archive this article? It will no longer appear publicly.')) workflowMutation.mutate('archive'); }}
              disabled={workflowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Archive
            </button>
          )}
          {id && article?.status === 'ARCHIVED' && hasPermission('article.publish') && (
            <button
              onClick={() => { if (window.confirm('Restore this article to Draft? It will re-enter the normal review workflow.')) workflowMutation.mutate('restore'); }}
              disabled={workflowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Restore
            </button>
          )}
        </div>
      </div>

      {returnReasonPromptOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="return-reason-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 id="return-reason-title" className="text-lg font-semibold text-gray-900">Request changes</h2>
            <p className="mt-1 text-sm text-gray-500">This sends the article back to Draft. Let the author know what needs fixing.</p>
            <label htmlFor="return-reason" className="mt-4 block text-sm font-medium text-gray-700">Reason (visible to the author in the audit trail)</label>
            <textarea
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Needs a stronger lede and a source for paragraph 3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setReturnReasonPromptOpen(false); setReturnReason(''); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => returnToDraftMutation.mutate(returnReason)}
                disabled={returnToDraftMutation.isPending}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {returnToDraftMutation.isPending ? 'Sending...' : 'Send back to Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ul className="list-disc space-y-0.5 pl-4">
            {validationErrors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}

      {versionConflict ? (
        <div role="alert" className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">This article was changed by another user.</p>
          <p className="mt-1">Your changes were not saved. Reload the latest version before continuing.</p>
          <button
            onClick={reloadAfterConflict}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Reload latest version
          </button>
        </div>
      ) : (createMutation.isError || updateMutation.isError || workflowMutation.isError || returnToDraftMutation.isError) && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(createMutation.error ?? updateMutation.error ?? workflowMutation.error ?? returnToDraftMutation.error, 'Something went wrong. Please try again.')}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <label htmlFor="article-title" className="block text-sm font-medium text-gray-700">Title</label>
            <input
              id="article-title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              aria-required="true"
              aria-invalid={validationErrors.length > 0}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Article title"
            />
          </div>
          <div>
            <label htmlFor="article-slug" className="block text-sm font-medium text-gray-700">
              Slug <span className="font-normal text-gray-400">(auto-filled from the title — edit only if you need a different URL)</span>
            </label>
            <input
              id="article-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="article-slug"
            />
          </div>
          <div>
            <label htmlFor="article-excerpt" className="block text-sm font-medium text-gray-700">Excerpt</label>
            <textarea
              id="article-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Brief summary of the article"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700">Content</span>
            <div className="mt-1">
              <RichTextEditor
                ref={richTextEditorRef}
                content={content}
                onChange={setContent}
                placeholder="Write your article..."
                onRequestImage={() => setMediaBrowserMode('body')}
              />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-900">Search metadata</h3>
            <div className="mt-4 space-y-3">
              <label htmlFor="seo-title" className="block text-xs font-medium text-gray-600">SEO title</label>
              <input id="seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={500} placeholder="SEO title (optional)" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label htmlFor="seo-description" className="block text-xs font-medium text-gray-600">Meta description</label>
              <textarea id="seo-description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={2000} rows={2} placeholder="SEO description (optional)" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label htmlFor="seo-keywords" className="block text-xs font-medium text-gray-600">Focus phrase / supporting keywords</label>
              <input id="seo-keywords" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} maxLength={1000} placeholder="Primary phrase first, then optional supporting terms" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label htmlFor="canonical-url" className="block text-xs font-medium text-gray-600">Canonical override</label>
              <input id="canonical-url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} maxLength={2000} placeholder="Leave blank to use the public article URL" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} /> Do not index this article</label>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          {!id && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <LanguagesIcon className="h-4 w-4 text-teal-500" />
                <h3 className="text-sm font-medium text-gray-900">Also write this in another language</h3>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Saves this draft, then opens a linked blank draft in the language you pick — category, location, tags and featured image carry over automatically. Title and content start blank so nothing untranslated is ever shown to readers.
              </p>
              {saveAndAddLanguageMutation.isError && (
                <p className="mt-2 text-xs text-red-600">{(saveAndAddLanguageMutation.error as Error).message}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(activeLanguages ?? []).map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => saveAndAddLanguageMutation.mutate(lang.id)}
                    disabled={saveAndAddLanguageMutation.isPending || !title.trim()}
                    title={!title.trim() ? 'Add a title first' : undefined}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    {saveAndAddLanguageMutation.isPending ? 'Creating…' : `Add ${lang.nativeName} version`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!id && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <LanguagesIcon className="h-4 w-4 text-teal-500" />
                <h3 className="text-sm font-medium text-gray-900">Check existing coverage</h3>
              </div>
              <p className="mt-1 text-xs text-gray-500">Search before writing — this story may already exist in another language.</p>
              <input
                type="text"
                value={coverageSearch}
                onChange={(e) => setCoverageSearch(e.target.value)}
                placeholder="Search by title (e.g. flood, election...)"
                className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {coverageSearch.trim().length > 0 && coverageSearch.trim().length < 3 && (
                <p className="mt-2 text-xs text-gray-400">Keep typing — at least 3 characters.</p>
              )}
              {coverageSearching && <p className="mt-2 text-xs text-gray-400">Searching…</p>}
              {startTranslationMutation.isError && (
                <p className="mt-2 text-xs text-red-600">{(startTranslationMutation.error as Error).message}</p>
              )}
              {coverageResults?.data && coverageResults.data.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {coverageResults.data.map((match) => {
                    const matchLanguageId = match.language?.id;
                    const otherLanguages = (activeLanguages ?? []).filter((lang) => lang.id !== matchLanguageId);
                    return (
                      <li key={match.id} className="rounded border border-gray-100 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">{match.title}</p>
                            <p className="text-xs text-gray-500">{match.language?.nativeName || 'Unknown language'} · {match.status.replace('_', ' ')}</p>
                          </div>
                          <a href={`/articles/${match.id}/edit`} className="shrink-0 text-xs text-primary-600 hover:underline">Open</a>
                        </div>
                        {hasPermission('article.create') && otherLanguages.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {otherLanguages.map((lang) => (
                              <button
                                key={lang.id}
                                onClick={() => startTranslationMutation.mutate({ sourceId: match.id, languageId: lang.id })}
                                disabled={startTranslationMutation.isPending}
                                className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50"
                              >
                                Write {lang.nativeName} version
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {coverageResults?.data && coverageResults.data.length === 0 && !coverageSearching && (
                <p className="mt-2 text-xs text-gray-400">No existing coverage found — go ahead and write it.</p>
              )}
            </div>
          )}
          {id && readiness && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-900">Editorial Readiness</h3>
              {readiness.blocking.length === 0 && readiness.warnings.length === 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
                  <Check className="h-4 w-4" /> Ready
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {readiness.blocking.map((issue) => (
                    <li key={issue.code} className="flex items-start gap-1.5 text-red-700">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                  {readiness.warnings.map((issue) => (
                    <li key={issue.code} className="flex items-start gap-1.5 text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <SeoIntelligencePanel
            title={title} slug={slug} excerpt={excerpt} content={content} seoTitle={seoTitle}
            seoDescription={seoDescription} focusKeyword={seoKeywords} canonicalUrl={canonicalUrl}
            noIndex={noIndex} status={article?.status || 'DRAFT'} featuredImageUrl={selectedMedia?.publicUrl}
            featuredImageAlt={selectedMedia?.altText} category={!!categoryId} location={!!locationId}
            author={!!currentUserId} publishedAt={article?.publishedAt} updatedAt={article?.updatedAt}
            translationsCount={translations?.length || 0} hasHreflang hasOpenGraph hasTwitterCard
            hasArticleSchema hasBreadcrumbSchema hasPublisher serverAnalysis={serverSeoAnalysis}
            onUseTitle={() => setSeoTitle(title)} onUseExcerpt={() => setSeoDescription(excerpt)}
            onGenerateSlug={() => handleSlugChange(slugify(title))}
          />
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-900">Publishing</h3>
            <div className="mt-4 space-y-4">
              <CategorySelector value={categoryId} onChange={setCategoryId} />
              <LocationSelector
                divisionId={divisionId}
                districtId={districtId}
                onDivisionChange={setDivisionId}
                onDistrictChange={(id) => {
                  setDistrictId(id);
                  setLocationId(id || divisionId);
                }}
              />
              <TagSelector selectedTagIds={tagIds} onChange={setTagIds} />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-900">Featured Image</h3>
            <div className="mt-4">
              {selectedMedia ? (
                <div className="relative">
                  <img
                    src={selectedMedia.publicUrl}
                    alt={selectedMedia.altText || selectedMedia.originalFilename}
                    className="w-full rounded-md object-cover"
                    style={{ maxHeight: 150 }}
                  />
                  <button
                    onClick={() => setFeaturedImageId(null)}
                    className="absolute right-1 top-1 rounded-full bg-white p-1 shadow-sm hover:bg-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setMediaBrowserMode('featured')}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-primary-500 hover:text-primary-600"
                >
                  <ImageIcon className="h-5 w-5" />
                  Select Image
                </button>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-900">Status</h3>
            <p className="mt-2 text-sm text-gray-500">{(article?.status || 'DRAFT').replace('_', ' ')}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-medium text-gray-900">Breaking News</h3>
            </div>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isBreaking}
                  onChange={(e) => setIsBreaking(e.target.checked)}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Mark as Breaking</span>
              </label>
              {isBreaking && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Priority (lower = higher)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={breakingPriority}
                      onChange={(e) => setBreakingPriority(Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Expires at</label>
                    <input
                      type="datetime-local"
                      value={breakingEndsAt}
                      onChange={(e) => setBreakingEndsAt(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {id && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-medium text-gray-900">Schedule</h3>
              </div>
              <div className="mt-4 space-y-3">
                {article?.scheduledAt && (
                  <p className="text-xs text-blue-600">
                    Scheduled for: {new Date(article.scheduledAt).toLocaleString()}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500">Schedule publish</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (scheduledAt) {
                        scheduleMutation.mutate(new Date(scheduledAt).toISOString());
                      }
                    }}
                    disabled={!scheduledAt || scheduleMutation.isPending}
                    className="flex-1 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    Schedule
                  </button>
                  {article?.scheduledAt && (
                    <button
                      onClick={() => cancelScheduleMutation.mutate()}
                      disabled={cancelScheduleMutation.isPending}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {id && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <LanguagesIcon className="h-4 w-4 text-teal-500" />
                <h3 className="text-sm font-medium text-gray-900">Translations</h3>
              </div>
              <div className="mt-4 space-y-2">
                {(() => {
                  const present = translations?.length
                    ? translations
                    : article?.language
                      ? [{ id: article.id, title: article.title, slug: article.slug, status: article.status, publishedAt: null, language: article.language }]
                      : [];
                  const presentLanguageIds = new Set(present.map((t) => t.language.id));
                  const missing = (activeLanguages ?? []).filter((lang) => !presentLanguageIds.has(lang.id));

                  return (
                    <>
                      {present.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-500">{t.language.nativeName}</p>
                            {t.id === id ? (
                              <p className="truncate text-sm text-gray-400">This article</p>
                            ) : (
                              <a href={`/articles/${t.id}/edit`} className="truncate text-sm text-primary-600 hover:text-primary-700">{t.title}</a>
                            )}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${translationStatusColors[t.status] || ''}`}>{t.status.replace('_', ' ')}</span>
                        </div>
                      ))}
                      {hasPermission('article.create') && missing.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => createTranslationMutation.mutate(lang.id)}
                          disabled={createTranslationMutation.isPending}
                          className="flex w-full items-center justify-between gap-2 rounded border border-dashed border-gray-300 px-3 py-2 text-left text-sm text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50"
                        >
                          <span>Create {lang.nativeName} translation</span>
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      ))}
                      {createTranslationMutation.isError && (
                        <p className="text-xs text-red-600">{(createTranslationMutation.error as Error).message}</p>
                      )}
                      {!present.length && !missing.length && <p className="text-xs text-gray-400">No languages configured.</p>}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {id && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-purple-500" />
                <h3 className="text-sm font-medium text-gray-900">Revisions</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Change reason</label>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Why saving this revision"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <button
                  onClick={() => saveRevisionMutation.mutate(changeReason || undefined)}
                  disabled={saveRevisionMutation.isPending}
                  className="w-full rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  Save Revision
                </button>
                <a
                  href={`/articles/${id}/revisions`}
                  className="flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600"
                >
                  <LinkIcon className="h-3 w-3" />
                  View all revisions
                </a>
              </div>
            </div>
          )}

          {id && hasPermission('article.read') && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-900">Editorial Notes</h3>
              <p className="mt-1 text-xs text-gray-500">Internal notes between editors — never shown to readers.</p>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {editorialNotes?.length ? editorialNotes.map((note) => (
                  <div key={note.id} className="rounded border border-gray-100 bg-gray-50 p-2 text-sm">
                    <p className="text-gray-800">{note.content}</p>
                    <p className="mt-1 text-xs text-gray-400">{note.author.name} · {new Date(note.createdAt).toLocaleString()}</p>
                  </div>
                )) : <p className="text-xs text-gray-400">No notes yet.</p>}
              </div>
              {hasPermission('article.edit') && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note for other editors"
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => newNote.trim() && addNoteMutation.mutate(newNote.trim())}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="shrink-0 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {id && article?.status === 'PUBLISHED' && hasPermission('article.review') && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-900">Corrections</h3>
              <p className="mt-1 text-xs text-gray-500">Publicly visible on the article page — use for factual corrections after publication.</p>
              <div className="mt-3 space-y-2">
                {corrections?.length ? corrections.map((c) => (
                  <div key={c.id} className="rounded border border-amber-100 bg-amber-50 p-2 text-sm">
                    <p className="text-amber-900">{c.description}</p>
                    <p className="mt-1 text-xs text-amber-600">{c.correctedBy.name} · {new Date(c.correctedAt).toLocaleString()}</p>
                  </div>
                )) : <p className="text-xs text-gray-400">No corrections posted.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newCorrection}
                  onChange={(e) => setNewCorrection(e.target.value)}
                  placeholder="Describe the correction"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  onClick={() => newCorrection.trim() && addCorrectionMutation.mutate(newCorrection.trim())}
                  disabled={!newCorrection.trim() || addCorrectionMutation.isPending}
                  className="shrink-0 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </div>
          )}

          {id && hasPermission('article.read') && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-900">Audit Trail</h3>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {auditLog?.length ? auditLog.map((entry) => (
                  <div key={entry.id} className="border-b border-gray-100 pb-2 text-sm last:border-0">
                    <p className="font-medium text-gray-800">{auditActionLabels[entry.action] || entry.action}</p>
                    <p className="text-xs text-gray-400">{entry.actor?.name || 'System'} · {new Date(entry.createdAt).toLocaleString()}</p>
                    {entry.note && <p className="mt-0.5 text-xs text-gray-600">{entry.note}</p>}
                  </div>
                )) : <p className="text-xs text-gray-400">No audit history yet.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {mediaBrowserMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="media-browser-title">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl" style={{ maxHeight: '80vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between">
              <h2 id="media-browser-title" className="text-lg font-semibold text-gray-900">
                {mediaBrowserMode === 'body' ? 'Insert Image into Article' : 'Select Featured Image'}
              </h2>
              <button onClick={() => setMediaBrowserMode(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search media..."
                  value={mediaSearch}
                  onChange={(e) => { setMediaSearch(e.target.value); setMediaPage(1); }}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {hasPermission('media.upload') && (
                  <>
                    <button
                      type="button"
                      onClick={() => mediaFileInputRef.current?.click()}
                      disabled={uploadMediaMutation.isPending}
                      className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {uploadMediaMutation.isPending ? 'Uploading...' : 'Upload'}
                    </button>
                    <input
                      ref={mediaFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadMediaMutation.mutate(file);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}
              </div>
              {uploadMediaMutation.isError && (
                <p className="mt-2 text-sm text-red-600">Upload failed: {(uploadMediaMutation.error as Error).message}</p>
              )}
            </div>
            {mediaLoading ? (
              <div className="mt-8 text-center text-gray-500">Loading...</div>
            ) : !mediaData?.data?.length ? (
              <div className="mt-8 text-center text-gray-500">No media found</div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {mediaData.data.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => applyMediaSelection(item)}
                    aria-label={`Select ${item.originalFilename}`}
                    className="aspect-square overflow-hidden rounded-md border-2 border-transparent hover:border-primary-500 transition-colors"
                  >
                    <img
                      src={item.publicUrl}
                      alt={item.altText || item.originalFilename}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            {mediaData?.meta && mediaData.meta.totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setMediaPage((p) => Math.max(1, p - 1))}
                  disabled={mediaPage === 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setMediaPage((p) => Math.min(mediaData.meta.totalPages, p + 1))}
                  disabled={mediaPage === mediaData.meta.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
