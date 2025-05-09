/**
 * Core Animations - основний модуль анімацій UI для системи завдань
 * Відповідає за:
 * - Ініціалізацію та налаштування модуля анімацій
 * - Визначення продуктивності пристрою
 * - Управління подіями анімацій
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES, debounce, cleanup  } from '../../utils/index.js';
// Імпортуємо необхідні компоненти
import { animateSuccessfulCompletion } from './task/progress.js';
import { showDailyBonusReward } from './reward/display.js';


// Ініціалізуємо логер для модуля
const logger = getLogger('UI.Animations.Core');

// Конфігурація з оптимізованими значеннями за замовчуванням
const config = {
  enabled: true, // Чи включені анімації
  adaptiveMode: true, // Адаптація під потужність пристрою
  rewardDuration: 3000, // Тривалість анімації нагороди (мс)
  particleColors: [
    // Кольори частинок
    '#4EB5F7',
    '#00C9A7',
    '#AD6EE5',
    '#FFD700',
    '#52C0BD',
  ],
  specialColors: [
    // Кольори для особливих подій
    '#FFD700',
    '#FFA500',
    '#FF8C00',
  ],
  timingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Стан анімацій
const state = {
  initialized: false,
  devicePerformance: 'medium', // 'low', 'medium', 'high'
  highQualityEffects: true,
  animationsInProgress: 0,
  timers: {}, // Кеш активних таймерів
  lastAnimationTime: 0, // Час останньої анімації
};

/**
 * Ініціалізація модуля анімацій
 * @param {Object} options - Опції конфігурації
 */
export function init(options = {}) {
  // Запобігаємо повторній ініціалізації
  if (state.initialized) return;

  logger.info('Ініціалізація анімацій...', 'init', {
    category: LOG_CATEGORIES.INIT,
  });

  // Оновлюємо конфігурацію
  Object.assign(config, options);

  // Визначаємо продуктивність пристрою (спрощений алгоритм)
  detectDevicePerformance();

  // Додаємо стилі
  injectAnimationStyles();

  // Налаштовуємо обробники подій
  setupEventHandlers();

  // Відзначаємо, що модуль ініціалізовано
  state.initialized = true;

  logger.info(`Ініціалізація завершена (режим: ${state.devicePerformance})`, 'init', {
    category: LOG_CATEGORIES.INIT,
    details: {
      performanceMode: state.devicePerformance,
      highQuality: state.highQualityEffects,
    },
  });
}

/**
 * Визначення продуктивності пристрою (оптимізований алгоритм)
 */
function detectDevicePerformance() {
  try {
    // Завантажуємо збережені налаштування, якщо є
    const savedPerformance = localStorage.getItem('devicePerformance');
    if (savedPerformance) {
      state.devicePerformance = savedPerformance;
      state.highQualityEffects = savedPerformance === 'high';
      return;
    }

    // Швидкий тест продуктивності
    const startTime = performance.now();

    // Спрощений тест - менше ітерацій для швидкості
    let counter = 0;
    const iterations = 300000;
    for (let i = 0; i < iterations; i++) {
      counter += Math.sqrt(i);
    }

    const duration = performance.now() - startTime;

    // Визначаємо продуктивність за результатами
    if (duration > 50) {
      state.devicePerformance = 'low';
      state.highQualityEffects = false;
    } else if (duration > 25) {
      state.devicePerformance = 'medium';
      state.highQualityEffects = window.innerWidth >= 768;
    } else {
      state.devicePerformance = 'high';
      state.highQualityEffects = true;
    }

    // Додаткова корекція для мобільних пристроїв
    if (window.innerWidth < 600 && state.devicePerformance === 'high') {
      state.devicePerformance = 'medium';
    }

    // Зберігаємо результат
    try {
      localStorage.setItem('devicePerformance', state.devicePerformance);
    } catch (e) {
      logger.warn('Помилка збереження налаштувань продуктивності', 'detectDevicePerformance', {
        category: LOG_CATEGORIES.STORAGE,
        details: { error: e.message },
      });
    }
  } catch (e) {
    // Запасний варіант у випадку помилки
    logger.warn('Помилка визначення продуктивності', 'detectDevicePerformance', {
      category: LOG_CATEGORIES.LOGIC,
      details: { error: e.message },
    });
    state.devicePerformance = 'medium';
    state.highQualityEffects = false;
  }
}

/**
 * Додавання CSS стилів (оптимізовано - винесено найважливіші стилі)
 */
