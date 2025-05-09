/**
 * Головний файл для експорту конфігурацій
 *
 * Експортує всі типи та константи для використання в інших модулях
 */

// Імпорт усіх типів
import * as types from './types/index.js';
import CONFIG from './settings.js';

// Реекспорт типів для зручності
export const TASK_TYPES = types.TASK_TYPES;
export const ACTION_TYPES = types.ACTION_TYPES;
export const REWARD_TYPES = types.REWARD_TYPES;
export const TASK_STATUS = types.TASK_STATUS;
export const VERIFICATION_STATUS = types.VERIFICATION_STATUS;
export const SOCIAL_NETWORKS = types.SOCIAL_NETWORKS;
export const DAILY_BONUS_TYPES = types.DAILY_BONUS_TYPES;
export { CONFIG };

// Для зворотної сумісності - єдиний об'єкт
export default {
  TASK_TYPES,
  ACTION_TYPES,
  REWARD_TYPES,
  TASK_STATUS,
  VERIFICATION_STATUS,
  SOCIAL_NETWORKS,
  DAILY_BONUS_TYPES,
  CONFIG,
};
