/**
 * Модуль для роботи з історією розіграшів WINIX
 */

import WinixRaffles from '../globals.js';
import { showLoading, hideLoading, showToast } from '../utils/ui-helpers.js';
import api from '../services/api.js';

/**
 * Перевірка доступності основного API
 * @returns {boolean} Доступність API
 */
function hasMainApi() {
    try {
        return window.WinixAPI &&
               typeof window.WinixAPI.apiRequest === 'function' &&
               typeof window.WinixAPI.getUserId === 'function';
    } catch (e) {
        console.error("🔌 Історія розіграшів: Помилка перевірки головного API:", e);
        return false;
    }
}

// Приватні змінні - ініціалізуємо з дефолтними значеннями
let _historyData = [];
let _isLoading = false;
let _failedAttempts = 0;
let _lastRequestTime = Date.now(); // Ініціалізація значенням часу
let _requestInProgress = false;
let _requestTimeoutId = null;
let _historyCache = {
    data: null,
    timestamp: 0,
    ttl: 300000 // 5 хвилин
};
let _raffleDetailsCache = {};
let _requestId = 0; // Унікальний ідентифікатор запиту

// Константи
const RETRY_DELAYS = [2000, 5000, 10000]; // Зменшена кількість повторних спроб
const MIN_REQUEST_INTERVAL = 15000; // Збільшено інтервал між запитами
const MAX_RETRIES = 2; // Максимальна кількість повторних спроб

/**
 * Перевірка, чи пристрій онлайн
 * @returns {boolean} Стан підключення
 */
function isOnline() {
    return typeof navigator.onLine === 'undefined' || navigator.onLine;
}

/**
 * Клас для роботи з історією розіграшів
 */
class HistoryModule {
    /**
     * Ініціалізація модуля історії розіграшів
     */
    init() {
        console.log("📋 Історія розіграшів: Ініціалізація...");

        // Підписуємося на події
        this._setupEventListeners();



        // Перевіряємо наявність контейнера для історії
        const historyContainer = document.getElementById('history-container');
        if (historyContainer) {
            // Додаємо кнопку експорту
            const exportButton = document.createElement('button');
            exportButton.className = 'export-history-btn';
            exportButton.innerHTML = '<span>📊</span> Експорт історії';
            exportButton.addEventListener('click', this.exportHistoryToCSV.bind(this));

            // Додаємо кнопку перед контейнером
            historyContainer.parentNode.insertBefore(exportButton, historyContainer);
        }

        // Відновлюємо кешовані дані, якщо вони є
        this._loadCachedHistory();

        console.log("✅ Історія розіграшів: Ініціалізацію завершено");
    }

    /**
     * Завантаження кешованих даних історії з localStorage
     * @private
     */
    _loadCachedHistory() {
        try {
            const cachedHistory = localStorage.getItem('winix_raffles_history');
            if (cachedHistory) {
                const parsedHistory = JSON.parse(cachedHistory);
                if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
                    _historyData = parsedHistory;
                    _historyCache.data = parsedHistory;
                    _historyCache.timestamp = Date.now();
                    console.log(`📋 Історія розіграшів: Відновлено ${parsedHistory.length} записів з localStorage`);
                }
            }
        } catch (e) {
            console.warn("⚠️ Історія розіграшів: Помилка завантаження кешу:", e);
        }
    }

    /**
 * Додавання сітки статистики
 * @param {HTMLElement} container - Контейнер для додавання сітки
 * @private
 */
_addStatsGrid(container) {
    // Додаємо статистику, якщо її ще немає на сторінці
    if (!document.querySelector('.stats-grid') && container) {
        const statsGrid = document.createElement('div');
        statsGrid.className = 'stats-grid';
        statsGrid.innerHTML = `
            <div class="stats-card">
                <div class="stats-card-title">Всього участей</div>
                <div class="stats-card-value" id="total-participated">-</div>
            </div>
            <div class="stats-card">
                <div class="stats-card-title">Перемоги</div>
                <div class="stats-card-value" id="total-wins">-</div>
            </div>
            <div class="stats-card">
                <div class="stats-card-title">Виграно WINIX</div>
                <div class="stats-card-value" id="total-winix-won">-</div>
            </div>
            <div class="stats-card">
                <div class="stats-card-title">Витрачено жетонів</div>
                <div class="stats-card-value" id="total-tokens-spent">-</div>
            </div>
        `;

        // Додаємо сітку перед контейнером історії
        if (container.parentNode) {
            container.parentNode.insertBefore(statsGrid, container);
        }
    }
}

