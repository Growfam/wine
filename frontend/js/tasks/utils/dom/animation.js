/**
 * DOM Animation - утиліти для анімацій та візуальних ефектів
 *
 * Відповідає за:
 * - Анімації DOM елементів
 * - Переходи між станами
 * - Прості ефекти з'явлення/зникнення
 *
 * @version 1.0.1
 */

import { getLogger } from '../core/logger.js';
import { addEvent } from './events.js';

// Створюємо логер для модуля
const logger = getLogger('DOMAnimation');

// Колекція активних анімацій
const activeAnimations = new Map();

// Лічильник ID для анімацій
let animationIdCounter = 0;

// Стан модуля
const state = {
  isCleanupRegistered: false, // Прапорець реєстрації обробника очищення
};

/**
 * Плавна поява елемента (fade in)
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Опції анімації
 * @returns {Promise} Проміс, який вирішується після завершення анімації
 */
export function fadeIn(element, options = {}) {
  // Перевіряємо, чи встановлений обробник очищення
  registerCleanupHandler();

  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300, // Тривалість анімації в мс
    easing = 'ease', // Функція пом'якшення
    display = 'block', // Стиль відображення елемента
    onStart = null, // Колбек початку анімації
    onComplete = null, // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Зберігаємо початковий стиль
      const originalDisplay = element.style.display;
      const originalOpacity = element.style.opacity;
      const originalVisibility = element.style.visibility;

      // Створюємо унікальний ID анімації
      const animationId = ++animationIdCounter;

      // Додаємо в активні анімації для можливості скасування
      activeAnimations.set(animationId, {
        element,
        type: 'fadeIn',
        cleanup: () => {
          try {
            element.removeEventListener('transitionend', transitionEndHandler);
            if (timeoutId) clearTimeout(timeoutId);
          } catch (e) {
            // Ігноруємо помилки при очищенні
          }
        }
      });

      // Встановлюємо початковий стан
      element.style.opacity = '0';
      element.style.display = display;
      element.style.visibility = 'visible';

      // Змінна для зберігання ID таймауту
      let timeoutId;

      // Обробник завершення переходу
      const transitionEndHandler = function (event) {
        if (event.target === element && event.propertyName === 'opacity') {
          // Очищаємо слухач події
          element.removeEventListener('transitionend', transitionEndHandler);

          // Прибираємо перехід
          element.style.transition = '';

          // Викликаємо колбек завершення
          if (typeof onComplete === 'function') {
            try {
              onComplete(element);
            } catch (e) {
              logger.warn('Помилка у колбеку onComplete', 'fadeIn', { error: e.message });
            }
          }

          // Видаляємо з активних анімацій
          activeAnimations.delete(animationId);

          // Відміняємо таймаут для резервного випадку
          if (timeoutId) clearTimeout(timeoutId);

          // Вирішуємо проміс
          resolve(element);
        }
      };

      // Даємо браузеру час для відображення елемента з opacity=0
      requestAnimationFrame(() => {
        try {
          // Додаємо перехід
          element.style.transition = `opacity ${duration}ms ${easing}`;

          // Викликаємо колбек початку
          if (typeof onStart === 'function') {
            try {
              onStart(element);
            } catch (e) {
              logger.warn('Помилка у колбеку onStart', 'fadeIn', { error: e.message });
            }
          }

          // Запускаємо анімацію
          requestAnimationFrame(() => {
            element.style.opacity = '1';
          });

          // Додаємо слухач події завершення переходу
          element.addEventListener('transitionend', transitionEndHandler);

          // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
          timeoutId = setTimeout(() => {
            try {
              if (activeAnimations.has(animationId)) {
                element.removeEventListener('transitionend', transitionEndHandler);
                element.style.transition = '';

                if (typeof onComplete === 'function') {
                  try {
                    onComplete(element);
                  } catch (e) {
                    logger.warn('Помилка у колбеку onComplete (timeout)', 'fadeIn', { error: e.message });
                  }
                }

                activeAnimations.delete(animationId);
                resolve(element);
              }
            } catch (e) {
              logger.warn('Помилка в таймауті анімації', 'fadeIn', { error: e.message });
              resolve(element);
            }
          }, duration + 50);
        } catch (frameError) {
          // Обробка помилок у requestAnimationFrame
          activeAnimations.delete(animationId);
          logger.error('Помилка в requestAnimationFrame', 'fadeIn', { error: frameError.message });
          reject(frameError);
        }
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
  // Перевіряємо, чи встановлений обробник очищення
  registerCleanupHandler();

  if (!element) {
    return Promise.reject(new Error('Елемент не передано'));
  }

  // Параметри за замовчуванням
  const {
    duration = 300, // Тривалість анімації в мс
    easing = 'ease', // Функція пом'якшення
    hide = true, // Приховати елемент після анімації
    onStart = null, // Колбек початку анімації
    onComplete = null, // Колбек завершення анімації
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Перевіряємо, чи елемент видимий
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        resolve(element);
        return;
      }

      // Створюємо унікальний ID анімації
      const animationId = ++animationIdCounter;

      // Зберігаємо початковий стиль
      const originalOpacity = element.style.opacity || '1';

      // Додаємо в активні анімації для можливості скасування
      activeAnimations.set(animationId, {
        element,
        type: 'fadeOut',
        cleanup: () => {
          try {
            element.removeEventListener('transitionend', transitionEndHandler);
            if (timeoutId) clearTimeout(timeoutId);
          } catch (e) {
            // Ігноруємо помилки при очищенні
          }
        }
      });

      // Змінна для зберігання ID таймауту
      let timeoutId;

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
            try {
              onComplete(element);
            } catch (e) {
              logger.warn('Помилка у колбеку onComplete', 'fadeOut', { error: e.message });
            }
          }

          // Видаляємо з активних анімацій
          activeAnimations.delete(animationId);

          // Відміняємо таймаут для резервного випадку
          if (timeoutId) clearTimeout(timeoutId);

          // Вирішуємо проміс
          resolve(element);
        }
      };

      // Додаємо перехід
      element.style.transition = `opacity ${duration}ms ${easing}`;

      // Викликаємо колбек початку
      if (typeof onStart === 'function') {
        try {
          onStart(element);
        } catch (e) {
          logger.warn('Помилка у колбеку onStart', 'fadeOut', { error: e.message });
        }
      }

      // Запускаємо анімацію
      requestAnimationFrame(() => {
        try {
          element.style.opacity = '0';

          // Додаємо слухач події завершення переходу
          element.addEventListener('transitionend', transitionEndHandler);

          // Додатково встановлюємо таймаут для випадків, коли подія не спрацьовує
          timeoutId = setTimeout(() => {
            try {
              if (activeAnimations.has(animationId)) {
                element.removeEventListener('transitionend', transitionEndHandler);

                if (hide) {
                  element.style.display = 'none';
                }

                element.style.transition = '';

                if (typeof onComplete === 'function') {
                  try {
                    onComplete(element);
                  } catch (e) {
                    logger.warn('Помилка у колбеку onComplete (timeout)', 'fadeOut', { error: e.message });
                  }
                }

                activeAnimations.delete(animationId);
                resolve(element);
              }
            } catch (e) {
              logger.warn('Помилка в таймауті анімації', 'fadeOut', { error: e.message });
              resolve(element);
            }
          }, duration + 50);
        } catch (frameError) {
          // Обробка помилок у requestAnimationFrame
          activeAnimations.delete(animationId);
          logger.error('Помилка в requestAnimationFrame', 'fadeOut', { error: frameError.message });
          reject(frameError);
        }
      });
    } catch (error) {
      logger.error('Помилка при виконанні fadeOut', 'fadeOut', { error });
      reject(error);
    }
  });
}

