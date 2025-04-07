/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 */

(function() {
    'use strict';

    console.log("🔌 API: Ініціалізація єдиного API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Базовий URL API
    const API_BASE_URL = '';

    // Режим відлагодження
    let _debugMode = false;

    // Кешовані дані користувача
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 60000; // 1 хвилина

    // Запобігання рекурсивним викликам
    let _gettingUserId = false;
    let _apiRequestInProgress = false;

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * Отримати ID користувача з доступних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // Запобігання рекурсії
        if (_gettingUserId) {
            return null;
        }

        _gettingUserId = true;

        try {
            // Перевірка валідності ID
            function isValidId(id) {
                return id && id !== 'undefined' && id !== 'null' &&
                       id !== undefined && id !== null && id.toString().trim() !== '';
            }

            // 1. Спочатку перевіряємо Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    if (window.Telegram.WebApp.initDataUnsafe &&
                        window.Telegram.WebApp.initDataUnsafe.user &&
                        window.Telegram.WebApp.initDataUnsafe.user.id) {

                        const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                        if (isValidId(tgUserId)) {
                            try {
                                localStorage.setItem('telegram_user_id', tgUserId);
                            } catch (e) {}

                            _gettingUserId = false;
                            return tgUserId;
                        }
                    }
                } catch (e) {}
            }

            // 2. Перевіряємо localStorage
            try {
                const localId = localStorage.getItem('telegram_user_id');
                if (isValidId(localId)) {
                    _gettingUserId = false;
                    return localId;
                }
            } catch (e) {}

            // 3. Перевіряємо DOM елемент
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const domId = userIdElement.textContent.trim();
                    if (isValidId(domId)) {
                        try {
                            localStorage.setItem('telegram_user_id', domId);
                        } catch (e) {}

                        _gettingUserId = false;
                        return domId;
                    }
                }
            } catch (e) {}

            // 4. Перевіряємо URL параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (isValidId(urlId)) {
                    try {
                        localStorage.setItem('telegram_user_id', urlId);
                    } catch (e) {}

                    _gettingUserId = false;
                    return urlId;
                }
            } catch (e) {}

            // ID не знайдено
            _gettingUserId = false;
            return null;
        } catch (e) {
            _gettingUserId = false;
            return null;
        }
    }

    // ======== ФУНКЦІЯ API-ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @param {number} retries - Кількість повторних спроб
     * @returns {Promise<Object>} Результат запиту
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 2) {
        // Запобігання паралельним запитам
        if (_apiRequestInProgress && !options.allowParallel) {
            if (options.forceContinue) {
                console.warn(`API запит вже виконується, продовжуємо: ${endpoint}`);
            } else {
                console.warn(`API запит вже виконується, очікуємо: ${endpoint}`);
                await new Promise(resolve => setTimeout(resolve, 500));

                // Рекурсивний виклик з меншою кількістю спроб
                if (retries > 1) {
                    return apiRequest(endpoint, method, data, {
                        ...options,
                        forceContinue: true
                    }, retries - 1);
                }
            }
        }

        _apiRequestInProgress = true;

        try {
            // Отримуємо ID користувача
            const userId = getUserId();

            // Перевіряємо наявність ID (якщо потрібно)
            if (!userId && !options.skipUserIdCheck) {
                throw new Error("ID користувача не знайдено");
            }

            // Додаємо мітку часу для запобігання кешуванню
            const timestamp = Date.now();
            const hasQuery = endpoint.includes('?');
            const url = `${API_BASE_URL}${endpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;

            // Показуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }
            }

            // Логування запиту
            if (_debugMode) {
                console.log(`🔄 Відправка ${method} запиту на ${url}`);
                if (data) {
                    console.log(`📦 Дані запиту:`, data);
                }
            }

            // Параметри запиту
            const requestOptions = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(userId && {'X-Telegram-User-Id': userId}),
                    ...options.headers
                }
            };

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(data);
            }

            // Виконуємо запит з повторними спробами
            let response;
            let errorResponse;

            // Спроби запиту з exponential backoff
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    // Додаємо timeout для запиту
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(),
                                                options.timeout || 15000);

                    // Додаємо signal до requestOptions
                    requestOptions.signal = controller.signal;

                    // Виконуємо запит
                    response = await fetch(url, requestOptions);

                    // Очищаємо timeout
                    clearTimeout(timeoutId);

                    // Якщо запит успішний, виходимо з циклу
                    if (response.ok) break;

                    // Зберігаємо останню помилку
                    errorResponse = response;

                    // Пауза перед наступною спробою
                    if (attempt < retries - 1) {
                        const delay = Math.pow(2, attempt) * 300; // Експоненційна затримка
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                } catch (fetchError) {
                    // Останній шанс, повертаємо помилку
                    if (attempt === retries - 1) {
                        throw fetchError;
                    }

                    // Затримка перед наступною спробою
                    const delay = Math.pow(2, attempt) * 300;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            // Обробка помилок після всіх спроб
            if (!response || !response.ok) {
                throw new Error(`Помилка сервера: ${errorResponse?.status || 'немає відповіді'}`);
            }

            // Парсимо JSON
            const jsonData = await response.json();

            // Перевіряємо наявність помилки у відповіді
            if (jsonData && jsonData.status === 'error') {
                throw new Error(jsonData.message || 'Помилка виконання запиту');
            }

            _apiRequestInProgress = false;
            return jsonData;

        } catch (error) {
            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            // Обробка помилки
            console.error(`❌ Помилка API-запиту ${endpoint}:`, error.message);

            // Відправляємо подію про помилку
            document.dispatchEvent(new CustomEvent('api-error', {
                detail: {
                    error,
                    endpoint,
                    method
                }
            }));

            // Звільняємо блокування
            _apiRequestInProgress = false;

            // Повертаємо об'єкт з помилкою, якщо вказано suppressErrors
            if (options.suppressErrors) {
                return {
                    status: 'error',
                    message: error.message || 'Сталася помилка при виконанні запиту'
                };
            }

            throw error;
        }
    }

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусово оновити
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        // Використовуємо кеш, якщо можливо
        if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
            return {status: 'success', data: _userCache};
        }

        const id = getUserId();
        if (!id) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${id}`);

        // Оновлюємо кеш
        if (result.status === 'success' && result.data) {
            _userCache = result.data;
            _userCacheTime = Date.now();

            // Зберігаємо дані в localStorage
            try {
                if (_userCache.balance !== undefined) {
                    localStorage.setItem('userTokens', _userCache.balance.toString());
                    localStorage.setItem('winix_balance', _userCache.balance.toString());
                }

                if (_userCache.coins !== undefined) {
                    localStorage.setItem('userCoins', _userCache.coins.toString());
                    localStorage.setItem('winix_coins', _userCache.coins.toString());
                }
            } catch (e) {}
        }

        return result;
    }

    /**
     * Отримання балансу користувача
     */
    async function getBalance() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/balance`);
    }

    // ======== ФУНКЦІЇ ДЛЯ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу
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
     */
    async function createStaking(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума стейкінгу має бути додатним числом");
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
     * Додавання коштів до стейкінгу
     * @param {number} amount - Сума для додавання
     * @param {string} stakingId - ID стейкінгу (опціонально)
     */
    async function addToStaking(amount, stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума має бути додатним числом");
        }

        // Отримуємо ID стейкінгу, якщо не передано
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
     */
    async function cancelStaking(stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Отримуємо ID стейкінгу, якщо не передано
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                // Спробуємо отримати з API
                const stakingData = await getStakingData();
                if (stakingData.status === 'success' && stakingData.data && stakingData.data.hasActiveStaking) {
                    targetStakingId = stakingData.data.stakingId;
                } else {
                    // Спробуємо отримати з localStorage
                    const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                    if (stakingDataStr) {
                        const localData = JSON.parse(stakingDataStr);
                        if (localData && localData.stakingId) {
                            targetStakingId = localData.stakingId;
                        }
                    }
                }

                if (!targetStakingId) {
                    throw new Error("Не вдалося отримати ID стейкінгу");
                }
            } catch (error) {
                throw new Error("Не вдалося отримати ID стейкінгу: " + error.message);
            }
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}/cancel`, 'POST', {
            confirm: true,
            timestamp: Date.now()
        });
    }

    /**
     * Розрахунок очікуваної винагороди
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     */
    async function calculateExpectedReward(amount, period) {
        // Виконуємо локальний розрахунок, без звернення до API
        // Це набагато швидше і не створює зайвих запитів

        // Перевіряємо параметри
        amount = parseInt(amount) || 0;
        period = parseInt(period) || 14;

        if (amount <= 0) {
            return { status: 'success', data: { reward: 0 } };
        }

        if (![7, 14, 28].includes(period)) {
            period = 14; // За замовчуванням
        }

        // Відсотки винагороди
        const rewardRates = { 7: 4, 14: 9, 28: 15 };
        const rewardPercent = rewardRates[period] || 9;
        const reward = (amount * rewardPercent) / 100;

        return {
            status: 'success',
            data: {
                reward: parseFloat(reward.toFixed(2)),
                rewardPercent: rewardPercent,
                amount: amount,
                period: period,
                source: 'local_calculation'
            }
        };
    }

    /**
     * Отримання транзакцій користувача
     * @param {number} limit - Кількість транзакцій
     */
    async function getTransactions(limit = 100) {
        // Реалізація без API-запитів, щоб уникнути 404 помилок
        // Повертаємо порожній масив, оскільки API транзакцій ще не реалізоване
        return {
            status: 'success',
            data: [], // Пустий масив
            message: 'Історія транзакцій тимчасово недоступна'
        };
    }

    // ======== ЕКСПОРТ API ========

    // Створюємо публічний API
    window.WinixAPI = {
        // Налаштування
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },

        // Базові функції
        apiRequest,
        getUserId,

        // Функції користувача
        getUserData,
        getBalance,

        // Функції стейкінгу
        getStakingData,
        getStakingHistory,
        createStaking,
        addToStaking,
        cancelStaking,
        calculateExpectedReward,

        // Функції транзакцій
        getTransactions
    };

    // Для зворотної сумісності
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    console.log("✅ API: Модуль успішно ініціалізовано");
})();