import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, RotateCcw, Check } from 'lucide-react';

const IngredientEditModal = ({ currentIngredients, onUpdate, onClose, onReset }) => {
    const [list, setList] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        setList(currentIngredients || []);
    }, [currentIngredients]);

    const handleAdd = () => {
        const val = inputValue.trim();
        if (val && !list.includes(val)) {
            setList([...list, val]);
            setInputValue('');
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    const handleRemove = (item) => {
        setList(prev => prev.filter(i => i !== item));
    };

    const handleSave = () => {
        onUpdate(list);
        onClose();
    };

    return (
        <div
            className="p-6 bg-white/80 backdrop-blur-2xl rounded-[2.5rem] w-full max-h-[80vh] flex flex-col shadow-2xl border border-white/60 mx-auto"
            style={{ maxWidth: '440px' }}
        >
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight" style={{ fontFamily: 'serif' }}>调整当前可用原料</h2>
                <button
                    onClick={onClose}
                    className="p-2 -mr-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/40"
                >
                    <X size={22} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px] px-1">
                {/* 输入框 */}
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-0 bg-white/40 rounded-2xl border border-white/60 group-focus-within:border-purple-300 transition-all duration-300" />
                        <input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="手动添加原料 (如: 冰块)"
                            className="relative w-full px-5 py-3 bg-transparent text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={!inputValue.trim()}
                        className="relative w-12 h-12 flex items-center justify-center bg-indigo-400/80 text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-500/80 transition-all active:scale-90 shadow-lg shadow-indigo-200"
                    >
                        <Plus size={24} />
                    </button>
                </div>

                {/* 标签列表 */}
                <div className="flex flex-wrap gap-2.5 mb-20 pb-4">
                    {list.length === 0 ? (
                        <div className="w-full text-center py-16 flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                                <Plus size={24} />
                            </div>
                            <p className="text-gray-400 text-sm font-light">暂无原料，请添加或重置</p>
                        </div>
                    ) : (
                        list.map((item, index) => (
                            <div
                                key={`${item}-${index}`}
                                className="group flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur-md border border-white/80 text-gray-700 text-[13px] font-medium rounded-xl hover:bg-white/90 hover:border-purple-200 transition-all duration-300 shadow-sm"
                            >
                                <span>{item}</span>
                                <button
                                    onClick={() => handleRemove(item)}
                                    className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 底部按钮 */}
            <div className="pt-5 border-t border-gray-100/50 flex gap-3">
                <button
                    onClick={onReset}
                    className="px-6 py-4 flex items-center justify-center gap-2 text-gray-500 bg-white/40 backdrop-blur-md border border-white/60 hover:bg-white/60 rounded-[1.25rem] font-medium transition-all active:scale-95"
                >
                    <RotateCcw size={18} />
                    <span>重置</span>
                </button>
                <button
                    onClick={handleSave}
                    className="flex-1 px-6 py-4 flex items-center justify-center gap-2 text-white rounded-[1.25rem] font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 overflow-hidden group relative"
                    style={{
                        background: 'linear-gradient(135deg, #A5B4FC 0%, #F9A8D4 100%)',
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <Check size={20} />
                    <span className="relative z-10">确认修改 ({list.length})</span>
                </button>
            </div>
        </div>
    );
};

export default IngredientEditModal;
