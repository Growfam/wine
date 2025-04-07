/**
 * Єдиний модуль утиліт для WINIX
 * Включає всі допоміжні функції для сповіщень та інтерфейсу
 */

// Прапорці для контролю стану сповіщень
let _isShowingNotification = false;
let _notificationsQueue = [];
const MAX_NOTIFICATIONS = 1; // Максимальна кількість одночасних сповіщень

/**
 * Уніфікована функція для показу сповіщень в преміум-стилі
 * @param {string} message - Текст повідомлення
 * @param {boolean} isError - Чи є повідомлення помилкою
 * @param {Function} callback - Функція зворотного виклику
 */
function showNotification(message, isError = false, callback = null) {
    // Запобігаємо показу порожніх повідомлень
    if (!message || message.trim() === '') {
        if (callback) setTimeout(callback, 100);
        return;
    }

    // Якщо уже показується сповіщення, додаємо в чергу
    if (_isShowingNotification) {
        if (_notificationsQueue.length < MAX_NOTIFICATIONS) {
            _notificationsQueue.push({ message, isError, callback });
            console.log(`Added notification to queue: "${message}". Queue length: ${_notificationsQueue.length}`);
        } else {
            // Якщо черга переповнена, і це повідомлення про помилку, показуємо його через alert
            if (isError) alert(message);
            if (callback) setTimeout(callback, 100);
        }
        return;
    }

    _isShowingNotification = true;
    console.log(`Showing notification: "${message}"`);

    try {
        // Перевіряємо, чи контейнер для повідомлень вже існує
        let container = document.getElementById('premium-notification-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'premium-notification-container';
            container.className = 'premium-notification-container';
            document.body.appendChild(container);

            // Додаємо стилі для преміальних сповіщень
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

        // Функція закриття сповіщення
        const closeNotification = () => {
            notification.classList.remove('show');
            notification.classList.add('hide');

            setTimeout(() => {
                notification.remove();
                _isShowingNotification = false;

                // Показуємо наступне повідомлення з черги
                if (_notificationsQueue.length > 0) {
                    const nextNotification = _notificationsQueue.shift();
                    console.log(`Processing next notification from queue. Remaining: ${_notificationsQueue.length}`);
                    showNotification(nextNotification.message, nextNotification.isError, nextNotification.callback);
                } else if (callback) {
                    callback();
                }
            }, 300);
        };

        // Закриття при кліку на кнопку
        closeBtn.addEventListener('click', closeNotification);

        // Автоматичне закриття
        setTimeout(() => {
            if (notification.parentNode) {
                closeNotification();
            }
        }, 5000);
    } catch (e) {
        console.error('Помилка показу повідомлення:', e);

        // Якщо не вдалося створити повідомлення, використовуємо alert
        alert(message);
        _isShowingNotification = false;
        if (callback) callback();
    }
}

/**
 * Модернізоване діалогове вікно з підтвердженням
 * @param {string} message - Повідомлення
 * @param {Function} onConfirm - Функція для підтвердження
 * @param {Function} onCancel - Функція для скасування
 */
function showModernConfirm(message, onConfirm, onCancel) {
    try {
        // Перевіряємо, чи існує контейнер
        let overlay = document.getElementById('premium-confirm-overlay');

        if (overlay) {
            // Якщо діалог вже відкритий, закриваємо його
            overlay.remove();
        }

        // Створюємо новий контейнер
        overlay = document.createElement('div');
        overlay.id = 'premium-confirm-overlay';
        overlay.className = 'premium-confirm-overlay';

        // Якщо стилів ще немає, додаємо їх
        if (!document.getElementById('premium-confirm-styles')) {
            const style = document.createElement('style');
            style.id = 'premium-confirm-styles';
            style.textContent = `
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
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(78, 181, 247, 0.15) inset, 0 6px 12px rgba(0, 0, 0, 0.25);
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
                    font-size: 36px;
                    color: #FF5252;
                    margin-bottom: 16px;
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
                    background: linear-gradient(90deg, #8B0000, #A52A2A, #B22222);
                    color: white;
                }
            `;
            document.head.appendChild(style);
        }

        // Створюємо діалогове вікно
        const dialog = document.createElement('div');
        dialog.className = 'premium-confirm-dialog';

        // Іконка
        const icon = document.createElement('div');
        icon.className = 'premium-confirm-icon';
        icon.innerHTML = '&#9888;'; // Знак оклику

        // Заголовок
        const title = document.createElement('div');
        title.className = 'premium-confirm-title';
        title.textContent = 'Підтвердження дії';

        // Повідомлення
        const messageEl = document.createElement('div');
        messageEl.className = 'premium-confirm-message';
        messageEl.textContent = message;

        // Кнопки
        const buttons = document.createElement('div');
        buttons.className = 'premium-confirm-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'premium-confirm-button premium-confirm-button-cancel';
        cancelBtn.textContent = 'Скасувати';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'premium-confirm-button premium-confirm-button-confirm';
        confirmBtn.textContent = 'Підтвердити';

        // Збираємо елементи
        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);

        dialog.appendChild(icon);
        dialog.appendChild(title);
        dialog.appendChild(messageEl);
        dialog.appendChild(buttons);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Функція закриття
        const closeDialog = () => {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        };

        // Обробники подій
        cancelBtn.onclick = () => {
            closeDialog();
            if (onCancel) onCancel();
        };

        confirmBtn.onclick = () => {
            closeDialog();
            if (onConfirm) onConfirm();
        };

        // Обробка клавіші Escape
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog();
                if (onCancel) onCancel();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Показуємо діалог
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);

    } catch (e) {
        console.error('Помилка відображення підтвердження:', e);

        // Резервний варіант - стандартний confirm
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
    }
}

