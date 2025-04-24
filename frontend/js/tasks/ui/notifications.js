/**
 * Notifications - модуль для відображення сповіщень та повідомлень
 * Відповідає за:
 * - Показ сповіщень про успіх, помилки та інформаційних повідомлень
 * - Управління чергою сповіщень
 * - Стилізацію сповіщень
 */

// Створюємо namespace для UI компонентів, якщо його ще немає
window.UI = window.UI || {};

window.UI.Notifications = (function() {
    // Максимальна кількість одночасних сповіщень
    const MAX_NOTIFICATIONS = 3;

    // Тривалість відображення сповіщення за замовчуванням
    const DEFAULT_DURATION = 3000;

    // Черга сповіщень, які очікують відображення
    const notificationQueue = [];

    // Контейнер для сповіщень
    let notificationsContainer;

    /**
     * Ініціалізація модуля сповіщень
     */
    function init() {
        console.log('UI.Notifications: Ініціалізація модуля сповіщень');

        // Додаємо стилі
        injectStyles();

        // Створюємо контейнер для сповіщень, якщо його ще немає
        if (!document.getElementById('notifications-container')) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'notifications-container';
            document.body.appendChild(notificationsContainer);
        } else {
            notificationsContainer = document.getElementById('notifications-container');
        }
    }

    /**
     * Показати сповіщення про успіх
     * @param {string} message - Текст повідомлення
     * @param {number} duration - Тривалість відображення в мс
     */
    function showSuccess(message, duration = DEFAULT_DURATION) {
        showNotification(message, 'success', duration);
    }

    /**
     * Показати сповіщення про помилку
     * @param {string} message - Текст повідомлення
     * @param {number} duration - Тривалість відображення в мс
     */
    function showError(message, duration = DEFAULT_DURATION) {
        showNotification(message, 'error', duration);
    }

    /**
     * Показати інформаційне сповіщення
     * @param {string} message - Текст повідомлення
     * @param {number} duration - Тривалість відображення в мс
     */
    function showInfo(message, duration = DEFAULT_DURATION) {
        showNotification(message, 'info', duration);
    }

    /**
     * Показати сповіщення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип сповіщення ('success', 'error', 'info')
     * @param {number} duration - Тривалість відображення в мс
     */
    function showNotification(message, type = 'info', duration = DEFAULT_DURATION) {
        // Перевіряємо, чи ініціалізовано модуль
        if (!notificationsContainer) {
            init();
        }

        // Створюємо об'єкт сповіщення
        const notification = {
            message,
            type,
            duration,
            id: Date.now().toString()
        };

        // Додаємо до черги
        notificationQueue.push(notification);

        // Оброблюємо чергу
        processQueue();
    }

    /**
     * Обробка черги сповіщень
     */
    function processQueue() {
        // Отримуємо поточні відображені сповіщення
        const currentNotifications = notificationsContainer.querySelectorAll('.notification');

        // Якщо відображено максимальну кількість, виходимо
        if (currentNotifications.length >= MAX_NOTIFICATIONS) {
            return;
        }

        // Якщо черга пуста, виходимо
        if (notificationQueue.length === 0) {
            return;
        }

        // Беремо перше сповіщення з черги
        const notification = notificationQueue.shift();

        // Створюємо елемент сповіщення
        const notificationElement = createNotificationElement(notification);

        // Додаємо до контейнера
        notificationsContainer.appendChild(notificationElement);

        // Запускаємо анімацію появи
        setTimeout(() => {
            notificationElement.classList.add('show');
        }, 10);

        // Додаємо вібрацію для помилок, якщо пристрій підтримує
        if (notification.type === 'error' && navigator.vibrate) {
            navigator.vibrate(200);
        }

        // Відтворюємо звук, якщо доступний
        if (window.UI.Animations && window.UI.Animations.playSound) {
            window.UI.Animations.playSound(notification.type);
        }

        // Таймер для автоматичного закриття
        const closeTimer = setTimeout(() => {
            closeNotification(notificationElement);
        }, notification.duration);

        // Зберігаємо таймер в елементі
        notificationElement.dataset.closeTimer = closeTimer;
    }

    /**
     * Створення елементу сповіщення
     */
    function createNotificationElement(notification) {
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification ${notification.type}`;
        notificationElement.dataset.id = notification.id;

        // Додаємо іконку залежно від типу
        let iconHtml = '';
        switch (notification.type) {
            case 'success':
                iconHtml = '<div class="notification-icon">✓</div>';
                break;
            case 'error':
                iconHtml = '<div class="notification-icon">✕</div>';
                break;
            case 'info':
                iconHtml = '<div class="notification-icon">ℹ</div>';
                break;
        }

        // Наповнюємо контент
        notificationElement.innerHTML = `
            ${iconHtml}
            <div class="notification-message">${escapeHtml(notification.message)}</div>
            <div class="notification-close">×</div>
        `;

        // Додаємо обробник для закриття
        const closeButton = notificationElement.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                closeNotification(notificationElement);
            });
        }

        return notificationElement;
    }

    /**
     * Закриття сповіщення
     */
    function closeNotification(notificationElement) {
        // Очищаємо таймер, якщо він є
        if (notificationElement.dataset.closeTimer) {
            clearTimeout(parseInt(notificationElement.dataset.closeTimer));
        }

        // Запускаємо анімацію виходу
        notificationElement.classList.remove('show');

        // Видаляємо елемент після завершення анімації
        setTimeout(() => {
            notificationElement.remove();

            // Обробляємо наступне сповіщення в черзі
            processQueue();
        }, 300);
    }

    /**
     * Додати стилі для сповіщень
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('notifications-styles')) return;

        // Створюємо елемент стилів
        const styleElement = document.createElement('style');
        styleElement.id = 'notifications-styles';

        // Додаємо CSS для сповіщень
        styleElement.textContent = `
            /* Контейнер для сповіщень */
            #notifications-container {
                position: fixed;
                top: 0.625rem; /* 10px */
                left: 50%;
                transform: translateX(-50%);
                width: 90%;
                max-width: 25rem; /* 400px */
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 0.625rem; /* 10px */
                pointer-events: none;
            }
            
            /* Стилі для сповіщення */
            .notification {
                background: linear-gradient(135deg, #1A1A2E, #0F3460);
                color: #fff;
                padding: 0.75rem 1rem; /* 12px 16px */
                border-radius: 0.75rem; /* 12px */
                box-shadow: 0 0.25rem 0.625rem rgba(0, 0, 0, 0.3); /* 0 4px 10px */
                display: flex;
                align-items: center;
                gap: 0.75rem; /* 12px */
                transform: translateY(-1.25rem); /* -20px */
                opacity: 0;
                transition: transform 0.3s ease, opacity 0.3s ease;
                pointer-events: all;
                max-width: 100%;
                overflow: hidden;
                position: relative;
            }
            
            /* Стилі для показаного сповіщення */
            .notification.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            /* Іконка сповіщення */
            .notification-icon {
                width: 1.5rem; /* 24px */
                height: 1.5rem;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                flex-shrink: 0;
            }
            
            /* Текст сповіщення */
            .notification-message {
                flex: 1;
                font-size: 0.9375rem; /* 15px */
                word-break: break-word;
            }
            
            /* Кнопка закриття */
            .notification-close {
                width: 1.25rem; /* 20px */
                height: 1.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 1.25rem; /* 20px */
                color: rgba(255, 255, 255, 0.7);
                transition: color 0.2s ease;
                flex-shrink: 0;
            }
            
            .notification-close:hover {
                color: #fff;
            }
            
            /* Прогрес-бар для автозакриття */
            .notification::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 0.1875rem; /* 3px */
                background: rgba(255, 255, 255, 0.3);
                transform-origin: left;
                animation: notification-timer linear forwards;
            }
            
            /* Типи сповіщень */
            .notification.success {
                background: linear-gradient(135deg, #4CAF50, #2E7D32);
                border-left: 0.25rem solid #4CAF50; /* 4px */
            }
            
            .notification.success .notification-icon {
                background-color: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }
            
            .notification.error {
                background: linear-gradient(135deg, #F44336, #D32F2F);
                border-left: 0.25rem solid #F44336; /* 4px */
            }
            
            .notification.error .notification-icon {
                background-color: rgba(244, 67, 54, 0.2);
                color: #F44336;
            }
            
            .notification.info {
                background: linear-gradient(135deg, #2196F3, #1976D2);
                border-left: 0.25rem solid #2196F3; /* 4px */
            }
            
            .notification.info .notification-icon {
                background-color: rgba(33, 150, 243, 0.2);
                color: #2196F3;
            }
            
            /* Анімація для таймера автозакриття */
            @keyframes notification-timer {
                0% {
                    transform: scaleX(1);
                }
                100% {
                    transform: scaleX(0);
                }
            }
            
            /* Адаптивність для мобільних пристроїв */
            @media (max-width: 450px) {
                #notifications-container {
                    top: 0.3125rem; /* 5px */
                    max-width: 93%;
                }
                
                .notification {
                    padding: 0.625rem 0.75rem; /* 10px 12px */
                }
                
                .notification-message {
                    font-size: 0.875rem; /* 14px */
                }
            }
        `;

        // Додаємо правило анімації для кожного типу сповіщення
        const animationCss = `
            .notification.success::after {
                animation-duration: var(--duration, 3s);
                background: rgba(76, 175, 80, 0.5);
            }
            
            .notification.error::after {
                animation-duration: var(--duration, 3s);
                background: rgba(244, 67, 54, 0.5);
            }
            
            .notification.info::after {
                animation-duration: var(--duration, 3s);
                background: rgba(33, 150, 243, 0.5);
            }
        `;

        styleElement.textContent += animationCss;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Функція для безпечного виведення HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Ініціалізуємо модуль під час завантаження
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        showSuccess,
        showError,
        showInfo,
        showNotification,
        init
    };
})();