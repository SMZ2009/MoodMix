import React from 'react';
import { X } from 'lucide-react';
import { InteractiveButton } from './ui';

const HelperModal = ({ onClose }) => {

  return (
    <div style={{
      width: '100%',
      borderRadius: '1.5rem',
      padding: '1.25rem',
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(40px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(40px) saturate(1.2)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2)',
      border: '1px solid rgba(255, 255, 255, 0.15)'
    }}>
      <div className="flex justify-between items-center mb-5">
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
          color: 'rgba(42, 40, 38, 0.88)',
          letterSpacing: '0.1em',
          textShadow: '0 1px 2px rgba(255,255,255,0.3)'
        }}>生活容器对照表</h3>
        <InteractiveButton
          variant="icon"
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', width: '36px', height: '36px' }}
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
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.75rem'
            }}
          >
            <span className="text-2.5xl mr-3">{item.icon}</span>
            <div style={{ flex: 1, fontWeight: 700, color: 'rgba(42,40,38,0.8)', fontSize: '0.875rem' }}>{item.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'rgba(100, 130, 180, 0.85)', fontFamily: 'serif' }}>{item.value}</div>
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
          background: 'linear-gradient(135deg, rgba(148, 120, 72, 0.8) 0%, rgba(128, 108, 72, 0.75) 40%, rgba(108, 124, 112, 0.7) 100%)'
        }}
      >
        知道了
      </InteractiveButton>
    </div>
  );
};

export default HelperModal;
