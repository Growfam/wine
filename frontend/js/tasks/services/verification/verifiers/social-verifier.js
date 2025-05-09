/**
 * Верифікатор соціальних завдань
 *
 * Відповідає за:
 * - Перевірку виконання соціальних завдань
 * - Взаємодію з API соціальних мереж для верифікації
 */

import { BaseVerifier } from './base-verifier.js';
import { SOCIAL_NETWORKS } from '../../../config';

export class SocialVerifier extends BaseVerifier {
  /**
   * Верифікація соціального завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      if (!task) {
        return this.createErrorResult(taskId, 'Не вдалося отримати дані завдання');
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
            action_type: task.action_type || 'visit',
          },
        };

        // Запит до API для верифікації
        return await this.performApiVerification(taskId, verificationData);
      }

      // Якщо тип соціальної мережі не визначено, повертаємо помилку
      console.warn(`Не вдалося визначити тип соціальної мережі для завдання ${taskId}`);

      return this.createErrorResult(taskId, 'Не вдалося визначити тип соціальної мережі');
    } catch (error) {
      console.error(`Помилка при верифікації соціального завдання ${taskId}:`, error);
      return this.createErrorResult(
        taskId,
        'Сталася помилка під час перевірки завдання',
        error.message
      );
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

      if (
        url.includes('t.me/') ||
        url.includes('telegram.') ||
        title.includes('telegram') ||
        description.includes('telegram')
      ) {
        return SOCIAL_NETWORKS.TELEGRAM;
      }

      if (
        url.includes('twitter.') ||
        url.includes('x.com') ||
        title.includes('twitter') ||
        description.includes('twitter')
      ) {
        return SOCIAL_NETWORKS.TWITTER;
      }

      if (
        url.includes('discord.') ||
        title.includes('discord') ||
        description.includes('discord')
      ) {
        return SOCIAL_NETWORKS.DISCORD;
      }

      if (
        url.includes('facebook.') ||
        url.includes('fb.') ||
        title.includes('facebook') ||
        description.includes('facebook')
      ) {
        return SOCIAL_NETWORKS.FACEBOOK;
      }

      return null;
    } catch (error) {
      console.warn('Помилка при визначенні типу соціальної мережі:', error);
      return null;
    }
  }
}

export default SocialVerifier;
