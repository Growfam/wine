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

// Експортуємо дії для роботи із станом
export {
  fetchReferralLink,
  fetchReferralLinkRequest,
  fetchReferralLinkSuccess,
  fetchReferralLinkFailure,
  clearReferralLinkError
} from './store/fetchReferralLinkAction';

// Експортуємо редуктор і початковий стан для реферального посилання
export {
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes
} from './store/referralLinkState';

// Експортуємо константи
export { REFERRAL_URL_PATTERN } from './constants/urlPatterns';

/**
 * Приклад використання модуля:
 *
 * ```js
 * import { generateReferralLink } from './referral';
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
 * ```
 */