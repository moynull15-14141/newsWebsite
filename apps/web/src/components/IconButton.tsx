import { forwardRef } from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({
    className,
    variant = 'default',
    size = 'md',
    'aria-label': ariaLabel,
    ...props
  }, ref) => {
    const BaseClasses = 'inline-flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50';
    
    const variantClasses = {
      default: 'p-2 text-neutral-600 hover:bg-neutral-100 focus:bg-neutral-100 focus:ring-neutral-200',
      accent: 'p-2 text-accent-600 hover:bg-accent-50 focus:bg-accent-50 focus:ring-accent-200',
    }[variant];
    
    const sizeClasses = {
      sm: 'h-8 w-8',
      md: 'h-9 w-9',
      lg: 'h-10 w-10',
    }[size];
    
    return (
      <button
        ref={ref}
        className={`${BaseClasses} ${variantClasses} ${sizeClasses} ${className || ''}`}
        aria-label={ariaLabel}
        {...props}
      >
        {props.children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export { IconButton };
export type { IconButtonProps };
