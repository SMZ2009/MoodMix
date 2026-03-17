import React, { useState, useCallback, useRef, useMemo, useEffect, forwardRef } from 'react';
import html2canvas from 'html2canvas';
import {
  ChevronLeft, Heart, HelpCircle, Flame, Search, Plus,
  Martini, User, Settings2, Maximize2,
  Wine, Droplets, ThermometerSnowflake,
  Sparkles, Lightbulb, GlassWater,
  Users, HeartOff, Loader2, Camera, X, ArrowLeft, Download, CheckCircle, Share2, Mic
} from 'lucide-react';
import CustomMenuIcon from './components/CustomMenuIcon';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';

import { inventoryStorage, favoriteStorage, collectionStorage, customDrinkStorage, userStorage } from './store/localStorageAdapter';
import HelperModal from './components/HelperModal';
import DrinkHelpModal from './components/DrinkHelpModal';
import FocusModeView from './components/FocusModeView';
import RecommendationGallery from './components/RecommendationGallery';
import SideNavigation from './components/SideNavigation';

import { analyzeMood } from './api/moodAnalyzer';
import { evaluateAndSortDrinks } from './engine/vectorEngine';
import { executeRecommendationPipeline, extractRecommendationResult, executeMixologyTask } from './agents';
import { generatePhilosophyTags } from './engine/philosophyTags';
import { fetchLiveQuotes } from './api/quoteGenerator';
import { translateDrinkName, translateIngredient } from './data/translations';
import { validateInput } from './utils/inputValidator';
import { generateShareCard } from './utils/ShareCardGenerator';
import MineSection from './components/MineSection';
import IngredientManager from './components/IngredientManager';
import CommunitySection from './components/CommunitySection';
import GroupRecommendationModal from './components/GroupRecommendationModal';
import { useTouchFeedback, useKeyboardNavigation, useCocktailApi, useSwipeGesture } from './hooks';
import { InteractiveButton, SwipeableCard, PageTransition, Modal, LoadingTransition, StreamingAnalysisCard } from './components/ui';
import IngredientEditModal from './components/IngredientEditModal';
import './App.css';
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

// 初始化用户UID
const userUID = userStorage.getUID();
console.log('⚡ [System] User UID initialized:', userUID);

const iconMap = {
  Wine,
  Droplets,
  ThermometerSnowflake,
  GlassWater,
  Flame
};

/**
 * 核心思路：根据图片实际宽高比决定渲染策略
 */
function getImageDisplayStyle(imgWidth, imgHeight) {
  const ratio = imgWidth / imgHeight;

  if (ratio > 1.4) {
    // 极宽横图：裁切为 16:10，避免卡片太扁
    return { aspectRatio: '16/10', objectFit: 'cover' };
  } else if (ratio > 0.9) {
    // 接近正方形或普通横图：裁切为 4:3
    return { aspectRatio: '4/3', objectFit: 'cover' };
  } else if (ratio > 0.55) {
    // 普通竖图：保留原比例，限制最大高度
    return { maxHeight: '420px', objectFit: 'cover' };
  } else {
    // 极窄竖图：裁切为 9:16 上限
    return { aspectRatio: '9/16', objectFit: 'cover', maxHeight: '450px' };
  }
}

/**
 * 分享卡片图片组件 - 自适应比例
 * 图片 onLoad 时读取 naturalWidth/naturalHeight：
 * - 宽高比 >1.4：aspect-ratio 16/10
 * - 宽高比 0.9-1.4：aspect-ratio 4/3
 * - 宽高比 0.55-0.9：保留原比例，max-height 420px
 * - 宽高比 <0.55：aspect-ratio 9/16，max-height 450px
 */
/**
 * ShareCardImage component - Forced 3:4 aspect ratio with cover fit
 */
const ShareCardImage = ({ src }) => {
  return (
    <div style={{
      width: '100%',
      aspectRatio: '1 / 1', // Aligned with detail page
      overflow: 'hidden',
      borderRadius: '40px', // Matches detail page's 2.5rem
      background: '#f0ebe3'
    }}>
      <img
        src={src}
        alt="Drink"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
    </div>
  );
};

/**
 * Redesigned Share Card Component (DOM-based)
 * 完整卡片布局，二维码包含在卡片内部
 */
