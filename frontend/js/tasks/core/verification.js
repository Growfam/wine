/**
 * TaskVerification - вдосконалений модуль для верифікації завдань
 * Відповідає за:
 * - Надійну перевірку виконання завдань користувачем
 * - Обробку мережевих помилок та повторні спроби запитів
 * - Відстеження прогресу верифікації
 * - Безпечне форматування даних для API
 */

window.TaskVerification = (function() {
    // Кеш для результатів перевірки з оптимізованим управлінням пам'яттю
    const verificationCache = new Map();

    // Час життя кешу (мс)
    const CACHE_TTL = 60 * 1000; // 1 хвилина

    // Статуси верифікації
    const STATUS = {
        PENDING: 'pending',
        SUCCESS: 'success',
        FAILURE: 'failure',
        ERROR: 'error',
        NETWORK_ERROR: 'network_error',
        TIMEOUT: 'timeout'
    };

    // Типи завдань
    const TASK_TYPES = {
        SOCIAL: 'social',
        LIMITED: 'limited',
        PARTNER: 'partner'
    };

    // Типи нагород (уніфіковані з TaskRewards)
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
        // Максимальна кількість повторних спроб API запитів
        maxApiRetries: 2,
        // Інтервал між повторними спробами при мережевих помилках (мс)
        retryInterval: 2000,
        // Таймаут запитів (мс)
        requestTimeout: 15000,
        // Детальне логування
        debug: true,
        // Автоматична обробка CORS помилок
        handleCorsErrors: true,
        // Налаштування заголовків
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    };

    // Стан модуля
    const state = {
        // Час останньої перевірки для кожного завдання
        lastVerificationTime: {},
        // Кількість спроб верифікації для кожного завдання
        verificationAttempts: {},
        // Поточні активні перевірки
        activeVerifications: {},
        // Реєстр оброблених подій для запобігання дублюванню
        processedEvents: {},
        // Стан останньої мережевої помилки
        lastNetworkError: null,
        // Чи ініціалізовано модуль
        initialized: false
    };

    /**
     * Ініціалізація модуля перевірки
     * @param {Object} options - Додаткові параметри
     */
    function init(options = {}) {
        if (state.initialized) return;

        console.log('TaskVerification: Ініціалізація модуля верифікації з покращеною обробкою помилок');

        // Оновлюємо конфігурацію
        Object.assign(config, options);

        // Очищаємо кеш при ініціалізації
        clearVerificationCache();

        // Синхронізуємо типи винагород з TaskRewards, якщо він доступний
        syncRewardTypes();

        // Підписка на події
        subscribeToEvents();

        // Додаємо глобальний обробник помилок для діагностики
        setupNetworkErrorHandler();

        // Відмічаємо, що модуль ініціалізовано
        state.initialized = true;

        document.dispatchEvent(new CustomEvent('task-verification-initialized'));
    }

    /**
     * Синхронізація типів винагород з TaskRewards
     */
    function syncRewardTypes() {
        if (window.TaskRewards && window.TaskRewards.REWARD_TYPES) {
            // Використовуємо типи винагород з TaskRewards
            Object.assign(REWARD_TYPES, window.TaskRewards.REWARD_TYPES);
            console.log('TaskVerification: Типи винагород синхронізовано з TaskRewards');
        }
    }

    /**
     * Налаштування глобального обробника мережевих помилок
     */
    function setupNetworkErrorHandler() {
        // Обробник для fetch помилок
        window.addEventListener('error', function(event) {
            if (event.error &&
                (event.error.name === 'NetworkError' ||
                 event.error.name === 'TypeError' && event.error.message.includes('fetch'))) {

                state.lastNetworkError = {
                    timestamp: Date.now(),
                    error: event.error,
                    message: event.error.message
                };

                document.dispatchEvent(new CustomEvent('network-error', {
                    detail: state.lastNetworkError
                }));

                if (config.debug) {
                    console.error('TaskVerification: Виявлено мережеву помилку', event.error);
                }
            }
        });

        // Відстеження змін стану мережі
        window.addEventListener('online', function() {
            // Скидаємо лічильники помилок при відновленні з'єднання
            resetNetworkErrorState();

            // Відправляємо подію про відновлення з'єднання
            document.dispatchEvent(new CustomEvent('network-connection-restored'));

            if (config.debug) {
                console.log('TaskVerification: З\'єднання з мережею відновлено');
            }
        });

        window.addEventListener('offline', function() {
            state.lastNetworkError = {
                timestamp: Date.now(),
                error: new Error('Device went offline'),
                message: 'Пристрій перейшов у режим офлайн'
            };

            document.dispatchEvent(new CustomEvent('network-connection-lost'));

            if (config.debug) {
                console.warn('TaskVerification: З\'єднання з мережею втрачено');
            }
        });
    }

    /**
     * Скидання стану мережевих помилок
     */
    function resetNetworkErrorState() {
        state.lastNetworkError = null;
    }

    /**
     * Перевірка стану мережевого з'єднання
     * @returns {boolean} true якщо з'єднання доступне
     */
    function isNetworkAvailable() {
        // Перевіряємо navigator.onLine, якщо доступний
        if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
            return navigator.onLine;
        }

        // Якщо недавно була мережева помилка
        if (state.lastNetworkError && (Date.now() - state.lastNetworkError.timestamp < 5000)) {
            return false;
        }

        return true; // За замовчуванням вважаємо, що мережа доступна
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
            const { taskId, eventId } = event.detail;

            // Перевіряємо, чи не була ця подія вже оброблена
            if (eventId && state.processedEvents[eventId]) {
                return;
            }

            // Очищаємо кеш для завершеного завдання
            if (verificationCache.has(taskId)) {
                verificationCache.delete(taskId);
            }

            // Зберігаємо ідентифікатор обробленої події
            if (eventId) {
                state.processedEvents[eventId] = Date.now();

                // Очищення старих записів
                cleanupProcessedEvents();
            }
        });

        // Обробка змін мережевого стану
        document.addEventListener('network-connection-restored', function() {
            // Скидаємо лічильники та стан помилок при відновленні з'єднання
            resetNetworkErrorState();
        });
    }

    /**
     * Очищення застарілих записів оброблених подій
     */
    function cleanupProcessedEvents() {
        const oneHourAgo = Date.now() - 3600000; // 1 година в мілісекундах

        // Шукаємо та видаляємо старі записи
        for (const key in state.processedEvents) {
            if (state.processedEvents[key] < oneHourAgo) {
                delete state.processedEvents[key];
            }
        }
    }

    /**
     * Перевірка виконання завдання з розширеною обробкою помилок
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyTask(taskId) {
        try {
            // Перевіряємо стан мережі
            if (!isNetworkAvailable()) {
                return {
                    success: false,
                    status: STATUS.NETWORK_ERROR,
                    message: 'Відсутнє підключення до Інтернету. Перевірте з\'єднання та спробуйте ще раз.'
                };
            }

            // Створюємо унікальний ідентифікатор для цієї перевірки
            const verificationId = `verification_${taskId}_${Date.now()}`;

            // Показуємо індикатор завантаження
            showVerificationLoader(taskId);

            // Логуємо початок верифікації, якщо включено режим debug
            if (config.debug) {
                console.log(`TaskVerification: Початок верифікації завдання ${taskId}`);
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
                    dispatchVerificationEvent(taskId, cachedResult, `${verificationId}_cached`);

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

            try {
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
            } catch (error) {
                // Обробка помилок верифікації
                result = handleVerificationError(error, taskId);
            }

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);

            // Нормалізуємо результат і винагороду
            if (result.success && result.reward) {
                // Використовуємо TaskRewards для нормалізації, якщо доступно
                if (window.TaskRewards && window.TaskRewards.normalizeReward) {
                    result.reward = window.TaskRewards.normalizeReward(result.reward);
                } else {
                    result.reward = normalizeReward(result.reward, getTaskData(taskId));
                }
            }

            // Оновлюємо кеш
            if (config.useCache) {
                cacheResult(taskId, result);
            }

            // Видаляємо завдання з активних перевірок
            delete state.activeVerifications[taskId];

            // Генеруємо подію про результат перевірки
            dispatchVerificationEvent(taskId, result, verificationId);

            // Логуємо результат, якщо включено режим debug
            if (config.debug) {
                console.log(`TaskVerification: Завершено верифікацію завдання ${taskId}`, result);
            }

            return result;
        } catch (unexpectedError) {
            console.error('TaskVerification: Критична помилка при верифікації завдання:', unexpectedError);

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);

            // Видаляємо завдання з активних перевірок
            delete state.activeVerifications[taskId];

            // Формуємо результат помилки
            const errorResult = {
                success: false,
                status: STATUS.ERROR,
                message: 'Сталася неочікувана помилка під час перевірки завдання. Спробуйте пізніше.',
                error: unexpectedError.message
            };

            // Створюємо унікальний ідентифікатор події
            const errorEventId = `verification_error_${taskId}_${Date.now()}`;

            // Генеруємо подію про помилку
            dispatchVerificationEvent(taskId, errorResult, errorEventId);

            return errorResult;
        }
    }

    /**
     * Обробка помилки верифікації
     * @param {Error} error - Об'єкт помилки
     * @param {string} taskId - ID завдання
     * @returns {Object} Оброблений результат помилки
     */
    function handleVerificationError(error, taskId) {
        console.error('TaskVerification: Помилка при верифікації завдання:', error);

        // Класифікуємо помилку
        let status = STATUS.ERROR;
        let message = 'Сталася помилка під час перевірки завдання. Спробуйте пізніше.';

        // Перевіряємо тип помилки
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            status = STATUS.TIMEOUT;
            message = 'Перевищено час очікування відповіді від сервера. Перевірте з\'єднання та спробуйте ще раз.';
        }
        else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            status = STATUS.NETWORK_ERROR;
            message = 'Проблема з мережевим з\'єднанням. Перевірте підключення до Інтернету та спробуйте ще раз.';
        }
        else if (error.status === 401 || error.status === 403) {
            message = 'Помилка авторизації. Оновіть сторінку та спробуйте знову.';
        }
        else if (error.status === 429) {
            message = 'Занадто багато запитів. Будь ласка, спробуйте пізніше.';
        }
        else if (error.message.includes('CORS')) {
            status = STATUS.NETWORK_ERROR;
            message = 'Проблема з доступом до сервера. Спробуйте оновити сторінку або використати інший браузер.';
        }

        return {
            success: false,
            status: status,
            message: message,
            error: error.message,
            taskId: taskId
        };
    }

    /**
     * Нормалізація даних винагороди
     * @param {Object} reward - Дані винагороди
     * @param {Object} taskData - Дані завдання
     * @returns {Object} Нормалізовані дані
     */
    function normalizeReward(reward, taskData) {
        // Базова перевірка на валідність винагороди
        if (!reward || typeof reward !== 'object') {
            console.warn('TaskVerification: Отримано невалідну винагороду, використовуємо значення за замовчуванням');
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
        }
        // Якщо тип не вказаний, але є дані завдання
        else if (taskData && taskData.reward_type) {
            const lowerType = typeof taskData.reward_type === 'string' ?
                taskData.reward_type.toLowerCase() : '';
            rewardType = (lowerType.includes('token') || lowerType.includes('winix')) ?
                REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;
        }
        // За замовчуванням
        else {
            rewardType = REWARD_TYPES.TOKENS;
        }

        // Перевірка та нормалізація суми
        const rewardAmount = Math.max(0, parseFloat(reward.amount) || 0);

        // Якщо сума нульова або від'ємна, використовуємо дані завдання або значення за замовчуванням
        if (rewardAmount <= 0) {
            if (taskData && taskData.reward_amount) {
                return {
                    type: rewardType,
                    amount: Math.max(0, parseFloat(taskData.reward_amount) || 10)
                };
            }

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
     * Перевірка соціального завдання з розширеною обробкою помилок
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
                return await performApiVerification(taskId, {
                    platform: socialType.toLowerCase(),
                    verification_type: 'social',
                    task_data: {
                        platform: socialType.toLowerCase(),
                        action_type: task.action_type || 'visit'
                    }
                });
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
     * Валідація соціального завдання з покращеною безпекою
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

        try {
            // Спеціальні перевірки для різних соціальних мереж з покращеною безпекою
            switch (socialType) {
                case SOCIAL_NETWORKS.TELEGRAM:
                    // Перевірка Telegram - спробуємо використати Telegram Web API, якщо доступний
                    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
                        // Перевіряємо, чи вказаний URL завдання є тим, до якого ми маємо доступ
                        const telegramUsername = task.action_url.match(/t\.me\/([^/?]+)/i);

                        if (telegramUsername && telegramUsername[1]) {
                            const targetUsername = telegramUsername[1].toLowerCase();

                            // Спроба перевірити підписку через Telegram API
                            if (config.debug) {
                                console.log(`TaskVerification: Перевірка підписки на Telegram канал: ${targetUsername}`);
                            }

                            return baseResponse; // Все одно потрібна серверна перевірка
                        }
                    }
                    return baseResponse;

                case SOCIAL_NETWORKS.TWITTER:
                    // Twitter потребує OAuth, локальна перевірка неможлива
                    return baseResponse;

                case SOCIAL_NETWORKS.DISCORD:
                    // Discord також потребує OAuth, локальна перевірка неможлива
                    return baseResponse;

                case SOCIAL_NETWORKS.FACEBOOK:
                    // Facebook також потребує OAuth, локальна перевірка неможлива
                    return baseResponse;

                default:
                    return baseResponse;
            }
        } catch (error) {
            console.error('TaskVerification: Помилка при локальній валідації соціального завдання:', error);
            return {
                ...baseResponse,
                error: error.message
            };
        }
    }

    /**
     * Перевірка лімітованого завдання з урахуванням терміну дії
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyLimitedTask(taskId) {
        try {
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

            // Додаткові дані для перевірки лімітованого завдання
            const verificationData = {
                verification_type: 'limited',
                task_data: {
                    action_type: task.action_type || 'visit',
                    timestamp: Date.now()
                }
            };

            // Запит до API для перевірки виконання лімітованого завдання
            return await performApiVerification(taskId, verificationData);
        } catch (error) {
            console.error('TaskVerification: Помилка при перевірці лімітованого завдання:', error);

            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Сталася помилка при перевірці завдання. Спробуйте пізніше.',
                error: error.message
            };
        }
    }

    /**
     * Перевірка партнерського завдання з додатковою валідацією даних
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyPartnerTask(taskId) {
        try {
            // Отримуємо дані завдання
            const task = getTaskData(taskId);

            if (!task) {
                return {
                    success: false,
                    status: STATUS.ERROR,
                    message: 'Не вдалося отримати дані завдання'
                };
            }

            // Додаткові дані для перевірки партнерського завдання
            const verificationData = {
                verification_type: 'partner',
                task_data: {
                    partner_name: task.partner_name || '',
                    action_type: task.action_type || 'visit',
                    timestamp: Date.now()
                }
            };

            // Запит до API для перевірки виконання партнерського завдання
            return await performApiVerification(taskId, verificationData);
        } catch (error) {
            console.error('TaskVerification: Помилка при перевірці партнерського завдання:', error);

            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Сталася помилка при перевірці завдання. Спробуйте пізніше.',
                error: error.message
            };
        }
    }

    /**
     * Загальна перевірка завдання для невизначених типів
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function verifyGenericTask(taskId) {
        try {
            // Отримуємо дані завдання
            const task = getTaskData(taskId);

            // Додаткові дані для перевірки
            const verificationData = {
                verification_type: 'generic',
                task_data: {
                    action_type: task?.action_type || 'generic',
                    timestamp: Date.now()
                }
            };

            // Запит до API для перевірки виконання завдання
            return await performApiVerification(taskId, verificationData);
        } catch (error) {
            console.error('TaskVerification: Помилка при перевірці загального завдання:', error);

            return {
                success: false,
                status: STATUS.ERROR,
                message: 'Сталася помилка при перевірці завдання. Спробуйте пізніше.',
                error: error.message
            };
        }
    }

    /**
     * Виконання API запиту для перевірки завдання з повторними спробами
     * @param {string} taskId - ID завдання
     * @param {Object} verificationData - Додаткові дані для перевірки
     * @returns {Promise<Object>} Результат перевірки
     */
    async function performApiVerification(taskId, verificationData = {}) {
        // Перевіряємо наявність API
        if (!window.API) {
            console.warn('TaskVerification: API недоступне, використовуємо симуляцію перевірки');
            return simulateVerification(taskId);
        }

        // Перевіряємо наявність шляхів API
        if (!window.API_PATHS || !window.API_PATHS.TASKS) {
            console.warn('TaskVerification: API_PATHS недоступні, використовуємо симуляцію перевірки');
            return simulateVerification(taskId);
        }

        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Додаємо базову інформацію для верифікації
            const payload = {
                verification_data: {
                    ...verificationData,
                    timestamp: Date.now(),
                    user_agent: navigator.userAgent,
                    platform: navigator.platform
                }
            };

            // Використовуємо ретрай функціонал для надійності
            let result = null;
            let lastError = null;
            let attempts = 0;

            // Логіка повторних спроб
            while (attempts <= config.maxApiRetries) {
                try {
                    attempts++;

                    // Створюємо контролер для таймауту
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);

                    // ВИПРАВЛЕНО: Використовуємо правильний формат URL для верифікації
                    // Оригінальний код використовував window.API_PATHS.TASKS.VERIFY(taskId)
                    // Новий код використовує прямий URL відповідно до API документації
                    const apiPath = `/api/user/${userId}/tasks/${taskId}/verify`;

                    // Логуємо запит для діагностики
                    if (config.debug) {
                        console.log(`TaskVerification: Запит верифікації #${attempts} до ${apiPath}`, payload);
                    }

                    // Виконуємо запит до API
                    const response = await window.API.post(
                        apiPath,
                        payload,
                        {
                            signal: controller.signal,
                            headers: { ...config.headers }
                        }
                    );

                    // Очищаємо таймаут
                    clearTimeout(timeoutId);

                    // Логуємо відповідь для діагностики
                    if (config.debug) {
                        console.log(`TaskVerification: Відповідь на запит #${attempts}:`, response);
                    }

                    // Обробляємо відповідь
                    if (response.status === 'success') {
                        result = {
                            success: true,
                            status: STATUS.SUCCESS,
                            message: response.message || 'Завдання успішно виконано!',
                            reward: response.data?.reward || null,
                            verification_details: response.data?.verification || {},
                            response_time_ms: Date.now() - state.lastVerificationTime[taskId]
                        };

                        break; // Успішний запит, виходимо з циклу
                    } else {
                        throw new Error(response.message || response.error || 'Не вдалося перевірити виконання завдання');
                    }
                } catch (error) {
                    lastError = error;

                    // Перевіряємо тип помилки
                    const isNetworkError = error.name === 'TypeError' ||
                                          error.name === 'AbortError' ||
                                          (error.message && error.message.includes('fetch'));

                    const isCorsError = error.message && error.message.includes('CORS');

                    // Для мережевих помилок і CORS помилок пробуємо повторно
                    if ((isNetworkError || isCorsError) && attempts <= config.maxApiRetries) {
                        console.warn(`TaskVerification: Помилка запиту #${attempts}, повторна спроба через ${config.retryInterval/1000}с...`);

                        // Очікуємо перед повторною спробою
                        await new Promise(resolve => setTimeout(resolve, config.retryInterval));
                        continue;
                    }

                    // Інші помилки - просто виходимо з циклу
                    break;
                }
            }

            // Якщо є результат, повертаємо його
            if (result) {
                return result;
            }

            // Якщо не отримали результат, формуємо результат помилки
            const errorResult = {
                success: false,
                status: STATUS.ERROR,
                message: lastError?.message || 'Не вдалося перевірити виконання завдання',
                attempts: attempts
            };

            // Для мережевих помилок
            if (lastError?.name === 'TypeError' || lastError?.name === 'AbortError') {
                errorResult.status = STATUS.NETWORK_ERROR;
                errorResult.message = 'Проблема з підключенням до сервера. Перевірте з\'єднання та спробуйте ще раз.';
            }
            // Для помилок таймауту
            else if (lastError?.name === 'TimeoutError' || (lastError?.message && lastError.message.includes('timeout'))) {
                errorResult.status = STATUS.TIMEOUT;
                errorResult.message = 'Перевищено час очікування. Спробуйте пізніше.';
            }
            // Для помилок CORS
            else if (lastError?.message && lastError.message.includes('CORS')) {
                errorResult.status = STATUS.NETWORK_ERROR;
                errorResult.message = 'Проблема з доступом до сервера. Спробуйте оновити сторінку або використати інший браузер.';
            }

            return errorResult;
        } catch (error) {
            console.error('TaskVerification: Критична помилка при виконанні API запиту:', error);

            // Визначаємо тип помилки
            let status = STATUS.ERROR;
            let message = 'Сталася помилка при перевірці завдання. Спробуйте пізніше.';

            if (error.name === 'TypeError' || error.name === 'AbortError' ||
                (error.message && error.message.includes('fetch'))) {
                status = STATUS.NETWORK_ERROR;
                message = 'Проблема з підключенням до сервера. Перевірте з\'єднання та спробуйте ще раз.';
            }
            else if (error.message && error.message.includes('ID користувача не знайдено')) {
                message = 'Не вдалося визначити ID користувача. Спробуйте оновити сторінку.';
            }

            return {
                success: false,
                status: status,
                message: message,
                error: error.message
            };
        }
    }

    /**
     * Отримання ID користувача з різних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // Використовуємо глобальну функцію, якщо вона є
        if (typeof window.getUserId === 'function') {
            return window.getUserId();
        }

        // Перевіряємо Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user && window.Telegram.WebApp.initDataUnsafe.user.id) {
            return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        }

        // Перевіряємо локальне сховище
        try {
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                return storedId;
            }
        } catch (e) {
            // Ігноруємо помилки localStorage
        }

        // Перевіряємо DOM
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userIdElement.textContent) {
            const domId = userIdElement.textContent.trim();
            if (domId && domId !== 'undefined' && domId !== 'null') {
                return domId;
            }
        }

        // Перевіряємо URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId && urlId !== 'undefined' && urlId !== 'null') {
                return urlId;
            }
        } catch (e) {
            // Ігноруємо помилки URL
        }

        return null;
    }

    /**
     * Імітація перевірки завдання для відладки або коли API недоступне
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} Результат перевірки
     */
    async function simulateVerification(taskId) {
        console.log('TaskVerification: Симуляція верифікації для завдання', taskId);

        // Затримка для імітації мережевої затримки
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Отримуємо тип завдання
        const taskType = getTaskType(taskId);

        // Ймовірність успіху залежить від типу завдання
        let successProbability;

        switch (taskType) {
            case TASK_TYPES.SOCIAL:
                successProbability = 0.8; // 80% успіху для соціальних завдань
                break;
            case TASK_TYPES.LIMITED:
                successProbability = 0.7; // 70% успіху для лімітованих завдань
                break;
            case TASK_TYPES.PARTNER:
                successProbability = 0.6; // 60% успіху для партнерських завдань
                break;
            default:
                successProbability = 0.75; // 75% успіху для інших завдань
        }

        // Імітуємо успіх/неуспіх на основі ймовірності
        const isSuccess = Math.random() < successProbability;

        if (isSuccess) {
            // Отримуємо винагороду за завдання
            const reward = getTaskReward(taskId);

            return {
                success: true,
                status: STATUS.SUCCESS,
                message: 'Завдання успішно виконано! (Симуляція)',
                reward: reward,
                simulated: true
            };
        } else {
            // Визначаємо різні повідомлення невдачі
            const failureMessages = [
                'Умови завдання ще не виконані. Спробуйте пізніше. (Симуляція)',
                'Не вдалося підтвердити виконання завдання. Переконайтеся, що ви виконали всі умови. (Симуляція)',
                'Система не змогла перевірити виконання завдання. Спробуйте пізніше. (Симуляція)',
                'Перевірка не пройшла. Перевірте, чи правильно виконано всі кроки. (Симуляція)'
            ];

            return {
                success: false,
                status: STATUS.FAILURE,
                message: failureMessages[Math.floor(Math.random() * failureMessages.length)],
                simulated: true
            };
        }
    }

    /**
     * Отримання даних завдання з покращеним пошуком серед доступних джерел
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Дані завдання або null
     */
    function getTaskData(taskId) {
        // Пріоритет 1: Отримуємо дані з TaskManager
        if (window.TaskManager && window.TaskManager.findTaskById) {
            const task = window.TaskManager.findTaskById(taskId);
            if (task) return task;
        }

        // Пріоритет 2: Шукаємо завдання в кеші (якщо є)
        if (window.taskCache && window.taskCache[taskId]) {
            return window.taskCache[taskId];
        }

        // Пріоритет 3: Шукаємо завдання серед доступних даних в DOM
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
                task.reward_amount = parseInt(rewardMatch[1]);
                const tokenIndicator = rewardMatch[2].includes('$WINIX') ||
                                     rewardMatch[2].toLowerCase().includes('token');
                task.reward_type = tokenIndicator ? REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;
            }
        }

        // Отримуємо URL дії з кнопки
        const actionButton = taskElement.querySelector('[data-action="start"]');
        if (actionButton) {
            if (actionButton.dataset.url) {
                task.action_url = actionButton.dataset.url;
            } else if (actionButton.getAttribute('href')) {
                task.action_url = actionButton.getAttribute('href');
            }
        }

        // Отримуємо кінцеву дату для лімітованих завдань
        const timerElement = taskElement.querySelector('.timer-value');
        if (timerElement && timerElement.dataset.endDate) {
            task.end_date = timerElement.dataset.endDate;
        }

        // Отримуємо додаткові дані з атрибутів
        const dataAttributes = Array.from(taskElement.attributes)
            .filter(attr => attr.name.startsWith('data-') && !['data-task-id', 'data-task-type', 'data-target-value'].includes(attr.name))
            .reduce((obj, attr) => {
                const key = attr.name.replace('data-', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                obj[key] = attr.value;
                return obj;
            }, {});

        // Додаємо атрибути, якщо вони є
        Object.assign(task, dataAttributes);

        return task;
    }

    /**
     * Отримання типу завдання з кількох джерел
     * @param {string} taskId - ID завдання
     * @returns {string} Тип завдання
     */
    function getTaskType(taskId) {
        // Пріоритет 1: Дані від TaskManager
        if (window.TaskManager && window.TaskManager.findTaskById) {
            const task = window.TaskManager.findTaskById(taskId);
            if (task && task.type) return task.type;
        }

        // Пріоритет 2: З DOM елемента
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

        // Спробуємо визначити тип за контейнером
        const socialContainer = document.getElementById('social-tasks-container');
        const limitedContainer = document.getElementById('limited-tasks-container');
        const partnersContainer = document.getElementById('partners-tasks-container');

        if (socialContainer && socialContainer.contains(taskElement)) {
            return TASK_TYPES.SOCIAL;
        } else if (limitedContainer && limitedContainer.contains(taskElement)) {
            return TASK_TYPES.LIMITED;
        } else if (partnersContainer && partnersContainer.contains(taskElement)) {
            return TASK_TYPES.PARTNER;
        }

        return 'unknown';
    }

    /**
     * Отримання винагороди за завдання з різних джерел
     * @param {string} taskId - ID завдання
     * @returns {Object} Винагорода
     */
    function getTaskReward(taskId) {
        // Спочатку отримуємо дані завдання
        const taskData = getTaskData(taskId);

        if (taskData && taskData.reward_type && taskData.reward_amount) {
            // Використовуємо чітко визначені константи типів
            const rewardType = taskData.reward_type === REWARD_TYPES.TOKENS ?
                REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;

            return {
                type: rewardType,
                amount: Math.max(0, parseFloat(taskData.reward_amount) || 0)
            };
        }

        // Шукаємо інформацію в DOM
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) {
            // За замовчуванням
            return {
                type: REWARD_TYPES.TOKENS,
                amount: 10
            };
        }

        // Знаходимо елемент з винагородою
        const rewardElement = taskElement.querySelector('.task-reward');
        if (!rewardElement) {
            // За замовчуванням
            return {
                type: REWARD_TYPES.TOKENS,
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
            const type = typeText.includes('$WINIX') ||
                         typeText.toLowerCase().includes('token') ||
                         typeText.toLowerCase().includes('winix') ?
                         REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;

            return {
                type,
                amount: amount || 10
            };
        }

        // За замовчуванням
        return {
            type: REWARD_TYPES.TOKENS,
            amount: 10
        };
    }

    /**
     * Відправлення події про результат перевірки
     * @param {string} taskId - ID завдання
     * @param {Object} result - Результат перевірки
     * @param {string} eventId - Унікальний ідентифікатор події
     */
    function dispatchVerificationEvent(taskId, result, eventId) {
        // Перевіряємо, чи не був цей eventId вже оброблений
        if (eventId && state.processedEvents[eventId]) {
            if (config.debug) {
                console.log(`TaskVerification: Подія ${eventId} вже була відправлена, ігноруємо`);
            }
            return;
        }

        // Зберігаємо ідентифікатор події як оброблений
        if (eventId) {
            state.processedEvents[eventId] = Date.now();
        }

        // Додаємо таймстамп до результату
        result.timestamp = Date.now();

        // Відправляємо подію про результат верифікації
        document.dispatchEvent(new CustomEvent('task-verification-result', {
            detail: {
                taskId,
                result,
                timestamp: Date.now(),
                eventId
            }
        }));

        // Якщо завдання було успішно виконано
        if (result.success) {
            // Отримуємо цільове значення завдання
            const targetValue = getTaskTargetValue(taskId);

            // Відправляємо подію про оновлення прогресу
            document.dispatchEvent(new CustomEvent('task-progress-updated', {
                detail: {
                    taskId,
                    progressData: {
                        status: 'completed',
                        progress_value: targetValue,
                        completion_date: new Date().toISOString(),
                        eventId
                    },
                    timestamp: Date.now()
                }
            }));

            // Затримка перед відправкою події завершення завдання для уникнення гонки даних
            setTimeout(() => {
                // Відправляємо подію про завершення завдання
                document.dispatchEvent(new CustomEvent('task-completed', {
                    detail: {
                        taskId,
                        reward: result.reward,
                        timestamp: Date.now(),
                        eventId
                    }
                }));
            }, 50);
        }
    }

    /**
     * Отримання цільового значення прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {number} Цільове значення
     */
    function getTaskTargetValue(taskId) {
        // Спочатку перевіряємо, чи є дані завдання через TaskManager
        if (window.TaskManager && window.TaskManager.findTaskById) {
            const task = window.TaskManager.findTaskById(taskId);
            if (task && task.target_value) {
                return parseInt(task.target_value) || 1;
            }
        }

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
            // Додаємо клас стану завантаження
            actionElement.classList.add('loading');

            // Зберігаємо оригінальний вміст
            const originalContent = actionElement.innerHTML;
            actionElement.setAttribute('data-original-content', originalContent);

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
            // Видаляємо клас стану завантаження
            actionElement.classList.remove('loading');

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
        if (!verificationCache.has(taskId)) return false;

        // Перевіряємо час життя кешу
        const cache = verificationCache.get(taskId);
        return cache && (Date.now() - cache.timestamp) < CACHE_TTL;
    }

    /**
     * Отримання кешованого результату
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Кешований результат або null
     */
    function getCachedResult(taskId) {
        if (!hasCachedResult(taskId)) return null;
        return verificationCache.get(taskId).result;
    }

    /**
     * Кешування результату
     * @param {string} taskId - ID завдання
     * @param {Object} result - Результат перевірки
     */
    function cacheResult(taskId, result) {
        verificationCache.set(taskId, {
            result,
            timestamp: Date.now()
        });

        // Обмежуємо розмір кешу для економії пам'яті
        if (verificationCache.size > 100) {
            // Видаляємо найстаріший запис
            const oldestKey = Array.from(verificationCache.keys())
                .sort((a, b) => verificationCache.get(a).timestamp - verificationCache.get(b).timestamp)[0];

            if (oldestKey) {
                verificationCache.delete(oldestKey);
            }
        }
    }

    /**
     * Очищення кешу перевірок
     */
    function clearVerificationCache() {
        verificationCache.clear();
    }

    /**
     * Скидання лічильників спроб
     */
    function resetVerificationAttempts() {
        state.verificationAttempts = {};
    }

    /**
     * Тестова верифікація для діагностики API
     * @returns {Promise<Object>} Результат тесту API
     */
    async function testApiConnection() {
        console.log('TaskVerification: Перевірка з\'єднання з API...');

        try {
            // Перевіряємо доступність API
            if (!window.API) {
                return {
                    success: false,
                    message: 'API недоступне',
                    apiExists: false
                };
            }

            // Тестовий запит до API
            const testResponse = await fetch(`${window.API_BASE_URL || ''}/api/health-check`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers
                },
                timeout: 5000
            });

            // Перевіряємо статус відповіді
            if (testResponse.ok) {
                return {
                    success: true,
                    message: 'З\'єднання з API успішне',
                    status: testResponse.status,
                    statusText: testResponse.statusText
                };
            } else {
                return {
                    success: false,
                    message: `Помилка з'єднання: ${testResponse.status} ${testResponse.statusText}`,
                    status: testResponse.status,
                    statusText: testResponse.statusText
                };
            }
        } catch (error) {
            console.error('TaskVerification: Помилка тестового з\'єднання:', error);

            return {
                success: false,
                message: `Помилка з'єднання: ${error.message}`,
                error: error.message,
                type: error.name
            };
        }
    }

    /**
     * Скидання стану модуля
     */
    function resetState() {
        // Очищаємо активні перевірки
        state.activeVerifications = {};

        // Очищаємо лічильники спроб
        state.verificationAttempts = {};

        // Очищаємо реєстр оброблених подій
        state.processedEvents = {};

        // Очищаємо стан мережевих помилок
        resetNetworkErrorState();

        // Очищаємо кеш
        clearVerificationCache();

        console.log('TaskVerification: Стан модуля скинуто');
    }

    /**
     * Діагностика поточного стану
     * @returns {Object} Діагностична інформація
     */
    function diagnostics() {
        return {
            state: { ...state },
            config: { ...config },
            networkStatus: {
                online: isNetworkAvailable(),
                lastError: state.lastNetworkError
            },
            cache: {
                size: verificationCache.size,
                keys: Array.from(verificationCache.keys())
            },
            api: {
                available: !!window.API,
                paths: !!window.API_PATHS
            }
        };
    }

    // Публічний API модуля
    return {
        init,
        verifyTask,
        getTaskType,
        getTaskReward,
        getTaskTargetValue,
        normalizeReward,
        isVerificationInProgress,
        clearVerificationCache,
        resetVerificationAttempts,
        resetState,
        testApiConnection,
        diagnostics,
        STATUS,
        TASK_TYPES,
        REWARD_TYPES
    };
})();