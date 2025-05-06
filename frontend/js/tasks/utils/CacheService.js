/**
 * CacheService - централізований модуль для кешування даних
 *
 * Відповідає за:
 * - Уніфіковане кешування для всіх модулів
 * - Контроль часу життя кешу
 * - Обмеження розміру кешу
 * - Автоматичну інвалідацію застарілих записів
 * - Типобезпечне зберігання та отримання даних
 *
 * @version 1.0.0
 */

import errorHandler, { ERROR_CATEGORIES } from './error-handler.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('CacheService');

// Типи сховищ
export const STORAGE_TYPES = {
  MEMORY: 'memory',        // В пам'яті (Map)
  LOCAL: 'localStorage',   // localStorage
  SESSION: 'sessionStorage', // sessionStorage
  PERSISTENT: 'persistent' // Комбінація localStorage + пам'ять для резервного копіювання
};

// Конфігурація за замовчуванням
const DEFAULT_CONFIG = {
  defaultTTL: 3600000,         // Час життя кешу за замовчуванням (1 година)
  cleanupInterval: 300000,     // Інтервал очищення (5 хвилин)
  maxSize: 500,                // Максимальна кількість елементів у кеші
  storage: STORAGE_TYPES.MEMORY, // Тип сховища за замовчуванням
  prefix: 'cache_',            // Префікс для ключів у localStorage/sessionStorage
  debug: false,                // Режим відлагодження
  serializeObjects: true       // Автоматично перетворювати об'єкти в JSON
};

class CacheService {
  constructor(config = {}) {
    // Застосовуємо конфігурацію
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Структури даних для кешу в пам'яті
    this._memoryCache = new Map();
    this._metadataCache = new Map();

    // Лічильник обробки
    this._processedCount = 0;

    // Стан ініціалізації
    this._initialized = false;

    // Таймер для очищення
    this._cleanupTimer = null;

    // Ініціалізуємо сервіс
    this._initialize();
  }

  /**
   * Ініціалізація сервісу
   */
  _initialize() {
    if (this._initialized) return;

    // Перевіряємо доступність сховищ
    this._checkStorageAvailability();

    // Запускаємо періодичне очищення
    this._startCleanupTimer();

    this._initialized = true;

    if (this.config.debug) {
      moduleErrors.info('CacheService ініціалізовано', '_initialize');
    }
  }

  /**
   * Перевірка доступності сховищ
   */
  _checkStorageAvailability() {
    try {
      // Перевіряємо localStorage
      if (this.config.storage === STORAGE_TYPES.LOCAL ||
          this.config.storage === STORAGE_TYPES.PERSISTENT) {
        const testKey = `${this.config.prefix}test`;
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
      }

      // Перевіряємо sessionStorage
      if (this.config.storage === STORAGE_TYPES.SESSION) {
        const testKey = `${this.config.prefix}test`;
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
      }
    } catch (error) {
      // У разі помилки переходимо на сховище в пам'яті
      moduleErrors.warning('Помилка доступу до сховища, використовуємо кеш у пам\'яті', '_checkStorageAvailability', {
        category: ERROR_CATEGORIES.INIT,
        details: { error: error.message }
      });

      this.config.storage = STORAGE_TYPES.MEMORY;
    }
  }

