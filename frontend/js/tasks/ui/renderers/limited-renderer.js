/**
 * LimitedRenderer - рендерер для лімітованих за часом завдань
 *
 * Відповідає за:
 * - Відображення лімітованих завдань з таймером
 * - Інтеграцію з системою таймерів
 * - Рендеринг специфічних елементів для лімітованих завдань
 */

window.LimitedRenderer = (function() {
    // Приватні змінні модуля
    const tasks = new Map(); // Зберігає посилання на активні завдання

    /**
     * Створення елементу лімітованого завдання
     * @param {Object} task - Модель завдання
     * @param {Object} progress - Прогрес виконання
     * @returns {HTMLElement} DOM елемент завдання
     */
    function render(task, progress) {
        // Перевіряємо валідність даних
        if (!task || !task.id) {
            console.error('LimitedRenderer: Отримано некоректні дані завдання');
            return document.createElement('div');
        }

        // Базові опції для TaskCard
        const options = {
            customClass: 'limited-task',
            allowVerification: true
        };

        // Створюємо базову картку через TaskCard
        let taskElement;

        if (window.TaskCard && window.TaskCard.create) {
            taskElement = window.TaskCard.create(task, progress, options);
        } else {
            // Запасний варіант, якщо TaskCard недоступний
            taskElement = createFallbackElement(task, progress);
        }

        // Додаємо специфічні елементи для лімітованого завдання
        enhanceWithLimitedFeatures(taskElement, task, progress);

        // Зберігаємо посилання на елемент
        tasks.set(task.id, {
            element: taskElement,
            task: task,
            progress: progress
        });

        return taskElement;
    }

    /**
     * Створення запасного елемента, якщо TaskCard недоступний
     */
    function createFallbackElement(task, progress) {
        const isCompleted = progress && progress.status === 'completed';
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item limited-task';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = 'limited';

        // Наповнюємо базовим контентом
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-reward">${task.reward_amount} ${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</div>
            </div>
            <div class="task-description">${escapeHtml(task.description)}</div>
            <div class="task-progress-container"></div>
            <div class="task-action"></div>
        `;

        // Додаємо клас для завершеного завдання
        if (isCompleted) {
            taskElement.classList.add('completed');
        }

        return taskElement;
    }

    /**
     * Додавання специфічних елементів для лімітованого завдання
     */
    function enhanceWithLimitedFeatures(taskElement, task, progress) {
        // Перевіряємо кінцеву дату і розраховуємо статус
        let isExpired = false;

        if (task.end_date) {
            // Парсимо дату з використанням TimeUtils, якщо доступний
            let endDate;
            if (window.TimeUtils && window.TimeUtils.parseDate) {
                endDate = window.TimeUtils.parseDate(task.end_date);
            } else {
                endDate = new Date(task.end_date);
            }

            // Перевіряємо, чи не закінчився термін
            const now = new Date();
            isExpired = endDate <= now;

            // Якщо термін не закінчився і завдання не виконане, додаємо таймер
            const isCompleted = progress && progress.status === 'completed';

            if (!isExpired && !isCompleted) {
                addCountdownTimer(taskElement, task);
            } else if (isExpired) {
                // Додаємо позначку про закінчення терміну
                taskElement.classList.add('expired');

                // Знаходимо або створюємо контейнер для таймера
                let timerContainer = taskElement.querySelector('.timer-container');

                if (!timerContainer) {
                    timerContainer = document.createElement('div');
                    timerContainer.className = 'timer-container expired';

                    // Додаємо контейнер після заголовка
                    const headerElement = taskElement.querySelector('.task-header');
                    if (headerElement) {
                        headerElement.appendChild(timerContainer);
                    }
                }

                timerContainer.innerHTML = `
                    <span class="timer-icon"></span>
                    <span data-lang-key="earn.expired">Закінчено</span>
                `;
            }
        }
    }

    /**
     * Додавання таймера зворотного відліку
     */
    function addCountdownTimer(taskElement, task) {
        if (!task.end_date) return;

        // Створюємо контейнер для таймера
        const timerContainer = document.createElement('div');
        timerContainer.className = 'timer-container';

        // Створюємо елемент відліку
        const timerElement = document.createElement('span');
        timerElement.className = 'timer-value';
        timerElement.dataset.endDate = task.end_date;
        timerElement.dataset.format = 'short';

        // Додаємо іконку
        const timerIcon = document.createElement('span');
        timerIcon.className = 'timer-icon';

        // Складаємо все разом
        timerContainer.appendChild(timerIcon);
        timerContainer.appendChild(timerElement);

        // Додаємо контейнер після заголовка
        const headerElement = taskElement.querySelector('.task-header');
        if (headerElement) {
            headerElement.appendChild(timerContainer);
        }

        // Ініціалізуємо таймер
        initializeTimer(task.id, timerElement);
    }

    /**
     * Ініціалізація таймера
     */
    function initializeTimer(taskId, timerElement) {
        // Отримуємо кінцеву дату
        const endDate = timerElement.getAttribute('data-end-date');
        if (!endDate) return;

        // Функція, що викликається при закінченні часу
        const onTimerComplete = function() {
            const taskData = tasks.get(taskId);
            if (taskData && taskData.element) {
                taskData.element.classList.add('expired');
                refreshTaskDisplay(taskId);
            }
        };

        // Перевіряємо доступні модулі таймера
        if (window.UI && window.UI.Countdown) {
            window.UI.Countdown.createCountdown({
                element: timerElement,
                endDate: endDate,
                format: 'short',
                onComplete: onTimerComplete
            });
        } else if (window.TimeUtils) {
            // Альтернативний варіант з TimeUtils
            window.TimeUtils.createCountdown({
                element: timerElement,
                endDate: endDate,
                format: 'short',
                onComplete: onTimerComplete
            });
        } else {
            // Простий запасний варіант
            fallbackTimer(timerElement, endDate, onTimerComplete);
        }
    }

    /**
     * Запасний варіант таймера
     */
    function fallbackTimer(timerElement, endDate, onComplete) {
        // Парсимо кінцеву дату
        const endDateTime = new Date(endDate);

        // Початкове відображення
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
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            } else {
                // Оновлюємо відображення
                updateTimerDisplay(timerElement, endDateTime);
            }
        }, 1000);

        // Зберігаємо ID інтервалу для подальшого очищення
        timerElement.dataset.timerId = intervalId;
    }

    /**
     * Оновлення відображення таймера
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
     * Оновлення відображення завдання
     */
    function refreshTaskDisplay(taskId) {
        // Якщо є TaskManager, делегуємо обробку йому
        if (window.TaskManager && window.TaskManager.refreshTaskDisplay) {
            window.TaskManager.refreshTaskDisplay(taskId);
            return;
        }

        // Інакше робимо власне оновлення
        const taskData = tasks.get(taskId);
        if (!taskData) return;

        // Дістаємо актуальні дані
        const task = taskData.task;
        const progress = taskData.progress;

        // Повторно рендеримо завдання
        const newElement = render(task, progress);

        // Замінюємо старий елемент новим
        if (taskData.element && taskData.element.parentNode) {
            taskData.element.parentNode.replaceChild(newElement, taskData.element);
        }

        // Оновлюємо посилання на елемент
        taskData.element = newElement;
        tasks.set(taskId, taskData);
    }

    /**
     * Очищення ресурсів
     */
    function cleanup() {
        // Очищаємо таймери
        tasks.forEach((taskData) => {
            const timerElement = taskData.element.querySelector('.timer-value');
            if (timerElement && timerElement.dataset.timerId) {
                clearInterval(parseInt(timerElement.dataset.timerId));
            }
        });

        // Очищаємо карту завдань
        tasks.clear();
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

    // Підписуємося на подію виходу зі сторінки
    window.addEventListener('beforeunload', cleanup);

    // Публічний API
    return {
        render,
        refreshTaskDisplay,
        cleanup
    };
})();