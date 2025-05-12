/**
 * Display - модуль для відображення анімацій винагород
 * Відповідає за:
 * - Відображення анімацій при отриманні винагород
 * - Спеціальні ефекти для різних типів винагород
 * - Показ щоденних бонусів
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/index.js';
import { state, config } from '../core.js';
import { createStarsEffect, createConfetti } from '../effects/index.js';

// Ініціалізуємо логер для модуля
const logger = getLogger('UI.Animations.Rewards.Display');

/**
 * Показ анімації винагороди
 * @param {Object} reward - Об'єкт винагороди {amount, type}
 * @param {Object} options - Додаткові опції
 * @returns {Promise} Проміс, що завершується після закриття анімації
 */
export function showReward(reward, options = {}) {
  return new Promise((resolve) => {
    // Перевіряємо, чи можна показати анімацію зараз
    const now = Date.now();
    if (now - state.lastAnimationTime < 500) {
      setTimeout(() => showReward(reward, options).then(resolve), 700);
      return;
    }

    state.lastAnimationTime = now;
    state.animationsInProgress++;

    // Налаштування за замовчуванням
    const settings = {
      duration: config.rewardDuration,
      showConfetti: true,
      autoClose: true,
      onClose: null,
      specialDay: false,
      id: `reward_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    Object.assign(settings, options);

    // Формуємо дані винагороди
    const rewardAmount = reward.amount;
    const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';
    const iconType = reward.type === 'tokens' ? 'token' : 'coin';

    logger.info(`Показ анімації винагороди: ${rewardAmount} ${rewardType}`, 'showReward', {
      category: LOG_CATEGORIES.ANIMATION,
      details: { amount: rewardAmount, type: reward.type, specialDay: settings.specialDay },
    });

    // Створюємо контейнер для анімації
    const container = document.createElement('div');
    container.className = 'premium-reward-container';

    // Створюємо затемнений фон
    const overlay = document.createElement('div');
    overlay.className = 'premium-reward-overlay';

    // Створюємо картку винагороди
    const card = document.createElement('div');
    card.className = 'premium-reward-card';

    // Визначаємо клас іконки
    const iconClass = reward.type === 'coins' && settings.specialDay ? 'token-icon' : '';

    // Наповнюємо картку контентом
    card.innerHTML = `
            <div class="premium-reward-title">${settings.specialDay ? 'Особливий день!' : 'Вітаємо!'}</div>
            
            <div class="premium-reward-icon ${iconClass}">
                <div class="premium-reward-icon-inner" data-icon-type="${iconType}"></div>
            </div>
            
            <div class="premium-reward-amount">
                +${rewardAmount} <span class="premium-reward-currency-icon" data-icon-type="${iconType}-small"></span>
            </div>
            
            <div class="premium-reward-type">Ви отримали ${rewardType}</div>
            
            <button class="premium-reward-button">Чудово!</button>
        `;

    // Збираємо елементи
    container.appendChild(overlay);
    container.appendChild(card);
    document.body.appendChild(container);

    // Показуємо анімацію
    setTimeout(() => {
      overlay.classList.add('show');
      card.classList.add('show');

      // Додаємо спецефекти, якщо потрібно
      if (settings.showConfetti) {
        setTimeout(() => {
          createConfetti({
            count: window.innerWidth < 768 ? 40 : 80,
            colors: reward.type === 'tokens' ? config.specialColors : config.particleColors,
            duration: 2000,
          });

          setTimeout(() => {
            // Додаткові зірки для великих сум
            if (rewardAmount >= 100) {
              createStarsEffect(card, {
                count: 8,
                duration: [800, 1500],
              });
            }
          }, 300);
        }, 200);
      }
    }, 100);

    // Додаємо обробник для кнопки
    const button = card.querySelector('.premium-reward-button');
    button.addEventListener('click', () => {
      closeRewardAnimation();
    });

    // Оновлюємо баланс користувача
    updateUserBalance(reward);

    // Автоматичне закриття
    if (settings.autoClose) {
      const timerId = `reward_${settings.id}`;
      state.timers[timerId] = setTimeout(() => {
        closeRewardAnimation();
      }, settings.duration);
    }

    // Функція закриття анімації
    function closeRewardAnimation() {
      // Очищаємо таймер
      const timerId = `reward_${settings.id}`;
      if (state.timers[timerId]) {
        clearTimeout(state.timers[timerId]);
        delete state.timers[timerId];
      }

      // Приховуємо елементи
      overlay.classList.remove('show');
      card.classList.remove('show');

      // Видаляємо контейнер після завершення анімації
      setTimeout(() => {
        container.remove();
        state.animationsInProgress--;

        logger.info('Закрито анімацію винагороди', 'closeRewardAnimation', {
          category: LOG_CATEGORIES.ANIMATION,
          details: { amount: rewardAmount, type: reward.type },
        });

        // Викликаємо callback
        if (typeof settings.onClose === 'function') {
          settings.onClose();
        }

        // Вирішуємо проміс
        resolve();
      }, 700);
    }
  });
}

/**
 * Показ анімації для щоденного бонусу
 * @param {number} winixAmount - Кількість $WINIX
 * @param {number} tokenAmount - Кількість жетонів
 * @param {boolean} cycleCompleted - Чи завершено цикл
 * @param {Object} completionBonus - Бонус за завершення циклу
 */
export function showDailyBonusReward(winixAmount, tokenAmount, cycleCompleted, completionBonus) {
  logger.info(`Показ щоденного бонусу`, 'showDailyBonusReward', {
    category: LOG_CATEGORIES.ANIMATION,
    details: {
      winixAmount,
      tokenAmount,
      cycleCompleted: !!cycleCompleted,
      hasCompletionBonus: !!completionBonus,
    },
  });

  // Якщо цикл завершено, спочатку показуємо звичайний бонус
  if (cycleCompleted && completionBonus) {
    // Показуємо основний бонус
    showReward(
      {
        type: 'tokens',
        amount: winixAmount,
      },
      {
        duration: config.rewardDuration,
        autoClose: true,
        showConfetti: true,
        onClose: () => {
          // Якщо є жетони, показуємо з затримкою
          if (tokenAmount > 0) {
            setTimeout(() => {
              showReward(
                {
                  type: 'coins',
                  amount: tokenAmount,
                },
                {
                  duration: config.rewardDuration,
                  autoClose: true,
                  showConfetti: true,
                  specialDay: true,
                  onClose: () => {
                    // Потім з затримкою показуємо бонус за завершення
                    setTimeout(() => {
                      showCycleCompletionAnimation(completionBonus);
                    }, 700);
                  },
                }
              );
            }, 700);
          } else {
            // Якщо немає жетонів, одразу показуємо бонус за завершення
            setTimeout(() => {
              showCycleCompletionAnimation(completionBonus);
            }, 700);
          }
        },
      }
    );
  } else {
    // Для звичайного щоденного бонусу
    showReward(
      {
        type: 'tokens',
        amount: winixAmount,
      },
      {
        duration: config.rewardDuration,
        autoClose: true,
        showConfetti: true,
        onClose: () => {
          // Якщо є жетони, показуємо з затримкою
          if (tokenAmount > 0) {
            setTimeout(() => {
              showReward(
                {
                  type: 'coins',
                  amount: tokenAmount,
                },
                {
                  duration: config.rewardDuration,
                  autoClose: true,
                  showConfetti: true,
                  specialDay: true,
                }
              );
            }, 700);
          }
        },
      }
    );
  }
}

/**
 * Показати анімацію бонусу за завершення 30-денного циклу
 * @param {Object} bonusData - Дані бонусу
 */
export function showCycleCompletionAnimation(bonusData) {
  if (!bonusData) return;

  logger.info('Показ анімації бонусу за завершення циклу', 'showCycleCompletionAnimation', {
    category: LOG_CATEGORIES.ANIMATION,
    details: { bonusAmount: bonusData.amount, tokensAmount: bonusData.tokens },
  });

  showReward(
    {
      type: 'tokens',
      amount: bonusData.amount || 0,
    },
    {
      duration: config.rewardDuration * 1.5,
      autoClose: true,
      showConfetti: true,
      specialDay: true,
      onClose: () => {
        // Якщо є додаткові жетони, показуємо їх окремо
        if (bonusData.tokens && bonusData.tokens > 0) {
          setTimeout(() => {
            showReward(
              {
                type: 'coins',
                amount: bonusData.tokens,
              },
              {
                duration: config.rewardDuration,
                autoClose: true,
                showConfetti: true,
                specialDay: true,
              }
            );
          }, 700);
        }
      },
    }
  );
}

/**
 * Оновлення балансу користувача
 * @param {Object} reward - Дані винагороди
 */
export function updateUserBalance(reward) {
  if (reward.type === 'tokens') {
    // Оновлюємо баланс токенів
    const userTokensElement = document.getElementById('user-tokens');
    if (userTokensElement) {
      const currentBalance = parseFloat(userTokensElement.textContent) || 0;
      const newBalance = currentBalance + reward.amount;
      userTokensElement.textContent = newBalance.toFixed(2);

      // Додаємо клас для анімації
      userTokensElement.classList.add('balance-updated');
      setTimeout(() => {
        userTokensElement.classList.remove('balance-updated');
      }, 2000);

      // Зберігаємо значення
      try {
        localStorage.setItem('userTokens', newBalance.toString());
      } catch (e) {
        logger.warn('Не вдалося зберегти баланс токенів', 'updateUserBalance', {
          category: LOG_CATEGORIES.STORAGE,
          details: { error: e.message },
        });
      }
    }
  } else if (reward.type === 'coins') {
    // Оновлюємо баланс жетонів
    const userCoinsElement = document.getElementById('user-coins');
    if (userCoinsElement) {
      const currentBalance = parseInt(userCoinsElement.textContent) || 0;
      const newBalance = currentBalance + reward.amount;
      userCoinsElement.textContent = newBalance.toString();

      // Додаємо клас для анімації
      userCoinsElement.classList.add('balance-updated');
      setTimeout(() => {
        userCoinsElement.classList.remove('balance-updated');
      }, 2000);

      // Зберігаємо значення
      try {
        localStorage.setItem('userCoins', newBalance.toString());
      } catch (e) {
        logger.warn('Не вдалося зберегти баланс жетонів', 'updateUserBalance', {
          category: LOG_CATEGORIES.STORAGE,
          details: { error: e.message },
        });
      }
    }
  }

  // Генеруємо подію про оновлення балансу
  document.dispatchEvent(
    new CustomEvent('balance-updated', {
      detail: {
        type: reward.type,
        amount: reward.amount,
      },
    })
  );

  logger.info(`Оновлено баланс користувача`, 'updateUserBalance', {
    category: LOG_CATEGORIES.LOGIC,
    details: { type: reward.type, amount: reward.amount },
  });
}

/**
 * Анімація дня з жетонами в щоденному бонусі
 * @param {HTMLElement} dayElement - Елемент дня
 */
export function animateTokenDay(dayElement) {
  if (!dayElement) {
    logger.warn('Елемент дня для анімації жетонів не вказано', 'animateTokenDay', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return;
  }

  // Додаємо класи для анімації
  dayElement.classList.add('token-day-pulse');

  logger.info('Анімація дня з жетонами', 'animateTokenDay', {
    category: LOG_CATEGORIES.ANIMATION,
  });

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

  // Якщо у елемента є стилі position: relative, додаємо ефект
  const position = window.getComputedStyle(dayElement).position;
  if (position === 'static') {
    dayElement.style.position = 'relative';
  }

  dayElement.appendChild(glow);

  // Видаляємо ефект через 3 секунди
  setTimeout(() => {
    dayElement.classList.remove('token-day-pulse');
    glow.style.opacity = '1';
    glow.style.transition = 'opacity 1s ease';
    glow.style.opacity = '0';

    setTimeout(() => {
      if (glow.parentNode) {
        glow.parentNode.removeChild(glow);
      }
    }, 1000);
  }, 3000);
}

// Експортуємо публічне API модуля
export {
  showReward,
  showDailyBonusReward,
  showCycleCompletionAnimation,
  updateUserBalance,
  animateTokenDay,
};
