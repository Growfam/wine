/**
 * Сховище для зберігання стану відсоткових винагород за рівнями
 *
 * Містить інформацію про винагороди з рефералів 1-го та 2-го рівнів,
 * їх заробітки, історію нарахувань та загальні суми
 *
 * @module levelRewardsState
 */

/**
 * Початковий стан для відсоткових винагород
 */
export const initialLevelRewardsState = {
  // Інформація про винагороди з рефералів 1-го рівня
  level1Rewards: {
    totalReward: 0,                  // Загальна сума винагород з 1-го рівня
    rewardRate: 0.1,                 // Ставка винагороди для 1-го рівня (10%)
    totalEarnings: 0,                // Загальна сума заробітків рефералів 1-го рівня
    referralsCount: 0,               // Кількість рефералів 1-го рівня
    activeReferralsCount: 0,         // Кількість активних рефералів 1-го рівня
    referralRewards: [],             // Деталізація винагород по рефералах 1-го рівня
  },

  // Інформація про винагороди з рефералів 2-го рівня
  level2Rewards: {
    totalReward: 0,                  // Загальна сума винагород з 2-го рівня
    rewardRate: 0.05,                // Ставка винагороди для 2-го рівня (5%)
    totalEarnings: 0,                // Загальна сума заробітків рефералів 2-го рівня
    referralsCount: 0,               // Кількість рефералів 2-го рівня
    activeReferralsCount: 0,         // Кількість активних рефералів 2-го рівня
    referralRewards: [],             // Деталізація винагород по рефералах 2-го рівня
    groupedRewards: {},              // Згруповані винагороди за рефералами 1-го рівня
  },

  // Загальна інформація про відсоткові винагороди
  summary: {
    totalPercentageReward: 0,        // Загальна сума відсоткових винагород
    totalReferralsEarnings: 0,       // Загальна сума заробітків всіх рефералів
    lastUpdated: null,               // Дата останнього оновлення
  },

  // Історія нарахувань
  history: [],                       // Історія нарахувань відсоткових винагород

  // Стан запиту
  isLoading: false,                  // Прапорець завантаження
  error: null                        // Помилка, якщо є
};

/**
 * Типи дій для роботи зі станом відсоткових винагород
 */
export const LevelRewardsActionTypes = {
  FETCH_LEVEL_REWARDS_REQUEST: 'FETCH_LEVEL_REWARDS_REQUEST',
  FETCH_LEVEL_REWARDS_SUCCESS: 'FETCH_LEVEL_REWARDS_SUCCESS',
  FETCH_LEVEL_REWARDS_FAILURE: 'FETCH_LEVEL_REWARDS_FAILURE',
  UPDATE_LEVEL1_REWARDS: 'UPDATE_LEVEL1_REWARDS',
  UPDATE_LEVEL2_REWARDS: 'UPDATE_LEVEL2_REWARDS',
  FETCH_REWARDS_HISTORY_REQUEST: 'FETCH_REWARDS_HISTORY_REQUEST',
  FETCH_REWARDS_HISTORY_SUCCESS: 'FETCH_REWARDS_HISTORY_SUCCESS',
  FETCH_REWARDS_HISTORY_FAILURE: 'FETCH_REWARDS_HISTORY_FAILURE',
  CLEAR_LEVEL_REWARDS_ERROR: 'CLEAR_LEVEL_REWARDS_ERROR'
};

/**
 * Редуктор для управління станом відсоткових винагород
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const levelRewardsReducer = (state = initialLevelRewardsState, action) => {
  switch (action.type) {
    case LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_REQUEST:
    case LevelRewardsActionTypes.FETCH_REWARDS_HISTORY_REQUEST:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_SUCCESS:
      // Оновлюємо всі дані про винагороди за рівнями
      return {
        ...state,
        isLoading: false,
        level1Rewards: action.payload.level1Rewards,
        level2Rewards: action.payload.level2Rewards,
        summary: {
          totalPercentageReward: action.payload.level1Rewards.totalReward + action.payload.level2Rewards.totalReward,
          totalReferralsEarnings: action.payload.level1Rewards.totalEarnings + action.payload.level2Rewards.totalEarnings,
          lastUpdated: new Date().toISOString()
        },
        error: null
      };

    case LevelRewardsActionTypes.UPDATE_LEVEL1_REWARDS:
      // Оновлюємо тільки дані про винагороди з 1-го рівня
      return {
        ...state,
        level1Rewards: action.payload,
        summary: {
          ...state.summary,
          totalPercentageReward: action.payload.totalReward + state.level2Rewards.totalReward,
          totalReferralsEarnings: action.payload.totalEarnings + state.level2Rewards.totalEarnings,
          lastUpdated: new Date().toISOString()
        }
      };

    case LevelRewardsActionTypes.UPDATE_LEVEL2_REWARDS:
      // Оновлюємо тільки дані про винагороди з 2-го рівня
      return {
        ...state,
        level2Rewards: action.payload,
        summary: {
          ...state.summary,
          totalPercentageReward: state.level1Rewards.totalReward + action.payload.totalReward,
          totalReferralsEarnings: state.level1Rewards.totalEarnings + action.payload.totalEarnings,
          lastUpdated: new Date().toISOString()
        }
      };

    case LevelRewardsActionTypes.FETCH_REWARDS_HISTORY_SUCCESS:
      // Оновлюємо історію нарахувань винагород
      return {
        ...state,
        isLoading: false,
        history: action.payload,
        error: null
      };

    case LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_FAILURE:
    case LevelRewardsActionTypes.FETCH_REWARDS_HISTORY_FAILURE:
      // Обробка помилок
      return {
        ...state,
        isLoading: false,
        error: action.payload.error
      };

    case LevelRewardsActionTypes.CLEAR_LEVEL_REWARDS_ERROR:
      // Очищення помилки
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default levelRewardsReducer;