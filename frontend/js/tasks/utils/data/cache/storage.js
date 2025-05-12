/**
 * Адаптер сховища для системи кешування
 *
 * Відповідає за:
 * - Інтеграцію з різними типами сховищ (localStorage, sessionStorage)
 * - Серіалізацію та десеріалізацію даних
 * - Сумісність зі старим API
 *
 * @version 2.0.0
 */

import { getLogger } from '../../../utils/core/index.js';

// Створюємо логер для модуля
const logger = getLogger('CacheStorage');

// Типи сховищ
export const STORAGE_TYPES = {
  MEMORY: 'memory', // В пам'яті (Map)
  LOCAL: 'localStorage', // localStorage
  SESSION: 'sessionStorage', // sessionStorage
  PERSISTENT: 'persistent', // Комбінація localStorage + пам'ять для резервного копіювання
};

/**
 * Адаптер сховища для системи кешування
 */
export class StorageAdapter {
  /**
   * Створення адаптера сховища
   * @param {Object} config - Конфігурація адаптера
   */
  constructor(config = {}) {
    // Налаштування за замовчуванням
    this.config = {
      prefix: 'cache_', // Префікс для ключів у localStorage/sessionStorage
      storage: STORAGE_TYPES.LOCAL, // Тип сховища за замовчуванням
      serializeObjects: true, // Автоматично перетворювати об'єкти в JSON
      debug: false, // Режим відлагодження
    };

    // Застосовуємо конфігурацію
    Object.assign(this.config, config);

    // Визначаємо доступні типи сховищ
    this.availableStorages = this._checkStorageAvailability();

    // Вибираємо основне сховище
    this.storageType = this._selectStorageType();

    // Логуємо ініціалізацію
    if (this.config.debug) {
      logger.info('Ініціалізовано StorageAdapter', {
        storageType: this.storageType,
        availableStorages: this.availableStorages,
      });
    }
  }

  /**
   * Перевірка доступності сховищ
   * @returns {Object} Доступні сховища
   * @private
   */
  _checkStorageAvailability() {
    const available = {
      localStorage: false,
      sessionStorage: false,
    };

    try {
      // Перевіряємо localStorage
      if (typeof localStorage !== 'undefined') {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        available.localStorage = true;
      }
    } catch (e) {
      // Ігноруємо помилку
    }

    try {
      // Перевіряємо sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        available.sessionStorage = true;
      }
    } catch (e) {
      // Ігноруємо помилку
    }

