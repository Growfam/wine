/**
 * daily-bonus.js - Обробник щоденних бонусів
 * Відповідальний за отримання та управління щоденними бонусами
 * Оптимізовано для стабільної роботи з API та консистентного досвіду користувача
 */

window.DailyBonus = (function() {
    // Конфігурація модуля
    const config = {
        cacheDuration: 300000,   // 5 хвилин кеш
        debug: false,            // Режим відлагодження
        apiTimeout: 15000,       // 15 секунд таймаут для запитів
        maxRetryAttempts: 2,     // Максимальна кількість повторних спроб
        retryDelay: 1000         // Затримка між повторними спробами (мс)
    };

    // Стан модуля
    const state = {
        isInitialized: false,
        bonusData: null,
        lastLoaded: 0,
        isLoading: false,
        failureCount: 0,
        userId: null,
        pendingOperation: false,  // Прапорець очікування результату операції
        lastError: null           // Останнє повідомлення про помилку
    };

    // Шляхи API
    const API_PATHS = {
        STATUS: (userId) => `api/user/${userId}/daily-bonus`,
        CLAIM: (userId) => `api/user/${userId}/claim-daily-bonus`,
        STREAK: (userId) => `api/user/${userId}/claim-streak-bonus`
    };

    /**
     * Отримання ID користувача з різних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // Перевіряємо, чи ID вже кешовано
        if (state.userId) {
            return state.userId;
        }

        // Функція для перевірки валідності ID
        function isValidId(id) {
            return id &&
                  typeof id === 'string' &&
                  id !== 'undefined' &&
                  id !== 'null' &&
                  id.length > 3;
        }

        // Масив функцій для отримання ID з різних джерел
        const idProviders = [
            // 1. Глобальна змінна USER_ID
            () => {
                if (window.USER_ID) {
                    if (config.debug) console.log("DailyBonus: ID користувача отримано з window.USER_ID");
                    return window.USER_ID;
                }
                return null;
            },

            // 2. Telegram WebApp
            () => {
                if (window.Telegram && window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user) {
                    const id = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                    if (config.debug) console.log("DailyBonus: ID користувача отримано з Telegram WebApp");
                    return id;
                }
                return null;
            },

            // 3. Telegram WebView Proxy
            () => {
                if (window.telegramWebviewProxy &&
                    window.telegramWebviewProxy.initDataUnsafe &&
                    window.telegramWebviewProxy.initDataUnsafe.user) {
                    const id = window.telegramWebviewProxy.initDataUnsafe.user.id.toString();
                    if (config.debug) console.log("DailyBonus: ID користувача отримано з telegramWebviewProxy");
                    return id;
                }
                return null;
            },

            // 4. User data з localStorage
            () => {
                try {
                    const userData = localStorage.getItem('user_data');
                    if (userData) {
                        const parsed = JSON.parse(userData);
                        if (parsed && parsed.telegram_id) {
                            if (config.debug) console.log("DailyBonus: ID користувача отримано з user_data в localStorage");
                            return parsed.telegram_id.toString();
                        }
                    }
                } catch (e) {}
                return null;
            },

            // 5. Telegram ID з localStorage
            () => {
                try {
                    const id = localStorage.getItem('telegram_user_id');
                    if (isValidId(id)) {
                        if (config.debug) console.log("DailyBonus: ID користувача отримано з telegram_user_id в localStorage");
                        return id;
                    }
                } catch (e) {}
                return null;
            },

            // 6. DOM-елемент user-id
            () => {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const id = userIdElement.textContent.trim();
                    if (isValidId(id)) {
                        if (config.debug) console.log("DailyBonus: ID користувача отримано з DOM-елемента");
                        return id;
                    }
                }
                return null;
            },

            // 7. URL-параметри
            () => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                    if (isValidId(id)) {
                        if (config.debug) console.log("DailyBonus: ID користувача отримано з URL-параметрів");
                        return id;
                    }
                } catch (e) {}
                return null;
            },

            // 8. Глобальна функція getUserId
            () => {
                if (window.getUserId && typeof window.getUserId === 'function') {
                    try {
                        const id = window.getUserId();
                        if (isValidId(id)) {
                            if (config.debug) console.log("DailyBonus: ID користувача отримано через window.getUserId()");
                            return id;
                        }
                    } catch (e) {}
                }
                return null;
            },

            // 9. Метод API, якщо доступний
            () => {
                if (window.WinixAPI && window.WinixAPI.getUserId) {
                    try {
                        const id = window.WinixAPI.getUserId();
                        if (isValidId(id)) {
                            if (config.debug) console.log("DailyBonus: ID користувача отримано через WinixAPI.getUserId()");
                            return id;
                        }
                    } catch (e) {}
                }
                return null;
            }
        ];

        // Перебираємо всі джерела, поки не знайдемо ID
        for (const provider of idProviders) {
            try {
                const id = provider();
                if (isValidId(id)) {
                    // Кешуємо ID для майбутніх викликів
                    state.userId = id;

                    // Спробуємо зберегти ID в localStorage для інших модулів
                    try {
                        localStorage.setItem('telegram_user_id', id);
                    } catch (e) {}

                    return id;
                }
            } catch (e) {
                // Ігноруємо помилки при спробі отримати ID
            }
        }

        // ID не знайдено в жодному джерелі
        if (config.debug) {
            console.warn("DailyBonus: ID користувача не знайдено в жодному джерелі");
        }

        return null;
    }

    /**
     * Ініціалізація модуля щоденних бонусів
     */
    function init() {
        if (state.isInitialized) return;

        console.log("DailyBonus: Ініціалізація модуля щоденних бонусів");

        // Намагаємось отримати ID користувача
        const userId = getUserId();

        // Якщо ID не знайдено, показуємо повідомлення
        if (!userId) {
            console.warn("DailyBonus: Не вдалося отримати ID користувача. Система бонусів недоступна.");

            // Приховуємо контейнер з бонусами або показуємо повідомлення про необхідність авторизації
            const bonusContainer = document.getElementById('daily-bonus-container');
            if (bonusContainer) {
                // Можна або приховати, або показати повідомлення
                // bonusContainer.style.display = 'none';

                // Альтернативно, показуємо повідомлення про необхідність авторизації
                bonusContainer.innerHTML = `
                    <div class="category-title">Щоденний бонус</div>
                    <div class="auth-required-message">
                        <p>Для отримання щоденних бонусів необхідно авторизуватися</p>
                        <button class="auth-button">Увійти</button>
                    </div>
                `;

                // Додаємо обробник для кнопки авторизації, якщо вона є
                const authButton = bonusContainer.querySelector('.auth-button');
                if (authButton) {
                    authButton.addEventListener('click', function() {
                        // Викликаємо функцію авторизації, якщо вона доступна
                        if (window.auth && typeof window.auth.login === 'function') {
                            window.auth.login();
                        } else if (typeof loginWithTelegram === 'function') {
                            loginWithTelegram();
                        } else {
                            // Якщо специфічних функцій немає, перенаправляємо на сторінку входу
                            window.location.href = '/login';
                        }
                    });
                }
            }

            return;
        }

        // Спробуємо завантажити дані з localStorage для швидкої ініціалізації
        try {
            const cachedData = localStorage.getItem('daily_bonus_data');
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.timestamp && parsed.userId === userId) {
                    // Перевіряємо чи дані не застаріли
                    const age = Date.now() - parsed.timestamp;
                    if (age < config.cacheDuration) {
                        state.bonusData = parsed.data;
                        state.lastLoaded = parsed.timestamp;
                        console.log(`DailyBonus: Завантажено кешовані дані (вік: ${Math.round(age/1000)}с)`);
                    }
                }
            }
        } catch (e) {
            console.warn("DailyBonus: Помилка завантаження даних з кешу:", e);
        }

        // Додаємо обробники подій
        setupEventHandlers();

        state.isInitialized = true;

        // Асинхронно завантажуємо дані
        loadBonusData(true);
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        // Знаходимо кнопку отримання бонусу
        const claimButton = document.getElementById('claim-daily');
        if (claimButton) {
            // Додаємо обробник кліку
            claimButton.addEventListener('click', handleClaimButtonClick);
        }

        // Оновлюємо дані при зміні сторінки на "earn"
        if (typeof window.PageManager !== 'undefined') {
            document.addEventListener('page-changed', event => {
                if (event.detail.page === 'earn') {
                    loadBonusData(true);
                }
            });
        }

        // Підписуємося на події системи
        document.addEventListener('user-data-updated', () => {
            loadBonusData(false); // Не показувати індикатор завантаження
        });

        // Синхронізація між вкладками
        window.addEventListener('storage', (event) => {
            if (event.key === 'daily_bonus_data') {
                try {
                    const newData = JSON.parse(event.newValue);
                    if (newData && newData.timestamp && newData.userId === getUserId()) {
                        // Оновлюємо дані, якщо вони новіші за поточні
                        if (!state.lastLoaded || newData.timestamp > state.lastLoaded) {
                            state.bonusData = newData.data;
                            state.lastLoaded = newData.timestamp;
                            renderBonusUI();
                            console.log("DailyBonus: Дані синхронізовано з іншої вкладки");
                        }
                    }
                } catch (e) {
                    console.warn("DailyBonus: Помилка синхронізації даних між вкладками:", e);
                }
            }
        });
    }

    /**
     * Обробник натискання на кнопку отримання бонусу
     * @param {Event} event - Подія кліку
     */
    function handleClaimButtonClick(event) {
        // Зупиняємо стандартне опрацювання події
        event.preventDefault();

        // Перевіряємо чи не виконується вже інша операція
        if (state.pendingOperation) {
            if (typeof window.showToast === 'function') {
                window.showToast("Запит вже обробляється, зачекайте...", "info");
            }
            return;
        }

        // Перевіряємо наявність даних бонусу
        if (!state.bonusData) {
            loadBonusData(true).then(() => {
                if (state.bonusData && state.bonusData.can_claim) {
                    claimDailyBonus();
                }
            });
            return;
        }

        // Перевіряємо можливість отримання бонусу
        if (!state.bonusData.can_claim) {
            if (typeof window.showToast === 'function') {
                window.showToast("Ви вже отримали бонус сьогодні", "info");
            }
            return;
        }

        // Запускаємо процес отримання бонусу
        claimDailyBonus();
    }

    /**
     * Формування повного URL API
     * @param {string} endpoint - Ендпоінт API
     * @returns {string} Повний URL API
     */
    function getApiUrl(endpoint) {
        // Спочатку перевіряємо налаштування в window.WinixAPI
        if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
            return `${window.WinixAPI.config.baseUrl}/${endpoint}`;
        }

        // Потім перевіряємо глобальний API_BASE_URL
        if (window.API_BASE_URL) {
            return `${window.API_BASE_URL}/${endpoint}`;
        }

        // Якщо немає налаштувань, використовуємо поточний домен
        return `${window.location.origin}/${endpoint}`;
    }

    /**
     * Виконання запиту до API з повторними спробами
     * @param {string} endpoint - Шлях до API ендпоінту
     * @param {string} method - HTTP метод (GET, POST, тощо)
     * @param {Object} data - Дані для відправки
     * @returns {Promise<Object>} Результат запиту
     */
    async function fetchWithRetry(endpoint, method = 'GET', data = null) {
        let attempt = 0;
        let lastError = null;

        while (attempt < config.maxRetryAttempts) {
            try {
                // Збільшуємо лічильник спроб
                attempt++;

                // Формуємо повний URL
                const url = getApiUrl(endpoint);

                // Налаштування запиту
                const options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: config.apiTimeout
                };

                // Додаємо тіло запиту для методів POST/PUT
                if (data && (method === 'POST' || method === 'PUT')) {
                    options.body = JSON.stringify(data);
                }

                if (config.debug) {
                    console.log(`DailyBonus: Запит до API (спроба ${attempt}/${config.maxRetryAttempts}): ${method} ${url}`);
                    if (data) console.log("DailyBonus: Дані запиту:", data);
                }

                // Створюємо AbortController для контролю таймауту
                const controller = new AbortController();
                options.signal = controller.signal;

                // Встановлюємо таймаут
                const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

                // Виконуємо запит
                const response = await fetch(url, options);

                // Очищаємо таймаут
                clearTimeout(timeoutId);

                // Перевіряємо статус відповіді
                if (!response.ok) {
                    let errorData = null;
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        // Якщо не можемо розпарсити відповідь, використовуємо статус-текст
                        errorData = { message: response.statusText };
                    }

                    // Формуємо деталізоване повідомлення про помилку
                    const errorMessage = errorData && errorData.message
                        ? errorData.message
                        : `Помилка запиту: ${response.status} ${response.statusText}`;

                    throw new Error(errorMessage);
                }

                // Парсимо відповідь
                const responseData = await response.json();

                // Перевіряємо відповідь на успіх
                if (responseData.status === 'success') {
                    return responseData;
                } else {
                    throw new Error(responseData.message || 'Невідома помилка API');
                }
            } catch (error) {
                lastError = error;

                // Перевіряємо чи це помилка таймауту
                const isTimeoutError = error.name === 'AbortError' ||
                                      error.message.includes('timeout') ||
                                      error.message.includes('abort');

                // Логуємо помилку
                console.error(`DailyBonus: Помилка запиту (спроба ${attempt}/${config.maxRetryAttempts}):`,
                             isTimeoutError ? 'Таймаут запиту' : error.message);

                // Якщо це остання спроба, вибиваємо помилку
                if (attempt >= config.maxRetryAttempts) {
                    break;
                }

                // Зачекаємо перед наступною спробою
                await new Promise(resolve => setTimeout(resolve, config.retryDelay));
            }
        }

        // Якщо всі спроби невдалі, викидаємо останню помилку
        throw lastError;
    }

    /**
     * Завантаження даних щоденного бонусу
     * @param {boolean} showLoader - Показувати індикатор завантаження
     * @returns {Promise<Object>} Дані щоденного бонусу
     */
    async function loadBonusData(showLoader = true) {
        // Запобігаємо одночасним запитам
        if (state.isLoading) return Promise.resolve(state.bonusData);

        // Перевіряємо, чи варто завантажувати свіжі дані
        const now = Date.now();
        const dataAge = now - state.lastLoaded;

        // Якщо дані свіжі (менше 5 хвилин), не робимо новий запит
        if (state.bonusData && dataAge < config.cacheDuration) {
            return Promise.resolve(state.bonusData);
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            console.error("DailyBonus: ID користувача не знайдено");
            state.lastError = "ID користувача не знайдено";
            return Promise.reject(new Error("ID користувача не знайдено"));
        }

        // Показуємо індикатор завантаження
        if (showLoader && typeof window.showLoading === 'function') {
            window.showLoading();
        }

        state.isLoading = true;

        try {
            // Формуємо шлях API
            const endpoint = API_PATHS.STATUS(userId);

            // Діагностика
            if (config.debug) {
                console.log(`DailyBonus: Запит даних бонусу для ${userId}, endpoint: ${endpoint}`);
            }

            // Виконуємо запит до API з повторними спробами
            const response = await fetchWithRetry(endpoint, 'GET');

            // Оновлюємо стан
            state.bonusData = response.data;
            state.lastLoaded = now;
            state.failureCount = 0;
            state.lastError = null;

            // Зберігаємо в localStorage
            try {
                localStorage.setItem('daily_bonus_data', JSON.stringify({
                    data: response.data,
                    timestamp: now,
                    userId: userId
                }));
            } catch (e) {
                console.warn("DailyBonus: Помилка збереження даних в кеш:", e);
            }

            // Оновлюємо інтерфейс
            renderBonusUI();

            return response.data;
        } catch (error) {
            state.failureCount++;
            state.lastError = error.message;
            console.error("DailyBonus: Помилка завантаження даних", error);

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function' && showLoader) {
                window.showToast("Не вдалося завантажити дані щоденного бонусу. Спробуйте пізніше.", "error");
            }

            // Якщо є кешовані дані, повертаємо їх
            if (state.bonusData) {
                return state.bonusData;
            }

            throw error;
        } finally {
            state.isLoading = false;

            // Приховуємо індикатор завантаження
            if (showLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    }

    /**
     * Відображення інтерфейсу бонусів
     */
    function renderBonusUI() {
        if (!state.bonusData) return;

        // Знаходимо контейнер прогресу
        const progressContainer = document.getElementById('daily-progress-container');
        if (!progressContainer) return;

        // Очищаємо контейнер
        progressContainer.innerHTML = '';

        // Визначаємо максимальну кількість днів (за замовчуванням 7)
        const MAX_DAYS = 7;

        // Отримуємо поточний день та вже отримані дні
        const currentDay = state.bonusData.current_day || 1;
        const claimedDays = state.bonusData.claimed_days || [];
        const canClaim = state.bonusData.can_claim !== false;

        // Створюємо елементи для кожного дня
        for (let day = 1; day <= MAX_DAYS; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'daily-day';

            // Визначаємо статус дня
            if (claimedDays.includes(day)) {
                dayElement.classList.add('claimed');
            } else if (day === currentDay && canClaim) {
                dayElement.classList.add('current');
            }

            // Створюємо елемент номеру дня
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayElement.appendChild(dayNumber);

            // Створюємо елемент винагороди
            const bonusAmount = document.createElement('div');
            bonusAmount.className = 'bonus-amount';
            bonusAmount.textContent = `${day * 10} WINIX`;
            dayElement.appendChild(bonusAmount);

            // Додаємо елемент дня до контейнера
            progressContainer.appendChild(dayElement);
        }

        // Оновлюємо стан кнопки отримання бонусу
        updateClaimButton();
    }

    /**
     * Оновлення стану кнопки отримання бонусу
     */
    function updateClaimButton() {
        const claimButton = document.getElementById('claim-daily');
        if (!claimButton) return;

        // Перевіряємо чи є дані про бонус
        if (!state.bonusData) {
            claimButton.disabled = true;
            claimButton.textContent = 'Завантаження...';
            return;
        }

        // Визначаємо, чи можна отримати бонус
        const canClaim = state.bonusData.can_claim !== false;

        // Оновлюємо стан кнопки
        if (canClaim) {
            claimButton.disabled = false;
            claimButton.textContent = 'Отримати бонус';
            claimButton.classList.remove('disabled');
        } else {
            claimButton.disabled = true;
            claimButton.textContent = 'Вже отримано';
            claimButton.classList.add('disabled');
        }
    }

    /**
     * Отримання щоденного бонусу
     * @returns {Promise<Object>} Результат отримання бонусу
     */
    async function claimDailyBonus() {
        // Перевіряємо чи не виконується вже інша операція
        if (state.pendingOperation) {
            console.warn("DailyBonus: Інша операція вже виконується");
            return Promise.reject(new Error("Операція вже виконується"));
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            console.error("DailyBonus: ID користувача не знайдено");

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                window.showToast("Неможливо отримати бонус: ви не авторизовані", "error");
            }

            return Promise.reject(new Error("ID користувача не знайдено"));
        }

        // Встановлюємо прапорець очікування
        state.pendingOperation = true;

        // Спочатку завантажуємо актуальні дані
        try {
            await loadBonusData(false);
        } catch (e) {
            console.warn("DailyBonus: Не вдалося завантажити актуальні дані перед отриманням бонусу", e);
        }

        // Показуємо індикатор завантаження
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        try {
            // Перевіряємо можливість отримання бонусу
            if (state.bonusData && !state.bonusData.can_claim) {
                console.warn("DailyBonus: Бонус вже отримано сьогодні");

                // Показуємо повідомлення про неможливість отримання бонусу
                if (typeof window.showToast === 'function') {
                    window.showToast("Ви вже отримали бонус сьогодні", "info");
                }

                return Promise.reject(new Error("Бонус вже отримано сьогодні"));
            }

            // Формуємо шлях API
            const endpoint = API_PATHS.CLAIM(userId);

            // Діагностика
            if (config.debug) {
                console.log(`DailyBonus: Запит на отримання бонусу для ${userId}, endpoint: ${endpoint}`);
            }

            // Дані для відправки
            const requestData = state.bonusData ? { day: state.bonusData.current_day } : null;

            // Виконуємо запит до API
            const response = await fetchWithRetry(endpoint, 'POST', requestData);

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Оновлюємо стан
            if (response && response.status === 'success' && response.data) {
                // Оновлюємо бонусні дані
                const newBonusData = {
                    ...state.bonusData,
                    can_claim: false,
                    current_day: response.data.next_day,
                    streak_days: response.data.streak_days,
                    last_claimed_date: new Date().toISOString()
                };

                state.bonusData = newBonusData;
                state.lastLoaded = Date.now();
                state.lastError = null;

                // Оновлюємо кеш
                try {
                    localStorage.setItem('daily_bonus_data', JSON.stringify({
                        data: state.bonusData,
                        timestamp: state.lastLoaded,
                        userId: userId
                    }));
                } catch (e) {
                    console.warn("DailyBonus: Помилка збереження даних в кеш:", e);
                }

                // Оновлюємо інтерфейс
                renderBonusUI();

                // Показуємо повідомлення про успіх
                if (typeof window.showToast === 'function') {
                    window.showToast(`Щоденний бонус отримано: +${response.data.reward || 0} WINIX`, "success");
                }

                // Показуємо анімацію винагороди
                if (response.data.reward && typeof window.TaskRewards !== 'undefined' &&
                    typeof window.TaskRewards.showRewardAnimation === 'function') {
                    window.TaskRewards.showRewardAnimation({
                        type: 'tokens',
                        amount: response.data.reward
                    });
                }

                // Оновлюємо баланс користувача
                if (response.data.reward) {
                    // Через TaskRewards
                    if (window.TaskRewards && typeof window.TaskRewards.updateBalance === 'function') {
                        window.TaskRewards.updateBalance({
                            type: 'tokens',
                            amount: response.data.reward
                        });
                    }
                    // Через глобальну функцію
                    else if (typeof window.updateUserBalance === 'function') {
                        window.updateUserBalance(response.data.reward);
                    }
                    // Напряму оновлюємо DOM
                    else {
                        const tokenElement = document.getElementById('user-tokens');
                        if (tokenElement) {
                            const currentBalance = parseFloat(tokenElement.textContent) || 0;
                            tokenElement.textContent = (currentBalance + response.data.reward).toFixed(2);
                            tokenElement.classList.add('increasing');
                            setTimeout(() => {
                                tokenElement.classList.remove('increasing');
                            }, 1500);
                        }
                    }
                }

                // Відправляємо подію про отримання бонусу
                document.dispatchEvent(new CustomEvent('daily-bonus-claimed', {
                    detail: response.data
                }));

                return response.data;
            } else {
                // Неочікувана відповідь
                throw new Error(response.message || "Неочікувана відповідь сервера");
            }
        } catch (error) {
            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            console.error("DailyBonus: Помилка отримання щоденного бонусу", error);
            state.lastError = error.message;

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                window.showToast(error.message || "Не вдалося отримати щоденний бонус. Спробуйте пізніше.", "error");
            }

            throw error;
        } finally {
            // Знімаємо прапорець очікування
            state.pendingOperation = false;
        }
    }

    /**
     * Отримання бонусу за стрік
     * @returns {Promise<Object>} Результат отримання бонусу
     */
    async function claimStreakBonus() {
        // Перевіряємо чи не виконується вже інша операція
        if (state.pendingOperation) {
            console.warn("DailyBonus: Інша операція вже виконується");
            return Promise.reject(new Error("Операція вже виконується"));
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            console.error("DailyBonus: ID користувача не знайдено");

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                window.showToast("Неможливо отримати бонус: ви не авторизовані", "error");
            }

            return Promise.reject(new Error("ID користувача не знайдено"));
        }

        // Встановлюємо прапорець очікування
        state.pendingOperation = true;

        // Показуємо індикатор завантаження
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        try {
            // Формуємо шлях API
            const endpoint = API_PATHS.STREAK(userId);

            // Діагностика
            if (config.debug) {
                console.log(`DailyBonus: Запит на отримання бонусу за стрік для ${userId}, endpoint: ${endpoint}`);
            }

            // Виконуємо запит до API
            const response = await fetchWithRetry(endpoint, 'POST');

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Оновлюємо стан
            if (response && response.status === 'success' && response.data) {
                // Оновлюємо дані бонусу
                state.lastLoaded = Date.now();
                state.lastError = null;

                // Оновлюємо UI після оновлення даних
                loadBonusData(false);

                // Показуємо повідомлення про успіх
                if (typeof window.showToast === 'function') {
                    window.showToast(`Бонус за стрік отримано: +${response.data.reward || 0} WINIX`, "success");
                }

                // Показуємо анімацію винагороди
                if (response.data.reward && typeof window.TaskRewards !== 'undefined' &&
                    typeof window.TaskRewards.showRewardAnimation === 'function') {
                    window.TaskRewards.showRewardAnimation({
                        type: 'tokens',
                        amount: response.data.reward
                    });
                }

                // Оновлюємо баланс користувача
                if (response.data.reward) {
                    // Через TaskRewards
                    if (window.TaskRewards && typeof window.TaskRewards.updateBalance === 'function') {
                        window.TaskRewards.updateBalance({
                            type: 'tokens',
                            amount: response.data.reward
                        });
                    }
                    // Через глобальну функцію
                    else if (typeof window.updateUserBalance === 'function') {
                        window.updateUserBalance(response.data.reward);
                    }
                    // Напряму оновлюємо DOM
                    else {
                        const tokenElement = document.getElementById('user-tokens');
                        if (tokenElement) {
                            const currentBalance = parseFloat(tokenElement.textContent) || 0;
                            tokenElement.textContent = (currentBalance + response.data.reward).toFixed(2);
                            tokenElement.classList.add('increasing');
                            setTimeout(() => {
                                tokenElement.classList.remove('increasing');
                            }, 1500);
                        }
                    }
                }

                // Відправляємо подію про отримання бонусу за стрік
                document.dispatchEvent(new CustomEvent('streak-bonus-claimed', {
                    detail: response.data
                }));

                return response.data;
            } else {
                // Неочікувана відповідь
                throw new Error(response.message || "Неочікувана відповідь сервера");
            }
        } catch (error) {
            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            console.error("DailyBonus: Помилка отримання бонусу за стрік", error);
            state.lastError = error.message;

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                const errorMsg = error.message || "Не вдалося отримати бонус за стрік. Спробуйте пізніше.";
                window.showToast(errorMsg, "error");
            }

            throw error;
        } finally {
            // Знімаємо прапорець очікування
            state.pendingOperation = false;
        }
    }

    /**
     * Перевірка можливості отримати бонус за стрік
     * @returns {boolean} True, якщо можна отримати бонус за стрік
     */
    function canClaimStreakBonus() {
        // Перевіряємо наявність даних
        if (!state.bonusData) return false;

        // Отримуємо кількість днів стріку
        const streakDays = state.bonusData.streak_days || 0;

        // Перевіряємо умову для бонусу (сім днів)
        return streakDays >= 7 && streakDays % 7 === 0;
    }

    /**
     * Оновлення конфігурації модуля
     * @param {Object} newConfig - Нові налаштування
     */
    function updateConfig(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') return;

        // Оновлюємо тільки допустимі параметри
        const allowedParams = ['cacheDuration', 'debug', 'apiTimeout', 'maxRetryAttempts', 'retryDelay'];

        for (const param of allowedParams) {
            if (param in newConfig) {
                config[param] = newConfig[param];
            }
        }

        console.log("DailyBonus: Конфігурацію оновлено", config);
    }

    // Публічний API
    return {
        init,
        loadBonusData,
        claimDailyBonus,
        claimStreakBonus,
        canClaimStreakBonus,
        renderBonusUI,
        updateConfig,
        getState: () => ({ ...state }),
        resetCache: () => {
            state.bonusData = null;
            state.lastLoaded = 0;
            localStorage.removeItem('daily_bonus_data');
            console.log("DailyBonus: Кеш скинуто");
        }
    };
})();

// Автоматична ініціалізація, якщо можливо
document.addEventListener('DOMContentLoaded', function() {
    if (window.DailyBonus && !window.DailyBonus.isInitialized) {
        window.DailyBonus.init();
    }
});