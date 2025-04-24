/**
 * Premium Notifications - покращений модуль для відображення сповіщень
 * Відповідає за стильні сповіщення та діалоги з анімованими SVG іконками
 */

// Створюємо namespace для UI компонентів
window.UI = window.UI || {};

window.UI.Notifications = (function() {
    // Конфігурація модуля
    const CONFIG = {
        maxNotificationsAtOnce: 1,   // Максимальна кількість одночасних сповіщень
        autoHideTimeout: 5000,       // Час автоматичного закриття сповіщення (мс)
        animationDuration: 300,      // Тривалість анімації (мс)
        position: 'top-right'        // Позиція сповіщень: 'top-right', 'top-center'
    };

    // Приватні змінні
    let _notificationShowing = false;
    let _notificationsQueue = [];
    let _containerId = 'premium-notification-container';
    let _loadingSpinnerId = 'loading-spinner';
    let _confirmDialogId = 'premium-confirm-dialog';

    /**
     * Ініціалізація модуля сповіщень
     */
    function init() {
        console.log('UI.Notifications: Ініціалізація модуля преміум-сповіщень');

        // Додаємо стилі
        injectStyles();

        // Створюємо контейнер для сповіщень
        if (!document.getElementById(_containerId)) {
            const container = document.createElement('div');
            container.id = _containerId;
            container.className = 'premium-notification-container ' + CONFIG.position;
            document.body.appendChild(container);
        }

        // Перевизначаємо глобальні функції для сумісності
        overrideGlobalNotificationFunctions();
    }

    /**
     * Додавання CSS стилів для сповіщень
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('premium-notification-styles')) return;

        // Створюємо елемент стилів
        const styleElement = document.createElement('style');
        styleElement.id = 'premium-notification-styles';

        // Додаємо CSS для преміальних сповіщень
        styleElement.textContent = `
            /* Загальні стилі для сповіщень */
            .premium-notification-container {
                position: fixed;
                z-index: 9999;
                width: 90%;
                max-width: 380px;
                display: flex;
                flex-direction: column;
                gap: 0.625rem;
                pointer-events: none;
            }
            
            /* Позиціонування */
            .premium-notification-container.top-right {
                top: 1.25rem;
                right: 1.25rem;
            }
            
            .premium-notification-container.top-center {
                top: 1.25rem;
                left: 50%;
                transform: translateX(-50%);
            }
            
            /* Стилі для сповіщення */
            .premium-notification {
                background: rgba(30, 39, 70, 0.85);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4), 
                            0 8px 16px rgba(0, 0, 0, 0.3), 
                            0 0 0 1px rgba(78, 181, 247, 0.1) inset;
                display: flex;
                align-items: center;
                color: white;
                transform: translateX(50px) scale(0.95);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                            opacity 0.3s ease;
                margin-bottom: 0.5rem;
                overflow: hidden;
                pointer-events: auto;
                position: relative;
            }
            
            /* Позиціонування анімації залежно від позиції контейнера */
            .top-center .premium-notification {
                transform: translateY(-20px) scale(0.95);
            }
            
            .premium-notification.show {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
            
            .top-center .premium-notification.show {
                transform: translateY(0) scale(1);
            }
            
            .premium-notification.hide {
                transform: translateX(50px) scale(0.95);
                opacity: 0;
            }
            
            .top-center .premium-notification.hide {
                transform: translateY(-20px) scale(0.95);
            }
            
            /* Кольорова лінія для типу сповіщення */
            .premium-notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(to bottom, #4DB6AC, #00C9A7);
            }
            
            .premium-notification.error::before {
                background: linear-gradient(to bottom, #FF5252, #B71C1C);
            }
            
            .premium-notification.success::before {
                background: linear-gradient(to bottom, #4CAF50, #2E7D32);
            }
            
            .premium-notification.info::before {
                background: linear-gradient(to bottom, #2196F3, #1976D2);
            }
            
            /* Іконка сповіщення */
            .premium-notification-icon {
                width: 32px;
                height: 32px;
                min-width: 32px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-right: 12px;
                position: relative;
            }
            
            .premium-notification .premium-notification-icon {
                background: rgba(0, 201, 167, 0.15);
            }
            
            .premium-notification.error .premium-notification-icon {
                background: rgba(244, 67, 54, 0.15);
            }
            
            .premium-notification.success .premium-notification-icon {
                background: rgba(76, 175, 80, 0.15);
            }
            
            .premium-notification.info .premium-notification-icon {
                background: rgba(33, 150, 243, 0.15);
            }
            
            /* Контент сповіщення */
            .premium-notification-content {
                flex-grow: 1;
                padding-right: 8px;
                font-size: 14px;
                line-height: 1.5;
            }
            
            /* Кнопка закриття */
            .premium-notification-close {
                width: 24px;
                height: 24px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 50%;
                color: rgba(255, 255, 255, 0.7);
                font-size: 14px;
                cursor: pointer;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: all 0.2s ease;
                padding: 0;
                margin-left: 8px;
                position: relative;
            }
            
            .premium-notification-close::before,
            .premium-notification-close::after {
                content: '';
                position: absolute;
                width: 12px;
                height: 2px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 1px;
            }
            
            .premium-notification-close::before {
                transform: rotate(45deg);
            }
            
            .premium-notification-close::after {
                transform: rotate(-45deg);
            }
            
            .premium-notification-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .premium-notification-close:hover::before,
            .premium-notification-close:hover::after {
                background: white;
            }
            
            /* Прогрес-бар для автозакриття */
            .premium-notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: linear-gradient(to right, rgba(78, 181, 247, 0.5), rgba(0, 201, 167, 0.8));
                width: 100%;
                transform-origin: left;
                animation: progress-shrink 5s linear forwards;
            }
            
            .premium-notification.error .premium-notification-progress {
                background: linear-gradient(to right, rgba(244, 67, 54, 0.5), rgba(183, 28, 28, 0.8));
            }
            
            .premium-notification.success .premium-notification-progress {
                background: linear-gradient(to right, rgba(76, 175, 80, 0.5), rgba(46, 125, 50, 0.8));
            }
            
            .premium-notification.info .premium-notification-progress {
                background: linear-gradient(to right, rgba(33, 150, 243, 0.5), rgba(13, 71, 161, 0.8));
            }
            
            @keyframes progress-shrink {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
            
            /* Заголовок та повідомлення */
            .premium-notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 15px;
            }
            
            .premium-notification-message {
                opacity: 0.9;
            }
            
            /* Стилі для діалогу підтвердження */
            .premium-confirm-overlay {
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
            
            .premium-confirm-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .premium-confirm-dialog {
                background: rgba(30, 39, 70, 0.90);
                border-radius: 20px;
                padding: 24px;
                width: 90%;
                max-width: 380px;
                transform: scale(0.95);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 
                            0 0 0 1px rgba(78, 181, 247, 0.15) inset, 
                            0 6px 12px rgba(0, 0, 0, 0.25);
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                overflow: hidden;
                position: relative;
            }
            
            .premium-confirm-overlay.show .premium-confirm-dialog {
                transform: scale(1);
                opacity: 1;
            }
            
            .premium-confirm-icon {
                width: 70px;
                height: 70px;
                background: rgba(244, 67, 54, 0.15);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 16px;
                position: relative;
            }
            
            .premium-confirm-title {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 12px;
                color: white;
            }
            
            .premium-confirm-message {
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 24px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .premium-confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 12px;
                width: 100%;
            }
            
            .premium-confirm-button {
                flex-basis: 45%;
                padding: 12px;
                border-radius: 12px;
                border: none;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .premium-confirm-button:active {
                transform: scale(0.97);
            }
            
            .premium-confirm-button-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            .premium-confirm-button-confirm {
                background: linear-gradient(90deg, #0288D1, #26A69A, #4CAF50);
                color: white;
            }
            
            .premium-confirm-button-danger {
                background: linear-gradient(90deg, #8B0000, #A52A2A, #B22222);
                color: white;
            }
            
            /* Стилі для індикатора завантаження */
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
                backdrop-filter: blur(3px);
            }
            
            .spinner-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .spinner-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            }
            
            .spinner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(0, 201, 167, 0.3);
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
            
            /* Адаптивність для невеликих екранів */
            @media (max-width: 480px) {
                .premium-notification-container {
                    max-width: 320px;
                    width: 95%;
                }
                
                .premium-notification {
                    padding: 12px;
                }
                
                .premium-notification-icon {
                    width: 28px;
                    height: 28px;
                    min-width: 28px;
                }
                
                .premium-notification-title {
                    font-size: 14px;
                }
                
                .premium-notification-message {
                    font-size: 13px;
                }
                
                .premium-confirm-dialog {
                    padding: 20px;
                }
                
                .premium-confirm-icon {
                    width: 60px;
                    height: 60px;
                }
                
                .premium-confirm-title {
                    font-size: 18px;
                }
                
                .premium-confirm-message {
                    font-size: 14px;
                }
                
                .premium-confirm-button {
                    font-size: 14px;
                    padding: 10px;
                }
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Перевизначення глобальних функцій для сумісності
     */
    function overrideGlobalNotificationFunctions() {
        // Для toast-повідомлень
        window.showToast = function(message, isError) {
            if (isError) {
                showError(message);
            } else {
                showSuccess(message);
            }
        };

        // Для сповіщень
        window.showNotification = showInfo;

        // Для індикаторів завантаження
        window.showLoading = showLoading;
        window.hideLoading = hideLoading;

        // Для діалогів підтвердження
        window.showModernConfirm = showConfirmDialog;
    }

    /**
     * Показати інформаційне сповіщення
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showInfo(message, callback = null) {
        showNotification(message, 'info', callback);
    }

    /**
     * Показати сповіщення про успіх
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showSuccess(message, callback = null) {
        showNotification(message, 'success', callback);
    }

    /**
     * Показати сповіщення про помилку
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showError(message, callback = null) {
        showNotification(message, 'error', callback);
    }

    /**
     * Універсальна функція показу сповіщень
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип сповіщення ('info', 'success', 'error')
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showNotification(message, type = 'info', callback = null) {
        // Якщо тип передано як boolean (для сумісності зі старим API)
        if (typeof type === 'boolean') {
            type = type ? 'error' : 'success';
        }

        // Запобігаємо показу порожніх повідомлень
        if (!message || message.trim() === '') {
            if (callback) setTimeout(callback, 100);
            return;
        }

        // Якщо уже показується сповіщення, додаємо в чергу
        if (_notificationShowing) {
            if (_notificationsQueue.length < CONFIG.maxNotificationsAtOnce) {
                _notificationsQueue.push({ message, type, callback });
            } else {
                // Якщо черга переповнена, і це повідомлення про помилку, показуємо його через alert
                if (type === 'error') alert(message);
                if (callback) setTimeout(callback, 100);
            }
            return;
        }

        _notificationShowing = true;

        try {
            // Перевіряємо, чи контейнер для повідомлень існує
            let container = document.getElementById(_containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = _containerId;
                container.className = 'premium-notification-container ' + CONFIG.position;
                document.body.appendChild(container);
            }

            // Створюємо сповіщення
            const notification = document.createElement('div');
            notification.className = `premium-notification ${type}`;

            // Додаємо іконку
            const icon = document.createElement('div');
            icon.className = `premium-notification-icon icon-${type}`;

            // Контент повідомлення
            const content = document.createElement('div');
            content.className = 'premium-notification-content';

            // Додаємо заголовок та текст
            const title = document.createElement('div');
            title.className = 'premium-notification-title';

            // Встановлюємо заголовок залежно від типу
            switch (type) {
                case 'error':
                    title.textContent = 'Помилка';
                    break;
                case 'success':
                    title.textContent = 'Успішно';
                    break;
                case 'info':
                default:
                    title.textContent = 'Інформація';
                    break;
            }

            const messageEl = document.createElement('div');
            messageEl.className = 'premium-notification-message';
            messageEl.textContent = message;

            content.appendChild(title);
            content.appendChild(messageEl);

            // Кнопка закриття
            const closeBtn = document.createElement('button');
            closeBtn.className = 'premium-notification-close';

            // Індикатор прогресу
            const progress = document.createElement('div');
            progress.className = 'premium-notification-progress';
            progress.style.animationDuration = (CONFIG.autoHideTimeout / 1000) + 's';

            // Збираємо елементи
            notification.appendChild(icon);
            notification.appendChild(content);
            notification.appendChild(closeBtn);
            notification.appendChild(progress);

            // Додаємо повідомлення до контейнера
            container.appendChild(notification);

            // Показуємо повідомлення після короткої затримки
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);

            // Запускаємо вібрацію для помилок на мобільних пристроях
            if (type === 'error' && navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Відтворюємо звук, якщо доступний
            if (window.UI.Animations && window.UI.Animations.playSound) {
                window.UI.Animations.playSound(type);
            }

            // Закриття при кліку на кнопку
            closeBtn.addEventListener('click', () => {
                closeNotification(notification, callback);
            });

            // Автоматичне закриття
            setTimeout(() => {
                if (notification.parentNode) { // Перевіряємо, що сповіщення все ще у DOM
                    closeNotification(notification, callback);
                }
            }, CONFIG.autoHideTimeout);
        } catch (e) {
            console.error('Помилка показу сповіщення:', e);
            // Якщо не вдалося створити сповіщення, використовуємо alert
            alert(message);
            _notificationShowing = false;
            if (callback) callback();
        }
    }

    /**
     * Закриття сповіщення
     * @param {HTMLElement} notification - DOM елемент сповіщення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function closeNotification(notification, callback = null) {
        notification.classList.remove('show');
        notification.classList.add('hide');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }

            _notificationShowing = false;

            // Показуємо наступне сповіщення з черги
            if (_notificationsQueue.length > 0) {
                const nextNotification = _notificationsQueue.shift();
                showNotification(nextNotification.message, nextNotification.type, nextNotification.callback);
            } else if (callback) {
                callback();
            }
        }, CONFIG.animationDuration);
    }

    /**
     * Показ діалогового вікна з підтвердженням
     * @param {Object} options - Опції діалогу
     * @returns {Promise} Результат вибору користувача
     */
    function showConfirmDialog(options) {
        // Якщо options - це рядок, вважаємо його повідомленням
        if (typeof options === 'string') {
            options = {
                message: options,
                title: 'Підтвердження',
                confirmText: 'Підтвердити',
                cancelText: 'Скасувати',
                type: 'default' // 'default', 'danger'
            };
        }

        // Встановлюємо значення за замовчуванням
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
                // Перевіряємо, чи існує діалог
                let confirmOverlay = document.getElementById(_confirmDialogId);

                if (!confirmOverlay) {
                    // Створюємо діалог
                    confirmOverlay = document.createElement('div');
                    confirmOverlay.id = _confirmDialogId;
                    confirmOverlay.className = 'premium-confirm-overlay';

                    const dialog = document.createElement('div');
                    dialog.className = 'premium-confirm-dialog';
                    dialog.innerHTML = `
                        <div class="premium-confirm-icon icon-${iconType}"></div>
                        <div class="premium-confirm-title">${title}</div>
                        <div class="premium-confirm-message">${message}</div>
                        <div class="premium-confirm-buttons">
                            <button class="premium-confirm-button premium-confirm-button-cancel" id="task-cancel-no">${cancelText}</button>
                            <button class="premium-confirm-button premium-confirm-button-${type === 'danger' ? 'danger' : 'confirm'}" id="task-cancel-yes">${confirmText}</button>
                        </div>
                    `;

                    confirmOverlay.appendChild(dialog);
                    document.body.appendChild(confirmOverlay);
                } else {
                    // Оновлюємо контент діалогу
                    const titleEl = confirmOverlay.querySelector('.premium-confirm-title');
                    const messageEl = confirmOverlay.querySelector('.premium-confirm-message');
                    const iconEl = confirmOverlay.querySelector('.premium-confirm-icon');
                    const confirmBtn = confirmOverlay.querySelector('#task-cancel-yes');
                    const cancelBtn = confirmOverlay.querySelector('#task-cancel-no');

                    if (titleEl) titleEl.textContent = title;
                    if (messageEl) messageEl.textContent = message;
                    if (iconEl) {
                        iconEl.className = `premium-confirm-icon icon-${iconType}`;
                    }
                    if (confirmBtn) {
                        confirmBtn.textContent = confirmText;
                        confirmBtn.className = `premium-confirm-button premium-confirm-button-${type === 'danger' ? 'danger' : 'confirm'}`;
                    }
                    if (cancelBtn) cancelBtn.textContent = cancelText;
                }

                // Отримуємо кнопки
                const cancelBtn = document.getElementById('task-cancel-no');
                const confirmBtn = document.getElementById('task-cancel-yes');

                // Замінюємо кнопки, щоб уникнути накопичення обробників подій
                if (cancelBtn) {
                    const newCancelBtn = cancelBtn.cloneNode(true);
                    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

                    // Додаємо новий обробник
                    newCancelBtn.addEventListener('click', function() {
                        confirmOverlay.classList.remove('show');
                        setTimeout(() => resolve(false), CONFIG.animationDuration);
                    });
                }

                if (confirmBtn) {
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

                    // Додаємо новий обробник
                    newConfirmBtn.addEventListener('click', function() {
                        confirmOverlay.classList.remove('show');
                        setTimeout(() => resolve(true), CONFIG.animationDuration);
                    });
                }

                // Показуємо діалог
                confirmOverlay.classList.add('show');

            } catch (e) {
                console.error('Помилка показу діалогу підтвердження:', e);
                // Використовуємо стандартний confirm
                resolve(confirm(message));
            }
        });
    }

    /**
     * Показ індикатора завантаження
     * @param {string} message - Повідомлення (опціонально)
     */
    function showLoading(message) {
        try {
            let spinner = document.getElementById(_loadingSpinnerId);

            if (!spinner) {
                // Створюємо індикатор завантаження
                const spinnerContainer = document.createElement('div');
                spinnerContainer.id = _loadingSpinnerId;
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
                // Оновлюємо повідомлення, якщо воно передане
                if (message) {
                    const messageEl = spinner.querySelector('.spinner-message');
                    if (messageEl) {
                        messageEl.textContent = message;
                    } else {
                        const newMessageEl = document.createElement('div');
                        newMessageEl.className = 'spinner-message';
                        newMessageEl.textContent = message;

                        const content = spinner.querySelector('.spinner-content');
                        if (content) {
                            content.appendChild(newMessageEl);
                        }
                    }
                }
            }

            // Показуємо індикатор
            spinner.classList.add('show');

        } catch (e) {
            console.error('Помилка показу індикатора завантаження:', e);
        }
    }

    /**
     * Приховування індикатора завантаження
     */
    function hideLoading() {
        try {
            const spinner = document.getElementById(_loadingSpinnerId);
            if (spinner) {
                spinner.classList.remove('show');
            }
        } catch (e) {
            console.error('Помилка приховування індикатора завантаження:', e);
        }
    }

    /**
     * Оновлення відображення балансу на всіх можливих елементах UI
     * @param {number} newBalance - Новий баланс
     */
    function updateBalanceUI(newBalance) {
        try {
            // 1. Безпосередньо оновлюємо DOM-елементи
            const balanceElements = [
                document.getElementById('user-tokens'),
                document.getElementById('main-balance'),
                document.querySelector('.balance-amount'),
                document.getElementById('current-balance'),
                ...document.querySelectorAll('[data-balance-display]')
            ];

            balanceElements.forEach(element => {
                if (element) {
                    // Для основного балансу з іконкою
                    if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                        const iconPart = element.querySelector('.main-balance-icon')?.outerHTML || '';
                        element.innerHTML = `${parseFloat(newBalance).toFixed(2)} ${iconPart}`;
                    } else {
                        element.textContent = parseFloat(newBalance).toFixed(2);
                    }

                    // Додаємо клас для анімації оновлення
                    element.classList.add('balance-updated');
                    setTimeout(() => {
                        element.classList.remove('balance-updated');
                    }, 1000);
                }
            });

            // 2. Зберігаємо в localStorage
            localStorage.setItem('userTokens', newBalance.toString());
            localStorage.setItem('winix_balance', newBalance.toString());

            // 3. Генеруємо подію для інших модулів
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: { newBalance: parseFloat(newBalance) }
            }));

        } catch (error) {
            console.error('Помилка оновлення відображення балансу:', error);
        }
    }

    // Ініціалізуємо модуль при завантаженні
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        showInfo,
        showSuccess,
        showError,
        showNotification,
        showConfirmDialog,
        showLoading,
        hideLoading,
        updateBalanceUI,
        init
    };
})();