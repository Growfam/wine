/**
 * API модуль для системи завдань WINIX - ОПТИМІЗОВАНА ВЕРСІЯ
 * З Rate Limiting, кешуванням та черговою обробкою запитів
 */
window.TasksAPI = (function() {
    'use strict';

    console.log('📦 [TasksAPI] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ TasksAPI (ОПТИМІЗОВАНИЙ) ==========');
    console.log('🕐 [TasksAPI] Час завантаження:', new Date().toISOString());

    // Базова конфігурація API
    const API_CONFIG = {
        baseUrl: 'https://winixbot.com',
        timeout: 15000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimitDelay: 1000, // 1 секунда між запитами
        cacheTimeout: 60000 // 1 хвилина кеш
    };

    console.log('⚙️ [TasksAPI] Конфігурація:', API_CONFIG);

    // Кеш для запитів
    const requestCache = new Map();
    const cacheTimestamps = new Map();

    // Rate Limiter
    const rateLimiter = {
        queue: [],
        processing: false,
        lastRequestTime: 0,
        minDelay: API_CONFIG.rateLimitDelay,

        async add(fn, priority = 0) {
            return new Promise((resolve, reject) => {
                this.queue.push({ fn, resolve, reject, priority, timestamp: Date.now() });
                // Сортуємо по пріоритету
                this.queue.sort((a, b) => b.priority - a.priority);
                this.process();
            });
        },

        async process() {
            if (this.processing || this.queue.length === 0) return;

            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < this.minDelay) {
                const waitTime = this.minDelay - timeSinceLastRequest;
                setTimeout(() => this.process(), waitTime);
                return;
            }

            this.processing = true;
            const { fn, resolve, reject } = this.queue.shift();

            try {
                this.lastRequestTime = Date.now();
                const result = await fn();
                resolve(result);
            } catch (error) {
                // Якщо 429 помилка - збільшуємо затримку
                if (error.status === 429) {
                    console.warn('⚠️ [TasksAPI] Rate limit hit, збільшуємо затримку');
                    this.minDelay = Math.min(this.minDelay * 2, 10000); // Максимум 10 секунд

                    // Повертаємо запит в чергу з високим пріоритетом
                    this.queue.unshift({ fn, resolve, reject, priority: 10, timestamp: Date.now() });

                    setTimeout(() => {
                        this.minDelay = API_CONFIG.rateLimitDelay; // Скидаємо затримку
                    }, 60000); // Через хвилину
                } else {
                    reject(error);
                }
            } finally {
                this.processing = false;
                // Процесимо наступний запит
                setTimeout(() => this.process(), 100);
            }
        }
    };

    // Перевірка кешу
    function checkCache(cacheKey) {
        const cached = requestCache.get(cacheKey);
        const timestamp = cacheTimestamps.get(cacheKey);

        if (cached && timestamp && (Date.now() - timestamp < API_CONFIG.cacheTimeout)) {
            console.log('📦 [TasksAPI] Використовуємо кешовані дані для:', cacheKey);
            return cached;
        }

        return null;
    }

    // Збереження в кеш
    function saveToCache(cacheKey, data) {
        requestCache.set(cacheKey, data);
        cacheTimestamps.set(cacheKey, Date.now());

        // Очищаємо старий кеш
        if (requestCache.size > 100) {
            const oldestKey = requestCache.keys().next().value;
            requestCache.delete(oldestKey);
            cacheTimestamps.delete(oldestKey);
        }
    }

    // Перевірка наявності WinixAPI
    console.log('🔍 [TasksAPI] Перевірка наявності WinixAPI...');
    if (typeof window.WinixAPI !== 'undefined') {
        console.log('✅ [TasksAPI] WinixAPI знайдено:', Object.keys(window.WinixAPI));
    } else {
        console.log('⚠️ [TasksAPI] WinixAPI відсутній, буде використовуватися прямий API');
    }

    // Утилітарна функція для отримання токена авторизації
    function getAuthToken() {
        console.log('🔑 [TasksAPI] === getAuthToken START ===');

        const authToken = localStorage.getItem('auth_token');
        const jwtToken = localStorage.getItem('jwt_token');
        const token = localStorage.getItem('token');

        console.log('📊 [TasksAPI] Токени в localStorage:', {
            auth_token: authToken ? 'присутній' : 'відсутній',
            jwt_token: jwtToken ? 'присутній' : 'відсутній',
            token: token ? 'присутній' : 'відсутній'
        });

        const result = authToken || jwtToken || token;
        console.log('🔑 [TasksAPI] Результат getAuthToken:', result ? 'токен знайдено' : 'токен відсутній');

        return result;
    }

    // Утилітарна функція для отримання ID користувача
   function getUserId() {
    console.log('👤 [TasksAPI] === getUserId START ===');
    console.log('🕐 [TasksAPI] Час виклику:', new Date().toISOString());

    // Логуємо стан window об'єктів
    console.log('🪟 [TasksAPI] Window об\'єкти:', {
        hasWinixAPI: !!window.WinixAPI,
        hasWinixAPIGetUserId: !!(window.WinixAPI && typeof window.WinixAPI.getUserId === 'function'),
        hasTelegram: !!window.Telegram,
        hasTelegramWebApp: !!(window.Telegram && window.Telegram.WebApp),
        hasTelegramUser: !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user)
    });

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
        console.log('🔍 [TasksAPI] Спроба отримати ID через WinixAPI...');
        try {
            const apiId = window.WinixAPI.getUserId();
            console.log('📊 [TasksAPI] WinixAPI.getUserId результат:', {
                value: apiId,
                type: typeof apiId,
                isNull: apiId === null,
                isUndefined: apiId === undefined,
                stringValue: String(apiId),
                length: apiId ? String(apiId).length : 0
            });

            if (apiId && apiId !== 'undefined' && apiId !== 'null' && apiId !== null && apiId !== undefined) {
                console.log('✅ [TasksAPI] ID отримано через WinixAPI:', apiId);
                // Очищаємо ID від зайвих символів
                const cleanId = String(apiId).replace(/[^0-9]/g, '');
                console.log('🧹 [TasksAPI] Очищений ID від WinixAPI:', {
                    original: apiId,
                    cleaned: cleanId,
                    removedChars: String(apiId).replace(/[0-9]/g, '')
                });

                if (cleanId && cleanId.length > 0) {
                    console.log('✅ [TasksAPI] Повертаємо ID з WinixAPI:', cleanId);
                    return cleanId;
                } else {
                    console.warn('⚠️ [TasksAPI] Очищений ID з WinixAPI порожній');
                }
            } else {
                console.warn('⚠️ [TasksAPI] WinixAPI повернув невалідне значення:', apiId);
            }
        } catch (error) {
            console.error('❌ [TasksAPI] Помилка при виклику WinixAPI.getUserId:', error);
        }
    } else {
        console.log('⚠️ [TasksAPI] WinixAPI або getUserId недоступні');
    }

    // Перевіряємо localStorage
    console.log('📦 [TasksAPI] Перевіряємо localStorage...');
    const telegramId = localStorage.getItem('telegram_user_id');
    const userId = localStorage.getItem('user_id');
    const authToken = localStorage.getItem('auth_token');
    const jwtToken = localStorage.getItem('jwt_token');

    console.log('📊 [TasksAPI] Дані в localStorage:', {
        telegram_user_id: telegramId ? `${telegramId} (length: ${telegramId.length})` : 'null',
        user_id: userId ? `${userId} (length: ${userId.length})` : 'null',
        hasAuthToken: !!authToken,
        hasJwtToken: !!jwtToken,
        allKeys: Object.keys(localStorage).filter(key =>
            key.includes('user') ||
            key.includes('id') ||
            key.includes('telegram')
        )
    });

    // Спробуємо отримати з Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        console.log('📱 [TasksAPI] Перевіряємо Telegram WebApp...');
        const tgData = window.Telegram.WebApp.initDataUnsafe;
        console.log('📊 [TasksAPI] Telegram WebApp дані:', {
            hasUser: !!tgData.user,
            userId: tgData.user?.id,
            userIdType: typeof tgData.user?.id,
            username: tgData.user?.username,
            firstName: tgData.user?.first_name,
            authDate: tgData.auth_date,
            hash: tgData.hash ? 'present' : 'missing'
        });

        if (tgData.user && tgData.user.id) {
            const tgUserId = String(tgData.user.id);
            console.log('📱 [TasksAPI] ID з Telegram WebApp:', tgUserId);

            // Якщо немає в localStorage - зберігаємо
            if (!telegramId && !userId) {
                console.log('💾 [TasksAPI] Зберігаємо ID з Telegram в localStorage');
                localStorage.setItem('telegram_user_id', tgUserId);
                return tgUserId;
            }
        }
    } else {
        console.log('⚠️ [TasksAPI] Telegram WebApp недоступний');
    }

    // Визначаємо результат
    const result = telegramId || userId;

    console.log('🔍 [TasksAPI] Фінальна перевірка:', {
        telegramId: telegramId,
        userId: userId,
        selectedValue: result,
        source: telegramId ? 'telegram_user_id' : (userId ? 'user_id' : 'none')
    });

    if (result) {
        const originalLength = result.length;
        const cleanedResult = String(result).replace(/[^0-9]/g, '');
        const removedChars = String(result).replace(/[0-9]/g, '');

        console.log('🧹 [TasksAPI] Очищення результату:', {
            original: result,
            cleaned: cleanedResult,
            originalLength: originalLength,
            cleanedLength: cleanedResult.length,
            removedCharacters: removedChars || 'none'
        });

        if (cleanedResult && cleanedResult.length > 0) {
            console.log('✅ [TasksAPI] === getUserId SUCCESS ===');
            console.log('👤 [TasksAPI] Повертаємо ID:', cleanedResult);
            return cleanedResult;
        } else {
            console.error('❌ [TasksAPI] Очищений ID порожній!');
        }
    }

    // Додаткова діагностика якщо ID не знайдено
    console.group('🔍 [TasksAPI] Додаткова діагностика - ID не знайдено');
    console.log('LocalStorage всі ключі:', Object.keys(localStorage));
    console.log('SessionStorage всі ключі:', Object.keys(sessionStorage));
    console.log('Window.Telegram:', window.Telegram);
    console.log('Document cookies:', document.cookie || 'none');
    console.log('Window location:', {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash
    });
    console.groupEnd();

    console.error('❌ [TasksAPI] === getUserId FAILED - ID НЕ ЗНАЙДЕНО ===');
    return null;
}

    function saveUserId(id) {
    console.log('💾 [TasksAPI] Збереження User ID:', id);

    if (!id) {
        console.error('❌ [TasksAPI] Спроба зберегти порожній ID');
        return false;
    }

    const cleanId = String(id).replace(/[^0-9]/g, '');

    if (!cleanId) {
        console.error('❌ [TasksAPI] ID став порожнім після очищення:', id);
        return false;
    }

    try {
        localStorage.setItem('telegram_user_id', cleanId);
        localStorage.setItem('user_id', cleanId);
        console.log('✅ [TasksAPI] ID збережено успішно:', cleanId);
        return true;
    } catch (error) {
        console.error('❌ [TasksAPI] Помилка збереження ID:', error);
        return false;
    }
}

    // Утилітарна функція для виконання HTTP запитів з кешуванням
    function apiRequest(url, options, useCache = true, priority = 0) {
        console.log('🌐 [TasksAPI] === apiRequest START ===');
        console.log('📊 [TasksAPI] URL:', url);
        console.log('📊 [TasksAPI] Options:', JSON.stringify(options, null, 2));

        // Генеруємо ключ кешу
        const cacheKey = `${options?.method || 'GET'}_${url}_${JSON.stringify(options?.body || {})}`;

        // Перевіряємо кеш для GET запитів
        if (useCache && (!options?.method || options.method === 'GET')) {
            const cached = checkCache(cacheKey);
            if (cached) {
                return Promise.resolve(cached);
            }
        }

        // Додаємо запит в чергу rate limiter
        return rateLimiter.add(async () => {
            options = options || {};
            const controller = new AbortController();
            const timeoutId = setTimeout(function() {
                console.warn('⏱️ [TasksAPI] Таймаут запиту! Відміна...');
                controller.abort();
            }, API_CONFIG.timeout);

            // Отримуємо авторизаційний токен та ID користувача
            const token = getAuthToken();
            const userId = getUserId();

            // Встановлюємо базові заголовки
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            };

            console.log('📊 [TasksAPI] Базові заголовки встановлено');

            // Додаємо заголовок авторизації, якщо токен доступний
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
                console.log('🔑 [TasksAPI] Додано заголовок авторизації');
            } else {
                console.warn('⚠️ [TasksAPI] Токен авторизації відсутній');
            }

            // Додаємо Telegram User ID заголовок, якщо ID доступний
            if (userId) {
                headers['X-Telegram-User-Id'] = userId;
                console.log('👤 [TasksAPI] Додано заголовок X-Telegram-User-Id:', userId);
            } else {
                console.warn('⚠️ [TasksAPI] User ID відсутній');
            }

            // Об'єднуємо заголовки з опціями запиту
            const fetchOptions = Object.assign({
                signal: controller.signal,
                headers: headers
            }, options);

            console.log('🌐 [TasksAPI REQUEST] Фінальні параметри:', {
                url: url,
                method: fetchOptions.method || 'GET',
                hasAuth: !!token,
                userId: userId,
                headers: fetchOptions.headers,
                hasBody: !!fetchOptions.body
            });

            // Логуємо body якщо є
            if (fetchOptions.body) {
                try {
                    console.log('📤 [TasksAPI] Request Body:', JSON.parse(fetchOptions.body));
                } catch (e) {
                    console.log('📤 [TasksAPI] Request Body (raw):', fetchOptions.body);
                }
            }

            let retryCount = 0;

            function executeRequest() {
                console.log(`🔄 [TasksAPI] Виконання запиту (спроба ${retryCount + 1}/${API_CONFIG.retryAttempts})...`);

                // Додаємо параметр timestamp для запобігання кешування
                const urlWithTimestamp = url.includes('?')
                    ? url + '&t=' + Date.now()
                    : url + '?t=' + Date.now();

                console.log('🌐 [TasksAPI] Фінальний URL з timestamp:', urlWithTimestamp);
                console.log('🕐 [TasksAPI] Час запиту:', new Date().toISOString());

                return fetch(urlWithTimestamp, fetchOptions)
                    .then(function(response) {
                        clearTimeout(timeoutId);
                        console.log('📥 [TasksAPI] Відповідь отримано!');
                        console.log('📊 [TasksAPI] Response details:', {
                            status: response.status,
                            statusText: response.statusText,
                            ok: response.ok,
                            headers: response.headers
                        });

                        // Перевіряємо відповідь
                        if (!response.ok) {
                            console.error('❌ [TasksAPI] HTTP помилка:', {
                                status: response.status,
                                statusText: response.statusText
                            });

                            // Спробуємо отримати деталі помилки з відповіді
                            return response.text().then(function (text) {
                                console.error('📄 [TasksAPI] Response body:', text);

                                // Спробуємо парсити як JSON
                                try {
                                    const errorData = JSON.parse(text);
                                    const error = new Error(errorData.message || 'HTTP ' + response.status + ': ' + response.statusText);
                                    error.status = response.status;
                                    error.statusText = response.statusText;
                                    error.data = errorData;
                                    error.code = errorData.code;
                                    throw error;
                                } catch (e) {
                                    // Якщо не JSON, повертаємо як є
                                    const error = new Error('HTTP ' + response.status + ': ' + response.statusText);
                                    error.status = response.status;
                                    error.statusText = response.statusText;
                                    error.responseText = text;
                                    throw error;
                                }
                            });
                        }

                        // Спробуємо парсити JSON відповідь
                        console.log('📄 [TasksAPI] Парсинг JSON відповіді...');
                        return response.json().catch(function(err) {
                            console.error('❌ [TasksAPI] Неможливо парсити відповідь як JSON:', err);
                            throw new Error('Некоректна JSON відповідь від сервера');
                        });
                    })
                    .then(function(data) {
                        console.log('✅ [TasksAPI] JSON успішно отримано');
                        console.log('📊 [TasksAPI] Дані відповіді:', JSON.stringify(data, null, 2));

                        // Зберігаємо в кеш для GET запитів
                        if (useCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
                            saveToCache(cacheKey, data);
                        }

                        return data;
                    })
                    .catch(function(error) {
                        clearTimeout(timeoutId);
                        console.error('❌ [TasksAPI] Помилка запиту:', error);

                        // Обробляємо різні типи помилок
                        if (error.name === 'AbortError') {
                            console.error('⏱️ [TasksAPI] Запит скасовано через таймаут');
                            throw new Error('Запит перевищив час очікування (' + API_CONFIG.timeout + 'мс)');
                        }

                        // Якщо це 429 помилка - не робимо retry тут, rateLimiter обробить
                        if (error.status === 429) {
                            throw error;
                        }

                        // Для інших помилок - retry
                        if (retryCount < API_CONFIG.retryAttempts - 1 && error.status >= 500) {
                            retryCount++;
                            console.log(`🔄 [TasksAPI] Повторна спроба через ${API_CONFIG.retryDelay}мс...`);
                            return new Promise(resolve => {
                                setTimeout(() => resolve(executeRequest()), API_CONFIG.retryDelay);
                            });
                        }

                        throw error;
                    });
            }

            return executeRequest();
        }, priority);
    }

    // Функція трансформації балансу з backend формату в frontend формат
    function transformBalance(data) {
    console.log('🔄 [TasksAPI] Трансформація балансу:', data);

    // Якщо вже у правильному форматі
    if (data && data.winix !== undefined && data.tickets !== undefined) {
        return {
            winix: parseInt(data.winix) || 0,
            tickets: parseInt(data.tickets) || 0
        };
    }

    // Трансформуємо balance/coins в winix/tickets
    if (data && (data.balance !== undefined || data.coins !== undefined)) {
        return {
            winix: parseInt(data.balance || data.winix || 0),
            tickets: parseInt(data.coins || data.tickets || 0)
        };
    }

    // Якщо data це число (старий формат)
    if (typeof data === 'number') {
        return {
            winix: parseInt(data) || 0,
            tickets: 0
        };
    }

    // Якщо є поля з іншими назвами
    if (data && typeof data === 'object') {
        return {
            winix: parseInt(data.balance || data.winix || data.amount || 0),
            tickets: parseInt(data.coins || data.tickets || data.ticket || 0)
        };
    }

    // Повертаємо дефолтні значення
    return {
        winix: 0,
        tickets: 0
    };
}
    // API методи для User
    const user = {
    getProfile: function(userId) {
        console.log('👤 [TasksAPI] Отримання профілю:', userId);
        if (!userId) {
            return Promise.reject(new Error('User ID не вказано'));
        }
        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        return apiRequest(API_CONFIG.baseUrl + '/api/user/' + cleanUserId, null, true, 5)
            .then(function(response) {
                console.log('👤 [TasksAPI] Профіль отримано (raw):', response);

                // Трансформуємо дані балансу
                if (response && response.data) {
                    // Трансформуємо баланс у форматі data
                    response.data.transformedBalance = transformBalance(response.data);

                    // Зберігаємо також у кореневому об'єкті для сумісності
                    response.balance = response.data.transformedBalance;

                    console.log('👤 [TasksAPI] Профіль після трансформації:', response);
                }

                return response;
            });
    },

    getBalance: function(userId) {
        console.log('💰 [TasksAPI] Отримання балансу:', userId);
        if (!userId) {
            return Promise.reject(new Error('User ID не вказано'));
        }
        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        return apiRequest(API_CONFIG.baseUrl + '/api/user/' + cleanUserId + '/balance', null, true, 3)
            .then(function(response) {
                console.log('💰 [TasksAPI] Баланс отримано (raw):', response);

                // Трансформуємо відповідь
                if (response) {
                    // Шукаємо дані балансу в різних місцях
                    let balanceData = response.data || response;

                    // Трансформуємо баланс
                    const transformedBalance = transformBalance(balanceData);

                    // Додаємо трансформований баланс у різні місця для сумісності
                    response.balance = transformedBalance;

                    if (!response.data) {
                        response.data = {};
                    }
                    response.data.balance = transformedBalance;

                    console.log('💰 [TasksAPI] Баланс після трансформації:', response);
                }

                return response;
            });
    },

    updateBalance: function(userId, balances) {
        console.log('💰 [TasksAPI] Оновлення балансу:', userId, balances);
        if (!userId || !balances) {
            return Promise.reject(new Error('Невірні параметри'));
        }

        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');

        // Трансформуємо назад для backend якщо потрібно
        const backendData = {
            balance: balances.winix || balances.balance || 0,
            coins: balances.tickets || balances.coins || 0
        };

        return apiRequest(API_CONFIG.baseUrl + '/api/user/' + cleanUserId + '/update-balance', {
            method: 'POST',
            body: JSON.stringify(backendData)
        }, false, 10); // Високий пріоритет, без кешу
    }
};

    // API методи для Wallet - ВИПРАВЛЕНО з підтримкою raw та user-friendly адрес
    const wallet = {
        checkStatus: function(userId) {
            console.log('👛 [TasksAPI] Перевірка статусу гаманця:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/status/' + userId, null, true, 2);
        },

        connect: function(userId, walletData) {
            console.log('🔌 [TasksAPI] === ПІДКЛЮЧЕННЯ ГАМАНЦЯ ===');
            console.log('📊 [TasksAPI] userId:', userId);
            console.log('📊 [TasksAPI] Дані гаманця:', walletData);

            if (!userId || !walletData) {
                console.error('❌ [TasksAPI] Невірні параметри підключення гаманця');
                return Promise.reject(new Error('Невірні параметри'));
            }

            // Перевіряємо наявність адреси
            if (!walletData.address) {
                console.error('❌ [TasksAPI] Адреса гаманця відсутня');
                return Promise.reject(new Error('Адреса гаманця обов\'язкова'));
            }

            // Формуємо правильну структуру даних з обома адресами
            const requestData = {
                address: walletData.address,               // Raw адреса (обов'язкова)
                addressFriendly: walletData.addressFriendly || walletData.address,  // User-friendly адреса
                chain: walletData.chain || '-239',
                publicKey: walletData.publicKey || '',
                provider: walletData.provider || '',
                timestamp: walletData.timestamp || Date.now()
            };

            // Додаткова інформація про адреси для дебагу
            console.log('📍 [TasksAPI] Адреси для відправки:', {
                raw: requestData.address,
                userFriendly: requestData.addressFriendly,
                areEqual: requestData.address === requestData.addressFriendly,
                rawFormat: requestData.address.startsWith('0:') || requestData.address.startsWith('-1:'),
                friendlyFormat: requestData.addressFriendly.startsWith('UQ') || requestData.addressFriendly.startsWith('EQ')
            });

            console.log('📤 [TasksAPI] Фінальні дані для відправки:', requestData);

            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/connect/' + userId, {
                method: 'POST',
                body: JSON.stringify(requestData)
            }, false, 10); // Високий пріоритет, без кешу
        },

        disconnect: function(userId) {
            console.log('🔌 [TasksAPI] Відключення гаманця:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/disconnect/' + userId, {
                method: 'POST',
                body: JSON.stringify({})
            }, false, 10);
        },

        verify: function(userId, verificationData) {
            console.log('🔍 [TasksAPI] Верифікація гаманця:', userId);
            if (!userId || !verificationData) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/verify/' + userId, {
                method: 'POST',
                body: JSON.stringify(verificationData)
            }, false, 5);
        },

        getBalance: function(userId) {
            console.log('💰 [TasksAPI] Отримання балансу гаманця:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/balance/' + userId, null, true, 2);
        },

        getTransactions: function(userId, limit, beforeLt) {
            console.log('📋 [TasksAPI] Отримання транзакцій гаманця:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }

            let url = API_CONFIG.baseUrl + '/api/wallet/transactions/' + userId;
            const params = [];

            if (limit) {
                params.push('limit=' + limit);
            }
            if (beforeLt) {
                params.push('before_lt=' + beforeLt);
            }

            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            return apiRequest(url, null, true, 1);
        }
    };

    // API методи для Flex
    const flex = {
        getBalance: function(userId, walletAddress) {
            console.log('💎 [TasksAPI] === ОТРИМАННЯ БАЛАНСУ FLEX ===');
            console.log('📊 [TasksAPI] userId:', userId);
            console.log('📊 [TasksAPI] walletAddress:', walletAddress);

            if (!userId) {
                console.error('❌ [TasksAPI] User ID не вказано');
                return Promise.reject(new Error('User ID не вказано'));
            }

            if (!walletAddress) {
                console.error('❌ [TasksAPI] Адреса гаманця не вказана');
                return Promise.reject(new Error('Адреса гаманця не вказана'));
            }

            // Перевіряємо формат адреси
            const isRawAddress = walletAddress.startsWith('0:') || walletAddress.startsWith('-1:');
            const isUserFriendly = walletAddress.startsWith('UQ') || walletAddress.startsWith('EQ');

            console.log('📍 [TasksAPI] Формат адреси:', {
                address: walletAddress,
                isRaw: isRawAddress,
                isUserFriendly: isUserFriendly,
                length: walletAddress.length
            });

            // Кодуємо адресу для URL
            const encodedAddress = encodeURIComponent(walletAddress);
            const url = API_CONFIG.baseUrl + '/api/flex/balance/' + userId + '?wallet=' + encodedAddress;

            console.log('🌐 [TasksAPI] URL для запиту балансу:', url);

            return apiRequest(url, null, true, 3); // З кешем
        },

        claimReward: function(userId, level) {
            console.log('🎁 [TasksAPI] Отримання винагороди FLEX:', userId, level);
            if (!userId || !level) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/flex/claim/' + userId, {
                method: 'POST',
                body: JSON.stringify({
                    level: level,
                    timestamp: Date.now()
                })
            }, false, 10); // Високий пріоритет, без кешу
        },

        getLevels: function() {
            console.log('📊 [TasksAPI] Отримання рівнів FLEX');
            return apiRequest(API_CONFIG.baseUrl + '/api/flex/levels', null, true, 1);
        },

        checkLevels: function(userId, flexBalance) {
            console.log('🔍 [TasksAPI] Перевірка доступних рівнів');
            return apiRequest(API_CONFIG.baseUrl + '/api/flex/check-levels/' + userId + '?balance=' + flexBalance, null, true, 2);
        }
    };

    // API методи для Daily
   const daily = {
    getStatus: function(userId) {
        console.log('📅 [TasksAPI] Отримання статусу щоденного бонусу:', userId);
        if (!userId) {
            return Promise.reject(new Error('User ID не вказано'));
        }
        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        return apiRequest(API_CONFIG.baseUrl + '/api/daily/status/' + cleanUserId, null, true, 3);
    },

    claim: function(userId) {
        console.log('🎁 [TasksAPI] Отримання щоденного бонусу:', userId);
        if (!userId) {
            return Promise.reject(new Error('User ID не вказано'));
        }
        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        return apiRequest(API_CONFIG.baseUrl + '/api/daily/claim/' + cleanUserId, {
            method: 'POST',
            body: JSON.stringify({ timestamp: Date.now() })
        }, false, 10); // Високий пріоритет, без кешу
    },

    getHistory: function(userId, limit) {
        console.log('📜 [TasksAPI] Отримання історії щоденних бонусів:', userId);
        if (!userId) {
            return Promise.reject(new Error('User ID не вказано'));
        }

        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        let url = API_CONFIG.baseUrl + '/api/daily/history/' + cleanUserId;
        if (limit) {
            url += '?limit=' + limit;
        }

        return apiRequest(url, null, true, 1);
    },

    refresh: function(userId) {
        console.log('🔄 [TasksAPI] Примусове оновлення статусу щоденного бонусу:', userId);
        if (!userId) {
            return Promise.reject(new Error('User ID не вказано'));
        }
        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        return apiRequest(API_CONFIG.baseUrl + '/api/daily/refresh/' + cleanUserId, {
            method: 'POST',
            body: JSON.stringify({ timestamp: Date.now() })
        }, false, 5);
    },

    calculateReward: function(userId, day) {
        console.log('💰 [TasksAPI] Розрахунок винагороди для дня:', day);
        if (!userId || !day) {
            return Promise.reject(new Error('Невірні параметри'));
        }
        // Очищаємо userId від зайвих символів
        const cleanUserId = String(userId).replace(/[^0-9]/g, '');
        return apiRequest(API_CONFIG.baseUrl + '/api/daily/calculate-reward/' + cleanUserId + '?day=' + day, null, true, 1);
    }
};

    // API методи для Tasks
    const tasks = {
        getList: function(userId, type) {
            console.log('📋 [TasksAPI] Отримання списку завдань:', userId, type);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            type = type || 'all';
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/list/' + userId + '?type=' + type, null, true, 2);
        },

        start: function(userId, taskId) {
            console.log('▶️ [TasksAPI] Початок виконання завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/start/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            }, false, 5);
        },

        verify: function(userId, taskId, verificationData) {
            console.log('🔍 [TasksAPI] Верифікація завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/verify/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify(verificationData || {})
            }, false, 8);
        },

        complete: function(userId, taskId) {
            console.log('✅ [TasksAPI] Завершення завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/complete/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            }, false, 8);
        },

        claim: function(userId, taskId) {
            console.log('💰 [TasksAPI] Отримання винагороди за завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/claim/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            }, false, 10);
        },

        getProgress: function(userId) {
            console.log('📈 [TasksAPI] Отримання прогресу завдань:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/progress/' + userId, null, true, 1);
        }
    };

    // API методи для Verification
    const verify = {
        telegram: function(userId, channelUsername) {
            console.log('📱 [TasksAPI] Верифікація Telegram підписки:', userId, channelUsername);
            if (!userId || !channelUsername) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/verify/telegram/' + userId, {
                method: 'POST',
                body: JSON.stringify({
                    channelUsername: channelUsername,
                    timestamp: Date.now()
                })
            }, false, 8);
        },

        checkBot: function(userId) {
            console.log('🤖 [TasksAPI] Перевірка запуску бота:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/verify/check-bot/' + userId, null, true, 2);
        }
    };

    // Функція для авторизації (спрощена)
    const auth = {
        validateTelegram: function(telegramData) {
            console.log('🔐 [TasksAPI] Валідація Telegram даних');

            // Якщо є Telegram WebApp - використовуємо його дані
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
                const initData = window.Telegram.WebApp.initData;
                const userId = getUserId();

                return apiRequest(API_CONFIG.baseUrl + '/api/auth/telegram', {
                    method: 'POST',
                    body: JSON.stringify({
                        initData: initData,
                        telegram_id: userId,
                        timestamp: Date.now()
                    })
                }, false, 10); // Високий пріоритет, без кешу
            }

            // Інакше просто повертаємо успіх з userId
            const userId = getUserId();
            if (userId) {
                return Promise.resolve({
                    valid: true,
                    user: { id: userId, telegram_id: userId }
                });
            }

            return Promise.reject(new Error('Не вдалося отримати дані користувача'));
        },

        refreshToken: function() {
            console.log('🔄 [TasksAPI] Оновлення токену');
            return apiRequest(API_CONFIG.baseUrl + '/api/auth/refresh-token', {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            }, false, 10);
        }
    };

    // Функція очищення кешу
    function clearCache() {
        console.log('🧹 [TasksAPI] Очищення кешу');
        requestCache.clear();
        cacheTimestamps.clear();
    }

    // Функція отримання статистики
    function getStats() {
        return {
            cacheSize: requestCache.size,
            queueLength: rateLimiter.queue.length,
            currentDelay: rateLimiter.minDelay,
            isProcessing: rateLimiter.processing
        };
    }

    console.log('✅ [TasksAPI] ========== МОДУЛЬ TasksAPI ЗАВАНТАЖЕНО УСПІШНО (ОПТИМІЗОВАНИЙ) ==========');

    // Публічний API
    return {
        // Конфігурація
        config: API_CONFIG,

        // Утиліти
        apiRequest: apiRequest,
        getAuthToken: getAuthToken,
        getUserId: getUserId,
        saveUserId: saveUserId,
        transformBalance: transformBalance,
        clearCache: clearCache,
        getStats: getStats,

        // API методи
        auth: auth,
        user: user,
        wallet: wallet,
        flex: flex,
        daily: daily,
        tasks: tasks,
        verify: verify
    };
})();

console.log('✅ [GLOBAL] window.TasksAPI зареєстровано глобально (ОПТИМІЗОВАНИЙ)');