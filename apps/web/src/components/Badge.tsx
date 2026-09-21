import { forwardRef } from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'category' | 'breaking' | 'neutral' | 'success' | 'warning' | 'error' | 'info';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({
    className,
    variant = 'neutral',
    ...props
  }, ref) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider';

    const variantClasses = {
      category: 'bg-primary-500 text-primary-50',
      breaking: 'bg-accent-600 text-accent-50 motion-safe:animate-pulse',
      neutral: 'bg-neutral-200 text-neutral-800',
      success: 'bg-success-500 text-success-50',
      warning: 'bg-warning-500 text-warning-50',
      error: 'bg-error-500 text-error-50',
      info: 'bg-info-500 text-info-50',
    }[variant];

    return (
      <span
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${className || ''}`}
        {...props}
      >
        {props.children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export type { BadgeProps };
