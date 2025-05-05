/**
 * Конфігурація системи завдань
 * Містить типи завдань, типи винагород та інші константи
 */

// Типи завдань
export const TASK_TYPES = {
  SOCIAL: 'social',
  LIMITED: 'limited',
  PARTNER: 'partner',
  REFERRAL: 'referral'
};

// Типи дій
export const ACTION_TYPES = {
  VISIT: 'visit',
  SUBSCRIBE: 'subscribe',
  JOIN: 'join',
  LIKE: 'like',
  SHARE: 'share',
  FOLLOW: 'follow',
  INSTALL: 'install',
  GENERIC: 'generic'
};

// Типи винагород
export const REWARD_TYPES = {
  TOKENS: 'tokens',
  COINS: 'coins'
};

// Статуси завдань
export const TASK_STATUS = {
  PENDING: 'pending',
  STARTED: 'started',
  READY_TO_VERIFY: 'ready_to_verify',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired'
};

// Соціальні мережі
export const SOCIAL_NETWORKS = {
  TELEGRAM: 'telegram',
  TWITTER: 'twitter',
  DISCORD: 'discord',
  FACEBOOK: 'facebook'
};

// Статуси верифікації
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILURE: 'failure',
  ERROR: 'error',
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout'
};

// API шляхи
export const API_PATHS = {
  TASKS: {
    SOCIAL: 'quests/tasks/social',
    LIMITED: 'quests/tasks/limited',
    PARTNER: 'quests/tasks/partner',
    REFERRAL: 'quests/tasks/referral'
  },
  VERIFICATION: 'quests/tasks/{taskId}/verify',
  START_TASK: 'quests/tasks/{taskId}/start',
  USER_PROGRESS: 'quests/user-progress/all'
};

// Загальні налаштування
export const CONFIG = {
  // Час кешування, мс
  CACHE_TTL: 60000,

  // Затримки між перевірками (мс)
  THROTTLE_DELAY: 3000,

  // Максимальна кількість спроб верифікації
  MAX_VERIFICATION_ATTEMPTS: 3,

  // Інтервал перезапитів (мс)
  RETRY_INTERVAL: 2000,

  // Таймаут запитів (мс)
  REQUEST_TIMEOUT: 15000,

  // Інтервал оновлення прогресу (мс)
  PROGRESS_UPDATE_INTERVAL: 2000,

  // Інтервал дедуплікації винагород (мс)
  REWARD_DEDUPLICATION_WINDOW: 5000,

  // Затримка анімації появи завдань (мс)
  TASK_APPEAR_DURATION: 350,

  // Затримка між появою завдань (мс)
  TASK_APPEAR_DELAY: 50
};

export default {
  TASK_TYPES,
  ACTION_TYPES,
  REWARD_TYPES,
  TASK_STATUS,
  SOCIAL_NETWORKS,
  VERIFICATION_STATUS,
  API_PATHS,
  CONFIG
};