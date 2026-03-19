import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { getUserLocation, searchNearbyBars } from '../services/lbsService';

const STORAGE_KEY = 'nearbyBtn_pos';
const DEFAULT_POS = { right: 20, bottom: 140 };

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

const NearbyButton = ({ onOpen }) => {
  const [nearbyCount, setNearbyCount] = useState(null);
  const [visible, setVisible] = useState(false);

  // Position stored as { x, y } from top-left of viewport
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch (_) {}
    return null; // null = use default bottom-right anchor
  });

  const dragState = useRef(null); // { startX, startY, startPosX, startPosY }
  const btnRef = useRef(null);
  const isDragging = useRef(false);
  const dragMoved = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 1200);

    async function preload() {
      try {
        const location = await getUserLocation();
        const bars = await searchNearbyBars(location.lng, location.lat);
        if (cancelled) return;
        setNearbyCount(bars.length);
      } catch (e) {
        console.warn('[NearbyButton] LBS preload skipped:', e.message);
      } finally {
        if (!cancelled) setVisible(true);
      }
    }
    preload();
    return () => { cancelled = true; clearTimeout(showTimer); };
  }, []);

  const getInitialPos = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const btnW = btnRef.current?.offsetWidth || 180;
    const btnH = btnRef.current?.offsetHeight || 48;
    return {
      x: w - DEFAULT_POS.right - btnW,
      y: h - DEFAULT_POS.bottom - btnH,
    };
  }, []);

  const savePos = useCallback((p) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (_) {}
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragMoved.current = false;

    const currentPos = pos || getInitialPos();
    dragState.current = {
      startClientX: e.clientX ?? e.touches?.[0]?.clientX,
      startClientY: e.clientY ?? e.touches?.[0]?.clientY,
      startPosX: currentPos.x,
      startPosY: currentPos.y,
    };

    btnRef.current?.setPointerCapture?.(e.pointerId);
  }, [pos, getInitialPos]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current || !dragState.current) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const dx = clientX - dragState.current.startClientX;
    const dy = clientY - dragState.current.startClientY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.current = true;
    if (!dragMoved.current) return;

    const btnW = btnRef.current?.offsetWidth || 180;
    const btnH = btnRef.current?.offsetHeight || 48;
    const newX = clamp(dragState.current.startPosX + dx, 8, window.innerWidth - btnW - 8);
    const newY = clamp(dragState.current.startPosY + dy, 8, window.innerHeight - btnH - 8);
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (dragMoved.current) {
      // Snap to nearest horizontal edge
      const btnW = btnRef.current?.offsetWidth || 180;
      const mid = window.innerWidth / 2;
      const currentPos = pos || getInitialPos();
      const snappedX = currentPos.x + btnW / 2 < mid
        ? 12
        : window.innerWidth - btnW - 12;
      const snapped = { x: snappedX, y: currentPos.y };
      setPos(snapped);
      savePos(snapped);
    } else {
      // Treat as tap → open panel
      onOpen?.();
    }
    dragState.current = null;
  }, [pos, getInitialPos, savePos, onOpen]);

  if (!visible) return null;

  const hasData = nearbyCount !== null && nearbyCount > 0;
  const resolvedPos = pos || getInitialPos();

  return (
    <div
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="fixed z-[100] flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/60 animate-in fade-in slide-in-from-bottom select-none"
      style={{
        left: resolvedPos.x,
        top: resolvedPos.y,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        transition: isDragging.current ? 'none' : 'left 0.25s cubic-bezier(0.34,1.56,0.64,1), top 0.1s ease',
      }}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-rose-500 to-orange-400 shadow-sm pointer-events-none">
        <MapPin size={14} className="text-white" />
      </div>
      <div className="text-left pointer-events-none">
        <div
          className="text-[13px] font-medium text-gray-800 leading-tight"
          style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
        >
          附近可以喝
        </div>
        {hasData && (
          <div className="text-[10px] text-gray-400 leading-tight">
            3km 内有 {nearbyCount} 家店
          </div>
        )}
      </div>
      <span className="text-gray-300 text-lg ml-1 pointer-events-none">›</span>
    </div>
  );
};

export default NearbyButton;
