// services.js - Традиційна версія без ES6 модулів з детальним логуванням
/**
 * Сервісні функції для реферальної системи
 */
window.ReferralServices = (function() {
  'use strict';

  console.log('📦 [SERVICES] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ ReferralServices ==========');
  console.log('🕐 [SERVICES] Час завантаження:', new Date().toISOString());

  // calculateDirectBonus.js
  function calculateDirectBonus(count, customAmount) {
    console.log('💰 [SERVICES] === calculateDirectBonus START ===');
    console.log('📊 [SERVICES] Параметри:', {
      count: count,
      customAmount: customAmount,
      defaultAmount: window.ReferralConstants.DIRECT_BONUS_AMOUNT
    });

    count = count || 1;
    if (typeof count !== 'number' || isNaN(count) || count < 0) {
      console.error('❌ [SERVICES] Некоректне значення count:', count);
      throw new Error('Count must be a positive number');
    }

    const referralCount = Math.floor(count);
    const bonusAmount = customAmount !== undefined
      ? customAmount
      : window.ReferralConstants.DIRECT_BONUS_AMOUNT;

    console.log('📊 [SERVICES] Нормалізовані значення:', {
      referralCount: referralCount,
      bonusAmount: bonusAmount
    });

    if (typeof bonusAmount !== 'number' || isNaN(bonusAmount) || bonusAmount < 0) {
      console.error('❌ [SERVICES] Некоректне значення bonusAmount:', bonusAmount);
      throw new Error('Bonus amount must be a positive number');
    }

    const result = referralCount * bonusAmount;
    console.log('✅ [SERVICES] Результат calculateDirectBonus:', result);

    return result;
  }

  function calculatePotentialDirectBonus(params) {
    console.log('💰 [SERVICES] === calculatePotentialDirectBonus START ===');
    console.log('📊 [SERVICES] Параметри:', params);

    params = params || {};
    const amount = params.bonusAmount || window.ReferralConstants.DIRECT_BONUS_AMOUNT;
    const count = Math.max(0, params.referralsCount || 0);

    const result = {
      totalBonus: count * amount,
      perReferral: amount,
      count: count
    };

    console.log('✅ [SERVICES] Результат calculatePotentialDirectBonus:', result);
    return result;
  }

  // calculateLevel1Count.js
  function calculateLevel1Count(referrals, options) {
    console.log('📊 [SERVICES] === calculateLevel1Count START ===');
    console.log('📊 [SERVICES] Параметри:', {
      referralsLength: referrals ? referrals.length : 0,
      options: options
    });

    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      console.warn('⚠️ [SERVICES] referrals не є масивом');
      return 0;
    }

    const activeOnly = options.activeOnly || false;
    const fromDate = options.fromDate || null;
    const toDate = options.toDate || null;

    console.log('📊 [SERVICES] Фільтри:', {
      activeOnly: activeOnly,
      fromDate: fromDate,
      toDate: toDate
    });

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

    const result = filteredReferrals.length;
    console.log('✅ [SERVICES] Результат calculateLevel1Count:', {
      original: referrals.length,
      filtered: result
    });

    return result;
  }

  function analyzeLevel1Growth(referrals, periodDays) {
    console.log('📈 [SERVICES] === analyzeLevel1Growth START ===');
    console.log('📊 [SERVICES] Параметри:', {
      referralsLength: referrals ? referrals.length : 0,
      periodDays: periodDays
    });

    periodDays = periodDays || 30;
    if (!referrals || !Array.isArray(referrals)) {
      console.warn('⚠️ [SERVICES] referrals не є масивом');
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

    const result = {
      totalCount: totalCount,
      periodCount: periodCount,
      previousPeriodCount: previousPeriodCount,
      periodGrowth: periodGrowth,
      growthRate: growthRate,
      averageDaily: averageDaily
    };

    console.log('✅ [SERVICES] Результат analyzeLevel1Growth:', result);
    return result;
  }

  // calculateLevel1Reward.js
  function calculateLevel1Reward(referrals, options) {
    console.log('💰 [SERVICES] === calculateLevel1Reward START ===');
    console.log('📊 [SERVICES] Параметри:', {
      referralsLength: referrals ? referrals.length : 0,
      options: options
    });

    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      console.warn('⚠️ [SERVICES] referrals не є масивом');
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

    console.log('📊 [SERVICES] Налаштування:', {
      activeOnly: activeOnly,
      rewardRate: rewardRate
    });

    const filteredReferrals = activeOnly
      ? referrals.filter(function(ref) { return ref.active; })
      : referrals;

    console.log('📊 [SERVICES] Відфільтровано рефералів:', filteredReferrals.length);

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

    const result = {
      totalReward: totalReward,
      rewardRate: rewardRate,
      totalEarnings: totalEarnings,
      referralsCount: referrals.length,
      activeReferralsCount: filteredReferrals.length,
      referralRewards: referralRewards
    };

    console.log('✅ [SERVICES] Результат calculateLevel1Reward:', {
      totalReward: result.totalReward,
      totalEarnings: result.totalEarnings,
      referralsCount: result.referralsCount,
      activeReferralsCount: result.activeReferralsCount
    });

    return result;
  }

  function calculatePotentialLevel1Reward(totalEarnings, customRate) {
    console.log('💰 [SERVICES] === calculatePotentialLevel1Reward START ===');
    console.log('📊 [SERVICES] Параметри:', {
      totalEarnings: totalEarnings,
      customRate: customRate
    });

    if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
      console.error('❌ [SERVICES] Некоректне значення totalEarnings:', totalEarnings);
      return 0;
    }

    const rewardRate = customRate !== undefined
      ? customRate
      : window.ReferralConstants.LEVEL_1_REWARD_RATE;

    const result = totalEarnings * rewardRate;
    console.log('✅ [SERVICES] Результат calculatePotentialLevel1Reward:', result);

    return result;
  }

  // calculateLevel2Count.js
  function calculateLevel2Count(referrals, options) {
    console.log('📊 [SERVICES] === calculateLevel2Count START ===');
    console.log('📊 [SERVICES] Параметри:', {
      referralsLength: referrals ? referrals.length : 0,
      options: options
    });

    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      console.warn('⚠️ [SERVICES] referrals не є масивом');
      return 0;
    }

    const activeOnly = options.activeOnly || false;
    const fromDate = options.fromDate || null;
    const toDate = options.toDate || null;
    const byReferrerId = options.byReferrerId || null;

    console.log('📊 [SERVICES] Фільтри:', {
      activeOnly: activeOnly,
      fromDate: fromDate,
      toDate: toDate,
      byReferrerId: byReferrerId
    });

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

    const result = filteredReferrals.length;
    console.log('✅ [SERVICES] Результат calculateLevel2Count:', {
      original: referrals.length,
      filtered: result
    });

    return result;
  }

  function groupLevel2ByReferrers(level2Referrals, level1Referrals) {
    console.log('🔄 [SERVICES] === groupLevel2ByReferrers START ===');
    console.log('📊 [SERVICES] Параметри:', {
      level2Count: level2Referrals ? level2Referrals.length : 0,
      level1Count: level1Referrals ? level1Referrals.length : 0
    });

    level1Referrals = level1Referrals || [];
    if (!level2Referrals || !Array.isArray(level2Referrals)) {
      console.warn('⚠️ [SERVICES] level2Referrals не є масивом');
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

    console.log('✅ [SERVICES] Результат groupLevel2ByReferrers:', {
      groupsCount: Object.keys(groupedReferrals).length,
      totalReferrals: level2Referrals.length
    });

    return groupedReferrals;
  }

  function analyzeLevel1Effectiveness(level2Referrals, level1Referrals) {
    console.log('📈 [SERVICES] === analyzeLevel1Effectiveness START ===');
    console.log('📊 [SERVICES] Параметри:', {
      level2Count: level2Referrals ? level2Referrals.length : 0,
      level1Count: level1Referrals ? level1Referrals.length : 0
    });

    if (!level2Referrals || !Array.isArray(level2Referrals) ||
        !level1Referrals || !Array.isArray(level1Referrals)) {
      console.warn('⚠️ [SERVICES] Некоректні вхідні дані');
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

    const sorted = effectiveness.sort(function(a, b) {
      return b.referralCount - a.referralCount;
    });

    console.log('✅ [SERVICES] Результат analyzeLevel1Effectiveness:', {
      count: sorted.length,
      topReferrer: sorted[0] ? sorted[0].referralCount : 0
    });

    return sorted;
  }

  // calculateLevel2Reward.js
  function calculateLevel2Reward(referrals, options) {
    console.log('💰 [SERVICES] === calculateLevel2Reward START ===');
    console.log('📊 [SERVICES] Параметри:', {
      referralsLength: referrals ? referrals.length : 0,
      options: options
    });

    options = options || {};
    if (!referrals || !Array.isArray(referrals)) {
      console.warn('⚠️ [SERVICES] referrals не є масивом');
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

    console.log('📊 [SERVICES] Налаштування:', {
      activeOnly: activeOnly,
      groupByReferrers: groupByReferrers,
      rewardRate: rewardRate
    });

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
      console.log('🔄 [SERVICES] Групування винагород за рефереррами...');

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

      console.log('✅ [SERVICES] Груп створено:', Object.keys(groupedRewards).length);
    }

    const result = {
      totalReward: totalReward,
      rewardRate: rewardRate,
      totalEarnings: totalEarnings,
      referralsCount: referrals.length,
      activeReferralsCount: filteredReferrals.length,
      referralRewards: referralRewards,
      groupedRewards: groupedRewards
    };

    console.log('✅ [SERVICES] Результат calculateLevel2Reward:', {
      totalReward: result.totalReward,
      totalEarnings: result.totalEarnings,
      referralsCount: result.referralsCount,
      activeReferralsCount: result.activeReferralsCount,
      groupsCount: Object.keys(result.groupedRewards).length
    });

    return result;
  }

  function calculatePotentialLevel2Reward(totalEarnings, customRate) {
    console.log('💰 [SERVICES] === calculatePotentialLevel2Reward START ===');
    console.log('📊 [SERVICES] Параметри:', {
      totalEarnings: totalEarnings,
      customRate: customRate
    });

    if (typeof totalEarnings !== 'number' || isNaN(totalEarnings) || totalEarnings < 0) {
      console.error('❌ [SERVICES] Некоректне значення totalEarnings:', totalEarnings);
      return 0;
    }

    const rewardRate = customRate !== undefined
      ? customRate
      : window.ReferralConstants.LEVEL_2_REWARD_RATE;

    const result = totalEarnings * rewardRate;
    console.log('✅ [SERVICES] Результат calculatePotentialLevel2Reward:', result);

    return result;
  }

  function calculateCombinedLevel2Reward(level1Referrals, level2Referrals, options) {
    console.log('💰 [SERVICES] === calculateCombinedLevel2Reward START ===');
    console.log('📊 [SERVICES] Параметри:', {
      level1Count: level1Referrals ? level1Referrals.length : 0,
      level2Count: level2Referrals ? level2Referrals.length : 0,
      options: options
    });

    options = options || {};
    if (!level1Referrals || !Array.isArray(level1Referrals) ||
        !level2Referrals || !Array.isArray(level2Referrals)) {
      console.warn('⚠️ [SERVICES] Некоректні вхідні дані');
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

    const result = {
      totalReward: level2Rewards.totalReward,
      level1ReferralsWithLevel2: level1ReferralsWithLevel2,
      combinedRewards: combinedRewards
    };

    console.log('✅ [SERVICES] Результат calculateCombinedLevel2Reward:', {
      totalReward: result.totalReward,
      level1Count: result.level1ReferralsWithLevel2.length,
      combinedCount: result.combinedRewards.length
    });

    return result;
  }

  // checkBadgeEligibility.js
  function isEligibleForBadge(badgeType, referralsCount) {
    console.log('🏆 [SERVICES] === isEligibleForBadge START ===');
    console.log('📊 [SERVICES] Параметри:', {
      badgeType: badgeType,
      referralsCount: referralsCount
    });

    const BADGE_THRESHOLDS = window.ReferralConstants.BADGE_THRESHOLDS;

    if (!badgeType || !BADGE_THRESHOLDS[badgeType]) {
      console.error('❌ [SERVICES] Невідомий тип бейджа:', badgeType);
      return false;
    }

    const threshold = BADGE_THRESHOLDS[badgeType];
    const result = referralsCount >= threshold;

    console.log('✅ [SERVICES] Результат isEligibleForBadge:', {
      threshold: threshold,
      isEligible: result
    });

    return result;
  }

  function getHighestEligibleBadge(referralsCount) {
    console.log('🏆 [SERVICES] === getHighestEligibleBadge START ===');
    console.log('📊 [SERVICES] referralsCount:', referralsCount);

    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;

    for (let i = BADGE_TYPES.length - 1; i >= 0; i--) {
      const badgeType = BADGE_TYPES[i];
      if (isEligibleForBadge(badgeType, referralsCount)) {
        console.log('✅ [SERVICES] Найвищий доступний бейдж:', badgeType);
        return badgeType;
      }
    }

    console.log('❌ [SERVICES] Жоден бейдж не доступний');
    return null;
  }

  function getAllEligibleBadges(referralsCount) {
    console.log('🏆 [SERVICES] === getAllEligibleBadges START ===');
    console.log('📊 [SERVICES] referralsCount:', referralsCount);

    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;
    const result = BADGE_TYPES.filter(function(badgeType) {
      return isEligibleForBadge(badgeType, referralsCount);
    });

    console.log('✅ [SERVICES] Доступні бейджі:', result);
    return result;
  }

  function getNextBadgeTarget(referralsCount) {
    console.log('🎯 [SERVICES] === getNextBadgeTarget START ===');
    console.log('📊 [SERVICES] referralsCount:', referralsCount);

    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;
    const BADGE_THRESHOLDS = window.ReferralConstants.BADGE_THRESHOLDS;

    for (let i = 0; i < BADGE_TYPES.length; i++) {
      const badgeType = BADGE_TYPES[i];
      if (!isEligibleForBadge(badgeType, referralsCount)) {
        const threshold = BADGE_THRESHOLDS[badgeType];
        const remaining = threshold - referralsCount;

        const result = {
          type: badgeType,
          threshold: threshold,
          remaining: remaining,
          progress: (referralsCount / threshold) * 100
        };

        console.log('✅ [SERVICES] Наступний бейдж:', result);
        return result;
      }
    }

    console.log('✅ [SERVICES] Всі бейджі вже отримані');
    return null;
  }

  function checkBadgesProgress(referralsCount) {
    console.log('📊 [SERVICES] === checkBadgesProgress START ===');
    console.log('📊 [SERVICES] referralsCount:', referralsCount);

    const BADGE_TYPES = window.ReferralConstants.BADGE_TYPES;
    const BADGE_THRESHOLDS = window.ReferralConstants.BADGE_THRESHOLDS;

    const eligibleBadges = getAllEligibleBadges(referralsCount);
    const nextBadge = getNextBadgeTarget(referralsCount);

    const result = {
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

    console.log('✅ [SERVICES] Результат checkBadgesProgress:', {
      earnedCount: result.earnedBadgesCount,
      hasAllBadges: result.hasAllBadges,
      nextBadgeType: result.nextBadge ? result.nextBadge.type : 'none'
    });

    return result;
  }

  // checkTaskCompletion.js
  function isTaskCompleted(taskType, statsData) {
    console.log('📋 [SERVICES] === isTaskCompleted START ===');
    console.log('📊 [SERVICES] Параметри:', {
      taskType: taskType,
      statsData: statsData
    });

    const TASK_THRESHOLDS = window.ReferralConstants.TASK_THRESHOLDS;

    if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
      console.error('❌ [SERVICES] Некоректні параметри');
      return false;
    }

    const threshold = TASK_THRESHOLDS[taskType].threshold;
    let result = false;

    switch (taskType) {
      case 'REFERRAL_COUNT':
        result = statsData.totalReferralsCount >= threshold;
        break;

      case 'ACTIVE_REFERRALS':
        result = statsData.activeReferralsCount >= threshold;
        break;

      default:
        console.error('❌ [SERVICES] Невідомий тип завдання:', taskType);
        result = false;
    }

    console.log('✅ [SERVICES] Результат isTaskCompleted:', {
      taskType: taskType,
      threshold: threshold,
      completed: result
    });

    return result;
  }

  function calculateTaskProgress(taskType, statsData) {
    console.log('📊 [SERVICES] === calculateTaskProgress START ===');
    console.log('📊 [SERVICES] Параметри:', {
      taskType: taskType,
      statsData: statsData
    });

    const TASK_THRESHOLDS = window.ReferralConstants.TASK_THRESHOLDS;

    if (!taskType || !TASK_THRESHOLDS[taskType] || !statsData) {
      console.error('❌ [SERVICES] Некоректні параметри');
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
        console.error('❌ [SERVICES] Невідомий тип завдання:', taskType);
        current = 0;
    }

    const remaining = Math.max(0, threshold - current);
    const progress = Math.min(100, (current / threshold) * 100);
    const completed = current >= threshold;

    const result = {
      completed: completed,
      progress: progress,
      current: current,
      threshold: threshold,
      remaining: remaining
    };

    console.log('✅ [SERVICES] Результат calculateTaskProgress:', result);
    return result;
  }

  function calculateTaskReward(taskType) {
    console.log('💰 [SERVICES] === calculateTaskReward START ===');
    console.log('📊 [SERVICES] taskType:', taskType);

    const TASK_THRESHOLDS = window.ReferralConstants.TASK_THRESHOLDS;

    if (!taskType || !TASK_THRESHOLDS[taskType]) {
      console.error('❌ [SERVICES] Невідомий тип завдання:', taskType);
      return 0;
    }

    const reward = TASK_THRESHOLDS[taskType].reward;
    console.log('✅ [SERVICES] Винагорода за завдання:', reward);

    return reward;
  }

  function getCompletedTasks(statsData) {
    console.log('📋 [SERVICES] === getCompletedTasks START ===');
    console.log('📊 [SERVICES] statsData:', statsData);

    const TASK_TYPES = window.ReferralConstants.TASK_TYPES;

    if (!statsData) {
      console.error('❌ [SERVICES] statsData відсутні');
      return [];
    }

    const result = TASK_TYPES.filter(function(taskType) {
      return isTaskCompleted(taskType, statsData);
    });

    console.log('✅ [SERVICES] Виконані завдання:', result);
    return result;
  }

  function calculateTotalTasksReward(statsData) {
    console.log('💰 [SERVICES] === calculateTotalTasksReward START ===');
    console.log('📊 [SERVICES] statsData:', statsData);

    const completedTasks = getCompletedTasks(statsData);

    const totalReward = completedTasks.reduce(function(total, taskType) {
      return total + calculateTaskReward(taskType);
    }, 0);

    console.log('✅ [SERVICES] Загальна винагорода за завдання:', totalReward);
    return totalReward;
  }

  // convertBadgeToWinix.js
  function convertBadgeToWinix(badgeType) {
    console.log('💰 [SERVICES] === convertBadgeToWinix START ===');
    console.log('📊 [SERVICES] badgeType:', badgeType);

    const BADGE_REWARDS = window.ReferralConstants.BADGE_REWARDS;
    const reward = BADGE_REWARDS[badgeType] || 0;

    console.log('✅ [SERVICES] Винагорода за бейдж:', reward);
    return reward;
  }

  function calculateTotalBadgeReward(badgeTypes) {
    console.log('💰 [SERVICES] === calculateTotalBadgeReward START ===');
    console.log('📊 [SERVICES] badgeTypes:', badgeTypes);

    if (!badgeTypes || !Array.isArray(badgeTypes)) {
      console.error('❌ [SERVICES] badgeTypes не є масивом');
      return 0;
    }

    const totalReward = badgeTypes.reduce(function(total, badgeType) {
      return total + convertBadgeToWinix(badgeType);
    }, 0);

    console.log('✅ [SERVICES] Загальна винагорода за бейджі:', totalReward);
    return totalReward;
  }

  function calculateEligibleBadgesReward(referralsCount) {
    console.log('💰 [SERVICES] === calculateEligibleBadgesReward START ===');
    console.log('📊 [SERVICES] referralsCount:', referralsCount);

    const eligibleBadges = getAllEligibleBadges(referralsCount);
    const totalReward = calculateTotalBadgeReward(eligibleBadges);

    const badgeRewards = eligibleBadges.map(function(badgeType) {
      return {
        type: badgeType,
        reward: convertBadgeToWinix(badgeType)
      };
    });

    const result = {
      eligibleBadges: eligibleBadges,
      badgeRewards: badgeRewards,
      totalReward: totalReward
    };

    console.log('✅ [SERVICES] Результат calculateEligibleBadgesReward:', result);
    return result;
  }

  function getTotalPotentialBadgeRewards() {
    console.log('💰 [SERVICES] === getTotalPotentialBadgeRewards START ===');

    const BADGE_REWARDS = window.ReferralConstants.BADGE_REWARDS;

    const allBadgeTypes = Object.keys(BADGE_REWARDS);
    const totalPotentialReward = calculateTotalBadgeReward(allBadgeTypes);

    const allBadgeRewards = allBadgeTypes.map(function(badgeType) {
      return {
        type: badgeType,
        reward: convertBadgeToWinix(badgeType)
      };
    });

    const result = {
      allBadgeTypes: allBadgeTypes,
      allBadgeRewards: allBadgeRewards,
      totalPotentialReward: totalPotentialReward
    };

    console.log('✅ [SERVICES] Результат getTotalPotentialBadgeRewards:', result);
    return result;
  }

  // fetchLevelRewards.js (основна сервісна функція)
  function fetchLevelRewards(userId, options) {
    console.log('🎯 [SERVICES] === fetchLevelRewards START ===');
    console.log('📊 [SERVICES] Параметри:', {
      userId: userId,
      options: options
    });

    options = options || {};

    if (!userId) {
      console.error('❌ [SERVICES] userId відсутній');
      throw new Error('ID користувача обов\'язковий для отримання даних про винагороди');
    }

    return new Promise(function(resolve, reject) {
      console.log('🔄 [SERVICES] Завантаження даних...');

      Promise.all([
        window.ReferralAPI.fetchReferralStats(userId),
        window.ReferralAPI.fetchReferralEarnings(userId, options)
      ])
      .then(function(results) {
        console.log('✅ [SERVICES] Дані отримані');

        const statsData = results[0];
        const earningsData = results[1];

        console.log('📊 [SERVICES] Обробка даних:', {
          hasStats: !!statsData,
          hasEarnings: !!earningsData
        });

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

        const result = {
          level1Rewards: level1Rewards,
          level2Rewards: level2Rewards,
          summary: {
            totalReward: level1Rewards.totalReward + level2Rewards.totalReward,
            totalEarnings: level1Rewards.totalEarnings + level2Rewards.totalEarnings,
            lastUpdated: new Date().toISOString()
          }
        };

        console.log('✅ [SERVICES] fetchLevelRewards завершено:', {
          level1Total: result.level1Rewards.totalReward,
          level2Total: result.level2Rewards.totalReward,
          summaryTotal: result.summary.totalReward
        });

        resolve(result);
      })
      .catch(function(error) {
        console.error('❌ [SERVICES] Помилка fetchLevelRewards:', error);
        reject(new Error('Не вдалося отримати дані про винагороди: ' + (error.message || 'Невідома помилка')));
      });
    });
  }

  // Підрахунок кількості функцій
  const publicAPI = {
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

  console.log('✅ [SERVICES] ========== МОДУЛЬ ReferralServices ЗАВАНТАЖЕНО УСПІШНО ==========');
  console.log('📊 [SERVICES] Експортовано функцій:', Object.keys(publicAPI).length);
  console.log('📋 [SERVICES] Список функцій:', Object.keys(publicAPI));

  return publicAPI;
})();

// Перевірка доступності
console.log('🔍 [SERVICES] Перевірка доступності window.ReferralServices:', {
  exists: typeof window.ReferralServices !== 'undefined',
  type: typeof window.ReferralServices,
  methods: window.ReferralServices ? Object.keys(window.ReferralServices).length : 0
});