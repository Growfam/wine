/**
 * DOMUtils - оптимізований модуль для роботи з DOM
 * Відповідає за:
 * - Ін'єкцію стилів
 * - Спостереження за змінами DOM
 * - Обробку подій
 * - Маніпуляції з DOM-елементами
 *
 * @version 3.0.0
 */

// Колекція обробників подій
const eventHandlers = new Map();

// Колекція MutationObserver
const observers = new Map();

// Колекція для управління стилями
const injectedStyles = new Map();

// Стан модуля
const state = {
  timers: {}  // Кеш активних таймерів
};

/**
 * Ін'єкція CSS стилів у документ
 * @param {string} id - Унікальний ідентифікатор стилів
 * @param {string} css - CSS стилі для додавання
 * @param {Object} options - Додаткові опції
 * @returns {HTMLStyleElement} Елемент стилів
 */
export function injectStyles(id, css, options = {}) {
  // Якщо стилі з таким ID вже існують, повертаємо їх
  if (injectedStyles.has(id)) {
    return injectedStyles.get(id);
  }

  // Параметри за замовчуванням
  const {
    overwrite = false,  // Перезаписати існуючі стилі
    append = false,     // Додавати в кінець, а не на початок
    media = ''          // Медіа-запит
  } = options;

  // Перевіряємо, чи існує елемент з вказаним ID
  let styleElement = document.getElementById(id);

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

  // Зберігаємо елемент стилів для подальшого використання
  injectedStyles.set(id, styleElement);

  return styleElement;
}

/**
 * Видалення стилів з документа
 * @param {string} id - ID стилів для видалення
 * @returns {boolean} Успішність видалення
 */
export function removeStyles(id) {
  // Перевіряємо, чи є стилі з вказаним ID
  if (!injectedStyles.has(id)) {
    const element = document.getElementById(id);
    if (element) {
      element.remove();
      return true;
    }
    return false;
  }

  // Отримуємо елемент стилів
  const styleElement = injectedStyles.get(id);

  // Видаляємо елемент з документа
  if (styleElement && styleElement.parentNode) {
    styleElement.parentNode.removeChild(styleElement);
  }

  // Видаляємо з колекції
  injectedStyles.delete(id);

  return true;
}

/**
 * Додавання обробника події з можливістю відкладеного виконання
 * @param {HTMLElement} element - Елемент для додавання обробника
 * @param {string} eventType - Тип події
 * @param {Function} handler - Функція-обробник
 * @param {Object} options - Додаткові опції
 * @returns {Function} Функція для видалення обробника
 */
export function addEvent(element, eventType, handler, options = {}) {
  // Параметри за замовчуванням
  const {
    debounce = 0,      // Час затримки в мс
    throttle = 0,      // Час обмеження в мс
    once = false,      // Одноразовий обробник
    passive = false,   // Пасивний обробник
    capture = false    // Фаза перехоплення
  } = options;

  let finalHandler = handler;
  let timeoutId;
  let lastExecTime = 0;

  // Застосовуємо debounce, якщо потрібно
  if (debounce > 0) {
    finalHandler = function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handler.apply(this, args);
      }, debounce);
    };
  }
  // Застосовуємо throttle, якщо потрібно
  else if (throttle > 0) {
    finalHandler = function(...args) {
      const now = Date.now();
      if (now - lastExecTime >= throttle) {
        lastExecTime = now;
        handler.apply(this, args);
      }
    };
  }

  // Зберігаємо обробник для подальшого очищення
  if (!eventHandlers.has(element)) {
    eventHandlers.set(element, new Map());
  }

  // Зберігаємо оригінальний обробник та фінальний обробник
  const elementHandlers = eventHandlers.get(element);
  if (!elementHandlers.has(eventType)) {
    elementHandlers.set(eventType, new Map());
  }

  const typeHandlers = elementHandlers.get(eventType);
  typeHandlers.set(handler, {
    finalHandler,
    options: { once, passive, capture }
  });

  // Додаємо обробник до елемента
  element.addEventListener(eventType, finalHandler, {
    once,
    passive,
    capture
  });

  // Повертаємо функцію для видалення обробника
  return function removeHandler() {
    if (eventHandlers.has(element) &&
        eventHandlers.get(element).has(eventType) &&
        eventHandlers.get(element).get(eventType).has(handler)) {

      // Отримуємо фінальний обробник
      const { finalHandler, options } = eventHandlers.get(element).get(eventType).get(handler);

      // Видаляємо обробник з елемента
      element.removeEventListener(eventType, finalHandler, {
        capture: options.capture
      });

      // Видаляємо з колекції
      eventHandlers.get(element).get(eventType).delete(handler);

      // Якщо обробників для цього типу подій не залишилось
      if (eventHandlers.get(element).get(eventType).size === 0) {
        eventHandlers.get(element).delete(eventType);

        // Якщо обробників для цього елемента не залишилось
        if (eventHandlers.get(element).size === 0) {
          eventHandlers.delete(element);
        }
      }

      // Очищаємо таймер, якщо є
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return true;
    }

    return false;
  };
}

