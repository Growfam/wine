/**
 * Сервіс для відстеження участі рефералів у розіграшах
 *
 * @module referral/services/trackDrawParticipation
 */

import { fetchReferralDraws, fetchDrawsParticipationStats, fetchMostActiveInDraws } from '../api/fetchReferralDraws';
import { MIN_DRAWS_PARTICIPATION } from '../constants/activityThresholds';

/**
 * Перевіряє, чи задовольняє реферал критерію участі в розіграшах для активності
 *
 * @param {string} referralId - ID реферала для перевірки
 * @returns {Promise<boolean>} True, якщо реферал задовольняє критерію участі в розіграшах
 */
export const checkDrawsParticipationCriteria = async (referralId) => {
  if (!referralId) {
    console.error('checkDrawsParticipationCriteria: referralId is required');
    return false;
  }

  try {
    // Отримуємо дані про участь реферала у розіграшах
    const drawsData = await fetchReferralDraws(referralId);

    // Перевіряємо, чи задовольняє критерію мінімальної кількості участі
    return drawsData.totalParticipation >= MIN_DRAWS_PARTICIPATION;
  } catch (error) {
    console.error('Error checking draws participation criteria:', error);
    return false;
  }
};

/**
 * Аналізує дані про участь рефералів у розіграшах та визначає найактивніших
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {Object} [options] - Опції аналізу
 * @param {boolean} [options.includeDetails=false] - Включати детальну інформацію про розіграші
 * @returns {Promise<Object>} Результати аналізу участі рефералів у розіграшах
 */
export const analyzeDrawsParticipation = async (ownerId, options = {}) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Отримуємо загальну статистику участі рефералів у розіграшах
    const stats = await fetchDrawsParticipationStats(ownerId);

    // Отримуємо список найактивніших рефералів
    const mostActive = await fetchMostActiveInDraws(ownerId, 5);

    // Обчислюємо середню кількість участі в розіграшах на одного реферала
    const averageParticipation = stats.referralsStats.length > 0
      ? stats.totalParticipationCount / stats.referralsStats.length
      : 0;

    // Обчислюємо відсоток рефералів, які відповідають критерію активності за розіграшами
    const meetsCriteria = stats.referralsStats.filter(
      stat => stat.participationCount >= MIN_DRAWS_PARTICIPATION
    );

    const percentMeetingCriteria = stats.referralsStats.length > 0
      ? (meetsCriteria.length / stats.referralsStats.length) * 100
      : 0;

    // Обчислюємо детальну статистику, якщо потрібно
    let detailedStats = {};
    if (options.includeDetails) {
      // Підраховуємо кількість рефералів за кількістю участі
      const participationDistribution = {};
      stats.referralsStats.forEach(stat => {
        const count = stat.participationCount;
        participationDistribution[count] = (participationDistribution[count] || 0) + 1;
      });

      // Знаходимо рефералів, близьких до виконання критерію
      const closeToMeetingCriteria = stats.referralsStats.filter(
        stat => stat.participationCount >= MIN_DRAWS_PARTICIPATION - 2 &&
                stat.participationCount < MIN_DRAWS_PARTICIPATION
      );

      detailedStats = {
        participationDistribution,
        closeToMeetingCriteria,
        lowParticipationCount: stats.referralsStats.filter(stat => stat.participationCount === 0).length,
        highWinRateReferrals: stats.referralsStats.filter(stat => stat.winRate > 50 && stat.participationCount > 0)
      };
    }

    return {
      totalDrawsCount: stats.totalDrawsCount,
      totalParticipationCount: stats.totalParticipationCount,
      totalWinCount: stats.totalWinCount,
      totalPrize: stats.totalPrize,
      averageParticipation,
      meetsCriteriaCount: meetsCriteria.length,
      percentMeetingCriteria,
      mostActiveReferrals: mostActive,
      winRate: stats.winRate,
      ...detailedStats
    };
  } catch (error) {
    console.error('Error analyzing draws participation:', error);
    throw new Error('Failed to analyze draws participation');
  }
};

/**
 * Надає рекомендації щодо покращення участі рефералів у розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @returns {Promise<Array>} Масив рекомендацій
 */
