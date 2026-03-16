import React, { useState, useEffect, useRef } from 'react';

const StreamingAnalysisCard = ({ 
  isActive, 
  userInput,
  onStreamComplete,
  onError 
}) => {
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState('init'); // init, streaming, complete
  const abortControllerRef = useRef(null);
  const resultDataRef = useRef(null);

  useEffect(() => {
    if (!isActive || !userInput) return;

    const startStreaming = async () => {
      setPhase('init');
      setStreamedText('');
      setIsStreaming(true);
      resultDataRef.current = null;

      // 短暂延迟后开始，让卡片动画完成
      await new Promise(resolve => setTimeout(resolve, 400));
      setPhase('streaming');

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

              if (data.done) {
                if (data.error) {
                  throw new Error(data.error);
                }
                resultData = data.data;
                resultDataRef.current = resultData;
                break;
              } else if (data.delta) {
                setStreamedText(prev => prev + data.delta);
              }
            } catch (e) {
              // Skip parse errors for intermediate chunks
            }
          }

          if (resultData) break;
        }

        setPhase('complete');
        setIsStreaming(false);

        // 完成后短暂展示，然后回调
        setTimeout(() => {
          if (onStreamComplete && resultDataRef.current) {
            onStreamComplete(resultDataRef.current);
          }
        }, 1000);

      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('[StreamingAnalysisCard] Error:', error);
        setIsStreaming(false);
        setPhase('error');
        if (onError) onError(error);
      }
    };

    startStreaming();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isActive, userInput, onStreamComplete, onError]);

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
            心绪解读
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div 
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  phase === 'streaming' 
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

        {/* 流态文字区域 */}
        <div className="relative flex-1 flex items-center justify-center px-2">
          <div className="w-full">
            {phase === 'init' && (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/5 animate-ping" />
                </div>
                <span 
                  className="text-white/30 text-sm tracking-widest"
                  style={{ fontFamily: '"Songti SC", serif' }}
                >
                  以意入味…
                </span>
              </div>
            )}

            {(phase === 'streaming' || phase === 'complete') && (
              <p
                className="text-white/85 text-[17px] sm:text-lg leading-[2] tracking-wide text-center"
                style={{ 
                  fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                  textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                }}
              >
                {streamedText}
                {isStreaming && (
                  <span className="inline-block w-[2px] h-[1.1em] bg-white/60 ml-1 animate-pulse align-middle" />
                )}
              </p>
            )}

            {phase === 'error' && (
              <div className="text-center">
                <p className="text-white/50 text-sm" style={{ fontFamily: '"Songti SC", serif' }}>
                  灵感暂时迷路了…
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
            {phase === 'init' && '正在感知…'}
            {phase === 'streaming' && '缓缓酿成…'}
            {phase === 'complete' && '心意已达'}
            {phase === 'error' && '请稍后再试'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StreamingAnalysisCard;
