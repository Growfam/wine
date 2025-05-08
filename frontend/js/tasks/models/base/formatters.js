/**
 * Форматування даних завдань
 *
 * Функції для перетворення даних у різні формати
 */

import { TASK_TYPES, REWARD_TYPES, TASK_STATUS } from '../../config';

/**
 * Форматування в формат для API
 * @param {Object} task - Завдання
 * @returns {Object} Дані для API
 */
export function formatToApiData(task) {
  const baseData = {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    action_type: task.action_type,
    action_url: task.action_url,
    reward_type: task.reward_type,
    reward_amount: task.reward_amount,
    target_value: task.target_value,
    status: task.status,
    tags: task.tags,
  };

  // Додаткові дані в залежності від типу завдання
  switch (task.type) {
    case TASK_TYPES.LIMITED:
      return {
        ...baseData,
        start_date: task.start_date,
        end_date: task.end_date,
        max_completions: task.max_completions,
        current_completions: task.current_completions,
        priority: task.priority,
      };

    case TASK_TYPES.PARTNER:
      return {
        ...baseData,
        partner_name: task.partner_name,
        partner_logo: task.partner_logo,
        partner_url: task.partner_url,
        partner_id: task.partner_id,
        revenue_share: task.revenue_share,
        category: task.category,
        external_tracking_id: task.external_tracking_id,
        conversion_type: task.conversion_type,
      };

    case TASK_TYPES.SOCIAL:
    case TASK_TYPES.REFERRAL:
      return {
        ...baseData,
        platform: task.platform,
        channel_name: task.channel_name,
        channel_url: task.channel_url,
        platform_user_id: task.platform_user_id,
        requires_verification: task.requires_verification,
      };

    default:
      return baseData;
  }
}

/**
 * Форматування даних для відображення
 * @param {Object} task - Завдання
 * @returns {Object} Дані для відображення
 */
export function formatToDisplayData(task) {
  // Базові дані для відображення
  const baseData = {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    action_label: task.action_label,
    reward: {
      type: task.reward_type,
      amount: task.reward_amount,
      formatted: `${task.reward_amount} ${task.reward_type === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів'}`,
    },
    progress: {
      current: 0,
      target: task.target_value,
      percent: 0,
      label: task.progress_label,
    },
    status: task.status,
  };

  // Додаткові дані в залежності від типу завдання
  switch (task.type) {
    case TASK_TYPES.LIMITED:
      return formatLimitedTaskForDisplay(task, baseData);
    case TASK_TYPES.PARTNER:
      return formatPartnerTaskForDisplay(task, baseData);
    case TASK_TYPES.SOCIAL:
    case TASK_TYPES.REFERRAL:
      return formatSocialTaskForDisplay(task, baseData);
    default:
      return baseData;
  }
}

/**
 * Форматування лімітованого завдання для відображення
 * @param {Object} task - Завдання
 * @param {Object} baseData - Базові дані
 * @returns {Object} Форматовані дані
 */
function formatLimitedTaskForDisplay(task, baseData) {
  // Розраховуємо залишок часу
  let timeLeft = null;
  let timeLeftFormatted = '';

  if (task.end_date) {
    const endDate = new Date(task.end_date);
    const now = new Date();
    timeLeft = endDate - now;

    if (timeLeft > 0) {
      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

      timeLeftFormatted = days > 0 ? `${days}д ${hours}г` : `${hours}г ${minutes}хв`;
    }
  }

  return {
    ...baseData,
    start_date: task.start_date,
    end_date: task.end_date,
    timeLeft,
    timeLeftFormatted,
    isExpired: task.status === TASK_STATUS.EXPIRED,
    max_completions: task.max_completions,
    current_completions: task.current_completions,
    priority: task.priority,
  };
}

/**
 * Форматування партнерського завдання для відображення
 * @param {Object} task - Завдання
 * @param {Object} baseData - Базові дані
 * @returns {Object} Форматовані дані
 */
function formatPartnerTaskForDisplay(task, baseData) {
  return {
    ...baseData,
    partner_name: task.partner_name,
    partner_logo: task.partner_logo,
    partner_url: task.partner_url,
    category: task.category,
    conversion_type: task.conversion_type,
    isPartner: true,
  };
}

/**
 * Форматування соціального завдання для відображення
 * @param {Object} task - Завдання
 * @param {Object} baseData - Базові дані
 * @returns {Object} Форматовані дані
 */
function formatSocialTaskForDisplay(task, baseData) {
  // Додаємо іконку платформи
  let platformIcon = '';
  switch (task.platform) {
    case 'telegram':
      platformIcon = '📱';
      break;
    case 'twitter':
      platformIcon = '🐦';
      break;
    case 'discord':
      platformIcon = '💬';
      break;
    case 'facebook':
      platformIcon = '👍';
      break;
    default:
      platformIcon = '🌐';
  }

  return {
    ...baseData,
    platform: task.platform,
    platformIcon,
    channel_name: task.channel_name,
    action_type: task.action_type,
  };
}
