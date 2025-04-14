/**
 * api.js - Сервіс для роботи з API розіграшів
 * Інтеграція з основним API системи
 * @version 1.3.0 - Оптимізована версія для єдиної системи
 */

import WinixRaffles from '../globals.js';
import { showToast } from '../utils/ui-helpers.js';

// Конфігурація API, яку можна замінити на імпорт з config.js
const API_CONFIG = {
  BASE_URL: '/api',
  TIMEOUT: 30000,
  CACHE_TTL: {
    ACTIVE_RAFFLES: 60000,   // 1 хвилина
    HISTORY: 300000,         // 5 хвилин
    USER_DATA: 120000,       // 2 хвилини
    STATISTICS: 600000       // 10 хвилин
  },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,
  RATE_LIMIT_COOLDOWN: 60000
};

// Збільшені інтервали для обмеження частоти запитів
const REQUEST_THROTTLE = {
  '/raffles-history': 180000,     // 3 хвилини для історії розіграшів
  '/participate-raffle': 60000,   // 1 хвилина для участі в розіграшах
  '/raffles': 60000,              // 1 хвилина для списку розіграшів
  '/balance': 30000,              // 30 секунд для балансу
  '/refresh-token': 60000,        // 1 хвилина для оновлення токену
  'default': 20000                // 20 секунд для всіх інших
};

// Відстеження останніх запитів
const _lastRequestsByEndpoint = {};

// Глобальна змінна для відстеження часу останнього запиту
let _lastRequestTime = Date.now();

// Активні запити
const _activeRequests = {};

// Кеш даних
const _cache = {
  activeRaffles: { data: null, timestamp: 0, ttl: API_CONFIG.CACHE_TTL.ACTIVE_RAFFLES },
  history: { data: null, timestamp: 0, ttl: API_CONFIG.CACHE_TTL.HISTORY },
  userData: { data: null, timestamp: 0, ttl: API_CONFIG.CACHE_TTL.USER_DATA }
};

// Лічильник запитів для контролю
let _requestCounter = {
  total: 0,
  errors: 0,
  lastReset: Date.now()
};

// Прапорець, що вказує на останнє оновлення токену
let _tokenLastRefreshed = 0;

// Покращена перевірка доступності основного API
const hasMainApi = () => {
  try {
    return window.WinixAPI &&
      typeof window.WinixAPI.apiRequest === 'function' &&
      typeof window.WinixAPI.getUserId === 'function';
  } catch (e) {
    console.error("🔌 Raffles API: Помилка перевірки головного API:", e);
    return false;
  }
};

/**
 * Отримати ID користувача
 * @returns {string|null} ID користувача або null
 */
function getUserId() {
  // Використовуємо основний API, якщо доступний
  if (hasMainApi()) {
    try {
      return window.WinixAPI.getUserId();
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання ID з основного API:", e);
    }
  }

  // Резервна реалізація
  try {
    // Перевіряємо Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        if (window.Telegram.WebApp.initDataUnsafe &&
          window.Telegram.WebApp.initDataUnsafe.user &&
          window.Telegram.WebApp.initDataUnsafe.user.id) {

          const telegramId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
          return telegramId;
        }
      } catch (e) {
        console.warn("🔌 Raffles API: Помилка отримання ID з Telegram WebApp:", e);
      }
    }

    // Перевіряємо localStorage
    try {
      const localId = localStorage.getItem('telegram_user_id');
      if (localId && localId !== 'undefined' && localId !== 'null') return localId;
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання ID з localStorage:", e);
    }

    // Перевіряємо DOM елемент
    try {
      const userIdElement = document.getElementById('user-id');
      if (userIdElement && userIdElement.textContent) {
        const domId = userIdElement.textContent.trim();
        if (domId && domId !== 'undefined' && domId !== 'null') {
          return domId;
        }
      }
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання ID з DOM:", e);
    }

    // Перевіряємо URL параметри
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
      if (urlId && urlId !== 'undefined' && urlId !== 'null') {
        return urlId;
      }
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання ID з URL:", e);
    }

    return null;
  } catch (error) {
    console.error("🔌 Raffles API: Критична помилка отримання ID користувача:", error);
    return null;
  }
}

/**
 * Отримання токену авторизації
 * @returns {string|null} Токен авторизації або null
 */
function getAuthToken() {
  // Використовуємо основний API, якщо доступний
  if (hasMainApi() && typeof window.WinixAPI.getAuthToken === 'function') {
    try {
      const token = window.WinixAPI.getAuthToken();
      if (token) {
        return token;
      }
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання токену з основного API:", e);
    }
  }

  // Резервний варіант - localStorage
  try {
    // Перевіряємо різні можливі ключі
    const possibleKeys = ['auth_token', 'token', 'accessToken'];
    for (const key of possibleKeys) {
      const token = localStorage.getItem(key);
      if (token && typeof token === 'string' && token.length > 5) {
        return token;
      }
    }
  } catch (e) {
    console.warn("🔌 Raffles API: Помилка отримання токену з localStorage:", e);
  }

  console.warn("⚠️ Raffles API: Токен авторизації не знайдено");
  return null;
}

/**
 * Отримання правильного базового URL API
 * @returns {string} Базовий URL API
 */
function getApiBaseUrl() {
  // Спочатку перевіряємо налаштування у локальному конфігу
  if (WinixRaffles && WinixRaffles.config && WinixRaffles.config.apiBaseUrl) {
    return WinixRaffles.config.apiBaseUrl;
  }

  // Перевіряємо глобальний конфіг
  if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
    // Переконуємося, що URL не закінчується на /api
    const url = window.WinixConfig.apiBaseUrl;
    return url.endsWith('/api') ? url.slice(0, -4) : url;
  }

  // Перевіряємо основний API
  if (hasMainApi() && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
    const baseUrl = window.WinixAPI.config.baseUrl;
    return baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
  }

  // Визначаємо URL на основі поточного середовища
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Локальне середовище - використовуємо порт 8080
    return `http://${hostname}:8080`;
  } else if (hostname.includes('testenv') || hostname.includes('staging')) {
    // Тестові середовища
    return `https://${hostname}`;
  } else {
    // Продакшн середовище
    return 'https://winixbot.com';
  }
}

/**
 * Перевірка і управління обмеженням частоти запитів
 * @param {string} endpoint - Endpoint API
 * @returns {boolean} Дозволено виконати запит
 */
