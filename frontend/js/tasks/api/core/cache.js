/**
 * Сервіс кешування для API завдань
 *
 * Відповідає за:
 * - Зберігання відповідей API в кеші
 * - Управління життєвим циклом кешованих даних
 * - Ефективний доступ до кешованих даних
 *
 * @version 3.1.0
 */

import { CONFIG } from './config.js';

/**
 * Клас для керування кешем API запитів
 */
export class CacheService {
    constructor() {
        // Основне сховище кешу та часових міток
        this.cache = new Map();
        this.cacheTimestamps = new Map();
    }

    /**
     * Отримання даних з кешу
     * @param {string} key - Ключ кешу
     * @returns {Object|null} Кешовані дані або null
     */
    getCachedData(key) {
        // Перевіряємо наявність даних та їх актуальність
        if (this.cache.has(key) && this.cacheTimestamps.has(key)) {
            const timestamp = this.cacheTimestamps.get(key);
            // Перевіряємо, чи не застарів кеш
            if (Date.now() - timestamp < CONFIG.REQUEST_CACHE_TTL) {
                return this.cache.get(key);
            }
        }
        return null;
    }

    /**
     * Збереження даних у кеш
     * @param {string} key - Ключ кешу
     * @param {Object} data - Дані для кешування
     */
    cacheData(key, data) {
        this.cache.set(key, data);
        this.cacheTimestamps.set(key, Date.now());

        // Обмежуємо розмір кешу
        if (this.cache.size > 100) {
            // Знаходимо найстаріший ключ
            let oldestKey = null;
            let oldestTime = Date.now();

            for (const [k, time] of this.cacheTimestamps.entries()) {
                if (time < oldestTime) {
                    oldestTime = time;
                    oldestKey = k;
                }
            }

            // Видаляємо найстаріший запис
            if (oldestKey) {
                this.cache.delete(oldestKey);
                this.cacheTimestamps.delete(oldestKey);
            }
        }
    }

    /**
     * Очищення кешу
     * @param {string} [keyPattern] - Опціональний патерн ключа для вибіркового очищення
     */
    clearCache(keyPattern) {
        if (keyPattern) {
            // Очищаємо вибірково за патерном
            for (const key of this.cache.keys()) {
                if (key.includes(keyPattern)) {
                    this.cache.delete(key);
                    this.cacheTimestamps.delete(key);
                }
            }
        } else {
            // Очищаємо весь кеш
            this.cache.clear();
            this.cacheTimestamps.clear();
        }
    }

    /**
     * Генерація унікального ключа кешу на основі методу і URL
     * @param {string} method - HTTP метод
     * @param {string} url - URL запиту
     * @param {Object} data - Дані запиту
     * @returns {string} Унікальний ключ для кешування
     */
    generateCacheKey(method, url, data = {}) {
        return `${method}_${url}_${JSON.stringify(data)}`;
    }
}

// Експортуємо єдиний екземпляр сервісу
export default new CacheService();