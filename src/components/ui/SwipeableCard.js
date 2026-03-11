import React, { useCallback } from 'react'; // 删掉了无用的 useRef
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useTouchFeedback } from '../../hooks/useTouchFeedback';

const SwipeableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  className = '',
  style: customStyle = {},
  threshold = 60,
  disabled = false
}) => {
  const swipeEnabled = !disabled && Boolean(onSwipeLeft || onSwipeRight || onSwipeUp || onSwipeDown);

  // --- 修改点 1: 从钩子中解构出 elementRef ---
  const {
    getTransform,
    getOpacity,
    isDragging,
    elementRef 
  } = useSwipeGesture({
    enabled: swipeEnabled,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold
  });

  const {
    style: feedbackStyle,
    getEventHandlers
  } = useTouchFeedback({
    scale: 0.98,
    duration: 200
  });

  const handleCardClick = useCallback((e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onTap) {
      onTap();
    }
  }, [isDragging, onTap]);

  const mergedStyle = {
    ...customStyle,
    ...feedbackStyle,
    transform: swipeEnabled && isDragging ? getTransform() : (customStyle.transform || undefined),
    opacity: swipeEnabled && isDragging ? getOpacity() : (customStyle.opacity || undefined),
    cursor: 'pointer',
    touchAction: swipeEnabled && (onSwipeUp || onSwipeDown) ? 'none' : 'auto',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    transition: swipeEnabled && isDragging ? 'none' : 'all 0.5s ease-out'
  };

  const eventHandlers = getEventHandlers();

  return (
    <div
      // --- 修改点 3: 绑定 elementRef 而不是之前的 cardRef ---
      ref={elementRef} 
      className={className}
      style={mergedStyle}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onMouseDown={eventHandlers.onMouseDown}
      onMouseUp={eventHandlers.onMouseUp}
      onMouseLeave={eventHandlers.onMouseLeave}
      onTouchStart={eventHandlers.onTouchStart}
      onTouchEnd={eventHandlers.onTouchEnd}
      onTouchCancel={eventHandlers.onTouchCancel}
      onKeyDown={eventHandlers.onKeyDown}
      onKeyUp={eventHandlers.onKeyUp}
    >
      {children}
    </div>
  );
};

export default SwipeableCard;
