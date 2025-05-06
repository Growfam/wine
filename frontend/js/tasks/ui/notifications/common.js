/**
 * Common - спільні функції та налаштування для модуля сповіщень
 * Відповідає за:
 * - Спільні налаштування для всіх типів сповіщень
 * - Ін'єкцію стилів
 * - Створення контейнерів
 *
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils/logger.js';

// Створюємо логер для модуля
const logger = getLogger('UI.Notifications.Common');

// Конфігурація з оптимізованими значеннями
export const CONFIG = {
    maxNotifications: 3,       // Максимальна кількість одночасних сповіщень
    autoHideTimeout: 5000,     // Час автоматичного закриття (мс)
    animationDuration: 300,    // Тривалість анімації (мс)
    position: 'top-right',     // Позиція сповіщень
    maxWidth: 380,             // Максимальна ширина сповіщення
    debug: false               // Режим налагодження
};

/**
 * Ін'єкція CSS стилів у документ
 */
export function injectStyles() {
    // Перевіряємо, чи стилі вже додані
    if (document.getElementById('notification-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'notification-styles';

    // Оптимізований CSS з мінімальною кількістю правил
    styleElement.textContent = `
        /* Контейнер сповіщень */
        .notification-container {
            position: fixed;
            z-index: 9999;
            width: 90%;
            max-width: ${CONFIG.maxWidth}px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
            transition: all 0.3s ease;
        }
        
        /* Позиції */
        .notification-container.top-right {
            top: 20px;
            right: 20px;
        }
        
        .notification-container.top-center {
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
        }
        
        .notification-container.bottom-right {
            bottom: 20px;
            right: 20px;
        }
        
        /* Сповіщення */
        .notification {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            color: white;
            transform: translateX(50px);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                       opacity 0.4s ease;
            pointer-events: auto;
            position: relative;
            overflow: hidden;
        }
        
        .notification.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        /* Типи сповіщень */
        .notification::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(to bottom, #4eb5f7, #00C9A7);
        }
        
        .notification.error::before {
            background: linear-gradient(to bottom, #FF5252, #B71C1C);
        }
        
        .notification.success::before {
            background: linear-gradient(to bottom, #4CAF50, #2E7D32);
        }
        
        .notification.info::before {
            background: linear-gradient(to bottom, #2196F3, #1976D2);
        }
        
        .notification.warning::before {
            background: linear-gradient(to bottom, #FFC107, #FF9800);
        }
        
        /* Компоненти сповіщення */
        .notification-icon {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-right: 14px;
            background: rgba(255, 255, 255, 0.15);
        }
        
        .notification-content {
            flex-grow: 1;
            padding-right: 8px;
        }
        
        .notification-title {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 15px;
        }
        
        .notification-message {
            opacity: 0.9;
            font-size: 14px;
        }
        
        .notification-close {
            width: 26px;
            height: 26px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.2s ease;
            padding: 0;
            position: relative;
        }
        
        .notification-close::before,
        .notification-close::after {
            content: '';
            position: absolute;
            width: 12px;
            height: 2px;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 1px;
        }
        
        .notification-close::before {
            transform: rotate(45deg);
        }
        
        .notification-close::after {
            transform: rotate(-45deg);
        }
        
        /* Діалог підтвердження */
        .confirm-overlay {
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
        
        .confirm-overlay.show {
            opacity: 1;
            visibility: visible;
        }
        
        .confirm-dialog {
            background: rgba(15, 23, 42, 0.95);
            border-radius: 20px;
            padding: 30px;
            width: 90%;
            max-width: 380px;
            transform: scale(0.95) translateY(20px);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        
        .confirm-overlay.show .confirm-dialog {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        .confirm-title {
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 16px;
            color: white;
        }
        
        .confirm-message {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
            color: rgba(255, 255, 255, 0.9);
        }
        
        .confirm-buttons {
            display: flex;
            justify-content: center;
            gap: 16px;
            width: 100%;
        }
        
        .confirm-button {
            flex-basis: 45%;
            padding: 14px;
            border-radius: 14px;
            border: none;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .confirm-button-cancel {
            background: rgba(255, 255, 255, 0.1);
            color: white;
        }
        
        .confirm-button-confirm {
            background: linear-gradient(135deg, #4eb5f7, #00C9A7);
            color: white;
        }
        
        .confirm-button-danger {
            background: linear-gradient(135deg, #F44336, #B71C1C);
            color: white;
        }
        
        /* Індикатор завантаження */
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
            backdrop-filter: blur(8px);
        }
        
        .spinner-overlay.show {
            opacity: 1;
            visibility: visible;
        }
        
        .spinner-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            background: rgba(15, 23, 42, 0.8);
            padding: 36px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(0, 201, 167, 0.2);
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
        
        /* Баланс */
        @keyframes balance-highlight {
            0% { color: inherit; text-shadow: none; }
            50% { color: #4eb5f7; text-shadow: 0 0 10px rgba(78, 181, 247, 0.8); }
            100% { color: inherit; text-shadow: none; }
        }
        
        .balance-updated {
            animation: balance-highlight 1.2s ease;
        }
        
        /* Адаптивність */
        @media (max-width: 480px) {
            .notification-container {
                max-width: 320px;
                width: 95%;
            }
            
            .notification {
                padding: 12px;
            }
            
            .notification-title {
                font-size: 14px;
            }
            
            .notification-message {
                font-size: 13px;
            }
        }
    `;

    document.head.appendChild(styleElement);

    logger.debug('Додано стилі сповіщень', 'injectStyles', {
        category: LOG_CATEGORIES.RENDERING
    });
}

/**
 * Забезпечення наявності контейнера для сповіщень
 * @param {string} containerId - ID контейнера
 */
export function ensureContainer(containerId) {
    if (!document.getElementById(containerId)) {
        const container = document.createElement('div');
        container.id = containerId;
        container.className = `notification-container ${CONFIG.position}`;
        document.body.appendChild(container);

        logger.debug('Створено контейнер для сповіщень', 'ensureContainer', {
            category: LOG_CATEGORIES.RENDERING
        });
    }
}

/**
 * Оновлення конфігурації
 * @param {Object} newConfig - Нові налаштування
 * @returns {Object} Оновлена конфігурація
 */
export function updateConfig(newConfig) {
    Object.assign(CONFIG, newConfig);

    logger.info('Оновлено конфігурацію сповіщень', 'updateConfig', {
        category: LOG_CATEGORIES.INIT,
        details: CONFIG
    });

    return { ...CONFIG };
}