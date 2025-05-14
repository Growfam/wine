/**
 * Progress Animations - модуль для анімації прогресу завдань
 * Відповідає за:
 * - Візуальні ефекти для успішного виконання завдань
 * - Анімацію прогрес-барів та індикаторів
 * - Ефекти переходів між станами завдань
 * @version 3.1.0
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/core/logger.js';
// Імпортуємо config та state через іменований імпорт
import { config, state } from '../core.js';
// Імпортуємо потрібні функції з effects напряму
import { createSuccessParticles } from '../effects/particles.js';
import { pulseElement, highlightElement } from '../effects/transitions.js';

// Ініціалізуємо логер для модуля
const logger = getLogger('UI.Animations.Task.Progress');

/**
 * Анімація успішного виконання завдання
 * @param {string} taskId - ID завдання
 * @returns {boolean} Успішність операції
 */
export function animateSuccessfulCompletion(taskId) {
  const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (!taskElement) {
    logger.warn(
      `Не знайдено елемент завдання для анімації: ${taskId}`,
      'animateSuccessfulCompletion',
      {
        category: LOG_CATEGORIES.ANIMATION,
      }
    );
    return false;
  }

  try {
    // Додаємо клас для анімації
    taskElement.classList.add('success-pulse');

    logger.info(`Анімація успішного виконання завдання ${taskId}`, 'animateSuccessfulCompletion', {
      category: LOG_CATEGORIES.ANIMATION,
      details: { taskId, highQuality: state.highQualityEffects },
    });

    // Додаємо анімацію часток для потужних пристроїв, перевіряємо наявність функції
    if (state.highQualityEffects && typeof createSuccessParticles === 'function') {
      createSuccessParticles(taskElement);
    }

    // Додаємо ефект пульсації, перевіряємо наявність функції
    if (typeof pulseElement === 'function') {
      pulseElement(taskElement, 1.03, 800);
    }

    // Додаємо ефект підсвічування, перевіряємо наявність функції
    if (typeof highlightElement === 'function') {
      highlightElement(taskElement, 'rgba(0, 201, 167, 0.6)', 1200);
    }

    // Видаляємо клас анімації через певний час
    setTimeout(() => {
      taskElement.classList.remove('success-pulse');
    }, 2000);

    return true;
  } catch (error) {
    logger.error(error, `Помилка анімації завершення завдання ${taskId}`, {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Показати анімацію прогресу для завдання
 * @param {string} taskId - ID завдання
 * @param {number} progress - Прогрес (0-100)
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність операції
 */
export function showProgressAnimation(taskId, progress, options = {}) {
  const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (!taskElement) {
    logger.warn(
      `Не знайдено елемент завдання для анімації прогресу: ${taskId}`,
      'showProgressAnimation',
      {
        category: LOG_CATEGORIES.ANIMATION,
      }
    );
    return false;
  }

  const progressBar = taskElement.querySelector('.progress-fill');
  if (!progressBar) {
    logger.warn(
      `Не знайдено елемент прогрес-бару для завдання: ${taskId}`,
      'showProgressAnimation',
      {
        category: LOG_CATEGORIES.ANIMATION,
      }
    );
    return false;
  }

  try {
    // Зберігаємо поточне значення
    const currentWidth = parseFloat(progressBar.style.width) || 0;

    // Нормалізуємо прогрес
    const normalizedProgress = Math.min(100, Math.max(0, progress));

    logger.info(
      `Анімація прогресу завдання ${taskId}: ${currentWidth}% -> ${normalizedProgress}%`,
      'showProgressAnimation',
      {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId, currentProgress: currentWidth, newProgress: normalizedProgress },
      }
    );

    // Встановлюємо нове значення з анімацією
    progressBar.style.transition = 'width 1s cubic-bezier(0.1, 0.8, 0.2, 1)';
    progressBar.style.width = `${normalizedProgress}%`;

    // Додаємо ефект пульсації якщо прогрес збільшився
    if (normalizedProgress > currentWidth) {
      progressBar.classList.add('pulse');
      setTimeout(() => {
        progressBar.classList.remove('pulse');
      }, 1200);

      // Якщо прогрес більше 95%, додаємо ефект світіння
      if (normalizedProgress > 95) {
        progressBar.classList.add('glow');
      } else {
        progressBar.classList.remove('glow');
      }
    }

    // Оновлюємо текстове відображення прогресу
    const progressText = taskElement.querySelector('.progress-value');
    if (progressText) {
      const target = options.targetValue || 100;
      const currentValue = Math.round((normalizedProgress * target) / 100);
      progressText.textContent = `${currentValue}/${target}`;
    }

    // Якщо прогрес досягнув 100%, додаткова анімація
    if (normalizedProgress >= 100 && currentWidth < 100) {
      // Додаємо клас до батьківського елемента
      setTimeout(() => {
        taskElement.classList.add('completed');
        logger.info(`Завдання ${taskId} позначено як завершене`, 'showProgressAnimation', {
          category: LOG_CATEGORIES.ANIMATION,
        });

        // Викликаємо функцію успішного завершення
        if (options.triggerCompletion) {
          setTimeout(() => {
            animateSuccessfulCompletion(taskId);
          }, 300);
        }
      }, 300);
    }

    return true;
  } catch (error) {
    logger.error(error, `Помилка анімації прогресу завдання ${taskId}`, {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Анімація статусу завдання
 * @param {HTMLElement} element - Елемент завдання
 * @param {string} newStatus - Новий статус ('pending', 'started', 'completed', 'failed')
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність операції
 */
export function animateTaskStatusChange(element, newStatus, options = {}) {
  if (!element) {
    logger.warn('Не вказано елемент для анімації зміни статусу', 'animateTaskStatusChange', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }

  try {
    // Отримуємо поточний статус
    const currentStatus = element.dataset.status || 'pending';

    // Нічого не робимо, якщо статус не змінився
    if (currentStatus === newStatus) return true;

    logger.info(
      `Анімація зміни статусу: ${currentStatus} -> ${newStatus}`,
      'animateTaskStatusChange',
      {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId: element.dataset.taskId, oldStatus: currentStatus, newStatus },
      }
    );

    // Додаємо клас для анімації переходу
    element.classList.add('status-transition');

    // Оновлюємо статус
    element.dataset.status = newStatus;

    // Додаємо клас для нового статусу
    element.classList.remove(`status-${currentStatus}`);
    element.classList.add(`status-${newStatus}`);

    // Анімація відповідно до нового статусу
    switch (newStatus) {
      case 'completed':
        // Анімація успіху, використовуємо функцію з перевіркою
        if (element.dataset.taskId) {
          animateSuccessfulCompletion(element.dataset.taskId);
        }
        break;

      case 'failed':
        // Анімація провалу завдання
        element.classList.add('failure-shake');
        setTimeout(() => {
          element.classList.remove('failure-shake');
        }, 1000);
        break;

      case 'started':
        // Анімація початку виконання
        element.classList.add('starting-pulse');
        // Використовуємо функцію з перевіркою
        if (typeof highlightElement === 'function') {
          highlightElement(element, 'rgba(78, 181, 247, 0.6)', 1000);
        }
        setTimeout(() => {
          element.classList.remove('starting-pulse');
        }, 1000);
        break;
    }

    // Оновлюємо іконку статусу, якщо є
    const statusIcon = element.querySelector('.status-icon');
    if (statusIcon) {
      // Видаляємо попередні класи
      statusIcon.className = 'status-icon';
      statusIcon.classList.add(`status-${newStatus}`);
    }

    // Видаляємо клас анімації переходу після завершення
    setTimeout(() => {
      element.classList.remove('status-transition');
    }, 500);

    return true;
  } catch (error) {
    logger.error(error, 'Помилка анімації зміни статусу', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Анімація появи нових завдань
 * @param {Array} elements - Елементи завдань
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність операції
 */
export function animateTasksAppear(elements, options = {}) {
  if (!elements || !elements.length) {
    logger.warn('Не вказано елементи для анімації появи', 'animateTasksAppear', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }

  try {
    // Налаштування за замовчуванням, використовуємо config якщо доступний
    const settings = {
      delay: config?.TASK_APPEAR_DELAY || 50, // Затримка між елементами (мс)
      initialY: 20, // Початкове зміщення по Y (px)
      duration: config?.TASK_APPEAR_DURATION || 400, // Тривалість анімації (мс)
      highlight: true, // Підсвічування нових елементів
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Функція пом'якшення
      ...options,
    };

    // Затримки для послідовної анімації
    const baseDelay = settings.delay;

    logger.info(`Анімація появи ${elements.length} завдань`, 'animateTasksAppear', {
      category: LOG_CATEGORIES.ANIMATION,
      details: settings,
    });

    elements.forEach((element, index) => {
      // Початковий стан
      element.style.transform = `translateY(${settings.initialY}px)`;
      element.style.opacity = '0';

      // Плавна поява з затримкою для кожного елемента
      setTimeout(() => {
        element.style.transition = `transform ${settings.duration}ms ${settings.easing}, opacity ${settings.duration * 0.75}ms ease`;
        element.style.transform = 'translateY(0)';
        element.style.opacity = '1';

        // Додаємо ефект підсвічування на короткий час
        if (settings.highlight) {
          setTimeout(() => {
            element.classList.add('highlight-new');

            // Видаляємо ефект через певний час
            setTimeout(() => {
              element.classList.remove('highlight-new');
            }, 1000);
          }, settings.duration * 0.5);
        }
      }, baseDelay * index);
    });

    return true;
  } catch (error) {
    logger.error(error, 'Помилка анімації появи завдань', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Анімація фільтрації списку завдань
 * @param {HTMLElement} container - Контейнер зі списком завдань
 * @param {Function} filterFunc - Функція фільтрації (приймає елемент, повертає boolean)
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність операції
 */
export function animateTasksFiltering(container, filterFunc, options = {}) {
  if (!container) {
    logger.warn('Не вказано контейнер для анімації фільтрації', 'animateTasksFiltering', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }

  try {
    // Налаштування за замовчуванням
    const settings = {
      hideDuration: 300, // Тривалість анімації приховування (мс)
      showDuration: 400, // Тривалість анімації показу (мс)
      staggerDelay: 30, // Затримка між елементами (мс)
      ...options,
    };

    // Отримуємо всі елементи завдань
    const taskElements = container.querySelectorAll('.task-item');
    if (!taskElements.length) {
      logger.warn('Не знайдено елементи завдань для фільтрації', 'animateTasksFiltering', {
        category: LOG_CATEGORIES.ANIMATION,
      });
      return false;
    }

    // Масиви для сортування
    const showElements = [];
    const hideElements = [];

    // Розділяємо елементи за результатом фільтрації
    taskElements.forEach((element) => {
      if (filterFunc(element)) {
        showElements.push(element);
      } else {
        hideElements.push(element);
      }
    });

    logger.info(
      `Анімація фільтрації завдань: показано ${showElements.length}, приховано ${hideElements.length}`,
      'animateTasksFiltering',
      {
        category: LOG_CATEGORIES.ANIMATION,
      }
    );

    // Анімуємо приховання елементів
    hideElements.forEach((element) => {
      element.style.transition = `transform ${settings.hideDuration}ms ease, opacity ${settings.hideDuration}ms ease, height ${settings.hideDuration}ms ease`;
      element.style.overflow = 'hidden';
      element.style.transform = 'scale(0.95)';
      element.style.opacity = '0';
      element.style.height = '0';
      element.style.marginBottom = '0';
      element.style.marginTop = '0';
      element.style.paddingTop = '0';
      element.style.paddingBottom = '0';
    });

    // Анімуємо появу елементів з затримкою
    setTimeout(() => {
      showElements.forEach((element, index) => {
        // Затримка для ефекту послідовності
        setTimeout(() => {
          element.style.transition = `transform ${settings.showDuration}ms ease, opacity ${settings.showDuration}ms ease, height ${settings.showDuration}ms ease`;
          element.style.transform = 'scale(1)';
          element.style.opacity = '1';
          element.style.height = '';
          element.style.marginBottom = '';
          element.style.marginTop = '';
          element.style.paddingTop = '';
          element.style.paddingBottom = '';
          element.style.overflow = '';
        }, settings.staggerDelay * index);
      });
    }, settings.hideDuration);

    // Генеруємо подію після завершення анімації
    setTimeout(
      () => {
        container.dispatchEvent(
          new CustomEvent('tasks-filtering-complete', {
            bubbles: true,
            detail: {
              visibleCount: showElements.length,
              hiddenCount: hideElements.length,
            },
          })
        );
      },
      settings.hideDuration + settings.showDuration + showElements.length * settings.staggerDelay
    );

    return true;
  } catch (error) {
    logger.error(error, 'Помилка анімації фільтрації завдань', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

// Експортуємо публічне API модуля
export {
  animateSuccessfulCompletion,
  showProgressAnimation,
  animateTaskStatusChange,
  animateTasksAppear,
  animateTasksFiltering,
};