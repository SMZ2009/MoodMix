import React, { useState, useMemo } from 'react';
import { Plus, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { inventoryStorage, ingredientCategories } from '../data/localStorageAdapter';

const DEFAULT_CATEGORIES = [
    '基酒', '利口酒', '酸/水果', '糖浆/甜味剂', '气泡/填充', '装饰/香草', '药物/其他'
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

    // Get categories from API data, fallback to defaults
    const categories = useMemo(() => {
        const apiCategories = Object.keys(standardIngredients);
        if (apiCategories.length > 0) {
            // Sort to match default order, then append any extra categories
            const ordered = DEFAULT_CATEGORIES.filter(c => apiCategories.includes(c));
            const extra = apiCategories.filter(c => !DEFAULT_CATEGORIES.includes(c));
            return [...ordered, ...extra];
        }
        return DEFAULT_CATEGORIES;
    }, [standardIngredients]);

    // Merge user inventory status into standard ingredients for display
    const renderCategory = (cat) => {
        const items = standardIngredients[cat] || [];
        if (items.length === 0) return null;

        return (
            <div key={cat} className="mb-4">
                <button
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className="flex items-center justify-between w-full py-2 px-1 text-sm font-bold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                    <span>{cat}</span>
                    {activeCategory === cat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {activeCategory === cat && (
                    <div className="flex flex-wrap gap-2 pt-2 pb-4 px-1 animate-in slide-in-from-top-2 duration-200" style={{ minWidth: 0 }}>
                        {items.map(item => {
                            const isOwned = userInventory.standard.some(u => u.ing_id === item.ing_id && u.in_stock);
                            return (
                                <button
                                    key={item.ing_id}
                                    onClick={() => handleToggle(item.ing_id, !isOwned)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 flex items-center gap-1.5 ${isOwned
                                            ? 'bg-purple-100 border-purple-200 text-purple-700 shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                    style={{ minWidth: 0, flexShrink: 0 }}
                                >
                                    {item.name_cn}
                                    {isOwned && <Check size={12} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 px-1">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">我的存储</h2>
                    <p className="text-xs text-gray-500">
                        {userInventory.standard.filter(i => i.in_stock).length + userInventory.custom.filter(i => i.in_stock).length} 种原料
                    </p>
                </div>
                {!showCustomForm && (
                    <button
                        onClick={() => setShowCustomForm(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-gray-800 transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        自定义
                    </button>
                )}
            </div>

            {/* Custom Ingredient Form */}
            {showCustomForm && (
                <div className="mb-4 p-3 bg-white/80 rounded-xl border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-2">添加自定义原料</h3>
                    <input
                        type="text"
                        placeholder="原料名称"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full px-3 py-2 mb-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-2 mb-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                        <option value="">选择分类...</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="其他">其他</option>
                    </select>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancelCustom}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleAddCustom}
                            disabled={!customName.trim() || !customCategory}
                            className="flex-1 px-3 py-1.5 text-xs font-bold text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            添加
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                {categories.map(cat => renderCategory(cat))}

                {/* Custom Ingredients Section if any */}
                {userInventory.custom.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-gray-700 px-1 py-2">自定义原料</h3>
                        <div className="flex flex-wrap gap-2 px-1" style={{ minWidth: 0 }}>
                            {userInventory.custom.map(item => (
                                <div key={item.id} className="px-3 py-1.5 rounded-full text-xs font-medium bg-orange-100 border border-orange-200 text-orange-800 flex items-center gap-1.5" style={{ minWidth: 0, flexShrink: 0 }}>
                                    {item.name_cn}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IngredientManager;
