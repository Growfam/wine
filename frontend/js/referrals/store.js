// Store utilities
const createStore = (reducer) => {
  let state = reducer(undefined, { type: '@@INIT' });
  const listeners = [];

  return {
    getState: () => state,
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach(listener => listener());
      return action;
    },
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    }
  };
};

const combineReducers = (reducers) => {
  const reducerKeys = Object.keys(reducers);

  return (state = {}, action) => {
    const nextState = {};

    for (let i = 0; i < reducerKeys.length; i++) {
      const key = reducerKeys[i];
      const reducer = reducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);
      nextState[key] = nextStateForKey;
    }

    return nextState;
  };
};

const thunkMiddleware = (store) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

const applyMiddleware = (middleware) => {
  return (createStore) => (reducer) => {
    const store = createStore(reducer);
    const dispatch = middleware(store)(store.dispatch);

    return {
      ...store,
      dispatch
    };
  };
};

// Reducers
// ReferralLink Reducer
export const initialReferralLinkState = {
  link: null,
  isLoading: false,
  error: null
};

export const ReferralLinkActionTypes = {
  FETCH_REFERRAL_LINK_REQUEST: 'FETCH_REFERRAL_LINK_REQUEST',
  FETCH_REFERRAL_LINK_SUCCESS: 'FETCH_REFERRAL_LINK_SUCCESS',
  FETCH_REFERRAL_LINK_FAILURE: 'FETCH_REFERRAL_LINK_FAILURE',
  CLEAR_REFERRAL_LINK_ERROR: 'CLEAR_REFERRAL_LINK_ERROR'
};

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

// DirectBonus Reducer
export const initialDirectBonusState = {
  totalBonus: 0,
  history: [],
  isLoading: false,
  error: null
};

export const DirectBonusActionTypes = {
  REGISTER_REFERRAL_REQUEST: 'REGISTER_REFERRAL_REQUEST',
  REGISTER_REFERRAL_SUCCESS: 'REGISTER_REFERRAL_SUCCESS',
  REGISTER_REFERRAL_FAILURE: 'REGISTER_REFERRAL_FAILURE',
  FETCH_DIRECT_BONUS_HISTORY_REQUEST: 'FETCH_DIRECT_BONUS_HISTORY_REQUEST',
  FETCH_DIRECT_BONUS_HISTORY_SUCCESS: 'FETCH_DIRECT_BONUS_HISTORY_SUCCESS',
  FETCH_DIRECT_BONUS_HISTORY_FAILURE: 'FETCH_DIRECT_BONUS_HISTORY_FAILURE',
  CLEAR_DIRECT_BONUS_ERROR: 'CLEAR_DIRECT_BONUS_ERROR'
};

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

// ReferralLevels Reducer
export const initialReferralLevelsState = {
  level1Count: 0,
  level2Count: 0,
  level1Data: [],
  level2Data: [],
  activeReferralsCount: 0,
  totalReferralsCount: 0,
  conversionRate: 0,
  lastUpdated: null,
  isLoading: false,
  error: null
};

export const ReferralLevelsActionTypes = {
  FETCH_REFERRAL_LEVELS_REQUEST: 'FETCH_REFERRAL_LEVELS_REQUEST',
  FETCH_REFERRAL_LEVELS_SUCCESS: 'FETCH_REFERRAL_LEVELS_SUCCESS',
  FETCH_REFERRAL_LEVELS_FAILURE: 'FETCH_REFERRAL_LEVELS_FAILURE',
  UPDATE_REFERRAL_COUNTS: 'UPDATE_REFERRAL_COUNTS',
  CLEAR_REFERRAL_LEVELS_ERROR: 'CLEAR_REFERRAL_LEVELS_ERROR'
};

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

// Badge Reducer
export const initialBadgeState = {
  earnedBadges: [],
  availableBadges: [],
  claimedBadges: [],
  badgesProgress: [],
  completedTasks: [],
  tasksProgress: {},
  totalBadgesCount: 0,
  totalAvailableBadgesCount: 0,
  totalPotentialReward: 0,
  earnedBadgesReward: 0,
  availableBadgesReward: 0,
  totalTasksReward: 0,
  isLoading: false,
  error: null
};

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

// Actions
export const fetchReferralLinkRequest = () => ({
  type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST
});

export const fetchReferralLinkSuccess = (link) => ({
  type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS,
  payload: { link }
});

export const fetchReferralLinkFailure = (error) => ({
  type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE,
  payload: { error: error.message || 'Failed to fetch referral link' }
});

export const clearReferralLinkError = () => ({
  type: ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR
});

export const fetchReferralLink = (userId) => {
  return async (dispatch) => {
    dispatch(fetchReferralLinkRequest());

    try {
      // Використовуємо глобальну функцію generateReferralLink
      const link = await window.ReferralUtils.generateReferralLink(userId);
      dispatch(fetchReferralLinkSuccess(link));
      return link;
    } catch (error) {
      dispatch(fetchReferralLinkFailure(error));
      throw error;
    }
  };
};

// Direct Bonus Actions
export const registerReferralRequest = () => ({
  type: DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST
});

export const registerReferralSuccess = (data) => ({
  type: DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS,
  payload: data
});

