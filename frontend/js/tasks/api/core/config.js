/**
 * Конфігурація API завдань
 *
 * Цей модуль містить всі налаштування для роботи з API завдань:
 * - Базові параметри запитів
 * - URL ендпоінтів API
 * - Налаштування кешування
 *
 * @version 3.1.0
 */

/**
 * Базова конфігурація для API запитів завдань
 */
export const CONFIG = {
  REQUEST_TIMEOUT: 15000, // 15 секунд
  MAX_VERIFICATION_ATTEMPTS: 2, // Кількість спроб
  RETRY_INTERVAL: 1000, // Інтервал між спробами
  REQUEST_CACHE_TTL: 60000, // Час життя кешу запитів (1 хвилина)
  API_PATHS: {
    // Завдання
    TASKS: {
      ALL: 'quests/tasks',
      BY_TYPE: (type) => `quests/tasks/${type}`,
      SOCIAL: 'quests/tasks/social',
      LIMITED: 'quests/tasks/limited',
      PARTNER: 'quests/tasks/partner',
      REFERRAL: 'quests/tasks/referral',
      DETAILS: (taskId) => `quests/tasks/${taskId}/details`,
      START: (taskId) => `quests/tasks/${taskId}/start`,
      VERIFICATION: (taskId) => `quests/tasks/${taskId}/verify`,
      PROGRESS: (taskId) => `quests/tasks/${taskId}/progress`,
      CANCEL: (taskId) => `quests/tasks/${taskId}/cancel`,
      CLAIM_REWARD: (taskId) => `quests/tasks/${taskId}/claim-reward`,
      FEEDBACK: (taskId) => `quests/tasks/${taskId}/feedback`,
    },
    // Прогрес користувача
    USER_PROGRESS: (userId) => `user/${userId}/progress`,
    // Статус завдання користувача
    USER_TASK_STATUS: (userId, taskId) => `user/${userId}/tasks/${taskId}/status`,
  },
};

/**
 * Версія API
 */
export const API_VERSION = '3.1.0';

/**
 * Мапа типів API помилок та їх коди
 */
export const API_ERROR_CODES = {
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout_error',
  SERVER_ERROR: 'server_error',
  AUTH_ERROR: 'authentication_error',
  VALIDATION_ERROR: 'validation_error',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit_error',
};

export default CONFIG;
