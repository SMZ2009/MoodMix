import React, { useState, useEffect } from 'react';
import { ChevronLeft, Shuffle, Heart, Wine, Droplets, GlassWater, Snowflake, Check, AlertCircle } from 'lucide-react';
import { generatePhilosophyTags } from '../engine/philosophyTags';

const RecommendationGallery = ({ drinks, onBack, onStartMaking, onShuffle, onNavigate, onLikeDrink, onUnlikeDrink, favoriteDrinks = [], moodResult = null, customQuotes = {}, validation = null }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = React.useRef(null);

  // Reset index when drinks batch changes
  useEffect(() => {
    setCurrentIndex(0);
    setDragOffset(0);
  }, [drinks]);

  // Handle touch start
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging || !touchStart || !containerRef.current) return;
    const currentX = e.targetTouches[0].clientX;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = currentX - touchStart;
    const maxDrag = containerWidth * 0.4;
    const clampedDelta = Math.max(-maxDrag, Math.min(maxDrag, deltaX));
    setDragOffset(clampedDelta);
    setTouchEnd(currentX);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    const distance = touchStart - touchEnd;
    const threshold = 50;
    if (distance > threshold) {
      handleNext();
    } else if (distance < -threshold) {
      handlePrev();
    }
    setIsDragging(false);
    setDragOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle mouse events for desktop testing
  const handleMouseDown = (e) => {
    setTouchStart(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !touchStart || !containerRef.current) return;
    const currentX = e.clientX;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = currentX - touchStart;
    const maxDrag = containerWidth * 0.4;
    const clampedDelta = Math.max(-maxDrag, Math.min(maxDrag, deltaX));
    setDragOffset(clampedDelta);
    setTouchEnd(currentX);
  };

  const handleMouseUp = () => {
    handleTouchEnd();
  };

  if (!drinks || drinks.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(drinks.length - 1, prev + 1));
  };

  // 计算堆叠卡片样式
  const getCardStyle = (index) => {
    const offset = index - currentIndex;
    const absOffset = Math.abs(offset);

    // 只显示前后1张卡片
    if (absOffset > 1) {
      return {
        opacity: 0,
        transform: `translateX(${offset > 0 ? 100 : -100}%) scale(0.7)`,
        zIndex: 0,
        pointerEvents: 'none',
      };
    }

    const containerWidth = containerRef.current?.offsetWidth || 0;
    const isAtBoundary = (currentIndex === 0 && offset >= 0) || (currentIndex === drinks.length - 1 && offset <= 0);
    const boundaryFactor = isAtBoundary ? 0.3 : 1;
    const dragFactor = isDragging && offset === 0 ? dragOffset : 0;
    const baseTranslate = offset * 70 + (dragFactor / containerWidth) * 70 * boundaryFactor;
    const scale = 1 - absOffset * 0.12;
    const opacity = 1 - absOffset * 0.3;
    const zIndex = 10 - absOffset;

    return {
      transform: `translateX(${baseTranslate}%) scale(${scale})`,
      opacity,
      zIndex,
      pointerEvents: absOffset === 0 ? 'auto' : 'none',
      transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-dreamy-gradient">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-gradient-to-br from-purple-200/40 to-blue-200/20 blur-[120px] animate-pulse mix-blend-multiply" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-200/30 to-pink-200/20 blur-[100px] animate-pulse mix-blend-multiply" style={{ animationDuration: '6s' }} />
        <div className="absolute top-[40%] left-[30%] h-[300px] w-[300px] rounded-full bg-gradient-to-br from-cyan-200/20 to-transparent blur-[80px] animate-pulse mix-blend-multiply" style={{ animationDuration: '5s' }} />
      </div>

      {/* Subtle Noise Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="relative z-50 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/40 backdrop-blur-md border border-white/60 text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-300 active:scale-95 shadow-sm"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold tracking-wider text-gray-800" style={{ fontFamily: 'serif' }}>Mood Mix</h1>
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Recommendation</span>
        </div>

        <button 
          onClick={onShuffle}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/40 backdrop-blur-md border border-white/60 text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-300 active:scale-95 shadow-sm"
        >
          <Shuffle size={18} />
        </button>
      </header>

      {/* Card Carousel */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center overflow-hidden px-2" style={{ paddingBottom: '12vh', paddingTop: '2vh' }}>
        {/* Stacked Cards Container */}
        <div className="w-full flex items-center justify-center">
          {/* Cards Stack */}
          <div 
            ref={containerRef}
            className="relative w-[85vw] max-w-sm h-[52vh] max-h-[400px]"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {drinks.map((drink, index) => {
              const absOffset = Math.abs(index - currentIndex);
              if (absOffset > 1) return null; // 只渲染前后1张

              return (
                <div
                  key={drink.id}
                  className={`absolute inset-0 cursor-pointer rounded-2xl overflow-hidden ${isDragging ? '' : 'transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)'}`}
                  style={getCardStyle(index)}
                  onClick={() => {
                    if (index === currentIndex && onStartMaking) {
                      onStartMaking(drink);
                    } else {
                      setCurrentIndex(index);
                    }
                  }}
                >
                <CardContent
                    drink={drink}
                    isActive={index === currentIndex}
                    isLiked={favoriteDrinks.some(d => d.id === drink.id)}
                    moodResult={moodResult}
                    customQuote={customQuotes?.[drink.id]}
                    validation={validation}
                    onLike={() => {
                      if (onLikeDrink) onLikeDrink(drink);
                    }}
                    onUnlike={() => {
                      if (onUnlikeDrink) onUnlikeDrink(drink.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

      </main>


    </div>
  );
};

// Enhanced Card Content Component
const CardContent = ({ drink, isActive, isLiked, moodResult, customQuote, validation, onLike, onUnlike }) => {
  const philosophy = generatePhilosophyTags(drink.dimensions, moodResult, drink.name);

  return (
    <div
      className="relative overflow-hidden group w-full h-full flex flex-col rounded-2xl"
      style={{
        boxShadow: isActive
          ? '0 20px 50px -12px rgba(0, 0, 0, 0.35)'
          : '0 8px 24px -8px rgba(0, 0, 0, 0.3)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
      }}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundImage: `url('${drink.image}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
        <div className="absolute bottom-0 left-0 w-[85%] h-[85%] bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
      </div>

      {/* Glass Border Effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)',
        }}
      />

      {/* Quality Badge - Top Left */}
      <div className="absolute top-3 left-3 z-20">
        {validation?.uiHints?.showBadge && validation.uiHints.badgeText && (
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md border bg-white/15 border-white/30 text-white shadow-lg animate-in fade-in duration-500">
            <span>{validation.uiHints.badgeText}</span>
          </div>
        )}
      </div>

      {/* Like Button - Top Right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isLiked) {
            onUnlike();
          } else {
            onLike();
          }
        }}
        className={`absolute top-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${isLiked ? 'text-red-400' : 'text-white/80 hover:text-white'
          }`}
        style={{
          background: isLiked
            ? 'rgba(239, 68, 68, 0.2)'
            : 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          border: isLiked
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
        }}
      >
        <Heart size={16} className={isLiked ? 'fill-current' : ''} />
      </button>

      {/* Drink Info - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col p-4 pb-20 text-white">
        <h2
          className="text-2xl font-bold leading-tight mb-3"
          style={{
            fontFamily: 'serif',
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            letterSpacing: '0.02em',
          }}
        >
          {drink.name}
        </h2>

        {/* Philosophy Tags */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {philosophy.tags.map(tag => (
              <span 
                key={tag} 
                className="px-3 py-1 rounded-full bg-white/15 text-white/90 border border-white/20 text-xs tracking-wider font-medium backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Custom Quote from LLM */}
        {customQuote && (
          <p 
            className="text-xs text-indigo-200 italic leading-relaxed mb-2 px-2"
            style={{ textShadow: '0 0 8px rgba(165, 180, 252, 0.3)' }}
          >
            {customQuote}
          </p>
        )}

        {/* Ingredients + Availability */}
        {(drink.briefIngredients || (drink.ingredients && drink.ingredients.length > 0)) && (
          <div className="flex items-center gap-2 text-white/80 flex-wrap mt-1">
            <span className="text-[10px] uppercase tracking-widest text-white/50">原料</span>
            {(drink.briefIngredients || (drink.ingredients || []).map(i => ({ label: i.name, icon: 'Wine' }))).slice(0, 3).map((ing, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-white/30">·</span>}
                <div className="flex items-center gap-1.5">
                  {ing.icon === 'Wine' && <Wine size={11} className="text-rose-300" />}
                  {ing.icon === 'Droplets' && <Droplets size={11} className="text-cyan-300" />}
                  {ing.icon === 'ThermometerSnowflake' && <Snowflake size={11} className="text-blue-300" />}
                  {ing.icon === 'GlassWater' && <GlassWater size={11} className="text-sky-300" />}
                  {ing.icon === 'Flame' && <Wine size={11} className="text-orange-300" />}
                  <span className="text-xs font-medium">{ing.label || ing.name}</span>
                </div>
              </React.Fragment>
            ))}
            {/* Availability Status - Inline */}
            {drink.isReadyToMake !== undefined && (
              <>
                <span className="text-white/30 mx-1">·</span>
                <span className={`text-[10px] font-medium ${
                  drink.isReadyToMake ? 'text-emerald-300' : 'text-amber-300'
                }`}>
                  {drink.isReadyToMake ? (
                    <><Check size={10} className="inline mr-0.5" />齐备</>
                  ) : (
                    <><AlertCircle size={10} className="inline mr-0.5" />缺{drink.missingCount}种</>
                  )}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationGallery;
