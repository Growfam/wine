/**
 * Дії для комплексного розрахунку винагород
 * Координує роботу різних сервісів для отримання повних даних про винагороди
 *
 * @module referral/store/calculateRewardsAction
 */

import { calculateTotalEarnings, predictFutureEarnings, calculateReferralROI, analyzeEarningsDistribution } from '../services/calculateTotalEarnings';
import { formatWinixAmount } from '../utils/formatWinixAmount';

/**
 * Типи дій для роботи з розрахунком винагород
 */
export const CalculateRewardsActionTypes = {
  // Запит на загальний розрахунок винагород
  CALCULATE_TOTAL_REWARDS_REQUEST: 'CALCULATE_TOTAL_REWARDS_REQUEST',
  CALCULATE_TOTAL_REWARDS_SUCCESS: 'CALCULATE_TOTAL_REWARDS_SUCCESS',
  CALCULATE_TOTAL_REWARDS_FAILURE: 'CALCULATE_TOTAL_REWARDS_FAILURE',

  // Запит на прогноз майбутніх винагород
  PREDICT_FUTURE_REWARDS_REQUEST: 'PREDICT_FUTURE_REWARDS_REQUEST',
  PREDICT_FUTURE_REWARDS_SUCCESS: 'PREDICT_FUTURE_REWARDS_SUCCESS',
  PREDICT_FUTURE_REWARDS_FAILURE: 'PREDICT_FUTURE_REWARDS_FAILURE',

  // Запит на розрахунок ROI
  CALCULATE_ROI_REQUEST: 'CALCULATE_ROI_REQUEST',
  CALCULATE_ROI_SUCCESS: 'CALCULATE_ROI_SUCCESS',
  CALCULATE_ROI_FAILURE: 'CALCULATE_ROI_FAILURE',

  // Запит на аналіз розподілу винагород
  ANALYZE_REWARDS_DISTRIBUTION_REQUEST: 'ANALYZE_REWARDS_DISTRIBUTION_REQUEST',
  ANALYZE_REWARDS_DISTRIBUTION_SUCCESS: 'ANALYZE_REWARDS_DISTRIBUTION_SUCCESS',
  ANALYZE_REWARDS_DISTRIBUTION_FAILURE: 'ANALYZE_REWARDS_DISTRIBUTION_FAILURE',

  // Запит на комплексний аналіз винагород
  COMPREHENSIVE_REWARDS_ANALYSIS_REQUEST: 'COMPREHENSIVE_REWARDS_ANALYSIS_REQUEST',
  COMPREHENSIVE_REWARDS_ANALYSIS_SUCCESS: 'COMPREHENSIVE_REWARDS_ANALYSIS_SUCCESS',
  COMPREHENSIVE_REWARDS_ANALYSIS_FAILURE: 'COMPREHENSIVE_REWARDS_ANALYSIS_FAILURE',

  // Очищення помилок
  CLEAR_REWARDS_CALCULATION_ERROR: 'CLEAR_REWARDS_CALCULATION_ERROR'
};

/**
 * Початковий стан для розрахунку винагород
 */
export const initialCalculateRewardsState = {
  // Загальні винагороди
  totalRewards: {
    data: null,
    isLoading: false,
    error: null
  },

  // Прогноз майбутніх винагород
  futureRewards: {
    data: null,
    isLoading: false,
    error: null
  },

  // Розрахунок ROI
  roi: {
    data: null,
    isLoading: false,
    error: null
  },

  // Аналіз розподілу винагород
  distribution: {
    data: null,
    isLoading: false,
    error: null
  },

  // Комплексний аналіз винагород
  comprehensiveAnalysis: {
    data: null,
    isLoading: false,
    error: null
  }
};

