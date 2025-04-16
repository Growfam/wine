/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * Оптимізована версія: централізоване управління запитами та кешуванням
 * @version 1.3.1 (з покращеною обробкою race condition)
 */

(function() {
    'use strict';

    console.log("🔌 API: Ініціалізація єдиного API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Базовий URL - без /api на кінці!
    const API_BASE_URL = (() => {
        // Перевіряємо глобальний конфіг, якщо він існує
        if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
            // Видаляємо /api якщо він є на кінці
            let url = window.WinixConfig.apiBaseUrl;
            return url.endsWith('/api') ? url.slice(0, -4) : url;
        }

        // Визначаємо URL на основі поточного середовища
        const hostname = window.location.hostname;

        // Конкретні умови для локального середовища
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Локальне середовище - використовуємо порт 8080
            return `http://${hostname}:8080`;
        } else if (hostname.includes('testenv') || hostname.includes('staging')) {
            // Тестові середовища
            return `https://${hostname}`;
        } else {
            // Продакшн середовище
            return 'https://winixbot.com';
        }
    })();

    // Режим відлагодження
    let _debugMode = false;

    // Кешовані дані користувача
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 300000; // 5 хвилин

    // Кешовані дані стейкінгу
    let _stakingCache = null;
    let _stakingCacheTime = 0;
    const STAKING_CACHE_TTL = 180000; // 3 хвилини

    // Заблоковані ендпоінти (через rate limiting)
    let _blockedEndpoints = {};

    // Запобігання рекурсивним викликам
    let _pendingRequests = {};
    let _activeEndpoints = new Set();

    // Відстеження запитів, щоб запобігти повторним викликам
    let _lastRequestsByEndpoint = {};

    // Мінімальний інтервал між однаковими запитами (збільшено для запобігання rate-limiting)
    const REQUEST_THROTTLE = {
        '/user/': 3000,      // 3 секунд
        '/staking': 3000,    // 3 секунд
        '/balance': 3000,    // 3 секунд
        '/transactions': 3000, // 3 секунд
        '/raffles': 500,     // 0.5 секунд (виправлено - зменшено для швидшого завантаження розіграшів)
        '/participate-raffle': 5000, // 5 секунд
        'default': 1000      // 1 секунда (виправлено для кращої швидкодії)
    };

    // Лічильник запитів
    let _requestCounter = {
        total: 0,
        errors: 0,
        current: 0,
        lastReset: Date.now()
    };

    // Стан з'єднання
    let _connectionState = {
        isConnected: true,
        lastSuccessTime: Date.now(),
        failedAttempts: 0,
        maxRetries: 5
    };

    // Індикатор прогресу затримки запитів
    let _currentRateLimitTimer = null;

    // Глобальна змінна для обмеження всіх запитів при rate limiting
    let _globalRateLimited = false;
    let _globalRateLimitTime = 0;

    // Токен автентифікації
    let _authToken = null;
    let _authTokenExpiry = 0;

    // Дані для емуляції - використовувати тільки для тестування
    const DUMMY_USER_DATA = {
        telegram_id: "7066583465",
        username: "WINIX User",
        balance: 100,
        coins: 5,
        notifications_enabled: true
    };

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * Отримати ID користувача з доступних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        try {
            // Перевірка валідності ID
            function isValidId(id) {
                return id &&
                       id !== 'undefined' &&
                       id !== 'null' &&
                       id !== undefined &&
                       id !== null &&
                       typeof id !== 'function' &&
                       id.toString().trim() !== '';
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

                            return tgUserId;
                        }
                    }
                } catch (e) {
                    console.warn("🔌 API: Помилка отримання ID з Telegram WebApp:", e);
                }
            }

            // 2. Перевіряємо localStorage
            try {
                const localId = localStorage.getItem('telegram_user_id');
                if (isValidId(localId)) {
                    return localId;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з localStorage:", e);
            }

            // 3. Перевіряємо DOM елемент
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const domId = userIdElement.textContent.trim();
                    if (isValidId(domId)) {
                        try {
                            localStorage.setItem('telegram_user_id', domId);
                        } catch (e) {}

                        return domId;
                    }
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з DOM:", e);
            }

            // 4. Перевіряємо URL параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (isValidId(urlId)) {
                    try {
                        localStorage.setItem('telegram_user_id', urlId);
                    } catch (e) {}

                    return urlId;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з URL:", e);
            }

            // 5. Якщо не знайдено і це сторінка налаштувань - використовуємо тестовий ID
            const isSettingsPage = window.location.pathname.includes('general.html');
            if (isSettingsPage) {
                const testId = "7066583465";
                try {
                    localStorage.setItem('telegram_user_id', testId);
                } catch (e) {}

                return testId;
            }

            // ID не знайдено
            return null;
        } catch (e) {
            console.error("🔌 API: Критична помилка отримання ID користувача:", e);
            return null;
        }
    }

    /**
     * Отримання токену авторизації
     * @returns {string|null} Токен авторизації або null
     */
    function getAuthToken() {
        try {
            // Перевіряємо наявність токену в пам'яті
            if (_authToken && _authTokenExpiry > Date.now()) {
                return _authToken;
            }

            // Спробуємо отримати токен з localStorage
            const token = localStorage.getItem('auth_token');
            if (token && typeof token === 'string' && token.length > 5) {
                // Перевіряємо термін дії, якщо є
                const expiryStr = localStorage.getItem('auth_token_expiry');
                if (expiryStr && parseInt(expiryStr) > Date.now()) {
                    _authToken = token;
                    _authTokenExpiry = parseInt(expiryStr);
                    return token;
                } else if (!expiryStr) {
                    // Якщо немає інформації про термін дії, все одно повертаємо токен
                    _authToken = token;
                    return token;
                }
            }

            // Альтернативні джерела токену
            // 1. Перевіряємо глобальний об'єкт конфігурації
            if (window.WinixConfig && window.WinixConfig.authToken) {
                _authToken = window.WinixConfig.authToken;
                return _authToken;
            }

            // 2. Перевіряємо URL-параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlToken = urlParams.get('token') || urlParams.get('auth_token');
                if (urlToken && urlToken.length > 5) {
                    // Зберігаємо знайдений токен
                    _authToken = urlToken;
                    localStorage.setItem('auth_token', urlToken);
                    return urlToken;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання токену з URL:", e);
            }

            return null;
        } catch (e) {
            console.error("🔌 API: Критична помилка отримання токену:", e);
            return null;
        }
    }

    /**
     * Нормалізація API endpoint для уникнення проблем з URL
     * @param {string} endpoint - вхідний endpoint
     * @returns {string} нормалізований endpoint
     */
    function normalizeEndpoint(endpoint) {
        if (!endpoint) return 'api';

        // Видаляємо початковий слеш, якщо він є
        let cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        // Перевіряємо, чи вже містить endpoint 'api'
        if (cleanEndpoint.startsWith('api/')) {
            return cleanEndpoint;
        } else if (cleanEndpoint.startsWith('api')) {
            return `api/${cleanEndpoint.substring(3)}`;
        } else {
            return `api/${cleanEndpoint}`;
        }
    }

    /**
     * Перевірка валідності UUID (покращений метод)
     * @param {string} id - ID для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isValidUUID(id) {
        if (!id || typeof id !== 'string') return false;

        // Перевірка для занадто коротких ID (запобігає помилкам з ac, 46 та іншими)
        if (id.length < 10) return false;

        // Повна перевірка UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    }

    /**
     * Показує індикатор прогресу при обмеженні швидкості запитів
     * @param {string} endpoint - URL ендпоінту
     * @param {number} retryAfter - час очікування в секундах
     */
    function showRateLimitProgress(endpoint, retryAfter) {
        // Записуємо ендпоінт в заблоковані з часом до розблокування
        if (window._blockedEndpoints) {
            window._blockedEndpoints[endpoint] = Date.now() + (retryAfter * 1000);
            console.warn(`⚠️ API: Ендпоінт ${endpoint} заблоковано на ${retryAfter} секунд`);
        }

        // Показуємо повідомлення у вигляді toast (спрощено без таймера)
        if (typeof window.showToast === 'function') {
            window.showToast(`Занадто багато запитів. Зачекайте ${retryAfter} секунд`, 'warning');
        } else {
            console.warn(`Занадто багато запитів. Зачекайте ${retryAfter} секунд`);
        }
    }

    /**
     * Оновлення токену авторизації
     * @returns {Promise<string|null>} Новий токен або null
     */
   async function refreshToken() {
        // Перевіряємо, чи вже відбувається оновлення
        if (_pendingRequests['refresh-token']) {
            return _pendingRequests['refresh-token'];
        }

        // Створюємо проміс для відстеження запиту
        const refreshPromise = new Promise(async (resolve, reject) => {
            try {
                // Отримуємо ID користувача
                const userId = getUserId();
                if (!userId) {
                    throw new Error("ID користувача не знайдено");
                }

                console.log("🔄 API: Початок оновлення токену");

                // Використовуємо rawApiRequest без токену, щоб уникнути рекурсії
                const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-User-Id': userId
                    },
                    body: JSON.stringify({
                        telegram_id: userId,
                        token: _authToken || ''
                    })
                });

                if (!response.ok) {
                    throw new Error(`Помилка HTTP: ${response.status}`);
                }

                const data = await response.json();

                if (data && data.status === 'success' && data.token) {
                    // Зберігаємо новий токен
                    _authToken = data.token;

                    // Визначаємо час закінчення токену
                    if (data.expires_at) {
                        _authTokenExpiry = new Date(data.expires_at).getTime();
                    } else if (data.expires_in) {
                        _authTokenExpiry = Date.now() + (data.expires_in * 1000);
                    } else {
                        // За замовчуванням 24 години
                        _authTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
                    }

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('auth_token', _authToken);
                        localStorage.setItem('auth_token_expiry', _authTokenExpiry.toString());
                    } catch (e) {
                        console.warn("🔌 API: Помилка збереження токену в localStorage:", e);
                    }

                    console.log("✅ API: Токен успішно оновлено");

                    // Відправляємо подію про оновлення токену
                    document.dispatchEvent(new CustomEvent('token-refreshed', {
                        detail: { token: _authToken, expires_at: _authTokenExpiry }
                    }));

                    resolve(_authToken);
                } else {
                    throw new Error(data.message || "Помилка оновлення токену");
                }
            } catch (error) {
                console.error("❌ API: Помилка оновлення токену:", error);
                reject(error);
            } finally {
                // Видаляємо запит зі списку активних
                delete _pendingRequests['refresh-token'];
            }
        });

        // Зберігаємо проміс для відстеження запиту
        _pendingRequests['refresh-token'] = refreshPromise;

        return refreshPromise;
    }

    // ======== ФУНКЦІЇ API-ЗАПИТУ ========

    /**
     * Функція для примусового скидання зависаючих запитів
     * @returns {boolean} Чи було виконано скидання
     */
    function resetPendingRequests() {
        const now = Date.now();

        // Очищаємо запити старші за 15 секунд
        for (const endpoint of _activeEndpoints) {
            const lastTime = _lastRequestsByEndpoint[`GET:${endpoint}`] ||
                             _lastRequestsByEndpoint[`POST:${endpoint}`] || 0;

            if (now - lastTime > 15000) { // 15 секунд
                console.warn(`🔌 API: Скидання зависаючого запиту до ${endpoint}`);
                _activeEndpoints.delete(endpoint);
            }
        }

        // Перевірка загальної кількості активних запитів
        if (_activeEndpoints.size > 3) {
            console.warn(`🔌 API: Виявлено ${_activeEndpoints.size} активних запитів, скидаємо стан`);
            _activeEndpoints.clear();
            _pendingRequests = {};
            return true;
        }
        return false;
    }

    // Регулярна перевірка та очищення зависаючих запитів
    setInterval(resetPendingRequests, 20000); // Кожні 20 секунд

    /**
     * Безпечне оновлення значення елемента DOM
     * @param {string} elementId - ID елемента
     * @param {string|number} value - Нове значення
     * @returns {boolean} Результат оновлення
     */
    function safeUpdateValue(elementId, value) {
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
    }

    /**
     * Безпосереднє виконання запиту без додаткової логіки
     * Використовується для уникнення рекурсії в деяких випадках
     * @param {string} url - URL запиту
     * @param {string} method - HTTP метод
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @returns {Promise<Object>} Результат запиту
     */
    async function rawApiRequest(url, method, data, options = {}) {
        // Ідентифікатор для відстеження даного запиту
        const requestId = `${method}-${url}-${Date.now()}`;
        const controller = new AbortController();
        let timeoutId = null;

        try {
            // Перевірка глобального обмеження швидкості
            if (_globalRateLimited && !options.bypassThrottle) {
                const remainingTime = Math.ceil((_globalRateLimitTime - Date.now()) / 1000);
                if (remainingTime > 0) {
                    console.warn(`🔌 API: Глобальне обмеження швидкості, залишилось ${remainingTime}с`);
                    throw {
                        status: 429,
                        message: `Занадто багато запитів. Зачекайте ${remainingTime} секунд.`,
                        globalRateLimit: true,
                        retryAfter: remainingTime
                    };
                } else {
                    // Якщо час очікування минув, знімаємо обмеження
                    _globalRateLimited = false;
                    _globalRateLimitTime = 0;
                }
            }

            // Показуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }
            }

            // Запит з таймаутом
            timeoutId = setTimeout(() => {
                console.warn(`🔄 API: Таймаут запиту ${requestId}`);
                controller.abort();
            }, options.timeout || 10000);

            // Заголовки
            const headers = {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId,
                ...(options.headers || {})
            };

            // Додаємо токен авторизації, якщо потрібно
            if (!options.skipTokenCheck) {
                const token = getAuthToken();
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                }
            }

            // Додаємо ID користувача, якщо він є
            const userId = getUserId();
            if (userId && !options.skipUserIdCheck) {
                headers['X-Telegram-User-Id'] = userId;
            }

            // Перевірка чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                throw new Error("Пристрій офлайн");
            }

            // Параметри запиту
            const requestOptions = {
                method: method,
                headers: headers,
                signal: controller.signal,
                // Додаємо cache: 'no-store' для запобігання кешування
                cache: 'no-store'
            };

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                // Створюємо копію даних для безпечної модифікації
                const processedData = { ...data };

                // Перевірка та коригування raffle_id для запитів участі в розіграші
                if (url.includes('participate-raffle') && processedData) {
                    // Переконатися, що raffle_id - валідний рядок
                    if (processedData.raffle_id) {
                        // Перевірка формату UUID та конвертація
                        if (typeof processedData.raffle_id !== 'string') {
                            processedData.raffle_id = String(processedData.raffle_id);
                            console.log("🛠️ API: raffle_id конвертовано в рядок:", processedData.raffle_id);
                        }

                        // Перевірка формату UUID
                        if (!isValidUUID(processedData.raffle_id)) {
                            console.error(`❌ API: Невалідний UUID для розіграшу: ${processedData.raffle_id}`);
                            throw new Error(`Невалідний ідентифікатор розіграшу: ${processedData.raffle_id}`);
                        }
                    } else {
                        console.error("❌ API: Відсутній raffle_id в запиті участі в розіграші");
                        throw new Error("Відсутній ідентифікатор розіграшу");
                    }
                }

                requestOptions.body = JSON.stringify(processedData);
            }

            // Записуємо час початку запиту для моніторингу тривалості
            const startTime = Date.now();

            // Виконуємо запит
            console.log(`🔄 API: Відправка ${method} запиту ${requestId} на ${url}`);

            // Перевіряємо, чи URL містить /raffles/ і додаємо додаткову затримку
            if (url.includes('/raffles/') || url.includes('participate-raffle')) {
                // Додаємо випадкову затримку перед запитом для запобігання rate limiting
                const delay = Math.floor(Math.random() * 1000) + 500; // 500-1500 мс
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const response = await fetch(url, requestOptions);

            // Записуємо час завершення запиту
            const requestDuration = Date.now() - startTime;
            console.log(`✅ API: Отримано відповідь за ${requestDuration}мс для запиту ${requestId}`);

            // Очищаємо таймаут при отриманні відповіді
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            // Спеціальна обробка для 404 помилок в розіграшах
            if (response.status === 404 && url.includes('raffles')) {
                // Очищуємо кеш розіграшів, якщо такий є
                if (window.WinixRaffles && window.WinixRaffles.participation) {
                    window.WinixRaffles.participation.clearInvalidRaffleIds();
                }

                // Додаємо цей ID в список невалідних
                const raffleIdMatch = url.match(/raffles\/([^/?]+)/i);
                if (raffleIdMatch && raffleIdMatch[1] && window.WinixRaffles && window.WinixRaffles.participation) {
                    window.WinixRaffles.participation.addInvalidRaffleId(raffleIdMatch[1]);
                }

                // Показуємо користувачу більш інформативне повідомлення
                if (typeof window.showToast === 'function') {
                    window.showToast('Розіграш не знайдено або вже завершено. Оновіть список розіграшів.', 'warning');
                }

                throw new Error("Розіграш не знайдено. ID може бути застарілим.");
            }

            // Покращена обробка помилок обмеження швидкості (rate limiting)
            if (response.status === 429) {
                // Отримуємо заголовок Retry-After, якщо він є
                const retryAfter = parseInt(response.headers.get('Retry-After') || '30');

                // Зберігаємо URL ендпоінта без параметрів запиту для блокування
                const endpointBase = url.split('?')[0];

                // Записуємо ендпоінт в заблоковані з часом до розблокування
                _blockedEndpoints[endpointBase] = Date.now() + (retryAfter * 1000);
                console.warn(`⚠️ API: Ендпоінт ${endpointBase} заблоковано на ${retryAfter} секунд`);

                // Показуємо індикатор прогресу очікування
                if (typeof showRateLimitProgress === 'function') {
                    showRateLimitProgress(url, retryAfter);
                }

                // Повертаємо структуровану помилку з усіма необхідними деталями
                throw {
                    status: 429,
                    message: `Занадто багато запитів. Повторіть через ${retryAfter} секунд.`,
                    endpoint: endpointBase,
                    retryAfter: retryAfter,
                    retryTime: Date.now() + (retryAfter * 1000),
                    headers: { 'Retry-After': retryAfter }
                };
            }

            // Перевіряємо статус відповіді
            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                let errorMessage = `Помилка сервера: ${response.status}`;

                try {
                    // Спроба отримати структуроване повідомлення про помилку
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.message) {
                        errorMessage = errorJson.message;
                    } else if (errorJson.error) {
                        errorMessage = errorJson.error;
                    }
                } catch (e) {
                    // Ігноруємо помилки парсингу і використовуємо текст як є
                }

                throw new Error(errorMessage);
            }

            // Парсимо відповідь як JSON з обробкою помилок
            try {
                const jsonResponse = await response.json();
                return jsonResponse;
            } catch (jsonError) {
                console.error(`❌ API: Помилка парсингу JSON відповіді: ${jsonError.message}`);
                throw new Error('Отримано некоректну відповідь від сервера');
            }
        } catch (error) {
            // Обов'язково очищаємо таймаут при помилці
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            // Логуємо помилку з додатковою інформацією
            console.error(`❌ API: Помилка запиту ${requestId}: ${error.message || error}`);

            // Перехоплюємо помилки AbortError (таймаут) для кращого повідомлення
            if (error.name === 'AbortError') {
                throw new Error('Запит було перервано через таймаут');
            }

            // Повертаємо оригінальну помилку
            throw error;
        }
    }

    /**
     * Допоміжна функція для визначення мінімального інтервалу між запитами
     * @param {string} endpoint - URL ендпоінту
     * @returns {number} Мінімальний інтервал у мілісекундах
     */
    function getThrottleTime(endpoint) {
        for (const key in REQUEST_THROTTLE) {
            if (endpoint.includes(key)) {
                return REQUEST_THROTTLE[key];
            }
        }
        return REQUEST_THROTTLE.default;
    }

    /**
     * Оптимізований запит до API з додатковою логікою обмеження та захисту
     * @param {string} endpoint - URL ендпоінту
     * @param {string} method - HTTP метод
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @param {number} retries - Кількість повторних спроб при помилці
     * @returns {Promise<Object>} Результат запиту
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 2) {
        try {
            // Перевірка глобального обмеження швидкості
            if (_globalRateLimited && !options.bypassThrottle) {
                const remainingTime = Math.ceil((_globalRateLimitTime - Date.now()) / 1000);
                if (remainingTime > 0) {
                    console.warn(`🔌 API: Глобальне обмеження швидкості, залишилось ${remainingTime}с`);

                    // ВИПРАВЛЕННЯ: Дозволяємо запитам до розіграшів працювати незалежно від глобального обмеження
                    if (endpoint.includes('/raffles') && !endpoint.includes('participate')) {
                        console.log(`🔄 Дозволяємо запит до розіграшів, незважаючи на глобальне обмеження`);
                        // Продовжуємо виконання для запитів розіграшів
                    }
                    // Для інших запитів - перевіряємо кеш або блокуємо
                    else {
                        // Перевіряємо чи це запит до профілю користувача
                        const isUserProfileRequest = endpoint.includes('/user/') &&
                                          !endpoint.includes('/staking') &&
                                          !endpoint.includes('/balance') &&
                                          !endpoint.includes('/claim');

                        // Якщо є кеш для запитів даних користувача і запит не вимагає свіжих даних
                        if (isUserProfileRequest && _userCache && !options.forceRefresh) {
                            return Promise.resolve({
                                status: 'success',
                                data: _userCache,
                                source: 'cache_global_limit'
                            });
                        }

                        return Promise.reject({
                            status: 'rate_limited',
                            message: `Глобальне обмеження швидкості. Залишилось ${remainingTime}с`,
                            retryAfter: _globalRateLimitTime - Date.now()
                        });
                    }
                } else {
                    // Якщо час очікування минув, знімаємо обмеження
                    _globalRateLimited = false;
                    _globalRateLimitTime = 0;
                }
            }

            // Додаткова перевірка для запитів участі в розіграшах
            if (endpoint.includes('participate-raffle')) {
                // Переконуємося, що ми не робимо забагато запитів на участь
                const now = Date.now();
                const participationKey = `${method}:${endpoint}:participation`;
                const lastParticipationTime = _lastRequestsByEndpoint[participationKey] || 0;

                // Більш суворе обмеження для запитів участі - 5 секунд
                if (now - lastParticipationTime < 5000 && !options.bypassThrottle) {
                    const waitTime = Math.ceil((5000 - (now - lastParticipationTime)) / 1000);
                    console.warn(`🔌 API: Надто частий запит участі в розіграші, зачекайте ${waitTime}с`);

                    return Promise.reject({
                        status: 'rate_limited',
                        message: `Зачекайте ${waitTime} секунд перед наступною спробою участі`,
                        retryAfter: 5000 - (now - lastParticipationTime)
                    });
                }

                // Оновлюємо час останнього запиту
                _lastRequestsByEndpoint[participationKey] = now;

                // Перевірка параметрів запиту на участь
                if (data) {
                    if (!data.raffle_id || typeof data.raffle_id !== 'string' || data.raffle_id.length < 10) {
                        console.error('❌ API: Невалідний ID розіграшу:', data.raffle_id);
                        return Promise.reject({
                            status: 'error',
                            message: 'Невалідний ідентифікатор розіграшу'
                        });
                    }

                    // Переконуємося що entry_count - ціле число більше 0
                    if (data.entry_count) {
                        data.entry_count = parseInt(data.entry_count);
                        if (isNaN(data.entry_count) || data.entry_count <= 0) {
                            data.entry_count = 1;
                        }
                    }
                }
            }

            // Перевірка даних для участі в розіграші чи запиту деталей розіграшу
            if ((endpoint.includes('participate-raffle') || endpoint.includes('raffles/')) && data && data.raffle_id) {
                // Перевіряємо формат UUID
                if (typeof data.raffle_id !== 'string') {
                    data.raffle_id = String(data.raffle_id);
                }

                // Ретельна перевірка формату UUID
                if (!isValidUUID(data.raffle_id)) {
                    console.error(`❌ API: Невалідний UUID: ${data.raffle_id}`);
                    return Promise.reject({
                        status: 'error',
                        message: 'Невалідний ідентифікатор розіграшу'
                    });
                }
            }

            // Перевірка endpoint при запиті деталей розіграшу
            if (endpoint.includes('raffles/')) {
                const raffleIdMatch = endpoint.match(/raffles\/([^/?]+)/i);
                if (raffleIdMatch && raffleIdMatch[1]) {
                    const raffleId = raffleIdMatch[1];
                    if (!isValidUUID(raffleId)) {
                        console.error(`❌ API: Невалідний UUID в URL: ${raffleId}`);
                        return Promise.reject({
                            status: 'error',
                            message: 'Невалідний ідентифікатор розіграшу в URL'
                        });
                    }
                }
            }

            // Перевіряємо, чи це запит до профілю користувача
            const isUserProfileRequest = endpoint.includes('/user/') &&
                                        !endpoint.includes('/staking') &&
                                        !endpoint.includes('/balance') &&
                                        !endpoint.includes('/claim');

            // Формуємо ключ для відстеження запитів
            const requestKey = `${method}:${endpoint}`;

            // Перевірка на блокування endpoint через rate limiting
            const now = Date.now();
            if (_blockedEndpoints[endpoint] && !options.bypassThrottle) {
                const blockedUntil = _blockedEndpoints[endpoint];

                if (now < blockedUntil) {
                    const remainingTime = Math.ceil((blockedUntil - now) / 1000);
                    console.warn(`🔵 API: Запит до ${endpoint} тимчасово заблоковано через rate limiting. Залишилось ${remainingTime}с`);

                    // Для запитів профілю користувача можемо використати кеш
                    if (isUserProfileRequest && _userCache && !options.forceRefresh) {
                        return Promise.resolve({
                            status: 'success',
                            data: _userCache,
                            source: 'cache_rate_limited'
                        });
                    }

                    return Promise.reject({
                        status: 'rate_limited',
                        message: `Занадто багато запитів. Повторна спроба через ${remainingTime} секунд.`,
                        retryAfter: blockedUntil - now
                    });
                }

                // Якщо блокування закінчилось, видаляємо його
                delete _blockedEndpoints[endpoint];
            }

            // Перевіряємо, чи не було такого ж запиту нещодавно
            const lastRequestTime = _lastRequestsByEndpoint[requestKey] || 0;

            // Спеціальний дозвіл для запитів user/{userId}/raffles - ми хочемо, щоб цей запит
            // мав пріоритет і завжди виконувався для швидкого отримання статусу участі
            if (!endpoint.includes('/user/') || !endpoint.includes('/raffles')) {
                const throttleTime = getThrottleTime(endpoint);

                // Перевіряємо частоту запитів
                if (now - lastRequestTime < throttleTime && !options.bypassThrottle) {
                    console.warn(`🔌 API: Занадто частий запит до ${endpoint}, ігноруємо`);

                    // Якщо є кеш для запитів даних користувача і запит не вимагає свіжих даних
                    if (isUserProfileRequest && _userCache && !options.forceRefresh) {
                        return Promise.resolve({
                            status: 'success',
                            data: _userCache,
                            source: 'cache'
                        });
                    }

                    return Promise.reject({
                        status: 'rate_limited',
                        message: "Занадто частий запит",
                        retryAfter: throttleTime - (now - lastRequestTime)
                    });
                }
            }

            // Оновлюємо відстеження запитів
            _lastRequestsByEndpoint[requestKey] = now;

            // Перевіряємо, чи цей запит вже виконується
            // Спеціальні умови для запитів участі в розіграшах
            const isParticipationRequest = endpoint.includes('participate-raffle');
            if (_activeEndpoints.has(endpoint) && !options.allowParallel && !isParticipationRequest) {
                console.warn(`🔌 API: Запит до ${endpoint} вже виконується`);

                // Якщо є кеш і запит не вимагає свіжих даних
                if (isUserProfileRequest && _userCache && !options.forceRefresh) {
                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'cache_parallel'
                    };
                }

                // Створюємо новий запит тільки якщо це критично важливо
                if (!options.forceContinue) {
                    return Promise.reject({
                        status: 'parallel_request',
                        message: "Запит вже виконується",
                        source: 'parallel'
                    });
                }
            }

            // Перевірка чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                console.warn("🔌 API: Пристрій офлайн, використовуємо кеш");

                // Якщо є кеш для запитів даних користувача
                if (isUserProfileRequest && _userCache) {
                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'cache_offline'
                    };
                }

                return Promise.reject({
                    status: 'offline',
                    message: "Пристрій офлайн",
                    source: 'offline'
                });
            }

            // Додаємо запит до активних
            _activeEndpoints.add(endpoint);

            // Оновлюємо лічильник запитів
            _requestCounter.total++;
            _requestCounter.current++;

            // Скидаємо лічильник поточних запитів кожні 10 секунд
            if (now - _requestCounter.lastReset > 10000) {
                _requestCounter.current = 1;
                _requestCounter.lastReset = now;
            }

            // Якщо забагато запитів - уповільнюємося
            if (_requestCounter.current > 5 && !options.bypassThrottle) {
                console.warn(`🔌 API: Забагато запитів (${_requestCounter.current}), уповільнюємося`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            try {
                // Перевіряємо необхідність оновлення токену
                if (!options.skipTokenCheck && _authToken && _authTokenExpiry) {
                    // Оновлюємо токен, якщо він скоро закінчиться (менше 10 хвилин)
                    if (_authTokenExpiry < Date.now() + 600000 && !_pendingRequests['refresh-token']) {
                        try {
                            await refreshToken();
                        } catch (tokenError) {
                            console.warn("🔌 API: Помилка оновлення токену:", tokenError);
                        }
                    }
                }

                // Отримуємо ID користувача, якщо потрібно
                const userId = options.skipUserIdCheck ? null : getUserId();

                // Перевіряємо наявність ID (якщо потрібно)
                if (!userId && !options.skipUserIdCheck) {
                    throw new Error("ID користувача не знайдено");
                }

                // Додаємо мітку часу для запобігання кешуванню
                const timestamp = Date.now();

                // Формуємо URL запиту
                let url;

                // Перевіряємо, чи endpoint вже є повним URL
                if (endpoint.startsWith('http')) {
                    // Endpoint вже є повним URL - використовуємо як є
                    url = endpoint;
                } else {
                    // Нормалізуємо endpoint для правильного формату
                    const normalizedEndpoint = normalizeEndpoint(endpoint);

                    // Перевіряємо, чи є параметри запиту
                    const hasQuery = normalizedEndpoint.includes('?');

                    // Формуємо повний URL
                    url = `${API_BASE_URL}/${normalizedEndpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;
                }

                // Логування запиту
                if (_debugMode) {
                    console.log(`🔄 Відправка ${method} запиту на ${url}`);
                    if (data) {
                        console.log(`📦 Дані запиту:`, data);
                    }
                }

                // Виконуємо запит з повторними спробами
                let response;
                let errorResponse;
                let lastError;

                // Спроби запиту з exponential backoff
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        // Якщо це запит на участь в розіграші, і це повторна спроба - додаємо затримку
                        if (isParticipationRequest && attempt > 0) {
                            const delayTime = Math.pow(2, attempt) * 1000; // 2, 4, 8 секунд...
                            await new Promise(resolve => setTimeout(resolve, delayTime));
                            console.log(`🔄 API: Повторна спроба #${attempt+1} для запиту участі після ${delayTime}мс затримки`);
                        }

                        // Виконуємо запит через rawApiRequest
                        response = await rawApiRequest(url, method, data, {
                            ...options,
                            timeout: isParticipationRequest ? 20000 : (options.timeout || 15000), // Збільшуємо таймаут для запитів участі
                            bypassThrottle: options.bypassThrottle || (attempt > 0) || isParticipationRequest // Пропускаємо обмеження при повторних спробах
                        });

                        // Якщо запит успішний, виходимо з циклу
                        if (response && response.status !== 'error') break;

                        // Зберігаємо останню помилку
                        errorResponse = response;
                        lastError = new Error(response.message || 'Помилка виконання запиту');

                        // Перевіряємо чи це критична помилка участі в розіграші
                        if (isParticipationRequest &&
                            response.status === 'error' &&
                            response.message &&
                            response.message.includes('занадто багато запитів')) {
                            // Зберігаємо глобальне обмеження на 30 секунд
                            _globalRateLimited = true;
                            _globalRateLimitTime = Date.now() + 30000;

                            // Зберігаємо в localStorage для відновлення після перезавантаження
                            try {
                                localStorage.setItem('winix_rate_limited_until', _globalRateLimitTime.toString());
                            } catch(e) { /* ігноруємо помилки */ }

                            throw {
                                status: 429,
                                message: response.message,
                                globalRateLimit: true,
                                retryAfter: 30
                            };
                        }

                        // Пауза перед наступною спробою
                        if (attempt < retries - 1) {
                            const delay = Math.pow(2, attempt) * 1000; // Експоненційна затримка: 1с, 2с, 4с...
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    } catch (fetchError) {
                        lastError = fetchError;

                        // Спеціальна обробка для 429 (Too Many Requests)
                        if (fetchError.status === 429) {
                            // Отримуємо час очікування з заголовка або за замовчуванням
                            const retryAfter = fetchError.headers?.['Retry-After'] || 30;
                            const waitTime = parseInt(retryAfter);

                            console.log(`⏳ Отримано 429 (Too Many Requests), чекаємо ${retryAfter}с...`);

                            // Блокуємо endpoint на вказаний час
                            _blockedEndpoints[endpoint] = Date.now() + (waitTime * 1000);

                            // ВИПРАВЛЕННЯ: Обмежуємо лише участь в розіграшах, а не всі запити
                            if (isParticipationRequest) {
                                // Замість глобального блокування, блокуємо тільки запити на участь
                                _blockedEndpoints['/participate-raffle'] = Date.now() + (waitTime * 1000);

                                // КРИТИЧНЕ ВИПРАВЛЕННЯ: Не встановлюємо глобальне обмеження
                                // Закоментовано проблемний код:
                                // _globalRateLimited = true;
                                // _globalRateLimitTime = Date.now() + (waitTime * 1000);
                                // localStorage.setItem('winix_rate_limited_until', _globalRateLimitTime.toString());

                                console.log(`⚠️ Блокування тільки запитів участі на ${waitTime} секунд`);
                            }

                            // Показуємо індикатор прогресу очікування
                            if (typeof showRateLimitProgress === 'function') {
                                showRateLimitProgress(endpoint, waitTime);
                            }

                            throw {
                                status: 'rate_limited',
                                message: `Занадто багато запитів. Повторна спроба через ${retryAfter} секунд.`,
                                retryAfter: waitTime * 1000
                            };
                        }

                        // Спеціальна обробка для 401 помилки - спроба оновити токен
                        if (fetchError.status === 401 && !options.skipTokenCheck && attempt === 0) {
                            try {
                                await refreshToken();
                                // Після оновлення токену продовжуємо
                                continue;
                            } catch (tokenError) {
                                console.warn("🔌 API: Помилка оновлення токену при 401:", tokenError);
                            }
                        }

                        // Останній шанс, повертаємо помилку
                        if (attempt === retries - 1) {
                            throw fetchError;
                        }

                        // Затримка перед наступною спробою
                        const delay = Math.pow(2, attempt) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                // Обробка помилок після всіх спроб
                if (!response || response.status === 'error') {
                    throw lastError || new Error(errorResponse?.message || 'Помилка виконання запиту');
                }

                // Оновлюємо стан підключення при успішному запиті
                _connectionState.isConnected = true;
                _connectionState.lastSuccessTime = Date.now();
                _connectionState.failedAttempts = 0;

                // Якщо це запит даних користувача, оновлюємо кеш
                if (isUserProfileRequest && response.status === 'success' && response.data) {
                    _userCache = response.data;
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

                        // Відправляємо подію оновлення даних користувача
                        document.dispatchEvent(new CustomEvent('user-data-updated', {
                            detail: _userCache,
                            source: 'api.js'
                        }));
                    } catch (e) {
                        console.warn("🔌 API: Помилка збереження даних в localStorage:", e);
                    }
                }

                return response;
            } catch (error) {
                // Збільшуємо лічильник помилок
                _requestCounter.errors++;

                // Оновлюємо стан підключення при помилці
                _connectionState.failedAttempts++;

                // Скидаємо стан запиту
                _activeEndpoints.delete(endpoint);

                // Якщо запит тривав занадто довго, очищаємо інші потенційно зависаючі запити
                if (now - lastRequestTime > 15000) {
                    resetPendingRequests();
                }

                // Обробка спеціальних помилок
                if (error.status === 'rate_limited' || error.status === 429) {
                    // Якщо це помилка rate_limited або 429, встановлюємо глобальне обмеження для запитів участі
                    if (isParticipationRequest) {
                        const retryTime = error.retryAfter || 30000;
                        _globalRateLimited = true;
                        _globalRateLimitTime = Date.now() + retryTime;

                        // Зберігаємо в localStorage
                        localStorage.setItem('winix_rate_limited_until', _globalRateLimitTime.toString());
                    }

                    return Promise.reject(error); // Передаємо помилку обмеження швидкості далі
                }

                // Звичайна обробка інших помилок
                console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message || error);

                // Відправляємо подію про помилку
                document.dispatchEvent(new CustomEvent('api-error', {
                    detail: {
                        error,
                        endpoint,
                        method
                    }
                }));

                // Повертаємо об'єкт з помилкою, якщо вказано suppressErrors
                if (options.suppressErrors) {
                    return {
                        status: 'error',
                        message: error.message || 'Сталася помилка при виконанні запиту',
                        source: 'api_error'
                    };
                }

                throw error;
            } finally {
                // Видаляємо запит зі списку активних
                _activeEndpoints.delete(endpoint);
            }
        } catch (error) {
            console.error(`❌ API: Глобальна помилка запиту ${endpoint}:`, error);

            if (options.suppressErrors) {
                return {
                    status: 'error',
                    message: error.message || 'Сталася критична помилка при виконанні запиту',
                    source: 'global_error'
                };
            }

            throw error;
        }
    }

    /**
     * Завантаження всіх початкових даних користувача одним запитом
     * Замінює кілька окремих запитів та пришвидшує початкове завантаження
     * @param {boolean} forceRefresh - Примусово оновити дані
     * @returns {Promise<Object>} Результат із даними ініціалізації
     */
    async function loadInitData(forceRefresh = false) {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            // Використовуємо кеш, якщо можливо і не вимагається примусове оновлення
            if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
                console.log("🔵 Використовуємо кешовані дані користувача для швидкої ініціалізації");
                return {status: 'success', data: _userCache, source: 'cache'};
            }

            console.log("🔄 Початок завантаження початкових даних користувача");

            // Формуємо запит до нового API
            const response = await apiRequest(`user/${userId}/init_data`, 'GET', null, {
                timeout: 8000, // Збільшений таймаут для завантаження всіх даних
                suppressErrors: true, // Обробляємо помилки локально
                bypassThrottle: true // Важливий запит, який не повинен обмежуватись
            });

            // Перевіряємо успішність відповіді
            if (response && response.status === 'success' && response.data) {
                // Оновлюємо кеш
                _userCache = response.data;
                _userCacheTime = Date.now();

                // Зберігаємо важливі дані в localStorage для офлайн-доступу
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

                    // Зберігаємо ID користувача, якщо він не збережений
                    if (_userCache.id) {
                        localStorage.setItem('telegram_user_id', _userCache.id.toString());
                    }
                } catch (e) {
                    console.warn("🔌 API: Помилка збереження даних в localStorage:", e);
                }

                // Відправляємо подію про завантаження даних користувача
                document.dispatchEvent(new CustomEvent('user-data-loaded', {
                    detail: _userCache
                }));

                console.log(`✅ Успішно завантажено початкові дані користувача: ${_userCache.username}`);
                return {status: 'success', data: _userCache};
            } else {
                throw new Error(response?.message || "Помилка завантаження початкових даних");
            }
        } catch (error) {
            console.error("❌ API: Помилка завантаження початкових даних:", error);

            // Намагаємось відновити з кешу, якщо є
            if (_userCache) {
                return {status: 'success', data: _userCache, source: 'cache_after_error'};
            }

            // Спробуємо отримати дані окремими запитами як запасний варіант
            try {
                console.log("🔄 Запасний варіант: спроба завантаження даних окремими запитами");
                const [profileResponse, balanceResponse] = await Promise.all([
                    apiRequest(`user/${getUserId()}`, 'GET', null, {suppressErrors: true}),
                    apiRequest(`user/${getUserId()}/balance`, 'GET', null, {suppressErrors: true})
                ]);

                const fallbackData = {
                    id: getUserId(),
                    username: profileResponse?.data?.username || "WINIX User",
                    balance: balanceResponse?.data?.balance || 0,
                    coins: balanceResponse?.data?.coins || 0,
                    source: 'fallback_requests'
                };

                // Зберігаємо отримані дані в кеш
                _userCache = fallbackData;
                _userCacheTime = Date.now();

                return {status: 'success', data: fallbackData, source: 'fallback_requests'};
            } catch (fallbackError) {
                console.error("❌ API: Помилка запасного варіанту:", fallbackError);

                // Останній рубіж - використовуємо локальні дані
                const localData = {
                    id: getUserId() || localStorage.getItem('telegram_user_id') || 'unknown',
                    username: "WINIX User",
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'local_storage_fallback'
                };

                return {status: 'success', data: localData, source: 'local_storage_fallback'};
            }
        }
    }

    // Функція для швидкого оновлення відображення балансу з кешованих даних
    function updateBalanceDisplay(balanceData = null) {
        // Використовуємо передані дані або беремо з кешу
        const data = balanceData || (_userCache || {});

        // Оновлюємо відображення балансу у всіх можливих елементах
        if (data.coins !== undefined) {
            const coinsElements = document.querySelectorAll('#user-coins, .user-coins, [data-balance-type="coins"]');
            coinsElements.forEach(element => {
                if (element) element.textContent = data.coins;
            });
        }

        if (data.balance !== undefined) {
            const balanceElements = document.querySelectorAll('#user-tokens, .user-tokens, [data-balance-type="tokens"]');
            balanceElements.forEach(element => {
                if (element) element.textContent = data.balance;
            });
        }
    }

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусово оновити
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        const isSettingsPage = window.location.pathname.includes('general.html');

        // Спочатку спробуємо використати новий метод loadInitData для оптимізації
        if (typeof loadInitData === 'function') {
            try {
                const initDataResult = await loadInitData(forceRefresh);

                // Якщо отримали дані успішно, форматуємо їх для сумісності зі старим кодом
                if (initDataResult.status === 'success' && initDataResult.data) {
                    const formattedData = {
                        ...initDataResult.data,
                        telegram_id: initDataResult.data.id || initDataResult.data.telegram_id
                    };

                    return {
                        status: 'success',
                        data: formattedData,
                        source: initDataResult.source || 'init_data'
                    };
                }
            } catch (initError) {
                console.warn("🔌 API: Помилка використання loadInitData, спробуємо запасний варіант:", initError);
                // Продовжуємо виконання старого коду як запасний варіант
            }
        }

        // Запасний варіант зі старою логікою, якщо loadInitData недоступний або завершився з помилкою

        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
            console.warn("🔌 API: Пристрій офлайн, використовуємо кешовані дані");

            // Якщо є кешовані дані, повертаємо їх
            if (_userCache) {
                return {status: 'success', data: _userCache, source: 'cache_offline'};
            }

            // В офлайн режимі на сторінці налаштувань повертаємо симульовані дані
            if (isSettingsPage) {
                return {
                    status: 'success',
                    data: DUMMY_USER_DATA,
                    source: 'simulated_offline'
                };
            }

            // Створюємо базові дані з localStorage
            return {
                status: 'success',
                data: {
                    telegram_id: getUserId() || 'unknown',
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_offline'
            };
        }

        // Використовуємо кеш, якщо можливо
        if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
            return {status: 'success', data: _userCache, source: 'cache'};
        }

        const id = getUserId();
        if (!id) {
            if (isSettingsPage) {
                // На сторінці налаштувань повертаємо симульовані дані
                return {
                    status: 'success',
                    data: DUMMY_USER_DATA,
                    source: 'simulated'
                };
            }
            throw new Error("ID користувача не знайдено");
        }

        try {
            const result = await apiRequest(`user/${id}`, 'GET', null, {
                timeout: 5000, // Зменшуємо таймаут для прискорення
                suppressErrors: isSettingsPage // На сторінці налаштувань не показуємо помилки
            });

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

                    // Зберігаємо налаштування повідомлень
                    if (_userCache.notifications_enabled !== undefined) {
                        localStorage.setItem('notifications_enabled', _userCache.notifications_enabled.toString());
                    }

                    // Відправляємо подію оновлення даних користувача
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: _userCache,
                        source: 'api.js'
                    }));
                } catch (e) {
                    console.warn("🔌 API: Помилка збереження даних в localStorage:", e);
                }
            }

            return result;
        } catch (error) {
            console.error("🔌 API: Помилка отримання даних користувача:", error);

            // На сторінці налаштувань повертаємо симульовані дані при помилці
            if (isSettingsPage) {
                if (_userCache) {
                    return {status: 'success', data: _userCache, source: 'cache_after_error'};
                }

                return {
                    status: 'success',
                    data: DUMMY_USER_DATA,
                    source: 'simulated'
                };
            }

            // Якщо є кешовані дані, повертаємо їх
            if (_userCache) {
                return {status: 'success', data: _userCache, source: 'cache_after_error'};
            }

            // Створюємо базові дані з localStorage
            const localData = {
                telegram_id: id,
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0')
            };

            return {
                status: 'success',
                data: localData,
                source: 'local_storage_fallback'
            };
        }
    }

    /**
     * Отримання балансу користувача
     * @param {boolean} useCache - Чи використовувати кешовані дані, якщо вони є
     * @returns {Promise<Object>} Баланс користувача
     */
    async function getBalance(useCache = true) {
        // Спробуємо спочатку отримати дані з loadInitData для оптимізації
        if (useCache && typeof loadInitData === 'function' && _userCache) {
            // Якщо у нас вже є кешовані дані з loadInitData, використаємо їх
            if (_userCache && _userCache.balance !== undefined && _userCache.coins !== undefined) {
                console.log("🔵 Використовуємо кешовані дані балансу");
                return {
                    status: 'success',
                    data: {
                        balance: _userCache.balance,
                        coins: _userCache.coins
                    },
                    source: 'init_data_cache'
                };
            }

            try {
                // Завантажимо дані через ініціалізацію
                const initResult = await loadInitData(false);
                if (initResult.status === 'success' && initResult.data) {
                    return {
                        status: 'success',
                        data: {
                            balance: initResult.data.balance || 0,
                            coins: initResult.data.coins || 0
                        },
                        source: 'init_data'
                    };
                }
            } catch (initError) {
                console.warn("🔌 API: Помилка отримання балансу через loadInitData:", initError);
                // Продовжуємо з традиційним підходом
            }
        }

        // Традиційний підхід, якщо не використовується кеш або виникла помилка
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
            console.warn("🔌 API: Пристрій офлайн, використовуємо кешовані дані балансу");

            // Повертаємо дані з localStorage
            return {
                status: 'success',
                data: {
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_offline'
            };
        }

        try {
            const result = await apiRequest(`user/${userId}/balance`);

            // Якщо отримали нові дані, оновимо кеш ініціалізації
            if (result.status === 'success' && result.data && _userCache) {
                _userCache.balance = result.data.balance;
                _userCache.coins = result.data.coins;
                _userCacheTime = Date.now();
            }

            return result;
        } catch (error) {
            console.error("🔌 API: Помилка отримання балансу:", error);

            // Повертаємо дані з localStorage при помилці
            return {
                status: 'success',
                data: {
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_fallback'
            };
        }
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

        // Використовуємо кеш, якщо можливо
        if (_stakingCache && (Date.now() - _stakingCacheTime < STAKING_CACHE_TTL)) {
            return {status: 'success', data: _stakingCache, source: 'cache'};
        }

        return apiRequest(`user/${userId}/staking`);
    }

    /**
     * Отримання історії стейкінгу
     */
    async function getStakingHistory() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`user/${userId}/staking/history`);
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

        return apiRequest(`user/${userId}/staking`, 'POST', {
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

        return apiRequest(`user/${userId}/staking/${targetStakingId}`, 'PUT', {
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
                        try {
                            const localData = JSON.parse(stakingDataStr);
                            if (localData && localData.stakingId) {
                                targetStakingId = localData.stakingId;
                            }
                        } catch (e) {
                            console.warn("🔌 API: Помилка парсингу даних стейкінгу з localStorage:", e);
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

        return apiRequest(`user/${userId}/staking/${targetStakingId}/cancel`, 'POST', {
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
        // Перевіряємо наявність ID користувача
        const userId = getUserId();
        if (!userId) {
            return {
                status: 'error',
                message: 'ID користувача не знайдено'
            };
        }

        // Виконуємо запит до серверу
        try {
            return await apiRequest(`user/${userId}/transactions?limit=${limit}`, 'GET', null, {
                suppressErrors: true
            });
        } catch (error) {
            console.warn("🔌 API: Транзакції недоступні:", error);
            // Повертаємо порожній масив, оскільки API транзакцій може бути не реалізоване
            return {
                status: 'success',
                data: [], // Пустий масив
                message: 'Історія транзакцій тимчасово недоступна'
            };
        }
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
            return await apiRequest(`user/${userId}/settings`, 'POST', settings);
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
     * Примусове очищення всіх активних запитів
     */
    function forceCleanupRequests() {
        _lastRequestsByEndpoint = {};
        _activeEndpoints.clear();
        _pendingRequests = {};
        _blockedEndpoints = {};
        console.log("🔌 API: Примусово очищено відстеження запитів");
        return true;
    }

    /**
     * Очищення кешу API
     */
    function clearCache() {
        _userCache = null;
        _userCacheTime = 0;
        _stakingCache = null;
        _stakingCacheTime = 0;
        _lastRequestsByEndpoint = {};
        _blockedEndpoints = {};
        _globalRateLimited = false;
        _globalRateLimitTime = 0;
        console.log("🔌 API: Кеш очищено");
    }

    /**
     * Відновлення з'єднання з сервером
     */
    async function reconnect() {
        if (_connectionState.failedAttempts > _connectionState.maxRetries) {
            console.error("❌ API: Досягнуто максимальної кількості спроб відновлення");
            return false;
        }

        console.log("🔄 API: Спроба відновлення з'єднання...");

        // Очищаємо стан запитів
        forceCleanupRequests();

        // Спроба оновити токен
        try {
            await refreshToken();
        } catch (error) {
            console.warn("⚠️ API: Не вдалося оновити токен:", error);
        }

        // Спроба отримати дані користувача
        try {
            await getUserData(true);

            // Успішне відновлення
            _connectionState.isConnected = true;
            _connectionState.lastSuccessTime = Date.now();
            _connectionState.failedAttempts = 0;

            console.log("✅ API: З'єднання успішно відновлено");
            return true;
        } catch (error) {
            console.error("❌ API: Помилка відновлення з'єднання:", error);
            return false;
        }
    }

    // Перевірка наявності збереженого глобального обмеження
    try {
        const savedLimitTime = localStorage.getItem('winix_rate_limited_until');
        if (savedLimitTime) {
            const limitTime = parseInt(savedLimitTime);
            if (limitTime > Date.now()) {
                _globalRateLimited = true;
                _globalRateLimitTime = limitTime;
                console.warn(`🔌 API: Знайдено збережене глобальне обмеження швидкості до ${new Date(limitTime).toLocaleTimeString()}`);

                // Показуємо індикатор прогресу очікування
                const remainingSeconds = Math.ceil((limitTime - Date.now()) / 1000);
                if (remainingSeconds > 1) {
                    showRateLimitProgress('global', remainingSeconds);
                }
            } else {
                localStorage.removeItem('winix_rate_limited_until');
            }
        }
    } catch(e) {
        console.warn("Помилка відновлення стану обмеження швидкості:", e);
    }

    // ======== ЕКСПОРТ API ========

    // Створюємо публічний API
    window.WinixAPI = {
        // Конфігурація
        config: {
            baseUrl: API_BASE_URL,
            version: '1.3.1',
            environment: API_BASE_URL.includes('localhost') ? 'development' : 'production'
        },

        // Налаштування
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },

        // Базові функції
        apiRequest,
        getUserId,
        getAuthToken,
        refreshToken,
        clearCache,
        forceCleanupRequests,
        reconnect,
        isValidUUID,
        safeUpdateValue,

        // Функції користувача
        getUserData,
        getBalance,
        updateSettings,
        loadInitData,
        updateBalanceDisplay,

        // Функції стейкінгу
        getStakingData,
        getStakingHistory,
        createStaking,
        addToStaking,
        cancelStaking,
        calculateExpectedReward,

        // Функції транзакцій
        getTransactions,

        // Додаткові функції
        showRateLimitProgress
    };

    // Для зворотної сумісності
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    // Обробники подій для відновлення з'єднання
    window.addEventListener('online', () => {
        console.log("🔄 API: З'єднання з мережею відновлено, спроба підключення");
        reconnect();
    });

    // Додаємо обробник для оптимізації роботи на мобільних пристроях
    window.addEventListener('resize', () => {
        // Тут можна додати функціонал для адаптації під різні розміри екрану
    });

    // Функція для автоматичного навантаження початкових даних
    async function autoLoadInitialData() {
        try {
            // Перевіряємо чи потрібно завантажувати дані користувача
            const needsUserData = document.getElementById('user-coins') ||
                                document.getElementById('user-tokens') ||
                                document.querySelector('.header');

            if (needsUserData) {
                console.log("🔄 Автоматичне завантаження даних користувача...");
                // Завантажуємо дані користувача
                const userId = getUserId();
                if (userId) {
                    const initData = await loadInitData();

                    // Оновлюємо відображення даних
                    if (initData.status === 'success') {
                        updateBalanceDisplay(initData.data);

                        // Заповнюємо ID користувача
                        const userIdElement = document.getElementById('header-user-id');
                        if (userIdElement && initData.data.id) {
                            userIdElement.textContent = initData.data.id;
                        }

                        // Заповнюємо аватар користувача
                        const avatarElement = document.getElementById('profile-avatar');
                        if (avatarElement && initData.data.username) {
                            avatarElement.textContent = initData.data.username.charAt(0).toUpperCase();
                        }
                    }
                }
            }
        } catch (error) {
            console.error("❌ Помилка автоматичного завантаження даних:", error);
        }
    }

    // Запускаємо автоматичне навантаження після завантаження DOM
    document.addEventListener('DOMContentLoaded', autoLoadInitialData);

    // Якщо документ вже завантажено, запускаємо одразу
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        autoLoadInitialData();
    }

    console.log(`✅ API: Модуль успішно ініціалізовано (URL: ${API_BASE_URL})`);
})();