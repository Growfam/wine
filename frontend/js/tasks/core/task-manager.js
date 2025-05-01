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
        domElements.tabButtons = document.querySelectorAll('.tab');
        domElements.contentSections = document.querySelectorAll('.content-section');

        console.log('🔍 ДІАГНОСТИКА: DOM-елементи знайдено:');
        console.log('socialTasksContainer =', domElements.socialTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('limitedTasksContainer =', domElements.limitedTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('partnersTasksContainer =', domElements.partnersTasksContainer ? 'знайдено' : 'не знайдено');
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

            // Логуємо URL-шляхи які використовуються
            console.log('🔍 ДІАГНОСТИКА: URL для соціальних завдань =', window.API_PATHS.TASKS.SOCIAL);
            console.log('🔍 ДІАГНОСТИКА: URL для лімітованих завдань =', window.API_PATHS.TASKS.LIMITED);
            // ВИПРАВЛЕНО: Використовуємо PARTNER замість PARTNERS
            console.log('🔍 ДІАГНОСТИКА: URL для партнерських завдань =', window.API_PATHS.TASKS.PARTNER);

            try {
                // Спробуємо завантажити соціальні завдання і побачити що відбувається
                console.log('🔍 ДІАГНОСТИКА: Запит соціальних завдань...');
                const socialResponse = await window.API.get(window.API_PATHS.TASKS.SOCIAL);
                console.log('🔍 ДІАГНОСТИКА: Відповідь на запит соціальних завдань:', socialResponse);

                // Перевіряємо структуру відповіді
                if (socialResponse) {
                    console.log('🔍 ДІАГНОСТИКА: Тип відповіді:', typeof socialResponse);
                    console.log('🔍 ДІАГНОСТИКА: Ключі у відповіді:', Object.keys(socialResponse));

                    if (socialResponse.status) {
                        console.log('🔍 ДІАГНОСТИКА: Значення status:', socialResponse.status);
                    }

                    if (socialResponse.data) {
                        console.log('🔍 ДІАГНОСТИКА: Тип data:', typeof socialResponse.data);
                        console.log('🔍 ДІАГНОСТИКА: Ключі в data:', Object.keys(socialResponse.data));

                        if (socialResponse.data.tasks) {
                            console.log('🔍 ДІАГНОСТИКА: data.tasks є масивом:', Array.isArray(socialResponse.data.tasks));
                            console.log('🔍 ДІАГНОСТИКА: Кількість завдань:', socialResponse.data.tasks.length);

                            // Перевіряємо перше завдання (якщо є)
                            if (socialResponse.data.tasks.length > 0) {
                                console.log('🔍 ДІАГНОСТИКА: Приклад першого завдання:', socialResponse.data.tasks[0]);
                            }
                        } else {
                            console.log('🔍 ДІАГНОСТИКА: Поле data.tasks відсутнє');
                            // Можливо структура інша - перевіримо вміст data
                            console.log('🔍 ДІАГНОСТИКА: Вміст data:', socialResponse.data);
                        }
                    }

                    // РІЗНІ ВАРІАНТИ ОБРОБКИ - спробуємо всі можливі варіанти структури
                    let tasksData = [];

                    // Варіант 1: правильна структура { status: 'success', data: { tasks: [...] } }
                    if (socialResponse.status === 'success' && socialResponse.data && socialResponse.data.tasks) {
                        console.log('🔍 ДІАГНОСТИКА: Використовуємо структуру data.tasks');
                        tasksData = socialResponse.data.tasks;
                    }
                    // Варіант 2: структура { status: 'success', data: [...] }
                    else if (socialResponse.status === 'success' && socialResponse.data && Array.isArray(socialResponse.data)) {
                        console.log('🔍 ДІАГНОСТИКА: Використовуємо структуру data як масив');
                        tasksData = socialResponse.data;
                    }
                    // Варіант 3: структура { success: true, data: [...] }
                    else if (socialResponse.success && socialResponse.data) {
                        console.log('🔍 ДІАГНОСТИКА: Використовуємо success замість status');
                        if (Array.isArray(socialResponse.data)) {
                            tasksData = socialResponse.data;
                        } else if (socialResponse.data.tasks) {
                            tasksData = socialResponse.data.tasks;
                        }
                    }
                    // Варіант 4: масив безпосередньо у відповіді
                    else if (Array.isArray(socialResponse)) {
                        console.log('🔍 ДІАГНОСТИКА: Відповідь є масивом безпосередньо');
                        tasksData = socialResponse;
                    }
                    // Варіант 5: { tasks: [...] }
                    else if (socialResponse.tasks && Array.isArray(socialResponse.tasks)) {
                        console.log('🔍 ДІАГНОСТИКА: Використовуємо tasks в корені відповіді');
                        tasksData = socialResponse.tasks;
                    }

                    console.log('🔍 ДІАГНОСТИКА: Знайдено завдань:', tasksData.length);

                    if (tasksData.length > 0) {
                        console.log('🔍 ДІАГНОСТИКА: Завдання успішно отримані!');
                        socialTasks = normalizeTasksData(tasksData);
                        renderSocialTasks();
                    } else {
                        console.log('🔍 ДІАГНОСТИКА: Завдання не знайдені після всіх спроб');
                        if (domElements.socialTasksContainer) {
                            domElements.socialTasksContainer.innerHTML =
                                '<div class="no-tasks">Завдання не знайдені. Спробуйте пізніше.</div>';
                        }
                    }
                } else {
                    console.log('🔍 ДІАГНОСТИКА: Відповідь socialResponse є null або undefined');
                }

                // Пробуємо завантажити інші типи завдань
                try {
                    console.log('🔍 ДІАГНОСТИКА: Запит лімітованих завдань...');
                    const limitedResponse = await window.API.get(window.API_PATHS.TASKS.LIMITED);
                    console.log('🔍 ДІАГНОСТИКА: Відповідь на запит лімітованих завдань:', limitedResponse);

                    // Така ж обробка як і для соціальних завдань, але скорочена для компактності
                    let limitedTasksData = [];
                    if (limitedResponse.status === 'success' && limitedResponse.data && limitedResponse.data.tasks) {
                        limitedTasksData = limitedResponse.data.tasks;
                    } else if (limitedResponse.status === 'success' && limitedResponse.data && Array.isArray(limitedResponse.data)) {
                        limitedTasksData = limitedResponse.data;
                    } else if (limitedResponse.success && limitedResponse.data) {
                        limitedTasksData = Array.isArray(limitedResponse.data) ? limitedResponse.data :
                            (limitedResponse.data.tasks || []);
                    } else if (Array.isArray(limitedResponse)) {
                        limitedTasksData = limitedResponse;
                    } else if (limitedResponse.tasks && Array.isArray(limitedResponse.tasks)) {
                        limitedTasksData = limitedResponse.tasks;
                    }

                    if (limitedTasksData.length > 0) {
                        limitedTasks = normalizeTasksData(limitedTasksData);
                        renderLimitedTasks();
                    } else if (domElements.limitedTasksContainer) {
                        domElements.limitedTasksContainer.innerHTML =
                            '<div class="no-tasks">Лімітовані завдання не знайдені.</div>';
                    }
                } catch (limitedError) {
                    console.error('🔍 ДІАГНОСТИКА: Помилка при завантаженні лімітованих завдань:', limitedError);
                }

                try {
                    // ВИПРАВЛЕНО: Використовуємо API_PATHS.TASKS.PARTNER замість API_PATHS.TASKS.PARTNERS
                    console.log('🔍 ДІАГНОСТИКА: Запит партнерських завдань...');
                    const partnerResponse = await window.API.get(window.API_PATHS.TASKS.PARTNER);
                    console.log('🔍 ДІАГНОСТИКА: Відповідь на запит партнерських завдань:', partnerResponse);

                    // Така ж обробка як і для соціальних завдань, але скорочена для компактності
                    let partnerTasksData = [];
                    if (partnerResponse.status === 'success' && partnerResponse.data && partnerResponse.data.tasks) {
                        partnerTasksData = partnerResponse.data.tasks;
                    } else if (partnerResponse.status === 'success' && partnerResponse.data && Array.isArray(partnerResponse.data)) {
                        partnerTasksData = partnerResponse.data;
                    } else if (partnerResponse.success && partnerResponse.data) {
                        partnerTasksData = Array.isArray(partnerResponse.data) ? partnerResponse.data :
                            (partnerResponse.data.tasks || []);
                    } else if (Array.isArray(partnerResponse)) {
                        partnerTasksData = partnerResponse;
                    } else if (partnerResponse.tasks && Array.isArray(partnerResponse.tasks)) {
                        partnerTasksData = partnerResponse.tasks;
                    }

                    if (partnerTasksData.length > 0) {
                        partnerTasks = normalizeTasksData(partnerTasksData);
                        renderPartnerTasks();
                    } else if (domElements.partnersTasksContainer) {
                        domElements.partnersTasksContainer.innerHTML =
                            '<div class="no-tasks">Партнерські завдання не знайдені.</div>';
                    }
                } catch (partnerError) {
                    console.error('🔍 ДІАГНОСТИКА: Помилка при завантаженні партнерських завдань:', partnerError);
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
            // Перевіряємо наявність компонента для соціальних завдань
            if (window.SocialTask && window.SocialTask.create) {
                console.log('🔍 ДІАГНОСТИКА: Використовуємо SocialTask.create для завдання', task.id);
                const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                domElements.socialTasksContainer.appendChild(taskElement);
            } else {
                console.log('🔍 ДІАГНОСТИКА: Використовуємо createBasicTaskElement для завдання', task.id);
                // Запасний варіант, якщо компонент не знайдено
                domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });

        console.log('🔍 ДІАГНОСТИКА: Соціальні завдання успішно відображені');
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
            // Перевіряємо наявність компонента для лімітованих завдань
            if (window.LimitedTask && window.LimitedTask.create) {
                const taskElement = window.LimitedTask.create(task, userProgress[task.id]);
                domElements.limitedTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
            }
        });

        console.log('🔍 ДІАГНОСТИКА: Лімітовані завдання успішно відображені');
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
            // Перевіряємо наявність компонента для партнерських завдань
            if (window.PartnerTask && window.PartnerTask.create) {
                const taskElement = window.PartnerTask.create(task, userProgress[task.id]);
                domElements.partnersTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });

        console.log('🔍 ДІАГНОСТИКА: Партнерські завдання успішно відображені');
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
        // ВИПРАВЛЕНО: Змінено PARTNERS на PARTNER
        const paths = ['SOCIAL', 'LIMITED', 'PARTNER'];
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
        diagnoseApiPaths,
        showErrorMessage
    };
})();