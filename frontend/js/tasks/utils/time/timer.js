/**
 * Модуль для роботи з таймерами та зворотнім відліком
 *
 * Відповідає за:
 * - Управління таймерами зворотного відліку
 * - Відображення таймерів у DOM
 * - Обробку подій таймерів
 *
 * @version 1.0.0
 */

import { getLogger } from '../core/logger.js';
import { parseDate } from './date.js';
import { formatTimeLeft } from './format.js';

// Створюємо логер для модуля
const logger = getLogger('TimeTimer');

// Колекція таймерів з використанням Map для кращої продуктивності
const timers = new Map();

// Кеш DOM-елементів таймерів
const timerElements = new Map();

// Стан модуля
const state = {
  timerIdCounter: 0,      // Лічильник для генерації ID таймерів
  masterTimerId: null,    // ID головного таймера
  activeTimersCount: 0,   // Кількість активних таймерів
  lastUpdateTime: 0,      // Час останнього оновлення
  stylesInjected: false   // Прапорець для відстеження додавання стилів
};

// Налаштування за замовчуванням
const config = {
  updateInterval: 1000,      // Інтервал оновлення в мс
  autoCleanup: true,         // Автоматичне очищення таймерів
  useLocalTimezone: true,    // Використовувати локальний часовий пояс
  adjustForTimezone: true    // Коригувати відображення за часовим поясом
};

/**
 * Ініціалізація модуля
 * @param {Object} options - Параметри конфігурації
 */
export function init(options = {}) {
  // Оновлюємо налаштування
  Object.assign(config, options);

  logger.info("Ініціалізація модуля таймерів", "init");

  // Додаємо CSS стилі для таймерів, якщо потрібно
  if (!state.stylesInjected) {
    injectTimerStyles();
    state.stylesInjected = true;
  }

  // Ініціалізуємо існуючі таймери на сторінці
  initExistingTimers();

  // Очищаємо ресурси при виході зі сторінки
  window.addEventListener('beforeunload', cleanup);
}

/**
 * Ін'єкція CSS стилів для таймерів
 */
