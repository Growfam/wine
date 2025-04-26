/**
 * TaskManager - оптимізований модуль керування завданнями
 * Відповідає за:
 * - Координацію між всіма модулями системи завдань
 * - Завантаження та відображення завдань
 * - Обробку взаємодії користувача з завданнями
 *
 * Виправлено:
 * - Коректне делегування оновлення балансу до TaskRewards
 * - Узгоджена обробка типів винагород
 * - Безпечна асинхронна взаємодія між компонентами
 * - Покращена обробка помилок з API та мережевими запитами
 */

window.TaskManager = (function() {
    // Приватні змінні модуля
    let socialTasks = [];
    let limitedTasks = [];
    let partnerTasks = [];
    let userProgress = {};

    // Індикатор використання мок-даних
    const mockDataStatus = {
        userProgress: false,
        socialTasks: false,
        limitedTasks: false,
        partnerTasks: false
    };

    // Функція для логування використання мок-даних
    function logMockDataUsage(dataType, reason) {
        mockDataStatus[dataType] = true;
        console.warn(`TaskManager: Використання ТЕСТОВИХ даних для [${dataType}]. Причина: ${reason}`);

        // Додаємо детальний запис у консоль розробника
        if (console.groupCollapsed) {
            console.groupCollapsed(`%cМОК-ДАНІ [${dataType}]`, 'background: #FFF3CD; color: #856404; padding: 2px 5px; border-radius: 3px;');
            console.info(`Причина: ${reason}`);
            console.info(`Час: ${new Date().toLocaleTimeString()}`);
            console.trace('Стек виклику');
            console.groupEnd();
        }
    }

    // Типи винагород
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Стан ініціалізації компонентів
    const componentsState = {
        progress: false,
        verification: false,
        rewards: false,
        animations: false,
        notifications: false,
        dailyBonus: false,
        leaderboard: false
    };

    // Контроль операцій
    const operationStatus = {
        tasksLoading: false,
        verificationInProgress: {},
        lastVerificationTime: {},
        lastOperationId: null
    };

    // DOM-елементи
    const domElements = {
        socialTasksContainer: null,
        limitedTasksContainer: null,
        partnersTasksContainer: null,
        tabButtons: null,
        contentSections: null
    };

    // Конфігурація обробки помилок
    const errorHandlingConfig = {
        // Кількість повторних спроб для API запитів
        maxRetries: 3,
        // Інтервал між повторними спробами (мс)
        retryInterval: 1500,
        // Типи помилок для повторних спроб
        retryableErrors: ['network_error', 'timeout', 'server_error'],
        // Типи помилок для детального логування
        logDetailedErrors: true,
        // Показувати технічні деталі користувачу в режимі розробки
        showTechnicalDetails: true
    };

    /**
     * Класифікація помилок для кращої обробки
     * @param {Error} error - Об'єкт помилки
     * @returns {Object} Класифікована помилка
     */
    function classifyError(error) {
        // Базовий об'єкт класифікованої помилки
        const classified = {
            originalError: error,
            type: 'unknown_error',
            message: error.message || 'Невідома помилка',
            code: error.code || 'UNKNOWN',
            isRetryable: false,
            details: {}
        };

        // Визначаємо тип помилки на основі її змісту або властивостей
        if (!error) {
            classified.type = 'null_error';
            classified.message = 'Невизначена помилка (null)';
            return classified;
        }

        // Перевірка наявності відповіді від API (якщо використовується axios або fetch)
        if (error.response) {
            // Отримуємо статус та дані відповіді
            const status = error.response.status;
            classified.details.status = status;
            classified.details.data = error.response.data;

            // Класифікуємо за HTTP статусом
            if (status >= 500) {
                classified.type = 'server_error';
                classified.message = error.response.data?.message || 'Помилка сервера. Спробуйте пізніше.';
                classified.isRetryable = true;
            } else if (status === 401 || status === 403) {
                classified.type = 'authentication_error';
                classified.message = 'Необхідна авторизація. Увійдіть в систему.';
            } else if (status === 404) {
                classified.type = 'not_found_error';
                classified.message = 'Ресурс не знайдено. Перевірте URL.';
            } else if (status === 429) {
                classified.type = 'rate_limit_error';
                classified.message = 'Перевищено ліміт запитів. Спробуйте пізніше.';
                classified.isRetryable = true;
            } else if (status >= 400 && status < 500) {
                classified.type = 'validation_error';
                classified.message = error.response.data?.message || 'Помилка в даних запиту.';
                classified.details.validationErrors = error.response.data?.errors;
            }
        } else if (error.request) {
            // Запит був зроблений, але відповідь не отримана
            classified.type = 'network_error';
            classified.message = 'Неможливо підключитися до сервера. Перевірте з\'єднання.';
            classified.isRetryable = true;
        } else if (error.message && error.message.includes('timeout')) {
            classified.type = 'timeout';
            classified.message = 'Перевищено час очікування відповіді від сервера.';
            classified.isRetryable = true;
        } else if (error.message && error.message.toLowerCase().includes('network')) {
            classified.type = 'network_error';
            classified.message = 'Проблема з мережевим з\'єднанням. Перевірте інтернет.';
            classified.isRetryable = true;
        } else if (error.name === 'SyntaxError') {
            classified.type = 'parse_error';
            classified.message = 'Помилка обробки відповіді сервера.';
        } else if (error.code === 'ECONNABORTED') {
            classified.type = 'timeout';
            classified.message = 'Перевищено час очікування відповіді від сервера.';
            classified.isRetryable = true;
        }

        return classified;
    }

    /**
     * Функція для виконання API запитів з повторними спробами
     * @param {Function} apiCall - Функція, що виконує API запит
     * @param {string} operationName - Назва операції для логування
     * @param {number} maxRetries - Максимальна кількість спроб
     * @param {number} retryInterval - Інтервал між спробами (мс)
     * @returns {Promise<Object>} Результат API запиту
     */
    async function retryableApiCall(apiCall, operationName, maxRetries = errorHandlingConfig.maxRetries, retryInterval = errorHandlingConfig.retryInterval) {
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                // Класифікуємо помилку
                const classifiedError = classifyError(error);
                lastError = classifiedError;

                // Детально логуємо помилку
                if (errorHandlingConfig.logDetailedErrors) {
                    console.error(`TaskManager: Помилка при ${operationName} (спроба ${attempt}/${maxRetries}):`, {
                        type: classifiedError.type,
                        message: classifiedError.message,
                        code: classifiedError.code,
                        details: classifiedError.details,
                        stack: error.stack
                    });
                } else {
                    console.error(`TaskManager: Помилка при ${operationName} (спроба ${attempt}/${maxRetries}):`, error.message);
                }

                // Якщо це остання спроба або помилка не підлягає повторним спробам - пробрасываем її далі
                if (attempt >= maxRetries || !classifiedError.isRetryable) {
                    throw classifiedError;
                }

                // Чекаємо перед наступною спробою з поступовим збільшенням інтервалу
                const waitTime = retryInterval * attempt;
                console.log(`TaskManager: Повторна спроба ${attempt} з ${maxRetries} через ${waitTime}мс...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // Цей код не має виконуватися, але додаємо його для повноти
        throw lastError;
    }

    /**
     * Перевірка доступності API
     * @returns {boolean} Чи доступне API
     */
    function isApiAvailable() {
        return window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function';
    }

    /**
     * Перевірка, чи є користувач авторизованим
     * @returns {boolean} Результат перевірки
     */
    function isUserAuthenticated() {
        // Перевірка через API, якщо доступне
        if (isApiAvailable() && window.API.isAuthenticated) {
            return window.API.isAuthenticated();
        }

        // Перевірка через localStorage або інші маркери авторизації
        const hasAuthToken = localStorage.getItem('auth_token') || localStorage.getItem('user_token');
        const hasUserData = localStorage.getItem('user_data');

        return Boolean(hasAuthToken || hasUserData);
    }

    /**
     * Ініціалізація менеджера завдань
     */
    function init() {
        console.log('TaskManager: Ініціалізація оптимізованого модуля TaskManager...');

        // Скидаємо стан використання мок-даних при ініціалізації
        Object.keys(mockDataStatus).forEach(key => {
            mockDataStatus[key] = false;
        });

        // Перевіряємо доступність API
        if (!isApiAvailable()) {
            console.warn('TaskManager: API недоступне. Буде використано тестові дані для всіх типів завдань');
        }

        // Знаходимо необхідні DOM-елементи
        findDomElements();

        // Налаштування перемикачів вкладок
        setupTabSwitching();

        // Ініціалізуємо інші модулі
        initializeComponents();

        // Завантаження даних користувача та завдань
        loadUserProgress()
            .then(() => {
                loadTasks();

                // Ініціалізуємо компоненти після завантаження завдань
                if (window.DailyBonus && !componentsState.dailyBonus) {
                    window.DailyBonus.init();
                    componentsState.dailyBonus = true;
                }

                if (window.Leaderboard && !componentsState.leaderboard) {
                    window.Leaderboard.init();
                    componentsState.leaderboard = true;
                }
            })
            .catch(error => {
                const classifiedError = classifyError(error);
                console.error('TaskManager: Помилка завантаження даних:', {
                    type: classifiedError.type,
                    message: classifiedError.message,
                    details: classifiedError.details
                });

                // Показуємо інформативне повідомлення користувачу
                let errorMessage = 'Не вдалося завантажити завдання. ';

                switch (classifiedError.type) {
                    case 'network_error':
                    case 'timeout':
                        errorMessage += 'Перевірте підключення до Інтернету та спробуйте оновити сторінку.';
                        break;
                    case 'server_error':
                        errorMessage += 'Сервер тимчасово недоступний. Спробуйте пізніше.';
                        break;
                    case 'authentication_error':
                        errorMessage += 'Необхідно авторизуватися. Перейдіть на сторінку входу.';
                        break;
                    default:
                        errorMessage += 'Спробуйте пізніше або зверніться до підтримки.';
                }

                showErrorMessage(errorMessage);
            });

        // Підписуємося на події
        subscribeToEvents();
    }

    /**
     * Знаходження необхідних DOM-елементів
     */
    function findDomElements() {
        domElements.socialTasksContainer = document.getElementById('social-tasks-container');
        domElements.limitedTasksContainer = document.getElementById('limited-tasks-container');
        domElements.partnersTasksContainer = document.getElementById('partners-tasks-container');
        domElements.tabButtons = document.querySelectorAll('.tab');
        domElements.contentSections = document.querySelectorAll('.content-section');
    }

    /**
     * Ініціалізація компонентів
     */
    function initializeComponents() {
        // Ініціалізуємо модуль прогресу
        if (window.TaskProgress && !componentsState.progress) {
            window.TaskProgress.init();
            componentsState.progress = true;
        }

        // Ініціалізуємо модуль перевірки
        if (window.TaskVerification && !componentsState.verification) {
            window.TaskVerification.init();
            componentsState.verification = true;
        }

        // Ініціалізуємо модуль винагород
        if (window.TaskRewards && !componentsState.rewards) {
            window.TaskRewards.init();
            componentsState.rewards = true;
        }

        // Ініціалізуємо модулі UI
        if (window.UI) {
            // Анімації
            if (window.UI.Animations && !componentsState.animations) {
                window.UI.Animations.init();
                componentsState.animations = true;
            }

            // Сповіщення
            if (window.UI.Notifications && !componentsState.notifications) {
                window.UI.Notifications.init();
                componentsState.notifications = true;
            }
        }
    }

    /**
     * Налаштування перемикачів вкладок
     */
    function setupTabSwitching() {
        if (!domElements.tabButtons) return;

        domElements.tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Знімаємо активний клас з усіх вкладок
                domElements.tabButtons.forEach(btn => btn.classList.remove('active'));

                // Додаємо активний клас поточній вкладці
                this.classList.add('active');

                // Ховаємо всі секції контенту
                if (domElements.contentSections) {
                    domElements.contentSections.forEach(section => section.classList.remove('active'));
                }

                // Показуємо відповідну секцію
                const tabType = this.dataset.tab;
                const targetSection = document.getElementById(`${tabType}-content`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }

                // Зберігаємо активну вкладку в localStorage
                try {
                    localStorage.setItem('active_tasks_tab', tabType);
                } catch (e) {
                    console.warn('TaskManager: Помилка збереження вкладки в localStorage:', e.message);
                }
            });
        });

        // Відновлюємо активну вкладку з localStorage
        try {
            const savedTab = localStorage.getItem('active_tasks_tab');
            if (savedTab) {
                const savedTabButton = document.querySelector(`.tab[data-tab="${savedTab}"]`);
                if (savedTabButton) {
                    savedTabButton.click();
                }
            }
        } catch (e) {
            console.warn('TaskManager: Помилка відновлення вкладки з localStorage:', e.message);
        }
    }

    /**
     * Завантаження прогресу користувача
     */
    async function loadUserProgress() {
        try {
            // Перевіряємо доступність API
            if (!isApiAvailable()) {
                throw new Error('API_NOT_AVAILABLE');
            }

            // Якщо доступний модуль прогресу, використовуємо його
            if (window.TaskProgress) {
                userProgress = window.TaskProgress.getUserProgress();
                return userProgress;
            }

            // Інакше отримуємо через API
            const userId = window.getUserId();
            if (!userId) {
                throw new Error('USER_ID_NOT_FOUND');
            }

            return await retryableApiCall(
                async () => {
                    const response = await window.API.get(window.API_PATHS.USER.PROGRESS(userId));
                    if (!response.success && response.error) {
                        throw new Error(response.error);
                    }
                    userProgress = response.data || {};
                    return userProgress;
                },
                'завантаженні прогресу користувача'
            );
        } catch (error) {
            const classifiedError = classifyError(error);
            console.error('TaskManager: Помилка завантаження прогресу користувача:', {
                type: classifiedError.type,
                message: classifiedError.message,
                details: classifiedError.details
            });

            // Спробуємо завантажити з localStorage як резервний варіант
            try {
                const savedProgress = localStorage.getItem('winix_task_progress');
                if (savedProgress) {
                    userProgress = JSON.parse(savedProgress);
                    logMockDataUsage('userProgress', 'Завантажено з localStorage через помилку API');
                    return userProgress;
                }
            } catch (localStorageError) {
                console.warn('TaskManager: Помилка завантаження прогресу з localStorage:', localStorageError.message);
            }

            // Якщо нічого не вдалося, використовуємо пустий об'єкт
            userProgress = {};
            logMockDataUsage('userProgress', 'Використання пустого об\'єкту через помилки з API та localStorage');

            // Якщо помилка критична, повідомляємо користувача
            if (classifiedError.type === 'authentication_error') {
                showErrorMessage('Для доступу до завдань необхідно авторизуватися');
            } else if (classifiedError.type === 'server_error') {
                showErrorMessage('Сервер тимчасово недоступний. Ваш прогрес буде завантажено пізніше.');
            }

            return {};
        }
    }

    /**
     * Завантаження завдань з API
     */
    async function loadTasks() {
        try {
            // Запобігаємо одночасним запитам
            if (operationStatus.tasksLoading) {
                console.log('TaskManager: Завантаження завдань вже виконується');
                return;
            }

            operationStatus.tasksLoading = true;

            // Перевіряємо доступність API
            if (!isApiAvailable()) {
                throw new Error('API_NOT_AVAILABLE');
            }

            try {
                // Виконуємо паралельні запити для швидшого завантаження
                const [socialResponse, limitedResponse, partnerResponse] = await Promise.all([
                    retryableApiCall(
                        () => window.API.get(window.API_PATHS.TASKS.SOCIAL),
                        'завантаженні соціальних завдань'
                    ),
                    retryableApiCall(
                        () => window.API.get(window.API_PATHS.TASKS.LIMITED),
                        'завантаженні лімітованих завдань'
                    ),
                    retryableApiCall(
                        () => window.API.get(window.API_PATHS.TASKS.PARTNERS),
                        'завантаженні партнерських завдань'
                    )
                ]);

                // Зберігаємо дані та відображаємо завдання
                if (socialResponse.success) {
                    socialTasks = normalizeTasksData(socialResponse.data || []);
                    renderSocialTasks();
                } else if (socialResponse.error) {
                    console.warn(`TaskManager: Помилка завантаження соціальних завдань: ${socialResponse.error}`);
                    // Використовуємо мок-дані при помилці
                    socialTasks = getMockSocialTasks();
                    logMockDataUsage('socialTasks', `Помилка API: ${socialResponse.error}`);
                    renderSocialTasks();
                }

                if (limitedResponse.success) {
                    limitedTasks = normalizeTasksData(limitedResponse.data || []);
                    renderLimitedTasks();
                } else if (limitedResponse.error) {
                    console.warn(`TaskManager: Помилка завантаження лімітованих завдань: ${limitedResponse.error}`);
                    // Використовуємо мок-дані при помилці
                    limitedTasks = getMockLimitedTasks();
                    logMockDataUsage('limitedTasks', `Помилка API: ${limitedResponse.error}`);
                    renderLimitedTasks();
                }

                if (partnerResponse.success) {
                    partnerTasks = normalizeTasksData(partnerResponse.data || []);
                    renderPartnerTasks();
                } else if (partnerResponse.error) {
                    console.warn(`TaskManager: Помилка завантаження партнерських завдань: ${partnerResponse.error}`);
                    // Використовуємо мок-дані при помилці
                    partnerTasks = getMockPartnerTasks();
                    logMockDataUsage('partnerTasks', `Помилка API: ${partnerResponse.error}`);
                    renderPartnerTasks();
                }
            } catch (error) {
                throw error; // Пробрасываем ошибку для обработки в блоке catch
            } finally {
                operationStatus.tasksLoading = false;
            }
        } catch (error) {
            const classifiedError = classifyError(error);
            console.error('TaskManager: Помилка завантаження завдань:', {
                type: classifiedError.type,
                message: classifiedError.message,
                details: classifiedError.details
            });

            // Визначаємо причину використання мок-даних
            let mockReason = 'Невідома помилка';

            if (classifiedError.type === 'network_error') {
                mockReason = 'Проблема з мережевим з\'єднанням';
            } else if (classifiedError.type === 'timeout') {
                mockReason = 'Перевищено час очікування відповіді від сервера';
            } else if (classifiedError.type === 'server_error') {
                mockReason = 'Помилка на сервері';
            } else if (classifiedError.type === 'authentication_error') {
                mockReason = 'Користувач не авторизований';
            } else if (error.message === 'API_NOT_AVAILABLE') {
                mockReason = 'API недоступне';
            }

            // Використовуємо тестові дані у випадку помилки
            socialTasks = getMockSocialTasks();
            limitedTasks = getMockLimitedTasks();
            partnerTasks = getMockPartnerTasks();

            // Логуємо використання мок-даних
            logMockDataUsage('socialTasks', mockReason);
            logMockDataUsage('limitedTasks', mockReason);
            logMockDataUsage('partnerTasks', mockReason);

            // Відображаємо завдання
            renderSocialTasks();
            renderLimitedTasks();
            renderPartnerTasks();

            // Показуємо інформативне повідомлення про помилку
            let errorMessage = 'Не вдалося завантажити завдання. ';

            switch (classifiedError.type) {
                case 'network_error':
                    errorMessage += 'Перевірте підключення до Інтернету. Відображаються демонстраційні дані.';
                    break;
                case 'timeout':
                    errorMessage += 'Сервер не відповідає. Відображаються демонстраційні дані.';
                    break;
                case 'server_error':
                    errorMessage += 'Сервер тимчасово недоступний. Відображаються демонстраційні дані.';
                    break;
                case 'authentication_error':
                    errorMessage += 'Необхідно авторизуватися. Відображаються демонстраційні дані.';
                    break;
                default:
                    errorMessage += 'Використовуються демонстраційні дані.';
            }

            // Додаємо технічні деталі в режимі розробки
            if (errorHandlingConfig.showTechnicalDetails) {
                errorMessage += ` (${classifiedError.type}: ${classifiedError.message})`;
            }

            showErrorMessage(errorMessage);

            operationStatus.tasksLoading = false;
        }
    }

    /**
     * Нормалізація даних завдань
     * @param {Array} tasks - Масив завдань
     * @returns {Array} Нормалізовані завдання
     */
    function normalizeTasksData(tasks) {
        if (!Array.isArray(tasks)) return [];

        return tasks.map(task => {
            // Створюємо копію завдання
            const normalizedTask = { ...task };

            // Перевіряємо наявність обов'язкових полів
            normalizedTask.id = normalizedTask.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            normalizedTask.title = normalizedTask.title || 'Завдання';
            normalizedTask.description = normalizedTask.description || 'Опис завдання';

            // Нормалізуємо тип винагороди
            if (normalizedTask.reward_type) {
                const lowerType = normalizedTask.reward_type.toLowerCase();
                if (lowerType.includes('token') || lowerType.includes('winix')) {
                    normalizedTask.reward_type = REWARD_TYPES.TOKENS;
                } else if (lowerType.includes('coin') || lowerType.includes('жетон')) {
                    normalizedTask.reward_type = REWARD_TYPES.COINS;
                }
            } else {
                normalizedTask.reward_type = REWARD_TYPES.TOKENS;
            }

            // Нормалізуємо суму винагороди
            normalizedTask.reward_amount = parseFloat(normalizedTask.reward_amount) || 10;

            // Нормалізуємо цільове значення
            normalizedTask.target_value = parseInt(normalizedTask.target_value) || 1;

            return normalizedTask;
        });
    }

    /**
     * Отримання тестових соціальних завдань
     */
    function getMockSocialTasks() {
        return [
            {
                id: 'social_telegram',
                title: 'Підписатися на Telegram',
                description: 'Підпишіться на наш офіційний Telegram канал для отримання останніх новин та оновлень',
                type: 'social',
                reward_type: REWARD_TYPES.TOKENS,
                reward_amount: 10,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://t.me/winix_official',
                action_label: 'Підписатися'
            },
            {
                id: 'social_twitter',
                title: 'Підписатися на Twitter',
                description: 'Підпишіться на наш Twitter акаунт та будьте в курсі останніх новин',
                type: 'social',
                reward_type: REWARD_TYPES.TOKENS,
                reward_amount: 15,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://twitter.com/winix_official',
                action_label: 'Підписатися'
            },
            {
                id: 'social_discord',
                title: 'Приєднатися до Discord',
                description: 'Приєднайтеся до нашої спільноти в Discord, спілкуйтеся з іншими учасниками та отримуйте підтримку',
                type: 'social',
                reward_type: REWARD_TYPES.TOKENS,
                reward_amount: 15,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://discord.gg/winix',
                action_label: 'Приєднатися'
            },
            {
                id: 'social_share',
                title: 'Поділитися з друзями',
                description: 'Розкажіть друзям про WINIX у соціальних мережах',
                type: 'social',
                reward_type: REWARD_TYPES.TOKENS,
                reward_amount: 20,
                target_value: 1,
                action_type: 'share',
                action_label: 'Поділитися'
            }
        ];
    }

    /**
     * Отримання тестових лімітованих завдань
     */
    function getMockLimitedTasks() {
        // Створюємо кінцеву дату через 3 дні
        const endDate1 = new Date();
        endDate1.setDate(endDate1.getDate() + 3);

        // Створюємо кінцеву дату через 5 днів
        const endDate2 = new Date();
        endDate2.setDate(endDate2.getDate() + 5);

        return [
            {
                id: 'limited_vote',
                title: 'Проголосувати за проект',
                description: 'Проголосуйте за WINIX на платформі CoinVote для підтримки проекту',
                type: 'limited',
                reward_type: REWARD_TYPES.TOKENS,
                reward_amount: 30,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://coinvote.cc/winix',
                action_label: 'Проголосувати',
                end_date: endDate1.toISOString()
            },
            {
                id: 'limited_game',
                title: 'Зіграти в мініГРУ',
                description: 'Зіграйте в нашу мініГру та отримайте бонус за досягнення 1000 очок',
                type: 'limited',
                reward_type: REWARD_TYPES.COINS,
                reward_amount: 50,
                target_value: 1,
                action_type: 'play',
                action_label: 'Грати',
                end_date: endDate2.toISOString()
            }
        ];
    }

    /**
     * Отримання тестових партнерських завдань
     */
    function getMockPartnerTasks() {
        return [
            {
                id: 'partner_exchange',
                title: 'Зареєструватися на біржі',
                description: 'Зареєструйтеся на нашій партнерській біржі та отримайте бонус',
                type: 'partner',
                reward_type: REWARD_TYPES.TOKENS,
                reward_amount: 100,
                target_value: 1,
                action_type: 'register',
                action_url: 'https://exchange.example.com/ref=winix',
                action_label: 'Зареєструватися',
                partner_name: 'CryptoExchange'
            }
        ];
    }

    /**
     * Відображення соціальних завдань
     */
    function renderSocialTasks() {
        if (!domElements.socialTasksContainer) return;

        // Очищаємо контейнер
        domElements.socialTasksContainer.innerHTML = '';

        if (socialTasks.length === 0) {
            domElements.socialTasksContainer.innerHTML = '<div class="no-tasks" data-lang-key="earn.no_tasks">Немає доступних завдань</div>';
            return;
        }

        // Додаємо індикатор, якщо використовуються мок-дані
        if (mockDataStatus.socialTasks && errorHandlingConfig.showTechnicalDetails) {
            const mockIndicator = document.createElement('div');
            mockIndicator.className = 'mock-data-indicator';
            mockIndicator.innerHTML = '⚠️ Демонстраційні дані';
            domElements.socialTasksContainer.appendChild(mockIndicator);
        }

        // Відображаємо кожне завдання
        socialTasks.forEach(task => {
            // Перевіряємо наявність компонента для соціальних завдань
            if (window.SocialTask && window.SocialTask.create) {
                const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                domElements.socialTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення лімітованих завдань
     */
    function renderLimitedTasks() {
        if (!domElements.limitedTasksContainer) return;

        // Очищаємо контейнер
        domElements.limitedTasksContainer.innerHTML = '';

        if (limitedTasks.length === 0) {
            domElements.limitedTasksContainer.innerHTML = '<div class="task-item"><div class="task-header"><div class="task-title" data-lang-key="earn.expect_new_tasks_title">Очікуйте на нові завдання</div><div class="timer-container"><span class="timer-icon">⏰</span> <span data-lang-key="earn.coming_soon">Скоро</span></div></div><div class="task-description" data-lang-key="earn.expect_new_tasks">Лімітовані завдання будуть доступні найближчим часом. Не пропустіть можливість отримати додаткові нагороди!</div></div>';
            return;
        }

        // Додаємо індикатор, якщо використовуються мок-дані
        if (mockDataStatus.limitedTasks && errorHandlingConfig.showTechnicalDetails) {
            const mockIndicator = document.createElement('div');
            mockIndicator.className = 'mock-data-indicator';
            mockIndicator.innerHTML = '⚠️ Демонстраційні дані';
            domElements.limitedTasksContainer.appendChild(mockIndicator);
        }

        // Відображаємо кожне завдання
        limitedTasks.forEach(task => {
            // Перевіряємо наявність компонента для лімітованих завдань
            if (window.LimitedTask && window.LimitedTask.create) {
                const taskElement = window.LimitedTask.create(task, userProgress[task.id]);
                domElements.limitedTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
            }
        });
    }

    /**
     * Відображення партнерських завдань
     */
    function renderPartnerTasks() {
        if (!domElements.partnersTasksContainer) return;

        // Очищаємо контейнер
        domElements.partnersTasksContainer.innerHTML = '';

        if (partnerTasks.length === 0) {
            domElements.partnersTasksContainer.innerHTML = '<div class="task-item"><div class="task-header"><div class="task-title" data-lang-key="earn.expect_partners_title">Очікуйте на партнерські пропозиції</div></div><div class="task-description" data-lang-key="earn.expect_partners">Партнерські завдання будуть доступні найближчим часом. Слідкуйте за оновленнями!</div></div>';
            return;
        }

        // Додаємо індикатор, якщо використовуються мок-дані
        if (mockDataStatus.partnerTasks && errorHandlingConfig.showTechnicalDetails) {
            const mockIndicator = document.createElement('div');
            mockIndicator.className = 'mock-data-indicator';
            mockIndicator.innerHTML = '⚠️ Демонстраційні дані';
            domElements.partnersTasksContainer.appendChild(mockIndicator);
        }

        // Відображаємо кожне завдання
        partnerTasks.forEach(task => {
            // Перевіряємо наявність компонента для партнерських завдань
            if (window.PartnerTask && window.PartnerTask.create) {
                const taskElement = window.PartnerTask.create(task, userProgress[task.id]);
                domElements.partnersTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Створення базового елементу завдання (запасний варіант)
     */
    function createBasicTaskElement(task, progress, isLimited = false) {
        const completed = progress && progress.status === 'completed';
        const progressValue = progress ? progress.progress_value : 0;
        const progressPercent = Math.min(100, Math.round((progressValue / task.target_value) * 100)) || 0;

        // Форматуємо тип нагороди
        const rewardType = task.reward_type === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів';

        let timerHtml = '';
        if (isLimited && task.end_date) {
            const endDate = new Date(task.end_date);
            const now = new Date();
            const timeLeft = endDate - now;

            if (timeLeft > 0) {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                timerHtml = `<div class="timer-container"><span class="timer-icon">⏰</span> <span class="timer-value" data-end-date="${task.end_date}">${days}д ${hours}г</span></div>`;
            } else {
                timerHtml = `<div class="timer-container expired"><span class="timer-icon">⏰</span> <span data-lang-key="earn.expired">Закінчено</span></div>`;
            }
        }

        // Додаємо інформацію про партнера, якщо є
        let partnerLabel = '';
        if (task.partner_name) {
            partnerLabel = `<div class="partner-label">Партнер: ${escapeHtml(task.partner_name)}</div>`;
        }

        return `
            <div class="task-item" data-task-id="${task.id}" data-task-type="${task.type}" data-target-value="${task.target_value}">
                ${partnerLabel}
                <div class="task-header">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${completed ? 
                      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                      `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${rewardType}</span></div>${timerHtml}`
                    }
                </div>
                <div class="task-description">${escapeHtml(task.description)}</div>
                ${task.target_value > 1 ? 
                  `<div class="task-progress">
                       <div class="progress-text">${progressValue}/${task.target_value} ${task.progress_label || ''}</div>
                       <div class="progress-bar-container">
                           <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                       </div>
                   </div>` : ''
                }
                <div class="task-action">
                    ${completed ? 
                      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                      `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>
                       <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`
                    }
                </div>
            </div>
        `;
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Делегування подій для кнопок завдань
        document.addEventListener('click', function(event) {
            const target = event.target;

            // Обробка дій з завданнями
            if (target.matches('.action-button[data-action="start"]')) {
                const taskId = target.dataset.taskId;
                startTask(taskId);
            } else if (target.matches('.action-button[data-action="verify"]')) {
                const taskId = target.dataset.taskId;
                verifyTask(taskId);
            }
        });

        // Обробка кнопки отримання щоденного бонусу
        const claimDailyButton = document.getElementById('claim-daily');
        if (claimDailyButton) {
            claimDailyButton.addEventListener('click', function() {
                if (window.DailyBonus && window.DailyBonus.claimBonus) {
                    window.DailyBonus.claimBonus();
                } else {
                    showErrorMessage('Модуль щоденних бонусів недоступний');
                }
            });
        }

        // Обробка події завершення завдання
        document.addEventListener('task-completed', function(event) {
            const { taskId } = event.detail;

            // Оновлюємо відображення завдання
            refreshTaskDisplay(taskId);
        });

        // Обробка події оновлення прогресу
        document.addEventListener('task-progress-updated', function(event) {
            const { taskId, progressData } = event.detail;

            // Оновлюємо локальний прогрес
            userProgress[taskId] = progressData;

            // Оновлюємо відображення завдання
            refreshTaskDisplay(taskId);
        });
    }

    /**
     * Розпочати виконання завдання
     */
    async function startTask(taskId) {
        try {
            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) {
                throw new Error('Завдання не знайдено');
            }

            // Якщо є API, використовуємо його
            if (isApiAvailable() && isUserAuthenticated()) {
                try {
                    const userId = window.getUserId();
                    if (!userId) {
                        throw new Error('ID користувача не знайдено');
                    }

                    const response = await retryableApiCall(
                        () => window.API.post(window.API_PATHS.TASKS.START(taskId)),
                        'запуску завдання'
                    );

                    if (!response.success) {
                        throw new Error(response.message || response.error || 'Не вдалося розпочати завдання');
                    }

                    // Якщо це завдання з URL, відкриваємо відповідне посилання
                    if (task.action_url) {
                        window.open(task.action_url, '_blank');
                    }

                    // Показуємо повідомлення
                    showSuccessMessage('Завдання розпочато! Виконайте необхідні дії.');

                    // Оновлюємо прогрес, якщо є модуль прогресу
                    if (window.TaskProgress) {
                        // Ініціалізуємо прогрес, якщо його ще немає
                        if (!userProgress[taskId]) {
                            const progressData = {
                                status: 'in_progress',
                                progress_value: 0,
                                start_date: new Date().toISOString()
                            };

                            window.TaskProgress.updateTaskProgress(taskId, progressData);
                        }
                    }
                } catch (error) {
                    const classifiedError = classifyError(error);

                    // Якщо це не критична помилка - все одно спробуємо відкрити URL
                    if (task.action_url && !['authentication_error', 'validation_error'].includes(classifiedError.type)) {
                        window.open(task.action_url, '_blank');
                        showSuccessMessage('Завдання розпочато, але виникли проблеми з сервером. Будь ласка, перевірте завдання після виконання.');
                    } else {
                        // Якщо критична помилка або немає URL - показуємо повідомлення про помилку
                        throw error; // Передаємо помилку у верхній блок catch
                    }
                }
            } else {
                // Якщо немає API або користувач не авторизований
                if (task.action_url) {
                    window.open(task.action_url, '_blank');
                }

                // Показуємо різні повідомлення залежно від статусу
                if (!isApiAvailable()) {
                    console.warn('TaskManager: API недоступне. Відкриваємо URL без взаємодії з сервером');
                    showSuccessMessage('Завдання розпочато в автономному режимі. Будь ласка, перевірте його після виконання.');
                } else if (!isUserAuthenticated()) {
                    console.warn('TaskManager: Користувач не авторизований. Відкриваємо URL без взаємодії з сервером');
                    showSuccessMessage('Для повного відстеження прогресу, будь ласка, увійдіть в систему.');
                } else {
                    showSuccessMessage('Завдання розпочато! Виконайте необхідні дії.');
                }
            }
        } catch (error) {
            const classifiedError = classifyError(error);
            console.error('TaskManager: Помилка при запуску завдання:', {
                type: classifiedError.type,
                message: classifiedError.message,
                details: classifiedError.details
            });

            // Генеруємо інформативне повідомлення для користувача
            let errorMessage = 'Сталася помилка при спробі розпочати завдання. ';

            switch (classifiedError.type) {
                case 'authentication_error':
                    errorMessage += 'Будь ласка, увійдіть в систему.';
                    break;
                case 'not_found_error':
                    errorMessage += 'Завдання не знайдено.';
                    break;
                case 'validation_error':
                    errorMessage += 'Перевірте правильність даних.';
                    break;
                case 'network_error':
                case 'timeout':
                    errorMessage += 'Перевірте підключення до Інтернету.';
                    break;
                case 'server_error':
                    errorMessage += 'Сервер тимчасово недоступний. Спробуйте пізніше.';
                    break;
                default:
                    errorMessage += 'Спробуйте ще раз або зверніться до підтримки.';
            }

            // Додаємо технічні деталі в режимі розробки
            if (errorHandlingConfig.showTechnicalDetails) {
                errorMessage += ` (${classifiedError.type}: ${classifiedError.message})`;
            }

            showErrorMessage(errorMessage);
        }
    }

    /**
     * Перевірити виконання завдання
     */
    async function verifyTask(taskId) {
        try {
            // Запобігаємо повторним перевіркам
            if (operationStatus.verificationInProgress[taskId]) {
                showErrorMessage('Перевірка вже виконується. Зачекайте.');
                return;
            }

            // Перевіряємо інтервал між перевірками
            const now = Date.now();
            const lastTime = operationStatus.lastVerificationTime[taskId] || 0;
            if (now - lastTime < 3000) { // 3 секунди між перевірками
                showErrorMessage('Зачекайте кілька секунд перед новою спробою');
                return;
            }

            // Встановлюємо стан перевірки
            operationStatus.verificationInProgress[taskId] = true;
            operationStatus.lastVerificationTime[taskId] = now;

            // Показуємо індикатор завантаження
            showVerificationLoader(taskId);

            try {
                // Якщо є модуль верифікації, використовуємо його
                if (window.TaskVerification) {
                    // Отримуємо результат перевірки
                    const result = await window.TaskVerification.verifyTask(taskId);

                    // Оновлюємо стан відображення
                    refreshTaskDisplay(taskId);

                    // Відображаємо результат перевірки
                    if (result.success) {
                        showSuccessMessage(result.message || 'Завдання успішно виконано!');
                    } else {
                        // Показуємо конкретне повідомлення про помилку з модуля верифікації
                        showErrorMessage(result.message || 'Не вдалося перевірити виконання завдання');
                    }
                } else {
                    // Перевіряємо наявність API
                    if (isApiAvailable() && isUserAuthenticated()) {
                        try {
                            const userId = window.getUserId();
                            if (!userId) {
                                throw new Error('ID користувача не знайдено');
                            }

                            const response = await retryableApiCall(
                                () => window.API.post(window.API_PATHS.TASKS.VERIFY(taskId)),
                                'перевірці завдання',
                                2,  // Менше повторних спроб для верифікації
                                1000 // Менший інтервал між спробами
                            );

                            // Оновлюємо стан відображення
                            refreshTaskDisplay(taskId);

                            if (response.success) {
                                showSuccessMessage(response.message || 'Завдання успішно виконано!');

                                // Якщо є винагорода, обробляємо її
                                if (response.reward) {
                                    const task = findTaskById(taskId);
                                    processReward(taskId, normalizeReward(response.reward, task));
                                }
                            } else {
                                // Отримуємо конкретну причину відмови від API
                                const errorMessage = response.message || response.error || 'Не вдалося перевірити виконання завдання';
                                showErrorMessage(errorMessage);
                            }
                        } catch (error) {
                            const classifiedError = classifyError(error);

                            // Генеруємо інформативне повідомлення про помилку
                            let errorMessage = 'Помилка перевірки завдання: ';

                            switch (classifiedError.type) {
                                case 'network_error':
                                    errorMessage += 'відсутнє підключення до Інтернету.';
                                    break;
                                case 'timeout':
                                    errorMessage += 'сервер не відповідає. Спробуйте пізніше.';
                                    break;
                                case 'server_error':
                                    errorMessage += 'проблема на сервері. Спробуйте пізніше.';
                                    break;
                                case 'authentication_error':
                                    errorMessage += 'необхідно авторизуватися.';
                                    break;
                                default:
                                    errorMessage += 'перевірте, чи виконано всі умови завдання.';
                            }

                            showErrorMessage(errorMessage);
                            console.error('TaskManager: Помилка перевірки завдання через API:', classifiedError);

                            // Повідомляємо про перехід на тестову верифікацію
                            if (!isUserAuthenticated()) {
                                console.warn('TaskManager: Користувач не авторизований. Переходимо до симуляції верифікації');
                                logMockDataUsage('verification', 'Користувач не авторизований');
                                simulateVerification(taskId);
                            }
                        }
                    } else {
                        // Якщо немає ні модуля верифікації, ні API, імітуємо перевірку
                        let reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
                        logMockDataUsage('verification', reason);
                        simulateVerification(taskId);
                    }
                }
            } finally {
                // Приховуємо індикатор завантаження і очищаємо стан перевірки
                hideVerificationLoader(taskId);
                delete operationStatus.verificationInProgress[taskId];
            }
        } catch (error) {
            const classifiedError = classifyError(error);
            console.error('TaskManager: Помилка при перевірці завдання:', {
                type: classifiedError.type,
                message: classifiedError.message,
                details: classifiedError.details
            });

            // Приховуємо індикатор завантаження
            hideVerificationLoader(taskId);
            delete operationStatus.verificationInProgress[taskId];

            // Показуємо повідомлення про помилку
            let errorMessage = 'Сталася помилка при перевірці завдання. ';

            if (classifiedError.type === 'network_error') {
                errorMessage += 'Перевірте підключення до Інтернету та спробуйте ще раз.';
            } else if (classifiedError.type === 'server_error') {
                errorMessage += 'Сервер тимчасово недоступний. Спробуйте пізніше.';
            } else {
                errorMessage += 'Спробуйте ще раз або зверніться до підтримки.';
            }

            showErrorMessage(errorMessage);
        }
    }

    /**
     * Нормалізація об'єкта винагороди
     * @param {Object} reward - Об'єкт винагороди
     * @param {Object} task - Дані завдання для резервного визначення типу
     * @returns {Object} Нормалізована винагорода
     */
    function normalizeReward(reward, task) {
        // Якщо винагорода вже є об'єктом з вірним форматом
        if (reward && typeof reward === 'object' &&
            reward.type && typeof reward.amount === 'number') {
            // Перевіряємо тип
            const type = normalizeRewardType(reward.type);
            return {
                type: type,
                amount: Math.abs(reward.amount)
            };
        }

        // Якщо немає винагороди, але є дані завдання
        if (task && task.reward_type && task.reward_amount) {
            return {
                type: normalizeRewardType(task.reward_type),
                amount: parseFloat(task.reward_amount)
            };
        }

        // За замовчуванням
        return {
            type: REWARD_TYPES.TOKENS,
            amount: 10
        };
    }

    /**
     * Нормалізація типу винагороди
     * @param {string} type - Тип винагороди
     * @returns {string} Нормалізований тип
     */
    function normalizeRewardType(type) {
        if (!type || typeof type !== 'string') {
            return REWARD_TYPES.TOKENS;
        }

        const lowerType = type.toLowerCase();

        if (lowerType.includes('token') || lowerType.includes('winix')) {
            return REWARD_TYPES.TOKENS;
        } else if (lowerType.includes('coin') || lowerType.includes('жетон')) {
            return REWARD_TYPES.COINS;
        }

        return REWARD_TYPES.TOKENS;
    }

    /**
     * Обробка винагороди
     * @param {string} taskId - ID завдання
     * @param {Object} reward - Дані винагороди
     */
    function processReward(taskId, reward) {
        // Перевіряємо, чи є модуль винагород
        if (window.TaskRewards) {
            // Делегуємо обробку винагороди до TaskRewards
            const operationId = `reward_${taskId}_${Date.now()}`;
            operationStatus.lastOperationId = operationId;

            const normalizedReward = normalizeReward(reward, findTaskById(taskId));
            window.TaskRewards.updateBalance(normalizedReward);

            // Показуємо анімацію
            window.TaskRewards.showRewardAnimation(normalizedReward);

            return;
        }

        // Якщо немає модуля винагород, обробляємо вручну
        showRewardAnimation(reward);
        updateBalance(reward);
    }

    /**
     * Імітація перевірки завдання (для тестування)
     */
    function simulateVerification(taskId) {
        // Логуємо використання мок-даних для верифікації
        if (!mockDataStatus.verification) {
            logMockDataUsage('verification', 'Використання симуляції для перевірки завдання');
        }

        // Затримка для імітації запиту
        setTimeout(() => {
            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) {
                showErrorMessage('Завдання не знайдено. Спробуйте оновити сторінку.');
                return;
            }

            // Імітуємо успіх з ймовірністю 70%
            const isSuccess = Math.random() < 0.7;

            if (isSuccess) {
                // Ініціалізуємо прогрес, якщо його ще немає
                if (!userProgress[taskId]) {
                    userProgress[taskId] = {
                        status: 'in_progress',
                        progress_value: 0,
                        start_date: new Date().toISOString()
                    };
                }

                // Оновлюємо прогрес
                userProgress[taskId].status = 'completed';
                userProgress[taskId].progress_value = task.target_value;
                userProgress[taskId].completion_date = new Date().toISOString();

                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Показуємо повідомлення про успіх
                showSuccessMessage('Завдання успішно виконано! (Демонстраційний режим)');

                // Створюємо і опрацьовуємо винагороду
                const reward = {
                    type: normalizeRewardType(task.reward_type),
                    amount: parseFloat(task.reward_amount)
                };

                processReward(taskId, reward);
            } else {
                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Імітуємо різні повідомлення про помилки для більшої реалістичності
                const errorMessages = [
                    'Умови завдання ще не виконані. Переконайтеся, що ви зробили усі необхідні дії.',
                    'Не вдалося підтвердити виконання завдання. Спробуйте ще раз.',
                    'Система не виявила виконання всіх умов. Перевірте, чи правильно виконано всі кроки.',
                    'Перевірка не підтвердила виконання завдання. Будь ласка, спробуйте пізніше.'
                ];

                const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
                showErrorMessage(`${randomMessage} (Демонстраційний режим)`);
            }
        }, 1000);
    }

    /**
     * Знайти завдання за ID
     */
    function findTaskById(taskId) {
        // Шукаємо у всіх типах завдань
        return socialTasks.find(task => task.id === taskId) ||
               limitedTasks.find(task => task.id === taskId) ||
               partnerTasks.find(task => task.id === taskId);
    }

    /**
     * Оновити відображення конкретного завдання
     */
    function refreshTaskDisplay(taskId) {
        const task = findTaskById(taskId);
        if (!task) return;

        // Знаходимо елемент завдання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Отримуємо прогрес
        const progress = userProgress[taskId];

        // Залежно від типу завдання викликаємо відповідний компонент
        if (task.type === 'social' && window.SocialTask) {
            const newTaskElement = window.SocialTask.create(task, progress);
            taskElement.parentNode.replaceChild(newTaskElement, taskElement);
        } else if (task.type === 'limited' && window.LimitedTask) {
            const newTaskElement = window.LimitedTask.create(task, progress);
            taskElement.parentNode.replaceChild(newTaskElement, taskElement);
        } else if (task.type === 'partner' && window.PartnerTask) {
            const newTaskElement = window.PartnerTask.create(task, progress);
            taskElement.parentNode.replaceChild(newTaskElement, taskElement);
        } else {
            // Якщо немає відповідного компонента, оновлюємо вручну
            taskElement.innerHTML = createBasicTaskElement(task, progress, task.type === 'limited')
                .replace('<div class="task-item"', '<div')
                .replace(/^<div class="task-item".*?>/, '')
                .replace(/<\/div>$/, '');
        }
    }

    /**
     * Показати індикатор завантаження для конкретного завдання
     */
    function showVerificationLoader(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            actionElement.classList.add('loading');

            // Створюємо індикатор завантаження, якщо його ще немає
            if (!actionElement.querySelector('.loading-indicator')) {
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
    }

    /**
     * Приховати індикатор завантаження для конкретного завдання
     */
    function hideVerificationLoader(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
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
     * Показати анімацію отримання винагороди
     */
    function showRewardAnimation(reward) {
        // Нормалізуємо винагороду
        const normalizedReward = typeof reward === 'object' ? reward : { type: REWARD_TYPES.TOKENS, amount: 10 };

        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(normalizedReward);
            return;
        }

        // Якщо є модуль винагород, використовуємо його
        if (window.TaskRewards && window.TaskRewards.showRewardAnimation) {
            window.TaskRewards.showRewardAnimation(normalizedReward);
            return;
        }

        // Проста анімація, якщо модуль анімацій не доступний
        const rewardType = normalizedReward.type === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів';
        showSuccessMessage(`Ви отримали ${normalizedReward.amount} ${rewardType}!`);

        // Оновлюємо відображення балансу
        updateBalance(normalizedReward);
    }

    /**
     * Оновити відображення балансу
     */
    function updateBalance(reward) {
        // Нормалізуємо винагороду
        const normalizedReward = typeof reward === 'object' ? reward : { type: REWARD_TYPES.TOKENS, amount: 10 };

        // Якщо є модуль винагород, використовуємо його
        if (window.TaskRewards && window.TaskRewards.updateBalance) {
            window.TaskRewards.updateBalance(normalizedReward);
            return;
        }

        // Інакше оновлюємо вручну
        if (normalizedReward.type === REWARD_TYPES.TOKENS) {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                const newBalance = currentBalance + normalizedReward.amount;
                userTokensElement.textContent = newBalance.toFixed(2);
                userTokensElement.classList.add('highlight');
                setTimeout(() => {
                    userTokensElement.classList.remove('highlight');
                }, 2000);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userTokens', newBalance.toString());
                    localStorage.setItem('winix_balance', newBalance.toString());
                } catch (e) {
                    console.warn('TaskManager: Помилка збереження балансу токенів в localStorage:', e.message);
                }

                // Відправляємо подію оновлення балансу
                document.dispatchEvent(new CustomEvent('balance-updated', {
                    detail: {
                        oldBalance: currentBalance,
                        newBalance: newBalance,
                        type: REWARD_TYPES.TOKENS,
                        source: 'task_manager'
                    }
                }));
            }
        } else if (normalizedReward.type === REWARD_TYPES.COINS) {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                const newBalance = currentBalance + normalizedReward.amount;
                userCoinsElement.textContent = newBalance.toString();
                userCoinsElement.classList.add('highlight');
                setTimeout(() => {
                    userCoinsElement.classList.remove('highlight');
                }, 2000);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userCoins', newBalance.toString());
                    localStorage.setItem('winix_coins', newBalance.toString());
                } catch (e) {
                    console.warn('TaskManager: Помилка збереження балансу жетонів в localStorage:', e.message);
                }

                // Відправляємо подію оновлення балансу
                document.dispatchEvent(new CustomEvent('balance-updated', {
                    detail: {
                        oldBalance: currentBalance,
                        newBalance: newBalance,
                        type: REWARD_TYPES.COINS,
                        source: 'task_manager'
                    }
                }));
            }
        }
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        // Якщо є модуль сповіщень, використовуємо його
        if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
            window.UI.Notifications.showSuccess(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            toastElement.textContent = message;
            toastElement.className = 'toast-message success';
            toastElement.classList.add('show');

            // Автоматично приховуємо повідомлення через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            alert(message);
        }
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        // Якщо є модуль сповіщень, використовуємо його
        if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
            window.UI.Notifications.showError(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            toastElement.textContent = message;
            toastElement.className = 'toast-message error';
            toastElement.classList.add('show');

            // Автоматично приховуємо повідомлення через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            alert(message);
        }
    }

    /**
     * Функція для безпечного виведення HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Скидання стану модуля
     */
    function resetState() {
        operationStatus.tasksLoading = false;
        operationStatus.verificationInProgress = {};
        operationStatus.lastVerificationTime = {};
        operationStatus.lastOperationId = null;

        // Скидаємо стан використання мок-даних
        Object.keys(mockDataStatus).forEach(key => {
            mockDataStatus[key] = false;
        });

        console.log('TaskManager: Стан модуля скинуто');
    }

    // Публічний API модуля
    return {
        init,
        loadTasks,
        startTask,
        verifyTask,
        findTaskById,
        refreshTaskDisplay,
        showSuccessMessage,
        showErrorMessage,
        showRewardAnimation,
        normalizeReward,
        resetState,
        REWARD_TYPES,
        // Додаємо методи для перевірки використання мок-даних
        isUsingMockData: (type) => mockDataStatus[type] || false,
        isApiAvailable
    };
})();