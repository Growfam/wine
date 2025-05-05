/**
 * Premium Notifications - повністю модернізований модуль для відображення сповіщень
 * WINIX Platform - 2025
 *
 * Функції:
 * - Преміальні анімовані сповіщення
 * - Модальні діалоги з 3D-ефектами
 * - Стильні індикатори завантаження
 * - Адаптивний дизайн для всіх пристроїв
 */

// Створюємо namespace для UI компонентів
window.UI = window.UI || {};

window.UI.Notifications = (function() {
    // Конфігурація модуля
    const CONFIG = {
        maxNotificationsAtOnce: 3,    // Максимальна кількість одночасних сповіщень
        autoHideTimeout: 5000,        // Час автоматичного закриття сповіщення (мс)
        animationDuration: 400,       // Тривалість анімації (мс)
        position: 'top-right',        // Позиція сповіщень: 'top-right', 'top-center', 'bottom-right'
        maxWidth: 380,                // Максимальна ширина сповіщення
        debug: false                  // Режим налагодження
    };

    // Приватні змінні
    let _notificationShowing = false;
    let _notificationsQueue = [];
    let _notificationsCounter = 0;
    let _containerId = 'premium-notification-container';
    let _loadingSpinnerId = 'loading-spinner';
    let _confirmDialogId = 'premium-confirm-dialog';

    /**
     * Ініціалізація модуля сповіщень
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        // Оновлюємо конфігурацію модуля
        Object.assign(CONFIG, options);

        log('Ініціалізація модуля преміум-сповіщень');

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

        // Додаємо обробники подій для закриття за Escape
        document.addEventListener('keydown', handleEscapeKey);

        log('Модуль преміум-сповіщень успішно ініціалізовано');

        return true;
    }

    /**
     * Лог для відлагодження
     * @param {string} message - Повідомлення
     * @param {*} data - Додаткові дані
     */
    function log(message, data) {
        if (CONFIG.debug) {
            console.log(`[UI.Notifications] ${message}`, data || '');
        }
    }

    /**
     * Обробка натискання клавіші Escape
     * @param {KeyboardEvent} event - Подія клавіатури
     */
    function handleEscapeKey(event) {
        if (event.key === 'Escape') {
            // Закриваємо активні діалоги
            const confirmDialog = document.getElementById(_confirmDialogId);
            if (confirmDialog && confirmDialog.classList.contains('show')) {
                confirmDialog.classList.remove('show');
                event.preventDefault();
            }

            // Закриваємо індикатор завантаження
            const loadingSpinner = document.getElementById(_loadingSpinnerId);
            if (loadingSpinner && loadingSpinner.classList.contains('show')) {
                loadingSpinner.classList.remove('show');
                event.preventDefault();
            }
        }
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
                max-width: ${CONFIG.maxWidth}px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }
            
            /* Позиціонування */
            .premium-notification-container.top-right {
                top: 20px;
                right: 20px;
            }
            
            .premium-notification-container.top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }

            .premium-notification-container.bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            /* Стилі для сповіщення */
            .premium-notification {
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(15px);
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 
                            0 16px 32px rgba(0, 0, 0, 0.3), 
                            0 0 0 1px rgba(78, 181, 247, 0.1) inset;
                display: flex;
                align-items: center;
                color: white;
                transform: translateX(50px) scale(0.95);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                           opacity 0.4s ease,
                           box-shadow 0.3s ease;
                margin-bottom: 0.5rem;
                overflow: hidden;
                pointer-events: auto;
                position: relative;
            }

            .premium-notification:hover {
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 
                            0 16px 32px rgba(0, 0, 0, 0.3), 
                            0 0 0 1px rgba(78, 181, 247, 0.2) inset;
            }
            
            /* Позиціонування анімації залежно від позиції контейнера */
            .top-center .premium-notification {
                transform: translateY(-20px) scale(0.95);
            }

            .bottom-right .premium-notification {
                transform: translateY(20px) scale(0.95);
            }
            
            .premium-notification.show {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
            
            .top-center .premium-notification.show {
                transform: translateY(0) scale(1);
            }

            .bottom-right .premium-notification.show {
                transform: translateY(0) scale(1);
            }
            
            .premium-notification.hide {
                transform: translateX(50px) scale(0.95);
                opacity: 0;
            }
            
            .top-center .premium-notification.hide {
                transform: translateY(-20px) scale(0.95);
            }

            .bottom-right .premium-notification.hide {
                transform: translateY(20px) scale(0.95);
            }
            
            /* Кольорова лінія для типу сповіщення */
            .premium-notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(to bottom, #4eb5f7, #00C9A7);
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

            .premium-notification.warning::before {
                background: linear-gradient(to bottom, #FFC107, #FF9800);
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
                margin-right: 14px;
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

            .premium-notification.warning .premium-notification-icon {
                background: rgba(255, 193, 7, 0.15);
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
                width: 26px;
                height: 26px;
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
                transition: background 0.2s ease;
            }
            
            .premium-notification-close::before {
                transform: rotate(45deg);
            }
            
            .premium-notification-close::after {
                transform: rotate(-45deg);
            }
            
            .premium-notification-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
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
                opacity: 0.7;
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

            .premium-notification.warning .premium-notification-progress {
                background: linear-gradient(to right, rgba(255, 193, 7, 0.5), rgba(255, 152, 0, 0.8));
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
                background: rgba(15, 23, 42, 0.95);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 380px;
                transform: scale(0.95) translateY(20px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
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

            .premium-confirm-dialog::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(78, 181, 247, 0.03), rgba(0, 201, 167, 0.05), rgba(15, 23, 42, 0.05));
                pointer-events: none;
                z-index: -1;
            }
            
            .premium-confirm-overlay.show .premium-confirm-dialog {
                transform: scale(1) translateY(0);
                opacity: 1;
            }
            
            .premium-confirm-icon {
                width: 80px;
                height: 80px;
                background: rgba(244, 67, 54, 0.15);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 24px;
                position: relative;
                font-size: 38px;
            }

            .premium-confirm-icon::after {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(244, 67, 54, 0.5), rgba(244, 67, 54, 0.2) 50%, rgba(244, 67, 54, 0.05));
                z-index: -1;
                opacity: 0.5;
                animation: pulse-glow 2s infinite ease-in-out;
            }

            .premium-confirm-icon.icon-warning {
                background: rgba(255, 193, 7, 0.15);
                color: #FFC107;
            }

            .premium-confirm-icon.icon-warning::after {
                background: linear-gradient(135deg, rgba(255, 193, 7, 0.5), rgba(255, 193, 7, 0.2) 50%, rgba(255, 193, 7, 0.05));
            }

            .premium-confirm-icon.icon-question {
                background: rgba(156, 39, 176, 0.15);
                color: #9C27B0;
            }

            .premium-confirm-icon.icon-question::after {
                background: linear-gradient(135deg, rgba(156, 39, 176, 0.5), rgba(156, 39, 176, 0.2) 50%, rgba(156, 39, 176, 0.05));
            }

            .premium-confirm-icon.icon-info {
                background: rgba(33, 150, 243, 0.15);
                color: #2196F3;
            }

            .premium-confirm-icon.icon-info::after {
                background: linear-gradient(135deg, rgba(33, 150, 243, 0.5), rgba(33, 150, 243, 0.2) 50%, rgba(33, 150, 243, 0.05));
            }

            .premium-confirm-icon.icon-success {
                background: rgba(76, 175, 80, 0.15);
                color: #4CAF50;
            }

            .premium-confirm-icon.icon-success::after {
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.5), rgba(76, 175, 80, 0.2) 50%, rgba(76, 175, 80, 0.05));
            }

            @keyframes pulse-glow {
                0% { opacity: 0.5; }
                50% { opacity: 0.8; }
                100% { opacity: 0.5; }
            }
            
            .premium-confirm-title {
                font-size: 22px;
                font-weight: 600;
                margin-bottom: 16px;
                color: white;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .premium-confirm-message {
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 30px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .premium-confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 16px;
                width: 100%;
            }
            
            .premium-confirm-button {
                flex-basis: 45%;
                padding: 14px;
                border-radius: 14px;
                border: none;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }

            .premium-confirm-button::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%);
                opacity: 0;
                transform: scale(0.5);
                transition: opacity 0.3s, transform 0.5s;
            }

            .premium-confirm-button:hover::before {
                opacity: 1;
                transform: scale(1);
            }
            
            .premium-confirm-button:active {
                transform: scale(0.97);
            }
            
            .premium-confirm-button-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            }

            .premium-confirm-button-cancel:hover {
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                background: rgba(255, 255, 255, 0.15);
            }
            
            .premium-confirm-button-confirm {
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                color: white;
                box-shadow: 0 4px 12px rgba(0, 201, 167, 0.3);
            }

            .premium-confirm-button-confirm:hover {
                box-shadow: 0 8px 20px rgba(0, 201, 167, 0.4);
                transform: translateY(-2px);
            }
            
            .premium-confirm-button-danger {
                background: linear-gradient(135deg, #F44336, #B71C1C);
                color: white;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
            }

            .premium-confirm-button-danger:hover {
                box-shadow: 0 8px 20px rgba(244, 67, 54, 0.4);
                transform: translateY(-2px);
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
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3),
                            0 0 0 1px rgba(78, 181, 247, 0.1) inset;
            }
            
            .spinner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(0, 201, 167, 0.2);
                border-radius: 50%;
                border-top-color: rgb(0, 201, 167);
                animation: spin 1s linear infinite;
                box-shadow: 0 0 15px rgba(0, 201, 167, 0.3);
            }
            
            .spinner-message {
                color: white;
                font-size: 16px;
                text-align: center;
                max-width: 300px;
                font-weight: 500;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
                    padding: 24px 20px;
                }
                
                .premium-confirm-icon {
                    width: 70px;
                    height: 70px;
                    font-size: 34px;
                }
                
                .premium-confirm-title {
                    font-size: 20px;
                }
                
                .premium-confirm-message {
                    font-size: 14px;
                }
                
                .premium-confirm-button {
                    font-size: 14px;
                    padding: 12px 10px;
                }

                .spinner-content {
                    padding: 30px;
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
        return showNotification(message, 'info', callback);
    }

    /**
     * Показати сповіщення про успіх
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showSuccess(message, callback = null) {
        return showNotification(message, 'success', callback);
    }

    /**
     * Показати сповіщення про помилку
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showError(message, callback = null) {
        return showNotification(message, 'error', callback);
    }

    /**
     * Показати сповіщення-попередження
     * @param {string} message - Текст повідомлення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function showWarning(message, callback = null) {
        return showNotification(message, 'warning', callback);
    }

    /**
     * Універсальна функція показу сповіщень
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип сповіщення ('info', 'success', 'error', 'warning')
     * @param {Function} callback - Функція зворотнього зв'язку
     * @param {Object} options - Додаткові параметри
     * @returns {Promise} Проміс, що завершується при закритті сповіщення
     */
    function showNotification(message, type = 'info', callback = null, options = {}) {
        // Якщо тип передано як boolean (для сумісності зі старим API)
        if (typeof type === 'boolean') {
            type = type ? 'error' : 'success';
        }

        // Якщо callback переданий як options
        if (typeof callback === 'object' && callback !== null) {
            options = callback;
            callback = null;
        }

        // Запобігаємо показу порожніх повідомлень
        if (!message || message.trim() === '') {
            if (callback) setTimeout(callback, 100);
            return Promise.resolve();
        }

        // Дозволяємо передавати об'єкт з повідомленням і заголовком
        let title = options.title || getDefaultTitle(type);
        if (typeof message === 'object') {
            title = message.title || title;
            message = message.message || message.text || '';
        }

        return new Promise((resolve) => {
            // Якщо уже показується сповіщення, додаємо в чергу
            if (_notificationShowing && _notificationsQueue.length < CONFIG.maxNotificationsAtOnce) {
                _notificationsQueue.push({
                    message,
                    type,
                    callback,
                    options: { ...options, title },
                    resolve
                });
                return;
            }

            _notificationShowing = true;
            _notificationsCounter++;
            const notificationId = `notification_${Date.now()}_${_notificationsCounter}`;

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
                notification.id = notificationId;

                // Додаємо іконку
                const icon = document.createElement('div');
                icon.className = `premium-notification-icon icon-${type}`;

                // Обираємо відповідний символ залежно від типу
                let iconContent = '';
                switch (type) {
                    case 'error':
                        iconContent = '✕';
                        break;
                    case 'success':
                        iconContent = '✓';
                        break;
                    case 'warning':
                        iconContent = '!';
                        break;
                    case 'info':
                    default:
                        iconContent = 'i';
                }
                icon.textContent = iconContent;

                // Контент повідомлення
                const content = document.createElement('div');
                content.className = 'premium-notification-content';

                // Додаємо заголовок та текст
                const titleElement = document.createElement('div');
                titleElement.className = 'premium-notification-title';
                titleElement.textContent = title;

                const messageEl = document.createElement('div');
                messageEl.className = 'premium-notification-message';
                messageEl.textContent = message;

                content.appendChild(titleElement);
                content.appendChild(messageEl);

                // Кнопка закриття
                const closeBtn = document.createElement('button');
                closeBtn.className = 'premium-notification-close';
                closeBtn.setAttribute('aria-label', 'Закрити');

                // Індикатор прогресу
                const progress = document.createElement('div');
                progress.className = 'premium-notification-progress';

                // Налаштування часу анімації прогресу
                const duration = options.duration || CONFIG.autoHideTimeout;
                progress.style.animationDuration = `${duration / 1000}s`;
                progress.style.animation = `progress-shrink ${duration / 1000}s linear forwards`;

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

                // Запускаємо вібрацію для помилок та попереджень на мобільних пристроях
                if ((type === 'error' || type === 'warning') && navigator.vibrate) {
                    navigator.vibrate(type === 'error' ? 200 : 100);
                }

                // Відтворюємо звук, якщо доступний
                if (window.UI.Animations && window.UI.Animations.playSound) {
                    window.UI.Animations.playSound(type);
                }

                // Закриття при кліку на кнопку
                closeBtn.addEventListener('click', () => {
                    closeNotification(notification, callback, resolve);
                });

                // Автоматичне закриття
                if (duration !== 0) {
                    setTimeout(() => {
                        if (notification.parentNode) { // Перевіряємо, що сповіщення все ще у DOM
                            closeNotification(notification, callback, resolve);
                        }
                    }, duration);
                }

                log(`Показано сповіщення [${type}]: ${message}`);

            } catch (e) {
                console.error('Помилка показу сповіщення:', e);
                // Якщо не вдалося створити сповіщення, використовуємо alert
                alert(message);
                _notificationShowing = false;
                if (callback) callback();
                resolve();
            }
        });
    }

    /**
     * Отримання стандартного заголовка для типу сповіщення
     * @param {string} type - Тип сповіщення
     * @returns {string} Заголовок
     */
    function getDefaultTitle(type) {
        switch (type) {
            case 'error':
                return 'Помилка';
            case 'success':
                return 'Успішно';
            case 'warning':
                return 'Увага';
            case 'info':
            default:
                return 'Інформація';
        }
    }

    /**
     * Закриття сповіщення
     * @param {HTMLElement} notification - DOM елемент сповіщення
     * @param {Function} callback - Функція зворотнього зв'язку
     * @param {Function} resolvePromise - Функція для вирішення промісу
     */
    function closeNotification(notification, callback = null, resolvePromise = null) {
        notification.classList.remove('show');
        notification.classList.add('hide');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }

            _notificationShowing = false;

            // Виконуємо callback, якщо є
            if (callback) setTimeout(() => callback(), 0);

            // Вирішуємо проміс, якщо є
            if (resolvePromise) resolvePromise();

            // Показуємо наступне сповіщення з черги
            if (_notificationsQueue.length > 0) {
                const nextNotification = _notificationsQueue.shift();
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
        }, CONFIG.animationDuration);
    }

    /**
     * Показ діалогового вікна з підтвердженням
     * @param {Object|string} options - Опції діалогу або повідомлення
     * @param {Function} confirmCallback - Функція при підтвердженні (застарілий параметр)
     * @param {Function} cancelCallback - Функція при скасуванні (застарілий параметр)
     * @returns {Promise<boolean>} Результат вибору користувача
     */
    function showConfirmDialog(options, confirmCallback, cancelCallback) {
        // Підтримка обох форматів виклику (для сумісності)
        if (typeof options === 'string') {
            if (confirmCallback || cancelCallback) {
                // Старий формат з окремими callback'ами
                return new Promise((resolve) => {
                    _showConfirmDialog({
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
                // Простий виклик з повідомленням і поверненням промісу
                return _showConfirmDialog({
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
            return _showConfirmDialog(options);
        }
    }

    /**
     * Внутрішня реалізація діалогу підтвердження
     * @param {Object} options - Опції діалогу
     * @param {Function} callback - Функція зворотного виклику (застарілий параметр)
     * @returns {Promise<boolean>} Результат вибору користувача
     */
    function _showConfirmDialog(options, callback = null) {
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
                // Спочатку приховуємо всі інші діалоги
                const existingDialogs = document.querySelectorAll('.premium-confirm-overlay');
                existingDialogs.forEach(dialog => {
                    if (dialog.id !== _confirmDialogId) {
                        dialog.classList.remove('show');
                    }
                });

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
                            <button class="premium-confirm-button premium-confirm-button-cancel" id="confirm-cancel-button">${cancelText}</button>
                            <button class="premium-confirm-button premium-confirm-button-${type === 'danger' ? 'danger' : 'confirm'}" id="confirm-yes-button">${confirmText}</button>
                        </div>
                    `;

                    confirmOverlay.appendChild(dialog);
                    document.body.appendChild(confirmOverlay);
                } else {
                    // Оновлюємо контент діалогу
                    const titleEl = confirmOverlay.querySelector('.premium-confirm-title');
                    const messageEl = confirmOverlay.querySelector('.premium-confirm-message');
                    const iconEl = confirmOverlay.querySelector('.premium-confirm-icon');
                    const confirmBtn = confirmOverlay.querySelector('#confirm-yes-button');
                    const cancelBtn = confirmOverlay.querySelector('#confirm-cancel-button');

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
                const cancelBtn = document.getElementById('confirm-cancel-button');
                const confirmBtn = document.getElementById('confirm-yes-button');

                // Замінюємо кнопки, щоб уникнути накопичення обробників подій
                if (cancelBtn) {
                    const newCancelBtn = cancelBtn.cloneNode(true);
                    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

                    // Додаємо новий обробник
                    newCancelBtn.addEventListener('click', function() {
                        confirmOverlay.classList.remove('show');
                        setTimeout(() => {
                            const result = false;
                            if (callback) callback(result);
                            resolve(result);
                        }, CONFIG.animationDuration);
                    });
                }

                if (confirmBtn) {
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

                    // Додаємо новий обробник
                    newConfirmBtn.addEventListener('click', function() {
                        confirmOverlay.classList.remove('show');
                        setTimeout(() => {
                            const result = true;
                            if (callback) callback(result);
                            resolve(result);
                        }, CONFIG.animationDuration);
                    });
                }

                // Показуємо діалог
                confirmOverlay.classList.add('show');

                log('Показано діалог підтвердження', options);

            } catch (e) {
                console.error('Помилка показу діалогу підтвердження:', e);
                // Використовуємо стандартний confirm
                const result = confirm(message);
                if (callback) callback(result);
                resolve(result);
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
            const spinner = document.getElementById(_loadingSpinnerId);
            if (spinner) {
                spinner.classList.remove('show');
                log('Приховано індикатор завантаження');
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

            log('Оновлено баланс', newBalance);

        } catch (error) {
            console.error('Помилка оновлення відображення балансу:', error);
        }
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