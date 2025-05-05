/**
 * TaskCard - базовий компонент для відображення картки завдання
 *
 * Відповідає за:
 * - Відображення спільних елементів для всіх типів завдань
 * - Взаємодію з TaskManager та іншими сервісами
 * - Відображення статусу, винагороди та прогресу
 */

window.TaskCard = (function() {
    // DOM шаблон для карточки завдання
    const TEMPLATE = `
        <div class="task-header">
            <div class="task-title"></div>
            <div class="task-reward"></div>
        </div>
        <div class="task-description"></div>
        <div class="task-progress-container"></div>
        <div class="task-action"></div>
    `;

    /**
     * Створення базової картки завдання
     * @param {Object} task - Дані завдання
     * @param {Object} progress - Прогрес виконання
     * @param {Object} options - Додаткові налаштування
     * @returns {HTMLElement} DOM елемент картки
     */
    function create(task, progress, options = {}) {
        if (!task || !task.id) {
            console.error('TaskCard: Отримано некоректні дані завдання');
            return document.createElement('div');
        }

        const isCompleted = progress && progress.status === 'completed';
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = task.type || 'default';

        // Додаємо базову структуру
        taskElement.innerHTML = TEMPLATE;

        // Заповнюємо основні елементи
        fillTaskContent(taskElement, task, progress, options);

        // Налаштовуємо статус, класи та обробники подій
        setupTaskStatus(taskElement, task, progress);

        return taskElement;
    }

    /**
     * Заповнення контенту картки завдання
     */
    function fillTaskContent(taskElement, task, progress, options) {
        // Заголовок
        const titleElement = taskElement.querySelector('.task-title');
        if (titleElement) {
            titleElement.textContent = task.title || '';
        }

        // Опис
        const descriptionElement = taskElement.querySelector('.task-description');
        if (descriptionElement) {
            descriptionElement.textContent = task.description || '';
        }

        // Винагорода
        const rewardElement = taskElement.querySelector('.task-reward');
        if (rewardElement && task.reward_amount) {
            const isCompleted = progress && progress.status === 'completed';

            if (isCompleted) {
                rewardElement.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            } else {
                const rewardType = task.reward_type === 'tokens' ? '$WINIX' : 'жетонів';
                rewardElement.innerHTML = `${task.reward_amount} <span class="token-symbol">${rewardType}</span>`;
            }
        }

        // Додаємо прогрес, якщо потрібно
        if (task.target_value > 1) {
            const progressContainer = taskElement.querySelector('.task-progress-container');
            if (progressContainer && window.TaskProgress) {
                window.TaskProgress.render(progressContainer, task, progress);
            }
        }

        // Додаємо кнопки дій
        setupTaskActions(taskElement, task, progress, options);
    }

    /**
     * Налаштування статусу картки завдання
     */
    function setupTaskStatus(taskElement, task, progress) {
        // Визначаємо статус завдання
        const isCompleted = progress && progress.status === 'completed';
        const isExpired = task.end_date && new Date(task.end_date) <= new Date();

        // Додаємо відповідні класи
        if (isCompleted) {
            taskElement.classList.add('completed');
        } else if (isExpired) {
            taskElement.classList.add('expired');
        }

        // Додаємо спеціальні класи залежно від типу
        if (task.type) {
            taskElement.classList.add(`${task.type}-task`);
        }
    }

    /**
     * Налаштування кнопок дій для завдання
     */
    function setupTaskActions(taskElement, task, progress, options) {
        const actionContainer = taskElement.querySelector('.task-action');
        if (!actionContainer) return;

        const isCompleted = progress && progress.status === 'completed';
        const isExpired = task.end_date && new Date(task.end_date) <= new Date();

        // Очищаємо контейнер кнопок
        actionContainer.innerHTML = '';

        // Для завершених завдань показуємо лише статус
        if (isCompleted) {
            actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            return;
        }

        // Для прострочених завдань показуємо відповідний статус
        if (isExpired) {
            actionContainer.innerHTML = '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
            return;
        }

        // Визначаємо, який статус у прогресу завдання
        const needsVerification = progress && (progress.status === 'started' || progress.status === 'ready_to_verify');

        // Якщо завдання потребує перевірки, додаємо кнопку "Перевірити"
        if (needsVerification) {
            const verifyBtn = document.createElement('button');
            verifyBtn.className = 'action-button verify-button';
            verifyBtn.dataset.action = 'verify';
            verifyBtn.dataset.taskId = task.id;
            verifyBtn.setAttribute('data-lang-key', 'earn.verify');
            verifyBtn.textContent = 'Перевірити';

            verifyBtn.addEventListener('click', function(event) {
                event.preventDefault();
                if (window.TaskManager && window.TaskManager.verifyTask) {
                    window.TaskManager.verifyTask(task.id);
                }
            });

            actionContainer.appendChild(verifyBtn);
        }
        // Інакше додаємо кнопку "Виконати" / "Почати"
        else {
            const startBtn = document.createElement('button');
            startBtn.className = 'action-button';
            startBtn.dataset.action = 'start';
            startBtn.dataset.taskId = task.id;
            startBtn.setAttribute('data-lang-key', `earn.${task.action_type || 'start'}`);
            startBtn.textContent = task.action_label || 'Виконати';

            startBtn.addEventListener('click', function(event) {
                event.preventDefault();
                if (window.TaskManager && window.TaskManager.startTask) {
                    window.TaskManager.startTask(task.id);
                }
            });

            actionContainer.appendChild(startBtn);

            // Якщо дозволено перевірку, додаємо і кнопку "Перевірити"
            if (options.allowVerification) {
                const verifyBtn = document.createElement('button');
                verifyBtn.className = 'action-button verify-button';
                verifyBtn.dataset.action = 'verify';
                verifyBtn.dataset.taskId = task.id;
                verifyBtn.setAttribute('data-lang-key', 'earn.verify');
                verifyBtn.textContent = 'Перевірити';

                verifyBtn.addEventListener('click', function(event) {
                    event.preventDefault();
                    if (window.TaskManager && window.TaskManager.verifyTask) {
                        window.TaskManager.verifyTask(task.id);
                    }
                });

                actionContainer.appendChild(verifyBtn);
            }
        }
    }

    /**
     * Оновлення статусу картки завдання
     */
    function updateStatus(taskElement, status) {
        if (!taskElement) return;

        const statusClasses = ['loading', 'completed', 'error', 'in-progress', 'ready-to-verify', 'expired'];

        // Видаляємо всі статусні класи
        statusClasses.forEach(cls => {
            taskElement.classList.remove(cls);
        });

        // Додаємо відповідний клас
        if (status) {
            taskElement.classList.add(status);
        }

        // Оновлюємо вміст елементу дій
        updateActionStatus(taskElement, status);
    }

    /**
     * Оновлення елементу дій відповідно до статусу
     */
    function updateActionStatus(taskElement, status) {
        const actionElement = taskElement.querySelector('.task-action');
        if (!actionElement) return;

        const taskId = taskElement.dataset.taskId;

        switch (status) {
            case 'completed':
                actionElement.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
                break;

            case 'loading':
                actionElement.innerHTML = `
                    <div class="loading-indicator">
                        <div class="spinner"></div>
                        <span data-lang-key="earn.verifying">Перевірка...</span>
                    </div>
                `;
                break;

            case 'ready-to-verify':
                actionElement.innerHTML = `
                    <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
                `;
                // Відновлюємо обробники подій
                const verifyBtn = actionElement.querySelector('.verify-button');
                if (verifyBtn) {
                    verifyBtn.addEventListener('click', function(event) {
                        event.preventDefault();
                        if (window.TaskManager && window.TaskManager.verifyTask) {
                            window.TaskManager.verifyTask(taskId);
                        }
                    });
                }
                break;

            case 'expired':
                actionElement.innerHTML = '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
                break;

            default:
                // Базовий статус - кнопка "Виконати"
                actionElement.innerHTML = `
                    <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.start">Виконати</button>
                `;
                // Відновлюємо обробники подій
                const startBtn = actionElement.querySelector('.action-button');
                if (startBtn) {
                    startBtn.addEventListener('click', function(event) {
                        event.preventDefault();
                        if (window.TaskManager && window.TaskManager.startTask) {
                            window.TaskManager.startTask(taskId);
                        }
                    });
                }
                break;
        }
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

    // Публічний API
    return {
        create,
        updateStatus,
        escapeHtml
    };
})();