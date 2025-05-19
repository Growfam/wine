// calculateDirectBonus.js
export const calculateDirectBonus = (count = 1, customAmount) => {
  if (typeof count !== 'number' || isNaN(count) || count < 0) {
    throw new Error('Count must be a positive number');
  }

  const referralCount = Math.floor(count);
  const bonusAmount = customAmount !== undefined ? customAmount : 50; // DIRECT_BONUS_AMOUNT

  if (typeof bonusAmount !== 'number' || isNaN(bonusAmount) || bonusAmount < 0) {
    throw new Error('Bonus amount must be a positive number');
  }

  return referralCount * bonusAmount;
};

export const calculatePotentialDirectBonus = ({ referralsCount, bonusAmount }) => {
  const amount = bonusAmount || 50; // DIRECT_BONUS_AMOUNT
  const count = Math.max(0, referralsCount || 0);

  return {
    totalBonus: count * amount,
    perReferral: amount,
    count
  };
};

// calculateLevel1Count.js
export const calculateLevel1Count = (referrals, options = {}) => {
  if (!referrals || !Array.isArray(referrals)) {
    return 0;
  }

  const { activeOnly = false, fromDate = null, toDate = null } = options;

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  const filteredReferrals = referrals.filter(referral => {
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
};

export const analyzeLevel1Growth = (referrals, periodDays = 30) => {
  if (!referrals || !Array.isArray(referrals)) {
    return {
      totalCount: 0,
      growthRate: 0,
      periodGrowth: 0,
      averageDaily: 0
    };
  }

  const sortedReferrals = [...referrals].sort((a, b) => {
    const dateA = new Date(a.registrationDate || 0);
    const dateB = new Date(b.registrationDate || 0);
    return dateA - dateB;
  });

  const totalCount = sortedReferrals.length;

  const currentDate = new Date();
  const periodStartDate = new Date();
  periodStartDate.setDate(currentDate.getDate() - periodDays);

  const periodReferrals = sortedReferrals.filter(referral => {
    const regDate = new Date(referral.registrationDate || 0);
    return regDate >= periodStartDate;
  });

  const periodCount = periodReferrals.length;
  const averageDaily = periodCount / periodDays;

  const previousPeriodStartDate = new Date();
  previousPeriodStartDate.setDate(periodStartDate.getDate() - periodDays);

  const previousPeriodReferrals = sortedReferrals.filter(referral => {
    const regDate = new Date(referral.registrationDate || 0);
    return regDate >= previousPeriodStartDate && regDate < periodStartDate;
  });

  const previousPeriodCount = previousPeriodReferrals.length;
  const periodGrowth = periodCount - previousPeriodCount;

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

// calculateLevel1Reward.js
export const calculateLevel1Reward = (referrals, options = {}) => {
  if (!referrals || !Array.isArray(referrals)) {
    return {
      totalReward: 0,
      rewardRate: 0.1, // LEVEL_1_REWARD_RATE
      totalEarnings: 0,
      referralsCount: 0,
      activeReferralsCount: 0,
      referralRewards: []
    };
  }

  const { activeOnly = true, customRate } = options;
  const rewardRate = customRate !== undefined ? customRate : 0.1; // LEVEL_1_REWARD_RATE

  const filteredReferrals = activeOnly
    ? referrals.filter(ref => ref.active)
    : referrals;

  const referralRewards = filteredReferrals.map(referral => {
    const earnings = referral.totalEarnings || 0;
    const reward = earnings * rewardRate; // calculatePercentage

    return {
      referralId: referral.id,
      earnings,
      reward,
      rate: rewardRate
    };
  });

  const totalEarnings = referralRewards.reduce((sum, item) => sum + item.earnings, 0);
  const totalReward = referralRewards.reduce((sum, item) => sum + item.reward, 0);

  return {
    totalReward,
    rewardRate,
    totalEarnings,
    referralsCount: referrals.length,
    activeReferralsCount: filteredReferrals.length,
    referralRewards
  };
};

export const calculatePotentialLevel1Reward = (totalEarnings, customRate) => {
  if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
    return 0;
  }

  const rewardRate = customRate !== undefined ? customRate : 0.1; // LEVEL_1_REWARD_RATE
  return totalEarnings * rewardRate; // calculatePercentage
};

// calculateLevel2Count.js
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

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  const filteredReferrals = referrals.filter(referral => {
    if (activeOnly && !referral.active) {
      return false;
    }

    if (byReferrerId) {
      if (Array.isArray(byReferrerId)) {
        if (!byReferrerId.includes(referral.referrerId)) {
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
};

export const groupLevel2ByReferrers = (level2Referrals, level1Referrals = []) => {
  if (!level2Referrals || !Array.isArray(level2Referrals)) {
    return {};
  }

  const level1Map = {};
  if (level1Referrals && Array.isArray(level1Referrals)) {
    level1Referrals.forEach(referral => {
      level1Map[referral.id] = referral;
    });
  }

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

  Object.keys(groupedReferrals).forEach(referrerId => {
    const group = groupedReferrals[referrerId];
    const referrals = group.referrals;

    group.totalCount = referrals.length;
    group.activeCount = referrals.filter(r => r.active).length;
    group.inactiveCount = group.totalCount - group.activeCount;
  });

  return groupedReferrals;
};

export const analyzeLevel1Effectiveness = (level2Referrals, level1Referrals) => {
  if (!level2Referrals || !Array.isArray(level2Referrals) ||
      !level1Referrals || !Array.isArray(level1Referrals)) {
    return [];
  }

  const groupedReferrals = groupLevel2ByReferrers(level2Referrals, level1Referrals);

  const effectiveness = level1Referrals.map(referral => {
    const id = referral.id;
    const group = groupedReferrals[id] || { totalCount: 0, activeCount: 0, inactiveCount: 0 };

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

  return effectiveness.sort((a, b) => b.referralCount - a.referralCount);
};

// calculateLevel2Reward.js
export const calculateLevel2Reward = (referrals, options = {}) => {
  if (!referrals || !Array.isArray(referrals)) {
    return {
      totalReward: 0,
      rewardRate: 0.05, // LEVEL_2_REWARD_RATE
      totalEarnings: 0,
      referralsCount: 0,
      activeReferralsCount: 0,
      referralRewards: [],
      groupedRewards: {}
    };
  }

  const {
    activeOnly = true,
    customRate,
    groupByReferrers = false
  } = options;

  const rewardRate = customRate !== undefined ? customRate : 0.05; // LEVEL_2_REWARD_RATE

  const filteredReferrals = activeOnly
    ? referrals.filter(ref => ref.active)
    : referrals;

  const referralRewards = filteredReferrals.map(referral => {
    const earnings = referral.totalEarnings || 0;
    const reward = earnings * rewardRate; // calculatePercentage

    return {
      referralId: referral.id,
      referrerId: referral.referrerId,
      earnings,
      reward,
      rate: rewardRate
    };
  });

  const totalEarnings = referralRewards.reduce((sum, item) => sum + item.earnings, 0);
  const totalReward = referralRewards.reduce((sum, item) => sum + item.reward, 0);

  let groupedRewards = {};

  if (groupByReferrers) {
    referralRewards.forEach(reward => {
      const referrerId = reward.referrerId;

      if (!groupedRewards[referrerId]) {
        groupedRewards[referrerId] = {
          referrerId,
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
    totalReward,
    rewardRate,
    totalEarnings,
    referralsCount: referrals.length,
    activeReferralsCount: filteredReferrals.length,
    referralRewards,
    groupedRewards
  };
};

export const calculatePotentialLevel2Reward = (totalEarnings, customRate) => {
  if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
    return 0;
  }

  const rewardRate = customRate !== undefined ? customRate : 0.05; // LEVEL_2_REWARD_RATE
  return totalEarnings * rewardRate; // calculatePercentage
};

export const calculateCombinedLevel2Reward = (level1Referrals, level2Referrals, options = {}) => {
  if (!level1Referrals || !Array.isArray(level1Referrals) ||
      !level2Referrals || !Array.isArray(level2Referrals)) {
    return {
      totalReward: 0,
      level1ReferralsWithLevel2: [],
      combinedRewards: []
    };
  }

  const level1Map = level1Referrals.reduce((map, ref) => {
    map[ref.id] = ref;
    return map;
  }, {});

  const level2Rewards = calculateLevel2Reward(level2Referrals, {
    ...options,
    groupByReferrers: true
  });

  const level1ReferralsWithLevel2 = [];

  const combinedRewards = Object.keys(level2Rewards.groupedRewards).map(referrerId => {
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
    level1ReferralsWithLevel2,
    combinedRewards
  };
};

// checkBadgeEligibility.js
export const isEligibleForBadge = (badgeType, referralsCount) => {
  const BADGE_THRESHOLDS = {
    BRONZE: 25,
    SILVER: 50,
    GOLD: 100,
    PLATINUM: 500
  };

  if (!badgeType || !BADGE_THRESHOLDS[badgeType]) {
    return false;
  }

  return referralsCount >= BADGE_THRESHOLDS[badgeType];
};

export const getHighestEligibleBadge = (referralsCount) => {
  const BADGE_TYPES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

  for (let i = BADGE_TYPES.length - 1; i >= 0; i--) {
    const badgeType = BADGE_TYPES[i];
    if (isEligibleForBadge(badgeType, referralsCount)) {
      return badgeType;
    }
  }

  return null;
};

export const getAllEligibleBadges = (referralsCount) => {
  const BADGE_TYPES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  return BADGE_TYPES.filter(badgeType =>
    isEligibleForBadge(badgeType, referralsCount)
  );
};

export const getNextBadgeTarget = (referralsCount) => {
  const BADGE_TYPES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const BADGE_THRESHOLDS = {
    BRONZE: 25,
    SILVER: 50,
    GOLD: 100,
    PLATINUM: 500
  };

  for (const badgeType of BADGE_TYPES) {
    if (!isEligibleForBadge(badgeType, referralsCount)) {
      const threshold = BADGE_THRESHOLDS[badgeType];
      const remaining = threshold - referralsCount;

      return {
        type: badgeType,
        threshold,
        remaining,
        progress: (referralsCount / threshold) * 100
      };
    }
  }

  return null;
};

export const checkBadgesProgress = (referralsCount) => {
  const BADGE_TYPES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const BADGE_THRESHOLDS = {
    BRONZE: 25,
    SILVER: 50,
    GOLD: 100,
    PLATINUM: 500
  };

  const eligibleBadges = getAllEligibleBadges(referralsCount);
  const nextBadge = getNextBadgeTarget(referralsCount);

  return {
    currentReferralsCount: referralsCount,
    eligibleBadges,
    earnedBadgesCount: eligibleBadges.length,
    nextBadge,
    hasAllBadges: eligibleBadges.length === BADGE_TYPES.length,
    badgeProgress: BADGE_TYPES.map(badgeType => {
      const threshold = BADGE_THRESHOLDS[badgeType];
      const isEligible = referralsCount >= threshold;
      const progress = Math.min(100, (referralsCount / threshold) * 100);

      return {
        type: badgeType,
        threshold,
        isEligible,
        progress
      };
    })
  };
};

// checkTaskCompletion.js
export const isTaskCompleted = (taskType, statsData) => {
  const TASK_THRESHOLDS = {
    REFERRAL_COUNT: {
      threshold: 100,
      reward: 12000
    },
    ACTIVE_REFERRALS: {
      threshold: 50,
      reward: 6000
    }
  };

  if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
    return false;
  }

  const { threshold } = TASK_THRESHOLDS[taskType];

  switch (taskType) {
    case 'REFERRAL_COUNT':
      return statsData.totalReferralsCount >= threshold;

    case 'ACTIVE_REFERRALS':
      return statsData.activeReferralsCount >= threshold;

    default:
      return false;
  }
};

export const calculateTaskProgress = (taskType, statsData) => {
  const TASK_THRESHOLDS = {
    REFERRAL_COUNT: {
      threshold: 100,
      reward: 12000
    },
    ACTIVE_REFERRALS: {
      threshold: 50,
      reward: 6000
    }
  };

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

export const calculateTaskReward = (taskType) => {
  const TASK_THRESHOLDS = {
    REFERRAL_COUNT: {
      threshold: 100,
      reward: 12000
    },
    ACTIVE_REFERRALS: {
      threshold: 50,
      reward: 6000
    }
  };

  if (!taskType || !TASK_THRESHOLDS[taskType]) {
    return 0;
  }

  return TASK_THRESHOLDS[taskType].reward;
};

export const getCompletedTasks = (statsData) => {
  const TASK_TYPES = ['REFERRAL_COUNT', 'ACTIVE_REFERRALS'];

  if (!statsData) {
    return [];
  }

  return TASK_TYPES.filter(taskType => isTaskCompleted(taskType, statsData));
};

export const calculateTotalTasksReward = (statsData) => {
  const completedTasks = getCompletedTasks(statsData);

  return completedTasks.reduce((total, taskType) => {
    return total + calculateTaskReward(taskType);
  }, 0);
};

// convertBadgeToWinix.js
export const convertBadgeToWinix = (badgeType) => {
  const BADGE_REWARDS = {
    BRONZE: 2500,
    SILVER: 5000,
    GOLD: 10000,
    PLATINUM: 20000
  };

  return BADGE_REWARDS[badgeType] || 0;
};

export const calculateTotalBadgeReward = (badgeTypes) => {
  if (!badgeTypes || !Array.isArray(badgeTypes)) {
    return 0;
  }

  return badgeTypes.reduce((total, badgeType) => {
    return total + convertBadgeToWinix(badgeType);
  }, 0);
};

export const calculateEligibleBadgesReward = (referralsCount) => {
  const eligibleBadges = getAllEligibleBadges(referralsCount);
  const totalReward = calculateTotalBadgeReward(eligibleBadges);

  const badgeRewards = eligibleBadges.map(badgeType => ({
    type: badgeType,
    reward: convertBadgeToWinix(badgeType)
  }));

  return {
    eligibleBadges,
    badgeRewards,
    totalReward
  };
};

export const getTotalPotentialBadgeRewards = () => {
  const BADGE_REWARDS = {
    BRONZE: 2500,
    SILVER: 5000,
    GOLD: 10000,
    PLATINUM: 20000
  };

  const allBadgeTypes = Object.keys(BADGE_REWARDS);
  const totalPotentialReward = calculateTotalBadgeReward(allBadgeTypes);

  const allBadgeRewards = allBadgeTypes.map(badgeType => ({
    type: badgeType,
    reward: convertBadgeToWinix(badgeType)
  }));

  return {
    allBadgeTypes,
    allBadgeRewards,
    totalPotentialReward
  };
};

// fetchLevelRewards.js (основна сервісна функція для отримання винагород за рівнями)
export const fetchLevelRewards = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про винагороди');
  }

  try {
    // Отримуємо статистику рефералів через API
    const statsData = await window.ReferralAPI.fetchReferralStats(userId);

    // Отримуємо дані про заробітки через API
    const earningsData = await window.ReferralAPI.fetchReferralEarnings(userId, options);

    // Розраховуємо винагороди для 1-го рівня через сервіси
    const level1Rewards = calculateLevel1Reward(
      earningsData.level1Earnings || [],
      { activeOnly: options.activeOnly }
    );

    // Розраховуємо винагороди для 2-го рівня через сервіси
    const level2Rewards = calculateLevel2Reward(
      earningsData.level2Earnings || [],
      { activeOnly: options.activeOnly, groupByReferrers: true }
    );

    return {
      level1Rewards,
      level2Rewards,
      summary: {
        totalReward: level1Rewards.totalReward + level2Rewards.totalReward,
        totalEarnings: level1Rewards.totalEarnings + level2Rewards.totalEarnings,
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Помилка отримання даних про винагороди за рівнями:', error);
    throw new Error(`Не вдалося отримати дані про винагороди: ${error.message || 'Невідома помилка'}`);
  }
};