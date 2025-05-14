/**
 * API для отримання даних про заробітки рефералів
 *
 * Надає функції для запиту інформації про заробітки та активність рефералів
 * на різних рівнях для подальшого обчислення відсоткових нарахувань
 *
 * @module fetchReferralEarnings
 */

/**
 * Отримує дані про заробітки рефералів різних рівнів
 * @param {string|number} userId - ID користувача
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки
 * @param {boolean} [options.activeOnly=false] - Враховувати тільки активних рефералів
 * @returns {Promise<Object>} Об'єкт з даними про заробітки рефералів
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralEarnings = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про заробітки');
  }

  try {
    // В реальному додатку тут був би запит до API
    // const response = await fetch(`/api/referrals/earnings/${userId}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(options)
    // });
    // const data = await response.json();
    // if (!response.ok) throw new Error(data.message || 'Помилка отримання даних про заробітки');
    // return data;

    // Імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 400));

    // Моковані дані для тестування
    return generateMockEarningsData(userId, options);
  } catch (error) {
    console.error('Помилка отримання даних про заробітки рефералів:', error);
    throw new Error(`Не вдалося отримати дані про заробітки: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує деталізовані дані про заробітки конкретного реферала
 * @param {string|number} referralId - ID реферала
 * @param {Object} [options] - Додаткові опції для запиту
 * @param {Date|string} [options.startDate] - Початкова дата для вибірки
 * @param {Date|string} [options.endDate] - Кінцева дата для вибірки
 * @returns {Promise<Object>} Об'єкт з детальними даними про заробітки
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchReferralDetailedEarnings = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для отримання детальних даних');
  }

  try {
    // Імітуємо затримку мережі
    await new Promise(resolve => setTimeout(resolve, 300));

    // Моковані дані детальної статистики для тестування
    return {
      referralId,
      totalEarnings: Math.floor(Math.random() * 5000) + 500,
      periodEarnings: Math.floor(Math.random() * 1000) + 100,
      lastEarningDate: new Date().toISOString(),
      activities: [
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'game',
          amount: Math.floor(Math.random() * 200) + 50
        },
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'deposit',
          amount: Math.floor(Math.random() * 500) + 100
        },
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'game',
          amount: Math.floor(Math.random() * 150) + 30
        }
      ]
    };
  } catch (error) {
    console.error('Помилка отримання детальних даних про заробітки:', error);
    throw new Error(`Не вдалося отримати детальні дані: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Генерує моковані дані про заробітки для тестування
 * @param {string|number} userId - ID користувача
 * @param {Object} options - Опції для генерації даних
 * @returns {Object} Об'єкт з мокованими даними
 * @private
 */
function generateMockEarningsData(userId, options) {
  // Генеруємо випадкову кількість рефералів для кожного рівня
  const level1Count = Math.floor(Math.random() * 8) + 3;
  const level2Count = Math.floor(Math.random() * 15) + 5;

  // Генеруємо дані для рефералів 1-го рівня
  const level1Referrals = Array.from({ length: level1Count }, (_, index) => ({
    id: `WX${1000 + index}`,
    active: Math.random() > 0.2, // 80% активних
    totalEarnings: Math.floor(Math.random() * 3000) + 500,
    lastEarningDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
  }));

  // Генеруємо дані для рефералів 2-го рівня
  const level2Referrals = Array.from({ length: level2Count }, (_, index) => {
    // Вибираємо випадкового реферала 1-го рівня як реферера
    const referrerId = level1Referrals[Math.floor(Math.random() * level1Count)].id;

    return {
      id: `WX${2000 + index}`,
      referrerId, // Хто запросив цього реферала 2-го рівня
      active: Math.random() > 0.3, // 70% активних
      totalEarnings: Math.floor(Math.random() * 2000) + 200,
      lastEarningDate: new Date(Date.now() - Math.floor(Math.random() * 45) * 24 * 60 * 60 * 1000).toISOString()
    };
  });

  // Підраховуємо загальні заробітки для кожного рівня
  const level1TotalEarnings = level1Referrals.reduce((sum, ref) => sum + ref.totalEarnings, 0);
  const level2TotalEarnings = level2Referrals.reduce((sum, ref) => sum + ref.totalEarnings, 0);

  // Фільтруємо активних рефералів, якщо вказана опція
  const filteredLevel1 = options.activeOnly
    ? level1Referrals.filter(ref => ref.active)
    : level1Referrals;

  const filteredLevel2 = options.activeOnly
    ? level2Referrals.filter(ref => ref.active)
    : level2Referrals;

  // Формуємо результат
  return {
    userId,
    timestamp: new Date().toISOString(),
    summary: {
      level1Count: filteredLevel1.length,
      level2Count: filteredLevel2.length,
      level1TotalEarnings,
      level2TotalEarnings,
      totalEarnings: level1TotalEarnings + level2TotalEarnings
    },
    level1Referrals: filteredLevel1,
    level2Referrals: filteredLevel2
  };
}

export default fetchReferralEarnings;