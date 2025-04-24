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
    }

    /**
     * Обробник події результату перевірки
     * @param {CustomEvent} event - Подія результату перевірки
     */
    function handleVerificationResult(event) {
        const { taskId, result } = event.detail;

        // Якщо перевірка успішна і є винагорода
        if (result.success && result.reward) {
            processReward(taskId, result.reward);
        }
    }

    /**
     * Обробник події оновлення балансу
     * @param {CustomEvent} event - Подія оновлення балансу
     */
    function handleBalanceUpdate(event) {
        const { newBalance, type } = event.detail;

        // Оновлюємо локальний баланс
        if (type === 'tokens') {
            tokenBalance = newBalance;
        } else if (type === 'coins') {
            coinsBalance = newBalance;
        }
    }

    /**
     * Обробка винагороди
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     */
    function processReward(taskId, reward) {
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
            console.warn('Помилка збереження історії винагород:', error);
        }
    }

    /**
     * Оновлення балансу
     * @param {Object} reward - Дані винагороди
     */
    function updateBalance(reward) {
        // Визначаємо, який баланс оновлювати
        if (reward.type === 'tokens') {
            tokenBalance += reward.amount;
            updateTokenBalance(tokenBalance, true);
        } else if (reward.type === 'coins') {
            coinsBalance += reward.amount;
            updateCoinsBalance(coinsBalance, true);
        }

        // Зберігаємо баланс в localStorage
        try {
            if (reward.type === 'tokens') {
                localStorage.setItem('userTokens', tokenBalance.toString());
                localStorage.setItem('winix_balance', tokenBalance.toString());
            } else if (reward.type === 'coins') {
                localStorage.setItem('userCoins', coinsBalance.toString());
                localStorage.setItem('winix_coins', coinsBalance.toString());
            }
        } catch (error) {
            console.warn('Помилка збереження балансу:', error);
        }

        // Відправляємо подію оновлення балансу
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                oldBalance: reward.type === 'tokens' ? (tokenBalance - reward.amount) : (coinsBalance - reward.amount),
                newBalance: reward.type === 'tokens' ? tokenBalance : coinsBalance,
                reward: reward,
                type: reward.type,
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
        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(reward);
            return;
        }

        // Інакше робимо просту анімацію
        const rewardAmount = reward.amount;
        const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
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

        // Оновлюємо баланс
        updateBalance(reward);

        // Показуємо анімацію
        showRewardAnimation(reward);

        // Додаємо до історії
        addToRewardHistory('manual', reward);
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