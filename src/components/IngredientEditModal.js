import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Plus, Check, RotateCcw } from 'lucide-react';
import { ingredientCategories } from '../store/localStorageAdapter';
import { InteractiveButton } from './ui';


// 扁平化所有标准原料用于搜索
const ALL_INGREDIENTS = Object.entries(ingredientCategories).flatMap(([category, items]) =>
    items.map(item => ({ ...item, category }))
);

const IngredientEditModal = ({ currentIngredients, onUpdate, onClose, onReset }) => {
    const [list, setList] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState(null);
    const searchRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        // 初始数据去重
        const uniqueIngredients = [...new Set(currentIngredients || [])];
        setList(uniqueIngredients);
    }, [currentIngredients]);

    // 搜索结果
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.trim().toLowerCase();
        return ALL_INGREDIENTS.filter(item =>
            item.name_cn.toLowerCase().includes(q) ||
            item.name_en.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // 按分类分组当前已选原料（无搜索时展示）
    const groupedIngredients = useMemo(() => {
        if (!list.length) return {};
        const groups = {};
        // 确保列表本身是唯一的
        const uniqueList = [...new Set(list)];
        uniqueList.forEach(name => {
            const found = ALL_INGREDIENTS.find(i => i.name_cn === name);
            const cat = found ? found.category : '自定义';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(name);
        });
        return groups;
    }, [list]);

    const categories = useMemo(() => Object.keys(groupedIngredients), [groupedIngredients]);

    const handleAdd = (name) => {
        if (!list.includes(name)) {
            setList(prev => [...prev, name]);
        }
    };

    const handleRemove = (name) => {
        setList(prev => prev.filter(i => i !== name));
    };

    const handleAddCustom = () => {
        const val = searchQuery.trim();
        if (val && !list.includes(val)) {
            setList(prev => [...prev, val]);
            setSearchQuery('');
            searchRef.current?.focus();
        }
    };

    const handleSave = () => {
        onUpdate(list);
        onClose();
    };

    const isInList = (name) => list.includes(name);
    const isSearching = searchQuery.trim().length > 0;

    return (
        <div className="glass-modal rounded-[2.8rem] p-8 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', fontFamily: '"Noto Serif SC", serif' }}>原料斋房</h2>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 text-white/80 hover:text-white bg-white/30 hover:bg-white/40 transition-all border border-white/40 shadow-md"
                >
                    <X size={24} />
                </button>
            </div>
            <p style={{ color: 'rgba(0, 0, 0, 0.45)', marginBottom: '1.5rem', fontSize: '0.875rem', fontFamily: '"Songti SC", serif' }}>增减之间，味自天成</p>

            {/* 搜索框 */}
            <div className="relative mb-6">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" />
                <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="寻觅一味原料…"
                    className="glass-input w-full pl-12 pr-10 py-3.5 bg-white/10 border border-black/10 rounded-2xl text-black focus:outline-none placeholder-black/20"
                    style={{ fontFamily: '"Songti SC", serif' }}
                />
                {searchQuery && (
                    <button
                        onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-white/20 hover:text-white/60 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* 主内容区 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                {isSearching ? (
                    <div className="space-y-3">
                        {searchResults.length > 0 ? (
                            <>
                                <div className="text-[10px] uppercase font-bold tracking-widest text-white/30 px-1">
                                    寻得 {searchResults.length} 味
                                </div>
                                {searchResults.map(item => {
                                    const owned = isInList(item.name_cn);
                                    return (
                                        <button
                                            key={item.ing_id}
                                            onClick={() => owned ? handleRemove(item.name_cn) : handleAdd(item.name_cn)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                                                owned ? 'bg-black/5 border-black/20 text-black' : 'bg-white/40 border-black/10 text-black/45 hover:bg-white/60'
                                            }`}
                                        >
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="font-medium truncate" style={{ fontFamily: '"Songti SC", serif' }}>{item.name_cn}</div>
                                                <div className="text-[10px] opacity-60 uppercase truncate" style={{ fontFamily: '"Songti SC", serif' }}>{item.name_en}</div>
                                            </div>
                                            <div className="px-2 py-0.5 rounded-md bg-black/5 text-[10px] opacity-40 border border-black/5">{item.category}</div>
                                            <div className={`flex items-center gap-1 text-[10px] font-bold ${owned ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                {owned ? <Check size={14} /> : <Plus size={14} />}
                                                <span>{owned ? '已备' : '添入'}</span>
                                            </div>
                                        </button>
                                    );
                                })}

                                {!searchResults.some(r => r.name_cn === searchQuery.trim()) && (
                                    <button
                                        onClick={handleAddCustom}
                                        className="w-full p-4 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white/80 hover:border-white/40 transition-all flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Plus size={16} />
                                        <span>以此名添入自定义原料</span>
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                                <Search size={32} className="text-white/10" />
                                <p className="text-sm text-white/40">未寻得「{searchQuery.trim()}」</p>
                                <button
                                    onClick={handleAddCustom}
                                    className="px-6 py-2 rounded-full bg-white/10 text-white/80 text-sm hover:bg-white/20 transition-all flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    <span>以此名添入自定义原料</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {list.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
                                <Plus size={48} />
                                <p className="text-lg font-medium">清台无物</p>
                            </div>
                        ) : (
                            <>
                                <div className="text-[10px] uppercase font-bold tracking-widest text-black/30 px-1" style={{ fontFamily: '"Songti SC", serif' }}>
                                    已备 {list.length} 味
                                </div>

                                {categories.map(cat => (
                                    <div key={cat} className="space-y-3">
                                        <button
                                            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                                            className="w-full flex items-center justify-between text-left group"
                                        >
                                            <span className="text-xs font-bold text-black/60 group-hover:text-black transition-colors">{cat}</span>
                                            <div className="flex-1 mx-3 border-b border-black/5" />
                                            <span className="text-[10px] font-mono text-black/20">{groupedIngredients[cat].length}</span>
                                        </button>

                                        {(activeCategory === cat || activeCategory === null) && (
                                            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {groupedIngredients[cat].map(name => (
                                                    <button
                                                        key={name}
                                                        onClick={() => handleRemove(name)}
                                                        className="group flex items-center gap-2 px-4 py-2 bg-white/40 border border-black/5 rounded-xl text-sm text-black/70 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-600 transition-all font-medium"
                                                    >
                                                        <span>{name}</span>
                                                        <X size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* 底部操作栏 */}
            <div className="mt-8 flex gap-4">
                <InteractiveButton
                    variant="glass-secondary"
                    onClick={onReset}
                    className="flex-1 h-14"
                >
                    <RotateCcw size={16} className="mr-2" />
                    <span>重置默认</span>
                </InteractiveButton>
                <InteractiveButton
                    variant="glass-primary"
                    onClick={handleSave}
                    className="flex-[2] h-14"
                >
                    <Check size={18} className="mr-2" />
                    <span>定稿落案 ({list.length})</span>
                </InteractiveButton>
            </div>
        </div>
    );
};

export default IngredientEditModal;
