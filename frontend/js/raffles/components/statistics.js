/**
 * statistics.js - Модуль статистики для WINIX WebApp
 * Відповідає за збір, розрахунок та відображення статистики розіграшів.
 */

(function() {
    'use strict';

    console.log("📊 Stats: Ініціалізація модуля статистики");

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

    // Прапорець ініціалізації
    let _initialized = false;

    // Поточні дані статистики
    let _currentStats = null;

    // Прапорець для індикації процесу оновлення
    let _isUpdating = false;

    // Час останнього оновлення
    let _lastUpdateTime = 0;

    /**
     * Отримання елемента DOM
     * @param {string} id - ID елемента
     * @returns {HTMLElement|null} - Елемент DOM або null, якщо не знайдено
     */
    function getElement(id) {
        return document.getElementById(id);
    }

    /**
     * Безпечне оновлення текстового вмісту елемента
     * @param {string} id - ID елемента
     * @param {string|number} value - Нове значення
     * @param {Function} formatter - Функція форматування (необов'язково)
     */
    function updateElementText(id, value, formatter = null) {
        const element = getElement(id);
        if (element) {
            const formattedValue = formatter ? formatter(value) : value;
            element.textContent = formattedValue;
        }
    }

    /**
     * Форматування числа як валюти
     * @param {number} amount - Сума
     * @param {number} decimals - Кількість знаків після коми
     * @returns {string} Форматована сума
     */
    function formatCurrency(amount, decimals = 0) {
        try {
            const value = parseFloat(amount);
            if (isNaN(value)) return '0';

            const numberFormat = new Intl.NumberFormat('uk-UA', {
                maximumFractionDigits: decimals,
                minimumFractionDigits: decimals
            });

            return numberFormat.format(value);
        } catch (e) {
            return (parseInt(amount) || 0).toString();
        }
    }

    /**
     * Отримання статистики з кешу
     * @returns {Object|null} Об'єкт статистики або null, якщо кеш порожній
     */
    function getStatsFromCache() {
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
     */
    function saveStatsToCache(stats) {
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
    async function fetchStatistics(forceRefresh = false) {
        // Перевіряємо, чи не відбувається вже оновлення
        if (_isUpdating) {
            console.log("⏳ Stats: Оновлення статистики вже виконується");
            return _currentStats || getStatsFromCache() || getDefaultStats();
        }

        // Перевіряємо, чи потрібно оновлювати дані
        const now = Date.now();
        if (!forceRefresh && _lastUpdateTime > 0 && (now - _lastUpdateTime) < STATS_UPDATE_INTERVAL) {
            console.log("⏳ Stats: Використання кешованої статистики");
            return _currentStats || getStatsFromCache() || getDefaultStats();
        }

        _isUpdating = true;

        try {
            // Перевіряємо наявність API
            if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                throw new Error("API недоступне");
            }

            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            // Виконуємо запит до API
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/statistics`, 'GET', null, {
                timeout: 10000,
                suppressErrors: true
            });

            if (response.status === 'success' && response.data) {
                // Оновлюємо статистику
                _currentStats = response.data;
                _lastUpdateTime = now;

                // Зберігаємо в кеш
                saveStatsToCache(_currentStats);

                return _currentStats;
            } else {
                throw new Error(response.message || "Помилка отримання статистики");
            }
        } catch (error) {
            console.warn("⚠️ Stats: Помилка отримання статистики:", error.message);

            // Якщо є кешована статистика - використовуємо її
            const cachedStats = getStatsFromCache();
            if (cachedStats) {
                console.log("📋 Stats: Використання кешованої статистики після помилки");
                return cachedStats;
            }

            // Якщо немає кешу - повертаємо стандартні значення
            return getDefaultStats();
        } finally {
            _isUpdating = false;
        }
    }

    /**
     * Отримання статистики за замовчуванням
     * @returns {Object} Об'єкт статистики з нульовими значеннями
     */
    function getDefaultStats() {
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
    function calculateExtendedStats(basicStats) {
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
    function updateStatisticsDisplay(stats) {
        // Якщо немає статистики, використовуємо порожні значення
        const data = stats || getDefaultStats();

        // Оновлюємо елементи інтерфейсу
        updateElementText(UI_ELEMENTS.totalParticipated, data.totalParticipated, formatCurrency);
        updateElementText(UI_ELEMENTS.totalWins, data.totalWins, formatCurrency);
        updateElementText(UI_ELEMENTS.totalWinixWon, data.totalWinixWon, formatCurrency);
        updateElementText(UI_ELEMENTS.totalTokensSpent, data.totalTokensSpent, formatCurrency);

        // Генеруємо подію оновлення статистики
        document.dispatchEvent(new CustomEvent('statistics-updated', {
            detail: data
        }));
    }

    /**
     * Оновлення статистики на основі участі в розіграші
     * @param {number} tokensSpent - Кількість витрачених жетонів
     */
    function updateParticipationStats(tokensSpent) {
        // Отримуємо поточну статистику
        const stats = _currentStats || getStatsFromCache() || getDefaultStats();

        // Оновлюємо лічильники
        stats.totalParticipated = (stats.totalParticipated || 0) + 1;
        stats.totalTokensSpent = (stats.totalTokensSpent || 0) + tokensSpent;

        // Зберігаємо оновлену статистику
        _currentStats = stats;
        saveStatsToCache(stats);

        // Оновлюємо відображення
        updateStatisticsDisplay(stats);
    }

    /**
     * Оновлення статистики на основі виграшу в розіграші
     * @param {number} winixAmount - Кількість виграних WINIX
     * @param {string} raffleId - ID розіграшу
     * @param {Object} raffleDetails - Деталі розіграшу
     */
    function updateWinStats(winixAmount, raffleId, raffleDetails = {}) {
        // Отримуємо поточну статистику
        const stats = _currentStats || getStatsFromCache() || getDefaultStats();

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
        _currentStats = stats;
        saveStatsToCache(stats);

        // Оновлюємо відображення
        updateStatisticsDisplay(stats);
    }

    /**
     * Оновлення статистики на основі історії розіграшів
     * @param {Array} history - Масив історії розіграшів
     */
    function updateStatsFromHistory(history) {
        if (!Array.isArray(history) || history.length === 0) {
            return;
        }

        // Отримуємо поточну статистику
        const stats = _currentStats || getStatsFromCache() || getDefaultStats();

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
        _currentStats = stats;
        saveStatsToCache(stats);

        // Оновлюємо відображення
        updateStatisticsDisplay(stats);
    }

    /**
     * Синхронізація локальної статистики з сервером
     */
    async function syncStatisticsWithServer() {
        try {
            // Отримуємо дані з сервера
            const serverStats = await fetchStatistics(true);

            // Отримуємо локальні дані
            const localStats = _currentStats || getStatsFromCache() || getDefaultStats();

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
            const extendedStats = calculateExtendedStats(mergedStats);

            // Зберігаємо оновлену статистику
            _currentStats = extendedStats;
            saveStatsToCache(extendedStats);

            // Оновлюємо відображення
            updateStatisticsDisplay(extendedStats);

            console.log("✅ Stats: Статистику успішно синхронізовано з сервером");

            return extendedStats;
        } catch (error) {
            console.warn("⚠️ Stats: Помилка синхронізації статистики:", error);
            return _currentStats;
        }
    }

    /**
     * Ініціалізація модуля статистики
     */
    async function init() {
        if (_initialized) {
            return;
        }

        try {
            console.log("🔄 Stats: Ініціалізація статистики");

            // Спочатку отримуємо кешовані дані
            _currentStats = getStatsFromCache();

            // Оновлюємо відображення з кешованими даними
            if (_currentStats) {
                updateStatisticsDisplay(_currentStats);
            }

            // Завантажуємо свіжі дані з сервера
            fetchStatistics().then(stats => {
                // Оновлюємо статистику
                _currentStats = stats;
                updateStatisticsDisplay(stats);
            });

            // Обробник подій для оновлення історії розіграшів
            document.addEventListener('raffle-history-loaded', function(event) {
                if (event.detail && Array.isArray(event.detail.history)) {
                    updateStatsFromHistory(event.detail.history);
                }
            });

            // Обробник подій для участі в розіграшах
            document.addEventListener('raffle-participated', function(event) {
                if (event.detail) {
                    updateParticipationStats(event.detail.tokensSpent || 0);
                }
            });

            // Обробник подій для виграшів
            document.addEventListener('raffle-win', function(event) {
                if (event.detail) {
                    updateWinStats(
                        event.detail.winixAmount || 0,
                        event.detail.raffleId,
                        event.detail.details
                    );
                }
            });

            _initialized = true;
            console.log("✅ Stats: Модуль статистики успішно ініціалізовано");
        } catch (error) {
            console.error("❌ Stats: Помилка ініціалізації модуля статистики:", error);
        }
    }

    // Експортуємо публічне API
    window.WinixStats = {
        // Основні функції
        getStatistics: fetchStatistics,
        updateDisplay: updateStatisticsDisplay,
        syncWithServer: syncStatisticsWithServer,

        // Функції оновлення статистики
        updateParticipation: updateParticipationStats,
        updateWin: updateWinStats,
        updateFromHistory: updateStatsFromHistory,

        // Інформація та утиліти
        getDefaultStats: getDefaultStats,
        calculateExtended: calculateExtendedStats
    };

    // Ініціалізуємо модуль при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    // Підписуємося на події WinixCore
    document.addEventListener('winix-initialized', function() {
        console.log("🔄 Stats: WinixCore ініціалізовано, оновлюємо статистику");
        setTimeout(() => {
            if (!_initialized) {
                init();
            } else {
                // Оновлюємо статистику
                fetchStatistics().then(updateStatisticsDisplay);
            }
        }, 500);
    });
})();