function injectAnimationStyles() {
  if (document.getElementById('premium-animations-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'premium-animations-styles';

  // Оптимізовано - скорочено кількість CSS правил
  styleElement.textContent = `
        /* Контейнер анімації винагороди */
        .premium-reward-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            pointer-events: none;
            z-index: 10000;
        }
        
        /* Фон */
        .premium-reward-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            opacity: 0;
            transition: opacity 0.7s ease;
            backdrop-filter: blur(8px);
        }
        
        .premium-reward-overlay.show {
            opacity: 1;
        }
        
        /* Картка винагороди */
        .premium-reward-card {
            background: linear-gradient(135deg, rgba(30, 39, 70, 0.85), rgba(15, 23, 42, 0.95));
            color: white;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(78, 181, 247, 0.3) inset;
            padding: 40px;
            transform: scale(0.8) translateY(20px);
            opacity: 0;
            transition: all 0.7s ${config.timingFunction};
            text-align: center;
            position: relative;
            width: 90%;
            max-width: 400px;
        }
        
        .premium-reward-card.show {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        /* Заголовок і елементи винагороди */
        .premium-reward-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 0 0 10px rgba(0, 201, 167, 0.6);
        }
        
        .premium-reward-icon {
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
            transition: transform 0.8s ${config.timingFunction} 0.3s;
        }
        
        .premium-reward-card.show .premium-reward-icon {
            transform: scale(1);
        }
        
        .premium-reward-icon.token-icon {
            background: linear-gradient(135deg, #FFD700, #FFA500);
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
        }
        
        /* Кількість винагороди */
        .premium-reward-amount {
            font-size: 42px;
            font-weight: bold;
            color: #FFD700;
            margin: 15px 0;
            text-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
            transform: scale(0);
            transition: transform 0.8s ${config.timingFunction} 0.4s;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
        }
        
        .premium-reward-card.show .premium-reward-amount {
            transform: scale(1);
        }
        
        /* Тип винагороди */
        .premium-reward-type {
            font-size: 18px;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.7s ease 0.5s;
        }
        
        .premium-reward-card.show .premium-reward-type {
            transform: translateY(0);
            opacity: 1;
        }
        
        /* Кнопка */
        .premium-reward-button {
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
            transition: all 0.3s ease, transform 0.7s ease 0.6s, opacity 0.7s ease 0.6s;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        
        .premium-reward-card.show .premium-reward-button {
            transform: translateY(0);
            opacity: 1;
        }
        
        .premium-reward-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 25px rgba(0, 0, 0, 0.4);
        }
    `;

  document.head.appendChild(styleElement);

  logger.info('Стилі анімацій додано до документа', 'injectAnimationStyles', {
    category: LOG_CATEGORIES.RENDERING,
  });
}

/**
 * Налаштування обробників подій
 */
function setupEventHandlers() {
  try {
    // Обробник завершення завдання
    document.addEventListener('task-completed', function (event) {
      if (event.detail && event.detail.taskId) {
        // Викликаємо функцію анімації
        animateSuccessfulCompletion(event.detail.taskId);
      }
    });

    // Обробник щоденного бонусу
    document.addEventListener('daily-bonus-claimed', function (event) {
      if (event.detail) {
        const { token_amount, day_reward, cycle_completed, completion_bonus } = event.detail;

        // Показуємо основну винагороду
        showDailyBonusReward(day_reward || 0, token_amount || 0, cycle_completed, completion_bonus);
      }
    });

    // Обробник зміни розміру вікна з дебаунсом
    window.addEventListener(
      'resize',
      debounce(function () {
        // Адаптуємо якість ефектів залежно від розміру екрану
        if (window.innerWidth < 768 && state.devicePerformance === 'high') {
          state.devicePerformance = 'medium';
          logger.info('Адаптовано режим продуктивності до розміру екрану', 'resizeHandler', {
            category: LOG_CATEGORIES.PERFORMANCE,
            details: { newMode: 'medium', width: window.innerWidth },
          });
        }
      }, 300)
    );

    // Очищення ресурсів при виході зі сторінки
    window.addEventListener('beforeunload', cleanup);

    logger.info('Встановлено обробники подій', 'setupEventHandlers', {
      category: LOG_CATEGORIES.INIT,
    });
  } catch (error) {
    logger.error(error, 'Помилка налаштування обробників подій', {
      category: LOG_CATEGORIES.INIT,
    });
  }
}

/**
 * Налаштування режиму продуктивності
 */
export function setPerformanceMode(mode) {
  if (['low', 'medium', 'high'].includes(mode)) {
    state.devicePerformance = mode;
    state.highQualityEffects = mode === 'high';

    try {
      localStorage.setItem('devicePerformance', mode);
    } catch (e) {
      logger.warn('Не вдалося зберегти режим продуктивності', 'setPerformanceMode', {
        category: LOG_CATEGORIES.STORAGE,
        details: { error: e.message },
      });
    }

    logger.info(`Встановлено режим продуктивності: ${mode}`, 'setPerformanceMode', {
      category: LOG_CATEGORIES.PERFORMANCE,
      details: { mode, highQuality: state.highQualityEffects },
    });

    return true;
  }

  logger.warn(`Неправильний режим продуктивності: ${mode}`, 'setPerformanceMode', {
    category: LOG_CATEGORIES.PERFORMANCE,
  });

  return false;
}

/**
 * Отримання поточних налаштувань
 */
export function getConfig() {
  return { ...config };
}

/**
 * Отримання поточного стану
 */
export function getState() {
  return {
    devicePerformance: state.devicePerformance,
    highQualityEffects: state.highQualityEffects,
    animationsInProgress: state.animationsInProgress,
    initialized: state.initialized,
  };
}

// Експортуємо публічне API модуля
export { state, config };