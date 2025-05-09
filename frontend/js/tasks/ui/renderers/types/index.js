/**
 * Експорт типів рендерерів завдань
 */

// Експортуємо модулі рендерерів як іменовані default експорти
export { default as limitedRenderer } from 'js/tasks/ui/renderers/types/limited.js';
export { default as partnerRenderer } from 'js/tasks/ui/renderers/types/partner.js';
export { default as socialRenderer } from 'js/tasks/ui/renderers/types/social.js';

// Експортуємо також корисні функції з рендерерів
export { getSafeUrl, validatePartnerUrl } from 'js/tasks/ui/renderers/types/partner.js';
export { getSocialIcon, SUPPORTED_NETWORKS } from 'js/tasks/ui/renderers/types/social.js';
