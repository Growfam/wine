/**
 * Сервіс для розрахунку загального заробітку від конкретного реферала
 * Сумує всі види винагород, отриманих від одного реферала
 *
 * @module referral/services/calculateTotalEarnedForUser
 */

import { fetchReferralDetailedEarnings } from '../api/fetchReferralEarnings';
import { normalizeWinixAmount } from '../utils/formatWinixAmount';
import { DIRECT_BONUS_AMOUNT } from '../constants/directBonuses';
import { LEVEL_1_REWARD_RATE, LEVEL_2_REWARD_RATE } from '../constants/rewardRates';

/**
 * Розраховує загальний заробіток від конкретного реферала
 *
 * @param {string} ownerId - ID власника реферала (поточний користувач)
 * @param {string} referralId - ID реферала, для якого розраховуємо заробіток
 * @returns {Promise<number>} Загальна сума заробітку від реферала
 */
export const calculateTotalEarnedForUser = async (ownerId, referralId) => {
  if (!ownerId || !referralId) {
    console.error('calculateTotalEarnedForUser: Missing required parameters');
    return 0;
  }

  try {
    // Отримуємо детальні дані про заробіток від реферала
    const earningsData = await fetchReferralDetailedEarnings(ownerId, referralId);

    // Отримуємо прямий бонус
    const directBonus = earningsData.directBonus || DIRECT_BONUS_AMOUNT;

    // Отримуємо відсоткові винагороди
    const percentageRewards = normalizeWinixAmount(earningsData.percentageRewards || 0);

    // Сумуємо всі типи винагород
    return directBonus + percentageRewards;
  } catch (error) {
    console.error('Error calculating total earned for user:', error);
    return 0;
  }
};

/**
 * Розраховує прогнозований заробіток від реферала на основі його активності
 *
 * @param {string} ownerId - ID власника реферала (поточний користувач)
 * @param {string} referralId - ID реферала, для якого робимо прогноз
 * @param {Object} referralData - Дані про реферала
 * @returns {Promise<Object>} Об'єкт з прогнозами заробітку
 */
export const predictEarningsForReferral = async (ownerId, referralId, referralData = {}) => {
  if (!ownerId || !referralId) {
    console.error('predictEarningsForReferral: Missing required parameters');
    return { current: 0, monthly: 0, yearly: 0 };
  }

  try {
    // Отримуємо поточний заробіток від реферала, якщо даних недостатньо
    const currentEarnings = referralData.totalEarnings ||
                          await calculateTotalEarnedForUser(ownerId, referralId);

    // Отримуємо середній місячний дохід реферала (якщо є)
    const referralMonthlyIncome = referralData.monthlyIncome || 0;

    // Обчислюємо прогнозований місячний заробіток
    let predictedMonthlyEarnings = 0;

    // Визначаємо рівень реферала
    const referralLevel = referralData.level || 1;

    if (referralMonthlyIncome > 0) {
      // Обчислюємо прогнозований відсотковий дохід від реферала
      if (referralLevel === 1) {
        predictedMonthlyEarnings = referralMonthlyIncome * LEVEL_1_REWARD_RATE;
      } else if (referralLevel === 2) {
        predictedMonthlyEarnings = referralMonthlyIncome * LEVEL_2_REWARD_RATE;
      }
    } else {
      // Якщо немає даних про дохід реферала, використовуємо історичні дані
      const earningsData = await fetchReferralDetailedEarnings(ownerId, referralId);

      if (earningsData.monthlyAverageReward) {
        predictedMonthlyEarnings = earningsData.monthlyAverageReward;
      } else {
        // Якщо немає історичних даних, робимо консервативну оцінку
        const daysSinceRegistration = referralData.daysSinceRegistration || 30;
        const daysWithActivity = referralData.daysWithActivity || 1;

        // Активність реферала (відсоток днів з активністю)
        const activityRate = Math.min(daysWithActivity / daysSinceRegistration, 1);

        // Базовий дохід залежить від рівня
        const baseMonthlyEarnings = referralLevel === 1 ? 500 : 250;

        // Прогнозований дохід з урахуванням активності
        predictedMonthlyEarnings = baseMonthlyEarnings * activityRate;
      }
    }

    // Розраховуємо річний прогноз
    const predictedYearlyEarnings = predictedMonthlyEarnings * 12;

    return {
      current: currentEarnings,
      monthly: predictedMonthlyEarnings,
      yearly: predictedYearlyEarnings
    };
  } catch (error) {
    console.error('Error predicting earnings for referral:', error);
    return { current: 0, monthly: 0, yearly: 0 };
  }
};

