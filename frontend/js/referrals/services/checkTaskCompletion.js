/**
 * Сервіс перевірки виконання завдань у реферальній системі
 *
 * Перевіряє, чи виконав користувач поставлені завдання
 * по залученню рефералів і розраховує відповідні винагороди
 *
 * @module checkTaskCompletion
 */

import { TASK_THRESHOLDS, TASK_TYPES } from '../constants/taskThresholds';
import { fetchReferralStats } from '../api/fetchReferralStats';
import { fetchReferralActivity } from '../api/fetchReferralActivity';

/**
 * Перевіряє, чи виконав користувач конкретне завдання
 * @param {string} taskType - Тип завдання (ключ з TASK_TYPES)
 * @param {Object} statsData - Дані зі статистикою користувача
 * @returns {boolean} Чи виконано завдання
 */
export const isTaskCompleted = (taskType, statsData) => {
  if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
    return false;
  }

  const { threshold } = TASK_THRESHOLDS[taskType];

  // Перевірка різних типів завдань
  switch (taskType) {
    case 'REFERRAL_COUNT':
      return statsData.totalReferralsCount >= threshold;

    case 'ACTIVE_REFERRALS':
      return statsData.activeReferralsCount >= threshold;

    default:
      return false;
  }
};

/**
 * Розраховує прогрес виконання завдання
 * @param {string} taskType - Тип завдання
 * @param {Object} statsData - Дані зі статистикою користувача
 * @returns {Object} Об'єкт з інформацією про прогрес
 */
export const calculateTaskProgress = (taskType, statsData) => {
  if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
    return {
      completed: false,
      progress: 0,
      current: 0,
      threshold: 0,
      remaining: 0
    };
  }

  const { threshold } = TASK_THRESHOLDS[taskType];
  let current = 0;

  // Визначення поточного значення для різних типів завдань
  switch (taskType) {
    case 'REFERRAL_COUNT':
      current = statsData.totalReferralsCount || 0;
      break;

    case 'ACTIVE_REFERRALS':
      current = statsData.activeReferralsCount || 0;
      break;

    default:
      current = 0;
  }

  const remaining = Math.max(0, threshold - current);
  const progress = Math.min(100, (current / threshold) * 100);
  const completed = current >= threshold;

  return {
    completed,
    progress,
    current,
    threshold,
    remaining
  };
};

/**
 * Розраховує винагороду за виконане завдання
 * @param {string} taskType - Тип завдання
 * @returns {number} Кількість winix винагороди
 */
export const calculateTaskReward = (taskType) => {
  if (!taskType || !TASK_THRESHOLDS[taskType]) {
    return 0;
  }

  return TASK_THRESHOLDS[taskType].reward;
};

/**
 * Отримує список всіх виконаних завдань
 * @param {Object} statsData - Дані зі статистикою користувача
 * @returns {Array<string>} Масив типів виконаних завдань
 */
export const getCompletedTasks = (statsData) => {
  if (!statsData) {
    return [];
  }

  return TASK_TYPES.filter(taskType => isTaskCompleted(taskType, statsData));
};

/**
 * Розраховує загальну винагороду за всі виконані завдання
 * @param {Object} statsData - Дані зі статистикою користувача
 * @returns {number} Загальна сума винагороди
 */
export const calculateTotalTasksReward = (statsData) => {
  const completedTasks = getCompletedTasks(statsData);

  return completedTasks.reduce((total, taskType) => {
    return total + calculateTaskReward(taskType);
  }, 0);
};

/**
 * Перевіряє виконання всіх завдань користувачем
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Промис з результатами перевірки
 */
export const checkAllTasksCompletion = async (userId) => {
  try {
    // Отримуємо статистику рефералів користувача
    const statsData = await fetchReferralStats(userId);

    // Отримуємо дані про активність рефералів
    const activityData = await fetchReferralActivity(userId);

    // Формуємо повні дані для перевірки завдань
    const fullStatsData = {
      ...statsData.statistics,
      activeReferralsCount: activityData.summary.active || 0
    };

    // Отримуємо список виконаних завдань
    const completedTasks = getCompletedTasks(fullStatsData);

    // Прогрес по кожному завданню
    const tasksProgress = {};
    TASK_TYPES.forEach(taskType => {
      tasksProgress[taskType] = calculateTaskProgress(taskType, fullStatsData);
    });

    // Розраховуємо загальну винагороду
    const totalReward = calculateTotalTasksReward(fullStatsData);

    // Формуємо результат
    return {
      userId,
      completedTasks,
      allTasks: TASK_TYPES,
      completedTasksCount: completedTasks.length,
      totalTasksCount: TASK_TYPES.length,
      completionPercentage: (completedTasks.length / TASK_TYPES.length) * 100,
      tasksProgress,
      totalReward
    };
  } catch (error) {
    console.error('Error checking tasks completion:', error);
    throw new Error(`Не вдалося перевірити виконання завдань: ${error.message}`);
  }
};

/**
 * Перевіряє прогрес виконання конкретного завдання користувачем
 * @param {string|number} userId - ID користувача
 * @param {string} taskType - Тип завдання
 * @returns {Promise<Object>} Промис з результатами перевірки
 */
export const checkTaskProgress = async (userId, taskType) => {
  try {
    // Отримуємо статистику рефералів користувача
    const statsData = await fetchReferralStats(userId);

    // Отримуємо дані про активність рефералів
    const activityData = await fetchReferralActivity(userId);

    // Формуємо повні дані для перевірки завдань
    const fullStatsData = {
      ...statsData.statistics,
      activeReferralsCount: activityData.summary.active || 0
    };

    // Перевіряємо прогрес завдання
    const progress = calculateTaskProgress(taskType, fullStatsData);

    // Отримуємо інформацію про завдання
    const taskInfo = TASK_THRESHOLDS[taskType] || null;

    // Формуємо результат
    return {
      userId,
      taskType,
      taskInfo,
      progress,
      reward: taskInfo ? taskInfo.reward : 0
    };
  } catch (error) {
    console.error(`Error checking task progress for ${taskType}:`, error);
    throw new Error(`Не вдалося перевірити прогрес завдання: ${error.message}`);
  }
};

export default {
  isTaskCompleted,
  calculateTaskProgress,
  calculateTaskReward,
  getCompletedTasks,
  calculateTotalTasksReward,
  checkAllTasksCompletion,
  checkTaskProgress
};