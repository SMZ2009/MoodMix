/**
 * 批量添加无酒精饮品到 drinkVectors.js
 * 
 * 分类说明（仅使用已有分类）:
 * - 咖啡: 各类咖啡饮品
 * - 茶: 茶类饮品
 * - 乳制品: 奶基饮品、奶昔
 * - 果汁: 纯果汁、果昔
 * - 软饮: 汽水、柠檬水、Mocktails
 * 
 * 向量维度说明 (八维):
 * [味觉0-10, 触觉-3~3, 温度-5~5, 颜色1-5, 时序0-23, 嗅觉0-10, ABV%(=0), 动作1-5]
 * 
 * 味觉: 0=无味 → 10=极甜/极酸
 * 触觉: -3=丝滑/creamy → +3=气泡/fizzy
 * 温度: -5=冰冻 → +5=滚烫
 * 颜色: 1=绿 2=红/橙 3=黄 4=白/米 5=棕/黑
 * 时序: 0-23小时，适饮时段
 * 嗅觉: 0=无香 → 10=浓香
 * ABV%: 非酒精饮品固定为 0
 * 动作: 1=冥想/安静 2=放松 3=社交 4=活力 5=派对
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════
// 咖啡类 (Coffee) - ID: 90001-90099
// ═══════════════════════════════════════════
const coffeeDrinks = {
  "90001": { name: "Espresso", v: [3, 0, 3, 5, 9, 7, 0, 1] },
  "90002": { name: "Doppio", v: [3, 0, 3, 5, 9, 8, 0, 1] },
  "90003": { name: "Ristretto", v: [4, 0, 3, 5, 9, 8, 0, 1] },
  "90004": { name: "Lungo", v: [2, 0, 3, 5, 9, 6, 0, 1] },
  "90005": { name: "Americano", v: [2, 0, 3, 5, 9, 5, 0, 1] },
  "90006": { name: "Caffè Latte", v: [4, -2, 2, 4, 10, 4, 0, 2] },
  "90007": { name: "Cappuccino", v: [4, -1, 3, 4, 9, 5, 0, 2] },
  "90008": { name: "Flat White", v: [3, -2, 2, 4, 9, 5, 0, 2] },
  "90009": { name: "Caffè Mocha", v: [6, -2, 2, 5, 15, 5, 0, 3] },
  "90010": { name: "Caramel Macchiato", v: [6, -1, 2, 4, 15, 5, 0, 3] },
  "90011": { name: "Vanilla Latte", v: [5, -2, 2, 4, 15, 5, 0, 2] },
  "90012": { name: "Hazelnut Latte", v: [5, -2, 2, 4, 15, 6, 0, 2] },
  "90013": { name: "Cortado", v: [3, -1, 2, 5, 10, 6, 0, 1] },
  "90014": { name: "Macchiato", v: [3, 0, 3, 5, 10, 7, 0, 1] },
  "90015": { name: "Caffè Breve", v: [5, -3, 2, 4, 15, 4, 0, 2] },
  "90016": { name: "Café au Lait", v: [4, -2, 3, 4, 8, 4, 0, 2] },
  "90017": { name: "Vienna Coffee", v: [5, -2, 3, 5, 15, 5, 0, 3] },
  "90018": { name: "Café Con Leche", v: [5, -2, 3, 4, 8, 4, 0, 2] },
  // 冰咖啡
  "90020": { name: "Iced Americano", v: [2, 0, -3, 5, 14, 5, 0, 1] },
  "90021": { name: "Iced Latte", v: [4, -1, -3, 4, 14, 4, 0, 2] },
  "90022": { name: "Iced Mocha", v: [6, -1, -3, 5, 14, 5, 0, 3] },
  "90023": { name: "Iced Caramel Macchiato", v: [6, -1, -3, 4, 14, 5, 0, 3] },
  "90024": { name: "Cold Brew Coffee", v: [2, 0, -3, 5, 14, 6, 0, 1] },
  "90025": { name: "Nitro Cold Brew", v: [2, -2, -3, 5, 14, 6, 0, 2] },
  "90026": { name: "Japanese Iced Coffee", v: [2, 0, -3, 5, 14, 7, 0, 1] },
  "90027": { name: "Vietnamese Iced Coffee", v: [7, -2, -3, 5, 14, 5, 0, 3] },
  "90028": { name: "Greek Frappé", v: [4, 1, -4, 4, 14, 4, 0, 3] },
  "90029": { name: "Shakerato", v: [3, 0, -3, 5, 15, 6, 0, 3] },
  // 星冰乐/冰沙类
  "90030": { name: "Caramel Frappuccino", v: [7, -2, -4, 4, 14, 4, 0, 4] },
  "90031": { name: "Mocha Frappuccino", v: [7, -2, -4, 5, 14, 5, 0, 4] },
  "90032": { name: "Java Chip Frappuccino", v: [7, -2, -4, 5, 14, 5, 0, 4] },
  "90033": { name: "Vanilla Bean Frappuccino", v: [7, -2, -4, 4, 14, 4, 0, 4] },
  "90034": { name: "Coffee Milkshake", v: [6, -3, -4, 4, 15, 4, 0, 4] },
  // 特调咖啡
  "90040": { name: "Café Cubano", v: [8, 0, 3, 5, 10, 7, 0, 4] },
  "90041": { name: "Turkish Coffee", v: [4, 0, 4, 5, 20, 8, 0, 1] },
  "90042": { name: "Café de Olla", v: [5, 0, 4, 5, 20, 6, 0, 2] },
  "90043": { name: "Dalgona Coffee", v: [6, -1, -2, 4, 15, 5, 0, 3] },
  "90044": { name: "Einspänner", v: [5, -2, 2, 5, 15, 5, 0, 2] },
  "90045": { name: "Café Bombón", v: [8, -2, 2, 4, 15, 4, 0, 3] },
  "90046": { name: "Affogato", v: [6, -3, -1, 5, 20, 6, 0, 3] },
  "90047": { name: "Mazagran", v: [4, 0, -3, 5, 14, 5, 0, 3] },
  "90048": { name: "Yuanyang", v: [5, -1, -2, 5, 15, 5, 0, 3] },
};

// ═══════════════════════════════════════════
// 茶类 (Tea) - ID: 90100-90199
// ═══════════════════════════════════════════
const teaDrinks = {
  // 传统热茶
  "90100": { name: "Green Tea", v: [1, 0, 3, 1, 15, 4, 0, 1] },
  "90101": { name: "Black Tea", v: [2, 0, 3, 2, 15, 5, 0, 1] },
  "90102": { name: "Earl Grey", v: [2, 0, 3, 2, 15, 6, 0, 1] },
  "90103": { name: "English Breakfast", v: [2, 0, 3, 2, 8, 5, 0, 1] },
  "90104": { name: "Darjeeling", v: [2, 0, 3, 3, 15, 6, 0, 1] },
  "90105": { name: "Oolong Tea", v: [2, 0, 3, 3, 15, 6, 0, 1] },
  "90106": { name: "White Tea", v: [1, 0, 3, 4, 15, 4, 0, 1] },
  "90107": { name: "Pu-erh Tea", v: [3, 0, 3, 5, 20, 6, 0, 1] },
  "90108": { name: "Jasmine Tea", v: [2, 0, 3, 1, 15, 7, 0, 1] },
  "90109": { name: "Chamomile Tea", v: [2, 0, 3, 3, 21, 5, 0, 1] },
  "90110": { name: "Peppermint Tea", v: [2, 0, 3, 1, 20, 6, 0, 1] },
  "90111": { name: "Ginger Tea", v: [3, 0, 4, 3, 20, 5, 0, 2] },
  "90112": { name: "Rooibos Tea", v: [2, 0, 3, 2, 20, 4, 0, 1] },
  "90113": { name: "Hibiscus Tea", v: [3, 0, 3, 2, 15, 4, 0, 2] },
  "90114": { name: "Lemon Ginger Tea", v: [3, 0, 4, 3, 20, 5, 0, 2] },
  // 奶茶系列
  "90120": { name: "Milk Tea", v: [5, -1, 2, 4, 15, 3, 0, 2] },
  "90121": { name: "Hong Kong Milk Tea", v: [4, -1, 2, 5, 15, 4, 0, 3] },
  "90122": { name: "Chai Latte", v: [5, -2, 3, 4, 15, 7, 0, 2] },
  "90123": { name: "London Fog", v: [4, -2, 3, 4, 15, 6, 0, 2] },
  "90124": { name: "Dirty Chai", v: [4, -1, 2, 5, 14, 7, 0, 3] },
  "90125": { name: "Teh Tarik", v: [5, -1, 3, 4, 15, 4, 0, 3] },
  // 抹茶系列
  "90130": { name: "Matcha", v: [3, 0, 3, 1, 14, 5, 0, 1] },
  "90131": { name: "Matcha Latte", v: [4, -2, 2, 1, 14, 5, 0, 2] },
  "90132": { name: "Iced Matcha Latte", v: [4, -1, -3, 1, 14, 5, 0, 2] },
  "90133": { name: "Matcha Frappuccino", v: [6, -2, -4, 1, 14, 4, 0, 4] },
  "90134": { name: "Matcha Lemonade", v: [4, 0, -3, 1, 14, 4, 0, 3] },
  "90135": { name: "Hojicha Latte", v: [4, -2, 2, 5, 20, 5, 0, 2] },
  // 珍珠奶茶/波霸
  "90140": { name: "Classic Bubble Tea", v: [6, -2, -2, 4, 15, 3, 0, 4] },
  "90141": { name: "Brown Sugar Boba", v: [7, -2, -2, 5, 15, 4, 0, 4] },
  "90142": { name: "Taro Bubble Tea", v: [6, -2, -2, 4, 15, 3, 0, 4] },
  "90143": { name: "Tiger Milk Tea", v: [7, -2, -2, 4, 15, 4, 0, 4] },
  "90144": { name: "Matcha Bubble Tea", v: [5, -2, -2, 1, 15, 4, 0, 4] },
  "90145": { name: "Mango Bubble Tea", v: [6, -1, -3, 3, 15, 4, 0, 4] },
  "90146": { name: "Strawberry Bubble Tea", v: [6, -1, -3, 2, 15, 4, 0, 4] },
  "90147": { name: "Passion Fruit Bubble Tea", v: [5, -1, -3, 3, 15, 5, 0, 4] },
  "90148": { name: "Wintermelon Bubble Tea", v: [5, -1, -2, 4, 15, 2, 0, 3] },
  "90149": { name: "Oolong Bubble Tea", v: [4, -1, -2, 3, 15, 5, 0, 3] },
  // 冰茶系列
  "90150": { name: "Iced Green Tea", v: [1, 0, -3, 1, 14, 4, 0, 2] },
  "90151": { name: "Iced Black Tea", v: [2, 0, -3, 2, 14, 4, 0, 2] },
  "90152": { name: "Sweet Tea", v: [6, 0, -3, 2, 14, 3, 0, 3] },
  "90153": { name: "Peach Iced Tea", v: [5, 0, -3, 3, 14, 4, 0, 3] },
  "90154": { name: "Lemon Iced Tea", v: [4, 0, -3, 3, 14, 3, 0, 3] },
  "90155": { name: "Arnold Palmer", v: [4, 0, -3, 3, 14, 3, 0, 3] },
  "90156": { name: "Passion Fruit Tea", v: [5, 0, -3, 3, 14, 5, 0, 3] },
  "90157": { name: "Mango Green Tea", v: [5, 0, -3, 3, 14, 4, 0, 3] },
  "90158": { name: "Lychee Tea", v: [5, 0, -3, 4, 14, 5, 0, 3] },
  "90159": { name: "Rose Tea", v: [3, 0, 3, 2, 15, 6, 0, 1] },
};

// ═══════════════════════════════════════════
// 乳制品类 (Dairy) - ID: 90200-90299
// ═══════════════════════════════════════════
const dairyDrinks = {
  // 奶昔系列
  "90200": { name: "Vanilla Milkshake", v: [7, -3, -4, 4, 15, 4, 0, 4] },
  "90201": { name: "Chocolate Milkshake", v: [7, -3, -4, 5, 15, 5, 0, 4] },
  "90202": { name: "Strawberry Milkshake", v: [7, -3, -4, 2, 15, 4, 0, 4] },
  "90203": { name: "Banana Milkshake", v: [6, -3, -4, 3, 15, 3, 0, 4] },
  "90204": { name: "Oreo Milkshake", v: [8, -3, -4, 5, 15, 4, 0, 4] },
  "90205": { name: "Peanut Butter Milkshake", v: [7, -3, -4, 4, 15, 5, 0, 4] },
  "90206": { name: "Caramel Milkshake", v: [8, -3, -4, 4, 15, 5, 0, 4] },
  "90207": { name: "Cookies and Cream Shake", v: [8, -3, -4, 4, 15, 4, 0, 4] },
  "90208": { name: "Malt Milkshake", v: [6, -3, -4, 4, 15, 4, 0, 4] },
  "90209": { name: "Black and White Shake", v: [7, -3, -4, 5, 15, 4, 0, 4] },
  // 印度酸奶饮品
  "90210": { name: "Mango Lassi", v: [6, -2, -3, 3, 14, 3, 0, 3] },
  "90211": { name: "Sweet Lassi", v: [6, -2, -3, 4, 14, 2, 0, 3] },
  "90212": { name: "Rose Lassi", v: [5, -2, -3, 2, 14, 5, 0, 2] },
  "90213": { name: "Salted Lassi", v: [3, -2, -3, 4, 14, 1, 0, 2] },
  "90214": { name: "Chaas", v: [2, -1, -2, 4, 14, 2, 0, 2] },
  "90215": { name: "Buttermilk", v: [2, -1, -2, 4, 14, 2, 0, 2] },
  // 热牛奶饮品
  "90220": { name: "Hot Chocolate", v: [7, -2, 4, 5, 21, 5, 0, 2] },
  "90221": { name: "White Hot Chocolate", v: [8, -2, 4, 4, 21, 4, 0, 2] },
  "90222": { name: "Mexican Hot Chocolate", v: [7, -2, 4, 5, 21, 6, 0, 3] },
  "90223": { name: "Warm Milk with Honey", v: [5, -2, 3, 4, 21, 2, 0, 1] },
  "90224": { name: "Golden Milk", v: [4, -2, 3, 3, 21, 5, 0, 2] },
  "90225": { name: "Steamed Milk", v: [3, -2, 3, 4, 21, 1, 0, 1] },
  "90226": { name: "Malted Milk", v: [5, -2, 3, 4, 20, 3, 0, 2] },
  "90227": { name: "Ovaltine", v: [5, -2, 3, 5, 20, 3, 0, 2] },
  "90228": { name: "Horlicks", v: [5, -2, 3, 4, 20, 3, 0, 2] },
  // 其他乳制品饮料
  "90230": { name: "Chocolate Milk", v: [6, -2, -2, 5, 15, 4, 0, 3] },
  "90231": { name: "Strawberry Milk", v: [6, -2, -2, 2, 15, 3, 0, 3] },
  "90232": { name: "Banana Milk", v: [5, -2, -2, 3, 15, 3, 0, 3] },
  "90233": { name: "Horchata", v: [6, -2, -2, 4, 14, 4, 0, 3] },
  "90234": { name: "Kefir", v: [3, -1, -1, 4, 10, 3, 0, 2] },
  "90235": { name: "Ayran", v: [2, -1, -2, 4, 14, 1, 0, 2] },
  "90236": { name: "Doogh", v: [2, -1, -2, 4, 14, 3, 0, 2] },
  "90237": { name: "Yakult", v: [5, -1, -2, 4, 10, 2, 0, 3] },
  // 冰淇淋饮品
  "90240": { name: "Root Beer Float", v: [7, 1, -4, 5, 15, 4, 0, 5] },
  "90241": { name: "Coke Float", v: [7, 1, -4, 5, 15, 3, 0, 5] },
  "90242": { name: "Orange Creamsicle Float", v: [7, 0, -4, 3, 15, 4, 0, 5] },
  "90243": { name: "Brownie Milkshake", v: [8, -3, -4, 5, 15, 5, 0, 4] },
  "90244": { name: "Salted Caramel Shake", v: [7, -3, -4, 4, 15, 5, 0, 4] },
  // 奶基冰沙
  "90250": { name: "Mango Smoothie", v: [6, -2, -4, 3, 14, 4, 0, 4] },
  "90251": { name: "Berry Smoothie", v: [5, -2, -4, 2, 14, 4, 0, 4] },
  "90252": { name: "Banana Smoothie", v: [5, -2, -4, 3, 14, 3, 0, 4] },
  "90253": { name: "Strawberry Banana Smoothie", v: [6, -2, -4, 2, 14, 4, 0, 4] },
  "90254": { name: "Blueberry Smoothie", v: [5, -2, -4, 4, 14, 4, 0, 4] },
  "90255": { name: "Peach Smoothie", v: [5, -2, -4, 3, 14, 4, 0, 4] },
  "90256": { name: "Tropical Smoothie", v: [6, -2, -4, 3, 14, 5, 0, 4] },
  "90257": { name: "Green Smoothie", v: [3, -2, -4, 1, 10, 3, 0, 4] },
  "90258": { name: "Açaí Bowl Drink", v: [5, -2, -4, 4, 10, 4, 0, 4] },
  "90259": { name: "Protein Smoothie", v: [4, -2, -3, 4, 10, 2, 0, 4] },
};

// ═══════════════════════════════════════════
// 果汁类 (Juice) - ID: 90300-90399
// ═══════════════════════════════════════════
const juiceDrinks = {
  // 纯果汁
  "90300": { name: "Fresh Orange Juice", v: [5, 0, -2, 3, 8, 5, 0, 3] },
  "90301": { name: "Apple Juice", v: [5, 0, -2, 3, 10, 4, 0, 3] },
  "90302": { name: "Grape Juice", v: [6, 0, -2, 4, 15, 4, 0, 3] },
  "90303": { name: "Cranberry Juice", v: [4, 0, -2, 2, 15, 3, 0, 3] },
  "90304": { name: "Pineapple Juice", v: [6, 0, -2, 3, 14, 5, 0, 4] },
  "90305": { name: "Mango Juice", v: [6, 0, -2, 3, 14, 5, 0, 3] },
  "90306": { name: "Grapefruit Juice", v: [4, 0, -2, 2, 8, 5, 0, 3] },
  "90307": { name: "Pomegranate Juice", v: [5, 0, -2, 2, 15, 4, 0, 3] },
  "90308": { name: "Watermelon Juice", v: [5, 0, -3, 2, 14, 3, 0, 4] },
  "90309": { name: "Guava Juice", v: [5, 0, -2, 2, 14, 4, 0, 3] },
  "90310": { name: "Passion Fruit Juice", v: [5, 0, -2, 3, 14, 6, 0, 4] },
  "90311": { name: "Lychee Juice", v: [6, 0, -2, 4, 14, 5, 0, 3] },
  "90312": { name: "Papaya Juice", v: [5, 0, -2, 3, 14, 4, 0, 3] },
  "90313": { name: "Peach Juice", v: [5, 0, -2, 3, 14, 4, 0, 3] },
  "90314": { name: "Cherry Juice", v: [5, 0, -2, 2, 15, 4, 0, 3] },
  "90315": { name: "Coconut Water", v: [3, 0, -2, 4, 14, 2, 0, 3] },
  "90316": { name: "Aloe Vera Juice", v: [3, 0, -2, 1, 14, 2, 0, 2] },
  // 混合果汁
  "90320": { name: "Tropical Punch", v: [6, 0, -3, 3, 14, 5, 0, 4] },
  "90321": { name: "Fruit Punch", v: [6, 0, -3, 2, 15, 4, 0, 5] },
  "90322": { name: "Berry Mix Juice", v: [5, 0, -3, 4, 14, 5, 0, 3] },
  "90323": { name: "Citrus Blend", v: [4, 0, -2, 3, 8, 6, 0, 3] },
  "90324": { name: "ABC Juice", v: [4, 0, -2, 2, 10, 4, 0, 3] },
  "90325": { name: "Green Juice", v: [3, 0, -2, 1, 8, 3, 0, 3] },
  "90326": { name: "Carrot Orange Juice", v: [4, 0, -2, 3, 10, 4, 0, 3] },
  "90327": { name: "Beet Apple Ginger", v: [4, 0, -2, 2, 10, 4, 0, 3] },
  "90328": { name: "Celery Juice", v: [2, 0, -2, 1, 8, 2, 0, 2] },
  "90329": { name: "Wheatgrass Shot", v: [2, 0, -1, 1, 8, 3, 0, 2] },
  // 墨西哥风味 Agua Fresca
  "90330": { name: "Agua de Jamaica", v: [4, 0, -3, 2, 14, 4, 0, 3] },
  "90331": { name: "Agua de Tamarindo", v: [5, 0, -3, 5, 14, 4, 0, 3] },
  "90332": { name: "Agua de Sandia", v: [5, 0, -3, 2, 14, 3, 0, 4] },
  "90333": { name: "Agua de Piña", v: [5, 0, -3, 3, 14, 4, 0, 4] },
  "90334": { name: "Agua de Pepino", v: [3, 0, -3, 1, 14, 2, 0, 3] },
  "90335": { name: "Agua de Melón", v: [5, 0, -3, 3, 14, 3, 0, 3] },
  "90336": { name: "Agua de Horchata", v: [6, -2, -3, 4, 14, 3, 0, 3] },
  // 果汁冰沙
  "90340": { name: "Orange Julius", v: [6, -1, -4, 3, 14, 4, 0, 4] },
  "90341": { name: "Pineapple Smoothie", v: [6, -1, -4, 3, 14, 5, 0, 4] },
  "90342": { name: "Watermelon Slush", v: [5, 0, -4, 2, 14, 3, 0, 4] },
  "90343": { name: "Mango Lassi", v: [6, -2, -3, 3, 14, 4, 0, 3] },
  "90344": { name: "Cantaloupe Smoothie", v: [5, -1, -4, 3, 14, 3, 0, 4] },
  "90345": { name: "Kiwi Smoothie", v: [5, -1, -4, 1, 14, 4, 0, 4] },
  "90346": { name: "Dragonfruit Smoothie", v: [5, -1, -4, 2, 14, 3, 0, 4] },
  // 蔬果汁
  "90350": { name: "Tomato Juice", v: [3, 0, -1, 2, 10, 3, 0, 2] },
  "90351": { name: "V8 Juice", v: [3, 0, -1, 2, 10, 4, 0, 3] },
  "90352": { name: "Carrot Juice", v: [4, 0, -1, 3, 10, 3, 0, 3] },
  "90353": { name: "Spinach Juice", v: [2, 0, -1, 1, 10, 2, 0, 2] },
  "90354": { name: "Cucumber Juice", v: [2, 0, -2, 1, 10, 2, 0, 2] },
  "90355": { name: "Ginger Shot", v: [3, 0, 0, 3, 10, 6, 0, 4] },
  "90356": { name: "Turmeric Shot", v: [3, 0, 0, 3, 10, 5, 0, 4] },
};

// ═══════════════════════════════════════════
// 软饮类 (Soft Drinks) - ID: 90400-90499
// ═══════════════════════════════════════════
const softDrinks = {
  // 柠檬水系列
  "90400": { name: "Classic Lemonade", v: [5, 0, -3, 3, 14, 3, 0, 3] },
  "90401": { name: "Pink Lemonade", v: [5, 0, -3, 2, 14, 3, 0, 4] },
  "90402": { name: "Strawberry Lemonade", v: [6, 0, -3, 2, 14, 4, 0, 4] },
  "90403": { name: "Raspberry Lemonade", v: [5, 0, -3, 2, 14, 4, 0, 4] },
  "90404": { name: "Lavender Lemonade", v: [4, 0, -3, 4, 15, 6, 0, 3] },
  "90405": { name: "Cucumber Lemonade", v: [4, 0, -3, 1, 14, 3, 0, 3] },
  "90406": { name: "Mint Lemonade", v: [4, 0, -3, 1, 14, 5, 0, 3] },
  "90407": { name: "Honey Lemon", v: [5, 0, 2, 3, 20, 4, 0, 2] },
  "90408": { name: "Ginger Lemonade", v: [4, 0, -2, 3, 14, 5, 0, 3] },
  "90409": { name: "Limeade", v: [4, 0, -3, 1, 14, 4, 0, 3] },
  "90410": { name: "Cherry Limeade", v: [5, 0, -3, 2, 14, 4, 0, 4] },
  // 汽水/碳酸饮料
  "90420": { name: "Cola", v: [6, 3, -2, 5, 14, 3, 0, 5] },
  "90421": { name: "Ginger Ale", v: [4, 3, -2, 3, 15, 4, 0, 3] },
  "90422": { name: "Ginger Beer", v: [4, 3, -2, 3, 15, 5, 0, 4] },
  "90423": { name: "Root Beer", v: [6, 3, -2, 5, 15, 5, 0, 4] },
  "90424": { name: "Cream Soda", v: [7, 2, -2, 4, 15, 4, 0, 4] },
  "90425": { name: "Lemon Lime Soda", v: [5, 3, -2, 1, 14, 3, 0, 4] },
  "90426": { name: "Orange Soda", v: [6, 3, -2, 3, 14, 4, 0, 5] },
  "90427": { name: "Grape Soda", v: [7, 3, -2, 4, 14, 3, 0, 5] },
  "90428": { name: "Sparkling Water", v: [0, 3, -2, 4, 14, 0, 0, 2] },
  "90429": { name: "Tonic Water", v: [2, 3, -2, 4, 18, 2, 0, 3] },
  "90430": { name: "Club Soda", v: [0, 3, -2, 4, 14, 0, 0, 2] },
  "90431": { name: "Italian Soda", v: [5, 3, -3, 3, 15, 4, 0, 4] },
  "90432": { name: "Shirley Temple", v: [6, 2, -2, 2, 17, 3, 0, 5] },
  "90433": { name: "Roy Rogers", v: [5, 2, -2, 5, 17, 3, 0, 5] },
  // 无酒精鸡尾酒 Mocktails
  "90440": { name: "Virgin Mojito", v: [4, 0, -3, 1, 17, 5, 0, 3] },
  "90441": { name: "Virgin Piña Colada", v: [6, -2, -4, 4, 15, 4, 0, 4] },
  "90442": { name: "Virgin Margarita", v: [4, 0, -3, 1, 17, 3, 0, 3] },
  "90443": { name: "Virgin Daiquiri", v: [5, 0, -4, 4, 17, 3, 0, 4] },
  "90444": { name: "Virgin Strawberry Daiquiri", v: [6, 0, -4, 2, 17, 4, 0, 4] },
  "90445": { name: "Virgin Mary", v: [4, 0, -1, 2, 12, 5, 0, 3] },
  "90446": { name: "Nojito", v: [4, 0, -3, 1, 17, 5, 0, 3] },
  "90447": { name: "Cinderella", v: [5, 0, -2, 3, 17, 5, 0, 4] },
  "90448": { name: "Safe Sex on the Beach", v: [5, 0, -2, 3, 17, 4, 0, 5] },
  "90449": { name: "Pussyfoot", v: [5, 0, -2, 3, 17, 4, 0, 3] },
  "90450": { name: "Gunner", v: [4, 2, -2, 2, 17, 3, 0, 4] },
  "90451": { name: "Nada Colada", v: [6, -1, -4, 4, 15, 4, 0, 4] },
  "90452": { name: "Baby Bellini", v: [5, 2, -2, 2, 17, 4, 0, 4] },
  "90453": { name: "Faux Kir Royale", v: [4, 2, -2, 4, 17, 4, 0, 4] },
  "90454": { name: "Seedlip Garden", v: [2, 0, -2, 1, 18, 5, 0, 2] },
  "90455": { name: "Cucumber Cooler", v: [3, 0, -3, 1, 15, 3, 0, 3] },
  // 能量/运动饮料 (无酒精)
  "90460": { name: "Sports Drink", v: [4, 0, -2, 3, 14, 1, 0, 5] },
  "90461": { name: "Coconut Sport", v: [4, 0, -2, 4, 14, 2, 0, 4] },
  // 气泡饮料
  "90470": { name: "Elderflower Spritz", v: [4, 3, -2, 4, 17, 6, 0, 3] },
  "90471": { name: "Sparkling Apple Cider", v: [5, 3, -2, 3, 18, 4, 0, 5] },
  "90472": { name: "Sparkling Grape Juice", v: [6, 3, -2, 4, 18, 4, 0, 5] },
  "90473": { name: "Kombucha", v: [3, 2, -1, 3, 14, 4, 0, 3] },
  "90474": { name: "Sparkling Lemonade", v: [5, 3, -3, 3, 14, 3, 0, 4] },
  "90475": { name: "Sparkling Cranberry", v: [4, 3, -2, 2, 18, 3, 0, 4] },
};

// ═══════════════════════════════════════════
// 合并所有饮品
// ═══════════════════════════════════════════
const allNewDrinks = {
  ...coffeeDrinks,
  ...teaDrinks,
  ...dairyDrinks,
  ...juiceDrinks,
  ...softDrinks,
};

// 统计
const counts = {
  '咖啡': Object.keys(coffeeDrinks).length,
  '茶': Object.keys(teaDrinks).length,
  '乳制品': Object.keys(dairyDrinks).length,
  '果汁': Object.keys(juiceDrinks).length,
  '软饮': Object.keys(softDrinks).length,
};
const totalNew = Object.keys(allNewDrinks).length;

console.log('📊 即将添加的非酒精饮品统计:');
console.log('─────────────────────────────');
Object.entries(counts).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count} 款`);
});
console.log('─────────────────────────────');
console.log(`   总计: ${totalNew} 款`);
console.log('');

// 读取现有文件
const vectorsPath = path.join(__dirname, '../src/data/drinkVectors.js');
let content = fs.readFileSync(vectorsPath, 'utf-8');

// 检查是否已经添加过
if (content.includes('"90001"')) {
  console.log('⚠️  检测到已添加过非酒精饮品数据，跳过重复添加');
  process.exit(0);
}

// 找到 drinkVectors 对象的结束位置
const insertPoint = content.lastIndexOf('};');

// 生成新条目
let newEntries = '\n  // ═══════════════════════════════════════════\n';
newEntries += '  // 新增非酒精饮品 (自动生成)\n';
newEntries += '  // ═══════════════════════════════════════════\n';

for (const [id, data] of Object.entries(allNewDrinks)) {
  newEntries += `  "${id}": {\n`;
  newEntries += `    "name": "${data.name}",\n`;
  newEntries += `    "v": [\n`;
  newEntries += data.v.map(v => `      ${v}`).join(',\n') + '\n';
  newEntries += `    ]\n`;
  newEntries += `  },\n`;
}

// 插入新条目
content = content.slice(0, insertPoint) + newEntries + content.slice(insertPoint);

// 更新注释中的饮品数量
const countMatch = content.match(/共 (\d+) 款饮品/);
if (countMatch) {
  const newCount = parseInt(countMatch[1]) + totalNew;
  content = content.replace(/共 \d+ 款饮品/, `共 ${newCount} 款饮品`);
}

// 更新日期
const today = new Date();
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
content = content.replace(/自动生成 — \d{4}-\d{2}-\d{2}/, `自动生成 — ${dateStr}`);

// 写入文件
fs.writeFileSync(vectorsPath, content);
console.log(`✅ 已成功添加 ${totalNew} 款非酒精饮品到 drinkVectors.js`);
console.log('');
console.log('📁 分类分布:');
Object.entries(counts).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count} 款`);
});
