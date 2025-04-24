/**
 * LimitedTask - компонент для лімітованих за часом завдань
 * Відповідає за:
 * - Створення та відображення лімітованих завдань
 * - Обробку взаємодії користувача з лімітованими завданнями
 * - Відображення таймера зворотного відліку
 */

window.LimitedTask = (function() {
    // Зберігаємо список таймерів для очищення
    const timers = {};

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

        // Визначаємо статус закінчення терміну
        let isExpired = false;
        let timeLeft = '';
        let endDate = null;

        if (task.end_date) {
            endDate = new Date(task.end_date);
            const now = new Date();

            // Перевіряємо, чи не закінчився термін
            isExpired = endDate <= now;

            // Обчислюємо час, що залишився
            if (!isExpired) {
                timeLeft = formatTimeLeft(endDate, now);
            }
        }

        // Створюємо основний контейнер завдання
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = 'limited';

        // Додаємо клас для завершеного або закінченого терміну
        if (isCompleted) {
            taskElement.classList.add('completed');
        } else if (isExpired) {
            taskElement.classList.add('expired');
        }

        // Підготовка HTML для таймера
        let timerHtml = '';
        if (task.end_date && !isExpired && !isCompleted) {
            timerHtml = `
                <div class="timer-container">
                    <span class="timer-icon">⏰</span>
                    <span class="timer-value" data-end-date="${task.end_date}">${timeLeft}</span>
                </div>
            `;
        } else if (isExpired) {
            timerHtml = `
                <div class="timer-container expired">
                    <span class="timer-icon">⏰</span>
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

            // Запускаємо таймер зворотного відліку
            if (task.end_date && !isExpired) {
                initializeCountdown(task.id, new Date(task.end_date));
            }
        }

        return taskElement;
    }

    /**
     * Ініціалізація таймера зворотного відліку
     */
    function initializeCountdown(taskId, endDate) {
        // Очищаємо попередній таймер, якщо такий є
        if (timers[taskId]) {
            clearInterval(timers[taskId]);
        }

        // Функція оновлення таймера
        const updateTimer = () => {
            const now = new Date();
            const timeLeft = endDate - now;

            // Знаходимо елемент таймера
            const timerElement = document.querySelector(`.task-item[data-task-id="${taskId}"] .timer-value`);

            if (timerElement) {
                if (timeLeft <= 0) {
                    // Таймер закінчився
                    timerElement.parentElement.classList.add('expired');
                    timerElement.parentElement.innerHTML = '<span class="timer-icon">⏰</span> <span data-lang-key="earn.expired">Закінчено</span>';

                    // Деактивуємо кнопки
                    const actionButtons = document.querySelectorAll(`.task-item[data-task-id="${taskId}"] .action-button`);
                    actionButtons.forEach(button => {
                        button.disabled = true;
                    });

                    // Очищаємо таймер
                    clearInterval(timers[taskId]);
                    timers[taskId] = null;

                    // Оновлюємо відображення завдання
                    refreshTaskDisplay(taskId);
                } else {
                    // Оновлюємо відображення таймера
                    timerElement.textContent = formatTimeLeft(endDate, now);
                }
            } else {
                // Якщо елемент таймера не знайдено, очищаємо таймер
                clearInterval(timers[taskId]);
                timers[taskId] = null;
            }
        };

        // Запускаємо таймер з оновленням кожну секунду
        updateTimer(); // Перше оновлення
        timers[taskId] = setInterval(updateTimer, 1000);
    }

    /**
     * Форматування часу, що залишився
     */
    function formatTimeLeft(endDate, now) {
        const timeLeft = endDate - now;

        if (timeLeft <= 0) {
            return 'Закінчено';
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Форматуємо відображення залежно від залишку часу
        if (days > 0) {
            return `${days}д ${hours}г`;
        } else if (hours > 0) {
            return `${hours}г ${minutes}хв`;
        } else {
            return `${minutes}хв ${seconds}с`;
        }
    }

    /**
     * Обробник початку виконання завдання
     */
    function handleStartTask(task) {
        // Якщо є TaskManager, делегуємо обробку йому
        if (window.TaskManager && window.TaskManager.startTask) {
            window.TaskManager.startTask(task.id);
            return;
        }

        // Якщо TaskManager недоступний, відкриваємо посилання самостійно
        if (task.action_url) {
            window.open(task.action_url, '_blank');
        }

        // Викликаємо API самостійно
        if (window.API) {
            window.API.post(`/quests/tasks/${task.id}/start`)
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
                    console.error('Помилка при старті завдання:', error);
                    showMessage('Сталася помилка при спробі розпочати завдання', 'error');
                });
        }
    }

    /**
     * Обробник перевірки виконання завдання
     */
    function handleVerifyTask(task) {
        // Якщо є TaskManager, делегуємо обробку йому
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

        // Викликаємо API самостійно
        if (window.API) {
            window.API.post(`/quests/tasks/${task.id}/verify`)
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
                    } else {
                        // Відображаємо помилку
                        showMessage(response.message || 'Не вдалося перевірити виконання завдання', 'error');
                    }
                })
                .catch(error => {
                    console.error('Помилка при перевірці завдання:', error);
                    showMessage('Сталася помилка при спробі перевірити завдання', 'error');

                    // Оновлюємо відображення завдання
                    refreshTaskDisplay(task.id);
                });
        }
    }

    /**
     * Оновлення відображення конкретного завдання
     */
    function refreshTaskDisplay(taskId) {
        // Очищаємо таймер для цього завдання
        if (timers[taskId]) {
            clearInterval(timers[taskId]);
            timers[taskId] = null;
        }

        // Якщо є TaskManager, використовуємо його метод
        if (window.TaskManager && window.TaskManager.refreshTaskDisplay) {
            window.TaskManager.refreshTaskDisplay(taskId);
            return;
        }

        // Знаходимо завдання в DOM
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Робимо новий запит для отримання актуальних даних
        if (window.API) {
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
                        taskElement.parentNode.replaceChild(newTaskElement, taskElement);
                    }
                }
            })
            .catch(error => {
                console.error('Помилка при оновленні відображення завдання:', error);
            });
        }
    }

    /**
     * Показати анімацію отримання винагороди
     */
    function showRewardAnimation(reward) {
        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(reward);
            return;
        }

        // Інакше робимо просту анімацію
        const rewardAmount = reward.amount;
        const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
        animationElement.textContent = `+${rewardAmount} ${rewardType}`;

        // Додаємо до body
        document.body.appendChild(animationElement);

        // Запускаємо анімацію
        setTimeout(() => {
            animationElement.classList.add('show');

            // Видаляємо після завершення
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
     */
    function updateUserBalance(reward) {
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                userTokensElement.textContent = (currentBalance + reward.amount).toFixed(2);
                userTokensElement.classList.add('highlight');
                setTimeout(() => {
                    userTokensElement.classList.remove('highlight');
                }, 2000);
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                userCoinsElement.textContent = currentBalance + reward.amount;
                userCoinsElement.classList.add('highlight');
                setTimeout(() => {
                    userCoinsElement.classList.remove('highlight');
                }, 2000);
            }
        }
    }

    /**
     * Показати повідомлення
     */
    function showMessage(message, type = 'info') {
        // Якщо є компонент сповіщень, використовуємо його
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

        // Інакше робимо просте сповіщення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            // Встановлюємо текст
            toastElement.textContent = message;

            // Встановлюємо стиль в залежності від типу
            toastElement.className = 'toast-message';
            if (type === 'error') {
                toastElement.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
            } else if (type === 'success') {
                toastElement.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
            } else {
                toastElement.style.background = 'linear-gradient(135deg, #1A1A2E, #0F3460)';
            }

            // Показуємо сповіщення
            toastElement.classList.add('show');

            // Автоматично приховуємо через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.style.background = 'linear-gradient(135deg, #1A1A2E, #0F3460)';
                }, 300);
            }, 3000);
        } else {
            // Якщо елемент toast відсутній, використовуємо стандартний alert
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
     * Очищення всіх таймерів при виході з модуля
     */
    function cleanup() {
        // Очищаємо всі таймери
        for (const taskId in timers) {
            if (timers[taskId]) {
                clearInterval(timers[taskId]);
                timers[taskId] = null;
            }
        }
    }

    // Публічний API модуля
    return {
        create,
        refreshTaskDisplay,
        handleStartTask,
        handleVerifyTask,
        cleanup
    };
})();