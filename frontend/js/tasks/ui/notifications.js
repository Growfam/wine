/**
 * UniNotify - Уніфікована система сповіщень
 * Централізована система для сповіщень, підтверджень та індикаторів з чергою
 */

// Створюємо namespace для UI компонентів
window.UI = window.UI || {};

window.UI.Notifications = (function() {
    // Конфігурація модуля з можливістю налаштування
    const CONFIG = {
        maxVisibleNotifications: 3,    // Максимальна кількість одночасних сповіщень
        autoHideTimeout: 5000,         // Час автоматичного закриття сповіщення (мс)
        animationDuration: 300,        // Тривалість анімації (мс)
        position: 'top-right',         // Позиція сповіщень: 'top-right', 'top-center', 'bottom-right'
        enableSounds: true,            // Звукові ефекти для сповіщень
        preventDuplicates: true,       // Запобігання дублюванню сповіщень
        duplicateTimeout: 3000,        // Час, протягом якого ідентичні сповіщення вважаються дублікатами (мс)
        criticalErrorMode: 'alert',    // Що робити з критичними помилками: 'notify', 'alert', 'both'
        debugMode: false               // Режим відлагодження
    };

    // Приватні змінні
    let _notificationsShowing = 0;        // Кількість активних сповіщень
    let _notificationsQueue = [];         // Черга сповіщень
    let _recentNotifications = {};        // Нещодавні сповіщення для запобігання дублюванню
    let _containerId = 'uni-notification-container';
    let _loadingSpinnerId = 'uni-loading-spinner';
    let _confirmDialogId = 'uni-confirm-dialog';
    let _initialized = false;             // Флаг ініціалізації

    // Імена подій для внутрішньої комунікації
    const EVENTS = {
        NOTIFICATION_SHOWN: 'uni-notification-shown',
        NOTIFICATION_CLOSED: 'uni-notification-closed',
        NOTIFICATION_QUEUED: 'uni-notification-queued',
        DIALOG_SHOWN: 'uni-dialog-shown',
        DIALOG_CLOSED: 'uni-dialog-closed'
    };

    /**
     * Ініціалізація модуля сповіщень
     * @param {Object} options - Користувацькі налаштування
     */
    function init(options = {}) {
        // Запобігаємо повторній ініціалізації
        if (_initialized) return;

        log('Ініціалізація уніфікованої системи сповіщень...');

        // Застосовуємо користувацькі налаштування
        Object.assign(CONFIG, options);

        // Завантажуємо налаштування з localStorage
        loadUserSettings();

        // Додаємо стилі
        injectStyles();

        // Створюємо контейнер для сповіщень
        createNotificationContainer();

        // Перевизначаємо глобальні функції для сумісності
        overrideGlobalNotificationFunctions();

        // Встановлюємо підписки на події
        setupEventListeners();

        // Відмічаємо, що модуль ініціалізовано
        _initialized = true;

        log('Уніфікована система сповіщень ініціалізована');
    }

    /**
     * Завантаження налаштувань користувача з localStorage
     */
    function loadUserSettings() {
        try {
            // Перевіряємо налаштування звуку
            const soundsEnabled = localStorage.getItem('sounds_enabled');
            if (soundsEnabled !== null) {
                CONFIG.enableSounds = soundsEnabled === 'true';
            }

            // Можливо, інші налаштування у майбутньому
        } catch (e) {
            console.warn('Помилка завантаження налаштувань користувача:', e);
        }
    }

    /**
     * Додавання CSS стилів для сповіщень
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('uni-notification-styles')) return;

        // Створюємо елемент стилів
        const styleElement = document.createElement('style');
        styleElement.id = 'uni-notification-styles';

        // Додаємо CSS для уніфікованої системи сповіщень
        styleElement.textContent = `
            /* Загальні стилі для сповіщень */
            .uni-notification-container {
                position: fixed;
                z-index: 9999;
                width: 90%;
                max-width: 380px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            
            /* Позиціонування */
            .uni-notification-container.top-right {
                top: 20px;
                right: 20px;
            }
            
            .uni-notification-container.top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .uni-notification-container.bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            /* Стилі для сповіщення */
            .uni-notification {
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
                margin-bottom: 8px;
                overflow: hidden;
                pointer-events: auto;
                position: relative;
                max-width: 100%;
            }
            
            /* Позиціонування анімації залежно від позиції контейнера */
            .top-center .uni-notification {
                transform: translateY(-20px) scale(0.95);
            }
            
            .bottom-right .uni-notification {
                transform: translateX(50px) scale(0.95);
            }
            
            .uni-notification.show {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
            
            .top-center .uni-notification.show {
                transform: translateY(0) scale(1);
            }
            
            .bottom-right .uni-notification.show {
                transform: translateX(0) scale(1);
            }
            
            .uni-notification.hide {
                transform: translateX(50px) scale(0.95);
                opacity: 0;
            }
            
            .top-center .uni-notification.hide {
                transform: translateY(-20px) scale(0.95);
            }
            
            .bottom-right .uni-notification.hide {
                transform: translateX(50px) scale(0.95);
            }
            
            /* Кольорова лінія для типу сповіщення */
            .uni-notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(to bottom, #4DB6AC, #00C9A7);
            }
            
            .uni-notification.error::before {
                background: linear-gradient(to bottom, #FF5252, #B71C1C);
            }
            
            .uni-notification.success::before {
                background: linear-gradient(to bottom, #4CAF50, #2E7D32);
            }
            
            .uni-notification.info::before {
                background: linear-gradient(to bottom, #2196F3, #1976D2);
            }
            
            .uni-notification.warning::before {
                background: linear-gradient(to bottom, #FFC107, #FF9800);
            }
            
            /* Іконка сповіщення */
            .uni-notification-icon {
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
            
            .uni-notification .uni-notification-icon {
                background: rgba(0, 201, 167, 0.15);
            }
            
            .uni-notification.error .uni-notification-icon {
                background: rgba(244, 67, 54, 0.15);
            }
            
            .uni-notification.success .uni-notification-icon {
                background: rgba(76, 175, 80, 0.15);
            }
            
            .uni-notification.info .uni-notification-icon {
                background: rgba(33, 150, 243, 0.15);
            }
            
            .uni-notification.warning .uni-notification-icon {
                background: rgba(255, 193, 7, 0.15);
            }
            
            /* Контент сповіщення */
            .uni-notification-content {
                flex-grow: 1;
                padding-right: 8px;
                font-size: 14px;
                line-height: 1.5;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-width: calc(100% - 70px);
                word-break: break-word;
            }
            
            /* Кнопка закриття */
            .uni-notification-close {
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
                flex-shrink: 0;
            }
            
            .uni-notification-close::before,
            .uni-notification-close::after {
                content: '';
                position: absolute;
                width: 12px;
                height: 2px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 1px;
            }
            
            .uni-notification-close::before {
                transform: rotate(45deg);
            }
            
            .uni-notification-close::after {
                transform: rotate(-45deg);
            }
            
            .uni-notification-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .uni-notification-close:hover::before,
            .uni-notification-close:hover::after {
                background: white;
            }
            
            /* Прогрес-бар для автозакриття */
            .uni-notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: linear-gradient(to right, rgba(78, 181, 247, 0.5), rgba(0, 201, 167, 0.8));
                width: 100%;
                transform-origin: left;
                animation: progress-shrink var(--progress-duration, 5s) linear forwards;
            }
            
            .uni-notification.error .uni-notification-progress {
                background: linear-gradient(to right, rgba(244, 67, 54, 0.5), rgba(183, 28, 28, 0.8));
            }
            
            .uni-notification.success .uni-notification-progress {
                background: linear-gradient(to right, rgba(76, 175, 80, 0.5), rgba(46, 125, 50, 0.8));
            }
            
            .uni-notification.info .uni-notification-progress {
                background: linear-gradient(to right, rgba(33, 150, 243, 0.5), rgba(13, 71, 161, 0.8));
            }
            
            .uni-notification.warning .uni-notification-progress {
                background: linear-gradient(to right, rgba(255, 193, 7, 0.5), rgba(255, 152, 0, 0.8));
            }
            
            @keyframes progress-shrink {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
            
            /* Заголовок та повідомлення */
            .uni-notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 15px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .uni-notification-message {
                opacity: 0.9;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* Стилі для діалогу підтвердження */
            .uni-confirm-overlay {
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
            
            .uni-confirm-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .uni-confirm-dialog {
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
            
            .uni-confirm-overlay.show .uni-confirm-dialog {
                transform: scale(1);
                opacity: 1;
            }
            
            .uni-confirm-icon {
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
            
            .uni-confirm-icon.icon-question {
                background: rgba(33, 150, 243, 0.15);
            }
            
            .uni-confirm-icon.icon-warning {
                background: rgba(255, 193, 7, 0.15);
            }
            
            .uni-confirm-icon.icon-danger {
                background: rgba(244, 67, 54, 0.15);
            }
            
            .uni-confirm-title {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 12px;
                color: white;
            }
            
            .uni-confirm-message {
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 24px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .uni-confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 12px;
                width: 100%;
            }
            
            .uni-confirm-button {
                flex-basis: 45%;
                padding: 12px;
                border-radius: 12px;
                border: none;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .uni-confirm-button:active {
                transform: scale(0.97);
            }
            
            .uni-confirm-button-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            .uni-confirm-button-confirm {
                background: linear-gradient(90deg, #0288D1, #26A69A, #4CAF50);
                color: white;
            }
            
            .uni-confirm-button-danger {
                background: linear-gradient(90deg, #8B0000, #A52A2A, #B22222);
                color: white;
            }
            
            /* Стилі для індикатора завантаження */
            .uni-spinner-overlay {
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
            
            .uni-spinner-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .uni-spinner-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            }
            
            .uni-spinner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(0, 201, 167, 0.3);
                border-radius: 50%;
                border-top-color: rgb(0, 201, 167);
                animation: spin 1s linear infinite;
            }
            
            .uni-spinner-message {
                color: white;
                font-size: 16px;
                text-align: center;
                max-width: 300px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* Кількість сповіщень у черзі */
            .uni-notification-queue-badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: #FF5252;
                color: white;
                font-size: 12px;
                font-weight: bold;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transform: scale(0);
                transition: opacity 0.3s, transform 0.3s;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }
            
            .uni-notification-queue-badge.show {
                opacity: 1;
                transform: scale(1);
            }
            
            /* Адаптивність для невеликих екранів */
            @media (max-width: 480px) {
                .uni-notification-container {
                    max-width: 320px;
                    width: 95%;
                }
                
                .uni-notification-container.top-right,
                .uni-notification-container.bottom-right {
                    right: 10px;
                }
                
                .uni-notification-container.top-right,
                .uni-notification-container.top-center {
                    top: 10px;
                }
                
                .uni-notification-container.bottom-right {
                    bottom: 10px;
                }
                
                .uni-notification {
                    padding: 12px;
                }
                
                .uni-notification-icon {
                    width: 28px;
                    height: 28px;
                    min-width: 28px;
                }
                
                .uni-notification-title {
                    font-size: 14px;
                }
                
                .uni-notification-message {
                    font-size: 13px;
                }
                
                .uni-confirm-dialog {
                    padding: 20px;
                }
                
                .uni-confirm-icon {
                    width: 60px;
                    height: 60px;
                }
                
                .uni-confirm-title {
                    font-size: 18px;
                }
                
                .uni-confirm-message {
                    font-size: 14px;
                }
                
                .uni-confirm-button {
                    font-size: 14px;
                    padding: 10px;
                }
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Створення контейнера для сповіщень
     */
    function createNotificationContainer() {
        if (!document.getElementById(_containerId)) {
            const container = document.createElement('div');
            container.id = _containerId;
            container.className = 'uni-notification-container ' + CONFIG.position;

            // Додаємо індикатор черги сповіщень
            const queueBadge = document.createElement('div');
            queueBadge.className = 'uni-notification-queue-badge';
            queueBadge.textContent = '0';
            container.appendChild(queueBadge);

            document.body.appendChild(container);
        }
    }

    /**
     * Перевизначення глобальних функцій для сумісності
     */
    function overrideGlobalNotificationFunctions() {
        // Перевизначаємо функції для сповіщень
        window.showToast = function(message, isError) {
            if (isError) {
                showError(message);
            } else {
                showSuccess(message);
            }
        };

        window.showNotification = showInfo;
        window.showSuccess = showSuccess;
        window.showError = showError;
        window.showWarning = showWarning;

        // Для індикаторів завантаження
        window.showLoading = showLoading;
        window.hideLoading = hideLoading;

        // Для діалогів підтвердження
        window.showConfirm = showConfirmDialog;
        window.showConfirmDialog = showConfirmDialog;
        window.showModernConfirm = showConfirmDialog;

        // Перевизначаємо методи в існуючих модулях, якщо вони доступні
        if (window.TaskManager) {
            window.TaskManager.showSuccessMessage = showSuccess;
            window.TaskManager.showErrorMessage = showError;
            log('Перевизначено методи сповіщень в TaskManager');
        }

        if (window.DailyBonus) {
            window.DailyBonus.showSuccessMessage = showSuccess;
            window.DailyBonus.showErrorMessage = showError;
            log('Перевизначено методи сповіщень в DailyBonus');
        }

        // Делегуємо методи до UI.Notifications (для сумісності з іншими модулями)
        window.UI.showNotification = showInfo;
        window.UI.showSuccess = showSuccess;
        window.UI.showError = showError;
        window.UI.showWarning = showWarning;
    }

    /**
     * Встановлення обробників подій
     */
    function setupEventListeners() {
        // Обробник для автоматичного закриття сповіщень після натискання Escape
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                clearAllNotifications();
            }
        });

        // Обробник для видалення всіх сповіщень при зміні сторінки
        window.addEventListener('beforeunload', function() {
            clearAllNotifications(false); // Без анімації
        });

        // Обробник для адаптації під розмір екрану
        window.addEventListener('resize', function() {
            adjustNotificationsForScreenSize();
        });
    }

    /**
     * Адаптація сповіщень під розмір екрану
     */
    function adjustNotificationsForScreenSize() {
        // Адаптуємо максимальну кількість сповіщень залежно від висоти екрана
        const screenHeight = window.innerHeight;

        if (screenHeight < 600) {
            CONFIG.maxVisibleNotifications = 2;
        } else if (screenHeight < 900) {
            CONFIG.maxVisibleNotifications = 3;
        } else {
            CONFIG.maxVisibleNotifications = 4;
        }

        // Оновлюємо розмір контейнера
        const container = document.getElementById(_containerId);
        if (container) {
            if (window.innerWidth < 480) {
                container.classList.add('small-screen');
            } else {
                container.classList.remove('small-screen');
            }
        }
    }

    /**
     * Показати інформаційне сповіщення
     * @param {string|Object} message - Текст повідомлення або об'єкт конфігурації
     * @param {Function|Object} callbackOrOptions - Функція зворотнього зв'язку або додаткові опції
     * @returns {string} ID сповіщення
     */
    function showInfo(message, callbackOrOptions = null) {
        return showNotification(message, 'info', callbackOrOptions);
    }

    /**
     * Показати сповіщення про успіх
     * @param {string|Object} message - Текст повідомлення або об'єкт конфігурації
     * @param {Function|Object} callbackOrOptions - Функція зворотнього зв'язку або додаткові опції
     * @returns {string} ID сповіщення
     */
    function showSuccess(message, callbackOrOptions = null) {
        return showNotification(message, 'success', callbackOrOptions);
    }

    /**
     * Показати сповіщення про помилку
     * @param {string|Object} message - Текст повідомлення або об'єкт конфігурації
     * @param {Function|Object} callbackOrOptions - Функція зворотнього зв'язку або додаткові опції
     * @returns {string} ID сповіщення
     */
    function showError(message, callbackOrOptions = null) {
        // Для критичних помилок, можливо, показати в alert
        if (CONFIG.criticalErrorMode === 'alert' && typeof message === 'string') {
            alert(message);
            return null;
        } else if (CONFIG.criticalErrorMode === 'both' && typeof message === 'string') {
            alert(message);
        }

        return showNotification(message, 'error', callbackOrOptions);
    }

    /**
     * Показати попереджувальне сповіщення
     * @param {string|Object} message - Текст повідомлення або об'єкт конфігурації
     * @param {Function|Object} callbackOrOptions - Функція зворотнього зв'язку або додаткові опції
     * @returns {string} ID сповіщення
     */
    function showWarning(message, callbackOrOptions = null) {
        return showNotification(message, 'warning', callbackOrOptions);
    }

    /**
     * Універсальна функція показу сповіщень
     * @param {string|Object} message - Текст повідомлення або об'єкт конфігурації
     * @param {string|Function} typeOrCallback - Тип сповіщення або функція зворотнього зв'язку
     * @param {Function|Object} callbackOrOptions - Функція зворотнього зв'язку або додаткові опції
     * @returns {string} ID сповіщення
     */
    function showNotification(message, typeOrCallback = 'info', callbackOrOptions = null) {
        // Ініціалізуємо модуль, якщо це ще не зроблено
        if (!_initialized) init();

        // Обробляємо різні формати параметрів
        let type = 'info';
        let callback = null;
        let options = {};

        // Якщо message - це об'єкт з параметрами
        if (typeof message === 'object' && message !== null && !Array.isArray(message)) {
            options = message;
            message = options.message || '';
            type = options.type || 'info';
            callback = options.callback || null;
        } else {
            // Якщо typeOrCallback - це функція, то це callback
            if (typeof typeOrCallback === 'function') {
                callback = typeOrCallback;
                type = 'info';
            } else if (typeof typeOrCallback === 'string') {
                type = typeOrCallback;
            }

            // Якщо callbackOrOptions - це функція, то це callback
            if (typeof callbackOrOptions === 'function') {
                callback = callbackOrOptions;
            } else if (typeof callbackOrOptions === 'object' && callbackOrOptions !== null) {
                options = callbackOrOptions;
                callback = options.callback || callback;
            }
        }

        // Формуємо фінальний об'єкт налаштувань
        const finalOptions = {
            title: getDefaultTitle(type),
            autoClose: true,
            duration: CONFIG.autoHideTimeout,
            onClick: null,
            onClose: callback,
            id: 'notification_' + generateUniqueId(),
            ...options
        };

        // Запобігаємо показу порожніх повідомлень
        if (!message || (typeof message === 'string' && message.trim() === '')) {
            if (finalOptions.onClose) setTimeout(finalOptions.onClose, 100);
            return finalOptions.id;
        }

        // Запобігаємо дублюванню сповіщень
        if (CONFIG.preventDuplicates && isDuplicateNotification(message, type)) {
            log(`Дублікат сповіщення проігноровано: ${message}`);
            if (finalOptions.onClose) setTimeout(finalOptions.onClose, 100);
            return finalOptions.id;
        }

        // Додаємо в реєстр нещодавніх сповіщень
        addToRecentNotifications(message, type);

        // Створюємо об'єкт сповіщення для черги
        const notificationObject = {
            message,
            type,
            options: finalOptions
        };

        // Додаємо сповіщення в чергу
        _notificationsQueue.push(notificationObject);

        // Генеруємо подію
        triggerEvent(EVENTS.NOTIFICATION_QUEUED, notificationObject);

        // Оновлюємо відображення черги
        updateQueueBadge();

        // Обробляємо чергу
        processNotificationsQueue();

        // Повертаємо ID сповіщення для можливості керування ним пізніше
        return finalOptions.id;
    }

    /**
     * Обробка черги сповіщень
     */
    function processNotificationsQueue() {
        // Якщо черга порожня, немає що обробляти
        if (_notificationsQueue.length === 0) return;

        // Якщо досягнуто ліміту одночасних сповіщень, чекаємо
        if (_notificationsShowing >= CONFIG.maxVisibleNotifications) return;

        // Отримуємо наступне сповіщення з черги
        const notification = _notificationsQueue.shift();

        // Оновлюємо відображення черги
        updateQueueBadge();

        // Показуємо сповіщення
        displayNotification(notification.message, notification.type, notification.options);
    }

    /**
     * Відображення сповіщення в UI
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип сповіщення
     * @param {Object} options - Додаткові параметри
     */
    function displayNotification(message, type, options) {
        try {
            // Збільшуємо лічильник активних сповіщень
            _notificationsShowing++;

            // Перевіряємо, чи контейнер для повідомлень існує
            let container = document.getElementById(_containerId);
            if (!container) {
                createNotificationContainer();
                container = document.getElementById(_containerId);
            }

            // Створюємо сповіщення
            const notification = document.createElement('div');
            notification.className = `uni-notification ${type}`;
            notification.dataset.id = options.id;

            // Додаємо іконку
            const icon = document.createElement('div');
            icon.className = `uni-notification-icon icon-${type}`;

            // Контент повідомлення
            const content = document.createElement('div');
            content.className = 'uni-notification-content';

            // Додаємо заголовок та текст
            const title = document.createElement('div');
            title.className = 'uni-notification-title';
            title.textContent = options.title || getDefaultTitle(type);

            const messageEl = document.createElement('div');
            messageEl.className = 'uni-notification-message';
            messageEl.textContent = message;

            content.appendChild(title);
            content.appendChild(messageEl);

            // Кнопка закриття
            const closeBtn = document.createElement('button');
            closeBtn.className = 'uni-notification-close';

            // Індикатор прогресу
            const progress = document.createElement('div');
            progress.className = 'uni-notification-progress';
            progress.style.setProperty('--progress-duration', `${options.duration / 1000}s`);

            // Збираємо елементи
            notification.appendChild(icon);
            notification.appendChild(content);
            notification.appendChild(closeBtn);

            if (options.autoClose) {
                notification.appendChild(progress);
            }

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

            // Відтворюємо звук, якщо доступний і дозволений
            if (CONFIG.enableSounds) {
                if (window.UI.Animations && window.UI.Animations.playSound) {
                    window.UI.Animations.playSound(type);
                }
            }

            // Обробник кліку по сповіщенню
            if (options.onClick) {
                notification.addEventListener('click', function(event) {
                    // Перевіряємо, що клік не по кнопці закриття
                    if (!event.target.classList.contains('uni-notification-close')) {
                        options.onClick();
                    }
                });
            }

            // Закриття при кліку на кнопку
            closeBtn.addEventListener('click', () => {
                closeNotification(notification, options.onClose);
            });

            // Автоматичне закриття
            if (options.autoClose) {
                setTimeout(() => {
                    if (notification.parentNode) { // Перевіряємо, що сповіщення все ще у DOM
                        closeNotification(notification, options.onClose);
                    }
                }, options.duration);
            }

            // Генеруємо подію про показ сповіщення
            triggerEvent(EVENTS.NOTIFICATION_SHOWN, {
                id: options.id,
                type,
                message
            });

        } catch (e) {
            console.error('Помилка показу сповіщення:', e);
            // Зменшуємо лічильник, оскільки сповіщення не було показано
            _notificationsShowing--;
            // Якщо не вдалося створити сповіщення, використовуємо alert
            if (type === 'error') alert(message);
            if (options.onClose) options.onClose();

            // Обробляємо наступне сповіщення з черги
            processNotificationsQueue();
        }
    }

    /**
     * Закриття сповіщення
     * @param {HTMLElement} notification - DOM елемент сповіщення
     * @param {Function} callback - Функція зворотнього зв'язку
     */
    function closeNotification(notification, callback = null) {
        if (!notification) return;

        notification.classList.remove('show');
        notification.classList.add('hide');

        // Отримуємо ID сповіщення для події
        const notificationId = notification.dataset.id || null;

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }

            // Зменшуємо лічильник активних сповіщень
            _notificationsShowing--;

            // Генеруємо подію про закриття сповіщення
            if (notificationId) {
                triggerEvent(EVENTS.NOTIFICATION_CLOSED, { id: notificationId });
            }

            // Викликаємо callback, якщо він переданий
            if (callback) callback();

            // Обробляємо наступне сповіщення з черги
            processNotificationsQueue();

        }, CONFIG.animationDuration);
    }

    /**
     * Закриття всіх активних сповіщень
     * @param {boolean} animate - Чи анімувати закриття
     */
    function clearAllNotifications(animate = true) {
        const container = document.getElementById(_containerId);
        if (!container) return;

        // Отримуємо всі активні сповіщення
        const notifications = container.querySelectorAll('.uni-notification');

        if (animate) {
            // Закриваємо кожне сповіщення з анімацією
            notifications.forEach(notification => {
                closeNotification(notification);
            });
        } else {
            // Видаляємо всі сповіщення без анімації
            notifications.forEach(notification => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });

            // Скидаємо лічильник
            _notificationsShowing = 0;

            // Обробляємо чергу
            processNotificationsQueue();
        }

        // Очищаємо чергу
        _notificationsQueue = [];
        updateQueueBadge();
    }

    /**
     * Закриття конкретного сповіщення за ID
     * @param {string} id - ID сповіщення
     */
    function closeNotificationById(id) {
        if (!id) return;

        const container = document.getElementById(_containerId);
        if (!container) return;

        // Шукаємо сповіщення за ID
        const notification = container.querySelector(`.uni-notification[data-id="${id}"]`);
        if (notification) {
            closeNotification(notification);
        }

        // Також видаляємо з черги, якщо там є
        _notificationsQueue = _notificationsQueue.filter(item => item.options.id !== id);
        updateQueueBadge();
    }

    /**
     * Оновлення значка кількості в черзі
     */
    function updateQueueBadge() {
        const container = document.getElementById(_containerId);
        if (!container) return;

        const badge = container.querySelector('.uni-notification-queue-badge');
        if (!badge) return;

        if (_notificationsQueue.length > 0) {
            badge.textContent = _notificationsQueue.length;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
        }
    }

    /**
     * Перевірка, чи є сповіщення дублікатом
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип сповіщення
     * @returns {boolean} Чи є сповіщення дублікатом
     */
    function isDuplicateNotification(message, type) {
        // Формуємо ключ для перевірки
        const key = `${type}:${message}`;

        // Перевіряємо чи є такий ключ серед нещодавніх сповіщень
        return _recentNotifications[key] !== undefined;
    }

    /**
     * Додавання сповіщення до реєстру нещодавніх
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип сповіщення
     */
    function addToRecentNotifications(message, type) {
        // Формуємо ключ
        const key = `${type}:${message}`;

        // Зберігаємо час додавання
        _recentNotifications[key] = Date.now();

        // Очищаємо старі сповіщення
        cleanupRecentNotifications();
    }

    /**
     * Очищення старих сповіщень з реєстру
     */
    function cleanupRecentNotifications() {
        const now = Date.now();

        // Видаляємо записи, старіші за duplicateTimeout
        Object.keys(_recentNotifications).forEach(key => {
            if (now - _recentNotifications[key] > CONFIG.duplicateTimeout) {
                delete _recentNotifications[key];
            }
        });
    }

    /**
     * Отримання заголовка за замовчуванням для типу сповіщення
     * @param {string} type - Тип сповіщення
     * @returns {string} Заголовок за замовчуванням
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
     * Генерація унікального ID
     * @returns {string} Унікальний ID
     */
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Показ діалогового вікна з підтвердженням
     * @param {Object|string} options - Опції діалогу або повідомлення
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
            iconType = 'question'
        } = options;

        return new Promise((resolve) => {
            try {
                // Ініціалізуємо модуль, якщо це ще не зроблено
                if (!_initialized) init();

                // Перевіряємо, чи існує діалог
                let confirmOverlay = document.getElementById(_confirmDialogId);

                if (!confirmOverlay) {
                    // Створюємо діалог
                    confirmOverlay = document.createElement('div');
                    confirmOverlay.id = _confirmDialogId;
                    confirmOverlay.className = 'uni-confirm-overlay';

                    const dialog = document.createElement('div');
                    dialog.className = 'uni-confirm-dialog';
                    dialog.innerHTML = `
                        <div class="uni-confirm-icon icon-${iconType}"></div>
                        <div class="uni-confirm-title">${title}</div>
                        <div class="uni-confirm-message">${message}</div>
                        <div class="uni-confirm-buttons">
                            <button class="uni-confirm-button uni-confirm-button-cancel" id="uni-cancel-no">${cancelText}</button>
                            <button class="uni-confirm-button uni-confirm-button-${type === 'danger' ? 'danger' : 'confirm'}" id="uni-cancel-yes">${confirmText}</button>
                        </div>
                    `;

                    confirmOverlay.appendChild(dialog);
                    document.body.appendChild(confirmOverlay);
                } else {
                    // Оновлюємо контент діалогу
                    const titleEl = confirmOverlay.querySelector('.uni-confirm-title');
                    const messageEl = confirmOverlay.querySelector('.uni-confirm-message');
                    const iconEl = confirmOverlay.querySelector('.uni-confirm-icon');
                    const confirmBtn = confirmOverlay.querySelector('#uni-cancel-yes');
                    const cancelBtn = confirmOverlay.querySelector('#uni-cancel-no');

                    if (titleEl) titleEl.textContent = title;
                    if (messageEl) messageEl.textContent = message;
                    if (iconEl) {
                        iconEl.className = `uni-confirm-icon icon-${iconType}`;
                    }
                    if (confirmBtn) {
                        confirmBtn.textContent = confirmText;
                        confirmBtn.className = `uni-confirm-button uni-confirm-button-${type === 'danger' ? 'danger' : 'confirm'}`;
                    }
                    if (cancelBtn) cancelBtn.textContent = cancelText;
                }

                // Отримуємо кнопки
                const cancelBtn = document.getElementById('uni-cancel-no');
                const confirmBtn = document.getElementById('uni-cancel-yes');

                // Замінюємо кнопки, щоб уникнути накопичення обробників подій
                if (cancelBtn) {
                    const newCancelBtn = cancelBtn.cloneNode(true);
                    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

                    // Додаємо новий обробник
                    newCancelBtn.addEventListener('click', function() {
                        confirmOverlay.classList.remove('show');
                        setTimeout(() => {
                            triggerEvent(EVENTS.DIALOG_CLOSED, { result: false });
                            resolve(false);
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
                            triggerEvent(EVENTS.DIALOG_CLOSED, { result: true });
                            resolve(true);
                        }, CONFIG.animationDuration);
                    });
                }

                // Показуємо діалог
                confirmOverlay.classList.add('show');

                // Відтворюємо звук, якщо доступний
                if (CONFIG.enableSounds && window.UI.Animations && window.UI.Animations.playSound) {
                    window.UI.Animations.playSound('question');
                }

                // Генеруємо подію про показ діалогу
                triggerEvent(EVENTS.DIALOG_SHOWN, { type, message });

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
            // Ініціалізуємо модуль, якщо це ще не зроблено
            if (!_initialized) init();

            let spinner = document.getElementById(_loadingSpinnerId);

            if (!spinner) {
                // Створюємо індикатор завантаження
                const spinnerContainer = document.createElement('div');
                spinnerContainer.id = _loadingSpinnerId;
                spinnerContainer.className = 'uni-spinner-overlay';

                spinnerContainer.innerHTML = `
                    <div class="uni-spinner-content">
                        <div class="uni-spinner"></div>
                        ${message ? `<div class="uni-spinner-message">${message}</div>` : ''}
                    </div>
                `;

                document.body.appendChild(spinnerContainer);
                spinner = spinnerContainer;
            } else {
                // Оновлюємо повідомлення, якщо воно передане
                if (message) {
                    const messageEl = spinner.querySelector('.uni-spinner-message');
                    if (messageEl) {
                        messageEl.textContent = message;
                    } else {
                        const newMessageEl = document.createElement('div');
                        newMessageEl.className = 'uni-spinner-message';
                        newMessageEl.textContent = message;

                        const content = spinner.querySelector('.uni-spinner-content');
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
     * Зміна позиції контейнера сповіщень
     * @param {string} position - Нова позиція ('top-right', 'top-center', 'bottom-right')
     */
    function setPosition(position) {
        const validPositions = ['top-right', 'top-center', 'bottom-right'];

        if (!validPositions.includes(position)) {
            console.warn(`Невірна позиція: ${position}. Доступні опції: ${validPositions.join(', ')}`);
            return;
        }

        CONFIG.position = position;

        const container = document.getElementById(_containerId);
        if (container) {
            // Видаляємо всі існуючі класи позицій
            validPositions.forEach(pos => {
                container.classList.remove(pos);
            });

            // Додаємо новий клас позиції
            container.classList.add(position);
        }
    }

    /**
     * Зміна налаштувань сповіщень
     * @param {Object} newConfig - Нові налаштування
     */
    function updateConfig(newConfig) {
        Object.assign(CONFIG, newConfig);

        // Якщо змінилась позиція, оновлюємо її
        if (newConfig.position) {
            setPosition(newConfig.position);
        }

        // Зберігаємо налаштування в localStorage, якщо потрібно
        if (newConfig.enableSounds !== undefined) {
            localStorage.setItem('sounds_enabled', newConfig.enableSounds.toString());
        }

        log('Налаштування оновлено:', newConfig);
    }

    /**
     * Генерація події
     * @param {string} eventName - Назва події
     * @param {Object} data - Дані події
     */
    function triggerEvent(eventName, data) {
        // Створюємо подію
        const event = new CustomEvent(eventName, {
            detail: data,
            bubbles: false,
            cancelable: true
        });

        // Відправляємо подію через документ
        document.dispatchEvent(event);

        // Логуємо подію в режимі налагодження
        log(`Подія: ${eventName}`, data);
    }

    /**
     * Логування з перевіркою режиму налагодження
     * @param  {...any} args - Аргументи для логування
     */
    function log(...args) {
        if (CONFIG.debugMode) {
            console.log('[UniNotify]', ...args);
        }
    }

    // Ініціалізуємо модуль при завантаженні
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        // Основні методи
        init,
        showInfo,
        showSuccess,
        showError,
        showWarning,
        showNotification,
        showConfirmDialog,
        showLoading,
        hideLoading,

        // Керування сповіщеннями
        clearAllNotifications,
        closeNotificationById,

        // Налаштування
        setPosition,
        updateConfig,

        // Доступ до конфігурації (тільки читання)
        getConfig: () => ({ ...CONFIG }),

        // Інформація про стан
        getQueueLength: () => _notificationsQueue.length,
        isInitialized: () => _initialized
    };
})();