/**
 * Сховище стану активності рефералів
 *
 * Відповідає за зберігання та управління станом активності рефералів.
 * Зберігає список активних рефералів, їх статуси та інформацію про активність.
 *
 * @module referralActivityState
 */

/**
 * Початковий стан для активності рефералів
 */
export const initialReferralActivityState = {
  // Дані про активних рефералів
  activeReferrals: {
    level1: [],                  // Активні реферали 1-го рівня
    level2: [],                  // Активні реферали 2-го рівня
    total: 0                     // Загальна кількість активних рефералів
  },

  // Загальна статистика активності
  activityStats: {
    totalReferrals: 0,           // Загальна кількість рефералів
    activeReferralsCount: 0,     // Кількість активних рефералів
    inactiveReferralsCount: 0,   // Кількість неактивних рефералів
    conversionRate: 0,           // Відсоток конверсії (активні/загальні)
    level1ConversionRate: 0,     // Відсоток конверсії для 1-го рівня
    level2ConversionRate: 0,     // Відсоток конверсії для 2-го рівня
    lastUpdated: null            // Дата останнього оновлення
  },

  // Статистика по причинам активності
  activityReasons: {
    drawsCriteria: 0,            // Кількість активних через розіграші
    invitedCriteria: 0,          // Кількість активних через запрошення
    bothCriteria: 0,             // Кількість активних через обидва критерії
    manualActivation: 0          // Кількість активних вручну
  },

  // Рекомендації щодо підвищення активності
  recommendations: [],           // Масив рекомендацій

  // Дані про потенційні активації
  potentialActivations: {
    closeToDrawsCriteria: 0,     // Кількість рефералів, близьких до активації через розіграші
    closeToInvitedCriteria: 0    // Кількість рефералів, близьких до активації через запрошення
  },

  // Стан запиту
  isLoading: false,              // Прапорець завантаження
  error: null                    // Помилка, якщо є
};

/**
 * Типи дій для роботи зі станом активності рефералів
 */
export const ReferralActivityActionTypes = {
  FETCH_REFERRAL_ACTIVITY_REQUEST: 'FETCH_REFERRAL_ACTIVITY_REQUEST',
  FETCH_REFERRAL_ACTIVITY_SUCCESS: 'FETCH_REFERRAL_ACTIVITY_SUCCESS',
  FETCH_REFERRAL_ACTIVITY_FAILURE: 'FETCH_REFERRAL_ACTIVITY_FAILURE',
  CHECK_REFERRAL_ACTIVITY_REQUEST: 'CHECK_REFERRAL_ACTIVITY_REQUEST',
  CHECK_REFERRAL_ACTIVITY_SUCCESS: 'CHECK_REFERRAL_ACTIVITY_SUCCESS',
  CHECK_REFERRAL_ACTIVITY_FAILURE: 'CHECK_REFERRAL_ACTIVITY_FAILURE',
  UPDATE_ACTIVITY_STATS: 'UPDATE_ACTIVITY_STATS',
  UPDATE_ACTIVITY_RECOMMENDATIONS: 'UPDATE_ACTIVITY_RECOMMENDATIONS',
  CLEAR_REFERRAL_ACTIVITY_ERROR: 'CLEAR_REFERRAL_ACTIVITY_ERROR'
};

/**
 * Редуктор для управління станом активності рефералів
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const referralActivityReducer = (state = initialReferralActivityState, action) => {
  switch (action.type) {
    case ReferralActivityActionTypes.FETCH_REFERRAL_ACTIVITY_REQUEST:
    case ReferralActivityActionTypes.CHECK_REFERRAL_ACTIVITY_REQUEST:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case ReferralActivityActionTypes.FETCH_REFERRAL_ACTIVITY_SUCCESS:
      // Оновлюємо дані про активність рефералів
      return {
        ...state,
        isLoading: false,
        activeReferrals: {
          level1: action.payload.level1.referrals.filter(ref => ref.isActive) || [],
          level2: action.payload.level2.referrals.filter(ref => ref.isActive) || [],
          total: action.payload.summary.active
        },
        activityStats: {
          totalReferrals: action.payload.summary.total,
          activeReferralsCount: action.payload.summary.active,
          inactiveReferralsCount: action.payload.summary.inactive,
          conversionRate: action.payload.summary.conversionRate,
          level1ConversionRate: action.payload.level1.total > 0
            ? action.payload.level1.active / action.payload.level1.total
            : 0,
          level2ConversionRate: action.payload.level2.total > 0
            ? action.payload.level2.active / action.payload.level2.total
            : 0,
          lastUpdated: new Date().toISOString()
        },
        error: null
      };

    case ReferralActivityActionTypes.CHECK_REFERRAL_ACTIVITY_SUCCESS:
      // Оновлюємо статистику та рекомендації на основі аналізу
      return {
        ...state,
        isLoading: false,
        activityStats: {
          ...state.activityStats,
          conversionRate: action.payload.conversionRate,
          lastUpdated: new Date().toISOString()
        },
        activityReasons: {
          drawsCriteria: action.payload.level1Analysis.activityReasons.drawsCriteria +
                         action.payload.level2Analysis.activityReasons.drawsCriteria,
          invitedCriteria: action.payload.level1Analysis.activityReasons.invitedCriteria +
                           action.payload.level2Analysis.activityReasons.invitedCriteria,
          bothCriteria: action.payload.level1Analysis.activityReasons.bothCriteria +
                        action.payload.level2Analysis.activityReasons.bothCriteria,
          manualActivation: action.payload.level1Analysis.activityReasons.manualActivation +
                            action.payload.level2Analysis.activityReasons.manualActivation
        },
        recommendations: action.payload.recommendations,
        potentialActivations: {
          closeToDrawsCriteria: action.payload.level1Analysis.potentialActivation.closeToDrawsCriteria +
                               action.payload.level2Analysis.potentialActivation.closeToDrawsCriteria,
          closeToInvitedCriteria: action.payload.level1Analysis.potentialActivation.closeToInvitedCriteria +
                                 action.payload.level2Analysis.potentialActivation.closeToInvitedCriteria
        },
        error: null
      };

    case ReferralActivityActionTypes.UPDATE_ACTIVITY_STATS:
      // Оновлюємо тільки статистику активності
      return {
        ...state,
        activityStats: {
          ...state.activityStats,
          ...action.payload,
          lastUpdated: new Date().toISOString()
        }
      };

    case ReferralActivityActionTypes.UPDATE_ACTIVITY_RECOMMENDATIONS:
      // Оновлюємо тільки рекомендації
      return {
        ...state,
        recommendations: action.payload
      };

    case ReferralActivityActionTypes.FETCH_REFERRAL_ACTIVITY_FAILURE:
    case ReferralActivityActionTypes.CHECK_REFERRAL_ACTIVITY_FAILURE:
      // Обробка помилок
      return {
        ...state,
        isLoading: false,
        error: action.payload.error
      };

    case ReferralActivityActionTypes.CLEAR_REFERRAL_ACTIVITY_ERROR:
      // Очищення помилки
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default referralActivityReducer;