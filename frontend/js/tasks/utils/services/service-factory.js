/**
 * Фабрика сервісів
 *
 * Відповідає за:
 * - Централізоване отримання сервісів
 * - Зменшення залежності від глобальних змінних
 * - Спрощення тестування
 */

import cacheService from '../../api/core/cache.js';
import taskApi from '../../api/index.js';
import dependencyContainer from '../core/dependency.js';

/**
 * Клас фабрики сервісів
 */
class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.initialized = false;
    this.initPromise = null;

    // Виконуємо ініціалізацію з невеликою затримкою,
    // щоб уникнути циклічних залежностей
    setTimeout(() => {
      this.initialize();
    }, 100);
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
        // Реєстрація базових сервісів, які не мають залежностей
        this.register('cacheService', cacheService);
        this.register('taskApi', taskApi);

        // Динамічний імпорт сервісів із залежностями
        try {
          // Ініціалізація taskStore
          const { default: taskStore } = await import('../../services/store/index.js');
          this.register('taskStore', taskStore);

          // Ініціалізація taskVerification
          const { default: taskVerification } = await import('../../services/verification/index.js');
          this.register('taskVerification', taskVerification);

          // Ініціалізація taskProgress
          const { default: taskProgress } = await import('../../services/progress/index.js');
          this.register('taskProgress', taskProgress);
        } catch (importError) {
          console.error('Помилка динамічного імпорту сервісів:', importError);
        }

        // Зареєструвати сервіси в контейнері залежностей
        Object.entries(this.getAll()).forEach(([name, service]) => {
          if (service) {
            dependencyContainer.register(name, service);
          }
        });

        this.initialized = true;
        console.log('Фабрика сервісів успішно ініціалізована');
      } catch (error) {
        console.error('Помилка при ініціалізації фабрики сервісів:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Реєстрація сервісу у фабриці
   * @param {string} name - Назва сервісу
   * @param {Object} service - Екземпляр сервісу
   */
  register(name, service) {
    this.services.set(name, service);
  }

  /**
   * Отримання сервісу за назвою
   * @param {string} name - Назва сервісу
   * @returns {Promise<Object|null>} Екземпляр сервісу або null
   */
  async get(name) {
    // Переконуємося, що ініціалізація завершена
    if (!this.initialized) {
      await this.initialize();
    }
    return this.services.get(name) || null;
  }

  /**
   * Синхронне отримання сервісу без очікування ініціалізації
   * @param {string} name - Назва сервісу
   * @returns {Object|null} Екземпляр сервісу або null
   */
  getSync(name) {
    return this.services.get(name) || null;
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

// Створюємо і експортуємо єдиний екземпляр фабрики
const serviceFactory = new ServiceFactory();

export default serviceFactory;