/**
 * Індексний файл для компонентів щоденного бонусу
 */

export { default as DailyBonusCalendar } from './calendar.js';
export { default as DailyBonusRewardPreview } from './reward-preview.js';
export { default as DailyBonusDialog } from './dialog.js';

// Для зручного імпорту всіх компонентів
export default {
  Calendar: require('./calendar').default,
  RewardPreview: require('./reward-preview').default,
  Dialog: require('./dialog').default,
};