/**
 * Редуктор для управління станом розрахунку винагород
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const calculateRewardsReducer = (state = initialCalculateRewardsState, action) => {
  switch (action.type) {
    // Обробка запиту на загальний розрахунок винагород
    case CalculateRewardsActionTypes.CALCULATE_TOTAL_REWARDS_REQUEST:
      return {
        ...state,
        totalRewards: {
          ...state.totalRewards,
          isLoading: true,
          error: null
        }
      };

    case CalculateRewardsActionTypes.CALCULATE_TOTAL_REWARDS_SUCCESS:
      return {
        ...state,
        totalRewards: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case CalculateRewardsActionTypes.CALCULATE_TOTAL_REWARDS_FAILURE:
      return {
        ...state,
        totalRewards: {
          ...state.totalRewards,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на прогноз майбутніх винагород
    case CalculateRewardsActionTypes.PREDICT_FUTURE_REWARDS_REQUEST:
      return {
        ...state,
        futureRewards: {
          ...state.futureRewards,
          isLoading: true,
          error: null
        }
      };

    case CalculateRewardsActionTypes.PREDICT_FUTURE_REWARDS_SUCCESS:
      return {
        ...state,
        futureRewards: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case CalculateRewardsActionTypes.PREDICT_FUTURE_REWARDS_FAILURE:
      return {
        ...state,
        futureRewards: {
          ...state.futureRewards,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на розрахунок ROI
    case CalculateRewardsActionTypes.CALCULATE_ROI_REQUEST:
      return {
        ...state,
        roi: {
          ...state.roi,
          isLoading: true,
          error: null
        }
      };

    case CalculateRewardsActionTypes.CALCULATE_ROI_SUCCESS:
      return {
        ...state,
        roi: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case CalculateRewardsActionTypes.CALCULATE_ROI_FAILURE:
      return {
        ...state,
        roi: {
          ...state.roi,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на аналіз розподілу винагород
    case CalculateRewardsActionTypes.ANALYZE_REWARDS_DISTRIBUTION_REQUEST:
      return {
        ...state,
        distribution: {
          ...state.distribution,
          isLoading: true,
          error: null
        }
      };

    case CalculateRewardsActionTypes.ANALYZE_REWARDS_DISTRIBUTION_SUCCESS:
      return {
        ...state,
        distribution: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case CalculateRewardsActionTypes.ANALYZE_REWARDS_DISTRIBUTION_FAILURE:
      return {
        ...state,
        distribution: {
          ...state.distribution,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на комплексний аналіз винагород
    case CalculateRewardsActionTypes.COMPREHENSIVE_REWARDS_ANALYSIS_REQUEST:
      return {
        ...state,
        comprehensiveAnalysis: {
          ...state.comprehensiveAnalysis,
          isLoading: true,
          error: null
        }
      };

    case CalculateRewardsActionTypes.COMPREHENSIVE_REWARDS_ANALYSIS_SUCCESS:
      return {
        ...state,
        comprehensiveAnalysis: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case CalculateRewardsActionTypes.COMPREHENSIVE_REWARDS_ANALYSIS_FAILURE:
      return {
        ...state,
        comprehensiveAnalysis: {
          ...state.comprehensiveAnalysis,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Очищення помилок
    case CalculateRewardsActionTypes.CLEAR_REWARDS_CALCULATION_ERROR:
      return {
        ...state,
        totalRewards: {
          ...state.totalRewards,
          error: null
        },
        futureRewards: {
          ...state.futureRewards,
          error: null
        },
        roi: {
          ...state.roi,
          error: null
        },
        distribution: {
          ...state.distribution,
          error: null
        },
        comprehensiveAnalysis: {
          ...state.comprehensiveAnalysis,
          error: null
        }
      };

    default:
      return state;
  }
};

/**
 * Дія для розрахунку загальних винагород
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції розрахунку
 * @returns {Function} Функція-дія для диспатчера
 */
export const calculateTotalRewardsAction = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: CalculateRewardsActionTypes.CALCULATE_TOTAL_REWARDS_REQUEST });

      // Розраховуємо загальні винагороди
      const rewards = await calculateTotalEarnings(userId, options);

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: CalculateRewardsActionTypes.CALCULATE_TOTAL_REWARDS_SUCCESS,
        payload: rewards
      });

      return rewards;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: CalculateRewardsActionTypes.CALCULATE_TOTAL_REWARDS_FAILURE,
        payload: { error: error.message || 'Failed to calculate total rewards' }
      });

      throw error;
    }
  };
};

