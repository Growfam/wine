/**
 * Головний файл для експорту всіх типів
 */

// Імпорт окремих типів
import { TASK_TYPES } from './task-types.js';
import { ACTION_TYPES } from './action-types.js';
import { REWARD_TYPES } from './reward-types.js';
import { TASK_STATUS } from './status-types.js';
import { VERIFICATION_STATUS } from './verification-status.js';
import { SOCIAL_NETWORKS } from './social-networks.js';
import { DAILY_BONUS_TYPES } from './daily-bonus-types.js';

// Реекспорт типів
export {
  TASK_TYPES,
  ACTION_TYPES,
  REWARD_TYPES,
  TASK_STATUS,
  VERIFICATION_STATUS,
  SOCIAL_NETWORKS,
  DAILY_BONUS_TYPES, // Додати цей експорт
};
