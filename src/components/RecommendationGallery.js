import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, HelpCircle, Shuffle, Settings2, Heart, Wine, Lightbulb, User, Droplets, GlassWater, Snowflake, Sparkles, Check, AlertCircle } from 'lucide-react';
import { generatePhilosophyTags } from '../engine/philosophyTags';

const RecommendationGallery = ({ drinks, onBack, onStartMaking, onShuffle, onNavigate, onLikeDrink, onUnlikeDrink, favoriteDrinks = [], moodResult = null }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when drinks batch changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [drinks]);

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

    const baseTranslate = offset * 70; // 偏移量（百分比）
    const scale = 1 - absOffset * 0.12;
    const opacity = 1 - absOffset * 0.3;
    const zIndex = 10 - absOffset;

    return {
      transform: `translateX(${baseTranslate}%) scale(${scale})`,
      opacity,
      zIndex,
      pointerEvents: absOffset === 0 ? 'auto' : 'none',
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
      <header className="relative z-50 flex items-center justify-between px-6 py-5">
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

        <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/40 backdrop-blur-md border border-white/60 text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-300 active:scale-95 shadow-sm">
          <HelpCircle size={20} />
        </button>
      </header>

      {/* Card Carousel */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center overflow-hidden pb-32">
        {/* Progress Indicator */}
        <div className="flex items-center gap-2 z-30 mb-4">
          <span className="text-gray-500 text-sm font-medium">{currentIndex + 1}</span>
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / drinks.length) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 text-sm font-medium">{drinks.length}</span>
        </div>

        {/* Stacked Cards Container */}
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
          {/* Left Arrow */}
          {currentIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 sm:left-8 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/40 text-gray-600 hover:bg-white/50 hover:text-gray-900 transition-all duration-300 active:scale-90 shadow-lg"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Cards Stack */}
          <div className="relative flex items-center justify-center" style={{ width: '320px', height: '440px' }}>
            {drinks.map((drink, index) => {
              const absOffset = Math.abs(index - currentIndex);
              if (absOffset > 1) return null; // 只渲染前后1张

              return (
                <div
                  key={drink.id}
                  className="absolute inset-0 transition-all duration-500 ease-out cursor-pointer"
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

          {/* Right Arrow */}
          {currentIndex < drinks.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 sm:right-8 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/40 text-gray-600 hover:bg-white/50 hover:text-gray-900 transition-all duration-300 active:scale-90 shadow-lg"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex w-full items-center justify-center px-8 gap-4 mb-2 z-20">
          <button
            onClick={onShuffle}
            className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50/40 backdrop-blur-md border border-white/40 text-gray-600 hover:bg-indigo-50/60 hover:text-gray-900 transition-all duration-300 active:scale-95 shadow-sm"
          >
            <Shuffle size={20} className="group-hover:rotate-180 transition-transform duration-500" />
          </button>

          <button
            onClick={() => {
              const currentDrink = drinks[currentIndex];
              if (currentDrink && onStartMaking) {
                onStartMaking(currentDrink);
              }
            }}
            className="group relative flex h-14 flex-1 max-w-[240px] items-center justify-center overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #A5B4FC 0%, #F9A8D4 100%)',
              boxShadow: '0 8px 32px rgba(165, 180, 252, 0.3), 0 0 0 1px rgba(255,255,255,0.4) inset'
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, #F9A8D4 0%, #A5B4FC 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span className="relative z-10 flex items-center gap-2 text-white font-semibold text-base">
              <Sparkles size={18} className="animate-pulse" />
              开始制作
            </span>
          </button>

          <button
            onClick={() => console.log('Settings')}
            className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50/40 backdrop-blur-md border border-white/40 text-gray-600 hover:bg-indigo-50/60 hover:text-gray-900 transition-all duration-300 active:scale-95 shadow-sm"
          >
            <Settings2 size={20} />
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
        <div
          className="flex h-[60px] items-center gap-1 rounded-2xl px-2"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255,255,255,0.8)'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigate) onNavigate('mix');
            }}
            className="flex h-full min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-xl px-4 text-gray-800 transition-all duration-300 hover:bg-white/40"
          >
            <Wine size={20} className="text-purple-600" />
            <span className="text-[9px] font-bold text-gray-900">特调</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigate) onNavigate('explore');
            }}
            className="flex h-full min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-xl px-4 text-gray-500 transition-all duration-300 hover:bg-white/40 hover:text-gray-700"
          >
            <Lightbulb size={20} />
            <span className="text-[9px] font-medium">灵感</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigate) onNavigate('mine');
            }}
            className="flex h-full min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-xl px-4 text-gray-500 transition-all duration-300 hover:bg-white/40 hover:text-gray-700"
          >
            <User size={20} />
            <span className="text-[9px] font-medium">我的</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

