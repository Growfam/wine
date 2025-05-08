/**
 * Експорт типів рендерерів завдань
 */

// Експортуємо модулі рендерерів як іменовані default експорти
export { default as limitedRenderer } from './limited.js';
export { default as partnerRenderer } from './partner.js';
export { default as socialRenderer } from './social.js';

// Експортуємо також корисні функції з рендерерів
export { getSafeUrl, validatePartnerUrl } from './partner.js';
export { getSocialIcon, SUPPORTED_NETWORKS } from './social.js';
