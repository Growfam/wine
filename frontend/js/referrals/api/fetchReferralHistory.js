/**
 * API для отримання історії реферальної активності
 * Повертає часову лінію подій, пов'язаних з рефералами
 *
 * @module referral/api/fetchReferralHistory
 */

/**
 * Отримує повну історію реферальної активності користувача
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції запиту
 * @param {Date|string} [options.startDate] - Початкова дата для фільтрації
 * @param {Date|string} [options.endDate] - Кінцева дата для фільтрації
 * @param {number} [options.limit] - Обмеження кількості результатів
 * @param {string} [options.type] - Тип подій для фільтрації ('referral', 'bonus', 'reward', 'badge', 'task', 'draw')
 * @returns {Promise<Array>} Масив подій у хронологічному порядку
 */
export const fetchReferralHistory = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Формуємо URL з параметрами запиту
    let url = `/api/referrals/history/${userId}`;

    // Додаємо query params з опцій
    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    if (options.type) {
      queryParams.append('type', options.type);
    }

    // Додаємо query params до URL, якщо вони є
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch referral history');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral history:', error);
    throw new Error(`Failed to fetch referral history: ${error.message}`);
  }
};

/**
 * Отримує історію конкретного типу реферальної активності
 *
 * @param {string} userId - ID користувача
 * @param {string} eventType - Тип подій ('referral', 'bonus', 'reward', 'badge', 'task', 'draw')
 * @param {Object} [options] - Опції запиту
 * @returns {Promise<Array>} Масив подій вказаного типу
 */
export const fetchReferralEventHistory = async (userId, eventType, options = {}) => {
  if (!userId || !eventType) {
    throw new Error('userId and eventType are required');
  }

  try {
    // Формуємо URL з параметрами запиту
    let url = `/api/referrals/history/event/${userId}/${eventType}`;

    // Додаємо query params з опцій
    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    // Додаємо query params до URL, якщо вони є
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch ${eventType} history`);
    }

    return data;
  } catch (error) {
    console.error(`Error fetching ${eventType} history:`, error);
    throw new Error(`Failed to fetch ${eventType} history: ${error.message}`);
  }
};

/**
 * Отримує агреговану статистику реферальної активності за період
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції запиту
 * @param {Date|string} [options.startDate] - Початкова дата періоду
 * @param {Date|string} [options.endDate] - Кінцева дата періоду
 * @returns {Promise<Object>} Агрегована статистика
 */
export const fetchReferralActivitySummary = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Формуємо URL з параметрами запиту
    let url = `/api/referrals/history/summary/${userId}`;

    // Додаємо query params з опцій
    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    // Додаємо query params до URL, якщо вони є
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch referral activity summary');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral activity summary:', error);
    throw new Error(`Failed to fetch referral activity summary: ${error.message}`);
  }
};

/**
 * Отримує статистику реферальної активності по періодах (щоденно, щотижнево, щомісячно)
 *
 * @param {string} userId - ID користувача
 * @param {string} period - Період ('daily', 'weekly', 'monthly')
 * @param {Object} [options] - Опції запиту
 * @returns {Promise<Array>} Масив з агрегованою статистикою по періодах
 */
export const fetchReferralActivityTrend = async (userId, period = 'monthly', options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Формуємо URL з параметрами запиту
    let url = `/api/referrals/history/trend/${userId}/${period}`;

    // Додаємо query params з опцій
    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    // Додаємо query params до URL, якщо вони є
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch referral activity trend');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral activity trend:', error);
    throw new Error(`Failed to fetch referral activity trend: ${error.message}`);
  }
};