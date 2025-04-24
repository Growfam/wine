/**
 * Progress - модуль для відстеження прогресу виконання завдань
 * Відповідає за:
 * - Оновлення прогресу завдань
 * - Відображення прогрес-барів
 * - Збереження стану прогресу
 */

window.TaskProgress = (function() {
    // Приватні змінні модуля
    let userProgress = {};
    let isInitialized = false;

    /**
     * Ініціалізація модуля прогресу
     */
    function init() {
        console.log('TaskProgress: Ініціалізація модуля прогресу');

        // Отримуємо початковий прогрес
        loadProgress()
            .then(progress => {
                userProgress = progress;
                isInitialized = true;

                // Оновлюємо всі прогрес-бари
                updateAllProgressBars();

                // Відправляємо подію про завершення ініціалізації
                document.dispatchEvent(new CustomEvent('progress-initialized', {
                    detail: { progress: userProgress }
                }));
            })
            .catch(error => {
                console.error('Помилка ініціалізації прогресу:', error);
            });

        // Підписуємося на події оновлення прогресу
        document.addEventListener('task-progress-updated', handleProgressUpdate);
    }

    /**
     * Завантаження прогресу користувача
     */
    async function loadProgress() {
        // Якщо є API, використовуємо його
        if (window.API) {
            try {
                const response = await window.API.get('/quests/user-progress');

                if (response.success) {
                    return response.data || {};
                } else {
                    throw new Error(response.message || 'Не вдалося завантажити прогрес');
                }
            } catch (error) {
                console.warn('Помилка завантаження прогресу із API:', error);
                // Якщо API недоступне, використовуємо збережений прогрес
                return loadLocalProgress();
            }
        } else {
            // Якщо API недоступне, використовуємо збережений прогрес
            return loadLocalProgress();
        }
    }

    /**
     * Завантаження прогресу з локального сховища
     */
    function loadLocalProgress() {
        try {
            const storedProgress = localStorage.getItem('winix_task_progress');
            return storedProgress ? JSON.parse(storedProgress) : {};
        } catch (error) {
            console.warn('Помилка завантаження прогресу з локального сховища:', error);
            return {};
        }
    }

    /**
     * Збереження прогресу в локальне сховище
     */
    function saveLocalProgress() {
        try {
            localStorage.setItem('winix_task_progress', JSON.stringify(userProgress));
            return true;
        } catch (error) {
            console.warn('Помилка збереження прогресу в локальне сховище:', error);
            return false;
        }
    }

    /**
     * Обробник події оновлення прогресу
     */
    function handleProgressUpdate(event) {
        const { taskId, progressData } = event.detail;

        if (!taskId || !progressData) return;

        // Оновлюємо прогрес
        updateTaskProgress(taskId, progressData);
    }

    /**
     * Оновлення прогресу конкретного завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     */
    function updateTaskProgress(taskId, progressData) {
        // Оновлюємо прогрес в пам'яті
        userProgress[taskId] = progressData;

        // Зберігаємо у локальне сховище
        saveLocalProgress();

        // Оновлюємо відображення прогресу
        updateTaskProgressBar(taskId, progressData);

        // Якщо завдання виконано, відправляємо подію
        if (progressData.status === 'completed') {
            document.dispatchEvent(new CustomEvent('task-completed', {
                detail: { taskId, progressData }
            }));
        }
    }

    /**
     * Оновлення прогрес-бару завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     */
    function updateTaskProgressBar(taskId, progressData) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Знаходимо елементи прогресу
        const progressBar = taskElement.querySelector('.progress-fill');
        const progressText = taskElement.querySelector('.progress-text');

        // Знаходимо цільове значення
        const targetValue = getTaskTargetValue(taskId);

        if (progressBar && targetValue > 0) {
            // Обчислюємо відсоток виконання
            const progressValue = progressData.progress_value || 0;
            const progressPercent = Math.min(100, Math.round((progressValue / targetValue) * 100));

            // Оновлюємо ширину прогрес-бару з анімацією
            progressBar.style.transition = 'width 0.5s ease-out';
            progressBar.style.width = `${progressPercent}%`;

            // Додаємо клас для анімації
            progressBar.classList.add('pulse');
            setTimeout(() => {
                progressBar.classList.remove('pulse');
            }, 1000);

            // Оновлюємо текст прогресу, якщо він є
            if (progressText) {
                progressText.textContent = `${progressValue}/${targetValue} ${getTaskProgressLabel(taskId) || ''}`;
            }
        }

        // Якщо завдання виконано, оновлюємо його відображення
        if (progressData.status === 'completed') {
            updateCompletedTaskView(taskElement);
        }
    }

    /**
     * Оновлення всіх прогрес-барів
     */
    function updateAllProgressBars() {
        // Для кожного завдання в прогресі
        for (const taskId in userProgress) {
            updateTaskProgressBar(taskId, userProgress[taskId]);
        }
    }

    /**
     * Оновлення відображення виконаного завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     */
    function updateCompletedTaskView(taskElement) {
        // Додаємо клас виконаного завдання
        taskElement.classList.add('completed');

        // Замінюємо кнопки на мітку "Виконано"
        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            actionElement.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
        }

        // Додаємо мітку "Виконано" в хедер
        const headerElement = taskElement.querySelector('.task-header');
        if (headerElement) {
            // Видаляємо винагороду, якщо вона є
            const rewardElement = headerElement.querySelector('.task-reward');
            if (rewardElement) {
                rewardElement.remove();
            }

            // Додаємо мітку "Виконано", якщо її ще немає
            if (!headerElement.querySelector('.completed-label')) {
                const completedLabel = document.createElement('div');
                completedLabel.className = 'completed-label';
                completedLabel.setAttribute('data-lang-key', 'earn.completed');
                completedLabel.textContent = 'Виконано';
                headerElement.appendChild(completedLabel);
            }
        }
    }

    /**
     * Отримання цільового значення прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {number} Цільове значення
     */
    function getTaskTargetValue(taskId) {
        // Знаходимо елемент завдання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return 1;

        // Пробуємо отримати цільове значення з атрибуту
        const targetAttr = taskElement.getAttribute('data-target-value');
        if (targetAttr) {
            return parseInt(targetAttr) || 1;
        }

        // За замовчуванням повертаємо 1
        return 1;
    }

    /**
     * Отримання мітки прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {string} Мітка прогресу
     */
    function getTaskProgressLabel(taskId) {
        // Знаходимо елемент завдання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return '';

        // Пробуємо отримати мітку прогресу з атрибуту
        return taskElement.getAttribute('data-progress-label') || '';
    }

    /**
     * Отримання прогресу користувача
     * @returns {Object} Прогрес користувача
     */
    function getUserProgress() {
        return userProgress;
    }

    /**
     * Отримання прогресу конкретного завдання
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Прогрес завдання або null, якщо його немає
     */
    function getTaskProgress(taskId) {
        return userProgress[taskId] || null;
    }

    /**
     * Перевірка, чи завдання виконано
     * @param {string} taskId - ID завдання
     * @returns {boolean} Чи виконано завдання
     */
    function isTaskCompleted(taskId) {
        return userProgress[taskId] && userProgress[taskId].status === 'completed';
    }

    /**
     * Скидання прогресу всіх завдань
     */
    function resetAllProgress() {
        userProgress = {};
        saveLocalProgress();

        // Оновлюємо відображення
        updateAllProgressBars();

        // Відправляємо подію про скидання прогресу
        document.dispatchEvent(new CustomEvent('progress-reset'));
    }

    // Публічний API модуля
    return {
        init,
        updateTaskProgress,
        getUserProgress,
        getTaskProgress,
        isTaskCompleted,
        resetAllProgress
    };
})();