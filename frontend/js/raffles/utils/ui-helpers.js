/**
 * ui-helpers.js - Оптимізовані утилітарні функції для роботи з UI
 * - Додано кешування DOM-елементів
 * - Оптимізовано DOM-операції
 * - Додано делегування подій
 * - Впроваджено черговість для сповіщень
 */

import WinixRaffles from '../globals.js';


// Кеш DOM-елементів для швидкого доступу
const _domCache = new Map();

// Таймаути для очищення
const _timeouts = new Map();

// Черга для сповіщень
const _notificationQueue = [];
let _processingNotificationQueue = false;

// Лічильник для унікальних ідентифікаторів
let _uidCounter = 0;

/**
 * Генерація унікального ідентифікатора
 * @param {string} prefix - Префікс для ідентифікатора
 * @returns {string} Унікальний ідентифікатор
 * @private
 */
function _generateUid(prefix = 'winix') {
    return `${prefix}-${Date.now()}-${_uidCounter++}`;
}

/**
 * Отримання елемента DOM з кешу або запиту
 * @param {string|HTMLElement} selector - CSS-селектор або сам елемент
 * @param {boolean} [useCache=true] - Чи використовувати кеш
 * @param {HTMLElement} [context=document] - Контекст для пошуку
 * @returns {HTMLElement|null} Знайдений елемент або null
 */
export function getElement(selector, useCache = true, context = document) {
    try {
        // Якщо передано сам елемент, повертаємо його
        if (selector instanceof HTMLElement) {
            return selector;
        }

        // Для ID-селекторів використовуємо кеш
        if (useCache && typeof selector === 'string' && selector.startsWith('#')) {
            // Перевіряємо, чи є елемент в кеші
            if (_domCache.has(selector)) {
                const cachedElement = _domCache.get(selector);

                // Перевіряємо, чи елемент ще в DOM
                if (document.contains(cachedElement)) {
                    return cachedElement;
                } else {
                    // Видаляємо з кешу, якщо елемент більше не в DOM
                    _domCache.delete(selector);
                }
            }

            // Шукаємо елемент
            const element = context.querySelector(selector);

            // Кешуємо, якщо знайдено
            if (element) {
                _domCache.set(selector, element);
            }

            return element;
        }

        // Для інших селекторів просто використовуємо querySelector
        return context.querySelector(selector);
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка отримання елемента:', error);
        } else {
            console.error('Помилка отримання елемента:', error);
        }
        return null;
    }
}

/**
 * Отримання всіх елементів за селектором
 * @param {string} selector - CSS-селектор
 * @param {HTMLElement} [context=document] - Контекст для пошуку
 * @returns {Array<HTMLElement>} Масив знайдених елементів
 */
export function getAllElements(selector, context = document) {
    try {
        return Array.from(context.querySelectorAll(selector));
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка отримання елементів:', error);
        } else {
            console.error('Помилка отримання елементів:', error);
        }
        return [];
    }
}

/**
 * Очищення кешу DOM-елементів
 * @param {string} [selector] - Конкретний селектор для очищення або всі, якщо не вказано
 */
export function clearDomCache(selector) {
    if (selector) {
        _domCache.delete(selector);
    } else {
        _domCache.clear();
    }
}

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
 * @param {Object} [options={}] - Додаткові параметри
 * @returns {Object} Об'єкт з методами управління toast
 */
export function showToast(message, type = 'info', duration = 3000, options = {}) {
    // Перевіряємо наявність глобальної функції
    if (window.showToast && typeof window.showToast === 'function' && !options.forceCustom) {
        try {
            return window.showToast(message, type, duration);
        } catch (e) {
            console.warn("Помилка використання глобального showToast:", e);
        }
    }

    // Унікальний ідентифікатор для цього toast
    const toastId = _generateUid('toast');

    // Додаємо повідомлення до черги
    _notificationQueue.push({
        id: toastId,
        message,
        type,
        duration,
        options
    });

    // Запускаємо обробку черги, якщо ще не запущено
    if (!_processingNotificationQueue) {
        _processNotificationQueue();
    }

    // Повертаємо об'єкт з методами управління
    return {
        id: toastId,
        close: () => {
            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                toastElement.classList.remove('show');
                setTimeout(() => {
                    if (toastElement.parentNode) {
                        toastElement.parentNode.removeChild(toastElement);
                    }
                }, 300);
            }
        },
        update: (newMessage) => {
            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                toastElement.textContent = newMessage;
            }
        }
    };
}

