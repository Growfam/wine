/**
 * auth.js - Модуль авторизації для Telegram Mini App
 *
 * Цей модуль відповідає за:
 * 1. Отримання даних користувача з Telegram WebApp
 * 2. Авторизацію на сервері
 * 3. Збереження даних користувача для використання в інших частинах додатку
 */

(function() {
    console.log("🔐 AUTH: Ініціалізація системи авторизації");

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
         * Ініціалізація системи авторизації
         */
        init: function() {
            console.log("🔐 AUTH: Запуск ініціалізації");

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

            // Ініціалізуємо Telegram WebApp
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();

            // Отримуємо дані користувача
            const initData = tg.initData || "";
            const userData = tg.initDataUnsafe?.user || null;

            console.log("🔐 AUTH: Отримано дані з Telegram WebApp", userData);

            if (!userData) {
                console.error("❌ AUTH: Не вдалося отримати дані користувача");
                return Promise.reject(new Error("User data not available"));
            }

            // Додаємо initData до даних користувача для додаткової перевірки на сервері
            const authData = {
                ...userData,
                initData: initData
            };

            return this.authorizeUser(authData);
        },

        /**
         * Авторизація користувача на сервері
         * @param {Object} userData - Дані користувача з Telegram WebApp
         * @returns {Promise} - Promise з даними користувача
         */
        authorizeUser: function(userData) {
            if (this.isAuthorizing) {
                console.log("🔐 AUTH: Авторизація вже виконується");
                return Promise.reject(new Error("Authorization already in progress"));
            }

            this.isAuthorizing = true;
            console.log("🔐 AUTH: Запит авторизації на сервері", userData);

            // Отримуємо ID користувача з різних можливих джерел
            const userId = userData.id || userData.telegram_id || null;

            // Записуємо ID в localStorage для подальшого використання
            if (userId) {
                localStorage.setItem('telegram_user_id', userId);

                // Одразу оновлюємо елемент на сторінці, якщо він існує
                const userIdElement = document.getElementById('user-id');
                if (userIdElement) {
                    userIdElement.textContent = userId;
                    console.log(`🔐 AUTH: Оновлено ID користувача на сторінці: ${userId}`);
                }
            }

            // Показуємо індикатор завантаження, якщо він є
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Підготовка заголовків
            const headers = {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId || ''
            };

            return fetch('/api/auth', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(userData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP помилка! Статус: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Приховуємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');

                if (data.status === 'success') {
                    this.currentUser = data.data;
                    console.log("✅ AUTH: Користувача успішно авторизовано", this.currentUser);

                    // Зберігаємо ID користувача для інших частин додатку
                    if (this.currentUser.telegram_id) {
                        localStorage.setItem('telegram_user_id', this.currentUser.telegram_id);

                        // Оновлюємо елемент на сторінці
                        const userIdElement = document.getElementById('user-id');
                        if (userIdElement) {
                            userIdElement.textContent = this.currentUser.telegram_id;
                        }
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

                // Спроба отримати дані запиту, які викликали помилку
                console.error("❌ AUTH: ID користувача для діагностики:", localStorage.getItem('telegram_user_id'));

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
         * @returns {Promise} - Promise з даними користувача
         */
        getUserData: function() {
            if (!this.currentUser) {
                console.error("❌ AUTH: Немає даних про поточного користувача");

                // Спробуємо отримати ID з localStorage як резервний варіант
                const storedId = localStorage.getItem('telegram_user_id');
                if (storedId) {
                    console.log(`🔐 AUTH: Використовуємо ID з localStorage: ${storedId}`);
                    this.currentUser = { telegram_id: storedId };
                } else {
                    return Promise.reject(new Error("No current user"));
                }
            }

            const userId = this.currentUser.telegram_id;
            console.log(`🔐 AUTH: Запит даних користувача ${userId}`);

            return fetch(`/api/user/${userId}`, {
                headers: {
                    'X-Telegram-User-Id': userId || ''
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP помилка! Статус: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    // Успішне отримання даних
                    this.currentUser = { ...this.currentUser, ...data.data };
                    console.log("✅ AUTH: Дані користувача успішно отримано", this.currentUser);

                    // Оновлюємо баланс і жетони в localStorage
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

                    return this.currentUser;
                } else {
                    // Явна обробка випадку, коли статус не "success"
                    console.error("❌ AUTH: Помилка отримання даних користувача", data);
                    throw new Error(data.message || "Помилка отримання даних");
                }
            })
            .catch(error => {
                console.error("❌ AUTH: Помилка отримання даних користувача", error);

                // Додаткова діагностика
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.error("❌ AUTH: Проблема мережевого з'єднання - сервер недоступний");
                } else if (error.status) {
                    console.error(`❌ AUTH: HTTP статус помилки: ${error.status}`);
                }
                console.error("❌ AUTH: URL запиту:", `/api/user/${userId}`);

                this.showError(this.getLocalizedText('dataError'));
                throw error;
            });
        },

        /**
         * Показати повідомлення про помилку
         * @param {string} message - Текст повідомлення
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
         * @param {string} key - Ключ тексту
         * @returns {string} - Локалізований текст
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
        }
    };

    // Автоматична ініціалізація при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🔐 AUTH: DOMContentLoaded, автоматична ініціалізація");

        // Перевіряємо, чи вже є ID в localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (storedId) {
            // Оновлюємо елемент на сторінці, якщо він є
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = storedId;
                console.log(`🔐 AUTH: Відновлено ID користувача зі сховища: ${storedId}`);
            }
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
            window.WinixAuth.init()
                .then(() => {
                    console.log("✅ AUTH: Авторизація виконана успішно після завантаження");
                })
                .catch(error => {
                    console.error("❌ AUTH: Помилка авторизації після завантаження", error);
                });
        }, 100);
    }

    // Додаємо обробник події 'telegram-ready', якщо використовуються події
    document.addEventListener('telegram-ready', function() {
        console.log("🔐 AUTH: Отримано подію telegram-ready, запуск авторизації");

        window.WinixAuth.init()
            .then(() => {
                console.log("✅ AUTH: Авторизація виконана успішно після telegram-ready");
            })
            .catch(error => {
                console.error("❌ AUTH: Помилка авторизації після telegram-ready", error);
            });
    });

    console.log("✅ AUTH: Систему авторизації успішно ініціалізовано");
})();