function injectTimerStyles() {
  if (document.getElementById('countdown-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'countdown-styles';

  styleElement.textContent = `
    /* Таймер зворотного відліку */
    .countdown-timer {
      display: inline-block;
      padding: 0.3125rem 0.625rem;
      border-radius: 0.625rem;
      font-weight: 600;
      transition: all 0.3s ease;
      position: relative;
    }
    
    .countdown-timer.active {
      color: #FFD700;
    }
    
    .countdown-timer.expired {
      color: #F44336;
    }
    
    .countdown-timer.expired-animation {
      animation: expired-pulse 0.5s ease-out 3;
    }
    
    .countdown-timer.warning {
      color: #FF9800;
    }
    
    .countdown-timer.critical {
      color: #FF5722;
      animation: critical-pulse 1s infinite;
    }
    
    @keyframes expired-pulse {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.1); opacity: 1; color: #FF0000; }
    }
    
    @keyframes critical-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  `;

  document.head.appendChild(styleElement);
  logger.debug("CSS стилі для таймерів додано", "injectTimerStyles");
}

/**
 * Ініціалізація існуючих таймерів на сторінці
 */
function initExistingTimers() {
  // Знаходимо всі елементи з атрибутом data-end-date
  const timerElements = document.querySelectorAll('[data-end-date]:not([data-timer-initialized])');

  if (timerElements.length > 0) {
    logger.info(`Знайдено ${timerElements.length} таймерів на сторінці`, "initExistingTimers");

    // Ініціалізуємо кожен таймер
    timerElements.forEach(element => {
      const endDate = element.getAttribute('data-end-date');
      const format = element.getAttribute('data-format') || 'short';
      const onComplete = element.getAttribute('data-on-complete');

      // Створюємо таймер для елемента
      createCountdown({
        element,
        endDate,
        format,
        onComplete: onComplete ? new Function(`return ${onComplete}`)() : null
      });

      // Позначаємо як ініціалізований
      element.setAttribute('data-timer-initialized', 'true');
    });
  }
}

/**
 * Запуск головного таймера
 */
function startMasterTimer() {
  if (state.masterTimerId !== null) return;

  // Використовуємо requestAnimationFrame для плавності
  function updateLoop(timestamp) {
    // Перевіряємо, чи минув інтервал оновлення
    const elapsed = timestamp - state.lastUpdateTime;

    if (elapsed >= config.updateInterval || state.lastUpdateTime === 0) {
      state.lastUpdateTime = timestamp;
      updateAllTimers();
    }

    // Продовжуємо цикл, якщо є активні таймери
    if (state.activeTimersCount > 0) {
      state.masterTimerId = requestAnimationFrame(updateLoop);
    } else {
      state.masterTimerId = null;
    }
  }

  // Запускаємо петлю оновлення
  state.masterTimerId = requestAnimationFrame(updateLoop);
}

/**
 * Оновлення всіх активних таймерів
 */
function updateAllTimers() {
  const now = new Date();
  const expiredTimers = [];

  // Оновлюємо кожен таймер
  timers.forEach((timer, timerId) => {
    // Перевіряємо, чи елемент все ще в DOM
    if (!timer.element || !timer.element.isConnected) {
      expiredTimers.push(timerId);
      return;
    }

    const timeLeft = timer.endDate - now;

    // Перевіряємо, чи не закінчився час
    if (timeLeft <= 0) {
      expiredTimers.push(timerId);
      return;
    }

    // Оновлюємо лише якщо минув інтервал оновлення для цього таймера
    if (now - timer.lastUpdate >= timer.updateFrequency) {
      updateTimerDisplay(timerId);

      // Оновлюємо час останнього оновлення
      timer.lastUpdate = now;

      // Адаптуємо частоту оновлення
      timer.updateFrequency = calculateUpdateFrequency(timeLeft);
    }
  });

  // Обробляємо таймери, час яких закінчився
  expiredTimers.forEach(timerId => {
    handleExpiredTimer(timerId);
  });
}

/**
 * Розрахунок оптимальної частоти оновлення таймера
 * @param {number} timeLeft - Залишок часу в мс
 * @returns {number} Частота оновлення в мс
 */
export function calculateUpdateFrequency(timeLeft) {
  // Адаптуємо частоту оновлення залежно від залишку часу
  if (timeLeft > 24 * 60 * 60 * 1000) { // > 24 години
    return 60000; // 1 хвилина
  } else if (timeLeft > 60 * 60 * 1000) { // > 1 година
    return 30000; // 30 секунд
  } else if (timeLeft > 5 * 60 * 1000) { // > 5 хвилин
    return 10000; // 10 секунд
  } else if (timeLeft > 60 * 1000) { // > 1 хвилина
    return 1000; // 1 секунда
  } else {
    return 500; // 0.5 секунди для останньої хвилини
  }
}

/**
 * Оновлення відображення конкретного таймера
 * @param {number} timerId - ID таймера
 * @param {boolean} force - Примусове оновлення
 */
function updateTimerDisplay(timerId, force = false) {
  const timer = timers.get(timerId);
  if (!timer || !timer.element) return;

  const now = new Date();
  const timeLeft = timer.endDate - now;

  // Примусово оновлюємо або якщо минув інтервал оновлення
  if (force || now - timer.lastUpdate >= timer.updateFrequency) {
    // Форматуємо залишок часу
    const formattedTime = formatTimeLeft(timeLeft, timer.format);

    // Оновлюємо текст елемента
    timer.element.textContent = formattedTime;

    // Додаємо класи залежно від залишку часу
    updateTimerClasses(timer.element, timeLeft);

    // Викликаємо колбек оновлення
    if (typeof timer.onTick === 'function') {
      timer.onTick(formattedTime, timeLeft);
    }
  }
}

/**
 * Оновлення класів таймера
 * @param {HTMLElement} element - Елемент таймера
 * @param {number} timeLeft - Залишок часу
 */
function updateTimerClasses(element, timeLeft) {
  // Знімаємо класи станів
  element.classList.remove('warning', 'critical');

  // Додаємо класи залежно від залишку часу
  if (timeLeft < 60 * 1000) { // Менше хвилини
    element.classList.add('critical');
  } else if (timeLeft < 5 * 60 * 1000) { // Менше 5 хвилин
    element.classList.add('warning');
  }
}

/**
 * Обробка таймера, час якого закінчився
 * @param {number} timerId - ID таймера
 */
function handleExpiredTimer(timerId) {
  const timer = timers.get(timerId);
  if (!timer) return;

  // Оновлюємо елемент, щоб показати закінчення
  if (timer.element && timer.element.isConnected) {
    timer.element.textContent = 'Закінчено';
    timer.element.classList.remove('active', 'warning', 'critical');
    timer.element.classList.add('expired');

    // Генеруємо подію закінчення таймера
    timer.element.dispatchEvent(new CustomEvent('timer-expired', {
      bubbles: true,
      detail: { timerId }
    }));

    // Викликаємо колбек завершення
    if (typeof timer.onComplete === 'function') {
      timer.onComplete();
    }
  }

  // Видаляємо таймер і зв'язки з елементом
  timers.delete(timerId);
  timerElements.delete(timerId);
  state.activeTimersCount--;

  logger.debug(`Таймер #${timerId} завершено`, "handleExpiredTimer");
}

/**
 * Створення таймера зворотного відліку
 * @param {Object} options - Опції таймера
 * @returns {number} ID таймера
 */
export function createCountdown(options) {
  const {
    element,
    endDate,
    format = 'short',
    onTick,
    onComplete
  } = options;

  // Перевіряємо наявність елемента
  let targetElement = element;
  if (typeof element === 'string') {
    targetElement = document.querySelector(element);
  }

  if (!targetElement) {
    logger.error('Не знайдено елемент для таймера', 'createCountdown');
    return -1;
  }

  // Перевіряємо кінцеву дату
  const endDateTime = parseDate(endDate);
  if (!endDateTime || isNaN(endDateTime.getTime())) {
    logger.error('Невірна кінцева дата для таймера', 'createCountdown', { endDate });
    return -1;
  }

  // Перевіряємо, чи не минула дата
  const now = new Date();
  if (endDateTime <= now) {
    // Якщо дата вже минула
    targetElement.textContent = 'Закінчено';
    targetElement.classList.add('expired');

    // Викликаємо колбек завершення
    if (typeof onComplete === 'function') {
      onComplete();
    }

    return -1;
  }

  // Генеруємо унікальний ID
  const timerId = ++state.timerIdCounter;

  // Додаємо клас і атрибут до елемента
  targetElement.classList.add('countdown-timer', 'active');
  targetElement.setAttribute('data-timer-id', timerId);

  // Визначаємо частоту оновлення на основі залишку часу
  const timeLeft = endDateTime - now;
  const updateFrequency = calculateUpdateFrequency(timeLeft);

  // Зберігаємо інформацію про таймер
  timers.set(timerId, {
    endDate: endDateTime,
    element: targetElement,
    format,
    onTick,
    onComplete,
    updateFrequency,
    lastUpdate: now
  });

  // Кешуємо елемент для швидкого доступу
  timerElements.set(timerId, targetElement);

  // Збільшуємо лічильник активних таймерів
  state.activeTimersCount++;

  // Запускаємо головний таймер, якщо потрібно
  if (state.masterTimerId === null) {
    startMasterTimer();
  }

  // Форматуємо та відображаємо поточний час
  updateTimerDisplay(timerId, true);

  logger.debug(`Створено таймер #${timerId}`, "createCountdown", {
    endDate: endDateTime.toISOString(),
    format
  });

  return timerId;
}

/**
 * Зупинка таймера зворотного відліку
 * @param {number} timerId - ID таймера
 * @returns {boolean} Успішність операції
 */
export function stopCountdown(timerId) {
  const timer = timers.get(timerId);
  if (!timer) return false;

  // Видаляємо зв'язок з DOM елементом
  if (timer.element) {
    timer.element.removeAttribute('data-timer-id');
    timer.element.classList.remove('active', 'warning', 'critical');
  }

  // Видаляємо таймер і зв'язки
  timers.delete(timerId);
  timerElements.delete(timerId);
  state.activeTimersCount--;

  logger.debug(`Зупинено таймер #${timerId}`, "stopCountdown");

  return true;
}

/**
 * Зупинка всіх таймерів
 */
export function stopAllCountdowns() {
  // Зупиняємо всі таймери
  timers.forEach((_, timerId) => {
    stopCountdown(timerId);
  });

  // Очищаємо всі кешовані дані
  timers.clear();
  timerElements.clear();
  state.activeTimersCount = 0;

  // Зупиняємо головний таймер
  if (state.masterTimerId !== null) {
    cancelAnimationFrame(state.masterTimerId);
    state.masterTimerId = null;
  }

  logger.info("Зупинено всі таймери", "stopAllCountdowns");
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
  stopAllCountdowns();
  logger.info('Ресурси модуля таймерів очищено', 'cleanup');
}

/**
 * Створення простого таймера зворотнього відліку
 * @param {HTMLElement} element - DOM елемент для відображення
 * @param {string|Date} endDate - Кінцева дата
 * @param {Function} onComplete - Функція, яка викликається при завершенні
 * @returns {number} ID інтервалу для очистки
 */
export function createSimpleCountdown(element, endDate, onComplete) {
  // Парсимо кінцеву дату
  const endDateTime = parseDate(endDate);
  if (!endDateTime) return -1;

  // Початкове відображення
  updateSimpleTimerDisplay(element, endDateTime);

  // Створюємо інтервал для оновлення
  const intervalId = setInterval(() => {
    const now = new Date();
    const timeLeft = endDateTime - now;

    if (timeLeft <= 0) {
      // Таймер закінчився
      clearInterval(intervalId);
      element.textContent = 'Закінчено';
      element.classList.add('expired');

      // Викликаємо обробник завершення
      if (typeof onComplete === 'function') {
        onComplete();
      }
    } else {
      // Оновлюємо відображення
      updateSimpleTimerDisplay(element, endDateTime);
    }
  }, 1000);

  // Зберігаємо ID інтервалу для подальшого очищення
  element.dataset.timerId = intervalId;

  logger.debug("Створено простий таймер", "createSimpleCountdown", {
    endDate: endDateTime.toISOString()
  });

  return intervalId;
}

/**
 * Оновлення відображення простого таймера
 * @param {HTMLElement} element - DOM елемент для відображення
 * @param {Date} endDate - Кінцева дата
 */
export function updateSimpleTimerDisplay(element, endDate) {
  const now = new Date();
  const timeLeft = endDate - now;

  if (timeLeft <= 0) {
    element.textContent = 'Закінчено';
    return;
  }

  element.textContent = formatTimeLeft(timeLeft, 'short');
}

/**
 * Перевірка, чи закінчився час таймера
 * @param {number} timerId - ID таймера
 * @returns {boolean} Чи закінчився час
 */
export function isExpired(timerId) {
  const timer = timers.get(timerId);
  if (!timer) return true;

  const now = new Date();
  return timer.endDate <= now;
}

/**
 * Отримання залишку часу в мс
 * @param {number} timerId - ID таймера
 * @returns {number} Залишок часу в мс
 */
export function getTimeLeft(timerId) {
  const timer = timers.get(timerId);
  if (!timer) return -1;

  const now = new Date();
  const timeLeft = timer.endDate - now;

  return Math.max(0, timeLeft);
}

/**
 * Оновлення конфігурації модуля
 * @param {Object} newConfig - Нові налаштування
 * @returns {Object} Поточна конфігурація
 */
export function updateConfig(newConfig = {}) {
  Object.assign(config, newConfig);
  logger.debug("Оновлено конфігурацію таймерів", "updateConfig", { newConfig });
  return { ...config };
}

// Експорт основних функцій та конфігурацій
export default {
  init,
  cleanup,
  updateConfig,
  createCountdown,
  createSimpleCountdown,
  stopCountdown,
  stopAllCountdowns,
  getTimeLeft,
  isExpired,
  calculateUpdateFrequency,

  // Експортуємо конфігурацію як readonly
  get config() {
    return { ...config };
  }
};