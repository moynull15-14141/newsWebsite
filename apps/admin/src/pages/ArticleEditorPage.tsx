import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import RichTextEditor from '../components/RichTextEditor';
import LocationSelector from '../components/LocationSelector';
import CategorySelector from '../components/CategorySelector';
import TagSelector from '../components/TagSelector';
import { Save, Send, Check, Globe, ArrowLeft, Image as ImageIcon, X, Clock, AlertTriangle, History, Link as LinkIcon } from 'lucide-react';

interface MediaItem {
  id: string;
  publicUrl: string;
  originalFilename: string;
  altText: string | null;
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
  content: string;
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
  articleTags: { tag: { id: string; name: string } }[];
}

export default function ArticleEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
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
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [isBreaking, setIsBreaking] = useState(false);
  const [breakingPriority, setBreakingPriority] = useState<number>(1);
  const [breakingEndsAt, setBreakingEndsAt] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const { data: article, isLoading } = useQuery<ArticleData>({
    queryKey: ['article', id],
    queryFn: () => apiFetch(`/articles/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSlug(article.slug);
      setExcerpt(article.excerpt || '');
      setSeoTitle(article.seoTitle || '');
      setSeoDescription(article.seoDescription || '');
      setSeoKeywords(article.seoKeywords || '');
      setCanonicalUrl(article.canonicalUrl || '');
      setNoIndex(article.noIndex || false);
      setContent(article.content || '');
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
    mutationFn: (data: Record<string, unknown>) => apiFetch(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });

  const workflowMutation = useMutation({
    mutationFn: (action: string) => apiFetch(`/articles/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', id] });
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

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', mediaPage, mediaSearch],
    queryFn: () =>
      apiFetch<{
        data: MediaItem[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(`/media?page=${mediaPage}&limit=12${mediaSearch ? `&search=${encodeURIComponent(mediaSearch)}` : ''}`),
    enabled: showMediaBrowser,
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<MediaItem>('/media', { method: 'POST', body: formData });
    },
    onSuccess: (media) => {
      setUploadedMedia(media);
      setFeaturedImageId(media.id);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setShowMediaBrowser(false);
    },
  });

  const selectedMedia = featuredImageId
    ? mediaData?.data?.find((m) => m.id === featuredImageId) ||
      (uploadedMedia?.id === featuredImageId ? uploadedMedia : null) ||
      article?.media
    : null;

  const handleSave = async () => {
    const data: Record<string, unknown> = {
      title,
      slug: slug || undefined,
      excerpt: excerpt || undefined,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
      seoKeywords: seoKeywords || undefined,
      canonicalUrl: canonicalUrl || undefined,
      noIndex,
      content: content || undefined,
      categoryId: categoryId || undefined,
      locationId: locationId || undefined,
      tagIds,
      featuredImageId: featuredImageId || undefined,
      isBreaking,
      breakingPriority: isBreaking ? breakingPriority : undefined,
      breakingEndsAt: breakingEndsAt || undefined,
    };

    if (id) {
      await updateMutation.mutateAsync(data);
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleAutoSlug = () => {
    if (!slug && title) {
      setSlug(
        title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      );
    }
  };

  if (id && isLoading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/articles')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {id ? 'Edit Article' : 'New Article'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave()}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save Draft
          </button>
          {id && article?.status === 'DRAFT' && (
            <button
              onClick={() => workflowMutation.mutate('submit-review')}
              disabled={workflowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Submit Review
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
              disabled={workflowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
            >
              <Globe className="h-4 w-4" />
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleAutoSlug}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Article title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="article-slug"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Brief summary of the article"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <div className="mt-1">
              <RichTextEditor content={content} onChange={setContent} placeholder="Write your article..." />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-900">SEO</h3>
            <div className="mt-4 space-y-3">
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={500} placeholder="SEO title (optional)" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={2000} rows={2} placeholder="SEO description (optional)" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} maxLength={1000} placeholder="Keywords, comma separated" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <input value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} maxLength={2000} placeholder="Canonical URL (optional)" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} /> Do not index this article</label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
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
                  onClick={() => setShowMediaBrowser(true)}
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
        </div>
      </div>

      {showMediaBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl" style={{ maxHeight: '80vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Select Featured Image</h2>
              <button onClick={() => setShowMediaBrowser(false)} className="text-gray-400 hover:text-gray-600">
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
                    onClick={() => {
                      setFeaturedImageId(item.id);
                      setShowMediaBrowser(false);
                    }}
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
