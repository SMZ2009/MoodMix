import React from 'react';

const LoadingSkeleton = ({
  variant = 'text',
  width,
  height,
  className = '',
  style = {},
  animate = true
}) => {
  const baseStyles = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: animate ? 'shimmer 1.5s infinite' : 'none',
    borderRadius: variant === 'circle' ? '50%' : '8px',
    ...style
  };

  if (width) baseStyles.width = width;
  if (height) baseStyles.height = height;

  return <div className={className} style={baseStyles} />;
};

const SkeletonCard = ({ cardType = 'drink' }) => {
  if (cardType === 'drink') {
    return (
      <div style={{ padding: '16px', borderRadius: '24px', background: '#fff' }}>
        <LoadingSkeleton variant="rectangle" width="100%" height="200px" style={{ borderRadius: '20px', marginBottom: '12px' }} />
        <LoadingSkeleton width="70%" height="20px" style={{ marginBottom: '8px' }} />
        <LoadingSkeleton width="50%" height="14px" />
      </div>
    );
  }

  if (cardType === 'list') {
    return (
      <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <LoadingSkeleton variant="rectangle" width="60px" height="60px" style={{ borderRadius: '16px' }} />
        <div style={{ flex: 1 }}>
          <LoadingSkeleton width="60%" height="16px" style={{ marginBottom: '8px' }} />
          <LoadingSkeleton width="40%" height="12px" />
        </div>
      </div>
    );
  }

  if (cardType === 'ingredient') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px' }}>
        <LoadingSkeleton variant="circle" width="56px" height="56px" style={{ borderRadius: '50%' }} />
        <LoadingSkeleton width="40px" height="12px" />
      </div>
    );
  }

  return null;
};

const ProgressBar = ({
  value = 0,
  max = 100,
  height = 8,
  color = 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)',
  showLabel = false,
  animated = true
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>进度</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          background: '#E5E7EB',
          borderRadius: `${height / 2}px`,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: color,
            borderRadius: `${height / 2}px`,
            transition: 'width 0.3s ease',
            animation: animated ? 'progressPulse 2s ease-in-out infinite' : 'none'
          }}
        />
      </div>
    </div>
  );
};

const GeneratingLoader = ({ text = "正在共鸣情绪风味..." }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px'
    }}>
      <div style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        marginBottom: '24px'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '3px solid transparent',
              borderTopColor: '#8B5CF6',
              borderRadius: '50%',
              animation: `spin ${1.2 / (i + 1)}s linear infinite`,
              opacity: 0.3 + (i * 0.2),
              transform: `rotate(${i * 60}deg)`
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '30px',
            height: '30px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
            borderRadius: '50%',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
          }}
        />
      </div>
      <p style={{
        color: '#fff',
        fontSize: '18px',
        fontWeight: '500',
        letterSpacing: '2px',
        textAlign: 'center'
      }}>
        {text}
      </p>
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              background: '#8B5CF6',
              borderRadius: '50%',
              animation: `bounce ${0.6 + i * 0.2}s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export { LoadingSkeleton, SkeletonCard, ProgressBar, GeneratingLoader };
export default LoadingSkeleton;
