/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 *
 * Цей модуль централізує всі API-запити для різних функціональностей:
 * - Авторизація
 * - Стейкінг
 * - Реферали
 * - Транзакції та інші.
 */

(function() {
    'use strict';

    console.log("🔌 API: Ініціалізація єдиного API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ТА КОНСТАНТИ ========

    // Базовий URL API (за замовчуванням пустий для відносних шляхів)
    const API_BASE_URL = '';

    // Прапорець для логування запитів
    let _debugMode = false;

    // Кешовані дані користувача для уникнення частих запитів
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 60000; // 1 хвилина

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * Отримати ID користувача з доступних джерел
     * @returns {string|null} ID користувача або null, якщо не знайдено
     */
    function getUserId() {
        // Функція для перевірки валідності ID
        function isValidId(id) {
            return id &&
                   id !== 'undefined' &&
                   id !== 'null' &&
                   id !== undefined &&
                   id !== null &&
                   id.toString().trim() !== '';
        }

        // 1. Спочатку перевіряємо наявність Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                // Переконуємося, що WebApp готовий до роботи
                window.Telegram.WebApp.ready();

                // Отримуємо дані користувача
                if (window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                    if (isValidId(tgUserId)) {
                        if (_debugMode) console.log("🆔 ID користувача отримано з Telegram WebApp:", tgUserId);

                        // Зберігаємо в localStorage для наступних запитів
                        try {
                            localStorage.setItem('telegram_user_id', tgUserId);
                        } catch (e) {
                            console.warn("Не вдалося зберегти ID в localStorage:", e);
                        }

                        return tgUserId;
                    }
                }
            } catch (e) {
                console.warn("Помилка отримання ID з Telegram WebApp:", e);
            }
        }

        // 2. Перевіряємо localStorage
        try {
            const localId = localStorage.getItem('telegram_user_id');
            if (isValidId(localId)) {
                if (_debugMode) console.log("🆔 ID користувача отримано з localStorage:", localId);
                return localId;
            }
        } catch (e) {
            console.warn("Помилка доступу до localStorage:", e);
        }

        // 3. Перевіряємо DOM елемент
        try {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const domId = userIdElement.textContent.trim();
                if (isValidId(domId)) {
                    if (_debugMode) console.log("🆔 ID користувача отримано з DOM:", domId);

                    // Зберігаємо в localStorage для наступних запитів
                    try {
                        localStorage.setItem('telegram_user_id', domId);
                    } catch (e) {
                        console.warn("Не вдалося зберегти ID в localStorage:", e);
                    }

                    return domId;
                }
            }
        } catch (e) {
            console.warn("Помилка отримання ID з DOM:", e);
        }

        // 4. Перевіряємо URL параметри
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (isValidId(urlId)) {
                if (_debugMode) console.log("🆔 ID користувача отримано з URL параметрів:", urlId);

                // Зберігаємо в localStorage для наступних запитів
                try {
                    localStorage.setItem('telegram_user_id', urlId);
                } catch (e) {
                    console.warn("Не вдалося зберегти ID в localStorage:", e);
                }

                return urlId;
            }
        } catch (e) {
            console.warn("Помилка отримання ID з URL параметрів:", e);
        }

        // Повертаємо null, якщо ID не знайдено
        console.warn("⚠️ Не вдалося отримати ID користувача");
        return null;
    }

    // ======== ОСНОВНА ФУНКЦІЯ API-ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту відносно базового URL
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки (для POST/PUT запитів)
     * @param {Object} options - Додаткові параметри запиту
     * @param {number} retries - Кількість повторних спроб при помилці
     * @returns {Promise<Object>} Результат запиту у форматі JSON
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
        // Отримуємо ID користувача
        const userId = getUserId();

        // Перевіряємо наявність валідного ID користувача
        if (!userId && !options.skipUserIdCheck) {
            const error = new Error("ID користувача не знайдено");
            console.error(`❌ API-запит на ${endpoint} скасовано: ${error.message}`);
            throw error;
        }

        // Додаємо мітку часу для запобігання кешуванню
        const timestamp = Date.now();
        const url = `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}t=${timestamp}`;

        // Показуємо індикатор завантаження, якщо він не вимкнений в опціях
        if (!options.hideLoader) {
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
                ...(userId && {'X-Telegram-User-Id': userId}),
                ...options.headers
            },
            ...options
        };

        // Додаємо тіло запиту для POST/PUT/PATCH
        if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            requestOptions.body = JSON.stringify(data);
        }

        // Функція для повторного запиту при помилці
        async function tryRequest(attemptsLeft) {
            try {
                const response = await fetch(url, requestOptions);

                // Приховуємо індикатор завантаження
                if (!options.hideLoader) {
                    hideLoader();
                }

                // Перевіряємо статус відповіді
                if (!response.ok) {
                    const statusText = response.statusText || '';
                    console.error(`❌ Помилка API-запиту: ${response.status} ${statusText} (${url})`);

                    // Перевіряємо типові помилки
                    if (response.status === 401 || response.status === 403) {
                        console.warn('🔐 Помилка авторизації, спроба оновити дані користувача');
                    }

                    if (response.status === 404) {
                        throw new Error(`Запитаний ресурс недоступний (404)`);
                    }

                    if (response.status === 405) {
                        throw new Error(`Метод ${method} не дозволено для цього ресурсу (405)`);
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

                return jsonData;

            } catch (error) {
                // Приховуємо індикатор завантаження у випадку помилки
                if (!options.hideLoader) {
                    hideLoader();
                }

                // Для мережевих помилок пробуємо ще раз
                if ((error.name === 'TypeError' || error.message.includes("Failed to fetch")) && attemptsLeft > 0) {
                    const delay = Math.pow(2, retries - attemptsLeft) * 500;
                    console.log(`⚠️ Мережева помилка, повтор через ${delay}мс (залишилось спроб: ${attemptsLeft}):`, error.message);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return tryRequest(attemptsLeft - 1);
                }

                throw error;
            }
        }

        // Починаємо процес запиту з повторними спробами
        return tryRequest(retries);
    }

    // ======== ФУНКЦІЇ ДЛЯ ОБРОБКИ ПОМИЛОК ТА ЗАВАНТАЖЕННЯ ========

    /**
     * Обробка помилок API
     * @param {Error} error - Об'єкт помилки
     * @param {string} operation - Назва операції для логування
     * @returns {string} Користувацьке повідомлення про помилку
     */
    function handleApiError(error, operation = 'API операції') {
        console.error(`❌ Помилка ${operation}:`, error);

        // Отримуємо текст помилки
        let errorMessage = error.message || 'Невідома помилка';

        // Формуємо зрозуміле повідомлення залежно від типу помилки
        if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
            return `Не вдалося з'єднатися з сервером. Перевірте інтернет-з'єднання та спробуйте знову.`;
        }

        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            return `Час очікування відповіді від сервера вичерпано. Спробуйте знову пізніше.`;
        }

        if (errorMessage.includes('404')) {
            return `Сервер не може знайти потрібний ресурс (404). Спробуйте перезавантажити сторінку.`;
        }

        if (errorMessage.includes('405')) {
            return `Сервер не підтримує цей метод запиту (405). Повідомте про помилку розробникам.`;
        }

        if (errorMessage.includes('500')) {
            return `Виникла помилка на сервері (500). Будь ласка, спробуйте пізніше.`;
        }

        if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
            return `Не вдалося отримати дані. Спробуйте перезавантажити сторінку.`;
        }

        if (errorMessage.includes('ID користувача не знайдено')) {
            return `Не вдалося визначити ваш ідентифікатор. Спробуйте вийти та увійти знову.`;
        }

        // Повертаємо оригінальне повідомлення
        return errorMessage;
    }

    /**
     * Показати індикатор завантаження
     */
    function showLoader() {
        try {
            // Спочатку перевіряємо глобальний метод, який може бути визначений на сторінці
            if (typeof window.showLoading === 'function') {
                window.showLoading();
                return;
            }

            // Якщо немає глобального методу, використовуємо наш власний індикатор
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.classList.add('show');
                return;
            }

            // Якщо немає існуючого індикатора, створюємо новий
            const newSpinner = document.createElement('div');
            newSpinner.id = 'loading-spinner';
            newSpinner.innerHTML = '<div class="spinner"></div>';

            // Додаємо стилі для індикатора
            const style = document.createElement('style');
            style.textContent = `
                #loading-spinner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s, visibility 0.3s;
                }
                #loading-spinner.show {
                    opacity: 1;
                    visibility: visible;
                }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(newSpinner);

            // Показуємо індикатор
            setTimeout(() => {
                newSpinner.classList.add('show');
            }, 0);
        } catch (e) {
            console.warn("Не вдалося показати індикатор завантаження:", e);
        }
    }

    /**
     * Приховати індикатор завантаження
     */
    function hideLoader() {
        try {
            // Спочатку перевіряємо глобальний метод
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
                return;
            }

            // Якщо немає глобального методу, використовуємо наш власний індикатор
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.classList.remove('show');
            }
        } catch (e) {
            console.warn("Не вдалося приховати індикатор завантаження:", e);
        }
    }

    // ======== API ФУНКЦІЇ ДЛЯ АВТОРИЗАЦІЇ ТА КОРИСТУВАЧА ========

    /**
     * Авторизація користувача
     * @param {Object} userData - Дані користувача з Telegram WebApp
     * @returns {Promise<Object>} - Результат авторизації
     */
    async function authorize(userData) {
        const result = await apiRequest('/api/auth', 'POST', userData, {skipUserIdCheck: true});

        // Якщо авторизація успішна, зберігаємо ID користувача
        if (result.status === 'success' && result.data && result.data.telegram_id) {
            try {
                localStorage.setItem('telegram_user_id', result.data.telegram_id);
                _userCache = result.data;
                _userCacheTime = Date.now();
            } catch (e) {
                console.warn("Не вдалося зберегти дані користувача:", e);
            }
        }

        return result;
    }

    /**
     * Отримання даних користувача
     * @param {string} userId - ID користувача (опціонально)
     * @param {boolean} forceRefresh - Примусово оновити дані з сервера
     * @returns {Promise<Object>} - Дані користувача
     */
    async function getUserData(userId = null, forceRefresh = false) {
        // Використовуємо кеш, якщо він є і не застарий
        if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
            return {status: 'success', data: _userCache};
        }

        const id = userId || getUserId();
        if (!id) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${id}`);

        // Оновлюємо кеш, якщо запит успішний
        if (result.status === 'success' && result.data) {
            _userCache = result.data;
            _userCacheTime = Date.now();
        }

        return result;
    }

    /**
     * Оновлення даних користувача
     * @param {Object} userData - Дані для оновлення
     * @returns {Promise<Object>} - Оновлені дані користувача
     */
    async function updateUserData(userData) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}`, 'PUT', userData);

        // Інвалідуємо кеш при оновленні даних
        _userCache = null;
        _userCacheTime = 0;

        return result;
    }

    // ======== API ФУНКЦІЇ ДЛЯ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу
     * @returns {Promise<Object>} - Дані стейкінгу
     */
    async function getStakingData() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/staking`);
    }

    /**
     * Отримання історії стейкінгу
     * @returns {Promise<Object>} - Історія стейкінгу
     */
    async function getStakingHistory() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/staking/history`);
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} - Результат створення стейкінгу
     */
    async function createStaking(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount <= 0 || amount !== parseInt(amount)) {
            throw new Error("Сума стейкінгу має бути цілим додатним числом");
        }

        if (![7, 14, 28].includes(period)) {
            throw new Error("Період стейкінгу може бути 7, 14 або 28 днів");
        }

        return apiRequest(`/api/user/${userId}/staking`, 'POST', {
            stakingAmount: parseInt(amount),
            period: period
        });
    }

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {number} amount - Сума для додавання
     * @param {string} stakingId - ID стейкінгу (опціонально)
     * @returns {Promise<Object>} - Результат додавання коштів
     */
    async function addToStaking(amount, stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount <= 0 || amount !== parseInt(amount)) {
            throw new Error("Сума має бути цілим додатним числом");
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingData = await getStakingData();
                if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                    throw new Error("У вас немає активного стейкінгу");
                }
                targetStakingId = stakingData.data.stakingId;
            } catch (error) {
                throw new Error("Не вдалося отримати ID стейкінгу: " + error.message);
            }
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}`, 'PUT', {
            additionalAmount: parseInt(amount)
        });
    }

    /**
     * Скасування стейкінгу
     * @param {string} stakingId - ID стейкінгу (опціонально)
     * @returns {Promise<Object>} - Результат скасування стейкінгу
     */
    async function cancelStaking(stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingData = await getStakingData();
                if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                    throw new Error("У вас немає активного стейкінгу");
                }
                targetStakingId = stakingData.data.stakingId;
            } catch (error) {
                throw new Error("Не вдалося отримати ID стейкінгу: " + error.message);
            }
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}/cancel`, 'POST');
    }

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} - Очікувана винагорода
     */
    async function calculateExpectedReward(amount, period) {
        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount < 0) {
            throw new Error("Сума стейкінгу має бути додатним числом");
        }

        if (![7, 14, 28].includes(period)) {
            throw new Error("Період стейкінгу може бути 7, 14 або 28 днів");
        }

        try {
            const result = await apiRequest(`/api/user/${getUserId()}/staking/calculate-reward?amount=${amount}&period=${period}`);
            return result;
        } catch (error) {
            // Якщо API недоступний, розраховуємо локально
            console.warn("Не вдалося отримати розрахунок від сервера, використовуємо локальний розрахунок:", error);

            // Відсотки винагороди
            const rewardRates = { 7: 4, 14: 9, 28: 15 };
            const rewardPercent = rewardRates[period] || 9;
            const reward = parseFloat(((amount * rewardPercent) / 100).toFixed(2));

            return {
                status: 'success',
                data: {
                    reward: reward,
                    rewardPercent: rewardPercent,
                    amount: parseInt(amount),
                    period: period,
                    source: 'local_calculation'
                }
            };
        }
    }

    /**
     * Відновлення стейкінгу після помилок
     * @param {boolean} force - Примусове відновлення
     * @returns {Promise<Object>} - Результат відновлення
     */
    async function repairStaking(force = false) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/staking/repair`, 'POST', {
            force: force,
            timestamp: Date.now()
        });
    }

    /**
     * Глибоке відновлення стейкінгу
     * @param {number} balanceAdjustment - Коригування балансу
     * @returns {Promise<Object>} - Результат глибокого відновлення
     */
    async function deepRepairStaking(balanceAdjustment = 0) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/staking/deep-repair`, 'POST', {
            balance_adjustment: balanceAdjustment,
            timestamp: Date.now()
        });
    }

    // ======== API ФУНКЦІЇ ДЛЯ БАЛАНСУ ТА ТРАНЗАКЦІЙ ========

    /**
     * Отримання балансу користувача
     * @returns {Promise<Object>} - Баланс користувача
     */
    async function getBalance() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/balance`);
    }

    /**
     * Отримання історії транзакцій
     * @param {number} limit - Максимальна кількість транзакцій
     * @returns {Promise<Object>} - Історія транзакцій
     */
    async function getTransactions(limit = 100) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/transactions?limit=${limit}`);
    }

    /**
     * Надсилання токенів іншому користувачу
     * @param {string} recipientId - ID отримувача
     * @param {number} amount - Кількість токенів
     * @param {string} description - Опис транзакції
     * @returns {Promise<Object>} - Результат надсилання
     */
    async function sendTokens(recipientId, amount, description = 'Надсилання токенів') {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (!recipientId) {
            throw new Error("ID отримувача обов'язковий");
        }

        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума має бути додатним числом");
        }

        return apiRequest(`/api/user/${userId}/send`, 'POST', {
            to_address: recipientId,
            amount: amount,
            description: description
        });
    }

    // ======== ПУБЛІЧНИЙ API МОДУЛЬ ========

    // Експортуємо всі API функції в глобальний об'єкт
    window.WinixAPI = {
        // Налаштування
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },

        // Базова функція для API запитів
        apiRequest,

        // Функції для обробки помилок
        handleApiError,

        // Авторизація та користувач
        authorize,
        getUserData,
        updateUserData,
        getUserId,

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
        getTransactions,
        sendTokens
    };

    // Для зворотної сумісності експортуємо основні функції глобально
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    console.log("✅ API: Єдиний API модуль успішно ініціалізовано");
})();