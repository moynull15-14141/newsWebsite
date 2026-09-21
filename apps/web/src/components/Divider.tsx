import { forwardRef } from 'react';

interface DividerProps extends Omit<React.HTMLAttributes<HTMLHRElement>, 'children'> {
  variant?: 'default' | 'accent';
}

const Divider = forwardRef<HTMLHRElement, DividerProps>(
  ({
    className,
    variant = 'default',
    ...props
  }, ref) => {
    const BaseClasses = 'h-px mx-4 my-4';
    
    const variantClasses = {
      default: 'bg-neutral-200',
      accent: 'bg-accent-200',
    }[variant];
    
    return (
      <hr
        ref={ref}
        className={`${BaseClasses} border-0 ${variantClasses} ${className || ''}`}
        {...props}
      />
    );
  }
);

Divider.displayName = 'Divider';

export { Divider };
export type { DividerProps };
