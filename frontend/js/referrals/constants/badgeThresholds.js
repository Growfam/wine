
/**
 * Константи порогів для отримання бейджів у реферальній системі
 *
 * Визначає кількість рефералів, необхідну для отримання бейджів різних рівнів
 * (бронза, срібло, золото, платина)
 *
 * @module badgeThresholds
 */

// Поріг для отримання бронзового бейджа (25 рефералів)
export const BRONZE_BADGE_THRESHOLD = 25;

// Поріг для отримання срібного бейджа (50 рефералів)
export const SILVER_BADGE_THRESHOLD = 50;

// Поріг для отримання золотого бейджа (100 рефералів)
export const GOLD_BADGE_THRESHOLD = 100;

// Поріг для отримання платинового бейджа (500 рефералів)
export const PLATINUM_BADGE_THRESHOLD = 500;

// Об'єкт з усіма порогами для зручного доступу
export const BADGE_THRESHOLDS = {
  BRONZE: BRONZE_BADGE_THRESHOLD,
  SILVER: SILVER_BADGE_THRESHOLD,
  GOLD: GOLD_BADGE_THRESHOLD,
  PLATINUM: PLATINUM_BADGE_THRESHOLD
};

// Список всіх типів бейджів
export const BADGE_TYPES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

export default BADGE_THRESHOLDS;