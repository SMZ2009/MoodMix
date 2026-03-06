/**
 * 批量生成八维结构化数据脚本
 * 
 * 用法: node scripts/generateDimensionData.js
 * 
 * 功能:
 * 1. 通过 CocktailDB API 拉取所有饮品
 * 2. 对每一款调用 dimensionEngine 计算八维数据
 * 3. 输出为 JSON 文件 (output/dimensions_all.json)
 * 4. 统计配料命中率和覆盖率
 */

const BASE_URL = 'https://www.thecocktaildb.com/api/json/v1/1';

// ─── 内联 parseMeasure 和 computeDimensions（因为 Node 不支持 ES modules import）─── 
// 为避免重复，我们直接 require 编译后的模块或者用动态 import

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function getAllDrinksByLetter() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const allDrinks = [];
    const BATCH = 5;
    const DELAY = 500;

    for (let i = 0; i < letters.length; i += BATCH) {
        const batch = letters.slice(i, i + BATCH);
        console.log(`  Fetching letters: ${batch.join(', ')}...`);
        const promises = batch.map(l =>
            fetchJson(`${BASE_URL}/search.php?f=${l}`)
                .then(d => d.drinks || [])
                .catch(() => [])
        );
        const results = await Promise.all(promises);
        allDrinks.push(...results.flat());
        if (i + BATCH < letters.length) {
            await new Promise(r => setTimeout(r, DELAY));
        }
    }

    // 去重
    const seen = new Set();
    return allDrinks.filter(d => {
        if (!d || seen.has(d.idDrink)) return false;
        seen.add(d.idDrink);
        return true;
    });
}

// ─── 简化版引擎（独立运行，不依赖 ES module） ───

// 配料知识库子集（完整版见 ingredientKnowledgeBase.js）
// 这里动态加载
let _engineModule = null;
let _kbModule = null;

async function loadModules() {
    // 使用动态 import 加载 ES modules
    try {
        _kbModule = await import('../src/data/ingredientKnowledgeBase.js');
        _engineModule = await import('../src/data/dimensionEngine.js');
        console.log('✓ 成功加载 ES modules');
    } catch (e) {
        console.error('✗ 无法加载 ES modules:', e.message);
        console.log('  请确保 Node.js 版本 >= 14 并且 package.json 中有 "type": "module"');
        process.exit(1);
    }
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  八维饮品结构化数据 生成器');
    console.log('═══════════════════════════════════════\n');

    // 加载模块
    await loadModules();
    const { computeDimensions, parseMeasure } = _engineModule;
    const { getIngredientData, isKnownIngredient } = _kbModule;

    // 1. 拉取所有饮品
    console.log('[1/4] 从 CocktailDB 拉取饮品数据...');
    const allDrinks = await getAllDrinksByLetter();
    console.log(`  共获取 ${allDrinks.length} 款饮品\n`);

    // 2. 计算八维数据
    console.log('[2/4] 计算八维结构化数据...');
    const results = [];
    let successCount = 0;
    const unknownIngredients = new Set();
    let totalIngredients = 0;
    let knownIngredients = 0;

    for (const drink of allDrinks) {
        try {
            const dimensions = computeDimensions(drink);
            if (dimensions) {
                results.push({
                    drinkId: drink.idDrink,
                    drinkName: drink.strDrink,
                    category: drink.strCategory,
                    alcoholic: drink.strAlcoholic,
                    glass: drink.strGlass,
                    dimensions,
                });
                successCount++;
            }

            // 统计配料命中率
            for (let i = 1; i <= 15; i++) {
                const ing = drink[`strIngredient${i}`];
                if (!ing || !ing.trim()) break;
                totalIngredients++;
                if (isKnownIngredient(ing)) {
                    knownIngredients++;
                } else {
                    unknownIngredients.add(ing.trim());
                }
            }
        } catch (e) {
            console.error(`  ✗ 处理 ${drink.strDrink} 失败:`, e.message);
        }
    }
    console.log(`  成功: ${successCount}/${allDrinks.length}\n`);

    // 3. 统计
    console.log('[3/4] 统计报告:');
    const hitRate = totalIngredients > 0 ? (knownIngredients / totalIngredients * 100).toFixed(1) : 0;
    console.log(`  配料总数(含重复): ${totalIngredients}`);
    console.log(`  精确命中: ${knownIngredients} (${hitRate}%)`);
    console.log(`  未命中(含模糊匹配回退): ${unknownIngredients.size} 种唯一配料`);
    if (unknownIngredients.size > 0) {
        console.log(`  未精确匹配的配料:`, [...unknownIngredients].sort().join(', '));
    }
    console.log();

    // 4. 输出 JSON
    console.log('[4/4] 输出 JSON...');
    const fs = await import('fs');
    const path = await import('path');
    const outputDir = path.default.join(import.meta.dirname || '.', '..', 'output');
    if (!fs.default.existsSync(outputDir)) {
        fs.default.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.default.join(outputDir, 'dimensions_all.json');
    fs.default.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`  ✓ 已输出到 ${outputPath}`);
    console.log(`  文件大小: ${(fs.default.statSync(outputPath).size / 1024).toFixed(1)} KB`);

    // 输出示例（前3个）
    console.log('\n═══ 示例数据（前3款）═══');
    for (const r of results.slice(0, 3)) {
        console.log(`\n─── ${r.drinkName} ───`);
        console.log(`  味觉主导: ${r.dimensions.taste.physical.dominant}`);
        console.log(`  触觉: ${r.dimensions.texture.physical.description}`);
        console.log(`  温度: ${r.dimensions.temperature.physical.serving_temp} / ${r.dimensions.temperature.philosophy.yin_yang}`);
        console.log(`  颜色: ${r.dimensions.color.physical.primary_color} (${r.dimensions.color.philosophy.wuxing_element})`);
        console.log(`  时序: ${r.dimensions.temporality.physical.ideal_shichen} | ${r.dimensions.temporality.physical.ideal_seasons.join('、')}`);
        console.log(`  香气: ${r.dimensions.aroma.physical.primary_aromas.join('、')}`);
        console.log(`  ABV: ~${r.dimensions.ratio.physical.estimated_abv}% (${r.dimensions.ratio.philosophy.energy_intensity})`);
        console.log(`  动作: ${r.dimensions.ritual.physical.primary_actions.join('、')}`);
    }

    console.log('\n═══ 完成 ═══');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
