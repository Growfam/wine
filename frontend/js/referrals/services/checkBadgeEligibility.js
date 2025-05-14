
/**
 * Сервіс перевірки права на бейджі
 *
 * Перевіряє чи має користувач право на отримання бейджів
 * різних рівнів на основі кількості його рефералів
 *
 * @module checkBadgeEligibility
 */

import {
  BADGE_THRESHOLDS,
  BADGE_TYPES
} from '../constants/badgeThresholds';

/**
 * Перевіряє право користувача на конкретний бейдж
 * @param {string} badgeType - Тип бейджа ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')
 * @param {number} referralsCount - Кількість рефералів користувача
 * @returns {boolean} Чи має користувач право на цей бейдж
 */
export const isEligibleForBadge = (badgeType, referralsCount) => {
  if (!badgeType || !BADGE_THRESHOLDS[badgeType]) {
    return false;
  }

  return referralsCount >= BADGE_THRESHOLDS[badgeType];
};

/**
 * Визначає найвищий доступний бейдж для користувача
 * @param {number} referralsCount - Кількість рефералів користувача
 * @returns {string|null} Тип найвищого доступного бейджа або null, якщо немає доступних бейджів
 */
export const getHighestEligibleBadge = (referralsCount) => {
  // Перевіряємо від найвищого до найнижчого рівня
  for (let i = BADGE_TYPES.length - 1; i >= 0; i--) {
    const badgeType = BADGE_TYPES[i];
    if (isEligibleForBadge(badgeType, referralsCount)) {
      return badgeType;
    }
  }

  return null;
};

/**
 * Отримує всі бейджі, на які користувач має право
 * @param {number} referralsCount - Кількість рефералів користувача
 * @returns {Array<string>} Масив типів бейджів, доступних користувачу
 */
export const getAllEligibleBadges = (referralsCount) => {
  return BADGE_TYPES.filter(badgeType =>
    isEligibleForBadge(badgeType, referralsCount)
  );
};

/**
 * Визначає наступний цільовий бейдж для користувача
 * @param {number} referralsCount - Поточна кількість рефералів користувача
 * @returns {Object|null} Об'єкт з інформацією про наступний бейдж або null, якщо всі бейджі вже отримані
 */
export const getNextBadgeTarget = (referralsCount) => {
  for (const badgeType of BADGE_TYPES) {
    if (!isEligibleForBadge(badgeType, referralsCount)) {
      const threshold = BADGE_THRESHOLDS[badgeType];
      const remaining = threshold - referralsCount;

      return {
        type: badgeType,
        threshold,
        remaining,
        progress: (referralsCount / threshold) * 100
      };
    }
  }

  // Якщо всі бейджі вже отримані
  return null;
};

/**
 * Перевіряє прогрес користувача по всіх бейджах
 * @param {number} referralsCount - Кількість рефералів користувача
 * @returns {Object} Об'єкт з інформацією про прогрес по всіх бейджах
 */
export const checkBadgesProgress = (referralsCount) => {
  const eligibleBadges = getAllEligibleBadges(referralsCount);
  const nextBadge = getNextBadgeTarget(referralsCount);

  return {
    currentReferralsCount: referralsCount,
    eligibleBadges,
    earnedBadgesCount: eligibleBadges.length,
    nextBadge,
    hasAllBadges: eligibleBadges.length === BADGE_TYPES.length,
    badgeProgress: BADGE_TYPES.map(badgeType => {
      const threshold = BADGE_THRESHOLDS[badgeType];
      const isEligible = referralsCount >= threshold;
      const progress = Math.min(100, (referralsCount / threshold) * 100);

      return {
        type: badgeType,
        threshold,
        isEligible,
        progress
      };
    })
  };
};

export default {
  isEligibleForBadge,
  getHighestEligibleBadge,
  getAllEligibleBadges,
  getNextBadgeTarget,
  checkBadgesProgress
};