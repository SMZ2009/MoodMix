/**
 * EntityExtractor - 饮品实体提取器
 * 
 * 从用户输入中提取:
 * 1. 具体饮品名 (Margarita, 莫吉托, 长岛冰茶)
 * 2. 饮品品类 (威士忌类, 鸡尾酒, 咖啡)
 * 3. 原料/风味 (抹茶, 柠檬, 巧克力)
 */

// 饮品名称词库 (支持中英文 + 别名)
const DRINK_NAME_ALIASES = {
  'margarita': ['玛格丽特', 'margarita', '玛格丽塔', '玛格丽'],
  'mojito': ['莫吉托', 'mojito', '莫西多', '莫希托'],
  'cosmopolitan': ['大都会', 'cosmopolitan', 'cosmo', '柯梦波丹'],
  'long_island': ['长岛冰茶', 'long island', 'long island iced tea', '长岛'],
  'negroni': ['尼格罗尼', 'negroni', '内格罗尼'],
  'old_fashioned': ['古典鸡尾酒', 'old fashioned', '老式鸡尾酒', '古典'],
  'martini': ['马提尼', 'martini', '马天尼', '干马提尼'],
  'whiskey_sour': ['威士忌酸', 'whiskey sour', '威士忌沙瓦'],
  'pina_colada': ['椰林飘香', 'pina colada', '冰镇果汁朗姆酒', '皮纳可乐达'],
  'espresso_martini': ['浓缩咖啡马提尼', 'espresso martini', '咖啡马提尼'],
  'daiquiri': ['戴吉利', 'daiquiri', '黛绮莉'],
  'mai_tai': ['迈泰', 'mai tai', '麦泰'],
  'manhattan': ['曼哈顿', 'manhattan'],
  'bloody_mary': ['血腥玛丽', 'bloody mary'],
  'moscow_mule': ['莫斯科骡子', 'moscow mule', '莫斯科之骡'],
  'gin_tonic': ['金汤力', 'gin tonic', 'gin and tonic', 'g&t', '金酒汤力'],
  'cuba_libre': ['自由古巴', 'cuba libre'],
  'sex_on_the_beach': ['性感海滩', 'sex on the beach'],
  'tequila_sunrise': ['龙舌兰日出', 'tequila sunrise', '特基拉日出'],
  'white_russian': ['白俄罗斯', 'white russian'],
  'black_russian': ['黑俄罗斯', 'black russian'],
  'irish_coffee': ['爱尔兰咖啡', 'irish coffee'],
  'caipirinha': ['卡匹林纳', 'caipirinha'],
  'aperol_spritz': ['阿佩罗气泡', 'aperol spritz', '橙色气泡'],
  'bellini': ['贝利尼', 'bellini'],
  'mimosa': ['含羞草', 'mimosa', '米莫萨'],
  'sidecar': ['边车', 'sidecar'],
  'french_75': ['法国75', 'french 75'],
  'americano': ['美式咖啡', 'americano', '美式'],
  'latte': ['拿铁', 'latte', '咖啡拿铁'],
  'cappuccino': ['卡布奇诺', 'cappuccino'],
  'mocha': ['摩卡', 'mocha'],
  'matcha_latte': ['抹茶拿铁', 'matcha latte'],
};

// 品类词库
const CATEGORY_KEYWORDS = {
  'cocktail': ['鸡尾酒', 'cocktail', '调酒', '特调'],
  'whiskey': ['威士忌', 'whiskey', 'whisky', '波本', 'bourbon', '苏格兰威士忌'],
  'gin': ['金酒', 'gin', '琴酒', '杜松子酒'],
  'rum': ['朗姆', 'rum', '兰姆酒', '朗姆酒'],
  'vodka': ['伏特加', 'vodka'],
  'tequila': ['龙舌兰', 'tequila', '特基拉'],
  'brandy': ['白兰地', 'brandy', '干邑', 'cognac'],
  'liqueur': ['利口酒', 'liqueur', '力娇酒'],
  'coffee': ['咖啡', 'coffee', '拿铁', '美式', '浓缩'],
  'tea': ['茶', 'tea', '奶茶', '茶饮'],
  'mocktail': ['无酒精', 'mocktail', '软饮', '零度', '不含酒精', '无醇'],
  'shot': ['烈酒', 'shot', '纯饮', '短饮'],
  'highball': ['嗨棒', 'highball', '长饮', '高杯'],
  'beer': ['啤酒', 'beer', '精酿', 'ipa', '拉格'],
  'wine': ['葡萄酒', 'wine', '红酒', '白葡萄酒', '起泡酒'],
  'champagne': ['香槟', 'champagne', '气泡酒'],
  'sake': ['清酒', 'sake', '日本酒'],
  'soju': ['烧酒', 'soju', '韩国烧酒'],
};

