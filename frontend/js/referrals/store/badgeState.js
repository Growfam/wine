/**
 * Сховище для зберігання стану бейджів користувача
 *
 * Зберігає інформацію про зароблені та доступні бейджі,
 * а також історію отримання винагород
 *
 * @module badgeState
 */

/**
 * Початковий стан для бейджів
 */
export const initialBadgeState = {
  // Список зароблених бейджів
  earnedBadges: [],

  // Список доступних бейджів (які користувач може отримати)
  availableBadges: [],

  // Проміжний стан
  claimedBadges: [],

  // Дані про всі бейджі та їх прогрес
  badgesProgress: [],

  // Дані про виконані завдання
  completedTasks: [],

  // Прогрес виконання завдань
  tasksProgress: {},

  // Статистика
  totalBadgesCount: 0,
  totalAvailableBadgesCount: 0,
  totalPotentialReward: 0,
  earnedBadgesReward: 0,
  availableBadgesReward: 0,
  totalTasksReward: 0,

  // Прапорці стану
  isLoading: false,
  error: null
};

/**
 * Типи дій для роботи зі станом бейджів
 */
export const BadgeActionTypes = {
  FETCH_BADGES_REQUEST: 'FETCH_BADGES_REQUEST',
  FETCH_BADGES_SUCCESS: 'FETCH_BADGES_SUCCESS',
  FETCH_BADGES_FAILURE: 'FETCH_BADGES_FAILURE',

  FETCH_TASKS_REQUEST: 'FETCH_TASKS_REQUEST',
  FETCH_TASKS_SUCCESS: 'FETCH_TASKS_SUCCESS',
  FETCH_TASKS_FAILURE: 'FETCH_TASKS_FAILURE',

  CLAIM_BADGE_REQUEST: 'CLAIM_BADGE_REQUEST',
  CLAIM_BADGE_SUCCESS: 'CLAIM_BADGE_SUCCESS',
  CLAIM_BADGE_FAILURE: 'CLAIM_BADGE_FAILURE',

  CLAIM_TASK_REQUEST: 'CLAIM_TASK_REQUEST',
  CLAIM_TASK_SUCCESS: 'CLAIM_TASK_SUCCESS',
  CLAIM_TASK_FAILURE: 'CLAIM_TASK_FAILURE',

  UPDATE_BADGES_PROGRESS: 'UPDATE_BADGES_PROGRESS',
  CLEAR_BADGE_ERROR: 'CLEAR_BADGE_ERROR'
};

/**
 * Редуктор для управління станом бейджів
 *
 * @param {Object} state - Поточний стан
 * @param {Object} action - Дія для обробки
 * @returns {Object} Новий стан
 */
export const badgeReducer = (state = initialBadgeState, action) => {
  switch (action.type) {
    case BadgeActionTypes.FETCH_BADGES_REQUEST:
    case BadgeActionTypes.FETCH_TASKS_REQUEST:
    case BadgeActionTypes.CLAIM_BADGE_REQUEST:
    case BadgeActionTypes.CLAIM_TASK_REQUEST:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case BadgeActionTypes.FETCH_BADGES_SUCCESS:
      return {
        ...state,
        isLoading: false,
        earnedBadges: action.payload.earnedBadges || [],
        availableBadges: action.payload.availableBadges || [],
        badgesProgress: action.payload.badgesProgress || [],
        totalBadgesCount: action.payload.totalBadgesCount || 0,
        totalAvailableBadgesCount: action.payload.totalAvailableBadgesCount || 0,
        earnedBadgesReward: action.payload.earnedBadgesReward || 0,
        availableBadgesReward: action.payload.availableBadgesReward || 0,
        totalPotentialReward: action.payload.totalPotentialReward || 0,
        error: null
      };

    case BadgeActionTypes.FETCH_TASKS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        completedTasks: action.payload.completedTasks || [],
        tasksProgress: action.payload.tasksProgress || {},
        totalTasksReward: action.payload.totalReward || 0,
        error: null
      };

    case BadgeActionTypes.CLAIM_BADGE_SUCCESS:
      return {
        ...state,
        isLoading: false,
        claimedBadges: [
          ...state.claimedBadges,
          action.payload.badgeType
        ],
        availableBadges: state.availableBadges.filter(
          badge => badge !== action.payload.badgeType
        ),
        error: null
      };

    case BadgeActionTypes.CLAIM_TASK_SUCCESS:
      return {
        ...state,
        isLoading: false,
        error: null
      };

    case BadgeActionTypes.UPDATE_BADGES_PROGRESS:
      return {
        ...state,
        badgesProgress: action.payload.badgesProgress || state.badgesProgress
      };

    case BadgeActionTypes.FETCH_BADGES_FAILURE:
    case BadgeActionTypes.FETCH_TASKS_FAILURE:
    case BadgeActionTypes.CLAIM_BADGE_FAILURE:
    case BadgeActionTypes.CLAIM_TASK_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error
      };

    case BadgeActionTypes.CLEAR_BADGE_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default badgeReducer;