import React, { useState, useId } from 'react';

const Input = React.forwardRef(
  (
    {
      icon = null,
      label = '',
      className = '',
      wrapperClassName = '',
      error,
      helperText,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const [isFocused, setIsFocused] = useState(false);
    const isFilled = props.value !== undefined && props.value !== null && props.value.toString().length > 0;
    const isFloating = isFocused || isFilled;
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText && !error ? `${id}-helper` : undefined;
    const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`relative w-full group ${wrapperClassName}`}>
        {icon && (
          <span
            className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-tertiary transition-colors z-10 pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          className={`peer w-full bg-surface-container-low border border-border-glass rounded-xl py-3.5 text-body-md focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/50 transition-all text-on-surface placeholder:text-transparent ${icon ? 'pl-12 pr-4' : 'px-4'} ${error ? 'border-error focus:border-error focus:ring-error/50' : ''} ${className}`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={label}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-required={props.required}
          {...props}
        />

        {label && (
          <label
            htmlFor={id}
            className={`absolute ${icon ? 'left-12' : 'left-4'} transition-all duration-300 pointer-events-none text-on-surface-variant ${
              isFloating
                ? '-top-2.5 text-xs bg-surface-container px-2 rounded-md text-tertiary font-bold shadow-sm'
                : 'top-3.5 text-body-md'
            }`}
          >
            {label}
          </label>
        )}

        {/* Subtle bottom glow effect when focused */}
        <div
          className={`absolute bottom-0 left-0 h-[2px] w-0 bg-tertiary transition-all duration-500 peer-focus:w-full rounded-b-xl opacity-50 ${error ? 'bg-error' : ''}`}
          aria-hidden="true"
        ></div>

        {error && (
          <p id={errorId} className="mt-1.5 text-sm font-medium text-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-sm text-text-muted" aria-live="polite">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;