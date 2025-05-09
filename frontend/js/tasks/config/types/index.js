/**
 * Головний файл для експорту всіх типів
 */

// Імпорт окремих типів
import { TASK_TYPES } from 'js/tasks/config/types/task-types.js';
import { ACTION_TYPES } from 'js/tasks/config/types/action-types.js';
import { REWARD_TYPES } from 'js/tasks/config/types/reward-types.js';
import { TASK_STATUS } from 'js/tasks/config/types/status-types.js';
import { VERIFICATION_STATUS } from 'js/tasks/config/types/verification-status.js';
import { SOCIAL_NETWORKS } from 'js/tasks/config/types/social-networks.js';
import { DAILY_BONUS_TYPES } from 'js/tasks/config/types/daily-bonus-types.js';

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
