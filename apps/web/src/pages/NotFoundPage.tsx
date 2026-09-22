import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';

export default function NotFoundPage() {
  const { t, code, pathFor } = useLanguage();
  return (
    <><SeoHead title="Page not found" noIndex /><div className="container-wide py-16 text-center">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="mt-4 text-lg text-gray-600">{t('common.404Title')}</p>
      <Link to={pathFor('/', code)} className="mt-6 inline-block text-primary-500 hover:underline">
        {t('common.backHome')}
      </Link>
    </div></>
  );
}
