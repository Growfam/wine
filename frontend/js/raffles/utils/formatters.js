/**
 * WINIX - Система розіграшів (formatters.js)
 * Набір утиліт для форматування даних у системі розіграшів
 */

(function () {
  'use strict';

  // Перевірка наявності головного модуля розіграшів
  if (typeof window.WinixRaffles === 'undefined') {
    console.error(
      '❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше formatters.js'
    );
    return;
  }

  // Модуль форматувальників
  const formatters = {
    // Локалізація (можна розширити для інших мов)
    localization: {
      months: [
        'січня',
        'лютого',
        'березня',
        'квітня',
        'травня',
        'червня',
        'липня',
        'серпня',
        'вересня',
        'жовтня',
        'листопада',
        'грудня',
      ],
      shortMonths: [
        'січ',
        'лют',
        'бер',
        'кві',
        'тра',
        'чер',
        'лип',
        'сер',
        'вер',
        'жов',
        'лис',
        'гру',
      ],
      days: ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'],
      shortDays: ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
      today: 'сьогодні',
      tomorrow: 'завтра',
      yesterday: 'вчора',
    },

    /**
     * Форматування дати у вигляді DD.MM.YYYY
     * @param {Date|string|number} date - Дата для форматування
     * @returns {string} Відформатована дата
     */
    formatDate: function (date) {
      const d = this.ensureDate(date);

      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    },

    /**
     * Форматування часу у вигляді HH:MM
     * @param {Date|string|number} date - Дата для форматування
     * @returns {string} Відформатований час
     */
    formatTime: function (date) {
      const d = this.ensureDate(date);

      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    /**
     * Форматування дати та часу у вигляді DD.MM.YYYY HH:MM
     * @param {Date|string|number} date - Дата для форматування
     * @returns {string} Відформатована дата та час
     */
    formatDateTime: function (date) {
      return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    /**
     * Форматування дати у зручному для читання вигляді
     * @param {Date|string|number} date - Дата для форматування
     * @returns {string} Відформатована дата
     */
    formatFriendlyDate: function (date) {
      const d = this.ensureDate(date);
      const now = new Date();

      // Перевірка на сьогодні
      if (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        return this.localization.today;
      }

      // Перевірка на завтра
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      if (
        d.getDate() === tomorrow.getDate() &&
        d.getMonth() === tomorrow.getMonth() &&
        d.getFullYear() === tomorrow.getFullYear()
      ) {
        return this.localization.tomorrow;
      }

      // Перевірка на вчора
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear()
      ) {
        return this.localization.yesterday;
      }

      // Для інших дат використовуємо формат "12 травня" або "12 травня 2023"
      const day = d.getDate();
      const month = this.localization.months[d.getMonth()];

      // Якщо рік відрізняється від поточного, додаємо його
      if (d.getFullYear() !== now.getFullYear()) {
        return `${day} ${month} ${d.getFullYear()}`;
      }

      return `${day} ${month}`;
    },

    /**
     * Форматування залишку часу
     * @param {number} timeLeftMs - Кількість мілісекунд
     * @returns {object} Об'єкт з днями, годинами, хвилинами, секундами
     */
    formatTimeLeft: function (timeLeftMs) {
      if (timeLeftMs <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

      return {
        days,
        hours,
        minutes,
        seconds,
        formatted: {
          days: String(days).padStart(2, '0'),
          hours: String(hours).padStart(2, '0'),
          minutes: String(minutes).padStart(2, '0'),
          seconds: String(seconds).padStart(2, '0'),
        },
      };
    },

    /**
     * Форматування дати завершення для відображення в UI
     * @param {Date|string|number} endDate - Дата завершення
     * @returns {string} Відформатований текст
     */
    formatEndTime: function (endDate) {
      const end = this.ensureDate(endDate);
      const now = new Date();

      // Перевірка на сьогодні
      if (
        end.getDate() === now.getDate() &&
        end.getMonth() === now.getMonth() &&
        end.getFullYear() === now.getFullYear()
      ) {
        return `сьогодні о ${this.formatTime(end)}`;
      }

      // Перевірка на завтра
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      if (
        end.getDate() === tomorrow.getDate() &&
        end.getMonth() === tomorrow.getMonth() &&
        end.getFullYear() === tomorrow.getFullYear()
      ) {
        return `завтра о ${this.formatTime(end)}`;
      }

      // Для інших дат
      return `${this.formatDate(end)} о ${this.formatTime(end)}`;
    },

    /**
     * Форматування числа з розділювачами тисяч
     * @param {number} number - Число для форматування
     * @returns {string} Відформатоване число
     */
    formatNumber: function (number) {
      if (number === undefined || number === null) {
        return '0';
      }

      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    /**
     * Форматування суми з валютою
     * @param {number} amount - Сума
     * @param {string} currency - Валюта (за замовчуванням WINIX)
     * @returns {string} Відформатована сума з валютою
     */
    formatCurrency: function (amount, currency = 'WINIX') {
      if (amount === undefined || amount === null) {
        amount = 0;
      }

      return `${this.formatNumber(amount)} ${currency}`;
    },

    /**
     * Перетворення рядка або числа на об'єкт Date
     * @param {Date|string|number} date - Дата, рядок або число
     * @returns {Date} Об'єкт Date
     */
    ensureDate: function (date) {
      if (date instanceof Date) {
        return date;
      }

      if (typeof date === 'string') {
        // Перевірка на формат ISO
        if (date.includes('T') || date.includes('Z')) {
          return new Date(date);
        }

        // Перевірка на формат DD.MM.YYYY
        if (date.includes('.')) {
          const parts = date.split('.');
          if (parts.length === 3) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          }
        }

        // Для інших форматів
        return new Date(date);
      }

      if (typeof date === 'number') {
        // Перевірка на timestamp у мілісекундах або секундах
        if (date < 10000000000) {
          // Якщо це секунди (до 2286 року)
          return new Date(date * 1000);
        }
        return new Date(date);
      }

      // Якщо нічого не підійшло, повертаємо поточну дату
      return new Date();
    },

    /**
     * Створення HTML-елемента для відображення залишку часу
     * @param {string} containerId - ID контейнера для таймера
     * @param {string} raffleId - ID розіграшу
     * @returns {HTMLElement} Елемент з таймером
     */
    createTimerElement: function (containerId, raffleId) {
      const timerContainer = document.createElement('div');
      timerContainer.className = 'timer-container';
      timerContainer.id = containerId;

      // Дні
      const daysBlock = document.createElement('div');
      daysBlock.className = 'timer-block';
      daysBlock.innerHTML = `
                <div class="timer-value" id="days-${raffleId}">00</div>
                <div class="timer-label">Дні</div>
            `;

      // Години
      const hoursBlock = document.createElement('div');
      hoursBlock.className = 'timer-block';
      hoursBlock.innerHTML = `
                <div class="timer-value" id="hours-${raffleId}">00</div>
                <div class="timer-label">Години</div>
            `;

      // Хвилини
      const minutesBlock = document.createElement('div');
      minutesBlock.className = 'timer-block';
      minutesBlock.innerHTML = `
                <div class="timer-value" id="minutes-${raffleId}">00</div>
                <div class="timer-label">Хвилини</div>
            `;

      // Секунди
      const secondsBlock = document.createElement('div');
      secondsBlock.className = 'timer-block';
      secondsBlock.innerHTML = `
                <div class="timer-value" id="seconds-${raffleId}">00</div>
                <div class="timer-label">Секунди</div>
            `;

      // Додаємо все до контейнера
      timerContainer.appendChild(daysBlock);
      timerContainer.appendChild(hoursBlock);
      timerContainer.appendChild(minutesBlock);
      timerContainer.appendChild(secondsBlock);

      return timerContainer;
    },

    /**
     * Оновлення елементів таймера
     * @param {string} raffleId - ID розіграшу
     * @param {object} timeObj - Об'єкт з часом (від formatTimeLeft)
     */
    updateTimerElements: function (raffleId, timeObj) {
      const days = document.getElementById(`days-${raffleId}`);
      const hours = document.getElementById(`hours-${raffleId}`);
      const minutes = document.getElementById(`minutes-${raffleId}`);
      const seconds = document.getElementById(`seconds-${raffleId}`);

      if (days) days.textContent = timeObj.formatted.days;
      if (hours) hours.textContent = timeObj.formatted.hours;
      if (minutes) minutes.textContent = timeObj.formatted.minutes;
      if (seconds) seconds.textContent = timeObj.formatted.seconds;
    },
  };

  // Додаємо модуль форматерів до головного модуля розіграшів
  window.WinixRaffles.formatters = formatters;

  console.log('✅ Модуль форматувальників успішно ініціалізовано');
})();
