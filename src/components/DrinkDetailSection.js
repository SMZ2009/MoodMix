import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  ChevronLeft,
  Droplets,
  Flame,
  GlassWater,
  Heart,
  HelpCircle,
  Lightbulb,
  Loader2,
  Martini,
  Share2,
  ThermometerSnowflake,
  Users,
  Wine,
} from 'lucide-react';

import { InteractiveButton } from './ui';
import { executeMixologyTask } from '../agents';
import { generatePhilosophyTags } from '../engine/philosophyTags';
import { translateDrinkName, translateIngredient } from '../data/translations';

import { ShareCard, exportShareCard } from '../App';

const iconMap = {
  Wine,
  Droplets,
  ThermometerSnowflake,
  GlassWater,
  Flame,
};

function toShareCardImageSrc(rawSrc) {
  if (!rawSrc || typeof rawSrc !== 'string') return rawSrc;
  const trimmed = rawSrc.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.origin === window.location.origin) return url.toString();
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const host = url.hostname.toLowerCase();
      const isSafePublicImageHost = host.endsWith('thecocktaildb.com');

      if (!isSafePublicImageHost) {
        return `/api/image-proxy?url=${encodeURIComponent(url.toString())}`;
      }

      return url.toString();
    }
  } catch (e) {
    // Ignore parsing errors; fall through to original src
  }

  return trimmed;
}


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