/**
 * Оновлення статистики
 * @param {number} total - Загальна кількість розіграшів
 * @param {number} wins - Кількість перемог
 * @param {number} winixWon - Кількість виграних WINIX
 * @param {number} tokensSpent - Витрачено жетонів
 * @private
 */
_updateStatistics(total, wins, winixWon, tokensSpent) {
    try {
        // Оновлюємо елементи інтерфейсу
        const totalParticipated = document.getElementById('total-participated');
        const totalWins = document.getElementById('total-wins');
        const totalWinixWon = document.getElementById('total-winix-won');
        const totalTokensSpent = document.getElementById('total-tokens-spent');

        if (totalParticipated) totalParticipated.textContent = total || 0;
        if (totalWins) totalWins.textContent = wins || 0;
        if (totalWinixWon) totalWinixWon.textContent = winixWon || 0;
        if (totalTokensSpent) totalTokensSpent.textContent = tokensSpent || 0;
    } catch (error) {
        console.error("Помилка оновлення статистики:", error);
    }
}

    /**
     * Збереження даних історії в localStorage
     * @param {Array} data - Дані для збереження
     * @private
     */
    _saveHistoryToCache(data) {
        if (!Array.isArray(data)) return;

        try {
            localStorage.setItem('winix_raffles_history', JSON.stringify(data));
            console.log(`📋 Історія розіграшів: Збережено ${data.length} записів в localStorage`);
        } catch (e) {
            console.warn("⚠️ Історія розіграшів: Помилка збереження в localStorage:", e);
        }
    }

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventListeners() {
        // Підписуємося на подію запиту на відображення вкладки історії
        WinixRaffles.events.on('history-tab-requested', () => {
            this.displayHistory('history-container');
        });

        // Підписуємося на подію запиту на оновлення історії
        WinixRaffles.events.on('refresh-history', (data) => {
            const containerId = data && data.containerId ? data.containerId : 'history-container';
            this.displayHistory(containerId, true);
        });

        // Обробники подій мережі
        window.addEventListener('online', () => {
            console.log("🔄 Історія розіграшів: З'єднання з мережею відновлено");
            // Очищуємо стан запитів на випадок, якщо запит був активний при відключенні
            this.resetRequestState();
        });

        window.addEventListener('offline', () => {
            console.warn("⚠️ Історія розіграшів: З'єднання з мережею втрачено");
            // При втраті з'єднання переривати поточні запити
            this.resetRequestState();
        });
    }

    /**
     * Отримання історії розіграшів
     * @param {Object} filters - Фільтри для запиту
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Array>} Список історії розіграшів
     */
    async getRafflesHistory(filters = {}, forceRefresh = false) {
        try {
            const now = Date.now();

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline() && !forceRefresh) {
                console.warn("📋 Історія розіграшів: Пристрій офлайн, використовуємо кешовані дані");

                // Якщо є кешовані дані, повертаємо їх
                if (_historyCache.data && Array.isArray(_historyCache.data)) {
                    return _historyCache.data;
                }

                // Якщо є дані, які зберегли раніше
                if (_historyData && _historyData.length > 0) {
                    return _historyData;
                }

                // Повертаємо порожній масив, якщо немає даних
                return [];
            }

            // Перевіряємо кеш, якщо не вимагається примусове оновлення
            if (!forceRefresh && _historyCache.data && now - _historyCache.timestamp < _historyCache.ttl) {
                console.log("📋 Історія розіграшів: Використовуємо кешовані дані");
                return Promise.resolve(_historyCache.data);
            }

            // Автоматичне очищення прапорця, якщо запит тривав занадто довго
            if (_requestInProgress && now - _lastRequestTime > 30000) {
                console.warn("⚠️ Історія розіграшів: Виявлено зависаючий запит, очищаємо стан");
                _requestInProgress = false;
                if (_requestTimeoutId) {
                    clearTimeout(_requestTimeoutId);
                    _requestTimeoutId = null;
                }
            }

            // Перевіряємо, чи запит вже в процесі
            if (_requestInProgress) {
                console.log("⏳ Історія розіграшів: Запит уже виконується, використовуємо кеш");
                // Якщо кеш є - повертаємо його
                if (_historyCache.data) {
                    return Promise.resolve(_historyCache.data);
                }
                // Повертаємо поточні дані
                return Promise.resolve(_historyData);
            }

            // Перевіряємо інтервал між запитами
            const timeSinceLastRequest = now - _lastRequestTime;
            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && _historyData.length > 0 && !forceRefresh) {
                console.log(`⏳ Історія розіграшів: Занадто частий запит, минуло ${Math.floor(timeSinceLastRequest/1000)}с`);
                return Promise.resolve(_historyData);
            }

            _isLoading = true;
            _requestInProgress = true;
            _lastRequestTime = now;
            const currentRequestId = ++_requestId;

            // Встановлюємо таймаут для автоматичного скидання прапорця
            if (_requestTimeoutId) {
                clearTimeout(_requestTimeoutId);
            }
            _requestTimeoutId = setTimeout(() => {
                if (_requestInProgress) {
                    console.warn("⚠️ Історія розіграшів: Запит виконується занадто довго, скидаємо прапорець");
                    _requestInProgress = false;
                    _isLoading = false;
                }
            }, 20000); // 20 секунд максимальний час виконання запиту

            // Використовуємо централізований лоадер
            showLoading('Завантаження історії розіграшів...', 'history-request');

            // Отримуємо дані з API
            const userId = api.getUserId();
            if (!userId) {
                _isLoading = false;
                _requestInProgress = false;
                hideLoading('history-request');
                throw new Error('ID користувача не знайдено');
            }

            // Формуємо параметри запиту
            let queryParams = '';
            if (filters.type && filters.type !== 'all') {
                queryParams += `&type=${filters.type}`;
            }
            if (filters.status && filters.status !== 'all') {
                queryParams += `&status=${filters.status}`;
            }
            if (filters.period && filters.period !== 'all') {
                queryParams += `&period=${filters.period}`;
            }

            // Додаємо параметри до URL, якщо вони є
            let url = '';
            if (queryParams) {
                url = `user/${userId}/raffles-history?${queryParams.substring(1)}`;
            } else {
                url = `user/${userId}/raffles-history`;
            }

            // Додати оновлення токену перед запитом до API
            if (hasMainApi() && typeof window.WinixAPI.refreshToken === 'function') {
                try {
                    await window.WinixAPI.refreshToken();
                } catch (e) {
                    console.warn("🔌 Історія розіграшів: Помилка оновлення токену:", e);
                }
            }

            try {
                // Покращені параметри запиту
                const response = await api.apiRequest(url, 'GET', null, {
                    timeout: 15000,
                    allowParallel: false,
                    suppressErrors: true,
                    hideLoader: true, // Вже використовуємо власний лоадер
                    forceCleanup: _failedAttempts > 0
                });

                // Перевіряємо, чи це актуальний запит
                if (currentRequestId !== _requestId) {
                    console.warn("⚠️ Історія розіграшів: Отримано відповідь для застарілого запиту, ігноруємо");
                    hideLoading('history-request');
                    return _historyData || [];
                }

                // ЗАВЖДИ скидаємо прапорці після завершення запиту
                hideLoading('history-request');
                _isLoading = false;
                _requestInProgress = false;
                _failedAttempts = 0; // Скидаємо лічильник при успіху

                // Очищаємо таймаут
                if (_requestTimeoutId) {
                    clearTimeout(_requestTimeoutId);
                    _requestTimeoutId = null;
                }

                if (response && response.status === 'success') {
                    // Перевіряємо, чи отримані дані - це масив
                    if (!Array.isArray(response.data)) {
                        // Якщо дані не масив, але успішний статус - повертаємо порожній масив
                        console.warn("Отримано некоректні дані історії (не масив):", response.data);
                        _historyData = [];
                        // Оновлюємо кеш пустими даними
                        _historyCache = {
                            data: [],
                            timestamp: now,
                            ttl: _historyCache.ttl
                        };
                        return _historyData;
                    }

                    _historyData = response.data;
                    console.log(`✅ Історія розіграшів: Отримано ${_historyData.length} записів історії`);

                    // Оновлюємо кеш
                    _historyCache = {
                        data: _historyData,
                        timestamp: now,
                        ttl: _historyCache.ttl
                    };

                    // Зберігаємо в localStorage для офлайн доступу
                    this._saveHistoryToCache(_historyData);

                    // Емітуємо подію про оновлення історії
                    WinixRaffles.events.emit('history-updated', {
                        count: _historyData.length,
                        data: _historyData
                    });

                    return _historyData;
                } else {
                    // Якщо статус не успіх, але є дані - перевіряємо джерело
                    if (response && response.source && response.source.includes('fallback')) {
                        // Це спеціальний випадок фолбека в API
                        console.warn(`Історія розіграшів: Отримано фолбек-відповідь: ${response.source}`);

                        if (Array.isArray(response.data)) {
                            _historyData = response.data;
                            // Оновлюємо кеш
                            _historyCache = {
                                data: _historyData,
                                timestamp: now,
                                ttl: 60000 // Коротший TTL для фолбеку
                            };

                            // Зберігаємо в localStorage для офлайн доступу
                            this._saveHistoryToCache(_historyData);

                            return _historyData;
                        }
                    }

                    throw new Error((response && response.message) || 'Помилка отримання історії розіграшів');
                }
            } catch (apiError) {
                // Переобробляємо помилку API
                throw apiError;
            }
        } catch (error) {
            console.error('❌ Помилка отримання історії розіграшів:', error);

            // Збільшуємо лічильник невдалих спроб
            _failedAttempts++;

            // ОБОВ'ЯЗКОВО скидаємо прапорці
            hideLoading('history-request');
            _isLoading = false;
            _requestInProgress = false;

            // Очищаємо таймаут
            if (_requestTimeoutId) {
                clearTimeout(_requestTimeoutId);
                _requestTimeoutId = null;
            }

            // Не показуємо помилку при першій спробі
            if (_failedAttempts > 1) {
                showToast('Не вдалося завантажити історію розіграшів. Спробуйте пізніше.', 'error');
            }

            // Для серверної помилки або помилки паралельного запиту, повертаємо кешовані дані
            if (_historyData.length > 0) {
                return _historyData;
            }

            // Перевіряємо кеш
            if (_historyCache.data) {
                console.log("📋 Історія розіграшів: Використовуємо кешовані дані після помилки");
                return _historyCache.data;
            }

            // Якщо немає даних навіть у кеші, тоді перевіряємо, чи слід повторити спробу
            if (_failedAttempts <= MAX_RETRIES) {
                const retryIndex = Math.min(_failedAttempts - 1, RETRY_DELAYS.length - 1);
                const retryDelay = RETRY_DELAYS[retryIndex];
                console.log(`🔄 Історія розіграшів: Спроба повторного запиту через ${retryDelay/1000}с`);

                // Повертаємо проміс з таймаутом і повторним запитом
                return new Promise(resolve => {
                    setTimeout(() => {
                        this.getRafflesHistory(filters)
                            .then(resolve)
                            .catch(err => {
                                // У випадку помилки при повторній спробі повертаємо порожній масив
                                console.error("Помилка повторного запиту:", err);
                                resolve([]);
                            });
                    }, retryDelay);
                });
            }

            // Якщо всі спроби невдалі, повертаємо порожній масив
            return [];
        }
    }

    // Інші методи класу HistoryModule залишаються без змін...

    /**
     * Отримання детальної інформації про розіграш з історії
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Деталі розіграшу
     */
    async getRaffleHistoryDetails(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline()) {
                console.warn("📋 Історія розіграшів: Пристрій офлайн, використовуємо кешовані деталі");

                // Перевіряємо кеш деталей
                if (_raffleDetailsCache[raffleId]) {
                    return _raffleDetailsCache[raffleId];
                }

                // Перевіряємо спочатку локальні дані
                const localRaffleData = _historyData.find(item => item && item.raffle_id === raffleId);
                if (localRaffleData) {
                    return localRaffleData;
                }

                // Якщо даних немає, повертаємо базову структуру
                return {
                    raffle_id: raffleId,
                    title: "Дані недоступні",
                    winners: [],
                    status: "unknown",
                    source: "offline_fallback"
                };
            }

            // Перевіряємо кеш деталей
            if (_raffleDetailsCache[raffleId]) {
                console.log(`📋 Історія розіграшів: Використання кешованих деталей для розіграшу ${raffleId}`);
                return _raffleDetailsCache[raffleId];
            }

            // Перевіряємо спочатку локальні дані
            const localRaffleData = _historyData.find(item => item && item.raffle_id === raffleId);
            if (localRaffleData && localRaffleData.winners) {
                console.log("📋 Історія розіграшів: Використання локальних даних для деталей розіграшу");

                // Кешуємо результат
                _raffleDetailsCache[raffleId] = localRaffleData;

                return localRaffleData;
            }

            const userId = api.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Перевіряємо, чи не надто частий запит
            const now = Date.now();
            const timeSinceLastRequest = now - _lastRequestTime;
            if (timeSinceLastRequest < 3000) { // 3 секунди між запитами
                await new Promise(resolve => setTimeout(resolve, 3000 - timeSinceLastRequest));
            }

            // Використовуємо централізоване відображення лоадера
            showLoading('Завантаження деталей розіграшу...', `history-details-${raffleId}`);

            // Додати оновлення токену перед запитом до API
            if (hasMainApi() && typeof window.WinixAPI.refreshToken === 'function') {
                try {
                    await window.WinixAPI.refreshToken();
                } catch (e) {
                    console.warn("🔌 Історія розіграшів: Помилка оновлення токену:", e);
                }
            }

            try {
                // Виправлений URL шлях
                const response = await api.apiRequest(
                    `user/${userId}/raffles-history/${raffleId}`,
                    'GET',
                    null,
                    {
                        timeout: 8000,
                        suppressErrors: true,
                        hideLoader: true, // Вже використовуємо власний лоадер
                        forceCleanup: true
                    }
                );

                hideLoading(`history-details-${raffleId}`);
                _lastRequestTime = Date.now();

                if (response && response.status === 'success') {
                    // Кешуємо результат
                    if (response.data) {
                        _raffleDetailsCache[raffleId] = response.data;
                    }

                    // Зберігаємо отримані дані локально
                    if (response.data && localRaffleData) {
                        // Оновлюємо локальні дані з сервера
                        const updatedHistoryData = _historyData.map(item => {
                            if (item && item.raffle_id === raffleId) {
                                return { ...item, ...response.data };
                            }
                            return item;
                        });
                        _historyData = updatedHistoryData;

                        // Оновлюємо також у кеші
                        if (_historyCache.data) {
                            _historyCache.data = updatedHistoryData;
                        }

                        // Зберігаємо в localStorage
                        this._saveHistoryToCache(_historyData);
                    }

                    // Емітуємо подію про отримання деталей розіграшу
                    WinixRaffles.events.emit('raffle-details-loaded', {
                        raffleId,
                        data: response.data
                    });

                    return response.data;
                } else {
                    throw new Error((response && response.message) || 'Помилка отримання деталей розіграшу');
                }
            } catch (apiError) {
                console.error(`❌ Помилка запиту API для розіграшу ${raffleId}:`, apiError);

                // Якщо є локальні дані - повертаємо їх
                if (localRaffleData) {
                    console.log("📋 Історія розіграшів: Повертаємо локальні дані після помилки API");

                    // Кешуємо результат
                    _raffleDetailsCache[raffleId] = localRaffleData;

                    return localRaffleData;
                }

                throw apiError;
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
            hideLoading(`history-details-${raffleId}`);

            // Показуємо помилку тільки якщо не знайдено ніяких даних
            if (!_historyData.find(item => item && item.raffle_id === raffleId)) {
                showToast('Не вдалося завантажити деталі розіграшу', 'error');
            }

            // Створюємо базові дані розіграшу якщо нічого не знайдено
            const fallbackData = {
                raffle_id: raffleId,
                title: "Дані недоступні",
                winners: [],
                status: "unknown",
                source: "fallback_after_error"
            };

            // Кешуємо результат
            _raffleDetailsCache[raffleId] = fallbackData;

            return fallbackData;
        }
    }
