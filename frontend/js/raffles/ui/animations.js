/**
 * WINIX - Система розіграшів (animations.js)
 * Модуль з преміальними анімаціями для системи розіграшів
 * @version 1.0.0
 */

(function () {
  'use strict';

  // Перевірка наявності головного модуля розіграшів
  if (typeof window.WinixRaffles === 'undefined') {
    console.error(
      '❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше animations.js'
    );
    return;
  }

  // Клас для преміальних анімацій
  const RafflesAnimations = {
    // Налаштування анімацій
    config: {
      // Чи включені преміальні анімації
      enabled: true,
      // Чи включена адаптація для слабких пристроїв
      adaptiveMode: true,
      // Тривалість анімацій в мс (можна змінювати для оптимізації)
      animationDuration: 500,
      // Максимальна кількість частинок для фону
      maxParticles: 15,
      // Швидкість анімації для різних ефектів
      speeds: {
        fast: 300,
        normal: 500,
        slow: 800,
      },
    },

    // Стан анімацій
    state: {
      // Чи були ініціалізовані анімації
      initialized: false,
      // Чи були створені частинки
      particlesCreated: false,
      // Продуктивність пристрою (визначається автоматично)
      devicePerformance: 'high', // 'low', 'medium', 'high'
      // Таймери для різних анімацій
      timers: {},
      // Обмеження для паралельних анімацій
      animationsInProgress: 0,
    },

    // Ініціалізація анімацій
    init: function () {
      console.log('✨ Ініціалізація преміальних анімацій для розіграшів...');

      // Запобігаємо повторній ініціалізації
      if (this.state.initialized) return;

      // Визначаємо продуктивність пристрою
      this.detectDevicePerformance();

      // Додаємо стилі для анімацій
      this.injectAnimationStyles();

      // Створюємо частинки для фону
      this.createParticles();

      // Додаємо обробники подій
      this.setupEventHandlers();

      // Додаємо анімації для заголовків
      this.animateHeaders();

      // Анімуємо входження елементів
      this.animateInitialElements();

      // Застосовуємо преміальні анімації до елементів
      this.applyPremiumEffects();

      // Встановлюємо флаг ініціалізації
      this.state.initialized = true;

      console.log('✅ Преміальні анімації успішно ініціалізовано');
    },

    // Визначення продуктивності пристрою
    detectDevicePerformance: function () {
      try {
        const startTime = performance.now();
        // Проста тестова операція
        let counter = 0;
        for (let i = 0; i < 500000; i++) {
          counter++;
        }
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Визначення категорії пристрою
        if (duration > 50) {
          this.state.devicePerformance = 'low';
          this.config.maxParticles = 5;
          this.config.animationDuration = 300;
        } else if (duration > 20) {
          this.state.devicePerformance = 'medium';
          this.config.maxParticles = 10;
        } else {
          this.state.devicePerformance = 'high';
        }

        console.log(`🔍 Визначено продуктивність пристрою: ${this.state.devicePerformance}`);

        // Адаптація налаштувань для мобільних пристроїв
        if (window.innerWidth < 768) {
          this.config.maxParticles = Math.max(5, Math.floor(this.config.maxParticles * 0.7));
        }
      } catch (e) {
        console.warn('⚠️ Помилка при визначенні продуктивності пристрою:', e);
        this.state.devicePerformance = 'medium';
      }
    },

    // Вставка стилів анімацій в DOM
    injectAnimationStyles: function () {
      // Перевіряємо, чи стилі вже додані
      if (document.getElementById('premium-animations-style')) return;

      const style = document.createElement('style');
      style.id = 'premium-animations-style';
      style.textContent = `
                /* Анімації для входження елементів */
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes fadeInRight {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes fadeInDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes glow-pulse {
                    0% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                    50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.8), 0 0 30px rgba(0, 201, 167, 0.5); }
                    100% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                }

                @keyframes text-glow {
                    0% { text-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                    50% { text-shadow: 0 0 15px rgba(0, 201, 167, 0.8), 0 0 30px rgba(0, 201, 167, 0.5); }
                    100% { text-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }

                @keyframes background-shift {
                    0% { background-position: 0% 0%; }
                    50% { background-position: 10% 10%; }
                    100% { background-position: 0% 0%; }
                }

                @keyframes countdown-pulse {
                    0% { color: white; transform: scale(1); }
                    50% { color: rgba(0, 201, 167, 1); transform: scale(1.1); }
                    100% { color: white; transform: scale(1); }
                }

                /* Стилі для анімації частинок */
                .particles-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 100%;
                    pointer-events: none;
                    overflow: hidden;
                    z-index: -1;
                }

                .particle {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(78, 181, 247, 0.6);
                    box-shadow: 0 0 10px rgba(78, 181, 247, 0.4);
                    animation: float 15s infinite linear;
                }

                @keyframes float {
                    0% { transform: translateY(0) translateX(0); }
                    25% { transform: translateY(-30px) translateX(10px); }
                    50% { transform: translateY(-10px) translateX(20px); }
                    75% { transform: translateY(-20px) translateX(-10px); }
                    100% { transform: translateY(0) translateX(0); }
                }

                /* Преміальні стилі для елементів розіграшів */
                .main-raffle {
                    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    position: relative;
                }

                .main-raffle::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background-color: rgba(0, 201, 167, 0.05);
                    background-image: radial-gradient(rgba(0, 201, 167, 0.2) 0%, transparent 70%);
                    animation: rotate 15s infinite linear;
                    pointer-events: none;
                }

                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .mini-raffle {
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    border-left: 3px solid transparent;
                }

                .mini-raffle:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                    border-left: 3px solid rgba(0, 201, 167, 0.8);
                }

                /* Преміальні стилі для кнопок */
                .join-button, .mini-raffle-button {
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    z-index: 1;
                }

                .join-button::before, .mini-raffle-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg,
                        rgba(255, 255, 255, 0),
                        rgba(255, 255, 255, 0.2),
                        rgba(255, 255, 255, 0));
                    transition: all 0.6s;
                    z-index: -1;
                }

                .join-button:hover::before, .mini-raffle-button:hover::before {
                    left: 100%;
                }

                .join-button:hover, .mini-raffle-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                }

                .join-button:active, .mini-raffle-button:active {
                    transform: translateY(1px);
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                }

                /* Ефект свічення для таймера */
                .timer-container {
                    animation: glow-pulse 10s infinite;
                }

                .timer-value {
                    transition: all 0.3s ease;
                }

                .timer-value.countdown-ending {
                    animation: countdown-pulse 1s infinite;
                }

                /* Стилі для анімації входження */
                .fade-in-up {
                    opacity: 0;
                    animation: fadeInUp 0.5s ease forwards;
                }

                .fade-in-right {
                    opacity: 0;
                    animation: fadeInRight 0.5s ease forwards;
                }

                .fade-in-down {
                    opacity: 0;
                    animation: fadeInDown 0.5s ease forwards;
                }

                .scale-in {
                    opacity: 0;
                    animation: scaleIn 0.5s ease forwards;
                }

                /* Поступова поява елементів з різними затримками */
                .stagger-item:nth-child(1) { animation-delay: 0.1s; }
                .stagger-item:nth-child(2) { animation-delay: 0.2s; }
                .stagger-item:nth-child(3) { animation-delay: 0.3s; }
                .stagger-item:nth-child(4) { animation-delay: 0.4s; }
                .stagger-item:nth-child(5) { animation-delay: 0.5s; }

                /* Премальні стилі для процесу участі */
                .processing {
                    position: relative;
                    overflow: hidden;
                }

                .processing::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg,
                        rgba(0, 201, 167, 0),
                        rgba(0, 201, 167, 0.3),
                        rgba(0, 201, 167, 0));
                    animation: shine 1.5s infinite;
                }

                @keyframes shine {
                    to { left: 100%; }
                }

                /* Нові стилі для прогрес-бару */
                .progress {
                    position: relative;
                    overflow: hidden;
                    transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .progress::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg,
                        rgba(255, 255, 255, 0),
                        rgba(255, 255, 255, 0.3),
                        rgba(255, 255, 255, 0));
                    animation: shine 3s infinite;
                }

                /* Анімація для заголовків секцій */
                .section-header {
                    position: relative;
                    overflow: hidden;
                }

                .section-title {
                    animation: text-glow 8s infinite;
                }

                .premium-divider {
                    width: 50px;
                    height: 3px;
                    background: linear-gradient(90deg, rgba(0, 201, 167, 0.5), rgba(78, 181, 247, 0.8));
                    margin: 10px auto 15px;
                    border-radius: 2px;
                    animation: width-pulse 5s infinite;
                }

                @keyframes width-pulse {
                    0% { width: 30px; }
                    50% { width: 70px; }
                    100% { width: 30px; }
                }

                /* Анімація для статистики */
                .stat-card {
                    transition: all 0.3s ease;
                }

                .stat-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                }

                .stat-value {
                    transition: all 0.3s ease;
                }

                .stat-updated {
                    animation: stat-pulse 1s ease-in-out;
                    transition: color 0.3s ease;
                    color: rgba(0, 201, 167, 1) !important;
                }

                @keyframes stat-pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }

                /* Адаптивні стилі для різних пристроїв */
                @media (max-width: 768px) {
                    .premium-divider {
                        margin: 5px auto 10px;
                    }

                    @keyframes width-pulse {
                        0% { width: 20px; }
                        50% { width: 50px; }
                        100% { width: 20px; }
                    }
                }

                /* Адаптація для слабких пристроїв */
                .low-performance-mode .premium-divider,
                .low-performance-mode .section-title,
                .low-performance-mode .progress::after,
                .low-performance-mode .main-raffle::before {
                    animation: none !important;
                }
            `;
      document.head.appendChild(style);
    },

    // Створення частинок для фону
    createParticles: function () {
      if (!this.config.enabled) return;

      // Щоб не створювати частинки повторно
      if (this.state.particlesCreated) return;

      // Знаходимо всі контейнери для частинок
      const containers = document.querySelectorAll('.particles-container');
      if (!containers.length) return;

      // Очищаємо контейнери
      containers.forEach((container) => {
        container.innerHTML = '';
      });

      // Визначаємо кількість частинок в залежності від продуктивності
      let particleCount = this.config.maxParticles;
      if (this.state.devicePerformance === 'low') {
        particleCount = 5;
      } else if (this.state.devicePerformance === 'medium') {
        particleCount = 8;
      }

      // Створюємо частинки
      containers.forEach((container) => {
        for (let i = 0; i < particleCount; i++) {
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

          // Додаємо частинку в контейнер
          container.appendChild(particle);
        }
      });

      this.state.particlesCreated = true;
    },

    // Налаштування обробників подій
    setupEventHandlers: function () {
      // Оновлення частинок при зміні розміру вікна
      window.addEventListener(
        'resize',
        this.debounce(() => {
          this.state.particlesCreated = false;
          this.createParticles();
        }, 300)
      );

      // Оновлення анімацій при зміні вкладки
      document.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
          const tabName = button.getAttribute('data-tab');
          setTimeout(() => {
            this.animateTabContent(tabName);
          }, 100);
        });
      });

      // Обробник події завантаження розіграшів
      document.addEventListener('raffles-loaded', () => {
        this.animateRaffleItems();
      });

      // Обробник події завершення участі в розіграші
      document.addEventListener('raffle-participation', (event) => {
        if (event.detail && event.detail.successful) {
          this.animateSuccessfulParticipation(event.detail.raffleId);
        }
      });

      // Обробник для анімації секцій статистики
      document.addEventListener('stats-updated', () => {
        this.animateStatistics();
      });
    },

    // Анімація заголовків секцій
    animateHeaders: function () {
      // Анімуємо заголовки секцій
      document.querySelectorAll('.section-title').forEach((title, index) => {
        title.style.animationDelay = `${index * 0.2}s`;
      });

      // Анімуємо роздільники
      document.querySelectorAll('.premium-divider').forEach((divider, index) => {
        divider.style.animationDelay = `${index * 0.2 + 0.1}s`;
      });
    },

    // Анімація початкових елементів при завантаженні
    animateInitialElements: function () {
      // Анімуємо заголовки секцій
      document.querySelectorAll('.section-header').forEach((header, index) => {
        header.classList.add('fade-in-down');
        header.style.animationDelay = `${index * 0.2}s`;
      });

      // Анімуємо головний розіграш
      const mainRaffle = document.querySelector('.main-raffle');
      if (mainRaffle) {
        mainRaffle.classList.add('scale-in');
        mainRaffle.style.animationDelay = '0.3s';
      }

      // Анімуємо заголовок міні-розіграшів
      const miniRafflesTitle = document.querySelector('.mini-raffles-title');
      if (miniRafflesTitle) {
        miniRafflesTitle.classList.add('fade-in-right');
        miniRafflesTitle.style.animationDelay = '0.4s';
      }

      // Анімуємо контейнер міні-розіграшів
      const miniRafflesContainer = document.querySelector('.mini-raffles-container');
      if (miniRafflesContainer) {
        miniRafflesContainer.classList.add('fade-in-up');
        miniRafflesContainer.style.animationDelay = '0.5s';
      }

      // Анімуємо контейнер історії
      const historyContainer = document.getElementById('history-container');
      if (historyContainer) {
        historyContainer.classList.add('fade-in-up');
        historyContainer.style.animationDelay = '0.3s';
      }

      // Анімуємо статистику
      const statsContainer = document.querySelector('.statistics-container');
      if (statsContainer) {
        statsContainer.classList.add('scale-in');
        statsContainer.style.animationDelay = '0.3s';
      }
    },

    // Анімація елементів розіграшів
    animateRaffleItems: function () {
      // Анімуємо міні-розіграші
      document.querySelectorAll('.mini-raffle').forEach((raffle, index) => {
        raffle.classList.add('fade-in-up', 'stagger-item');
        raffle.style.animationDelay = `${0.1 + index * 0.1}s`;
      });

      // Анімуємо елементи історії
      document.querySelectorAll('.history-card').forEach((card, index) => {
        card.classList.add('fade-in-up', 'stagger-item');
        card.style.animationDelay = `${0.1 + index * 0.1}s`;
      });
    },

    // Анімація елементів вкладки
    animateTabContent: function (tabName) {
      // Оновлюємо частинки
      setTimeout(() => {
        this.state.particlesCreated = false;
        this.createParticles();
      }, 100);

      // Анімація для різних вкладок
      switch (tabName) {
        case 'active':
          this.animateInitialElements();
          this.animateRaffleItems();
          break;
        case 'past':
          // Анімуємо елементи історії
          document.querySelectorAll('.history-card').forEach((card, index) => {
            card.classList.add('fade-in-up', 'stagger-item');
            card.style.animationDelay = `${0.1 + index * 0.1}s`;
          });
          break;
        case 'stats':
          this.animateStatistics();
          break;
      }
    },

    // Анімація статистики
    animateStatistics: function () {
      document.querySelectorAll('.stat-card').forEach((card, index) => {
        card.classList.add('fade-in-up', 'stagger-item');
        card.style.animationDelay = `${0.1 + index * 0.1}s`;
      });
    },

    // Анімація успішної участі в розіграші
    animateSuccessfulParticipation: function (raffleId) {
      // Знаходимо елемент розіграшу
      const raffleElement = document.querySelector(`[data-raffle-id="${raffleId}"]`);
      if (!raffleElement) return;

      // Додаємо ефект пульсації
      raffleElement.classList.add('success-pulse');

      // Створюємо конфетті навколо елемента
      this.createConfetti(raffleElement);

      // Видаляємо класи через 2 секунди
      setTimeout(() => {
        raffleElement.classList.remove('success-pulse');
      }, 2000);
    },

    // Створення ефекту конфетті
    createConfetti: function (targetElement) {
      // Обмеження для слабких пристроїв
      if (this.state.devicePerformance === 'low') return;

      const confettiCount = this.state.devicePerformance === 'high' ? 50 : 30;
      const confettiColors = ['#4eb5f7', '#00c9a7', '#ffcc00', '#ff6b6b', '#8a2be2'];

      // Отримуємо позицію і розміри елемента
      const rect = targetElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Створюємо контейнер для конфетті
      const confettiContainer = document.createElement('div');
      confettiContainer.style.position = 'fixed';
      confettiContainer.style.top = '0';
      confettiContainer.style.left = '0';
      confettiContainer.style.width = '100%';
      confettiContainer.style.height = '100%';
      confettiContainer.style.pointerEvents = 'none';
      confettiContainer.style.zIndex = '9999';
      document.body.appendChild(confettiContainer);

      // Створюємо конфетті
      for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        const size = Math.random() * 8 + 4;

        confetti.style.position = 'absolute';
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor =
          confettiColors[Math.floor(Math.random() * confettiColors.length)];
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.opacity = Math.random() * 0.8 + 0.2;
        confetti.style.top = `${centerY}px`;
        confetti.style.left = `${centerX}px`;

        // Рандомне обертання
        const rotation = Math.random() * 360;
        confetti.style.transform = `rotate(${rotation}deg)`;

        // Рандомна анімація
        const duration = Math.random() * 1 + 1;
        const distance = Math.random() * 150 + 50;
        const angle = Math.random() * 360 * (Math.PI / 180);
        const velocityX = Math.cos(angle) * distance;
        const velocityY = Math.sin(angle) * distance;

        confetti.animate(
          [
            { transform: `translate(0, 0) rotate(${rotation}deg)` },
            {
              transform: `translate(${velocityX}px, ${velocityY}px) rotate(${rotation + 360}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: duration * 1000,
            easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
            fill: 'forwards',
          }
        );

        confettiContainer.appendChild(confetti);
      }

      // Видаляємо контейнер після завершення анімації
      setTimeout(() => {
        document.body.removeChild(confettiContainer);
      }, 2000);
    },

    // Застосування преміальних ефектів до всіх елементів
    applyPremiumEffects: function () {
      // Анімуємо прогрес-бар
      document.querySelectorAll('.progress-bar .progress').forEach((progress) => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              progress.style.transition = 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
              observer.unobserve(entry.target);
            }
          });
        });
        observer.observe(progress);
      });

      // Анімуємо кнопки участі
      document.querySelectorAll('.join-button, .mini-raffle-button').forEach((button) => {
        button.addEventListener('mouseenter', () => {
          this.animateButtonHover(button);
        });
      });

      // Анімуємо зворотній відлік
      this.setupCountdownAnimation();
    },

    // Анімація наведення на кнопку
    animateButtonHover: function (button) {
      if (!this.config.enabled || this.state.devicePerformance === 'low') return;

      // Додаємо ефект світіння
      button.style.boxShadow = '0 0 10px rgba(0, 201, 167, 0.5)';

      // Видаляємо ефект через 500мс
      setTimeout(() => {
        button.style.boxShadow = '';
      }, 500);
    },

    // Налаштування анімації зворотнього відліку
    setupCountdownAnimation: function () {
      // Знаходимо всі елементи таймерів
      document.querySelectorAll('.timer-value').forEach((timerValue) => {
        // Створюємо MutationObserver для відстеження змін тексту
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              const value = parseInt(timerValue.textContent);

              // Якщо значення таймера менше 10, додаємо червоний колір
              if (!isNaN(value) && value <= 10) {
                timerValue.classList.add('countdown-ending');
              } else {
                timerValue.classList.remove('countdown-ending');
              }
            }
          });
        });

        // Спостерігаємо за змінами в тексті
        observer.observe(timerValue, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });
    },

    // Допоміжна функція для відкладеного виконання (debounce)
    debounce: function (func, wait) {
      let timeout;
      return function () {
        const context = this,
          args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    },
  };

  // Додаємо модуль анімацій до основного модуля розіграшів
  window.WinixRaffles.animations = RafflesAnimations;

  // Ініціалізація модуля при завантаженні сторінки
  document.addEventListener('DOMContentLoaded', function () {
    if (window.WinixRaffles.state.isInitialized) {
      // Якщо WinixRaffles вже ініціалізовано
      setTimeout(() => {
        RafflesAnimations.init();
      }, 300);
    } else {
      // Додаємо обробник події ініціалізації
      document.addEventListener('winix-raffles-initialized', () => {
        setTimeout(() => {
          RafflesAnimations.init();
        }, 300);
      });
    }
  });

  // Експортуємо публічні методи
  return RafflesAnimations;
})();
