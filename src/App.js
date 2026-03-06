import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ChevronLeft, Heart, HelpCircle, Play, Flame, Search, Bell,
  Martini, User, Settings2, Maximize2,
  Wine, Droplets, ThermometerSnowflake, Edit3,
  Sparkles, Lightbulb, GlassWater,
  MoreHorizontal, Users, HeartOff, Loader2
} from 'lucide-react';

import { inventoryStorage, favoriteStorage } from './store/localStorageAdapter';
import HelperModal from './components/HelperModal';
import FocusModeView from './components/FocusModeView';
import RecommendationGallery from './components/RecommendationGallery';

import { analyzeMood } from './api/moodAnalyzer';
import { evaluateAndSortDrinks } from './engine/vectorEngine';
import { generatePhilosophyTags } from './engine/philosophyTags';
import { fetchLiveQuotes } from './api/quoteGenerator';
import MineSection from './components/MineSection';
import { useTouchFeedback, useKeyboardNavigation, useCocktailApi } from './hooks';
import { InteractiveButton, SwipeableCard, PageTransition, Modal } from './components/ui';
import IngredientEditModal from './components/IngredientEditModal';

const iconMap = {
  Wine,
  Droplets,
  ThermometerSnowflake,
  GlassWater,
  Flame
};

const MOOD_TAGS = [
  { label: '#放松', value: '#放松' },
  { label: '#狂欢', value: '#狂欢' },
  { label: '#浪漫', value: '#浪漫' },
  { label: '#独处', value: '#独处' },
  { label: '#难受', value: '#难受' }
];

// 默认分类（API 加载后会被替换）
const DEFAULT_EXPLORE_CATEGORIES = [
  { label: '全部', value: 'all' },
  { label: '鸡尾酒', value: 'Cocktail' },
  { label: '经典饮品', value: 'Ordinary Drink' },
  { label: '短饮', value: 'Shot' },
  { label: '啤酒', value: 'Beer' },
  { label: '咖啡/茶', value: 'Coffee / Tea' },
  { label: '奶昔', value: 'Shake' },
  { label: '软饮料', value: 'Soft Drink' },
];

const NEGATIVE_KEYWORDS = ['慢', '累', '烦', '难', '压力', 'emo', '不开心', '糟', '委屈', '失败'];




const MoodInputSection = ({
  moodInput, setMoodInput, selectedMood, setSelectedMood, onGenerate, buttonFeedback, isMixing,
  ingredientCount, onEditIngredients
}) => (
  <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-20 bg-dreamy-gradient max-w-4xl mx-auto w-full min-h-screen relative overflow-hidden">
    {/* Background Glow Effects - Adjusted for light theme */}
    <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
    <div className="absolute top-1/4 right-0 w-80 h-80 bg-blue-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
    <div className="absolute bottom-1/3 left-0 w-72 h-72 bg-pink-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />

    {/* Header */}
    <div className="text-center mb-6 z-10">
      <h1 className="text-[32px] font-bold text-gray-800 mb-3 tracking-wide mx-auto text-center" style={{ fontFamily: 'serif' }}>现在的心情是?</h1>
      <p className="text-gray-500 text-sm font-light tracking-wider mx-auto text-center">探索未知的味觉旅程</p>
    </div>


    {/* Input Box - 优化后的版本 */}
    <div className="w-full max-w-md relative mb-6 z-10 group">
      <div
        className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-full border border-white/60 
                  group-focus-within:border-purple-300/60 group-focus-within:bg-white/70 
                  group-focus-within:scale-[1.02] transition-all duration-500"
        style={{ boxShadow: '0 4px 24px rgba(139, 92, 246, 0.05), inset 0 1px 1px rgba(255,255,255,0.6)' }}
      />
      <div className="relative flex items-center h-14 px-6">
        <Sparkles
          className="text-purple-400 mr-3 flex-shrink-0 transition-transform duration-500 group-focus-within:scale-110 group-focus-within:rotate-12"
          size={18}
        />
        <input
          value={moodInput}
          onChange={(e) => setMoodInput(e.target.value)}

          className="bg-transparent border-none focus:outline-none focus:ring-0 text-gray-800 placeholder:text-gray-400 w-full text-[15px] font-medium outline-none"
          placeholder="比如：微醺的周五夜晚..."
        />
      </div>
    </div>



    {/* Mood Tags */}
    <div className="flex flex-wrap gap-3 justify-center mb-6 z-10">
      {MOOD_TAGS.map((mood, i) => (
        <button
          key={i}
          onClick={() => setSelectedMood(mood.value)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 ${selectedMood === mood.value
            ? 'bg-white/60 border-purple-200 shadow-md text-purple-700'
            : 'bg-white/30 border-white/40 hover:bg-white/50 hover:border-white/60 text-gray-600'
            }`}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <span className={`w-2 h-2 rounded-full ${selectedMood === mood.value ? 'bg-purple-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium">{mood.label}</span>
        </button>
      ))}
    </div>

    {/* 3D Glass Card */}
    <div className="relative flex-1 w-full flex flex-col items-center justify-center pb-8">
      {/* Glass Card */}
      {/* Glass Card or Mixing Cup */}
      <div
        className="relative z-20 w-40 h-64 overflow-hidden transition-all duration-500"
        style={{
          background: isMixing
            ? 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
          backdropFilter: isMixing ? 'blur(10px)' : 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: isMixing
            ? '0 0 30px rgba(167, 139, 250, 0.3), inset 0 1px 0 rgba(255,255,255,0.5)'
            : '0 8px 32px rgba(31, 38, 135, 0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
          borderRadius: '8px 8px 32px 32px'
        }}
      >
        {isMixing ? (
          <>
            {/* 1. Rising Liquid Blob (Wave + Dreamy Glow) */}
            <div
              className="absolute left-[-50%] w-[200%] aspect-square rounded-[38%] z-10"
              style={{
                background: 'linear-gradient(to top, #A78BFA, #818CF8, #F472B6)',
                animation: 'fill-up 4s linear forwards',
                opacity: 0.95,
                willChange: 'transform'
              }}
            />

            {/* 2. Particles (Reduced to 8 for performance) */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="particle absolute z-20"
                style={{
                  left: `${Math.random() * 80 + 10}%`,
                  bottom: '0',
                  width: '4px',
                  height: '4px',
                  backgroundColor: ['#fff', '#F472B6', '#A78BFA'][i % 3],
                  animation: `particle-rise ${2.5}s ease-out infinite ${i * 0.3}s`,
                  willChange: 'transform, opacity'
                }}
              />
            ))}

            {/* 3. Spoon (Simplified) */}
            <div className="absolute inset-0 flex items-center justify-center spoon-path z-40">
              <div className="w-1.5 h-64 bg-gradient-to-r from-gray-300 via-white to-gray-300 rounded-full origin-bottom transform -translate-y-16" />
            </div>

            {/* 4. Bubbles (Reduced to 4) */}
            {[...Array(4)].map((_, i) => (
              <div
                key={`b-${i}`}
                className="bubble z-20"
                style={{
                  left: `${20 + i * 20}%`,
                  bottom: '10%',
                  width: '6px',
                  height: '6px',
                  animationDelay: `${i * 0.5}s`,
                  willChange: 'transform, opacity'
                }}
              />
            ))}
          </>
        ) : (
          /* Glass Reflection (Static State) */
          <div
            className="absolute top-0 left-0 right-0 h-1/2 rounded-t-[8px]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)' }}
          />
        )}
      </div>

      {/* Inventory Badge */}
      <div
        className="relative z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 border border-white/50 backdrop-blur-xl mt-4 cursor-pointer hover:bg-white/80 transition-colors"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
        onClick={onEditIngredients}
      >
        <span className="text-gray-700 text-sm font-medium">
          {ingredientCount} 种原料已就绪
        </span>
        <Edit3 size={14} className="text-gray-400" />
      </div>

      {/* Glowing Platform - Adjusted for light theme */}
      <div className="absolute bottom-7 w-64 h-40">
        <div className="absolute inset-0 rounded-full border-2 border-purple-200/50 animate-spin" style={{ animationDuration: '20s' }} />
        <div className="absolute inset-2 rounded-full border border-blue-200/40 animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-200/30 via-blue-100/30 to-pink-100/30 rounded-full blur-[40px] animate-pulse" />
      </div>
    </div>

    {/* Generate Button */}
    <div className="w-full max-w-md pb-6 z-10">
      <button
        onClick={onGenerate}
        className="w-full h-14 rounded-2xl relative overflow-hidden group shadow-lg shadow-purple-200"
        style={{
          background: 'linear-gradient(135deg, #A78BFA 0%, #818CF8 100%)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        {isMixing ? (
          <span className="animate-pulse">{typeof buttonFeedback?.loadingText === 'string' ? buttonFeedback.loadingText : '正在解析你的心情...'}</span>
        ) : (
          <span className="relative z-10 flex items-center justify-center gap-2 text-white font-semibold text-base">
            <Sparkles size={18} className="text-white" />
            开始生成
          </span>
        )}
      </button>
    </div>
  </div>
);