// Enhanced Card Content Component
const CardContent = ({ drink, isActive, isLiked, moodResult, onLike, onUnlike }) => {
  const philosophy = generatePhilosophyTags(drink.dimensions, moodResult, drink.name);

  return (
    <div
      className="relative rounded-[1.5rem] overflow-hidden group w-full h-full"
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
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
      </div>

      {/* Glass Border Effect */}
      <div
        className="absolute inset-0 rounded-[1.5rem] pointer-events-none"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)',
        }}
      />

      {/* Badge - Top Left */}
      <div className="absolute top-4 left-4 z-20">
        <div
          className="flex items-center gap-1.5 rounded-xl px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          <Droplets size={12} className="text-cyan-300" />
          <span className="tracking-wide">{drink.abv > 0 ? `${drink.abv}%` : '无酒精'}</span>
        </div>

        {/* Availability Badge (Dual Track) */}
        {drink.isReadyToMake !== undefined && (
          <div
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md mt-2 border shadow-md ${drink.isReadyToMake
              ? 'bg-green-500/30 border-green-400/40 text-green-50'
              : 'bg-orange-500/30 border-orange-400/40 text-orange-50'
              }`}
          >
            {drink.isReadyToMake ? (
              <><Check size={11} /> <span>100% 齐备</span></>
            ) : (
              <><AlertCircle size={11} /> <span>差 {drink.missingCount} 种</span></>
            )}
          </div>
        )}
      </div>

      {/* Like Button - Bottom Center */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isLiked) {
            onUnlike();
          } else {
            onLike();
          }
        }}
        className={`absolute bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${isLiked ? 'text-red-400' : 'text-white/80 hover:text-white'
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
        <Heart size={18} className={isLiked ? 'fill-current' : ''} />
      </button>

      {/* Drink Info - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col p-5 pb-16 text-white">
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

        {/* Philosophy Tags & Quote */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            {philosophy.tags.map(tag => (
              <span key={tag} className="px-2 py-[2px] rounded-sm bg-white/10 text-white/80 border border-white/20 text-[10px] tracking-widest font-light">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[12px] text-white/90 font-light italic opacity-90 leading-relaxed border-l-2 border-white/30 pl-2">
            {philosophy.quote}
          </p>
        </div>

        {/* Ingredients */}
        {(drink.briefIngredients || (drink.ingredients && drink.ingredients.length > 0)) && (
          <div className="flex items-center gap-1.5 text-white/70 flex-wrap mt-1">
            {(drink.briefIngredients || (drink.ingredients || []).map(i => ({ label: i.name, icon: 'Wine' }))).slice(0, 3).map((ing, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <div className="h-3 w-px bg-white/20 mx-0.5" />}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                  {ing.icon === 'Wine' && <Wine size={12} />}
                  {ing.icon === 'Droplets' && <Droplets size={12} />}
                  {ing.icon === 'ThermometerSnowflake' && <Snowflake size={12} />}
                  {ing.icon === 'GlassWater' && <GlassWater size={12} />}
                  {ing.icon === 'Flame' && <Wine size={12} />}
                  <span className="text-[10px] uppercase tracking-wider font-medium">{ing.label || ing.name}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationGallery;
