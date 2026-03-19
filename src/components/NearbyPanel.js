import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';
import { searchNearbyBars, getUserLocation, reverseGeocode } from '../services/lbsService';
import BarCard from './BarCard';

const BATCH_SIZE = 1;

function generateBarMatchText(moodData, currentDrink) {
  if (currentDrink) {
    const wuxingMap = {
      '木': '木气舒发 · 条达畅饮',
      '火': '火意灼灼 · 热烈微醺',
      '土': '土气厚重 · 醇香入怀',
      '金': '金意收敛 · 清冽如秋',
      '水': '水意沉静 · 金气微收',
    };
    const moodWuxing = moodData?.emotion?.philosophy?.wuxing;
    return {
      drinkName: `推荐尝试 · ${currentDrink.name_cn || currentDrink.name}`,
      reason: currentDrink.quote || '找一家安静的店，让这杯替你说出今天没说完的话',
      wuxing: wuxingMap[moodWuxing] || '随心而至 · 顺意而饮',
    };
  }
  return {
    drinkName: '去附近坐一坐',
    reason: '有时候换个环境，让店里帮你调一杯/泡一杯，也是一种回应情绪的方式',
    wuxing: '随心而至 · 顺意而饮',
  };
}

const NearbyPanel = ({ isOpen, onClose, moodData, currentDrink }) => {
  const [bars, setBars] = useState([]);
  const [batchStart, setBatchStart] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('定位中...');
  const [error, setError] = useState(null);

  const loadBars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await getUserLocation();
      const [results, geoName] = await Promise.all([
        searchNearbyBars(loc.lng, loc.lat),
        reverseGeocode(loc.lng, loc.lat),
      ]);
      setBars(results);
      setLocationName(geoName);
    } catch (e) {
      console.error('[NearbyPanel] Failed to load bars:', e);
      const isPermissionDenied = e?.code === 1;
      setError(isPermissionDenied
        ? '请允许浏览器定位权限后重试'
        : '定位失败，请检查网络后重试');
      setLocationName('未定位');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadBars();
  }, [isOpen, loadBars]);

  useEffect(() => {
    // 每次列表刷新都从第一批开始展示
    setBatchStart(0);
  }, [bars]);

  const matchText = generateBarMatchText(moodData, currentDrink);

  const sortedBars = useMemo(() => {
    const list = Array.isArray(bars) ? [...bars] : [];
    return list.sort((a, b) => {
      const da = Number(a?.distance);
      const db = Number(b?.distance);
      const va = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY;
      const vb = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY;
      return va - vb;
    });
  }, [bars]);

  const selectedBars = useMemo(() => {
    if (!sortedBars.length) return [];
    if (sortedBars.length <= BATCH_SIZE) return sortedBars;

    const next = [
      ...sortedBars.slice(batchStart),
      ...sortedBars.slice(0, Math.max(0, batchStart + BATCH_SIZE - sortedBars.length)),
    ];
    return next.slice(0, BATCH_SIZE);
  }, [sortedBars, batchStart]);

  function nextBatch() {
    if (!sortedBars.length || sortedBars.length <= BATCH_SIZE) return;
    setBatchStart((prev) => (prev + BATCH_SIZE) % sortedBars.length);
  }

  // IMPORTANT: hooks must always be called in the same order.
  // So we only short-circuit rendering after all hooks above.
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-auto nearby-panel-enter"
        style={{
          maxHeight: '78vh',
          background: 'linear-gradient(180deg, #faf8f5 0%, #f5f0ea 100%)',
          borderRadius: '20px 20px 0 0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center px-5 py-3 border-b border-gray-200/60">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <h3
            className="text-[15px] font-semibold text-gray-800 ml-2"
            style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
          >
            附近可以喝
          </h3>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-400">
            <MapPin size={10} />
            {locationName}
          </span>
        </div>

        {/* Mood-matched recommendation */}
        <div
          className="px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(250,243,234,0.9), rgba(245,239,230,0.9))',
          }}
        >
          <div
            className="text-[10px] text-gray-400 mb-1.5 tracking-widest uppercase"
            style={{ letterSpacing: '2px' }}
          >
            基于你此刻的心境推荐
          </div>
          <div
            className="text-base font-semibold text-gray-800 mb-1.5"
            style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
          >
            {matchText.drinkName}
          </div>
          <div className="text-[11px] text-gray-500 leading-relaxed">
            {matchText.reason}
          </div>
          <div
            className="text-[10px] text-gray-300 mt-2"
            style={{ letterSpacing: '2px', fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
          >
            {matchText.wuxing}
          </div>
        </div>

        {/* Bar list */}
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500 font-medium">
              附近饮品
            </div>
            {sortedBars.length > BATCH_SIZE && (
              <button
                type="button"
                onClick={nextBatch}
                className="text-[11px] text-rose-400 px-3 py-1 rounded-full border border-rose-200 hover:bg-rose-50 transition-colors"
              >
                换一家
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-rose-400 rounded-full animate-spin mb-2" />
              <div className="text-xs text-gray-400">正在搜索附近...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">📍</div>
              <div className="text-xs text-gray-400 mb-3">{error}</div>
              <button
                onClick={loadBars}
                className="text-xs text-rose-400 px-4 py-1.5 rounded-full border border-rose-200 hover:bg-rose-50 transition-colors"
              >
                重新定位
              </button>
            </div>
          ) : bars.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              附近 3km 内暂未找到饮品店
            </div>
          ) : (
            <div
              className="flex gap-3 overflow-hidden"
              style={{
                '--bar-card-width': '100%',
                padding: '4px 0 16px',
              }}
            >
              {selectedBars.map((bar) => (
                <BarCard key={bar.id} bar={bar} moodData={moodData} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NearbyPanel;
