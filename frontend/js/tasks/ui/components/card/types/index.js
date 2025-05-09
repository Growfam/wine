/**
 * Експорт типів карток завдань
 */

// Експортуємо модулі карток як іменовані default експорти
export { default as limitedCard } from 'js/tasks/ui/components/card/types/limited.js';
export { default as partnerCard } from 'js/tasks/ui/components/card/types/partner.js';
export { default as socialCard } from 'js/tasks/ui/components/card/types/social.js';

// Експортуємо також корисні функції з карток
export { isUrlSafe, ALLOWED_DOMAINS } from 'js/tasks/ui/components/card/types/partner.js';
export { detectNetworkType, SOCIAL_NETWORKS } from 'js/tasks/ui/components/card/types/social.js';