export const registerReferralFailure = (error) => ({
  type: DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE,
  payload: { error: error.message || 'Failed to register referral' }
});

export const fetchDirectBonusHistoryRequest = () => ({
  type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST
});

export const fetchDirectBonusHistorySuccess = (data) => ({
  type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS,
  payload: data
});

export const fetchDirectBonusHistoryFailure = (error) => ({
  type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE,
  payload: { error: error.message || 'Failed to fetch bonus history' }
});

export const clearDirectBonusError = () => ({
  type: DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR
});

export const registerReferralAndAwardBonus = (referrerId, userId) => {
  return async (dispatch) => {
    dispatch(registerReferralRequest());

    try {
      const registrationData = await window.ReferralAPI.registerReferral(referrerId, userId);
      const bonusAmount = window.ReferralUtils.calculateDirectBonus(1);

      const bonusData = {
        referrerId,
        userId,
        timestamp: registrationData.timestamp || new Date().toISOString(),
        bonusAmount,
        type: 'direct_bonus'
      };

      dispatch(registerReferralSuccess(bonusData));
      return bonusData;
    } catch (error) {
      dispatch(registerReferralFailure(error));
      throw error;
    }
  };
};

export const fetchDirectBonusHistory = (userId) => {
  return async (dispatch) => {
    dispatch(fetchDirectBonusHistoryRequest());

    try {
      const response = await fetch(`/api/referrals/direct-bonus/history/${userId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to fetch bonus history');
      }

      const historyData = await response.json();
      dispatch(fetchDirectBonusHistorySuccess(historyData));
      return historyData;
    } catch (error) {
      dispatch(fetchDirectBonusHistoryFailure(error));
      throw error;
    }
  };
};

// Level Rewards Actions
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

export const fetchLevelRewardsRequest = () => ({
  type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_REQUEST
});

export const fetchLevelRewardsSuccess = (data) => ({
  type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_SUCCESS,
  payload: data
});

export const fetchLevelRewardsFailure = (error) => ({
  type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_FAILURE,
  payload: { error: error.message || 'Помилка отримання даних про винагороди' }
});

export const fetchLevelRewards = (userId, options = {}) => {
  return async (dispatch) => {
    dispatch(fetchLevelRewardsRequest());

    try {
      const data = await window.ReferralAPI.fetchReferralEarnings(userId, options);
      dispatch(fetchLevelRewardsSuccess(data));
      return data;
    } catch (error) {
      dispatch(fetchLevelRewardsFailure(error));
      throw error;
    }
  };
};

// Badge Actions
export const fetchUserBadges = (userId) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.FETCH_BADGES_REQUEST });

  try {
    const badgesData = await window.ReferralAPI.fetchUserBadges(userId);

    if (!badgesData.success) {
      throw new Error(badgesData.error || 'Помилка отримання бейджів');
    }

    dispatch({
      type: BadgeActionTypes.FETCH_BADGES_SUCCESS,
      payload: badgesData
    });

    return badgesData;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.FETCH_BADGES_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні бейджів' }
    });

    return { success: false, error: error.message };
  }
};

export const fetchUserTasks = (userId) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.FETCH_TASKS_REQUEST });

  try {
    const tasksData = await window.ReferralAPI.fetchUserTasks(userId);

    if (!tasksData.success) {
      throw new Error(tasksData.error || 'Помилка отримання завдань');
    }

    dispatch({
      type: BadgeActionTypes.FETCH_TASKS_SUCCESS,
      payload: tasksData
    });

    return tasksData;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.FETCH_TASKS_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні завдань' }
    });

    return { success: false, error: error.message };
  }
};

export const claimBadgeReward = (userId, badgeType) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.CLAIM_BADGE_REQUEST });

  try {
    const claimResult = await window.ReferralAPI.claimBadgeReward(userId, badgeType);

    if (!claimResult.success) {
      throw new Error(claimResult.error || 'Помилка отримання винагороди за бейдж');
    }

    dispatch({
      type: BadgeActionTypes.CLAIM_BADGE_SUCCESS,
      payload: claimResult
    });

    dispatch(fetchUserBadges(userId));

    return claimResult;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.CLAIM_BADGE_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні винагороди за бейдж' }
    });

    return { success: false, error: error.message };
  }
};

export const claimTaskReward = (userId, taskType) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.CLAIM_TASK_REQUEST });

  try {
    const claimResult = await window.ReferralAPI.claimTaskReward(userId, taskType);

    if (!claimResult.success) {
      throw new Error(claimResult.error || 'Помилка отримання винагороди за завдання');
    }

    dispatch({
      type: BadgeActionTypes.CLAIM_TASK_SUCCESS,
      payload: claimResult
    });

    dispatch(fetchUserTasks(userId));

    return claimResult;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.CLAIM_TASK_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні винагороди за завдання' }
    });

    return { success: false, error: error.message };
  }
};

// Store Configuration
export const configureReferralStore = (reducers) => {
  const rootReducer = combineReducers(reducers);
  const storeWithMiddleware = applyMiddleware(thunkMiddleware)(createStore);
  return storeWithMiddleware(rootReducer);
};