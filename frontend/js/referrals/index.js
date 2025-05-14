/**
 * Головна точка входу в модуль реферальної системи
 *
 * Експортує всі необхідні функції, константи та компоненти для зовнішнього використання.
 * Забезпечує зручний інтерфейс для інтеграції з іншими частинами додатка.
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

// Експортуємо константи
export { REFERRAL_URL_PATTERN } from './constants/urlPatterns';
export { DIRECT_BONUS_AMOUNT } from './constants/directBonuses';

/**
 * Приклад використання модуля:
 *
 * ```js
 * import {
 *   generateReferralLink,
 *   registerReferralAndAwardBonus,
 *   fetchReferralLevels
 * } from './referral';
 *
 * // Отримання реферального посилання
 * const getReferralLink = async (userId) => {
 *   try {
 *     const link = await generateReferralLink(userId);
 *     console.log('Ваше реферальне посилання:', link);
 *     return link;
 *   } catch (error) {
 *     console.error('Помилка при отриманні реферального посилання:', error);
 *   }
 * };
 *
 * // Реєстрація нового реферала і нарахування бонусу
 * const registerNewReferral = async (referrerId, userId) => {
 *   try {
 *     const result = await registerReferralAndAwardBonus(referrerId, userId);
 *     console.log(`Бонус ${result.bonusAmount} winix нараховано!`);
 *     return result;
 *   } catch (error) {
 *     console.error('Помилка при реєстрації реферала:', error);
 *   }
 * };
 *
 * // Отримання статистики рефералів
 * const getReferralStats = async (userId) => {
 *   try {
 *     const stats = await fetchReferralLevels(userId);
 *     console.log(`Рефералів 1-го рівня: ${stats.level1Count}`);
 *     console.log(`Рефералів 2-го рівня: ${stats.level2Count}`);
 *     return stats;
 *   } catch (error) {
 *     console.error('Помилка при отриманні статистики рефералів:', error);
 *   }
 * };
 * ```
 */