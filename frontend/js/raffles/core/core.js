/**
 * WINIX - Система розіграшів (core.js)
 * Оптимізована версія з виправленою проблемою списання жетонів
 * @version 1.5.0
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

    // Приватні змінні для контролю продуктивності
    let _lastLoadTime = 0;
    let _loadingLock = false;
    let _globalRefreshInterval = null;
    let _globalCountdownTimer = null;
    let _buttonsInitialized = false;
    let _particlesCreated = false;

    // Змінна для обмеження запитів
    let _lastRequestTime = Date.now();
    const MIN_REQUEST_INTERVAL = 10000; // 10 секунд між запитами

    // Функція для відкладеного виконання (debounce)
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
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
    console.log("👉 core.js: loadActiveRaffles викликано");

    // Якщо модуль active доступний, використовуємо його метод
    if (this.active && typeof this.active.loadActiveRaffles === 'function') {
        console.log("👉 Делегуємо завантаження до WinixRaffles.active.loadActiveRaffles");
        return await this.active.loadActiveRaffles(forceRefresh);
    }

    // Швидке відображення кешованих даних перед запитом
    if (this.state.activeRaffles.length > 0 && !forceRefresh) {
        this.renderActiveRaffles();
    }

    // Запобігаємо паралельним запитам (мінімальна перевірка)
    if (this.state.isLoading && !forceRefresh) {
        console.log("⏳ Завантаження розіграшів вже виконується");

        // Якщо у нас є дані, повертаємо кеш замість помилки
        if (this.state.activeRaffles.length > 0) {
            console.log("⚠️ Використовуємо кешовані дані розіграшів (запит вже виконується)");
            return {
                success: true,
                source: 'cache_parallel',
                data: this.state.activeRaffles,
                message: "Використано кешовані дані (запит вже виконується)"
            };
        }

        return { success: false, message: "Завантаження вже виконується" };
    }

    // Перевірка на мінімальний інтервал між запитами
    const now = Date.now();
    const timeSinceLastLoad = now - _lastLoadTime;
    if (!forceRefresh && timeSinceLastLoad < 3000 && this.state.activeRaffles.length > 0) {
        console.log(`⏳ Занадто частий запит (минуло ${Math.floor(timeSinceLastLoad/1000)}с), використовуємо кеш`);
        return {
            success: true,
            source: 'cache_throttle',
            data: this.state.activeRaffles,
            message: "Використано кешовані дані (обмеження частоти)"
        };
    }

    this.state.isLoading = true;

    // ВИПРАВЛЕНО: Перевірка існування функції showLoading перед викликом
    const showLoader = !this.skipLoader &&
        (this.state.activeRaffles.length === 0 || forceRefresh);

    if (showLoader && typeof window.showLoading === 'function') {
        window.showLoading();
    }

    try {
        console.log("🔄 Розпочато завантаження активних розіграшів");

        // Формуємо URL запиту з параметрами
        const queryParams = new URLSearchParams({
            limit: limit,
            offset: offset,
            t: now // Запобігання кешуванню
        });

        // Отримуємо дані з сервера за допомогою API
        let response;
        const apiEndpoint = `${this.config.activeRafflesEndpoint}?${queryParams.toString()}`;

        if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.apiRequest === 'function') {
            response = await WinixAPI.apiRequest(apiEndpoint, 'GET', null, {
                timeout: 15000, // Збільшений таймаут
                suppressErrors: true, // Обробляємо помилки тут
                retries: 2, // Дозволяємо 2 повторні спроби
                bypassThrottle: forceRefresh // Обхід обмежень при примусовому оновленні
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

            // Позначаємо розіграші, в яких користувач бере участь (асинхронно)
            // Додаємо затримку для запобігання занадто частим запитам
            setTimeout(() => {
                this.loadUserParticipation().catch(err => {
                    console.warn("⚠️ Не вдалося завантажити дані участі:", err);
                });
            }, 1000);

            // Оновлюємо відображення
            this.renderActiveRaffles();

            console.log(`✅ Успішно завантажено ${this.state.activeRaffles.length} активних розіграшів`);

            // Якщо є модуль participation, оновлюємо статус
            if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
                this.participation.updateParticipationButtons();
            }

            // Оновлюємо час останнього завантаження
            _lastLoadTime = now;

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
            // ВИПРАВЛЕНО: Використовуємо response замість неіснуючої змінної
            throw new Error(response?.message || 'Не вдалося завантажити активні розіграші');
        }
    } catch (error) {
        console.error('❌ Помилка завантаження активних розіграшів:', error);

        // Якщо є кешовані дані, використовуємо їх
        if (this.state.activeRaffles.length > 0) {
            console.log("⚠️ Використовуємо кешовані дані розіграшів");
            return {
                success: true,
                source: 'cache',
                data: this.state.activeRaffles,
                message: "Використано кешовані дані розіграшів"
            };
        }

        // Відображаємо повідомлення про помилку, якщо немає кешованих даних
        this.renderError('Не вдалося завантажити розіграші', 'Спробуйте оновити сторінку');

        return {
            success: false,
            message: error.message || 'Помилка завантаження розіграшів'
        };
    } finally {
        // Завершуємо процес завантаження
        this.state.isLoading = false;

        // ВИПРАВЛЕНО: Перевірка існування функції hideLoading перед викликом
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
                    bypassThrottle: true, // Пропускаємо обмеження швидкості
                    hideLoader: true, // Не показуємо індикатор завантаження
                    allowParallel: true // Дозволяємо паралельне виконання
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
                        invalidRaffleIds: new Set(),
                        lastParticipationTime: 0 // Додаємо трекінг часу останньої участі
                    };
                } else if (!this.participation.participatingRaffles) {
                    this.participation.participatingRaffles = new Set();
                    this.participation.userRaffleTickets = {};
                    this.participation.lastParticipationTime = 0;
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

                // Оновлюємо кнопки участі негайно
                if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
                    this.participation.updateParticipationButtons();
                }

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
                invalidRaffleIds: new Set(),
                lastParticipationTime: 0
            };
        } else if (!this.participation.participatingRaffles) {
            this.participation.participatingRaffles = new Set();
            this.participation.userRaffleTickets = {};
            this.participation.lastParticipationTime = 0;
        }

        try {
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
                    participatingMap[raffleId] = this.participation.participatingRaffles.has(raffleId);
                }

                if (invalidMap[raffleId] === undefined) {
                    invalidMap[raffleId] = (this.participation.invalidRaffleIds && this.participation.invalidRaffleIds.has(raffleId)) ||
                                          (this.state.invalidRaffleIds && this.state.invalidRaffleIds.has(raffleId));
                }
            });

            // Оновлюємо всі кнопки за один прохід
            buttons.forEach(button => {
                const raffleId = button.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                if (participatingMap[raffleId]) {
                    const ticketCount = this.participation.userRaffleTickets ?
                                      (this.participation.userRaffleTickets[raffleId] || 1) : 1;

                    // Оновлюємо текст кнопки лише якщо він не був оновлений раніше (для оптимізації DOM)
                    if (!button.classList.contains('participating')) {
                        const isMini = button.classList.contains('mini-raffle-button');
                        button.textContent = isMini ?
                            `Додати ще білет (${ticketCount})` :
                            `Додати ще білет (у вас: ${ticketCount})`;

                        // Змінюємо клас, але не додаємо disabled
                        button.classList.add('participating');
                        button.disabled = false;

                        // Видаляємо статус обробки, якщо він був
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

            // Використовуємо DocumentFragment для оптимізації відображення
            const fragment = document.createDocumentFragment();

            // Рендеримо кожен розіграш
            this.state.activeRaffles.forEach(raffle => {
                const isDaily = raffle.is_daily || false;

                // Створюємо елемент розіграшу
                const raffleElement = document.createElement('div');
                raffleElement.className = isDaily ? 'raffle-card daily-raffle' : 'raffle-card main-raffle';
                raffleElement.dataset.raffleId = raffle.id;
                raffleElement.dataset.isDaily = isDaily;

                // Заповнюємо HTML-контент
                raffleElement.innerHTML = this.createRaffleCardHtml(raffle, isDaily);

                // Додаємо до фрагменту
                fragment.appendChild(raffleElement);
            });

            // Додаємо всі елементи одним разом
            container.innerHTML = '';
            container.appendChild(fragment);

            // Налаштовуємо таймери для відображення часу
            setTimeout(() => {
                this.initializeCountdownTimers();
            }, 100);

            // Оновлюємо кнопки участі негайно
            if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
                setTimeout(() => {
                    this.participation.updateParticipationButtons();
                }, 200);
            }

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
        </div>`;
    };

    /**
     * Ініціалізація таймерів розіграшів
     * ОПТИМІЗОВАНО: значно спрощено, відображає лише залишок часу без анімації
     */
    WinixRaffles.initializeCountdownTimers = function() {
        try {
            // Спочатку зупиняємо всі попередні таймери
            if (_globalCountdownTimer) {
                clearInterval(_globalCountdownTimer);
                _globalCountdownTimer = null;
            }

            // Створюємо масив з датами закінчення для всіх розіграшів
            const rafflesWithTimers = this.state.activeRaffles
                .filter(raffle => raffle.end_time)
                .map(raffle => ({
                    id: raffle.id,
                    endTime: new Date(raffle.end_time)
                }));

            if (rafflesWithTimers.length === 0) return;

            // Встановлюємо лише початкові значення для таймерів без запуску анімації
            rafflesWithTimers.forEach(raffle => {
                const timeLeft = raffle.endTime.getTime() - new Date().getTime();

                // Ігноруємо, якщо розіграш уже закінчився
                if (timeLeft <= 0) {
                    this.state.invalidRaffleIds.add(raffle.id);
                    if (this.participation && this.participation.invalidRaffleIds) {
                        this.participation.invalidRaffleIds.add(raffle.id);
                    }
                    return;
                }

                // Встановлюємо статичні значення без таймера оновлення
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                // Оновлюємо елементи таймера, тільки якщо вони існують
                const daysElement = document.getElementById(`days-${raffle.id}`);
                const hoursElement = document.getElementById(`hours-${raffle.id}`);
                const minutesElement = document.getElementById(`minutes-${raffle.id}`);
                const secondsElement = document.getElementById(`seconds-${raffle.id}`);

                if (daysElement) daysElement.textContent = days.toString().padStart(2, '0');
                if (hoursElement) hoursElement.textContent = hours.toString().padStart(2, '0');
                if (minutesElement) minutesElement.textContent = minutes.toString().padStart(2, '0');
                if (secondsElement) secondsElement.textContent = seconds.toString().padStart(2, '0');
            });

            // Створюємо один спільний таймер для всіх елементів
            _globalCountdownTimer = setInterval(() => {
                rafflesWithTimers.forEach(raffle => {
                    const timeLeft = raffle.endTime.getTime() - new Date().getTime();

                    // Перевіряємо, чи розіграш завершився
                    if (timeLeft <= 0) {
                        // Додаємо до невалідних
                        this.state.invalidRaffleIds.add(raffle.id);
                        if (this.participation && this.participation.invalidRaffleIds) {
                            this.participation.invalidRaffleIds.add(raffle.id);
                        }

                        // Оновлюємо кнопки участі
                        if (this.participation && typeof this.participation.updateParticipationButtons === 'function') {
                            this.participation.updateParticipationButtons();
                        }

                        // Встановлюємо нулі в таймері
                        const daysElement = document.getElementById(`days-${raffle.id}`);
                        const hoursElement = document.getElementById(`hours-${raffle.id}`);
                        const minutesElement = document.getElementById(`minutes-${raffle.id}`);
                        const secondsElement = document.getElementById(`seconds-${raffle.id}`);

                        if (daysElement) daysElement.textContent = '00';
                        if (hoursElement) hoursElement.textContent = '00';
                        if (minutesElement) minutesElement.textContent = '00';
                        if (secondsElement) secondsElement.textContent = '00';
                        return;
                    }

                    // Обчислюємо значення часу
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                    // Оновлюємо тільки секунди для економії ресурсів
                    const secondsElement = document.getElementById(`seconds-${raffle.id}`);
                    if (secondsElement) secondsElement.textContent = seconds.toString().padStart(2, '0');

                    // Оновлюємо інші елементи тільки при зміні значень
                    if (seconds === 59) {
                        const minutesElement = document.getElementById(`minutes-${raffle.id}`);
                        if (minutesElement) minutesElement.textContent = minutes.toString().padStart(2, '0');

                        if (minutes === 59) {
                            const hoursElement = document.getElementById(`hours-${raffle.id}`);
                            if (hoursElement) hoursElement.textContent = hours.toString().padStart(2, '0');

                            if (hours === 23) {
                                const daysElement = document.getElementById(`days-${raffle.id}`);
                                if (daysElement) daysElement.textContent = days.toString().padStart(2, '0');
                            }
                        }
                    }
                });
            }, 1000);

            console.log("⏱️ Запущено оптимізований таймер зворотного відліку");

        } catch (error) {
            console.error("❌ Помилка ініціалізації таймерів:", error);
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
                // Оновлюємо значення лише якщо воно змінилося
                if (element.textContent !== String(value)) {
                    element.textContent = value;
                }
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ Помилка оновлення елемента ${elementId}:`, error);
            return false;
        }
    };

    /**
     * Налаштування обробників кнопок участі в розіграшах
     * ОПТИМІЗОВАНО: використання делегування подій замість обробників для кожної кнопки
     */
    WinixRaffles.setupParticipationButtons = function() {
        try {
            // Запобігаємо повторній ініціалізації
            if (_buttonsInitialized) return;

            // Ініціалізуємо модуль участі, якщо потрібно
            if (!this.participation) {
                this.participation = {
                    participatingRaffles: new Set(),
                    userRaffleTickets: {},
                    invalidRaffleIds: new Set(),
                    lastParticipationTime: 0,
                    requestInProgress: false, // ВИПРАВЛЕНО: Додали флаг запиту

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
                     * @param {string} raffleType - Тип розіграшу (daily/main)
                     * @param {number} entryCount - Кількість білетів для участі
                     * @returns {Promise<Object>} Результат участі
                     */
participateInRaffle: async function(raffleId, raffleType, entryCount = 1) {
    // ВИПРАВЛЕНО: Перевірка валідності UUID
    if (!this.isValidUUID || !this.isValidUUID(raffleId)) {
        return {
            success: false,
            message: "Невалідний ID розіграшу"
        };
    }

    // Перевірка на вже запущений запит
    if (this.requestInProgress) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastParticipationTime;
        if (timeSinceLastRequest > 10000) { // Якщо запит висить більше 10 секунд, скидаємо блокування
            console.warn("⚠️ Виявлено застряглий запит, скидаємо блокування");
            this.requestInProgress = false;
        } else {
            return {
                success: false,
                message: "Зачекайте, попередній запит ще обробляється"
            };
        }
    }

    // Отримуємо ID користувача
    const telegramId = WinixRaffles.state.telegramId || (WinixAPI ? WinixAPI.getUserId() : null);
    if (!telegramId) {
        return {
            success: false,
            message: "ID користувача відсутній"
        };
    }

    // ВИПРАВЛЕНО: Перевірка стану участі у розіграші
    const alreadyParticipating = this.participatingRaffles && this.participatingRaffles.has(raffleId);

    // ВИПРАВЛЕНО: Отримуємо поточну кількість білетів
    const currentTickets = (this.userRaffleTickets && this.userRaffleTickets[raffleId]) || 0;

    // Встановлюємо блокування запиту
    this.requestInProgress = true;
    this.lastParticipationTime = Date.now();

    try {
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        // ВИПРАВЛЕНО: Отримуємо доступний баланс перед запитом
        let coinsBalance = 0;
        try {
            // Спочатку спробуємо отримати баланс з елемента
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                coinsBalance = parseInt(userCoinsElement.textContent) || 0;
            } else {
                // Якщо елемент відсутній, спробуємо отримати з localStorage
                coinsBalance = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
            }
        } catch (e) {
            console.warn('⚠️ Не вдалося отримати поточний баланс:', e);
        }

        // Підготовка даних запиту з додатковими полями
        const requestData = {
            raffle_id: raffleId,
            entry_count: entryCount,
            _client_time: Date.now(),
            _transaction_id: 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15),
            _current_tickets: currentTickets, // Передаємо поточну кількість білетів
            _already_participating: alreadyParticipating // Передаємо інформацію про участь
        };

        // Запит до API
        const endpoint = `api/user/${telegramId}/participate-raffle`;

        let response;
        if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.apiRequest === 'function') {
            response = await WinixAPI.apiRequest(endpoint, 'POST', requestData);
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

        if (response && response.status === 'success') {
            // ВИПРАВЛЕНО: Додаємо розіграш до множини з участю
            this.participatingRaffles.add(raffleId);

            // ВИПРАВЛЕНО: Використовуємо значення від сервера, якщо доступне
            let totalEntries;
            if (response.data && response.data.total_entries) {
                totalEntries = response.data.total_entries;
            } else if (response.data && response.data.entry_count) {
                totalEntries = response.data.entry_count;
            } else {
                totalEntries = currentTickets + entryCount;
            }

            // Оновлюємо кількість білетів
            this.userRaffleTickets[raffleId] = totalEntries;

            // ВИПРАВЛЕНО: Оновлюємо баланс жетонів
            const newCoinsBalance = response.data && response.data.new_coins_balance;
            if (typeof newCoinsBalance === 'number') {
                // Оновлюємо відображення балансу
                const userCoinsElement = document.getElementById('user-coins');
                if (userCoinsElement) {
                    // Додаємо анімацію зменшення
                    userCoinsElement.classList.add('decreasing');
                    setTimeout(() => {
                        userCoinsElement.classList.remove('decreasing');
                    }, 1000);

                    userCoinsElement.textContent = newCoinsBalance;
                }

                // Оновлюємо localStorage
                localStorage.setItem('userCoins', newCoinsBalance.toString());
                localStorage.setItem('winix_coins', newCoinsBalance.toString());

                // Відправляємо подію про оновлення даних користувача
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: {
                        userData: {
                            coins: newCoinsBalance,
                            server_synchronized: true,
                            timestamp: Date.now()
                        },
                        source: 'core.js'
                    }
                }));
            } else {
                console.warn("⚠️ Сервер не повернув оновлений баланс жетонів");

                // Примусово оновлюємо баланс через API
                setTimeout(() => {
                    if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.getBalance === 'function') {
                        WinixAPI.getBalance().then(response => {
                            if (response && response.status === 'success' && response.data) {
                                const newCoins = response.data.coins;

                                // Оновлюємо відображення балансу
                                const userCoinsElement = document.getElementById('user-coins');
                                if (userCoinsElement) {
                                    userCoinsElement.textContent = newCoins;
                                }

                                // Оновлюємо localStorage
                                localStorage.setItem('userCoins', newCoins.toString());
                                localStorage.setItem('winix_coins', newCoins.toString());
                            }
                        }).catch(e => {
                            console.warn('⚠️ Помилка оновлення балансу:', e);
                        });
                    }
                }, 1000);
            }

            // Оновлюємо відображення кнопок
            if (typeof this.updateParticipationButtons === 'function') {
                this.updateParticipationButtons();
            }

            // Відправляємо подію про успішну участь
            document.dispatchEvent(new CustomEvent('raffle-participation', {
                detail: {
                    successful: true,
                    raffleId: raffleId,
                    ticketCount: totalEntries
                }
            }));

            return {
                success: true,
                data: {
                    ...response.data,
                    total_entries: totalEntries
                },
                message: response.data?.message || "Ви успішно взяли участь у розіграші"
            };
        } else {
            throw new Error(response?.message || "Помилка участі в розіграші");
        }
    } catch (error) {
        console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

        // Показуємо користувачу повідомлення про помилку
        if (typeof window.showToast === 'function') {
            window.showToast(error.message || "Помилка участі в розіграші", 'error');
        }

        return {
            success: false,
            message: error.message || "Помилка участі в розіграші"
        };
    } finally {
        // ВИПРАВЛЕНО: Завжди знімаємо блокування запиту
        this.requestInProgress = false;

        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    }
},

                    /**
                     * Оновлення статусу кнопок участі
                     */
                    updateParticipationButtons: WinixRaffles.updateParticipationButtons,

                    /**
                     * Перевірка валідності UUID
                     */
                    isValidUUID: function(id) {
                        if (!id || typeof id !== 'string') return false;
                        const fullUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                        return fullUUIDRegex.test(id);
                    }
                };
            }

            // Отримуємо контейнер з розіграшами
            const container = document.getElementById('active-raffles-container');
            if (!container) return;

            // Використовуємо делегування подій замість обробників для кожної кнопки
            container.addEventListener('click', (event) => {
                const button = event.target.closest('.join-button, .mini-raffle-button');
                if (!button) return;

                // Запобігаємо повторним клікам
                if (button.getAttribute('data-processing') === 'true' || button.disabled) return;

                // Отримуємо дані розіграшу
                const raffleId = button.getAttribute('data-raffle-id');
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

                // ВИПРАВЛЕНО: Перевірка стану participation
                if (this.participation.requestInProgress) {
                    if (typeof window.showToast === 'function') {
                        window.showToast("Зачекайте завершення попереднього запиту", 'warning');
                    }
                    return;
                }

                // Отримуємо вартість участі
                const entryFee = parseInt(button.getAttribute('data-entry-fee')) || 1;

                // ВИПРАВЛЕНО: Перевірка на достатність жетонів перед списанням
                let currentCoins = 0;
                const userCoinsElement = document.getElementById('user-coins');
                if (userCoinsElement) {
                    currentCoins = parseInt(userCoinsElement.textContent) || 0;
                } else {
                    currentCoins = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
                }

                if (currentCoins < entryFee) {
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${currentCoins}`, 'warning');
                    }
                    return;
                }

                // Помічаємо кнопку як таку, що обробляється і блокуємо її
                button.setAttribute('data-processing', 'true');
                button.classList.add('processing');
                button.disabled = true;

                // Зберігаємо оригінальний текст кнопки
                if (!button.getAttribute('data-original-text')) {
                    button.setAttribute('data-original-text', button.textContent);
                }
                button.textContent = 'Обробка...';

                // Беремо участь у розіграші
                this.participation.participateInRaffle(raffleId, button.classList.contains('mini-raffle-button') ? 'daily' : 'main', 1)
                    .then(result => {
                        if (result.success) {
                            // Асинхронне оновлення списку розіграшів, в яких бере участь користувач
                            setTimeout(() => {
                                this.loadUserParticipation().catch(err => {
                                    console.warn("⚠️ Помилка оновлення даних участі:", err);
                                });
                            }, 3000); // Відкладаємо на 3 секунди
                        }
                    })
                    .catch(err => {
                        console.error("❌ Помилка участі в розіграші:", err);
                        if (typeof window.showToast === 'function') {
                            window.showToast("Помилка участі в розіграші", 'error');
                        }
                    })
                    .finally(() => {
                        // Видаляємо статус обробки
                        button.removeAttribute('data-processing');
                        button.classList.remove('processing');

                        // Розблоковуємо кнопку тільки якщо це не був успішний запит участі
                        // Для успішної участі кнопку оновить updateParticipationButtons()
                        if (!this.participation.participatingRaffles.has(raffleId)) {
                            button.disabled = false;

                            // Відновлюємо оригінальний текст кнопки
                            const originalText = button.getAttribute('data-original-text');
                            if (originalText) {
                                button.textContent = originalText;
                            }
                        }
                    });
            });

            _buttonsInitialized = true;
            console.log("✅ Обробники кнопок участі налаштовано");
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
            console.error("❌ Помилка відображення повідомлення про помилку:", error);
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
                } else if (this.history && typeof this.history.loadRaffleHistory === 'function') {
                    this.history.loadRaffleHistory(true);
                }
            } else if (activeTab === 'statistics' || activeTab === 'stats') {
                if (typeof this.loadStatistics === 'function') {
                    this.loadStatistics(true);
                } else if (this.statistics && typeof this.statistics.loadStatistics === 'function') {
                    this.statistics.loadStatistics(true);
                }
            }
        } catch (error) {
            console.error("❌ Помилка перезавантаження вкладки з розіграшами:", error);
        }
    };

    /**
     * Запуск автоматичного оновлення активних розіграшів
     * ОПТИМІЗОВАНО: збільшено інтервал та додано перевірки для запобігання частим запитам
     */
    WinixRaffles.startAutoRefresh = function() {
        // Зупиняємо існуючий інтервал, якщо є
        if (_globalRefreshInterval) {
            clearInterval(_globalRefreshInterval);
            _globalRefreshInterval = null;
        }

        // Збільшуємо інтервал автооновлення до 3 хвилин (180 секунд)
        const refreshInterval = 180000;

        _globalRefreshInterval = setInterval(() => {
            // Перевіряємо наступні умови перед оновленням:
            // 1. Не відбувається завантаження
            // 2. Пристрій онлайн
            // 3. Минуло щонайменше 30 секунд після останнього оновлення
            // 4. Активна вкладка - активні розіграші
            if (!this.state.isLoading &&
                navigator.onLine !== false &&
                Date.now() - _lastLoadTime > 30000 &&
                this.state.activeTab === 'active') {

                // Встановлюємо флаг для пропуску індикатора завантаження
                this.skipLoader = true;

                // Оновлюємо розіграші без форсування (використовує кеш, якщо минуло мало часу)
                this.loadActiveRaffles(false).catch(err => {
                    console.warn("⚠️ Помилка автооновлення активних розіграшів:", err);
                });
            }
        }, refreshInterval);

        console.log(`🔄 Запущено автоматичне оновлення розіграшів (інтервал: ${refreshInterval / 1000}с)`);
    };

    /**
     * Зупинка автоматичного оновлення
     */
    WinixRaffles.stopAutoRefresh = function() {
        if (_globalRefreshInterval) {
            clearInterval(_globalRefreshInterval);
            _globalRefreshInterval = null;
            console.log("⏹️ Зупинено автоматичне оновлення розіграшів");
        }
    };

    /**
     * Очищення всіх таймерів і ресурсів
     * Новий метод для запобігання витоків пам'яті
     */
    WinixRaffles.cleanup = function() {
        // Зупиняємо таймер автооновлення
        if (_globalRefreshInterval) {
            clearInterval(_globalRefreshInterval);
            _globalRefreshInterval = null;
        }

        // Зупиняємо таймер зворотного відліку
        if (_globalCountdownTimer) {
            clearInterval(_globalCountdownTimer);
            _globalCountdownTimer = null;
        }

        // Скидаємо прапорці
        _buttonsInitialized = false;
        _particlesCreated = false;
        _loadingLock = false;

        console.log("🧹 Всі ресурси системи розіграшів очищено");
    };

    // ВИПРАВЛЕНО: Скидання стану participation при завантаженні модуля
    if (WinixRaffles.participation) {
        WinixRaffles.participation.requestInProgress = false;
        WinixRaffles.participation.lastParticipationTime = 0;
        console.log("🔄 Скинуто стан participation при завантаженні raffles/core.js");
    }

    // Додаємо слухачі подій для обробки помилок і автоматичного відновлення
    window.addEventListener('error', function(event) {
        console.error('Глобальна помилка JavaScript:', event.error);

        // Спробуємо відновити стан після помилки
        if (WinixRaffles) {
            if (WinixRaffles.state && WinixRaffles.state.isLoading) {
                WinixRaffles.state.isLoading = false;
                _loadingLock = false;
            }

            // ВИПРАВЛЕНО: Скидаємо стан participation при помилці
            if (WinixRaffles.participation) {
                WinixRaffles.participation.requestInProgress = false;
            }

            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    });

    // Додаємо обробник для зупинки автооновлення при закритті вкладки
    window.addEventListener('beforeunload', function() {
        if (WinixRaffles && typeof WinixRaffles.cleanup === 'function') {
            WinixRaffles.cleanup();
        }
    });

    // Додаємо обробник для оптимізації роботи на мобільних пристроях
    window.addEventListener('resize', debounce(function() {
        // Скидаємо прапорець для створення частинок при зміні розміру екрану
        _particlesCreated = false;

        // Оновлюємо анімації, якщо вони є
        if (WinixRaffles.animations && typeof WinixRaffles.animations.createParticles === 'function') {
            WinixRaffles.animations.createParticles();
        }
    }, 500));

    // Додаємо обробник події зміни стану мережі
    window.addEventListener('online', function() {
        // Автоматичне оновлення після відновлення з'єднання
        if (WinixRaffles && !WinixRaffles.state.isLoading) {
            setTimeout(() => {
                WinixRaffles.reloadRafflesTab();
            }, 2000);
        }
    });

    // ВИПРАВЛЕНО: Додаємо обробник, який перевіряє стан participation при візуалізації сторінки
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // При поверненні на вкладку перевіряємо стан participation
            if (WinixRaffles && WinixRaffles.participation && WinixRaffles.participation.requestInProgress) {
                const now = Date.now();
                const timeSinceLastRequest = now - (WinixRaffles.participation.lastParticipationTime || 0);

                // Якщо запит "завис" більше 10 секунд, скидаємо його
                if (timeSinceLastRequest > 10000) {
                    console.warn("⚠️ Виявлено активний запит participation при поверненні на вкладку, скидаємо");
                    WinixRaffles.participation.requestInProgress = false;
                }
            }
        }
    });

    /**
     * Очищення кешу невалідних розіграшів
     */
    WinixRaffles.clearInvalidRaffleIds = function() {
        // Очищаємо колекцію невалідних ID
        if (this.state && this.state.invalidRaffleIds) {
            this.state.invalidRaffleIds.clear();
        }

        if (this.participation && this.participation.invalidRaffleIds) {
            this.participation.invalidRaffleIds.clear();
        }

        // Очищаємо кеш активних розіграшів
        try {
            localStorage.removeItem('winix_active_raffles');
            console.log('🧹 Очищено кеш активних розіграшів');
        } catch (e) {
            console.warn('⚠️ Не вдалося очистити кеш розіграшів:', e);
        }

        console.log('🧹 Очищено колекції невалідних ID розіграшів');

        // Оновлюємо список розіграшів, якщо потрібно
        if (this.active && typeof this.active.loadActiveRaffles === 'function') {
            console.log('🔄 Повторне завантаження розіграшів після очищення кешу');
            this.active.loadActiveRaffles(true);
        }
    };

    /**
     * Отримання балансу користувача з API
     * @returns {Promise<Object>} Відповідь від API
     */
    WinixRaffles.refreshUserBalance = async function() {
        try {
            if (typeof WinixAPI !== 'undefined' && typeof WinixAPI.getBalance === 'function') {
                console.log('🔄 Запит на оновлення балансу користувача');

                const response = await WinixAPI.getBalance();

                if (response && response.status === 'success' && response.data) {
                    const newCoins = response.data.coins;

                    // Оновлюємо відображення балансу
                    const userCoinsElement = document.getElementById('user-coins');
                    if (userCoinsElement) {
                        userCoinsElement.textContent = newCoins;
                    }

                    // Оновлюємо localStorage
                    localStorage.setItem('userCoins', newCoins.toString());
                    localStorage.setItem('winix_coins', newCoins.toString());

                    console.log('✅ Баланс користувача оновлено:', newCoins);

                    return {
                        success: true,
                        coins: newCoins
                    };
                } else {
                    throw new Error('Не вдалося отримати баланс');
                }
            } else {
                throw new Error('API для отримання балансу недоступне');
            }
        } catch (error) {
            console.error('❌ Помилка оновлення балансу:', error);
            return {
                success: false,
                message: error.message || 'Не вдалося оновити баланс'
            };
        }
    };

    // Глобальний обробник необроблених Promise-помилок
    window.addEventListener('unhandledrejection', function(event) {
        console.error('❌ Необроблена Promise-помилка:', event.reason);

        // Скидаємо стан спінера
        if (typeof window.resetLoadingState === 'function') {
            window.resetLoadingState();
        }

        // ВИПРАВЛЕНО: Скидаємо стан запиту участі, якщо він активний
        if (window.WinixRaffles && window.WinixRaffles.participation) {
            if (window.WinixRaffles.participation.requestInProgress) {
                window.WinixRaffles.participation.requestInProgress = false;
                console.warn("⚠️ Скинуто стан requestInProgress через необроблену помилку Promise");

                // Очищаємо статус обробки всіх кнопок
                const buttons = document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing');
                buttons.forEach(button => {
                    button.classList.remove('processing');
                    button.disabled = false;

                    // Відновлюємо оригінальний текст
                    const originalText = button.getAttribute('data-original-text');
                    if (originalText) {
                        button.textContent = originalText;
                    } else {
                        // Якщо немає оригінального тексту, повертаємо стандартний
                        const isMini = button.classList.contains('mini-raffle-button');
                        const entryFee = button.getAttribute('data-entry-fee') || '1';
                        button.textContent = isMini
                            ? 'Взяти участь'
                            : `Взяти участь за ${entryFee} жетони`;
                    }
                });
            }
        }

        // Показуємо повідомлення про помилку
        if (typeof window.showToast === 'function') {
            let errorMessage = 'Сталася помилка';

            // Визначаємо текст помилки
            if (event.reason) {
                if (typeof event.reason === 'string') {
                    errorMessage = event.reason;
                } else if (event.reason.message) {
                    errorMessage = event.reason.message;
                }
            }

            // Показуємо повідомлення
            window.showToast(errorMessage, 'error');
        }
    });

    console.log('✅ Модуль raffles/core.js успішно завантажено та оновлено');
})();