/**
 * DOM Animation - утиліти для анімацій та візуальних ефектів
 *
 * Відповідає за:
 * - Анімації DOM елементів
 * - Переходи між станами
 * - Прості ефекти з'явлення/зникнення
 *
 * @version 1.0.0
 */

import { getLogger } from '//core/logger.js';
import { addEvent } from './events.js';

// Створюємо логер для модуля
const logger = getLogger('DOMAnimation');

// Колекція активних анімацій
const activeAnimations = new Map();

// Лічильник ID для анімацій
let animationIdCounter = 0;

/**
 * Плавна поява елемента (fade in)
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function fadeIn(element, options = {}) {
  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300,        // Тривалість анімації в мс
    easing = 'ease',       // Функція пом'якшення
    display = 'block',     // Стиль відображення елемента
    onStart = null,        // Колбек початку анімації
    onComplete = null      // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Зберігаємо початковий стиль
      const originalDisplay = element.style.display;
      const originalOpacity = element.style.opacity;
      const originalVisibility = element.style.visibility;

      // Встановлюємо початковий стан
      element.style.opacity = '0';
      element.style.display = display;
      element.style.visibility = 'visible';

      // Даємо браузеру час для відображення елемента з opacity=0
      requestAnimationFrame(() => {
        // Додаємо перехід
        element.style.transition = `opacity ${duration}ms ${easing}`;

        // Викликаємо колбек початку
        if (typeof onStart === 'function') {
          onStart(element);
        }

        // Запускаємо анімацію
        requestAnimationFrame(() => {
          element.style.opacity = '1';
        });

        // Обробник завершення переходу
        const transitionEndHandler = (event) => {
          if (event.target === element && event.propertyName === 'opacity') {
            // Очищаємо слухач події
            element.removeEventListener('transitionend', transitionEndHandler);

            // Викликаємо колбек завершення
            if (typeof onComplete === 'function') {
              onComplete(element);
            }

            // Прибираємо перехід
            element.style.transition = '';

            // Вирішуємо проміс
            resolve(element);
          }
        };

        // Додаємо слухач події завершення переходу
        element.addEventListener('transitionend', transitionEndHandler);

        // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
        setTimeout(() => {
          if (element.style.opacity === '1') {
            element.removeEventListener('transitionend', transitionEndHandler);
            element.style.transition = '';
            if (typeof onComplete === 'function') {
              onComplete(element);
            }
            resolve(element);
          }
        }, duration + 50);
      });
    } catch (error) {
      logger.error('Помилка при виконанні fadeIn', 'fadeIn', { error });
      reject(error);
    }
  });
}

/**
 * Плавне зникнення елемента (fade out)
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function fadeOut(element, options = {}) {
  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300,        // Тривалість анімації в мс
    easing = 'ease',       // Функція пом'якшення
    hide = true,           // Приховати елемент після анімації
    onStart = null,        // Колбек початку анімації
    onComplete = null      // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Перевіряємо, чи елемент видимий
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        resolve(element);
        return;
      }

      // Зберігаємо початковий стиль
      const originalOpacity = element.style.opacity || '1';

      // Додаємо перехід
      element.style.transition = `opacity ${duration}ms ${easing}`;

      // Викликаємо колбек початку
      if (typeof onStart === 'function') {
        onStart(element);
      }

      // Запускаємо анімацію
      requestAnimationFrame(() => {
        element.style.opacity = '0';
      });

      // Обробник завершення переходу
      const transitionEndHandler = (event) => {
        if (event.target === element && event.propertyName === 'opacity') {
          // Очищаємо слухач події
          element.removeEventListener('transitionend', transitionEndHandler);

          // Приховуємо елемент, якщо потрібно
          if (hide) {
            element.style.display = 'none';
          }

          // Прибираємо перехід
          element.style.transition = '';

          // Викликаємо колбек завершення
          if (typeof onComplete === 'function') {
            onComplete(element);
          }

          // Вирішуємо проміс
          resolve(element);
        }
      };

      // Додаємо слухач події завершення переходу
      element.addEventListener('transitionend', transitionEndHandler);

      // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
      setTimeout(() => {
        if (element.style.opacity === '0') {
          element.removeEventListener('transitionend', transitionEndHandler);
          if (hide) {
            element.style.display = 'none';
          }
          element.style.transition = '';
          if (typeof onComplete === 'function') {
            onComplete(element);
          }
          resolve(element);
        }
      }, duration + 50);
    } catch (error) {
      logger.error('Помилка при виконанні fadeOut', 'fadeOut', { error });
      reject(error);
    }
  });
}

/**
 * Анімація слайдеру вниз (slide down)
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function slideDown(element, options = {}) {
  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300,        // Тривалість анімації в мс
    easing = 'ease',       // Функція пом'якшення
    onStart = null,        // Колбек початку анімації
    onComplete = null      // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Перевіряємо, чи елемент вже видимий
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display !== 'none' && element.style.height !== '0px') {
        resolve(element);
        return;
      }

      // Зберігаємо початковий стиль
      const originalStyle = {
        display: element.style.display,
        height: element.style.height,
        overflow: element.style.overflow
      };

      // Встановлюємо початковий стан
      element.style.display = 'block';
      element.style.overflow = 'hidden';
      element.style.height = '0px';

      // Вираховуємо кінцеву висоту
      const targetHeight = element.scrollHeight;

      // Викликаємо колбек початку
      if (typeof onStart === 'function') {
        onStart(element);
      }

      // Додаємо перехід
      requestAnimationFrame(() => {
        element.style.transition = `height ${duration}ms ${easing}`;

        // Запускаємо анімацію
        requestAnimationFrame(() => {
          element.style.height = `${targetHeight}px`;
        });

        // Обробник завершення переходу
        const transitionEndHandler = (event) => {
          if (event.target === element && event.propertyName === 'height') {
            // Очищаємо слухач події
            element.removeEventListener('transitionend', transitionEndHandler);

            // Відновлюємо стиль
            element.style.transition = '';
            element.style.height = '';
            element.style.overflow = '';

            // Викликаємо колбек завершення
            if (typeof onComplete === 'function') {
              onComplete(element);
            }

            // Вирішуємо проміс
            resolve(element);
          }
        };

        // Додаємо слухач події завершення переходу
        element.addEventListener('transitionend', transitionEndHandler);

        // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
        setTimeout(() => {
          element.removeEventListener('transitionend', transitionEndHandler);
          element.style.transition = '';
          element.style.height = '';
          element.style.overflow = '';
          if (typeof onComplete === 'function') {
            onComplete(element);
          }
          resolve(element);
        }, duration + 50);
      });
    } catch (error) {
      logger.error('Помилка при виконанні slideDown', 'slideDown', { error });
      reject(error);
    }
  });
}

/**
 * Анімація слайдеру вгору (slide up)
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function slideUp(element, options = {}) {
  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300,        // Тривалість анімації в мс
    easing = 'ease',       // Функція пом'якшення
    onStart = null,        // Колбек початку анімації
    onComplete = null      // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Перевіряємо, чи елемент вже прихований
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'none' || element.style.height === '0px') {
        resolve(element);
        return;
      }

      // Зберігаємо початковий стиль
      const originalStyle = {
        height: element.style.height,
        overflow: element.style.overflow
      };

      // Встановлюємо початковий стан
      element.style.height = `${element.scrollHeight}px`;
      element.style.overflow = 'hidden';

      // Викликаємо колбек початку
      if (typeof onStart === 'function') {
        onStart(element);
      }

      // Додаємо перехід
      requestAnimationFrame(() => {
        element.style.transition = `height ${duration}ms ${easing}`;

        // Запускаємо анімацію
        requestAnimationFrame(() => {
          element.style.height = '0px';
        });

        // Обробник завершення переходу
        const transitionEndHandler = (event) => {
          if (event.target === element && event.propertyName === 'height') {
            // Очищаємо слухач події
            element.removeEventListener('transitionend', transitionEndHandler);

            finishAnimation();
          }
        };

        // Функція завершення анімації
        const finishAnimation = () => {
          // Приховуємо елемент
          element.style.display = 'none';

          // Відновлюємо стиль
          element.style.transition = '';
          element.style.height = '';
          element.style.overflow = '';

          // Викликаємо колбек завершення
          if (typeof onComplete === 'function') {
            onComplete(element);
          }

          // Вирішуємо проміс
          resolve(element);
        };

        // Додаємо слухач події завершення переходу
        element.addEventListener('transitionend', transitionEndHandler);

        // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
        setTimeout(() => {
          if (element.style.height === '0px') {
            element.removeEventListener('transitionend', transitionEndHandler);
            finishAnimation();
          }
        }, duration + 50);
      });
    } catch (error) {
      logger.error('Помилка при виконанні slideUp', 'slideUp', { error });
      reject(error);
    }
  });
}

/**
 * Анімація елемента з використанням CSS keyframes
 * @param {HTMLElement} element - Елемент для анімації
 * @param {string} keyframesName - Назва keyframes анімації
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function animate(element, keyframesName, options = {}) {
  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300,               // Тривалість анімації в мс
    easing = 'ease',              // Функція пом'якшення
    delay = 0,                    // Затримка анімації в мс
    iterations = 1,               // Кількість повторень анімації
    direction = 'normal',         // Напрямок анімації
    fillMode = 'both',            // Режим заповнення
    onStart = null,               // Колбек початку анімації
    onComplete = null,            // Колбек завершення анімації
    onIteration = null            // Колбек ітерації анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Створюємо унікальний ID анімації
      const animationId = ++animationIdCounter;

      // Формування назви анімації з урахуванням ID
      const fullAnimationName = `${keyframesName}`;

      // Зберігаємо початковий стиль
      const originalAnimation = element.style.animation;

      // Обробники подій анімації
      const animationStartHandler = (event) => {
        if (event.target === element && event.animationName === fullAnimationName) {
          if (typeof onStart === 'function') {
            onStart(element, event);
          }
        }
      };

      const animationIterationHandler = (event) => {
        if (event.target === element && event.animationName === fullAnimationName) {
          if (typeof onIteration === 'function') {
            onIteration(element, event);
          }
        }
      };

      const animationEndHandler = (event) => {
        if (event.target === element && event.animationName === fullAnimationName) {
          // Очищаємо слухачі подій
          element.removeEventListener('animationstart', animationStartHandler);
          element.removeEventListener('animationiteration', animationIterationHandler);
          element.removeEventListener('animationend', animationEndHandler);

          // Відновлюємо початковий стиль
          element.style.animation = originalAnimation;

          // Видаляємо з колекції активних анімацій
          activeAnimations.delete(animationId);

          // Викликаємо колбек завершення
          if (typeof onComplete === 'function') {
            onComplete(element, event);
          }

          // Вирішуємо проміс
          resolve(element);
        }
      };

      // Додаємо слухачі подій
      element.addEventListener('animationstart', animationStartHandler);
      element.addEventListener('animationiteration', animationIterationHandler);
      element.addEventListener('animationend', animationEndHandler);

      // Зберігаємо анімацію в колекції активних анімацій
      activeAnimations.set(animationId, {
        element,
        animation: fullAnimationName,
        startTime: Date.now(),
        options,
        cleanup: () => {
          element.removeEventListener('animationstart', animationStartHandler);
          element.removeEventListener('animationiteration', animationIterationHandler);
          element.removeEventListener('animationend', animationEndHandler);
          element.style.animation = originalAnimation;
        }
      });

      // Запускаємо анімацію
      element.style.animation = `${duration}ms ${easing} ${delay}ms ${iterations} ${direction} ${fillMode} ${fullAnimationName}`;

      // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
      const totalDuration = duration * iterations + delay;
      setTimeout(() => {
        const activeAnimation = activeAnimations.get(animationId);
        if (activeAnimation) {
          activeAnimation.cleanup();
          activeAnimations.delete(animationId);
          if (typeof onComplete === 'function') {
            onComplete(element, { animationName: fullAnimationName, type: 'animationend' });
          }
          resolve(element);
        }
      }, totalDuration + 100);
    } catch (error) {
      logger.error('Помилка при виконанні анімації', 'animate', { keyframesName, error });
      reject(error);
    }
  });
}

/**
 * Додавання keyframes анімації через стилі
 * @param {string} name - Назва анімації
 * @param {string} keyframesContent - Вміст keyframes правила
 * @returns {HTMLStyleElement} Елемент стилю з анімацією
 */