// Intervention Modal (instead of full page)
const InterventionModal = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white/95 backdrop-blur-xl rounded-t-[2rem] p-8 pb-12 mb-20 shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center">
          <Heart className="w-12 h-12 text-red-500 mb-6 fill-current animate-pulse" />
          <h2 className="text-2xl font-serif font-medium mb-8 text-center leading-relaxed text-gray-800">
            抱抱你。<br />此刻你是想...
          </h2>
          <div className="flex flex-col w-full gap-3">
            <InteractiveButton
              variant="secondary"
              fullWidth
              size="large"
              onClick={() => onSelectType('soothe')}
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#6B5B95',
                height: '56px',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.1)'
              }}
            >
              🥰 温柔治愈片刻
            </InteractiveButton>
            <InteractiveButton
              variant="secondary"
              fullWidth
              size="large"
              onClick={() => onSelectType('vent')}
              style={{
                background: 'rgba(255,107,107,0.1)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,107,107,0.3)',
                color: '#FF6B6B',
                height: '56px'
              }}
            >
              💥 肆意释放压力
            </InteractiveButton>
          </div>
        </div>
      </div>
    </div>
  );
};



const ResultsSection = ({
  drinks,
  currentIndex,
  onIndexChange,
  onBack,
  onHelp,
  onSelect,
  buttonFeedback,
  moodResult,
  customQuotes
}) => {
  const handleSwipeLeft = useCallback(() => {
    // console.log("检测到向左滑动！"); 
    onIndexChange(prev => Math.min(drinks.length - 1, prev + 1));
  }, [drinks.length, onIndexChange]);

  const handleSwipeRight = useCallback(() => {
    onIndexChange(prev => Math.max(0, prev - 1));
  }, [onIndexChange]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-dreamy-gradient">
      <header className="flex items-center justify-between p-5 pt-8 flex-none z-20">
        <InteractiveButton
          variant="icon"
          onClick={() => {
            console.log('ResultsSection back button clicked');
            onBack();
          }}
          style={buttonFeedback}
        >
          <ChevronLeft size={22} />
        </InteractiveButton>
        <h1 className="text-lg font-serif font-bold tracking-tight text-gray-800 italic leading-none">Mood Mix</h1>
        <InteractiveButton variant="icon" onClick={onHelp} style={buttonFeedback}>
          <HelpCircle size={22} className="text-gray-500" />
        </InteractiveButton>
      </header>

      <div className="flex-1 flex flex-col justify-center relative overflow-hidden">
        <div
          className="flex transition-all duration-500 ease-out items-center h-[480px]"
          style={{
            transform: `translateX(calc(12.5% - (${currentIndex} * 75%)))`,
            width: `${drinks.length * 75}%`
          }}
        >

          {drinks.map((drink, idx) => (
            <SwipeableCard
              key={drink.id}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onTap={() => onIndexChange(idx)}
              style={{ width: 'min(75vw, 400px)' }}
            >
              <DrinkResultCard
                drink={drink}
                isActive={idx === currentIndex}
                moodResult={moodResult}
                customQuote={customQuotes?.[drink.id]}
              />
            </SwipeableCard>
          ))}
        </div>

        <div
          className="absolute left-0 top-0 bottom-0 w-[15%] z-20 cursor-pointer"
          onClick={handleSwipeRight}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-[15%] z-20 cursor-pointer"
          onClick={handleSwipeLeft}
        />
      </div>

      <div className="flex flex-col items-center pb-10 flex-none z-10">
        <div className="flex gap-2.5 mb-8">
          {drinks.map((_, i) => (
            <button
              key={i}
              onClick={() => onIndexChange(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'bg-gray-900 w-6 shadow-sm' : 'bg-gray-300 w-1.5'}`}
            />
          ))}
        </div>
        <div className="flex items-center w-full px-8 gap-3">
          <InteractiveButton variant="icon" style={buttonFeedback}>
            <Maximize2 size={20} />
          </InteractiveButton>
          <InteractiveButton
            variant="primary"
            fullWidth
            size="large"
            onClick={() => onSelect(drinks[currentIndex])}
            style={{
              flex: 1,
              height: '52px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
            }}
          >
            开始制作
          </InteractiveButton>
          <InteractiveButton variant="icon" style={buttonFeedback}>
            <Settings2 size={20} />
          </InteractiveButton>
        </div>
      </div>
    </div>
  );
};

const DrinkResultCard = ({ drink, isActive, moodResult, customQuote }) => {
  const BriefIcon = iconMap[drink.briefIngredients[0]?.icon] || Wine;
  const philosophy = generatePhilosophyTags(drink.dimensions, moodResult, drink.name);

  return (
    <div
      className={`flex-none px-3 transition-all duration-500 transform ${isActive ? 'scale-100 opacity-100 z-10' : 'scale-[0.85] opacity-30 grayscale-[30%] z-0'
        }`}
      style={{ width: 'min(75vw, 400px)' }}
    >
      <div className="relative aspect-[3/4.5] rounded-[2.8rem] overflow-hidden shadow-[0_25px_60px_-12px_rgba(0,0,0,0.22)] bg-white border border-black/[0.02]">
        <img src={drink.image} className="w-full h-full object-cover" alt={drink.name} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/85" />

        <div className="absolute top-6 left-6">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full flex items-center gap-2 text-white/90 text-[11px] font-bold tracking-wide">
            <BriefIcon size={14} className="opacity-80 text-blue-300" />
            {drink.abv > 0 ? `微醺 | ABV ${drink.abv}%` : '无酒精'}
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-end pb-10 px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight leading-none drop-shadow-md">{drink.name}</h2>

          {/* Philosophy Tags & Quote */}
          <div className="mb-6 flex flex-col items-center w-full px-2">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              {philosophy.tags.map(tag => (
                <span key={tag} className="px-2.5 py-[3px] rounded bg-white/10 text-white/90 border border-white/20 text-[10px] tracking-widest font-light mix-blend-screen">
                  {tag}
                </span>
              ))}
            </div>
            {/* 渐变替换容器: 本地原始语录居中打底，一旦有大模型定制语录，通过 CSS opacity 平滑交叉过渡 */}
            <div className="relative w-full flex justify-center min-h-[40px]">
              <p className={`absolute text-[12px] text-white/70 font-light italic opacity-90 leading-relaxed max-w-[220px] transition-opacity duration-1000 ${customQuote ? 'opacity-0' : 'opacity-100'}`}>
                {philosophy.quote}
              </p>
              <p className={`absolute text-[12px] font-medium italic leading-relaxed max-w-[220px] transition-opacity duration-1000 ${customQuote ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  color: '#E0E7FF',
                  textShadow: '0 0 10px rgba(167, 139, 250, 0.4)'
                }}>
                {customQuote || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 mb-8">
            {drink.briefIngredients.map((ing, bIdx) => {
              const IconComponent = iconMap[ing.icon];
              return (
                <div key={bIdx} className="flex flex-col items-center gap-1.5">
                  <div className="text-white/90">
                    <IconComponent size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase leading-none">{ing.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between w-full px-3 gap-3">
            <InteractiveButton
              variant="icon"
              size="icon"
              style={{
                width: '44px',
                height: '44px',
                background: 'rgba(224,231,255,0.2)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <HeartOff size={20} />
            </InteractiveButton>
            <InteractiveButton
              variant="icon"
              size="icon"
              style={{
                width: '44px',
                height: '44px',
                background: 'rgba(224,231,255,0.2)',
                backdropFilter: 'blur(8px)',
                color: '#FF7675'
              }}
            >
              <Heart size={20} className="fill-current" />
            </InteractiveButton>
          </div>
        </div>
      </div>
    </div>
  );
};



const ExploreSection = ({
  category,
  onCategoryChange,
  cardFeedback,
  onSelectDrink,
  favoriteDrinks = [],
  onLikeDrink,
  onUnlikeDrink,
  // API 相关 props
  apiDrinks = [],
  apiLoading = false,
  apiError = null,
  apiCategories = [],
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const displayCategories = apiCategories.length > 0 ? apiCategories : DEFAULT_EXPLORE_CATEGORIES;

  // 搜索输入变化时调用 API
  useEffect(() => {
    if (onSearch) {
      onSearch(searchQuery);
    }
  }, [searchQuery, onSearch]);

  return (
    <div className="flex-1 flex flex-col bg-dreamy-gradient max-w-4xl mx-auto w-full h-screen overflow-hidden relative">
      <header className="sticky top-0 z-40 px-4 pt-8 pb-2">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 relative group">
              <div
                className="flex items-center w-full h-12 rounded-2xl px-4 border border-white/40 bg-indigo-50/30 backdrop-blur-md shadow-sm transition-all 
                           focus-within:bg-white/60 focus-within:border-purple-300/60 focus-within:shadow-[0_0_15px_rgba(167,139,250,0.1)]"
              >
                <Search className="text-gray-500/70 mr-2" size={18} />

                <input
                  className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-[15px] placeholder:text-gray-500/50 font-medium py-0 leading-none h-full outline-none text-gray-700"
                  placeholder="Search cocktails, e.g. Margarita..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

              </div>
            </div>
            <InteractiveButton
              variant="icon"
              style={{ ...cardFeedback, background: 'rgba(224, 231, 255, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}
            >
              <Bell size={18} className="text-gray-600" />
            </InteractiveButton>
          </div>

          {/* 分类 Tabs — 横向滚动 */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar pt-1">
            {displayCategories.map((cat, i) => {
              const isActive = category === cat.value;
              const isAll = cat.value === 'all';
              // 酒精类（前5）：琥珀/橘色系
              const ALCOHOL_CATS = ['鸡尾酒', '烈酒', '啤酒', '葡萄酒', '利口酒'];
              // 无酒精类（后5）：翡翠/绿色系
              const isAlcohol = ALCOHOL_CATS.includes(cat.value);

              // 配色方案
              let bgActive, bgInactive, colorActive, colorInactive, shadow;
              if (isAll) {
                bgActive = 'linear-gradient(135deg, #A5B4FC 0%, #C4B5FD 50%, #F9A8D4 100%)';
                bgInactive = 'linear-gradient(135deg, #A5B4FC 0%, #C4B5FD 50%, #F9A8D4 100%)';
                colorActive = '#fff';
                colorInactive = '#fff';
                shadow = '0 4px 14px rgba(165, 180, 252, 0.35)';
              } else if (isAlcohol) {
                bgActive = 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)';
                bgInactive = 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(249, 115, 22, 0.12) 100%)';
                colorActive = '#fff';
                colorInactive = '#D97706';
                shadow = isActive ? '0 4px 14px rgba(245, 158, 11, 0.35)' : '0 2px 8px rgba(0,0,0,0.02)';
              } else {
                bgActive = 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)';
                bgInactive = 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.1) 100%)';
                colorActive = '#fff';
                colorInactive = '#059669';
                shadow = isActive ? '0 4px 14px rgba(16, 185, 129, 0.35)' : '0 2px 8px rgba(0,0,0,0.02)';
              }

              return (
                <InteractiveButton
                  key={i}
                  variant={isActive ? 'primary' : 'text'}
                  size="small"
                  onClick={() => onCategoryChange(cat.value)}
                  style={{
                    padding: '6px 16px',
                    height: 'auto',
                    borderRadius: '24px',
                    background: isActive ? bgActive : bgInactive,
                    backdropFilter: 'blur(8px)',
                    border: isActive ? 'none' : '1px solid rgba(255,255,255,0.3)',
                    color: isActive ? colorActive : colorInactive,
                    boxShadow: shadow,
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap',
                    fontSize: '13px',
                  }}
                >
                  {cat.label}
                </InteractiveButton>
              );
            })}
          </div>
        </div>
      </header>

      {/* 列表渲染 */}
      <div className="flex-1 px-4 pb-28 pt-2 overflow-y-auto w-full no-scrollbar">
        {/* 加载状态 */}
        {apiLoading && (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={36} className="text-indigo-400 animate-spin mb-4" />
            <p className="text-gray-400 text-sm">正在探索美味...</p>
          </div>
        )}

        {/* 错误状态 */}
        {apiError && !apiLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-red-400 mb-2">😔 {apiError}</p>
            <button
              className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-200 transition-colors"
              onClick={() => onCategoryChange('all')}
            >
              重新加载
            </button>
          </div>
        )}

        {/* 饮品列表 */}
        {!apiLoading && !apiError && apiDrinks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiDrinks.map((drink) => (
              <SwipeableCard
                key={drink.id}
                onTap={() => onSelectDrink(drink)}
                style={{
                  ...cardFeedback,
                  borderRadius: '24px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)'
                }}
              >
                <div className="p-3 pb-0">
                  <div
                    className="relative aspect-[4/5] bg-cover bg-center rounded-2xl overflow-hidden shadow-inner"
                    style={{ backgroundImage: `url(${drink.image})` }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isLiked = favoriteDrinks.some(d => d.id === drink.id);
                        if (isLiked) {
                          onUnlikeDrink && onUnlikeDrink(drink.id);
                        } else {
                          onLikeDrink && onLikeDrink(drink);
                        }
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Heart
                        size={14}
                        className={`transition-all duration-200 ${favoriteDrinks.some(d => d.id === drink.id) ? 'text-[#FF7675] fill-current' : 'text-white'}`}
                      />
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <h3 className="font-bold text-[15px] text-gray-800 leading-tight mb-1">{drink.name}</h3>
                  <p className="text-[12px] text-gray-400 leading-tight line-clamp-1 font-medium italic">
                    {drink.nameEn || drink.sub || drink.subName || ''}
                  </p>
                </div>
              </SwipeableCard>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!apiLoading && !apiError && apiDrinks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-60">
            <Search size={48} className="mb-4" />
            <p>未找到相关饮品，换个词试试？</p>
          </div>
        )}
      </div>
    </div>
  );
};






const DrinkDetailSection = ({ drink, checkedIngredients, onToggleIngredient, onBack, onMore, onFocusMode, currentStep, cardFeedback, isLiked, onLike }) => {
  if (!drink) return null;

  const drinkIngredients = drink.ingredients || [];
  const drinkSteps = drink.steps || [{ title: 'Step 1', desc: drink.reason || 'Enjoy!' }];

  return (
    <div className="fixed inset-0 z-50 bg-dreamy-gradient overflow-y-auto pb-36">
      <div className="relative h-[40vh] w-full max-w-4xl mx-auto overflow-hidden">
        <img src={drink.image} className="w-full h-full object-cover" alt={drink.name} />
        <div className="absolute top-8 inset-x-0 px-6 flex justify-between">
          <InteractiveButton
            variant="icon"
            onClick={() => {
              onBack();
            }}
            style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}
          >
            <ChevronLeft size={22} color="#fff" />
          </InteractiveButton>
          <InteractiveButton
            variant="icon"
            style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}
          >
            <MoreHorizontal size={22} color="#fff" />
          </InteractiveButton>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-white rounded-t-[2.5rem]" />
      </div>

      <div className="relative -mt-4 bg-white min-h-[55vh] px-6 pt-2 max-w-4xl mx-auto">
        <InteractiveButton
          variant="icon"
          onClick={onLike}
          style={{
            position: 'absolute',
            top: '-16px',
            right: '24px',
            width: '48px',
            height: '48px',
            background: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            transition: 'transform 0.2s ease'
          }}
          className="hover:scale-110 active:scale-95"
        >
          <Heart
            size={24}
            className={`transition-all duration-200 ${isLiked ? 'fill-current text-[#FF7675]' : 'text-gray-300'}`}
          />
        </InteractiveButton>

        <div className="mb-6 pt-2">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{drink.name}</h1>
          {drink.nameEn && drink.nameEn !== drink.name && (
            <p className="text-sm text-gray-400 italic mb-3">{drink.nameEn}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {/* ABV 标签（如有） */}
            {drink.abv > 0 && (
              <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-lg text-xs font-bold flex items-center gap-1">
                <Martini size={14} /> ABV {drink.abv}%
              </span>
            )}
            {drink.tags?.map((tag, idx) => (
              <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">{tag}</span>
            ))}
          </div>
        </div>

        {drink.reason && (
          <p className="text-[14px] text-gray-500 leading-relaxed mb-6">{drink.reason}</p>
        )}

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">原料清单</h3>
            <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-3 py-1 rounded-full text-xs">
              <Users size={14} /> 1人份
            </div>
          </div>
          <div className="space-y-2">
            {drinkIngredients.map(ing => {
              const IngredientIcon = iconMap[ing.icon] || Wine;
              const isChecked = checkedIngredients[ing.id];

              return (
                <div
                  key={ing.id}
                  className={`flex items-center justify-between p-4 bg-gray-50/80 rounded-xl border border-transparent active:bg-gray-100 transition-all cursor-pointer ${isChecked ? 'opacity-40 grayscale' : ''}`}
                  onClick={() => onToggleIngredient(ing.id)}
                  role="button"
                  tabIndex={0}
                  style={cardFeedback}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                      <IngredientIcon size={18} />
                    </div>
                    <span className="font-bold text-gray-800">{ing.name}</span>
                  </div>
                  <span className="font-serif font-black text-gray-900">{ing.amount}{ing.unit}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-5">制作步骤</h3>
          <div className="space-y-0 relative pl-2">
            {drinkSteps.map((step, idx) => (
              <div key={idx} className="flex gap-5 pb-6 relative group">
                <div className="flex flex-col items-center">
                  <div
                    className="w-3 h-3 rounded-full bg-blue-200 border-[3px] border-white ring-4 ring-blue-50/50 z-10"
                    style={{
                      background: idx <= currentStep ? '#3B82F6' : '#BFDBFE',
                      transition: 'background 0.3s ease'
                    }}
                  />
                  {idx !== drinkSteps.length - 1 && (
                    <div
                      className="w-px h-full bg-gray-100 absolute top-4 bottom-0 left-[5px]"
                      style={{
                        background: idx < drinkSteps.length - 1 && idx < currentStep
                          ? 'linear-gradient(to bottom, #3B82F6, #BFDBFE)'
                          : '#E5E7EB'
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 -mt-1 pl-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="font-bold text-gray-900">{step.title}</h4>
                    {step.subTitle && (
                      <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wider">
                        {step.subTitle}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-5 bg-gradient-to-t from-white via-white to-transparent pt-10 z-[60] max-w-4xl mx-auto left-0 right-0">
        <InteractiveButton
          variant="primary"
          fullWidth
          size="large"
          icon={Play}
          onClick={() => {
            onFocusMode();
          }}
          style={{
            height: '56px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
          }}
        >
          进入专注模式
        </InteractiveButton>
      </div>
    </div>
  );
};

const NavigationBar = ({ activeTab, onTabChange }) => (
  <nav
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    role="navigation"
    aria-label="主导航"
  >
    <div
      className="bg-white/95 backdrop-blur-2xl h-[64px] rounded-full flex items-center justify-between px-4 w-full transition-all duration-300"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)' }}
    >
      {
        [
          { id: 'mix', icon: Martini, label: '特调' },
          { id: 'explore', icon: Lightbulb, label: '灵感' },
          { id: 'mine', icon: User, label: '我的' }
        ].map((navItem) => (
          <button
            key={navItem.id}
            onClick={() => onTabChange(navItem.id)}
            className="flex flex-col items-center justify-center flex-1 h-full px-2 relative group"
            aria-label={navItem.label}
            type="button"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === navItem.id
                ? 'bg-gray-900 scale-105'
                : 'bg-transparent hover:bg-gray-100'
                }`}
            >
              <navItem.icon
                size={22}
                className={`transition-all duration-300 ${activeTab === navItem.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                  }`}
                strokeWidth={activeTab === navItem.id ? 2 : 1.5}
              />
            </div>
            <span
              className={`text-[10px] mt-1 transition-all duration-300 ${activeTab === navItem.id
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-500 group-hover:text-gray-700'
                }`}
            >
              {navItem.label}
            </span>
          </button>
        ))
      }
    </div>
  </nav>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('mix');
  const [currentDrink, setCurrentDrink] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [recommendationPool, setRecommendationPool] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [userInventory, setUserInventory] = useState({ standard: [], custom: [] });
  const [favoriteDrinks, setFavoriteDrinks] = useState([]);
  const [sessionIngredients, setSessionIngredients] = useState([]);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [moodResult, setMoodResult] = useState(null);
  const [customQuotes, setCustomQuotes] = useState({});

  // ─── TheCocktailDB API Hook ───
  const {
    drinks: apiDrinks,
    loading: apiLoading,
    error: apiError,
    categories: apiCategories,
    searchDrinks: apiSearchDrinks,
    filterDrinksByCategory: apiFilterByCategory,
    loadAll: apiLoadAll,
    loadDrinkDetail: apiLoadDrinkDetail,
    loadCategories: apiLoadCategories,
  } = useCocktailApi();

  // 初始化：加载分类列表和全部饮品
  const [apiInitialized, setApiInitialized] = useState(false);
  useEffect(() => {
    if (!apiInitialized) {
      apiLoadCategories();
      apiLoadAll();
      setApiInitialized(true);
    }
  }, [apiInitialized, apiLoadCategories, apiLoadAll]);

  // Sync session ingredients with inventory
  useEffect(() => {
    const list = [
      ...(userInventory.standard || []).filter(i => i.in_stock).map(i => i.name_cn || i.name),
      ...(userInventory.custom || []).filter(i => i.in_stock).map(i => i.name_cn || i.name)
    ].filter(Boolean);
    // 去重
    setSessionIngredients([...new Set(list)]);
  }, [userInventory]);

  // 计算原料总数 (基于 Session)
  const ingredientCount = sessionIngredients.length;

  // Fetch favorites on mount (using LocalStorage)
  useEffect(() => {
    const loadFavorites = () => {
      try {
        const favoriteIds = favoriteStorage.getFavorites();
        const favorites = favoriteIds.map(id => apiDrinks.find(d => String(d.id) === String(id))).filter(Boolean);
        setFavoriteDrinks(favorites);
      } catch (error) {
        console.error("Failed to load favorites", error);
      }
    };
    loadFavorites();
  }, []);

  const handleLikeDrink = useCallback((drink) => {
    setFavoriteDrinks(prev => {
      if (prev.some(d => d.id === drink.id)) return prev;
      return [...prev, drink];
    });
    favoriteStorage.addFavorite(drink.id);
  }, []);

  const handleUnlikeDrink = useCallback((drinkId) => {
    setFavoriteDrinks(prev => prev.filter(d => d.id !== drinkId));
    favoriteStorage.removeFavorite(drinkId);
  }, []);

  const fetchInventory = useCallback(() => {
    try {
      const data = inventoryStorage.getInventory();
      setUserInventory(data);
    } catch (error) {
      console.error("Failed to load inventory", error);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const visibleDrinks = useMemo(() => {
    if (recommendationPool.length === 0) return [];
    const startIndex = (currentBatchIndex * 3) % recommendationPool.length;
    let batch = [];
    for (let i = 0; i < 3; i++) {
      batch.push(recommendationPool[(startIndex + i) % recommendationPool.length]);
    }
    return batch;
  }, [recommendationPool, currentBatchIndex]);

  const handleShuffle = useCallback(() => {
    setCurrentBatchIndex(prev => prev + 1);
  }, []);
  const [showHelper, setShowHelper] = useState(false);
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [interventionType, setInterventionType] = useState(null); // 'soothe' | 'vent' | null
  const [emotionType, setEmotionType] = useState(null); // 'positive' | 'negative' | 'neutral' | null
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [mixMode, setMixMode] = useState('home');
  const [moodInput, setMoodInput] = useState("");
  const [selectedMood, setSelectedMood] = useState(null);
  const [exploreCategory, setExploreCategory] = useState('all');
  const [showRecommendationGallery, setShowRecommendationGallery] = useState(false);

  // 灵感库分类切换：调用 API 筛选
  const handleExploreCategoryChange = useCallback((cat) => {
    setExploreCategory(cat);
    apiFilterByCategory(cat);
  }, [apiFilterByCategory]);

  // 灵感库搜索：调用 API 搜索
  const handleExploreSearch = useCallback((query) => {
    apiSearchDrinks(query);
  }, [apiSearchDrinks]);

  // 灵感库选择饮品: 需要加载详情后再进入详情页
  const handleExploreSelectDrink = useCallback(async (drink) => {
    const detail = await apiLoadDrinkDetail(drink);
    setCurrentDrink(detail || drink);
  }, [apiLoadDrinkDetail]);

  const mainContentRef = useRef(null);

  useEffect(() => {
    console.log('isFocusMode changed to:', isFocusMode);
  }, [isFocusMode]);

  const { style: buttonFeedback } = useTouchFeedback({ scale: 0.96, duration: 120 });
  const { style: cardFeedback } = useTouchFeedback({ scale: 0.97, duration: 180 });

  useKeyboardNavigation({
    containerRef: mainContentRef,
    onArrowLeft: () => {
      if (mixMode === 'results') {
        setCurrentCardIndex(prev => Math.max(0, prev - 1));
      }
    },
    onArrowRight: () => {
      if (mixMode === 'results') {
        setCurrentCardIndex(prev => Math.min(apiDrinks.length - 1, prev + 1));
      }
    },
    onEscape: () => {
      if (currentDrink) {
        setCurrentDrink(null);
        setCheckedIngredients({});
      } else if (showHelper) {
        setShowHelper(false);
      } else if (mixMode === 'results') {
        setMixMode('home');
      } else if (isFocusMode) {
        setIsFocusMode(false);
      }
    },
    onEnter: () => {
      if (mixMode === 'results') {
        setCurrentDrink(apiDrinks[currentCardIndex]);
      } else if (activeTab === 'mix' && mixMode === 'home') {
        processMoodAndGenerate();
      }
    }
  });

  const [buttonLoadingText, setButtonLoadingText] = useState('正在解析你的心情...');

  // 调用后端千问API进行情绪分析和饮品推荐
  const processMoodAndGenerate = useCallback(async () => {
    const combinedInput = (moodInput + (selectedMood || "")).trim();

    // 如果有自定义原料，附加到 Prompt
    let finalInputForAI = combinedInput;
    if (sessionIngredients.length > 0) {
      finalInputForAI += `\n(重要参考: 用户目前拥有的原料: ${sessionIngredients.join(', ')})`;
    }

    // 首先检查是否为负面情绪（本地快速检测）
    const isNegativeLocal = NEGATIVE_KEYWORDS.some(kw => combinedInput.toLowerCase().includes(kw)) || selectedMood === '#难受';

    if (isNegativeLocal) {
      // 负面情绪：设置情绪类型并显示干预弹窗，不播放动画
      setEmotionType('negative');
      setShowInterventionModal(true);
      return;
    }

    // 非负面情绪：设置情绪类型
    setEmotionType('positive');

    // 播放动画并设定文案
    setMixMode('generating');
    setButtonLoadingText('正在深呼吸...');

    // 动态文字：15秒后如果还在等待，则安抚用户
    const longWaitTimer = setTimeout(() => {
      setButtonLoadingText('这杯酒需要多一点灵感...');
    }, 15000);

    const minDelay = new Promise(resolve => setTimeout(resolve, 4000));

    if (!combinedInput) {
      await minDelay;
      clearTimeout(longWaitTimer);
      setMixMode('home'); // Reset mixMode to stop animation
      setShowRecommendationGallery(true);
      return;
    }

    try {
      // 调用六维心境分析与推理代理
      const [aiResult] = await Promise.all([
        analyzeMood(finalInputForAI),
        minDelay
      ]);

      console.log('六维心境分析结果:', aiResult);
      clearTimeout(longWaitTimer);

      // 检查是否为极度负面需要关怀
      if (aiResult.isNegative) {
        setMixMode('home');
        setShowInterventionModal(true);
        return;
      }

      // 执行第二步&第三步：双轨过滤与动态向量夹角排序
      const candidateSource = apiDrinks;
      const pool = evaluateAndSortDrinks(aiResult, candidateSource, sessionIngredients);

      setMoodResult(aiResult);
      setRecommendationPool(pool);
      setCurrentBatchIndex(0);
      setCurrentCardIndex(0); // 预留给可能需要的底层联动
      setMixMode('home');
      setShowRecommendationGallery(true);

      // ✅ [Stage 9 Plan A] 非阻塞流式异步大模型文案润色
      fetchLiveQuotes(pool, aiResult, 5).then((quotesMap) => {
        if (Object.keys(quotesMap).length > 0) {
          setCustomQuotes(prev => ({ ...prev, ...quotesMap }));
        }
      }).catch(err => {
        console.warn('Live quote generation failed non-fatally', err);
      });

    } catch (error) {
      console.error('分析/推荐出错:', error);
      clearTimeout(longWaitTimer);
      setMixMode('home');
      alert('分析网络可能存在波动，请稍后重试');
    }
  }, [moodInput, selectedMood, sessionIngredients, apiDrinks]);

  const handleStartGeneration = useCallback((type = null) => {
    setMixMode('generating');

    // 记录干预类型
    if (type) {
      setInterventionType(type);
    }

    // Generate recommendations after intervention
    setTimeout(async () => {
      let pool = [];
      const hour = new Date().getHours();

      // 使用传入的 type 参数而不是 state 中的 interventionType（因为 state 更新是异步的）
      const currentInterventionType = type || interventionType;

      const candidateSource = apiDrinks;

      // 根据情绪类型和干预类型构造专有的强烈覆盖向量进行伪分析
      let mockMoodData = {
        somatic: { physical: { intensity: 0.5 }, drinkMapping: { textureScore: 0, temperature: 0 } },
        demand: { physical: { intensity: 1.0 }, drinkMapping: { actionScore: 3 } },
        emotion: { physical: { intensity: 1.0 }, drinkMapping: { tasteScore: 5, colorCode: 3 } },
        cognitive: { physical: { intensity: 0.5 }, drinkMapping: { aromaScore: 5 } },
        time: { physical: { intensity: 0.5 }, drinkMapping: { temporality: new Date().getHours() } },
        socialContext: { physical: { intensity: 0.5 }, drinkMapping: { ratioScore: 15, actionScore: 3 } }
      };

      if (emotionType === 'negative' && currentInterventionType) {
        if (currentInterventionType === 'soothe') {
          // 🥰 温柔治愈片刻 - 抚慰策略：热饮、低度、甜
          mockMoodData.demand.drinkMapping.actionScore = 4; // 舒缓
          mockMoodData.somatic.drinkMapping.temperature = 5; // 热
          mockMoodData.emotion.drinkMapping.tasteScore = 8; // 偏甜
          mockMoodData.socialContext.drinkMapping.ratioScore = 5; // 超低度
        } else if (currentInterventionType === 'vent') {
          // 💥 肆意释放压力 - 刺激策略：冰、烈、酸
          mockMoodData.demand.drinkMapping.actionScore = 1; // 刺激
          mockMoodData.somatic.drinkMapping.temperature = -5; // 极冰
          mockMoodData.emotion.drinkMapping.tasteScore = 1; // 偏酸苦
          mockMoodData.socialContext.drinkMapping.ratioScore = 35; // 高度烈酒
        }
      } else if (emotionType === 'positive') {
        // ☺️ 正面情绪：气泡感、高颜值、适中甜度
        mockMoodData.demand.drinkMapping.actionScore = 2; // 欢快气泡
        mockMoodData.emotion.drinkMapping.colorCode = 5; // 缤纷
        mockMoodData.socialContext.drinkMapping.ratioScore = 15;
      }

      // 执行向量加权双轨匹配算法，代替纯种过滤
      const fullPool = evaluateAndSortDrinks(mockMoodData, candidateSource, sessionIngredients);

      // 取前9位或者满额混流
      const finalPool = fullPool.slice(0, 9);

      setMoodResult(mockMoodData);
      setRecommendationPool(finalPool.length > 0 ? finalPool : (apiDrinks.length > 0 ? apiDrinks.slice(0, 9) : []));
      setCurrentBatchIndex(0);
      setCurrentCardIndex(0);
      setMixMode('home'); // Reset mixMode to stop animation
      setShowRecommendationGallery(true);
    }, 4000);
  }, [emotionType, interventionType, setRecommendationPool, setCurrentBatchIndex, setCurrentCardIndex, setMixMode, setShowRecommendationGallery, apiDrinks, sessionIngredients]);

  const toggleIngredient = useCallback((id) => {
    setCheckedIngredients(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);



  const handleNavClick = useCallback((tab) => {
    // 1. 如果正在看单品详情，关闭它（这个保留，防止详情页挡住所有 Tab）
    if (currentDrink) {
      setCurrentDrink(null);
      setCheckedIngredients({});
    }

    // 2. 切换 Tab
    setActiveTab(tab);

  }, [currentDrink]);

  const getBackgroundClass = useCallback(() => {
    // 统一使用浅色背景，不再根据模式切换深色背景
    return 'bg-[#FAFAFA]';
  }, []);


  return (
    <div
      ref={mainContentRef}
      className={`min-h-screen font-sans w-full relative shadow-2xl overflow-x-hidden flex flex-col transition-colors duration-700 ${getBackgroundClass()}`}
      tabIndex={-1}
    >
      <main className="flex-1 flex flex-col w-full relative">
        {activeTab === 'mix' && showRecommendationGallery && (
          <RecommendationGallery
            drinks={visibleDrinks.length > 0 ? visibleDrinks : (apiDrinks.length > 0 ? apiDrinks.slice(0, 3) : [{ id: 'loading', name: '探索配方中...', image: '', abv: 0, ingredients: [] }])}
            onBack={() => {
              setShowRecommendationGallery(false);
              setMixMode('home');
            }}
            onStartMaking={(drink) => {
              setCurrentDrink(drink); // Use the passed drink object which RecommendationGallery provides
            }}
            onShuffle={handleShuffle}
            onNavigate={handleNavClick}
            onLikeDrink={handleLikeDrink}
            onUnlikeDrink={handleUnlikeDrink}
            favoriteDrinks={favoriteDrinks}
            moodResult={moodResult}
            customQuotes={customQuotes}
          />
        )}

        {activeTab === 'mix' && !showRecommendationGallery && !currentDrink && (
          <div className="flex-1 flex flex-col relative animate-in fade-in duration-500">
            {(mixMode === 'home' || mixMode === 'generating') && (
              <MoodInputSection
                moodInput={moodInput}
                setMoodInput={setMoodInput}
                selectedMood={selectedMood}
                setSelectedMood={setSelectedMood}
                onGenerate={processMoodAndGenerate}
                buttonFeedback={{ ...buttonFeedback, loadingText: buttonLoadingText }}
                isMixing={mixMode === 'generating'}
                ingredientCount={ingredientCount}
                onEditIngredients={() => setShowIngredientModal(true)}
              />
            )}

            {mixMode === 'results' && (
              <PageTransition animation="slide" duration={500}>
                <ResultsSection
                  drinks={apiDrinks}
                  currentIndex={currentCardIndex}
                  onIndexChange={setCurrentCardIndex}
                  onBack={() => setMixMode('home')}
                  onHelp={() => setShowHelper(true)}
                  onSelect={setCurrentDrink}
                  buttonFeedback={buttonFeedback}
                  moodResult={moodResult}
                />
              </PageTransition>
            )}
          </div>
        )}

        {activeTab === 'explore' && !currentDrink && (
          <PageTransition animation="fade" duration={400}>
            <ExploreSection
              category={exploreCategory}
              onCategoryChange={handleExploreCategoryChange}
              cardFeedback={cardFeedback}
              onSelectDrink={handleExploreSelectDrink}
              favoriteDrinks={favoriteDrinks}
              onLikeDrink={handleLikeDrink}
              onUnlikeDrink={handleUnlikeDrink}
              apiDrinks={apiDrinks}
              apiLoading={apiLoading}
              apiError={apiError}
              apiCategories={apiCategories}
              onSearch={handleExploreSearch}
            />
          </PageTransition>
        )}

        {activeTab === 'mine' && !currentDrink && (
          <PageTransition animation="fade" duration={400}>
            <MineSection
              userInventory={userInventory}
              onUpdateInventory={fetchInventory}
              favorites={favoriteDrinks}
              cardFeedback={cardFeedback}
              onSelectDrink={setCurrentDrink}
            />
          </PageTransition>
        )}

        {currentDrink && (
          <PageTransition animation="slide" duration={400}>
            <DrinkDetailSection
              drink={currentDrink}
              checkedIngredients={checkedIngredients}
              onToggleIngredient={toggleIngredient}
              onBack={() => {
                setCurrentDrink(null);
                setCheckedIngredients({});
              }}
              onMore={() => { }}
              onFocusMode={() => {
                setIsFocusMode(true);
                setCurrentStep(0);
              }}
              currentStep={currentStep}
              cardFeedback={cardFeedback}
              isLiked={favoriteDrinks.some(d => d.id === currentDrink?.id)}
              onLike={() => {
                if (favoriteDrinks.some(d => d.id === currentDrink?.id)) {
                  handleUnlikeDrink(currentDrink.id);
                } else {
                  handleLikeDrink(currentDrink);
                }
              }}
            />
          </PageTransition>
        )}
      </main>

      {!isFocusMode && !currentDrink && (
        <div className="relative z-[100]">
          <NavigationBar
            activeTab={activeTab}
            onTabChange={handleNavClick}
          />
        </div>
      )}

      <Modal isOpen={showHelper} onClose={() => setShowHelper(false)} position="bottom">
        <HelperModal onClose={() => setShowHelper(false)} />
      </Modal>

      {/* Intervention Modal */}
      <InterventionModal
        isOpen={showInterventionModal}
        onClose={() => setShowInterventionModal(false)}
        onSelectType={(type) => {
          setInterventionType(type);
          setShowInterventionModal(false);
          handleStartGeneration(type);
        }}
      />

      {isFocusMode && currentDrink && (
        <FocusModeView
          drink={currentDrink}
          currentStep={currentStep}
          onNext={() => setCurrentStep(p => p + 1)}
          onPrevious={() => setCurrentStep(p => p - 1)}
          onComplete={() => setIsFocusMode(false)}
        />

      )}

      {/* Ingredient Edit Modal */}
      <Modal isOpen={showIngredientModal} onClose={() => setShowIngredientModal(false)} position="center">
        <IngredientEditModal
          currentIngredients={sessionIngredients}
          onUpdate={(newList) => setSessionIngredients(newList)}
          onClose={() => setShowIngredientModal(false)}
          onReset={() => {
            // Reset to inventory
            const list = [
              ...(userInventory.standard || []).map(i => i.name_cn || i.name),
              ...(userInventory.custom || []).map(i => i.name_cn || i.name)
            ].filter(Boolean);
            setSessionIngredients([...new Set(list)]);
          }}
        />
      </Modal>
    </div>
  );
};

export default App;
