/**
 * Головна точка входу модуля реферальної системи
 *
 * Експортує всі необхідні функції, константи та компоненти для зовнішнього використання.
 * Інтегрує всі компоненти системи в єдиний інтерфейс.
 *
 * @module referral
 */

// Експортуємо основні компоненти системи
export { generateReferralLink } from './services/generateReferralLink.js';
export { formatReferralUrl } from './utils/formatReferralUrl.js';
export { fetchReferralLink as fetchReferralLinkFromAPI } from './api/fetchReferralLink.js';

// Експортуємо компоненти для прямих бонусів
export { registerReferral, checkIfReferral } from './api/registerReferral.js';
export { calculateDirectBonus, calculatePotentialDirectBonus } from './services/calculateDirectBonus.js';

// Експортуємо компоненти для рівнів рефералів
export { fetchReferralStats, fetchReferralDetails } from './api/fetchReferralStats.js';
export { calculateLevel1Count, analyzeLevel1Growth } from './services/calculateLevel1Count.js';
export { calculateLevel2Count, groupLevel2ByReferrers, analyzeLevel1Effectiveness } from './services/calculateLevel2Count.js';

// Експортуємо компоненти для відсоткових винагород (етап 4)
export { fetchReferralEarnings, fetchReferralDetailedEarnings } from './api/fetchReferralEarnings.js';
export { calculatePercentage, formatPercentageResult } from './utils/calculatePercentage.js';
export { calculateLevel1Reward, calculatePotentialLevel1Reward } from './services/calculateLevel1Reward.js';
export { calculateLevel2Reward, calculatePotentialLevel2Reward, calculateCombinedLevel2Reward } from './services/calculateLevel2Reward.js';

// Експортуємо компоненти для перевірки активності рефералів (етап 5)
export { isActiveReferral, getDetailedActivityStatus } from './utils/isActiveReferral.js';
export { fetchReferralActivity, fetchReferralDetailedActivity, fetchActivitySummary } from './api/fetchReferralActivity.js';
export { checkReferralsActivity, checkReferralActivity, analyzeReferralsActivity } from './services/checkReferralActivity.js';

// Експортуємо компоненти для роботи з бейджами та завданнями (етап 6)
export { isEligibleForBadge, getHighestEligibleBadge, getAllEligibleBadges, getNextBadgeTarget, checkBadgesProgress } from './services/checkBadgeEligibility.js';
export { convertBadgeToWinix, calculateTotalBadgeReward, calculateEligibleBadgesReward, getTotalPotentialBadgeRewards } from './services/convertBadgeToWinix.js';
export { isTaskCompleted, calculateTaskProgress, calculateTaskReward, getCompletedTasks, calculateTotalTasksReward, checkAllTasksCompletion, checkTaskProgress } from './services/checkTaskCompletion.js';

// Експортуємо компоненти для аналітики та рейтингу (етап 7)
export { sortReferralsByEarnings, sortByPercentageRewards, sortByInvitedCount, sortByDrawsParticipation, sortByActivity, filterAndSortReferrals } from './utils/sortReferralsByEarnings.js';
export { formatWinixAmount, abbreviateWinixAmount, formatWinixWithTrend, formatWinixCompact, normalizeWinixAmount } from './utils/formatWinixAmount.js';
export { getReferralRanking, getTopReferrals, findUserRankPosition, generateLeaderboard } from './services/getReferralRanking.js';
export { calculateTotalEarnedForUser, predictEarningsForReferral, classifyReferralsByEarnings, analyzeEarningsStructure } from './services/calculateTotalEarnedForUser.js';
export { fetchReferralDraws, fetchDrawDetails, fetchDrawsParticipationStats, fetchTotalDrawsCount, fetchMostActiveInDraws } from './api/fetchReferralDraws.js';
export { checkDrawsParticipationCriteria, analyzeDrawsParticipation, getDrawsParticipationRecommendations, getReferralsByDrawsRanking, getDrawsParticipationSummary } from './services/trackDrawParticipation.js';

// Експортуємо компоненти для підсумкового розрахунку (етап 8)
export { fetchReferralHistory, fetchReferralEventHistory, fetchReferralActivitySummary, fetchReferralActivityTrend } from './api/fetchReferralHistory.js';
export { calculateTotalEarnings, predictFutureEarnings, calculateReferralROI, analyzeEarningsDistribution } from './services/calculateTotalEarnings.js';

