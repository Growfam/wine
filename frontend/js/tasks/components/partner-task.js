/**
 * PartnerTask - компонент для партнерських завдань
 * Відповідає за:
 * - Створення та відображення партнерських завдань
 * - Обробку взаємодії користувача з партнерськими завданнями
 * - Можливість переходів за партнерськими посиланнями
 */

window.PartnerTask = (function() {
    /**
     * Створення елементу партнерського завдання
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

        // Створюємо основний контейнер завдання
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item partner-task';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = 'partner';

        // Додаємо мітку партнера, якщо вказано
        let partnerLabel = '';
        if (task.partner_name) {
            partnerLabel = `<div class="partner-label">Партнер: ${escapeHtml(task.partner_name)}</div>`;
        }

        // Наповнюємо контент завдання
        taskElement.innerHTML = `
            ${partnerLabel}
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${isCompleted ? 
                  '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                  `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</span></div>`
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
                  `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>
                   <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`
                }
            </div>
        `;

        // Додаємо обробники подій
        if (!isCompleted) {
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
        }

        return taskElement;
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

        // Перед відкриттям партнерського посилання показуємо інформаційне повідомлення
        if (task.action_url) {
            // Показуємо підтвердження переходу
            if (confirm(`Ви будете перенаправлені на сайт партнера "${task.partner_name || 'WINIX'}". Продовжити?`)) {
                window.open(task.action_url, '_blank');

                // Викликаємо API для запуску завдання
                if (window.API) {
                    window.API.post(`/quests/tasks/${task.id}/start`)
                        .then(response => {
                            if (response.success) {
                                // Відображаємо успішне повідомлення
                                showMessage('Завдання розпочато! Виконайте необхідні дії на сайті партнера.', 'success');
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
        } else {
            // Викликаємо API для запуску завдання
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
                window.API.get('/quests/tasks/partners'),
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

            // Встановлюємо клас в залежності від типу
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

    // Публічний API модуля
    return {
        create,
        refreshTaskDisplay,
        handleStartTask,
        handleVerifyTask
    };
})();