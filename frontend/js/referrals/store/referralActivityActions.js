/**
 * Дії для роботи з активністю рефералів
 *
 * Містить дії (actions) для отримання, перевірки та аналізу активності рефералів.
 * Взаємодіє з API та сервісами для визначення активності рефералів.
 *
 * @module referralActivityActions
 */

import { ReferralActivityActionTypes } from './referralActivityState';
import { checkReferralsActivity, checkReferralActivity, analyzeReferralsActivity } from '../services/checkReferralActivity';

/**
 * Створює дію початку запиту активності рефералів
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchReferralActivityRequest = () => ({
  type: ReferralActivityActionTypes.FETCH_REFERRAL_ACTIVITY_REQUEST
});

/**
 * Створює дію успішного отримання активності рефералів
 * @param {Object} data - Дані про активність рефералів
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const fetchReferralActivitySuccess = (data) => ({
  type: ReferralActivityActionTypes.FETCH_REFERRAL_ACTIVITY_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання активності рефералів
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchReferralActivityFailure = (error) => ({
  type: ReferralActivityActionTypes.FETCH_REFERRAL_ACTIVITY_FAILURE,
  payload: { error: error.message || 'Помилка отримання даних про активність' }
});

/**
 * Створює дію початку запиту аналізу активності
 * @returns {Object} Об'єкт дії REQUEST
 */
export const checkReferralActivityRequest = () => ({
  type: ReferralActivityActionTypes.CHECK_REFERRAL_ACTIVITY_REQUEST
});

/**
 * Створює дію успішного аналізу активності
 * @param {Object} data - Результат аналізу активності
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const checkReferralActivitySuccess = (data) => ({
  type: ReferralActivityActionTypes.CHECK_REFERRAL_ACTIVITY_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого аналізу активності
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const checkReferralActivityFailure = (error) => ({
  type: ReferralActivityActionTypes.CHECK_REFERRAL_ACTIVITY_FAILURE,
  payload: { error: error.message || 'Помилка аналізу активності' }
});

/**
 * Створює дію оновлення статистики активності
 * @param {Object} stats - Оновлені дані статистики
 * @returns {Object} Об'єкт дії UPDATE з даними
 */
export const updateActivityStats = (stats) => ({
  type: ReferralActivityActionTypes.UPDATE_ACTIVITY_STATS,
  payload: stats
});

/**
 * Створює дію оновлення рекомендацій
 * @param {Array} recommendations - Масив рекомендацій
 * @returns {Object} Об'єкт дії UPDATE з даними
 */
export const updateActivityRecommendations = (recommendations) => ({
  type: ReferralActivityActionTypes.UPDATE_ACTIVITY_RECOMMENDATIONS,
  payload: recommendations
});

/**
 * Створює дію очищення помилки
 * @returns {Object} Об'єкт дії CLEAR_ERROR
 */
export const clearReferralActivityError = () => ({
  type: ReferralActivityActionTypes.CLEAR_REFERRAL_ACTIVITY_ERROR
});

/**
 * Асинхронна дія для отримання даних про активність рефералів
 *
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {number} [options.level] - Рівень рефералів для перевірки (1, 2 або всі)
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchReferralActivity = (userId, options = {}) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchReferralActivityRequest());

    try {
      // Отримуємо дані про активність рефералів
      const activityData = await checkReferralsActivity(
        userId,
        { ...options, includeDetails: true }
      );

      // Диспатчимо успішне отримання даних
      dispatch(fetchReferralActivitySuccess(activityData));

      return activityData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchReferralActivityFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія для аналізу активності рефералів
 *
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для аналізу
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const checkReferralsActivityWithAnalysis = (userId, options = {}) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(checkReferralActivityRequest());

    try {
      // Отримуємо результат аналізу активності
      const analysisData = await analyzeReferralsActivity(userId);

      // Диспатчимо успішний аналіз
      dispatch(checkReferralActivitySuccess(analysisData));

      return analysisData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(checkReferralActivityFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія для перевірки активності конкретного реферала
 *
 * @param {string|number} referralId - ID реферала
 * @param {Object} [options] - Додаткові опції для перевірки
 * @returns {Promise<Object>} Результат перевірки активності
 */
export const checkSingleReferralActivity = (referralId, options = {}) => {
  return async () => {
    try {
      // Перевіряємо активність реферала
      const activityResult = await checkReferralActivity(referralId, options);
      return activityResult;
    } catch (error) {
      console.error('Помилка перевірки активності реферала:', error);
      throw error;
    }
  };
};

export default {
  fetchReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  updateActivityStats,
  updateActivityRecommendations,
  clearReferralActivityError
};