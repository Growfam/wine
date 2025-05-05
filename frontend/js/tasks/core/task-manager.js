/**
 * TaskManager - Модуль для управління завданнями
 * Виправлена версія з кращою діагностикою
 * @version 1.1.1
 */

window.TaskManager = (function() {
    // Приватні змінні модуля
    let socialTasks = [];
    let limitedTasks = [];
    let partnerTasks = [];
    let referralTasks = [];
    let userProgress = {};
    let initialized = false;

    // Типи винагород
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Контроль операцій
    const operationStatus = {
        tasksLoading: false,
        verificationInProgress: {},
        lastVerificationTime: {},
        lastOperationId: null,
        domReady: false
    };

    // DOM-елементи
    const domElements = {
        socialTasksContainer: null,
        limitedTasksContainer: null,
        partnersTasksContainer: null,
        referralTasksContainer: null,
        tabButtons: null,
        contentSections: null
    };

    // Конфігурація обробки помилок
    const errorHandlingConfig = {
        maxRetries: 3,
        retryInterval: 1500,
        showTechnicalDetails: true
    };

    /**
     * Безпечна перевірка includes з обробкою undefined
     * @param {string|undefined} str - Рядок для перевірки
     * @param {string} substring - Підрядок для пошуку
     * @returns {boolean} Результат
     */
    function safeIncludes(str, substring) {
        if (!str || typeof str !== 'string') return false;
        return str.includes(substring);
    }

    /**
     * Безпечне отримання ID користувача з обробкою помилок
     * @returns {string|null} ID користувача або null
     */
    function safeGetUserId() {
        try {
            // Спробуємо отримати ID користувача через звичайну функцію getUserId
            if (typeof window.getUserId === 'function') {
                const userId = window.getUserId();
                if (userId) {
                    return userId;
                }
            }

            // Спробуємо знайти ID в localStorage
            try {
                const storedId = localStorage.getItem('telegram_user_id');
                if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                    return storedId;
                }
            } catch (e) {
                // Ігноруємо помилки localStorage
            }

            // Спробуємо отримати з DOM
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const userId = userIdElement.textContent.trim();
                    if (userId) {
                        return userId;
                    }
                }
            } catch (e) {
                // Ігноруємо помилки DOM
            }

            // Спробуємо отримати з URL-параметрів
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (id) {
                    return id;
                }
            } catch (e) {
                // Ігноруємо помилки URL
            }

            console.warn('TaskManager: ID користувача не знайдено');
            return null;
        } catch (error) {
            console.error('TaskManager: Помилка отримання ID:', error);
            return null;
        }
    }

    /**
     * Діагностика системи
     */
    function diagnoseSystemState() {
        console.group('TaskManager: Діагностика системи');
        console.log('DOM готовий:', document.readyState);
        console.log('API доступний:', !!window.API);
        console.log('API_PATHS доступний:', !!window.API_PATHS);

        if (window.API_PATHS && window.API_PATHS.TASKS) {
            console.log('API_PATHS.TASKS.SOCIAL:', window.API_PATHS.TASKS.SOCIAL);
            console.log('API_PATHS.TASKS.LIMITED:', window.API_PATHS.TASKS.LIMITED);
            console.log('API_PATHS.TASKS.PARTNER:', window.API_PATHS.TASKS.PARTNER);
            console.log('API_PATHS.TASKS.REFERRAL:', window.API_PATHS.TASKS.REFERRAL);
        }

        console.log('TaskProgressManager доступний:', !!window.TaskProgressManager);
        console.log('SocialTask доступний:', !!window.SocialTask);
        console.log('Стан initialized:', initialized);
        console.groupEnd();
    }

    /**
     * Ініціалізація TaskManager
     */
    function init() {
        console.log('TaskManager: Початок ініціалізації...');

        // Перевіряємо стан системи перед ініціалізацією
        diagnoseSystemState();

        // Запобігаємо повторній ініціалізації
        if (initialized) {
            console.log('TaskManager: Вже ініціалізовано');
            return;
        }

        // Перевіряємо готовність DOM
        if (document.readyState === 'loading') {
            console.log('TaskManager: DOM не готовий, чекаємо завершення завантаження...');
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Перевіряємо доступність API
        if (!isApiAvailable()) {
            console.error('TaskManager: API недоступне! Спробуємо повторити ініціалізацію пізніше.');

            // Спробуємо ініціалізувати повторно через деякий час
            setTimeout(init, 1000);
            return;
        }

        // Перевіряємо наявність API_PATHS і додаємо запасні варіанти за потреби
        if (!window.API_PATHS || !window.API_PATHS.TASKS) {
            console.error('TaskManager: API_PATHS.TASKS недоступне!');

            // Створюємо базові шляхи, якщо їх немає
            if (!window.API_PATHS) {
                window.API_PATHS = {};
            }

            if (!window.API_PATHS.TASKS) {
                window.API_PATHS.TASKS = {
                    SOCIAL: 'quests/tasks/social',
                    LIMITED: 'quests/tasks/limited',
                    PARTNER: 'quests/tasks/partner'
                };
            }
        }

        // Додаємо шлях для реферальних завдань, якщо його немає
        if (!window.API_PATHS.TASKS.REFERRAL) {
            console.log('TaskManager: Шлях REFERRAL не знайдено, буде використано SOCIAL');
            window.API_PATHS.TASKS.REFERRAL = window.API_PATHS.TASKS.SOCIAL;
        }

        // Перевіряємо, чи існує TaskProgressManager
        if (window.TaskProgressManager && typeof window.TaskProgressManager.getTaskProgress === 'function') {
            console.log('TaskManager: TaskProgressManager знайдено, синхронізуємо інтерфейси...');

            // Створюємо посилання на getTaskProgress, якщо це функція
            if (!window.TaskManager.getTaskProgress) {
                window.TaskManager.getTaskProgress = window.TaskProgressManager.getTaskProgress;
            }
        }

        console.log('TaskManager: Знаходимо DOM елементи...');
        // Знаходимо необхідні DOM-елементи
        findDomElements();

        // Налаштування перемикачів вкладок
        setupTabSwitching();

        // Завантаження завдань
        loadTasks();

        // Встановлюємо флаг ініціалізації
        initialized = true;
        console.log('TaskManager: Ініціалізацію завершено');

        // Інформуємо інші модулі про завершення ініціалізації
        document.dispatchEvent(new CustomEvent('taskmanager-initialized'));
    }

// Видалення кнопок "Запросити друзів"
function removeInviteButtons() {
    // Шукаємо всі елементи, які можуть бути кнопками запрошення
    const buttonSelectors = [
        'button:contains("Запросити друзів")',
        '.action-button[data-action="invite"]',
        '.invite-friends-button',
        '.referral-button',
        'a.invite-button',
        '[data-lang-key="earn.invite_friends"]'
    ];

    // Набір селекторів для jQuery або querySelector
    for (const selector of buttonSelectors) {
        try {
            // jQuery варіант, якщо доступний
            if (window.jQuery) {
                jQuery(selector).hide();
            }
            // Нативний JavaScript варіант
            else {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.display = 'none';
                });
            }
        } catch (e) {
            console.warn('Помилка при спробі приховати кнопки:', e);
        }
    }

    // Шукаємо прямі елементи за текстом
    document.querySelectorAll('button, a').forEach(el => {
        if (el.textContent.includes('Запросити друзів') ||
            el.textContent.includes('запросити друзів')) {
            el.style.display = 'none';
        }
    });

    console.log('Кнопки запрошення друзів приховано');
}

