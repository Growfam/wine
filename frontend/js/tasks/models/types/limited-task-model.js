/**
 * Модель лімітованого завдання
 *
 * Розширює базову модель для завдань з обмеженим часом
 */

import { TaskModel } from 'js/tasks/models/base/index.js';
import { TASK_TYPES } from 'js/tasks/config/index.js';

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
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {LimitedTaskModel} Новий екземпляр лімітованого завдання
   */
  static fromApiData(apiData) {
    // Нормалізуємо дані
    const normalizedData = TaskModel.normalize(apiData);

    // Додаємо специфічні дані для лімітованих завдань
    return new LimitedTaskModel({
      ...normalizedData,
      start_date: apiData.start_date,
      end_date: apiData.end_date,
      max_completions: apiData.max_completions,
      current_completions: apiData.current_completions,
      priority: apiData.priority,
    });
  }

  /**
   * Перевірка, чи не закінчився термін виконання
   * @returns {boolean} Чи актуальне завдання
   */
  isWithinTimeFrame() {
    if (!this.end_date) return true;

    const endDate = new Date(this.end_date);
    const now = new Date();

    return endDate > now;
  }

  /**
   * Перевірка, чи не вичерпано ліміт виконань
   * @returns {boolean} Чи доступне завдання
   */
  isWithinCompletionLimit() {
    if (this.max_completions === null) return true;

    return this.current_completions < this.max_completions;
  }

  /**
   * Розрахунок залишку часу в мілісекундах
   * @returns {number|null} Залишок часу або null
   */
  getTimeLeftMs() {
    if (!this.end_date) return null;

    const endDate = new Date(this.end_date);
    const now = new Date();
    const timeLeft = endDate - now;

    return timeLeft > 0 ? timeLeft : 0;
  }

  /**
   * Форматування залишку часу
   * @returns {string} Форматований залишок часу
   */
  getFormattedTimeLeft() {
    const timeLeft = this.getTimeLeftMs();
    if (!timeLeft) return '';

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return days > 0 ? `${days}д ${hours}г` : `${hours}г ${minutes}хв`;
  }
}

export default LimitedTaskModel;
