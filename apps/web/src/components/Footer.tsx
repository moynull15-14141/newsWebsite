import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';

const quickLinkKeys = [
  { key: 'nav.bangladesh', href: '/bangladesh' },
  { key: 'nav.world', href: '/category/world' },
  { key: 'nav.politics', href: '/category/politics' },
  { key: 'nav.business', href: '/category/business' },
  { key: 'nav.sports', href: '/category/sports' },
] as const;

export default function Footer() {
  const { code, t, pathFor } = useLanguage();

  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="container-wide py-12 lg:py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link to={pathFor('/', code)} className="text-xl font-bold text-white">
              {t('header.siteName')}
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2">
              {quickLinkKeys.map((link) => (
                <li key={link.href}>
                  <Link
                    to={pathFor(link.href, code)}
                    className="text-sm text-neutral-400 transition-colors hover:text-white"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.about')}
            </h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t('footer.aboutText')}
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} {t('header.siteName')}. {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
}