/**
 * Класифікує рефералів за рівнем дохідності
 *
 * @param {Array} referrals - Масив рефералів з їхнім заробітком
 * @returns {Object} Об'єкт з класифікацією рефералів
 */
export const classifyReferralsByEarnings = (referrals) => {
  if (!Array.isArray(referrals) || referrals.length === 0) {
    return { highValue: [], mediumValue: [], lowValue: [] };
  }

  // Сортуємо рефералів за заробітком (від найбільшого до найменшого)
  const sortedReferrals = [...referrals].sort((a, b) => {
    return (b.totalEarnings || 0) - (a.totalEarnings || 0);
  });

  const total = sortedReferrals.length;

  // Високодохідні - верхні 20% рефералів
  const highValueCount = Math.ceil(total * 0.2);
  // Середньодохідні - середні 30% рефералів
  const mediumValueCount = Math.ceil(total * 0.3);
  // Низькодохідні - решта 50% рефералів

  return {
    highValue: sortedReferrals.slice(0, highValueCount),
    mediumValue: sortedReferrals.slice(highValueCount, highValueCount + mediumValueCount),
    lowValue: sortedReferrals.slice(highValueCount + mediumValueCount)
  };
};

/**
 * Аналізує структуру заробітку від рефералів
 *
 * @param {string} userId - ID користувача
 * @param {Array} referrals - Масив рефералів користувача
 * @returns {Promise<Object>} Аналіз структури заробітку
 */
export const analyzeEarningsStructure = async (userId, referrals) => {
  if (!Array.isArray(referrals) || referrals.length === 0) {
    return {
      totalEarned: 0,
      directBonusesPercentage: 0,
      percentageRewardsPercentage: 0,
      level1EarningsPercentage: 0,
      level2EarningsPercentage: 0,
      topEarners: []
    };
  }

  try {
    // Розраховуємо заробіток для кожного реферала
    const referralsWithEarnings = await Promise.all(
      referrals.map(async (referral) => {
        if (referral.totalEarnings === undefined) {
          const earnings = await calculateTotalEarnedForUser(userId, referral.id);
          return { ...referral, totalEarnings: earnings };
        }
        return referral;
      })
    );

    // Обчислюємо загальний заробіток
    const totalEarned = referralsWithEarnings.reduce((sum, ref) => sum + (ref.totalEarnings || 0), 0);

    // Розділяємо на прямі бонуси і відсоткові винагороди
    const directBonusesTotal = referralsWithEarnings.length * DIRECT_BONUS_AMOUNT;
    const percentageRewardsTotal = totalEarned - directBonusesTotal;

    // Розраховуємо заробіток від рефералів 1-го і 2-го рівня
    const level1Earnings = referralsWithEarnings
      .filter(ref => ref.level === 1 || !ref.level)
      .reduce((sum, ref) => sum + (ref.totalEarnings || 0), 0);

    const level2Earnings = referralsWithEarnings
      .filter(ref => ref.level === 2)
      .reduce((sum, ref) => sum + (ref.totalEarnings || 0), 0);

    // Знаходимо топ-5 рефералів за заробітком
    const topEarners = [...referralsWithEarnings]
      .sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0))
      .slice(0, 5);

    // Розраховуємо відсотки
    const directBonusesPercentage = totalEarned !== 0 ? (directBonusesTotal / totalEarned) * 100 : 0;
    const percentageRewardsPercentage = totalEarned !== 0 ? (percentageRewardsTotal / totalEarned) * 100 : 0;
    const level1EarningsPercentage = totalEarned !== 0 ? (level1Earnings / totalEarned) * 100 : 0;
    const level2EarningsPercentage = totalEarned !== 0 ? (level2Earnings / totalEarned) * 100 : 0;

    return {
      totalEarned,
      directBonusesTotal,
      percentageRewardsTotal,
      level1Earnings,
      level2Earnings,
      directBonusesPercentage,
      percentageRewardsPercentage,
      level1EarningsPercentage,
      level2EarningsPercentage,
      topEarners
    };
  } catch (error) {
    console.error('Error analyzing earnings structure:', error);
    throw new Error('Failed to analyze earnings structure');
  }
};