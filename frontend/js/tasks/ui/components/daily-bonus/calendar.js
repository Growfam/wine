/**
 * DailyBonusCalendar - компонент календаря для щоденного бонусу
 *
 * Відповідає за:
 * - Візуалізацію циклу щоденних бонусів
 * - Відображення поточного прогресу
 * - Виділення особливих днів
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/core/logger.js';
import { DAILY_BONUS_TYPES, DAILY_BONUS_CONFIG } from '../../../config/types/daily-bonus-types.js';

// Створюємо логер для модуля
const logger = getLogger('UI.DailyBonusCalendar');

// Іконки для днів
const DAY_ICONS = {
  done: '✓', // Завершений день
  current: '!', // Поточний день
  pending: '', // Майбутній день
  special: '$', // День з особливою винагородою (жетони)
  completion: '★', // День завершення циклу
};

/**
 * Клас компонента календаря щоденних бонусів
 */
class DailyBonusCalendar {
  /**
   * Конструктор
   * @param {Object} options - Налаштування
   */
  constructor(options = {}) {
    // Налаштування
    this.options = {
      container: null, // Контейнер для рендерингу
      currentDay: 1, // Поточний день (1-7)
      onDayClick: null, // Обробник кліку на день
      cycleSize: DAILY_BONUS_CONFIG.CYCLE_DAYS, // Розмір циклу (7 днів)
      inline: false, // Чи вбудований календар
      highlightToday: true, // Підсвічувати поточний день
      interactive: false, // Чи можна взаємодіяти з днями
      specialDays: DAILY_BONUS_CONFIG.COIN_DAYS, // Дні з особливою винагородою
      theme: 'default', // Тема оформлення
      ...options,
    };

    // Внутрішній стан
    this.state = {
      elementId: `daily-bonus-calendar-${Date.now()}`, // ID елемента
      initialized: false, // Чи ініціалізовано
      days: [], // Масив елементів днів
      animationInProgress: false, // Чи відбувається анімація
      updating: false, // Чи відбувається оновлення
    };

    // Ініціалізуємо, якщо є контейнер
    if (this.options.container) {
      this.initialize(this.options.container);
    }
  }

  /**
   * Ініціалізація календаря
   * @param {HTMLElement|string} container - Контейнер для рендерингу
   * @returns {boolean} Результат ініціалізації
   */
  initialize(container) {
    try {
      // Шукаємо контейнер
      if (typeof container === 'string') {
        container = document.querySelector(container);
      }

      if (!container) {
        logger.warn('Контейнер для календаря не знайдено', 'initialize', {
          category: LOG_CATEGORIES.RENDERING,
        });
        return false;
      }

      // Зберігаємо контейнер
      this.options.container = container;

      // Рендеримо календар
      this.render();

      // Прив'язуємо обробники подій
      this._bindEvents();

      // Позначаємо ініціалізацію
      this.state.initialized = true;

      logger.info('Календар щоденного бонусу ініціалізовано', 'initialize', {
        category: LOG_CATEGORIES.INIT,
      });

      return true;
    } catch (error) {
      logger.error(error, 'Помилка ініціалізації календаря', {
        category: LOG_CATEGORIES.INIT,
      });

      return false;
    }
  }

  /**
   * Рендеринг календаря
   */
  render() {
    try {
      const container = this.options.container;
      if (!container) return;

      // Очищаємо контейнер
      container.innerHTML = '';

      // Створюємо обгортку для календаря
      const calendarElement = document.createElement('div');
      calendarElement.id = this.state.elementId;
      calendarElement.className = `daily-bonus-calendar ${this.options.theme} ${this.options.inline ? 'inline' : ''}`;

      // Створюємо заголовок
      const heading = document.createElement('div');
      heading.className = 'daily-bonus-calendar-header';
      heading.innerHTML = `<h3>ЩОДЕННИЙ БОНУС - ДЕНЬ ${this.options.currentDay} з ${this.options.cycleSize}</h3>`;
      calendarElement.appendChild(heading);

      // Створюємо контейнер для днів
      const daysContainer = document.createElement('div');
      daysContainer.className = 'daily-bonus-calendar-days';

      // Створюємо елементи днів
      this.state.days = [];

      for (let i = 1; i <= this.options.cycleSize; i++) {
        const dayElement = this._createDayElement(i);
        daysContainer.appendChild(dayElement);
        this.state.days.push(dayElement);
      }

      calendarElement.appendChild(daysContainer);

      // Додаємо підказку
      const hint = document.createElement('div');
      hint.className = 'daily-bonus-calendar-hint';
      hint.textContent = 'Отримайте бонус за відвідування 7 днів поспіль';
      calendarElement.appendChild(hint);

      // Додаємо до контейнера
      container.appendChild(calendarElement);

      logger.debug('Календар щоденного бонусу відрендерено', 'render', {
        category: LOG_CATEGORIES.RENDERING,
      });
    } catch (error) {
      logger.error(error, 'Помилка рендерингу календаря', {
        category: LOG_CATEGORIES.RENDERING,
      });
    }
  }

