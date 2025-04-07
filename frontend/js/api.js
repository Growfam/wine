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

    // Прапорець для запобігання рекурсивним викликам
    let _gettingUserId = false;
    let _apiRequestInProgress = false;

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * Отримати ID користувача з доступних джерел
     * @param {number} attempts - Кількість спроб (для запобігання нескінченній рекурсії)
     * @returns {string|null} ID користувача або null, якщо не знайдено
     */
    function getUserId(attempts = 0) {
        // Обмеження кількості спроб для запобігання нескінченній рекурсії
        if (attempts > 3 || _gettingUserId) {
            console.warn("⚠️ Досягнуто ліміт спроб отримання ID користувача або вже виконується");
            return null;
        }

        _gettingUserId = true;

        try {
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

                            _gettingUserId = false;
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
                    _gettingUserId = false;
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

                        _gettingUserId = false;
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

                    _gettingUserId = false;
                    return urlId;
                }
            } catch (e) {
                console.warn("Помилка отримання ID з URL параметрів:", e);
            }

            // Повертаємо null, якщо ID не знайдено
            console.warn("⚠️ Не вдалося отримати ID користувача");
            _gettingUserId = false;
            return null;
        } catch (e) {
            console.error("❌ Критична помилка в getUserId:", e);
            _gettingUserId = false;
            return null;
        }
    }

    // ======== ОСНОВНА ФУНКЦІЯ API-ЗАПИТУ ========

   /**
 * Універсальна функція для виконання API-запитів з покращеною обробкою помилок
 * @param {string} endpoint - URL ендпоінту відносно базового URL
 * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
 * @param {Object} data - Дані для відправки (для POST/PUT запитів)
 * @param {Object} options - Додаткові параметри запиту
 * @param {number} retries - Кількість повторних спроб при помилці
 * @returns {Promise<Object>} Результат запиту у форматі JSON
 */