/**
     * Створення HTML для порожньої історії
     * @param {string} message - Повідомлення для відображення
     * @returns {string} HTML для порожньої історії
     * @private
     */
/**
 * Створення HTML для порожньої історії
 * @param {string} errorMessage - Опціональне повідомлення про помилку
 * @returns {string} HTML для відображення
 * @private
 */
_createEmptyHistoryHTML(errorMessage = 'У вас ще немає історії розіграшів') {
    return `
        <div class="empty-history">
            <div class="empty-history-icon">📋</div>
            <h3>Історія порожня</h3>
            <p>${errorMessage}</p>
            <button class="refresh-history-btn" onclick="WinixRaffles.history.displayHistory('history-container', true)">
                <span class="refresh-icon">🔄</span> Оновити
            </button>
        </div>
    `;
}

/**
 * Отримання загальної кількості призів з усіх виграшів
 * @param {Array} raffles - Масив розіграшів
 * @returns {string} Загальна сума з валютою
 * @private
 */
_getTotalPrizeAmount(raffles) {
    if (!Array.isArray(raffles) || raffles.length === 0) return '0 WINIX';

    let total = 0;
    let currency = 'WINIX';

    try {
        raffles.forEach(raffle => {
            if (raffle && raffle.prize) {
                // Видобуваємо числове значення призу
                const prizeMatch = raffle.prize.match(/(\d+(?:\.\d+)?)/);
                if (prizeMatch && prizeMatch[1]) {
                    total += parseFloat(prizeMatch[1]);
                }

                // Видобуваємо валюту
                const currencyMatch = raffle.prize.match(/[^\d\s.,]+/);
                if (currencyMatch && currencyMatch[0]) {
                    currency = currencyMatch[0];
                }
            }
        });
    } catch (error) {
        console.error("Помилка розрахунку загальної суми призів:", error);
        return '0 WINIX';
    }

    return `${total.toFixed(2)} ${currency}`;
}

