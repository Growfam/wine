 /**
 * Дії для роботи з відсотковими винагородами
 *
 * Містить дії (actions) для отримання та оновлення відсоткових винагород
 * з рефералів різних рівнів, обчислення загального прибутку, тощо
 *
 * @module levelRewardsActions
 */

import { LevelRewardsActionTypes } from './levelRewardsState';
import { fetchReferralEarnings } from '../api/fetchReferralEarnings';
import { calculateLevel1Reward } from '../services/calculateLevel1Reward';
import { calculateLevel2Reward } from '../services/calculateLevel2Reward';

/**
 * Створює дію початку запиту відсоткових винагород
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchLevelRewardsRequest = () => ({
  type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_REQUEST
});

/**
 * Створює дію успішного отримання відсоткових винагород
 * @param {Object} data - Дані про відсоткові винагороди
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const fetchLevelRewardsSuccess = (data) => ({
  type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання відсоткових винагород
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchLevelRewardsFailure = (error) => ({
  type: LevelRewardsActionTypes.FETCH_LEVEL_REWARDS_FAILURE,
  payload: { error: error.message || 'Помилка отримання даних про винагороди' }
});

/**
 * Створює дію оновлення винагород рефералів 1-го рівня
 * @param {Object} data - Дані про винагороди рефералів 1-го рівня
 * @returns {Object} Об'єкт дії UPDATE_LEVEL1_REWARDS з даними
 */
export const updateLevel1Rewards = (data) => ({
  type: LevelRewardsActionTypes.UPDATE_LEVEL1_REWARDS,
  payload: data
});

/**
 * Створює дію оновлення винагород рефералів 2-го рівня
 * @param {Object} data - Дані про винагороди рефералів 2-го рівня
 * @returns {Object} Об'єкт дії UPDATE_LEVEL2_REWARDS з даними
 */
export const updateLevel2Rewards = (data) => ({
  type: LevelRewardsActionTypes.UPDATE_LEVEL2_REWARDS,
  payload: data
});

/**
 * Створює дію початку запиту історії нарахувань
 * @returns {Object} Об'єкт дії REQUEST
 */
export const fetchRewardsHistoryRequest = () => ({
  type: LevelRewardsActionTypes.FETCH_REWARDS_HISTORY_REQUEST
});

/**
 * Створює дію успішного отримання історії нарахувань
 * @param {Array} data - Дані про історію нарахувань
 * @returns {Object} Об'єкт дії SUCCESS з даними
 */
export const fetchRewardsHistorySuccess = (data) => ({
  type: LevelRewardsActionTypes.FETCH_REWARDS_HISTORY_SUCCESS,
  payload: data
});

/**
 * Створює дію невдалого отримання історії нарахувань
 * @param {Error} error - Об'єкт помилки
 * @returns {Object} Об'єкт дії FAILURE з помилкою
 */
export const fetchRewardsHistoryFailure = (error) => ({
  type: LevelRewardsActionTypes.FETCH_REWARDS_HISTORY_FAILURE,
  payload: { error: error.message || 'Помилка отримання історії нарахувань' }
});

/**
 * Створює дію очищення помилки
 * @returns {Object} Об'єкт дії CLEAR_ERROR
 */
export const clearLevelRewardsError = () => ({
  type: LevelRewardsActionTypes.CLEAR_LEVEL_REWARDS_ERROR
});

/**
 * Асинхронна дія для отримання та розрахунку відсоткових винагород
 *
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {boolean} [options.activeOnly=true] - Враховувати тільки активних рефералів
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchLevelRewards = (userId, options = {}) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchLevelRewardsRequest());

    try {
      // Отримуємо дані про заробітки рефералів
      const earningsData = await fetchReferralEarnings(userId, options);

      // Розраховуємо винагороду для рефералів 1-го рівня
      const level1RewardsData = calculateLevel1Reward(
        earningsData.level1Referrals,
        options
      );

      // Розраховуємо винагороду для рефералів 2-го рівня
      const level2RewardsData = calculateLevel2Reward(
        earningsData.level2Referrals,
        {
          ...options,
          groupByReferrers: true // Включаємо групування за рефералами 1-го рівня
        }
      );

      // Формуємо результат
      const rewardsData = {
        level1Rewards: level1RewardsData,
        level2Rewards: level2RewardsData
      };

      // Диспатчимо успішне отримання даних
      dispatch(fetchLevelRewardsSuccess(rewardsData));

      return rewardsData;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchLevelRewardsFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Функція для отримання історії нарахувань відсоткових винагород
 *
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки
 * @param {number} [options.limit=10] - Максимальна кількість записів
 * @returns {Function} Функція thunk, яка диспатчить дії
 */
export const fetchRewardsHistory = (userId, options = {}) => {
  return async (dispatch) => {
    // Диспатчимо початок запиту
    dispatch(fetchRewardsHistoryRequest());

    try {
      // В реальному додатку тут був би запит до API
      // Тут імітуємо отримання даних
      await new Promise(resolve => setTimeout(resolve, 300));

      // Створюємо моковані дані для історії нарахувань
      const mockHistory = generateMockHistory(userId, options);

      // Диспатчимо успішне отримання даних
      dispatch(fetchRewardsHistorySuccess(mockHistory));

      return mockHistory;
    } catch (error) {
      // Диспатчимо помилку
      dispatch(fetchRewardsHistoryFailure(error));

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};

/**
 * Генерує моковані дані історії нарахувань для тестування
 * @param {string|number} userId - ID користувача
 * @param {Object} options - Опції для генерації
 * @returns {Array} Масив мокованих записів історії
 * @private
 */
function generateMockHistory(userId, options) {
  const { limit = 10 } = options;
  const currentDate = new Date();

  return Array.from({ length: limit }, (_, index) => {
    // Генеруємо випадкові суми
    const level1Amount = Math.floor(Math.random() * 200) + 50;
    const level2Amount = Math.floor(Math.random() * 100) + 20;
    const totalAmount = level1Amount + level2Amount;

    // Генеруємо дату (кожен запис раніше на 5-10 днів від попереднього)
    const days = 5 + Math.floor(Math.random() * 5);
    const recordDate = new Date(currentDate);
    recordDate.setDate(recordDate.getDate() - (index + 1) * days);

    return {
      id: `reward_${Date.now()}_${index}`,
      userId,
      timestamp: recordDate.toISOString(),
      level1Amount,
      level2Amount,
      totalAmount,
      level1Rate: 0.1,
      level2Rate: 0.05,
      paymentStatus: 'completed'
    };
  });
}

export default {
  fetchLevelRewards,
  fetchRewardsHistory,
  updateLevel1Rewards,
  updateLevel2Rewards,
  clearLevelRewardsError
};