/**
 * API для отримання статистики рефералів
 *
 * Отримує дані про кількість рефералів різних рівнів
 * та їх структуру для подальшої обробки
 *
 * @module fetchReferralStats
 */

/**
 * Отримує статистику по рефералах користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Об'єкт з даними про рефералів
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralStats = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for fetching referral statistics');
  }

  try {
    // Імітація запиту до API
    // В реальному додатку тут був би код для відправки запиту на сервер
    // const response = await fetch(`/api/referrals/stats/${userId}`);
    // const data = await response.json();
    // if (!response.ok) throw new Error(data.message || 'Failed to fetch referral statistics');
    // return data;

    // Для тестування, імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 500));

    // Моковані дані для тестування
    const mockData = {
      user: {
        id: userId,
        registrationDate: '2024-01-15T10:30:00Z'
      },
      referrals: {
        level1: [
          { id: 'WX12345', registrationDate: '2024-02-10T14:20:00Z', active: true },
          { id: 'WX23456', registrationDate: '2024-02-15T09:45:00Z', active: true },
          { id: 'WX34567', registrationDate: '2024-03-01T16:05:00Z', active: false },
          { id: 'WX45678', registrationDate: '2024-03-10T11:30:00Z', active: true },
          { id: 'WX56789', registrationDate: '2024-04-05T08:15:00Z', active: true }
        ],
        level2: [
          { id: 'WX67890', referrerId: 'WX12345', registrationDate: '2024-02-20T13:10:00Z', active: true },
          { id: 'WX78901', referrerId: 'WX12345', registrationDate: '2024-02-25T10:20:00Z', active: false },
          { id: 'WX89012', referrerId: 'WX23456', registrationDate: '2024-03-05T09:30:00Z', active: true },
          { id: 'WX90123', referrerId: 'WX23456', registrationDate: '2024-03-15T14:40:00Z', active: true },
          { id: 'WX01234', referrerId: 'WX23456', registrationDate: '2024-03-20T15:50:00Z', active: false },
          { id: 'WX12340', referrerId: 'WX45678', registrationDate: '2024-04-01T16:00:00Z', active: true },
          { id: 'WX23401', referrerId: 'WX45678', registrationDate: '2024-04-10T17:10:00Z', active: true }
        ]
      },
      statistics: {
        totalReferrals: 12,
        level1Count: 5,
        level2Count: 7,
        activeReferrals: 9,
        inactiveReferrals: 3,
        conversionRate: 0.75
      }
    };

    return mockData;
  } catch (error) {
    console.error('Error fetching referral statistics:', error);
    throw new Error('Failed to fetch referral statistics: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Отримує детальну інформацію про конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @returns {Promise<Object>} Об'єкт з даними про реферала
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralDetails = async (referralId) => {
  if (!referralId) {
    throw new Error('Referral ID is required');
  }

  try {
    // Імітація запиту до API
    await new Promise(resolve => setTimeout(resolve, 300));

    // Моковані дані для тестування
    const mockData = {
      id: referralId,
      registrationDate: '2024-02-15T09:45:00Z',
      active: true,
      earnings: 320,
      referralCount: 3,
      lastActivity: '2024-04-20T14:30:00Z'
    };

    return mockData;
  } catch (error) {
    console.error('Error fetching referral details:', error);
    throw new Error('Failed to fetch referral details');
  }
};

export default fetchReferralStats;