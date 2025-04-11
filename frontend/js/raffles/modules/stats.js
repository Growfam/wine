/**
 * stats.js - Модуль для роботи зі статистикою розіграшів WINIX
 * Відповідає за збір, розрахунок та відображення статистики розіграшів.
 */

import WinixRaffles from '../globals.js';
import api from '../services/api.js';
import { showToast } from '../utils/ui-helpers.js';
import { formatCurrency, formatNumber } from '../utils/formatters.js';

// Ключі для кешування
const CACHE_KEYS = {
    USER_STATS: 'user_statistics',
    GLOBAL_STATS: 'global_statistics',
    LAST_UPDATE: 'stats_last_update'
};

// Визначення елементів UI для оновлення
const UI_ELEMENTS = {
    totalParticipated: 'total-participated',
    totalWins: 'total-wins',
    totalWinixWon: 'total-winix-won',
    totalTokensSpent: 'total-tokens-spent'
};

// Інтервал оновлення статистики (мілісекунди)
const STATS_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 хвилин

/**
 * Клас для роботи зі статистикою розіграшів
 */
class StatisticsModule {
    /**
     * Конструктор класу
     */
    constructor() {
        // Прапорець ініціалізації
        this._initialized = false;

        // Поточні дані статистики
        this._currentStats = null;

        // Прапорець для індикації процесу оновлення
        this._isUpdating = false;

        // Час останнього оновлення
        this._lastUpdateTime = 0;
    }

    /**
     * Ініціалізація модуля
     */
    init() {
        if (this._initialized) {
            return;
        }

        console.log("📊 Stats: Ініціалізація модуля статистики");

        try {
            // Спочатку отримуємо кешовані дані
            this._currentStats = this._getStatsFromCache();

            // Оновлюємо відображення з кешованими даними
            if (this._currentStats) {
                this.updateStatisticsDisplay(this._currentStats);
            }

            // Завантажуємо свіжі дані з сервера
            this.fetchStatistics().then(stats => {
                // Оновлюємо статистику
                this._currentStats = stats;
                this.updateStatisticsDisplay(stats);
            });

            // Обробник подій для оновлення історії розіграшів
            document.addEventListener('raffle-history-loaded', (event) => {
                if (event.detail && Array.isArray(event.detail.history)) {
                    this.updateStatsFromHistory(event.detail.history);
                }
            });

            // Обробник подій для участі в розіграшах
            document.addEventListener('raffle-participated', (event) => {
                if (event.detail) {
                    this.updateParticipationStats(event.detail.tokensSpent || 0);
                }
            });

            // Обробник подій для виграшів
            document.addEventListener('raffle-win', (event) => {
                if (event.detail) {
                    this.updateWinStats(
                        event.detail.winixAmount || 0,
                        event.detail.raffleId,
                        event.detail.details
                    );
                }
            });

            this._initialized = true;
            console.log("✅ Stats: Модуль статистики успішно ініціалізовано");
        } catch (error) {
            console.error("❌ Stats: Помилка ініціалізації модуля статистики:", error);
        }
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
        // Перевіряємо наявність WinixCache
        if (window.WinixCache && typeof window.WinixCache.get === 'function') {
            return window.WinixCache.get('STATS', CACHE_KEYS.USER_STATS);
        } else {
            // Резервний варіант - використання localStorage напряму
            try {
                const cachedData = localStorage.getItem('winix_stats');
                return cachedData ? JSON.parse(cachedData) : null;
            } catch (e) {
                console.warn("⚠️ Stats: Помилка читання кешу статистики:", e);
                return null;
            }
        }
    }

