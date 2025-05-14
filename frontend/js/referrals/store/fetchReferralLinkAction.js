/**
 * Дії для роботи з реферальним посиланням
 *
 * Містить дії (actions) для отримання реферального посилання.
 * Диспатчить стани REQUEST, SUCCESS, FAILURE.
 *
 * @module fetchReferralLinkAction
 */

import { ReferralLinkActionTypes } from './referralLinkState';
import { generateReferralLink } from '../services/generateReferralLink';

/**
 * Створює дію початку запиту реферального посилання
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchReferralLinkRequest = () => ({
  type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST
});

/**
 * Створює дію успішного отримання реферального посилання
 * @param {string} link - Реферальне посилання
 * @returns {Object} Об'єкт дії SUCCESS з посиланням
 */
export const fetchReferralLinkSuccess = (link) => ({
  type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS,
  payload: { link }
});

/**
 * Створює дію невдалого отримання реферального посилання
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchReferralLinkFailure = (error) => ({
  type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE,
  payload: { error: error.message || 'Failed to fetch referral link' }
});

/**
 * Створює дію очищення помилки реферального посилання
 * @returns {Object} Об'єкт дії CLEAR_ERROR
 */
export const clearReferralLinkError = () => ({
  type: ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR
});

/**
 * Асинхронна дія отримання реферального посилання
 *
 * @param {string|number} userId - ID користувача
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchReferralLink = (userId) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchReferralLinkRequest());

    try {
      // Отримуємо посилання за допомогою сервісу
      const link = await generateReferralLink(userId);

      // Диспатчимо успішне отримання
      dispatch(fetchReferralLinkSuccess(link));

      return link;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchReferralLinkFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

export default fetchReferralLink;