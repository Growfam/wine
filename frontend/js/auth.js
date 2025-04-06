/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * Виправлена версія з усіма виправленнями помилок ID і констант
 */

(function() {
    console.log("🔐 AUTH: Ініціалізація системи авторизації");

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

            // ЗМІНЕНО: Спочатку викликаємо getUserData для отримання ID з Telegram
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
            if (this.isAuthorizing) {
                console.log("🔐 AUTH: Авторизація вже виконується");
                return Promise.reject(new Error("Authorization already in progress"));
            }

            this.isAuthorizing = true;
            console.log("🔐 AUTH: Запит авторизації на сервері", userData);

            // Перевіряємо чи доступний Telegram WebApp і оновлюємо дані
            if (window.Telegram && window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user) {

                // Оновлюємо ID користувача з Telegram WebApp
                const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id;
                if (telegramId) {
                    // ВИПРАВЛЕНО: Замість модифікації параметра, створюємо нову змінну
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
                this.isAuthorizing = false;
                return Promise.reject(new Error("Неможливо отримати валідний ID користувача"));
            }

            // ВИПРАВЛЕНО: Використовуємо let замість const для userId
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

            // Використання API модуля для авторизації
            return window.WinixAPI.authorize(userData)
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

                        // Показуємо вітальне повідомлення для нових користувачів
                        if (data.data.is_new_user) {
                            this.showWelcomeMessage();
                        }

                        // Відправляємо подію про успішну авторизацію
                        document.dispatchEvent(new CustomEvent('auth-success', {
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
                    document.dispatchEvent(new CustomEvent('auth-error', {
                        detail: error
                    }));

                    throw error;
                })
                .finally(() => {
                    this.isAuthorizing = false;
                });
        },

        /**
         * Отримання даних користувача з сервера
         */
        getUserData: function() {
            let userId = null; // ВИПРАВЛЕНО: Використання let замість const
            let telegramId = null; // ВИПРАВЛЕНО: Додано нову змінну для ID з Telegram

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
                        // ВИПРАВЛЕНО: Використання безпечної зміни об'єкта
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

                    // ВИПРАВЛЕНО: Використання корректного присвоєння
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

                        // ВИПРАВЛЕНО: Використання корректного присвоєння
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
                        return Promise.reject(new Error("Не вдалося отримати ID користувача"));
                    }
                }
            }

            // Після всіх спроб перевіряємо фінальний ID на валідність
            if (!this.isValidId(userId)) {
                console.error("❌ AUTH: Фінальний ID користувача невалідний");
                return Promise.reject(new Error("Невалідний ID користувача"));
            }

            console.log(`🔐 AUTH: Виконуємо запит даних користувача з ID: ${userId}`);

            // Показуємо індикатор завантаження, якщо він є
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // ВИПРАВЛЕНО: Додаткова перевірка типу userId
            if (typeof userId !== 'string' && typeof userId !== 'number') {
                console.error("❌ AUTH: userId має неправильний тип:", typeof userId);

                if (spinner) spinner.classList.remove('show');

                return Promise.reject(new Error(`Неправильний тип ID: ${typeof userId}`));
            }

            // Використання API модуля для отримання даних користувача
            return window.WinixAPI.getUserData(userId)
                .then(data => {
                    // Приховуємо індикатор завантаження
                    if (spinner) spinner.classList.remove('show');

                    if (data.status === 'success') {
                        // Успішне отримання даних - зберігаємо, але залишаємо оригінальний telegram_id
                        const originalId = this.currentUser.telegram_id;

                        // ВИПРАВЛЕНО: Створення нового об'єкта замість модифікації існуючого
                        this.currentUser = {
                            ...this.currentUser,
                            ...data.data
                        };

                        // Переконуємося, що ID не замінився на невалідний
                        if (!this.isValidId(this.currentUser.telegram_id)) {
                            // ВИПРАВЛЕНО: Безпечна зміна властивості об'єкта
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

                        // Подія успішного оновлення даних
                        document.dispatchEvent(new CustomEvent('user-data-updated', {
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

                    // ВИПРАВЛЕНО: Захист від виведення функції в лог
                    const safeUserId = typeof userId === 'function' ? '[Function]' : userId;
                    console.error("❌ AUTH: URL запиту:", `/api/user/${safeUserId}`);
                    console.error("❌ AUTH: Telegram WebApp доступний:", !!window.Telegram?.WebApp);
                    console.error("❌ AUTH: initDataUnsafe доступний:", !!window.Telegram?.WebApp?.initDataUnsafe);

                    this.showError(this.getLocalizedText('dataError'));
                    throw error;
                });
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
                window.showToast(message);
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

        // ДОДАНО: Безпосередній виклик getUserData для отримання актуального ID
        if (window.WinixAuth) {
            window.WinixAuth.getUserData()
                .then(() => {
                    console.log("✅ AUTH: Дані користувача оновлено при завантаженні DOM");
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка завантаження даних користувача", error);
                    // Якщо getUserData не спрацював, спробуємо init
                    window.WinixAuth.init();
                });
        }

        // Якщо сторінка - екран завантаження, просто виконуємо авторизацію і дочекаємось результату
        if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
            window.WinixAuth.init()
                .then(() => {
                    console.log("✅ AUTH: Авторизація виконана успішно на екрані завантаження");
                })
                .catch(error => {
                    console.error("❌ AUTH: Помилка авторизації на екрані завантаження", error);
                });
        }
    });

    // Запуск авторизації для веб-аплікацій, які вже завантажилися
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("🔐 AUTH: Документ вже завантажено, запуск авторизації");

        setTimeout(() => {
            // Спочатку очищаємо невалідні ID
            window.WinixAuth.cleanInvalidIds();

            // Безпосередній виклик getUserData
            if (window.WinixAuth) {
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

        // Безпосередній виклик getUserData
        if (window.WinixAuth) {
            window.WinixAuth.getUserData()
                .then(() => {
                    console.log("✅ AUTH: Дані користувача оновлено після telegram-ready");
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка завантаження даних користувача", error);
                    // Якщо getUserData не спрацював, спробуємо init
                    window.WinixAuth.init();
                });
        }
    });

    // Періодичне оновлення даних
    (function setupPeriodicUpdate() {
        // Оновлюємо дані користувача кожні 30 секунд
        setInterval(function() {
            if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                window.WinixAuth.getUserData()
                    .then(() => console.log("✅ Періодичне оновлення даних користувача"))
                    .catch(err => console.warn("⚠️ Помилка періодичного оновлення:", err));
            }
        }, 30000); // 30 секунд
    })();

    console.log("✅ AUTH: Систему авторизації успішно ініціалізовано");
})();