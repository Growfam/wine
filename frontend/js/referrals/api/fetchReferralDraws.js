/**
 * API для отримання даних про участь рефералів у розіграшах
 *
 * @module referral/api/fetchReferralDraws
 */

/**
 * Отримує дані про участь реферала у розіграшах
 *
 * @param {string} referralId - ID реферала
 * @returns {Promise<Object>} Дані про участь у розіграшах
 */
export const fetchReferralDraws = async (referralId) => {
  if (!referralId) {
    throw new Error('referralId is required');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/draws/${referralId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch referral draws data');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral draws:', error);
    throw new Error('Failed to fetch referral draws data');
  }
};

/**
 * Отримує детальні дані про участь реферала у конкретному розіграші
 *
 * @param {string} referralId - ID реферала
 * @param {string} drawId - ID розіграшу
 * @returns {Promise<Object>} Деталі участі у розіграші
 */
export const fetchDrawDetails = async (referralId, drawId) => {
  if (!referralId || !drawId) {
    throw new Error('referralId and drawId are required');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/draws/details/${referralId}/${drawId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch draw details');
    }

    return data;
  } catch (error) {
    console.error('Error fetching draw details:', error);
    throw new Error('Failed to fetch draw details');
  }
};

/**
 * Отримує статистику участі рефералів у розіграшах за період
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {Object} [options] - Опції запиту
 * @param {Date} [options.startDate] - Початкова дата періоду
 * @param {Date} [options.endDate] - Кінцева дата періоду
 * @returns {Promise<Object>} Статистика участі рефералів у розіграшах
 */
export const fetchDrawsParticipationStats = async (ownerId, options = {}) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Формуємо URL з параметрами, якщо вони надані
    let url = `/api/referrals/draws/stats/${ownerId}`;
    const params = new URLSearchParams();

    if (options.startDate) {
      params.append('startDate', options.startDate instanceof Date
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      params.append('endDate', options.endDate instanceof Date
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Виконуємо запит до API
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch draws participation stats');
    }

    return data;
  } catch (error) {
    console.error('Error fetching draws participation stats:', error);
    throw new Error('Failed to fetch draws participation stats');
  }
};

/**
 * Отримує загальну кількість розіграшів, у яких брали участь реферали
 *
 * @param {string} ownerId - ID власника рефералів
 * @returns {Promise<number>} Загальна кількість розіграшів
 */
export const fetchTotalDrawsCount = async (ownerId) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/draws/count/${ownerId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch total draws count');
    }

    return data.totalDrawsCount || 0;
  } catch (error) {
    console.error('Error fetching total draws count:', error);
    throw new Error('Failed to fetch total draws count');
  }
};

/**
 * Отримує список найактивніших рефералів за участю в розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {number} [limit=10] - Кількість рефералів для включення в список
 * @returns {Promise<Array>} Список найактивніших рефералів
 */
export const fetchMostActiveInDraws = async (ownerId, limit = 10) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/draws/active/${ownerId}?limit=${limit}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch most active referrals in draws');
    }

    return data;
  } catch (error) {
    console.error('Error fetching most active referrals in draws:', error);
    throw new Error('Failed to fetch most active referrals in draws');
  }
};