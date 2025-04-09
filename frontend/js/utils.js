/**
 * utils.js - Допоміжні функції для WINIX WebApp
 * Включає покращені функції для сповіщень, індикаторів завантаження та анімацій
 */

// Змінні для контролю стану сповіщень
let _isShowingNotification = false;
let _notificationsQueue = [];
const MAX_NOTIFICATIONS = 3;

/**
 * Показує преміум-сповіщення з анімацією
 * @param {string} message - Текст повідомлення
 * @param {boolean} isError - Ознака помилки
 * @param {Function} callback - Функція зворотного виклику
 */
function showNotification(message, isError = false, callback = null) {
    // Перевірка на порожнє повідомлення
    if (!message || message.trim() === '') {
        if (callback) setTimeout(callback, 100);
        return;
    }

    // Якщо вже показується сповіщення, додаємо в чергу
    if (_isShowingNotification) {
        if (_notificationsQueue.length < MAX_NOTIFICATIONS) {
            _notificationsQueue.push({ message, isError, callback });
            console.log(`Додано сповіщення в чергу: "${message}". Довжина черги: ${_notificationsQueue.length}`);
        } else {
            // Якщо черга переповнена, і це повідомлення про помилку, показуємо його через alert
            if (isError) alert(message);
            if (callback) setTimeout(callback, 100);
        }
        return;
    }

    _isShowingNotification = true;
    console.log(`Показ сповіщення: "${message}"`);

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
                    console.log(`Обробка наступного сповіщення з черги. Залишилось: ${_notificationsQueue.length}`);
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
 * Показує індикатор завантаження з анімацією
 * @param {string} message - Повідомлення для відображення
 */
function showLoading(message = 'Завантаження...') {
    // Перевіряємо, чи індикатор завантаження вже існує
    let spinner = document.getElementById('premium-loading-spinner');

    if (!spinner) {
        // Створюємо стилі для індикатора завантаження
        if (!document.getElementById('premium-spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'premium-spinner-styles';
            style.textContent = `
                .premium-spinner-overlay {
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
                    backdrop-filter: blur(5px);
                }
                
                .premium-spinner-overlay.show {
                    opacity: 1;
                    visibility: visible;
                }
                
                .premium-spinner-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    animation: fadeIn 0.5s forwards;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .premium-spinner {
                    width: 60px;
                    height: 60px;
                    border: 5px solid rgba(0, 201, 167, 0.3);
                    border-radius: 50%;
                    border-top-color: var(--secondary-color, #4eb5f7);
                    animation: spin 1s linear infinite;
                    box-shadow: 0 0 20px rgba(0, 201, 167, 0.2);
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .premium-spinner-message {
                    color: white;
                    font-size: 16px;
                    text-align: center;
                    max-width: 300px;
                    text-shadow: 0 0 10px rgba(0, 201, 167, 0.5);
                    padding: 0 20px;
                }
            `;
            document.head.appendChild(style);
        }

        // Створюємо індикатор завантаження
        spinner = document.createElement('div');
        spinner.id = 'premium-loading-spinner';
        spinner.className = 'premium-spinner-overlay';

        spinner.innerHTML = `
            <div class="premium-spinner-content">
                <div class="premium-spinner"></div>
                <div class="premium-spinner-message">${message}</div>
            </div>
        `;

        document.body.appendChild(spinner);
    } else {
        // Оновлюємо повідомлення
        const messageElement = spinner.querySelector('.premium-spinner-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // Показуємо індикатор завантаження з анімацією
    setTimeout(() => {
        spinner.classList.add('show');
    }, 10);
}

/**
 * Приховує індикатор завантаження з анімацією
 */
function hideLoading() {
    const spinner = document.getElementById('premium-loading-spinner');

    if (spinner) {
        spinner.classList.remove('show');

        // Видаляємо елемент після завершення анімації
        setTimeout(() => {
            if (spinner.parentNode) {
                spinner.parentNode.removeChild(spinner);
            }
        }, 300);
    }
}

/**
 * Показує преміум-діалог з підтвердженням
 * @param {string} message - Повідомлення
 * @param {Function} onConfirm - Функція підтвердження
 * @param {Function} onCancel - Функція скасування
 */
function showConfirm(message, onConfirm, onCancel) {
    // Видаляємо попередній діалог, якщо він є
    const existingDialog = document.getElementById('premium-confirm-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }

    // Створюємо стилі для діалогу
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
            
            .premium-confirm-title {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 12px;
                color: white;
                background: linear-gradient(90deg, #fff, #4eb5f7, #fff);
                background-size: 200% auto;
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: gradient-text 3s linear infinite;
            }
            
            @keyframes gradient-text {
                0% { background-position: 0% center; }
                100% { background-position: 200% center; }
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
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                overflow: hidden;
                position: relative;
            }
            
            .premium-confirm-button::after {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
                opacity: 0;
                transition: opacity 0.8s;
                pointer-events: none;
            }
            
            .premium-confirm-button:active::after {
                opacity: 1;
                transition: 0s;
            }
            
            .premium-confirm-button:active {
                transform: scale(0.97);
            }
            
            .premium-confirm-button-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            .premium-confirm-button-cancel:hover {
                background: rgba(255, 255, 255, 0.15);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            
            .premium-confirm-button-confirm {
                background: linear-gradient(90deg, #2D6EB6, #52C0BD);
                color: white;
            }
            
            .premium-confirm-button-confirm:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            }
            
            .premium-confirm-button-confirm:active {
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }

    // Створюємо діалог
    const dialog = document.createElement('div');
    dialog.id = 'premium-confirm-dialog';
    dialog.className = 'premium-confirm-overlay';

    dialog.innerHTML = `
        <div class="premium-confirm-dialog">
            <div class="premium-confirm-title">Підтвердження</div>
            <div class="premium-confirm-message">${message}</div>
            <div class="premium-confirm-buttons">
                <button class="premium-confirm-button premium-confirm-button-cancel">Скасувати</button>
                <button class="premium-confirm-button premium-confirm-button-confirm">Підтвердити</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Показуємо діалог з анімацією
    setTimeout(() => {
        dialog.classList.add('show');
    }, 10);

    // Додаємо обробники подій
    const cancelButton = dialog.querySelector('.premium-confirm-button-cancel');
    const confirmButton = dialog.querySelector('.premium-confirm-button-confirm');

    // Функція закриття діалогу
    const closeDialog = () => {
        dialog.classList.remove('show');
        setTimeout(() => {
            dialog.remove();
        }, 300);
    };

    // Обробники для кнопок
    cancelButton.addEventListener('click', () => {
        closeDialog();
        if (onCancel) onCancel();
    });

    confirmButton.addEventListener('click', () => {
        closeDialog();
        if (onConfirm) onConfirm();
    });

    // Закриття по Escape
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            closeDialog();
            if (onCancel) onCancel();
        }
    });

    // Закриття по кліку поза діалогом
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            closeDialog();
            if (onCancel) onCancel();
        }
    });
}

/**
 * Фіксує нижню навігаційну панель
 */
function fixNavigation() {
    const navBar = document.querySelector('.nav-bar');
    if (navBar) {
        // Застосовуємо правильні стилі
        navBar.style.position = 'fixed';
        navBar.style.bottom = '1.875rem';
        navBar.style.left = '50%';
        navBar.style.transform = 'translateX(-50%)';
        navBar.style.zIndex = '10';
        navBar.style.width = '90%';
        navBar.style.maxWidth = '33.75rem';
        navBar.style.margin = '0 auto';
        navBar.style.display = 'flex';
        navBar.style.justifyContent = 'space-around';

        // Встановлюємо стилі для дочірніх елементів
        const navItems = navBar.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.style.textAlign = 'center';
            item.style.width = '20%';
        });
    }
}

// Глобальні функції для використання в проекті
window.showNotification = showNotification;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showConfirm = showConfirm;
window.fixNavigation = fixNavigation;

// Простіші аліаси функцій
window.showToast = showNotification;
window.showError = (message) => showNotification(message, true);
window.showSuccess = (message) => showNotification(message, false);

// Застосовуємо фікс для навігації при завантаженні
document.addEventListener('DOMContentLoaded', fixNavigation);
window.addEventListener('resize', fixNavigation);

// Викликаємо фікс відразу, якщо DOM вже завантажено
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    fixNavigation();
}