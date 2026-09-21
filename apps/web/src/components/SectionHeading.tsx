import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

interface SectionHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
  level?: 1 | 2 | 3 | 4;
  variant?: 'default' | 'centered' | 'minimal';
  headingProps?: React.HTMLAttributes<HTMLHeadingElement>;
}

const SectionHeading = forwardRef<HTMLHeadingElement, SectionHeadingProps>(
  (
    { title, subtitle, href, linkText = 'View all', level = 2, variant = 'default', headingProps, className, ...props },
    ref
  ) => {
    const variantClasses = {
      default: 'flex items-center justify-between',
      centered: 'text-center',
      minimal: '',
    }[variant];

    const titleClasses = {
      default: 'section-heading text-neutral-800',
      centered: 'section-heading text-neutral-800',
      minimal: 'text-lg font-semibold text-neutral-700',
    }[variant];

    const subtitleClasses = {
      default: 'mt-1 text-sm text-neutral-500',
      centered: 'mx-auto mt-2 max-w-md text-sm text-neutral-500',
      minimal: 'mt-1 text-xs text-neutral-500',
    }[variant];

    const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';

    return (
      <div className={`mb-6 ${variantClasses} ${className || ''}`} {...props}>
        <HeadingTag
          {...headingProps}
          ref={ref}
          className={`${titleClasses} ${headingProps?.className || ''}`}
        >
          {title}
        </HeadingTag>
        {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
        {href && (
          <Link
            to={href}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            {linkText}
          </Link>
        )}
      </div>
    );
  }
);

SectionHeading.displayName = 'SectionHeading';

export { SectionHeading };
export type { SectionHeadingProps };
