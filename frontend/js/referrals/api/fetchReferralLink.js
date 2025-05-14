/**
 * API функція отримання реферальних даних
 *
 * Отримує дані для реферального посилання з бекенду
 * При тестуванні можна використовувати моковані дані
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
    // В реальному додатку тут був би запит до API
    // const response = await fetch(`/api/referral/link/${userId}`);
    // const data = await response.json();
    // return data.referralId;

    // Для тестування використовуємо моковані дані
    // Імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 300));

    // Моковані дані - просто повертаємо userId як referralId
    // В реальному додатку referralId буде отриманий з бекенду
    return userId.toString();
  } catch (error) {
    console.error('Error fetching referral link:', error);
    throw new Error('Failed to fetch referral link from server');
  }
};

export default fetchReferralLink;