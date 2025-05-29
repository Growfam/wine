/**
 * API модуль для системи завдань WINIX - ВИПРАВЛЕНА ВЕРСІЯ
 * Правильна передача JSON даних для wallet endpoints
 */
window.TasksAPI = (function() {
    'use strict';

    console.log('📦 [TasksAPI] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ TasksAPI ==========');
    console.log('🕐 [TasksAPI] Час завантаження:', new Date().toISOString());

    // Базова конфігурація API
    const API_CONFIG = {
        baseUrl: '',
        timeout: 15000,
        retryAttempts: 3,
        retryDelay: 1000
    };

    console.log('⚙️ [TasksAPI] Конфігурація:', API_CONFIG);

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

        // Спочатку спробуємо через WinixAPI
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            console.log('🔍 [TasksAPI] Спроба отримати ID через WinixAPI...');
            const apiId = window.WinixAPI.getUserId();
            console.log('📊 [TasksAPI] WinixAPI.getUserId результат:', apiId);

            if (apiId && apiId !== 'undefined' && apiId !== 'null') {
                console.log('✅ [TasksAPI] ID отримано через WinixAPI:', apiId);
                return apiId;
            }
        }

        const telegramId = localStorage.getItem('telegram_user_id');
        const userId = localStorage.getItem('user_id');

        console.log('📊 [TasksAPI] ID в localStorage:', {
            telegram_user_id: telegramId,
            user_id: userId
        });

        const result = telegramId || userId;
        console.log('👤 [TasksAPI] Результат getUserId:', result || 'ID відсутній');

        return result;
    }

    // Утилітарна функція для виконання HTTP запитів
    function apiRequest(url, options) {
        console.log('🌐 [TasksAPI] === apiRequest START ===');
        console.log('📊 [TasksAPI] URL:', url);
        console.log('📊 [TasksAPI] Options:', JSON.stringify(options, null, 2));

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
                        return response.text().then(function(text) {
                            console.error('📄 [TasksAPI] Response body:', text);

                            // Спробуємо парсити як JSON
                            try {
                                const errorData = JSON.parse(text);
                                const error = new Error(errorData.message || 'HTTP ' + response.status + ': ' + response.statusText);
                                error.status = response.status;
                                error.statusText = response.statusText;
                                error.data = errorData;
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

                    throw error;
                });
        }

        return executeRequest();
    }

    // API методи для User
    const user = {
        getProfile: function(userId) {
            console.log('👤 [TasksAPI] Отримання профілю:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/user/' + userId);
        },

        getBalance: function(userId) {
            console.log('💰 [TasksAPI] Отримання балансу:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/user/' + userId + '/balance');
        },

        updateBalance: function(userId, balances) {
            console.log('💰 [TasksAPI] Оновлення балансу:', userId, balances);
            if (!userId || !balances) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/user/' + userId + '/update-balance', {
                method: 'POST',
                body: JSON.stringify(balances)
            });
        }
    };

    // API методи для Wallet - ВИПРАВЛЕНО
    const wallet = {
        checkStatus: function(userId) {
            console.log('👛 [TasksAPI] Перевірка статусу гаманця:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/status/' + userId);
        },

        connect: function(userId, walletData) {
            console.log('🔌 [TasksAPI] Підключення гаманця:', userId);
            console.log('📊 [TasksAPI] Дані гаманця:', walletData);

            if (!userId || !walletData || !walletData.address) {
                console.error('❌ [TasksAPI] Невірні параметри підключення гаманця');
                return Promise.reject(new Error('Невірні параметри'));
            }

            // Формуємо правильну структуру даних
            const requestData = {
                address: walletData.address,
                chain: walletData.chain || '-239',
                publicKey: walletData.publicKey || '',
                provider: walletData.provider || '',
                timestamp: walletData.timestamp || Date.now()
            };

            console.log('📤 [TasksAPI] Дані для відправки:', requestData);

            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/connect/' + userId, {
                method: 'POST',
                body: JSON.stringify(requestData)
            });
        },

        disconnect: function(userId) {
            console.log('🔌 [TasksAPI] Відключення гаманця:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/wallet/disconnect/' + userId, {
                method: 'POST',
                body: JSON.stringify({})
            });
        }
    };

    // API методи для Flex
    const flex = {
        getBalance: function(userId, walletAddress) {
            console.log('💎 [TasksAPI] Отримання балансу FLEX:', userId);
            if (!userId || !walletAddress) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/flex/balance/' + userId + '?wallet=' + walletAddress);
        },

        claimReward: function(userId, level) {
            console.log('🎁 [TasksAPI] Отримання винагороди FLEX:', userId, level);
            if (!userId || !level) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/flex/claim/' + userId, {
                method: 'POST',
                body: JSON.stringify({ level: level, timestamp: Date.now() })
            });
        }
    };

    // API методи для Daily
    const daily = {
        getStatus: function(userId) {
            console.log('📅 [TasksAPI] Отримання статусу щоденного бонусу:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/daily/status/' + userId);
        },

        claim: function(userId) {
            console.log('🎁 [TasksAPI] Отримання щоденного бонусу:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/daily/claim/' + userId, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
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
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/list/' + userId + '?type=' + type);
        },

        start: function(userId, taskId) {
            console.log('▶️ [TasksAPI] Початок виконання завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/start/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
        },

        verify: function(userId, taskId, verificationData) {
            console.log('🔍 [TasksAPI] Верифікація завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/verify/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify(verificationData || {})
            });
        },

        complete: function(userId, taskId) {
            console.log('✅ [TasksAPI] Завершення завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/complete/' + userId + '/' + taskId, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
        },

        claim: function(userId, taskId) {
            console.log('💰 [TasksAPI] Отримання винагороди за завдання:', userId, taskId);
            if (!userId || !taskId) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/tasks/claim/' + userId + '/' + taskId, {
                method: 'POST'
            });
        }
    };

    // API методи для Verification
    const verify = {
        telegram: function(userId, channelUsername) {
            console.log('📱 [TasksAPI] Верифікація Telegram підписки:', userId);
            if (!userId || !channelUsername) {
                return Promise.reject(new Error('Невірні параметри'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/verify/telegram/' + userId, {
                method: 'POST',
                body: JSON.stringify({ channelUsername: channelUsername })
            });
        },

        checkBot: function(userId) {
            console.log('🤖 [TasksAPI] Перевірка запуску бота:', userId);
            if (!userId) {
                return Promise.reject(new Error('User ID не вказано'));
            }
            return apiRequest(API_CONFIG.baseUrl + '/api/verify/check-bot/' + userId);
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
                });
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
        }
    };

    console.log('✅ [TasksAPI] ========== МОДУЛЬ TasksAPI ЗАВАНТАЖЕНО УСПІШНО ==========');

    // Публічний API
    return {
        // Конфігурація
        config: API_CONFIG,

        // Утиліти
        apiRequest: apiRequest,
        getAuthToken: getAuthToken,
        getUserId: getUserId,

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

console.log('✅ [GLOBAL] window.TasksAPI зареєстровано глобально');