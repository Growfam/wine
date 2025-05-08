/**
 * DOM Events - утиліти для роботи з подіями
 *
 * Відповідає за:
 * - Додавання та видалення обробників подій
 * - Делегування подій
 * - Обмеження частоти викликів (debounce, throttle)
 *
 * @version 1.0.0
 */

import { getLogger } from '../core/index.js';

// Створюємо логер для модуля
const logger = getLogger('DOMEvents');

// Колекція обробників подій
const eventHandlers = new Map();

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
    debounce = 0, // Час затримки в мс
    throttle = 0, // Час обмеження в мс
    once = false, // Одноразовий обробник
    passive = false, // Пасивний обробник
    capture = false, // Фаза перехоплення
  } = options;

  try {
    let finalHandler = handler;
    let timeoutId;
    let lastExecTime = 0;

    // Застосовуємо debounce, якщо потрібно
    if (debounce > 0) {
      finalHandler = function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          handler.apply(this, args);
        }, debounce);
      };
    }
    // Застосовуємо throttle, якщо потрібно
    else if (throttle > 0) {
      finalHandler = function (...args) {
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
      options: { once, passive, capture },
    });

    // Додаємо обробник до елемента
    element.addEventListener(eventType, finalHandler, {
      once,
      passive,
      capture,
    });

    logger.debug(`Додано обробник події ${eventType}`, 'addEvent');

    // Повертаємо функцію для видалення обробника
    return function removeHandler() {
      return removeEvent(element, eventType, handler);
    };
  } catch (error) {
    logger.error('Помилка додавання обробника події', 'addEvent', {
      eventType,
      error: error.message,
    });
    return () => false;
  }
}

/**
 * Видалення обробника події
 * @param {HTMLElement} element - Елемент
 * @param {string} eventType - Тип події
 * @param {Function} handler - Функція-обробник
 * @returns {boolean} Успішність видалення
 */
export function removeEvent(element, eventType, handler) {
  try {
    if (
      eventHandlers.has(element) &&
      eventHandlers.get(element).has(eventType) &&
      eventHandlers.get(element).get(eventType).has(handler)
    ) {
      // Отримуємо фінальний обробник
      const { finalHandler, options } = eventHandlers.get(element).get(eventType).get(handler);

      // Видаляємо обробник з елемента
      element.removeEventListener(eventType, finalHandler, {
        capture: options.capture,
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

      logger.debug(`Видалено обробник події ${eventType}`, 'removeEvent');
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Помилка видалення обробника події', 'removeEvent', {
      eventType,
      error: error.message,
    });
    return false;
  }
}

/**
 * Видалення всіх обробників подій для елемента
 * @param {HTMLElement} element - Елемент для очищення
 * @param {string} [eventType] - Опціональний тип події для видалення
 * @returns {boolean} Успішність видалення
 */
export function removeAllEvents(element, eventType = null) {
  try {
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
          capture: options.capture,
        });
      });

      // Очищаємо колекцію
      elementHandlers.delete(eventType);

      // Якщо обробників не залишилось, видаляємо елемент з колекції
      if (elementHandlers.size === 0) {
        eventHandlers.delete(element);
      }

      logger.debug(`Видалено всі обробники події ${eventType}`, 'removeAllEvents');
      return true;
    }

    // Видаляємо всі обробники для елемента
    elementHandlers.forEach((typeHandlers, type) => {
      typeHandlers.forEach(({ finalHandler, options }) => {
        element.removeEventListener(type, finalHandler, {
          capture: options.capture,
        });
      });
    });

    // Видаляємо елемент з колекції
    eventHandlers.delete(element);

    logger.debug('Видалено всі обробники подій для елемента', 'removeAllEvents');
    return true;
  } catch (error) {
    logger.error('Помилка видалення всіх обробників', 'removeAllEvents', {
      eventType,
      error: error.message,
    });
    return false;
  }
}

/**
 * Делегування подій
 * @param {HTMLElement} element - Елемент-контейнер
 * @param {string} eventType - Тип події
 * @param {string} selector - CSS-селектор для цільових елементів
 * @param {Function} handler - Функція-обробник
 * @param {Object} options - Додаткові опції
 * @returns {Function} Функція для видалення обробника
 */
export function delegateEvent(element, eventType, selector, handler, options = {}) {
  try {
    // Створюємо обробник делегування
    const delegateHandler = function (event) {
      // Знаходимо цільовий елемент
      const target = event.target.closest(selector);

      // Якщо цільовий елемент знайдено і він є нащадком елемента-контейнера
      if (target && element.contains(target)) {
        // Викликаємо обробник з правильним контекстом
        handler.call(target, event, target);
      }
    };

    // Зберігаємо зв'язок між оригінальним обробником і делегованим
    if (!element._delegateHandlers) {
      element._delegateHandlers = new Map();
    }

    if (!element._delegateHandlers.has(eventType)) {
      element._delegateHandlers.set(eventType, new Map());
    }

    element._delegateHandlers.get(eventType).set(handler, {
      selector,
      delegateHandler,
    });

    // Додаємо делегований обробник
    return addEvent(element, eventType, delegateHandler, options);
  } catch (error) {
    logger.error('Помилка делегування події', 'delegateEvent', {
      eventType,
      selector,
      error: error.message,
    });
    return () => false;
  }
}

/**
 * Видалення делегованого обробника події
 * @param {HTMLElement} element - Елемент-контейнер
 * @param {string} eventType - Тип події
 * @param {Function} handler - Оригінальний обробник
 * @returns {boolean} Успішність видалення
 */
