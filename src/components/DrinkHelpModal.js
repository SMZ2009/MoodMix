import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { InteractiveButton } from './ui';
import { inventoryStorage } from '../store/localStorageAdapter';

const QUICK_QUESTIONS = [
  { label: '太甜了', question: '这杯酒太甜了，怎么调整？' },
  { label: '太酸了', question: '这杯酒太酸了，怎么调整？' },
  { label: '太烈了', question: '这杯酒太烈了，怎么降低酒精感？' },
  { label: '太淡了', question: '这杯酒味道太淡，怎么调整？' },
  { label: '缺原料', question: '我缺少某种原料，有什么可以替代？' },
  { label: '没工具', question: '我没有专业工具，怎么在家制作？' }
];

const DrinkHelpModal = ({ drink, onClose }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuickQuestion = (q) => {
    setQuestion(q);
    setAnswer('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('请输入你的问题');
      return;
    }

    setIsLoading(true);
    setError('');
    setAnswer('');

    try {
      // 获取用户库存
      const userInventory = inventoryStorage.getAvailableIngredients();
      const { executeMixologyTask } = await import('../agents');

      const result = await executeMixologyTask('ASSIST', {
        drink: {
          name: drink.name,
          nameEn: drink.nameEn,
          ingredients: drink.ingredients || []
        },
        question: question.trim(),
        userInventory
      });

      if (result.success) {
        setAnswer(result.data.answer);
      } else {
        setError(result.userMessage || '获取建议失败，请稍后再试');
      }
    } catch (err) {
      console.error('Drink assistant error:', err);
      setError('网络错误，请检查连接后重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!drink) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="glass-modal rounded-[2.8rem] w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: '"Noto Serif SC", serif', color: '#1a1a1a', letterSpacing: '0.08em' }}>制作遇到问题？</h3>
            <p style={{ fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.65)', marginTop: '4px', fontFamily: '"Songti SC", serif' }}>{drink.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 text-white/80 hover:text-white bg-white/30 hover:bg-white/40 transition-all border border-white/40 shadow-md"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
          {/* Quick questions */}
          <div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.45)', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: '"Songti SC", serif' }}>快捷问题</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuestion(q.question)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all border ${
                    question === q.question
                      ? 'bg-black/10 border-black/20 text-black'
                      : 'bg-white/40 border-black/5 text-black/50 hover:bg-white/60'
                  }`}
                  style={{ fontFamily: '"Songti SC", serif' }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question input */}
          <div className="space-y-3">
            <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.45)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: '"Songti SC", serif' }}>描述你的问题</p>
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setError('');
              }}
              placeholder="例如：没有青柠汁可以用什么代替？摇酒器没有怎么办？"
              className="glass-input w-full p-4 text-sm min-h-[6rem] focus:outline-none placeholder-black/20 resize-none"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(0, 0, 0, 0.1)', borderRadius: '1.25rem', color: '#1a1a1a', fontFamily: '"Songti SC", serif' }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          {/* AI Answer */}
          {answer && (
            <div className="p-5 space-y-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600/80 animate-pulse" />
                <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.5)', fontWeight: 600, fontFamily: '"Songti SC", serif' }}>调酒师建议</p>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#1a1a1a', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>{answer}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
              <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.35)' }}>正在思考方案…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <InteractiveButton
            variant="glass-primary"
            onClick={handleSubmit}
            disabled={isLoading || !question.trim()}
            className="w-full h-14"
          >
            <Send size={18} className="mr-2" />
            <span>获取解答</span>
          </InteractiveButton>
        </div>
      </div>
    </div>
  );
};

export default DrinkHelpModal;
