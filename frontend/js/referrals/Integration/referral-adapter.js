/**
 * WINIX Реферальна система - Модуль-адаптер для ES модулів
 *
 * Цей файл створений для забезпечення сумісності в середовищах,
 * де ES модулі можуть мати проблеми з прямим підключенням.
 * Він експортує всі необхідні модулі в глобальний об'єкт WinixReferral.
 */

// Імпортуємо модулі реферальної системи
import {
  // Базові функції
  generateReferralLink,
  formatReferralUrl,
  fetchReferralLinkFromAPI,
  fetchReferralLink,

  // Функції для прямих бонусів
  registerReferralAndAwardBonus,
  fetchDirectBonusHistory,
  DIRECT_BONUS_AMOUNT,

  // Функції для рівнів рефералів
  fetchReferralLevels,
  fetchReferralDetails,
  groupLevel2ByReferrers,

  // Функції для відсоткових винагород
  fetchLevelRewards,
  LEVEL_1_REWARD_RATE,
  LEVEL_2_REWARD_RATE,

  // Функції для перевірки активності
  fetchAndCheckReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  MIN_DRAWS_PARTICIPATION,
  MIN_INVITED_REFERRALS,

  // Функції для бейджів та завдань
  fetchUserBadges,
  fetchUserTasks,
  claimBadgeReward,
  claimTaskReward,
  BRONZE_BADGE_THRESHOLD,
  SILVER_BADGE_THRESHOLD,
  GOLD_BADGE_THRESHOLD,
  PLATINUM_BADGE_THRESHOLD,
  BRONZE_BADGE_REWARD,
  SILVER_BADGE_REWARD,
  GOLD_BADGE_REWARD,
  PLATINUM_BADGE_REWARD,
  REFERRAL_TASK_THRESHOLD,
  REFERRAL_TASK_REWARD,

  // Функції для аналітики та рейтингу
  getReferralRanking,
  getTopReferrals,
  findUserRankPosition,
  generateLeaderboard,
  analyzeEarningsStructure,
  sortReferralsByEarnings,
  sortByInvitedCount,
  sortByDrawsParticipation,
  filterAndSortReferrals,
  formatWinixAmount,

  // Стан реферального посилання
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes,

  // Стан прямих бонусів
  directBonusReducer,
  initialDirectBonusState,
  DirectBonusActionTypes,

  // Стан рівнів рефералів
  referralLevelsReducer,
  initialReferralLevelsState,
  ReferralLevelsActionTypes,

  // Константи та шаблони
  REFERRAL_URL_PATTERN,

  // Ця функція створена в integration.js, але не імпортується правильно
  // Оскільки вона не експортується з index.js, імпортуємо її напряму
} from '../index.js';

// Імпортуємо функцію ініціалізації напряму з файлу інтеграції
import { initReferralSystem } from './referrals-integration.js';

// Створюємо глобальний об'єкт для доступу до функцій реферальної системи
window.WinixReferral = {
  // Основні функції
  generateReferralLink,
  formatReferralUrl,
  fetchReferralLinkFromAPI,
  fetchReferralLink,

  // Функції для прямих бонусів
  registerReferralAndAwardBonus,
  fetchDirectBonusHistory,
  DIRECT_BONUS_AMOUNT,

  // Функції для рівнів рефералів
  fetchReferralLevels,
  fetchReferralDetails,
  groupLevel2ByReferrers,

  // Функції для відсоткових винагород
  fetchLevelRewards,
  LEVEL_1_REWARD_RATE,
  LEVEL_2_REWARD_RATE,

  // Функції для перевірки активності
  fetchAndCheckReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  MIN_DRAWS_PARTICIPATION,
  MIN_INVITED_REFERRALS,

  // Функції для бейджів та завдань
  fetchUserBadges,
  fetchUserTasks,
  claimBadgeReward,
  claimTaskReward,
  BRONZE_BADGE_THRESHOLD,
  SILVER_BADGE_THRESHOLD,
  GOLD_BADGE_THRESHOLD,
  PLATINUM_BADGE_THRESHOLD,
  BRONZE_BADGE_REWARD,
  SILVER_BADGE_REWARD,
  GOLD_BADGE_REWARD,
  PLATINUM_BADGE_REWARD,
  REFERRAL_TASK_THRESHOLD,
  REFERRAL_TASK_REWARD,

  // Функції для аналітики та рейтингу
  getReferralRanking,
  getTopReferrals,
  findUserRankPosition,
  generateLeaderboard,
  analyzeEarningsStructure,
  sortReferralsByEarnings,
  sortByInvitedCount,
  sortByDrawsParticipation,
  filterAndSortReferrals,
  formatWinixAmount,

  // Стан реферального посилання
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes,

  // Константи
  REFERRAL_URL_PATTERN,

  // КЛЮЧОВЕ ДОПОВНЕННЯ - функція ініціалізації
  initReferralSystem
};

// Автоматична ініціалізація при завантаженні DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 DOMContentLoaded: початок ініціалізації WinixReferral...');

  if (typeof initReferralSystem === 'function') {
    try {
      console.log('✅ Функція initReferralSystem знайдена, запускаємо...');
      initReferralSystem();
      console.log('🎉 Реферальна система успішно ініціалізована!');
    } catch (error) {
      console.error('❌ Помилка при ініціалізації реферальної системи:', error);
      console.error('📊 Стек помилки:', error.stack);
    }
  } else {
    console.error('❌ Функція initReferralSystem не знайдена або не є функцією!');
    console.error('🔍 Тип initReferralSystem:', typeof initReferralSystem);
  }
});

console.log('📦 WINIX Реферальна система: модуль адаптера завантажено!');
console.log('🔧 Доступні функції в WinixReferral:', Object.keys(window.WinixReferral));