export function addKeyframes(name, keyframesContent) {
  try {
    // Перевіряємо, чи анімація вже існує
    const existingStyle = document.querySelector(`style[data-animation="${name}"]`);
    if (existingStyle) {
      return existingStyle;
    }

    // Створюємо стиль
    const style = document.createElement('style');
    style.setAttribute('data-animation', name);
    style.textContent = `@keyframes ${name} {
      ${keyframesContent}
    }`;

    // Додаємо стиль в документ
    document.head.appendChild(style);

    logger.debug(`Додано keyframes анімацію "${name}"`, 'addKeyframes');
    return style;
  } catch (error) {
    logger.error('Помилка при додаванні keyframes', 'addKeyframes', { name, error });
    return null;
  }
}

/**
 * Зупинка всіх активних анімацій для елемента
 * @param {HTMLElement} element - Елемент для зупинки анімацій
 */
export function stopAnimations(element) {
  try {
    if (!element) return;

    // Перебираємо всі активні анімації
    activeAnimations.forEach((animation, id) => {
      if (animation.element === element) {
        animation.cleanup();
        activeAnimations.delete(id);
      }
    });

    // Очищаємо анімації елемента
    element.style.animation = '';
    element.style.transition = '';

    logger.debug('Зупинено всі анімації для елемента', 'stopAnimations');
  } catch (error) {
    logger.error('Помилка при зупинці анімацій', 'stopAnimations', { error });
  }
}

