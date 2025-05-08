/**
 * Валідація даних завдання
 *
 * Містить функції для перевірки коректності даних завдань
 */

import { TASK_TYPES } from '../../config';

/**
 * Перевірка обов'язкових полів завдання
 * @param {Object} task - Завдання для перевірки
 * @returns {boolean} Результат перевірки
 */
export function validateRequiredFields(task) {
  // Перевірка обов'язкових полів
  if (!task.id || !task.title) {
    return false;
  }

  // Перевірка винагороди
  if (task.reward_amount <= 0) {
    return false;
  }

  // Перевірка цільового значення
  if (task.target_value <= 0) {
    return false;
  }

  return true;
}

/**
 * Перевірка валідності дат
 * @param {Object} task - Завдання для перевірки
 * @returns {boolean} Результат перевірки
 */
export function validateDates(task) {
  if (task.start_date && task.end_date) {
    const startDate = new Date(task.start_date);
    const endDate = new Date(task.end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      return false;
    }
  }
  return true;
}

/**
 * Перевірка партнерських даних
 * @param {Object} task - Завдання для перевірки
 * @returns {boolean} Результат перевірки
 */
export function validatePartnerData(task) {
  if (task.type === TASK_TYPES.PARTNER) {
    // Валідація партнерських даних
    if (!task.partner_name || !task.partner_url) {
      return false;
    }
  }
  return true;
}

/**
 * Перевірка даних соціального завдання
 * @param {Object} task - Завдання для перевірки
 * @returns {boolean} Результат перевірки
 */
export function validateSocialData(task) {
  if (task.type === TASK_TYPES.SOCIAL || task.type === TASK_TYPES.REFERRAL) {
    // Валідація URL
    if (task.requires_verification && !task.channel_url) {
      return false;
    }
  }
  return true;
}

/**
 * Загальна валідація завдання
 * @param {Object} task - Завдання для перевірки
 * @returns {boolean} Результат валідації
 */
export function isValidTask(task) {
  // Перевірка обов'язкових полів
  if (!validateRequiredFields(task)) {
    return false;
  }

  // Додаткова валідація в залежності від типу завдання
  switch (task.type) {
    case TASK_TYPES.LIMITED:
      if (!validateDates(task)) {
        return false;
      }
      break;

    case TASK_TYPES.PARTNER:
      if (!validatePartnerData(task)) {
        return false;
      }
      break;

    case TASK_TYPES.SOCIAL:
    case TASK_TYPES.REFERRAL:
      if (!validateSocialData(task)) {
        return false;
      }
      break;
  }

  return true;
}