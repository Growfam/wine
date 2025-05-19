/**
 * Окрема дія для отримання відсоткових винагород
 * Винесена в окремий файл для повного уникнення циклічних залежностей
 */

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
    try {
      console.log('fetchLevelRewards: початок виконання для userId:', userId);

      // Динамічно імпортуємо всі необхідні модулі
      const [
        { fetchReferralEarnings },
        { calculateLevel1Reward },
        { calculateLevel2Reward }
      ] = await Promise.all([
        import('./api/fetchReferralEarnings.js'),
        import('./services/calculateLevel1Reward.js'),
        import('./services/calculateLevel2Reward.js')
      ]);

      console.log('fetchLevelRewards: модулі завантажені успішно');

      // Типи дій визначені тут безпосередньо
      const FETCH_LEVEL_REWARDS_REQUEST = 'FETCH_LEVEL_REWARDS_REQUEST';
      const FETCH_LEVEL_REWARDS_SUCCESS = 'FETCH_LEVEL_REWARDS_SUCCESS';
      const FETCH_LEVEL_REWARDS_FAILURE = 'FETCH_LEVEL_REWARDS_FAILURE';

      // Функції дій
      const fetchLevelRewardsRequest = () => ({
        type: FETCH_LEVEL_REWARDS_REQUEST
      });

      const fetchLevelRewardsSuccess = (data) => ({
        type: FETCH_LEVEL_REWARDS_SUCCESS,
        payload: data
      });

      const fetchLevelRewardsFailure = (error) => ({
        type: FETCH_LEVEL_REWARDS_FAILURE,
        payload: { error: error.message || 'Помилка отримання даних про винагороди' }
      });

      // Диспатчимо початок запиту
      dispatch(fetchLevelRewardsRequest());
      console.log('fetchLevelRewards: диспатчено REQUEST');

      // Отримуємо дані про заробітки рефералів
      const earningsData = await fetchReferralEarnings(userId, options);
      console.log('fetchLevelRewards: отримано дані про заробітки:', earningsData);

      // Розраховуємо винагороду для рефералів 1-го рівня
      const level1RewardsData = calculateLevel1Reward(
        earningsData.level1Referrals,
        options
      );
      console.log('fetchLevelRewards: розраховано level1Rewards:', level1RewardsData);

      // Розраховуємо винагороду для рефералів 2-го рівня
      const level2RewardsData = calculateLevel2Reward(
        earningsData.level2Referrals,
        {
          ...options,
          groupByReferrers: true // Включаємо групування за рефералами 1-го рівня
        }
      );
      console.log('fetchLevelRewards: розраховано level2Rewards:', level2RewardsData);

      // Формуємо результат
      const rewardsData = {
        level1Rewards: level1RewardsData,
        level2Rewards: level2RewardsData,
        summary: {
          totalPercentageReward: level1RewardsData.totalReward + level2RewardsData.totalReward,
          totalReferralsEarnings: level1RewardsData.totalEarnings + level2RewardsData.totalEarnings,
          lastUpdated: new Date().toISOString()
        }
      };

      console.log('fetchLevelRewards: сформовано результат:', rewardsData);

      // Диспатчимо успішне отримання даних
      dispatch(fetchLevelRewardsSuccess(rewardsData));
      console.log('fetchLevelRewards: диспатчено SUCCESS');

      return rewardsData;
    } catch (error) {
      console.error('fetchLevelRewards: помилка:', error);

      // Типи дій для помилки
      const FETCH_LEVEL_REWARDS_FAILURE = 'FETCH_LEVEL_REWARDS_FAILURE';

      const fetchLevelRewardsFailure = (error) => ({
        type: FETCH_LEVEL_REWARDS_FAILURE,
        payload: { error: error.message || 'Помилка отримання даних про винагороди' }
      });

      // Диспатчимо помилку
      dispatch(fetchLevelRewardsFailure(error));
      console.log('fetchLevelRewards: диспатчено FAILURE');

      // Перекидаємо помилку далі для обробки в компоненті
      throw error;
    }
  };
};