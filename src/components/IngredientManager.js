import React, { useState, useMemo } from 'react';
import { Plus, Check, ChevronDown } from 'lucide-react';
import { inventoryStorage, ingredientCategories } from '../store/localStorageAdapter';

const DEFAULT_CATEGORIES = [
    '基酒', '利口酒', '苦精', '果汁', '水果', '糖浆/甜味剂', '气泡饮料',
    '乳制品/蛋类', '香草/香料', '装饰', '其他'
];

const IngredientManager = ({ userInventory, onUpdate }) => {
    const standardIngredients = ingredientCategories;
    const [activeCategory, setActiveCategory] = useState(null);
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [showCustomForm, setShowCustomForm] = useState(false);

    const handleToggle = async (ing_id, is_active) => {
        try {
            await inventoryStorage.toggleIngredient(ing_id, is_active);
            onUpdate();
        } catch (error) {
            console.error("Toggle failed", error);
        }
    };

    const handleAddCustom = async () => {
        if (!customName.trim() || !customCategory.trim()) return;

        try {
            await inventoryStorage.addCustomIngredient(customName.trim(), customCategory.trim());
            setCustomName('');
            setCustomCategory('');
            setShowCustomForm(false);
            onUpdate();
        } catch (error) {
            console.error("Add custom failed", error);
            alert('添加失败，请重试');
        }
    };

    const handleCancelCustom = () => {
        setCustomName('');
        setCustomCategory('');
        setShowCustomForm(false);
    };

    const categories = useMemo(() => {
        const apiCategories = Object.keys(standardIngredients);
        if (apiCategories.length > 0) {
            const ordered = DEFAULT_CATEGORIES.filter(c => apiCategories.includes(c));
            const extra = apiCategories.filter(c => !DEFAULT_CATEGORIES.includes(c));
            return [...ordered, ...extra];
        }
        return DEFAULT_CATEGORIES;
    }, [standardIngredients]);

    const renderCategory = (cat) => {
        const items = standardIngredients[cat] || [];
        if (items.length === 0) return null;
        const isOpen = activeCategory === cat;

        return (
            <div key={cat} className="mb-2">
                <button
                    onClick={() => setActiveCategory(isOpen ? null : cat)}
                    className="im-category-btn"
                >
                    <span>{cat}</span>
                    <ChevronDown size={15} className={`im-category-icon ${isOpen ? 'is-open' : ''}`} />
                </button>

                {isOpen && (
                    <div className="im-tags-container">
                        {items.map(item => {
                            const isOwned = userInventory.standard.some(u => u.ing_id === item.ing_id && u.in_stock);
                            return (
                                <button
                                    key={item.ing_id}
                                    onClick={() => handleToggle(item.ing_id, !isOwned)}
                                    className={`im-tag ${isOwned ? 'is-stocked' : 'is-unstocked'}`}
                                >
                                    {item.name_cn}
                                    {isOwned && <Check size={11} className="im-tag-check" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="im-container">
            <div className="im-header-row">
                <div>
                    <h2 className="im-storage-title">我的存储</h2>
                    <p className="im-storage-count">
                        {new Set([
                            ...(userInventory.standard || []).filter(i => i.in_stock).map(i => i.name_cn || i.name),
                            ...(userInventory.custom || []).filter(i => i.in_stock).map(i => i.name_cn || i.name)
                        ].filter(Boolean)).size} 味原料
                    </p>
                </div>
                {!showCustomForm && (
                    <button
                        onClick={() => setShowCustomForm(true)}
                        className="im-custom-btn"
                    >
                        <Plus size={14} />
                        自定义
                    </button>
                )}
            </div>

            {/* Custom Ingredient Form */}
            {showCustomForm && (
                <div className="im-custom-form">
                    <h3 className="im-custom-form-title">添加自定义原料</h3>
                    <input
                        type="text"
                        placeholder="原料名称"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="oriental-input"
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="oriental-select"
                        style={{ marginBottom: '0.75rem' }}
                    >
                        <option value="">选择分类…</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div className="im-custom-form-actions">
                        <button
                            onClick={handleCancelCustom}
                            className="im-form-btn-cancel"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleAddCustom}
                            disabled={!customName.trim() || !customCategory}
                            className="im-form-btn-add"
                        >
                            添加
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                {categories.map(cat => renderCategory(cat))}

                {/* Custom Ingredients Section */}
                {userInventory.custom.length > 0 && (
                    <div className="mb-4">
                        <h3 className="im-custom-section-title">自定义原料</h3>
                        <div className="im-tags-container">
                            {userInventory.custom.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleToggle(item.ing_id, !item.in_stock)}
                                    className={`im-tag ${item.in_stock ? 'is-custom' : 'is-unstocked'}`}
                                >
                                    {item.name_cn}
                                    {item.in_stock && <Check size={11} className="im-tag-check" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IngredientManager;