function canMakeRequest(endpoint) {
  const now = Date.now();

  // Визначаємо мінімальний інтервал для ендпоінту
  let throttleTime = REQUEST_THROTTLE.default;
  for (const key in REQUEST_THROTTLE) {
    if (endpoint.includes(key)) {
      throttleTime = REQUEST_THROTTLE[key];
      break;
    }
  }

  // Перевіряємо, коли був останній запит
  const lastRequestTime = _lastRequestsByEndpoint[endpoint] || 0;
  if (now - lastRequestTime < throttleTime) {
    console.warn(`🔌 Raffles API: Занадто частий запит до ${endpoint}, залишилось ${Math.ceil((throttleTime - (now - lastRequestTime)) / 1000)}с`);
    return false;
  }

  // Оновлюємо час останнього запиту
  _lastRequestsByEndpoint[endpoint] = now;
  _lastRequestTime = now;
  return true;
}

/**
 * Очищення зависаючих запитів
 */
function cleanupHangingRequests() {
  const now = Date.now();
  for (const endpoint in _activeRequests) {
    if (now - _activeRequests[endpoint] > 30000) { // 30 секунд
      console.warn(`🔌 Raffles API: Виявлено зависаючий запит до ${endpoint}, очищаємо`);
      delete _activeRequests[endpoint];
    }
  }
}

/**
 * Примусове очищення всіх активних запитів
 */
function forceCleanupRequests() {
  for (const endpoint in _activeRequests) {
    delete _activeRequests[endpoint];
  }
  console.log("🔌 Raffles API: Примусово очищено всі активні запити");
  return true;
}

/**
 * Оновлення токену авторизації
 * @returns {Promise<boolean>} Результат оновлення
 */
