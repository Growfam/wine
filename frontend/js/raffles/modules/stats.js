/**
 * stats.js - Модуль для роботи зі статистикою розіграшів WINIX
 * Відповідає за збір, розрахунок та відображення статистики розіграшів.
 */

import WinixRaffles from '../globals.js';
import api from '../services/api.js';
import { showLoading, hideLoading, showToast } from '../utils/ui-helpers.js';
import { formatCurrency, formatNumber } from '../utils/formatters.js';

// Приватні змінні
let _currentStats = null;
let _isUpdating = false;
let _lastUpdateTime = 0;
let _eventListeners = [];

// Інтервал оновлення статистики (мілісекунди)
const STATS_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 хвилин

// Визначення елементів UI для оновлення
const UI_ELEMENTS = {
    totalParticipated: 'total-participated',
    totalWins: 'total-wins',
    totalWinixWon: 'total-winix-won',
    totalTokensSpent: 'total-tokens-spent'
};

// Кеш статистики в localStorage
const CACHE_KEY = 'winix_user_statistics';

/**
 * Клас для роботи зі статистикою розіграшів
 */
class StatisticsModule {
    /**
     * Ініціалізація модуля
     */
    init() {
        console.log("📊 Stats: Ініціалізація модуля статистики");

        try {
            // Спочатку отримуємо кешовані дані
            _currentStats = this._getStatsFromCache();

            // Оновлюємо відображення з кешованими даними
            if (_currentStats) {
                this.updateStatisticsDisplay(_currentStats);
            }

            // Завантажуємо свіжі дані з сервера
            this.fetchStatistics().then(stats => {
                // Оновлюємо статистику
                _currentStats = stats;
                this.updateStatisticsDisplay(stats);
            });

            // Додаємо обробники подій
            this._setupEventListeners();

            console.log("✅ Stats: Модуль статистики успішно ініціалізовано");
        } catch (error) {
            console.error("❌ Stats: Помилка ініціалізації модуля статистики:", error);
        }
    }

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventListeners() {
        // Обробник подій для оновлення історії розіграшів
        const historyUpdateHandler = (event) => {
            if (event.detail && Array.isArray(event.detail.data)) {
                this.updateStatsFromHistory(event.detail.data);
            }
        };

        document.addEventListener('history-updated', historyUpdateHandler);
        _eventListeners.push({
            element: document,
            event: 'history-updated',
            handler: historyUpdateHandler
        });

        // Обробник подій для участі в розіграшах
        const participationHandler = (event) => {
            if (event.detail) {
                this.updateParticipationStats(event.detail.entryCount || 0);
            }
        };

        document.addEventListener('raffle-participated', participationHandler);
        _eventListeners.push({
            element: document,
            event: 'raffle-participated',
            handler: participationHandler
        });

        // Обробник подій для виграшів
        const winHandler = (event) => {
            if (event.detail) {
                this.updateWinStats(
                    event.detail.winixAmount || 0,
                    event.detail.raffleId,
                    event.detail.details
                );
            }
        };

        document.addEventListener('raffle-win', winHandler);
        _eventListeners.push({
            element: document,
            event: 'raffle-win',
            handler: winHandler
        });
    }

    /**
     * Видалення обробників подій
     * @private
     */
    _removeEventListeners() {
        _eventListeners.forEach(listener => {
            if (listener.element && listener.event && listener.handler) {
                listener.element.removeEventListener(listener.event, listener.handler);
            }
        });

        _eventListeners = [];
    }

    /**
     * Отримання елемента DOM
     * @param {string} id - ID елемента
     * @returns {HTMLElement|null} - Елемент DOM або null, якщо не знайдено
     * @private
     */
    _getElement(id) {
        return document.getElementById(id);
    }

