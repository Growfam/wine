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
        if (type === 'tokens') {
            tokenBalance = newBalance;
            console.log(`TaskRewards: Оновлено баланс токенів із зовнішньої події: ${tokenBalance}`);
        } else if (type === 'coins') {
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
        // Переконуємося, що reward є об'єктом
        if (!reward || typeof reward !== 'object') {
            console.error('TaskRewards: Отримано невалідну винагороду', reward);
            return;
        }

        // Переконуємося, що тип винагороди визначено правильно
        if (!reward.type || (reward.type !== 'tokens' && reward.type !== 'coins')) {
            console.warn('TaskRewards: Невизначений тип винагороди, використовуємо тип за замовчуванням (tokens)');
            reward.type = 'tokens';
        }

        // Переконуємося, що сума винагороди є числом
        if (typeof reward.amount !== 'number' || isNaN(reward.amount) || reward.amount <= 0) {
            console.warn('TaskRewards: Невалідна сума винагороди, використовуємо значення за замовчуванням (10)');
            reward.amount = 10;
        }

        // Додаємо винагороду до історії
        addToRewardHistory(taskId, reward);

        // Оновлюємо баланс
        updateBalance(reward);

        // Показуємо анімацію винагороди
        showRewardAnimation(reward);
    }

    /**
     * Додавання винагороди до історії
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     */
    function addToRewardHistory(taskId, reward) {
        rewardHistory.push({
            taskId,
            reward,
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
     */
    function updateBalance(reward) {
        // Ще раз перевіряємо валідність винагороди
        if (!reward || typeof reward !== 'object') {
            console.error('TaskRewards: Спроба оновити баланс з невалідними даними');
            return;
        }

        // Чітко визначаємо тип винагороди
        const rewardType = reward.type === 'tokens' ? 'tokens' : 'coins';

        // Валідуємо суму
        const rewardAmount = Math.max(0, parseFloat(reward.amount) || 0);

        if (rewardAmount <= 0) {
            console.warn('TaskRewards: Спроба додати нульову або від\'ємну суму');
            return;
        }

        // Визначаємо, який баланс оновлювати
        if (rewardType === 'tokens') {
            // Оновлюємо токени
            tokenBalance += rewardAmount;
            updateTokenBalance(tokenBalance, true);

            // Зберігаємо баланс в localStorage
            localStorage.setItem('userTokens', tokenBalance.toString());
            localStorage.setItem('winix_balance', tokenBalance.toString());

            console.log(`TaskRewards: Оновлено баланс токенів: +${rewardAmount}, новий баланс: ${tokenBalance}`);
        } else {
            // Оновлюємо жетони
            coinsBalance += rewardAmount;
            updateCoinsBalance(coinsBalance, true);

            // Зберігаємо баланс в localStorage
            localStorage.setItem('userCoins', coinsBalance.toString());
            localStorage.setItem('winix_coins', coinsBalance.toString());

            console.log(`TaskRewards: Оновлено баланс жетонів: +${rewardAmount}, новий баланс: ${coinsBalance}`);
        }

        // Відправляємо подію оновлення балансу
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                oldBalance: rewardType === 'tokens' ? (tokenBalance - rewardAmount) : (coinsBalance - rewardAmount),
                newBalance: rewardType === 'tokens' ? tokenBalance : coinsBalance,
                reward: reward,
                type: rewardType,
                source: 'task_rewards'
            }
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
        // Визначаємо тип винагороди
        const rewardType = reward.type === 'tokens' ? 'tokens' : 'coins';
        const rewardAmount = parseFloat(reward.amount) || 0;

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
        const displayType = rewardType === 'tokens' ? '$WINIX' : 'жетонів';

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
        animationElement.textContent = `+${rewardAmount} ${displayType}`;

        // Додаємо класи залежно від типу винагороди
        if (rewardType === 'tokens') {
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
        const rewardType = type === 'tokens' ? 'tokens' : 'coins';

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

        // Обробляємо винагороду
        processReward('manual', reward);

        return true;
    }

    // Публічний API модуля
    return {
        init,
        updateBalance,
        showRewardAnimation,
        getRewardHistory,
        addReward
    };
})();