    return available;
  }

  /**
   * Вибір оптимального типу сховища
   * @returns {string} Тип сховища
   * @private
   */
  _selectStorageType() {
    const { storage } = this.config;
    const { localStorage, sessionStorage } = this.availableStorages;

    // Якщо вказаний тип недоступний, вибираємо альтернативу
    if (storage === STORAGE_TYPES.LOCAL && !localStorage) {
      return sessionStorage ? STORAGE_TYPES.SESSION : STORAGE_TYPES.MEMORY;
    }

    if (storage === STORAGE_TYPES.SESSION && !sessionStorage) {
      return localStorage ? STORAGE_TYPES.LOCAL : STORAGE_TYPES.MEMORY;
    }

    if (storage === STORAGE_TYPES.PERSISTENT && !localStorage) {
      return STORAGE_TYPES.MEMORY;
    }

    return storage;
  }

  /**
   * Отримання реального сховища
   * @returns {Storage|null} Об'єкт сховища
   * @private
   */
  _getStorage() {
    switch (this.storageType) {
      case STORAGE_TYPES.LOCAL:
        return localStorage;
      case STORAGE_TYPES.SESSION:
        return sessionStorage;
      case STORAGE_TYPES.PERSISTENT:
        return localStorage;
      default:
        return null;
    }
  }

  /**
   * Формування повного ключа з префіксом
   * @param {string} key - Ключ
   * @returns {string} Ключ з префіксом
   * @private
   */
  _getFullKey(key) {
    return `${this.config.prefix}${key}`;
  }

  /**
   * Формування ключа для метаданих
   * @param {string} key - Оригінальний ключ
   * @returns {string} Ключ для метаданих
   * @private
   */
  _getMetaKey(key) {
    return `${this.config.prefix}${key}__meta`;
  }

  /**
   * Серіалізація значення для зберігання
   * @param {*} value - Значення
   * @returns {string} Серіалізоване значення
   * @private
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
      logger.error('Помилка серіалізації значення', {
        valueType: typeof value,
        error: error.message,
      });
      return String(value);
    }
  }

  /**
   * Десеріалізація значення
   * @param {string} serialized - Серіалізоване значення
   * @param {string} type - Тип значення
   * @returns {*} Десеріалізоване значення
   * @private
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
            const dateObj = JSON.parse(serialized);
            return new Date(dateObj.value);
          } catch (e) {
            return new Date();
          }
        default:
          return serialized;
      }
    } catch (error) {
      logger.error('Помилка десеріалізації значення', {
        serialized,
        type,
        error: error.message,
      });
      return serialized;
    }
  }

  /**
   * Записує дані в сховище
   * @param {string} key - Ключ
   * @param {*} value - Значення
   * @param {Object} metadata - Метадані
   * @returns {boolean} Результат операції
   */
  setItem(key, value, metadata = {}) {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return false;

      // Формуємо ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      // Серіалізуємо дані
      const serializedValue = this._serialize(value);
      const serializedMeta = JSON.stringify(metadata);

      try {
        // Записуємо в сховище
        storage.setItem(fullKey, serializedValue);
        storage.setItem(metaKey, serializedMeta);
        return true;
      } catch (storageError) {
        // У випадку помилки (наприклад, переповнення) очищаємо старі записи
        this._cleanupStorage();

        try {
          // Повторна спроба
          storage.setItem(fullKey, serializedValue);
          storage.setItem(metaKey, serializedMeta);
          return true;
        } catch (retryError) {
          // Якщо і друга спроба невдала
          logger.error('Не вдалося записати в сховище навіть після очищення', {
            key,
            error: retryError.message,
          });
          return false;
        }
      }
    } catch (error) {
      logger.error('Помилка запису в сховище', { key, error: error.message });
      return false;
    }
  }

  /**
   * Отримує дані зі сховища
   * @param {string} key - Ключ
   * @returns {Object|null} Об'єкт { value, metadata } або null
   */
  getItem(key) {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return null;

      // Формуємо ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      // Отримуємо дані
      const serializedValue = storage.getItem(fullKey);
      const serializedMeta = storage.getItem(metaKey);

      // Якщо даних немає
      if (serializedValue === null || serializedMeta === null) {
        return null;
      }

      // Парсимо метадані
      let metadata;
      try {
        metadata = JSON.parse(serializedMeta);
      } catch (error) {
        logger.error('Помилка парсингу метаданих', { key, error: error.message });
        return null;
      }

      // Десеріалізуємо значення
      const value = this._deserialize(serializedValue, metadata.type);

      return { value, metadata };
    } catch (error) {
      logger.error('Помилка отримання зі сховища', { key, error: error.message });
      return null;
    }
  }

  /**
   * Видаляє дані зі сховища
   * @param {string} key - Ключ
   * @returns {boolean} Результат операції
   */
  removeItem(key) {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return false;

      // Формуємо ключі
      const fullKey = this._getFullKey(key);
      const metaKey = this._getMetaKey(key);

      // Видаляємо дані
      storage.removeItem(fullKey);
      storage.removeItem(metaKey);

      return true;
    } catch (error) {
      logger.error('Помилка видалення зі сховища', { key, error: error.message });
      return false;
    }
  }

  /**
   * Очищення сховища
   * @returns {boolean} Результат операції
   */
  clear() {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return false;

      // Видаляємо всі ключі з префіксом
      const prefix = this.config.prefix;
      const keysToRemove = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      // Видаляємо ключі
      keysToRemove.forEach((key) => {
        storage.removeItem(key);
      });

      return true;
    } catch (error) {
      logger.error('Помилка очищення сховища', { error: error.message });
      return false;
    }
  }

  /**
   * Очищення сховища від старих записів
   * @returns {number} Кількість видалених записів
   * @private
   */
  _cleanupStorage() {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return 0;

      // Префікс для метаданих
      const metaPrefix = `${this.config.prefix}`;
      const metaSuffix = '__meta';
      let removed = 0;

      // Поточний час
      const now = Date.now();

      // Збираємо всі метадані
      const metaEntries = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);

        if (key && key.startsWith(metaPrefix) && key.endsWith(metaSuffix)) {
          try {
            const metadata = JSON.parse(storage.getItem(key));
            const originalKey = key.substring(metaPrefix.length, key.length - metaSuffix.length);

            metaEntries.push({
              key: originalKey,
              metaKey: key,
              dataKey: this._getFullKey(originalKey),
              metadata,
            });
          } catch (e) {
            // Ігноруємо некоректні метадані
          }
        }
      }

      // Сортуємо за часом (спочатку старіші)
      metaEntries.sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0));

      // Видаляємо застарілі записи
      metaEntries.forEach((entry) => {
        // Видаляємо прострочені
        if (entry.metadata.expiresAt && entry.metadata.expiresAt < now) {
          storage.removeItem(entry.metaKey);
          storage.removeItem(entry.dataKey);
          removed++;
        }
      });

      // Якщо потрібно видалити більше (25% від всіх записів)
      if (removed < Math.ceil(metaEntries.length * 0.25)) {
        const toRemove = Math.ceil(metaEntries.length * 0.25) - removed;

        // Видаляємо найстаріші записи
        metaEntries.slice(0, toRemove).forEach((entry) => {
          storage.removeItem(entry.metaKey);
          storage.removeItem(entry.dataKey);
          removed++;
        });
      }

      return removed;
    } catch (error) {
      logger.error('Помилка очищення сховища', { error: error.message });
      return 0;
    }
  }

  /**
   * Отримання всіх елементів зі сховища
   * @returns {Array} Масив елементів { key, metadata }
   */
  getAllItems() {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return [];

      const items = [];
      const prefix = this.config.prefix;
      const metaSuffix = '__meta';

      // Перебираємо всі ключі
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);

        if (key && key.startsWith(prefix) && key.endsWith(metaSuffix)) {
          try {
            const metadata = JSON.parse(storage.getItem(key));
            const originalKey = key.substring(prefix.length, key.length - metaSuffix.length);

            items.push({
              key: originalKey,
              metadata,
            });
          } catch (e) {
            // Ігноруємо некоректні метадані
          }
        }
      }

      return items;
    } catch (error) {
      logger.error('Помилка отримання всіх елементів сховища', { error: error.message });
      return [];
    }
  }

  /**
   * Отримання кількості елементів у сховищі
   * @returns {number} Кількість елементів
   */
  getItemCount() {
    try {
      // Отримуємо сховище
      const storage = this._getStorage();
      if (!storage) return 0;

      const prefix = this.config.prefix;
      let count = 0;

      // Підраховуємо ключі з префіксом
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          count++;
        }
      }

      // Ділимо на 2, бо для кожного запису є ключ даних і ключ метаданих
      return Math.floor(count / 2);
    } catch (error) {
      logger.error('Помилка отримання кількості елементів', { error: error.message });
      return 0;
    }
  }

  /**
   * Оновлення конфігурації
   * @param {Object} newConfig - Нова конфігурація
   */
  updateConfig(newConfig) {
    // Оновлюємо тільки потрібні поля
    if (newConfig.prefix !== undefined) {
      this.config.prefix = newConfig.prefix;
    }

    if (newConfig.storage !== undefined) {
      this.config.storage = newConfig.storage;
      // Оновлюємо тип сховища
      this.storageType = this._selectStorageType();
    }

    if (newConfig.serializeObjects !== undefined) {
      this.config.serializeObjects = newConfig.serializeObjects;
    }

    if (newConfig.debug !== undefined) {
      this.config.debug = newConfig.debug;
    }
  }
}

