// store.js - Виправлена версія без fallback на mock дані
/**
 * Redux-подібний стор для реферальної системи з кращою обробкою помилок
 */
window.ReferralStore = (function() {
  'use strict';

  // Store utilities (без змін)
  function createStore(reducer) {
    let state = reducer(undefined, { type: '@@INIT' });
    const listeners = [];

    return {
      getState: function() {
        return state;
      },
      dispatch: function(action) {
        state = reducer(state, action);
        listeners.forEach(function(listener) {
          listener();
        });
        return action;
      },
      subscribe: function(listener) {
        listeners.push(listener);
        return function() {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        };
      }
    };
  }

  function combineReducers(reducers) {
    const reducerKeys = Object.keys(reducers);

    return function(state, action) {
      state = state || {};
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
  }

  function thunkMiddleware(store) {
    return function(next) {
      return function(action) {
        if (typeof action === 'function') {
          return action(store.dispatch, store.getState);
        }
        return next(action);
      };
    };
  }

  function applyMiddleware(middleware) {
    return function(createStore) {
      return function(reducer) {
        const store = createStore(reducer);
        const dispatch = middleware(store)(store.dispatch);

        return Object.assign({}, store, {
          dispatch: dispatch
        });
      };
    };
  }

  // Reducers

  // ReferralLink Reducer
  const initialReferralLinkState = {
    link: null,
    isLoading: false,
    error: null
  };

  const ReferralLinkActionTypes = {
    FETCH_REFERRAL_LINK_REQUEST: 'FETCH_REFERRAL_LINK_REQUEST',
    FETCH_REFERRAL_LINK_SUCCESS: 'FETCH_REFERRAL_LINK_SUCCESS',
    FETCH_REFERRAL_LINK_FAILURE: 'FETCH_REFERRAL_LINK_FAILURE',
    CLEAR_REFERRAL_LINK_ERROR: 'CLEAR_REFERRAL_LINK_ERROR'
  };

  function referralLinkReducer(state, action) {
    state = state || initialReferralLinkState;

    switch (action.type) {
      case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST:
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          link: action.payload.link,
          error: null
        });

      case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE:
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR:
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // DirectBonus Reducer
  const initialDirectBonusState = {
    totalBonus: 0,
    history: [],
    isLoading: false,
    error: null
  };

  const DirectBonusActionTypes = {
    REGISTER_REFERRAL_REQUEST: 'REGISTER_REFERRAL_REQUEST',
    REGISTER_REFERRAL_SUCCESS: 'REGISTER_REFERRAL_SUCCESS',
    REGISTER_REFERRAL_FAILURE: 'REGISTER_REFERRAL_FAILURE',
    FETCH_DIRECT_BONUS_HISTORY_REQUEST: 'FETCH_DIRECT_BONUS_HISTORY_REQUEST',
    FETCH_DIRECT_BONUS_HISTORY_SUCCESS: 'FETCH_DIRECT_BONUS_HISTORY_SUCCESS',
    FETCH_DIRECT_BONUS_HISTORY_FAILURE: 'FETCH_DIRECT_BONUS_HISTORY_FAILURE',
    CLEAR_DIRECT_BONUS_ERROR: 'CLEAR_DIRECT_BONUS_ERROR'
  };

  function directBonusReducer(state, action) {
    state = state || initialDirectBonusState;

    switch (action.type) {
      case DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST:
      case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST:
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          totalBonus: state.totalBonus + action.payload.bonusAmount,
          history: [action.payload].concat(state.history),
          error: null
        });

      case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          totalBonus: action.payload.totalBonus || 0,
          history: action.payload.history || [],
          error: null
        });

      case DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE:
      case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE:
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR:
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // ReferralLevels Reducer
  const initialReferralLevelsState = {
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

  const ReferralLevelsActionTypes = {
    FETCH_REFERRAL_LEVELS_REQUEST: 'FETCH_REFERRAL_LEVELS_REQUEST',
    FETCH_REFERRAL_LEVELS_SUCCESS: 'FETCH_REFERRAL_LEVELS_SUCCESS',
    FETCH_REFERRAL_LEVELS_FAILURE: 'FETCH_REFERRAL_LEVELS_FAILURE',
    UPDATE_REFERRAL_COUNTS: 'UPDATE_REFERRAL_COUNTS',
    CLEAR_REFERRAL_LEVELS_ERROR: 'CLEAR_REFERRAL_LEVELS_ERROR'
  };

  function referralLevelsReducer(state, action) {
    state = state || initialReferralLevelsState;

    switch (action.type) {
      case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_REQUEST:
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          level1Count: action.payload.level1Count || 0,
          level2Count: action.payload.level2Count || 0,
          level1Data: action.payload.level1Data || [],
          level2Data: action.payload.level2Data || [],
          activeReferralsCount: action.payload.activeReferralsCount || 0,
          totalReferralsCount: action.payload.totalReferralsCount || 0,
          conversionRate: action.payload.conversionRate || 0,
          lastUpdated: new Date().toISOString(),
          error: null
        });

      case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_FAILURE:
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case ReferralLevelsActionTypes.UPDATE_REFERRAL_COUNTS:
        return Object.assign({}, state, {
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
        });

      case ReferralLevelsActionTypes.CLEAR_REFERRAL_LEVELS_ERROR:
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // Badge Reducer
  const initialBadgeState = {
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

  const BadgeActionTypes = {
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

  function badgeReducer(state, action) {
    state = state || initialBadgeState;

    switch (action.type) {
      case BadgeActionTypes.FETCH_BADGES_REQUEST:
      case BadgeActionTypes.FETCH_TASKS_REQUEST:
      case BadgeActionTypes.CLAIM_BADGE_REQUEST:
      case BadgeActionTypes.CLAIM_TASK_REQUEST:
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case BadgeActionTypes.FETCH_BADGES_SUCCESS:
        return Object.assign({}, state, {
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
        });

      case BadgeActionTypes.FETCH_TASKS_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          completedTasks: action.payload.completedTasks || [],
          tasksProgress: action.payload.tasksProgress || {},
          totalTasksReward: action.payload.totalReward || 0,
          error: null
        });

      case BadgeActionTypes.CLAIM_BADGE_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          claimedBadges: state.claimedBadges.concat([action.payload.badgeType || action.payload.badge_type]),
          availableBadges: state.availableBadges.filter(function(badge) {
            return badge !== (action.payload.badgeType || action.payload.badge_type);
          }),
          error: null
        });

      case BadgeActionTypes.CLAIM_TASK_SUCCESS:
        return Object.assign({}, state, {
          isLoading: false,
          error: null
        });

      case BadgeActionTypes.UPDATE_BADGES_PROGRESS:
        return Object.assign({}, state, {
          badgesProgress: action.payload.badgesProgress || state.badgesProgress
        });

      case BadgeActionTypes.FETCH_BADGES_FAILURE:
      case BadgeActionTypes.FETCH_TASKS_FAILURE:
      case BadgeActionTypes.CLAIM_BADGE_FAILURE:
      case BadgeActionTypes.CLAIM_TASK_FAILURE:
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case BadgeActionTypes.CLEAR_BADGE_ERROR:
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // Action Creators

  // ReferralLink Actions
  function fetchReferralLinkRequest() {
    return {
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST
    };
  }

  function fetchReferralLinkSuccess(link) {
    return {
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS,
      payload: { link: link }
    };
  }

  function fetchReferralLinkFailure(error) {
    return {
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE,
      payload: { error: error.message || 'Failed to fetch referral link' }
    };
  }

  function clearReferralLinkError() {
    return {
      type: ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR
    };
  }

  function fetchReferralLink(userId) {
    return function(dispatch) {
      dispatch(fetchReferralLinkRequest());

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        dispatch(fetchReferralLinkFailure(new Error('Некоректний ID користувача')));
        return Promise.reject(new Error('Некоректний ID користувача'));
      }

      return window.ReferralAPI.fetchReferralLink(numericUserId)
        .then(function(link) {
          const formattedLink = 'Winix/referral/' + link.replace('Winix/referral/', '');
          dispatch(fetchReferralLinkSuccess(formattedLink));
          return formattedLink;
        })
        .catch(function(error) {
          dispatch(fetchReferralLinkFailure(error));
          throw error;
        });
    };
  }

  // Direct Bonus Actions
  function registerReferralRequest() {
    return {
      type: DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST
    };
  }

  function registerReferralSuccess(data) {
    return {
      type: DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS,
      payload: data
    };
  }

  function registerReferralFailure(error) {
    return {
      type: DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE,
      payload: { error: error.message || 'Failed to register referral' }
    };
  }

  function fetchDirectBonusHistoryRequest() {
    return {
      type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST
    };
  }

  function fetchDirectBonusHistorySuccess(data) {
    return {
      type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS,
      payload: data
    };
  }

  function fetchDirectBonusHistoryFailure(error) {
    return {
      type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE,
      payload: { error: error.message || 'Failed to fetch bonus history' }
    };
  }

  function clearDirectBonusError() {
    return {
      type: DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR
    };
  }

  function registerReferralAndAwardBonus(referrerId, userId) {
    return function(dispatch) {
      dispatch(registerReferralRequest());

      // Переконуємося що ID це числа
      const numericReferrerId = parseInt(referrerId);
      const numericUserId = parseInt(userId);

      if (isNaN(numericReferrerId) || isNaN(numericUserId)) {
        const error = new Error('Некоректні ID користувачів');
        dispatch(registerReferralFailure(error));
        return Promise.reject(error);
      }

      return window.ReferralAPI.registerReferral(numericReferrerId, numericUserId)
        .then(function(registrationData) {
          const bonusAmount = window.ReferralConstants && window.ReferralConstants.DIRECT_BONUS_AMOUNT
            ? window.ReferralConstants.DIRECT_BONUS_AMOUNT
            : 50;

          const bonusData = {
            referrerId: numericReferrerId,
            userId: numericUserId,
            timestamp: registrationData.timestamp || new Date().toISOString(),
            bonusAmount: bonusAmount,
            type: 'direct_bonus'
          };

          dispatch(registerReferralSuccess(bonusData));
          return bonusData;
        })
        .catch(function(error) {
          dispatch(registerReferralFailure(error));
          throw error;
        });
    };
  }

  function fetchDirectBonusHistory(userId) {
    return function(dispatch) {
      dispatch(fetchDirectBonusHistoryRequest());

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        dispatch(fetchDirectBonusHistoryFailure(error));
        return Promise.reject(error);
      }

      return window.ReferralAPI.fetchReferralHistory(numericUserId, { type: 'bonus' })
        .then(function(historyData) {
          // Нормалізуємо дані
          const normalizedData = {
            totalBonus: historyData.totalBonus || 0,
            history: historyData.history || historyData.bonuses || []
          };

          dispatch(fetchDirectBonusHistorySuccess(normalizedData));
          return normalizedData;
        })
        .catch(function(error) {
          dispatch(fetchDirectBonusHistoryFailure(error));
          throw error;
        });
    };
  }

  // Level Rewards Actions
  const LevelRewardsActionTypes = {
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

  function fetchLevelRewardsRequest() {
    return {
      type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_REQUEST
    };
  }

  function fetchLevelRewardsSuccess(data) {
    return {
      type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_SUCCESS,
      payload: data
    };
  }

  function fetchLevelRewardsFailure(error) {
    return {
      type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_FAILURE,
      payload: { error: error.message || 'Помилка отримання даних про винагороди' }
    };
  }

  function fetchLevelRewards(userId, options) {
    options = options || {};
    return function(dispatch) {
      dispatch(fetchLevelRewardsRequest());

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        dispatch(fetchLevelRewardsFailure(error));
        return Promise.reject(error);
      }

      return window.ReferralAPI.fetchReferralEarnings(numericUserId, options)
        .then(function(data) {
          dispatch(fetchLevelRewardsSuccess(data));
          return data;
        })
        .catch(function(error) {
          dispatch(fetchLevelRewardsFailure(error));
          throw error;
        });
    };
  }

  // Badge Actions
  function fetchUserBadges(userId) {
    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.FETCH_BADGES_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        dispatch({
          type: BadgeActionTypes.FETCH_BADGES_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      return window.ReferralAPI.fetchUserBadges(numericUserId)
        .then(function(badgesData) {
          // Нормалізуємо дані
          const normalizedData = {
            success: badgesData.success !== false,
            earnedBadges: badgesData.badges || [],
            availableBadges: badgesData.available_badges || [],
            badgesProgress: badgesData.badges_progress || [],
            totalBadgesCount: 4,
            totalAvailableBadgesCount: (badgesData.available_badges || []).length,
            earnedBadgesReward: 0,
            availableBadgesReward: 0,
            totalPotentialReward: 37500
          };

          dispatch({
            type: BadgeActionTypes.FETCH_BADGES_SUCCESS,
            payload: normalizedData
          });

          return normalizedData;
        })
        .catch(function(error) {
          dispatch({
            type: BadgeActionTypes.FETCH_BADGES_FAILURE,
            payload: { error: error.message || 'Невідома помилка при отриманні бейджів' }
          });
          throw error;
        });
    };
  }

  function fetchUserTasks(userId) {
    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.FETCH_TASKS_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        dispatch({
          type: BadgeActionTypes.FETCH_TASKS_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      return window.ReferralAPI.fetchUserTasks(numericUserId)
        .then(function(tasksData) {
          // Нормалізуємо дані
          const normalizedData = {
            success: tasksData.success !== false,
            completedTasks: tasksData.tasks || [],
            tasksProgress: {},
            totalReward: 0
          };

          dispatch({
            type: BadgeActionTypes.FETCH_TASKS_SUCCESS,
            payload: normalizedData
          });

          return normalizedData;
        })
        .catch(function(error) {
          dispatch({
            type: BadgeActionTypes.FETCH_TASKS_FAILURE,
            payload: { error: error.message || 'Невідома помилка при отриманні завдань' }
          });
          throw error;
        });
    };
  }

  function claimBadgeReward(userId, badgeType) {
    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.CLAIM_BADGE_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        dispatch({
          type: BadgeActionTypes.CLAIM_BADGE_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      return window.ReferralAPI.claimBadgeReward(numericUserId, badgeType)
        .then(function(claimResult) {
          if (claimResult.success !== false) {
            dispatch({
              type: BadgeActionTypes.CLAIM_BADGE_SUCCESS,
              payload: {
                badgeType: badgeType,
                badge_type: badgeType,
                success: true
              }
            });

            // Перезавантажуємо дані про бейджі після успішного claim
            setTimeout(function() {
              dispatch(fetchUserBadges(numericUserId));
            }, 500);

            return { success: true, badgeType: badgeType };
          } else {
            throw new Error(claimResult.error || 'Помилка отримання винагороди за бейдж');
          }
        })
        .catch(function(error) {
          dispatch({
            type: BadgeActionTypes.CLAIM_BADGE_FAILURE,
            payload: { error: error.message || 'Невідома помилка при отриманні винагороди за бейдж' }
          });
          throw error;
        });
    };
  }

  function claimTaskReward(userId, taskType) {
    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.CLAIM_TASK_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        dispatch({
          type: BadgeActionTypes.CLAIM_TASK_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      return window.ReferralAPI.claimTaskReward(numericUserId, taskType)
        .then(function(claimResult) {
          if (claimResult.success !== false) {
            dispatch({
              type: BadgeActionTypes.CLAIM_TASK_SUCCESS,
              payload: {
                taskType: taskType,
                success: true
              }
            });

            // Перезавантажуємо дані про завдання після успішного claim
            setTimeout(function() {
              dispatch(fetchUserTasks(numericUserId));
            }, 500);

            return { success: true, taskType: taskType };
          } else {
            throw new Error(claimResult.error || 'Помилка отримання винагороди за завдання');
          }
        })
        .catch(function(error) {
          dispatch({
            type: BadgeActionTypes.CLAIM_TASK_FAILURE,
            payload: { error: error.message || 'Невідома помилка при отриманні винагороди за завдання' }
          });
          throw error;
        });
    };
  }

  // Store Configuration
  function configureReferralStore(reducers) {
    const rootReducer = combineReducers(reducers);
    const storeWithMiddleware = applyMiddleware(thunkMiddleware)(createStore);
    return storeWithMiddleware(rootReducer);
  }

  // Публічний API
  return {
    // Utilities
    createStore: createStore,
    combineReducers: combineReducers,
    thunkMiddleware: thunkMiddleware,
    applyMiddleware: applyMiddleware,
    configureReferralStore: configureReferralStore,

    // Reducers
    referralLinkReducer: referralLinkReducer,
    directBonusReducer: directBonusReducer,
    referralLevelsReducer: referralLevelsReducer,
    badgeReducer: badgeReducer,

    // Action Types
    ReferralLinkActionTypes: ReferralLinkActionTypes,
    DirectBonusActionTypes: DirectBonusActionTypes,
    ReferralLevelsActionTypes: ReferralLevelsActionTypes,
    BadgeActionTypes: BadgeActionTypes,
    LevelRewardsActionTypes: LevelRewardsActionTypes,

    // Action Creators
    fetchReferralLink: fetchReferralLink,
    fetchReferralLinkRequest: fetchReferralLinkRequest,
    fetchReferralLinkSuccess: fetchReferralLinkSuccess,
    fetchReferralLinkFailure: fetchReferralLinkFailure,
    clearReferralLinkError: clearReferralLinkError,

    registerReferralAndAwardBonus: registerReferralAndAwardBonus,
    fetchDirectBonusHistory: fetchDirectBonusHistory,
    registerReferralRequest: registerReferralRequest,
    registerReferralSuccess: registerReferralSuccess,
    registerReferralFailure: registerReferralFailure,
    fetchDirectBonusHistoryRequest: fetchDirectBonusHistoryRequest,
    fetchDirectBonusHistorySuccess: fetchDirectBonusHistorySuccess,
    fetchDirectBonusHistoryFailure: fetchDirectBonusHistoryFailure,
    clearDirectBonusError: clearDirectBonusError,

    fetchLevelRewards: fetchLevelRewards,
    fetchLevelRewardsRequest: fetchLevelRewardsRequest,
    fetchLevelRewardsSuccess: fetchLevelRewardsSuccess,
    fetchLevelRewardsFailure: fetchLevelRewardsFailure,

    fetchUserBadges: fetchUserBadges,
    fetchUserTasks: fetchUserTasks,
    claimBadgeReward: claimBadgeReward,
    claimTaskReward: claimTaskReward
  };
})();