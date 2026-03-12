import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Edit3, ChevronRight, ArrowLeft, Camera, Trash2, Heart } from 'lucide-react';
import { SwipeableCard } from './ui';
import IngredientManager from './IngredientManager';
import { translateDrinkName } from '../data/translations';

const STORAGE_KEY_PROFILE = 'moodmix_profile';

const MineSection = ({ userInventory, onUpdateInventory, favorites, onSelectDrink, cardFeedback, initialTab = 'favorites', dakaNotes = [], onDeleteDakaNote }) => {
    const [mineTab, setMineTab] = useState(initialTab);

    useEffect(() => {
        if (initialTab) {
            setMineTab(initialTab);
        }
    }, [initialTab]);
    const [showFullInventory, setShowFullInventory] = useState(false);
    const [nickname, setNickname] = useState('调饮爱好者');
    const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop');
    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const fileInputRef = useRef(null);
    const nicknameInputRef = useRef(null);

    // 从 LocalStorage 加载用户资料
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
            if (stored) {
                const profile = JSON.parse(stored);
                if (profile.nickname) setNickname(profile.nickname);
                if (profile.avatarUrl) setAvatarUrl(profile.avatarUrl);
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    }, []);

    // 保存用户资料到 LocalStorage
    const saveProfile = (newNickname, newAvatarUrl) => {
        try {
            const profile = {
                nickname: newNickname || nickname,
                avatarUrl: newAvatarUrl || avatarUrl
            };
            localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
        } catch (error) {
            console.error('Failed to save profile:', error);
        }
    };

    // Combine standard and custom for display (only in_stock items, de-duplicated by name)
    const allInventoryItems = useMemo(() => {
        const customItems = (userInventory.custom || []).filter(i => i.in_stock).map(i => ({ ...i, id: `custom-${i.id}`, name: i.name_cn || i.name }));
        const standardItems = (userInventory.standard || []).filter(i => i.in_stock).map(i => ({ ...i, id: i.ing_id, name: i.name_cn || i.name }));

        const combined = [...customItems, ...standardItems];
        // 按名称去重
        const seen = new Set();
        return combined.filter(item => {
            const itemName = item.name?.trim();
            if (!itemName || seen.has(itemName)) return false;
            seen.add(itemName);
            return true;
        });
    }, [userInventory]);

    if (showFullInventory) {
        return (
            <div className="fixed inset-0 z-[150] flex flex-col bg-dreamy-gradient w-full h-[100vh] overflow-hidden">
                {/* 头部导航 */}
                <div className="im-page-header">
                    <div className="flex items-center">
                        <button
                            onClick={() => {
                                onUpdateInventory();
                                setShowFullInventory(false);
                            }}
                            className="im-back-btn"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="im-page-title">原料管理</h1>
                    </div>

                </div>
                <div className="flex-1 overflow-hidden p-6">
                    <IngredientManager userInventory={userInventory} onUpdate={onUpdateInventory} />
                </div>
            </div>
        );
    }

    return (
        <div
            className="bg-dreamy-gradient w-full min-h-[100svh] overflow-x-hidden"
            style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
        >
            {/* 头部区域 */}
            <div className="flex flex-col items-center pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-4 px-6 bg-white/30 backdrop-blur-md border-b border-white/20">
                {/* 头像 - 点击修改 */}
                <div
                    className="relative mb-2 cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md transition-transform group-hover:scale-105">
                        <img
                            alt="Profile"
                            className="w-full h-full object-cover"
                            src={avatarUrl}
                        />
                    </div>
                    {/* 头像悬浮遮罩 */}
                    <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={20} className="text-white" />
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const newAvatarUrl = event.target?.result;
                                    setAvatarUrl(newAvatarUrl);
                                    saveProfile(null, newAvatarUrl);
                                };
                                reader.readAsDataURL(file);
                            }
                        }}
                    />
                </div>

                {/* 昵称 - 点击编辑图标修改 */}
                <div className="relative flex items-center justify-center">
                    {isEditingNickname ? (
                        <input
                            ref={nicknameInputRef}
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            onBlur={() => {
                                setIsEditingNickname(false);
                                saveProfile(nickname, null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setIsEditingNickname(false);
                                    saveProfile(nickname, null);
                                }
                            }}
                            className="text-lg font-bold text-[#111813] bg-transparent border-b-2 border-purple-400 outline-none text-center min-w-[120px]"
                            autoFocus
                        />
                    ) : (
                        <h1 className="text-lg font-bold text-[#111813]">{nickname}</h1>
                    )}
                    <button
                        onClick={() => {
                            setIsEditingNickname(true);
                            setTimeout(() => nicknameInputRef.current?.focus(), 0);
                        }}
                        className="absolute -right-10 w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/60 transition-colors flex-shrink-0"
                    >
                        <Edit3 size={10} className="text-gray-500" />
                    </button>
                </div>
                <p className="text-[#608a6e] text-[11px] font-medium bg-white/60 px-3 py-1 rounded-full backdrop-blur-sm mt-1">
                    {allInventoryItems.length} 原料 | {favorites.length} 喜欢
                </p>
            </div>

            {/* 原料库区域 - 限制两行，超出用 ... 省略 */}
            <div className="flex flex-col gap-2 mb-6 px-6 py-4 bg-white/30 backdrop-blur-md rounded-2xl transition-all hover:bg-white/40 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#111813]">原料库</h3>
                    <button
                        onClick={() => setShowFullInventory(true)}
                        className="text-[#608a6e] text-xs flex items-center gap-1 hover:text-[#4a6b54] transition-colors"
                    >
                        管理 <ChevronRight size={12} />
                    </button>
                </div>
                <div className="w-full">
                    <div className="flex flex-row flex-nowrap overflow-x-auto overflow-y-hidden no-scrollbar gap-2 py-2 w-full">
                        {allInventoryItems.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">暂无原料，点击管理添加</div>
                        ) : (
                            allInventoryItems.map((item, idx) => {
                                return (
                                    <span
                                        key={item.id}
                                        className="px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-transform hover:scale-105 flex-shrink-0"
                                        style={{
                                            fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                                            fontWeight: 600,
                                            letterSpacing: '0.08em',
                                            background: 'rgba(255,255,255,0.55)',
                                            border: '1px solid rgba(60,59,54,0.15)',
                                            color: 'rgba(60,59,54,0.80)',
                                            backdropFilter: 'blur(8px)',
                                            WebkitBackdropFilter: 'blur(8px)'
                                        }}
                                    >
                                        {item.name}
                                    </span>
                                );
                            })
                        )}
                        <span
                            className="px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap self-center shadow-sm flex-shrink-0"
                            style={{
                                fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                background: 'linear-gradient(135deg, rgba(60,59,54,0.90) 0%, rgba(40,39,34,0.95) 100%)',
                                color: '#f7f0e4',
                            }}
                        >
                            ...共{allInventoryItems.length}种
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab 切换栏 - 更贴合整体水墨氛围 */}
            <div className="sticky top-0 z-40 px-6 pt-3 pb-2">
                <div
                    className="relative overflow-hidden px-1 py-0.5"
                    style={{
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)'
                    }}
                >
                    <div
                        className="absolute -left-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full blur-2xl pointer-events-none"
                        style={{ background: 'rgba(177, 196, 221, 0.22)' }}
                    />
                    <div
                        className="absolute -right-6 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full blur-2xl pointer-events-none"
                        style={{ background: 'rgba(229, 198, 181, 0.18)' }}
                    />
                    <div className="relative grid grid-cols-2 gap-2">
                        {[
                            { id: 'favorites', title: '喜欢', subtitle: '偏爱留香', accent: 'rgba(172, 103, 101, 0.16)' },
                            { id: 'collections', title: '赏味集', subtitle: '杯中札记', accent: 'rgba(121, 143, 167, 0.16)' }
                        ].map((tab) => {
                            const isActive = mineTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setMineTab(tab.id)}
                                    className="relative rounded-[1.15rem] px-3 py-2 transition-all duration-300"
                                    style={{
                                        background: isActive
                                            ? `linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,242,235,0.68)), ${tab.accent}`
                                            : 'transparent',
                                        border: isActive
                                            ? '1px solid rgba(255, 255, 255, 0.18)'
                                            : '1px solid transparent',
                                        boxShadow: isActive
                                            ? 'none'
                                            : 'none',
                                        color: isActive ? '#2d2723' : 'rgba(92, 90, 86, 0.62)'
                                    }}
                                >
                                    <div
                                        style={{
                                            fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.12em'
                                        }}
                                    >
                                        {tab.title}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: '0.12rem',
                                            fontFamily: '"FZYouSong", "方正悠宋", "Songti SC", serif',
                                            fontSize: '0.66rem',
                                            letterSpacing: '0.14em',
                                            opacity: isActive ? 0.8 : 0.56
                                        }}
                                    >
                                        {tab.subtitle}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 pb-32 w-full">
                {mineTab === 'favorites' && (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {favorites.map((drink) => (
                            <SwipeableCard
                                key={drink.id}
                                onTap={() => onSelectDrink(drink)}
                                style={{
                                    ...cardFeedback,
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    background: 'rgba(255, 255, 255, 0.45)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255, 255, 255, 0.6)',
                                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                                    minWidth: 0
                                }}
                            >
                                <div className="p-2 sm:p-3 pb-0">
                                    <div
                                        className="relative aspect-[4/5] bg-cover bg-center rounded-xl overflow-hidden shadow-inner"
                                        style={{ backgroundImage: `url(${drink.image})` }}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // 这里可以添加取消收藏的逻辑
                                            }}
                                            className="absolute top-2 right-2 w-7 sm:w-8 h-7 sm:h-8 bg-black/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 transition-transform hover:scale-110 active:scale-95"
                                        >
                                            <Heart
                                                size={14}
                                                className="text-[#FF7675] fill-current"
                                            />
                                        </button>
                                    </div>
                                </div>
                                <div className="px-3 sm:px-4 py-2 sm:py-3">
                                    <h3
                                        className="font-bold text-sm sm:text-[15px] text-gray-800 leading-tight mb-0.5 sm:mb-1"
                                        style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
                                    >
                                        {drink.name_cn || translateDrinkName(drink.name) || drink.name}
                                    </h3>
                                    <p
                                        className="text-[11px] sm:text-[12px] text-gray-400 leading-tight line-clamp-1 font-medium italic"
                                        style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
                                    >
                                        {drink.subName || drink.sub}
                                    </p>
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
                    <div>
                        {dakaNotes.length === 0 ? (
                            <div className="text-center text-gray-400 text-sm py-10">
                                暂无赏味集
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {dakaNotes.map(note => (
                                    <DakaNoteCard key={note.id} note={note} onDelete={onDeleteDakaNote} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
};

const DakaNoteCard = ({ note, onDelete }) => {
    const [translateX, setTranslateX] = useState(0);
    const cardRef = useRef(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);

    const handleDragStart = (e) => {
        isDragging.current = true;
        startX.current = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        cardRef.current.style.transition = 'none';
    };

    const handleDragMove = (e) => {
        if (!isDragging.current) return;
        currentX.current = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        const diff = currentX.current - startX.current;
        // Only allow dragging to the left, and cap it at -80px
        const newTranslateX = Math.min(0, Math.max(-80, diff));
        setTranslateX(newTranslateX);
    };

    const handleDragEnd = () => {
        isDragging.current = false;
        cardRef.current.style.transition = 'transform 0.3s ease';
        // Snap to either fully open (-72px) or closed (0)
        if (translateX < -36) {
            setTranslateX(-72);
        } else {
            setTranslateX(0);
        }
    };

    return (
        <div className="relative w-full overflow-hidden rounded-xl">
            <div
                className="absolute top-0 right-0 h-full flex items-center justify-center bg-red-500 text-white w-[72px] rounded-r-xl cursor-pointer transition-opacity"
                style={{ opacity: translateX !== 0 ? 1 : 0 }}
                onClick={() => {
                    if (translateX !== 0) { // Only allow click if visible
                        onDelete(note.id);
                    }
                }}
            >
                <Trash2 size={20} />
            </div>
            <div
                ref={cardRef}
                className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/50 w-full relative z-10"
                style={{ transform: `translateX(${translateX}px)`, transition: 'transform 0.3s ease' }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                onMouseMove={handleDragMove}
                onTouchMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchEnd={handleDragEnd}
            >
                <div className="flex items-start gap-4">
                    <img src={note.customImage || note.image} alt={note.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 truncate">{note.name}</h4>
                        <p className="text-xs text-gray-400 mb-2">{new Date(note.dakaTime).toLocaleString()}</p>
                        <p className="text-sm text-gray-600 break-words">{note.note}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MineSection;
