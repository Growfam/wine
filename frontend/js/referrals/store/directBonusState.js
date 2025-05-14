/**
 * Сховище стану прямих бонусів за реферальною програмою
 *
 * Зберігає інформацію про нараховані бонуси, історію нарахувань,
 * стан завантаження та помилки
 *
 * @module directBonusState
 */

/**
 * Початковий стан для прямих бонусів
 */
export const initialDirectBonusState = {
  totalBonus: 0,                  // Загальна сума нарахованих бонусів
  history: [],                    // Історія нарахувань бонусів
  isLoading: false,               // Прапорець завантаження
  error: null                     // Помилка, якщо є
};

/**
 * Типи дій для роботи зі станом прямих бонусів
 */
export const DirectBonusActionTypes = {
  REGISTER_REFERRAL_REQUEST: 'REGISTER_REFERRAL_REQUEST',
  REGISTER_REFERRAL_SUCCESS: 'REGISTER_REFERRAL_SUCCESS',
  REGISTER_REFERRAL_FAILURE: 'REGISTER_REFERRAL_FAILURE',
  FETCH_DIRECT_BONUS_HISTORY_REQUEST: 'FETCH_DIRECT_BONUS_HISTORY_REQUEST',
  FETCH_DIRECT_BONUS_HISTORY_SUCCESS: 'FETCH_DIRECT_BONUS_HISTORY_SUCCESS',
  FETCH_DIRECT_BONUS_HISTORY_FAILURE: 'FETCH_DIRECT_BONUS_HISTORY_FAILURE',
  CLEAR_DIRECT_BONUS_ERROR: 'CLEAR_DIRECT_BONUS_ERROR'
};

/**
 * Редуктор для управління станом прямих бонусів
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const directBonusReducer = (state = initialDirectBonusState, action) => {
  switch (action.type) {
    case DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST:
    case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS:
      // Додаємо новий запис в історію та оновлюємо загальну суму
      return {
        ...state,
        isLoading: false,
        totalBonus: state.totalBonus + action.payload.bonusAmount,
        history: [
          action.payload,
          ...state.history
        ],
        error: null
      };

    case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS:
      // Оновлюємо історію та загальну суму на основі отриманих даних
      return {
        ...state,
        isLoading: false,
        totalBonus: action.payload.totalBonus,
        history: action.payload.history,
        error: null
      };

    case DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE:
    case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error
      };

    case DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default directBonusReducer;