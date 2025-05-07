/**
 * Toasts - модуль для управління та відображення простих повідомлень
 * Відповідає за:
 * - Відображення toast-повідомлень різних типів
 * - Керування чергою повідомлень
 * - Адаптивне відображення на різних пристроях
 *
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils/logger.js';

// Створюємо логер для модуля
const logger = getLogger('UI.Toasts');

// Імпортуємо спільні налаштування
import { CONFIG, injectStyles, ensureContainer } from './common.js';

// Стан модуля для управління повідомленнями
const state = {
    notificationShowing: false,   // Чи показується зараз сповіщення
    notificationsQueue: [],       // Черга сповіщень
    notificationsCounter: 0,      // Лічильник сповіщень
    containerId: 'notification-container',  // ID контейнера сповіщень
    activeTimeout: null,          // Поточний таймер автозакриття
    activeNotifications: new Set() // Активні сповіщення
};

/**
 * Ініціалізація модуля toast-повідомлень
 * @param {Object} options - Налаштування
 */
export function init(options = {}) {
    logger.info('Ініціалізація модуля toast-повідомлень', 'init', {
        category: LOG_CATEGORIES.INIT
    });

    // Додаємо стилі тільки один раз
    injectStyles();

    // Створюємо контейнер для сповіщень якщо його немає
    ensureContainer(state.containerId);
}

/**
 * Показ інформаційного сповіщення
 * @param {string} message - Текст повідомлення
 * @param {Function} callback - Функція зворотного виклику
 */
export function showInfo(message, callback = null) {
    return showNotification(message, 'info', callback);
}

/**
 * Показ сповіщення про успіх
 * @param {string} message - Текст повідомлення
 * @param {Function} callback - Функція зворотного виклику
 */
export function showSuccess(message, callback = null) {
    return showNotification(message, 'success', callback);
}

/**
 * Показ сповіщення про помилку
 * @param {string} message - Текст повідомлення
 * @param {Function} callback - Функція зворотного виклику
 */
export function showError(message, callback = null) {
    return showNotification(message, 'error', callback);
}

/**
 * Показ сповіщення-попередження
 * @param {string} message - Текст повідомлення
 * @param {Function} callback - Функція зворотного виклику
 */
export function showWarning(message, callback = null) {
    return showNotification(message, 'warning', callback);
}

/**
 * Універсальна функція показу сповіщень (оптимізовано)
 * @param {string|Object} message - Текст або об'єкт з налаштуваннями
 * @param {string} type - Тип сповіщення
 * @param {Function|Object} callback - Функція або додаткові параметри
 * @returns {Promise} Проміс, що завершується при закритті сповіщення
 */
