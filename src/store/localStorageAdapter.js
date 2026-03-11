const STORAGE_KEYS = {
  INVENTORY: 'moodmix_inventory',
  FAVORITES: 'moodmix_favorites',
  COLLECTIONS: 'moodmix_collections',
  CUSTOM_DRINKS: 'moodmix_custom_drinks',
};

const DEFAULT_FAVORITES = [];

const DEFAULT_COLLECTIONS = [];

const STANDARD_INGREDIENTS = {

  // ── 基酒 ────────────────────────────────────────────────────────────────
  '基酒': [
    { ing_id: 'ING_001_Gin', name_cn: '金酒', name_en: 'Gin', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_002_Whiskey', name_cn: '威士忌', name_en: 'Whiskey', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_003_Bourbon', name_cn: '波本威士忌', name_en: 'Bourbon', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_004_Scotch', name_cn: '苏格兰威士忌', name_en: 'Scotch', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_005_Vodka', name_cn: '伏特加', name_en: 'Vodka', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_006_Rum', name_cn: '朗姆酒', name_en: 'Rum', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_007_LightRum', name_cn: '白朗姆', name_en: 'Light Rum', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_008_DarkRum', name_cn: '黑朗姆', name_en: 'Dark Rum', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_009_Tequila', name_cn: '龙舌兰', name_en: 'Tequila', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_010_Mezcal', name_cn: '梅斯卡尔', name_en: 'Mezcal', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_011_Brandy', name_cn: '白兰地', name_en: 'Brandy', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_012_Cognac', name_cn: '干邑', name_en: 'Cognac', default_unit: 'ml', is_alcoholic: true },
  ],

  // ── 利口酒 ───────────────────────────────────────────────────────────────
  '利口酒': [
    { ing_id: 'ING_201_Campari', name_cn: '金巴利', name_en: 'Campari', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_202_Aperol', name_cn: '阿佩罗', name_en: 'Aperol', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_203_TripleSec', name_cn: '橙味利口酒', name_en: 'Triple Sec', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_204_Cointreau', name_cn: '君度', name_en: 'Cointreau', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_205_BlueCuracao', name_cn: '蓝橙利口酒', name_en: 'Blue Curaçao', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_206_Amaretto', name_cn: '杏仁利口酒', name_en: 'Amaretto', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_207_Kahlua', name_cn: '甘露咖啡利口酒', name_en: 'Kahlúa', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_208_Baileys', name_cn: '百利甜', name_en: "Baileys Irish Cream", default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_209_Midori', name_cn: '蜜瓜利口酒', name_en: 'Midori', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_210_PeachSchnapps', name_cn: '桃子利口酒', name_en: 'Peach Schnapps', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_211_Elderflower', name_cn: '接骨木花利口酒', name_en: 'Elderflower Liqueur', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_212_Frangelico', name_cn: '榛子利口酒', name_en: 'Frangelico', default_unit: 'ml', is_alcoholic: true },
    { ing_id: 'ING_213_Chartreuse', name_cn: '查特酒', name_en: 'Chartreuse', default_unit: 'ml', is_alcoholic: true },
  ],

  // ── 苦精（用量为 dash/drop，单独成类） ───────────────────────────────────
  '苦精': [
    { ing_id: 'ING_301_AngosturaBitters', name_cn: '安哥斯图拉苦精', name_en: 'Angostura Bitters', default_unit: 'dash', is_alcoholic: true },
    { ing_id: 'ING_302_OrangeBitters', name_cn: '橙味苦精', name_en: 'Orange Bitters', default_unit: 'dash', is_alcoholic: true },
    { ing_id: 'ING_303_PeychaudBitters', name_cn: '佩绍苦精', name_en: "Peychaud's Bitters", default_unit: 'dash', is_alcoholic: true },
    { ing_id: 'ING_304_MoleBitters', name_cn: '摩尔苦精', name_en: 'Mole Bitters', default_unit: 'dash', is_alcoholic: true },
  ],

  // ── 果汁 ─────────────────────────────────────────────────────────────────
  '果汁': [
    { ing_id: 'ING_401_LemonJuice', name_cn: '柠檬汁', name_en: 'Lemon Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_402_LimeJuice', name_cn: '青柠汁', name_en: 'Lime Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_403_OrangeJuice', name_cn: '橙汁', name_en: 'Orange Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_404_GrapefruitJuice', name_cn: '西柚汁', name_en: 'Grapefruit Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_405_PineappleJuice', name_cn: '菠萝汁', name_en: 'Pineapple Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_406_CranberryJuice', name_cn: '蔓越莓汁', name_en: 'Cranberry Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_407_AppleJuice', name_cn: '苹果汁', name_en: 'Apple Juice', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_408_PassionJuice', name_cn: '百香果汁', name_en: 'Passion Fruit Juice', default_unit: 'ml', is_alcoholic: false },
  ],

  // ── 新鲜水果（整只/块，用于挤汁或装饰） ──────────────────────────────────
  '水果': [
    { ing_id: 'ING_451_Lemon', name_cn: '柠檬', name_en: 'Lemon', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_452_Lime', name_cn: '青柠', name_en: 'Lime', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_453_Orange', name_cn: '橙子', name_en: 'Orange', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_454_Grapefruit', name_cn: '西柚', name_en: 'Grapefruit', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_455_Strawberry', name_cn: '草莓', name_en: 'Strawberry', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_456_Cucumber', name_cn: '黄瓜', name_en: 'Cucumber', default_unit: 'piece', is_alcoholic: false },
  ],

  // ── 糖浆 / 甜味剂 ────────────────────────────────────────────────────────
  '糖浆/甜味剂': [
    { ing_id: 'ING_501_SimpleSyrup', name_cn: '简易糖浆', name_en: 'Simple Syrup', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_502_Grenadine', name_cn: '红石榴糖浆', name_en: 'Grenadine', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_503_AgaveSyrup', name_cn: '龙舌兰糖浆', name_en: 'Agave Syrup', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_504_Honey', name_cn: '蜂蜜', name_en: 'Honey', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_505_MapleSyrup', name_cn: '枫糖浆', name_en: 'Maple Syrup', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_506_RaspberrySyrup', name_cn: '覆盆子糖浆', name_en: 'Raspberry Syrup', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_507_OrgeatSyrup', name_cn: '杏仁糖浆', name_en: 'Orgeat Syrup', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_508_Sugar', name_cn: '白砂糖', name_en: 'Sugar', default_unit: 'tsp', is_alcoholic: false },
  ],

  // ── 气泡饮料 / 软饮 ──────────────────────────────────────────────────────
  '气泡饮料': [
    { ing_id: 'ING_601_SodaWater', name_cn: '苏打水', name_en: 'Soda Water', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_602_TonicWater', name_cn: '汤力水', name_en: 'Tonic Water', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_603_Cola', name_cn: '可乐', name_en: 'Cola', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_604_Sprite', name_cn: '雪碧/七喜', name_en: 'Lemon-Lime Soda', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_605_GingerBeer', name_cn: '姜汁啤酒', name_en: 'Ginger Beer', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_606_GingerAle', name_cn: '姜汁汽水', name_en: 'Ginger Ale', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_607_SparklingWater', name_cn: '气泡水', name_en: 'Sparkling Water', default_unit: 'ml', is_alcoholic: false },
  ],

  // ── 乳制品 / 蛋类 ────────────────────────────────────────────────────────
  '乳制品/蛋类': [
    { ing_id: 'ING_701_HeavyCream', name_cn: '淡奶油', name_en: 'Heavy Cream', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_702_Milk', name_cn: '牛奶', name_en: 'Milk', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_703_EggWhite', name_cn: '蛋清', name_en: 'Egg White', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_704_WholeEgg', name_cn: '全蛋', name_en: 'Whole Egg', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_705_CoconutCream', name_cn: '椰奶/椰浆', name_en: 'Coconut Cream', default_unit: 'ml', is_alcoholic: false },
  ],

  // ── 香草 / 香料 ──────────────────────────────────────────────────────────
  '香草/香料': [
    { ing_id: 'ING_801_Mint', name_cn: '薄荷叶', name_en: 'Mint', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_802_Rosemary', name_cn: '迷迭香', name_en: 'Rosemary', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_803_Basil', name_cn: '罗勒', name_en: 'Basil', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_804_Thyme', name_cn: '百里香', name_en: 'Thyme', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_805_Espresso', name_cn: '意式浓缩', name_en: 'Espresso', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_806_Cinnamon', name_cn: '肉桂棒', name_en: 'Cinnamon Stick', default_unit: 'piece', is_alcoholic: false },
  ],

  // ── 装饰 ─────────────────────────────────────────────────────────────────
  '装饰': [
    { ing_id: 'ING_901_Cherry', name_cn: '马拉斯奇诺樱桃', name_en: 'Maraschino Cherry', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_902_Olive', name_cn: '橄榄', name_en: 'Olive', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_903_LemonPeel', name_cn: '柠檬皮', name_en: 'Lemon Peel', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_904_OrangePeel', name_cn: '橙子皮', name_en: 'Orange Peel', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_905_LimePeel', name_cn: '青柠皮', name_en: 'Lime Peel', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_906_CocktailOnion', name_cn: '鸡尾酒洋葱', name_en: 'Cocktail Onion', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_907_SaltRim', name_cn: '盐口', name_en: 'Salt Rim', default_unit: 'g', is_alcoholic: false },
    { ing_id: 'ING_908_SugarRim', name_cn: '糖口', name_en: 'Sugar Rim', default_unit: 'g', is_alcoholic: false },
  ],

  // ── 其他基础 ─────────────────────────────────────────────────────────────
  '其他': [
    { ing_id: 'ING_951_Ice', name_cn: '冰块', name_en: 'Ice', default_unit: 'piece', is_alcoholic: false },
    { ing_id: 'ING_952_CrushedIce', name_cn: '碎冰', name_en: 'Crushed Ice', default_unit: 'g', is_alcoholic: false },
    { ing_id: 'ING_953_Water', name_cn: '纯净水', name_en: 'Water', default_unit: 'ml', is_alcoholic: false },
    { ing_id: 'ING_954_Salt', name_cn: '盐', name_en: 'Salt', default_unit: 'g', is_alcoholic: false },
    { ing_id: 'ING_955_Tabasco', name_cn: '辣椒水', name_en: 'Tabasco', default_unit: 'dash', is_alcoholic: false },
    { ing_id: 'ING_956_WorcestershireSauce', name_cn: '伍斯特沙司', name_en: 'Worcestershire Sauce', default_unit: 'dash', is_alcoholic: false },
  ],
};

export const ingredientCategories = STANDARD_INGREDIENTS;

function getItem(key, defaultValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
    return false;
  }
}

function initializeInventory() {
  const stored = getItem(STORAGE_KEYS.INVENTORY, null);
  if (stored === null) {
    const initialInventory = {
      standard: STANDARD_INGREDIENTS[Object.keys(STANDARD_INGREDIENTS)[0]].slice(0, 3).map(i => ({
        ...i,
        in_stock: true
      })),
      custom: []
    };
    setItem(STORAGE_KEYS.INVENTORY, initialInventory);
    return initialInventory;
  }
  return stored;
}

export const inventoryStorage = {
  getInventory() {
    return initializeInventory();
  },

  setInventory(inventory) {
    return setItem(STORAGE_KEYS.INVENTORY, inventory);
  },

  getCategories() {
    return STANDARD_INGREDIENTS;
  },

  getAvailableIngredients() {
    const inventory = this.getInventory();
    const available = [];

    for (const category of Object.values(STANDARD_INGREDIENTS)) {
      for (const ing of category) {
        const inInventory = inventory.standard.find(i => i.ing_id === ing.ing_id && i.in_stock);
        if (inInventory) {
          available.push(ing.name_cn);
        }
      }
    }

    for (const custom of inventory.custom) {
      if (custom.in_stock) {
        available.push(custom.name_cn);
      }
    }

    return available;
  },

  checkAvailability(drinks) {
    const availableIngredients = new Set(this.getAvailableIngredients());

    return drinks.map(drink => {
      const drinkIngredients = drink.ingredients || drink.briefIngredients || [];
      const requiredIngredients = drinkIngredients.map(i => i.label || i.name || i);

      const missing = requiredIngredients.filter(ing => !availableIngredients.has(ing));

      if (missing.length === 0) {
        return { id: drink.id, status: 'available', available: true, missing: [] };
      } else if (missing.length <= 2) {
        return { id: drink.id, status: 'missing', available: false, missing };
      } else {
        return { id: drink.id, status: 'unavailable', available: false, missing };
      }
    });
  },

  async toggleIngredient(ingId, isActive) {
    const inventory = this.getInventory();

    // 1. 尝试在标准库中寻找
    const standardIndex = inventory.standard.findIndex(item => item.ing_id === ingId);

    if (standardIndex >= 0) {
      inventory.standard[standardIndex] = {
        ...inventory.standard[standardIndex],
        in_stock: isActive
      };
    }
    // 2. 尝试在自定义库中寻找
    else {
      const customIndex = inventory.custom.findIndex(item => item.ing_id === ingId || item.id === ingId);
      if (customIndex >= 0) {
        inventory.custom[customIndex] = {
          ...inventory.custom[customIndex],
          in_stock: isActive
        };
      }
      // 3. 如果是标准库中尚未开启的项目，则新增到 standard 列表并设为选中
      else {
        for (const category of Object.values(STANDARD_INGREDIENTS)) {
          const ingredient = category.find(i => i.ing_id === ingId);
          if (ingredient) {
            inventory.standard.push({ ...ingredient, in_stock: isActive });
            break;
          }
        }
      }
    }

    this.setInventory(inventory);
    return inventory;
  },

  async addCustomIngredient(name, category) {
    const inventory = this.getInventory();
    const newItem = {
      id: `custom_${Date.now()}`,
      ing_id: `custom_${Date.now()}`,
      name_cn: name,
      name_en: name,
      category: category,
      in_stock: true,
      default_unit: 'ml'
    };
    const newInventory = {
      ...inventory,
      custom: [...inventory.custom, newItem]
    };
    this.setInventory(newInventory);
    return newInventory;
  },

  async removeCustomIngredient(ingId) {
    const inventory = this.getInventory();
    const newInventory = {
      ...inventory,
      custom: inventory.custom.filter(item => item.ing_id !== ingId)
    };
    this.setInventory(newInventory);
    return newInventory;
  }
};

export const favoriteStorage = {
  getFavorites() {
    return getItem(STORAGE_KEYS.FAVORITES, DEFAULT_FAVORITES);
  },

  setFavorites(favorites) {
    return setItem(STORAGE_KEYS.FAVORITES, favorites);
  },

  addFavorite(drink) { // Changed to accept full drink object
    const favorites = this.getFavorites();
    if (!favorites.some(d => d.id === drink.id)) {
      const newFavorites = [...favorites, drink];
      this.setFavorites(newFavorites);
      return newFavorites;
    }
    return favorites;
  },

  removeFavorite(drinkId) {
    const favorites = this.getFavorites();
    const newFavorites = favorites.filter(id => id !== drinkId);
    this.setFavorites(newFavorites);
    return newFavorites;
  },

  isFavorite(drinkId) {
    return this.getFavorites().some(d => d.id === drinkId);
  }
};

export const collectionStorage = {
  getCollections() {
    return getItem(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
  },

  setCollections(collections) {
    return setItem(STORAGE_KEYS.COLLECTIONS, collections);
  },

  addToCollection(collectionName, drink) {
    const collections = this.getCollections();
    let collection = collections.find(c => c.name === collectionName);

    if (!collection) {
      collection = { name: collectionName, drinks: [] };
      collections.push(collection);
    }

    if (!collection.drinks.some(d => d.id === drink.id)) {
      collection.drinks.push(drink);
    }

    this.setCollections(collections);
    return collections;
  },

  removeFromCollection(collectionName, drinkId) {
    const collections = this.getCollections();
    const collection = collections.find(c => c.name === collectionName);

    if (collection) {
      collection.drinks = collection.drinks.filter(d => d.id !== drinkId);
      this.setCollections(collections);
    }

    return collections;
  },

  saveDakaNote(drink, note, customImage = null) {
    const collections = this.getCollections();
    let collection = collections.find(c => c.name === 'daka');

    if (!collection) {
      collection = { name: 'daka', drinks: [] };
      collections.push(collection);
    }

    const existingEntryIndex = collection.drinks.findIndex(d => d.id === drink.id);

    if (existingEntryIndex > -1) {
      // Update existing note
      collection.drinks[existingEntryIndex].note = note;
      collection.drinks[existingEntryIndex].dakaTime = new Date().toISOString();
      // 更新自定义图片（如果提供了）
      if (customImage) {
        collection.drinks[existingEntryIndex].customImage = customImage;
      }
    } else {
      // Add new entry
      const newEntry = { 
        ...drink, 
        note: note, 
        dakaTime: new Date().toISOString(),
        ...(customImage && { customImage })  // 只有上传了才存储
      };
      collection.drinks.push(newEntry);
    }

    this.setCollections(collections);
    return collections;
  },

  getDakaNotes() {
    const collections = this.getCollections();
    const dakaCollection = collections.find(c => c.name === 'daka');
    return dakaCollection ? dakaCollection.drinks : [];
  },

  removeDakaNote(drinkId) {
    const collections = this.getCollections();
    const dakaCollection = collections.find(c => c.name === 'daka');

    if (dakaCollection) {
      dakaCollection.drinks = dakaCollection.drinks.filter(d => d.id !== drinkId);
      this.setCollections(collections);
    }

    return collections;
  }
};

// 自定义饮品存储
export const customDrinkStorage = {
  getCustomDrinks() {
    return getItem(STORAGE_KEYS.CUSTOM_DRINKS, []);
  },

  setCustomDrinks(drinks) {
    return setItem(STORAGE_KEYS.CUSTOM_DRINKS, drinks);
  },

  addCustomDrink(drink) {
    const drinks = this.getCustomDrinks();
    const newDrink = {
      ...drink,
      id: `custom_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isCustom: true
    };
    drinks.unshift(newDrink); // 新添加的放在最前面
    this.setCustomDrinks(drinks);
    return newDrink;
  },

  updateCustomDrink(drinkId, updates) {
    const drinks = this.getCustomDrinks();
    const index = drinks.findIndex(d => d.id === drinkId);
    if (index > -1) {
      drinks[index] = { ...drinks[index], ...updates, updatedAt: new Date().toISOString() };
      this.setCustomDrinks(drinks);
      return drinks[index];
    }
    return null;
  },

  removeCustomDrink(drinkId) {
    const drinks = this.getCustomDrinks();
    const newDrinks = drinks.filter(d => d.id !== drinkId);
    this.setCustomDrinks(newDrinks);
    return newDrinks;
  },

  getCustomDrink(drinkId) {
    const drinks = this.getCustomDrinks();
    return drinks.find(d => d.id === drinkId) || null;
  }
};

const storage = {
  inventory: inventoryStorage,
  favorite: favoriteStorage,
  collection: collectionStorage,
  customDrink: customDrinkStorage
};

export default storage;
