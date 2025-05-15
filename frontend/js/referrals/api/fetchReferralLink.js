/**
 * API функція отримання реферальних даних
 *
 * Отримує дані для реферального посилання з бекенду
 *
 * @param {string|number} userId - ID користувача
 * @returns {Promise<string>} Реферальний ID
 * @throws {Error} Помилка при запиті до API
 */

/**
 * Отримує реферальний ID користувача з бекенду
 * @param {string|number} userId - ID користувача
 * @returns {Promise<string>} Реферальний ID
 * @throws {Error} Помилка при запиті до API
 */
export const fetchReferralLink = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for fetching referral link');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/link/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch referral link from server');
    }

    // Повертаємо реферальне посилання або ID, якщо посилання відсутнє
    return data.referral_link || userId.toString();
  } catch (error) {
    console.error('Error fetching referral link:', error);
    throw new Error('Failed to fetch referral link from server');
  }
};

export default fetchReferralLink;