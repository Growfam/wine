/**
 * TaskManager - модуль керування завданнями
 * Відповідає за:
 * - Завантаження та відображення завдань
 * - Обробку взаємодії користувача з завданнями
 * - Координацію між різними типами завдань
 */

// Створюємо глобальний об'єкт TaskManager
window.TaskManager = (function() {
    // Приватні змінні модуля
    let socialTasks = [];
    let limitedTasks = [];
    let partnerTasks = [];
    let userProgress = {};

    // DOM-елементи
    const socialTasksContainer = document.getElementById('social-tasks-container');
    const limitedTasksContainer = document.getElementById('limited-tasks-container');
    const partnersTasksContainer = document.getElementById('partners-tasks-container');
    const tabButtons = document.querySelectorAll('.tab');
    const contentSections = document.querySelectorAll('.content-section');

    /**
     * Ініціалізація менеджера завдань
     */
    function init() {
        console.log('Ініціалізація TaskManager...');

        // Налаштування перемикачів вкладок
        setupTabSwitching();

        // Завантаження даних користувача та завдань
        loadUserProgress()
            .then(() => {
                loadTasks();
                // Ініціалізуємо компоненти після завантаження завдань
                if (window.DailyBonus) {
                    window.DailyBonus.init();
                }
                if (window.Leaderboard) {
                    window.Leaderboard.init();
                }
            })
            .catch(error => {
                console.error('Помилка завантаження даних:', error);
                showErrorMessage('Не вдалося завантажити завдання. Спробуйте пізніше.');
            });

        // Підписуємося на події
        subscribeToEvents();
    }

    /**
     * Налаштування перемикачів вкладок
     */
    function setupTabSwitching() {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Знімаємо активний клас з усіх вкладок
                tabButtons.forEach(btn => btn.classList.remove('active'));

                // Додаємо активний клас поточній вкладці
                this.classList.add('active');

                // Ховаємо всі секції контенту
                contentSections.forEach(section => section.classList.remove('active'));

                // Показуємо відповідну секцію
                const tabType = this.dataset.tab;
                document.getElementById(`${tabType}-content`).classList.add('active');
            });
        });
    }

    /**
     * Завантаження прогресу користувача
     */
    async function loadUserProgress() {
        try {
            const response = await window.API.get('/quests/user-progress');
            userProgress = response.data;
            return userProgress;
        } catch (error) {
            console.error('Помилка завантаження прогресу користувача:', error);
            userProgress = {};
            return {};
        }
    }

    /**
     * Завантаження завдань з API
     */
    async function loadTasks() {
        try {
            // Завантажуємо соціальні завдання
            const socialResponse = await window.API.get('/quests/tasks/social');
            socialTasks = socialResponse.data;
            renderSocialTasks();

            // Завантажуємо лімітовані завдання
            const limitedResponse = await window.API.get('/quests/tasks/limited');
            limitedTasks = limitedResponse.data;
            renderLimitedTasks();

            // Завантажуємо партнерські завдання
            const partnerResponse = await window.API.get('/quests/tasks/partners');
            partnerTasks = partnerResponse.data;
            renderPartnerTasks();
        } catch (error) {
            console.error('Помилка завантаження завдань:', error);
            showErrorMessage('Не вдалося завантажити завдання. Спробуйте пізніше.');
        }
    }

    /**
     * Відображення соціальних завдань
     */
    function renderSocialTasks() {
        if (!socialTasksContainer) return;

        // Очищаємо контейнер
        socialTasksContainer.innerHTML = '';

        if (socialTasks.length === 0) {
            socialTasksContainer.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        socialTasks.forEach(task => {
            // Перевіряємо наявність компонента для соціальних завдань
            if (window.SocialTask) {
                const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                socialTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення лімітованих завдань
     */
    function renderLimitedTasks() {
        if (!limitedTasksContainer) return;

        // Очищаємо контейнер
        limitedTasksContainer.innerHTML = '';

        if (limitedTasks.length === 0) {
            limitedTasksContainer.innerHTML = '<div class="task-item"><div class="task-header"><div class="task-title">Очікуйте на нові завдання</div><div class="timer-container"><span class="timer-icon">⏰</span> <span data-lang-key="earn.coming_soon">Скоро</span></div></div><div class="task-description" data-lang-key="earn.expect_new_tasks">Лімітовані завдання будуть доступні найближчим часом. Не пропустіть можливість отримати додаткові нагороди!</div></div>';
            return;
        }

        // Відображаємо кожне завдання
        limitedTasks.forEach(task => {
            // Перевіряємо наявність компонента для лімітованих завдань
            if (window.LimitedTask) {
                const taskElement = window.LimitedTask.create(task, userProgress[task.id]);
                limitedTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
            }
        });
    }

    /**
     * Відображення партнерських завдань
     */
    function renderPartnerTasks() {
        if (!partnersTasksContainer) return;

        // Очищаємо контейнер
        partnersTasksContainer.innerHTML = '';

        if (partnerTasks.length === 0) {
            partnersTasksContainer.innerHTML = '<div class="task-item"><div class="task-header"><div class="task-title">Очікуйте на партнерські пропозиції</div></div><div class="task-description" data-lang-key="earn.expect_partners">Партнерські завдання будуть доступні найближчим часом. Слідкуйте за оновленнями!</div></div>';
            return;
        }

        // Відображаємо кожне завдання
        partnerTasks.forEach(task => {
            // Перевіряємо наявність компонента для партнерських завдань
            if (window.PartnerTask) {
                const taskElement = window.PartnerTask.create(task, userProgress[task.id]);
                partnersTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
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

        let timerHtml = '';
        if (isLimited && task.end_date) {
            const endDate = new Date(task.end_date);
            const now = new Date();
            const timeLeft = endDate - now;

            if (timeLeft > 0) {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                timerHtml = `<div class="timer-container"><span class="timer-icon">⏰</span> ${days}д ${hours}г</div>`;
            }
        }

        return `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">${task.title}</div>
                    ${completed ? 
                      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                      `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</span></div>${timerHtml}`
                    }
                </div>
                <div class="task-description">${task.description}</div>
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
            if (target.matches('.action-button[data-action]')) {
                const taskId = target.dataset.taskId;
                const action = target.dataset.action;

                if (action === 'start') {
                    startTask(taskId);
                } else if (action === 'verify') {
                    verifyTask(taskId);
                }
            }
        });

        // Обробка кнопки отримання щоденного бонусу
        const claimDailyButton = document.getElementById('claim-daily');
        if (claimDailyButton) {
            claimDailyButton.addEventListener('click', function() {
                if (window.DailyBonus) {
                    window.DailyBonus.claimBonus();
                }
            });
        }
    }

    /**
     * Розпочати виконання завдання
     */
    async function startTask(taskId) {
        try {
            const response = await window.API.post(`/quests/tasks/${taskId}/start`);

            if (response.success) {
                // Знаходимо задачу
                const task = findTaskById(taskId);

                if (task) {
                    // Якщо це соціальне завдання, відкриваємо відповідне посилання
                    if (task.type === 'social' && task.action_url) {
                        window.open(task.action_url, '_blank');
                    }

                    // Оновлюємо прогрес
                    await loadUserProgress();

                    // Оновлюємо відображення
                    refreshTaskDisplay(taskId);
                }
            } else {
                showErrorMessage(response.message || 'Не вдалося розпочати завдання');
            }
        } catch (error) {
            console.error('Помилка при запуску завдання:', error);
            showErrorMessage('Сталася помилка при спробі розпочати завдання');
        }
    }

    /**
     * Перевірити виконання завдання
     */
    async function verifyTask(taskId) {
        try {
            // Показуємо індикатор завантаження
            showLoadingIndicator(taskId);

            const response = await window.API.post(`/quests/tasks/${taskId}/verify`);

            // Приховуємо індикатор завантаження
            hideLoadingIndicator(taskId);

            if (response.success) {
                // Виводимо повідомлення про успіх
                showSuccessMessage(response.message || 'Завдання успішно виконано!');

                // Оновлюємо прогрес
                await loadUserProgress();

                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Якщо є винагорода, показуємо анімацію
                if (response.reward) {
                    showRewardAnimation(response.reward);
                }
            } else {
                showErrorMessage(response.message || 'Не вдалося перевірити виконання завдання');
            }
        } catch (error) {
            // Приховуємо індикатор завантаження
            hideLoadingIndicator(taskId);

            console.error('Помилка при перевірці завдання:', error);
            showErrorMessage('Сталася помилка при спробі перевірити виконання завдання');
        }
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

        // Залежно від типу завдання вибираємо контейнер і функцію відображення
        if (task.type === 'social') {
            renderSocialTasks();
        } else if (task.type === 'limited') {
            renderLimitedTasks();
        } else if (task.type === 'partner') {
            renderPartnerTasks();
        }
    }

    /**
     * Показати індикатор завантаження для конкретного завдання
     */
    function showLoadingIndicator(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            actionElement.classList.add('loading');

            // Створюємо індикатор завантаження, якщо його ще немає
            if (!actionElement.querySelector('.loading-indicator')) {
                const loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'loading-indicator';
                loadingIndicator.innerHTML = '<div class="spinner"></div><span>Перевірка...</span>';

                // Зберігаємо оригінальний вміст
                const originalContent = actionElement.innerHTML;
                actionElement.setAttribute('data-original-content', originalContent);

                // Замінюємо вміст на індикатор
                actionElement.innerHTML = '';
                actionElement.appendChild(loadingIndicator);
            }
        }
    }

    /**
     * Приховати індикатор завантаження для конкретного завдання
     */
    function hideLoadingIndicator(taskId) {
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
        if (window.UI && window.UI.Animations) {
            window.UI.Animations.showReward(reward);
        } else {
            // Проста анімація, якщо модуль анімацій не доступний
            showSuccessMessage(`Ви отримали ${reward.amount} ${reward.type === 'tokens' ? '$WINIX' : 'жетонів'}!`);

            // Оновлюємо відображення балансу
            updateBalance(reward);
        }
    }

    /**
     * Оновити відображення балансу
     */
    function updateBalance(reward) {
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseInt(userTokensElement.textContent) || 0;
                userTokensElement.textContent = currentBalance + reward.amount;
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                userCoinsElement.textContent = currentBalance + reward.amount;
            }
        }
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        // Перевіряємо чи доступний компонент сповіщень
        if (window.UI && window.UI.Notifications) {
            window.UI.Notifications.showSuccess(message);
        } else {
            // Запасний варіант - використовуємо toast-повідомлення
            const toastElement = document.getElementById('toast-message');
            if (toastElement) {
                toastElement.textContent = message;
                toastElement.classList.add('show');

                // Автоматично приховуємо повідомлення через 3 секунди
                setTimeout(() => {
                    toastElement.classList.remove('show');
                }, 3000);
            } else {
                alert(message);
            }
        }
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        // Перевіряємо чи доступний компонент сповіщень
        if (window.UI && window.UI.Notifications) {
            window.UI.Notifications.showError(message);
        } else {
            // Запасний варіант - використовуємо toast-повідомлення
            const toastElement = document.getElementById('toast-message');
            if (toastElement) {
                toastElement.textContent = message;
                toastElement.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
                toastElement.classList.add('show');

                // Автоматично приховуємо повідомлення через 3 секунди
                setTimeout(() => {
                    toastElement.classList.remove('show');
                    // Повертаємо оригінальний стиль
                    toastElement.style.background = 'linear-gradient(135deg, #1A1A2E, #0F3460)';
                }, 3000);
            } else {
                alert(message);
            }
        }
    }

    // Публічний API модуля
    return {
        init,
        loadTasks,
        startTask,
        verifyTask,
        refreshTaskDisplay,
        showSuccessMessage,
        showErrorMessage
    };
})();