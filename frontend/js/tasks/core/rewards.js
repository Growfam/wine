/**
 * Rewards - модуль для управління винагородами
 * Відповідає за:
 * - Нарахування винагород за виконані завдання
 * - Анімацію отримання винагород
 * - Оновлення балансу користувача
 */

window.TaskRewards = (function() {
    // Приватні змінні модуля
    let tokenBalance = 0;
    let coinsBalance = 0;

    // Історія винагород
    const rewardHistory = [];

    // Реєстр оброблених винагород для запобігання дублюванню
    const processedRewards = {};

    // Константи типів винагород (уніфіковані з іншими модулями)
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    /**
     * Ініціалізація модуля винагород
     */
    function init() {
        console.log('TaskRewards: Ініціалізація модуля винагород');

        // Завантажуємо початковий баланс
        loadBalance();

        // Підписуємося на події
        subscribeToEvents();
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
    }

    /**
     * Завантаження балансу
     */
    function loadBalance() {
        // Спробуємо отримати баланс з DOM
        const tokenElement = document.getElementById('user-tokens');
        const coinsElement = document.getElementById('user-coins');

        if (tokenElement) {
            tokenBalance = parseFloat(tokenElement.textContent) || 0;
        } else {
            // Спробуємо з localStorage
            tokenBalance = parseFloat(localStorage.getItem('userTokens') || '0');
        }

        if (coinsElement) {
            coinsBalance = parseInt(coinsElement.textContent) || 0;
        } else {
            // Спробуємо з localStorage
            coinsBalance = parseInt(localStorage.getItem('userCoins') || '0');
        }

        console.log(`TaskRewards: Початковий баланс завантажено - Токени: ${tokenBalance}, Жетони: ${coinsBalance}`);
    }

    /**
     * Обробник події результату перевірки
     * @param {CustomEvent} event - Подія результату перевірки
     */
    function handleVerificationResult(event) {
        const { taskId, result, eventId } = event.detail;

        // Перевіряємо на дублювання обробки події
        if (eventId && processedRewards[eventId]) {
            console.log(`TaskRewards: Подія верифікації ${eventId} вже була оброблена, ігноруємо`);
            return;
        }

        // Якщо перевірка успішна і є винагорода
        if (result && result.success && result.reward) {
            console.log(`TaskRewards: Отримано результат верифікації для завдання ${taskId}`, result.reward);

            // Обробляємо винагороду
            processReward(taskId, result.reward, eventId);

            // Зберігаємо ідентифікатор обробленої події
            if (eventId) {
                processedRewards[eventId] = Date.now();

                // Очищення старих записів (старіших за 1 годину)
                cleanupProcessedRewards();
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
        if (eventId && processedRewards[eventId]) {
            console.log(`TaskRewards: Подія завершення завдання ${eventId} вже була оброблена, ігноруємо`);
            return;
        }

        // Якщо є винагорода, обробляємо її
        if (reward) {
            console.log(`TaskRewards: Отримано винагороду за завершення завдання ${taskId}`, reward);

            // Обробляємо винагороду
            processReward(taskId, reward, eventId);

            // Зберігаємо ідентифікатор обробленої події
            if (eventId) {
                processedRewards[eventId] = Date.now();
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
        if (operationId && processedRewards[operationId]) {
            console.log(`TaskRewards: Операція ${operationId} вже була оброблена, ігноруємо`);
            return;
        }

        // Оновлюємо локальний баланс, тільки якщо тип чітко вказаний
        if (type === REWARD_TYPES.TOKENS) {
            tokenBalance = newBalance;
            console.log(`TaskRewards: Оновлено баланс токенів із зовнішньої події: ${tokenBalance}`);
        } else if (type === REWARD_TYPES.COINS) {
            coinsBalance = newBalance;
            console.log(`TaskRewards: Оновлено баланс жетонів із зовнішньої події: ${coinsBalance}`);
        }

        // Зберігаємо ідентифікатор обробленої операції
        if (operationId) {
            processedRewards[operationId] = Date.now();
        }
    }

    /**
     * Очищення застарілих записів оброблених винагород
     */
    function cleanupProcessedRewards() {
        const oneHourAgo = Date.now() - 3600000; // 1 година в мілісекундах
        Object.keys(processedRewards).forEach(key => {
            if (processedRewards[key] < oneHourAgo) {
                delete processedRewards[key];
            }
        });
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
                amount: 10
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
        const rewardAmount = Math.max(0, parseFloat(reward.amount) || 0);

        if (rewardAmount <= 0) {
            console.warn('TaskRewards: Винагорода з нульовою або від\'ємною сумою, використовуємо значення за замовчуванням');
            return {
                type: rewardType,
                amount: 10
            };
        }

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
        // Створюємо унікальний ідентифікатор, якщо не переданий
        const uniqueId = operationId || `reward_${taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Перевіряємо, чи не була ця винагорода вже оброблена
        if (processedRewards[uniqueId]) {
            console.log(`TaskRewards: Винагорода з ID ${uniqueId} вже була оброблена, ігноруємо`);
            return;
        }

        // Нормалізуємо винагороду
        const normalizedReward = normalizeReward(reward);

        // Додаємо винагороду до історії
        addToRewardHistory(taskId, normalizedReward, uniqueId);

        // Оновлюємо баланс
        updateBalance(normalizedReward, uniqueId);

        // Показуємо анімацію винагороди
        showRewardAnimation(normalizedReward);

        // Зберігаємо ідентифікатор обробленої винагороди
        processedRewards[uniqueId] = Date.now();

        console.log(`TaskRewards: Оброблено винагороду для завдання ${taskId} з ID ${uniqueId}`, normalizedReward);
    }

    /**
     * Додавання винагороди до історії
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     * @param {string} operationId - Унікальний ідентифікатор операції
     */
    function addToRewardHistory(taskId, reward, operationId) {
        rewardHistory.push({
            taskId,
            reward,
            operationId,
            timestamp: Date.now()
        });

        // Зберігаємо історію в localStorage
        try {
            // Обмежуємо кількість записів до 50
            const historyToSave = rewardHistory.slice(-50);
            localStorage.setItem('winix_reward_history', JSON.stringify(historyToSave));
        } catch (error) {
            console.warn('TaskRewards: Помилка збереження історії винагород:', error);
        }
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
        if (processedRewards[uniqueId]) {
            console.log(`TaskRewards: Операція оновлення балансу ${uniqueId} вже була оброблена, ігноруємо`);
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
            localStorage.setItem('userTokens', tokenBalance.toString());
            localStorage.setItem('winix_balance', tokenBalance.toString());

            console.log(`TaskRewards: Оновлено баланс токенів: +${rewardAmount}, новий баланс: ${tokenBalance}`);

            // Відправляємо подію оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: tokenBalance,
                    reward: normalizedReward,
                    type: rewardType,
                    source: 'task_rewards',
                    operationId: uniqueId
                }
            }));
        } else {
            // Оновлюємо жетони
            const oldBalance = coinsBalance;
            coinsBalance += rewardAmount;
            updateCoinsBalance(coinsBalance, true);

            // Зберігаємо баланс в localStorage
            localStorage.setItem('userCoins', coinsBalance.toString());
            localStorage.setItem('winix_coins', coinsBalance.toString());

            console.log(`TaskRewards: Оновлено баланс жетонів: +${rewardAmount}, новий баланс: ${coinsBalance}`);

            // Відправляємо подію оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: coinsBalance,
                    reward: normalizedReward,
                    type: rewardType,
                    source: 'task_rewards',
                    operationId: uniqueId
                }
            }));
        }

        // Зберігаємо ідентифікатор обробленої операції
        processedRewards[uniqueId] = Date.now();
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
        tokenElement.textContent = newBalance.toFixed(2);

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
        coinsElement.textContent = newBalance;

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

        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            // Переконуємося, що передаємо коректну винагороду
            window.UI.Animations.showReward({
                type: rewardType,
                amount: rewardAmount
            });
            return;
        }

        // Інакше робимо просту анімацію
        const displayType = rewardType === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів';

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

        // Додаємо елемент до body
        document.body.appendChild(animationElement);

        // Запускаємо анімацію
        setTimeout(() => {
            animationElement.classList.add('show');

            // Видаляємо елемент через 2 секунди
            setTimeout(() => {
                animationElement.classList.remove('show');
                setTimeout(() => {
                    animationElement.remove();
                }, 300);
            }, 2000);
        }, 100);
    }

    /**
     * Отримання історії винагород
     * @returns {Array} Історія винагород
     */
    function getRewardHistory() {
        return [...rewardHistory];
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
     * Скидання стану модуля (для тестування)
     */
    function resetState() {
        // Очищаємо реєстр оброблених винагород
        Object.keys(processedRewards).forEach(key => {
            delete processedRewards[key];
        });

        console.log('TaskRewards: Стан модуля скинуто');
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
        REWARD_TYPES
    };
})();