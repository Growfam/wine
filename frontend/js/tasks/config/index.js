// Правильний відносний імпорт без початкового слеша
import { TASK_TYPES } from './types/task-types.js';
import { ACTION_TYPES } from './types/action-types.js';
import { REWARD_TYPES } from './types/reward-types.js';
import { TASK_STATUS } from './types/status-types.js';
import { VERIFICATION_STATUS } from './types/verification-status.js';
import { SOCIAL_NETWORKS } from './types/social-networks.js';
import { DAILY_BONUS_TYPES } from './types/daily-bonus-types.js';
import CONFIG from '../config/settings.js';

// Реекспорт для зручного доступу
export {
  TASK_TYPES,
  ACTION_TYPES,
  REWARD_TYPES,
  TASK_STATUS,
  VERIFICATION_STATUS,
  SOCIAL_NETWORKS,
  DAILY_BONUS_TYPES,
  CONFIG
};

// Для зворотної сумісності
export default {
  TASK_TYPES,
  ACTION_TYPES,
  REWARD_TYPES,
  TASK_STATUS,
  VERIFICATION_STATUS,
  SOCIAL_NETWORKS,
  DAILY_BONUS_TYPES,
  CONFIG
};