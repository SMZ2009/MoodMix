import React from 'react';
import { X } from 'lucide-react';
import { InteractiveButton } from './ui';

const HelperModal = ({ onClose }) => {

  return (
    <div className="glass-modal rounded-[2.8rem] p-8 w-full shadow-2xl overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          fontFamily: '"Noto Serif SC", serif',
          color: '#1a1a1a',
          letterSpacing: '0.08em'
        }}>生活容器对照表</h3>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 text-white/80 hover:text-white bg-white/30 hover:bg-white/40 transition-all border border-white/40 shadow-md"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="space-y-4">
        {[
          { label: "1 瓶盖", value: "≈ 5ml", icon: "🍼" },
          { label: "1 汤勺", value: "≈ 15ml", icon: "🥄" },
          { label: "1 养乐多瓶", value: "≈ 100ml", icon: "🥤" }
        ].map((item, idx) => (
          <div
            key={idx}
            className="flex items-center p-4 bg-white/40 border border-black/5 rounded-2xl transition-all hover:bg-white/60"
          >
            <span className="text-2xl mr-4 drop-shadow-lg">{item.icon}</span>
            <div style={{ flex: 1, fontWeight: 500, color: 'rgba(0, 0, 0, 0.7)', fontSize: '0.9rem', fontFamily: '"Songti SC", serif' }}>{item.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.05em', fontFamily: '"Noto Serif SC", serif' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <InteractiveButton
        variant="glass-primary"
        onClick={onClose}
        className="w-full h-14 mt-8"
      >
        <span>我知道了</span>
      </InteractiveButton>
    </div>
  );
};

export default HelperModal;