/**
 * Обробка черги сповіщень
 * @private
 */
function _processNotificationQueue() {
    if (_notificationQueue.length === 0) {
        _processingNotificationQueue = false;
        return;
    }

    _processingNotificationQueue = true;
    const notification = _notificationQueue.shift();

    // Створюємо і відображаємо toast
    const toastElement = _createToastElement(
        notification.id,
        notification.message,
        notification.type,
        notification.duration,
        notification.options
    );

    // Запускаємо наступне сповіщення після затримки
    setTimeout(() => {
        _processNotificationQueue();
    }, 300); // Невелика затримка між появами сповіщень
}

/**
 * Створення елемента toast
 * @param {string} id - Ідентифікатор toast
 * @param {string} message - Текст повідомлення
 * @param {string} type - Тип повідомлення
 * @param {number} duration - Тривалість відображення
 * @param {Object} options - Додаткові параметри
 * @returns {HTMLElement} Елемент toast
 * @private
 */
function _createToastElement(id, message, type, duration, options = {}) {
    // Забезпечуємо наявність контейнера для toast
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);

        // Додаємо стилі для контейнера, якщо їх немає
        if (!document.getElementById('toast-container-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-container-styles';
            style.textContent = `
                #toast-container {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                }
                
                .toast-message {
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    opacity: 0;
                    transform: translateY(20px);
                    transition: transform 0.3s, opacity 0.3s;
                    font-size: 16px;
                    max-width: 90%;
                    text-align: center;
                    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
                    position: relative;
                    pointer-events: auto;
                }
                
                .toast-message.show {
                    opacity: 1;
                    transform: translateY(0);
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
                
                .toast-close {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    color: white;
                    opacity: 0.7;
                    padding: 2px;
                }
                
                .toast-close:hover {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Створюємо елемент toast
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast-message ${type}`;
    toast.textContent = message;

    // Додаємо кнопку закриття, якщо потрібно
    if (options.showCloseButton) {
        const closeButton = document.createElement('span');
        closeButton.className = 'toast-close';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
        toast.appendChild(closeButton);
    }

    // Додаємо до контейнера
    toastContainer.appendChild(toast);

    // Показуємо toast з невеликою затримкою
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Автоматично ховаємо через вказаний час
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    return toast;
}

/**
 * Показати діалог підтвердження
 * @param {string} message - Текст повідомлення
 * @param {string} [confirmText='Так'] - Текст кнопки підтвердження
 * @param {string} [cancelText='Ні'] - Текст кнопки скасування
 * @param {Object} [options={}] - Додаткові параметри
 * @returns {Promise<boolean>} Результат підтвердження
 */
export function showConfirm(message, confirmText = 'Так', cancelText = 'Ні', options = {}) {
    return new Promise((resolve) => {
        // Перевіряємо наявність глобальної функції
        if (window.showConfirm && typeof window.showConfirm === 'function' && !options.forceCustom) {
            try {
                return window.showConfirm(message, confirmText, cancelText).then(resolve);
            } catch (e) {
                console.warn("Помилка використання глобального showConfirm:", e);
            }
        }

        // Створюємо унікальний ідентифікатор для діалогу
        const confirmId = _generateUid('confirm');

        // Створюємо елемент діалогу
        const confirmDialog = document.createElement('div');
        confirmDialog.id = confirmId;
        confirmDialog.className = 'winix-confirm-dialog';
        confirmDialog.setAttribute('role', 'dialog');
        confirmDialog.setAttribute('aria-modal', 'true');

        // HTML вміст діалогу
        confirmDialog.innerHTML = `
            <div class="confirm-dialog-overlay"></div>
            <div class="confirm-dialog-content">
                <div class="confirm-dialog-message">${message}</div>
                <div class="confirm-dialog-buttons">
                    <button class="confirm-dialog-btn confirm-no">${cancelText}</button>
                    <button class="confirm-dialog-btn confirm-yes">${confirmText}</button>
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
                    z-index: 10001;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .winix-confirm-dialog.show {
                    opacity: 1;
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
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
                    color: #333;
                    transform: translateY(20px);
                    transition: transform 0.3s;
                }
                .winix-confirm-dialog.show .confirm-dialog-content {
                    transform: translateY(0);
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
                    transition: background-color 0.2s;
                }
                .confirm-yes {
                    background: #2D6EB6;
                    color: white;
                }
                .confirm-yes:hover {
                    background: #2258a5;
                }
                .confirm-no {
                    background: #f2f2f2;
                    color: #333;
                }
                .confirm-no:hover {
                    background: #e0e0e0;
                }
            `;
            document.head.appendChild(style);
        }

        // Додаємо до документа
        document.body.appendChild(confirmDialog);

        // Виконуємо анімацію появи
        setTimeout(() => {
            confirmDialog.classList.add('show');
        }, 10);

        // Функція очищення
        const cleanup = (result) => {
            confirmDialog.classList.remove('show');
            setTimeout(() => {
                if (confirmDialog.parentNode) {
                    confirmDialog.parentNode.removeChild(confirmDialog);
                }
                resolve(result);
            }, 300);
        };

        // Додаємо обробники подій
        const yesButton = confirmDialog.querySelector('.confirm-yes');
        const noButton = confirmDialog.querySelector('.confirm-no');
        const overlay = confirmDialog.querySelector('.confirm-dialog-overlay');

        if (yesButton) {
            yesButton.addEventListener('click', () => cleanup(true));
        }

        if (noButton) {
            noButton.addEventListener('click', () => cleanup(false));
        }

        // Клік поза діалогом закриває його як "Ні", якщо дозволено в options
        if (overlay && options.closeOnOverlayClick !== false) {
            overlay.addEventListener('click', () => cleanup(false));
        }

        // Обробник Escape закриває як "Ні", якщо дозволено в options
        if (options.closeOnEscape !== false) {
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    cleanup(false);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        // Фокус на кнопці підтвердження
        if (yesButton) {
            setTimeout(() => yesButton.focus(), 100);
        }
    });
}

/**
 * Показати сповіщення
 * @param {string} title - Заголовок сповіщення
 * @param {string} message - Текст сповіщення
 * @param {string} [type='info'] - Тип сповіщення ('info', 'success', 'error', 'warning')
 * @param {Object} [options={}] - Додаткові параметри сповіщення
 */
export function showNotification(title, message, type = 'info', options = {}) {
    const defaultOptions = {
        duration: 5000,
        icon: '/assets/notification-icon.png',
        showToast: true,
        requireInteraction: false
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Перевіряємо наявність Notification API
    if ('Notification' in window) {
        // Перевіряємо дозвіл на показ сповіщень
        if (Notification.permission === 'granted') {
            // Створюємо сповіщення
            const notification = new Notification(title, {
                body: message,
                icon: mergedOptions.icon,
                tag: mergedOptions.tag || 'winix-notification',
                requireInteraction: mergedOptions.requireInteraction
            });

            // Додаємо обробник кліку, якщо є
            if (mergedOptions.onClick) {
                notification.addEventListener('click', mergedOptions.onClick);
            }

            // Закриваємо сповіщення після вказаної тривалості, якщо не потрібна взаємодія
            if (!mergedOptions.requireInteraction && mergedOptions.duration > 0) {
                setTimeout(() => {
                    notification.close();
                }, mergedOptions.duration);
            }

            // Показуємо toast, якщо вказано
            if (mergedOptions.showToast) {
                showToast(message, type, Math.min(mergedOptions.duration, 3000));
            }

            return notification;
        }
        // Просимо дозвіл, якщо він не надано
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification(title, message, type, options);
                } else {
                    // Просто показуємо toast, якщо відмовлено в дозволі
                    showToast(message, type, mergedOptions.duration);
                }
            });
        } else {
            // Просто показуємо toast, якщо відмовлено в дозволі
            showToast(message, type, mergedOptions.duration);
        }
    } else {
        // Показуємо toast, якщо API сповіщень недоступне
        showToast(message, type, mergedOptions.duration);
    }
}