/**
 * Відкладене виконання функції (утиліта)
 * @param {Function} func - Функція для виконання
 * @param {number} wait - Час затримки в мс
 * @returns {Function} Функція з затримкою
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
 * Обмеження частоти викликів функції
 * @param {Function} func - Функція для виконання
 * @param {number} limit - Мінімальний інтервал між викликами
 * @returns {Function} Функція з обмеженням
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const context = this, args = arguments;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Видалення всіх обробників подій для елемента
 * @param {HTMLElement} element - Елемент для очищення
 * @param {string} [eventType] - Опціональний тип події для видалення
 * @returns {boolean} Успішність видалення
 */
export function removeAllEvents(element, eventType = null) {
  if (!eventHandlers.has(element)) {
    return false;
  }

  const elementHandlers = eventHandlers.get(element);

  // Якщо вказано конкретний тип події
  if (eventType !== null) {
    if (!elementHandlers.has(eventType)) {
      return false;
    }

    // Видаляємо всі обробники цього типу
    const typeHandlers = elementHandlers.get(eventType);
    typeHandlers.forEach(({ finalHandler, options }, originalHandler) => {
      element.removeEventListener(eventType, finalHandler, {
        capture: options.capture
      });
    });

    // Очищаємо колекцію
    elementHandlers.delete(eventType);

    // Якщо обробників не залишилось, видаляємо елемент з колекції
    if (elementHandlers.size === 0) {
      eventHandlers.delete(element);
    }

    return true;
  }

  // Видаляємо всі обробники для елемента
  elementHandlers.forEach((typeHandlers, type) => {
    typeHandlers.forEach(({ finalHandler, options }) => {
      element.removeEventListener(type, finalHandler, {
        capture: options.capture
      });
    });
  });

  // Видаляємо елемент з колекції
  eventHandlers.delete(element);

  return true;
}

/**
 * Запуск функції після повної завантаження DOM
 * @param {Function} callback - Функція для виконання
 * @param {Object} options - Додаткові опції
 */
export function onDOMReady(callback, options = {}) {
  // Параметри за замовчуванням
  const {
    timeout = 5000  // Час очікування в мс
  } = options;

  // Якщо DOM вже завантажений
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(callback, 1);
    return;
  }

  // Таймер для обмеження часу очікування
  let timeoutId = null;

  // Функція для виконання
  const readyHandler = () => {
    // Очищаємо таймер
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Видаляємо обробники
    document.removeEventListener('DOMContentLoaded', readyHandler);
    window.removeEventListener('load', readyHandler);

    // Викликаємо колбек
    callback();
  };

  // Додаємо обробники подій
  document.addEventListener('DOMContentLoaded', readyHandler);
  window.addEventListener('load', readyHandler);

  // Додаємо таймер для обмеження часу очікування
  if (timeout > 0) {
    timeoutId = setTimeout(readyHandler, timeout);
  }
}

/**
 * Спостереження за змінами в DOM
 * @param {HTMLElement} target - Елемент для спостереження
 * @param {Function} callback - Функція-обробник
 * @param {Object} options - Опції спостереження
 * @returns {MutationObserver|null} Об'єкт спостерігача
 */
