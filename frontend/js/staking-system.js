/**
 * staking-system.js
 *
 * Єдина система управління стейкінгом для WINIX
 * Замінює staking-buttons-fix.js і emergency-staking.js
 */

(function() {
    console.log("🚀 Ініціалізація єдиної системи стейкінгу WINIX");

    // Запобігаємо повторній ініціалізації
    if (window.WinixStakingSystem) {
        console.log("⚠️ Система стейкінгу вже ініціалізована");
        return window.WinixStakingSystem;
    }

    // --------------- ПРИВАТНІ ЗМІННІ ---------------

    // Глобальний прапорець для запобігання одночасним запитам
    let _isProcessingStakingAction = false;

    // Налаштування стейкінгу
    const STAKING_CONFIG = {
        minAmount: 50,                 // Мінімальна сума стейкінгу
        maxBalancePercentage: 0.9,     // Максимально дозволений відсоток від балансу
        allowedPeriods: [7, 14, 28],   // Дозволені періоди стейкінгу
        rewardRates: {
            7: 4,    // 4% за 7 днів
            14: 9,   // 9% за 14 днів
            28: 15   // 15% за 28 днів
        },
        cancellationFee: 0.2  // Штраф при скасуванні (20%)
    };

    // Ключі для локального сховища
    const STORAGE_KEYS = {
        USER_TOKENS: 'userTokens',
        WINIX_BALANCE: 'winix_balance',
        STAKING_DATA: 'stakingData',
        WINIX_STAKING: 'winix_staking',
        STAKING_HISTORY: 'stakingHistory'
    };

    // --------------- ДОПОМІЖНІ ФУНКЦІЇ ---------------

    /**
     * Отримання ідентифікатора користувача з різних можливих джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        return localStorage.getItem('telegram_user_id') ||
               (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);
    }

    /**
     * Безпечне отримання даних з локального сховища
     * @param {string} key - Ключ для отримання даних
     * @param {*} defaultValue - Значення за замовчуванням
     * @param {boolean} parse - Чи потрібно парсити JSON
     * @returns {*} Отримані дані або значення за замовчуванням
     */
    function getFromStorage(key, defaultValue = null, parse = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return parse ? JSON.parse(value) : value;
        } catch (e) {
            console.error(`Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Безпечне збереження даних у всі сховища
     * @param {string} key - Ключ для збереження
     * @param {*} value - Значення для збереження
     * @returns {boolean} Результат операції
     */
    function updateStorage(key, value) {
        try {
            // Перетворюємо на рядок, якщо це об'єкт
            const valueToStore = typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value);

            // Зберігаємо в localStorage
            localStorage.setItem(key, valueToStore);

            // Зберігаємо в sessionStorage (якщо доступне)
            try { sessionStorage.setItem(key, valueToStore); } catch(e) {}

            // Оновлюємо альтернативні ключі
            if (key === STORAGE_KEYS.STAKING_DATA) {
                localStorage.setItem(STORAGE_KEYS.WINIX_STAKING, valueToStore);
                try { sessionStorage.setItem(STORAGE_KEYS.WINIX_STAKING, valueToStore); } catch(e) {}
            }
            else if (key === STORAGE_KEYS.USER_TOKENS) {
                localStorage.setItem(STORAGE_KEYS.WINIX_BALANCE, valueToStore);
                try { sessionStorage.setItem(STORAGE_KEYS.WINIX_BALANCE, valueToStore); } catch(e) {}
            }

            return true;
        } catch (e) {
            console.error(`Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Видалення даних з усіх сховищ
     * @param {string} key - Ключ для видалення
     */
    function removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
            try { sessionStorage.removeItem(key); } catch(e) {}

            // Видаляємо альтернативні ключі
            if (key === STORAGE_KEYS.STAKING_DATA) {
                localStorage.removeItem(STORAGE_KEYS.WINIX_STAKING);
                try { sessionStorage.removeItem(STORAGE_KEYS.WINIX_STAKING); } catch(e) {}
            }
            else if (key === STORAGE_KEYS.USER_TOKENS) {
                localStorage.removeItem(STORAGE_KEYS.WINIX_BALANCE);
                try { sessionStorage.removeItem(STORAGE_KEYS.WINIX_BALANCE); } catch(e) {}
            }
        } catch (e) {
            console.error(`Помилка видалення ${key} з localStorage:`, e);
        }
    }

    /**
     * Отримання поточного балансу користувача
     * @returns {number} Поточний баланс
     */
    function getUserBalance() {
        const balance = parseFloat(getFromStorage(STORAGE_KEYS.USER_TOKENS, '0'));
        return isNaN(balance) ? 0 : balance;
    }

    /**
     * Показати користувацьке сповіщення
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи це помилка
     * @param {Function} callback - Функція, яка викликається після закриття
     */
    function showAlert(message, isError = false, callback = null) {
        console.log(`${isError ? "❌" : "✅"} ${message}`);

        // Спочатку перевіряємо наявність функцій WinixCore
        if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
            return window.WinixCore.UI.showNotification(message, isError ? 'error' : 'success', callback);
        }

        // Потім перевіряємо інші можливі функції
        if (window.simpleAlert) {
            return window.simpleAlert(message, isError, callback);
        }

        if (window.winixUI && window.winixUI.simpleAlert) {
            return window.winixUI.simpleAlert(message, isError, callback);
        }

        // Запасний варіант - звичайний alert
        alert(message);
        if (typeof callback === 'function') {
            setTimeout(callback, 100);
        }

        return new Promise(resolve => {
            if (typeof callback === 'function') {
                callback();
            }
            resolve();
        });
    }

    /**
     * Функція для створення модального вікна з введенням суми
     * @param {string} title - Заголовок вікна
     * @param {Function} onConfirm - Функція, яка викликається після підтвердження
     */
    function showInputModal(title, onConfirm) {
        // Перевіряємо наявність різних функцій
        if (window.createInputModal) {
            return window.createInputModal(title, onConfirm);
        }

        if (window.winixUI && window.winixUI.createInputModal) {
            return window.winixUI.createInputModal(title, onConfirm);
        }

        // Запасний варіант - prompt
        const amount = prompt(title || "Введіть суму:");
        if (amount !== null && !isNaN(amount) && parseInt(amount) > 0) {
            onConfirm(parseInt(amount));
        }
    }

    /**
     * Функція для валідації суми стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} balance - Поточний баланс користувача
     * @returns {Object} Результат валідації
     */
    function validateStakingAmount(amount, balance) {
        // Перевірка на число
        if (isNaN(amount) || amount <= 0) {
            return {
                isValid: false,
                message: "Введіть коректну суму більше нуля"
            };
        }

        // Перевірка, що сума є цілим числом
        if (amount !== Math.floor(amount)) {
            return {
                isValid: false,
                message: "Сума стейкінгу має бути цілим числом"
            };
        }

        // Перевірка на мінімальну суму
        if (amount < STAKING_CONFIG.minAmount) {
            return {
                isValid: false,
                message: `Мінімальна сума стейкінгу: ${STAKING_CONFIG.minAmount} WINIX`
            };
        }

        // Перевірка на максимальну суму відносно балансу
        const maxAllowedAmount = Math.floor(balance * STAKING_CONFIG.maxBalancePercentage);
        if (amount > maxAllowedAmount) {
            return {
                isValid: false,
                message: `Максимальна сума: ${maxAllowedAmount} WINIX (${STAKING_CONFIG.maxBalancePercentage*100}% від балансу)`
            };
        }

        // Перевірка на достатність балансу
        if (amount > balance) {
            return {
                isValid: false,
                message: `Недостатньо коштів. Ваш баланс: ${balance} WINIX`
            };
        }

        return {
            isValid: true,
            message: ""
        };
    }

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {number} Очікувана винагорода
     */
    function calculateExpectedReward(amount, period) {
        try {
            // Базова перевірка даних
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || isNaN(period) || amount <= 0 || period <= 0) {
                return 0;
            }

            // Отримуємо відсоток відповідно до періоду
            const rewardPercent = STAKING_CONFIG.rewardRates[period] || 9; // За замовчуванням 9%

            // Розраховуємо винагороду
            const reward = (amount * rewardPercent) / 100;

            return parseFloat(reward.toFixed(2));
        } catch (e) {
            console.error('Помилка розрахунку винагороди:', e);
            return 0;
        }
    }

    // --------------- ОСНОВНІ ФУНКЦІЇ СТЕЙКІНГУ ---------------

    /**
     * Отримання даних стейкінгу
     * @returns {Object} Дані активного стейкінгу
     */
    function getStakingData() {
        // Отримуємо дані з локального сховища
        const stakingData = getFromStorage(STORAGE_KEYS.STAKING_DATA, null, true);

        // Синхронізуємо з сервером у фоні
        syncStakingFromServer().catch(error => console.error("Помилка синхронізації стейкінгу:", error));

        // Якщо немає даних, повертаємо об'єкт за замовчуванням
        if (!stakingData) {
            return {
                hasActiveStaking: false,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };
        }

        return stakingData;
    }

    /**
     * Перевірка наявності активного стейкінгу
     * @returns {boolean} Чи є активний стейкінг
     */
    function hasActiveStaking() {
        const stakingData = getFromStorage(STORAGE_KEYS.STAKING_DATA, null, true);
        return stakingData && stakingData.hasActiveStaking === true;
    }

    /**
     * Синхронізація даних стейкінгу з сервера
     * @returns {Promise} Проміс з результатом синхронізації
     */
    async function syncStakingFromServer() {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            const response = await fetch(`/api/user/${userId}/staking?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data) {
                // Зберігаємо отримані дані
                updateStorage(STORAGE_KEYS.STAKING_DATA, data.data);

                // Оновлюємо відображення, якщо існує відповідна функція
                if (typeof updateStakingDisplay === 'function') {
                    updateStakingDisplay();
                }

                return data.data;
            }

            throw new Error("Неочікувана відповідь сервера");
        } catch (error) {
            console.error("Помилка синхронізації стейкінгу:", error);
            throw error;
        }
    }

    /**
     * Синхронізація історії стейкінгу з сервера
     * @returns {Promise} Проміс з результатом синхронізації
     */
    async function syncStakingHistoryFromServer() {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            const response = await fetch(`/api/user/${userId}/staking/history?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.data)) {
                // Зберігаємо отриману історію
                updateStorage(STORAGE_KEYS.STAKING_HISTORY, data.data);
                return data.data;
            }

            throw new Error("Неочікувана відповідь сервера");
        } catch (error) {
            console.error("Помилка синхронізації історії стейкінгу:", error);
            throw error;
        }
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise} Проміс з результатом операції
     */
    async function createStaking(amount, period) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            const userId = getUserId();
            if (!userId) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "ID користувача не знайдено"
                };
            }

            // Перевіряємо суму через функцію валідації
            const balance = getUserBalance();
            const validation = validateStakingAmount(amount, balance);

            if (!validation.isValid) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: validation.message
                };
            }

            // Відправляємо запит на сервер
            const response = await fetch(`/api/user/${userId}/staking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stakingAmount: Math.floor(amount),
                    period: period
                })
            });

            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Зберігаємо дані стейкінгу
                if (result.data && result.data.staking) {
                    updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                }

                // Оновлюємо баланс
                if (result.data && result.data.balance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.balance);
                }

                return {
                    success: true,
                    message: "Стейкінг успішно створено",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка створення стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка створення стейкінгу:", error);
            return {
                success: false,
                message: "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Додавання коштів до стейкінгу
     * @param {number} amount - Сума для додавання
     * @returns {Promise} Проміс з результатом операції
     */
    async function addToStaking(amount) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            const userId = getUserId();
            if (!userId) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "ID користувача не знайдено"
                };
            }

            // Отримуємо дані стейкінгу
            const stakingDataResponse = await fetch(`/api/user/${userId}/staking?t=${Date.now()}`);
            if (!stakingDataResponse.ok) {
                throw new Error(`Помилка запиту стейкінгу: ${stakingDataResponse.status}`);
            }

            const stakingDataResult = await stakingDataResponse.json();

            // Перевіряємо наявність активного стейкінгу (виправлена перевірка)
            if (stakingDataResult.status !== 'success' || !stakingDataResult.data || !stakingDataResult.data.hasActiveStaking) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "У вас немає активного стейкінгу"
                };
            }

            const stakingData = stakingDataResult.data;
            const stakingId = stakingData.stakingId;

            // Перевіряємо суму через функцію валідації
            const balance = getUserBalance();
            const validation = validateStakingAmount(amount, balance);

            if (!validation.isValid) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: validation.message
                };
            }

            // Відправляємо запит на сервер
            const response = await fetch(`/api/user/${userId}/staking/${stakingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    additionalAmount: Math.floor(amount)
                })
            });

            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Оновлюємо дані стейкінгу
                if (result.data && result.data.staking) {
                    updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                }

                // Оновлюємо баланс
                if (result.data && result.data.balance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.balance);
                }

                return {
                    success: true,
                    message: `Додано ${amount} WINIX до стейкінгу`,
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка додавання до стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка додавання до стейкінгу:", error);
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Скасування стейкінгу
     * @returns {Promise} Проміс з результатом операції
     */
    async function cancelStaking() {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            const userId = getUserId();
            if (!userId) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "ID користувача не знайдено"
                };
            }

            // Отримуємо дані стейкінгу
            const stakingDataResponse = await fetch(`/api/user/${userId}/staking?t=${Date.now()}`);
            if (!stakingDataResponse.ok) {
                throw new Error(`Помилка запиту стейкінгу: ${stakingDataResponse.status}`);
            }

            const stakingDataResult = await stakingDataResponse.json();

            // Перевіряємо наявність активного стейкінгу (виправлена перевірка)
            if (stakingDataResult.status !== 'success' || !stakingDataResult.data || !stakingDataResult.data.hasActiveStaking) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "У вас немає активного стейкінгу"
                };
            }

            const stakingData = stakingDataResult.data;
            const stakingId = stakingData.stakingId;

            // Відправляємо запит на сервер
            const response = await fetch(`/api/user/${userId}/staking/${stakingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    timestamp: Date.now() // Додаємо timestamp для запобігання кешуванню
                })
            });

            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Видаляємо дані стейкінгу з УСІХ місць
                removeFromStorage(STORAGE_KEYS.STAKING_DATA);

                // Оновлюємо баланс
                if (result.data && result.data.newBalance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.newBalance);
                }

                return {
                    success: true,
                    message: result.message || "Стейкінг успішно скасовано",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка скасування стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка скасування стейкінгу:", error);
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Аварійне відновлення стейкінгу
     * @param {boolean} forceReset - Примусово скинути стейкінг
     * @returns {Promise} Проміс з результатом операції
     */
    async function repairStaking(forceReset = false) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            const userId = getUserId();
            if (!userId) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "ID користувача не знайдено"
                };
            }

            // Відправляємо запит на сервер
            const response = await fetch(`/api/user/${userId}/staking/repair`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    force: forceReset,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Оновлюємо дані в локальному сховищі
                if (result.data && result.data.staking) {
                    updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                } else {
                    // Якщо стейкінг скасовано, видаляємо дані
                    removeFromStorage(STORAGE_KEYS.STAKING_DATA);
                }

                // Оновлюємо баланс
                if (result.data && result.data.newBalance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.newBalance);
                }

                return {
                    success: true,
                    message: result.message || "Стейкінг успішно відновлено",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка відновлення стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка відновлення стейкінгу:", error);
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Глибоке відновлення стейкінгу
     * @param {number} adjustBalance - Коригування балансу
     * @returns {Promise} Проміс з результатом операції
     */
    async function deepRepairStaking(adjustBalance = 0) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            const userId = getUserId();
            if (!userId) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "ID користувача не знайдено"
                };
            }

            // Відправляємо запит на сервер
            const response = await fetch(`/api/user/${userId}/staking/deep-repair`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    balance_adjustment: adjustBalance,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Видаляємо всі дані стейкінгу
                removeFromStorage(STORAGE_KEYS.STAKING_DATA);

                // Оновлюємо баланс
                if (result.data && result.data.new_balance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.new_balance);
                }

                return {
                    success: true,
                    message: result.message || "Стейкінг успішно відновлено",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка глибокого відновлення стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка глибокого відновлення стейкінгу:", error);
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Оновлення очікуваної винагороди через API
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу
     * @returns {Promise<number>} Очікувана винагорода
     */
    async function getExpectedRewardFromServer(amount, period) {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            // Базова перевірка даних
            amount = parseInt(amount);
            period = parseInt(period);

            if (isNaN(amount) || isNaN(period) || amount <= 0 || !STAKING_CONFIG.allowedPeriods.includes(period)) {
                return calculateExpectedReward(amount, period);
            }

            // Відправляємо запит на сервер
            const response = await fetch(`/api/user/${userId}/staking/calculate-reward?amount=${amount}&period=${period}&t=${Date.now()}`);

            if (!response.ok) {
                throw new Error(`Помилка запиту: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success' && result.data && typeof result.data.reward === 'number') {
                return parseFloat(result.data.reward.toFixed(2));
            }

            // Якщо щось пішло не так, використовуємо локальний розрахунок
            return calculateExpectedReward(amount, period);
        } catch (error) {
            console.error("Помилка отримання очікуваної винагороди:", error);
            // Якщо помилка, використовуємо локальний розрахунок
            return calculateExpectedReward(amount, period);
        }
    }
    // --------------- ОБРОБНИКИ ПОДІЙ ДЛЯ СТОРІНОК ---------------

    /**
     * Обробник кнопки "Застейкати"
     */
    function handleStakeButton() {
        // Запобігаємо повторному відкриттю
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("💰 Обробка створення стейкінгу");

        try {
            // Отримуємо значення з полів
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');

            if (!amountInput || !periodSelect) {
                showAlert("Не вдалося знайти поля для стейкінгу", true);
                return;
            }

            // Отримуємо значення без власної валідації
            const amount = parseInt(amountInput.value, 10);
            const period = parseInt(periodSelect.value, 10);

            // Блокуємо кнопку
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) stakeButton.disabled = true;

            // Створюємо стейкінг через основну функцію
            createStaking(amount, period)
                .then(result => {
                    if (stakeButton) stakeButton.disabled = false;

                    if (result.success) {
                        // Показуємо повідомлення про успіх
                        showAlert("Стейкінг успішно створено!", false, function() {
                            window.location.href = "staking-details.html";
                        });
                    } else {
                        showAlert(result.message || "Помилка створення стейкінгу", true);
                    }
                })
                .catch(error => {
                    console.error("Помилка при створенні стейкінгу:", error);
                    if (stakeButton) stakeButton.disabled = false;
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                });
        } catch (error) {
            console.error("Помилка при обробці кнопки створення стейкінгу:", error);
            showAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    /**
     * Обробник кнопки "Додати до стейкінгу"
     */
    function handleAddToStakeButton() {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("💰 Підготовка до додавання коштів до стейкінгу");

        // Стаємо інтерактивний режим
        _isProcessingStakingAction = true;

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            showAlert("Не вдалося визначити ID користувача", true);
            _isProcessingStakingAction = false;
            return;
        }

        // Показуємо модальне вікно для введення суми
        showInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
            // Блокуємо всі кнопки
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => { if (btn) btn.disabled = true; });

            // Додаємо кошти до стейкінгу через основну функцію
            addToStaking(amount)
                .then(result => {
                    // Розблоковуємо кнопки
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });

                    if (result.success) {
                        // Показуємо повідомлення та перезавантажуємо сторінку
                        showAlert(`Додано ${amount} $WINIX до стейкінгу`, false, function() {
                            window.location.reload();
                        });
                    } else {
                        showAlert(result.message || "Помилка додавання до стейкінгу", true);
                        _isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    console.error("Помилка при додаванні до стейкінгу:", error);
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                    _isProcessingStakingAction = false;
                });
        });
    }

    /**
     * Обробник кнопки "Скасувати стейкінг"
     */
    function handleCancelStakingButton() {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("🗑️ Обробка скасування стейкінгу");
        _isProcessingStakingAction = true;

        // Запитуємо підтвердження
        if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.")) {
            // Блокуємо всі кнопки
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => { if (btn) btn.disabled = true; });

            // Скасовуємо стейкінг через основну функцію
            cancelStaking()
                .then(result => {
                    // Розблоковуємо кнопки
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });

                    if (result.success) {
                        // Показуємо повідомлення про успіх і перенаправляємо
                        showAlert(result.message || "Стейкінг успішно скасовано", false, function() {
                            // Визначаємо поточну сторінку та перенаправляємо відповідно
                            const currentPage = window.location.pathname.split('/').pop();
                            if (currentPage === 'staking-details.html') {
                                window.location.href = "wallet.html";
                            } else {
                                window.location.reload();
                            }
                        });
                    } else {
                        showAlert(result.message || "Помилка скасування стейкінгу", true);
                        _isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    console.error("Помилка при скасуванні стейкінгу:", error);
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                    _isProcessingStakingAction = false;
                });
        } else {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Обробник кнопки "Деталі стейкінгу"
     */
    function handleDetailsButton() {
        console.log("📋 Перехід до деталей стейкінгу");

        try {
            // Отримуємо дані стейкінгу локально
            const stakingData = getStakingData();

            // Якщо є активний стейкінг, переходимо на сторінку деталей
            if (stakingData && stakingData.hasActiveStaking) {
                window.location.href = "staking-details.html";
            } else {
                showAlert("У вас немає активного стейкінгу", true);
            }
        } catch (error) {
            console.error("Помилка при обробці кнопки деталей:", error);
            showAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    /**
     * Функція для встановлення максимальної суми стейкінгу
     */
    function setMaxStakingAmount() {
        try {
            // Отримуємо поточний баланс
            const balance = getUserBalance();

            // Обчислюємо максимально дозволену суму (90% від балансу)
            const maxAllowed = Math.floor(balance * STAKING_CONFIG.maxBalancePercentage);

            // Встановлюємо значення в поле вводу
            const amountInput = document.getElementById('staking-amount');
            if (amountInput) {
                amountInput.value = maxAllowed > 0 ? maxAllowed.toString() : '0';

                // Запускаємо перерахунок очікуваної винагороди
                updateExpectedReward();
            }
        } catch (e) {
            console.error('Помилка при встановленні максимальної суми:', e);
        }
    }

    /**
     * Оновлення очікуваної винагороди на сторінці
     */
    function updateExpectedReward() {
        const amountInput = document.getElementById('staking-amount');
        const periodSelect = document.getElementById('staking-period');
        const rewardDisplay = document.getElementById('expected-reward');

        if (!amountInput || !periodSelect || !rewardDisplay) return;

        // Отримуємо значення з полів
        const amount = parseInt(amountInput.value, 10) || 0;
        const period = parseInt(periodSelect.value, 10) || 14;

        if (amount <= 0) {
            rewardDisplay.textContent = '0.00';
            return;
        }

        // Отримуємо очікувану винагороду з сервера
        getExpectedRewardFromServer(amount, period)
            .then(reward => {
                rewardDisplay.textContent = reward.toFixed(2);
            })
            .catch(error => {
                console.error('Помилка отримання очікуваної винагороди:', error);

                // Використовуємо локальний розрахунок
                const localReward = calculateExpectedReward(amount, period);
                rewardDisplay.textContent = localReward.toFixed(2);
            });
    }

    /**
     * Оновлення відображення стейкінгу на сторінці
     */
    function updateStakingDisplay() {
        try {
            // Отримуємо дані стейкінгу
            const stakingData = getStakingData();
            const hasStaking = stakingData && stakingData.hasActiveStaking;

            console.log("🔄 Оновлення відображення стейкінгу:", hasStaking);

            // Якщо ми на сторінці стейкінгу
            if (window.location.href.includes('staking.html')) {
                // Оновлюємо статус стейкінгу
                const statusElement = document.getElementById('staking-status');
                if (statusElement) {
                    statusElement.textContent = hasStaking
                        ? `У стейкінгу: ${stakingData.stakingAmount} $WINIX`
                        : "Наразі немає активних стейкінгів";
                }

                // Оновлюємо видимість кнопок
                const detailsButton = document.getElementById('details-button');
                const cancelButton = document.getElementById('cancel-staking-button');

                if (detailsButton) {
                    detailsButton.style.opacity = hasStaking ? '1' : '0.5';
                    detailsButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                }

                if (cancelButton) {
                    cancelButton.style.opacity = hasStaking ? '1' : '0.5';
                    cancelButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                }
            }
            // Якщо ми на сторінці деталей стейкінгу
            else if (window.location.href.includes('staking-details.html')) {
                // Якщо немає активного стейкінгу, перенаправляємо на сторінку стейкінгу
                if (!hasStaking) {
                    showAlert("У вас немає активного стейкінгу", false, function() {
                        window.location.href = "staking.html";
                    });
                    return;
                }

                // Оновлюємо елементи інтерфейсу
                const amountElement = document.getElementById('staking-amount');
                const periodElement = document.getElementById('staking-period');
                const rewardPercentElement = document.getElementById('staking-reward-percent');
                const expectedRewardElement = document.getElementById('staking-expected-reward');
                const remainingDaysElement = document.getElementById('staking-remaining-days');

                if (amountElement) amountElement.textContent = `${stakingData.stakingAmount} $WINIX`;
                if (periodElement) periodElement.textContent = `${stakingData.period} днів`;
                if (rewardPercentElement) rewardPercentElement.textContent = `${stakingData.rewardPercent}%`;
                if (expectedRewardElement) expectedRewardElement.textContent = `${stakingData.expectedReward} $WINIX`;
                if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays ? stakingData.remainingDays.toString() : '0';
            }
            // Якщо ми на головній сторінці гаманця
            else if (window.location.href.includes('wallet.html')) {
                // Оновлюємо інформацію про стейкінг
                const stakingBalanceElement = document.getElementById('staking-amount');
                const stakingRewardsElement = document.getElementById('rewards-amount');

                if (stakingBalanceElement) {
                    stakingBalanceElement.textContent = hasStaking ? stakingData.stakingAmount.toString() : '0';
                }

                if (stakingRewardsElement) {
                    stakingRewardsElement.textContent = hasStaking ? stakingData.expectedReward.toString() : '0';
                }
            }
        } catch (e) {
            console.error('Помилка оновлення відображення стейкінгу:', e);
        }
    }

    /**
     * Функція для налаштування поля введення суми та розрахунку винагороди
     */
    function setupStakingAmountInput() {
        try {
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');

            if (amountInput) {
                // Дозволяємо тільки цілі числа
                amountInput.addEventListener('input', function() {
                    // Заміна всіх нецифрових символів
                    this.value = this.value.replace(/[^0-9]/g, '');

                    // Оновлення розрахунку винагороди
                    updateExpectedReward();
                });
            }

            if (periodSelect) {
                periodSelect.addEventListener('change', updateExpectedReward);
            }

            // Початковий розрахунок
            updateExpectedReward();
        } catch (e) {
            console.error('Помилка при налаштуванні полів стейкінгу:', e);
        }
    }

    /**
     * Показати кнопку аварійного відновлення стейкінгу
     */
    function showEmergencyButton() {
        // Створюємо кнопку відновлення
        const recoveryButton = document.createElement('button');
        recoveryButton.textContent = 'Відновити стейкінг';
        recoveryButton.className = 'recovery-button';
        recoveryButton.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 20px;
            background: linear-gradient(90deg, #FF5722, #E91E63);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            border: none;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            cursor: pointer;
        `;

        // Додаємо обробник події
        recoveryButton.addEventListener('click', function() {
            showRecoveryDialog();
        });

        // Додаємо кнопку на сторінку
        document.body.appendChild(recoveryButton);
    }

    /**
     * Показати діалог аварійного відновлення
     */
    function showRecoveryDialog() {
        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'recovery-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Створюємо контент модального вікна
        const modalContent = document.createElement('div');
        modalContent.className = 'recovery-modal-content';
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #263238, #37474F);
            padding: 25px;
            border-radius: 15px;
            width: 80%;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            color: white;
            text-align: center;
        `;

        // Заголовок
        const title = document.createElement('h2');
        title.textContent = 'Відновлення стейкінгу';
        title.style.marginBottom = '20px';

        // Опис
        const description = document.createElement('p');
        description.textContent = 'Виберіть тип відновлення стейкінгу:';
        description.style.marginBottom = '20px';

        // Стандартне відновлення
        const standardButton = document.createElement('button');
        standardButton.textContent = 'Стандартне відновлення';
        standardButton.style.cssText = `
            display: block;
            width: 100%;
            padding: 15px;
            margin: 10px 0;
            background: linear-gradient(90deg, #4CAF50, #2196F3);
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
        `;

        // Глибоке відновлення
        const deepButton = document.createElement('button');
        deepButton.textContent = 'Глибоке відновлення';
        deepButton.style.cssText = `
            display: block;
            width: 100%;
            padding: 15px;
            margin: 10px 0;
            background: linear-gradient(90deg, #FF9800, #F44336);
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
        `;

        // Кнопка скасування
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Скасувати';
        cancelButton.style.cssText = `
            display: block;
            width: 100%;
            padding: 15px;
            margin: 10px 0;
            background: rgba(255,255,255,0.1);
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
        `;

        // Додаємо обробники подій
        standardButton.addEventListener('click', function() {
            handleEmergencyRepair(false);
            modal.remove();
        });

        deepButton.addEventListener('click', function() {
            handleDeepEmergencyRepair();
            modal.remove();
        });

        cancelButton.addEventListener('click', function() {
            modal.remove();
        });

        // Складаємо все разом
        modalContent.appendChild(title);
        modalContent.appendChild(description);
        modalContent.appendChild(standardButton);
        modalContent.appendChild(deepButton);
        modalContent.appendChild(cancelButton);
        modal.appendChild(modalContent);

        // Додаємо до сторінки
        document.body.appendChild(modal);
    }

    /**
     * Обробник стандартного аварійного відновлення
     */
    function handleEmergencyRepair(force = false) {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        _isProcessingStakingAction = true;

        // Показуємо індикатор завантаження
        showProgressIndicator("Відновлення стейкінгу...");

        // Викликаємо функцію аварійного відновлення
        repairStaking(force)
            .then(result => {
                hideProgressIndicator();

                if (result.success) {
                    // Оновлюємо дані в локальному сховищі
                    if (result.data && result.data.staking) {
                        updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                    } else {
                        removeFromStorage(STORAGE_KEYS.STAKING_DATA);
                    }

                    // Оновлюємо баланс
                    if (result.data && result.data.newBalance !== undefined) {
                        updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.newBalance);
                    }

                    // Показуємо повідомлення про успіх
                    showAlert(result.message || "Стейкінг успішно відновлено", false, function() {
                        window.location.reload();
                    });
                } else {
                    showAlert(result.message || "Помилка відновлення стейкінгу", true);
                    _isProcessingStakingAction = false;
                }
            })
            .catch(error => {
                hideProgressIndicator();
                showAlert("Помилка виконання запиту: " + error.message, true);
                console.error('Помилка відновлення стейкінгу:', error);
                _isProcessingStakingAction = false;
            });
    }

    /**
     * Обробник глибокого аварійного відновлення
     */
    function handleDeepEmergencyRepair() {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        // Запитуємо користувача про коригування балансу
        const adjustmentStr = prompt('Введіть суму для коригування балансу (додатна - додати, від\'ємна - відняти, 0 - без змін):', '0');
        const adjustment = parseFloat(adjustmentStr);

        if (isNaN(adjustment)) {
            alert('Введено некоректне значення. Спробуйте ще раз.');
            return;
        }

        // Запитуємо підтвердження
        if (!confirm(`Увага! Глибоке відновлення видалить ВСЮ історію стейкінгу і ${
            adjustment > 0 ? `додасть ${adjustment}` : 
            adjustment < 0 ? `відніме ${-adjustment}` : 
            'не змінить'
        } WINIX до вашого балансу. Продовжити?`)) {
            return;
        }

        _isProcessingStakingAction = true;

        // Показуємо індикатор завантаження
        showProgressIndicator("Виконується глибоке відновлення...");

        // Викликаємо функцію глибокого відновлення
        deepRepairStaking(adjustment)
            .then(result => {
                hideProgressIndicator();

                if (result.success) {
                    // Видаляємо всі дані стейкінгу
                    removeFromStorage(STORAGE_KEYS.STAKING_DATA);

                    // Оновлюємо баланс
                    if (result.data && result.data.new_balance !== undefined) {
                        updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.new_balance);
                    }

                    // Показуємо повідомлення про успіх
                    showAlert(result.message || "Стейкінг успішно відновлено", false, function() {
                        window.location.reload();
                    });
                } else {
                    showAlert(result.message || "Помилка глибокого відновлення стейкінгу", true);
                    _isProcessingStakingAction = false;
                }
            })
            .catch(error => {
                hideProgressIndicator();
                showAlert("Помилка виконання запиту: " + error.message, true);
                console.error('Помилка глибокого відновлення стейкінгу:', error);
                _isProcessingStakingAction = false;
            });
    }

    /**
     * Показати індикатор завантаження
     */
    function showProgressIndicator(message) {
        // Видаляємо попередні індикатори
        hideProgressIndicator();

        // Створюємо елемент
        const progressElement = document.createElement('div');
        progressElement.id = 'staking-progress-indicator';
        progressElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-size: 18px;
        `;

        // Додаємо спіннер
        const spinner = document.createElement('div');
        spinner.className = 'staking-spinner';
        spinner.style.cssText = `
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        `;

        // Додаємо стилі для анімації
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Додаємо повідомлення
        const messageElement = document.createElement('div');
        messageElement.textContent = message;

        // Складаємо все разом
        progressElement.appendChild(spinner);
        progressElement.appendChild(messageElement);
        document.body.appendChild(progressElement);
    }

    /**
     * Сховати індикатор завантаження
     */
    function hideProgressIndicator() {
        const progressElement = document.getElementById('staking-progress-indicator');
        if (progressElement) {
            progressElement.remove();
        }
    }

    // --------------- ІНІЦІАЛІЗАЦІЯ СИСТЕМИ ---------------

    /**
     * Ініціалізація системи стейкінгу на різних сторінках
     */
    function initStakingSystem() {
        console.log("🔧 Ініціалізація системи стейкінгу");

        // Визначаємо поточну сторінку
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Налаштовуємо обробники на основі поточної сторінки
        if (currentPage === 'staking.html') {
            console.log("📋 Ініціалізація сторінки стейкінгу");

            // Налаштовуємо основні кнопки
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) {
                stakeButton.addEventListener('click', handleStakeButton);
            }

            const detailsButton = document.getElementById('details-button');
            if (detailsButton) {
                detailsButton.addEventListener('click', handleDetailsButton);
            }

            const cancelButton = document.getElementById('cancel-staking-button');
            if (cancelButton) {
                cancelButton.addEventListener('click', handleCancelStakingButton);
            }

            const maxButton = document.getElementById('max-button');
            if (maxButton) {
                maxButton.addEventListener('click', setMaxStakingAmount);
            }

            // Налаштовуємо поле введення суми
            setupStakingAmountInput();

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();

            // Показуємо кнопку аварійного відновлення
            showEmergencyButton();
        }
        else if (currentPage === 'staking-details.html') {
            console.log("📋 Ініціалізація сторінки деталей стейкінгу");

            // Налаштовуємо основні кнопки
            const addToStakeButton = document.getElementById('add-to-stake-button');
            if (addToStakeButton) {
                addToStakeButton.addEventListener('click', handleAddToStakeButton);
            }

            const cancelButton = document.getElementById('cancel-staking-button');
            if (cancelButton) {
                cancelButton.addEventListener('click', handleCancelStakingButton);
            }

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();

            // Показуємо кнопку аварійного відновлення
            showEmergencyButton();
        }
        else if (currentPage === 'wallet.html') {
            console.log("📋 Ініціалізація стейкінгу на сторінці гаманця");

            // Налаштовуємо кнопку стейкінгу
            const stakingButton = document.getElementById('staking-button');
            if (stakingButton) {
                stakingButton.addEventListener('click', function() {
                    window.location.href = 'staking.html';
                });
            }

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();
        }

        // Перевіряємо необхідність ручної синхронізації даних стейкінгу
        syncStakingFromServer().catch(error => console.error("Помилка синхронізації стейкінгу:", error));
    }

    // Запускаємо ініціалізацію після завантаження DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStakingSystem);
    } else {
        initStakingSystem();
    }

    // Запускаємо при подіях Winix
    document.addEventListener('winix-initialized', initStakingSystem);
    document.addEventListener('winix-core-initialized', initStakingSystem);

    // --------------- ПУБЛІЧНЕ API ---------------

    // Створюємо публічний API для системи стейкінгу
    window.WinixStakingSystem = {
        // Основні функції
        getStakingData,
        hasActiveStaking,
        syncStakingFromServer,
        syncStakingHistoryFromServer,
        createStaking,
        addToStaking,
        cancelStaking,
        repairStaking,
        deepRepairStaking,
        getExpectedRewardFromServer,
        calculateExpectedReward,

        // Обробники подій для кнопок
        handleStakeButton,
        handleAddToStakeButton,
        handleCancelStakingButton,
        handleDetailsButton,

        // Допоміжні функції
        updateStakingDisplay,
        updateExpectedReward,
        setMaxStakingAmount,

        // Аварійне відновлення
        showEmergencyButton,
        showRecoveryDialog,

        // Конфігурація
        CONFIG: STAKING_CONFIG
    };

    // Створюємо глобальні функції для підтримки старих скриптів
    window.handleStakeButton = handleStakeButton;
    window.handleAddToStakeButton = handleAddToStakeButton;
    window.handleCancelStakingButton = handleCancelStakingButton;
    window.handleDetailsButton = handleDetailsButton;
    window.updateStakingDisplay = updateStakingDisplay;
    window.updateExpectedReward = updateExpectedReward;
    window.setMaxStakingAmount = setMaxStakingAmount;

    console.log("✅ Систему стейкінгу успішно ініціалізовано");

    return window.WinixStakingSystem;
})();