/**
 * Додавання водяного знаку до блоку
 * @param {HTMLElement} container - Контейнер для додавання водяного знаку
 * @param {string} text - Текст водяного знаку
 * @param {Object} [options={}] - Опції для налаштування водяного знаку
 * @returns {HTMLElement} Створений елемент водяного знаку
 */
export function markElement(container, text = 'ОТРИМАНО', options = {}) {
    try {
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

        // Використовуємо DocumentFragment для оптимізації
        const fragment = document.createDocumentFragment();

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

        // Додаємо елементи до фрагменту
        watermark.appendChild(overlay);
        watermark.appendChild(textElement);
        fragment.appendChild(watermark);

        // Якщо контейнер не має position: relative, додаємо його
        const containerStyle = window.getComputedStyle(container);
        if (containerStyle.position === 'static') {
            container.style.position = 'relative';
        }

        // Додаємо фрагмент до контейнера (одна операція DOM)
        container.appendChild(fragment);

        return watermark;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка додавання водяного знаку:', error);
        } else {
            console.error('Помилка додавання водяного знаку:', error);
        }
        return null;
    }
}

/**
 * Очікування появи елемента в DOM
 * @param {string} selector - CSS-селектор елемента
 * @param {Object} [options={}] - Параметри очікування
 * @returns {Promise<HTMLElement>} - Проміс з елементом DOM
 */
