/**
 * Індексний файл для компонентів щоденного бонусу
 */

// Імпортуємо модулі з використанням ES import синтаксису
import DailyBonusCalendar from './calendar.js';
import DailyBonusRewardPreview from './reward-preview.js';
import DailyBonusDialog from './dialog.js';

// Експортуємо компоненти напряму
export { DailyBonusCalendar, DailyBonusRewardPreview, DailyBonusDialog };

// Створюємо об'єкт з компонентами для зручного використання
const DailyBonusComponents = {
  Calendar: DailyBonusCalendar,
  RewardPreview: DailyBonusRewardPreview,
  Dialog: DailyBonusDialog
};

// Додаємо в глобальний об'єкт
if (typeof window !== 'undefined') {
  window.WINIX = window.WINIX || {};
  window.WINIX.DailyBonus = DailyBonusComponents;
}

// Експортуємо за замовчуванням
export default DailyBonusComponents;