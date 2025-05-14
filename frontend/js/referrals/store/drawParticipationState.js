/**
 * Стан для управління даними про участь рефералів у розіграшах
 *
 * @module referral/store/drawParticipationState
 */

/**
 * Типи дій для роботи зі станом участі в розіграшах
 */
export const DrawParticipationActionTypes = {
  // Запит на отримання даних про участь реферала в розіграшах
  FETCH_REFERRAL_DRAWS_REQUEST: 'FETCH_REFERRAL_DRAWS_REQUEST',
  FETCH_REFERRAL_DRAWS_SUCCESS: 'FETCH_REFERRAL_DRAWS_SUCCESS',
  FETCH_REFERRAL_DRAWS_FAILURE: 'FETCH_REFERRAL_DRAWS_FAILURE',

  // Запит на отримання статистики участі всіх рефералів
  FETCH_DRAWS_STATS_REQUEST: 'FETCH_DRAWS_STATS_REQUEST',
  FETCH_DRAWS_STATS_SUCCESS: 'FETCH_DRAWS_STATS_SUCCESS',
  FETCH_DRAWS_STATS_FAILURE: 'FETCH_DRAWS_STATS_FAILURE',

  // Запит на отримання рейтингу рефералів за участю в розіграшах
  FETCH_DRAWS_RANKING_REQUEST: 'FETCH_DRAWS_RANKING_REQUEST',
  FETCH_DRAWS_RANKING_SUCCESS: 'FETCH_DRAWS_RANKING_SUCCESS',
  FETCH_DRAWS_RANKING_FAILURE: 'FETCH_DRAWS_RANKING_FAILURE',

  // Запит на аналіз участі рефералів у розіграшах
  ANALYZE_DRAWS_PARTICIPATION_REQUEST: 'ANALYZE_DRAWS_PARTICIPATION_REQUEST',
  ANALYZE_DRAWS_PARTICIPATION_SUCCESS: 'ANALYZE_DRAWS_PARTICIPATION_SUCCESS',
  ANALYZE_DRAWS_PARTICIPATION_FAILURE: 'ANALYZE_DRAWS_PARTICIPATION_FAILURE',

  // Очищення помилок
  CLEAR_DRAW_PARTICIPATION_ERROR: 'CLEAR_DRAW_PARTICIPATION_ERROR'
};

/**
 * Початковий стан для участі в розіграшах
 */
export const initialDrawParticipationState = {
  // Дані про участь конкретного реферала
  referralDraws: {
    data: null,
    isLoading: false,
    error: null
  },

  // Дані про участь всіх рефералів
  drawsStats: {
    data: null,
    isLoading: false,
    error: null
  },

  // Рейтинг рефералів за участю в розіграшах
  drawsRanking: {
    data: null,
    isLoading: false,
    error: null
  },

  // Аналіз участі рефералів у розіграшах
  drawsAnalysis: {
    data: null,
    isLoading: false,
    error: null,
    recommendations: []
  }
};

/**
 * Редуктор для управління станом участі в розіграшах
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const drawParticipationReducer = (state = initialDrawParticipationState, action) => {
  switch (action.type) {
    // Обробка запиту на отримання даних про участь реферала в розіграшах
    case DrawParticipationActionTypes.FETCH_REFERRAL_DRAWS_REQUEST:
      return {
        ...state,
        referralDraws: {
          ...state.referralDraws,
          isLoading: true,
          error: null
        }
      };

    case DrawParticipationActionTypes.FETCH_REFERRAL_DRAWS_SUCCESS:
      return {
        ...state,
        referralDraws: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case DrawParticipationActionTypes.FETCH_REFERRAL_DRAWS_FAILURE:
      return {
        ...state,
        referralDraws: {
          ...state.referralDraws,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на отримання статистики участі всіх рефералів
    case DrawParticipationActionTypes.FETCH_DRAWS_STATS_REQUEST:
      return {
        ...state,
        drawsStats: {
          ...state.drawsStats,
          isLoading: true,
          error: null
        }
      };

    case DrawParticipationActionTypes.FETCH_DRAWS_STATS_SUCCESS:
      return {
        ...state,
        drawsStats: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case DrawParticipationActionTypes.FETCH_DRAWS_STATS_FAILURE:
      return {
        ...state,
        drawsStats: {
          ...state.drawsStats,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на отримання рейтингу рефералів за участю в розіграшах
    case DrawParticipationActionTypes.FETCH_DRAWS_RANKING_REQUEST:
      return {
        ...state,
        drawsRanking: {
          ...state.drawsRanking,
          isLoading: true,
          error: null
        }
      };

    case DrawParticipationActionTypes.FETCH_DRAWS_RANKING_SUCCESS:
      return {
        ...state,
        drawsRanking: {
          data: action.payload,
          isLoading: false,
          error: null
        }
      };

    case DrawParticipationActionTypes.FETCH_DRAWS_RANKING_FAILURE:
      return {
        ...state,
        drawsRanking: {
          ...state.drawsRanking,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Обробка запиту на аналіз участі рефералів у розіграшах
    case DrawParticipationActionTypes.ANALYZE_DRAWS_PARTICIPATION_REQUEST:
      return {
        ...state,
        drawsAnalysis: {
          ...state.drawsAnalysis,
          isLoading: true,
          error: null
        }
      };

    case DrawParticipationActionTypes.ANALYZE_DRAWS_PARTICIPATION_SUCCESS:
      return {
        ...state,
        drawsAnalysis: {
          data: action.payload.analysis,
          recommendations: action.payload.recommendations || [],
          isLoading: false,
          error: null
        }
      };

    case DrawParticipationActionTypes.ANALYZE_DRAWS_PARTICIPATION_FAILURE:
      return {
        ...state,
        drawsAnalysis: {
          ...state.drawsAnalysis,
          isLoading: false,
          error: action.payload.error
        }
      };

    // Очищення помилок
    case DrawParticipationActionTypes.CLEAR_DRAW_PARTICIPATION_ERROR:
      return {
        ...state,
        referralDraws: {
          ...state.referralDraws,
          error: null
        },
        drawsStats: {
          ...state.drawsStats,
          error: null
        },
        drawsRanking: {
          ...state.drawsRanking,
          error: null
        },
        drawsAnalysis: {
          ...state.drawsAnalysis,
          error: null
        }
      };

    default:
      return state;
  }
};

/**
 * Дія для запиту даних про участь реферала в розіграшах
 *
 * @param {string} referralId - ID реферала
 * @returns {Function} Функція-дія для диспатчера
 */
