/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * Вдосконалена версія з покращеним механізмом кешування та обробки помилок
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
    const USER_CACHE_TTL = 300000; // 5 хвилин (збільшено)

    // Запобігання рекурсивним викликам
    let _gettingUserId = false;
    let _apiRequestInProgress = false;

    // Відстеження запитів, щоб запобігти повторним викликам
    let _lastRequestsByEndpoint = {};
    // ЗМІНЕНО: Збільшили інтервал мінімальної затримки між запитами
    const REQUEST_THROTTLE = 5000; // Мінімум 5 секунд між однаковими запитами

    // Лічильник запитів
    let _requestCounter = {
        total: 0,
        errors: 0,
        current: 0,
        lastReset: Date.now()
    };

    // Експортуємо лічильники для дебагу
    window._winixApiStats = {
        requestCounter: _requestCounter,
        lastRequests: _lastRequestsByEndpoint,
        getCacheStatus: () => {
            return {
                hasCache: !!_userCache,
                cacheTime: _userCacheTime,
                cacheTTL: USER_CACHE_TTL,
                cacheAge: Date.now() - _userCacheTime,
                isExpired: (Date.now() - _userCacheTime) > USER_CACHE_TTL
            };
        }
    };

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

            // 5. Якщо не знайдено - перевіряємо збережені значення
            try {
                const savedId = localStorage.getItem('saved_user_id') || localStorage.getItem('userId');
                if (isValidId(savedId)) {
                    _gettingUserId = false;
                    return savedId;
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
        // Перевіряємо, чи це запит до профілю користувача
        const isUserProfileRequest = endpoint.includes('/api/user/') &&
                                    !endpoint.includes('/staking') &&
                                    !endpoint.includes('/balance') &&
                                    !endpoint.includes('/claim');

        // Перевіряємо, чи не було такого ж запиту нещодавно
        const requestKey = `${method}:${endpoint}`;
        const now = Date.now();
        const lastRequestTime = _lastRequestsByEndpoint[requestKey] || 0;
        const timeSinceLastRequest = now - lastRequestTime;

        // Перевіряємо частоту запитів
        if (timeSinceLastRequest < REQUEST_THROTTLE && isUserProfileRequest) {
            console.warn(`🔌 API: Занадто частий запит до ${endpoint}, минуло ${timeSinceLastRequest}ms з попереднього запиту`);

            // Якщо є кеш для запитів даних користувача, повертаємо його
            if (isUserProfileRequest && _userCache) {
                console.log("📋 API: Повертаємо кешовані дані, наступний запит можливий через",
                           Math.ceil((REQUEST_THROTTLE - timeSinceLastRequest) / 1000), "сек.");

                return Promise.resolve({
                    status: 'success',
                    data: _userCache,
                    source: 'cache'
                });
            }

            console.log("⌛ API: Рекомендуємо почекати",
                      Math.ceil((REQUEST_THROTTLE - timeSinceLastRequest) / 1000),
                      "секунд перед наступним запитом");

            // ЗМІНЕНО: Повертаємо помилку в дружньому форматі для обробки
            return Promise.reject({
                status: 'error',
                source: 'throttle',
                message: "Занадто частий запит",
                retryAfter: REQUEST_THROTTLE - timeSinceLastRequest
            });
        }

        // Оновлюємо відстеження запитів
        _lastRequestsByEndpoint[requestKey] = now;

        // Запобігання паралельним запитам для запитів профілю
        if (_apiRequestInProgress && isUserProfileRequest && !options.allowParallel) {
            if (options.forceContinue) {
                console.warn(`🔌 API: Запит вже виконується, але продовжуємо: ${endpoint}`);
            } else {
                console.warn(`🔌 API: Запит вже виконується, використовуємо кеш: ${endpoint}`);

                // Повертаємо кешовані дані, якщо вони є
                if (isUserProfileRequest && _userCache) {
                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'cache_parallel'
                    };
                }

                // Або відхиляємо проміс з дружнім форматом помилки
                return Promise.reject({
                    status: 'error',
                    source: 'parallel',
                    message: "Запит вже виконується"
                });
            }
        }

        // Увімкнення прапорця для поточного запиту
        if (isUserProfileRequest) {
            _apiRequestInProgress = true;
        }

        // Оновлюємо лічильник запитів
        _requestCounter.total++;
        _requestCounter.current++;

        // Скидаємо лічильник поточних запитів кожні 10 секунд
        if (now - _requestCounter.lastReset > 10000) {
            _requestCounter.current = 1;
            _requestCounter.lastReset = now;
        }

        // Якщо забагато запитів - уповільнюємося
        if (_requestCounter.current > 10) {
            console.warn(`🔌 API: Забагато запитів (${_requestCounter.current}), уповільнюємося`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

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
                                                options.timeout || 5000); // Зменшуємо timeout

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

            // Парсимо JSON (з обробкою помилок)
            let jsonData;
            try {
                jsonData = await response.json();
            } catch (jsonError) {
                console.error(`🔌 API: Помилка парсингу JSON відповіді: ${jsonError.message}`);

                // ЗМІНЕНО: Спроба використати кеш при помилці парсингу
                if (isUserProfileRequest) {
                    if (_userCache) {
                        console.warn("🔌 API: Використовуємо кеш для профілю користувача після помилки парсингу JSON");

                        // Звільняємо блокування
                        if (isUserProfileRequest) {
                            _apiRequestInProgress = false;
                        }

                        return {
                            status: 'success',
                            data: _userCache,
                            source: 'cache_after_parse_error'
                        };
                    }
                    // Повідомляємо про помилку, але не підміняємо дані
                    console.error("🔌 API: Кеш відсутній, неможливо парсити відповідь з сервера");
                }

                throw new Error("Помилка парсингу відповіді");
            }

            // Перевіряємо наявність помилки у відповіді
            if (jsonData && jsonData.status === 'error') {
                throw new Error(jsonData.message || 'Помилка виконання запиту');
            }

            // Якщо це запит даних користувача, оновлюємо кеш
            if (isUserProfileRequest && jsonData.status === 'success' && jsonData.data) {
                _userCache = jsonData.data;
                _userCacheTime = now;
            }

            // Скидаємо прапорець для запитів профілю
            if (isUserProfileRequest) {
                _apiRequestInProgress = false;
            }

            return jsonData;

        } catch (error) {
            // Збільшуємо лічильник помилок
            _requestCounter.errors++;

            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            // Обробка помилки
            console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message);

            // Відправляємо подію про помилку
            document.dispatchEvent(new CustomEvent('api-error', {
                detail: {
                    error,
                    endpoint,
                    method
                }
            }));

            // Звільняємо блокування
            if (isUserProfileRequest) {
                _apiRequestInProgress = false;
            }

            // ЗМІНЕНО: Використовуємо кеш при помилці
            if (isUserProfileRequest) {
                console.warn("🔌 API: Помилка запиту даних користувача, перевіряємо кеш");

                // Використовуємо існуючий кеш, якщо він є
                if (_userCache) {
                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'cache_after_error'
                    };
                }

                // Якщо кешу немає, використовуємо дані з localStorage
                try {
                    const userId = localStorage.getItem('telegram_user_id') || localStorage.getItem('userId');
                    const username = localStorage.getItem('username') || 'WINIX User';
                    const balance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
                    const coins = parseFloat(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0');
                    const notifications = localStorage.getItem('notifications_enabled') === 'true';

                    console.warn("🔌 API: Використовуємо дані з localStorage як крайній засіб");

                    // Створюємо і зберігаємо кеш на майбутнє
                    _userCache = {
                        telegram_id: userId,
                        username: username,
                        balance: balance,
                        coins: coins,
                        notifications_enabled: notifications
                    };
                    _userCacheTime = now;

                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'localStorage_fallback'
                    };
                } catch (storageError) {
                    console.error("🔌 API: Помилка отримання даних з localStorage:", storageError);
                }
            }

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
        // ЗМІНЕНО: Додано відстеження часу запиту та логування
        const now = Date.now();
        const timeSinceLastCache = now - _userCacheTime;

        // Використовуємо кеш, якщо можливо і не потрібно примусове оновлення
        if (!forceRefresh && _userCache && (timeSinceLastCache < USER_CACHE_TTL)) {
            console.log(`📋 API: Використання кешованих даних користувача (вік: ${Math.floor(timeSinceLastCache/1000)}с)`);
            return {status: 'success', data: _userCache, source: 'cache'};
        }

        if (forceRefresh) {
            console.log("🔄 API: Примусове оновлення даних користувача");
        } else if (_userCache) {
            console.log(`🔄 API: Кеш застарів (${Math.floor(timeSinceLastCache/1000)}с), оновлюємо дані`);
        } else {
            console.log("🔄 API: Кеш відсутній, отримуємо дані користувача");
        }

        const id = getUserId();
        if (!id) {
            console.error("❌ API: ID користувача не знайдено");

            // Повідомляємо про помилку через івент
            document.dispatchEvent(new CustomEvent('user-id-missing', {
                detail: { message: "ID користувача не знайдено" }
            }));

            throw new Error("ID користувача не знайдено");
        }

        try {
            const result = await apiRequest(`/api/user/${id}`, 'GET', null, {
                timeout: 5000, // Зменшуємо таймаут для прискорення
                suppressErrors: true
            });

            // Оновлюємо кеш
            if (result.status === 'success' && result.data) {
                _userCache = result.data;
                _userCacheTime = now;

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

                    // Зберігаємо налаштування повідомлень
                    if (_userCache.notifications_enabled !== undefined) {
                        localStorage.setItem('notifications_enabled', _userCache.notifications_enabled.toString());
                    }

                    // Повідомляємо про оновлення даних через івент
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: _userCache
                    }));
                } catch (e) {
                    console.warn("🔌 API: Помилка збереження даних в localStorage:", e);
                }
            }

            return result;
        } catch (error) {
            // ЗМІНЕНО: Покращено обробку помилок
            if (error && error.source === 'throttle') {
                console.warn(`⏳ API: Обмеження частоти запитів. Наступна спроба можлива через ${Math.ceil(error.retryAfter/1000)}с`);

                // Використовуємо існуючий кеш, якщо він є
                if (_userCache) {
                    return {status: 'success', data: _userCache, source: 'cache_after_throttle'};
                }
            } else {
                console.error("🔌 API: Помилка отримання даних користувача:", error);
            }

            // Перевіряємо кеш
            if (_userCache) {
                console.warn("🔌 API: Використовуємо кеш після помилки запиту");
                return {status: 'success', data: _userCache, source: 'cache_after_error'};
            }

            // Якщо кешу немає, створюємо базові дані з localStorage
            try {
                const userId = localStorage.getItem('telegram_user_id') || localStorage.getItem('userId');
                const username = localStorage.getItem('username') || 'WINIX User';
                const balance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
                const coins = parseFloat(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0');
                const notifications = localStorage.getItem('notifications_enabled') === 'true';

                // Створюємо і зберігаємо кеш
                _userCache = {
                    telegram_id: userId,
                    username: username,
                    balance: balance,
                    coins: coins,
                    notifications_enabled: notifications
                };
                _userCacheTime = now;

                return {
                    status: 'success',
                    data: _userCache,
                    source: 'localStorage_fallback'
                };
            } catch (storageError) {
                console.error("🔌 API: Помилка створення даних з localStorage:", storageError);
            }

            // Повертаємо помилку як останній варіант
            throw error;
        }
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

    /**
     * Оновлення налаштувань користувача
     * @param {object} settings - Налаштування для оновлення
     */
    async function updateSettings(settings) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        try {
            return await apiRequest(`/api/user/${userId}/settings`, 'POST', settings);
        } catch (error) {
            console.error("🔌 API: Помилка оновлення налаштувань:", error);

            // Зберігаємо в localStorage навіть якщо API не спрацював
            if (settings.notifications_enabled !== undefined) {
                localStorage.setItem('notifications_enabled', settings.notifications_enabled.toString());
            }

            // Імітуємо успішну відповідь
            return {
                status: 'success',
                message: 'Налаштування збережено локально',
                source: 'local'
            };
        }
    }

    /**
     * Очищення кешу API
     */
    function clearCache() {
        _userCache = null;
        _userCacheTime = 0;
        _lastRequestsByEndpoint = {};
        console.log("🔌 API: Кеш очищено");
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
        clearCache,

        // Функції користувача
        getUserData,
        getBalance,
        updateSettings,

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

    // Публічні події, які можна слухати
    // - 'api-error': виникає при помилці API запиту
    // - 'user-data-updated': виникає при оновленні даних користувача
    // - 'user-id-missing': виникає, коли не вдається знайти ID користувача

    console.log("✅ API: Модуль успішно ініціалізовано");
})();