export function showNotification(message, type = 'info', callback = null, options = {}) {
    // Обробка різних форматів аргументів
    if (typeof type === 'boolean') {
        type = type ? 'error' : 'success';
    }

    if (typeof callback === 'object' && callback !== null) {
        options = callback;
        callback = null;
    }

    // Перевірка на пусте повідомлення
    if (!message || (typeof message === 'string' && message.trim() === '')) {
        if (callback) setTimeout(callback, 100);
        return Promise.resolve();
    }

    // Обробка об'єкта з повідомленням
    let title = options.title || getDefaultTitle(type);
    if (typeof message === 'object') {
        title = message.title || title;
        message = message.message || message.text || '';
    }

    logger.info(`Показ сповіщення ${type}: ${message}`, 'showNotification', {
        category: LOG_CATEGORIES.UI,
        details: { type, title, message }
    });

    return new Promise((resolve) => {
        // Якщо вже показується інше сповіщення, додаємо в чергу
        if (state.notificationShowing && state.notificationsQueue.length < CONFIG.maxNotifications) {
            state.notificationsQueue.push({
                message,
                type,
                callback,
                options: { ...options, title },
                resolve
            });

            logger.debug('Сповіщення додано в чергу', 'showNotification', {
                category: LOG_CATEGORIES.UI,
                details: { queueLength: state.notificationsQueue.length }
            });

            return;
        }

        state.notificationShowing = true;
        state.notificationsCounter++;
        const notificationId = `notification_${state.notificationsCounter}`;

        try {
            // Перевіряємо наявність контейнера
            ensureContainer(state.containerId);
            const container = document.getElementById(state.containerId);

            // Створюємо сповіщення
            const notification = createNotificationElement(
                notificationId,
                type,
                title,
                message
            );

            // Додаємо до контейнера
            container.appendChild(notification);

            // Показуємо сповіщення з невеликою затримкою
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);

            // Запускаємо вібрацію для помилок та попереджень
            if ((type === 'error' || type === 'warning') && navigator.vibrate) {
                navigator.vibrate(type === 'error' ? 200 : 100);
            }

            // Додаємо до списку активних сповіщень
            state.activeNotifications.add(notificationId);

            // Автоматичне закриття
            const duration = options.duration || CONFIG.autoHideTimeout;
            if (duration !== 0) {
                state.activeTimeout = setTimeout(() => {
                    closeNotification(notification, callback, resolve);
                }, duration);
            }

        } catch (e) {
            logger.error(e, 'Помилка показу сповіщення', {
                category: LOG_CATEGORIES.UI,
                details: { type, message }
            });

            // Використовуємо alert як запасний варіант
            alert(message);
            state.notificationShowing = false;
            if (callback) callback();
            resolve();
        }
    });
}

/**
 * Створення елемента сповіщення
 * @param {string} id - Ідентифікатор
 * @param {string} type - Тип сповіщення
 * @param {string} title - Заголовок
 * @param {string} message - Повідомлення
 * @returns {HTMLElement} Елемент сповіщення
 */
function createNotificationElement(id, type, title, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = id;

    // Додаємо іконку
    const icon = document.createElement('div');
    icon.className = 'notification-icon';

    // Обираємо символ для іконки
    let iconContent = '';
    switch (type) {
        case 'error': iconContent = '✕'; break;
        case 'success': iconContent = '✓'; break;
        case 'warning': iconContent = '!'; break;
        case 'info': default: iconContent = 'i';
    }
    icon.textContent = iconContent;

    // Додаємо контент
    const content = document.createElement('div');
    content.className = 'notification-content';

    const titleElement = document.createElement('div');
    titleElement.className = 'notification-title';
    titleElement.textContent = title;

    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.textContent = message;

    content.appendChild(titleElement);
    content.appendChild(messageElement);

    // Додаємо кнопку закриття
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.setAttribute('aria-label', 'Закрити');

    // Додаємо обробник для закриття сповіщення
    closeBtn.addEventListener('click', () => {
        closeNotification(notification);
    });

    // Збираємо елементи
    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeBtn);

    logger.debug(`Створено елемент сповіщення ID: ${id}`, 'createNotificationElement', {
        category: LOG_CATEGORIES.RENDERING,
        details: { type, id }
    });

    return notification;
}

/**
 * Отримання стандартного заголовка для типу сповіщення
 * @param {string} type - Тип сповіщення
 * @returns {string} Заголовок
 */
function getDefaultTitle(type) {
    switch (type) {
        case 'error': return 'Помилка';
        case 'success': return 'Успішно';
        case 'warning': return 'Увага';
        case 'info': default: return 'Інформація';
    }
}

/**
 * Закриття сповіщення
 * @param {HTMLElement} notification - Елемент сповіщення
 * @param {Function} callback - Функція зворотного виклику
 * @param {Function} resolvePromise - Функція для вирішення промісу
 */
