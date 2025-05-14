/**
 * Анімації для щоденних бонусів
 *
 * Відповідає за:
 * - Анімацію підсвітки поточного дня
 * - Анімацію отримання винагороди
 * - Спеціальні ефекти для днів з жетонами
 * - Анімацію завершення циклу
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/core/logger.js';
import { state, config } from '../core.js';
import { createStarsEffect, createConfetti } from '../effects/index.js';
import { showReward, showDailyBonusReward, updateUserBalance } from '../reward/display.js';

// Створюємо логер для модуля
const logger = getLogger('UI.Animations.DailyBonus');

/**
 * Анімація підсвітки поточного дня
 * @param {HTMLElement} dayElement - Елемент поточного дня
 * @param {Object} options - Додаткові опції
 */
export function animateCurrentDay(dayElement, options = {}) {
  try {
    if (!dayElement) {
      logger.warn('Елемент дня не вказано', 'animateCurrentDay', {
        category: LOG_CATEGORIES.ANIMATION,
      });
      return;
    }

    // Налаштування за замовчуванням
    const settings = {
      duration: 2000,
      repeat: true,
      intensity: 'medium',
      ...options,
    };

    // Додаємо клас анімації
    const animationClass = `day-pulse-${settings.intensity}`;
    dayElement.classList.add(animationClass);

    // Створюємо ефект світіння
    const glow = document.createElement('div');
    glow.className = 'day-glow';
    glow.style.position = 'absolute';
    glow.style.top = '0';
    glow.style.left = '0';
    glow.style.width = '100%';
    glow.style.height = '100%';
    glow.style.borderRadius = 'inherit';
    glow.style.pointerEvents = 'none';

    // Налаштовуємо колір в залежності від інтенсивності
    let glowColor;
    switch (settings.intensity) {
      case 'low':
        glowColor = 'rgba(78, 181, 247, 0.5)';
        break;
      case 'high':
        glowColor = 'rgba(255, 215, 0, 0.7)';
        break;
      case 'medium':
      default:
        glowColor = 'rgba(0, 201, 167, 0.6)';
        break;
    }

    glow.style.boxShadow = `0 0 15px ${glowColor}`;
    glow.style.animation = `pulse-${settings.intensity} 2s infinite ease-in-out`;

    // Додаємо стилі для анімації, якщо їх ще немає
    if (!document.getElementById('daily-bonus-animation-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'daily-bonus-animation-styles';
      styleElement.textContent = `
        @keyframes pulse-low {
          0% { opacity: 0.3; transform: scale(0.97); }
          50% { opacity: 0.7; transform: scale(1.03); }
          100% { opacity: 0.3; transform: scale(0.97); }
        }
        
        @keyframes pulse-medium {
          0% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 0.8; transform: scale(1.05); }
          100% { opacity: 0.4; transform: scale(0.95); }
        }
        
        @keyframes pulse-high {
          0% { opacity: 0.5; transform: scale(0.92); }
          50% { opacity: 0.9; transform: scale(1.08); }
          100% { opacity: 0.5; transform: scale(0.92); }
        }
        
        .day-pulse-low {
          position: relative;
          z-index: 1;
        }
        
        .day-pulse-medium {
          position: relative;
          z-index: 2;
        }
        
        .day-pulse-high {
          position: relative;
          z-index: 3;
        }
      `;

      document.head.appendChild(styleElement);
    }

    // Якщо у елемента є стилі position: static, змінюємо на relative
    const position = window.getComputedStyle(dayElement).position;
    if (position === 'static') {
      dayElement.style.position = 'relative';
    }

    // Додаємо ефект до елемента
    dayElement.appendChild(glow);

    // Видаляємо ефект після закінчення тривалості, якщо не потрібно повторювати
    if (!settings.repeat) {
      setTimeout(() => {
        // Поступово приховуємо
        glow.style.transition = 'opacity 0.5s ease';
        glow.style.opacity = '0';

        // Видаляємо після завершення анімації
        setTimeout(() => {
          dayElement.classList.remove(animationClass);
          if (glow.parentNode) {
            glow.parentNode.removeChild(glow);
          }
        }, 500);
      }, settings.duration);
    }

    logger.debug('Анімація поточного дня', 'animateCurrentDay', {
      category: LOG_CATEGORIES.ANIMATION,
      details: { intensity: settings.intensity, duration: settings.duration },
    });

    // Повертаємо функцію для зупинки анімації
    return () => {
      dayElement.classList.remove(animationClass);
      if (glow.parentNode) {
        glow.parentNode.removeChild(glow);
      }
    };
  } catch (error) {
    logger.error(error, 'Помилка анімації поточного дня', {
      category: LOG_CATEGORIES.ANIMATION,
    });

    return () => {};
  }
}

/**
 * Анімація дня з жетонами
 * @param {HTMLElement} dayElement - Елемент дня з жетонами
 * @param {Object} options - Додаткові опції
 */
export function animateTokenDay(dayElement, options = {}) {
  try {
    if (!dayElement) {
      logger.warn('Елемент дня з жетонами не вказано', 'animateTokenDay', {
        category: LOG_CATEGORIES.ANIMATION,
      });
      return;
    }

    // Налаштування за замовчуванням
    const settings = {
      duration: 3000,
      withParticles: true,
      ...options,
    };

    // Додаємо клас для анімації
    dayElement.classList.add('token-day');

    // Створюємо ефект світіння
    const glow = document.createElement('div');
    glow.className = 'token-day-glow';
    glow.style.position = 'absolute';
    glow.style.top = '0';
    glow.style.left = '0';
    glow.style.width = '100%';
    glow.style.height = '100%';
    glow.style.borderRadius = 'inherit';
    glow.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.7)';
    glow.style.animation = 'token-day-pulse 2s infinite ease-in-out';
    glow.style.zIndex = '-1';
    glow.style.pointerEvents = 'none';

    // Якщо у елемента є стилі position: static, змінюємо на relative
    const position = window.getComputedStyle(dayElement).position;
    if (position === 'static') {
      dayElement.style.position = 'relative';
    }

    // Додаємо стилі для анімації, якщо їх ще немає
    if (!document.getElementById('token-day-animation-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'token-day-animation-styles';
      styleElement.textContent = `
        @keyframes token-day-pulse {
          0% { opacity: 0.5; transform: scale(0.96); }
          50% { opacity: 0.8; transform: scale(1.04); }
          100% { opacity: 0.5; transform: scale(0.96); }
        }
        
        .token-day {
          position: relative;
          overflow: visible !important;
        }
        
        .token-day::before {
          content: '';
          position: absolute;
          top: -5px;
          left: -5px;
          right: -5px;
          bottom: -5px;
          border-radius: inherit;
          background: radial-gradient(circle, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0) 70%);
          z-index: -2;
          pointer-events: none;
        }
      `;

      document.head.appendChild(styleElement);
    }

    // Додаємо ефект до елемента
    dayElement.appendChild(glow);

    // Додаємо частинки, якщо потрібно
    if (settings.withParticles && typeof createStarsEffect === 'function') {
      setTimeout(() => {
        createStarsEffect(dayElement, {
          count: 4,
          duration: [800, 1500],
          colors: ['#FFD700', '#FFA500'],
        });
      }, 500);
    }

    // Видаляємо ефект після закінчення тривалості
    setTimeout(() => {
      // Поступово приховуємо
      glow.style.transition = 'opacity 1s ease';
      glow.style.opacity = '0';

      // Видаляємо після завершення анімації
      setTimeout(() => {
        dayElement.classList.remove('token-day');
        if (glow.parentNode) {
          glow.parentNode.removeChild(glow);
        }
      }, 1000);
    }, settings.duration);

    logger.debug('Анімація дня з жетонами', 'animateTokenDay', {
      category: LOG_CATEGORIES.ANIMATION,
    });
  } catch (error) {
    logger.error(error, 'Помилка анімації дня з жетонами', {
      category: LOG_CATEGORIES.ANIMATION,
    });
  }
}

/**
 * Анімація переходу до наступного дня
 * @param {HTMLElement} currentDayElement - Елемент поточного дня
 * @param {HTMLElement} nextDayElement - Елемент наступного дня
 * @param {Function} callback - Функція, яка викликається після анімації
 */
export function animateDayTransition(currentDayElement, nextDayElement, callback) {
  try {
    if (!currentDayElement || !nextDayElement) {
      logger.warn('Елементи днів не вказано', 'animateDayTransition', {
        category: LOG_CATEGORIES.ANIMATION,
      });

      if (typeof callback === 'function') {
        callback();
      }

      return;
    }

    // Додаємо класи для анімації
    currentDayElement.classList.add('day-transition-out');

    // Через 500мс починаємо анімацію наступного дня
    setTimeout(() => {
      // Позначаємо поточний день як завершений
      currentDayElement.classList.add('day-completed');
      currentDayElement.classList.remove('day-current', 'day-transition-out');

      // Позначаємо наступний день як поточний
      nextDayElement.classList.add('day-current', 'day-transition-in');
      nextDayElement.classList.remove('day-pending');

      // Через 500мс завершуємо анімацію
      setTimeout(() => {
        nextDayElement.classList.remove('day-transition-in');

        // Викликаємо callback
        if (typeof callback === 'function') {
          callback();
        }
      }, 500);
    }, 500);

    logger.debug('Анімація переходу до наступного дня', 'animateDayTransition', {
      category: LOG_CATEGORIES.ANIMATION,
    });
  } catch (error) {
    logger.error(error, 'Помилка анімації переходу до наступного дня', {
      category: LOG_CATEGORIES.ANIMATION,
    });

    // Викликаємо callback навіть у випадку помилки
    if (typeof callback === 'function') {
      callback();
    }
  }
}

/**
 * Анімація отримання щоденного бонусу
 * @param {Object} reward - Дані винагороди
 * @param {Object} options - Додаткові опції
 * @returns {Promise} Проміс, що завершується після закриття анімації
 */
export function animateDailyBonusClaim(reward, options = {}) {
  return new Promise((resolve) => {
    try {
      // Налаштування за замовчуванням
      const settings = {
        container: document.body,
        cycleCompleted: false,
        completionBonus: null,
        withConfetti: true,
        autoClose: true,
        duration: 3000,
        ...options,
      };

      logger.info('Анімація отримання щоденного бонусу', 'animateDailyBonusClaim', {
        category: LOG_CATEGORIES.ANIMATION,
        details: {
          tokens: reward.tokens,
          coins: reward.coins,
          cycleCompleted: settings.cycleCompleted,
        },
      });

      // Показуємо анімацію через showDailyBonusReward
      showDailyBonusReward(
        reward.tokens,
        reward.coins,
        settings.cycleCompleted,
        settings.completionBonus
      );

      // Додаємо конфеті, якщо потрібно
      if (settings.withConfetti && typeof createConfetti === 'function') {
        setTimeout(() => {
          createConfetti({
            count: window.innerWidth < 768 ? 40 : 80,
            colors: reward.coins > 0 ? ['#FFD700', '#FFA500', '#4eb5f7'] : ['#4eb5f7', '#00C9A7'],
            duration: 2000,
          });
        }, 200);
      }

      // Вирішуємо проміс після закінчення всіх анімацій
      // Заснуто додатковий час для всіх послідовних анімацій
      setTimeout(
        () => {
          resolve();
        },
        settings.duration * (settings.cycleCompleted ? 3 : 1) + 1000
      );
    } catch (error) {
      logger.error(error, 'Помилка анімації отримання щоденного бонусу', {
        category: LOG_CATEGORIES.ANIMATION,
      });

      // Вирішуємо проміс навіть у випадку помилки
      resolve();
    }
  });
}

/**
 * Анімація завершення циклу
 * @param {Object} bonusData - Дані бонусу за завершення циклу
 * @param {Object} options - Додаткові опції
 * @returns {Promise} Проміс, що завершується після закриття анімації
 */
export function animateCycleCompletion(bonusData, options = {}) {
  return new Promise((resolve) => {
    try {
      // Налаштування за замовчуванням
      const settings = {
        duration: 4000,
        withConfetti: true,
        ...options,
      };

      logger.info('Анімація завершення циклу щоденних бонусів', 'animateCycleCompletion', {
        category: LOG_CATEGORIES.ANIMATION,
        details: {
          tokens: bonusData.tokens,
          coins: bonusData.coins,
        },
      });

      // Показуємо анімацію через showReward з спеціальними налаштуваннями
      showReward(
        {
          type: 'tokens',
          amount: bonusData.tokens,
        },
        {
          duration: settings.duration,
          autoClose: true,
          showConfetti: settings.withConfetti,
          specialDay: true,
          title: 'Цикл завершено!',
          message: 'Ви отримали бонус за завершення циклу',
          onClose: () => {
            // Якщо є жетони, показуємо їх окремо
            if (bonusData.coins && bonusData.coins > 0) {
              setTimeout(() => {
                showReward(
                  {
                    type: 'coins',
                    amount: bonusData.coins,
                  },
                  {
                    duration: 3000,
                    autoClose: true,
                    showConfetti: false,
                    specialDay: true,
                    title: 'Додатковий бонус!',
                    message: 'Ви отримали додаткові жетони',
                    onClose: resolve,
                  }
                );
              }, 500);
            } else {
              // Якщо немає жетонів, відразу вирішуємо проміс
              resolve();
            }
          },
        }
      );
    } catch (error) {
      logger.error(error, 'Помилка анімації завершення циклу', {
        category: LOG_CATEGORIES.ANIMATION,
      });

      // Вирішуємо проміс навіть у випадку помилки
      resolve();
    }
  });
}

// Експортуємо функції
export default {
  animateCurrentDay,
  animateTokenDay,
  animateDayTransition,
  animateDailyBonusClaim,
  animateCycleCompletion,
};