// Відстеження DOM для видалення кнопок при динамічному рендерингу
function setupButtonObserver() {
    // Перевіряємо підтримку MutationObserver
    if (!window.MutationObserver) return;

    const observer = new MutationObserver((mutations) => {
        let shouldRemove = false;

        // Перевіряємо, чи додано кнопки "Запросити друзів"
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                shouldRemove = true;
            }
        });

        // Якщо додано нові елементи, перевіряємо і видаляємо кнопки
        if (shouldRemove) {
            removeInviteButtons();
        }
    });

    // Спостерігаємо за всім документом
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Спостерігач за кнопками запрошення налаштовано');
}

// Викликаємо функцію видалення кнопок
removeInviteButtons();

// Налаштовуємо спостереження за DOM для динамічно доданих кнопок
setupButtonObserver();

// Обробка прогрес-барів для автоматичного виконання завдань
function setupProgressTracking() {
    // Перевіряємо прогрес-бари кожні 2 секунди
    setInterval(() => {
        // Шукаємо всі прогрес-бари в реферальних завданнях
        const progressBars = document.querySelectorAll('.task-item[data-task-type="referral"] .progress-fill');

        progressBars.forEach(bar => {
            // Отримуємо поточний прогрес
            const width = parseInt(bar.style.width) || 0;

            // Якщо прогрес 100% або більше, позначаємо завдання як виконане
            if (width >= 100) {
                // Додаємо клас для анімації
                bar.classList.add('complete');

                // Знаходимо батьківський елемент завдання
                const taskItem = bar.closest('.task-item');
                if (taskItem && !taskItem.classList.contains('completed')) {
                    // Позначаємо як виконане
                    taskItem.classList.add('completed');

                    // Знаходимо кнопку дії та замінюємо її
                    const actionDiv = taskItem.querySelector('.task-action');
                    if (actionDiv) {
                        actionDiv.innerHTML = '<div class="completed-label">Виконано</div>';
                    }

                    // Викликаємо подію виконання завдання
                    const taskId = taskItem.getAttribute('data-task-id');
                    if (taskId) {
                        document.dispatchEvent(new CustomEvent('task-completed', {
                            detail: { taskId, automatic: true }
                        }));
                    }
                }
            }
        });
    }, 2000);

    console.log('Відстеження прогресу завдань налаштовано');
}

