/**
 * Notifications - оптимізований модуль для управління та відображення сповіщень
 * Відповідає за:
 * - Відображення toast-повідомлень різних типів
 * - Створення модальних діалогів
 * - Управління індикаторами завантаження
 * - Адаптивне відображення на різних пристроях
 *
 * @version 2.1.0
 */

window.UI = window.UI || {};

window.UI.Notifications = (function() {
    // Конфігурація з оптимізованими значеннями
    const CONFIG = {
        maxNotifications: 3,       // Максимальна кількість одночасних сповіщень
        autoHideTimeout: 5000,     // Час автоматичного закриття (мс)
        animationDuration: 300,    // Тривалість анімації (мс)
        position: 'top-right',     // Позиція сповіщень
        maxWidth: 380,             // Максимальна ширина сповіщення
        debug: false               // Режим налагодження
    };

    // Стан модуля
    const state = {
        notificationShowing: false,   // Чи показується зараз сповіщення
        notificationsQueue: [],       // Черга сповіщень
        notificationsCounter: 0,      // Лічильник сповіщень
        containerId: 'notification-container',     // ID контейнера сповіщень
        loadingSpinnerId: 'loading-spinner',       // ID індикатора завантаження
        confirmDialogId: 'confirm-dialog',         // ID діалогу підтвердження
        activeTimeout: null,          // Поточний таймер автозакриття
        activeNotifications: new Set() // Активні сповіщення
    };

    /**
     * Ініціалізація модуля сповіщень
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        // Оновлюємо конфігурацію модуля
        Object.assign(CONFIG, options);

        log('Ініціалізація модуля сповіщень');

        // Додаємо стилі тільки один раз
        injectStyles();

        // Створюємо контейнер для сповіщень якщо його немає
        ensureContainer();

        // Перевизначаємо глобальні функції для сумісності
        defineGlobalFunctions();

        // Додаємо обробник для клавіші Escape
        document.addEventListener('keydown', handleEscapeKey);

        // Очищаємо ресурси при виході з сторінки
        window.addEventListener('beforeunload', cleanup);

        log('Модуль сповіщень успішно ініціалізовано');
    }

    /**
     * Відлагоджувальний лог
     * @param {string} message - Повідомлення
     * @param {*} data - Додаткові дані
     */
    function log(message, data) {
        if (CONFIG.debug) {
            console.log(`[UI.Notifications] ${message}`, data || '');
        }
    }

    /**
     * Забезпечення наявності контейнера для сповіщень
     */
    function ensureContainer() {
        if (!document.getElementById(state.containerId)) {
            const container = document.createElement('div');
            container.id = state.containerId;
            container.className = `notification-container ${CONFIG.position}`;
            document.body.appendChild(container);
        }
    }

    /**
     * Перевизначення глобальних функцій для сумісності
     */
    function defineGlobalFunctions() {
        // Toast-повідомлення
        window.showToast = function(message, isError) {
            return isError ? showError(message) : showSuccess(message);
        };

        // Звичайні сповіщення
        window.showNotification = showInfo;

        // Індикатори завантаження
        window.showLoading = showLoading;
        window.hideLoading = hideLoading;

        // Діалоги підтвердження
        window.showModernConfirm = showConfirmDialog;
    }

    /**
     * Обробка натискання клавіші Escape
     * @param {KeyboardEvent} event - Подія клавіатури
     */
    function handleEscapeKey(event) {
        if (event.key === 'Escape') {
            // Закриваємо активні діалоги
            const confirmDialog = document.getElementById(state.confirmDialogId);
            if (confirmDialog && confirmDialog.classList.contains('show')) {
                confirmDialog.classList.remove('show');
                event.preventDefault();
            }

            // Закриваємо індикатор завантаження
            const loadingSpinner = document.getElementById(state.loadingSpinnerId);
            if (loadingSpinner && loadingSpinner.classList.contains('show')) {
                hideLoading();
                event.preventDefault();
            }
        }
    }

    /**
     * Додавання оптимізованих CSS стилів
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('notification-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'notification-styles';

        // Оптимізований CSS з мінімальною кількістю правил
        styleElement.textContent = `
            /* Контейнер сповіщень */
            .notification-container {
                position: fixed;
                z-index: 9999;
                width: 90%;
                max-width: ${CONFIG.maxWidth}px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
                transition: all 0.3s ease;
            }
            
            /* Позиції */
            .notification-container.top-right {
                top: 20px;
                right: 20px;
            }
            
            .notification-container.top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .notification-container.bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            /* Сповіщення */
            .notification {
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                color: white;
                transform: translateX(50px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                           opacity 0.4s ease;
                pointer-events: auto;
                position: relative;
                overflow: hidden;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            /* Типи сповіщень */
            .notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(to bottom, #4eb5f7, #00C9A7);
            }
            
            .notification.error::before {
                background: linear-gradient(to bottom, #FF5252, #B71C1C);
            }
            
            .notification.success::before {
                background: linear-gradient(to bottom, #4CAF50, #2E7D32);
            }
            
            .notification.info::before {
                background: linear-gradient(to bottom, #2196F3, #1976D2);
            }
            
            .notification.warning::before {
                background: linear-gradient(to bottom, #FFC107, #FF9800);
            }
            
            /* Компоненти сповіщення */
            .notification-icon {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-right: 14px;
                background: rgba(255, 255, 255, 0.15);
            }
            
            .notification-content {
                flex-grow: 1;
                padding-right: 8px;
            }
            
            .notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 15px;
            }
            
            .notification-message {
                opacity: 0.9;
                font-size: 14px;
            }
            
            .notification-close {
                width: 26px;
                height: 26px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: all 0.2s ease;
                padding: 0;
                position: relative;
            }
            
            .notification-close::before,
            .notification-close::after {
                content: '';
                position: absolute;
                width: 12px;
                height: 2px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 1px;
            }
            
            .notification-close::before {
                transform: rotate(45deg);
            }
            
            .notification-close::after {
                transform: rotate(-45deg);
            }
            
            /* Діалог підтвердження */
            .confirm-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
                backdrop-filter: blur(8px);
            }
            
            .confirm-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .confirm-dialog {
                background: rgba(15, 23, 42, 0.95);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 380px;
                transform: scale(0.95) translateY(20px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
                text-align: center;
            }
            
            .confirm-overlay.show .confirm-dialog {
                transform: scale(1) translateY(0);
                opacity: 1;
            }
            
            .confirm-title {
                font-size: 22px;
                font-weight: 600;
                margin-bottom: 16px;
                color: white;
            }
            
            .confirm-message {
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 30px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 16px;
                width: 100%;
            }
            
            .confirm-button {
                flex-basis: 45%;
                padding: 14px;
                border-radius: 14px;
                border: none;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .confirm-button-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            .confirm-button-confirm {
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                color: white;
            }
            
            .confirm-button-danger {
                background: linear-gradient(135deg, #F44336, #B71C1C);
                color: white;
            }
            
            /* Індикатор завантаження */
            .spinner-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
                backdrop-filter: blur(8px);
            }
            
            .spinner-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .spinner-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 24px;
                background: rgba(15, 23, 42, 0.8);
                padding: 36px;
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            
            .spinner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(0, 201, 167, 0.2);
                border-radius: 50%;
                border-top-color: rgb(0, 201, 167);
                animation: spin 1s linear infinite;
            }
            
            .spinner-message {
                color: white;
                font-size: 16px;
                text-align: center;
                max-width: 300px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* Адаптивність */
            @media (max-width: 480px) {
                .notification-container {
                    max-width: 320px;
                    width: 95%;
                }
                
                .notification {
                    padding: 12px;
                }
                
                .notification-title {
                    font-size: 14px;
                }
                
                .notification-message {
                    font-size: 13px;
                }
            }
        `;

        document.head.appendChild(styleElement);
    }

    /**
     * Показ інформаційного сповіщення
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотного виклику
     */
    function showInfo(message, callback = null) {
        return showNotification(message, 'info', callback);
    }

    /**
     * Показ сповіщення про успіх
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотного виклику
     */
    function showSuccess(message, callback = null) {
        return showNotification(message, 'success', callback);
    }

    /**
     * Показ сповіщення про помилку
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотного виклику
     */
    function showError(message, callback = null) {
        return showNotification(message, 'error', callback);
    }

    /**
     * Показ сповіщення-попередження
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотного виклику
     */
    function showWarning(message, callback = null) {
        return showNotification(message, 'warning', callback);
    }

    /**
     * Універсальна функція показу сповіщень (оптимізовано)
     * @param {string|Object} message - Текст або об'єкт з налаштуваннями
     * @param {string} type - Тип сповіщення
     * @param {Function|Object} callback - Функція або додаткові параметри
     * @returns {Promise} Проміс, що завершується при закритті сповіщення
     */
    function showNotification(message, type = 'info', callback = null, options = {}) {
        // Обробка різних форматів аргументів
        if (typeof type === 'boolean') {
            type = type ? 'error' : 'success';
        }

        if (typeof callback === 'object' && callback !== null) {
            options = callback;
            callback = null;
        }

        // Перевірка на пусте повідомлення
        if (!message || (typeof message === 'string' && message.trim() === '')) {
            if (callback) setTimeout(callback, 100);
            return Promise.resolve();
        }

        // Обробка об'єкта з повідомленням
        let title = options.title || getDefaultTitle(type);
        if (typeof message === 'object') {
            title = message.title || title;
            message = message.message || message.text || '';
        }

        return new Promise((resolve) => {
            // Якщо вже показується інше сповіщення, додаємо в чергу
            if (state.notificationShowing && state.notificationsQueue.length < CONFIG.maxNotifications) {
                state.notificationsQueue.push({
                    message,
                    type,
                    callback,
                    options: { ...options, title },
                    resolve
                });
                return;
            }

            state.notificationShowing = true;
            state.notificationsCounter++;
            const notificationId = `notification_${state.notificationsCounter}`;

            try {
                // Перевіряємо наявність контейнера
                ensureContainer();
                const container = document.getElementById(state.containerId);

                // Створюємо сповіщення
                const notification = createNotificationElement(
                    notificationId,
                    type,
                    title,
                    message
                );

                // Додаємо до контейнера
                container.appendChild(notification);

                // Показуємо сповіщення з невеликою затримкою
                setTimeout(() => {
                    notification.classList.add('show');
                }, 10);

                // Запускаємо вібрацію для помилок та попереджень
                if ((type === 'error' || type === 'warning') && navigator.vibrate) {
                    navigator.vibrate(type === 'error' ? 200 : 100);
                }

                // Додаємо до списку активних сповіщень
                state.activeNotifications.add(notificationId);

                // Автоматичне закриття
                const duration = options.duration || CONFIG.autoHideTimeout;
                if (duration !== 0) {
                    state.activeTimeout = setTimeout(() => {
                        closeNotification(notification, callback, resolve);
                    }, duration);
                }

                log(`Показано сповіщення [${type}]: ${message}`);

            } catch (e) {
                console.error('Помилка показу сповіщення:', e);
                // Використовуємо alert як запасний варіант
                alert(message);
                state.notificationShowing = false;
                if (callback) callback();
                resolve();
            }
        });
    }

    /**
     * Створення елемента сповіщення
     * @param {string} id - Ідентифікатор
     * @param {string} type - Тип сповіщення
     * @param {string} title - Заголовок
     * @param {string} message - Повідомлення
     * @returns {HTMLElement} Елемент сповіщення
     */
    function createNotificationElement(id, type, title, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.id = id;

        // Додаємо іконку
        const icon = document.createElement('div');
        icon.className = 'notification-icon';

        // Обираємо символ для іконки
        let iconContent = '';
        switch (type) {
            case 'error': iconContent = '✕'; break;
            case 'success': iconContent = '✓'; break;
            case 'warning': iconContent = '!'; break;
            case 'info': default: iconContent = 'i';
        }
        icon.textContent = iconContent;

        // Додаємо контент
        const content = document.createElement('div');
        content.className = 'notification-content';

        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        titleElement.textContent = title;

        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = message;

        content.appendChild(titleElement);
        content.appendChild(messageElement);

        // Додаємо кнопку закриття
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.setAttribute('aria-label', 'Закрити');

        // Додаємо обробник для закриття сповіщення
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });

        // Збираємо елементи
        notification.appendChild(icon);
        notification.appendChild(content);
        notification.appendChild(closeBtn);

        return notification;
    }

    /**
     * Отримання стандартного заголовка для типу сповіщення
     * @param {string} type - Тип сповіщення
     * @returns {string} Заголовок
     */
    function getDefaultTitle(type) {
        switch (type) {
            case 'error': return 'Помилка';
            case 'success': return 'Успішно';
            case 'warning': return 'Увага';
            case 'info': default: return 'Інформація';
        }
    }

    /**
     * Закриття сповіщення
     * @param {HTMLElement} notification - Елемент сповіщення
     * @param {Function} callback - Функція зворотного виклику
     * @param {Function} resolvePromise - Функція для вирішення промісу
     */
    function closeNotification(notification, callback = null, resolvePromise = null) {
        // Перевіряємо, чи сповіщення ще існує
        if (!notification || !notification.parentNode) {
            state.notificationShowing = false;
            processNextNotification();
            return;
        }

        // Знімаємо клас show
        notification.classList.remove('show');

        // Видаляємо з DOM після анімації
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }

            // Видаляємо з активних сповіщень
            state.activeNotifications.delete(notification.id);

            // Скидаємо прапорець для можливості показу наступного сповіщення
            state.notificationShowing = false;

            // Виконуємо callback
            if (callback) setTimeout(() => callback(), 0);

            // Вирішуємо проміс
            if (resolvePromise) resolvePromise();

            // Показуємо наступне сповіщення з черги
            processNextNotification();
        }, CONFIG.animationDuration);
    }

    /**
     * Обробка наступного сповіщення з черги
     */
    function processNextNotification() {
        if (state.notificationsQueue.length > 0) {
            const nextNotification = state.notificationsQueue.shift();
            showNotification(
                nextNotification.message,
                nextNotification.type,
                nextNotification.callback,
                nextNotification.options
            ).then(() => {
                if (nextNotification.resolve) {
                    nextNotification.resolve();
                }
            });
        }
    }

    /**
     * Показ діалогового вікна з підтвердженням (оптимізовано)
     * @param {Object|string} options - Опції діалогу або повідомлення
     * @param {Function} confirmCallback - Функція при підтвердженні
     * @param {Function} cancelCallback - Функція при скасуванні
     * @returns {Promise<boolean>} Результат вибору користувача
     */
    function showConfirmDialog(options, confirmCallback, cancelCallback) {
        // Підтримка обох форматів виклику
        if (typeof options === 'string') {
            if (confirmCallback || cancelCallback) {
                // Старий формат з окремими callback'ами
                return new Promise((resolve) => {
                    internalShowConfirmDialog({
                        message: options,
                        title: 'Підтвердження',
                        confirmText: 'Підтвердити',
                        cancelText: 'Скасувати',
                        type: 'default',
                        iconType: 'warning'
                    }, result => {
                        if (result && confirmCallback) confirmCallback();
                        if (!result && cancelCallback) cancelCallback();
                        resolve(result);
                    });
                });
            } else {
                // Простий виклик з повідомленням
                return internalShowConfirmDialog({
                    message: options,
                    title: 'Підтвердження',
                    confirmText: 'Підтвердити',
                    cancelText: 'Скасувати',
                    type: 'default',
                    iconType: 'warning'
                });
            }
        } else {
            // Повний формат з опціями
            return internalShowConfirmDialog(options);
        }
    }

    /**
     * Внутрішня реалізація діалогу підтвердження
     * @param {Object} options - Опції діалогу
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<boolean>} Результат вибору користувача
     */
    function internalShowConfirmDialog(options, callback = null) {
        // Налаштування за замовчуванням
        const {
            message,
            title = 'Підтвердження',
            confirmText = 'Підтвердити',
            cancelText = 'Скасувати',
            type = 'default',
            iconType = 'warning'
        } = options;

        return new Promise((resolve) => {
            try {
                // Приховуємо інші діалоги
                hideAllDialogs();

                // Створюємо діалог, якщо його немає
                let confirmOverlay = document.getElementById(state.confirmDialogId);

                if (!confirmOverlay) {
                    confirmOverlay = document.createElement('div');
                    confirmOverlay.id = state.confirmDialogId;
                    confirmOverlay.className = 'confirm-overlay';

                    const dialog = document.createElement('div');
                    dialog.className = 'confirm-dialog';

                    confirmOverlay.appendChild(dialog);
                    document.body.appendChild(confirmOverlay);
                }

                // Отримуємо контейнер діалогу
                const dialog = confirmOverlay.querySelector('.confirm-dialog');

                // Оновлюємо вміст діалогу
                dialog.innerHTML = `
                    <div class="confirm-title">${title}</div>
                    <div class="confirm-message">${message}</div>
                    <div class="confirm-buttons">
                        <button class="confirm-button confirm-button-cancel" id="confirm-cancel-button">${cancelText}</button>
                        <button class="confirm-button confirm-button-${type === 'danger' ? 'danger' : 'confirm'}" id="confirm-yes-button">${confirmText}</button>
                    </div>
                `;

                // Додаємо обробники на кнопки
                const cancelBtn = dialog.querySelector('#confirm-cancel-button');
                const confirmBtn = dialog.querySelector('#confirm-yes-button');

                cancelBtn.onclick = function() {
                    confirmOverlay.classList.remove('show');
                    setTimeout(() => {
                        const result = false;
                        if (callback) callback(result);
                        resolve(result);
                    }, CONFIG.animationDuration);
                };

                confirmBtn.onclick = function() {
                    confirmOverlay.classList.remove('show');
                    setTimeout(() => {
                        const result = true;
                        if (callback) callback(result);
                        resolve(result);
                    }, CONFIG.animationDuration);
                };

                // Показуємо діалог
                confirmOverlay.classList.add('show');

                log('Показано діалог підтвердження', options);
            } catch (e) {
                console.error('Помилка показу діалогу підтвердження:', e);
                // Використовуємо стандартний confirm як запасний варіант
                const result = confirm(message);
                if (callback) callback(result);
                resolve(result);
            }
        });
    }

    /**
     * Приховання всіх активних діалогів
     */
    function hideAllDialogs() {
        const existingDialogs = document.querySelectorAll('.confirm-overlay');
        existingDialogs.forEach(dialog => {
            if (dialog.id !== state.confirmDialogId) {
                dialog.classList.remove('show');
            }
        });
    }

    /**
     * Показ індикатора завантаження
     * @param {string} message - Повідомлення
     */
    function showLoading(message) {
        try {
            let spinner = document.getElementById(state.loadingSpinnerId);

            if (!spinner) {
                // Створюємо індикатор
                const spinnerContainer = document.createElement('div');
                spinnerContainer.id = state.loadingSpinnerId;
                spinnerContainer.className = 'spinner-overlay';

                spinnerContainer.innerHTML = `
                    <div class="spinner-content">
                        <div class="spinner"></div>
                        ${message ? `<div class="spinner-message">${message}</div>` : ''}
                    </div>
                `;

                document.body.appendChild(spinnerContainer);
                spinner = spinnerContainer;
            } else {
                // Оновлюємо повідомлення
                if (message) {
                    let messageEl = spinner.querySelector('.spinner-message');
                    if (messageEl) {
                        messageEl.textContent = message;
                    } else {
                        const content = spinner.querySelector('.spinner-content');
                        messageEl = document.createElement('div');
                        messageEl.className = 'spinner-message';
                        messageEl.textContent = message;
                        content.appendChild(messageEl);
                    }
                }
            }

            // Показуємо індикатор
            spinner.classList.add('show');
            log('Показано індикатор завантаження', message);
        } catch (e) {
            console.error('Помилка показу індикатора завантаження:', e);
        }
    }

    /**
     * Приховування індикатора завантаження
     */
    function hideLoading() {
        try {
            const spinner = document.getElementById(state.loadingSpinnerId);
            if (spinner) {
                spinner.classList.remove('show');
                log('Приховано індикатор завантаження');
            }
        } catch (e) {
            console.error('Помилка приховування індикатора завантаження:', e);
        }
    }

    /**
     * Оновлення відображення балансу на всіх елементах UI
     * @param {number} newBalance - Новий баланс
     */
    function updateBalanceUI(newBalance) {
        try {
            // Списки елементів для оновлення
            const balanceElements = [
                document.getElementById('user-tokens'),
                document.getElementById('main-balance'),
                document.querySelector('.balance-amount'),
                document.getElementById('current-balance'),
                ...document.querySelectorAll('[data-balance-display]')
            ];

            // Оновлюємо відображення в DOM
            balanceElements.forEach(element => {
                if (!element) return;

                // Оновлюємо вміст елемента
                if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                    const iconPart = element.querySelector('.main-balance-icon')?.outerHTML || '';
                    element.innerHTML = `${parseFloat(newBalance).toFixed(2)} ${iconPart}`;
                } else {
                    element.textContent = parseFloat(newBalance).toFixed(2);
                }

                // Додаємо анімацію оновлення
                element.classList.add('balance-updated');
                setTimeout(() => {
                    element.classList.remove('balance-updated');
                }, 1000);
            });

            // Зберігаємо значення в localStorage
            try {
                localStorage.setItem('userTokens', newBalance.toString());
                localStorage.setItem('winix_balance', newBalance.toString());
            } catch (error) {
                console.warn('UI.Notifications: Помилка збереження балансу:', error);
            }

            // Генеруємо подію для інших модулів
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: { newBalance: parseFloat(newBalance) }
            }));

            log('Оновлено баланс', newBalance);
        } catch (error) {
            console.error('Помилка оновлення відображення балансу:', error);
        }
    }

    /**
     * Очищення ресурсів модуля
     */
    function cleanup() {
        // Закрити активні сповіщення
        state.activeNotifications.forEach(id => {
            const notification = document.getElementById(id);
            if (notification) {
                notification.parentNode.removeChild(notification);
            }
        });

        // Очистити чергу сповіщень
        state.notificationsQueue = [];
        state.activeNotifications.clear();

        // Очистити таймери
        if (state.activeTimeout) {
            clearTimeout(state.activeTimeout);
            state.activeTimeout = null;
        }

        log('Ресурси модуля очищено');
    }

    // Ініціалізуємо модуль при завантаженні
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        showInfo,
        showSuccess,
        showError,
        showWarning,
        showNotification,
        showConfirmDialog,
        showLoading,
        hideLoading,
        updateBalanceUI
    };
})();