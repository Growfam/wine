/**
 * Сервіс для розрахунку винагороди з рефералів 2-го рівня
 *
 * Обчислює суму винагороди на основі заробітків рефералів 2-го рівня
 * відповідно до встановленої ставки (5%)
 *
 * @module calculateLevel2Reward
 */

import { LEVEL_2_REWARD_RATE } from '../constants/rewardRates';
import { calculatePercentage } from '../utils/calculatePercentage';

/**
 * Розраховує винагороду з рефералів 2-го рівня на основі їх заробітків
 * @param {Array<Object>} referrals - Масив об'єктів з даними про рефералів 2-го рівня
 * @param {Object} [options] - Додаткові опції для розрахунку
 * @param {boolean} [options.activeOnly=true] - Враховувати тільки активних рефералів
 * @param {number} [options.customRate] - Власна ставка винагороди (замість стандартної)
 * @param {boolean} [options.groupByReferrers=false] - Групувати результати за рефералами 1-го рівня
 * @returns {Object} Результат розрахунку винагороди
 */
export const calculateLevel2Reward = (referrals, options = {}) => {
  // Перевірка вхідних даних
  if (!referrals || !Array.isArray(referrals)) {
    return {
      totalReward: 0,
      rewardRate: LEVEL_2_REWARD_RATE,
      totalEarnings: 0,
      referralsCount: 0,
      activeReferralsCount: 0,
      referralRewards: [],
      groupedRewards: {}
    };
  }

  const {
    activeOnly = true,
    customRate,
    groupByReferrers = false
  } = options;

  // Використовуємо власну ставку, якщо вказано, інакше - стандартну
  const rewardRate = customRate !== undefined ? customRate : LEVEL_2_REWARD_RATE;

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
      referrerId: referral.referrerId, // ID реферала 1-го рівня, який запросив
      earnings,
      reward,
      rate: rewardRate
    };
  });

  // Підраховуємо загальну суму заробітків і винагороду
  const totalEarnings = referralRewards.reduce((sum, item) => sum + item.earnings, 0);
  const totalReward = referralRewards.reduce((sum, item) => sum + item.reward, 0);

  // Групуємо винагороди за рефералами 1-го рівня, якщо потрібно
  let groupedRewards = {};

  if (groupByReferrers) {
    // Створюємо групи за referrerId
    referralRewards.forEach(reward => {
      const referrerId = reward.referrerId;

      // Якщо групи ще немає, створюємо її
      if (!groupedRewards[referrerId]) {
        groupedRewards[referrerId] = {
          referrerId,
          totalEarnings: 0,
          totalReward: 0,
          referralsCount: 0,
          rewards: []
        };
      }

      // Додаємо винагороду до групи
      groupedRewards[referrerId].totalEarnings += reward.earnings;
      groupedRewards[referrerId].totalReward += reward.reward;
      groupedRewards[referrerId].referralsCount += 1;
      groupedRewards[referrerId].rewards.push(reward);
    });
  }

  // Формуємо результат
  return {
    totalReward,
    rewardRate,
    totalEarnings,
    referralsCount: referrals.length,
    activeReferralsCount: filteredReferrals.length,
    referralRewards,
    groupedRewards
  };
};

/**
 * Розраховує потенційну винагороду з рефералів 2-го рівня на основі загальної суми їх заробітків
 * @param {number} totalEarnings - Загальна сума заробітків рефералів 2-го рівня
 * @param {number} [customRate] - Власна ставка винагороди (замість стандартної)
 * @returns {number} Потенційна винагорода
 */
export const calculatePotentialLevel2Reward = (totalEarnings, customRate) => {
  // Перевірка вхідних даних
  if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
    return 0;
  }

  // Використовуємо власну ставку, якщо вказано, інакше - стандартну
  const rewardRate = customRate !== undefined ? customRate : LEVEL_2_REWARD_RATE;

  // Розраховуємо винагороду
  return calculatePercentage(totalEarnings, rewardRate);
};

/**
 * Розраховує комбіновану винагороду з рефералів 2-го рівня, згрупованих за рефералами 1-го рівня
 * @param {Array<Object>} level1Referrals - Масив рефералів 1-го рівня
 * @param {Array<Object>} level2Referrals - Масив рефералів 2-го рівня
 * @param {Object} [options] - Додаткові опції
 * @returns {Object} Результат комбінованого розрахунку
 */
export const calculateCombinedLevel2Reward = (level1Referrals, level2Referrals, options = {}) => {
  // Перевірка вхідних даних
  if (!level1Referrals || !Array.isArray(level1Referrals) ||
      !level2Referrals || !Array.isArray(level2Referrals)) {
    return {
      totalReward: 0,
      level1ReferralsWithLevel2: [],
      combinedRewards: []
    };
  }

  // Створюємо мапу ID рефералів 1-го рівня для швидкого пошуку
  const level1Map = level1Referrals.reduce((map, ref) => {
    map[ref.id] = ref;
    return map;
  }, {});

  // Розраховуємо винагороду з включеним групуванням
  const level2Rewards = calculateLevel2Reward(level2Referrals, {
    ...options,
    groupByReferrers: true
  });

  // Формуємо список рефералів 1-го рівня, які мають рефералів 2-го рівня
  const level1ReferralsWithLevel2 = [];

  // Формуємо комбіновану інформацію про винагороди
  const combinedRewards = Object.keys(level2Rewards.groupedRewards).map(referrerId => {
    const groupData = level2Rewards.groupedRewards[referrerId];
    const level1Data = level1Map[referrerId] || { id: referrerId, active: false };

    // Додаємо до списку рефералів 1-го рівня з рефералами 2-го рівня
    level1ReferralsWithLevel2.push(level1Data);

    return {
      referrer: level1Data,
      totalEarnings: groupData.totalEarnings,
      totalReward: groupData.totalReward,
      referralsCount: groupData.referralsCount,
      detailedRewards: groupData.rewards
    };
  });

  return {
    totalReward: level2Rewards.totalReward,
    level1ReferralsWithLevel2,
    combinedRewards
  };
};

export default calculateLevel2Reward;