import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ChevronLeft, Heart, HelpCircle, Flame, Search, Plus,
  Martini, User, Settings2, Maximize2,
  Wine, Droplets, ThermometerSnowflake,
  Sparkles, Lightbulb, GlassWater,
  Users, HeartOff, Loader2, Camera, X
} from 'lucide-react';

import { inventoryStorage, favoriteStorage, collectionStorage, customDrinkStorage } from './store/localStorageAdapter';
import HelperModal from './components/HelperModal';
import DrinkHelpModal from './components/DrinkHelpModal';
import FocusModeView from './components/FocusModeView';
import RecommendationGallery from './components/RecommendationGallery';

import { analyzeMood } from './api/moodAnalyzer';
import { evaluateAndSortDrinks } from './engine/vectorEngine';
import { executeRecommendationPipeline, extractRecommendationResult } from './agents';
import { generatePhilosophyTags } from './engine/philosophyTags';
import { fetchLiveQuotes } from './api/quoteGenerator';
import { translateDrinkName, translateIngredient } from './data/translations';
import MineSection from './components/MineSection';
import { useTouchFeedback, useKeyboardNavigation, useCocktailApi } from './hooks';
import { InteractiveButton, SwipeableCard, PageTransition, Modal } from './components/ui';
import IngredientEditModal from './components/IngredientEditModal';
import cupRippleImage from './assets/cup-ripple.jpg';
import navIconMix from './assets/nav_icon_mix.png';
import navIconExplore from './assets/nav_icon_explore.png';
import navIconMine from './assets/nav_icon_mine.png';

// 一次性清除旧版诗化推荐语缓存 (针对 Phase 2 升级)
if (!localStorage.getItem('moodmix_v2_cache_cleared')) {
  localStorage.removeItem('moodmix_ai_quotes_cache');
  localStorage.setItem('moodmix_v2_cache_cleared', 'true');
  console.log('⚡ [System] Stale quote cache cleared for V2 upgrade.');
}

const iconMap = {
  Wine,
  Droplets,
  ThermometerSnowflake,
  GlassWater,
  Flame
};

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

const NEGATIVE_KEYWORDS = ['慢', '累', '烦', '难', '压力', 'emo', '不开心', '糟', '委屈', '失败', '丧', '崩溃', '绝望', '无助', '痛苦', '想哭', '伤心', '难过', '心塞'];

// 发泄意图关键词 - 用户想释放压力、宣泄情绪
const VENT_KEYWORDS = ['破', '砸', '释放', '发泄', '爆炸', '去死', '杀', '打', '毁', '摸不着头脑', '要疯', '爆粗口', '摧毁', '拼了', '大叫', '尖叫', '抱着啤酒哭', '一醉方休', '扎心', '火大'];

// 安抚意图关键词 - 用户想被治愈、安慰
const SOOTHE_KEYWORDS = ['抱抱', '安慰', '温暖', '治愈', '静静', '平静', '不想说话', '想家', '懒', '休息', '安睡', '舒服', '轻松', '安定', '宁静', '蹲着', '缩起来', '被窝里', '哭一场', '睡一觉'];

const MOOD_INPUT_PLACEHOLDERS = [
  '比如，心里有点空，又说不清为什么…',
  '比如，平静，但隐隐有些期待…',
  '比如，莫名烦躁，什么都不想做…',
  '比如，老板又给我加薪了...'
];

/**
 * 检测用户在负面情绪时的意图
 * @returns {null | 'vent' | 'soothe'} - null表示无法自动判断，需要询问用户
 */
function detectNegativeIntent(input) {
  const text = input.toLowerCase();

  const ventScore = VENT_KEYWORDS.filter(kw => text.includes(kw)).length;
  const sootheScore = SOOTHE_KEYWORDS.filter(kw => text.includes(kw)).length;

  // 只有当某一方明显占优时才自动选择
  if (ventScore > 0 && sootheScore === 0) {
    return 'vent';
  }
  if (sootheScore > 0 && ventScore === 0) {
    return 'soothe';
  }
  if (ventScore >= 2 && ventScore > sootheScore * 2) {
    return 'vent';
  }
  if (sootheScore >= 2 && sootheScore > ventScore * 2) {
    return 'soothe';
  }

  // 无法明确判断，需要询问用户
  return null;
}




