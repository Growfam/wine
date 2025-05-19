// api.js - Виправлена версія з обробкою помилок
/**
 * API функції для реферальної системи
 */
window.ReferralAPI = (function() {
  'use strict';

  // Базова конфігурація API
  const API_CONFIG = {
    baseUrl: '/api',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  // Утилітарна функція для виконання HTTP запитів з обробкою помилок
  function apiRequest(url, options) {
    options = options || {};
    const controller = new AbortController();
    const timeoutId = setTimeout(function() {
      controller.abort();
    }, API_CONFIG.timeout);

    const fetchOptions = Object.assign({
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    }, options);

    return fetch(url, fetchOptions)
      .then(function(response) {
        clearTimeout(timeoutId);

        // Перевіряємо чи відповідь в порядку
        if (!response.ok) {
          // Створюємо детальну помилку
          const error = new Error('HTTP ' + response.status + ': ' + response.statusText);
          error.status = response.status;
          error.statusText = response.statusText;
          throw error;
        }

        return response.json().catch(function() {
          // Якщо не можемо парсити JSON, повертаємо пусту відповідь
          return {};
        });
      })
      .catch(function(error) {
        clearTimeout(timeoutId);

        // Обробляємо різні типи помилок
        if (error.name === 'AbortError') {
          throw new Error('Запит перевищив час очікування (' + API_CONFIG.timeout + 'мс)');
        }

        if (error.status === 404) {
          throw new Error('API ендпоінт не знайдено: ' + url);
        }

        if (error.status >= 500) {
          throw new Error('Помилка сервера (' + error.status + ')');
        }

        throw error;
      });
  }

  // Функція для створення mock даних коли API недоступний
  function createMockResponse(type, data) {
    console.warn('[REFERRAL_API] Використовуємо mock дані для:', type);

    switch (type) {
      case 'badges':
        return Promise.resolve({
          success: true,
          earnedBadges: [],
          availableBadges: ['BRONZE'],
          badgesProgress: [
            { type: 'BRONZE', threshold: 25, progress: 0, isEligible: false },
            { type: 'SILVER', threshold: 50, progress: 0, isEligible: false },
            { type: 'GOLD', threshold: 100, progress: 0, isEligible: false },
            { type: 'PLATINUM', threshold: 500, progress: 0, isEligible: false }
          ],
          totalBadgesCount: 4,
          earnedBadgesReward: 0,
          availableBadgesReward: 0
        });

      case 'stats':
        return Promise.resolve({
          success: true,
          statistics: {
            totalReferralsCount: 0,
            activeReferralsCount: 0,
            level1Count: 0,
            level2Count: 0
          }
        });

      case 'link':
        return Promise.resolve({
          success: true,
          referral_link: 'Winix/referral/' + (data || 'demo_user')
        });

      case 'history':
        return Promise.resolve({
          success: true,
          history: [],
          totalBonus: 0
        });

      default:
        return Promise.resolve({
          success: true,
          message: 'Mock відповідь для ' + type
        });
    }
  }

  // Основні API функції з fallback логікою

  // fetchBadges.js
  function fetchUserBadges(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про бейджі'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/' + userId)
      .catch(function(error) {
        console.warn('Помилка отримання даних про бейджі:', error.message);
        return createMockResponse('badges');
      });
  }

  function checkBadges(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для перевірки бейджів'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/check/' + userId, {
      method: 'POST'
    })
    .catch(function(error) {
      console.warn('Помилка перевірки бейджів:', error.message);
      return createMockResponse('badges');
    });
  }

  function claimBadgeReward(userId, badgeType) {
    if (!userId || !badgeType) {
      return Promise.reject(new Error('ID користувача та тип бейджа обов\'язкові для отримання винагороди'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/claim', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        badge_type: badgeType
      })
    })
    .then(function(data) {
      // Якщо успішно, спробуємо оновити баланс
      if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
        try {
          const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
          window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
        } catch (e) {
          console.warn('Не вдалося оновити відображення балансу:', e);
        }
      }
      return data;
    })
    .catch(function(error) {
      console.warn('Помилка отримання винагороди за бейдж:', error.message);
      // Повертаємо помилку, але не mock дані для цієї операції
      return {
        success: false,
        error: error.message
      };
    });
  }

  // fetchReferralStats.js
  function fetchReferralStats(userId) {
    if (!userId) {
      return Promise.reject(new Error('User ID is required for fetching referral statistics'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/stats/' + userId)
      .catch(function(error) {
        console.warn('Помилка отримання статистики рефералів:', error.message);
        return createMockResponse('stats');
      });
  }

  function fetchReferralDetails(referralId) {
    if (!referralId) {
      return Promise.reject(new Error('Referral ID is required'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/details/' + referralId)
      .catch(function(error) {
        console.warn('Помилка отримання деталей реферала:', error.message);
        return {
          success: false,
          error: error.message
        };
      });
  }

  // fetchReferralLink.js
  function fetchReferralLink(userId) {
    if (!userId) {
      return Promise.reject(new Error('User ID is required for fetching referral link'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/link/' + userId)
      .then(function(data) {
        return data.referral_link || userId.toString();
      })
      .catch(function(error) {
        console.warn('Помилка отримання реферального посилання:', error.message);
        // Повертаємо fallback посилання
        return 'Winix/referral/' + userId;
      });
  }

  // fetchReferralEarnings.js
  function fetchReferralEarnings(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про заробітки'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/earnings/' + userId, {
      method: 'POST',
      body: JSON.stringify(options)
    })
    .catch(function(error) {
      console.warn('Помилка отримання даних про заробітки:', error.message);
      return {
        success: true,
        level1Earnings: [],
        level2Earnings: [],
        totalEarnings: 0
      };
    });
  }

  function fetchReferralDetailedEarnings(referralId, options) {
    options = options || {};
    if (!referralId) {
      return Promise.reject(new Error('ID реферала обов\'язковий для отримання детальних даних'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/earnings/detailed/' + referralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання детальних даних про заробітки:', error.message);
        return {
          success: true,
          earnings: [],
          totalEarnings: 0
        };
      });
  }

  function fetchEarningsSummary(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання зведених даних'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/earnings/summary/' + userId)
      .catch(function(error) {
        console.warn('Помилка отримання зведених даних про заробітки:', error.message);
        return {
          success: true,
          totalEarnings: 0,
          level1Earnings: 0,
          level2Earnings: 0
        };
      });
  }

  // fetchReferralActivity.js
  function fetchReferralActivity(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про активність'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/' + userId, {
      method: 'POST',
      body: JSON.stringify(options)
    })
    .catch(function(error) {
      console.warn('Помилка отримання даних про активність рефералів:', error.message);
      return {
        success: true,
        activities: [],
        totalActivities: 0
      };
    });
  }

  function fetchReferralDetailedActivity(referralId, options) {
    options = options || {};
    if (!referralId) {
      return Promise.reject(new Error('ID реферала обов\'язковий для отримання детальних даних'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/activity/detailed/' + referralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання детальних даних про активність:', error.message);
        return {
          success: true,
          activities: [],
          totalActivities: 0
        };
      });
  }

  function fetchActivitySummary(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про активність'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/summary/' + userId)
      .catch(function(error) {
        console.warn('Помилка отримання зведених даних про активність:', error.message);
        return {
          success: true,
          summary: {
            totalActivities: 0,
            activeReferrals: 0
          }
        };
      });
  }

  function updateReferralActivity(userId, drawsParticipation, invitedReferrals) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для оновлення активності'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/update', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        draws_participation: drawsParticipation,
        invited_referrals: invitedReferrals
      })
    })
    .catch(function(error) {
      console.warn('Помилка оновлення даних про активність:', error.message);
      return {
        success: false,
        error: error.message
      };
    });
  }

  function manuallyActivateReferral(userId, adminId) {
    if (!userId || !adminId) {
      return Promise.reject(new Error('ID користувача та адміністратора обов\'язкові для ручної активації'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/activate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        admin_id: adminId
      })
    })
    .catch(function(error) {
      console.warn('Помилка ручної активації реферала:', error.message);
      return {
        success: false,
        error: error.message
      };
    });
  }

  // fetchTasks.js
  function fetchUserTasks(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про завдання'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/tasks/' + userId)
      .catch(function(error) {
        console.warn('Помилка отримання даних про завдання:', error.message);
        return {
          success: true,
          tasks: [],
          completedTasks: [],
          tasksProgress: {}
        };
      });
  }

  function updateTasks(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для оновлення завдань'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/tasks/update/' + userId, {
      method: 'POST'
    })
    .catch(function(error) {
      console.warn('Помилка оновлення завдань:', error.message);
      return {
        success: false,
        error: error.message
      };
    });
  }

  function claimTaskReward(userId, taskType) {
    if (!userId || !taskType) {
      return Promise.reject(new Error('ID користувача та тип завдання обов\'язкові для отримання винагороди'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/tasks/claim', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        task_type: taskType
      })
    })
    .then(function(data) {
      // Якщо успішно, спробуємо оновити баланс
      if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
        try {
          const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
          window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
        } catch (e) {
          console.warn('Не вдалося оновити відображення балансу:', e);
        }
      }
      return data;
    })
    .catch(function(error) {
      console.warn('Помилка отримання винагороди за завдання:', error.message);
      return {
        success: false,
        error: error.message
      };
    });
  }

  // registerReferral.js
  function registerReferral(referrerId, userId) {
    if (!referrerId) {
      return Promise.reject(new Error('Referrer ID is required'));
    }

    if (!userId) {
      return Promise.reject(new Error('User ID is required'));
    }

    if (referrerId === userId) {
      return Promise.reject(new Error('User cannot refer themselves'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/register', {
      method: 'POST',
      body: JSON.stringify({
        referrer_id: referrerId,
        referee_id: userId
      })
    })
    .catch(function(error) {
      console.warn('Помилка реєстрації реферала:', error.message);
      return {
        success: false,
        error: error.message
      };
    });
  }

  function checkIfReferral(userId) {
    if (!userId) {
      return Promise.reject(new Error('User ID is required'));
    }

    return fetchReferralStats(userId)
      .then(function(data) {
        return !!(data && data.referrals);
      })
      .catch(function(error) {
        console.warn('Помилка перевірки статусу реферала:', error.message);
        return false;
      });
  }

  // Історія та інші функції
  function fetchReferralHistory(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('userId is required'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/' + userId;

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

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання історії рефералів:', error.message);
        return createMockResponse('history');
      });
  }

  // Додаткові функції з fallback
  function fetchReferralDraws(referralId) {
    if (!referralId) {
      return Promise.reject(new Error('referralId is required'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/' + referralId)
      .catch(function(error) {
        console.warn('Помилка отримання даних про розіграші:', error.message);
        return { success: true, draws: [] };
      });
  }

  function fetchDrawDetails(referralId, drawId) {
    if (!referralId || !drawId) {
      return Promise.reject(new Error('referralId and drawId are required'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/details/' + referralId + '/' + drawId)
      .catch(function(error) {
        console.warn('Помилка отримання деталей розіграшу:', error.message);
        return { success: true, details: {} };
      });
  }

  function fetchDrawsParticipationStats(ownerId, options) {
    options = options || {};
    if (!ownerId) {
      return Promise.reject(new Error('ownerId is required'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/draws/stats/' + ownerId;
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

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання статистики участі в розіграшах:', error.message);
        return { success: true, stats: {} };
      });
  }

  function fetchTotalDrawsCount(ownerId) {
    if (!ownerId) {
      return Promise.reject(new Error('ownerId is required'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/count/' + ownerId)
      .then(function(data) {
        return data.totalDrawsCount || 0;
      })
      .catch(function(error) {
        console.warn('Помилка отримання загальної кількості розіграшів:', error.message);
        return 0;
      });
  }

  function fetchMostActiveInDraws(ownerId, limit) {
    limit = limit || 10;
    if (!ownerId) {
      return Promise.reject(new Error('ownerId is required'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/active/' + ownerId + '?limit=' + limit)
      .catch(function(error) {
        console.warn('Помилка отримання найактивніших в розіграшах:', error.message);
        return { success: true, activeUsers: [] };
      });
  }

  // Інші функції історії
  function fetchReferralEventHistory(userId, eventType, options) {
    options = options || {};
    if (!userId || !eventType) {
      return Promise.reject(new Error('userId and eventType are required'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/event/' + userId + '/' + eventType;

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

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання історії події ' + eventType + ':', error.message);
        return { success: true, events: [] };
      });
  }

  function fetchReferralActivitySummary(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('userId is required'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/summary/' + userId;

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

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання зведеної активності рефералів:', error.message);
        return { success: true, summary: {} };
      });
  }

  function fetchReferralActivityTrend(userId, period, options) {
    period = period || 'monthly';
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('userId is required'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/trend/' + userId + '/' + period;

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

    return apiRequest(url)
      .catch(function(error) {
        console.warn('Помилка отримання тренду активності рефералів:', error.message);
        return { success: true, trend: [] };
      });
  }

  // Функція для перевірки доступності API
  function checkAPIHealth() {
    return apiRequest(API_CONFIG.baseUrl + '/health')
      .then(function() {
        console.log('[REFERRAL_API] API доступний');
        return true;
      })
      .catch(function(error) {
        console.warn('[REFERRAL_API] API недоступний:', error.message);
        return false;
      });
  }

  // Публічний API
  return {
    // Конфігурація
    config: API_CONFIG,

    // Утиліти
    apiRequest: apiRequest,
    createMockResponse: createMockResponse,
    checkAPIHealth: checkAPIHealth,

    // Основні API функції
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