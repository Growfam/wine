/**
 * WINIX - Система розіграшів (index.js)
 * Точка входу для системи розіграшів, підключає всі необхідні модулі
 * Очищена версія без компонентів інтерфейсу
 * @version 1.3.0
 */

(function () {
  'use strict';

  console.log('🎲 Запуск системи розіграшів WINIX...');

  // Глобальний прапорець для відстеження ініціалізації
  window.__winixInitialized = window.__winixInitialized || false;

  // Функція для надійного завантаження необхідних ресурсів
  function ensureResourcesLoaded() {
    // Перевірка наявності API модуля з повторними спробами
    let attempts = 0;
    const maxAttempts = 5;

    return new Promise((resolve, reject) => {
      function checkAPI() {
        if (typeof WinixAPI !== 'undefined') {
          console.log('✅ WinixAPI успішно завантажено');

          // Перевірка WinixRaffles
          if (typeof WinixRaffles !== 'undefined') {
            console.log('✅ WinixRaffles успішно завантажено');
            resolve(true);
            return;
          }

          // Якщо WinixRaffles відсутній, але залишилися спроби
          if (attempts < maxAttempts) {
            attempts++;
            console.log(`⏳ Очікування WinixRaffles (спроба ${attempts}/${maxAttempts})...`);
            setTimeout(checkAPI, 500);
            return;
          }

          console.error(
            '❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено на сторінці.'
          );
          reject(new Error('WinixRaffles модуль не доступний'));
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.error(
            '❌ WinixAPI не знайдено! Переконайтеся, що api.js підключено на сторінці.'
          );
          reject(new Error('API модуль не доступний'));
          return;
        }

        console.log(`⏳ Очікування WinixAPI (спроба ${attempts}/${maxAttempts})...`);
        setTimeout(checkAPI, 500);
      }

      checkAPI();
    });
  }

  // Анімації інтерфейсу
  const initAnimations = function () {
    // Анімація частинок на фоні
    const createParticles = function () {
      const containers = document.querySelectorAll('.particles-container');

      containers.forEach((container) => {
        // Очищення контейнера перед створенням нових частинок
        container.innerHTML = '';

        // Отримуємо максимальну кількість частинок з конфігурації або за замовчуванням
        const maxParticles =
          (window.WinixRaffles &&
            window.WinixRaffles.config &&
            window.WinixRaffles.config.maxParticles) ||
          10;

        for (let i = 0; i < maxParticles; i++) {
          const particle = document.createElement('div');
          particle.className = 'particle';

          // Випадковий розмір
          const size = Math.random() * 5 + 2;
          particle.style.width = `${size}px`;
          particle.style.height = `${size}px`;

          // Випадкова початкова позиція
          particle.style.left = `${Math.random() * 100}%`;
          particle.style.top = `${Math.random() * 100}%`;

          // Випадкова прозорість
          particle.style.opacity = (Math.random() * 0.5 + 0.1).toString();

          // Випадковий колір
          const hue = Math.random() * 40 + 190; // Від блакитного до синього
          particle.style.backgroundColor = `hsla(${hue}, 100%, 70%, 0.6)`;

          // Випадкова анімація
          const duration = Math.random() * 15 + 5;
          particle.style.animationDuration = `${duration}s`;

          container.appendChild(particle);
        }
      });
    };

    // Анімація прогрес-бару
    const animateProgressBars = function () {
      const progress = document.querySelector('.progress');
      if (progress) {
        setTimeout(() => {
          progress.style.transition = 'width 1.5s ease-in-out';
        }, 500);
      }
    };

    // Запускаємо анімації
    try {
      createParticles();
      animateProgressBars();

      // Перезапуск анімацій при зміні вкладки
      document.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
          setTimeout(() => {
            createParticles();
            animateProgressBars();
          }, 100);
        });
      });
    } catch (e) {
      console.warn('Помилка ініціалізації анімацій:', e);
    }
  };

  // Перевірка стану ідентифікаторів розіграшів
  const validateRaffleIds = function () {
    // Додаємо цю функцію для перевірки валідності UUID
    window.isValidUUID = function (id) {
      if (!id || typeof id !== 'string') return false;
      // Основна перевірка на повний UUID
      const fullUUIDRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return fullUUIDRegex.test(id);
    };

    // Перевіряємо всі посилання на розіграші
    document.addEventListener(
      'click',
      function (event) {
        // Перевірка на кліки по елементах з raffle-id
        const target = event.target;
        if (target.hasAttribute('data-raffle-id')) {
          const raffleId = target.getAttribute('data-raffle-id');

          // Перевіряємо на валідність
          if (!window.isValidUUID(raffleId)) {
            console.error(`❌ Виявлено невалідний UUID: ${raffleId}`);
            event.preventDefault();
            event.stopPropagation();

            // Показуємо повідомлення
            if (typeof window.showToast === 'function') {
              window.showToast('Невалідний ідентифікатор розіграшу. Оновіть сторінку.', 'error');
            }

            // Видаляємо елемент
            target.classList.add('invalid-raffle');
            target.setAttribute('disabled', 'disabled');

            return false;
          }
        }
      },
      true
    );
  };

  // Додавання обробника помилок
  const initErrorHandlers = function () {
    // Глобальна обробка помилок
    window.addEventListener('error', function (event) {
      console.error('Критична помилка JavaScript:', event.error);

      // При помилках типу 404 для API розіграшів - скидаємо стан
      if (
        event.error &&
        event.error.message &&
        (event.error.message.includes('raffles') ||
          event.error.message.includes('UUID') ||
          event.error.message.includes('404'))
      ) {
        if (typeof window.showToast === 'function') {
          window.showToast('Виникла критична помилка. Сторінка буде перезавантажена.', 'error');
        }
        // Скидаємо стан через 2 секунди
        setTimeout(window.resetAndReloadApplication, 2000);
      }
    });

    // Додаємо перехоплювач для XHR/fetch, щоб виявляти 404 помилки
    const originalFetch = window.fetch;
    window.fetch = function () {
      return originalFetch.apply(this, arguments).catch((error) => {
        console.error('Помилка fetch запиту:', error);

        // Перевіряємо URL запиту
        const url = arguments[0];
        if (typeof url === 'string' && url.includes('raffles')) {
          console.error('Помилка fetch для URL розіграшів:', url);

          // Показуємо повідомлення
          if (typeof window.showToast === 'function') {
            window.showToast(
              'Помилка завантаження даних розіграшів. Спробуйте оновити сторінку.',
              'error'
            );
          }
        }

        throw error;
      });
    };
  };

  // Функція ініціалізації допоміжних компонентів
  const initHelpers = function () {
    initAnimations();
    validateRaffleIds();
    initErrorHandlers();
  };

  // Функція для безпечної ініціалізації WinixRaffles
  const safeInitializeWinixRaffles = function () {
    // Перевіряємо, чи вже ініціалізовано
    if (window.__winixInitialized) {
      console.log('⚠️ Спроба повторної ініціалізації WinixRaffles. Ігноруємо.');
      return false;
    }

    try {
      // Перевіряємо наявність об'єкта WinixRaffles
      if (typeof window.WinixRaffles === 'undefined') {
        console.error("❌ Об'єкт WinixRaffles відсутній. Перевірте підключення init.js");
        return false;
      }

      // Перевіряємо, чи вже ініціалізовано
      if (window.WinixRaffles.state && window.WinixRaffles.state.isInitialized) {
        console.log('✅ WinixRaffles вже було ініціалізовано');
        window.__winixInitialized = true;
        return true;
      }

      // Ініціалізуємо систему розіграшів
      if (typeof window.WinixRaffles.init === 'function') {
        window.WinixRaffles.init();
        window.__winixInitialized = true;
        console.log('✅ Система розіграшів WINIX успішно ініціалізована з index.js');
        return true;
      } else {
        console.error('❌ Функція ініціалізації WinixRaffles не знайдена!');
        return false;
      }
    } catch (error) {
      console.error('❌ Помилка при ініціалізації WinixRaffles:', error);
      return false;
    }
  };

  // Ініціалізація при завантаженні сторінки
  document.addEventListener('DOMContentLoaded', function () {
    try {
      // Ініціалізуємо допоміжні компоненти
      initHelpers();

      // Намагаємося завантажити необхідні ресурси
      ensureResourcesLoaded()
        .then(() => {
          // Ініціалізуємо систему розіграшів
          if (safeInitializeWinixRaffles()) {
            console.log('✅ Система розіграшів WINIX повністю готова');
          }
        })
        .catch((error) => {
          console.error('❌ Помилка завантаження необхідних ресурсів:', error);

          // Показуємо користувачу повідомлення про помилку
          if (typeof window.showToast === 'function') {
            window.showToast(
              'Виникла помилка при завантаженні. Спробуйте оновити сторінку.',
              'error'
            );
          }
        });
    } catch (e) {
      console.error('❌ Критична помилка під час ініціалізації:', e);
    }
  });

  // Додатковий обробник для випадку, якщо DOMContentLoaded вже відбувся
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function () {
      // Перевіряємо, чи була спроба ініціалізації
      if (!window.__winixInitialized) {
        console.log(
          '⚠️ DOMContentLoaded вже відбувся, але ініціалізація не запущена. Запускаємо...'
        );

        // Ініціалізуємо допоміжні компоненти
        initHelpers();

        // Ініціалізуємо WinixRaffles, якщо він доступний
        if (typeof window.WinixRaffles !== 'undefined') {
          safeInitializeWinixRaffles();
        } else {
          console.warn('⚠️ WinixRaffles не знайдено після DOMContentLoaded');
        }
      }
    }, 100);
  }

  // Додатковий глобальний обробник помилок для діагностики
  window.addEventListener('error', function (event) {
    console.error('🚨 ГЛОБАЛЬНА ПОМИЛКА:', event.error);
    console.error('📄 Файл:', event.filename);
    console.error('📍 Рядок:', event.lineno);
    console.error('📍 Колонка:', event.colno);
    console.error('📝 Стек:', event.error?.stack);

    // Спроба відобразити повідомлення для користувача
    if (typeof window.showToast === 'function') {
      window.showToast('Сталася помилка: ' + event.error?.message, 'error');
    }
  });

  // Додатковий обробник для відлову помилок Promise
  window.addEventListener('unhandledrejection', function (event) {
    console.error('🚨 НЕОБРОБЛЕНА ПОМИЛКА PROMISE:', event.reason);
    console.error('📝 Стек:', event.reason?.stack);

    // Спроба відобразити повідомлення для користувача
    if (typeof window.showToast === 'function') {
      window.showToast('Сталася помилка обробки даних', 'error');
    }
  });
})();