/**
 * Отримання загальної кількості призів як число
 * @param {Array} raffles - Масив розіграшів
 * @returns {number} Загальна сума
 * @private
 */
_getTotalPrizeAmountNumber(raffles) {
    if (!Array.isArray(raffles) || raffles.length === 0) return 0;

    let total = 0;

    try {
        raffles.forEach(raffle => {
            if (raffle && raffle.prize) {
                // Видобуваємо числове значення призу
                const prizeMatch = raffle.prize.match(/(\d+(?:\.\d+)?)/);
                if (prizeMatch && prizeMatch[1]) {
                    total += parseFloat(prizeMatch[1]);
                }
            }
        });
    } catch (error) {
        console.error("Помилка розрахунку загальної суми призів:", error);
        return 0;
    }

    return total;
}

/**
 * Розрахунок загальної кількості витрачених жетонів
 * @param {Array} history - Історія розіграшів
 * @returns {number} Загальна кількість жетонів
 * @private
 */
_calculateTotalTokensSpent(history) {
    if (!Array.isArray(history) || history.length === 0) return 0;

    let total = 0;

    try {
        history.forEach(entry => {
            if (entry && entry.entry_count) {
                total += parseInt(entry.entry_count);
            }
        });
    } catch (error) {
        console.error("Помилка розрахунку витрачених жетонів:", error);
        return 0;
    }

    return total;
}
    /**
     * Відображення історії розіграшів
     * @param {string} containerId - ID контейнера для відображення
     * @param {boolean} forceRefresh - Примусове оновлення даних
     */
    async displayHistory(containerId = 'history-container', forceRefresh = false) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер з ID '${containerId}' не знайдено`);
            return;
        }

        // Додаємо сітку статистики
        this._addStatsGrid(container);

        // Перш ніж робити запит, відобразимо індикатор завантаження
        if (!_historyData.length || forceRefresh) {
            container.innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Завантаження історії...</div>
                    <div class="loading-subtext">Зачекайте, будь ласка</div>
                </div>
            `;
        }

        try {
            // Перевіряємо, чи пристрій онлайн
            if (!isOnline() && !forceRefresh) {
                // Якщо офлайн, показуємо кешовані дані, якщо є
                if (_historyData.length === 0) {
                    container.innerHTML = this._createEmptyHistoryHTML("Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову.");
                    return;
                }
            }

            // Отримуємо дані історії
            const history = await this.getRafflesHistory({}, forceRefresh);

            // Якщо дані відсутні або порожні
            if (!history || !Array.isArray(history) || history.length === 0) {
                container.innerHTML = this._createEmptyHistoryHTML();

                // Оновлюємо статистику з нулями
                this._updateStatistics(0, 0, 0, 0);
                return;
            }

            // Розділяємо історію на виграшні розіграші та звичайні участі
            let wonRaffles = [];
            let participatedRaffles = [];

            try {
                wonRaffles = history.filter(item => item && item.status === 'won');
                participatedRaffles = history.filter(item => item && item.status !== 'won');
            } catch (error) {
                console.error("Помилка при фільтрації історії:", error);
                container.innerHTML = this._createEmptyHistoryHTML('Помилка обробки даних. Спробуйте оновити сторінку.');
                return;
            }

            // Створюємо HTML для відображення
            let historyHTML = `
                <div class="history-filters">
                    <div class="filter-group">
                        <label>Тип:</label>
                        <select id="history-type-filter">
                            <option value="all" selected>Усі типи</option>
                            <option value="daily">Щоденні</option>
                            <option value="main">Джекпоти</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Статус:</label>
                        <select id="history-status-filter">
                            <option value="all" selected>Усі статуси</option>
                            <option value="won">Перемоги</option>
                            <option value="participated">Участь</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Період:</label>
                        <select id="history-period-filter">
                            <option value="all" selected>Весь час</option>
                            <option value="week">Тиждень</option>
                            <option value="month">Місяць</option>
                            <option value="year">Рік</option>
                        </select>
                    </div>
                    <button id="refresh-history-btn" class="refresh-btn">
                        <span class="refresh-icon">🔄</span>
                    </button>
                </div>

                <div class="history-stats">
                    <div class="stats-item">
                        <div class="stats-value">${history.length}</div>
                        <div class="stats-label">Всього розіграшів</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-value">${wonRaffles.length}</div>
                        <div class="stats-label">Перемог</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-value">${this._getTotalPrizeAmount(wonRaffles)}</div>
                        <div class="stats-label">WINIX виграно</div>
                    </div>
                </div>
            `;

            // Додаємо секцію "Мої перемоги" якщо є виграші
            if (wonRaffles.length > 0) {
                historyHTML += `
                    <div class="history-section">
                        <h3 class="section-title">Мої перемоги</h3>
                        <div class="history-cards">
                            ${wonRaffles.map(raffle => this._createHistoryCardHTML(raffle)).join('')}
                        </div>
                    </div>
                `;
            }

            // Додаємо секцію участі
            historyHTML += `
                <div class="history-section">
                    <h3 class="section-title">Історія участі</h3>
                    <div class="history-cards">
                        ${participatedRaffles.length > 0 
                            ? participatedRaffles.map(raffle => this._createHistoryCardHTML(raffle)).join('')
                            : '<div class="empty-history-section">У вас поки немає участі в розіграшах</div>'}
                    </div>
                </div>
            `;

            // Вставляємо HTML в контейнер
            container.innerHTML = historyHTML;

            // Додаємо обробники подій для фільтрів
            document.getElementById('history-type-filter')?.addEventListener('change', () => {
                this._applyHistoryFilters(containerId);
            });

            document.getElementById('history-status-filter')?.addEventListener('change', () => {
                this._applyHistoryFilters(containerId);
            });

            document.getElementById('history-period-filter')?.addEventListener('change', () => {
                this._applyHistoryFilters(containerId);
            });

            // Додаємо обробник для кнопки оновлення
            document.getElementById('refresh-history-btn')?.addEventListener('click', () => {
                // Перевіряємо, чи пристрій онлайн
                if (!isOnline()) {
                    showToast("Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову.", "error");
                    return;
                }
                this.displayHistory(containerId, true);
            });

            // Додаємо обробники подій для карток історії
            this._addHistoryCardEventListeners();

            // Оновлюємо статистику
            const totalSpent = this._calculateTotalTokensSpent(history);
            this._updateStatistics(history.length, wonRaffles.length, this._getTotalPrizeAmountNumber(wonRaffles), totalSpent);

            // Відправляємо подію про відображення історії
            WinixRaffles.events.emit('history-displayed', {
                total: history.length,
                wins: wonRaffles.length,
                participated: participatedRaffles.length
            });
        } catch (error) {
            console.error("Помилка відображення історії:", error);
            let errorMessage = !isOnline()
                ? "Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову."
                : "Щось пішло не так. Спробуйте оновити сторінку.";

            container.innerHTML = this._createEmptyHistoryHTML(errorMessage);
        }
    }

    /**
     * Експорт історії розіграшів у CSV
     */
    async exportHistoryToCSV() {
        try {
            // Перевіряємо, чи пристрій онлайн
            if (!isOnline()) {
                const offlineHistory = _historyData.length > 0 ? _historyData : (_historyCache.data || []);
                if (offlineHistory.length === 0) {
                    showToast("Немає даних для експорту. Підключіться до Інтернету, щоб оновити історію.", "error");
                    return;
                }
                // Якщо є кешовані дані, використовуємо їх
                return this._generateAndDownloadCSV(offlineHistory);
            }

            // Отримуємо актуальні дані
            const history = await this.getRafflesHistory();

            if (!history || !Array.isArray(history) || history.length === 0) {
                showToast('Немає даних для експорту', 'warning');
                return;
            }

            this._generateAndDownloadCSV(history);
        } catch (error) {
            console.error('Помилка експорту історії:', error);
            showToast('Не вдалося експортувати історію', 'error');
        }
    }

    /**
     * Додаткові методи класу...
     */

    // Додаткові приватні методи не включені в цей фрагмент коду для стислості.
    // Вони залишаються без змін.

    /**
     * Скидання стану запитів
     * @returns {boolean} Результат операції
     */
    resetRequestState() {
        _requestInProgress = false;
        _isLoading = false;

        // Очищаємо таймаути
        if (_requestTimeoutId) {
            clearTimeout(_requestTimeoutId);
            _requestTimeoutId = null;
        }

        // Приховуємо лоадер
        hideLoading('history-request');

        console.log("🔄 Історія розіграшів: Примусове скидання стану запитів");
        return true;
    }

    /**
     * Очищення кешу
     */
    clearCache() {
        _historyCache = {
            data: null,
            timestamp: 0,
            ttl: _historyCache.ttl
        };
        _historyData = [];
        _isLoading = false;
        _requestInProgress = false;
        _failedAttempts = 0;
        _raffleDetailsCache = {};

        // Очищаємо таймаути
        if (_requestTimeoutId) {
            clearTimeout(_requestTimeoutId);
            _requestTimeoutId = null;
        }

        console.log("🧹 Історія розіграшів: Кеш очищено");
    }

    /**
     * Очищення ресурсів і закриття модуля
     */
    destroy() {
        this.resetRequestState();
        this.clearCache();

        // Видаляємо обробники подій мережі
        window.removeEventListener('online', () => {});
        window.removeEventListener('offline', () => {});

        console.log("🚫 Історія розіграшів: Модуль історії розіграшів закрито");
    }

    // Інші методи класу HistoryModule...
}

// Створюємо екземпляр класу
const historyModule = new HistoryModule();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.history = historyModule;

// Автоматична ініціалізація при завантаженні
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => historyModule.init());
} else {
    setTimeout(() => historyModule.init(), 100);
}

export default historyModule;