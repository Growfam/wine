/**
 * RewardPopup - компонент для відображення спливаючого вікна винагороди
 *
 * Відповідає за:
 * - Створення контейнера для відображення винагороди
 * - Анімацію появи вікна винагороди
 * - Управління послідовністю показу кількох винагород
 */

import { UI } from '../../../index.js';
import { getLogger, LOG_CATEGORIES } from '../../../utils';

// Логер для модуля
const logger = getLogger('UI.RewardPopup');

// Конфігурація
const CONFIG = {
  animationDuration: 2000, // Тривалість анімації (мс)
  autoHideTimeout: 5000, // Час автоматичного закриття (мс)
  transitionDuration: 700, // Тривалість переходів (мс)
  timingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Функція пом'якшення
};

// Стан модуля
const state = {
  rewardQueue: [], // Черга винагород
  activePopup: null, // Активне вікно
  isActive: false, // Чи відображається зараз вікно
  timers: {}, // Активні таймери
};

/**
 * Показ вікна з винагородою
 * @param {Object} reward - Дані винагороди {amount, type}
 * @param {Object} options - Додаткові опції
 * @returns {Promise} Проміс, що завершується після закриття вікна
 */
export function showRewardPopup(reward, options = {}) {
  return new Promise((resolve) => {
    // Якщо вже показується інше вікно, додаємо в чергу
    if (state.isActive) {
      state.rewardQueue.push({
        reward,
        options,
        resolve,
      });

      logger.info('Додано винагороду в чергу', 'showRewardPopup', {
        category: LOG_CATEGORIES.UI,
        details: { queueLength: state.rewardQueue.length },
      });

      return;
    }

    // Позначаємо, що вікно активне
    state.isActive = true;

    // Налаштування за замовчуванням
    const settings = {
      title: 'Вітаємо!',
      message: null,
      duration: CONFIG.autoHideTimeout,
      showConfetti: true,
      autoClose: true,
      specialEffect: false,
      onClose: null,
      id: `reward_${Date.now()}`,
    };
    Object.assign(settings, options);

    // Визначаємо тип та текст винагороди
    const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';
    const rewardMessage = settings.message || `Ви отримали ${reward.amount} ${rewardType}`;

    logger.info(`Показ вікна винагороди: ${reward.amount} ${rewardType}`, 'showRewardPopup', {
      category: LOG_CATEGORIES.UI,
      details: { amount: reward.amount, type: reward.type },
    });

    // Створюємо контейнер, якщо його немає
    ensureContainer();
    const container = document.getElementById('reward-popup-container');

    // Створюємо вікно
    const popup = createPopupElement(reward, rewardMessage, settings);

    // Зберігаємо посилання на активне вікно
    state.activePopup = {
      element: popup,
      settings,
    };

    // Додаємо до контейнера
    container.appendChild(popup);

    // Показуємо контейнер і вікно з анімацією
    setTimeout(() => {
      container.classList.add('show');
      popup.classList.add('show');

      // Додаємо спеціальні ефекти, якщо потрібно
      if (settings.showConfetti && UI.Animations && UI.Animations.createConfetti) {
        setTimeout(() => {
          UI.Animations.createConfetti({
            count: window.innerWidth < 768 ? 40 : 80,
            duration: 2000,
          });
        }, 200);
      }

      // Якщо є спеціальні ефекти
      if (settings.specialEffect && UI.Animations && UI.Animations.createStarsEffect) {
        setTimeout(() => {
          UI.Animations.createStarsEffect(popup);
        }, 500);
      }
    }, 10);

    // Кнопка закриття
    const closeButton = popup.querySelector('.reward-popup-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        closeRewardPopup(resolve);
      });
    }

    // Автоматичне закриття
    if (settings.autoClose) {
      state.timers[settings.id] = setTimeout(() => {
        closeRewardPopup(resolve);
      }, settings.duration);
    }
  });
}

/**
 * Забезпечення наявності контейнера
 */
function ensureContainer() {
  if (!document.getElementById('reward-popup-container')) {
    const container = document.createElement('div');
    container.id = 'reward-popup-container';
    container.className = 'reward-popup-container';

    // Додаємо стилі
    injectStyles();

    // Додаємо у документ
    document.body.appendChild(container);

    logger.debug('Створено контейнер для вікон винагород', 'ensureContainer', {
      category: LOG_CATEGORIES.RENDERING,
    });
  }
}

