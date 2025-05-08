/**
 * Головний файл експорту моделей завдань
 *
 * Експортує всі моделі та утиліти для роботи з завданнями
 */

// Експорт базових компонентів
export * from './base';

// Експорт конкретних типів моделей
export * from './types';

// Створення фабрики для зручного використання
import { TASK_TYPES } from '../config';
import { TaskModel } from './base';
import { SocialTaskModel } from './types/social-task-model';
import { LimitedTaskModel } from './types/limited-task-model';
import { PartnerTaskModel } from './types/partner-task-model';

/**
 * Створює модель завдання відповідного типу
 * @param {string} type - Тип завдання
 * @param {Object} data - Дані завдання
 * @returns {TaskModel} Екземпляр відповідної моделі
 */
export function createTaskModel(type, data = {}) {
  switch (type) {
    case TASK_TYPES.SOCIAL:
      return new SocialTaskModel(data);
    case TASK_TYPES.LIMITED:
      return new LimitedTaskModel(data);
    case TASK_TYPES.PARTNER:
      return new PartnerTaskModel(data);
    case TASK_TYPES.REFERRAL:
      return new SocialTaskModel(data); // Реферальні завдання використовують ту ж модель
    default:
      return new TaskModel(data);
  }
}
