import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Edit3, ChevronRight, ArrowLeft } from 'lucide-react';
import { SwipeableCard } from './ui';
import IngredientManager from './IngredientManager';

const STORAGE_KEYS = {
    AVATAR: 'moodmix_avatar',
    NICKNAME: 'moodmix_nickname'
};

const MineSection = ({ userInventory, onUpdateInventory, favorites, onSelectDrink, cardFeedback }) => {
    const [mineTab, setMineTab] = useState('favorites');
    const [showFullInventory, setShowFullInventory] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(() => {
        return localStorage.getItem(STORAGE_KEYS.AVATAR) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop';
    });
    const [nickname, setNickname] = useState(() => {
        return localStorage.getItem(STORAGE_KEYS.NICKNAME) || '调饮爱好者';
    });
    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const fileInputRef = useRef(null);
    const nicknameInputRef = useRef(null);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newAvatarUrl = event.target.result;
                setAvatarUrl(newAvatarUrl);
                localStorage.setItem(STORAGE_KEYS.AVATAR, newAvatarUrl);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditNickname = () => {
        setIsEditingNickname(true);
        setTimeout(() => nicknameInputRef.current?.focus(), 0);
    };

    const handleNicknameSave = () => {
        if (nickname.trim()) {
            localStorage.setItem(STORAGE_KEYS.NICKNAME, nickname.trim());
            setIsEditingNickname(false);
        }
    };

    const handleNicknameKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleNicknameSave();
        } else if (e.key === 'Escape') {
            setIsEditingNickname(false);
        }
    };

    // Combine standard and custom for display
    const allInventoryItems = useMemo(() => {
        return [
            ...userInventory.standard.filter(i => i.in_stock).map(i => ({ ...i, id: i.ing_id, name: i.name_cn, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=100&q=80' })),
            ...userInventory.custom.filter(i => i.in_stock).map(i => ({ ...i, id: `custom-${i.id}`, name: i.name_cn, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=100&q=80' }))
        ];
    }, [userInventory]);

    if (showFullInventory) {
        return (
            <div className="flex flex-col bg-dreamy-gradient w-full h-[100vh] max-w-4xl mx-auto overflow-hidden relative">
                {/* 头部导航 */}
                <div className="flex items-center justify-between px-6 py-4 bg-white/30 backdrop-blur-md border-b border-white/20">
                    <div className="flex items-center">
                        <button
                            onClick={() => setShowFullInventory(false)}
                            className="p-2 -ml-2 rounded-full hover:bg-white/40 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-700" />
                        </button>
                        <h1 className="text-lg font-bold text-gray-800 ml-2">原料管理</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFullInventory(false)}
                            className="px-4 py-2 text-xs font-bold text-gray-600 bg-white/60 hover:bg-white/80 rounded-lg border border-gray-200 transition-all"
                        >
                            取消
                        </button>
                        <button
                            onClick={() => {
                                onUpdateInventory(); // 刷新数据
                                setShowFullInventory(false);
                            }}
                            className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-95"
                        >
                            保存修改
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden p-6">
                    <IngredientManager userInventory={userInventory} onUpdate={onUpdateInventory} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-dreamy-gradient w-full max-w-4xl mx-auto">
            {/* 头部区域 - 粘性定位 */}
            <div className="sticky top-0 z-10 bg-dreamy-gradient">
                <div className="bg-white/30 backdrop-blur-md border-b border-white/20">
                    <div className="flex flex-col items-center pt-8 pb-4 px-6">
                    <div className="relative mb-2">
                        <div 
                            className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={handleAvatarClick}
                        >
                            <img
                                alt="Profile"
                                className="w-full h-full object-cover"
                                src={avatarUrl}
                            />
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditingNickname ? (
                            <input
                                ref={nicknameInputRef}
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                onBlur={handleNicknameSave}
                                onKeyDown={handleNicknameKeyDown}
                                className="text-lg font-bold text-[#111813] bg-transparent border-b-2 border-purple-400 focus:outline-none focus:border-purple-600 px-1"
                                style={{ maxWidth: '150px' }}
                            />
                        ) : (
                            <h1 className="text-lg font-bold text-[#111813]">{nickname}</h1>
                        )}
                        <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={handleEditNickname}
                        >
                            <Edit3 size={12} className="text-gray-500" />
                        </div>
                    </div>
                    <p className="text-[#608a6e] text-[11px] font-medium bg-white/60 px-3 py-1 rounded-full backdrop-blur-sm mt-1">
                        {allInventoryItems.length} 原料 | {favorites.length} 喜欢
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
                    <div className="flex items-center justify-between px-6">
                        <h3 className="text-sm font-bold text-[#111813]">原料库</h3>
                        <button
                            onClick={() => setShowFullInventory(true)}
                            className="text-[#608a6e] text-xs flex items-center gap-1"
                        >
                            管理 <ChevronRight size={12} />
                        </button>
                    </div>
                    <div className="w-full overflow-x-auto no-scrollbar px-6 pb-3">
                        <div className="flex flex-wrap gap-2 py-1">
                            {allInventoryItems.length === 0 ? (
                                <div className="text-xs text-gray-400 italic">暂无原料，点击管理添加</div>
                            ) : (
                                allInventoryItems.map((item, idx) => {
                                    // 根据分类使用不同渐变色
                                    const colorSchemes = [
                                        'from-purple-400/80 to-pink-400/80 border-purple-300/50',
                                        'from-blue-400/80 to-cyan-400/80 border-blue-300/50',
                                        'from-amber-400/80 to-orange-400/80 border-amber-300/50',
                                        'from-emerald-400/80 to-teal-400/80 border-emerald-300/50',
                                        'from-rose-400/80 to-red-400/80 border-rose-300/50',
                                    ];
                                    const scheme = colorSchemes[idx % colorSchemes.length];

                                    return (
                                        <span
                                            key={item.id}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r ${scheme} border backdrop-blur-sm shadow-sm whitespace-nowrap transition-transform hover:scale-105 active:scale-95`}
                                        >
                                            {item.name}
                                        </span>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 标签切换区域 - 粘性定位 */}
            <div className="px-6 mb-4 sticky top-0 bg-dreamy-gradient z-50 pt-2">
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    {['favorites', 'collections'].map((id) => (
                        <button
                            key={id}
                            onClick={() => setMineTab(id)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mineTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                                }`}
                        >
                            {id === 'favorites' ? '喜欢 ❤️' : '赏味集 📖'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-6 pb-10">
                {mineTab === 'favorites' && (
                    <div className="grid grid-cols-2 gap-3 pb-10" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        {favorites.map((drink) => (
                            <SwipeableCard
                                key={drink.id}
                                onTap={() => onSelectDrink(drink)}
                                className="flex flex-col w-full"
                                style={{ ...cardFeedback, minWidth: 0 }}
                            >
                                <div className="relative aspect-[4/5] rounded-[1.5rem] overflow-hidden shadow-sm bg-gray-200" style={{ minWidth: 0, width: '100%' }}>
                                    <img
                                        alt={drink.name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        src={drink.image}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
                                    <div className="absolute bottom-3 left-3 right-3 text-left">
                                        <h4 className="text-white font-bold text-xs truncate">{drink.name}</h4>
                                        <p className="text-white/60 text-[9px] truncate leading-tight">
                                            {drink.subName || drink.sub}
                                        </p>
                                    </div>
                                </div>
                            </SwipeableCard>
                        ))}
                        {favorites.length === 0 && (
                            <div className="col-span-2 text-center text-gray-400 text-sm py-10">
                                还没收藏喜欢的饮品哦
                            </div>
                        )}
                    </div>
                )}
                {mineTab === 'collections' && (
                    <div className="text-center text-gray-400 text-sm py-10">
                        暂无赏味集
                    </div>
                )}
            </div>

            {/* Spacer for bottom nav */}
            <div className="h-24 flex-none" />
        </div>
    );
};

export default MineSection;
