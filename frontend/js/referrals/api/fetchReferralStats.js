/**
 * API для отримання статистики рефералів
 *
 * Отримує дані про кількість рефералів різних рівнів
 * та їх структуру для подальшої обробки
 *
 * @module fetchReferralStats
 */

/**
 * Отримує статистику по рефералах користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Об'єкт з даними про рефералів
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralStats = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for fetching referral statistics');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/stats/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch referral statistics');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral statistics:', error);
    throw new Error('Failed to fetch referral statistics: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Отримує детальну інформацію про конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @returns {Promise<Object>} Об'єкт з даними про реферала
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralDetails = async (referralId) => {
  if (!referralId) {
    throw new Error('Referral ID is required');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/details/${referralId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch referral details');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral details:', error);
    throw new Error('Failed to fetch referral details');
  }
};

export default fetchReferralStats;