  /**
   * Запуск таймера очищення
   */
  _startCleanupTimer() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }

    this._cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Також виконуємо очищення відразу
    this.cleanup();
  }

  /**
   * Отримання реального сховища
   * @returns {Storage|Map} Об'єкт сховища
   */
  _getStorage() {
    switch (this.config.storage) {
      case STORAGE_TYPES.LOCAL:
        return localStorage;
      case STORAGE_TYPES.SESSION:
        return sessionStorage;
      case STORAGE_TYPES.MEMORY:
      case STORAGE_TYPES.PERSISTENT:
      default:
        return this._memoryCache;
    }
  }

  /**
   * Формування повного ключа з префіксом
   * @param {string} key - Ключ
   * @returns {string} Ключ з префіксом
   */
  _getFullKey(key) {
    if (this.config.storage === STORAGE_TYPES.MEMORY) {
      return key; // Для Map не потрібен префікс
    }
    return `${this.config.prefix}${key}`;
  }

  /**
   * Формування ключа для метаданих
   * @param {string} key - Оригінальний ключ
   * @returns {string} Ключ для метаданих
   */
  _getMetaKey(key) {
    if (this.config.storage === STORAGE_TYPES.MEMORY) {
      return `${key}__meta`; // Для Map використовуємо суфікс
    }
    return `${this.config.prefix}${key}__meta`;
  }

  /**
   * Серіалізація значення для зберігання
   * @param {*} value - Значення
   * @returns {string} Серіалізоване значення
   */
  _serialize(value) {
    try {
      if (value === undefined) {
        return 'undefined';
      }

      if (value === null) {
        return 'null';
      }

      if (typeof value === 'function') {
        return value.toString();
      }

      if (typeof value === 'object') {
        if (value instanceof Date) {
          return JSON.stringify({ __type: 'date', value: value.toISOString() });
        }

        if (this.config.serializeObjects) {
          return JSON.stringify(value);
        }
      }

      return String(value);
    } catch (error) {
      moduleErrors.error(error, 'Помилка серіалізації значення', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { valueType: typeof value }
      });
      return String(value);
    }
  }

  /**
   * Десеріалізація значення
   * @param {string} serialized - Серіалізоване значення
   * @param {string} type - Тип значення
   * @returns {*} Десеріалізоване значення
   */
  _deserialize(serialized, type) {
    try {
      if (serialized === 'undefined') {
        return undefined;
      }

      if (serialized === 'null') {
        return null;
      }

      // Спроба автоматичного визначення типу для об'єктів
      if (serialized.startsWith('{') && serialized.endsWith('}')) {
        try {
          const parsed = JSON.parse(serialized);

          // Перевіряємо спеціальні типи
          if (parsed && parsed.__type === 'date') {
            return new Date(parsed.value);
          }

          return parsed;
        } catch (e) {
          // Якщо помилка парсингу, продовжуємо обробку
        }
      }

      // Обробка за типом
      switch (type) {
        case 'number':
          return Number(serialized);
        case 'boolean':
          return serialized === 'true';
        case 'object':
        case 'array':
          try {
            return JSON.parse(serialized);
          } catch (e) {
            return null;
          }
        case 'date':
          try {
            return new Date(JSON.parse(serialized));
          } catch (e) {
            return new Date();
          }
        default:
          return serialized;
      }
    } catch (error) {
      moduleErrors.error(error, 'Помилка десеріалізації значення', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { serialized, type }
      });
      return serialized;
    }
  }

  /**
   * Запис значення в кеш
   * @param {string} key - Ключ
   * @param {*} value - Значення
   * @param {Object} options - Опції
   * @returns {boolean} Результат операції
   */
  set(key, value, options = {}) {
    try {
      if (!key) {
        moduleErrors.warning('Спроба запису з порожнім ключем', 'set', {
          category: ERROR_CATEGORIES.LOGIC
        });
        return false;
      }

      // Опції за замовчуванням
      const {
        ttl = this.config.defaultTTL,  // Час життя кешу
        tags = []                       // Теги для групування
      } = options;

      // Метадані для запису
      const metadata = {
        type: typeof value,
        timestamp: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null,
        tags: Array.isArray(tags) ? tags : []
      };

      // Якщо це дата, коригуємо тип
      if (value instanceof Date) {
        metadata.type = 'date';
      } else if (Array.isArray(value)) {
        metadata.type = 'array';
      }

      // Серіалізація значення
      const serializedValue = this._serialize(value);

      // Повні ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      // Запис в сховище
      if (this.config.storage === STORAGE_TYPES.MEMORY) {
        // Просто записуємо в Map
        this._memoryCache.set(fullKey, serializedValue);
        this._metadataCache.set(metaKey, metadata);
      } else {
        // Отримуємо сховище
        const storage = this._getStorage();

        try {
          // Записуємо в сховище
          storage.setItem(fullKey, serializedValue);
          storage.setItem(metaKey, JSON.stringify(metadata));
        } catch (storageError) {
          // Помилка запису (наприклад, переповнення)
          moduleErrors.warning(storageError, 'Помилка запису в сховище', {
            category: ERROR_CATEGORIES.STORAGE,
            details: { key }
          });

          // Спробуємо очистити кеш і повторити
          this.cleanup(true);

          try {
            storage.setItem(fullKey, serializedValue);
            storage.setItem(metaKey, JSON.stringify(metadata));
          } catch (retryError) {
            // Якщо друга спроба також невдала, зберігаємо тільки в пам'яті
            this._memoryCache.set(fullKey, serializedValue);
            this._metadataCache.set(metaKey, metadata);
          }
        }

        // Для персистентного режиму також зберігаємо в пам'яті
        if (this.config.storage === STORAGE_TYPES.PERSISTENT) {
          this._memoryCache.set(fullKey, serializedValue);
          this._metadataCache.set(metaKey, metadata);
        }
      }

      // Перевірка розміру кешу і видалення старих записів при необхідності
      this._checkCacheSize();

      return true;
    } catch (error) {
      moduleErrors.error(error, 'Помилка запису в кеш', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { key }
      });
      return false;
    }
  }

  /**
   * Отримання значення з кешу
   * @param {string} key - Ключ
   * @param {*} defaultValue - Значення за замовчуванням
   * @param {Object} options - Опції
   * @returns {*} Значення або значення за замовчуванням
   */
  get(key, defaultValue = null, options = {}) {
    try {
      if (!key) {
        return defaultValue;
      }

      // Опції за замовчуванням
      const {
        checkExpiry = true      // Перевіряти термін дії
      } = options;

      // Повні ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      let value = null;
      let metadata = null;

      // Отримання даних з відповідного сховища
      if (this.config.storage === STORAGE_TYPES.MEMORY) {
        // Отримуємо дані з Map
        value = this._memoryCache.get(fullKey);
        metadata = this._metadataCache.get(metaKey);
      } else {
        // Отримуємо сховище
        const storage = this._getStorage();

        try {
          // Отримуємо дані зі сховища
          value = storage.getItem(fullKey);
          const metaStr = storage.getItem(metaKey);
          if (metaStr) {
            metadata = JSON.parse(metaStr);
          }
        } catch (storageError) {
          moduleErrors.warning(storageError, 'Помилка читання зі сховища', {
            category: ERROR_CATEGORIES.STORAGE,
            details: { key }
          });
        }

        // Для персистентного режиму перевіряємо також пам'ять
        if ((value === null || metadata === null) &&
            this.config.storage === STORAGE_TYPES.PERSISTENT) {
          value = this._memoryCache.get(fullKey);
          metadata = this._metadataCache.get(metaKey);
        }
      }

      // Якщо значення не знайдено
      if (value === null || metadata === null) {
        return defaultValue;
      }

      // Перевіряємо термін дії
      if (checkExpiry && metadata.expiresAt && metadata.expiresAt < Date.now()) {
        // Термін дії закінчився, видаляємо з кешу
        this.remove(key);
        return defaultValue;
      }

      // Десеріалізуємо значення
      const deserializedValue = this._deserialize(value, metadata.type);

      return deserializedValue;
    } catch (error) {
      moduleErrors.error(error, 'Помилка отримання з кешу', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { key }
      });
      return defaultValue;
    }
  }

  /**
   * Видалення значення з кешу
   * @param {string} key - Ключ
   * @returns {boolean} Результат операції
   */
  remove(key) {
    try {
      if (!key) return false;

      // Повні ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      // Видалення з відповідного сховища
      if (this.config.storage === STORAGE_TYPES.MEMORY) {
        // Видаляємо з Map
        this._memoryCache.delete(fullKey);
        this._metadataCache.delete(metaKey);
      } else {
        // Отримуємо сховище
        const storage = this._getStorage();

        try {
          // Видаляємо зі сховища
          storage.removeItem(fullKey);
          storage.removeItem(metaKey);
        } catch (storageError) {
          moduleErrors.warning(storageError, 'Помилка видалення зі сховища', {
            category: ERROR_CATEGORIES.STORAGE,
            details: { key }
          });
        }

        // Для персистентного режиму видаляємо також з пам'яті
        if (this.config.storage === STORAGE_TYPES.PERSISTENT) {
          this._memoryCache.delete(fullKey);
          this._metadataCache.delete(metaKey);
        }
      }

      return true;
    } catch (error) {
      moduleErrors.error(error, 'Помилка видалення з кешу', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { key }
      });
      return false;
    }
  }

  /**
   * Очищення застарілих або зайвих записів кешу
   * @param {boolean} force - Примусове очищення більшої кількості
   * @returns {number} Кількість видалених записів
   */
  cleanup(force = false) {
    try {
      // Скидаємо лічильник
      this._processedCount = 0;

      // Часовий штамп для порівняння
      const now = Date.now();

      // Для примусового очищення видаляємо більше записів
      const cleanupPercentage = force ? 0.5 : 0.25; // 50% або 25%

      // Збираємо всі ключі та метадані
      const allItems = this._getAllItems();

      // Фільтруємо застарілі записи
      const expiredItems = allItems.filter(item =>
        item.metadata && item.metadata.expiresAt && item.metadata.expiresAt < now
      );

      // Видаляємо всі застарілі записи
      expiredItems.forEach(item => {
        this.remove(item.key);
        this._processedCount++;
      });

      // Якщо видалено достатньо або немає потреби в додатковому очищенні
      if (!force && this._processedCount > 0) {
        if (this.config.debug) {
          moduleErrors.info(`Очищено ${this._processedCount} застарілих записів`, 'cleanup');
        }
        return this._processedCount;
      }

      // Перевіряємо розмір кешу
      if (allItems.length > this.config.maxSize) {
        // Визначаємо кількість записів для видалення
        const itemsToRemove = Math.ceil((allItems.length - this.config.maxSize) +
                                        (allItems.length * cleanupPercentage));

        // Сортуємо за часом доступу (видаляємо найстаріші)
        const sortedItems = allItems
          .filter(item => !expiredItems.includes(item)) // Виключаємо вже видалені
          .sort((a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0));

        // Видаляємо старі записи
        sortedItems.slice(0, itemsToRemove).forEach(item => {
          this.remove(item.key);
          this._processedCount++;
        });
      }

      if (this.config.debug && this._processedCount > 0) {
        moduleErrors.info(`Очищено ${this._processedCount} записів кешу`, 'cleanup');
      }

      return this._processedCount;
    } catch (error) {
      moduleErrors.error(error, 'Помилка очищення кешу', {
        category: ERROR_CATEGORIES.LOGIC
      });
      return 0;
    }
  }

  /**
   * Отримання всіх ключів і метаданих
   * @returns {Array} Масив об'єктів з ключами і метаданими
   */
  _getAllItems() {
    try {
      const items = [];

      if (this.config.storage === STORAGE_TYPES.MEMORY) {
        // Отримуємо з Map
        this._metadataCache.forEach((metadata, metaKey) => {
          const key = metaKey.replace('__meta', '');
          items.push({ key, metadata });
        });
      } else {
        // Отримуємо зі сховища
        const storage = this._getStorage();
        const prefix = this.config.prefix;

        // Перебираємо всі ключі в сховищі
        for (let i = 0; i < storage.length; i++) {
          const fullKey = storage.key(i);

          // Перевіряємо, чи це ключ метаданих і чи відповідає префіксу
          if (fullKey && fullKey.startsWith(prefix) && fullKey.endsWith('__meta')) {
            try {
              const metaStr = storage.getItem(fullKey);
              if (metaStr) {
                const metadata = JSON.parse(metaStr);
                const key = fullKey.slice(prefix.length, -7); // Видаляємо префікс і "__meta"
                items.push({ key, metadata });
              }
            } catch (e) {
              // Ігноруємо некоректні метадані
            }
          }
        }

        // Для персистентного режиму додаємо також з пам'яті
        if (this.config.storage === STORAGE_TYPES.PERSISTENT) {
          this._metadataCache.forEach((metadata, metaKey) => {
            const key = metaKey.replace('__meta', '');

            // Додаємо тільки якщо ще немає такого ключа
            if (!items.some(item => item.key === key)) {
              items.push({ key, metadata });
            }
          });
        }
      }

      return items;
    } catch (error) {
      moduleErrors.error(error, 'Помилка отримання всіх елементів кешу', {
        category: ERROR_CATEGORIES.LOGIC
      });
      return [];
    }
  }

  /**
   * Перевірка і обмеження розміру кешу
   */
  _checkCacheSize() {
    try {
      const items = this._getAllItems();

      // Якщо розмір перевищено, викликаємо очищення
      if (items.length > this.config.maxSize) {
        this.cleanup();
      }
    } catch (error) {
      moduleErrors.error(error, 'Помилка перевірки розміру кешу', {
        category: ERROR_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Видалення записів за ключем або фільтром
   * @param {string|Function} keyOrFilter - Ключ або функція фільтрації
   * @returns {number} Кількість видалених записів
   */
  removeMany(keyOrFilter) {
    try {
      let count = 0;

      // Отримуємо всі елементи
      const items = this._getAllItems();

      // Фільтруємо елементи для видалення
      const itemsToRemove = typeof keyOrFilter === 'function'
        ? items.filter(item => keyOrFilter(item.key, item.metadata))
        : items.filter(item => item.key.includes(keyOrFilter));

      // Видаляємо кожен елемент
      itemsToRemove.forEach(item => {
        if (this.remove(item.key)) {
          count++;
        }
      });

      if (this.config.debug && count > 0) {
        moduleErrors.info(`Видалено ${count} записів`, 'removeMany');
      }

      return count;
    } catch (error) {
      moduleErrors.error(error, 'Помилка масового видалення з кешу', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { filter: typeof keyOrFilter }
      });
      return 0;
    }
  }

  /**
   * Видалення записів за тегами
   * @param {string|Array} tags - Тег або масив тегів
   * @param {boolean} matchAll - Чи мають збігатися всі теги (true) або хоча б один (false)
   * @returns {number} Кількість видалених записів
   */
  removeByTags(tags, matchAll = false) {
    try {
      const tagsArray = Array.isArray(tags) ? tags : [tags];

      if (tagsArray.length === 0) return 0;

      return this.removeMany((key, metadata) => {
        if (!metadata || !metadata.tags || !Array.isArray(metadata.tags)) {
          return false;
        }

        if (matchAll) {
          // Всі теги мають збігатися
          return tagsArray.every(tag => metadata.tags.includes(tag));
        } else {
          // Хоча б один тег має збігатися
          return tagsArray.some(tag => metadata.tags.includes(tag));
        }
      });
    } catch (error) {
      moduleErrors.error(error, 'Помилка видалення за тегами', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { tags, matchAll }
      });
      return 0;
    }
  }

  /**
   * Перевірка наявності ключа в кеші
   * @param {string} key - Ключ
   * @param {boolean} checkExpiry - Враховувати час життя
   * @returns {boolean} Наявність ключа
   */
  has(key, checkExpiry = true) {
    try {
      if (!key) return false;

      // Повні ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      let exists = false;
      let metadata = null;

      // Перевірка у відповідному сховищі
      if (this.config.storage === STORAGE_TYPES.MEMORY) {
        // Перевіряємо в Map
        exists = this._memoryCache.has(fullKey);
        metadata = this._metadataCache.get(metaKey);
      } else {
        // Отримуємо сховище
        const storage = this._getStorage();

        try {
          // Перевіряємо в сховищі
          const value = storage.getItem(fullKey);
          exists = value !== null;

          if (exists) {
            const metaStr = storage.getItem(metaKey);
            if (metaStr) {
              metadata = JSON.parse(metaStr);
            }
          }
        } catch (storageError) {
          // Ігноруємо помилки сховища
        }

        // Для персистентного режиму перевіряємо також пам'ять
        if (!exists && this.config.storage === STORAGE_TYPES.PERSISTENT) {
          exists = this._memoryCache.has(fullKey);
          metadata = this._metadataCache.get(metaKey);
        }
      }

      // Якщо ключ не знайдено
      if (!exists || !metadata) {
        return false;
      }

      // Перевіряємо термін дії
      if (checkExpiry && metadata.expiresAt && metadata.expiresAt < Date.now()) {
        // Термін дії закінчився, видаляємо з кешу
        this.remove(key);
        return false;
      }

      return true;
    } catch (error) {
      moduleErrors.error(error, 'Помилка перевірки наявності в кеші', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { key }
      });
      return false;
    }
  }

  /**
   * Отримання всіх ключів
   * @param {Function} filter - Функція фільтрації
   * @returns {Array} Масив ключів
   */
  keys(filter = null) {
    try {
      // Отримуємо всі елементи
      const items = this._getAllItems();

      // Фільтруємо за необхідності
      const filteredItems = typeof filter === 'function'
        ? items.filter(item => filter(item.key, item.metadata))
        : items;

      // Повертаємо тільки ключі
      return filteredItems.map(item => item.key);
    } catch (error) {
      moduleErrors.error(error, 'Помилка отримання ключів кешу', {
        category: ERROR_CATEGORIES.LOGIC
      });
      return [];
    }
  }

  /**
   * Повне очищення кешу
   * @returns {boolean} Результат операції
   */
  clear() {
    try {
      if (this.config.storage === STORAGE_TYPES.MEMORY) {
        // Очищаємо Map
        this._memoryCache.clear();
        this._metadataCache.clear();
      } else {
        // Отримуємо сховище
        const storage = this._getStorage();
        const prefix = this.config.prefix;

        // Збираємо ключі для видалення
        const keysToRemove = [];

        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }

        // Видаляємо всі ключі
        keysToRemove.forEach(key => {
          try {
            storage.removeItem(key);
          } catch (e) {
            // Ігноруємо помилки
          }
        });

        // Для персистентного режиму очищаємо також пам'ять
        if (this.config.storage === STORAGE_TYPES.PERSISTENT) {
          this._memoryCache.clear();
          this._metadataCache.clear();
        }
      }

      if (this.config.debug) {
        moduleErrors.info('Кеш повністю очищено', 'clear');
      }

      return true;
    } catch (error) {
      moduleErrors.error(error, 'Помилка очищення кешу', {
        category: ERROR_CATEGORIES.LOGIC
      });
      return false;
    }
  }

  /**
   * Отримання статистики кешу
   * @returns {Object} Об'єкт статистики
   */
  getStats() {
    try {
      // Отримуємо всі елементи
      const items = this._getAllItems();

      // Поточний час
      const now = Date.now();

      // Групуємо за тегами
      const tagStats = {};
      items.forEach(item => {
        if (item.metadata && item.metadata.tags) {
          item.metadata.tags.forEach(tag => {
            if (!tagStats[tag]) {
              tagStats[tag] = 0;
            }
            tagStats[tag]++;
          });
        }
      });

      // Рахуємо застарілі записи
      const expiredCount = items.filter(item =>
        item.metadata && item.metadata.expiresAt && item.metadata.expiresAt < now
      ).length;

      return {
        totalItems: items.length,
        expiredItems: expiredCount,
        maxSize: this.config.maxSize,
        storageType: this.config.storage,
        tagStats,
        lastCleanup: this._lastCleanupTime || null
      };
    } catch (error) {
      moduleErrors.error(error, 'Помилка отримання статистики кешу', {
        category: ERROR_CATEGORIES.LOGIC
      });
      return {
        error: true,
        message: error.message
      };
    }
  }

  /**
   * Оновлення конфігурації
   * @param {Object} newConfig - Нова конфігурація
   * @returns {Object} Поточна конфігурація
   */
  updateConfig(newConfig) {
    try {
      // Застосовуємо нову конфігурацію
      Object.assign(this.config, newConfig);

      // Якщо змінився інтервал очищення, оновлюємо таймер
      if ('cleanupInterval' in newConfig) {
        this._startCleanupTimer();
      }

      // Перевіряємо доступність сховищ при зміні типу
      if ('storage' in newConfig) {
        this._checkStorageAvailability();
      }

      return { ...this.config };
    } catch (error) {
      moduleErrors.error(error, 'Помилка оновлення конфігурації', {
        category: ERROR_CATEGORIES.LOGIC
      });
      return { ...this.config };
    }
  }

  /**
   * Деактивація сервісу
   */
  destroy() {
    try {
      // Зупиняємо таймер очищення
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
        this._cleanupTimer = null;
      }

      // Скидаємо стан ініціалізації
      this._initialized = false;

      if (this.config.debug) {
        moduleErrors.info('CacheService деактивовано', 'destroy');
      }
    } catch (error) {
      moduleErrors.error(error, 'Помилка деактивації сервісу', {
        category: ERROR_CATEGORIES.LOGIC
      });
    }
  }
}

// Створюємо єдиний екземпляр для використання всіма модулями
const cacheService = new CacheService();

// Експортуємо
export default cacheService;