/**
 * WINIX - Преміальні модальні вікна (modal.js)
 * Універсальний компонент модального вікна з сучасним дизайном
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Перевіряємо, чи вже є глобальна функція showModal
    if (typeof window.showModal === 'function') {
        console.log('✅ Функція showModal вже існує');
        return;
    }

    console.log('🔄 Ініціалізація модуля преміальних модальних вікон...');

    // Додаємо базові стилі для модальних вікон в стилі original-index.html
    if (!document.getElementById('premium-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'premium-modal-styles';
        style.textContent = `
            /* Базові стилі модальних вікон */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(3px);
                z-index: 100;
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
            }

            .modal-overlay.show {
                opacity: 1;
                visibility: visible;
            }

            .modal-container {
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                background: linear-gradient(145deg, #1A1A2E, #0F3460);
                border-radius: 1.25rem;
                overflow-y: auto;
                box-shadow: 0 0.625rem 1.25rem rgba(0, 0, 0, 0.5);
                transform: scale(0.9);
                opacity: 0;
                transition: transform 0.3s, opacity 0.3s;
            }

            .modal-overlay.show .modal-container {
                transform: scale(1);
                opacity: 1;
            }

            .modal-header {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 1rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                position: relative;
            }

            .modal-title {
                font-size: 1.25rem;
                font-weight: bold;
                color: white;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .modal-close {
                position: absolute;
                right: 15px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 1.5rem;
                cursor: pointer;
                transition: color 0.2s;
                background: none;
                border: none;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }

            .modal-close:hover {
                color: white;
                background: rgba(255, 255, 255, 0.1);
            }

            .modal-body {
                padding: 1rem;
                color: #ffffff;
            }

            .modal-footer {
                padding: 1rem;
                display: flex;
                justify-content: flex-end;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            /* Преміальні стилі для модальних вікон */
            .premium-modal .modal-container {
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.95), rgba(15, 52, 96, 0.95));
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(78, 181, 247, 0.15) inset;
                border-radius: 20px;
                overflow: hidden;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                animation: modal-appear 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            }
            
            .premium-modal .modal-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg,
                    rgba(0, 201, 167, 0),
                    rgba(0, 201, 167, 0.8),
                    rgba(0, 201, 167, 0));
                animation: glow-line 2s infinite;
            }
            
            @keyframes glow-line {
                0% { opacity: 0.3; transform: translateX(-100%); }
                50% { opacity: 1; }
                100% { opacity: 0.3; transform: translateX(100%); }
            }
            
            @keyframes modal-appear {
                0% { transform: scale(0.8); opacity: 0; }
                70% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            
            .premium-modal .modal-header {
                background: linear-gradient(90deg, rgba(30, 39, 70, 0.8), rgba(30, 39, 70, 0.9));
                padding: 20px;
                position: relative;
                border-bottom: 1px solid rgba(78, 181, 247, 0.2);
            }
            
            .premium-modal .modal-title {
                font-size: 22px;
                font-weight: bold;
                color: white;
                margin: 0;
                text-align: center;
                text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
            }
            
            .premium-modal .modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .premium-modal .modal-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }
            
            /* Стилі для розіграшів */
            .raffle-details-modal {
                padding: 0;
            }
            
            .raffle-image {
                width: 100%;
                height: 180px;
                object-fit: cover;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            
            .raffle-details {
                padding: 20px;
            }
            
            .raffle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .raffle-title {
                font-size: 20px;
                font-weight: bold;
                color: white;
                text-shadow: 0 0 0.3125rem rgba(0, 0, 0, 0.5);
                margin: 0;
            }
            
            .raffle-prize {
                display: inline-block;
                padding: 0.25rem 0.625rem;
                background: linear-gradient(90deg, #FFD700, #00dfd1);
                border-radius: 1rem;
                font-size: 1rem;
                color: #1A1A2E;
                font-weight: bold;
            }
            
            .timer-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0.625rem 0;
                gap: 0.5rem;
            }
            
            .timer-block {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 0.5rem;
                padding: 0.5rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 3.5rem;
                width: 3.5rem;
                height: 4.5rem;
                justify-content: center;
            }
            
            .timer-value {
                font-size: 1.25rem;
                font-weight: bold;
                color: white;
                font-family: 'Arial', sans-serif;
                width: 2.5rem;
                text-align: center;
                height: 1.5rem;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .timer-label {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .prize-distribution {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 0.75rem;
                padding: 0.75rem;
                margin: 0.75rem 0;
            }
            
            .prize-distribution-title {
                font-size: 1rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
                color: white;
            }
            
            .prize-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .prize-item {
                display: flex;
                justify-content: space-between;
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .prize-place {
                font-weight: bold;
            }
            
            .prize-value {
                color: var(--premium-color, #ffc107);
            }
            
            .raffle-participants {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 0.625rem 0;
            }
            
            .participants-info {
                font-size: 0.875rem;
                color: white;
            }
            
            .participants-count {
                font-weight: bold;
                margin-left: 0.25rem;
            }
            
            /* Кнопка для дій */
            .action-button, .premium-close-button {
                width: 100%;
                padding: 14px;
                background: linear-gradient(90deg, #1A1A2E, #0F3460, #00C9A7);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 15px;
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            }
            
            .action-button::before, .premium-close-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg,
                    rgba(255, 255, 255, 0),
                    rgba(255, 255, 255, 0.2),
                    rgba(255, 255, 255, 0));
                transition: all 0.6s;
            }
            
            .action-button:hover, .premium-close-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
            }
            
            .action-button:hover::before, .premium-close-button:hover::before {
                left: 100%;
            }
            
            .action-button:active, .premium-close-button:active {
                transform: translateY(0);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            
            /* Преміальні сповіщення */
            .premium-notification-container {
                position: fixed;
                top: 1.25rem;
                right: 1.25rem;
                z-index: 9999;
                width: 90%;
                max-width: 380px;
                display: flex;
                flex-direction: column;
                gap: 0.625rem;
                pointer-events: none;
            }
            
            .premium-notification {
                background: rgba(30, 39, 70, 0.85);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(78, 181, 247, 0.1) inset;
                display: flex;
                align-items: center;
                color: white;
                transform: translateX(50px) scale(0.95);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
                margin-bottom: 0.5rem;
                overflow: hidden;
                pointer-events: auto;
                position: relative;
            }
            
            .premium-notification.show {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
            
            .premium-notification.hide {
                transform: translateX(50px) scale(0.95);
                opacity: 0;
            }
            
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
            
            .premium-notification-icon {
                width: 32px;
                height: 32px;
                min-width: 32px;
                border-radius: 50%;
                background: rgba(0, 201, 167, 0.15);
                display: flex;
                justify-content: center;
                align-items: center;
                margin-right: 12px;
                font-size: 18px;
            }
            
            .premium-notification.error .premium-notification-icon {
                background: rgba(244, 67, 54, 0.15);
            }
            
            .premium-notification.success .premium-notification-icon {
                background: rgba(76, 175, 80, 0.15);
            }
            
            .premium-notification-content {
                flex-grow: 1;
                padding-right: 8px;
                font-size: 14px;
                line-height: 1.5;
            }
            
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
            }
            
            .premium-notification-close:hover {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }
            
            .premium-notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: linear-gradient(to right, rgba(78, 181, 247, 0.5), rgba(0, 201, 167, 0.8));
                width: 100%;
                transform-origin: left;
                animation: progress-shrink 3s linear forwards;
            }
            
            .premium-notification.error .premium-notification-progress {
                background: linear-gradient(to right, rgba(244, 67, 54, 0.5), rgba(183, 28, 28, 0.8));
            }
            
            .premium-notification.success .premium-notification-progress {
                background: linear-gradient(to right, rgba(76, 175, 80, 0.5), rgba(46, 125, 50, 0.8));
            }
            
            @keyframes progress-shrink {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
            
            .premium-notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 15px;
            }
            
            .premium-notification-message {
                opacity: 0.9;
            }
            
            /* Стиль для модального вікна підтвердження */
            .confirm-modal {
                text-align: center;
                padding: 10px;
            }
            
            .confirm-message {
                font-size: 1.1rem;
                margin-bottom: 20px;
            }
            
            .confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 15px;
            }
            
            .confirm-button-yes, .confirm-button-no {
                padding: 10px 25px;
                border-radius: 25px;
                border: none;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .confirm-button-yes {
                background: linear-gradient(90deg, #4CAF50, #009688);
                color: white;
            }
            
            .confirm-button-no {
                background: linear-gradient(90deg, #f44336, #e53935);
                color: white;
            }
            
            .confirm-button-yes:hover, .confirm-button-no:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            }
            
            /* Додаткові стилі для відображення інформації про участь */
            .participation-status {
                display: flex;
                gap: 12px;
                padding: 15px;
                border-radius: 10px;
                background: rgba(26, 32, 56, 0.5);
                margin-top: 15px;
                border: 1px solid rgba(76, 175, 80, 0.2);
            }
            
            .participation-status.not-participating {
                border-color: rgba(244, 67, 54, 0.2);
            }
            
            .status-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(76, 175, 80, 0.1);
                flex-shrink: 0;
            }
            
            .participation-status.not-participating .status-icon {
                background: rgba(244, 67, 54, 0.1);
            }
            
            .status-text {
                flex-grow: 1;
            }
            
            .status-text p {
                margin: 0;
                line-height: 1.4;
            }
            
            .tickets-count {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 5px !important;
            }
            
            .tickets-count span {
                color: #4CAF50;
                font-weight: bold;
            }
            
            /* Графік */
            .chart-container {
                height: 200px;
                margin: 20px 0;
                background-color: rgba(30, 39, 70, 0.5);
                border-radius: 8px;
                padding: 15px;
                position: relative;
            }
            
            .chart-bar {
                position: absolute;
                bottom: 15px;
                width: 12%;
                background: linear-gradient(to top, #4eb5f7, #52C0BD);
                border-radius: 3px 3px 0 0;
                transition: height 1s ease;
            }
            
            .chart-bar:nth-child(odd) {
                background: linear-gradient(to top, #00C9A7, #4eb5f7);
            }
            
            .chart-label {
                position: absolute;
                bottom: -25px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                width: 12%;
                text-align: center;
            }
            
            .chart-title {
                text-align: center;
                color: #fff;
                margin-bottom: 15px;
                font-size: 14px;
            }
            
            /* Адаптивність для мобільних пристроїв */
            @media (max-width: 450px) {
                .premium-notification-container {
                    right: 1rem;
                    width: calc(100% - 2rem);
                }
                
                .modal-container {
                    width: 95%;
                }
                
                .chart-container {
                    height: 150px;
                }
                
                .chart-label {
                    font-size: 10px;
                }
                
                .confirm-buttons {
                    flex-direction: column;
                }
                
                .confirm-button-yes, .confirm-button-no {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Функція відображення модального вікна
     * @param {string} title - Заголовок модального вікна
     * @param {string} content - HTML-вміст модального вікна
     * @param {Object} options - Додаткові параметри
     */
    window.showModal = function(title, content, options = {}) {
        // Опції за замовчуванням
        const defaultOptions = {
            width: '90%',       // Ширина модального вікна
            maxWidth: '600px',  // Максимальна ширина
            closeOnBackdrop: true, // Закривати при кліку на фон
            closeAfter: 0,      // Автоматичне закриття через N мс (0 - не закривати)
            onClose: null,      // Callback при закритті
            premium: true,      // Використовувати преміальний стиль
            animation: true     // Використовувати анімацію
        };

        // Об'єднуємо опції за замовчуванням з переданими опціями
        const settings = { ...defaultOptions, ...options };

        // Видаляємо існуюче модальне вікно, якщо воно є
        const existingModal = document.querySelector('.modal-container');
        if (existingModal && existingModal.parentNode) {
            existingModal.parentNode.removeChild(existingModal);
        }

        // Створюємо контейнер модального вікна
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay' + (settings.premium ? ' premium-modal' : '');

        // Створюємо HTML модального вікна
        modalOverlay.innerHTML = `
            <div class="modal-container">
                ${title ? `
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                ` : ''}
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        // Додаємо модальне вікно до DOM
        document.body.appendChild(modalOverlay);

        // Застосовуємо користувацькі стилі
        const modalContent = modalOverlay.querySelector('.modal-container');
        modalContent.style.width = settings.width;
        modalContent.style.maxWidth = settings.maxWidth;

        // Додаємо клас show з невеликою затримкою для анімації
        setTimeout(() => {
            modalOverlay.classList.add('show');
        }, 10);

        // Запобігаємо прокрутці сторінки під модальним вікном
        document.body.style.overflow = 'hidden';

        // Функція для закриття модального вікна з анімацією
        const closeModal = () => {
            // Видаляємо клас show для анімації закриття
            modalOverlay.classList.remove('show');

            // Чекаємо завершення анімації і видаляємо модальне вікно
            setTimeout(() => {
                // Перевіряємо чи модальне вікно все ще існує в DOM
                if (document.body.contains(modalOverlay)) {
                    document.body.removeChild(modalOverlay);
                }

                // Відновлюємо прокрутку
                document.body.style.overflow = '';

                // Викликаємо callback, якщо він переданий
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, settings.animation ? 300 : 0); // Час анімації або 0, якщо анімація вимкнена
        };

        // Додаємо обробник кліку для закриття модального вікна
        const closeButton = modalOverlay.querySelector('.modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', closeModal);
        }

        // Якщо увімкнено закриття при кліку на фон
        if (settings.closeOnBackdrop) {
            modalOverlay.addEventListener('click', function(e) {
                if (e.target === modalOverlay) {
                    closeModal();
                }
            });
        }

        // Додаємо обробник для кнопки Escape
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeModal();
                // Видаляємо обробник після закриття
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Автоматичне закриття, якщо вказано
        if (settings.closeAfter > 0) {
            setTimeout(closeModal, settings.closeAfter);
        }

        // Повертаємо функцію закриття модального вікна
        return closeModal;
    };

    /**
     * Преміальні сповіщення в стилі WINIX
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи є це повідомлення про помилку
     * @param {Function} callback - Функція зворотного виклику
     */
    window.showPremiumNotification = function(message, isError = false, callback = null) {
        // Запобігаємо показу порожніх повідомлень
        if (!message || message.trim() === '') {
            if (callback) setTimeout(callback, 100);
            return;
        }

        try {
            // Перевіряємо, чи контейнер для повідомлень вже існує
            let container = document.getElementById('premium-notification-container');

            if (!container) {
                container = document.createElement('div');
                container.id = 'premium-notification-container';
                container.className = 'premium-notification-container';
                document.body.appendChild(container);
            }

            // Створюємо повідомлення
            const notification = document.createElement('div');
            notification.className = `premium-notification ${isError ? 'error' : 'success'}`;

            // Додаємо іконку
            const icon = document.createElement('div');
            icon.className = 'premium-notification-icon';
            icon.innerHTML = isError ? '&#10060;' : '&#10004;';

            // Контент повідомлення
            const content = document.createElement('div');
            content.className = 'premium-notification-content';

            // Додаємо заголовок та текст
            const title = document.createElement('div');
            title.className = 'premium-notification-title';
            title.textContent = isError ? 'Помилка' : 'Успішно';

            const messageEl = document.createElement('div');
            messageEl.className = 'premium-notification-message';
            messageEl.textContent = message;

            content.appendChild(title);
            content.appendChild(messageEl);

            // Кнопка закриття
            const closeBtn = document.createElement('button');
            closeBtn.className = 'premium-notification-close';
            closeBtn.innerHTML = '&times;';

            // Індикатор прогресу
            const progress = document.createElement('div');
            progress.className = 'premium-notification-progress';

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

            // Закриття при кліку на кнопку
            closeBtn.addEventListener('click', () => {
                notification.classList.remove('show');
                notification.classList.add('hide');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                    if (callback) callback();
                }, 300);
            });

            // Автоматичне закриття
            setTimeout(() => {
                if (!notification.classList.contains('hide')) {
                    notification.classList.remove('show');
                    notification.classList.add('hide');
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                        if (callback) callback();
                    }, 300);
                }
            }, 5000);
        } catch (e) {
            console.error('Помилка показу повідомлення:', e);
            // Якщо не вдалося створити повідомлення, використовуємо alert
            alert(message);
            if (callback) callback();
        }
    };

    // Перевизначаємо стандартний showToast, щоб використовував преміальний стиль
    window.showToast = function(message, type = 'info') {
        const isError = type === 'error';
        window.showPremiumNotification(message, isError);
    };

    /**
     * Функція для показу діалогового вікна підтвердження
     * @param {string} title - Заголовок діалогу
     * @param {string} message - Текст повідомлення
     * @param {Function} onConfirm - Функція при підтвердженні
     * @param {Function} onCancel - Функція при скасуванні
     */
    window.showConfirmModal = function(title, message, onConfirm, onCancel) {
        const content = `
            <div class="confirm-modal">
                <p class="confirm-message">${message}</p>
                <div class="confirm-buttons">
                    <button class="confirm-button-yes">Так</button>
                    <button class="confirm-button-no">Ні</button>
                </div>
            </div>
        `;

        // Відображаємо модальне вікно
        const closeModal = window.showModal(title, content, {
            width: '85%',
            maxWidth: '400px'
        });

        // Додаємо обробники для кнопок
        setTimeout(() => {
            const yesButton = document.querySelector('.confirm-button-yes');
            const noButton = document.querySelector('.confirm-button-no');

            yesButton.addEventListener('click', () => {
                closeModal();
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            });

            noButton.addEventListener('click', () => {
                closeModal();
                if (typeof onCancel === 'function') {
                    onCancel();
                }
            });
        }, 100);
    };

    /**
     * Функція для показу модального вікна з відображенням деталей розіграшу
     * Оновлений преміальний дизайн, що відповідає стилю сторінки
     * @param {Object} raffle - Об'єкт з даними розіграшу
     * @param {boolean} isParticipating - Чи бере участь користувач
     * @param {number} ticketCount - Кількість білетів користувача
     */
    window.showRaffleDetailsModal = function(raffle, isParticipating = false, ticketCount = 0) {
        // Перевірка наявності об'єкта розіграшу
        if (!raffle || !raffle.id) {
            console.error('❌ Помилка: невалідний об\'єкт розіграшу');
            window.showToast('Неможливо відобразити деталі розіграшу', 'error');
            return;
        }

        // Формуємо випадкові дані для графіка (у реальному додатку можна отримати з API)
        const chartData = {
            labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
            values: [
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50
            ]
        };

        // Визначаємо максимальне значення для масштабування
        const maxValue = Math.max(...chartData.values);

        // Створюємо HTML для графіка
        let chartHtml = `
            <div class="raffle-section">
                <h3 class="section-title">Статистика участі</h3>
                <p class="chart-title">Кількість учасників за останні 5 днів</p>
                <div class="chart-container">
        `;

        // Додаємо стовпці та підписи
        chartData.values.forEach((value, index) => {
            const heightPercent = (value / maxValue) * 100;
            chartHtml += `
                <div class="chart-bar" style="left: ${index * 17 + 5}%; height: ${heightPercent}%"></div>
                <div class="chart-label" style="left: ${index * 17 + 5}%">${chartData.labels[index]}</div>
            `;
        });

        chartHtml += `
                </div>
            </div>
        `;

        // Форматуємо дату завершення
        const formattedEndDate = this.formatDateTime ? this.formatDateTime(raffle.end_time) :
            new Date(raffle.end_time).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

        // Створюємо HTML для розподілу призів
        let prizeDistributionHtml = '';
        if (raffle.prize_distribution && Array.isArray(raffle.prize_distribution)) {
            prizeDistributionHtml = `
                <div class="raffle-section">
                    <h3 class="section-title">Розподіл призів</h3>
                    <ul class="prizes-list">
            `;

            raffle.prize_distribution.forEach((prize, index) => {
                prizeDistributionHtml += `
                    <li class="prize-item">
                        <div class="prize-place">
                            <div class="prize-icon">${index + 1}</div>
                            <span>${index + 1} місце</span>
                        </div>
                        <div class="prize-amount">${prize.amount} ${prize.currency || raffle.prize_currency}</div>
                    </li>
                `;
            });

            prizeDistributionHtml += `
                    </ul>
                </div>
            `;
        } else if (raffle.winners_count > 1) {
            // Якщо є декілька переможців, але немає точного розподілу
            const avgPrize = Math.floor(raffle.prize_amount / raffle.winners_count);
            prizeDistributionHtml = `
                <div class="raffle-section">
                    <h3 class="section-title">Розподіл призів</h3>
                    <ul class="prizes-list">
                        <li class="prize-item">
                            <div class="prize-place">
                                <div class="prize-icon">1</div>
                                <span>Кількість переможців</span>
                            </div>
                            <div class="prize-amount">${raffle.winners_count}</div>
                        </li>
                        <li class="prize-item">
                            <div class="prize-place">
                                <div class="prize-icon">2</div>
                                <span>Загальний призовий фонд</span>
                            </div>
                            <div class="prize-amount">${raffle.prize_amount} ${raffle.prize_currency}</div>
                        </li>
                        <li class="prize-item">
                            <div class="prize-place">
                                <div class="prize-icon">3</div>
                                <span>В середньому на переможця</span>
                            </div>
                            <div class="prize-amount">≈ ${avgPrize} ${raffle.prize_currency}</div>
                        </li>
                    </ul>
                </div>
            `;
        }

        // Умови участі (приклад - реальні дані можуть прийти з API)
        const conditionsHtml = `
            <div class="raffle-section">
                <h3 class="section-title">Умови участі</h3>
                <ul class="conditions-list">
                    <li class="condition-item">
                        <div class="condition-icon">•</div>
                        <div>Для участі потрібно мати мінімум ${raffle.entry_fee} жетони на балансі</div>
                    </li>
                    <li class="condition-item">
                        <div class="condition-icon">•</div>
                        <div>Один користувач може брати участь кілька разів</div>
                    </li>
                    <li class="condition-item">
                        <div class="condition-icon">•</div>
                        <div>Розіграш завершується ${formattedEndDate}</div>
                    </li>
                    <li class="condition-item">
                        <div class="condition-icon">•</div>
                        <div>Переможці обираються випадковим чином серед усіх учасників</div>
                    </li>
                </ul>
            </div>
        `;

        // Створюємо повний HTML для модального вікна
        const content = `
            <div class="raffle-details-modal">
                <div class="raffle-section">
                    <h3 class="section-title">Про розіграш</h3>
                    <p class="raffle-description">${raffle.description || 'Детальний опис розіграшу відсутній. Взяти участь можна за ' + raffle.entry_fee + ' жетони.'}</p>
                </div>
                
                ${chartHtml}
                
                ${prizeDistributionHtml}
                
                ${conditionsHtml}
            </div>
        `;

        // Відображаємо модальне вікно
        window.showModal('Деталі розіграшу', content, {
            width: '90%',
            maxWidth: '500px',
            premium: true
        });
    };

    /**
     * Функція форматування дати і часу
     * @param {string} dateTime - Дата та час у форматі ISO або Unix timestamp
     * @returns {string} Відформатована дата та час
     */
    window.formatDateTime = function(dateTime) {
        if (!dateTime) return 'Невідомо';

        try {
            const date = new Date(dateTime);
            return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } catch (e) {
            return 'Невідомо';
        }
    };

    // Додаємо функцію форматування до глобального об'єкта
    if (window.showRaffleDetailsModal) {
        window.showRaffleDetailsModal.formatDateTime = window.formatDateTime;
    }

    console.log('✅ Модуль преміальних модальних вікон успішно ініціалізовано');
})();