/**
 * Сервіс для розрахунку винагороди з рефералів 1-го рівня
 *
 * Обчислює суму винагороди на основі заробітків рефералів 1-го рівня
 * відповідно до встановленої ставки (10%)
 *
 * @module calculateLevel1Reward
 */

import { LEVEL_1_REWARD_RATE } from '../constants/rewardRates';
import { calculatePercentage } from '../utils/calculatePercentage';

/**
 * Розраховує винагороду з рефералів 1-го рівня на основі їх заробітків
 * @param {Array<Object>} referrals - Масив об'єктів з даними про рефералів 1-го рівня
 * @param {Object} [options] - Додаткові опції для розрахунку
 * @param {boolean} [options.activeOnly=true] - Враховувати тільки активних рефералів
 * @param {number} [options.customRate] - Власна ставка винагороди (замість стандартної)
 * @returns {Object} Результат розрахунку винагороди
 */
export const calculateLevel1Reward = (referrals, options = {}) => {
  // Перевірка вхідних даних
  if (!referrals || !Array.isArray(referrals)) {
    return {
      totalReward: 0,
      rewardRate: LEVEL_1_REWARD_RATE,
      totalEarnings: 0,
      referralsCount: 0,
      activeReferralsCount: 0,
      referralRewards: []
    };
  }

  const {
    activeOnly = true,
    customRate
  } = options;

  // Використовуємо власну ставку, якщо вказано, інакше - стандартну
  const rewardRate = customRate !== undefined ? customRate : LEVEL_1_REWARD_RATE;

  // Фільтруємо рефералів, якщо потрібно враховувати тільки активних
  const filteredReferrals = activeOnly
    ? referrals.filter(ref => ref.active)
    : referrals;

  // Розраховуємо винагороду для кожного реферала
  const referralRewards = filteredReferrals.map(referral => {
    const earnings = referral.totalEarnings || 0;
    const reward = calculatePercentage(earnings, rewardRate);

    return {
      referralId: referral.id,
      earnings,
      reward,
      rate: rewardRate
    };
  });

  // Підраховуємо загальну суму заробітків і винагороду
  const totalEarnings = referralRewards.reduce((sum, item) => sum + item.earnings, 0);
  const totalReward = referralRewards.reduce((sum, item) => sum + item.reward, 0);

  // Формуємо результат
  return {
    totalReward,
    rewardRate,
    totalEarnings,
    referralsCount: referrals.length,
    activeReferralsCount: filteredReferrals.length,
    referralRewards
  };
};

/**
 * Розраховує потенційну винагороду з рефералів 1-го рівня на основі загальної суми їх заробітків
 * @param {number} totalEarnings - Загальна сума заробітків рефералів 1-го рівня
 * @param {number} [customRate] - Власна ставка винагороди (замість стандартної)
 * @returns {number} Потенційна винагорода
 */
export const calculatePotentialLevel1Reward = (totalEarnings, customRate) => {
  // Перевірка вхідних даних
  if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
    return 0;
  }

  // Використовуємо власну ставку, якщо вказано, інакше - стандартну
  const rewardRate = customRate !== undefined ? customRate : LEVEL_1_REWARD_RATE;

  // Розраховуємо винагороду
  return calculatePercentage(totalEarnings, rewardRate);
};

export default calculateLevel1Reward;