/**
 * Animations Utils - допоміжні функції для анімацій
 * Відповідає за:
 * - Утилітарні функції для анімацій
 * - Створення ефектів часток
 * - Очищення ресурсів
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils/logger.js';
import { state } from './core.js';

// Ініціалізуємо логер для модуля
const logger = getLogger('UI.Animations.Utils');

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
    // Зупиняємо всі таймери
    Object.keys(state.timers).forEach(id => {
        clearTimeout(state.timers[id]);
        delete state.timers[id];
    });

    logger.info('Ресурси модуля очищено', 'cleanup', {
        category: LOG_CATEGORIES.LOGIC
    });
}

/**
 * Відкладене виконання функції (утиліта)
 */
export function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Створення часток для анімації успіху
 */
export function createSuccessParticles(element) {
    // Отримуємо розміри та позицію елемента
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Кількість частинок залежно від продуктивності
    const particleCount = state.devicePerformance === 'high' ? 15 : 8;

    logger.debug(`Створення ${particleCount} частинок для анімації успіху`, 'createSuccessParticles', {
        category: LOG_CATEGORIES.ANIMATION,
        details: {
            centerX,
            centerY,
            performanceMode: state.devicePerformance
        }
    });

    // Створюємо частинки
    for (let i = 0; i < particleCount; i++) {
        createSingleParticle(centerX, centerY);
    }
}

/**
 * Створення однієї частинки з анімацією
 */
function createSingleParticle(centerX, centerY) {
    // Імпортуємо кольори з конфігурації
    const { config } = require('./core.js');

    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.width = `${Math.random() * 8 + 4}px`;
    particle.style.height = `${Math.random() * 8 + 4}px`;
    particle.style.backgroundColor = config.particleColors[Math.floor(Math.random() * config.particleColors.length)];
    particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    particle.style.top = `${centerY}px`;
    particle.style.left = `${centerX}px`;
    particle.style.position = 'fixed';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    particle.style.transform = 'translate(-50%, -50%)';

    // Додаємо до документу
    document.body.appendChild(particle);

    // Анімуємо частинку
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 100 + 50;
    const duration = Math.random() * 1.5 + 0.5;

    // Створюємо анімацію
    const animation = particle.animate([
        {
            transform: 'translate(-50%, -50%) scale(0.3)',
            opacity: 1
        },
        {
            transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1) rotate(${Math.random() * 360}deg)`,
            opacity: 0
        }
    ], {
        duration: duration * 1000,
        easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
        fill: 'forwards'
    });

    // Видаляємо частинку після завершення анімації
    animation.onfinish = () => {
        particle.remove();
    };
}

/**
 * Анімація підсвічування елемента
 */
export function highlightElement(element, color = 'rgba(0, 201, 167, 0.6)', duration = 1000) {
    if (!element) return;

    // Зберігаємо початкові стилі
    const originalBoxShadow = element.style.boxShadow;
    const originalTransition = element.style.transition;

    // Додаємо підсвічування
    element.style.transition = `box-shadow ${duration/2}ms ease`;
    element.style.boxShadow = `0 0 15px ${color}`;

    // Повертаємо початковий стан через половину тривалості
    setTimeout(() => {
        element.style.boxShadow = originalBoxShadow || 'none';

        // Відновлюємо перехід після завершення
        setTimeout(() => {
            element.style.transition = originalTransition;
        }, duration/2);
    }, duration/2);
}

/**
 * Анімація масштабування елемента
 */
export function pulseElement(element, scale = 1.05, duration = 500) {
    if (!element) return;

    // Зберігаємо початкові стилі
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;

    // Додаємо анімацію масштабування
    element.style.transition = `transform ${duration/2}ms cubic-bezier(0.1, 0.8, 0.2, 1)`;
    element.style.transform = `${originalTransform || ''} scale(${scale})`;

    // Повертаємо початковий стан
    setTimeout(() => {
        element.style.transform = originalTransform || '';

        // Відновлюємо перехід після завершення
        setTimeout(() => {
            element.style.transition = originalTransition;
        }, duration/2);
    }, duration/2);
}

/**
 * Створення хвильового ефекту від клікнутого елемента
 */
export function createRippleEffect(event, color = 'rgba(255, 255, 255, 0.3)') {
    const button = event.currentTarget;

    // Перевіряємо, чи елемент має position
    const position = window.getComputedStyle(button).position;
    if (position === 'static') {
        button.style.position = 'relative';
    }

    // Створюємо елемент хвилі
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';

    // Розміщуємо в батьківському елементі
    button.appendChild(ripple);

    // Розраховуємо розмір (більший з розмірів кнопки)
    const size = Math.max(button.clientWidth, button.clientHeight);
    ripple.style.width = ripple.style.height = `${size}px`;

    // Розміщуємо відносно позиції кліку
    const rect = button.getBoundingClientRect();
    ripple.style.left = `${event.clientX - rect.left - (size / 2)}px`;
    ripple.style.top = `${event.clientY - rect.top - (size / 2)}px`;

    // Додаємо стилі
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.transform = 'scale(0)';
    ripple.style.backgroundColor = color;
    ripple.style.opacity = '1';
    ripple.style.pointerEvents = 'none';

    // Анімуємо
    ripple.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
    ripple.style.transform = 'scale(1)';
    ripple.style.opacity = '0';

    // Видаляємо після закінчення анімації
    setTimeout(() => {
        ripple.remove();
    }, 500);
}

// Експортуємо публічне API модуля
export {
    cleanup,
    debounce,
    createSuccessParticles,
    highlightElement,
    pulseElement,
    createRippleEffect
};