// fetchBadges.js
/**
 * API для отримання та взаємодії з бейджами користувача
 */
export const fetchUserBadges = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про бейджі');
  }

  try {
    const response = await fetch(`/api/badges/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання даних про бейджі');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про бейджі:', error);
    throw new Error(`Не вдалося отримати дані про бейджі: ${error.message || 'Невідома помилка'}`);
  }
};

export const checkBadges = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для перевірки бейджів');
  }

  try {
    const response = await fetch(`/api/badges/check/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка перевірки бейджів');
    }

    return data;
  } catch (error) {
    console.error('Помилка перевірки бейджів:', error);
    throw new Error(`Не вдалося перевірити бейджі: ${error.message || 'Невідома помилка'}`);
  }
};

export const claimBadgeReward = async (userId, badgeType) => {
  if (!userId || !badgeType) {
    throw new Error('ID користувача та тип бейджа обов\'язкові для отримання винагороди');
  }

  try {
    const response = await fetch(`/api/badges/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        badge_type: badgeType
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання винагороди за бейдж');
    }

    if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
      try {
        const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
        window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
      } catch (e) {
        console.warn('Не вдалося оновити відображення балансу:', e);
      }
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання винагороди за бейдж:', error);
    throw new Error(`Не вдалося отримати винагороду: ${error.message || 'Невідома помилка'}`);
  }
};

// fetchReferralActivity.js
export const fetchReferralActivity = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про активність');
  }

  try {
    const response = await fetch(`/api/referrals/activity/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про активність рефералів:', error);
    throw new Error(`Не вдалося отримати дані про активність: ${error.message || 'Невідома помилка'}`);
  }
};

export const fetchReferralDetailedActivity = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для отримання детальних даних');
  }

  try {
    let url = `/api/referrals/activity/detailed/${referralId}`;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання детальних даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання детальних даних про активність:', error);
    throw new Error(`Не вдалося отримати детальні дані: ${error.message || 'Невідома помилка'}`);
  }
};

export const fetchActivitySummary = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про активність');
  }

  try {
    const response = await fetch(`/api/referrals/activity/summary/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання зведених даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання зведених даних про активність:', error);
    throw new Error(`Не вдалося отримати зведені дані: ${error.message || 'Невідома помилка'}`);
  }
};

export const updateReferralActivity = async (userId, drawsParticipation, invitedReferrals) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для оновлення активності');
  }

  try {
    const response = await fetch('/api/referrals/activity/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        draws_participation: drawsParticipation,
        invited_referrals: invitedReferrals
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка оновлення даних про активність');
    }

    return data;
  } catch (error) {
    console.error('Помилка оновлення даних про активність:', error);
    throw new Error(`Не вдалося оновити дані про активність: ${error.message || 'Невідома помилка'}`);
  }
};

export const manuallyActivateReferral = async (userId, adminId) => {
  if (!userId || !adminId) {
    throw new Error('ID користувача та адміністратора обов\'язкові для ручної активації');
  }

  try {
    const response = await fetch('/api/referrals/activity/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        admin_id: adminId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка ручної активації реферала');
    }

    return data;
  } catch (error) {
    console.error('Помилка ручної активації реферала:', error);
    throw new Error(`Не вдалося активувати реферала: ${error.message || 'Невідома помилка'}`);
  }
};

// fetchReferralDraws.js
export const fetchReferralDraws = async (referralId) => {
  if (!referralId) {
    throw new Error('referralId is required');
  }

  try {
    const response = await fetch(`/api/referrals/draws/${referralId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch referral draws data');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral draws:', error);
    throw new Error('Failed to fetch referral draws data');
  }
};

export const fetchDrawDetails = async (referralId, drawId) => {
  if (!referralId || !drawId) {
    throw new Error('referralId and drawId are required');
  }

  try {
    const response = await fetch(`/api/referrals/draws/details/${referralId}/${drawId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch draw details');
    }

    return data;
  } catch (error) {
    console.error('Error fetching draw details:', error);
    throw new Error('Failed to fetch draw details');
  }
};

export const fetchDrawsParticipationStats = async (ownerId, options = {}) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    let url = `/api/referrals/draws/stats/${ownerId}`;
    const params = new URLSearchParams();

    if (options.startDate) {
      params.append('startDate', options.startDate instanceof Date
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      params.append('endDate', options.endDate instanceof Date
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch draws participation stats');
    }

    return data;
  } catch (error) {
    console.error('Error fetching draws participation stats:', error);
    throw new Error('Failed to fetch draws participation stats');
  }
};

export const fetchTotalDrawsCount = async (ownerId) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    const response = await fetch(`/api/referrals/draws/count/${ownerId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch total draws count');
    }

    return data.totalDrawsCount || 0;
  } catch (error) {
    console.error('Error fetching total draws count:', error);
    throw new Error('Failed to fetch total draws count');
  }
};

export const fetchMostActiveInDraws = async (ownerId, limit = 10) => {
  if (!ownerId) {
    throw new Error('ownerId is required');
  }

  try {
    const response = await fetch(`/api/referrals/draws/active/${ownerId}?limit=${limit}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch most active referrals in draws');
    }

    return data;
  } catch (error) {
    console.error('Error fetching most active referrals in draws:', error);
    throw new Error('Failed to fetch most active referrals in draws');
  }
};

// fetchReferralEarnings.js
export const fetchReferralEarnings = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про заробітки');
  }

  try {
    const response = await fetch(`/api/referrals/earnings/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання даних про заробітки');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про заробітки рефералів:', error);
    throw new Error(`Не вдалося отримати дані про заробітки: ${error.message || 'Невідома помилка'}`);
  }
};

export const fetchReferralDetailedEarnings = async (referralId, options = {}) => {
  if (!referralId) {
    throw new Error('ID реферала обов\'язковий для отримання детальних даних');
  }

  try {
    let url = `/api/referrals/earnings/detailed/${referralId}`;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання детальних даних про заробітки');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання детальних даних про заробітки:', error);
    throw new Error(`Не вдалося отримати детальні дані: ${error.message || 'Невідома помилка'}`);
  }
};

