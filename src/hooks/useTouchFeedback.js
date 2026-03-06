import { useState, useCallback, useRef, useEffect } from 'react';

export const useTouchFeedback = (options = {}) => {
  const {
    scale = 0.95,
    duration = 150
  } = options;

  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef(null);

  const handlePressStart = useCallback((e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    setIsPressed(true);
  }, []);

  const handlePressEnd = useCallback((e) => {
    if (e.type === 'keyup' && e.key !== 'Enter' && e.key !== ' ') return;
    timeoutRef.current = setTimeout(() => {
      setIsPressed(false);
    }, duration);
  }, [duration]);

  const handlePressCancel = useCallback((e) => {
    setIsPressed(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTransform = () => {
    if (isPressed) {
      return `scale(${scale})`;
    }
    return 'scale(1)';
  };

  const getOpacity = () => {
    if (isPressed) {
      return 0.85;
    }
    return 1;
  };

  const getEventHandlers = () => ({
    onMouseDown: handlePressStart,
    onMouseUp: handlePressEnd,
    onMouseLeave: handlePressCancel,
    onTouchStart: handlePressStart,
    onTouchEnd: handlePressEnd,
    onTouchCancel: handlePressCancel,
    onKeyDown: handlePressStart,
    onKeyUp: handlePressEnd
  });

  return {
    isPressed,
    getTransform,
    getOpacity,
    getEventHandlers,
    style: {
      transform: getTransform(),
      opacity: getOpacity(),
      transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTapHighlightColor: 'transparent'
    }
  };
};

export default useTouchFeedback;

