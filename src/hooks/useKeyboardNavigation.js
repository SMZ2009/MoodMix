import { useEffect, useCallback, useRef } from 'react';

export const useKeyboardNavigation = (options = {}) => {
  const {
    selectors = 'button, [role="button"], a, input, select, textarea',
    onArrowLeft,
    onArrowRight,
    onArrowUp,
    onArrowDown,
    onEnter,
    onEscape,
    cycle = true
  } = options;

  const containerRef = useRef(null);
  const focusableElementsRef = useRef([]);

  const updateFocusableElements = useCallback(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll(selectors);
    focusableElementsRef.current = Array.from(elements).filter(
      el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
    );
  }, [selectors]);

  const getFocusableIndex = useCallback(() => {
    const activeElement = document.activeElement;
    return focusableElementsRef.current.indexOf(activeElement);
  }, []);

  const handleKeyDown = useCallback((e) => {
    const currentIndex = getFocusableIndex();

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        if (onArrowLeft || onArrowUp) {
          const handler = e.key === 'ArrowLeft' ? onArrowLeft : onArrowUp;
          handler();
        }
        if (currentIndex > 0) {
          focusableElementsRef.current[currentIndex - 1]?.focus();
        } else if (cycle) {
          focusableElementsRef.current[focusableElementsRef.current.length - 1]?.focus();
        }
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        if (onArrowRight || onArrowDown) {
          const handler = e.key === 'ArrowRight' ? onArrowRight : onArrowDown;
          handler();
        }
        if (currentIndex < focusableElementsRef.current.length - 1) {
          focusableElementsRef.current[currentIndex + 1]?.focus();
        } else if (cycle) {
          focusableElementsRef.current[0]?.focus();
        }
        break;

      case 'Enter':
      case ' ':
        if (onEnter) {
          onEnter(e.target);
        }
        break;

      case 'Escape':
        if (onEscape) {
          onEscape();
        }
        break;

      case 'Tab':
        updateFocusableElements();
        break;

      default:
        break;
    }
  }, [cycle, getFocusableIndex, onArrowLeft, onArrowRight, onArrowUp, onArrowDown, onEnter, onEscape, updateFocusableElements]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    updateFocusableElements();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, updateFocusableElements]);

  useEffect(() => {
    updateFocusableElements();
  }, [updateFocusableElements]);

  return {
    containerRef,
    focusableElements: focusableElementsRef.current,
    updateFocusableElements,
    setContainerRef: (ref) => { containerRef.current = ref; }
  };
};

export default useKeyboardNavigation;