export function removeDelegatedEvent(element, eventType, handler) {
  try {
    if (
      element._delegateHandlers &&
      element._delegateHandlers.has(eventType) &&
      element._delegateHandlers.get(eventType).has(handler)
    ) {
      // Отримуємо делегований обробник
      const { delegateHandler } = element._delegateHandlers.get(eventType).get(handler);

      // Видаляємо обробник
      const success = removeEvent(element, eventType, delegateHandler);

      // Видаляємо з колекції
      element._delegateHandlers.get(eventType).delete(handler);

      // Очищаємо колекцію, якщо вона порожня
      if (element._delegateHandlers.get(eventType).size === 0) {
        element._delegateHandlers.delete(eventType);
        if (element._delegateHandlers.size === 0) {
          delete element._delegateHandlers;
        }
      }

      return success;
    }

    return false;
  } catch (error) {
    logger.error('Помилка видалення делегованого обробника', 'removeDelegatedEvent', {
      eventType,
      error: error.message,
    });
    return false;
  }
}

/**
 * Запуск функції після повної завантаження DOM
 * @param {Function} callback - Функція для виконання
 * @param {Object} options - Додаткові опції
 */
export function onDOMReady(callback, options = {}) {
  // Параметри за замовчуванням
  const {
    timeout = 5000, // Час очікування в мс
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
 * Відкладене виконання функції (debounce)
 * @param {Function} func - Функція для виконання
 * @param {number} wait - Час затримки в мс
 * @param {Object} options - Додаткові опції
 * @returns {Function} Функція з затримкою
 */
export function debounce(func, wait, options = {}) {
  const { leading = false, trailing = true } = options;

  let timeout;
  let lastArgs;
  let lastThis;
  let result;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  function invokeFunc(time) {
    lastInvokeTime = time;
    result = func.apply(lastThis, lastArgs);
    lastThis = lastArgs = null;
    return result;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeout = setTimeout(timeExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function timeExpired() {
    const time = Date.now();
    if (trailing) {
      return invokeFunc(time);
    }
    lastThis = lastArgs = null;
    return result;
  }

  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastInvokeTime = 0;
    lastThis = lastArgs = timeout = null;
  }

  function flush() {
    return timeout === undefined ? result : timeExpired();
  }

  function debounced(...args) {
    const time = Date.now();
    lastThis = this;
    lastArgs = args;
    lastCallTime = time;

    if (timeout === undefined) {
      return leadingEdge(lastCallTime);
    }

    if (trailing) {
      clearTimeout(timeout);
      timeout = setTimeout(timeExpired, wait);
    }

    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * Обмеження частоти викликів функції (throttle)
 * @param {Function} func - Функція для виконання
 * @param {number} limit - Мінімальний інтервал між викликами в мс
 * @param {Object} options - Додаткові опції
 * @returns {Function} Функція з обмеженням
 */
export function throttle(func, limit, options = {}) {
  const { leading = true, trailing = true } = options;

  let timeout;
  let result;
  let lastArgs;
  let lastThis;
  let lastCallTime = 0;

  function invokeFunc() {
    lastCallTime = Date.now();
    result = func.apply(lastThis, lastArgs);
    lastThis = lastArgs = null;
    return result;
  }

  function trailingEdge() {
    timeout = undefined;
    if (trailing && lastArgs) {
      return invokeFunc();
    }
    lastThis = lastArgs = null;
    return result;
  }

  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastCallTime = 0;
    lastThis = lastArgs = timeout = null;
  }

  function throttled(...args) {
    const time = Date.now();
    const shouldInvoke = lastCallTime === 0 || time - lastCallTime >= limit;

    lastThis = this;
    lastArgs = args;

    if (shouldInvoke) {
      if (timeout === undefined) {
        lastCallTime = time;
        if (leading) {
          return invokeFunc();
        }
      }
    }

    if (timeout === undefined && trailing) {
      timeout = setTimeout(trailingEdge, limit);
    }

    return result;
  }

  throttled.cancel = cancel;
  return throttled;
}

/**
 * Створення та запуск події
 * @param {HTMLElement} element - Елемент для ініціювання події
 * @param {string} eventName - Назва події
 * @param {Object} detail - Деталі події
 * @param {Object} options - Опції події
 * @returns {boolean} Успішність ініціювання події
 */
export function triggerEvent(element, eventName, detail = {}, options = {}) {
  try {
    const { bubbles = true, cancelable = true, composed = false } = options;

    const event = new CustomEvent(eventName, {
      bubbles,
      cancelable,
      composed,
      detail,
    });

    return element.dispatchEvent(event);
  } catch (error) {
    logger.error('Помилка ініціювання події', 'triggerEvent', {
      eventName,
      error: error.message,
    });
    return false;
  }
}

/**
 * Очищення всіх обробників подій
 */
export function cleanup() {
  try {
    // Копіюємо ключі для ітерації, щоб уникнути помилок при модифікації під час ітерації
    const elements = [...eventHandlers.keys()];

    elements.forEach((element) => {
      removeAllEvents(element);
    });

    eventHandlers.clear();
    logger.info('Всі обробники подій очищено', 'cleanup');
  } catch (error) {
    logger.error('Помилка очищення обробників подій', 'cleanup', {
      error: error.message,
    });
  }
}

// Автоматичне очищення при виході зі сторінки
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanup);
}

export default {
  addEvent,
  removeEvent,
  removeAllEvents,
  delegateEvent,
  removeDelegatedEvent,
  onDOMReady,
  debounce,
  throttle,
  triggerEvent,
  cleanup,
};
