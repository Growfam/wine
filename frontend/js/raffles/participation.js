/**
 * WINIX - Система розіграшів (participation.js)
 * Модуль для обробки участі користувача в розіграшах
 * Оптимізована версія з виправленням проблем узгодженості даних та обробки помилок
 * @version 1.4.1
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше participation.js');
        return;
    }

    // Підмодуль для участі в розіграшах
    const participation = {
        // Множина ID розіграшів, у яких користувач уже бере участь (для відстеження)
        participatingRaffles: new Set(),

        // Кількість білетів користувача для кожного розіграшу
        userRaffleTickets: {},

        // Кеш недійсних розіграшів (для кращої роботи UI)
        invalidRaffleIds: new Set(),

        // Час останньої участі (для запобігання надмірній кількості запитів)
        lastParticipationTime: 0,

        // Стан запиту участі (для запобігання дублікатам)
        requestInProgress: false,

        // Черга запитів для запобігання втраті даних
        pendingRequests: [],

        // Максимальна кількість жетонів для участі
        MAX_ENTRY_COUNT: 100,

        // ВИПРАВЛЕННЯ: Додаємо змінну для відстеження часу останнього скидання стану
        lastStateReset: 0,

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // ВИПРАВЛЕННЯ: Примусове скидання стану при завантаженні
            this.requestInProgress = false;
            this.lastParticipationTime = 0;
            this.lastStateReset = Date.now();

            // Перевіряємо збережений стан участі в localStorage
            this._restoreParticipationFromStorage();

            // Створюємо додаткові ресурси для синхронізації станів
            this.setupSyncMechanisms();

            // Завантаження розіграшів користувача
            this.loadUserRaffles();

            // Додаємо обробники подій
            this.setupEventListeners();

            // Запускаємо таймер перевірки блокування
            this._startLockingMonitor();
        },

        // ВИПРАВЛЕННЯ: Додаємо моніторинг зависання запитів
        _startLockingMonitor: function() {
            setInterval(() => {
                const now = Date.now();
                // Якщо запит "завис" більше ніж на 15 секунд, автоматично скидаємо стан
                if (this.requestInProgress && (now - this.lastParticipationTime > 15000)) {
                    console.warn("⚠️ Виявлено застряглий запит, автоматичне скидання стану");
                    this.requestInProgress = false;
                    this.lastStateReset = now;
                }
            }, 5000); // Перевіряємо кожні 5 секунд
        },

        // Відновлення стану участі з localStorage
        _restoreParticipationFromStorage: function() {
            try {
                const savedState = localStorage.getItem('winix_participation_state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);

                    // ВИПРАВЛЕННЯ: Перевіряємо чи дані не застаріли та не визначаємо стан запиту
                    if (parsedState && parsedState.lastUpdate) {
                        const now = Date.now();
                        // Якщо кеш старіший за 10 хвилин, не використовуємо його
                        if (now - parsedState.lastUpdate < 600000) {
                            // Відновлюємо множину розіграшів
                            if (Array.isArray(parsedState.raffles)) {
                                this.participatingRaffles = new Set(parsedState.raffles);
                            }

                            // Відновлюємо кількість білетів
                            if (parsedState.tickets) {
                                this.userRaffleTickets = parsedState.tickets;
                            }

                            console.log('✅ Успішно відновлено локальний стан участі');
                        } else {
                            console.log('ℹ️ Кеш участі застарів, очищаємо');
                            localStorage.removeItem('winix_participation_state');
                        }
                    }
                }

                // ВИПРАВЛЕННЯ: Також відновлюємо невалідні розіграші
                const invalidRaffles = localStorage.getItem('winix_invalid_raffles');
                if (invalidRaffles) {
                    try {
                        this.invalidRaffleIds = new Set(JSON.parse(invalidRaffles));
                    } catch (e) {
                        console.warn('⚠️ Помилка відновлення невалідних розіграшів:', e);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Помилка відновлення стану участі:', e);
            }
        },

        // Налаштування механізмів синхронізації
        setupSyncMechanisms: function() {
            // Обробник для збереження даних перед закриттям сторінки
            window.addEventListener('beforeunload', () => {
                // Зберігаємо стан участі в розіграшах
                this.saveSyncState();

                // ВИПРАВЛЕННЯ: Примусове скидання стану запиту при закритті сторінки
                this.requestInProgress = false;
            });

            // Додаємо обробник для скидання зависаючих запитів
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // ВИПРАВЛЕННЯ: Перевіряємо час останнього запиту
                    const now = Date.now();
                    if (this.requestInProgress && (now - this.lastParticipationTime > 10000)) {
                        console.warn('⚠️ Виявлено активний запит після зміни вкладки, скидаємо стан...');
                        this.resetState();
                    }

                    // Завантажуємо оновлені дані при поверненні на вкладку
                    setTimeout(() => {
                        this.loadUserRaffles();
                    }, 1000);
                }
            });

            // ВИПРАВЛЕННЯ: Додаємо обробник для очищення invalid state при оновленні сторінки
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log("📝 Сторінка відновлена з кешу, оновлюємо стан");
                    this.requestInProgress = false;
                    this.lastParticipationTime = 0;
                    this.loadUserRaffles();
                }
            });
        },

        // Збереження стану синхронізації в localStorage
        saveSyncState: function() {
            try {
                const participationState = {
                    raffles: Array.from(this.participatingRaffles),
                    tickets: this.userRaffleTickets,
                    lastUpdate: Date.now(),
                    // ВИПРАВЛЕННЯ: НЕ зберігаємо requestInProgress
                };
                localStorage.setItem('winix_participation_state', JSON.stringify(participationState));
            } catch (e) {
                console.warn('⚠️ Не вдалося зберегти стан участі:', e);
            }
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для кнопок участі в розіграшах з делегуванням подій
            document.addEventListener('click', (e) => {
                const joinButton = e.target.closest('.join-button, .mini-raffle-button');

                if (joinButton && !joinButton.disabled && !joinButton.classList.contains('processing')) {
                    const raffleId = joinButton.getAttribute('data-raffle-id');

                    if (raffleId) {
                        e.preventDefault();

                        // Додаємо клас для індикації процесу і блокуємо кнопку
                        joinButton.classList.add('processing');
                        joinButton.disabled = true;

                        // Зберігаємо посилання на кнопку для оновлення стану
                        const buttonRef = joinButton;

                        // Визначаємо тип розіграшу
                        const raffleType = joinButton.classList.contains('mini-raffle-button') ? 'daily' : 'main';

                        // Виконуємо запит участі з оновленням кнопки після завершення
                        this.participateInRaffle(raffleId, raffleType)
                            .catch(error => {
                                console.error('❌ Помилка участі в розіграші:', error);

                                // Показуємо повідомлення про помилку
                                if (typeof window.showToast === 'function') {
                                    window.showToast(error.message || 'Помилка участі в розіграші', 'error');
                                }
                            })
                            .finally(() => {
                                // ВИПРАВЛЕНО: Збільшили затримку для надійності
                                setTimeout(() => {
                                    buttonRef.classList.remove('processing');

                                    // Розблоковуємо кнопку тільки якщо це не був успішний запит
                                    if (!this.participatingRaffles.has(raffleId)) {
                                        buttonRef.disabled = false;
                                    }
                                }, 500);
                            });
                    }
                }
            });

            // Глобальний обробник для оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                // Перевіряємо наявність даних про жетони
                if (event.detail && event.detail.userData &&
                    typeof event.detail.userData.coins !== 'undefined') {

                    // Оновлюємо відображення жетонів
                    const coinsElement = document.getElementById('user-coins');
                    if (coinsElement) {
                        coinsElement.textContent = event.detail.userData.coins;
                    }

                    // Зберігаємо значення в localStorage для запобігання втраті
                    localStorage.setItem('userCoins', event.detail.userData.coins);
                    localStorage.setItem('winix_coins', event.detail.userData.coins);

                    console.log('🔄 Оновлено баланс жетонів:', event.detail.userData.coins);
                }

                // Перевіряємо чи це не подія від нашого модуля
                if (event.source !== 'participation.js') {
                    this.loadUserRaffles();
                }
            });
        },

        // Завантаження розіграшів користувача
        loadUserRaffles: async function() {
            // Перевіряємо, чи активний запит завантаження користувачa
            if (this._loadingUserRaffles) {
                console.log('⏳ Завантаження розіграшів користувача вже виконується');
                return;
            }

            this._loadingUserRaffles = true;

            try {
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для завантаження розіграшів');
                    return;
                }

                // Перед відправкою запиту спочатку показуємо кешовані дані
                this.updateParticipationButtons();

                // ВИПРАВЛЕНО: Додали перевірку на наявність методу apiRequest
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    console.warn('⚠️ WinixAPI.apiRequest не доступний');
                    this._loadingUserRaffles = false;
                    return;
                }

                // Запит до API
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 8000, // Збільшуємо таймаут для запобігання помилок
                    allowParallel: true // Цей запит може виконуватись паралельно з іншими
                });

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // Очищаємо та заповнюємо множину розіграшів
                    const previousSize = this.participatingRaffles.size;
                    this.participatingRaffles.clear();
                    this.userRaffleTickets = {};

                    // Заповнюємо новими даними
                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            // Додаємо до множини участі
                            this.participatingRaffles.add(raffle.raffle_id);

                            // Зберігаємо кількість білетів
                            this.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
                        }
                    });

                    console.log(`✅ Користувач бере участь у ${this.participatingRaffles.size} розіграшах`);

                    // Зберігаємо дані в localStorage для кращої синхронізації
                    this.saveSyncState();

                    // Оновлюємо кнопки участі тільки якщо були зміни
                    if (previousSize !== this.participatingRaffles.size) {
                        this.updateParticipationButtons();
                    }
                } else if (response && response.status === 'error') {
                    console.warn(`⚠️ Помилка завантаження розіграшів: ${response.message}`);

                    // Якщо помилка 429 (занадто багато запитів), чекаємо і повторюємо
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        setTimeout(() => this.loadUserRaffles(), 5000);
                    }
                }
            } catch (error) {
                console.error('❌ Помилка завантаження розіграшів користувача:', error);
            } finally {
                this._loadingUserRaffles = false;
            }
        },

        // Оновлення кнопок участі в розіграшах
        updateParticipationButtons: function() {
            try {
                // Спочатку перевіряємо дані локального сховища
                try {
                    const savedState = localStorage.getItem('winix_participation_state');
                    if (savedState) {
                        const parsedState = JSON.parse(savedState);

                        // Відновлюємо множину розіграшів, якщо вона порожня
                        if (parsedState && Array.isArray(parsedState.raffles) &&
                            (!this.participatingRaffles || this.participatingRaffles.size === 0)) {

                            this.participatingRaffles = new Set(parsedState.raffles);

                            // Відновлюємо кількість білетів
                            if (parsedState.tickets) {
                                this.userRaffleTickets = parsedState.tickets;
                            }

                            console.log(`✅ Відновлено дані участі для ${this.participatingRaffles.size} розіграшів`);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка відновлення стану участі:', e);
                }

                // Використовуємо селектори для кращої продуктивності
                const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
                if (!buttons.length) return;

                // Кешуємо результати для уникнення повторних перевірок
                const participatingMap = {};
                const invalidMap = {};

                // Заповнюємо кеш
                buttons.forEach(button => {
                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Пишемо в кеш лише один раз для кожного raffleId
                    if (participatingMap[raffleId] === undefined) {
                        participatingMap[raffleId] = this.participatingRaffles.has(raffleId);
                    }

                    if (invalidMap[raffleId] === undefined) {
                        invalidMap[raffleId] = (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) ||
                                             (WinixRaffles.state.invalidRaffleIds && WinixRaffles.state.invalidRaffleIds.has(raffleId));
                    }
                });

                // Оновлюємо всі кнопки за один прохід
                buttons.forEach(button => {
                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                    if (participatingMap[raffleId]) {
                        const ticketCount = this.userRaffleTickets ?
                                         (this.userRaffleTickets[raffleId] || 1) : 1;

                        // Оновлюємо текст кнопки лише якщо він не був оновлений раніше
                        if (!button.classList.contains('participating')) {
                            const isMini = button.classList.contains('mini-raffle-button');
                            button.textContent = isMini ?
                                `Додати ще білет (${ticketCount})` :
                                `Додати ще білет (у вас: ${ticketCount})`;

                            // Змінюємо клас, але не додаємо disabled
                            button.classList.add('participating');
                            button.disabled = false;

                            // Видаляємо статус обробки
                            button.removeAttribute('data-processing');
                            button.classList.remove('processing');
                        }
                    }

                    // Для невалідних розіграшів
                    if (invalidMap[raffleId] && !button.classList.contains('disabled')) {
                        button.textContent = 'Розіграш завершено';
                        button.classList.add('disabled');
                        button.disabled = true;
                    }
                });
            } catch (error) {
                console.error("❌ Помилка при оновленні кнопок участі:", error);
            }
        },

        /**
         * Участь у розіграші з покращеною обробкою помилок та синхронізацією
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @returns {Promise<object>} Результат участі
         */
        participateInRaffle: async function(raffleId, raffleType) {
            const userId = WinixRaffles.state.telegramId ||
                        (window.WinixAPI ? window.WinixAPI.getUserId() : null);

            if (!userId) {
                return Promise.reject(new Error('Не вдалося визначити ваш ID'));
            }

            // Перевірка валідності raffleId
            if (!WinixAPI.isValidUUID || typeof WinixAPI.isValidUUID !== 'function') {
                // Запасна перевірка, якщо основна функція недоступна
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!raffleId || !uuidRegex.test(raffleId)) {
                    return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
                }
            } else if (!WinixAPI.isValidUUID(raffleId)) {
                return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
            }

            // ВИПРАВЛЕННЯ: Додали перевірку на затримку між запитами
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastParticipationTime;
            if (timeSinceLastRequest < 1000) {
                console.warn("⚠️ Занадто частий запит, потрібно зачекати");
                return Promise.reject(new Error('Зачекайте 1 секунду перед наступною спробою'));
            }

            // ВИПРАВЛЕННЯ: Додано автоматичне скидання стану при зависанні
            if (this.requestInProgress) {
                const timeSinceLastRequest = now - this.lastParticipationTime;
                if (timeSinceLastRequest > 10000) { // Якщо пройшло більше 10 секунд
                    console.warn("⚠️ Виявлено застряглий запит, скидаємо стан");
                    this.requestInProgress = false;
                } else {
                    console.warn(`⚠️ Участь вже обробляється, пропускаємо запит на ${raffleId}`);
                    return Promise.reject(new Error('Зачекайте завершення попереднього запиту'));
                }
            }

            // Перевірка невалідних розіграшів
            if (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) {
                console.warn(`⚠️ Спроба участі в невалідному розіграші: ${raffleId}`);
                return Promise.reject(new Error('Розіграш вже завершено або недоступний'));
            }

            // Встановлюємо стан і час запиту
            this.requestInProgress = true;
            this.lastParticipationTime = now;

            // ВИПРАВЛЕННЯ: Додаємо власний таймаут для автоматичного скидання
            const safetyTimeout = setTimeout(() => {
                if (this.requestInProgress) {
                    console.warn("⚠️ Виявлено довготривалий запит, автоматично скидаємо стан");
                    this.requestInProgress = false;
                }
            }, 15000); // 15 секунд максимум на запит

            // Отримання початкових даних для аналізу змін
            const initialCoins = parseInt(document.getElementById('user-coins')?.textContent ||
                                        localStorage.getItem('userCoins') || '0');

            try {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Визначення кількості жетонів для участі
                let entryCount = 1;

                // Оновлення стану кнопок перед запитом
                this._updateButtonsForPendingParticipation(raffleId);

                // ВИПРАВЛЕНО: Перевірка наявності API
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    throw new Error('API недоступний. Оновіть сторінку і спробуйте знову.');
                }

                // ВИПРАВЛЕНО: Покращений запит з більшою кількістю опцій
                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: entryCount,
                    _timestamp: Date.now() // Запобігає кешуванню
                }, {
                    timeout: 10000,           // Таймаут 10 секунд
                    retries: 1,               // Одна повторна спроба
                    bypassThrottle: true,     // Обходимо загальне обмеження швидкості
                    allowParallel: false      // Заборона паралельних запитів
                });

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                if (response.status === 'success') {
                    // Безпечне оновлення кількості жетонів
                    const newCoinsBalance = response.data?.new_coins_balance !== undefined
                        ? response.data.new_coins_balance
                        : (initialCoins - entryCount);

                    // Оновлюємо DOM
                    const userCoinsElement = document.getElementById('user-coins');
                    if (userCoinsElement) {
                        userCoinsElement.textContent = newCoinsBalance;
                    }

                    // Зберігаємо в localStorage
                    localStorage.setItem('userCoins', newCoinsBalance.toString());
                    localStorage.setItem('winix_coins', newCoinsBalance.toString());

                    // Оновлюємо кількість білетів і стан
                    this.participatingRaffles.add(raffleId);
                    const previousTickets = this.userRaffleTickets[raffleId] || 0;
                    this.userRaffleTickets[raffleId] = previousTickets + 1;

                    // Зберігаємо оновлений стан у localStorage
                    this.saveSyncState();

                    // Оновлюємо кнопки участі відразу
                    this.updateParticipationButtons();

                    // Визначаємо повідомлення про успіх
                    const ticketCount = this.userRaffleTickets[raffleId];
                    let message = previousTickets > 0
                        ? `Додано ще один білет! Тепер у вас ${ticketCount} білетів`
                        : 'Ви успішно взяли участь у розіграші';

                    // Показуємо повідомлення
                    if (typeof window.showToast === 'function') {
                        window.showToast(message, 'success');
                    } else {
                        console.log(`✅ ${message}`);
                    }

                    // Відправляємо глобальну подію оновлення даних користувача
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: {
                            userData: {
                                coins: newCoinsBalance,
                                participations_count: this.participatingRaffles.size
                            }
                        },
                        source: 'participation.js'
                    }));

                    // Оновлюємо кількість учасників у DOM
                    this.updateParticipantsCount(raffleId);

                    return { success: true, data: response.data, message };
                } else {
                    // Обробка спеціальних помилок
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        throw new Error('Забагато запитів. Спробуйте через 30 секунд');
                    } else if (response.message && response.message.includes('raffle_not_found')) {
                        // Додаємо до невалідних
                        this.addInvalidRaffleId(raffleId);
                        throw new Error('Розіграш не знайдено або вже завершено');
                    } else {
                        throw new Error(response.message || "Помилка участі в розіграші");
                    }
                }
            } catch (error) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

                // Показуємо повідомлення про помилку
                if (typeof window.showToast === 'function') {
                    window.showToast(error.message || "Помилка при спробі участі в розіграші", 'error');
                }

                throw error;
            } finally {
                // ВИПРАВЛЕННЯ: Очищаємо таймаут в будь-якому випадку
                clearTimeout(safetyTimeout);

                // ВАЖЛИВО: Завжди знімаємо блокування запиту!
                this.requestInProgress = false;

                // Видаляємо статус очікування з кнопок
                setTimeout(() => {
                    this._clearPendingParticipationState(raffleId);
                }, 300);
            }
        },

        // Очищення списку недійсних розіграшів
        clearInvalidRaffleIds: function() {
            this.invalidRaffleIds.clear();
            console.log('🧹 Очищено список недійсних розіграшів');

            // Також очищаємо локальне сховище
            try {
                localStorage.removeItem('winix_invalid_raffles');
            } catch (e) {
                console.warn('⚠️ Не вдалося очистити кеш невалідних розіграшів:', e);
            }
        },

        // Додає розіграш до недійсних
        addInvalidRaffleId: function(raffleId) {
            if (!raffleId) return;

            this.invalidRaffleIds.add(raffleId);

            // Також додаємо до глобального списку
            if (WinixRaffles.state.invalidRaffleIds) {
                WinixRaffles.state.invalidRaffleIds.add(raffleId);
            }

            // Зберігаємо в localStorage
            try {
                localStorage.setItem('winix_invalid_raffles', JSON.stringify(Array.from(this.invalidRaffleIds)));
            } catch (e) {
                console.warn('⚠️ Не вдалося зберегти невалідні розіграші:', e);
            }

            console.log(`⚠️ Додано розіграш ${raffleId} до списку недійсних`);
            this.updateParticipationButtons();
        },

        /**
         * Оновлення стану кнопок під час очікування
         * @param {string} raffleId - ID розіграшу
         */
        _updateButtonsForPendingParticipation: function(raffleId) {
            try {
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                buttons.forEach(button => {
                    button.setAttribute('data-processing', 'true');
                    button.classList.add('processing');
                    const originalText = button.textContent;
                    button.setAttribute('data-original-text', originalText);
                    button.textContent = 'Обробка...';
                });
            } catch (e) {
                console.warn('Не вдалося оновити стан кнопок:', e);
            }
        },

        /**
         * Очищення стану очікування
         * @param {string} raffleId - ID розіграшу
         */
        _clearPendingParticipationState: function(raffleId) {
            try {
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                buttons.forEach(button => {
                    button.removeAttribute('data-processing');
                    button.classList.remove('processing');

                    // Відновлюємо оригінальний текст, якщо кнопка не показує участь
                    if (!button.classList.contains('participating')) {
                        const originalText = button.getAttribute('data-original-text');
                        if (originalText) {
                            button.textContent = originalText;
                        }
                        button.disabled = false;
                    }
                });
            } catch (e) {
                console.warn('Не вдалося очистити стан кнопок:', e);
            }
        },

        /**
         * Функція для оновлення кількості учасників розіграшу в DOM
         * @param {string} raffleId - ID розіграшу
         */
        updateParticipantsCount: function(raffleId) {
            try {
                // Знаходимо елемент для оновлення кількості учасників
                const participantsCountElement = document.querySelector(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                if (participantsCountElement) {
                    // Отримуємо поточне значення і збільшуємо його
                    const currentCount = parseInt(participantsCountElement.textContent.replace(/\s+/g, '')) || 0;
                    participantsCountElement.textContent = (currentCount + 1).toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Форматування з пробілами між розрядами
                }
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити лічильник учасників:", e);
            }
        },

        /**
         * Аварійне скидання стану
         * ВИПРАВЛЕННЯ: Додано детальніше очищення та логування
         */
        resetState: function() {
            console.log('🔄 Виконується скидання стану participation...');

            // Скидаємо всі прапорці
            this.requestInProgress = false;
            this.lastParticipationTime = 0;
            this.lastStateReset = Date.now();

            // Очищаємо чергу запитів
            this.pendingRequests = [];

            // Видаляємо статус обробки з усіх кнопок
            try {
                const buttons = document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing');
                buttons.forEach(button => {
                    button.removeAttribute('data-processing');
                    button.classList.remove('processing');
                    button.disabled = false;

                    // Відновлюємо оригінальний текст
                    const originalText = button.getAttribute('data-original-text');
                    if (originalText && !button.classList.contains('participating')) {
                        button.textContent = originalText;
                    }
                });
            } catch (e) {
                console.warn('Не вдалося скинути стан кнопок:', e);
            }

            console.log('✅ Стан модуля участі успішно скинуто');
            return true;
        }
    };

    // Додаємо модуль участі до основного модуля розіграшів
    WinixRaffles.participation = participation;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        // ВИПРАВЛЕННЯ: Скидаємо стан запиту при завантаженні сторінки
        if (window.WinixRaffles && window.WinixRaffles.participation) {
            window.WinixRaffles.participation.requestInProgress = false;
            window.WinixRaffles.participation.lastParticipationTime = 0;
        }

        if (WinixRaffles.state.isInitialized) {
            participation.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                participation.init();
            });
        }
    });

    // ВИПРАВЛЕННЯ: Додали глобальний обробник для вікна, щоб обробляти помилки та скидати стан
    window.addEventListener('error', function(event) {
        console.error('🚨 Глобальна помилка в participation:', event.error);
        if (participation && participation.requestInProgress) {
            console.warn('⚠️ Виявлено активний запит під час помилки. Скидаємо стан...');
            participation.resetState();
        }

        // Якщо є індикатор завантаження, ховаємо його
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    });

    // ВИПРАВЛЕННЯ: Додали обробник необроблених помилок
    window.addEventListener('unhandledrejection', function(event) {
        if (participation && participation.requestInProgress) {
            console.warn('⚠️ Виявлено необроблену Promise помилку при участі, скидаємо стан...');
            participation.resetState();
        }
    });

    console.log('✅ Модуль участі успішно ініціалізовано');
})();