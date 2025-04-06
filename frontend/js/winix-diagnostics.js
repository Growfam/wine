/**
 * winix-diagnostics.js - Діагностичний модуль для відстеження проблем ID
 */

(function() {
    // Створюємо глобальний об'єкт для діагностики
    window.WinixDiagnostics = {
        // Налаштування
        enabled: true,
        verboseLogging: false,

        // Історія ID користувача для відстеження змін
        idHistory: [],

        // Ініціалізація діагностичного модуля
        init: function() {
            console.log("🔍 DIAG: Ініціалізація діагностичного модуля");

            // Перевіримо поточний ID
            this.checkCurrentId();

            // Налаштування спостерігача для localStorage
            this.setupStorageObserver();

            // Перевіряємо ID при кожному API-запиті
            this.monitorApiRequests();

            // Моніторинг Telegram WebApp
            this.monitorTelegramWebApp();

            return this;
        },

        // Перевірка поточного ID
        checkCurrentId: function() {
            const storedId = localStorage.getItem('telegram_user_id');
            console.log("🔍 DIAG: Поточний ID в localStorage:", storedId);

            if (storedId === 'undefined' || storedId === 'null' || !storedId) {
                console.warn("⚠️ DIAG: Виявлено невалідний ID в localStorage");

                // Додаємо запис в історію
                this.idHistory.push({
                    time: new Date().toISOString(),
                    source: 'localStorage',
                    value: storedId,
                    valid: false
                });

                // Спробуємо виправити
                this.attemptToFixId();
            } else {
                // Додаємо запис в історію
                this.idHistory.push({
                    time: new Date().toISOString(),
                    source: 'localStorage',
                    value: storedId,
                    valid: true
                });
            }

            return storedId;
        },

        // Спостерігач для localStorage
        setupStorageObserver: function() {
            const originalSetItem = localStorage.setItem;
            const diagnostics = this;

            // Перевизначаємо метод setItem для відстеження змін ID
            localStorage.setItem = function(key, value) {
                if (key === 'telegram_user_id') {
                    console.log(`🔍 DIAG: Запис в localStorage, ключ=${key}, значення=${value}`);

                    // Перевіряємо валідність ID
                    const isValid = value && value !== 'undefined' && value !== 'null';

                    // Додаємо запис в історію
                    diagnostics.idHistory.push({
                        time: new Date().toISOString(),
                        source: 'localStorage.setItem',
                        value: value,
                        valid: isValid,
                        stack: new Error().stack // Зберігаємо стек викликів
                    });

                    // Попереджаємо про невалідні значення
                    if (!isValid) {
                        console.warn(`⚠️ DIAG: Спроба запису невалідного ID в localStorage: "${value}"`);
                        console.trace();

                        // Можна вирішити чи блокувати запис, чи дозволити для діагностики
                        // return; // Розкоментуйте щоб блокувати запис невалідних ID
                    }
                }

                // Викликаємо оригінальний метод
                originalSetItem.call(this, key, value);
            };
        },

        // Моніторинг API-запитів
        monitorApiRequests: function() {
            if (window.WinixAPI && window.WinixAPI.apiRequest) {
                const originalApiRequest = window.WinixAPI.apiRequest;
                const diagnostics = this;

                window.WinixAPI.apiRequest = function(endpoint, method, data, options, retries) {
                    // Перевіряємо ID перед запитом
                    const userId = window.WinixAPI.getUserId();

                    // Логуємо дані запиту
                    console.log(`🔍 DIAG: API-запит на ${endpoint}, ID користувача: ${userId}`);

                    // Записуємо в історію
                    diagnostics.idHistory.push({
                        time: new Date().toISOString(),
                        source: 'apiRequest',
                        endpoint: endpoint,
                        value: userId,
                        valid: userId && userId !== 'undefined' && userId !== 'null'
                    });

                    // Викликаємо оригінальний метод
                    return originalApiRequest.call(this, endpoint, method, data, options, retries);
                };
            }
        },

        // Моніторинг Telegram WebApp
        monitorTelegramWebApp: function() {
            if (window.Telegram && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;

                // Перевіряємо дані Telegram WebApp
                if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    const user = tg.initDataUnsafe.user;
                    console.log("🔍 DIAG: Дані користувача в Telegram WebApp:", user);

                    // Записуємо в історію
                    this.idHistory.push({
                        time: new Date().toISOString(),
                        source: 'Telegram.WebApp',
                        value: user.id,
                        valid: user.id !== undefined && user.id !== null
                    });

                    if (!user.id) {
                        console.warn("⚠️ DIAG: Відсутній ID користувача в Telegram WebApp");
                    }
                } else {
                    console.warn("⚠️ DIAG: Відсутні дані користувача в Telegram WebApp");

                    // Записуємо в історію
                    this.idHistory.push({
                        time: new Date().toISOString(),
                        source: 'Telegram.WebApp',
                        value: null,
                        valid: false,
                        error: 'No user data'
                    });
                }
            }
        },

        // Спроба виправити невалідний ID
        attemptToFixId: function() {
            console.log("🔍 DIAG: Спроба виправити невалідний ID...");

            // Спочатку очистимо невалідне значення
            if (localStorage.getItem('telegram_user_id') === 'undefined' || localStorage.getItem('telegram_user_id') === 'null') {
                localStorage.removeItem('telegram_user_id');
                console.log("🔍 DIAG: Видалено невалідний ID з localStorage");
            }

            // Спробуємо отримати ID з Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                if (user.id) {
                    localStorage.setItem('telegram_user_id', user.id.toString());
                    console.log(`🔍 DIAG: Виправлено ID з Telegram WebApp: ${user.id}`);
                    return true;
                }
            }

            // Спробуємо отримати ID з DOM
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent && userIdElement.textContent.trim() !== '' &&
                userIdElement.textContent !== 'undefined' && userIdElement.textContent !== 'null') {
                const id = userIdElement.textContent.trim();
                localStorage.setItem('telegram_user_id', id);
                console.log(`🔍 DIAG: Виправлено ID з DOM: ${id}`);
                return true;
            }

            // Спробуємо отримати ID з URL
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId && urlId !== 'undefined' && urlId !== 'null') {
                localStorage.setItem('telegram_user_id', urlId);
                console.log(`🔍 DIAG: Виправлено ID з URL: ${urlId}`);
                return true;
            }

            console.warn("⚠️ DIAG: Не вдалося виправити ID автоматично");
            return false;
        },

        // Отримання діагностичних даних
        getDiagnosticData: function() {
            return {
                idHistory: this.idHistory,
                currentId: localStorage.getItem('telegram_user_id'),
                telegramAvailable: !!window.Telegram,
                webAppAvailable: !!(window.Telegram && window.Telegram.WebApp),
                initDataAvailable: !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData),
                userDataAvailable: !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user),
                timestamp: new Date().toISOString()
            };
        },

        // Видалення невалідних ID в localStorage
        cleanupInvalidIds: function() {
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId === 'undefined' || storedId === 'null' || storedId === '') {
                localStorage.removeItem('telegram_user_id');
                console.log("🔍 DIAG: Видалено невалідний ID з localStorage");
                return true;
            }
            return false;
        }
    };

    // Автоматично ініціалізуємо діагностичний модуль
    document.addEventListener('DOMContentLoaded', function() {
        window.WinixDiagnostics.init();
    });

    // Якщо сторінка вже завантажена, ініціалізуємо зараз
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        window.WinixDiagnostics.init();
    }

    console.log("✅ DIAG: Діагностичний модуль готовий до використання");
})();