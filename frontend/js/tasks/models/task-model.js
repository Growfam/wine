/**
 * Базова модель завдання
 *
 * Відповідає за:
 * - Зберігання основних даних завдання
 * - Валідацію даних
 * - Форматування для відображення
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
   * Перетворення в формат для відправки на сервер
   * @returns {Object} Форматовані дані
   */
  toApiData() {
    return {
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
  }

  /**
   * Перетворення в формат для відображення
   * @returns {Object} Дані для відображення
   */
  toDisplayData() {
    return {
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

    return this;
  }
}

export default TaskModel;