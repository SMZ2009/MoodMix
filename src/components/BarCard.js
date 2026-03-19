import React, { useEffect, useMemo, useState } from 'react';
import { Wine, Navigation } from 'lucide-react';

const BAR_EMOTIONS_TTL_MS = 24 * 60 * 60 * 1000;

const SERIF = '"Songti SC", "STKaiti", "KaiTi", serif';
const SERIF_BODY = '"Noto Serif SC", "Songti SC", serif';

function safeParseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function getEmotionTag(moodData) {
  return (
    moodData?.summary
    || moodData?.emotion?.physical?.state
    || moodData?.emotion?.philosophy?.wuxing
    || '路过'
  );
}

const BarCard = ({ bar, moodData }) => {
  const barId = bar?.id;
  const [emotions, setEmotions] = useState([]);
  const [hasLeft, setHasLeft] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draftTag, setDraftTag] = useState('');

  const currentTag = useMemo(() => getEmotionTag(moodData), [moodData]);

  useEffect(() => {
    if (!barId) return;

    const now = Date.now();
    const key = `bar_emotions_${barId}`;
    const storedRaw = localStorage.getItem(key) || '[]';
    const stored = safeParseJson(storedRaw, []);
    const valid = Array.isArray(stored)
      ? stored.filter((e) => e?.timestamp && now - e.timestamp < BAR_EMOTIONS_TTL_MS)
      : [];

    setEmotions(valid);
    setHasLeft(valid.length > 0);
    setEditingIndex((prev) => (prev === null ? null : (valid.length > prev ? prev : null)));
  }, [barId]);

  function leaveEmotion() {
    if (!barId || hasLeft) return;

    const now = Date.now();
    const key = `bar_emotions_${barId}`;
    const storedRaw = localStorage.getItem(key) || '[]';
    const stored = safeParseJson(storedRaw, []);
    const prev = Array.isArray(stored) ? stored : [];

    const newEmotion = { tag: currentTag, timestamp: now };
    const updated = [...prev, newEmotion]
      .filter((e) => e?.timestamp && now - e.timestamp < BAR_EMOTIONS_TTL_MS);

    localStorage.setItem(key, JSON.stringify(updated));
    setEmotions(updated);
    setHasLeft(true);
  }

  function persistEmotions(updated) {
    if (!barId) return;
    const now = Date.now();
    const key = `bar_emotions_${barId}`;
    const filtered = Array.isArray(updated)
      ? updated.filter((e) => e?.timestamp && now - e.timestamp < BAR_EMOTIONS_TTL_MS)
      : [];
    localStorage.setItem(key, JSON.stringify(filtered));
    setEmotions(filtered);
    setHasLeft(filtered.length > 0);
  }

  function startEdit(index) {
    if (!Array.isArray(emotions) || !emotions[index]) return;
    setEditingIndex(index);
    setDraftTag(emotions[index]?.tag ?? '');
  }

  function saveEdit() {
    if (editingIndex === null || editingIndex === undefined) return;
    const nextTag = String(draftTag || '').trim();
    if (!nextTag) return;

    const next = emotions.map((e, i) => (i === editingIndex ? { ...e, tag: nextTag } : e));
    persistEmotions(next);
    setEditingIndex(null);
  }

  function deleteEmotion(index) {
    if (!Array.isArray(emotions) || !emotions[index]) return;
    const next = emotions.filter((_, i) => i !== index);
    persistEmotions(next);
    setEditingIndex((prev) => (prev === index ? null : prev));
  }

  function navigateToBar() {
    if (!bar?.location) return;
    const parts = String(bar.location).split(',').map(s => s.trim());
    if (parts.length < 2) return;
    const [lng, lat] = parts;
    window.open(
      `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(bar.name)}&mode=walking`,
      '_blank'
    );
  }

  return (
    <div
      style={{
        minWidth: 'var(--bar-card-width, 100%)',
        maxWidth: 'var(--bar-card-width, 100%)',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.75)',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 酒吧基本信息 */}
      <div style={{ padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(216,180,254,0.25), rgba(216,180,254,0.12))',
              border: '1px solid rgba(216,180,254,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Wine size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: '#2d2416',
                fontFamily: SERIF,
                letterSpacing: '0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {bar?.name}
              </div>
              <div style={{
                fontSize: 11, color: '#9e8e78', marginTop: 3,
                fontFamily: SERIF_BODY,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {bar?.address}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 100,
            color: '#c4463a', background: 'rgba(196,70,58,0.08)',
            border: '1px solid rgba(196,70,58,0.15)',
            whiteSpace: 'nowrap', flexShrink: 0,
            fontFamily: SERIF_BODY, fontWeight: 500,
          }}>
            {bar?.distance}m
          </span>
        </div>
      </div>

      {/* 分隔线 */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '0 18px' }} />

      {/* 此刻的心境 */}
      <div style={{ padding: '14px 18px 16px', flex: 1 }}>
        <div style={{
          fontSize: 10, color: '#b5a48a', marginBottom: 10,
          letterSpacing: '3px', fontFamily: SERIF,
          textTransform: 'uppercase',
        }}>
          此刻的心境
        </div>

        {emotions.length === 0 ? (
          <div style={{
            fontSize: 12, color: '#b5a48a', fontFamily: SERIF_BODY,
            fontStyle: 'italic', lineHeight: 1.6,
          }}>
            还没有人留下心境，成为第一个
          </div>
        ) : (
          <>
            {editingIndex !== null && emotions[editingIndex] ? (
              <div>
                <input
                  type="text"
                  value={draftTag}
                  onChange={(e) => setDraftTag(e.target.value)}
                  placeholder="写下此刻的心境"
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    border: '1px solid rgba(180,160,130,0.35)',
                    padding: '9px 12px',
                    fontSize: 13,
                    fontFamily: SERIF_BODY,
                    outline: 'none',
                    background: 'rgba(255,255,255,0.6)',
                    color: '#2d2416',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={saveEdit}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #c4463a, #d4594e)',
                      color: '#fff',
                      fontSize: 13,
                      fontFamily: SERIF,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '10px 0',
                      letterSpacing: '0.05em',
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(null)}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      border: '1px solid rgba(180,160,130,0.3)',
                      background: 'transparent',
                      color: '#8a7e6b',
                      fontSize: 13,
                      fontFamily: SERIF,
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '10px 0',
                    }}
                  >
                    取消
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { if (editingIndex !== null) deleteEmotion(editingIndex); }}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    borderRadius: 12,
                    border: '1px solid rgba(196,70,58,0.2)',
                    background: 'rgba(196,70,58,0.05)',
                    color: '#c4463a',
                    fontSize: 12,
                    fontFamily: SERIF,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '9px 0',
                    letterSpacing: '0.03em',
                  }}
                >
                  删除这条心境
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-2">
                {emotions.map((e, i) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    onClick={() => startEdit(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') startEdit(i);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      padding: '5px 12px',
                      borderRadius: 100,
                      background: 'rgba(180,160,130,0.12)',
                      border: '1px solid rgba(180,160,130,0.25)',
                      color: '#5c4f3a',
                      fontFamily: SERIF_BODY,
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'text',
                      userSelect: 'none',
                    }}
                    title="点击可编辑，右侧可删除"
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e?.tag}
                    </span>
                    <button
                      type="button"
                      aria-label="删除这条心境"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        deleteEmotion(i);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                        color: '#b5a48a',
                        cursor: 'pointer',
                        fontSize: 15,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div style={{
              fontSize: 10, color: '#b5a48a', marginTop: 6,
              fontFamily: SERIF, letterSpacing: '1px',
            }}>
              {emotions.length} 个同频灵魂此刻在这里
            </div>
          </>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div style={{ display: 'flex', gap: 10, padding: '0 18px 18px' }}>
        <button
          type="button"
          onClick={() => {
            if (hasLeft) { startEdit(0); return; }
            leaveEmotion();
          }}
          style={{
            flex: 1,
            padding: '11px 0',
            borderRadius: 14,
            border: '1px solid rgba(180,160,130,0.35)',
            background: hasLeft ? 'rgba(180,160,130,0.12)' : 'transparent',
            color: hasLeft ? '#5c4f3a' : '#8a7e6b',
            fontSize: 13,
            fontFamily: SERIF,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          {hasLeft ? '编辑心境' : '留个心境'}
        </button>

        <button
          type="button"
          onClick={navigateToBar}
          style={{
            flex: 1,
            padding: '11px 0',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #c4463a, #d4594e)',
            color: '#fff',
            fontSize: 13,
            fontFamily: SERIF,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.05em',
            boxShadow: '0 4px 16px rgba(196,70,58,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <Navigation size={14} />
          导航去
        </button>
      </div>
    </div>
  );
};

export default BarCard;