/**
 * Дія для прогнозу майбутніх винагород
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції прогнозу
 * @returns {Function} Функція-дія для диспатчера
 */
export const predictFutureRewardsAction = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: CalculateRewardsActionTypes.PREDICT_FUTURE_REWARDS_REQUEST });

      // Прогнозуємо майбутні винагороди
      const predictions = await predictFutureEarnings(userId, options);

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: CalculateRewardsActionTypes.PREDICT_FUTURE_REWARDS_SUCCESS,
        payload: predictions
      });

      return predictions;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: CalculateRewardsActionTypes.PREDICT_FUTURE_REWARDS_FAILURE,
        payload: { error: error.message || 'Failed to predict future rewards' }
      });

      throw error;
    }
  };
};

/**
 * Дія для розрахунку ROI
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції розрахунку
 * @returns {Function} Функція-дія для диспатчера
 */
export const calculateROIAction = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: CalculateRewardsActionTypes.CALCULATE_ROI_REQUEST });

      // Розраховуємо ROI
      const roi = await calculateReferralROI(userId, options);

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: CalculateRewardsActionTypes.CALCULATE_ROI_SUCCESS,
        payload: roi
      });

      return roi;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: CalculateRewardsActionTypes.CALCULATE_ROI_FAILURE,
        payload: { error: error.message || 'Failed to calculate ROI' }
      });

      throw error;
    }
  };
};

/**
 * Дія для аналізу розподілу винагород
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції аналізу
 * @returns {Function} Функція-дія для диспатчера
 */
export const analyzeRewardsDistributionAction = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: CalculateRewardsActionTypes.ANALYZE_REWARDS_DISTRIBUTION_REQUEST });

      // Аналізуємо розподіл винагород
      const distribution = await analyzeEarningsDistribution(userId, options);

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: CalculateRewardsActionTypes.ANALYZE_REWARDS_DISTRIBUTION_SUCCESS,
        payload: distribution
      });

      return distribution;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: CalculateRewardsActionTypes.ANALYZE_REWARDS_DISTRIBUTION_FAILURE,
        payload: { error: error.message || 'Failed to analyze rewards distribution' }
      });

      throw error;
    }
  };
};

/**
 * Дія для комплексного аналізу винагород
 * Виконує всі розрахунки і надає повну картину реферальної активності
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції аналізу
 * @returns {Function} Функція-дія для диспатчера
 */
export const comprehensiveRewardsAnalysisAction = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: CalculateRewardsActionTypes.COMPREHENSIVE_REWARDS_ANALYSIS_REQUEST });

      // Виконуємо всі розрахунки паралельно
      const [totalRewards, futureRewards, roi, distribution] = await Promise.all([
        calculateTotalEarnings(userId, { includeDetails: true }),
        predictFutureEarnings(userId),
        calculateReferralROI(userId, options),
        analyzeEarningsDistribution(userId)
      ]);

      // Формуємо комплексний аналіз
      const analysis = {
        totalRewards,
        futureRewards,
        roi,
        distribution,
        summary: {
          currentEarnings: totalRewards.totalEarnings,
          formattedTotal: totalRewards.formattedTotal,
          projectedAnnualEarnings: futureRewards.predictions.reduce((total, month) => total + month.monthlyEarnings, 0),
          roi: roi.roi,
          topEarningCategory: Object.entries(totalRewards.percentages)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => ({
              category: key,
              percentage: value,
              amount: totalRewards.earnings[key]
            }))[0],
          recommendedActions: generateRecommendations(totalRewards, roi, distribution)
        }
      };

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: CalculateRewardsActionTypes.COMPREHENSIVE_REWARDS_ANALYSIS_SUCCESS,
        payload: analysis
      });

      return analysis;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: CalculateRewardsActionTypes.COMPREHENSIVE_REWARDS_ANALYSIS_FAILURE,
        payload: { error: error.message || 'Failed to perform comprehensive rewards analysis' }
      });

      throw error;
    }
  };
};

/**
 * Дія для очищення помилок розрахунку
 *
 * @returns {Object} Дія для диспатчера
 */
