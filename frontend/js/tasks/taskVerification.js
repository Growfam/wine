/**
 * Модуль верифікації завдань для системи WINIX
 * Автоматична перевірка виконання завдань
 */

window.TaskVerification = (function() {
    'use strict';

    console.log('🔍 [TaskVerification] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ВЕРИФІКАЦІЇ =====');

    // Стан модуля
    const state = {
        activeVerifications: new Map(),
        verificationQueue: [],
        isProcessing: false,
        telegramBotUsername: '@WinixVerifyBot'
    };

    // Конфігурація
    const config = {
        maxRetries: 3,
        retryDelay: 2000,
        verificationTimeout: 30000,
        queueProcessInterval: 1000
    };

    /**
     * Ініціалізація модуля
     */
    function init() {
        console.log('🚀 [TaskVerification] Ініціалізація системи верифікації');
        console.log('⚙️ [TaskVerification] Конфігурація:', config);

        // Запускаємо обробку черги
        startQueueProcessor();

        // Налаштовуємо обробники подій
        setupEventHandlers();

        console.log('✅ [TaskVerification] Модуль ініціалізовано');
    }

    /**
     * Верифікувати завдання
     */
    async function verifyTask(taskId, taskType, platform, data = {}) {
        console.log('🔍 [TaskVerification] === ВЕРИФІКАЦІЯ ЗАВДАННЯ ===');
        console.log('📋 [TaskVerification] Дані завдання:', {
            taskId,
            taskType,
            platform,
            data
        });

        const verificationId = generateVerificationId();
        const userId = window.TasksStore.selectors.getUserId();

        if (!userId) {
            console.error('❌ [TaskVerification] User ID не знайдено');
            throw new Error('User not authenticated');
        }

        // Створюємо об'єкт верифікації
        const verification = {
            id: verificationId,
            taskId,
            taskType,
            platform,
            userId,
            data,
            status: 'pending',
            attempts: 0,
            createdAt: Date.now()
        };

        // Додаємо в активні верифікації
        state.activeVerifications.set(verificationId, verification);

        // Вибираємо метод верифікації в залежності від платформи
        try {
            let result;

            switch(platform.toLowerCase()) {
                case 'telegram':
                    result = await verifyTelegramTask(verification);
                    break;

                case 'youtube':
                    result = await verifyYouTubeTask(verification);
                    break;

                case 'twitter':
                    result = await verifyTwitterTask(verification);
                    break;

                case 'discord':
                    result = await verifyDiscordTask(verification);
                    break;

                default:
                    console.warn('⚠️ [TaskVerification] Невідома платформа:', platform);
                    result = await instantVerification(verification);
            }

            console.log('✅ [TaskVerification] Результат верифікації:', result);
            return result;

        } catch (error) {
            console.error('❌ [TaskVerification] Помилка верифікації:', error);
            verification.status = 'failed';
            verification.error = error.message;
            throw error;
        }
    }

    /**
     * Верифікація Telegram завдання
     */
    async function verifyTelegramTask(verification) {
        console.log('📱 [TaskVerification] === TELEGRAM ВЕРИФІКАЦІЯ ===');

        const { taskId, data } = verification;
        const { channelUsername, actionType } = data;

        console.log('📊 [TaskVerification] Параметри:', {
            канал: channelUsername,
            дія: actionType
        });

        // Оновлюємо UI - показуємо процес верифікації
        updateTaskUI(taskId, 'verifying');

        try {
            // Крок 1: Перевіряємо чи користувач запустив бота
            console.log('🔄 [TaskVerification] Крок 1: Перевірка запуску бота');
            const botStarted = await checkBotStarted(verification.userId);

            if (!botStarted) {
                console.log('❌ [TaskVerification] Користувач не запустив бота');
                throw new Error('Спочатку запустіть бота ' + state.telegramBotUsername);
            }

            // Крок 2: Відправляємо запит на верифікацію через API
            console.log('🔄 [TaskVerification] Крок 2: Запит верифікації');
            const response = await window.TasksAPI.tasks.verify(
                verification.userId,
                taskId,
                {
                    platform: 'telegram',
                    channelUsername,
                    actionType,
                    timestamp: Date.now()
                }
            );

            if (response.verified) {
                console.log('✅ [TaskVerification] Telegram завдання верифіковано');

                // Оновлюємо статус завдання
                await completeTask(taskId, verification);

                // Нараховуємо винагороду
                await claimReward(taskId, response.reward);

                return {
                    success: true,
                    verified: true,
                    reward: response.reward
                };
            } else {
                console.log('❌ [TaskVerification] Верифікація не пройдена');
                throw new Error(response.message || 'Підписка не підтверджена');
            }

        } catch (error) {
            console.error('❌ [TaskVerification] Помилка Telegram верифікації:', error);
            updateTaskUI(taskId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Перевірка чи користувач запустив бота
     */
    async function checkBotStarted(userId) {
        console.log('🤖 [TaskVerification] Перевірка запуску бота для користувача:', userId);

        try {
            const response = await window.TasksAPI.tasks.verify(
                userId,
                'check_bot',
                { action: 'check_bot_started' }
            );

            return response.botStarted || false;
        } catch (error) {
            console.error('❌ [TaskVerification] Помилка перевірки бота:', error);
            return false;
        }
    }

    /**
     * Верифікація YouTube завдання
     */
    async function verifyYouTubeTask(verification) {
        console.log('📺 [TaskVerification] === YOUTUBE ВЕРИФІКАЦІЯ ===');

        // YouTube не має автоматичної верифікації
        // Миттєве нарахування після натискання
        return instantVerification(verification);
    }

    /**
     * Верифікація Twitter завдання
     */
    async function verifyTwitterTask(verification) {
        console.log('🐦 [TaskVerification] === TWITTER ВЕРИФІКАЦІЯ ===');

        // Twitter не має автоматичної верифікації
        // Миттєве нарахування після натискання
        return instantVerification(verification);
    }

    /**
     * Верифікація Discord завдання
     */
    async function verifyDiscordTask(verification) {
        console.log('💬 [TaskVerification] === DISCORD ВЕРИФІКАЦІЯ ===');

        // Discord не має автоматичної верифікації
        // Миттєве нарахування після натискання
        return instantVerification(verification);
    }

    /**
     * Миттєва верифікація (для платформ без перевірки)
     */
    async function instantVerification(verification) {
        console.log('⚡ [TaskVerification] === МИТТЄВА ВЕРИФІКАЦІЯ ===');

        const { taskId, userId } = verification;

        try {
            // Оновлюємо UI
            updateTaskUI(taskId, 'claiming');

            // Відправляємо запит на отримання винагороди
            const response = await window.TasksAPI.tasks.claim(userId, taskId);

            if (response.success) {
                console.log('✅ [TaskVerification] Завдання виконано миттєво');

                // Оновлюємо статус
                await completeTask(taskId, verification);

                // Нараховуємо винагороду
                await claimReward(taskId, response.reward);

                return {
                    success: true,
                    verified: true,
                    instant: true,
                    reward: response.reward
                };
            } else {
                throw new Error(response.message || 'Помилка виконання завдання');
            }

        } catch (error) {
            console.error('❌ [TaskVerification] Помилка миттєвої верифікації:', error);
            updateTaskUI(taskId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Завершити завдання
     */
    async function completeTask(taskId, verification) {
        console.log('✅ [TaskVerification] Завершення завдання:', taskId);

        // Оновлюємо статус в сторі
        window.TasksStore.actions.updateTaskStatus(
            verification.taskType,
            taskId,
            'completed'
        );

        // Оновлюємо UI
        updateTaskUI(taskId, 'completed');

        // Видаляємо з активних верифікацій
        state.activeVerifications.delete(verification.id);

        // Зберігаємо в localStorage
        saveCompletedTask(taskId, verification);
    }

    /**
     * Нарахувати винагороду
     */
    async function claimReward(taskId, reward) {
        console.log('💰 [TaskVerification] === НАРАХУВАННЯ ВИНАГОРОДИ ===');
        console.log('🎁 [TaskVerification] Винагорода:', reward);

        if (!reward || (!reward.winix && !reward.tickets)) {
            console.warn('⚠️ [TaskVerification] Винагорода відсутня');
            return;
        }

        // Оновлюємо баланс
        const currentBalance = window.TasksStore.selectors.getUserBalance();
        const newBalance = {
            winix: currentBalance.winix + (reward.winix || 0),
            tickets: currentBalance.tickets + (reward.tickets || 0)
        };

        window.TasksStore.actions.updateBalance(newBalance);

        // Показуємо анімацію винагороди
        showRewardAnimation(reward);

        // Показуємо повідомлення
        window.TasksServices.Notification.showReward(reward);

        console.log('✅ [TaskVerification] Винагорода нарахована');
    }

    /**
     * Оновити UI завдання
     */
    function updateTaskUI(taskId, status, message = '') {
        console.log('🔄 [TaskVerification] Оновлення UI завдання:', {
            taskId,
            status,
            message
        });

        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskCard) {
            console.warn('⚠️ [TaskVerification] Картка завдання не знайдена');
            return;
        }

        // Видаляємо попередні класи статусу
        taskCard.classList.remove('verifying', 'claiming', 'completed', 'failed');

        // Додаємо новий клас статусу
        taskCard.classList.add(status);

        // Оновлюємо кнопку
        const button = taskCard.querySelector('.task-button');
        if (button) {
            switch(status) {
                case 'verifying':
                    button.textContent = 'Перевірка...';
                    button.disabled = true;
                    break;

                case 'claiming':
                    button.textContent = 'Отримання...';
                    button.disabled = true;
                    break;

                case 'completed':
                    button.textContent = 'Виконано ✓';
                    button.disabled = true;
                    break;

                case 'failed':
                    button.textContent = 'Спробувати знову';
                    button.disabled = false;
                    if (message) {
                        window.TasksUtils.showToast(message, 'error');
                    }
                    break;
            }
        }
    }

    /**
     * Показати анімацію винагороди
     */
    function showRewardAnimation(reward) {
        console.log('🎊 [TaskVerification] Показуємо анімацію винагороди');

        const animDiv = document.createElement('div');
        animDiv.className = 'task-reward-animation';

        let content = '';
        if (reward.winix) {
            content += `<div class="reward-winix">+${reward.winix} WINIX</div>`;
        }
        if (reward.tickets) {
            content += `<div class="reward-tickets">+${reward.tickets} TICKETS</div>`;
        }

        animDiv.innerHTML = content;
        document.body.appendChild(animDiv);

        // Запускаємо анімацію
        setTimeout(() => {
            animDiv.classList.add('show');
        }, 10);

        // Видаляємо після анімації
        setTimeout(() => {
            animDiv.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(animDiv);
            }, 500);
        }, 2500);
    }

    /**
     * Обробка черги верифікацій
     */
    function startQueueProcessor() {
        console.log('🔄 [TaskVerification] Запуск обробника черги');

        setInterval(() => {
            if (state.isProcessing || state.verificationQueue.length === 0) {
                return;
            }

            processNextVerification();
        }, config.queueProcessInterval);
    }

    /**
     * Обробити наступну верифікацію з черги
     */
    async function processNextVerification() {
        if (state.verificationQueue.length === 0) return;

        state.isProcessing = true;
        const verification = state.verificationQueue.shift();

        console.log('🔄 [TaskVerification] Обробка верифікації з черги:', verification);

        try {
            await verifyTask(
                verification.taskId,
                verification.taskType,
                verification.platform,
                verification.data
            );
        } catch (error) {
            console.error('❌ [TaskVerification] Помилка обробки:', error);
        }

        state.isProcessing = false;
    }

    /**
     * Додати завдання в чергу верифікації
     */
    function addToQueue(taskId, taskType, platform, data) {
        console.log('📥 [TaskVerification] Додавання в чергу:', {
            taskId,
            taskType,
            platform
        });

        state.verificationQueue.push({
            taskId,
            taskType,
            platform,
            data,
            addedAt: Date.now()
        });
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        console.log('🎯 [TaskVerification] Налаштування обробників подій');

        // Обробник кліків на кнопки завдань
        document.addEventListener('click', async (e) => {
            const taskButton = e.target.closest('.task-button');
            if (!taskButton) return;

            const taskCard = taskButton.closest('[data-task-id]');
            if (!taskCard) return;

            const taskId = taskCard.getAttribute('data-task-id');
            const taskType = taskCard.getAttribute('data-task-type');
            const platform = taskCard.getAttribute('data-platform');

            console.log('🖱️ [TaskVerification] Клік на завдання:', {
                taskId,
                taskType,
                platform
            });

            // Перевіряємо чи завдання вже виконано
            if (taskCard.classList.contains('completed')) {
                console.log('ℹ️ [TaskVerification] Завдання вже виконано');
                return;
            }

            // Збираємо додаткові дані
            const data = {
                channelUsername: taskCard.getAttribute('data-channel'),
                actionType: taskCard.getAttribute('data-action'),
                url: taskCard.getAttribute('data-url')
            };

            try {
                // Запускаємо верифікацію
                await verifyTask(taskId, taskType, platform, data);
            } catch (error) {
                console.error('❌ [TaskVerification] Помилка виконання:', error);
            }
        });
    }

    /**
     * Генерація ID верифікації
     */
    function generateVerificationId() {
        return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Зберегти виконане завдання
     */
    function saveCompletedTask(taskId, verification) {
        console.log('💾 [TaskVerification] Збереження виконаного завдання');

        const completedTasks = window.TasksUtils.storage.get('completedTasks', {});
        completedTasks[taskId] = {
            taskId,
            platform: verification.platform,
            completedAt: Date.now(),
            reward: verification.reward
        };

        window.TasksUtils.storage.set('completedTasks', completedTasks);
    }

    /**
     * Перевірити чи завдання виконано
     */
    function isTaskCompleted(taskId) {
        const completedTasks = window.TasksUtils.storage.get('completedTasks', {});
        return !!completedTasks[taskId];
    }

    /**
     * Отримати статистику верифікацій
     */
    function getStatistics() {
        const completedTasks = window.TasksUtils.storage.get('completedTasks', {});
        const platforms = {};

        Object.values(completedTasks).forEach(task => {
            platforms[task.platform] = (platforms[task.platform] || 0) + 1;
        });

        return {
            totalCompleted: Object.keys(completedTasks).length,
            byPlatform: platforms,
            activeVerifications: state.activeVerifications.size,
            queueLength: state.verificationQueue.length
        };
    }

    /**
     * Очистити кеш виконаних завдань
     */
    function clearCompletedCache() {
        console.log('🧹 [TaskVerification] Очищення кешу виконаних завдань');
        window.TasksUtils.storage.remove('completedTasks');
    }

    console.log('✅ [TaskVerification] Модуль верифікації готовий');

    // Публічний API
    return {
        init,
        verifyTask,
        isTaskCompleted,
        getStatistics,
        addToQueue,
        clearCompletedCache
    };

})();

console.log('✅ [TaskVerification] Модуль експортовано глобально');