// Запускаємо відстеження прогресу
setupProgressTracking();

    /**
     * Знаходження DOM-елементів
     */
    function findDomElements() {
        // Перевіряємо готовність DOM
        if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
            console.log('TaskManager: DOM ще не готовий, очікування...');
            setTimeout(findDomElements, 100);
            return;
        }

        domElements.socialTasksContainer = document.getElementById('social-tasks-container');
        domElements.limitedTasksContainer = document.getElementById('limited-tasks-container');
        domElements.partnersTasksContainer = document.getElementById('partners-tasks-container');
        domElements.referralTasksContainer = document.getElementById('referral-tasks-container');
        domElements.tabButtons = document.querySelectorAll('.tab');
        domElements.contentSections = document.querySelectorAll('.content-section');

        // Діагностичне повідомлення з результатами пошуку
        console.log('TaskManager: DOM-елементи знайдено:');
        console.log('socialTasksContainer =', domElements.socialTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('limitedTasksContainer =', domElements.limitedTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('partnersTasksContainer =', domElements.partnersTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('referralTasksContainer =', domElements.referralTasksContainer ? 'знайдено' : 'не знайдено');

        // Визначаємо статус готовності DOM
        operationStatus.domReady = domElements.socialTasksContainer !== null;
    }

    /**
     * Налаштування перемикачів вкладок
     */
    function setupTabSwitching() {
        if (!domElements.tabButtons || domElements.tabButtons.length === 0) {
            console.warn('TaskManager: Кнопки вкладок не знайдено');
            return;
        }

        domElements.tabButtons.forEach(button => {
            // Перевіряємо, чи кнопка вже ініціалізована
            if (button.getAttribute('data-initialized') === 'true') {
                return;
            }

            // Позначаємо кнопку як ініціалізовану
            button.setAttribute('data-initialized', 'true');

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
     * Перевірка доступності API
     */
    function isApiAvailable() {
        const apiAvailable = window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function';
        const apiPathsAvailable = window.API_PATHS && window.API_PATHS.TASKS;

        if (!apiAvailable) {
            console.error('TaskManager: API не доступне (window.API відсутній або не має методів get/post)');
        }

        if (!apiPathsAvailable) {
            console.error('TaskManager: API_PATHS.TASKS не доступне');
        }

        return apiAvailable && apiPathsAvailable;
    }

    /**
     * Завантаження завдань
     */
    async function loadTasks() {
        console.log('TaskManager: Починаємо завантаження завдань...');

        try {
            // Запобігаємо одночасним запитам
            if (operationStatus.tasksLoading) {
                console.log('TaskManager: Завантаження вже виконується, пропускаємо');
                return;
            }

            // Перевіряємо готовність DOM
            if (!operationStatus.domReady) {
                console.log('TaskManager: DOM не готовий, повторна спроба через 100мс');
                setTimeout(loadTasks, 100);
                return;
            }

            operationStatus.tasksLoading = true;

            // Перевіряємо доступність API
            if (!isApiAvailable()) {
                throw new Error('API_NOT_AVAILABLE');
            }

            // Показуємо індикатор завантаження в контейнерах
            if (domElements.socialTasksContainer) {
                domElements.socialTasksContainer.innerHTML = '<div class="task-loader">Завантаження завдань...</div>';
            }
            if (domElements.limitedTasksContainer) {
                domElements.limitedTasksContainer.innerHTML = '<div class="task-loader">Завантаження завдань...</div>';
            }
            if (domElements.partnersTasksContainer) {
                domElements.partnersTasksContainer.innerHTML = '<div class="task-loader">Завантаження завдань...</div>';
            }
            if (domElements.referralTasksContainer) {
                domElements.referralTasksContainer.innerHTML = '<div class="task-loader">Завантаження завдань...</div>';
            }

            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.warn('TaskManager: ID користувача не знайдено, завантаження може бути обмежене');
                // Продовжуємо виконання, оскільки деякі API можуть не вимагати ID
            }

            // Перевіряємо необхідні API шляхи
            if (!window.API_PATHS.TASKS.SOCIAL) {
                console.error('TaskManager: API_PATHS.TASKS.SOCIAL не знайдено!');
                throw new Error('API_PATH_SOCIAL_NOT_FOUND');
            }

            // Перевіряємо і встановлюємо шлях для реферальних завдань
            if (!window.API_PATHS.TASKS.REFERRAL) {
                console.log('TaskManager: API_PATHS.TASKS.REFERRAL не знайдено, використовуємо SOCIAL');
                window.API_PATHS.TASKS.REFERRAL = window.API_PATHS.TASKS.SOCIAL;
            }

            // Логуємо URL-шляхи які використовуються
            console.log('TaskManager: URL для соціальних завдань =', window.API_PATHS.TASKS.SOCIAL);
            console.log('TaskManager: URL для лімітованих завдань =', window.API_PATHS.TASKS.LIMITED);
            console.log('TaskManager: URL для партнерських завдань =', window.API_PATHS.TASKS.PARTNER);
            console.log('TaskManager: URL для реферальних завдань =', window.API_PATHS.TASKS.REFERRAL);

            try {
                // Спробуємо завантажити соціальні завдання
                console.log('TaskManager: Запит соціальних завдань...');
                const socialResponse = await window.API.get(window.API_PATHS.TASKS.SOCIAL);

                let socialTasksData = extractTasksFromResponse(socialResponse);

                if (socialTasksData.length > 0) {
                    // Розділяємо соціальні й реферальні завдання
                    const { regular, referral } = splitSocialTasks(socialTasksData);
                    socialTasks = regular;
                    referralTasks = referral;

                    renderSocialTasks();
                    renderReferralTasks();
                } else {
                    if (domElements.socialTasksContainer) {
                        domElements.socialTasksContainer.innerHTML =
                            '<div class="no-tasks">Завдання не знайдені. Спробуйте пізніше.</div>';
                    }
                    if (domElements.referralTasksContainer) {
                        domElements.referralTasksContainer.innerHTML =
                            '<div class="no-tasks">Реферальні завдання не знайдені.</div>';
                    }
                }

                // Завантажуємо лімітовані завдання
                console.log('TaskManager: Запит лімітованих завдань...');
                const limitedResponse = await window.API.get(window.API_PATHS.TASKS.LIMITED);
                let limitedTasksData = extractTasksFromResponse(limitedResponse);

                if (limitedTasksData.length > 0) {
                    limitedTasks = normalizeTasksData(limitedTasksData);
                    renderLimitedTasks();
                } else if (domElements.limitedTasksContainer) {
                    domElements.limitedTasksContainer.innerHTML =
                        '<div class="no-tasks">Лімітовані завдання не знайдені.</div>';
                }

                // Завантажуємо партнерські завдання
                console.log('TaskManager: Запит партнерських завдань...');
                const partnerResponse = await window.API.get(window.API_PATHS.TASKS.PARTNER);
                let partnerTasksData = extractTasksFromResponse(partnerResponse);

                if (partnerTasksData.length > 0) {
                    partnerTasks = normalizeTasksData(partnerTasksData);
                    renderPartnerTasks();
                } else if (domElements.partnersTasksContainer) {
                    domElements.partnersTasksContainer.innerHTML =
                        '<div class="no-tasks">Партнерські завдання не знайдені.</div>';
                }

                // Завантажуємо прогрес користувача, якщо є ID
                if (userId) {
                    try {
                        console.log('TaskManager: Запит прогресу користувача...');
                        const progressResponse = await window.API.get('quests/user-progress');

                        if (progressResponse.status === 'success' && progressResponse.data) {
                            userProgress = progressResponse.data;
                            console.log('TaskManager: Прогрес користувача отримано');

                            // Оновлюємо відображення з урахуванням прогресу
                            refreshAllTasks();
                        }
                    } catch (progressError) {
                        console.warn('TaskManager: Помилка отримання прогресу користувача:', progressError);
                    }
                }

            } catch (error) {
                console.error('TaskManager: Помилка при виконанні запиту:', error);

                // Показуємо повідомлення про помилку в контейнерах
                const errorHtml = `<div class="error-message">Помилка завантаження завдань: ${error.message}</div>`;
                if (domElements.socialTasksContainer) {
                    domElements.socialTasksContainer.innerHTML = errorHtml;
                }

                // Генеруємо подію про помилку
                document.dispatchEvent(new CustomEvent('tasks-loading-error', {
                    detail: { error: error }
                }));
            }

        } catch (error) {
            console.error('TaskManager: Загальна помилка завантаження завдань:', error);

            // Показуємо загальне повідомлення про помилку
            showErrorMessage('Не вдалося завантажити завдання: ' + error.message);

            // Генеруємо подію про помилку
            document.dispatchEvent(new CustomEvent('tasks-loading-error', {
                detail: { error: error }
            }));
        } finally {
            operationStatus.tasksLoading = false;
            console.log('TaskManager: Завершено спробу завантаження завдань');

            // Генеруємо подію про завершення завантаження
            document.dispatchEvent(new CustomEvent('tasks-loading-completed'));
        }
    }

    /**
     * Допоміжна функція для витягування завдань з відповіді
     */
    function extractTasksFromResponse(response) {
        let tasksData = [];

        if (response.status === 'success' && response.data && response.data.tasks) {
            tasksData = response.data.tasks;
        } else if (response.status === 'success' && response.data && Array.isArray(response.data)) {
            tasksData = response.data;
        } else if (response.success && response.data) {
            tasksData = Array.isArray(response.data) ? response.data :
                (response.data.tasks || []);
        } else if (Array.isArray(response)) {
            tasksData = response;
        } else if (response.tasks && Array.isArray(response.tasks)) {
            tasksData = response.tasks;
        }

        return tasksData;
    }

    /**
     * Розділення соціальних завдань на звичайні та реферальні
     */
    function splitSocialTasks(tasks) {
        const regular = [];
        const referral = [];

        tasks.forEach(task => {
            if (task.tags && Array.isArray(task.tags) && task.tags.includes('referral')) {
                referral.push(task);
            } else if (task.type === 'referral' || (task.title && task.title.toLowerCase().includes('referral'))) {
                referral.push(task);
            } else {
                regular.push(task);
            }
        });

        console.log('TaskManager: Розділення завдань - звичайні:', regular.length, 'реферальні:', referral.length);
        return { regular, referral };
    }

    /**
     * Нормалізація даних завдань
     */
    function normalizeTasksData(tasks) {
        console.log('TaskManager: Нормалізація даних завдань, отримано:', tasks.length, 'завдань');

        if (!Array.isArray(tasks)) {
            console.warn('TaskManager: tasks не є масивом, тип:', typeof tasks);
            return [];
        }

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
                if (safeIncludes(lowerType, 'token') || safeIncludes(lowerType, 'winix')) {
                    normalizedTask.reward_type = REWARD_TYPES.TOKENS;
                } else if (safeIncludes(lowerType, 'coin') || safeIncludes(lowerType, 'жетон')) {
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
     * Відображення соціальних завдань
     */
    function renderSocialTasks() {
        console.log('TaskManager: Відображення соціальних завдань, кількість:', socialTasks.length);

        if (!domElements.socialTasksContainer) {
            console.warn('TaskManager: Контейнер для соціальних завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.socialTasksContainer.innerHTML = '';

        if (socialTasks.length === 0) {
            domElements.socialTasksContainer.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        socialTasks.forEach(task => {
            if (window.SocialTask && typeof window.SocialTask.create === 'function') {
                try {
                    const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                    domElements.socialTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента соціального завдання:', error);
                    // Запасний варіант
                    domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
                }
            } else {
                console.warn('TaskManager: SocialTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант
                domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення реферальних завдань
     */
    function renderReferralTasks() {
        console.log('TaskManager: Відображення реферальних завдань, кількість:', referralTasks.length);

        if (!domElements.referralTasksContainer) {
            console.warn('TaskManager: Контейнер для реферальних завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.referralTasksContainer.innerHTML = '';

        if (referralTasks.length === 0) {
            domElements.referralTasksContainer.innerHTML = '<div class="no-tasks">Немає доступних реферальних завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        referralTasks.forEach(task => {
            if (window.SocialTask && typeof window.SocialTask.create === 'function') {
                try {
                    const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                    domElements.referralTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента реферального завдання:', error);
                    // Запасний варіант
                    domElements.referralTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
                }
            } else {
                console.warn('TaskManager: SocialTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант
                domElements.referralTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення лімітованих завдань
     */
    function renderLimitedTasks() {
        console.log('TaskManager: Відображення лімітованих завдань, кількість:', limitedTasks.length);

        if (!domElements.limitedTasksContainer) {
            console.warn('TaskManager: Контейнер для лімітованих завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.limitedTasksContainer.innerHTML = '';

        if (limitedTasks.length === 0) {
            domElements.limitedTasksContainer.innerHTML = '<div class="no-tasks">Немає доступних лімітованих завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        limitedTasks.forEach(task => {
            if (window.LimitedTask && typeof window.LimitedTask.create === 'function') {
                try {
                    const taskElement = window.LimitedTask.create(task, userProgress[task.id]);
                    domElements.limitedTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента лімітованого завдання:', error);
                    // Запасний варіант
                    domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
                }
            } else {
                console.warn('TaskManager: LimitedTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант
                domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
            }
        });
    }

    /**
     * Відображення партнерських завдань
     */
    function renderPartnerTasks() {
        console.log('TaskManager: Відображення партнерських завдань, кількість:', partnerTasks.length);

        if (!domElements.partnersTasksContainer) {
            console.warn('TaskManager: Контейнер для партнерських завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.partnersTasksContainer.innerHTML = '';

        if (partnerTasks.length === 0) {
            domElements.partnersTasksContainer.innerHTML = '<div class="no-tasks">Немає доступних партнерських завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        partnerTasks.forEach(task => {
            if (window.PartnerTask && typeof window.PartnerTask.create === 'function') {
                try {
                    const taskElement = window.PartnerTask.create(task, userProgress[task.id]);
                    domElements.partnersTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента партнерського завдання:', error);
                    // Запасний варіант
                    domElements.partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
                }
            } else {
                console.warn('TaskManager: PartnerTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант
                domElements.partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Оновлення всіх завдань
     */
    function refreshAllTasks() {
        console.log('TaskManager: Оновлення всіх завдань');
        renderSocialTasks();
        renderReferralTasks();
        renderLimitedTasks();
        renderPartnerTasks();
    }

    /**
     * Оновлення відображення конкретного завдання
     * @param {string} taskId - ID завдання
     */
    function refreshTaskDisplay(taskId) {
        console.log('TaskManager: Оновлення відображення завдання:', taskId);

        // Перебираємо всі типи завдань
        [socialTasks, referralTasks, limitedTasks, partnerTasks].forEach((taskArray, index) => {
            const task = taskArray.find(t => t.id === taskId);
            if (task) {
                // Визначаємо, до якого контейнера відноситься завдання
                let container;
                switch (index) {
                    case 0: container = domElements.socialTasksContainer; break;
                    case 1: container = domElements.referralTasksContainer; break;
                    case 2: container = domElements.limitedTasksContainer; break;
                    case 3: container = domElements.partnersTasksContainer; break;
                }

                if (container) {
                    // Знаходимо елемент завдання
                    const taskElement = container.querySelector(`[data-task-id="${taskId}"]`);
                    if (taskElement) {
                        // Визначаємо тип завдання і використовуємо відповідний компонент
                        try {
                            let newTaskElement;

                            switch (index) {
                                case 0:
                                case 1:
                                    if (window.SocialTask && typeof window.SocialTask.create === 'function') {
                                        newTaskElement = window.SocialTask.create(task, userProgress[task.id]);
                                    }
                                    break;
                                case 2:
                                    if (window.LimitedTask && typeof window.LimitedTask.create === 'function') {
                                        newTaskElement = window.LimitedTask.create(task, userProgress[task.id]);
                                    }
                                    break;
                                case 3:
                                    if (window.PartnerTask && typeof window.PartnerTask.create === 'function') {
                                        newTaskElement = window.PartnerTask.create(task, userProgress[task.id]);
                                    }
                                    break;
                            }

                            // Якщо вдалося створити новий елемент, замінюємо старий
                            if (newTaskElement) {
                                taskElement.replaceWith(newTaskElement);
                            } else {
                                // Запасний варіант - оновлюємо через innerHTML
                                const isLimited = index === 2; // Це лімітоване завдання
                                taskElement.outerHTML = createBasicTaskElement(task, userProgress[task.id], isLimited);
                            }
                        } catch (error) {
                            console.error('TaskManager: Помилка оновлення елемента завдання:', error);
                            // Запасний варіант - оновлюємо через innerHTML
                            const isLimited = index === 2; // Це лімітоване завдання
                            taskElement.outerHTML = createBasicTaskElement(task, userProgress[task.id], isLimited);
                        }
                    }
                }
            }
        });
    }

    /**
     * Запуск завдання
     * @param {string} taskId - ID завдання
     */
    async function startTask(taskId) {
        console.log('TaskManager: Запуск завдання:', taskId);

        try {
            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.error('TaskManager: ID користувача не знайдено, неможливо запустити завдання');
                showErrorMessage('Для виконання завдання необхідно авторизуватися');
                return;
            }

            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) {
                console.error('TaskManager: Завдання не знайдено:', taskId);
                showErrorMessage('Завдання не знайдено');
                return;
            }

            // Виконуємо запит до API
            const response = await window.API.post(`quests/tasks/${taskId}/start`);

            if (response.status === 'success' || response.success) {
                console.log('TaskManager: Завдання успішно запущено:', taskId);

                // Оновлюємо прогрес
                if (response.data && response.data.progress) {
                    userProgress[taskId] = response.data.progress;
                } else {
                    // Встановлюємо базовий прогрес, якщо він не повернувся з сервера
                    userProgress[taskId] = userProgress[taskId] || {
                        status: 'started',
                        progress_value: 0,
                        task_id: taskId
                    };
                }

                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Якщо є URL дії, відкриваємо його
                if (task.action_url) {
                    // Пробуємо використати SocialTask для безпечної валідації URL
                    if (window.SocialTask && typeof window.SocialTask.validateUrl === 'function') {
                        const safeUrl = window.SocialTask.validateUrl(task.action_url);
                        if (safeUrl) {
                            window.open(safeUrl, '_blank', 'noopener,noreferrer');
                        } else {
                            showErrorMessage('Неможливо відкрити це посилання через проблеми безпеки');
                        }
                    } else {
                        // Запасний варіант - просто відкриваємо URL
                        window.open(task.action_url, '_blank', 'noopener,noreferrer');
                    }
                }

                return true;
            } else {
                console.error('TaskManager: Помилка запуску завдання:', response.message || 'Невідома помилка');
                showErrorMessage(response.message || 'Помилка запуску завдання');
                return false;
            }
        } catch (error) {
            console.error('TaskManager: Помилка запуску завдання:', error);
            showErrorMessage('Не вдалося запустити завдання: ' + error.message);
            return false;
        }
    }

    /**
     * Перевірка виконання завдання
     * @param {string} taskId - ID завдання
     */
    async function verifyTask(taskId) {
        console.log('TaskManager: Перевірка виконання завдання:', taskId);

        try {
            // Запобігаємо повторним запитам для одного завдання
            if (operationStatus.verificationInProgress[taskId]) {
                console.log('TaskManager: Перевірка вже виконується для завдання', taskId);
                return;
            }

            operationStatus.verificationInProgress[taskId] = true;

            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.error('TaskManager: ID користувача не знайдено, неможливо перевірити завдання');
                showErrorMessage('Для перевірки завдання необхідно авторизуватися');
                operationStatus.verificationInProgress[taskId] = false;
                return;
            }

            // Виконуємо запит до API
            const response = await window.API.post(`quests/tasks/${taskId}/verify`);

            if (response.status === 'success' || response.success) {
                console.log('TaskManager: Завдання успішно перевірено:', taskId);

                // Оновлюємо прогрес
                if (response.data && response.data.progress) {
                    userProgress[taskId] = response.data.progress;
                } else if (response.progress) {
                    userProgress[taskId] = response.progress;
                } else {
                    // Встановлюємо прогрес як завершений
                    userProgress[taskId] = userProgress[taskId] || {};
                    userProgress[taskId].status = 'completed';
                    userProgress[taskId].progress_value = userProgress[taskId].target_value || 1;
                }

                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Показуємо повідомлення про успіх
                showSuccessMessage(response.message || 'Завдання успішно виконано!');

                // Якщо є винагорода, оновлюємо баланс
                if (response.data && response.data.reward) {
                    updateBalance(response.data.reward);
                } else if (response.reward) {
                    updateBalance(response.reward);
                }

                // Запам'ятовуємо час останньої перевірки
                operationStatus.lastVerificationTime[taskId] = Date.now();

                operationStatus.verificationInProgress[taskId] = false;
                return true;
            } else {
                console.error('TaskManager: Помилка перевірки завдання:', response.message || 'Невідома помилка');
                showErrorMessage(response.message || 'Помилка перевірки завдання');
                operationStatus.verificationInProgress[taskId] = false;
                return false;
            }
        } catch (error) {
            console.error('TaskManager: Помилка перевірки завдання:', error);
            showErrorMessage('Не вдалося перевірити завдання: ' + error.message);
            operationStatus.verificationInProgress[taskId] = false;
            return false;
        }
    }

    /**
     * Оновлення балансу користувача
     * @param {Object} reward - Інформація про винагороду
     */
    function updateBalance(reward) {
        // Спочатку пробуємо використати TaskRewards
        if (window.TaskRewards && typeof window.TaskRewards.updateBalance === 'function') {
            window.TaskRewards.updateBalance(reward);
            return;
        }

        // Пробуємо використати Core
        if (window.WinixCore && typeof window.WinixCore.updateLocalBalance === 'function') {
            if (reward.type === REWARD_TYPES.COINS) {
                // Оновлюємо жетони
                const amount = parseFloat(reward.amount) || 0;
                window.WinixCore.updateLocalBalance(amount, 'task_reward', true);
            } else {
                // Для токенів наразі немає окремої функції
                console.log('TaskManager: Отримано винагороду в токенах:', reward.amount);
            }
            return;
        }

        // Запасний варіант - оновлюємо через DOM
        try {
            if (reward.type === REWARD_TYPES.TOKENS) {
                const tokensElement = document.getElementById('user-tokens');
                if (tokensElement) {
                    const currentBalance = parseFloat(tokensElement.textContent) || 0;
                    const newBalance = currentBalance + parseFloat(reward.amount);
                    tokensElement.textContent = newBalance.toFixed(2);
                    tokensElement.classList.add('highlight');

                    // Через 2 секунди знімаємо виділення
                    setTimeout(() => {
                        tokensElement.classList.remove('highlight');
                    }, 2000);

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('userTokens', newBalance.toString());
                    } catch (e) {
                        console.warn('TaskManager: Помилка збереження балансу в localStorage:', e);
                    }
                }
            } else if (reward.type === REWARD_TYPES.COINS) {
                const coinsElement = document.getElementById('user-coins');
                if (coinsElement) {
                    const currentBalance = parseInt(coinsElement.textContent) || 0;
                    const newBalance = currentBalance + parseInt(reward.amount);
                    coinsElement.textContent = newBalance.toString();
                    coinsElement.classList.add('highlight');

                    // Через 2 секунди знімаємо виділення
                    setTimeout(() => {
                        coinsElement.classList.remove('highlight');
                    }, 2000);

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('userCoins', newBalance.toString());
                    } catch (e) {
                        console.warn('TaskManager: Помилка збереження балансу в localStorage:', e);
                    }
                }
            }
        } catch (e) {
            console.error('TaskManager: Помилка оновлення балансу:', e);
        }
    }

    /**
     * Пошук завдання за ID
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Знайдене завдання або null
     */
    function findTaskById(taskId) {
        // Перебираємо всі масиви завдань
        return socialTasks.find(t => t.id === taskId) ||
               referralTasks.find(t => t.id === taskId) ||
               limitedTasks.find(t => t.id === taskId) ||
               partnerTasks.find(t => t.id === taskId) ||
               null;
    }

    /**
     * Оновлення прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     */
    function updateTaskProgress(taskId, progressData) {
        console.log('TaskManager: Оновлення прогресу завдання:', taskId, progressData);

        // Перевіряємо наявність TaskProgressManager
        if (window.TaskProgressManager && typeof window.TaskProgressManager.updateTaskProgress === 'function') {
            // Делегуємо оновлення до TaskProgressManager
            return window.TaskProgressManager.updateTaskProgress(taskId, progressData);
        }

        // Запасний варіант - оновлюємо локально
        userProgress[taskId] = { ...userProgress[taskId], ...progressData };

        // Оновлюємо відображення
        refreshTaskDisplay(taskId);

        return true;
    }

    /**
     * Отримання прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Прогрес завдання або null
     */
    function getTaskProgress(taskId) {
        // Перевіряємо наявність TaskProgressManager
        if (window.TaskProgressManager && typeof window.TaskProgressManager.getTaskProgress === 'function') {
            // Делегуємо отримання до TaskProgressManager
            return window.TaskProgressManager.getTaskProgress(taskId);
        }

        // Запасний варіант - повертаємо локальний прогрес
        return userProgress[taskId] || null;
    }

    /**
     * Створення базового елементу завдання (запасний варіант)
     */
    function createBasicTaskElement(task, progress, isLimited = false) {
        const completed = progress && progress.status === 'completed';
        const started = progress && progress.status === 'started';
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

        // Вибираємо кнопки для відображення залежно від статусу
        let actionButtons = '';
        if (completed) {
            actionButtons = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
        } else if (started) {
            actionButtons = `<button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`;
        } else {
            actionButtons = `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>`;
        }

        return `
            <div class="task-item" data-task-id="${task.id}" data-task-type="${task.type || 'social'}" data-target-value="${task.target_value}">
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
                    ${actionButtons}
                </div>
            </div>
        `;
    }

    /**
     * Функція для безпечного виведення HTML
     */
    function escapeHtml(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        console.error('TaskManager:', message);

        // Пробуємо використати UI.Notifications
        if (window.UI && window.UI.Notifications && typeof window.UI.Notifications.showError === 'function') {
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
            // Якщо toast-елемент не знайдено, створюємо його динамічно
            console.log('TaskManager: toast-message не знайдено, створюємо динамічно');

            const newToast = document.createElement('div');
            newToast.id = 'toast-message';
            newToast.className = 'toast-message error show';
            newToast.textContent = message;
            newToast.style.position = 'fixed';
            newToast.style.bottom = '20px';
            newToast.style.left = '50%';
            newToast.style.transform = 'translateX(-50%)';
            newToast.style.backgroundColor = '#f44336';
            newToast.style.color = 'white';
            newToast.style.padding = '12px 20px';
            newToast.style.borderRadius = '4px';
            newToast.style.zIndex = '9999';

            document.body.appendChild(newToast);

            // Автоматично приховуємо повідомлення через 5 секунд
            setTimeout(() => {
                newToast.style.opacity = '0';
                setTimeout(() => {
                    newToast.remove();
                }, 300);
            }, 5000);
        }
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        console.log('TaskManager:', message);

        // Пробуємо використати UI.Notifications
        if (window.UI && window.UI.Notifications && typeof window.UI.Notifications.showSuccess === 'function') {
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
            // Якщо toast-елемент не знайдено, створюємо його динамічно
            console.log('TaskManager: toast-message не знайдено, створюємо динамічно');

            const newToast = document.createElement('div');
            newToast.id = 'toast-message';
            newToast.className = 'toast-message success show';
            newToast.textContent = message;
            newToast.style.position = 'fixed';
            newToast.style.bottom = '20px';
            newToast.style.left = '50%';
            newToast.style.transform = 'translateX(-50%)';
            newToast.style.backgroundColor = '#4CAF50';
            newToast.style.color = 'white';
            newToast.style.padding = '12px 20px';
            newToast.style.borderRadius = '4px';
            newToast.style.zIndex = '9999';

            document.body.appendChild(newToast);

            // Автоматично приховуємо повідомлення через 5 секунд
            setTimeout(() => {
                newToast.style.opacity = '0';
                setTimeout(() => {
                    newToast.remove();
                }, 300);
            }, 5000);
        }
    }

    /**
     * Діагностика API шляхів
     */
    function diagnoseApiPaths() {
        console.group('TaskManager: Діагностика API_PATHS:');

        if (!window.API_PATHS) {
            console.error('window.API_PATHS не знайдено!');
            console.groupEnd();
            return;
        }

        console.log('API_PATHS.TASKS:', window.API_PATHS.TASKS);

        // Перевіряємо шляхи до завдань
        const paths = ['SOCIAL', 'LIMITED', 'PARTNER', 'REFERRAL'];
        paths.forEach(path => {
            if (window.API_PATHS.TASKS[path]) {
                console.log(`API_PATHS.TASKS.${path}:`, window.API_PATHS.TASKS[path]);

                // Спробуємо дізнатись повний URL
                let fullUrl = '';
                if (window.API_BASE_URL) {
                    fullUrl = `${window.API_BASE_URL}/${window.API_PATHS.TASKS[path]}`;
                } else if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
                    fullUrl = `${window.WinixAPI.config.baseUrl}/${window.API_PATHS.TASKS[path]}`;
                }

                if (fullUrl) {
                    console.log(`Повний URL для ${path}:`, fullUrl);
                }
            } else {
                console.error(`API_PATHS.TASKS.${path} не знайдено!`);
            }
        });

        console.groupEnd();
    }

    // Публічний API модуля
    return {
        init,
        loadTasks,
        renderSocialTasks,
        renderLimitedTasks,
        renderPartnerTasks,
        renderReferralTasks,
        diagnoseApiPaths,
        refreshAllTasks,
        refreshTaskDisplay,
        startTask,
        verifyTask,
        findTaskById,
        updateTaskProgress,
        getTaskProgress,
        showErrorMessage,
        showSuccessMessage,
        diagnoseSystemState,
        safeGetUserId,
        // Константи
        REWARD_TYPES,
        // Доступ до даних (тільки для читання)
        get userProgress() { return { ...userProgress }; },
        get domElements() { return { ...domElements }; },
        get initialized() { return initialized; }
    };
})();