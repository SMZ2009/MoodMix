import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Plus, Check, RotateCcw } from 'lucide-react';
import { ingredientCategories } from '../store/localStorageAdapter';

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
        <div
            className="ingredient-modal-container"
            style={{ maxWidth: '440px' }}
        >
            {/* 标题区域 */}
            <div className="flex items-center justify-between mb-1">
                <h2 className="ingredient-modal-title">原料斋房</h2>
                <button
                    onClick={onClose}
                    className="p-2 -mr-2 text-gray-400/60 hover:text-gray-600/80 transition-colors rounded-full"
                >
                    <X size={20} />
                </button>
            </div>
            <p className="ingredient-modal-subtitle">增减之间，味自天成</p>

            {/* 水墨装饰分割线 */}
            <div className="ink-divider" />

            {/* 搜索框 */}
            <div className="ingredient-search-wrapper">
                <Search size={16} className="ingredient-search-icon" />
                <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="寻觅一味原料…"
                    className="ingredient-search-input"
                />
                {searchQuery && (
                    <button
                        onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                        className="p-1 text-gray-400/60 hover:text-gray-600 transition-colors"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* 主内容区 */}
            <div ref={scrollRef} className="ingredient-scroll-area">
                {isSearching ? (
                    /* ─── 搜索结果列表 ─── */
                    <div className="ingredient-search-results">
                        {searchResults.length > 0 ? (
                            <>
                                <div className="ingredient-section-label">
                                    寻得 {searchResults.length} 味
                                </div>
                                {searchResults.map(item => {
                                    const owned = isInList(item.name_cn);
                                    return (
                                        <button
                                            key={item.ing_id}
                                            onClick={() => owned ? handleRemove(item.name_cn) : handleAdd(item.name_cn)}
                                            className={`ingredient-search-item ${owned ? 'is-owned' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <span className="ingredient-search-item-name">{item.name_cn}</span>
                                                <span className="ingredient-search-item-en">{item.name_en}</span>
                                            </div>
                                            <div className="ingredient-search-item-cat">{item.category}</div>
                                            <div className={`ingredient-search-item-action ${owned ? 'is-owned' : ''}`}>
                                                {owned ? (
                                                    <><Check size={13} /><span>已备</span></>
                                                ) : (
                                                    <><Plus size={13} /><span>添入</span></>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* 自定义原料选项 */}
                                {!searchResults.some(r => r.name_cn === searchQuery.trim()) && (
                                    <button
                                        onClick={handleAddCustom}
                                        className="ingredient-custom-add"
                                    >
                                        <Plus size={14} />
                                        <span>添入自定义：<strong>{searchQuery.trim()}</strong></span>
                                    </button>
                                )}
                            </>
                        ) : (
                            /* 无匹配结果 */
                            <div className="ingredient-empty-search">
                                <div className="ingredient-empty-icon">
                                    <Search size={20} />
                                </div>
                                <p>未寻得「{searchQuery.trim()}」</p>
                                <button
                                    onClick={handleAddCustom}
                                    className="ingredient-custom-add"
                                >
                                    <Plus size={14} />
                                    <span>以此名添入自定义原料</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ─── 分类标签云（无搜索时） ─── */
                    <div className="ingredient-tag-cloud">
                        {list.length === 0 ? (
                            <div className="ingredient-empty-state">
                                <div className="ingredient-empty-icon">
                                    <Plus size={22} />
                                </div>
                                <p>清台无物</p>
                                <span>搜索添入原料，或重置为默认</span>
                            </div>
                        ) : (
                            <>
                                <div className="ingredient-section-label">
                                    已备 {list.length} 味
                                </div>

                                {/* 分类折叠展示 */}
                                {categories.map(cat => (
                                    <div key={cat} className="ingredient-category-group">
                                        <button
                                            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                                            className={`ingredient-category-header ${activeCategory === cat ? 'is-active' : ''}`}
                                        >
                                            <span>{cat}</span>
                                            <span className="ingredient-category-count">{groupedIngredients[cat].length}</span>
                                        </button>

                                        {(activeCategory === cat || activeCategory === null) && (
                                            <div className="ingredient-tags-wrap">
                                                {groupedIngredients[cat].map(name => (
                                                    <button
                                                        key={name}
                                                        onClick={() => handleRemove(name)}
                                                        className="ingredient-ink-tag is-owned"
                                                        title={`点击移除「${name}」`}
                                                    >
                                                        <span>{name}</span>
                                                        <X size={12} className="ingredient-ink-tag-x" />
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
            <div className="ingredient-modal-footer">
                <button onClick={onReset} className="ingredient-btn-reset">
                    <RotateCcw size={15} />
                    <span>重置</span>
                </button>
                <button onClick={handleSave} className="ingredient-btn-confirm">
                    <Check size={17} />
                    <span>落定 ({list.length})</span>
                </button>
            </div>
        </div>
    );
};

export default IngredientEditModal;