// 风味/原料词库
const FLAVOR_KEYWORDS = {
  'matcha': ['抹茶', 'matcha', '绿茶'],
  'chocolate': ['巧克力', 'chocolate', '可可', 'cocoa'],
  'citrus': ['柑橘', 'citrus', '柠檬', '橙子', '青柠', 'lime', 'lemon', 'orange', '橙味', '柠檬味'],
  'berry': ['莓果', 'berry', '草莓', '蓝莓', '覆盆子', 'strawberry', 'blueberry', 'raspberry'],
  'tropical': ['热带', 'tropical', '菠萝', '椰子', '芒果', 'pineapple', 'coconut', 'mango', '百香果'],
  'mint': ['薄荷', 'mint', '清凉'],
  'ginger': ['姜', 'ginger', '生姜', '姜味'],
  'honey': ['蜂蜜', 'honey', '蜜'],
  'vanilla': ['香草', 'vanilla', '云呢拿'],
  'coffee_flavor': ['咖啡味', 'espresso', '浓缩', '咖啡香'],
  'cream': ['奶油', 'cream', '奶香', '奶味', '牛奶'],
  'spicy': ['辛辣', 'spicy', '辣', '胡椒'],
  'bitter': ['苦', 'bitter', '苦味'],
  'sweet': ['甜', 'sweet', '甜蜜', '甜味', '甜的'],
  'sour': ['酸', 'sour', '酸味', '酸的'],
  'smoky': ['烟熏', 'smoky', '烟熏味'],
  'herbal': ['草本', 'herbal', '草药', '香草'],
  'fruity': ['果味', 'fruity', '水果', '果香'],
  'floral': ['花香', 'floral', '花味', '玫瑰'],
  'nutty': ['坚果', 'nutty', '杏仁', '榛子'],
  'caramel': ['焦糖', 'caramel', '太妃'],
  'ice': ['冰', 'ice', '冰的', '冰镇', '加冰', '冷'],
  'hot': ['热', 'hot', '热的', '温热', '暖'],
};

/**
 * 从用户输入中提取饮品相关实体
 * @param {string} userInput - 用户输入
 * @returns {Object} 提取结果
 */
export function extractEntities(userInput) {
  const input = userInput.toLowerCase();
  const result = {
    drinkNames: [],      // 精确饮品名
    categories: [],      // 品类
    flavors: [],         // 风味/原料
    confidence: 0,       // 提取置信度
    remainingInput: ''   // 剩余情绪描述部分
  };
  
  let matchedTerms = [];
  
  // 1. 提取饮品名 (按别名长度降序匹配，优先匹配长词)
  for (const [key, aliases] of Object.entries(DRINK_NAME_ALIASES)) {
    const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      if (input.includes(alias.toLowerCase())) {
        // 避免重复添加同一个key
        if (!result.drinkNames.some(d => d.key === key)) {
          result.drinkNames.push({ key, matched: alias });
          matchedTerms.push(alias);
        }
        break; // 同一个饮品只匹配一次
      }
    }
  }
  
  // 2. 提取品类
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
    for (const keyword of sortedKeywords) {
      if (input.includes(keyword.toLowerCase())) {
        if (!result.categories.some(c => c.key === key)) {
          result.categories.push({ key, matched: keyword });
          matchedTerms.push(keyword);
        }
        break;
      }
    }
  }
  
  // 3. 提取风味/原料
  for (const [key, keywords] of Object.entries(FLAVOR_KEYWORDS)) {
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
    for (const keyword of sortedKeywords) {
      if (input.includes(keyword.toLowerCase())) {
        if (!result.flavors.some(f => f.key === key)) {
          result.flavors.push({ key, matched: keyword });
          matchedTerms.push(keyword);
        }
        break;
      }
    }
  }
  
  // 4. 计算置信度
  const totalMatches = result.drinkNames.length + result.categories.length + result.flavors.length;
  // 饮品名权重高，品类次之，风味最低
  const weightedScore = result.drinkNames.length * 0.5 + 
                        result.categories.length * 0.3 + 
                        result.flavors.length * 0.2;
  result.confidence = Math.min(weightedScore, 1);
  
  // 5. 提取剩余情绪部分 (移除已匹配的实体词)
  let remaining = userInput;
  // 按长度降序排序，先移除长词
  const sortedTerms = [...matchedTerms].sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    remaining = remaining.replace(new RegExp(escapeRegExp(term), 'gi'), '');
  }
  // 清理多余的标点和空格
  result.remainingInput = remaining
    .replace(/[,，、。.!！?？\s]+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .trim();
  
  return result;
}

/**
 * 模糊匹配 (Levenshtein距离)
 * @param {string} input - 输入字符串
 * @param {string} target - 目标字符串
 * @param {number} threshold - 相似度阈值
 * @returns {Object} 匹配结果
 */
export function fuzzyMatch(input, target, threshold = 0.6) {
  if (!input || !target) return { match: false, similarity: 0 };
  
  const distance = levenshteinDistance(input.toLowerCase(), target.toLowerCase());
  const maxLen = Math.max(input.length, target.length);
  const similarity = 1 - (distance / maxLen);
  return { match: similarity >= threshold, similarity };
}

/**
 * Levenshtein距离计算
 */
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 获取所有支持的饮品名列表 (用于调试)
 */
export function getSupportedDrinkNames() {
  return Object.keys(DRINK_NAME_ALIASES);
}

/**
 * 获取所有支持的品类列表 (用于调试)
 */
export function getSupportedCategories() {
  return Object.keys(CATEGORY_KEYWORDS);
}

/**
 * 获取所有支持的风味列表 (用于调试)
 */
export function getSupportedFlavors() {
  return Object.keys(FLAVOR_KEYWORDS);
}

export default {
  extractEntities,
  fuzzyMatch,
  getSupportedDrinkNames,
  getSupportedCategories,
  getSupportedFlavors
};
