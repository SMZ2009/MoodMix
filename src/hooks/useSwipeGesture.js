import { useState, useCallback, useRef, useEffect } from 'react';

export const useSwipeGesture = (options = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    maxRotation = 15,
    resistance = 3
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const elementRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(Date.now());

  const handleTouchStart = useCallback((e) => {
    // 兼容鼠标和触摸
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    setStartPos({ x: clientX, y: clientY });
    setCurrentPos({ x: 0, y: 0 });
    setIsDragging(true);
    lastPosRef.current = { x: clientX, y: clientY };
    lastTimeRef.current = Date.now();
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;

    const now = Date.now();
    const timeDelta = now - lastTimeRef.current;

    if (timeDelta > 0) {
      setVelocity({
        x: (clientX - lastPosRef.current.x) / timeDelta * 16,
        y: (clientY - lastPosRef.current.y) / timeDelta * 16
      });
    }

    lastPosRef.current = { x: clientX, y: clientY };
    lastTimeRef.current = now;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const resistanceFactor = Math.max(1, Math.abs(deltaX) / 100 * resistance);
      setCurrentPos({ x: deltaX / resistanceFactor, y: 0 });
    } else {
      const resistanceFactor = Math.max(1, Math.abs(deltaY) / 100 * resistance);
      setCurrentPos({ x: 0, y: deltaY / resistanceFactor });
    }
  }, [isDragging, startPos.x, startPos.y, resistance]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    const swipeVelocity = Math.abs(velocity.x) > Math.abs(velocity.y) ? velocity.x : velocity.y;
    const swipeDistance = Math.abs(currentPos.x || currentPos.y);

    if (swipeDistance > threshold || Math.abs(swipeVelocity) > threshold * 0.5) {
      if (currentPos.x > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (currentPos.x < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (currentPos.y < 0 && onSwipeUp) {
        onSwipeUp();
      } else if (currentPos.y > 0 && onSwipeDown) {
        onSwipeDown();
      }
    }

    setIsDragging(false);
    setCurrentPos({ x: 0, y: 0 });
    setVelocity({ x: 0, y: 0 });
  }, [isDragging, velocity, currentPos, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const getTransform = () => {
    const x = currentPos.x;
    const y = currentPos.y;
    const rotation = (x / window.innerWidth) * maxRotation;
    return `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
  };

  const getOpacity = () => {
    const maxDistance = window.innerWidth * 0.3;
    const progress = Math.abs(currentPos.x) / maxDistance;
    return Math.max(0.3, 1 - progress * 0.7);
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    
    // 电脑端模拟
    const handleMouseDown = (e) => handleTouchStart(e);
    const handleMouseMove = (e) => handleTouchMove(e);
    const handleMouseUp = () => handleTouchEnd();

    element.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      element.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // --- 重要：必须有 return，否则 SwipeableCard 拿不到数据 ---
  return {
    elementRef,
    isDragging,
    currentPos,
    getTransform,
    getOpacity,
    setElementRef: (ref) => { elementRef.current = ref; }
  };
};

export default useSwipeGesture;