import React, { forwardRef } from 'react';
import { useTouchFeedback } from '../../hooks/useTouchFeedback';

const InteractiveButton = forwardRef(({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  style: customStyle = {},
  onClick,
  ...props
}, ref) => {
  const {
    style: feedbackStyle,
    getEventHandlers
  } = useTouchFeedback({
    scale: variant === 'icon' ? 0.9 : 0.96,
    duration: 120
  });

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    position: 'relative',
    overflow: 'hidden',
    ...feedbackStyle,
    ...customStyle
  };

  const sizeStyles = {
    small: {
      height: '36px',
      padding: '0 12px',
      fontSize: '13px',
      borderRadius: '18px'
    },
    medium: {
      height: '48px',
      padding: '0 24px',
      fontSize: '14px',
      borderRadius: '24px'
    },
    large: {
      height: '56px',
      padding: '0 32px',
      fontSize: '16px',
      borderRadius: '28px'
    },
    icon: {
      width: '44px',
      height: '44px',
      padding: '0',
      borderRadius: '50%'
    }
  };

  const variantStyles = {
    primary: {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
      color: '#FFFFFF',
      boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
    },
    secondary: {
      background: '#FFFFFF',
      color: '#1F2937',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
    },
    ghost: {
      background: 'transparent',
      color: '#1F2937'
    },
    text: {
      background: 'transparent',
      color: '#8B5CF6',
      padding: '0 16px'
    },
    danger: {
      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      color: '#FFFFFF',
      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
    },
    icon: {
      background: 'rgba(255, 255, 255, 0.9)',
      color: '#1F2937',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }
  };

  const mergedStyle = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    width: fullWidth ? '100%' : undefined
  };

  const iconSize = {
    small: 14,
    medium: 18,
    large: 22,
    icon: 20
  }[size];

  const eventHandlers = getEventHandlers();

  const handleClick = (e) => {
    if (onClick && !disabled && !loading) {
      onClick(e);
    }
  };

  return (
    <button
      ref={ref}
      style={mergedStyle}
      className={className}
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseDown={eventHandlers.onMouseDown}
      onMouseUp={eventHandlers.onMouseUp}
      onMouseLeave={eventHandlers.onMouseLeave}
      onTouchStart={eventHandlers.onTouchStart}
      onTouchEnd={eventHandlers.onTouchEnd}
      onTouchCancel={eventHandlers.onTouchCancel}
      onKeyDown={eventHandlers.onKeyDown}
      onKeyUp={eventHandlers.onKeyUp}
      {...props}
    >
      {loading && (
        <svg
          style={{
            animation: 'spin 1s linear infinite',
            marginRight: iconPosition === 'left' ? '8px' : 0,
            marginLeft: iconPosition === 'right' ? '8px' : 0
          }}
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      )}
      {Icon && !loading && iconPosition === 'left' && (
        <Icon size={iconSize} style={{ marginRight: '8px' }} />
      )}
      {children}
      {Icon && !loading && iconPosition === 'right' && (
        <Icon size={iconSize} style={{ marginLeft: '8px' }} />
      )}
    </button>
  );
});

InteractiveButton.displayName = 'InteractiveButton';

export default InteractiveButton;
