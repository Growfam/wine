/**
 * Індексний файл для компонентів щоденного бонусу
 */

export { default as DailyBonusCalendar } from 'js/tasks/ui/components/daily-bonus/calendar.js';
export { default as DailyBonusRewardPreview } from 'js/tasks/ui/components/daily-bonus/reward-preview.js';
export { default as DailyBonusDialog } from 'js/tasks/ui/components/daily-bonus/dialog.js';

// Для зручного імпорту всіх компонентів
export default {
  Calendar: require('js/tasks/ui/components/daily-bonus/calendar').default,
  RewardPreview: require('js/tasks/ui/components/daily-bonus/reward-preview').default,
  Dialog: require('js/tasks/ui/components/daily-bonus/dialog').default,
};
