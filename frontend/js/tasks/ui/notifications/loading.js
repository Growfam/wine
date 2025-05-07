/**
 * Loading - модуль для роботи з індикаторами завантаження
 * Відповідає за:
 * - Показ і приховування індикаторів завантаження
 * - Адаптивне відображення на різних пристроях
 *
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';

// Створюємо логер для модуля
const logger = getLogger('UI.Loading');

// Імпортуємо спільні налаштування
import { CONFIG, injectStyles } from './common.js';

// Стан модуля
const state = {
    loadingSpinnerId: 'loading-spinner',  // ID індикатора завантаження
};

/**
 * Ініціалізація модуля індикаторів завантаження
 */
export function init() {
    logger.info('Ініціалізація модуля індикаторів завантаження', 'init', {
        category: LOG_CATEGORIES.INIT
    });

    // Додаємо стилі тільки один раз
    injectStyles();

    // Додаємо обробник для клавіші Escape
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Обробка натискання клавіші Escape
 * @param {KeyboardEvent} event - Подія клавіатури
 */
function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        // Закриваємо індикатор завантаження
        const loadingSpinner = document.getElementById(state.loadingSpinnerId);
        if (loadingSpinner && loadingSpinner.classList.contains('show')) {
            hideLoading();
            event.preventDefault();

            logger.info('Закрито індикатор завантаження за допомогою Escape', 'handleEscapeKey', {
                category: LOG_CATEGORIES.UI
            });
        }
    }
}

/**
 * Показ індикатора завантаження
 * @param {string} message - Повідомлення
 */
export function showLoading(message) {
    try {
        let spinner = document.getElementById(state.loadingSpinnerId);

        if (!spinner) {
            // Створюємо індикатор
            const spinnerContainer = document.createElement('div');
            spinnerContainer.id = state.loadingSpinnerId;
            spinnerContainer.className = 'spinner-overlay';

            spinnerContainer.innerHTML = `
                <div class="spinner-content">
                    <div class="spinner"></div>
                    ${message ? `<div class="spinner-message">${message}</div>` : ''}
                </div>
            `;

            document.body.appendChild(spinnerContainer);
            spinner = spinnerContainer;

            logger.debug('Створено новий індикатор завантаження', 'showLoading', {
                category: LOG_CATEGORIES.RENDERING
            });
        } else {
            // Оновлюємо повідомлення
            if (message) {
                let messageEl = spinner.querySelector('.spinner-message');
                if (messageEl) {
                    messageEl.textContent = message;
                } else {
                    const content = spinner.querySelector('.spinner-content');
                    messageEl = document.createElement('div');
                    messageEl.className = 'spinner-message';
                    messageEl.textContent = message;
                    content.appendChild(messageEl);
                }

                logger.debug('Оновлено повідомлення індикатора завантаження', 'showLoading', {
                    category: LOG_CATEGORIES.RENDERING
                });
            }
        }

        // Показуємо індикатор
        spinner.classList.add('show');

        logger.info('Показано індикатор завантаження', 'showLoading', {
            category: LOG_CATEGORIES.UI,
            details: { message }
        });
    } catch (e) {
        logger.error(e, 'Помилка показу індикатора завантаження', {
            category: LOG_CATEGORIES.UI
        });
    }
}

/**
 * Приховування індикатора завантаження
 */
export function hideLoading() {
    try {
        const spinner = document.getElementById(state.loadingSpinnerId);
        if (spinner) {
            spinner.classList.remove('show');

            logger.info('Приховано індикатор завантаження', 'hideLoading', {
                category: LOG_CATEGORIES.UI
            });
        }
    } catch (e) {
        logger.error(e, 'Помилка приховування індикатора завантаження', {
            category: LOG_CATEGORIES.UI
        });
    }
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
    // Видаляємо обробник Escape
    document.removeEventListener('keydown', handleEscapeKey);

    // Приховуємо індикатор завантаження
    hideLoading();

    logger.info('Ресурси модуля індикаторів завантаження очищено', 'cleanup', {
        category: LOG_CATEGORIES.LOGIC
    });
}

export default {
    init,
    showLoading,
    hideLoading,
    cleanup
};