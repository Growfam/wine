/**
 * WINIX - Модальне вікно для деталей розіграшів (modal.js)
 * Універсальний компонент модального вікна для відображення деталей розіграшів
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Перевіряємо, чи вже є глобальна функція showModal
    if (typeof window.showModal === 'function') {
        console.log('✅ Функція showModal вже існує');
        return;
    }

    console.log('🔄 Ініціалізація модуля модального вікна...');

    // Додаємо преміальні стилі для сповіщень
    if (!document.getElementById('premium-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'premium-notification-styles';
        style.textContent = `
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
            onClose: null       // Callback при закритті
        };

        // Об'єднуємо опції за замовчуванням з переданими опціями
        const settings = { ...defaultOptions, ...options };

        // Видаляємо існуюче модальне вікно, якщо воно є
        const existingModal = document.querySelector('.modal-container');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // Створюємо контейнер модального вікна
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';

        // Створюємо HTML модального вікна
        modalContainer.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                ${title ? `
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        <button class="modal-close-button">&times;</button>
                    </div>
                ` : ''}
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        // Застосовуємо користувацькі стилі
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.style.width = settings.width;
        modalContent.style.maxWidth = settings.maxWidth;

        // Додаємо модальне вікно до DOM
        document.body.appendChild(modalContainer);

        // Запобігаємо прокрутці сторінки під модальним вікном
        document.body.style.overflow = 'hidden';

        // Функція для закриття модального вікна з анімацією
        const closeModal = () => {
            // Додаємо клас для анімації закриття
            modalContainer.classList.add('closing');

            // Чекаємо завершення анімації і видаляємо модальне вікно
            setTimeout(() => {
                // Перевіряємо чи модальне вікно все ще існує в DOM
                if (document.body.contains(modalContainer)) {
                    document.body.removeChild(modalContainer);
                }

                // Відновлюємо прокрутку
                document.body.style.overflow = '';

                // Викликаємо callback, якщо він переданий
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, 300); // Час анімації
        };

        // Додаємо обробник кліку для закриття модального вікна
        const closeButton = modalContainer.querySelector('.modal-close-button');
        if (closeButton) {
            closeButton.addEventListener('click', closeModal);
        }

        // Якщо увімкнено закриття при кліку на фон
        if (settings.closeOnBackdrop) {
            const backdrop = modalContainer.querySelector('.modal-backdrop');
            backdrop.addEventListener('click', closeModal);
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
     * Преміальні сповіщення в стилі стейкінгу
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
     * Додаткова функція для показу повідомлень або підтверджень
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

        // Додаємо стилі для модального вікна підтвердження
        if (!document.getElementById('confirm-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'confirm-modal-styles';
            style.textContent = `
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
            `;
            document.head.appendChild(style);
        }

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
 * Оновлений преміальний дизайн, що відповідає стилю сторінки wallet
 */
