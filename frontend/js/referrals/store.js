// store.js - Версія з детальним логуванням та правильною обробкою помилок
/**
 * Redux-подібний стор для реферальної системи з правильною обробкою помилок
 */
window.ReferralStore = (function() {
  'use strict';

  console.log('📦 [STORE] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ ReferralStore ==========');
  console.log('🕐 [STORE] Час завантаження:', new Date().toISOString());

  // Store utilities
  function createStore(reducer) {
    console.log('🏗️ [STORE] === createStore START ===');
    console.log('📊 [STORE] Створення store з reducer:', typeof reducer);

    let state = reducer(undefined, { type: '@@INIT' });
    console.log('📊 [STORE] Початковий стан:', JSON.stringify(state, null, 2));

    const listeners = [];

    const store = {
      getState: function() {
        console.log('📤 [STORE] getState викликано');
        return state;
      },
      dispatch: function(action) {
        console.log('🔄 [STORE] === dispatch START ===');
        console.log('📊 [STORE] Action:', {
          type: action.type,
          payload: action.payload
        });

        const previousState = state;
        state = reducer(state, action);

        console.log('📊 [STORE] Стан оновлено:', {
          previous: previousState,
          current: state,
          changed: previousState !== state
        });

        console.log('🔔 [STORE] Сповіщення listeners:', listeners.length);
        listeners.forEach(function(listener, index) {
          console.log(`  🔔 [STORE] Виклик listener ${index}`);
          listener();
        });

        console.log('✅ [STORE] === dispatch COMPLETE ===');
        return action;
      },
      subscribe: function(listener) {
        console.log('📢 [STORE] Додано новий listener');
        listeners.push(listener);

        return function() {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
            console.log('📢 [STORE] Listener видалено, залишилось:', listeners.length);
          }
        };
      }
    };

    console.log('✅ [STORE] Store створено успішно');
    return store;
  }

  function combineReducers(reducers) {
    console.log('🔗 [STORE] === combineReducers START ===');
    console.log('📊 [STORE] Редюсери для об\'єднання:', Object.keys(reducers));

    const reducerKeys = Object.keys(reducers);

    return function(state, action) {
      console.log('🔄 [STORE] Combined reducer викликано для action:', action.type);

      state = state || {};
      const nextState = {};

      for (let i = 0; i < reducerKeys.length; i++) {
        const key = reducerKeys[i];
        const reducer = reducers[key];
        const previousStateForKey = state[key];
        const nextStateForKey = reducer(previousStateForKey, action);

        console.log(`  🔄 [STORE] Reducer "${key}":`, {
          changed: previousStateForKey !== nextStateForKey
        });

        nextState[key] = nextStateForKey;
      }

      return nextState;
    };
  }

  function thunkMiddleware(store) {
    console.log('🎯 [STORE] thunkMiddleware ініціалізовано');

    return function(next) {
      return function(action) {
        console.log('🎯 [STORE] Middleware обробляє action:', {
          type: typeof action === 'function' ? 'FUNCTION (thunk)' : action.type,
          isThunk: typeof action === 'function'
        });

        if (typeof action === 'function') {
          console.log('🎯 [STORE] Виконання thunk action...');
          return action(store.dispatch, store.getState);
        }

        return next(action);
      };
    };
  }

  function applyMiddleware(middleware) {
    console.log('🔧 [STORE] === applyMiddleware START ===');

    return function(createStore) {
      return function(reducer) {
        console.log('🔧 [STORE] Створення store з middleware');

        const store = createStore(reducer);
        const dispatch = middleware(store)(store.dispatch);

        const enhancedStore = Object.assign({}, store, {
          dispatch: dispatch
        });

        console.log('✅ [STORE] Enhanced store створено');
        return enhancedStore;
      };
    };
  }

  // Reducers

  // ReferralLink Reducer
  console.log('📝 [STORE] Ініціалізація ReferralLink reducer...');
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
  console.log('✅ [STORE] ReferralLinkActionTypes створено');

  function referralLinkReducer(state, action) {
    state = state || initialReferralLinkState;
    console.log('🔄 [STORE-REDUCER] referralLinkReducer:', action.type);

    switch (action.type) {
      case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST:
        console.log('  📥 [STORE-REDUCER] Запит реферального посилання...');
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Реферальне посилання отримано:', action.payload.link);
        return Object.assign({}, state, {
          isLoading: false,
          link: action.payload.link,
          error: null
        });

      case ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE:
        console.log('  ❌ [STORE-REDUCER] Помилка отримання посилання:', action.payload.error);
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR:
        console.log('  🧹 [STORE-REDUCER] Очищення помилки');
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // DirectBonus Reducer
  console.log('📝 [STORE] Ініціалізація DirectBonus reducer...');
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
  console.log('✅ [STORE] DirectBonusActionTypes створено');

  function directBonusReducer(state, action) {
    state = state || initialDirectBonusState;
    console.log('🔄 [STORE-REDUCER] directBonusReducer:', action.type);

    switch (action.type) {
      case DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST:
      case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST:
        console.log('  📥 [STORE-REDUCER] Запит даних бонусів...');
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Реферал зареєстровано:', action.payload);
        return Object.assign({}, state, {
          isLoading: false,
          totalBonus: state.totalBonus + action.payload.bonusAmount,
          history: [action.payload].concat(state.history),
          error: null
        });

      case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Історія бонусів отримана:', {
          totalBonus: action.payload.totalBonus,
          historyLength: (action.payload.history || action.payload.bonuses || []).length
        });
        return Object.assign({}, state, {
          isLoading: false,
          totalBonus: action.payload.totalBonus || 0,
          history: action.payload.history || action.payload.bonuses || [],
          error: null
        });

      case DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE:
      case DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE:
        console.log('  ❌ [STORE-REDUCER] Помилка:', action.payload.error);
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR:
        console.log('  🧹 [STORE-REDUCER] Очищення помилки');
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // ReferralLevels Reducer
  console.log('📝 [STORE] Ініціалізація ReferralLevels reducer...');
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
  console.log('✅ [STORE] ReferralLevelsActionTypes створено');

  function referralLevelsReducer(state, action) {
    state = state || initialReferralLevelsState;
    console.log('🔄 [STORE-REDUCER] referralLevelsReducer:', action.type);

    switch (action.type) {
      case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_REQUEST:
        console.log('  📥 [STORE-REDUCER] Запит рівнів рефералів...');
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case ReferralLevelsActionTypes.FETCH_REFERRAL_LEVELS_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Рівні рефералів отримані:', {
          level1: action.payload.level1Count,
          level2: action.payload.level2Count,
          total: action.payload.totalReferralsCount
        });
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
        console.log('  ❌ [STORE-REDUCER] Помилка:', action.payload.error);
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case ReferralLevelsActionTypes.UPDATE_REFERRAL_COUNTS:
        console.log('  🔄 [STORE-REDUCER] Оновлення лічильників:', action.payload);
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
        console.log('  🧹 [STORE-REDUCER] Очищення помилки');
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // Badge Reducer
  console.log('📝 [STORE] Ініціалізація Badge reducer...');
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
  console.log('✅ [STORE] BadgeActionTypes створено');

  function badgeReducer(state, action) {
    state = state || initialBadgeState;
    console.log('🔄 [STORE-REDUCER] badgeReducer:', action.type);

    switch (action.type) {
      case BadgeActionTypes.FETCH_BADGES_REQUEST:
      case BadgeActionTypes.FETCH_TASKS_REQUEST:
      case BadgeActionTypes.CLAIM_BADGE_REQUEST:
      case BadgeActionTypes.CLAIM_TASK_REQUEST:
        console.log('  📥 [STORE-REDUCER] Запит даних бейджів/завдань...');
        return Object.assign({}, state, {
          isLoading: true,
          error: null
        });

      case BadgeActionTypes.FETCH_BADGES_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Бейджі отримані:', {
          earned: (action.payload.earnedBadges || []).length,
          available: (action.payload.availableBadges || []).length
        });
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
        console.log('  ✅ [STORE-REDUCER] Завдання отримані:', {
          completed: (action.payload.completedTasks || []).length
        });
        return Object.assign({}, state, {
          isLoading: false,
          completedTasks: action.payload.completedTasks || [],
          tasksProgress: action.payload.tasksProgress || {},
          totalTasksReward: action.payload.totalReward || 0,
          error: null
        });

      case BadgeActionTypes.CLAIM_BADGE_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Бейдж отримано:', action.payload.badgeType || action.payload.badge_type);
        return Object.assign({}, state, {
          isLoading: false,
          claimedBadges: state.claimedBadges.concat([action.payload.badgeType || action.payload.badge_type]),
          availableBadges: state.availableBadges.filter(function(badge) {
            return badge !== (action.payload.badgeType || action.payload.badge_type);
          }),
          error: null
        });

      case BadgeActionTypes.CLAIM_TASK_SUCCESS:
        console.log('  ✅ [STORE-REDUCER] Завдання виконано');
        return Object.assign({}, state, {
          isLoading: false,
          error: null
        });

      case BadgeActionTypes.UPDATE_BADGES_PROGRESS:
        console.log('  🔄 [STORE-REDUCER] Оновлення прогресу бейджів');
        return Object.assign({}, state, {
          badgesProgress: action.payload.badgesProgress || state.badgesProgress
        });

      case BadgeActionTypes.FETCH_BADGES_FAILURE:
      case BadgeActionTypes.FETCH_TASKS_FAILURE:
      case BadgeActionTypes.CLAIM_BADGE_FAILURE:
      case BadgeActionTypes.CLAIM_TASK_FAILURE:
        console.log('  ❌ [STORE-REDUCER] Помилка:', action.payload.error);
        return Object.assign({}, state, {
          isLoading: false,
          error: action.payload.error
        });

      case BadgeActionTypes.CLEAR_BADGE_ERROR:
        console.log('  🧹 [STORE-REDUCER] Очищення помилки');
        return Object.assign({}, state, {
          error: null
        });

      default:
        return state;
    }
  }

  // Action Creators
  console.log('🏭 [STORE] Створення Action Creators...');

  // ReferralLink Actions
  function fetchReferralLinkRequest() {
    console.log('🎬 [STORE-ACTION] fetchReferralLinkRequest');
    return {
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST
    };
  }

  function fetchReferralLinkSuccess(link) {
    console.log('🎬 [STORE-ACTION] fetchReferralLinkSuccess:', link);

    // Переконаємося, що link це рядок
    const validLink = typeof link === 'string'
        ? link
        : (link && typeof link.toString === 'function'
            ? link.toString()
            : 'https://t.me/WINIX_Official_bot?start=');

    return {
        type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS,
        payload: { link: validLink }
    };
  }

  function fetchReferralLinkFailure(error) {
    console.log('🎬 [STORE-ACTION] fetchReferralLinkFailure:', error);
    return {
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE,
      payload: { error: error.message || 'Failed to fetch referral link' }
    };
  }

  function clearReferralLinkError() {
    console.log('🎬 [STORE-ACTION] clearReferralLinkError');
    return {
      type: ReferralLinkActionTypes.CLEAR_REFERRAL_LINK_ERROR
    };
  }

  // Безпечна функція для перевірки підрядка
  function safeIncludes(str, search) {
    console.log('🔍 [STORE] safeIncludes:', { str: typeof str, search: search });

    // Перевіряємо, чи str це рядок
    if (typeof str !== 'string') {
      console.warn('⚠️ [STORE] safeIncludes: перший аргумент не є рядком:', str);
      return false;
    }

    // Перевіряємо, чи search це рядок
    if (typeof search !== 'string') {
      console.warn('⚠️ [STORE] safeIncludes: другий аргумент не є рядком:', search);
      return false;
    }

    const result = str.indexOf(search) >= 0;
    console.log('🔍 [STORE] safeIncludes результат:', result);
    return result;
  }

  // Якщо глобальна функція не існує, створюємо її
  if (typeof window.safeIncludes !== 'function') {
    window.safeIncludes = safeIncludes;
    console.log('✅ [STORE] window.safeIncludes створено');
  }

  function fetchReferralLink(userId) {
    console.log('🎬 [STORE-ACTION] === fetchReferralLink START ===');
    console.log('📊 [STORE-ACTION] userId:', userId);

    return function(dispatch) {
      dispatch(fetchReferralLinkRequest());

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      console.log('📊 [STORE-ACTION] Конвертація userId:', {
        original: userId,
        numeric: numericUserId,
        isNaN: isNaN(numericUserId)
      });

      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch(fetchReferralLinkFailure(error));
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.fetchReferralLink...');

      return window.ReferralAPI.fetchReferralLink(numericUserId)
        .then(function(link) {
          console.log('✅ [STORE-ACTION] Посилання отримано:', link);

          // Безпечна перевірка формату посилання
          let formattedLink;

          if (typeof link === 'string') {
            formattedLink = safeIncludes(link, 't.me/WINIX_Official_bot')
                ? link
                : 'https://t.me/WINIX_Official_bot?start=' + numericUserId;
          } else {
            // Якщо link не рядок, просто створюємо посилання
            formattedLink = 'https://t.me/WINIX_Official_bot?start=' + numericUserId;
            console.warn("⚠️ [STORE-ACTION] Отримано некоректний формат посилання:", link);
          }

          console.log('✅ [STORE-ACTION] Форматоване посилання:', formattedLink);
          dispatch(fetchReferralLinkSuccess(formattedLink));
          return formattedLink;
        })
        .catch(function(error) {
          console.error("❌ [STORE-ACTION] Помилка отримання реферального посилання:", error);
          dispatch(fetchReferralLinkFailure(error));
          throw error;
        });
    };
  }

  // Direct Bonus Actions
  function registerReferralRequest() {
    console.log('🎬 [STORE-ACTION] registerReferralRequest');
    return {
      type: DirectBonusActionTypes.REGISTER_REFERRAL_REQUEST
    };
  }

  function registerReferralSuccess(data) {
    console.log('🎬 [STORE-ACTION] registerReferralSuccess:', data);
    return {
      type: DirectBonusActionTypes.REGISTER_REFERRAL_SUCCESS,
      payload: data
    };
  }

  function registerReferralFailure(error) {
    console.log('🎬 [STORE-ACTION] registerReferralFailure:', error);
    return {
      type: DirectBonusActionTypes.REGISTER_REFERRAL_FAILURE,
      payload: { error: error.message || 'Failed to register referral' }
    };
  }

  function fetchDirectBonusHistoryRequest() {
    console.log('🎬 [STORE-ACTION] fetchDirectBonusHistoryRequest');
    return {
      type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_REQUEST
    };
  }

  function fetchDirectBonusHistorySuccess(data) {
    console.log('🎬 [STORE-ACTION] fetchDirectBonusHistorySuccess:', {
      totalBonus: data.totalBonus,
      historyLength: (data.history || data.bonuses || []).length
    });
    return {
      type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_SUCCESS,
      payload: data
    };
  }

  function fetchDirectBonusHistoryFailure(error) {
    console.log('🎬 [STORE-ACTION] fetchDirectBonusHistoryFailure:', error);
    return {
      type: DirectBonusActionTypes.FETCH_DIRECT_BONUS_HISTORY_FAILURE,
      payload: { error: error.message || 'Failed to fetch bonus history' }
    };
  }

  function clearDirectBonusError() {
    console.log('🎬 [STORE-ACTION] clearDirectBonusError');
    return {
      type: DirectBonusActionTypes.CLEAR_DIRECT_BONUS_ERROR
    };
  }

  function registerReferralAndAwardBonus(referrerId, userId) {
    console.log('🎬 [STORE-ACTION] === registerReferralAndAwardBonus START ===');
    console.log('📊 [STORE-ACTION] Параметри:', {
      referrerId: referrerId,
      userId: userId
    });

    return function(dispatch) {
      dispatch(registerReferralRequest());

      // Переконуємося що ID це числа
      const numericReferrerId = parseInt(referrerId);
      const numericUserId = parseInt(userId);

      console.log('📊 [STORE-ACTION] Конвертація ID:', {
        referrerId: { original: referrerId, numeric: numericReferrerId },
        userId: { original: userId, numeric: numericUserId }
      });

      if (isNaN(numericReferrerId) || isNaN(numericUserId)) {
        const error = new Error('Некоректні ID користувачів');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch(registerReferralFailure(error));
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.registerReferral...');

      return window.ReferralAPI.registerReferral(numericReferrerId, numericUserId)
        .then(function(registrationData) {
          console.log('✅ [STORE-ACTION] Реферал зареєстровано:', registrationData);

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

          console.log('💰 [STORE-ACTION] Дані бонусу:', bonusData);
          dispatch(registerReferralSuccess(bonusData));
          return bonusData;
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка реєстрації реферала:', error);
          dispatch(registerReferralFailure(error));
          throw error;
        });
    };
  }

  function fetchDirectBonusHistory(userId) {
    console.log('🎬 [STORE-ACTION] === fetchDirectBonusHistory START ===');
    console.log('📊 [STORE-ACTION] userId:', userId);

    return function(dispatch) {
      dispatch(fetchDirectBonusHistoryRequest());

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch(fetchDirectBonusHistoryFailure(error));
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.fetchReferralHistory...');

      return window.ReferralAPI.fetchReferralHistory(numericUserId, { type: 'bonus' })
        .then(function(historyData) {
          console.log('✅ [STORE-ACTION] Історія отримана:', historyData);

          // Перевіряємо, чи historyData взагалі є об'єктом
          if (!historyData || typeof historyData !== 'object') {
            console.error('❌ [STORE-ACTION] Некоректний формат даних історії:', historyData);
            throw new Error('Некоректний формат даних історії');
          }

          // Нормалізуємо дані
          const normalizedData = {
            totalBonus: (historyData && historyData.totalBonus) || 0,
            history: (historyData && (historyData.history || historyData.bonuses)) || []
          };

          console.log('📊 [STORE-ACTION] Нормалізовані дані:', normalizedData);
          dispatch(fetchDirectBonusHistorySuccess(normalizedData));
          return normalizedData;
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка отримання історії бонусів:', error);
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
  console.log('✅ [STORE] LevelRewardsActionTypes створено');

  function fetchLevelRewardsRequest() {
    console.log('🎬 [STORE-ACTION] fetchLevelRewardsRequest');
    return {
      type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_REQUEST
    };
  }

  function fetchLevelRewardsSuccess(data) {
    console.log('🎬 [STORE-ACTION] fetchLevelRewardsSuccess:', data);
    return {
      type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_SUCCESS,
      payload: data
    };
  }

  function fetchLevelRewardsFailure(error) {
    console.log('🎬 [STORE-ACTION] fetchLevelRewardsFailure:', error);
    return {
      type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_FAILURE,
      payload: { error: error.message || 'Помилка отримання даних про винагороди' }
    };
  }

  function fetchLevelRewards(userId, options) {
    console.log('🎬 [STORE-ACTION] === fetchLevelRewards START ===');
    console.log('📊 [STORE-ACTION] Параметри:', {
      userId: userId,
      options: options
    });

    options = options || {};
    return function(dispatch) {
      dispatch(fetchLevelRewardsRequest());

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch(fetchLevelRewardsFailure(error));
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.fetchReferralEarnings...');

      return window.ReferralAPI.fetchReferralEarnings(numericUserId, options)
        .then(function(data) {
          console.log('✅ [STORE-ACTION] Дані про винагороди отримані:', data);
          dispatch(fetchLevelRewardsSuccess(data));
          return data;
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка отримання винагород:', error);
          dispatch(fetchLevelRewardsFailure(error));
          throw error;
        });
    };
  }

  // Badge Actions
  function fetchUserBadges(userId) {
    console.log('🏆 [STORE-ACTION] === fetchUserBadges START ===');
    console.log('📊 [STORE-ACTION] userId:', userId);

    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.FETCH_BADGES_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch({
          type: BadgeActionTypes.FETCH_BADGES_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.fetchUserBadges...');

      return window.ReferralAPI.fetchUserBadges(numericUserId)
        .then(function(badgesData) {
          console.log('✅ [STORE-ACTION] Бейджі отримані:', badgesData);

          // Нормалізуємо дані
          const normalizedData = {
            success: badgesData.success !== false,
            earnedBadges: badgesData.badges || badgesData.earnedBadges || [],
            availableBadges: badgesData.available_badges || badgesData.availableBadges || [],
            badgesProgress: badgesData.badges_progress || badgesData.badgesProgress || [],
            totalBadgesCount: 4,
            totalAvailableBadgesCount: (badgesData.available_badges || badgesData.availableBadges || []).length,
            earnedBadgesReward: 0,
            availableBadgesReward: 0,
            totalPotentialReward: 37500
          };

          console.log('📊 [STORE-ACTION] Нормалізовані дані бейджів:', normalizedData);

          dispatch({
            type: BadgeActionTypes.FETCH_BADGES_SUCCESS,
            payload: normalizedData
          });

          return normalizedData;
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка отримання бейджів:', error);
          dispatch({
            type: BadgeActionTypes.FETCH_BADGES_FAILURE,
            payload: { error: error.message || 'Помилка завантаження бейджів' }
          });
          throw error;
        });
    };
  }

  function fetchUserTasks(userId) {
    console.log('📋 [STORE-ACTION] === fetchUserTasks START ===');
    console.log('📊 [STORE-ACTION] userId:', userId);

    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.FETCH_TASKS_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch({
          type: BadgeActionTypes.FETCH_TASKS_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.fetchUserTasks...');

      return window.ReferralAPI.fetchUserTasks(numericUserId)
        .then(function(tasksData) {
          console.log('✅ [STORE-ACTION] Завдання отримані:', tasksData);

          // Нормалізуємо дані
          const normalizedData = {
            success: tasksData.success !== false,
            completedTasks: tasksData.tasks || [],
            tasksProgress: {},
            totalReward: 0
          };

          console.log('📊 [STORE-ACTION] Нормалізовані дані завдань:', normalizedData);

          dispatch({
            type: BadgeActionTypes.FETCH_TASKS_SUCCESS,
            payload: normalizedData
          });

          return normalizedData;
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка отримання завдань:', error);
          dispatch({
            type: BadgeActionTypes.FETCH_TASKS_FAILURE,
            payload: { error: error.message || 'Помилка завантаження завдань' }
          });
          throw error;
        });
    };
  }

  function claimBadgeReward(userId, badgeType) {
    console.log('💎 [STORE-ACTION] === claimBadgeReward START ===');
    console.log('📊 [STORE-ACTION] Параметри:', {
      userId: userId,
      badgeType: badgeType
    });

    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.CLAIM_BADGE_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch({
          type: BadgeActionTypes.CLAIM_BADGE_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.claimBadgeReward...');

      return window.ReferralAPI.claimBadgeReward(numericUserId, badgeType)
        .then(function(claimResult) {
          console.log('✅ [STORE-ACTION] Результат claim:', claimResult);

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
            console.log('🔄 [STORE-ACTION] Перезавантаження даних про бейджі...');
            setTimeout(function() {
              dispatch(fetchUserBadges(numericUserId));
            }, 500);

            return { success: true, badgeType: badgeType };
          } else {
            throw new Error(claimResult.error || 'Помилка отримання винагороди за бейдж');
          }
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка claim badge:', error);
          dispatch({
            type: BadgeActionTypes.CLAIM_BADGE_FAILURE,
            payload: { error: error.message || 'Невідома помилка при отриманні винагороди за бейдж' }
          });
          throw error;
        });
    };
  }

  function claimTaskReward(userId, taskType) {
    console.log('🎁 [STORE-ACTION] === claimTaskReward START ===');
    console.log('📊 [STORE-ACTION] Параметри:', {
      userId: userId,
      taskType: taskType
    });

    return function(dispatch) {
      dispatch({ type: BadgeActionTypes.CLAIM_TASK_REQUEST });

      // Переконуємося що userId це число
      const numericUserId = parseInt(userId);
      if (isNaN(numericUserId)) {
        const error = new Error('Некоректний ID користувача');
        console.error('❌ [STORE-ACTION] Помилка:', error);
        dispatch({
          type: BadgeActionTypes.CLAIM_TASK_FAILURE,
          payload: { error: error.message }
        });
        return Promise.reject(error);
      }

      console.log('🔄 [STORE-ACTION] Виклик ReferralAPI.claimTaskReward...');

      return window.ReferralAPI.claimTaskReward(numericUserId, taskType)
        .then(function(claimResult) {
          console.log('✅ [STORE-ACTION] Результат claim task:', claimResult);

          if (claimResult.success !== false) {
            dispatch({
              type: BadgeActionTypes.CLAIM_TASK_SUCCESS,
              payload: {
                taskType: taskType,
                success: true
              }
            });

            // Перезавантажуємо дані про завдання після успішного claim
            console.log('🔄 [STORE-ACTION] Перезавантаження даних про завдання...');
            setTimeout(function() {
              dispatch(fetchUserTasks(numericUserId));
            }, 500);

            return { success: true, taskType: taskType };
          } else {
            throw new Error(claimResult.error || 'Помилка отримання винагороди за завдання');
          }
        })
        .catch(function(error) {
          console.error('❌ [STORE-ACTION] Помилка claim task:', error);
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
    console.log('🏗️ [STORE] === configureReferralStore START ===');
    console.log('📊 [STORE] Редюсери:', Object.keys(reducers));

    const rootReducer = combineReducers(reducers);
    const storeWithMiddleware = applyMiddleware(thunkMiddleware)(createStore);
    const store = storeWithMiddleware(rootReducer);

    console.log('✅ [STORE] Store сконфігуровано успішно');
    console.log('📊 [STORE] Початковий стан:', store.getState());

    return store;
  }

  // Фінальна статистика
  console.log('📊 [STORE] === ФІНАЛЬНА СТАТИСТИКА ===');
  const publicAPI = {
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

  console.log('📊 [STORE] Експортовано:', {
    utilities: 5,
    reducers: 4,
    actionTypes: 5,
    actionCreators: Object.keys(publicAPI).length - 14
  });

  console.log('✅ [STORE] ========== МОДУЛЬ ReferralStore ЗАВАНТАЖЕНО УСПІШНО ==========');

  return publicAPI;
})();

// Перевірка доступності
console.log('🔍 [STORE] Перевірка доступності window.ReferralStore:', {
  exists: typeof window.ReferralStore !== 'undefined',
  type: typeof window.ReferralStore,
  properties: window.ReferralStore ? Object.keys(window.ReferralStore).length : 0
});