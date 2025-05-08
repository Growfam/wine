/**
 * Постачальник інформації про користувача
 *
 * Відповідає за:
 * - Безпечне отримання ID користувача з різних джерел
 * - Вирішення проблем з отриманням ID користувача
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';
import dependencyContainer from '../../utils';
import { CONFIG } from '../../config';

// Створюємо логер для модуля
const logger = getLogger('UserProvider');

export class UserProvider {
  constructor() {
    // Конфігурація
    this.config = {
      fallbackUserMode: true
    };
  }

  /**
   * Виправлення проблем з ID користувача у всіх модулях
   */
  fixUserIdIssues() {
    try {
      // Створення userId-провайдера та реєстрація в контейнері залежностей
      const userIdProvider = {
        getUserId: () => {
          const userIdResult = this.safeGetUserId();
          if (!userIdResult.success) {
            if (this.config.fallbackUserMode) {
              logger.info('Повертаємо тимчасовий ID для режиму fallback', 'getUserId');
              return 'temp_user_' + Math.random().toString(36).substring(2, 9);
            }
            return null;
          }
          return userIdResult.userId;
        }
      };

      dependencyContainer.register('UserIdProvider', userIdProvider);

      // Перевіряємо, чи є функція getUserId
      if (typeof window.getUserId !== 'function') {
        logger.info('Створення глобальної функції getUserId...', 'fixUserIdIssues', {
          category: LOG_CATEGORIES.INIT
        });

        // Створюємо функцію getUserId, яка використовує зареєстрований провайдер
        window.getUserId = userIdProvider.getUserId;
      }
    } catch (error) {
      logger.error(error, 'Помилка при виправленні проблем з ID користувача', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Безпечне отримання ID користувача з обробкою помилок
   * @returns {Object} Результат отримання ID користувача
   */
  safeGetUserId() {
    try {
      // Спробуємо отримати ID користувача через звичайну функцію getUserId
      if (typeof window.getUserId === 'function') {
        const userId = window.getUserId();
        if (userId) {
          return { success: true, userId: userId };
        }
      }

      // Спробуємо знайти ID в localStorage
      try {
        const storedId = localStorage.getItem('telegram_user_id');
        if (storedId && storedId !== 'undefined' && storedId !== 'null') {
          return { success: true, userId: storedId, source: 'localStorage' };
        }
      } catch (storageError) {
        logger.warn(storageError, 'Помилка доступу до localStorage', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Спробуємо отримати з URL-параметрів
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (id) {
          return { success: true, userId: id, source: 'URL' };
        }
      } catch (urlError) {
        logger.warn(urlError, 'Помилка парсингу URL', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Спробуємо отримати з Telegram WebApp
      try {
        if (window.Telegram && window.Telegram.WebApp &&
          window.Telegram.WebApp.initDataUnsafe &&
          window.Telegram.WebApp.initDataUnsafe.user &&
          window.Telegram.WebApp.initDataUnsafe.user.id) {

          const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
          if (telegramId) {
            return { success: true, userId: telegramId, source: 'TelegramWebApp' };
          }
        }
      } catch (telegramError) {
        logger.warn(telegramError, 'Помилка доступу до Telegram WebApp', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Не знайдено ID користувача
      logger.warn('ID користувача не знайдено', 'safeGetUserId', {
        category: LOG_CATEGORIES.AUTH
      });

      return {
        success: false,
        error: 'ID користувача не знайдено',
        fallbackAvailable: this.config.fallbackUserMode,
        requiresAuth: true
      };
    } catch (error) {
      logger.error(error, 'Помилка отримання ID користувача', {
        category: LOG_CATEGORIES.AUTH
      });

      return {
        success: false,
        error: error.message || 'Помилка отримання ID користувача',
        originalError: error,
        fallbackAvailable: this.config.fallbackUserMode,
        requiresAuth: true
      };
    }
  }

  /**
   * Отримання додаткової інформації про користувача
   * @returns {Object} Інформація про користувача
   */
  getUserInfo() {
    try {
      // Спочатку спробуємо отримати базовий ID
      const idResult = this.safeGetUserId();
      const userInfo = {
        userId: idResult.success ? idResult.userId : null,
        source: idResult.source || 'unknown'
      };

      // Спробуємо отримати додаткову інформацію з Telegram WebApp
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
        const telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
        userInfo.username = telegramUser.username || null;
        userInfo.firstName = telegramUser.first_name || null;
        userInfo.lastName = telegramUser.last_name || null;
        userInfo.languageCode = telegramUser.language_code || null;
        userInfo.platform = 'telegram';
      }

      // Пробуємо отримати мову браузера
      userInfo.browserLanguage = navigator.language || navigator.userLanguage || null;

      return userInfo;
    } catch (error) {
      logger.error(error, 'Помилка отримання інформації про користувача', {
        category: LOG_CATEGORIES.AUTH
      });

      return {
        userId: null,
        error: error.message || 'Помилка отримання інформації про користувача',
        originalError: error
      };
    }
  }

  /**
   * Збереження ID користувача в localStorage
   * @param {string} userId - ID користувача
   * @returns {boolean} Результат збереження
   */
  saveUserId(userId) {
    try {
      if (!userId) return false;

      localStorage.setItem('telegram_user_id', userId);
      logger.info('ID користувача збережено в localStorage', 'saveUserId');

      return true;
    } catch (error) {
      logger.error(error, 'Помилка збереження ID користувача в localStorage', {
        category: LOG_CATEGORIES.AUTH
      });

      return false;
    }
  }

  /**
   * Очищення збереженого ID користувача
   * @returns {boolean} Результат очищення
   */
  clearUserId() {
    try {
      localStorage.removeItem('telegram_user_id');
      logger.info('ID користувача видалено з localStorage', 'clearUserId');

      return true;
    } catch (error) {
      logger.error(error, 'Помилка видалення ID користувача з localStorage', {
        category: LOG_CATEGORIES.AUTH
      });

      return false;
    }
  }
}