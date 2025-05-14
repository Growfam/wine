/**
 * TaskRewards - модуль для управління винагородами
 * Версія: 1.1.0
 *
 * Відповідає за:
 * - Нарахування винагород за виконані завдання
 * - Анімацію отримання винагород
 * - Оновлення балансу користувача
 * - Запобігання дублюванню операцій з балансом
 *
 * ВИПРАВЛЕННЯ:
 * - Прискорене оновлення балансу без затримок
 * - Оптимізовані анімації для запобігання зависань
 * - Покращена синхронізація між модулями
 * - Виправлено баг з відображенням балансів
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
    const DEDUPLICATION_WINDOW = 5000; // 5 секунд

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
        throttleAnimations: true,
        useDirectDomUpdates: true,     // Використовувати пряме оновлення DOM (швидше)
        animationDebounce: 300,        // Мінімальний час між анімаціями (мс)
        batchUpdates: true,            // Групувати оновлення балансу (ефективніше)
        balanceUpdateInterval: 100,    // Інтервал групування оновлень (мс)
        prioritizeVisualFeedback: true // Спочатку оновлювати DOM, потім інші операції
    };

    // Дані для пакетного оновлення балансу
    const batchUpdateData = {
        tokens: 0,
        coins: 0,
        lastUpdate: 0,
        updateTimer: null
    };

    // Історія анімацій для запобігання зависань
    const animationHistory = {
        lastAnimation: 0,
        queue: [],
        isProcessing: false
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

        // Встановлюємо тестовий прапорець для перевірки ініціалізації
        window._taskRewardsInitialized = true;
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

        // Додаємо обробку завершення завантаження сторінки
        if (document.readyState !== 'complete') {
            window.addEventListener('load', loadBalance);
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
        const data = event.detail;
        const { reward, token_amount, eventId, new_balance, new_coins } = data;

        // Перевіряємо на дублювання обробки події
        if (config.preventDuplicateRewards && eventId && isRewardProcessed(eventId)) {
            if (config.debug) {
                console.log(`TaskRewards: Подія отримання щоденного бонусу ${eventId} вже була оброблена, ігноруємо`);
            }
            return;
        }

        // Якщо є винагорода WINIX, обробляємо її
        if (reward) {
            if (config.debug) {
                console.log(`TaskRewards: Отримано щоденний бонус: ${reward} WINIX`);
            }

            // Нормалізуємо винагороду
            const normalizedReward = {
                type: REWARD_TYPES.TOKENS,
                amount: parseFloat(reward),
                newBalance: new_balance
            };

            // Обробляємо винагороду
            processReward('daily_bonus', normalizedReward, eventId || `daily_bonus_${Date.now()}`);
        }

        // Якщо є винагорода у вигляді жетонів, обробляємо її
        if (token_amount && token_amount > 0) {
            if (config.debug) {
                console.log(`TaskRewards: Отримано жетони: ${token_amount}`);
            }

            // Нормалізуємо винагороду
            const normalizedTokenReward = {
                type: REWARD_TYPES.COINS,
                amount: parseInt(token_amount),
                newBalance: new_coins
            };

            // Обробляємо винагороду
            processReward('daily_bonus_tokens', normalizedTokenReward, eventId ? `${eventId}_tokens` : `daily_bonus_tokens_${Date.now()}`);
        }

        // Перевіряємо наявність бонусу за завершення циклу
        if (data.cycle_completed && data.completion_bonus) {
            // Обробляємо бонус WINIX за завершення циклу
            if (data.completion_bonus.amount) {
                const completionReward = {
                    type: REWARD_TYPES.TOKENS,
                    amount: parseFloat(data.completion_bonus.amount)
                };

                processReward('cycle_completion', completionReward, `cycle_completion_${Date.now()}`);
            }

            // Обробляємо бонус жетонів за завершення циклу
            if (data.completion_bonus.tokens) {
                const completionTokens = {
                    type: REWARD_TYPES.COINS,
                    amount: parseInt(data.completion_bonus.tokens)
                };

                processReward('cycle_completion_tokens', completionTokens, `cycle_completion_tokens_${Date.now()}`);
            }
        }
    }

    /**
     * Обробник події отримання бонусу за стрік
     * @param {CustomEvent} event - Подія отримання бонусу за стрік
     */
    function handleStreakBonusClaimed(event) {
        const { reward, eventId, new_balance } = event.detail;

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
                amount: parseFloat(reward),
                newBalance: new_balance
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

        // Синхронізуємо значення між DOM і localStorage
        if (tokensLoaded && config.syncWithLocalStorage) {
            try {
                localStorage.setItem('userTokens', tokenBalance.toString());
                localStorage.setItem('winix_balance', tokenBalance.toString());
            } catch (e) {}
        } else if (!tokensLoaded && tokenBalance > 0 && config.useDirectDomUpdates) {
            updateTokenBalance(tokenBalance, false);
        }

        if (coinsLoaded && config.syncWithLocalStorage) {
            try {
                localStorage.setItem('userCoins', coinsBalance.toString());
                localStorage.setItem('winix_coins', coinsBalance.toString());
            } catch (e) {}
        } else if (!coinsLoaded && coinsBalance > 0 && config.useDirectDomUpdates) {
            updateCoinsBalance(coinsBalance, false);
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

        // Ігноруємо власні події, щоб уникнути циклічних оновлень
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
            // Оновлюємо тільки якщо значення змінилося
            if (newBalance !== undefined && newBalance !== tokenBalance) {
                tokenBalance = newBalance;
                if (config.debug) {
                    console.log(`TaskRewards: Оновлено баланс токенів із зовнішньої події: ${tokenBalance}`);
                }
                updateTokenBalance(tokenBalance, false);
            }
        } else if (type === REWARD_TYPES.COINS) {
            // Оновлюємо тільки якщо значення змінилося
            if (newBalance !== undefined && newBalance !== coinsBalance) {
                coinsBalance = newBalance;
                if (config.debug) {
                    console.log(`TaskRewards: Оновлено баланс жетонів із зовнішньої події: ${coinsBalance}`);
                }
                updateCoinsBalance(coinsBalance, false);
            }
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

        // Готуємо результат з усіма даними
        const result = {
            type: rewardType,
            amount: rewardAmount
        };

        // Додаємо новий загальний баланс, якщо він є
        if ('newBalance' in reward && reward.newBalance !== null && !isNaN(reward.newBalance)) {
            result.newBalance = parseFloat(reward.newBalance);
        }

        return result;
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

            // Відкладаємо обробку з короткою затримкою
            setTimeout(() => processReward(taskId, reward, operationId), 100);
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

            // Оновлюємо баланс негайно
            updateBalance(normalizedReward, uniqueId);

            // Показуємо анімацію винагороди з дебаунсингом
            scheduleRewardAnimation(normalizedReward);

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
     * Відправка події оновлення балансу для синхронізації
     * @param {string} type - Тип балансу
     * @param {number} oldBalance - Старий баланс
     * @param {number} newBalance - Новий баланс
     * @param {number} change - Зміна балансу
     * @param {string} uniqueId - Унікальний ідентифікатор операції
     */
    function dispatchBalanceUpdateEvent(type, oldBalance, newBalance, change, uniqueId) {
        // Відправляємо подію оновлення балансу для синхронізації з іншими модулями
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                oldBalance: oldBalance,
                newBalance: newBalance,
                type: type,
                source: 'task_rewards',
                operationId: uniqueId,
                change: change
            }
        }));
    }

    /**
     * Планування пакетного оновлення балансу
     */
    function scheduleBatchUpdate() {
        // Отримуємо поточний час
        const now = Date.now();

        // Якщо вже заплановано оновлення, просто вийдемо
        if (batchUpdateData.updateTimer !== null) {
            return;
        }

        // Обчислюємо час до наступного оновлення
        const timeToUpdate = Math.max(0, config.balanceUpdateInterval - (now - batchUpdateData.lastUpdate));

        // Плануємо оновлення
        batchUpdateData.updateTimer = setTimeout(() => {
            // Оновлюємо баланси
            if (batchUpdateData.tokens !== 0) {
                const oldBalance = tokenBalance;
                tokenBalance += batchUpdateData.tokens;
                updateTokenBalance(tokenBalance, true);

                // Зберігаємо баланс в localStorage
                try {
                    localStorage.setItem('userTokens', tokenBalance.toString());
                    localStorage.setItem('winix_balance', tokenBalance.toString());
                } catch (e) {}

                // Відправляємо подію
                dispatchBalanceUpdateEvent(
                    REWARD_TYPES.TOKENS,
                    oldBalance,
                    tokenBalance,
                    batchUpdateData.tokens,
                    `batch_update_tokens_${now}`
                );

                // Скидаємо накопичену зміну
                batchUpdateData.tokens = 0;
            }

            if (batchUpdateData.coins !== 0) {
                const oldBalance = coinsBalance;
                coinsBalance += batchUpdateData.coins;
                updateCoinsBalance(coinsBalance, true);

                // Зберігаємо баланс в localStorage
                try {
                    localStorage.setItem('userCoins', coinsBalance.toString());
                    localStorage.setItem('winix_coins', coinsBalance.toString());
                } catch (e) {}

                // Відправляємо подію
                dispatchBalanceUpdateEvent(
                    REWARD_TYPES.COINS,
                    oldBalance,
                    coinsBalance,
                    batchUpdateData.coins,
                    `batch_update_coins_${now}`
                );

                // Скидаємо накопичену зміну
                batchUpdateData.coins = 0;
            }

            // Оновлюємо час останнього оновлення
            batchUpdateData.lastUpdate = now;
            batchUpdateData.updateTimer = null;

        }, timeToUpdate);
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

        // Якщо використовуємо батчинг для оновлень, додаємо до накопиченої суми
        if (config.batchUpdates) {
            if (rewardType === REWARD_TYPES.TOKENS) {
                // Якщо переданий конкретний новий баланс, використовуємо його напряму
                if ('newBalance' in normalizedReward && normalizedReward.newBalance !== null) {
                    const oldBalance = tokenBalance;
                    tokenBalance = normalizedReward.newBalance;

                    // Оновлюємо інтерфейс
                    updateTokenBalance(tokenBalance, true);

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('userTokens', tokenBalance.toString());
                        localStorage.setItem('winix_balance', tokenBalance.toString());
                    } catch (e) {}

                    // Відправляємо подію оновлення балансу для синхронізації
                    dispatchBalanceUpdateEvent(
                        rewardType,
                        oldBalance,
                        tokenBalance,
                        tokenBalance - oldBalance,
                        uniqueId
                    );
                } else {
                    // В іншому випадку накопичуємо зміни
                    batchUpdateData.tokens += rewardAmount;

                    // ВАЖЛИВЕ РІШЕННЯ: Оновлюємо DOM негайно для візуального зворотного зв'язку
                    if (config.prioritizeVisualFeedback) {
                        const newBalance = tokenBalance + batchUpdateData.tokens;
                        updateTokenBalance(newBalance, true);
                    }

                    // Плануємо оновлення
                    scheduleBatchUpdate();
                }
            } else if (rewardType === REWARD_TYPES.COINS) {
                // Якщо переданий конкретний новий баланс, використовуємо його напряму
                if ('newBalance' in normalizedReward && normalizedReward.newBalance !== null) {
                    const oldBalance = coinsBalance;
                    coinsBalance = normalizedReward.newBalance;

                    // Оновлюємо інтерфейс
                    updateCoinsBalance(coinsBalance, true);

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('userCoins', coinsBalance.toString());
                        localStorage.setItem('winix_coins', coinsBalance.toString());
                    } catch (e) {}

                    // Відправляємо подію оновлення балансу для синхронізації
                    dispatchBalanceUpdateEvent(
                        rewardType,
                        oldBalance,
                        coinsBalance,
                        coinsBalance - oldBalance,
                        uniqueId
                    );
                } else {
                    // В іншому випадку накопичуємо зміни
                    batchUpdateData.coins += rewardAmount;

                    // ВАЖЛИВЕ РІШЕННЯ: Оновлюємо DOM негайно для візуального зворотного зв'язку
                    if (config.prioritizeVisualFeedback) {
                        const newBalance = coinsBalance + batchUpdateData.coins;
                        updateCoinsBalance(newBalance, true);
                    }

                    // Плануємо оновлення
                    scheduleBatchUpdate();
                }
            }
        } else {
            // Не використовуємо батчинг, оновлюємо балансу відразу
            if (rewardType === REWARD_TYPES.TOKENS) {
                // Якщо переданий конкретний новий баланс, використовуємо його напряму
                const oldBalance = tokenBalance;

                if ('newBalance' in normalizedReward && normalizedReward.newBalance !== null) {
                    tokenBalance = normalizedReward.newBalance;
                } else {
                    tokenBalance += rewardAmount;
                }

                // Оновлюємо інтерфейс
                updateTokenBalance(tokenBalance, true);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userTokens', tokenBalance.toString());
                    localStorage.setItem('winix_balance', tokenBalance.toString());
                } catch (e) {}

                // Відправляємо подію оновлення балансу для синхронізації
                dispatchBalanceUpdateEvent(
                    rewardType,
                    oldBalance,
                    tokenBalance,
                    tokenBalance - oldBalance,
                    uniqueId
                );
            } else if (rewardType === REWARD_TYPES.COINS) {
                // Якщо переданий конкретний новий баланс, використовуємо його напряму
                const oldBalance = coinsBalance;

                if ('newBalance' in normalizedReward && normalizedReward.newBalance !== null) {
                    coinsBalance = normalizedReward.newBalance;
                } else {
                    coinsBalance += rewardAmount;
                }

                // Оновлюємо інтерфейс
                updateCoinsBalance(coinsBalance, true);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userCoins', coinsBalance.toString());
                    localStorage.setItem('winix_coins', coinsBalance.toString());
                } catch (e) {}

                // Відправляємо подію оновлення балансу для синхронізації
                dispatchBalanceUpdateEvent(
                    rewardType,
                    oldBalance,
                    coinsBalance,
                    coinsBalance - oldBalance,
                    uniqueId
                );
            }
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

        // Якщо значення не змінилося, не оновлюємо DOM щоб уникнути зайвих перемальовувань
        if (Math.abs(oldBalance - newBalance) < 0.01) {
            return;
        }

        // Встановлюємо нове значення з обмеженою точністю для економії пам'яті
        tokenElement.textContent = parseFloat(newBalance).toFixed(2);

        // Додаємо анімацію, якщо потрібно
        if (animate) {
            if (newBalance > oldBalance) {
                // Видаляємо попередні класи анімації перед додаванням нових
                tokenElement.classList.remove('decreasing');
                // Використовуємо requestAnimationFrame для сумісності з GPU
                requestAnimationFrame(() => {
                    tokenElement.classList.add('increasing');
                    // Видаляємо клас анімації через 1.5 сек
                    setTimeout(() => {
                        tokenElement.classList.remove('increasing');
                    }, 1500);
                });
            } else if (newBalance < oldBalance) {
                tokenElement.classList.remove('increasing');
                requestAnimationFrame(() => {
                    tokenElement.classList.add('decreasing');
                    setTimeout(() => {
                        tokenElement.classList.remove('decreasing');
                    }, 1500);
                });
            }
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

        // Якщо значення не змінилося, не оновлюємо DOM щоб уникнути зайвих перемальовувань
        if (oldBalance === newBalance) {
            return;
        }

        // Встановлюємо нове значення
        coinsElement.textContent = parseInt(newBalance).toString();

        // Додаємо анімацію, якщо потрібно
        if (animate) {
            if (newBalance > oldBalance) {
                // Видаляємо попередні класи анімації перед додаванням нових
                coinsElement.classList.remove('decreasing');
                requestAnimationFrame(() => {
                    coinsElement.classList.add('increasing');
                    // Видаляємо клас анімації через 1.5 сек
                    setTimeout(() => {
                        coinsElement.classList.remove('increasing');
                    }, 1500);
                });
            } else if (newBalance < oldBalance) {
                coinsElement.classList.remove('increasing');
                requestAnimationFrame(() => {
                    coinsElement.classList.add('decreasing');
                    setTimeout(() => {
                        coinsElement.classList.remove('decreasing');
                    }, 1500);
                });
            }
        }
    }

    /**
     * Планування показу анімації винагороди з дебаунсингом
     * @param {Object} reward - Нормалізована винагорода
     */
    function scheduleRewardAnimation(reward) {
        // Додаємо анімацію в чергу
        animationHistory.queue.push(reward);

        // Якщо зараз не обробляється черга, запускаємо процес
        if (!animationHistory.isProcessing) {
            processAnimationQueue();
        }
    }

    /**
     * Обробка черги анімацій з дебаунсингом
     */
    function processAnimationQueue() {
        // Встановлюємо прапорець обробки
        animationHistory.isProcessing = true;

        // Перевіряємо наявність анімацій в черзі
        if (animationHistory.queue.length === 0) {
            animationHistory.isProcessing = false;
            return;
        }

        // Отримуємо поточний час
        const now = Date.now();

        // Перевіряємо, чи минув мінімальний інтервал між анімаціями
        if (now - animationHistory.lastAnimation < config.animationDebounce) {
            // Якщо ні, плануємо обробку через необхідний інтервал
            const waitTime = config.animationDebounce - (now - animationHistory.lastAnimation);
            setTimeout(processAnimationQueue, waitTime);
            return;
        }

        // Отримуємо наступну анімацію з черги
        const nextReward = animationHistory.queue.shift();

        // Показуємо анімацію
        if (nextReward) {
            showRewardAnimation(nextReward);

            // Оновлюємо час останньої анімації
            animationHistory.lastAnimation = now;

            // Плануємо обробку наступної анімації
            setTimeout(processAnimationQueue, config.animationDebounce);
        } else {
            // Якщо черга порожня, скидаємо прапорець обробки
            animationHistory.isProcessing = false;
        }
    }

    /**
     * Показати анімацію отримання винагороди
     * @param {Object} reward - Дані винагороди
     */
    function showRewardAnimation(reward) {
        // Перевіряємо наявість даних винагороди
        if (!reward) return;

        // Визначаємо тип винагороди
        const rewardType = reward.type;
        const rewardAmount = reward.amount;

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
            animationContainer.style.position = 'fixed';
            animationContainer.style.top = '0';
            animationContainer.style.left = '0';
            animationContainer.style.width = '100%';
            animationContainer.style.height = '100%';
            animationContainer.style.pointerEvents = 'none';
            animationContainer.style.zIndex = '9999';
            animationContainer.style.overflow = 'hidden';
            document.body.appendChild(animationContainer);
        }

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
        animationElement.textContent = `+${rewardAmount} ${displayType}`;
        animationElement.style.position = 'fixed';
        animationElement.style.top = '50%';
        animationElement.style.left = '50%';
        animationElement.style.transform = 'translate(-50%, -50%) scale(0)';
        animationElement.style.padding = '1rem 1.5rem';
        animationElement.style.borderRadius = '1rem';
        animationElement.style.fontWeight = 'bold';
        animationElement.style.fontSize = '1.5rem';
        animationElement.style.zIndex = '1000';
        animationElement.style.opacity = '0';
        animationElement.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        animationElement.style.willChange = 'transform, opacity';

        // Додаємо класи залежно від типу винагороди
        if (rewardType === REWARD_TYPES.TOKENS) {
            animationElement.classList.add('tokens-reward');
            animationElement.style.background = 'linear-gradient(135deg, #4eb5f7, #00C9A7)';
            animationElement.style.color = 'white';
            animationElement.style.boxShadow = '0 0 1.25rem rgba(0, 201, 167, 0.5)';
        } else {
            animationElement.classList.add('coins-reward');
            animationElement.style.background = 'linear-gradient(135deg, #FFD700, #FFA000)';
            animationElement.style.color = '#000';
            animationElement.style.boxShadow = '0 0 1.25rem rgba(255, 215, 0, 0.5)';
        }

        // Додаємо елемент до контейнера
        animationContainer.appendChild(animationElement);

        // Запускаємо анімацію
        requestAnimationFrame(() => {
            // Показуємо анімацію
            setTimeout(() => {
                animationElement.style.transform = 'translate(-50%, -50%) scale(1)';
                animationElement.style.opacity = '1';

                // Видаляємо елемент через 2 секунди
                setTimeout(() => {
                    animationElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                    animationElement.style.opacity = '0';

                    setTimeout(() => {
                        animationElement.remove();

                        // Видаляємо контейнер, якщо він порожній
                        if (animationContainer.children.length === 0) {
                            animationContainer.remove();
                        }
                    }, 300);
                }, 2000);
            }, 10);
        });
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

            // Створюємо унікальний ID для операції
            const operationId = `set_balance_${type}_${Date.now()}`;

            // Оновлюємо баланс
            if (type === REWARD_TYPES.TOKENS) {
                const oldBalance = tokenBalance;
                tokenBalance = newValue;

                // Оновлюємо відображення
                updateTokenBalance(tokenBalance, animate);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userTokens', tokenBalance.toString());
                    localStorage.setItem('winix_balance', tokenBalance.toString());
                } catch (e) {}

                // Скидаємо накопичені зміни батчингу
                if (config.batchUpdates) {
                    batchUpdateData.tokens = 0;
                    if (batchUpdateData.updateTimer !== null) {
                        clearTimeout(batchUpdateData.updateTimer);
                        batchUpdateData.updateTimer = null;
                    }
                }

                // Відправляємо подію
                dispatchBalanceUpdateEvent(
                    type,
                    oldBalance,
                    tokenBalance,
                    tokenBalance - oldBalance,
                    operationId
                );
            } else {
                const oldBalance = coinsBalance;
                coinsBalance = newValue;

                // Оновлюємо відображення
                updateCoinsBalance(coinsBalance, animate);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userCoins', coinsBalance.toString());
                    localStorage.setItem('winix_coins', coinsBalance.toString());
                } catch (e) {}

                // Скидаємо накопичені зміни батчингу
                if (config.batchUpdates) {
                    batchUpdateData.coins = 0;
                    if (batchUpdateData.updateTimer !== null) {
                        clearTimeout(batchUpdateData.updateTimer);
                        batchUpdateData.updateTimer = null;
                    }
                }

                // Відправляємо подію
                dispatchBalanceUpdateEvent(
                    type,
                    oldBalance,
                    coinsBalance,
                    coinsBalance - oldBalance,
                    operationId
                );
            }

            // Зберігаємо ID операції в реєстрі
            markRewardAsProcessed(operationId);

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
        animationHistory.queue.length = 0;
        animationHistory.isProcessing = false;

        // Скидаємо дані для батчингу
        batchUpdateData.tokens = 0;
        batchUpdateData.coins = 0;
        if (batchUpdateData.updateTimer !== null) {
            clearTimeout(batchUpdateData.updateTimer);
            batchUpdateData.updateTimer = null;
        }

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