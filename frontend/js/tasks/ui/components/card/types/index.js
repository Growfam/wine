/**
 * Експорт типів карток завдань
 */

// Експортуємо модулі карток як іменовані default експорти
export { default as limitedCard } from './limited.js';
export { default as partnerCard } from './partner.js';
export { default as socialCard } from './social.js';

// Експортуємо також корисні функції з карток
export { isUrlSafe, ALLOWED_DOMAINS } from './partner.js';
export { detectNetworkType, SOCIAL_NETWORKS } from './social.js';