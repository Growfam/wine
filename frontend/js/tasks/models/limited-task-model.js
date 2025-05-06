/**
 * Модель лімітованого завдання
 *
 * Розширює базову модель для завдань з обмеженим часом
 */

import { TaskModel } from './task-model.js';
import { TASK_TYPES } from '../config/task-types.js';

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
      priority: apiData.priority
    });
  }
}

export default LimitedTaskModel;