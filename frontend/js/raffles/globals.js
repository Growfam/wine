/**
 * globals.js - Центральний модуль глобальних об'єктів для системи розіграшів
 * Створює основну структуру об'єктів, які використовуються в інших модулях
 */

// Створюємо основний об'єкт WinixRaffles
const WinixRaffles = {
  // Утиліти для роботи з різними аспектами системи
  utils: {
    formatters: {}, // Функції форматування (дата, валюта тощо)
    ui: {},         // Функції для роботи з UI
    cache: {}       // Функції для кешування
  },

  // Підсистеми та модулі
  components: {},   // Компоненти UI (картки, модалі тощо)
  active: {},       // Модуль активних розіграшів
  history: {},      // Модуль історії розіграшів
  participation: {}, // Модуль участі в розіграшах
  stats: {},        // Модуль статистики

  // Адміністративна частина
  admin: {
    management: {}, // Менеджер розіграшів
    participants: {} // Робота з учасниками
  },

  // API сервіс
  api: {},

  // Службові поля для налаштувань та конфігурації
  config: {
    apiBaseUrl: '/api',
    defaultTTL: 300000, // 5 хвилин за замовчуванням
    debug: false
  },

  // Версія системи
  version: '1.0.0',

  // Реєстрація подій для спілкування між модулями
  events: {
    // Реєстрація обробника події
    on: function(eventName, callback) {
      document.addEventListener(`winix:${eventName}`, function(e) {
        callback(e.detail);
      });
    },

    // Видалення обробника події
    off: function(eventName, callback) {
      document.removeEventListener(`winix:${eventName}`, callback);
    },

    // Генерація події
    emit: function(eventName, data) {
      const event = new CustomEvent(`winix:${eventName}`, {
        detail: data
      });
      document.dispatchEvent(event);
    }
  },

  // Центральне управління станами завантаження
  loader: {
    _activeLoaders: 0,
    _pendingTimeouts: {},

    // Показ індикатора завантаження
    show: function(message = 'Завантаження...', id = null) {
      this._activeLoaders++;

      // Якщо є ID, зберігаємо його для можливості окремого приховування
      if (id) {
        this._pendingTimeouts[id] = setTimeout(() => {
          console.warn(`Loader ${id} не був прихований протягом 30 секунд, автоматичне приховування`);
          this.hide(id);
        }, 30000);
      }

      if (typeof window.showLoading === 'function') {
        window.showLoading(message);
      } else {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');

        const spinnerText = document.getElementById('loading-spinner-text');
        if (spinnerText) spinnerText.textContent = message;
      }
    },

    // Приховування індикатора завантаження
    hide: function(id = null) {
      if (id && this._pendingTimeouts[id]) {
        clearTimeout(this._pendingTimeouts[id]);
        delete this._pendingTimeouts[id];
      }

      this._activeLoaders = Math.max(0, this._activeLoaders - 1);

      // Приховуємо лоадер тільки якщо всі завантаження завершено
      if (this._activeLoaders === 0) {
        if (typeof window.hideLoading === 'function') {
          window.hideLoading();
        } else {
          const spinner = document.getElementById('loading-spinner');
          if (spinner) spinner.classList.remove('show');
        }
      }
    },

    // Примусове приховування всіх індикаторів
    hideAll: function() {
      // Очищаємо всі таймаути
      Object.keys(this._pendingTimeouts).forEach(id => {
        clearTimeout(this._pendingTimeouts[id]);
      });

      this._pendingTimeouts = {};
      this._activeLoaders = 0;

      if (typeof window.hideLoading === 'function') {
        window.hideLoading();
      } else {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
      }
    },

    // Перевірка, чи є активні завантаження
    isLoading: function() {
      return this._activeLoaders > 0;
    }
  },

  /**
   * Ініціалізація глобальної системи
   */
  init() {
    console.log(`🎮 WINIX Raffles: Ініціалізація системи розіграшів (v${this.version})`);

    // Створюємо подію для оповіщення про ініціалізацію
    document.dispatchEvent(new CustomEvent('winix:raffles-initialized', {
      detail: { version: this.version }
    }));

    return this;
  },

  /**
   * Очищення ресурсів системи
   */
  destroy() {
    // Очищаємо всі лоадери
    this.loader.hideAll();

    // Оповіщаємо про завершення роботи
    this.events.emit('raffles-destroyed', {});

    // Викликаємо destroy для модулів, якщо вони підтримують це
    const moduleKeys = ['active', 'history', 'participation', 'stats', 'components', 'admin'];
    moduleKeys.forEach(key => {
      if (this[key] && typeof this[key].destroy === 'function') {
        this[key].destroy();
      }
    });

    console.log(`🎮 WINIX Raffles: Систему розіграшів закрито`);

    return this;
  }
};

// Експортуємо об'єкт як за замовчуванням
export default WinixRaffles;

// Для зворотної сумісності робимо об'єкт доступним глобально
// Це потрібно на час міграції, пізніше можна видалити
window.WinixRaffles = WinixRaffles;

console.log("🎮 WINIX Raffles: Ініціалізація глобальної структури об'єктів");