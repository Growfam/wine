
/**
 * Сервіс генерації реферальних посилань
 *
 * Координує процес створення реферального посилання:
 * 1. Отримує дані з API
 * 2. Форматує посилання за допомогою утиліти форматування
 *
 * @param {string|number} userId - ID користувача
 * @returns {Promise<string>} Готове реферальне посилання
 * @throws {Error} Помилка при генерації посилання
 */

import { fetchReferralLink } from '../api/fetchReferralLink';
import { formatReferralUrl } from '../utils/formatReferralUrl';

/**
 * Генерує унікальне реферальне посилання для користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<string>} Унікальне реферальне посилання
 * @throws {Error} Помилка при генерації посилання
 */
export const generateReferralLink = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Отримуємо дані від API
    const referralId = await fetchReferralLink(userId);

    // Форматуємо URL
    return formatReferralUrl(referralId);
  } catch (error) {
    console.error('Error generating referral link:', error);
    throw new Error('Failed to generate referral link');
  }
};

export default generateReferralLink;