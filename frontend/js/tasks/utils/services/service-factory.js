/**
 * Фабрика сервісів
 *
 * Відповідає за:
 * - Централізоване отримання сервісів
 * - Зменшення залежності від глобальних змінних
 * - Спрощення тестування
 */

import { getLogger } from '../core/logger.js';
import cacheService from '../../api/core/cache.js';
import taskApi from '../../api/api.js';
import dependencyContainer from '../core/dependency.js';

// Створюємо логер для модуля
const logger = getLogger('ServiceFactory');

/**
 * Клас фабрики сервісів
 */
class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.initialized = false;
    this.initPromise = null;
    this.initCallbacks = [];

    // Викликаємо ініціалізацію відразу в конструкторі, але через Promise
    // щоб уникнути проблем з асинхронністю
    this.initialize().catch(error => {
      logger.error('Помилка ініціалізації фабрики сервісів', { error });
    });
  }

  /**
   * Ініціалізація фабрики
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized || this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        logger.info('Початок ініціалізації фабрики сервісів');

        // Реєстрація базових сервісів, які не мають залежностей
        try {
          this.register('cacheService', cacheService);
          logger.debug('Зареєстровано cacheService');
        } catch (cacheError) {
          logger.error('Помилка реєстрації cacheService', { error: cacheError.message });
        }

        try {
          this.register('taskApi', taskApi);
          logger.debug('Зареєстровано taskApi');
        } catch (apiError) {
          logger.error('Помилка реєстрації taskApi', { error: apiError.message });
        }

        // Динамічний імпорт сервісів із залежностями
        try {
          // Ініціалізація taskStore
          const { default: taskStore } = await import('../../services/store/index.js');
          this.register('taskStore', taskStore);
          logger.debug('Зареєстровано taskStore');
        } catch (storeError) {
          logger.error('Помилка динамічного імпорту taskStore', {
            error: storeError.message,
            stack: storeError.stack
          });
          // Замість простого логування помилки, створюємо заглушку
          this.register('taskStore', createServiceStub('taskStore'));
        }

        try {
          // Ініціалізація taskVerification
          const { default: taskVerification } = await import('../../services/verification/index.js');
          this.register('taskVerification', taskVerification);
          logger.debug('Зареєстровано taskVerification');
        } catch (verificationError) {
          logger.error('Помилка динамічного імпорту taskVerification', {
            error: verificationError.message,
            stack: verificationError.stack
          });
          this.register('taskVerification', createServiceStub('taskVerification'));
        }

        try {
          // Ініціалізація taskProgress
          const { default: taskProgress } = await import('../../services/progress/index.js');
          this.register('taskProgress', taskProgress);
          logger.debug('Зареєстровано taskProgress');
        } catch (progressError) {
          logger.error('Помилка динамічного імпорту taskProgress', {
            error: progressError.message,
            stack: progressError.stack
          });
          this.register('taskProgress', createServiceStub('taskProgress'));
        }

        // Зареєструвати сервіси в контейнері залежностей
        try {
          Object.entries(this.getAll()).forEach(([name, service]) => {
            if (service) {
              dependencyContainer.register(name, service);
            }
          });
          logger.debug('Сервіси зареєстровані в контейнері залежностей');
        } catch (containerError) {
          logger.error('Помилка реєстрації сервісів в контейнері залежностей', {
            error: containerError.message
          });
        }

        this.initialized = true;
        logger.info('Фабрика сервісів успішно ініціалізована');

        // Викликаємо всі колбеки очікування ініціалізації
        this.initCallbacks.forEach(callback => {
          try {
            callback();
          } catch (callbackError) {
            logger.error('Помилка виконання колбека ініціалізації', {
              error: callbackError.message
            });
          }
        });
        this.initCallbacks = [];
      } catch (error) {
        logger.error('Критична помилка при ініціалізації фабрики сервісів', {
          error: error.message,
          stack: error.stack
        });

        // Відкидаємо проміс, щоб викликаючий код міг обробити помилку
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Чекати завершення ініціалізації
   * @param {Function} callback - Функція, яка буде викликана після ініціалізації
   */
  onInit(callback) {
    if (typeof callback !== 'function') return;

    if (this.initialized) {
      // Якщо вже ініціалізовано, викликаємо колбек відразу
      try {
        callback();
      } catch (error) {
        logger.error('Помилка виконання колбека ініціалізації', { error: error.message });
      }
    } else {
      // Інакше додаємо до списку колбеків
      this.initCallbacks.push(callback);
    }
  }

  /**
   * Реєстрація сервісу у фабриці
   * @param {string} name - Назва сервісу
   * @param {Object} service - Екземпляр сервісу
   */
  register(name, service) {
    if (!name || !service) {
      logger.warn('Спроба зареєструвати невірний сервіс', { name });
      return;
    }

    this.services.set(name, service);
    logger.debug(`Зареєстровано сервіс: ${name}`);
  }

  /**
   * Отримання сервісу за назвою
   * @param {string} name - Назва сервісу
   * @returns {Promise<Object|null>} Екземпляр сервісу або null
   */
  async get(name) {
    // Переконуємося, що ініціалізація завершена
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        logger.error(`Помилка ініціалізації при отриманні сервісу ${name}`, {
          error: error.message
        });
        return null;
      }
    }

    const service = this.services.get(name);

    if (!service) {
      logger.warn(`Запитаний сервіс ${name} не знайдено`);
    }

    return service || null;
  }

  /**
   * Синхронне отримання сервісу без очікування ініціалізації
   * @param {string} name - Назва сервісу
   * @returns {Object|null} Екземпляр сервісу або null
   */
  getSync(name) {
    if (!this.initialized) {
      logger.warn(`Спроба синхронного отримання сервісу ${name} до завершення ініціалізації`);
    }

    return this.services.get(name) || null;
  }

  /**
   * Перевірка, чи сервіс зареєстрований
   * @param {string} name - Назва сервісу
   * @returns {boolean} Чи зареєстрований сервіс
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Отримання всіх сервісів
   * @returns {Object} Об'єкт з усіма сервісами
   */
  getAll() {
    const servicesObject = {};
    this.services.forEach((service, name) => {
      servicesObject[name] = service;
    });
    return servicesObject;
  }

  /**
   * Отримання кеш-сервісу
   * @returns {Promise<Object>} Кеш-сервіс
   */
  async getCacheService() {
    return this.get('cacheService');
  }

  /**
   * Отримання API сервісу
   * @returns {Promise<Object>} API сервіс
   */
  async getTaskApi() {
    return this.get('taskApi');
  }

  /**
   * Отримання сервісу сховища
   * @returns {Promise<Object>} Сервіс сховища
   */
  async getTaskStore() {
    return this.get('taskStore');
  }

  /**
   * Отримання сервісу верифікації
   * @returns {Promise<Object>} Сервіс верифікації
   */
  async getTaskVerification() {
    return this.get('taskVerification');
  }

  /**
   * Отримання сервісу прогресу
   * @returns {Promise<Object>} Сервіс прогресу
   */
  async getTaskProgress() {
    return this.get('taskProgress');
  }
}

/**
 * Створення заглушки сервісу при помилці завантаження
 * @param {string} serviceName - Назва сервісу
 * @returns {Object} Заглушка сервісу
 */
function createServiceStub(serviceName) {
  logger.warn(`Створено заглушку для сервісу ${serviceName}`);

  return {
    __isStub: true,
    __serviceName: serviceName,
    initialize: () => Promise.resolve(),
    isInitialized: () => true,
    // Метод-заглушка, який логує виклик і повертає null
    __handler: {
      get: (target, prop) => {
        if (prop in target) return target[prop];

        return (...args) => {
          logger.warn(`Виклик неіснуючого методу ${prop} для заглушки сервісу ${serviceName}`, {
            args
          });
          return null;
        };
      }
    }
  };
}

// Створюємо і експортуємо єдиний екземпляр фабрики
const serviceFactory = new ServiceFactory();

// Добавляємо проксі для безпечного доступу до методів заглушок сервісів
serviceFactory.getSync = new Proxy(serviceFactory.getSync, {
  apply: (target, thisArg, args) => {
    const service = target.apply(thisArg, args);
    if (service && service.__isStub) {
      return new Proxy(service, service.__handler);
    }
    return service;
  }
});

export default serviceFactory;