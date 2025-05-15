/**
 * Дії для реєстрації нових рефералів та нарахування бонусів
 *
 * Містить дії (actions) для реєстрації нових рефералів,
 * нарахування бонусів та отримання історії нарахувань
 *
 * @module registerReferralAction
 */

import { DirectBonusActionTypes } from './directBonusState';
import { registerReferral } from '../api/registerReferral';
import { calculateDirectBonus } from '../services/calculateDirectBonus';

/**
 * Створює дію початку запиту реєстрації реферала
 * @returns {Object} Об'єкт дії REQUEST
 */
export const registerReferralRequest = () => ({
  type: DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST
});

/**
 * Створює дію успішної реєстрації реферала
 * @param {Object} data - Дані про зареєстрованого реферала
 * @returns {Object} Об'єкт дії SUCCESS з даними про реферала
 */
export const registerReferralSuccess = (data) => ({
  type: DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалої реєстрації реферала
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const registerReferralFailure = (error) => ({
  type: DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE,
  payload: { error: error.message || 'Failed to register referral' }
});

/**
 * Створює дію початку запиту історії бонусів
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchDirectBonusHistoryRequest = () => ({
  type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST
});

/**
 * Створює дію успішного отримання історії бонусів
 * @param {Object} data - Дані про історію бонусів
 * @returns {Object} Об'єкт дії SUCCESS з даними про історію
 */
export const fetchDirectBonusHistorySuccess = (data) => ({
  type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання історії бонусів
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchDirectBonusHistoryFailure = (error) => ({
  type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE,
  payload: { error: error.message || 'Failed to fetch bonus history' }
});

/**
 * Створює дію очищення помилки прямих бонусів
 * @returns {Object} Об'єкт дії CLEAR_ERROR
 */
export const clearDirectBonusError = () => ({
  type: DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR
});

/**
 * Асинхронна дія реєстрації нового реферала та нарахування бонусу
 *
 * @param {string|number} referrerId - ID користувача, який запросив
 * @param {string|number} userId - ID нового користувача (реферала)
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const registerReferralAndAwardBonus = (referrerId, userId) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(registerReferralRequest());

    try {
      // Реєструємо реферала через API
      const registrationData = await registerReferral(referrerId, userId);

      // Розраховуємо бонус за реферала
      const bonusAmount = calculateDirectBonus(1); // За одного реферала

      // Формуємо дані про нарахування бонусу
      const bonusData = {
        referrerId,
        userId,
        timestamp: registrationData.timestamp || new Date().toISOString(),
        bonusAmount,
        type: 'direct_bonus'
      };

      // Диспатчимо успішне нарахування бонусу
      dispatch(registerReferralSuccess(bonusData));

      return bonusData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(registerReferralFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія для отримання історії нарахувань бонусів
 *
 * @param {string|number} userId - ID користувача
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchDirectBonusHistory = (userId) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchDirectBonusHistoryRequest());

    try {
      // Викликаємо реальний API-запит до бекенду
      const response = await fetch(`/api/referrals/direct-bonus/history/${userId}`);

      // Перевіряємо відповідь
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to fetch bonus history');
      }

      // Отримуємо дані
      const historyData = await response.json();

      // Диспатчимо успішне отримання історії
      dispatch(fetchDirectBonusHistorySuccess(historyData));

      return historyData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchDirectBonusHistoryFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

export default {
  registerReferralAndAwardBonus,
  fetchDirectBonusHistory,
  clearDirectBonusError
};