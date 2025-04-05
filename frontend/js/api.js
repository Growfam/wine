/**
 * api.js v2.0 - Удосконалений модуль для API-запитів WINIX
 *
 * Цей модуль забезпечує централізований доступ до всіх API-запитів:
 * - Автоматична обробка авторизації та токенів
 * - Розумне кешування відповідей
 * - Обробка помилок мережі та офлайн-режиму
 * - Підтримка скасування запитів
 * - Повний набір функцій для роботи з екосистемою WINIX
 */

(function() {
    console.log("🚀 API: Ініціалізація нової версії API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ТА КОНСТАНТИ ========

    // Базовий URL API (визначається автоматично залежно від середовища)
    const API_BASE_URL = (() => {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:8080';
        } else if (host.includes('staging') || host.includes('test')) {
            return 'https://staging.winixbot.com';
        } else {
            return 'https://winixbot.com';
        }
    })();

    // Версія API
    const API_VERSION = '2.0';

    // Прапорці стану
    let _debugMode = false;
    let _isOnline = navigator.onLine;
    let _isInitialized = false;
    let _pendingRequests = [];
    let _abortControllers = new Map();

    // Кеш відповідей
    const _responseCache = new Map();
    const _cacheExpiry = new Map();
    const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 хвилин

    // Події
    const _events = {
        beforeRequest: [],
        afterRequest: [],
        error: [],
        unauthorized: [],
        offline: [],
        online: []
    };

    // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

    /**
     * Генерація унікального ID для запиту
     */
    function generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Отримання ID користувача з різних джерел
     */
    function getUserId() {
        // Використання UserIdManager, якщо доступний
        if (window.UserIdManager && typeof window.UserIdManager.getUserId === 'function') {
            const id = window.UserIdManager.getUserId();
            if (id) {
                if (_debugMode) console.log("🆔 ID користувача отримано з UserIdManager:", id);
                return id;
            }
        }

        // Стара логіка отримання ID
        let userId = localStorage.getItem('telegram_user_id');

        if (!userId || userId === 'undefined' || userId === 'null') {
            // Спроба отримати з DOM елемента
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

            // Спроба отримати з URL параметрів
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
        } else {
            if (_debugMode) console.log("🆔 ID користувача отримано з localStorage:", userId);
            return userId;
        }

        console.warn("⚠️ Не вдалося отримати ID користувача");
        return null;
    }

    /**
     * Отримання токена авторизації
     */
    function getAuthToken() {
        // Спроба отримати з локального сховища
        return localStorage.getItem('auth_token') || null;
    }

    /**
     * Перевірка стану авторизації
     */
    function isAuthorized() {
        const userId = getUserId();
        const token = getAuthToken();
        return Boolean(userId) && Boolean(token);
    }

    /**
     * Обробка помилок API
     */
    function handleApiError(error, operation = 'API операції') {
        console.error(`❌ Помилка ${operation}:`, error);

        // Підготовка стандартизованого об'єкта помилки
        let errorObj = {
            code: 'UNKNOWN_ERROR',
            message: 'Невідома помилка',
            originalError: error
        };

        // Аналіз типу помилки
        if (error.name === 'AbortError') {
            errorObj.code = 'REQUEST_ABORTED';
            errorObj.message = 'Запит було скасовано';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorObj.code = 'NETWORK_ERROR';
            errorObj.message = `Не вдалося з'єднатися з сервером. Перевірте інтернет-з'єднання та спробуйте знову.`;
            triggerEvent('offline', errorObj);
        } else if (error.message && error.message.includes('timeout')) {
            errorObj.code = 'TIMEOUT_ERROR';
            errorObj.message = `Час очікування відповіді від сервера вичерпано. Спробуйте знову пізніше.`;
        } else if (error.status === 404 || (error.message && error.message.includes('404'))) {
            errorObj.code = 'NOT_FOUND';
            errorObj.message = `Сервер не може знайти потрібний ресурс (404). Спробуйте перезавантажити сторінку.`;
        } else if (error.status === 500 || (error.message && error.message.includes('500'))) {
            errorObj.code = 'SERVER_ERROR';
            errorObj.message = `Виникла помилка на сервері (500). Будь ласка, спробуйте пізніше.`;
        } else if (error.status === 401 || error.status === 403 ||
                  (error.message && (error.message.includes('401') || error.message.includes('403')))) {
            errorObj.code = 'UNAUTHORIZED';
            errorObj.message = `Помилка авторизації. Будь ласка, увійдіть знову.`;
            triggerEvent('unauthorized', errorObj);
        } else if (error.message && (error.message.includes('undefined') || error.message.includes('null'))) {
            errorObj.code = 'DATA_ERROR';
            errorObj.message = `Не вдалося отримати дані користувача. Спробуйте перезавантажити сторінку.`;
        } else if (error.message && error.message.includes('ID користувача не знайдено')) {
            errorObj.code = 'MISSING_USER_ID';
            errorObj.message = `Не вдалося визначити ваш ідентифікатор. Спробуйте вийти та увійти знову.`;
        } else if (typeof error.message === 'string') {
            errorObj.message = error.message;
        }

        // Викликаємо обробники помилок
        triggerEvent('error', errorObj);

        return errorObj;
    }

    /**
     * Функція виклику події
     */
    function triggerEvent(eventName, data) {
        if (!_events[eventName]) return;

        _events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`Помилка в обробнику події ${eventName}:`, e);
            }
        });
    }

    /**
     * Кешування відповіді
     */
    function cacheResponse(cacheKey, response, expiryTime = DEFAULT_CACHE_TIME) {
        if (!cacheKey) return;

        _responseCache.set(cacheKey, response);
        _cacheExpiry.set(cacheKey, Date.now() + expiryTime);

        if (_debugMode) {
            console.log(`📦 Кешовано відповідь для "${cacheKey}" на ${expiryTime/1000} секунд`);
        }
    }

    /**
     * Отримання кешованої відповіді
     */
    function getCachedResponse(cacheKey) {
        if (!cacheKey || !_responseCache.has(cacheKey)) return null;

        // Перевіряємо, чи не закінчився термін дії кешу
        const expiryTime = _cacheExpiry.get(cacheKey) || 0;
        if (Date.now() > expiryTime) {
            _responseCache.delete(cacheKey);
            _cacheExpiry.delete(cacheKey);
            return null;
        }

        if (_debugMode) {
            console.log(`📦 Повернено кешовану відповідь для "${cacheKey}"`);
        }

        return _responseCache.get(cacheKey);
    }

    /**
     * Очищення кешу
     */
    function clearCache(keyPattern = null) {
        if (keyPattern) {
            const keysToDelete = [];

            // Збираємо ключі для видалення
            _responseCache.forEach((_, key) => {
                if (key.includes(keyPattern)) {
                    keysToDelete.push(key);
                }
            });

            // Видаляємо зібрані ключі
            keysToDelete.forEach(key => {
                _responseCache.delete(key);
                _cacheExpiry.delete(key);
            });

            if (_debugMode) {
                console.log(`🧹 Очищено кеш за шаблоном "${keyPattern}" (${keysToDelete.length} записів)`);
            }
        } else {
            _responseCache.clear();
            _cacheExpiry.clear();

            if (_debugMode) {
                console.log(`🧹 Повністю очищено кеш відповідей`);
            }
        }
    }

    /**
     * Індикатори завантаження
     */
    const LoadingIndicator = {
        _active: 0,
        _spinner: null,

        /**
         * Створення елемента спіннера
         */
        _createSpinner: function() {
            const spinner = document.createElement('div');
            spinner.id = 'api-loading-spinner';
            spinner.className = 'api-loading-spinner';
            spinner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #4eb5f7, #00C9A7);
                z-index: 10000;
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            `;
            document.body.appendChild(spinner);
            return spinner;
        },

        /**
         * Показ індикатора завантаження
         */
        show: function() {
            this._active++;

            if (!this._spinner) {
                this._spinner = this._createSpinner();
            }

            // Затримка для анімації
            setTimeout(() => {
                if (this._active > 0) {
                    this._spinner.style.transform = 'translateX(-10%)';
                }
            }, 10);

            // Імітація прогресу
            setTimeout(() => {
                if (this._active > 0) {
                    this._spinner.style.transform = 'translateX(-5%)';
                }
            }, 300);
        },

        /**
         * Приховування індикатора завантаження
         */
        hide: function() {
            if (this._active > 0) {
                this._active--;
            }

            if (this._active === 0 && this._spinner) {
                this._spinner.style.transform = 'translateX(0)';

                // Після завершення анімації приховуємо повністю
                setTimeout(() => {
                    if (this._active === 0) {
                        this._spinner.style.transform = 'translateX(-100%)';
                    }
                }, 300);
            }
        },

        /**
         * Примусове скидання індикатора (для використання при помилках)
         */
        reset: function() {
            this._active = 0;

            if (this._spinner) {
                this._spinner.style.transform = 'translateX(-100%)';
            }
        }
    };

    /**
     * Обробка стану мережі
     */
    function setupNetworkHandlers() {
        // Обробник переходу в офлайн
        window.addEventListener('offline', () => {
            _isOnline = false;
            triggerEvent('offline', { message: "З'єднання з мережею втрачено" });

            // Показуємо повідомлення
            showOfflineNotification();
        });

        // Обробник повернення онлайн
        window.addEventListener('online', () => {
            _isOnline = true;
            triggerEvent('online', { message: "З'єднання з мережею відновлено" });

            // Приховуємо повідомлення
            hideOfflineNotification();

            // Повторюємо всі призупинені запити
            retryPendingRequests();
        });
    }

    /**
     * Показ повідомлення про офлайн-режим
     */
    function showOfflineNotification() {
        if (document.getElementById('offline-notification')) return;

        const notification = document.createElement('div');
        notification.id = 'offline-notification';
        notification.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f44336;
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: bold;
            z-index: 9999;
            transform: translateY(-100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = "Немає з'єднання з Інтернетом";

        document.body.appendChild(notification);

        // Затримка для анімації
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
        }, 10);
    }

    /**
     * Приховування повідомлення про офлайн-режим
     */
    function hideOfflineNotification() {
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.style.transform = 'translateY(-100%)';

            // Видаляємо елемент після завершення анімації
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    /**
     * Повторення призупинених запитів
     */
    function retryPendingRequests() {
        if (_pendingRequests.length === 0) return;

        console.log(`🔄 Повторення ${_pendingRequests.length} призупинених запитів...`);

        const requests = [..._pendingRequests];
        _pendingRequests = [];

        requests.forEach(request => {
            apiRequest(
                request.endpoint,
                request.method,
                request.data,
                request.options
            ).then(request.resolve).catch(request.reject);
        });
    }

    /**
     * Скасування активного запиту
     */
    function abortRequest(requestId) {
        if (_abortControllers.has(requestId)) {
            _abortControllers.get(requestId).abort();
            _abortControllers.delete(requestId);
            return true;
        }
        return false;
    }

    /**
     * Скасування всіх активних запитів
     */
    function abortAllRequests() {
        let count = 0;
        _abortControllers.forEach((controller, requestId) => {
            controller.abort();
            count++;
        });
        _abortControllers.clear();

        if (_debugMode && count > 0) {
            console.log(`🛑 Скасовано ${count} активних запитів`);
        }

        return count;
    }

    // ======== ОСНОВНА ФУНКЦІЯ API-ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту відносно базового URL
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки (для POST/PUT запитів)
     * @param {Object} options - Додаткові параметри запиту
     * @returns {Promise<Object>} Результат запиту у форматі JSON
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
        // Створюємо унікальний ID запиту
        const requestId = options.requestId || generateRequestId();

        // Стандартні налаштування
        const defaults = {
            // Загальні налаштування
            hideLoader: false,         // Не показувати індикатор завантаження
            retry: 3,                  // Кількість спроб при помилці
            retryDelay: 1000,          // Затримка між спробами (мс)
            timeout: 30000,            // Таймаут запиту (мс)

            // Кешування
            cache: false,              // Використовувати кеш
            cacheTime: DEFAULT_CACHE_TIME, // Час зберігання в кеші (мс)
            cacheKey: null,            // Ключ для кешування (якщо null, генерується автоматично)

            // HTTP налаштування
            headers: {},               // Додаткові заголовки
            credentials: 'include',    // Включати куки у запити

            // Обробка результатів та помилок
            onSuccess: null,           // Функція успішного виконання
            onError: null,             // Функція обробки помилок
            transform: null,           // Функція перетворення результату

            // Інші налаштування
            abortable: true,           // Можливість скасування запиту
            abortPrevious: false,      // Скасовувати попередній запит з таким самим ключем
            abortOnUnmount: false,     // Скасовувати при видаленні компонента

            // Офлайн режим
            offlineMode: 'queue',      // Режим роботи в офлайн: 'queue', 'cache', 'error'
            forceOffline: false,       // Примусово вважати запит офлайн
        };

        // Об'єднуємо дефолтні налаштування з переданими
        const settings = { ...defaults, ...options };

        // Якщо передано конкретний ключ кешу, використовуємо його
        // Інакше генеруємо ключ на основі endpoint, method і даних
        const cacheKey = settings.cacheKey ||
            (settings.cache ? `${method}:${endpoint}:${JSON.stringify(data)}` : null);

        // Перевіряємо, чи скасовувати попередній запит з таким самим ключем
        if (settings.abortPrevious && cacheKey && _abortControllers.has(cacheKey)) {
            abortRequest(cacheKey);
        }

        // Отримуємо ID користувача
        const userId = getUserId();

        // Додаємо мітку часу для запобігання кешуванню
        const timestamp = Date.now();
        const url = `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}t=${timestamp}`;

        // Викликаємо подію перед запитом
        triggerEvent('beforeRequest', { requestId, url, method, data, settings });

        // Перевіряємо наявність кешованої відповіді
        if (settings.cache && method === 'GET') {
            const cachedResponse = getCachedResponse(cacheKey);
            if (cachedResponse) {
                // Якщо є функція перетворення, застосовуємо її
                const result = settings.transform ?
                    settings.transform(cachedResponse) : cachedResponse;

                // Виклик функції успішного виконання
                if (settings.onSuccess) {
                    settings.onSuccess(result);
                }

                // Викликаємо подію після запиту
                triggerEvent('afterRequest', {
                    requestId,
                    url,
                    method,
                    data,
                    response: result,
                    cached: true
                });

                return result;
            }
        }

        // Перевіряємо наявність з'єднання
        if (!_isOnline || settings.forceOffline) {
            if (settings.offlineMode === 'cache' && settings.cache) {
                // Спроба отримати кешовану відповідь незалежно від терміну дії
                const cachedResponse = _responseCache.get(cacheKey);
                if (cachedResponse) {
                    const result = settings.transform ?
                        settings.transform(cachedResponse) : cachedResponse;

                    if (settings.onSuccess) {
                        settings.onSuccess(result);
                    }

                    return result;
                }
            } else if (settings.offlineMode === 'queue') {
                // Додаємо запит у чергу для виконання, коли з'єднання буде відновлено
                return new Promise((resolve, reject) => {
                    _pendingRequests.push({
                        endpoint,
                        method,
                        data,
                        options: settings,
                        resolve,
                        reject
                    });

                    if (_debugMode) {
                        console.log(`📥 Запит додано в чергу офлайн-режиму: ${method} ${endpoint}`);
                    }
                });
            } else {
                // Повертаємо помилку про відсутність з'єднання
                const error = new Error("Немає з'єднання з мережею");
                error.code = 'OFFLINE';

                if (settings.onError) {
                    settings.onError(error);
                }

                throw error;
            }
        }

        // Показуємо індикатор завантаження, якщо він не вимкнений в опціях
        if (!settings.hideLoader) {
            LoadingIndicator.show();
        }

        // Логуємо запит у режимі відлагодження
        if (_debugMode) {
            console.log(`🔄 Відправка ${method} запиту на ${url}`);
            if (data) console.log("📦 Дані запиту:", data);
        }

        // Створюємо контролер для можливості скасування запиту
        let abortController = null;
        if (settings.abortable) {
            abortController = new AbortController();
            _abortControllers.set(requestId, abortController);

            // Таймаут для запиту
            setTimeout(() => {
                if (_abortControllers.has(requestId)) {
                    abortController.abort();
                    _abortControllers.delete(requestId);
                    console.warn(`⏱️ Запит ${requestId} скасовано через таймаут (${settings.timeout}мс)`);
                }
            }, settings.timeout);
        }

        // Підготовка параметрів запиту
        const requestOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId || '',
                'X-Client-Version': API_VERSION,
                'X-Request-ID': requestId,
                ...settings.headers
            },
            credentials: settings.credentials
        };

        // Додаємо сигнал для скасування, якщо потрібно
        if (abortController) {
            requestOptions.signal = abortController.signal;
        }

        // Додаємо тіло запиту для POST/PUT
        if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            requestOptions.body = JSON.stringify(data);
        }

        // Функція для виконання запиту з повторними спробами
        async function executeRequest(attemptsLeft) {
            try {
                const response = await fetch(url, requestOptions);

                // Приховуємо індикатор завантаження
                if (!settings.hideLoader) {
                    LoadingIndicator.hide();
                }

                // Видаляємо запит з активних
                if (requestId && _abortControllers.has(requestId)) {
                    _abortControllers.delete(requestId);
                }

                // Перевіряємо статус відповіді
                if (!response.ok) {
                    const statusText = response.statusText || '';
                    console.error(`❌ Помилка API-запиту: ${response.status} ${statusText}`);

                    // Для 401/403 помилок авторизації
                    if (response.status === 401 || response.status === 403) {
                        console.warn('🔐 Помилка авторизації, викликаємо подію unauthorized');
                        triggerEvent('unauthorized', {
                            status: response.status,
                            message: 'Помилка авторизації'
                        });
                    }

                    // Для 404 помилок
                    if (response.status === 404) {
                        console.error(`⚠️ Ресурс не знайдено: ${url}`);
                        throw new Error(`Запитаний ресурс недоступний (404)`);
                    }

                    // Якщо залишились спроби, повторюємо запит
                    if (attemptsLeft > 0) {
                        const delay = Math.pow(2, settings.retry - attemptsLeft) * settings.retryDelay;
                        if (_debugMode) {
                            console.log(`⏱️ Повтор запиту через ${delay}мс (залишилось спроб: ${attemptsLeft})`);
                        }

                        await new Promise(resolve => setTimeout(resolve, delay));
                        return executeRequest(attemptsLeft - 1);
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

                    const error = new Error(jsonData.message || 'Помилка виконання запиту');
                    error.response = jsonData;

                    if (settings.onError) {
                        settings.onError(error);
                    }

                    throw error;
                }

                if (_debugMode) {
                    console.log(`✅ Успішний API-запит на ${url}`);
                    console.log("📊 Дані відповіді:", jsonData);
                }

                // Кешуємо відповідь, якщо потрібно
                if (settings.cache && method === 'GET' && cacheKey) {
                    cacheResponse(cacheKey, jsonData, settings.cacheTime);
                }

                // Застосовуємо функцію перетворення, якщо вона є
                const result = settings.transform ? settings.transform(jsonData) : jsonData;

                // Викликаємо функцію успішного виконання, якщо вона є
                if (settings.onSuccess) {
                    settings.onSuccess(result);
                }

                // Викликаємо подію після запиту
                triggerEvent('afterRequest', {
                    requestId,
                    url,
                    method,
                    data,
                    response: result,
                    cached: false
                });

                return result;
            } catch (error) {
                // Приховуємо індикатор завантаження у випадку помилки
                if (!settings.hideLoader) {
                    LoadingIndicator.hide();
                }

                // Видаляємо запит з активних
                if (requestId && _abortControllers.has(requestId)) {
                    _abortControllers.delete(requestId);
                }

                // Якщо запит був скасований, не обробляємо помилку далі
                if (error.name === 'AbortError') {
                    console.log(`🛑 Запит ${requestId} було скасовано`);
                    throw error;
                }

                // Для мережевих помилок пробуємо ще раз
                if (error.name === 'TypeError' && error.message.includes('fetch') && attemptsLeft > 0) {
                    const delay = Math.pow(2, settings.retry - attemptsLeft) * settings.retryDelay;
                    console.log(`⚠️ Мережева помилка, повтор через ${delay}мс (залишилось спроб: ${attemptsLeft}):`, error.message);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return executeRequest(attemptsLeft - 1);
                }

                // Обробка інших помилок
                const errorObj = handleApiError(error, `${method} запит на ${endpoint}`);

                // Викликаємо функцію обробки помилок, якщо вона є
                if (settings.onError) {
                    settings.onError(errorObj);
                }

                throw errorObj;
            }
        }

        // Починаємо процес запиту з повторними спробами
        return executeRequest(settings.retry);
    }

    // ======== API ФУНКЦІЇ ДЛЯ АВТОРИЗАЦІЇ ТА КОРИСТУВАЧА ========

    /**
     * Авторизація користувача
     * @param {Object} userData - Дані користувача з Telegram WebApp
     * @returns {Promise<Object>} - Результат авторизації
     */
    async function authorize(userData) {
        try {
            const result = await apiRequest('/api/auth', 'POST', userData, {
                cache: false,
                retry: 5,
                retryDelay: 1000,
                transform: (response) => {
                    if (response.status === 'success' && response.data) {
                        // Зберігаємо ID користувача
                        if (response.data.telegram_id) {
                            localStorage.setItem('telegram_user_id', response.data.telegram_id);

                            // Якщо є модуль управління ID
                            if (window.UserIdManager && typeof window.UserIdManager.setUserId === 'function') {
                                window.UserIdManager.setUserId(response.data.telegram_id);
                            }
                        }

                        // Зберігаємо дані балансу
                        if (response.data.balance !== undefined) {
                            localStorage.setItem('userTokens', response.data.balance.toString());
                            localStorage.setItem('winix_balance', response.data.balance.toString());
                        }

                        if (response.data.coins !== undefined) {
                            localStorage.setItem('userCoins', response.data.coins.toString());
                            localStorage.setItem('winix_coins', response.data.coins.toString());
                        }

                        // Зберігаємо токен авторизації, якщо він є
                        if (response.data.token) {
                            localStorage.setItem('auth_token', response.data.token);
                        }
                    }

                    return response;
                }
            });

            return result;
        } catch (error) {
            // Додаткова діагностика
            console.error('Деталі помилки авторизації:', error);

            // Перевіряємо, чи передаються header'и
            if (userData) {
                console.debug('Дані користувача для діагностики:', {
                    hasId: Boolean(userData.id || userData.telegram_id),
                    hasInitData: Boolean(userData.initData),
                    dataType: typeof userData
                });
            }

            throw error;
        }
    }

    /**
     * Отримання даних користувача
     * @param {string} userId - ID користувача (опціонально, за замовчуванням береться з поточного користувача)
     * @returns {Promise<Object>} - Дані користувача
     */
    async function getUserData(userId = null) {
        const id = userId || getUserId();
        if (!id) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${id}`, 'GET', null, {
            cache: true,
            cacheTime: 60 * 1000, // 1 хвилина
            transform: (response) => {
                if (response.status === 'success' && response.data) {
                    // Оновлюємо баланс і жетони в localStorage
                    if (response.data.balance !== undefined) {
                        localStorage.setItem('userTokens', response.data.balance.toString());
                        localStorage.setItem('winix_balance', response.data.balance.toString());
                    }

                    if (response.data.coins !== undefined) {
                        localStorage.setItem('userCoins', response.data.coins.toString());
                        localStorage.setItem('winix_coins', response.data.coins.toString());
                    }

                    // Оновлюємо дані стейкінгу, якщо вони є
                    if (response.data.staking_data) {
                        localStorage.setItem('stakingData', JSON.stringify(response.data.staking_data));
                        localStorage.setItem('winix_staking', JSON.stringify(response.data.staking_data));
                    }
                }

                return response;
            }
        });
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

        // Якщо оновлення успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}`);
        }

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

        return apiRequest(`/api/user/${userId}/staking`, 'GET', null, {
            cache: true,
            cacheTime: 60 * 1000, // 1 хвилина
            transform: (response) => {
                if (response.status === 'success' && response.data) {
                    // Зберігаємо дані стейкінгу
                    localStorage.setItem('stakingData', JSON.stringify(response.data));
                    localStorage.setItem('winix_staking', JSON.stringify(response.data));
                }

                return response;
            }
        });
    }

    /**
     * Отримання історії стейкінгу
     * @returns {Promise<Array>} - Історія стейкінгу
     */
    async function getStakingHistory() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/staking/history`, 'GET');
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

        const result = await apiRequest(`/api/user/${userId}/staking`, 'POST', {
            stakingAmount: Math.floor(amount),
            period: period
        });

        // Якщо створення стейкінгу успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/staking`);
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
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

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            const stakingData = await getStakingData();
            if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                throw new Error("У вас немає активного стейкінгу");
            }
            targetStakingId = stakingData.data.stakingId;
        }

        const result = await apiRequest(`/api/user/${userId}/staking/${targetStakingId}`, 'PUT', {
            additionalAmount: Math.floor(amount)
        });

        // Якщо додавання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/staking`);
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
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
            const stakingData = await getStakingData();
            if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                throw new Error("У вас немає активного стейкінгу");
            }
            targetStakingId = stakingData.data.stakingId;
        }

        const result = await apiRequest(`/api/user/${userId}/staking/${targetStakingId}/cancel`, 'POST', {
            timestamp: Date.now()
        });

        // Якщо скасування успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/staking`);
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} - Очікувана винагорода
     */
    async function calculateExpectedReward(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/staking/calculate-reward?amount=${amount}&period=${period}`, 'GET');
    }

    /**
     * Відновлення стейкінгу
     * @param {boolean} force - Примусове відновлення
     * @returns {Promise<Object>} - Результат відновлення стейкінгу
     */
    async function repairStaking(force = false) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/staking/repair`, 'POST', {
            force: force,
            timestamp: Date.now()
        });

        // Якщо відновлення успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/staking`);
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    /**
     * Глибоке відновлення стейкінгу
     * @param {number} adjustBalance - Коригування балансу
     * @returns {Promise<Object>} - Результат глибокого відновлення
     */
    async function deepRepairStaking(adjustBalance = 0) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/staking/deep-repair`, 'POST', {
            balance_adjustment: adjustBalance,
            timestamp: Date.now()
        });

        // Якщо відновлення успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/staking`);
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
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

        return apiRequest(`/api/user/${userId}/balance`, 'GET', null, {
            cache: true,
            cacheTime: 30 * 1000, // 30 секунд
            transform: (response) => {
                if (response.status === 'success' && response.data) {
                    // Оновлюємо баланс в localStorage
                    if (response.data.balance !== undefined) {
                        localStorage.setItem('userTokens', response.data.balance.toString());
                        localStorage.setItem('winix_balance', response.data.balance.toString());
                    }

                    if (response.data.coins !== undefined) {
                        localStorage.setItem('userCoins', response.data.coins.toString());
                        localStorage.setItem('winix_coins', response.data.coins.toString());
                    }
                }

                return response;
            }
        });
    }

    /**
     * Додавання токенів
     * @param {number} amount - Кількість токенів
     * @param {string} description - Опис транзакції
     * @returns {Promise<Object>} - Результат додавання токенів
     */
    async function addTokens(amount, description = 'Додавання токенів') {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/add-tokens`, 'POST', {
            amount: amount,
            description: description
        });

        // Якщо додавання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    /**
     * Віднімання токенів
     * @param {number} amount - Кількість токенів
     * @param {string} description - Опис транзакції
     * @returns {Promise<Object>} - Результат віднімання токенів
     */
    async function subtractTokens(amount, description = 'Віднімання токенів') {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/subtract-tokens`, 'POST', {
            amount: amount,
            description: description
        });

        // Якщо віднімання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    /**
     * Додавання жетонів
     * @param {number} amount - Кількість жетонів
     * @returns {Promise<Object>} - Результат додавання жетонів
     */
    async function addCoins(amount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/add-coins`, 'POST', {
            amount: amount
        });

        // Якщо додавання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    /**
     * Віднімання жетонів
     * @param {number} amount - Кількість жетонів
     * @returns {Promise<Object>} - Результат віднімання жетонів
     */
    async function subtractCoins(amount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/subtract-coins`, 'POST', {
            amount: amount
        });

        // Якщо віднімання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    /**
     * Конвертація жетонів в токени
     * @param {number} coinsAmount - Кількість жетонів для конвертації
     * @returns {Promise<Object>} - Результат конвертації
     */
    async function convertCoinsToTokens(coinsAmount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/convert-coins`, 'POST', {
            coins_amount: coinsAmount
        });

        // Якщо конвертація успішна, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
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

        return apiRequest(`/api/user/${userId}/transactions?limit=${limit}`, 'GET', null, {
            cache: true,
            cacheTime: 60 * 1000, // 1 хвилина
        });
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

        const result = await apiRequest(`/api/user/${userId}/send-tokens`, 'POST', {
            recipient_id: recipientId,
            amount: amount,
            description: description
        });

        // Якщо надсилання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/balance`);
            clearCache(`/api/user/${userId}/transactions`);
        }

        return result;
    }

    // ======== API ФУНКЦІЇ ДЛЯ РЕФЕРАЛЬНОЇ СИСТЕМИ ========

    /**
     * Отримання реферального посилання
     * @returns {Promise<Object>} - Реферальне посилання
     */
    async function getReferralLink() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/referral-link`, 'GET', null, {
            cache: true,
            cacheTime: 24 * 60 * 60 * 1000, // 24 години
        });
    }

    /**
     * Отримання інформації про рефералів
     * @returns {Promise<Object>} - Інформація про рефералів
     */
    async function getReferrals() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`/api/user/${userId}/referrals`, 'GET', null, {
            cache: true,
            cacheTime: 5 * 60 * 1000, // 5 хвилин
        });
    }

    /**
     * Отримання винагороди за реферальне завдання
     * @param {string} taskId - ID завдання
     * @param {number} reward - Сума винагороди
     * @returns {Promise<Object>} - Результат отримання винагороди
     */
    async function claimReferralReward(taskId, reward) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const result = await apiRequest(`/api/user/${userId}/claim-referral-reward`, 'POST', {
            taskId: taskId,
            reward: reward
        });

        // Якщо отримання успішне, оновлюємо кеш
        if (result.status === 'success') {
            clearCache(`/api/user/${userId}/referral-tasks`);
            clearCache(`/api/user/${userId}/balance`);
        }

        return result;
    }

    // ======== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ========

    /**
     * Ініціалізація API модуля
     * @param {Object} config - Конфігурація модуля
     */
    function initApi(config = {}) {
        if (_isInitialized) {
            console.log("⚠️ API модуль вже ініціалізовано");
            return;
        }

        console.log("🚀 Ініціалізація API модуля");

        // Застосовуємо конфігурацію
        if (config.debug !== undefined) _debugMode = config.debug;

        // Налаштовуємо обробники мережі
        setupNetworkHandlers();

        // Встановлюємо прапорець ініціалізації
        _isInitialized = true;

        console.log("✅ API модуль успішно ініціалізовано");
    }

    /**
     * Додавання обробника події
     * @param {string} eventName - Назва події
     * @param {Function} callback - Функція-обробник
     */
    function on(eventName, callback) {
        if (!_events[eventName]) {
            console.warn(`Подія "${eventName}" не підтримується`);
            return;
        }

        _events[eventName].push(callback);

        if (_debugMode) {
            console.log(`✓ Додано обробник події "${eventName}"`);
        }
    }

    /**
     * Видалення обробника події
     * @param {string} eventName - Назва події
     * @param {Function} callback - Функція-обробник
     */
    function off(eventName, callback) {
        if (!_events[eventName]) return;

        const initialLength = _events[eventName].length;
        _events[eventName] = _events[eventName].filter(cb => cb !== callback);

        if (_debugMode && initialLength !== _events[eventName].length) {
            console.log(`✓ Видалено обробник події "${eventName}"`);
        }
    }

    // Створюємо публічний API модуль
    const WinixAPI = {
        // Конфігурація
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },

        // Ініціалізація
        init: initApi,

        // Базова функція для API запитів
        apiRequest,

        // Управління подіями
        on,
        off,

        // Авторизація та користувач
        authorize,
        getUserId,
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

        // Управління кешем
        clearCache,

        // Управління запитами
        abortRequest,
        abortAllRequests,

        // Стан мережі
        isOnline: () => _isOnline,

        // Утиліти
        handleApiError
    };

    // Експортуємо в глобальний об'єкт
    window.WinixAPI = WinixAPI;

    // Для зворотної сумісності експортуємо функцію apiRequest глобально
    window.apiRequest = apiRequest;

    // Автоматична ініціалізація
    initApi({ debug: false });

    console.log("✅ Новий API модуль успішно завантажено");

    return WinixAPI;
})();