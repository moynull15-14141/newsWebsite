import { Clock } from 'lucide-react';
import Dialog from './Dialog';
import TiptapRenderer from './TiptapRenderer';

interface ArticlePreviewModalProps {
  title: string;
  excerpt: string;
  content: string;
  categoryName: string | null;
  authorName: string;
  publishedAt: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  onClose: () => void;
}

function estimateReadingTime(content: string): number {
  if (!content) return 1;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Renders the article the same way apps/web/src/pages/ArticlePage.tsx does (same TiptapRenderer, same
 * `prose prose-lg font-serif` typography, same category badge / byline layout) so what an editor sees
 * here before publishing is what a reader will actually see — not an approximation. Reads straight from
 * the editor's current in-memory form state (title/excerpt/content/etc.), including unsaved changes,
 * since "how will this look" is exactly as useful before the first save as it is right before publishing.
 */
export default function ArticlePreviewModal({
  title, excerpt, content, categoryName, authorName, publishedAt, imageUrl, imageAlt, onClose,
}: ArticlePreviewModalProps) {
  const readingTime = estimateReadingTime(content);

  return (
    <Dialog title="Preview" description="This is a preview — it is not the live public page, but uses the exact same rendering." size="lg" onClose={onClose}>
      <div role="status" className="-mx-6 -mt-2 mb-4 bg-amber-400 px-6 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-gray-900">
        Preview only — not the live page
      </div>

      <article className="px-1">
        {categoryName && (
          <span className="mb-3 inline-block rounded bg-primary-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {categoryName}
          </span>
        )}

        <h1 className="text-3xl font-bold leading-tight text-gray-900">{title || 'Untitled article'}</h1>

        {excerpt && <p className="mt-3 text-lg leading-relaxed text-gray-600">{excerpt}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{authorName}</span>
          <span>&middot;</span>
          <span>{publishedAt ? new Date(publishedAt).toLocaleDateString() : 'Not yet published'}</span>
          <span>&middot;</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {readingTime} min read
          </span>
        </div>

        {imageUrl && (
          <figure className="my-8">
            <img src={imageUrl} alt={imageAlt || title} className="w-full rounded-lg" />
          </figure>
        )}

        <div className="prose prose-lg max-w-none font-serif">
          {content && <TiptapRenderer content={content} />}
        </div>
      </article>
    </Dialog>
  );
}
