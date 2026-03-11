import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { InteractiveButton } from './ui';
import { inventoryStorage } from '../store/localStorageAdapter';
import btnWatercolor from '../assets/btn-watercolor.png';

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

      const response = await fetch('/api/drink-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drink: {
            name: drink.name,
            nameEn: drink.nameEn,
            ingredients: drink.ingredients || []
          },
          question: question.trim(),
          userInventory
        })
      });

      const data = await response.json();

      if (data.success) {
        setAnswer(data.answer);
      } else {
        setError(data.error || '获取建议失败，请稍后再试');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)' }}>
      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(40px) saturate(1.3)', WebkitBackdropFilter: 'blur(40px) saturate(1.3)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)' }} className="rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.1)' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: '"Songti SC","STKaiti","KaiTi",serif', color: '#000000', letterSpacing: '0.1em' }}>制作遇到问题？</h3>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', marginTop: '2px' }}>{drink.name}</p>
          </div>
          <InteractiveButton
            variant="icon"
            onClick={onClose}
            style={{ background: 'rgba(0,0,0,0.05)', width: '36px', height: '36px' }}
          >
            <X size={18} />
          </InteractiveButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick questions */}
          <div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', marginBottom: '0.5rem', fontFamily: '"Songti SC",serif', letterSpacing: '0.06em' }}>快捷问题</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuestion(q.question)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.82rem',
                    fontFamily: '"Songti SC",serif',
                    letterSpacing: '0.04em',
                    transition: 'all 0.25s ease',
                    background: question === q.question
                      ? '#3c3b36'
                      : 'rgba(255,255,255,0.5)',
                    color: question === q.question ? '#ebdfc8' : 'rgba(0, 0, 0, 0.7)',
                    border: question === q.question ? '1px solid #2a2924' : '1px solid rgba(0, 0, 0, 0.15)',
                    cursor: 'pointer',
                    boxShadow: question === q.question ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none'
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question input */}
          <div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', marginBottom: '0.5rem', fontFamily: '"Songti SC",serif', letterSpacing: '0.06em' }}>描述你的问题</p>
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setError('');
              }}
              placeholder="例如：没有青柠汁可以用什么代替？摇酒器没有怎么办？"
              className="oriental-textarea"
              style={{ height: '6rem', background: 'rgba(255,255,255,0.5)', color: '#000000', border: '1px solid rgba(0, 0, 0, 0.15)' }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="oriental-error">
              <p>{error}</p>
            </div>
          )}

          {/* AI Answer */}
          {answer && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '0.75rem', border: '1px solid rgba(0, 0, 0, 0.1)' }}>
              <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.8)', fontWeight: 500, marginBottom: '0.5rem', fontFamily: '"Songti SC",serif', letterSpacing: '0.06em' }}>调酒师建议</p>
              <p style={{ fontSize: '0.85rem', color: '#000000', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: '"Songti SC",serif' }}>{answer}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: 'rgba(168, 134, 230, 0.8)' }} className="animate-spin" />
              <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'rgba(0, 0, 0, 0.65)', fontFamily: '"Songti SC",serif' }}>正在思考…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
          <InteractiveButton
            variant="primary"
            fullWidth
            onClick={handleSubmit}
            disabled={isLoading || !question.trim()}
            style={{
              height: '48px',
              background: isLoading || !question.trim()
                ? 'rgba(0, 0, 0, 0.1)'
                : '#3c3b36',
              opacity: isLoading || !question.trim() ? 0.5 : 1,
              color: isLoading || !question.trim() ? 'rgba(0, 0, 0, 0.4)' : '#ebdfc8',
              border: isLoading || !question.trim() ? '1px solid rgba(0,0,0,0.1)' : '1px solid #2a2924',
              boxShadow: isLoading || !question.trim() ? 'none' : '0 4px 12px rgba(0,0,0,0.3)',
              fontWeight: 600
            }}
          >
            <Send size={18} className="mr-2" />
            获取建议
          </InteractiveButton>
        </div>
      </div>
    </div>
  );
};

export default DrinkHelpModal;
