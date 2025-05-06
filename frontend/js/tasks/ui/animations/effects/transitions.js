/**
 * Transitions - модуль ефектів переходів та анімацій
 * Відповідає за:
 * - Анімації підсвічування елементів
 * - Анімації масштабування
 * - Ефекти хвиль та пульсацій
 * - Інші візуальні переходи
 *
 * @version 1.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/logger.js';

// Створюємо логер для модуля
const logger = getLogger('UI.Animations.Effects.Transitions');

/**
 * Анімація підсвічування елемента
 * @param {HTMLElement} element - Елемент для анімації
 * @param {string} color - Колір підсвічування
 * @param {number} duration - Тривалість анімації в мс
 * @returns {boolean} Успішність операції
 */
export function highlightElement(element, color = 'rgba(0, 201, 167, 0.6)', duration = 1000) {
    if (!element) return false;

    try {
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

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при анімації підсвічування', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація масштабування елемента (пульсація)
 * @param {HTMLElement} element - Елемент для анімації
 * @param {number} scale - Коефіцієнт масштабування
 * @param {number} duration - Тривалість анімації в мс
 * @returns {boolean} Успішність операції
 */
export function pulseElement(element, scale = 1.05, duration = 500) {
    if (!element) return false;

    try {
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

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при анімації пульсації', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Створення хвильового ефекту від клікнутого елемента
 * @param {Event} event - Подія кліку
 * @param {string} color - Колір хвилі
 * @returns {boolean} Успішність операції
 */
export function createRippleEffect(event, color = 'rgba(255, 255, 255, 0.3)') {
    try {
        const button = event.currentTarget;
        if (!button) return false;

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

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при створенні ефекту хвилі', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація появи елемента з затуханням
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function fadeIn(element, options = {}) {
    if (!element) return false;

    try {
        const {
            duration = 300,
            delay = 0,
            easing = 'ease',
            onComplete = null
        } = options;

        // Зберігаємо початкові стилі
        const originalDisplay = element.style.display;
        const originalOpacity = element.style.opacity;
        const originalVisibility = element.style.visibility;
        const originalTransition = element.style.transition;

        // Встановлюємо початкові значення
        element.style.opacity = '0';
        element.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
        element.style.visibility = 'visible';

        // Запускаємо затримку, щоб браузер обробив зміни
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ${easing}`;
            element.style.opacity = '1';

            // Після завершення анімації
            setTimeout(() => {
                // Відновлюємо оригінальний transition
                element.style.transition = originalTransition;

                // Викликаємо callback, якщо є
                if (typeof onComplete === 'function') {
                    onComplete(element);
                }
            }, duration);
        }, delay);

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при анімації появи', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація зникнення елемента з затуханням
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function fadeOut(element, options = {}) {
    if (!element) return false;

    try {
        const {
            duration = 300,
            delay = 0,
            easing = 'ease',
            remove = false,
            hide = true,
            onComplete = null
        } = options;

        // Зберігаємо початкові стилі
        const originalTransition = element.style.transition;

        // Встановлюємо transition
        element.style.transition = `opacity ${duration}ms ${easing}`;

        setTimeout(() => {
            // Запускаємо анімацію
            element.style.opacity = '0';

            // Після завершення анімації
            setTimeout(() => {
                if (hide) {
                    element.style.display = 'none';
                }

                if (remove && element.parentNode) {
                    element.parentNode.removeChild(element);
                }

                // Відновлюємо оригінальний transition
                element.style.transition = originalTransition;

                // Викликаємо callback, якщо є
                if (typeof onComplete === 'function') {
                    onComplete(element);
                }
            }, duration);
        }, delay);

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при анімації зникнення', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація появи елементів один за одним
 * @param {Array<HTMLElement>} elements - Масив елементів
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function animateSequence(elements, options = {}) {
    if (!elements || !elements.length) return false;

    try {
        const {
            delay = 100,
            duration = 300,
            transform = 'translateY(20px)',
            easing = 'cubic-bezier(0.1, 0.8, 0.2, 1)',
            onComplete = null
        } = options;

        // Початковий стан для всіх елементів
        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = transform;
        });

        // Анімуємо послідовно
        elements.forEach((el, index) => {
            setTimeout(() => {
                el.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';

                // Викликаємо callback після анімації останнього елемента
                if (index === elements.length - 1 && typeof onComplete === 'function') {
                    setTimeout(() => onComplete(elements), duration);
                }
            }, index * delay);
        });

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при послідовній анімації', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Додавання плавної анімації зміни значення числа
 * @param {HTMLElement} element - Елемент для анімації
 * @param {number} startValue - Початкове значення
 * @param {number} endValue - Кінцеве значення
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function animateNumber(element, startValue, endValue, options = {}) {
    if (!element) return false;

    try {
        const {
            duration = 1000,
            easing = 'linear',
            formatter = null,
            delay = 0,
            onUpdate = null,
            onComplete = null
        } = options;

        // Функція для форматування чисел
        const format = typeof formatter === 'function'
            ? formatter
            : (num) => num.toFixed(0);

        const startTime = Date.now() + delay;
        const change = endValue - startValue;

        // Функції для різних типів анімацій
        const easingFunctions = {
            linear: t => t,
            easeInQuad: t => t * t,
            easeOutQuad: t => t * (2 - t),
            easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        };

        const easingFunction = easingFunctions[easing] || easingFunctions.linear;

        // Функція анімації
        const animate = () => {
            const now = Date.now();

            // Ще не почали
            if (now < startTime) {
                requestAnimationFrame(animate);
                return;
            }

            const elapsedTime = now - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const easedProgress = easingFunction(progress);
            const currentValue = startValue + change * easedProgress;

            // Оновлюємо вміст елемента
            element.textContent = format(currentValue);

            // Викликаємо callback оновлення
            if (typeof onUpdate === 'function') {
                onUpdate(currentValue, progress);
            }

            // Продовжуємо анімацію або завершуємо
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (typeof onComplete === 'function') {
                    onComplete(endValue);
                }
            }
        };

        // Запускаємо анімацію
        requestAnimationFrame(animate);

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при анімації числа', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація заміни тексту з ефектом
 * @param {HTMLElement} element - Елемент для анімації
 * @param {string} newText - Новий текст
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function animateTextChange(element, newText, options = {}) {
    if (!element) return false;

    try {
        const {
            duration = 400,
            fadeOutDuration = duration / 2,
            fadeInDuration = duration / 2,
            onComplete = null
        } = options;

        // Зберігаємо початкові стилі
        const originalTransition = element.style.transition;

        // Налаштовуємо анімацію зникнення
        element.style.transition = `opacity ${fadeOutDuration}ms ease`;
        element.style.opacity = '0';

        // Після зникнення, змінюємо текст
        setTimeout(() => {
            element.textContent = newText;

            // Налаштовуємо анімацію появи
            element.style.transition = `opacity ${fadeInDuration}ms ease`;
            element.style.opacity = '1';

            // Після завершення анімації
            setTimeout(() => {
                // Відновлюємо оригінальний transition
                element.style.transition = originalTransition;

                // Викликаємо callback, якщо є
                if (typeof onComplete === 'function') {
                    onComplete(element);
                }
            }, fadeInDuration);
        }, fadeOutDuration);

        return true;
    } catch (error) {
        logger.error(error, 'Помилка при анімації зміни тексту', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

// Публічний API
const transitions = {
    highlightElement,
    pulseElement,
    createRippleEffect,
    fadeIn,
    fadeOut,
    animateSequence,
    animateNumber,
    animateTextChange
};

export default transitions;