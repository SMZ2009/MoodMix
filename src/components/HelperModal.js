import React from 'react';
import { X } from 'lucide-react';
import { useTouchFeedback } from '../hooks/useTouchFeedback';
import { InteractiveButton } from './ui';

const HelperModal = ({ onClose }) => {
  const {
    style: buttonFeedback
  } = useTouchFeedback({
    scale: 0.96,
    duration: 120
  });

  return (
    <div className="bg-white w-full rounded-3xl p-5 shadow-2xl">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-gray-900 font-serif tracking-tight">生活容器对照表</h3>
        <InteractiveButton
          variant="icon"
          onClick={onClose}
          style={{ background: '#F3F4F6', width: '36px', height: '36px' }}
        >
          <X size={18} />
        </InteractiveButton>
      </div>
      <div className="space-y-3">
        {[
          { label: "1 瓶盖", value: "≈ 5ml", icon: "🍼" },
          { label: "1 汤勺", value: "≈ 15ml", icon: "🥄" },
          { label: "1 养乐多瓶", value: "≈ 100ml", icon: "🥤" }
        ].map((item, idx) => (
          <div 
            key={idx} 
            className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100"
            style={buttonFeedback}
          >
            <span className="text-2.5xl mr-3">{item.icon}</span>
            <div className="flex-1 font-bold text-gray-800 text-sm">{item.label}</div>
            <div className="text-lg font-black text-blue-600 font-serif">{item.value}</div>
          </div>
        ))}
      </div>
      <InteractiveButton
        variant="primary"
        fullWidth
        onClick={onClose}
        style={{
          marginTop: '20px',
          height: '48px',
          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)'
        }}
      >
        知道了
      </InteractiveButton>
    </div>
  );
};

export default HelperModal;
