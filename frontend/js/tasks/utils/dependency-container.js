/**
 * Контейнер залежностей
 *
 * Легкий DI-контейнер для управління модулями та їх залежностями
 */

export class DependencyContainer {
  constructor() {
    this.services = new Map();
  }

  /**
   * Реєстрація сервісу в контейнері
   * @param {string} name - Назва сервісу
   * @param {any} instance - Екземпляр сервісу
   */
  register(name, instance) {
    this.services.set(name, instance);
    return this;
  }

  /**
   * Перевірка наявності сервісу в контейнері
   * @param {string} name - Назва сервісу
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Отримання сервісу з контейнера
   * @param {string} name - Назва сервісу
   * @returns {any} - Екземпляр сервісу або null
   */
  resolve(name) {
    return this.services.get(name) || null;
  }

  /**
   * Отримання списку всіх зареєстрованих сервісів
   * @returns {Array}
   */
  getRegisteredModules() {
    return Array.from(this.services.keys());
  }

  /**
   * Скидання контейнера
   * @param {Array} except - Список сервісів, які не потрібно видаляти
   */
  reset(except = []) {
    if (except && except.length > 0) {
      // Зберігаємо певні сервіси
      const preserved = new Map();
      except.forEach(name => {
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
const globalContainer = new DependencyContainer();

export default globalContainer;