function closeNotification(notification, callback = null, resolvePromise = null) {
    // Перевіряємо, чи сповіщення ще існує
    if (!notification || !notification.parentNode) {
        state.notificationShowing = false;
        processNextNotification();
        return;
    }

    logger.debug(`Закриття сповіщення ID: ${notification.id}`, 'closeNotification', {
        category: LOG_CATEGORIES.UI
    });

    // Знімаємо клас show
    notification.classList.remove('show');

    // Видаляємо з DOM після анімації
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }

        // Видаляємо з активних сповіщень
        state.activeNotifications.delete(notification.id);

        // Скидаємо прапорець для можливості показу наступного сповіщення
        state.notificationShowing = false;

        // Виконуємо callback
        if (callback) setTimeout(() => callback(), 0);

        // Вирішуємо проміс
        if (resolvePromise) resolvePromise();

        // Показуємо наступне сповіщення з черги
        processNextNotification();
    }, CONFIG.animationDuration);
}

/**
 * Обробка наступного сповіщення з черги
 */
function processNextNotification() {
    if (state.notificationsQueue.length > 0) {
        const nextNotification = state.notificationsQueue.shift();

        logger.debug('Обробка наступного сповіщення з черги', 'processNextNotification', {
            category: LOG_CATEGORIES.UI,
            details: {
                type: nextNotification.type,
                queueLength: state.notificationsQueue.length
            }
        });

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
}

/**
 * Оновлення відображення балансу на всіх елементах UI
 * @param {number} newBalance - Новий баланс
 */
export function updateBalanceUI(newBalance) {
    try {
        // Списки елементів для оновлення
        const balanceElements = [
            document.getElementById('user-tokens'),
            document.getElementById('main-balance'),
            document.querySelector('.balance-amount'),
            document.getElementById('current-balance'),
            ...document.querySelectorAll('[data-balance-display]')
        ];

        logger.info(`Оновлення балансу UI: ${newBalance}`, 'updateBalanceUI', {
            category: LOG_CATEGORIES.UI,
            details: { newBalance, elementsFound: balanceElements.filter(Boolean).length }
        });

        // Оновлюємо відображення в DOM
        balanceElements.forEach(element => {
            if (!element) return;

            // Оновлюємо вміст елемента
            if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                const iconPart = element.querySelector('.main-balance-icon')?.outerHTML || '';
                element.innerHTML = `${parseFloat(newBalance).toFixed(2)} ${iconPart}`;
            } else {
                element.textContent = parseFloat(newBalance).toFixed(2);
            }

            // Додаємо анімацію оновлення
            element.classList.add('balance-updated');
            setTimeout(() => {
                element.classList.remove('balance-updated');
            }, 1000);
        });

        // Зберігаємо значення в localStorage
        try {
            localStorage.setItem('userTokens', newBalance.toString());
            localStorage.setItem('winix_balance', newBalance.toString());
        } catch (error) {
            logger.warn('Помилка збереження балансу', 'updateBalanceUI', {
                category: LOG_CATEGORIES.STORAGE,
                details: { error: error.message }
            });
        }

        // Генеруємо подію для інших модулів
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: { newBalance: parseFloat(newBalance) }
        }));

    } catch (error) {
        logger.error(error, 'Помилка оновлення відображення балансу', {
            category: LOG_CATEGORIES.UI
        });
    }
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
    // Закрити активні сповіщення
    state.activeNotifications.forEach(id => {
        const notification = document.getElementById(id);
        if (notification) {
            notification.parentNode.removeChild(notification);
        }
    });

    // Очистити чергу сповіщень
    state.notificationsQueue = [];
    state.activeNotifications.clear();

    // Очистити таймери
    if (state.activeTimeout) {
        clearTimeout(state.activeTimeout);
        state.activeTimeout = null;
    }

    logger.info('Ресурси модуля toast-повідомлень очищено', 'cleanup', {
        category: LOG_CATEGORIES.LOGIC
    });
}

// Експорт об'єкта за замовчуванням
export default {
    init,
    showInfo,
    showSuccess,
    showError,
    showWarning,
    showNotification,
    updateBalanceUI,
    cleanup
};