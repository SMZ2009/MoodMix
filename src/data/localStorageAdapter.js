const STORAGE_KEYS = {
  INVENTORY: 'moodmix_inventory',
  FAVORITES: 'moodmix_favorites',
  COLLECTIONS: 'moodmix_collections',
};

const DEFAULT_FAVORITES = [];

const DEFAULT_COLLECTIONS = [];

const STANDARD_INGREDIENTS = {
  '基酒': [
    { ing_id: 'ING_001_Gin', name_cn: '金酒', name_en: 'Gin', default_unit: 'ml' },
    { ing_id: 'ING_002_Whiskey', name_cn: '威士忌', name_en: 'Whiskey', default_unit: 'ml' },
    { ing_id: 'ING_003_Vodka', name_cn: '伏特加', name_en: 'Vodka', default_unit: 'ml' },
    { ing_id: 'ING_004_Rum', name_cn: '朗姆酒', name_en: 'Rum', default_unit: 'ml' },
    { ing_id: 'ING_005_Tequila', name_cn: '龙舌兰', name_en: 'Tequila', default_unit: 'ml' },
    { ing_id: 'ING_006_Brandy', name_cn: '白兰地', name_en: 'Brandy', default_unit: 'ml' },
  ],
  '利口酒': [
    { ing_id: 'ING_101_CoffeeLiqueur', name_cn: '咖啡利口酒', name_en: 'Coffee Liqueur', default_unit: 'ml' },
    { ing_id: 'ING_102_Vermouth', name_cn: '味美思', name_en: 'Vermouth', default_unit: 'ml' },
    { ing_id: 'ING_103_Campari', name_cn: '金巴利', name_en: 'Campari', default_unit: 'ml' },
    { ing_id: 'ING_104_Baileys', name_cn: '百利甜', name_en: 'Baileys', default_unit: 'ml' },
  ],
  '酸/水果': [
    { ing_id: 'ING_201_Lemon', name_cn: '柠檬', name_en: 'Lemon', default_unit: 'piece' },
    { ing_id: 'ING_202_Lime', name_cn: '青柠', name_en: 'Lime', default_unit: 'piece' },
    { ing_id: 'ING_203_Orange', name_cn: '橙子', name_en: 'Orange', default_unit: 'piece' },
    { ing_id: 'ING_204_LemonJuice', name_cn: '柠檬汁', name_en: 'Lemon Juice', default_unit: 'ml' },
    { ing_id: 'ING_205_LimeJuice', name_cn: '青柠汁', name_en: 'Lime Juice', default_unit: 'ml' },
  ],
  '糖浆/甜味剂': [
    { ing_id: 'ING_301_Syrup', name_cn: '糖浆', name_en: 'Syrup', default_unit: 'ml' },
    { ing_id: 'ING_302_Honey', name_cn: '蜂蜜', name_en: 'Honey', default_unit: 'ml' },
    { ing_id: 'ING_303_Sugar', name_cn: '白砂糖', name_en: 'Sugar', default_unit: 'g' },
  ],
  '气泡/填充': [
    { ing_id: 'ING_401_Soda', name_cn: '苏打水', name_en: 'Soda Water', default_unit: 'ml' },
    { ing_id: 'ING_402_Tonic', name_cn: '汤力水', name_en: 'Tonic Water', default_unit: 'ml' },
    { ing_id: 'ING_403_Cola', name_cn: '可乐', name_en: 'Cola', default_unit: 'ml' },
    { ing_id: 'ING_404_Sprite', name_cn: '雪碧', name_en: 'Sprite', default_unit: 'ml' },
    { ing_id: 'ING_405_GingerAle', name_cn: '姜汁汽水', name_en: 'Ginger Ale', default_unit: 'ml' },
    { ing_id: 'ING_406_Milk', name_cn: '牛奶', name_en: 'Milk', default_unit: 'ml' },
  ],
  '装饰/香草': [
    { ing_id: 'ING_501_Mint', name_cn: '薄荷', name_en: 'Mint', default_unit: 'piece' },
    { ing_id: 'ING_502_Rosemary', name_cn: '迷迭香', name_en: 'Rosemary', default_unit: 'piece' },
  ],
  '药物/其他': [
    { ing_id: 'ING_601_Ice', name_cn: '冰块', name_en: 'Ice', default_unit: 'piece' },
    { ing_id: 'ING_602_Bitters', name_cn: '苦精', name_en: 'Bitters', default_unit: 'ml' },
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
    const existingIndex = inventory.standard.findIndex(item => item.ing_id === ingId);
    
    if (existingIndex >= 0) {
      inventory.standard[existingIndex] = {
        ...inventory.standard[existingIndex],
        in_stock: isActive
      };
    } else {
      for (const category of Object.values(STANDARD_INGREDIENTS)) {
        const ingredient = category.find(i => i.ing_id === ingId);
        if (ingredient) {
          inventory.standard.push({ ...ingredient, in_stock: isActive });
          break;
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

  addFavorite(drinkId) {
    const favorites = this.getFavorites();
    if (!favorites.includes(drinkId)) {
      const newFavorites = [...favorites, drinkId];
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
    return this.getFavorites().includes(drinkId);
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
  }
};

const storage = {
  inventory: inventoryStorage,
  favorite: favoriteStorage,
  collection: collectionStorage
};

export default storage;
