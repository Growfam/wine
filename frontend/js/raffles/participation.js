/**
 * WINIX - Система розіграшів (participation.js)
 * Модуль для обробки участі користувача в розіграшах
 * Оптимізована версія з виправленням проблем узгодженості даних та обробки помилок
 * @version 1.4.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof WinixRaffles === 'undefined') {
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

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // Перевіряємо збережений стан участі в localStorage
            this._restoreParticipationFromStorage();

            // Створюємо додаткові ресурси для синхронізації станів
            this.setupSyncMechanisms();

            // Завантаження розіграшів користувача
            this.loadUserRaffles();

            // Додаємо обробники подій
            this.setupEventListeners();
        },

        // Відновлення стану участі з localStorage
        _restoreParticipationFromStorage: function() {
            try {
                const savedState = localStorage.getItem('winix_participation_state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);

                    // Перевіряємо чи дані не застарілі (не більше 1 години)
                    if (parsedState && parsedState.lastUpdate &&
                        (Date.now() - parsedState.lastUpdate < 3600000)) {

                        // Відновлюємо множину розіграшів
                        if (Array.isArray(parsedState.raffles)) {
                            this.participatingRaffles = new Set(parsedState.raffles);
                        }

                        // Відновлюємо кількість білетів
                        if (parsedState.tickets) {
                            this.userRaffleTickets = parsedState.tickets;
                        }

                        console.log('✅ Успішно відновлено локальний стан участі');
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
            });

            // Додаємо обробник для скидання зависаючих запитів
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.requestInProgress) {
                    // Якщо сторінка стала видимою, а запит все ще в процесі,
                    // це може свідчити про зависання - скидаємо стан
                    console.warn('⚠️ Виявлено активний запит після зміни вкладки, скидаємо стан...');
                    setTimeout(() => this.resetState(), 1000);
                }
            });

            // Перевіряємо наявність зависаючих запитів кожні 30 секунд
            setInterval(() => {
                if (this.requestInProgress && document.visibilityState === 'visible') {
                    // Якщо запит зависає більше 30 секунд, скидаємо його
                    console.warn('⚠️ Запит участі висить більше 30 секунд, скидаємо стан...');
                    this.resetState();
                }
            }, 30000);
        },

        // Збереження стану синхронізації в localStorage
        saveSyncState: function() {
            try {
                const participationState = {
                    raffles: Array.from(this.participatingRaffles),
                    tickets: this.userRaffleTickets,
                    lastUpdate: Date.now()
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
                                // Видаляємо статус обробки з кнопки і розблоковуємо її
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
                if (event.detail && typeof event.detail.userData === 'object' &&
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

            // Обробник для переходу між вкладками (для оновлення даних)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Завантажуємо оновлені дані при поверненні на вкладку
                    setTimeout(() => {
                        this.loadUserRaffles();
                    }, 1000);
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
            if (this.requestInProgress) {
    window.showToast("Зачекайте завершення попереднього запиту", "warning");
    console.log("Запит участі вже виконується, очікування...");
    return Promise.resolve({
        success: false,
        message: "Зачекайте завершення попереднього запиту"
    });
}
            const userId = WinixRaffles.state.telegramId ||
                           (window.WinixAPI ? window.WinixAPI.getUserId() : null);

            if (!userId) {
                return Promise.reject(new Error('Не вдалося визначити ваш ID'));
            }

            // 1. ВАЖЛИВО: Перевірка валідності raffleId перед продовженням
            if (!WinixAPI.isValidUUID || typeof WinixAPI.isValidUUID !== 'function') {
                // Запасна перевірка, якщо основна функція недоступна
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!raffleId || !uuidRegex.test(raffleId)) {
                    return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
                }
            } else if (!WinixAPI.isValidUUID(raffleId)) {
                return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
            }

            // 2. ВИПРАВЛЕННЯ: Перевірка наявності активних запитів
            if (this.requestInProgress) {
                console.warn(`❌ Участь вже обробляється, пропускаємо запит на ${raffleId}`);
                return Promise.reject(new Error('Зачекайте завершення попереднього запиту'));
            }

            // 3. ВИПРАВЛЕННЯ: Удосконалене обмеження частоти запитів
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastParticipationTime;
            if (timeSinceLastRequest < 5000) {
                const secondsToWait = Math.ceil((5000 - timeSinceLastRequest) / 1000);
                console.warn(`⏳ Надто частий запит, потрібно чекати ${secondsToWait}с`);
                return Promise.reject(new Error(`Зачекайте ${secondsToWait} секунд перед наступною спробою`));
            }

            // 4. НОВЕ: Обробка невалідних розіграшів
            if (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) {
                console.warn(`⚠️ Спроба участі в невалідному розіграші: ${raffleId}`);
                return Promise.reject(new Error('Розіграш вже завершено або недоступний'));
            }

            // Встановлюємо стан і час запиту
            this.requestInProgress = true;
            this.lastParticipationTime = now;

            // Отримання початкових даних для аналізу змін
            const initialCoins = parseInt(document.getElementById('user-coins')?.textContent ||
                                          localStorage.getItem('userCoins') || '0');

            try {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Визначення кількості жетонів для участі
                let entryCount = 1;

                // 5. НОВЕ: Додаємо проміжне оновлення UI для кращого UX
                this._updateButtonsForPendingParticipation(raffleId);

                // 6. ВИПРАВЛЕННЯ: Покращений запит з більшою кількістю опцій
                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: entryCount,
                    _timestamp: Date.now() // Запобігає кешуванню
                }, {
                    timeout: 15000,           // Збільшений таймаут
                    retries: 1,               // Дозволяємо одну повторну спробу
                    bypassThrottle: true,     // Обходимо загальне обмеження швидкості
                    allowParallel: false,     // Важливо! Заборона паралельних запитів
                    suppressErrors: false     // Хочемо, щоб помилки пробивалися
                });

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                if (response.status === 'success') {
                    // 7. ВИПРАВЛЕННЯ: Безпечне оновлення кількості жетонів
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

                    // Зберігаємо оновлений стан
                    this.saveSyncState();

                    // Оновлюємо кнопки участі відразу
                    this.updateParticipationButtons();

                    // Визначаємо повідомлення про успіх
                    const ticketCount = this.userRaffleTickets[raffleId];
                    let message = previousTickets > 0
                        ? `Додано ще один білет! Тепер у вас ${ticketCount} білетів`
                        : 'Ви успішно взяли участь у розіграші';

                    // Показуємо повідомлення про бонус, якщо є
                    if (response.data && response.data.bonus_amount) {
                        message += `. Бонус: ${response.data.bonus_amount} ${response.data.bonus_currency || 'WINIX'}`;
                    }

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

                    // Завантажуємо оновлені дані користувача (після затримки)
                    setTimeout(() => {
                        this.loadUserRaffles();
                    }, 3000);

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

                // 8. ВИПРАВЛЕННЯ: Покращена обробка специфічних помилок
                let errorMessage = error.message || "Помилка при спробі участі в розіграші";

                // Обробка специфічних помилок
                if (error.message) {
                    if (error.message.includes('занадто багато запитів') ||
                        error.message.includes('Зачекайте') ||
                        error.message.includes('429')) {

                        this.lastParticipationTime = Date.now(); // Оновлюємо час для запобігання повторним спробам
                        errorMessage = "Занадто частий запит. Спробуйте через 5-10 секунд";
                    }
                    else if (error.message.includes('недостатньо') ||
                            error.message.includes('insufficient') ||
                            error.message.includes('жетон')) {
                        errorMessage = "Недостатньо жетонів для участі в розіграші";
                    }
                    else if (error.message.includes('raffle_not_found') ||
                            error.message.includes('не знайдено')) {
                        this.addInvalidRaffleId(raffleId);
                        errorMessage = "Розіграш не знайдено або вже завершено";
                    }
                }

                if (typeof window.showToast === 'function') {
                    window.showToast(errorMessage, 'error');
                }

                throw new Error(errorMessage);
            } finally {
                // 9. ВАЖЛИВО: Завжди знімаємо блокування запиту!
                this.requestInProgress = false;

                // 10. НОВЕ: Видаляємо статус очікування з кнопок
                setTimeout(() => {
                    this._clearPendingParticipationState(raffleId);
                }, 300);
            }
        },

        // Функція для оновлення кількості учасників розіграшу в DOM
        updateParticipantsCount: function(raffleId) {
            try {
                // Знайти елемент для оновлення кількості учасників
                const participantsCountElement = document.querySelector(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                if (participantsCountElement) {
                    // Отримати поточне значення і збільшити його
                    const currentCount = parseInt(participantsCountElement.textContent.replace(/\s+/g, '')) || 0;
                    participantsCountElement.textContent = (currentCount + 1).toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Форматування з пробілами між розрядами
                }
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити лічильник учасників:", e);
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

        // 11. НОВИЙ МЕТОД: Оновлення стану кнопок під час очікування
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

        // 12. НОВИЙ МЕТОД: Очищення стану очікування
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

        // Аварійне скидання стану при помилках
        resetState: function() {
            this.requestInProgress = false;
            this.lastParticipationTime = 0;

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

            console.log('🔄 Стан модуля участі скинуто');

            // Оновлюємо кнопки на основі збереженого стану
            this.updateParticipationButtons();

            return true;
        }
    };

    // Додаємо модуль участі до основного модуля розіграшів
    WinixRaffles.participation = participation;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (WinixRaffles.state.isInitialized) {
            participation.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                participation.init();
            });
        }
    });

    // Додаємо обробник для виявлення помилок при завантаженні сторінки
    window.addEventListener('load', function() {
        // Якщо сторінка повністю завантажена, перевіряємо стан
        setTimeout(function() {
            // Перевіряємо наявність незавершених запитів
            if (participation.requestInProgress) {
                console.warn('⚠️ Виявлено блокування запиту після завантаження сторінки. Скидаємо стан...');
                participation.resetState();
            }

            // Додаємо стилі для кнопок участі
            const style = document.createElement('style');
            style.textContent = `
                .join-button.processing, .mini-raffle-button.processing {
                    background: #4c4c6e !important;
                    opacity: 0.8;
                    cursor: wait !important;
                    position: relative;
                    overflow: hidden;
                }
                
                .join-button.processing::after, .mini-raffle-button.processing::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 200%;
                    height: 100%;
                    background: linear-gradient(90deg, 
                        rgba(255, 255, 255, 0),
                        rgba(255, 255, 255, 0.1),
                        rgba(255, 255, 255, 0));
                    animation: loading-shine 1.5s infinite;
                }
                
                @keyframes loading-shine {
                    to {
                        left: 100%;
                    }
                }
            `;

            document.head.appendChild(style);
        }, 5000); // Перевіряємо через 5 секунд після завантаження
    });
})();