/**
 * Головний файл для експорту всіх типів
 */

// Імпорт окремих типів
import { TASK_TYPES } from './task-types';
import { ACTION_TYPES } from './action-types';
import { REWARD_TYPES } from './reward-types';
import { TASK_STATUS } from './status-types';
import { VERIFICATION_STATUS } from './verification-status';
import { SOCIAL_NETWORKS } from './social-networks';
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
