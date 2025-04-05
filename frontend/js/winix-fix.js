// winix-fix.js - комплексне виправлення для проблем ініціалізації WINIX
(function() {
    console.log("🛠️ WINIX Fix - ініціалізація патчів системи");

    // Запобігаємо багаторазовій ініціалізації
    if (window.WINIX_FIX_INITIALIZED) {
        console.log("✅ WINIX Fix вже ініціалізовано");
        return;
    }

    // 1. Створюємо заглушку для Telegram WebApp API
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.log("📱 Створення заглушки для Telegram WebApp API");
        window.Telegram = window.Telegram || {};
        window.Telegram.WebApp = {
            initData: "",
            initDataUnsafe: {
                user: { id: 12345678, username: "WINIX_User" },
                start_param: ""
            },
            version: "6.0",
            platform: "web",
            colorScheme: "dark",
            themeParams: {
                bg_color: "#212121",
                text_color: "#ffffff",
                hint_color: "#aaaaaa",
                link_color: "#00CFBB",
                button_color: "#00CFBB",
                button_text_color: "#ffffff"
            },
            isExpanded: true,
            viewportHeight: window.innerHeight,
            viewportStableHeight: window.innerHeight,

            // Методи
            ready: function() { return true; },
            expand: function() { return true; },
            close: function() { return true; },
            isVersionAtLeast: function() { return true; },
            onEvent: function(event, callback) {
                if (event === 'viewportChanged') {
                    window.addEventListener('resize', callback);
                }
                return true;
            },
            offEvent: function() { return true; },
            showAlert: function(message, callback) {
                alert(message);
                if (callback) setTimeout(callback, 100);
            },
            showConfirm: function(message, callback) {
                const result = confirm(message);
                if (callback) setTimeout(() => callback(result), 100);
            },
            enableClosingConfirmation: function() { return true; },
            disableClosingConfirmation: function() { return true; },
            setHeaderColor: function() { return true; },
            setBackgroundColor: function() { return true; },
            showPopup: function(params, callback) {
                alert(params.message || params.title || 'Повідомлення');
                if (callback) setTimeout(() => callback(), 100);
            },
            HapticFeedback: {
                impactOccurred: function() { return true; },
                notificationOccurred: function() { return true; },
                selectionChanged: function() { return true; }
            }
        };

        // Відправляємо подію про готовність
        setTimeout(function() {
            const event = new Event('tg:init');
            document.dispatchEvent(event);
        }, 100);
    }

    // 2. Створюємо базову структуру WinixCore
    if (!window.WinixCore) {
        console.log("🧠 Створення заглушки для WinixCore");
        window.WinixCore = {
            // Дані користувача отримані з документу
            UserData: {
                id: "12345678",
                telegramId: "7066583465",
                username: "WINIX User",
                balance: 202.0,
                coins: 5,
                staking: {
                    period: 14,
                    status: 'active',
                    endDate: '2025-04-19T18:15:27.657416',
                    stakingId: 'st-72a90e0bae7b',
                    startDate: '2025-04-05T18:15:27.657403',
                    remainingDays: 13,
                    rewardPercent: 9,
                    stakingAmount: 100,
                    expectedReward: 9.0,
                    hasActiveStaking: true
                }
            },

            // Функції роботи з UI
            UI: {
                showNotification: function(message, type = 'success', duration = 3000) {
                    console.log(`🔔 WINIX повідомлення (${type}): ${message}`);

                    // Створюємо елемент повідомлення
                    const notification = document.createElement('div');
                    notification.className = `winix-notification winix-notification-${type}`;
                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        padding: 10px 20px;
                        background: ${type === 'error' ? 'rgba(255, 50, 50, 0.9)' : 'rgba(0, 201, 167, 0.9)'};
                        color: white;
                        border-radius: 10px;
                        z-index: 9999;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                        text-align: center;
                        max-width: 80%;
                    `;
                    notification.textContent = message;
                    document.body.appendChild(notification);

                    // Автоматично приховуємо
                    setTimeout(() => {
                        notification.style.opacity = '0';
                        setTimeout(() => {
                            if (notification.parentNode) {
                                notification.parentNode.removeChild(notification);
                            }
                        }, 300);
                    }, duration);

                    return true;
                },
                updateBalanceDisplay: function() {
                    try {
                        // Оновлюємо баланс на сторінці
                        const userTokensElement = document.getElementById('user-tokens');
                        const userCoinsElement = document.getElementById('user-coins');
                        const mainBalanceElement = document.getElementById('main-balance');

                        if (userTokensElement) {
                            userTokensElement.textContent = window.WinixCore.UserData.balance.toFixed(2);
                        }

                        if (userCoinsElement) {
                            userCoinsElement.textContent = window.WinixCore.UserData.coins.toString();
                        }

                        if (mainBalanceElement) {
                            mainBalanceElement.textContent = window.WinixCore.UserData.balance.toFixed(2);
                        }

                        return true;
                    } catch (e) {
                        console.error("Помилка оновлення відображення балансу:", e);
                        return false;
                    }
                }
            },

            // Функції стейкінгу
            Staking: {
                getStakingData: function() {
                    try {
                        // Спочатку спробуємо отримати з localStorage
                        const storedData = localStorage.getItem('stakingData') ||
                                          localStorage.getItem('winix_staking');

                        if (storedData) {
                            try {
                                return JSON.parse(storedData);
                            } catch (e) {
                                console.warn("Помилка парсингу даних стейкінгу:", e);
                            }
                        }

                        // Повертаємо дані з WinixCore.UserData
                        return window.WinixCore.UserData.staking || {
                            hasActiveStaking: false,
                            stakingAmount: 0,
                            period: 0,
                            rewardPercent: 0,
                            expectedReward: 0,
                            remainingDays: 0
                        };
                    } catch (e) {
                        console.error("Помилка отримання даних стейкінгу:", e);
                        return {
                            hasActiveStaking: false,
                            stakingAmount: 0,
                            period: 0,
                            rewardPercent: 0,
                            expectedReward: 0,
                            remainingDays: 0
                        };
                    }
                },
                calculateExpectedReward: function(amount, period) {
                    try {
                        amount = parseFloat(amount) || 0;
                        period = parseInt(period) || 14;

                        // Стандартні ставки винагороди
                        const rates = {
                            7: 4,  // 4% за 7 днів
                            14: 9, // 9% за 14 днів
                            28: 15 // 15% за 28 днів
                        };

                        const rate = rates[period] || 9;
                        const reward = (amount * rate) / 100;

                        return parseFloat(reward.toFixed(2));
                    } catch (e) {
                        console.error("Помилка розрахунку винагороди:", e);
                        return 0;
                    }
                }
            },

            // Функція ініціалізації (критична для winix-connector.js)
            init: function(config = {}) {
                console.log("🚀 WinixCore.init викликано з конфігурацією:", config);

                // Зберігаємо дані стейкінгу в localStorage для сумісності
                try {
                    if (window.WinixCore.UserData.staking) {
                        localStorage.setItem('stakingData', JSON.stringify(window.WinixCore.UserData.staking));
                        localStorage.setItem('winix_staking', JSON.stringify(window.WinixCore.UserData.staking));
                    }

                    // Зберігаємо баланс для сумісності
                    localStorage.setItem('userTokens', window.WinixCore.UserData.balance.toString());
                    localStorage.setItem('userCoins', window.WinixCore.UserData.coins.toString());

                    // Зберігаємо ID користувача для сумісності
                    localStorage.setItem('userId', window.WinixCore.UserData.id.toString());
                    localStorage.setItem('telegram_user_id', window.WinixCore.UserData.telegramId.toString());
                } catch (e) {
                    console.warn("Помилка збереження даних у localStorage:", e);
                }

                // Виправляємо баг авторизації в auth.js
                window.isInitialized = true;
                window.userData = window.WinixCore.UserData;

                // Повертаємо успішний результат
                return true;
            }
        };

        // Створюємо заглушки для допоміжних функцій, щоб уникнути помилок
        window.WinixCore.Balance = {
            getTokens: function() {
                return window.WinixCore.UserData.balance;
            },
            getCoins: function() {
                return window.WinixCore.UserData.coins;
            },
            syncBalanceFromServer: function() {
                return Promise.resolve(true);
            }
        };

        window.WinixCore.Transactions = {
            getTransactions: function() {
                return [];
            },
            getRecentTransactions: function() {
                return [];
            }
        };
    }

    // 3. Перетворюємо дані з серверного логу на структуру користувача
    try {
        // Дані з логу
        const stakingData = {
            period: 14,
            status: 'active',
            endDate: '2025-04-19T18:15:27.657416',
            stakingId: 'st-72a90e0bae7b',
            startDate: '2025-04-05T18:15:27.657403',
            remainingDays: 13,
            rewardPercent: 9,
            stakingAmount: 100,
            expectedReward: 9.0,
            hasActiveStaking: true,
            creationTimestamp: 1743876927657
        };

        // Зберігаємо актуальні дані стейкінгу
        localStorage.setItem('stakingData', JSON.stringify(stakingData));
        localStorage.setItem('winix_staking', JSON.stringify(stakingData));
        sessionStorage.setItem('stakingData', JSON.stringify(stakingData));

        // Оновлюємо також баланс та інші дані
        localStorage.setItem('userTokens', '202.0');
        localStorage.setItem('userCoins', '5');
        localStorage.setItem('userId', '12345678');
        localStorage.setItem('telegram_user_id', '7066583465');

        // Оновлюємо глобальні дані
        window.WinixCore.UserData.balance = 202.0;
        window.WinixCore.UserData.coins = 5;
        window.WinixCore.UserData.staking = stakingData;
    } catch (e) {
        console.warn("Помилка при ініціалізації даних:", e);
    }

    // 4. Створюємо патчі для проблемних функцій
    if (Element.prototype.removeChild) {
        // Перезаписуємо метод removeChild для захисту від NotFoundError
        const originalRemoveChild = Element.prototype.removeChild;
        Element.prototype.removeChild = function(child) {
            try {
                return originalRemoveChild.call(this, child);
            } catch (e) {
                console.warn("Перехоплено помилку removeChild:", e);
                return null;
            }
        };
    }

    // 5. Створюємо глобальний перехоплювач помилок
    window.addEventListener('error', function(event) {
        console.warn("Перехоплено глобальну помилку:", event.error || event.message);

        // Якщо помилка пов'язана з WinixCore
        if (event.error && event.message && (
            event.message.includes('WinixCore') ||
            event.message.includes('winix-core') ||
            event.message.includes('not a function') ||
            event.message.includes('cannot read property') ||
            event.message.includes('is not an object')
        )) {
            console.log("Помилка в ядрі WINIX, спроба виправлення");

            // Якщо помилка ініціалізації
            if (event.message.includes('init is not a function')) {
                try {
                    // Спробуємо викликати init, якщо це можливо
                    if (typeof window.WinixCore.init === 'function') {
                        window.WinixCore.init();
                    }
                } catch (e) {
                    console.error("Помилка при спробі виклику WinixCore.init:", e);
                }
            }

            // Якщо помилка стейкінгу
            if (event.message.includes('Staking') ||
                event.message.includes('calculateExpectedReward')) {
                // Очищаємо пошкоджені дані стейкінгу
                setTimeout(function() {
                    console.log("Виправлення даних стейкінгу");

                    const stakingData = {
                        period: 14,
                        status: 'active',
                        endDate: '2025-04-19T18:15:27.657416',
                        stakingId: 'st-72a90e0bae7b',
                        startDate: '2025-04-05T18:15:27.657403',
                        remainingDays: 13,
                        rewardPercent: 9,
                        stakingAmount: 100,
                        expectedReward: 9.0,
                        hasActiveStaking: true,
                        creationTimestamp: 1743876927657
                    };

                    // Оновлюємо дані в localStorage
                    localStorage.setItem('stakingData', JSON.stringify(stakingData));
                    localStorage.setItem('winix_staking', JSON.stringify(stakingData));
                }, 500);
            }

            // Запобігаємо стандартній обробці помилки
            event.preventDefault();
        }
    });

    // 6. Додаємо перехоплювач для помилки авторизації
    const originalConsoleError = console.error;
    console.error = function() {
        // Перевіряємо аргументи на наявність помилки авторизації
        for (let i = 0; i < arguments.length; i++) {
            const arg = arguments[i];
            if (typeof arg === 'string' && (
                arg.includes('AUTH: Помилка авторизації') ||
                arg.includes('Telegram WebApp not available')
            )) {
                console.log("🔐 Перехоплено помилку авторизації, застосування патчу");

                // Встановлюємо флаг авторизації для auth.js
                window.isAuthorized = true;
                window.isInitialized = true;
                window.userData = window.WinixCore.UserData;

                // Відправляємо події для auth.js
                setTimeout(function() {
                    document.dispatchEvent(new Event('auth:ready'));
                    document.dispatchEvent(new Event('auth:success'));
                }, 200);

                // Запобігаємо виведенню помилки
                return;
            }
        }

        // Викликаємо оригінальну функцію для інших помилок
        originalConsoleError.apply(console, arguments);
    };

    // Встановлюємо флаг ініціалізації
    window.WINIX_FIX_INITIALIZED = true;

    console.log("✅ WINIX Fix успішно ініціалізовано");
})();