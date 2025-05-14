/**
 * ProgressBar - оптимізований UI компонент для відображення прогрес-барів
 * Відповідає за:
 * - Ефективне відображення візуального прогресу
 * - Анімацію змін прогресу
 * - API для інтеграції з завданнями
 *
 * @version 3.0.0
 */

import { addEvent, removeEvent, onDOMReady } from '../../../utils/dom/events.js';
import { injectStyles } from '../../../utils/validation/form.js';
// Ініціалізуємо глобальний об'єкт UI, якщо його немає
window.UI = window.UI || {};

// Колекція прогрес-барів з використанням Map для кращої продуктивності
const progressBars = new Map();

// Кеш DOM-елементів
const timerElements = new Map();

// Стан модуля
const state = {
  timerIdCounter: 0, // Лічильник для генерації ID таймерів
  activeTimersCount: 0, // Кількість активних таймерів
  lastUpdateTime: 0, // Час останнього оновлення
};

// Налаштування за замовчуванням
const config = {
  animationDuration: 500, // Тривалість анімації в мс
  defaultStyle: 'default', // Стиль за замовчуванням
  defaultSize: 'default', // Розмір за замовчуванням
  autoClasses: true, // Автоматичне додавання класів залежно від прогресу
  useTransition: true, // Використовувати CSS-переходи для анімації
};

// Прапорець активності модуля
let isActive = false;

/**
 * Ініціалізація модуля прогрес-барів
 * @param {Object} options - Налаштування
 */
function init(options = {}) {
  // Якщо модуль вже активний, спочатку деактивуємо його
  if (isActive) {
    deactivate();
  }

  console.log('UI.ProgressBar: Ініціалізація модуля прогрес-барів');

  // Відмічаємо модуль як активний
  isActive = true;

  // Оновлюємо налаштування
  Object.assign(config, options);

  // Додаємо стилі, якщо потрібно
  injectStyles();

  // Ініціалізуємо існуючі прогрес-бари
  initializeExistingProgressBars();

  // Налаштовуємо обробники подій
  setupEventListeners();
}

/**
 * Ініціалізація існуючих прогрес-барів на сторінці
 */
function initializeExistingProgressBars() {
  // Знаходимо всі контейнери прогрес-барів
  const containers = document.querySelectorAll('.progress-bar-container');

  if (containers.length > 0) {
    console.log(`UI.ProgressBar: Знайдено ${containers.length} прогрес-барів на сторінці`);

    // Ініціалізуємо кожен прогрес-бар
    containers.forEach((container) => {
      // Перевіряємо, чи прогрес-бар вже ініціалізований
      if (container.hasAttribute('data-progress-id')) return;

      // Створюємо наповнення, якщо його немає
      if (!container.querySelector('.progress-bar-fill')) {
        const fill = document.createElement('div');
        fill.className = 'progress-bar-fill';

        // Отримуємо значення прогресу з атрибуту
        const progress = parseFloat(container.getAttribute('data-progress') || '0');
        fill.style.width = `${progress}%`;

        container.appendChild(fill);
      }

      // Генеруємо ID
      const id = ++state.timerIdCounter;
      container.setAttribute('data-progress-id', id);

      // Зберігаємо прогрес-бар в колекції
      const fill = container.querySelector('.progress-bar-fill');
      progressBars.set(id, {
        container,
        fill,
        progress: parseFloat(fill.style.width) || 0,
        maxValue: 100,
        currentValue: parseFloat(fill.style.width) || 0,
      });
    });
  }
}

/**
 * Налаштування обробників подій
 */
function setupEventListeners() {
  // Відстежуємо події додавання прогрес-барів
  addEvent(document, 'progress-bar-added', handleProgressBarAdded);

  // Відстежуємо події оновлення прогресу
  addEvent(document, 'progress-updated', handleProgressUpdated);

  // Очищення ресурсів при виході зі сторінки
  addEvent(window, 'beforeunload', cleanup);
}

/**
 * Обробник події додавання прогрес-бару
 */