const MoodInputSection = ({
  moodInput, setMoodInput, selectedMood, setSelectedMood, onGenerate, buttonFeedback, isMixing,
  ingredientCount, onEditIngredients, onNavigate, activeTab
}) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % MOOD_INPUT_PLACEHOLDERS.length);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-24 bg-dreamy-gradient w-full min-h-[100svh] relative overflow-x-hidden overflow-y-auto trae-browser-inspect-draggable">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-blue-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-1/3 left-0 w-72 h-72 bg-pink-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="text-center mb-4 sm:mb-6 z-10">
        <h2 className="text-2xl xs:text-[24px] sm:text-[28px] font-extrabold text-gray-800 mb-2 sm:mb-3 tracking-wide mx-auto text-center" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>此刻，心境如何？</h2>
        <p
          className="text-gray-500 text-xs sm:text-sm font-light tracking-wider mx-auto text-center italic"
          style={{ fontFamily: '"FZYouSong", "方正悠宋", serif' }}
        >
          万般心绪，皆可入杯
        </p>
      </div>
      <div className="w-full max-w-[21rem] sm:max-w-[23rem] relative mb-4 sm:mb-6 z-10 group">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[28px] sm:backdrop-blur-[34px] rounded-xl sm:rounded-2xl group-focus-within:bg-white/15 group-focus-within:scale-[1.02] transition-all duration-500" style={{ boxShadow: 'rgba(255, 255, 255, 0.22) 0px 10px 34px, rgba(154, 169, 186, 0.12) 0px 20px 44px' }}></div>
        <div className="relative flex items-center h-10 sm:h-12 lg:h-14 px-3.5 sm:px-4.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            className="w-[36px] h-[36px] sm:w-[44px] sm:h-[44px] mr-1.5 sm:mr-2 flex-shrink-0 transition-transform duration-500 group-focus-within:scale-105"
            style={{ animation: 'ember-drop-breathe 3s ease-in-out infinite' }}
            aria-hidden="true"
          >
            <path d="M12.2 4.4C10.1 7 8.9 9.2 8.9 11.8C8.9 14.8 10.8 17 13 17C15 17 16.7 15.3 16.7 12.8C16.7 10.5 15.5 8.1 12.2 4.4Z" fill="rgba(228, 181, 94, 0.86)"></path>
            <path d="M12.4 7.4C11.1 9 10.4 10.4 10.4 12C10.4 13.8 11.5 15 12.9 15C14.1 15 15 14 15 12.4C15 10.9 14.2 9.4 12.4 7.4Z" fill="rgba(255, 240, 196, 0.72)"></path>
            <circle cx="16.7" cy="8.1" r="1" fill="rgba(255, 228, 168, 0.48)"></circle>
          </svg>
          <div className="relative flex-1">
            {!moodInput && (
              <span
                className="absolute inset-y-0 left-0 flex items-center text-gray-400 text-sm sm:text-[15px] font-medium pointer-events-none"
                style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
              >
                {MOOD_INPUT_PLACEHOLDERS[placeholderIndex]}
              </span>
            )}
            <input className="bg-transparent border-none focus:outline-none focus:ring-0 text-gray-800 w-full text-sm sm:text-[15px] font-medium outline-none" placeholder="" value={moodInput} onChange={(e) => setMoodInput(e.target.value)}></input>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-4 justify-center mb-4 sm:mb-6 z-10">
        {[
          { label: '放松', value: '#放松' },
          { label: '浪漫', value: '#浪漫' },
          { label: '难受', value: '#难受' }
        ].map((mood) => {
          const isSelected = selectedMood === mood.value;
          return (
            <button
              key={mood.value}
              type="button"
              onClick={() => setSelectedMood(isSelected ? null : mood.value)}
              className={`mood-ink-tag ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected}
              style={{
                '--mood-ink-color': isSelected ? 'rgba(224, 197, 110, 0.24)' : 'rgba(104, 114, 120, 0.2)',
                '--mood-ink-accent': isSelected ? 'rgba(204, 172, 74, 0.82)' : 'rgba(72, 82, 89, 0.5)'
              }}
            >
              <span className={`mood-ink-tag__label ${isSelected ? 'is-selected' : ''}`}>{mood.label}</span>
            </button>
          );
        })}
      </div>
      <div className="relative flex-1 w-full flex flex-col items-center justify-start pt-2 sm:pt-3 pb-12 sm:pb-16">
        <div className="relative z-20 w-[320px] sm:w-[420px] max-w-[92vw] transition-all duration-500">
          <img
            src={cupRippleImage}
            alt="杯子和水波"
            className={`w-full h-auto object-contain select-none pointer-events-none transition-all duration-500 ${isMixing ? 'scale-[1.02] opacity-95' : 'scale-100 opacity-100'}`}
          />
        </div>

        <button
          type="button"
          className="relative z-30 -mt-1 sm:-mt-1.5 mb-0.5 sm:mb-1 px-5 py-2 text-[13px] sm:text-[14px] text-gray-700/80 transition-colors hover:text-gray-800 group"
          style={{ fontFamily: '"FZQingKeBenYueSongS-R-GB", "方正清刻本悦宋简体", "Songti SC", serif', fontWeight: 300, letterSpacing: '0.14em' }}
          onClick={onEditIngredients}
          aria-label={`当前有 ${ingredientCount} 种特调原料已备齐`}
        >
          <span
            className="absolute inset-x-0 -inset-y-1 rounded-[999px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 30% 46%, rgba(210, 170, 176, 0.18) 0%, rgba(210, 170, 176, 0.08) 34%, transparent 68%), radial-gradient(ellipse at 68% 52%, rgba(156, 184, 144, 0.18) 0%, rgba(156, 184, 144, 0.08) 32%, transparent 70%), radial-gradient(ellipse at 52% 50%, rgba(244, 241, 233, 0.12) 0%, transparent 74%)',
              filter: 'blur(9px)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              clipPath: 'polygon(6% 58%, 14% 36%, 30% 20%, 48% 12%, 66% 18%, 84% 34%, 95% 52%, 88% 66%, 72% 78%, 52% 84%, 30% 80%, 14% 72%)'
            }}
          />
          <span className="relative inline-flex items-center gap-3">
            <span>{ingredientCount} 种原料已备齐</span>
            <span className="relative h-8 w-8 sm:h-9 sm:w-9">
              <span
                className="absolute inset-0 rounded-full opacity-0 group-active:opacity-100 group-active:[animation:ink-tap-ripple_420ms_ease-out]"
                style={{
                  background: 'radial-gradient(circle, rgba(88, 97, 104, 0.16) 0%, rgba(88, 97, 104, 0.08) 34%, transparent 70%)'
                }}
              />
              <svg
                viewBox="0 0 32 32"
                aria-hidden="true"
                className="absolute inset-[1px] h-[calc(100%-2px)] w-[calc(100%-2px)] opacity-90 transition-transform duration-500 group-hover:scale-105 group-hover:[animation:brush-breathe_3.2s_ease-in-out_infinite]"
                style={{
                  transform: 'rotate(28deg)',
                  filter: 'drop-shadow(0 3px 6px rgba(92, 113, 138, 0.18))'
                }}
              >
                <defs>
                  <linearGradient id="leafWash" x1="0%" x2="74%" y1="100%" y2="4%">
                    <stop offset="0%" stopColor="rgba(58, 101, 160, 0.95)" />
                    <stop offset="42%" stopColor="rgba(155, 185, 214, 0.82)" />
                    <stop offset="100%" stopColor="rgba(228, 233, 231, 0.92)" />
                  </linearGradient>
                  <linearGradient id="leafStem" x1="0%" x2="100%" y1="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(115, 143, 176, 0.88)" />
                    <stop offset="100%" stopColor="rgba(210, 220, 224, 0.94)" />
                  </linearGradient>
                </defs>
                <path
                  d="M6.5 25.5C4.8 20.1 5.7 13.9 10.1 9.7C14.3 5.7 20.2 5.3 25.8 7.1C22.8 11.2 19.5 15 16.4 18.9C13.4 22.5 10.5 26 6.5 25.5Z"
                  fill="url(#leafWash)"
                />
                <path
                  d="M6.8 25.2C8.7 23.6 10.1 22 12.1 19.4C15.8 14.7 19.4 10.8 25.7 7.2"
                  fill="none"
                  stroke="url(#leafStem)"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                />
                <path d="M10.1 21.9L12.5 18.4" fill="none" stroke="rgba(188, 207, 220, 0.72)" strokeWidth="0.75" strokeLinecap="round" />
                <path d="M12.8 18.6L15.4 16.1" fill="none" stroke="rgba(186, 205, 220, 0.7)" strokeWidth="0.75" strokeLinecap="round" />
                <path d="M15.7 15.6L18.9 12.9" fill="none" stroke="rgba(191, 207, 220, 0.68)" strokeWidth="0.75" strokeLinecap="round" />
                <path d="M14.1 19L10.6 17.2" fill="none" stroke="rgba(133, 165, 198, 0.42)" strokeWidth="0.7" strokeLinecap="round" />
                <path d="M17.2 15.4L13.5 13.9" fill="none" stroke="rgba(127, 157, 191, 0.36)" strokeWidth="0.7" strokeLinecap="round" />
              </svg>
            </span>
          </span>
        </button>

        {/* Generate Button */}
        <div className="-mt-1 sm:-mt-1.5 z-10">
          <button
            onClick={onGenerate}
            className="relative w-[104px] h-[46px] sm:w-[116px] sm:h-[50px] overflow-visible rounded-[999px] group active:scale-[0.96] transition-transform duration-150"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.08) 100%)',
              backdropFilter: 'blur(18px) saturate(1.05)',
              WebkitBackdropFilter: 'blur(18px) saturate(1.05)',
              boxShadow: '0 16px 28px rgba(104, 132, 145, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -8px 18px rgba(126, 155, 169, 0.08)',
              animation: 'jade-pendant-float 5.6s ease-in-out infinite'
            }}
            aria-label="开启仪轨"
          >
            <span
              className="absolute -inset-3 rounded-[999px] pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(120, 176, 186, 0.16) 0%, rgba(207, 171, 104, 0.1) 42%, transparent 74%)',
                filter: 'blur(8px)',
                animation: 'seal-ink-ripple 3.8s ease-out infinite'
              }}
            />
            <div
              className="absolute inset-[3px] rounded-[999px] opacity-80"
              style={{
                border: '1px solid rgba(184, 213, 218, 0.32)',
                boxShadow: 'inset 0 0 0 1px rgba(255, 248, 238, 0.1)'
              }}
            />
            <div
              className="absolute inset-0 rounded-[999px] opacity-90"
              style={{
                background: 'radial-gradient(circle at 34% 24%, rgba(255, 255, 255, 0.3), transparent 24%), linear-gradient(180deg, rgba(162, 208, 214, 0.1), rgba(232, 196, 121, 0.08))'
              }}
            />
            {isMixing ? (
              <span
                className="absolute inset-0 flex items-center justify-center text-[12px] sm:text-[13px] font-semibold text-slate-700/88 animate-pulse"
                style={{ fontFamily: '"FZQingKeBenYueSongS-R-GB", "方正清刻本悦宋简体", "Songti SC", serif', letterSpacing: '0.14em' }}
              >
                仪轨中
              </span>
            ) : (
              <span
                className="relative z-10 flex h-full w-full items-center justify-center text-[15px] sm:text-[17px] font-semibold text-slate-700/92"
                style={{ fontFamily: '"FZQingKeBenYueSongS-R-GB", "方正清刻本悦宋简体", "Songti SC", serif', letterSpacing: '0.14em' }}
              >
                开启仪轨
              </span>
            )}
          </button>
        </div>


      </div>
    </div>
  );
};

// Intervention Modal (instead of full page)
const InterventionModal = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: 'rgba(15, 18, 22, 0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[22rem] sm:max-w-[24rem] rounded-[2.5rem] p-8 sm:p-10 animate-in fade-in zoom-in duration-500"
        style={{
          background: 'linear-gradient(165deg, rgba(255, 255, 255, 0.88), rgba(246, 248, 250, 0.82))',
          backdropFilter: 'blur(45px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(45px) saturate(1.3)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 背景装饰性烟云 */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[64px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(165, 212, 230, 0.22) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full blur-[64px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(235, 224, 206, 0.28) 0%, transparent 70%)' }}
        />
        <div className="flex flex-col items-center">
          {/* 精致胶囊型标签 */}
          <div
            className="inline-flex items-center justify-center px-3 py-1 rounded-full mb-6"
            style={{
              background: 'rgba(255,255,255,0.54)',
              border: '1px solid rgba(255,255,255,0.44)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)'
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                letterSpacing: '0.16em',
                fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                color: 'rgba(118, 98, 126, 0.92)',
                fontWeight: 700
              }}
            >
              仪轨指引
            </span>
          </div>
          <h2
            className="text-center mb-8 px-2"
            style={{
              fontSize: '1.25rem',
              fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
              fontWeight: 700,
              lineHeight: 1.8,
              color: '#1f2937',
              letterSpacing: '0.08em'
            }}
          >
            万般心绪，皆是过客。<br />此刻，愿以何种心境入杯？
          </h2>
          <div className="flex flex-col w-full gap-4">
            <button
              onClick={() => onSelectType('soothe')}
              className="group relative h-[58px] w-full rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, rgba(60,59,54,0.88) 0%, rgba(40,39,34,0.95) 100%)',
                boxShadow: '0 12px 24px rgba(60,54,40,0.20), inset 0 1px 0 rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <span className="relative z-10 font-bold tracking-[0.15em] text-[#f7f0e4]" style={{ fontFamily: '"STKaiti", "KaiTi", serif' }}>
                寻一抹宁静
              </span>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at center, white, transparent 70%)' }}
              />
            </button>

            <button
              onClick={() => onSelectType('vent')}
              className="group relative h-[58px] w-full rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(60,59,54,0.35)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <span className="relative z-10 font-bold tracking-[0.15em]" style={{ fontFamily: '"STKaiti", "KaiTi", serif', color: 'rgba(60,59,54,0.85)' }}>
                觅一处疏解
              </span>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'rgba(60,59,54,0.06)' }}
              />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

const FriendlyNoticeModal = ({ isOpen, title, message, tone = 'default', onClose }) => {
  if (!isOpen) return null;

  const toneStyles = {
    default: {
      accent: 'rgba(118, 98, 126, 0.92)',
      glow: 'rgba(137, 156, 196, 0.22)',
      border: 'rgba(140, 129, 158, 0.22)'
    },
    warning: {
      accent: 'rgba(147, 109, 72, 0.92)',
      glow: 'rgba(214, 184, 137, 0.24)',
      border: 'rgba(170, 134, 98, 0.24)'
    },
    error: {
      accent: 'rgba(143, 90, 84, 0.92)',
      glow: 'rgba(194, 136, 126, 0.22)',
      border: 'rgba(171, 110, 103, 0.24)'
    }
  };

  const currentTone = toneStyles[tone] || toneStyles.default;

  return (
    <Modal isOpen={isOpen} onClose={onClose} position="center" closeOnBackdrop>
      <div
        className="rounded-[2rem] p-6 sm:p-7 w-[calc(100vw-2rem)] max-w-[22rem] sm:max-w-[24rem] mx-auto"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(250,246,241,0.76))',
          backdropFilter: 'blur(38px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(38px) saturate(1.25)',
          border: `1px solid ${currentTone.border}`,
          boxShadow: `0 20px 48px rgba(70, 62, 74, 0.16), inset 0 1px 0 rgba(255,255,255,0.58), 0 0 0 1px rgba(255,255,255,0.16)`
        }}
      >
        <div
          className="absolute -top-12 -left-10 w-36 h-36 rounded-full blur-3xl pointer-events-none"
          style={{ background: currentTone.glow }}
        />
        <div
          className="absolute -bottom-10 -right-8 w-32 h-32 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(235, 223, 200, 0.28)' }}
        />

        <div className="relative">
          <div
            className="inline-flex items-center justify-center px-3 py-1 rounded-full mb-4"
            style={{
              background: 'rgba(255,255,255,0.54)',
              border: '1px solid rgba(255,255,255,0.44)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)'
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                letterSpacing: '0.16em',
                fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                color: currentTone.accent,
                fontWeight: 700
              }}
            >
              小提醒
            </span>
          </div>

          <h3
            style={{
              fontSize: '1.25rem',
              lineHeight: 1.4,
              color: '#2f2b29',
              fontWeight: 700,
              fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
              letterSpacing: '0.06em'
            }}
          >
            {title}
          </h3>
          <p
            style={{
              marginTop: '0.85rem',
              fontSize: '0.92rem',
              lineHeight: 1.85,
              color: 'rgba(43, 39, 36, 0.78)',
              fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
              letterSpacing: '0.04em'
            }}
          >
            {message}
          </p>

          <InteractiveButton
            variant="primary"
            fullWidth
            onClick={onClose}
            style={{
              marginTop: '1.5rem',
              height: '50px',
              background: currentTone.accent,
              color: '#f7f0e4',
              border: '1px solid rgba(66, 55, 60, 0.14)',
              boxShadow: '0 10px 24px rgba(86, 73, 80, 0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
              fontWeight: 600
            }}
          >
            知道了
          </InteractiveButton>
        </div>
      </div>
    </Modal>
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
    <div className="flex-1 flex flex-col overflow-hidden relative bg-dreamy-gradient h-screen">
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

      <div className="flex flex-col items-center pb-8 sm:pb-10 flex-none z-10">
        <div className="flex gap-2 sm:gap-2.5 mb-6 sm:mb-8">
          {drinks.map((_, i) => (
            <button
              key={i}
              onClick={() => onIndexChange(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'bg-gray-900 w-5 sm:w-6 shadow-sm' : 'bg-gray-300 w-1.5'}`}
            />
          ))}
        </div>
        <div className="flex items-center w-full px-4 sm:px-8 gap-2 sm:gap-3">
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
              height: '48px sm:52px',
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
      className={`flex-none px-2 sm:px-3 transition-all duration-500 transform ${isActive ? 'scale-100 opacity-100 z-10' : 'scale-[0.85] opacity-30 grayscale-[30%] z-0'
        }`}
      style={{ width: 'min(70vw, 340px) sm:min(75vw, 400px)' }}
    >
      <div className="relative aspect-[3/4.5] rounded-2xl sm:rounded-[2.8rem] overflow-hidden shadow-[0_25px_60px_-12px_rgba(0,0,0,0.22)] bg-white border border-black/[0.02]">
        <img src={drink.image} className="w-full h-full object-cover" alt={drink.name} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/85" />

        <div className="absolute top-4 sm:top-6 left-4 sm:left-6">
          <div
            className="bg-white/10 backdrop-blur-md border border-white/20 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 text-white/90 text-[10px] sm:text-[11px] font-bold tracking-wide"
            style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
          >
            <BriefIcon size={14} className="opacity-80 text-blue-300" />
            {drink.abv > 0 ? `微醺 | ABV ${drink.abv}%` : '无酒精'}
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 sm:pb-10 px-4 sm:px-6 text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 tracking-tight leading-none drop-shadow-md"
            style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif', letterSpacing: '0.05em' }}
          >
            {drink.name_cn || translateDrinkName(drink.name) || drink.name}
          </h2>

          {/* Philosophy Tags & Quote */}
          <div className="mb-4 sm:mb-6 flex flex-col items-center w-full px-1 sm:px-2">
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              {philosophy.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 sm:px-2.5 py-[2px] sm:py-[3px] rounded bg-white/10 text-white/90 border border-white/20 text-[9px] sm:text-[10px] tracking-widest mix-blend-screen"
                  style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif', fontWeight: 500 }}
                >
                  {tag}
                </span>
              ))}
            </div>
            {/* 渐变替换容器: 本地原始语录居中打底，一旦有大模型定制语录，通过 CSS opacity 平滑交叉过渡 */}
            <div className="relative w-full flex justify-center min-h-[36px] sm:min-h-[40px]">
              <p
                className={`absolute text-[11px] sm:text-[12px] text-white/70 font-light italic opacity-90 leading-relaxed max-w-[180px] sm:max-w-[220px] transition-opacity duration-1000 ${customQuote ? 'opacity-0' : 'opacity-100'}`}
                style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
              >
                {philosophy.quote}
              </p>
              <p
                className={`absolute text-[11px] sm:text-[12px] font-medium italic leading-relaxed max-w-[180px] sm:max-w-[220px] transition-opacity duration-1000 ${customQuote ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                  color: '#E0E7FF',
                  textShadow: '0 0 10px rgba(167, 139, 250, 0.4)'
                }}>
                {customQuote || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8">
            {drink.briefIngredients.map((ing, bIdx) => {
              const IconComponent = iconMap[ing.icon];
              return (
                <div key={bIdx} className="flex flex-col items-center gap-1 sm:gap-1.5">
                  <div className="text-white/90">
                    <IconComponent size={20} strokeWidth={2.5} />
                  </div>
                  <span
                    className="text-[10px] sm:text-[11px] font-medium text-white/60 tracking-[0.1em] leading-none"
                    style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
                  >
                    {translateIngredient(ing.label)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between w-full px-2 sm:px-3 gap-2 sm:gap-3">
            <InteractiveButton
              variant="icon"
              size="icon"
              style={{
                width: '40px sm:44px',
                height: '40px sm:44px',
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
                width: '40px sm:44px',
                height: '40px sm:44px',
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
  onNavigate,
  activeTab,
  onAddCustomDrink,
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
    <div className="flex-1 flex flex-col bg-dreamy-gradient max-w-4xl mx-auto w-full min-h-[100svh] overflow-x-hidden overflow-y-auto relative pb-24">
      <header className="sticky top-0 z-40 px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-2 bg-dreamy-gradient/80 backdrop-blur-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 relative group">
              <div
                className="flex items-center w-full h-12 rounded-2xl px-4 border border-white/40 bg-white/30 backdrop-blur-xl shadow-sm transition-all 
                           focus-within:bg-white/50 focus-within:border-white/60 focus-within:shadow-md"
              >
                <Search className="text-gray-400/80 mr-2" size={18} />

                <input
                  className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-[15.5px] placeholder:text-gray-400/60 font-medium py-0 leading-none h-full outline-none text-gray-800"
                  style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif', letterSpacing: '0.02em' }}
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
              style={{ ...cardFeedback, background: 'rgba(224, 231, 255, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}
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

              // 配色方案: 东方矿物色系 (舒缓、低饱和度)
              let bgActive, bgInactive, colorActive, colorInactive, shadow, border;
              if (isAll) {
                bgActive = '#3c3b36'; // 焦茶
                bgInactive = 'rgba(255, 255, 255, 0.6)';
                colorActive = '#f7f0e4';
                colorInactive = '#3c3b36';
                shadow = isActive ? '0 8px 24px rgba(60, 59, 54, 0.18)' : 'none';
                border = isActive ? 'none' : '1px solid rgba(60, 59, 54, 0.12)';
              } else if (isAlcohol) {
                bgActive = 'linear-gradient(135deg, #8b4513 0%, #a0522d 100%)'; // 赭石
                bgInactive = 'rgba(255, 255, 255, 0.5)';
                colorActive = '#f7f0e4';
                colorInactive = '#8b4513';
                shadow = isActive ? '0 8px 24px rgba(139, 69, 19, 0.15)' : 'none';
                border = isActive ? 'none' : '1px solid rgba(139, 69, 19, 0.12)';
              } else {
                bgActive = 'linear-gradient(135deg, #4f7942 0%, #3d5229 100%)'; // 竹青/石绿
                bgInactive = 'rgba(255, 255, 255, 0.5)';
                colorActive = '#f7f0e4';
                colorInactive = '#4f7942';
                shadow = isActive ? '0 8px 24px rgba(79, 121, 66, 0.15)' : 'none';
                border = isActive ? 'none' : '1px solid rgba(79, 121, 66, 0.12)';
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
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    fontSize: '0.85rem',
                    fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                    letterSpacing: '0.05em'
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
            {apiDrinks.map((drink) => (
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
                  borderRadius: '20px sm:24px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                  minWidth: 0,
                  cursor: 'pointer'
                }}
              >
                <div className="p-2 sm:p-3 pb-0">
                  <div
                    className="relative aspect-[4/5] bg-cover bg-center rounded-xl sm:rounded-2xl overflow-hidden shadow-inner"
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
                      className="absolute top-2 right-2 w-7 sm:w-8 h-7 sm:h-8 bg-black/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Heart
                        size={14}
                        className={`transition-all duration-200 ${favoriteDrinks.some(d => d.id === drink.id) ? 'text-[#FF7675] fill-current' : 'text-white'}`}
                      />
                    </button>
                  </div>
                </div>
                <div className="px-3 sm:px-4 py-2 sm:py-3">
                  <h3
                    className="font-bold text-sm sm:text-[15px] text-gray-800 leading-tight mb-0.5 sm:mb-1"
                    style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
                  >
                    {drink.name_cn || translateDrinkName(drink.name) || drink.name}
                  </h3>
                  <p
                    className="text-[11px] sm:text-[12px] text-gray-400 leading-tight line-clamp-1 font-medium italic"
                    style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
                  >
                    {drink.nameEn || drink.sub || drink.subName || ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

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




const HeartIcon = ({ isLiked }) => (
  <Heart
    size={20}
    className={`transition-all duration-200 ${isLiked ? 'fill-current text-[#FF7675]' : 'text-gray-500'}`}
  />
);

const BulbIcon = ({ isDaka }) => (
  <Lightbulb
    size={20}
    className={`transition-all duration-200 ${isDaka ? 'fill-current text-yellow-400' : 'text-gray-500'}`}
  />
);

const DrinkDetailSection = ({ drink, checkedIngredients, onToggleIngredient, onBack, onMore, onFocusMode, currentStep, cardFeedback, isLiked, onLikeDrink, isDaka, onDakaDrink, onHelp }) => {
  if (!drink) return null;

  const drinkIngredients = drink.ingredients || [];
  const drinkSteps = drink.steps || [{ title: '第一步', desc: drink.reason || '开始享用' }];

  // 辅助函数：将数字索引转为中文步骤名
  const getChineseStep = (idx) => {
    const map = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return `第${map[idx] || (idx + 1)}步`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F6F2] h-screen overflow-y-auto pb-32">
      {/* 顶部浸入式图片区域 */}
      <div className="relative h-[42vh] w-full overflow-hidden ink-wash-mask">
        <img
          src={drink.image}
          className="w-full h-full object-cover transition-transform duration-[2s] hover:scale-110"
          alt={drink.name}
        />
        {/* 图片底部水墨融合渐变 */}
        <div className="drink-hero-mask-layer" />

        {/* 悬浮操作按钮 */}
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] inset-x-0 px-6 flex justify-between z-20">
          <InteractiveButton
            variant="icon"
            onClick={onBack}
            className="group"
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              width: '42px',
              height: '42px'
            }}
          >
            <ChevronLeft size={22} className="text-white group-active:scale-90 transition-transform" />
          </InteractiveButton>
          <InteractiveButton
            variant="icon"
            onClick={() => onHelp && onHelp(drink)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              width: '42px',
              height: '42px'
            }}
          >
            <HelpCircle size={22} className="text-white" />
          </InteractiveButton>
        </div>
      </div>

      {/* 极简详情内容容器 */}
      <div className="relative -mt-16 detail-glass-container px-7 pt-9 pb-12 max-w-2xl mx-auto">
        {/* 标题标题区域 */}
        <div className="mb-9">
          <div className="flex flex-wrap items-baseline gap-3 mb-4">
            <h1 className="text-[2.25rem] oriental-title-large">
              {drink.name_cn || translateDrinkName(drink.name) || drink.name}
            </h1>
            {drink.nameEn && drink.nameEn !== drink.name && (
              <span className="text-[14px] text-gray-400 font-serif italic tracking-wider opacity-60">
                / {drink.nameEn}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {drink.abv > 0 && (
              <div
                className="px-3.5 py-1.5 rounded-full flex items-center gap-1.5"
                style={{ background: 'rgba(59, 130, 246, 0.08)', border: '0.5px solid rgba(59, 130, 246, 0.15)' }}
              >
                <Martini size={14} className="text-blue-500/80" />
                <span className="text-[11px] font-bold text-blue-600/90 tracking-widest">ABV {drink.abv}%</span>
              </div>
            )}
            {drink.tags?.map((tag, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 bg-gray-50/80 rounded-full text-[11px] font-bold text-gray-500/80 tracking-widest border border-gray-100"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* 辨证短语/描述 */}
        {drink.reason && (
          <div className="mb-10 relative">
            <div className="absolute -left-3 top-0 bottom-0 w-[2px] bg-gradient-to-b from-gray-200 via-gray-100 to-transparent" />
            <p
              className="text-[15px] text-gray-600 leading-[1.8] font-serif pl-3 italic opacity-90"
              style={{ fontFamily: '"FZYouSong", "方正悠宋", "Songti SC", serif' }}
            >
              {drink.reason}
            </p>
          </div>
        )}

        {/* 原料清单部分 */}
        <div className="mb-12">
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-[18px] font-bold text-gray-900 tracking-[0.1em]" style={{ fontFamily: '"Songti SC", serif' }}>原料清单</h3>
            <span className="text-[11px] text-gray-400 bg-gray-50/80 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <Users size={12} /> 一人份量
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {drinkIngredients.map(ing => {
              const IngredientIcon = iconMap[ing.icon] || Wine;
              const isChecked = checkedIngredients[ing.id];

              return (
                <div
                  key={ing.id}
                  className={`flex items-center justify-between p-4 rounded-[1.25rem] transition-all duration-500 soft-ingredient-pill ${isChecked ? 'is-checked scale-[0.98]' : ''}`}
                  onClick={() => onToggleIngredient(ing.id)}
                  style={cardFeedback}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-blue-500/80 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                      <IngredientIcon size={20} strokeWidth={1.5} />
                    </div>
                    <span
                      className="text-[16px] font-bold text-gray-800"
                      style={{ fontFamily: '"Songti SC", "STKaiti", serif' }}
                    >
                      {translateIngredient(ing.name)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[17px] font-extrabold text-gray-900 font-serif">{ing.amount}</span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter -mt-1">{ing.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 制作步骤部分 */}
        <div className="mb-16">
          <h3 className="text-[18px] font-bold text-gray-900 mb-8 tracking-[0.1em]" style={{ fontFamily: '"Songti SC", serif' }}>制作步骤</h3>
          <div className="relative">
            {drinkSteps.map((step, idx) => (
              <div key={idx} className="flex gap-7 pb-10 group last:pb-2">
                {drinkSteps.length > 1 && (
                  <div className="relative flex flex-col items-center flex-none">
                    <div className="method-step-ink-point" />
                    {idx !== drinkSteps.length - 1 && (
                      <div className="method-line-vertical" />
                    )}
                  </div>
                )}
                <div className="flex-1 -mt-1 pt-0.5">
                  {drinkSteps.length > 1 && (
                    <h4
                      className="text-[15px] font-black text-gray-900 mb-2 tracking-wider"
                      style={{ fontFamily: '"Songti SC", "STKaiti", serif' }}
                    >
                      {getChineseStep(idx)}
                    </h4>
                  )}
                  <p className="text-[14px] text-gray-500 leading-[1.75] font-medium opacity-85">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部占位空白，确保滚动到底时内容高于悬浮操作栏 */}
        <div className="h-4" />
      </div>

      {/* 底部悬浮操作栏 */}
      <div className="fixed bottom-[env(safe-area-inset-bottom,1.5rem)] inset-x-0 px-5 z-[60] flex justify-center pointer-events-none">
        <div className="floating-action-bar p-3.5 flex gap-3 pointer-events-auto">
          <InteractiveButton
            variant="secondary"
            fullWidth
            onClick={() => onLikeDrink(drink)}
            className="flex-1 jade-action-btn flex items-center justify-center h-[56px]"
          >
            <HeartIcon isLiked={isLiked} />
            <span className="ml-2.5">心仪</span>
          </InteractiveButton>
          <div className="w-px h-8 bg-gray-200/50 self-center" />
          <InteractiveButton
            variant="secondary"
            fullWidth
            onClick={() => onDakaDrink(drink)}
            className="flex-1 jade-action-btn flex items-center justify-center h-[56px]"
          >
            <BulbIcon isDaka={isDaka} />
            <span className="ml-2.5">记禅</span>
          </InteractiveButton>
        </div>
      </div>
    </div>
  );
};




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
  const [validationResult, setValidationResult] = useState(null);
  const [dakaDrinks, setDakaDrinks] = useState([]);
  const [showDakaModal, setShowDakaModal] = useState(false);
  const [dakaDrink, setDakaDrink] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [showCustomDrinkModal, setShowCustomDrinkModal] = useState(false);
  const [customDrinks, setCustomDrinks] = useState([]);
  const [showDrinkHelpModal, setShowDrinkHelpModal] = useState(false);
  const [drinkHelpTarget, setDrinkHelpTarget] = useState(null);
  const [friendlyNotice, setFriendlyNotice] = useState({
    isOpen: false,
    title: '',
    message: '',
    tone: 'default'
  });

  // Track if session ingredients have been initialized from inventory
  const isSessionInitialized = useRef(false);

  const showFriendlyNotice = useCallback((title, message, tone = 'default') => {
    setFriendlyNotice({
      isOpen: true,
      title,
      message,
      tone
    });
  }, []);

  const closeFriendlyNotice = useCallback(() => {
    setFriendlyNotice(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleOpenDakaModal = (drink) => {
    setDakaDrink(drink);
    setShowDakaModal(true);
  };

  const handleCloseDakaModal = () => {
    setDakaDrink(null);
    setShowDakaModal(false);
  };

  const handleSaveDakaNote = (drinkId, note, customImage = null) => {
    const drinkToSave = dakaDrink;
    if (drinkToSave) {
      collectionStorage.saveDakaNote(drinkToSave, note, customImage);
      // Refresh daka drinks from storage
      const updatedDakaDrinks = collectionStorage.getDakaNotes();
      setDakaDrinks(updatedDakaDrinks);
    }
    handleCloseDakaModal();
  };

  const handleRequestDeleteNote = (drinkId) => {
    setDeletingNoteId(drinkId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteNote = () => {
    if (deletingNoteId) {
      collectionStorage.removeDakaNote(deletingNoteId);
      const updatedDakaDrinks = collectionStorage.getDakaNotes();
      setDakaDrinks(updatedDakaDrinks);
    }
    setShowDeleteConfirm(false);
    setDeletingNoteId(null);
  };

  const handleCancelDeleteNote = () => {
    setShowDeleteConfirm(false);
    setDeletingNoteId(null);
  };

  // ─── 自定义饮品管理 ───
  const handleOpenCustomDrinkModal = () => {
    setShowCustomDrinkModal(true);
  };

  const handleCloseCustomDrinkModal = () => {
    setShowCustomDrinkModal(false);
  };

  const handleSaveCustomDrink = (savedDrink) => {
    // 刷新自定义饮品列表
    const updatedDrinks = customDrinkStorage.getCustomDrinks();
    setCustomDrinks(updatedDrinks);
    console.log('✨ 自定义饮品已保存:', savedDrink.name);
  };

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

  // Sync session ingredients with inventory ONLY ONCE at start
  useEffect(() => {
    // Only initialize if not yet done OR if inventory empty but just loaded
    const hasInventory = (userInventory.standard?.length || 0) + (userInventory.custom?.length || 0) > 0;

    if (hasInventory && !isSessionInitialized.current) {
      const list = [
        ...(userInventory.standard || []).filter(i => i.in_stock).map(i => i.name_cn || i.name),
        ...(userInventory.custom || []).filter(i => i.in_stock).map(i => i.name_cn || i.name)
      ].filter(Boolean);

      const uniqueList = [...new Set(list)];
      if (uniqueList.length > 0) {
        setSessionIngredients(uniqueList);
        isSessionInitialized.current = true;
      }
    }
  }, [userInventory]);


  // 计算原料总数 (按名称去重，确保与原料斋房一致)
  const ingredientCount = useMemo(() => {
    const list = [
      ...(userInventory.standard || []).filter(i => i.in_stock).map(i => i.name_cn || i.name),
      ...(userInventory.custom || []).filter(i => i.in_stock).map(i => i.name_cn || i.name)
    ].filter(Boolean);
    return new Set(list).size;
  }, [userInventory]);

  // Fetch favorites on mount (using LocalStorage)
  useEffect(() => {
    const loadFavorites = () => {
      try {
        const favorites = favoriteStorage.getFavorites();
        // 确保收藏数据包含必要的字段
        const validFavorites = favorites.filter(f => f && f.id).map(f => ({
          id: f.id,
          name: f.name || '',
          nameEn: f.nameEn || '',
          image: f.image || '',
          abv: f.abv || 0,
          ingredients: f.ingredients || [],
          tags: f.tags || [],
          dimensions: f.dimensions || {},
          favoritedAt: f.favoritedAt
        }));
        setFavoriteDrinks(validFavorites);
      } catch (error) {
        console.error("Failed to load favorites", error);
      }
    };
    loadFavorites();

    const loadDakaNotes = () => {
      try {
        const notes = collectionStorage.getDakaNotes();
        setDakaDrinks(notes);
      } catch (error) {
        console.error("Failed to load daka notes", error);
      }
    };
    loadDakaNotes();

    // 加载自定义饮品
    const loadCustomDrinks = () => {
      try {
        const drinks = customDrinkStorage.getCustomDrinks();
        setCustomDrinks(drinks);
      } catch (error) {
        console.error("Failed to load custom drinks", error);
      }
    };
    loadCustomDrinks();
  }, []);

  const handleLikeDrink = useCallback((drink) => {
    setFavoriteDrinks(prev => {
      if (prev.some(d => d.id === drink.id)) return prev;
      return [...prev, drink];
    });
    // 存储完整的饮品数据
    favoriteStorage.addFavorite(drink);
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

  // 当切换到 'mine' 标签页时重新加载库存数据
  useEffect(() => {
    if (activeTab === 'mine') {
      fetchInventory();
    }
  }, [activeTab, fetchInventory]);

  const visibleDrinks = useMemo(() => {
    if (recommendationPool.length === 0) return [];
    const poolSize = recommendationPool.length;
    const startIndex = (currentBatchIndex * 3) % Math.max(1, poolSize - 2);
    let batch = [];
    for (let i = 0; i < 3; i++) {
      batch.push(recommendationPool[(startIndex + i) % poolSize]);
    }
    return batch;
  }, [recommendationPool, currentBatchIndex]);

  const handleShuffle = useCallback(() => {
    if (recommendationPool.length <= 3) {
      const randomIdx = Math.floor(Math.random() * Math.max(1, recommendationPool.length));
      setCurrentBatchIndex(randomIdx);
    } else {
      const randomOffset = Math.floor(Math.random() * Math.max(1, recommendationPool.length - 2));
      setCurrentBatchIndex(randomOffset);
    }
  }, [recommendationPool]);
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

  const [buttonLoadingText, setButtonLoadingText] = useState('静心感受中…');

  const handleStartGeneration = useCallback(async (type = null) => {
    const startTime = performance.now();
    console.log(`[Timer] 0ms: 用户点击按钮，开始开启仪轨流程`);
    setMixMode('generating');
    setButtonLoadingText('正在寻杯…');

    // 记录干预类型
    if (type) {
      setInterventionType(type);
    }

    const currentInterventionType = type || interventionType;
    const combinedInput = (moodInput + (selectedMood || "")).trim();

    // 构造带有干预类型的输入
    let finalInputForAI = combinedInput || '心情不太好';
    if (currentInterventionType === 'soothe') {
      finalInputForAI += ' (用户选择: 温柔治愈，需要安抚、温暖、低度、甘甜的饮品)';
    } else if (currentInterventionType === 'vent') {
      finalInputForAI += ' (用户选择: 发泄释放，需要刺激、冰冷、烈酒、酸苦的饮品)';
    }

    if (sessionIngredients.length > 0) {
      finalInputForAI += `\n(重要参考: 用户目前拥有的原料: ${sessionIngredients.join(', ')})`;
    }

    const longWaitTimer = setTimeout(() => {
      setButtonLoadingText('好饮不急，稍候片刻…');
    }, 10000);

    try {
      // 检查饮品数据是否已加载
      if (!apiDrinks || apiDrinks.length === 0) {
        clearTimeout(longWaitTimer);
        setMixMode('home');
        showFriendlyNotice('酒柜还在整理', '饮品数据尚未准备好，稍候片刻再开启仪轨。', 'warning');
        return;
      }

      console.log(`\n🎯 负面情绪干预模式: ${currentInterventionType === 'vent' ? '💥 发泄释放' : '🥰 温柔安抚'}`);

      // 🚀 使用多Agent系统执行推荐流程
      // 合并API饮品和用户自定义饮品（只包含有向量的）
      const customDrinksWithVector = customDrinks.filter(d => d.vector && d.vector.length === 8);
      const allDrinksForPipeline = [...apiDrinks, ...customDrinksWithVector];

      const agentPromise = executeRecommendationPipeline(finalInputForAI, {
        inventory: sessionIngredients,
        allDrinks: allDrinksForPipeline,
        currentTime: new Date().toISOString(),
        interventionType: currentInterventionType,
        // 🔥 [优化] 提前并行触发文案生成
        onVectorSearchSuccess: (matches, contextData) => {
          console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 触发提前并行文案生成`);
          // 异步执行，不等待回调
          fetchLiveQuotes(matches, contextData, 15).then((quotesMap) => {
            if (Object.keys(quotesMap).length > 0) {
              setCustomQuotes(prev => ({ ...prev, ...quotesMap }));
              console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 提前触发的异步文案完成`);
            }
          }).catch(err => console.warn('Early live quote generation failed', err));
        }
      });

      const agentResult = await agentPromise;

      console.log('多Agent系统执行结果:', agentResult);
      clearTimeout(longWaitTimer);

      // 获取匹配结果并展示画廊
      const matches = agentResult.context.getIntermediate('matches') || [];
      const moodData = agentResult.context.getIntermediate('moodData');
      const patternAnalysis = agentResult.context.getIntermediate('patternAnalysis');
      const validation = agentResult.context.getIntermediate('validationReport');

      // 检查是否需要阻断
      if (validation?.shouldBlock) {
        setMixMode('home');
        setValidationResult(validation);
        showFriendlyNotice('换一种说法试试', validation.userMessage || '此刻的心境需要换一种表达方式。', 'warning');
        return;
      }

      // 转换为原有格式
      const pool = matches.map(m => ({
        ...m.drink,
        similarity: m.similarity,
        matchDetails: m.matchDetails
      }));

      // 合并 moodData 和 patternAnalysis 传递给组件
      const contextData = { moodData, patternAnalysis };
      setMoodResult(contextData);
      setValidationResult(validation);
      setRecommendationPool(pool.length > 0 ? pool : (apiDrinks.length > 0 ? apiDrinks.slice(0, 9) : []));
      setCurrentBatchIndex(0);
      setCurrentCardIndex(0);
      setMixMode('home');
      setShowRecommendationGallery(true);

      console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: handleStartGeneration 流程准备就绪`);

    } catch (error) {
      console.error('分析/推荐出错:', error);
      console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 流程出错中断`);
      clearTimeout(longWaitTimer);
      setMixMode('home');
      showFriendlyNotice('灵感有些迟疑', '分析网络可能存在波动，请稍后再试。', 'error');
    }
  }, [emotionType, interventionType, moodInput, selectedMood, sessionIngredients, apiDrinks, customDrinks, setRecommendationPool, setCurrentBatchIndex, setCurrentCardIndex, setMixMode, setShowRecommendationGallery, setCustomQuotes, showFriendlyNotice]);

  // 调用后端千问API进行情绪分析和饮品推荐
  const processMoodAndGenerate = useCallback(async () => {
    const combinedInput = (moodInput + (selectedMood || "")).trim();

    // 空输入检查 - 用户什么都没输入也没选标签
    if (!combinedInput) {
      showFriendlyNotice('还没听见你的心绪', '心里装着什么？说与我听，我为你寻一杯。', 'default');
      return;
    }

    // 如果有自定义原料，附加到 Prompt
    let finalInputForAI = combinedInput;
    if (sessionIngredients.length > 0) {
      finalInputForAI += `\n(重要参考: 用户目前拥有的原料: ${sessionIngredients.join(', ')})`;
    }

    // 首先检查是否为负面情绪（本地快速检测）
    const isNegativeLocal = NEGATIVE_KEYWORDS.some(kw => combinedInput.toLowerCase().includes(kw)) || selectedMood === '#难受';

    if (isNegativeLocal) {
      // 负面情绪：尝试自动检测用户意图
      setEmotionType('negative');

      const autoIntent = detectNegativeIntent(combinedInput);

      if (autoIntent) {
        // 自动检测到明确意图，直接开始生成
        console.log(`🎯 自动检测到用户意图: ${autoIntent === 'vent' ? '发泄释放' : '温柔安抚'}`);
        setInterventionType(autoIntent);
        handleStartGeneration(autoIntent);
      } else {
        // 无法自动判断，显示弹窗询问用户
        setShowInterventionModal(true);
      }
      return;
    }

    // 非负面情绪：设置情绪类型
    setEmotionType('positive');

    // 播放动画并设定文案
    const startTime = performance.now();
    console.log(`[Timer] 0ms: 用户提交情绪，开始处理流程`);
    setMixMode('generating');
    setButtonLoadingText('心与味，正在相遇…');

    // 动态文字：10秒后如果还在等待，则安抚用户
    const longWaitTimer = setTimeout(() => {
      setButtonLoadingText('好饮不急，稍候片刻…');
    }, 10000);

    try {
      // 检查饮品数据是否已加载
      if (!apiDrinks || apiDrinks.length === 0) {
        clearTimeout(longWaitTimer);
        setMixMode('home');
        showFriendlyNotice('酒柜还在整理', '饮品数据尚未准备好，稍候片刻再开启仪轨。', 'warning');
        return;
      }

      // 🚀 使用多Agent系统执行推荐流程
      // 合并API饮品和用户自定义饮品（只包含有向量的）
      const customDrinksWithVector = customDrinks.filter(d => d.vector && d.vector.length === 8);
      const allDrinksForPipeline = [...apiDrinks, ...customDrinksWithVector];

      const agentPromise = executeRecommendationPipeline(finalInputForAI, {
        inventory: sessionIngredients,
        allDrinks: allDrinksForPipeline,
        currentTime: new Date().toISOString(),
        // 🔥 [优化] 提前并行触发文案生成
        onVectorSearchSuccess: (matches, contextData) => {
          console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 触发提前并行文案生成 (正向)`);
          fetchLiveQuotes(matches, contextData, 15).then((quotesMap) => {
            if (Object.keys(quotesMap).length > 0) {
              setCustomQuotes(prev => ({ ...prev, ...quotesMap }));
            }
          }).catch(err => console.warn('Early live quote generation failed', err));
        }
      });

      const agentResult = await agentPromise;

      console.log('多Agent系统执行结果:', agentResult);
      clearTimeout(longWaitTimer);

      // 检查Agent 1的验证错误（需要用户重新输入）
      const agent1Output = agentResult.context.getOutput('SemanticDistiller');
      if (agent1Output && !agent1Output.success && agent1Output.requiresReinput) {
        clearTimeout(longWaitTimer);
        setMixMode('home');
        showFriendlyNotice('这句话还差一点', agent1Output.userMessage || '输入格式不正确，请重新输入。', 'warning');
        return;
      }

      // 提取推荐结果
      const recommendation = extractRecommendationResult(agentResult.context);
      console.log('推荐结果:', recommendation);

      // 检查是否为极度负面需要关怀
      const moodData = agentResult.context.getIntermediate('moodData');
      if (moodData?.isNegative) {
        setEmotionType('negative');

        // 尝试使用 LLM 返回的 negativeIntent，否则本地检测
        const llmIntent = moodData.negativeIntent;
        const localIntent = detectNegativeIntent(combinedInput);
        const finalIntent = (llmIntent && llmIntent !== 'unclear') ? llmIntent : localIntent;

        if (finalIntent) {
          console.log(`🎯 自动检测到用户意图: ${finalIntent === 'vent' ? '发泄释放' : '温柔安抚'} (LLM: ${llmIntent}, 本地: ${localIntent})`);
          setInterventionType(finalIntent);
          clearTimeout(longWaitTimer);
          setMixMode('home');
          handleStartGeneration(finalIntent);
        } else {
          // 无法自动判断，显示弹窗询问用户
          clearTimeout(longWaitTimer);
          setMixMode('home');
          setShowInterventionModal(true);
        }
        return;
      }

      // 获取匹配结果
      const matches = agentResult.context.getIntermediate('matches') || [];
      const patternAnalysis = agentResult.context.getIntermediate('patternAnalysis');
      const validation = agentResult.context.getIntermediate('validationReport');

      // 检查是否需要阻断
      if (validation?.shouldBlock) {
        setMixMode('home');
        setValidationResult(validation);
        showFriendlyNotice('换一种说法试试', validation.userMessage || '此刻的心境需要换一种表达方式。', 'warning');
        return;
      }

      // 转换为原有格式
      const pool = matches.map(m => ({
        ...m.drink,
        similarity: m.similarity,
        matchDetails: m.matchDetails
      }));

      // 合并 moodData 和 patternAnalysis 传递给组件
      const contextData = { moodData, patternAnalysis };
      setMoodResult(contextData);
      setValidationResult(validation);
      setRecommendationPool(pool);
      setCurrentBatchIndex(0);
      setCurrentCardIndex(0);
      setMixMode('home');
      setShowRecommendationGallery(true);
      console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 结果渲染准备就绪，展示画廊`);

      // ✅ 非阻塞流式异步大模型文案润色
      if (pool.length > 0) {
        console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 启动异步文案润色 (非阻塞)`);
        fetchLiveQuotes(pool, contextData, 15).then((quotesMap) => {
          if (Object.keys(quotesMap).length > 0) {
            setCustomQuotes(prev => ({ ...prev, ...quotesMap }));
            console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 异步文案润色完成`);
          }
        }).catch(err => {
          console.warn('Live quote generation failed non-fatally', err);
        });
      }

    } catch (error) {
      console.error('分析/推荐出错:', error);
      console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 流程出错中断`);
      clearTimeout(longWaitTimer);
      setMixMode('home');
      showFriendlyNotice('灵感有些迟疑', '分析网络可能存在波动，请稍后再试。', 'error');
    }
  }, [moodInput, selectedMood, sessionIngredients, apiDrinks, customDrinks, showFriendlyNotice]);

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
        {activeTab === 'mix' && showRecommendationGallery && visibleDrinks.length > 0 && (
          <RecommendationGallery
            drinks={visibleDrinks}
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
            validation={validationResult}
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
                ingredientCount={sessionIngredients.length}
                onEditIngredients={() => setShowIngredientModal(true)}
                onNavigate={handleNavClick}
                activeTab={activeTab}
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
              onNavigate={handleNavClick}
              activeTab={activeTab}
              onAddCustomDrink={handleOpenCustomDrinkModal}
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
              onNavigate={handleNavClick}
              activeTab={activeTab}
              dakaNotes={dakaDrinks}
              onDeleteDakaNote={handleRequestDeleteNote}
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
              onLikeDrink={(drink) => {
                if (favoriteDrinks.some(d => d.id === drink.id)) {
                  handleUnlikeDrink(drink.id);
                } else {
                  handleLikeDrink(drink);
                }
              }}
              isDaka={dakaDrinks.some(d => d.id === currentDrink?.id)}
              onDakaDrink={handleOpenDakaModal}
              onHelp={(drink) => {
                setDrinkHelpTarget(drink);
                setShowDrinkHelpModal(true);
              }}
            />
          </PageTransition>
        )}
      </main>

      {!currentDrink && !isFocusMode && (
        <NavigationBar activeTab={activeTab} onTabChange={handleNavClick} />
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

      {showDakaModal && (
        <DakaModal
          drink={dakaDrink}
          onClose={handleCloseDakaModal}
          onSave={handleSaveDakaNote}
        />
      )}

      {/* Custom Drink Modal */}
      <CustomDrinkModal
        isOpen={showCustomDrinkModal}
        onClose={handleCloseCustomDrinkModal}
        onSave={handleSaveCustomDrink}
      />

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

      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={handleCancelDeleteNote}
        onConfirm={handleConfirmDeleteNote}
      />

      {/* Drink Help Modal */}
      {showDrinkHelpModal && (
        <DrinkHelpModal
          drink={drinkHelpTarget}
          onClose={() => {
            setShowDrinkHelpModal(false);
            setDrinkHelpTarget(null);
          }}
        />
      )}

      <FriendlyNoticeModal
        isOpen={friendlyNotice.isOpen}
        title={friendlyNotice.title}
        message={friendlyNotice.message}
        tone={friendlyNotice.tone}
        onClose={closeFriendlyNotice}
      />
    </div>
  );
};



