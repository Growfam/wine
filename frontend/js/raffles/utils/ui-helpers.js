/**
 * ui-helpers.js - Утилітарні функції для роботи з UI
 */

import WinixRaffles from '../globals.js';

/**
 * Показати індикатор завантаження
 * @param {string} message - Повідомлення, яке буде показано
 * @param {string} [id=null] - Ідентифікатор завантаження для відстеження
 */
export function showLoading(message = 'Завантаження...', id = null) {
    // Використовуємо централізований лоадер з глобального об'єкту
    WinixRaffles.loader.show(message, id);
}

/**
 * Приховати індикатор завантаження
 * @param {string} [id=null] - Ідентифікатор завантаження для відстеження
 */
export function hideLoading(id = null) {
    // Використовуємо централізований лоадер з глобального об'єкту
    WinixRaffles.loader.hide(id);
}

/**
 * Показати повідомлення toast
 * @param {string} message - Текст повідомлення
 * @param {string} [type='info'] - Тип повідомлення ('info', 'success', 'error', 'warning')
 * @param {number} [duration=3000] - Тривалість відображення в мілісекундах
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Перевіряємо наявність глобальної функції
    if (window.showToast && typeof window.showToast === 'function') {
        try {
            return window.showToast(message, type, duration);
        } catch (e) {
            console.warn("Помилка використання глобального showToast:", e);
        }
    }

    // Запасний варіант, якщо глобальна функція відсутня
    const toast = document.getElementById('toast-message');
    let newToast = toast;

    if (!toast) {
        // Створюємо елемент toast
        newToast = document.createElement('div');
        newToast.id = 'toast-message';
        newToast.className = 'toast-message';
        document.body.appendChild(newToast);

        // Додаємо стилі, якщо їх немає
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast-message {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%) translateY(100px);
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    z-index: 10000;
                    opacity: 0;
                    transition: transform 0.3s, opacity 0.3s;
                    font-size: 16px;
                    max-width: 90%;
                    text-align: center;
                }
                .toast-message.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                .toast-message.info {
                    background: rgba(0, 0, 0, 0.7);
                }
                .toast-message.success {
                    background: rgba(40, 167, 69, 0.9);
                }
                .toast-message.error {
                    background: rgba(220, 53, 69, 0.9);
                }
                .toast-message.warning {
                    background: rgba(255, 193, 7, 0.9);
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Додаємо тип
    newToast.className = `toast-message ${type}`;

    // Встановлюємо повідомлення
    newToast.textContent = message;

    // Показуємо toast
    setTimeout(() => {
        newToast.classList.add('show');
    }, 10);

    // Ховаємо після затримки
    setTimeout(() => {
        newToast.classList.remove('show');
    }, duration);

    // Повертаємо ідентифікатор для можливості приховування ззовні
    return newToast;
}

/**
 * Показати діалог підтвердження
 * @param {string} message - Текст повідомлення
 * @param {string} [confirmText='Так'] - Текст кнопки підтвердження
 * @param {string} [cancelText='Ні'] - Текст кнопки скасування
 * @returns {Promise<boolean>} Результат підтвердження
 */
