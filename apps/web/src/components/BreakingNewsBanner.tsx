import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { X } from 'lucide-react';
import { Badge } from './Badge';
import { IconButton } from './IconButton';

interface BreakingArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  breakingPriority: number;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
}

export default function BreakingNewsBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data: breakingNews } = useQuery<BreakingArticle[]>({
    queryKey: ['breaking-news'],
    queryFn: () => apiFetch('/public/breaking-news'),
    refetchInterval: 300000,
  });

  if (dismissed || !breakingNews?.length) return null;

  return (
    <div className="border-b border-neutral-200 bg-neutral-50">
      <div className="container-wide py-2">
        <div className="flex items-center gap-3">
          <Badge variant="breaking" className="flex-shrink-0">
            Breaking
          </Badge>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex gap-4 overflow-x-auto">
              {breakingNews.map((article) => (
                <Link
                  key={article.id}
                  to={`/article/${article.slug}`}
                  className="flex-shrink-0 text-sm font-medium text-neutral-800 hover:text-primary-500 whitespace-nowrap"
                >
                  {article.title}
                </Link>
              ))}
            </div>
          </div>
          <IconButton
            variant="default"
            size="sm"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
