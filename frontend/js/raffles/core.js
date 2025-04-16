/**
 * WINIX - Система розіграшів (core.js)
 * Оптимізована версія з покращеною обробкою помилок та захистом від зависання
 * @version 1.3.0
 */

(function() {
    'use strict';

    // Перевірка наявності необхідних модулів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що init.js підключено перед core.js');
        return;
    }

    // Лічильники для моніторингу запитів
    let _requestCounter = {
        total: 0,
        errors: 0,
        lastReset: Date.now()
    };

    // Список невалідних ID розіграшів
    if (!WinixRaffles.state.invalidRaffleIds) {
        WinixRaffles.state.invalidRaffleIds = new Set();
    }

    // ===== КЛЮЧОВІ ФУНКЦІЇ СИСТЕМИ РОЗІГРАШІВ =====

    /**
     * Завантаження активних розіграшів
     * @param {boolean} forceRefresh - Примусове оновлення, ігноруючи кеш
     * @param {number} limit - Ліміт кількості розіграшів (за замовчуванням 50)
     * @param {number} offset - Зміщення для пагінації
     * @returns {Promise<Object>} Результат завантаження
     */
    WinixRaffles.loadActiveRaffles = async function(forceRefresh = false, limit = 50, offset = 0) {
        // Перевіряємо, чи вже виконується завантаження
        if (this.state.isLoading && !forceRefresh) {
            console.log("⏳ Завантаження розіграшів вже виконується");
            return { success: false, message: "Завантаження вже виконується" };
        }

        // Показуємо індикатор завантаження, якщо не було явного запиту оминути
        const showLoader = !this.skipLoader;
        if (showLoader && typeof window.showLoading === 'function') {
            window.showLoading();
        }

        try {
            // Позначаємо, що розпочали завантаження
            this.state.isLoading = true;
            _requestCounter.total++;

            console.log("🔄 Розпочато завантаження активних розіграшів");

            // Формуємо URL запиту з параметрами
            const queryParams = new URLSearchParams({
                limit: limit,
                offset: offset,
                t: Date.now() // Запобігання кешуванню
            });

            // Отримуємо дані з сервера за допомогою API
            let response;
            const apiEndpoint = `${this.config.activeRafflesEndpoint}?${queryParams.toString()}`;

            if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.apiRequest === 'function') {
                response = await WinixAPI.apiRequest(apiEndpoint, 'GET', null, {
                    timeout: 15000, // Збільшений таймаут
                    suppressErrors: true, // Обробляємо помилки тут
                    retries: 2 // Дозволяємо 2 повторні спроби
                });
            } else {
                // Запасний метод, якщо API недоступний
                const fetchResponse = await fetch(`${apiEndpoint}`);
                response = await fetchResponse.json();
            }

            // Перевіряємо успішність відповіді
            if (response && response.status === 'success' && Array.isArray(response.data)) {
                // Зберігаємо дані розіграшів
                this.state.activeRaffles = response.data;

                // Позначаємо розіграші, в яких користувач бере участь
                await this.loadUserParticipation();

                // Оновлюємо відображення
                this.renderActiveRaffles();

                console.log(`✅ Успішно завантажено ${this.state.activeRaffles.length} активних розіграшів`);

                // Якщо є модуль participation, оновлюємо статус
                if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
                    this.participation.updateParticipationButtons();
                }

                // Відправляємо подію про оновлення розіграшів
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
            console.error('❌ Помилка завантаження активних розіграшів:', error);
            _requestCounter.errors++;

            // Якщо є кешовані дані, використовуємо їх
            if (this.state.activeRaffles.length > 0) {
                console.log("⚠️ Використовуємо кешовані дані розіграшів");

                // Все одно оновлюємо відображення з кешованими даними
                this.renderActiveRaffles();

                return {
                    success: true,
                    source: 'cache',
                    data: this.state.activeRaffles,
                    message: "Використано кешовані дані розіграшів"
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
            this.state.isLoading = false;

            // Приховуємо індикатор завантаження
            if (showLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Скидаємо флаг пропуску індикатора
            this.skipLoader = false;
        }
    };

    /**
     * Завантаження розіграшів, у яких бере участь користувач
     * @returns {Promise<Object>} Результат завантаження
     */
    WinixRaffles.loadUserParticipation = async function() {
        try {
            // Попередня перевірка наявності ID користувача
            if (!this.state.telegramId) {
                this.state.telegramId = WinixAPI.getUserId();
                if (!this.state.telegramId) {
                    console.warn("⚠️ ID користувача відсутній, не можемо завантажити участь");
                    return { success: false, message: "ID користувача відсутній" };
                }
            }

            console.log("🔄 Розпочато завантаження участі користувача");

            let response;
            const apiEndpoint = this.config.userRafflesEndpoint.replace('{userId}', this.state.telegramId);

            if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.apiRequest === 'function') {
                response = await WinixAPI.apiRequest(apiEndpoint, 'GET', null, {
                    timeout: 10000,
                    suppressErrors: true, // Обробляємо помилки тут
                    bypassThrottle: true // Дозволяємо навіть при обмеженні швидкості
                });
            } else {
                // Запасний метод, якщо API недоступний
                const fetchResponse = await fetch(apiEndpoint);
                response = await fetchResponse.json();
            }

            if (response && response.status === 'success' && Array.isArray(response.data)) {
                // Зберігаємо дані розіграшів користувача
                this.state.userRaffles = response.data;

                // Ініціалізація модуля участі, якщо потрібно
                if (!this.participation) {
                    this.participation = {
                        participatingRaffles: new Set(),
                        userRaffleTickets: {},
                        invalidRaffleIds: new Set()
                    };
                } else if (!this.participation.participatingRaffles) {
                    this.participation.participatingRaffles = new Set();
                    this.participation.userRaffleTickets = {};
                }

                // Очищаємо попередні дані участі
                this.participation.participatingRaffles.clear();
                this.participation.userRaffleTickets = {};

                // Заповнюємо дані участі
                for (const raffle of this.state.userRaffles) {
                    const raffleId = raffle.raffle_id || raffle.id;

                    // Перевіряємо валідність ID
                    if (raffleId && typeof raffleId === 'string' && raffleId.length > 10) {
                        this.participation.participatingRaffles.add(raffleId);
                        this.participation.userRaffleTickets[raffleId] = raffle.entry_count || 1;
                    }
                }

                console.log(`✅ Завантажено участь у ${this.state.userRaffles.length} розіграшах`);

                return {
                    success: true,
                    data: this.state.userRaffles
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
     * Оновлення статусу кнопок участі в розіграшах
     */
    WinixRaffles.updateParticipationButtons = function() {
        // Перевіряємо, що є модуль participation
        if (!this.participation) {
            this.participation = {
                participatingRaffles: new Set(),
                userRaffleTickets: {},
                invalidRaffleIds: new Set()
            };
        } else if (!this.participation.participatingRaffles) {
            this.participation.participatingRaffles = new Set();
            this.participation.userRaffleTickets = {};
        }

        try {
            // Оновлюємо кнопку головного розіграшу
            document.querySelectorAll('.join-button').forEach(button => {
                if (!button) return;

                const raffleId = button.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                if (this.participation.participatingRaffles && this.participation.participatingRaffles.has(raffleId)) {
                    const ticketCount = this.participation.userRaffleTickets ?
                                      (this.participation.userRaffleTickets[raffleId] || 1) : 1;
                    button.textContent = `Додати ще білет (у вас: ${ticketCount})`;

                    // Змінюємо клас, але не додаємо disabled
                    button.classList.add('participating');
                    button.disabled = false;
                }

                // Для невалідних розіграшів
                if ((this.participation.invalidRaffleIds && this.participation.invalidRaffleIds.has(raffleId)) ||
                    (this.state.invalidRaffleIds && this.state.invalidRaffleIds.has(raffleId))) {
                    button.textContent = 'Розіграш завершено';
                    button.classList.add('disabled');
                    button.disabled = true;
                }
            });

            // Оновлюємо кнопки міні-розіграшів
            document.querySelectorAll('.mini-raffle-button').forEach(button => {
                if (!button) return;

                const raffleId = button.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                if (this.participation.participatingRaffles && this.participation.participatingRaffles.has(raffleId)) {
                    const ticketCount = this.participation.userRaffleTickets ?
                                      (this.participation.userRaffleTickets[raffleId] || 1) : 1;
                    button.textContent = `Додати ще білет (${ticketCount})`;

                    // Змінюємо клас, але не додаємо disabled
                    button.classList.add('participating');
                    button.disabled = false;
                }

                // Для невалідних розіграшів
                if ((this.participation.invalidRaffleIds && this.participation.invalidRaffleIds.has(raffleId)) ||
                    (this.state.invalidRaffleIds && this.state.invalidRaffleIds.has(raffleId))) {
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
     * Відмалювання активних розіграшів на сторінці
     */
    WinixRaffles.renderActiveRaffles = function() {
        try {
            // Отримуємо контейнер для активних розіграшів
            const container = document.getElementById('active-raffles-container');
            if (!container) {
                console.warn("⚠️ Контейнер активних розіграшів не знайдено");
                return false;
            }

            // Очищаємо контейнер
            container.innerHTML = '';

            // Перевіряємо, чи є активні розіграші
            if (!this.state.activeRaffles || this.state.activeRaffles.length === 0) {
                container.innerHTML = `
                    <div class="no-raffles">
                        <p>На даний момент активних розіграшів немає.</p>
                        <p>Спробуйте пізніше або перевірте вкладку "Історія".</p>
                    </div>
                `;
                return false;
            }

            // Рендеримо кожен розіграш
            this.state.activeRaffles.forEach(raffle => {
                const isDaily = raffle.is_daily || false;
                const raffleHtml = this.createRaffleCardHtml(raffle, isDaily);
                container.innerHTML += raffleHtml;
            });

            // Запускаємо таймери для всіх розіграшів
            this.initializeCountdownTimers();

            // Додаємо обробники для кнопок участі
            this.setupParticipationButtons();

            return true;
        } catch (error) {
            console.error("❌ Помилка відмалювання активних розіграшів:", error);

            // Виводимо повідомлення про помилку
            this.renderError('Помилка відображення розіграшів', 'Будь ласка, оновіть сторінку');

            return false;
        }
    };

    /**
     * Створення HTML-коду картки розіграшу
     * @param {Object} raffle - Дані розіграшу
     * @param {boolean} isDaily - Чи це щоденний розіграш
     * @returns {string} HTML-код картки
     */
    WinixRaffles.createRaffleCardHtml = function(raffle, isDaily = false) {
        // Перевірка даних розіграшу на валідність
        if (!raffle || !raffle.id) return '';

        // Форматування дати і часу
        const endTime = new Date(raffle.end_time);
        const dateFormatted = endTime.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Форматування назви та опису (з безпечною перевіркою)
        const title = raffle.title || 'Розіграш';
        const description = raffle.description || 'Опис відсутній';

        // Вартість участі та призи
        const entryFee = raffle.entry_fee || 1;
        const prizeAmount = raffle.prize_amount || 0;
        const prizeCurrency = raffle.prize_currency || 'WINIX';
        const winnersCount = raffle.winners_count || 1;

        // Визначення класу для карточки в залежності від типу
        const cardClass = isDaily ? 'raffle-card daily-raffle' : 'raffle-card main-raffle';

        // Формування зображення призу
        const imageUrl = raffle.image_url || 'assets/prize-default.png';

        // Формування ID елементів таймера
        const timerPrefix = `${raffle.id}`;

        return `
        <div class="${cardClass}" data-raffle-id="${raffle.id}" data-is-daily="${isDaily}">
            <div class="raffle-header">
                <h3 class="raffle-title">${title}</h3>
                <div class="raffle-badge ${isDaily ? 'daily' : 'main'}">${isDaily ? 'Щоденний' : 'Головний'}</div>
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
        </div>
        `;
    };

    /**
     * Ініціалізація таймерів зворотного відліку для всіх розіграшів
     */
    WinixRaffles.initializeCountdownTimers = function() {
        try {
            // Спочатку зупиняємо всі попередні таймери
            for (const timerId in this.state.refreshTimers) {
                if (timerId.startsWith('countdown_')) {
                    clearInterval(this.state.refreshTimers[timerId]);
                    delete this.state.refreshTimers[timerId];
                }
            }

            // Запускаємо таймери для кожного розіграшу
            this.state.activeRaffles.forEach(raffle => {
                if (raffle.end_time) {
                    const endTime = new Date(raffle.end_time);
                    this.startCountdown(raffle.id, endTime);
                }
            });
        } catch (error) {
            console.error("❌ Помилка ініціалізації таймерів:", error);
        }
    };

    /**
     * Запуск таймера зворотного відліку для розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {Date} endTime - Час закінчення розіграшу
     */
    WinixRaffles.startCountdown = function(raffleId, endTime) {
        try {
            // Перевіряємо валідність вхідних даних
            if (!raffleId || !endTime || isNaN(endTime.getTime())) {
                console.warn(`⚠️ Невалідні дані для таймера розіграшу ${raffleId}`);
                return;
            }

            // Очищаємо попередній таймер, якщо є
            if (this.state.refreshTimers[`countdown_${raffleId}`]) {
                clearInterval(this.state.refreshTimers[`countdown_${raffleId}`]);
            }

            // Функція оновлення таймера
            const updateTimer = () => {
                const now = new Date().getTime();
                const timeLeft = endTime.getTime() - now;

                // Перевіряємо наявність елементів перед доступом до них
                const days = document.getElementById(`days-${raffleId}`);
                const hours = document.getElementById(`hours-${raffleId}`);
                const minutes = document.getElementById(`minutes-${raffleId}`);
                const seconds = document.getElementById(`seconds-${raffleId}`);

                // Якщо час вийшов або елементи не знайдені, зупиняємо таймер
                if (timeLeft <= 0 || !days || !hours || !minutes || !seconds) {
                    clearInterval(this.state.refreshTimers[`countdown_${raffleId}`]);
                    delete this.state.refreshTimers[`countdown_${raffleId}`];

                    // Оновлюємо елементи таймера, якщо вони існують
                    if (days) days.textContent = '00';
                    if (hours) hours.textContent = '00';
                    if (minutes) minutes.textContent = '00';
                    if (seconds) seconds.textContent = '00';

                    // Додаємо розіграш до невалідних, якщо час вийшов
                    if (timeLeft <= 0) {
                        this.state.invalidRaffleIds.add(raffleId);
                        if (this.participation && this.participation.invalidRaffleIds) {
                            this.participation.invalidRaffleIds.add(raffleId);
                        }

                        // Оновлюємо відображення кнопок
                        if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
                            this.participation.updateParticipationButtons();
                        }

                        // Оновлюємо список розіграшів через деякий час
                        setTimeout(() => {
                            // Використовуємо skipLoader, щоб не показувати завантажувач для автоматичного оновлення
                            this.skipLoader = true;
                            this.loadActiveRaffles(true);
                        }, 5000);
                    }
                    return;
                }

                // Розрахунок днів, годин, хвилин, секунд
                const daysValue = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hoursValue = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesValue = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const secondsValue = Math.floor((timeLeft % (1000 * 60)) / 1000);

                // Оновлення елементів таймера з безпечною перевіркою
                if (days) days.textContent = daysValue.toString().padStart(2, '0');
                if (hours) hours.textContent = hoursValue.toString().padStart(2, '0');
                if (minutes) minutes.textContent = minutesValue.toString().padStart(2, '0');
                if (seconds) seconds.textContent = secondsValue.toString().padStart(2, '0');
            };

            // Запускаємо перше оновлення таймера
            updateTimer();

            // Запускаємо інтервал оновлення таймера (щосекунди)
            this.state.refreshTimers[`countdown_${raffleId}`] = setInterval(updateTimer, 1000);
        } catch (error) {
            console.error(`❌ Помилка запуску таймера для розіграшу ${raffleId}:`, error);
        }
    };

    /**
     * Налаштування обробників кнопок участі в розіграшах
     */
    WinixRaffles.setupParticipationButtons = function() {
        // Якщо немає модуля участі, створюємо його
        if (!this.participation) {
            this.participation = {
                participatingRaffles: new Set(),
                userRaffleTickets: {},
                invalidRaffleIds: new Set(),

                /**
                 * Додавання розіграшу до невалідних
                 * @param {string} raffleId - ID розіграшу
                 */
                addInvalidRaffleId: function(raffleId) {
                    if (raffleId && typeof raffleId === 'string') {
                        this.invalidRaffleIds.add(raffleId);
                        if (WinixRaffles.state.invalidRaffleIds) {
                            WinixRaffles.state.invalidRaffleIds.add(raffleId);
                        }
                    }
                },

                /**
                 * Очищення списку невалідних розіграшів
                 */
                clearInvalidRaffleIds: function() {
                    this.invalidRaffleIds.clear();
                    if (WinixRaffles.state.invalidRaffleIds) {
                        WinixRaffles.state.invalidRaffleIds.clear();
                    }
                },

                /**
                 * Перевірка чи розіграш валідний
                 * @param {string} raffleId - ID розіграшу
                 * @returns {boolean} Результат перевірки
                 */
                isValidRaffle: function(raffleId) {
                    if (!raffleId || typeof raffleId !== 'string') return false;

                    if (this.invalidRaffleIds.has(raffleId)) return false;
                    if (WinixRaffles.state.invalidRaffleIds && WinixRaffles.state.invalidRaffleIds.has(raffleId)) return false;

                    // Перевірка на валідність UUID
                    return WinixRaffles.validators && typeof WinixRaffles.validators.isValidUUID === 'function'
                        ? WinixRaffles.validators.isValidUUID(raffleId)
                        : true;
                },

                /**
                 * Участь в розіграші
                 * @param {string} raffleId - ID розіграшу
                 * @param {number} entryCount - Кількість жетонів для участі
                 * @returns {Promise<Object>} Результат участі
                 */
                participateInRaffle: async function(raffleId, entryCount = 1) {
                    if (!this.isValidRaffle(raffleId)) {
                        return {
                            success: false,
                            message: "Невалідний ID розіграшу"
                        };
                    }

                    // Отримуємо ID користувача
                    if (!WinixRaffles.state.telegramId) {
                        WinixRaffles.state.telegramId = WinixAPI.getUserId();
                        if (!WinixRaffles.state.telegramId) {
                            return {
                                success: false,
                                message: "ID користувача відсутній"
                            };
                        }
                    }

                    try {
                        if (typeof window.showLoading === 'function') {
                            window.showLoading();
                        }

                        // Підготовка даних запиту
                        const requestData = {
                            raffle_id: raffleId,
                            entry_count: entryCount
                        };

                        // Запит до API
                        const telegramId = WinixRaffles.state.telegramId;
                        const endpoint = `api/user/${telegramId}/participate-raffle`;

                        let response;
                        if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.apiRequest === 'function') {
                            response = await WinixAPI.apiRequest(endpoint, 'POST', requestData, {
                                timeout: 15000
                            });
                        } else {
                            const fetchResponse = await fetch(`/${endpoint}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(requestData)
                            });
                            response = await fetchResponse.json();
                        }

                        if (response && response.status === 'success' && response.data) {
                            // Оновлюємо список розіграшів, у яких бере участь користувач
                            this.participatingRaffles.add(raffleId);

                            // Оновлюємо кількість жетонів
                            const totalEntries = response.data.total_entries || response.data.entry_count || 1;
                            this.userRaffleTickets[raffleId] = totalEntries;

                            // Оновлюємо баланс жетонів
                            const newCoinsBalance = response.data.new_coins_balance || 0;
                            if (typeof window.updateCoinsDisplay === 'function') {
                                window.updateCoinsDisplay(newCoinsBalance);
                            } else {
                                // Альтернативний спосіб оновлення жетонів
                                const userCoinsElement = document.getElementById('user-coins');
                                if (userCoinsElement) {
                                    userCoinsElement.textContent = newCoinsBalance;
                                }
                            }

                            // Оновлюємо відображення кнопок
                            this.updateParticipationButtons();

                            // Повідомлення про успішну участь
                            if (typeof window.showToast === 'function') {
                                window.showToast(`Ви успішно взяли участь у розіграші! Використано ${entryCount} жетон${entryCount > 1 ? 'и' : ''}.`, 'success');
                            }

                            // Оновлюємо дані про кількість учасників на карточці розіграшу
                            const participantsCountElement = document.querySelector(`.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count`);
                            if (participantsCountElement) {
                                const currentCount = parseInt(participantsCountElement.textContent) || 0;
                                participantsCountElement.textContent = currentCount + 1;
                            }

                            return {
                                success: true,
                                data: response.data,
                                message: "Ви успішно взяли участь у розіграші"
                            };
                        } else {
                            throw new Error(response?.message || "Помилка участі в розіграші");
                        }
                    } catch (error) {
                        console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

                        // Перевіряємо, чи помилка пов'язана з недостатньою кількістю жетонів
                        const errorMessage = error.message || "";
                        if (errorMessage.toLowerCase().includes('недостатньо') ||
                            errorMessage.toLowerCase().includes('жетон')) {
                            if (typeof window.showToast === 'function') {
                                window.showToast("Недостатньо жетонів для участі в розіграші", 'error');
                            }
                        } else {
                            if (typeof window.showToast === 'function') {
                                window.showToast(errorMessage || "Помилка участі в розіграші", 'error');
                            }
                        }

                        return {
                            success: false,
                            message: errorMessage || "Помилка участі в розіграші"
                        };
                    } finally {
                        if (typeof window.hideLoading === 'function') {
                            window.hideLoading();
                        }
                    }
                },

                /**
                 * Оновлення статусу кнопок участі
                 */
                updateParticipationButtons: WinixRaffles.updateParticipationButtons
            };
        }

        try {
            // Видаляємо попередні обробники для запобігання дублювання
            document.querySelectorAll('.join-button').forEach(button => {
                // Створюємо новий клон без обробників
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
            });

            // Додаємо обробники для кнопок участі
            document.querySelectorAll('.join-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    // Запобігання дублювання кліку
                    if (button.getAttribute('data-processing') === 'true') {
                        return;
                    }

                    try {
                        // Позначаємо кнопку як таку, що обробляється
                        button.setAttribute('data-processing', 'true');
                        button.classList.add('processing');

                        // Отримуємо дані розіграшу
                        const raffleId = button.getAttribute('data-raffle-id');
                        const entryFee = parseInt(button.getAttribute('data-entry-fee') || '1');

                        if (!raffleId) {
                            if (typeof window.showToast === 'function') {
                                window.showToast("Помилка: ID розіграшу відсутній", 'error');
                            }
                            return;
                        }

                        // Перевіряємо, чи розіграш валідний
                        if (this.participation.invalidRaffleIds.has(raffleId) ||
                            this.state.invalidRaffleIds.has(raffleId)) {
                            if (typeof window.showToast === 'function') {
                                window.showToast("Розіграш вже завершено", 'warning');
                            }
                            return;
                        }

                        // Беремо участь з одним жетоном
                        const participationResult = await this.participation.participateInRaffle(raffleId, 1);

                        if (participationResult.success) {
                            // Сповіщаємо користувача (повідомлення вже показується в participateInRaffle)

                            // Оновлюємо список розіграшів, в яких бере участь користувач
                            await this.loadUserParticipation();
                        }
                    } catch (error) {
                        console.error("❌ Помилка участі в розіграші:", error);
                        if (typeof window.showToast === 'function') {
                            window.showToast("Помилка участі в розіграші", 'error');
                        }
                    } finally {
                        // Видаляємо статус обробки
                        button.removeAttribute('data-processing');
                        button.classList.remove('processing');
                    }
                });
            });
        } catch (error) {
            console.error("❌ Помилка налаштування кнопок участі:", error);
        }
    };

    /**
     * Відображення повідомлення про помилку
     * @param {string} title - Заголовок помилки
     * @param {string} message - Текст повідомлення
     */
    WinixRaffles.renderError = function(title, message) {
        try {
            // Отримуємо контейнер для розіграшів
            const container = document.getElementById('active-raffles-container');
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
            console.error("❌ Помилка відображення помилки:", error);
        }
    };

    /**
     * Безпечне оновлення значення елемента DOM
     * @param {string} elementId - ID елемента
     * @param {string|number} value - Нове значення
     * @returns {boolean} Результат оновлення
     */
    WinixRaffles.safeUpdateValue = function(elementId, value) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ Помилка оновлення елемента ${elementId}:`, error);
            return false;
        }
    };

    /**
     * Перезавантаження вкладки з розіграшами
     */
    WinixRaffles.reloadRafflesTab = function() {
        try {
            // Отримуємо активну вкладку
            const activeTab = this.state.activeTab;

            // Перезавантажуємо відповідні дані
            if (activeTab === 'active') {
                this.loadActiveRaffles(true);
            } else if (activeTab === 'history') {
                if (typeof this.loadRaffleHistory === 'function') {
                    this.loadRaffleHistory(true);
                }
            } else if (activeTab === 'statistics') {
                if (typeof this.loadStatistics === 'function') {
                    this.loadStatistics(true);
                }
            }
        } catch (error) {
            console.error("❌ Помилка перезавантаження вкладки з розіграшами:", error);
        }
    };

    // Додаємо слухачі подій для обробки помилок і автоматичного відновлення
    window.addEventListener('error', function(event) {
        console.error('Глобальна помилка JavaScript:', event.error);

        // Спробуємо відновити стан після помилки
        if (WinixRaffles) {
            if (WinixRaffles.state && WinixRaffles.state.isLoading) {
                WinixRaffles.state.isLoading = false;
            }

            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    });

    // Періодичне оновлення активних розіграшів
    let autoRefreshInterval = null;

    WinixRaffles.startAutoRefresh = function() {
        // Зупиняємо існуючий інтервал, якщо є
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }

        const refreshInterval = this.config.autoRefreshInterval || 120000; // 2 хвилини

        autoRefreshInterval = setInterval(() => {
            if (this.state.activeTab === 'active' && !this.state.isLoading) {
                // Встановлюємо флаг для пропуску індикатора завантаження
                this.skipLoader = true;
                this.loadActiveRaffles(true);
            }
        }, refreshInterval);

        console.log(`🔄 Запущено автоматичне оновлення розіграшів (інтервал: ${refreshInterval / 1000}с)`);
    };

    WinixRaffles.stopAutoRefresh = function() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            console.log("⏹️ Зупинено автоматичне оновлення розіграшів");
        }
    };

    // Забезпечення наявності функцій відображення повідомлень і індикатора завантаження
    if (typeof window.showToast !== 'function') {
        window.showToast = function(message, type = 'info') {
            const toast = document.getElementById('toast-message');
            if (!toast) {
                console.log(`[${type}] ${message}`);
                return;
            }

            toast.textContent = message;
            toast.className = 'toast-message';

            if (type === 'success') {
                toast.classList.add('success');
            } else if (type === 'error') {
                toast.classList.add('error');
            } else if (type === 'warning') {
                toast.classList.add('warning');
            }

            toast.classList.add('show');

            // Автоматично приховуємо повідомлення через 5 секунд
            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);

            // Додаємо обробник кліку для закриття
            toast.addEventListener('click', () => {
                toast.classList.remove('show');
            });
        };
    }

    if (typeof window.showLoading !== 'function') {
        window.showLoading = function() {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.style.display = 'flex';
            }
        };
    }

    if (typeof window.hideLoading !== 'function') {
        window.hideLoading = function() {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.style.display = 'none';
            }
        };
    }

    // Ініціалізуємо систему автоматичного оновлення при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', () => {
        if (WinixRaffles.state.isInitialized) {
            WinixRaffles.startAutoRefresh();
        }
    });

    // Якщо сторінка вже завантажена, запускаємо зараз
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            if (WinixRaffles.state.isInitialized) {
                WinixRaffles.startAutoRefresh();
            }
        }, 1000);
    }

    console.log('✅ Система розіграшів WINIX успішно оновлена');
})();