/**
 * Адаптер для зворотної сумісності зі старим API task-storage
 */
export const storageCompat = {
  /**
   * Збереження даних у сховище
   * @param {string} key - Ключ
   * @param {any} value - Значення
   * @param {Object} options - Додаткові параметри
   * @returns {boolean} Успішність операції
   */
  setItem(key, value, options = {}) {
    const adapter = new StorageAdapter();

    // Параметри за замовчуванням
    const {
      persist = true, // Зберігати в localStorage
      expires = null, // Час життя в мс
    } = options;

    // Створюємо метадані
    const metadata = {
      type: typeof value,
      timestamp: Date.now(),
      expiresAt: expires ? Date.now() + expires : null,
      tags: [persist ? 'persistent' : 'session'],
      persist,
    };

    return adapter.setItem(key, value, metadata);
  },

  /**
   * Отримання даних зі сховища
   * @param {string} key - Ключ
   * @param {any} defaultValue - Значення за замовчуванням
   * @param {Object} options - Додаткові параметри
   * @returns {any} Збережене значення або значення за замовчуванням
   */
  getItem(key, defaultValue = null, options = {}) {
    const adapter = new StorageAdapter();

    // Отримуємо дані
    const result = adapter.getItem(key);

    // Якщо даних немає, повертаємо значення за замовчуванням
    if (!result) {
      return defaultValue;
    }

    // Перевіряємо термін дії
    if (
      options.checkExpiry !== false &&
      result.metadata.expiresAt &&
      result.metadata.expiresAt < Date.now()
    ) {
      // Видаляємо прострочений запис
      adapter.removeItem(key);
      return defaultValue;
    }

    return result.value;
  },

  /**
   * Видалення даних зі сховища
   * @param {string} key - Ключ
   * @returns {boolean} Успішність операції
   */
  removeItem(key) {
    const adapter = new StorageAdapter();
    return adapter.removeItem(key);
  },

  /**
   * Отримання всіх ключів
   * @returns {Array} Список ключів
   */
  getKeys() {
    const adapter = new StorageAdapter();
    const items = adapter.getAllItems();
    return items.map((item) => item.key);
  },

  /**
   * Очищення сховища
   * @returns {boolean} Успішність операції
   */
  clear() {
    const adapter = new StorageAdapter();
    return adapter.clear();
  },
};

export default storageCompat;
