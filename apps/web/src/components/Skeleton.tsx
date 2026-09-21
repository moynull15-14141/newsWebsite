import { forwardRef } from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  radius?: string;
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({
    className,
    width,
    height,
    radius,
    style,
    ...props
  }, ref) => {
    const dimensions = {
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(radius !== undefined ? { borderRadius: radius } : {}),
    };

    return (
      <div
        ref={ref}
        style={{ ...dimensions, ...style }}
        className={`animate-pulse bg-neutral-200/50 ${className || ''}`}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
export type { SkeletonProps };
