/**
 * Оновлений індексний файл модуля реферальної системи
 *
 * Експортує всі необхідні функції, константи та компоненти для зовнішнього використання.
 * Додано експорт компонентів для перевірки активності рефералів за етапом 5.
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

// НОВИЙ ЕКСПОРТ: Компоненти для перевірки активності рефералів (етап 5)
export { isActiveReferral, getDetailedActivityStatus } from './utils/isActiveReferral';
export { fetchReferralActivity, fetchReferralDetailedActivity, fetchActivitySummary } from './api/fetchReferralActivity';
export { checkReferralsActivity, checkReferralActivity, analyzeReferralsActivity } from './services/checkReferralActivity';

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

// НОВИЙ ЕКСПОРТ: Дії для роботи з активністю рефералів (етап 5)
export {
  fetchReferralActivity as fetchAndCheckReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  updateActivityStats,
  updateActivityRecommendations,
  clearReferralActivityError
} from './store/referralActivityActions';

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

// НОВИЙ ЕКСПОРТ: Редуктор і початковий стан для активності рефералів (етап 5)
export {
  referralActivityReducer,
  initialReferralActivityState,
  ReferralActivityActionTypes
} from './store/referralActivityState';

// Експортуємо константи
export { REFERRAL_URL_PATTERN } from './constants/urlPatterns';
export { DIRECT_BONUS_AMOUNT } from './constants/directBonuses';
export { LEVEL_1_REWARD_RATE, LEVEL_2_REWARD_RATE } from './constants/rewardRates';

// НОВИЙ ЕКСПОРТ: Константи порогів активності (етап 5)
export { MIN_DRAWS_PARTICIPATION, MIN_INVITED_REFERRALS } from './constants/activityThresholds';