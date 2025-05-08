/**
 * Модель типів завдань
 *
 * Відповідає за:
 * - Визначення доступних типів завдань
 * - Зберігання характеристик типів завдань
 * - Валідацію параметрів завдань
 *
 * @version 3.1.0
 */

/**
 * Основні типи завдань
 */
export const TASK_TYPES = {
  SOCIAL: 'social',
  LIMITED: 'limited',
  PARTNER: 'partner',
  REFERRAL: 'referral',
  DAILY: 'daily',
  SPECIAL: 'special',
};

/**
 * Статуси завдань
 */
export const TASK_STATUSES = {
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  LOCKED: 'locked',
  EXPIRED: 'expired',
};

/**
 * Характеристики типів завдань
 */
export const TASK_TYPE_PROPERTIES = {
  [TASK_TYPES.SOCIAL]: {
    name: 'Соціальні завдання',
    description: "Завдання, пов'язані з соціальними мережами",
    icon: 'social',
    color: '#4267B2',
    order: 1,
    defaultReward: 10,
    allowsRepeat: true,
    requiresVerification: true,
  },
  [TASK_TYPES.LIMITED]: {
    name: 'Обмежені завдання',
    description: 'Завдання з обмеженим часом виконання',
    icon: 'timer',
    color: '#FF5722',
    order: 2,
    defaultReward: 20,
    allowsRepeat: false,
    requiresVerification: true,
  },
  [TASK_TYPES.PARTNER]: {
    name: 'Партнерські завдання',
    description: 'Завдання від партнерів проекту',
    icon: 'partners',
    color: '#4CAF50',
    order: 3,
    defaultReward: 30,
    allowsRepeat: false,
    requiresVerification: true,
  },
  [TASK_TYPES.REFERRAL]: {
    name: 'Реферальні завдання',
    description: 'Завдання за запрошення нових користувачів',
    icon: 'user-plus',
    color: '#9C27B0',
    order: 4,
    defaultReward: 25,
    allowsRepeat: true,
    requiresVerification: false,
  },
  [TASK_TYPES.DAILY]: {
    name: 'Щоденні завдання',
    description: 'Завдання, які можна виконувати щодня',
    icon: 'calendar',
    color: '#2196F3',
    order: 5,
    defaultReward: 5,
    allowsRepeat: true,
    requiresVerification: true,
    resetPeriod: 'daily',
  },
  [TASK_TYPES.SPECIAL]: {
    name: 'Спеціальні завдання',
    description: 'Особливі завдання з підвищеною винагородою',
    icon: 'star',
    color: '#FFC107',
    order: 6,
    defaultReward: 50,
    allowsRepeat: false,
    requiresVerification: true,
  },
};

/**
 * Можливі дії верифікації завдань
 */
export const VERIFICATION_ACTIONS = {
  URL_VISIT: 'url_visit',
  SOCIAL_FOLLOW: 'social_follow',
  SOCIAL_LIKE: 'social_like',
  SOCIAL_SHARE: 'social_share',
  SOCIAL_COMMENT: 'social_comment',
  CHANNEL_JOIN: 'channel_join',
  VIDEO_WATCH: 'video_watch',
  APP_INSTALL: 'app_install',
  GAME_PLAY: 'game_play',
  SURVEY_COMPLETE: 'survey_complete',
  QUIZ_COMPLETE: 'quiz_complete',
  REFERRAL_INVITE: 'referral_invite',
  CAPTCHA_SOLVE: 'captcha_solve',
  MANUAL_VERIFICATION: 'manual_verification',
};

/**
 * Параметри верифікаційних дій
 */
