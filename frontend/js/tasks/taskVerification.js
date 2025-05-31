/**
 * Модуль верифікації завдань для системи WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V3 - Використовує централізовані утиліти
 */

window.TaskVerification = (function() {
    'use strict';

    console.log('🔍 [TaskVerification-V3] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // Namespace для кешування
    const CACHE_NAMESPACE = CacheManager.NAMESPACES.VALIDATION;

    // RequestManager клієнт
    const apiClient = RequestManager.createClient('verification', {
        maxRetries: 3,
        retryDelay: 2000
    });

    // EventBus namespace
    const eventBus = EventBus.createNamespace('verification');

    // Мінімальний стан
    const state = {
        telegramBotUsername: '@WINIX_Official_bot',
        socialVerificationDelay: 15000 // 15 секунд
    };

    // Конфігурація
    const config = {
        verificationTimeout: 30000
    };

    /**
     * Ініціалізація модуля
     */
    function init() {
        console.log('🚀 [TaskVerification-V3] Ініціалізація');

        // Підписуємось на події
        setupEventSubscriptions();

        // Емітуємо подію готовності
        EventBus.emit('verification.ready');

        console.log('✅ [TaskVerification-V3] Модуль ініціалізовано');
    }

    /**
     * Верифікувати завдання
     */
    async function verifyTask(taskId, taskType, platform, data = {}) {
        console.log('🔍 [TaskVerification-V3] Верифікація:', { taskId, platform });

        const userId = window.TasksStore?.selectors?.getUserId();
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const verificationData = {
            taskId,
            taskType,
            platform,
            userId,
            data,
            timestamp: Date.now()
        };

        // Емітуємо подію початку
        EventBus.emit(EventBus.EVENTS.TASK_STARTED, verificationData);

        try {
            let result;

            switch(platform.toLowerCase()) {
                case 'telegram':
                    result = await verifyTelegramTask(verificationData);
                    break;

                case 'youtube':
                case 'twitter':
                case 'discord':
                    result = await verifySocialTask(verificationData);
                    break;

                default:
                    result = await verifySocialTask(verificationData);
            }

            return result;

        } catch (error) {
            console.error('❌ [TaskVerification-V3] Помилка:', error);

            // Емітуємо подію помилки
            EventBus.emit(EventBus.EVENTS.TASK_FAILED, {
                ...verificationData,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Верифікація Telegram завдання
     */
    async function verifyTelegramTask(verification) {
        const { taskId, data, userId } = verification;
        const { channelUsername } = data;

        // Оновлюємо UI
        updateTaskUI(taskId, 'verifying');

        try {
            // Перевіряємо кеш бота
            const botCacheKey = `bot_started_${userId}`;
            let botStarted = CacheManager.get(CACHE_NAMESPACE, botCacheKey);

            if (botStarted === null) {
                // Перевіряємо через API
                const response = await apiClient.execute(
                    botCacheKey,
                    () => window.TasksAPI.verify.checkBot(userId),
                    { priority: 'high' }
                );

                botStarted = response.botStarted || false;
                CacheManager.set(CACHE_NAMESPACE, botCacheKey, botStarted, 300000); // 5 хвилин
            }

            if (!botStarted) {
                throw new Error('Спочатку запустіть бота ' + state.telegramBotUsername);
            }

            // Верифікуємо підписку
            const response = await apiClient.execute(
                `verify_tg_${channelUsername}`,
                () => window.TasksAPI.verify.telegram(userId, channelUsername),
                { priority: 'high', deduplicate: false }
            );

            if (response.verified) {
                await completeTask(taskId, verification, response.reward);

                return {
                    success: true,
                    verified: true,
                    reward: response.reward
                };
            } else {
                throw new Error(response.message || 'Підписка не підтверджена');
            }

        } catch (error) {
            updateTaskUI(taskId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Верифікація соціальних завдань
     */
    async function verifySocialTask(verification) {
        const { taskId, userId } = verification;

        // Оновлюємо UI
        updateTaskUI(taskId, 'verifying');

        try {
            // Перевіряємо кеш часу початку
            const timestampKey = `task_start_${taskId}`;
            let startTimestamp = CacheManager.get(CACHE_NAMESPACE, timestampKey);

            if (!startTimestamp) {
                // Початок виконання
                startTimestamp = Date.now();
                CacheManager.set(CACHE_NAMESPACE, timestampKey, startTimestamp, 3600000); // 1 година

                // Відправляємо на сервер
                await apiClient.execute(
                    `start_${taskId}`,
                    () => window.TasksAPI.tasks.start(userId, taskId),
                    { priority: 'normal' }
                );

                // Показуємо повідомлення
                window.TasksUtils.showToast(
                    window.TasksConstants.MESSAGES.INFO.WAIT_VERIFICATION,
                    'info',
                    5000
                );

                // Відкриваємо URL
                if (verification.data.url) {
                    window.open(verification.data.url, '_blank');
                }

                // Показуємо таймер
                showVerificationTimer(taskId, state.socialVerificationDelay);
            }

            // Перевіряємо час
            const elapsedTime = Date.now() - startTimestamp;
            const remainingTime = state.socialVerificationDelay - elapsedTime;

            if (remainingTime > 0) {
                showVerificationTimer(taskId, remainingTime);
                throw new Error(`Зачекайте ще ${Math.ceil(remainingTime / 1000)} секунд`);
            }

            // Час пройшов, завершуємо
            const response = await apiClient.execute(
                `complete_${taskId}`,
                () => window.TasksAPI.tasks.complete(userId, taskId),
                { priority: 'high', deduplicate: false }
            );

            if (response.success) {
                // Очищаємо кеш
                CacheManager.invalidate(CACHE_NAMESPACE, timestampKey);

                await completeTask(taskId, verification, response.reward);

                return {
                    success: true,
                    verified: true,
                    reward: response.reward
                };
            } else {
                throw new Error(response.message || 'Помилка виконання завдання');
            }

        } catch (error) {
            updateTaskUI(taskId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Показати таймер верифікації
     */
    function showVerificationTimer(taskId, duration) {
        const button = document.querySelector(`[data-task-id="${taskId}"] .task-button`);
        if (!button) return;

        let remainingTime = Math.ceil(duration / 1000);

        const updateTimer = () => {
            if (remainingTime <= 0) {
                button.textContent = 'Перевірити';
                button.disabled = false;
                return;
            }

            button.textContent = `Зачекайте ${remainingTime} сек...`;
            button.disabled = true;
            remainingTime--;

            setTimeout(updateTimer, 1000);
        };

        updateTimer();
    }

    /**
     * Завершити завдання
     */
    async function completeTask(taskId, verification, reward) {
        // Оновлюємо Store
        window.TasksStore.actions.updateTaskStatus(
            verification.taskType,
            taskId,
            'completed'
        );

        // Оновлюємо UI
        updateTaskUI(taskId, 'completed');

        // Кешуємо виконане завдання
        const completedKey = `completed_${taskId}`;
        CacheManager.set(CACHE_NAMESPACE, completedKey, true, Infinity);

        // Нараховуємо винагороду
        if (reward && (reward.winix || reward.tickets)) {
            await claimReward(taskId, reward);
        }

        // Емітуємо подію завершення
        EventBus.emit(EventBus.EVENTS.TASK_COMPLETED, {
            taskId,
            taskType: verification.taskType,
            reward
        });
    }

    /**
     * Нарахувати винагороду
     */
    async function claimReward(taskId, reward) {
        // Оновлюємо баланс через Store
        const currentBalance = window.TasksStore.selectors.getUserBalance();
        const newBalance = {
            winix: currentBalance.winix + (reward.winix || 0),
            tickets: currentBalance.tickets + (reward.tickets || 0)
        };

        window.TasksStore.actions.updateBalance(newBalance);

        // Емітуємо подію отримання винагороди
        EventBus.emit(EventBus.EVENTS.TASK_CLAIMED, {
            taskId,
            reward
        });

        // Показуємо анімацію через EventBus
        eventBus.emit('showRewardAnimation', reward);

        // Toast повідомлення
        window.TasksServices?.Notification?.showReward(reward);
    }

    /**
     * Оновити UI завдання
     */
    function updateTaskUI(taskId, status, message = '') {
        // Використовуємо EventBus для UI оновлень
        EventBus.emit('task.ui.update', {
            taskId,
            status,
            message
        });

        // Мінімальне пряме оновлення для критичних елементів
        const button = document.querySelector(`[data-task-id="${taskId}"] .task-button`);
        if (!button) return;

        switch(status) {
            case 'verifying':
                button.textContent = 'Перевірка...';
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

    /**
     * Додати завдання в чергу верифікації
     */
    function addToQueue(taskId, taskType, platform, data) {
        // Використовуємо RequestManager замість власної черги
        apiClient.execute(
            `queue_verify_${taskId}`,
            () => verifyTask(taskId, taskType, platform, data),
            { priority: 'normal' }
        ).catch(error => {
            console.error('❌ [TaskVerification-V3] Помилка черги:', error);
        });
    }

    /**
     * Перевірити чи завдання виконано
     */
    function isTaskCompleted(taskId) {
        const completedKey = `completed_${taskId}`;
        return CacheManager.get(CACHE_NAMESPACE, completedKey) === true;
    }

    /**
     * Налаштування підписок на події
     */
    function setupEventSubscriptions() {
        // Обробка кліків на завданнях через делегування
        document.addEventListener('click', async (e) => {
            const taskButton = e.target.closest('.task-button');
            if (!taskButton) return;

            const taskCard = taskButton.closest('[data-task-id]');
            if (!taskCard) return;

            const taskId = taskCard.getAttribute('data-task-id');
            const taskType = taskCard.getAttribute('data-task-type');
            const platform = taskCard.getAttribute('data-platform');

            // Перевіряємо стан
            if (taskCard.classList.contains('completed') || isTaskCompleted(taskId)) {
                console.log('ℹ️ [TaskVerification-V3] Завдання вже виконано');
                return;
            }

            // Збираємо дані
            const data = {
                channelUsername: taskCard.getAttribute('data-channel'),
                actionType: taskCard.getAttribute('data-action'),
                url: taskCard.getAttribute('data-url')
            };

            try {
                await verifyTask(taskId, taskType, platform, data);
            } catch (error) {
                console.error('❌ [TaskVerification-V3] Помилка:', error);
            }
        });

        // Підписка на запит верифікації
        EventBus.on('task.verify', async (data) => {
            try {
                await verifyTask(data.taskId, data.taskType, data.platform, data);
            } catch (error) {
                console.error('❌ [TaskVerification-V3] Помилка:', error);
            }
        });
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        const completedTasks = [];

        // Збираємо виконані завдання з кешу
        CacheManager.getNamespaceData(CACHE_NAMESPACE).forEach((value, key) => {
            if (key.startsWith('completed_') && value === true) {
                completedTasks.push(key.replace('completed_', ''));
            }
        });

        return {
            totalCompleted: completedTasks.length,
            completedTaskIds: completedTasks,
            pendingVerifications: apiClient.getStatus().pendingRequests
        };
    }

    /**
     * Очистити кеш
     */
    function clearCompletedCache() {
        console.log('🧹 [TaskVerification-V3] Очищення кешу');
        CacheManager.invalidateNamespace(CACHE_NAMESPACE);
    }

    console.log('✅ [TaskVerification-V3] Модуль готовий');

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

console.log('✅ [TaskVerification-V3] Модуль експортовано глобально');