async function refreshToken() {
  // Перевіряємо, чи не було нещодавнього оновлення токену
  const now = Date.now();
  if (now - _tokenLastRefreshed < 30000) {
    console.log("🔌 Raffles API: Токен нещодавно оновлювався, пропускаємо");
    return true;
  }

  console.log("🔄 Raffles API: Починаємо оновлення токену");

  // Використовуємо основний API, якщо доступний
  if (hasMainApi() && typeof window.WinixAPI.refreshToken === 'function') {
    try {
      console.log("🔄 Raffles API: Спроба оновлення через основний API");
      const result = await window.WinixAPI.refreshToken();
      if (result) {
        _tokenLastRefreshed = now;
        console.log("✅ Raffles API: Токен успішно оновлено через основний API");
        return true;
      }
    } catch (e) {
      console.warn("⚠️ Raffles API: Помилка оновлення через основний API:", e);
      // Продовжуємо з нашою реалізацією
    }
  }

  // Власна реалізація
  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error("ID користувача не знайдено");
    }

    const oldToken = getAuthToken() || '';

    // Створюємо запит напряму
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-User-Id': userId
      },
      body: JSON.stringify({
        telegram_id: userId,
        token: oldToken
      })
    });

    if (!response.ok) {
      throw new Error(`Помилка HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.status === 'success' && data.token) {
      _tokenLastRefreshed = now;
      console.log("✅ Raffles API: Токен успішно оновлено через власну реалізацію");
      localStorage.setItem('auth_token', data.token);

      // Встановлюємо термін дії
      if (data.expires_at) {
        localStorage.setItem('auth_token_expiry', new Date(data.expires_at).getTime().toString());
      } else if (data.expires_in) {
        localStorage.setItem('auth_token_expiry', (Date.now() + (data.expires_in * 1000)).toString());
      }

      return true;
    } else {
      throw new Error(data.message || "Не вдалося оновити токен");
    }
  } catch (error) {
    console.error("❌ Raffles API: Помилка оновлення токену:", error);
    return false;
  }
}

/**
 * Визначення ключа кешу на основі endpoint
 * @param {string} endpoint - Endpoint запиту
 * @returns {string|null} Ключ кешу або null
 */
function getCacheKeyFromEndpoint(endpoint) {
  if (endpoint.includes('raffles') && !endpoint.includes('history')) {
    return 'activeRaffles';
  } else if (endpoint.includes('history')) {
    return 'history';
  } else if (endpoint.includes('user')) {
    return 'userData';
  }
  return null;
}

/**
 * Кешування відповіді API
 * @param {string} endpoint - Endpoint запиту
 * @param {Object} response - Відповідь API
 */
function cacheResponse(endpoint, response) {
  if (!response || response.status !== 'success' || !response.data) return;

  const cacheKey = getCacheKeyFromEndpoint(endpoint);
  if (!cacheKey) return;

  _cache[cacheKey] = {
    data: response.data,
    timestamp: Date.now(),
    ttl: _cache[cacheKey]?.ttl || 60000
  };
}

/**
 * Універсальна функція для виконання API-запитів
 * @param {string} endpoint - URL ендпоінту
 * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
 * @param {Object} data - Дані для відправки
 * @param {Object} options - Додаткові параметри
 * @returns {Promise<Object>} Результат запиту
 */
async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
  // Якщо endpoint починається з "/", видаляємо цей символ
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

  // Перевірка на блокування глобальних API запитів (захист від циклічних помилок)
  if (window._blockApiRequests && !options.bypassBlocker) {
    console.warn(`🔌 Raffles API: Запити тимчасово заблоковані для ${cleanEndpoint}`);
    // Перевіряємо, чи є кешовані дані
    const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
    if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
      return {
        status: 'success',
        data: _cache[cacheKey].data,
        source: 'cache_blocked'
      };
    }
    return {
      status: 'error',
      message: 'Запити тимчасово заблоковані для стабілізації системи',
      source: 'blocked'
    };
  }

  // Перевіряємо, чи можна виконати запит (обмеження частоти)
  if (!options.bypassThrottle && !canMakeRequest(cleanEndpoint)) {
    // Перевіряємо, чи є кешовані дані
    const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
    if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
      console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} через обмеження частоти`);
      return {
        status: 'success',
        data: _cache[cacheKey].data,
        source: 'cache_throttled'
      };
    }

    return {
      status: 'error',
      message: 'Занадто частий запит',
      source: 'throttled'
    };
  }

  // Перевіряємо, чи запит вже виконується
  if (_activeRequests[cleanEndpoint] && !options.allowParallel) {
    console.warn(`🔌 Raffles API: Запит до ${cleanEndpoint} вже виконується`);

    // Перевіряємо, чи є кешовані дані
    const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
    if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
      console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} через паралельний запит`);
      return {
        status: 'success',
        data: _cache[cacheKey].data,
        source: 'cache_parallel'
      };
    }

    return {
      status: 'error',
      message: 'Запит вже виконується',
      source: 'parallel'
    };
  }

  // Якщо пристрій офлайн, одразу повертаємо помилку
  if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !options.bypassOfflineCheck) {
    console.warn("🔌 Raffles API: Пристрій офлайн, запит не виконано");

    // Повертаємо кешовані дані, якщо такі є
    const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
    if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
      console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} в офлайн режимі`);
      return {
        status: 'success',
        data: _cache[cacheKey].data,
        source: 'cache_offline'
      };
    }

    return {
      status: 'error',
      message: 'Пристрій офлайн',
      source: 'offline'
    };
  }

  // Очищаємо зависаючі запити
  cleanupHangingRequests();

  // Позначаємо запит як активний
  _activeRequests[cleanEndpoint] = Date.now();
  _lastRequestTime = Date.now();

  setTimeout(() => {
  if (_activeRequests[cleanEndpoint]) {
    delete _activeRequests[cleanEndpoint];
    console.log(`Автоматичне очищення запиту: ${cleanEndpoint}`);
  }
}, 10000);

  // Оновлюємо лічильник
  _requestCounter.total++;

  // Якщо забагато запитів за короткий час, можливо є проблема
  if (_requestCounter.total > 50 && (Date.now() - _requestCounter.lastReset < 60000)) {
    console.warn(`🔌 Raffles API: Виявлено більше 50 запитів за хвилину, можливі проблеми`);
    // Якщо забагато помилок, блокуємо запити на 30 секунд
    if (_requestCounter.errors > 20) {
      console.error(`🔌 Raffles API: Забагато помилок (${_requestCounter.errors}), блокуємо запити на 30 секунд`);
      window._blockApiRequests = true;
      setTimeout(() => {
        window._blockApiRequests = false;
        console.log("🔌 Raffles API: Розблоковано запити");
        // Скидаємо лічильники
        _requestCounter = {
          total: 0,
          errors: 0,
          lastReset: Date.now()
        };
      }, 30000);
    }
  }

  // Скидаємо лічильники кожну хвилину
  if (Date.now() - _requestCounter.lastReset > 60000) {
    _requestCounter = {
      total: 1,
      errors: 0,
      lastReset: Date.now()
    };
  }

  // Якщо основний API доступний і опція useMainAPI не false, використовуємо його
  if (hasMainApi() && options.useMainAPI !== false) {
    try {
      // Оновлюємо токен перед важливими запитами
      if (cleanEndpoint.includes('history') || cleanEndpoint.includes('participate')) {
        try {
          await refreshToken();
        } catch (tokenError) {
          console.warn("🔌 Raffles API: Помилка оновлення токену перед запитом:", tokenError);
        }
      }

      const response = await window.WinixAPI.apiRequest(cleanEndpoint, method, data, options);

      // Кешуємо результат, якщо потрібно
      cacheResponse(cleanEndpoint, response);

      // Видаляємо запит з активних
      delete _activeRequests[cleanEndpoint];

      return response;
    } catch (mainApiError) {
      console.warn("🔌 Raffles API: Помилка в основному API, використовуємо резервний:", mainApiError);

      // Збільшуємо лічильник помилок
      _requestCounter.errors++;

      // Отримуємо кешовані дані у випадку помилки
      const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
      if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
        console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} після помилки основного API`);

        // Видаляємо запит з активних
        delete _activeRequests[cleanEndpoint];

        return {
          status: 'success',
          data: _cache[cacheKey].data,
          source: 'cache_after_main_api_error'
        };
      }

      // Якщо кеш не знайдено, продовжуємо з нашою реалізацією
    }
  }

  // Резервна реалізація API запиту
  try {
    // Використовуємо централізоване відображення лоадера
    if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
      WinixRaffles.loader.show(options.loaderMessage || 'Завантаження...', `raffles-api-${cleanEndpoint}`);
    }

    // Формуємо базовий URL API
    const apiBaseUrl = getApiBaseUrl();

    // Додаємо мітку часу для запобігання кешуванню
    const timestamp = Date.now();
    const hasQuery = cleanEndpoint.includes('?');

    // Формуємо URL
    // Перевіряємо, чи endpoint вже містить 'api/'
    let urlEndpoint = cleanEndpoint;
    if (urlEndpoint.startsWith('api/')) {
      urlEndpoint = urlEndpoint.substring(4);
    }

    // Формуємо повний URL
    let apiUrlBase = apiBaseUrl;
    // Видаляємо дублікат /api якщо він є
    if (apiUrlBase.endsWith('/api') && urlEndpoint.startsWith('api/')) {
      urlEndpoint = urlEndpoint.substring(4);
    } else if (apiUrlBase.endsWith('/api') && urlEndpoint.startsWith('/api/')) {
      urlEndpoint = urlEndpoint.substring(5);
    }

    // Переконуємося, що URL не має подвійних слешів
    if (apiUrlBase.endsWith('/') && urlEndpoint.startsWith('/')) {
      urlEndpoint = urlEndpoint.substring(1);
    } else if (!apiUrlBase.endsWith('/') && !urlEndpoint.startsWith('/')) {
      apiUrlBase += '/';
    }

    // Добавляємо /api/ якщо його немає в endpoint
    if (!urlEndpoint.startsWith('api/') && !urlEndpoint.startsWith('/api/')) {
      urlEndpoint = 'api/' + urlEndpoint;
    }

    const url = `${apiUrlBase}${urlEndpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;

    // Отримуємо ID користувача
    const userId = getUserId();

    // Отримуємо токен авторизації
    const authToken = getAuthToken();

    // Готуємо заголовки
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    // Додаємо ID користувача і токен авторизації, якщо вони є
    if (userId) {
      headers['X-Telegram-User-Id'] = userId;
    }

    if (authToken) {
      headers['Authorization'] = authToken.startsWith('Bearer ') ?
        authToken : `Bearer ${authToken}`;
    }

    // Готуємо параметри запиту
    const requestOptions = {
      method: method,
      headers: headers,
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    };

    // Додаємо тіло запиту для POST, PUT, PATCH
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      // Валідація для участі в розіграші
      if (urlEndpoint.includes('participate-raffle') && data) {
        // Перевірка raffleId на валідний UUID
        if (data.raffle_id) {
          // Перевірка формату UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

          if (typeof data.raffle_id !== 'string') {
            data.raffle_id = String(data.raffle_id);
          }

          if (!uuidRegex.test(data.raffle_id)) {
            throw new Error(`Невалідний UUID для розіграшу: ${data.raffle_id}`);
          }
        }
      }
      requestOptions.body = JSON.stringify(data);
    }

    // Створюємо контролер для таймауту
    const controller = new AbortController();
    requestOptions.signal = controller.signal;

    // Встановлюємо таймаут
    const timeout = options.timeout || API_CONFIG.TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Виконуємо запит
      const response = await fetch(url, requestOptions);

      // Очищаємо таймаут
      clearTimeout(timeoutId);

      // Приховуємо індикатор завантаження
      if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
        WinixRaffles.loader.hide(`raffles-api-${cleanEndpoint}`);
      }

      // Обробляємо відповідь
      if (!response.ok) {
        // Спеціальна обробка помилок
        if (response.status === 429) {
          // Занадто багато запитів - повертаємо спеціальну помилку
          console.warn(`🔌 Raffles API: Отримано 429 (Too Many Requests) для ${cleanEndpoint}`);

          // Показуємо повідомлення користувачеві
          if (typeof showToast === 'function') {
            showToast(
              "Занадто багато запитів. Будь ласка, зачекайте хвилину і спробуйте знову.",
              "warning",
              5000
            );
          }

          // Зберігаємо блокування на тривалий період
          const retryAfter = API_CONFIG.RATE_LIMIT_COOLDOWN;
          _lastRequestsByEndpoint[cleanEndpoint] = Date.now() + retryAfter;

          // Повертаємо кешовані дані, якщо є
          const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
          if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
            return {
              status: 'success',
              data: _cache[cacheKey].data,
              source: 'cache_rate_limited'
            };
          }

          // Інакше повертаємо помилку
          return {
            status: 'error',
            code: 429,
            message: 'Забагато запитів. Спробуйте пізніше.',
            retry_after: retryAfter
          };
        }

        if (response.status === 404 && urlEndpoint.includes('raffles')) {
          // Розіграш не знайдено - спеціальне обробка
          console.warn(`🔌 Raffles API: Отримано 404 (Not Found) для розіграшу ${cleanEndpoint}`);

          // Інформативне повідомлення для користувача
          if (typeof showToast === 'function') {
            showToast(
              "Розіграш не знайдено або він уже завершився. Оновіть список розіграшів.",
              "warning"
            );
          }

          // Подія для оновлення списку розіграшів
          if (WinixRaffles && WinixRaffles.events) {
            WinixRaffles.events.emit('refresh-raffles', { force: true });
          }

          throw new Error(`Розіграш не знайдено. ID може бути застарілим.`);
        }

        // Для інших помилок
        throw new Error(`Помилка сервера: ${response.status} ${response.statusText}`);
      }

      // Парсимо відповідь
      const jsonData = await response.json();

      // Кешуємо результат, якщо потрібно
      cacheResponse(cleanEndpoint, jsonData);

      // Видаляємо запит з активних
      delete _activeRequests[cleanEndpoint];

      return jsonData;
    } catch (error) {
      // Перевіряємо, чи запит був скасований через таймаут
      if (error.name === 'AbortError') {
        throw new Error('Час очікування запиту вичерпано');
      }

      throw error;
    }
  } catch (error) {
    console.error(`❌ Raffles API: Помилка запиту ${endpoint}:`, error);

    // Збільшуємо лічильник помилок
    _requestCounter.errors++;

    // Приховуємо індикатор завантаження
    if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
      WinixRaffles.loader.hide(`raffles-api-${cleanEndpoint}`);
    }
    delete _activeRequests[cleanEndpoint];

    // Обробка 401 помилки - спроба оновити токен
    if (error.status === 401 ||
      (error.message && error.message.includes('401')) ||
      (error.message && error.message.includes('Unauthorized'))) {

      console.warn("🔄 Raffles API: Отримано помилку 401, спроба оновити токен");

      // Перевіряємо, що це не повторний запит після вже спробованого оновлення токену
      if (!options.after401) {
        try {
          const refreshed = await refreshToken();

          if (refreshed) {
            console.log("🔄 Raffles API: Токен оновлено, повторюємо запит");

            // Повторюємо запит з новим токеном
            return await apiRequest(endpoint, method, data, {
              ...options,
              after401: true  // Запобігання рекурсії
            });
          } else {
            console.warn("⚠️ Raffles API: Не вдалося оновити токен");
          }
        } catch (refreshError) {
          console.error("❌ Raffles API: Помилка при спробі оновити токен:", refreshError);
        }
      } else {
        console.warn("⚠️ Raffles API: Повторна помилка 401 навіть після оновлення токену");
      }
    }

    // Генеруємо подію про помилку API
    if (WinixRaffles && WinixRaffles.events) {
      WinixRaffles.events.emit('api-error', {
        error: error,
        endpoint: endpoint,
        method: method
      });
    }

    // Отримуємо кешовані дані у випадку помилки
    const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
    if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
      console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} після помилки запиту`);

      // Видаляємо запит з активних
      delete _activeRequests[cleanEndpoint];

      return {
        status: 'success',
        data: _cache[cacheKey].data,
        source: 'cache_after_error'
      };
    }

    // Видаляємо запит з активних
    delete _activeRequests[cleanEndpoint];

    // Повертаємо об'єкт з помилкою
    return {
      status: 'error',
      message: error.message || 'Сталася помилка при виконанні запиту',
      source: 'raffles_api',
      error: error
    };
  }
}

/**
 * Очищення кешу
 * @param {string} [cacheKey] - Ключ кешу для очищення (якщо не вказано, очищується весь кеш)
 */
function clearCache(cacheKey) {
  if (cacheKey && _cache[cacheKey]) {
    _cache[cacheKey].data = null;
    _cache[cacheKey].timestamp = 0;
    console.log(`🔌 Raffles API: Кеш ${cacheKey} очищено`);
  } else {
    for (const key in _cache) {
      _cache[key].data = null;
      _cache[key].timestamp = 0;
    }
    console.log("🔌 Raffles API: Весь кеш очищено");
  }
}

/**
 * Отримання даних користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Проміс з даними користувача
 */
async function getUserData(forceRefresh = false) {
  // Перевірка чи пристрій онлайн
  if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
    console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані користувача");

    // Якщо є кешовані дані, повертаємо їх
    if (_cache.userData && _cache.userData.data) {
      return {
        status: 'success',
        data: _cache.userData.data,
        source: 'cache_offline'
      };
    }

    // Повертаємо базові дані з localStorage
    return {
      status: 'success',
      data: {
        telegram_id: getUserId() || 'unknown',
        balance: parseFloat(localStorage.getItem('userTokens') || '0'),
        coins: parseInt(localStorage.getItem('userCoins') || '0')
      },
      source: 'localStorage_offline'
    };
  }

  // Використовуємо основний API, якщо доступний
  if (hasMainApi()) {
    try {
      // Оновлюємо токен перед запитом
      await refreshToken();

      const result = await window.WinixAPI.getUserData(forceRefresh);

      // Виправлена версія - змінено resultData на result.data
      if (result && result.status === 'success' && result.data) {
        // Оновлюємо localStorage
        if (result.data.balance !== undefined) {
          // Перетворення на число, якщо отримано об'єкт
          const balance = typeof result.data.balance === 'object'
            ? parseFloat(result.data.balance.toString())
            : parseFloat(result.data.balance);

          localStorage.setItem('userTokens', balance.toString());
          localStorage.setItem('winix_balance', balance.toString());
        }

        // Те саме для жетонів
        if (result.data.coins !== undefined) {
          const coins = typeof result.data.coins === 'object'
            ? parseInt(result.data.coins.toString())
            : parseInt(result.data.coins);

          localStorage.setItem('userCoins', coins.toString());
          localStorage.setItem('winix_coins', coins.toString());
        }

        // Оновлюємо елементи інтерфейсу напряму
        setTimeout(() => {
          try {
            // Оновлюємо елементи з ID
            const tokensElement = document.getElementById('user-tokens');
            const coinsElement = document.getElementById('user-coins');

            if (tokensElement && result.data.balance !== undefined) {
              tokensElement.textContent = result.data.balance;
            }

            if (coinsElement && result.data.coins !== undefined) {
              coinsElement.textContent = result.data.coins;
            }
          } catch (uiError) {
            console.error("❌ Raffles API: Помилка оновлення інтерфейсу:", uiError);
          }
        }, 100);

        // Відправляємо подію для інших модулів
        document.dispatchEvent(new CustomEvent('balance-updated', {
          detail: {
            balance: result.data.balance,
            coins: result.data.coins,
            source: 'raffles-api'
          }
        }));
      }

      // Кешуємо результат
      if (result.status === 'success' && result.data) {
        _cache.userData = {
          data: result.data,
          timestamp: Date.now(),
          ttl: _cache.userData?.ttl || API_CONFIG.CACHE_TTL.USER_DATA
        };
      }

      return result;
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання даних користувача з основного API:", e);

      // Якщо є кешовані дані, повертаємо їх
      if (_cache.userData && _cache.userData.data) {
        return {
          status: 'success',
          data: _cache.userData.data,
          source: 'cache_after_error'
        };
      }
    }
  }

  try {
    const userId = getUserId();
    if (!userId) {
      return {
        status: 'error',
        message: 'ID користувача не знайдено'
      };
    }

    // Перевіряємо кеш, якщо не потрібне примусове оновлення
    if (!forceRefresh && _cache.userData && _cache.userData.data &&
      (Date.now() - _cache.userData.timestamp) < _cache.userData.ttl) {
      return {
        status: 'success',
        data: _cache.userData.data,
        source: 'cache'
      };
    }

    return await apiRequest(`user/${userId}`, 'GET', null, {
      useMainAPI: false, // Не використовувати основний API для уникнення рекурсії
      bypassThrottle: forceRefresh, // Ігноруємо обмеження частоти для примусового оновлення
      timeout: 5000 // Коротший таймаут
    });
  } catch (error) {
    console.error("🔌 Raffles API: Помилка отримання даних користувача:", error);

    // Якщо є кешовані дані, повертаємо їх
    if (_cache.userData && _cache.userData.data) {
      return {
        status: 'success',
        data: _cache.userData.data,
        source: 'cache_after_error'
      };
    }

    // Повертаємо базові дані з localStorage
    return {
      status: 'success',
      data: {
        telegram_id: getUserId() || 'unknown',
        balance: parseFloat(localStorage.getItem('userTokens') || '0'),
        coins: parseInt(localStorage.getItem('userCoins') || '0')
      },
      source: 'localStorage_fallback',
      message: 'Помилка отримання даних користувача: ' + error.message
    };
  }
}

/**
 * Отримання балансу користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Баланс користувача
 */
async function getBalance(forceRefresh = false) {
  // Перевірка чи пристрій онлайн
  if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
    console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані балансу");

    // Повертаємо базові дані з localStorage
    return {
      status: 'success',
      data: {
        balance: parseFloat(localStorage.getItem('userTokens') || '0'),
        coins: parseInt(localStorage.getItem('userCoins') || '0')
      },
      source: 'localStorage_offline'
    };
  }

  // Використовуємо основний API, якщо доступний
  if (hasMainApi()) {
    try {
      // Оновлюємо токен перед запитом
      await refreshToken();

      return await window.WinixAPI.getBalance(forceRefresh);
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка отримання балансу з основного API:", e);
    }
  }

  try {
    const userId = getUserId();
    if (!userId) {
      return {
        status: 'error',
        message: 'ID користувача не знайдено'
      };
    }

    return await apiRequest(`user/${userId}/balance`, 'GET', null, {
      useMainAPI: false, // Не використовувати основний API для уникнення рекурсії
      bypassThrottle: forceRefresh,
      timeout: 5000 // Коротший таймаут
    });
  } catch (error) {
    console.error("🔌 Raffles API: Помилка отримання балансу користувача:", error);

    // Повертаємо дані з localStorage при помилці
    return {
      status: 'success',
      data: {
        balance: parseFloat(localStorage.getItem('userTokens') || '0'),
        coins: parseInt(localStorage.getItem('userCoins') || '0')
      },
      source: 'localStorage_fallback',
      message: 'Помилка отримання балансу: ' + error.message
    };
  }
}

/**
 * Отримання активних розіграшів
 * @param {boolean} forceRefresh - Примусове оновлення
 * @returns {Promise<Array>} Список активних розіграшів
 */
async function getActiveRaffles(forceRefresh = false) {
  // Перевірка чи пристрій онлайн
  if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
    console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані розіграшів");

    // Якщо є кешовані дані, повертаємо їх
    if (_cache.activeRaffles && _cache.activeRaffles.data) {
      return _cache.activeRaffles.data;
    }

    // Якщо кешу немає, повертаємо порожній масив
    return [];
  }

  // Перевіряємо кеш, якщо не потрібне примусове оновлення
  if (!forceRefresh && _cache.activeRaffles && _cache.activeRaffles.data &&
    (Date.now() - _cache.activeRaffles.timestamp) < _cache.activeRaffles.ttl) {
    console.log("📋 Raffles API: Використання кешованих даних активних розіграшів");
    return _cache.activeRaffles.data;
  }

  try {
    // Оновлюємо токен перед запитом
    await refreshToken();

    const response = await apiRequest('raffles', 'GET', null, {
      timeout: 10000, // Зменшуємо таймаут для прискорення
      loaderMessage: 'Завантаження розіграшів...',
      bypassThrottle: forceRefresh
    });

    if (response && response.status === 'success') {
      const resultData = Array.isArray(response.data) ? response.data : [];

      // Оновлюємо кеш
      _cache.activeRaffles = {
        data: resultData,
        timestamp: Date.now(),
        ttl: _cache.activeRaffles?.ttl || API_CONFIG.CACHE_TTL.ACTIVE_RAFFLES
      };

      // Зберігаємо в localStorage для офлайн доступу
      try {
        localStorage.setItem('winix_active_raffles', JSON.stringify(resultData));
      } catch (e) {
        console.warn("🔌 Raffles API: Помилка збереження розіграшів в localStorage:", e);
      }

      return resultData;
    }

    // Якщо є помилка, але є кешовані дані, повертаємо їх
    if (_cache.activeRaffles && _cache.activeRaffles.data) {
      console.warn("🔌 Raffles API: Використовуємо кешовані дані розіграшів після помилки");
      return _cache.activeRaffles.data;
    }

    // Інакше повертаємо порожній масив
    return [];
  } catch (error) {
    console.error('Помилка отримання активних розіграшів:', error);

    // Якщо є кешовані дані, повертаємо їх
    if (_cache.activeRaffles && _cache.activeRaffles.data) {
      console.warn("🔌 Raffles API: Використовуємо кешовані дані розіграшів після помилки");
      return _cache.activeRaffles.data;
    }

    // Спробуємо отримати з localStorage
    try {
      const storedRaffles = localStorage.getItem('winix_active_raffles');
      if (storedRaffles) {
        const parsedRaffles = JSON.parse(storedRaffles);
        if (Array.isArray(parsedRaffles)) {
          return parsedRaffles;
        }
      }
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка читання розіграшів з localStorage:", e);
    }

    return [];
  }
}

/**
 * Отримання історії розіграшів
 * @param {Object} filters - Фільтри для запиту
 * @param {boolean} forceRefresh - Примусове оновлення
 * @returns {Promise<Array>} Список історії розіграшів
 */
async function getRafflesHistory(filters = {}, forceRefresh = false) {
  // Перевірка чи пристрій онлайн
  if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
    console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані історії");

    // Якщо є кешовані дані, повертаємо їх
    if (_cache.history && _cache.history.data) {
      return _cache.history.data;
    }

    // Спробуємо отримати з localStorage
    try {
      const storedHistory = localStorage.getItem('winix_raffles_history');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          return parsedHistory;
        }
      }
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка читання історії з localStorage:", e);
    }

    // Якщо кешу немає, повертаємо порожній масив
    return [];
  }

  // Перевіряємо кеш, якщо не потрібне примусове оновлення і немає фільтрів
  if (!forceRefresh && !Object.keys(filters).length && _cache.history && _cache.history.data &&
    (Date.now() - _cache.history.timestamp) < _cache.history.ttl) {
    return _cache.history.data;
  }

  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error('ID користувача не знайдено');
    }

    // Оновлюємо токен перед запитом історії
    console.log("🔄 Raffles API: Оновлюємо токен перед запитом історії");
    await refreshToken();

    // Формуємо параметри запиту
    let queryParams = '';
    if (filters.type && filters.type !== 'all') {
      queryParams += `&type=${filters.type}`;
    }
    if (filters.status && filters.status !== 'all') {
      queryParams += `&status=${filters.status}`;
    }
    if (filters.period && filters.period !== 'all') {
      queryParams += `&period=${filters.period}`;
    }

    // Додаємо параметри до URL, якщо вони є
    const url = queryParams
      ? `user/${userId}/raffles-history?${queryParams.substring(1)}`
      : `user/${userId}/raffles-history`;

    const response = await apiRequest(url, 'GET', null, {
      timeout: 15000, // Збільшуємо таймаут для історії
      loaderMessage: 'Завантаження історії розіграшів...',
      bypassThrottle: forceRefresh,
      after401: false // Дозволяємо обробку 401 помилки
    });

    if (response && response.status === 'success') {
      const resultData = Array.isArray(response.data) ? response.data : [];

      // Оновлюємо кеш тільки якщо немає фільтрів або це примусове оновлення
      if (!Object.keys(filters).length || forceRefresh) {
        _cache.history = {
          data: resultData,
          timestamp: Date.now(),
          ttl: _cache.history?.ttl || API_CONFIG.CACHE_TTL.HISTORY
        };
      }

      // Зберігаємо в localStorage для офлайн доступу
      try {
        localStorage.setItem('winix_raffles_history', JSON.stringify(resultData));
      } catch (e) {
        console.warn("🔌 Raffles API: Помилка збереження історії в localStorage:", e);
      }

      return resultData;
    }

    // Якщо є помилка, але є кешовані дані, повертаємо їх
    if (_cache.history && _cache.history.data) {
      console.warn("🔌 Raffles API: Використовуємо кешовані дані історії після помилки");
      return _cache.history.data;
    }

    return [];
  } catch (error) {
    console.error('Помилка отримання історії розіграшів:', error);

    // Якщо є кешовані дані, повертаємо їх
    if (_cache.history && _cache.history.data) {
      console.warn("🔌 Raffles API: Використовуємо кешовані дані історії після помилки");
      return _cache.history.data;
    }

    // Спробуємо отримати з localStorage
    try {
      const storedHistory = localStorage.getItem('winix_raffles_history');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          return parsedHistory;
        }
      }
    } catch (e) {
      console.warn("🔌 Raffles API: Помилка читання історії з localStorage:", e);
    }

    return [];
  }
}

/**
 * Перевірка валідності UUID
 * @param {string} uuid - UUID для перевірки
 * @returns {boolean} Результат перевірки
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Участь у розіграші
 * @param {string} raffleId - ID розіграшу
 * @param {number} entryCount - Кількість жетонів для участі
 * @returns {Promise<Object>} Результат участі
 */
async function participateInRaffle(raffleId, entryCount = 1) {
  try {
    // Перевірка на валідний UUID
    if (!isValidUUID(raffleId)) {
      console.error(`❌ Raffles API: Невалідний UUID: ${raffleId}`);
      return {
        status: 'error',
        message: 'Недійсний ідентифікатор розіграшу',
        code: 'invalid_uuid'
      };
    }

    // Перевірка чи пристрій онлайн
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
      return {
        status: 'error',
        message: 'Не вдалося взяти участь: пристрій офлайн',
        code: 'offline'
      };
    }

    // Перевірка на коректність entryCount
    if (isNaN(entryCount) || entryCount <= 0) {
      return {
        status: 'error',
        message: 'Кількість жетонів повинна бути більшою за нуль',
        code: 'invalid_entry_count'
      };
    }

    const userId = getUserId();
    if (!userId) {
      throw new Error('ID користувача не знайдено');
    }

    // Перевіряємо наявність жетонів локально перед запитом
    const userCoins = parseInt(localStorage.getItem('userCoins') || '0');
    if (userCoins < entryCount) {
      return {
        status: 'error',
        message: 'Недостатньо жетонів для участі',
        code: 'insufficient_coins'
      };
    }

    // Оновлюємо токен перед запитом
    await refreshToken();

    // Додаємо затримку для запобігання помилок 429
    await new Promise(resolve => setTimeout(resolve, 500));

    // Додаємо унікальний ідентифікатор для запобігання кешуванню
    const timestamp = Date.now();
    const uniqueSuffix = Math.floor(Math.random() * 1000000);

    // Підготовка даних
    const participationData = {
      raffle_id: raffleId,
      entry_count: entryCount,
      timestamp
    };

    // Валідація даних перед відправкою
    if (typeof participationData.raffle_id !== 'string') {
      participationData.raffle_id = String(participationData.raffle_id);
    }

    if (!isValidUUID(participationData.raffle_id)) {
      return {
        status: 'error',
        message: 'Невалідний ідентифікатор розіграшу',
        code: 'invalid_uuid'
      };
    }

    const response = await apiRequest(`user/${userId}/participate-raffle?t=${timestamp}&uid=${uniqueSuffix}`, 'POST',
      participationData,
      {
        timeout: 20000,
        loaderMessage: 'Беремо участь у розіграші...',
        bypassThrottle: true // Важливо: дозволяємо обійти стандартне обмеження частоти
      }
    );

    if (response && response.status === 'success') {
      // Оновлюємо локальний баланс одразу для швидкого відгуку інтерфейсу
      const newCoins = Math.max(0, userCoins - entryCount);
      localStorage.setItem('userCoins', newCoins.toString());
      localStorage.setItem('winix_coins', newCoins.toString());

      // Оновлюємо відображення на сторінці
      const coinsElement = document.getElementById('user-coins');
      if (coinsElement) {
        coinsElement.textContent = newCoins.toString();
      }

      // Відправляємо подію про участь
      if (WinixRaffles && WinixRaffles.events) {
        WinixRaffles.events.emit('raffle-participated', {
          raffleId,
          entryCount,
          timestamp: Date.now()
        });
      }

      // Показуємо повідомлення про успіх
      if (typeof showToast === 'function') {
        showToast('Ви успішно взяли участь у розіграші!', 'success');
      }

      return {
        status: 'success',
        message: 'Ви успішно взяли участь у розіграші',
        data: response.data
      };
    }

    // Якщо є помилка
    if (response && response.status === 'error') {
      // Показуємо повідомлення про помилку
      if (response.message && typeof showToast === 'function') {
        showToast(response.message, 'error');
      }

      return response;
    }

    throw new Error(response.message || 'Помилка участі в розіграші');
  } catch (error) {
    console.error(`Помилка участі в розіграші ${raffleId}:`, error);

    // Показуємо повідомлення про помилку
    if (typeof showToast === 'function') {
      showToast('Помилка участі в розіграші. Спробуйте пізніше.', 'error');
    }

    return {
      status: 'error',
      message: error.message || 'Помилка участі в розіграші',
      code: 'participation_error'
    };
  }
}

/**
 * Отримання бонусу новачка
 * @returns {Promise<Object>} Результат отримання бонусу
 */
async function claimNewbieBonus() {
  try {
    // Перевірка чи пристрій онлайн
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
      return {
        status: 'error',
        message: 'Не вдалося отримати бонус: пристрій офлайн',
        source: 'offline'
      };
    }

    const userId = getUserId();
    if (!userId) {
      throw new Error('ID користувача не знайдено');
    }

    // Оновлюємо токен перед важливим запитом
    await refreshToken();

    const response = await apiRequest(`user/${userId}/claim-newbie-bonus`, 'POST', null, {
      timeout: 10000,
      loaderMessage: 'Отримуємо бонус новачка...'
    });

    if (response && (response.status === 'success' || response.status === 'already_claimed')) {
      // Оновлюємо баланс користувача
      if (hasMainApi()) {
        try {
          await window.WinixAPI.getBalance(true);
        } catch (e) {
          console.warn("🔌 Raffles API: Помилка оновлення балансу після отримання бонусу:", e);
        }
      } else {
        // Або оновлюємо баланс через власний API
        await getBalance(true);
      }

      // Зберігаємо статус отримання бонусу
      try {
        localStorage.setItem('newbie_bonus_claimed', 'true');
      } catch (e) {
        console.warn("🔌 Raffles API: Помилка збереження статусу бонусу:", e);
      }

      // Оновлюємо дані користувача
      clearCache('userData');

      // Показуємо повідомлення про успіх
      if (typeof showToast === 'function') {
        if (response.status === 'success') {
          showToast('Ви успішно отримали бонус новачка!', 'success');
        } else {
          showToast('Ви вже отримали бонус новачка', 'info');
        }
      }

      // Відправляємо подію про отримання бонусу
      if (WinixRaffles && WinixRaffles.events) {
        WinixRaffles.events.emit('display-bonus-claimed', {
          timestamp: Date.now()
        });
      }

      return {
        status: response.status,
        message: response.message || 'Бонус новачка успішно отримано',
        data: response.data
      };
    }

    throw new Error(response.message || 'Помилка отримання бонусу новачка');
  } catch (error) {
    console.error('Помилка отримання бонусу новачка:', error);

    // Показуємо повідомлення про помилку
    if (typeof showToast === 'function') {
      showToast('Помилка отримання бонусу. Спробуйте пізніше.', 'error');
    }

    return {
      status: 'error',
      message: error.message || 'Помилка отримання бонусу новачка'
    };
  }
}

// Оновлення API сервісу для кращої інтеграції з системою
const apiService = {
  // Всі методи з файлу доступні через об'єкт
  getUserId,
  getAuthToken,
  getApiBaseUrl,
  refreshToken,
  clearCache,
  forceCleanupRequests,
  apiRequest,
  getUserData,
  getBalance,
  getActiveRaffles,
  getRafflesHistory,
  participateInRaffle,
  claimNewbieBonus,
  isValidUUID,

  // Додаткові методи для інтеграції з глобальною системою
  /**
   * Оновлений метод ініціалізації для інтеграції з глобальною системою
   */
  init: async function() {
    // Налаштування базового URL API на основі конфігурації
    const baseUrl = WinixRaffles.config?.apiBaseUrl || getApiBaseUrl();

    // Налаштування таймаутів на основі конфігурації
    if (WinixRaffles.config?.requestTimeout) {
      API_CONFIG.TIMEOUT = WinixRaffles.config.requestTimeout;
    }

    // Налаштування TTL кешу
    if (WinixRaffles.config?.defaultTTL) {
      API_CONFIG.CACHE_TTL.USER_DATA = WinixRaffles.config.defaultTTL;
    }

    // Встановлюємо слухачі подій для мережевих змін
    this._setupEventListeners();

    // Перевіряємо стан мережі
    const isOnline = typeof navigator.onLine !== 'undefined' ? navigator.onLine : true;

    // Виконуємо перевірку автентифікації
    await this._ensureAuthentication();

    WinixRaffles.logger.log("API сервіс успішно ініціалізовано");
    return this;
  },

  /**
   * Встановлення слухачів подій
   * @private
   */
  _setupEventListeners: function() {
    // Відстежуємо зміни стану мережі
    window.addEventListener('online', () => {
      console.log("🔌 Raffles API: З'єднання з мережею відновлено");

      // Скидаємо прапорці блокування
      window._blockApiRequests = false;

      // Скидаємо лічильники
      _requestCounter = {
        total: 0,
        errors: 0,
        lastReset: Date.now()
      };

      // Автоматично оновлюємо кеш при відновленні з'єднання
      setTimeout(() => {
        this.getActiveRaffles(true).then(() => {
          console.log("🔌 Raffles API: Кеш розіграшів оновлено після відновлення з'єднання");
        }).catch(e => {
          console.warn("🔌 Raffles API: Помилка оновлення кешу розіграшів:", e);
        });
      }, 2000);

      // Відправляємо подію в систему
      if (WinixRaffles && WinixRaffles.events) {
        WinixRaffles.events.emit('network-status-changed', {
          online: true,
          timestamp: Date.now()
        });
      }
    });

    window.addEventListener('offline', () => {
      console.warn("🔌 Raffles API: З'єднання з мережею втрачено");

      // Скидаємо активні запити
      for (const endpoint in _activeRequests) {
        delete _activeRequests[endpoint];
      }

      // Відправляємо подію в систему
      if (WinixRaffles && WinixRaffles.events) {
        WinixRaffles.events.emit('network-status-changed', {
          online: false,
          timestamp: Date.now()
        });
      }
    });

    // Додаємо обробник глобальних помилок для запобігання зациклювання
    window.addEventListener('error', function(event) {
      if (event.message && (
        event.message.includes('API') ||
        event.message.includes('запит') ||
        event.message.includes('request'))) {

        console.error("🛑 Глобальна помилка API:", event.message);

        // Тимчасово блокуємо нові запити
        window._blockApiRequests = true;
        _requestCounter.errors++;

        // Розблоковуємо через 10 секунд
        setTimeout(() => {
          window._blockApiRequests = false;
          console.log("🔌 Raffles API: Розблоковано запити після глобальної помилки");
        }, 10000);
      }
    });

    // Обробник необроблених Promise-помилок
    window.addEventListener('unhandledrejection', function(event) {
      if (event.reason && (
        event.reason.message && (
          event.reason.message.includes('API') ||
          event.reason.message.includes('запит') ||
          event.reason.message.includes('request')))) {

        console.error("🛑 Необроблена Promise-помилка API:", event.reason.message);

        // Тимчасово блокуємо нові запити
        window._blockApiRequests = true;
        _requestCounter.errors++;

        // Розблоковуємо через 10 секунд
        setTimeout(() => {
          window._blockApiRequests = false;
          console.log("🔌 Raffles API: Розблоковано запити після необробленої Promise-помилки");
        }, 10000);
      }
    });
  },

  /**
   * Перевірка та забезпечення автентифікації
   * @private
   */
  async _ensureAuthentication() {
    try {
      // Перевіряємо наявність токену
      const token = getAuthToken();
      if (!token) {
        // Спробуємо оновити токен
        await refreshToken();
      }
      return true;
    } catch (error) {
      WinixRaffles.logger.warn("Помилка перевірки автентифікації:", error);
      return false;
    }
  },

  /**
   * Метод для оновлення даних користувача
   * @param {boolean} [forceRefresh=false] Примусове оновлення
   * @returns {Promise<Object>} Дані користувача
   */
  async refresh(forceRefresh = false) {
    try {
      // Оновлюємо токен перед запитом
      await refreshToken();

      // Оновлюємо дані користувача
      return await getUserData(forceRefresh);
    } catch (error) {
      WinixRaffles.logger.error("Помилка оновлення даних користувача:", error);
      throw error;
    }
  },

  /**
   * Знищення сервісу
   */
  destroy: function() {
    // Очищаємо всі активні запити
    forceCleanupRequests();

    // Очищаємо кеш
    clearCache();

    // Видаляємо слухачі подій
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});

    WinixRaffles.logger.log("API сервіс знищено");
  },

  // Конфігурація сервісу
  config: {
    baseUrl: getApiBaseUrl(),
    throttle: REQUEST_THROTTLE,
    cacheTTL: API_CONFIG.CACHE_TTL,
    version: '1.3.0'
  }
};

// Реєструємо API в глобальному об'єкті
WinixRaffles.api = apiService;

// Обробник глобальних помилок для запобігання зациклювання
window.addEventListener('error', function(event) {
  if (event.message && (
    event.message.includes('API') ||
    event.message.includes('запит') ||
    event.message.includes('request'))) {

    console.error("🛑 Глобальна помилка API:", event.message);

    // Тимчасово блокуємо нові запити
    window._blockApiRequests = true;
    _requestCounter.errors++;

    // Розблоковуємо через 10 секунд
    setTimeout(() => {
      window._blockApiRequests = false;
      console.log("🔌 Raffles API: Розблоковано запити після глобальної помилки");
    }, 10000);
  }
});

// Експортуємо API як основний експорт
export default apiService;