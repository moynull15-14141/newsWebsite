import { forwardRef } from 'react';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'standard' | 'wide' | 'narrow' | 'article';
}

const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = 'wide', className, children, ...props }, ref) => {
    const sizeClasses = {
      standard: 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8',
      wide: 'container-wide',
      narrow: 'container-narrow',
      article: 'mx-auto max-w-3xl px-4 sm:px-6 lg:px-8',
    }[size];

    return (
      <div
        ref={ref}
        className={`${sizeClasses} ${className || ''}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

export { Container };
export type { ContainerProps };