export const fetchEarningsSummary = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання зведених даних');
  }

  try {
    const response = await fetch(`/api/referrals/earnings/summary/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Помилка отримання зведених даних про заробітки');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання зведених даних про заробітки:', error);
    throw new Error(`Не вдалося отримати зведені дані: ${error.message || 'Невідома помилка'}`);
  }
};

// fetchReferralHistory.js
export const fetchReferralHistory = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    let url = `/api/referrals/history/${userId}`;

    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    if (options.type) {
      queryParams.append('type', options.type);
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch referral history');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral history:', error);
    throw new Error(`Failed to fetch referral history: ${error.message}`);
  }
};

export const fetchReferralEventHistory = async (userId, eventType, options = {}) => {
  if (!userId || !eventType) {
    throw new Error('userId and eventType are required');
  }

  try {
    let url = `/api/referrals/history/event/${userId}/${eventType}`;

    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch ${eventType} history`);
    }

    return data;
  } catch (error) {
    console.error(`Error fetching ${eventType} history:`, error);
    throw new Error(`Failed to fetch ${eventType} history: ${error.message}`);
  }
};

export const fetchReferralActivitySummary = async (userId, options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    let url = `/api/referrals/history/summary/${userId}`;

    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch referral activity summary');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral activity summary:', error);
    throw new Error(`Failed to fetch referral activity summary: ${error.message}`);
  }
};

export const fetchReferralActivityTrend = async (userId, period = 'monthly', options = {}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    let url = `/api/referrals/history/trend/${userId}/${period}`;

    const queryParams = new URLSearchParams();

    if (options.startDate) {
      queryParams.append('startDate', typeof options.startDate === 'object'
        ? options.startDate.toISOString()
        : options.startDate);
    }

    if (options.endDate) {
      queryParams.append('endDate', typeof options.endDate === 'object'
        ? options.endDate.toISOString()
        : options.endDate);
    }

    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch referral activity trend');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral activity trend:', error);
    throw new Error(`Failed to fetch referral activity trend: ${error.message}`);
  }
};

// fetchReferralLink.js
export const fetchReferralLink = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for fetching referral link');
  }

  try {
    const response = await fetch(`/api/referrals/link/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch referral link from server');
    }

    return data.referral_link || userId.toString();
  } catch (error) {
    console.error('Error fetching referral link:', error);
    throw new Error('Failed to fetch referral link from server');
  }
};

// fetchReferralStats.js
export const fetchReferralStats = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for fetching referral statistics');
  }

  try {
    const response = await fetch(`/api/referrals/stats/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch referral statistics');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral statistics:', error);
    throw new Error('Failed to fetch referral statistics: ' + (error.message || 'Unknown error'));
  }
};

export const fetchReferralDetails = async (referralId) => {
  if (!referralId) {
    throw new Error('Referral ID is required');
  }

  try {
    const response = await fetch(`/api/referrals/details/${referralId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch referral details');
    }

    return data;
  } catch (error) {
    console.error('Error fetching referral details:', error);
    throw new Error('Failed to fetch referral details');
  }
};

// fetchTasks.js
export const fetchUserTasks = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про завдання');
  }

  try {
    const response = await fetch(`/api/tasks/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання даних про завдання');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про завдання:', error);
    throw new Error(`Не вдалося отримати дані про завдання: ${error.message || 'Невідома помилка'}`);
  }
};

export const updateTasks = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для оновлення завдань');
  }

  try {
    const response = await fetch(`/api/tasks/update/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка оновлення завдань');
    }

    return data;
  } catch (error) {
    console.error('Помилка оновлення завдань:', error);
    throw new Error(`Не вдалося оновити завдання: ${error.message || 'Невідома помилка'}`);
  }
};

export const claimTaskReward = async (userId, taskType) => {
  if (!userId || !taskType) {
    throw new Error('ID користувача та тип завдання обов\'язкові для отримання винагороди');
  }

  try {
    const response = await fetch(`/api/tasks/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        task_type: taskType
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання винагороди за завдання');
    }

    if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
      try {
        const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
        window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
      } catch (e) {
        console.warn('Не вдалося оновити відображення балансу:', e);
      }
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання винагороди за завдання:', error);
    throw new Error(`Не вдалося отримати винагороду: ${error.message || 'Невідома помилка'}`);
  }
};

// registerReferral.js
export const registerReferral = async (referrerId, userId) => {
  if (!referrerId) {
    throw new Error('Referrer ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  if (referrerId === userId) {
    throw new Error('User cannot refer themselves');
  }

  try {
    const response = await fetch('/api/referrals/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer_id: referrerId, referee_id: userId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to register referral');
    }

    return data;
  } catch (error) {
    console.error('Error registering referral:', error);
    throw new Error('Failed to register referral: ' + (error.message || 'Unknown error'));
  }
};

export const checkIfReferral = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const response = await fetch(`/api/referrals/stats/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check referral status');
    }

    if (data && data.referrals) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking referral status:', error);
    throw new Error('Failed to check referral status');
  }
};