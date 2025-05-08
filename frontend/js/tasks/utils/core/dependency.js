/**
 * Контейнер залежностей
 *
 * Легкий DI-контейнер для управління модулями та їх залежностями
 *
 * @version 1.0.0
 */

/**
 * Клас контейнера залежностей
 */
export class DependencyContainer {
  /**
   * Створює новий контейнер залежностей
   */
  constructor() {
    this.services = new Map();
  }

  /**
   * Реєстрація сервісу в контейнері
   * @param {string} name - Назва сервісу
   * @param {any} instance - Екземпляр сервісу
   * @returns {DependencyContainer} Поточний контейнер для чейнінгу
   */
  register(name, instance) {
    this.services.set(name, instance);
    return this;
  }

  /**
   * Перевірка наявності сервісу в контейнері
   * @param {string} name - Назва сервісу
   * @returns {boolean} Чи зареєстрований сервіс
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Отримання сервісу з контейнера
   * @param {string} name - Назва сервісу
   * @returns {any} Екземпляр сервісу або null
   */
  resolve(name) {
    return this.services.get(name) || null;
  }

  /**
   * Отримання списку всіх зареєстрованих сервісів
   * @returns {Array<string>} Масив назв зареєстрованих сервісів
   */
  getRegisteredModules() {
    return Array.from(this.services.keys());
  }

  /**
   * Видалення сервісу з контейнера
   * @param {string} name - Назва сервісу
   * @returns {boolean} Чи було видалено сервіс
   */
  remove(name) {
    return this.services.delete(name);
  }

  /**
   * Очищення контейнера
   */
  clear() {
    this.services.clear();
  }

  /**
   * Скидання контейнера
   * @param {Array<string>} except - Список сервісів, які не потрібно видаляти
   */
  reset(except = []) {
    if (except && except.length > 0) {
      // Зберігаємо певні сервіси
      const preserved = new Map();
      except.forEach((name) => {
        if (this.services.has(name)) {
          preserved.set(name, this.services.get(name));
        }
      });

      this.services.clear();

      // Відновлюємо збережені сервіси
      preserved.forEach((instance, name) => {
        this.services.set(name, instance);
      });
    } else {
      this.services.clear();
    }
  }
}

// Створюємо глобальний екземпляр контейнера
const container = new DependencyContainer();

// Додаємо в глобальний скоп для доступу з інших модулів
if (typeof window !== 'undefined') {
  window.dependencyContainer = container;
}

// Експорт глобального контейнера
export default container;