/**
 * API для отримання даних про активність рефералів
 *
 * Надає функції для запиту інформації про активність рефералів:
 * - кількість участей в розіграшах
 * - кількість запрошених користувачів
 * - статус ручної активації
 *
 * @module fetchReferralActivity
 */

/**
 * Отримує дані про активність рефералів
 * @param {string|number} userId - ID користувача, чиїх рефералів потрібно перевірити
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки активності
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки активності
 * @param {number} [options.level] - Рівень рефералів (1 або 2)
 * @returns {Promise<Object>} Об'єкт з даними про активність рефералів
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralActivity = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про активність');
  }

  try {
    // В реальному додатку тут був би запит до API
    // const response = await fetch(`/api/referrals/activity/${userId}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(options)
    // });
    // const data = await response.json();
    // if (!response.ok) throw new Error(data.message || 'Помилка отримання даних про активність');
    // return data;

    // Імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 350));

    // Моковані дані для тестування
    return generateMockActivityData(userId, options);
  } catch (error) {
    console.error('Помилка отримання даних про активність рефералів:', error);
    throw new Error(`Не вдалося отримати дані про активність: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує детальні дані про активність конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки активності
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки активності
 * @returns {Promise<Object>} Об'єкт з детальними даними про активність
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralDetailedActivity = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для отримання детальних даних');
  }

  try {
    // Імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 250));

    // Моковані детальні дані про активність для тестування
    return generateMockDetailedActivity(referralId, options);
  } catch (error) {
    console.error('Помилка отримання детальних даних про активність:', error);
    throw new Error(`Не вдалося отримати детальні дані: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує агреговані дані про активність всіх рефералів
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Об'єкт з агрегованими даними
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchActivitySummary = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про активність');
  }

  try {
    // Імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 300));

    // Отримуємо дані про активність
    const activityData = await fetchReferralActivity(userId);

    // Підраховуємо загальну кількість рефералів
    const totalReferrals = activityData.level1Activity.length + activityData.level2Activity.length;

    // Підраховуємо кількість активних рефералів
    const activeLevel1 = activityData.level1Activity.filter(ref => ref.isActive).length;
    const activeLevel2 = activityData.level2Activity.filter(ref => ref.isActive).length;
    const totalActive = activeLevel1 + activeLevel2;

    // Розраховуємо конверсію (відсоток активних рефералів)
    const conversionRate = totalReferrals > 0
      ? totalActive / totalReferrals
      : 0;

    // Формуємо результат
    return {
      userId,
      timestamp: activityData.timestamp,
      totalReferrals,
      activeReferrals: totalActive,
      inactiveReferrals: totalReferrals - totalActive,
      level1Total: activityData.level1Activity.length,
      level1Active: activeLevel1,
      level2Total: activityData.level2Activity.length,
      level2Active: activeLevel2,
      conversionRate,
      activityByReason: {
        drawsCriteria: countByReason(activityData, 'draws_criteria'),
        invitedCriteria: countByReason(activityData, 'invited_criteria'),
        bothCriteria: countByReason(activityData, 'both_criteria'),
        manualActivation: countByReason(activityData, 'manual_activation')
      }
    };
  } catch (error) {
    console.error('Помилка отримання зведених даних про активність:', error);
    throw new Error(`Не вдалося отримати зведені дані: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Допоміжна функція для підрахунку рефералів за причиною активності
 * @param {Object} activityData - Дані про активність
 * @param {string} reason - Причина активності
 * @returns {number} Кількість рефералів
 * @private
 */
function countByReason(activityData, reason) {
  const level1Count = activityData.level1Activity.filter(ref => ref.reasonForActivity === reason).length;
  const level2Count = activityData.level2Activity.filter(ref => ref.reasonForActivity === reason).length;
  return level1Count + level2Count;
}

/**
 * Генерує моковані дані про активність для тестування
 * @param {string|number} userId - ID користувача
 * @param {Object} options - Опції для генерації даних
 * @returns {Object} Об'єкт з мокованими даними
 * @private
 */