export const VERIFICATION_ACTION_PARAMS = {
  [VERIFICATION_ACTIONS.URL_VISIT]: {
    fields: ['url', 'visit_duration'],
    required: ['url'],
  },
  [VERIFICATION_ACTIONS.SOCIAL_FOLLOW]: {
    fields: ['platform', 'profile_id', 'profile_url', 'screenshot'],
    required: ['platform', 'profile_id'],
  },
  [VERIFICATION_ACTIONS.SOCIAL_LIKE]: {
    fields: ['platform', 'post_id', 'post_url', 'screenshot'],
    required: ['platform', 'post_id'],
  },
  [VERIFICATION_ACTIONS.SOCIAL_SHARE]: {
    fields: ['platform', 'content_id', 'content_url', 'share_id', 'screenshot'],
    required: ['platform', 'content_id'],
  },
  [VERIFICATION_ACTIONS.SOCIAL_COMMENT]: {
    fields: ['platform', 'post_id', 'post_url', 'comment_text', 'screenshot'],
    required: ['platform', 'post_id', 'comment_text'],
  },
  [VERIFICATION_ACTIONS.CHANNEL_JOIN]: {
    fields: ['platform', 'channel_id', 'channel_url', 'screenshot'],
    required: ['platform', 'channel_id'],
  },
  [VERIFICATION_ACTIONS.VIDEO_WATCH]: {
    fields: ['platform', 'video_id', 'video_url', 'watch_duration', 'screenshot'],
    required: ['platform', 'video_id', 'watch_duration'],
  },
  [VERIFICATION_ACTIONS.APP_INSTALL]: {
    fields: ['platform', 'app_id', 'app_url', 'screenshot'],
    required: ['platform', 'app_id'],
  },
  [VERIFICATION_ACTIONS.GAME_PLAY]: {
    fields: ['game_id', 'game_url', 'play_duration', 'achievement', 'screenshot'],
    required: ['game_id', 'play_duration'],
  },
  [VERIFICATION_ACTIONS.SURVEY_COMPLETE]: {
    fields: ['survey_id', 'survey_url', 'completion_code', 'screenshot'],
    required: ['survey_id', 'completion_code'],
  },
  [VERIFICATION_ACTIONS.QUIZ_COMPLETE]: {
    fields: ['quiz_id', 'quiz_url', 'score', 'answers', 'screenshot'],
    required: ['quiz_id', 'score'],
  },
  [VERIFICATION_ACTIONS.REFERRAL_INVITE]: {
    fields: ['referral_code', 'invited_user_id', 'platform'],
    required: ['referral_code', 'invited_user_id'],
  },
  [VERIFICATION_ACTIONS.CAPTCHA_SOLVE]: {
    fields: ['captcha_id', 'solution', 'challenge_type'],
    required: ['captcha_id', 'solution'],
  },
  [VERIFICATION_ACTIONS.MANUAL_VERIFICATION]: {
    fields: ['description', 'evidence', 'screenshots', 'contact_info'],
    required: ['description', 'evidence'],
  },
};

/**
 * Клас для роботи з типами завдань
 */
class TaskTypesModel {
  constructor() {
    this.types = TASK_TYPES;
    this.statuses = TASK_STATUSES;
    this.properties = TASK_TYPE_PROPERTIES;
    this.verificationActions = VERIFICATION_ACTIONS;
    this.verificationParams = VERIFICATION_ACTION_PARAMS;
  }

  /**
   * Отримання списку всіх типів завдань
   * @returns {Object[]} Список типів завдань
   */
  getAllTaskTypes() {
    return Object.entries(this.types)
      .map(([key, value]) => ({
        id: value,
        ...this.properties[value],
      }))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Отримання інформації про тип завдання
   * @param {string} typeId - ID типу завдання
   * @returns {Object|null} Інформація про тип завдання
   */
  getTaskTypeInfo(typeId) {
    if (!typeId || !this.properties[typeId]) {
      return null;
    }

    return {
      id: typeId,
      ...this.properties[typeId],
    };
  }

  /**
   * Перевірка чи тип завдання дозволяє повторне виконання
   * @param {string} typeId - ID типу завдання
   * @returns {boolean} Дозволено повторне виконання
   */
  isTaskTypeRepeatable(typeId) {
    if (!typeId || !this.properties[typeId]) {
      return false;
    }

    return this.properties[typeId].allowsRepeat || false;
  }

  /**
   * Перевірка чи тип завдання потребує верифікації
   * @param {string} typeId - ID типу завдання
   * @returns {boolean} Потрібна верифікація
   */
  isVerificationRequired(typeId) {
    if (!typeId || !this.properties[typeId]) {
      return true; // За замовчуванням вимагаємо верифікацію
    }

    return this.properties[typeId].requiresVerification || true;
  }

  /**
   * Отримання необхідних параметрів для дії верифікації
   * @param {string} actionType - Тип дії верифікації
   * @returns {string[]} Список необхідних параметрів
   */
  getRequiredVerificationParams(actionType) {
    if (!actionType || !this.verificationParams[actionType]) {
      return [];
    }

    return this.verificationParams[actionType].required || [];
  }

  /**
   * Перевірка валідності даних верифікації
   * @param {string} actionType - Тип дії верифікації
   * @param {Object} data - Дані верифікації
   * @returns {Object} Результат перевірки
   */
  validateVerificationData(actionType, data) {
    if (!actionType || !this.verificationParams[actionType]) {
      return {
        valid: false,
        missing: [],
        message: 'Невідомий тип дії верифікації',
      };
    }

    const required = this.verificationParams[actionType].required || [];
    const missing = [];

    // Перевіряємо наявність усіх необхідних полів
    for (const field of required) {
      if (!data || data[field] === undefined || data[field] === null || data[field] === '') {
        missing.push(field);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      message:
        missing.length > 0
          ? `Відсутні обов'язкові поля: ${missing.join(', ')}`
          : 'Дані верифікації валідні',
    };
  }
}

// Експортуємо єдиний екземпляр моделі
export default new TaskTypesModel();