  /**
   * Створення елемента дня
   * @param {number} day - Номер дня (1-7)
   * @returns {HTMLElement} Елемент дня
   * @private
   */
  _createDayElement(day) {
    // Створюємо елемент
    const dayElement = document.createElement('div');
    dayElement.className = 'daily-bonus-calendar-day';
    dayElement.dataset.day = day;

    // Визначаємо статус дня
    let status = 'pending';
    if (day < this.options.currentDay) {
      status = 'done';
    } else if (day === this.options.currentDay) {
      status = 'current';
    }

    // Особливий день з жетонами
    const isSpecialDay = this.options.specialDays.includes(day);

    // День завершення циклу
    const isCompletionDay = day === this.options.cycleSize;

    // Додаємо класи
    dayElement.classList.add(`status-${status}`);
    if (isSpecialDay) dayElement.classList.add('special-day');
    if (isCompletionDay) dayElement.classList.add('completion-day');

    // Додаємо вміст
    let icon = DAY_ICONS[status] || '';
    if (isSpecialDay && status !== 'done') icon = DAY_ICONS.special;
    if (isCompletionDay && status !== 'done') icon = DAY_ICONS.completion;

    dayElement.innerHTML = `
      <div class="day-number">${day}</div>
      <div class="day-icon">${icon}</div>
    `;

    // Додаємо обробник кліку, якщо потрібно
    if (this.options.interactive) {
      dayElement.classList.add('interactive');
    }

    return dayElement;
  }

  /**
   * Прив'язка обробників подій
   * @private
   */
  _bindEvents() {
    try {
      // Прив'язуємо обробники кліку на дні, якщо календар інтерактивний
      if (this.options.interactive && typeof this.options.onDayClick === 'function') {
        const calendar = document.getElementById(this.state.elementId);
        if (calendar) {
          const days = calendar.querySelectorAll('.daily-bonus-calendar-day');

          days.forEach((day) => {
            day.addEventListener('click', (event) => {
              // Отримуємо номер дня
              const dayNumber = parseInt(day.dataset.day, 10);

              // Викликаємо обробник
              this.options.onDayClick(dayNumber, day, event);
            });
          });
        }
      }

      logger.debug("Обробники подій для календаря прив'язано", '_bindEvents');
    } catch (error) {
      logger.error(error, "Помилка прив'язки обробників подій", {
        category: LOG_CATEGORIES.EVENTS,
      });
    }
  }

  /**
   * Оновлення календаря
   * @param {Object} options - Опції для оновлення
   */
  update(options = {}) {
    if (this.state.updating) return;

    try {
      this.state.updating = true;

      // Оновлюємо опції
      if (options.currentDay !== undefined) {
        this.options.currentDay = options.currentDay;
      }

      if (options.cycleSize !== undefined) {
        this.options.cycleSize = options.cycleSize;
      }

      if (options.specialDays !== undefined) {
        this.options.specialDays = options.specialDays;
      }

      if (options.theme !== undefined) {
        this.options.theme = options.theme;
      }

      // Перерендерюємо
      this.render();

      // Прив'язуємо обробники подій знову
      this._bindEvents();

      logger.info('Календар щоденного бонусу оновлено', 'update', {
        category: LOG_CATEGORIES.RENDERING,
        details: {
          currentDay: this.options.currentDay,
          cycleSize: this.options.cycleSize,
        },
      });
    } catch (error) {
      logger.error(error, 'Помилка оновлення календаря', {
        category: LOG_CATEGORIES.RENDERING,
      });
    } finally {
      this.state.updating = false;
    }
  }