export const clearRewardsCalculationError = () => ({
  type: CalculateRewardsActionTypes.CLEAR_REWARDS_CALCULATION_ERROR
});

/**
 * Генерує рекомендації на основі аналізу винагород
 *
 * @param {Object} totalRewards - Дані про загальні винагороди
 * @param {Object} roi - Дані про ROI
 * @param {Object} distribution - Дані про розподіл винагород
 * @returns {Array} Масив рекомендацій
 */
const generateRecommendations = (totalRewards, roi, distribution) => {
  const recommendations = [];

  // Аналізуємо розподіл винагород
  const categories = Object.entries(totalRewards.percentages)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ category: key, percentage: value }));

  // Рекомендація 1: Фокус на найбільш прибутковому каналі
  if (categories.length > 0) {
    const topCategory = categories[0];

    // Перетворюємо назву категорії на зрозумілу користувачу
    let categoryName = topCategory.category;
    switch (categoryName) {
      case 'directBonuses':
        categoryName = 'прямі бонуси за реєстрацію рефералів';
        break;
      case 'percentageRewards':
        categoryName = 'відсоткові винагороди';
        break;
      case 'badgeRewards':
        categoryName = 'винагороди за бейджі';
        break;
      case 'taskRewards':
        categoryName = 'винагороди за завдання';
        break;
      case 'drawsRewards':
        categoryName = 'винагороди за розіграші';
        break;
    }

    recommendations.push({
      title: 'Фокус на найбільш прибутковому каналі',
      description: `Зосередьтеся на ${categoryName}, оскільки вони складають ${topCategory.percentage.toFixed(1)}% вашого заробітку.`,
      priority: 'high'
    });
  }

  // Рекомендація 2: Підвищення ROI
  if (roi.roi < 100) {
    recommendations.push({
      title: 'Підвищення рентабельності',
      description: 'Ваш поточний ROI є низьким. Спробуйте оптимізувати зусилля, зосереджуючись на найбільш ефективних стратегіях залучення рефералів.',
      priority: 'high'
    });
  } else if (roi.roi < 200) {
    recommendations.push({
      title: 'Збільшення масштабу',
      description: 'Ваш ROI є позитивним. Розгляньте можливість збільшення масштабу вашої реферальної активності для максимізації прибутку.',
      priority: 'medium'
    });
  }

  // Рекомендація 3: Балансування джерел доходу
  const lowCategories = categories.filter(cat => cat.percentage < 10);
  if (lowCategories.length > 0 && categories[0].percentage > 50) {
    recommendations.push({
      title: 'Балансування джерел доходу',
      description: 'Ваші джерела доходу незбалансовані. Розгляньте можливість диверсифікації, щоб зменшити залежність від одного джерела.',
      priority: 'medium'
    });
  }

  // Рекомендація 4: Сезонні тренди
  if (distribution.periods && distribution.periods.length > 3) {
    // Розрахунок варіації доходів за періодами
    const earnings = distribution.periods.map(p => p.totalEarnings);
    const avgEarnings = earnings.reduce((sum, e) => sum + e, 0) / earnings.length;
    const variance = earnings.reduce((sum, e) => sum + Math.pow(e - avgEarnings, 2), 0) / earnings.length;
    const stdDev = Math.sqrt(variance);

    // Коефіцієнт варіації (CV) - міра відносного розкиду
    const cv = (stdDev / avgEarnings) * 100;

    if (cv > 30) {
      recommendations.push({
        title: 'Врахування сезонності',
        description: 'Спостерігається висока варіація доходів за періодами. Аналізуйте сезонні тренди і плануйте активність відповідно.',
        priority: 'medium'
      });
    }
  }

  // Рекомендація 5: Загальне підвищення активності
  if (totalRewards.totalEarnings < 10000) {
    recommendations.push({
      title: 'Підвищення загальної активності',
      description: 'Ваш загальний заробіток від реферальної програми є низьким. Розгляньте можливість активнішого залучення нових рефералів.',
      priority: 'high'
    });
  }

  return recommendations;
};