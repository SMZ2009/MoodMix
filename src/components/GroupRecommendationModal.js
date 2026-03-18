import React from 'react';
import { X, Users, TrendingUp, Sparkles } from 'lucide-react';
import { recommendGroups } from '../engine/groupRecommendationEngine';
import { InteractiveButton } from './ui';


const GroupRecommendationModal = ({ drink, isOpen, onClose, onJoinGroup, onNavigateToCommunity }) => {
  if (!isOpen || !drink) return null;

  const recommendedGroups = recommendGroups(drink, 3);

  if (recommendedGroups.length === 0) {
    return null;
  }

  const iconMap = {
    Wine: ({ size, className }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M8 21h8M12 21v-7M7 4h10l-1 10H8L7 4z" />
      </svg>
    ),
    Coffee: ({ size, className }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      </svg>
    ),
    Flame: ({ size, className }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
    Droplets: ({ size, className }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.8-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
        <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 0 1-11 4.26" />
      </svg>
    ),
    Palette: ({ size, className }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    )
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="glass-modal rounded-[2.8rem] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <Sparkles size={18} className="text-indigo-300" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: '"Noto Serif SC", serif', color: '#1a1a1a', letterSpacing: '0.08em' }}>寻找同好</h3>
              <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', marginTop: '2px', fontFamily: '"Songti SC", serif' }}>基于 {drink.name} 的独特品味</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 text-white/80 hover:text-white bg-white/30 hover:bg-white/40 transition-all border border-white/40 shadow-md"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 pt-2 space-y-4 overflow-y-auto flex-1">
          {recommendedGroups.map((group, index) => {
            const Icon = iconMap[group.icon];
            return (
              <div
                key={group.id}
                className="relative bg-white/5 rounded-[2rem] p-5 border border-white/10 hover:bg-white/10 transition-all group cursor-default"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-16 h-16 rounded-[1.25rem] bg-gradient-to-br ${group.color} flex items-center justify-center shadow-inner flex-shrink-0 border border-white/10`}>
                    {Icon && <Icon size={32} className="text-white/90" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1a1a1a', fontFamily: '"Noto Serif SC", serif' }}>
                        {group.name}
                      </h4>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-black/5 rounded-full border border-black/10">
                        <TrendingUp size={12} className="text-indigo-600" />
                        <span style={{ fontSize: '0.75rem', color: '#1a1a1a', fontWeight: 600 }}>
                          {group.matchPercentage}%
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'rgba(0, 0, 0, 0.55)', lineHeight: 1.5, marginBottom: '1rem', fontFamily: '"Songti SC", serif' }} className="line-clamp-2">
                      {group.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {group.tags.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-black/5 text-black/40 text-[10px] rounded-lg border border-black/5">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-black/40">
                        <Users size={12} />
                        <span>{group.memberCount} 成员</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-black/40">
                        <div className="w-1.5 h-1.5 bg-emerald-600/60 rounded-full animate-pulse" />
                        <span>{group.onlineCount} 在线</span>
                      </div>
                    </div>
                  </div>
                </div>

                <InteractiveButton
                  variant="glass-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onJoinGroup) onJoinGroup(group);
                    if (onNavigateToCommunity) onNavigateToCommunity(group);
                  }}
                  className="w-full mt-6 h-12"
                >
                  <span>加入此地</span>
                </InteractiveButton>
              </div>
            );
          })}
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={() => {
              if (onNavigateToCommunity) onNavigateToCommunity(null);
              onClose();
            }}
            className="w-full py-4 text-sm text-black/40 hover:text-black/80 font-medium transition-all"
          >
            探索更多微醺社区
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupRecommendationModal;
