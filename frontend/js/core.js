/**
 * WINIX - Система розіграшів (core.js)
 * Оптимізована версія з виправленими проблемами пам'яті і рекурсії
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Перевірка наявності необхідних модулів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що init.js підключено перед core.js');
        return;
    }

    // Ініціалізація контролера синхронізації
    if (!window.__winixSyncControl) {
        window.__winixSyncControl = {
            // Останній відомий баланс від сервера
            lastValidBalance: null,

            // Час останньої синхронізації
            lastSyncTime: 0,

            // Блокування запитів оновлення
            locks: {},

            // Чи очікуємо оновлення з сервера
            expectServerUpdate: false,

            /**
             * Блокування оновлень балансу
             * @param {number} duration - Тривалість блокування в секундах
             * @param {Object} options - Опції блокування
             * @returns {boolean} Результат блокування
             */
            block: function(duration, options = {}) {
                const type = options.type || 'general';
                const now = Date.now();

                this.locks[type] = {
                    until: now + (duration * 1000),
                    reason: options.reason || 'manual',
                    source: options.source || 'api'
                };

                console.log(`🔒 Синхронізатор: Блокування ${type} на ${duration}с. Причина: ${this.locks[type].reason}`);

                // Автоматичне зняття блокування
                setTimeout(() => {
                    if (this.locks[type]) {
                        console.log(`🔓 Синхронізатор: Розблокування ${type}`);
                        delete this.locks[type];
                    }
                }, duration * 1000);

                return true;
            },

            /**
             * Перевірка, чи заблокований тип оновлення
             * @param {string} type - Тип оновлення
             * @returns {boolean} Стан блокування
             */
            isBlocked: function(type) {
                const now = Date.now();

                // Перевірка глобального блокування
                if (this.locks['general'] && this.locks['general'].until > now) {
                    return true;
                }

                // Перевірка конкретного типу
                if (this.locks[type] && this.locks[type].until > now) {
                    return true;
                }

                return false;
            },

            /**
             * Встановлення серверного балансу
             * @param {number} balance - Новий баланс
             * @param {string} source - Джерело оновлення
             * @returns {boolean} Результат оновлення
             */
            setServerBalance: function(balance, source = 'api') {
                if (typeof balance !== 'number' || isNaN(balance) || balance < 0) {
                    return false;
                }

                this.lastValidBalance = balance;
                this.lastSyncTime = Date.now();
                this.expectServerUpdate = false;

                // Зберігаємо в localStorage для інших модулів
                localStorage.setItem('winix_server_balance', balance.toString());
                localStorage.setItem('winix_server_balance_ts', this.lastSyncTime.toString());

                console.log(`💰 Синхронізатор: Оновлено серверний баланс ${balance} (джерело: ${source})`);
                return true;
            }
        };

        console.log("✅ Core: Ініціалізовано контролер синхронізації балансу");
    }

    // Підмодуль для обробки помилок
    const errorHandler = {
        // Лічильник помилок
        errorCount: 0,

        // Максимальна кількість помилок до скидання
        maxErrorsBeforeReset: 5,

        // Час останньої помилки
        lastErrorTime: 0,

        // Обробка помилки
        handleError: function(error, source) {
            this.errorCount++;
            this.lastErrorTime = Date.now();

            console.error(`❌ Помилка в ${source || 'raffles/core.js'}:`, error);

            // Якщо досягнуто максимальної кількості помилок, скидаємо стан
            if (this.errorCount >= this.maxErrorsBeforeReset) {
                this.errorCount = 0;
                console.warn(`⚠️ Досягнуто критичної кількості помилок (${this.maxErrorsBeforeReset}), скидання стану...`);

                if (typeof window.resetAndReloadApplication === 'function') {
                    window.resetAndReloadApplication();
                } else if (typeof window.WinixRaffles.resetState === 'function') {
                    window.WinixRaffles.resetState();
                }
            }
        },

        // Скидання лічильника помилок
        resetErrorCount: function() {
            this.errorCount = 0;
        }
    };

    // Стан модуля
    const state = {
        // Множина ID невалідних розіграшів
        invalidRaffleIds: new Set(),

        // Час останнього завантаження
        lastLoadTime: 0,

        // Виконується запит
        isLoading: false,

        // Виконується оновлення таймерів
        updatingTimers: false,

        // Розіграші обробляються
        rafflesProcessed: false,

        // Таймери зворотного відліку
        countdownTimers: {},

        // Час останнього оновлення балансу
        lastBalanceUpdate: 0
    };

    // Конфігурація
    const config = {
        // Мінімальний інтервал між завантаженнями (мс)
        minLoadInterval: 5000,

        // Інтервал оновлення таймерів (мс)
        timerUpdateInterval: 1000,

        // Таймаут запитів (мс)
        requestTimeout: 15000
    };

    /**
     * Скидання стану модуля
     */
    window.WinixRaffles.resetState = function() {
        console.log('🔄 Скидання стану модуля розіграшів...');

        // Скидаємо стан
        state.isLoading = false;
        state.updatingTimers = false;

        // Очищуємо таймери
        for (const timerId in state.countdownTimers) {
            if (state.countdownTimers.hasOwnProperty(timerId)) {
                clearInterval(state.countdownTimers[timerId]);
            }
        }
        state.countdownTimers = {};

        // Скидаємо глобальні таймери
        if (window.WinixRaffles._globalRefreshInterval) {
            clearInterval(window.WinixRaffles._globalRefreshInterval);
            window.WinixRaffles._globalRefreshInterval = null;
        }

        if (window.WinixRaffles._globalCountdownTimer) {
            clearInterval(window.WinixRaffles._globalCountdownTimer);
            window.WinixRaffles._globalCountdownTimer = null;
        }

        // Приховуємо індикатор завантаження
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }

        // Скидаємо стан participation та ticketManager, якщо вони існують
        if (window.WinixRaffles.participation && typeof window.WinixRaffles.participation.resetState === 'function') {
            window.WinixRaffles.participation.resetState();
        }

        if (window.WinixRaffles.ticketManager && typeof window.WinixRaffles.ticketManager.reset === 'function') {
            window.WinixRaffles.ticketManager.reset();
        }

        console.log('✅ Стан модуля розіграшів скинуто');
    };

    /**
     * Завантаження активних розіграшів
     * @param {boolean} forceRefresh - Примусове оновлення
     * @param {number} limit - Ліміт кількості розіграшів
     * @param {number} offset - Зміщення для пагінації
     * @returns {Promise<Object>} Результат завантаження
     */
    window.WinixRaffles.loadActiveRaffles = async function(forceRefresh = false, limit = 50, offset = 0) {
        // Запобігаємо паралельним запитам
        if (state.isLoading && !forceRefresh) {
            console.log("⏳ Завантаження розіграшів вже виконується");

            // Повертаємо кеш при наявності даних
            if (this.state.activeRaffles.length > 0) {
                return {
                    success: true,
                    source: 'cache',
                    data: this.state.activeRaffles,
                    message: "Використано кешовані дані (запит вже виконується)"
                };
            }

            return { success: false, message: "Завантаження вже виконується" };
        }

        // Перевірка інтервалу між запитами
        const now = Date.now();
        if (!forceRefresh && (now - state.lastLoadTime < config.minLoadInterval) && this.state.activeRaffles.length > 0) {
            console.log("⏳ Занадто частий запит, використовуємо кеш");
            return {
                success: true,
                source: 'cache',
                data: this.state.activeRaffles,
                message: "Використано кешовані дані (обмеження частоти)"
            };
        }

        // Встановлюємо стан завантаження
        state.isLoading = true;

        // Показуємо індикатор завантаження, якщо потрібно
        if (!this.skipLoader && (this.state.activeRaffles.length === 0 || forceRefresh)) {
            try {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }
            } catch (e) {
                console.warn("⚠️ Помилка показу індикатора завантаження:", e);
            }
        }

        try {
            console.log("🔄 Розпочато завантаження активних розіграшів");

            // Формуємо URL запиту
            const apiEndpoint = `${this.config.activeRafflesEndpoint}?limit=${limit}&offset=${offset}&t=${now}`;

            // Відправляємо запит
            let response;
            if (typeof window.WinixAPI !== 'undefined' && typeof window.WinixAPI.apiRequest === 'function') {
                response = await window.WinixAPI.apiRequest(apiEndpoint, 'GET', null, {
                    timeout: config.requestTimeout,
                    suppressErrors: true,
                    retries: 2,
                    bypassThrottle: forceRefresh
                });
            } else {
                const fetchResponse = await fetch(apiEndpoint);
                response = await fetchResponse.json();
            }

            // Обробка відповіді
            if (response && response.status === 'success' && Array.isArray(response.data)) {
                // Зберігаємо дані розіграшів
                this.state.activeRaffles = response.data;

                // Оновлюємо час завантаження
                state.lastLoadTime = now;

                // Обробляємо дані розіграшів
                this._processRafflesData();

                // Відкладена перевірка участі
                this._scheduleParticipationCheck();

                // Оновлюємо відображення
                this.renderActiveRaffles();

                // Скидаємо лічильник помилок
                errorHandler.resetErrorCount();

                console.log(`✅ Успішно завантажено ${this.state.activeRaffles.length} активних розіграшів`);

                // Відправляємо подію
                document.dispatchEvent(new CustomEvent('raffles-loaded', {
                    detail: { count: this.state.activeRaffles.length }
                }));

                return {
                    success: true,
                    data: this.state.activeRaffles,
                    message: `Завантажено ${this.state.activeRaffles.length} розіграшів`
                };
            } else {
                throw new Error(response?.message || 'Не вдалося завантажити активні розіграші');
            }
        } catch (error) {
            // Обробка помилки
            errorHandler.handleError(error, 'loadActiveRaffles');

            // Повертаємо кеш при наявності даних
            if (this.state.activeRaffles.length > 0) {
                console.log("⚠️ Використовуємо кешовані дані розіграшів через помилку");
                return {
                    success: true,
                    source: 'cache_error',
                    data: this.state.activeRaffles,
                    message: "Використано кешовані дані (сталася помилка)"
                };
            }

            // Відображаємо повідомлення про помилку
            this.renderError('Не вдалося завантажити розіграші', 'Спробуйте оновити сторінку');

            return {
                success: false,
                message: error.message || 'Помилка завантаження розіграшів'
            };
        } finally {
            // Завершуємо процес завантаження
            state.isLoading = false;

            // Приховуємо індикатор завантаження
            try {
                if (!this.skipLoader && typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            } catch (e) {
                console.warn("⚠️ Помилка приховування індикатора завантаження:", e);
            }

            // Скидаємо флаг пропуску індикатора
            this.skipLoader = false;
        }
    };

    /**
     * Обробка даних розіграшів
     * @private
     */
    window.WinixRaffles._processRafflesData = function() {
        try {
            // Пропускаємо, якщо обробка вже виконується
            if (state.rafflesProcessed) {
                return;
            }

            const now = Date.now();

            // Перевіряємо розіграші на завершення
            this.state.activeRaffles.forEach(raffle => {
                const endTime = new Date(raffle.end_time).getTime();

                // Якщо розіграш завершився, додаємо в невалідні
                if (endTime <= now) {
                    state.invalidRaffleIds.add(raffle.id);

                    if (this.participation && this.participation.invalidRaffleIds) {
                        this.participation.invalidRaffleIds.add(raffle.id);
                    }
                }
            });

            state.rafflesProcessed = true;
        } catch (e) {
            console.warn("⚠️ Помилка обробки даних розіграшів:", e);
        }
    };

    /**
     * Планування перевірки участі
     * @private
     */
    window.WinixRaffles._scheduleParticipationCheck = function() {
        // Відкладена перевірка участі користувача
        setTimeout(() => {
            this.loadUserParticipation().catch(err => {
                console.warn("⚠️ Не вдалося завантажити дані участі:", err);
            });
        }, 1000);
    };

    /**
     * Завантаження даних про участь користувача
     * @returns {Promise<Object>} Результат завантаження
     */
    window.WinixRaffles.loadUserParticipation = async function() {
        try {
            // Отримання ID користувача
            if (!this.state.telegramId) {
                this.state.telegramId = this._getUserId();

                if (!this.state.telegramId) {
                    console.warn("⚠️ ID користувача відсутній, не можемо завантажити участь");
                    return { success: false, message: "ID користувача відсутній" };
                }
            }

            console.log("🔄 Розпочато завантаження участі користувача");

            // Формуємо URL запиту
            const apiEndpoint = this.config.userRafflesEndpoint.replace('{userId}', this.state.telegramId);

            // Додаємо параметр запобігання кешування
            const nocache = Date.now();
            const url = `${apiEndpoint}?nocache=${nocache}`;

            // Відправляємо запит
            let response;
            if (typeof window.WinixAPI !== 'undefined' && typeof window.WinixAPI.apiRequest === 'function') {
                response = await window.WinixAPI.apiRequest(url, 'GET', null, {
                    timeout: 10000,
                    suppressErrors: true,
                    bypassThrottle: true,
                    hideLoader: true,
                    allowParallel: true
                });
            } else {
                const fetchResponse = await fetch(url);
                response = await fetchResponse.json();
            }

            // Обробка відповіді
            if (response && response.status === 'success' && Array.isArray(response.data)) {
                // Ініціалізація модуля участі, якщо потрібно
                this._initParticipationModule();

                // Очищаємо попередні дані участі
                this.participation.participatingRaffles.clear();
                this.participation.userRaffleTickets = {};

                // Заповнюємо дані участі
                response.data.forEach(raffle => {
                    const raffleId = raffle.raffle_id || raffle.id;

                    if (raffleId && typeof raffleId === 'string' && raffleId.length > 10) {
                        this.participation.participatingRaffles.add(raffleId);
                        this.participation.userRaffleTickets[raffleId] = raffle.entry_count || 1;
                    }
                });

                console.log(`✅ Завантажено участь у ${response.data.length} розіграшах`);

                // Оновлюємо кнопки участі
                this.updateParticipationButtons();

                return {
                    success: true,
                    data: response.data
                };
            } else {
                console.warn("⚠️ Не вдалося завантажити дані участі:", response?.message);
                return {
                    success: false,
                    message: response?.message || "Помилка завантаження даних участі"
                };
            }
        } catch (error) {
            console.error('❌ Помилка завантаження участі користувача:', error);
            return {
                success: false,
                message: error.message || 'Помилка завантаження участі користувача'
            };
        }
    };

    /**
     * Ініціалізація модуля участі
     * @private
     */
    window.WinixRaffles._initParticipationModule = function() {
        if (!this.participation) {
            this.participation = {
                participatingRaffles: new Set(),
                userRaffleTickets: {},
                invalidRaffleIds: new Set(),
                lastParticipationTime: 0,
                requestInProgress: false
            };
        } else if (!this.participation.participatingRaffles) {
            this.participation.participatingRaffles = new Set();
            this.participation.userRaffleTickets = {};
            this.participation.lastParticipationTime = 0;
            this.participation.requestInProgress = false;
        }
    };

    /**
     * Отримання ID користувача
     * @returns {string|null} ID користувача
     * @private
     */
    window.WinixRaffles._getUserId = function() {
        // З WinixCore
        if (window.WinixCore && typeof window.WinixCore.getUserId === 'function') {
            const coreId = window.WinixCore.getUserId();
            if (coreId) return coreId;
        }

        // З WinixAPI
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            const apiId = window.WinixAPI.getUserId();
            if (apiId) return apiId;
        }

        // З localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (storedId && storedId !== 'undefined' && storedId !== 'null') {
            return storedId;
        }

        // З DOM
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userIdElement.textContent) {
            const id = userIdElement.textContent.trim();
            if (id && id !== 'undefined' && id !== 'null') {
                return id;
            }
        }

        return null;
    };

    /**
     * Оновлення статусу кнопок участі
     */
    window.WinixRaffles.updateParticipationButtons = function() {
        // Делегуємо модулю participation, якщо він доступний
        if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
            this.participation.updateParticipationButtons();
            return;
        }

        try {
            // Ініціалізація модуля участі, якщо потрібно
            this._initParticipationModule();

            // Отримуємо всі кнопки участі
            const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
            if (!buttons.length) return;

            // Створюємо кеш для оптимізації
            const participatingCache = {};
            const invalidCache = {};

            // Заповнюємо кеш
            this.participation.participatingRaffles.forEach(id => {
                participatingCache[id] = true;
            });

            state.invalidRaffleIds.forEach(id => {
                invalidCache[id] = true;
            });

            if (this.participation.invalidRaffleIds) {
                this.participation.invalidRaffleIds.forEach(id => {
                    invalidCache[id] = true;
                });
            }

            // Оновлюємо кнопки
            buttons.forEach(button => {
                const raffleId = button.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Для розіграшів, у яких користувач бере участь
                if (participatingCache[raffleId]) {
                    const ticketCount = this.participation.userRaffleTickets[raffleId] || 1;

                    // Оновлюємо текст кнопки
                    if (!button.classList.contains('participating')) {
                        const isMini = button.classList.contains('mini-raffle-button');
                        button.textContent = isMini ?
                            `Додати ще білет (${ticketCount})` :
                            `Додати ще білет (у вас: ${ticketCount})`;

                        button.classList.add('participating');
                        button.disabled = false;

                        // Видаляємо статус обробки
                        button.removeAttribute('data-processing');
                        button.classList.remove('processing');
                    }
                }

                // Для невалідних розіграшів
                if (invalidCache[raffleId] && !button.classList.contains('disabled')) {
                    button.textContent = 'Розіграш завершено';
                    button.classList.add('disabled');
                    button.disabled = true;
                }
            });
        } catch (error) {
            console.error("❌ Помилка при оновленні кнопок участі:", error);
        }
    };

    /**
     * Відмалювання активних розіграшів
     */
    window.WinixRaffles.renderActiveRaffles = function() {
        try {
            // Отримуємо контейнер для активних розіграшів
            const container = document.getElementById('active-raffles');
            if (!container) {
                console.warn("⚠️ Контейнер активних розіграшів не знайдено");
                return false;
            }

            // Перевіряємо наявність даних
            if (!this.state.activeRaffles || this.state.activeRaffles.length === 0) {
                container.innerHTML = `
                    <div class="no-raffles">
                        <p>На даний момент активних розіграшів немає.</p>
                        <p>Спробуйте пізніше або перевірте вкладку "Історія".</p>
                    </div>
                `;
                return false;
            }

            // Структуруємо дані для відображення
            let mainRaffle = null;
            const dailyRaffles = [];

            // Розділяємо на основний та щоденні розіграші
            this.state.activeRaffles.forEach(raffle => {
                if (raffle.is_daily) {
                    dailyRaffles.push(raffle);
                } else if (!mainRaffle) {
                    mainRaffle = raffle;
                }
            });

            // Формуємо HTML для основного розіграшу
            let mainRaffleHtml = '';
            if (mainRaffle) {
                mainRaffleHtml = this._renderMainRaffle(mainRaffle);
            }

            // Формуємо HTML для щоденних розіграшів
            let dailyRafflesHtml = '';
            if (dailyRaffles.length > 0) {
                dailyRafflesHtml = this._renderDailyRaffles(dailyRaffles);
            }

            // Оновлюємо контейнер
            container.innerHTML = `
                <div class="main-raffle-container">
                    ${mainRaffleHtml}
                </div>
                
                <h2 class="mini-raffles-title">Щоденні розіграші</h2>
                
                <div class="mini-raffles-container">
                    ${dailyRafflesHtml}
                </div>
            `;

            // Ініціалізуємо таймери
            this.initializeCountdownTimers();

            // Оновлюємо кнопки участі
            setTimeout(() => {
                this.updateParticipationButtons();
            }, 100);

            return true;
        } catch (error) {
            console.error("❌ Помилка відмалювання активних розіграшів:", error);

            // Виводимо повідомлення про помилку
            this.renderError('Помилка відображення розіграшів', 'Будь ласка, оновіть сторінку');

            return false;
        }
    };

    /**
     * Відмалювання основного розіграшу
     * @param {Object} raffle - Дані розіграшу
     * @returns {string} HTML-код
     * @private
     */
    window.WinixRaffles._renderMainRaffle = function(raffle) {
        if (!raffle) return '';

        // Форматування дати і часу
        const endTime = new Date(raffle.end_time);
        const dateFormatted = endTime.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Форматування назви та опису
        const title = raffle.title || 'Розіграш';
        const description = raffle.description || 'Опис відсутній';

        // Вартість участі та призи
        const entryFee = raffle.entry_fee || 1;
        const prizeAmount = raffle.prize_amount || 0;
        const prizeCurrency = raffle.prize_currency || 'WINIX';
        const winnersCount = raffle.winners_count || 1;

        // Формування зображення призу
        const imageUrl = raffle.image_url || 'assets/prize-default.png';

        // Формування ID елементів таймера
        const timerPrefix = raffle.id;

        return `
        <div class="main-raffle" data-raffle-id="${raffle.id}" data-is-daily="false">
            <div class="raffle-header">
                <h3 class="raffle-title">${title}</h3>
                <div class="raffle-badge main">Головний</div>
            </div>
            
            <div class="raffle-content">
                <div class="raffle-info">
                    <div class="raffle-description">${description}</div>
                    
                    <div class="raffle-details">
                        <div class="raffle-prize">
                            <span class="label">Приз:</span>
                            <span class="value">${prizeAmount} ${prizeCurrency}</span>
                        </div>
                        <div class="raffle-winners">
                            <span class="label">Переможців:</span>
                            <span class="value">${winnersCount}</span>
                        </div>
                        <div class="raffle-entry-fee">
                            <span class="label">Вартість участі:</span>
                            <span class="value">${entryFee} жетон${entryFee > 1 ? 'и' : ''}</span>
                        </div>
                    </div>
                    
                    <div class="raffle-countdown">
                        <div class="countdown-label">До завершення:</div>
                        <div class="countdown-timer">
                            <div class="countdown-block">
                                <div class="countdown-value" id="days-${timerPrefix}">00</div>
                                <div class="countdown-label">Дні</div>
                            </div>
                            <div class="countdown-block">
                                <div class="countdown-value" id="hours-${timerPrefix}">00</div>
                                <div class="countdown-label">Год</div>
                            </div>
                            <div class="countdown-block">
                                <div class="countdown-value" id="minutes-${timerPrefix}">00</div>
                                <div class="countdown-label">Хв</div>
                            </div>
                            <div class="countdown-block">
                                <div class="countdown-value" id="seconds-${timerPrefix}">00</div>
                                <div class="countdown-label">Сек</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="raffle-image">
                    <img src="${imageUrl}" alt="${title}" onerror="this.src='assets/prize-default.png'">
                </div>
            </div>
            
            <div class="raffle-footer">
                <button class="join-button" data-raffle-id="${raffle.id}" data-entry-fee="${entryFee}">
                    Взяти участь за ${entryFee} жетон${entryFee > 1 ? 'и' : ''}
                </button>
                <div class="participants-count">
                    <span class="icon">👥</span>
                    <span class="count">${raffle.participants_count || 0}</span>
                </div>
            </div>
        </div>`;
    };

    /**
     * Відмалювання щоденних розіграшів
     * @param {Array} raffles - Дані розіграшів
     * @returns {string} HTML-код
     * @private
     */
    window.WinixRaffles._renderDailyRaffles = function(raffles) {
        if (!raffles || raffles.length === 0) {
            return `<div class="no-mini-raffles">Наразі немає щоденних розіграшів</div>`;
        }

        let html = '';

        // Формуємо HTML для кожного розіграшу
        raffles.forEach(raffle => {
            const title = raffle.title || 'Щоденний розіграш';
            const prizeAmount = raffle.prize_amount || 0;
            const prizeCurrency = raffle.prize_currency || 'WINIX';
            const entryFee = raffle.entry_fee || 1;
            const timerPrefix = raffle.id;

            html += `
            <div class="mini-raffle" data-raffle-id="${raffle.id}">
                <div class="mini-raffle-header">
                    <h3 class="mini-raffle-title">${title}</h3>
                    <div class="mini-raffle-badge">Щоденний</div>
                </div>
                
                <div class="mini-raffle-content">
                    <div class="mini-raffle-prize">${prizeAmount} ${prizeCurrency}</div>
                    
                    <div class="mini-raffle-countdown">
                        <div class="mini-countdown-timer">
                            <div class="mini-countdown-block">
                                <div class="mini-countdown-value" id="hours-${timerPrefix}">00</div>
                                <div class="mini-countdown-label">год</div>
                            </div>
                            <div class="mini-countdown-block">
                                <div class="mini-countdown-value" id="minutes-${timerPrefix}">00</div>
                                <div class="mini-countdown-label">хв</div>
                            </div>
                            <div class="mini-countdown-block">
                                <div class="mini-countdown-value" id="seconds-${timerPrefix}">00</div>
                                <div class="mini-countdown-label">сек</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mini-raffle-footer">
                    <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-entry-fee="${entryFee}">
                        Взяти участь
                    </button>
                    <div class="mini-participants-count">
                        <span class="mini-icon">👥</span>
                        <span class="mini-count">${raffle.participants_count || 0}</span>
                    </div>
                </div>
            </div>`;
        });

        return html;
    };

    /**
     * Ініціалізація таймерів зворотного відліку
     */
    window.WinixRaffles.initializeCountdownTimers = function() {
        try {
            // Запобігаємо одночасному оновленню таймерів
            if (state.updatingTimers) {
                return;
            }

            state.updatingTimers = true;

            // Зупиняємо існуючі таймери
            this._clearCountdownTimers();

            // Обробляємо кожен розіграш
            this.state.activeRaffles.forEach(raffle => {
                if (!raffle.end_time) return;

                const raffleId = raffle.id;
                const endTime = new Date(raffle.end_time).getTime();

                // Початкове встановлення значень
                this._updateCountdownValues(raffleId, endTime);

                // Створюємо таймер для розіграшу
                state.countdownTimers[raffleId] = setInterval(() => {
                    this._updateCountdownValues(raffleId, endTime);
                }, config.timerUpdateInterval);
            });

            state.updatingTimers = false;
        } catch (error) {
            console.error("❌ Помилка ініціалізації таймерів:", error);
            state.updatingTimers = false;
        }
    };

    /**
     * Очищення таймерів зворотного відліку
     * @private
     */
    window.WinixRaffles._clearCountdownTimers = function() {
        for (const timerId in state.countdownTimers) {
            if (state.countdownTimers.hasOwnProperty(timerId)) {
                clearInterval(state.countdownTimers[timerId]);
            }
        }
        state.countdownTimers = {};
    };

    /**
     * Оновлення значень таймера
     * @param {string} raffleId - ID розіграшу
     * @param {number} endTime - Час завершення в мілісекундах
     * @private
     */
    window.WinixRaffles._updateCountdownValues = function(raffleId, endTime) {
        const now = Date.now();
        const timeLeft = endTime - now;

        // Перевіряємо, чи розіграш закінчився
        if (timeLeft <= 0) {
            // Зупиняємо таймер
            if (state.countdownTimers[raffleId]) {
                clearInterval(state.countdownTimers[raffleId]);
                delete state.countdownTimers[raffleId];
            }

            // Додаємо до невалідних
            state.invalidRaffleIds.add(raffleId);

            if (this.participation && this.participation.invalidRaffleIds) {
                this.participation.invalidRaffleIds.add(raffleId);
            }

            // Встановлюємо нулі
            this._safeUpdateCountdownElement(`days-${raffleId}`, '00');
            this._safeUpdateCountdownElement(`hours-${raffleId}`, '00');
            this._safeUpdateCountdownElement(`minutes-${raffleId}`, '00');
            this._safeUpdateCountdownElement(`seconds-${raffleId}`, '00');

            // Оновлюємо кнопки участі
            this.updateParticipationButtons();
            return;
        }

        // Обчислюємо значення
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Оновлюємо елементи
        this._safeUpdateCountdownElement(`days-${raffleId}`, days.toString().padStart(2, '0'));
        this._safeUpdateCountdownElement(`hours-${raffleId}`, hours.toString().padStart(2, '0'));
        this._safeUpdateCountdownElement(`minutes-${raffleId}`, minutes.toString().padStart(2, '0'));
        this._safeUpdateCountdownElement(`seconds-${raffleId}`, seconds.toString().padStart(2, '0'));
    };

    /**
     * Безпечне оновлення елементу таймера
     * @param {string} elementId - ID елемента
     * @param {string} value - Нове значення
     * @private
     */
    window.WinixRaffles._safeUpdateCountdownElement = function(elementId, value) {
        try {
            const element = document.getElementById(elementId);
            if (element && element.textContent !== value) {
                element.textContent = value;
            }
        } catch (e) {
            // Ігноруємо помилки для стабільності
        }
    };

    /**
     * Відображення повідомлення про помилку
     * @param {string} title - Заголовок помилки
     * @param {string} message - Текст повідомлення
     */
    window.WinixRaffles.renderError = function(title, message) {
        try {
            // Отримуємо контейнер
            const container = document.getElementById('active-raffles');
            if (!container) return;

            // Додаємо HTML для помилки
            container.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">❌</div>
                    <h3 class="error-title">${title}</h3>
                    <p class="error-message">${message}</p>
                    <button class="retry-button" onclick="WinixRaffles.loadActiveRaffles(true)">
                        Спробувати знову
                    </button>
                </div>
            `;
        } catch (error) {
            console.error("❌ Помилка відображення повідомлення про помилку:", error);
        }
    };

    /**
     * Оновлення балансу користувача
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Object>} Результат оновлення
     */
    window.WinixRaffles.refreshUserBalance = async function(forceRefresh = false) {
        // Створюємо ідентифікатор транзакції
        const transactionId = 'balance_' + Date.now();

        try {
            // Перевіряємо контролер синхронізації
            if (window.__winixSyncControl &&
                window.__winixSyncControl.isBlocked &&
                window.__winixSyncControl.isBlocked('raffles_balance') &&
                !forceRefresh) {

                console.log("🔒 Оновлення балансу заблоковано контролером синхронізації");

                if (window.__winixSyncControl.lastValidBalance !== null) {
                    return {
                        success: true,
                        blocked: true,
                        source: 'sync_control',
                        data: {
                            coins: window.__winixSyncControl.lastValidBalance
                        }
                    };
                }
            }

            // Перевіряємо частоту запитів
            const now = Date.now();
            if (!forceRefresh && (now - state.lastBalanceUpdate < 5000)) {
                console.log("⏳ Занадто частий запит балансу");
                return {
                    success: true,
                    throttled: true,
                    message: "Занадто частий запит балансу"
                };
            }

            // Оновлюємо час останнього запиту
            state.lastBalanceUpdate = now;

            // Використовуємо WinixCore для оновлення балансу
            if (window.WinixCore && typeof window.WinixCore.refreshBalance === 'function') {
                console.log('🔄 Делегуємо оновлення балансу до WinixCore');
                return await window.WinixCore.refreshBalance(forceRefresh);
            }

            // Запасний варіант через API
            if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                console.log('🔄 Запит балансу через WinixAPI');

                // Отримуємо поточний баланс для порівняння
                const oldBalance = this._getCurrentCoins();

                // Запит через API
                const response = await window.WinixAPI.getBalance();

                if (response && response.status === 'success' && response.data) {
                    const newBalance = response.data.coins;

                    if (window.__winixSyncControl) {
                        window.__winixSyncControl.setServerBalance(newBalance, 'core_refresh');
                    }

                    // Оновлюємо DOM
                    this._updateBalanceDisplay(newBalance, oldBalance);

                    // Оновлюємо локальне сховище
                    localStorage.setItem('userCoins', newBalance.toString());
                    localStorage.setItem('winix_coins', newBalance.toString());
                    localStorage.setItem('winix_balance_update_time', now.toString());

                    // Генеруємо подію
                    document.dispatchEvent(new CustomEvent('balance-updated', {
                        detail: {
                            oldBalance: oldBalance,
                            newBalance: newBalance,
                            source: 'raffles.core',
                            transactionId: transactionId
                        }
                    }));

                    return {
                        success: true,
                        data: {
                            coins: newBalance
                        }
                    };
                } else {
                    throw new Error(response?.message || 'Не вдалося отримати баланс');
                }
            }

            // Якщо жоден метод не доступний
            return {
                success: false,
                message: 'API для оновлення балансу недоступне'
            };
        } catch (error) {
            console.error('❌ Помилка оновлення балансу:', error);

            return {
                success: false,
                message: error.message || 'Не вдалося оновити баланс'
            };
        }
    };

    /**
     * Отримання поточного балансу
     * @returns {number} Поточний баланс
     * @private
     */
    window.WinixRaffles._getCurrentCoins = function() {
        // З DOM
        const userCoinsElement = document.getElementById('user-coins');
        if (userCoinsElement) {
            return parseInt(userCoinsElement.textContent) || 0;
        }

        // З localStorage
        return parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
    };

    /**
     * Оновлення відображення балансу
     * @param {number} newBalance - Новий баланс
     * @param {number} oldBalance - Старий баланс
     * @private
     */
    window.WinixRaffles._updateBalanceDisplay = function(newBalance, oldBalance) {
        const userCoinsElement = document.getElementById('user-coins');
        if (!userCoinsElement) return;

        // Додаємо анімацію
        userCoinsElement.classList.remove('decreasing', 'increasing');

        if (newBalance < oldBalance) {
            userCoinsElement.classList.add('decreasing');
        } else if (newBalance > oldBalance) {
            userCoinsElement.classList.add('increasing');
        }

        // Оновлюємо значення
        userCoinsElement.textContent = newBalance;

        // Видаляємо класи анімації через 1 секунду
        setTimeout(() => {
            userCoinsElement.classList.remove('decreasing', 'increasing');
        }, 1000);
    };

    // Додавання методу getUserBalanceSource для діагностики
    window.WinixRaffles.getUserBalanceSource = function() {
        // Створюємо діагностичний об'єкт
        const diagnostic = {
            domValue: null,
            localStorage: null,
            serverStored: null,
            serverTimestamp: null,
            syncControl: null,
            winixCore: null,
            participation: null,
            participationTime: null,
            conflicts: [],
            selectedSource: 'unknown',
            selectedValue: 0
        };

        try {
            // 1. Отримуємо дані з DOM
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                diagnostic.domValue = parseInt(userCoinsElement.textContent) || 0;
            }

            // 2. Отримуємо дані з localStorage
            diagnostic.localStorage = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0');

            // 3. Отримуємо серверні дані
            diagnostic.serverStored = parseInt(localStorage.getItem('winix_server_balance') || '0');
            diagnostic.serverTimestamp = parseInt(localStorage.getItem('winix_server_balance_ts') || '0');

            // 4. Отримуємо дані з контролера синхронізації
            if (window.__winixSyncControl && window.__winixSyncControl.lastValidBalance !== null) {
                diagnostic.syncControl = window.__winixSyncControl.lastValidBalance;
            }

            // 5. Отримуємо дані з WinixCore
            if (window.WinixCore && typeof window.WinixCore.getCoins === 'function') {
                diagnostic.winixCore = window.WinixCore.getCoins();
            }

            // 6. Отримуємо дані з participation
            if (window.WinixRaffles && window.WinixRaffles.participation) {
                diagnostic.participation = window.WinixRaffles.participation.lastKnownBalance;
                diagnostic.participationTime = window.WinixRaffles.participation.lastBalanceUpdateTime;
            }

            // Виявлення конфліктів
            const values = [
                diagnostic.domValue,
                diagnostic.localStorage,
                diagnostic.serverStored,
                diagnostic.syncControl,
                diagnostic.winixCore,
                diagnostic.participation
            ].filter(val => val !== null && val !== undefined);

            // Перевіряємо наявність різних значень
            const uniqueValues = [...new Set(values)];
            if (uniqueValues.length > 1) {
                diagnostic.conflicts = uniqueValues;
            }

            // Визначаємо вибране джерело
            // Пріоритет: serverStored (свіжий) -> syncControl -> winixCore -> localStorage
            const now = Date.now();

            if (diagnostic.serverStored && diagnostic.serverTimestamp &&
                now - diagnostic.serverTimestamp < 120000) {
                diagnostic.selectedSource = 'server';
                diagnostic.selectedValue = diagnostic.serverStored;
            } else if (diagnostic.syncControl !== null) {
                diagnostic.selectedSource = 'syncControl';
                diagnostic.selectedValue = diagnostic.syncControl;
            } else if (diagnostic.winixCore !== null) {
                diagnostic.selectedSource = 'winixCore';
                diagnostic.selectedValue = diagnostic.winixCore;
            } else if (diagnostic.localStorage !== null) {
                diagnostic.selectedSource = 'localStorage';
                diagnostic.selectedValue = diagnostic.localStorage;
            } else if (diagnostic.domValue !== null) {
                diagnostic.selectedSource = 'dom';
                diagnostic.selectedValue = diagnostic.domValue;
            }

            return diagnostic;
        } catch (e) {
            console.error('❌ Помилка діагностики джерел балансу:', e);
            return {
                error: e.message,
                domValue: document.getElementById('user-coins')?.textContent || 'N/A'
            };
        }
    };

    // Додаємо глобальні обробники подій
    window.addEventListener('error', function(event) {
        console.error('Глобальна помилка JavaScript:', event.error);

        // Скидаємо стан при помилці
        if (window.WinixRaffles) {
            if (window.WinixRaffles.state && window.WinixRaffles.state.isLoading) {
                window.WinixRaffles.state.isLoading = false;
                state.isLoading = false;
            }

            // Скидаємо стан participation
            if (window.WinixRaffles.participation) {
                window.WinixRaffles.participation.requestInProgress = false;
            }

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    });

    // Обробник необроблених Promise помилок
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Необроблена Promise помилка:', event.reason);

        // Скидаємо стан спінера
        if (typeof window.resetLoadingState === 'function') {
            window.resetLoadingState();
        }

        // Скидаємо стан participation
        if (window.WinixRaffles && window.WinixRaffles.participation) {
            window.WinixRaffles.participation.requestInProgress = false;
        }

        // Скидаємо стан оновлення таймерів
        state.updatingTimers = false;
    });

    // Ініціалізуємо систему при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        console.log('✅ Модуль raffles/core.js успішно завантажено, версія 2.0.0');
    });
})();