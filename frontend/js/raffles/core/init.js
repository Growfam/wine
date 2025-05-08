/**
 * WINIX - Система розіграшів (init.js)
 * Оптимізована версія з покращеною ініціалізацією та обробкою помилок
 * @version 1.3.0
 */

(function () {
  'use strict';

  // Прапорець для відстеження, чи об'єкт вже створено
  window.__winixModuleInitialized = window.__winixModuleInitialized || false;

  // Перевірка наявності API модуля з очікуванням
  function waitForAPI(maxAttempts = 5) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      function checkAPI() {
        if (
          typeof window.WinixAPI !== 'undefined' &&
          typeof window.WinixAPI.apiRequest === 'function' &&
          typeof window.WinixAPI.getUserId === 'function'
        ) {
          console.log('✅ WinixAPI успішно знайдено');
          resolve(true);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.error(
            '❌ WinixAPI не знайдено після кількох спроб! Намагаємося продовжити без нього.'
          );
          resolve(false);
          return;
        }

        console.log(`⏳ Очікування WinixAPI (спроба ${attempts}/${maxAttempts})...`);
        setTimeout(checkAPI, 500);
      }

      checkAPI();
    });
  }

  // Створення основного об'єкта WinixRaffles
  async function initWinixRaffles() {
    // Перевіряємо, чи об'єкт вже створено
    if (window.__winixModuleInitialized) {
      console.log("✅ Об'єкт WinixRaffles вже було створено");
      return window.WinixRaffles;
    }

    console.log("🎲 Підготовка об'єкту системи розіграшів WINIX...");

    // Очікуємо доступність API
    const apiAvailable = await waitForAPI();

    // Створення основного об'єкта WinixRaffles, якщо він ще не існує
    if (typeof window.WinixRaffles === 'undefined') {
      window.WinixRaffles = {
        // Поточний стан
        state: {
          isInitialized: false,
          activeTab: 'active',
          activeRaffles: [],
          pastRaffles: [],
          userRaffles: [],
          telegramId: null,
          isLoading: false,
          refreshTimers: {},
          invalidRaffleIds: new Set(), // Для відстеження невалідних ID розіграшів
          // Додамо нові поля для оптимізації
          lastRefreshTime: 0,
          devicePerformance: detectDevicePerformance(),
        },

        // Конфігурація
        config: {
          activeRafflesEndpoint: 'api/raffles', // Виправлено з 'api/raffles/active'
          pastRafflesEndpoint: 'api/raffles/history', // Виправлено з 'api/raffles/past'
          userRafflesEndpoint: 'api/user/{userId}/raffles', // Додано динамічний параметр
          userRafflesHistoryEndpoint: 'api/user/{userId}/raffles-history', // Додано ендпоінт історії
          autoRefreshInterval: detectOptimalRefreshInterval(), // Динамічний інтервал оновлення
          maxParticles: detectMaxParticles(), // Максимальна кількість анімованих частинок
        },

        // Ініціалізація системи розіграшів
        init: function () {
          // Перевіряємо, чи вже ініціалізовано
          if (this.state.isInitialized) {
            console.log('✅ Система розіграшів WINIX вже ініціалізована');
            return this;
          }

          console.log('🎲 Ініціалізація системи розіграшів WINIX...');

          // Встановлення ID користувача
          if (apiAvailable) {
            try {
              this.state.telegramId = window.WinixAPI.getUserId();
              console.log(`🔑 ID користувача: ${this.state.telegramId}`);
            } catch (error) {
              console.warn('⚠️ Помилка отримання ID користувача:', error);
              // Використовуємо альтернативні методи отримання ID
              this.state.telegramId = getAlternativeUserId();
            }
          } else {
            // Використовуємо альтернативні методи отримання ID
            this.state.telegramId = getAlternativeUserId();
          }

          // Встановлення активної вкладки
          const activeTabBtn = document.querySelector('.tab-button.active');
          if (activeTabBtn) {
            this.state.activeTab = activeTabBtn.getAttribute('data-tab');
          }

          // Налаштування переключення вкладок
          this.setupTabSwitching();

          // Адаптуємо налаштування для поточного пристрою
          this.adaptForDevice();

          // Позначаємо, що система ініціалізована
          this.state.isInitialized = true;

          // Генеруємо подію про ініціалізацію
          document.dispatchEvent(new CustomEvent('winix-raffles-initialized'));

          console.log('✅ Система розіграшів WINIX успішно ініціалізована');

          return this;
        },

        // Налаштування переключення вкладок з оптимізацією
        setupTabSwitching: function () {
          const tabButtons = document.querySelectorAll('.tab-button');
          const tabContents = document.querySelectorAll('.tab-content');

          if (!tabButtons.length || !tabContents.length) {
            console.warn('⚠️ Не знайдено елементи вкладок на сторінці');
            return;
          }

          // Використовуємо делегування подій замість обробників для кожної кнопки
          const tabsContainer = tabButtons[0].parentElement;
          if (!tabsContainer) return;

          tabsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.tab-button');
            if (!button) return;

            const tabName = button.getAttribute('data-tab');
            if (!tabName) return;

            // Оновлюємо активну вкладку в стані
            this.state.activeTab = tabName;

            // Оптимізоване оновлення активних вкладок
            tabButtons.forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');

            // Оптимізоване оновлення вмісту вкладок
            tabContents.forEach((content) => content.classList.remove('active'));
            const targetContent = document.getElementById(tabName + '-raffles');
            if (targetContent) {
              targetContent.classList.add('active');
            }

            console.log(`🔄 Активовано вкладку: ${tabName}`);

            // Завантажуємо дані відповідно до вкладки з перевіркою
            this.loadTabData(tabName);
          });
        },

        // Метод для адаптації під поточний пристрій
        adaptForDevice: function () {
          const isMobile = window.innerWidth < 768;
          const isLowEndDevice = this.state.devicePerformance === 'low';

          // Адаптуємо інтервал оновлення
          if (isMobile || isLowEndDevice) {
            this.config.autoRefreshInterval = 180000; // 3 хвилини для мобільних/слабких пристроїв
            this.config.maxParticles = 5; // Менше частинок для слабших пристроїв
          }

          // Додаємо клас для адаптації стилів
          if (isMobile) {
            document.body.classList.add('mobile-device');
          }

          if (isLowEndDevice) {
            document.body.classList.add('low-end-device');
          }
        },

        // Метод для завантаження даних відповідно до активної вкладки
        loadTabData: function (tabName) {
          // Перевірка таймінгу для запобігання надто частим запитам
          const now = Date.now();
          const timeSinceLastRefresh = now - this.state.lastRefreshTime;

          // Не оновлюємо, якщо пройшло менше 5 секунд з моменту останнього оновлення
          if (timeSinceLastRefresh < 5000) {
            console.log('⏳ Надто частий запит, пропускаємо оновлення даних');
            return;
          }

          // Завантажуємо відповідні дані
          if (tabName === 'active') {
            if (typeof this.loadActiveRaffles === 'function') {
              this.loadActiveRaffles();
            }
          } else if (tabName === 'history' || tabName === 'past') {
            if (this.history && typeof this.history.loadRaffleHistory === 'function') {
              this.history.loadRaffleHistory();
            }
          } else if (tabName === 'statistics' || tabName === 'stats') {
            if (this.statistics && typeof this.statistics.loadStatistics === 'function') {
              this.statistics.loadStatistics();
            }
          }

          // Оновлюємо час останнього оновлення
          this.state.lastRefreshTime = now;
        },
      };
    }

    // Якщо об'єкт вже існує, оновлюємо налаштування
    else {
      // Оновлюємо налаштування для поточного пристрою
      if (!window.WinixRaffles.state.devicePerformance) {
        window.WinixRaffles.state.devicePerformance = detectDevicePerformance();
      }

      // Оптимізуємо інтервал оновлення, якщо не встановлено
      if (window.WinixRaffles.config.autoRefreshInterval === 120000) {
        // Якщо стандартне значення
        window.WinixRaffles.config.autoRefreshInterval = detectOptimalRefreshInterval();
      }

      // Додаємо відсутні поля
      if (!window.WinixRaffles.config.maxParticles) {
        window.WinixRaffles.config.maxParticles = detectMaxParticles();
      }
    }

    // Позначаємо, що модуль створено
    window.__winixModuleInitialized = true;
    console.log("✅ Об'єкт WinixRaffles успішно підготовлено і готовий до ініціалізації");
    return window.WinixRaffles;
  }

  // Визначення продуктивності пристрою
  function detectDevicePerformance() {
    try {
      // Простий тест продуктивності
      const startTime = performance.now();
      let counter = 0;
      for (let i = 0; i < 500000; i++) {
        counter++;
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Класифікація пристрою за продуктивністю
      if (duration > 50) {
        return 'low'; // Низькопродуктивний пристрій
      } else if (duration > 20) {
        return 'medium'; // Середньопродуктивний пристрій
      } else {
        return 'high'; // Високопродуктивний пристрій
      }
    } catch (e) {
      return 'medium'; // За замовчуванням
    }
  }

  // Визначення оптимального інтервалу оновлення
  function detectOptimalRefreshInterval() {
    const isMobile = window.innerWidth < 768;
    const performance = detectDevicePerformance();

    if (isMobile || performance === 'low') {
      return 180000; // 3 хвилини для мобільних/слабких пристроїв
    } else if (performance === 'medium') {
      return 120000; // 2 хвилини для середніх пристроїв
    } else {
      return 90000; // 1.5 хвилини для потужних пристроїв
    }
  }

  // Визначення максимальної кількості анімаційних частинок
  function detectMaxParticles() {
    const isMobile = window.innerWidth < 768;
    const performance = detectDevicePerformance();

    if (isMobile || performance === 'low') {
      return 5; // Менше частинок для слабших пристроїв
    } else if (performance === 'medium') {
      return 10; // Середня кількість для середніх пристроїв
    } else {
      return 15; // Більше частинок для потужних пристроїв
    }
  }

  // Отримання ID користувача альтернативними методами
  function getAlternativeUserId() {
    try {
      // Спроба отримати з localStorage
      const storedId = localStorage.getItem('telegram_user_id');
      if (storedId && storedId !== 'undefined' && storedId !== 'null') {
        console.log('🔍 ID користувача отримано з localStorage');
        return storedId;
      }

      // Спроба отримати з DOM
      const userIdElement = document.getElementById('user-id');
      if (userIdElement && userIdElement.textContent) {
        const id = userIdElement.textContent.trim();
        if (id && id !== 'undefined' && id !== 'null') {
          console.log('🔍 ID користувача отримано з DOM');
          return id;
        }
      }

      // Спроба отримати з URL-параметрів
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
      if (urlId) {
        console.log('🔍 ID користувача отримано з URL');
        return urlId;
      }

      // Повертаємо null, якщо не вдалося отримати ID
      console.warn('⚠️ Не вдалося отримати ID користувача');
      return null;
    } catch (error) {
      console.error('❌ Помилка отримання ID користувача:', error);
      return null;
    }
  }

  // Запускаємо створення об'єкту WinixRaffles (без виклику WinixRaffles.init())
  initWinixRaffles()
    .then((rafflesModule) => {
      // НЕ ініціалізуємо автоматично - це буде зроблено в index.js
      console.log('✅ Модуль ініціалізації raffles/init.js завантажено');
    })
    .catch((error) => {
      console.error("❌ Помилка створення об'єкту WinixRaffles:", error);

      // Створюємо базовий об'єкт у випадку помилки
      if (typeof window.WinixRaffles === 'undefined') {
        window.WinixRaffles = {
          state: {
            isInitialized: false,
            activeTab: 'active',
            activeRaffles: [],
            pastRaffles: [],
            telegramId: null,
          },
          init: function () {
            if (this.state.isInitialized) {
              console.log('✅ Система розіграшів WINIX вже ініціалізована');
              return this;
            }
            console.warn('⚠️ Ініціалізується базова версія WinixRaffles');
            this.state.isInitialized = true;
            return this;
          },
        };
      }
    });

  console.log('✅ Модуль ініціалізації raffles/init.js завантажено');
})();
