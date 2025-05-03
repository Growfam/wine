/**
 * TaskManager - Модуль для управління завданнями
 * Виправлена версія з кращою діагностикою
 * @version 1.1.0
 */

window.TaskManager = (function() {
    // Приватні змінні модуля
    let socialTasks = [];
    let limitedTasks = [];
    let partnerTasks = [];
    let referralTasks = [];
    let userProgress = {};

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
        lastOperationId: null
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
     * Ініціалізація TaskManager
     */
    function init() {
        console.log('🔍 ДІАГНОСТИКА: Ініціалізація TaskManager...');

        // Перевіряємо доступність API
        if (!isApiAvailable()) {
            console.error('🔍 ДІАГНОСТИКА: API недоступне!');
            console.log('window.API =', window.API);
            console.log('window.API_PATHS =', window.API_PATHS);

            showErrorMessage('API недоступне. Неможливо завантажити завдання.');
            return;
        }

        console.log('🔍 ДІАГНОСТИКА: API доступне');
        console.log('window.API_PATHS.TASKS =', window.API_PATHS.TASKS);

        // Знаходимо необхідні DOM-елементи
        findDomElements();

        // Налаштування перемикачів вкладок
        setupTabSwitching();

        // Завантаження завдань
        loadTasks();
    }

    /**
     * Знаходження DOM-елементів
     */
    function findDomElements() {
        domElements.socialTasksContainer = document.getElementById('social-tasks-container');
        domElements.limitedTasksContainer = document.getElementById('limited-tasks-container');
        domElements.partnersTasksContainer = document.getElementById('partners-tasks-container');
        domElements.referralTasksContainer = document.getElementById('referral-tasks-container');
        domElements.tabButtons = document.querySelectorAll('.tab');
        domElements.contentSections = document.querySelectorAll('.content-section');

        console.log('🔍 ДІАГНОСТИКА: DOM-елементи знайдено:');
        console.log('socialTasksContainer =', domElements.socialTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('limitedTasksContainer =', domElements.limitedTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('partnersTasksContainer =', domElements.partnersTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('referralTasksContainer =', domElements.referralTasksContainer ? 'знайдено' : 'не знайдено');
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
     * Перевірка доступності API
     */
    function isApiAvailable() {
        return window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function';
    }

    /**
     * Завантаження завдань
     */
    async function loadTasks() {
        console.log('🔍 ДІАГНОСТИКА: Починаємо завантаження завдань...');

        try {
            // Запобігаємо одночасним запитам
            if (operationStatus.tasksLoading) {
                console.log('🔍 ДІАГНОСТИКА: Завантаження вже виконується, пропускаємо');
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

            // Логуємо URL-шляхи які використовуються
            console.log('🔍 ДІАГНОСТИКА: URL для соціальних завдань =', window.API_PATHS.TASKS.SOCIAL);
            console.log('🔍 ДІАГНОСТИКА: URL для лімітованих завдань =', window.API_PATHS.TASKS.LIMITED);
            console.log('🔍 ДІАГНОСТИКА: URL для партнерських завдань =', window.API_PATHS.TASKS.PARTNER);
            console.log('🔍 ДІАГНОСТИКА: URL для реферальних завдань =', window.API_PATHS.TASKS.REFERRAL);

            try {
                // Спробуємо завантажити соціальні завдання
                console.log('🔍 ДІАГНОСТИКА: Запит соціальних завдань...');
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
                console.log('🔍 ДІАГНОСТИКА: Запит лімітованих завдань...');
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
                console.log('🔍 ДІАГНОСТИКА: Запит партнерських завдань...');
                const partnerResponse = await window.API.get(window.API_PATHS.TASKS.PARTNER);
                let partnerTasksData = extractTasksFromResponse(partnerResponse);

                if (partnerTasksData.length > 0) {
                    partnerTasks = normalizeTasksData(partnerTasksData);
                    renderPartnerTasks();
                } else if (domElements.partnersTasksContainer) {
                    domElements.partnersTasksContainer.innerHTML =
                        '<div class="no-tasks">Партнерські завдання не знайдені.</div>';
                }

            } catch (error) {
                console.error('🔍 ДІАГНОСТИКА: Помилка при виконанні запиту:', error);

                // Показуємо повідомлення про помилку в контейнерах
                const errorHtml = `<div class="error-message">Помилка завантаження завдань: ${error.message}</div>`;
                if (domElements.socialTasksContainer) {
                    domElements.socialTasksContainer.innerHTML = errorHtml;
                }
            }

        } catch (error) {
            console.error('🔍 ДІАГНОСТИКА: Загальна помилка завантаження завдань:', error);

            // Показуємо загальне повідомлення про помилку
            showErrorMessage('Не вдалося завантажити завдання: ' + error.message);
        } finally {
            operationStatus.tasksLoading = false;
            console.log('🔍 ДІАГНОСТИКА: Завершено спробу завантаження завдань');
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
            } else {
                regular.push(task);
            }
        });

        console.log('🔍 ДІАГНОСТИКА: Розділення завдань - звичайні:', regular.length, 'реферальні:', referral.length);
        return { regular, referral };
    }

    /**
     * Нормалізація даних завдань
     */
    function normalizeTasksData(tasks) {
        console.log('🔍 ДІАГНОСТИКА: Нормалізація даних завдань, отримано:', tasks);

        if (!Array.isArray(tasks)) {
            console.warn('🔍 ДІАГНОСТИКА: tasks не є масивом, тип:', typeof tasks);
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
        console.log('🔍 ДІАГНОСТИКА: Відображення соціальних завдань, кількість:', socialTasks.length);

        if (!domElements.socialTasksContainer) {
            console.warn('🔍 ДІАГНОСТИКА: Контейнер для соціальних завдань не знайдено');
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
            if (window.SocialTask && window.SocialTask.create) {
                const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                domElements.socialTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант
                domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення реферальних завдань
     */
    function renderReferralTasks() {
        console.log('🔍 ДІАГНОСТИКА: Відображення реферальних завдань, кількість:', referralTasks.length);

        if (!domElements.referralTasksContainer) {
            console.warn('🔍 ДІАГНОСТИКА: Контейнер для реферальних завдань не знайдено');
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
            if (window.SocialTask && window.SocialTask.create) {
                const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                domElements.referralTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант
                domElements.referralTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення лімітованих завдань
     */
    function renderLimitedTasks() {
        console.log('🔍 ДІАГНОСТИКА: Відображення лімітованих завдань, кількість:', limitedTasks.length);

        if (!domElements.limitedTasksContainer) {
            console.warn('🔍 ДІАГНОСТИКА: Контейнер для лімітованих завдань не знайдено');
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
            if (window.LimitedTask && window.LimitedTask.create) {
                const taskElement = window.LimitedTask.create(task, userProgress[task.id]);
                domElements.limitedTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант
                domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
            }
        });
    }

    /**
     * Відображення партнерських завдань
     */
    function renderPartnerTasks() {
        console.log('🔍 ДІАГНОСТИКА: Відображення партнерських завдань, кількість:', partnerTasks.length);

        if (!domElements.partnersTasksContainer) {
            console.warn('🔍 ДІАГНОСТИКА: Контейнер для партнерських завдань не знайдено');
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
            if (window.PartnerTask && window.PartnerTask.create) {
                const taskElement = window.PartnerTask.create(task, userProgress[task.id]);
                domElements.partnersTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант
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
     * Функція для безпечного виведення HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        console.error('🔍 ДІАГНОСТИКА:', message);

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
            console.log('🔍 ДІАГНОСТИКА: toast-message не знайдено, створюємо динамічно');

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
     * Діагностика API шляхів
     */
    function diagnoseApiPaths() {
        console.group('🔍 ДІАГНОСТИКА API_PATHS:');

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
        showErrorMessage
    };
})();