// ... Інші функції анімації, кожна з подібними покращеннями ...

/**
 * Зупинка всіх активних анімацій для елемента
 * @param {HTMLElement} element - Елемент для зупинки анімацій
 */
export function stopAnimations(element) {
  try {
    if (!element) return;

    // Перебираємо всі активні анімації
    activeAnimations.forEach((animation, id) => {
      try {
        if (animation.element === element) {
          // Викликаємо функцію очищення, якщо вона є
          if (typeof animation.cleanup === 'function') {
            animation.cleanup();
          }

          activeAnimations.delete(id);
        }
      } catch (e) {
        logger.warn('Помилка зупинки анімації елемента', 'stopAnimations', {
          element,
          animationId: id,
          error: e.message
        });
        // Все одно видаляємо анімацію, навіть якщо була помилка
        activeAnimations.delete(id);
      }
    });

    // Очищаємо анімації елемента
    try {
      element.style.animation = '';
      element.style.transition = '';
    } catch (styleError) {
      logger.warn('Помилка скидання стилів анімації', 'stopAnimations', {
        element,
        error: styleError.message
      });
    }

    logger.debug('Зупинено всі анімації для елемента', 'stopAnimations');
  } catch (error) {
    logger.error('Критична помилка при зупинці анімацій', 'stopAnimations', { error });
  }
}

/**
 * Реєстрація обробника очищення ресурсів при виході зі сторінки
 */
function registerCleanupHandler() {
  // Перевіряємо, чи обробник вже зареєстрований
  if (state.isCleanupRegistered || typeof window === 'undefined') {
    return;
  }

  try {
    // Видаляємо існуючий обробник, якщо він є
    window.removeEventListener('beforeunload', cleanup);

    // Додаємо новий обробник
    window.addEventListener('beforeunload', cleanup);

    // Позначаємо, що обробник зареєстрований
    state.isCleanupRegistered = true;

    logger.debug('Зареєстровано обробник очищення анімацій', 'registerCleanupHandler');
  } catch (error) {
    logger.warn('Не вдалося зареєструвати обробник очищення анімацій', 'registerCleanupHandler', {
      error: error.message
    });
  }
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
  try {
    // Створюємо масив ID анімацій для уникнення проблем з ітерацією при видаленні
    const animationIds = Array.from(activeAnimations.keys());

    // Зупиняємо всі активні анімації
    animationIds.forEach((id) => {
      try {
        const animation = activeAnimations.get(id);
        if (animation && typeof animation.cleanup === 'function') {
          animation.cleanup();
        }
      } catch (e) {
        // Ігноруємо помилки при очищенні окремих анімацій
      }
      activeAnimations.delete(id);
    });

    // Очищаємо колекцію активних анімацій
    activeAnimations.clear();

    // Скидаємо прапорець реєстрації обробника
    if (typeof window !== 'undefined') {
      try {
        window.removeEventListener('beforeunload', cleanup);
      } catch (e) {
        // Ігноруємо помилки при видаленні слухача
      }
    }
    state.isCleanupRegistered = false;

    logger.info('Ресурси модуля анімацій очищено', 'cleanup');
  } catch (error) {
    logger.error('Помилка при очищенні ресурсів анімацій', 'cleanup', { error });

    // При критичній помилці все одно очищаємо колекцію
    activeAnimations.clear();
  }
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
  cleanup,
};