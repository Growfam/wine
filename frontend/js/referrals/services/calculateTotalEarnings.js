/**
 * Сервіс для розрахунку загального заробітку від реферальної програми
 * Інтегрує всі види винагород (прямі, рівневі, бейджі, завдання, розіграші)
 *
 * @module referral/services/calculateTotalEarnings
 */

import { fetchReferralHistory, fetchReferralActivitySummary } from '../api/fetchReferralHistory';
import { fetchDirectBonusHistory } from '../api/registerReferral';
import { fetchLevelRewards } from '../api/fetchReferralEarnings';
import { fetchUserBadges, fetchUserTasks } from '../store/badgeActions';
import { fetchReferralDraws } from '../api/fetchReferralDraws';
import { formatWinixAmount } from '../utils/formatWinixAmount';
import { DIRECT_BONUS_AMOUNT } from '../constants/directBonuses';

/**
 * Розраховує загальний заробіток від реферальної програми для користувача
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції розрахунку
 * @param {boolean} [options.includeDetails=false] - Включати деталізацію заробітку
 * @param {boolean} [options.useHistoryData=true] - Використовувати історичні дані
 * @returns {Promise<Object>} Результат розрахунку
 */
export const calculateTotalEarnings = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { includeDetails = false, useHistoryData = true } = options;

  try {
    let totalEarnings = 0;
    let earnings = {
      directBonuses: 0,
      percentageRewards: 0,
      badgeRewards: 0,
      taskRewards: 0,
      drawsRewards: 0
    };
    let details = {};

    // Отримуємо дані залежно від налаштувань
    if (useHistoryData) {
      // Використовуємо дані з історії для швидкого розрахунку
      const summary = await fetchReferralActivitySummary(userId);

      totalEarnings = summary.totalEarnings;
      earnings = {
        directBonuses: summary.directBonusEarned,
        percentageRewards: summary.percentageRewardsEarned,
        badgeRewards: summary.badgesEarned > 0 ? summary.badgesEarned * 1000 : 0, // Приблизно
        taskRewards: summary.tasksCompleted > 0 ? summary.tasksCompleted * 1000 : 0, // Приблизно
        drawsRewards: summary.drawsWon > 0 ? summary.drawsWon * 500 : 0 // Приблизно
      };

      if (includeDetails) {
        details = {
          referralsRegistered: summary.referralsRegistered,
          badgesEarned: summary.badgesEarned,
          tasksCompleted: summary.tasksCompleted,
          drawsParticipated: summary.drawsParticipated,
          drawsWon: summary.drawsWon,
          eventsByType: summary.eventsByType,
          eventsByDate: summary.eventsByDate
        };
      }
    } else {
      // Отримуємо дані з різних джерел для точного розрахунку
      // 1. Прямі бонуси
      const bonusHistory = await fetchDirectBonusHistory(userId);
      earnings.directBonuses = bonusHistory.reduce((total, item) => total + (item.bonusAmount || 0), 0);

      // 2. Відсоткові винагороди
      const levelRewards = await fetchLevelRewards(userId);
      earnings.percentageRewards = (levelRewards.level1Rewards?.totalReward || 0) +
                                 (levelRewards.level2Rewards?.totalReward || 0);

      // 3. Бейджі
      const badgesData = await fetchUserBadges(userId);
      earnings.badgeRewards = badgesData.earnedBadgesReward || 0;

      // 4. Завдання
      const tasksData = await fetchUserTasks(userId);
      earnings.taskRewards = tasksData.totalTasksReward || 0;

      // 5. Розіграші
      const drawsData = await fetchReferralDraws(userId);
      earnings.drawsRewards = drawsData.winCount > 0 ?
                            drawsData.draws.filter(draw => draw.isWon).reduce((total, draw) => total + (draw.prize || 0), 0) : 0;

      // Загальний заробіток
      totalEarnings = Object.values(earnings).reduce((total, value) => total + value, 0);

      // Додаткові дані, якщо потрібно
      if (includeDetails) {
        details = {
          referralsRegistered: (bonusHistory.length || 0),
          badgesEarned: badgesData.earnedBadges?.length || 0,
          tasksCompleted: tasksData.completedTasks?.length || 0,
          drawsParticipated: drawsData.totalParticipation || 0,
          drawsWon: drawsData.winCount || 0
        };
      }
    }

    // Розраховуємо відсотки від загального заробітку для кожного типу
    const percentages = {};
    if (totalEarnings > 0) {
      Object.keys(earnings).forEach(key => {
        percentages[key] = (earnings[key] / totalEarnings) * 100;
      });
    }

    // Формуємо результат
    const result = {
      totalEarnings,
      formattedTotal: formatWinixAmount(totalEarnings, { showCurrency: true }),
      earnings,
      percentages
    };

    // Додаємо деталі, якщо потрібно
    if (includeDetails) {
      result.details = details;
    }

    return result;
  } catch (error) {
    console.error('Error calculating total earnings:', error);
    throw new Error('Failed to calculate total earnings');
  }
};

