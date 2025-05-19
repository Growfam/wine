// calculatePercentage.js
export const calculatePercentage = (amount, rate, round = true) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Сума повинна бути числом');
  }

  if (typeof rate !== 'number' || isNaN(rate) || rate < 0) {
    throw new Error('Ставка повинна бути додатнім числом');
  }

  const result = amount * rate;
  return round ? Math.round(result) : result;
};

export const formatPercentageResult = (amount, rate, options = {}) => {
  const {
    prefix = '',
    suffix = '',
    showPercentage = false
  } = options;

  const calculatedAmount = calculatePercentage(amount, rate);

  const percentageString = showPercentage
    ? ` (${(rate * 100).toFixed(1)}%)`
    : '';

  return `${prefix}${calculatedAmount}${suffix}${percentageString}`;
};

export const calculateMultiplePercentages = (amount, rates) => {
  if (!Array.isArray(rates)) {
    throw new Error('Ставки повинні бути передані масивом');
  }

  return rates.map(rate => calculatePercentage(amount, rate));
};

// formatReferralUrl.js
export const formatReferralUrl = (userId) => {
  if (!userId) {
    throw new Error('User ID is required for generating referral link');
  }

  if (typeof userId !== 'string' && typeof userId !== 'number') {
    throw new Error('User ID must be a string or number');
  }

  const REFERRAL_URL_PATTERN = 'Winix/referral/{id}';
  return REFERRAL_URL_PATTERN.replace('{id}', userId);
};

// formatWinixAmount.js
export const formatWinixAmount = (amount, options = {}) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('formatWinixAmount: Invalid amount provided', amount);
    return '0';
  }

  const {
    separator = ' ',
    decimals = 2,
    showCurrency = false,
    currencySymbol = 'winix'
  } = options;

  const roundedAmount = Number(numAmount.toFixed(decimals));
  const formatted = roundedAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return showCurrency ? `${formatted} ${currencySymbol}` : formatted;
};

export const abbreviateWinixAmount = (amount, options = {}) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('abbreviateWinixAmount: Invalid amount provided', amount);
    return '0';
  }

  const {
    decimals = 1,
    showCurrency = false,
    currencySymbol = 'winix'
  } = options;

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

  return showCurrency ? `${result} ${currencySymbol}` : result;
};

export const formatWinixWithTrend = (amount, options = {}) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('formatWinixWithTrend: Invalid amount provided', amount);
    return '0';
  }

  const {
    showPlus = true,
    colorize = false,
    separator = ' ',
    showCurrency = false
  } = options;

  const formatted = formatWinixAmount(Math.abs(numAmount), {
    separator,
    showCurrency
  });

  let result;
  if (numAmount > 0) {
    result = showPlus ? `+${formatted}` : formatted;
    if (colorize) {
      result = `<span class="positive-trend">${result}</span>`;
    }
  } else if (numAmount < 0) {
    result = `-${formatted}`;
    if (colorize) {
      result = `<span class="negative-trend">${result}</span>`;
    }
  } else {
    result = formatted;
  }

  return result;
};

export const formatWinixCompact = (amount, maxLength = 6) => {
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
};

export const normalizeWinixAmount = (amount) => {
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
};

// isActiveReferral.js
export const isActiveReferral = (referralData, options = {}) => {
  if (!referralData) {
    return false;
  }

  const {
    drawsParticipation = 0,
    invitedReferrals = 0,
    manuallyActivated = false
  } = referralData;

  const {
    drawsThreshold = 3, // MIN_DRAWS_PARTICIPATION
    invitedThreshold = 1, // MIN_INVITED_REFERRALS
    requireAllCriteria = false
  } = options;

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
};

export const getDetailedActivityStatus = (referralData, options = {}) => {
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

  const {
    drawsParticipation = 0,
    invitedReferrals = 0,
    manuallyActivated = false
  } = referralData;

  const {
    drawsThreshold = 3, // MIN_DRAWS_PARTICIPATION
    invitedThreshold = 1 // MIN_INVITED_REFERRALS
  } = options;

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
    isActive,
    drawsParticipation,
    invitedReferrals,
    requiredDraws: drawsThreshold,
    requiredInvited: invitedThreshold,
    meetsDrawsCriteria,
    meetsInvitedCriteria,
    manuallyActivated,
    reasonForActivity
  };
};

// sortReferralsByEarnings.js
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

export const sortByPercentageRewards = (referrals, ascending = false) => {
  return sortReferralsByEarnings(referrals, {
    ascending,
    earningsField: 'percentageEarnings'
  });
};

export const sortByInvitedCount = (referrals, ascending = false) => {
  return sortReferralsByEarnings(referrals, {
    ascending,
    earningsField: 'invitedCount'
  });
};

export const sortByDrawsParticipation = (referrals, ascending = false) => {
  return sortReferralsByEarnings(referrals, {
    ascending,
    earningsField: 'drawsParticipation'
  });
};

export const sortByActivity = (referrals) => {
  if (!Array.isArray(referrals)) {
    console.error('sortByActivity: referrals must be an array');
    return [];
  }

  return [...referrals].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;

    const aEarnings = parseFloat(a.totalEarnings || 0);
    const bEarnings = parseFloat(b.totalEarnings || 0);

    return bEarnings - aEarnings;
  });
};

export const filterAndSortReferrals = (referrals, filters = {}, sortOptions = {}) => {
  if (!Array.isArray(referrals)) {
    console.error('filterAndSortReferrals: referrals must be an array');
    return [];
  }

  const { onlyActive, minEarnings = 0 } = filters;
  const { by = 'earnings', ascending = false } = sortOptions;

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

// generateReferralLink.js
export const generateReferralLink = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Викликаємо API функцію через глобальну змінну
    const referralId = await window.ReferralAPI.fetchReferralLink(userId);

    // Форматуємо URL через утиліту
    return formatReferralUrl(referralId);
  } catch (error) {
    console.error('Error generating referral link:', error);
    throw new Error('Failed to generate referral link');
  }
};

// стора/редуктори скопіюю в наступний файл
// storeUtils.js можна включити в store.js