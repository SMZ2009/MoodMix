import React, { useState, useMemo } from 'react';
import { Plus, Check, ChevronDown, X, Loader2 } from 'lucide-react';
import { inventoryStorage, ingredientCategories } from '../store/localStorageAdapter';

const DEFAULT_CATEGORIES = [
    '基酒', '利口酒', '苦精', '果汁', '水果', '糖浆/甜味剂', '气泡饮料',
    '乳制品/蛋类', '香草/香料', '装饰', '其他'
];

const IngredientManager = ({ userInventory, onUpdate, showCustomForm, setShowCustomForm }) => {
    const standardIngredients = ingredientCategories;
    const [activeCategory, setActiveCategory] = useState(null);
    const [customName, setCustomName] = useState('');
    const [isClassifying, setIsClassifying] = useState(false);

    // Internal state fallback if props not provided
    const [internalShowForm, setInternalShowForm] = useState(false);
    const isFormVisible = showCustomForm !== undefined ? showCustomForm : internalShowForm;
    const triggerShowForm = setShowCustomForm || setInternalShowForm;

    const handleToggle = async (ing_id, is_active) => {
        try {
            await inventoryStorage.toggleIngredient(ing_id, is_active);
            onUpdate();
        } catch (error) {
            console.error("Toggle failed", error);
        }
    };

    const handleAddCustom = async () => {
        if (!customName.trim()) return;

        const inputName = customName.trim();

        // Call LLM to classify and normalize the ingredient name
        setIsClassifying(true);
        try {
            const response = await fetch('/api/classify_ingredient', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: inputName })
            });
            const data = await response.json();
            const category = data.category || '其他';
            // Use normalized name from LLM (e.g., "奇异果" -> "猕猴桃")
            const normalizedName = data.normalized_name || inputName;

            // Check for duplicates using normalized name
            const isStandardDuplicate = Object.values(standardIngredients).some(catItems =>
                catItems.some(item => item.name_cn === normalizedName || item.name_en === normalizedName)
            );
            const isCustomDuplicate = userInventory.custom.some(item => item.name_cn === normalizedName);

            if (isStandardDuplicate || isCustomDuplicate) {
                // Show which name was matched
                const displayMsg = normalizedName !== inputName 
                    ? `"${inputName}" (${normalizedName}) 已存在于原料库中，无需重复添加。`
                    : `"${normalizedName}" 已存在于原料库中，无需重复添加。`;
                alert(displayMsg);
                setIsClassifying(false);
                return;
            }

            await inventoryStorage.addCustomIngredient(normalizedName, category);
            setCustomName('');
            triggerShowForm(false);
            onUpdate();
            
            // Open the category where the ingredient was added
            setActiveCategory(category);
        } catch (error) {
            console.error("Add custom failed", error);
            // Fallback: add with original name to "其他" category
            try {
                await inventoryStorage.addCustomIngredient(inputName, '其他');
                setCustomName('');
                triggerShowForm(false);
                onUpdate();
            } catch (e) {
                alert('添加失败，请重试');
            }
        } finally {
            setIsClassifying(false);
        }
    };

    const handleDeleteCustom = async (e, ingId) => {
        e.stopPropagation();
        if (window.confirm('确定要彻底删除这个自定义原料吗？')) {
            try {
                await inventoryStorage.removeCustomIngredient(ingId);
                onUpdate();
            } catch (error) {
                console.error("Delete custom failed", error);
            }
        }
    };

    const handleCancelCustom = () => {
        setCustomName('');
        triggerShowForm(false);
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
        const standardItems = standardIngredients[cat] || [];
        // Find custom items that belong to this category
        const customItems = userInventory.custom.filter(item => item.category === cat);

        if (standardItems.length === 0 && customItems.length === 0) return null;
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
                        {/* Standard Items */}
                        {standardItems.map(item => {
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

                        {/* Custom Items for this Category */}
                        {customItems.map(item => (
                            <div key={item.id} className="relative group">
                                <button
                                    onClick={() => handleToggle(item.ing_id, !item.in_stock)}
                                    className={`im-tag ${item.in_stock ? 'is-custom' : 'is-unstocked'}`}
                                >
                                    {item.name_cn}
                                    {item.in_stock && <Check size={11} className="im-tag-check" />}
                                </button>
                                <button
                                    onClick={(e) => handleDeleteCustom(e, item.ing_id)}
                                    className="im-tag-delete-btn"
                                    title="删除"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="im-container no-scrollbar">
            {/* Redundent header removed, handled by parent App.js */}

            {/* Custom Ingredient Form */}
            {isFormVisible && (
                <div className="im-custom-form">
                    <h3 className="im-custom-form-title">添加自定义原料</h3>
                    <input
                        type="text"
                        placeholder="输入原料名称，系统自动分类并匹配标准名..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isClassifying && customName.trim() && handleAddCustom()}
                        className="oriental-input"
                        style={{ marginBottom: '0.75rem' }}
                        disabled={isClassifying}
                        autoFocus
                    />
                    <div className="im-custom-form-actions">
                        <button
                            onClick={handleCancelCustom}
                            className="im-form-btn-cancel"
                            disabled={isClassifying}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleAddCustom}
                            disabled={!customName.trim() || isClassifying}
                            className="im-form-btn-add"
                        >
                            {isClassifying ? (
                                <>
                                    <Loader2 size={14} className="animate-spin mr-1" />
                                    分类中...
                                </>
                            ) : (
                                '添加'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                {categories.map(cat => renderCategory(cat))}

                {/* Uncategorized Custom Ingredients Section */}
                {userInventory.custom.filter(i => !categories.includes(i.category)).length > 0 && (
                    <div className="mb-4">
                        <h3 className="im-custom-section-title">其他自定义</h3>
                        <div className="im-tags-container">
                            {userInventory.custom
                                .filter(i => !categories.includes(i.category))
                                .map(item => (
                                    <div key={item.id} className="relative group">
                                        <button
                                            key={item.id}
                                            onClick={() => handleToggle(item.ing_id, !item.in_stock)}
                                            className={`im-tag ${item.in_stock ? 'is-custom' : 'is-unstocked'}`}
                                        >
                                            {item.name_cn}
                                            {item.in_stock && <Check size={11} className="im-tag-check" />}
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteCustom(e, item.ing_id)}
                                            className="im-tag-delete-btn"
                                            title="删除"
                                        >
                                            <X size={10} />
                                        </button>
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
