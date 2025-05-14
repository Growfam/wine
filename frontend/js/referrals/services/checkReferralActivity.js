/**
 * Сервіс перевірки активності рефералів
 *
 * Відповідає за логіку визначення статусу активності рефералів
 * на основі даних про їхню участь у розіграшах та запрошених ними нових користувачів.
 *
 * @module checkReferralActivity
 */

import { isActiveReferral, getDetailedActivityStatus } from '../utils/isActiveReferral';
import { fetchReferralActivity, fetchReferralDetailedActivity } from '../api/fetchReferralActivity';
import { MIN_DRAWS_PARTICIPATION, MIN_INVITED_REFERRALS } from '../constants/activityThresholds';

/**
 * Перевіряє активність рефералів користувача
 * @param {string|number} userId - ID користувача, чиїх рефералів потрібно перевірити
 * @param {Object} [options] - Додаткові опції для перевірки
 * @param {number} [options.level] - Рівень рефералів для перевірки (1, 2 або всі)
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки активності
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки активності
 * @param {boolean} [options.includeDetails=false] - Чи включати детальну інформацію про активність
 * @returns {Promise<Object>} Результат перевірки активності рефералів
 * @throws {Error} Помилка при перевірці активності
 */
export const checkReferralsActivity = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для перевірки активності рефералів');
  }

  try {
    // Отримуємо дані про активність рефералів
    const activityData = await fetchReferralActivity(userId, options);

    // Визначаємо, які рівні рефералів потрібно перевірити
    const { level, includeDetails = false } = options;

    // Підготовлюємо результати
    const result = {
      userId,
      timestamp: activityData.timestamp,
      level1: { total: 0, active: 0, inactive: 0, referrals: [] },
      level2: { total: 0, active: 0, inactive: 0, referrals: [] },
      summary: { total: 0, active: 0, inactive: 0, conversionRate: 0 }
    };

    // Обробляємо дані про рефералів 1-го рівня, якщо потрібно
    if (!level || level === 1) {
      processReferralsActivityData(activityData.level1Activity, result.level1, includeDetails);
    }

    // Обробляємо дані про рефералів 2-го рівня, якщо потрібно
    if (!level || level === 2) {
      processReferralsActivityData(activityData.level2Activity, result.level2, includeDetails);
    }

    // Розраховуємо загальну статистику
    result.summary.total = result.level1.total + result.level2.total;
    result.summary.active = result.level1.active + result.level2.active;
    result.summary.inactive = result.level1.inactive + result.level2.inactive;
    result.summary.conversionRate = result.summary.total > 0
      ? result.summary.active / result.summary.total
      : 0;

    return result;
  } catch (error) {
    console.error('Помилка перевірки активності рефералів:', error);
    throw new Error(`Не вдалося перевірити активність рефералів: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Обробляє дані про активність групи рефералів
 * @param {Array<Object>} referrals - Масив даних про активність рефералів
 * @param {Object} resultContainer - Об'єкт для зберігання результатів
 * @param {boolean} includeDetails - Чи включати детальну інформацію
 * @private
 */
function processReferralsActivityData(referrals, resultContainer, includeDetails) {
  // Встановлюємо загальну кількість рефералів
  resultContainer.total = referrals.length;

  // Рахуємо активних і неактивних рефералів
  resultContainer.active = referrals.filter(ref => ref.isActive).length;
  resultContainer.inactive = resultContainer.total - resultContainer.active;

  // Якщо потрібно включити деталі, формуємо масив з даними про кожного реферала
  if (includeDetails) {
    resultContainer.referrals = referrals.map(ref => ({
      id: ref.id,
      isActive: ref.isActive,
      drawsParticipation: ref.drawsParticipation,
      invitedReferrals: ref.invitedReferrals,
      lastActivityDate: ref.lastActivityDate,
      reasonForActivity: ref.reasonForActivity
    }));
  }
}

/**
 * Перевіряє активність конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @param {Object} [options] - Додаткові опції для перевірки
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки активності
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки активності
 * @param {number} [options.drawsThreshold] - Користувацький поріг для кількості розіграшів
 * @param {number} [options.invitedThreshold] - Користувацький поріг для кількості запрошених
 * @returns {Promise<Object>} Детальний результат перевірки активності
 * @throws {Error} Помилка при перевірці активності
 */
export const checkReferralActivity = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для перевірки активності');
  }

  try {
    // Отримуємо детальні дані про активність реферала
    const detailedData = await fetchReferralDetailedActivity(referralId, options);

    // Встановлюємо користувацькі пороги або використовуємо стандартні
    const {
      drawsThreshold = MIN_DRAWS_PARTICIPATION,
      invitedThreshold = MIN_INVITED_REFERRALS
    } = options;

    // Отримуємо детальний статус активності
    const activityStatus = getDetailedActivityStatus(detailedData, {
      drawsThreshold,
      invitedThreshold
    });

    // Формуємо результат з усіма необхідними даними
    return {
      id: referralId,
      timestamp: detailedData.timestamp,
      isActive: activityStatus.isActive,
      activityDetails: {
        drawsParticipation: detailedData.drawsParticipation,
        invitedReferrals: detailedData.invitedReferrals,
        requiredDraws: drawsThreshold,
        requiredInvited: invitedThreshold,
        meetsDrawsCriteria: activityStatus.meetsDrawsCriteria,
        meetsInvitedCriteria: activityStatus.meetsInvitedCriteria,
        lastActivityDate: detailedData.lastActivityDate,
        manuallyActivated: detailedData.manuallyActivated,
        reasonForActivity: activityStatus.reasonForActivity
      },
      drawsHistory: detailedData.drawsHistory || [],
      invitedReferralsList: detailedData.invitedReferralsList || [],
      manualActivationInfo: detailedData.manualActivationInfo
    };
  } catch (error) {
    console.error('Помилка перевірки активності реферала:', error);
    throw new Error(`Не вдалося перевірити активність реферала: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Аналізує активність рефералів та надає рекомендації щодо підвищення активності
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Результат аналізу з рекомендаціями
 * @throws {Error} Помилка при аналізі активності
 */
export const analyzeReferralsActivity = async (userId) => {
  try {
    // Отримуємо дані про активність рефералів
    const activityData = await checkReferralsActivity(userId, { includeDetails: true });

    // Аналізуємо дані про рефералів 1-го рівня
    const level1Analysis = analyzeReferralsGroup(activityData.level1.referrals);

    // Аналізуємо дані про рефералів 2-го рівня
    const level2Analysis = analyzeReferralsGroup(activityData.level2.referrals);

    // Генеруємо рекомендації на основі аналізу
    const recommendations = generateRecommendations(level1Analysis, level2Analysis);

    // Формуємо результат
    return {
      userId,
      timestamp: activityData.timestamp,
      conversionRate: activityData.summary.conversionRate,
      level1Analysis,
      level2Analysis,
      recommendations
    };
  } catch (error) {
    console.error('Помилка аналізу активності рефералів:', error);
    throw new Error(`Не вдалося проаналізувати активність рефералів: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Аналізує групу рефералів та визначає їхні характеристики
 * @param {Array<Object>} referrals - Масив рефералів
 * @returns {Object} Результат аналізу групи
 * @private
 */
function analyzeReferralsGroup(referrals) {
  // Підраховуємо кількість рефералів у групі
  const totalCount = referrals.length;

  // Фільтруємо активних рефералів
  const activeReferrals = referrals.filter(ref => ref.isActive);
  const activeCount = activeReferrals.length;

  // Рахуємо рефералів за критеріями активності
  const meetingDrawsCriteria = referrals.filter(ref =>
    ref.drawsParticipation >= MIN_DRAWS_PARTICIPATION
  ).length;

  const meetingInvitedCriteria = referrals.filter(ref =>
    ref.invitedReferrals >= MIN_INVITED_REFERRALS
  ).length;

  const meetingBothCriteria = referrals.filter(ref =>
    ref.drawsParticipation >= MIN_DRAWS_PARTICIPATION &&
    ref.invitedReferrals >= MIN_INVITED_REFERRALS
  ).length;

  const manuallyActivated = referrals.filter(ref =>
    ref.reasonForActivity === 'manual_activation'
  ).length;

  // Рахуємо рефералів, близьких до виконання критеріїв
  const closeToDrawsCriteria = referrals.filter(ref =>
    ref.drawsParticipation === MIN_DRAWS_PARTICIPATION - 1
  ).length;

  const closeToInvitedCriteria = referrals.filter(ref =>
    ref.invitedReferrals === MIN_INVITED_REFERRALS - 1 &&
    ref.invitedReferrals > 0
  ).length;

  // Розрахунок конверсії
  const conversionRate = totalCount > 0 ? activeCount / totalCount : 0;

  // Визначаємо розподіл причин активності
  const activityReasons = {
    drawsCriteria: referrals.filter(ref => ref.reasonForActivity === 'draws_criteria').length,
    invitedCriteria: referrals.filter(ref => ref.reasonForActivity === 'invited_criteria').length,
    bothCriteria: referrals.filter(ref => ref.reasonForActivity === 'both_criteria').length,
    manualActivation: manuallyActivated
  };

  // Визначаємо домінуючий критерій активності
  let dominantCriteria = null;
  if (activityReasons.drawsCriteria > activityReasons.invitedCriteria) {
    dominantCriteria = 'draws';
  } else if (activityReasons.invitedCriteria > activityReasons.drawsCriteria) {
    dominantCriteria = 'invited';
  } else {
    dominantCriteria = 'equal';
  }

  return {
    totalCount,
    activeCount,
    inactiveCount: totalCount - activeCount,
    conversionRate,
    criteriaDistribution: {
      meetingDrawsCriteria,
      meetingInvitedCriteria,
      meetingBothCriteria,
      manuallyActivated
    },
    potentialActivation: {
      closeToDrawsCriteria,
      closeToInvitedCriteria
    },
    activityReasons,
    dominantCriteria
  };
}

/**
 * Генерує рекомендації на основі аналізу активності
 * @param {Object} level1Analysis - Аналіз рефералів 1-го рівня
 * @param {Object} level2Analysis - Аналіз рефералів 2-го рівня
 * @returns {Array<Object>} Масив рекомендацій
 * @private
 */
function generateRecommendations(level1Analysis, level2Analysis) {
  const recommendations = [];

  // Визначаємо загальну конверсію
  const totalReferrals = level1Analysis.totalCount + level2Analysis.totalCount;
  const totalActive = level1Analysis.activeCount + level2Analysis.activeCount;
  const overallConversion = totalReferrals > 0 ? totalActive / totalReferrals : 0;

  // Визначаємо загальні потенційні активації
  const potentialDrawsActivations = level1Analysis.potentialActivation.closeToDrawsCriteria +
                                   level2Analysis.potentialActivation.closeToDrawsCriteria;

  const potentialInvitedActivations = level1Analysis.potentialActivation.closeToInvitedCriteria +
                                     level2Analysis.potentialActivation.closeToInvitedCriteria;

  // Додаємо рекомендації на основі аналізу

  // Рекомендація 1: Низька конверсія
  if (overallConversion < 0.5) {
    recommendations.push({
      id: 'low_conversion',
      priority: 'high',
      title: 'Низька конверсія рефералів',
      description: `Загальний показник активності рефералів становить лише ${(overallConversion * 100).toFixed(1)}%. Рекомендуємо провести кампанію для активації існуючих рефералів.`
    });
  }

  // Рекомендація 2: Потенційні активації через розіграші
  if (potentialDrawsActivations > 0) {
    recommendations.push({
      id: 'potential_draws_activation',
      priority: 'medium',
      title: 'Потенційні активації через розіграші',
      description: `${potentialDrawsActivations} ${pluralizeReferral(potentialDrawsActivations)} потребують ще 1 розіграш для активації. Запропонуйте їм взяти участь у наступному розіграші.`
    });
  }

  // Рекомендація 3: Потенційні активації через запрошення
  if (potentialInvitedActivations > 0) {
    recommendations.push({
      id: 'potential_invited_activation',
      priority: 'medium',
      title: 'Потенційні активації через запрошення',
      description: `${potentialInvitedActivations} ${pluralizeReferral(potentialInvitedActivations)} потребують запросити ще 1 нового користувача для активації. Запропонуйте їм додаткові бонуси за запрошення.`
    });
  }

  // Рекомендація 4: Домінуючий критерій для рефералів 1-го рівня
  if (level1Analysis.totalCount > 0) {
    if (level1Analysis.dominantCriteria === 'draws') {
      recommendations.push({
        id: 'level1_draws_dominant',
        priority: 'low',
        title: 'Активність через розіграші для рефералів 1-го рівня',
        description: 'Реферали 1-го рівня активніше беруть участь у розіграшах. Сфокусуйте заохочення на цьому напрямку.'
      });
    } else if (level1Analysis.dominantCriteria === 'invited') {
      recommendations.push({
        id: 'level1_invited_dominant',
        priority: 'low',
        title: 'Активність через запрошення для рефералів 1-го рівня',
        description: 'Реферали 1-го рівня активніше запрошують нових користувачів. Збільшіть винагороду за запрошення нових рефералів.'
      });
    }
  }

  // Рекомендація 5: Загальні поради
  recommendations.push({
    id: 'general_recommendations',
    priority: 'low',
    title: 'Загальні рекомендації',
    description: 'Регулярно нагадуйте рефералам про вигоди активності та проводіть спеціальні акції для неактивних рефералів.'
  });

  return recommendations;
}

/**
 * Допоміжна функція для вибору правильної форми слова "реферал"
 * @param {number} count - Кількість
 * @returns {string} Відмінювана форма слова
 * @private
 */
function pluralizeReferral(count) {
  if (count === 1) {
    return 'реферал';
  } else if (count >= 2 && count <= 4) {
    return 'реферали';
  } else {
    return 'рефералів';
  }
}

export default {
  checkReferralsActivity,
  checkReferralActivity,
  analyzeReferralsActivity
};