/**
 * Прогнозує майбутній заробіток від реферальної програми
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції прогнозування
 * @param {number} [options.months=12] - Кількість місяців для прогнозу
 * @param {number} [options.growthRate=0.1] - Прогнозований темп зростання (10% за замовчуванням)
 * @returns {Promise<Object>} Прогноз заробітку
 */
export const predictFutureEarnings = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { months = 12, growthRate = 0.1 } = options;

  try {
    // Отримуємо поточний заробіток
    const currentEarnings = await calculateTotalEarnings(userId);

    // Отримуємо історичні дані для аналізу тренду
    const activityTrend = await fetchReferralActivityTrend(userId, 'monthly');

    // Визначаємо середньомісячний заробіток на основі історичних даних
    let monthlyAverage = 0;
    if (activityTrend.length > 0) {
      const totalMonthlyEarnings = activityTrend.reduce((sum, month) => sum + (month.totalEarnings || 0), 0);
      monthlyAverage = totalMonthlyEarnings / activityTrend.length;
    } else {
      // Якщо немає історичних даних, беремо поточний заробіток і ділимо на активний період (приблизно)
      monthlyAverage = currentEarnings.totalEarnings / 6; // Припускаємо 6 місяців активності
    }

    // Зі збільшенням періоду збільшується і похибка прогнозу
    const accuracyFactor = Math.max(0.5, 1 - (months / 24)); // Від 0.5 до 1.0

    // Прогнозуємо заробіток на кожен майбутній місяць
    const predictions = [];
    let cumulativeEarnings = 0;

    for (let i = 1; i <= months; i++) {
      // Для кожного місяця застосовуємо темп зростання
      const monthGrowth = 1 + (growthRate * i / 12); // Зростання з часом
      const predictedMonthlyEarnings = monthlyAverage * monthGrowth * accuracyFactor;

      cumulativeEarnings += predictedMonthlyEarnings;

      predictions.push({
        month: i,
        monthlyEarnings: predictedMonthlyEarnings,
        cumulativeEarnings
      });
    }

    // Формуємо результат
    return {
      currentMonthlyAverage: monthlyAverage,
      predictions,
      totalPredictedEarnings: cumulativeEarnings,
      formattedTotalPredicted: formatWinixAmount(cumulativeEarnings, { showCurrency: true }),
      accuracyEstimate: accuracyFactor * 100 // у відсотках
    };
  } catch (error) {
    console.error('Error predicting future earnings:', error);
    throw new Error('Failed to predict future earnings');
  }
};

/**
 * Розраховує рентабельність реферальної програми
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції розрахунку
 * @param {number} [options.timeInvestment] - Витрачений час у годинах
 * @param {number} [options.avgHourlyRate] - Середня вартість години
 * @returns {Promise<Object>} Аналіз рентабельності
 */
