/**
 * API для отримання історії реферальної активності
 * Повертає часову лінію подій, пов'язаних з рефералами
 *
 * @module referral/api/fetchReferralHistory
 */

/**
 * Отримує повну історію реферальної активності користувача
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції запиту
 * @param {Date|string} [options.startDate] - Початкова дата для фільтрації
 * @param {Date|string} [options.endDate] - Кінцева дата для фільтрації
 * @param {number} [options.limit] - Обмеження кількості результатів
 * @param {string} [options.type] - Тип подій для фільтрації ('referral', 'bonus', 'reward', 'badge', 'task', 'draw')
 * @returns {Promise<Array>} Масив подій у хронологічному порядку
 */
export const fetchReferralHistory = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Тут буде запит до API, для прикладу використовуємо моковані дані
    // В реальному додатку тут буде запит до бекенду
    return mockFetchReferralHistory(userId, options);
  } catch (error) {
    console.error('Error fetching referral history:', error);
    throw new Error('Failed to fetch referral history');
  }
};

/**
 * Отримує історію конкретного типу реферальної активності
 *
 * @param {string} userId - ID користувача
 * @param {string} eventType - Тип подій ('referral', 'bonus', 'reward', 'badge', 'task', 'draw')
 * @param {Object} [options] - Опції запиту
 * @returns {Promise<Array>} Масив подій вказаного типу
 */
export const fetchReferralEventHistory = async (userId, eventType, options = {}) => {
  if (!userId || !eventType) {
    throw new Error('userId and eventType are required');
  }

  try {
    // Отримуємо всю історію і фільтруємо за типом
    const history = await fetchReferralHistory(userId, { ...options, type: eventType });
    return history;
  } catch (error) {
    console.error(`Error fetching ${eventType} history:`, error);
    throw new Error(`Failed to fetch ${eventType} history`);
  }
};

/**
 * Отримує агреговану статистику реферальної активності за період
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції запиту
 * @param {Date|string} [options.startDate] - Початкова дата періоду
 * @param {Date|string} [options.endDate] - Кінцева дата періоду
 * @returns {Promise<Object>} Агрегована статистика
 */
export const fetchReferralActivitySummary = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Отримуємо всю історію за період
    const history = await fetchReferralHistory(userId, options);

    // Агрегуємо статистику
    const summary = {
      totalEvents: history.length,
      referralsRegistered: 0,
      directBonusEarned: 0,
      percentageRewardsEarned: 0,
      badgesEarned: 0,
      tasksCompleted: 0,
      drawsParticipated: 0,
      drawsWon: 0,
      totalEarnings: 0,
      eventsByDate: {},
      eventsByType: {}
    };

    // Проходимо по всім подіям та агрегуємо статистику
    history.forEach(event => {
      // Рахуємо події за типом
      summary.eventsByType[event.type] = (summary.eventsByType[event.type] || 0) + 1;

      // Рахуємо події за датою
      const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
      summary.eventsByDate[dateKey] = (summary.eventsByDate[dateKey] || 0) + 1;

      // Рахуємо специфічні метрики залежно від типу події
      switch (event.type) {
        case 'referral':
          summary.referralsRegistered++;
          break;
        case 'bonus':
          summary.directBonusEarned += event.amount || 0;
          summary.totalEarnings += event.amount || 0;
          break;
        case 'reward':
          summary.percentageRewardsEarned += event.amount || 0;
          summary.totalEarnings += event.amount || 0;
          break;
        case 'badge':
          summary.badgesEarned++;
          summary.totalEarnings += event.amount || 0;
          break;
        case 'task':
          summary.tasksCompleted++;
          summary.totalEarnings += event.amount || 0;
          break;
        case 'draw':
          summary.drawsParticipated++;
          if (event.won) {
            summary.drawsWon++;
            summary.totalEarnings += event.amount || 0;
          }
          break;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error fetching referral activity summary:', error);
    throw new Error('Failed to fetch referral activity summary');
  }
};

/**
 * Отримує статистику реферальної активності по періодах (щоденно, щотижнево, щомісячно)
 *
 * @param {string} userId - ID користувача
 * @param {string} period - Період ('daily', 'weekly', 'monthly')
 * @param {Object} [options] - Опції запиту
 * @returns {Promise<Array>} Масив з агрегованою статистикою по періодах
 */
export const fetchReferralActivityTrend = async (userId, period = 'monthly', options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Отримуємо всю історію
    const history = await fetchReferralHistory(userId, options);

    // Сортуємо історію за датою (від найстарішої до найновішої)
    const sortedHistory = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Агрегуємо дані по періодах
    const trendData = [];
    const periodData = {};

    sortedHistory.forEach(event => {
      // Визначаємо ключ періоду
      let periodKey;
      const eventDate = new Date(event.timestamp);

      if (period === 'daily') {
        periodKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'weekly') {
        // Визначаємо номер тижня в році
        const firstDayOfYear = new Date(eventDate.getFullYear(), 0, 1);
        const pastDaysOfYear = (eventDate - firstDayOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        periodKey = `${eventDate.getFullYear()}-W${weekNumber}`;
      } else if (period === 'monthly') {
        periodKey = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}`;
      } else {
        // За замовчуванням - щомісячно
        periodKey = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}`;
      }

      // Ініціалізуємо дані для періоду, якщо вони ще не існують
      if (!periodData[periodKey]) {
        periodData[periodKey] = {
          period: periodKey,
          referralsRegistered: 0,
          directBonusEarned: 0,
          percentageRewardsEarned: 0,
          badgesEarned: 0,
          tasksCompleted: 0,
          drawsParticipated: 0,
          drawsWon: 0,
          totalEarnings: 0,
          eventCount: 0
        };
      }

      // Інкрементуємо лічильник подій
      periodData[periodKey].eventCount++;

      // Оновлюємо специфічні метрики залежно від типу події
      switch (event.type) {
        case 'referral':
          periodData[periodKey].referralsRegistered++;
          break;
        case 'bonus':
          periodData[periodKey].directBonusEarned += event.amount || 0;
          periodData[periodKey].totalEarnings += event.amount || 0;
          break;
        case 'reward':
          periodData[periodKey].percentageRewardsEarned += event.amount || 0;
          periodData[periodKey].totalEarnings += event.amount || 0;
          break;
        case 'badge':
          periodData[periodKey].badgesEarned++;
          periodData[periodKey].totalEarnings += event.amount || 0;
          break;
        case 'task':
          periodData[periodKey].tasksCompleted++;
          periodData[periodKey].totalEarnings += event.amount || 0;
          break;
        case 'draw':
          periodData[periodKey].drawsParticipated++;
          if (event.won) {
            periodData[periodKey].drawsWon++;
            periodData[periodKey].totalEarnings += event.amount || 0;
          }
          break;
      }
    });

    // Перетворюємо об'єкт в масив для зручності використання
    Object.keys(periodData).forEach(key => {
      trendData.push(periodData[key]);
    });

    // Сортуємо за періодом (від найдавнішого до найновішого)
    return trendData.sort((a, b) => a.period.localeCompare(b.period));
  } catch (error) {
    console.error('Error fetching referral activity trend:', error);
    throw new Error('Failed to fetch referral activity trend');
  }
};

