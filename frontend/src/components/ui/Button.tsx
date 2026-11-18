import React, { forwardRef } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'gradient'
  | 'ghost'
  | 'outline'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 hover:bg-primary/90 active:bg-primary',
  secondary: 'bg-surface-glass border border-border-glass text-on-surface-variant font-bold hover:bg-surface-container-high hover:text-on-surface hover:border-primary/30 backdrop-blur-md active:bg-surface-container-high',
  gradient: 'btn-gradient text-white font-bold rounded-xl hover:scale-105 shadow-xl shadow-purple-900/30 active:scale-100',
  ghost: 'text-on-surface-variant hover:bg-surface-glass hover:text-on-surface backdrop-blur-md active:bg-surface-glass',
  outline: 'border border-border-glass text-on-surface hover:bg-surface-glass hover:border-primary/40 backdrop-blur-md active:bg-surface-glass',
  danger: 'bg-error-container/20 text-error hover:bg-error-container border border-error/30 hover:text-on-error-container active:bg-error-container',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-label-sm gap-1.5',
  md: 'px-6 py-2.5 text-label-sm gap-2',
  lg: 'px-8 py-3 text-body-md gap-2.5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon = null,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      disabled = false,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseClass =
      'inline-flex items-center justify-center font-label-sm transition-all duration-300 rounded-xl active:scale-95 disabled:opacity-60 disabled:pointer-events-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface';

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[18px]" aria-hidden="true">
              sync
            </span>
            <span className="sr-only">Loading...</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {icon}
              </span>
            )}
            <span>{children}</span>
            {icon && iconPosition === 'right' && (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {icon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;