/**
 * Базова модель завдання
 *
 * Відповідає за:
 * - Зберігання основних даних завдання
 * - Валідацію даних
 * - Форматування для відображення
 * - Спільну логіку для всіх типів завдань
 */

import { TASK_TYPES, REWARD_TYPES, TASK_STATUS } from '../config/task-types.js';

export class TaskModel {
  /**
   * Конструктор базової моделі завдання
   * @param {Object} data - Дані завдання
   */
  constructor(data = {}) {
    // Базові властивості
    this.id = data.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.title = data.title || 'Нове завдання';
    this.description = data.description || 'Опис відсутній';
    this.type = data.type || TASK_TYPES.SOCIAL;
    this.action_type = data.action_type || 'generic';
    this.action_url = data.action_url || '';
    this.action_label = data.action_label || 'Виконати';

    // Налаштування винагороди
    this.reward_type = data.reward_type || REWARD_TYPES.TOKENS;
    this.reward_amount = parseFloat(data.reward_amount) || 10;

    // Налаштування прогресу
    this.target_value = parseInt(data.target_value) || 1;
    this.progress_label = data.progress_label || '';

    // Статус завдання
    this.status = data.status || TASK_STATUS.PENDING;

    // Метадані
    this.created_at = data.created_at || new Date().toISOString();
    this.tags = Array.isArray(data.tags) ? [...data.tags] : [];

    // Додаткові дані, спільні для всіх типів завдань
    this.start_date = data.start_date || new Date().toISOString();
    this.end_date = data.end_date || '';
    this.max_completions = parseInt(data.max_completions) || null;
    this.current_completions = parseInt(data.current_completions) || 0;
    this.priority = parseInt(data.priority) || 1;

    // Дані для партнерських завдань
    this.partner_name = data.partner_name || '';
    this.partner_logo = data.partner_logo || '';
    this.partner_url = data.partner_url || data.action_url || '';
    this.partner_id = data.partner_id || '';
    this.revenue_share = parseFloat(data.revenue_share) || 0;
    this.category = data.category || '';
    this.external_tracking_id = data.external_tracking_id || '';
    this.conversion_type = data.conversion_type || 'visit';

    // Дані для соціальних завдань
    this.platform = data.platform || this.detectPlatform(data.action_url);
    this.channel_name = data.channel_name || '';
    this.channel_url = data.channel_url || data.action_url || '';
    this.platform_user_id = data.platform_user_id || '';
    this.requires_verification = data.requires_verification !== false;

    // Ініціалізація та оновлення даних
    this.updateStatus();
  }