/**
 * Створення анімації переходу між двома елементами
 * @param {HTMLElement} fromElement - Початковий елемент
 * @param {HTMLElement} toElement - Кінцевий елемент
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function transition(fromElement, toElement, options = {}) {
  if (!fromElement || !toElement) {
    return Promise.reject(new Error('Не передано початковий або кінцевий елемент'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300,        // Тривалість анімації в мс
    easing = 'ease',       // Функція пом'якшення
    fadeOut = true,        // Затухання початкового елемента
    fadeIn = true,         // Поява кінцевого елемента
    onStart = null,        // Колбек початку анімації
    onComplete = null      // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Викликаємо колбек початку
      if (typeof onStart === 'function') {
        onStart(fromElement, toElement);
      }

      // Анімація приховання початкового елемента
      let hidePromise = Promise.resolve();
      if (fadeOut) {
        hidePromise = fadeOut(fromElement, { duration, easing });
      }

      // Після приховання початкового елемента показуємо кінцевий
      hidePromise.then(() => {
        let showPromise = Promise.resolve();
        if (fadeIn) {
          showPromise = fadeIn(toElement, { duration, easing });
        } else {
          // Просто показуємо елемент
          toElement.style.display = 'block';
        }

        return showPromise;
      }).then(() => {
        // Викликаємо колбек завершення
        if (typeof onComplete === 'function') {
          onComplete(fromElement, toElement);
        }

        // Вирішуємо проміс
        resolve({ fromElement, toElement });
      }).catch(reject);
    } catch (error) {
      logger.error('Помилка при виконанні переходу', 'transition', { error });
      reject(error);
    }
  });
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
  try {
    // Зупиняємо всі активні анімації
    activeAnimations.forEach(animation => {
      animation.cleanup();
    });
    activeAnimations.clear();

    logger.info('Ресурси модуля анімацій очищено', 'cleanup');
  } catch (error) {
    logger.error('Помилка при очищенні ресурсів анімацій', 'cleanup', { error });
  }
}

// Автоматичне очищення при виході зі сторінки
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanup);
}

export default {
  fadeIn,
  fadeOut,
  slideDown,
  slideUp,
  animate,
  addKeyframes,
  stopAnimations,
  transition,
  cleanup
};