function handleProgressBarAdded(event) {
  if (event.detail && event.detail.container) {
    createProgressBar(event.detail.container, event.detail.options);
  }
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
 * Створення прогрес-бару
 * @param {HTMLElement|string} container - Контейнер або селектор
 * @param {Object} options - Параметри прогрес-бару
 * @returns {number} ID прогрес-бару
 */
function createProgressBar(container, options = {}) {
  // Перевіряємо активність модуля
  if (!isActive) {
    console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
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
    console.error('UI.ProgressBar: Не знайдено контейнер для прогрес-бару');
    return -1;
  }

  // Параметри за замовчуванням
  const {
    progress = 0,
    size = config.defaultSize,
    style = config.defaultStyle,
    showText = false,
    label = '',
    maxValue = 100,
    currentValue = 0,
    animated = true,
  } = options;

  // Перевіряємо, чи є вже прогрес-бар в контейнері
  if (containerElement.hasAttribute('data-progress-id')) {
    // Якщо прогрес-бар вже є, оновлюємо його
    const id = parseInt(containerElement.getAttribute('data-progress-id'));
    if (progressBars.has(id)) {
      updateProgress(id, progress, options);
      return id;
    }
  }

  // Генеруємо новий ID
  const id = ++state.timerIdCounter;

  // Додаємо класи до контейнера
  containerElement.classList.add('progress-bar-container');
  if (size !== 'default') {
    containerElement.classList.add(size);
  }
  if (style !== 'default') {
    containerElement.classList.add(style);
  }

  // Зберігаємо ID
  containerElement.setAttribute('data-progress-id', id);

  // Додаємо текстову мітку, якщо потрібно
  if (showText) {
    let textContainer;

    if (!containerElement.parentNode.querySelector('.progress-text')) {
      textContainer = document.createElement('div');
      textContainer.className = 'progress-text';
      containerElement.parentNode.insertBefore(textContainer, containerElement);
    } else {
      textContainer = containerElement.parentNode.querySelector('.progress-text');
    }

    textContainer.innerHTML = `
            <span class="progress-label">${escapeHTML(label)}</span>
            <span class="progress-value">${currentValue}/${maxValue}</span>
        `;
  }

  // Створюємо заповнення прогрес-бару
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-bar-fill';

  // Встановлюємо початковий прогрес
  const progressValue = Math.min(100, Math.max(0, progress));
  progressFill.style.width = `${progressValue}%`;

  // Додаємо анімацію, якщо потрібно
  if (animated) {
    progressFill.classList.add('glow');
  }

  // Додаємо заповнення в контейнер
  containerElement.appendChild(progressFill);

  // Зберігаємо прогрес-бар
  progressBars.set(id, {
    container: containerElement,
    fill: progressFill,
    progress: progressValue,
    maxValue,
    currentValue,
    options,
  });

  return id;
}

/**
 * Оновлення прогресу
 * @param {number} id - ID прогрес-бару
 * @param {number} progress - Новий прогрес (0-100)
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність оновлення
 */
function updateProgress(id, progress, options = {}) {
  // Перевіряємо активність модуля
  if (!isActive) {
    console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
    return false;
  }

  // Перевіряємо наявність прогрес-бару
  if (!progressBars.has(id)) {
    console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
    return false;
  }

  const progressBar = progressBars.get(id);

  // Отримуємо параметри
  const {
    animated = true,
    pulse = true,
    maxValue,
    currentValue,
  } = Object.assign({}, progressBar.options, options);

  // Обчислюємо нове значення
  let newProgress = progress;

  // Якщо передано maxValue і currentValue, обчислюємо прогрес
  if (maxValue !== undefined && currentValue !== undefined) {
    newProgress = Math.min(100, Math.max(0, (currentValue / maxValue) * 100));

    // Оновлюємо текстові мітки, якщо є
    updateProgressText(progressBar.container, currentValue, maxValue);

    // Зберігаємо нові значення
    progressBar.maxValue = maxValue;
    progressBar.currentValue = currentValue;
  } else {
    newProgress = Math.min(100, Math.max(0, progress));
  }

  // Перевіряємо, чи змінився прогрес
  if (newProgress === progressBar.progress) {
    return true;
  }

  // Зберігаємо старий прогрес для порівняння
  const oldProgress = progressBar.progress;

  // Оновлюємо прогрес
  progressBar.progress = newProgress;

  // Якщо потрібно використовувати CSS-переходи
  if (config.useTransition) {
    progressBar.fill.style.width = `${newProgress}%`;
  } else {
    // Без переходів для миттєвого оновлення
    progressBar.fill.style.transition = 'none';
    progressBar.fill.style.width = `${newProgress}%`;

    // Змушуємо браузер виконати reflow для застосування змін
    void progressBar.fill.offsetWidth;

    // Відновлюємо перехід для майбутніх оновлень
    progressBar.fill.style.transition = '';
  }

  // Додаємо анімацію пульсації, якщо прогрес збільшився
  if (animated && pulse && newProgress > oldProgress) {
    progressBar.fill.classList.add('pulse');
    setTimeout(() => {
      progressBar.fill.classList.remove('pulse');
    }, 1200);
  }

  // Оновлюємо стилі в залежності від прогресу, якщо потрібно
  if (config.autoClasses) {
    updateProgressBarClasses(progressBar.container, newProgress);
  }

  return true;
}

/**
 * Оновлення текстових міток прогрес-бару
 * @param {HTMLElement} container - Контейнер прогрес-бару
 * @param {number} currentValue - Поточне значення
 * @param {number} maxValue - Максимальне значення
 */
function updateProgressText(container, currentValue, maxValue) {
  const textContainer = container.parentNode.querySelector('.progress-text');
  if (!textContainer) return;

  const valueElement = textContainer.querySelector('.progress-value');
  if (valueElement) {
    valueElement.textContent = `${currentValue}/${maxValue}`;
  }
}

/**
 * Оновлення класів прогрес-бару в залежності від прогресу
 * @param {HTMLElement} container - Контейнер прогрес-бару
 * @param {number} progress - Значення прогресу
 */
function updateProgressBarClasses(container, progress) {
  // Знімаємо всі стани
  container.classList.remove('success', 'warning', 'danger');

  // Додаємо клас в залежності від прогресу
  if (progress >= 100) {
    container.classList.add('success');
  } else if (progress >= 75) {
    // Не додаємо клас для звичайного прогресу (75-99%)
  } else if (progress >= 25) {
    container.classList.add('warning');
  } else {
    container.classList.add('danger');
  }
}

/**
 * Отримання прогресу
 * @param {number} id - ID прогрес-бару
 * @returns {number} Прогрес (0-100)
 */
function getProgress(id) {
  // Перевіряємо активність модуля
  if (!isActive) {
    console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
    return 0;
  }

  if (!progressBars.has(id)) {
    console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
    return 0;
  }

  return progressBars.get(id).progress;
}

/**
 * Отримання всіх прогрес-барів
 * @returns {Map} Колекція прогрес-барів
 */
function getAllProgressBars() {
  // Повертаємо копію карти, а не оригінал
  return new Map(progressBars);
}

/**
 * Видалення прогрес-бару
 * @param {number} id - ID прогрес-бару
 * @returns {boolean} Успішність видалення
 */
function removeProgressBar(id) {
  // Перевіряємо активність модуля
  if (!isActive) {
    console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
    return false;
  }

  if (!progressBars.has(id)) {
    console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
    return false;
  }

  const progressBar = progressBars.get(id);

  // Видаляємо заповнення з DOM
  if (progressBar.fill && progressBar.fill.parentNode) {
    progressBar.fill.remove();
  }

  // Видаляємо атрибут ID
  if (progressBar.container) {
    progressBar.container.removeAttribute('data-progress-id');
  }

  // Видаляємо з колекції
  progressBars.delete(id);

  return true;
}

/**
 * Функція для безпечного виведення HTML
 */
function escapeHTML(text) {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Очищення ресурсів модуля
 */
function cleanup() {
  // Якщо модуль не активний, нічого не робимо
  if (!isActive) return;

  // Очищаємо DOM-зв'язки для уникнення витоків пам'яті
  progressBars.forEach((progressBar, id) => {
    if (progressBar.container) {
      progressBar.container.removeAttribute('data-progress-id');
    }
    // Явно знищуємо посилання на DOM-елементи
    progressBar.container = null;
    progressBar.fill = null;
  });

  // Очищаємо всі прогрес-бари
  progressBars.clear();
  state.timerIdCounter = 0;

  console.log('UI.ProgressBar: Ресурси модуля очищено');
}

/**
 * Деактивація модуля - публічний метод для зовнішнього контролю
 * життєвого циклу компонента
 */
function deactivate() {
  // Видаляємо обробники подій
  removeEvent(document, 'progress-bar-added', handleProgressBarAdded);
  removeEvent(document, 'progress-updated', handleProgressUpdated);
  removeEvent(window, 'beforeunload', cleanup);

  // Очищаємо ресурси
  cleanup();

  // Встановлюємо прапорець деактивації
  const wasActive = isActive;
  isActive = false;

  // Сповіщаємо про деактивацію
  if (wasActive) {
    document.dispatchEvent(new CustomEvent('progress-bar-deactivated'));
  }

  console.log('UI.ProgressBar: Модуль деактивовано');
}

// Ініціалізуємо модуль при завантаженні сторінки
onDOMReady(function () {
  // Перевіряємо, чи не було запущено ініціалізацію раніше
  if (!isActive) {
    init();
  }
});

// Публічний API модуля
const ProgressBar = {
  init,
  createProgressBar,
  updateProgress,
  getProgress,
  getAllProgressBars,
  removeProgressBar,
  cleanup,
  deactivate,
  isActive: () => isActive,
};

// Експортуємо API
window.UI.ProgressBar = ProgressBar;

export default ProgressBar;