/**
 * Створення елементу вікна
 * @param {Object} reward - Дані винагороди
 * @param {string} message - Повідомлення
 * @param {Object} settings - Налаштування
 * @returns {HTMLElement} Елемент вікна
 */
function createPopupElement(reward, message, settings) {
  const popup = document.createElement('div');
  popup.className = 'reward-popup';

  // Додаємо клас для типу винагороди
  if (reward.type === 'tokens') {
    popup.classList.add('token-reward');
  } else {
    popup.classList.add('coin-reward');
  }

  // Додаємо спеціальний клас, якщо потрібно
  if (settings.specialEffect) {
    popup.classList.add('special-effect');
  }

  // Створюємо контент
  popup.innerHTML = `
        <div class="reward-popup-title">${settings.title}</div>
        
        <div class="reward-popup-icon">
            <div class="reward-popup-icon-inner" data-type="${reward.type}"></div>
        </div>
        
        <div class="reward-popup-amount">
            +${reward.amount}
        </div>
        
        <div class="reward-popup-message">${message}</div>
        
        <button class="reward-popup-button">Чудово!</button>
    `;

  return popup;
}

/**
 * Закриття вікна винагороди
 * @param {Function} resolvePromise - Функція для вирішення проміса
 */
function closeRewardPopup(resolvePromise) {
  if (!state.activePopup) return;

  const { element, settings } = state.activePopup;
  const container = document.getElementById('reward-popup-container');

  // Знімаємо класи для анімації
  element.classList.remove('show');
  container.classList.remove('show');

  // Очищаємо таймер
  if (state.timers[settings.id]) {
    clearTimeout(state.timers[settings.id]);
    delete state.timers[settings.id];
  }

  // Видаляємо елемент після анімації
  setTimeout(() => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }

    // Очищаємо стан
    state.activePopup = null;
    state.isActive = false;

    // Викликаємо callback
    if (typeof settings.onClose === 'function') {
      settings.onClose();
    }

    // Вирішуємо проміс
    if (resolvePromise) {
      resolvePromise();
    }

    // Показуємо наступну винагороду з черги
    showNextReward();
  }, CONFIG.transitionDuration);
}

/**
 * Показ наступної винагороди з черги
 */
function showNextReward() {
  if (state.rewardQueue.length > 0) {
    const nextReward = state.rewardQueue.shift();

    logger.info('Показ наступної винагороди з черги', 'showNextReward', {
      category: LOG_CATEGORIES.UI,
      details: { queueLength: state.rewardQueue.length },
    });

    // Показуємо наступну винагороду з невеликою затримкою
    setTimeout(() => {
      showRewardPopup(nextReward.reward, nextReward.options).then(() => {
        if (nextReward.resolve) {
          nextReward.resolve();
        }
      });
    }, 500);
  }
}

/**
 * Показ послідовності винагород
 * @param {Array} rewards - Масив винагород
 * @param {Object} options - Загальні опції для всіх винагород
 * @returns {Promise} Проміс, що завершується після показу всіх винагород
 */
export function showRewardSequence(rewards, options = {}) {
  return new Promise(async (resolve) => {
    if (!rewards || !rewards.length) {
      resolve();
      return;
    }

    logger.info(`Показ послідовності з ${rewards.length} винагород`, 'showRewardSequence', {
      category: LOG_CATEGORIES.UI,
    });

    // Показуємо винагороди послідовно
    for (let i = 0; i < rewards.length; i++) {
      const reward = rewards[i];
      const isLastReward = i === rewards.length - 1;

      // Для останньої винагороди додаємо callback, який вирішить основний проміс
      const rewardOptions = {
        ...options,
        onClose: isLastReward ? resolve : null,
      };

      // Показуємо винагороду і чекаємо її закриття
      await showRewardPopup(reward, rewardOptions);
    }
  });
}

/**
 * Ін'єкція стилів
 */
