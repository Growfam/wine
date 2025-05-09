/**
 * Служба діагностики системи завдань
 *
 * Відповідає за:
 * - Діагностику стану системи
 * - Відновлення невдалих модулів
 * - Збір інформації про помилки
 */

import { getLogger, LOG_CATEGORIES, dependencyContainer } from 'js/tasks/utils/index.js';

// Створюємо логер для модуля
const logger = getLogger('Diagnostics');

export class DiagnosticsService {
  constructor() {
    // Стан модуля
    this.state = {
      // Час останньої діагностики
      lastDiagnosticTime: 0,

      // Результат останньої діагностики
      lastDiagnosticResult: null,

      // Кількість спроб відновлення
      recoveryAttempts: {},
    };

    // Критичні модулі
    this.criticalModules = ['taskProgress', 'taskVerification', 'taskStore', 'taskSystem'];
  }

  /**
   * Діагностика системи
   * @returns {Object} Діагностична інформація
   */
  diagnose() {
    try {
      const now = Date.now();
      this.state.lastDiagnosticTime = now;

      // Отримуємо інформацію про стан модулів
      const initializer = dependencyContainer.resolve('TaskIntegration');

      const diagnosticInfo = {
        timestamp: now,
        moduleStates: initializer ? { ...initializer.state.moduleStates } : {},
        failedModules: initializer ? [...initializer.state.failedModules] : [],
        initTime: initializer ? initializer.state.initEndTime - initializer.state.initStartTime : 0,
        initialized: initializer ? initializer.state.initialized : false,
        registeredModules: dependencyContainer.getRegisteredModules(),
        browserInfo: this.getBrowserInfo(),
        performance: this.getPerformanceMetrics(),
        userId: this.getUserIdInfo(),
      };

      // Зберігаємо результат діагностики
      this.state.lastDiagnosticResult = diagnosticInfo;

      logger.info('Діагностична інформація зібрана', 'diagnose', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return diagnosticInfo;
    } catch (error) {
      logger.error(error, 'Помилка діагностики системи', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return {
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Отримання інформації про ID користувача
   * @returns {Object} Інформація про ID
   */
  getUserIdInfo() {
    try {
      // Спробуємо отримати провайдер ID користувача
      const userIdProvider = dependencyContainer.resolve('UserIdProvider');
      if (userIdProvider && typeof userIdProvider.getUserId === 'function') {
        const userId = userIdProvider.getUserId();

        return {
          userId,
          source: 'provider',
          success: !!userId,
        };
      }

      // Якщо немає провайдера, спробуємо глобальну функцію
      if (typeof window.getUserId === 'function') {
        const userId = window.getUserId();

        return {
          userId,
          source: 'global',
          success: !!userId,
        };
      }

      // Спробуємо отримати з localStorage
      const storedId = localStorage.getItem('telegram_user_id');
      if (storedId && storedId !== 'undefined' && storedId !== 'null') {
        return {
          userId: storedId,
          source: 'localStorage',
          success: true,
        };
      }

      return {
        userId: null,
        source: 'none',
        success: false,
      };
    } catch (error) {
      logger.error(error, 'Помилка отримання інформації про ID користувача', {
        category: LOG_CATEGORIES.AUTH,
      });

      return {
        userId: null,
        source: 'error',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Отримання інформації про браузер
   * @returns {Object} Інформація про браузер
   */
  getBrowserInfo() {
    try {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        screenSize: {
          width: window.screen.width,
          height: window.screen.height,
        },
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    } catch (error) {
      logger.error(error, 'Помилка отримання інформації про браузер', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return {
        error: error.message,
      };
    }
  }

  /**
   * Отримання метрик продуктивності
   * @returns {Object} Метрики продуктивності
   */
  getPerformanceMetrics() {
    try {
      // Перевіряємо підтримку API
      if (!window.performance) {
        return { supported: false };
      }

      // Отримуємо базові метрики
      const metrics = {
        supported: true,
        memory: window.performance.memory
          ? {
              usedJSHeapSize: window.performance.memory.usedJSHeapSize,
              totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            }
          : null,
        navigation: window.performance.navigation
          ? {
              type: window.performance.navigation.type,
              redirectCount: window.performance.navigation.redirectCount,
            }
          : null,
        timing: window.performance.timing
          ? {
              navigationStart: window.performance.timing.navigationStart,
              loadEventEnd: window.performance.timing.loadEventEnd,
              domComplete: window.performance.timing.domComplete,
              domInteractive: window.performance.timing.domInteractive,
            }
          : null,
      };

      // Якщо є timing API, розраховуємо часи завантаження
      if (window.performance.timing) {
        const timing = window.performance.timing;

        metrics.loadTimes = {
          total: timing.loadEventEnd - timing.navigationStart,
          domReady: timing.domComplete - timing.navigationStart,
          interactive: timing.domInteractive - timing.navigationStart,
        };
      }

      return metrics;
    } catch (error) {
      logger.error(error, 'Помилка отримання метрик продуктивності', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return {
        supported: false,
        error: error.message,
      };
    }
  }

  /**
   * Спроба відновлення невдалих модулів
   * @returns {Promise<Object>} Результат відновлення
   */
  async recoverFailedModules() {
    try {
      // Отримуємо ініціалізатор
      const initializer = dependencyContainer.resolve('TaskIntegration');
      if (!initializer) {
        logger.error(
          'Не вдалося отримати ініціалізатор для відновлення модулів',
          'recoverFailedModules',
          {
            category: LOG_CATEGORIES.LOGIC,
          }
        );

        return {
          success: false,
          message: 'Не вдалося отримати ініціалізатор',
          timestamp: Date.now(),
        };
      }

      // Отримуємо список невдалих критичних модулів
      const failedCritical = this.criticalModules.filter(
        (m) => initializer.state.moduleStates[m] === 'failed'
      );

      if (failedCritical.length === 0) {
        logger.info('Немає невдалих критичних модулів для відновлення', 'recoverFailedModules');
        return {
          success: true,
          message: 'Немає невдалих модулів для відновлення',
          timestamp: Date.now(),
        };
      }

      logger.info(
        `Спроба відновлення модулів: ${failedCritical.join(', ')}`,
        'recoverFailedModules'
      );

      // Результати відновлення
      const results = {};

      // Спробуємо ще раз ініціалізувати кожен модуль
      for (const moduleName of failedCritical) {
        try {
          // Оновлюємо лічильник спроб
          this.state.recoveryAttempts[moduleName] =
            (this.state.recoveryAttempts[moduleName] || 0) + 1;

          // Скидаємо стан модуля
          initializer.state.moduleStates[moduleName] = 'pending';

          // Видаляємо з списку невдалих
          const index = initializer.state.failedModules.indexOf(moduleName);
          if (index > -1) {
            initializer.state.failedModules.splice(index, 1);
          }

          // Спробуємо ініціалізувати знову
          const success = await initializer.initializeModule(moduleName);

          results[moduleName] = {
            success,
            attempts: this.state.recoveryAttempts[moduleName],
          };

          logger.info(
            `${success ? 'Успішно відновлено' : 'Не вдалося відновити'} модуль ${moduleName}`,
            'recoverFailedModules'
          );
        } catch (moduleError) {
          logger.error(moduleError, `Помилка при спробі відновлення модуля ${moduleName}`, {
            category: LOG_CATEGORIES.INIT,
            details: { moduleName },
          });

          results[moduleName] = {
            success: false,
            error: moduleError.message,
            attempts: this.state.recoveryAttempts[moduleName],
          };
        }
      }

      // Перевіряємо загальний результат
      const allSucceeded = Object.values(results).every((r) => r.success);

      return {
        success: allSucceeded,
        message: allSucceeded
          ? 'Всі модулі успішно відновлено'
          : 'Не вдалося відновити деякі модулі',
        results,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(error, 'Помилка при відновленні невдалих модулів', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return {
        success: false,
        message: 'Помилка при відновленні модулів',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Перевірка стану системи
   * @returns {Object} Стан системи
   */
  checkSystemHealth() {
    try {
      // Діагностуємо систему
      const diagnostic = this.diagnose();

      // Перевіряємо стан критичних модулів
      const initializer = dependencyContainer.resolve('TaskIntegration');

      // Якщо немає ініціалізатора, система нездорова
      if (!initializer) {
        return {
          healthy: false,
          message: 'Ініціалізатор системи не знайдено',
          timestamp: Date.now(),
        };
      }

      // Перевіряємо стан критичних модулів
      const moduleStates = initializer.state.moduleStates;
      const criticalModulesStatus = this.criticalModules.map((moduleName) => ({
        name: moduleName,
        state: moduleStates[moduleName] || 'unknown',
      }));

      // Визначаємо, чи система здорова
      const failedCritical = criticalModulesStatus.filter((m) => m.state === 'failed');
      const notFoundCritical = criticalModulesStatus.filter(
        (m) => m.state === 'not_found' || m.state === 'unknown'
      );

      const healthy = failedCritical.length === 0;
      const fullFunctional = failedCritical.length === 0 && notFoundCritical.length === 0;

      return {
        healthy,
        fullFunctional,
        message: healthy
          ? fullFunctional
            ? 'Система повністю функціональна'
            : 'Система працює, але деякі модулі відсутні'
          : 'Система містить невдалі модулі',
        criticalModules: criticalModulesStatus,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(error, 'Помилка перевірки стану системи', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return {
        healthy: false,
        message: 'Помилка перевірки стану системи',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }
}