/**
 * Модернізоване діалогове вікно з полем введення
 * @param {string} message - Повідомлення
 * @param {Function} callback - Функція зворотного виклику з введеним значенням
 */
function showInputModal(message, callback) {
    try {
        // Створюємо контейнер з преміальним стилем
        const overlay = document.createElement('div');
        overlay.className = 'premium-confirm-overlay show';

        // Створюємо діалог
        const dialog = document.createElement('div');
        dialog.className = 'premium-confirm-dialog';
        dialog.style.padding = '24px';

        // Заголовок
        const title = document.createElement('div');
        title.className = 'premium-confirm-title';
        title.textContent = message;

        // Поле введення
        const input = document.createElement('input');
        input.className = 'modern-input-field';
        input.type = 'text';
        input.placeholder = 'Введіть значення';
        input.style.width = '100%';
        input.style.padding = '12px';
        input.style.marginBottom = '20px';
        input.style.borderRadius = '12px';
        input.style.border = '1px solid rgba(0, 201, 167, 0.3)';
        input.style.background = 'rgba(20, 30, 60, 0.7)';
        input.style.color = 'white';
        input.style.fontSize = '16px';

        // Кнопки
        const buttons = document.createElement('div');
        buttons.className = 'premium-confirm-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'premium-confirm-button premium-confirm-button-cancel';
        cancelBtn.textContent = 'Скасувати';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'premium-confirm-button premium-confirm-button-confirm';
        confirmBtn.style.background = 'linear-gradient(90deg, #1A1A2E, #0F3460, #00C9A7)';
        confirmBtn.textContent = 'Підтвердити';

        // Збираємо елементи
        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);

        dialog.appendChild(title);
        dialog.appendChild(input);
        dialog.appendChild(buttons);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Функція закриття
        const closeModal = () => {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        };

        // Обробники подій
        cancelBtn.onclick = () => {
            closeModal();
        };

        confirmBtn.onclick = () => {
            const value = input.value.trim();
            closeModal();
            if (callback) callback(value);
        };

        // Фокус на полі введення
        setTimeout(() => input.focus(), 100);

        // Обробка Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = input.value.trim();
                closeModal();
                if (callback) callback(value);
            }
        });

        // Обробка Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
    } catch (e) {
        console.error('Помилка відображення діалогу введення:', e);

        // Резервний варіант - стандартний prompt
        const value = prompt(message);
        if (callback) callback(value);
    }
}

/**
 * Показ індикатора завантаження
 * @param {string} message - Повідомлення (опціонально)
 */
function showLoading(message) {
    try {
        let spinner = document.getElementById('loading-spinner');

        if (!spinner) {
            // Створюємо індикатор завантаження
            const spinnerContainer = document.createElement('div');
            spinnerContainer.id = 'loading-spinner';
            spinnerContainer.className = 'spinner-overlay';

            spinnerContainer.innerHTML = `
                <div class="spinner-content">
                    <div class="spinner"></div>
                    ${message ? `<div class="spinner-message">${message}</div>` : ''}
                </div>
            `;

            // Додаємо стилі, якщо їх немає
            if (!document.getElementById('spinner-styles')) {
                const style = document.createElement('style');
                style.id = 'spinner-styles';
                style.textContent = `
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
                `;
                document.head.appendChild(style);
            }

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
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.classList.remove('show');
        }
    } catch (e) {
        console.error('Помилка приховування індикатора завантаження:', e);
    }
}

/**
 * Проста функція для показу тостів
 * Використовує преміум-сповіщення для уніфікації стилю
 */
function showToast(message, isError = false) {
    showNotification(message, isError);
}

/**
 * Простий алерт (використовує преміум-сповіщення)
 */
function simpleAlert(message, isError = false) {
    showNotification(message, isError);
}

// Експортуємо функції як глобальні
window.showNotification = showNotification;
window.showModernConfirm = showModernConfirm;
window.showInputModal = showInputModal;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
window.simpleAlert = simpleAlert;