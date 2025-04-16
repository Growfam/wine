/**
 * WINIX - Система розіграшів (core.js)
 * Оптимізована версія з покращеною обробкою помилок, захистом від зависання та оптимізацією продуктивності
 * @version 1.4.2
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

    // Показуємо індикатор завантаження лише якщо немає даних або це примусове оновлення
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

                        // Перевірка часу останньої участі (мінімум 5 секунд між спробами)
                        const now = Date.now();
                        if (now - this.lastParticipationTime < 5000) {
                            return {
                                success: false,
                                message: "Надто часта спроба участі, зачекайте"
                            };
                        }

                        // Оновлюємо час останньої участі
                        this.lastParticipationTime = now;

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
                                    timeout: 15000,
                                    bypassThrottle: true // Важливо обійти обмеження для участі
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

                // Помічаємо кнопку як таку, що обробляється і блокуємо її
                button.setAttribute('data-processing', 'true');
                button.classList.add('processing');
                button.disabled = true;

                // Беремо участь у розіграші
                this.participation.participateInRaffle(raffleId, 1)
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

    // Додаємо слухачі подій для обробки помилок і автоматичного відновлення
    window.addEventListener('error', function(event) {
        console.error('Глобальна помилка JavaScript:', event.error);

        // Спробуємо відновити стан після помилки
        if (WinixRaffles) {
            if (WinixRaffles.state && WinixRaffles.state.isLoading) {
                WinixRaffles.state.isLoading = false;
                _loadingLock = false;
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
        } else {
            // Додаємо обробник для ініціалізації після завантаження модуля
            document.addEventListener('winix-raffles-initialized', () => {
                WinixRaffles.startAutoRefresh();
            }, { once: true });
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