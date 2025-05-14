/**
 * ProgressCircle - UI компонент для відображення кругових прогрес-індикаторів
 * Відповідає за:
 * - Створення SVG-базованих кругових індикаторів прогресу
 * - Анімацію змін прогресу
 * - Інтерактивні функції для індикаторів
 *
 * @version 2.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/core/logger.js';
import { addEvent, removeEvent, onDOMReady } from '../../../utils/dom/events.js';
import { injectStyles } from '../../../utils/validation/form.js';
// Створюємо логер для модуля
const logger = getLogger('UI.ProgressCircle');

// Ініціалізуємо глобальний об'єкт UI, якщо його немає
window.UI = window.UI || {};

// Колекція прогрес-кругів з використанням Map для кращої продуктивності
const progressCircles = new Map();

// Стан модуля
const state = {
  idCounter: 0, // Лічильник для генерації ID
  activeAnimations: new Set(), // Активні анімації
  lastUpdateTime: 0, // Час останнього оновлення
};

// Налаштування за замовчуванням
const config = {
  animationDuration: 600, // Тривалість анімації в мс
  defaultStyle: 'default', // Стиль за замовчуванням
  defaultSize: 120, // Розмір за замовчуванням (px)
  strokeWidth: 8, // Товщина лінії (px)
  autoClasses: true, // Автоматичне додавання класів залежно від прогресу
  useTransition: true, // Використовувати CSS-переходи для анімації
  radius: 45, // Радіус кола
};

// Прапорець активності модуля
let isActive = false;

/**
 * Ініціалізація модуля прогрес-кругів
 * @param {Object} options - Налаштування
 */
function init(options = {}) {
  // Якщо модуль вже активний, спочатку деактивуємо його
  if (isActive) {
    deactivate();
  }

  logger.info('Ініціалізація модуля кругових індикаторів прогресу', 'init', {
    category: LOG_CATEGORIES.INIT,
  });

  // Відмічаємо модуль як активний
  isActive = true;

  // Оновлюємо налаштування
  Object.assign(config, options);

  // Додаємо стилі, якщо потрібно
  injectCircleStyles();

  // Ініціалізуємо існуючі прогрес-круги
  initializeExistingProgressCircles();

  // Налаштовуємо обробники подій
  setupEventListeners();
}

/**
 * Ін'єкція CSS стилів для кругових прогрес-індикаторів
 */
