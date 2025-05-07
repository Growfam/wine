/**
 * Limited - рендерер для лімітованих за часом завдань
 *
 * Відповідає за:
 * - Відображення лімітованих завдань з таймером
 * - Інтеграцію з системою таймерів
 * - Рендеринг специфічних елементів для лімітованих завдань
 *
 * @version 2.1.0
 */

import BaseRenderer, { TASK_STATUS } from '../base.js';
import dependencyContainer from '../../../utils';

/**
 * Рендерер для лімітованих завдань
 */
class Limited extends BaseRenderer {
    /**
     * Конструктор Limited
     */
    constructor() {
        super('LimitedRenderer');

        // Додаткові сервіси, специфічні для лімітованих завдань
        this.timeUtils = null;
    }

    /**
     * Ініціалізація рендерера
     */
    initialize() {
        if (this.initialized) return;

        // Викликаємо базову ініціалізацію
        super.initialize();

        // Отримуємо TimeUtils з контейнера залежностей
        this.timeUtils = dependencyContainer.resolve('TimeUtils');

        this.log('info', 'Рендерер лімітованих завдань ініціалізовано');
    }

    /**
     * Отримання опцій для TaskCard
     * @param {Object} task - Завдання
     * @returns {Object} Опції для TaskCard
     */
    getTaskCardOptions(task) {
        return {
            customClass: 'limited-task',
            allowVerification: true
        };
    }

    /**
     * Додавання атрибутів до елемента завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     * @param {Object} task - Завдання
     * @param {Object} options - Опції рендерингу
     */
    addTaskAttributes(taskElement, task, options) {
        // Викликаємо базовий метод
        super.addTaskAttributes(taskElement, task, options);

        // Додаємо специфічні атрибути для лімітованих завдань
        if (task.end_date) {
            taskElement.dataset.endDate = task.end_date;
        }
    }

    /**
     * Додавання специфічних елементів для лімітованого завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     * @param {Object} task - Завдання
     * @param {Object} progress - Прогрес
     * @param {Object} options - Опції рендерингу
     */
    enhanceTaskElement(taskElement, task, progress, options) {
        // Перевіряємо кінцеву дату і розраховуємо статус
        let isExpired = false;

        if (task.end_date) {
            let endDate;

            // Парсимо дату з використанням TimeUtils, якщо доступний
            if (this.timeUtils && this.timeUtils.parseDate) {
                endDate = this.timeUtils.parseDate(task.end_date);
            } else {
                // Запасний варіант
                endDate = new Date(task.end_date);
            }

            // Перевіряємо, чи не закінчився термін
            const now = new Date();
            isExpired = endDate <= now;

            // Якщо термін не закінчився і завдання не виконане, додаємо таймер
            const isCompleted = progress && progress.status === 'completed';

            if (!isExpired && !isCompleted) {
                this.addCountdownTimer(taskElement, task);
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

                // Встановлюємо статус "закінчено"
                this.updateTaskStatus(taskElement, TASK_STATUS.EXPIRED);
            }
        }

        // Додаємо позначку "Limited Time" до заголовка
        const headerElement = taskElement.querySelector('.task-header');
        if (headerElement) {
            const limitedBadge = document.createElement('div');
            limitedBadge.className = 'limited-time-badge';
            limitedBadge.textContent = 'Обмежений час';

            // Додаємо бейдж на початок заголовка
            if (headerElement.firstChild) {
                headerElement.insertBefore(limitedBadge, headerElement.firstChild);
            } else {
                headerElement.appendChild(limitedBadge);
            }
        }

        // Викликаємо базовий метод для встановлення початкового статусу
        // тільки якщо завдання не прострочене
        if (!isExpired) {
            super.enhanceTaskElement(taskElement, task, progress, options);
        }
    }

    /**
     * Додавання таймера зворотного відліку
     * @param {HTMLElement} taskElement - Елемент завдання
     * @param {Object} task - Завдання
     */
    addCountdownTimer(taskElement, task) {
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
        this.initializeTimer(task.id, timerElement);
    }

    /**
     * Ініціалізація таймера
     * @param {string} taskId - ID завдання
     * @param {HTMLElement} timerElement - Елемент таймера
     */
    initializeTimer(taskId, timerElement) {
        // Отримуємо кінцеву дату
        const endDate = timerElement.getAttribute('data-end-date');
        if (!endDate) return;

        // Перевіряємо, чи доступний TimeUtils
        if (!this.timeUtils) {
            // Спроба отримати з контейнера, якщо ще не отримано
            this.timeUtils = dependencyContainer.resolve('TimeUtils');

            // Якщо все ще недоступний, використовуємо запасний варіант
            if (!this.timeUtils) {
                this.log('warn', 'TimeUtils недоступний для створення таймера');
                return this.initializeFallbackTimer(taskId, timerElement, endDate);
            }
        }

        // Функція, що викликається при закінченні часу
        const onTimerComplete = () => {
            const taskElement = this.taskElements.get(taskId);
            if (taskElement) {
                taskElement.classList.add('expired');
                this.updateTaskStatus(taskElement, TASK_STATUS.EXPIRED);
            }
        };

        // Використовуємо TimeUtils для створення таймера
        this.timeUtils.createCountdown({
            element: timerElement,
            endDate: endDate,
            format: 'short',
            onComplete: onTimerComplete
        });
    }

