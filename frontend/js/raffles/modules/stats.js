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
 * Перевірка, чи пристрій онлайн
 * @returns {boolean} Стан підключення
 */
function isOnline() {
    return typeof navigator.onLine === 'undefined' || navigator.onLine;
}

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

            // Завантажуємо свіжі дані
            this.updateStatistics().then(stats => {
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
     * Отримання даних статистики на основі історії розіграшів
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

        try {
            // Оскільки ендпоінту статистики немає - обчислюємо її на основі історії розіграшів
            showLoading('Оновлення статистики...', 'stats-update');

            // Отримуємо історію розіграшів
            let history = [];

            try {
                // Отримуємо ID користувача
                const userId = api.getUserId();
                if (!userId) {
                    throw new Error("ID користувача не знайдено");
                }

                // Спробуємо запитати історію розіграшів
                const response = await api.getRafflesHistory({}, true);

                if (Array.isArray(response)) {
                    history = response;
                } else if (response && response.data && Array.isArray(response.data)) {
                    history = response.data;
                }
            } catch (historyError) {
                console.warn("⚠️ Stats: Помилка отримання історії:", historyError.message);

                // Якщо є доступ до модуля історії, спробуємо отримати дані з нього
                if (WinixRaffles && WinixRaffles.history && typeof WinixRaffles.history.getRafflesHistory === 'function') {
                    try {
                        history = await WinixRaffles.history.getRafflesHistory({}, false);
                    } catch (moduleError) {
                        console.warn("⚠️ Stats: Не вдалося отримати історію з модуля:", moduleError);
                    }
                }
            }

            // Обчислюємо статистику на основі історії
            const stats = this.calculateStatsFromHistory(history);

            // Оновлюємо час останнього оновлення
            _lastUpdateTime = now;

            // Зберігаємо в кеш
            this._saveStatsToCache(stats);

            // Приховуємо лоадер
            hideLoading('stats-update');
            _isUpdating = false;

            // Емітуємо подію про оновлення статистики
            WinixRaffles.events.emit('statistics-updated', {
                data: stats,
                source: 'history'
            });

            return stats;
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
     * Розрахунок статистики на основі історії розіграшів
     * @param {Array} history - Історія розіграшів
     * @returns {Object} Об'єкт статистики
     */
    calculateStatsFromHistory(history = []) {
        // Базова статистика
        const stats = this.getDefaultStats();

        if (!Array.isArray(history) || history.length === 0) {
            return stats;
        }

        try {
            // Фільтруємо дані для безпечної обробки
            const safeHistory = history.filter(item => item && typeof item === 'object');

            // Загальна кількість участей
            stats.totalParticipated = safeHistory.length;

            // Обчислюємо решту статистики
            safeHistory.forEach(item => {
                // Рахуємо витрачені жетони
                if (item.tokensSpent || item.entry_count) {
                    const tokens = parseInt(item.tokensSpent || item.entry_count || 0);
                    if (!isNaN(tokens)) {
                        stats.totalTokensSpent += tokens;
                    }
                }

                // Рахуємо перемоги та виграші
                if (item.status === 'won' || item.won) {
                    stats.totalWins++;

                    // Обчислюємо суму виграшу
                    if (item.prize) {
                        const match = item.prize.match(/(\d+(?:\.\d+)?)\s*WINIX/i);
                        if (match) {
                            const winAmount = parseFloat(match[1]);
                            if (!isNaN(winAmount)) {
                                stats.totalWinixWon += winAmount;
                            }
                        }
                    }

                    // Запам'ятовуємо останній виграш
                    if (!stats.lastWin || (item.date && new Date(item.date) > new Date(stats.lastWin.date))) {
                        stats.lastWin = {
                            date: item.date,
                            amount: item.prize,
                            raffleId: item.raffle_id
                        };
                    }
                }

                // Запам'ятовуємо останню участь
                if (!stats.lastRaffle || (item.date && new Date(item.date) > new Date(stats.lastRaffle.date))) {
                    stats.lastRaffle = {
                        date: item.date,
                        raffleId: item.raffle_id,
                        title: item.title
                    };
                }
            });

            // Розрахунок додаткових показників
            const extendedStats = this.calculateExtendedStats(stats);

            return extendedStats;
        } catch (error) {
            console.error("❌ Stats: Помилка обчислення статистики з історії:", error);
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
     * Відображення статистики користувача
     * @param {string} containerId - ID контейнера для відображення
     * @param {boolean} forceRefresh - Примусове оновлення даних
     */
    async displayUserStats(containerId = 'user-stats-container', forceRefresh = false) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер з ID '${containerId}' не знайдено`);
            return;
        }

        try {
            // Додаємо заглушку до контейнера
            container.innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Завантаження статистики...</div>
                </div>
            `;

            // Перевіряємо підключення
            if (!isOnline() && !forceRefresh) {
                // В офлайн режимі використовуємо кешовані дані
                const cachedStats = this._getStatsFromCache();
                if (cachedStats) {
                    this.updateStatisticsDisplay(cachedStats);
                    this._renderStatsUI(container, cachedStats);
                    return;
                } else {
                    container.innerHTML = `
                        <div class="empty-stats">
                            <div class="empty-stats-icon">📊</div>
                            <h3>Статистика недоступна в офлайн режимі</h3>
                            <p>Підключіться до Інтернету для оновлення статистики.</p>
                        </div>
                    `;
                    return;
                }
            }

            // Отримуємо дані статистики
            const stats = await this.updateStatistics(forceRefresh);

            // Відображаємо статистику
            this._renderStatsUI(container, stats);

            // Оновлюємо відображення
            this.updateStatisticsDisplay(stats);

            // Емітуємо подію про відображення статистики
            WinixRaffles.events.emit('statistics-displayed', {
                containerId,
                data: stats
            });
        } catch (error) {
            console.error("Помилка відображення статистики:", error);
            container.innerHTML = `
                <div class="empty-stats">
                    <div class="empty-stats-icon">📊</div>
                    <h3>Не вдалося завантажити статистику</h3>
                    <p>Спробуйте оновити сторінку або повторіть спробу пізніше.</p>
                </div>
            `;
        }
    }

    /**
     * Рендерінг інтерфейсу статистики
     * @param {HTMLElement} container - Контейнер для відображення
     * @param {Object} stats - Дані статистики
     * @private
     */
    _renderStatsUI(container, stats) {
        // Форматування чисел для відображення
        const formatWithDecimals = (value) => {
            return Math.round(value * 100) / 100;
        };

        // Створюємо HTML для статистики
        const html = `
            <div class="stats-container">
                <div class="stats-header">
                    <h2>Ваша статистика розіграшів</h2>
                    <button id="refresh-stats-btn" class="refresh-btn">
                        <span class="refresh-icon">🔄</span>
                    </button>
                </div>
                
                <div class="stats-grid">
                    <div class="stats-card">
                        <div class="stats-card-title">Всього участей</div>
                        <div class="stats-card-value" id="total-participated">${formatNumber(stats.totalParticipated)}</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-title">Перемоги</div>
                        <div class="stats-card-value" id="total-wins">${formatNumber(stats.totalWins)}</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-title">Виграно WINIX</div>
                        <div class="stats-card-value" id="total-winix-won">${formatCurrency(stats.totalWinixWon)}</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-title">Витрачено жетонів</div>
                        <div class="stats-card-value" id="total-tokens-spent">${formatNumber(stats.totalTokensSpent)}</div>
                    </div>
                </div>
                
                <div class="stats-extended">
                    <div class="stats-item">
                        <div class="stats-item-label">Відсоток виграшів:</div>
                        <div class="stats-item-value">${formatWithDecimals(stats.winRate)}%</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">Середній виграш:</div>
                        <div class="stats-item-value">${formatWithDecimals(stats.averageWin)} WINIX</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">Ефективність жетонів:</div>
                        <div class="stats-item-value">${formatWithDecimals(stats.tokenEfficiency)} WINIX/жетон</div>
                    </div>
                </div>
                
                ${stats.lastWin ? `
                <div class="stats-last-win">
                    <h3>Останній виграш</h3>
                    <div class="last-win-details">
                        <div class="win-date">${stats.lastWin.date}</div>
                        <div class="win-amount">${stats.lastWin.amount}</div>
                    </div>
                </div>` : ''}
            </div>
        `;

        // Оновлюємо контейнер
        container.innerHTML = html;

        // Додаємо обробник події для кнопки оновлення
        const refreshButton = document.getElementById('refresh-stats-btn');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.updateStatistics(true).then(updatedStats => {
                    this._renderStatsUI(container, updatedStats);
                    this.updateStatisticsDisplay(updatedStats);
                }).catch(error => {
                    console.error("Помилка оновлення статистики:", error);
                    showToast("Не вдалося оновити статистику", "error");
                });
            });
        }
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

        // Розраховуємо статистику на основі історії
        const calculatedStats = this.calculateStatsFromHistory(history);

        // Зберігаємо оновлену статистику
        _currentStats = calculatedStats;
        this._saveStatsToCache(calculatedStats);

        // Оновлюємо відображення
        this.updateStatisticsDisplay(calculatedStats);

        console.log(`📊 Stats: Статистику оновлено з історії, ${calculatedStats.totalWins} перемог, ${calculatedStats.totalWinixWon} WINIX`);
    }

    /**
     * Оновлення статистики
     * @param {boolean} [forceRefresh=true] - Примусове оновлення з сервера
     * @returns {Promise<Object>} Об'єкт з актуальною статистикою
     */
    async updateStatistics(forceRefresh = true) {
        try {
            // Отримуємо дані з сервера/історії
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