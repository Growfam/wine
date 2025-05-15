/**
 * API для отримання даних про активність рефералів
 *
 * Надає функції для запиту інформації про активність рефералів:
 * - кількість участей в розіграшах
 * - кількість запрошених користувачів
 * - статус ручної активації
 *
 * @module fetchReferralActivity
 */

/**
 * Отримує дані про активність рефералів
 * @param {string|number} userId - ID користувача, чиїх рефералів потрібно перевірити
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки активності
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки активності
 * @param {number} [options.level] - Рівень рефералів (1 або 2)
 * @returns {Promise<Object>} Об'єкт з даними про активність рефералів
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralActivity = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про активність');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/activity/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про активність рефералів:', error);
    throw new Error(`Не вдалося отримати дані про активність: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує детальні дані про активність конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки активності
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки активності
 * @returns {Promise<Object>} Об'єкт з детальними даними про активність
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralDetailedActivity = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для отримання детальних даних');
  }

  try {
    // Формуємо URL з параметрами, якщо вони надані
    let url = `/api/referrals/activity/detailed/${referralId}`;
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
      throw new Error(data.error || data.message || 'Помилка отримання детальних даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання детальних даних про активність:', error);
    throw new Error(`Не вдалося отримати детальні дані: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує агреговані дані про активність всіх рефералів
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Об'єкт з агрегованими даними
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchActivitySummary = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про активність');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch(`/api/referrals/activity/summary/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання зведених даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання зведених даних про активність:', error);
    throw new Error(`Не вдалося отримати зведені дані: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Оновлює активність реферала
 * @param {string|number} userId - ID користувача (реферала)
 * @param {number} [drawsParticipation] - Кількість участей в розіграшах
 * @param {number} [invitedReferrals] - Кількість запрошених рефералів
 * @returns {Promise<Object>} Результат оновлення активності
 * @throws {Error} Помилка при оновленні даних
 */
export const updateReferralActivity = async (userId, drawsParticipation, invitedReferrals) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для оновлення активності');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch('/api/referrals/activity/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        draws_participation: drawsParticipation,
        invited_referrals: invitedReferrals
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка оновлення даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка оновлення даних про активність:', error);
    throw new Error(`Не вдалося оновити дані про активність: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Ручна активація реферала адміністратором
 * @param {string|number} userId - ID користувача (реферала)
 * @param {string|number} adminId - ID адміністратора
 * @returns {Promise<Object>} Результат активації
 * @throws {Error} Помилка при активації
 */
export const manuallyActivateReferral = async (userId, adminId) => {
  if (!userId || !adminId) {
    throw new Error('ID користувача та адміністратора обов\'язкові для ручної активації');
  }

  try {
    // Виконуємо запит до API
    const response = await fetch('/api/referrals/activity/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        admin_id: adminId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка ручної активації реферала');
    }

    return data;
  } catch (error) {
    console.error('Помилка ручної активації реферала:', error);
    throw new Error(`Не вдалося активувати реферала: ${error.message || 'Невідома помилка'}`);
  }
};

export default fetchReferralActivity;