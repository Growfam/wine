/**
 * Сервіс конвертації бейджів у winix
 *
 * Обчислює кількість winix, яка нараховується за отримання бейджів різних рівнів
 * відповідно до встановлених ставок винагород
 *
 * @module convertBadgeToWinix
 */

import { BADGE_REWARDS, getRewardByBadgeType } from '../constants/badgeRewards';
import { getAllEligibleBadges } from './checkBadgeEligibility';

/**
 * Конвертує конкретний бейдж у відповідну кількість winix
 * @param {string} badgeType - Тип бейджа ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')
 * @returns {number} Кількість winix за цей бейдж
 */
export const convertBadgeToWinix = (badgeType) => {
  return getRewardByBadgeType(badgeType);
};

/**
 * Визначає загальну суму winix за всі бейджі, які може отримати користувач
 * @param {Array<string>} badgeTypes - Масив типів бейджів
 * @returns {number} Загальна сума winix
 */
export const calculateTotalBadgeReward = (badgeTypes) => {
  if (!badgeTypes || !Array.isArray(badgeTypes)) {
    return 0;
  }

  return badgeTypes.reduce((total, badgeType) => {
    return total + convertBadgeToWinix(badgeType);
  }, 0);
};

/**
 * Розраховує винагороду за всі доступні бейджі на основі кількості рефералів
 * @param {number} referralsCount - Кількість рефералів користувача
 * @returns {Object} Об'єкт з інформацією про винагороди за бейджі
 */
export const calculateEligibleBadgesReward = (referralsCount) => {
  const eligibleBadges = getAllEligibleBadges(referralsCount);
  const totalReward = calculateTotalBadgeReward(eligibleBadges);

  // Деталізація винагород за кожним бейджем
  const badgeRewards = eligibleBadges.map(badgeType => ({
    type: badgeType,
    reward: convertBadgeToWinix(badgeType)
  }));

  return {
    eligibleBadges,
    badgeRewards,
    totalReward
  };
};

/**
 * Розраховує потенційну винагороду за всі можливі бейджі
 * @returns {Object} Об'єкт з інформацією про всі можливі винагороди
 */
export const getTotalPotentialBadgeRewards = () => {
  const allBadgeTypes = Object.keys(BADGE_REWARDS);
  const totalPotentialReward = calculateTotalBadgeReward(allBadgeTypes);

  // Деталізація всіх можливих винагород
  const allBadgeRewards = allBadgeTypes.map(badgeType => ({
    type: badgeType,
    reward: convertBadgeToWinix(badgeType)
  }));

  return {
    allBadgeTypes,
    allBadgeRewards,
    totalPotentialReward
  };
};

/**
 * Розраховує винагороду за новий бейдж при зміні кількості рефералів
 * @param {number} previousCount - Попередня кількість рефералів
 * @param {number} newCount - Нова кількість рефералів
 * @returns {Object} Об'єкт з інформацією про нові винагороди
 */
export const calculateNewBadgeReward = (previousCount, newCount) => {
  const previousBadges = getAllEligibleBadges(previousCount);
  const newBadges = getAllEligibleBadges(newCount);

  // Визначаємо нові отримані бейджі
  const newlyEarnedBadges = newBadges.filter(
    badgeType => !previousBadges.includes(badgeType)
  );

  // Розраховуємо винагороду за нові бейджі
  const newReward = calculateTotalBadgeReward(newlyEarnedBadges);

  return {
    previousBadges,
    newBadges,
    newlyEarnedBadges,
    newReward
  };
};

export default {
  convertBadgeToWinix,
  calculateTotalBadgeReward,
  calculateEligibleBadgesReward,
  getTotalPotentialBadgeRewards,
  calculateNewBadgeReward
};