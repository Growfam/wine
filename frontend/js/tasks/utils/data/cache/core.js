/**
 * Основний модуль кешування даних
 *
 * Відповідає за:
 * - Управління кешем
 * - Зберігання та отримання даних
 * - Управління терміном дії кешу
 * - Управління тегами та групами кешу
 *
 * @version 2.0.0
 */

import { StorageAdapter } from './storage.js';
import { getLogger } from '../../core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('CacheCore');

// Теги для кешу
export const CACHE_TAGS = {
  COMMON: 'common',
  TEMP: 'temporary',
  USER: 'user',
  SYSTEM: 'system',
};

// Конфігурація за замовчуванням
const DEFAULT_CONFIG = {
  defaultTTL: 3600000, // Час життя кешу за замовчуванням (1 година)
  cleanupInterval: 300000, // Інтервал очищення (5 хвилин)
  maxSize: 500, // Максимальна кількість елементів у кеші
  prefix: 'cache_', // Префікс для ключів
  debug: false, // Режим відлагодження
};

/**
 * Основний клас кешу
 */
class CacheCore {
  /**
   * Створення об'єкту кешу
   * @param {Object} config - Конфігурація кешу
   */
  constructor(config = {}) {
    // Застосовуємо конфігурацію
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Створюємо адаптер для сховища
    this.storage = new StorageAdapter(this.config);

    // Структури даних для кешу в пам'яті
    this._memoryCache = new Map();
    this._metadataCache = new Map();

    // Таймер для очищення
    this._cleanupTimer = null;

    // Стан ініціалізації
    this._initialized = false;

    // Ініціалізуємо сервіс
    this._initialize();
  }

  /**
   * Ініціалізація сервісу
   * @private
   */
  _initialize() {
    if (this._initialized) return;

    // Запускаємо періодичне очищення
    this._startCleanupTimer();

    this._initialized = true;

    if (this.config.debug) {
      logger.info('CacheCore ініціалізовано', '_initialize');
    }
  }

