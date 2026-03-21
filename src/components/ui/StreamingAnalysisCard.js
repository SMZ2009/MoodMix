import React, { useState, useEffect, useRef } from 'react';
import { calculateWuxingFromBirthday } from '../../engine/profileWuxing';

const IS_DEV = process.env.NODE_ENV === 'development';

/** Parse one SSE line: optional space after "data:", tolerate no space before JSON. */
function parseSseLine(line) {
  const trimmed = line.trim();
  if (!/^data:\s*/i.test(trimmed)) return null;
  const jsonStr = trimmed.replace(/^data:\s*/i, '').trim();
  if (!jsonStr || jsonStr === '[DONE]') return null;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    if (IS_DEV && (jsonStr.length > 200 || /"done"\s*:\s*true/.test(jsonStr))) {
      console.warn('[StreamingAnalysisCard] SSE JSON parse error:', e.message, jsonStr.slice(0, 280));
    }
    return null;
  }
}

const StreamingAnalysisCard = ({ 
  isActive, 
  userInput,
  onStreamComplete,
  onError 
}) => {
  const [phase, setPhase] = useState('init'); // init, analyzing, complete
  const [statusText, setStatusText] = useState('以意入味…');
  const [summaryText, setSummaryText] = useState('');
  const [summaryDisplayText, setSummaryDisplayText] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const abortControllerRef = useRef(null);
  const resultDataRef = useRef(null);
  const isRunningRef = useRef(false);
  const summaryTimerRef = useRef(null);

  // 用 ref 存储回调，避免回调引用变化导致 effect 重新触发
  const onStreamCompleteRef = useRef(onStreamComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => { onStreamCompleteRef.current = onStreamComplete; }, [onStreamComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // 完成阶段对摘要文字做流态打字机输出
  useEffect(() => {
    if (phase !== 'complete' || !summaryText) {
      setSummaryDisplayText('');
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
      return;
    }

    // 从头开始播放打字效果
    setSummaryDisplayText('');
    let index = 0;

    if (summaryTimerRef.current) {
      clearInterval(summaryTimerRef.current);
      summaryTimerRef.current = null;
    }

    summaryTimerRef.current = setInterval(() => {
      index += 1;
      setSummaryDisplayText(summaryText.slice(0, index));
      if (index >= summaryText.length) {
        if (summaryTimerRef.current) {
          clearInterval(summaryTimerRef.current);
          summaryTimerRef.current = null;
        }
      }
    }, 80);

    return () => {
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
    };
  }, [phase, summaryText]);

  useEffect(() => {
    if (!isActive || !userInput) {
      isRunningRef.current = false;
      return;
    }

    // 防止重复触发：如果已经在运行中，跳过
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const startAnalysis = async () => {
      setPhase('init');
      setStatusText('以意入味…');
      setSummaryText('');
      setStreamingText('');
      resultDataRef.current = null;

      await new Promise(resolve => setTimeout(resolve, 400));
      setPhase('analyzing');

      const statusMessages = [
        '心与味，正在相遇…',
        '五行正在推演…',
        '此味将出，稍候片刻…'
      ];
      let msgIndex = 0;
      const statusInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % statusMessages.length;
        setStatusText(statusMessages[msgIndex]);
      }, 3000);

      abortControllerRef.current = new AbortController();

      // Profile injection (deterministic birthday -> birthdayWuxing).
      const STORAGE_KEY_PROFILE = 'moodmix_profile';
      let user_profile = { profileApplied: false, birthdayWuxing: null, birthplace: '', longTermCity: '' };
      try {
        const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
        if (stored) {
          const profile = JSON.parse(stored);
          const birthdayWuxing = calculateWuxingFromBirthday(profile?.birthday);
          user_profile = {
            profileApplied: !!birthdayWuxing,
            birthdayWuxing,
            birthplace: profile?.birthplace || '',
            longTermCity: profile?.longTermCity || profile?.city || ''
          };
        }
      } catch (e) {
        // Keep fallback (no profile) if localStorage is unavailable.
      }

      const runComprehensiveFallback = async () => {
        const r = await fetch('/api/comprehensive_analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_input: userInput,
            current_time: new Date().toISOString(),
            user_profile
          }),
          signal: abortControllerRef.current.signal
        });
        if (!r.ok) {
          throw new Error(`聚合分析失败 (${r.status})`);
        }
        const json = await r.json();
        if (!json.success || !json.data) {
          throw new Error(json.error || '聚合分析返回异常');
        }
        const { moodData, patternAnalysis, vectorResult } = json.data;
        const summary = moodData?.summary || '寻味之旅已开启';
        return { moodData, patternAnalysis, vectorResult, summary };
      };

      const completeAnalysis = (data) => {
        resultDataRef.current = data;
        clearInterval(statusInterval);
        setPhase('complete');
        setStatusText('心意已达');
        const s = data.summary || data.moodData?.summary;
        if (s) setSummaryText(s);
        setTimeout(() => {
          if (onStreamCompleteRef.current && resultDataRef.current) {
            onStreamCompleteRef.current(resultDataRef.current);
          }
        }, 800);
      };

      try {
        const response = await fetch('/api/analyze_mood_stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_input: userInput,
            current_time: new Date().toISOString(),
            user_profile
          }),
          signal: abortControllerRef.current.signal
        });

        if (IS_DEV) {
          fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StreamingAnalysisCard.js:post-fetch',message:'analyze_mood_stream response',data:{status:response.status,ok:response.ok,contentType:response.headers.get('content-type')||''},timestamp:Date.now(),hypothesisId:'H1',runId:'pre-fix'})}).catch(()=>{});
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          if (IS_DEV) {
            let errJsonHint = '';
            try { const j = JSON.parse(errBody); errJsonHint = (j.error || j.message || '').toString().slice(0, 200); } catch (_) {}
            fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StreamingAnalysisCard.js:http-not-ok',message:'non-2xx body',data:{status:response.status,bodySnippet:errBody.slice(0,400),parsedError:errJsonHint},timestamp:Date.now(),hypothesisId:'H1',runId:'pre-fix'})}).catch(()=>{});
          }
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = '';
        let resultData = null;
        let fullText = '';

        const applyStreamPayload = (data) => {
          if (data.delta) {
            fullText += data.delta;

            let displayText = '';
            const resultIndex = fullText.indexOf('[RESULT]');
            const thoughtIndex = fullText.indexOf('[THOUGHT]');
            let textToProcess = fullText;

            if (resultIndex !== -1) {
              const start = thoughtIndex !== -1 ? thoughtIndex + 9 : 0;
              textToProcess = fullText.slice(start, resultIndex);
            }

            const trimmed = textToProcess.trim();
            const hasJsonStart = trimmed.startsWith('{') || trimmed.startsWith('[');
            const hasJsonKeyPattern = /"\w+"\s*:/.test(trimmed);
            const hasCodeFence = trimmed.startsWith('```') || trimmed.includes('```');
            const hasJsonTag = /```?\s*json/i.test(trimmed);
            const hasTechnicalMarker =
              hasJsonStart ||
              hasJsonKeyPattern ||
              hasCodeFence ||
              hasJsonTag ||
              /"emotion"\s*:/.test(trimmed) ||
              /"somatic"\s*:/.test(trimmed);

            if (!hasTechnicalMarker && trimmed.length > 0) {
              displayText = trimmed;
            }
            if (displayText) {
              setStreamingText(displayText);
            }
          }

          if (data.done) {
            if (IS_DEV) {
              fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StreamingAnalysisCard.js:sse-done',message:'terminal SSE frame',data:{hasError:!!data.error,errorStr:(data.error&&String(data.error).slice(0,200))||'',hasData:!!data.data,dataKeys:data.data&&typeof data.data==='object'?Object.keys(data.data).slice(0,12):[]},timestamp:Date.now(),hypothesisId:'H2',runId:'pre-fix'})}).catch(()=>{});
            }
            if (data.error) {
              throw new Error(data.error);
            }
            resultData = data.data;
            resultDataRef.current = resultData;
            return true;
          }
          return false;
        };

        const drainLineBuffer = (includePartialLine) => {
          let newlineIndex;
          while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
            const line = lineBuffer.slice(0, newlineIndex).trim();
            lineBuffer = lineBuffer.slice(newlineIndex + 1);
            const data = parseSseLine(line);
            if (!data) continue;
            if (applyStreamPayload(data)) return true;
          }
          if (includePartialLine && lineBuffer.trim()) {
            const data = parseSseLine(lineBuffer.trim());
            lineBuffer = '';
            if (data && applyStreamPayload(data)) return true;
          }
          return false;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            lineBuffer += decoder.decode(new Uint8Array(), { stream: false });
            if (drainLineBuffer(true)) break;
            break;
          }

          lineBuffer += decoder.decode(value, { stream: true });
          if (drainLineBuffer(false)) break;
        }

        // 服务端若在流内已返回完整 JSON，但终端 SSE 帧丢失时，尝试从全文提取（与 llmProxy finishStream 一致）
        if (!resultData && fullText) {
          try {
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed && (parsed.moodData || parsed.patternAnalysis || parsed.summary)) {
                resultData = parsed;
                resultDataRef.current = resultData;
                if (IS_DEV) {
                  console.warn('[StreamingAnalysisCard] Recovered structured result from fullText fallback');
                }
              }
            }
          } catch (e) {
            if (IS_DEV) {
              console.warn('[StreamingAnalysisCard] fullText JSON fallback failed:', e.message);
            }
          }
        }

        if (!resultData) {
          if (IS_DEV) {
            fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StreamingAnalysisCard.js:no-result',message:'STREAMING_NO_RESULT',data:{fullTextLen:fullText.length,hasResultMarker:fullText.includes('[RESULT]'),fullHead:fullText.slice(0,120)},timestamp:Date.now(),hypothesisId:'H3',runId:'pre-fix'})}).catch(()=>{});
          }
          throw new Error('STREAMING_NO_RESULT');
        }

        completeAnalysis(resultData);

      } catch (error) {
        clearInterval(statusInterval);
        if (error.name === 'AbortError') return;
        try {
          const fb = await runComprehensiveFallback();
          completeAnalysis(fb);
        } catch (fallbackErr) {
          if (IS_DEV) {
            fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StreamingAnalysisCard.js:catch',message:'stream error',data:{name:error.name,message:String(error.message).slice(0,300),fallback:String(fallbackErr.message).slice(0,200)},timestamp:Date.now(),hypothesisId:'H4',runId:'pre-fix'})}).catch(()=>{});
          }
          console.error('[StreamingAnalysisCard] Error:', error, fallbackErr);
          setPhase('error');
          setStatusText('灵感有些迟疑…');
          if (onErrorRef.current) onErrorRef.current(fallbackErr);
        }
      } finally {
        isRunningRef.current = false;
      }
    };


    startAnalysis();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isRunningRef.current = false;
    };
  }, [isActive, userInput]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* 深色背景 */}
      <div className="absolute inset-0 bg-black/95" />
      
      {/* 背景光晕 */}
      <div 
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-30 animate-pulse"
        style={{ background: 'radial-gradient(circle, #4a3728 0%, transparent 70%)' }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] opacity-20 animate-pulse"
        style={{ background: 'radial-gradient(circle, #2d3a4a 0%, transparent 70%)', animationDelay: '1s' }}
      />

      {/* 渐变卡片 */}
      <div 
        className={`relative w-[85vw] max-w-md aspect-[3/4] rounded-[2.5rem] p-8 flex flex-col justify-center
          transition-all duration-700 ease-out
          ${phase === 'init' ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
        `}
        style={{
          background: 'linear-gradient(165deg, rgba(60,55,50,0.95) 0%, rgba(35,32,30,0.98) 40%, rgba(20,18,16,1) 100%)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {/* 卡片内光晕 */}
        <div 
          className="absolute top-0 left-0 w-full h-1/2 rounded-t-[2.5rem] pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}
        />

        {/* 顶部装饰 */}
        <div className="absolute top-6 left-8 right-8 flex justify-between items-center">
          <span 
            className="text-white/20 text-[10px] tracking-[0.3em] uppercase"
            style={{ fontFamily: '"Songti SC", serif' }}
          >
            心境解读
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div 
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  phase === 'analyzing' 
                    ? 'bg-white/60 animate-pulse' 
                    : phase === 'complete' 
                      ? 'bg-emerald-400/80' 
                      : 'bg-white/20'
                }`}
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>

        {/* 中心内容区域 */}
        <div className="relative flex-1 flex items-center justify-center px-2">
          <div className="w-full text-center">
            {/* 加载动画与流式解析 */}
            {(phase === 'init' || phase === 'analyzing') && (
              <div className="flex flex-col items-center gap-6 w-full">
                {/* 动态圆环 */}
                <div className="relative w-16 h-16 shrink-0">
                  <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-2 rounded-full border border-white/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  <div className="absolute inset-4 rounded-full bg-white/5 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-white/30 animate-pulse" />
                  </div>
                </div>

                {/* 流式拆解文本区域 */}
                <div className="w-full min-h-[140px] flex flex-col items-center justify-center px-4">
                  {streamingText ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                      <p
                        className="text-white/80 text-base leading-relaxed tracking-wide italic"
                        style={{ 
                          fontFamily: '"Songti SC", "STKaiti", serif',
                          textShadow: '0 0 10px rgba(255,255,255,0.1)'
                        }}
                      >
                        {streamingText}
                        <span className="inline-block w-1.5 h-4 ml-1 bg-white/40 animate-pulse align-middle" />
                      </p>
                    </div>
                  ) : (
                    <p
                      className="text-white/40 text-sm tracking-widest animate-pulse"
                      style={{ fontFamily: '"Songti SC", serif' }}
                    >
                      {statusText}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 完成状态 - 显示摘要（流态打字） */}
            {phase === 'complete' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {summaryText && (
                  <p
                    className="text-white/80 text-base leading-relaxed tracking-wide"
                    style={{ fontFamily: '"Songti SC", "STKaiti", serif' }}
                  >
                    {summaryDisplayText || summaryText}
                  </p>
                )}
              </div>
            )}

            {/* 错误状态 */}
            {phase === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-white/50 text-sm" style={{ fontFamily: '"Songti SC", serif' }}>
                  {statusText}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部状态 */}
        <div className="absolute bottom-6 left-8 right-8 flex justify-center">
          <span 
            className={`text-[11px] tracking-[0.2em] transition-all duration-500 ${
              phase === 'complete' ? 'text-white/40' : 'text-white/20'
            }`}
            style={{ fontFamily: '"Songti SC", serif' }}
          >
            {(phase === 'init' || phase === 'analyzing' || phase === 'complete') && '缓缓酿成...'}
            {phase === 'error' && '请稍后再试'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StreamingAnalysisCard;