// Моковані функції для тестування (в реальному додатку їх не буде)
// =========================================================================

const mockFetchReferralHistory = (userId, options = {}) => {
  // Генеруємо випадкові дані для тестування
  const { startDate, endDate, limit = 100, type } = options;

  // Створюємо масив з випадковими подіями
  const history = [];

  // Типи подій
  const eventTypes = ['referral', 'bonus', 'reward', 'badge', 'task', 'draw'];

  // Якщо вказано конкретний тип, використовуємо лише його
  const typesToUse = type ? [type] : eventTypes;

  // Визначаємо діапазон дат
  const startTimestamp = startDate ? new Date(startDate).getTime() : new Date().getTime() - 365 * 24 * 60 * 60 * 1000; // За замовчуванням - рік тому
  const endTimestamp = endDate ? new Date(endDate).getTime() : new Date().getTime();

  // Генеруємо випадкову кількість подій (від 20 до 200)
  const eventsCount = Math.min(Math.floor(Math.random() * 180) + 20, limit);

  for (let i = 0; i < eventsCount; i++) {
    // Випадковий тип події
    const eventType = typesToUse[Math.floor(Math.random() * typesToUse.length)];

    // Випадкова дата в межах діапазону
    const timestamp = new Date(startTimestamp + Math.random() * (endTimestamp - startTimestamp));

    // Базова структура події
    const event = {
      id: `event_${i + 1}`,
      userId,
      type: eventType,
      timestamp: timestamp.toISOString()
    };

    // Додаємо специфічні дані залежно від типу події
    switch (eventType) {
      case 'referral':
        event.referralId = `ref_${Math.floor(Math.random() * 1000) + 1}`;
        event.level = Math.random() > 0.7 ? 2 : 1;
        break;
      case 'bonus':
        event.referralId = `ref_${Math.floor(Math.random() * 1000) + 1}`;
        event.amount = 50; // Фіксований бонус
        event.description = 'Прямий бонус за реферала';
        break;
      case 'reward':
        event.referralId = `ref_${Math.floor(Math.random() * 1000) + 1}`;
        event.amount = Math.floor(Math.random() * 500) + 50;
        event.description = 'Відсоткова винагорода';
        event.level = Math.random() > 0.7 ? 2 : 1;
        break;
      case 'badge':
        const badgeTypes = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
        const badgeRewards = [2500, 5000, 10000, 20000];
        const badgeIndex = Math.floor(Math.random() * badgeTypes.length);
        event.badgeType = badgeTypes[badgeIndex];
        event.amount = badgeRewards[badgeIndex];
        event.description = `Отримано ${event.badgeType} бейдж`;
        break;
      case 'task':
        event.taskType = 'REFERRAL_COUNT';
        event.amount = 12000;
        event.description = 'Виконано завдання з запрошення 100 рефералів';
        break;
      case 'draw':
        event.drawId = `draw_${Math.floor(Math.random() * 100) + 1}`;
        event.won = Math.random() > 0.7;
        event.amount = event.won ? Math.floor(Math.random() * 1000) + 100 : 0;
        event.description = event.won ? 'Виграш у розіграші' : 'Участь у розіграші';
        break;
    }

    history.push(event);
  }

  // Сортуємо історію за датою (від найновішої до найстарішої)
  return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};