  /**
   * Нормалізація даних завдання
   * @param {Object} data - Дані завдання
   * @returns {Object} Нормалізовані дані
   */
  static normalize(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    // Базова нормалізація
    const normalized = {
      id: data.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: data.title || 'Завдання',
      description: data.description || 'Опис відсутній',
      type: data.type || TASK_TYPES.SOCIAL
    };

    // Нормалізація типу винагороди
    if (data.reward_type) {
      const lowerType = data.reward_type.toLowerCase();
      normalized.reward_type = (lowerType.includes('token') || lowerType.includes('winix')) ?
        REWARD_TYPES.TOKENS : REWARD_TYPES.COINS;
    } else {
      normalized.reward_type = REWARD_TYPES.TOKENS;
    }

    // Нормалізація суми винагороди
    normalized.reward_amount = parseFloat(data.reward_amount) || 10;

    // Нормалізація цільового значення
    normalized.target_value = parseInt(data.target_value) || 1;

    return normalized;
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {TaskModel} Новий екземпляр завдання
   */
  static fromApiData(apiData) {
    return new TaskModel(TaskModel.normalize(apiData));
  }

  /**
   * Визначення платформи на основі URL
   * @param {string} url - URL дії
   * @returns {string} Тип соціальної мережі
   */
  detectPlatform(url) {
    if (!url) return '';

    url = url.toLowerCase();

    if (url.includes('t.me/') || url.includes('telegram.')) {
      return 'telegram';
    }

    if (url.includes('twitter.') || url.includes('x.com')) {
      return 'twitter';
    }

    if (url.includes('discord.')) {
      return 'discord';
    }

    if (url.includes('facebook.') || url.includes('fb.')) {
      return 'facebook';
    }

    return '';
  }

  /**
   * Оновлення статусу завдання відповідно до часових обмежень
   */
  updateStatus() {
    // Якщо завдання вже виконано, не змінюємо статус
    if (this.status === TASK_STATUS.COMPLETED) {
      return;
    }

    // Перевіряємо, чи не закінчився термін виконання
    if (this.end_date) {
      const endDate = new Date(this.end_date);
      const now = new Date();

      if (endDate <= now) {
        this.status = TASK_STATUS.EXPIRED;
        return;
      }
    }

    // Перевіряємо, чи не перевищено ліміт виконань
    if (this.max_completions !== null && this.current_completions >= this.max_completions) {
      this.status = TASK_STATUS.EXPIRED;
      return;
    }

    // Перевіряємо, чи вже почався термін виконання
    if (this.start_date) {
      const startDate = new Date(this.start_date);
      const now = new Date();

      if (startDate > now) {
        this.status = TASK_STATUS.PENDING;
        return;
      }
    }

    // Якщо все в порядку, статус стає активним
    if (this.status === TASK_STATUS.PENDING || this.status === TASK_STATUS.EXPIRED) {
      this.status = TASK_STATUS.STARTED;
    }
  }

  /**
   * Перевірка, чи завдання активне
   * @returns {boolean} Чи завдання активне
   */
  isActive() {
    this.updateStatus();
    return this.status !== TASK_STATUS.EXPIRED && this.status !== TASK_STATUS.PENDING;
  }

  /**
   * Перетворення в формат для відправки на сервер
   * @returns {Object} Форматовані дані
   */
  toApiData() {
    const baseData = {
      id: this.id,
      title: this.title,
      description: this.description,
      type: this.type,
      action_type: this.action_type,
      action_url: this.action_url,
      reward_type: this.reward_type,
      reward_amount: this.reward_amount,
      target_value: this.target_value,
      status: this.status,
      tags: this.tags
    };

    // Додаткові дані в залежності від типу завдання
    switch (this.type) {
      case TASK_TYPES.LIMITED:
        return {
          ...baseData,
          start_date: this.start_date,
          end_date: this.end_date,
          max_completions: this.max_completions,
          current_completions: this.current_completions,
          priority: this.priority
        };

      case TASK_TYPES.PARTNER:
        return {
          ...baseData,
          partner_name: this.partner_name,
          partner_logo: this.partner_logo,
          partner_url: this.partner_url,
          partner_id: this.partner_id,
          revenue_share: this.revenue_share,
          category: this.category,
          external_tracking_id: this.external_tracking_id,
          conversion_type: this.conversion_type
        };

      case TASK_TYPES.SOCIAL:
      case TASK_TYPES.REFERRAL:
        return {
          ...baseData,
          platform: this.platform,
          channel_name: this.channel_name,
          channel_url: this.channel_url,
          platform_user_id: this.platform_user_id,
          requires_verification: this.requires_verification
        };

      default:
        return baseData;
    }
  }

  /**
   * Перетворення в формат для відображення
   * @returns {Object} Дані для відображення
   */
  toDisplayData() {
    // Базові дані для відображення
    const baseData = {
      id: this.id,
      title: this.title,
      description: this.description,
      type: this.type,
      action_label: this.action_label,
      reward: {
        type: this.reward_type,
        amount: this.reward_amount,
        formatted: `${this.reward_amount} ${this.reward_type === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів'}`
      },
      progress: {
        current: 0,
        target: this.target_value,
        percent: 0,
        label: this.progress_label
      },
      status: this.status
    };

    // Додаткові дані в залежності від типу завдання
    switch (this.type) {
      case TASK_TYPES.LIMITED: {
        // Розраховуємо залишок часу
        let timeLeft = null;
        let timeLeftFormatted = '';

        if (this.end_date) {
          const endDate = new Date(this.end_date);
          const now = new Date();
          timeLeft = endDate - now;

          if (timeLeft > 0) {
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            timeLeftFormatted = days > 0 ?
              `${days}д ${hours}г` :
              `${hours}г ${minutes}хв`;
          }
        }

        return {
          ...baseData,
          start_date: this.start_date,
          end_date: this.end_date,
          timeLeft,
          timeLeftFormatted,
          isExpired: this.status === TASK_STATUS.EXPIRED,
          max_completions: this.max_completions,
          current_completions: this.current_completions,
          priority: this.priority
        };
      }

      case TASK_TYPES.PARTNER:
        return {
          ...baseData,
          partner_name: this.partner_name,
          partner_logo: this.partner_logo,
          partner_url: this.partner_url,
          category: this.category,
          conversion_type: this.conversion_type,
          isPartner: true
        };

      case TASK_TYPES.SOCIAL:
      case TASK_TYPES.REFERRAL: {
        // Додаємо іконку платформи
        let platformIcon = '';
        switch (this.platform) {
          case 'telegram':
            platformIcon = '📱';
            break;
          case 'twitter':
            platformIcon = '🐦';
            break;
          case 'discord':
            platformIcon = '💬';
            break;
          case 'facebook':
            platformIcon = '👍';
            break;
          default:
            platformIcon = '🌐';
        }

        return {
          ...baseData,
          platform: this.platform,
          platformIcon,
          channel_name: this.channel_name,
          action_type: this.action_type
        };
      }

      default:
        return baseData;
    }
  }

  /**
   * Валідація даних завдання
   * @returns {boolean} Результат валідації
   */
  isValid() {
    // Перевірка обов'язкових полів
    if (!this.id || !this.title) {
      return false;
    }

    // Перевірка винагороди
    if (this.reward_amount <= 0) {
      return false;
    }

    // Перевірка цільового значення
    if (this.target_value <= 0) {
      return false;
    }

    // Додаткова валідація в залежності від типу завдання
    switch (this.type) {
      case TASK_TYPES.LIMITED:
        // Валідація дат
        if (this.start_date && this.end_date) {
          const startDate = new Date(this.start_date);
          const endDate = new Date(this.end_date);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
            return false;
          }
        }
        break;

      case TASK_TYPES.PARTNER:
        // Валідація партнерських даних
        if (!this.partner_name || !this.partner_url) {
          return false;
        }
        break;

      case TASK_TYPES.SOCIAL:
      case TASK_TYPES.REFERRAL:
        // Валідація URL
        if (this.requires_verification && !this.channel_url) {
          return false;
        }
        break;
    }

    return true;
  }

