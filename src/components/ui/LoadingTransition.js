import React, { useState, useEffect } from 'react';

const PHASES = [
  {
    id: 'perceive',
    title: '墨润心田',
    subtitle: 'Ink Moistening Souls',
    description: '正如水墨洇散，正在感知你的心律波动...',
    colorRange: 'from-[#1a1a1a] via-[#2d2d2d] to-[#121212]',
    accent: '#8e8e8e',
    type: 'ink-drop'
  },
  {
    id: 'harmony',
    title: '万物和鸣',
    subtitle: 'Universal Resonance',
    description: '五行流转，于静谧中寻找那一抹和谐的韵律...',
    colorRange: 'from-[#2c3e50] via-[#000000] to-[#1a1a1a]', // Deep indigo/black
    accent: '#4a90e2',
    type: 'resonance'
  },
  {
    id: 'symphony',
    title: '灵犀凝神',
    subtitle: 'Soulful Symphony',
    description: '灵感如篆烟徐升，为你凝结这份独特的风味...',
    colorRange: 'from-[#3d3331] via-[#1a1a1a] to-[#2d2422]', // Deep tea/charcoal
    accent: '#d4a373',
    type: 'smoke'
  }
];

const AlchemyLiquid = ({ phase, isActive }) => {
  const currentPhase = PHASES[phase];

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full ink-svg">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
          </filter>
        </defs>

        <g filter="url(#goo)">
          {/* Phase 1: Ink Drop / Bleeding */}
          {currentPhase.type === 'ink-drop' && (
            <g className="animate-[ink-bleed_6s_infinite_ease-in-out]">
              <circle cx="100" cy="100" r="45" fill={currentPhase.accent} opacity="0.6" />
              <circle cx="90" cy="95" r="30" fill={currentPhase.accent} opacity="0.4">
                <animate attributeName="cx" values="90;110;90" dur="4s" repeatCount="indefinite" />
              </circle>
              <circle cx="110" cy="110" r="25" fill={currentPhase.accent} opacity="0.3">
                <animate attributeName="cy" values="110;90;110" dur="5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* Phase 2: Resonance / Ripple waves */}
          {currentPhase.type === 'resonance' && (
            <g>
              {[1, 2, 3].map((i) => (
                <circle
                  key={i}
                  cx="100"
                  cy="100"
                  r="30"
                  fill="none"
                  stroke={currentPhase.accent}
                  strokeWidth="8"
                  opacity="0.3"
                >
                  <animate attributeName="r" values="30;70" dur={`${3 + i}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0" dur={`${3 + i}s`} repeatCount="indefinite" />
                </circle>
              ))}
              <circle cx="100" cy="100" r="40" fill={currentPhase.accent} opacity="0.5">
                <animate attributeName="r" values="38;42;38" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* Phase 3: Smoke / Ascending vapor */}
          {currentPhase.type === 'smoke' && (
            <g>
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M${80 + i * 20} 140 Q${70 + i * 30} 100 ${90 + i * 10} 60 T${100 + i * 15} 20`}
                  fill="none"
                  stroke={currentPhase.accent}
                  strokeWidth="15"
                  strokeLinecap="round"
                  opacity="0.2"
                >
                  <animate
                    attributeName="d"
                    values={`M${80 + i * 20} 140 Q${70 + i * 30} 100 ${90 + i * 10} 60 T${100 + i * 15} 20;
                             M${85 + i * 20} 140 Q${75 + i * 30} 110 ${95 + i * 10} 70 T${105 + i * 15} 30;
                             M${80 + i * 20} 140 Q${70 + i * 30} 100 ${90 + i * 10} 60 T${100 + i * 15} 20`}
                    dur={`${4 + i}s`}
                    repeatCount="indefinite"
                  />
                  <animate attributeName="opacity" values="0;0.3;0" dur={`${4 + i}s`} repeatCount="indefinite" />
                </path>
              ))}
              <ellipse cx="100" cy="140" rx="50" ry="20" fill={currentPhase.accent} opacity="0.4" />
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
      }, 1000); // Slower, smoother transition
    }, 4500);

    return () => clearInterval(pageInterval);
  }, [isLoading]);

  if (!isLoading) return null;

  const phase = PHASES[currentPage];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black">
      {/* Dynamic Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${phase.colorRange} transition-all duration-1500 ease-in-out`} />

      {/* Rice Paper Texture Overlay */}
      <div className="absolute inset-0 paper-overlay opacity-[0.05]" />

      <div className={`relative z-10 flex flex-col items-center justify-center px-8 transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${isTransitioning ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100 blur-0'
        }`}>

        {/* Central Alchemy/Oriental Element */}
        <AlchemyLiquid phase={currentPage} isActive={!isTransitioning} />

        {/* Textual Content */}
        <div className="mt-16 text-center">
          <p className="text-white/30 text-xs sm:text-sm tracking-[0.4em] uppercase mb-3 font-light">
            {phase.subtitle}
          </p>
          <div className="relative inline-block">
            <h2
              className="text-4xl sm:text-5xl font-bold text-white mb-6 tracking-[0.2em]"
              style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
            >
              {phase.title}
            </h2>
            {/* Seal style decorator */}
            <div className="absolute -right-12 top-0 border-2 border-white/20 px-1 py-2 text-[10px] text-white/40 leading-none writing-mode-vertical">
              心绪
            </div>
          </div>
          <p
            className="text-white/50 text-base sm:text-lg font-light max-w-xs mx-auto leading-relaxed"
            style={{ fontFamily: '"FZYouSong", "Songti SC", serif' }}
          >
            {loadingText || phase.description}
          </p>
        </div>

        {/* Phase Indicator - Elegant Dots */}
        <div className="mt-16 flex gap-4">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-1000 ${i === currentPage
                  ? 'w-16 bg-white/80 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                  : 'w-4 bg-white/10'
                }`}
            />
          ))}
        </div>
      </div>

      {/* Persistent Status Footer */}
      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center">
        <div className="flex items-center gap-4 px-8 py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
            <div className="relative rounded-full bg-white w-2 h-2" />
          </div>
          <span className="text-white/40 text-[11px] sm:text-xs tracking-[0.3em] font-light" style={{ fontFamily: '"Songti SC", serif' }}>
            酝酿中 · INSPIRATION BREWING
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoadingTransition;
