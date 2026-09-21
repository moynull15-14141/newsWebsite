import { Link } from 'react-router-dom';

const quickLinks = [
  { label: 'Bangladesh', href: '/bangladesh' },
  { label: 'World', href: '/category/world' },
  { label: 'Politics', href: '/category/politics' },
  { label: 'Business', href: '/category/business' },
  { label: 'Sports', href: '/category/sports' },
];

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="container-wide py-12 lg:py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link to="/" className="text-xl font-bold text-white">
              BD News
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Bangladesh-first, world-aware news platform. Delivering accurate and timely reporting on the stories that matter most.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-neutral-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              About
            </h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              BD News provides independent, unbiased journalism covering Bangladesh and the world. Our team of experienced reporters is committed to truth and transparency.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} BD News. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
