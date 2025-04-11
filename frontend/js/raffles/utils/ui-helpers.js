/**
 * ui-helpers.js - Утилітарні функції для роботи з UI
 */

import WinixRaffles from '../globals.js';

/**
 * Показати індикатор завантаження
 * @param {string} message - Повідомлення, яке буде показано
 */
export function showLoading(message = 'Завантаження...') {
    // Спочатку перевіряємо, чи є глобальна функція
    if (window.showLoading && typeof window.showLoading === 'function') {
        try {
            return window.showLoading(message);
        } catch (e) {
            console.warn("Помилка використання глобального showLoading:", e);
        }
    }

    // Запасний варіант, якщо глобальна функція не працює
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.add('show');

    // Додаємо текст повідомлення, якщо є елемент
    const spinnerText = document.getElementById('loading-spinner-text');
    if (spinnerText) spinnerText.textContent = message;
}

/**
 * Приховати індикатор завантаження
 */
export function hideLoading() {
    // Спочатку перевіряємо, чи є глобальна функція
    if (window.hideLoading && typeof window.hideLoading === 'function') {
        try {
            return window.hideLoading();
        } catch (e) {
            console.warn("Помилка використання глобального hideLoading:", e);
        }
    }

    // Запасний варіант, якщо глобальна функція не працює
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('show');
}

/**
 * Показати повідомлення toast
 * @param {string} message - Текст повідомлення
 * @param {number} duration - Тривалість відображення в мілісекундах
 */
export function showToast(message, duration = 3000) {
    // Перевіряємо наявність глобальної функції
    if (window.showToast && typeof window.showToast === 'function') {
        try {
            return window.showToast(message, duration);
        } catch (e) {
            console.warn("Помилка використання глобального showToast:", e);
        }
    }

    // Запасний варіант, якщо глобальна функція відсутня
    const toast = document.getElementById('toast-message');
    if (!toast) {
        // Створюємо елемент toast
        const newToast = document.createElement('div');
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
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => showToast(message, duration), 100);
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Показати діалог підтвердження
 * @param {string} message - Текст повідомлення
 * @param {string} confirmText - Текст кнопки підтвердження
 * @param {string} cancelText - Текст кнопки скасування
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

        // Запасний варіант: використовуємо стандартний confirm
        const result = window.confirm(message);
        resolve(result);
    });
}

/**
 * Додавання водяного знаку до блоку з бонусом новачка
 * @param {HTMLElement} container - Контейнер для додавання водяного знаку
 * @param {string} text - Текст водяного знаку
 * @returns {HTMLElement} Створений елемент водяного знаку
 */
export function markElement(container, text = 'ОТРИМАНО') {
    if (!container) return;

    // Перевіряємо, чи вже є водяний знак
    if (container.querySelector('.watermark')) {
        return;
    }

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

    // Створюємо затемнення
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';

    // Створюємо текст
    const textElement = document.createElement('div');
    textElement.textContent = text;
    textElement.style.position = 'absolute';
    textElement.style.transform = 'rotate(-30deg)';
    textElement.style.fontSize = '24px';
    textElement.style.fontWeight = 'bold';
    textElement.style.color = 'white';
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

// Додаємо функції в глобальний об'єкт для зворотної сумісності
WinixRaffles.utils.showLoading = showLoading;
WinixRaffles.utils.hideLoading = hideLoading;
WinixRaffles.utils.showToast = showToast;
WinixRaffles.utils.showConfirm = showConfirm;
WinixRaffles.utils.markElement = markElement;

// Функції для роботи з UI також додаємо в субоб'єкт ui
WinixRaffles.utils.ui = {
    showLoading,
    hideLoading,
    showToast,
    showConfirm,
    markElement
};

console.log("🎮 WINIX Raffles: Ініціалізація утиліт UI");

// Експортуємо всі основні функції
export default {
    showLoading,
    hideLoading,
    showToast,
    showConfirm,
    markElement
};