/**
 * Дії для роботи з бейджами та завданнями
 *
 * Використовує нові реальні API для взаємодії з бекендом
 */

// Імпорт API-функцій для бейджів і завдань
import { fetchUserBadges as fetchBadgesAPI, checkBadges, claimBadgeReward as claimBadgeAPI } from '../api/fetchBadges';
import { fetchUserTasks as fetchTasksAPI, updateTasks, claimTaskReward as claimTaskAPI } from '../api/fetchTasks';

// Типи дій
export const BadgeActionTypes = {
  FETCH_USER_BADGES_REQUEST: 'FETCH_USER_BADGES_REQUEST',
  FETCH_USER_BADGES_SUCCESS: 'FETCH_USER_BADGES_SUCCESS',
  FETCH_USER_BADGES_FAILURE: 'FETCH_USER_BADGES_FAILURE',

  FETCH_USER_TASKS_REQUEST: 'FETCH_USER_TASKS_REQUEST',
  FETCH_USER_TASKS_SUCCESS: 'FETCH_USER_TASKS_SUCCESS',
  FETCH_USER_TASKS_FAILURE: 'FETCH_USER_TASKS_FAILURE',

  CLAIM_BADGE_REWARD_REQUEST: 'CLAIM_BADGE_REWARD_REQUEST',
  CLAIM_BADGE_REWARD_SUCCESS: 'CLAIM_BADGE_REWARD_SUCCESS',
  CLAIM_BADGE_REWARD_FAILURE: 'CLAIM_BADGE_REWARD_FAILURE',

  CLAIM_TASK_REWARD_REQUEST: 'CLAIM_TASK_REWARD_REQUEST',
  CLAIM_TASK_REWARD_SUCCESS: 'CLAIM_TASK_REWARD_SUCCESS',
  CLAIM_TASK_REWARD_FAILURE: 'CLAIM_TASK_REWARD_FAILURE',

  UPDATE_BADGES_PROGRESS: 'UPDATE_BADGES_PROGRESS',
  CLEAR_BADGE_ERROR: 'CLEAR_BADGE_ERROR'
};

// Дія для отримання бейджів користувача
export const fetchUserBadges = (userId) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.FETCH_USER_BADGES_REQUEST });

  try {
    const badgesData = await fetchBadgesAPI(userId);

    if (!badgesData.success) {
      throw new Error(badgesData.error || 'Помилка отримання бейджів');
    }

    dispatch({
      type: BadgeActionTypes.FETCH_USER_BADGES_SUCCESS,
      payload: badgesData
    });

    return badgesData;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.FETCH_USER_BADGES_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні бейджів' }
    });

    return { success: false, error: error.message };
  }
};

// Дія для отримання завдань користувача
export const fetchUserTasks = (userId) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.FETCH_USER_TASKS_REQUEST });

  try {
    const tasksData = await fetchTasksAPI(userId);

    if (!tasksData.success) {
      throw new Error(tasksData.error || 'Помилка отримання завдань');
    }

    dispatch({
      type: BadgeActionTypes.FETCH_USER_TASKS_SUCCESS,
      payload: tasksData
    });

    return tasksData;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.FETCH_USER_TASKS_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні завдань' }
    });

    return { success: false, error: error.message };
  }
};

// Дія для отримання винагороди за бейдж
export const claimBadgeReward = (userId, badgeType) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.CLAIM_BADGE_REWARD_REQUEST });

  try {
    const claimResult = await claimBadgeAPI(userId, badgeType);

    if (!claimResult.success) {
      throw new Error(claimResult.error || 'Помилка отримання винагороди за бейдж');
    }

    dispatch({
      type: BadgeActionTypes.CLAIM_BADGE_REWARD_SUCCESS,
      payload: claimResult
    });

    // Оновлюємо бейджі після успішного отримання винагороди
    dispatch(fetchUserBadges(userId));

    return claimResult;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.CLAIM_BADGE_REWARD_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні винагороди за бейдж' }
    });

    return { success: false, error: error.message };
  }
};

// Дія для отримання винагороди за завдання
export const claimTaskReward = (userId, taskType) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.CLAIM_TASK_REWARD_REQUEST });

  try {
    const claimResult = await claimTaskAPI(userId, taskType);

    if (!claimResult.success) {
      throw new Error(claimResult.error || 'Помилка отримання винагороди за завдання');
    }

    dispatch({
      type: BadgeActionTypes.CLAIM_TASK_REWARD_SUCCESS,
      payload: claimResult
    });

    // Оновлюємо завдання після успішного отримання винагороди
    dispatch(fetchUserTasks(userId));

    return claimResult;
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.CLAIM_TASK_REWARD_FAILURE,
      payload: { error: error.message || 'Невідома помилка при отриманні винагороди за завдання' }
    });

    return { success: false, error: error.message };
  }
};

// Дія для оновлення прогресу бейджів
export const updateBadgesProgress = (userId) => async (dispatch) => {
  dispatch({ type: BadgeActionTypes.UPDATE_BADGES_PROGRESS });

  try {
    // Викликаємо API для перевірки та оновлення бейджів
    const checkResult = await checkBadges(userId);

    // Після перевірки бейджів оновлюємо їх
    dispatch(fetchUserBadges(userId));

    // Оновлюємо також завдання
    const updateTasksResult = await updateTasks(userId);
    dispatch(fetchUserTasks(userId));

    return { success: true, badgesResult: checkResult, tasksResult: updateTasksResult };
  } catch (error) {
    dispatch({
      type: BadgeActionTypes.FETCH_USER_BADGES_FAILURE,
      payload: { error: error.message || 'Невідома помилка при оновленні прогресу бейджів' }
    });

    return { success: false, error: error.message };
  }
};

// Дія для очищення помилок
export const clearBadgeError = () => ({
  type: BadgeActionTypes.CLEAR_BADGE_ERROR
});