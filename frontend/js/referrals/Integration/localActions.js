import { fetchReferralEarnings } from '../api/fetchReferralEarnings.js';
import { calculateLevel1Reward } from '../services/calculateLevel1Reward.js';
import { calculateLevel2Reward } from '../services/calculateLevel2Reward.js';

/**
 * Локальна версія fetchLevelRewards для інтеграційного модуля
 */
export const localFetchLevelRewards = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      // Отримуємо дані про заробітки рефералів
      const earningsData = await fetchReferralEarnings(userId, options);

      // Тут використовуємо сервіси безпосередньо
      const level1RewardsData = calculateLevel1Reward(earningsData.level1Referrals, options);
      const level2RewardsData = calculateLevel2Reward(earningsData.level2Referrals, {
        ...options,
        groupByReferrers: true
      });

      const rewardsData = {
        level1Rewards: level1RewardsData,
        level2Rewards: level2RewardsData,
        summary: {
          totalPercentageReward: level1RewardsData.totalReward + level2RewardsData.totalReward,
          totalReferralsEarnings: level1RewardsData.totalEarnings + level2RewardsData.totalEarnings,
          lastUpdated: new Date().toISOString()
        }
      };

      // Диспатч, якщо він є
      if (typeof dispatch === 'function') {
        dispatch({
          type: 'FETCH_LEVEL_REWARDS_SUCCESS',
          payload: rewardsData
        });
      }

      return rewardsData;
    } catch (error) {
      console.error('Error fetching level rewards:', error);
      throw error;
    }
  };
};