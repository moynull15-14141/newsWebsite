import { forwardRef } from 'react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({
    className,
    title,
    description,
    icon,
    action,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col items-center justify-center text-center py-12 ${className || ''}`}
        {...props}
      >
        {icon && <div className="h-12 w-12 text-neutral-400 mb-4">{icon}</div>}
        <h3 className="text-lg font-medium text-neutral-800 mb-2">{title}</h3>
        {description && <p className="text-base text-neutral-500 mb-6 max-w-xl">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState };
export type { EmptyStateProps };