/**
 * Константи винагород за бейджі у реферальній системі
 *
 * Визначає кількість winix, яку користувач отримує за досягнення
 * різних рівнів бейджів (бронза, срібло, золото, платина)
 *
 * @module badgeRewards
 */

// Винагорода за бронзовий бейдж (2500 winix)
export const BRONZE_BADGE_REWARD = 2500;

// Винагорода за срібний бейдж (5000 winix)
export const SILVER_BADGE_REWARD = 5000;

// Винагорода за золотий бейдж (10000 winix)
export const GOLD_BADGE_REWARD = 10000;

// Винагорода за платиновий бейдж (20000 winix)
export const PLATINUM_BADGE_REWARD = 20000;

// Об'єкт з усіма винагородами для зручного доступу
export const BADGE_REWARDS = {
  BRONZE: BRONZE_BADGE_REWARD,
  SILVER: SILVER_BADGE_REWARD,
  GOLD: GOLD_BADGE_REWARD,
  PLATINUM: PLATINUM_BADGE_REWARD
};

// Функція отримання винагороди за типом бейджа
export const getRewardByBadgeType = (badgeType) => {
  return BADGE_REWARDS[badgeType] || 0;
};

export default BADGE_REWARDS;