// api.js - Виправлена версія з підтримкою авторизації
/**
 * API функції для реферальної системи
 */
window.ReferralAPI = (function() {
  'use strict';

  // Базова конфігурація API
  const API_CONFIG = {
    baseUrl: '/api',
    timeout: 15000, // Збільшено таймаут
    retryAttempts: 3,
    retryDelay: 1000
  };

  // Налаштування логування
  const DEBUG = true; // Прапорець для режиму відлагодження

  // Ініціалізація WinixAPI, якщо вона не існує
  if (typeof window.WinixAPI === 'undefined') {
    console.log('📢 [API] Створення WinixAPI як глобальної заглушки');
    window.WinixAPI = {
      apiRequest: async function(endpoint, method, data, options) {
        console.log('🔄 [API] Виклик apiRequest заглушки:', endpoint);
        return { status: 'success', data: {} };
      },
      getUserId: function() {
        const userId = localStorage.getItem('telegram_user_id') ||
                       localStorage.getItem('user_id') ||
                       null;
        console.log('🔍 [API] getUserId заглушки повертає:', userId);
        return userId;
      },
      refreshToken: async function() {
        console.log('🔄 [API] Виклик refreshToken заглушки');
        return true;
      }
    };
  }

  // Утилітарна функція для отримання токена авторизації
  function getAuthToken() {
    return localStorage.getItem('auth_token') ||
           localStorage.getItem('jwt_token') ||
           localStorage.getItem('token');
  }

  // Утилітарна функція для отримання ID користувача
  function getUserId() {
    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
      const apiId = window.WinixAPI.getUserId();
      if (apiId && apiId !== 'undefined' && apiId !== 'null') {
        return apiId;
      }
    }

    return localStorage.getItem('telegram_user_id') ||
           localStorage.getItem('user_id');
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
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
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
      // Додаємо параметр timestamp для запобігання кешування
      const urlWithTimestamp = url.includes('?')
        ? url + '&t=' + Date.now()
        : url + '?t=' + Date.now();

      return fetch(urlWithTimestamp, fetchOptions)
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

          // Спробуємо парсити JSON відповідь
          return response.json().catch(function(err) {
            console.warn('⚠️ [API] Неможливо парсити відповідь як JSON, повертаємо текст');
            return response.text().then(text => {
              try {
                // Якщо це валідний JSON, але помилка парсингу
                return JSON.parse(text);
              } catch(e) {
                // Якщо це не JSON взагалі
                return { success: true, text: text };
              }
            });
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
      console.warn(`⚠️ [API] Спроба оновити токен авторизації (спроба ${retryCount}/${API_CONFIG.retryAttempts})...`);

      // Спочатку спробуємо через WinixAPI
      if (window.WinixAPI && typeof window.WinixAPI.refreshToken === 'function') {
        return window.WinixAPI.refreshToken()
          .then(function(result) {
            console.log('✅ [API] Токен оновлено через WinixAPI');

            // Оновлюємо токен у заголовках
            const newToken = getAuthToken();
            if (newToken) {
              fetchOptions.headers['Authorization'] = 'Bearer ' + newToken;
            }

            // Повторно виконуємо запит
            return executeRequest();
          })
          .catch(function(err) {
            console.warn('⚠️ [API] Помилка оновлення токена через WinixAPI:', err);
            // Продовжуємо зі стандартним методом
            return standardRefreshToken();
          });
      } else {
        // Якщо WinixAPI недоступний, використовуємо стандартний метод
        return standardRefreshToken();
      }

      // Стандартний метод оновлення токена
      function standardRefreshToken() {
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
            console.log('✅ [API] Токен оновлено успішно!');

            // Оновлюємо заголовок авторизації для повторного запиту
            fetchOptions.headers['Authorization'] = 'Bearer ' + newToken;

            // Повторно виконуємо запит
            return executeRequest();
          } else {
            throw new Error('Не вдалося оновити токен авторизації');
          }
        })
        .catch(err => {
          console.error('❌ [API] Помилка оновлення токена:', err);
          throw err;
        });
      }
    }

    return executeRequest();
  }

  // Основні API функції

  // Отримання бейджів користувача
  function fetchUserBadges(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про бейджі'));
    }

    // Переконуємося що userId це число
    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
      return window.WinixAPI.apiRequest(`badges/${numericUserId}`, 'GET')
        .then(response => {
          if (response.status === 'success' && response.data) {
            return response.data;
          }

          // Якщо WinixAPI не повернув дані, викликаємо безпосередній запит
          return apiRequest(API_CONFIG.baseUrl + '/badges/' + numericUserId);
        })
        .catch(error => {
          console.warn('⚠️ [API] Помилка отримання бейджів через WinixAPI:', error);
          // Якщо помилка, повертаємося до стандартного методу
          return apiRequest(API_CONFIG.baseUrl + '/badges/' + numericUserId);
        });
    }

    return apiRequest(API_CONFIG.baseUrl + '/badges/' + numericUserId);
  }

  // Перевірка бейджів
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

  // Отримання винагороди за бейдж
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
        console.warn('⚠️ [API] Не вдалося оновити відображення балансу:', e);
      }
      return data;
    });
  }

  // Отримання реферального посилання
  function fetchReferralLink(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
      return window.WinixAPI.apiRequest(`referrals/link/${numericUserId}`, 'GET')
        .then(response => {
          if (response.status === 'success' && response.data && response.data.link) {
            return response.data.link;
          }

          // Якщо WinixAPI успішний, але формат відповіді не відповідає
          if (response.status === 'success' && response.data) {
            // Спробуємо знайти посилання в даних
            if (typeof response.data === 'string' && response.data.includes('t.me')) {
              return response.data;
            }

            // Якщо не вдалося, створюємо посилання вручну
            return formatReferralUrl(numericUserId);
          }

          // Якщо WinixAPI не повернув посилання, викликаємо безпосередній запит
          return apiRequest(API_CONFIG.baseUrl + '/referrals/link/' + numericUserId)
            .then(data => {
              if (data && data.link) {
                return data.link;
              }

              // Якщо відповідь не містить посилання, створюємо його вручну
              return formatReferralUrl(numericUserId);
            });
        })
        .catch(error => {
          console.warn('⚠️ [API] Помилка отримання реферального посилання через WinixAPI:', error);
          // При помилці створюємо посилання вручну
          return formatReferralUrl(numericUserId);
        });
    }

    // Якщо WinixAPI недоступний, викликаємо звичайний запит
    return apiRequest(API_CONFIG.baseUrl + '/referrals/link/' + numericUserId)
      .then(data => {
        if (data && data.link) {
          return data.link;
        }

        // Якщо відповідь не містить посилання, створюємо його вручну
        return formatReferralUrl(numericUserId);
      })
      .catch(error => {
        console.warn('⚠️ [API] Помилка отримання реферального посилання:', error);
        // При помилці створюємо посилання вручну
        return formatReferralUrl(numericUserId);
      });
  }

  // Допоміжна функція для форматування реферального посилання
  function formatReferralUrl(userId) {
    if (!userId) {
      return null;
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return null;
    }

    return 'https://t.me/WINIX_Official_bot?start=' + numericUserId;
  }

  // Отримання статистики рефералів
  function fetchReferralStats(userId) {
    console.log('📊 [API] Запит статистики рефералів для ID:', userId);
    if (!userId) {
        return Promise.reject(new Error('ID користувача обов\'язковий для отримання статистики рефералів'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
        return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
      return window.WinixAPI.apiRequest(`referrals/stats/${numericUserId}`, 'GET')
        .then(response => {
          if (response.status === 'success' && response.data) {
            response.data.source = 'winix_api';
            console.log('✅ [API] Отримано відповідь про статистику рефералів з WinixAPI:', response.data);
            return response.data;
          }

          // Якщо WinixAPI не повернув дані, викликаємо безпосередній запит
          return sendStatsRequest();
        })
        .catch(error => {
          console.warn('⚠️ [API] Помилка отримання статистики через WinixAPI:', error);
          // Якщо помилка, повертаємося до стандартного методу
          return sendStatsRequest();
        });
    } else {
      // Якщо WinixAPI недоступний, викликаємо звичайний запит
      return sendStatsRequest();
    }

    // Функція для виконання стандартного запиту
    function sendStatsRequest() {
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
  }

  // Отримання заробітків від рефералів
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
    })
    .catch(function(error) {
      console.error('❌ [API] Помилка отримання заробітків:', error);
      // Повертаємо базову структуру при помилці
      return {
        success: true,
        source: 'error_fallback',
        level1Earnings: [],
        level2Earnings: []
      };
    });
  }

  // Отримання детальних заробітків від рефералів
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

  // Отримання зведених даних про заробітки
  function fetchEarningsSummary(userId) {
    if (!userId) {
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання зведених даних'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    return apiRequest(API_CONFIG.baseUrl + '/referrals/earnings/summary/' + numericUserId)
    .catch(function(error) {
      console.error('❌ [API] Помилка отримання зведених даних про заробітки:', error);
      // Повертаємо базову структуру при помилці
      return {
        success: true,
        source: 'error_fallback',
        totalEarnings: 0,
        level1Earnings: 0,
        level2Earnings: 0
      };
    });
  }

  // Отримання активності рефералів
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

  // Отримання детальної активності рефералів
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

  // Отримання зведених даних про активність
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

  // Оновлення активності рефералів
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

  // Ручна активація реферала
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

  // Отримання завдань користувача
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

  // Оновлення завдань
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

  // Отримання винагороди за завдання
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
        console.warn('⚠️ [API] Не вдалося оновити відображення балансу:', e);
      }
      return data;
    });
  }

  // Реєстрація реферала
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

  // Перевірка, чи є користувач рефералом
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

  // Отримання історії рефералів
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

    return apiRequest(url)
      .catch(function(error) {
        console.error('❌ [API] Помилка отримання історії рефералів:', error);
        // Повертаємо базову структуру при помилці
        return {
          success: true,
          source: 'error_fallback',
          history: [],
          bonuses: []
        };
      });
  }

  // Отримання розіграшів реферала
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

  // Отримання деталей розіграшу
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

  // Отримання статистики участі в розіграшах
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

  // Отримання загальної кількості розіграшів
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

  // Отримання найактивніших учасників розіграшів
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

  // Отримання історії подій рефералів
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

  // Отримання зведених даних про активність рефералів
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

  // Отримання тренду активності рефералів
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

  // Отримання деталей реферала
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
        console.error('❌ [API] Помилка отримання деталей реферала:', error);
        // Повертаємо базову структуру при помилці
        return {
          success: true,
          id: referralId,
          active: false,
          registrationDate: new Date().toISOString()
        };
      });
  }

  // Функція для оновлення токена авторизації
  function refreshAuthToken() {
    const userId = getUserId();
    if (!userId) {
      return Promise.reject(new Error('ID користувача відсутній'));
    }

    console.log('🔄 [API] Спроба оновити токен авторизації для користувача:', userId);

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.refreshToken === 'function') {
      return window.WinixAPI.refreshToken()
        .then(result => {
          if (result === true) {
            console.log('✅ [API] Токен оновлено через WinixAPI');
            return getAuthToken() || 'success';
          } else {
            console.warn('⚠️ [API] WinixAPI.refreshToken повернув не true:', result);
            return standardRefreshToken();
          }
        })
        .catch(err => {
          console.warn('⚠️ [API] Помилка оновлення токена через WinixAPI:', err);
          return standardRefreshToken();
        });
    } else {
      // Якщо WinixAPI недоступний, використовуємо стандартний метод
      return standardRefreshToken();
    }

    // Стандартний метод оновлення токена
    function standardRefreshToken() {
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
          console.log('✅ [API] Токен оновлено успішно через стандартний метод!');
          return newToken;
        } else {
          throw new Error('Не вдалося оновити токен авторизації');
        }
      });
    }
  }

  // Функція для перевірки доступності API
  function checkAPIHealth() {
    return apiRequest(API_CONFIG.baseUrl + '/health')
      .then(function() {
        console.log('✅ [API] API доступний');
        return true;
      })
      .catch(function(error) {
        console.warn('⚠️ [API] API недоступний:', error.message);
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