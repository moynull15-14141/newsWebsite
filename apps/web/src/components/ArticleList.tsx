import ArticleCard from './ArticleCard';
import { SectionHeading } from './SectionHeading';
import { Button } from './Button';
import { useLanguage } from '@/lib/i18n';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  author?: { id: string; name: string } | null;
  category?: { id: string; name: string; slug: string } | null;
  imageUrl?: string;
  featuredImageUrl?: string;
  media?: { id: string; publicUrl: string } | null;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ArticleListProps {
  articles: Article[];
  title?: string;
  subtitle?: string;
  variant?: 'featured' | 'large' | 'horizontal' | 'compact' | 'image-top' | 'text-only' | 'video' | 'opinion' | 'standard';
  showPagination?: boolean;
  meta?: Meta;
  onPageChange?: (page: number) => void;
  /** Overrides the generic "No articles found" text for a context-specific empty state (e.g. search). */
  emptyMessage?: string;
}

export default function ArticleList({
  articles,
  title,
  subtitle,
  variant = 'standard',
  showPagination = false,
  meta,
  onPageChange,
  emptyMessage,
}: ArticleListProps) {
  const { t } = useLanguage();

  if (!articles.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-neutral-500">{emptyMessage ?? t('common.noArticlesFound')}</p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <SectionHeading title={title} subtitle={subtitle} variant="default" />
      )}

      <div className="space-y-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} variant={variant} />
        ))}
      </div>

      {showPagination && meta && meta.totalPages > 1 && onPageChange && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            onClick={() => onPageChange(meta.page - 1)}
            disabled={meta.page <= 1}
            variant="secondary"
            size="sm"
          >
            {t('common.previous')}
          </Button>

          {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (meta.totalPages <= 5) {
              pageNum = i + 1;
            } else if (meta.page <= 3) {
              pageNum = i + 1;
            } else if (meta.page >= meta.totalPages - 2) {
              pageNum = meta.totalPages - 4 + i;
            } else {
              pageNum = meta.page - 2 + i;
            }
            return (
              <Button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                variant={pageNum === meta.page ? 'primary' : 'ghost'}
                size="sm"
                className="h-8 w-8 min-w-[2rem] rounded"
              >
                {pageNum}
              </Button>
            );
          })}

          <Button
            onClick={() => onPageChange(meta.page + 1)}
            disabled={meta.page >= meta.totalPages}
            variant="secondary"
            size="sm"
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
