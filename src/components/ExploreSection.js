import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, Loader2, Plus, Search } from 'lucide-react';
import { InteractiveButton } from './ui';
import { translateDrinkName } from '../data/translations';

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
  onNavigate,
  activeTab,
  onAddCustomDrink,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const PAGE_SIZE = 24; // 每批展示数量（移动端避免一次性渲染太多图片）
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const displayCategories = apiCategories.length > 0 ? apiCategories : DEFAULT_EXPLORE_CATEGORIES;
  const visibleDrinks = apiDrinks.slice(0, visibleCount);

  // 搜索输入变化时调用 API
  useEffect(() => {
    if (onSearch) {
      onSearch(searchQuery);
    }
  }, [searchQuery, onSearch]);

  // 当搜索/分类结果变更时重置分页
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [apiDrinks]);

  // 触底/可视区追加加载
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (apiLoading || apiError) return;
    if (visibleCount >= apiDrinks.length) return;

    // 不支持 IntersectionObserver 则直接展示全部（兼容老设备）
    if (!('IntersectionObserver' in window)) {
      setVisibleCount(apiDrinks.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          setVisibleCount((prev) => Math.min(apiDrinks.length, prev + PAGE_SIZE));
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [apiLoading, apiError, apiDrinks.length, visibleCount]);

  return (
    <div className="flex-1 flex flex-col bg-dreamy-gradient max-w-4xl mx-auto w-full min-h-[100svh] overflow-x-hidden overflow-y-auto relative pb-24">
      <header className="sticky top-0 z-40 px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-2 bg-dreamy-gradient/80 backdrop-blur-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 w-full">
            {/* 返回按钮 */}
            <button
              onClick={() => onNavigate && onNavigate('mix')}
              className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md flex items-center justify-center hover:bg-white/70 transition-colors border border-white/30 shadow-sm flex-shrink-0"
              aria-label="返回特调"
            >
              <ArrowLeft size={18} className="text-gray-600" />
            </button>

            <div className="flex-1 relative group">
              <div
                className="flex items-center w-full h-12 rounded-2xl px-4 border border-white/40 bg-white/30 backdrop-blur-xl shadow-sm transition-all 
                           focus-within:bg-white/50 focus-within:border-white/60 focus-within:shadow-md"
              >
                <Search className="text-gray-400/80 mr-2" size={18} />

                <input
                  className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-[15.5px] placeholder:text-gray-400/60 font-medium py-0 leading-none h-full outline-none text-gray-800"
                  style={{
                    fontFamily:
                      "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
                    letterSpacing: '0.02em',
                  }}
                  placeholder="寻一抹微醺，觅万般心绪..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <InteractiveButton
              variant="icon"
              onClick={onAddCustomDrink}
              style={{
                ...cardFeedback,
                background: 'rgba(224, 231, 255, 0.4)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.4)',
              }}
            >
              <Plus size={18} className="text-gray-600" />
            </InteractiveButton>
          </div>

          {/* 分类 Tabs — 横向滚动 */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar pt-1">
            {displayCategories.map((cat, i) => {
              const isActive = category === cat.value;
              const isAll = cat.value === 'all';
              // 酒精类: 赭石/茶褐色系
              const ALCOHOL_CATS = ['鸡尾酒', '烈酒', '蒸馏酒', '啤酒', '葡萄酒', '利口酒'];
              const isAlcohol = ALCOHOL_CATS.includes(cat.value);

              // 配色方案: 与整体UI相符的玉质/温润色调
              let bgActive, bgInactive, colorActive, colorInactive, shadow, border;
              bgInactive = 'rgba(255, 255, 255, 0.6)';
              colorInactive = '#6b6961';
              
              if (isAll) {
                bgActive = '#3c3b36'; // 焦茶
                colorActive = '#ebdfc8';
                shadow = isActive ? '0 6px 16px rgba(60, 59, 54, 0.2)' : 'none';
                border = isActive ? '1px solid #3c3b36' : '1px solid rgba(60, 59, 54, 0.1)';
              } else if (isAlcohol) {
                bgActive = '#8c6b54'; // 琥珀/暖褐
                colorActive = '#f7f0e4';
                shadow = isActive ? '0 6px 16px rgba(140, 107, 84, 0.25)' : 'none';
                border = isActive ? '1px solid #8c6b54' : '1px solid rgba(60, 59, 54, 0.1)';
              } else {
                bgActive = '#608a6e'; // 竹青/玉色
                colorActive = '#f7f0e4';
                shadow = isActive ? '0 6px 16px rgba(96, 138, 110, 0.25)' : 'none';
                border = isActive ? '1px solid #608a6e' : '1px solid rgba(60, 59, 54, 0.1)';
              }

              return (
                <InteractiveButton
                  key={i}
                  variant={isActive ? 'primary' : 'text'}
                  size="small"
                  onClick={() => onCategoryChange(cat.value)}
                  style={{
                    padding: '7px 18px',
                    height: 'auto',
                    borderRadius: '50px',
                    background: isActive ? bgActive : bgInactive,
                    backdropFilter: 'blur(12px)',
                    border: border,
                    color: isActive ? colorActive : colorInactive,
                    boxShadow: shadow,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    fontSize: '0.85rem',
                    fontFamily:
                      "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
                    letterSpacing: '0.05em',
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
      <div className="flex-1 px-3 sm:px-4 pb-24 sm:pb-28 pt-2 overflow-y-auto w-full no-scrollbar">
        {/* 加载状态 */}
        {apiLoading && (
          <div className="flex flex-col items-center justify-center h-56 sm:h-64">
            <Loader2 size={36} className="text-indigo-400 animate-spin mb-4" />
            <p className="text-gray-400 text-xs sm:text-sm">正在探索美味...</p>
          </div>
        )}

        {/* 错误状态 */}
        {apiError && !apiLoading && (
          <div className="flex flex-col items-center justify-center h-56 sm:h-64 text-gray-400">
            <p className="text-red-400 mb-2 text-sm">😔 {apiError}</p>
            <button
              className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-xl text-xs sm:text-sm font-medium hover:bg-indigo-200 transition-colors"
              onClick={() => onCategoryChange('all')}
            >
              重新加载
            </button>
          </div>
        )}

        {/* 饮品列表 */}
        {!apiLoading && !apiError && apiDrinks.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {visibleDrinks.map((drink) => (
              <div
                key={drink.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDrink(drink)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDrink(drink);
                  }
                }}
                style={{
                  ...cardFeedback,
                  borderRadius: '20px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                  minWidth: 0,
                  cursor: 'pointer',
                }}
              >
                <div className="p-2 sm:p-3 pb-0">
                  <div className="relative aspect-[4/5] overflow-hidden shadow-inner" style={{ borderRadius: '20px' }}>
                    <img
                      src={drink.imagePreview || drink.image}
                      alt={drink.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isLiked = favoriteDrinks.some((d) => d.id === drink.id);
                        if (isLiked) {
                          onUnlikeDrink && onUnlikeDrink(drink.id);
                        } else {
                          onLikeDrink && onLikeDrink(drink);
                        }
                      }}
                      className="absolute top-2 right-2 w-7 sm:w-8 h-7 sm:h-8 bg-black/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Heart
                        size={14}
                        className={`transition-all duration-200 ${
                          favoriteDrinks.some((d) => d.id === drink.id) ? 'text-[#FF7675] fill-current' : 'text-white'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="px-3 sm:px-4 py-2 sm:py-3">
                  <h3
                    className="font-bold text-sm sm:text-[15px] text-gray-800 leading-tight mb-0.5 sm:mb-1"
                    style={{
                      fontFamily:
                        "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
                    }}
                  >
                    {drink.name_cn || translateDrinkName(drink.name) || drink.name}
                  </h3>

                  {(() => {
                    const h3Text = drink.name_cn || translateDrinkName(drink.name) || drink.name;
                    const pText = drink.nameEn || drink.sub || drink.subName || '';
                    return pText && h3Text !== pText;
                  })() && (
                    <p
                      className="text-[11px] sm:text-[12px] text-gray-400 leading-tight line-clamp-1 font-medium italic"
                      style={{
                        fontFamily:
                          "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
                      }}
                    >
                      {drink.nameEn || drink.sub || drink.subName || ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 继续加载更多的哨兵节点 */}
        {!apiLoading && !apiError && apiDrinks.length > visibleDrinks.length && <div ref={sentinelRef} className="h-10" />}

        {/* 空状态 */}
        {!apiLoading && !apiError && apiDrinks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-56 sm:h-64 text-gray-400 opacity-60">
            <Search size={48} className="mb-4" />
            <p className="text-sm">未找到相关饮品，换个词试试？</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreSection;

