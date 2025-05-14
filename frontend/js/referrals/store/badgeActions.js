/**
 * Дії для роботи з бейджами та завданнями
 *
 * Містить дії (actions) для отримання інформації про бейджі,
 * перевірки права на їх отримання та нарахування винагороди
 *
 * @module badgeActions
 */

import { BadgeActionTypes } from './badgeState';
import { checkBadgesProgress } from '../services/checkBadgeEligibility';
import { calculateEligibleBadgesReward, getTotalPotentialBadgeRewards } from '../services/convertBadgeToWinix';
import { checkAllTasksCompletion, checkTaskProgress } from '../services/checkTaskCompletion';

/**
 * Створює дію початку запиту бейджів
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchBadgesRequest = () => ({
  type: BadgeActionTypes.FETCH_BADGES_REQUEST
});

/**
 * Створює дію успішного отримання бейджів
 * @param {Object} data - Дані про бейджі
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const fetchBadgesSuccess = (data) => ({
  type: BadgeActionTypes.FETCH_BADGES_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання бейджів
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchBadgesFailure = (error) => ({
  type: BadgeActionTypes.FETCH_BADGES_FAILURE,
  payload: { error: error.message || 'Помилка отримання бейджів' }
});

/**
 * Створює дію початку запиту завдань
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchTasksRequest = () => ({
  type: BadgeActionTypes.FETCH_TASKS_REQUEST
});

/**
 * Створює дію успішного отримання завдань
 * @param {Object} data - Дані про завдання
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const fetchTasksSuccess = (data) => ({
  type: BadgeActionTypes.FETCH_TASKS_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання завдань
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchTasksFailure = (error) => ({
  type: BadgeActionTypes.FETCH_TASKS_FAILURE,
  payload: { error: error.message || 'Помилка отримання завдань' }
});

/**
 * Створює дію початку запиту на отримання винагороди за бейдж
 * @returns {Object} Об'єкт дії REQUEST
 */
export const claimBadgeRequest = () => ({
  type: BadgeActionTypes.CLAIM_BADGE_REQUEST
});

/**
 * Створює дію успішного отримання винагороди за бейдж
 * @param {Object} data - Дані про отриману винагороду
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const claimBadgeSuccess = (data) => ({
  type: BadgeActionTypes.CLAIM_BADGE_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання винагороди за бейдж
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const claimBadgeFailure = (error) => ({
  type: BadgeActionTypes.CLAIM_BADGE_FAILURE,
  payload: { error: error.message || 'Помилка отримання винагороди за бейдж' }
});

/**
 * Створює дію початку запиту на отримання винагороди за завдання
 * @returns {Object} Об'єкт дії REQUEST
 */
export const claimTaskRequest = () => ({
  type: BadgeActionTypes.CLAIM_TASK_REQUEST
});

/**
 * Створює дію успішного отримання винагороди за завдання
 * @param {Object} data - Дані про отриману винагороду
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const claimTaskSuccess = (data) => ({
  type: BadgeActionTypes.CLAIM_TASK_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання винагороди за завдання
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const claimTaskFailure = (error) => ({
  type: BadgeActionTypes.CLAIM_TASK_FAILURE,
  payload: { error: error.message || 'Помилка отримання винагороди за завдання' }
});

/**
 * Створює дію оновлення прогресу бейджів
 * @param {Object} data - Дані про прогрес бейджів
 * @returns {Object} Об'єкт дії UPDATE з даними
 */
export const updateBadgesProgress = (data) => ({
  type: BadgeActionTypes.UPDATE_BADGES_PROGRESS,
  payload: data
});

/**
 * Створює дію очищення помилки
 * @returns {Object} Об'єкт дії CLEAR_ERROR
 */
export const clearBadgeError = () => ({
  type: BadgeActionTypes.CLEAR_BADGE_ERROR
});

