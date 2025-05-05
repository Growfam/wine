/**
 * PartnerRenderer - рендерер для партнерських завдань
 *
 * Відповідає за:
 * - Безпечне відображення партнерських завдань
 * - Інтеграцію з CSRF захистом для партнерських переходів
 * - Безпечну обробку партнерських посилань
 */

window.PartnerRenderer = (function() {
    // Налаштування безпеки для партнерських доменів
    const ALLOWED_DOMAINS = [
        'winix.com',
        'winix.io',
        'winix-partners.com',
        't.me',
        'twitter.com',
        'discord.gg',
        'exchange.example.com',
        'coinvote.cc'
    ];

    // Блоковані схеми URL
    const BLOCKED_SCHEMES = [
        'data:',
        'file:',
        'ftp:',
        'ws:',
        'wss:',
        'javascript:',
        'vbscript:',
        'blob:'
    ];

    // Кеш для елементів завдань
    const taskElements = new Map();

    // CSRF токени
    const csrfTokens = new Map();

    /**
     * Створення елементу партнерського завдання
     * @param {Object} task - Модель завдання
     * @param {Object} progress - Прогрес виконання
     * @returns {HTMLElement} DOM елемент завдання
     */
    function render(task, progress) {
        // Перевіряємо валідність даних
        if (!task || !task.id) {
            console.error('PartnerRenderer: Отримано некоректні дані завдання');
            return document.createElement('div');
        }

        // Базові опції для TaskCard
        const options = {
            customClass: 'partner-task',
            allowVerification: true
        };

        // Перевіряємо URL на безпеку
        let safeUrl = null;
        if (task.action_url) {
            safeUrl = isUrlSafe(task.action_url) ? task.action_url : null;
        }

        // Створюємо базову картку через TaskCard
        let taskElement;

        if (window.TaskCard && window.TaskCard.create) {
            taskElement = window.TaskCard.create(task, progress, options);

            // Додаємо атрибути для партнерського завдання
            taskElement.dataset.taskType = 'partner';

            // Якщо є партнер, додаємо його дані
            if (task.partner_name) {
                taskElement.dataset.partnerName = task.partner_name;
            }

            // Якщо є безпечний URL, додаємо його
            if (safeUrl) {
                taskElement.dataset.actionUrl = safeUrl;
            }
        } else {
            // Запасний варіант, якщо TaskCard недоступний
            taskElement = createFallbackElement(task, progress, safeUrl);
        }

        // Додаємо специфічні елементи для партнерського завдання
        enhanceWithPartnerFeatures(taskElement, task, progress, safeUrl);

        // Зберігаємо елемент у кеші
        taskElements.set(task.id, taskElement);

        return taskElement;
    }

    /**
     * Створення запасного елемента, якщо TaskCard недоступний
     */
    function createFallbackElement(task, progress, safeUrl) {
        const isCompleted = progress && progress.status === 'completed';
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item partner-task';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = 'partner';

        if (task.partner_name) {
            taskElement.dataset.partnerName = task.partner_name;
        }

        if (safeUrl) {
            taskElement.dataset.actionUrl = safeUrl;
        }

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
     * Додавання специфічних елементів для партнерського завдання
     */
    function enhanceWithPartnerFeatures(taskElement, task, progress, safeUrl) {
        // Додаємо мітку партнера, якщо вказано
        if (task.partner_name) {
            const partnerLabel = document.createElement('div');
            partnerLabel.className = 'partner-label';
            partnerLabel.textContent = `Партнер: ${escapeHtml(task.partner_name)}`;

            // Додаємо мітку на початок елемента
            if (taskElement.firstChild) {
                taskElement.insertBefore(partnerLabel, taskElement.firstChild);
            } else {
                taskElement.appendChild(partnerLabel);
            }
        }

        // Додаємо інформацію про URL, якщо він безпечний
        if (safeUrl) {
            // Безпечно форматуємо URL для відображення
            let displayUrl = '';
            try {
                const urlObj = new URL(safeUrl);
                displayUrl = urlObj.hostname;
            } catch (e) {
                displayUrl = 'partner-site';
            }

            const urlInfo = document.createElement('div');
            urlInfo.className = 'partner-url-info';
            urlInfo.innerHTML = `
                <span class="partner-site-label">Сайт партнера:</span> 
                <span class="partner-site-domain">${escapeHtml(displayUrl)}</span>
            `;

            // Додаємо інформацію в кінець елемента
            taskElement.appendChild(urlInfo);
        }

        // Налаштовуємо кнопки дій
        setupActionButtons(taskElement, task, progress);
    }

    /**
     * Налаштування кнопок дій для завдання
     */
    function setupActionButtons(taskElement, task, progress) {
        const actionContainer = taskElement.querySelector('.task-action');
        if (!actionContainer) return;

        const isCompleted = progress && progress.status === 'completed';

        // Якщо завдання завершено, показуємо лише статус
        if (isCompleted) {
            actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            return;
        }

        // Створюємо кнопку "Виконати"
        const startBtn = document.createElement('button');
        startBtn.className = 'action-button';
        startBtn.dataset.action = 'start';
        startBtn.dataset.taskId = task.id;
        startBtn.setAttribute('data-lang-key', `earn.${task.action_type || 'start'}`);
        startBtn.textContent = task.action_label || 'Виконати';

        // Додаємо обробник події
        startBtn.addEventListener('click', function(event) {
            event.preventDefault();
            handleStartTask(task, taskElement);
        });

        // Додаємо кнопку до контейнера
        actionContainer.appendChild(startBtn);

        // Додаємо кнопку "Перевірити"
        const verifyBtn = document.createElement('button');
        verifyBtn.className = 'action-button verify-button';
        verifyBtn.dataset.action = 'verify';
        verifyBtn.dataset.taskId = task.id;
        verifyBtn.setAttribute('data-lang-key', 'earn.verify');
        verifyBtn.textContent = 'Перевірити';

        // Додаємо обробник події
        verifyBtn.addEventListener('click', function(event) {
            event.preventDefault();
            handleVerifyTask(task, taskElement);
        });

        // Додаємо кнопку до контейнера
        actionContainer.appendChild(verifyBtn);
    }

    /**
     * Обробка початку виконання завдання
     */
    function handleStartTask(task, taskElement) {
        // Показуємо підтвердження переходу на сайт партнера
        if (task.action_url && task.partner_name) {
            if (confirm(`Ви будете перенаправлені на сайт партнера "${task.partner_name || 'WINIX'}". Продовжити?`)) {
                // Генеруємо CSRF токен
                const csrfToken = generateCsrfToken(task.id);

                // Додаємо CSRF токен до URL
                let safeUrl = task.action_url;
                try {
                    const urlObj = new URL(safeUrl);

                    // Додаємо основні параметри
                    urlObj.searchParams.append('csrf_token', csrfToken);
                    urlObj.searchParams.append('task_id', task.id);
                    urlObj.searchParams.append('ts', Date.now());

                    safeUrl = urlObj.toString();

                    // Додаткова перевірка безпеки модифікованого URL
                    if (!isUrlSafe(safeUrl)) {
                        throw new Error('Модифікований URL не пройшов перевірку безпеки');
                    }
                } catch (e) {
                    console.error('Помилка при додаванні параметрів до URL:', e);
                    showMessage('Не вдалося безпечно обробити URL партнера', 'error');
                    return;
                }

                // Відкриваємо URL у новому вікні з налаштуваннями безпеки
                const windowFeatures = 'noopener,noreferrer';
                const newWindow = window.open(safeUrl, '_blank', windowFeatures);

                // Додаткова перевірка, чи відкрилося нове вікно
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    showMessage('Браузер заблокував спливаюче вікно. Дозвольте спливаючі вікна для цього сайту.', 'error');
                    return;
                }

                // Додаткова безпека - розриваємо зв'язок з відкритим вікном
                newWindow.opener = null;

                // Змінюємо відображення кнопок
                if (taskElement) {
                    const actionContainer = taskElement.querySelector('.task-action');
                    if (actionContainer) {
                        actionContainer.innerHTML = `
                            <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>
                        `;

                        // Оновлюємо обробник
                        const verifyBtn = actionContainer.querySelector('.verify-button');
                        if (verifyBtn) {
                            verifyBtn.addEventListener('click', function(event) {
                                event.preventDefault();
                                handleVerifyTask(task, taskElement);
                            });
                        }
                    }
                }

                // Викликаємо API для запуску завдання
                if (window.TaskManager && window.TaskManager.startTask) {
                    window.TaskManager.startTask(task.id);
                }

                showMessage('Завдання розпочато! Виконайте необхідні дії на сайті партнера.', 'success');
            }
        } else {
            // Якщо немає URL, просто запускаємо завдання
            if (window.TaskManager && window.TaskManager.startTask) {
                window.TaskManager.startTask(task.id);
            }
        }
    }

    /**
     * Обробник перевірки виконання завдання
     */
    function handleVerifyTask(task, taskElement) {
        // Оновлюємо відображення кнопки (показуємо індикатор завантаження)
        if (taskElement) {
            const actionContainer = taskElement.querySelector('.task-action');
            if (actionContainer) {
                actionContainer.innerHTML = `
                    <div class="loading-indicator">
                        <div class="spinner"></div>
                        <span data-lang-key="earn.verifying">Перевірка...</span>
                    </div>
                `;
            }
        }

        // Викликаємо TaskManager для перевірки
        if (window.TaskManager && window.TaskManager.verifyTask) {
            window.TaskManager.verifyTask(task.id);
        } else {
            // Інакше симулюємо перевірку для демонстрації
            setTimeout(() => {
                const isSuccess = Math.random() > 0.2; // 80% успіху

                if (isSuccess) {
                    // Відображаємо успішне виконання
                    if (taskElement) {
                        taskElement.classList.add('completed');

                        const actionContainer = taskElement.querySelector('.task-action');
                        if (actionContainer) {
                            actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
                        }
                    }

                    showMessage('Завдання успішно виконано!', 'success');

                    // Симулюємо винагороду
                    const reward = {
                        type: task.reward_type || 'tokens',
                        amount: task.reward_amount || 50
                    };

                    // Показуємо анімацію винагороди
                    if (window.RewardBadge && window.RewardBadge.showAnimation) {
                        window.RewardBadge.showAnimation(reward);
                    }
                } else {
                    // Відображаємо помилку
                    if (taskElement) {
                        const actionContainer = taskElement.querySelector('.task-action');
                        if (actionContainer) {
                            actionContainer.innerHTML = `
                                <button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.retry">Спробувати знову</button>
                                <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>
                            `;

                            // Оновлюємо обробники
                            setupActionButtons(taskElement, task, null);
                        }
                    }

                    showMessage('Не вдалося перевірити виконання завдання', 'error');
                }
            }, 1500);
        }
    }

    /**
     * Генерація CSRF токену
     */
    function generateCsrfToken(taskId) {
        // Генеруємо випадковий токен
        const token = generateRandomString(32);
        const timestamp = Date.now();

        // Зберігаємо токен
        csrfTokens.set(taskId, {
            token: token,
            timestamp: timestamp,
            expires: timestamp + (30 * 60 * 1000) // 30 хвилин
        });

        return token;
    }

    /**
     * Генерація випадкового рядка
     */
    function generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';

        // Використовуємо криптографічно стійкий ГВЧ, якщо доступний
        if (window.crypto && window.crypto.getRandomValues) {
            const values = new Uint32Array(length);
            window.crypto.getRandomValues(values);

            for (let i = 0; i < length; i++) {
                result += characters.charAt(values[i] % characters.length);
            }
        } else {
            // Запасний варіант
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }
        }

        return result;
    }

    /**
     * Перевірка безпеки URL
     */
    function isUrlSafe(url) {
        try {
            // Перевірка, чи URL не порожній
            if (!url || typeof url !== 'string') {
                return false;
            }

            // Перевірка базового формату URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return false;
            }

            // Перевірка на блоковані схеми
            for (const scheme of BLOCKED_SCHEMES) {
                if (url.toLowerCase().includes(scheme)) {
                    return false;
                }
            }

            // Парсимо URL для аналізу домену
            let urlObj;
            try {
                urlObj = new URL(url);
            } catch (e) {
                return false;
            }

            const domain = urlObj.hostname;

            // Перевірка домену на основі білого списку
            const isDomainAllowed = ALLOWED_DOMAINS.some(allowedDomain =>
                domain === allowedDomain || domain.endsWith('.' + allowedDomain)
            );

            if (!isDomainAllowed) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Оновлення відображення конкретного завдання
     */
    function refreshTaskDisplay(taskId) {
        // Якщо є TaskManager, делегуємо обробку йому
        if (window.TaskManager && window.TaskManager.refreshTaskDisplay) {
            window.TaskManager.refreshTaskDisplay(taskId);
            return;
        }

        // Інакше використовуємо локальне оновлення
        const taskElement = taskElements.get(taskId);
        if (!taskElement) return;

        // Оновлюємо на основі даних прогресу
        let progress = null;

        if (window.TaskManager && window.TaskManager.getTaskProgress) {
            progress = window.TaskManager.getTaskProgress(taskId);
        }

        const isCompleted = progress && progress.status === 'completed';

        // Оновлюємо класи елемента
        if (isCompleted) {
            taskElement.classList.add('completed');
        } else {
            taskElement.classList.remove('completed');
        }

        // Оновлюємо елемент дій
        const actionContainer = taskElement.querySelector('.task-action');
        if (actionContainer) {
            if (isCompleted) {
                actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            } else {
                // Отримуємо завдання
                let task = null;

                if (window.TaskManager && window.TaskManager.findTaskById) {
                    task = window.TaskManager.findTaskById(taskId);
                }

                if (!task) {
                    task = {
                        id: taskId,
                        partner_name: taskElement.dataset.partnerName,
                        action_url: taskElement.dataset.actionUrl
                    };
                }

                // Встановлюємо нові кнопки дій
                setupActionButtons(taskElement, task, progress);
            }
        }
    }

    /**
     * Показати повідомлення
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

        // Використовуємо showToast, якщо доступний
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        // Інакше використовуємо стандартний alert
        alert(message);
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
        render,
        refreshTaskDisplay,
        isUrlSafe
    };
})();