function generateMockActivityData(userId, options) {
  // Генеруємо випадкову кількість рефералів
  const level1Count = Math.floor(Math.random() * 10) + 5;
  const level2Count = Math.floor(Math.random() * 15) + 5;

  // Генеруємо дані для рефералів 1-го рівня
  const level1Activity = Array.from({ length: level1Count }, (_, index) => {
    // Генеруємо випадкові значення для активності
    const drawsParticipation = Math.floor(Math.random() * 6); // 0-5 розіграшів
    const invitedReferrals = Math.floor(Math.random() * 3); // 0-2 запрошених
    const manuallyActivated = Math.random() < 0.1; // 10% шанс ручної активації

    // Визначаємо статус активності
    const meetsDrawsCriteria = drawsParticipation >= 3;
    const meetsInvitedCriteria = invitedReferrals >= 1;
    const isActive = manuallyActivated || meetsDrawsCriteria || meetsInvitedCriteria;

    // Визначаємо причину активності
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

    return {
      id: `WX${1000 + index}`,
      drawsParticipation,
      invitedReferrals,
      lastActivityDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      isActive,
      manuallyActivated,
      meetsDrawsCriteria,
      meetsInvitedCriteria,
      reasonForActivity
    };
  });

  // Генеруємо дані для рефералів 2-го рівня
  const level2Activity = Array.from({ length: level2Count }, (_, index) => {
    // Вибираємо випадкового реферала 1-го рівня як реферера
    const referrerId = level1Activity[Math.floor(Math.random() * level1Count)].id;

    // Генеруємо випадкові значення для активності
    const drawsParticipation = Math.floor(Math.random() * 6); // 0-5 розіграшів
    const invitedReferrals = Math.floor(Math.random() * 3); // 0-2 запрошених
    const manuallyActivated = Math.random() < 0.1; // 10% шанс ручної активації

    // Визначаємо статус активності
    const meetsDrawsCriteria = drawsParticipation >= 3;
    const meetsInvitedCriteria = invitedReferrals >= 1;
    const isActive = manuallyActivated || meetsDrawsCriteria || meetsInvitedCriteria;

    // Визначаємо причину активності
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

    return {
      id: `WX${2000 + index}`,
      referrerId,
      drawsParticipation,
      invitedReferrals,
      lastActivityDate: new Date(Date.now() - Math.floor(Math.random() * 45) * 24 * 60 * 60 * 1000).toISOString(),
      isActive,
      manuallyActivated,
      meetsDrawsCriteria,
      meetsInvitedCriteria,
      reasonForActivity
    };
  });

  // Формуємо результат
  return {
    userId,
    timestamp: new Date().toISOString(),
    level1Activity,
    level2Activity
  };
}

/**
 * Генерує моковані детальні дані про активність для тестування
 * @param {string|number} referralId - ID реферала
 * @param {Object} options - Опції для генерації даних
 * @returns {Object} Об'єкт з мокованими детальними даними
 * @private
 */
function generateMockDetailedActivity(referralId, options) {
  // Генеруємо випадкові значення для активності
  const drawsParticipation = Math.floor(Math.random() * 6); // 0-5 розіграшів
  const invitedReferrals = Math.floor(Math.random() * 3); // 0-2 запрошених
  const manuallyActivated = Math.random() < 0.1; // 10% шанс ручної активації

  // Визначаємо статус активності
  const meetsDrawsCriteria = drawsParticipation >= 3;
  const meetsInvitedCriteria = invitedReferrals >= 1;
  const isActive = manuallyActivated || meetsDrawsCriteria || meetsInvitedCriteria;

  // Визначаємо причину активності
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

  // Генеруємо дані про останні розіграші
  const drawsHistory = Array.from({ length: drawsParticipation }, (_, index) => ({
    drawId: `DRAW${1000 + index}`,
    date: new Date(Date.now() - (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    prizeName: ['Winix', 'Tokens', 'Bonus', 'Gift Card'][Math.floor(Math.random() * 4)],
    prizeAmount: Math.floor(Math.random() * 1000) + 100
  }));

  // Генеруємо дані про запрошених рефералів
  const invitedReferralsList = Array.from({ length: invitedReferrals }, (_, index) => ({
    id: `WX${3000 + index}`,
    registrationDate: new Date(Date.now() - (index + 1) * 10 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: Math.random() > 0.3 // 70% шанс активності
  }));

  // Формуємо результат
  return {
    id: referralId,
    timestamp: new Date().toISOString(),
    drawsParticipation,
    invitedReferrals,
    lastActivityDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
    isActive,
    manuallyActivated,
    meetsDrawsCriteria,
    meetsInvitedCriteria,
    reasonForActivity,
    drawsHistory,
    invitedReferralsList,
    manualActivationInfo: manuallyActivated ? {
      activatedBy: 'admin',
      activationDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Special program'
    } : null
  };
}

export default fetchReferralActivity;