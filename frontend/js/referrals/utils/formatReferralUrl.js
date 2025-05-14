/**
 * Функція форматування реферального URL
 *
 * @param {string|number} userId - ID користувача
 * @returns {string} Сформатоване реферальне посилання
 * @throws {Error} Помилка при відсутності userId
 */

import { REFERRAL_URL_PATTERN } from '../constants/urlPatterns';

/**
 * Форматує реферальне посилання на основі ID користувача
 * @param {string|number} userId - ID користувача
 * @returns {string} Сформатоване реферальне посилання
 * @throws {Error} Помилка при відсутності userId
 */
export const formatReferralUrl = (userId) => {
  if (!userId) {
    throw new Error('User ID is required for generating referral link');
  }

  // Валідація userId
  if (typeof userId !== 'string' && typeof userId !== 'number') {
    throw new Error('User ID must be a string or number');
  }

  // Заміна плейсхолдера {id} на фактичний userId
  return REFERRAL_URL_PATTERN.replace('{id}', userId);
};

export default formatReferralUrl;