window.showRaffleDetailsModal = function(raffle, isParticipating = false, ticketCount = 0) {
    // Перевірка наявності об'єкта розіграшу
    if (!raffle || !raffle.id) {
        console.error('❌ Помилка: невалідний об\'єкт розіграшу');
        window.showToast('Неможливо відобразити деталі розіграшу', 'error');
        return;
    }

    // Форматуємо дані розіграшу для відображення
    const formattedEndDate = window.WinixRaffles && window.WinixRaffles.formatters ?
        window.WinixRaffles.formatters.formatDateTime(raffle.end_time) :
        new Date(raffle.end_time).toLocaleString('uk-UA');

    // Створюємо HTML для розподілу призів у преміальному стилі
    let prizeDistributionHtml = '';
    if (raffle.prize_distribution && Array.isArray(raffle.prize_distribution)) {
        prizeDistributionHtml = `
            <div class="premium-prize-distribution">
                <div class="premium-prize-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#prizeGradient)" stroke-width="2">
                        <defs>
                            <linearGradient id="prizeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#4eb5f7" />
                                <stop offset="100%" stop-color="#00C9A7" />
                            </linearGradient>
                        </defs>
                        <path d="M12 15V18M7 11V8a5 5 0 0 1 10 0v3" stroke="url(#prizeGradient)" />
                        <rect x="4" y="11" width="16" height="4" rx="1" stroke="url(#prizeGradient)" />
                        <path d="M8 15h8v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4z" stroke="url(#prizeGradient)" />
                    </svg>
                    <h4>Розподіл призів</h4>
                </div>
                <div class="premium-prize-list">
                    ${raffle.prize_distribution.map((prize, index) => `
                        <div class="premium-prize-item">
                            <div class="premium-prize-place">
                                <span class="premium-prize-number">${index + 1}</span>
                                <span>місце</span>
                            </div>
                            <div class="premium-prize-amount">${prize.amount} ${prize.currency || raffle.prize_currency}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (raffle.winners_count > 1) {
        // Якщо є декілька переможців, але немає точного розподілу
        const avgPrize = Math.floor(raffle.prize_amount / raffle.winners_count);
        prizeDistributionHtml = `
            <div class="premium-prize-distribution">
                <div class="premium-prize-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#prizeGradient)" stroke-width="2">
                        <defs>
                            <linearGradient id="prizeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#4eb5f7" />
                                <stop offset="100%" stop-color="#00C9A7" />
                            </linearGradient>
                        </defs>
                        <path d="M12 15V18M7 11V8a5 5 0 0 1 10 0v3" stroke="url(#prizeGradient)" />
                        <rect x="4" y="11" width="16" height="4" rx="1" stroke="url(#prizeGradient)" />
                        <path d="M8 15h8v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4z" stroke="url(#prizeGradient)" />
                    </svg>
                    <h4>Розподіл призів</h4>
                </div>
                <div class="premium-prize-info">
                    <p>Призовий фонд <span class="premium-value">${raffle.prize_amount} ${raffle.prize_currency}</span> буде розподілено між <span class="premium-value">${raffle.winners_count}</span> переможцями</p>
                    <p class="premium-prize-average">В середньому по <span class="premium-value">${avgPrize} ${raffle.prize_currency}</span> кожному переможцю</p>
                </div>
            </div>
        `;
    }

    // Визначення HTML для статусу участі у преміальному стилі
    const participationStatusHtml = isParticipating ?
        `<div class="premium-participation-status">
            <div class="premium-status-icon participating">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="url(#statusGradient)" stroke-width="2"/>
                    <path d="M6 10.5L8.5 13L14 7" stroke="url(#statusGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <defs>
                        <linearGradient id="statusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#4CAF50" />
                            <stop offset="100%" stop-color="#009688" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <div class="premium-status-text">
                <p>Ви берете участь у розіграші</p>
                <p class="premium-tickets-count">Кількість білетів: <span>${ticketCount}</span></p>
            </div>
        </div>` :
        `<div class="premium-participation-status not-participating">
            <div class="premium-status-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="rgba(244, 67, 54, 0.7)" stroke-width="2"/>
                    <path d="M7 7L13 13M7 13L13 7" stroke="rgba(244, 67, 54, 0.7)" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="premium-status-text">
                <p>Ви не берете участь у цьому розіграші</p>
            </div>
        </div>`;

    // Стилі для преміального модального вікна у стилі wallet.html
    const modalStyles = `
        <style id="premium-modal-styles">
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                opacity: 1;
                visibility: visible;
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                backdrop-filter: blur(8px) !important;
            }
            
            .modal-container {
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.95), rgba(15, 52, 96, 0.95));
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(78, 181, 247, 0.15) inset;
                position: relative;
                padding: 0;
                max-width: 500px;
                width: 95%;
                margin: 0 auto;
                transform: scale(1);
                opacity: 1;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                animation: modal-appear 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            }
            
            .modal-container::before {
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
            
            .premium-modal-header {
                background: linear-gradient(90deg, rgba(30, 39, 70, 0.8), rgba(30, 39, 70, 0.9));
                padding: 20px;
                position: relative;
                border-bottom: 1px solid rgba(78, 181, 247, 0.2);
            }
            
            .premium-modal-title {
                font-size: 22px;
                font-weight: bold;
                color: white;
                margin: 0;
                text-align: center;
                text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
            }
            
            .premium-modal-close {
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
            
            .premium-modal-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }
            
            .premium-raffle-details {
                padding: 20px;
            }
            
            .premium-raffle-image {
                width: 100%;
                height: 180px;
                object-fit: cover;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            
            .premium-raffle-title {
                font-size: 20px;
                font-weight: bold;
                color: #4CAF50;
                margin: 0 0 15px 0;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .premium-raffle-description {
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .premium-raffle-metadata {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                background: rgba(26, 32, 56, 0.5);
                padding: 15px;
                border-radius: 12px;
                margin-bottom: 20px;
            }
            
            .premium-metadata-item {
                display: flex;
                flex-direction: column;
            }
            
            .premium-metadata-label {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 5px;
            }
            
            .premium-metadata-value {
                font-size: 15px;
                font-weight: bold;
                color: white;
            }
            
            .premium-prize-distribution {
                background: rgba(10, 15, 30, 0.5);
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(78, 181, 247, 0.1);
            }
            
            .premium-prize-title {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                gap: 10px;
            }
            
            .premium-prize-title h4 {
                margin: 0;
                font-size: 17px;
                color: #4eb5f7;
                font-weight: bold;
            }
            
            .premium-prize-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .premium-prize-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(30, 39, 70, 0.5);
                border-radius: 8px;
                position: relative;
                overflow: hidden;
            }
            
            .premium-prize-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 3px;
                background: linear-gradient(to bottom, #4eb5f7, #00C9A7);
            }
            
            .premium-prize-place {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .premium-prize-number {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                color: white;
                font-weight: bold;
                font-size: 13px;
            }
            
            .premium-prize-amount {
                font-weight: bold;
                color: #4CAF50;
            }
            
            .premium-prize-info {
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.5;
            }
            
            .premium-prize-average {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .premium-value {
                color: #4CAF50;
                font-weight: bold;
            }
            
            .premium-participation-status {
                display: flex;
                gap: 12px;
                padding: 15px;
                border-radius: 10px;
                background: rgba(26, 32, 56, 0.5);
                margin-top: 5px;
                border: 1px solid rgba(76, 175, 80, 0.2);
            }
            
            .premium-participation-status.not-participating {
                border-color: rgba(244, 67, 54, 0.2);
            }
            
            .premium-status-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(76, 175, 80, 0.1);
                flex-shrink: 0;
            }
            
            .premium-participation-status.not-participating .premium-status-icon {
                background: rgba(244, 67, 54, 0.1);
            }
            
            .premium-status-text {
                flex-grow: 1;
            }
            
            .premium-status-text p {
                margin: 0;
                line-height: 1.4;
            }
            
            .premium-tickets-count {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 5px !important;
            }
            
            .premium-tickets-count span {
                color: #4CAF50;
                font-weight: bold;
            }
            
            /* Кнопка закриття в стилі wallet.html */
            .premium-close-button {
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
            
            .premium-close-button::before {
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
            
            .premium-close-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
            }
            
            .premium-close-button:hover::before {
                left: 100%;
            }
            
            .premium-close-button:active {
                transform: translateY(0);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            
            @media (max-width: 450px) {
                .premium-raffle-metadata {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                
                .premium-metadata-item {
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .premium-metadata-label {
                    margin-bottom: 0;
                }
            }
        </style>
    `;

    // Створюємо HTML для модального вікна в преміальному стилі
    const modalContent = `
        ${modalStyles}
        <div class="modal-container">
            <div class="premium-modal-header">
                <h3 class="premium-modal-title">Деталі розіграшу</h3>
                <button class="premium-modal-close">&times;</button>
            </div>
            
            <div class="premium-raffle-details">
                <img src="${raffle.image_url || 'assets/prize-poster.gif'}" alt="${raffle.title}" class="premium-raffle-image">
                
                <h3 class="premium-raffle-title">${raffle.title}</h3>
                
                <p class="premium-raffle-description">${raffle.description || 'Опис відсутній'}</p>
                
                <div class="premium-raffle-metadata">
                    <div class="premium-metadata-item">
                        <span class="premium-metadata-label">Призовий фонд:</span>
                        <span class="premium-metadata-value">${raffle.prize_amount} ${raffle.prize_currency}</span>
                    </div>
                    
                    <div class="premium-metadata-item">
                        <span class="premium-metadata-label">Переможців:</span>
                        <span class="premium-metadata-value">${raffle.winners_count}</span>
                    </div>
                    
                    <div class="premium-metadata-item">
                        <span class="premium-metadata-label">Вартість участі:</span>
                        <span class="premium-metadata-value">${raffle.entry_fee} жетон${raffle.entry_fee > 1 ? 'и' : ''}</span>
                    </div>
                    
                    <div class="premium-metadata-item">
                        <span class="premium-metadata-label">Завершення:</span>
                        <span class="premium-metadata-value">${formattedEndDate}</span>
                    </div>
                    
                    <div class="premium-metadata-item">
                        <span class="premium-metadata-label">Учасників:</span>
                        <span class="premium-metadata-value">${raffle.participants_count || 0}</span>
                    </div>
                </div>
                
                ${prizeDistributionHtml}
                
                ${participationStatusHtml}
                
                <button class="premium-close-button">Закрити</button>
            </div>
        </div>
    `;

    // Відображаємо модальне вікно
    const modal = document.createElement('div');
    modal.className = 'modal-overlay premium-modal';
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);

    // Додаємо обробник для кнопки закриття модального вікна
    const closeButton = modal.querySelector('.premium-modal-close');
    const closeButtonBottom = modal.querySelector('.premium-close-button');

    const closeModal = () => {
        modal.classList.add('closing');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 400);
    };

    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    if (closeButtonBottom) {
        closeButtonBottom.addEventListener('click', closeModal);
    }

    // Додаємо обробник для закриття модального вікна при кліку на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Додаємо обробник для кнопки Escape
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    return closeModal;
};

    // Передаємо показ модального вікна у глобальне меню
    window.modalUtils = {
        show: window.showModal,
        confirm: window.showConfirmModal,
        showRaffleDetails: window.showRaffleDetailsModal,
        showNotification: window.showPremiumNotification
    };

    console.log('✅ Модуль модального вікна успішно ініціалізовано');
})();