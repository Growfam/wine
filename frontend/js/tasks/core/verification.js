/**
 * TaskVerification - оптимізований модуль для верифікації завдань
 * Покращено:
 * - Точне визначення типу винагороди
 * - Стабільна обробка винагород
 * - Покращена інтеграція з іншими модулями
 * - Захист від дублювання нагород
 */

window.TaskVerification = (function() {
    // Кеш для результатів перевірки
    const verificationCache = {};

    // Час життя кешу (мс)
    const CACHE_TTL = 60 * 1000; // 1 хвилина

    // Статуси верифікації
    const STATUS = {
        PENDING: 'pending',
        SUCCESS: 'success',
        FAILURE: 'failure',
        ERROR: 'error'
    };

    // Типи завдань
    const TASK_TYPES = {
        SOCIAL: 'social',
        LIMITED: 'limited',
        PARTNER: 'partner'
    };

    // Типи нагород
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Соціальні мережі для верифікації
    const SOCIAL_NETWORKS = {
        TELEGRAM: 'telegram',
        TWITTER: 'twitter',
        DISCORD: 'discord',
        FACEBOOK: 'facebook'
    };

    // Конфігурація
    const config = {
        // Тривалість затримки між перевірками (мс)
        throttleDelay: 3000,
        // Чи використовувати кеш результатів перевірки
        useCache: true,
        // Чи блокувати повторні запити на перевірку
        blockRepeatedRequests: true,
        // Максимальна кількість спроб верифікації
        maxVerificationAttempts: 3,
        // Детальне логування
        debug: false
    };

    // Стан модуля
    const state = {
        // Час останньої перевірки для кожного завдання
        lastVerificationTime: {},
        // Кількість спроб верифікації для кожного завдання
        verificationAttempts: {},
        // Поточні активні перевірки
        activeVerifications: {},
        // Реєстр виданих нагород для запобігання дублюванню
        issuedRewards: {},
        // Чи ініціалізовано модуль
        initialized: false
    };

    /**
     * Ініціалізація модуля перевірки
     * @param {Object} options - Додаткові параметри
     */
    function init(options = {}) {
        if (state.initialized) return;

        console.log('TaskVerification: Ініціалізація оптимізованого модуля верифікації');

        // Оновлюємо конфігурацію
        Object.assign(config, options);

        // Очищаємо кеш при ініціалізації
        clearVerificationCache();

        // Підписка на події
        subscribeToEvents();

        // Відмічаємо, що модуль ініціалізовано
        state.initialized = true;
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Обробка події натискання на кнопку верифікації
        document.addEventListener('click', function(event) {
            if (event.target.matches('[data-action="verify"]')) {
                const taskId = event.target.dataset.taskId;
                if (taskId) {
                    verifyTask(taskId);
                }
            }
        });

        // Оновлення кешу при зміні стану завдань
        document.addEventListener('task-completed', function(event) {
            const { taskId } = event.detail;

            // Очищаємо кеш для завершеного завдання
            if (verificationCache[taskId]) {
                delete verificationCache[taskId];
            }

            // Додаємо завдання до реєстру виданих нагород
            if (!state.issuedRewards[taskId]) {
                state.issuedRewards[taskId] = Date.now();
            }
        });
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

            // Логуємо початок верифікації, якщо включено режим debug
            if (config.debug) {
                console.log(`TaskVerification: Початок верифікації завдання ${taskId}`);
            }

            // Перевіряємо, чи не була вже видана нагорода за це завдання
            if (state.issuedRewards[taskId]) {
                const timeSinceReward = Date.now() - state.issuedRewards[taskId];

                // Якщо нагорода видана менше ніж 30 секунд тому
                if (timeSinceReward < 30000) {
                    hideVerificationLoader(taskId);
                    return {
                        success: false,
                        status: STATUS.FAILURE,
                        message: 'Ви вже отримали нагороду за це завдання'
                    };
                }
            }

            // Перевіряємо, чи не перевіряється вже це завдання
            if (config.blockRepeatedRequests && isVerificationInProgress(taskId)) {
                hideVerificationLoader(taskId);
                return {
                    success: false,
                    status: STATUS.PENDING,
                    message: 'Перевірка вже виконується. Зачекайте.'
                };
            }

            // Проміжок часу з останньої перевірки
            const lastVerificationInterval = Date.now() - (state.lastVerificationTime[taskId] || 0);

            // Перевіряємо чи не занадто часто перевіряється
            if (lastVerificationInterval < config.throttleDelay) {
                const waitTime = Math.ceil((config.throttleDelay - lastVerificationInterval) / 1000);
                hideVerificationLoader(taskId);
                return {
                    success: false,
                    status: STATUS.FAILURE,
                    message: `Зачекайте ${waitTime} сек. перед новою спробою перевірки.`
                };
            }

            // Перевіряємо кількість спроб
            if (config.maxVerificationAttempts > 0) {
                state.verificationAttempts[taskId] = (state.verificationAttempts[taskId] || 0) + 1;

                if (state.verificationAttempts[taskId] > config.maxVerificationAttempts) {
                    hideVerificationLoader(taskId);
                    return {
                        success: false,
                        status: STATUS.FAILURE,
                        message: `Перевищено максимальну кількість спроб (${config.maxVerificationAttempts}). Спробуйте пізніше.`
                    };
                }
            }

            // Перевіряємо наявність кешованого результату
            if (config.useCache && hasCachedResult(taskId)) {
                const cachedResult = getCachedResult(taskId);

                // Використовуємо кешований успішний результат
                if (cachedResult.success) {
                    hideVerificationLoader(taskId);

                    // Відправляємо подію про результат перевірки
                    dispatchVerificationEvent(taskId, cachedResult);

                    return cachedResult;
                }
            }

            // Позначаємо завдання як таке, що перевіряється
            state.activeVerifications[taskId] = true;
            state.lastVerificationTime[taskId] = Date.now();

            // Отримуємо тип завдання
            const taskType = getTaskType(taskId);

            // Виконуємо специфічну для типу перевірку
            let result;

            switch (taskType) {
                case TASK_TYPES.SOCIAL:
                    result = await verifySocialTask(taskId);
                    break;
                case TASK_TYPES.LIMITED:
                    result = await verifyLimitedTask(taskId);
                    break;
                case TASK_TYPES.PARTNER:
                    result = await verifyPartnerTask(taskId);
                    break;
                default:
                    // Якщо тип не визначено, використовуємо загальну перевірку
                    result = await verifyGenericTask(taskId);
            }

            // Переконуємося, що результат коректний і винагорода правильна
            if (result.success && result.reward) {
                result.reward = validateAndNormalizeReward(result.reward, getTaskData(taskId));
            }

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);

            // Оновлюємо кеш
            if (config.useCache) {
                cacheResult(taskId, result);
            }

            // Видаляємо завдання з активних перевірок
            delete state.activeVerifications[taskId];

            // Генеруємо подію про результат перевірки
            dispatchVerificationEvent(taskId, result);

            // Якщо перевірка успішна, додаємо завдання до реєстру виданих нагород
            if (result.success) {
                state.issuedRewards[taskId] = Date.now();
            }

            // Логуємо результат, якщо включено режим debug
            if (config.debug) {
                console.log(`TaskVerification: Завершено верифікацію завдання ${taskId}`, result);
            }

            return result;
        } catch (error) {
            console.error('TaskVerification: Помилка при перевірці завдання:', error);

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);

            // Видаляємо завдання з активних перевірок
            delete state.activeVerifications[taskId];

            // Формуємо результат помилки
            const errorResult = {
                success: false,
                status: STATUS.ERROR,
                message: 'Сталася помилка під час перевірки завдання. Спробуйте пізніше.',
                error: error.message
            };

            // Генеруємо подію про помилку
            dispatchVerificationEvent(taskId, errorResult);

            return errorResult;
        }
    }

    /**
     * Валідація та нормалізація винагороди
     * @param {Object} reward - Об'єкт винагороди
     * @param {Object} taskData - Дані завдання
     * @returns {Object} Нормалізована винагорода
     */
    function validateAndNormalizeReward(reward, taskData) {
        // Якщо винагорода невалідна, створюємо нову
        if (!reward || typeof reward !== 'object' || typeof reward.amount !== 'number' || !reward.type) {
            // Спробуємо створити винагороду з даних завдання
            if (taskData && taskData.reward_type && taskData.reward_amount) {
                return {
                    type: normalizeRewardType(taskData.reward_type),
                    amount: parseFloat(taskData.reward_amount) || 10
                };
            }

            // За замовчуванням
            return {
                type: REWARD_TYPES.TOKENS,
                amount: 10
            };
        }

        // Нормалізуємо існуючий об'єкт винагороди
        return {
            type: normalizeRewardType(reward.type),
            amount: parseFloat(reward.amount) || 10
        };
    }

    /**
     * Нормалізація типу винагороди
     * @param {string} type - Тип винагороди
     * @returns {string} Нормалізований тип винагороди
     */
    function normalizeRewardType(type) {
        if (!type || typeof type !== 'string') {
            return REWARD_TYPES.TOKENS; // За замовчуванням
        }

        const lowerType = type.toLowerCase();

        if (lowerType.includes('token') || lowerType.includes('winix') || lowerType === REWARD_TYPES.TOKENS) {
            return REWARD_TYPES.TOKENS;
        } else if (lowerType.includes('coin') || lowerType.includes('жетон') || lowerType === REWARD_TYPES.COINS) {
            return REWARD_TYPES.COINS;
        }

        // За замовчуванням
        return REWARD_TYPES.TOKENS;
    }

    /**
     * Перевірка соціального завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifySocialTask(taskId) {
        // Отримуємо дані завдання
        const task = getTaskData(taskId);

        if (!task) {
            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Не вдалося отримати дані завдання'
            };
        }

        // Визначаємо тип соціальної мережі
        const socialType = determineSocialNetwork(task);

        // Додаткова перевірка соціальної мережі
        if (socialType) {
            // Локальна валідація, якщо можливо
            const validationResult = await validateSocialTask(task, socialType);

            // Якщо локальна валідація успішна або не вдалася, продовжуємо з API
            if (validationResult.success || !validationResult.verified) {
                return await performApiVerification(taskId);
            }

            // Якщо локальна валідація не пройшла
            return validationResult;
        }

        // Якщо тип соціальної мережі не визначено, використовуємо стандартну перевірку
        return await performApiVerification(taskId);
    }

    /**
     * Визначення типу соціальної мережі на основі URL або опису
     * @param {Object} task - Дані завдання
     * @returns {string|null} Тип соціальної мережі або null
     */
    function determineSocialNetwork(task) {
        if (!task || !task.action_url) return null;

        const url = task.action_url.toLowerCase();
        const title = (task.title || '').toLowerCase();
        const description = (task.description || '').toLowerCase();

        if (url.includes('t.me/') || url.includes('telegram.') ||
            title.includes('telegram') || description.includes('telegram')) {
            return SOCIAL_NETWORKS.TELEGRAM;
        }

        if (url.includes('twitter.') || url.includes('x.com') ||
            title.includes('twitter') || description.includes('twitter')) {
            return SOCIAL_NETWORKS.TWITTER;
        }

        if (url.includes('discord.') ||
            title.includes('discord') || description.includes('discord')) {
            return SOCIAL_NETWORKS.DISCORD;
        }

        if (url.includes('facebook.') || url.includes('fb.') ||
            title.includes('facebook') || description.includes('facebook')) {
            return SOCIAL_NETWORKS.FACEBOOK;
        }

        return null;
    }

    /**
     * Валідація соціального завдання
     * @param {Object} task - Дані завдання
     * @param {string} socialType - Тип соціальної мережі
     * @returns {Promise<Object>} Результат валідації
     */
    async function validateSocialTask(task, socialType) {
        // Базова відповідь для випадку, коли неможливо виконати локальну перевірку
        const baseResponse = {
            success: false,
            verified: false,
            status: STATUS.FAILURE,
            message: 'Потрібна перевірка на сервері'
        };

        // Спеціальні перевірки для різних соціальних мереж
        switch (socialType) {
            case SOCIAL_NETWORKS.TELEGRAM:
                // Перевірка Telegram можлива тільки через API
                return baseResponse;

            case SOCIAL_NETWORKS.TWITTER:
                // Перевірка Twitter можлива тільки через API
                return baseResponse;

            case SOCIAL_NETWORKS.DISCORD:
                // Перевірка Discord можлива тільки через API
                return baseResponse;

            case SOCIAL_NETWORKS.FACEBOOK:
                // Перевірка Facebook можлива тільки через API
                return baseResponse;

            default:
                return baseResponse;
        }
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
                status: STATUS.FAILURE,
                message: 'Термін виконання цього завдання закінчився'
            };
        }

        // Отримуємо дані завдання
        const task = getTaskData(taskId);

        if (!task) {
            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Не вдалося отримати дані завдання'
            };
        }

        // Перевіряємо термін дії завдання
        if (task.end_date) {
            const endDate = new Date(task.end_date);
            const now = new Date();

            if (endDate <= now) {
                return {
                    success: false,
                    status: STATUS.FAILURE,
                    message: 'Термін виконання цього завдання закінчився'
                };
            }
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
        // Отримуємо дані завдання
        const task = getTaskData(taskId);

        if (!task) {
            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Не вдалося отримати дані завдання'
            };
        }

        // Додаткова логіка перевірки партнерських завдань
        // Наприклад, можна перевірити наявність партнерського кукі або локального сховища

        // Запит до API для перевірки виконання партнерського завдання
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
            try {
                const response = await window.API.post(`/quests/tasks/${taskId}/verify`);

                // Оновлюємо статус відповіді
                if (response.success) {
                    response.status = STATUS.SUCCESS;

                    // Переконуємося, що винагорода правильного формату
                    if (response.reward) {
                        response.reward = validateAndNormalizeReward(response.reward, getTaskData(taskId));
                    } else {
                        // Якщо винагорода не вказана, але перевірка успішна, створюємо її з даних завдання
                        const taskData = getTaskData(taskId);
                        if (taskData && taskData.reward_type && taskData.reward_amount) {
                            response.reward = {
                                type: normalizeRewardType(taskData.reward_type),
                                amount: parseFloat(taskData.reward_amount)
                            };
                        }
                    }
                } else {
                    response.status = STATUS.FAILURE;
                }

                return response;
            } catch (error) {
                return {
                    success: false,
                    status: STATUS.ERROR,
                    message: 'Помилка з`єднання із сервером. Спробуйте пізніше.',
                    error: error.message
                };
            }
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

        // Отримуємо дані завдання
        const taskData = getTaskData(taskId);
        if (!taskData) {
            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Не вдалося отримати дані завдання'
            };
        }

        // Отримуємо тип завдання
        const taskType = getTaskType(taskId);

        // Ймовірність успіху залежить від типу завдання
        let successProbability;

        switch (taskType) {
            case TASK_TYPES.SOCIAL:
                successProbability = 0.7; // 70% успіху для соціальних завдань
                break;
            case TASK_TYPES.LIMITED:
                successProbability = 0.6; // 60% успіху для лімітованих завдань
                break;
            case TASK_TYPES.PARTNER:
                successProbability = 0.5; // 50% успіху для партнерських завдань
                break;
            default:
                successProbability = 0.65; // 65% успіху для інших завдань
        }

        // Імітуємо успіх/неуспіх на основі ймовірності
        const isSuccess = Math.random() < successProbability;

        if (isSuccess) {
            // Отримуємо винагороду за завдання
            const reward = validateAndNormalizeReward({
                type: taskData.reward_type || REWARD_TYPES.TOKENS,
                amount: parseFloat(taskData.reward_amount) || 10
            }, taskData);

            return {
                success: true,
                status: STATUS.SUCCESS,
                message: 'Завдання успішно виконано!',
                reward: reward
            };
        } else {
            // Визначаємо різні повідомлення невдачі
            const failureMessages = [
                'Умови завдання ще не виконані. Спробуйте пізніше.',
                'Не вдалося підтвердити виконання завдання. Переконайтеся, що ви виконали всі умови.',
                'Система не змогла перевірити виконання завдання. Спробуйте пізніше.',
                'Перевірка не пройшла. Перевірте, чи правильно виконано всі кроки.'
            ];

            return {
                success: false,
                status: STATUS.FAILURE,
                message: failureMessages[Math.floor(Math.random() * failureMessages.length)]
            };
        }
    }

    /**
     * Отримання даних завдання
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Дані завдання або null
     */
    function getTaskData(taskId) {
        // Спочатку пробуємо використати TaskManager
        if (window.TaskManager && window.TaskManager.findTaskById) {
            const task = window.TaskManager.findTaskById(taskId);
            if (task) return task;
        }

        // Шукаємо завдання серед доступних даних в DOM
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return null;

        // Отримуємо базові дані з елементу
        const titleElement = taskElement.querySelector('.task-title');
        const descriptionElement = taskElement.querySelector('.task-description');
        const rewardElement = taskElement.querySelector('.task-reward');

        // Створюємо об'єкт з даними завдання
        const task = {
            id: taskId,
            type: getTaskType(taskId),
            title: titleElement ? titleElement.textContent.trim() : '',
            description: descriptionElement ? descriptionElement.textContent.trim() : ''
        };

        // Отримуємо винагороду
        if (rewardElement) {
            const rewardText = rewardElement.textContent.trim();
            const rewardMatch = rewardText.match(/(\d+)\s+([^\s]+)/);

            if (rewardMatch) {
                const amount = parseInt(rewardMatch[1]);
                const typeText = rewardMatch[2];

                // Визначаємо тип винагороди
                const type = normalizeRewardType(typeText);

                task.reward_amount = amount;
                task.reward_type = type;
            }
        }

        // Отримуємо URL дії з кнопки
        const actionButton = taskElement.querySelector('[data-action="start"]');
        if (actionButton && actionButton.dataset.url) {
            task.action_url = actionButton.dataset.url;
        } else if (actionButton && actionButton.getAttribute('data-url')) {
            task.action_url = actionButton.getAttribute('data-url');
        }

        // Отримуємо кінцеву дату для лімітованих завдань
        const timerElement = taskElement.querySelector('.timer-value');
        if (timerElement && timerElement.dataset.endDate) {
            task.end_date = timerElement.dataset.endDate;
        }

        // Отримуємо target_value
        task.target_value = parseInt(taskElement.getAttribute('data-target-value')) || 1;

        return task;
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
        const taskType = taskElement.dataset.taskType;
        if (taskType) return taskType;

        // Визначаємо тип за ID
        if (taskId.startsWith('social_')) {
            return TASK_TYPES.SOCIAL;
        } else if (taskId.startsWith('limited_')) {
            return TASK_TYPES.LIMITED;
        } else if (taskId.startsWith('partner_')) {
            return TASK_TYPES.PARTNER;
        }

        return 'unknown';
    }

    /**
     * Відправлення події про результат перевірки
     * @param {string} taskId - ID завдання
     * @param {Object} result - Результат перевірки
     */
    function dispatchVerificationEvent(taskId, result) {
        // Створюємо унікальний ідентифікатор події для запобігання дублюванню
        const eventId = `verify_${taskId}_${Date.now()}`;

        // Відправляємо подію про результат перевірки
        document.dispatchEvent(new CustomEvent('task-verification-result', {
            detail: {
                taskId,
                result,
                timestamp: Date.now(),
                eventId
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
                        completion_date: new Date().toISOString(),
                        eventId
                    }
                }
            }));

            // Відправляємо подію про завершення завдання
            document.dispatchEvent(new CustomEvent('task-completed', {
                detail: {
                    taskId,
                    reward: result.reward,
                    timestamp: Date.now(),
                    eventId
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
            // Зберігаємо оригінальний вміст, якщо він ще не збережений
            if (!actionElement.hasAttribute('data-original-content')) {
                actionElement.setAttribute('data-original-content', actionElement.innerHTML);
            }

            // Замінюємо на лоадер з преміальною анімацією
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
        return !!state.activeVerifications[taskId];
    }

    /**
     * Перевірка, чи є кешований результат
     * @param {string} taskId - ID завдання
     * @returns {boolean} Чи є кешований результат
     */
    function hasCachedResult(taskId) {
        if (!verificationCache[taskId]) return false;

        // Перевіряємо час життя кешу
        const cache = verificationCache[taskId];
        return cache && (Date.now() - cache.timestamp) < CACHE_TTL;
    }

    /**
     * Отримання кешованого результату
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Кешований результат або null
     */
    function getCachedResult(taskId) {
        if (!hasCachedResult(taskId)) return null;
        return verificationCache[taskId].result;
    }

    /**
     * Кешування результату
     * @param {string} taskId - ID завдання
     * @param {Object} result - Результат перевірки
     */
    function cacheResult(taskId, result) {
        verificationCache[taskId] = {
            result,
            timestamp: Date.now()
        };
    }

    /**
     * Очищення кешу перевірок
     */
    function clearVerificationCache() {
        Object.keys(verificationCache).forEach(key => {
            delete verificationCache[key];
        });
    }

    /**
     * Скидання лічильників спроб
     */
    function resetVerificationAttempts() {
        state.verificationAttempts = {};
    }

    /**
     * Перевірка, чи було видано винагороду за завдання
     * @param {string} taskId - ID завдання
     * @returns {boolean} Чи було видано винагороду
     */
    function wasRewardIssued(taskId) {
        // Перевіряємо, чи є запис про нагороду
        return !!state.issuedRewards[taskId];
    }

    /**
     * Скидання стану модуля
     */
    function resetState() {
        // Скидаємо всі стани
        state.lastVerificationTime = {};
        state.verificationAttempts = {};
        state.activeVerifications = {};
        state.issuedRewards = {};

        // Очищаємо кеш
        clearVerificationCache();

        console.log('TaskVerification: Стан модуля скинуто');
    }

    // Публічний API модуля
    return {
        init,
        verifyTask,
        getTaskType,
        getTaskData,
        getTaskTargetValue,
        validateAndNormalizeReward,
        isVerificationInProgress,
        wasRewardIssued,
        clearVerificationCache,
        resetVerificationAttempts,
        resetState,
        STATUS,
        TASK_TYPES,
        REWARD_TYPES
    };
})();