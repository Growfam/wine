// services.js - Традиційна версія без ES6 модулів
/**
 * Сервісні функції для реферальної системи
 */
window.ReferralServices = (function() {
  'use strict';

  // calculateDirectBonus.js
  function calculateDirectBonus(count, customAmount) {
    count = count || 1;
    if (typeof count !== 'number' || isNaN(count) || count < 0) {
      throw new Error('Count must be a positive number');
    }

    const referralCount = Math.floor(count);
    const bonusAmount = customAmount !== undefined
      ? customAmount
      : window.ReferralConstants.DIRECT_BONUS_AMOUNT;

    if (typeof bonusAmount !== 'number' || isNaN(bonusAmount) || bonusAmount < 0) {
      throw new Error('Bonus amount must be a positive number');
    }

    return referralCount * bonusAmount;
  }

  function calculatePotentialDirectBonus(params) {
    params = params || {};
    const amount = params.bonusAmount || window.ReferralConstants.DIRECT_BONUS_AMOUNT;
    const count = Math.max(0, params.referralsCount || 0);

    return {
      totalBonus: count * amount,
      perReferral: amount,
      count: count
    };
  }

  // calculateLevel1Count.js
  function calculateLevel1Count(referrals, options) {
    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      return 0;
    }

    const activeOnly = options.activeOnly || false;
    const fromDate = options.fromDate || null;
    const toDate = options.toDate || null;

    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const filteredReferrals = referrals.filter(function(referral) {
      if (activeOnly && !referral.active) {
        return false;
      }

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

    return filteredReferrals.length;
  }

  function analyzeLevel1Growth(referrals, periodDays) {
    periodDays = periodDays || 30;
    if (!referrals || !Array.isArray(referrals)) {
      return {
        totalCount: 0,
        growthRate: 0,
        periodGrowth: 0,
        averageDaily: 0
      };
    }

    const sortedReferrals = referrals.slice().sort(function(a, b) {
      const dateA = new Date(a.registrationDate || 0);
      const dateB = new Date(b.registrationDate || 0);
      return dateA - dateB;
    });

    const totalCount = sortedReferrals.length;

    const currentDate = new Date();
    const periodStartDate = new Date();
    periodStartDate.setDate(currentDate.getDate() - periodDays);

    const periodReferrals = sortedReferrals.filter(function(referral) {
      const regDate = new Date(referral.registrationDate || 0);
      return regDate >= periodStartDate;
    });

    const periodCount = periodReferrals.length;
    const averageDaily = periodCount / periodDays;

    const previousPeriodStartDate = new Date();
    previousPeriodStartDate.setDate(periodStartDate.getDate() - periodDays);

    const previousPeriodReferrals = sortedReferrals.filter(function(referral) {
      const regDate = new Date(referral.registrationDate || 0);
      return regDate >= previousPeriodStartDate && regDate < periodStartDate;
    });

    const previousPeriodCount = previousPeriodReferrals.length;
    const periodGrowth = periodCount - previousPeriodCount;

    const growthRate = previousPeriodCount > 0
      ? ((periodCount - previousPeriodCount) / previousPeriodCount) * 100
      : (periodCount > 0 ? 100 : 0);

    return {
      totalCount: totalCount,
      periodCount: periodCount,
      previousPeriodCount: previousPeriodCount,
      periodGrowth: periodGrowth,
      growthRate: growthRate,
      averageDaily: averageDaily
    };
  }

  // calculateLevel1Reward.js
  function calculateLevel1Reward(referrals, options) {
    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      return {
        totalReward: 0,
        rewardRate: window.ReferralConstants.LEVEL_1_REWARD_RATE,
        totalEarnings: 0,
        referralsCount: 0,
        activeReferralsCount: 0,
        referralRewards: []
      };
    }

    const activeOnly = options.activeOnly !== false;
    const rewardRate = options.customRate !== undefined
      ? options.customRate
      : window.ReferralConstants.LEVEL_1_REWARD_RATE;

    const filteredReferrals = activeOnly
      ? referrals.filter(function(ref) { return ref.active; })
      : referrals;

    const referralRewards = filteredReferrals.map(function(referral) {
      const earnings = referral.totalEarnings || 0;
      const reward = earnings * rewardRate;

      return {
        referralId: referral.id,
        earnings: earnings,
        reward: reward,
        rate: rewardRate
      };
    });

    const totalEarnings = referralRewards.reduce(function(sum, item) {
      return sum + item.earnings;
    }, 0);

    const totalReward = referralRewards.reduce(function(sum, item) {
      return sum + item.reward;
    }, 0);

    return {
      totalReward: totalReward,
      rewardRate: rewardRate,
      totalEarnings: totalEarnings,
      referralsCount: referrals.length,
      activeReferralsCount: filteredReferrals.length,
      referralRewards: referralRewards
    };
  }

  function calculatePotentialLevel1Reward(totalEarnings, customRate) {
    if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
      return 0;
    }

    const rewardRate = customRate !== undefined
      ? customRate
      : window.ReferralConstants.LEVEL_1_REWARD_RATE;
    return totalEarnings * rewardRate;
  }

  // calculateLevel2Count.js
  function calculateLevel2Count(referrals, options) {
    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      return 0;
    }

    const activeOnly = options.activeOnly || false;
    const fromDate = options.fromDate || null;
    const toDate = options.toDate || null;
    const byReferrerId = options.byReferrerId || null;

    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const filteredReferrals = referrals.filter(function(referral) {
      if (activeOnly && !referral.active) {
        return false;
      }

      if (byReferrerId) {
        if (Array.isArray(byReferrerId)) {
          if (byReferrerId.indexOf(referral.referrerId) === -1) {
            return false;
          }
        } else if (referral.referrerId !== byReferrerId) {
          return false;
        }
      }

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

    return filteredReferrals.length;
  }

  function groupLevel2ByReferrers(level2Referrals, level1Referrals) {
    level1Referrals = level1Referrals || [];
    if (!level2Referrals || !Array.isArray(level2Referrals)) {
      return {};
    }

    const level1Map = {};
    if (level1Referrals && Array.isArray(level1Referrals)) {
      level1Referrals.forEach(function(referral) {
        level1Map[referral.id] = referral;
      });
    }

    const groupedReferrals = {};

    level2Referrals.forEach(function(referral) {
      const referrerId = referral.referrerId;

      if (!referrerId) return;

      if (!groupedReferrals[referrerId]) {
        groupedReferrals[referrerId] = {
          referrerId: referrerId,
          referrerInfo: level1Map[referrerId] || null,
          referrals: []
        };
      }

      groupedReferrals[referrerId].referrals.push(referral);
    });

    Object.keys(groupedReferrals).forEach(function(referrerId) {
      const group = groupedReferrals[referrerId];
      const referrals = group.referrals;

      group.totalCount = referrals.length;
      group.activeCount = referrals.filter(function(r) { return r.active; }).length;
      group.inactiveCount = group.totalCount - group.activeCount;
    });

    return groupedReferrals;
  }

  function analyzeLevel1Effectiveness(level2Referrals, level1Referrals) {
    if (!level2Referrals || !Array.isArray(level2Referrals) ||
        !level1Referrals || !Array.isArray(level1Referrals)) {
      return [];
    }

    const groupedReferrals = groupLevel2ByReferrers(level2Referrals, level1Referrals);

    const effectiveness = level1Referrals.map(function(referral) {
      const id = referral.id;
      const group = groupedReferrals[id] || { totalCount: 0, activeCount: 0, inactiveCount: 0 };

      const referralCount = group.totalCount || 0;
      const conversionRate = referralCount > 0
        ? (group.activeCount / referralCount)
        : 0;

      return {
        id: id,
        registrationDate: referral.registrationDate,
        active: referral.active,
        referralCount: referralCount,
        activeReferrals: group.activeCount || 0,
        inactiveReferrals: group.inactiveCount || 0,
        conversionRate: conversionRate
      };
    });

    return effectiveness.sort(function(a, b) {
      return b.referralCount - a.referralCount;
    });
  }

  // calculateLevel2Reward.js
  function calculateLevel2Reward(referrals, options) {
    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      return {
        totalReward: 0,
        rewardRate: window.ReferralConstants.LEVEL_2_REWARD_RATE,
        totalEarnings: 0,
        referralsCount: 0,
        activeReferralsCount: 0,
        referralRewards: [],
        groupedRewards: {}
      };
    }

    const activeOnly = options.activeOnly !== false;
    const groupByReferrers = options.groupByReferrers || false;
    const rewardRate = options.customRate !== undefined
      ? options.customRate
      : window.ReferralConstants.LEVEL_2_REWARD_RATE;

    const filteredReferrals = activeOnly
      ? referrals.filter(function(ref) { return ref.active; })
      : referrals;

    const referralRewards = filteredReferrals.map(function(referral) {
      const earnings = referral.totalEarnings || 0;
      const reward = earnings * rewardRate;

      return {
        referralId: referral.id,
        referrerId: referral.referrerId,
        earnings: earnings,
        reward: reward,
        rate: rewardRate
      };
    });

    const totalEarnings = referralRewards.reduce(function(sum, item) {
      return sum + item.earnings;
    }, 0);

    const totalReward = referralRewards.reduce(function(sum, item) {
      return sum + item.reward;
    }, 0);

    let groupedRewards = {};

    if (groupByReferrers) {
      referralRewards.forEach(function(reward) {
        const referrerId = reward.referrerId;

        if (!groupedRewards[referrerId]) {
          groupedRewards[referrerId] = {
            referrerId: referrerId,
            totalEarnings: 0,
            totalReward: 0,
            referralsCount: 0,
            rewards: []
          };
        }

        groupedRewards[referrerId].totalEarnings += reward.earnings;
        groupedRewards[referrerId].totalReward += reward.reward;
        groupedRewards[referrerId].referralsCount += 1;
        groupedRewards[referrerId].rewards.push(reward);
      });
    }

    return {
      totalReward: totalReward,
      rewardRate: rewardRate,
      totalEarnings: totalEarnings,
      referralsCount: referrals.length,
      activeReferralsCount: filteredReferrals.length,
      referralRewards: referralRewards,
      groupedRewards: groupedRewards
    };
  }

  function calculatePotentialLevel2Reward(totalEarnings, customRate) {
    if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
      return 0;
    }

    const rewardRate = customRate !== undefined
      ? customRate
      : window.ReferralConstants.LEVEL_2_REWARD_RATE;
    return totalEarnings * rewardRate;
  }

  function calculateCombinedLevel2Reward(level1Referrals, level2Referrals, options) {
    options = options || {};
    if (!level1Referrals || !Array.isArray(level1Referrals) ||
        !level2Referrals || !Array.isArray(level2Referrals)) {
      return {
        totalReward: 0,
        level1ReferralsWithLevel2: [],
        combinedRewards: []
      };
    }

    const level1Map = level1Referrals.reduce(function(map, ref) {
      map[ref.id] = ref;
      return map;
    }, {});

    const level2Options = Object.assign({}, options, { groupByReferrers: true });
    const level2Rewards = calculateLevel2Reward(level2Referrals, level2Options);

    const level1ReferralsWithLevel2 = [];

    const combinedRewards = Object.keys(level2Rewards.groupedRewards).map(function(referrerId) {
      const groupData = level2Rewards.groupedRewards[referrerId];
      const level1Data = level1Map[referrerId] || { id: referrerId, active: false };

      level1ReferralsWithLevel2.push(level1Data);

      return {
        referrer: level1Data,
        totalEarnings: groupData.totalEarnings,
        totalReward: groupData.totalReward,
        referralsCount: groupData.referralsCount,
        detailedRewards: groupData.rewards
      };
    });

    return {
      totalReward: level2Rewards.totalReward,
      level1ReferralsWithLevel2: level1ReferralsWithLevel2,
      combinedRewards: combinedRewards
    };
  }

  // checkBadgeEligibility.js
  function isEligibleForBadge(badgeType, referralsCount) {
    const BADGE_THRESHOLDS = window.ReferralConstants.BADGE_THRESHOLDS;

    if (!badgeType || !BADGE_THRESHOLDS[badgeType]) {
      return false;
    }

    return referralsCount >= BADGE_THRESHOLDS[badgeType];
  }

  function getHighestEligibleBadge(referralsCount) {
    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;

    for (let i = BADGE_TYPES.length - 1; i >= 0; i--) {
      const badgeType = BADGE_TYPES[i];
      if (isEligibleForBadge(badgeType, referralsCount)) {
        return badgeType;
      }
    }

    return null;
  }

  function getAllEligibleBadges(referralsCount) {
    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;
    return BADGE_TYPES.filter(function(badgeType) {
      return isEligibleForBadge(badgeType, referralsCount);
    });
  }

  function getNextBadgeTarget(referralsCount) {
    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;
    const BADGE_THRESHOLDS = window.ReferralConstants.BADGE_THRESHOLDS;

    for (let i = 0; i < BADGE_TYPES.length; i++) {
      const badgeType = BADGE_TYPES[i];
      if (!isEligibleForBadge(badgeType, referralsCount)) {
        const threshold = BADGE_THRESHOLDS[badgeType];
        const remaining = threshold - referralsCount;

        return {
          type: badgeType,
          threshold: threshold,
          remaining: remaining,
          progress: (referralsCount / threshold) * 100
        };
      }
    }

    return null;
  }

  function checkBadgesProgress(referralsCount) {
    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;
    const BADGE_THRESHOLDS = window.ReferralConstants.BADGE_THRESHOLDS;

    const eligibleBadges = getAllEligibleBadges(referralsCount);
    const nextBadge = getNextBadgeTarget(referralsCount);

    return {
      currentReferralsCount: referralsCount,
      eligibleBadges: eligibleBadges,
      earnedBadgesCount: eligibleBadges.length,
      nextBadge: nextBadge,
      hasAllBadges: eligibleBadges.length === BADGE_TYPES.length,
      badgeProgress: BADGE_TYPES.map(function(badgeType) {
        const threshold = BADGE_THRESHOLDS[badgeType];
        const isEligible = referralsCount >= threshold;
        const progress = Math.min(100, (referralsCount / threshold) * 100);

        return {
          type: badgeType,
          threshold: threshold,
          isEligible: isEligible,
          progress: progress
        };
      })
    };
  }

  // checkTaskCompletion.js
  function isTaskCompleted(taskType, statsData) {
    const TASK_THRESHOLDS = window.ReferralConstants.TASK_THRESHOLDS;

    if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
      return false;
    }

    const threshold = TASK_THRESHOLDS[taskType].threshold;

    switch (taskType) {
      case 'REFERRAL_COUNT':
        return statsData.totalReferralsCount >= threshold;

      case 'ACTIVE_REFERRALS':
        return statsData.activeReferralsCount >= threshold;

      default:
        return false;
    }
  }

  function calculateTaskProgress(taskType, statsData) {
    const TASK_THRESHOLDS = window.ReferralConstants.TASK_THRESHOLDS;

    if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
      return {
        completed: false,
        progress: 0,
        current: 0,
        threshold: 0,
        remaining: 0
      };
    }

    const threshold = TASK_THRESHOLDS[taskType].threshold;
    let current = 0;

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
      completed: completed,
      progress: progress,
      current: current,
      threshold: threshold,
      remaining: remaining
    };
  }

  function calculateTaskReward(taskType) {
    const TASK_THRESHOLDS = window.ReferralConstants.TASK_THRESHOLDS;

    if (!taskType || !TASK_THRESHOLDS[taskType]) {
      return 0;
    }

    return TASK_THRESHOLDS[taskType].reward;
  }

  function getCompletedTasks(statsData) {
    const TASK_TYPES = window.ReferralConstants.TASK_TYPES;

    if (!statsData) {
      return [];
    }

    return TASK_TYPES.filter(function(taskType) {
      return isTaskCompleted(taskType, statsData);
    });
  }

  function calculateTotalTasksReward(statsData) {
    const completedTasks = getCompletedTasks(statsData);

    return completedTasks.reduce(function(total, taskType) {
      return total + calculateTaskReward(taskType);
    }, 0);
  }

  // convertBadgeToWinix.js
  function convertBadgeToWinix(badgeType) {
    const BADGE_REWARDS = window.ReferralConstants.BADGE_REWARDS;
    return BADGE_REWARDS[badgeType] || 0;
  }

  function calculateTotalBadgeReward(badgeTypes) {
    if (!badgeTypes || !Array.isArray(badgeTypes)) {
      return 0;
    }

    return badgeTypes.reduce(function(total, badgeType) {
      return total + convertBadgeToWinix(badgeType);
    }, 0);
  }

  function calculateEligibleBadgesReward(referralsCount) {
    const eligibleBadges = getAllEligibleBadges(referralsCount);
    const totalReward = calculateTotalBadgeReward(eligibleBadges);

    const badgeRewards = eligibleBadges.map(function(badgeType) {
      return {
        type: badgeType,
        reward: convertBadgeToWinix(badgeType)
      };
    });

    return {
      eligibleBadges: eligibleBadges,
      badgeRewards: badgeRewards,
      totalReward: totalReward
    };
  }

  function getTotalPotentialBadgeRewards() {
    const BADGE_REWARDS = window.ReferralConstants.BADGE_REWARDS;

    const allBadgeTypes = Object.keys(BADGE_REWARDS);
    const totalPotentialReward = calculateTotalBadgeReward(allBadgeTypes);

    const allBadgeRewards = allBadgeTypes.map(function(badgeType) {
      return {
        type: badgeType,
        reward: convertBadgeToWinix(badgeType)
      };
    });

    return {
      allBadgeTypes: allBadgeTypes,
      allBadgeRewards: allBadgeRewards,
      totalPotentialReward: totalPotentialReward
    };
  }

  // fetchLevelRewards.js (основна сервісна функція)
  function fetchLevelRewards(userId, options) {
    options = options || {};

    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання даних про винагороди');
    }

    return new Promise(function(resolve, reject) {
      Promise.all([
        window.ReferralAPI.fetchReferralStats(userId),
        window.ReferralAPI.fetchReferralEarnings(userId, options)
      ])
      .then(function(results) {
        const statsData = results[0];
        const earningsData = results[1];

        // Розраховуємо винагороди для 1-го рівня
        const level1Rewards = calculateLevel1Reward(
          earningsData.level1Earnings || [],
          { activeOnly: options.activeOnly }
        );

        // Розраховуємо винагороди для 2-го рівня
        const level2Rewards = calculateLevel2Reward(
          earningsData.level2Earnings || [],
          { activeOnly: options.activeOnly, groupByReferrers: true }
        );

        resolve({
          level1Rewards: level1Rewards,
          level2Rewards: level2Rewards,
          summary: {
            totalReward: level1Rewards.totalReward + level2Rewards.totalReward,
            totalEarnings: level1Rewards.totalEarnings + level2Rewards.totalEarnings,
            lastUpdated: new Date().toISOString()
          }
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання даних про винагороди за рівнями:', error);
        reject(new Error('Не вдалося отримати дані про винагороди: ' + (error.message || 'Невідома помилка')));
      });
    });
  }

  // Публічний API
  return {
    calculateDirectBonus: calculateDirectBonus,
    calculatePotentialDirectBonus: calculatePotentialDirectBonus,
    calculateLevel1Count: calculateLevel1Count,
    analyzeLevel1Growth: analyzeLevel1Growth,
    calculateLevel1Reward: calculateLevel1Reward,
    calculatePotentialLevel1Reward: calculatePotentialLevel1Reward,
    calculateLevel2Count: calculateLevel2Count,
    groupLevel2ByReferrers: groupLevel2ByReferrers,
    analyzeLevel1Effectiveness: analyzeLevel1Effectiveness,
    calculateLevel2Reward: calculateLevel2Reward,
    calculatePotentialLevel2Reward: calculatePotentialLevel2Reward,
    calculateCombinedLevel2Reward: calculateCombinedLevel2Reward,
    isEligibleForBadge: isEligibleForBadge,
    getHighestEligibleBadge: getHighestEligibleBadge,
    getAllEligibleBadges: getAllEligibleBadges,
    getNextBadgeTarget: getNextBadgeTarget,
    checkBadgesProgress: checkBadgesProgress,
    isTaskCompleted: isTaskCompleted,
    calculateTaskProgress: calculateTaskProgress,
    calculateTaskReward: calculateTaskReward,
    getCompletedTasks: getCompletedTasks,
    calculateTotalTasksReward: calculateTotalTasksReward,
    convertBadgeToWinix: convertBadgeToWinix,
    calculateTotalBadgeReward: calculateTotalBadgeReward,
    calculateEligibleBadgesReward: calculateEligibleBadgesReward,
    getTotalPotentialBadgeRewards: getTotalPotentialBadgeRewards,
    fetchLevelRewards: fetchLevelRewards
  };
})();