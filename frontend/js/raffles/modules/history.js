/**
 * Модуль для роботи з історією розіграшів WINIX
 */

import WinixRaffles from '../globals.js';
import { showLoading, hideLoading, showToast, copyToClipboard } from '../utils/ui-helpers.js';
import api from '../services/api.js';
import { formatDate } from '../utils/formatters.js';

// Приватні змінні
let _historyData = [];
let _isLoading = false;
let _failedAttempts = 0;
let _lastRequestTime = 0;
let _requestInProgress = false;
let _requestTimeoutId = null;
let _historyCache = {
    data: null,
    timestamp: 0,
    ttl: 300000 // 5 хвилин
};
let _raffleDetailsCache = {};

const RETRY_DELAYS = [2000, 5000, 10000, 15000];
const MIN_REQUEST_INTERVAL = 15000;

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

        console.log("✅ Історія розіграшів: Ініціалізацію завершено");
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

            // Перевіряємо кеш, якщо не вимагається примусове оновлення
            if (!forceRefresh && _historyCache.data && now - _historyCache.timestamp < _historyCache.ttl) {
                console.log("📋 Raffle History: Використовуємо кешовані дані");
                return Promise.resolve(_historyCache.data);
            }

            // Автоматичне очищення прапорця, якщо запит тривав занадто довго
            if (_requestInProgress && now - _lastRequestTime > 30000) {
                console.warn("⚠️ Raffle History: Виявлено зависаючий запит, очищаємо стан");
                _requestInProgress = false;
                if (_requestTimeoutId) {
                    clearTimeout(_requestTimeoutId);
                    _requestTimeoutId = null;
                }
            }

            // Перевіряємо, чи запит вже в процесі
            if (_requestInProgress) {
                console.log("⏳ Raffle History: Запит уже виконується, використовуємо кеш");
                // Якщо кеш є - повертаємо його
                if (_historyCache.data) {
                    return Promise.resolve(_historyCache.data);
                }
                // Повертаємо поточні дані
                return Promise.resolve(_historyData);
            }

            // Перевіряємо інтервал між запитами
            const timeSinceLastRequest = now - _lastRequestTime;
            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && _historyData.length > 0) {
                console.log(`⏳ Raffle History: Занадто частий запит, минуло ${Math.floor(timeSinceLastRequest/1000)}с`);
                return Promise.resolve(_historyData);
            }

            _isLoading = true;
            _requestInProgress = true;
            _lastRequestTime = now;

            // Встановлюємо таймаут для автоматичного скидання прапорця
            if (_requestTimeoutId) {
                clearTimeout(_requestTimeoutId);
            }
            _requestTimeoutId = setTimeout(() => {
                if (_requestInProgress) {
                    console.warn("⚠️ Raffle History: Запит виконується занадто довго, скидаємо прапорець");
                    _requestInProgress = false;
                    _isLoading = false;
                }
            }, 30000); // 30 секунд максимальний час виконання запиту

            // Використовуємо централізований лоадер
            showLoading('Завантаження історії розіграшів...', 'history-request');

            // Отримуємо дані з API
            const userId = api.getUserId();
            if (!userId) {
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
            const url = queryParams
                ? `/api/user/${userId}/raffles-history?${queryParams.substring(1)}`
                : `/api/user/${userId}/raffles-history`;

            // Покращені параметри запиту з реалізацією повторних спроб
            const response = await api.apiRequest(url, 'GET', null, {
                timeout: 15000,
                allowParallel: false,
                suppressErrors: true,
                hideLoader: true, // Вже використовуємо власний лоадер
                forceCleanup: _failedAttempts > 0
            });

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
                console.log(`✅ Raffle History: Отримано ${_historyData.length} записів історії`);

                // Оновлюємо кеш
                _historyCache = {
                    data: _historyData,
                    timestamp: now,
                    ttl: _historyCache.ttl
                };

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
                    console.warn(`Raffle History: Отримано фолбек-відповідь: ${response.source}`);

                    if (Array.isArray(response.data)) {
                        _historyData = response.data;
                        // Оновлюємо кеш
                        _historyCache = {
                            data: _historyData,
                            timestamp: now,
                            ttl: 60000 // Коротший TTL для фолбеку
                        };
                        return _historyData;
                    }
                }

                throw new Error((response && response.message) || 'Помилка отримання історії розіграшів');
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

            // Для серверної помилки 500 або 404, спробуємо повернути порожній масив
            if (error.status === 500 || error.status === 404 ||
                error.source === 'parallel' || error.message.includes('already') ||
                error.message.includes('таймаут')) {
                console.warn("⚠️ Raffle History: Отримана помилка. Повертаємо порожній масив");

                // Не показуємо повідомлення про помилку при першій спробі
                if (_failedAttempts > 1) {
                    showToast('Не вдалося завантажити історію розіграшів. Спробуйте пізніше.', 'error');
                }

                // Використовуємо існуючі дані, якщо є
                if (_historyData.length > 0) {
                    return _historyData;
                }

                // Перевіряємо кеш
                if (_historyCache.data) {
                    console.log("📋 Raffle History: Використовуємо кешовані дані після помилки");
                    return _historyCache.data;
                }

                // Повертаємо порожній масив як останній варіант
                _historyData = [];
                return _historyData;
            }

            // Для інших помилок спробуємо повторити запит з затримкою
            if (_failedAttempts <= RETRY_DELAYS.length) {
                const retryDelay = RETRY_DELAYS[_failedAttempts - 1];
                console.log(`🔄 Raffle History: Спроба повторного запиту через ${retryDelay/1000}с`);

                // Повертаємо проміс з таймаутом і повторним запитом
                return new Promise(resolve => {
                    setTimeout(() => {
                        this.getRafflesHistory(filters).then(resolve).catch(err => {
                            // У випадку помилки при повторній спробі повертаємо порожній масив
                            console.error("Помилка повторного запиту:", err);
                            resolve([]);
                        });
                    }, retryDelay);
                });
            }

            // Якщо всі спроби невдалі, показуємо помилку і повертаємо порожній масив
            showToast('Не вдалося завантажити історію розіграшів', 'error');
            // Гарантуємо, що повертаємо масив при помилці
            _historyData = [];
            return _historyData;
        }
    }

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

            // Перевіряємо кеш деталей
            if (_raffleDetailsCache[raffleId]) {
                console.log(`📋 Raffle History: Використання кешованих деталей для розіграшу ${raffleId}`);
                return _raffleDetailsCache[raffleId];
            }

            // Перевіряємо спочатку локальні дані
            const localRaffleData = _historyData.find(item => item && item.raffle_id === raffleId);
            if (localRaffleData && localRaffleData.winners) {
                console.log("📋 Raffle History: Використання локальних даних для деталей розіграшу");

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

            // Використовуємо централізований лоадер
            showLoading('Завантаження деталей розіграшу...', `history-details-${raffleId}`);

            try {
                // Виправлений URL шлях
                const response = await api.apiRequest(
                    `/api/user/${userId}/raffles-history/${raffleId}`,
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
                    console.log("📋 Raffle History: Повертаємо локальні дані після помилки API");

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
                status: "unknown"
            };

            // Кешуємо результат
            _raffleDetailsCache[raffleId] = fallbackData;

            return fallbackData;
        }
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
                <div class="history-loader">
                    <div class="loader-spinner"></div>
                    <div class="loader-text">Завантаження історії...</div>
                </div>
            `;
        }

        try {
            // Отримуємо дані історії
            const history = await this.getRafflesHistory({}, forceRefresh);

            // Якщо дані відсутні або порожні
            if (!history || !Array.isArray(history) || history.length === 0) {
                container.innerHTML = this._createEmptyHistoryHTML();
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
                this.displayHistory(containerId, true);
            });

            // Додаємо обробники подій для карток історії
            this._addHistoryCardEventListeners();

            // Оновлюємо статистику
            WinixRaffles.events.emit('history-displayed', {
                total: history.length,
                wins: wonRaffles.length,
                participated: participatedRaffles.length
            });
        } catch (error) {
            console.error("Помилка відображення історії:", error);
            container.innerHTML = this._createEmptyHistoryHTML('Щось пішло не так. Спробуйте оновити сторінку.');
        }
    }

    /**
     * Експорт історії розіграшів у CSV
     */
    async exportHistoryToCSV() {
        try {
            // Отримуємо актуальні дані
            const history = await this.getRafflesHistory();

            if (!history || !Array.isArray(history) || history.length === 0) {
                showToast('Немає даних для експорту', 'warning');
                return;
            }

            // Генеруємо заголовки
            const headers = [
                'Дата',
                'Назва розіграшу',
                'Тип',
                'Приз',
                'Витрачено жетонів',
                'Результат',
                'Статус'
            ];

            // Генеруємо рядки даних
            const rows = history.map(item => {
                if (!item) return ['-', '-', '-', '-', '-', '-', '-'];

                return [
                    item.date || '-',
                    item.title || 'Розіграш',
                    item.is_daily ? 'Щоденний' : 'Джекпот',
                    item.prize || '0 WINIX',
                    item.entry_count || 0,
                    item.result || '-',
                    item.status === 'won' ? 'Перемога' : 'Участь'
                ];
            });

            // Об'єднуємо все в CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Спробуємо використати API для завантаження файлу
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showSaveFilePicker) {
                try {
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                    window.Telegram.WebApp.showSaveFilePicker('winix_raffle_history.csv', blob);
                    showToast('Історію розіграшів успішно експортовано', 'success');
                    return;
                } catch (e) {
                    console.warn('Помилка при використанні Telegram API для завантаження:', e);
                    // Продовжуємо зі стандартним способом
                }
            }

            // Стандартний спосіб завантаження
            const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'winix_raffle_history.csv');
            document.body.appendChild(link);

            // Клікаємо на посилання
            link.click();

            // Видаляємо посилання
            document.body.removeChild(link);

            showToast('Історію розіграшів успішно експортовано', 'success');
        } catch (error) {
            console.error('Помилка експорту історії:', error);
            showToast('Не вдалося експортувати історію', 'error');
        }
    }

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

        console.log("🔄 Raffle History: Примусове скидання стану запитів");
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

        console.log("🧹 Raffle History: Кеш очищено");
    }

    /**
     * Очищення ресурсів і закриття модуля
     */
    destroy() {
        this.resetRequestState();
        this.clearCache();

        console.log("🚫 Raffle History: Модуль історії розіграшів закрито");
    }

    /**
     * Встановлення TTL кешу
     * @param {number} ttl - Час життя кешу в мілісекундах
     */
    setCacheTTL(ttl) {
        if (typeof ttl === 'number' && ttl > 0) {
            _historyCache.ttl = ttl;
            console.log(`🔄 Raffle History: Встановлено TTL кешу: ${ttl}ms`);
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
     * Застосування фільтрів історії
     * @param {string} containerId - ID контейнера
     * @private
     */
    _applyHistoryFilters(containerId) {
        const typeFilter = document.getElementById('history-type-filter')?.value || 'all';
        const statusFilter = document.getElementById('history-status-filter')?.value || 'all';
        const periodFilter = document.getElementById('history-period-filter')?.value || 'all';

        // Оновлюємо відображення з новими фільтрами
        this.getRafflesHistory({
            type: typeFilter,
            status: statusFilter,
            period: periodFilter
        }).then(() => {
            this.displayHistory(containerId);
        }).catch(error => {
            console.error("Помилка при застосуванні фільтрів:", error);
            showToast('Помилка при застосуванні фільтрів', 'error');
        });
    }

    /**
     * Створення HTML для картки історії
     * @param {Object} item - Дані про розіграш
     * @returns {string} HTML-розмітка
     * @private
     */
    _createHistoryCardHTML(item) {
        if (!item) return '';

        const statusClass = item.status === 'won' ? 'won' : 'participated';
        const statusText = item.status === 'won' ? 'Виграно' : 'Участь';

        return `
            <div class="history-card" data-raffle-id="${item.raffle_id}">
                <div class="history-date">${item.date || 'Дата не вказана'}</div>
                <div class="history-title">${item.title || 'Розіграш'}</div>
                <div class="history-prize">${item.prize || '0 WINIX'}</div>
                <div class="history-details">
                    <div class="history-entry">Використано жетонів: ${item.entry_count || 0}</div>
                    <div class="history-status ${statusClass}">${statusText}</div>
                </div>
                <div class="history-result">${item.result || 'Результат невідомий'}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            </div>
        `;
    }

    /**
     * Створення HTML для пустої історії
     * @param {string} customMessage - Власне повідомлення
     * @returns {string} HTML-розмітка
     * @private
     */
    _createEmptyHistoryHTML(customMessage) {
        const message = customMessage || 'Ви ще не брали участі в розіграшах WINIX. Спробуйте свою удачу вже сьогодні!';

        return `
            <div class="empty-history">
                <div class="empty-history-icon">🎮</div>
                <h3>Історія розіграшів порожня</h3>
                <p>${message}</p>
                <button class="join-raffle-btn" onclick="window.rafflesModule.switchTab('active')">Перейти до розіграшів</button>
            </div>
        `;
    }

    /**
     * Додавання обробників подій для карток історії
     * @private
     */
    _addHistoryCardEventListeners() {
        try {
            const cards = document.querySelectorAll('.history-card');

            if (!cards || cards.length === 0) {
                console.log("Не знайдено картки для додавання обробників подій");
                return false;
            }

            let successCount = 0;

            cards.forEach(card => {
                try {
                    card.addEventListener('click', () => {
                        const raffleId = card.getAttribute('data-raffle-id');
                        if (!raffleId) return;

                        const historyItem = _historyData.find(item => item && item.raffle_id === raffleId);

                        if (historyItem) {
                            // Емітуємо подію показу деталей історії розіграшу
                            WinixRaffles.events.emit('show-history-details', {
                                raffleData: historyItem
                            });
                        } else {
                            // Якщо не знайдено в масиві, спробуємо отримати з API
                            this.getRaffleHistoryDetails(raffleId).then(details => {
                                if (details) {
                                    WinixRaffles.events.emit('show-history-details', {
                                        raffleData: details
                                    });
                                } else {
                                    showToast('Не вдалося отримати деталі розіграшу', 'error');
                                }
                            }).catch(error => {
                                console.error("Помилка отримання деталей розіграшу:", error);
                                showToast('Помилка отримання деталей розіграшу', 'error');
                            });
                        }
                    });
                    successCount++;
                } catch (cardError) {
                    console.error("Помилка додавання обробника для картки:", cardError);
                }
            });

            console.log(`Додано обробники для ${successCount} з ${cards.length} карток`);
            return successCount > 0;
        } catch (error) {
            console.error("Помилка додавання обробників подій для карток:", error);
            return false;
        }
    }

    /**
     * Отримання загальної суми виграшів
     * @param {Array} wonRaffles - Список виграних розіграшів
     * @returns {string} Відформатована сума
     * @private
     */
    _getTotalPrizeAmount(wonRaffles) {
        if (!wonRaffles || !Array.isArray(wonRaffles)) {
            return '0';
        }

        let total = 0;

        try {
            wonRaffles.forEach(raffle => {
                if (!raffle || !raffle.prize) return;

                // Покращений спосіб вилучення числової частини призу
                // Спочатку шукаємо у форматі "X WINIX"
                let match = raffle.prize.match(/(\d+(?:[.,]\d+)?)\s*(?:WINIX|winix)/i);

                // Якщо не знайдено, шукаємо будь-яке число
                if (!match) {
                    match = raffle.prize.match(/(\d+(?:[.,]\d+)?)/);
                }

                if (match) {
                    // Нормалізуємо число (замінюємо кому на крапку)
                    const numStr = match[1].replace(',', '.');
                    const value = parseFloat(numStr);

                    // Перевіряємо, що число валідне
                    if (!isNaN(value)) {
                        total += value;
                    }
                }
            });

            return total.toLocaleString('uk-UA');
        } catch (error) {
            console.error("Помилка розрахунку загальної суми виграшів:", error);
            return '0';
        }
    }
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