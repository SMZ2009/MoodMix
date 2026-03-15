import React, { useState, useEffect, useCallback } from 'react';

const LOADING_PAGES = [
  {
    id: 'emotion',
    title: '心绪感知',
    subtitle: '正在解读你的心境...',
    icon: 'emotion',
    bgColor: 'from-indigo-900/90 via-purple-900/80 to-slate-900/90',
    accentColor: 'rgba(167, 139, 250, 0.6)',
    particles: 'ripple'
  },
  {
    id: 'wuxing',
    title: '五行推演',
    subtitle: '金木水火土，相生相克...',
    icon: 'wuxing',
    bgColor: 'from-emerald-900/90 via-teal-900/80 to-slate-900/90',
    accentColor: 'rgba(52, 211, 153, 0.6)',
    particles: 'orbit'
  },
  {
    id: 'blend',
    title: '味觉调和',
    subtitle: '正在为你调制专属饮品...',
    icon: 'blend',
    bgColor: 'from-amber-900/90 via-orange-900/80 to-slate-900/90',
    accentColor: 'rgba(251, 191, 36, 0.6)',
    particles: 'bubble'
  }
];

const EmotionIcon = ({ isActive }) => (
  <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24">
    <defs>
      <radialGradient id="emotionGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(167, 139, 250, 0.8)" />
        <stop offset="100%" stopColor="rgba(167, 139, 250, 0)" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#emotionGlow)" className={isActive ? 'animate-pulse' : ''} />
    <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" className={isActive ? 'animate-ping' : ''} style={{ animationDuration: '2s' }} />
    <circle cx="35" cy="40" r="4" fill="rgba(255,255,255,0.9)" />
    <circle cx="65" cy="40" r="4" fill="rgba(255,255,255,0.9)" />
    <path d="M35 60 Q50 75 65 60" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const WuxingIcon = ({ isActive }) => {
  const elements = [
    { name: '木', angle: -90, color: 'rgba(74, 222, 128, 0.9)' },
    { name: '火', angle: -18, color: 'rgba(248, 113, 113, 0.9)' },
    { name: '土', angle: 54, color: 'rgba(251, 191, 36, 0.9)' },
    { name: '金', angle: 126, color: 'rgba(148, 163, 184, 0.9)' },
    { name: '水', angle: 198, color: 'rgba(96, 165, 250, 0.9)' }
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24">
      <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
      {elements.map((el, i) => {
        const rad = (el.angle * Math.PI) / 180;
        const x = 50 + 28 * Math.cos(rad);
        const y = 50 + 28 * Math.sin(rad);
        return (
          <g key={el.name}>
            <circle
              cx={x}
              cy={y}
              r="10"
              fill={el.color}
              className={isActive ? 'animate-pulse' : ''}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize="10"
              fontWeight="bold"
              style={{ fontFamily: '"Songti SC", serif' }}
            >
              {el.name}
            </text>
          </g>
        );
      })}
      <circle cx="50" cy="50" r="8" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
};

const BlendIcon = ({ isActive }) => (
  <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24">
    <defs>
      <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(251, 191, 36, 0.8)" />
        <stop offset="100%" stopColor="rgba(234, 88, 12, 0.9)" />
      </linearGradient>
    </defs>
    <path
      d="M30 30 L35 80 Q50 90 65 80 L70 30 Q50 25 30 30"
      fill="rgba(255,255,255,0.1)"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth="1.5"
    />
    <path
      d="M35 45 Q50 42 65 45 L63 75 Q50 82 37 75 Z"
      fill="url(#liquidGrad)"
      className={isActive ? 'animate-pulse' : ''}
    />
    {isActive && (
      <>
        <circle cx="42" cy="55" r="3" fill="rgba(255,255,255,0.6)" className="animate-bounce" style={{ animationDuration: '1s' }} />
        <circle cx="55" cy="60" r="2" fill="rgba(255,255,255,0.5)" className="animate-bounce" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
        <circle cx="48" cy="65" r="2.5" fill="rgba(255,255,255,0.4)" className="animate-bounce" style={{ animationDuration: '1.2s', animationDelay: '0.5s' }} />
      </>
    )}
    <ellipse cx="50" cy="30" rx="20" ry="5" fill="rgba(255,255,255,0.2)" />
  </svg>
);

const RippleParticles = ({ accentColor }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 animate-ripple"
        style={{
          width: `${60 + i * 80}px`,
          height: `${60 + i * 80}px`,
          borderColor: accentColor,
          animationDelay: `${i * 0.8}s`,
          animationDuration: '3s'
        }}
      />
    ))}
  </div>
);

const OrbitParticles = ({ accentColor }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 rounded-full animate-orbit"
        style={{
          background: accentColor,
          top: '50%',
          left: '50%',
          transformOrigin: `${20 + i * 15}px center`,
          animationDelay: `${i * 0.5}s`,
          animationDuration: `${3 + i * 0.5}s`
        }}
      />
    ))}
  </div>
);

const BubbleParticles = ({ accentColor }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full animate-float-up"
        style={{
          width: `${4 + Math.random() * 8}px`,
          height: `${4 + Math.random() * 8}px`,
          background: accentColor,
          left: `${10 + Math.random() * 80}%`,
          bottom: '-20px',
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${2 + Math.random() * 2}s`
        }}
      />
    ))}
  </div>
);

const LoadingTransition = ({ isLoading, loadingText }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setCurrentPage(0);
      return;
    }

    const pageInterval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % LOADING_PAGES.length);
        setIsTransitioning(false);
      }, 300);
    }, 3000);

    return () => clearInterval(pageInterval);
  }, [isLoading]);

  const page = LOADING_PAGES[currentPage];

  const renderIcon = useCallback(() => {
    switch (page.icon) {
      case 'emotion':
        return <EmotionIcon isActive={isLoading && !isTransitioning} />;
      case 'wuxing':
        return <WuxingIcon isActive={isLoading && !isTransitioning} />;
      case 'blend':
        return <BlendIcon isActive={isLoading && !isTransitioning} />;
      default:
        return null;
    }
  }, [page.icon, isLoading, isTransitioning]);

  const renderParticles = useCallback(() => {
    switch (page.particles) {
      case 'ripple':
        return <RippleParticles accentColor={page.accentColor} />;
      case 'orbit':
        return <OrbitParticles accentColor={page.accentColor} />;
      case 'bubble':
        return <BubbleParticles accentColor={page.accentColor} />;
      default:
        return null;
    }
  }, [page.particles, page.accentColor]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${page.bgColor} transition-all duration-500`}
      />
      {renderParticles()}

      <div
        className={`relative z-10 flex flex-col items-center justify-center px-6 transition-all duration-300 ${
          isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        <div className="mb-6 sm:mb-8">{renderIcon()}</div>

        <h2
          className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 tracking-wider"
          style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
        >
          {page.title}
        </h2>

        <p
          className="text-base sm:text-lg text-white/70 mb-6 sm:mb-8 text-center max-w-xs"
          style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
        >
          {loadingText || page.subtitle}
        </p>

        <div className="flex gap-2">
          {LOADING_PAGES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentPage ? 'bg-white w-6' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-2 text-white/50 text-xs">
          <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          <span style={{ fontFamily: '"Songti SC", serif' }}>正在调酒中</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingTransition;
