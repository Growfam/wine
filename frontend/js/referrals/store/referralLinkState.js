/**
 * Сховище стану реферального посилання
 *
 * Відповідає за зберігання та управління станом реферального посилання.
 * Зберігає посилання, стан завантаження та помилки.
 *
 * @module referralLinkState
 */

/**
 * Початковий стан для реферального посилання
 */
export const initialReferralLinkState = {
  link: null,          // Реферальне посилання
  isLoading: false,    // Прапорець завантаження
  error: null          // Помилка, якщо є
};

/**
 * Типи дій для роботи зі станом реферального посилання
 */
export const ReferralLinkActionTypes = {
  FETCH_REFERRAL_LINK_REQUEST: 'FETCH_REFERRAL_LINK_REQUEST',
  FETCH_REFERRAL_LINK_SUCCESS: 'FETCH_REFERRAL_LINK_SUCCESS',
  FETCH_REFERRAL_LINK_FAILURE: 'FETCH_REFERRAL_LINK_FAILURE',
  CLEAR_REFERRAL_LINK_ERROR: 'CLEAR_REFERRAL_LINK_ERROR'
};

/**
 * Редуктор для управління станом реферального посилання
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const referralLinkReducer = (state = initialReferralLinkState, action) => {
  switch (action.type) {
    case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS:
      return {
        ...state,
        isLoading: false,
        link: action.payload.link,
        error: null
      };

    case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error
      };

    case ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default referralLinkReducer;