    /**
     * Безпечне оновлення текстового вмісту елемента
     * @param {string} id - ID елемента
     * @param {string|number} value - Нове значення
     * @param {Function} formatter - Функція форматування (необов'язково)
     * @private
     */
    _updateElementText(id, value, formatter = null) {
        const element = this._getElement(id);
        if (element) {
            const formattedValue = formatter ? formatter(value) : value;
            element.textContent = formattedValue;
        }
    }

    /**
     * Отримання статистики з кешу
     * @returns {Object|null} Об'єкт статистики або null
     * @private
     */
    _getStatsFromCache() {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (!cachedData) return null;

            const parsedData = JSON.parse(cachedData);

            // Перевіряємо, чи дані не застаріли (30 днів)
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 днів
            if (parsedData.timestamp && Date.now() - parsedData.timestamp > maxAge) {
                console.log('📊 Stats: Кешовані дані застаріли, видаляємо їх');
                localStorage.removeItem(CACHE_KEY);
                return null;
            }

            return parsedData.data;
        } catch (e) {
            console.warn("⚠️ Stats: Помилка читання кешу статистики:", e);
            return null;
        }
    }

    /**
     * Збереження статистики в кеш
     * @param {Object} stats - Об'єкт статистики
     * @private
     */
    _saveStatsToCache(stats) {
        try {
            const cacheData = {
                data: stats,
                timestamp: Date.now()
            };

            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (e) {
            console.warn("⚠️ Stats: Помилка збереження кешу статистики:", e);
        }
    }

    /**
     * Отримання даних статистики з API
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Object>} Проміс з даними статистики
     */
    async fetchStatistics(forceRefresh = false) {
        // Перевіряємо, чи не відбувається вже оновлення
        if (_isUpdating) {
            console.log("⏳ Stats: Оновлення статистики вже виконується");
            return _currentStats || this._getStatsFromCache() || this.getDefaultStats();
        }

        // Перевіряємо, чи потрібно оновлювати дані
        const now = Date.now();
        if (!forceRefresh && _lastUpdateTime > 0 && (now - _lastUpdateTime) < STATS_UPDATE_INTERVAL) {
            console.log("⏳ Stats: Використання кешованої статистики");
            return _currentStats || this._getStatsFromCache() || this.getDefaultStats();
        }

        _isUpdating = true;

        // Використовуємо централізований лоадер
        showLoading('Оновлення статистики...', 'stats-update');

        try {
            // Отримуємо ID користувача
            const userId = api.getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            // Виконуємо запит до API
            const response = await api.apiRequest(`/api/user/${userId}/statistics`, 'GET', null, {
                timeout: 10000,
                suppressErrors: true,
                hideLoader: true // Використовуємо власний лоадер
            });

            // Приховуємо лоадер і скидаємо прапорець
            hideLoading('stats-update');
            _isUpdating = false;

            if (response.status === 'success' && response.data) {
                // Оновлюємо статистику
                const stats = response.data;
                _lastUpdateTime = now;

                // Зберігаємо в кеш
                this._saveStatsToCache(stats);

                // Емітуємо подію про оновлення статистики
                WinixRaffles.events.emit('statistics-updated', {
                    data: stats,
                    source: 'api'
                });

                return stats;
            } else {
                throw new Error(response.message || "Помилка отримання статистики");
            }
        } catch (error) {
            console.warn("⚠️ Stats: Помилка отримання статистики:", error.message);

            // Приховуємо лоадер і скидаємо прапорець
            hideLoading('stats-update');
            _isUpdating = false;

            // Якщо є кешована статистика - використовуємо її
            const cachedStats = this._getStatsFromCache();
            if (cachedStats) {
                console.log("📋 Stats: Використання кешованої статистики після помилки");
                return cachedStats;
            }

            // Якщо немає кешу - повертаємо стандартні значення
            return this.getDefaultStats();
        }
    }

    /**
     * Отримання статистики за замовчуванням
     * @returns {Object} Об'єкт статистики з нульовими значеннями
     */
    getDefaultStats() {
        return {
            totalParticipated: 0,
            totalWins: 0,
            totalWinixWon: 0,
            totalTokensSpent: 0,
            winRate: 0,
            lastRaffle: null,
            lastWin: null
        };
    }

    /**
     * Розрахунок додаткової статистики
     * @param {Object} basicStats - Базова статистика
     * @returns {Object} Розширена статистика
     */
    calculateExtendedStats(basicStats) {
        const stats = { ...basicStats };

        // Розрахунок відсотка виграшів
        if (stats.totalParticipated > 0) {
            stats.winRate = (stats.totalWins / stats.totalParticipated) * 100;
        } else {
            stats.winRate = 0;
        }

        // Розрахунок середнього виграшу
        if (stats.totalWins > 0) {
            stats.averageWin = stats.totalWinixWon / stats.totalWins;
        } else {
            stats.averageWin = 0;
        }

        // Розрахунок ефективності витрат жетонів
        if (stats.totalTokensSpent > 0) {
            stats.tokenEfficiency = stats.totalWinixWon / stats.totalTokensSpent;
        } else {
            stats.tokenEfficiency = 0;
        }

        return stats;
    }

    /**
     * Оновлення відображення статистики
     * @param {Object} stats - Об'єкт статистики
     */
    updateStatisticsDisplay(stats) {
        // Якщо немає статистики, використовуємо порожні значення
        const data = stats || this.getDefaultStats();

        // Оновлюємо елементи інтерфейсу
        this._updateElementText(UI_ELEMENTS.totalParticipated, data.totalParticipated, formatNumber);
        this._updateElementText(UI_ELEMENTS.totalWins, data.totalWins, formatNumber);
        this._updateElementText(UI_ELEMENTS.totalWinixWon, data.totalWinixWon, formatCurrency);
        this._updateElementText(UI_ELEMENTS.totalTokensSpent, data.totalTokensSpent, formatNumber);

        // Генеруємо подію оновлення статистики
        WinixRaffles.events.emit('statistics-displayed', {
            data
        });
    }

    /**
     * Оновлення статистики на основі участі в розіграші
     * @param {number} tokensSpent - Кількість витрачених жетонів
     */
    updateParticipationStats(tokensSpent) {
        // Перевіряємо, що переданий коректний параметр
        if (isNaN(tokensSpent) || tokensSpent < 0) {
            console.warn('⚠️ Stats: Некоректне значення витрачених жетонів:', tokensSpent);
            return;
        }

        // Отримуємо поточну статистику
        const stats = _currentStats || this._getStatsFromCache() || this.getDefaultStats();

        // Оновлюємо лічильники
        stats.totalParticipated = (stats.totalParticipated || 0) + 1;
        stats.totalTokensSpent = (stats.totalTokensSpent || 0) + tokensSpent;

        // Оновлюємо додаткову статистику
        const updatedStats = this.calculateExtendedStats(stats);

        // Зберігаємо оновлену статистику
        _currentStats = updatedStats;
        this._saveStatsToCache(updatedStats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(updatedStats);

        console.log(`📊 Stats: Оновлено статистику участі, +${tokensSpent} жетонів`);
    }

    /**
     * Оновлення статистики на основі виграшу в розіграші
     * @param {number} winixAmount - Кількість виграних WINIX
     * @param {string} raffleId - ID розіграшу
     * @param {Object} raffleDetails - Деталі розіграшу
     */
    updateWinStats(winixAmount, raffleId, raffleDetails = {}) {
        // Перевіряємо, що переданий коректний параметр
        if (isNaN(winixAmount) || winixAmount < 0) {
            console.warn('⚠️ Stats: Некоректне значення виграшу WINIX:', winixAmount);
            return;
        }

        // Отримуємо поточну статистику
        const stats = _currentStats || this._getStatsFromCache() || this.getDefaultStats();

        // Оновлюємо лічильники
        stats.totalWins = (stats.totalWins || 0) + 1;
        stats.totalWinixWon = (stats.totalWinixWon || 0) + winixAmount;
        stats.lastWin = {
            date: new Date().toISOString(),
            amount: winixAmount,
            raffleId: raffleId,
            details: raffleDetails
        };

        // Оновлюємо додаткову статистику
        const updatedStats = this.calculateExtendedStats(stats);

        // Зберігаємо оновлену статистику
        _currentStats = updatedStats;
        this._saveStatsToCache(updatedStats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(updatedStats);

        console.log(`📊 Stats: Оновлено статистику виграшів, +${winixAmount} WINIX`);
    }

    /**
     * Оновлення статистики на основі історії розіграшів
     * @param {Array} history - Масив історії розіграшів
     */
    updateStatsFromHistory(history) {
        if (!Array.isArray(history) || history.length === 0) {
            return;
        }

        console.log(`📊 Stats: Аналіз історії розіграшів, ${history.length} записів`);

        // Отримуємо поточну статистику
        const stats = _currentStats || this._getStatsFromCache() || this.getDefaultStats();

        // Підрахунок статистики з історії
        let participated = 0;
        let wins = 0;
        let winixWon = 0;
        let tokensSpent = 0;

        // Створюємо копію для безпечної обробки
        const safeHistory = [...history].filter(item => item !== null && typeof item === 'object');

        safeHistory.forEach(item => {
            try {
                // Рахуємо участь
                participated++;

                // Додаємо витрачені жетони
                if (item.tokensSpent || item.entry_count) {
                    tokensSpent += parseInt(item.tokensSpent || item.entry_count || 0);
                }

                // Рахуємо виграші
                if (item.won || item.status === 'won' || (item.prize && parseInt(item.prize) > 0)) {
                    wins++;

                    // Додаємо виграні WINIX
                    if (item.prize) {
                        // Витягуємо числову суму з рядка призу (тільки для WINIX)
                        const match = item.prize.match(/(\d+(?:\.\d+)?)\s*WINIX/i);
                        if (match) {
                            winixWon += parseFloat(match[1]);
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ Stats: Помилка обробки елемента історії:', e);
            }
        });

        // Оновлюємо статистику, якщо вона більша за поточну
        stats.totalParticipated = Math.max(stats.totalParticipated || 0, participated);
        stats.totalWins = Math.max(stats.totalWins || 0, wins);
        stats.totalWinixWon = Math.max(stats.totalWinixWon || 0, winixWon);
        stats.totalTokensSpent = Math.max(stats.totalTokensSpent || 0, tokensSpent);

        // Оновлюємо додаткову статистику
        const updatedStats = this.calculateExtendedStats(stats);

        // Зберігаємо оновлену статистику
        _currentStats = updatedStats;
        this._saveStatsToCache(updatedStats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(updatedStats);

        console.log(`📊 Stats: Статистику оновлено з історії, ${wins} перемог, ${winixWon} WINIX`);
    }

    /**
     * Оновлення статистики
     * @param {boolean} [forceRefresh=true] - Примусове оновлення з сервера
     * @returns {Promise<Object>} Об'єкт з актуальною статистикою
     */
    async updateStatistics(forceRefresh = true) {
        try {
            // Отримуємо дані з сервера
            const stats = await this.fetchStatistics(forceRefresh);

            // Оновлюємо відображення
            this.updateStatisticsDisplay(stats);

            return stats;
        } catch (error) {
            console.warn("⚠️ Stats: Помилка оновлення статистики:", error);
            return _currentStats || this.getDefaultStats();
        }
    }

    /**
     * Очищення ресурсів при закритті модуля
     */
    destroy() {
        // Видаляємо обробники подій
        this._removeEventListeners();

        // Скидаємо прапорці
        _isUpdating = false;

        console.log("🚫 Stats: Модуль статистики закрито");
    }
}

// Створюємо екземпляр класу
const statisticsModule = new StatisticsModule();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.stats = statisticsModule;

// Автоматична ініціалізація
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => statisticsModule.init());
} else {
    setTimeout(() => statisticsModule.init(), 100);
}

export default statisticsModule;