export const fetchReferralDrawsAction = (referralId) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: DrawParticipationActionTypes.FETCH_REFERRAL_DRAWS_REQUEST });

      // Тут буде реальний запит до API
      const drawsData = await import('../api/fetchReferralDraws')
        .then(module => module.fetchReferralDraws(referralId));

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: DrawParticipationActionTypes.FETCH_REFERRAL_DRAWS_SUCCESS,
        payload: drawsData
      });

      return drawsData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: DrawParticipationActionTypes.FETCH_REFERRAL_DRAWS_FAILURE,
        payload: { error: error.message || 'Failed to fetch referral draws' }
      });

      throw error;
    }
  };
};

/**
 * Дія для запиту статистики участі всіх рефералів у розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {Object} [options] - Опції запиту
 * @returns {Function} Функція-дія для диспатчера
 */
export const fetchDrawsStatsAction = (ownerId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: DrawParticipationActionTypes.FETCH_DRAWS_STATS_REQUEST });

      // Тут буде реальний запит до API
      const statsData = await import('../api/fetchReferralDraws')
        .then(module => module.fetchDrawsParticipationStats(ownerId, options));

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: DrawParticipationActionTypes.FETCH_DRAWS_STATS_SUCCESS,
        payload: statsData
      });

      return statsData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: DrawParticipationActionTypes.FETCH_DRAWS_STATS_FAILURE,
        payload: { error: error.message || 'Failed to fetch draws stats' }
      });

      throw error;
    }
  };
};

/**
 * Дія для запиту рейтингу рефералів за участю в розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {number} [limit=10] - Кількість рефералів для включення в рейтинг
 * @returns {Function} Функція-дія для диспатчера
 */
export const fetchDrawsRankingAction = (ownerId, limit = 10) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: DrawParticipationActionTypes.FETCH_DRAWS_RANKING_REQUEST });

      // Тут буде реальний запит до API
      const rankingData = await import('../services/trackDrawParticipation')
        .then(module => module.getReferralsByDrawsRanking(ownerId, limit));

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: DrawParticipationActionTypes.FETCH_DRAWS_RANKING_SUCCESS,
        payload: rankingData
      });

      return rankingData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: DrawParticipationActionTypes.FETCH_DRAWS_RANKING_FAILURE,
        payload: { error: error.message || 'Failed to fetch draws ranking' }
      });

      throw error;
    }
  };
};

/**
 * Дія для аналізу участі рефералів у розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {Object} [options] - Опції аналізу
 * @returns {Function} Функція-дія для диспатчера
 */
export const analyzeDrawsParticipationAction = (ownerId, options = {}) => {
  return async (dispatch) => {
    try {
      // Диспатчимо початок запиту
      dispatch({ type: DrawParticipationActionTypes.ANALYZE_DRAWS_PARTICIPATION_REQUEST });

      // Отримуємо аналіз участі
      const analysisData = await import('../services/trackDrawParticipation')
        .then(module => module.analyzeDrawsParticipation(ownerId, options));

      // Отримуємо рекомендації
      const recommendationsData = await import('../services/trackDrawParticipation')
        .then(module => module.getDrawsParticipationRecommendations(ownerId));

      // Диспатчимо успішне завершення запиту
      dispatch({
        type: DrawParticipationActionTypes.ANALYZE_DRAWS_PARTICIPATION_SUCCESS,
        payload: {
          analysis: analysisData,
          recommendations: recommendationsData
        }
      });

      return {
        analysis: analysisData,
        recommendations: recommendationsData
      };
    } catch (error) {
      // Диспатчимо помилку
      dispatch({
        type: DrawParticipationActionTypes.ANALYZE_DRAWS_PARTICIPATION_FAILURE,
        payload: { error: error.message || 'Failed to analyze draws participation' }
      });

      throw error;
    }
  };
};

/**
 * Дія для очищення помилок
 *
 * @returns {Object} Дія для диспатчера
 */
export const clearDrawParticipationError = () => ({
  type: DrawParticipationActionTypes.CLEAR_DRAW_PARTICIPATION_ERROR
});