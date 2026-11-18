import React, { useState, useEffect, useCallback } from 'react';
import { ToastContext } from '../context/ToastContextInstance';

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', options = {}) => {
    const id = Date.now() + Math.random();
    const duration = options.duration ?? 4000;

    setToasts(prev => [...prev, { id, message, type, duration }]);

    // Return dismiss function for manual control
    return () => removeToast(id);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDone={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onDone }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const DURATION = toast.duration;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 300);
    }, DURATION);

    return () => clearTimeout(timer);
  }, [onDone, DURATION]);

  const styleMap = {
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 dark:text-emerald-300',
      icon: 'check_circle',
      progress: 'bg-emerald-500/50'
    },
    error: {
      bg: 'bg-red-500/10 border-red-500/20 text-red-400 dark:text-red-300',
      icon: 'error',
      progress: 'bg-red-500/50'
    },
    info: {
      bg: 'bg-primary/10 border-primary/20 text-primary dark:text-primary-300',
      icon: 'info',
      progress: 'bg-primary/50'
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400 dark:text-amber-300',
      icon: 'warning',
      progress: 'bg-amber-500/50'
    }
  };

  const currentStyle = styleMap[toast.type] || styleMap.info;

  return (
    <div
      className={`pointer-events-auto flex flex-col overflow-hidden rounded-xl shadow-2xl backdrop-blur-xl border transition-all duration-300 ease-out ${
        currentStyle.bg
      } bg-surface-container-lowest/80 ${
        visible && !exiting
          ? 'opacity-100 translate-x-0 translate-y-0 scale-100'
          : 'opacity-0 translate-x-8 translate-y-2 scale-95'
      }`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="flex items-center gap-3 px-5 py-4 min-w-[300px] max-w-md">
        <span
          className="material-symbols-outlined text-[20px] flex-shrink-0"
          aria-hidden="true"
        >
          {currentStyle.icon}
        </span>
        <span className="text-sm font-medium font-body-md text-on-surface flex-1 min-w-0">
          {toast.message}
        </span>
        <button
          onClick={() => {
            setExiting(true);
            setTimeout(onDone, 300);
          }}
          className="ml-auto text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container-lowest"
          aria-label="Dismiss notification"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      <div className="h-1 w-full bg-surface-container-high/50" aria-hidden="true">
        <div
          className={`h-full ${currentStyle.progress} origin-left transition-transform duration-300 ease-linear ${
            exiting ? 'scale-x-0' : 'scale-x-100'
          }`}
          style={{
            transformOrigin: 'left center',
            transform: exiting ? 'scaleX(0)' : 'scaleX(1)',
            transitionDuration: `${DURATION}ms`,
            transitionTimingFunction: 'linear',
          }}
        />
      </div>
    </div>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};