/**
 * API для отримання даних про заробітки рефералів
 *
 * Надає функції для запиту інформації про заробітки та активність рефералів
 * на різних рівнях для подальшого обчислення відсоткових нарахувань
 *
 * @module fetchReferralEarnings
 */

/**
 * Отримує дані про заробітки рефералів різних рівнів
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки
 * @param {boolean} [options.activeOnly=false] - Враховувати тільки активних рефералів
 * @returns {Promise<Object>} Об'єкт з даними про заробітки рефералів
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralEarnings = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про заробітки');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/earnings/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання даних про заробітки');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про заробітки рефералів:', error);
    throw new Error(`Не вдалося отримати дані про заробітки: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує деталізовані дані про заробітки конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки
 * @returns {Promise<Object>} Об'єкт з детальними даними про заробітки
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralDetailedEarnings = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для отримання детальних даних');
  }

  try {
    // Формуємо URL з параметрами, якщо вони надані
    let url = `/api/referrals/earnings/detailed/${referralId}`;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += `?${params.toString()}`;
    }

    // Виконуємо запит до API
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання детальних даних про заробітки');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання детальних даних про заробітки:', error);
    throw new Error(`Не вдалося отримати детальні дані: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує зведену інформацію про заробітки користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Об'єкт зі зведеними даними про заробітки
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchEarningsSummary = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання зведених даних');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/earnings/summary/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання зведених даних про заробітки');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання зведених даних про заробітки:', error);
    throw new Error(`Не вдалося отримати зведені дані: ${error.message || 'Невідома помилка'}`);
  }
};

export default fetchReferralEarnings;