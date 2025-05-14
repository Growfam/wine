/**
 * Утиліта перевірки активності реферала
 *
 * Визначає, чи є реферал активним, відповідно до встановлених критеріїв.
 * Реферал вважається активним, якщо він відповідає хоча б одному з критеріїв:
 * 1. Брав участь щонайменше в MIN_DRAWS_PARTICIPATION розіграшах
 * 2. Запросив щонайменше MIN_INVITED_REFERRALS нових користувачів
 *
 * @module isActiveReferral
 */

import { MIN_DRAWS_PARTICIPATION, MIN_INVITED_REFERRALS } from '../constants/activityThresholds';

/**
 * Перевіряє, чи є реферал активним на основі встановлених критеріїв
 * @param {Object} referralData - Дані про активність реферала
 * @param {number} [referralData.drawsParticipation=0] - Кількість участей в розіграшах
 * @param {number} [referralData.invitedReferrals=0] - Кількість запрошених рефералів
 * @param {boolean} [referralData.manuallyActivated=false] - Чи активований реферал вручну адміністратором
 * @param {Object} [options] - Додаткові опції для перевірки
 * @param {number} [options.drawsThreshold] - Користувацький поріг для кількості розіграшів
 * @param {number} [options.invitedThreshold] - Користувацький поріг для кількості запрошених
 * @param {boolean} [options.requireAllCriteria=false] - Чи повинні виконуватись всі критерії (за замовчуванням - хоча б один)
 * @returns {boolean} Чи є реферал активним
 */
export const isActiveReferral = (referralData, options = {}) => {
  // Перевірка вхідних даних
  if (!referralData) {
    return false;
  }

  // Встановлення значень за замовчуванням для даних реферала
  const {
    drawsParticipation = 0,
    invitedReferrals = 0,
    manuallyActivated = false
  } = referralData;

  // Встановлення користувацьких порогів або використання стандартних
  const {
    drawsThreshold = MIN_DRAWS_PARTICIPATION,
    invitedThreshold = MIN_INVITED_REFERRALS,
    requireAllCriteria = false
  } = options;

  // Якщо реферал був активований вручну адміністратором
  if (manuallyActivated) {
    return true;
  }

  // Перевірка критеріїв активності
  const meetsDrawsCriteria = drawsParticipation >= drawsThreshold;
  const meetsInvitedCriteria = invitedReferrals >= invitedThreshold;

  // Перевірка відповідно до вказаного режиму (всі критерії чи хоча б один)
  if (requireAllCriteria) {
    // Повинні виконуватись всі критерії
    return meetsDrawsCriteria && meetsInvitedCriteria;
  } else {
    // Достатньо виконання хоча б одного критерію
    return meetsDrawsCriteria || meetsInvitedCriteria;
  }
};

/**
 * Перевіряє, чи є реферал активним з детальним розбором критеріїв
 * @param {Object} referralData - Дані про активність реферала
 * @param {Object} [options] - Додаткові опції для перевірки
 * @returns {Object} Об'єкт з детальною інформацією про статус активності
 */
export const getDetailedActivityStatus = (referralData, options = {}) => {
  // Перевірка вхідних даних
  if (!referralData) {
    return {
      isActive: false,
      drawsParticipation: 0,
      invitedReferrals: 0,
      meetsDrawsCriteria: false,
      meetsInvitedCriteria: false,
      manuallyActivated: false,
      reasonForActivity: null
    };
  }

  // Встановлення значень за замовчуванням для даних реферала
  const {
    drawsParticipation = 0,
    invitedReferrals = 0,
    manuallyActivated = false
  } = referralData;

  // Встановлення користувацьких порогів або використання стандартних
  const {
    drawsThreshold = MIN_DRAWS_PARTICIPATION,
    invitedThreshold = MIN_INVITED_REFERRALS
  } = options;

  // Перевірка критеріїв активності
  const meetsDrawsCriteria = drawsParticipation >= drawsThreshold;
  const meetsInvitedCriteria = invitedReferrals >= invitedThreshold;

  // Визначення причини активності
  let reasonForActivity = null;

  if (manuallyActivated) {
    reasonForActivity = 'manual_activation';
  } else if (meetsDrawsCriteria && meetsInvitedCriteria) {
    reasonForActivity = 'both_criteria';
  } else if (meetsDrawsCriteria) {
    reasonForActivity = 'draws_criteria';
  } else if (meetsInvitedCriteria) {
    reasonForActivity = 'invited_criteria';
  }

  // Визначення загального статусу активності
  const isActive = manuallyActivated || meetsDrawsCriteria || meetsInvitedCriteria;

  // Повертаємо детальний результат
  return {
    isActive,
    drawsParticipation,
    invitedReferrals,
    requiredDraws: drawsThreshold,
    requiredInvited: invitedThreshold,
    meetsDrawsCriteria,
    meetsInvitedCriteria,
    manuallyActivated,
    reasonForActivity
  };
};

export default isActiveReferral;