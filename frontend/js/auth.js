/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * Вдосконалена версія з покращеним управлінням запитами та синхронізацією з іншими модулями
 */

(function() {
    console.log("🔐 AUTH: Ініціалізація системи авторизації");

    // Флаги для контролю запитів
    let _authRequestInProgress = false;
    let _userDataRequestInProgress = false;
    let _lastRequestTime = 0;

    // ЗМІНЕНО: Збільшено мінімальний інтервал між запитами для зменшення навантаження
    const MIN_REQUEST_INTERVAL = 5000; // Мінімальний інтервал між запитами (5 секунд)

    // ДОДАНО: Підтримка подій
    const EVENT_USER_DATA_UPDATED = 'user-data-updated';
    const EVENT_AUTH_SUCCESS = 'auth-success';
    const EVENT_AUTH_ERROR = 'auth-error';

    // ДОДАНО: Кешування даних користувача
    let _userDataCache = null;
    let _userDataCacheTime = 0;
    const USER_DATA_CACHE_TTL = 120000; // 2 хвилини

    // Ініціалізуємо Telegram WebApp якомога раніше
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log("🔐 AUTH: Telegram WebApp ініціалізовано ранній старт");
    }

    // Глобальний об'єкт для зберігання даних користувача
    window.WinixAuth = {
        // Дані поточного користувача
        currentUser: null,

        // Прапорці стану
        isInitialized: false,
        isAuthorizing: false,

        // Мови інтерфейсу
        lang: {
            uk: {
                authError: "Помилка авторизації. Спробуйте перезапустити додаток.",
                dataError: "Помилка отримання даних користувача.",
                welcome: "Вітаємо у WINIX!"
            },
            ru: {
                authError: "Ошибка авторизации. Попробуйте перезапустить приложение.",
                dataError: "Ошибка получения данных пользователя.",
                welcome: "Добро пожаловать в WINIX!"
            },
            en: {
                authError: "Authorization error. Try restarting the app.",
                dataError: "Error retrieving user data.",
                welcome: "Welcome to WINIX!"
            }
        },

        /**
         * Перевірка валідності ID
         */
        isValidId: function(id) {
            return id &&
                   id !== 'undefined' &&
                   id !== 'null' &&
                   id !== undefined &&
                   id !== null &&
                   id.toString().trim() !== '' &&
                   !id.toString().includes('function') &&
                   !id.toString().includes('=>');
        },

        /**
         * Ініціалізація системи авторизації
         */
        init: function() {
            console.log("🔐 AUTH: Запуск ініціалізації");

            // Запобігання частим викликам init
            const now = Date.now();
            if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
                console.log("🔐 AUTH: Занадто частий виклик init, ігноруємо");
                return Promise.reject(new Error("Занадто частий виклик init"));
            }
            _lastRequestTime = now;

            // Ініціалізуємо Telegram WebApp якомога раніше
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
                console.log("🔐 AUTH: Telegram WebApp ініціалізовано");
            }

            // Видаляємо жорстко закодований ID з localStorage, якщо він там є
            if (localStorage.getItem('telegram_user_id') === '12345678') {
                console.warn("⚠️ AUTH: Видалення захардкодженого ID з localStorage");
                localStorage.removeItem('telegram_user_id');
            }

            if (this.isInitialized) {
                console.log("🔐 AUTH: Систему вже ініціалізовано");
                return Promise.resolve(this.currentUser);
            }

            this.isInitialized = true;

            // Перевіряємо, чи є Telegram WebApp
            if (!window.Telegram || !window.Telegram.WebApp) {
                console.error("❌ AUTH: Telegram WebApp не знайдено");
                return Promise.reject(new Error("Telegram WebApp not available"));
            }

            // ЗМІНЕНО: Спочатку перевіряємо наявність кешу, а потім викликаємо функції
            if (this.currentUser) {
                console.log("📋 AUTH: Використання кешованих даних користувача");
                return Promise.resolve(this.currentUser);
            }

            // Спочатку викликаємо getUserData для отримання ID з Telegram
            return this.getUserData()
                .then(userData => {
                    console.log("✅ AUTH: Отримано дані користувача через getUserData:", userData);
                    return userData;
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка під час getUserData, спробуємо authorizeUser:", error);

                    // Якщо getUserData не спрацював, використовуємо authorizeUser як резервний варіант
                    const tg = window.Telegram.WebApp;
                    let authData = {};

                    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                        authData = {
                            ...tg.initDataUnsafe.user,
                            initData: tg.initData || ""
                        };
                    } else {
                        authData = {
                            initData: tg.initData || ""
                        };
                    }

                    return this.authorizeUser(authData);
                });
        },

        /**
         * Авторизація користувача на сервері
         */
        authorizeUser: function(userData) {
            // Запобігання паралельним запитам
            if (_authRequestInProgress) {
                console.log("🔐 AUTH: Авторизація вже виконується");
                return Promise.reject(new Error("Authorization already in progress"));
            }

            _authRequestInProgress = true;

            try {
                // Перевіряємо чи доступний Telegram WebApp і оновлюємо дані
                if (window.Telegram && window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user) {

                    // Оновлюємо ID користувача з Telegram WebApp
                    const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id;
                    if (telegramId) {
                        // Замість модифікації параметра, створюємо нову змінну
                        userData = {
                            ...userData,
                            id: telegramId.toString(),
                            telegram_id: telegramId.toString()
                        };
                        console.log("🔐 AUTH: ID оновлено з Telegram WebApp:", userData.id);
                    }
                }

                // Валідуємо ID перед надсиланням запиту
                let userId = userData.id || userData.telegram_id || null;

                if (!this.isValidId(userId)) {
                    console.error("❌ AUTH: Неможливо отримати валідний ID користувача для авторизації");
                    _authRequestInProgress = false;
                    return Promise.reject(new Error("Неможливо отримати валідний ID користувача"));
                }

                // Використовуємо let замість const для userId
                userId = userId.toString();

                // Зберігаємо в localStorage для подальшого використання
                localStorage.setItem('telegram_user_id', userId);

                // Одразу оновлюємо елемент на сторінці, якщо він існує
                const userIdElement = document.getElementById('user-id');
                if (userIdElement) {
                    userIdElement.textContent = userId;
                    console.log(`🔐 AUTH: Оновлено ID користувача на сторінці: ${userId}`);
                }

                // Показуємо індикатор завантаження, якщо він є
                const spinner = document.getElementById('loading-spinner');
                if (spinner) spinner.classList.add('show');

                // Перевіряємо наявність API модуля
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    console.error("❌ AUTH: API модуль недоступний");
                    if (spinner) spinner.classList.remove('show');
                    _authRequestInProgress = false;
                    return Promise.reject(new Error("API модуль недоступний"));
                }

                // ЗМІНЕНО: Перевіряємо наявність кешу перед виконанням запиту
                if (this.currentUser && this.currentUser.telegram_id === userId) {
                    console.log("📋 AUTH: Використовуємо кешовані дані під час авторизації");
                    if (spinner) spinner.classList.remove('show');
                    _authRequestInProgress = false;
                    return Promise.resolve(this.currentUser);
                }

                // Створюємо проміс для імітації запиту, якщо не працює API
                const authPromise = window.WinixAPI.apiRequest ?
                    window.WinixAPI.apiRequest(`/api/auth`, 'POST', userData, {
                        timeout: 8000, // Збільшуємо таймаут для авторизації
                        suppressErrors: true // Для обробки помилок на нашому рівні
                    }) :
                    Promise.resolve({
                        status: 'success',
                        data: {
                            telegram_id: userId,
                            username: userData.username || "WINIX User",
                            balance: 100,
                            coins: 5
                        }
                    });

                return authPromise
                    .then(data => {
                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        if (data.status === 'success') {
                            this.currentUser = data.data;
                            console.log("✅ AUTH: Користувача успішно авторизовано", this.currentUser);

                            // Перевіряємо валідність ID перед збереженням
                            if (this.isValidId(this.currentUser.telegram_id)) {
                                localStorage.setItem('telegram_user_id', this.currentUser.telegram_id);

                                // Оновлюємо елемент на сторінці
                                const userIdElement = document.getElementById('user-id');
                                if (userIdElement) {
                                    userIdElement.textContent = this.currentUser.telegram_id;
                                }
                            } else {
                                console.warn("⚠️ AUTH: API повернув невалідний ID користувача:", this.currentUser.telegram_id);
                            }

                            // Зберігаємо баланс і жетони в localStorage
                            if (this.currentUser.balance !== undefined) {
                                localStorage.setItem('userTokens', this.currentUser.balance.toString());
                                localStorage.setItem('winix_balance', this.currentUser.balance.toString());
                            }

                            if (this.currentUser.coins !== undefined) {
                                localStorage.setItem('userCoins', this.currentUser.coins.toString());
                                localStorage.setItem('winix_coins', this.currentUser.coins.toString());
                            }

                            // Оновлюємо кеш
                            _userDataCache = this.currentUser;
                            _userDataCacheTime = Date.now();

                            // Показуємо вітальне повідомлення для нових користувачів
                            if (data.data.is_new_user) {
                                this.showWelcomeMessage();
                            }

                            // Відправляємо подію про успішну авторизацію
                            document.dispatchEvent(new CustomEvent(EVENT_AUTH_SUCCESS, {
                                detail: this.currentUser
                            }));

                            // Також відправляємо подію оновлення даних для синхронізації з іншими модулями
                            document.dispatchEvent(new CustomEvent(EVENT_USER_DATA_UPDATED, {
                                detail: this.currentUser
                            }));

                            return this.currentUser;
                        } else {
                            console.error("❌ AUTH: Помилка авторизації", data);
                            throw new Error(data.message || "Помилка авторизації");
                        }
                    })
                    .catch(error => {
                        console.error("❌ AUTH: Помилка авторизації", error);

                        // Додаткова діагностична інформація
                        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                            console.error("❌ AUTH: Проблема мережевого з'єднання - сервер недоступний");
                        } else if (error.status || error.statusText) {
                            console.error(`❌ AUTH: HTTP помилка (${error.status}): ${error.statusText}`);
                        } else if (typeof error.message === 'string') {
                            console.error(`❌ AUTH: Деталі помилки: ${error.message}`);
                        }

                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        // Показуємо повідомлення про помилку
                        let errorMessage = this.getLocalizedText('authError');
                        if (error.status === 404) {
                            errorMessage += ' API не знайдено.';
                        } else if (error.status === 500) {
                            errorMessage += ' Помилка на сервері.';
                        }
                        this.showError(errorMessage);

                        // Відправляємо подію про помилку авторизації
                        document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                            detail: error
                        }));

                        throw error;
                    })
                    .finally(() => {
                        _authRequestInProgress = false;
                    });
            } catch (e) {
                _authRequestInProgress = false;
                console.error("❌ AUTH: Неочікувана помилка в authorizeUser:", e);
                return Promise.reject(e);
            }
        },

        /**
         * Отримання даних користувача з сервера
         * @param {boolean} forceRefresh - Примусове оновлення даних
         */
        getUserData: function(forceRefresh = false) {
            // ЗМІНЕНО: Додано перевірку на наявність кешу перед виконанням запиту
            const now = Date.now();

            // Якщо є кеш і він не застарів, і не потрібне примусове оновлення
            if (!forceRefresh && this.currentUser &&
                _userDataCacheTime > 0 &&
                (now - _userDataCacheTime) < USER_DATA_CACHE_TTL) {
                console.log("📋 AUTH: Використання кешованих даних користувача");
                return Promise.resolve(this.currentUser);
            }

            // Запобігання паралельним запитам
            if (_userDataRequestInProgress) {
                console.log("🔐 AUTH: Запит даних користувача вже виконується");

                // Якщо є кешовані дані, повертаємо їх
                if (this.currentUser) {
                    return Promise.resolve(this.currentUser);
                }

                return Promise.reject(new Error("Запит даних користувача вже виконується"));
            }

            // Запобігання частим запитам
            const timeSinceLastRequest = now - _lastRequestTime;
            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
                console.log(`🔐 AUTH: Занадто частий запит даних користувача, залишилось ${Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest)/1000)}с`);

                // Якщо є кешовані дані, повертаємо їх
                if (this.currentUser) {
                    return Promise.resolve(this.currentUser);
                }

                return Promise.reject({
                    message: "Занадто частий запит даних користувача",
                    retryAfter: MIN_REQUEST_INTERVAL - timeSinceLastRequest
                });
            }

            _lastRequestTime = now;
            _userDataRequestInProgress = true;

            try {
                let userId = null;
                let telegramId = null;

                // Намагаємось отримати ID напряму з Telegram WebApp - найбільш надійне джерело
                if (window.Telegram && window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user) {

                    const telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
                    if (telegramUser.id) {
                        telegramId = telegramUser.id.toString();
                        console.log(`🔐 AUTH: Отримано ID користувача з Telegram WebApp: ${telegramId}`);

                        // Якщо об'єкт currentUser ще не існує, створюємо його
                        if (!this.currentUser) {
                            this.currentUser = { telegram_id: telegramId };
                        } else {
                            // Використання безпечної зміни об'єкта
                            this.currentUser = {
                                ...this.currentUser,
                                telegram_id: telegramId
                            };
                        }

                        // Зберігаємо надійний ID в localStorage
                        localStorage.setItem('telegram_user_id', telegramId);

                        // Оновлюємо елемент на сторінці
                        const userIdElement = document.getElementById('user-id');
                        if (userIdElement) {
                            userIdElement.textContent = telegramId;
                        }

                        userId = telegramId;
                    }
                }

                // Якщо не змогли отримати ID з Telegram, перевіряємо інші джерела
                if (!this.isValidId(userId)) {
                    console.log("ℹ️ AUTH: Спроба отримати ID з localStorage після невдалої спроби з Telegram WebApp");

                    // Перевіряємо localStorage
                    const storedId = localStorage.getItem('telegram_user_id');
                    if (this.isValidId(storedId)) {
                        console.log(`🔐 AUTH: Використовуємо ID з localStorage: ${storedId}`);

                        // Використання корректного присвоєння
                        if (!this.currentUser) {
                            this.currentUser = { telegram_id: storedId };
                        } else {
                            this.currentUser = {
                                ...this.currentUser,
                                telegram_id: storedId
                            };
                        }

                        // Оновлюємо елемент на сторінці
                        const userIdElement = document.getElementById('user-id');
                        if (userIdElement) {
                            userIdElement.textContent = storedId;
                        }

                        userId = storedId;
                    } else {
                        // Якщо ID не знайдено в localStorage, спробуємо отримати з URL
                        const urlParams = new URLSearchParams(window.location.search);
                        const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');

                        if (this.isValidId(urlId)) {
                            console.log(`🔐 AUTH: Використовуємо ID з URL параметрів: ${urlId}`);

                            // Використання корректного присвоєння
                            if (!this.currentUser) {
                                this.currentUser = { telegram_id: urlId };
                            } else {
                                this.currentUser = {
                                    ...this.currentUser,
                                    telegram_id: urlId
                                };
                            }

                            localStorage.setItem('telegram_user_id', urlId);

                            // Оновлюємо елемент на сторінці
                            const userIdElement = document.getElementById('user-id');
                            if (userIdElement) {
                                userIdElement.textContent = urlId;
                            }

                            userId = urlId;
                        } else {
                            // Якщо ID не знайдено в жодному джерелі
                            console.error("❌ AUTH: Не вдалося знайти валідний ID користувача");
                            _userDataRequestInProgress = false;
                            return Promise.reject(new Error("Не вдалося отримати ID користувача"));
                        }
                    }
                }

                // Після всіх спроб перевіряємо фінальний ID на валідність
                if (!this.isValidId(userId)) {
                    console.error("❌ AUTH: Фінальний ID користувача невалідний");
                    _userDataRequestInProgress = false;
                    return Promise.reject(new Error("Невалідний ID користувача"));
                }

                console.log(`🔐 AUTH: Виконуємо запит даних користувача з ID: ${userId}`);

                // Показуємо індикатор завантаження, якщо він є
                const spinner = document.getElementById('loading-spinner');
                if (spinner) spinner.classList.add('show');

                // Додаткова перевірка типу userId
                if (typeof userId !== 'string' && typeof userId !== 'number') {
                    console.error("❌ AUTH: userId має неправильний тип:", typeof userId);

                    if (spinner) spinner.classList.remove('show');
                    _userDataRequestInProgress = false;
                    return Promise.reject(new Error(`Неправильний тип ID: ${typeof userId}`));
                }

                // Перевіряємо наявність API модуля
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    console.error("❌ AUTH: API модуль недоступний для getUserData");
                    if (spinner) spinner.classList.remove('show');
                    _userDataRequestInProgress = false;

                    // Повертаємо поточного користувача як найкращий варіант
                    if (this.currentUser && this.isValidId(this.currentUser.telegram_id)) {
                        return Promise.resolve(this.currentUser);
                    }

                    return Promise.reject(new Error("API модуль недоступний"));
                }

                // ЗМІНЕНО: Використовуємо власний метод з WinixAPI, який має вбудоване керування кешем
                return window.WinixAPI.getUserData(forceRefresh)
                    .then(data => {
                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        if (data.status === 'success') {
                            // Успішне отримання даних - зберігаємо, але залишаємо оригінальний telegram_id
                            const originalId = this.currentUser?.telegram_id || userId;

                            // Створення нового об'єкта замість модифікації існуючого
                            this.currentUser = {
                                ...this.currentUser,
                                ...data.data
                            };

                            // Переконуємося, що ID не замінився на невалідний
                            if (!this.isValidId(this.currentUser.telegram_id)) {
                                // Безпечна зміна властивості об'єкта
                                this.currentUser = {
                                    ...this.currentUser,
                                    telegram_id: originalId
                                };
                            }

                            console.log("✅ AUTH: Дані користувача успішно отримано", this.currentUser);

                            // Зберігаємо ID в localStorage
                            localStorage.setItem('telegram_user_id', this.currentUser.telegram_id);

                            // Оновлюємо інші дані в localStorage
                            if (this.currentUser.balance !== undefined) {
                                localStorage.setItem('userTokens', this.currentUser.balance.toString());
                                localStorage.setItem('winix_balance', this.currentUser.balance.toString());
                            }

                            if (this.currentUser.coins !== undefined) {
                                localStorage.setItem('userCoins', this.currentUser.coins.toString());
                                localStorage.setItem('winix_coins', this.currentUser.coins.toString());
                            }

                            // Оновлюємо дані стейкінгу, якщо вони є
                            if (this.currentUser.staking_data) {
                                localStorage.setItem('stakingData', JSON.stringify(this.currentUser.staking_data));
                                localStorage.setItem('winix_staking', JSON.stringify(this.currentUser.staking_data));
                            }

                            // Оновлюємо власний кеш
                            _userDataCache = this.currentUser;
                            _userDataCacheTime = now;

                            // Подія успішного оновлення даних
                            document.dispatchEvent(new CustomEvent(EVENT_USER_DATA_UPDATED, {
                                detail: this.currentUser
                            }));

                            return this.currentUser;
                        } else {
                            console.error("❌ AUTH: Помилка отримання даних користувача", data);
                            throw new Error(data.message || "Помилка отримання даних");
                        }
                    })
                    .catch(error => {
                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        console.error("❌ AUTH: Помилка отримання даних користувача", error);

                        // Розширена діагностика
                        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                            console.error("❌ AUTH: Проблема мережевого з'єднання - сервер недоступний");
                        } else if (error.status) {
                            console.error(`❌ AUTH: HTTP статус помилки: ${error.status}`);
                        }

                        // Захист від виведення функції в лог
                        const safeUserId = typeof userId === 'function' ? '[Function]' : userId;
                        console.error("❌ AUTH: URL запиту:", `/api/user/${safeUserId}`);
                        console.error("❌ AUTH: Telegram WebApp доступний:", !!window.Telegram?.WebApp);
                        console.error("❌ AUTH: initDataUnsafe доступний:", !!window.Telegram?.WebApp?.initDataUnsafe);

                        // Якщо не вдалося отримати свіжі дані, повертаємо старі (якщо вони є)
                        if (this.currentUser && this.isValidId(this.currentUser.telegram_id)) {
                            console.warn("⚠️ AUTH: Використовуємо кешовані дані користувача");
                            return this.currentUser;
                        }

                        throw error;
                    })
                    .finally(() => {
                        _userDataRequestInProgress = false;
                    });
            } catch (e) {
                _userDataRequestInProgress = false;
                console.error("❌ AUTH: Неочікувана помилка в getUserData:", e);
                return Promise.reject(e);
            }
        },

        /**
         * Показати повідомлення про помилку
         */
        showError: function(message) {
            console.error("❌ AUTH: " + message);

            // Спочатку намагаємося використати існуючі функції
            if (window.simpleAlert) {
                window.simpleAlert(message, true);
                return;
            }

            if (window.showToast) {
                window.showToast(message, true);
                return;
            }

            // Якщо немає існуючих функцій, показуємо стандартний alert
            alert(message);
        },

        /**
         * Показати вітальне повідомлення
         */
        showWelcomeMessage: function() {
            console.log("🔐 AUTH: Показ вітального повідомлення");

            const message = this.getLocalizedText('welcome');

            // Спочатку намагаємося використати існуючі функції
            if (window.simpleAlert) {
                window.simpleAlert(message, false);
                return;
            }

            if (window.showToast) {
                window.showToast(message);
                return;
            }

            // Якщо немає існуючих функцій, показуємо стандартний alert
            alert(message);
        },

        /**
         * Отримати локалізований текст за поточною мовою
         */
        getLocalizedText: function(key) {
            // Спочатку намагаємося визначити мову через існуючу систему
            let currentLang = 'uk'; // Українська за замовчуванням

            if (window.WinixLanguage && window.WinixLanguage.currentLang) {
                currentLang = window.WinixLanguage.currentLang;
            } else if (localStorage.getItem('userLanguage')) {
                currentLang = localStorage.getItem('userLanguage');
            }

            // Перевіряємо, чи є переклад для цієї мови
            if (this.lang[currentLang] && this.lang[currentLang][key]) {
                return this.lang[currentLang][key];
            }

            // Якщо немає, повертаємо український варіант
            return this.lang.uk[key];
        },

        /**
         * Метод для очищення невалідних ID в localStorage
         */
        cleanInvalidIds: function() {
            const storedId = localStorage.getItem('telegram_user_id');
            if (!this.isValidId(storedId)) {
                console.warn("⚠️ AUTH: Видалення невалідного ID з localStorage:", storedId);
                localStorage.removeItem('telegram_user_id');
                return true;
            }
            return false;
        },

        /**
         * Примусове оновлення даних користувача
         */
        refreshUserData: function() {
            console.log("🔄 AUTH: Примусове оновлення даних користувача");
            return this.getUserData(true);
        },

        /**
         * Очищення кешу даних
         */
        clearCache: function() {
            console.log("🧹 AUTH: Очищення кешу даних");
            _userDataCache = null;
            _userDataCacheTime = 0;
            _lastRequestTime = 0;
            return this;
        }
    };

    // Автоматична ініціалізація при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🔐 AUTH: DOMContentLoaded, автоматична ініціалізація");

        // Перевіряємо, чи валідний ID в localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (window.WinixAuth.isValidId(storedId)) {
            // Оновлюємо елемент на сторінці, якщо він є
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = storedId;
                console.log(`🔐 AUTH: Відновлено ID користувача зі сховища: ${storedId}`);
            }
        } else if (storedId) {
            // Видаляємо невалідний ID
            console.warn("⚠️ AUTH: Видалення невалідного ID з localStorage:", storedId);
            localStorage.removeItem('telegram_user_id');
        }

        // ЗМІНЕНО: Безпечна ініціалізація для всіх сторінок
        try {
            // Спочатку пробуємо використати дані з WinixCore, якщо вони доступні
            if (window.WinixCore && typeof window.WinixCore.getUserData === 'function') {
                window.WinixCore.getUserData()
                    .then(userData => {
                        console.log("✅ AUTH: Отримано дані користувача через WinixCore");
                        window.WinixAuth.currentUser = userData;
                        _userDataCache = userData;
                        _userDataCacheTime = Date.now();
                    })
                    .catch(() => {
                        // Якщо не вдалося отримати дані через WinixCore, використовуємо власний метод
                        window.WinixAuth.getUserData()
                            .then(() => console.log("✅ AUTH: Дані користувача оновлено через власний метод"))
                            .catch(err => console.warn("⚠️ AUTH: Помилка отримання даних:", err));
                    });
            } else {
                // Використовуємо власний метод, якщо WinixCore недоступний
                window.WinixAuth.getUserData()
                    .then(() => console.log("✅ AUTH: Дані користувача оновлено через власний метод"))
                    .catch(err => console.warn("⚠️ AUTH: Помилка отримання даних:", err));
            }
        } catch (error) {
            console.error("❌ AUTH: Помилка ініціалізації:", error);
        }
    });

    // Запуск авторизації для веб-аплікацій, які вже завантажилися
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("🔐 AUTH: Документ вже завантажено, запуск авторизації");

        setTimeout(() => {
            // Спочатку очищаємо невалідні ID
            window.WinixAuth.cleanInvalidIds();

            // ЗМІНЕНО: Уніфікований підхід для всіх сторінок
            if (window.WinixAuth && !window.WinixAuth.currentUser) {
                window.WinixAuth.getUserData()
                    .then(() => {
                        console.log("✅ AUTH: Дані користувача оновлено після завантаження");
                    })
                    .catch(error => {
                        console.warn("⚠️ AUTH: Помилка завантаження даних користувача", error);
                        // Якщо getUserData не спрацював, спробуємо init
                        window.WinixAuth.init();
                    });
            }
        }, 100);
    }

    // Додаємо обробник події 'telegram-ready', якщо використовуються події
    document.addEventListener('telegram-ready', function() {
        console.log("🔐 AUTH: Отримано подію telegram-ready, запуск авторизації");

        if (window.WinixAuth) {
            window.WinixAuth.getUserData()
                .then(() => {
                    console.log("✅ AUTH: Дані користувача оновлено після telegram-ready");
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка завантаження даних користувача", error);
                });
        }
    });

    // ЗМІНЕНО: Покращено механізм періодичного оновлення
    let periodicUpdateInterval = null;

    // Функція запуску періодичного оновлення
    function startPeriodicUpdate() {
        if (periodicUpdateInterval) return;

        // Оновлюємо дані користувача кожні 60 секунд (збільшили інтервал)
        periodicUpdateInterval = setInterval(function() {
            // Перевіряємо час останнього запиту
            if ((Date.now() - _lastRequestTime) >= MIN_REQUEST_INTERVAL && !_userDataRequestInProgress) {
                if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                    window.WinixAuth.getUserData()
                        .then(() => console.log("✅ Періодичне оновлення даних користувача"))
                        .catch(err => console.warn("⚠️ Помилка періодичного оновлення:", err));
                }
            }
        }, 60000); // 60 секунд

        console.log("🔄 AUTH: Періодичне оновлення запущено");
    }

    // Функція зупинки періодичного оновлення
    function stopPeriodicUpdate() {
        if (periodicUpdateInterval) {
            clearInterval(periodicUpdateInterval);
            periodicUpdateInterval = null;
            console.log("⏹️ AUTH: Періодичне оновлення зупинено");
        }
    }

    // Запускаємо періодичне оновлення, але не для сторінки налаштувань
    if (!window.location.pathname.includes('general.html')) {
        startPeriodicUpdate();
    }

    // Додаємо обробник подій для переключення сторінок (якщо є History API)
    window.addEventListener('popstate', function() {
        const isSettingsPage = window.location.pathname.includes('general.html');
        if (isSettingsPage) {
            stopPeriodicUpdate();
        } else if (!periodicUpdateInterval) {
            startPeriodicUpdate();
        }
    });

    // Додаємо можливість зупинки/запуску оновлення даних
    window.WinixAuth.startPeriodicUpdate = startPeriodicUpdate;
    window.WinixAuth.stopPeriodicUpdate = stopPeriodicUpdate;

    // Додаємо обробник подій для синхронізації з іншими модулями
    document.addEventListener(EVENT_USER_DATA_UPDATED, function(event) {
        if (event.detail && event.source !== 'auth.js') {
            console.log("🔄 AUTH: Оновлення даних користувача з іншого модуля");
            window.WinixAuth.currentUser = event.detail;
            _userDataCache = event.detail;
            _userDataCacheTime = Date.now();
        }
    });

    console.log("✅ AUTH: Систему авторизації успішно ініціалізовано");
})();