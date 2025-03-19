/**
 * winix-fix-improved.js - Вдосконалений файл для виправлення системи WINIX
 *
 * Цей файл виправляє проблеми та уникає конфліктів з оригінальними скриптами:
 * - winix-core.js
 * - winix-connector.js
 *
 * Інструкції:
 * 1. Додайте цей файл до свого проекту в папку static/js/
 * 2. Підключіть його після оригінальних скриптів у всіх HTML файлах так:
 *    <script src="static/js/winix-core.js"></script>
 *    <script src="static/js/winix-connector.js"></script>
 *    <script src="static/js/winix-fix-improved.js"></script>
 */

(function() {
    console.log("🔄 WINIX-FIX: Запуск виправлень системи...");

    // Перевірка наявності оригінальних систем
    const hasWinixCore = typeof window.WinixCore !== 'undefined';
    const hasRewardSystem = typeof window.rewardSystem !== 'undefined';
    const hasStakingSystem = typeof window.stakingSystem !== 'undefined';

    console.log(`WINIX-FIX: Виявлено WinixCore: ${hasWinixCore}, RewardSystem: ${hasRewardSystem}, StakingSystem: ${hasStakingSystem}`);

    // ================ КОНСТАНТИ ТА УТИЛІТИ ================

    // Ключі для localStorage
    const STORAGE = {
        USER_TOKENS: 'userTokens',
        USER_COINS: 'userCoins',
        STAKING_DATA: 'stakingData',
        TRANSACTIONS: 'transactions',
        COMPLETED_TASKS: 'completedTasks',
        LAST_DAILY_CLAIM: 'lastDailyClaim',
        DAILY_STREAK: 'dailyStreak'
    };

    // Конфігурація стейкінгу
    const STAKING_RATES = {
        7: 4,    // 4% за 7 днів
        14: 9,   // 9% за 14 днів
        28: 15   // 15% за 28 днів
    };

    /**
     * Безпечне отримання даних з localStorage
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значення за замовчуванням
     * @param {boolean} isJSON - Чи потрібно парсити JSON
     * @returns {any} - Отримане значення
     */
    function getStorage(key, defaultValue, isJSON = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;

            if (isJSON) {
                return JSON.parse(value);
            }

            // Якщо це число, парсимо як число
            if (!isNaN(parseFloat(value))) {
                return parseFloat(value);
            }

            return value;
        } catch (e) {
            console.warn(`WINIX-FIX: Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Безпечне збереження даних в localStorage
     * @param {string} key - Ключ
     * @param {any} value - Значення
     * @returns {boolean} - Успішність операції
     */
    function setStorage(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            console.warn(`WINIX-FIX: Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Генерація унікального ID
     * @returns {string} - Унікальний ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Показ сповіщення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення
     * @param {Function} callback - Функція зворотного виклику
     */
    function showToast(message, type = 'success', callback) {
        try {
            // Використовуємо оригінальну функцію, якщо вона існує
            if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                return window.WinixCore.UI.showNotification(message, type, callback);
            }

            // Запасний варіант
            let toastElement = document.getElementById('toast-message');

            if (!toastElement) {
                toastElement = document.createElement('div');
                toastElement.id = 'toast-message';
                toastElement.className = 'toast-message';
                document.body.appendChild(toastElement);
            }

            toastElement.textContent = message;

            // Встановлюємо колір фону в залежності від типу
            switch (type) {
                case 'success':
                case 'SUCCESS':
                    toastElement.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
                    break;
                case 'error':
                case 'ERROR':
                    toastElement.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
                    break;
                case 'warning':
                case 'WARNING':
                    toastElement.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
                    break;
                case 'info':
                case 'INFO':
                    toastElement.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
                    break;
            }

            toastElement.classList.add('show');

            setTimeout(() => {
                toastElement.classList.remove('show');
                if (callback && typeof callback === 'function') {
                    setTimeout(callback, 300);
                }
            }, 3000);

            return true;
        } catch (e) {
            console.warn("WINIX-FIX: Помилка показу сповіщення:", e);
            return false;
        }
    }

    // ================ РОЗШИРЕННЯ ІСНУЮЧИХ СИСТЕМ ================

    /**
     * Удосконалюємо систему балансу
     */
    function enhanceBalanceSystem() {
        try {
            // Використовуємо існуючу систему або створюємо нову
            const originalSystem = hasWinixCore ? window.WinixCore.Balance :
                                  hasRewardSystem ? window.rewardSystem : null;

            // Розширюємо існуючу систему або створюємо нову
            window.balanceSystem = {
                /**
                 * Отримання поточного балансу токенів
                 * @returns {number} - Кількість токенів
                 */
                getTokens: function() {
                    if (originalSystem && typeof originalSystem.getTokens === 'function') {
                        return originalSystem.getTokens();
                    }

                    return getStorage(STORAGE.USER_TOKENS, 1000);
                },

                /**
                 * Отримання поточного балансу жетонів
                 * @returns {number} - Кількість жетонів
                 */
                getCoins: function() {
                    if (originalSystem && typeof originalSystem.getCoins === 'function') {
                        return originalSystem.getCoins();
                    }

                    return getStorage(STORAGE.USER_COINS, 250);
                },

                /**
                 * Встановлення нового балансу токенів
                 * @param {number} amount - Нова кількість токенів
                 * @returns {boolean} - Успішність операції
                 */
                setTokens: function(amount) {
                    if (originalSystem && typeof originalSystem.setTokens === 'function') {
                        return originalSystem.setTokens(amount);
                    }

                    return setStorage(STORAGE.USER_TOKENS, amount);
                },

                /**
                 * Встановлення нового балансу жетонів
                 * @param {number} amount - Нова кількість жетонів
                 * @returns {boolean} - Успішність операції
                 */
                setCoins: function(amount) {
                    if (originalSystem && typeof originalSystem.setCoins === 'function') {
                        return originalSystem.setCoins(amount);
                    }

                    return setStorage(STORAGE.USER_COINS, amount);
                },

                /**
                 * Додавання токенів до балансу
                 * @param {number} amount - Кількість токенів
                 * @param {string} description - Опис операції
                 * @returns {boolean} - Успішність операції
                 */
                addTokens: function(amount, description) {
                    if (originalSystem && typeof originalSystem.addTokens === 'function') {
                        return originalSystem.addTokens(amount, description);
                    }

                    const currentBalance = this.getTokens();
                    const newBalance = currentBalance + amount;

                    // Додаємо транзакцію
                    if (window.transactionSystem) {
                        window.transactionSystem.addTransaction({
                            type: 'receive',
                            amount: amount,
                            description: description || 'Поповнення балансу'
                        });
                    }

                    const result = this.setTokens(newBalance);
                    this.updateDisplay();
                    return result;
                },

                /**
                 * Віднімання токенів з балансу
                 * @param {number} amount - Кількість токенів
                 * @param {string} description - Опис операції
                 * @returns {boolean} - Успішність операції
                 */
                subtractTokens: function(amount, description) {
                    if (originalSystem && typeof originalSystem.subtractTokens === 'function') {
                        return originalSystem.subtractTokens(amount, description);
                    }

                    const currentBalance = this.getTokens();

                    // Перевіряємо, чи достатньо коштів
                    if (currentBalance < amount) {
                        showToast('Недостатньо коштів на балансі', 'error');
                        return false;
                    }

                    const newBalance = currentBalance - amount;

                    // Додаємо транзакцію
                    if (window.transactionSystem) {
                        window.transactionSystem.addTransaction({
                            type: 'send',
                            amount: -amount,
                            description: description || 'Відправлення коштів'
                        });
                    }

                    const result = this.setTokens(newBalance);
                    this.updateDisplay();
                    return result;
                },

                /**
                 * Додавання жетонів до балансу
                 * @param {number} amount - Кількість жетонів
                 * @returns {boolean} - Успішність операції
                 */
                addCoins: function(amount) {
                    if (originalSystem && typeof originalSystem.addCoins === 'function') {
                        return originalSystem.addCoins(amount);
                    }

                    const currentCoins = this.getCoins();
                    const newCoins = currentCoins + amount;

                    const result = this.setCoins(newCoins);
                    this.updateDisplay();
                    return result;
                },

                /**
                 * Оновлення відображення балансу
                 */
                updateDisplay: function() {
                    // Використовуємо оригінальну функцію, якщо вона існує
                    if (originalSystem && typeof originalSystem.updateBalanceDisplay === 'function') {
                        return originalSystem.updateBalanceDisplay();
                    }

                    const tokens = this.getTokens();
                    const coins = this.getCoins();

                    // Оновлюємо відображення токенів
                    document.querySelectorAll('#user-tokens, .balance-value').forEach(el => {
                        if (el) el.textContent = tokens.toFixed(2);
                    });

                    // Особливе оновлення для main-balance, якщо є
                    const mainBalance = document.getElementById('main-balance');
                    if (mainBalance) {
                        mainBalance.innerHTML = `${tokens.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" alt="WINIX"></span>`;
                    }

                    // Оновлюємо відображення жетонів
                    document.querySelectorAll('#user-coins').forEach(el => {
                        if (el) el.textContent = coins.toFixed(0);
                    });

                    return true;
                }
            };

            // Якщо оригінальна система не має методу оновлення інтерфейсу, додаємо його
            if (originalSystem && !originalSystem.updateBalanceDisplay) {
                originalSystem.updateBalanceDisplay = window.balanceSystem.updateDisplay;
            }

            // Виконуємо перше оновлення
            window.balanceSystem.updateDisplay();

            console.log("✅ WINIX-FIX: Систему балансу успішно вдосконалено");
            return true;
        } catch (e) {
            console.error("❌ WINIX-FIX: Помилка вдосконалення системи балансу:", e);
            return false;
        }
    }

    /**
     * Удосконалюємо систему стейкінгу
     */
    function enhanceStakingSystem() {
        try {
            // Використовуємо існуючу систему або створюємо нову
            const originalSystem = hasWinixCore ? window.WinixCore.Staking :
                                hasStakingSystem ? window.stakingSystem : null;

            // Розширюємо існуючу систему або створюємо нову
            window.stakingSystem = {
                /**
                 * Перевірка наявності активного стейкінгу
                 * @returns {boolean} - Чи є активний стейкінг
                 */
                hasActiveStaking: function() {
                    if (originalSystem && typeof originalSystem.hasActiveStaking === 'function') {
                        return originalSystem.hasActiveStaking();
                    }

                    const stakingData = this.getStakingData();
                    return stakingData && stakingData.hasActiveStaking === true;
                },

                /**
                 * Отримання даних стейкінгу
                 * @returns {object} - Дані стейкінгу
                 */
                getStakingData: function() {
                    if (originalSystem && typeof originalSystem.getStakingData === 'function') {
                        return originalSystem.getStakingData();
                    }

                    const defaultData = {
                        hasActiveStaking: false,
                        stakingAmount: 0,
                        period: 0,
                        rewardPercent: 0,
                        expectedReward: 0,
                        remainingDays: 0,
                        startDate: null,
                        endDate: null
                    };

                    const data = getStorage(STORAGE.STAKING_DATA, defaultData, true);

                    // Якщо є активний стейкінг, оновлюємо дані
                    if (data.hasActiveStaking && data.endDate) {
                        const now = new Date();
                        const endDate = new Date(data.endDate);

                        // Якщо стейкінг завершився
                        if (now >= endDate) {
                            this.completeStaking();
                            return defaultData;
                        }

                        // Оновлюємо кількість днів, що залишилась
                        const diffTime = endDate - now;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        data.remainingDays = Math.max(0, diffDays);

                        // Зберігаємо оновлені дані
                        setStorage(STORAGE.STAKING_DATA, data);
                    }

                    return data;
                },

                /**
                 * Отримання даних для відображення стейкінгу
                 * @returns {object} - Дані для відображення
                 */
                getStakingDisplayData: function() {
                    if (originalSystem && typeof originalSystem.getStakingDisplayData === 'function') {
                        return originalSystem.getStakingDisplayData();
                    }

                    return this.getStakingData();
                },

                /**
                 * Розрахунок очікуваної винагороди
                 * @param {number} amount - Сума стейкінгу
                 * @param {number} period - Період стейкінгу
                 * @returns {number} - Очікувана винагорода
                 */
                calculateExpectedReward: function(amount, period) {
                    if (originalSystem && typeof originalSystem.calculateExpectedReward === 'function') {
                        return originalSystem.calculateExpectedReward(amount, period);
                    }

                    // Розраховуємо винагороду на основі відсотка
                    const percent = STAKING_RATES[period] || 0;
                    return parseFloat((amount * percent / 100).toFixed(2));
                },

                /**
                 * Аліас для calculateExpectedReward, використовується в оригінальній системі
                 * @param {number} amount - Сума стейкінгу
                 * @param {number} period - Період стейкінгу
                 * @returns {number} - Очікувана винагорода
                 */
                calculatePotentialReward: function(amount, period) {
                    return this.calculateExpectedReward(amount, period);
                },

                /**
                 * Створення нового стейкінгу
                 * @param {number} amount - Сума стейкінгу
                 * @param {number} period - Період стейкінгу
                 * @returns {object} - Результат операції
                 */
                createStaking: function(amount, period) {
                    try {
                        amount = parseFloat(amount);
                        period = parseInt(period);

                        // Перевірка параметрів
                        if (isNaN(amount) || amount <= 0) {
                            showToast("Введіть коректну суму стейкінгу", "error");
                            return { success: false, message: "Введіть коректну суму" };
                        }

                        if (![7, 14, 28].includes(period)) {
                            showToast("Виберіть коректний період стейкінгу", "error");
                            return { success: false, message: "Виберіть коректний період" };
                        }

                        // Перевірка наявності активного стейкінгу
                        if (this.hasActiveStaking()) {
                            showToast("У вас вже є активний стейкінг", "error");
                            return { success: false, message: "У вас вже є активний стейкінг" };
                        }

                        // Перевірка наявності достатньої кількості коштів
                        const currentBalance = window.balanceSystem.getTokens();
                        if (currentBalance < amount) {
                            showToast(`Недостатньо коштів. Ваш баланс: ${currentBalance.toFixed(2)} $WINIX`, "error");
                            return { success: false, message: "Недостатньо коштів" };
                        }

                        // Використовуємо оригінальну функцію, якщо вона існує і необхідна логіка вже є
                        if (originalSystem && typeof originalSystem.createStaking === 'function') {
                            return originalSystem.createStaking(amount, period);
                        }

                        // Знімаємо кошти з балансу
                        const description = `Стейкінг на ${period} днів`;
                        if (!window.balanceSystem.subtractTokens(amount, description)) {
                            return { success: false, message: "Помилка зняття коштів" };
                        }

                        // Визначаємо відсоток і очікувану винагороду
                        const rewardPercent = STAKING_RATES[period];
                        const expectedReward = this.calculateExpectedReward(amount, period);

                        // Створюємо дані стейкінгу
                        const currentDate = new Date();
                        const endDate = new Date(currentDate);
                        endDate.setDate(endDate.getDate() + period);

                        const stakingData = {
                            hasActiveStaking: true,
                            stakingId: generateId(),
                            stakingAmount: amount,
                            period: period,
                            rewardPercent: rewardPercent,
                            expectedReward: expectedReward,
                            remainingDays: period,
                            startDate: currentDate.toISOString(),
                            endDate: endDate.toISOString()
                        };

                        // Зберігаємо дані стейкінгу
                        setStorage(STORAGE.STAKING_DATA, stakingData);

                        // Показуємо повідомлення
                        showToast("Стейкінг успішно створено!", "success");

                        // Оновлюємо відображення стейкінгу
                        this.updateStakingDisplay();

                        return {
                            success: true,
                            message: "Стейкінг успішно створено",
                            data: stakingData
                        };
                    } catch (e) {
                        console.error("WINIX-FIX: Помилка створення стейкінгу:", e);
                        showToast("Помилка створення стейкінгу", "error");
                        return { success: false, message: "Внутрішня помилка" };
                    }
                },

                /**
                 * Скасування стейкінгу
                 * @returns {object} - Результат операції
                 */
                cancelStaking: function() {
                    try {
                        // Перевіряємо наявність активного стейкінгу
                        if (!this.hasActiveStaking()) {
                            showToast("У вас немає активного стейкінгу", "error");
                            return { success: false, message: "Немає активного стейкінгу" };
                        }

                        // Використовуємо оригінальну функцію, якщо вона існує
                        if (originalSystem && typeof originalSystem.cancelStaking === 'function') {
                            return originalSystem.cancelStaking();
                        }

                        // Отримуємо дані стейкінгу
                        const stakingData = this.getStakingData();

                        // Розраховуємо суму для повернення (з утриманням комісії 20%)
                        const fee = 0.2; // 20% комісія
                        const returnAmount = stakingData.stakingAmount * (1 - fee);
                        const feeAmount = stakingData.stakingAmount * fee;

                        // Додаємо кошти на баланс
                        window.balanceSystem.addTokens(
                            returnAmount,
                            `Скасування стейкінгу (утримано ${feeAmount.toFixed(2)} $WINIX комісії)`
                        );

                        // Очищаємо дані стейкінгу
                        setStorage(STORAGE.STAKING_DATA, {
                            hasActiveStaking: false,
                            stakingAmount: 0,
                            period: 0,
                            rewardPercent: 0,
                            expectedReward: 0,
                            remainingDays: 0,
                            startDate: null,
                            endDate: null
                        });

                        // Показуємо повідомлення
                        showToast(`Стейкінг скасовано. Повернено ${returnAmount.toFixed(2)} $WINIX`, "success");

                        // Оновлюємо відображення стейкінгу
                        this.updateStakingDisplay();

                        return {
                            success: true,
                            message: `Стейкінг скасовано. Повернено ${returnAmount.toFixed(2)} $WINIX`,
                            data: { returnAmount, feeAmount }
                        };
                    } catch (e) {
                        console.error("WINIX-FIX: Помилка скасування стейкінгу:", e);
                        showToast("Помилка скасування стейкінгу", "error");
                        return { success: false, message: "Внутрішня помилка" };
                    }
                },

                /**
                 * Завершення стейкінгу і нарахування винагороди
                 * @returns {boolean} - Успішність операції
                 */
                completeStaking: function() {
                    try {
                        // Перевіряємо наявність активного стейкінгу
                        if (!this.hasActiveStaking()) {
                            return false;
                        }

                        // Отримуємо дані стейкінгу
                        const stakingData = this.getStakingData();

                        // Використовуємо оригінальну функцію, якщо вона існує
                        if (originalSystem && typeof originalSystem.completeStaking === 'function') {
                            return originalSystem.completeStaking();
                        }

                        // Нараховуємо винагороду
                        const totalReturn = stakingData.stakingAmount + stakingData.expectedReward;

                        // Додаємо кошти на баланс
                        window.balanceSystem.addTokens(
                            totalReturn,
                            `Завершення стейкінгу: +${stakingData.stakingAmount} основна сума, +${stakingData.expectedReward.toFixed(2)} винагорода`
                        );

                        // Очищаємо дані стейкінгу
                        setStorage(STORAGE.STAKING_DATA, {
                            hasActiveStaking: false,
                            stakingAmount: 0,
                            period: 0,
                            rewardPercent: 0,
                            expectedReward: 0,
                            remainingDays: 0,
                            startDate: null,
                            endDate: null
                        });

                        // Показуємо повідомлення
                        showToast(`Стейкінг завершено. Отримано ${totalReturn.toFixed(2)} $WINIX`, "success");

                        // Оновлюємо відображення стейкінгу
                        this.updateStakingDisplay();

                        return true;
                    } catch (e) {
                        console.error("WINIX-FIX: Помилка завершення стейкінгу:", e);
                        return false;
                    }
                },

                /**
                 * Додавання коштів до стейкінгу
                 * @param {number} amount - Сума для додавання
                 * @returns {object} - Результат операції
                 */
                addToStaking: function(amount) {
                    try {
                        amount = parseFloat(amount);

                        // Перевірка параметрів
                        if (isNaN(amount) || amount <= 0) {
                            showToast("Введіть коректну суму", "error");
                            return { success: false, message: "Введіть коректну суму" };
                        }

                        // Перевіряємо наявність активного стейкінгу
                        if (!this.hasActiveStaking()) {
                            showToast("У вас немає активного стейкінгу", "error");
                            return { success: false, message: "Немає активного стейкінгу" };
                        }

                        // Використовуємо оригінальну функцію, якщо вона існує
                        if (originalSystem && typeof originalSystem.addToStaking === 'function') {
                            return originalSystem.addToStaking(amount);
                        }

                        // Перевірка наявності достатньої кількості коштів
                        const currentBalance = window.balanceSystem.getTokens();
                        if (currentBalance < amount) {
                            showToast(`Недостатньо коштів. Ваш баланс: ${currentBalance.toFixed(2)} $WINIX`, "error");
                            return { success: false, message: "Недостатньо коштів" };
                        }

                        // Отримуємо поточні дані стейкінгу
                        const stakingData = this.getStakingData();

                        // Знімаємо кошти з балансу
                        if (!window.balanceSystem.subtractTokens(amount, "Додавання до стейкінгу")) {
                            return { success: false, message: "Помилка зняття коштів" };
                        }

                        // Оновлюємо дані стейкінгу
                        const newAmount = stakingData.stakingAmount + amount;
                        stakingData.stakingAmount = newAmount;

                        // Перераховуємо винагороду
                        stakingData.expectedReward = this.calculateExpectedReward(newAmount, stakingData.period);

                        // Зберігаємо оновлені дані
                        setStorage(STORAGE.STAKING_DATA, stakingData);

                        // Показуємо повідомлення
                        showToast(`Додано ${amount.toFixed(2)} $WINIX до стейкінгу`, "success");

                        // Оновлюємо відображення стейкінгу
                        this.updateStakingDisplay();

                        return {
                            success: true,
                            message: `Додано ${amount.toFixed(2)} $WINIX до стейкінгу`,
                            data: stakingData
                        };
                    } catch (e) {
                        console.error("WINIX-FIX: Помилка додавання до стейкінгу:", e);
                        showToast("Помилка додавання до стейкінгу", "error");
                        return { success: false, message: "Внутрішня помилка" };
                    }
                },

                /**
                 * Оновлення відображення стейкінгу
                 */
                updateStakingDisplay: function() {
                    try {
                        // Використовуємо оригінальну функцію, якщо вона існує
                        if (originalSystem && typeof originalSystem.updateStakingDisplay === 'function') {
                            return originalSystem.updateStakingDisplay();
                        }

                        const stakingData = this.getStakingData();
                        const hasStaking = stakingData.hasActiveStaking === true;

                        // Визначаємо сторінку, на якій знаходимось
                        const currentPage = window.location.pathname.split('/').pop();

                        // Для сторінки гаманця
                        if (currentPage === 'wallet.html' || currentPage === 'index.html' || currentPage === '') {
                            const stakingBalanceElement = document.getElementById('staking-balance');
                            const stakingRewardsElement = document.getElementById('staking-rewards');

                            if (stakingBalanceElement) {
                                stakingBalanceElement.textContent = `У стейкінгу: ${hasStaking ? stakingData.stakingAmount.toFixed(2) : '0'} $WINIX`;
                            }

                            if (stakingRewardsElement) {
                                stakingRewardsElement.textContent = `Нагороди: ${hasStaking ? stakingData.expectedReward.toFixed(2) : '0'} $WINIX`;
                            }
                        }

                        // Для сторінки стейкінгу
                        else if (currentPage === 'staking.html') {
                            const statusElement = document.getElementById('staking-status');
                            const detailsButton = document.getElementById('details-button');
                            const cancelButton = document.getElementById('cancel-staking-button');

                            if (statusElement) {
                                statusElement.textContent = hasStaking
                                    ? `У стейкінгу: ${stakingData.stakingAmount.toFixed(2)} $WINIX`
                                    : "Наразі немає активних стейкінгів";
                            }

                            if (detailsButton) {
                                detailsButton.style.opacity = hasStaking ? '1' : '0.5';
                                detailsButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                            }

                            if (cancelButton) {
                                cancelButton.style.opacity = hasStaking ? '1' : '0.5';
                                cancelButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                            }
                        }

                        // Для сторінки деталей стейкінгу
                        else if (currentPage === 'staking-details.html') {
                            if (!hasStaking) {
                                showToast("У вас немає активного стейкінгу", "error", function() {
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

                            if (amountElement) amountElement.textContent = `${stakingData.stakingAmount.toFixed(2)} $WINIX`;
                            if (periodElement) periodElement.textContent = `${stakingData.period} днів`;
                            if (rewardPercentElement) rewardPercentElement.textContent = `${stakingData.rewardPercent}%`;
                            if (expectedRewardElement) expectedRewardElement.textContent = `${stakingData.expectedReward.toFixed(2)} $WINIX`;
                            if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays.toString();
                        }

                        return true;
                    } catch (e) {
                        console.error("WINIX-FIX: Помилка оновлення відображення стейкінгу:", e);
                        return false;
                    }
                },

                // Додаємо доступ до системи балансу для сумісності
                walletSystem: {
                    getBalance: function() {
                        return window.balanceSystem.getTokens();
                    }
                }
            };

            console.log("✅ WINIX-FIX: Систему стейкінгу успішно вдосконалено");
            return true;
        } catch (e) {
            console.error("❌ WINIX-FIX: Помилка вдосконалення системи стейкінгу:", e);
            return false;
        }
    }

    /**
     * Удосконалюємо систему винагород
     */
    function enhanceRewardSystem() {
        try {
            // Створюємо або розширюємо систему винагород
            if (!window.rewardSystem) {
                window.rewardSystem = {};
            }

            // Додаємо методи балансу, якщо їх немає
            if (!window.rewardSystem.getTokens && window.balanceSystem) {
                window.rewardSystem.getTokens = window.balanceSystem.getTokens.bind(window.balanceSystem);
                window.rewardSystem.getUserTokens = window.balanceSystem.getTokens.bind(window.balanceSystem);
                window.rewardSystem.getCoins = window.balanceSystem.getCoins.bind(window.balanceSystem);
                window.rewardSystem.getUserCoins = window.balanceSystem.getCoins.bind(window.balanceSystem);
                window.rewardSystem.setTokens = window.balanceSystem.setTokens.bind(window.balanceSystem);
                window.rewardSystem.setUserTokens = window.balanceSystem.setTokens.bind(window.balanceSystem);
                window.rewardSystem.setCoins = window.balanceSystem.setCoins.bind(window.balanceSystem);
                window.rewardSystem.setUserCoins = window.balanceSystem.setCoins.bind(window.balanceSystem);
                window.rewardSystem.addTokens = window.balanceSystem.addTokens.bind(window.balanceSystem);
                window.rewardSystem.subtractTokens = window.balanceSystem.subtractTokens.bind(window.balanceSystem);
                window.rewardSystem.addCoins = window.balanceSystem.addCoins.bind(window.balanceSystem);
                window.rewardSystem.updateBalanceDisplay = window.balanceSystem.updateDisplay.bind(window.balanceSystem);
            }

            // Додаємо або оновлюємо методи для роботи з завданнями
            window.rewardSystem.isActionCompleted = function(taskId) {
                try {
                    const completedTasks = getStorage(STORAGE.COMPLETED_TASKS, {}, true);
                    return completedTasks[taskId] === true;
                } catch (e) {
                    console.warn("WINIX-FIX: Помилка перевірки завдання:", e);
                    return false;
                }
            };

            window.rewardSystem.completeTask = function(taskId, tokensReward, coinsReward = 0, description = "") {
                try {
                    // Перевіряємо, чи завдання вже виконано
                    if (this.isActionCompleted(taskId)) {
                        showToast("Це завдання вже виконано", "info");
                        return { success: false, message: "Завдання вже виконано" };
                    }

                    // Додаємо винагороду
                    if (tokensReward > 0) {
                        window.balanceSystem.addTokens(tokensReward, description || `Винагорода за завдання ${taskId}`);
                    }

                    if (coinsReward > 0) {
                        window.balanceSystem.addCoins(coinsReward);
                    }

                    // Позначаємо завдання як виконане
                    const completedTasks = getStorage(STORAGE.COMPLETED_TASKS, {}, true);
                    completedTasks[taskId] = true;
                    setStorage(STORAGE.COMPLETED_TASKS, completedTasks);

                    // Показуємо повідомлення
                    showToast(`Завдання виконано! +${tokensReward} $WINIX${coinsReward > 0 ? `, +${coinsReward} жетонів` : ''}`, "success");

                    return { success: true, message: "Завдання виконано" };
                } catch (e) {
                    console.error("WINIX-FIX: Помилка виконання завдання:", e);
                    return { success: false, message: "Помилка виконання завдання" };
                }
            };

            window.rewardSystem.reward = function(actionId, tokens, coins = 0) {
                return this.completeTask(actionId, tokens, coins, `Винагорода: ${actionId}`);
            };

            // Додаємо метод для щоденного бонусу
            window.rewardSystem.claimDailyBonus = function() {
                try {
                    const now = new Date();
                    const today = now.toISOString().substring(0, 10); // YYYY-MM-DD

                    // Перевіряємо, чи вже отримали бонус сьогодні
                    const lastClaimDate = getStorage(STORAGE.LAST_DAILY_CLAIM, "");

                    if (lastClaimDate === today) {
                        showToast("Ви вже отримали щоденну винагороду сьогодні", "info");
                        return { success: false, message: "Вже отримано сьогодні" };
                    }

                    // Отримуємо поточний день тижня (1-7)
                    let dailyStreak = getStorage(STORAGE.DAILY_STREAK, 0);

                    // Перевіряємо, чи не пропущено день
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayString = yesterday.toISOString().substring(0, 10);

                    if (lastClaimDate !== yesterdayString && lastClaimDate !== "") {
                        dailyStreak = 0; // Скидаємо лічильник, якщо пропущено день
                    }

                    // Збільшуємо лічильник
                    dailyStreak++;

                    // Винагорода в залежності від дня (зростає від 10 до 70)
                    const amount = Math.min(10 * dailyStreak, 70);

                    // Додаємо винагороду
                    window.balanceSystem.addTokens(amount, `Щоденна винагорода: День ${dailyStreak}`);

                    // Зберігаємо дані
                    setStorage(STORAGE.LAST_DAILY_CLAIM, today);
                    setStorage(STORAGE.DAILY_STREAK, dailyStreak);

                    // Оновлюємо прогрес для щоденних винагород
                    this.updateDailyProgress();

                    return {
                        success: true,
                        message: `Отримано щоденну винагороду: ${amount} $WINIX`,
                        amount: amount
                    };
                } catch (e) {
                    console.error("WINIX-FIX: Помилка отримання щоденної винагороди:", e);
                    return { success: false, message: "Помилка отримання винагороди" };
                }
            };

            // Додаємо метод для оновлення прогресу для щоденного бонусу
            window.rewardSystem.updateDailyProgress = function() {
                try {
                    const dailyProgress = document.getElementById('weekly-progress');
                    if (!dailyProgress) return false;

                    const dailyStreak = getStorage(STORAGE.DAILY_STREAK, 0);
                    const progressWidth = Math.min((dailyStreak / 7) * 100, 100);

                    dailyProgress.style.width = `${progressWidth}%`;

                    // Оновлюємо кружечки з днями
                    const dayCircles = document.querySelectorAll('.day-circle');
                    if (dayCircles && dayCircles.length > 0) {
                        dayCircles.forEach((circle, index) => {
                            if (index < dailyStreak) {
                                circle.classList.add('completed');
                                circle.classList.remove('active');
                            } else if (index === dailyStreak) {
                                circle.classList.add('active');
                                circle.classList.remove('completed');
                            } else {
                                circle.classList.remove('completed', 'active');
                            }
                        });
                    }

                    // Оновлюємо кнопку отримання нагороди
                    const claimButton = document.getElementById('claim-daily');
                    if (claimButton) {
                        const lastClaimDate = getStorage(STORAGE.LAST_DAILY_CLAIM, "");
                        const today = new Date().toISOString().substring(0, 10);

                        if (lastClaimDate === today) {
                            claimButton.disabled = true;
                            claimButton.textContent = "Вже отримано";
                        } else {
                            claimButton.disabled = false;
                            const amount = Math.min(10 * (dailyStreak + 1), 70);
                            claimButton.textContent = `Отримати ${amount} $WINIX`;
                        }
                    }

                    return true;
                } catch (e) {
                    console.error("WINIX-FIX: Помилка оновлення прогресу щоденного бонусу:", e);
                    return false;
                }
            };

            console.log("✅ WINIX-FIX: Систему винагород успішно вдосконалено");
            return true;
        } catch (e) {
            console.error("❌ WINIX-FIX: Помилка вдосконалення системи винагород:", e);
            return false;
        }
    }

    // ================ НАЛАШТУВАННЯ ОБРОБНИКІВ ПОДІЙ ================

    /**
     * Налаштування обробників подій для сторінки стейкінгу
     */
    function setupStakingPageHandlers() {
        try {
            // Перевіряємо, чи ми на сторінці стейкінгу
            if (!window.location.pathname.includes('staking.html')) return false;

            console.log("WINIX-FIX: Налаштування обробників на сторінці стейкінгу");

            // Кнопка повернення на сторінку гаманця
            const backButton = document.getElementById('back-button');
            if (backButton) {
                backButton.addEventListener('click', function() {
                    window.location.href = 'wallet.html';
                });
            }

            // Розрахунок очікуваної винагороди
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');
            const rewardElement = document.getElementById('expected-reward');

            function updateExpectedReward() {
                if (!amountInput || !periodSelect || !rewardElement) return;

                const amount = parseFloat(amountInput.value) || 0;
                const period = parseInt(periodSelect.value) || 14;

                const reward = window.stakingSystem.calculateExpectedReward(amount, period);
                rewardElement.textContent = reward.toFixed(2);
            }

            if (amountInput && periodSelect) {
                // Видаляємо існуючі обробники, щоб уникнути дублювання
                const newAmountInput = amountInput.cloneNode(true);
                const newPeriodSelect = periodSelect.cloneNode(true);

                amountInput.parentNode.replaceChild(newAmountInput, amountInput);
                periodSelect.parentNode.replaceChild(newPeriodSelect, periodSelect);

                // Додаємо нові обробники
                newAmountInput.addEventListener('input', updateExpectedReward);
                newPeriodSelect.addEventListener('change', updateExpectedReward);

                // Початковий розрахунок
                updateExpectedReward();

                // Кнопка "Max"
                const maxButton = document.getElementById('max-button');
                if (maxButton) {
                    const newMaxButton = maxButton.cloneNode(true);
                    maxButton.parentNode.replaceChild(newMaxButton, maxButton);

                    newMaxButton.addEventListener('click', function() {
                        const balance = window.balanceSystem.getTokens();
                        newAmountInput.value = balance.toFixed(2);
                        updateExpectedReward();
                    });
                }
            }

            // Кнопка "Застейкати"
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) {
                const newStakeButton = stakeButton.cloneNode(true);
                stakeButton.parentNode.replaceChild(newStakeButton, stakeButton);

                newStakeButton.addEventListener('click', function() {
                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    window.stakingSystem.createStaking(amount, period);
                });
            }

            // Кнопка "Деталі стейкінгу"
            const detailsButton = document.getElementById('details-button');
            if (detailsButton) {
                const newDetailsButton = detailsButton.cloneNode(true);
                detailsButton.parentNode.replaceChild(newDetailsButton, detailsButton);

                newDetailsButton.addEventListener('click', function() {
                    if (window.stakingSystem.hasActiveStaking()) {
                        window.location.href = 'staking-details.html';
                    } else {
                        showToast("У вас немає активного стейкінгу", "error");
                    }
                });
            }

            // Кнопка "Скасувати стейкінг"
            const cancelButton = document.getElementById('cancel-staking-button');
            if (cancelButton) {
                const newCancelButton = cancelButton.cloneNode(true);
                cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);

                newCancelButton.addEventListener('click', function() {
                    if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію 20%.")) {
                        window.stakingSystem.cancelStaking();
                    }
                });
            }

            // Оновлюємо інтерфейс
            window.stakingSystem.updateStakingDisplay();

            return true;
        } catch (e) {
            console.error("WINIX-FIX: Помилка налаштування обробників стейкінгу:", e);
            return false;
        }
    }

    /**
     * Налаштування обробників подій для сторінки деталей стейкінгу
     */
    function setupStakingDetailsPageHandlers() {
        try {
            // Перевіряємо, чи ми на сторінці деталей стейкінгу
            if (!window.location.pathname.includes('staking-details.html')) return false;

            console.log("WINIX-FIX: Налаштування обробників на сторінці деталей стейкінгу");

            // Кнопка повернення на сторінку стейкінгу
            const backButton = document.getElementById('back-button');
            if (backButton) {
                backButton.addEventListener('click', function() {
                    window.location.href = 'staking.html';
                });
            }

            // Кнопка "Додати до стейкінгу"
            const addButton = document.getElementById('add-to-stake-button');
            if (addButton) {
                const newAddButton = addButton.cloneNode(true);
                addButton.parentNode.replaceChild(newAddButton, addButton);

                newAddButton.addEventListener('click', function() {
                    const amount = prompt("Введіть суму для додавання до стейкінгу:");
                    if (amount !== null) {
                        const numAmount = parseFloat(amount);
                        if (!isNaN(numAmount) && numAmount > 0) {
                            window.stakingSystem.addToStaking(numAmount);
                        } else {
                            showToast("Введіть коректну суму", "error");
                        }
                    }
                });
            }

            // Кнопка "Скасувати стейкінг"
            const cancelButton = document.getElementById('cancel-staking-button');
            if (cancelButton) {
                const newCancelButton = cancelButton.cloneNode(true);
                cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);

                newCancelButton.addEventListener('click', function() {
                    if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію 20%.")) {
                        window.stakingSystem.cancelStaking();
                    }
                });
            }

            // Оновлюємо інтерфейс
            window.stakingSystem.updateStakingDisplay();

            return true;
        } catch (e) {
            console.error("WINIX-FIX: Помилка налаштування обробників деталей стейкінгу:", e);
            return false;
        }
    }

    /**
     * Налаштування обробників подій для сторінки завдань
     */
    function setupEarnPageHandlers() {
        try {
            // Перевіряємо, чи ми на сторінці завдань
            if (!window.location.pathname.includes('earn.html')) return false;

            console.log("WINIX-FIX: Налаштування обробників на сторінці завдань");

            // Кнопка щоденного бонусу
            const claimDailyButton = document.getElementById('claim-daily');
            if (claimDailyButton) {
                const newClaimButton = claimDailyButton.cloneNode(true);
                claimDailyButton.parentNode.replaceChild(newClaimButton, claimDailyButton);

                newClaimButton.addEventListener('click', function() {
                    window.rewardSystem.claimDailyBonus();
                });

                // Оновлюємо прогрес щоденного бонусу
                window.rewardSystem.updateDailyProgress();
            }

            // Налаштування для соціальних кнопок
            const socialTasks = [
                { subscribeId: 'twitter-subscribe', verifyId: 'twitter-verify', reward: 50 },
                { subscribeId: 'telegram-subscribe', verifyId: 'telegram-verify', reward: 80 },
                { subscribeId: 'youtube-subscribe', verifyId: 'youtube-verify', reward: 50 }
            ];

            socialTasks.forEach(task => {
                // Кнопка підписки
                const subscribeButton = document.getElementById(task.subscribeId);
                if (subscribeButton) {
                    const newSubscribeButton = subscribeButton.cloneNode(true);
                    subscribeButton.parentNode.replaceChild(newSubscribeButton, subscribeButton);

                    newSubscribeButton.addEventListener('click', function() {
                        // Зберігаємо, що користувач клікнув на кнопку
                        localStorage.setItem(`${task.subscribeId}_clicked`, 'true');

                        // Визначаємо URL
                        let url = '';
                        switch(task.subscribeId) {
                            case 'twitter-subscribe':
                                url = 'https://twitter.com/Winix_Official';
                                break;
                            case 'telegram-subscribe':
                                url = 'https://t.me/Winix_Official';
                                break;
                            case 'youtube-subscribe':
                                url = 'https://youtube.com/c/Winix_Official';
                                break;
                        }

                        // Відкриваємо URL
                        window.open(url, '_blank');
                    });
                }

                // Кнопка перевірки
                const verifyButton = document.getElementById(task.verifyId);
                if (verifyButton) {
                    const newVerifyButton = verifyButton.cloneNode(true);
                    verifyButton.parentNode.replaceChild(newVerifyButton, verifyButton);

                    // Перевіряємо, чи завдання вже виконане
                    const taskId = task.subscribeId.replace('-subscribe', '');
                    if (window.rewardSystem.isActionCompleted(taskId)) {
                        newVerifyButton.disabled = true;
                        newVerifyButton.textContent = 'Виконано';

                        const taskItem = newVerifyButton.closest('.task-item');
                        if (taskItem) {
                            taskItem.classList.add('completed-task');
                        }
                    }

                    newVerifyButton.addEventListener('click', function() {
                        // Перевіряємо, чи користувач спочатку клікнув на підписку
                        if (localStorage.getItem(`${task.subscribeId}_clicked`) !== 'true') {
                            showToast('Спочатку натисніть кнопку "Підписатись"', 'warning');
                            return;
                        }

                        // Виконуємо завдання
                        const taskId = task.subscribeId.replace('-subscribe', '');
                        const result = window.rewardSystem.completeTask(taskId, task.reward, 0, `Підписка на ${taskId}`);

                        if (result.success) {
                            newVerifyButton.disabled = true;
                            newVerifyButton.textContent = 'Виконано';

                            const taskItem = newVerifyButton.closest('.task-item');
                            if (taskItem) {
                                taskItem.classList.add('completed-task');
                            }
                        }
                    });
                }
            });

            return true;
        } catch (e) {
            console.error("WINIX-FIX: Помилка налаштування обробників завдань:", e);
            return false;
        }
    }

    // ================ ГОЛОВНА ФУНКЦІЯ ІНІЦІАЛІЗАЦІЇ ================

    /**
     * Головна функція ініціалізації та виправлення системи
     */
    function initFixSystem() {
        try {
            // Покращуємо системи
            enhanceBalanceSystem();
            enhanceStakingSystem();
            enhanceRewardSystem();

            // Налаштовуємо обробники для різних сторінок
            setupStakingPageHandlers();
            setupStakingDetailsPageHandlers();
            setupEarnPageHandlers();

            console.log("✅ WINIX-FIX: Всі системи успішно вдосконалено!");
            return true;
        } catch (e) {
            console.error("❌ WINIX-FIX: Критична помилка ініціалізації:", e);
            return false;
        }
    }

    // Запускаємо ініціалізацію після повного завантаження сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFixSystem);
    } else {
        initFixSystem();
    }

    // Додаємо функцію сповіщення в глобальний контекст для сумісності
    window.showToast = showToast;

})();