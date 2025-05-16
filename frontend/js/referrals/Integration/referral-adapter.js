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
  // ВАЖЛИВО: fetchLevelRewards не імпортуємо звідси!
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
} from '../index.js';

// Імпортуємо функцію ініціалізації напряму з файлу інтеграції
import { initReferralSystem } from './referrals-integration.js';

// Імпортуємо напряму залежності для fetchLevelRewards
import { fetchReferralEarnings } from '../api/fetchReferralEarnings.js';
import { calculateLevel1Reward } from '../services/calculateLevel1Reward.js';
import { calculateLevel2Reward } from '../services/calculateLevel2Reward.js';

/**
 * Локальна реалізація fetchLevelRewards, щоб обійти проблему імпорту
 *
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для запиту
 * @returns {Function} Функція thunk
 */
const fetchLevelRewards = (userId, options = {}) => {
  return async (dispatch) => {
    try {
      console.log('Виконується fetchLevelRewards з adapter.js');

      // Отримуємо дані про заробітки рефералів
      const earningsData = await fetchReferralEarnings(userId, options);

      // Розраховуємо винагороду для рефералів 1-го рівня
      const level1RewardsData = calculateLevel1Reward(
        earningsData.level1Referrals,
        options
      );

      // Розраховуємо винагороду для рефералів 2-го рівня
      const level2RewardsData = calculateLevel2Reward(
        earningsData.level2Referrals,
        {
          ...options,
          groupByReferrers: true // Включаємо групування за рефералами 1-го рівня
        }
      );

      // Формуємо результат
      const rewardsData = {
        level1Rewards: level1RewardsData,
        level2Rewards: level2RewardsData,
        summary: {
          totalPercentageReward: level1RewardsData.totalReward + level2RewardsData.totalReward,
          totalReferralsEarnings: level1RewardsData.totalEarnings + level2RewardsData.totalEarnings,
          lastUpdated: new Date().toISOString()
        }
      };

      // Якщо є диспатч, викликаємо його з результатом
      if (typeof dispatch === 'function') {
        dispatch({
          type: 'FETCH_LEVEL_REWARDS_SUCCESS',
          payload: rewardsData
        });
      }

      return rewardsData;
    } catch (error) {
      console.error('Error fetching level rewards:', error);

      // Якщо є диспатч, викликаємо його з помилкою
      if (typeof dispatch === 'function') {
        dispatch({
          type: 'FETCH_LEVEL_REWARDS_FAILURE',
          payload: { error: error.message || 'Failed to fetch level rewards' }
        });
      }

      throw error;
    }
  };
};

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
  fetchLevelRewards, // Використовуємо нашу локальну реалізацію
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
  console.log('DOMContentLoaded: ініціалізація WinixReferral...');
  if (typeof initReferralSystem === 'function') {
    try {
      initReferralSystem();
      console.log('Реферальна система успішно ініціалізована!');
    } catch (error) {
      console.error('Помилка при ініціалізації реферальної системи:', error);
    }
  } else {
    console.error('Функція initReferralSystem не знайдена або не є функцією!');
  }
});

console.log('WINIX Реферальна система: модуль завантажено!');