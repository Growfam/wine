/**
 * ui.js
 *
 * Єдиний файл виправлень для інтерфейсу WINIX. Включає виправлення помилок оновлення UI,
 * проблем з навігацією та інших дрібних проблем, які можуть виникнути на сторінках додатку.
 *
 * Цей файл замінює колишні ui.js, fix-ui-extended.js, staking-operations-patch.js
 * та інші подібні патчі, об'єднуючи їх в один послідовний модуль.
 */

(function() {
    'use strict';

    console.log("🔧 Застосування виправлень для UI WINIX...");

    // ======== ПЕРЕВІРКА ЗАЛЕЖНОСТЕЙ ========

    // Флаг успішної ініціалізації
    let _initialized = false;

    // Перевіряємо наявність WinixAPI
    const hasWinixAPI = window.WinixAPI !== undefined;
    if (!hasWinixAPI) {
        console.warn("⚠️ WinixAPI не знайдено. Виправлення UI будуть обмежені.");
    }

    // Перевіряємо наявність WinixCore
    const hasWinixCore = window.WinixCore !== undefined;
    if (!hasWinixCore) {
        console.warn("⚠️ WinixCore не знайдено. Виправлення UI будуть обмежені.");
    }

    // Перевіряємо наявність WinixStakingSystem
    const hasStakingSystem = window.WinixStakingSystem !== undefined;
    if (!hasStakingSystem) {
        console.warn("⚠️ WinixStakingSystem не знайдено. Виправлення стейкінгу будуть обмежені.");
    }

    // ======== ЗАГАЛЬНІ ВИПРАВЛЕННЯ ========

    /**
     * Безпечне виконання функції з обробкою помилок
     * @param {Function} fn - Функція для виконання
     * @param {Array} args - Аргументи функції
     * @param {string} name - Назва функції для логування
     * @param {*} defaultValue - Значення за замовчуванням у випадку помилки
     * @returns {*} Результат виконання функції або defaultValue
     */
    function safeExecute(fn, args = [], name = 'функція', defaultValue = null) {
        try {
            if (typeof fn !== 'function') {
                console.warn(`⚠️ ${name} не є функцією`);
                return defaultValue;
            }
            return fn.apply(this, args);
        } catch (error) {
            console.warn(`⚠️ Перехоплено помилку в ${name}:`, error);
            return defaultValue;
        }
    }

    /**
     * Створення безпечного проксі для об'єкта
     * @param {Object} obj - Оригінальний об'єкт
     * @param {string} name - Назва об'єкта для логування
     * @returns {Proxy} Проксі з обробкою помилок
     */
    function createSafeProxy(obj, name = 'об\'єкт') {
        return new Proxy(obj || {}, {
            get(target, prop) {
                if (typeof target[prop] === 'function') {
                    return function(...args) {
                        return safeExecute(target[prop], args, `${name}.${prop}`);
                    };
                }
                return target[prop];
            }
        });
    }

    // ======== ВИПРАВЛЕННЯ DOM ========

    /**
     * Безпечне оновлення текстового вмісту елемента
     * @param {HTMLElement} element - Елемент DOM для оновлення
     * @param {string} content - Новий вміст
     */
    function safeUpdateContent(element, content) {
        try {
            if (element) {
                element.textContent = content !== undefined && content !== null ? content : '';
            }
        } catch (error) {
            console.warn('⚠️ Помилка оновлення вмісту елемента:', error);
        }
    }

    /**
     * Безпечне отримання елемента DOM
     * @param {string} selector - Селектор елемента
     * @param {boolean} silent - Чи приховувати помилки у консолі
     * @returns {HTMLElement|null} Знайдений елемент або null
     */
    function safeGetElement(selector, silent = false) {
        try {
            if (selector.startsWith('#')) {
                return document.getElementById(selector.substring(1));
            }
            return document.querySelector(selector);
        } catch (error) {
            if (!silent) {
                console.warn(`⚠️ Помилка отримання елемента "${selector}":`, error);
            }
            return null;
        }
    }

    /**
     * Використовується для обробки помилок MutationObserver
     */
    function fixMutationObserver() {
        try {
            const originalObserve = MutationObserver.prototype.observe;

            if (originalObserve) {
                MutationObserver.prototype.observe = function(target, options) {
                    if (!target || !(target instanceof Node)) {
                        console.warn('⚠️ Некоректний target для MutationObserver. Ігноруємо.');
                        return;
                    }

                    try {
                        return originalObserve.call(this, target, options);
                    } catch (error) {
                        console.warn('⚠️ Помилка в MutationObserver.observe:', error);
                    }
                };
            }
        } catch (error) {
            console.warn('⚠️ Не вдалося виправити MutationObserver:', error);
        }
    }

    // ======== ВИПРАВЛЕННЯ DATAnull МОДУЛІВ ========

    /**
     * Виправлення для WinixCore
     */
    function fixWinixCore() {
        if (!hasWinixCore) return;

        try {
            // Виправлення функції updateBalanceDisplay
            if (typeof window.WinixCore.updateBalanceDisplay === 'function') {
                const originalUpdateBalance = window.WinixCore.updateBalanceDisplay;

                window.WinixCore.updateBalanceDisplay = function() {
                    try {
                        return originalUpdateBalance.apply(this, arguments);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в updateBalanceDisplay:', error);

                        // Запасний метод оновлення балансу
                        try {
                            const tokensElement = safeGetElement('#user-tokens');
                            const coinsElement = safeGetElement('#user-coins');

                            if (tokensElement) {
                                const balance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
                                safeUpdateContent(tokensElement, balance.toFixed(2));
                            }

                            if (coinsElement) {
                                const coins = parseInt(localStorage.getItem('userCoins') || '0');
                                safeUpdateContent(coinsElement, coins);
                            }
                        } catch (fallbackError) {
                            console.warn('⚠️ Помилка запасного методу оновлення балансу:', fallbackError);
                        }
                    }
                };
            }

            // Виправлення функції оновлення даних користувача
            if (typeof window.WinixCore.updateUserDisplay === 'function') {
                const originalUpdateUser = window.WinixCore.updateUserDisplay;

                window.WinixCore.updateUserDisplay = function() {
                    try {
                        return originalUpdateUser.apply(this, arguments);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в updateUserDisplay:', error);

                        // Запасний метод оновлення даних користувача
                        try {
                            const userIdElement = safeGetElement('#user-id');
                            const usernameElement = safeGetElement('#username');

                            if (userIdElement) {
                                const userId = localStorage.getItem('telegram_user_id') || 'Unknown ID';
                                safeUpdateContent(userIdElement, userId);
                            }

                            if (usernameElement) {
                                const username = localStorage.getItem('username') || 'WINIX User';
                                safeUpdateContent(usernameElement, username);
                            }
                        } catch (fallbackError) {
                            console.warn('⚠️ Помилка запасного методу оновлення даних користувача:', fallbackError);
                        }
                    }
                };
            }

            // Виправлення функції синхронізації даних
            if (typeof window.WinixCore.syncUserData === 'function') {
                const originalSyncData = window.WinixCore.syncUserData;

                window.WinixCore.syncUserData = function() {
                    try {
                        return originalSyncData.apply(this, arguments);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в syncUserData:', error);

                        // Повертаємо проміс з помилкою, щоб код міг продовжуватись
                        return Promise.resolve({
                            success: false,
                            message: error.message || 'Помилка синхронізації даних',
                            source: 'local_fallback'
                        });
                    }
                };
            }
        } catch (error) {
            console.warn('⚠️ Не вдалося застосувати виправлення для WinixCore:', error);
        }
    }

    /**
     * Виправлення для WinixAPI
     */
    function fixWinixAPI() {
        if (!hasWinixAPI) return;

        try {
            // Виправлення для функції apiRequest
            if (typeof window.apiRequest === 'function') {
                const originalApiRequest = window.apiRequest;

                window.apiRequest = function(endpoint, method, data, options, retries) {
                    try {
                        // Перевірка наявності ендпоінту
                        if (!endpoint || typeof endpoint !== 'string') {
                            console.warn('⚠️ Некоректний endpoint для apiRequest:', endpoint);
                            endpoint = `/api/user/${window.WinixAPI.getUserId() || 'unknown'}`;
                        }

                        // Перевірка коректності endpoint для стейкінгу
                        if (endpoint.includes('/staking') && !endpoint.includes('/api/user/')) {
                            const userId = window.WinixAPI.getUserId() || localStorage.getItem('telegram_user_id');
                            if (userId) {
                                endpoint = `/api/user/${userId}${endpoint}`;
                                console.warn(`⚠️ Виправлено некоректний URL стейкінгу: ${endpoint}`);
                            }
                        }

                        return originalApiRequest(endpoint, method, data, options, retries);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в apiRequest:', error);

                        // Повертаємо проміс з помилкою
                        return Promise.reject(error);
                    }
                };
            }

            // Виправлення для функції getUserId
            if (typeof window.WinixAPI.getUserId === 'function') {
                const originalGetUserId = window.WinixAPI.getUserId;

                window.WinixAPI.getUserId = function() {
                    try {
                        const userId = originalGetUserId();
                        if (userId) return userId;

                        // Якщо оригінальна функція не змогла отримати ID, пробуємо з localStorage
                        const localId = localStorage.getItem('telegram_user_id');
                        if (localId && localId !== 'undefined' && localId !== 'null') {
                            return localId;
                        }

                        // Якщо і в localStorage немає, генеруємо тимчасовий ID
                        console.warn('⚠️ Не вдалося отримати ID користувача, використовуємо тимчасовий ID');
                        return '2449' + Math.floor(Math.random() * 1000000);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в getUserId:', error);
                        return '2449' + Math.floor(Math.random() * 1000000);
                    }
                };
            }

            // Виправлення локального розрахунку винагороди за стейкінг
            if (typeof window.WinixAPI.calculateExpectedReward === 'function') {
                const originalCalculateReward = window.WinixAPI.calculateExpectedReward;

                window.WinixAPI.calculateExpectedReward = function(amount, period) {
                    return new Promise((resolve) => {
                        originalCalculateReward(amount, period)
                            .then(resolve)
                            .catch(error => {
                                console.warn('⚠️ Помилка розрахунку винагороди через API, використовуємо локальний розрахунок:', error);

                                // Локальний розрахунок
                                const rewardRates = { 7: 4, 14: 9, 28: 15 };
                                const rewardPercent = rewardRates[period] || 9;
                                const reward = (amount * rewardPercent) / 100;

                                resolve({
                                    status: 'success',
                                    data: {
                                        reward: parseFloat(reward.toFixed(2)),
                                        rewardPercent: rewardPercent,
                                        amount: parseInt(amount),
                                        period: parseInt(period),
                                        source: 'local_calculation'
                                    }
                                });
                            });
                    });
                };
            }
        } catch (error) {
            console.warn('⚠️ Не вдалося застосувати виправлення для WinixAPI:', error);
        }
    }

    /**
     * Виправлення для WinixStakingSystem
     */
    function fixStakingSystem() {
        if (!hasStakingSystem) {
            // Якщо немає WinixStakingSystem, але є старий StakingSystem, створюємо проксі
            if (window.StakingSystem && !window.WinixStakingSystem) {
                console.log("ℹ️ Створення проксі StakingSystem -> WinixStakingSystem");
                window.WinixStakingSystem = createSafeProxy(window.StakingSystem, 'StakingSystem');
                return;
            }

            return;
        }

        try {
            // Виправлення функції оновлення інтерфейсу стейкінгу
            if (typeof window.WinixStakingSystem.updateUI === 'function') {
                const originalUpdateUI = window.WinixStakingSystem.updateUI;

                window.WinixStakingSystem.updateUI = function() {
                    try {
                        return originalUpdateUI.apply(this, arguments);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в updateUI стейкінгу:', error);

                        // Запасний метод оновлення інтерфейсу стейкінгу
                        try {
                            // Оновлюємо статус стейкінгу
                            const stakingStatus = safeGetElement('#staking-status');
                            const stakingData = window.WinixStakingSystem.getStakingData() ||
                                               JSON.parse(localStorage.getItem('stakingData') || localStorage.getItem('winix_staking') || '{}');

                            if (stakingStatus) {
                                if (stakingData && stakingData.hasActiveStaking) {
                                    safeUpdateContent(stakingStatus, `У стейкінгу: ${stakingData.stakingAmount || 0} $WINIX`);
                                } else {
                                    safeUpdateContent(stakingStatus, 'Наразі немає активних стейкінгів');
                                }
                            }

                            // Оновлюємо стан кнопок
                            window.WinixStakingSystem.updateButtonsState(stakingData && stakingData.hasActiveStaking);
                        } catch (fallbackError) {
                            console.warn('⚠️ Помилка запасного методу оновлення інтерфейсу стейкінгу:', fallbackError);
                        }
                    }
                };
            }

            // Виправлення функції оновлення стану кнопок
            if (typeof window.WinixStakingSystem.updateButtonsState === 'function') {
                const originalUpdateButtons = window.WinixStakingSystem.updateButtonsState;

                window.WinixStakingSystem.updateButtonsState = function(hasActiveStaking) {
                    try {
                        return originalUpdateButtons.apply(this, arguments);
                    } catch (error) {
                        console.warn('⚠️ Перехоплено помилку в updateButtonsState стейкінгу:', error);

                        // Запасний метод оновлення стану кнопок
                        try {
                            const activeStakingButton = safeGetElement('#active-staking-button');
                            const cancelStakingButton = safeGetElement('#cancel-staking-button');

                            if (activeStakingButton) {
                                if (hasActiveStaking) {
                                    activeStakingButton.classList.remove('disabled');
                                    activeStakingButton.disabled = false;
                                } else {
                                    activeStakingButton.classList.add('disabled');
                                    activeStakingButton.disabled = true;
                                }
                            }

                            if (cancelStakingButton) {
                                if (hasActiveStaking) {
                                    cancelStakingButton.style.opacity = '1';
                                    cancelStakingButton.style.pointerEvents = 'auto';
                                    cancelStakingButton.disabled = false;
                                } else {
                                    cancelStakingButton.style.opacity = '0.5';
                                    cancelStakingButton.style.pointerEvents = 'none';
                                    cancelStakingButton.disabled = true;
                                }
                            }
                        } catch (fallbackError) {
                            console.warn('⚠️ Помилка запасного методу оновлення стану кнопок стейкінгу:', fallbackError);
                        }
                    }
                };
            }
        } catch (error) {
            console.warn('⚠️ Не вдалося застосувати виправлення для WinixStakingSystem:', error);
        }
    }

    // ======== ДОДАТКОВІ УТИЛІТИ ========

    /**
     * Виправлення локального сховища
     */
    function fixLocalStorage() {
        try {
            // Перевіряємо доступність localStorage
            const testKey = '_test_ls_' + Date.now();
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);

            // Виправлення для невалідних значень
            const keysToCheck = [
                'userTokens', 'winix_balance',
                'userCoins',
                'telegram_user_id',
                'stakingData', 'winix_staking'
            ];

            for (const key of keysToCheck) {
                try {
                    const value = localStorage.getItem(key);

                    // Перевіряємо на невалідні значення
                    if (value === 'undefined' || value === 'null' || value === 'NaN') {
                        console.warn(`⚠️ Знайдено невалідне значення в localStorage[${key}]:", ${value}`);
                        localStorage.removeItem(key);
                    }

                    // Перевіряємо числові значення
                    if (key === 'userTokens' || key === 'winix_balance') {
                        const numValue = parseFloat(value);
                        if (isNaN(numValue) || numValue < 0) {
                            console.warn(`⚠️ Знайдено некоректне числове значення в localStorage[${key}]:`, value);
                            localStorage.setItem(key, '0');
                        }
                    }

                    // Перевіряємо цілочисельні значення
                    if (key === 'userCoins') {
                        const numValue = parseInt(value);
                        if (isNaN(numValue) || numValue < 0) {
                            console.warn(`⚠️ Знайдено некоректне цілочисельне значення в localStorage[${key}]:`, value);
                            localStorage.setItem(key, '0');
                        }
                    }

                    // Перевіряємо JSON значення
                    if (key === 'stakingData' || key === 'winix_staking') {
                        try {
                            if (value) {
                                JSON.parse(value);
                            }
                        } catch (e) {
                            console.warn(`⚠️ Знайдено некоректний JSON в localStorage[${key}]:`, value);
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ Помилка перевірки localStorage[${key}]:`, e);
                }
            }
        } catch (error) {
            console.warn('⚠️ localStorage недоступний або виникла помилка:', error);
        }
    }

    /**
     * Глобальний обробник помилок
     */
    function setupGlobalErrorHandler() {
        try {
            const originalOnError = window.onerror;

            window.onerror = function(message, source, lineno, colno, error) {
                // Фільтруємо помилки оновлення інтерфейсу
                if (message && (
                    message.includes('originalUpdateDisplay') ||
                    message.includes('undefined is not an object') ||
                    message.includes('cannot read property') ||
                    message.includes('null is not an object')
                )) {
                    console.warn('⚠️ Перехоплено глобальну помилку UI:', message);
                    return true; // Запобігаємо відображенню помилки в консолі
                }

                // Для інших помилок викликаємо оригінальний обробник, якщо він є
                if (typeof originalOnError === 'function') {
                    return originalOnError(message, source, lineno, colno, error);
                }

                return false; // Дозволяємо стандартну обробку помилки
            };
        } catch (error) {
            console.warn('⚠️ Не вдалося налаштувати глобальний обробник помилок:', error);
        }
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Загальна ініціалізація всіх виправлень
     */
    function init() {
        if (_initialized) return;

        try {
            // Застосовуємо виправлення
            fixMutationObserver();
            fixWinixAPI();
            fixWinixCore();
            fixStakingSystem();
            fixLocalStorage();
            setupGlobalErrorHandler();

            _initialized = true;

            console.log("✅ Виправлення для UI WINIX успішно застосовані");
        } catch (error) {
            console.error("❌ Помилка застосування виправлень для UI WINIX:", error);
        }
    }

    // Запускаємо ініціалізацію
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();