  /**
   * Оновлення даних завдання
   * @param {Object} newData - Нові дані
   * @returns {TaskModel} Оновлена модель
   */
  update(newData) {
    if (!newData || typeof newData !== 'object') {
      return this;
    }

    // Оновлюємо базові властивості
    Object.keys(newData).forEach(key => {
      if (this.hasOwnProperty(key) && key !== 'id') {
        this[key] = newData[key];
      }
    });

    // Оновлюємо статус
    this.updateStatus();

    return this;
  }

  /**
   * Створення трекінгового URL з UTM-мітками (для партнерських завдань)
   * @param {string} userId - ID користувача
   * @returns {string} URL з трекінгом
   */
  getTrackingUrl(userId) {
    if (!this.partner_url && !this.action_url) {
      return '';
    }

    try {
      const url = new URL(this.partner_url || this.action_url);

      // Додаємо базові UTM параметри
      url.searchParams.append('utm_source', 'winix');
      url.searchParams.append('utm_medium', 'quest');
      url.searchParams.append('utm_campaign', this.id);

      // Додаємо ID користувача, якщо є
      if (userId) {
        url.searchParams.append('utm_term', userId);
      }

      // Додаємо партнерський ID та зовнішній трекінг, якщо є
      if (this.partner_id) {
        url.searchParams.append('partner_id', this.partner_id);
      }

      if (this.external_tracking_id) {
        url.searchParams.append('tracking_id', this.external_tracking_id);
      }

      return url.toString();
    } catch (error) {
      console.error('Помилка створення трекінгового URL:', error);
      return this.partner_url || this.action_url;
    }
  }
}

export default TaskModel;