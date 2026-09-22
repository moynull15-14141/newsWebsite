import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, withLang } from '@/lib/api';
import SeoHead from '@/components/SeoHead';
import { useLanguage } from '@/lib/i18n';

interface CollectionArticle { id: string; slug: string; title: string; excerpt?: string; }
interface Collection { name?: string; description?: string; articles?: CollectionArticle[]; }

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { code, t, pathFor } = useLanguage();
  const { data, isLoading } = useQuery<Collection>({ queryKey: ['collection', slug, code], queryFn: () => apiFetch(withLang(`/public/collections/${slug}`, code)), enabled: !!slug });
  if (isLoading) return <main className="container-wide py-12">{t('collection.loading')}</main>;
  return <><SeoHead title={`${data?.name || t('collection.label')} - BD News`} description={data?.description} /><main className="container-wide py-10"><p className="text-sm font-semibold uppercase tracking-widest text-primary-500">{t('collection.label')}</p><h1 className="mt-2 text-4xl font-bold">{data?.name}</h1>{data?.description && <p className="mt-3 max-w-2xl text-gray-600">{data.description}</p>}<div className="mt-8 grid gap-5 md:grid-cols-2">{data?.articles?.map((article) => <Link key={article.id} to={pathFor(`/article/${article.slug}`, code)} className="rounded border border-gray-200 bg-white p-5 hover:border-primary-400"><h2 className="text-xl font-semibold">{article.title}</h2>{article.excerpt && <p className="mt-2 text-sm text-gray-600">{article.excerpt}</p>}</Link>)}</div></main></>;
}