export const getDrawsParticipationRecommendations = async (ownerId) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Аналізуємо участь рефералів у розіграшах
    const analysis = await analyzeDrawsParticipation(ownerId, { includeDetails: true });

    // Формуємо рекомендації на основі аналізу
    const recommendations = [];

    // Рекомендація 1: Заохочення рефералів з нульовою участю
    if (analysis.lowParticipationCount > 0) {
      recommendations.push({
        title: 'Заохотьте неактивних рефералів',
        description: `У вас є ${analysis.lowParticipationCount} рефералів, які жодного разу не брали участь у розіграшах. Заохотьте їх приєднатися до розіграшів.`,
        priority: analysis.lowParticipationCount > 5 ? 'high-priority' : 'medium-priority'
      });
    }

    // Рекомендація 2: Заохочення рефералів, близьких до виконання критерію
    if (analysis.closeToMeetingCriteria && analysis.closeToMeetingCriteria.length > 0) {
      recommendations.push({
        title: 'Майже активні реферали',
        description: `${analysis.closeToMeetingCriteria.length} рефералів близькі до виконання критерію участі в розіграшах. Заохотьте їх брати участь ще в кількох розіграшах, щоб стати активними.`,
        priority: 'medium-priority'
      });
    }

    // Рекомендація 3: Збільшення загальної активності
    if (analysis.averageParticipation < MIN_DRAWS_PARTICIPATION) {
      recommendations.push({
        title: 'Збільшіть загальну активність',
        description: `Середня кількість участі в розіграшах на одного реферала (${analysis.averageParticipation.toFixed(1)}) нижче критерію активності (${MIN_DRAWS_PARTICIPATION}). Заохотьте рефералів частіше брати участь у розіграшах.`,
        priority: 'medium-priority'
      });
    }

    // Рекомендація 4: Використання успішних рефералів як приклад
    if (analysis.highWinRateReferrals && analysis.highWinRateReferrals.length > 0) {
      recommendations.push({
        title: 'Використовуйте успішних рефералів як приклад',
        description: `У вас є ${analysis.highWinRateReferrals.length} рефералів з високим відсотком виграшів. Розповідайте про їхні успіхи, щоб заохотити інших рефералів.`,
        priority: 'low-priority'
      });
    }

    // Рекомендація 5: Загальне поліпшення участі
    if (analysis.percentMeetingCriteria < 50) {
      recommendations.push({
        title: 'Покращіть загальну участь у розіграшах',
        description: `Тільки ${analysis.percentMeetingCriteria.toFixed(1)}% ваших рефералів відповідають критерію активності за участю в розіграшах. Проведіть заходи для підвищення цього показника.`,
        priority: 'high-priority'
      });
    }

    return recommendations;
  } catch (error) {
    console.error('Error getting draws participation recommendations:', error);
    throw new Error('Failed to get draws participation recommendations');
  }
};

/**
 * Отримує рейтинг рефералів за участю в розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @param {number} [limit=10] - Кількість рефералів для включення в рейтинг
 * @returns {Promise<Array>} Рейтинг рефералів за участю в розіграшах
 */
export const getReferralsByDrawsRanking = async (ownerId, limit = 10) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Отримуємо статистику участі рефералів у розіграшах
    const stats = await fetchDrawsParticipationStats(ownerId);

    // Сортуємо рефералів за кількістю участі (від найбільшої до найменшої)
    const sortedReferrals = [...stats.referralsStats].sort(
      (a, b) => b.participationCount - a.participationCount
    );

    // Формуємо рейтинг
    return sortedReferrals.slice(0, limit).map((referral, index) => ({
      rank: index + 1,
      referralId: referral.referralId,
      participationCount: referral.participationCount,
      winCount: referral.winCount,
      winRate: referral.winRate,
      totalPrize: referral.totalPrize,
      lastParticipationDate: referral.lastParticipationDate,
      meetsCriteria: referral.participationCount >= MIN_DRAWS_PARTICIPATION
    }));
  } catch (error) {
    console.error('Error getting referrals by draws ranking:', error);
    throw new Error('Failed to get referrals by draws ranking');
  }
};

/**
 * Отримує сумарну статистику участі рефералів у розіграшах
 *
 * @param {string} ownerId - ID власника рефералів
 * @returns {Promise<Object>} Сумарна статистика участі рефералів у розіграшах
 */
export const getDrawsParticipationSummary = async (ownerId) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    // Отримуємо статистику участі рефералів у розіграшах
    const stats = await fetchDrawsParticipationStats(ownerId);

    // Формуємо сумарну статистику
    return {
      totalDrawsCount: stats.totalDrawsCount,
      totalParticipationCount: stats.totalParticipationCount,
      totalWinCount: stats.totalWinCount,
      totalPrize: stats.totalPrize,
      winRate: stats.winRate,
      activeReferralsCount: stats.referralsStats.filter(
        stat => stat.participationCount >= MIN_DRAWS_PARTICIPATION
      ).length,
      totalReferralsCount: stats.referralsStats.length
    };
  } catch (error) {
    console.error('Error getting draws participation summary:', error);
    throw new Error('Failed to get draws participation summary');
  }
};