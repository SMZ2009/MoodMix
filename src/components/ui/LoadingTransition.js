import React, { useState, useEffect, useCallback, useMemo } from 'react';

const PHASES = [
  {
    id: 'perceive',
    title: '心境感知',
    subtitle: 'Perceiving Soul',
    description: '正在解读你的心间波澜...',
    colorRange: 'from-indigo-950 via-purple-900 to-slate-950',
    accent: '#a78bfa',
    liquidType: 'single'
  },
  {
    id: 'harmony',
    title: '五行共鸣',
    subtitle: 'Universal Harmony',
    description: '金木水火土，相生相息...',
    colorRange: 'from-emerald-950 via-teal-900 to-slate-950',
    accent: '#34d399',
    liquidType: 'split'
  },
  {
    id: 'symphony',
    title: '味觉交响',
    subtitle: 'Crafting Symphony',
    description: '正在为你调制专属灵感...',
    colorRange: 'from-amber-950 via-orange-900 to-slate-950',
    accent: '#fbbf24',
    liquidType: 'merge'
  }
];

const AlchemyLiquid = ({ phase, isActive }) => {
  const currentPhase = PHASES[phase];

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          </filter>
          <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={currentPhase.accent} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        <g filter="url(#goo)">
          {/* Phase 1: Single Pulsing Orb */}
          {currentPhase.liquidType === 'single' && (
            <circle cx="100" cy="100" r="40" fill="url(#liquidGrad)">
              <animate attributeName="r" values="38;42;38" dur="3s" repeatCount="indefinite" />
              <animate attributeName="cy" values="98;102;98" dur="4s" repeatCount="indefinite" />
            </circle>
          )}

          {/* Phase 2: Split Swirling Droplets */}
          {currentPhase.liquidType === 'split' && (
            <g>
              {[0, 72, 144, 216, 288].map((angle, i) => (
                <circle key={i} r="18" fill="url(#liquidGrad)">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`${angle} 100 100`}
                    to={`${angle + 360} 100 100`}
                    dur={`${4 + i * 0.5}s`}
                    repeatCount="indefinite"
                  />
                  <animate attributeName="cx" values="100;140;100" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
                </circle>
              ))}
              <circle cx="100" cy="100" r="25" fill="url(#liquidGrad)" opacity="0.6" />
            </g>
          )}

          {/* Phase 3: Merged Symphony silhouette */}
          {currentPhase.liquidType === 'merge' && (
            <g className="animate-pulse">
              <path
                d="M70 60 Q100 50 130 60 L120 140 Q100 155 80 140 Z"
                fill="url(#liquidGrad)"
              >
                <animate attributeName="d"
                  values="M70 60 Q100 50 130 60 L120 140 Q100 155 80 140 Z;M72 62 Q100 48 128 62 L118 138 Q100 157 82 138 Z;M70 60 Q100 50 130 60 L120 140 Q100 155 80 140 Z"
                  dur="4s" repeatCount="indefinite" />
              </path>
              <circle cx="100" cy="80" r="15" fill="rgba(255,255,255,0.2)">
                <animate attributeName="cy" values="80;60;80" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

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
        setCurrentPage((prev) => (prev + 1) % PHASES.length);
        setIsTransitioning(false);
      }, 800);
    }, 4000);

    return () => clearInterval(pageInterval);
  }, [isLoading]);

  if (!isLoading) return null;

  const phase = PHASES[currentPage];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Dynamic Mesh Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${phase.colorRange} transition-all duration-1000 ease-in-out`}
      >
        <div className="absolute inset-0 opacity-30 transform scale-150 animate-pulse">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ backgroundColor: phase.accent }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px]" style={{ backgroundColor: '#ffffff20' }} />
        </div>
      </div>

      <div className={`relative z-10 flex flex-col items-center justify-center px-8 transition-all duration-700 ${isTransitioning ? 'opacity-0 scale-95 blur-md' : 'opacity-100 scale-100 blur-0'
        }`}>

        {/* Central Alchemy Element */}
        <AlchemyLiquid phase={currentPage} isActive={!isTransitioning} />

        {/* Textual Content */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-xs sm:text-sm tracking-[0.3em] uppercase mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            {phase.subtitle}
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-[0.15em]"
            style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
          >
            {phase.title}
          </h2>
          <p
            className="text-white/60 text-base sm:text-lg font-light italic max-w-xs mx-auto"
            style={{ fontFamily: '"FZYouSong", "Songti SC", serif' }}
          >
            {loadingText || phase.description}
          </p>
        </div>

        {/* Phase Indicator */}
        <div className="mt-12 flex gap-3">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-700 ${i === currentPage
                  ? 'w-12 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                  : 'w-4 bg-white/20'
                }`}
            />
          ))}
        </div>
      </div>

      {/* Persistent Status Footer */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span className="text-white/50 text-[10px] sm:text-xs tracking-[0.2em]" style={{ fontFamily: '"Songti SC", serif' }}>
            灵感酿造中 / MIXING INSPIRATION
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoadingTransition;
