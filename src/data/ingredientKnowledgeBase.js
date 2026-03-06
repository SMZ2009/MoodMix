/**
 * 配料知识库 (Ingredient Knowledge Base)
 * 
 * 每种配料的八维属性数据，用于推导饮品整体维度。
 * 
 * 参考来源:
 * - 味觉: 《The Flavor Bible》(Karen Page, 2008), 《On Food and Cooking》(Harold McGee)
 * - 寒热: 《中药学》统编教材(第十版), 《本草纲目》
 * - 香气: 《The Oxford Companion to Spirits and Cocktails》(2021), WSET品鉴体系
 * - ABV:  IBA官方配方, Difford's Guide
 * 
 * 字段说明:
 *   cat: 分类 (spirit/liqueur/juice/mixer/sweetener/dairy/garnish/spice/other)
 *   taste: [酸sour, 苦bitter, 甘sweet, 辛spicy, 咸salty] (0-10)
 *   nature: 中药四气 (-2寒, -1凉, 0平, 1温, 2热)
 *   aroma: 香气类型数组 (herb草本/citrus柑橘/floral花香/spice辛香/roast焦烤/fruit果香/mineral矿物)
 *   color: [主色hex, 透明度 0-10 (10=全透明)]
 *   abv: 典型酒精度%
 *   burn: 灼烧感强度 0-10
 *   efferv: 气泡感 0-10
 *   smooth: 丝滑/粘稠贡献 0-10
 */

