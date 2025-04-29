/**
 * LimitedTask - оптимізований компонент для лімітованих за часом завдань
 * Відповідає за:
 * - Створення та відображення лімітованих завдань
 * - Інтеграцію з оновленими системами таймерів та обробки часу
 * - Ефективну обробку подій та оновлення завдань
 */

window.LimitedTask = (function() {
    // Кеш активних завдань та їх таймерів
    const tasks = new Map();

    // Індикатор використання мок-даних
    const mockDataStatus = {
        timerData: false,
        verification: false,
        taskData: false
    };

    // Функція для логування використання мок-даних
    function logMockDataUsage(dataType, reason) {
        mockDataStatus[dataType] = true;
        console.warn(`LimitedTask: Використання ТЕСТОВИХ даних для [${dataType}]. Причина: ${reason}`);

        // Додаємо детальний запис у консоль розробника
        if (console.groupCollapsed) {
            console.groupCollapsed(`%cМОК-ДАНІ LimitedTask [${dataType}]`, 'background: #FFF3CD; color: #856404; padding: 2px 5px; border-radius: 3px;');
            console.info(`Причина: ${reason}`);
            console.info(`Час: ${new Date().toLocaleTimeString()}`);
            console.trace('Стек виклику');
            console.groupEnd();
        }
    }

    // Перевірка доступності API
    function isApiAvailable() {
        return window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function';
    }

    // Перевірка, чи є користувач авторизованим
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
     * Створення елементу лімітованого завдання
     * @param {Object} task - Об'єкт з даними завдання
     * @param {Object} progress - Об'єкт з прогресом користувача
     * @returns {HTMLElement} - DOM елемент завдання
     */
    function create(task, progress = null) {
        // Визначаємо поточний стан завдання
        const isCompleted = progress && progress.status === 'completed';
        const progressValue = progress ? progress.progress_value : 0;
        const progressPercent = task.target_value > 0
            ? Math.min(100, Math.round((progressValue / task.target_value) * 100))
            : 0;

        // Перевіряємо кінцеву дату та розраховуємо статус
        let isExpired = false;
        let endDate = null;

        if (task.end_date) {
            // Парсимо дату з використанням TimeUtils, якщо доступний
            if (window.TimeUtils && window.TimeUtils.parseDate) {
                endDate = window.TimeUtils.parseDate(task.end_date);
            } else {
                endDate = new Date(task.end_date);
            }

            // Перевіряємо, чи не закінчився термін
            const now = new Date();
            isExpired = endDate <= now;
        }

        // Створюємо основний контейнер завдання
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = 'limited';
        taskElement.dataset.targetValue = task.target_value.toString();

        // Додаємо класи для завершеного або закінченого терміну
        if (isCompleted) {
            taskElement.classList.add('completed');
        } else if (isExpired) {
            taskElement.classList.add('expired');
        }

        // Додаємо індикатор мок-даних, якщо потрібно
        if ((mockDataStatus.timerData || mockDataStatus.verification || mockDataStatus.taskData) &&
            (!isApiAvailable() || !isUserAuthenticated())) {
            taskElement.classList.add('mock-data-mode');
        }

        // Підготовка HTML для таймера
        let timerHtml = '';
        if (task.end_date && !isExpired && !isCompleted) {
            // Створюємо контейнер для таймера, який буде ініціалізовано пізніше
            timerHtml = `
                <div class="timer-container">
                    <span class="timer-icon"></span>
                    <span class="timer-value" data-end-date="${task.end_date}" data-format="short"></span>
                </div>
            `;
        } else if (isExpired) {
            timerHtml = `
                <div class="timer-container expired">
                    <span class="timer-icon"></span>
                    <span data-lang-key="earn.expired">Закінчено</span>
                </div>
            `;
        }

        // Наповнюємо контент завдання
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${isCompleted ? 
                  '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' :
                  isExpired ?
                  '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>' :
                  `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</span></div>${timerHtml}`
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
                ${isCompleted ? 
                  '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' :
                  isExpired ?
                  '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>' :
                  `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>
                   <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`
                }
            </div>
            ${(mockDataStatus.timerData || mockDataStatus.verification || mockDataStatus.taskData) ? 
              '<div class="mock-data-badge" title="Використовуються тестові дані">⚠️ Демо</div>' : ''}
        `;

        // Додаємо обробники подій
        if (!isCompleted && !isExpired) {
            const startButton = taskElement.querySelector('.action-button[data-action="start"]');
            const verifyButton = taskElement.querySelector('.action-button[data-action="verify"]');

            if (startButton) {
                startButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    handleStartTask(task);
                });
            }

            if (verifyButton) {
                verifyButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    handleVerifyTask(task);
                });
            }

            // Ініціалізуємо таймер зворотного відліку, якщо є дата завершення
            if (task.end_date && !isExpired) {
                initializeTaskTimer(task.id, taskElement);
            }
        }

        // Зберігаємо зв'язок між завданням і елементом
        tasks.set(task.id, {
            element: taskElement,
            task: task,
            progress: progress
        });

        return taskElement;
    }

    /**
     * Ініціалізація таймера для завдання
     * @param {string} taskId - ID завдання
     * @param {HTMLElement} taskElement - DOM елемент завдання
     */
    function initializeTaskTimer(taskId, taskElement) {
        // Знаходимо елемент таймера
        const timerElement = taskElement.querySelector('.timer-value[data-end-date]');
        if (!timerElement) return;

        // Отримуємо кінцеву дату
        const endDate = timerElement.getAttribute('data-end-date');
        if (!endDate) return;

        // Функція, що викликається при закінченні часу
        const onTimerComplete = function() {
            // Позначаємо завдання як закінчене
            taskElement.classList.add('expired');

            // Оновлюємо відображення
            refreshTaskDisplay(taskId);

            // Деактивуємо кнопки
            const actionButtons = taskElement.querySelectorAll('.action-button');
            actionButtons.forEach(button => {
                button.disabled = true;
            });
        };

        // Перевіряємо наявність модулів таймера
        let usingMockTimer = false;

        // Використовуємо UI.Countdown, якщо доступний
        if (window.UI && window.UI.Countdown) {
            window.UI.Countdown.createCountdown({
                element: timerElement,
                endDate: endDate,
                format: 'short',
                onComplete: onTimerComplete
            });
        }
        // Або використовуємо TimeUtils напряму
        else if (window.TimeUtils) {
            window.TimeUtils.createCountdown({
                element: timerElement,
                endDate: endDate,
                format: 'short',
                onComplete: onTimerComplete
            });
        }
        // Простий запасний варіант з мок-даними
        else {
            // Логуємо використання власної реалізації таймера (мок-даних)
            usingMockTimer = true;
            logMockDataUsage('timerData', 'Модулі таймера недоступні, використання власної реалізації');

            // Парсимо кінцеву дату
            const endDateTime = new Date(endDate);

            // Форматуємо і відображаємо початковий час
            updateTimerDisplay(timerElement, endDateTime);

            // Створюємо інтервал для оновлення
            const intervalId = setInterval(() => {
                const now = new Date();
                const timeLeft = endDateTime - now;

                if (timeLeft <= 0) {
                    // Таймер закінчився
                    clearInterval(intervalId);
                    timerElement.textContent = 'Закінчено';
                    timerElement.parentElement.classList.add('expired');

                    // Викликаємо обробник завершення
                    onTimerComplete();
                } else {
                    // Оновлюємо відображення
                    updateTimerDisplay(timerElement, endDateTime);
                }
            }, 1000);

            // Зберігаємо ID інтервалу для подальшого очищення
            const taskData = tasks.get(taskId);
            if (taskData) {
                taskData.timerId = intervalId;
                tasks.set(taskId, taskData);
            }
        }

        // Додаємо маркер демо-режиму, якщо використовуємо власну реалізацію таймера
        if (usingMockTimer) {
            const timerContainer = timerElement.closest('.timer-container');
            if (timerContainer) {
                timerContainer.classList.add('mock-timer');
            }
        }
    }

    /**
     * Оновлення відображення таймера (для запасного варіанту)
     * @param {HTMLElement} timerElement - Елемент таймера
     * @param {Date} endDate - Кінцева дата
     */
    function updateTimerDisplay(timerElement, endDate) {
        const now = new Date();
        const timeLeft = endDate - now;

        if (timeLeft <= 0) {
            timerElement.textContent = 'Закінчено';
            return;
        }

        // Форматуємо час
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Форматуємо відображення
        let formattedTime;
        if (days > 0) {
            formattedTime = `${days}д ${hours}г`;
        } else if (hours > 0) {
            formattedTime = `${hours}г ${minutes}хв`;
        } else {
            formattedTime = `${minutes}хв ${seconds}с`;
        }

        timerElement.textContent = formattedTime;
    }

    /**
     * Обробник початку виконання завдання
     * @param {Object} task - Дані завдання
     */
    function handleStartTask(task) {
        // Відтворюємо звук кліку, якщо доступний модуль анімацій
        if (window.UI && window.UI.Animations && window.UI.Animations.playSound) {
            window.UI.Animations.playSound('click');
        }

        // Делегуємо обробку до TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.startTask) {
            window.TaskManager.startTask(task.id);
            return;
        }

        // Перевіряємо доступність API
        const apiEnabled = isApiAvailable() && isUserAuthenticated();

        // Якщо API недоступне, логуємо використання мок-даних
        if (!apiEnabled) {
            const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
            logMockDataUsage('taskData', reason);
        }

        // Відкриваємо посилання, якщо є
        if (task.action_url) {
            window.open(task.action_url, '_blank');
        }

        // Викликаємо API самостійно, якщо доступний
        if (apiEnabled) {
            window.API.post(`quests/tasks/${task.id}/start`)
                .then(response => {
                    if (response.success) {
                        // Відображаємо успішне повідомлення
                        showMessage('Завдання розпочато! Виконайте необхідні дії.', 'success');
                    } else {
                        // Відображаємо помилку
                        showMessage(response.message || 'Помилка при старті завдання', 'error');
                    }
                })
                .catch(error => {
                    console.error('LimitedTask: Помилка при старті завдання:', error);
                    showMessage('Сталася помилка при спробі розпочати завдання', 'error');

                    // Логуємо використання мок-даних при помилці
                    logMockDataUsage('taskData', 'Помилка API при старті завдання');
                });
        } else {
            showMessage('Завдання розпочато в демонстраційному режимі!', 'success');
        }
    }

    /**
     * Обробник перевірки виконання завдання
     * @param {Object} task - Дані завдання
     */
    function handleVerifyTask(task) {
        // Відтворюємо звук кліку, якщо доступний модуль анімацій
        if (window.UI && window.UI.Animations && window.UI.Animations.playSound) {
            window.UI.Animations.playSound('click');
        }

        // Делегуємо обробку до TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.verifyTask) {
            window.TaskManager.verifyTask(task.id);
            return;
        }

        // Показуємо індикатор завантаження
        const taskElement = document.querySelector(`.task-item[data-task-id="${task.id}"]`);
        if (taskElement) {
            const actionElement = taskElement.querySelector('.task-action');
            if (actionElement) {
                actionElement.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>Перевірка...</span></div>';
            }
        }

        // Перевіряємо доступність API
        const apiEnabled = isApiAvailable() && isUserAuthenticated();

        // Якщо API недоступне, використовуємо режим симуляції
        if (!apiEnabled) {
            const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
            logMockDataUsage('verification', reason);
            simulateVerification(task);
            return;
        }

        // Викликаємо API самостійно, якщо доступний
        window.API.post(`quests/tasks/${task.id}/verify`)
            .then(response => {
                // Оновлюємо відображення завдання
                refreshTaskDisplay(task.id);

                if (response.success) {
                    // Відображаємо успішне повідомлення
                    showMessage(response.message || 'Завдання успішно виконано!', 'success');

                    // Якщо є винагорода, показуємо анімацію
                    if (response.reward) {
                        showRewardAnimation(response.reward);
                    }

                    // Анімуємо успішне виконання, якщо доступний модуль анімацій
                    if (window.UI && window.UI.Animations && window.UI.Animations.animateSuccessfulCompletion) {
                        window.UI.Animations.animateSuccessfulCompletion(task.id);
                    }
                } else {
                    // Відображаємо помилку
                    showMessage(response.message || 'Не вдалося перевірити виконання завдання', 'error');
                }
            })
            .catch(error => {
                console.error('LimitedTask: Помилка при перевірці завдання:', error);

                // Логуємо використання мок-даних при помилці і симулюємо верифікацію
                logMockDataUsage('verification', 'Помилка API при верифікації');
                simulateVerification(task);
            });
    }

    /**
     * Симуляція верифікації завдання (для тестового режиму)
     * @param {Object} task - Дані завдання
     */
    function simulateVerification(task) {
        // Затримка для імітації запиту
        setTimeout(() => {
            // Оновлюємо відображення завдання
            refreshTaskDisplay(task.id);

            // Симулюємо успіх з ймовірністю 80%
            const isSuccess = Math.random() < 0.8;

            if (isSuccess) {
                // Відображаємо успішне повідомлення
                showMessage('Завдання успішно виконано! (Демонстраційний режим)', 'success');

                // Симулюємо винагороду
                const reward = {
                    type: Math.random() < 0.5 ? 'tokens' : 'coins',
                    amount: Math.floor(Math.random() * 50) + 10
                };

                // Показуємо анімацію винагороди
                showRewardAnimation(reward);

                // Оновлюємо стан завдання, якщо можливо
                const taskData = tasks.get(task.id);
                if (taskData) {
                    taskData.progress = {
                        status: 'completed',
                        progress_value: task.target_value,
                        completion_date: new Date().toISOString()
                    };
                    tasks.set(task.id, taskData);

                    // Оновлюємо відображення завдання
                    const newTaskElement = create(task, taskData.progress);
                    const oldElement = document.querySelector(`.task-item[data-task-id="${task.id}"]`);
                    if (oldElement && oldElement.parentNode) {
                        oldElement.parentNode.replaceChild(newTaskElement, oldElement);
                    }
                }
            } else {
                // Відображаємо помилку
                showMessage('Не вдалося перевірити виконання завдання (Демонстраційний режим)', 'error');

                // Відновлюємо елементи управління
                const taskElement = document.querySelector(`.task-item[data-task-id="${task.id}"]`);
                if (taskElement) {
                    const actionElement = taskElement.querySelector('.task-action');
                    if (actionElement) {
                        actionElement.innerHTML = `
                            <button class="action-button" data-action="start" data-task-id="${task.id}">${task.action_label || 'Виконати'}</button>
                            <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}">Перевірити</button>
                        `;

                        // Відновлюємо обробники подій
                        const startButton = actionElement.querySelector('.action-button[data-action="start"]');
                        const verifyButton = actionElement.querySelector('.action-button[data-action="verify"]');

                        if (startButton) {
                            startButton.addEventListener('click', function(event) {
                                event.preventDefault();
                                event.stopPropagation();
                                handleStartTask(task);
                            });
                        }

                        if (verifyButton) {
                            verifyButton.addEventListener('click', function(event) {
                                event.preventDefault();
                                event.stopPropagation();
                                handleVerifyTask(task);
                            });
                        }
                    }
                }
            }
        }, 1500);
    }

    /**
     * Оновлення відображення конкретного завдання
     * @param {string} taskId - ID завдання
     */
    function refreshTaskDisplay(taskId) {
        // Делегуємо оновлення до TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.refreshTaskDisplay) {
            window.TaskManager.refreshTaskDisplay(taskId);
            return;
        }

        // Отримуємо дані завдання
        const taskData = tasks.get(taskId);
        if (!taskData) return;

        // Очищаємо таймер, якщо він був створений нами
        if (taskData.timerId) {
            clearInterval(taskData.timerId);
            taskData.timerId = null;
        }

        // Перевіряємо доступність API
        const apiEnabled = isApiAvailable() && isUserAuthenticated();

        // Якщо API недоступне, використовуємо локальні дані з невеликими оновленнями
        if (!apiEnabled) {
            const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
            logMockDataUsage('taskData', `${reason} при оновленні відображення`);

            // Оновлюємо відображення з поточними даними
            const newTaskElement = create(taskData.task, taskData.progress);
            const oldElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
            if (oldElement && oldElement.parentNode) {
                oldElement.parentNode.replaceChild(newTaskElement, oldElement);
            }
            return;
        }

        // Оновлюємо дані з сервера, якщо доступне API
        Promise.all([
            window.API.get('/quests/tasks/limited'),
            window.API.get('/quests/user-progress')
        ])
        .then(([tasksResponse, progressResponse]) => {
            if (tasksResponse.success && progressResponse.success) {
                const tasks = tasksResponse.data;
                const progress = progressResponse.data;

                // Знаходимо потрібне завдання
                const task = tasks.find(t => t.id === taskId);

                if (task) {
                    // Створюємо новий елемент завдання
                    const newTaskElement = create(task, progress[taskId]);

                    // Замінюємо старий елемент
                    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
                    if (taskElement && taskElement.parentNode) {
                        taskElement.parentNode.replaceChild(newTaskElement, taskElement);
                    }
                }
            }
        })
        .catch(error => {
            console.error('LimitedTask: Помилка при оновленні відображення завдання:', error);

            // Логуємо використання мок-даних при помилці
            logMockDataUsage('taskData', 'Помилка API при оновленні відображення');

            // При помилці використовуємо локальні дані
            const newTaskElement = create(taskData.task, taskData.progress);
            const oldElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
            if (oldElement && oldElement.parentNode) {
                oldElement.parentNode.replaceChild(newTaskElement, oldElement);
            }
        });
    }

    /**
     * Показати анімацію отримання винагороди
     * @param {Object} reward - Дані винагороди
     */
    function showRewardAnimation(reward) {
        // Використовуємо TaskRewards, якщо доступний
        if (window.TaskRewards && window.TaskRewards.showRewardAnimation) {
            window.TaskRewards.showRewardAnimation(reward);
            return;
        }

        // Використовуємо UI.Animations, якщо доступний
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(reward);
            return;
        }

        // Резервний варіант для простої анімації
        const rewardAmount = reward.amount;
        const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
        animationElement.textContent = `+${rewardAmount} ${rewardType}`;

        // Додаємо класи залежно від типу винагороди
        if (reward.type === 'tokens') {
            animationElement.classList.add('tokens-reward');
        } else {
            animationElement.classList.add('coins-reward');
        }

        // Додаємо індикатор мок-даних, якщо потрібно
        if (mockDataStatus.verification) {
            animationElement.classList.add('mock-reward');
            const mockBadge = document.createElement('small');
            mockBadge.className = 'mock-badge';
            mockBadge.textContent = 'демо';
            animationElement.appendChild(mockBadge);
        }

        // Додаємо до body
        document.body.appendChild(animationElement);

        // Запускаємо анімацію
        setTimeout(() => {
            animationElement.classList.add('show');

            // Видаляємо елемент через 2 секунди
            setTimeout(() => {
                animationElement.classList.remove('show');
                setTimeout(() => {
                    animationElement.remove();
                }, 300);
            }, 2000);
        }, 100);

        // Оновлюємо баланс користувача
        updateUserBalance(reward);
    }

    /**
     * Оновити баланс користувача
     * @param {Object} reward - Дані винагороди
     */
    function updateUserBalance(reward) {
        // Використовуємо TaskRewards, якщо доступний
        if (window.TaskRewards && window.TaskRewards.updateBalance) {
            window.TaskRewards.updateBalance(reward);
            return;
        }

        // Використовуємо UI.Notifications, якщо доступний
        if (window.UI && window.UI.Notifications && window.UI.Notifications.updateBalanceUI) {
            window.UI.Notifications.updateBalanceUI(reward);
            return;
        }

        // Резервний варіант
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                userTokensElement.textContent = (currentBalance + reward.amount).toFixed(2);
                userTokensElement.classList.add('increasing');

                // Додаємо індикатор демо-режиму, якщо потрібно
                if (mockDataStatus.verification && !userTokensElement.querySelector('.mock-indicator')) {
                    const mockIndicator = document.createElement('small');
                    mockIndicator.className = 'mock-indicator';
                    mockIndicator.textContent = ' (демо)';
                    userTokensElement.appendChild(mockIndicator);
                }

                setTimeout(() => {
                    userTokensElement.classList.remove('increasing');
                }, 2000);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userTokens', (currentBalance + reward.amount).toString());
                    localStorage.setItem('winix_balance', (currentBalance + reward.amount).toString());
                } catch (e) {
                    console.warn('LimitedTask: Помилка збереження балансу в localStorage:', e);
                }
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                userCoinsElement.textContent = currentBalance + reward.amount;
                userCoinsElement.classList.add('increasing');

                // Додаємо індикатор демо-режиму, якщо потрібно
                if (mockDataStatus.verification && !userCoinsElement.querySelector('.mock-indicator')) {
                    const mockIndicator = document.createElement('small');
                    mockIndicator.className = 'mock-indicator';
                    mockIndicator.textContent = ' (демо)';
                    userCoinsElement.appendChild(mockIndicator);
                }

                setTimeout(() => {
                    userCoinsElement.classList.remove('increasing');
                }, 2000);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userCoins', (currentBalance + reward.amount).toString());
                    localStorage.setItem('winix_coins', (currentBalance + reward.amount).toString());
                } catch (e) {
                    console.warn('LimitedTask: Помилка збереження балансу в localStorage:', e);
                }
            }
        }
    }

    /**
     * Показати повідомлення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення (success, error, info)
     */
    function showMessage(message, type = 'info') {
        // Використовуємо UI.Notifications, якщо доступний
        if (window.UI && window.UI.Notifications) {
            if (type === 'error') {
                window.UI.Notifications.showError(message);
            } else if (type === 'success') {
                window.UI.Notifications.showSuccess(message);
            } else {
                window.UI.Notifications.showInfo(message);
            }
            return;
        }

        // Резервний варіант для простого сповіщення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            // Встановлюємо текст
            toastElement.textContent = message;

            // Встановлюємо стиль в залежності від типу
            toastElement.className = 'toast-message';
            toastElement.classList.add(type);

            // Показуємо сповіщення
            toastElement.classList.add('show');

            // Автоматично приховуємо через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            // Якщо елемент toast відсутній, використовуємо стандартний alert
            alert(message);
        }
    }

    /**
     * Функція для безпечного виведення HTML
     * @param {string} text - Текст для обробки
     * @returns {string} Безпечний HTML
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
        // Очищаємо всі таймери, створені цим модулем
        tasks.forEach((taskData, taskId) => {
            if (taskData.timerId) {
                clearInterval(taskData.timerId);
            }
        });

        // Очищаємо кеш завдань
        tasks.clear();

        // Скидаємо стан використання мок-даних
        Object.keys(mockDataStatus).forEach(key => {
            mockDataStatus[key] = false;
        });

        console.log('LimitedTask: Ресурси модуля очищено');
    }

    /**
     * Очищення всіх таймерів та ресурсів
     */
    function cleanup() {
        resetState();
    }

    // Підписуємося на подію виходу зі сторінки
    window.addEventListener('beforeunload', cleanup);

    // Публічний API модуля
    return {
        create,
        refreshTaskDisplay,
        handleStartTask,
        handleVerifyTask,
        cleanup,
        resetState,
        // Для діагностики
        isUsingMockData: (type) => mockDataStatus[type] || false,
        mockDataStatus
    };
})();