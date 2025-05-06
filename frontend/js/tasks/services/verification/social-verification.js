/**
 * Верифікатор соціальних завдань
 *
 * Відповідає за:
 * - Перевірку виконання соціальних завдань
 * - Взаємодію з API соціальних мереж для верифікації
 */

import { VERIFICATION_STATUS, SOCIAL_NETWORKS } from '../../config/task-types.js';
import errorHandler, { ERROR_CATEGORIES } from '../../utils/error-handler.js';
import taskApi from '../task-api.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('SocialVerification');

class SocialVerifier {
  /**
   * Верифікація соціального завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      if (!task) {
        const noDataError = new Error('Не вдалося отримати дані завдання');
        moduleErrors.error(noDataError, `Відсутні дані для соціального завдання ${taskId}`, {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.ERROR,
          message: 'Не вдалося отримати дані завдання'
        };
      }

      // Визначаємо тип соціальної мережі
      const socialType = task.platform || this.determineSocialNetwork(task);

      // Додаткова перевірка соціальної мережі
      if (socialType) {
        // Додаткові дані для верифікації соціального завдання
        const verificationData = {
          platform: socialType.toLowerCase(),
          verification_type: 'social',
          task_data: {
            platform: socialType.toLowerCase(),
            action_type: task.action_type || 'visit'
          }
        };

        // Запит до API для верифікації
        return await this.performApiVerification(taskId, verificationData);
      }

      // Якщо тип соціальної мережі не визначено, повертаємо помилку
      moduleErrors.warning(`Не вдалося визначити тип соціальної мережі для завдання ${taskId}`, 'verify', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId, task }
      });

      return {
        success: false,
        status: VERIFICATION_STATUS.ERROR,
        message: 'Не вдалося визначити тип соціальної мережі'
      };
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації соціального завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      throw error;
    }
  }

  /**
   * Визначення типу соціальної мережі
   * @param {Object} task - Дані завдання
   * @returns {string|null} Тип соціальної мережі
   */
  determineSocialNetwork(task) {
    if (!task || (!task.action_url && !task.channel_url)) return null;

    try {
      const url = (task.channel_url || task.action_url).toLowerCase();
      const title = (task.title || '').toLowerCase();
      const description = (task.description || '').toLowerCase();

      if (url.includes('t.me/') || url.includes('telegram.') ||
          title.includes('telegram') || description.includes('telegram')) {
        return SOCIAL_NETWORKS.TELEGRAM;
      }

      if (url.includes('twitter.') || url.includes('x.com') ||
          title.includes('twitter') || description.includes('twitter')) {
        return SOCIAL_NETWORKS.TWITTER;
      }

      if (url.includes('discord.') ||
          title.includes('discord') || description.includes('discord')) {
        return SOCIAL_NETWORKS.DISCORD;
      }

      if (url.includes('facebook.') || url.includes('fb.') ||
          title.includes('facebook') || description.includes('facebook')) {
        return SOCIAL_NETWORKS.FACEBOOK;
      }

      return null;
    } catch (error) {
      moduleErrors.warning(error, 'Помилка при визначенні типу соціальної мережі', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { task }
      });
      return null;
    }
  }

  /**
   * Виконання API запиту для верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат верифікації
   */
  async performApiVerification(taskId, verificationData = {}) {
    try {
      // Викликаємо API для верифікації
      const response = await taskApi.verifyTask(taskId, verificationData);

      // Обробляємо відповідь
      if (response.status === 'success') {
        moduleErrors.info(`Завдання ${taskId} успішно виконано`, 'performApiVerification', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, verificationData }
        });

        return {
          success: true,
          status: VERIFICATION_STATUS.SUCCESS,
          message: response.message || 'Завдання успішно виконано!',
          reward: response.data?.reward || null,
          verification_details: response.data?.verification || {},
          response_time_ms: Date.now() - (response.requestTime || Date.now())
        };
      } else {
        moduleErrors.warning(`Верифікація завдання ${taskId} невдала`, 'performApiVerification', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, response, verificationData }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.FAILURE,
          message: response.message || response.error || 'Не вдалося перевірити виконання завдання',
          error: response.error
        };
      }
    } catch (error) {
      throw error;
    }
  }
}

// Створюємо і експортуємо єдиний екземпляр
const socialVerifier = new SocialVerifier();
export default socialVerifier;