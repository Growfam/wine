/**
 * Глобальні константи для реферальної системи з детальним логуванням
 */
window.ReferralConstants = (function() {
  'use strict';

  console.log('📦 [CONSTANTS] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ ReferralConstants ==========');
  console.log('🕐 [CONSTANTS] Час завантаження:', new Date().toISOString());

  // actionTypes.js
  console.log('🎯 [CONSTANTS] Ініціалізація LevelRewardsActionTypes...');
  const LevelRewardsActionTypes = {
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
  console.log('✅ [CONSTANTS] LevelRewardsActionTypes створено:', Object.keys(LevelRewardsActionTypes).length, 'типів');

  // activityThresholds.js
  console.log('📊 [CONSTANTS] Встановлення порогів активності...');
  const MIN_DRAWS_PARTICIPATION = 3;
  const MIN_INVITED_REFERRALS = 1;
  console.log('✅ [CONSTANTS] Пороги активності:', {
    MIN_DRAWS_PARTICIPATION: MIN_DRAWS_PARTICIPATION,
    MIN_INVITED_REFERRALS: MIN_INVITED_REFERRALS
  });

  // badgeRewards.js
  console.log('🏆 [CONSTANTS] Встановлення винагород за бейджі...');
  const BRONZE_BADGE_REWARD = 2500;
  const SILVER_BADGE_REWARD = 5000;
  const GOLD_BADGE_REWARD = 10000;
  const PLATINUM_BADGE_REWARD = 20000;

  const BADGE_REWARDS = {
    BRONZE: BRONZE_BADGE_REWARD,
    SILVER: SILVER_BADGE_REWARD,
    GOLD: GOLD_BADGE_REWARD,
    PLATINUM: PLATINUM_BADGE_REWARD
  };
  console.log('✅ [CONSTANTS] Винагороди за бейджі встановлено:', BADGE_REWARDS);

  function getRewardByBadgeType(badgeType) {
    console.log('🔍 [CONSTANTS] getRewardByBadgeType викликано для:', badgeType);
    const reward = BADGE_REWARDS[badgeType] || 0;
    console.log('💰 [CONSTANTS] Винагорода для', badgeType, ':', reward);
    return reward;
  }

  // badgeThresholds.js
  console.log('🎯 [CONSTANTS] Встановлення порогів для бейджів...');
  const BRONZE_BADGE_THRESHOLD = 25;
  const SILVER_BADGE_THRESHOLD = 50;
  const GOLD_BADGE_THRESHOLD = 100;
  const PLATINUM_BADGE_THRESHOLD = 500;

  const BADGE_THRESHOLDS = {
    BRONZE: BRONZE_BADGE_THRESHOLD,
    SILVER: SILVER_BADGE_THRESHOLD,
    GOLD: GOLD_BADGE_THRESHOLD,
    PLATINUM: PLATINUM_BADGE_THRESHOLD
  };
  console.log('✅ [CONSTANTS] Пороги бейджів встановлено:', BADGE_THRESHOLDS);

  const BADGE_TYPES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  console.log('✅ [CONSTANTS] Типи бейджів:', BADGE_TYPES);

  // directBonuses.js
  console.log('💰 [CONSTANTS] Встановлення прямого бонусу...');
  const DIRECT_BONUS_AMOUNT = 50;
  console.log('✅ [CONSTANTS] Прямий бонус встановлено:', DIRECT_BONUS_AMOUNT, 'winix');

  // rewardRates.js
  console.log('📈 [CONSTANTS] Встановлення ставок винагород...');
  const LEVEL_1_REWARD_RATE = 0.1;
  const LEVEL_2_REWARD_RATE = 0.05;
  console.log('✅ [CONSTANTS] Ставки винагород встановлено:', {
    LEVEL_1_REWARD_RATE: (LEVEL_1_REWARD_RATE * 100) + '%',
    LEVEL_2_REWARD_RATE: (LEVEL_2_REWARD_RATE * 100) + '%'
  });

  // taskThresholds.js
  console.log('📋 [CONSTANTS] Встановлення завдань та їх порогів...');
  const REFERRAL_TASK_THRESHOLD = 100;
  const REFERRAL_TASK_REWARD = 12000;
  const ACTIVE_REFERRALS_TASK_THRESHOLD = 50;
  const ACTIVE_REFERRALS_TASK_REWARD = 6000;

  const TASK_THRESHOLDS = {
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
  console.log('✅ [CONSTANTS] Завдання встановлено:', Object.keys(TASK_THRESHOLDS));
  console.log('📊 [CONSTANTS] Деталі завдань:');
  Object.keys(TASK_THRESHOLDS).forEach(function(key) {
    console.log(`  - ${key}:`, {
      threshold: TASK_THRESHOLDS[key].threshold,
      reward: TASK_THRESHOLDS[key].reward,
      title: TASK_THRESHOLDS[key].title
    });
  });

  const TASK_TYPES = Object.keys(TASK_THRESHOLDS);
  console.log('✅ [CONSTANTS] Типи завдань:', TASK_TYPES);

  // urlPatterns.js - ОНОВЛЕНО для нового формату
  console.log('🔗 [CONSTANTS] Встановлення URL шаблонів...');
  const REFERRAL_URL_PATTERN = 'https://t.me/WINIX_Official_bot?start={id}';
  console.log('✅ [CONSTANTS] Шаблон реферального URL:', REFERRAL_URL_PATTERN);

  // Базовий URL для Telegram бота
  const TELEGRAM_BOT_URL = 'https://t.me/WINIX_Official_bot';
  console.log('✅ [CONSTANTS] URL Telegram бота:', TELEGRAM_BOT_URL);

  // Фінальна статистика
  console.log('📊 [CONSTANTS] === ПІДСУМОК ЗАВАНТАЖЕНИХ КОНСТАНТ ===');
  console.log('  - Action Types:', Object.keys(LevelRewardsActionTypes).length);
  console.log('  - Активність:', { MIN_DRAWS_PARTICIPATION, MIN_INVITED_REFERRALS });
  console.log('  - Бейджі:', {
    types: BADGE_TYPES.length,
    rewards: Object.keys(BADGE_REWARDS).length,
    thresholds: Object.keys(BADGE_THRESHOLDS).length
  });
  console.log('  - Бонуси:', { DIRECT_BONUS_AMOUNT });
  console.log('  - Ставки:', { LEVEL_1_REWARD_RATE, LEVEL_2_REWARD_RATE });
  console.log('  - Завдання:', TASK_TYPES.length);
  console.log('  - URL:', { REFERRAL_URL_PATTERN, TELEGRAM_BOT_URL });

  // Публічний API
  const publicAPI = {
    LevelRewardsActionTypes: LevelRewardsActionTypes,
    MIN_DRAWS_PARTICIPATION: MIN_DRAWS_PARTICIPATION,
    MIN_INVITED_REFERRALS: MIN_INVITED_REFERRALS,
    BRONZE_BADGE_REWARD: BRONZE_BADGE_REWARD,
    SILVER_BADGE_REWARD: SILVER_BADGE_REWARD,
    GOLD_BADGE_REWARD: GOLD_BADGE_REWARD,
    PLATINUM_BADGE_REWARD: PLATINUM_BADGE_REWARD,
    BADGE_REWARDS: BADGE_REWARDS,
    getRewardByBadgeType: getRewardByBadgeType,
    BRONZE_BADGE_THRESHOLD: BRONZE_BADGE_THRESHOLD,
    SILVER_BADGE_THRESHOLD: SILVER_BADGE_THRESHOLD,
    GOLD_BADGE_THRESHOLD: GOLD_BADGE_THRESHOLD,
    PLATINUM_BADGE_THRESHOLD: PLATINUM_BADGE_THRESHOLD,
    BADGE_THRESHOLDS: BADGE_THRESHOLDS,
    BADGE_TYPES: BADGE_TYPES,
    DIRECT_BONUS_AMOUNT: DIRECT_BONUS_AMOUNT,
    LEVEL_1_REWARD_RATE: LEVEL_1_REWARD_RATE,
    LEVEL_2_REWARD_RATE: LEVEL_2_REWARD_RATE,
    REFERRAL_TASK_THRESHOLD: REFERRAL_TASK_THRESHOLD,
    REFERRAL_TASK_REWARD: REFERRAL_TASK_REWARD,
    ACTIVE_REFERRALS_TASK_THRESHOLD: ACTIVE_REFERRALS_TASK_THRESHOLD,
    ACTIVE_REFERRALS_TASK_REWARD: ACTIVE_REFERRALS_TASK_REWARD,
    TASK_THRESHOLDS: TASK_THRESHOLDS,
    TASK_TYPES: TASK_TYPES,
    REFERRAL_URL_PATTERN: REFERRAL_URL_PATTERN,
    TELEGRAM_BOT_URL: TELEGRAM_BOT_URL
  };

  console.log('✅ [CONSTANTS] Публічний API створено з', Object.keys(publicAPI).length, 'властивостями');
  console.log('✅ [CONSTANTS] ========== МОДУЛЬ ReferralConstants ЗАВАНТАЖЕНО УСПІШНО ==========');

  return publicAPI;
})();

// Для зворотної сумісності
console.log('🔄 [CONSTANTS] Встановлення глобальних змінних для зворотної сумісності...');
window.DIRECT_BONUS_AMOUNT = window.ReferralConstants.DIRECT_BONUS_AMOUNT;
window.BRONZE_BADGE_THRESHOLD = window.ReferralConstants.BRONZE_BADGE_THRESHOLD;
window.SILVER_BADGE_THRESHOLD = window.ReferralConstants.SILVER_BADGE_THRESHOLD;
window.GOLD_BADGE_THRESHOLD = window.ReferralConstants.GOLD_BADGE_THRESHOLD;
window.PLATINUM_BADGE_THRESHOLD = window.ReferralConstants.PLATINUM_BADGE_THRESHOLD;
window.BRONZE_BADGE_REWARD = window.ReferralConstants.BRONZE_BADGE_REWARD;
window.SILVER_BADGE_REWARD = window.ReferralConstants.SILVER_BADGE_REWARD;
window.GOLD_BADGE_REWARD = window.ReferralConstants.GOLD_BADGE_REWARD;
window.PLATINUM_BADGE_REWARD = window.ReferralConstants.PLATINUM_BADGE_REWARD;

console.log('✅ [CONSTANTS] Глобальні змінні встановлено:', {
  DIRECT_BONUS_AMOUNT: window.DIRECT_BONUS_AMOUNT,
  BRONZE_BADGE_THRESHOLD: window.BRONZE_BADGE_THRESHOLD,
  SILVER_BADGE_THRESHOLD: window.SILVER_BADGE_THRESHOLD,
  GOLD_BADGE_THRESHOLD: window.GOLD_BADGE_THRESHOLD,
  PLATINUM_BADGE_THRESHOLD: window.PLATINUM_BADGE_THRESHOLD,
  BRONZE_BADGE_REWARD: window.BRONZE_BADGE_REWARD,
  SILVER_BADGE_REWARD: window.SILVER_BADGE_REWARD,
  GOLD_BADGE_REWARD: window.GOLD_BADGE_REWARD,
  PLATINUM_BADGE_REWARD: window.PLATINUM_BADGE_REWARD
});

// Перевірка доступності
console.log('🔍 [CONSTANTS] Перевірка доступності window.ReferralConstants:', {
  exists: typeof window.ReferralConstants !== 'undefined',
  type: typeof window.ReferralConstants,
  properties: window.ReferralConstants ? Object.keys(window.ReferralConstants).length : 0
});