function injectCircleStyles() {
  // Перевіряємо, чи стилі вже додані
  if (document.getElementById('progress-circle-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'progress-circle-styles';

  // Оптимізований CSS
  styleElement.textContent = `
        .progress-circle-container {
            position: relative;
            display: inline-block;
        }
        
        .progress-circle {
            transform: rotate(-90deg);
            transform-origin: center;
            transition: stroke-dashoffset 0.5s ease;
        }
        
        .progress-circle-bg {
            fill: none;
            stroke: rgba(0, 0, 0, 0.1);
        }
        
        .progress-circle-value {
            fill: none;
            stroke: #4eb5f7;
            stroke-linecap: round;
        }
        
        .progress-circle-value.pulse {
            animation: progress-pulse 0.8s ease-out;
        }
        
        .progress-circle-text {
            font-family: Arial, sans-serif;
            font-size: 1rem;
            font-weight: bold;
            text-anchor: middle;
            dominant-baseline: central;
            fill: #333;
        }
        
        /* Кольори для різних станів прогресу */
        .progress-circle-value.success {
            stroke: #4CAF50;
        }
        
        .progress-circle-value.warning {
            stroke: #FFC107;
        }
        
        .progress-circle-value.danger {
            stroke: #FF5252;
        }
        
        @keyframes progress-pulse {
            0% { stroke-width: ${config.strokeWidth}px; }
            50% { stroke-width: ${config.strokeWidth + 2}px; }
            100% { stroke-width: ${config.strokeWidth}px; }
        }
    `;

  document.head.appendChild(styleElement);

  logger.debug('Додано стилі для кругових індикаторів', 'injectCircleStyles', {
    category: LOG_CATEGORIES.RENDERING,
  });
}

/**
 * Ініціалізація існуючих прогрес-кругів на сторінці
 */
function initializeExistingProgressCircles() {
  // Знаходимо всі контейнери прогрес-кругів
  const containers = document.querySelectorAll('.progress-circle-container');

  if (containers.length > 0) {
    logger.info(
      `Знайдено ${containers.length} кругових індикаторів на сторінці`,
      'initializeExistingProgressCircles',
      {
        category: LOG_CATEGORIES.INIT,
      }
    );

    // Ініціалізуємо кожен прогрес-круг
    containers.forEach((container) => {
      // Перевіряємо, чи прогрес-круг вже ініціалізований
      if (container.hasAttribute('data-progress-id')) return;

      // Генеруємо ID
      const id = ++state.idCounter;
      container.setAttribute('data-progress-id', id);

      // Отримуємо значення прогресу з атрибуту
      const progress = parseFloat(container.getAttribute('data-progress') || '0');

      // Створюємо або оновлюємо SVG
      const svg = container.querySelector('svg') || createCircleSVG(container, progress);

      // Зберігаємо прогрес-круг в колекції
      progressCircles.set(id, {
        container,
        svg,
        progress: progress,
        options: {
          size: parseInt(container.getAttribute('data-size') || config.defaultSize),
          showText: container.getAttribute('data-show-text') !== 'false',
        },
      });
    });
  }
}

/**
 * Створення SVG для кругового індикатора
 * @param {HTMLElement} container - Контейнер для індикатора
 * @param {number} progress - Початковий прогрес (0-100)
 * @param {Object} options - Додаткові опції
 * @returns {SVGElement} Створений SVG елемент
 */
function createCircleSVG(container, progress, options = {}) {
  const {
    size = config.defaultSize,
    strokeWidth = config.strokeWidth,
    radius = config.radius,
    showText = true,
  } = options;

  // Створюємо SVG елемент
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  // Центр SVG
  const cx = size / 2;
  const cy = size / 2;

  // Створюємо фоновий круг
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('class', 'progress-circle-bg');
  bgCircle.setAttribute('cx', cx);
  bgCircle.setAttribute('cy', cy);
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('stroke-width', strokeWidth);

  // Створюємо індикатор прогресу
  const valueCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  valueCircle.setAttribute('class', 'progress-circle-value');
  valueCircle.setAttribute('cx', cx);
  valueCircle.setAttribute('cy', cy);
  valueCircle.setAttribute('r', radius);
  valueCircle.setAttribute('stroke-width', strokeWidth);

  // Розраховуємо довжину кола
  const circumference = 2 * Math.PI * radius;

  // Встановлюємо dasharray і dashoffset для анімації прогресу
  valueCircle.setAttribute('stroke-dasharray', circumference);

  // Встановлюємо початковий прогрес
  const progressValue = Math.min(100, Math.max(0, progress));
  const dashOffset = circumference - (progressValue / 100) * circumference;
  valueCircle.setAttribute('stroke-dashoffset', dashOffset);

  // Додаємо елементи до SVG
  svg.appendChild(bgCircle);
  svg.appendChild(valueCircle);

  // Додаємо текст, якщо потрібно
  if (showText) {
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('class', 'progress-circle-text');
    textElement.setAttribute('x', cx);
    textElement.setAttribute('y', cy);
    textElement.textContent = `${Math.round(progressValue)}%`;
    svg.appendChild(textElement);
  }

  // Додаємо клас до SVG
  svg.classList.add('progress-circle');

  // Додаємо SVG в контейнер
  container.innerHTML = '';
  container.appendChild(svg);

  return svg;
}

/**
 * Налаштування обробників подій
 */
function setupEventListeners() {
  // Відстежуємо події оновлення прогресу
  addEvent(document, 'progress-circle-updated', handleProgressUpdated);

  // Очищення ресурсів при виході зі сторінки
  addEvent(window, 'beforeunload', cleanup);
}

/**
 * Обробник події оновлення прогресу
 */
function handleProgressUpdated(event) {
  if (event.detail && event.detail.id) {
    updateProgress(event.detail.id, event.detail.progress, event.detail.options);
  }
}

/**
 * Створення кругового індикатора прогресу
 * @param {HTMLElement|string} container - Контейнер або селектор
 * @param {Object} options - Параметри індикатора
 * @returns {number} ID індикатора
 */
function createProgressCircle(container, options = {}) {
  // Перевіряємо активність модуля
  if (!isActive) {
    logger.warn('Модуль не активний. Спочатку викличте init()', 'createProgressCircle', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return -1;
  }

  // Знаходимо контейнер
  let containerElement;

  if (typeof container === 'string') {
    containerElement = document.querySelector(container);
  } else {
    containerElement = container;
  }

  if (!containerElement) {
    logger.error('Не знайдено контейнер для індикатора', 'createProgressCircle', {
      category: LOG_CATEGORIES.RENDERING,
    });
    return -1;
  }

  // Параметри за замовчуванням
  const {
    progress = 0,
    size = config.defaultSize,
    strokeWidth = config.strokeWidth,
    radius = config.radius,
    showText = true,
    animated = true,
  } = options;

  // Перевіряємо, чи є вже індикатор в контейнері
  if (containerElement.hasAttribute('data-progress-id')) {
    // Якщо індикатор вже є, оновлюємо його
    const id = parseInt(containerElement.getAttribute('data-progress-id'));
    if (progressCircles.has(id)) {
      updateProgress(id, progress, options);
      return id;
    }
  }

  // Додаємо класи до контейнера
  containerElement.classList.add('progress-circle-container');
  containerElement.style.width = `${size}px`;
  containerElement.style.height = `${size}px`;

  // Генеруємо новий ID
  const id = ++state.idCounter;
  containerElement.setAttribute('data-progress-id', id);

  // Створюємо SVG
  const svg = createCircleSVG(containerElement, progress, {
    size,
    strokeWidth,
    radius,
    showText,
  });

  // Зберігаємо індикатор в колекції
  progressCircles.set(id, {
    container: containerElement,
    svg,
    progress,
    options: {
      size,
      strokeWidth,
      radius,
      showText,
      animated,
    },
  });

  logger.info(`Створено круговий індикатор з ID ${id}`, 'createProgressCircle', {
    category: LOG_CATEGORIES.RENDERING,
    details: { progress, size },
  });

  return id;
}

/**
 * Оновлення прогресу кругового індикатора
 * @param {number} id - ID індикатора
 * @param {number} progress - Новий прогрес (0-100)
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність оновлення
 */
function updateProgress(id, progress, options = {}) {
  // Перевіряємо активність модуля
  if (!isActive) {
    logger.warn('Модуль не активний. Спочатку викличте init()', 'updateProgress', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return false;
  }

  // Перевіряємо наявність індикатора
  if (!progressCircles.has(id)) {
    logger.warn(`Індикатор з ID ${id} не знайдено`, 'updateProgress', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return false;
  }

  const circle = progressCircles.get(id);

  // Отримуємо параметри
  const { animated = true, pulse = true } = Object.assign({}, circle.options, options);

  // Обчислюємо нове значення
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  // Перевіряємо, чи змінився прогрес
  if (normalizedProgress === circle.progress) {
    return true;
  }

  // Зберігаємо старий прогрес для порівняння
  const oldProgress = circle.progress;

  // Оновлюємо прогрес
  circle.progress = normalizedProgress;

  // Оновлюємо SVG
  const svg = circle.svg;
  if (!svg) return false;

  // Знаходимо елементи
  const valueCircle = svg.querySelector('.progress-circle-value');
  const textElement = svg.querySelector('.progress-circle-text');

  if (valueCircle) {
    // Розраховуємо довжину кола
    const radius = circle.options.radius || config.radius;
    const circumference = 2 * Math.PI * radius;

    // Обчислюємо новий dashoffset
    const dashOffset = circumference - (normalizedProgress / 100) * circumference;

    // Анімуємо зміну прогресу
    if (config.useTransition && animated) {
      valueCircle.style.transition = `stroke-dashoffset ${config.animationDuration}ms ease`;
    } else {
      valueCircle.style.transition = 'none';
    }

    valueCircle.setAttribute('stroke-dashoffset', dashOffset);

    // Додаємо анімацію пульсації, якщо прогрес збільшився
    if (animated && pulse && normalizedProgress > oldProgress) {
      valueCircle.classList.remove('pulse');
      // Змушуємо браузер зробити reflow
      void valueCircle.offsetWidth;
      valueCircle.classList.add('pulse');

      // Знімаємо клас після анімації
      setTimeout(() => {
        valueCircle.classList.remove('pulse');
      }, 800);
    }

    // Оновлюємо стилі в залежності від прогресу
    if (config.autoClasses) {
      updateClassesByProgress(valueCircle, normalizedProgress);
    }
  }

  // Оновлюємо текстовий елемент
  if (textElement && circle.options.showText) {
    textElement.textContent = `${Math.round(normalizedProgress)}%`;
  }

  logger.debug(
    `Оновлено прогрес індикатора ${id}: ${oldProgress}% -> ${normalizedProgress}%`,
    'updateProgress',
    {
      category: LOG_CATEGORIES.RENDERING,
    }
  );

  return true;
}

/**
 * Оновлення класів в залежності від прогресу
 * @param {SVGElement} element - SVG елемент для оновлення
 * @param {number} progress - Значення прогресу
 */
function updateClassesByProgress(element, progress) {
  // Знімаємо всі стани
  element.classList.remove('success', 'warning', 'danger');

  // Додаємо клас в залежності від прогресу
  if (progress >= 100) {
    element.classList.add('success');
  } else if (progress >= 75) {
    // Не додаємо клас для звичайного прогресу (75-99%)
  } else if (progress >= 25) {
    element.classList.add('warning');
  } else {
    element.classList.add('danger');
  }
}

/**
 * Отримання прогресу індикатора
 * @param {number} id - ID індикатора
 * @returns {number} Прогрес (0-100)
 */
function getProgress(id) {
  // Перевіряємо активність модуля
  if (!isActive) {
    logger.warn('Модуль не активний. Спочатку викличте init()', 'getProgress', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return 0;
  }

  if (!progressCircles.has(id)) {
    logger.warn(`Індикатор з ID ${id} не знайдено`, 'getProgress', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return 0;
  }

  return progressCircles.get(id).progress;
}

/**
 * Отримання всіх індикаторів
 * @returns {Map} Колекція індикаторів
 */
function getAllProgressCircles() {
  // Повертаємо копію карти, а не оригінал
  return new Map(progressCircles);
}

/**
 * Видалення індикатора
 * @param {number} id - ID індикатора
 * @returns {boolean} Успішність видалення
 */
function removeProgressCircle(id) {
  // Перевіряємо активність модуля
  if (!isActive) {
    logger.warn('Модуль не активний. Спочатку викличте init()', 'removeProgressCircle', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return false;
  }

  if (!progressCircles.has(id)) {
    logger.warn(`Індикатор з ID ${id} не знайдено`, 'removeProgressCircle', {
      category: LOG_CATEGORIES.LOGIC,
    });
    return false;
  }

  const circle = progressCircles.get(id);

  // Очищаємо контейнер
  if (circle.container) {
    circle.container.innerHTML = '';
    circle.container.removeAttribute('data-progress-id');
  }

  // Видаляємо з колекції
  progressCircles.delete(id);

  logger.info(`Видалено індикатор з ID ${id}`, 'removeProgressCircle', {
    category: LOG_CATEGORIES.RENDERING,
  });

  return true;
}

/**
 * Очищення ресурсів модуля
 */
function cleanup() {
  // Якщо модуль не активний, нічого не робимо
  if (!isActive) return;

  // Очищаємо активні анімації
  state.activeAnimations.clear();

  // Видаляємо обробники подій
  removeEvent(document, 'progress-circle-updated', handleProgressUpdated);
  removeEvent(window, 'beforeunload', cleanup);

  logger.info('Ресурси модуля очищено', 'cleanup', {
    category: LOG_CATEGORIES.LOGIC,
  });
}

/**
 * Деактивація модуля
 */
function deactivate() {
  // Очищаємо ресурси
  cleanup();

  // Знімаємо прапорець активності
  isActive = false;

  logger.info('Модуль деактивовано', 'deactivate', {
    category: LOG_CATEGORIES.INIT,
  });
}

// Ініціалізуємо модуль при завантаженні сторінки
onDOMReady(function () {
  if (!isActive) {
    init();
  }
});

// Публічний API модуля
const ProgressCircle = {
  init,
  createProgressCircle,
  updateProgress,
  getProgress,
  getAllProgressCircles,
  removeProgressCircle,
  cleanup,
  deactivate,
  isActive: () => isActive,
};

// Експортуємо API
window.UI.ProgressCircle = ProgressCircle;

export default ProgressCircle;
