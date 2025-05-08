/**
 * DOM Core - базові утиліти для роботи з DOM
 *
 * Відповідає за:
 * - Маніпуляції з DOM-елементами
 * - Створення елементів з HTML
 * - Отримання позиції елементів
 *
 * @version 1.0.0
 */

import { getLogger } from '../core/index.js';

// Створюємо логер для модуля
const logger = getLogger('DOMCore');

/**
 * Безпечне створення HTML з рядка
 * @param {string} html - HTML рядок
 * @param {boolean} [asFragment=false] - Повернути як DocumentFragment
 * @returns {HTMLElement|DocumentFragment} Створений елемент або фрагмент
 */
export function createFromHTML(html, asFragment = false) {
  // Створюємо тимчасовий контейнер
  const container = document.createElement('div');
  container.innerHTML = html.trim();

  // Якщо потрібен фрагмент
  if (asFragment) {
    const fragment = document.createDocumentFragment();

    // Переносимо елементи в фрагмент
    while (container.firstChild) {
      fragment.appendChild(container.firstChild);
    }

    return fragment;
  }

  // Якщо один елемент, повертаємо його
  if (container.childNodes.length === 1) {
    return container.firstChild;
  }

  // Інакше повертаємо сам контейнер
  return container;
}

/**
 * Функція для безпечного виведення HTML
 * @param {string} text - Текст для обробки
 * @returns {string} Безпечний HTML
 */
