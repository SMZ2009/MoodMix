import React from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { InteractiveButton } from './ui';

const FocusModeView = ({ drink, currentStep, onNext, onPrevious, onComplete }) => {
  if (!drink || !drink.steps[currentStep]) return null;

  return (
    <div 
      className="fixed inset-0 z-[110] bg-white flex flex-col p-6 animate-in slide-in-from-right duration-400 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="专注模式"
    >
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-bold tracking-widest text-gray-400 uppercase">Focus Mode</span>
        </div>
        <InteractiveButton
          variant="icon"
          onClick={onComplete}
          style={{ background: '#F3F4F6' }}
        >
          <X size={20} />
        </InteractiveButton>
      </div>
      
      <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-2">
        <div className="mb-3 text-6xl font-black text-gray-100 italic">STEP 0{currentStep + 1}</div>
        <h2 className="text-4xl font-black text-gray-900 mb-6 leading-[1.1] tracking-tight">
          <span className="text-blue-500">{drink.steps[currentStep].title}</span>
          <br />
          <span className="text-xl text-gray-400 mt-2 block leading-relaxed">{drink.steps[currentStep].desc}</span>
        </h2>
        
        <div className="flex gap-3 mt-10">
          {currentStep > 0 && (
            <InteractiveButton
              variant="secondary"
              onClick={onPrevious}
              style={{ flex: 1, height: '52px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <ChevronLeft size={18} /> 上一步
            </InteractiveButton>
          )}
          <InteractiveButton
            variant="primary"
            onClick={() => currentStep < drink.steps.length - 1 ? onNext() : onComplete()}
            style={{
              flex: currentStep > 0 ? 1.5 : 2,
              height: '52px',
              background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            {currentStep === drink.steps.length - 1 ? '完成制作' : '下一步'}
          </InteractiveButton>
        </div>
        
        <div style={{ marginTop: '24px' }}>
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            justifyContent: 'center',
            opacity: 0.6
          }}>
            {drink.steps.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: idx === currentStep ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: idx === currentStep ? '#1F2937' : '#E5E7EB',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusModeView;
