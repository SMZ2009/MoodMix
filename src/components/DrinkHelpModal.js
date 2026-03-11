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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800">制作遇到问题？</h3>
            <p className="text-xs text-gray-400 mt-0.5">{drink.name}</p>
          </div>
          <InteractiveButton
            variant="icon"
            onClick={onClose}
            style={{ background: '#F3F4F6', width: '36px', height: '36px' }}
          >
            <X size={18} />
          </InteractiveButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick questions */}
          <div>
            <p className="text-xs text-gray-500 mb-2">快捷问题</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuestion(q.question)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    question === q.question
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question input */}
          <div>
            <p className="text-xs text-gray-500 mb-2">描述你的问题</p>
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setError('');
              }}
              placeholder="例如：没有青柠汁可以用什么代替？摇酒器没有怎么办？"
              className="w-full h-24 p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* AI Answer */}
          {answer && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
              <p className="text-xs text-purple-500 font-medium mb-2">调酒师建议</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">正在思考...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <InteractiveButton
            variant="primary"
            fullWidth
            onClick={handleSubmit}
            disabled={isLoading || !question.trim()}
            style={{
              height: '48px',
              background: isLoading || !question.trim()
                ? '#D1D5DB'
                : 'linear-gradient(135deg, #A78BFA 0%, #818CF8 100%)',
              opacity: isLoading || !question.trim() ? 0.7 : 1
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