export function showConfirm(message, confirmText = 'Так', cancelText = 'Ні') {
    return new Promise((resolve) => {
        // Перевіряємо наявність глобальної функції
        if (window.showConfirm && typeof window.showConfirm === 'function') {
            try {
                return window.showConfirm(message, confirmText, cancelText).then(resolve);
            } catch (e) {
                console.warn("Помилка використання глобального showConfirm:", e);
            }
        }

        // Створюємо власне модальне вікно підтвердження
        const confirmId = 'winix-confirm-dialog-' + Date.now();
        const confirmDialog = document.createElement('div');
        confirmDialog.id = confirmId;
        confirmDialog.className = 'winix-confirm-dialog';

        confirmDialog.innerHTML = `
            <div class="confirm-dialog-overlay"></div>
            <div class="confirm-dialog-content">
                <div class="confirm-dialog-message">${message}</div>
                <div class="confirm-dialog-buttons">
                    <button class="confirm-dialog-btn confirm-yes">${confirmText}</button>
                    <button class="confirm-dialog-btn confirm-no">${cancelText}</button>
                </div>
            </div>
        `;

        // Додаємо стилі, якщо їх немає
        if (!document.getElementById('confirm-dialog-styles')) {
            const style = document.createElement('style');
            style.id = 'confirm-dialog-styles';
            style.textContent = `
                .winix-confirm-dialog {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .confirm-dialog-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                }
                .confirm-dialog-content {
                    position: relative;
                    background: #fff;
                    border-radius: 8px;
                    padding: 20px;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    color: #333;
                }
                .confirm-dialog-message {
                    margin-bottom: 20px;
                    font-size: 16px;
                    text-align: center;
                }
                .confirm-dialog-buttons {
                    display: flex;
                    justify-content: space-around;
                }
                .confirm-dialog-btn {
                    padding: 8px 20px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                }
                .confirm-yes {
                    background: #2D6EB6;
                    color: white;
                }
                .confirm-no {
                    background: #f2f2f2;
                    color: #333;
                }
            `;
            document.head.appendChild(style);
        }

        // Додаємо до документа
        document.body.appendChild(confirmDialog);

        // Додаємо обробники подій
        const yesButton = confirmDialog.querySelector('.confirm-yes');
        const noButton = confirmDialog.querySelector('.confirm-no');

        const cleanup = () => {
            document.body.removeChild(confirmDialog);
        };

        yesButton.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        noButton.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        // Фокус на кнопці підтвердження
        yesButton.focus();
    });
}

/**
 * Показати сповіщення
 * @param {string} title - Заголовок сповіщення
 * @param {string} message - Текст сповіщення
 * @param {string} [type='info'] - Тип сповіщення ('info', 'success', 'error', 'warning')
 * @param {number} [duration=5000] - Тривалість відображення в мілісекундах
 */
export function showNotification(title, message, type = 'info', duration = 5000) {
    // Перевіряємо наявність Notification API
    if ('Notification' in window) {
        // Перевіряємо дозвіл на показ сповіщень
        if (Notification.permission === 'granted') {
            // Створюємо сповіщення
            const notification = new Notification(title, {
                body: message,
                icon: '/assets/notification-icon.png'
            });

            // Закриваємо сповіщення після вказаної тривалості
            setTimeout(() => {
                notification.close();
            }, duration);
        }
        // Просимо дозвіл, якщо він не надано
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification(title, message, type, duration);
                }
            });
        }
    }

    // Показуємо також toast як запасний варіант
    showToast(message, type, duration);
}

/**
 * Додавання водяного знаку до блоку
 * @param {HTMLElement} container - Контейнер для додавання водяного знаку
 * @param {string} text - Текст водяного знаку
 * @param {Object} [options={}] - Опції для налаштування водяного знаку
 * @returns {HTMLElement} Створений елемент водяного знаку
 */
export function markElement(container, text = 'ОТРИМАНО', options = {}) {
    if (!container) return null;

    // Перевіряємо, чи вже є водяний знак
    const existingWatermark = container.querySelector('.watermark');
    if (existingWatermark) {
        return existingWatermark;
    }

    // Опції за замовчуванням
    const defaultOptions = {
        color: 'white',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        fontSize: '24px',
        rotation: -30,
        zIndex: 10
    };

    // Об'єднуємо з користувацькими опціями
    const mergedOptions = {...defaultOptions, ...options};

    // Створюємо водяний знак
    const watermark = document.createElement('div');
    watermark.className = 'watermark';
    watermark.style.position = 'absolute';
    watermark.style.top = '0';
    watermark.style.left = '0';
    watermark.style.width = '100%';
    watermark.style.height = '100%';
    watermark.style.display = 'flex';
    watermark.style.justifyContent = 'center';
    watermark.style.alignItems = 'center';
    watermark.style.pointerEvents = 'none';
    watermark.style.zIndex = mergedOptions.zIndex;

    // Створюємо затемнення
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = mergedOptions.backgroundColor;

    // Створюємо текст
    const textElement = document.createElement('div');
    textElement.textContent = text;
    textElement.style.position = 'absolute';
    textElement.style.transform = `rotate(${mergedOptions.rotation}deg)`;
    textElement.style.fontSize = mergedOptions.fontSize;
    textElement.style.fontWeight = 'bold';
    textElement.style.color = mergedOptions.color;
    textElement.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.7)';

    // Додаємо елементи
    watermark.appendChild(overlay);
    watermark.appendChild(textElement);

    // Якщо контейнер не має position: relative, додаємо його
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    container.appendChild(watermark);
    return watermark;
}

