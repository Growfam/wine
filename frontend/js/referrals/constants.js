// actionTypes.js
/**
 * Типи дій для відсоткових винагород
 */
export const LevelRewardsActionTypes = {
  FETCH_LEVEL_REWARDS_REQUEST: 'FETCH_LEVEL_REWARDS_REQUEST',
  FETCH_LEVEL_REWARDS_SUCCESS: 'FETCH_LEVEL_REWARDS_SUCCESS',
  FETCH_LEVEL_REWARDS_FAILURE: 'FETCH_LEVEL_REWARDS_FAILURE',
  UPDATE_LEVEL1_REWARDS: 'UPDATE_LEVEL1_REWARDS',
  UPDATE_LEVEL2_REWARDS: 'UPDATE_LEVEL2_REWARDS',
  FETCH_REWARDS_HISTORY_REQUEST: 'FETCH_REWARDS_HISTORY_REQUEST',
  FETCH_REWARDS_HISTORY_SUCCESS: 'FETCH_REWARDS_HISTORY_SUCCESS',
  FETCH_REWARDS_HISTORY_FAILURE: 'FETCH_REWARDS_HISTORY_FAILURE',
  CLEAR_LEVEL_REWARDS_ERROR: 'CLEAR_LEVEL_REWARDS_ERROR'
};

// activityThresholds.js
/**
 * Константи порогів активності для реферальної системи
 */
// Мінімальна кількість розіграшів для визначення активності реферала
export const MIN_DRAWS_PARTICIPATION = 3;

// Мінімальна кількість запрошених рефералів для визначення активності
export const MIN_INVITED_REFERRALS = 1;

// badgeRewards.js
/**
 * Константи винагород за бейджі у реферальній системі
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

// badgeThresholds.js
/**
 * Константи порогів для отримання бейджів у реферальній системі
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

// directBonuses.js
/**
 * Константи для системи прямих бонусів за реферальною програмою
 */
// Константа бонусу за реферала (50 winix)
export const DIRECT_BONUS_AMOUNT = 50;

// rewardRates.js
/**
 * Константи ставок винагород для реферальної системи
 */
// Ставка винагороди за активність рефералів 1-го рівня (10%)
export const LEVEL_1_REWARD_RATE = 0.1;

// Ставка винагороди за активність рефералів 2-го рівня (5%)
export const LEVEL_2_REWARD_RATE = 0.05;

// taskThresholds.js
/**
 * Константи порогів для завдань у реферальній системі
 */
// Поріг для виконання завдання з рефералами (100 рефералів)
export const REFERRAL_TASK_THRESHOLD = 100;

// Винагорода за виконання завдання з рефералами (12000 winix)
export const REFERRAL_TASK_REWARD = 12000;

// Додаткові пороги для інших типів завдань
export const ACTIVE_REFERRALS_TASK_THRESHOLD = 50;
export const ACTIVE_REFERRALS_TASK_REWARD = 6000;

// Об'єкт з усіма завданнями для зручного доступу
export const TASK_THRESHOLDS = {
  REFERRAL_COUNT: {
    threshold: REFERRAL_TASK_THRESHOLD,
    reward: REFERRAL_TASK_REWARD,
    title: 'Запросити 100 рефералів',
    description: 'Запросіть 100 нових користувачів та отримайте додаткову винагороду'
  },
  ACTIVE_REFERRALS: {
    threshold: ACTIVE_REFERRALS_TASK_THRESHOLD,
    reward: ACTIVE_REFERRALS_TASK_REWARD,
    title: 'Залучити 50 активних рефералів',
    description: 'Залучіть 50 активних користувачів для отримання винагороди'
  }
};

// Список кодів типів завдань
export const TASK_TYPES = Object.keys(TASK_THRESHOLDS);

// urlPatterns.js
/**
 * Константи шаблонів URL для реферальної системи
 */
// Шаблон реферального посилання 'Winix/referral/{id}'
export const REFERRAL_URL_PATTERN = 'Winix/referral/{id}';