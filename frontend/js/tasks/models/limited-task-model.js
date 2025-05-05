/**
 * Модель лімітованого завдання
 *
 * Розширює базову модель для завдань з обмеженим часом
 */

import { TaskModel } from './task-model.js';
import { TASK_TYPES, TASK_STATUS } from '../config/task-types.js';

export class LimitedTaskModel extends TaskModel {
  /**
   * Конструктор моделі лімітованого завдання
   * @param {Object} data - Дані завдання
   */
  constructor(data = {}) {
    // Викликаємо батьківський конструктор
    super(data);

    // Встановлюємо тип завдання
    this.type = TASK_TYPES.LIMITED;

    // Розширюємо додатковими властивостями
    this.start_date = data.start_date || new Date().toISOString();
    this.end_date = data.end_date || '';
    this.max_completions = parseInt(data.max_completions) || null;
    this.current_completions = parseInt(data.current_completions) || 0;
    this.priority = parseInt(data.priority) || 1;

    // Відстеження статусу
    this.updateStatus();
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
    // Отримуємо базові дані
    const baseData = super.toApiData();

    // Додаємо специфічні дані
    return {
      ...baseData,
      start_date: this.start_date,
      end_date: this.end_date,
      max_completions: this.max_completions,
      current_completions: this.current_completions,
      priority: this.priority
    };
  }

  /**
   * Перетворення в формат для відображення
   * @returns {Object} Дані для відображення
   */
  toDisplayData() {
    // Отримуємо базові дані
    const baseData = super.toDisplayData();

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

    // Додаємо специфічні дані
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

  /**
   * Валідація даних лімітованого завдання
   * @returns {boolean} Результат валідації
   */
  isValid() {
    // Викликаємо базову валідацію
    if (!super.isValid()) {
      return false;
    }

    // Валідація дат
    if (this.start_date && this.end_date) {
      const startDate = new Date(this.start_date);
      const endDate = new Date(this.end_date);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {LimitedTaskModel} Новий екземпляр лімітованого завдання
   */
  static fromApiData(apiData) {
    // Нормалізуємо дані
    const normalizedData = TaskModel.normalize(apiData);

    // Створюємо екземпляр
    return new LimitedTaskModel({
      ...normalizedData,
      start_date: apiData.start_date,
      end_date: apiData.end_date,
      max_completions: apiData.max_completions,
      current_completions: apiData.current_completions,
      priority: apiData.priority
    });
  }
}

export default LimitedTaskModel;