  /**
   * Підсвічування дня
   * @param {number} day - Номер дня (1-7)
   * @param {string} highlightClass - Клас підсвічування
   * @param {number} duration - Тривалість анімації (мс)
   */
  highlightDay(day, highlightClass = 'highlight', duration = 2000) {
    try {
      if (day < 1 || day > this.options.cycleSize) return;

      // Отримуємо елемент дня
      const dayElement = this.state.days[day - 1];
      if (!dayElement) return;

      // Додаємо клас підсвічування
      dayElement.classList.add(highlightClass);

      // Видаляємо клас після завершення анімації
      setTimeout(() => {
        dayElement.classList.remove(highlightClass);
      }, duration);

      logger.debug(`Підсвічування дня ${day}`, 'highlightDay', {
        category: LOG_CATEGORIES.ANIMATION,
      });
    } catch (error) {
      logger.error(error, 'Помилка підсвічування дня', {
        category: LOG_CATEGORIES.ANIMATION,
      });
    }
  }

  /**
   * Анімація переходу до наступного дня
   * @param {Function} callback - Функція, яка викликається після анімації
   */
  animateNextDay(callback) {
    try {
      if (this.state.animationInProgress) return;

      this.state.animationInProgress = true;

      // Отримуємо поточний і наступний дні
      const currentDay = this.options.currentDay;
      const nextDay = currentDay < this.options.cycleSize ? currentDay + 1 : 1;

      // Отримуємо елементи днів
      const currentDayElement = this.state.days[currentDay - 1];
      const nextDayElement = this.state.days[nextDay - 1];

      if (!currentDayElement || !nextDayElement) {
        this.state.animationInProgress = false;
        if (typeof callback === 'function') callback();
        return;
      }

      // Анімуємо завершення поточного дня
      currentDayElement.classList.add('animated', 'done');
      currentDayElement.classList.remove('current');

      // Змінюємо іконку
      const currentDayIcon = currentDayElement.querySelector('.day-icon');
      if (currentDayIcon) {
        currentDayIcon.textContent = DAY_ICONS.done;
      }

      // Через 700мс анімуємо початок наступного дня
      setTimeout(() => {
        // Змінюємо внутрішній стан
        this.options.currentDay = nextDay;

        // Анімуємо новий поточний день
        nextDayElement.classList.add('animated', 'current');
        nextDayElement.classList.remove('pending');

        // Змінюємо іконку
        const nextDayIcon = nextDayElement.querySelector('.day-icon');
        if (nextDayIcon) {
          // Визначаємо іконку в залежності від типу дня
          let icon = DAY_ICONS.current;

          if (this.options.specialDays.includes(nextDay)) {
            icon = DAY_ICONS.special;
          }

          if (nextDay === this.options.cycleSize) {
            icon = DAY_ICONS.completion;
          }

          nextDayIcon.textContent = icon;
        }

        // Оновлюємо заголовок
        const header = document.querySelector(
          `#${this.state.elementId} .daily-bonus-calendar-header h3`
        );
        if (header) {
          header.textContent = `ЩОДЕННИЙ БОНУС - ДЕНЬ ${nextDay} з ${this.options.cycleSize}`;
          header.classList.add('animated');

          setTimeout(() => {
            header.classList.remove('animated');
          }, 1000);
        }

        // Знімаємо флаг анімації через 1 секунду
        setTimeout(() => {
          this.state.animationInProgress = false;

          // Видаляємо класи анімації
          currentDayElement.classList.remove('animated');
          nextDayElement.classList.remove('animated');

          // Викликаємо callback, якщо він є
          if (typeof callback === 'function') {
            callback();
          }
        }, 1000);
      }, 700);

      logger.info(`Анімація переходу до дня ${nextDay}`, 'animateNextDay', {
        category: LOG_CATEGORIES.ANIMATION,
      });
    } catch (error) {
      logger.error(error, 'Помилка анімації переходу до наступного дня', {
        category: LOG_CATEGORIES.ANIMATION,
      });

      this.state.animationInProgress = false;

      // Викликаємо callback, якщо він є
      if (typeof callback === 'function') {
        callback();
      }
    }
  }

  /**
   * Очищення ресурсів
   */
  destroy() {
    try {
      // Очищаємо контейнер
      if (this.options.container) {
        this.options.container.innerHTML = '';
      }

      // Очищаємо внутрішній стан
      this.state.days = [];
      this.state.initialized = false;

      logger.info('Ресурси календаря очищено', 'destroy');
    } catch (error) {
      logger.error(error, 'Помилка очищення ресурсів календаря', {
        category: LOG_CATEGORIES.LOGIC,
      });
    }
  }
}

export default DailyBonusCalendar;
