import React, { useState, useEffect } from 'react';
import { ChevronLeft, HelpCircle, Shuffle, Settings2, Heart, Wine, Lightbulb, User, Droplets, GlassWater, Snowflake, Sparkles, Check, AlertCircle } from 'lucide-react';

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

  // Reset index when drinks batch changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [drinks]);

  if (!drinks || drinks.length === 0) return null;

  // Calculate card styles for grid layout
  const getCardStyle = (index) => {
    const screenWidth = screenSize.width;
    
    // 根据屏幕宽度决定每行显示的卡片数量
    let columnsPerRow;
    if (screenWidth <= 600) {
      // 0-600px 显示两列，包括380px、400px和479px
      columnsPerRow = 2;
    } else {
      // 600px以上显示三列
      columnsPerRow = 3;
    }
    
    // 计算卡片宽度（考虑间距）
    const gap = 6; // 进一步减小间距，增加适配性
    const padding = 16; // 容器padding：左右各8px，总padding 16px
    const availableWidth = screenWidth - padding;
    
    // 计算卡片宽度，确保不超过可用宽度
    const baseWidth = Math.max(
      Math.floor((availableWidth - (columnsPerRow - 1) * gap) / columnsPerRow), 
      30
    ); // 最小宽度30px，向下取整确保总宽度不超过
    
    const baseHeight = baseWidth * 1.25; // 保持4:5的比例
    
    return {
      position: 'relative',
      width: baseWidth,
      height: baseHeight,
      margin: gap / 2,
      transition: 'all 0.3s ease',
      flex: `0 0 ${baseWidth}px`, // 固定卡片宽度
      minWidth: 0, // 防止内容撑开卡片
      boxSizing: 'border-box' // 确保padding和border不影响宽度计算
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
          <span className="text-gray-500 text-sm font-medium">{currentIndex + 1}</span>
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / drinks.length) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 text-sm font-medium">{drinks.length}</span>
        </div>

        {/* Grid Scene - Cards Container */}
        <div
          className="relative w-full flex-1 flex items-center justify-center min-h-0 overflow-y-auto"
        >
          {/* Cards Grid */}
          <div 
            className="flex flex-wrap justify-start w-full px-2"
            style={{
              maxWidth: '1200px',
              boxSizing: 'border-box',
              width: '100%',
              minWidth: 0
            }}
          >
            {drinks.map((drink, index) => (
              <div
                key={drink.id}
                className="cursor-pointer flex-shrink-0"
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

// Enhanced Card Content Component
const CardContent = ({ drink, isActive, isLiked, onLike, onUnlike }) => {
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
        style={{ backgroundImage: `url('${drink.image}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
      </div>

      {/* Glass Border Effect */}
      <div
        className="absolute inset-0 rounded-[1rem] pointer-events-none"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)',
        }}
      />

      {/* Highlight Shine */}
      <div
        className="absolute top-0 left-0 right-0 h-1/3 rounded-t-[1rem] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
        }}
      />

      {/* Badge - Top Left */}
      <div className="absolute top-3 left-3 z-20">
        <div
          className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md transition-all duration-300"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          <Droplets size={11} className="text-cyan-300 flex-shrink-0" />
          <span className="tracking-wide truncate">{drink.abv > 0 ? `微醺 · ${drink.abv}%` : '无酒精'}</span>
        </div>

        {/* Availability Badge */}
        {drink.availability && (
          <div
            className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-md mt-1.5 border shadow-md ${drink.availability.status === 'exact' ? 'bg-green-500/20 border-green-400/30 text-green-100' :
              drink.availability.status === 'missing' ? 'bg-orange-500/20 border-orange-400/30 text-orange-100' :
                drink.availability.status === 'substitute' ? 'bg-blue-500/20 border-blue-400/30 text-blue-100' :
                  'hidden'
              }`}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {drink.availability.status === 'exact' && <><Check size={10} className="flex-shrink-0" /> <span className="truncate">此刻能做</span></>}
            {drink.availability.status === 'missing' && <><AlertCircle size={10} className="flex-shrink-0" /> <span className="truncate">缺 {drink.availability.missing_count} 样</span></>}
            {drink.availability.status === 'substitute' && <><Lightbulb size={10} className="flex-shrink-0" /> <span className="truncate">智能平替</span></>}
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
        className={`absolute top-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 ${isLiked ? 'text-red-400' : 'text-white/80 hover:text-white'
          }`}
        style={{
          background: isLiked
            ? 'rgba(239, 68, 68, 0.15)'
            : 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
          border: isLiked
            ? '1px solid rgba(239, 68, 68, 0.25)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}
      >
        <Heart size={14} className={isLiked ? 'fill-current' : ''} />
      </button>

      {/* Drink Info - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col p-2 pb-1.5 text-white overflow-hidden">
        <h2
          className="text-sm sm:text-base font-bold leading-tight mb-1 truncate"
          style={{
            fontFamily: 'serif',
            textShadow: '0 1px 12px rgba(0,0,0,0.4)',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {drink.name}
        </h2>
        <p
          className="text-[10px] sm:text-xs font-light leading-relaxed text-white/70 mb-1.5 line-clamp-2"
          style={{
            textShadow: '0 1px 6px rgba(0,0,0,0.3)',
            lineHeight: '1.5',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {drink.reason}
        </p>

        {/* Ingredients */}
        {drink.briefIngredients && (
          <div className="flex items-center gap-1 text-white/60 overflow-hidden flex-wrap">
            {drink.briefIngredients.slice(0, 3).map((ing, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <div className="h-3 w-px bg-white/15 mx-0.5 flex-shrink-0" />}
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 backdrop-blur-sm border border-white/8 whitespace-nowrap overflow-hidden">
                  {ing.icon === 'Wine' && <Wine size={11} className="flex-shrink-0" />}
                  {ing.icon === 'Droplets' && <Droplets size={11} className="flex-shrink-0" />}
                  {ing.icon === 'ThermometerSnowflake' && <Snowflake size={11} className="flex-shrink-0" />}
                  {ing.icon === 'GlassWater' && <GlassWater size={11} className="flex-shrink-0" />}
                  {ing.icon === 'Flame' && <Wine size={11} className="flex-shrink-0" />}
                  <span className="text-[8px] uppercase tracking-wider font-medium truncate">{ing.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Availability Details */}
        {drink.availability && drink.availability.status === 'missing' && (
          <div className="mt-1 text-[10px] font-medium text-orange-200 flex items-center gap-0.5">
            <AlertCircle size={10} />
            <span>缺: {drink.availability.missing.join(', ')}</span>
          </div>
        )}
        {drink.availability && drink.availability.status === 'substitute' && drink.availability.substitutions.slice(0, 1).map((sub, idx) => (
          <div key={idx} className="mt-1 text-[10px] font-medium text-blue-200 flex items-center gap-0.5">
            <Lightbulb size={10} />
            <span>{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationGallery;
