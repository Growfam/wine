/**
 * Оптимізований модуль щоденних бонусів
 * Спрощена логіка та покращена продуктивність
 */

window.DailyBonus = (function() {
    // Спрощена конфігурація модуля
    const config = {
        cacheDuration: 300000,  // 5 хвилин кеш
        debug: false,           // Режим відлагодження
        apiTimeout: 10000,      // 10 секунд таймаут для запитів
        maxRetries: 1,          // Максимальна кількість повторних спроб
        retryDelay: 1000        // Затримка між повторними спробами (мс)
    };

    // Спрощений стан модуля
    const state = {
        isInitialized: false,
        bonusData: null,
        lastLoaded: 0,
        isLoading: false,
        userId: null,
        pendingOperation: false, // Прапорець очікування результату операції
        lastError: null,         // Останнє повідомлення про помилку
        containerElement: null,  // Кешований DOM-елемент контейнера
        claimButtonElement: null, // Кешований DOM-елемент кнопки
        progressContainerElement: null // Кешований DOM-елемент для прогресу
    };

    // Шляхи API
    const API_PATHS = {
        STATUS: (userId) => `api/user/${userId}/daily-bonus`,
        CLAIM: (userId) => `api/user/${userId}/claim-daily-bonus`
    };

    /**
     * Спрощена функція для отримання ID користувача
     * Зосереджена на найбільш надійних джерелах
     */
    function getUserId() {
        // Перевіряємо, чи ID вже кешовано
        if (state.userId) {
            return state.userId;
        }

        // Спрощений список джерел для отримання ID
        const sources = [
            // 1. Глобальна змінна USER_ID
            () => window.USER_ID,

            // 2. Telegram WebApp
            () => {
                if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                    return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                }
                return null;
            },

            // 3. User data з localStorage
            () => {
                try {
                    const userData = localStorage.getItem('user_data');
                    if (userData) {
                        const parsed = JSON.parse(userData);
                        if (parsed?.telegram_id) {
                            return parsed.telegram_id.toString();
                        }
                    }
                    return localStorage.getItem('telegram_user_id');
                } catch (e) {
                    return null;
                }
            },

            // 4. DOM-елемент user-id
            () => document.getElementById('user-id')?.textContent?.trim(),

            // 5. URL-параметри
            () => {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            }
        ];

        // Перебираємо всі джерела, поки не знайдемо ID
        for (const getIdFunc of sources) {
            try {
                const id = getIdFunc();
                if (id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.length > 3) {
                    // Кешуємо ID для майбутніх викликів
                    state.userId = id;

                    // Зберігаємо в localStorage для інших модулів
                    try {
                        localStorage.setItem('telegram_user_id', id);
                    } catch (e) {}

                    return id;
                }
            } catch (e) {}
        }

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

        // Кешування DOM-елементів для швидшого доступу
        state.containerElement = document.getElementById('daily-bonus-container');
        state.claimButtonElement = document.getElementById('claim-daily');
        state.progressContainerElement = document.getElementById('daily-progress-container');

        // Якщо елементи не знайдено, вихід
        if (!state.containerElement) {
            console.warn("DailyBonus: Не знайдено контейнер для щоденних бонусів");
            return;
        }

        // Перевірка наявності ID користувача
        const userId = getUserId();
        if (!userId) {
            console.warn("DailyBonus: Не вдалося отримати ID користувача. Система бонусів недоступна.");

            // Показуємо повідомлення про необхідність авторизації
            state.containerElement.innerHTML = `
                <div class="category-title">Щоденний бонус</div>
                <div class="auth-required-message">
                    <p>Для отримання щоденних бонусів необхідно авторизуватися</p>
                    <button class="auth-button">Увійти</button>
                </div>
            `;

            // Додаємо обробник для кнопки авторизації
            const authButton = state.containerElement.querySelector('.auth-button');
            if (authButton) {
                authButton.addEventListener('click', function() {
                    if (window.auth && typeof window.auth.login === 'function') {
                        window.auth.login();
                    } else if (typeof loginWithTelegram === 'function') {
                        loginWithTelegram();
                    } else {
                        window.location.href = '/login';
                    }
                });
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

                        // Відразу оновлюємо інтерфейс
                        renderBonusUI();
                    }
                }
            }
        } catch (e) {
            console.warn("DailyBonus: Помилка завантаження даних з кешу:", e);
        }

        // Додаємо обробник подій для кнопки отримання бонусу
        if (state.claimButtonElement) {
            // Видаляємо старі обробники, щоб уникнути дублювання
            const newClaimButton = state.claimButtonElement.cloneNode(true);
            state.claimButtonElement.parentNode.replaceChild(newClaimButton, state.claimButtonElement);
            state.claimButtonElement = newClaimButton;

            // Додаємо новий обробник
            state.claimButtonElement.addEventListener('click', handleClaimButtonClick);
        }

        // Оновлюємо стан ініціалізації
        state.isInitialized = true;

        // Асинхронно завантажуємо дані з серверу
        loadBonusData(true);
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
            }).catch(error => {
                console.error("DailyBonus: Помилка при завантаженні даних:", error);
                if (typeof window.showToast === 'function') {
                    window.showToast("Помилка завантаження даних. Спробуйте пізніше.", "error");
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
        if (window.WinixAPI?.config?.baseUrl) {
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
     * Виконання запиту до API з обробкою помилок
     * @param {string} endpoint - Шлях до API ендпоінту
     * @param {string} method - HTTP метод (GET, POST, тощо)
     * @param {Object} data - Дані для відправки
     * @returns {Promise<Object>} Результат запиту
     */
    async function fetchApi(endpoint, method = 'GET', data = null) {
        // Формуємо повний URL
        const url = getApiUrl(endpoint);

        // Налаштування запиту
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        // Додаємо тіло запиту для методів POST/PUT
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        // Перевірка чи доступно Fetch API
        if (typeof fetch !== 'function') {
            throw new Error('Fetch API недоступне в цьому браузері');
        }

        try {
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
                // Спробуємо отримати деталі помилки з відповіді
                let errorMsg;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || `Помилка запиту: ${response.status} ${response.statusText}`;
                } catch {
                    errorMsg = `Помилка запиту: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMsg);
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
            // Спеціальна обробка помилки таймауту
            if (error.name === 'AbortError') {
                throw new Error('Перевищено час очікування відповіді від сервера');
            }

            // Якщо це виконується повторна спроба, генеруємо більш детальне повідомлення
            throw error;
        }
    }

    /**
     * Завантаження даних щоденного бонусу
     * @param {boolean} showLoader - Показувати індикатор завантаження
     * @returns {Promise<Object>} Дані щоденного бонусу
     */
    async function loadBonusData(showLoader = false) {
        // Запобігаємо одночасним запитам
        if (state.isLoading) return Promise.resolve(state.bonusData);

        // Перевіряємо, чи варто завантажувати свіжі дані
        const now = Date.now();
        const dataAge = now - state.lastLoaded;

        // Якщо дані свіжі (менше часу кешування), не робимо новий запит
        if (state.bonusData && dataAge < config.cacheDuration) {
            return Promise.resolve(state.bonusData);
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            state.lastError = error.message;
            return Promise.reject(error);
        }

        // Показуємо індикатор завантаження
        if (showLoader && typeof window.showLoading === 'function') {
            window.showLoading();
        }

        state.isLoading = true;

        try {
            // Формуємо шлях API
            const endpoint = API_PATHS.STATUS(userId);

            // Виконуємо запит до API
            const response = await fetchApi(endpoint, 'GET');

            // Оновлюємо стан
            state.bonusData = response.data;
            state.lastLoaded = now;
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
            state.lastError = error.message;
            console.error("DailyBonus: Помилка завантаження даних:", error.message);

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
        if (!state.bonusData || !state.progressContainerElement) return;

        // Очищаємо контейнер прогресу
        state.progressContainerElement.innerHTML = '';

        // Визначаємо максимальну кількість днів (за замовчуванням 7)
        const MAX_DAYS = 7;

        // Отримуємо поточний день та вже отримані дні
        const currentDay = state.bonusData.current_day || 1;
        const claimedDays = state.bonusData.claimed_days || [];
        const canClaim = state.bonusData.can_claim !== false;

        // Створюємо елементи для кожного дня
        for (let day = 1; day <= MAX_DAYS; day++) {
            // Створюємо маркер дня
            const dayMarker = document.createElement('div');
            dayMarker.className = 'day-marker';

            // Створюємо коло дня
            const dayCircle = document.createElement('div');
            dayCircle.className = 'day-circle';

            // Визначаємо стан дня
            if (claimedDays.includes(day)) {
                dayCircle.classList.add('completed');
            } else if (day === currentDay && canClaim) {
                dayCircle.classList.add('active');
            }

            // Встановлюємо вміст
            dayCircle.textContent = day;
            dayMarker.appendChild(dayCircle);

            // Додаємо винагороду
            const dayReward = document.createElement('div');
            dayReward.className = 'day-reward';
            dayReward.textContent = `${day * 10} WINIX`;
            dayMarker.appendChild(dayReward);

            // Додаємо маркер до контейнера
            state.progressContainerElement.appendChild(dayMarker);
        }

        // Оновлюємо стан кнопки отримання бонусу
        updateClaimButton();
    }

    /**
     * Оновлення стану кнопки отримання бонусу
     */
    function updateClaimButton() {
        if (!state.claimButtonElement) return;

        // Перевіряємо чи є дані про бонус
        if (!state.bonusData) {
            state.claimButtonElement.disabled = true;
            state.claimButtonElement.textContent = 'Завантаження...';
            return;
        }

        // Визначаємо, чи можна отримати бонус
        const canClaim = state.bonusData.can_claim !== false;

        // Оновлюємо стан кнопки
        if (canClaim) {
            state.claimButtonElement.disabled = false;
            state.claimButtonElement.textContent = 'Отримати бонус';
            state.claimButtonElement.classList.remove('disabled');
        } else {
            state.claimButtonElement.disabled = true;
            state.claimButtonElement.textContent = 'Вже отримано';
            state.claimButtonElement.classList.add('disabled');
        }
    }

    /**
     * Отримання щоденного бонусу
     * @returns {Promise<Object>} Результат отримання бонусу
     */
    async function claimDailyBonus() {
        // Перевіряємо чи не виконується вже інша операція
        if (state.pendingOperation) {
            if (typeof window.showToast === 'function') {
                window.showToast("Запит вже обробляється, зачекайте...", "info");
            }
            return Promise.reject(new Error("Операція вже виконується"));
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
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
            // Перевіряємо можливість отримання бонусу
            if (state.bonusData && !state.bonusData.can_claim) {
                if (typeof window.showToast === 'function') {
                    window.showToast("Ви вже отримали бонус сьогодні", "info");
                }
                return Promise.reject(new Error("Бонус вже отримано сьогодні"));
            }

            // Формуємо шлях API
            const endpoint = API_PATHS.CLAIM(userId);

            // Дані для відправки
            const requestData = state.bonusData ? { day: state.bonusData.current_day } : null;

            // Виконуємо запит до API
            const response = await fetchApi(endpoint, 'POST', requestData);

            // Оновлюємо стан
            if (response && response.status === 'success' && response.data) {
                // Оновлюємо бонусні дані
                state.bonusData = {
                    ...state.bonusData,
                    can_claim: false,
                    current_day: response.data.next_day,
                    claimed_days: [...(state.bonusData.claimed_days || []), state.bonusData.current_day],
                    streak_days: response.data.streak_days,
                    last_claimed_date: new Date().toISOString()
                };

                state.lastLoaded = Date.now();

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

                // Оновлюємо баланс користувача
                if (response.data.reward) {
                    updateUserBalance(response.data.reward);
                }

                // Показуємо анімацію винагороди
                if (response.data.reward && window.UI?.Animations?.showReward) {
                    window.UI.Animations.showReward({
                        type: 'tokens',
                        amount: response.data.reward
                    });
                }

                // Відправляємо подію про отримання бонусу
                document.dispatchEvent(new CustomEvent('daily-bonus-claimed', {
                    detail: response.data
                }));

                return response.data;
            } else {
                throw new Error(response.message || "Неочікувана відповідь сервера");
            }
        } catch (error) {
            console.error("DailyBonus: Помилка отримання щоденного бонусу:", error.message);

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                window.showToast(error.message || "Не вдалося отримати щоденний бонус. Спробуйте пізніше.", "error");
            }

            throw error;
        } finally {
            // Знімаємо прапорець очікування
            state.pendingOperation = false;

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    }

    /**
     * Оновлення балансу користувача
     * @param {number} amount - Кількість токенів
     */
    function updateUserBalance(amount) {
        // Через TaskRewards
        if (window.TaskRewards?.updateBalance) {
            window.TaskRewards.updateBalance({
                type: 'tokens',
                amount: amount
            });
            return;
        }

        // Через глобальну функцію
        if (typeof window.updateUserBalance === 'function') {
            window.updateUserBalance(amount);
            return;
        }

        // Напряму оновлюємо DOM
        const tokenElement = document.getElementById('user-tokens');
        if (tokenElement) {
            const currentBalance = parseFloat(tokenElement.textContent) || 0;
            tokenElement.textContent = (currentBalance + amount).toFixed(2);
            tokenElement.classList.add('increasing');
            setTimeout(() => {
                tokenElement.classList.remove('increasing');
            }, 1500);
        }

        // Зберігаємо в localStorage
        try {
            const currentBalance = parseFloat(localStorage.getItem('userTokens') || '0');
            localStorage.setItem('userTokens', (currentBalance + amount).toString());
            localStorage.setItem('winix_balance', (currentBalance + amount).toString());
        } catch (e) {}
    }

    /**
     * Отримання стану
     * @returns {Object} Поточний стан модуля
     */
    function getState() {
        return {
            isInitialized: state.isInitialized,
            bonusData: state.bonusData,
            lastLoaded: state.lastLoaded,
            isLoading: state.isLoading,
            pendingOperation: state.pendingOperation,
            lastError: state.lastError
        };
    }

    /**
     * Скидання кешу
     */
    function resetCache() {
        state.bonusData = null;
        state.lastLoaded = 0;
        localStorage.removeItem('daily_bonus_data');
    }

    // Публічний API
    return {
        init,
        loadBonusData,
        claimDailyBonus,
        renderBonusUI,
        getState,
        resetCache
    };
})();

// Автоматична ініціалізація, якщо можливо
document.addEventListener('DOMContentLoaded', function() {
    // Відкладена ініціалізація для уникнення блокування рендерингу сторінки
    setTimeout(function() {
        if (window.DailyBonus && !window.DailyBonus.isInitialized) {
            window.DailyBonus.init();
        }
    }, 100);
});