  /**
   * Запуск таймера очищення
   * @private
   */
  _startCleanupTimer() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }

    this._cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Формування ключа для метаданих
   * @param {string} key - Оригінальний ключ
   * @returns {string} Ключ для метаданих
   * @private
   */
  _getMetaKey(key) {
    return `${key}__meta`;
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
        logger.warning('Спроба запису з порожнім ключем', 'set');
        return false;
      }

      // Опції за замовчуванням
      const {
        ttl = this.config.defaultTTL, // Час життя кешу
        tags = [], // Теги для групування
        persist = true, // Зберігати постійно
      } = options;

      // Метадані для запису
      const metadata = {
        type: typeof value,
        timestamp: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null,
        tags: Array.isArray(tags) ? tags : [],
        persist,
      };

      // Якщо це дата, коригуємо тип
      if (value instanceof Date) {
        metadata.type = 'date';
      } else if (Array.isArray(value)) {
        metadata.type = 'array';
      }

      // Збереження в пам'яті для швидкого доступу
      this._memoryCache.set(key, value);
      this._metadataCache.set(this._getMetaKey(key), metadata);

      // Збереження через адаптер сховища
      if (persist) {
        this.storage.setItem(key, value, metadata);
      }

      // Перевірка розміру кешу і видалення старих записів при необхідності
      this._checkCacheSize();

      return true;
    } catch (error) {
      logger.error('Помилка запису в кеш', { key, error: error.message });
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
        checkExpiry = true, // Перевіряти термін дії
        persist = true, // Читати з постійного сховища
      } = options;

      // Спочатку перевіряємо кеш в пам'яті
      let value = this._memoryCache.get(key);
      let metadata = this._metadataCache.get(this._getMetaKey(key));

      // Якщо немає в пам'яті і потрібно читати з постійного сховища
      if ((value === undefined || metadata === undefined) && persist) {
        const storageData = this.storage.getItem(key);

        if (storageData) {
          value = storageData.value;
          metadata = storageData.metadata;

          // Зберігаємо в пам'яті для подальшого швидкого доступу
          this._memoryCache.set(key, value);
          this._metadataCache.set(this._getMetaKey(key), metadata);
        }
      }

      // Якщо значення не знайдено
      if (value === undefined || metadata === undefined) {
        return defaultValue;
      }

      // Перевіряємо термін дії
      if (checkExpiry && metadata.expiresAt && metadata.expiresAt < Date.now()) {
        // Термін дії закінчився, видаляємо з кешу
        this.remove(key);
        return defaultValue;
      }

      return value;
    } catch (error) {
      logger.error('Помилка отримання з кешу', { key, error: error.message });
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

      // Видаляємо з кешу в пам'яті
      this._memoryCache.delete(key);
      this._metadataCache.delete(this._getMetaKey(key));

      // Видаляємо з постійного сховища
      this.storage.removeItem(key);

      return true;
    } catch (error) {
      logger.error('Помилка видалення з кешу', { key, error: error.message });
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
      // Кількість видалених записів
      let removedCount = 0;

      // Часовий штамп для порівняння
      const now = Date.now();

      // Для примусового очищення видаляємо більше записів
      const cleanupPercentage = force ? 0.5 : 0.25; // 50% або 25%

      // Збираємо всі ключі та метадані
      const allItems = this._getAllItems();

      // Фільтруємо застарілі записи
      const expiredItems = allItems.filter(
        (item) => item.metadata && item.metadata.expiresAt && item.metadata.expiresAt < now
      );

      // Видаляємо всі застарілі записи
      expiredItems.forEach((item) => {
        this.remove(item.key);
        removedCount++;
      });

      // Перевіряємо розмір кешу
      if (allItems.length > this.config.maxSize) {
        // Визначаємо кількість записів для видалення
        const itemsToRemove = Math.ceil(
          allItems.length - this.config.maxSize + allItems.length * cleanupPercentage
        );

        // Сортуємо за часом доступу (видаляємо найстаріші)
        const sortedItems = allItems
          .filter((item) => !expiredItems.includes(item)) // Виключаємо вже видалені
          .sort((a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0));

        // Видаляємо старі записи
        sortedItems.slice(0, itemsToRemove).forEach((item) => {
          this.remove(item.key);
          removedCount++;
        });
      }

      if (this.config.debug && removedCount > 0) {
        logger.info(`Очищено ${removedCount} записів кешу`, 'cleanup');
      }

      return removedCount;
    } catch (error) {
      logger.error('Помилка очищення кешу', { error: error.message });
      return 0;
    }
  }

  /**
   * Отримання всіх ключів і метаданих
   * @returns {Array} Масив об'єктів з ключами і метаданими
   * @private
   */
  _getAllItems() {
    try {
      const items = [];

      // Отримуємо з кешу в пам'яті
      this._metadataCache.forEach((metadata, metaKey) => {
        const key = metaKey.replace('__meta', '');
        items.push({ key, metadata });
      });

      // Додаємо елементи з постійного сховища, які ще не в пам'яті
      const storageItems = this.storage.getAllItems();

      storageItems.forEach((item) => {
        // Додаємо тільки якщо ще немає такого ключа
        if (!items.some((existingItem) => existingItem.key === item.key)) {
          items.push(item);
        }
      });

      return items;
    } catch (error) {
      logger.error('Помилка отримання всіх елементів кешу', { error: error.message });
      return [];
    }
  }

  /**
   * Перевірка і обмеження розміру кешу
   * @private
   */
  _checkCacheSize() {
    try {
      const items = this._getAllItems();

      // Якщо розмір перевищено, викликаємо очищення
      if (items.length > this.config.maxSize) {
        this.cleanup();
      }
    } catch (error) {
      logger.error('Помилка перевірки розміру кешу', { error: error.message });
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
      const itemsToRemove =
        typeof keyOrFilter === 'function'
          ? items.filter((item) => keyOrFilter(item.key, item.metadata))
          : items.filter((item) => item.key.includes(keyOrFilter));

      // Видаляємо кожен елемент
      itemsToRemove.forEach((item) => {
        if (this.remove(item.key)) {
          count++;
        }
      });

      if (this.config.debug && count > 0) {
        logger.info(`Видалено ${count} записів`, 'removeMany');
      }

      return count;
    } catch (error) {
      logger.error('Помилка масового видалення з кешу', {
        filter: typeof keyOrFilter,
        error: error.message,
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
          return tagsArray.every((tag) => metadata.tags.includes(tag));
        } else {
          // Хоча б один тег має збігатися
          return tagsArray.some((tag) => metadata.tags.includes(tag));
        }
      });
    } catch (error) {
      logger.error('Помилка видалення за тегами', { tags, matchAll, error: error.message });
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

      // Перевіряємо в пам'яті
      let exists = this._memoryCache.has(key);
      let metadata = this._metadataCache.get(this._getMetaKey(key));

      // Якщо немає в пам'яті, перевіряємо в постійному сховищі
      if (!exists) {
        const storageData = this.storage.getItem(key);

        if (storageData) {
          exists = true;
          metadata = storageData.metadata;

          // Зберігаємо в пам'яті для швидкого доступу
          this._memoryCache.set(key, storageData.value);
          this._metadataCache.set(this._getMetaKey(key), metadata);
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
      logger.error('Помилка перевірки наявності в кеші', { key, error: error.message });
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
      const filteredItems =
        typeof filter === 'function'
          ? items.filter((item) => filter(item.key, item.metadata))
          : items;

      // Повертаємо тільки ключі
      return filteredItems.map((item) => item.key);
    } catch (error) {
      logger.error('Помилка отримання ключів кешу', { error: error.message });
      return [];
    }
  }

  /**
   * Повне очищення кешу
   * @param {Object} options - Опції очищення
   * @returns {boolean} Результат операції
   */
  clear(options = {}) {
    try {
      const {
        onlyExpired = false, // Тільки прострочені записи
        preserveKeys = [], // Ключі для збереження
      } = options;

      if (onlyExpired) {
        // Очищаємо тільки прострочені записи
        this.cleanup();
      } else if (preserveKeys && preserveKeys.length > 0) {
        // Видаляємо всі, крім збережених
        this.removeMany((key) => !preserveKeys.includes(key));
      } else {
        // Повне очищення
        this._memoryCache.clear();
        this._metadataCache.clear();
        this.storage.clear();
      }

      if (this.config.debug) {
        logger.info('Кеш повністю очищено', 'clear');
      }

      return true;
    } catch (error) {
      logger.error('Помилка очищення кешу', { error: error.message });
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
      items.forEach((item) => {
        if (item.metadata && item.metadata.tags) {
          item.metadata.tags.forEach((tag) => {
            if (!tagStats[tag]) {
              tagStats[tag] = 0;
            }
            tagStats[tag]++;
          });
        }
      });

      // Рахуємо застарілі записи
      const expiredCount = items.filter(
        (item) => item.metadata && item.metadata.expiresAt && item.metadata.expiresAt < now
      ).length;

      return {
        totalItems: items.length,
        expiredItems: expiredCount,
        maxSize: this.config.maxSize,
        storageType: this.storage.storageType,
        tagStats,
        memoryItems: this._memoryCache.size,
        persistentItems: this.storage.getItemCount(),
      };
    } catch (error) {
      logger.error('Помилка отримання статистики кешу', { error: error.message });
      return {
        error: true,
        message: error.message,
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

      // Оновлюємо конфігурацію адаптера сховища
      this.storage.updateConfig(newConfig);

      return { ...this.config };
    } catch (error) {
      logger.error('Помилка оновлення конфігурації', { error: error.message });
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

      // Очищаємо кеш в пам'яті
      this._memoryCache.clear();
      this._metadataCache.clear();

      if (this.config.debug) {
        logger.info('CacheCore деактивовано', 'destroy');
      }
    } catch (error) {
      logger.error('Помилка деактивації сервісу', { error: error.message });
    }
  }
}

// Створюємо єдиний екземпляр для використання всіма модулями
const cacheCore = new CacheCore();

export default cacheCore;
