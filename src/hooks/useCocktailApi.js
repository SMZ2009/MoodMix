import { useState, useCallback, useRef } from 'react';
import {
    searchByName,
    getById,
    getAllDrinks,
    filterByCategory,
    getCategories,
} from '../api/cocktailApi';
import { translateDrinkSteps, translateText } from '../api/translationService';

// 缓存版本号 - 当数据格式变更时更新，强制刷新缓存
const CACHE_VERSION = 'v4_category_11';

/**
 * React Hook：封装 TheCocktailDB API 状态管理
 * 初始加载全量饮品数据，支持分类筛选和搜索
 */
export function useCocktailApi() {
    const [drinks, setDrinks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [categories, setCategories] = useState([]);

    // 全量数据缓存（加载一次后复用）
    const allDrinksCache = useRef(null);
    // 缓存：详情数据
    const detailCache = useRef({});
    // 缓存：分类列表数据
    const categoryCache = useRef({});
    
    // 检查缓存版本，如果不匹配则清空缓存
    const checkCacheVersion = useCallback(() => {
        const storedVersion = localStorage.getItem('moodmix_cache_version');
        if (storedVersion !== CACHE_VERSION) {
            // 版本不匹配，清空所有缓存
            allDrinksCache.current = null;
            detailCache.current = {};
            categoryCache.current = {};
            localStorage.removeItem('moodmix_translation_cache');
            localStorage.setItem('moodmix_cache_version', CACHE_VERSION);
            console.log('[useCocktailApi] Cache version updated, cleared old cache');
        }
    }, []);

    // 搜索防抖 timer
    const searchTimer = useRef(null);

    // 旧分类到新分类的映射
    const CATEGORY_MAPPING = {
        // 旧版中文分类
        '鸡尾酒': 'Cocktail',
        '蒸馏酒': 'Ordinary Drink',
        '烈酒': 'Ordinary Drink',
        '啤酒': 'Beer',
        '葡萄酒': 'Wine',
        '利口酒': 'Liqueur',
        '咖啡': 'Coffee',
        '茶': 'Tea',
        '乳制品': 'Dairy',
        '果汁': 'Juice',
        '软饮': 'Soft Drink',
        // 英文分类保留
        'Cocktail': 'Cocktail',
        'Ordinary Drink': 'Ordinary Drink',
        'Beer': 'Beer',
        'Wine': 'Wine',
        'Liqueur': 'Liqueur',
        'Coffee': 'Coffee',
        'Tea': 'Tea',
        'Dairy': 'Dairy',
        'Juice': 'Juice',
        'Soft Drink': 'Soft Drink',
    };

    // 迁移旧分类到新分类
    const migrateCategory = (drink) => {
        const oldCat = drink.category;
        const newCat = CATEGORY_MAPPING[oldCat];
        if (newCat) {
            return { ...drink, category: newCat };
        }
        return drink;
    };

    /**
     * 加载全部饮品（按首字母 a-z 并发，返回完整数据）
     */
    const loadAll = useCallback(async () => {
        // 检查缓存版本
        checkCacheVersion();
        
        // 如果已经缓存，直接使用
        if (allDrinksCache.current) {
            // 迁移旧分类到新分类
            const migrated = allDrinksCache.current.map(migrateCategory);
            setDrinks(migrated);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const results = await getAllDrinks();
            allDrinksCache.current = results;
            setDrinks(results);
        } catch (err) {
            console.error('loadAll failed:', err);
            setError('无法加载饮品数据，请检查网络连接');
        } finally {
            setLoading(false);
        }
    }, [checkCacheVersion]);

    /**
     * 搜索饮品（带防抖）
     */
    const searchDrinks = useCallback((query) => {
        if (searchTimer.current) {
            clearTimeout(searchTimer.current);
        }

        if (!query || query.trim() === '') {
            // 空搜索 → 显示全部（从缓存）
            if (allDrinksCache.current) {
                setDrinks(allDrinksCache.current);
            }
            return;
        }

        searchTimer.current = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const results = await searchByName(query);
                setDrinks(results);
            } catch (err) {
                console.error('searchDrinks failed:', err);
                setError('搜索失败，请重试');
            } finally {
                setLoading(false);
            }
        }, 500); // 500ms 防抖
    }, []);

    /**
     * 按分类筛选
     */
    const filterDrinksByCategory = useCallback(async (category) => {
        // 检查缓存版本
        checkCacheVersion();
        
        if (category === 'all') {
            // "全部" → 显示缓存的全量数据（需要迁移分类）
            if (allDrinksCache.current) {
                const migrated = allDrinksCache.current.map(migrateCategory);
                setDrinks(migrated);
                return;
            }
            await loadAll();
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // 检查分类缓存
            if (categoryCache.current[category]) {
                setDrinks(categoryCache.current[category]);
                setLoading(false);
                return;
            }

            // 从本地全量缓存按分类过滤（需要迁移分类）
            if (allDrinksCache.current) {
                const migratedData = allDrinksCache.current.map(migrateCategory);
                // 查看原始分类分布
                const oldCounts = {};
                allDrinksCache.current.forEach(d => { oldCounts[d.category] = (oldCounts[d.category] || 0) + 1; });
                console.log('[filterDrinksByCategory] 原始分类分布:', oldCounts);
                
                const filtered = migratedData.filter(d => d.category === category);
                if (filtered.length > 0) {
                    categoryCache.current[category] = filtered;
                    setDrinks(filtered);
                    setLoading(false);
                    return;
                }
            }

            // 本地缓存没有该分类的数据，返回空结果（不调用API避免429）
            console.log('[filterDrinksByCategory] 分类缓存为空:', category);
            setDrinks([]);
            setLoading(false);
        } catch (err) {
            console.error('filterDrinksByCategory failed:', err);
            setError('筛选失败，请重试');
        } finally {
            setLoading(false);
        }
    }, [loadAll, checkCacheVersion]);

    /**
     * 加载单个饮品详情（翻译步骤 + 未翻译的饮品名）
     */
    const loadDrinkDetail = useCallback(async (drink) => {
        // 检查缓存版本
        checkCacheVersion();
        
        // 检查缓存
        const apiId = drink?.apiId;
        if (apiId && detailCache.current[apiId]) {
            return detailCache.current[apiId];
        }

        let result = drink;

        // 如果需要加载详情
        if (drink?.needDetail && apiId) {
            try {
                const detail = await getById(apiId);
                if (detail) result = detail;
            } catch (err) {
                console.error('loadDrinkDetail failed:', err);
            }
        }

        // 翻译制作步骤
        if (result?.steps) {
            result = await translateDrinkSteps(result);
        }

        // 翻译未中文化的饮品名（字典没命中时调 API）
        if (result?.nameEn && (!result.nameCn || result.nameCn === '')) {
            try {
                const translatedName = await translateText(result.nameEn);
                if (translatedName && translatedName !== result.nameEn) {
                    result = { ...result, name: translatedName, nameCn: translatedName };
                }
            } catch {
                // 翻译失败保持英文名
            }
        }

        // 缓存结果
        if (apiId) {
            detailCache.current[apiId] = result;
        }
        return result;
    }, [checkCacheVersion]);

    /**
     * 加载分类列表（静态分类，同步）
     */
    const loadCategories = useCallback(() => {
        const cats = getCategories();
        setCategories(cats);
    }, []);

    return {
        drinks,
        loading,
        error,
        categories,
        searchDrinks,
        filterDrinksByCategory,
        loadAll,
        loadDrinkDetail,
        loadCategories,
    };
}
