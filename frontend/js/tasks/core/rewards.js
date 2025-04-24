/**
 * Rewards - модуль для управління винагородами
 * Відповідає за:
 * - Нарахування винагород за виконані завдання
 * - Анімацію отримання винагород
 * - Оновлення балансу користувача
 *
 * Оптимізована версія з виправленими проблемами:
 * - Коректне розрізнення токенів та жетонів
 * - Стабільне оновлення балансу
 * - Вдосконалена логіка валідації
 */

window.TaskRewards = (function() {
    // Приватні змінні модуля
    let tokenBalance = 0;
    let coinsBalance = 0;

    // Типи винагород
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Історія винагород
    const rewardHistory = [];

    // Лічильник операцій для запобігання дублювання
    const operationCounter = {
        lastOperationId: null,
        lastOperationTime: 0,
        operationsInProgress: {}
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

        // Запобігання дублювання подій
        preventDuplicateEvents();
    }

    /**
     * Запобігання дублювання подій оновлення балансу
     */
    function preventDuplicateEvents() {
        // Оригінальний метод dispatchEvent
        const originalDispatchEvent = document.dispatchEvent;

        // Перевизначаємо метод
        document.dispatchEvent = function(event) {
            // Перевіряємо, чи це подія оновлення балансу
            if (event.type === 'balance-updated' && event.detail) {
                const { source, timestamp, operationId } = event.detail;

                // Якщо це наша подія або вже є operationId, пропускаємо
                if (source === 'task_rewards' || operationId === operationCounter.lastOperationId) {
                    return originalDispatchEvent.call(this, event);
                }

                // Перевіряємо час останньої події
                const now = Date.now();
                if (now - operationCounter.lastOperationTime < 500) {
                    console.warn('TaskRewards: Виявлено потенційне дублювання події balance-updated, фільтрування...');
                    return true; // Не дозволяємо дублювання подій
                }

                // Оновлюємо лічильник
                operationCounter.lastOperationTime = now;
                operationCounter.lastOperationId = operationId || `op_${now}_${Math.random().toString(36).substr(2, 9)}`;
            }

            // Викликаємо оригінальний метод
            return originalDispatchEvent.call(this, event);
        };
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
        const { taskId, result } = event.detail;

        // Якщо перевірка успішна і є винагорода
        if (result && result.success && result.reward) {
            console.log(`TaskRewards: Отримано результат верифікації для завдання ${taskId}`, result.reward);
            processReward(taskId, result.reward);
        }
    }

    /**
     * Обробник події оновлення балансу
     * @param {CustomEvent} event - Подія оновлення балансу
     */
    function handleBalanceUpdate(event) {
        const { newBalance, type, source } = event.detail;

        // Ігноруємо власні події
        if (source === 'task_rewards') {
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
    }

    /**
     * Обробка винагороди
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     */
    function processReward(taskId, reward) {
        // Перевіряємо коректність даних
        if (!validateReward(reward)) {
            console.error('TaskRewards: Отримано некоректні дані нагороди', reward);
            return;
        }

        // Нормалізуємо формат винагороди
        const normalizedReward = normalizeReward(reward);

        // Додаємо винагороду до історії
        addToRewardHistory(taskId, normalizedReward);

        // Оновлюємо баланс
        updateBalance(normalizedReward);

        // Показуємо анімацію винагороди
        showRewardAnimation(normalizedReward);
    }

    /**
     * Валідація даних винагороди
     * @param {Object} reward - Дані винагороди
     * @returns {boolean} Результат валідації
     */
    function validateReward(reward) {
        // Перевіряємо, чи є об'єктом
        if (!reward || typeof reward !== 'object') {
            return false;
        }

        // Перевіряємо наявність типу
        if (!reward.type || !['tokens', 'coins'].includes(reward.type)) {
            return false;
        }

        // Перевіряємо amount
        if (typeof reward.amount !== 'number' || isNaN(reward.amount) || reward.amount <= 0) {
            return false;
        }

        return true;
    }

    /**
     * Нормалізація даних винагороди
     * @param {Object} reward - Дані винагороди
     * @returns {Object} Нормалізовані дані
     */
    function normalizeReward(reward) {
        // Створюємо копію об'єкта
        const normalizedReward = { ...reward };

        // Перевіряємо тип
        if (typeof normalizedReward.type === 'string') {
            // Перевірка за ключовими словами
            if (normalizedReward.type.toLowerCase().includes('token') ||
                normalizedReward.type.toLowerCase().includes('winix')) {
                normalizedReward.type = REWARD_TYPES.TOKENS;
            } else if (normalizedReward.type.toLowerCase().includes('coin') ||
                       normalizedReward.type.toLowerCase().includes('жетон')) {
                normalizedReward.type = REWARD_TYPES.COINS;
            }
        }

        // Перевіряємо значення
        normalizedReward.amount = Math.abs(parseFloat(normalizedReward.amount) || 0);

        return normalizedReward;
    }

    /**
     * Додавання винагороди до історії
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     */
    function addToRewardHistory(taskId, reward) {
        const historyItem = {
            taskId,
            reward,
            timestamp: Date.now()
        };

        rewardHistory.push(historyItem);

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
     */
    function updateBalance(reward) {
        // Перевіряємо валідність винагороди
        if (!validateReward(reward)) {
            console.error('TaskRewards: Спроба оновити баланс з невалідними даними', reward);
            return;
        }

        // Визначаємо, який баланс оновлювати
        const operationId = `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Запобігання одночасним операціям
            if (operationCounter.operationsInProgress[reward.type]) {
                console.warn(`TaskRewards: Вже виконується оновлення балансу типу ${reward.type}, операція відкладена`);
                setTimeout(() => updateBalance(reward), 200);
                return;
            }

            // Ставимо мітку про операцію в прогресі
            operationCounter.operationsInProgress[reward.type] = operationId;

            if (reward.type === REWARD_TYPES.TOKENS) {
                // Оновлюємо токени
                const oldBalance = tokenBalance;
                tokenBalance += reward.amount;

                // Переконуємось, що значення валідне
                tokenBalance = Math.max(0, parseFloat(tokenBalance.toFixed(2)));

                updateTokenBalance(tokenBalance, true);

                // Зберігаємо баланс в localStorage
                localStorage.setItem('userTokens', tokenBalance.toString());
                localStorage.setItem('winix_balance', tokenBalance.toString());

                // Відправляємо подію оновлення балансу
                dispatchBalanceUpdatedEvent({
                    oldBalance: oldBalance,
                    newBalance: tokenBalance,
                    reward: reward,
                    type: REWARD_TYPES.TOKENS,
                    operationId: operationId
                });

                console.log(`TaskRewards: Оновлено баланс токенів: ${oldBalance} -> ${tokenBalance} (${reward.amount})`);
            } else if (reward.type === REWARD_TYPES.COINS) {
                // Оновлюємо жетони
                const oldBalance = coinsBalance;
                coinsBalance += reward.amount;

                // Переконуємось, що значення валідне
                coinsBalance = Math.max(0, Math.round(coinsBalance));

                updateCoinsBalance(coinsBalance, true);

                // Зберігаємо баланс в localStorage
                localStorage.setItem('userCoins', coinsBalance.toString());
                localStorage.setItem('winix_coins', coinsBalance.toString());

                // Відправляємо подію оновлення балансу
                dispatchBalanceUpdatedEvent({
                    oldBalance: oldBalance,
                    newBalance: coinsBalance,
                    reward: reward,
                    type: REWARD_TYPES.COINS,
                    operationId: operationId
                });

                console.log(`TaskRewards: Оновлено баланс жетонів: ${oldBalance} -> ${coinsBalance} (${reward.amount})`);
            }
        } finally {
            // Видаляємо мітку про операцію в прогресі
            setTimeout(() => {
                delete operationCounter.operationsInProgress[reward.type];
            }, 300);
        }
    }

    /**
     * Відправка події оновлення балансу
     * @param {Object} detail - Деталі події
     */
    function dispatchBalanceUpdatedEvent(detail) {
        // Додаємо джерело та часову мітку
        detail.source = 'task_rewards';
        detail.timestamp = Date.now();

        // Відправляємо подію
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: detail
        }));
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

        // Перевіряємо чи змінився баланс
        if (oldBalance === newBalance) return;

        // Встановлюємо нове значення
        tokenElement.textContent = newBalance.toFixed(2);

        // Додаємо анімацію, якщо потрібно
        if (animate) {
            tokenElement.classList.remove('decreasing', 'increasing');

            if (newBalance > oldBalance) {
                tokenElement.classList.add('increasing');
            } else if (newBalance < oldBalance) {
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

        // Перевіряємо чи змінився баланс
        if (oldBalance === newBalance) return;

        // Встановлюємо нове значення (ціле число)
        coinsElement.textContent = Math.round(newBalance);

        // Додаємо анімацію, якщо потрібно
        if (animate) {
            coinsElement.classList.remove('decreasing', 'increasing');

            if (newBalance > oldBalance) {
                coinsElement.classList.add('increasing');
            } else if (newBalance < oldBalance) {
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

        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(normalizedReward);
            return;
        }

        // Інакше робимо просту анімацію
        const rewardAmount = normalizedReward.amount;
        let rewardType;

        if (normalizedReward.type === REWARD_TYPES.TOKENS) {
            rewardType = '$WINIX';
        } else {
            rewardType = 'жетонів';
        }

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';

        if (normalizedReward.type === REWARD_TYPES.TOKENS) {
            animationElement.classList.add('tokens-reward');
        } else {
            animationElement.classList.add('coins-reward');
        }

        animationElement.textContent = `+${rewardAmount} ${rewardType}`;

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
     * Отримання поточного балансу токенів
     * @returns {number} Баланс токенів
     */
    function getTokenBalance() {
        return tokenBalance;
    }

    /**
     * Отримання поточного балансу жетонів
     * @returns {number} Баланс жетонів
     */
    function getCoinsBalance() {
        return coinsBalance;
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
        const reward = {
            type: type,
            amount: parseFloat(amount)
        };

        // Нормалізуємо винагороду
        const normalizedReward = normalizeReward(reward);

        // Обробляємо винагороду
        processReward('manual', normalizedReward);

        return normalizedReward;
    }

    /**
     * Скидання кешу та стану
     */
    function resetState() {
        // Очищаємо історію винагород
        rewardHistory.length = 0;

        // Скидаємо лічильники
        operationCounter.lastOperationId = null;
        operationCounter.lastOperationTime = 0;
        operationCounter.operationsInProgress = {};

        // Перезавантажуємо баланс
        loadBalance();

        console.log('TaskRewards: Стан модуля скинуто');
    }

    // Публічний API модуля
    return {
        init,
        updateBalance,
        showRewardAnimation,
        getRewardHistory,
        addReward,
        getTokenBalance,
        getCoinsBalance,
        resetState,
        REWARD_TYPES
    };
})();