import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';

export interface BreadcrumbItem {
  label: string;
  /** Absolute path (no language prefix — pathFor() applies it). Omit on the final/current item. */
  href?: string;
}

/**
 * Shared breadcrumb trail for every discovery page (Category/Tag/Author/Location/Division/District).
 * Always starts at Home; the hierarchy itself (e.g. Bangladesh > Division > District) comes from real
 * API data the caller already fetched — this component only renders it, never invents it.
 */
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { code, t, pathFor } = useLanguage();

  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-neutral-500">
      <Link to={pathFor('/', code)} className="hover:text-primary-500">{t('common.home')}</Link>
      {items.map((item) => (
        <span key={item.label}>
          <span className="mx-2" aria-hidden="true">&gt;</span>
          {item.href ? (
            <Link to={pathFor(item.href, code)} className="hover:text-primary-500">{item.label}</Link>
          ) : (
            <span className="text-neutral-700" aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
