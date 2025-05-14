/**
 * API для отримання даних про участь рефералів у розіграшах
 *
 * @module referral/api/fetchReferralDraws
 */

/**
 * Отримує дані про участь реферала у розіграшах
 *
 * @param {string} referralId - ID реферала
 * @returns {Promise<Object>} Дані про участь у розіграшах
 */
export const fetchReferralDraws = async (referralId) => {
  if (!referralId) {
    throw new Error('referralId is required');
  }

  try {
    // Тут буде запит до API, для прикладу використовуємо моковані дані
    // В реальному додатку тут буде запит до бекенду
    return mockFetchReferralDraws(referralId);
  } catch (error) {
    console.error('Error fetching referral draws:', error);
    throw new Error('Failed to fetch referral draws data');
  }
};

/**
 * Отримує детальні дані про участь реферала у конкретному розіграші
 *
 * @param {string} referralId - ID реферала
 * @param {string} drawId - ID розіграшу
 * @returns {Promise<Object>} Деталі участі у розіграші
 */
export const fetchDrawDetails = async (referralId, drawId) => {
  if (!referralId || !drawId) {
    throw new Error('referralId and drawId are required');
  }

  try {
    // Тут буде запит до API, для прикладу використовуємо моковані дані
    // В реальному додатку тут буде запит до бекенду
    return mockFetchDrawDetails(referralId, drawId);
  } catch (error) {
    console.error('Error fetching draw details:', error);
    throw new Error('Failed to fetch draw details');
  }
};

/**
 * Отримує статистику участі рефералів у розіграшах за період
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {Object} [options] - Опції запиту
 * @param {Date} [options.startDate] - Початкова дата періоду
 * @param {Date} [options.endDate] - Кінцева дата періоду
 * @returns {Promise<Object>} Статистика участі рефералів у розіграшах
 */
export const fetchDrawsParticipationStats = async (ownerId, options = {}) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Тут буде запит до API, для прикладу використовуємо моковані дані
    // В реальному додатку тут буде запит до бекенду
    return mockFetchDrawsParticipationStats(ownerId, options);
  } catch (error) {
    console.error('Error fetching draws participation stats:', error);
    throw new Error('Failed to fetch draws participation stats');
  }
};

/**
 * Отримує загальну кількість розіграшів, у яких брали участь реферали
 *
 * @param {string} ownerId - ID власника рефералів
 * @returns {Promise<number>} Загальна кількість розіграшів
 */
export const fetchTotalDrawsCount = async (ownerId) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Тут буде запит до API, для прикладу використовуємо моковані дані
    // В реальному додатку тут буде запит до бекенду
    const stats = await mockFetchDrawsParticipationStats(ownerId);
    return stats.totalDrawsCount || 0;
  } catch (error) {
    console.error('Error fetching total draws count:', error);
    throw new Error('Failed to fetch total draws count');
  }
};

/**
 * Отримує список найактивніших рефералів за участю в розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {number} [limit=10] - Кількість рефералів для включення в список
 * @returns {Promise<Array>} Список найактивніших рефералів
 */
export const fetchMostActiveInDraws = async (ownerId, limit = 10) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Тут буде запит до API, для прикладу використовуємо моковані дані
    // В реальному додатку тут буде запит до бекенду
    return mockFetchMostActiveInDraws(ownerId, limit);
  } catch (error) {
    console.error('Error fetching most active referrals in draws:', error);
    throw new Error('Failed to fetch most active referrals in draws');
  }
};

// Моковані функції для тестування (в реальному додатку їх не буде)
// =========================================================================