/**
 * Асинхронна дія для отримання даних про бейджі користувача
 *
 * @param {string|number} userId - ID користувача
 * @param {number} referralsCount - Кількість рефералів користувача
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchUserBadges = (userId, referralsCount) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchBadgesRequest());

    try {
      // Отримуємо прогрес за бейджами
      const badgesProgressData = checkBadgesProgress(referralsCount);

      // Отримуємо винагороди за бейджі
      const { eligibleBadges, badgeRewards, totalReward } =
        calculateEligibleBadgesReward(referralsCount);

      // Отримуємо потенційні винагороди
      const { allBadgeTypes, totalPotentialReward } =
        getTotalPotentialBadgeRewards();

      // Формуємо результат
      const result = {
        userId,
        referralsCount,
        earnedBadges: badgesProgressData.eligibleBadges,
        availableBadges: badgesProgressData.eligibleBadges, // Припускаємо, що всі зароблені бейджі доступні для отримання
        badgesProgress: badgesProgressData.badgeProgress,
        totalBadgesCount: allBadgeTypes.length,
        totalAvailableBadgesCount: badgesProgressData.eligibleBadges.length,
        earnedBadgesReward: totalReward,
        availableBadgesReward: totalReward, // Те саме припущення
        totalPotentialReward,
        nextBadge: badgesProgressData.nextBadge
      };

      // Диспатчимо успішне отримання даних
      dispatch(fetchBadgesSuccess(result));

      return result;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchBadgesFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія для отримання даних про завдання користувача
 *
 * @param {string|number} userId - ID користувача
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchUserTasks = (userId) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchTasksRequest());

    try {
      // Отримуємо дані про виконання завдань
      const tasksData = await checkAllTasksCompletion(userId);

      // Диспатчимо успішне отримання даних
      dispatch(fetchTasksSuccess(tasksData));

      return tasksData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchTasksFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія для отримання винагороди за бейдж
 *
 * @param {string|number} userId - ID користувача
 * @param {string} badgeType - Тип бейджа
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const claimBadgeReward = (userId, badgeType) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(claimBadgeRequest());

    try {
      // В реальному додатку тут має бути запит на бекенд
      // для нарахування винагороди за бейдж

      // Імітуємо затримку мережі
      await new Promise(resolve => setTimeout(resolve, 300));

      // Інформація про отриману винагороду
      const rewardData = {
        userId,
        badgeType,
        timestamp: new Date().toISOString(),
        reward: badgeType === 'BRONZE' ? 2500 :
                badgeType === 'SILVER' ? 5000 :
                badgeType === 'GOLD' ? 10000 :
                badgeType === 'PLATINUM' ? 20000 : 0
      };

      // Диспатчимо успішне отримання винагороди
      dispatch(claimBadgeSuccess(rewardData));

      return rewardData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(claimBadgeFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Асинхронна дія для отримання винагороди за завдання
 *
 * @param {string|number} userId - ID користувача
 * @param {string} taskType - Тип завдання
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const claimTaskReward = (userId, taskType) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(claimTaskRequest());

    try {
      // Перевіряємо прогрес завдання
      const taskProgressData = await checkTaskProgress(userId, taskType);

      // Перевіряємо, чи завдання виконано
      if (!taskProgressData.progress.completed) {
        throw new Error('Завдання ще не виконано');
      }

      // В реальному додатку тут має бути запит на бекенд
      // для нарахування винагороди за завдання

      // Імітуємо затримку мережі
      await new Promise(resolve => setTimeout(resolve, 300));

      // Інформація про отриману винагороду
      const rewardData = {
        userId,
        taskType,
        timestamp: new Date().toISOString(),
        reward: taskProgressData.reward
      };

      // Диспатчимо успішне отримання винагороди
      dispatch(claimTaskSuccess(rewardData));

      return rewardData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(claimTaskFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

export default {
  fetchUserBadges,
  fetchUserTasks,
  claimBadgeReward,
  claimTaskReward,
  updateBadgesProgress,
  clearBadgeError
};