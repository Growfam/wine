/**
 * TaskRewards - модуль для управління винагородами
 * Відповідає за:
 * - Нарахування винагород за виконані завдання
 * - Анімацію отримання винагород
 * - Оновлення балансу користувача
 * - Запобігання дублюванню операцій з балансом
 */

window.TaskRewards = (function() {
    // Приватні змінні модуля
    let tokenBalance = 0;
    let coinsBalance = 0;

    // Історія винагород
    const rewardHistory = [];

    // Реєстр оброблених винагород для запобігання дублюванню
    const processedRewards = new Map();

    // Часовий проміжок для дедуплікації винагород (мс)
    const DEDUPLICATION_WINDOW = 10000; // 10 секунд

    // Блокування паралельних операцій
    const pendingOperations = new Set();

    // Константи типів винагород (уніфіковані з іншими модулями)
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Конфігурація
    const config = {
        debug: false,
        minRewardAmount: 1,
        maxRewardAmount: 1000000,
        defaultRewardAmount: 10,
        syncWithLocalStorage: true,
        preventDuplicateRewards: true,
        throttleAnimations: true
    };

    /**
     * Ініціалізація модуля винагород
     * @param {Object} options - Налаштування модуля
     */
    function init(options = {}) {
        console.log('TaskRewards: Ініціалізація модуля винагород');

        // Застосовуємо передані опції
        if (options && typeof options === 'object') {
            Object.keys(options).forEach(key => {
                if (key in config) {
                    config[key] = options[key];
                }
            });
        }

        // Завантажуємо початковий баланс
        loadBalance();

        // Підписуємося на події
        subscribeToEvents();

        // Очищаємо старі записи оброблених винагород
        cleanupProcessedRewards();

        // Запускаємо періодичне очищення
        setInterval(cleanupProcessedRewards, 3600000); // раз на годину
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Подія завершення перевірки завдання
        document.addEventListener('task-verification-result', handleVerificationResult);

        // Подія оновлення балансу
        document.addEventListener('balance-updated', handleBalanceUpdate);

        // Подія завершення завдання (для надійного отримання винагород)
        document.addEventListener('task-completed', handleTaskCompleted);

        // Подія отримання щоденного бонусу
        document.addEventListener('daily-bonus-claimed', handleDailyBonusClaimed);

        // Подія отримання бонусу за стрік
        document.addEventListener('streak-bonus-claimed', handleStreakBonusClaimed);

        // Подія зміни даних користувача
        document.addEventListener('user-data-updated', () => {
            loadBalance();
        });

        // Синхронізація між вкладками (для localStorage)
        if (config.syncWithLocalStorage) {
            window.addEventListener('storage', handleStorageChange);
        }
    }

    /**
     * Обробка змін у localStorage (синхронізація між вкладками)
     * @param {StorageEvent} event - Подія сховища
     */
    function handleStorageChange(event) {
        // Перевіряємо чи подія стосується балансів
        if (event.key === 'userTokens' || event.key === 'winix_balance') {
            try {
                const newValue = parseFloat(event.newValue);
                if (!isNaN(newValue) && newValue !== tokenBalance) {
                    tokenBalance = newValue;
                    updateTokenBalance(tokenBalance, false);

                    if (config.debug) {
                        console.log(`TaskRewards: Синхронізовано баланс токенів між вкладками: ${tokenBalance}`);
                    }
                }
            } catch (e) {
                console.warn('TaskRewards: Помилка синхронізації балансу токенів між вкладками:', e);
            }
        } else if (event.key === 'userCoins' || event.key === 'winix_coins') {
            try {
                const newValue = parseInt(event.newValue);
                if (!isNaN(newValue) && newValue !== coinsBalance) {
                    coinsBalance = newValue;
                    updateCoinsBalance(coinsBalance, false);

                    if (config.debug) {
                        console.log(`TaskRewards: Синхронізовано баланс жетонів між вкладками: ${coinsBalance}`);
                    }
                }
            } catch (e) {
                console.warn('TaskRewards: Помилка синхронізації балансу жетонів між вкладками:', e);
            }
        }
    }

    /**
     * Обробник події отримання щоденного бонусу
     * @param {CustomEvent} event - Подія отримання щоденного бонусу
     */
    function handleDailyBonusClaimed(event) {
        const { reward, eventId } = event.detail;

        // Перевіряємо на дублювання обробки події
        if (config.preventDuplicateRewards && eventId && isRewardProcessed(eventId)) {
            if (config.debug) {
                console.log(`TaskRewards: Подія отримання щоденного бонусу ${eventId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Якщо є винагорода, обробляємо її
        if (reward) {
            if (config.debug) {
                console.log(`TaskRewards: Отримано щоденний бонус: ${reward} WINIX`);
            }

            // Нормалізуємо винагороду
            const normalizedReward = {
                type: REWARD_TYPES.TOKENS,
                amount: parseFloat(reward)
            };

            // Обробляємо винагороду
            processReward('daily_bonus', normalizedReward, eventId);
        }
    }

    /**
     * Обробник події отримання бонусу за стрік
     * @param {CustomEvent} event - Подія отримання бонусу за стрік
     */
    function handleStreakBonusClaimed(event) {
        const { reward, eventId } = event.detail;

        // Перевіряємо на дублювання обробки події
        if (config.preventDuplicateRewards && eventId && isRewardProcessed(eventId)) {
            if (config.debug) {
                console.log(`TaskRewards: Подія отримання бонусу за стрік ${eventId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Якщо є винагорода, обробляємо її
        if (reward) {
            if (config.debug) {
                console.log(`TaskRewards: Отримано бонус за стрік: ${reward} WINIX`);
            }

            // Нормалізуємо винагороду
            const normalizedReward = {
                type: REWARD_TYPES.TOKENS,
                amount: parseFloat(reward)
            };

            // Обробляємо винагороду
            processReward('streak_bonus', normalizedReward, eventId);
        }
    }

    /**
     * Завантаження балансу
     */
    function loadBalance() {
        // Спробуємо отримати баланс з DOM
        const tokenElement = document.getElementById('user-tokens');
        const coinsElement = document.getElementById('user-coins');

        let tokensLoaded = false;
        let coinsLoaded = false;

        if (tokenElement) {
            try {
                const newValue = parseFloat(tokenElement.textContent) || 0;
                tokenBalance = newValue;
                tokensLoaded = true;
            } catch (e) {
                console.warn('TaskRewards: Помилка отримання балансу токенів з DOM:', e);
            }
        }

        if (coinsElement) {
            try {
                const newValue = parseInt(coinsElement.textContent) || 0;
                coinsBalance = newValue;
                coinsLoaded = true;
            } catch (e) {
                console.warn('TaskRewards: Помилка отримання балансу жетонів з DOM:', e);
            }
        }

        // Якщо не вдалося отримати з DOM, спробуємо з localStorage
        if (!tokensLoaded) {
            try {
                const storedTokens = localStorage.getItem('userTokens') || localStorage.getItem('winix_balance');
                if (storedTokens) {
                    tokenBalance = parseFloat(storedTokens) || 0;
                }
            } catch (e) {
                console.warn('TaskRewards: Помилка отримання балансу токенів з localStorage:', e);
            }
        }

        if (!coinsLoaded) {
            try {
                const storedCoins = localStorage.getItem('userCoins') || localStorage.getItem('winix_coins');
                if (storedCoins) {
                    coinsBalance = parseInt(storedCoins) || 0;
                }
            } catch (e) {
                console.warn('TaskRewards: Помилка отримання балансу жетонів з localStorage:', e);
            }
        }

        if (config.debug) {
            console.log(`TaskRewards: Початковий баланс завантажено - Токени: ${tokenBalance}, Жетони: ${coinsBalance}`);
        }
    }

    /**
     * Обробник події результату перевірки
     * @param {CustomEvent} event - Подія результату перевірки
     */
    function handleVerificationResult(event) {
        const { taskId, result, eventId } = event.detail;

        // Перевіряємо на дублювання обробки події
        if (config.preventDuplicateRewards && eventId && isRewardProcessed(eventId)) {
            if (config.debug) {
                console.log(`TaskRewards: Подія верифікації ${eventId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Якщо перевірка успішна і є винагорода
        if (result && result.success && result.reward) {
            if (config.debug) {
                console.log(`TaskRewards: Отримано результат верифікації для завдання ${taskId}`, result.reward);
            }

            // Обробляємо винагороду
            processReward(taskId, result.reward, eventId);

            // Зберігаємо ідентифікатор обробленої події
            if (eventId) {
                markRewardAsProcessed(eventId);
            }
        }
    }

    /**
     * Обробник події завершення завдання
     * @param {CustomEvent} event - Подія завершення завдання
     */
    function handleTaskCompleted(event) {
        const { taskId, reward, eventId } = event.detail;

        // Перевіряємо на дублювання обробки події
        if (config.preventDuplicateRewards && eventId && isRewardProcessed(eventId)) {
            if (config.debug) {
                console.log(`TaskRewards: Подія завершення завдання ${eventId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Якщо є винагорода, обробляємо її
        if (reward) {
            if (config.debug) {
                console.log(`TaskRewards: Отримано винагороду за завершення завдання ${taskId}`, reward);
            }

            // Обробляємо винагороду
            processReward(taskId, reward, eventId);

            // Зберігаємо ідентифікатор обробленої події
            if (eventId) {
                markRewardAsProcessed(eventId);
            }
        }
    }

    /**
     * Обробник події оновлення балансу
     * @param {CustomEvent} event - Подія оновлення балансу
     */
    function handleBalanceUpdate(event) {
        const { newBalance, type, source, operationId } = event.detail;

        // Ігноруємо власні події
        if (source === 'task_rewards') {
            return;
        }

        // Перевіряємо на дублювання операцій
        if (config.preventDuplicateRewards && operationId && isRewardProcessed(operationId)) {
            if (config.debug) {
                console.log(`TaskRewards: Операція ${operationId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Оновлюємо локальний баланс, тільки якщо тип чітко вказаний
        if (type === REWARD_TYPES.TOKENS) {
            tokenBalance = newBalance;
            if (config.debug) {
                console.log(`TaskRewards: Оновлено баланс токенів із зовнішньої події: ${tokenBalance}`);
            }
            updateTokenBalance(tokenBalance, false);
        } else if (type === REWARD_TYPES.COINS) {
            coinsBalance = newBalance;
            if (config.debug) {
                console.log(`TaskRewards: Оновлено баланс жетонів із зовнішньої події: ${coinsBalance}`);
            }
            updateCoinsBalance(coinsBalance, false);
        }

        // Зберігаємо ідентифікатор обробленої операції
        if (operationId) {
            markRewardAsProcessed(operationId);
        }
    }

    /**
     * Перевірка, чи нагорода вже була оброблена
     * @param {string} id - Ідентифікатор операції
     * @returns {boolean} True, якщо нагорода вже була оброблена
     */
    function isRewardProcessed(id) {
        return processedRewards.has(id) &&
               (Date.now() - processedRewards.get(id)) < DEDUPLICATION_WINDOW;
    }

    /**
     * Позначення нагороди як обробленої
     * @param {string} id - Ідентифікатор операції
     */
    function markRewardAsProcessed(id) {
        processedRewards.set(id, Date.now());
    }

    /**
     * Очищення застарілих записів оброблених винагород
     */
    function cleanupProcessedRewards() {
        const cutoffTime = Date.now() - DEDUPLICATION_WINDOW;
        let cleanedCount = 0;

        for (const [id, timestamp] of processedRewards.entries()) {
            if (timestamp < cutoffTime) {
                processedRewards.delete(id);
                cleanedCount++;
            }
        }

        if (config.debug && cleanedCount > 0) {
            console.log(`TaskRewards: Очищено ${cleanedCount} застарілих записів оброблених винагород`);
        }
    }

    /**
     * Нормалізація винагороди
     * @param {Object} reward - Дані винагороди
     * @returns {Object} Нормалізована винагорода
     */
    function normalizeReward(reward) {
        // Базова перевірка на об'єкт
        if (!reward || typeof reward !== 'object') {
            console.warn('TaskRewards: Отримано невалідну винагороду, використовуємо значення за замовчуванням');
            return {
                type: REWARD_TYPES.TOKENS,
                amount: config.defaultRewardAmount
            };
        }

        // Перевірка та нормалізація типу
        let rewardType;
        if (reward.type && typeof reward.type === 'string') {
            const lowerType = reward.type.toLowerCase();
            rewardType = (lowerType.includes('token') || lowerType.includes('winix')) ?
                REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;
        } else {
            // За замовчуванням
            rewardType = REWARD_TYPES.TOKENS;
        }

        // Перевірка та нормалізація суми
        let rewardAmount = parseFloat(reward.amount);

        // Перевіряємо чи сума є числом
        if (isNaN(rewardAmount)) {
            console.warn('TaskRewards: Невалідна сума винагороди, використовуємо значення за замовчуванням');
            rewardAmount = config.defaultRewardAmount;
        }

        // Обмежуємо суму в допустимих межах
        rewardAmount = Math.max(config.minRewardAmount, Math.min(config.maxRewardAmount, rewardAmount));

        return {
            type: rewardType,
            amount: rewardAmount
        };
    }

    /**
     * Обробка винагороди
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     * @param {string} [operationId] - Унікальний ідентифікатор операції
     */
    function processReward(taskId, reward, operationId) {
        // Перевіряємо чи не виконується інша операція для цього завдання
        if (pendingOperations.has(taskId)) {
            if (config.debug) {
                console.log(`TaskRewards: Інша операція для ${taskId} вже виконується, ставимо в чергу`);
            }

            // Відкладаємо обробку
            setTimeout(() => processReward(taskId, reward, operationId), 500);
            return;
        }

        // Створюємо унікальний ідентифікатор, якщо не переданий
        const uniqueId = operationId || `reward_${taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Перевіряємо, чи не була ця винагорода вже оброблена
        if (config.preventDuplicateRewards && isRewardProcessed(uniqueId)) {
            if (config.debug) {
                console.log(`TaskRewards: Винагорода з ID ${uniqueId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Встановлюємо прапорець блокування
        pendingOperations.add(taskId);

        try {
            // Нормалізуємо винагороду
            const normalizedReward = normalizeReward(reward);

            // Додаємо винагороду до історії
            addToRewardHistory(taskId, normalizedReward, uniqueId);

            // Оновлюємо баланс
            updateBalance(normalizedReward, uniqueId);

            // Показуємо анімацію винагороди
            showRewardAnimation(normalizedReward);

            // Зберігаємо ідентифікатор обробленої винагороди
            markRewardAsProcessed(uniqueId);

            if (config.debug) {
                console.log(`TaskRewards: Оброблено винагороду для завдання ${taskId} з ID ${uniqueId}`, normalizedReward);
            }
        } catch (error) {
            console.error(`TaskRewards: Помилка обробки винагороди для ${taskId}:`, error);
        } finally {
            // Знімаємо прапорець блокування
            pendingOperations.delete(taskId);
        }
    }

    /**
     * Додавання винагороди до історії
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     * @param {string} operationId - Унікальний ідентифікатор операції
     */
    function addToRewardHistory(taskId, reward, operationId) {
        const historyEntry = {
            taskId,
            reward,
            operationId,
            timestamp: Date.now()
        };

        rewardHistory.push(historyEntry);

        // Обмежуємо розмір історії
        if (rewardHistory.length > 100) {
            rewardHistory.shift(); // Видаляємо найстаріший запис
        }

        // Зберігаємо історію в localStorage
        try {
            // Обмежуємо кількість записів до 50 для localStorage
            const historyToSave = rewardHistory.slice(-50);
            localStorage.setItem('winix_reward_history', JSON.stringify(historyToSave));
        } catch (error) {
            console.warn('TaskRewards: Помилка збереження історії винагород:', error);
        }

        // Відправляємо подію добавлення винагороди
        document.dispatchEvent(new CustomEvent('reward-added', {
            detail: { ...historyEntry }
        }));
    }

    /**
     * Оновлення балансу
     * @param {Object} reward - Дані винагороди
     * @param {string} [operationId] - Унікальний ідентифікатор операції
     */
    function updateBalance(reward, operationId) {
        // Створюємо унікальний ідентифікатор, якщо не переданий
        const uniqueId = operationId || `balance_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Перевіряємо, чи не була ця операція вже оброблена
        if (config.preventDuplicateRewards && isRewardProcessed(uniqueId)) {
            if (config.debug) {
                console.log(`TaskRewards: Операція оновлення балансу ${uniqueId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Нормалізуємо винагороду
        const normalizedReward = normalizeReward(reward);

        // Чітко визначаємо тип винагороди
        const rewardType = normalizedReward.type;

        // Валідуємо суму
        const rewardAmount = normalizedReward.amount;

        if (rewardAmount <= 0) {
            console.warn('TaskRewards: Спроба додати нульову або від\'ємну суму');
            return;
        }

        // Визначаємо, який баланс оновлювати
        if (rewardType === REWARD_TYPES.TOKENS) {
            // Оновлюємо токени
            const oldBalance = tokenBalance;
            tokenBalance += rewardAmount;
            updateTokenBalance(tokenBalance, true);

            // Зберігаємо баланс в localStorage
            try {
                localStorage.setItem('userTokens', tokenBalance.toString());
                localStorage.setItem('winix_balance', tokenBalance.toString());
            } catch (e) {
                console.warn('TaskRewards: Помилка збереження балансу токенів в localStorage:', e);
            }

            if (config.debug) {
                console.log(`TaskRewards: Оновлено баланс токенів: +${rewardAmount}, новий баланс: ${tokenBalance}`);
            }

            // Відправляємо подію оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: tokenBalance,
                    reward: normalizedReward,
                    type: rewardType,
                    source: 'task_rewards',
                    operationId: uniqueId,
                    change: rewardAmount
                }
            }));
        } else {
            // Оновлюємо жетони
            const oldBalance = coinsBalance;
            coinsBalance += rewardAmount;
            updateCoinsBalance(coinsBalance, true);

            // Зберігаємо баланс в localStorage
            try {
                localStorage.setItem('userCoins', coinsBalance.toString());
                localStorage.setItem('winix_coins', coinsBalance.toString());
            } catch (e) {
                console.warn('TaskRewards: Помилка збереження балансу жетонів в localStorage:', e);
            }

            if (config.debug) {
                console.log(`TaskRewards: Оновлено баланс жетонів: +${rewardAmount}, новий баланс: ${coinsBalance}`);
            }

            // Відправляємо подію оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: coinsBalance,
                    reward: normalizedReward,
                    type: rewardType,
                    source: 'task_rewards',
                    operationId: uniqueId,
                    change: rewardAmount
                }
            }));
        }

        // Зберігаємо ідентифікатор обробленої операції
        markRewardAsProcessed(uniqueId);
    }

    /**
     * Оновлення відображення балансу токенів
     * @param {number} newBalance - Новий баланс
     * @param {boolean} animate - Чи анімувати зміну
     */
    function updateTokenBalance(newBalance, animate = false) {
        const tokenElement = document.getElementById('user-tokens');
        if (!tokenElement) return;

        // Отримуємо поточне значення
        const oldBalance = parseFloat(tokenElement.textContent) || 0;

        // Встановлюємо нове значення
        tokenElement.textContent = parseFloat(newBalance).toFixed(2);

        // Додаємо анімацію, якщо потрібно
        if (animate) {
            if (newBalance > oldBalance) {
                tokenElement.classList.remove('decreasing');
                tokenElement.classList.add('increasing');
            } else if (newBalance < oldBalance) {
                tokenElement.classList.remove('increasing');
                tokenElement.classList.add('decreasing');
            }

            // Видаляємо класи анімації через 1.5 сек
            setTimeout(() => {
                tokenElement.classList.remove('increasing', 'decreasing');
            }, 1500);
        }
    }

    /**
     * Оновлення відображення балансу жетонів
     * @param {number} newBalance - Новий баланс
     * @param {boolean} animate - Чи анімувати зміну
     */
    function updateCoinsBalance(newBalance, animate = false) {
        const coinsElement = document.getElementById('user-coins');
        if (!coinsElement) return;

        // Отримуємо поточне значення
        const oldBalance = parseInt(coinsElement.textContent) || 0;

        // Встановлюємо нове значення
        coinsElement.textContent = parseInt(newBalance).toString();

        // Додаємо анімацію, якщо потрібно
        if (animate) {
            if (newBalance > oldBalance) {
                coinsElement.classList.remove('decreasing');
                coinsElement.classList.add('increasing');
            } else if (newBalance < oldBalance) {
                coinsElement.classList.remove('increasing');
                coinsElement.classList.add('decreasing');
            }

            // Видаляємо класи анімації через 1.5 сек
            setTimeout(() => {
                coinsElement.classList.remove('increasing', 'decreasing');
            }, 1500);
        }
    }

    // Останній час відображення анімації для уникнення спаму
    let lastAnimationTime = 0;
    let pendingAnimations = [];

    /**
     * Показати анімацію отримання винагороди
     * @param {Object} reward - Дані винагороди
     */
    function showRewardAnimation(reward) {
        // Нормалізуємо винагороду
        const normalizedReward = normalizeReward(reward);

        // Визначаємо тип винагороди
        const rewardType = normalizedReward.type;
        const rewardAmount = normalizedReward.amount;

        // Перевіряємо, чи потрібно затримати анімацію
        const now = Date.now();
        if (config.throttleAnimations && now - lastAnimationTime < 1000) {
            // Додаємо анімацію в чергу
            pendingAnimations.push(normalizedReward);

            // Якщо черга ще не опрацьовується, запускаємо процес
            if (pendingAnimations.length === 1) {
                setTimeout(processPendingAnimations, 1000 - (now - lastAnimationTime));
            }

            return;
        }

        // Оновлюємо час останньої анімації
        lastAnimationTime = now;

        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && typeof window.UI.Animations.showReward === 'function') {
            try {
                // Переконуємося, що передаємо коректну винагороду
                window.UI.Animations.showReward({
                    type: rewardType,
                    amount: rewardAmount
                });
                return;
            } catch (error) {
                console.warn('TaskRewards: Помилка показу анімації через UI.Animations:', error);
            }
        }

        // Інакше робимо просту анімацію
        const displayType = rewardType === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів';

        // Створюємо елемент анімації, якщо він ще не існує
        let animationContainer = document.querySelector('.rewards-animation-container');
        if (!animationContainer) {
            animationContainer = document.createElement('div');
            animationContainer.className = 'rewards-animation-container';
            document.body.appendChild(animationContainer);
        }

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
        animationElement.textContent = `+${rewardAmount} ${displayType}`;

        // Додаємо класи залежно від типу винагороди
        if (rewardType === REWARD_TYPES.TOKENS) {
            animationElement.classList.add('tokens-reward');
        } else {
            animationElement.classList.add('coins-reward');
        }

        // Додаємо елемент до контейнера
        animationContainer.appendChild(animationElement);

        // Запускаємо анімацію
        setTimeout(() => {
            animationElement.classList.add('show');

            // Видаляємо елемент через 2 секунди
            setTimeout(() => {
                animationElement.classList.remove('show');
                setTimeout(() => {
                    animationElement.remove();

                    // Видаляємо контейнер, якщо він порожній
                    if (animationContainer.children.length === 0) {
                        animationContainer.remove();
                    }
                }, 300);
            }, 2000);
        }, 100);
    }

    /**
     * Обробка черги анімацій
     */
    function processPendingAnimations() {
        if (pendingAnimations.length === 0) return;

        // Отримуємо наступну анімацію
        const nextAnimation = pendingAnimations.shift();

        // Показуємо анімацію
        showRewardAnimation(nextAnimation);

        // Плануємо обробку наступної анімації
        if (pendingAnimations.length > 0) {
            setTimeout(processPendingAnimations, 1000);
        }
    }

    /**
     * Отримання історії винагород
     * @returns {Array} Історія винагород
     */
    function getRewardHistory() {
        return [...rewardHistory];
    }

    /**
     * Отримання поточного балансу
     * @param {string} type - Тип балансу ('tokens' або 'coins')
     * @returns {number} Поточний баланс
     */
    function getBalance(type) {
        if (type === REWARD_TYPES.TOKENS) {
            return tokenBalance;
        } else if (type === REWARD_TYPES.COINS) {
            return coinsBalance;
        }
        return 0;
    }

    /**
     * Встановлення нового значення балансу
     * @param {string} type - Тип балансу ('tokens' або 'coins')
     * @param {number} amount - Нове значення
     * @param {boolean} animate - Чи анімувати зміну
     * @returns {boolean} Успішність операції
     */
    function setBalance(type, amount, animate = false) {
        try {
            // Перевіряємо тип
            if (type !== REWARD_TYPES.TOKENS && type !== REWARD_TYPES.COINS) {
                console.error(`TaskRewards: Невідомий тип балансу: ${type}`);
                return false;
            }

            // Перевіряємо значення
            const newValue = parseFloat(amount);
            if (isNaN(newValue) || newValue < 0) {
                console.error(`TaskRewards: Невалідне значення балансу: ${amount}`);
                return false;
            }

            // Оновлюємо баланс
            if (type === REWARD_TYPES.TOKENS) {
                tokenBalance = newValue;
                updateTokenBalance(tokenBalance, animate);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userTokens', tokenBalance.toString());
                    localStorage.setItem('winix_balance', tokenBalance.toString());
                } catch (e) {}
            } else {
                coinsBalance = newValue;
                updateCoinsBalance(coinsBalance, animate);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userCoins', coinsBalance.toString());
                    localStorage.setItem('winix_coins', coinsBalance.toString());
                } catch (e) {}
            }

            // Відправляємо подію
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    newBalance: type === REWARD_TYPES.TOKENS ? tokenBalance : coinsBalance,
                    type: type,
                    source: 'task_rewards_set',
                    operationId: `set_balance_${Date.now()}`
                }
            }));

            return true;
        } catch (error) {
            console.error('TaskRewards: Помилка встановлення балансу:', error);
            return false;
        }
    }

    /**
     * Додати винагороду вручну (для тестування)
     * @param {string} type - Тип винагороди ('tokens' або 'coins')
     * @param {number} amount - Кількість
     */
    function addReward(type, amount) {
        // Нормалізуємо тип
        const rewardType = type === REWARD_TYPES.TOKENS ? REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;

        // Нормалізуємо суму
        const rewardAmount = Math.max(0, parseFloat(amount) || 0);

        if (rewardAmount <= 0) {
            console.warn('TaskRewards: Спроба додати винагороду з нульовою або від\'ємною сумою');
            return false;
        }

        const reward = {
            type: rewardType,
            amount: rewardAmount
        };

        // Створюємо унікальний ідентифікатор для ручного додавання
        const uniqueId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Обробляємо винагороду
        processReward('manual', reward, uniqueId);

        return true;
    }

    /**
     * Оновлення конфігурації
     * @param {Object} newConfig - Нові налаштування
     */
    function updateConfig(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') return;

        Object.keys(newConfig).forEach(key => {
            if (key in config) {
                config[key] = newConfig[key];

                if (config.debug) {
                    console.log(`TaskRewards: Оновлено конфігурацію: ${key} = ${newConfig[key]}`);
                }
            }
        });
    }

    /**
     * Скидання стану модуля (для тестування)
     */
    function resetState() {
        // Очищаємо реєстр оброблених винагород
        processedRewards.clear();

        // Очищаємо історію винагород
        rewardHistory.length = 0;

        // Очищаємо список блокувань
        pendingOperations.clear();

        // Очищаємо чергу анімацій
        pendingAnimations.length = 0;

        // Оновлюємо баланси з DOM
        loadBalance();

        if (config.debug) {
            console.log('TaskRewards: Стан модуля скинуто');
        }
    }

    // Публічний API модуля
    return {
        init,
        updateBalance,
        showRewardAnimation,
        getRewardHistory,
        addReward,
        normalizeReward,
        resetState,
        getBalance,
        setBalance,
        updateConfig,
        REWARD_TYPES
    };
})();

// Ініціалізуємо модуль при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    if (window.TaskRewards) {
        window.TaskRewards.init();
    }
});