export const calculateReferralROI = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { timeInvestment = 0, avgHourlyRate = 10 } = options;

  try {
    // Отримуємо поточний заробіток
    const earningsData = await calculateTotalEarnings(userId, { includeDetails: true });

    // Отримуємо історичні дані
    const summary = await fetchReferralActivitySummary(userId);

    // Розраховуємо витрати (якщо вказано час)
    let costs = 0;
    if (timeInvestment > 0 && avgHourlyRate > 0) {
      costs = timeInvestment * avgHourlyRate;
    }

    // Розраховуємо ROI (якщо є витрати)
    let roi = 0;
    if (costs > 0) {
      roi = ((earningsData.totalEarnings - costs) / costs) * 100;
    }

    // Розраховуємо додаткові метрики
    const referralsCount = earningsData.details?.referralsRegistered || 0;
    const earningsPerReferral = referralsCount > 0 ? earningsData.totalEarnings / referralsCount : 0;

    // Розраховуємо годинний заробіток (якщо вказано час)
    let hourlyEarnings = 0;
    if (timeInvestment > 0) {
      hourlyEarnings = earningsData.totalEarnings / timeInvestment;
    }

    // Формуємо результат
    return {
      totalEarnings: earningsData.totalEarnings,
      costs,
      roi,
      earningsPerReferral,
      hourlyEarnings,
      timeInvestment,
      avgHourlyRate,
      formattedEarningsPerReferral: formatWinixAmount(earningsPerReferral, { showCurrency: true }),
      formattedHourlyEarnings: formatWinixAmount(hourlyEarnings, { showCurrency: true }),
      formattedROI: `${roi.toFixed(2)}%`,
      profitability: roi > 0 ? 'profitable' : 'unprofitable'
    };
  } catch (error) {
    console.error('Error calculating referral ROI:', error);
    throw new Error('Failed to calculate referral ROI');
  }
};

/**
 * Аналізує розподіл заробітку за категоріями та періодами
 *
 * @param {string} userId - ID користувача
 * @param {Object} [options] - Опції аналізу
 * @param {string} [options.period='monthly'] - Період аналізу ('daily', 'weekly', 'monthly')
 * @returns {Promise<Object>} Аналіз розподілу заробітку
 */
export const analyzeEarningsDistribution = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { period = 'monthly' } = options;

  try {
    // Отримуємо загальний заробіток
    const totalEarningsData = await calculateTotalEarnings(userId, { includeDetails: true });

    // Отримуємо тренд активності
    const activityTrend = await fetchReferralActivityTrend(userId, period);

    // Формуємо дані для графіків

    // 1. Розподіл за категоріями
    const categoryDistribution = {
      labels: Object.keys(totalEarningsData.earnings).map(key => {
        // Перетворюємо camelCase на User-friendly назви
        switch (key) {
          case 'directBonuses': return 'Прямі бонуси';
          case 'percentageRewards': return 'Відсоткові винагороди';
          case 'badgeRewards': return 'Бейджі';
          case 'taskRewards': return 'Завдання';
          case 'drawsRewards': return 'Розіграші';
          default: return key;
        }
      }),
      data: Object.values(totalEarningsData.earnings),
      percentages: Object.values(totalEarningsData.percentages).map(val => parseFloat(val.toFixed(1)))
    };

    // 2. Тренд за періодами
    const trendData = {
      labels: activityTrend.map(item => item.period),
      series: {
        totalEarnings: activityTrend.map(item => item.totalEarnings),
        directBonuses: activityTrend.map(item => item.directBonusEarned),
        percentageRewards: activityTrend.map(item => item.percentageRewardsEarned)
      }
    };

    // 3. Кількість запрошених рефералів за періодами
    const referralsTrend = {
      labels: activityTrend.map(item => item.period),
      data: activityTrend.map(item => item.referralsRegistered)
    };

    // Формуємо результат
    return {
      totalEarnings: totalEarningsData.totalEarnings,
      formattedTotal: totalEarningsData.formattedTotal,
      categoryDistribution,
      trendData,
      referralsTrend,
      periods: activityTrend
    };
  } catch (error) {
    console.error('Error analyzing earnings distribution:', error);
    throw new Error('Failed to analyze earnings distribution');
  }
};