// Експортуємо дії для роботи із станом реферального посилання
export {
  fetchReferralLink,
  fetchReferralLinkRequest,
  fetchReferralLinkSuccess,
  fetchReferralLinkFailure,
  clearReferralLinkError
} from './store/fetchReferralLinkAction.js';

// Експортуємо дії для роботи із станом прямих бонусів
export {
  registerReferralAndAwardBonus,
  fetchDirectBonusHistory,
  clearDirectBonusError
} from './store/registerReferralAction.js';

// Експортуємо дії для роботи із рівнями рефералів
export {
  fetchReferralLevels,
  updateReferralLevelCounts,
  clearReferralLevelsError
} from './store/updateStatsAction.js';

// Експортуємо дії для роботи з відсотковими винагородами (етап 4)
// Імпортуємо і відразу експортуємо
import {
  fetchLevelRewards,
  fetchRewardsHistory,
  updateLevel1Rewards,
  updateLevel2Rewards,
  clearLevelRewardsError
} from './store/levelRewardsActions.js';

export {
  fetchLevelRewards,
  fetchRewardsHistory,
  updateLevel1Rewards,
  updateLevel2Rewards,
  clearLevelRewardsError
};

// Експортуємо дії для роботи з активністю рефералів (етап 5)
export {
  fetchReferralActivity as fetchAndCheckReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  updateActivityStats,
  updateActivityRecommendations,
  clearReferralActivityError
} from './store/referralActivityActions.js';

// Експортуємо дії для роботи з бейджами та завданнями (етап 6)
export {
  fetchUserBadges,
  fetchUserTasks,
  claimBadgeReward,
  claimTaskReward,
  updateBadgesProgress,
  clearBadgeError
} from './store/badgeActions.js';

// Експортуємо дії для роботи з участю в розіграшах (етап 7)
export {
  fetchReferralDrawsAction,
  fetchDrawsStatsAction,
  fetchDrawsRankingAction,
  analyzeDrawsParticipationAction,
  clearDrawParticipationError
} from './store/drawParticipationState.js';

// Експортуємо дії для комплексного розрахунку винагород (етап 8)
export {
  calculateTotalRewardsAction,
  predictFutureRewardsAction,
  calculateROIAction,
  analyzeRewardsDistributionAction,
  comprehensiveRewardsAnalysisAction,
  clearRewardsCalculationError
} from './store/calculateRewardsAction.js';

// Експортуємо редуктор і початковий стан для реферального посилання
export {
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes
} from './store/referralLinkState.js';

// Експортуємо редуктор і початковий стан для прямих бонусів
export {
  directBonusReducer,
  initialDirectBonusState,
  DirectBonusActionTypes
} from './store/directBonusState.js';

// Експортуємо редуктор і початковий стан для рівнів рефералів
export {
  referralLevelsReducer,
  initialReferralLevelsState,
  ReferralLevelsActionTypes
} from './store/referralLevelsState.js';

// Експортуємо редуктор і початковий стан для відсоткових винагород (етап 4)
export {
  levelRewardsReducer,
  initialLevelRewardsState,
  LevelRewardsActionTypes
} from './store/levelRewardsState.js';

// Експортуємо редуктор і початковий стан для активності рефералів (етап 5)
export {
  referralActivityReducer,
  initialReferralActivityState,
  ReferralActivityActionTypes
} from './store/referralActivityState.js';

// Експортуємо редуктор і початковий стан для бейджів та завдань (етап 6)
export {
  badgeReducer,
  initialBadgeState,
  BadgeActionTypes
} from './store/badgeState.js';

// Експортуємо редуктор і початковий стан для участі в розіграшах (етап 7)
export {
  drawParticipationReducer,
  initialDrawParticipationState,
  DrawParticipationActionTypes
} from './store/drawParticipationState.js';

// Експортуємо редуктор і початковий стан для комплексного розрахунку винагород (етап 8)
export {
  calculateRewardsReducer,
  initialCalculateRewardsState,
  CalculateRewardsActionTypes
} from './store/calculateRewardsAction.js';

