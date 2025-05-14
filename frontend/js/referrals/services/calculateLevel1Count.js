/**
 * Сервіс для підрахунку прямих рефералів (1-й рівень)
 *
 * Обробляє дані про рефералів 1-го рівня, отримані з API
 * та виконує необхідні розрахунки
 *
 * @module calculateLevel1Count
 */

/**
 * Підраховує кількість прямих рефералів (1-й рівень)
 * @param {Array} referrals - Масив рефералів 1-го рівня
 * @param {Object} [options] - Додаткові опції для розрахунків
 * @param {boolean} [options.activeOnly=false] - Враховувати тільки активних рефералів
 * @param {Date|string} [options.fromDate=null] - Враховувати рефералів після цієї дати
 * @param {Date|string} [options.toDate=null] - Враховувати рефералів до цієї дати
 * @returns {number} Кількість прямих рефералів
 */
export const calculateLevel1Count = (referrals, options = {}) => {
  if (!referrals || !Array.isArray(referrals)) {
    return 0;
  }

  const { activeOnly = false, fromDate = null, toDate = null } = options;

  // Підготовка дат
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  // Фільтрація рефералів за параметрами
  const filteredReferrals = referrals.filter(referral => {
    // Перевірка на активність
    if (activeOnly && !referral.active) {
      return false;
    }

    // Перевірка по даті реєстрації
    if (referral.registrationDate) {
      const regDate = new Date(referral.registrationDate);

      if (from && regDate < from) {
        return false;
      }

      if (to && regDate > to) {
        return false;
      }
    }

    return true;
  });

  // Повертаємо кількість відфільтрованих рефералів
  return filteredReferrals.length;
};

/**
 * Аналізує динаміку зростання кількості прямих рефералів
 * @param {Array} referrals - Масив рефералів 1-го рівня
 * @param {number} [periodDays=30] - Період для аналізу в днях
 * @returns {Object} Об'єкт з аналітичними даними
 */
export const analyzeLevel1Growth = (referrals, periodDays = 30) => {
  if (!referrals || !Array.isArray(referrals)) {
    return {
      totalCount: 0,
      growthRate: 0,
      periodGrowth: 0,
      averageDaily: 0
    };
  }

  // Сортуємо рефералів за датою реєстрації
  const sortedReferrals = [...referrals].sort((a, b) => {
    const dateA = new Date(a.registrationDate || 0);
    const dateB = new Date(b.registrationDate || 0);
    return dateA - dateB;
  });

  // Загальна кількість
  const totalCount = sortedReferrals.length;

  // Дата для порівняння з поточним періодом
  const currentDate = new Date();
  const periodStartDate = new Date();
  periodStartDate.setDate(currentDate.getDate() - periodDays);

  // Кількість за поточний період
  const periodReferrals = sortedReferrals.filter(referral => {
    const regDate = new Date(referral.registrationDate || 0);
    return regDate >= periodStartDate;
  });

  const periodCount = periodReferrals.length;

  // Розрахунок середнього щоденного приросту
  const averageDaily = periodCount / periodDays;

  // Попередній період для порівняння
  const previousPeriodStartDate = new Date();
  previousPeriodStartDate.setDate(periodStartDate.getDate() - periodDays);

  // Кількість за попередній період
  const previousPeriodReferrals = sortedReferrals.filter(referral => {
    const regDate = new Date(referral.registrationDate || 0);
    return regDate >= previousPeriodStartDate && regDate < periodStartDate;
  });

  const previousPeriodCount = previousPeriodReferrals.length;

  // Розрахунок приросту
  const periodGrowth = periodCount - previousPeriodCount;

  // Розрахунок відсотка приросту
  const growthRate = previousPeriodCount > 0
    ? ((periodCount - previousPeriodCount) / previousPeriodCount) * 100
    : (periodCount > 0 ? 100 : 0);

  return {
    totalCount,
    periodCount,
    previousPeriodCount,
    periodGrowth,
    growthRate,
    averageDaily
  };
};

export default calculateLevel1Count;