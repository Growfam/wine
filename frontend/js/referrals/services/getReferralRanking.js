/**
 * Сервіс для формування рейтингу рефералів та їх ранжування за різними критеріями
 *
 * @module referral/services/getReferralRanking
 */

import { sortReferralsByEarnings, sortByInvitedCount, sortByDrawsParticipation, filterAndSortReferrals } from '../utils/sortReferralsByEarnings';
import { calculateTotalEarnedForUser } from './calculateTotalEarnedForUser';
import { isActiveReferral } from '../utils/isActiveReferral';

/**
 * Формує рейтинг рефералів за заробітком для певного користувача
 *
 * @param {string} userId - ID користувача, для якого формуємо рейтинг
 * @param {Array} referrals - Масив рефералів користувача
 * @param {Object} [options] - Опції формування рейтингу
 * @param {boolean} [options.includeLevel2=true] - Включати рефералів 2-го рівня
 * @param {boolean} [options.onlyActive=false] - Включати лише активних рефералів
 * @param {string} [options.sortBy='earnings'] - Критерій сортування: 'earnings', 'invites', 'draws', 'activity'
 * @returns {Promise<Array>} Масив рефералів з їхніми ранговими позиціями
 */
export const getReferralRanking = async (userId, referrals, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  if (!Array.isArray(referrals) || referrals.length === 0) {
    console.warn('getReferralRanking: Empty referrals array provided');
    return [];
  }

  const {
    includeLevel2 = true,
    onlyActive = false,
    sortBy = 'earnings'
  } = options;

  try {
    // Обробляємо рефералів 1-го рівня
    let level1Referrals = referrals.filter(ref => ref.level === 1 || !ref.level);

    // Рефералів 2-го рівня обробляємо, якщо потрібно
    let level2Referrals = includeLevel2
      ? referrals.filter(ref => ref.level === 2)
      : [];

    // Об'єднуємо рефералів
    let allReferrals = [...level1Referrals];
    if (includeLevel2) {
      allReferrals = [...allReferrals, ...level2Referrals];
    }

    // Розраховуємо загальний заробіток для кожного реферала, якщо ще не розраховано
    const referralsWithEarnings = await Promise.all(allReferrals.map(async (referral) => {
      if (referral.totalEarnings === undefined) {
        const earnedAmount = await calculateTotalEarnedForUser(userId, referral.id);
        return {
          ...referral,
          totalEarnings: earnedAmount,
          active: referral.active !== undefined ? referral.active : await isActiveReferral(referral.id)
        };
      }
      return referral;
    }));

    // Фільтруємо по активності, якщо потрібно
    const filteredReferrals = onlyActive
      ? referralsWithEarnings.filter(ref => ref.active)
      : referralsWithEarnings;

    // Сортуємо за вибраним критерієм
    let sortedReferrals;
    switch (sortBy) {
      case 'invites':
        sortedReferrals = sortByInvitedCount(filteredReferrals);
        break;
      case 'draws':
        sortedReferrals = sortByDrawsParticipation(filteredReferrals);
        break;
      case 'activity':
        sortedReferrals = filterAndSortReferrals(filteredReferrals, {}, { by: 'activity' });
        break;
      case 'earnings':
      default:
        sortedReferrals = sortReferralsByEarnings(filteredReferrals);
        break;
    }

    // Додаємо ранг
    return sortedReferrals.map((referral, index) => ({
      ...referral,
      rank: index + 1
    }));
  } catch (error) {
    console.error('Error in getReferralRanking:', error);
    throw new Error('Failed to get referral ranking');
  }
};

/**
 * Отримує топ-N рефералів за заробітком
 *
 * @param {string} userId - ID користувача, для якого формуємо рейтинг
 * @param {Array} referrals - Масив рефералів користувача
 * @param {number} [limit=10] - Кількість рефералів для включення в топ
 * @param {Object} [options] - Додаткові опції
 * @returns {Promise<Array>} Масив топ-N рефералів
 */
export const getTopReferrals = async (userId, referrals, limit = 10, options = {}) => {
  const rankedReferrals = await getReferralRanking(userId, referrals, options);
  return rankedReferrals.slice(0, limit);
};

/**
 * Знаходить позицію користувача в загальному рейтингу
 *
 * @param {string} userId - ID користувача, позицію якого шукаємо
 * @param {Array} allUsersReferrals - Масив рефералів усіх користувачів
 * @param {Object} [options] - Додаткові опції
 * @returns {Promise<Object>} Об'єкт з позицією користувача та загальною кількістю користувачів
 */
export const findUserRankPosition = async (userId, allUsersReferrals, options = {}) => {
  if (!userId || !Array.isArray(allUsersReferrals)) {
    throw new Error('Invalid parameters provided to findUserRankPosition');
  }

  try {
    // Сортуємо всіх користувачів
    const rankedUsers = await getReferralRanking('admin', allUsersReferrals, options);

    // Шукаємо позицію нашого користувача
    const userPosition = rankedUsers.findIndex(user => user.id === userId);

    return {
      position: userPosition !== -1 ? userPosition + 1 : null,
      totalUsers: rankedUsers.length,
      percentile: userPosition !== -1
        ? Math.round((1 - userPosition / rankedUsers.length) * 100)
        : null
    };
  } catch (error) {
    console.error('Error in findUserRankPosition:', error);
    throw new Error('Failed to find user rank position');
  }
};

/**
 * Генерує дані для лідерської дошки рефералів
 *
 * @param {string} userId - ID поточного користувача
 * @param {Array} allReferrals - Масив рефералів усіх користувачів
 * @param {Object} [options] - Опції для генерації лідерської дошки
 * @param {number} [options.topCount=10] - Кількість користувачів у топі
 * @param {boolean} [options.includeUserPosition=true] - Включати позицію поточного користувача
 * @returns {Promise<Object>} Об'єкт з даними лідерської дошки
 */
export const generateLeaderboard = async (userId, allReferrals, options = {}) => {
  const {
    topCount = 10,
    includeUserPosition = true,
    sortBy = 'earnings'
  } = options;

  try {
    // Отримуємо топ користувачів
    const topUsers = await getTopReferrals('admin', allReferrals, topCount, { sortBy });

    // Визначаємо позицію поточного користувача
    let userPosition = null;
    if (includeUserPosition) {
      const rankInfo = await findUserRankPosition(userId, allReferrals, { sortBy });
      userPosition = rankInfo.position;
    }

    // Перевіряємо, чи є користувач у топі
    const isUserInTop = topUsers.some(user => user.id === userId);

    // Якщо користувач не в топі, але ми хочемо показати його позицію
    let userEntry = null;
    if (includeUserPosition && !isUserInTop && userPosition !== null) {
      // Знаходимо дані користувача
      const userReferral = allReferrals.find(ref => ref.id === userId);
      if (userReferral) {
        // Створюємо запис для користувача
        userEntry = {
          ...userReferral,
          rank: userPosition
        };
      }
    }

    return {
      topUsers,
      userPosition,
      userEntry,
      totalUsersCount: allReferrals.length
    };
  } catch (error) {
    console.error('Error in generateLeaderboard:', error);
    throw new Error('Failed to generate leaderboard');
  }
};