import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to trap focus within a container element (for modals, drawers, etc.)
 * Follows WAI-ARIA Dialog Pattern
 */
export const useFocusTrap = (isActive: boolean, containerRef: React.RefObject<HTMLElement | null>) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.hasAttribute('disabled')
    );
  }, [containerRef]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return;

      const focusableElements = focusableElementsRef.current;
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isActive]
  );

  useEffect(() => {
    if (!isActive) return;

    // Store the element that had focus before the dialog opened
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements
    focusableElementsRef.current = getFocusableElements();

    // Focus the first focusable element
    if (focusableElementsRef.current.length > 0) {
      focusableElementsRef.current[0].focus();
    }

    // Add event listener for Tab key
    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';

      // Restore focus to the element that triggered the dialog
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, handleKeyDown, getFocusableElements]);

  // Update focusable elements when they might change
  useEffect(() => {
    if (isActive) {
      focusableElementsRef.current = getFocusableElements();
    }
  }, [isActive, getFocusableElements]);
};

/**
 * Hook to manage focus restoration
 */
export const useFocusRestore = () => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, []);

  return { saveFocus, restoreFocus };
};

/**
 * Hook for announcing messages to screen readers
 */
export const useAnnouncer = () => {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      announcer.style.position = 'absolute';
      announcer.style.left = '-9999px';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
        announcerRef.current = null;
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      // Clear and set to trigger announcement
      announcerRef.current.textContent = '';
      // Use setTimeout to ensure the change is detected
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = message;
        }
      }, 0);
    }
  }, []);

  return { announce };
};