/**
 * PartnerTask - компонент для партнерських завдань
 * Відповідає за:
 * - Створення та відображення партнерських завдань
 * - Безпечну обробку взаємодії користувача з партнерськими завданнями
 * - Валідацію та безпечні переходи за партнерськими посиланнями
 * - Захист від CSRF та XSS атак
 */

window.PartnerTask = (function() {
    // Приватні змінні модуля
    const ALLOWED_DOMAINS = [
        'winix.com',
        'winix.io',
        'winix-partners.com',
        't.me',
        'twitter.com',
        'discord.gg',
        'exchange.example.com', // Приклад для тестування
        'coinvote.cc'
    ];

    // Блокований список доменів для додаткової безпеки
    const BLOCKED_DOMAINS = [
        'evil-site.com',
        'malware.org',
        'phishing-example.io'
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

    // Максимальна кількість спроб верифікації
    const MAX_VERIFICATION_ATTEMPTS = 3;

    // Час очікування між спробами верифікації (мс)
    const VERIFICATION_COOLDOWN = 5000;

    // Тривалість CSRF токену (30 хвилин)
    const CSRF_TOKEN_LIFETIME = 30 * 60 * 1000;

    // Дані про спроби верифікації
    const verificationAttempts = {};

    // CSRF токени
    const csrfTokens = {};

    // Зберігання блокованих URL для запобігання повторним спробам
    const blockedUrls = new Set();

    /**
     * Перевірка безпеки URL
     * @param {string} url - URL для перевірки
     * @param {string} partnerName - Назва партнера для логування
     * @returns {boolean} - Результат перевірки
     */
    function isUrlSafe(url, partnerName = 'Невідомий партнер') {
        try {
            // Перевірка, чи URL не порожній
            if (!url || typeof url !== 'string') {
                console.warn(`PartnerTask: Порожній URL від партнера "${partnerName}"`);
                return false;
            }

            // Перевірка на вже заблоковані URL
            if (blockedUrls.has(url)) {
                console.warn(`PartnerTask: URL вже був заблокований раніше від партнера "${partnerName}": ${url}`);
                return false;
            }

            // Перевірка базового формату URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                console.warn(`PartnerTask: Некоректний URL схеми від партнера "${partnerName}": ${url}`);
                blockedUrls.add(url);
                return false;
            }

            // Перевірка на блоковані схеми
            for (const scheme of BLOCKED_SCHEMES) {
                if (url.toLowerCase().includes(scheme)) {
                    console.error(`PartnerTask: Виявлено заборонену схему ${scheme} в URL від партнера "${partnerName}": ${url}`);
                    blockedUrls.add(url);
                    return false;
                }
            }

            // Парсимо URL для аналізу домену
            let urlObj;
            try {
                urlObj = new URL(url);
            } catch (e) {
                console.error(`PartnerTask: Неможливо розпарсити URL від партнера "${partnerName}": ${url}`, e);
                blockedUrls.add(url);
                return false;
            }

            const domain = urlObj.hostname;

            // Перевірка на явно заблоковані домени
            if (BLOCKED_DOMAINS.some(blockedDomain =>
                domain === blockedDomain || domain.endsWith('.' + blockedDomain))) {
                console.error(`PartnerTask: Виявлено заблокований домен від партнера "${partnerName}": ${domain}`);
                blockedUrls.add(url);
                return false;
            }

            // Перевірка домену на основі білого списку
            const isDomainAllowed = ALLOWED_DOMAINS.some(allowedDomain =>
                domain === allowedDomain || domain.endsWith('.' + allowedDomain)
            );

            if (!isDomainAllowed) {
                console.warn(`PartnerTask: Домен не в білому списку від партнера "${partnerName}": ${domain}`);
                blockedUrls.add(url);
                return false;
            }

            // Перевірка наявності підозрілих параметрів в URL
            const suspiciousParams = ['redirect', 'url', 'link', 'goto', 'return', 'returnto', 'returnurl', 'next'];
            for (const param of suspiciousParams) {
                if (urlObj.searchParams.has(param)) {
                    const paramValue = urlObj.searchParams.get(param);
                    // Перевіряємо значення параметра, щоб уникнути open redirect
                    if (paramValue && (
                        paramValue.startsWith('http') ||
                        paramValue.startsWith('//') ||
                        BLOCKED_SCHEMES.some(scheme => paramValue.includes(scheme))
                    )) {
                        console.error(`PartnerTask: Виявлено підозрілий параметр ${param} в URL від партнера "${partnerName}": ${url}`);
                        blockedUrls.add(url);
                        return false;
                    }
                }
            }

            // Додаткова перевірка фрагмента URL
            if (urlObj.hash) {
                const hashContent = urlObj.hash.substring(1);
                // Перевірка на небезпечний контент у хеші
                if (BLOCKED_SCHEMES.some(scheme => hashContent.includes(scheme))) {
                    console.error(`PartnerTask: Виявлено підозрілий фрагмент в URL від партнера "${partnerName}": ${url}`);
                    blockedUrls.add(url);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`PartnerTask: Помилка перевірки URL від партнера "${partnerName}":`, error);
            blockedUrls.add(url);
            return false;
        }
    }

    /**
     * Згенерувати криптографічно стійкий випадковий рядок
     * @param {number} length - Довжина рядка
     * @returns {string} - Випадковий рядок
     */
    function generateSecureRandomString(length = 32) {
        try {
            // Спроба використати сучасні API для криптографічно стійкої генерації
            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint8Array(length);
                window.crypto.getRandomValues(array);
                return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, length);
            }
        } catch (e) {
            console.warn('PartnerTask: Помилка при генерації безпечного випадкового значення:', e);
        }

        // Запасний метод
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result + Date.now().toString(36);
    }

    /**
     * Генерація CSRF токену для взаємодії з партнером
     * @param {string} taskId - ID завдання
     * @returns {string} - CSRF токен
     */
    function generateCsrfToken(taskId) {
        // Генеруємо криптографічно стійкий токен
        const token = generateSecureRandomString(48);

        // Створюємо часовий штамп для токена
        const timestamp = Date.now();

        // Генеруємо підпис для токена на основі додаткових даних
        const signature = generateSecureRandomString(16);

        // Об'єднуємо все разом для створення повного токена
        const fullToken = `${token}.${timestamp}.${signature}`;

        // Зберігаємо токен
        csrfTokens[taskId] = {
            token: fullToken,
            created: timestamp,
            expires: timestamp + CSRF_TOKEN_LIFETIME
        };

        // Зберігаємо в локальному сховищі, якщо доступно
        if (window.StorageUtils) {
            window.StorageUtils.setItem(`csrf_token_${taskId}`, csrfTokens[taskId], {
                expires: CSRF_TOKEN_LIFETIME,
                sensitive: true // Позначаємо як чутливі дані для шифрування
            });
        }

        return fullToken;
    }

    /**
     * Валідація CSRF токену
     * @param {string} taskId - ID завдання
     * @param {string} token - CSRF токен для перевірки
     * @returns {boolean} - Результат перевірки
     */
    function validateCsrfToken(taskId, token) {
        // Якщо токен відсутній, відхиляємо запит
        if (!token) {
            console.warn(`PartnerTask: Відсутній CSRF токен для завдання ${taskId}`);
            return false;
        }

        // Отримуємо збережений токен
        let storedToken = csrfTokens[taskId];

        // Якщо токен не знайдено в пам'яті, перевіряємо сховище
        if (!storedToken && window.StorageUtils) {
            storedToken = window.StorageUtils.getItem(`csrf_token_${taskId}`);
            if (storedToken) {
                // Відновлюємо токен в пам'яті
                csrfTokens[taskId] = storedToken;
            }
        }

        // Перевіряємо наявність токену
        if (!storedToken || !storedToken.token) {
            console.warn(`PartnerTask: Не знайдено збережений CSRF токен для завдання ${taskId}`);
            return false;
        }

        // Перевіряємо термін дії
        if (storedToken.expires < Date.now()) {
            console.warn(`PartnerTask: CSRF токен для завдання ${taskId} прострочений`);
            delete csrfTokens[taskId];
            if (window.StorageUtils) {
                window.StorageUtils.removeItem(`csrf_token_${taskId}`);
            }
            return false;
        }

        // Перевіряємо відповідність токену з використанням захисту від timing attack
        const storedValue = storedToken.token;
        let result = true;

        // Якщо довжини різні, відразу відхиляємо
        if (token.length !== storedValue.length) {
            return false;
        }

        // Порівнюємо символи за символом з однаковим часом виконання
        for (let i = 0; i < token.length; i++) {
            if (token[i] !== storedValue[i]) {
                result = false;
                // Продовжуємо порівняння для захисту від timing attacks
            }
        }

        return result;
    }

    /**
     * Створення елементу партнерського завдання
     * @param {Object} task - Об'єкт з даними завдання
     * @param {Object} progress - Об'єкт з прогресом користувача
     * @returns {HTMLElement} - DOM елемент завдання
     */
    function create(task, progress = null) {
        // Валідація вхідних даних
        if (!task || !task.id) {
            console.error('PartnerTask: Отримано некоректні дані завдання');
            return createErrorElement('Помилка завантаження завдання');
        }

        try {
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

            // Безпечно форматуємо URL для відображення (без розкриття повного шляху)
            let displayUrl = '';
            if (task.action_url) {
                try {
                    const urlObj = new URL(task.action_url);
                    displayUrl = urlObj.hostname;
                } catch (e) {
                    displayUrl = 'partner-site';
                }
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
                ${task.action_url && !isCompleted ? 
                `<div class="partner-url-info">
                    <span class="partner-site-label">Сайт партнера:</span> 
                    <span class="partner-site-domain">${escapeHtml(displayUrl)}</span>
                </div>` : ''
                }
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
        } catch (error) {
            console.error('PartnerTask: Помилка створення елементу завдання:', error);
            return createErrorElement('Помилка відображення завдання');
        }
    }

    /**
     * Створення елементу з повідомленням про помилку
     * @param {string} message - Повідомлення про помилку
     * @returns {HTMLElement} - DOM елемент з помилкою
     */
    function createErrorElement(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'task-item partner-task error';
        errorElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">Помилка</div>
            </div>
            <div class="task-description">${escapeHtml(message)}</div>
            <div class="task-action">
                <button class="action-button" onclick="location.reload()">Оновити сторінку</button>
            </div>
        `;
        return errorElement;
    }

    /**
     * Обробник початку виконання завдання
     */
    function handleStartTask(task) {
        try {
            // Перевірка наявності task
            if (!task || !task.id) {
                showMessage('Невірні дані завдання', 'error');
                return;
            }

            // Якщо є TaskManager, делегуємо обробку йому
            if (window.TaskManager && window.TaskManager.startTask) {
                window.TaskManager.startTask(task.id);
                return;
            }

            // Перед відкриттям партнерського посилання показуємо інформаційне повідомлення
            if (task.action_url) {
                // Перевіряємо безпеку URL
                if (!isUrlSafe(task.action_url, task.partner_name)) {
                    showMessage(`Виявлено потенційно небезпечне посилання. Перехід заблоковано.`, 'error');

                    // Логуємо інцидент
                    console.error(`PartnerTask: Заблоковано небезпечний URL: ${task.action_url}`);

                    // Якщо є API для логування інцидентів, використовуємо його
                    if (window.API) {
                        window.API.post('/security/incidents/log', {
                            type: 'unsafe_url',
                            task_id: task.id,
                            partner_name: task.partner_name || 'unknown',
                            url: task.action_url,
                            user_id: getUserId(),
                            timestamp: Date.now(),
                            user_agent: navigator.userAgent
                        }).catch(error => {
                            console.error('Помилка при логуванні інциденту:', error);
                        });
                    }

                    return;
                }

                // Показуємо підтвердження переходу
                if (confirm(`Ви будете перенаправлені на сайт партнера "${task.partner_name || 'WINIX'}". Продовжити?`)) {
                    // Генеруємо CSRF токен
                    const csrfToken = generateCsrfToken(task.id);

                    // Додаємо CSRF токен до URL, якщо URL не містить хеш
                    let safeUrl = task.action_url;

                    // Безпечно модифікуємо URL для додавання CSRF токену
                    try {
                        const urlObj = new URL(safeUrl);

                        // Додаємо основні параметри
                        urlObj.searchParams.append('csrf_token', csrfToken);
                        urlObj.searchParams.append('task_id', task.id);

                        // Додаємо параметр nonce для додаткового захисту
                        urlObj.searchParams.append('nonce', generateSecureRandomString(16));

                        // Додаємо timestamp для додаткового захисту від повторного використання
                        urlObj.searchParams.append('ts', Date.now());

                        safeUrl = urlObj.toString();

                        // Додаткова перевірка безпеки модифікованого URL
                        if (!isUrlSafe(safeUrl, task.partner_name)) {
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

                    // Викликаємо API для запуску завдання
                    if (window.API) {
                        window.API.post(`/quests/tasks/${task.id}/start`, {
                            csrf_token: csrfToken, // Додаємо CSRF токен до запиту
                            timestamp: Date.now(),
                            client_info: {
                                user_agent: navigator.userAgent,
                                referrer: document.referrer
                            }
                        })
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
                    window.API.post(`/quests/tasks/${task.id}/start`, {
                        timestamp: Date.now(),
                        client_info: {
                            user_agent: navigator.userAgent,
                            referrer: document.referrer
                        }
                    })
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
        } catch (error) {
            console.error('PartnerTask: Непередбачена помилка при старті завдання:', error);
            showMessage('Сталася непередбачена помилка при спробі розпочати завдання', 'error');
        }
    }

    /**
     * Обробник перевірки виконання завдання
     */
    function handleVerifyTask(task) {
        try {
            // Перевірка наявності task
            if (!task || !task.id) {
                showMessage('Невірні дані завдання', 'error');
                return;
            }

            // Перевірка кількості спроб верифікації
            const taskAttempts = verificationAttempts[task.id] || {
                count: 0,
                lastAttempt: 0
            };

            // Перевірка часу останньої спроби
            const now = Date.now();
            const timeSinceLastAttempt = now - taskAttempts.lastAttempt;

            if (taskAttempts.count >= MAX_VERIFICATION_ATTEMPTS && timeSinceLastAttempt < VERIFICATION_COOLDOWN) {
                const remainingCooldown = Math.ceil((VERIFICATION_COOLDOWN - timeSinceLastAttempt) / 1000);
                showMessage(`Занадто багато спроб. Спробуйте знову через ${remainingCooldown} секунд`, 'error');
                return;
            }

            // Оновлюємо дані про спроби
            verificationAttempts[task.id] = {
                count: timeSinceLastAttempt >= VERIFICATION_COOLDOWN ? 1 : taskAttempts.count + 1,
                lastAttempt: now
            };

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
                // Отримуємо CSRF токен, якщо існує
                const csrfToken = csrfTokens[task.id] ? csrfTokens[task.id].token : null;

                // Створюємо об'єкт для запиту
                const requestData = {
                    csrf_token: csrfToken, // Додаємо CSRF токен для додаткового захисту
                    timestamp: Date.now(),
                    client_info: {
                        user_agent: navigator.userAgent,
                        screen: {
                            width: window.screen.width,
                            height: window.screen.height
                        }
                    },
                    // Додаємо nonce для запобігання повторним запитам
                    nonce: generateSecureRandomString(16)
                };

                window.API.post(`/quests/tasks/${task.id}/verify`, requestData)
                .then(response => {
                    // Оновлюємо відображення завдання
                    refreshTaskDisplay(task.id);

                    if (response.success) {
                        // Скидаємо лічильник спроб
                        delete verificationAttempts[task.id];

                        // Видаляємо CSRF токен, оскільки завдання виконано
                        delete csrfTokens[task.id];
                        if (window.StorageUtils) {
                            window.StorageUtils.removeItem(`csrf_token_${task.id}`);
                        }

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
        } catch (error) {
            console.error('PartnerTask: Непередбачена помилка при перевірці завдання:', error);
            showMessage('Сталася непередбачена помилка при спробі перевірити завдання', 'error');

            // Відновлюємо початковий вигляд елемента
            try {
                refreshTaskDisplay(task.id);
            } catch (e) {
                console.error('Помилка при відновленні відображення завдання:', e);
            }
        }
    }

    /**
     * Отримання ID користувача (для логування інцидентів)
     * @returns {string} - ID користувача або 'unknown'
     */
    function getUserId() {
        try {
            // Спочатку перевіряємо глобальну змінну
            if (window.currentUserId) {
                return window.currentUserId;
            }

            // Потім перевіряємо наявність у сховищі
            if (window.StorageUtils) {
                const userId = window.StorageUtils.getItem('telegram_user_id') ||
                              window.StorageUtils.getItem('user_id');

                if (userId) {
                    return userId;
                }
            }

            // Якщо не знайдено, повертаємо 'unknown'
            return 'unknown';
        } catch (e) {
            return 'unknown';
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

        try {
            // Знаходимо завдання в DOM
            const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
            if (!taskElement) return;

            // Робимо новий запит для отримання актуальних даних
            if (window.API) {
                // Додаємо таймаут, щоб уникнути перевантаження сервера
                setTimeout(() => {
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

                        // Відновлюємо початковий вигляд кнопок, якщо виникла помилка
                        const actionElement = taskElement.querySelector('.task-action');
                        if (actionElement && actionElement.querySelector('.loading-indicator')) {
                            actionElement.innerHTML = `
                                <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.start">Виконати</button>
                                <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
                            `;

                            // Додаємо обробники подій до нових кнопок
                            bindTaskEvents(taskElement, taskId);
                        }
                    });
                }, 300); // Невелика затримка для уникнення перевантаження
            }
        } catch (error) {
            console.error('PartnerTask: Помилка при оновленні відображення завдання:', error);
        }
    }

    /**
     * Додавання обробників подій до кнопок завдання
     */
    function bindTaskEvents(taskElement, taskId) {
        try {
            // Знаходимо кнопки в елементі
            const startButton = taskElement.querySelector('.action-button[data-action="start"]');
            const verifyButton = taskElement.querySelector('.action-button[data-action="verify"]');

            // Знаходимо завдання за ID
            const task = {};
            task.id = taskId;

            // Додаємо обробники подій, якщо знайдено кнопки
            if (startButton) {
                startButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();

                    // Завантажуємо повні дані про завдання
                    if (window.API) {
                        window.API.get(`/quests/tasks/partners`)
                            .then(response => {
                                if (response.success) {
                                    const fullTask = response.data.find(t => t.id === taskId);
                                    if (fullTask) {
                                        handleStartTask(fullTask);
                                    } else {
                                        handleStartTask(task);
                                    }
                                } else {
                                    handleStartTask(task);
                                }
                            })
                            .catch(() => handleStartTask(task));
                    } else {
                        handleStartTask(task);
                    }
                });
            }

            if (verifyButton) {
                verifyButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();

                    // Завантажуємо повні дані про завдання
                    if (window.API) {
                        window.API.get(`/quests/tasks/partners`)
                            .then(response => {
                                if (response.success) {
                                    const fullTask = response.data.find(t => t.id === taskId);
                                    if (fullTask) {
                                        handleVerifyTask(fullTask);
                                    } else {
                                        handleVerifyTask(task);
                                    }
                                } else {
                                    handleVerifyTask(task);
                                }
                            })
                            .catch(() => handleVerifyTask(task));
                    } else {
                        handleVerifyTask(task);
                    }
                });
            }
        } catch (error) {
            console.error('PartnerTask: Помилка при додаванні обробників подій:', error);
        }
    }

    /**
     * Показати анімацію отримання винагороди
     */
    function showRewardAnimation(reward) {
        try {
            // Безпечно перевіряємо дані про винагороду
            if (!reward || typeof reward !== 'object') {
                console.warn('PartnerTask: Отримано некоректні дані про винагороду');
                return;
            }

            // Якщо є модуль анімацій, використовуємо його
            if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
                window.UI.Animations.showReward(reward);
                return;
            }

            // Якщо є TaskRewards, використовуємо його
            if (window.TaskRewards && window.TaskRewards.showRewardAnimation) {
                window.TaskRewards.showRewardAnimation(reward);
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
        } catch (error) {
            console.error('PartnerTask: Помилка при відображенні анімації винагороди:', error);
        }
    }

    /**
     * Оновити баланс користувача
     */
    function updateUserBalance(reward) {
        try {
            // Якщо є TaskRewards, використовуємо його
            if (window.TaskRewards && window.TaskRewards.updateBalance) {
                window.TaskRewards.updateBalance(reward);
                return;
            }

            // Якщо є TaskManager, використовуємо його
            if (window.TaskManager && window.TaskManager.updateBalance) {
                window.TaskManager.updateBalance(reward);
                return;
            }

            // Інакше оновлюємо вручну
            if (reward.type === 'tokens') {
                const userTokensElement = document.getElementById('user-tokens');
                if (userTokensElement) {
                    const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                    userTokensElement.textContent = (currentBalance + reward.amount).toFixed(2);
                    userTokensElement.classList.add('highlight');
                    setTimeout(() => {
                        userTokensElement.classList.remove('highlight');
                    }, 2000);

                    // Зберігаємо в сховищі, якщо доступно
                    if (window.StorageUtils) {
                        window.StorageUtils.setItem('userTokens', currentBalance + reward.amount, {
                            sensitive: true // Позначаємо як чутливі дані для шифрування
                        });
                        window.StorageUtils.setItem('winix_balance', currentBalance + reward.amount, {
                            sensitive: true // Позначаємо як чутливі дані для шифрування
                        });
                    }
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

                    // Зберігаємо в сховищі, якщо доступно
                    if (window.StorageUtils) {
                        window.StorageUtils.setItem('userCoins', currentBalance + reward.amount, {
                            sensitive: true // Позначаємо як чутливі дані для шифрування
                        });
                        window.StorageUtils.setItem('winix_coins', currentBalance + reward.amount, {
                            sensitive: true // Позначаємо як чутливі дані для шифрування
                        });
                    }
                }
            }
        } catch (error) {
            console.error('PartnerTask: Помилка при оновленні балансу:', error);
        }
    }

    /**
     * Показати повідомлення
     */
    function showMessage(message, type = 'info') {
        try {
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
        } catch (error) {
            console.error('PartnerTask: Помилка при відображенні повідомлення:', error);
            // Запасний варіант
            alert(message);
        }
    }

    /**
     * Покращена функція для безпечного виведення HTML
     * Захищає від XSS-атак
     */
    function escapeHtml(text) {
        if (text === undefined || text === null || typeof text !== 'string') {
            return '';
        }

        try {
            // DOMPurify використовується, якщо доступний
            if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                // Спочатку екрануємо HTML
                const div = document.createElement('div');
                div.textContent = text;
                const escaped = div.innerHTML;

                // Потім санітаризуємо
                return window.DOMPurify.sanitize(escaped, {
                    ALLOWED_TAGS: [], // Не дозволяємо теги
                    ALLOWED_ATTR: []  // Не дозволяємо атрибути
                });
            }

            // Стандартний метод через DOM API
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } catch (error) {
            console.error('PartnerTask: Помилка при екрануванні HTML:', error);

            // Запасний варіант
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    }

    /**
     * Очищення застарілих даних
     */
    function cleanupExpiredData() {
        try {
            // Очищення застарілих CSRF токенів
            const now = Date.now();
            Object.keys(csrfTokens).forEach(taskId => {
                if (csrfTokens[taskId].expires < now) {
                    delete csrfTokens[taskId];
                    if (window.StorageUtils) {
                        window.StorageUtils.removeItem(`csrf_token_${taskId}`);
                    }
                }
            });

            // Скидання лічильника спроб для завдань, де пройшов час очікування
            Object.keys(verificationAttempts).forEach(taskId => {
                if (now - verificationAttempts[taskId].lastAttempt >= VERIFICATION_COOLDOWN) {
                    delete verificationAttempts[taskId];
                }
            });

            // Очищення старих даних блокованих URL (зберігаємо лише останні 100)
            if (blockedUrls.size > 100) {
                const urlsArray = Array.from(blockedUrls);
                const urlsToRemove = urlsArray.slice(0, urlsArray.length - 100);
                urlsToRemove.forEach(url => blockedUrls.delete(url));
            }
        } catch (error) {
            console.error('PartnerTask: Помилка при очищенні застарілих даних:', error);
        }
    }

    // Запускаємо очищення застарілих даних кожні 5 хвилин
    setInterval(cleanupExpiredData, 5 * 60 * 1000);

    // Публічний API модуля
    return {
        create,
        refreshTaskDisplay,
        handleStartTask,
        handleVerifyTask,
        isUrlSafe
    };
})();