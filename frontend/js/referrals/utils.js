// utils.js - Виправлена версія (валідація userId як числа)
/**
 * Утиліти для реферальної системи
 */
window.ReferralUtils = (function() {
  'use strict';

  // calculatePercentage.js
  function calculatePercentage(amount, rate, round) {
    round = round !== false; // default true

    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Сума повинна бути числом');
    }

    if (typeof rate !== 'number' || isNaN(rate) || rate < 0) {
      throw new Error('Ставка повинна бути додатнім числом');
    }

    const result = amount * rate;
    return round ? Math.round(result) : result;
  }

  function formatPercentageResult(amount, rate, options) {
    options = options || {};
    const prefix = options.prefix || '';
    const suffix = options.suffix || '';
    const showPercentage = options.showPercentage || false;

    const calculatedAmount = calculatePercentage(amount, rate);

    const percentageString = showPercentage
      ? ' (' + (rate * 100).toFixed(1) + '%)'
      : '';

    return prefix + calculatedAmount + suffix + percentageString;
  }

  function calculateMultiplePercentages(amount, rates) {
    if (!Array.isArray(rates)) {
      throw new Error('Ставки повинні бути передані масивом');
    }

    return rates.map(function(rate) {
      return calculatePercentage(amount, rate);
    });
  }

  // formatReferralUrl.js
  function formatReferralUrl(userId) {
    if (!userId) {
      throw new Error('User ID обов\'язковий для генерації реферального посилання');
    }

    // Переконуємося що userId це число або можна конвертувати
    const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
    if (isNaN(numericUserId)) {
      throw new Error('User ID повинен бути числом');
    }

    const REFERRAL_URL_PATTERN = window.ReferralConstants.REFERRAL_URL_PATTERN;
    return REFERRAL_URL_PATTERN.replace('{id}', numericUserId.toString());
  }

  // formatWinixAmount.js
  function formatWinixAmount(amount, options) {
    options = options || {};
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      console.warn('formatWinixAmount: Invalid amount provided', amount);
      return '0';
    }

    const separator = options.separator || ' ';
    const decimals = options.decimals !== undefined ? options.decimals : 2;
    const showCurrency = options.showCurrency || false;
    const currencySymbol = options.currencySymbol || 'winix';

    const roundedAmount = Number(numAmount.toFixed(decimals));
    const formatted = roundedAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);

    return showCurrency ? formatted + ' ' + currencySymbol : formatted;
  }

  function abbreviateWinixAmount(amount, options) {
    options = options || {};
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      console.warn('abbreviateWinixAmount: Invalid amount provided', amount);
      return '0';
    }

    const decimals = options.decimals !== undefined ? options.decimals : 1;
    const showCurrency = options.showCurrency || false;
    const currencySymbol = options.currencySymbol || 'winix';

    let result;
    if (numAmount >= 1000000000) {
      result = (numAmount / 1000000000).toFixed(decimals) + 'B';
    } else if (numAmount >= 1000000) {
      result = (numAmount / 1000000).toFixed(decimals) + 'M';
    } else if (numAmount >= 1000) {
      result = (numAmount / 1000).toFixed(decimals) + 'K';
    } else {
      result = numAmount.toFixed(decimals);
    }

    result = result.replace(/\.0+([KMBT])?$/, '$1');

    return showCurrency ? result + ' ' + currencySymbol : result;
  }

  function formatWinixWithTrend(amount, options) {
    options = options || {};
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      console.warn('formatWinixWithTrend: Invalid amount provided', amount);
      return '0';
    }

    const showPlus = options.showPlus !== false;
    const colorize = options.colorize || false;
    const separator = options.separator || ' ';
    const showCurrency = options.showCurrency || false;

    const formatted = formatWinixAmount(Math.abs(numAmount), {
      separator: separator,
      showCurrency: showCurrency
    });

    let result;
    if (numAmount > 0) {
      result = showPlus ? '+' + formatted : formatted;
      if (colorize) {
        result = '<span class="positive-trend">' + result + '</span>';
      }
    } else if (numAmount < 0) {
      result = '-' + formatted;
      if (colorize) {
        result = '<span class="negative-trend">' + result + '</span>';
      }
    } else {
      result = formatted;
    }

    return result;
  }

  function formatWinixCompact(amount, maxLength) {
    maxLength = maxLength || 6;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      console.warn('formatWinixCompact: Invalid amount provided', amount);
      return '0';
    }

    let formatted = abbreviateWinixAmount(numAmount);

    if (formatted.length > maxLength) {
      const hasLetter = /[KMBT]$/.test(formatted);
      if (hasLetter) {
        const letter = formatted.slice(-1);
        formatted = parseFloat(formatted).toFixed(0) + letter;
      } else {
        formatted = parseFloat(formatted).toFixed(0);
      }
    }

    return formatted;
  }

  function normalizeWinixAmount(amount) {
    if (typeof amount === 'number') {
      return amount;
    }

    if (typeof amount !== 'string') {
      console.warn('normalizeWinixAmount: Invalid amount provided', amount);
      return 0;
    }

    const cleaned = amount.replace(/[^\d.-]/g, '');
    const numAmount = parseFloat(cleaned);

    return isNaN(numAmount) ? 0 : numAmount;
  }

  // isActiveReferral.js
  function isActiveReferral(referralData, options) {
    options = options || {};
    if (!referralData) {
      return false;
    }

    const drawsParticipation = referralData.drawsParticipation || 0;
    const invitedReferrals = referralData.invitedReferrals || 0;
    const manuallyActivated = referralData.manuallyActivated || false;

    const drawsThreshold = options.drawsThreshold !== undefined
      ? options.drawsThreshold
      : window.ReferralConstants.MIN_DRAWS_PARTICIPATION;
    const invitedThreshold = options.invitedThreshold !== undefined
      ? options.invitedThreshold
      : window.ReferralConstants.MIN_INVITED_REFERRALS;
    const requireAllCriteria = options.requireAllCriteria || false;

    if (manuallyActivated) {
      return true;
    }

    const meetsDrawsCriteria = drawsParticipation >= drawsThreshold;
    const meetsInvitedCriteria = invitedReferrals >= invitedThreshold;

    if (requireAllCriteria) {
      return meetsDrawsCriteria && meetsInvitedCriteria;
    } else {
      return meetsDrawsCriteria || meetsInvitedCriteria;
    }
  }

  function getDetailedActivityStatus(referralData, options) {
    options = options || {};
    if (!referralData) {
      return {
        isActive: false,
        drawsParticipation: 0,
        invitedReferrals: 0,
        meetsDrawsCriteria: false,
        meetsInvitedCriteria: false,
        manuallyActivated: false,
        reasonForActivity: null
      };
    }

    const drawsParticipation = referralData.drawsParticipation || 0;
    const invitedReferrals = referralData.invitedReferrals || 0;
    const manuallyActivated = referralData.manuallyActivated || false;

    const drawsThreshold = options.drawsThreshold !== undefined
      ? options.drawsThreshold
      : window.ReferralConstants.MIN_DRAWS_PARTICIPATION;
    const invitedThreshold = options.invitedThreshold !== undefined
      ? options.invitedThreshold
      : window.ReferralConstants.MIN_INVITED_REFERRALS;

    const meetsDrawsCriteria = drawsParticipation >= drawsThreshold;
    const meetsInvitedCriteria = invitedReferrals >= invitedThreshold;

    let reasonForActivity = null;

    if (manuallyActivated) {
      reasonForActivity = 'manual_activation';
    } else if (meetsDrawsCriteria && meetsInvitedCriteria) {
      reasonForActivity = 'both_criteria';
    } else if (meetsDrawsCriteria) {
      reasonForActivity = 'draws_criteria';
    } else if (meetsInvitedCriteria) {
      reasonForActivity = 'invited_criteria';
    }

    const isActive = manuallyActivated || meetsDrawsCriteria || meetsInvitedCriteria;

    return {
      isActive: isActive,
      drawsParticipation: drawsParticipation,
      invitedReferrals: invitedReferrals,
      requiredDraws: drawsThreshold,
      requiredInvited: invitedThreshold,
      meetsDrawsCriteria: meetsDrawsCriteria,
      meetsInvitedCriteria: meetsInvitedCriteria,
      manuallyActivated: manuallyActivated,
      reasonForActivity: reasonForActivity
    };
  }

  // sortReferralsByEarnings.js
  function sortReferralsByEarnings(referrals, options) {
    options = options || {};
    if (!Array.isArray(referrals)) {
      console.error('sortReferralsByEarnings: referrals must be an array');
      return [];
    }

    const ascending = options.ascending || false;
    const earningsField = options.earningsField || 'totalEarnings';

    return referrals.slice().sort(function(a, b) {
      const aEarnings = parseFloat(a[earningsField] || 0);
      const bEarnings = parseFloat(b[earningsField] || 0);

      return ascending ? aEarnings - bEarnings : bEarnings - aEarnings;
    });
  }

  function sortByPercentageRewards(referrals, ascending) {
    return sortReferralsByEarnings(referrals, {
      ascending: ascending,
      earningsField: 'percentageEarnings'
    });
  }

  function sortByInvitedCount(referrals, ascending) {
    return sortReferralsByEarnings(referrals, {
      ascending: ascending,
      earningsField: 'invitedCount'
    });
  }

  function sortByDrawsParticipation(referrals, ascending) {
    return sortReferralsByEarnings(referrals, {
      ascending: ascending,
      earningsField: 'drawsParticipation'
    });
  }

  function sortByActivity(referrals) {
    if (!Array.isArray(referrals)) {
      console.error('sortByActivity: referrals must be an array');
      return [];
    }

    return referrals.slice().sort(function(a, b) {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;

      const aEarnings = parseFloat(a.totalEarnings || 0);
      const bEarnings = parseFloat(b.totalEarnings || 0);

      return bEarnings - aEarnings;
    });
  }

  function filterAndSortReferrals(referrals, filters, sortOptions) {
    filters = filters || {};
    sortOptions = sortOptions || {};

    if (!Array.isArray(referrals)) {
      console.error('filterAndSortReferrals: referrals must be an array');
      return [];
    }

    const onlyActive = filters.onlyActive;
    const minEarnings = filters.minEarnings || 0;
    const by = sortOptions.by || 'earnings';
    const ascending = sortOptions.ascending || false;

    let filtered = referrals.slice();

    if (onlyActive) {
      filtered = filtered.filter(function(referral) {
        return referral.active;
      });
    }

    if (minEarnings > 0) {
      filtered = filtered.filter(function(referral) {
        const earnings = parseFloat(referral.totalEarnings || 0);
        return earnings >= minEarnings;
      });
    }

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
        return sortReferralsByEarnings(filtered, { ascending: ascending });
    }
  }

  // generateReferralLink.js (виправлено для числових ID)
  function generateReferralLink(userId) {
    if (!userId) {
      throw new Error('User ID обов\'язковий');
    }

    // Переконуємося що userId це число
    const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
    if (isNaN(numericUserId)) {
      throw new Error('User ID повинен бути числом');
    }

    return new Promise(function(resolve, reject) {
      try {
        // Викликаємо API функцію через глобальну змінну
        window.ReferralAPI.fetchReferralLink(numericUserId)
          .then(function(referralLink) {
            // Форматуємо URL через утиліту
            resolve(formatReferralUrl(numericUserId));
          })
          .catch(function(error) {
            console.error('Error generating referral link:', error);
            reject(new Error('Failed to generate referral link: ' + error.message));
          });
      } catch (error) {
        console.error('Error generating referral link:', error);
        reject(new Error('Failed to generate referral link: ' + error.message));
      }
    });
  }

  // Публічний API
  return {
    calculatePercentage: calculatePercentage,
    formatPercentageResult: formatPercentageResult,
    calculateMultiplePercentages: calculateMultiplePercentages,
    formatReferralUrl: formatReferralUrl,
    formatWinixAmount: formatWinixAmount,
    abbreviateWinixAmount: abbreviateWinixAmount,
    formatWinixWithTrend: formatWinixWithTrend,
    formatWinixCompact: formatWinixCompact,
    normalizeWinixAmount: normalizeWinixAmount,
    isActiveReferral: isActiveReferral,
    getDetailedActivityStatus: getDetailedActivityStatus,
    sortReferralsByEarnings: sortReferralsByEarnings,
    sortByPercentageRewards: sortByPercentageRewards,
    sortByInvitedCount: sortByInvitedCount,
    sortByDrawsParticipation: sortByDrawsParticipation,
    sortByActivity: sortByActivity,
    filterAndSortReferrals: filterAndSortReferrals,
    generateReferralLink: generateReferralLink
  };
})();