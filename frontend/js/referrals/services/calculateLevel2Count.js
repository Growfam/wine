/**
 * Сервіс для підрахунку непрямих рефералів (2-й рівень)
 *
 * Обробляє дані про рефералів 2-го рівня, отримані з API
 * та виконує необхідні розрахунки
 *
 * @module calculateLevel2Count
 */

/**
 * Підраховує кількість непрямих рефералів (2-й рівень)
 * @param {Array} referrals - Масив рефералів 2-го рівня
 * @param {Object} [options] - Додаткові опції для розрахунків
 * @param {boolean} [options.activeOnly=false] - Враховувати тільки активних рефералів
 * @param {Date|string} [options.fromDate=null] - Враховувати рефералів після цієї дати
 * @param {Date|string} [options.toDate=null] - Враховувати рефералів до цієї дати
 * @param {string|Array} [options.byReferrerId=null] - Фільтрувати за ID реферера 1-го рівня
 * @returns {number} Кількість непрямих рефералів
 */
export const calculateLevel2Count = (referrals, options = {}) => {
  if (!referrals || !Array.isArray(referrals)) {
    return 0;
  }

  const {
    activeOnly = false,
    fromDate = null,
    toDate = null,
    byReferrerId = null
  } = options;

  // Підготовка дат
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  // Фільтрація рефералів за параметрами
  const filteredReferrals = referrals.filter(referral => {
    // Перевірка на активність
    if (activeOnly && !referral.active) {
      return false;
    }

    // Перевірка за ID реферера 1-го рівня
    if (byReferrerId) {
      if (Array.isArray(byReferrerId)) {
        if (!byReferrerId.includes(referral.referrerId)) {
          return false;
        }
      } else if (referral.referrerId !== byReferrerId) {
        return false;
      }
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
 * Групує рефералів 2-го рівня за рефералами 1-го рівня
 * @param {Array} level2Referrals - Масив рефералів 2-го рівня
 * @param {Array} level1Referrals - Масив рефералів 1-го рівня (опціонально)
 * @returns {Object} Об'єкт зі згрупованими рефералами 2-го рівня
 */
export const groupLevel2ByReferrers = (level2Referrals, level1Referrals = []) => {
  if (!level2Referrals || !Array.isArray(level2Referrals)) {
    return {};
  }

  // Створюємо мапу рефералів 1-го рівня для швидкого доступу
  const level1Map = {};
  if (level1Referrals && Array.isArray(level1Referrals)) {
    level1Referrals.forEach(referral => {
      level1Map[referral.id] = referral;
    });
  }

  // Групуємо рефералів 2-го рівня за їх рефералами 1-го рівня
  const groupedReferrals = {};

  level2Referrals.forEach(referral => {
    const referrerId = referral.referrerId;

    if (!referrerId) return;

    if (!groupedReferrals[referrerId]) {
      groupedReferrals[referrerId] = {
        referrerId,
        referrerInfo: level1Map[referrerId] || null,
        referrals: []
      };
    }

    groupedReferrals[referrerId].referrals.push(referral);
  });

  // Додаємо статистику для кожної групи
  Object.keys(groupedReferrals).forEach(referrerId => {
    const group = groupedReferrals[referrerId];
    const referrals = group.referrals;

    group.totalCount = referrals.length;
    group.activeCount = referrals.filter(r => r.active).length;
    group.inactiveCount = group.totalCount - group.activeCount;
  });

  return groupedReferrals;
};

/**
 * Аналізує ефективність рефералів 1-го рівня за кількістю їх рефералів
 * @param {Array} level2Referrals - Масив рефералів 2-го рівня
 * @param {Array} level1Referrals - Масив рефералів 1-го рівня
 * @returns {Array} Відсортований масив з рейтингом рефералів 1-го рівня
 */
export const analyzeLevel1Effectiveness = (level2Referrals, level1Referrals) => {
  if (!level2Referrals || !Array.isArray(level2Referrals) ||
      !level1Referrals || !Array.isArray(level1Referrals)) {
    return [];
  }

  // Групуємо рефералів 2-го рівня за рефералами 1-го рівня
  const groupedReferrals = groupLevel2ByReferrers(level2Referrals, level1Referrals);

  // Формуємо масив результатів для всіх рефералів 1-го рівня
  const effectiveness = level1Referrals.map(referral => {
    const id = referral.id;
    const group = groupedReferrals[id] || { totalCount: 0, activeCount: 0, inactiveCount: 0 };

    // Розраховуємо ефективність
    const referralCount = group.totalCount || 0;
    const conversionRate = referralCount > 0
      ? (group.activeCount / referralCount)
      : 0;

    return {
      id,
      registrationDate: referral.registrationDate,
      active: referral.active,
      referralCount,
      activeReferrals: group.activeCount || 0,
      inactiveReferrals: group.inactiveCount || 0,
      conversionRate
    };
  });

  // Сортуємо результати за кількістю рефералів
  return effectiveness.sort((a, b) => b.referralCount - a.referralCount);
};

export default calculateLevel2Count;