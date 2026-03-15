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
      background: 'linear-gradient(135deg, #3c3b36 0%, #1a1a1a 100%)',
      color: '#ebdfc8',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.85)',
      color: '#3c3b36',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      border: '1px solid rgba(0, 0, 0, 0.05)'
    },
    ghost: {
      background: 'transparent',
      color: '#3c3b36'
    },
    text: {
      background: 'transparent',
      color: '#8a7e6b',
      padding: '0 16px'
    },
    danger: {
      background: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
      color: '#f7f0e4',
      boxShadow: '0 4px 12px rgba(153, 27, 27, 0.2)'
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
    width: fullWidth ? '100%' : undefined,
    ...customStyle,  // customStyle 最后覆盖，确保调用方样式优先
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
