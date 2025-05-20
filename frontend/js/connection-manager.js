/**
 * connection-manager.js - Модуль управління мережевим підключенням
 * Забезпечує моніторинг та відновлення з'єднання, обробку стану офлайн
 * @version 1.0.0
 */

(function() {
  'use strict';

  // Приватні змінні
  const _state = {
    // Стан з'єднання
    isOnline: typeof navigator.onLine !== 'undefined' ? navigator.onLine : true,
    networkType: 'unknown',
    effectiveType: 'unknown',

    // Статистика
    lastOnlineTime: Date.now(),
    lastOfflineTime: 0,
    connectionDrops: 0,
    pingStats: {
      attempts: 0,
      success: 0,
      failed: 0,
      totalLatency: 0,
      average: 0
    },

    // Налаштування
    pingInterval: 30000, // 30 секунд
    pingTimeout: 5000,   // 5 секунд
    pingEndpoint: '/api/ping',
    pingTimer: null,

    // Обробники подій
    eventHandlers: {
      'connection-change': [],
      'connection-restored': [],
      'connection-lost': []
    }
  };

  /**
   * Логування з часовою міткою та форматуванням
   */
  function log(message, level = 'log') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const prefix = `[${timestamp}] [ConnectionManager]`;

    switch (level) {
      case 'error':
        console.error(`❌ ${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`⚠️ ${prefix} ${message}`);
        break;
      case 'success':
        console.log(`✅ ${prefix} ${message}`);
        break;
      default:
        console.log(`🔄 ${prefix} ${message}`);
    }
  }

  /**
   * Перевіряє стан з'єднання з сервером
   * @returns {Promise<boolean>} Результат перевірки
   */
  async function checkServerConnection() {
    try {
      // Якщо navigator.onLine говорить, що ми офлайн, то точно офлайн
      if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
        updateConnectionState(false);
        return false;
      }

      // Формуємо URL для перевірки
      let pingUrl;

      // Спочатку спробуємо отримати URL з конфігурації модулів
      if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
        pingUrl = `${window.WinixAPI.config.baseUrl}/api/ping`;
      } else if (window.WinixCore && window.WinixCore.config && window.WinixCore.config.apiBaseUrl) {
        pingUrl = `${window.WinixCore.config.apiBaseUrl}/api/ping`;
      } else {
        pingUrl = `${window.location.origin}${_state.pingEndpoint}`;
      }

      // Додаємо випадковий параметр, щоб уникнути кешування
      pingUrl = `${pingUrl}?t=${Date.now()}`;

      // Збільшуємо лічильник спроб пінгу
      _state.pingStats.attempts++;

      // Виконуємо запит з таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), _state.pingTimeout);

      const startTime = Date.now();

      try {
        // Виконуємо запит для перевірки з'єднання
        const response = await fetch(pingUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          signal: controller.signal
        });

        // Очищаємо таймаут
        clearTimeout(timeoutId);

        // Рахуємо латентність
        const latency = Date.now() - startTime;

        // Оновлюємо статистику пінгу
        _state.pingStats.success++;
        _state.pingStats.totalLatency += latency;
        _state.pingStats.average = _state.pingStats.totalLatency / _state.pingStats.success;

        log(`Пінг успішний, латентність: ${latency}ms, середня: ${Math.round(_state.pingStats.average)}ms`, 'success');

        // Якщо сервер відповідає успішно, оновлюємо стан з'єднання
        if (response.ok) {
          updateConnectionState(true);
          return true;
        }

        // Якщо відповідь 4xx, сервер доступний, але з помилкою
        if (response.status >= 400 && response.status < 500) {
          log(`Пінг повернув статус ${response.status}, але сервер доступний`, 'warn');
          updateConnectionState(true);
          return true;
        }

        // Якщо відповідь 5xx, сервер має проблеми
        if (response.status >= 500) {
          log(`Пінг повернув статус ${response.status}, сервер має проблеми`, 'error');
          _state.pingStats.failed++;
          updateConnectionState(false);
          return false;
        }
      } catch (error) {
        // Очищаємо таймаут, якщо він ще активний
        clearTimeout(timeoutId);

        // Оновлюємо статистику пінгу
        _state.pingStats.failed++;

        log(`Помилка пінгу: ${error.message}`, 'error');

        // Якщо це помилка таймауту чи мережі, вважаємо, що з'єднання втрачено
        updateConnectionState(false);
        return false;
      }

      // Якщо дійшли сюди, значить щось пішло не так, але з'єднання може бути активним
      return _state.isOnline;
    } catch (error) {
      log(`Критична помилка перевірки з'єднання: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Оновлює стан з'єднання та викликає відповідні події
   * @param {boolean} isOnline - Новий стан з'єднання
   */
  function updateConnectionState(isOnline) {
    const wasOnline = _state.isOnline;

    // Оновлюємо стан
    _state.isOnline = isOnline;

    // Якщо стан змінився, викликаємо подію
    if (wasOnline !== isOnline) {
      if (isOnline) {
        // З'єднання відновлено
        _state.lastOnlineTime = Date.now();
        log(`З'єднання відновлено після ${Math.round((_state.lastOnlineTime - _state.lastOfflineTime) / 1000)}с відсутності`, 'success');

        // Викликаємо подію
        fireEvent('connection-restored', {
          downtime: _state.lastOnlineTime - _state.lastOfflineTime
        });

        // Оновлюємо UI
        updateUI(true);

        // Синхронізуємо дані після відновлення з'єднання
        synchronizeData();
      } else {
        // З'єднання втрачено
        _state.connectionDrops++;
        _state.lastOfflineTime = Date.now();
        log(`З'єднання втрачено (випадок #${_state.connectionDrops})`, 'error');

        // Викликаємо подію
        fireEvent('connection-lost', {
          connectionDrops: _state.connectionDrops
        });

        // Оновлюємо UI
        updateUI(false);
      }

      // Викликаємо загальну подію зміни стану з'єднання
      fireEvent('connection-change', {
        isOnline,
        connectionDrops: _state.connectionDrops,
        lastOnlineTime: _state.lastOnlineTime,
        lastOfflineTime: _state.lastOfflineTime,
        pingStats: { ..._state.pingStats }
      });
    }
  }

  /**
   * Оновлює UI відповідно до стану з'єднання
   * @param {boolean} isOnline - Стан з'єднання
   */
  function updateUI(isOnline) {
    try {
      // Якщо є функція showToast, використовуємо її
      if (typeof window.showToast === 'function') {
        if (isOnline) {
          window.showToast('З\'єднання з сервером відновлено', 'success');
        } else {
          window.showToast('З\'єднання з сервером втрачено. Працюємо в офлайн режимі.', 'warning');
        }
      }

      // Оновлюємо статус індикатора з'єднання, якщо він є
      const connectionIndicator = document.getElementById('connection-status');
      if (connectionIndicator) {
        connectionIndicator.className = isOnline ? 'connection-online' : 'connection-offline';
        connectionIndicator.title = isOnline ? 'З\'єднання активне' : 'Офлайн режим';
      } else {
        // Якщо індикатора немає, створюємо його
        createConnectionIndicator(isOnline);
      }
    } catch (error) {
      log(`Помилка оновлення UI: ${error.message}`, 'error');
    }
  }

  /**
   * Створює індикатор стану з'єднання
   * @param {boolean} isOnline - Початковий стан з'єднання
   */
  function createConnectionIndicator(isOnline) {
    // Перевіряємо, чи існує індикатор
    if (document.getElementById('connection-status')) {
      return;
    }

    // Створюємо індикатор
    const indicator = document.createElement('div');
    indicator.id = 'connection-status';
    indicator.className = isOnline ? 'connection-online' : 'connection-offline';
    indicator.title = isOnline ? 'З\'єднання активне' : 'Офлайн режим';
    indicator.innerHTML = `<span class="connection-icon"></span>`;

    // Додаємо стилі
    const style = document.createElement('style');
    style.textContent = `
      #connection-status {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        border-radius: 50%;
        width: 12px;
        height: 12px;
        box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .connection-online {
        background-color: #4CAF50;
      }
      .connection-offline {
        background-color: #F44336;
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.1); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;

    // Додаємо індикатор та стилі до документу
    document.head.appendChild(style);
    document.body.appendChild(indicator);

    // Додаємо обробник кліку для перевірки з'єднання
    indicator.addEventListener('click', () => {
      // Показуємо інформацію про з'єднання
      let status = isOnline ? 'Онлайн' : 'Офлайн';
      let details = '';

      if (isOnline) {
        details += `Середня латентність: ${Math.round(_state.pingStats.average)}ms\n`;
        details += `Успішних пінгів: ${_state.pingStats.success} / ${_state.pingStats.attempts}\n`;
      } else {
        const downtime = Math.round((Date.now() - _state.lastOfflineTime) / 1000);
        details += `Час без з'єднання: ${downtime}с\n`;
        details += `Кількість обривів: ${_state.connectionDrops}\n`;
      }

      // Показуємо вікно з інформацією
      alert(`Стан з'єднання: ${status}\n${details}`);

      // Ініціюємо перевірку з'єднання
      checkServerConnection();
    });
  }

  /**
   * Синхронізує дані після відновлення з'єднання
   */
  function synchronizeData() {
    // Перевіряємо наявність модулів
    if (window.WinixCore && typeof window.WinixCore.syncUserData === 'function') {
      log("Синхронізація даних користувача через WinixCore...");

      window.WinixCore.syncUserData(true)
        .then(() => {
          log("Дані користувача успішно синхронізовано", 'success');
        })
        .catch(error => {
          log(`Помилка синхронізації даних користувача: ${error.message}`, 'error');
        });
    }

    // Перевіряємо наявність модуля API
    if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
      log("Оновлення даних користувача через WinixAPI...");

      window.WinixAPI.getUserData(true)
        .then(response => {
          if (response && response.status === 'success') {
            log("Дані користувача успішно оновлено", 'success');
          } else {
            log("Не вдалося оновити дані користувача", 'warn');
          }
        })
        .catch(error => {
          log(`Помилка оновлення даних користувача: ${error.message}`, 'error');
        });
    }
  }

  /**
   * Запускає періодичну перевірку з'єднання
   */
  function startConnectionMonitoring() {
    // Зупиняємо попередній таймер, якщо він існує
    if (_state.pingTimer) {
      clearInterval(_state.pingTimer);
      _state.pingTimer = null;
    }

    // Запускаємо новий таймер
    _state.pingTimer = setInterval(() => {
      checkServerConnection();
    }, _state.pingInterval);

    log(`Моніторинг з'єднання запущено (інтервал: ${_state.pingInterval / 1000}с)`);
  }

  /**
   * Зупиняє періодичну перевірку з'єднання
   */
  function stopConnectionMonitoring() {
    if (_state.pingTimer) {
      clearInterval(_state.pingTimer);
      _state.pingTimer = null;
      log("Моніторинг з'єднання зупинено");
    }
  }

  /**
   * Додає обробник події
   * @param {string} eventName - Назва події
   * @param {Function} handler - Обробник події
   */
  function addEventListener(eventName, handler) {
    if (!_state.eventHandlers[eventName]) {
      _state.eventHandlers[eventName] = [];
    }

    if (typeof handler === 'function' && !_state.eventHandlers[eventName].includes(handler)) {
      _state.eventHandlers[eventName].push(handler);
      return true;
    }

    return false;
  }

  /**
   * Видаляє обробник події
   * @param {string} eventName - Назва події
   * @param {Function} handler - Обробник події
   */
  function removeEventListener(eventName, handler) {
    if (_state.eventHandlers[eventName] && typeof handler === 'function') {
      const index = _state.eventHandlers[eventName].indexOf(handler);

      if (index !== -1) {
        _state.eventHandlers[eventName].splice(index, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Викликає подію
   * @param {string} eventName - Назва події
   * @param {object} data - Дані події
   */
  function fireEvent(eventName, data) {
    if (_state.eventHandlers[eventName]) {
      for (const handler of _state.eventHandlers[eventName]) {
        try {
          handler(data);
        } catch (error) {
          log(`Помилка виконання обробника події ${eventName}: ${error.message}`, 'error');
        }
      }
    }

    // Викликаємо також подію DOM
    try {
      document.dispatchEvent(new CustomEvent(`connection-${eventName}`, {
        detail: data
      }));
    } catch (error) {
      log(`Помилка створення події DOM: ${error.message}`, 'error');
    }
  }

  /**
   * Отримує інформацію про мережеве з'єднання
   */
  function getConnectionInfo() {
    try {
      if ('connection' in navigator) {
        const connection = navigator.connection;

        if (connection) {
          _state.networkType = connection.type || 'unknown';
          _state.effectiveType = connection.effectiveType || 'unknown';

          log(`Тип мережі: ${_state.networkType}, ефективний тип: ${_state.effectiveType}`);

          // Слухаємо зміни мережевого з'єднання
          connection.addEventListener('change', () => {
            _state.networkType = connection.type || 'unknown';
            _state.effectiveType = connection.effectiveType || 'unknown';

            log(`Зміна типу мережі: ${_state.networkType}, ефективний тип: ${_state.effectiveType}`);

            // Перевіряємо з'єднання при зміні типу мережі
            checkServerConnection();
          });
        }
      }
    } catch (error) {
      log(`Помилка отримання інформації про з'єднання: ${error.message}`, 'error');
    }
  }

  /**
   * Визначає швидкість завантаження сторінки
   */
  function monitorPageLoadingSpeed() {
    try {
      if (window.performance && window.performance.timing) {
        window.addEventListener('load', () => {
          setTimeout(() => {
            const timing = window.performance.timing;
            const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
            const domLoadTime = timing.domComplete - timing.domLoading;

            log(`Час завантаження сторінки: ${pageLoadTime}ms, DOM: ${domLoadTime}ms`);

            // Якщо час завантаження занадто великий, збільшуємо інтервал пінгу
            if (pageLoadTime > 5000) {
              _state.pingInterval = 60000; // 1 хвилина

              if (_state.pingTimer) {
                clearInterval(_state.pingTimer);
                _state.pingTimer = setInterval(() => {
                  checkServerConnection();
                }, _state.pingInterval);
              }

              log(`Збільшено інтервал пінгу до ${_state.pingInterval / 1000}с через повільне завантаження`);
            }
          }, 0);
        });
      }
    } catch (error) {
      log(`Помилка моніторингу швидкості завантаження: ${error.message}`, 'error');
    }
  }

  /**
   * Ініціалізує менеджер з'єднання
   */
  function init() {
    log("Ініціалізація менеджера з'єднання");

    // Реєструємо обробники подій
    window.addEventListener('online', () => {
      log("Браузер повідомив про відновлення з'єднання", 'success');
      checkServerConnection();
    });

    window.addEventListener('offline', () => {
      log("Браузер повідомив про втрату з'єднання", 'error');
      updateConnectionState(false);
    });

    // Отримуємо інформацію про з'єднання
    getConnectionInfo();

    // Моніторимо швидкість завантаження сторінки
    monitorPageLoadingSpeed();

    // Запускаємо моніторинг з'єднання
    startConnectionMonitoring();

    // Виконуємо початкову перевірку з'єднання
    checkServerConnection();

    log("Менеджер з'єднання успішно ініціалізовано", 'success');
  }

  // Перевіряємо, чи DOM вже завантажений
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Публічне API
  window.ConnectionManager = {
    // Методи управління з'єднанням
    checkConnection: checkServerConnection,
    isOnline: () => _state.isOnline,
    getConnectionStats: () => ({
      isOnline: _state.isOnline,
      networkType: _state.networkType,
      effectiveType: _state.effectiveType,
      lastOnlineTime: _state.lastOnlineTime,
      lastOfflineTime: _state.lastOfflineTime,
      connectionDrops: _state.connectionDrops,
      pingStats: { ..._state.pingStats }
    }),

    // Методи управління моніторингом
    startMonitoring: startConnectionMonitoring,
    stopMonitoring: stopConnectionMonitoring,
    setPingInterval: (interval) => {
      if (interval >= 5000) {
        _state.pingInterval = interval;

        // Перезапускаємо моніторинг з новим інтервалом
        if (_state.pingTimer) {
          stopConnectionMonitoring();
          startConnectionMonitoring();
        }

        log(`Інтервал пінгу змінено на ${interval / 1000}с`);
        return true;
      }
      return false;
    },

    // Методи для роботи з подіями
    on: addEventListener,
    off: removeEventListener
  };
})();