// ─── 紧凑格式: [cat, [s,b,sw,sp,sa], nature, [aromas], [hex,transparency], abv, burn, efferv, smooth]
const _RAW = {
    // ═══ 烈酒 SPIRITS ═══
    'gin': ['spirit', [0, 2, 0, 5, 0], 1, ['herb', 'spice'], ['#F5F5DC', 9], 40, 7, 0, 1],
    'vodka': ['spirit', [0, 0, 0, 2, 0], 0, ['mineral'], ['#FFFFFF', 10], 40, 7, 0, 2],
    'light rum': ['spirit', [0, 0, 2, 1, 0], 1, ['fruit', 'herb'], ['#FFFDE7', 9], 40, 6, 0, 2],
    'dark rum': ['spirit', [0, 1, 4, 1, 0], 2, ['roast', 'fruit'], ['#5D2906', 3], 40, 7, 0, 3],
    'gold rum': ['spirit', [0, 0, 3, 1, 0], 1, ['fruit', 'roast'], ['#DAA520', 5], 40, 6, 0, 2],
    'añejo rum': ['spirit', [0, 1, 3, 1, 0], 2, ['roast', 'spice'], ['#8B4513', 3], 40, 7, 0, 3],
    '151 proof rum': ['spirit', [0, 0, 1, 3, 0], 2, ['roast'], ['#B8860B', 5], 75, 10, 0, 1],
    'coconut rum': ['spirit', [0, 0, 5, 0, 0], 1, ['fruit'], ['#FFFDE7', 9], 21, 3, 0, 3],
    'tequila': ['spirit', [0, 1, 1, 3, 0], 1, ['herb', 'mineral'], ['#FFFDE7', 9], 40, 7, 0, 1],
    'bourbon': ['spirit', [0, 2, 3, 2, 0], 2, ['roast', 'spice'], ['#B5651D', 4], 45, 8, 0, 2],
    'blended whiskey': ['spirit', [0, 2, 2, 2, 0], 1, ['roast', 'spice'], ['#C68E17', 5], 40, 7, 0, 2],
    'irish whiskey': ['spirit', [0, 1, 3, 1, 0], 1, ['roast', 'fruit'], ['#DAA520', 6], 40, 6, 0, 3],
    'scotch': ['spirit', [0, 2, 1, 3, 0], 2, ['roast', 'spice'], ['#B5651D', 4], 43, 8, 0, 2],
    'blended scotch': ['spirit', [0, 2, 2, 2, 0], 1, ['roast', 'spice'], ['#C68E17', 5], 40, 7, 0, 2],
    'brandy': ['spirit', [0, 1, 3, 1, 0], 2, ['fruit', 'roast'], ['#8B4513', 3], 40, 7, 0, 3],
    'cognac': ['spirit', [0, 1, 3, 1, 0], 2, ['fruit', 'roast', 'floral'], ['#8B4513', 3], 40, 7, 0, 4],
    'apple brandy': ['spirit', [2, 1, 3, 0, 0], 1, ['fruit'], ['#DAA520', 5], 40, 6, 0, 2],
    'apricot brandy': ['spirit', [1, 0, 5, 0, 0], 0, ['fruit'], ['#FFB347', 4], 24, 4, 0, 3],
    'cherry brandy': ['spirit', [1, 1, 5, 0, 0], 0, ['fruit'], ['#C0392B', 3], 24, 4, 0, 3],
    'blackberry brandy': ['spirit', [1, 1, 4, 0, 0], 0, ['fruit'], ['#4A0E2E', 2], 24, 4, 0, 3],
    'coffee brandy': ['spirit', [0, 4, 3, 0, 0], 1, ['roast'], ['#3E2723', 1], 24, 4, 0, 3],
    'cachaca': ['spirit', [0, 0, 2, 2, 0], 1, ['herb', 'fruit'], ['#FFFDE7', 9], 40, 7, 0, 1],
    'absinthe': ['spirit', [0, 5, 1, 4, 0], 2, ['herb', 'spice'], ['#7FBF7F', 5], 65, 9, 0, 1],
    'everclear': ['spirit', [0, 0, 0, 3, 0], 2, ['mineral'], ['#FFFFFF', 10], 95, 10, 0, 0],
    'applejack': ['spirit', [2, 1, 2, 1, 0], 1, ['fruit'], ['#DAA520', 6], 40, 6, 0, 2],
    'firewater': ['spirit', [0, 0, 0, 5, 0], 2, ['spice'], ['#FFFFFF', 10], 50, 9, 0, 0],

    // ═══ 伏特加品牌 ═══
    'absolut vodka': ['spirit', [0, 0, 0, 2, 0], 0, ['mineral'], ['#FFFFFF', 10], 40, 7, 0, 2],
    'absolut citron': ['spirit', [2, 0, 1, 1, 0], 0, ['citrus'], ['#FFFDE7', 9], 40, 6, 0, 2],
    'absolut kurant': ['spirit', [1, 0, 2, 1, 0], 0, ['fruit'], ['#FFFDE7', 9], 40, 6, 0, 2],
    'cranberry vodka': ['spirit', [2, 0, 1, 1, 0], 0, ['fruit'], ['#FFB6C1', 7], 35, 5, 0, 2],

    // ═══ 威士忌品牌 ═══
    'jack daniels': ['spirit', [0, 2, 2, 2, 0], 2, ['roast', 'spice'], ['#8B4513', 4], 40, 7, 0, 2],
    'jim beam': ['spirit', [0, 2, 3, 2, 0], 2, ['roast', 'spice'], ['#B5651D', 4], 40, 7, 0, 2],
    'johnnie walker': ['spirit', [0, 2, 2, 2, 0], 1, ['roast', 'spice'], ['#C68E17', 5], 40, 7, 0, 2],
    'crown royal': ['spirit', [0, 1, 3, 1, 0], 1, ['fruit', 'roast'], ['#DAA520', 5], 40, 6, 0, 3],

    // ═══ 利口酒 LIQUEURS ═══
    'triple sec': ['liqueur', [1, 1, 7, 0, 0], 0, ['citrus'], ['#FFFFFF', 9], 30, 3, 0, 2],
    'cointreau': ['liqueur', [1, 1, 7, 0, 0], 0, ['citrus'], ['#FFFFFF', 9], 40, 4, 0, 2],
    'grand marnier': ['liqueur', [1, 1, 7, 0, 0], 1, ['citrus', 'roast'], ['#D2691E', 5], 40, 5, 0, 3],
    'blue curacao': ['liqueur', [0, 1, 7, 0, 0], 0, ['citrus'], ['#0080FF', 3], 25, 3, 0, 2],
    'campari': ['liqueur', [1, 9, 3, 1, 0], -1, ['herb', 'spice'], ['#C0392B', 2], 25, 4, 0, 2],
    'aperol': ['liqueur', [1, 6, 4, 1, 0], -1, ['herb', 'citrus'], ['#FF6347', 3], 11, 2, 0, 2],
    'amaretto': ['liqueur', [0, 2, 8, 0, 0], 1, ['roast', 'fruit'], ['#8B4513', 4], 28, 3, 0, 4],
    'kahlua': ['liqueur', [0, 4, 6, 0, 0], 0, ['roast'], ['#1A0E00', 1], 20, 2, 0, 4],
    'coffee liqueur': ['liqueur', [0, 4, 6, 0, 0], 0, ['roast'], ['#1A0E00', 1], 20, 2, 0, 4],
    'baileys irish cream': ['liqueur', [0, 1, 7, 0, 0], 0, ['roast', 'fruit'], ['#C8A96E', 2], 17, 1, 0, 8],
    'irish cream': ['liqueur', [0, 1, 7, 0, 0], 0, ['roast', 'fruit'], ['#C8A96E', 2], 17, 1, 0, 8],
    'banana liqueur': ['liqueur', [0, 0, 8, 0, 0], 0, ['fruit'], ['#FFE135', 4], 20, 1, 0, 4],
    'chambord raspberry liqueur': ['liqueur', [1, 0, 8, 0, 0], 0, ['fruit'], ['#6B003A', 2], 16, 1, 0, 5],
    'galliano': ['liqueur', [0, 2, 6, 2, 0], 1, ['herb', 'spice'], ['#FFD700', 4], 30, 3, 0, 3],
    'frangelico': ['liqueur', [0, 1, 7, 0, 0], 0, ['roast', 'fruit'], ['#8B6914', 4], 20, 2, 0, 4],
    'godiva liqueur': ['liqueur', [0, 2, 8, 0, 0], 0, ['roast'], ['#3E2723', 1], 15, 1, 0, 7],
    'chocolate liqueur': ['liqueur', [0, 3, 7, 0, 0], 0, ['roast'], ['#3E2723', 1], 20, 2, 0, 6],
    'coconut liqueur': ['liqueur', [0, 0, 7, 0, 0], 0, ['fruit'], ['#FFFDE7', 8], 20, 1, 0, 4],
    'green chartreuse': ['liqueur', [0, 5, 4, 3, 0], 1, ['herb', 'spice'], ['#7FBF7F', 4], 55, 7, 0, 2],
    'green creme de menthe': ['liqueur', [0, 1, 7, 4, 0], -1, ['herb', 'spice'], ['#00A86B', 4], 25, 3, 0, 3],
    'creme de cacao': ['liqueur', [0, 2, 8, 0, 0], 0, ['roast'], ['#3E2723', 1], 25, 2, 0, 5],
    'creme de cassis': ['liqueur', [1, 1, 8, 0, 0], 0, ['fruit'], ['#4A0E2E', 2], 15, 1, 0, 5],
    'advocaat': ['liqueur', [0, 0, 8, 0, 0], 1, ['roast', 'fruit'], ['#FFD700', 2], 15, 1, 0, 9],
    'black sambuca': ['liqueur', [0, 2, 7, 3, 0], 1, ['spice', 'herb'], ['#1A1A2E', 1], 40, 6, 0, 2],
    'goldschlager': ['liqueur', [0, 1, 6, 4, 0], 2, ['spice'], ['#FFD700', 5], 44, 7, 0, 2],
    'hot damn': ['liqueur', [0, 0, 5, 6, 0], 2, ['spice'], ['#C0392B', 4], 30, 6, 0, 2],
    'hpnotiq': ['liqueur', [1, 0, 7, 0, 0], 0, ['fruit'], ['#00CED1', 4], 17, 1, 0, 3],
    'jägermeister': ['liqueur', [0, 5, 4, 3, 0], 1, ['herb', 'spice'], ['#1A0E00', 1], 35, 5, 0, 3],
    'cherry heering': ['liqueur', [1, 1, 6, 0, 0], 0, ['fruit'], ['#8B0000', 2], 24, 3, 0, 4],
    'elderflower cordial': ['liqueur', [1, 0, 7, 0, 0], -1, ['floral'], ['#FFFACD', 8], 0, 0, 0, 3],
    'dubonnet rouge': ['liqueur', [1, 3, 5, 1, 0], 0, ['herb', 'spice'], ['#8B0000', 3], 15, 2, 0, 3],

    // ═══ 味美思 VERMOUTH ═══
    'dry vermouth': ['liqueur', [1, 3, 1, 2, 0], -1, ['herb', 'floral'], ['#FFFDE7', 8], 18, 2, 0, 2],
    'sweet vermouth': ['liqueur', [1, 3, 5, 1, 0], 0, ['herb', 'spice', 'floral'], ['#8B0000', 3], 16, 2, 0, 3],

    // ═══ 葡萄酒/起泡 ═══
    'champagne': ['wine', [2, 1, 2, 0, 0], -1, ['floral', 'fruit'], ['#FFFACD', 8], 12, 1, 8, 2],
    'beer': ['wine', [0, 3, 2, 0, 0], -1, ['roast', 'herb'], ['#DAA520', 5], 5, 1, 7, 2],
    'ale': ['wine', [0, 4, 3, 0, 0], 0, ['roast', 'herb'], ['#B5651D', 4], 5, 1, 6, 3],
    'guinness stout': ['wine', [0, 5, 3, 0, 0], 0, ['roast'], ['#1A0E00', 1], 4, 1, 5, 5],
    'corona': ['wine', [0, 2, 1, 0, 0], -1, ['herb'], ['#FFE4B5', 7], 5, 0, 7, 1],
    'cider': ['wine', [3, 1, 3, 0, 0], -1, ['fruit'], ['#DAA520', 6], 5, 0, 5, 2],
    'apple cider': ['mixer', [3, 0, 4, 0, 0], -1, ['fruit'], ['#DAA520', 6], 0, 0, 0, 2],

    // ═══ 果汁 JUICES ═══
    'lime juice': ['juice', [9, 1, 1, 0, 0], -1, ['citrus'], ['#C8D96F', 7], 0, 0, 0, 1],
    'lime': ['juice', [8, 1, 1, 0, 0], -1, ['citrus'], ['#C8D96F', 7], 0, 0, 0, 1],
    'lemon juice': ['juice', [8, 1, 1, 0, 0], -1, ['citrus'], ['#FFF8DC', 8], 0, 0, 0, 1],
    'lemon': ['juice', [7, 1, 1, 0, 0], -1, ['citrus'], ['#FFF44F', 7], 0, 0, 0, 1],
    'orange juice': ['juice', [3, 0, 5, 0, 0], 0, ['citrus', 'fruit'], ['#FFA500', 4], 0, 0, 0, 2],
    'cranberry juice': ['juice', [5, 1, 3, 0, 0], -1, ['fruit'], ['#DC143C', 3], 0, 0, 0, 2],
    'grapefruit juice': ['juice', [5, 3, 2, 0, 0], -1, ['citrus'], ['#FFB6C1', 5], 0, 0, 0, 1],
    'pineapple juice': ['juice', [3, 0, 6, 0, 0], 0, ['fruit'], ['#FFD700', 5], 0, 0, 0, 3],
    'tomato juice': ['juice', [2, 0, 2, 0, 2], -1, ['herb'], ['#FF4500', 2], 0, 0, 0, 4],
    'grape juice': ['juice', [2, 0, 7, 0, 0], 0, ['fruit'], ['#6B3FA0', 3], 0, 0, 0, 3],
    'cherry juice': ['juice', [3, 1, 5, 0, 0], 0, ['fruit'], ['#DC143C', 3], 0, 0, 0, 3],
    'fruit punch': ['juice', [2, 0, 7, 0, 0], 0, ['fruit'], ['#FF6347', 3], 0, 0, 0, 3],

    // ═══ 碳酸/汽水 MIXERS ═══
    'soda water': ['mixer', [0, 0, 0, 0, 0], 0, ['mineral'], ['#FFFFFF', 10], 0, 0, 8, 0],
    'carbonated water': ['mixer', [0, 0, 0, 0, 0], 0, ['mineral'], ['#FFFFFF', 10], 0, 0, 8, 0],
    'tonic water': ['mixer', [0, 3, 2, 0, 0], -1, ['herb'], ['#FFFFFF', 9], 0, 0, 7, 1],
    'coca-cola': ['mixer', [0, 0, 7, 0, 0], 0, ['spice'], ['#1A0E00', 1], 0, 0, 7, 2],
    '7-up': ['mixer', [1, 0, 6, 0, 0], 0, ['citrus'], ['#FFFFFF', 10], 0, 0, 8, 1],
    'grape soda': ['mixer', [0, 0, 8, 0, 0], 0, ['fruit'], ['#6B3FA0', 3], 0, 0, 7, 2],
    'ginger ale': ['mixer', [0, 0, 4, 2, 0], 1, ['spice'], ['#FFE4B5', 8], 0, 0, 6, 1],
    'ginger beer': ['mixer', [0, 0, 3, 4, 0], 1, ['spice'], ['#FFE4B5', 7], 0, 0, 7, 1],

    // ═══ 甜味剂 SWEETENERS ═══
    'sugar': ['sweet', [0, 0, 10, 0, 0], 0, [], ['#FFFFFF', 9], 0, 0, 0, 3],
    'demerara sugar': ['sweet', [0, 0, 9, 0, 0], 0, ['roast'], ['#DAA520', 7], 0, 0, 0, 3],
    'simple syrup': ['sweet', [0, 0, 10, 0, 0], 0, [], ['#FFFFFF', 9], 0, 0, 0, 4],
    'grenadine': ['sweet', [0, 0, 9, 0, 0], 0, ['fruit'], ['#C0392B', 2], 0, 0, 0, 5],
    'honey': ['sweet', [0, 0, 9, 0, 0], 0, ['floral'], ['#DAA520', 4], 0, 0, 0, 6],
    'chocolate syrup': ['sweet', [0, 2, 8, 0, 0], 0, ['roast'], ['#3E2723', 1], 0, 0, 0, 7],
    'maple syrup': ['sweet', [0, 0, 9, 0, 0], 1, ['roast'], ['#8B4513', 3], 0, 0, 0, 5],

    // ═══ 乳制品/蛋 DAIRY ═══
    'heavy cream': ['dairy', [0, 0, 3, 0, 0], 0, [], ['#FFFDD0', 6], 0, 0, 0, 9],
    'cream': ['dairy', [0, 0, 3, 0, 0], 0, [], ['#FFFDD0', 6], 0, 0, 0, 9],
    'milk': ['dairy', [0, 0, 3, 0, 0], -1, [], ['#FFFFFF', 5], 0, 0, 0, 7],
    'egg': ['dairy', [0, 0, 1, 0, 0], 0, [], ['#FFE4B5', 6], 0, 0, 0, 7],
    'egg yolk': ['dairy', [0, 0, 2, 0, 0], 1, [], ['#FFD700', 3], 0, 0, 0, 8],
    'egg white': ['dairy', [0, 0, 0, 0, 0], 0, [], ['#FFFFFF', 7], 0, 0, 0, 6],
    'chocolate ice-cream': ['dairy', [0, 2, 8, 0, 0], 0, ['roast'], ['#3E2723', 1], 0, 0, 0, 9],
    'hot chocolate': ['dairy', [0, 3, 7, 0, 0], 1, ['roast'], ['#3E2723', 1], 0, 0, 0, 7],
    'whipped cream': ['dairy', [0, 0, 3, 0, 0], 0, [], ['#FFFFFF', 5], 0, 0, 0, 9],
    'yoghurt': ['dairy', [3, 0, 2, 0, 0], -1, [], ['#FFFFFF', 4], 0, 0, 0, 7],

    // ═══ 咖啡/茶 ═══
    'coffee': ['mixer', [1, 6, 0, 0, 0], 1, ['roast'], ['#1A0E00', 1], 0, 0, 0, 2],
    'espresso': ['mixer', [1, 7, 0, 0, 0], 1, ['roast'], ['#1A0E00', 1], 0, 0, 0, 3],
    'tea': ['mixer', [1, 3, 0, 0, 0], -1, ['herb', 'floral'], ['#DAA520', 6], 0, 0, 0, 1],
    'cocoa powder': ['mixer', [0, 5, 1, 0, 0], 0, ['roast'], ['#5D2906', 2], 0, 0, 0, 2],
    'chocolate': ['sweet', [0, 4, 6, 0, 0], 0, ['roast'], ['#3E2723', 1], 0, 0, 0, 5],

    // ═══ 苦精 BITTERS ═══
    'bitters': ['spice', [0, 8, 1, 3, 0], 1, ['herb', 'spice'], ['#8B4513', 4], 45, 1, 0, 0],
    'angostura bitters': ['spice', [0, 8, 1, 3, 0], 1, ['herb', 'spice'], ['#8B4513', 4], 45, 1, 0, 0],
    'orange bitters': ['spice', [0, 7, 1, 2, 0], 0, ['citrus', 'herb'], ['#D2691E', 5], 28, 1, 0, 0],
    'peychaud bitters': ['spice', [0, 7, 2, 3, 0], 1, ['spice', 'floral'], ['#C0392B', 4], 35, 1, 0, 0],

    // ═══ 香料/装饰 SPICE & GARNISH ═══
    'mint': ['garnish', [0, 1, 0, 3, 0], -2, ['herb'], ['#00A86B', 7], 0, 0, 0, 0],
    'ginger': ['spice', [0, 0, 0, 7, 0], 2, ['spice'], ['#FFD700', 6], 0, 1, 0, 0],
    'cinnamon': ['spice', [0, 1, 2, 5, 0], 2, ['spice'], ['#8B4513', 5], 0, 0, 0, 0],
    'nutmeg': ['spice', [0, 1, 1, 4, 0], 1, ['spice'], ['#C68E17', 5], 0, 0, 0, 0],
    'salt': ['garnish', [0, 0, 0, 0, 10], 0, [], ['#FFFFFF', 9], 0, 0, 0, 0],
    'olive': ['garnish', [0, 2, 0, 0, 3], 0, [], ['#556B2F', 5], 0, 0, 0, 1],
    'tabasco sauce': ['spice', [1, 0, 0, 9, 0], 2, ['spice'], ['#FF4500', 3], 0, 2, 0, 0],
    'worcestershire sauce': ['spice', [2, 1, 1, 1, 4], 0, ['spice'], ['#3E2723', 2], 0, 0, 0, 1],
    'berries': ['garnish', [2, 0, 5, 0, 0], -1, ['fruit'], ['#800020', 3], 0, 0, 0, 2],
    'kiwi': ['garnish', [4, 0, 4, 0, 0], -1, ['fruit'], ['#7CFC00', 5], 0, 0, 0, 2],
    'grapes': ['garnish', [2, 0, 6, 0, 0], 0, ['fruit'], ['#6B3FA0', 4], 0, 0, 0, 2],
    'cantaloupe': ['garnish', [0, 0, 6, 0, 0], -1, ['fruit'], ['#FFA62F', 4], 0, 0, 0, 3],
    'cranberries': ['garnish', [5, 1, 2, 0, 0], -1, ['fruit'], ['#DC143C', 3], 0, 0, 0, 1],
    'angelica root': ['spice', [0, 3, 1, 2, 0], 1, ['herb'], ['#C68E17', 6], 0, 0, 0, 0],
    'peach nectar': ['juice', [1, 0, 7, 0, 0], 0, ['fruit'], ['#FFD700', 4], 0, 0, 0, 4],
    'lemon peel': ['garnish', [3, 2, 0, 1, 0], -1, ['citrus'], ['#FFF44F', 7], 0, 0, 0, 0],
    'orange peel': ['garnish', [1, 2, 1, 1, 0], 0, ['citrus'], ['#FFA500', 6], 0, 0, 0, 0],

    // ═══ 其他 ICE & WATER ═══
    'ice': ['other', [0, 0, 0, 0, 0], -2, [], ['#FFFFFF', 10], 0, 0, 0, 0],
    'water': ['other', [0, 0, 0, 0, 0], 0, [], ['#FFFFFF', 10], 0, 0, 0, 0],
    'hot water': ['other', [0, 0, 0, 0, 0], 2, [], ['#FFFFFF', 10], 0, 0, 0, 0],
};

