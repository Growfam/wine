/**
 * Фабрика сервісів
 *
 * Відповідає за:
 * - Централізоване отримання сервісів
 * - Зменшення залежності від глобальних змінних
 * - Спрощення тестування
 */

import cacheService from 'js/tasks/api/core/cache.js';
import taskApi from 'js/tasks/api/index.js';
import taskStore from 'js/tasks/services/store/index.js';
import taskVerification from 'js/tasks/services/verification/index.js';
import taskProgress from 'js/tasks/services/progress/index.js';
import dependencyContainer from 'js/tasks/utils/core/dependency.js';

/**
 * Клас фабрики сервісів
 */
class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.initialize();
  }

  /**
   * Ініціалізація фабрики
   */
  initialize() {
    // Реєстрація основних сервісів
    this.register('cacheService', cacheService);
    this.register('taskApi', taskApi);
    this.register('taskStore', taskStore);
    this.register('taskVerification', taskVerification);
    this.register('taskProgress', taskProgress);

    // Зареєструвати сервіси в контейнері залежностей
    Object.entries(this.getAll()).forEach(([name, service]) => {
      dependencyContainer.register(name, service);
    });
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
   * @returns {Object|null} Екземпляр сервісу або null
   */
  get(name) {
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
   * @returns {Object} Кеш-сервіс
   */
  getCacheService() {
    return this.get('cacheService');
  }

  /**
   * Отримання API сервісу
   * @returns {Object} API сервіс
   */
  getTaskApi() {
    return this.get('taskApi');
  }

  /**
   * Отримання сервісу сховища
   * @returns {Object} Сервіс сховища
   */
  getTaskStore() {
    return this.get('taskStore');
  }

  /**
   * Отримання сервісу верифікації
   * @returns {Object} Сервіс верифікації
   */
  getTaskVerification() {
    return this.get('taskVerification');
  }

  /**
   * Отримання сервісу прогресу
   * @returns {Object} Сервіс прогресу
   */
  getTaskProgress() {
    return this.get('taskProgress');
  }
}

// Створюємо і експортуємо єдиний екземпляр фабрики
const serviceFactory = new ServiceFactory();

export default serviceFactory;