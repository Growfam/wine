// api.js - Виправлена версія з підтримкою авторизації (без process.env)
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


  // Налаштування логування
  const DEBUG = true; // Прапорець для режиму відлагодження

  // Утилітарна функція для отримання токена авторизації
  function getAuthToken() {
    return localStorage.getItem('auth_token') ||
           localStorage.getItem('jwt_token') ||
           localStorage.getItem('token');
  }

  // Утилітарна функція для отримання ID користувача
  function getUserId() {
    return localStorage.getItem('telegram_user_id') ||
           localStorage.getItem('user_id');
  }

  if (typeof window.WinixAPI === 'undefined') {
  console.log('📢 Створення WinixAPI як глобальної змінної');
  window.WinixAPI = {
    apiRequest: async function(endpoint, method, data, options) {
      // Базова імплементація
      // ...
      return { status: 'success' };
    },
    getUserId: function() {
      return localStorage.getItem('telegram_user_id') || null;
    }
  };
}

  // Утилітарна функція для виконання HTTP запитів з обробкою помилок та авторизацією
  function apiRequest(url, options) {
    options = options || {};
    const controller = new AbortController();
    const timeoutId = setTimeout(function() {
      controller.abort();
    }, API_CONFIG.timeout);

    // Отримуємо авторизаційний токен та ID користувача
    const token = getAuthToken();
    const userId = getUserId();

    // Встановлюємо базові заголовки
    const headers = {
      'Content-Type': 'application/json'
    };

    // Додаємо заголовок авторизації, якщо токен доступний
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    // Додаємо Telegram User ID заголовок, якщо ID доступний
    if (userId) {
      headers['X-Telegram-User-Id'] = userId;
    }

    // Об'єднуємо заголовки з опціями запиту
    const fetchOptions = Object.assign({
      signal: controller.signal,
      headers: headers
    }, options);

    console.log('🌐 [API REQUEST]:', url, {
      method: fetchOptions.method || 'GET',
      hasAuth: !!token,
      userId: userId
    });

    // Логуємо заголовки для відлагодження
    if (DEBUG) {
      console.debug('Request headers:', fetchOptions.headers);
    }

    let retryCount = 0;

    function executeRequest() {
      return fetch(url, fetchOptions)
        .then(function(response) {
          clearTimeout(timeoutId);

          // Перевіряємо відповідь
          if (!response.ok) {
            // Якщо це помилка авторизації, спробуємо оновити токен
            if (response.status === 401 && retryCount < API_CONFIG.retryAttempts) {
              return refreshTokenAndRetry();
            }

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

          // Якщо це не помилка авторизації або ми вже намагалися оновити токен занадто багато разів
          if (error.status !== 401 || retryCount >= API_CONFIG.retryAttempts) {
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
          }

          // Спробуємо оновити токен і повторити запит
          return refreshTokenAndRetry();
        });
    }

    // Функція для оновлення токена і повторення запиту
    function refreshTokenAndRetry() {
      retryCount++;
      console.warn(`Спроба оновити токен авторизації (спроба ${retryCount}/${API_CONFIG.retryAttempts})...`);

      return fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-User-Id': userId || ''
        },
        body: JSON.stringify({ telegram_id: userId })
      })
      .then(response => response.json())
      .then(data => {
        if (data.token || data.data && data.data.token) {
          const newToken = data.token || data.data.token;
          localStorage.setItem('auth_token', newToken);
          console.log('Токен оновлено успішно!');

          // Оновлюємо заголовок авторизації для повторного запиту
          fetchOptions.headers['Authorization'] = 'Bearer ' + newToken;

          // Повторно виконуємо запит
          return executeRequest();
        } else {
          throw new Error('Не вдалося оновити токен авторизації');
        }
      })
      .catch(err => {
        console.error('Помилка оновлення токена:', err);
        throw err;
      });
    }

    return executeRequest();
  }

  // Основні API функції

  // fetchBadges.js
  function fetchUserBadges(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про бейджі'));
    }

    // Переконуємося що userId це число
    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/' + numericUserId);
  }

  function checkBadges(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для перевірки бейджів'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/check/' + numericUserId, {
      method: 'POST'
    });
  }

  function claimBadgeReward(userId, badgeType) {
    if (!userId || !badgeType) {
      return Promise.reject(new Error('ID користувача та тип бейджа обов\'язкові для отримання винагороди'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/claim', {
      method: 'POST',
      body: JSON.stringify({
        user_id: numericUserId,
        badge_type: badgeType
      })
    })
    .then(function(data) {
      // Якщо успішно, спробуємо оновити баланс
      try {
        if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
          const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
          window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
        }
      } catch (e) {
        console.warn('Не вдалося оновити відображення балансу:', e);
      }
      return data;
    });
  }

  function fetchReferralLink(userId) {
  if (!userId) {
    return Promise.reject(new Error('ID користувача обов\'язковий'));
  }

  const numericUserId = parseInt(userId);
  if (isNaN(numericUserId)) {
    return Promise.reject(new Error('ID користувача повинен бути числом'));
  }

  return apiRequest(API_CONFIG.baseUrl + '/referrals/link/' + numericUserId);
}

  // fetchReferralStats.js
  function fetchReferralStats(userId) {
    console.log('📊 [API] Запит статистики рефералів для ID:', userId);
    if (!userId) {
        return Promise.reject(new Error('ID користувача обов\'язковий для отримання статистики рефералів'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
        return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/stats/' + numericUserId)
        .then(function(response) {
            console.log('✅ [API] Отримано відповідь про статистику рефералів:', response);

            // Розширена перевірка відповіді
            if (!response ||
                typeof response !== 'object' ||
                (response.status && response.status !== 'success') ||
                (!response.statistics && !response.referrals)) {

                console.warn('⚠️ [API] Неправильний формат відповіді:', response);

                // Повертаємо структуру за замовчуванням з кращою документацією
                return {
                    success: true,
                    source: 'fallback_invalid_response',
                    statistics: {
                        totalReferrals: 0,
                        activeReferrals: 0,
                        conversionRate: 0
                    },
                    referrals: {
                        level1: [],
                        level2: []
                    }
                };
            }

            // Додаємо поле для відстеження джерела даних
            if (response) {
                response.source = response.source || 'api_success';
            }

            return response;
        })
        .catch(function(error) {
            console.error('❌ [API] Помилка завантаження статистики рефералів:', error);
            console.error('❌ [API] Stack trace:', error.stack);

            // Повертаємо структуру за замовчуванням при помилці з детальнішою інформацією
            return {
                success: true,
                source: 'api_error_fallback',
                error: error.message,
                statistics: {
                    totalReferrals: 0,
                    activeReferrals: 0,
                    conversionRate: 0
                },
                referrals: {
                    level1: [],
                    level2: []
                }
            };
        });
}

  // fetchReferralEarnings.js
  function fetchReferralEarnings(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про заробітки'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/earnings/' + numericUserId, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  function fetchReferralDetailedEarnings(referralId, options) {
    options = options || {};
    if (!referralId) {
      return Promise.reject(new Error('ID реферала обов\'язковий для отримання детальних даних'));
    }

    const numericReferralId = parseInt(referralId);
    if (isNaN(numericReferralId)) {
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/earnings/detailed/' + numericReferralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    return apiRequest(url);
  }

  function fetchEarningsSummary(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання зведених даних'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/earnings/summary/' + numericUserId);
  }

  // fetchReferralActivity.js
  function fetchReferralActivity(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про активність'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/' + numericUserId, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  function fetchReferralDetailedActivity(referralId, options) {
    options = options || {};
    if (!referralId) {
      return Promise.reject(new Error('ID реферала обов\'язковий для отримання детальних даних'));
    }

    const numericReferralId = parseInt(referralId);
    if (isNaN(numericReferralId)) {
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/activity/detailed/' + numericReferralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    return apiRequest(url);
  }

  function fetchActivitySummary(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про активність'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/summary/' + numericUserId);
  }

  function updateReferralActivity(userId, drawsParticipation, invitedReferrals) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для оновлення активності'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/update', {
      method: 'POST',
      body: JSON.stringify({
        user_id: numericUserId,
        draws_participation: drawsParticipation,
        invited_referrals: invitedReferrals
      })
    });
  }

  function manuallyActivateReferral(userId, adminId) {
    if (!userId || !adminId) {
      return Promise.reject(new Error('ID користувача та адміністратора обов\'язкові для ручної активації'));
    }

    const numericUserId = parseInt(userId);
    const numericAdminId = parseInt(adminId);
    if (isNaN(numericUserId) || isNaN(numericAdminId)) {
      return Promise.reject(new Error('ID користувача та адміністратора повинні бути числами'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/activity/activate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: numericUserId,
        admin_id: numericAdminId
      })
    });
  }

  // fetchTasks.js
  function fetchUserTasks(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про завдання'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/tasks/' + numericUserId);
  }

  function updateTasks(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для оновлення завдань'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/tasks/update/' + numericUserId, {
      method: 'POST'
    });
  }

  function claimTaskReward(userId, taskType) {
    if (!userId || !taskType) {
      return Promise.reject(new Error('ID користувача та тип завдання обов\'язкові для отримання винагороди'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/tasks/claim', {
      method: 'POST',
      body: JSON.stringify({
        user_id: numericUserId,
        task_type: taskType
      })
    })
    .then(function(data) {
      // Якщо успішно, спробуємо оновити баланс
      try {
        if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
          const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
          window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
        }
      } catch (e) {
        console.warn('Не вдалося оновити відображення балансу:', e);
      }
      return data;
    });
  }

  // registerReferral.js
  function registerReferral(referrerId, userId) {
    if (!referrerId) {
      return Promise.reject(new Error('ID реферера обов\'язковий'));
    }

    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericReferrerId = parseInt(referrerId);
    const numericUserId = parseInt(userId);

    if (isNaN(numericReferrerId) || isNaN(numericUserId)) {
      return Promise.reject(new Error('ID реферера та користувача повинні бути числами'));
    }

    if (numericReferrerId === numericUserId) {
      return Promise.reject(new Error('Користувач не може запросити себе'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/register', {
      method: 'POST',
      body: JSON.stringify({
        referrer_id: numericReferrerId,
        referee_id: numericUserId
      })
    });
  }

  function checkIfReferral(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return fetchReferralStats(numericUserId)
      .then(function(data) {
        return !!(data && data.referrals);
      });
  }

  // Історія та інші функції
  function fetchReferralHistory(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/' + numericUserId;

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

    return apiRequest(url);
  }

  // Додаткові функції
  function fetchReferralDraws(referralId) {
    if (!referralId) {
      return Promise.reject(new Error('ID реферала обов\'язковий'));
    }

    const numericReferralId = parseInt(referralId);
    if (isNaN(numericReferralId)) {
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/' + numericReferralId);
  }

  function fetchDrawDetails(referralId, drawId) {
    if (!referralId || !drawId) {
      return Promise.reject(new Error('ID реферала та розіграшу обов\'язкові'));
    }

    const numericReferralId = parseInt(referralId);
    const numericDrawId = parseInt(drawId);
    if (isNaN(numericReferralId) || isNaN(numericDrawId)) {
      return Promise.reject(new Error('ID реферала та розіграшу повинні бути числами'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/details/' + numericReferralId + '/' + numericDrawId);
  }

  function fetchDrawsParticipationStats(ownerId, options) {
    options = options || {};
    if (!ownerId) {
      return Promise.reject(new Error('ID власника обов\'язковий'));
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      return Promise.reject(new Error('ID власника повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/draws/stats/' + numericOwnerId;
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

    return apiRequest(url);
  }

  function fetchTotalDrawsCount(ownerId) {
    if (!ownerId) {
      return Promise.reject(new Error('ID власника обов\'язковий'));
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      return Promise.reject(new Error('ID власника повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/count/' + numericOwnerId)
      .then(function(data) {
        return data.totalDrawsCount || 0;
      });
  }

  function fetchMostActiveInDraws(ownerId, limit) {
    limit = limit || 10;
    if (!ownerId) {
      return Promise.reject(new Error('ID власника обов\'язковий'));
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      return Promise.reject(new Error('ID власника повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/draws/active/' + numericOwnerId + '?limit=' + limit);
  }

  // Інші функції історії
  function fetchReferralEventHistory(userId, eventType, options) {
    options = options || {};
    if (!userId || !eventType) {
      return Promise.reject(new Error('ID користувача та тип події обов\'язкові'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/event/' + numericUserId + '/' + eventType;

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

    return apiRequest(url);
  }

  function fetchReferralActivitySummary(userId, options) {
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/summary/' + numericUserId;

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

    return apiRequest(url);
  }

  function fetchReferralActivityTrend(userId, period, options) {
    period = period || 'monthly';
    options = options || {};
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/referrals/history/trend/' + numericUserId + '/' + period;

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

    return apiRequest(url);
  }

  // Функція для оновлення токена авторизації
  function refreshAuthToken() {
    const userId = getUserId();
    if (!userId) {
      return Promise.reject(new Error('ID користувача відсутній'));
    }

    console.log('Спроба оновити токен авторизації для користувача:', userId);

    return fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-User-Id': userId
      },
      body: JSON.stringify({ telegram_id: userId })
    })
    .then(response => response.json())
    .then(data => {
      if (data.token || (data.data && data.data.token)) {
        const newToken = data.token || data.data.token;
        localStorage.setItem('auth_token', newToken);
        console.log('Токен оновлено успішно!');
        return newToken;
      } else {
        throw new Error('Не вдалося оновити токен авторизації');
      }
    });
  }
  // Додайте цю функцію до api.js
function fetchReferralDetails(referralId) {
  if (!referralId) {
    return Promise.reject(new Error('ID реферала обов\'язковий'));
  }

  const numericReferralId = parseInt(referralId);
  if (isNaN(numericReferralId)) {
    return Promise.reject(new Error('ID реферала повинен бути числом'));
  }

  return apiRequest(API_CONFIG.baseUrl + '/referrals/details/' + numericReferralId)
    .catch(function(error) {
      console.error('Помилка отримання деталей реферала:', error);
      // Повертаємо базову структуру при помилці
      return {
        success: true,
        id: referralId,
        active: false,
        registrationDate: new Date().toISOString()
      };
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
    checkAPIHealth: checkAPIHealth,
    refreshAuthToken: refreshAuthToken,
    getAuthToken: getAuthToken,
    getUserId: getUserId,

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