const DrinkDetailSection = ({
  drink,
  checkedIngredients,
  onToggleIngredient,
  onBack,
  onMore,
  onFocusMode,
  currentStep,
  cardFeedback,
  isLiked,
  onLikeDrink,
  isDaka,
  onDakaDrink,
  onHelp,
  moodResult,
}) => {
  const philosophy = generatePhilosophyTags(drink.dimensions, moodResult, drink.name);
  const diagnosisTag = philosophy?.tags?.[0] || drink.dimensions?.mood || '气机待调';
  const strategyTag =
    philosophy?.tags?.[1] || (drink.dimensions?.wuxing ? `五行属${drink.dimensions.wuxing}` : '调和气机');

  const [shareCardUrl, setShareCardUrl] = useState(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [llmCopy, setLlmCopy] = useState('');
  const [overrideEmotionTag, setOverrideEmotionTag] = useState(null);
  const [overrideSceneTag, setOverrideSceneTag] = useState(null);
  const [isShareEditorOpen, setIsShareEditorOpen] = useState(false);
  const shareCopy =
    llmCopy && llmCopy.trim()
      ? llmCopy
      : philosophy?.quote || '「请先描述你此刻的心情，让我为你找到那杯对的酒」';
  const cardRef = useRef(null);

  // Share card style editor state
  const [cardGradientTop, setCardGradientTop] = useState('#F5F0E8');
  const [cardGradientBottom, setCardGradientBottom] = useState('#E8D4C8');

  // Helper to determine if gradient is dark
  const getLuminance = (hex) => {
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    let rgb = parseInt(c, 16);
    let r = (rgb >> 16) & 0xff;
    let g = (rgb >> 8) & 0xff;
    let b = (rgb >> 0) & 0xff;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lumTop = getLuminance(cardGradientTop);
  const lumBottom = getLuminance(cardGradientBottom);
  const isDarkBg = ((lumTop + lumBottom) / 2) < 128;
  const customTextColor = isDarkBg ? '#E8E0D4' : '#3a3226';
  const customBg = `linear-gradient(160deg, ${cardGradientTop} 0%, ${cardGradientBottom} 100%)`;

  if (!drink) return null;

  const drinkIngredients = drink.ingredients || [];
  const drinkSteps = drink.steps || [{ title: '第一步', desc: drink.reason || '开始享用' }];

  // 生成分享链接
  const getShareLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}?drink_id=${drink.id}`;
  };

  const buildFallbackNoMoodTags = () => {
    const abv = typeof drink.abv === 'number' ? drink.abv : null;
    let tagEmotion = '随心一杯';
    let tagScene = '此刻刚刚好';

    if (abv === null) {
      return { tagEmotion, tagScene };
    }

    if (abv === 0) {
      tagEmotion = '清醒不醉';
      tagScene = '午后小憩';
    } else if (abv <= 8) {
      tagEmotion = '微醺柔软';
      tagScene = '下班后小酌';
    } else if (abv <= 20) {
      tagEmotion = '慢火续暖';
      tagScene = '周末放空';
    } else {
      tagEmotion = '深夜烈星';
      tagScene = '收尾一杯';
    }

    return { tagEmotion, tagScene };
  };

  const prepareShareEditor = async () => {
    setIsGeneratingShare(true);
    try {
      let poeticalCopy = '岁序更迭，此情可待';

      // 1. 获取 LLM 文案 / 标签
      if (!moodResult) {
        const agentResult = await executeMixologyTask('SOCIAL_CARD_NO_MOOD', { drink });

        if (agentResult) {
          const payload = agentResult.data || agentResult;
          const { copy, tagEmotion, tagScene } = payload || {};

          if (typeof copy === 'string' && copy.trim()) {
            poeticalCopy = copy.trim();
          }

          const hasTags = !!(tagEmotion || tagScene);
          if (hasTags) {
            setOverrideEmotionTag(tagEmotion || null);
            setOverrideSceneTag(tagScene || null);
          } else {
            const fallback = buildFallbackNoMoodTags();
            setOverrideEmotionTag(fallback.tagEmotion);
            setOverrideSceneTag(fallback.tagScene);
          }
        } else {
          const fallback = buildFallbackNoMoodTags();
          setOverrideEmotionTag(fallback.tagEmotion);
          setOverrideSceneTag(fallback.tagScene);
        }
      } else {
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

        const agentResult = await executeMixologyTask('SOCIAL_CARD', { drink, prompt });

        const payload = agentResult && (agentResult.data || agentResult);

        if (payload && typeof payload.copy === 'string') {
          poeticalCopy = payload.copy;
        } else if (typeof agentResult === 'string') {
          poeticalCopy = agentResult;
        }
      }

      setLlmCopy(poeticalCopy);

      // Wait for React to re-render ShareCard with updated copy.
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error('Failed to prepare share card editor:', error);
      alert('生成分享卡片文案失败，请稍后重试');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const openShareEditor = async () => {
    // Open editor first so the UI appears immediately.
    setIsShareEditorOpen(true);
    // Avoid re-calling LLM if already prepared.
    if (llmCopy && llmCopy.trim()) return;
    await prepareShareEditor();
  };

  const handleSaveCard = async () => {
    if (!cardRef.current) return;
    setIsGeneratingShare(true);
    try {
      const blob = await exportShareCard(cardRef.current);
      const imageUrl = URL.createObjectURL(blob);
      setShareCardUrl(imageUrl);
    } catch (error) {
      console.error('Failed to export share card:', error);
      alert('保存分享卡片失败，请稍后重试');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;

    try {
      // 直接使用 html2canvas 生成 canvas
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#faf8f5',
        useCORS: true,
        logging: false,
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
    return `第${map[idx] || idx + 1}步`;
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
            onClick={openShareEditor}
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* 上部：左右布局容器 */}
        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 lg:items-start mb-5 sm:mb-7">
          {/* 左侧：名称与原料 (Flex-1) */}
          <div className="flex-1 order-2 lg:order-1">
            {/* 标题区域 */}
            <div className="mb-5 sm:mb-6">
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-3">
                <h1 className="text-[1.75rem] sm:text-[2.25rem] oriental-title-large">
                  {drink.name_cn || translateDrinkName(drink.name) || drink.name}
                </h1>
                {drink.nameEn && drink.nameEn !== drink.name && (
                  <span className="text-[14px] text-gray-400 font-serif italic tracking-wider opacity-60">
                    / {drink.nameEn}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4 sm:mb-5">
                {drink.abv > 0 && (
                  <div
                    className="px-3.5 py-1.5 rounded-full flex items-center gap-1.5"
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '0.5px solid rgba(59, 130, 246, 0.15)',
                    }}
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
                <div className="relative mb-5 sm:mb-6 pl-3 sm:pl-4 border-l-2 border-gray-200">
                  <p
                    className="text-[14px] sm:text-[15px] text-gray-600 leading-[1.7] sm:leading-[1.8] font-serif italic opacity-90"
                    style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif" }}
                  >
                    {drink.reason}
                  </p>
                </div>
              )}
            </div>

            {/* 原料清单 */}
            <div className="bg-white/40 backdrop-blur-sm rounded-[1.75rem] sm:rounded-[2rem] p-4 sm:p-5 border border-white/60">
              <div className="flex justify-between items-end mb-4 sm:mb-5">
                <h3
                  className="text-[18px] font-bold text-gray-900 tracking-[0.1em]"
                  style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif" }}
                >
                  原料清单
                </h3>
                <span className="text-[11px] text-gray-400 bg-gray-50/80 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  <Users size={12} /> 一人份量
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2.5 sm:gap-3">
                {drinkIngredients.map((ing) => {
                  const IngredientIcon = iconMap[ing.icon] || Wine;
                  const isChecked = checkedIngredients[ing.id];

                  return (
                    <div
                      key={ing.id}
                      className={`flex items-center justify-between p-3.5 sm:p-4 rounded-[1.1rem] sm:rounded-[1.25rem] transition-all duration-500 soft-ingredient-pill ${
                        isChecked ? 'is-checked scale-[0.98]' : ''
                      }`}
                      onClick={() => onToggleIngredient(ing.id)}
                      style={cardFeedback}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center text-blue-500/80 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                          <IngredientIcon size={18} strokeWidth={1.5} />
                        </div>
                        <span
                          className="text-[14px] sm:text-[15px] font-bold text-gray-800"
                          style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif" }}
                        >
                          {translateIngredient(ing.name)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[15px] sm:text-[16px] font-extrabold text-gray-900 font-serif">{ing.amount}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter -mt-1">{ing.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：饮品图片 (Fixed/Custom Width) */}
          <div className="w-full lg:w-[380px] xl:w-[440px] order-1 lg:order-2">
            <div className="sticky top-20">
              <div className="relative aspect-[1.08/1] sm:aspect-square lg:aspect-[4/5] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl group">
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
        <div className="mt-3 sm:mt-4 border-t border-gray-100 pt-5 sm:pt-6">
          <h3
            className="text-[18px] font-bold text-gray-900 mb-4 sm:mb-5 tracking-[0.1em]"
            style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'Source Han Serif SC', serif" }}
          >
            制作步骤
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 sm:gap-x-10 gap-y-6 sm:gap-y-8">
            {drinkSteps.map((step, idx) => (
              <div key={idx} className="flex gap-4 group">
                <div className="flex flex-col items-center flex-none">
                  <div className="w-8 h-8 rounded-full bg-[#3c3b36] text-[#ebdfc8] flex items-center justify-center font-bold text-sm shadow-lg">
                    {idx + 1}
                  </div>
                  {idx !== drinkSteps.length - 1 && (
                    <div className="hidden md:block w-px h-full bg-gradient-to-b from-[#3c3b36] to-transparent opacity-20 mt-2" />
                  )}
                </div>
                <div className="flex-1">
                  {drinkSteps.length > 1 && (
                    <h4
                      className="text-[15px] font-black text-gray-900 mb-1.5 tracking-wider"
                      style={{ fontFamily: "'Noto Serif SC', 'STSongti-SC', 'Songti SC', 'STKaiti', 'Source Han Serif SC', serif" }}
                    >
                      {getChineseStep(idx)}
                    </h4>
                  )}
                  <p className="text-[13px] sm:text-[14px] text-gray-500 leading-[1.65] sm:leading-[1.75] font-medium opacity-85">
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
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onClick={() => {
            setShareCardUrl(null);
            setIsShareEditorOpen(false);
          }}
        >
          <img
            src={shareCardUrl}
            alt="Share Card"
            className="w-full max-w-[400px] h-auto object-contain rounded-2xl shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 分享卡片样式自定义弹窗 */}
      {isShareEditorOpen && !shareCardUrl && (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center px-4"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onClick={() => setIsShareEditorOpen(false)}
        >
          <div
            className="glass-modal rounded-[2rem] p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: '16px', fontWeight: 800, color: '#1a1a1a', letterSpacing: '0.08em' }}>
                  分享卡片
                </div>
                
                {/* 自定义渐变背景放到标题旁边 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <span style={{ fontSize: '11px', color: '#5c5446', fontWeight: 600 }}>背景色</span>
                  <div style={{ width: '1px', height: '10px', background: 'rgba(0,0,0,0.1)' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label htmlFor="gradient-top" style={{ fontSize: '11px', color: '#8a7e6b', cursor: 'pointer' }}>上</label>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: cardGradientTop,
                      border: '1px solid rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <input
                        id="gradient-top"
                        type="color"
                        value={cardGradientTop}
                        onChange={(e) => setCardGradientTop(e.target.value)}
                        style={{
                          opacity: 0,
                          width: '150%',
                          height: '150%',
                          position: 'absolute',
                          top: '-25%',
                          left: '-25%',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label htmlFor="gradient-bottom" style={{ fontSize: '11px', color: '#8a7e6b', cursor: 'pointer' }}>下</label>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: cardGradientBottom,
                      border: '1px solid rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <input
                        id="gradient-bottom"
                        type="color"
                        value={cardGradientBottom}
                        onChange={(e) => setCardGradientBottom(e.target.value)}
                        style={{
                          opacity: 0,
                          width: '150%',
                          height: '150%',
                          position: 'absolute',
                          top: '-25%',
                          left: '-25%',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setIsShareEditorOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9999,
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.4)',
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '280px', height: '498px', margin: '0 auto', overflow: 'hidden' }}>
              <div style={{ transform: 'scale(0.78)', transformOrigin: 'top center', width: '360px', height: '640px' }}>
                <ShareCard
                  ref={cardRef}
                  drinkName={drink.name}
                  emotion={overrideEmotionTag || diagnosisTag}
                  wuxing={overrideSceneTag || strategyTag}
                  imageSrc={toShareCardImageSrc(drink.image)}
                  llmCopy={shareCopy}
                  shareUrl={getShareLink()}
                  customBg={customBg}
                  customTextColor={customTextColor}
                  isDarkBg={isDarkBg}
                  editorCompact={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrinkDetailSection;