const ShareCard = forwardRef(({ drinkName, emotion, wuxing, imageSrc, llmCopy, qrCodeSrc }, ref) => {
  // 日期格式：2026.03.15
  const today = new Date();
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div ref={ref} className="share-card" style={{ background: '#FAF8F5' }}>
      {/* 顶部品牌栏 - 优化版 */}
      <div className="card-header" style={{ padding: '20px 24px', borderBottom: 'none' }}>
        <div className="flex flex-col">
          <span className="brand" style={{
            fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif",
            fontSize: '18px',
            fontWeight: 700,
            color: '#3c3b36',
            letterSpacing: '0.1em'
          }}>MoodMix | 心绪调饮</span>
          <span style={{
            fontSize: '10px',
            color: '#a09382',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            marginTop: '2px'
          }}>Oriental Alchemy</span>
        </div>
        <span className="date" style={{ color: '#8c8b86', fontSize: '14px', fontFamily: '"FZYouSong", serif' }}>{formattedDate}</span>
      </div>

      {/* 图片区域 - 强制 3:4 */}
      <div style={{ padding: '0 24px' }}>
        <ShareCardImage src={imageSrc} />
      </div>

      {/* 内容区域 */}
      <div className="card-body" style={{ padding: '24px' }}>
        <h2 className="drink-name" style={{
          fontSize: '32px',
          marginBottom: '12px',
          fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif",
          color: '#1a1a1a'
        }}>{drinkName}</h2>

        {/* 移除 "此刻心迹" 前缀 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="emotion-tag" style={{
            background: 'rgba(60, 59, 54, 0.05)',
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '13px',
            color: '#5c5b56',
            fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif"
          }}>{emotion}</span>
          <span style={{ color: '#d1cdc2', fontSize: '12px' }}>|</span>
          <span style={{ fontSize: '13px', color: '#8c8b86', fontFamily: '"STKaiti", serif' }}>{wuxing}</span>
        </div>

        <div className="card-divider" style={{
          height: '1px',
          background: 'linear-gradient(90deg, #d1cdc2 0%, transparent 100%)',
          margin: '20px 0',
          opacity: 0.5
        }} />

        {/* 推荐语对齐画廊风格 */}
        <div style={{
          borderLeft: '2px solid #d1cdc2',
          paddingLeft: '16px',
          marginTop: '16px'
        }}>
          <p className="llm-copy" style={{
            fontSize: '15px',
            lineHeight: '1.8',
            color: '#4c4b46',
            fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
            fontStyle: 'italic'
          }}>{llmCopy}</p>
        </div>
      </div>

      {/* 底部引流区 */}
      <div className="card-footer" style={{ borderTop: 'none', padding: '24px', paddingTop: '0' }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col">
            <span className="cta" style={{ fontSize: '12px', color: '#a09382', letterSpacing: '0.05em' }}>扫码试试你的情绪饮品</span>
            <span style={{ fontSize: '10px', color: '#d1cdc2', textTransform: 'uppercase', marginTop: '2px' }}>Scan for your Mood Mix</span>
          </div>
          <div className="qr-code-box" style={{
            width: '64px',
            height: '64px',
            background: '#fff',
            padding: '6px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            {qrCodeSrc ? (
              <img src={qrCodeSrc} alt="QR Code" className="qr-code-img" style={{ width: '100%', height: '100%' }} />
            ) : (
              <Sparkles size={18} className="text-[#a09382]/50" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

async function exportShareCard(cardElement) {
  if (!cardElement) return null;

  try {
    // 为移动设备添加更兼容的配置
    const canvas = await html2canvas(cardElement, {
      scale: 1.5,                  // 降低分辨率以提高移动设备性能
      backgroundColor: '#faf8f5',  // 卡片底色
      useCORS: true,               // 允许跨域图片
      logging: false,
      // 移动设备兼容性配置
      allowTaint: true,            // 允许可能的污染
      letterRendering: true,        // 改善文字渲染
      // 增加超时设置
      timeout: 10000               // 10秒超时
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Canvas to blob conversion timeout'));
      }, 5000);

      canvas.toBlob((blob) => {
        clearTimeout(timeout);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png', 0.9); // 添加质量参数
    });
  } catch (error) {
    console.error('Export share card failed:', error);
    // 降级方案：返回一个简单的错误占位图片
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4c4b46';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('分享卡片生成失败', canvas.width / 2, canvas.height / 2);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }
}

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
  '心里有点空，又说不清…',
  '平静，但隐隐有些期待…',
  '莫名烦躁，什么都不想做…',
  '老板给我加薪啦...'
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




const ORIENTAL_MOOD_TAGS = [
  { label: '早起唤醒', value: '#早起唤醒' },
  { label: '午后犯困', value: '#午后犯困' },
  { label: '加班续命', value: '#加班续命' },
  { label: '下班犒劳', value: '#下班犒劳' },
  { label: '周末放松', value: '#周末放松' },
  { label: '睡前安抚', value: '#睡前安抚' }
];

const MoodInputSection = ({
  moodInput, setMoodInput, selectedMood, setSelectedMood, onGenerate, buttonFeedback, isMixing,
  ingredientCount, onEditIngredients, onNavigate, activeTab, showFriendlyNotice
}) => {
  // onGenerate can optionally accept a directMood value for immediate tag clicks
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [greeting, setGreeting] = useState({ main: '此刻，心境如何？', sub: '万般心绪，皆可入杯' });



  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % MOOD_INPUT_PLACEHOLDERS.length);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别功能');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onstart = () => {
      console.log('语音识别开始');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMoodInput(transcript);
      console.log('语音识别结果:', transcript);
    };

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      setIsListening(false);
      
      // 处理常见错误
      if (event.error === 'not-allowed') {
        alert('请在浏览器设置中允许麦克风权限');
      } else if (event.error === 'no-speech') {
        alert('未检测到语音，请重试');
      } else {
        alert('语音识别失败，请重试');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('语音识别结束');
    };

    try {
      recognition.start();
      console.log('语音识别已启动');
    } catch (error) {
      console.error('启动语音识别失败:', error);
      setIsListening(false);
      alert('启动语音识别失败，请检查麦克风权限');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-24 bg-dreamy-gradient w-full min-h-[100svh] relative overflow-x-hidden overflow-y-auto trae-browser-inspect-draggable">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-blue-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-1/3 left-0 w-72 h-72 bg-pink-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="text-center mt-12 sm:mt-16 mb-4 sm:mb-6 z-10">
        <h2 className="text-2xl xs:text-[24px] sm:text-[28px] font-extrabold text-gray-800 mb-2 sm:mb-3 tracking-wide mx-auto text-center animate-float-in" style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif", animation: 'floatIn 1.2s ease-out forwards' }}>{greeting.main}</h2>
        <p
          className="text-gray-500 text-xs sm:text-sm font-light tracking-wider mx-auto text-center italic animate-float-in"
          style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif", animation: 'floatIn 1.2s ease-out 0.3s forwards' }}
        >
          {greeting.sub}
        </p>
      </div>
      <div className="relative flex-1 w-full flex flex-col items-center justify-center pb-12 sm:pb-16 translate-y-[90px]">
        {/* 标签散点布局容器 - 围绕杯子分布 */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center -translate-y-[20px]">
          <div className="relative w-full max-w-[500px] h-[400px]">
            {ORIENTAL_MOOD_TAGS.map((mood, index) => {
              const isSelected = selectedMood === mood.value;
              // 预设坐标系统 - 随性散布方案 (位置上移，避免遮挡)
              const positions = [
                { l: 12, t: 2, r: -6 },
                { l: 28, t: -18, r: 3 },
                { l: 48, t: -8, r: -2 },
                { l: 68, t: -22, r: 5 },
                { l: 84, t: 8, r: -4 },
                { l: 96, t: -12, r: 6 },
              ];
              const pos = positions[index % positions.length];
              
              const cloudAnimations = ['cloudFloat1', 'cloudFloat2', 'cloudFloat3'];
              const cloudDurations = [12, 15, 18, 14, 16, 13];
              const cloudDelays = [0, 2, 4, 1, 3, 5];
              
              return (
                <div
                  key={mood.value}
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${pos.l}%`,
                    top: `${pos.t}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      animation: `floatIn 1.2s ease-out ${index * 150}ms forwards`,
                      opacity: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const nextValue = isSelected ? null : mood.value;
                        setSelectedMood(nextValue);
                        if (!isSelected && !isMixing) {
                          onGenerate(nextValue);
                        }
                      }}
                      className={`mood-ink-tag group ${isSelected ? 'is-selected' : ''} mood-tag-cloud`}
                      aria-pressed={isSelected}
                      style={{
                        '--mood-ink-color': isSelected ? 'rgba(224, 197, 110, 0.24)' : 'rgba(104, 114, 120, 0.15)',
                        '--mood-ink-accent': isSelected ? 'rgba(204, 172, 74, 0.82)' : 'rgba(72, 82, 89, 0.5)',
                        '--rotate': `${pos.r}deg`,
                        '--scale': '0.95',
                        transform: isSelected ? 'scale(1.15) rotate(0deg)' : `rotate(${pos.r}deg) scale(0.95)`,
                        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
                        animationName: isSelected ? 'none' : cloudAnimations[index % 3],
                        animationDuration: `${cloudDurations[index]}s`,
                        animationDelay: `${cloudDelays[index]}s`,
                      }}
                    >
                      <span className={`mood-ink-tag__label ${isSelected ? 'is-selected' : ''}`}>{mood.label}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-20 w-[320px] sm:w-[420px] max-w-[92vw] transition-all duration-500 translate-y-[80px]">
          <img
            src={cupRippleImage}
            alt="杯子和水波"
            className={`w-full h-auto object-contain select-none pointer-events-none transition-all duration-500 ${isMixing ? 'scale-[1.02] opacity-95' : 'scale-100 opacity-100'}`}
          />
        </div>

        <button
          type="button"
          className="relative z-30 mt-28 sm:mt-32 mb-0.5 sm:mb-1 px-5 py-2 text-[13px] sm:text-[14px] text-gray-700/80 transition-colors hover:text-gray-800 group"
          style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif", fontWeight: 300, letterSpacing: '0.14em' }}
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

      </div>

      {/* 固定在底部的区域 */}
      <div className="fixed bottom-0 left-0 right-0 px-6 pb-6 pt-4 bg-gradient-to-t from-white/80 to-transparent z-20">
        {/* 输入框 */}
        <div className="w-full max-w-[28rem] relative mx-auto z-10">
          <div
            className="flex items-center h-14 bg-white/95 backdrop-blur-2xl rounded-full border border-gray-200/70 shadow-xl pl-5 pr-3 focus-within:border-[#3c3b36]/40 focus-within:shadow-lg focus-within:shadow-black/5 transition-all duration-300"
            style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 6px 24px, rgba(255, 255, 255, 0.9) 0px 1px 0px inset', borderRadius: '32px' }}
          >
            <div className="flex-1 relative">
              {!moodInput && (
                <span
                  className="absolute inset-y-0 left-0 flex items-center text-gray-400 text-sm pointer-events-none transition-opacity duration-200"
                  style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif" }}
                >
                  {MOOD_INPUT_PLACEHOLDERS[placeholderIndex]}
                </span>
              )}
              <input
                className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-sm text-gray-800 h-full px-2"
                placeholder=""
                value={moodInput}
                onChange={(e) => setMoodInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && moodInput.trim() && onGenerate()}
                style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif", letterSpacing: '0.05em' }}
              />
            </div>
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={isMixing}
              className={`w-10 h-10 flex items-center justify-center rounded-full ml-2 transition-all duration-300 flex-shrink-0 ${isListening
                ? 'bg-gradient-to-br from-[#3c3b36] to-[#1a1a1a] text-[#f7f0e4] shadow-lg animate-pulse'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer'
                }`}
              style={{ boxShadow: 'rgba(0, 0, 0, 0.05) 0px 2px 6px' }}
              aria-label="语音输入"
            >
              <Mic
                width="16"
                height="16"
                className={isListening ? 'text-[#f7f0e4]' : 'text-gray-500'}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!moodInput.trim() || isMixing}
              className={`w-10 h-10 flex items-center justify-center rounded-full ml-2 transition-all duration-300 flex-shrink-0 ${moodInput.trim() && !isMixing
                ? 'bg-gradient-to-br from-[#3c3b36] to-[#1a1a1a] text-[#f7f0e4] shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              style={{ boxShadow: 'rgba(0, 0, 0, 0.05) 0px 2px 6px' }}
              aria-label="发送"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={moodInput.trim() && !isMixing ? 'text-[#f7f0e4]' : 'text-gray-400'}
                aria-hidden="true"
              >
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </button>
          </div>
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
              寻味指引
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

const FriendlyNoticeModal = ({ isOpen, title, message, tone = 'default', onClose, primaryAction, secondaryAction, isLoading = false }) => {
  if (!isOpen) return null;

  const toneStyles = {
    default: {
      accent: 'rgba(255, 255, 255, 0.95)',
      glow: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)'
    },
    warning: {
      accent: 'rgba(251, 191, 36, 0.95)',
      glow: 'rgba(251, 191, 36, 0.1)',
      border: 'rgba(251, 191, 36, 0.2)'
    },
    error: {
      accent: 'rgba(248, 113, 113, 0.95)',
      glow: 'rgba(248, 113, 113, 0.1)',
      border: 'rgba(248, 113, 113, 0.2)'
    },
    success: {
      accent: 'rgba(52, 211, 153, 0.95)',
      glow: 'rgba(52, 211, 153, 0.1)',
      border: 'rgba(52, 211, 153, 0.2)'
    }
  };

  const currentTone = toneStyles[tone] || toneStyles.default;

  return (
    <Modal isOpen={isOpen} onClose={onClose} position="center" closeOnBackdrop>
      <div
        className="glass-modal rounded-[2.8rem] p-8 w-[calc(100vw-3rem)] max-w-[20rem] mx-auto"
        style={{
          border: `1px solid ${currentTone.border}`,
          boxShadow: `0 24px 64px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.05)`
        }}
      >
        <div
          className="absolute -top-12 -left-10 w-48 h-48 rounded-full blur-[80px] pointer-events-none opacity-50"
          style={{ background: currentTone.glow }}
        />
        
        <div className="relative z-10">
          <div className="glass-tag mb-6">
            <span style={{ color: currentTone.accent }}>{title || '小提醒'}</span>
          </div>

          <p
            className="mb-8 leading-relaxed"
            style={{
              fontSize: '1.05rem',
              color: '#1a1a1a',
              fontFamily: '"Noto Serif SC", serif',
              letterSpacing: '0.02em'
            }}
          >
            {message}
          </p>

          <div className="flex flex-col gap-3">
            {primaryAction && (
              <InteractiveButton
                variant="glass-primary"
                onClick={primaryAction.onClick}
                disabled={isLoading}
                className="w-full h-12"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin opacity-70" />
                ) : (
                  <span>{primaryAction.label}</span>
                )}
              </InteractiveButton>
            )}
            
            {secondaryAction && (
              <InteractiveButton
                variant="glass-secondary"
                onClick={secondaryAction.onClick}
                disabled={isLoading}
                className="w-full h-12"
              >
                <span>{secondaryAction.label}</span>
              </InteractiveButton>
            )}

            {!primaryAction && !secondaryAction && (
              <InteractiveButton
                variant="glass-primary"
                onClick={onClose}
                className="w-full h-12"
              >
                <span>好的</span>
              </InteractiveButton>
            )}
          </div>
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
            style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif" }}
          >
            <BriefIcon size={14} className="opacity-80 text-blue-300" />
            {drink.abv > 0 ? `微醺 | ABV ${drink.abv}%` : '无酒精'}
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 sm:pb-10 px-4 sm:px-6 text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 tracking-tight leading-none drop-shadow-md"
            style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif", letterSpacing: '0.05em' }}
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
                  style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif", fontWeight: 500 }}
                >
                  {tag}
                </span>
              ))}
            </div>
            {/* 渐变替换容器: 本地原始语录居中打底，一旦有大模型定制语录，通过 CSS opacity 平滑交叉过渡 */}
            <div className="relative w-full flex justify-center min-h-[36px] sm:min-h-[40px]">
              <p
                className={`absolute text-[11px] sm:text-[12px] text-white/70 font-light italic opacity-90 leading-relaxed max-w-[180px] sm:max-w-[220px] transition-opacity duration-1000 ${customQuote ? 'opacity-0' : 'opacity-100'}`}
                style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif" }}
              >
                {philosophy.quote}
              </p>
              <p
                className={`absolute text-[11px] sm:text-[12px] font-medium italic leading-relaxed max-w-[180px] sm:max-w-[220px] transition-opacity duration-1000 ${customQuote ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
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
                    style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif" }}
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
                  style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif", letterSpacing: '0.02em' }}
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
                    fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif",
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
                  borderRadius: '20px',
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
                    className="relative aspect-[4/5] bg-cover bg-center overflow-hidden shadow-inner"
                    style={{ backgroundImage: `url(${drink.image})`, borderRadius: '20px' }}
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
                  style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif" }}
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
                      style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', serif" }}
                    >
                      {drink.nameEn || drink.sub || drink.subName || ''}
                    </p>
                  )}
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
  const [shareCardUrl, setShareCardUrl] = useState(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [llmCopy, setLlmCopy] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const cardRef = useRef(null);
  const qrCanvasRef = useRef(null);

  if (!drink) return null;

  const drinkIngredients = drink.ingredients || [];
  const drinkSteps = drink.steps || [{ title: '第一步', desc: drink.reason || '开始享用' }];

  // 生成分享链接
  const getShareLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}?drink_id=${drink.id}`;
  };

  const handleShare = async () => {
    setIsGeneratingShare(true);
    try {
      // 0. 生成二维码数据 URL
      if (qrCanvasRef.current) {
        const qrCanvas = qrCanvasRef.current.querySelector('canvas');
        if (qrCanvas) {
          const qrUrl = qrCanvas.toDataURL('image/png');
          setQrCodeDataUrl(qrUrl);
        }
      }

      // 1. 获取 LLM 文案
      const prompt = `你是 MoodMix 的文案诗人。请为分享卡片生成一段情绪文案。

要求：
- 2-3 句话，总字数控制在 30-50 字
- 东方诗意的克制感，像朋友间的低语
- 结合饮品的具体感官细节（颜色、温度、口感、气味）
- 温柔地回应用户当下的情绪，给予认可或鼓励
- 不要说教，不要鸡汤，不要感叹号

输入信息：
- 饮品名：${drink.name}
- 推荐理由：${drink.reason || '无'}
- 五行属性：${drink.dimensions?.wuxing || '未知'}

请直接输出文案，不要任何前缀或解释。`;

      // 使用专用的 SOCIAL_CARD 任务类型
      const agentResult = await executeMixologyTask('SOCIAL_CARD', { drink, prompt });

      // 安全提取文案
      let poeticalCopy = '岁序更迭，此情可待';
      if (agentResult && agentResult.success && agentResult.data && typeof agentResult.data.copy === 'string') {
        poeticalCopy = agentResult.data.copy;
      } else if (typeof agentResult === 'string') {
        poeticalCopy = agentResult;
      }

      setLlmCopy(poeticalCopy);

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 800));

      // 再次获取二维码（确保状态已更新）
      if (qrCanvasRef.current) {
        const qrCanvas = qrCanvasRef.current.querySelector('canvas');
        if (qrCanvas) {
          const qrUrl = qrCanvas.toDataURL('image/png');
          setQrCodeDataUrl(qrUrl);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // 2. 将 DOM 生成图片
      if (cardRef.current) {
        const blob = await exportShareCard(cardRef.current);
        const imageUrl = URL.createObjectURL(blob);
        setShareCardUrl(imageUrl);
      }
    } catch (error) {
      console.error('Failed to generate share card:', error);
      alert('生成分享卡片失败，请稍后重试');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleCopyLink = () => {
    const link = getShareLink();
    navigator.clipboard.writeText(link).then(() => {
      alert('分享链接已复制到剪贴板！');
    }).catch(() => {
      alert('复制失败，请手动复制链接');
    });
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;

    try {
      // 直接使用 html2canvas 生成 canvas
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#faf8f5',
        useCORS: true,
        logging: false
      });

      // 将 canvas 转为 blob 并下载
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('生成 blob 失败');
          return;
        }

        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `MoodMix_${drink.name}.png`;
        document.body.appendChild(link);
        link.click();

        // 清理
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 'image/png');
    } catch (error) {
      console.error('下载失败:', error);
      alert('保存失败，请稍后重试');
    }
  };

  // 辅助函数：将数字索引转为中文步骤名
  const getChineseStep = (idx) => {
    const map = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return `第${map[idx] || (idx + 1)}步`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F6F2] h-screen overflow-y-auto pb-32">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-[60] px-6 py-4 flex justify-between bg-[#F7F6F2]/80 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="flex items-center justify-center bg-white/50 backdrop-blur-md border border-gray-200/50 text-gray-800 w-10 h-10 rounded-full shadow-sm hover:bg-white/80 transition-all active:scale-95"
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={isGeneratingShare}
            aria-label="分享"
            className="flex items-center justify-center bg-white/50 backdrop-blur-md border border-gray-200/50 text-gray-800 w-10 h-10 rounded-full shadow-sm hover:bg-white/80 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGeneratingShare ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
          </button>
          <button
            type="button"
            onClick={() => onHelp && onHelp(drink)}
            aria-label="饮品帮助"
            className="flex items-center justify-center bg-white/50 backdrop-blur-md border border-gray-200/50 text-gray-800 w-10 h-10 rounded-full shadow-sm hover:bg-white/80 transition-all active:scale-95"
          >
            <HelpCircle size={21} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
        {/* 上部：左右布局容器 */}
        <div className="flex flex-col lg:flex-row gap-8 lg:items-start mb-12">

          {/* 左侧：名称与原料 (Flex-1) */}
          <div className="flex-1 order-2 lg:order-1">
            {/* 标题区域 */}
            <div className="mb-8">
              <div className="flex flex-wrap items-baseline gap-3 mb-4">
                <h1 className="text-[2rem] sm:text-[2.5rem] oriental-title-large">
                  {drink.name_cn || translateDrinkName(drink.name) || drink.name}
                </h1>
                {drink.nameEn && drink.nameEn !== drink.name && (
                  <span className="text-[14px] text-gray-400 font-serif italic tracking-wider opacity-60">
                    / {drink.nameEn}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5 mb-6">
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

              {/* 推荐理由 */}
              {drink.reason && (
                <div className="relative mb-8 pl-4 border-l-2 border-gray-200">
                  <p
                    className="text-[15px] text-gray-600 leading-[1.8] font-serif italic opacity-90"
                    style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif" }}
                  >
                    {drink.reason}
                  </p>
                </div>
              )}
            </div>

            {/* 原料清单 */}
            <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60">
              <div className="flex justify-between items-end mb-6">
                <h3 className="text-[18px] font-bold text-gray-900 tracking-[0.1em]" style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif" }}>原料清单</h3>
                <span className="text-[11px] text-gray-400 bg-gray-50/80 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  <Users size={12} /> 一人份量
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
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
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500/80 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                          <IngredientIcon size={18} strokeWidth={1.5} />
                        </div>
                        <span
                          className="text-[15px] font-bold text-gray-800"
                          style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif" }}
                        >
                          {translateIngredient(ing.name)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-extrabold text-gray-900 font-serif">{ing.amount}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter -mt-1">{ing.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：饮品图片 (Fixed/Custom Width) */}
          <div className="w-full lg:w-[400px] xl:w-[480px] order-1 lg:order-2">
            <div className="sticky top-24">
              <div className="relative aspect-square lg:aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl group">
                <img
                  src={drink.image}
                  className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                  alt={drink.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
          </div>
        </div>

        {/* 下部：制作步骤 (Full Width) */}
        <div className="mt-8 border-t border-gray-100 pt-12">
          <h3 className="text-[18px] font-bold text-gray-900 mb-10 tracking-[0.1em]" style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif" }}>制作步骤</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {drinkSteps.map((step, idx) => (
              <div key={idx} className="flex gap-5 group">
                <div className="flex flex-col items-center flex-none">
                  <div className="w-8 h-8 rounded-full bg-[#3c3b36] text-[#ebdfc8] flex items-center justify-center font-bold text-sm shadow-lg">
                    {idx + 1}
                  </div>
                  {idx !== drinkSteps.length - 1 && (
                    <div className="hidden md:block w-px h-full bg-gradient-to-b from-[#3c3b36] to-transparent opacity-20 mt-2" />
                  )}
                </div>
                <div className="flex-1">
                  <h4
                    className="text-[15px] font-black text-gray-900 mb-2 tracking-wider"
                    style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif" }}
                  >
                    {getChineseStep(idx)}
                  </h4>
                  <p className="text-[14px] text-gray-500 leading-[1.75] font-medium opacity-85">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
            <span className="ml-2.5">打卡</span>
          </InteractiveButton>
        </div>
      </div>

      {/* 分享卡片预览弹窗 */}
      {shareCardUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto py-8"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
          onClick={() => setShareCardUrl(null)}
        >
          <img
            src={shareCardUrl}
            alt="Share Card"
            className="w-full max-w-[400px] h-auto object-contain rounded-2xl shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Hidden Share Card for generating image */}
      {!shareCardUrl && (
        <div style={{ position: 'fixed', left: '-2000px', top: '0', pointerEvents: 'none', zIndex: -1 }}>
          {/* Hidden QR Code Canvas */}
          <div ref={qrCanvasRef} style={{ width: '88px', height: '88px' }}>
            <QRCodeCanvas
              value={getShareLink()}
              size={88}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#3a3226"
            />
          </div>
          <ShareCard
            ref={cardRef}
            drinkName={drink.name}
            emotion={drink.dimensions?.mood || '悠然'}
            wuxing={drink.dimensions?.wuxing ? `五行属${drink.dimensions.wuxing}` : '五行调和'}
            imageSrc={drink.image}
            llmCopy={llmCopy}
            qrCodeSrc={qrCodeDataUrl}
          />
        </div>
      )}
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
    tone: 'default',
    primaryAction: null,
    secondaryAction: null
  });
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const cardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const [llmCopy, setLlmCopy] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [showIngredientLibrary, setShowIngredientLibrary] = useState(false);
  const [showIngredientCustomForm, setShowIngredientCustomForm] = useState(false);
  const [showGroupRecommendation, setShowGroupRecommendation] = useState(false);
  const [lastLikedDrink, setLastLikedDrink] = useState(null);
  const [socket, setSocket] = useState(null);
  const [liveLikeCount, setLiveLikeCount] = useState({});

  // Track if session ingredients have been initialized from inventory
  const isSessionInitialized = useRef(false);
  const isQuoteFetching = useRef(false);
  const mainContentRef = useRef(null);

  // WebSocket 连接初始化
  useEffect(() => {
    // 智能检测连接地址：开发环境下指向 3001 代理端口，生产环境下指向当前 origin
    let socketUrl = window.location.origin;
    if (window.location.port === '3000') {
      socketUrl = window.location.protocol + '//' + window.location.hostname + ':3001';
    }

    console.log('[WebSocket] 正在连接到:', socketUrl);

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    socketInstance.on('connect', () => {
      console.log('[WebSocket] ✅ 已连接到服务器, socket id:', socketInstance.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[WebSocket] ⚠️ 与服务器断开连接, 原因:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[WebSocket] ❌ 连接错误:', error.message);
      // 如果WebSocket连接失败，降级到HTTP轮询
      if (socketInstance.io.opts.transports[0] === 'websocket') {
        console.log('[WebSocket] 尝试降级到 polling 传输方式');
        socketInstance.io.opts.transports = ['polling'];
      }
    });

    socketInstance.on('drink-liked', (data) => {
      console.log('[WebSocket] 📨 收到饮品喜欢更新:', data);
      setLiveLikeCount(prev => ({
        ...prev,
        [data.drinkId]: data.count
      }));

      if (data.isNewLike && data.count >= 2) {
        showFriendlyNotice(
          '「同饮」',
          `还有 ${data.count} 人，也为这一杯停留`,
          'success',
          { label: '好的', onClick: () => setFriendlyNotice(prev => ({ ...prev, isOpen: false })) }
        );
      }
    });

    setSocket(socketInstance);

    return () => {
      console.log('[WebSocket] 清理连接');
      socketInstance.disconnect();
    };
  }, []);

  // 当查看饮品详情时，加入该饮品的房间并获取初始心意统计
  useEffect(() => {
    if (socket && currentDrink) {
      socket.emit('join-drink-room', currentDrink.id);

      // 获取初始心意统计
      const fetchInitialLikeStats = async () => {
        try {
          const response = await fetch(`/api/drink/like-stats/${currentDrink.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setLiveLikeCount(prev => ({
                ...prev,
                [currentDrink.id]: data.count
              }));
              console.log('[DrinkLike] 初始统计:', currentDrink.id, data.count);
            }
          }
        } catch (error) {
          console.error('[DrinkLike] 获取初始统计失败:', error);
        }
      };
      fetchInitialLikeStats();

      return () => {
        socket.emit('leave-drink-room', currentDrink.id);
      };
    }
  }, [socket, currentDrink]);

  const showFriendlyNotice = useCallback((title, message, tone = 'default', primaryAction = null, secondaryAction = null) => {
    setFriendlyNotice({
      isOpen: true,
      title,
      message,
      tone,
      primaryAction,
      secondaryAction
    });
  }, []);

  const handleShare = async () => {
    if (!currentDrink) return;
    
    setIsGeneratingShare(true);
    setIsShareLoading(true);
    try {
      // 0. 生成二维码数据 URL
      if (qrCanvasRef.current) {
        const qrCanvas = qrCanvasRef.current.querySelector('canvas');
        if (qrCanvas) {
          const qrUrl = qrCanvas.toDataURL('image/png');
          setQrCodeDataUrl(qrUrl);
        }
      }

      // 1. 获取 LLM 文案
      const prompt = `你是 MoodMix 的文案诗人。请为分享卡片生成一段情绪文案。

要求：
- 2-3 句话，总字数控制在 30-50 字
- 东方诗意的克制感，像朋友间的低语
- 结合饮品的具体感官细节（颜色、温度、口感、气味）
- 温柔地回应用户当下的情绪，给予认可或鼓励
- 不要说教，不要鸡汤，不要感叹号

输入信息：
- 饮品名：${currentDrink.name}
- 推荐理由：${currentDrink.reason || '无'}
- 五行属性：${currentDrink.dimensions?.wuxing || '未知'}

请直接输出文案，不要任何前缀或解释。`;

      // 使用专用的 SOCIAL_CARD 任务类型
      const agentResult = await executeMixologyTask('SOCIAL_CARD', { drink: currentDrink, prompt });

      // 安全提取文案
      let poeticalCopy = '岁序更迭，此情可待';
      if (agentResult && agentResult.success && agentResult.data && typeof agentResult.data.copy === 'string') {
        poeticalCopy = agentResult.data.copy;
      } else if (typeof agentResult === 'string') {
        poeticalCopy = agentResult;
      }

      setLlmCopy(poeticalCopy);

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 800));

      // 再次获取二维码（确保状态已更新）
      if (qrCanvasRef.current) {
        const qrCanvas = qrCanvasRef.current.querySelector('canvas');
        if (qrCanvas) {
          const qrUrl = qrCanvas.toDataURL('image/png');
          setQrCodeDataUrl(qrUrl);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // 2. 将 DOM 生成图片
      if (cardRef.current) {
        const blob = await exportShareCard(cardRef.current);
        const imageUrl = URL.createObjectURL(blob);
        setShareCardUrl(imageUrl);
        // 图片生成完成后关闭友好通知
        closeFriendlyNotice();
      }
    } catch (error) {
      console.error('Failed to generate share card:', error);
      alert('生成分享卡片失败，请稍后重试');
    } finally {
      setIsGeneratingShare(false);
      setIsShareLoading(false);
    }
  };

  const closeFriendlyNotice = useCallback(() => {
    setFriendlyNotice(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleJoinGroup = (group) => {
    console.log('Joining group:', group.name);
    setShowGroupRecommendation(false);
    setActiveTab('community');
  };

  const handleNavigateToCommunity = (group) => {
    setShowGroupRecommendation(false);
    setActiveTab('community');
  };

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
      showFriendlyNotice(
        '已记录',
        '这一刻的味道，\n已留在你的赏味集里。',
        'success',
        { label: '回到这杯', onClick: () => { handleCloseDakaModal(); closeFriendlyNotice(); } },
        { label: '分享此刻', onClick: handleShare }
      );
    }
    // handleCloseDakaModal(); // Removed to allow DakaModal to show share card preview
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
    showFriendlyNotice(
      '创建成功',
      `您的特调“${savedDrink.name}”已存入探索列表。`,
      'success',
      { label: '好的', onClick: () => { handleCloseCustomDrinkModal(); closeFriendlyNotice(); } }
    );
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

  // 处理分享链接：检查 URL 参数并自动打开对应饮品
  useEffect(() => {
    const handleSharedDrink = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const drinkId = urlParams.get('drink_id');
      const drinkName = urlParams.get('drink');

      if (drinkId && apiDrinks.length > 0) {
        const foundDrink = apiDrinks.find(d => d.id === drinkId);
        if (foundDrink) {
          setCurrentDrink(foundDrink);
          setActiveTab('explore');
        }
      } else if (drinkName && apiDrinks.length > 0) {
        // 兼容旧的分享链接格式
        const decodedName = decodeURIComponent(drinkName);
        const foundDrink = apiDrinks.find(d =>
          d.name === decodedName ||
          d.name_cn === decodedName ||
          d.nameEn === decodedName ||
          d.name.toLowerCase() === decodedName.toLowerCase()
        );

        if (foundDrink) {
          setCurrentDrink(foundDrink);
          setActiveTab('explore');
        }
      }
    };

    if (apiDrinks.length > 0) {
      handleSharedDrink();
    }
  }, [apiDrinks]);

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

  const handleLikeDrink = useCallback(async (drink) => {
    setFavoriteDrinks(prev => {
      if (prev.some(d => d.id === drink.id)) return prev;
      return [...prev, drink];
    });
    favoriteStorage.addFavorite(drink);

    try {
      const userUID = userStorage.getUID();
      const response = await fetch('/api/drink/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          drinkId: drink.id,
          userUID: userUID
        })
      });

      if (response.ok) {
        const data = await response.json();
        setLiveLikeCount(prev => ({
          ...prev,
          [drink.id]: data.count
        }));
        
        setLastLikedDrink(drink);
        
        if (data.count >= 2) {
          setTimeout(() => {
            setShowGroupRecommendation(true);
          }, 500);
        }
        
        showFriendlyNotice(
          '「同饮」',
          '还有 ' + data.count + ' 人，也为这一杯停留',
          'success',
          { label: '好的', onClick: () => closeFriendlyNotice() }
        );
      } else {
        showFriendlyNotice(
          '已将' + drink.name + '加入心仪',
          '网络同步失败，但已保存在本地',
          'warning',
          { label: '好的', onClick: () => closeFriendlyNotice() }
        );
      }
    } catch (error) {
      console.error('Failed to record drink like:', error);
      showFriendlyNotice(
        '已将' + drink.name + '加入心仪',
        '网络同步失败，但已保存在本地',
        'warning',
        { label: '好的', onClick: () => closeFriendlyNotice() }
      );
    }
  }, []);

  const handleUnlikeDrink = useCallback(async (drinkId) => {
    setFavoriteDrinks(prev => prev.filter(d => d.id !== drinkId));
    favoriteStorage.removeFavorite(drinkId);

    // 调用后端 API 取消用户心意
    try {
      const userUID = userStorage.getUID();
      await fetch('/api/drink/unlike', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          drinkId: drinkId,
          userUID: userUID
        })
      });
    } catch (error) {
      console.error('Failed to remove drink like:', error);
    }
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

  // 右滑显示侧边导航栏
  const swipeGesture = useSwipeGesture({
    enabled: !currentDrink && !isFocusMode && !showRecommendationGallery,
    onSwipeRight: () => {
      console.log('右滑 detected, opening side nav');
      setIsSideNavOpen(true);
    },
    threshold: 30,
    resistance: 1.5
  });

  // 原料库页面的右滑手势
  const ingredientLibrarySwipeGesture = useSwipeGesture({
    enabled: showIngredientLibrary,
    onSwipeRight: () => {
      console.log('原料库右滑 detected, opening side nav');
      setIsSideNavOpen(true);
    },
    threshold: 30,
    resistance: 1.5
  });

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

  /**
   * 轻量东方情绪解读，用于 LoadingTransition 文案
   * - 不额外调用 LLM，基于易经/五行/七情做规则化描述
   */
  const buildOrientalLoadingText = useCallback((rawInput, rawSelectedMood) => {
    const input = (rawInput || '').trim();
    const selected = (rawSelectedMood || '').replace(/^#/, '');

    // 特例：平静 + 期待 -> 震卦
    if (input.includes('平静') && input.includes('期待')) {
      return '平而有动，是为「震」象，春木生发，这份期待，是心底新芽将发的预兆。你的心绪，已入杯中。';
    }

    // 东方锚点到五行/脏腑/七情的粗略映射（轻量规则，不求医学严谨）
    const mapping = {
      '早起唤醒': { trigram: '震', wuxing: '木', organ: '肝', emotion: '思', phrase: '春木生发，是身体唤醒的时刻' },
      '午后犯困': { trigram: '坤', wuxing: '土', organ: '脾', emotion: '思', phrase: '大地承载，是身体渴望被托住的时刻' },
      '加班续命': { trigram: '坎', wuxing: '水', organ: '肾', emotion: '恐', phrase: '水气深藏，是精力需要续航的时刻' },
      '下班犒劳': { trigram: '兑', wuxing: '金', organ: '肺', emotion: '喜', phrase: '金气收束，是给自己一份奖赏的时刻' },
      '周末放松': { trigram: '离', wuxing: '火', organ: '心', emotion: '喜', phrase: '火光外扬，是心情彻底打开的时刻' },
      '睡前安抚': { trigram: '艮', wuxing: '土', organ: '脾', emotion: '思', phrase: '山止于前，是身心徐徐安静的时刻' }
    };

    const info = mapping[selected] || null;
    const baseText = input || (selected ? `此刻，是一种「${selected}」的味道。` : '此刻心绪未尽言表。');

    if (!info) {
      return `${baseText} 以易理观之，此刻气机有其自成一象，且让这一杯，替你慢慢调和。`;
    }

    return [
      baseText,
      `${info.phrase}，卦象近「${info.trigram}」，五行属${info.wuxing}，大致归于${info.organ}之气、${info.emotion}之情。`,
      '这一刻的起伏，就让它先入杯中，再缓缓落回心里。'
    ].join(' ');
  }, []);

  const handleStartGeneration = useCallback(async (type = null) => {
    const startTime = performance.now();
    console.log(`[Timer] 0ms: 用户点击按钮，开始寻味流程`);
    
    // 🔥 重置上一次的文案，避免旧数据导致闪烁
    setCustomQuotes({});
    
    setMixMode('generating');
    // 初始玄学式 Loading 文案：先依据当前输入/情绪锚点做一次东方解读

    // 记录干预类型
    if (type) {
      setInterventionType(type);
    }

    const currentInterventionType = type || interventionType;
    const combinedInput = (moodInput + (selectedMood || "")).trim();

    // 输入验证 - 检测特殊输入场景（但允许空输入，因为负面情绪流程有默认值）
    if (combinedInput) {
      const validation = validateInput(combinedInput);
      if (!validation.valid && validation.scene !== 'empty') {
        setMixMode('home');
        showFriendlyNotice(validation.title, validation.message, validation.tone || 'default');
        return;
      }
    }

    // 在验证通过后更新玄学 Loading 文案，作为轮播期的「流态」基准语
    setButtonLoadingText(buildOrientalLoadingText(moodInput, selectedMood));

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

    // 动态文字：阶梯式更新加载文案（保留原有节奏，但更偏东方语境）
    const timers = [];
    setButtonLoadingText(buildOrientalLoadingText(moodInput, selectedMood));

    timers.push(setTimeout(() => setButtonLoadingText('五行气机正在排布，替你调一杯合脏腑之性的酒。'), 3000));
    timers.push(setTimeout(() => setButtonLoadingText('情志在杯壁缓缓升起，别急，让情绪先落地。'), 8000));
    timers.push(setTimeout(() => setButtonLoadingText('木火土金水，各归其位，你的起伏正在被安放。'), 15000));
    timers.push(setTimeout(() => setButtonLoadingText('卦象已成，只待这一杯，从想象落入掌心。'), 25000));

    const clearAllTimers = () => timers.forEach(t => clearTimeout(t));

    try {
      // 检查饮品数据是否已加载
      if (!apiDrinks || apiDrinks.length === 0) {
        clearAllTimers();
        setMixMode('home');
        showFriendlyNotice('酒柜还在整理', '饮品数据尚未准备好，稍候片刻再启程寻味。', 'warning');
        return;
      }

      console.log(`\n🎯 负面情绪干预模式: ${currentInterventionType === 'vent' ? '💥 发泄释放' : '🥰 温柔安抚'}`);

      // 🚀 使用多Agent系统执行推荐流程
      // 合并API饮品和用户自定义饮品（只包含有向量的）
      const customDrinksWithVector = customDrinks.filter(d => d.vector && d.vector.length === 8);
      const allDrinksForPipeline = [...apiDrinks, ...customDrinksWithVector];

      // 🔥 [核心优化] 存储文案Promise，确保卡片出现时文案已就绪
      let quotePromiseResolve;
      const quoteReadyPromise = new Promise(resolve => { quotePromiseResolve = resolve; });

      const agentPromise = executeRecommendationPipeline(finalInputForAI, {
        inventory: sessionIngredients,
        allDrinks: allDrinksForPipeline,
        currentTime: new Date().toISOString(),
        interventionType: currentInterventionType,
        // 🔥 [优化] 核心机制：在预览饮品计算完成后，立即并行触发文案生成
        onVectorSearchSuccess: (matches, contextData) => {
          if (isQuoteFetching.current) return; // 防止在重试逻辑中重复触发
          isQuoteFetching.current = true;

          console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 触发唯一一次异步文案生成`);
          fetchLiveQuotes(matches, contextData, 15).then((quotesMap) => {
            if (Object.keys(quotesMap).length > 0) {
              setCustomQuotes(prev => ({ ...prev, ...quotesMap }));
              console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 异步文案润色完成`);
            }
            quotePromiseResolve(quotesMap); // 通知文案已就绪
          }).catch(err => {
            console.warn('Early live quote generation failed', err);
            quotePromiseResolve({}); // 失败时也要resolve避免卡死
          }).finally(() => {
            isQuoteFetching.current = false;
          });
        },
        onValidationSuccess: (report) => {
          console.log('[App] 异步验证报告送达，更新 UI 勋章');
          setValidationResult(report);
        }
      });

      const agentResult = await agentPromise;

      console.log('多Agent系统执行结果:', agentResult);
      
      // 🔥 [关键] 等待文案就绪后再清除loading并显示卡片
      console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 等待文案就绪...`);
      await Promise.race([
        quoteReadyPromise,
        new Promise(resolve => setTimeout(resolve, 8000)) // 最多等8秒
      ]);
      console.log(`[Timer] ${Math.round(performance.now() - startTime)}ms: 文案就绪，准备显示卡片`);
      
      clearAllTimers();

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
      clearAllTimers();
      setMixMode('home');
      showFriendlyNotice('灵感有些迟疑', '分析网络可能存在波动，请稍后再试。', 'error');
    }
  }, [emotionType, interventionType, moodInput, selectedMood, sessionIngredients, apiDrinks, customDrinks, setRecommendationPool, setCurrentBatchIndex, setCurrentCardIndex, setMixMode, setShowRecommendationGallery, setCustomQuotes, showFriendlyNotice]);

  // 调用后端千问API进行情绪分析和饮品推荐
  const processMoodAndGenerate = useCallback(async (directMoodValue = null) => {
    // Use directMoodValue if provided (from tag click), otherwise use state
    const effectiveMood = directMoodValue !== null ? directMoodValue : selectedMood;
    const combinedInput = (moodInput + (effectiveMood || "")).trim();

    // 如果是东方情绪锚点（标签点击），跳过空输入验证
    const isOrientalTagClick = directMoodValue && ORIENTAL_MOOD_TAGS.some(tag => tag.value === directMoodValue);
    
    // 综合输入验证 - 检测特殊输入场景（东方标签点击跳过空输入检查）
    if (!isOrientalTagClick) {
      const validation = validateInput(combinedInput);
      if (!validation.valid) {
        showFriendlyNotice(validation.title, validation.message, validation.tone || 'default');
        return;
      }
    }


    // 如果有自定义原料，附加到 Prompt
    let finalInputForAI = combinedInput;
    if (sessionIngredients.length > 0) {
      finalInputForAI += `\n(重要参考: 用户目前拥有的原料: ${sessionIngredients.join(', ')})`;
    }

    // 检查是否选中了东方情绪锚点（这些是预设的文学表达，不应被本地负面关键词检测干扰）
    const isOrientalAnchor = ORIENTAL_MOOD_TAGS.some(tag => tag.value === effectiveMood);

    // 首先检查是否为负面情绪（本地快速检测）
    // 注意：东方情绪锚点跳过本地负面检测，让 LLM 来判断情绪属性
    const isNegativeLocal = !isOrientalAnchor && (NEGATIVE_KEYWORDS.some(kw => combinedInput.toLowerCase().includes(kw)) || effectiveMood === '#难受');

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

    // 非负面情绪：设置情绪类型并启动流态分析
    setEmotionType('positive');
    
    // 检查饮品数据是否已加载
    if (!apiDrinks || apiDrinks.length === 0) {
      showFriendlyNotice('酒柜还在整理', '饮品数据尚未准备好，稍候片刻再启程寻味。', 'warning');
      return;
    }

    // 启动流态分析卡片 - StreamingAnalysisCard 会处理分析并回调 handleStreamingComplete
    console.log('[processMoodAndGenerate] 启动流态分析卡片');
    setMixMode('generating');
    // 流态卡片会自动调用 /api/analyze_mood_stream
    // 完成后调用 handleStreamingComplete 继续推荐流程
  }, [moodInput, selectedMood, sessionIngredients, apiDrinks, customDrinks, showFriendlyNotice]);

  /**
   * 流态分析完成后的回调
   * - 接收 moodData，继续执行饮品推荐流程
   */
  const handleStreamingComplete = useCallback(async (resultData) => {
    const startTime = performance.now();
    console.log('[StreamingComplete] 收到原始流式结果:', resultData);
    
    if (!resultData) {
        console.error('[StreamingComplete] 错误：收到空的 resultData');
        return;
    }

    // 1. 结构化解构与兼容性提取
    let moodData = resultData.moodData || (resultData.emotion ? resultData : null);
    let patternAnalysis = resultData.patternAnalysis;
    let summary = resultData.summary || resultData.moodData?.summary || '寻味之旅已开启';

    // 2. 启发式补全逻辑 (Heuristic Repair)
    // 如果后端 32B 模型偶尔还是漏掉了 patternAnalysis，我们根据 moodData 强制合成一个
    if (!patternAnalysis && moodData) {
        console.warn('[StreamingComplete] ⚠️ 检测到 patternAnalysis 缺失，启动前端启发式补全...');
        const userWuxing = moodData.emotion?.philosophy?.wuxing || 'earth';
        patternAnalysis = {
            polarity: { type: 'negative', confidence: 0.5 },
            wuxing: { user: userWuxing === '木' ? 'wood' : userWuxing === '火' ? 'fire' : userWuxing === '水' ? 'water' : userWuxing === '金' ? 'metal' : 'earth' },
            strategy: { type: 'harmonize', logic: '自动补全辨证逻辑' }
        };
    }

    // 🔥 重置上一次的文案，避免旧数据导致闪烁
    setCustomQuotes({});

    try {
      // 检查饮品数据是否已加载
      if (!apiDrinks || apiDrinks.length === 0) {
        setMixMode('home');
        showFriendlyNotice('酒柜还在整理', '饮品数据尚未准备好，稍候片刻再启程寻味。', 'warning');
        return;
      }

      // 合并API饮品和用户自定义饮品
      const customDrinksWithVector = customDrinks.filter(d => d.vector && d.vector.length === 8);
      const allDrinksForPipeline = [...apiDrinks, ...customDrinksWithVector];

      // 使用向量引擎评估和排序饮品
      const rankedDrinks = evaluateAndSortDrinks(moodData, allDrinksForPipeline, sessionIngredients);
      const topMatches = rankedDrinks.slice(0, 9);

      // 🔥 [优化] 先异步获取 LLM 文案，等待完成后再显示卡片
      let quotesMap = {};
      if (topMatches.length > 0) {
        try {
          console.log(`[StreamingComplete] 开始获取文案...`);
          isQuoteFetching.current = true;
          
          // 构造完整上下文，透传给文案引擎和标签引擎
          const contextData = {
            moodData,
            patternAnalysis,
            summary,
            // 如果后端没有返回 vectorResult，某些逻辑可能还需要它，但通常在后端完成
            vectorResult: resultData.vectorResult 
          };
          
          // 创建异步文案获取，传入完整 contextData
          const quotePromise = fetchLiveQuotes(topMatches, contextData, 15);
          
          // 后台监听：无论是否超时，文案返回后都设置到 state
          quotePromise.then((quotes) => {
            if (Object.keys(quotes).length > 0) {
              console.log(`[StreamingComplete] 文案异步到达，更新 UI (${Object.keys(quotes).length} 条)`);
              setCustomQuotes(prev => ({ ...prev, ...quotes }));
            }
          }).catch(err => {
            console.warn('[StreamingComplete] 后台文案获取失败', err);
          }).finally(() => {
            isQuoteFetching.current = false;
          });
          
          // 等待最多 8 秒，超时则先显示画廊（文案会稍后到达）
          quotesMap = await Promise.race([
            quotePromise,
            new Promise(resolve => setTimeout(() => {
              console.log(`[StreamingComplete] 文案获取超时，先显示画廊`);
              resolve({});
            }, 12000))
          ]);
          console.log(`[StreamingComplete] 文案获取完成 (${Object.keys(quotesMap).length} 条)`);
        } catch (err) {
          console.warn('Live quote generation failed', err);
        }
      }

      // 🔥 [关键] 批量设置所有状态，减少重复渲染
      if (Object.keys(quotesMap).length > 0) {
        setCustomQuotes(quotesMap);
      }
      setMoodResult({ moodData, patternAnalysis, summary }); // 关键修复：补全 patternAnalysis
      setRecommendationPool(topMatches.length > 0 ? topMatches : apiDrinks.slice(0, 9));
      setCurrentBatchIndex(0);
      setCurrentCardIndex(0);
      setMixMode('home');
      setShowRecommendationGallery(true);

      console.log(`[StreamingComplete] ${Math.round(performance.now() - startTime)}ms: 推荐完成`);

    } catch (error) {
      console.error('[StreamingComplete] 错误:', error);
      setMixMode('home');
      showFriendlyNotice('灵感有些迟疑', '推荐过程出现问题，请稍后再试。', 'error');
    }
  }, [apiDrinks, customDrinks, sessionIngredients, showFriendlyNotice, setCustomQuotes]);

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
      ref={(el) => {
        mainContentRef.current = el;
        swipeGesture.setElementRef(el);
      }}
      className={`min-h-screen font-sans w-full relative shadow-2xl overflow-x-hidden flex flex-col transition-colors duration-700 ${getBackgroundClass()}`}
      tabIndex={-1}
    >
      <StreamingAnalysisCard
        isActive={mixMode === 'generating'}
        userInput={(moodInput + (selectedMood || '')).trim()}
        onStreamComplete={(moodData) => {
          // 直接继续执行饮品推荐流程（handleStreamingComplete 内部会设置 moodResult）
          handleStreamingComplete(moodData);
        }}
        onError={(error) => {
          setMixMode('home');
          showFriendlyNotice('灵感有些迟疑', '分析网络可能存在波动，请稍后再试。', 'error');
        }}
      />
      <SideNavigation
        isOpen={isSideNavOpen}
        onClose={() => setIsSideNavOpen(false)}
        activeTab={activeTab}
        onTabChange={handleNavClick}
        onOpenIngredientLibrary={() => setShowIngredientLibrary(true)}
      />
      {isSideNavOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={() => setIsSideNavOpen(false)}
        />
      )}

      {/* Menu button to open sidebar */}
      {!isSideNavOpen && activeTab !== 'mine' && !showRecommendationGallery && (
        <button
          onClick={() => setIsSideNavOpen(true)}
          className="fixed top-4 left-4 z-30 p-1 hover:opacity-70 transition-opacity duration-200"
          aria-label="打开菜单"
        >
          <CustomMenuIcon className="w-5 h-5 text-gray-600" />
        </button>
      )}

      <main className="flex-1 flex flex-col w-full relative">
        {activeTab === 'mix' && showRecommendationGallery && visibleDrinks.length > 0 && (
          <RecommendationGallery
            drinks={visibleDrinks}
            onBack={() => {
              setShowRecommendationGallery(false);
              setMixMode('home');
              setSelectedMood(null); // Reset mood tag selection
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
                ingredientCount={ingredientCount}
                onEditIngredients={() => setShowIngredientModal(true)}
                onNavigate={handleNavClick}
                activeTab={activeTab}
                showFriendlyNotice={showFriendlyNotice}
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

        {activeTab === 'community' && !currentDrink && (
          <PageTransition animation="fade" duration={400}>
            <CommunitySection
              onNavigate={handleNavClick}
              activeTab={activeTab}
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

      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={handleCancelDeleteNote}
        onConfirm={handleConfirmDeleteNote}
      />

      {showDrinkHelpModal && (
        <DrinkHelpModal
          drink={drinkHelpTarget}
          onClose={() => {
            setShowDrinkHelpModal(false);
            setDrinkHelpTarget(null);
          }}
        />
      )}

      {showGroupRecommendation && (
        <GroupRecommendationModal
          drink={lastLikedDrink}
          isOpen={showGroupRecommendation}
          onClose={() => setShowGroupRecommendation(false)}
          onJoinGroup={handleJoinGroup}
          onNavigateToCommunity={handleNavigateToCommunity}
        />
      )}

      <FriendlyNoticeModal
        isOpen={friendlyNotice.isOpen}
        title={friendlyNotice.title}
        message={friendlyNotice.message}
        tone={friendlyNotice.tone}
        onClose={closeFriendlyNotice}
        primaryAction={friendlyNotice.primaryAction}
        secondaryAction={friendlyNotice.secondaryAction}
        isLoading={isShareLoading}
      />

      {/* Ingredient Library Fullscreen */}
      {showIngredientLibrary && (
        <div
          ref={(el) => {
            ingredientLibrarySwipeGesture.setElementRef(el);
          }}
          className="fixed inset-0 z-[150] flex flex-col bg-dreamy-gradient w-full h-[100vh] overflow-hidden"
        >
          {/* Redesigned Minimal Header */}
          <div className="flex items-center justify-between px-6 pt-8 pb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  fetchInventory();
                  setShowIngredientLibrary(false);
                  setCurrentDrink(null);
                  setRecommendationPool([]);
                  setShowRecommendationGallery(false);
                  setMixMode('home');
                  setSelectedMood(null);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 text-gray-800 hover:bg-black/10 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-800" style={{ fontFamily: '"Songti SC", serif' }}>原料</h1>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-6 pb-2">
            <IngredientManager
              userInventory={userInventory}
              onUpdate={fetchInventory}
              showCustomForm={showIngredientCustomForm}
              setShowCustomForm={setShowIngredientCustomForm}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} position="center">
      <div className="glass-modal rounded-[2.8rem] p-8 w-[calc(100vw-3rem)] max-sm mx-auto shadow-2xl">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', fontFamily: '"Noto Serif SC", serif', color: '#1a1a1a', letterSpacing: '0.08em' }}>确认删除</h2>
        <p style={{ color: '#4a4a4a', marginBottom: '2rem', fontSize: '0.95rem', fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif', lineHeight: 1.6 }}>确定要删除这条赏味记录吗？此操作无法撤销。</p>
        <div className="flex justify-end space-x-4">
          <InteractiveButton
            variant="glass-secondary"
            onClick={onClose}
            className="px-6 h-11"
          >
            <span>取消</span>
          </InteractiveButton>
          <InteractiveButton
            variant="glass-primary"
            onClick={onConfirm}
            className="px-8 h-11"
            style={{ 
              background: 'linear-gradient(135deg, rgba(200, 80, 70, 0.8) 0%, rgba(180, 60, 50, 0.9))',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white'
            }}
          >
            <span>确认删除</span>
          </InteractiveButton>
        </div>
      </div>
    </Modal>
  );
};

const DakaModal = ({ drink, onClose, onSave }) => {
  const [note, setNote] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [llmCopy, setLlmCopy] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const cardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [shareCardUrl, setShareCardUrl] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (event) => setCustomImage(event.target?.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => setCustomImage('');

  const getShareLink = () => {
    return `${window.location.origin}/share/drink/${drink.id || 'custom'}`;
  };

  const handleSave = async () => {
    if (onSave) {
      onSave({ note, image: customImage });
      onClose();
    }
  };

  const handleShare = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      if (qrCanvasRef.current) {
        const qrCanvas = qrCanvasRef.current.querySelector('canvas');
        if (qrCanvas) {
          setQrCodeDataUrl(qrCanvas.toDataURL('image/png'));
        }
      }

      const prompt = `你是 MoodMix 的文案诗人。请为分享卡片生成一段情绪文案。结合饮品名：${drink.name}，推荐理由：${drink.reason || '无'}。`;
      const agentResult = await executeMixologyTask('SOCIAL_CARD', { drink, prompt });
      
      let poeticalCopy = '岁序更迭，此情可待';
      if (agentResult && agentResult.success && agentResult.data?.copy) {
        poeticalCopy = agentResult.data.copy;
      }
      setLlmCopy(poeticalCopy);

      await new Promise(resolve => setTimeout(resolve, 800));

      if (cardRef.current) {
        const blob = await exportShareCard(cardRef.current);
        const imageUrl = URL.createObjectURL(blob);
        setShareCardUrl(imageUrl);
      }
    } catch (error) {
      console.error('Failed to generate share card:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (shareCardUrl) {
    return (
      <Modal isOpen={true} onClose={onClose} position="center">
        <div className="glass-modal rounded-[2.8rem] p-8 w-[calc(100vw-3rem)] max-w-sm mx-auto text-center shadow-2xl">
          <div className="relative w-full rounded-2xl overflow-hidden mb-6 shadow-2xl border border-white/10">
            <img src={shareCardUrl} alt="Share Card" className="w-full h-auto" />
          </div>
          <div className="flex flex-col gap-3">
            <InteractiveButton
              variant="glass-primary"
              onClick={() => {
                const link = document.createElement('a');
                link.href = shareCardUrl;
                link.download = `MoodMix_${drink.name}.png`;
                link.click();
              }}
              className="w-full h-12"
            >
              <Download size={18} className="mr-2" />
              <span>保存到相册</span>
            </InteractiveButton>
            <InteractiveButton
              variant="glass-secondary"
              onClick={onClose}
              className="w-full h-12"
            >
              <span>返回</span>
            </InteractiveButton>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} position="center">
      <div className="glass-modal rounded-[2.8rem] p-8 w-[calc(100vw-3rem)] max-w-sm mx-auto shadow-2xl">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', fontFamily: '"Noto Serif SC", serif', color: '#1a1a1a', letterSpacing: '0.08em' }}>为 {drink.name} 打卡</h2>

        <div className="flex gap-5 mb-8">
          <div
            className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group glass-panel border-white/20"
            onClick={() => fileInputRef.current?.click()}
          >
            {customImage ? (
              <>
                <img src={customImage} alt="打卡照片" className="w-full h-full object-cover" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${drink.image})`, filter: 'brightness(0.7)' }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                  <Camera size={20} className="text-white/80 mb-0.5" />
                  <span className="text-white/80 text-[10px]">记录此刻</span>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <p style={{ color: 'rgba(0, 0, 0, 0.6)', marginBottom: '0.6rem', fontSize: '0.75rem', fontFamily: '"Songti SC", serif' }}>记录口味、心情或任何想法…</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="glass-input flex-1 p-3 text-sm focus:outline-none placeholder-black/30"
              style={{ minHeight: '5.5rem', resize: 'none', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(0, 0, 0, 0.1)', borderRadius: '1rem', color: '#1a1a1a', fontFamily: '"Songti SC", serif' }}
              placeholder="例如：口感非常清爽，柠檬的酸味很突出…"
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <InteractiveButton
            variant="glass-secondary"
            onClick={onClose}
            className="px-6 h-11"
          >
            <span>取消</span>
          </InteractiveButton>
          <InteractiveButton
            variant="glass-primary"
            onClick={handleSave}
            disabled={isGenerating}
            className="px-8 h-11"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin opacity-70" /> : <span>保存记录</span>}
          </InteractiveButton>
        </div>

        {!shareCardUrl && (
          <div style={{ position: 'fixed', left: '-2000px', top: '0', pointerEvents: 'none', zIndex: -1 }}>
            <div ref={qrCanvasRef} style={{ width: '88px', height: '88px' }}>
              <QRCodeCanvas value={getShareLink()} size={88} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#3a3226" />
            </div>
            <ShareCard
              ref={cardRef}
              drinkName={drink.name}
              emotion={drink.dimensions?.mood || '悠然'}
              wuxing={drink.dimensions?.wuxing ? `五行属${drink.dimensions.wuxing}` : '五行调和'}
              imageSrc={customImage || drink.image}
              llmCopy={llmCopy}
              qrCodeSrc={qrCodeDataUrl}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

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
      const ingredientList = ingredients.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
      const result = await executeMixologyTask('ANALYZE', { name: name.trim(), description: description.trim(), ingredients: ingredientList, isAlcoholic });
      if (!result.success) throw new Error(result.error || '生成失败');
      const analysisData = result.data;
      const drinkData = {
        name: name.trim(),
        description: description.trim(),
        ingredients: ingredientList.map(ing => ({ label: ing, name: ing })),
        isAlcoholic,
        image: image || 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=400&fit=crop',
        vector: analysisData.vector,
        dimensions: analysisData.dimensions,
        abv: isAlcoholic ? (analysisData.vector?.[6] || 15) : 0,
        tags: isAlcoholic ? ['含酒精'] : ['无酒精']
      };
      const savedDrink = customDrinkStorage.addCustomDrink(drinkData);
      setName(''); setDescription(''); setIngredients(''); setIsAlcoholic(false); setImage('');
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
      <div className="glass-modal rounded-[2.8rem] p-8 w-[calc(100vw-3rem)] max-w-md mx-auto shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', fontFamily: '"Noto Serif SC", serif' }}>灵感入壶</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-white/40 hover:text-white/80 transition-colors rounded-full">
            <X size={24} />
          </button>
        </div>
        <p style={{ color: 'rgba(0, 0, 0, 0.6)', marginBottom: '1.5rem', fontSize: '0.875rem', fontFamily: '"Songti SC", serif' }}>一饮一味，皆是灵感</p>

        <div className="oriental-upload-area mb-6 glass-panel border-white/10 overflow-hidden rounded-2xl h-40 flex items-center justify-center bg-white/5 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => fileInputRef.current?.click()}>
          {image ? <img src={image} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center text-white/40"><Camera size={32} className="mx-auto mb-2" /><span>上传图片展示灵感</span></div>}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        <div className="mb-4">
          <label className="glass-label">饮品名称 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：蜜桃乌龙" className="glass-input w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none" />
        </div>

        <div className="mb-4">
          <label className="glass-label">描述与配料</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述一下风味…" className="glass-input w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none h-24 resize-none" />
        </div>

        <div className="mb-6 flex gap-3">
          <button onClick={() => setIsAlcoholic(false)} className={`flex-1 p-2 rounded-xl border transition-all ${!isAlcoholic ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>无酒精</button>
          <button onClick={() => setIsAlcoholic(true)} className={`flex-1 p-2 rounded-xl border transition-all ${isAlcoholic ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>含酒精</button>
        </div>

        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

        <InteractiveButton variant="glass-primary" onClick={handleSubmit} disabled={isLoading || !name.trim()} className="w-full h-12">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <span>保存灵感</span>}
        </InteractiveButton>
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