export function waitForElement(selector, options = {}) {
    const defaultOptions = {
        timeout: 5000,
        checkInterval: 50,
        context: document,
        onTimeout: null
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
        // Перевіряємо, чи елемент вже існує
        const element = mergedOptions.context.querySelector(selector);
        if (element) {
            return resolve(element);
        }

        // Часовий ідентифікатор для очищення таймаутів і інтервалів
        const timeKey = selector + '_' + Date.now();

        // Використовуємо інтервал для регулярної перевірки
        // Це швидше і ефективніше, ніж MutationObserver для простих випадків
        let checkCount = 0;
        const maxChecks = Math.ceil(mergedOptions.timeout / mergedOptions.checkInterval);

        const interval = setInterval(() => {
            checkCount++;
            const element = mergedOptions.context.querySelector(selector);

            if (element) {
                clearInterval(interval);

                // Скасовуємо таймаут, якщо він встановлений
                if (_timeouts.has(timeKey)) {
                    clearTimeout(_timeouts.get(timeKey));
                    _timeouts.delete(timeKey);
                }

                resolve(element);
            } else if (checkCount >= maxChecks) {
                clearInterval(interval);

                // Викликаємо користувацький обробник таймауту, якщо є
                if (typeof mergedOptions.onTimeout === 'function') {
                    mergedOptions.onTimeout();
                }

                reject(new Error(`Елемент ${selector} не з'явився протягом ${mergedOptions.timeout}ms`));
            }
        }, mergedOptions.checkInterval);

        // Встановлюємо таймаут для скасування спостереження
        const timeoutId = setTimeout(() => {
            clearInterval(interval);
            _timeouts.delete(timeKey);

            // Викликаємо користувацький обробник таймауту, якщо є
            if (typeof mergedOptions.onTimeout === 'function') {
                mergedOptions.onTimeout();
            }

            reject(new Error(`Елемент ${selector} не з'явився протягом ${mergedOptions.timeout}ms`));
        }, mergedOptions.timeout);

        // Зберігаємо ідентифікатор таймауту для можливості скасування
        _timeouts.set(timeKey, timeoutId);
    });
}

/**
 * Копіювання тексту в буфер обміну
 * @param {string} text - Текст для копіювання
 * @param {Object} [options={}] - Параметри копіювання
 * @returns {Promise<boolean>} - Результат копіювання
 */