// ─── 解构为可用对象 ───
function expand(raw) {
    const [cat, taste, nature, aroma, color, abv, burn, efferv, smooth] = raw;
    return {
        cat,
        taste: { sour: taste[0], bitter: taste[1], sweet: taste[2], spicy: taste[3], salty: taste[4] },
        nature,   // -2寒 -1凉 0平 1温 2热
        aroma,    // string[]
        color: { hex: color[0], transparency: color[1] },
        abv,      // 0-95
        burn,     // 0-10
        efferv,   // 0-10
        smooth,   // 0-10
    };
}

// 缓存展开后的知识库
const _cache = {};

/**
 * 根据配料名获取知识库数据
 * @param {string} name - 配料英文名（大小写不敏感）
 * @returns {object|null} 配料属性对象
 */
export function getIngredientData(name) {
    if (!name) return null;
    const key = name.trim().toLowerCase();

    // 缓存命中
    if (_cache[key]) return _cache[key];

    // 精确匹配
    if (_RAW[key]) {
        _cache[key] = expand(_RAW[key]);
        return _cache[key];
    }

    // 模糊匹配：去掉品牌前缀、单复数、尝试部分匹配
    for (const [k, v] of Object.entries(_RAW)) {
        if (key.includes(k) || k.includes(key)) {
            _cache[key] = expand(v);
            return _cache[key];
        }
    }

    // 通过类别关键词推断默认值
    const defaults = {
        rum: _RAW['light rum'],
        whiskey: _RAW['blended whiskey'],
        whisky: _RAW['blended scotch'],
        vodka: _RAW['vodka'],
        gin: _RAW['gin'],
        brandy: _RAW['brandy'],
        tequila: _RAW['tequila'],
        juice: _RAW['orange juice'],
        cream: _RAW['heavy cream'],
        liqueur: _RAW['triple sec'],
        syrup: _RAW['simple syrup'],
        schnapps: _RAW['triple sec'],
        wine: _RAW['champagne'],
        soda: _RAW['soda water'],
        beer: _RAW['beer'],
        bitters: _RAW['bitters'],
    };

    for (const [keyword, fallback] of Object.entries(defaults)) {
        if (key.includes(keyword)) {
            _cache[key] = expand(fallback);
            return _cache[key];
        }
    }

    // 最终回退：中性无属性
    _cache[key] = expand(['other', [0, 0, 0, 0, 0], 0, [], ['#CCCCCC', 5], 0, 0, 0, 0]);
    return _cache[key];
}

/**
 * 获取所有已知配料名列表
 */
export function getAllKnownIngredients() {
    return Object.keys(_RAW);
}

/**
 * 检查配料是否在知识库中（精确匹配）
 */
export function isKnownIngredient(name) {
    if (!name) return false;
    return !!_RAW[name.trim().toLowerCase()];
}

const ingredientKB = { getIngredientData, getAllKnownIngredients, isKnownIngredient };
export default ingredientKB;