const mockFetchReferralDraws = (referralId) => {
  // Генеруємо випадкові дані для тестування
  const participationCount = Math.floor(Math.random() * 10) + 1;
  const winCount = Math.floor(Math.random() * participationCount);

  const draws = [];
  for (let i = 0; i < participationCount; i++) {
    const drawDate = new Date();
    drawDate.setDate(drawDate.getDate() - Math.floor(Math.random() * 30));

    draws.push({
      drawId: `draw_${i + 1}`,
      date: drawDate.toISOString(),
      name: `Draw #${i + 1}`,
      isWon: i < winCount,
      prize: i < winCount ? Math.floor(Math.random() * 1000) + 100 : 0,
      ticketsCount: Math.floor(Math.random() * 5) + 1
    });
  }

  return {
    referralId,
    totalParticipation: participationCount,
    winCount,
    draws
  };
};

const mockFetchDrawDetails = (referralId, drawId) => {
  return {
    drawId,
    referralId,
    date: new Date().toISOString(),
    name: `Draw ${drawId}`,
    ticketsCount: Math.floor(Math.random() * 5) + 1,
    ticketNumbers: Array.from({ length: Math.floor(Math.random() * 5) + 1 },
                            () => Math.floor(Math.random() * 9000) + 1000),
    isWon: Math.random() > 0.7,
    prize: Math.random() > 0.7 ? Math.floor(Math.random() * 1000) + 100 : 0,
    totalParticipants: Math.floor(Math.random() * 1000) + 100,
    winningTicket: Math.floor(Math.random() * 9000) + 1000
  };
};

const mockFetchDrawsParticipationStats = (ownerId, options = {}) => {
  // Масив з ID рефералів - для прикладу
  const referralIds = Array.from({ length: 20 }, (_, i) => `ref_${i + 1}`);

  // Створюємо статистику по розіграшах для кожного реферала
  const referralsStats = referralIds.map(refId => {
    const participationCount = Math.floor(Math.random() * 15);
    const winCount = Math.floor(Math.random() * participationCount);

    return {
      referralId: refId,
      participationCount,
      winCount,
      totalPrize: winCount * (Math.floor(Math.random() * 500) + 100),
      lastParticipationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  });

  // Фільтруємо статистику за датами, якщо вказані
  let filteredStats = [...referralsStats];
  if (options.startDate) {
    const startDate = new Date(options.startDate);
    filteredStats = filteredStats.filter(stat =>
      new Date(stat.lastParticipationDate) >= startDate
    );
  }

  if (options.endDate) {
    const endDate = new Date(options.endDate);
    filteredStats = filteredStats.filter(stat =>
      new Date(stat.lastParticipationDate) <= endDate
    );
  }

  // Рахуємо загальну статистику
  const totalParticipationCount = filteredStats.reduce((sum, stat) => sum + stat.participationCount, 0);
  const totalWinCount = filteredStats.reduce((sum, stat) => sum + stat.winCount, 0);
  const totalPrize = filteredStats.reduce((sum, stat) => sum + stat.totalPrize, 0);

  return {
    ownerId,
    totalDrawsCount: 30, // Припустимо, що було 30 розіграшів
    totalParticipationCount,
    totalWinCount,
    totalPrize,
    winRate: totalParticipationCount > 0 ? (totalWinCount / totalParticipationCount) * 100 : 0,
    referralsStats: filteredStats,
    period: {
      startDate: options.startDate || null,
      endDate: options.endDate || null
    }
  };
};

const mockFetchMostActiveInDraws = (ownerId, limit) => {
  const referralsWithStats = Array.from({ length: 20 }, (_, i) => {
    const participationCount = Math.floor(Math.random() * 20);
    const winCount = Math.floor(Math.random() * participationCount);

    return {
      referralId: `ref_${i + 1}`,
      participationCount,
      winCount,
      winRate: participationCount > 0 ? (winCount / participationCount) * 100 : 0,
      totalPrize: winCount * (Math.floor(Math.random() * 500) + 100),
      lastParticipationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  });

  // Сортуємо за кількістю участі (від найбільшої до найменшої)
  const sorted = referralsWithStats.sort((a, b) => b.participationCount - a.participationCount);

  // Повертаємо топ-N
  return sorted.slice(0, limit);
};