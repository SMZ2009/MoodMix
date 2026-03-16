import React from 'react';
import { X, Users, TrendingUp, Sparkles } from 'lucide-react';
import { recommendGroups } from '../engine/groupRecommendationEngine';

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">为你推荐</h3>
              <p className="text-xs text-gray-500">基于 {drink.name} 的风格</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {recommendedGroups.map((group, index) => {
            const Icon = iconMap[group.icon];
            return (
              <div
                key={group.id}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-100 hover:shadow-lg transition-all duration-300 cursor-pointer group-hover:scale-[1.02]"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${group.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    {Icon && <Icon size={28} className="text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-gray-800 text-base">
                        {group.name}
                      </h4>
                      <div className="flex items-center gap-1 bg-purple-100 px-2 py-0.5 rounded-full">
                        <TrendingUp size={12} className="text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">
                          {group.matchPercentage}% 匹配
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {group.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {group.tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {group.memberCount} 成员
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        {group.onlineCount} 在线
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onJoinGroup) {
                      onJoinGroup(group);
                    }
                    if (onNavigateToCommunity) {
                      onNavigateToCommunity(group);
                    }
                  }}
                  className="w-full mt-3 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 active:scale-[0.98]"
                >
                  加入群聊
                </button>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          <button
            onClick={() => {
              if (onNavigateToCommunity) {
                onNavigateToCommunity(null);
              }
              onClose();
            }}
            className="w-full py-3 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            查看所有群聊
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupRecommendationModal;
