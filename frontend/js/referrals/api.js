// api.js - Традиційна версія без ES6 модулів
/**
 * API функції для реферальної системи
 */
window.ReferralAPI = (function() {
  'use strict';

  // fetchBadges.js
  function fetchUserBadges(userId) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання даних про бейджі');
    }

    return fetch('/api/badges/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.message || data.error || 'Помилка отримання даних про бейджі');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання даних про бейджі:', error);
        throw new Error('Не вдалося отримати дані про бейджі: ' + (error.message || 'Невідома помилка'));
      });
  }

  function checkBadges(userId) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для перевірки бейджів');
    }

    return fetch('/api/badges/check/' + userId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Помилка перевірки бейджів');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Помилка перевірки бейджів:', error);
      throw new Error('Не вдалося перевірити бейджі: ' + (error.message || 'Невідома помилка'));
    });
  }

  function claimBadgeReward(userId, badgeType) {
    if (!userId || !badgeType) {
      throw new Error('ID користувача та тип бейджа обов\'язкові для отримання винагороди');
    }

    return fetch('/api/badges/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        badge_type: badgeType
      })
    })
    .then(function(response) {
      return response.json().then(function(data) {
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
      });
    })
    .catch(function(error) {
      console.error('Помилка отримання винагороди за бейдж:', error);
      throw new Error('Не вдалося отримати винагороду: ' + (error.message || 'Невідома помилка'));
    });
  }

  // fetchReferralActivity.js
  function fetchReferralActivity(userId, options) {
    options = options || {};
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання даних про активність');
    }

    return fetch('/api/referrals/activity/' + userId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Помилка отримання даних про активність');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Помилка отримання даних про активність рефералів:', error);
      throw new Error('Не вдалося отримати дані про активність: ' + (error.message || 'Невідома помилка'));
    });
  }

  function fetchReferralDetailedActivity(referralId, options) {
    options = options || {};
    if (!referralId) {
      throw new Error('ID реферала обов\'язковий для отримання детальних даних');
    }

    let url = '/api/referrals/activity/detailed/' + referralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Помилка отримання детальних даних про активність');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання детальних даних про активність:', error);
        throw new Error('Не вдалося отримати детальні дані: ' + (error.message || 'Невідома помилка'));
      });
  }

  function fetchActivitySummary(userId) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання даних про активність');
    }

    return fetch('/api/referrals/activity/summary/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Помилка отримання зведених даних про активність');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання зведених даних про активність:', error);
        throw new Error('Не вдалося отримати зведені дані: ' + (error.message || 'Невідома помилка'));
      });
  }

  function updateReferralActivity(userId, drawsParticipation, invitedReferrals) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для оновлення активності');
    }

    return fetch('/api/referrals/activity/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        draws_participation: drawsParticipation,
        invited_referrals: invitedReferrals
      })
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Помилка оновлення даних про активність');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Помилка оновлення даних про активність:', error);
      throw new Error('Не вдалося оновити дані про активність: ' + (error.message || 'Невідома помилка'));
    });
  }

  function manuallyActivateReferral(userId, adminId) {
    if (!userId || !adminId) {
      throw new Error('ID користувача та адміністратора обов\'язкові для ручної активації');
    }

    return fetch('/api/referrals/activity/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        admin_id: adminId
      })
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Помилка ручної активації реферала');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Помилка ручної активації реферала:', error);
      throw new Error('Не вдалося активувати реферала: ' + (error.message || 'Невідома помилка'));
    });
  }

  // fetchReferralDraws.js
  function fetchReferralDraws(referralId) {
    if (!referralId) {
      throw new Error('referralId is required');
    }

    return fetch('/api/referrals/draws/' + referralId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch referral draws data');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral draws:', error);
        throw new Error('Failed to fetch referral draws data');
      });
  }

  function fetchDrawDetails(referralId, drawId) {
    if (!referralId || !drawId) {
      throw new Error('referralId and drawId are required');
    }

    return fetch('/api/referrals/draws/details/' + referralId + '/' + drawId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch draw details');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching draw details:', error);
        throw new Error('Failed to fetch draw details');
      });
  }

  function fetchDrawsParticipationStats(ownerId, options) {
    options = options || {};
    if (!ownerId) {
      throw new Error('ownerId is required');
    }

    let url = '/api/referrals/draws/stats/' + ownerId;
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
      url += '?' + params.toString();
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch draws participation stats');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching draws participation stats:', error);
        throw new Error('Failed to fetch draws participation stats');
      });
  }

  function fetchTotalDrawsCount(ownerId) {
    if (!ownerId) {
      throw new Error('ownerId is required');
    }

    return fetch('/api/referrals/draws/count/' + ownerId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch total draws count');
          }
          return data.totalDrawsCount || 0;
        });
      })
      .catch(function(error) {
        console.error('Error fetching total draws count:', error);
        throw new Error('Failed to fetch total draws count');
      });
  }

  function fetchMostActiveInDraws(ownerId, limit) {
    limit = limit || 10;
    if (!ownerId) {
      throw new Error('ownerId is required');
    }

    return fetch('/api/referrals/draws/active/' + ownerId + '?limit=' + limit)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch most active referrals in draws');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching most active referrals in draws:', error);
        throw new Error('Failed to fetch most active referrals in draws');
      });
  }

  // fetchReferralEarnings.js
  function fetchReferralEarnings(userId, options) {
    options = options || {};
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання даних про заробітки');
    }

    return fetch('/api/referrals/earnings/' + userId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Помилка отримання даних про заробітки');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Помилка отримання даних про заробітки рефералів:', error);
      throw new Error('Не вдалося отримати дані про заробітки: ' + (error.message || 'Невідома помилка'));
    });
  }

  function fetchReferralDetailedEarnings(referralId, options) {
    options = options || {};
    if (!referralId) {
      throw new Error('ID реферала обов\'язковий для отримання детальних даних');
    }

    let url = '/api/referrals/earnings/detailed/' + referralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Помилка отримання детальних даних про заробітки');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання детальних даних про заробітки:', error);
        throw new Error('Не вдалося отримати детальні дані: ' + (error.message || 'Невідома помилка'));
      });
  }

  function fetchEarningsSummary(userId) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання зведених даних');
    }

    return fetch('/api/referrals/earnings/summary/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Помилка отримання зведених даних про заробітки');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання зведених даних про заробітки:', error);
        throw new Error('Не вдалося отримати зведені дані: ' + (error.message || 'Невідома помилка'));
      });
  }

  // fetchReferralHistory.js
  function fetchReferralHistory(userId, options) {
    options = options || {};
    if (!userId) {
      throw new Error('userId is required');
    }

    let url = '/api/referrals/history/' + userId;

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
      url += '?' + queryString;
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch referral history');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral history:', error);
        throw new Error('Failed to fetch referral history: ' + error.message);
      });
  }

  function fetchReferralEventHistory(userId, eventType, options) {
    options = options || {};
    if (!userId || !eventType) {
      throw new Error('userId and eventType are required');
    }

    let url = '/api/referrals/history/event/' + userId + '/' + eventType;

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
      url += '?' + queryString;
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch ' + eventType + ' history');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching ' + eventType + ' history:', error);
        throw new Error('Failed to fetch ' + eventType + ' history: ' + error.message);
      });
  }

  function fetchReferralActivitySummary(userId, options) {
    options = options || {};
    if (!userId) {
      throw new Error('userId is required');
    }

    let url = '/api/referrals/history/summary/' + userId;

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
      url += '?' + queryString;
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch referral activity summary');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral activity summary:', error);
        throw new Error('Failed to fetch referral activity summary: ' + error.message);
      });
  }

  function fetchReferralActivityTrend(userId, period, options) {
    period = period || 'monthly';
    options = options || {};
    if (!userId) {
      throw new Error('userId is required');
    }

    let url = '/api/referrals/history/trend/' + userId + '/' + period;

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
      url += '?' + queryString;
    }

    return fetch(url)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch referral activity trend');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral activity trend:', error);
        throw new Error('Failed to fetch referral activity trend: ' + error.message);
      });
  }

  // fetchReferralLink.js
  function fetchReferralLink(userId) {
    if (!userId) {
      throw new Error('User ID is required for fetching referral link');
    }

    return fetch('/api/referrals/link/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch referral link from server');
          }
          return data.referral_link || userId.toString();
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral link:', error);
        throw new Error('Failed to fetch referral link from server');
      });
  }

  // fetchReferralStats.js
  function fetchReferralStats(userId) {
    if (!userId) {
      throw new Error('User ID is required for fetching referral statistics');
    }

    return fetch('/api/referrals/stats/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch referral statistics');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral statistics:', error);
        throw new Error('Failed to fetch referral statistics: ' + (error.message || 'Unknown error'));
      });
  }

  function fetchReferralDetails(referralId) {
    if (!referralId) {
      throw new Error('Referral ID is required');
    }

    return fetch('/api/referrals/details/' + referralId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch referral details');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Error fetching referral details:', error);
        throw new Error('Failed to fetch referral details');
      });
  }

  // fetchTasks.js
  function fetchUserTasks(userId) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для отримання даних про завдання');
    }

    return fetch('/api/tasks/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.message || data.error || 'Помилка отримання даних про завдання');
          }
          return data;
        });
      })
      .catch(function(error) {
        console.error('Помилка отримання даних про завдання:', error);
        throw new Error('Не вдалося отримати дані про завдання: ' + (error.message || 'Невідома помилка'));
      });
  }

  function updateTasks(userId) {
    if (!userId) {
      throw new Error('ID користувача обов\'язковий для оновлення завдань');
    }

    return fetch('/api/tasks/update/' + userId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Помилка оновлення завдань');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Помилка оновлення завдань:', error);
      throw new Error('Не вдалося оновити завдання: ' + (error.message || 'Невідома помилка'));
    });
  }

  function claimTaskReward(userId, taskType) {
    if (!userId || !taskType) {
      throw new Error('ID користувача та тип завдання обов\'язкові для отримання винагороди');
    }

    return fetch('/api/tasks/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        task_type: taskType
      })
    })
    .then(function(response) {
      return response.json().then(function(data) {
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
      });
    })
    .catch(function(error) {
      console.error('Помилка отримання винагороди за завдання:', error);
      throw new Error('Не вдалося отримати винагороду: ' + (error.message || 'Невідома помилка'));
    });
  }

  // registerReferral.js
  function registerReferral(referrerId, userId) {
    if (!referrerId) {
      throw new Error('Referrer ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (referrerId === userId) {
      throw new Error('User cannot refer themselves');
    }

    return fetch('/api/referrals/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer_id: referrerId, referee_id: userId })
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.error || data.details || 'Failed to register referral');
        }
        return data;
      });
    })
    .catch(function(error) {
      console.error('Error registering referral:', error);
      throw new Error('Failed to register referral: ' + (error.message || 'Unknown error'));
    });
  }

  function checkIfReferral(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return fetch('/api/referrals/stats/' + userId)
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) {
            throw new Error(data.error || 'Failed to check referral status');
          }

          if (data && data.referrals) {
            return true;
          }

          return false;
        });
      })
      .catch(function(error) {
        console.error('Error checking referral status:', error);
        throw new Error('Failed to check referral status');
      });
  }

  // Публічний API
  return {
    fetchUserBadges: fetchUserBadges,
    checkBadges: checkBadges,
    claimBadgeReward: claimBadgeReward,
    fetchReferralActivity: fetchReferralActivity,
    fetchReferralDetailedActivity: fetchReferralDetailedActivity,
    fetchActivitySummary: fetchActivitySummary,
    updateReferralActivity: updateReferralActivity,
    manuallyActivateReferral: manuallyActivateReferral,
    fetchReferralDraws: fetchReferralDraws,
    fetchDrawDetails: fetchDrawDetails,
    fetchDrawsParticipationStats: fetchDrawsParticipationStats,
    fetchTotalDrawsCount: fetchTotalDrawsCount,
    fetchMostActiveInDraws: fetchMostActiveInDraws,
    fetchReferralEarnings: fetchReferralEarnings,
    fetchReferralDetailedEarnings: fetchReferralDetailedEarnings,
    fetchEarningsSummary: fetchEarningsSummary,
    fetchReferralHistory: fetchReferralHistory,
    fetchReferralEventHistory: fetchReferralEventHistory,
    fetchReferralActivitySummary: fetchReferralActivitySummary,
    fetchReferralActivityTrend: fetchReferralActivityTrend,
    fetchReferralLink: fetchReferralLink,
    fetchReferralStats: fetchReferralStats,
    fetchReferralDetails: fetchReferralDetails,
    fetchUserTasks: fetchUserTasks,
    updateTasks: updateTasks,
    claimTaskReward: claimTaskReward,
    registerReferral: registerReferral,
    checkIfReferral: checkIfReferral
  };
})();