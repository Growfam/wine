/**
 * Verification - модуль для перевірки виконання завдань
 * Відповідає за:
 * - Перевірку виконання різних типів завдань
 * - Обробку відповідей від API
 * - Генерацію подій про виконання завдань
 */

window.TaskVerification = (function() {
    // Приватні змінні модуля
    const verificationCache = {};

    /**
     * Ініціалізація модуля перевірки
     */
    function init() {
        console.log('TaskVerification: Ініціалізація модуля перевірки завдань');

        // Очищаємо кеш при ініціалізації
        clearVerificationCache();
    }

    /**
     * Перевірка виконання завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyTask(taskId) {
        try {
            // Показуємо індикатор завантаження
            showVerificationLoader(taskId);

            // Перевіряємо, чи не повторюється запит на перевірку
            if (isVerificationInProgress(taskId)) {
                hideVerificationLoader(taskId);
                return {
                    success: false,
                    message: 'Перевірка вже виконується. Зачекайте.'
                };
            }

            // Додаємо до кешу
            verificationCache[taskId] = {
                status: 'in_progress',
                startTime: Date.now()
            };

            // Отримуємо тип завдання
            const taskType = getTaskType(taskId);

            // Виконуємо специфічну для типу перевірку
            let result;

            switch (taskType) {
                case 'social':
                    result = await verifySocialTask(taskId);
                    break;
                case 'limited':
                    result = await verifyLimitedTask(taskId);
                    break;
                case 'partner':
                    result = await verifyPartnerTask(taskId);
                    break;
                default:
                    // Якщо тип не визначено, використовуємо загальну перевірку
                    result = await verifyGenericTask(taskId);
            }

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);

            // Оновлюємо кеш
            verificationCache[taskId] = {
                status: result.success ? 'completed' : 'failed',
                result: result,
                endTime: Date.now()
            };

            // Генеруємо подію про результат перевірки
            dispatchVerificationEvent(taskId, result);

            return result;
        } catch (error) {
            console.error('Помилка перевірки завдання:', error);

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);

            // Оновлюємо кеш
            verificationCache[taskId] = {
                status: 'error',
                error: error.message || 'Невідома помилка',
                endTime: Date.now()
            };

            // Повертаємо результат з помилкою
            const errorResult = {
                success: false,
                message: 'Сталася помилка під час перевірки завдання'
            };

            // Генеруємо подію про помилку
            dispatchVerificationEvent(taskId, errorResult);

            return errorResult;
        }
    }

    /**
     * Перевірка соціального завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifySocialTask(taskId) {
        // Запит до API або перевірка виконання соціального завдання
        return await performApiVerification(taskId);
    }

    /**
     * Перевірка лімітованого завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyLimitedTask(taskId) {
        // Перевіряємо, чи не закінчився термін виконання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskElement && taskElement.classList.contains('expired')) {
            return {
                success: false,
                message: 'Термін виконання цього завдання закінчився'
            };
        }

        // Запит до API або перевірка виконання лімітованого завдання
        return await performApiVerification(taskId);
    }

    /**
     * Перевірка партнерського завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyPartnerTask(taskId) {
        // Додаткові перевірки для партнерських завдань можна додати тут

        // Запит до API або перевірка виконання партнерського завдання
        return await performApiVerification(taskId);
    }

    /**
     * Загальна перевірка завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyGenericTask(taskId) {
        // Запит до API або перевірка виконання завдання
        return await performApiVerification(taskId);
    }

    /**
     * Виконання API запиту для перевірки завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function performApiVerification(taskId) {
        // Якщо є API, використовуємо його
        if (window.API) {
            const response = await window.API.post(`/quests/tasks/${taskId}/verify`);
            return response;
        }

        // Якщо API недоступне, імітуємо перевірку
        return simulateVerification(taskId);
    }

    /**
     * Імітація перевірки завдання (для тестування)
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function simulateVerification(taskId) {
        // Затримка для імітації мережевої затримки
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Імітуємо успіх з ймовірністю 70%
        const isSuccess = Math.random() < 0.7;

        if (isSuccess) {
            // Отримуємо винагороду за завдання
            const reward = getTaskReward(taskId);

            return {
                success: true,
                message: 'Завдання успішно виконано!',
                reward: reward
            };
        } else {
            return {
                success: false,
                message: 'Умови завдання ще не виконані. Спробуйте пізніше.'
            };
        }
    }

    /**
     * Отримання типу завдання
     * @param {string} taskId - ID завдання
     * @returns {string} Тип завдання
     */
    function getTaskType(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return 'unknown';

        // Пробуємо отримати тип з атрибуту
        return taskElement.getAttribute('data-task-type') || 'unknown';
    }

    /**
     * Отримання винагороди за завдання
     * @param {string} taskId - ID завдання
     * @returns {Object} Винагорода
     */
    function getTaskReward(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) {
            return {
                type: 'tokens',
                amount: 10
            };
        }

        // Знаходимо елемент з винагородою
        const rewardElement = taskElement.querySelector('.task-reward');
        if (!rewardElement) {
            return {
                type: 'tokens',
                amount: 10
            };
        }

        // Парсимо текст винагороди
        const rewardText = rewardElement.textContent;
        const rewardMatch = rewardText.match(/(\d+)\s+([^\s]+)/);

        if (rewardMatch) {
            const amount = parseInt(rewardMatch[1]);
            const typeText = rewardMatch[2];

            // Визначаємо тип винагороди
            const type = typeText.includes('WINIX') ? 'tokens' : 'coins';

            return {
                type,
                amount: amount || 10
            };
        }

        // За замовчуванням
        return {
            type: 'tokens',
            amount: 10
        };
    }

    /**
     * Відправлення події про результат перевірки
     * @param {string} taskId - ID завдання
     * @param {Object} result - Результат перевірки
     */
    function dispatchVerificationEvent(taskId, result) {
        document.dispatchEvent(new CustomEvent('task-verification-result', {
            detail: {
                taskId,
                result,
                timestamp: Date.now()
            }
        }));

        // Якщо завдання було успішно виконано, відправляємо подію про оновлення прогресу
        if (result.success) {
            document.dispatchEvent(new CustomEvent('task-progress-updated', {
                detail: {
                    taskId,
                    progressData: {
                        status: 'completed',
                        progress_value: getTaskTargetValue(taskId),
                        completion_date: new Date().toISOString()
                    }
                }
            }));
        }
    }

    /**
     * Отримання цільового значення прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {number} Цільове значення
     */
    function getTaskTargetValue(taskId) {
        // Знаходимо елемент завдання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return 1;

        // Пробуємо отримати цільове значення з атрибуту
        const targetAttr = taskElement.getAttribute('data-target-value');
        if (targetAttr) {
            return parseInt(targetAttr) || 1;
        }

        // За замовчуванням повертаємо 1
        return 1;
    }

    /**
     * Показати індикатор завантаження перевірки
     * @param {string} taskId - ID завдання
     */
    function showVerificationLoader(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            // Зберігаємо оригінальний вміст
            const originalContent = actionElement.innerHTML;
            actionElement.setAttribute('data-original-content', originalContent);

            // Замінюємо на лоадер
            actionElement.innerHTML = `
                <div class="loading-indicator">
                    <div class="spinner"></div>
                    <span data-lang-key="earn.verifying">Перевірка...</span>
                </div>
            `;
        }
    }

    /**
     * Приховати індикатор завантаження перевірки
     * @param {string} taskId - ID завдання
     */
    function hideVerificationLoader(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            // Відновлюємо оригінальний вміст
            const originalContent = actionElement.getAttribute('data-original-content');
            if (originalContent) {
                actionElement.innerHTML = originalContent;
                actionElement.removeAttribute('data-original-content');
            }
        }
    }

    /**
     * Перевірка, чи вже виконується перевірка завдання
     * @param {string} taskId - ID завдання
     * @returns {boolean} Чи виконується перевірка
     */
    function isVerificationInProgress(taskId) {
        return verificationCache[taskId] &&
               verificationCache[taskId].status === 'in_progress' &&
               (Date.now() - verificationCache[taskId].startTime) < 10000; // Не більше 10 сек
    }

    /**
     * Очищення кешу перевірок
     */
    function clearVerificationCache() {
        Object.keys(verificationCache).forEach(key => {
            delete verificationCache[key];
        });
    }

    // Публічний API модуля
    return {
        init,
        verifyTask,
        getTaskType,
        getTaskReward,
        isVerificationInProgress,
        clearVerificationCache
    };
})();