javascript/**
 * index.js - Головний інтеграційний модуль для всіх функцій розіграшів
 * @version 2.0.0
 */

import WinixRaffles from './globals.js';
import { CONFIG } from './config.js';

// Імпорт модулів
import apiService from './services/api.js';
import activeRaffles from './modules/active.js';
import historyModule from './modules/history.js';
import participationModule from './modules/participation.js';
import statisticsModule from './modules/stats.js';

// Імпорт компонентів UI
import { initUIComponents } from './components/componentManager.js';
import { initFormatters } from './utils/formatters.js';
import { initUIHelpers } from './utils/ui-helpers.js';

// Класс для керування системою розіграшів
class RafflesSystem {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.moduleStatus = new Map();

    // Відстеження стану ініціалізації модулів
    this._initTimeouts = new Map();
    this._retryCount = 0;
    this._maxRetries = 3;
  }

  /**
   * Ініціалізація системи розіграшів
   * @param {Object} config - Налаштування системи
   * @returns {Promise<void>}
   */
  async init(config = {}) {
    if (this.initialized) {
      WinixRaffles.logger.warn("Система розіграшів вже ініціалізована");
      return this.initializationPromise;
    }

    if (this.initializationPromise) {
      WinixRaffles.logger.log("Ініціалізація вже в процесі, очікуємо завершення");
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // Ініціалізація WinixRaffles з налаштуваннями
        WinixRaffles.init({
          debug: config.DEBUG || CONFIG.DEBUG,
          apiBaseUrl: config.API?.BASE_URL || CONFIG.API.BASE_URL,
          defaultTTL: config.API?.CACHE_TTL?.DEFAULT || CONFIG.API.CACHE_TTL.USER_DATA
        });

        WinixRaffles.logger.log("Початок ініціалізації системи розіграшів (v2.0.0)");

        // Ініціалізація модулів в правильному порядку
        await this._initModulesInOrder();

        this.initialized = true;
        WinixRaffles.logger.log("Систему розіграшів успішно ініціалізовано");

        // Відправляємо подію про успішну ініціалізацію
        WinixRaffles.events.emit('raffles-system-initialized', {
          timestamp: Date.now()
        });

        // Запускаємо автооновлення
        this._setupAutoRefresh();

        resolve();
      } catch (error) {
        WinixRaffles.logger.error("Критична помилка ініціалізації системи розіграшів:", error);

        // Збільшуємо лічильник спроб
        this._retryCount++;

        // Перевіряємо, чи можна спробувати ще раз
        if (this._retryCount <= this._maxRetries) {
          WinixRaffles.logger.log(`Повторна спроба ініціалізації (${this._retryCount}/${this._maxRetries})...`);

          // Скидаємо стан та promise
          this.initializationPromise = null;

          // Затримка перед повторною спробою
          setTimeout(() => {
            this.init(config).catch(reject);
          }, CONFIG.INITIALIZATION.RETRY_DELAY);
        } else {
          // Занадто багато спроб, відхиляємо promise
          reject(new Error(`Не вдалося ініціалізувати систему після ${this._maxRetries} спроб`));

          // Відправляємо подію про помилку ініціалізації
          WinixRaffles.events.emit('raffles-system-init-failed', {
            error,
            retries: this._retryCount
          });
        }
      }
    });

    return this.initializationPromise;
  }

  /**
   * Ініціалізація модулів у визначеному порядку
   * @private
   */
  async _initModulesInOrder() {
    // Масив обіцянок ініціалізації модулів
    const initPromises = [];

    // Ініціалізуємо утиліти першими
    try {
      // Ініціалізуємо форматери
      WinixRaffles.utils = await initFormatters();

      // Ініціалізуємо UI хелпери
      WinixRaffles.utils = { ...WinixRaffles.utils, ...await initUIHelpers() };

      // Ініціалізуємо UI компоненти
      WinixRaffles.components = await initUIComponents();

      WinixRaffles.logger.log("Утиліти та компоненти ініціалізовано");
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації утиліт:", error);
      throw error;
    }

    // Проходимо по всіх модулях у порядку ініціалізації
    for (const moduleName of CONFIG.INITIALIZATION.MODULE_INIT_ORDER) {
      initPromises.push(this._initModule(moduleName));
    }

    // Очікуємо завершення всіх ініціалізацій
    await Promise.allSettled(initPromises);

    // Перевіряємо, чи всі критичні модулі ініціалізовано
    for (const moduleName of ['api', 'uiComponents', 'active']) {
      if (this.moduleStatus.get(moduleName) !== 'initialized') {
        throw new Error(`Критичний модуль ${moduleName} не був ініціалізований`);
      }
    }
  }

  /**
   * Ініціалізація окремого модуля з таймаутом
   * @param {string} moduleName - Назва модуля
   * @returns {Promise<void>}
   * @private
   */
  async _initModule(moduleName) {
    return new Promise((resolve, reject) => {
      this.moduleStatus.set(moduleName, 'initializing');

      // Встановлюємо таймаут для ініціалізації
      const timeoutId = setTimeout(() => {
        if (this.moduleStatus.get(moduleName) === 'initializing') {
          WinixRaffles.logger.error(`Таймаут ініціалізації модуля ${moduleName}`);
          this.moduleStatus.set(moduleName, 'timeout');
          reject(new Error(`Таймаут ініціалізації модуля ${moduleName}`));
        }
      }, CONFIG.INITIALIZATION.TIMEOUT);

      // Зберігаємо таймаут для можливості очищення
      this._initTimeouts.set(moduleName, timeoutId);

      try {
        // Вибираємо модуль для ініціалізації
        let moduleToInit;

        switch(moduleName) {
          case 'api':
            moduleToInit = apiService;
            break;
          case 'active':
            moduleToInit = activeRaffles;
            break;
          case 'history':
            moduleToInit = historyModule;
            break;
          case 'participation':
            moduleToInit = participationModule;
            break;
          case 'stats':
            moduleToInit = statisticsModule;
            break;
          default:
            WinixRaffles.logger.warn(`Невідомий модуль ${moduleName}`);
            clearTimeout(timeoutId);
            this.moduleStatus.set(moduleName, 'unknown');
            resolve(); // Пропускаємо невідомі модулі
            return;
        }

        // Ініціалізуємо модуль
        if (moduleToInit && typeof moduleToInit.init === 'function') {
          // Спроба ініціалізації модуля
          WinixRaffles.logger.log(`Ініціалізація модуля ${moduleName}`);

          moduleToInit.init()
            .then(() => {
              clearTimeout(timeoutId);
              this.moduleStatus.set(moduleName, 'initialized');
              WinixRaffles.logger.log(`Модуль ${moduleName} успішно ініціалізовано`);
              resolve();
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              this.moduleStatus.set(moduleName, 'error');
              WinixRaffles.logger.error(`Помилка ініціалізації модуля ${moduleName}:`, error);

              // Для не критичних модулів, продовжуємо без них
              if (['history', 'stats'].includes(moduleName)) {
                WinixRaffles.logger.warn(`Пропускаємо не критичний модуль ${moduleName}`);
                resolve();
              } else {
                reject(error);
              }
            });
        } else {
          clearTimeout(timeoutId);
          this.moduleStatus.set(moduleName, 'not-initializable');
          WinixRaffles.logger.warn(`Модуль ${moduleName} не має методу init`);
          resolve(); // Пропускаємо модулі без методу init
        }
      } catch (error) {
        clearTimeout(timeoutId);
        this.moduleStatus.set(moduleName, 'error');
        WinixRaffles.logger.error(`Загальна помилка ініціалізації модуля ${moduleName}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Налаштування автоматичного оновлення даних
   * @private
   */
  _setupAutoRefresh() {
    // Активні розіграші
    if (activeRaffles && typeof activeRaffles.refresh === 'function') {
      setInterval(() => {
        if (this.initialized && typeof navigator.onLine !== 'undefined' && navigator.onLine) {
          activeRaffles.refresh().catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення активних розіграшів:", error);
          });
        }
      }, CONFIG.REFRESH_INTERVALS.ACTIVE_RAFFLES);
    }

    // Історія розіграшів
    if (historyModule && typeof historyModule.refresh === 'function') {
      setInterval(() => {
        if (this.initialized && typeof navigator.onLine !== 'undefined' && navigator.onLine) {
          historyModule.refresh().catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення історії розіграшів:", error);
          });
        }
      }, CONFIG.REFRESH_INTERVALS.HISTORY);
    }

    // Статистика
    if (statisticsModule && typeof statisticsModule.refresh === 'function') {
      setInterval(() => {
        if (this.initialized && typeof navigator.onLine !== 'undefined' && navigator.onLine) {
          statisticsModule.refresh().catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення статистики:", error);
          });
        }
      }, CONFIG.REFRESH_INTERVALS.STATISTICS);
    }
  }

  /**
   * Оновлення всіх даних
   * @param {boolean} [force=false] - Примусове оновлення
   * @returns {Promise<void>}
   */
  async refreshAll(force = false) {
    if (!this.initialized) {
      WinixRaffles.logger.warn("Система розіграшів не ініціалізована");
      return;
    }

    try {
      WinixRaffles.logger.log("Початок оновлення всіх даних");

      // Паралельно оновлюємо всі модулі
      const refreshPromises = [];

      // Активні розіграші
      if (activeRaffles && typeof activeRaffles.refresh === 'function') {
        refreshPromises.push(
          activeRaffles.refresh(force).catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення активних розіграшів:", error);
          })
        );
      }

      // Історія розіграшів
      if (historyModule && typeof historyModule.refresh === 'function') {
        refreshPromises.push(
          historyModule.refresh(force).catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення історії розіграшів:", error);
          })
        );
      }

      // Статистика
      if (statisticsModule && typeof statisticsModule.refresh === 'function') {
        refreshPromises.push(
          statisticsModule.refresh(force).catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення статистики:", error);
          })
        );
      }

      // Оновлення даних користувача
      if (apiService && typeof apiService.getUserData === 'function') {
        refreshPromises.push(
          apiService.getUserData(force).catch(error => {
            WinixRaffles.logger.warn("Помилка оновлення даних користувача:", error);
          })
        );
      }

      // Очікуємо завершення всіх оновлень
      await Promise.allSettled(refreshPromises);

      WinixRaffles.logger.log("Всі дані оновлено");

      // Відправляємо подію про оновлення даних
      WinixRaffles.events.emit('all-data-refreshed', {
        timestamp: Date.now(),
        forced: force
      });
    } catch (error) {
      WinixRaffles.logger.error("Помилка оновлення даних:", error);

      // Відправляємо подію про помилку оновлення
      WinixRaffles.events.emit('refresh-error', {
        error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Знищення системи розіграшів
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this.initialized) {
      WinixRaffles.logger.warn("Система розіграшів не ініціалізована, нічого знищувати");
      return;
    }

    try {
      WinixRaffles.logger.log("Початок знищення системи розіграшів");

      // Очищаємо всі таймаути ініціалізації
      for (const [moduleName, timeoutId] of this._initTimeouts.entries()) {
        clearTimeout(timeoutId);
      }

      // Знищуємо модулі в зворотному порядку
      const destroyPromises = [];

      for (const moduleName of [...CONFIG.INITIALIZATION.MODULE_INIT_ORDER].reverse()) {
        // Вибираємо модуль для знищення
        let moduleToDestroy;

        switch(moduleName) {
          case 'api':
            moduleToDestroy = apiService;
            break;
          case 'active':
            moduleToDestroy = activeRaffles;
            break;
          case 'history':
            moduleToDestroy = historyModule;
            break;
          case 'participation':
            moduleToDestroy = participationModule;
            break;
          case 'stats':
            moduleToDestroy = statisticsModule;
            break;
        }

        // Знищуємо модуль, якщо є метод destroy
        if (moduleToDestroy && typeof moduleToDestroy.destroy === 'function') {
          destroyPromises.push(
            Promise.resolve().then(() => {
              WinixRaffles.logger.log(`Знищення модуля ${moduleName}`);
              return moduleToDestroy.destroy();
            }).catch(error => {
              WinixRaffles.logger.error(`Помилка знищення модуля ${moduleName}:`, error);
            })
          );
        }
      }

      // Очікуємо завершення всіх операцій знищення
      await Promise.allSettled(destroyPromises);

      // Скидаємо стан системи
      this.initialized = false;
      this.initializationPromise = null;
      this.moduleStatus.clear();
      this._initTimeouts.clear();
      this._retryCount = 0;

      WinixRaffles.logger.log("Систему розіграшів успішно знищено");

      // Відправляємо подію про знищення системи
      WinixRaffles.events.emit('raffles-system-destroyed', {
        timestamp: Date.now()
      });

      // Знищуємо глобальний об'єкт WinixRaffles
      WinixRaffles.destroy();
    } catch (error) {
      WinixRaffles.logger.error("Помилка знищення системи розіграшів:", error);
    }
  }
}

// Створюємо єдиний екземпляр системи
const rafflesSystem = new RafflesSystem();

// Автоматична ініціалізація при завантаженні сторінки
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('raffles.html')) {
      rafflesSystem.init(CONFIG).catch(error => {
        console.error('Помилка ініціалізації системи розіграшів:', error);
      });
    }
  });
} else if (window.location.pathname.includes('raffles.html')) {
  // Якщо DOM вже завантажено
  setTimeout(() => {
    rafflesSystem.init(CONFIG).catch(error => {
      console.error('Помилка ініціалізації системи розіграшів:', error);
    });
  }, 100);
}

// Експортуємо систему
export default rafflesSystem;