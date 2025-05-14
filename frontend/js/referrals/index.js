/**
 * Оновлений індексний файл модуля реферальної системи
 *
 * Експортує всі необхідні функції, константи та компоненти для зовнішнього використання.
 * Додано експорт компонентів для роботи з бейджами та завданнями за етапом 6.
 *
 * @module referral
 */

// Експортуємо основні компоненти системи
export { generateReferralLink } from './services/generateReferralLink';
export { formatReferralUrl } from './utils/formatReferralUrl';
export { fetchReferralLink as fetchReferralLinkFromAPI } from './api/fetchReferralLink';

// Експортуємо компоненти для прямих бонусів
export { registerReferral, checkIfReferral } from './api/registerReferral';
export { calculateDirectBonus, calculatePotentialDirectBonus } from './services/calculateDirectBonus';

// Експортуємо компоненти для рівнів рефералів
export { fetchReferralStats, fetchReferralDetails } from './api/fetchReferralStats';
export { calculateLevel1Count, analyzeLevel1Growth } from './services/calculateLevel1Count';
export { calculateLevel2Count, groupLevel2ByReferrers, analyzeLevel1Effectiveness } from './services/calculateLevel2Count';

// Експортуємо компоненти для відсоткових винагород (етап 4)
export { fetchReferralEarnings, fetchReferralDetailedEarnings } from './api/fetchReferralEarnings';
export { calculatePercentage, formatPercentageResult } from './utils/calculatePercentage';
export { calculateLevel1Reward, calculatePotentialLevel1Reward } from './services/calculateLevel1Reward';
export { calculateLevel2Reward, calculatePotentialLevel2Reward, calculateCombinedLevel2Reward } from './services/calculateLevel2Reward';

// Експортуємо компоненти для перевірки активності рефералів (етап 5)
export { isActiveReferral, getDetailedActivityStatus } from './utils/isActiveReferral';
export { fetchReferralActivity, fetchReferralDetailedActivity, fetchActivitySummary } from './api/fetchReferralActivity';
export { checkReferralsActivity, checkReferralActivity, analyzeReferralsActivity } from './services/checkReferralActivity';

// НОВИЙ ЕКСПОРТ: Компоненти для роботи з бейджами та завданнями (етап 6)
export { isEligibleForBadge, getHighestEligibleBadge, getAllEligibleBadges, getNextBadgeTarget, checkBadgesProgress } from './services/checkBadgeEligibility';
export { convertBadgeToWinix, calculateTotalBadgeReward, calculateEligibleBadgesReward, getTotalPotentialBadgeRewards } from './services/convertBadgeToWinix';
export { isTaskCompleted, calculateTaskProgress, calculateTaskReward, getCompletedTasks, calculateTotalTasksReward, checkAllTasksCompletion, checkTaskProgress } from './services/checkTaskCompletion';

// Експортуємо дії для роботи із станом реферального посилання
export {
  fetchReferralLink,
  fetchReferralLinkRequest,
  fetchReferralLinkSuccess,
  fetchReferralLinkFailure,
  clearReferralLinkError
} from './store/fetchReferralLinkAction';

// Експортуємо дії для роботи із станом прямих бонусів
export {
  registerReferralAndAwardBonus,
  fetchDirectBonusHistory,
  clearDirectBonusError
} from './store/registerReferralAction';

// Експортуємо дії для роботи із рівнями рефералів
export {
  fetchReferralLevels,
  updateReferralLevelCounts,
  clearReferralLevelsError
} from './store/updateStatsAction';

// Експортуємо дії для роботи з відсотковими винагородами (етап 4)
export {
  fetchLevelRewards,
  fetchRewardsHistory,
  updateLevel1Rewards,
  updateLevel2Rewards,
  clearLevelRewardsError
} from './store/levelRewardsActions';

// Експортуємо дії для роботи з активністю рефералів (етап 5)
export {
  fetchReferralActivity as fetchAndCheckReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  updateActivityStats,
  updateActivityRecommendations,
  clearReferralActivityError
} from './store/referralActivityActions';

// НОВИЙ ЕКСПОРТ: Дії для роботи з бейджами та завданнями (етап 6)
export {
  fetchUserBadges,
  fetchUserTasks,
  claimBadgeReward,
  claimTaskReward,
  updateBadgesProgress,
  clearBadgeError
} from './store/badgeActions';

// Експортуємо редуктор і початковий стан для реферального посилання
export {
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes
} from './store/referralLinkState';

// Експортуємо редуктор і початковий стан для прямих бонусів
export {
  directBonusReducer,
  initialDirectBonusState,
  DirectBonusActionTypes
} from './store/directBonusState';

// Експортуємо редуктор і початковий стан для рівнів рефералів
export {
  referralLevelsReducer,
  initialReferralLevelsState,
  ReferralLevelsActionTypes
} from './store/referralLevelsState';

// Експортуємо редуктор і початковий стан для відсоткових винагород (етап 4)
export {
  levelRewardsReducer,
  initialLevelRewardsState,
  LevelRewardsActionTypes
} from './store/levelRewardsState';

// Експортуємо редуктор і початковий стан для активності рефералів (етап 5)
export {
  referralActivityReducer,
  initialReferralActivityState,
  ReferralActivityActionTypes
} from './store/referralActivityState';

// НОВИЙ ЕКСПОРТ: Редуктор і початковий стан для бейджів та завдань (етап 6)
export {
  badgeReducer,
  initialBadgeState,
  BadgeActionTypes
} from './store/badgeState';

// Експортуємо константи
export { REFERRAL_URL_PATTERN } from './constants/urlPatterns';
export { DIRECT_BONUS_AMOUNT } from './constants/directBonuses';
export { LEVEL_1_REWARD_RATE, LEVEL_2_REWARD_RATE } from './constants/rewardRates';
export { MIN_DRAWS_PARTICIPATION, MIN_INVITED_REFERRALS } from './constants/activityThresholds';

// НОВИЙ ЕКСПОРТ: Константи для бейджів та завдань (етап 6)
export {
  BRONZE_BADGE_THRESHOLD,
  SILVER_BADGE_THRESHOLD,
  GOLD_BADGE_THRESHOLD,
  PLATINUM_BADGE_THRESHOLD,
  BADGE_THRESHOLDS,
  BADGE_TYPES
} from './constants/badgeThresholds';

export {
  BRONZE_BADGE_REWARD,
  SILVER_BADGE_REWARD,
  GOLD_BADGE_REWARD,
  PLATINUM_BADGE_REWARD,
  BADGE_REWARDS
} from './constants/badgeRewards';

export {
  REFERRAL_TASK_THRESHOLD,
  REFERRAL_TASK_REWARD,
  TASK_THRESHOLDS,
  TASK_TYPES
} from './constants/taskThresholds';