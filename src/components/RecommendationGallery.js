import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, HelpCircle, Shuffle, Settings2, Heart, Wine, Lightbulb, User, Droplets, GlassWater, Snowflake, Sparkles, Check, AlertCircle } from 'lucide-react';

const RecommendationGallery = ({ drinks, onBack, onStartMaking, onShuffle, onNavigate, onLikeDrink, onUnlikeDrink, favoriteDrinks = [] }) => {
  console.log('RecommendationGallery props:', { onNavigate });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    isSmall: window.innerWidth < 640,
    isMedium: window.innerWidth >= 640 && window.innerWidth < 1024,
    isLarge: window.innerWidth >= 1024
  });
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenSize({
        width,
        height: window.innerHeight,
        isSmall: width < 640,
        isMedium: width >= 640 && width < 1024,
        isLarge: width >= 1024
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    if (distance > minSwipeDistance && currentIndex < drinks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (distance < -minSwipeDistance && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Reset index when drinks batch changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [drinks]);

  if (!drinks || drinks.length === 0) return null;

  // Calculate card styles for 3D carousel layout
  const getCardStyle = (index) => {
    const screenWidth = screenSize.width;
    const offset = index - currentIndex;
    
    // 计算卡片宽度
    const cardWidth = Math.min(screenWidth * 0.7, 280);
    const cardHeight = cardWidth * 1.25;
    
    // 3D变换参数
    const maxOffset = 2;
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));
    
    let transform = '';
    let opacity = 1;
    let zIndex = 100 - Math.abs(offset);
    
    if (offset === 0) {
      // 中间卡片
      transform = 'translateX(0) scale(1) rotateY(0deg)';
      opacity = 1;
      zIndex = 100;
    } else if (offset === 1) {
      // 右侧第一张
      transform = `translateX(${cardWidth * 0.6}px) scale(0.85) rotateY(-15deg)`;
      opacity = 0.7;
      zIndex = 90;
    } else if (offset === -1) {
      // 左侧第一张
      transform = `translateX(-${cardWidth * 0.6}px) scale(0.85) rotateY(15deg)`;
      opacity = 0.7;
      zIndex = 90;
    } else if (offset === 2) {
      // 右侧第二张
      transform = `translateX(${cardWidth * 1.1}px) scale(0.7) rotateY(-25deg)`;
      opacity = 0.4;
      zIndex = 80;
    } else if (offset === -2) {
      // 左侧第二张
      transform = `translateX(-${cardWidth * 1.1}px) scale(0.7) rotateY(25deg)`;
      opacity = 0.4;
      zIndex = 80;
    } else {
      // 更远的卡片
      const direction = offset > 0 ? 1 : -1;
      transform = `translateX(${direction * cardWidth * 1.5}px) scale(0.5) rotateY(${direction * 35}deg)`;
      opacity = 0.1;
      zIndex = 70;
    }
    
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: cardWidth,
      height: cardHeight,
      marginLeft: -cardWidth / 2,
      marginTop: -cardHeight / 2,
      transform,
      opacity,
      zIndex,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer'
    };
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-dreamy-gradient">
      {/* Animated Background Elements - Adjusted for Light Theme */}
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

      {/* Grid Layout */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center overflow-hidden pb-32"

      >
        {/* Progress Indicator */}
        <div className="relative z-30 mt-0 flex justify-center items-center gap-2 w-full">
          <span className="text-gray-500 text-sm font-medium">{currentIndex + 1}</span>
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / drinks.length) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 text-sm font-medium">{drinks.length}</span>
        </div>

        {/* 3D Carousel - Cards Container */}
        <div
          className="relative w-full flex-1 flex items-center justify-center min-h-0"
          style={{ perspective: '1000px' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Cards Container */}
          <div 
            className="relative"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '400px',
              maxHeight: '500px'
            }}
          >
            {/* Previous Button - Outside Card */}
            <button
              onClick={() => {
                setCurrentIndex(prev => (prev === 0 ? drinks.length - 1 : prev - 1));
              }}
              className="absolute left-[-3px] top-1/2 -translate-y-1/2 z-[100] flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:scale-115 active:scale-95 text-white hover:text-white"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                clipPath: 'inset(0 0 0 0)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <ChevronLeft size={20} />
            </button>

            {/* Next Button - Outside Card */}
            <button
              onClick={() => {
                setCurrentIndex(prev => (prev === drinks.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-[-3px] top-1/2 -translate-y-1/2 z-[100] flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:scale-115 active:scale-95 text-white hover:text-white"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                clipPath: 'inset(0 0 0 0)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <ChevronRight size={20} />
            </button>

            {drinks.map((drink, index) => (
              <div
                key={drink.id}
                style={getCardStyle(index)}
                onClick={() => {
                  setCurrentIndex(index);
                  if (onStartMaking) {
                    onStartMaking(drink);
                  }
                }}
              >
                <CardContent
                  drink={drink}
                  isActive={index === currentIndex}
                  isLiked={favoriteDrinks.some(d => d.id === drink.id)}
                  onLike={() => {
                    setCurrentIndex(index);
                    if (onLikeDrink) onLikeDrink(drink);
                  }}
                  onUnlike={() => {
                    setCurrentIndex(index);
                    if (onUnlikeDrink) onUnlikeDrink(drink.id);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full items-center justify-center px-8 gap-4 mb+4 z-20">
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
              className="absolute inset-0 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
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
              console.log('特调按钮点击，onNavigate:', onNavigate);
              if (onNavigate) {
                onNavigate('mix');
              } else {
                console.error('onNavigate is not defined');
              }
            }}
            className="flex h-full min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-xl px-4 text-gray-800 transition-all duration-300 hover:bg-white/40"
          >
            <Wine size={20} className="text-purple-600" />
            <span className="text-[9px] font-bold text-gray-900">特调</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('灵感按钮点击，onNavigate:', onNavigate);
              if (onNavigate) {
                onNavigate('explore');
              } else {
                console.error('onNavigate is not defined');
              }
            }}
            className="flex h-full min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-xl px-4 text-gray-500 transition-all duration-300 hover:bg-white/40 hover:text-gray-700"
          >
            <Lightbulb size={20} />
            <span className="text-[9px] font-medium">灵感</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('我的按钮点击，onNavigate:', onNavigate);
              if (onNavigate) {
                onNavigate('mine');
              } else {
                console.error('onNavigate is not defined');
              }
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

// Function to detect if image is light or dark
const isImageLight = (imageUrl) => {
  // For simplicity, we'll use a heuristic based on image URL or drink name
  // In a real app, you would use canvas to analyze actual image brightness
  const lightKeywords = ['white', 'bright', 'light', 'clear', 'sunny', 'yellow', 'golden'];
  const darkKeywords = ['dark', 'black', 'night', 'shadow', 'brown', 'deep', 'blue'];
  
  const urlLower = imageUrl.toLowerCase();
  const hasLightKeywords = lightKeywords.some(keyword => urlLower.includes(keyword));
  const hasDarkKeywords = darkKeywords.some(keyword => urlLower.includes(keyword));
  
  if (hasLightKeywords) return true;
  if (hasDarkKeywords) return false;
  
  // Default to dark background (white text) for most drinks
  return false;
};

// Enhanced Card Content Component
const CardContent = ({ drink, isActive, isLiked, onLike, onUnlike }) => {
  const imageIsLight = isImageLight(drink.image);
  const titleColor = imageIsLight ? 'black' : 'white';
  const titleShadow = imageIsLight 
    ? '0 2px 16px rgba(255,255,255,0.6)' 
    : '0 2px 16px rgba(0,0,0,0.6)';

  return (
    <div
      className="relative rounded-[1rem] overflow-hidden group"
      style={{
        boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.3)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
        minWidth: 0, // 防止内容撑开卡片
        width: '100%',
        height: '100%',
        flexShrink: 0
      }}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
        style={{ 
          backgroundImage: `url('${drink.image}')`,
          borderRadius: '1rem'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" style={{ borderRadius: '1rem' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" style={{ borderRadius: '1rem' }} />
      </div>

      {/* Glass Border Effect */}
      <div
        className="absolute inset-0 rounded-[1rem] pointer-events-none"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)',
        }}
      />





      {/* Badge - Top Left */}
      <div className="absolute top-10 left-4 z-20">
        <div
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-md transition-all duration-300"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          <Droplets size={12} className="text-cyan-300 flex-shrink-0" />
          <span className="tracking-wide truncate">{drink.abv > 0 ? ` ${drink.abv}% ` : '无酒精'}</span>
        </div>
      </div>

      {/* Title - Middle Left */}
      <div className="absolute top-1/3 left-0 z-20 px-6">
        <h2
          className="text-xl sm:text-2xl font-bold leading-tight"
          style={{
            fontFamily: 'serif',
            textShadow: titleShadow,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: titleColor
          }}
        >
          {drink.name}
        </h2>
      </div>

      {/* Like Button - Bottom Right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isLiked) {
            onUnlike();
          } else {
            onLike();
          }
        }}
        className={`absolute bottom-3 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${isLiked ? 'text-red-400' : 'text-white/80 hover:text-white'
          }`}
        style={{
          background: isLiked
            ? 'rgba(239, 68, 68, 0.2) '
            : 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: isLiked
            ? '1px solid rgba(239, 68, 68, 0.3) '
            : '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
        }}
      >
        <Heart size={16} className={isLiked ? 'fill-current' : ''} />
      </button>

      {/* Ingredients - Bottom */}
      <div className="absolute bottom-16 left-0 z-20 px-6">
        {drink.briefIngredients && (
          <div className="space-y-2">
            {/* First row */}
            <div className="flex items-center gap-2">
              {drink.briefIngredients.slice(0, 2).map((ing, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <div className="h-4 w-px bg-white/30 mx-0.5 flex-shrink-0" />}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 whitespace-nowrap overflow-hidden text-white">
                    {ing.icon === 'Wine' && <Wine size={12} className="flex-shrink-0 text-white" />}
                    {ing.icon === 'Droplets' && <Droplets size={12} className="flex-shrink-0 text-white" />}
                    {ing.icon === 'ThermometerSnowflake' && <Snowflake size={12} className="flex-shrink-0 text-white" />}
                    {ing.icon === 'GlassWater' && <GlassWater size={12} className="flex-shrink-0 text-white" />}
                    {ing.icon === 'Flame' && <Wine size={12} className="flex-shrink-0 text-white" />}
                    <span className="text-[10px] uppercase tracking-wider font-medium truncate text-white">{ing.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {/* Second row */}
            {drink.briefIngredients.length > 2 && (
              <div className="flex items-center gap-2">
                {drink.briefIngredients.slice(2, 4).map((ing, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <div className="h-4 w-px bg-white/30 mx-0.5 flex-shrink-0" />}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 whitespace-nowrap overflow-hidden text-white">
                      {ing.icon === 'Wine' && <Wine size={12} className="flex-shrink-0 text-white" />}
                      {ing.icon === 'Droplets' && <Droplets size={12} className="flex-shrink-0 text-white" />}
                      {ing.icon === 'ThermometerSnowflake' && <Snowflake size={12} className="flex-shrink-0 text-white" />}
                      {ing.icon === 'GlassWater' && <GlassWater size={12} className="flex-shrink-0 text-white" />}
                      {ing.icon === 'Flame' && <Wine size={12} className="flex-shrink-0 text-white" />}
                      <span className="text-[10px] uppercase tracking-wider font-medium truncate text-white">{ing.label}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationGallery;