    /**
     * Збереження статистики в кеш
     * @param {Object} stats - Об'єкт статистики
     * @private
     */
    _saveStatsToCache(stats) {
        // Перевіряємо наявність WinixCache
        if (window.WinixCache && typeof window.WinixCache.set === 'function') {
            window.WinixCache.set('STATS', CACHE_KEYS.USER_STATS, stats);
            window.WinixCache.set('STATS', CACHE_KEYS.LAST_UPDATE, Date.now());
        } else {
            // Резервний варіант - використання localStorage напряму
            try {
                localStorage.setItem('winix_stats', JSON.stringify(stats));
                localStorage.setItem('winix_stats_updated', Date.now().toString());
            } catch (e) {
                console.warn("⚠️ Stats: Помилка збереження кешу статистики:", e);
            }
        }
    }

    /**
     * Отримання даних статистики з API
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Object>} Проміс з даними статистики
     */
    async fetchStatistics(forceRefresh = false) {
        // Перевіряємо, чи не відбувається вже оновлення
        if (this._isUpdating) {
            console.log("⏳ Stats: Оновлення статистики вже виконується");
            return this._currentStats || this._getStatsFromCache() || this.getDefaultStats();
        }

        // Перевіряємо, чи потрібно оновлювати дані
        const now = Date.now();
        if (!forceRefresh && this._lastUpdateTime > 0 && (now - this._lastUpdateTime) < STATS_UPDATE_INTERVAL) {
            console.log("⏳ Stats: Використання кешованої статистики");
            return this._currentStats || this._getStatsFromCache() || this.getDefaultStats();
        }

        this._isUpdating = true;

        try {
            // Перевіряємо наявність API
            if (!api || typeof api.apiRequest !== 'function') {
                throw new Error("API недоступне");
            }

            // Отримуємо ID користувача
            const userId = api.getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            // Виконуємо запит до API
            const response = await api.apiRequest(`/api/user/${userId}/statistics`, 'GET', null, {
                timeout: 10000,
                suppressErrors: true
            });

            if (response.status === 'success' && response.data) {
                // Оновлюємо статистику
                this._currentStats = response.data;
                this._lastUpdateTime = now;

                // Зберігаємо в кеш
                this._saveStatsToCache(this._currentStats);

                return this._currentStats;
            } else {
                throw new Error(response.message || "Помилка отримання статистики");
            }
        } catch (error) {
            console.warn("⚠️ Stats: Помилка отримання статистики:", error.message);

            // Якщо є кешована статистика - використовуємо її
            const cachedStats = this._getStatsFromCache();
            if (cachedStats) {
                console.log("📋 Stats: Використання кешованої статистики після помилки");
                return cachedStats;
            }

            // Якщо немає кешу - повертаємо стандартні значення
            return this.getDefaultStats();
        } finally {
            this._isUpdating = false;
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
        document.dispatchEvent(new CustomEvent('statistics-updated', {
            detail: data
        }));
    }

    /**
     * Оновлення статистики на основі участі в розіграші
     * @param {number} tokensSpent - Кількість витрачених жетонів
     */
    updateParticipationStats(tokensSpent) {
        // Отримуємо поточну статистику
        const stats = this._currentStats || this._getStatsFromCache() || this.getDefaultStats();

        // Оновлюємо лічильники
        stats.totalParticipated = (stats.totalParticipated || 0) + 1;
        stats.totalTokensSpent = (stats.totalTokensSpent || 0) + tokensSpent;

        // Зберігаємо оновлену статистику
        this._currentStats = stats;
        this._saveStatsToCache(stats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(stats);
    }

    /**
     * Оновлення статистики на основі виграшу в розіграші
     * @param {number} winixAmount - Кількість виграних WINIX
     * @param {string} raffleId - ID розіграшу
     * @param {Object} raffleDetails - Деталі розіграшу
     */
    updateWinStats(winixAmount, raffleId, raffleDetails = {}) {
        // Отримуємо поточну статистику
        const stats = this._currentStats || this._getStatsFromCache() || this.getDefaultStats();

        // Оновлюємо лічильники
        stats.totalWins = (stats.totalWins || 0) + 1;
        stats.totalWinixWon = (stats.totalWinixWon || 0) + winixAmount;
        stats.lastWin = {
            date: new Date().toISOString(),
            amount: winixAmount,
            raffleId: raffleId,
            details: raffleDetails
        };

        // Зберігаємо оновлену статистику
        this._currentStats = stats;
        this._saveStatsToCache(stats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(stats);
    }

    /**
     * Оновлення статистики на основі історії розіграшів
     * @param {Array} history - Масив історії розіграшів
     */
    updateStatsFromHistory(history) {
        if (!Array.isArray(history) || history.length === 0) {
            return;
        }

        // Отримуємо поточну статистику
        const stats = this._currentStats || this._getStatsFromCache() || this.getDefaultStats();

        // Підрахунок статистики з історії
        let participated = 0;
        let wins = 0;
        let winixWon = 0;
        let tokensSpent = 0;

        history.forEach(item => {
            // Рахуємо участь
            participated++;

            // Додаємо витрачені жетони
            if (item.tokensSpent) {
                tokensSpent += parseInt(item.tokensSpent);
            }

            // Рахуємо виграші
            if (item.won || item.result === 'win' || (item.prize && parseInt(item.prize) > 0)) {
                wins++;

                // Додаємо виграні WINIX
                if (item.prize) {
                    winixWon += parseInt(item.prize);
                }
            }
        });

        // Оновлюємо статистику, якщо вона більша за поточну
        stats.totalParticipated = Math.max(stats.totalParticipated || 0, participated);
        stats.totalWins = Math.max(stats.totalWins || 0, wins);
        stats.totalWinixWon = Math.max(stats.totalWinixWon || 0, winixWon);
        stats.totalTokensSpent = Math.max(stats.totalTokensSpent || 0, tokensSpent);

        // Зберігаємо оновлену статистику
        this._currentStats = stats;
        this._saveStatsToCache(stats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(stats);
    }

    /**
     * Синхронізація локальної статистики з сервером
     * @returns {Promise<Object>} Об'єкт із синхронізованою статистикою
     */
    async syncStatisticsWithServer() {
        try {
            // Отримуємо дані з сервера
            const serverStats = await this.fetchStatistics(true);

            // Отримуємо локальні дані
            const localStats = this._currentStats || this._getStatsFromCache() || this.getDefaultStats();

            // Об'єднуємо дані (використовуємо вищі значення)
            const mergedStats = {
                totalParticipated: Math.max(serverStats.totalParticipated || 0, localStats.totalParticipated || 0),
                totalWins: Math.max(serverStats.totalWins || 0, localStats.totalWins || 0),
                totalWinixWon: Math.max(serverStats.totalWinixWon || 0, localStats.totalWinixWon || 0),
                totalTokensSpent: Math.max(serverStats.totalTokensSpent || 0, localStats.totalTokensSpent || 0),
                lastWin: serverStats.lastWin || localStats.lastWin,
                lastRaffle: serverStats.lastRaffle || localStats.lastRaffle
            };

            // Розраховуємо розширену статистику
            const extendedStats = this.calculateExtendedStats(mergedStats);

            // Зберігаємо оновлену статистику
            this._currentStats = extendedStats;
            this._saveStatsToCache(extendedStats);

            // Оновлюємо відображення
            this.updateStatisticsDisplay(extendedStats);

            console.log("✅ Stats: Статистику успішно синхронізовано з сервером");

            return extendedStats;
        } catch (error) {
            console.warn("⚠️ Stats: Помилка синхронізації статистики:", error);
            return this._currentStats;
        }
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

// Підписуємося на події WinixCore
document.addEventListener('winix-initialized', function() {
    console.log("🔄 Stats: WinixCore ініціалізовано, оновлюємо статистику");
    setTimeout(() => {
        if (!statisticsModule._initialized) {
            statisticsModule.init();
        } else {
            // Оновлюємо статистику
            statisticsModule.fetchStatistics().then(stats => statisticsModule.updateStatisticsDisplay(stats));
        }
    }, 500);
});

export default statisticsModule;