/**
 * Дії для оновлення статистики рефералів
 *
 * Містить дії (actions) для отримання та оновлення статистики рефералів,
 * викликає API та відповідні сервіси для розрахунків
 *
 * @module updateStatsAction
 */

import { ReferralLevelsActionTypes } from './referralLevelsState';
import { fetchReferralStats } from '../api/fetchReferralStats';
import { calculateLevel1Count } from '../services/calculateLevel1Count';
import { calculateLevel2Count } from '../services/calculateLevel2Count';

/**
 * Створює дію початку запиту статистики рефералів
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchReferralLevelsRequest = () => ({
  type: ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_REQUEST
});

/**
 * Створює дію успішного отримання статистики рефералів
 * @param {Object} data - Дані про статистику рефералів
 * @returns {Object} Об'єкт дії SUCCESS з даними про статистику
 */
export const fetchReferralLevelsSuccess = (data) => ({
  type: ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання статистики рефералів
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchReferralLevelsFailure = (error) => ({
  type: ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_FAILURE,
  payload: { error: error.message || 'Failed to fetch referral levels' }
});

/**
 * Створює дію оновлення кількості рефералів
 * @param {Object} counts - Об'єкт з даними про кількість рефералів
 * @returns {Object} Об'єкт дії UPDATE з даними про кількість
 */
export const updateReferralCounts = (counts) => ({
  type: ReferralLevelsActionTypes.UPDATE_REFERRAL_COUNTS,
  payload: counts
});

/**
 * Створює дію очищення помилки рівнів рефералів
 * @returns {Object} Об'єкт дії CLEAR_ERROR
 */
export const clearReferralLevelsError = () => ({
  type: ReferralLevelsActionTypes.CLEAR_REFERRAL_LEVELS_ERROR
});

/**
 * Асинхронна дія отримання статистики рефералів
 *
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для розрахунків
 * @param {boolean} [options.activeOnly=false] - Враховувати тільки активних рефералів
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchReferralLevels = (userId, options = {}) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchReferralLevelsRequest());

    try {
      // Отримуємо дані зі статистикою рефералів
      const statsData = await fetchReferralStats(userId);

      // Обчислюємо кількість рефералів 1-го рівня
      const level1Count = calculateLevel1Count(
        statsData.referrals.level1,
        options
      );

      // Обчислюємо кількість рефералів 2-го рівня
      const level2Count = calculateLevel2Count(
        statsData.referrals.level2,
        options
      );

      // Рахуємо кількість активних рефералів
      const activeLevel1Count = calculateLevel1Count(
        statsData.referrals.level1,
        { ...options, activeOnly: true }
      );

      const activeLevel2Count = calculateLevel2Count(
        statsData.referrals.level2,
        { ...options, activeOnly: true }
      );

      const activeReferralsCount = activeLevel1Count + activeLevel2Count;
      const totalReferralsCount = level1Count + level2Count;

      // Розраховуємо відсоток конверсії
      const conversionRate = totalReferralsCount > 0
        ? activeReferralsCount / totalReferralsCount
        : 0;

      // Формуємо результат
      const result = {
        level1Count,
        level2Count,
        level1Data: statsData.referrals.level1,
        level2Data: statsData.referrals.level2,
        activeReferralsCount,
        totalReferralsCount,
        conversionRate
      };

      // Диспатчимо успішне отримання
      dispatch(fetchReferralLevelsSuccess(result));

      return result;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchReferralLevelsFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія оновлення кількості рефералів без повного перезавантаження
 *
 * @param {Object} counts - Об'єкт з даними про кількість рефералів
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const updateReferralLevelCounts = (counts) => {
  return (dispatch) => {
    // Перевіряємо, що передано об'єкт
    if (!counts || typeof counts !== 'object') {
      throw new Error('Counts must be an object');
    }

    // Диспатчимо оновлення
    dispatch(updateReferralCounts(counts));

    return counts;
  };
};

export default {
  fetchReferralLevels,
  updateReferralLevelCounts,
  clearReferralLevelsError
};