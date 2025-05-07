/**
 * Точка входу для DOM утилітів
 *
 * Експортує всі функції модулів core, events та animation
 * для зручного імпорту.
 *
 * @version 1.0.0
 */

import * as domCore from './core.js';
import * as domEvents from './events.js';
import * as domAnimation from './animation.js';

// Експорт функцій з core
export const {
  createFromHTML,
  escapeHTML,
  getElementPosition,
  scrollToElement,
  isElementInViewport,
  loadImage,
  addClass,
  removeClass,
  hasClass,
  toggleClass,
  findParent,
  createElement
} = domCore;

// Експорт функцій з events
export const {
  addEvent,
  removeEvent,
  removeAllEvents,
  delegateEvent,
  removeDelegatedEvent,
  onDOMReady,
  debounce,
  throttle,
  triggerEvent
} = domEvents;

// Експорт функцій з animation
export const {
  fadeIn,
  fadeOut,
  slideDown,
  slideUp,
  animate,
  addKeyframes,
  stopAnimations,
  transition
} = domAnimation;

// Експорт функцій очищення з усіх модулів
export const cleanup = () => {
  domEvents.cleanup();
  domAnimation.cleanup();
};

// Експорт за замовчуванням
export default {
  // Core
  ...domCore,

  // Events
  ...domEvents,

  // Animation
  ...domAnimation,

  // Допоміжний метод для ін'єкції стилів
  injectStyles: (id, css, options = {}) => {
    try {
      // Перевіряємо, чи стилі з таким ID вже існують
      let styleElement = document.getElementById(id);

      // Параметри за замовчуванням
      const {
        overwrite = false,  // Перезаписати існуючі стилі
        append = false,     // Додавати в кінець, а не на початок
        media = ''          // Медіа-запит
      } = options;

      // Якщо елемент існує
      if (styleElement) {
        // Перезаписуємо стилі, якщо потрібно
        if (overwrite) {
          styleElement.textContent = css;
        } else if (append) {
          // Додаємо нові стилі в кінець
          styleElement.textContent += '\n' + css;
        }
      } else {
        // Створюємо новий елемент стилів
        styleElement = document.createElement('style');
        styleElement.id = id;
        styleElement.textContent = css;

        // Додаємо медіа-запит, якщо вказано
        if (media) {
          styleElement.media = media;
        }

        // Додаємо стилі в документ
        document.head.appendChild(styleElement);
      }

      return styleElement;
    } catch (error) {
      console.error('Помилка при ін\'єкції стилів:', error);
      return null;
    }
  },

  // Видалення стилів з ID
  removeStyles: (id) => {
    const styleElement = document.getElementById(id);
    if (styleElement) {
      styleElement.remove();
      return true;
    }
    return false;
  }
};