async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
    // Ідентифікатор запиту для логування
    const requestId = Math.random().toString(36).substring(2, 8);
    const operationName = options.operationName || `${method} ${endpoint}`;

    // Перевіряємо, чи не виконується вже запит з тими ж параметрами
    if (_apiRequestInProgress && !options.skipProgressCheck) {
        console.warn(`⚠️ [${requestId}] API запит вже виконується, очікуйте: ${endpoint}`);

        // Можливість продовжити без очікування
        if (options.forceContinue) {
            console.warn(`⚠️ [${requestId}] Примусове продовження запиту ${endpoint}`);
        } else {
            try {
                await new Promise(resolve => setTimeout(resolve, 500));
                // Рекурсивно викликаємо apiRequest з меншою кількістю спроб
                if (retries > 1) {
                    return apiRequest(endpoint, method, data, {
                        ...options,
                        forceContinue: true
                    }, retries - 1);
                }
            } catch (e) {
                console.warn(`⚠️ [${requestId}] Помилка під час очікування:`, e.message);
            }
        }
    }

    // Блокуємо паралельні запити (якщо не вказано інше)
    if (!options.allowParallel) {
        _apiRequestInProgress = true;
    }

    try {
        // Отримуємо ID користувача
        const userId = getUserId();

        // Перевіряємо наявність валідного ID користувача
        if (!userId && !options.skipUserIdCheck) {
            const error = new Error("ID користувача не знайдено");
            console.error(`❌ [${requestId}] API-запит ${operationName} скасовано: ${error.message}`);
            _apiRequestInProgress = false;

            // Якщо вказана опція обробки помилок
            if (typeof handleApiError === 'function' && !options.skipErrorHandling) {
                handleApiError(error, operationName, options.showToast !== false);
            }

            // Генеруємо подію для можливої обробки
            document.dispatchEvent(new CustomEvent('api-error', {
                detail: { error, endpoint, method, requestId }
            }));

            throw error;
        }

        // Додаємо мітку часу для запобігання кешуванню
        const timestamp = Date.now();
        const hasQuery = endpoint.includes('?');
        const url = `${API_BASE_URL}${endpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;

        // Показуємо індикатор завантаження, якщо він не вимкнений в опціях
        if (!options.hideLoader) {
            if (typeof showLoader === 'function') {
                showLoader();
            } else if (typeof window.showLoading === 'function') {
                window.showLoading();
            }
        }

        // Логуємо запит у режимі відлагодження
        if (_debugMode) {
            console.log(`🔄 [${requestId}] Відправка ${method} запиту на ${url}`);
            if (data) {
                console.log(`📦 [${requestId}] Дані запиту:`, data);
            }
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
                // Додаємо timeout для запиту
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                }, options.timeout || 20000); // 20 секунд за замовчуванням

                // Додаємо signal до requestOptions, якщо ще немає
                if (!requestOptions.signal) {
                    requestOptions.signal = controller.signal;
                }

                // Виконуємо запит
                const response = await fetch(url, requestOptions);

                // Очищаємо timeout
                clearTimeout(timeoutId);

                // Приховуємо індикатор завантаження
                if (!options.hideLoader) {
                    if (typeof hideLoader === 'function') {
                        hideLoader();
                    } else if (typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }
                }

                // Перевіряємо статус відповіді
                if (!response.ok) {
                    const statusText = response.statusText || '';
                    console.error(`❌ [${requestId}] Помилка API-запиту: ${response.status} ${statusText} (${url})`);

                    // Додаткові дії для різних кодів помилок
                    if (response.status === 401 || response.status === 403) {
                        console.warn(`🔐 [${requestId}] Помилка авторизації, спроба оновити дані користувача`);

                        // Генеруємо подію для можливого оновлення авторизації
                        document.dispatchEvent(new CustomEvent('auth-error', {
                            detail: { endpoint, method, status: response.status }
                        }));
                    }

                    if (response.status === 404) {
                        throw new Error(`Запитаний ресурс недоступний (404)`);
                    }

                    if (response.status === 405) {
                        throw new Error(`Метод ${method} не дозволено для цього ресурсу (405)`);
                    }

                    // Спробуємо отримати більше інформації з відповіді
                    let responseData;
                    try {
                        responseData = await response.json();
                        if (responseData && responseData.message) {
                            throw new Error(responseData.message);
                        }
                    } catch (parseError) {
                        // Ігноруємо помилки парсингу для нетекстових відповідей
                    }

                    // Якщо залишились спроби, повторюємо запит
                    if (attemptsLeft > 0) {
                        const delay = Math.pow(2, retries - attemptsLeft) * 500; // Експоненційна затримка
                        if (_debugMode) {
                            console.log(`⏱️ [${requestId}] Повтор запиту через ${delay}мс (залишилось спроб: ${attemptsLeft})`);
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
                    console.error(`❌ [${requestId}] Помилка парсингу JSON відповіді:`, parseError);
                    throw new Error('Некоректний формат відповіді');
                }

                // Перевіряємо, чи є помилка у відповіді
                if (jsonData && jsonData.status === 'error') {
                    console.error(`❌ [${requestId}] API повернув помилку:`, jsonData.message);
                    throw new Error(jsonData.message || 'Помилка виконання запиту');
                }

                if (_debugMode) {
                    console.log(`✅ [${requestId}] Успішний API-запит на ${url}`);
                    console.log(`📊 [${requestId}] Дані відповіді:`, jsonData);
                }

                // Кешуємо відповідь, якщо потрібно
                if (options.cache && typeof options.cacheKey === 'string') {
                    try {
                        // Зберігаємо результат у localStorage або sessionStorage
                        const storage = options.sessionCache ? sessionStorage : localStorage;
                        const cacheData = {
                            data: jsonData,
                            timestamp: Date.now(),
                            expires: options.cacheTime || 60000 // 1 хвилина за замовчуванням
                        };
                        storage.setItem(options.cacheKey, JSON.stringify(cacheData));
                    } catch (cacheError) {
                        console.warn(`⚠️ [${requestId}] Помилка кешування:`, cacheError.message);
                    }
                }

                _apiRequestInProgress = false;
                return jsonData;

            } catch (error) {
                // Приховуємо індикатор завантаження у випадку помилки
                if (!options.hideLoader) {
                    if (typeof hideLoader === 'function') {
                        hideLoader();
                    } else if (typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }
                }

                // Перевіряємо на помилку Abort контролера (timeout)
                if (error.name === 'AbortError') {
                    error.message = `Час очікування відповіді від сервера вичерпано (${options.timeout || 20000}мс)`;
                }

                // Для мережевих помилок пробуємо ще раз
                const isNetworkError = error.name === 'TypeError' ||
                                      error.message.includes("Failed to fetch") ||
                                      error.message.includes("Network error");

                if (isNetworkError && attemptsLeft > 0) {
                    const delay = Math.pow(2, retries - attemptsLeft) * 500;
                    console.log(`⚠️ [${requestId}] Мережева помилка, повтор через ${delay}мс (залишилось спроб: ${attemptsLeft}):`, error.message);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return tryRequest(attemptsLeft - 1);
                }

                _apiRequestInProgress = false;
                throw error;
            }
        }

        // Спочатку перевіряємо кеш, якщо увімкнено кешування
        if (options.cache && typeof options.cacheKey === 'string') {
            try {
                const storage = options.sessionCache ? sessionStorage : localStorage;
                const cachedDataStr = storage.getItem(options.cacheKey);

                if (cachedDataStr) {
                    const cachedData = JSON.parse(cachedDataStr);
                    const now = Date.now();

                    // Перевіряємо, чи кеш не застарів
                    if (cachedData && cachedData.timestamp &&
                        (now - cachedData.timestamp < cachedData.expires)) {

                        if (_debugMode) {
                            console.log(`🔄 [${requestId}] Використовуємо кешовані дані для ${url}`);
                        }

                        // Приховуємо індикатор завантаження
                        if (!options.hideLoader) {
                            if (typeof hideLoader === 'function') {
                                hideLoader();
                            } else if (typeof window.hideLoading === 'function') {
                                window.hideLoading();
                            }
                        }

                        _apiRequestInProgress = false;
                        return cachedData.data;
                    }
                }
            } catch (cacheError) {
                console.warn(`⚠️ [${requestId}] Помилка читання кешу:`, cacheError.message);
            }
        }

        // Починаємо процес запиту з повторними спробами
        return await tryRequest(retries);
    } catch (e) {
        _apiRequestInProgress = false;

        // Централізована обробка помилок
        if (typeof handleApiError === 'function' && !options.skipErrorHandling) {
            handleApiError(e, operationName, options.showToast !== false);
        } else {
            console.error(`❌ [${requestId}] Помилка API-запиту ${operationName}:`, e.message);
        }

        // Якщо вказана опція suppressErrors, повертаємо стандартний об'єкт помилки
        if (options.suppressErrors) {
            return {
                status: 'error',
                message: e.message || 'Сталася помилка при виконанні запиту',
                error: e,
                requestId
            };
        }

        throw e;
    }
}

    // ======== ФУНКЦІЇ ДЛЯ ОБРОБКИ ПОМИЛОК ТА ЗАВАНТАЖЕННЯ ========

    /**
 * Централізована обробка помилок API
 * @param {Error} error - Об'єкт помилки
 * @param {string} operation - Назва операції для логування
 * @param {boolean} showToast - Чи показувати повідомлення користувачу
 * @returns {string} Користувацьке повідомлення про помилку
 */
function handleApiError(error, operation = 'API операції', showToast = true) {
    // Запобігаємо дублюванню помилок - логуємо тільки один раз
    if (!error._logged) {
        console.error(`❌ Помилка ${operation}:`, error);
        error._logged = true;
    }

    // Щоб уникнути повторних сповіщень про ту саму помилку
    const now = Date.now();
    const lastErrorTime = window._lastErrorNotificationTime || 0;
    const lastErrorMessage = window._lastErrorMessage || '';
    const errorMessage = error.message || 'Невідома помилка';

    // Не показуємо те саме повідомлення частіше, ніж раз на 3 секунди
    const shouldShowToast = showToast &&
                           (now - lastErrorTime > 3000 || lastErrorMessage !== errorMessage);

    // Формуємо зрозуміле повідомлення залежно від типу помилки
    let userFriendlyMessage = '';

    if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
        userFriendlyMessage = `Не вдалося з'єднатися з сервером. Перевірте інтернет-з'єднання та спробуйте знову.`;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        userFriendlyMessage = `Час очікування відповіді від сервера вичерпано. Спробуйте знову пізніше.`;
    } else if (errorMessage.includes('404')) {
        userFriendlyMessage = `Сервер не може знайти потрібний ресурс. Спробуйте перезавантажити сторінку.`;
    } else if (errorMessage.includes('405')) {
        userFriendlyMessage = `Помилка API: метод не дозволений. Повідомте про помилку розробникам.`;
    } else if (errorMessage.includes('500')) {
        userFriendlyMessage = `Виникла помилка на сервері. Будь ласка, спробуйте пізніше.`;
    } else if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
        userFriendlyMessage = `Не вдалося отримати дані. Спробуйте перезавантажити сторінку.`;
    } else if (errorMessage.includes('ID користувача не знайдено')) {
        userFriendlyMessage = `Не вдалося визначити ваш ідентифікатор. Спробуйте вийти та увійти знову.`;
    } else {
        // Якщо немає спеціального обробника, використовуємо оригінальне повідомлення
        userFriendlyMessage = errorMessage;
    }

    // Показуємо повідомлення про помилку у випадку необхідності
    if (shouldShowToast) {
        // Зберігаємо час і текст останньої помилки
        window._lastErrorNotificationTime = now;
        window._lastErrorMessage = errorMessage;

        // Показуємо повідомлення з використанням доступних функцій
        if (typeof window.showModernNotification === 'function') {
            window.showModernNotification(userFriendlyMessage, true);
        } else if (typeof window.showToast === 'function') {
            window.showToast(userFriendlyMessage, 'error');
        } else if (typeof window.simpleAlert === 'function') {
            window.simpleAlert(userFriendlyMessage, true);
        } else if (typeof window.showMessage === 'function') {
            window.showMessage(userFriendlyMessage, true);
        } else {
            // Уникаємо надмірних спливаючих вікон - використовуємо alert тільки для критичних помилок
            if (operation.includes('critical') || error.critical) {
                alert(userFriendlyMessage);
            }
        }
    }

    // Відправляємо подію для можливого логування на сервері або інших обробників
    document.dispatchEvent(new CustomEvent('api-error', {
        detail: {
            errorType: error.name,
            message: errorMessage,
            operation: operation,
            timestamp: now
        }
    }));

    return userFriendlyMessage;
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
    if (_apiRequestInProgress) {
        console.warn(`⚠️ API запит вже виконується, очікуйте: скасування стейкінгу`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    _apiRequestInProgress = true;

    try {
        // Отримуємо ID користувача
        const userId = getUserId();

        // Перевіряємо наявність валідного ID користувача
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            console.error(`❌ API-запит скасування стейкінгу скасовано: ${error.message}`);
            _apiRequestInProgress = false;
            throw error;
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingData = await getStakingData();
                if (!stakingData || stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                    throw new Error("У вас немає активного стейкінгу");
                }
                targetStakingId = stakingData.data.stakingId;

                if (!targetStakingId) {
                    throw new Error("Не вдалося визначити ID стейкінгу");
                }

                console.log(`🔍 Отримано ID стейкінгу: ${targetStakingId}`);
            } catch (error) {
                console.error("Помилка отримання ID стейкінгу:", error);

                // Спробуємо отримати ID з localStorage як резервний варіант
                try {
                    const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                    if (stakingDataStr) {
                        const localData = JSON.parse(stakingDataStr);
                        if (localData && localData.stakingId) {
                            targetStakingId = localData.stakingId;
                            console.log(`🔍 Отримано ID стейкінгу з localStorage: ${targetStakingId}`);
                        }
                    }
                } catch (localError) {
                    console.error("Помилка читання з localStorage:", localError);
                }

                if (!targetStakingId) {
                    _apiRequestInProgress = false;
                    throw new Error("Не вдалося отримати ID стейкінгу");
                }
            }
        }

        // Показуємо індикатор завантаження
        showLoader();

        console.log(`🔄 Виконання запиту скасування стейкінгу для ID: ${targetStakingId}`);

        // Виконуємо запит з більшою кількістю повторних спроб
        const response = await apiRequest(`/api/user/${userId}/staking/${targetStakingId}/cancel`, 'POST', null, {}, 5);

        // Приховуємо індикатор завантаження
        hideLoader();

        // Якщо запит успішний, оновлюємо кеш стейкінгу
        if (response && response.status === 'success') {
            // Скидаємо кеш даних стейкінгу
            localStorage.removeItem('stakingData');
            localStorage.removeItem('winix_staking');

            // Якщо є оновлений баланс, оновлюємо його в localStorage
            if (response.data && response.data.newBalance !== undefined) {
                localStorage.setItem('userTokens', response.data.newBalance.toString());
                localStorage.setItem('winix_balance', response.data.newBalance.toString());
            }
        }

        // Відпускаємо блокування API
        _apiRequestInProgress = false;

        return response;
    } catch (error) {
        // Приховуємо індикатор завантаження у випадку помилки
        hideLoader();

        console.error("❌ Помилка скасування стейкінгу:", error);

        // Відпускаємо блокування API
        _apiRequestInProgress = false;

        throw error;
    }
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

    /**
 * Уніфіковане збереження даних користувача в localStorage
 * @param {Object} userData - Об'єкт з даними користувача
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність збереження
 */
function saveUserDataLocally(userData, options = {}) {
    try {
        if (!userData) {
            console.warn("❌ saveUserDataLocally: Отримано порожні дані");
            return false;
        }

        const storedData = {};
        const timestamp = Date.now();

        // Журналювання, якщо увімкнено режим відлагодження
        if (_debugMode) {
            console.log("💾 Збереження даних користувача в localStorage:", userData);
        }

        // Функція для безпечного збереження в localStorage
        const safeSetItem = (key, value) => {
            try {
                if (value !== undefined && value !== null) {
                    // Перетворення нечислових значень у рядки
                    const stringValue = typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value);

                    localStorage.setItem(key, stringValue);
                    storedData[key] = value;
                    return true;
                }
                return false;
            } catch (e) {
                console.warn(`❌ Помилка збереження "${key}" в localStorage:`, e);
                return false;
            }
        };

        // Збереження загальних даних користувача
        if (userData.telegram_id) {
            safeSetItem('telegram_user_id', userData.telegram_id);
            safeSetItem('userId', userData.telegram_id);
        }

        if (userData.username) {
            safeSetItem('username', userData.username);
        }

        // Збереження балансів
        if (userData.balance !== undefined) {
            safeSetItem('userTokens', userData.balance);
            safeSetItem('winix_balance', userData.balance);
        }

        if (userData.coins !== undefined) {
            safeSetItem('userCoins', userData.coins);
            safeSetItem('winix_coins', userData.coins);
        }

        // Збереження даних стейкінгу
        if (userData.staking) {
            safeSetItem('stakingData', userData.staking);
            safeSetItem('winix_staking', userData.staking);
            safeSetItem('stakingDataCacheTime', timestamp);
        }

        // Збереження історії транзакцій
        if (userData.transactions) {
            safeSetItem('transactionsData', userData.transactions);
            safeSetItem('transactionsDataCacheTime', timestamp);
        }

        // Збереження налаштувань
        if (userData.settings) {
            safeSetItem('userSettings', userData.settings);
        }

        // Збереження додаткових даних, якщо вони є
        if (userData.additionalData) {
            Object.keys(userData.additionalData).forEach(key => {
                safeSetItem(key, userData.additionalData[key]);
            });
        }

        // Збереження часової мітки оновлення
        safeSetItem('userDataTimestamp', timestamp);

        // Генеруємо подію про оновлення даних
        document.dispatchEvent(new CustomEvent('user-data-updated', {
            detail: {
                updatedFields: Object.keys(storedData),
                timestamp: timestamp
            }
        }));

        return true;
    } catch (error) {
        console.error("❌ Критична помилка збереження даних користувача:", error);
        return false;
    }
}

/**
 * Отримання всіх збережених даних користувача з localStorage
 * @returns {Object} Об'єкт з даними користувача
 */
function getUserDataFromStorage() {
    try {
        const userData = {
            telegram_id: localStorage.getItem('telegram_user_id') || localStorage.getItem('userId'),
            username: localStorage.getItem('username'),
            balance: parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0'),
            coins: parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0'),
            timestamp: parseInt(localStorage.getItem('userDataTimestamp') || '0')
        };

        // Спроба отримати дані стейкінгу
        try {
            const stakingData = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
            if (stakingData) {
                userData.staking = JSON.parse(stakingData);
            }
        } catch (e) {
            console.warn("❌ Помилка при отриманні даних стейкінгу з localStorage:", e);
        }

        // Спроба отримати історію транзакцій
        try {
            const transactionsData = localStorage.getItem('transactionsData');
            if (transactionsData) {
                userData.transactions = JSON.parse(transactionsData);
            }
        } catch (e) {
            console.warn("❌ Помилка при отриманні історії транзакцій з localStorage:", e);
        }

        return userData;
    } catch (error) {
        console.error("❌ Помилка при отриманні даних користувача з localStorage:", error);
        return {
            telegram_id: null,
            balance: 0,
            coins: 0,
            error: error.message
        };
    }
}
/**
 * Очищення всіх даних користувача з localStorage
 * @returns {boolean} Успішність очищення
 */
function clearUserDataStorage() {
    try {
        // Список ключів для очищення
        const keysToRemove = [
            'telegram_user_id', 'userId', 'username',
            'userTokens', 'winix_balance',
            'userCoins', 'winix_coins',
            'stakingData', 'winix_staking', 'stakingDataCacheTime',
            'transactionsData', 'transactionsDataCacheTime',
            'userDataTimestamp', 'userSettings'
        ];

        // Видаляємо всі ключі
        keysToRemove.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`Помилка при очищенні ${key}:`, e);
            }
        });

        console.log("🧹 Дані користувача успішно очищено з localStorage");
        return true;
    } catch (error) {
        console.error("❌ Помилка при очищенні даних користувача з localStorage:", error);
        return false;
    }
}
})();