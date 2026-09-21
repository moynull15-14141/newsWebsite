import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    ...props
  }, ref) => {
    const BaseClasses = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
    
    const variantClasses = {
      primary: 'bg-primary-600 text-primary-50 hover:bg-primary-700 focus:bg-primary-700 focus:ring-primary-300',
      secondary: 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300 focus:bg-neutral-300 focus:ring-neutral-300',
      ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 focus:bg-neutral-100 focus:ring-neutral-200',
      accent: 'bg-accent-600 text-accent-50 hover:bg-accent-700 focus:bg-accent-700 focus:ring-accent-300',
    }[variant];
    
    const sizeClasses = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-10 px-4',
      lg: 'h-11 px-5 text-lg',
    }[size];
    
    return (
      <button
        ref={ref}
        className={`${BaseClasses} ${variantClasses} ${sizeClasses} ${className || ''}`}
        {...props}
      >
        {props.children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