export function escapeHTML(text) {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Отримання координат елемента відносно документа
 * @param {HTMLElement} element - Елемент
 * @returns {Object} Координати у форматі {top, left, right, bottom, width, height}
 */
export function getElementPosition(element) {
  const rect = element.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
    right: rect.right + scrollLeft,
    bottom: rect.bottom + scrollTop,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Прокрутка сторінки до елемента
 * @param {HTMLElement|string} element - Елемент або селектор
 * @param {Object} options - Опції прокрутки
 * @returns {boolean} Успішність операції
 */
export function scrollToElement(element, options = {}) {
  try {
    // Знаходимо елемент
    let targetElement = element;

    if (typeof element === 'string') {
      targetElement = document.querySelector(element);
    }

    if (!targetElement) {
      logger.warn('Елемент для прокрутки не знайдено', 'scrollToElement');
      return false;
    }

    // Параметри за замовчуванням
    const {
      behavior = 'smooth', // Поведінка прокрутки
      block = 'start', // Вертикальне вирівнювання
      inline = 'nearest', // Горизонтальне вирівнювання
      offset = 0, // Додатковий відступ зверху
    } = options;

    // Прокрутка з урахуванням відступу
    const scrollOptions = { behavior, block, inline };

    // Якщо є відступ, використовуємо власну реалізацію
    if (offset !== 0) {
      const rect = targetElement.getBoundingClientRect();
      const targetTop = window.pageYOffset + rect.top - offset;

      window.scrollTo({
        top: targetTop,
        behavior,
      });
    } else {
      // Використовуємо стандартний метод
      targetElement.scrollIntoView(scrollOptions);
    }

    logger.debug('Прокрутка до елемента виконана', 'scrollToElement');
    return true;
  } catch (error) {
    logger.error('Помилка прокрутки до елемента', 'scrollToElement', { error });
    return false;
  }
}

/**
 * Перевірка, чи елемент видимий у вьюпорті
 * @param {HTMLElement} element - Елемент для перевірки
 * @param {Object} options - Опції перевірки
 * @returns {boolean} Чи видимий елемент
 */
export function isElementInViewport(element, options = {}) {
  try {
    const {
      fullyVisible = false, // Чи має елемент бути повністю видимим
      margin = 0, // Відступ від меж вьюпорта
    } = options;

    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    // Перевіряємо, чи елемент повністю видимий
    if (fullyVisible) {
      return (
        rect.top >= margin &&
        rect.left >= margin &&
        rect.bottom <= windowHeight - margin &&
        rect.right <= windowWidth - margin
      );
    }

    // Перевіряємо, чи елемент хоча б частково видимий
    const vertInView = rect.top <= windowHeight - margin && rect.top + rect.height >= margin;
    const horizInView = rect.left <= windowWidth - margin && rect.left + rect.width >= margin;

    return vertInView && horizInView;
  } catch (error) {
    logger.error('Помилка перевірки видимості елемента', 'isElementInViewport', { error });
    return false;
  }
}

/**
 * Завантаження зображення з попередньою обробкою
 * @param {string} src - URL зображення
 * @returns {Promise<HTMLImageElement>} Проміс з завантаженим зображенням
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      logger.error('Помилка завантаження зображення', 'loadImage', { src, error: err });
      reject(err);
    };
    img.src = src;
  });
}

/**
 * Додавання класів до елемента
 * @param {HTMLElement} element - Елемент
 * @param {...string} classNames - Імена класів
 * @returns {HTMLElement} Той самий елемент
 */
export function addClass(element, ...classNames) {
  if (!element || !element.classList) return element;

  classNames.forEach((className) => {
    if (className && typeof className === 'string') {
      element.classList.add(...className.split(' ').filter((c) => c.trim()));
    }
  });

  return element;
}

/**
 * Видалення класів з елемента
 * @param {HTMLElement} element - Елемент
 * @param {...string} classNames - Імена класів
 * @returns {HTMLElement} Той самий елемент
 */
export function removeClass(element, ...classNames) {
  if (!element || !element.classList) return element;

  classNames.forEach((className) => {
    if (className && typeof className === 'string') {
      element.classList.remove(...className.split(' ').filter((c) => c.trim()));
    }
  });

  return element;
}

/**
 * Перевірка наявності класу у елемента
 * @param {HTMLElement} element - Елемент
 * @param {string} className - Ім'я класу
 * @returns {boolean} Чи має елемент вказаний клас
 */
export function hasClass(element, className) {
  if (!element || !element.classList || !className) return false;
  return element.classList.contains(className);
}

/**
 * Перемикання класу елемента
 * @param {HTMLElement} element - Елемент
 * @param {string} className - Ім'я класу
 * @param {boolean} [force] - Примусово додати або видалити
 * @returns {boolean} Має елемент клас після операції чи ні
 */
export function toggleClass(element, className, force) {
  if (!element || !element.classList || !className) return false;

  if (force !== undefined) {
    if (force) {
      element.classList.add(className);
      return true;
    } else {
      element.classList.remove(className);
      return false;
    }
  }

  return element.classList.toggle(className);
}

/**
 * Знаходження батьківського елемента за селектором
 * @param {HTMLElement} element - Початковий елемент
 * @param {string} selector - CSS-селектор
 * @returns {HTMLElement|null} Знайдений батьківський елемент або null
 */
export function findParent(element, selector) {
  try {
    if (!element || !selector) return null;

    let parent = element.parentElement;

    while (parent) {
      if (parent.matches(selector)) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  } catch (error) {
    logger.error('Помилка пошуку батьківського елемента', 'findParent', { selector, error });
    return null;
  }
}

/**
 * Створення елемента з атрибутами
 * @param {string} tag - Тег елемента
 * @param {Object} [attrs={}] - Об'єкт з атрибутами
 * @param {string|Node|Array} [content] - Вміст елемента
 * @returns {HTMLElement} Створений елемент
 */
export function createElement(tag, attrs = {}, content) {
  try {
    const element = document.createElement(tag);

    // Додаємо атрибути
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        // Для стилів у вигляді об'єкта
        Object.entries(value).forEach(([prop, val]) => {
          element.style[prop] = val;
        });
      } else if (key === 'class' || key === 'className') {
        // Для класів
        addClass(element, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Для подій
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else {
        // Для інших атрибутів
        element.setAttribute(key, value);
      }
    });

    // Додаємо вміст
    if (content) {
      if (Array.isArray(content)) {
        content.forEach((item) => {
          if (typeof item === 'string') {
            element.appendChild(document.createTextNode(item));
          } else if (item instanceof Node) {
            element.appendChild(item);
          }
        });
      } else if (typeof content === 'string') {
        element.textContent = content;
      } else if (content instanceof Node) {
        element.appendChild(content);
      }
    }

    return element;
  } catch (error) {
    logger.error('Помилка створення елемента', 'createElement', { tag, error });
    return document.createElement(tag);
  }
}

export default {
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
  createElement,
};
