/**
 * Утиліта для сортування рефералів за принесеним заробітком
 * Дозволяє сортувати списки рефералів за різними критеріями заробітку
 *
 * @module referral/utils/sortReferralsByEarnings
 */

/**
 * Сортує масив рефералів за загальним принесеним заробітком (від найбільшого до найменшого)
 *
 * @param {Array} referrals - Масив об'єктів рефералів для сортування
 * @param {Object} [options] - Опції сортування
 * @param {boolean} [options.ascending=false] - Якщо true, сортує від найменшого до найбільшого
 * @param {string} [options.earningsField='totalEarnings'] - Поле, за яким проводиться сортування
 * @returns {Array} Відсортований масив рефералів
 */
export const sortReferralsByEarnings = (referrals, options = {}) => {
  if (!Array.isArray(referrals)) {
    console.error('sortReferralsByEarnings: referrals must be an array');
    return [];
  }

  const { ascending = false, earningsField = 'totalEarnings' } = options;

  return [...referrals].sort((a, b) => {
    const aEarnings = parseFloat(a[earningsField] || 0);
    const bEarnings = parseFloat(b[earningsField] || 0);

    return ascending ? aEarnings - bEarnings : bEarnings - aEarnings;
  });
};

/**
 * Сортує масив рефералів за принесеними відсотковими винагородами
 *
 * @param {Array} referrals - Масив об'єктів рефералів для сортування
 * @param {boolean} [ascending=false] - Якщо true, сортує від найменшого до найбільшого
 * @returns {Array} Відсортований масив рефералів
 */
export const sortByPercentageRewards = (referrals, ascending = false) => {
  return sortReferralsByEarnings(referrals, {
    ascending,
    earningsField: 'percentageEarnings'
  });
};

/**
 * Сортує масив рефералів за кількістю запрошених ними користувачів
 *
 * @param {Array} referrals - Масив об'єктів рефералів для сортування
 * @param {boolean} [ascending=false] - Якщо true, сортує від найменшого до найбільшого
 * @returns {Array} Відсортований масив рефералів
 */
export const sortByInvitedCount = (referrals, ascending = false) => {
  return sortReferralsByEarnings(referrals, {
    ascending,
    earningsField: 'invitedCount'
  });
};

/**
 * Сортує масив рефералів за кількістю участі в розіграшах
 *
 * @param {Array} referrals - Масив об'єктів рефералів для сортування
 * @param {boolean} [ascending=false] - Якщо true, сортує від найменшого до найбільшого
 * @returns {Array} Відсортований масив рефералів
 */
export const sortByDrawsParticipation = (referrals, ascending = false) => {
  return sortReferralsByEarnings(referrals, {
    ascending,
    earningsField: 'drawsParticipation'
  });
};

/**
 * Сортує масив рефералів за активністю (активні спочатку)
 *
 * @param {Array} referrals - Масив об'єктів рефералів для сортування
 * @returns {Array} Відсортований масив рефералів
 */
export const sortByActivity = (referrals) => {
  if (!Array.isArray(referrals)) {
    console.error('sortByActivity: referrals must be an array');
    return [];
  }

  return [...referrals].sort((a, b) => {
    // Спочатку активні, потім неактивні
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;

    // Якщо обидва активні або неактивні, сортуємо за заробітком
    const aEarnings = parseFloat(a.totalEarnings || 0);
    const bEarnings = parseFloat(b.totalEarnings || 0);

    return bEarnings - aEarnings;
  });
};

/**
 * Фільтрує та сортує рефералів за заданими критеріями
 *
 * @param {Array} referrals - Масив об'єктів рефералів
 * @param {Object} [filters] - Фільтри для відбору рефералів
 * @param {boolean} [filters.onlyActive] - Показувати лише активних рефералів
 * @param {number} [filters.minEarnings] - Мінімальна сума заробітку
 * @param {Object} [sortOptions] - Опції сортування
 * @param {string} [sortOptions.by='earnings'] - Критерій сортування: 'earnings', 'invites', 'draws', 'activity'
 * @param {boolean} [sortOptions.ascending=false] - Напрямок сортування
 * @returns {Array} Відфільтрований та відсортований масив рефералів
 */
export const filterAndSortReferrals = (referrals, filters = {}, sortOptions = {}) => {
  if (!Array.isArray(referrals)) {
    console.error('filterAndSortReferrals: referrals must be an array');
    return [];
  }

  const { onlyActive, minEarnings = 0 } = filters;
  const { by = 'earnings', ascending = false } = sortOptions;

  // Фільтрація
  let filtered = [...referrals];

  if (onlyActive) {
    filtered = filtered.filter(referral => referral.active);
  }

  if (minEarnings > 0) {
    filtered = filtered.filter(referral => {
      const earnings = parseFloat(referral.totalEarnings || 0);
      return earnings >= minEarnings;
    });
  }

  // Сортування
  switch (by) {
    case 'invites':
      return sortByInvitedCount(filtered, ascending);
    case 'draws':
      return sortByDrawsParticipation(filtered, ascending);
    case 'activity':
      return sortByActivity(filtered);
    case 'percentage':
      return sortByPercentageRewards(filtered, ascending);
    case 'earnings':
    default:
      return sortReferralsByEarnings(filtered, { ascending });
  }
};