export function copyToClipboard(text, options = {}) {
    const defaultOptions = {
        showFeedback: true,
        feedbackMessage: 'Текст скопійовано в буфер обміну',
        feedbackType: 'success',
        feedbackDuration: 2000
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
        try {
            // Використовуємо сучасний Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        if (mergedOptions.showFeedback) {
                            showToast(
                                mergedOptions.feedbackMessage,
                                mergedOptions.feedbackType,
                                mergedOptions.feedbackDuration
                            );
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
                    if (mergedOptions.showFeedback) {
                        showToast(
                            mergedOptions.feedbackMessage,
                            mergedOptions.feedbackType,
                            mergedOptions.feedbackDuration
                        );
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

/**
 * Додавання делегування подій для елементів
 * @param {HTMLElement|string} parentElement - Батьківський елемент або селектор
 * @param {string} eventType - Тип події (click, mouseover тощо)
 * @param {string} childSelector - CSS-селектор для дочірніх елементів
 * @param {Function} callback - Функція-обробник події
 * @returns {Object} Об'єкт з методом remove для видалення обробника
 */
export function delegateEvent(parentElement, eventType, childSelector, callback) {
    try {
        // Отримуємо батьківський елемент
        const parent = typeof parentElement === 'string'
            ? getElement(parentElement)
            : parentElement;

        if (!parent) {
            throw new Error(`Батьківський елемент не знайдено: ${parentElement}`);
        }

        // Функція-обробник, що перевіряє відповідність дочірнього елемента
        const delegatedHandler = function(event) {
            // Знаходимо цільовий елемент, що відповідає селектору
            let targetElement = event.target;

            // Перевіряємо, чи цільовий елемент або його предок відповідає селектору
            while (targetElement && targetElement !== parent) {
                if (targetElement.matches(childSelector)) {
                    // Викликаємо обробник з правильним this та передаємо елемент як другий аргумент
                    callback.call(targetElement, event, targetElement);
                    return;
                }
                targetElement = targetElement.parentElement;
            }
        };

        // Додаємо обробник до батьківського елемента
        parent.addEventListener(eventType, delegatedHandler);

        // Повертаємо об'єкт для видалення обробника
        return {
            remove: function() {
                parent.removeEventListener(eventType, delegatedHandler);
            }
        };
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка делегування події:', error);
        } else {
            console.error('Помилка делегування події:', error);
        }

        // Повертаємо порожній об'єкт з методом remove
        return { remove: function() {} };
    }
}

/**
 * Створення модального вікна
 * @param {Object} options - Параметри модального вікна
 * @returns {Object} Об'єкт з методами управління модальним вікном
 */
export function createModal(options = {}) {
    const defaultOptions = {
        id: _generateUid('modal'),
        title: '',
        content: '',
        footer: '',
        closeOnEscape: true,
        closeOnOverlay: true,
        showCloseButton: true,
        width: null,
        height: null,
        className: '',
        onOpen: null,
        onClose: null,
        afterRender: null
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Створюємо модальне вікно
    const modal = document.createElement('div');
    modal.id = mergedOptions.id;
    modal.className = `winix-modal ${mergedOptions.className}`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Встановлюємо HTML-структуру
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-container" style="${mergedOptions.width ? `width:${mergedOptions.width};` : ''}${mergedOptions.height ? `height:${mergedOptions.height};` : ''}">
            <div class="modal-header">
                <h2 class="modal-title">${mergedOptions.title}</h2>
                ${mergedOptions.showCloseButton ? '<button class="modal-close">&times;</button>' : ''}
            </div>
            <div class="modal-body">${mergedOptions.content}</div>
            ${mergedOptions.footer ? `<div class="modal-footer">${mergedOptions.footer}</div>` : ''}
        </div>
    `;

    // Додаємо базові стилі, якщо їх немає
    if (!document.getElementById('winix-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'winix-modal-styles';
        style.textContent = `
            .winix-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
            }
            
            .winix-modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .modal-container {
                position: relative;
                background: white;
                border-radius: 8px;
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                transform: translateY(20px);
                transition: transform 0.3s;
                overflow: hidden;
            }
            
            .winix-modal.show .modal-container {
                transform: translateY(0);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .modal-title {
                margin: 0;
                font-size: 18px;
                font-weight: bold;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                color: #666;
            }
            
            .modal-close:hover {
                color: #333;
            }
            
            .modal-body {
                padding: 20px;
                overflow-y: auto;
                flex-grow: 1;
            }
            
            .modal-footer {
                padding: 15px 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .modal-btn {
                padding: 8px 15px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
            }
            
            .modal-btn-primary {
                background: #2D6EB6;
                color: white;
            }
            
            .modal-btn-primary:hover {
                background: #2258a5;
            }
            
            .modal-btn-secondary {
                background: #f2f2f2;
                color: #333;
            }
            
            .modal-btn-secondary:hover {
                background: #e0e0e0;
            }
        `;

        document.head.appendChild(style);
    }

    // Методи для управління модальним вікном
    const modalApi = {
        element: modal,

        // Відкриття модального вікна
        open: function() {
            document.body.appendChild(modal);

            // Запускаємо анімацію появи
            setTimeout(() => {
                modal.classList.add('show');

                // Забороняємо скролінг основного документа
                document.body.style.overflow = 'hidden';

                // Викликаємо обробник onOpen, якщо є
                if (typeof mergedOptions.onOpen === 'function') {
                    mergedOptions.onOpen(modalApi);
                }
            }, 10);

            // Обробка Escape для закриття
            if (mergedOptions.closeOnEscape) {
                const escHandler = function(e) {
                    if (e.key === 'Escape') {
                        modalApi.close();
                    }
                };

                document.addEventListener('keydown', escHandler);
                modalApi._escHandler = escHandler;
            }

            return modalApi;
        },

        // Закриття модального вікна
        close: function() {
            modal.classList.remove('show');

            setTimeout(() => {
                // Видаляємо модальне вікно з DOM
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }

                // Відновлюємо скролінг документа, тільки якщо немає інших модальних вікон
                const otherModals = document.querySelectorAll('.winix-modal.show');
                if (otherModals.length === 0) {
                    document.body.style.overflow = '';
                }

                // Видаляємо обробник Escape, якщо він є
                if (modalApi._escHandler) {
                    document.removeEventListener('keydown', modalApi._escHandler);
                    delete modalApi._escHandler;
                }

                // Викликаємо обробник onClose, якщо є
                if (typeof mergedOptions.onClose === 'function') {
                    mergedOptions.onClose(modalApi);
                }
            }, 300);

            return modalApi;
        },

        // Оновлення вмісту модального вікна
        updateContent: function(newContent) {
            const bodyElement = modal.querySelector('.modal-body');
            if (bodyElement) {
                bodyElement.innerHTML = newContent;
            }
            return modalApi;
        },

        // Оновлення заголовка модального вікна
        updateTitle: function(newTitle) {
            const titleElement = modal.querySelector('.modal-title');
            if (titleElement) {
                titleElement.innerHTML = newTitle;
            }
            return modalApi;
        },

        // Оновлення нижньої частини модального вікна
        updateFooter: function(newFooter) {
            let footerElement = modal.querySelector('.modal-footer');

            if (!footerElement && newFooter) {
                // Створюємо footer, якщо його немає
                const container = modal.querySelector('.modal-container');
                if (container) {
                    footerElement = document.createElement('div');
                    footerElement.className = 'modal-footer';
                    container.appendChild(footerElement);
                }
            }

            if (footerElement) {
                if (newFooter) {
                    footerElement.innerHTML = newFooter;
                } else if (footerElement.parentNode) {
                    // Видаляємо footer, якщо передано порожній вміст
                    footerElement.parentNode.removeChild(footerElement);
                }
            }

            return modalApi;
        }
    };

    // Обробники подій для модального вікна
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => modalApi.close());
    }

    const overlay = modal.querySelector('.modal-overlay');
    if (overlay && mergedOptions.closeOnOverlay) {
        overlay.addEventListener('click', () => modalApi.close());
    }

    // Викликаємо afterRender, якщо вказано
    if (typeof mergedOptions.afterRender === 'function') {
        mergedOptions.afterRender(modalApi);
    }

    return modalApi;
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
    // Очищаємо кеш DOM-елементів
    _domCache.clear();

    // Очищаємо всі таймаути
    for (const [key, timeoutId] of _timeouts.entries()) {
        clearTimeout(timeoutId);
        _timeouts.delete(key);
    }

    // Очищаємо чергу сповіщень
    _notificationQueue.length = 0;
    _processingNotificationQueue = false;

    // Скидаємо лічильник UID
    _uidCounter = 0;
}

// Ініціалізація модуля
function initUiHelpers() {
    // Підготовка мікрокешу для основних елементів сторінки
    document.addEventListener('DOMContentLoaded', () => {
        try {
            // Кешуємо основні елементи сторінки
            ['#app', '#main-content', '#header', '#footer', '#sidebar', '#content'].forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    _domCache.set(selector, element);
                }
            });
        } catch (error) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.error('Помилка ініціалізації ui-helpers:', error);
            } else {
                console.error('Помилка ініціалізації ui-helpers:', error);
            }
        }
    });

    // Логуємо успішну ініціалізацію
    if (WinixRaffles.logger) {
        WinixRaffles.logger.log("UI-helpers: Модуль успішно ініціалізовано");
    } else {
        console.log("🎮 WINIX Raffles: Ініціалізація утиліт UI");
    }

    // Повертаємо об'єкт із зовнішнім API
    return {
        getElement,
        getAllElements,
        clearDomCache,
        showLoading,
        hideLoading,
        showToast,
        showConfirm,
        showNotification,
        markElement,
        waitForElement,
        copyToClipboard,
        delegateEvent,
        createModal,
        cleanup
    };
}

// Додаємо функції в глобальний об'єкт для зворотної сумісності
if (WinixRaffles && WinixRaffles.utils) {
    WinixRaffles.utils.ui = initUiHelpers();

    // Для зворотної сумісності додаємо основні функції напряму до utils
    WinixRaffles.utils.showLoading = showLoading;
    WinixRaffles.utils.hideLoading = hideLoading;
    WinixRaffles.utils.showToast = showToast;
    WinixRaffles.utils.showConfirm = showConfirm;
    WinixRaffles.utils.markElement = markElement;
    WinixRaffles.utils.getElement = getElement;
}

// Експортуємо всі основні функції
export default initUiHelpers();