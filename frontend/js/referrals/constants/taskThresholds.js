/**
 * Константи порогів для завдань у реферальній системі
 *
 * Визначає кількість рефералів, необхідну для виконання завдань,
 * та відповідну винагороду в winix
 *
 * @module taskThresholds
 */

// Поріг для виконання завдання з рефералами (100 рефералів)
export const REFERRAL_TASK_THRESHOLD = 100;

// Винагорода за виконання завдання з рефералами (12000 winix)
export const REFERRAL_TASK_REWARD = 12000;

// Додаткові пороги для інших типів завдань (якщо будуть додані в майбутньому)
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

export default TASK_THRESHOLDS;