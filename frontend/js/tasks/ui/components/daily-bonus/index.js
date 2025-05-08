/**
 * Індексний файл для компонентів щоденного бонусу
 */

export { default as DailyBonusCalendar } from './calendar';
export { default as DailyBonusRewardPreview } from './reward-preview';
export { default as DailyBonusDialog } from './dialog';

// Для зручного імпорту всіх компонентів
export default {
  Calendar: require('./calendar').default,
  RewardPreview: require('./reward-preview').default,
  Dialog: require('./dialog').default
};