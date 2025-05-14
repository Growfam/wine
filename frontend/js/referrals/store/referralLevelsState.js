/**
 * Сховище для зберігання стану рівнів рефералів
 *
 * Зберігає інформацію про кількість рефералів 1-го та 2-го рівнів,
 * їх статуси, дані, а також стан завантаження та помилки
 *
 * @module referralLevelsState
 */

/**
 * Початковий стан для рівнів рефералів
 */
export const initialReferralLevelsState = {
  level1Count: 0,                 // Кількість рефералів 1-го рівня
  level2Count: 0,                 // Кількість рефералів 2-го рівня
  level1Data: [],                 // Дані про рефералів 1-го рівня
  level2Data: [],                 // Дані про рефералів 2-го рівня
  activeReferralsCount: 0,        // Кількість активних рефералів
  totalReferralsCount: 0,         // Загальна кількість рефералів
  conversionRate: 0,              // Відсоток конверсії
  lastUpdated: null,              // Дата останнього оновлення
  isLoading: false,               // Прапорець завантаження
  error: null                     // Помилка, якщо є
};

/**
 * Типи дій для роботи зі станом рівнів рефералів
 */
export const ReferralLevelsActionTypes = {
  FETCH_REFERRAL_LEVELS_REQUEST: 'FETCH_REFERRAL_LEVELS_REQUEST',
  FETCH_REFERRAL_LEVELS_SUCCESS: 'FETCH_REFERRAL_LEVELS_SUCCESS',
  FETCH_REFERRAL_LEVELS_FAILURE: 'FETCH_REFERRAL_LEVELS_FAILURE',
  UPDATE_REFERRAL_COUNTS: 'UPDATE_REFERRAL_COUNTS',
  CLEAR_REFERRAL_LEVELS_ERROR: 'CLEAR_REFERRAL_LEVELS_ERROR'
};

/**
 * Редуктор для управління станом рівнів рефералів
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const referralLevelsReducer = (state = initialReferralLevelsState, action) => {
  switch (action.type) {
    case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_REQUEST:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        level1Count: action.payload.level1Count,
        level2Count: action.payload.level2Count,
        level1Data: action.payload.level1Data || [],
        level2Data: action.payload.level2Data || [],
        activeReferralsCount: action.payload.activeReferralsCount || 0,
        totalReferralsCount: action.payload.totalReferralsCount || 0,
        conversionRate: action.payload.conversionRate || 0,
        lastUpdated: new Date().toISOString(),
        error: null
      };

    case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error
      };

    case ReferralLevelsActionTypes.UPDATE_REFERRAL_COUNTS:
      return {
        ...state,
        level1Count: action.payload.level1Count !== undefined
          ? action.payload.level1Count
          : state.level1Count,
        level2Count: action.payload.level2Count !== undefined
          ? action.payload.level2Count
          : state.level2Count,
        activeReferralsCount: action.payload.activeReferralsCount !== undefined
          ? action.payload.activeReferralsCount
          : state.activeReferralsCount,
        totalReferralsCount: action.payload.totalReferralsCount !== undefined
          ? action.payload.totalReferralsCount
          : state.totalReferralsCount,
        lastUpdated: new Date().toISOString()
      };

    case ReferralLevelsActionTypes.CLEAR_REFERRAL_LEVELS_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default referralLevelsReducer;