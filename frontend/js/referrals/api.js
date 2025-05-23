// api.js - Версія з детальним логуванням
/**
 * API функції для реферальної системи
 */
window.ReferralAPI = (function() {
  'use strict';

  console.log('📦 [API] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ ReferralAPI ==========');
  console.log('🕐 [API] Час завантаження:', new Date().toISOString());

  // Базова конфігурація API
  const API_CONFIG = {
    baseUrl: '',  // Видаляємо префікс /api, оскільки він вже включений в маршрути
    timeout: 15000, // Збільшено таймаут
    retryAttempts: 3,
    retryDelay: 1000
  };

  console.log('⚙️ [API] Конфігурація:', API_CONFIG);

  // Налаштування логування
  const DEBUG = true; // Прапорець для режиму відлагодження
  console.log('🐛 [API] DEBUG режим:', DEBUG ? 'УВІМКНЕНО' : 'ВИМКНЕНО');

  // Перевірка наявності WinixAPI
  console.log('🔍 [API] Перевірка наявності WinixAPI...');
  if (typeof window.WinixAPI !== 'undefined') {
    console.log('✅ [API] WinixAPI знайдено:', Object.keys(window.WinixAPI));
  } else {
    console.log('⚠️ [API] WinixAPI відсутній, буде використовуватися прямий API');
  }

  // Утилітарна функція для отримання токена авторизації
  function getAuthToken() {
    console.log('🔑 [API] === getAuthToken START ===');

    const authToken = localStorage.getItem('auth_token');
    const jwtToken = localStorage.getItem('jwt_token');
    const token = localStorage.getItem('token');

    console.log('📊 [API] Токени в localStorage:', {
      auth_token: authToken ? 'присутній' : 'відсутній',
      jwt_token: jwtToken ? 'присутній' : 'відсутній',
      token: token ? 'присутній' : 'відсутній'
    });

    const result = authToken || jwtToken || token;
    console.log('🔑 [API] Результат getAuthToken:', result ? 'токен знайдено' : 'токен відсутній');

    return result;
  }

  // Утилітарна функція для отримання ID користувача
  function getUserId() {
    console.log('👤 [API] === getUserId START ===');

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
      console.log('🔍 [API] Спроба отримати ID через WinixAPI...');
      const apiId = window.WinixAPI.getUserId();
      console.log('📊 [API] WinixAPI.getUserId результат:', apiId);

      if (apiId && apiId !== 'undefined' && apiId !== 'null') {
        console.log('✅ [API] ID отримано через WinixAPI:', apiId);
        return apiId;
      }
    }

    const telegramId = localStorage.getItem('telegram_user_id');
    const userId = localStorage.getItem('user_id');

    console.log('📊 [API] ID в localStorage:', {
      telegram_user_id: telegramId,
      user_id: userId
    });

    const result = telegramId || userId;
    console.log('👤 [API] Результат getUserId:', result || 'ID відсутній');

    return result;
  }

  // Перевірка і форматування відповіді від API
  function validateAndFormatResponse(response, endpoint) {
    console.log('🔍 [API] === validateAndFormatResponse START ===');
    console.log('📊 [API] Endpoint:', endpoint);
    console.log('📊 [API] Response type:', typeof response);
    console.log('📊 [API] Response:', JSON.stringify(response, null, 2));

    if (!response) {
      console.error(`❌ [API] Порожня відповідь від ${endpoint}`);
      throw new Error('Порожня відповідь від сервера');
    }

    // Базові перевірки
    if (typeof response !== 'object') {
      console.error(`❌ [API] Неочікуваний тип відповіді від ${endpoint}:`, typeof response);
      console.log('🔄 [API] Спроба парсингу як JSON...');

      try {
        // Спробуємо розпарсити рядок як JSON
        const parsed = JSON.parse(response);
        console.log('✅ [API] JSON парсинг успішний');
        return validateAndFormatResponse(parsed, endpoint);
      } catch (e) {
        console.error('❌ [API] JSON парсинг неуспішний:', e);
        throw new Error('Некоректний формат відповіді від сервера');
      }
    }

    // Перевіряємо наявність помилки в відповіді
    if (response.error || response.status === 'error') {
      console.error('❌ [API] Відповідь містить помилку:', {
        error: response.error,
        status: response.status,
        message: response.message
      });
      throw new Error(response.message || response.error || 'Помилка сервера');
    }

    // Додаткова обробка для конкретних ендпоінтів
    console.log('🔍 [API] Перевірка специфічних вимог для endpoint:', endpoint);

    if (endpoint.includes('/referrals/stats/')) {
      console.log('📊 [API] Валідація відповіді для stats endpoint');
      // Спеціальна обробка для статистики рефералів
      if (!response.referrals) {
        console.error('❌ [API] Відсутнє поле referrals в відповіді stats API');
        throw new Error('Некоректна структура даних статистики');
      }
      if (!response.statistics) {
        console.error('❌ [API] Відсутнє поле statistics в відповіді stats API');
        throw new Error('Некоректна структура даних статистики');
      }
      console.log('✅ [API] Структура stats відповіді валідна');
    }

    if (endpoint.includes('/referrals/activity/')) {
      console.log('📊 [API] Валідація відповіді для activity endpoint');
      // Спеціальна обробка для активності рефералів
      if (!response.level1Activity && !response.level2Activity) {
        console.error('❌ [API] Відсутні поля активності в відповіді activity API');
        throw new Error('Некоректна структура даних активності');
      }
      console.log('✅ [API] Структура activity відповіді валідна');
    }

    console.log('✅ [API] === validateAndFormatResponse SUCCESS ===');
    return response;
  }

  // Утилітарна функція для виконання HTTP запитів з обробкою помилок та авторизацією
  function apiRequest(url, options) {
    console.log('🌐 [API] === apiRequest START ===');
    console.log('📊 [API] URL:', url);
    console.log('📊 [API] Options:', JSON.stringify(options, null, 2));

    options = options || {};
    const controller = new AbortController();
    const timeoutId = setTimeout(function() {
      console.warn('⏱️ [API] Таймаут запиту! Відміна...');
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

    console.log('📊 [API] Базові заголовки встановлено');

    // Додаємо заголовок авторизації, якщо токен доступний
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
      console.log('🔑 [API] Додано заголовок авторизації');
    } else {
      console.warn('⚠️ [API] Токен авторизації відсутній');
    }

    // Додаємо Telegram User ID заголовок, якщо ID доступний
    if (userId) {
      headers['X-Telegram-User-Id'] = userId;
      console.log('👤 [API] Додано заголовок X-Telegram-User-Id:', userId);
    } else {
      console.warn('⚠️ [API] User ID відсутній');
    }

    // Об'єднуємо заголовки з опціями запиту
    const fetchOptions = Object.assign({
      signal: controller.signal,
      headers: headers
    }, options);

    console.log('🌐 [API REQUEST] Фінальні параметри:', {
      url: url,
      method: fetchOptions.method || 'GET',
      hasAuth: !!token,
      userId: userId,
      headers: fetchOptions.headers
    });

    let retryCount = 0;

    function executeRequest() {
      console.log(`🔄 [API] Виконання запиту (спроба ${retryCount + 1}/${API_CONFIG.retryAttempts})...`);

      // Додаємо параметр timestamp для запобігання кешування
      const urlWithTimestamp = url.includes('?')
        ? url + '&t=' + Date.now()
        : url + '?t=' + Date.now();

      console.log('🌐 [API] Фінальний URL з timestamp:', urlWithTimestamp);
      console.log('🕐 [API] Час запиту:', new Date().toISOString());

      return fetch(urlWithTimestamp, fetchOptions)
        .then(function(response) {
          clearTimeout(timeoutId);
          console.log('📥 [API] Відповідь отримано!');
          console.log('📊 [API] Response details:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });

          // Перевіряємо відповідь
          if (!response.ok) {
            console.error('❌ [API] HTTP помилка:', {
              status: response.status,
              statusText: response.statusText
            });

            // Якщо це помилка авторизації, спробуємо оновити токен
            if (response.status === 401 && retryCount < API_CONFIG.retryAttempts) {
              console.log('🔑 [API] 401 помилка - спроба оновити токен...');
              return refreshTokenAndRetry();
            }

            // Створюємо детальну помилку
            const error = new Error('HTTP ' + response.status + ': ' + response.statusText);
            error.status = response.status;
            error.statusText = response.statusText;
            throw error;
          }

          // Спробуємо парсити JSON відповідь
          console.log('📄 [API] Парсинг JSON відповіді...');
          return response.json().catch(function(err) {
            console.error('❌ [API] Неможливо парсити відповідь як JSON:', err);
            throw new Error('Некоректна JSON відповідь від сервера');
          });
        })
        .then(function(data) {
          console.log('✅ [API] JSON успішно отримано');
          console.log('📊 [API] Дані відповіді:', JSON.stringify(data, null, 2));

          // Форматуємо та валідуємо відповідь
          return validateAndFormatResponse(data, url);
        })
        .catch(function(error) {
          clearTimeout(timeoutId);
          console.error('❌ [API] Помилка запиту:', error);

          // Якщо це не помилка авторизації або ми вже намагалися оновити токен занадто багато разів
          if (error.status !== 401 || retryCount >= API_CONFIG.retryAttempts) {
            // Обробляємо різні типи помилок
            if (error.name === 'AbortError') {
              console.error('⏱️ [API] Запит скасовано через таймаут');
              throw new Error('Запит перевищив час очікування (' + API_CONFIG.timeout + 'мс)');
            }

            if (error.status === 404) {
              console.error('🔍 [API] Endpoint не знайдено');
              throw new Error('API ендпоінт не знайдено: ' + url);
            }

            if (error.status >= 500) {
              console.error('💥 [API] Помилка сервера');
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
      console.warn(`⚠️ [API] === Оновлення токена (спроба ${retryCount}/${API_CONFIG.retryAttempts}) ===`);

      // Спочатку спробуємо через WinixAPI
      if (window.WinixAPI && typeof window.WinixAPI.refreshToken === 'function') {
        console.log('🔑 [API] Спроба оновити токен через WinixAPI...');
        return window.WinixAPI.refreshToken()
          .then(function(result) {
            console.log('✅ [API] WinixAPI.refreshToken результат:', result);

            // Оновлюємо токен у заголовках
            const newToken = getAuthToken();
            if (newToken) {
              fetchOptions.headers['Authorization'] = 'Bearer ' + newToken;
              console.log('🔑 [API] Токен оновлено в заголовках');
            }

            // Повторно виконуємо запит
            console.log('🔄 [API] Повторний запит після оновлення токена...');
            return executeRequest();
          })
          .catch(function(err) {
            console.warn('⚠️ [API] Помилка оновлення токена через WinixAPI:', err);
            // Продовжуємо зі стандартним методом
            return standardRefreshToken();
          });
      } else {
        // Якщо WinixAPI недоступний, використовуємо стандартний метод
        console.log('🔑 [API] WinixAPI недоступний, використовуємо стандартний метод...');
        return standardRefreshToken();
      }

      // Стандартний метод оновлення токена
      function standardRefreshToken() {
        console.log('🔑 [API] === Стандартне оновлення токена ===');

        return fetch('/api/auth/refresh-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-User-Id': userId || ''
          },
          body: JSON.stringify({ telegram_id: userId })
        })
        .then(response => {
          console.log('📥 [API] Відповідь refresh-token:', {
            status: response.status,
            ok: response.ok
          });
          return response.json();
        })
        .then(data => {
          console.log('📊 [API] Дані refresh-token:', data);

          if (data.token || data.data && data.data.token) {
            const newToken = data.token || data.data.token;
            localStorage.setItem('auth_token', newToken);
            console.log('✅ [API] Новий токен збережено в localStorage');

            // Оновлюємо заголовок авторизації для повторного запиту
            fetchOptions.headers['Authorization'] = 'Bearer ' + newToken;

            // Повторно виконуємо запит
            console.log('🔄 [API] Повторний запит з новим токеном...');
            return executeRequest();
          } else {
            console.error('❌ [API] Токен не отримано від сервера');
            throw new Error('Не вдалося оновити токен авторизації');
          }
        })
        .catch(err => {
          console.error('❌ [API] Критична помилка оновлення токена:', err);
          throw err;
        });
      }
    }

    return executeRequest();
  }

  // Основні API функції

  // Отримання бейджів користувача
  function fetchUserBadges(userId) {
    console.log('🏆 [API] === fetchUserBadges START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про бейджі'));
    }

    // Переконуємося що userId це число
    const numericUserId = parseInt(userId);
    console.log('📊 [API] Конвертація userId:', {
      original: userId,
      numeric: numericUserId,
      isNaN: isNaN(numericUserId)
    });

    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
      console.log('🔄 [API] Спроба отримати бейджі через WinixAPI...');

      return window.WinixAPI.apiRequest(`badges/${numericUserId}`, 'GET')
        .then(response => {
          console.log('📥 [API] WinixAPI відповідь:', response);

          if (response.status === 'success' && response.data) {
            console.log('✅ [API] Бейджі успішно отримані через WinixAPI');
            return response.data;
          }

          // Якщо WinixAPI не повернув дані, викликаємо безпосередній запит
          console.log('⚠️ [API] WinixAPI не повернув дані, використовуємо прямий запит...');
          return apiRequest(API_CONFIG.baseUrl + '/api/badges/' + numericUserId);
        })
        .catch(error => {
          console.warn('⚠️ [API] Помилка отримання бейджів через WinixAPI:', error);
          // Якщо помилка, повертаємося до стандартного методу
          console.log('🔄 [API] Використання стандартного методу...');
          return apiRequest(API_CONFIG.baseUrl + '/api/badges/' + numericUserId);
        });
    }

    console.log('🔄 [API] Прямий запит бейджів...');
    return apiRequest(API_CONFIG.baseUrl + '/api/badges/' + numericUserId);
  }

  // Перевірка бейджів
  function checkBadges(userId) {
    console.log('🏆 [API] === checkBadges START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для перевірки бейджів'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/badges/check/' + numericUserId;
    console.log('🌐 [API] URL для перевірки:', url);

    return apiRequest(url, {
      method: 'POST'
    });
  }

  // Отримання винагороди за бейдж
  function claimBadgeReward(userId, badgeType) {
    console.log('💎 [API] === claimBadgeReward START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      badgeType: badgeType
    });

    if (!userId || !badgeType) {
      console.error('❌ [API] Відсутні обов\'язкові параметри');
      return Promise.reject(new Error('ID користувача та тип бейджа обов\'язкові для отримання винагороди'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const requestBody = {
      user_id: numericUserId,
      badge_type: badgeType
    };

    console.log('📤 [API] Тіло запиту:', requestBody);

    return apiRequest(API_CONFIG.baseUrl + '/api/badges/claim', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    .then(function(data) {
      console.log('✅ [API] Винагорода за бейдж отримана:', data);

      // Якщо успішно, спробуємо оновити баланс
      try {
        if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
          const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
          const newBalance = currentBalance + data.reward_amount;
          console.log('💰 [API] Оновлення балансу:', {
            current: currentBalance,
            reward: data.reward_amount,
            new: newBalance
          });
          window.updateUserBalanceDisplay(newBalance, true);
        }
      } catch (e) {
        console.warn('⚠️ [API] Не вдалося оновити відображення балансу:', e);
      }

      return data;
    });
  }

  // Отримання реферального посилання
  function fetchReferralLink(userId) {
    console.log('🔗 [API] === fetchReferralLink START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    console.log('📊 [API] Конвертація userId:', {
      original: userId,
      numeric: numericUserId,
      isNaN: isNaN(numericUserId)
    });

    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
      console.log('🔄 [API] Спроба отримати посилання через WinixAPI...');

      return window.WinixAPI.apiRequest(`referrals/link/${numericUserId}`, 'GET')
        .then(response => {
          console.log('📥 [API] WinixAPI відповідь:', response);

          if (response.status === 'success' && response.data && response.data.link) {
            console.log('✅ [API] Посилання отримано через WinixAPI:', response.data.link);
            return response.data.link;
          }

          // Якщо WinixAPI успішний, але формат відповіді не відповідає
          if (response.status === 'success' && response.data) {
            console.log('🔍 [API] Аналіз даних від WinixAPI...');

            // Спробуємо знайти посилання в даних
            if (typeof response.data === 'string' && response.data.includes('t.me')) {
              console.log('✅ [API] Знайдено посилання як рядок:', response.data);
              return response.data;
            }

            // Якщо не вдалося, створюємо посилання вручну
            console.log('⚠️ [API] Посилання не знайдено, створюємо вручну...');
            return formatReferralUrl(numericUserId);
          }

          // Якщо WinixAPI не повернув посилання, викликаємо безпосередній запит
          console.log('⚠️ [API] WinixAPI не повернув посилання, використовуємо прямий запит...');
          return apiRequest(API_CONFIG.baseUrl + '/api/referrals/link/' + numericUserId)
            .then(data => {
              console.log('📥 [API] Пряма відповідь:', data);

              if (data && data.link) {
                console.log('✅ [API] Посилання отримано:', data.link);
                return data.link;
              }

              // Якщо відповідь не містить посилання, створюємо його вручну
              console.log('⚠️ [API] Створення посилання вручну...');
              return formatReferralUrl(numericUserId);
            });
        })
        .catch(error => {
          console.error('❌ [API] Помилка отримання реферального посилання через WinixAPI:', error);
          // При помилці викидаємо її далі
          throw error;
        });
    }

    // Якщо WinixAPI недоступний, викликаємо звичайний запит
    console.log('🔄 [API] Прямий запит реферального посилання...');
    return apiRequest(API_CONFIG.baseUrl + '/api/referrals/link/' + numericUserId)
      .then(data => {
        console.log('📥 [API] Відповідь:', data);

        if (data && data.link) {
          console.log('✅ [API] Посилання отримано:', data.link);
          return data.link;
        }

        // Якщо відповідь не містить посилання, створюємо його вручну
        console.log('⚠️ [API] Створення посилання вручну...');
        return formatReferralUrl(numericUserId);
      });
  }

  // Допоміжна функція для форматування реферального посилання
  function formatReferralUrl(userId) {
    console.log('🔗 [API] === formatReferralUrl ===');
    console.log('📊 [API] userId:', userId);

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return null;
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return null;
    }

    const url = 'https://t.me/WINIX_Official_bot?start=' + numericUserId;
    console.log('✅ [API] Сформовано URL:', url);
    return url;
  }

  // Отримання статистики рефералів
  function fetchReferralStats(userId) {
    console.log('📊 [API] === fetchReferralStats START ===');
    console.log('📊 [API] Параметри:', { userId: userId });
    console.log('🕐 [API] Час запиту:', new Date().toISOString());

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання статистики рефералів'));
    }

    const numericUserId = parseInt(userId);
    console.log('📊 [API] Конвертація userId:', {
      original: userId,
      numeric: numericUserId,
      isNaN: isNaN(numericUserId)
    });

    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    // ВИПРАВЛЕННЯ: Одразу переходимо до прямого запиту
    console.log('🔄 [API] Використовуємо прямий запит (обхід WinixAPI)...');
    return sendStatsRequest();

    // Функція для виконання стандартного запиту
    function sendStatsRequest() {
      console.log('🔄 [API] === sendStatsRequest ===');
      const url = API_CONFIG.baseUrl + '/api/referrals/stats/' + numericUserId;
      console.log('🌐 [API] URL для запиту:', url);

      return apiRequest(url)
        .then(function(response) {
          console.log('✅ [API] Статистика отримана успішно');
          console.log('📊 [API] Сира відповідь:', JSON.stringify(response, null, 2));

          // Перевіряємо формат відповіді та повертаємо валідовані дані
          return validateAndFormatResponse(response, `/api/referrals/stats/${numericUserId}`);
        })
        .catch(function(error) {
          console.error('❌ [API] === fetchReferralStats FAILED ===');
          console.error('❌ [API] Тип помилки:', error.name);
          console.error('❌ [API] Повідомлення:', error.message);
          console.error('❌ [API] Stack trace:', error.stack);

          // Пробрасуємо помилку далі
          throw error;
        });
    }
  }

  // Отримання заробітків від рефералів
  function fetchReferralEarnings(userId, options) {
    console.log('💰 [API] === fetchReferralEarnings START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      options: options
    });

    options = options || {};
    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про заробітки'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/earnings/' + numericUserId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url, {
      method: 'POST',
      body: JSON.stringify(options)
    })
    .then(response => {
      console.log('✅ [API] Заробітки отримані');
      return validateAndFormatResponse(response, `/api/referrals/earnings/${numericUserId}`);
    });
  }

  // Отримання детальних заробітків від рефералів
  function fetchReferralDetailedEarnings(referralId, options) {
    console.log('💰 [API] === fetchReferralDetailedEarnings START ===');
    console.log('📊 [API] Параметри:', {
      referralId: referralId,
      options: options
    });

    options = options || {};
    if (!referralId) {
      console.error('❌ [API] referralId відсутній');
      return Promise.reject(new Error('ID реферала обов\'язковий для отримання детальних даних'));
    }

    // Обробляємо формат ідентифікатора (з або без 'WX')
    let realId = referralId;
    if (typeof referralId === 'string' && referralId.startsWith('WX')) {
      realId = referralId.substring(2);  // Видаляємо 'WX' з початку
      console.log('🔄 [API] Видалено префікс WX:', { original: referralId, real: realId });
    }

    const numericReferralId = parseInt(realId);
    if (isNaN(numericReferralId)) {
      console.error('❌ [API] referralId не є числом');
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/earnings/detailed/' + numericReferralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Детальні заробітки отримані');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання зведених даних про заробітки
  function fetchEarningsSummary(userId) {
    console.log('💰 [API] === fetchEarningsSummary START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання зведених даних'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/earnings/summary/' + numericUserId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Зведені дані про заробітки отримані');
        return validateAndFormatResponse(response, `/api/referrals/earnings/summary/${numericUserId}`);
      });
  }

  // Отримання активності рефералів
  function fetchReferralActivity(userId, options) {
    console.log('🎯 [API] === fetchReferralActivity START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      options: options
    });

    options = options || {};
    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про активність'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/activity/' + numericUserId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url, {
      method: 'POST',
      body: JSON.stringify(options)
    })
    .then(response => {
      console.log('✅ [API] Активність рефералів отримана');
      return validateAndFormatResponse(response, `/api/referrals/activity/${numericUserId}`);
    });
  }

  // Отримання детальної активності рефералів
  function fetchReferralDetailedActivity(referralId, options) {
    console.log('🎯 [API] === fetchReferralDetailedActivity START ===');
    console.log('📊 [API] Параметри:', {
      referralId: referralId,
      options: options
    });

    options = options || {};
    if (!referralId) {
      console.error('❌ [API] referralId відсутній');
      return Promise.reject(new Error('ID реферала обов\'язковий для отримання детальних даних'));
    }

    // Обробляємо формат ідентифікатора (з або без 'WX')
    let realId = referralId;
    if (typeof referralId === 'string' && referralId.startsWith('WX')) {
      realId = referralId.substring(2);  // Видаляємо 'WX' з початку
      console.log('🔄 [API] Видалено префікс WX:', { original: referralId, real: realId });
    }

    const numericReferralId = parseInt(realId);
    if (isNaN(numericReferralId)) {
      console.error('❌ [API] referralId не є числом');
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/activity/detailed/' + numericReferralId;
    if (options.startDate || options.endDate) {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      url += '?' + params.toString();
    }

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Детальна активність отримана');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання зведених даних про активність
  function fetchActivitySummary(userId) {
    console.log('🎯 [API] === fetchActivitySummary START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про активність'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/activity/summary/' + numericUserId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Зведені дані про активність отримані');
        return validateAndFormatResponse(response, `/api/referrals/activity/summary/${numericUserId}`);
      });
  }

  // Оновлення активності рефералів
  function updateReferralActivity(userId, drawsParticipation, invitedReferrals) {
    console.log('🔄 [API] === updateReferralActivity START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      drawsParticipation: drawsParticipation,
      invitedReferrals: invitedReferrals
    });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для оновлення активності'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const requestBody = {
      user_id: numericUserId,
      draws_participation: drawsParticipation,
      invited_referrals: invitedReferrals
    };

    console.log('📤 [API] Тіло запиту:', requestBody);

    return apiRequest(API_CONFIG.baseUrl + '/api/referrals/activity/update', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      console.log('✅ [API] Активність оновлена');
      return validateAndFormatResponse(response, '/api/referrals/activity/update');
    });
  }

  // Ручна активація реферала
  function manuallyActivateReferral(userId, adminId) {
    console.log('🔧 [API] === manuallyActivateReferral START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      adminId: adminId
    });

    if (!userId || !adminId) {
      console.error('❌ [API] Відсутні обов\'язкові параметри');
      return Promise.reject(new Error('ID користувача та адміністратора обов\'язкові для ручної активації'));
    }

    const numericUserId = parseInt(userId);
    const numericAdminId = parseInt(adminId);

    console.log('📊 [API] Конвертація ID:', {
      userId: { original: userId, numeric: numericUserId },
      adminId: { original: adminId, numeric: numericAdminId }
    });

    if (isNaN(numericUserId) || isNaN(numericAdminId)) {
      console.error('❌ [API] ID не є числами');
      return Promise.reject(new Error('ID користувача та адміністратора повинні бути числами'));
    }

    const requestBody = {
      user_id: numericUserId,
      admin_id: numericAdminId
    };

    console.log('📤 [API] Тіло запиту:', requestBody);

    return apiRequest(API_CONFIG.baseUrl + '/api/referrals/activity/activate', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      console.log('✅ [API] Реферал активовано вручну');
      return validateAndFormatResponse(response, '/api/referrals/activity/activate');
    });
  }

  // Отримання завдань користувача
  function fetchUserTasks(userId) {
    console.log('📋 [API] === fetchUserTasks START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для отримання даних про завдання'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/tasks/' + numericUserId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Завдання отримані');
        return validateAndFormatResponse(response, `/api/tasks/${numericUserId}`);
      });
  }

  // Оновлення завдань
  function updateTasks(userId) {
    console.log('🔄 [API] === updateTasks START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий для оновлення завдань'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/tasks/update/' + numericUserId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url, {
      method: 'POST'
    })
    .then(response => {
      console.log('✅ [API] Завдання оновлені');
      return validateAndFormatResponse(response, `/api/tasks/update/${numericUserId}`);
    });
  }

  // Отримання винагороди за завдання
  function claimTaskReward(userId, taskType) {
    console.log('🎁 [API] === claimTaskReward START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      taskType: taskType
    });

    if (!userId || !taskType) {
      console.error('❌ [API] Відсутні обов\'язкові параметри');
      return Promise.reject(new Error('ID користувача та тип завдання обов\'язкові для отримання винагороди'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    const requestBody = {
      user_id: numericUserId,
      task_type: taskType
    };

    console.log('📤 [API] Тіло запиту:', requestBody);

    return apiRequest(API_CONFIG.baseUrl + '/api/tasks/claim', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    .then(function(data) {
      console.log('✅ [API] Винагорода за завдання отримана');

      // Валідуємо відповідь
      data = validateAndFormatResponse(data, '/api/tasks/claim');

      // Якщо успішно, спробуємо оновити баланс
      try {
        if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
          const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
          const newBalance = currentBalance + data.reward_amount;
          console.log('💰 [API] Оновлення балансу:', {
            current: currentBalance,
            reward: data.reward_amount,
            new: newBalance
          });
          window.updateUserBalanceDisplay(newBalance, true);
        }
      } catch (e) {
        console.warn('⚠️ [API] Не вдалося оновити відображення балансу:', e);
      }

      return data;
    });
  }

  // Реєстрація реферала
  function registerReferral(referrerId, userId) {
    console.log('📝 [API] === registerReferral START ===');
    console.log('📊 [API] Параметри:', {
      referrerId: referrerId,
      userId: userId
    });

    if (!referrerId) {
      console.error('❌ [API] referrerId відсутній');
      return Promise.reject(new Error('ID реферера обов\'язковий'));
    }

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericReferrerId = parseInt(referrerId);
    const numericUserId = parseInt(userId);

    console.log('📊 [API] Конвертація ID:', {
      referrerId: { original: referrerId, numeric: numericReferrerId },
      userId: { original: userId, numeric: numericUserId }
    });

    if (isNaN(numericReferrerId) || isNaN(numericUserId)) {
      console.error('❌ [API] ID не є числами');
      return Promise.reject(new Error('ID реферера та користувача повинні бути числами'));
    }

    if (numericReferrerId === numericUserId) {
      console.error('❌ [API] Користувач намагається запросити себе');
      return Promise.reject(new Error('Користувач не може запросити себе'));
    }

    const requestBody = {
      referrer_id: numericReferrerId,
      referee_id: numericUserId
    };

    console.log('📤 [API] Тіло запиту:', requestBody);

    return apiRequest(API_CONFIG.baseUrl + '/api/referrals/register', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      console.log('✅ [API] Реферал зареєстровано');
      return validateAndFormatResponse(response, '/api/referrals/register');
    });
  }

  // Перевірка, чи є користувач рефералом
  function checkIfReferral(userId) {
    console.log('🔍 [API] === checkIfReferral START ===');
    console.log('📊 [API] Параметри:', { userId: userId });

    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    console.log('🔄 [API] Викликаємо fetchReferralStats для перевірки...');

    return fetchReferralStats(numericUserId)
      .then(function(data) {
        const isReferral = !!(data && data.referrals);
        console.log('📊 [API] Результат перевірки:', {
          isReferral: isReferral,
          hasData: !!data,
          hasReferrals: !!(data && data.referrals)
        });
        return isReferral;
      });
  }

  // Отримання історії рефералів
  function fetchReferralHistory(userId, options) {
    console.log('📜 [API] === fetchReferralHistory START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      options: options
    });

    options = options || {};
    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/history/' + numericUserId;

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

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Історія рефералів отримана');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання розіграшів реферала
  function fetchReferralDraws(referralId) {
    console.log('🎲 [API] === fetchReferralDraws START ===');
    console.log('📊 [API] Параметри:', { referralId: referralId });

    if (!referralId) {
      console.error('❌ [API] referralId відсутній');
      return Promise.reject(new Error('ID реферала обов\'язковий'));
    }

    // Обробляємо формат ідентифікатора (з або без 'WX')
    let realId = referralId;
    if (typeof referralId === 'string' && referralId.startsWith('WX')) {
      realId = referralId.substring(2);  // Видаляємо 'WX' з початку
      console.log('🔄 [API] Видалено префікс WX:', { original: referralId, real: realId });
    }

    const numericReferralId = parseInt(realId);
    if (isNaN(numericReferralId)) {
      console.error('❌ [API] referralId не є числом');
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/draws/' + numericReferralId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Розіграші отримані');
        return validateAndFormatResponse(response, `/api/referrals/draws/${numericReferralId}`);
      });
  }

  // Отримання деталей розіграшу
  function fetchDrawDetails(referralId, drawId) {
    console.log('🎯 [API] === fetchDrawDetails START ===');
    console.log('📊 [API] Параметри:', {
      referralId: referralId,
      drawId: drawId
    });

    if (!referralId || !drawId) {
      console.error('❌ [API] Відсутні обов\'язкові параметри');
      return Promise.reject(new Error('ID реферала та розіграшу обов\'язкові'));
    }

    // Обробляємо формат ідентифікатора (з або без 'WX')
    let realId = referralId;
    if (typeof referralId === 'string' && referralId.startsWith('WX')) {
      realId = referralId.substring(2);  // Видаляємо 'WX' з початку
      console.log('🔄 [API] Видалено префікс WX:', { original: referralId, real: realId });
    }

    const numericReferralId = parseInt(realId);
    const numericDrawId = parseInt(drawId);

    console.log('📊 [API] Конвертація ID:', {
      referralId: { original: referralId, numeric: numericReferralId },
      drawId: { original: drawId, numeric: numericDrawId }
    });

    if (isNaN(numericReferralId) || isNaN(numericDrawId)) {
      console.error('❌ [API] ID не є числами');
      return Promise.reject(new Error('ID реферала та розіграшу повинні бути числами'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/draws/details/' + numericReferralId + '/' + numericDrawId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Деталі розіграшу отримані');
        return validateAndFormatResponse(response, `/api/referrals/draws/details/${numericReferralId}/${numericDrawId}`);
      });
  }

  // Отримання статистики участі в розіграшах
  function fetchDrawsParticipationStats(ownerId, options) {
    console.log('📊 [API] === fetchDrawsParticipationStats START ===');
    console.log('📊 [API] Параметри:', {
      ownerId: ownerId,
      options: options
    });

    options = options || {};
    if (!ownerId) {
      console.error('❌ [API] ownerId відсутній');
      return Promise.reject(new Error('ID власника обов\'язковий'));
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      console.error('❌ [API] ownerId не є числом');
      return Promise.reject(new Error('ID власника повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/draws/stats/' + numericOwnerId;
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

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Статистика участі в розіграшах отримана');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання загальної кількості розіграшів
  function fetchTotalDrawsCount(ownerId) {
    console.log('🎲 [API] === fetchTotalDrawsCount START ===');
    console.log('📊 [API] Параметри:', { ownerId: ownerId });

    if (!ownerId) {
      console.error('❌ [API] ownerId відсутній');
      return Promise.reject(new Error('ID власника обов\'язковий'));
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      console.error('❌ [API] ownerId не є числом');
      return Promise.reject(new Error('ID власника повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/draws/count/' + numericOwnerId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(function(data) {
        console.log('✅ [API] Кількість розіграшів отримана');

        // Валідуємо відповідь
        data = validateAndFormatResponse(data, `/api/referrals/draws/count/${numericOwnerId}`);

        const count = data.totalDrawsCount || 0;
        console.log('📊 [API] Загальна кількість розіграшів:', count);

        return count;
      });
  }

  // Отримання найактивніших учасників розіграшів
  function fetchMostActiveInDraws(ownerId, limit) {
    console.log('🏆 [API] === fetchMostActiveInDraws START ===');
    console.log('📊 [API] Параметри:', {
      ownerId: ownerId,
      limit: limit
    });

    limit = limit || 10;
    if (!ownerId) {
      console.error('❌ [API] ownerId відсутній');
      return Promise.reject(new Error('ID власника обов\'язковий'));
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      console.error('❌ [API] ownerId не є числом');
      return Promise.reject(new Error('ID власника повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/draws/active/' + numericOwnerId + '?limit=' + limit;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Найактивніші учасники отримані');
        return validateAndFormatResponse(response, `/api/referrals/draws/active/${numericOwnerId}?limit=${limit}`);
      });
  }

  // Отримання історії подій рефералів
  function fetchReferralEventHistory(userId, eventType, options) {
    console.log('📅 [API] === fetchReferralEventHistory START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      eventType: eventType,
      options: options
    });

    options = options || {};
    if (!userId || !eventType) {
      console.error('❌ [API] Відсутні обов\'язкові параметри');
      return Promise.reject(new Error('ID користувача та тип події обов\'язкові'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/history/event/' + numericUserId + '/' + eventType;

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

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Історія подій отримана');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання зведених даних про активність рефералів
  function fetchReferralActivitySummary(userId, options) {
    console.log('📊 [API] === fetchReferralActivitySummary START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      options: options
    });

    options = options || {};
    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/history/summary/' + numericUserId;

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

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Зведені дані про активність отримані');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання тренду активності рефералів
  function fetchReferralActivityTrend(userId, period, options) {
    console.log('📈 [API] === fetchReferralActivityTrend START ===');
    console.log('📊 [API] Параметри:', {
      userId: userId,
      period: period,
      options: options
    });

    period = period || 'monthly';
    options = options || {};
    if (!userId) {
      console.error('❌ [API] userId відсутній');
      return Promise.reject(new Error('ID користувача обов\'язковий'));
    }

    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      console.error('❌ [API] userId не є числом');
      return Promise.reject(new Error('ID користувача повинен бути числом'));
    }

    let url = API_CONFIG.baseUrl + '/api/referrals/history/trend/' + numericUserId + '/' + period;

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

    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Тренд активності отримано');
        return validateAndFormatResponse(response, url);
      });
  }

  // Отримання деталей реферала
  function fetchReferralDetails(referralId) {
    console.log('👤 [API] === fetchReferralDetails START ===');
    console.log('📊 [API] Параметри:', { referralId: referralId });

    if (!referralId) {
      console.error('❌ [API] referralId відсутній');
      return Promise.reject(new Error('ID реферала обов\'язковий'));
    }

    // Обробляємо формат ідентифікатора (з або без 'WX')
    let realId = referralId;
    if (typeof referralId === 'string' && referralId.startsWith('WX')) {
      realId = referralId.substring(2);  // Видаляємо 'WX' з початку
      console.log('🔄 [API] Видалено префікс WX:', { original: referralId, real: realId });
    }

    const numericReferralId = parseInt(realId);
    if (isNaN(numericReferralId)) {
      console.error('❌ [API] referralId не є числом');
      return Promise.reject(new Error('ID реферала повинен бути числом'));
    }

    const url = API_CONFIG.baseUrl + '/api/referrals/details/' + numericReferralId;
    console.log('🌐 [API] URL:', url);

    return apiRequest(url)
      .then(response => {
        console.log('✅ [API] Деталі реферала отримані');
        return validateAndFormatResponse(response, `/api/referrals/details/${numericReferralId}`);
      });
  }

  // Функція для оновлення токена авторизації
  function refreshAuthToken() {
    console.log('🔑 [API] === refreshAuthToken START ===');

    const userId = getUserId();
    if (!userId) {
      console.error('❌ [API] userId відсутній для оновлення токена');
      return Promise.reject(new Error('ID користувача відсутній'));
    }

    console.log('🔄 [API] Спроба оновити токен для користувача:', userId);

    // Спочатку спробуємо через WinixAPI
    if (window.WinixAPI && typeof window.WinixAPI.refreshToken === 'function') {
      console.log('🔑 [API] Використання WinixAPI.refreshToken...');

      return window.WinixAPI.refreshToken()
        .then(result => {
          console.log('📊 [API] WinixAPI.refreshToken результат:', result);

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
      console.log('🔑 [API] WinixAPI недоступний, використовуємо стандартний метод...');
      return standardRefreshToken();
    }

    // Стандартний метод оновлення токена
    function standardRefreshToken() {
      console.log('🔑 [API] === standardRefreshToken ===');

      return fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-User-Id': userId
        },
        body: JSON.stringify({ telegram_id: userId })
      })
      .then(response => {
        console.log('📥 [API] Відповідь refresh-token:', {
          status: response.status,
          ok: response.ok
        });
        return response.json();
      })
      .then(data => {
        console.log('📊 [API] Дані refresh-token:', data);

        if (data.token || (data.data && data.data.token)) {
          const newToken = data.token || data.data.token;
          localStorage.setItem('auth_token', newToken);
          console.log('✅ [API] Новий токен збережено!');
          return newToken;
        } else {
          console.error('❌ [API] Токен не отримано від сервера');
          throw new Error('Не вдалося оновити токен авторизації');
        }
      });
    }
  }

  // Функція для перевірки доступності API
  function checkAPIHealth() {
    console.log('🏥 [API] === checkAPIHealth START ===');

    const url = API_CONFIG.baseUrl + '/api/health';
    console.log('🌐 [API] Health check URL:', url);

    return apiRequest(url)
      .then(function() {
        console.log('✅ [API] API здоровий та доступний!');
        return true;
      })
      .catch(function(error) {
        console.warn('⚠️ [API] API недоступний або має проблеми:', error.message);
        return false;
      });
  }

  console.log('✅ [API] ========== МОДУЛЬ ReferralAPI ЗАВАНТАЖЕНО УСПІШНО ==========');
  console.log('📊 [API] Доступні функції:', Object.keys({
    fetchUserBadges,
    checkBadges,
    claimBadgeReward,
    fetchReferralActivity,
    fetchReferralDetailedActivity,
    fetchActivitySummary,
    updateReferralActivity,
    manuallyActivateReferral,
    fetchReferralDraws,
    fetchDrawDetails,
    fetchDrawsParticipationStats,
    fetchTotalDrawsCount,
    fetchMostActiveInDraws,
    fetchReferralEarnings,
    fetchReferralDetailedEarnings,
    fetchEarningsSummary,
    fetchReferralHistory,
    fetchReferralEventHistory,
    fetchReferralActivitySummary,
    fetchReferralActivityTrend,
    fetchReferralLink,
    fetchReferralStats,
    fetchReferralDetails,
    fetchUserTasks,
    updateTasks,
    claimTaskReward,
    registerReferral,
    checkIfReferral,
    apiRequest,
    checkAPIHealth,
    refreshAuthToken,
    getAuthToken,
    getUserId,
    validateAndFormatResponse
  }));

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
    validateAndFormatResponse: validateAndFormatResponse,

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

console.log('✅ [GLOBAL] window.ReferralAPI зареєстровано глобально');
console.log('📊 [GLOBAL] Перевірка доступності:', {
  ReferralAPI: typeof window.ReferralAPI,
  hasConfig: window.ReferralAPI && window.ReferralAPI.config,
  methodsCount: window.ReferralAPI ? Object.keys(window.ReferralAPI).length : 0
});