import React from 'react';
import navIconMix from '../assets/nav_icon_mix.png';
import navIconExplore from '../assets/nav_icon_explore.png';
import navIconMine from '../assets/nav_icon_mine.png';
import navIconIngredient from '../assets/nav_icon_ingredient.png';
import navIconCommunity from '../assets/nav_icon_community.png';
import { Users } from 'lucide-react';

const SideNavigation = ({ isOpen, onClose, activeTab, onTabChange, onOpenIngredientLibrary }) => {
  return (
    <div className={`fixed top-0 left-0 h-full w-64 bg-dreamy-gradient shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full p-6">
        <div className="mb-8 mt-8">
          <h1 className="text-xl font-bold tracking-tight text-gray-800 leading-none" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>喝一杯 MoodMix</h1>
        </div>

        <nav className="flex-1 space-y-3">
          <button
            onClick={() => {
              onTabChange('mix');
              onClose();
            }}
            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'mix' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'mix' ? 'scale-110 drop-shadow-md' : ''}`}>
              <img src={navIconMix} alt="特调" className="w-6 h-6 object-contain" />
            </div>
            <span className="text-sm font-medium" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>特调</span>
          </button>

          <button
            onClick={() => {
              onTabChange('explore');
              onClose();
            }}
            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'explore' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'explore' ? 'scale-110 drop-shadow-md' : ''}`}>
              <img src={navIconExplore} alt="灵感" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-sm font-medium" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>灵感</span>
          </button>

          <button
            onClick={() => {
              onOpenIngredientLibrary?.();
              onClose();
            }}
            className="flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-50"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center">
              <img src={navIconIngredient} alt="原料" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-sm font-medium" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>原料</span>
          </button>

          <button
            onClick={() => {
              onTabChange('community');
              onClose();
            }}
            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'community' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'community' ? 'scale-110 drop-shadow-md' : ''}`}>
              <img src={navIconCommunity} alt="社区" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-sm font-medium" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>社区</span>
          </button>

          <button
            onClick={() => {
              onTabChange('mine');
              onClose();
            }}
            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'mine' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'mine' ? 'scale-110 drop-shadow-md' : ''}`}>
              <img src={navIconMine} alt="我的" className="w-6 h-6 object-contain" />
            </div>
            <span className="text-sm font-medium" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>我的</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="text-xs text-gray-400">MoodMix © 2026</div>
        </div>
      </div>
    </div>
  );
};

export default SideNavigation;