    /**
     * Запасний варіант ініціалізації таймера (якщо TimeUtils недоступний)
     * @param {string} taskId - ID завдання
     * @param {HTMLElement} timerElement - Елемент таймера
     * @param {string} endDateStr - Рядок з кінцевою датою
     */
    initializeFallbackTimer(taskId, timerElement, endDateStr) {
        // Парсимо дату
        const endDate = new Date(endDateStr);
        if (isNaN(endDate.getTime())) return;

        // Функція для оновлення таймера
        const updateTimer = () => {
            const now = new Date();
            const timeLeft = endDate - now;

            if (timeLeft <= 0) {
                // Час вийшов
                timerElement.textContent = 'Закінчено';

                // Знаходимо елемент завдання і оновлюємо його статус
                const taskElement = this.taskElements.get(taskId);
                if (taskElement) {
                    taskElement.classList.add('expired');
                    this.updateTaskStatus(taskElement, TASK_STATUS.EXPIRED);
                }

                clearInterval(timerId);
                return;
            }

            // Форматуємо час
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            let formattedTime;
            if (days > 0) {
                formattedTime = `${days}д ${hours}г`;
            } else if (hours > 0) {
                formattedTime = `${hours}г ${minutes}хв`;
            } else {
                formattedTime = `${minutes}хв ${seconds}с`;
            }

            timerElement.textContent = formattedTime;
        };

        // Запускаємо таймер
        updateTimer();
        const timerId = setInterval(updateTimer, 1000);

        // Зберігаємо ID таймера для можливості очищення
        timerElement.dataset.timerId = timerId;
    }

    /**
     * Обробник запуску завдання
     * @param {string} taskId - ID завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     */
    handleStartTask(taskId, taskElement) {
        // Отримуємо дані завдання
        let task = null;

        if (this.taskSystem && typeof this.taskSystem.findTaskById === 'function') {
            task = this.taskSystem.findTaskById(taskId);
        }

        // Перевіряємо, чи не закінчився термін
        if (task && task.end_date) {
            const endDate = this.timeUtils ?
                this.timeUtils.parseDate(task.end_date) :
                new Date(task.end_date);

            if (endDate <= new Date()) {
                this.showErrorMessage('Термін виконання завдання минув');
                this.updateTaskStatus(taskElement, TASK_STATUS.EXPIRED);
                return;
            }
        }

        // Викликаємо базовий метод
        super.handleStartTask(taskId, taskElement);
    }

    /**
     * Оновлення одного завдання - перевизначаємо для перевірки терміну дії
     * @param {string} taskId - ID завдання
     */
    refreshTaskDisplay(taskId) {
        const taskElement = this.taskElements.get(taskId);
        if (!taskElement) return;

        try {
            // Отримуємо завдання і прогрес
            let task, progress;

            if (this.taskSystem) {
                if (typeof this.taskSystem.findTaskById === 'function') {
                    task = this.taskSystem.findTaskById(taskId);
                }

                if (typeof this.taskSystem.getTaskProgress === 'function') {
                    progress = this.taskSystem.getTaskProgress(taskId);
                }
            }

            // Перевіряємо закінчення терміну
            if (task && task.end_date) {
                const endDate = this.timeUtils ?
                    this.timeUtils.parseDate(task.end_date) :
                    new Date(task.end_date);

                if (endDate <= new Date()) {
                    // Завдання прострочене
                    taskElement.classList.add('expired');
                    this.updateTaskStatus(taskElement, TASK_STATUS.EXPIRED);
                    return;
                }
            }

            // Продовжуємо стандартне оновлення статусу
            super.refreshTaskDisplay(taskId);

        } catch (error) {
            this.log('error', `Помилка при оновленні завдання ${taskId}`, { error });
        }
    }

    /**
     * Очищення ресурсів
     */
    cleanup() {
        // Очищаємо таймери
        this.taskElements.forEach((taskElement, taskId) => {
            const timerElement = taskElement.querySelector('.timer-value');
            if (timerElement && timerElement.dataset.timerId) {
                clearInterval(parseInt(timerElement.dataset.timerId));
            }
        });

        // Викликаємо базовий метод
        super.cleanup();
    }
}

// Створюємо екземпляр рендерера
const limitedRenderer = new Limited();
export default limitedRenderer;