function injectStyles() {
  if (document.getElementById('reward-popup-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'reward-popup-styles';

  styleElement.textContent = `
        .reward-popup-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: opacity ${CONFIG.transitionDuration}ms ease, visibility ${CONFIG.transitionDuration}ms ease;
            backdrop-filter: blur(8px);
        }
        
        .reward-popup-container.show {
            opacity: 1;
            visibility: visible;
        }
        
        .reward-popup {
            background: linear-gradient(135deg, rgba(30, 39, 70, 0.85), rgba(15, 23, 42, 0.95));
            color: white;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(78, 181, 247, 0.3) inset;
            padding: 40px;
            transform: scale(0.8) translateY(20px);
            opacity: 0;
            transition: transform ${CONFIG.transitionDuration}ms ${CONFIG.timingFunction}, 
                        opacity ${CONFIG.transitionDuration}ms ease;
            text-align: center;
            position: relative;
            width: 90%;
            max-width: 400px;
        }
        
        .reward-popup.show {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        /* Заголовок і елементи */
        .reward-popup-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 0 0 10px rgba(0, 201, 167, 0.6);
        }
        
        .reward-popup-icon {
            width: 120px;
            height: 120px;
            margin: 25px auto;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #4eb5f7, #00C9A7);
            box-shadow: 0 0 30px rgba(0, 201, 167, 0.8);
            transform: scale(0);
            transition: transform 0.8s ${CONFIG.timingFunction} 0.3s;
        }
        
        .reward-popup.token-reward .reward-popup-icon {
            background: linear-gradient(135deg, #4eb5f7, #00C9A7);
        }
        
        .reward-popup.coin-reward .reward-popup-icon {
            background: linear-gradient(135deg, #FFD700, #FFA500);
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
        }
        
        .reward-popup.show .reward-popup-icon {
            transform: scale(1);
        }
        
        .reward-popup-amount {
            font-size: 42px;
            font-weight: bold;
            color: #FFD700;
            margin: 15px 0;
            text-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
            transform: scale(0);
            transition: transform 0.8s ${CONFIG.timingFunction} 0.4s;
        }
        
        .reward-popup.show .reward-popup-amount {
            transform: scale(1);
        }
        
        .reward-popup-message {
            font-size: 18px;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
            transform: translateY(20px);
            opacity: 0;
            transition: transform 0.7s ease 0.5s, opacity 0.7s ease 0.5s;
        }
        
        .reward-popup.show .reward-popup-message {
            transform: translateY(0);
            opacity: 1;
        }
        
        .reward-popup-button {
            padding: 14px 35px;
            font-size: 18px;
            font-weight: bold;
            color: white;
            background: linear-gradient(90deg, #4eb5f7, #00C9A7);
            border: none;
            border-radius: 30px;
            cursor: pointer;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease,
                        transform 0.7s ease 0.6s,
                        opacity 0.7s ease 0.6s;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        
        .reward-popup.show .reward-popup-button {
            transform: translateY(0);
            opacity: 1;
        }
        
        .reward-popup-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 25px rgba(0, 0, 0, 0.4);
        }
        
        /* Адаптивність */
        @media (max-width: 480px) {
            .reward-popup {
                padding: 25px;
                max-width: 320px;
            }
            
            .reward-popup-title {
                font-size: 24px;
            }
            
            .reward-popup-icon {
                width: 100px;
                height: 100px;
                margin: 20px auto;
            }
            
            .reward-popup-amount {
                font-size: 36px;
            }
            
            .reward-popup-message {
                font-size: 16px;
            }
            
            .reward-popup-button {
                padding: 12px 30px;
                font-size: 16px;
            }
        }
    `;

  document.head.appendChild(styleElement);

  logger.debug('Додано стилі для вікон винагород', 'injectStyles', {
    category: LOG_CATEGORIES.RENDERING,
  });
}

/**
 * Очистка ресурсів
 */
export function cleanup() {
  // Очищаємо всі таймери
  Object.keys(state.timers).forEach((timerId) => {
    clearTimeout(state.timers[timerId]);
  });
  state.timers = {};

  // Очищаємо чергу
  state.rewardQueue = [];

  // Закриваємо активне вікно
  if (state.activePopup) {
    const container = document.getElementById('reward-popup-container');
    if (container) {
      container.classList.remove('show');
    }

    if (state.activePopup.element && state.activePopup.element.parentNode) {
      state.activePopup.element.remove();
    }

    state.activePopup = null;
    state.isActive = false;
  }

  logger.info('Ресурси модуля вікон винагород очищено', 'cleanup', {
    category: LOG_CATEGORIES.LOGIC,
  });
}

// Експортуємо публічний API
export default {
  showRewardPopup,
  showRewardSequence,
  cleanup,
};
