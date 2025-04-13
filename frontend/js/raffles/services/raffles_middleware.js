/**
 * Модуль проміжної обробки розіграшів - виявляє та виправляє помилки з ID розіграшу
 * Також відслідковує та кешує активні розіграші
 */

import WinixRaffles from '../globals.js';
import { showLoading, hideLoading, showToast } from '../utils/ui-helpers.js';
import api from '../services/api.js';

// Кеш-сховище для активних ID розіграшів
let _activeRaffleIds = [];
// Час останнього оновлення кешу
let _cacheUpdateTime = 0;
// Максимальний час життя кешу (5 хвилин)
const CACHE_TTL = 5 * 60 * 1000;
// Регулярний вираз для валідації UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Клас проміжного модуля розіграшів
 * Відповідає за перевірку та нормалізацію ID розіграшів
 */
class RafflesMiddleware {
    /**
     * Ініціалізація модуля
     */
    init() {
        console.log("🛡️ RafflesMiddleware: Ініціалізація модуля перевірки розіграшів");

        try {
            // Завантаження збережених ID з локального сховища
            this._loadCachedIds();

            // Налаштування перехоплювачів подій
            this._setupEventListeners();

            // Автоматичне оновлення даних при запуску
            this.refreshActiveRaffleIds();

            console.log("✅ RafflesMiddleware: Модуль успішно ініціалізовано");
        } catch (error) {
            console.error("❌ RafflesMiddleware: Помилка ініціалізації:", error);
        }
    }

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventListeners() {
        try {
            // Підписуємося на події відкриття деталей розіграшу
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.on('open-raffle-details', (data) => {
                    // Перевіряємо валідність ID розіграшу перед відкриттям деталей
                    if (data && data.raffleId) {
                        const isValid = this.validateRaffleId(data.raffleId);
                        if (!isValid) {
                            // Якщо ID невалідний, показуємо повідомлення і скасовуємо відкриття
                            showToast('Розіграш не знайдено або закінчився. Оновіть список.', 'warning');
                            WinixRaffles.events.emit('refresh-raffles', { force: true });
                            return;
                        }
                    }
                });

                // Підписуємося на подію оновлення списку розіграшів
                WinixRaffles.events.on('refresh-raffles', () => {
                    this.refreshActiveRaffleIds();
                });

                // Підписуємося на помилки API
                document.addEventListener('api-error', (event) => {
                    const error = event.detail;

                    // Якщо помилка стосується розіграшів
                    if (error && error.endpoint &&
                        (error.endpoint.includes('raffles') || error.endpoint.includes('participate-raffle'))) {
                        console.warn("RafflesMiddleware: Виявлено помилку API для розіграшів:", error);

                        // Очищуємо кеш та оновлюємо список
                        setTimeout(() => this.refreshActiveRaffleIds(), 1000);
                    }
                });
            }

            // Додаємо глобальний перехоплювач помилок
            window.addEventListener('error', (event) => {
                // Перевіряємо, чи помилка пов'язана з розіграшами
                if (event.message &&
                    (event.message.includes('raffle_id') ||
                     event.message.includes('raffleId') ||
                     event.message.includes('розіграш'))) {
                    console.warn("RafflesMiddleware: Виявлено помилку, пов'язану з розіграшами:", event.message);

                    // Очищуємо кеш та оновлюємо список
                    setTimeout(() => this.clearCache(), 500);
                }
            });
        } catch (error) {
            console.error("❌ RafflesMiddleware: Помилка налаштування обробників подій:", error);
        }
    }

    /**
     * Завантаження кешованих ID з локального сховища
     * @private
     */
    _loadCachedIds() {
        try {
            const storedIds = localStorage.getItem('activeRaffleIds');
            const storedTime = localStorage.getItem('raffleIdsCacheTime');

            if (storedIds && storedTime) {
                _activeRaffleIds = JSON.parse(storedIds);
                _cacheUpdateTime = parseInt(storedTime);

                console.log(`RafflesMiddleware: Завантажено ${_activeRaffleIds.length} кешованих ID розіграшів`);
            }
        } catch (e) {
            console.warn("RafflesMiddleware: Помилка завантаження кешованих ID:", e);
            _activeRaffleIds = [];
            _cacheUpdateTime = 0;
        }
    }

    /**
     * Збереження кешованих ID в локальне сховище
     * @private
     */
    _saveCachedIds() {
        try {
            localStorage.setItem('activeRaffleIds', JSON.stringify(_activeRaffleIds));
            localStorage.setItem('raffleIdsCacheTime', _cacheUpdateTime.toString());
        } catch (e) {
            console.warn("RafflesMiddleware: Помилка збереження кешованих ID:", e);
        }
    }

    /**
     * Перевірка валідності ID розіграшу
     * @param {string} raffleId ID розіграшу для перевірки
     * @returns {boolean} true, якщо ID валідний і розіграш активний
     */
    validateRaffleId(raffleId) {
        if (!raffleId) return false;

        // Перевірка формату UUID
        if (!UUID_REGEX.test(raffleId)) {
            console.warn(`RafflesMiddleware: Невалідний формат UUID: ${raffleId}`);
            return false;
        }

        // Якщо кеш застарів або порожній, оновлюємо його
        const now = Date.now();
        if (now - _cacheUpdateTime > CACHE_TTL || _activeRaffleIds.length === 0) {
            // Оновлюємо асинхронно, але повертаємо результат на основі поточних даних
            this.refreshActiveRaffleIds();
        }

        // Перевірка наявності в списку активних розіграшів
        const isActive = _activeRaffleIds.includes(raffleId);

        if (!isActive) {
            console.warn(`RafflesMiddleware: ID ${raffleId} не знайдено в списку активних розіграшів`);
        }

        return isActive;
    }

    /**
     * Перевірка існування розіграшу через API
     * @param {string} raffleId ID розіграшу для перевірки
     * @returns {Promise<boolean>} Promise з результатом перевірки
     */
    async checkRaffleExists(raffleId) {
        if (!raffleId) return false;

        // Перевірка формату UUID
        if (!UUID_REGEX.test(raffleId)) {
            console.warn(`RafflesMiddleware: Невалідний формат UUID: ${raffleId}`);
            return false;
        }

        try {
            // Прямий запит до API для перевірки існування розіграшу
            const response = await api.apiRequest(`/api/raffles/${raffleId}/check`, 'GET', null, {
                timeout: 5000,
                suppressErrors: true
            });

            return response && response.status === 'success';
        } catch (error) {
            console.error(`RafflesMiddleware: Помилка перевірки розіграшу ${raffleId}:`, error);
            return false;
        }
    }

    /**
     * Оновлення списку активних ID розіграшів
     * @returns {Promise<string[]>} Promise зі списком активних ID
     */
    async refreshActiveRaffleIds() {
        try {
            showLoading('Оновлення списку розіграшів...', 'refresh-raffles');

            // Отримуємо оновлений список розіграшів
            const response = await api.apiRequest('/api/raffles', 'GET', null, {
                forceRefresh: true,
                timeout: 10000,
                suppressErrors: true
            });

            hideLoading('refresh-raffles');

            if (response && response.status === 'success' && response.data) {
                // Зберігаємо тільки ID активних розіграшів
                _activeRaffleIds = response.data.map(raffle => raffle.id);
                _cacheUpdateTime = Date.now();

                // Зберігаємо в локальне сховище
                this._saveCachedIds();

                console.log(`RafflesMiddleware: Оновлено ${_activeRaffleIds.length} активних розіграшів`);

                // Оповіщаємо про оновлення списку розіграшів
                if (WinixRaffles && WinixRaffles.events) {
                    WinixRaffles.events.emit('raffles-updated', {
                        count: _activeRaffleIds.length,
                        timestamp: Date.now()
                    });
                }

                return _activeRaffleIds;
            }

            return _activeRaffleIds;
        } catch (error) {
            console.error('RafflesMiddleware: Помилка оновлення списку розіграшів:', error);
            hideLoading('refresh-raffles');
            return _activeRaffleIds;
        }
    }

    /**
     * Очищення кешу ID розіграшів
     */
    clearCache() {
        _activeRaffleIds = [];
        _cacheUpdateTime = 0;

        try {
            localStorage.removeItem('activeRaffleIds');
            localStorage.removeItem('raffleIdsCacheTime');
        } catch (e) {
            console.warn("RafflesMiddleware: Помилка очищення кешу:", e);
        }

        console.log("RafflesMiddleware: Кеш ID розіграшів очищено");

        // Оновлюємо список
        this.refreshActiveRaffleIds();
    }

    /**
     * Отримання списку активних ID розіграшів
     * @returns {string[]} Список активних ID
     */
    getActiveRaffleIds() {
        return [..._activeRaffleIds];
    }

    /**
     * Перевірка та нормалізація ID розіграшу
     * @param {string} raffleId ID розіграшу для перевірки та нормалізації
     * @returns {string|null} Нормалізований ID або null, якщо ID невалідний
     */
    normalizeRaffleId(raffleId) {
        if (!raffleId) return null;

        try {
            // Перевірка формату UUID
            if (UUID_REGEX.test(raffleId)) {
                // ID вже у правильному форматі
                return raffleId;
            }

            // Видалення нецифрових символів крім дефісів
            const cleanId = raffleId.replace(/[^0-9a-f-]/gi, '');

            // Спроба відформатувати UUID
            if (cleanId.length >= 32) {
                // Вставляємо дефіси в правильних місцях
                const formattedId = [
                    cleanId.substring(0, 8),
                    cleanId.substring(8, 12),
                    cleanId.substring(12, 16),
                    cleanId.substring(16, 20),
                    cleanId.substring(20, 32)
                ].join('-');

                // Перевіряємо, чи відформатований ID відповідає формату UUID
                if (UUID_REGEX.test(formattedId)) {
                    console.log(`RafflesMiddleware: Успішно нормалізовано ID ${raffleId} => ${formattedId}`);
                    return formattedId;
                }
            }

            console.warn(`RafflesMiddleware: Неможливо нормалізувати ID: ${raffleId}`);
            return null;
        } catch (error) {
            console.error(`RafflesMiddleware: Помилка нормалізації ID ${raffleId}:`, error);
            return null;
        }
    }
}

// Створюємо екземпляр класу
const rafflesMiddleware = new RafflesMiddleware();

// Додаємо в глобальний об'єкт для доступу з інших модулів
if (WinixRaffles) {
    WinixRaffles.middleware = rafflesMiddleware;
}

// Автоматична ініціалізація при завантаженні
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => rafflesMiddleware.init());
} else {
    setTimeout(() => rafflesMiddleware.init(), 100);
}

export default rafflesMiddleware;