/**
 * Перевірка наявності елемента DOM
 * @param {string} selector - CSS-селектор для перевірки
 * @returns {HTMLElement|null} - Знайдений елемент або null
 */
export function getElement(selector) {
    return document.querySelector(selector);
}

/**
 * Очікування появи елемента в DOM
 * @param {string} selector - CSS-селектор елемента
 * @param {number} [timeout=5000] - Таймаут очікування в мілісекундах
 * @returns {Promise<HTMLElement>} - Проміс з елементом DOM
 */
export function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        // Перевіряємо, чи елемент вже існує
        const element = document.querySelector(selector);
        if (element) {
            return resolve(element);
        }

        // Встановлюємо таймаут
        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Елемент ${selector} не з'явився протягом ${timeout}ms`));
        }, timeout);

        // Створюємо спостерігача за змінами DOM
        const observer = new MutationObserver((mutations) => {
            const element = document.querySelector(selector);
            if (element) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve(element);
            }
        });

        // Починаємо спостереження
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

/**
 * Копіювання тексту в буфер обміну
 * @param {string} text - Текст для копіювання
 * @param {boolean} [showFeedback=true] - Чи показувати повідомлення про успіх
 * @returns {Promise<boolean>} - Результат копіювання
 */
export function copyToClipboard(text, showFeedback = true) {
    return new Promise((resolve, reject) => {
        try {
            // Використовуємо сучасний Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        if (showFeedback) {
                            showToast('Текст скопійовано в буфер обміну', 'success', 2000);
                        }
                        resolve(true);
                    })
                    .catch(error => {
                        console.warn('Clipboard API помилка:', error);
                        // Запасний варіант - стандартний метод
                        fallbackCopy();
                    });
            } else {
                // Запасний варіант
                fallbackCopy();
            }
        } catch (error) {
            console.error('Помилка копіювання в буфер обміну:', error);
            reject(error);
        }

        // Запасний метод копіювання
        function fallbackCopy() {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const success = document.execCommand('copy');
                if (success) {
                    if (showFeedback) {
                        showToast('Текст скопійовано в буфер обміну', 'success', 2000);
                    }
                    resolve(true);
                } else {
                    reject(new Error('Помилка копіювання'));
                }
            } catch (error) {
                console.error('execCommand помилка:', error);
                reject(error);
            } finally {
                document.body.removeChild(textarea);
            }
        }
    });
}

// Додаємо функції в глобальний об'єкт для зворотної сумісності
WinixRaffles.utils.ui = {
    showLoading,
    hideLoading,
    showToast,
    showConfirm,
    showNotification,
    markElement,
    getElement,
    waitForElement,
    copyToClipboard
};

// Додаємо також основні функції для зворотної сумісності
WinixRaffles.utils.showLoading = showLoading;
WinixRaffles.utils.hideLoading = hideLoading;
WinixRaffles.utils.showToast = showToast;
WinixRaffles.utils.showConfirm = showConfirm;
WinixRaffles.utils.markElement = markElement;

console.log("🎮 WINIX Raffles: Ініціалізація утиліт UI");

// Експортуємо всі основні функції
export default {
    showLoading,
    hideLoading,
    showToast,
    showConfirm,
    showNotification,
    markElement,
    getElement,
    waitForElement,
    copyToClipboard
};