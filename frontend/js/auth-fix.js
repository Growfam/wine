// Файл: frontend/js/auth-fix.js

/**
 * Виправлення проблем автентифікації користувача
 * Забезпечує отримання ID користувача та створення тестового ID при необхідності
 */
(function() {
  'use strict';

  console.log('🔐 AUTH-FIX: Початок виправлення проблем автентифікації');

  // Тестовий ID для режиму розробки (з .env файлу - ADMIN_IDS)
  const TEST_USER_ID = '685982514';

  // Перевіряємо, чи знаходимося в режимі розробки
  const isDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('testenv') ||
    window.location.hostname.includes('staging');

  // Функція перевірки валідності ID
  function isValidId(id) {
    return (
      id &&
      id !== 'undefined' &&
      id !== 'null' &&
      id !== undefined &&
      id !== null &&
      typeof id !== 'function' &&
      id.toString().trim() !== '' &&
      !id.toString().includes('function') &&
      !id.toString().includes('=>')
    );
  }

  // Функція для генерації стійкого ID сесії
  function generateSessionId() {
    let sessionId = localStorage.getItem('winix_session_id');
    if (!sessionId) {
      // Генеруємо псевдо-випадковий ID, який буде стійким для даного браузера/пристрою
      const randomPart = Math.floor(Math.random() * 1000000000).toString();
      const datePart = Date.now().toString();
      const browserInfo = (navigator.userAgent || '').substring(0, 10);

      sessionId = `winix_${datePart.substring(datePart.length - 6)}_${randomPart}_${browserInfo.replace(/[^a-z0-9]/gi, '')}`;
      localStorage.setItem('winix_session_id', sessionId);
    }
    return sessionId;
  }

  // Функція для отримання ID користувача з усіх можливих джерел
  function getUserIdFromAllSources() {
    try {
      // 1. Спочатку перевіряємо Telegram WebApp (найбільш правильне джерело)
      if (window.Telegram && window.Telegram.WebApp) {
        try {
          // Логуємо детальну інформацію для діагностики
          console.log('🔐 AUTH-FIX: Перевірка Telegram WebApp:');
          console.log('- window.Telegram.WebApp.initData:', window.Telegram.WebApp.initData);

          // Перевіряємо наявність initDataUnsafe і користувача
          if (window.Telegram.WebApp.initDataUnsafe) {
            console.log('- initDataUnsafe:', window.Telegram.WebApp.initDataUnsafe);

            if (window.Telegram.WebApp.initDataUnsafe.user) {
              console.log('- user:', window.Telegram.WebApp.initDataUnsafe.user);

              if (window.Telegram.WebApp.initDataUnsafe.user.id) {
                // Конвертуємо ID до рядка і перевіряємо
                const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                if (isValidId(tgUserId)) {
                  // Зберігаємо в localStorage та повертаємо
                  try {
                    localStorage.setItem('telegram_user_id', tgUserId);
                    console.log('✅ AUTH-FIX: Отримано та збережено ID користувача з Telegram:', tgUserId);
                  } catch (storageError) {
                    console.warn('⚠️ AUTH-FIX: Помилка збереження в localStorage:', storageError);
                  }

                  return tgUserId;
                }
              }
            }
          }

          console.warn('⚠️ AUTH-FIX: Не вдалося отримати ID з Telegram WebApp, дані неповні');

          // Додаткова спроба з WebApp.initData (якщо він у вигляді рядка)
          if (typeof window.Telegram.WebApp.initData === 'string' && window.Telegram.WebApp.initData.length > 10) {
            try {
              // Парсимо рядок initData, що має формат URL-закодованих параметрів
              const params = new URLSearchParams(window.Telegram.WebApp.initData);
              const userParam = params.get('user');

              if (userParam) {
                const userData = JSON.parse(userParam);
                if (userData && userData.id) {
                  const tgUserId = userData.id.toString();

                  if (isValidId(tgUserId)) {
                    localStorage.setItem('telegram_user_id', tgUserId);
                    console.log('✅ AUTH-FIX: Отримано ID з Telegram initData параметрів:', tgUserId);
                    return tgUserId;
                  }
                }
              }
            } catch (parseError) {
              console.warn('⚠️ AUTH-FIX: Помилка парсингу initData:', parseError);
            }
          }
        } catch (tgError) {
          console.warn('⚠️ AUTH-FIX: Помилка взаємодії з Telegram WebApp:', tgError);
        }
      } else {
        console.warn('⚠️ AUTH-FIX: Telegram WebApp відсутній або не ініціалізований');
      }

      // 2. Перевіряємо localStorage
      try {
        const localId = localStorage.getItem('telegram_user_id');
        if (isValidId(localId)) {
          console.log('✅ AUTH-FIX: Використовуємо ID з localStorage:', localId);
          return localId;
        }
      } catch (storageError) {
        console.warn('⚠️ AUTH-FIX: Помилка читання з localStorage:', storageError);
      }

      // 3. Перевіряємо DOM елемент
      try {
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userIdElement.textContent) {
          const domId = userIdElement.textContent.trim();
          if (isValidId(domId)) {
            try {
              localStorage.setItem('telegram_user_id', domId);
            } catch (e) {}

            console.log('✅ AUTH-FIX: Використовуємо ID з DOM елемента:', domId);
            return domId;
          }
        }
      } catch (domError) {
        console.warn('⚠️ AUTH-FIX: Помилка отримання ID з DOM:', domError);
      }

      // 4. Перевіряємо URL параметри
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') ||
                     urlParams.get('user_id') ||
                     urlParams.get('telegram_id');

        if (isValidId(urlId)) {
          try {
            localStorage.setItem('telegram_user_id', urlId);
          } catch (e) {}

          console.log('✅ AUTH-FIX: Використовуємо ID з URL параметрів:', urlId);
          return urlId;
        }
      } catch (urlError) {
        console.warn('⚠️ AUTH-FIX: Помилка отримання ID з URL:', urlError);
      }

      // 5. Якщо в режимі розробки, використовуємо тестовий ID
      if (isDevelopment) {
        try {
          localStorage.setItem('telegram_user_id', TEST_USER_ID);
          localStorage.setItem('is_test_user', 'true');

          console.log('⚠️ AUTH-FIX: Використовуємо тестовий ID для розробки:', TEST_USER_ID);
          return TEST_USER_ID;
        } catch (e) {}
      }

      // 6. Створюємо ідентифікатор сесії як останній засіб
      if (isDevelopment) {
        const sessionId = generateSessionId();
        console.log('⚠️ AUTH-FIX: Створено ідентифікатор сесії для режиму розробки:', sessionId);
        localStorage.setItem('is_test_user', 'true');
        localStorage.setItem('is_session_id', 'true');
        return TEST_USER_ID; // Все одно повертаємо тестовий ID для безпеки
      }

      console.error('❌ AUTH-FIX: Не вдалося отримати ID користувача з жодного джерела');
      return null;
    } catch (generalError) {
      console.error('❌ AUTH-FIX: Критична помилка при отриманні ID:', generalError);
      return null;
    }
  }

  // Функція ініціалізації Telegram WebApp
  function initializeTelegramWebApp() {
    console.log('🔄 AUTH-FIX: Спроба ініціалізації Telegram WebApp');

    try {
      if (window.Telegram && window.Telegram.WebApp) {
        console.log('✅ AUTH-FIX: Telegram WebApp вже доступний, викликаємо WebApp.ready()');
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();

        // Диспетчеризуємо кастомну подію
        const event = new CustomEvent('telegram-ready', {
          detail: {
            timestamp: Date.now(),
            source: 'auth-fix.js'
          }
        });

        document.dispatchEvent(event);
        console.log('✅ AUTH-FIX: Подію telegram-ready відправлено');
      } else {
        console.warn('⚠️ AUTH-FIX: Об\'єкт Telegram.WebApp не знайдено');

        // Створюємо стаб для режиму розробки
        if (isDevelopment) {
          console.log('🔧 AUTH-FIX: Створення стабу Telegram.WebApp для розробки');

          window.Telegram = window.Telegram || {};
          window.Telegram.WebApp = {
            ready: function() { console.log('📝 Mock Telegram.WebApp.ready() викликано'); },
            expand: function() { console.log('📝 Mock Telegram.WebApp.expand() викликано'); },
            initData: '',
            initDataUnsafe: {
              user: {
                id: TEST_USER_ID,
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser',
                language_code: 'uk'
              }
            }
          };

          // Диспетчеризація події
          const event = new CustomEvent('telegram-ready', {
            detail: {
              timestamp: Date.now(),
              source: 'auth-fix.js',
              isMock: true
            }
          });

          document.dispatchEvent(event);
          console.log('✅ AUTH-FIX: Створено стаб Telegram.WebApp і відправлено подію telegram-ready');
        }
      }
    } catch (error) {
      console.error('❌ AUTH-FIX: Помилка ініціалізації Telegram WebApp:', error);
    }
  }

  // Патч для функції getUserId, який буде використовуватися в API.js та auth.js
  function patchGetUserIdFunction() {
    try {
      // Створюємо функцію, яка буде використовуватися як патч
      window.getUserId = function() {
        return getUserIdFromAllSources();
      };

      // Патч для WinixAPI
      if (window.WinixAPI) {
        console.log('🔧 AUTH-FIX: Патч функції WinixAPI.getUserId');

        // Зберігаємо оригінальну функцію
        const originalGetUserId = window.WinixAPI.getUserId;

        // Заміняємо її на нашу
        window.WinixAPI.getUserId = function() {
          // Спочатку спробуємо оригінальну функцію
          const originalId = originalGetUserId();
          if (isValidId(originalId)) return originalId;

          // Якщо не спрацювало, використовуємо нашу функцію
          return getUserIdFromAllSources();
        };
      }

      console.log('✅ AUTH-FIX: Функцію getUserId успішно відкориговано');
    } catch (error) {
      console.error('❌ AUTH-FIX: Помилка при патчі getUserId:', error);
    }
  }

  // Функція отримання токену авторизації
  function getAuthTokenFromAllSources() {
    try {
      // Спочатку спробуємо localStorage
      const token = localStorage.getItem('auth_token');
      if (token && typeof token === 'string' && token.length > 10) {
        return token;
      }

      // Якщо режим розробки, створюємо тестовий токен
      if (isDevelopment) {
        const testToken = 'TEST_AUTH_TOKEN_FOR_DEVELOPMENT_' + Date.now();
        localStorage.setItem('auth_token', testToken);
        localStorage.setItem('auth_token_expiry', (Date.now() + 24*60*60*1000).toString());

        console.log('⚠️ AUTH-FIX: Створено тестовий токен для розробки');
        return testToken;
      }

      return null;
    } catch (error) {
      console.error('❌ AUTH-FIX: Помилка отримання токену авторизації:', error);
      return null;
    }
  }

  // Оновлюємо токен авторизації
  async function refreshAuthToken() {
    try {
      console.log('🔄 AUTH-FIX: Початок оновлення токену');

      const userId = getUserIdFromAllSources();
      if (!userId) {
        throw new Error('Не вдалося отримати ID користувача');
      }

      // У режимі розробки просто оновлюємо тестовий токен
      if (isDevelopment && localStorage.getItem('is_test_user') === 'true') {
        const testToken = 'TEST_AUTH_TOKEN_REFRESHED_' + Date.now();
        localStorage.setItem('auth_token', testToken);
        localStorage.setItem('auth_token_expiry', (Date.now() + 24*60*60*1000).toString());

        console.log('⚠️ AUTH-FIX: Оновлено тестовий токен для розробки');

        // Диспетчеризуємо подію
        document.dispatchEvent(
          new CustomEvent('token-refreshed', {
            detail: {
              token: testToken,
              expires_at: Date.now() + 24*60*60*1000,
              is_test: true
            },
          })
        );

        return testToken;
      }

      // Для продакшена використовуємо справжній запит на оновлення
      const currentToken = getAuthTokenFromAllSources();

      console.log('🔄 AUTH-FIX: Спроба оновлення токену для користувача', userId);

      // Використовуємо API для оновлення токену
      let apiResponse;
      try {
        // Спробуємо використати WinixAPI якщо він є
        if (window.WinixAPI && window.WinixAPI.apiRequest) {
          console.log('🔄 AUTH-FIX: Використовуємо WinixAPI для оновлення токену');
          apiResponse = await window.WinixAPI.apiRequest('auth/refresh-token', 'POST', {
            telegram_id: userId,
            token: currentToken || ''
          });
        } else {
          // Інакше робимо запит напряму
          console.log('🔄 AUTH-FIX: Використовуємо прямий fetch для оновлення токену');

          const baseUrl = window.location.origin;
          const response = await fetch(`${baseUrl}/api/auth/refresh-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-User-Id': userId
            },
            body: JSON.stringify({
              telegram_id: userId,
              token: currentToken || ''
            })
          });

          apiResponse = await response.json();
        }

        if (apiResponse && apiResponse.status === 'success' && apiResponse.token) {
          // Зберігаємо новий токен
          localStorage.setItem('auth_token', apiResponse.token);

          // Визначаємо час закінчення
          if (apiResponse.expires_at) {
            const expiryTime = new Date(apiResponse.expires_at).getTime();
            localStorage.setItem('auth_token_expiry', expiryTime.toString());
          } else {
            // За замовчуванням 24 години
            localStorage.setItem('auth_token_expiry', (Date.now() + 24*60*60*1000).toString());
          }

          console.log('✅ AUTH-FIX: Токен успішно оновлено');

          // Диспетчеризуємо подію
          document.dispatchEvent(
            new CustomEvent('token-refreshed', {
              detail: {
                token: apiResponse.token,
                expires_at: apiResponse.expires_at
              },
            })
          );

          return apiResponse.token;
        } else {
          throw new Error('Відповідь сервера не містить токену');
        }
      } catch (apiError) {
        console.error('❌ AUTH-FIX: Помилка API запиту:', apiError);
        throw apiError;
      }
    } catch (error) {
      console.error('❌ AUTH-FIX: Помилка оновлення токену:', error);

      // Диспетчеризуємо подію про помилку
      document.dispatchEvent(
        new CustomEvent('auth-error', {
          detail: {
            error,
            action: 'refresh-token'
          },
        })
      );

      return null;
    }
  }

  // Патч для функції отримання токену
  function patchAuthTokenFunctions() {
    try {
      // Створюємо функцію, яка буде використовуватися як патч
      window.getAuthToken = function() {
        return getAuthTokenFromAllSources();
      };

      window.refreshToken = function() {
        return refreshAuthToken();
      };

      // Патч для WinixAPI
      if (window.WinixAPI) {
        console.log('🔧 AUTH-FIX: Патч функцій WinixAPI для роботи з токенами');

        // Зберігаємо оригінальні функції
        const originalGetAuthToken = window.WinixAPI.getAuthToken;
        const originalRefreshToken = window.WinixAPI.refreshToken;

        // Патчимо getAuthToken
        window.WinixAPI.getAuthToken = function() {
          // Спочатку спробуємо оригінальну функцію
          const originalToken = originalGetAuthToken();
          if (originalToken && typeof originalToken === 'string' && originalToken.length > 10) {
            return originalToken;
          }

          // Якщо не спрацювало, використовуємо нашу функцію
          return getAuthTokenFromAllSources();
        };

        // Патчимо refreshToken
        window.WinixAPI.refreshToken = async function() {
          try {
            // Спочатку спробуємо оригінальну функцію
            const originalResult = await originalRefreshToken();
            if (originalResult && typeof originalResult === 'string' && originalResult.length > 10) {
              return originalResult;
            }
          } catch (originalError) {
            console.warn('⚠️ AUTH-FIX: Помилка в оригінальному refreshToken:', originalError);
          }

          // Якщо не спрацювало, використовуємо нашу функцію
          return refreshAuthToken();
        };
      }

      console.log('✅ AUTH-FIX: Функції роботи з токенами успішно відкориговано');
    } catch (error) {
      console.error('❌ AUTH-FIX: Помилка при патчі функцій токенів:', error);
    }
  }

  // Функція, що показує вікно помилки автентифікації
  function showAuthErrorModal(message) {
    try {
      // Перевіряємо, чи існує модальне вікно
      let modal = document.getElementById('auth-error-modal');

      // Якщо модального вікна немає, створюємо його
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-error-modal';
        modal.className = 'auth-error-modal';
        modal.innerHTML = `
          <div class="auth-error-content">
            <div class="auth-error-header">
              <h3>Помилка автентифікації</h3>
              <span class="auth-error-close">&times;</span>
            </div>
            <div class="auth-error-body">
              <p id="auth-error-message"></p>
            </div>
            <div class="auth-error-footer">
              <button id="auth-retry-button">Спробувати знову</button>
            </div>
          </div>
        `;

        // Додаємо стилі
        const style = document.createElement('style');
        style.textContent = `
          .auth-error-modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            align-items: center;
            justify-content: center;
          }
          .auth-error-content {
            background-color: #fff;
            margin: auto;
            padding: 20px;
            border-radius: 8px;
            max-width: 80%;
            width: 400px;
          }
          .auth-error-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .auth-error-header h3 {
            margin: 0;
            color: #e74c3c;
          }
          .auth-error-close {
            font-size: 24px;
            cursor: pointer;
          }
          .auth-error-body {
            padding: 20px 0;
          }
          .auth-error-footer {
            text-align: center;
          }
          #auth-retry-button {
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          #auth-retry-button:hover {
            background-color: #2980b9;
          }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // Додаємо обробники подій
        document.querySelector('.auth-error-close').addEventListener('click', function() {
          modal.style.display = 'none';
        });

        document.getElementById('auth-retry-button').addEventListener('click', function() {
          modal.style.display = 'none';
          window.location.reload();
        });
      }

      // Встановлюємо повідомлення і показуємо модальне вікно
      document.getElementById('auth-error-message').textContent = message ||
        'Виникла помилка при автентифікації. Спробуйте оновити сторінку або перезапустити додаток.';

      modal.style.display = 'flex';
    } catch (error) {
      console.error('❌ AUTH-FIX: Помилка при показі вікна помилки:', error);
      // Запасний варіант - стандартний alert
      alert(message || 'Помилка автентифікації. Спробуйте оновити сторінку.');
    }
  }

  // Ініціалізація виправлень
  function init() {
    try {
      // 1. Ініціалізуємо Telegram WebApp якщо він доступний
      initializeTelegramWebApp();

      // 2. Патчимо функцію getUserId
      patchGetUserIdFunction();

      // 3. Патчимо функції роботи з токенами
      patchAuthTokenFunctions();

      // 4. Додаємо обробник помилок автентифікації
      document.addEventListener('auth-error', function(event) {
        console.error('❌ AUTH-FIX: Отримано подію помилки автентифікації', event.detail);

        // Показуємо модальне вікно з помилкою, якщо це серйозна помилка
        if (event.detail && event.detail.error &&
            (event.detail.error.message &&
             (event.detail.error.message.includes('автентифікації') ||
              event.detail.error.message.includes('авторизації') ||
              event.detail.error.message.includes('токен')))) {

          showAuthErrorModal(event.detail.error.message);
        }
      });

      // 5. Отримуємо ID користувача для перевірки
      const userId = getUserIdFromAllSources();

      // 6. Оновлюємо елемент на сторінці, якщо він є
      if (userId) {
        const userIdElement = document.getElementById('user-id');
        if (userIdElement) {
          userIdElement.textContent = userId;
        } else {
          // Якщо елемента немає, створюємо прихований елемент
          const hiddenElement = document.createElement('div');
          hiddenElement.id = 'user-id';
          hiddenElement.style.display = 'none';
          hiddenElement.textContent = userId;
          document.body.appendChild(hiddenElement);
        }
      }

      console.log('✅ AUTH-FIX: Ініціалізацію завершено успішно!');

      // Повертаємо результат ініціалізації
      return {
        userId,
        telegramAvailable: !!(window.Telegram && window.Telegram.WebApp),
        isDevelopment,
        functions: {
          getUserId: window.getUserId,
          getAuthToken: window.getAuthToken,
          refreshToken: window.refreshToken
        }
      };
    } catch (error) {
      console.error('❌ AUTH-FIX: Критична помилка при ініціалізації:', error);
      return { error };
    }
  }

  // Запускаємо виправлення
  window.AUTH_FIX = init();

  // Якщо документ вже завантажено, викликаємо повторну ініціалізацію
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('🔄 AUTH-FIX: Документ уже завантажено, оновлюємо елементи DOM');

    // Оновлюємо елемент ID на сторінці
    const userId = getUserIdFromAllSources();
    const userIdElement = document.getElementById('user-id');
    if (userIdElement && userId) {
      userIdElement.textContent = userId;
    }
  }

  // Додаємо обробник завантаження DOM
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 AUTH-FIX: Подію DOMContentLoaded отримано');

    // Оновлюємо елемент ID на сторінці
    const userId = getUserIdFromAllSources();
    const userIdElement = document.getElementById('user-id');
    if (userIdElement && userId) {
      userIdElement.textContent = userId;
    }

    // Відправляємо подію про готовність системи авторизації
    document.dispatchEvent(
      new CustomEvent('auth-system-ready', {
        detail: {
          timestamp: Date.now(),
          userId
        }
      })
    );
  });
})();