export function observeDOM(target, callback, options = {}) {
  // Перевіряємо підтримку MutationObserver
  if (!window.MutationObserver) {
    console.warn('DOMUtils: MutationObserver не підтримується браузером');
    return null;
  }

  // Параметри за замовчуванням
  const defaultOptions = {
    childList: true,        // Спостерігати за змінами у складі дочірніх елементів
    subtree: true,          // Спостерігати за змінами у всьому піддереві
    attributes: false,      // Не спостерігати за змінами атрибутів
    characterData: false,   // Не спостерігати за змінами тексту
    attributeOldValue: false,   // Не зберігати попереднє значення атрибутів
    characterDataOldValue: false  // Не зберігати попереднє значення тексту
  };

  // Об'єднуємо опції
  const observerOptions = { ...defaultOptions, ...options };

  // Створюємо спостерігача
  const observer = new MutationObserver((mutations, observer) => {
    callback(mutations, observer);
  });

  // Починаємо спостереження
  observer.observe(target, observerOptions);

  // Зберігаємо спостерігача для подальшого очищення
  if (!observers.has(target)) {
    observers.set(target, new Set());
  }
  observers.get(target).add(observer);

  return observer;
}

/**
 * Припинення спостереження за змінами в DOM
 * @param {HTMLElement} target - Елемент для припинення спостереження
 * @param {MutationObserver} [observer] - Конкретний спостерігач для видалення
 * @returns {boolean} Успішність операції
 */
export function unobserveDOM(target, observer = null) {
  if (!observers.has(target)) {
    return false;
  }

  const targetObservers = observers.get(target);

  // Якщо вказано конкретний спостерігач
  if (observer !== null) {
    if (!targetObservers.has(observer)) {
      return false;
    }

    // Припиняємо спостереження
    observer.disconnect();
    targetObservers.delete(observer);

    // Якщо спостерігачів не залишилось, видаляємо елемент з колекції
    if (targetObservers.size === 0) {
      observers.delete(target);
    }

    return true;
  }

  // Припиняємо всі спостереження для елемента
  targetObservers.forEach(obs => {
    obs.disconnect();
  });

  // Видаляємо елемент з колекції
  observers.delete(target);

  return true;
}

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
 * Прокрутка сторінки до елемента
 * @param {HTMLElement|string} element - Елемент або селектор
 * @param {Object} options - Опції прокрутки
 * @returns {boolean} Успішність операції
 */
export function scrollToElement(element, options = {}) {
  // Знаходимо елемент
  let targetElement = element;

  if (typeof element === 'string') {
    targetElement = document.querySelector(element);
  }

  if (!targetElement) {
    console.warn('DOMUtils: Елемент для прокрутки не знайдено');
    return false;
  }

  // Параметри за замовчуванням
  const {
    behavior = 'smooth',  // Поведінка прокрутки
    block = 'start',      // Вертикальне вирівнювання
    inline = 'nearest',   // Горизонтальне вирівнювання
    offset = 0            // Додатковий відступ зверху
  } = options;

  // Прокрутка з урахуванням відступу
  const scrollOptions = { behavior, block, inline };

  // Якщо є відступ, використовуємо власну реалізацію
  if (offset !== 0) {
    const rect = targetElement.getBoundingClientRect();
    const targetTop = window.pageYOffset + rect.top - offset;

    window.scrollTo({
      top: targetTop,
      behavior
    });
  } else {
    // Використовуємо стандартний метод
    targetElement.scrollIntoView(scrollOptions);
  }

  return true;
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
    height: rect.height
  };
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
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
  // Видаляємо всі обробники подій
  eventHandlers.forEach((elementHandlers, element) => {
    removeAllEvents(element);
  });
  eventHandlers.clear();

  // Припиняємо всі спостереження
  observers.forEach((targetObservers, target) => {
    unobserveDOM(target);
  });
  observers.clear();

  // Очищаємо таймери
  Object.keys(state.timers).forEach(id => {
    clearTimeout(state.timers[id]);
    delete state.timers[id];
  });

  console.log('DOMUtils: Ресурси модуля очищено');
}

// Автоматичне очищення при виході зі сторінки
window.addEventListener('beforeunload', cleanup);

export default {
  injectStyles,
  removeStyles,
  addEvent,
  removeAllEvents,
  onDOMReady,
  observeDOM,
  unobserveDOM,
  createFromHTML,
  escapeHTML,
  scrollToElement,
  getElementPosition,
  loadImage,
  debounce,
  throttle,
  cleanup
};