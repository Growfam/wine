/**
 * core.js - Вдосконалена базова функціональність WINIX
 * Оптимізована версія з покращеною продуктивністю, стабільністю та розширеною діагностикою
 * @version 2.1.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Стан модуля
    const _state = {
        // Прапорець ініціалізації ядра
        initialized: false,

        // Інтервал автооновлення
        refreshInterval: null,

        // Блокування запитів
        requestInProgress: false,

        // Час останнього запиту
        lastRequestTime: 0,

        // Лічильник помилок
        errorCounter: 0,

        // Максимальна кількість помилок перед скиданням стану
        maxErrorsBeforeReset: 5,

        // Час останньої помилки
        lastErrorTime: 0,

        // Кеш запитів
        requestCache: {},

        // Лічильник успішних запитів
        successCounter: 0,

        // Статистика API-запитів
        apiStats: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            corsErrors: 0,
            networkErrors: 0,
            lastError: null,
            lastRequest: null,
            lastResponse: null
        },

        // Стан мережевого з'єднання
        networkState: {
            online: typeof navigator.onLine !== 'undefined' ? navigator.onLine : true,
            lastOnlineTime: Date.now(),
            lastOfflineTime: 0,
            reconnectionAttempts: 0,
            pingResults: []
        }
    };

    // Конфігурація
    const _config = {
        // Мінімальний інтервал між запитами (мс)
        minRequestInterval: 5000,

        // Час життя кешу даних користувача (мс)
        userCacheTtl: 300000, // 5 хвилин

        // Інтервал автооновлення (мс)
        autoRefreshInterval: 300000, // 5 хвилин

        // Таймаут запитів (мс)
        requestTimeout: 15000,

        // Максимальна кількість спроб для запитів
        maxRetries: 3,

        // Інтервал між повторними спробами (мс)
        retryInterval: 2000,

        // Режим детального логування
        debug: true,

        // Базовий URL API
        apiBaseUrl: null,

        // Автоматичне визначення проблем з CORS
        detectCorsIssues: true,

        // Активна діагностика з'єднання
        activeConnectionDiagnostics: true,

        // Інтервал діагностики з'єднання (мс)
        diagnosticsInterval: 60000, // 1 хвилина

        // Чи показувати технічні деталі повідомлень про помилки
        showTechnicalErrorDetails: false
    };

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM
     * @param {string} selector - Селектор елемента
     * @param {boolean} multiple - Отримати всі елементи
     * @returns {Element|NodeList|null} Елемент DOM
     */
    function getElement(selector, multiple = false) {
        try {
            if (multiple) {
                return document.querySelectorAll(selector);
            }
            if (selector.startsWith('#')) {
                return document.getElementById(selector.substring(1));
            }
            return document.querySelector(selector);
        } catch (e) {
            console.warn('⚠️ Помилка отримання елемента DOM:', e);
            return null;
        }
    }

    /**
     * Зберігання даних в localStorage
     * @param {string} key - Ключ
     * @param {any} value - Значення
     * @returns {boolean} Результат збереження
     */
    function saveToStorage(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            console.warn(`⚠️ Помилка збереження в localStorage: ${key}`, e);
            return false;
        }
    }

    /**
     * Отримання даних з localStorage
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значення за замовчуванням
     * @param {boolean} isObject - Чи парсити як об'єкт
     * @returns {any} Значення з localStorage
     */
    function getFromStorage(key, defaultValue = null, isObject = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;

            if (isObject) {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return defaultValue;
                }
            }

            return value;
        } catch (e) {
            return defaultValue;
        }
    }

    /**
     * Форматування числа як валюти
     * @param {number} amount - Сума
     * @param {number} decimals - Кількість знаків після коми
     * @returns {string} Форматоване число
     */
    function formatCurrency(amount, decimals = 2) {
        try {
            const numberFormat = new Intl.NumberFormat('uk-UA', {
                maximumFractionDigits: decimals,
                minimumFractionDigits: decimals
            });
            return numberFormat.format(parseFloat(amount) || 0);
        } catch (e) {
            return (parseFloat(amount) || 0).toFixed(decimals);
        }
    }

    /**
     * Перевірка, чи пристрій онлайн
     * @returns {boolean} Стан підключення
     */
    function isOnline() {
        // Використовуємо navigator.onLine, але також враховуємо нашу власну діагностику
        const navigatorOnline = typeof navigator.onLine === 'undefined' || navigator.onLine;

        // Якщо navigatorOnline говорить, що ми офлайн, це скоріше за все правда
        if (!navigatorOnline) {
            _state.networkState.online = false;
            _state.networkState.lastOfflineTime = Date.now();
            return false;
        }

        // Якщо діагностика виявила проблеми з'єднання, можливо, ми офлайн,
        // навіть якщо navigator.onLine = true
        if (_state.networkState.reconnectionAttempts > 3 &&
            Date.now() - _state.networkState.lastOnlineTime > 30000) {
            // Навіть якщо navigator.onLine = true, але останні спроби з'єднання провалились,
            // вважаємо що проблеми зі з'єднанням
            return false;
        }

        return _state.networkState.online;
    }

    /**
     * Перевірка наявності API модуля
     * @returns {boolean} Чи доступний API модуль
     */
    function hasApiModule() {
        try {
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function' &&
                   typeof window.WinixAPI.getUserId === 'function';
        } catch (e) {
            console.warn("⚠️ Core: Помилка перевірки API модуля:", e);
            return false;
        }
    }

    /**
     * Класифікація помилки для кращої обробки
     * @param {Error} error - Помилка для класифікації
     * @returns {Object} Класифікована помилка
     */
    function classifyError(error) {
        const classified = {
            originalError: error,
            message: error?.message || 'Невідома помилка',
            type: 'unknown',
            isNetworkError: false,
            isCorsError: false,
            isTimeout: false,
            isServerError: false,
            isAuthError: false,
            statusCode: null,
            details: {}
        };

        // Спочатку перевіряємо, чи це помилка CORS
        if (error && error.message && (
            error.message.includes('CORS') ||
            error.message.includes('Cross-Origin') ||
            error.message.includes('Access-Control-Allow-Origin')
        )) {
            classified.type = 'cors';
            classified.isCorsError = true;
            _state.apiStats.corsErrors++;
        }
        // Перевіряємо, чи це помилка мережі
        else if (error && (
            error.name === 'NetworkError' ||
            error.name === 'TypeError' ||
            (error.message && (
                error.message.includes('network') ||
                error.message.includes('Network')
            ))
        )) {
            classified.type = 'network';
            classified.isNetworkError = true;
            _state.apiStats.networkErrors++;
        }
        // Перевіряємо, чи це таймаут
        else if (error && (
            error.name === 'TimeoutError' ||
            error.name === 'AbortError' ||
            (error.message && error.message.includes('timeout'))
        )) {
            classified.type = 'timeout';
            classified.isTimeout = true;
            _state.apiStats.timeoutRequests++;
        }
        // Перевіряємо відповідь від сервера, якщо вона є
        else if (error && error.response) {
            classified.statusCode = error.response.status;

            if (error.response.status >= 500) {
                classified.type = 'server';
                classified.isServerError = true;
            } else if (error.response.status === 401 || error.response.status === 403) {
                classified.type = 'auth';
                classified.isAuthError = true;
            } else if (error.response.status === 404) {
                classified.type = 'not_found';
            } else {
                classified.type = 'api';
            }

            // Додаємо деталі відповіді
            if (error.response.data) {
                classified.details.response = error.response.data;
            }
        }

        // Зберігаємо інформацію про останню помилку
        _state.apiStats.lastError = {
            type: classified.type,
            message: classified.message,
            time: Date.now()
        };

        return classified;
    }

    /**
     * Перевірка з'єднання з сервером
     * @returns {Promise<boolean>} Результат перевірки
     */
    async function checkServerConnection() {
        try {
            // Перевіряємо, чи пристрій взагалі онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                return false;
            }

            // Визначаємо URL для перевірки
            let pingUrl;

            // Спочатку спробуємо отримати URL з конфігурації
            if (_config.apiBaseUrl) {
                pingUrl = `${_config.apiBaseUrl}/api/ping`;
            }
            // Якщо WinixAPI ініціалізований, використовуємо його базовий URL
            else if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
                pingUrl = `${window.WinixAPI.config.baseUrl}/api/ping`;
            }
            // Якщо інше не визначено, використовуємо поточний домен
            else {
                pingUrl = `${window.location.origin}/api/ping`;
            }

            // Додаємо випадковий параметр, щоб уникнути кешування
            pingUrl = `${pingUrl}?t=${Date.now()}`;

            // Створюємо таймаут для запиту
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд максимум

            // Виконуємо запит для перевірки з'єднання
            const response = await fetch(pingUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                signal: controller.signal
            });

            // Очищаємо таймаут
            clearTimeout(timeoutId);

            // Якщо сервер відповідає успішно на ping, оновлюємо стан мережі
            if (response.ok) {
                _state.networkState.online = true;
                _state.networkState.lastOnlineTime = Date.now();
                _state.networkState.reconnectionAttempts = 0;

                // Зберігаємо результат пінгу
                _state.networkState.pingResults.push({
                    time: Date.now(),
                    success: true,
                    latency: Date.now() - _state.networkState.lastOfflineTime
                });

                // Обмежуємо історію до останніх 10 результатів
                if (_state.networkState.pingResults.length > 10) {
                    _state.networkState.pingResults.shift();
                }

                return true;
            }

            // Якщо відповідь не ок, але статус 4xx, сервер працює
            if (response.status >= 400 && response.status < 500) {
                // Сервер відповідає, але з помилкою - це все ще вважається "онлайн"
                _state.networkState.online = true;
                _state.networkState.lastOnlineTime = Date.now();

                return true;
            }

            // Якщо помилка 5xx, сервер має проблеми
            _state.networkState.reconnectionAttempts++;

            // Зберігаємо результат пінгу
            _state.networkState.pingResults.push({
                time: Date.now(),
                success: false,
                latency: -1,
                status: response.status
            });

            return false;
        } catch (error) {
            // Збільшуємо лічильник спроб і записуємо час офлайн
            _state.networkState.reconnectionAttempts++;
            if (_state.networkState.lastOfflineTime === 0) {
                _state.networkState.lastOfflineTime = Date.now();
            }

            // Зберігаємо інформацію про помилку
            _state.networkState.pingResults.push({
                time: Date.now(),
                success: false,
                latency: -1,
                error: error.message
            });

            // Якщо це помилка CORS, можливо, сервер працює, але з проблемами CORS
            if (error.message && error.message.includes('CORS')) {
                console.warn("⚠️ Core: Виявлено проблему CORS при перевірці з'єднання:", error.message);

                // Встановлюємо флаг CORS проблеми
                _state.networkState.corsIssueDetected = true;

                // Генеруємо подію проблеми CORS
                document.dispatchEvent(new CustomEvent('cors-issue-detected', {
                    detail: { url: pingUrl, error: error.message }
                }));
            }

            console.error("❌ Core: Помилка перевірки з'єднання:", error);
            return false;
        }
    }

    /**
     * Детектування проблем з CORS
     * @returns {Promise<Object>} Результати детектування
     */
    async function detectCorsIssues() {
        // Результат перевірки
        const result = {
            hasCorsIssues: false,
            testedUrls: [],
            failedUrls: []
        };

        // Якщо виявлення CORS вимкнено, пропустити
        if (!_config.detectCorsIssues) {
            return result;
        }

        try {
            // Список URL для тестування
            const urlsToTest = [];

            // Додаємо URL з конфігурації, якщо він є
            if (_config.apiBaseUrl) {
                urlsToTest.push(`${_config.apiBaseUrl}/api/ping`);
            }

            // Додаємо URL з WinixAPI, якщо він доступний
            if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
                urlsToTest.push(`${window.WinixAPI.config.baseUrl}/api/ping`);
            }

            // Додаємо URL поточного домену
            urlsToTest.push(`${window.location.origin}/api/ping`);

            // Додаємо домен winixbot.com
            urlsToTest.push("https://winixbot.com/api/ping");

            // Тестуємо всі URL
            for (const url of urlsToTest) {
                result.testedUrls.push(url);

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 секунди максимум

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        signal: controller.signal,
                        mode: 'cors'
                    });

                    clearTimeout(timeoutId);

                    // Якщо запит успішний, значить CORS працює для цього URL
                } catch (error) {
                    // Якщо помилка CORS, додаємо URL до списку помилок
                    if (error.message && error.message.includes('CORS')) {
                        result.failedUrls.push({
                            url: url,
                            error: error.message
                        });
                        result.hasCorsIssues = true;
                    }
                }
            }

            // Зберігаємо результат перевірки
            _state.networkState.corsTestResults = result;

            return result;
        } catch (error) {
            console.error("❌ Core: Помилка при детектуванні проблем CORS:", error);
            return result;
        }
    }

    /**
     * Функція для скидання стану та перезавантаження після критичних помилок
     */
    function resetAndReloadApplication() {
        console.log("🔄 Core: Скидання стану додатку через критичні помилки...");

        try {
            // Очищаємо кеш API
            if (hasApiModule() && typeof window.WinixAPI.clearCache === 'function') {
                window.WinixAPI.clearCache();
            }

            // Очищаємо локальне сховище з важливими виключеннями
            try {
                // Зберігаємо лише критичні дані для автентифікації
                const userId = getFromStorage('telegram_user_id');
                const authToken = getFromStorage('auth_token');

                // Запам'ятовуємо URL API, якщо він був збережений
                const savedApiUrl = getFromStorage('api_base_url');

                // Перезаписуємо критичні дані після очищення
                if (userId) saveToStorage('telegram_user_id', userId);
                if (authToken) saveToStorage('auth_token', authToken);
                if (savedApiUrl) saveToStorage('api_base_url', savedApiUrl);
            } catch (e) {
                console.warn("⚠️ Core: Помилка очищення localStorage:", e);
            }

            // Скидаємо стан WinixRaffles, якщо він існує
            if (window.WinixRaffles && typeof window.WinixRaffles.resetState === 'function') {
                window.WinixRaffles.resetState();
            }

            // Показуємо повідомлення користувачу
            if (typeof window.showToast === 'function') {
                window.showToast('Виконується перезавантаження додатку...', 'info');
            }

            // Перезавантажуємо сторінку з невеликою затримкою
            setTimeout(function() {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error("❌ Core: Помилка скидання стану:", e);

            // У випадку критичної помилки просто перезавантажуємо
            setTimeout(function() {
                window.location.reload();
            }, 500);
        }
    }

    /**
     * Генерує повідомлення про помилку для відображення користувачу
     * @param {Error|Object} error - Помилка або класифікована помилка
     * @returns {string} Повідомлення для користувача
     */
    function generateUserFriendlyErrorMessage(error) {
        // Якщо це не класифікована помилка, класифікуємо її
        const classifiedError = error.type ? error : classifyError(error);

        // Базове повідомлення залежно від типу помилки
        let message;

        switch (classifiedError.type) {
            case 'cors':
                message = 'Виникла проблема з доступом до сервера. Це може бути пов\'язано з налаштуваннями безпеки.';
                break;
            case 'network':
                message = 'Не вдалося підключитися до сервера. Перевірте своє інтернет-з\'єднання.';
                break;
            case 'timeout':
                message = 'Сервер не відповідає. Спробуйте повторити запит пізніше.';
                break;
            case 'server':
                message = 'Сервер тимчасово не доступний. Будь ласка, спробуйте пізніше.';
                break;
            case 'auth':
                message = 'Необхідна авторизація. Спробуйте перезавантажити сторінку.';
                break;
            case 'not_found':
                message = 'Запитаний ресурс не знайдено. Перевірте URL і спробуйте ще раз.';
                break;
            case 'api':
                message = 'Сталася помилка при обробці запиту на сервері.';
                break;
            default:
                message = 'Сталася неочікувана помилка. Спробуйте перезавантажити сторінку.';
        }

        // Якщо увімкнено показ технічних деталей, додаємо їх
        if (_config.showTechnicalErrorDetails) {
            message += ` (${classifiedError.type}: ${classifiedError.message})`;
        }

        return message;
    }

    /**
     * Відображення повідомлення про помилку користувачу
     * @param {string|Error} errorMessage - Повідомлення або об'єкт помилки
     * @param {string} type - Тип повідомлення (error, warning, info)
     */
    function showErrorMessage(errorMessage, type = 'error') {
        // Якщо це об'єкт помилки, генеруємо повідомлення
        let message = typeof errorMessage === 'string'
            ? errorMessage
            : generateUserFriendlyErrorMessage(errorMessage);

        // Використовуємо наявну функцію showToast, якщо вона є
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        // Якщо є DailyBonus.showNotification
        if (window.DailyBonus && typeof window.DailyBonus.showNotification === 'function') {
            window.DailyBonus.showNotification(message, type);
            return;
        }

        // Як запасний варіант, використовуємо alert для критичних помилок
        if (type === 'error') {
            alert(message);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // ======== API ФУНКЦІЇ ========

    /**
     * Виконання API-запиту з повторними спробами
     * @param {string} endpoint - Ендпоінт API
     * @param {string} method - HTTP метод
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат запиту
     */
    async function executeApiRequest(endpoint, method = 'GET', data = null, options = {}) {
        // Початок відліку часу для вимірювання тривалості запиту
        const startTime = Date.now();

        // Параметри за замовчуванням
        const defaultOptions = {
            timeout: _config.requestTimeout,
            retries: _config.maxRetries,
            retryInterval: _config.retryInterval,
            suppressErrors: false
        };

        // Об'єднуємо опції
        const requestOptions = { ...defaultOptions, ...options };

        // Збільшуємо лічильник запитів
        _state.apiStats.totalRequests++;

        // Зберігаємо інформацію про останній запит
        _state.apiStats.lastRequest = {
            endpoint,
            method,
            time: startTime
        };

        // Перевіряємо, чи пристрій онлайн
        if (!isOnline() && !requestOptions.ignoreOffline) {
            console.warn(`⚠️ Core: Пристрій офлайн, запит до ${endpoint} відхилено`);

            // Повертаємо помилку офлайн
            return {
                status: 'error',
                message: 'Пристрій офлайн. Перевірте підключення до інтернету.',
                offline: true
            };
        }

        let lastError = null;
        let attempt = 0;

        // Пробуємо виконати запит з повторними спробами
        while (attempt < requestOptions.retries) {
            attempt++;

            try {
                // Якщо це не перша спроба, чекаємо перед повторним запитом
                if (attempt > 1) {
                    // Використовуємо exponential backoff для інтервалу між спробами
                    const delay = requestOptions.retryInterval * Math.pow(1.5, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Виконуємо запит
                let apiResult;

                // Якщо доступний модуль WinixAPI, використовуємо його
                if (hasApiModule()) {
                    apiResult = await window.WinixAPI.apiRequest(endpoint, method, data, {
                        timeout: requestOptions.timeout,
                        suppressErrors: requestOptions.suppressErrors
                    });
                }
                // Якщо доступний звичайний API
                else if (window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function') {
                    if (method.toUpperCase() === 'GET') {
                        apiResult = await window.API.get(endpoint, requestOptions);
                    } else {
                        apiResult = await window.API.post(endpoint, data, requestOptions);
                    }
                }
                // Якщо жоден API модуль не доступний, виконуємо власний запит
                else {
                    // Формуємо URL для запиту
                    let apiUrl;

                    // Визначаємо базовий URL
                    if (_config.apiBaseUrl) {
                        apiUrl = `${_config.apiBaseUrl}/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;
                    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        apiUrl = `http://${window.location.hostname}:8080/api/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;
                    } else {
                        apiUrl = `${window.location.origin}/api/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;
                    }

                    // Виконуємо запит
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

                    // Заголовки запиту
                    const headers = {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    };

                    // Додаємо ID користувача, якщо він є
                    const userId = getUserId();
                    if (userId) {
                        headers['X-Telegram-User-Id'] = userId;
                    }

                    const fetchOptions = {
                        method: method,
                        headers: headers,
                        signal: controller.signal
                    };

                    // Додаємо тіло запиту для методів, що можуть його мати
                    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                        fetchOptions.body = JSON.stringify(data);
                    }

                    const response = await fetch(apiUrl, fetchOptions);
                    clearTimeout(timeoutId);

                    // Перевіряємо статус відповіді
                    if (!response.ok) {
                        throw new Error(`HTTP помилка: ${response.status}`);
                    }

                    // Парсимо JSON відповідь
                    apiResult = await response.json();
                }

                // Перевіряємо результат на помилки
                if (apiResult.error) {
                    throw new Error(apiResult.message || apiResult.error);
                }

                // Збільшуємо лічильник успішних запитів
                _state.apiStats.successfulRequests++;

                // Зберігаємо інформацію про останню відповідь
                _state.apiStats.lastResponse = {
                    endpoint,
                    status: 'success',
                    time: Date.now(),
                    duration: Date.now() - startTime
                };

                // Скидаємо лічильник помилок, якщо запит успішний
                _state.errorCounter = 0;

                // Оновлюємо стан мережі
                _state.networkState.online = true;
                _state.networkState.lastOnlineTime = Date.now();
                _state.networkState.reconnectionAttempts = 0;

                return apiResult;
            } catch (error) {
                lastError = error;

                // Класифікуємо помилку
                const classifiedError = classifyError(error);

                // Зберігаємо інформацію про останню відповідь
                _state.apiStats.lastResponse = {
                    endpoint,
                    status: 'error',
                    type: classifiedError.type,
                    time: Date.now(),
                    duration: Date.now() - startTime,
                    error: classifiedError.message
                };

                // Збільшуємо лічильник помилок
                _state.apiStats.failedRequests++;

                // Якщо це проблема з CORS, повертаємо помилку одразу
                if (classifiedError.isCorsError) {
                    console.error(`❌ Core: CORS помилка при виконанні ${method} ${endpoint}:`, classifiedError.message);

                    // Увімкнемо активну діагностику проблем з CORS
                    if (_config.detectCorsIssues) {
                        detectCorsIssues();
                    }

                    // Не повторюємо запити з CORS помилками
                    break;
                }

                // Якщо це проблема з авторизацією, не повторюємо запит
                if (classifiedError.isAuthError) {
                    console.error(`❌ Core: Помилка авторизації при виконанні ${method} ${endpoint}:`, classifiedError.message);
                    break;
                }

                // Якщо це мережева помилка або таймаут, спробуємо знову
                if (classifiedError.isNetworkError || classifiedError.isTimeout) {
                    console.warn(`⚠️ Core: ${classifiedError.type} помилка при виконанні ${method} ${endpoint} (спроба ${attempt}/${requestOptions.retries}):`, classifiedError.message);

                    // Перевіряємо з'єднання з сервером
                    const isConnected = await checkServerConnection();

                    // Якщо не вдалося підключитися, оновлюємо стан мережі
                    if (!isConnected) {
                        _state.networkState.online = false;
                        _state.networkState.lastOfflineTime = Date.now();
                    }

                    // Продовжуємо спроби, якщо не досягли максимальної кількості
                    continue;
                }

                // Якщо це помилка сервера, спробуємо ще раз
                if (classifiedError.isServerError) {
                    console.warn(`⚠️ Core: Помилка сервера при виконанні ${method} ${endpoint} (спроба ${attempt}/${requestOptions.retries}):`, classifiedError.message);
                    continue;
                }

                // Для інших помилок припиняємо спроби
                console.error(`❌ Core: Помилка при виконанні ${method} ${endpoint}:`, classifiedError.message);
                break;
            }
        }

        // Збільшуємо лічильник помилок ядра
        _state.errorCounter++;

        // Якщо є забагато помилок, скидаємо стан
        if (_state.errorCounter >= _state.maxErrorsBeforeReset && !options.preventReset) {
            console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), скидання стану...`);

            // Показуємо повідомлення користувачу
            showErrorMessage('Виникли проблеми з підключенням. Спроба відновлення...', 'warning');

            // Скидаємо лічильник помилок
            _state.errorCounter = 0;

            // Скидаємо стан при критичній кількості помилок
            setTimeout(resetAndReloadApplication, 1000);
        }

        // Якщо дозволено приховувати помилки, повертаємо об'єкт помилки
        if (requestOptions.suppressErrors) {
            return {
                status: 'error',
                message: lastError?.message || 'Невідома помилка при виконанні запиту',
                error: lastError,
                offline: !isOnline()
            };
        }

        // Якщо не дозволено приховувати помилки, викидаємо помилку
        throw lastError;
    }

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусово оновити
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        // Перевіряємо, чи пристрій онлайн
        if (!isOnline() && !forceRefresh) {
            console.warn("⚠️ Core: Пристрій офлайн, використовуємо кешовані дані");

            // Якщо є збережені дані, повертаємо їх
            if (_userData) {
                return _userData;
            }

            // Створюємо базові дані з localStorage
            const storedData = getFromStorage('userData', null, true);
            if (storedData) {
                _userData = storedData;
                return _userData;
            }

            // Створюємо мінімальні дані користувача з localStorage
            const userId = getUserId();
            _userData = {
                telegram_id: userId || 'unknown',
                balance: parseFloat(getFromStorage('userTokens', '0')),
                coins: parseInt(getFromStorage('userCoins', '0')),
                source: 'localStorage_offline'
            };

            return _userData;
        }

        // Перевіряємо частоту запитів і наявність кешу
        const now = Date.now();
        if (!forceRefresh && (now - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Занадто частий запит даних користувача, використовуємо кеш");

            // Якщо у нас вже є дані і не потрібно оновлювати
            if (_userData) {
                return _userData;
            }

            // Намагаємося завантажити з localStorage
            const storedData = getFromStorage('userData', null, true);
            if (storedData) {
                _userData = storedData;
                return _userData;
            }
        }

        // Запобігаємо паралельним запитам
        if (_state.requestInProgress && !forceRefresh) {
            console.log("⏳ Core: Запит даних користувача вже виконується");

            // Якщо у нас вже є дані, повертаємо їх
            if (_userData) {
                return _userData;
            }

            // Завантажуємо з localStorage
            const storedData = getFromStorage('userData', null, true);
            if (storedData) {
                _userData = storedData;
                return _userData;
            }
        }

        // Оновлюємо час останнього запиту і встановлюємо блокування
        _state.lastRequestTime = now;
        _state.requestInProgress = true;

        try {
            // Формуємо запит
            const userId = getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Додаємо параметр запобігання кешування
            const endpoint = `user/${userId}?t=${now}`;

            // Виконуємо запит через executeApiRequest
            const response = await executeApiRequest(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 10000
            });

            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                _userData = response.data;

                // Оновлюємо дані в localStorage
                saveToStorage('userData', _userData);

                // Зберігаємо також окремі поля для сумісності
                if (_userData.balance !== undefined) {
                    saveToStorage('userTokens', _userData.balance.toString());
                    saveToStorage('winix_balance', _userData.balance.toString());
                }

                if (_userData.coins !== undefined) {
                    saveToStorage('userCoins', _userData.coins.toString());
                    saveToStorage('winix_coins', _userData.coins.toString());
                }

                // Оновлюємо час кешування
                saveToStorage('userData_timestamp', now.toString());

                // Генеруємо подію оновлення
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: { userData: _userData },
                    source: 'core.js'
                }));

                // Скидаємо лічильник помилок при успішному запиті
                _state.errorCounter = 0;

                return _userData;
            } else {
                throw new Error(response?.message || 'Не вдалося отримати дані користувача');
            }
        } catch (error) {
            console.error('❌ Core: Помилка отримання даних користувача:', error);
            _state.requestInProgress = false;

            // Збільшуємо лічильник помилок
            _state.errorCounter++;
            _state.lastErrorTime = now;

            // Перевірка на критичну кількість помилок
            if (_state.errorCounter >= _state.maxErrorsBeforeReset) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), скидання стану...`);

                // Показуємо повідомлення користувачу
                showErrorMessage('Виникли проблеми з підключенням. Спроба відновлення...', 'warning');

                // Скидаємо лічильник помилок
                _state.errorCounter = 0;

                // Запускаємо скидання стану
                setTimeout(resetAndReloadApplication, 1000);
            }

            // У випадку помилки використовуємо дані з localStorage
            const storedUserData = getFromStorage('userData', null, true);
            if (storedUserData) {
                _userData = storedUserData;
                return _userData;
            }

            // Створюємо мінімальні дані користувача
            const userId = getUserId();
            _userData = {
                telegram_id: userId || 'unknown',
                balance: parseFloat(getFromStorage('userTokens', '0')),
                coins: parseInt(getFromStorage('userCoins', '0')),
                source: 'localStorage_after_error'
            };

            return _userData;
        }
    }

    /**
     * Отримання ID користувача
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        console.log('🔍 [CORE] Спроба отримання ID користувача');
        // Перевіряємо різні джерела ID користувача в порядку пріоритету

        // 1. З API модуля
        if (hasApiModule()) {
            try {
                const apiId = window.WinixAPI.getUserId();
                console.log('🔍 [CORE] ID з API модуля:', apiId);
                if (apiId && apiId !== 'undefined' && apiId !== 'null') {
                    return apiId;
                }
            } catch (e) {
                console.warn("⚠️ Core: Помилка отримання ID через API:", e);
            }
        }

        // 2. З localStorage
        try {
            const storedId = getFromStorage('telegram_user_id');
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                return storedId;
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID зі сховища:", e);
        }

        // 3. З DOM
        try {
            // Спочатку перевіряємо елемент в хедері
            const headerUserIdElement = getElement('#header-user-id');
            if (headerUserIdElement && headerUserIdElement.textContent) {
                const id = headerUserIdElement.textContent.trim();
                if (id && id !== 'undefined' && id !== 'null') {
                    saveToStorage('telegram_user_id', id);
                    return id;
                }
            }

            // Потім перевіряємо прихований елемент
            const userIdElement = getElement('#user-id');
            if (userIdElement && userIdElement.textContent) {
                const id = userIdElement.textContent.trim();
                if (id && id !== 'undefined' && id !== 'null') {
                    saveToStorage('telegram_user_id', id);
                    return id;
                }
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID з DOM:", e);
        }

        // 4. З URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId && urlId !== 'undefined' && urlId !== 'null') {
                saveToStorage('telegram_user_id', urlId);
                return urlId;
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID з URL:", e);
        }

        // 5. З Telegram WebApp
        try {
            if (window.Telegram && window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {

                const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                if (telegramId) {
                    saveToStorage('telegram_user_id', telegramId);
                    return telegramId;
                }
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID з Telegram WebApp:", e);
        }

        return null;
    }

    /**
     * Оновлення відображення користувача
     */
    function updateUserDisplay() {
        try {
            // Отримуємо дані користувача
            const userData = _userData || {};
            const userId = userData.telegram_id || getUserId() || getFromStorage('telegram_user_id', 'Unknown ID');
            const username = userData.username || getFromStorage('username', 'User');

            // Оновлюємо ID користувача
            const userIdElement = getElement('#header-user-id');
            if (userIdElement && userIdElement.textContent !== userId) {
                userIdElement.textContent = userId;
            }

            // Оновлюємо ім'я користувача
            const usernameElement = getElement('#username');
            if (usernameElement && usernameElement.textContent !== username) {
                usernameElement.textContent = username;
            }

            // Оновлюємо аватар
            updateUserAvatar(username);
        } catch (e) {
            console.warn('⚠️ Помилка оновлення відображення користувача:', e);
        }
    }

    /**
     * Оновлення аватара користувача
     * @param {string} username - Ім'я користувача
     */
    function updateUserAvatar(username) {
        try {
            const avatarElement = getElement('#profile-avatar');
            if (!avatarElement) return;

            // Очищаємо вміст аватара тільки якщо потрібні зміни
            username = username || _userData?.username || getFromStorage('username', 'User');
            const avatarSrc = getFromStorage('userAvatarSrc') || getFromStorage('avatarSrc');

            // Перевіряємо, чи потрібно оновлювати аватар
            if (avatarSrc) {
                // Якщо є зображення
                if (!avatarElement.querySelector('img')) {
                    avatarElement.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = avatarSrc;
                    img.alt = username;
                    img.onerror = () => {
                        avatarElement.textContent = username[0].toUpperCase();
                    };
                    avatarElement.appendChild(img);
                }
            } else if (avatarElement.textContent !== username[0].toUpperCase()) {
                // Якщо немає зображення, показуємо першу літеру
                avatarElement.innerHTML = '';
                avatarElement.textContent = username[0].toUpperCase();
            }
        } catch (e) {
            console.warn('⚠️ Помилка оновлення аватара:', e);
        }
    }

    /**
     * Отримання балансу користувача
     * @returns {number} Баланс користувача
     */
    function getBalance() {
        try {
            return _userData?.balance ||
                  parseFloat(getFromStorage('userTokens', '0')) ||
                  parseFloat(getFromStorage('winix_balance', '0')) || 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Отримання кількості жетонів
     * @returns {number} Кількість жетонів
     */
    function getCoins() {
        try {
            // 1. Перевіряємо глобальний контролер синхронізації (найвищий пріоритет)
            if (window.__winixSyncControl && window.__winixSyncControl.lastValidBalance !== null) {
                return window.__winixSyncControl.lastValidBalance;
            }

            // 2. Перевіряємо дані користувача
            if (_userData?.coins !== undefined) {
                return _userData.coins;
            }

            // 3. Перевіряємо локальне сховище
            const storedCoins = parseInt(getFromStorage('userCoins', '0')) || parseInt(getFromStorage('winix_coins', '0'));
            if (storedCoins) {
                return storedCoins;
            }

            return 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Оновлення відображення балансу
     * @param {boolean} animate - Використовувати анімацію
     */
    function updateBalanceDisplay(animate = false) {
        try {
            // Оновлюємо відображення токенів
            const tokensElement = getElement('#user-tokens');
            if (tokensElement) {
                const balance = getBalance();
                const formattedBalance = formatCurrency(balance);

                // Оновлюємо тільки якщо змінилося
                if (tokensElement.textContent !== formattedBalance) {
                    tokensElement.textContent = formattedBalance;
                }
            }

            // Оновлюємо відображення жетонів
            const coinsElement = getElement('#user-coins');
            if (coinsElement) {
                const coins = getCoins();
                const currentCoins = parseInt(coinsElement.textContent) || 0;

                // Оновлюємо тільки якщо змінилося
                if (currentCoins !== coins) {
                    // Додаємо анімацію, якщо потрібно
                    if (animate) {
                        coinsElement.classList.remove('decreasing', 'increasing');

                        if (coins < currentCoins) {
                            coinsElement.classList.add('decreasing');
                        } else if (coins > currentCoins) {
                            coinsElement.classList.add('increasing');
                        }

                        // Видаляємо класи анімації через 1 секунду
                        setTimeout(() => {
                            coinsElement.classList.remove('decreasing', 'increasing');
                        }, 1000);
                    }

                    coinsElement.textContent = coins;
                }
            }
        } catch (e) {
            console.warn('⚠️ Помилка оновлення відображення балансу:', e);
        }
    }

    /**
     * Оновлення локального балансу з налаштуваннями анімації
     * @param {number} newBalance - Нове значення балансу
     * @param {string} source - Джерело зміни
     * @param {boolean} animate - Чи використовувати анімацію
     * @returns {boolean} Успішність оновлення
     */
    function updateLocalBalance(newBalance, source = 'unknown', animate = true) {
        if (typeof newBalance !== 'number' || isNaN(newBalance) || newBalance < 0) {
            console.warn('⚠️ Спроба встановити некоректний баланс:', newBalance);
            return false;
        }

        try {
            // Отримуємо поточне значення для порівняння
            const coinsElement = getElement('#user-coins');
            if (!coinsElement) return false;

            const oldBalance = parseInt(coinsElement.textContent) || 0;

            // Уникаємо непотрібних оновлень DOM
            if (oldBalance === newBalance) return true;

            // Видаляємо попередні класи анімації
            coinsElement.classList.remove('increasing', 'decreasing', 'updated');

            // Додаємо клас анімації, якщо потрібно
            if (animate) {
                if (newBalance > oldBalance) {
                    coinsElement.classList.add('increasing');
                } else if (newBalance < oldBalance) {
                    coinsElement.classList.add('decreasing');
                }
            }

            // Встановлюємо нове значення
            coinsElement.textContent = newBalance;

            // Оновлюємо дані користувача
            if (_userData) {
                _userData.coins = newBalance;
            }

            // Оновлюємо локальне сховище
            saveToStorage('userCoins', newBalance.toString());
            saveToStorage('winix_coins', newBalance.toString());
            saveToStorage('winix_balance_update_time', Date.now().toString());

            // Генеруємо стандартну подію про оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: newBalance,
                    source: source || 'core.js',
                    timestamp: Date.now()
                }
            }));

            // Видаляємо класи анімації після 1 секунди
            if (animate) {
                setTimeout(() => {
                    coinsElement.classList.remove('increasing', 'decreasing', 'updated');
                }, 1000);
            }

            return true;
        } catch (e) {
            console.warn('⚠️ Помилка оновлення локального балансу:', e);
            return false;
        }
    }

    /**
     * Оновлення балансу з сервера
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Object>} Результат оновлення
     */
    async function refreshBalance(forceRefresh = false) {
        // Створюємо інформацію про транзакцію для відстеження
        const transactionInfo = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8),
            timestamp: Date.now(),
            source: 'core.js'
        };

        console.log(`🔄 Core: Запит оновлення балансу (ID: ${transactionInfo.id})`);

        // Перевіряємо, чи пристрій онлайн
        if (!isOnline() && !forceRefresh) {
            console.warn("⚠️ Core: Пристрій офлайн, використовуємо локальні дані балансу");

            // Явно отримуємо та обчислюємо всі дані для офлайн-режиму
            const lastKnownBalance = getCoins();
            const lastUpdateTime = parseInt(getFromStorage('winix_balance_update_time') || '0');
            const now = Date.now();
            const dataAge = now - lastUpdateTime;

            // Визначаємо статус даних для інформування
            let dataStatus = 'fresh';
            if (lastUpdateTime === 0) {
                dataStatus = 'unknown';
            } else if (dataAge > 30 * 60 * 1000) { // старше 30 хвилин
                dataStatus = 'stale';
            }

            // Оновлюємо відображення з локальних даних без анімації
            updateBalanceDisplay(false);

            return {
                success: true,
                offline: true,
                dataStatus: dataStatus,
                dataAge: dataAge,
                transactionId: transactionInfo.id,
                data: {
                    coins: lastKnownBalance,
                    lastUpdate: lastUpdateTime
                }
            };
        }

        // Перевіряємо блокування через глобальний контролер
        if (window.__winixSyncControl &&
            window.__winixSyncControl.isBlocked &&
            window.__winixSyncControl.isBlocked('core_balance') &&
            !forceRefresh) {

            console.log("🔒 Core: Оновлення балансу заблоковано контролером синхронізації");

            // Використовуємо останній валідний баланс з контролера
            if (window.__winixSyncControl.lastValidBalance !== null) {
                // Оновлюємо відображення без анімації
                updateLocalBalance(window.__winixSyncControl.lastValidBalance, 'sync_control', false);

                return {
                    success: true,
                    blocked: true,
                    source: 'sync_control',
                    data: {
                        coins: window.__winixSyncControl.lastValidBalance
                    }
                };
            }
        }

        // Перевірка на частоту запитів
        if (!forceRefresh && (Date.now() - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Занадто частий запит балансу, використовуємо кеш");
            return {
                success: true,
                cached: true,
                data: {
                    coins: getCoins(),
                    cached: true
                }
            };
        }

        // Блокуємо паралельні запити
        if (_state.requestInProgress && !forceRefresh) {
            console.log("⏳ Core: Запит балансу вже виконується");
            return {
                success: true,
                inProgress: true,
                data: {
                    coins: getCoins(),
                    inProgress: true
                }
            };
        }

        // Оновлюємо час останнього запиту і встановлюємо блокування
        _state.lastRequestTime = Date.now();
        _state.requestInProgress = true;

        // Зберігаємо поточний баланс для порівняння
        const oldBalance = getCoins();
        transactionInfo.oldBalance = oldBalance;

        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Додаємо параметр запобігання кешування
            const endpoint = `user/${userId}/balance?t=${Date.now()}`;

            // Виконуємо запит через executeApiRequest
            const response = await executeApiRequest(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 10000
            });

            // Завершуємо запит
            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                // Отримуємо новий баланс з відповіді
                const newBalance = response.data.coins !== undefined ? response.data.coins : oldBalance;
                transactionInfo.newBalance = newBalance;
                transactionInfo.serverResponse = true;

                // Перевіряємо наявність глобального контролера синхронізації
                if (window.__winixSyncControl) {
                    // Зберігаємо останній валідний баланс
                    window.__winixSyncControl.lastValidBalance = newBalance;
                }

                // Оновлюємо відображення з анімацією
                updateLocalBalance(newBalance, 'core.js', true);

                // Оновлюємо дані користувача
                if (_userData) {
                    _userData.coins = newBalance;
                }

                // Оновлюємо кеш
                saveToStorage('userCoins', newBalance.toString());
                saveToStorage('winix_coins', newBalance.toString());
                saveToStorage('winix_balance_update_time', Date.now().toString());

                // Записуємо інформацію про транзакцію
                saveToStorage('winix_last_balance_transaction', JSON.stringify(transactionInfo));

                // Скидаємо лічильник помилок
                _state.errorCounter = 0;

                return {
                    success: true,
                    transactionId: transactionInfo.id,
                    data: {
                        coins: newBalance,
                        oldCoins: oldBalance
                    }
                };
            } else if (response.offline) {
                // Якщо пристрій офлайн, повертаємо офлайн-статус
                _state.requestInProgress = false;

                return {
                    success: true,
                    offline: true,
                    message: response.message || 'Пристрій офлайн',
                    data: {
                        coins: oldBalance
                    }
                };
            } else {
                throw new Error(response?.message || 'Не вдалося отримати баланс');
            }
        } catch (error) {
            console.error('❌ Core: Помилка оновлення балансу:', error);
            _state.requestInProgress = false;

            // Збільшуємо лічильник помилок
            _state.errorCounter++;
            _state.lastErrorTime = Date.now();

            // Перевірка на критичну кількість помилок
            if (_state.errorCounter >= _state.maxErrorsBeforeReset) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), скидання стану...`);

                // Показуємо повідомлення користувачу
                showErrorMessage('Виникли проблеми з підключенням. Спроба відновлення...', 'warning');

                // Скидаємо лічильник помилок
                _state.errorCounter = 0;

                // Запускаємо скидання стану
                setTimeout(resetAndReloadApplication, 1000);
            }

            // Повертаємо останній відомий баланс
            return {
                success: false,
                message: error.message || 'Не вдалося оновити баланс',
                transactionId: transactionInfo.id,
                data: {
                    coins: oldBalance,
                    error: true
                }
            };
        }
    }

    // ======== НАВІГАЦІЯ ========

    /**
     * Ініціалізація навігаційних елементів
     */
    function initNavigation() {
        try {
            const navItems = getElement('.nav-item', true);
            if (!navItems || navItems.length === 0) return;

            // Отримуємо поточний шлях
            const currentPath = window.location.pathname;
            const currentPage = currentPath.split('/').pop().split('.')[0];

            navItems.forEach(item => {
                // Отримуємо секцію з атрибуту
                const section = item.getAttribute('data-section');

                // Перевіряємо, чи поточна сторінка відповідає секції
                if ((currentPage === section) ||
                    (currentPage === '' && section === 'home') ||
                    (currentPage === 'index' && section === 'home')) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }

                // Додаємо обробник кліку, якщо його ще немає
                if (!item.hasAttribute('data-initialized')) {
                    item.setAttribute('data-initialized', 'true');

                    item.addEventListener('click', () => {
                        // Визначаємо URL для переходу
                        let url;
                        if (section === 'home') {
                            url = 'index.html';
                        } else {
                            url = `${section}.html`;
                        }

                        // Переходимо на сторінку
                        window.location.href = url;
                    });
                }
            });
        } catch (e) {
            console.warn('⚠️ Помилка ініціалізації навігації:', e);
        }
    }

    // ======== ДІАГНОСТИЧНІ ФУНКЦІЇ ========

    /**
     * Діагностика підключення до бекенду
     * @returns {Promise<Object>} Результати діагностики
     */
    async function diagnoseBeckendConnection() {
        console.group('🔍 Core: Діагностика підключення до бекенду');

        const results = {
            online: isOnline(),
            apiAvailable: hasApiModule(),
            apiModuleState: null,
            corsIssues: null,
            apiEndpointStatus: {},
            networkState: { ..._state.networkState },
            apiStats: { ..._state.apiStats }
        };

        try {
            // Перевіряємо стан API модуля
            if (results.apiAvailable) {
                console.log('✅ API модуль доступний');

                if (window.WinixAPI.config) {
                    results.apiModuleState = {
                        baseUrl: window.WinixAPI.config.baseUrl,
                        version: window.WinixAPI.config.version,
                        environment: window.WinixAPI.config.environment
                    };

                    console.log('📋 Конфігурація API:', results.apiModuleState);
                }

                // Якщо доступна діагностика API
                if (window.WinixAPI.diagnostics) {
                    const apiStats = window.WinixAPI.diagnostics.getRequestStats();
                    const connectionState = window.WinixAPI.diagnostics.getConnectionState();
                    const activeEndpoints = window.WinixAPI.diagnostics.getActiveEndpoints();
                    const blockedEndpoints = window.WinixAPI.diagnostics.getBlockedEndpoints();

                    results.apiDiagnostics = {
                        requestStats: apiStats,
                        connectionState,
                        activeEndpoints,
                        blockedEndpoints
                    };

                    console.log('📊 Діагностика API:', results.apiDiagnostics);
                }
            } else {
                console.warn('⚠️ API модуль не доступний');
                results.apiModuleState = {
                    available: false,
                    reason: 'Модуль не знайдено в глобальному об\'єкті window'
                };

                // Перевіряємо, чи завантажено скрипт API
                const apiScript = document.querySelector('script[src*="tasks-api.js"]');
                if (apiScript) {
                    results.apiModuleState.scriptLoaded = true;
                    console.log('📜 API скрипт завантажено, але модуль не ініціалізовано');
                } else {
                    results.apiModuleState.scriptLoaded = false;
                    console.warn('⚠️ API скрипт не завантажено');
                }
            }

            // Перевіряємо проблеми з CORS
            console.log('🔄 Перевірка проблем з CORS...');
            results.corsIssues = await detectCorsIssues();

            if (results.corsIssues.hasCorsIssues) {
                console.warn('⚠️ Виявлено проблеми з CORS:', results.corsIssues.failedUrls);
            } else {
                console.log('✅ Проблем з CORS не виявлено');
            }

            // Перевіряємо доступність основних API ендпоінтів
            console.log('🔄 Перевірка доступності API ендпоінтів...');

            // Отримуємо ID користувача
            const userId = getUserId();

            if (userId) {
                // Список ендпоінтів для перевірки
                const endpointsToCheck = [
                    { name: 'Дані користувача', endpoint: `user/${userId}` },
                    { name: 'Баланс користувача', endpoint: `user/${userId}/balance` },
                    { name: 'Завдання', endpoint: 'quests/tasks' }
                ];

                // Перевіряємо кожен ендпоінт
                for (const endpoint of endpointsToCheck) {
                    console.log(`🔄 Перевірка ендпоінту: ${endpoint.name}`);

                    try {
                        const response = await executeApiRequest(endpoint.endpoint, 'GET', null, {
                            suppressErrors: true,
                            timeout: 5000,
                            retries: 1,
                            preventReset: true
                        });

                        results.apiEndpointStatus[endpoint.name] = {
                            status: response.status === 'success' ? 'success' : 'error',
                            message: response.message,
                            offline: response.offline
                        };

                        console.log(`${response.status === 'success' ? '✅' : '❌'} ${endpoint.name}: ${response.status}`);
                    } catch (error) {
                        results.apiEndpointStatus[endpoint.name] = {
                            status: 'error',
                            message: error.message,
                            error: error
                        };

                        console.error(`❌ ${endpoint.name}: ${error.message}`);
                    }
                }
            } else {
                console.warn('⚠️ ID користувача не знайдено, пропущено перевірку ендпоінтів');
                results.apiEndpointStatus.error = 'ID користувача не знайдено';
            }

            // Перевіряємо наявність індикатора тестових даних
            const mockDataIndicator = document.getElementById('mock-data-indicator');
            if (mockDataIndicator) {
                results.mockDataIndicatorPresent = true;
                console.warn('⚠️ Виявлено індикатор використання тестових даних');
            } else {
                results.mockDataIndicatorPresent = false;
            }

            // Заключний статус
            const isWorking = results.online &&
                            (!results.corsIssues.hasCorsIssues) &&
                            (Object.values(results.apiEndpointStatus).some(e => e.status === 'success'));

            results.overallStatus = isWorking ? 'working' : 'not_working';
            console.log(`🔄 Загальний статус підключення до бекенду: ${isWorking ? '✅ Працює' : '❌ Не працює'}`);

            // Додаємо рекомендації
            results.recommendations = [];

            if (!results.online) {
                results.recommendations.push('Перевірте підключення до інтернету');
            }

            if (results.corsIssues.hasCorsIssues) {
                results.recommendations.push('Виявлено проблеми з CORS. Перевірте заголовки та налаштування сервера');
            }

            if (!results.apiAvailable) {
                results.recommendations.push('API модуль не доступний. Перевірте завантаження скрипту tasks-api.js');
            }

            if (results.mockDataIndicatorPresent) {
                results.recommendations.push('Додаток використовує тестові дані. Перевірте налаштування API');
            }

            console.log('📋 Рекомендації:', results.recommendations);
        } catch (error) {
            console.error('❌ Core: Помилка діагностики:', error);
            results.error = error.message;
        } finally {
            console.groupEnd();
        }

        return results;
    }

    /**
     * Усунення проблем з мережевим з'єднанням
     * @returns {Promise<Object>} Результати усунення проблем
     */
    async function troubleshootConnection() {
        console.group('🔧 Core: Усунення проблем з мережевим з\'єднанням');

        const results = {
            actions: [],
            success: false,
            reconnected: false
        };

        try {
            // 1. Скидаємо стан мережі
            console.log('🔄 Скидання стану мережі...');
            _state.networkState.reconnectionAttempts = 0;
            results.actions.push('reset_network_state');

            // 2. Перевіряємо з'єднання з сервером
            console.log('🔄 Перевірка з\'єднання з сервером...');
            const isConnected = await checkServerConnection();
            results.serverConnectionCheck = isConnected;

            if (isConnected) {
                console.log('✅ З\'єднання з сервером встановлено');
                _state.networkState.online = true;
                _state.networkState.lastOnlineTime = Date.now();
                results.actions.push('server_connection_ok');
            } else {
                console.warn('⚠️ З\'єднання з сервером не встановлено');
                results.actions.push('server_connection_failed');
            }

            // 3. Перевіряємо проблеми з CORS
            if (!isConnected) {
                console.log('🔄 Перевірка проблем з CORS...');
                const corsIssues = await detectCorsIssues();
                results.corsIssues = corsIssues;

                if (corsIssues.hasCorsIssues) {
                    console.warn('⚠️ Виявлено проблеми з CORS:', corsIssues.failedUrls);
                    results.actions.push('cors_issues_detected');

                    // Пропонуємо рішення для CORS
                    console.log('🔧 Спроба вирішення проблем з CORS...');

                    // Зберігаємо URL з проблемами CORS
                    saveToStorage('cors_problem_urls', JSON.stringify(corsIssues.failedUrls));

                    // Додаємо заголовок Origin до всіх запитів
                    if (window.WinixAPI && window.WinixAPI.config) {
                        // Запам'ятовуємо поточний URL
                        const currentBaseUrl = window.WinixAPI.config.baseUrl;

                        // Пробуємо альтернативні URL з протоколом https і http
                        if (currentBaseUrl.startsWith('http://')) {
                            const httpsUrl = currentBaseUrl.replace('http://', 'https://');
                            console.log(`🔄 Спроба використання HTTPS URL: ${httpsUrl}`);

                            // Зберігаємо новий URL
                            saveToStorage('api_base_url', httpsUrl);
                            results.actions.push('switched_to_https');
                        } else if (currentBaseUrl.startsWith('https://')) {
                            const httpUrl = currentBaseUrl.replace('https://', 'http://');
                            console.log(`🔄 Спроба використання HTTP URL: ${httpUrl}`);

                            // Зберігаємо новий URL
                            saveToStorage('api_base_url', httpUrl);
                            results.actions.push('switched_to_http');
                        }
                    }
                } else {
                    console.log('✅ Проблем з CORS не виявлено');
                    results.actions.push('no_cors_issues');
                }
            }

            // 4. Очищення кешу API запитів
            console.log('🔄 Очищення кешу API запитів...');
            if (window.WinixAPI && window.WinixAPI.clearCache) {
                window.WinixAPI.clearCache();
                results.actions.push('api_cache_cleared');
            }

            // 5. Очищення блокованих ендпоінтів
            console.log('🔄 Очищення блокованих ендпоінтів...');
            if (window.WinixAPI && window.WinixAPI.diagnostics && window.WinixAPI.diagnostics.clearBlockedEndpoints) {
                window.WinixAPI.diagnostics.clearBlockedEndpoints();
                results.actions.push('blocked_endpoints_cleared');
            }

            // 6. Перевірка з'єднання після всіх змін
            console.log('🔄 Перевірка з\'єднання після змін...');
            const reconnected = await checkServerConnection();
            results.reconnectionCheck = reconnected;

            if (reconnected) {
                console.log('✅ З\'єднання з сервером успішно відновлено');
                _state.networkState.online = true;
                _state.networkState.lastOnlineTime = Date.now();
                results.reconnected = true;
                results.actions.push('reconnection_successful');

                // Скидаємо лічильники помилок
                _state.errorCounter = 0;
                if (window.WinixAPI && window.WinixAPI.diagnostics && window.WinixAPI.diagnostics.resetState) {
                    window.WinixAPI.diagnostics.resetState();
                }

                // Показуємо повідомлення користувачу
                showErrorMessage('З\'єднання з сервером відновлено', 'success');
            } else {
                console.warn('⚠️ З\'єднання з сервером не вдалося відновити');
                results.actions.push('reconnection_failed');

                // Показуємо повідомлення користувачу
                showErrorMessage('Не вдалося відновити з\'єднання з сервером. Використовуються локальні дані.', 'warning');
            }

            // Визначаємо успішність операції
            results.success = reconnected || isConnected;

            // Зберігаємо результати діагностики
            saveToStorage('connection_troubleshooting_results', JSON.stringify({
                timestamp: Date.now(),
                results
            }));

        } catch (error) {
            console.error('❌ Core: Помилка усунення проблем з мережею:', error);
            results.error = error.message;
        } finally {
            console.groupEnd();
        }

        return results;
    }

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ ========

    /**
     * Синхронізація даних користувача з сервером
     * @param {boolean} forceRefresh - Примусова синхронізація
     * @returns {Promise<Object>} Результат синхронізації
     */
    async function syncUserData(forceRefresh = false) {
        try {
            console.log('🔄 Core: Початок синхронізації даних користувача...');

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline() && !forceRefresh) {
                console.warn("⚠️ Core: Пристрій офлайн, використовуємо локальні дані");

                // Отримуємо останні відомі дані
                const lastKnownBalance = getCoins();
                const lastUpdateTime = parseInt(getFromStorage('winix_balance_update_time') || '0');
                const now = Date.now();

                // Перевіряємо актуальність даних
                const dataAge = now - lastUpdateTime;
                let dataStatus = 'fresh';

                if (lastUpdateTime === 0) {
                    dataStatus = 'unknown';
                } else if (dataAge > 30 * 60 * 1000) { // старше 30 хвилин
                    dataStatus = 'stale';
                }

                // Оновлюємо відображення
                updateUserDisplay();
                updateBalanceDisplay();

                // Показуємо статус, якщо дані застарілі
                if (dataStatus === 'stale') {
                    showErrorMessage('Використовуються локально збережені дані. Оновіть баланс при підключенні.', 'info');
                }

                return {
                    success: true,
                    offline: true,
                    dataStatus: dataStatus,
                    dataAge: dataAge,
                    data: {
                        balance: lastKnownBalance,
                        lastUpdate: lastUpdateTime
                    }
                };
            }

            // Оновлюємо дані користувача
            const userData = await getUserData(forceRefresh);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Генеруємо подію оновлення даних користувача
            document.dispatchEvent(new CustomEvent('user-data-updated', {
                detail: { userData },
                source: 'core.js'
            }));

            return {
                success: true,
                data: userData
            };
        } catch (error) {
            console.error('❌ Core: Помилка синхронізації даних користувача:', error);

            // Класифікуємо помилку
            const classifiedError = classifyError(error);

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            // Відображаємо повідомлення користувачу з відповідною інформацією
            showErrorMessage(classifiedError, 'warning');

            return {
                success: false,
                message: classifiedError.message || 'Не вдалося синхронізувати дані користувача',
                error: classifiedError,
                data: _userData
            };
        }
    }

    /**
     * Запуск періодичної синхронізації даних
     * @param {number} interval - Інтервал у мілісекундах
     */
    function startAutoSync(interval = 300000) { // 5 хвилин
        // Зупиняємо попередній інтервал
        if (_state.refreshInterval) {
            clearInterval(_state.refreshInterval);
            _state.refreshInterval = null;
        }

        // Запускаємо періодичну синхронізацію
        _state.refreshInterval = setInterval(async () => {
            try {
                // Перевіряємо, чи пристрій онлайн
                if (!isOnline()) {
                    console.warn("⚠️ Core: Пристрій офлайн, пропускаємо синхронізацію");
                    return;
                }

                // Перевіряємо мінімальний інтервал і запит в прогресі
                if (Date.now() - _state.lastRequestTime >= _config.minRequestInterval && !_state.requestInProgress) {
                    await syncUserData();
                }
            } catch (e) {
                console.warn('⚠️ Core: Помилка автоматичної синхронізації:', e);
            }
        }, interval);

        console.log(`🔄 Core: Періодичне оновлення запущено (інтервал: ${interval}ms)`);
    }

    /**
     * Зупинка періодичної синхронізації
     */
    function stopAutoSync() {
        if (_state.refreshInterval) {
            clearInterval(_state.refreshInterval);
            _state.refreshInterval = null;
            console.log("⏹️ Core: Періодичне оновлення зупинено");
        }
    }

    // ======== БЛОКУВАННЯ ОНОВЛЕНЬ БАЛАНСУ ========

    /**
     * Блокування оновлень балансу на вказаний час
     * @param {number} duration - Тривалість блокування в мс
     * @param {Object} options - Опції блокування
     * @returns {boolean} Результат блокування
     */
    function lockBalanceUpdates(duration, options = {}) {
        // Якщо є контролер синхронізації, використовуємо його
        if (window.__winixSyncControl && typeof window.__winixSyncControl.block === 'function') {
            return window.__winixSyncControl.block(duration / 1000, {
                type: options.type || 'core_balance',
                reason: options.reason || 'manual_lock',
                source: 'core.js'
            });
        }

        return false;
    }

    /**
     * Перевірка, чи заблоковані оновлення балансу
     * @param {string} source - Джерело запиту
     * @param {string} type - Тип запиту
     * @returns {boolean} Стан блокування
     */
    function isBalanceUpdateLocked(source, type = 'general') {
        // Якщо є контролер синхронізації, використовуємо його
        if (window.__winixSyncControl && typeof window.__winixSyncControl.isBlocked === 'function') {
            return window.__winixSyncControl.isBlocked(source, type);
        }

        return false;
    }

    // ======== УТИЛІТИ ДЛЯ ІНШИХ МОДУЛІВ ========

    /**
     * Перевірка частоти запитів до API
     * @param {string} key - Ключ для ідентифікації типу запиту
     * @param {number} interval - Мінімальний інтервал між запитами (мс)
     * @returns {boolean} true, якщо запит можна виконати, false - якщо потрібно почекати
     */
    function checkRequestThrottle(key, interval = 5000) {
        const now = Date.now();
        const lastRequest = _state.requestCache[key] || 0;

        if (now - lastRequest < interval) {
            return false;
        }

        _state.requestCache[key] = now;
        return true;
    }

    /**
     * Очищення кешу запитів
     * @param {string} key - Ключ для очищення (якщо не вказано, очищається весь кеш)
     */
    function clearRequestCache(key) {
        if (key) {
            delete _state.requestCache[key];
        } else {
            _state.requestCache = {};
        }
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація ядра WINIX
     * @param {Object} options - Параметри ініціалізації
     * @returns {Promise<boolean>} Результат ініціалізації
     */
    async function init(options = {}) {
        try {
            // Перевіряємо чи вже ініціалізовано ядро
            if (_state.initialized) {
                console.log("✅ Core: Ядро WINIX вже ініціалізоване");
                return true;
            }

            console.log("🔄 Core: Початок ініціалізації ядра WINIX");

            // Оновлюємо конфігурацію
            Object.assign(_config, options);

            // Пробуємо отримати базовий URL API з localStorage
            const savedApiUrl = getFromStorage('api_base_url');
            if (savedApiUrl && !_config.apiBaseUrl) {
                _config.apiBaseUrl = savedApiUrl;
                console.log(`🔄 Core: Використовуємо збережений API URL: ${savedApiUrl}`);
            }

            // Ініціалізуємо Telegram WebApp, якщо він доступний
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                    console.log("✅ Core: Telegram WebApp успішно ініціалізовано");
                } catch (e) {
                    console.warn("⚠️ Core: Помилка ініціалізації Telegram WebApp:", e);
                }
            }

            // Перевіряємо з'єднання з сервером
            const connectionStatus = await checkServerConnection();
            console.log(`🔌 Core: Перевірка з'єднання з сервером: ${connectionStatus ? '✅ Успішно' : '❌ Помилка'}`);

            // Якщо з'єднання не встановлено, але пристрій онлайн, перевіряємо проблеми з CORS
            if (!connectionStatus && typeof navigator.onLine !== 'undefined' && navigator.onLine) {
                if (_config.detectCorsIssues) {
                    console.log('🔄 Core: Перевірка проблем з CORS...');
                    const corsIssues = await detectCorsIssues();

                    if (corsIssues.hasCorsIssues) {
                        console.warn('⚠️ Core: Виявлено проблеми з CORS:', corsIssues.failedUrls);

                        // Показуємо повідомлення про проблеми з CORS
                        showErrorMessage('Виявлено проблеми з доступом до сервера. Використовуються локальні дані.', 'warning');
                    }
                }
            }

            // Отримуємо дані користувача
            await getUserData();
            console.log("✅ Core: Дані користувача отримано");

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Ініціалізуємо навігацію
            initNavigation();

            // Запускаємо автоматичну синхронізацію
            startAutoSync();

            // Якщо увімкнена активна діагностика, запускаємо періодичну перевірку
            if (_config.activeConnectionDiagnostics) {
                console.log(`🔄 Core: Запуск активної діагностики з'єднання (інтервал: ${_config.diagnosticsInterval}ms)`);

                // Запускаємо періодичну перевірку з'єднання
                setInterval(async () => {
                    // Перевіряємо, чи є проблеми зі з'єднанням
                    if (_state.errorCounter > 2 || _state.networkState.reconnectionAttempts > 2) {
                        // Виконуємо перевірку з'єднання
                        const isConnected = await checkServerConnection();

                        if (isConnected) {
                            // Якщо з'єднання відновлено, скидаємо лічильники
                            _state.errorCounter = 0;
                            _state.networkState.reconnectionAttempts = 0;
                            _state.networkState.online = true;
                            _state.networkState.lastOnlineTime = Date.now();

                            console.log('✅ Core: З\'єднання з сервером відновлено');

                            // Показуємо повідомлення користувачу
                            showErrorMessage('З\'єднання з сервером відновлено', 'success');

                            // Синхронізуємо дані
                            await syncUserData(true);
                        }
                    }
                }, _config.diagnosticsInterval);
            }

            // Позначаємо, що ядро ініціалізовано
            _state.initialized = true;

            console.log("✅ Core: Ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));

            return true;
        } catch (error) {
            console.error('❌ Core: Помилка ініціалізації ядра WINIX:', error);

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            document.dispatchEvent(new CustomEvent('winix-initialization-error', { detail: error }));

            return false;
        }
    }

    /**
     * Перевірка, чи ядро ініціалізовано
     * @returns {boolean} Стан ініціалізації
     */
    function isInitialized() {
        return _state.initialized;
    }

    // ======== ОБРОБНИКИ ПОДІЙ ========

    // Обробник події оновлення даних користувача
    document.addEventListener('user-data-updated', function(event) {
        if (event.detail && event.detail.userData && event.source !== 'core.js') {
            console.log("🔄 Core: Отримано подію оновлення даних користувача");
            _userData = event.detail.userData;
            updateUserDisplay();
            updateBalanceDisplay();
        }
    });

    // Обробник події оновлення балансу
    document.addEventListener('balance-updated', function(event) {
        if (event.detail && event.source !== 'core.js') {
            console.log("🔄 Core: Отримано подію оновлення балансу");

            // Оновлюємо дані користувача
            if (!_userData) _userData = {};

            if (event.detail.newBalance !== undefined) {
                _userData.coins = event.detail.newBalance;
            }

            updateBalanceDisplay();
        }
    });

    // Обробник події підключення до мережі
    window.addEventListener('online', function() {
        console.log("🔄 Core: З'єднання з мережею відновлено");

        // Оновлюємо стан мережі
        _state.networkState.online = true;
        _state.networkState.lastOnlineTime = Date.now();

        // Оновлюємо дані після відновлення з'єднання
        setTimeout(async () => {
            // Спочатку перевіряємо з'єднання з сервером
            const isConnected = await checkServerConnection();

            if (isConnected) {
                syncUserData(true).then(() => {
                    console.log("✅ Core: Дані успішно синхронізовано після відновлення з'єднання");

                    // Показуємо повідомлення користувачу
                    showErrorMessage('З\'єднання відновлено. Дані успішно оновлено.', 'success');
                }).catch(error => {
                    console.warn("⚠️ Core: Помилка синхронізації після відновлення з'єднання:", error);

                    // Показуємо повідомлення користувачу
                    showErrorMessage('З\'єднання відновлено, але не вдалося оновити дані.', 'warning');
                });
            } else {
                // Можливо, є проблеми з CORS - перевіряємо
                if (_config.detectCorsIssues) {
                    detectCorsIssues();
                }

                console.warn("⚠️ Core: З'єднання з мережею відновлено, але з'єднання з сервером не встановлено");
            }
        }, 1000);
    });

    // Обробник події відключення від мережі
    window.addEventListener('offline', function() {
        console.warn("⚠️ Core: Втрачено з'єднання з мережею");

        // Оновлюємо стан мережі
        _state.networkState.online = false;
        _state.networkState.lastOfflineTime = Date.now();

        // Показуємо повідомлення користувачу
        showErrorMessage('Втрачено з\'єднання з мережею. Використовуються локальні дані.', 'warning');
    });

    // Обробник події завантаження сторінки
    window.addEventListener('load', function() {
        // Запобігаємо частій ініціалізації
        if (!_state.initialized) {
            init().catch(e => {
                console.error("❌ Core: Помилка ініціалізації:", e);
            });
        }
    });

    // Обробник події DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        if (!_state.initialized) {
            init().catch(e => {
                console.error("❌ Core: Помилка ініціалізації:", e);
            });
        }
    });

    // ======== ПУБЛІЧНИЙ API ========

    // Експортуємо публічний API
    window.WinixCore = {
        // Метадані
        version: '2.1.0',
        isInitialized: isInitialized,

        // Утиліти
        getElement,
        saveToStorage,
        getFromStorage,
        formatCurrency,
        isOnline,
        resetAndReloadApplication,
        checkRequestThrottle,
        clearRequestCache,
        executeApiRequest,
        showErrorMessage,

        // Функції користувача
        getUserData,
        getUserId,
        updateUserDisplay,
        getBalance,
        getCoins,
        updateBalanceDisplay,
        updateLocalBalance,
        refreshBalance,
        lockBalanceUpdates,
        isBalanceUpdateLocked,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync,

        // Функції діагностики
        checkServerConnection,
        detectCorsIssues,
        diagnoseBeckendConnection,
        troubleshootConnection,
        classifyError,

        // Ініціалізація
        init,

        // Конфігурація
        config: _config,

        // Стан модуля (тільки для читання)
        getState: () => ({ ..._state })
    };

    // Додаємо функцію resetAndReloadApplication в глобальний простір імен
    window.resetAndReloadApplication = resetAndReloadApplication;

    // Додаємо додаткові утиліти в глобальний простір імен
    window.showWinixErrorMessage = showErrorMessage;
    window.checkWinixServerConnection = checkServerConnection;
    window.diagnoseBeckendConnection = diagnoseBeckendConnection;
    window.troubleshootWinixConnection = troubleshootConnection;

    console.log("✅ Core: Модуль успішно завантажено");
})();