const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} position="center">
      <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(40px) saturate(1.2)', WebkitBackdropFilter: 'blur(40px) saturate(1.2)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2)' }} className="rounded-2xl p-6 w-full max-w-sm mx-auto">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: '"Songti SC",serif', color: 'rgba(255,255,255,0.95)', letterSpacing: '0.1em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>确认删除</h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '1.5rem', fontSize: '0.875rem', fontFamily: '"Songti SC",serif' }}>确定要删除这条赏味记录吗？此操作无法撤销。</p>
        <div className="flex justify-end space-x-3">
          <InteractiveButton variant="text" onClick={onClose}>
            取消
          </InteractiveButton>
          <InteractiveButton
            variant="primary"
            onClick={onConfirm}
            style={{ backgroundColor: '#EF4444', color: 'white' }}
          >
            确认删除
          </InteractiveButton>
        </div>
      </div>
    </Modal>
  );
};

const DakaModal = ({ drink, onClose, onSave }) => {
  const [note, setNote] = useState('');
  const [customImage, setCustomImage] = useState('');
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomImage(event.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setCustomImage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!drink) return null;

  return (
    <Modal isOpen={true} onClose={onClose} position="center">
      <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(40px) saturate(1.2)', WebkitBackdropFilter: 'blur(40px) saturate(1.2)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2)' }} className="rounded-2xl p-6 w-full max-w-sm mx-auto">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', fontFamily: '"Songti SC",serif', color: 'rgba(255,255,255,0.95)', letterSpacing: '0.1em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>为 {drink.name} 打卡</h2>

        {/* 可选图片上传 */}
        <div
          className="relative w-full h-28 rounded-xl mb-4 overflow-hidden cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          {customImage ? (
            <>
              <img src={customImage} alt="打卡照片" className="w-full h-full object-cover" />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${drink.image})`, filter: 'brightness(0.7)' }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                <Camera size={24} className="text-white/80 mb-1" />
                <span className="text-white/80 text-xs">记录此刻 (可选)</span>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '0.5rem', fontSize: '0.875rem', fontFamily: '"Songti SC",serif' }}>记录下此刻的口味、心情或任何想法…</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="oriental-textarea"
          style={{ height: '6rem', marginBottom: '1rem' }}
          placeholder="例如：口感非常清爽，柠檬的酸味很突出…"
        />
        <div className="flex justify-end space-x-3">
          <InteractiveButton variant="text" onClick={onClose}>
            取消
          </InteractiveButton>
          <InteractiveButton
            variant="primary"
            onClick={() => onSave(drink.id, note, customImage || null)}
            style={{ background: 'linear-gradient(135deg, rgba(148,120,72,0.8) 0%, rgba(128,108,72,0.75) 40%, rgba(108,124,112,0.7) 100%)' }}
          >
            保存记录
          </InteractiveButton>
        </div>
      </div>
    </Modal>
  );
};

// 自定义饮品添加弹窗
const CustomDrinkModal = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [isAlcoholic, setIsAlcoholic] = useState(false);
  const [image, setImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('图片大小不能超过2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入饮品名称');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 解析原料
      const ingredientList = ingredients
        .split(/[,，、\s]+/)
        .map(s => s.trim())
        .filter(Boolean);

      // 调用AI生成维度向量
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/api/generate-drink-dimensions'
        : 'http://localhost:3001/api/generate-drink-dimensions';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          ingredients: ingredientList,
          isAlcoholic
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }

      // 构建饮品对象
      const drinkData = {
        name: name.trim(),
        nameEn: null,
        description: description.trim(),
        ingredients: ingredientList.map(ing => ({ label: ing, name: ing })),
        briefIngredients: ingredientList.map(ing => ({ label: ing })),
        isAlcoholic,
        image: image || 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=400&fit=crop',
        vector: result.vector,
        dimensions: result.dimensions,
        abv: isAlcoholic ? (result.vector?.[6] || 15) : 0,
        tags: isAlcoholic ? ['含酒精'] : ['无酒精']
      };

      // 保存到本地存储
      const savedDrink = customDrinkStorage.addCustomDrink(drinkData);

      // 清空表单
      setName('');
      setDescription('');
      setIngredients('');
      setIsAlcoholic(false);
      setImage('');

      onSave(savedDrink);
      onClose();
    } catch (err) {
      console.error('Save custom drink error:', err);
      setError(err.message || '保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} position="center">
      <div className="ingredient-modal-container" style={{ maxWidth: '440px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="ingredient-modal-title">灵感入壶</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400/60 hover:text-gray-600/80 transition-colors rounded-full">
            <X size={20} />
          </button>
        </div>
        <p className="ingredient-modal-subtitle">一饮一味，皆是灵感</p>
        <div className="ink-divider" />

        {/* Image Upload */}
        <div
          className="oriental-upload-area mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          {image ? (
            <img src={image} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="oriental-upload-placeholder">
              <Camera size={28} />
              <span>点击上传图片</span>
            </div>
          )}
          <div className="oriental-upload-overlay">
            <Camera size={22} className="text-white/90" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {/* Name */}
        <div className="mb-3">
          <label className="oriental-label">饮品名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：蜜桃乌龙"
            className="oriental-input"
            maxLength={30}
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="oriental-label">口感描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述一下这款饮品的口感、风味…"
            className="oriental-textarea"
            style={{ height: '5rem' }}
            maxLength={200}
          />
        </div>

        {/* Ingredients */}
        <div className="mb-3">
          <label className="oriental-label">主要原料（可选）</label>
          <input
            type="text"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="用逗号分隔，如：乌龙茶, 蜜桃, 冰块"
            className="oriental-input"
          />
        </div>

        {/* Alcoholic Toggle */}
        <div className="mb-4">
          <label className="oriental-label">含酒精</label>
          <div className="oriental-toggle-group">
            <button
              onClick={() => setIsAlcoholic(false)}
              className={`oriental-toggle-btn ${!isAlcoholic ? 'is-active' : ''}`}
            >
              无酒精
            </button>
            <button
              onClick={() => setIsAlcoholic(true)}
              className={`oriental-toggle-btn ${isAlcoholic ? 'is-active' : ''}`}
            >
              含酒精
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="oriental-error mb-3">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <InteractiveButton
          variant="primary"
          onClick={handleSubmit}
          disabled={isLoading || !name.trim()}
          className="ingredient-btn-confirm"
          style={{
            width: '100%',
            background: isLoading || !name.trim() ? 'rgba(0,0,0,0.1)' : '#3c3b36',
            color: isLoading || !name.trim() ? 'rgba(0,0,0,0.4)' : '#ebdfc8',
            border: isLoading || !name.trim() ? '1px solid rgba(0,0,0,0.1)' : '1px solid #2a2924',
            boxShadow: isLoading || !name.trim() ? 'none' : '0 4px 12px rgba(0,0,0,0.3)',
            opacity: isLoading || !name.trim() ? 0.6 : 1,
            fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
            fontSize: '1rem',
            letterSpacing: '0.08em',
            fontWeight: 700
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              正在分析风味...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              保存饮品
            </span>
          )}
        </InteractiveButton>

        <p className="oriental-hint">
          AI 将根据您的描述自动分析饮品风味特征
        </p>
      </div>
    </Modal>
  );
};

export default App;

// 自定义 SVG 图标：东方极简/毛笔白描感 + 充实填充感
// 1. 特调 (Mix)：青瓷杯/琉璃盏剪影，带升腾气韵
const CustomMixIcon = ({ size = 26, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ fillOpacity: 0.2 }}
  >
    {/* 盏体实心+描边 */}
    <path d="M3 9c0 5 4 8 9 8s9-3 9-8H3z" />
    <path d="M10 17v3" />
    <path d="M7 20h10" />
    {/* 升腾的茶气/酒香流线 - 保持纯线条 */}
    <path fill="none" d="M12 2c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5" />
    <path fill="none" d="M16 3c-1 1-1 2 0 3" />
    <path fill="none" d="M8 4c1 1 1 2 0 3" />
  </svg>
);

// 2. 灵感 (Explore)：孔明灯，飘动升腾
const CustomExploreIcon = ({ size = 26, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ fillOpacity: 0.2 }}
  >
    {/* 孔明灯外罩轮廓及填充 */}
    <path d="M12 2C8 2 5 6 5 11c0 4 3 7 5 8h4c2-1 5-4 5-8 0-5-3-9-7-9z" />
    {/* 灯口底托与火芯 */}
    <path fill="none" d="M12 19v3" />
    {/* 外侧微光碎片 */}
    <path fill="none" d="M3 11h1" />
    <path fill="none" d="M20 11h1" />
    <path fill="none" d="M17 4l1-1" />
    <path fill="none" d="M7 4l-1-1" />
  </svg>
);

// 3. 我的 (Mine)：极简玉佩/圆润印章剪影，上方盘结，下方流苏
const CustomMineIcon = ({ size = 26, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ fillOpacity: 0.2 }}
  >
    {/* 上方挂绳与盘结 */}
    <path fill="none" d="M12 1v3" />
    <path fill="none" d="M9 4l3 3 3-3" />
    {/* 主体玉佩/同心圆璧，大圆填充小圆镂空效果 */}
    <circle cx="12" cy="11" r="5" fill="currentColor" />
    <circle cx="12" cy="11" r="2" fill="var(--bg-color, white)" stroke="none" />
    <circle cx="12" cy="11" r="2" fill="none" stroke="currentColor" />
    {/* 下方流苏线条 */}
    <path fill="none" d="M12 16v6" />
    <path fill="none" d="M9 18v3" />
    <path fill="none" d="M15 18v3" />
  </svg>
);

const NavigationBar = ({ activeTab, onTabChange }) => (
  <nav className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-around px-6 py-1.5 bg-[rgba(255,255,255,0.85)] backdrop-blur-xl border border-[rgba(180,160,200,0.3)] shadow-[0_8px_32px_rgba(148,120,72,0.15)] rounded-[24px] max-w-md mx-auto">
    <button
      onClick={() => onTabChange('mix')}
      className={`flex flex-col items-center ${activeTab === 'mix' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeTab === 'mix' ? 'scale-110 drop-shadow-md' : 'bg-transparent filter grayscale opacity-60'}`}>
        <img src={navIconMix} alt="特调" className="w-10 h-10 object-contain" />
      </div>
      <span className="text-[10px] font-bold font-serif tracking-widest" style={{ letterSpacing: '0.15em', marginTop: '-4px' }}>特调</span>
    </button>
    <button
      onClick={() => onTabChange('explore')}
      className={`flex flex-col items-center ${activeTab === 'explore' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeTab === 'explore' ? 'scale-110 drop-shadow-md' : 'bg-transparent filter grayscale opacity-60'}`}>
        <img src={navIconExplore} alt="灵感" className="w-11 h-11 object-contain" />
      </div>
      <span className="text-[10px] font-bold font-serif tracking-widest" style={{ letterSpacing: '0.15em', marginTop: '-4px' }}>灵感</span>
    </button>
    <button
      onClick={() => onTabChange('mine')}
      className={`flex flex-col items-center ${activeTab === 'mine' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeTab === 'mine' ? 'scale-110 drop-shadow-md' : 'bg-transparent filter grayscale opacity-60'}`}>
        <img src={navIconMine} alt="我的" className="w-10 h-10 object-contain" />
      </div>
      <span className="text-[10px] font-bold font-serif tracking-widest" style={{ letterSpacing: '0.15em', marginTop: '-4px' }}>我的</span>
    </button>
  </nav>
);
