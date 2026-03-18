import React, { useState, useEffect, useRef } from 'react';

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

      try {
        const response = await fetch('/api/analyze_mood_stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_input: userInput,
            current_time: new Date().toISOString()
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = '';
        let resultData = null;
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });

          let newlineIndex;
          while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
            const line = lineBuffer.slice(0, newlineIndex).trim();
            lineBuffer = lineBuffer.slice(newlineIndex + 1);

            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              // 处理流式文本片段
              if (data.delta) {
                fullText += data.delta;
                
                // --- 启发式解析策略 ---
                let displayText = '';
                
                // 1. 寻找 [RESULT] 标记作为思绪的终点
                const resultIndex = fullText.indexOf('[RESULT]');
                const thoughtIndex = fullText.indexOf('[THOUGHT]');
                
                let textToProcess = fullText;
                
                if (resultIndex !== -1) {
                    // 已到达结果区，取 [THOUGHT] 之后到 [RESULT] 之前的全部内容
                    const start = thoughtIndex !== -1 ? thoughtIndex + 9 : 0;
                    textToProcess = fullText.slice(start, resultIndex);
                }
                
                // 过滤 JSON / 代码块 / 技术性内容，只保留自然语言提示
                const trimmed = textToProcess.trim();

                // 明显是 JSON 或接近 JSON 的结构
                const hasJsonStart = trimmed.startsWith('{') || trimmed.startsWith('[');
                const hasJsonKeyPattern = /"\w+"\s*:/.test(trimmed);

                // 代码块 / markdown 片段（如 ```json { "emotion"...）
                const hasCodeFence = trimmed.startsWith('```') || trimmed.includes('```');
                const hasJsonTag = /```?\s*json/i.test(trimmed);

                // 其它我们明确不希望展示给用户的技术性标记
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
                if (data.error) {
                  throw new Error(data.error);
                }
                resultData = data.data;
                resultDataRef.current = resultData;
                break;
              }
            } catch (e) {
              // Skip parse errors for intermediate chunks
            }
          }

          if (resultData) break;
        }

        // 如果整个流结束仍然没有解析到结构化结果，则视为错误，交给 onError 处理
        if (!resultData) {
          // #region agent log
          fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `log_${Date.now()}_stream_missing_result`,
              runId: 'pre-fix',
              hypothesisId: 'H6',
              location: 'StreamingAnalysisCard.js:startAnalysis',
              message: 'Stream finished without resultData',
              data: {
                hasAccumulatedText: !!fullText && fullText.length > 0
              },
              timestamp: Date.now()
            })
          }).catch(() => {});
          // #endregion agent log

          throw new Error('STREAMING_NO_RESULT');
        }

        clearInterval(statusInterval);
        setPhase('complete');
        setStatusText('心意已达');

        // #region agent log
        fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `log_${Date.now()}_stream_result`,
            runId: 'pre-fix',
            hypothesisId: 'H1',
            location: 'StreamingAnalysisCard.js:startAnalysis',
            message: 'SSE stream finished',
            data: {
              hasResultData: !!resultData,
              hasResultRef: !!resultDataRef.current,
              phaseAfterStream: 'complete'
            },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion agent log

        if (resultData?.summary) {
          setSummaryText(resultData.summary);
        }

        setTimeout(() => {
          // #region agent log
          fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `log_${Date.now()}_stream_callback_check`,
              runId: 'pre-fix',
              hypothesisId: 'H2',
              location: 'StreamingAnalysisCard.js:onStreamCompleteTimeout',
              message: 'Checking and possibly firing onStreamComplete',
              data: {
                hasCallback: !!onStreamCompleteRef.current,
                hasResultRef: !!resultDataRef.current
              },
              timestamp: Date.now()
            })
          }).catch(() => {});
          // #endregion agent log

          if (onStreamCompleteRef.current && resultDataRef.current) {
            onStreamCompleteRef.current(resultDataRef.current);
          }
        }, 800);

      } catch (error) {
        clearInterval(statusInterval);
        if (error.name === 'AbortError') return;
        console.error('[StreamingAnalysisCard] Error:', error);
        setPhase('error');
        setStatusText('灵感有些迟疑…');
        if (onErrorRef.current) onErrorRef.current(error);
      } finally {
        isRunningRef.current = false;
      }
    };

    // #region agent log
    fetch('http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `log_${Date.now()}_stream_render`,
        runId: 'pre-fix',
        hypothesisId: 'H4',
        location: 'StreamingAnalysisCard.js:effect',
        message: 'StreamingAnalysisCard effect triggered',
        data: {
          isActive,
          hasUserInput: !!userInput,
          isAlreadyRunning: isRunningRef.current
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion agent log

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
