import React, { useState, useEffect, useMemo } from 'react';

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

  // Generative "Soul Seeds" / Spiritual Particles - Increased density
  const particles = useMemo(() => {
    return Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      x: Math.random() * 200,
      y: Math.random() * 200,
      size: Math.random() * 1.2 + 0.3, // Tiny, dust-like
      dur: 8 + Math.random() * 10, // Slower, more ethereal
      delay: Math.random() * -20,
      tx: (Math.random() - 0.5) * 80,
      ty: (Math.random() - 0.5) * 80,
    }));
  }, []);

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Background nebulous glow */}
      <div
        className="absolute inset-x-8 inset-y-8 rounded-full blur-[60px] animate-[nebulous-pulse_8s_infinite_ease-in-out]"
        style={{ background: `radial-gradient(circle, ${currentPhase.accent}40 0%, transparent 70%)` }}
      />

      <svg viewBox="0 0 200 200" className="w-full h-full ink-svg relative z-10">
        <defs>
          {/* Advanced Organic Filter */}
          <filter id="organic-goo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />

            {/* Organic displacement mapping for dreaming texture */}
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="4" seed={phase} result="noise">
              <animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="12s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="goo" in2="noise" scale="25" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          <radialGradient id="soulGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={currentPhase.accent} stopOpacity="0.8" />
            <stop offset="40%" stopColor={currentPhase.accent} stopOpacity="0.4" />
            <stop offset="100%" stopColor={currentPhase.accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Spiritual Particles Group */}
        <g className="particles">
          {particles.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.size}
              fill={currentPhase.accent}
              opacity="0"
              style={{
                animation: `spiritual-float ${p.dur}s infinite linear`,
                animationDelay: `${p.delay}s`,
                '--tw-translate-x': `${p.tx}px`,
                '--tw-translate-y': `${p.ty}px`,
              }}
            />
          ))}
        </g>

        <g filter="url(#organic-goo)" className="transition-opacity duration-1500 ease-in-out">
          {/* Phase 1: Ink Drop / Organic Expansion */}
          {currentPhase.type === 'ink-drop' && (
            <g className="animate-[ink-bleed_10s_infinite_ease-in-out]">
              <circle cx="100" cy="100" r="48" fill="url(#soulGrad)" />
              <circle cx="85" cy="90" r="35" fill="url(#soulGrad)">
                <animate attributeName="cx" values="85;115;85" dur="8s" repeatCount="indefinite" />
              </circle>
              <circle cx="115" cy="115" r="30" fill="url(#soulGrad)">
                <animate attributeName="cy" values="115;85;115" dur="10s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* Phase 2: Resonance / Fluid Rings */}
          {currentPhase.type === 'resonance' && (
            <g>
              {[1, 2, 3].map((i) => (
                <circle
                  key={i}
                  cx="100"
                  cy="100"
                  r="35"
                  fill="none"
                  stroke={currentPhase.accent}
                  strokeWidth="12"
                  opacity="0.3"
                >
                  <animate attributeName="r" values="35;85" dur={`${5 + i * 1.2}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0" dur={`${5 + i * 1.2}s`} repeatCount="indefinite" />
                  <animate attributeName="strokeWidth" values="12;1" dur={`${5 + i * 1.2}s`} repeatCount="indefinite" />
                </circle>
              ))}
              <circle cx="100" cy="100" r="45" fill="url(#soulGrad)">
                <animate attributeName="r" values="42;48;42" dur="5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* Phase 3: Smoke / Living Aura */}
          {currentPhase.type === 'smoke' && (
            <g>
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M${80 + i * 20} 140 Q${70 + i * 30} 100 ${90 + i * 10} 60 T${100 + i * 15} 20`}
                  fill="none"
                  stroke={currentPhase.accent}
                  strokeWidth="20"
                  strokeLinecap="round"
                  opacity="0.2"
                >
                  <animate
                    attributeName="d"
                    values={`M${80 + i * 20} 145 Q${70 + i * 30} 105 ${90 + i * 10} 65 T${100 + i * 15} 25;
                             M${85 + i * 25} 135 Q${75 + i * 35} 95 ${95 + i * 15} 55 T${105 + i * 20} 15;
                             M${80 + i * 20} 145 Q${70 + i * 30} 105 ${90 + i * 10} 65 T${100 + i * 15} 25`}
                    dur={`${6 + i * 2}s`}
                    repeatCount="indefinite"
                  />
                  <animate attributeName="opacity" values="0;0.4;0" dur={`${6 + i * 2}s`} repeatCount="indefinite" />
                </path>
              ))}
              <ellipse cx="100" cy="140" rx="55" ry="25" fill="url(#soulGrad)" />
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
      // Increased delay to allow for deep fade out before state change
      setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % PHASES.length);
        setIsTransitioning(false);
      }, 1500); // Longer transition window for "Dreamy" cross-fade
    }, 5000); // Slightly longer interval between slides

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
