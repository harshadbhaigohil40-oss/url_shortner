import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  loading = false, 
  icon = null,
  iconPosition = 'left',
  className = '', 
  disabled = false,
  ...props 
}) => {
  let baseClass = "px-6 py-2.5 rounded-xl font-label-sm text-label-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:opacity-60 disabled:pointer-events-none cursor-pointer";
  
  if (variant === 'primary') {
    baseClass += " bg-primary text-on-primary font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 hover:bg-primary/90";
  } else if (variant === 'secondary') {
    baseClass += " bg-surface-glass border border-border-glass text-on-surface-variant font-bold hover:bg-surface-container-high hover:text-on-surface hover:border-primary/30 backdrop-blur-md";
  } else if (variant === 'gradient') {
    baseClass += " btn-gradient text-white font-bold rounded-xl hover:scale-105 shadow-xl shadow-purple-900/30";
  } else if (variant === 'ghost') {
    baseClass += " text-on-surface-variant hover:bg-surface-glass hover:text-on-surface backdrop-blur-md";
  } else if (variant === 'outline') {
    baseClass += " border border-border-glass text-on-surface hover:bg-surface-glass hover:border-primary/40 backdrop-blur-md";
  } else if (variant === 'danger') {
    baseClass += " bg-error-container/20 text-error hover:bg-error-container border border-error/30 hover:text-on-error-container";
  }

  return (
    <button 
      className={`${baseClass} ${className}`} 
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
      ) : (
        icon && iconPosition === 'left' && <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
      
      <span>{loading ? 'Processing...' : children}</span>
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
    </button>
  );
};

export default Button;
