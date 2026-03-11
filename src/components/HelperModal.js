import React from 'react';
import { X } from 'lucide-react';
import { InteractiveButton } from './ui';
import btnWatercolor from '../assets/btn-watercolor.png';

const HelperModal = ({ onClose }) => {

  return (
    <div style={{
      width: '100%',
      borderRadius: '1.5rem',
      padding: '1.25rem',
      background: 'rgba(255, 255, 255, 0.78)',
      backdropFilter: 'blur(40px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
      border: '1px solid rgba(255, 255, 255, 0.5)'
    }}>
      <div className="flex justify-between items-center mb-5">
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
          color: '#000000',
          letterSpacing: '0.1em'
        }}>生活容器对照表</h3>
        <InteractiveButton
          variant="icon"
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.05)', width: '36px', height: '36px' }}
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
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.45)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '0.75rem'
            }}
          >
            <span className="text-2.5xl mr-3">{item.icon}</span>
            <div style={{ flex: 1, fontWeight: 700, color: '#000000', fontSize: '0.875rem' }}>{item.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000000', fontFamily: 'serif' }}>{item.value}</div>
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
          background: '#3c3b36',
          border: '1px solid #2a2924',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          color: '#ebdfc8',
          fontWeight: 600
        }}
      >
        知道了
      </InteractiveButton>
    </div>
  );
};

export default HelperModal;
