import React, { useRef } from 'react';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';

const PageTransition = ({
  children,
  animation = 'fade',
  direction = 'up',
  duration = 300,
  className = '',
  onTransitionEnd,
  keyboardNav = false
}) => {
  const containerRef = useRef(null);

  useKeyboardNavigation({
    containerRef,
    ...(keyboardNav && { onEscape: onTransitionEnd })
  });

  const style = {
    animation: `${animation}-in ${duration}ms ease-out both`,
    ...(direction === 'up' ? { animationDelay: '50ms' } : {}),
    ...(animation === 'slide' ? {
      animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
    } : {}),
    ...(animation === 'scale' ? {
      animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
    } : {})
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      role="region"
      aria-label="页面内容"
    >
      {children}
    </div>
  );
};

const Modal = ({
  isOpen,
  onClose,
  children,
  position = 'bottom',
  animation = 'slide',
  backdrop = true,
  backdropBlur = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
  style = {}
}) => {
  const modalRef = React.useRef(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsClosing(true);
      setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 250);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  const getPositionStyles = () => {
    switch (position) {
      case 'center':
        return {
          // No absolute positioning needed if using flex on parent
        };
      case 'top':
        return {
          top: '0',
          left: '0',
          right: '0'
        };
      case 'bottom':
        return {
          bottom: '0',
          left: '0',
          right: '0'
        };
      default:
        return {
          bottom: '0',
          left: '0',
          right: '0'
        };
    }
  };

  const getAnimation = () => {
    if (isClosing) {
      switch (position) {
        case 'bottom':
          return 'slide-out-to-bottom 0.3s ease-in forwards';
        case 'top':
          return 'slide-out-to-top 0.3s ease-in forwards';
        case 'center':
          return 'fade-out 0.2s ease-in forwards';
        default:
          return 'slide-out-to-bottom 0.3s ease-in forwards';
      }
    }

    switch (position) {
      case 'bottom':
        return 'slide-in-from-bottom 0.3s ease-out forwards';
      case 'top':
        return 'slide-in-from-top 0.3s ease-out forwards';
      case 'center':
        return 'zoom-in-110 0.25s ease-out forwards';
      default:
        return 'slide-in-from-bottom 0.3s ease-out forwards';
    }
  };

  if (!isVisible && !isOpen) return null;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: position === 'center' ? 'column' : 'column-reverse',
        justifyContent: position === 'center' ? 'center' : 'flex-start',
        alignItems: position === 'center' ? 'center' : 'stretch',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
      role="dialog"
      aria-modal="true"
      aria-label="弹窗"
    >
      {backdrop && (
        <div
          onClick={closeOnBackdrop ? onClose : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: backdropBlur ? 'blur(4px)' : undefined,
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: isVisible ? 'auto' : 'none',
            cursor: closeOnBackdrop ? 'pointer' : 'default'
          }}
        />
      )}
      <div
        className={className}
        style={{
          ...getPositionStyles(),
          ...style,
          position: 'relative',
          animation: getAnimation(),
          pointerEvents: isVisible ? 'auto' : 'none',
          maxWidth: position === 'center' ? '480px' : '100%',
          width: '100%',
          margin: '0 auto'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export { PageTransition, Modal };
export default PageTransition;
