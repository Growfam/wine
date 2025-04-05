/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 *
 * Цей модуль централізує всі API-запити для різних функціональностей:
 * - Авторизація
 * - Стейкінг
 * - Реферали
 * - Транзакції
 * - Завдання
 * - Розіграші
 * - Мовні налаштування
 * та інші.
 */

(function() {
    console.log("🔌 API: Ініціалізація єдиного API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ТА КОНСТАНТИ ========

    // Базовий URL API (за замовчуванням пустий для відносних шляхів)
    const API_BASE_URL = '';

    // Прапорець для логування запитів
    let _debugMode = false;

    // Прапорець готовності API модуля
    let _isReady = false;

    // Черга запитів, які були зроблені до готовності модуля
    let _pendingRequests = [];

    // Функція для отримання ID користувача з різних джерел
    function getUserId() {
        // Спочатку пробуємо отримати з localStorage
        let userId = localStorage.getItem('telegram_user_id');

        // Перевіряємо валідність ID
        if (userId && userId !== 'undefined' && userId !== 'null') {
            if (_debugMode) console.log("🆔 ID користувача отримано з localStorage:", userId);
            return userId;
        }

        // Потім пробуємо отримати з DOM елемента
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userIdElement.textContent) {
            userId = userIdElement.textContent.trim();
            if (userId && userId !== 'undefined' && userId !== 'null') {
                if (_debugMode) console.log("🆔 ID користувача отримано з DOM:", userId);

                // Зберігаємо в localStorage для наступних запитів
                try {
                    localStorage.setItem('telegram_user_id', userId);
                } catch (e) {
                    console.warn("Не вдалося зберегти ID користувача в localStorage:", e);
                }

                return userId;
            }
        }

        // Пробуємо отримати з URL параметрів
        const urlParams = new URLSearchParams(window.location.search);
        userId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (userId && userId !== 'undefined' && userId !== 'null') {
            if (_debugMode) console.log("🆔 ID користувача отримано з URL параметрів:", userId);

            // Зберігаємо в localStorage для наступних запитів
            try {
                localStorage.setItem('telegram_user_id', userId);
            } catch (e) {
                console.warn("Не вдалося зберегти ID користувача в localStorage:", e);
            }

            return userId;
        }

        // Якщо не вдалося знайти валідний ID, повертаємо null
        console.warn("⚠️ Не вдалося отримати ID користувача");
        return null;
    }

    // Обробка помилок API
    function handleApiError(error, operation = 'API операції') {
        console.error(`❌ Помилка ${operation}:`, error);

        // Пробуємо отримати текст помилки
        let errorMessage = error.message || 'Невідома помилка';

        // Перевіряємо тип помилки і формуємо зрозуміле повідомлення
        if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
            return `Не вдалося з'єднатися з сервером. Перевірте інтернет-з'єднання та спробуйте знову.`;
        }

        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            return `Час очікування відповіді від сервера вичерпано. Спробуйте знову пізніше.`;
        }

        if (errorMessage.includes('404')) {
            return `Сервер не може знайти потрібний ресурс (404). Спробуйте перезавантажити сторінку.`;
        }

        if (errorMessage.includes('500')) {
            return `Виникла помилка на сервері (500). Будь ласка, спробуйте пізніше.`;
        }

        if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
            return `Не вдалося отримати дані користувача. Спробуйте перезавантажити сторінку.`;
        }

        if (errorMessage.includes('ID користувача не знайдено')) {
            return `Не вдалося визначити ваш ідентифікатор. Спробуйте вийти та увійти знову.`;
        }

        // Повертаємо оригінальне повідомлення, якщо воно не підходить під типові шаблони
        return errorMessage;
    }

    // Індикатори завантаження
    function showLoader() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');
    }

    function hideLoader() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
    }

    // ======== ОСНОВНА ФУНКЦІЯ API-ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту відносно базового URL
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки (для POST/PUT запитів)
     * @param {Function|Object} callbackOrOptions - Функція зворотного виклику або опції запиту
     * @param {Object|number} optionsOrRetries - Додаткові параметри запиту або кількість повторних спроб
     * @returns {Promise<Object>} Результат запиту у форматі JSON
     */
    async function apiRequest(endpoint, method = 'GET', data = null, callbackOrOptions = null, optionsOrRetries = 3) {
        // Визначаємо, чи перший аргумент - колбек чи опції
        let callback = null;
        let options = {};
        let retries = 3;

        if (typeof callbackOrOptions === 'function') {
            callback = callbackOrOptions;
            if (typeof optionsOrRetries === 'object') {
                options = optionsOrRetries;
            } else if (typeof optionsOrRetries === 'number') {
                retries = optionsOrRetries;
            }
        } else if (typeof callbackOrOptions === 'object') {
            options = callbackOrOptions;
            if (typeof optionsOrRetries === 'number') {
                retries = optionsOrRetries;
            }
        }

        // Якщо API ще не готовий, додаємо запит у чергу
        if (!_isReady) {
            return new Promise((resolve, reject) => {
                _pendingRequests.push({
                    endpoint, method, data, callback, options, retries,
                    resolve, reject
                });

                if (_debugMode) {
                    console.log(`⏳ Запит до ${endpoint} доданий до черги до готовності API`);
                }
            });
        }

        try {
            // Отримуємо ID користувача
            const userId = getUserId();

            // Додаємо мітку часу для запобігання кешуванню
            const timestamp = Date.now();
            const url = `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}t=${timestamp}`;

            // Показуємо індикатор завантаження, якщо він не вимкнений в опціях
            if (options && !options.hideLoader) {
                showLoader();
            }

            // Логуємо запит у режимі відлагодження
            if (_debugMode) {
                console.log(`🔄 Відправка ${method} запиту на ${url}`);
                if (data) console.log("📦 Дані запиту:", data);
            }

            // Підготовка параметрів запиту
            const requestOptions = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-User-Id': userId || '',
                    ...options.headers
                },
                ...options
            };

            // Додаємо тіло запиту для POST/PUT
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(data);
            }

            // Функція для повторного запиту при помилці
            async function tryRequest(attemptsLeft) {
                try {
                    const response = await fetch(url, requestOptions);

                    // Приховуємо індикатор завантаження
                    if (options && !options.hideLoader) {
                        hideLoader();
                    }

                    // Перевіряємо статус відповіді
                    if (!response.ok) {
                        const statusText = response.statusText || '';
                        console.error(`❌ Помилка API-запиту: ${response.status} ${statusText}`);

                        // Для 401/403 помилок авторизації
                        if (response.status === 401 || response.status === 403) {
                            console.warn('🔐 Помилка авторизації, спроба оновити дані користувача');
                        }

                        // Для 404 помилок
                        if (response.status === 404) {
                            console.error(`⚠️ Ресурс не знайдено: ${url}`);
                            throw new Error(`Запитаний ресурс недоступний (404)`);
                        }

                        // Якщо залишились спроби, повторюємо запит
                        if (attemptsLeft > 0) {
                            const delay = Math.pow(2, retries - attemptsLeft) * 500; // Експоненційна затримка
                            if (_debugMode) {
                                console.log(`⏱️ Повтор запиту через ${delay}мс (залишилось спроб: ${attemptsLeft})`);
                            }

                            await new Promise(resolve => setTimeout(resolve, delay));
                            return tryRequest(attemptsLeft - 1);
                        }

                        throw new Error(`Помилка сервера: ${response.status} ${statusText}`);
                    }

                    // Якщо статус ОК, парсимо JSON
                    let jsonData;
                    try {
                        jsonData = await response.json();
                    } catch (parseError) {
                        console.error('❌ Помилка парсингу JSON відповіді:', parseError);
                        throw new Error('Некоректний формат відповіді');
                    }

                    // Перевіряємо, чи є помилка у відповіді
                    if (jsonData && jsonData.status === 'error') {
                        console.error('❌ API повернув помилку:', jsonData.message);
                        throw new Error(jsonData.message || 'Помилка виконання запиту');
                    }

                    if (_debugMode) {
                        console.log(`✅ Успішний API-запит на ${url}`);
                        console.log("📊 Дані відповіді:", jsonData);
                    }

                    // Викликаємо колбек з результатом, якщо він є
                    if (callback && typeof callback === 'function') {
                        try {
                            callback(null, jsonData);
                        } catch (callbackError) {
                            console.error('❌ Помилка виконання колбека:', callbackError);
                        }
                    }

                    return jsonData;

                } catch (error) {
                    // Приховуємо індикатор завантаження у випадку помилки
                    if (options && !options.hideLoader) {
                        hideLoader();
                    }

                    // Для мережевих помилок пробуємо ще раз
                    if (error.name === 'TypeError' && attemptsLeft > 0) {
                        const delay = Math.pow(2, retries - attemptsLeft) * 500;
                        console.log(`⚠️ Мережева помилка, повтор через ${delay}мс (залишилось спроб: ${attemptsLeft}):`, error.message);

                        await new Promise(resolve => setTimeout(resolve, delay));
                        return tryRequest(attemptsLeft - 1);
                    }

                    // Викликаємо колбек з помилкою, якщо він є
                    if (callback && typeof callback === 'function') {
                        try {
                            callback(error, null);
                        } catch (callbackError) {
                            console.error('❌ Помилка виконання колбека для помилки:', callbackError);
                        }
                    }

                    throw error;
                }
            }

            // Починаємо процес запиту з повторними спробами
            return tryRequest(retries);
        } catch (error) {
            // Обробка помилок, які не обробляються у tryRequest
            console.error("❌ Критична помилка API-запиту:", error);

            // Викликаємо колбек з помилкою, якщо він є
            if (callback && typeof callback === 'function') {
                try {
                    callback(error, null);
                } catch (callbackError) {
                    console.error('❌ Помилка виконання колбека для критичної помилки:', callbackError);
                }
            }

            throw error;
        }
    }

    // Функція для обробки черги запитів після ініціалізації
    function processPendingRequests() {
        console.log(`⏩ Обробка ${_pendingRequests.length} відкладених запитів...`);

        // Копіюємо чергу і очищаємо оригінал
        const pendingRequests = [..._pendingRequests];
        _pendingRequests = [];

        // Обробляємо кожен запит
        pendingRequests.forEach(async request => {
            try {
                const { endpoint, method, data, callback, options, retries, resolve, reject } = request;
                const result = await apiRequest(endpoint, method, data, callback, options, retries);
                resolve(result);
            } catch (error) {
                console.error(`❌ Помилка виконання відкладеного запиту:`, error);
                request.reject(error);
            }
        });
    }

    // ======== API ФУНКЦІЇ ДЛЯ АВТОРИЗАЦІЇ ТА КОРИСТУВАЧА ========

    /**
     * Авторизація користувача
     * @param {Object} userData - Дані користувача з Telegram WebApp
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат авторизації
     */
    function authorize(userData, callback = null) {
        return apiRequest('/api/auth', 'POST', userData, callback);
    }

    /**
     * Отримання даних користувача
     * @param {Function|string} callbackOrUserId - Функція зворотного виклику або ID користувача
     * @param {Function} [callback] - Функція зворотного виклику, якщо перший параметр - ID
     * @returns {Promise<Object>} - Дані користувача
     */
    function getUserData(callbackOrUserId = null, callback = null) {
        let userId = null;

        // Визначаємо тип першого параметра
        if (typeof callbackOrUserId === 'function') {
            callback = callbackOrUserId;
        } else if (typeof callbackOrUserId === 'string') {
            userId = callbackOrUserId;
        }

        // Отримуємо ID користувача, якщо його не передано
        const id = userId || getUserId();

        if (!id) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }

        return apiRequest(`/api/user/${id}`, 'GET', null, callback);
    }

    /**
     * Оновлення даних користувача
     * @param {Object} userData - Дані для оновлення
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Оновлені дані користувача
     */
    function updateUserData(userData, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}`, 'PUT', userData, callback);
    }

    // ======== API ФУНКЦІЇ ДЛЯ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Дані стейкінгу
     */
    function getStakingData(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/staking`, 'GET', null, callback);
    }

    /**
     * Отримання історії стейкінгу
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Array>} - Історія стейкінгу
     */
    function getStakingHistory(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/staking/history`, 'GET', null, callback);
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат створення стейкінгу
     */
    function createStaking(amount, period, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/staking`, 'POST', {
            stakingAmount: Math.floor(amount),
            period: period
        }, callback);
    }

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {number} amount - Сума для додавання
     * @param {string|Function} stakingIdOrCallback - ID стейкінгу (опціонально) або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат додавання коштів
     */
    async function addToStaking(amount, stakingIdOrCallback = null, callback = null) {
        let stakingId = null;

        // Визначаємо типи параметрів
        if (typeof stakingIdOrCallback === 'function') {
            callback = stakingIdOrCallback;
        } else if (typeof stakingIdOrCallback === 'string') {
            stakingId = stakingIdOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingResult = await getStakingData();
                const stakingData = stakingResult.data || stakingResult;

                if (stakingResult.status !== 'success' && !stakingResult.hasActiveStaking ||
                    !stakingData || !stakingData.hasActiveStaking) {
                    const error = new Error("У вас немає активного стейкінгу");
                    if (callback) callback(error, null);
                    return Promise.reject(error);
                }

                targetStakingId = stakingData.stakingId;
            } catch (error) {
                if (callback) callback(error, null);
                return Promise.reject(error);
            }
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}`, 'PUT', {
            additionalAmount: Math.floor(amount)
        }, callback);
    }

    /**
     * Скасування стейкінгу
     * @param {string|Function} stakingIdOrCallback - ID стейкінгу (опціонально) або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат скасування стейкінгу
     */
    async function cancelStaking(stakingIdOrCallback = null, callback = null) {
        let stakingId = null;

        // Визначаємо типи параметрів
        if (typeof stakingIdOrCallback === 'function') {
            callback = stakingIdOrCallback;
        } else if (typeof stakingIdOrCallback === 'string') {
            stakingId = stakingIdOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingResult = await getStakingData();
                const stakingData = stakingResult.data || stakingResult;

                if (stakingResult.status !== 'success' && !stakingResult.hasActiveStaking ||
                    !stakingData || !stakingData.hasActiveStaking) {
                    const error = new Error("У вас немає активного стейкінгу");
                    if (callback) callback(error, null);
                    return Promise.reject(error);
                }

                targetStakingId = stakingData.stakingId;
            } catch (error) {
                if (callback) callback(error, null);
                return Promise.reject(error);
            }
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}/cancel`, 'POST', {
            timestamp: Date.now()
        }, callback);
    }

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Очікувана винагорода
     */
    function calculateExpectedReward(amount, period, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/staking/calculate-reward?amount=${amount}&period=${period}`, 'GET', null, callback);
    }

    /**
     * Відновлення стейкінгу
     * @param {boolean|Function} forceOrCallback - Примусове відновлення або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат відновлення стейкінгу
     */
    function repairStaking(forceOrCallback = false, callback = null) {
        let force = false;

        // Визначаємо типи параметрів
        if (typeof forceOrCallback === 'function') {
            callback = forceOrCallback;
        } else if (typeof forceOrCallback === 'boolean') {
            force = forceOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/staking/repair`, 'POST', {
            force: force,
            timestamp: Date.now()
        }, callback);
    }

    /**
     * Глибоке відновлення стейкінгу
     * @param {number|Function} adjustBalanceOrCallback - Коригування балансу або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат глибокого відновлення
     */
    function deepRepairStaking(adjustBalanceOrCallback = 0, callback = null) {
        let adjustBalance = 0;

        // Визначаємо типи параметрів
        if (typeof adjustBalanceOrCallback === 'function') {
            callback = adjustBalanceOrCallback;
        } else if (typeof adjustBalanceOrCallback === 'number') {
            adjustBalance = adjustBalanceOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/staking/deep-repair`, 'POST', {
            balance_adjustment: adjustBalance,
            timestamp: Date.now()
        }, callback);
    }

    // ======== API ФУНКЦІЇ ДЛЯ БАЛАНСУ ТА ТРАНЗАКЦІЙ ========

    /**
     * Отримання балансу користувача
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Баланс користувача
     */
    function getBalance(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/balance`, 'GET', null, callback);
    }

    /**
     * Додавання токенів
     * @param {number} amount - Кількість токенів
     * @param {string|Function} descriptionOrCallback - Опис транзакції або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат додавання токенів
     */
    function addTokens(amount, descriptionOrCallback = 'Додавання токенів', callback = null) {
        let description = 'Додавання токенів';

        // Визначаємо типи параметрів
        if (typeof descriptionOrCallback === 'function') {
            callback = descriptionOrCallback;
        } else if (typeof descriptionOrCallback === 'string') {
            description = descriptionOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/add-tokens`, 'POST', {
            amount: amount,
            description: description
        }, callback);
    }

    /**
     * Віднімання токенів
     * @param {number} amount - Кількість токенів
     * @param {string|Function} descriptionOrCallback - Опис транзакції або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат віднімання токенів
     */
    function subtractTokens(amount, descriptionOrCallback = 'Віднімання токенів', callback = null) {
        let description = 'Віднімання токенів';

        // Визначаємо типи параметрів
        if (typeof descriptionOrCallback === 'function') {
            callback = descriptionOrCallback;
        } else if (typeof descriptionOrCallback === 'string') {
            description = descriptionOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/subtract-tokens`, 'POST', {
            amount: amount,
            description: description
        }, callback);
    }

    /**
     * Додавання жетонів
     * @param {number} amount - Кількість жетонів
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат додавання жетонів
     */
    function addCoins(amount, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/add-coins`, 'POST', {
            amount: amount
        }, callback);
    }

    /**
     * Віднімання жетонів
     * @param {number} amount - Кількість жетонів
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат віднімання жетонів
     */
    function subtractCoins(amount, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/subtract-coins`, 'POST', {
            amount: amount
        }, callback);
    }

    /**
     * Конвертація жетонів в токени
     * @param {number} coinsAmount - Кількість жетонів для конвертації
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат конвертації
     */
    function convertCoinsToTokens(coinsAmount, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/convert-coins`, 'POST', {
            coins_amount: coinsAmount
        }, callback);
    }

    /**
     * Отримання історії транзакцій
     * @param {number|Function} limitOrCallback - Максимальна кількість транзакцій або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Історія транзакцій
     */
    function getTransactions(limitOrCallback = 100, callback = null) {
        let limit = 100;

        // Визначаємо типи параметрів
        if (typeof limitOrCallback === 'function') {
            callback = limitOrCallback;
        } else if (typeof limitOrCallback === 'number') {
            limit = limitOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/transactions?limit=${limit}`, 'GET', null, callback);
    }

    /**
     * Надсилання токенів іншому користувачу
     * @param {string} recipientId - ID отримувача
     * @param {number} amount - Кількість токенів
     * @param {string|Function} descriptionOrCallback - Опис транзакції або функція зворотного виклику
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат надсилання
     */
    function sendTokens(recipientId, amount, descriptionOrCallback = 'Надсилання токенів', callback = null) {
        let description = 'Надсилання токенів';

        // Визначаємо типи параметрів
        if (typeof descriptionOrCallback === 'function') {
            callback = descriptionOrCallback;
        } else if (typeof descriptionOrCallback === 'string') {
            description = descriptionOrCallback;
        }

        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/send-tokens`, 'POST', {
            recipient_id: recipientId,
            amount: amount,
            description: description
        }, callback);
    }

    // ======== API ФУНКЦІЇ ДЛЯ РЕФЕРАЛЬНОЇ СИСТЕМИ ========

    /**
     * Отримання реферального посилання
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Реферальне посилання
     */
    function getReferralLink(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/referral-link`, 'GET', null, callback);
    }

    /**
     * Отримання інформації про рефералів
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Інформація про рефералів
     */
    function getReferrals(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/referrals`, 'GET', null, callback);
    }

    /**
     * Отримання винагороди за рефералів
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат отримання винагороди
     */
    function claimReferralReward(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/claim-referral-reward`, 'POST', null, callback);
    }

    // ======== API ФУНКЦІЇ ДЛЯ TODO СИСТЕМИ ========

    /**
     * Отримання списку завдань користувача
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Список завдань
     */
    function getTodoList(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/todos`, 'GET', null, callback);
    }

    /**
     * Додавання нового завдання
     * @param {Object} task - Дані завдання
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат додавання завдання
     */
    function addTodoItem(task, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/todos`, 'POST', task, callback);
    }

    /**
     * Оновлення завдання
     * @param {string} taskId - ID завдання
     * @param {Object} taskData - Дані для оновлення
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Оновлене завдання
     */
    function updateTodoItem(taskId, taskData, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/todos/${taskId}`, 'PUT', taskData, callback);
    }

    /**
     * Видалення завдання
     * @param {string} taskId - ID завдання
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат видалення
     */
    function deleteTodoItem(taskId, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/todos/${taskId}`, 'DELETE', null, callback);
    }

    /**
     * Позначення завдання як виконаного
     * @param {string} taskId - ID завдання
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Оновлене завдання
     */
    function completeTodoItem(taskId, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/todos/${taskId}/complete`, 'POST', null, callback);
    }

    // ======== API ФУНКЦІЇ ДЛЯ РОЗІГРАШІВ ========

    /**
     * Отримання списку активних розіграшів
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Список розіграшів
     */
    function getRaffles(callback = null) {
        return apiRequest('/api/raffles', 'GET', null, callback);
    }

    /**
     * Участь у розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу ('main', 'daily', etc.)
     * @param {number} tokenAmount - Кількість жетонів для участі
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат участі
     */
    function participateInRaffle(raffleId, raffleType, tokenAmount, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest('/api/participate', 'POST', {
            userId: userId,
            raffleId: raffleId,
            raffleType: raffleType,
            tokenAmount: tokenAmount
        }, callback);
    }

    /**
     * Отримання історії розіграшів для поточного користувача
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Історія розіграшів
     */
    function getRaffleHistory(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/raffle-history`, 'GET', null, callback);
    }

    /**
     * Отримання переможців розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Список переможців
     */
    function getRaffleWinners(raffleId, callback = null) {
        return apiRequest(`/api/raffles/${raffleId}/winners`, 'GET', null, callback);
    }

    /**
     * Отримання бонусу новачка
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат отримання бонусу
     */
    function claimNewbieBonus(callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST', null, callback);
    }

    /**
     * Перевірка підписки на соціальну мережу
     * @param {string} platform - Платформа (twitter, telegram, youtube)
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат перевірки
     */
    function verifySocialSubscription(platform, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/verify-social`, 'POST', {
            platform: platform,
            timestamp: Date.now()
        }, callback);
    }

    // ======== API ФУНКЦІЇ ДЛЯ МОВНОГО МОДУЛЯ ========

    /**
     * Отримання словника для обраної мови
     * @param {string} language - Код мови (uk, en, ru)
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Словник з перекладами
     */
    function getLanguageDictionary(language, callback = null) {
        return apiRequest(`/api/language/${language}`, 'GET', null, callback);
    }

    /**
     * Отримання доступних мов
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Список доступних мов
     */
    function getAvailableLanguages(callback = null) {
        return apiRequest('/api/languages', 'GET', null, callback);
    }

    /**
     * Збереження мовних налаштувань користувача
     * @param {string} language - Код мови (uk, en, ru)
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<Object>} - Результат збереження
     */
    function saveUserLanguage(language, callback = null) {
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            if (callback) callback(error, null);
            return Promise.reject(error);
        }
        return apiRequest(`/api/user/${userId}/set-language`, 'POST', {
            language: language
        }, callback);
    }

    // ======== ВЗАЄМОДІЯ З СИСТЕМОЮ ПОДІЙ ========

    /**
     * Ініціалізація API модуля
     * @param {Function} callback - Функція зворотного виклику після ініціалізації
     */
    function initApi(callback = null) {
        if (_isReady) {
            if (callback) callback(null, { status: 'success', message: 'API вже ініціалізовано' });
            return;
        }

        try {
            console.log("🚀 Ініціалізація API модуля...");

            // Установлюємо прапорець готовності API
            _isReady = true;

            // Обробляємо чергу запитів
            processPendingRequests();

            // Відправляємо подію про ініціалізацію API
            document.dispatchEvent(new CustomEvent('winix-api-initialized'));

            console.log("✅ API модуль успішно ініціалізовано");

            if (callback) callback(null, { status: 'success', message: 'API успішно ініціалізовано' });
        } catch (error) {
            console.error("❌ Помилка ініціалізації API модуля:", error);
            if (callback) callback(error, null);
        }
    }

    /**
     * Перевірка готовності API модуля
     * @returns {boolean} Стан готовності API
     */
    function isReady() {
        return _isReady;
    }

    // ======== ПУБЛІЧНИЙ API МОДУЛЬ ========

    // Об'єкт для експорту API функцій
    const publicApi = {
        // Налаштування і утиліти
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },
        isReady,
        initApi,
        apiRequest,
        getUserId,
        handleApiError,

        // Авторизація та користувач
        authorize,
        getUserData,
        updateUserData,

        // Стейкінг
        getStakingData,
        getStakingHistory,
        createStaking,
        addToStaking,
        cancelStaking,
        calculateExpectedReward,
        repairStaking,
        deepRepairStaking,

        // Баланс та транзакції
        getBalance,
        addTokens,
        subtractTokens,
        addCoins,
        subtractCoins,
        convertCoinsToTokens,
        getTransactions,
        sendTokens,

        // Реферальна система
        getReferralLink,
        getReferrals,
        claimReferralReward,

        // Завдання
        getTodoList,
        addTodoItem,
        updateTodoItem,
        deleteTodoItem,
        completeTodoItem,

        // Розіграші
        getRaffles,
        participateInRaffle,
        getRaffleHistory,
        getRaffleWinners,
        claimNewbieBonus,
        verifySocialSubscription,

        // Мовний модуль
        getLanguageDictionary,
        getAvailableLanguages,
        saveUserLanguage
    };

    // Експортуємо всі API функції в глобальний об'єкт
    window.WinixAPI = publicApi;

    // Для зворотної сумісності експортуємо функцію apiRequest глобально
    window.apiRequest = apiRequest;

    // Запускаємо ініціалізацію API модуля
    setTimeout(initApi, 0);

    console.log("✅ API: Єдиний API модуль успішно підготовлено до ініціалізації");
})();