// Експортуємо константи
export { REFERRAL_URL_PATTERN } from './constants/urlPatterns.js';
export { DIRECT_BONUS_AMOUNT } from './constants/directBonuses.js';
export { LEVEL_1_REWARD_RATE, LEVEL_2_REWARD_RATE } from './constants/rewardRates.js';
export { MIN_DRAWS_PARTICIPATION, MIN_INVITED_REFERRALS } from './constants/activityThresholds.js';

// Експортуємо константи для бейджів та завдань (етап 6)
export {
  BRONZE_BADGE_THRESHOLD,
  SILVER_BADGE_THRESHOLD,
  GOLD_BADGE_THRESHOLD,
  PLATINUM_BADGE_THRESHOLD,
  BADGE_THRESHOLDS,
  BADGE_TYPES
} from './constants/badgeThresholds.js';

export {
  BRONZE_BADGE_REWARD,
  SILVER_BADGE_REWARD,
  GOLD_BADGE_REWARD,
  PLATINUM_BADGE_REWARD,
  BADGE_REWARDS
} from './constants/badgeRewards.js';

export {
  REFERRAL_TASK_THRESHOLD,
  REFERRAL_TASK_REWARD,
  TASK_THRESHOLDS,
  TASK_TYPES
} from './constants/taskThresholds.js';

// Експортуємо утилітарні функції
export {
  combineReducers,
  configureReferralStore
} from './utils/storeUtils.js';

/**
 * Інтегратор реферальної системи
 * Ініціалізує всі компоненти системи та створює єдину точку входу
 *
 * @returns {Object} Інтегрований API реферальної системи
 */
export const initReferralSystem = () => {
  // Створюємо сховище для стану реферальної системи
  const referralStore = configureReferralStore({
    referralLink: referralLinkReducer,
    directBonus: directBonusReducer,
    referralLevels: referralLevelsReducer,
    levelRewards: levelRewardsReducer,
    referralActivity: referralActivityReducer,
    badges: badgeReducer,
    drawParticipation: drawParticipationReducer,
    rewardsCalculation: calculateRewardsReducer
  });

  // Повертаємо API для використання в додатку
  return {
    // Функції для роботи з реферальним посиланням
    getReferralLink: (userId) => referralStore.dispatch(fetchReferralLink(userId)),

    // Функції для роботи з прямими бонусами
    registerReferral: (referrerId, userId) => referralStore.dispatch(registerReferralAndAwardBonus(referrerId, userId)),
    getDirectBonusHistory: (userId) => referralStore.dispatch(fetchDirectBonusHistory(userId)),

    // Функції для роботи з рівнями рефералів
    getReferralStats: (userId) => referralStore.dispatch(fetchReferralLevels(userId)),

    // Функції для роботи з відсотковими винагородами
    getLevelRewards: (userId) => referralStore.dispatch(fetchLevelRewards(userId)),

    // Функції для роботи з активністю рефералів
    checkReferralActivity: (userId) => referralStore.dispatch(fetchAndCheckReferralActivity(userId)),
    analyzeReferralActivity: (userId) => referralStore.dispatch(checkReferralsActivityWithAnalysis(userId)),

    // Функції для роботи з бейджами та завданнями
    getUserBadges: (userId) => referralStore.dispatch(fetchUserBadges(userId)),
    getUserTasks: (userId) => referralStore.dispatch(fetchUserTasks(userId)),
    claimBadge: (userId, badgeType) => referralStore.dispatch(claimBadgeReward(userId, badgeType)),
    claimTask: (userId, taskType) => referralStore.dispatch(claimTaskReward(userId, taskType)),

    // Функції для роботи з розіграшами
    getReferralDraws: (referralId) => referralStore.dispatch(fetchReferralDrawsAction(referralId)),
    getDrawsRanking: (userId) => referralStore.dispatch(fetchDrawsRankingAction(userId)),

    // Функції для комплексного розрахунку
    calculateTotalRewards: (userId) => referralStore.dispatch(calculateTotalRewardsAction(userId)),
    analyzeRewards: (userId) => referralStore.dispatch(comprehensiveRewardsAnalysisAction(userId)),

    // Доступ до сховища
    getState: () => referralStore.getState(),
    subscribe: (listener) => referralStore.subscribe(listener),
    dispatch: (action) => referralStore.dispatch(action)
  };
};

/**
 * Готовий до використання екземпляр реферальної системи
 */
export const WinixReferralSystem = initReferralSystem();

// За замовчуванням експортуємо повністю інтегровану систему
export default WinixReferralSystem;