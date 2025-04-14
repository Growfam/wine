/**
 * animations.js - Модуль анімацій для системи розіграшів WINIX
 * Забезпечує плавні, преміальні анімації для всіх елементів інтерфейсу
 * @version 1.0.0
 */

import WinixRaffles from './globals.js';
import { CONFIG } from './config.js';

// Основний клас анімацій
class WinixAnimations {
  constructor() {
    this.initialized = false;
    this.animation = {
      duration: {
        ultraFast: 150,
        fast: 300,
        normal: 500,
        slow: 800,
        ultraSlow: 1200
      },
      timing: {
        linear: 'linear',
        ease: 'ease',
        easeIn: 'ease-in',
        easeOut: 'ease-out',
        easeInOut: 'ease-in-out',
        elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        premium: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      }
    };

    // Спостерігач за появою елементів у вьюпорті
    this.intersectionObserver = null;

    // Список анімацій, які виконуються зараз
    this.activeAnimations = new Set();

    // Кеш для збереження стану анімацій
    this.animationStates = new Map();

    // Налаштування для різних типів елементів
    this.elementSettings = {
      // Налаштування для карток розіграшів
      raffleCard: {
        entranceAnimation: 'fadeInUp',
        hoverAnimation: 'raffleCardHover',
        exitAnimation: 'fadeOutDown',
        duration: 'normal'
      },
      // Налаштування для кнопок
      button: {
        clickAnimation: 'buttonClick',
        hoverAnimation: 'buttonHover',
        duration: 'fast'
      },
      // Налаштування для модальних вікон
      modal: {
        entranceAnimation: 'modalEnter',
        exitAnimation: 'modalExit',
        duration: 'normal'
      },
      // Налаштування для статистики
      stats: {
        entranceAnimation: 'fadeInScale',
        updateAnimation: 'pulseUpdate',
        duration: 'slow'
      },
      // Налаштування для повідомлень
      toast: {
        entranceAnimation: 'slideInTop',
        exitAnimation: 'slideOutTop',
        duration: 'fast'
      },
      // Налаштування для таймера зворотного відліку
      timer: {
        updateAnimation: 'timerUpdate',
        duration: 'ultraFast'
      },
      // Налаштування для прогрес-бару
      progressBar: {
        updateAnimation: 'progressUpdate',
        duration: 'slow'
      },
      // Налаштування для елементів історії
      historyItem: {
        entranceAnimation: 'fadeInRight',
        hoverAnimation: 'historyItemHover',
        duration: 'normal'
      },
      // Налаштування для секцій
      section: {
        entranceAnimation: 'fadeIn',
        exitAnimation: 'fadeOut',
        duration: 'normal'
      },
      // Налаштування для нагород/призів
      prizeReveal: {
        animation: 'prizeReveal',
        duration: 'ultraSlow'
      }
    };
  }

  /**
   * Ініціалізація модуля анімацій
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      WinixRaffles.logger.warn("Модуль анімацій вже ініціалізовано");
      return Promise.resolve();
    }

    try {
      WinixRaffles.logger.log("Ініціалізація модуля анімацій...");

      // Створення та налаштування IntersectionObserver для анімацій при прокручуванні
      this.setupIntersectionObserver();

      // Додавання слухачів подій для різних елементів інтерфейсу
      this.setupEventListeners();

      // Ініціалізація CSS-анімацій та змінних
      this.initializeAnimationStyles();

      // Додавання анімацій до прелоадера
      this.enhancePreloader();

      // Підписка на події системи розіграшів
      this.subscribeToEvents();

      // Визначаємо чи підтримуються складні анімації браузером
      this.detectAnimationSupport();

      this.initialized = true;
      WinixRaffles.logger.log("Модуль анімацій успішно ініціалізовано");
      return Promise.resolve();
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації модуля анімацій:", error);
      return Promise.reject(error);
    }
  }

  /**
   * Виявлення підтримки анімацій в браузері
   */
  detectAnimationSupport() {
    // Перевірка підтримки анімацій через requestAnimationFrame
    this.hasAnimationSupport = typeof window.requestAnimationFrame === 'function';

    // Перевірка підтримки Web Animations API
    this.hasWebAnimationsSupport = typeof document.createElement('div').animate === 'function';

    // Визначаємо префікс для CSS-анімацій (якщо потрібно)
    const el = document.createElement('div');
    this.animationPrefix = '';

    if (el.style.animation !== undefined) {
      this.animationPrefix = '';
    } else if (el.style.webkitAnimation !== undefined) {
      this.animationPrefix = '-webkit-';
    }

    // Зберігаємо інформацію про рівень підтримки
    this.supportLevel = this.hasWebAnimationsSupport ? 'high' : (this.hasAnimationSupport ? 'medium' : 'basic');

    WinixRaffles.logger.debug(`Рівень підтримки анімацій: ${this.supportLevel}`);
  }

  /**
   * Налаштування IntersectionObserver для анімацій елементів при прокручуванні
   */
  setupIntersectionObserver() {
    const options = {
      root: null, // використовуємо вьюпорт як root
      rootMargin: '0px',
      threshold: 0.1 // запускаємо, коли 10% елемента видно
    };

    this.intersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const animationType = element.dataset.animateIn || 'fadeIn';
          const animationDelay = parseInt(element.dataset.animationDelay || '0', 10);

          // Анімуємо елемент, коли він з'являється у видимій області
          setTimeout(() => {
            this.animateElement(element, animationType);
            element.classList.add('animated');

            // Якщо анімація має виконуватися тільки один раз, відписуємося
            if (element.dataset.animateOnce === 'true') {
              observer.unobserve(element);
            }
          }, animationDelay);
        } else if (element.dataset.animateOut) {
          // Якщо елемент залишає зону видимості і має анімацію виходу
          const animationType = element.dataset.animateOut;
          this.animateElement(element, animationType);
          element.classList.remove('animated');
        }
      });
    }, options);

    // Знаходимо елементи, які мають атрибут data-animate-in
    document.querySelectorAll('[data-animate-in]').forEach(element => {
      this.intersectionObserver.observe(element);
    });
  }

  /**
   * Додавання слухачів подій для анімацій інтерфейсу
   */
  setupEventListeners() {
    // Анімації при наведенні на кнопки
    document.querySelectorAll('.join-button, .mini-raffle-button, .share-button, .all-button').forEach(button => {
      button.addEventListener('mouseenter', () => this.animateButtonHover(button, 'enter'));
      button.addEventListener('mouseleave', () => this.animateButtonHover(button, 'leave'));
      button.addEventListener('click', () => this.animateButtonClick(button));
    });

    // Анімації при наведенні на картки розіграшів
    document.querySelectorAll('.main-raffle, .mini-raffle, .history-card').forEach(card => {
      card.addEventListener('mouseenter', () => this.animateCardHover(card, 'enter'));
      card.addEventListener('mouseleave', () => this.animateCardHover(card, 'leave'));
    });

    // Слухачі для модальних вікон
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        const modalElement = e.target.closest('.raffle-modal');
        if (modalElement) {
          this.animateModalClose(modalElement);
        }
      });
    });

    // Додавання слухачів для вкладок
    document.querySelectorAll('.tab-button').forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Отримаємо цільову вкладку
        const targetTab = e.target.dataset.tab;
        if (targetTab) {
          this.animateTabChange(targetTab);
        }
      });
    });

    // Анімація при наведенні на статистику
    document.querySelectorAll('.stat-card').forEach(statCard => {
      statCard.addEventListener('mouseenter', () => this.animateStat(statCard, 'enter'));
      statCard.addEventListener('mouseleave', () => this.animateStat(statCard, 'leave'));
    });
  }

  /**
   * Додавання слухачів на події системи
   */
  subscribeToEvents() {
    // Обробка події оновлення активних розіграшів
    WinixRaffles.events.on('active-raffles-updated', () => {
      this.animateContentUpdate('.main-raffle, .mini-raffle');
    });

    // Обробка події оновлення історії
    WinixRaffles.events.on('raffles-history-updated', () => {
      this.animateContentUpdate('#history-container .history-card');
    });

    // Обробка події оновлення статистики
    WinixRaffles.events.on('stats-updated', () => {
      this.animateStatsUpdate();
    });

    // Обробка події зміни мережевого статусу
    WinixRaffles.events.on('network-status-changed', (data) => {
      this.animateNetworkStatusChange(data.online);
    });

    // Обробка події показу модального вікна
    WinixRaffles.events.on('modal-shown', (data) => {
      const modalElement = document.getElementById(data.modalId);
      if (modalElement) {
        this.animateModalOpen(modalElement);
      }
    });

    // Обробка події показу повідомлення
    WinixRaffles.events.on('toast-shown', (data) => {
      this.animateToast(data.type);
    });
  }

  /**
   * Ініціалізація базових стилів анімацій
   */
  initializeAnimationStyles() {
    // Створюємо елемент <style> для кастомних анімацій
    const styleElement = document.createElement('style');
    styleElement.id = 'winix-animations-styles';

    // Додаємо основні анімації через keyframes
    styleElement.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      @keyframes fadeInUp {
        from { 
          opacity: 0;
          transform: translateY(30px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes fadeOutDown {
        from { 
          opacity: 1;
          transform: translateY(0);
        }
        to { 
          opacity: 0;
          transform: translateY(30px);
        }
      }
      
      @keyframes fadeInRight {
        from { 
          opacity: 0;
          transform: translateX(-30px);
        }
        to { 
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes fadeInLeft {
        from { 
          opacity: 0;
          transform: translateX(30px);
        }
        to { 
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes fadeInScale {
        from { 
          opacity: 0;
          transform: scale(0.8);
        }
        to { 
          opacity: 1;
          transform: scale(1);
        }
      }
      
      @keyframes pulseEffect {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
      
      @keyframes floatAnimation {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes rotateGlow {
        0% {
          box-shadow: 0 0 8px rgba(0, 201, 167, 0.5);
        }
        50% {
          box-shadow: 0 0 20px rgba(0, 201, 167, 0.8);
        }
        100% {
          box-shadow: 0 0 8px rgba(0, 201, 167, 0.5);
        }
      }
      
      @keyframes slideInTop {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutTop {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-100%);
          opacity: 0;
        }
      }
      
      @keyframes timerFlip {
        0% {
          transform: rotateX(0);
        }
        50% {
          transform: rotateX(90deg);
        }
        100% {
          transform: rotateX(0);
        }
      }
      
      @keyframes modalEnter {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      @keyframes modalExit {
        from {
          opacity: 1;
          transform: scale(1);
        }
        to {
          opacity: 0;
          transform: scale(0.9);
        }
      }
      
      @keyframes buttonClick {
        0% { transform: scale(1); }
        50% { transform: scale(0.95); }
        100% { transform: scale(1); }
      }
      
      @keyframes buttonHover {
        0% { transform: translateY(0); }
        100% { transform: translateY(-3px); }
      }
      
      @keyframes prizeReveal {
        0% {
          opacity: 0;
          transform: scale(0.5) rotate(-10deg);
        }
        60% {
          transform: scale(1.1) rotate(5deg);
        }
        80% {
          transform: scale(0.95) rotate(-2deg);
        }
        100% {
          opacity: 1;
          transform: scale(1) rotate(0);
        }
      }
      
      @keyframes progressLoading {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      
      @keyframes cardLift {
        0% { transform: translateY(0); }
        100% { transform: translateY(-5px); }
      }
      
      @keyframes glowPulse {
        0% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.5); }
        50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.8), 0 0 30px rgba(0, 201, 167, 0.4); }
        100% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.5); }
      }
      
      @keyframes gradientTransition {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      
      /* Клас для анімації появи елементів */
      .animate-in {
        opacity: 0;
      }
      
      .animate-in.animated {
        animation: fadeIn 0.5s forwards;
      }
      
      /* Преміальний ефект світіння для елементів з класом premium-glow */
      .premium-glow {
        animation: glowPulse 3s infinite;
        transition: all 0.3s ease;
      }
      
      /* Анімація для градієнтних кнопок */
      .join-button, .mini-raffle-button, .all-button {
        background-size: 200% auto;
        transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .join-button:hover, .mini-raffle-button:hover, .all-button:hover {
        background-position: right center;
        transform: translateY(-3px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
      }
      
      /* Поліпшена анімація для таймера */
      .timer-value {
        position: relative;
        transform-style: preserve-3d;
        perspective: 300px;
      }
      
      .timer-value.flip {
        animation: timerFlip 0.6s;
      }
      
      /* Плавна анімація для модальних вікон */
      .raffle-modal .modal-content {
        transform-origin: center bottom;
        transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
                    opacity 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      /* Анімація фокусу для полів вводу */
      .token-input {
        transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .token-input:focus {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      }
      
      /* Анімація для прогрес-бару */
      .progress {
        background-size: 400% 400%;
        animation: progressLoading 3s ease infinite;
      }
      
      /* Анімація для наведення на картки історії */
      .history-card {
        transform-origin: center;
        transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .history-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
      }
      
      /* Анімація для елементів статистики */
      .stat-card {
        transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .stat-card:hover {
        transform: translateY(-5px) scale(1.03);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
      }
      
      /* Анімація для оповіщень */
      #toast-message {
        transform-origin: top center;
        transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      /* Анімація для значків "нове" */
      .new-badge {
        transform-origin: center;
        animation: pulseEffect 2s infinite ease-in-out;
      }
      
      /* Анімація для заголовка WINIX */
      .winix-title {
        background-size: 200% 200%;
        animation: gradientTransition 15s ease infinite;
      }
      
      /* Анімація для навігаційних елементів */
      .nav-item {
        transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .nav-item:hover .icon-wrapper {
        transform: translateY(-5px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      }
      
      /* Анімація для переможців */
      .winner-item {
        transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .winner-item:hover {
        transform: translateX(5px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      }
    `;

    // Додаємо стилі до заголовка документа
    document.head.appendChild(styleElement);

    WinixRaffles.logger.debug("Кастомні анімації CSS ініціалізовано");
  }

  /**
   * Поліпшення прелоадера додатковими анімаціями
   */
  enhancePreloader() {
    const preloader = document.querySelector('.initial-loader');
    if (!preloader) return;

    // Створюємо елемент для частинок
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-container';
    particlesContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      pointer-events: none;
    `;

    // Додаємо анімовані частинки
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      const size = Math.random() * 5 + 2;
      const duration = Math.random() * 3 + 2;
      const delay = Math.random() * 2;

      particle.style.cssText = `
        position: absolute;
        background: rgba(0, 201, 167, ${Math.random() * 0.7 + 0.3});
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        animation: floatParticle ${duration}s ${delay}s infinite ease-in-out;
        opacity: ${Math.random() * 0.7 + 0.3};
      `;

      particlesContainer.appendChild(particle);
    }

    // Додаємо стиль для анімації частинок
    const particleStyle = document.createElement('style');
    particleStyle.textContent = `
      @keyframes floatParticle {
        0%, 100% {
          transform: translate(0, 0);
        }
        25% {
          transform: translate(${Math.random() * 40 - 20}px, ${Math.random() * 40 - 20}px);
        }
        50% {
          transform: translate(${Math.random() * 40 - 20}px, ${Math.random() * 40 - 20}px);
        }
        75% {
          transform: translate(${Math.random() * 40 - 20}px, ${Math.random() * 40 - 20}px);
        }
      }
    `;
    document.head.appendChild(particleStyle);

    // Додаємо контейнер з частинками до прелоадера
    preloader.appendChild(particlesContainer);

    // Поліпшуємо анімацію спінера
    const spinner = preloader.querySelector('.initial-spinner');
    if (spinner) {
      spinner.style.cssText += `
        box-shadow: 0 0 15px rgba(0, 201, 167, 0.5);
        animation: initialSpin 1s linear infinite, glowPulse 2s infinite;
      `;
    }

    // Додаємо пульсацію до тексту
    const textElement = preloader.querySelector('p');
    if (textElement) {
      textElement.style.cssText += `
        animation: pulseText 2s infinite ease-in-out;
      `;
    }

    // Додаємо стиль для анімації тексту
    const textStyle = document.createElement('style');
    textStyle.textContent = `
      @keyframes pulseText {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(textStyle);

    WinixRaffles.logger.debug("Прелоадер поліпшено з преміальними анімаціями");
  }

  /**
   * Анімація елемента за типом
   * @param {HTMLElement} element - Елемент для анімації
   * @param {string} animationType - Тип анімації
   * @returns {Animation|null} - Створена анімація, або null
   */
  animateElement(element, animationType) {
    if (!element || !this.hasAnimationSupport) return null;

    let animation = null;

    // Якщо доступний Web Animations API, використовуємо його
    if (this.hasWebAnimationsSupport) {
      let keyframes = [];
      let options = {
        duration: this.animation.duration.normal,
        easing: this.animation.timing.premium,
        fill: 'forwards'
      };

      // Налаштування параметрів анімації за типом
      switch (animationType) {
        case 'fadeIn':
          keyframes = [
            { opacity: 0 },
            { opacity: 1 }
          ];
          break;
        case 'fadeOut':
          keyframes = [
            { opacity: 1 },
            { opacity: 0 }
          ];
          break;
        case 'fadeInUp':
          keyframes = [
            { opacity: 0, transform: 'translateY(30px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ];
          break;
        case 'fadeOutDown':
          keyframes = [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(30px)' }
          ];
          break;
        case 'fadeInScale':
          keyframes = [
            { opacity: 0, transform: 'scale(0.8)' },
            { opacity: 1, transform: 'scale(1)' }
          ];
          break;
        case 'modalEnter':
          keyframes = [
            { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
            { opacity: 1, transform: 'scale(1) translateY(0)' }
          ];
          options.easing = this.animation.timing.bounce;
          break;
        case 'modalExit':
          keyframes = [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.9)' }
          ];
          break;
        case 'slideInTop':
          keyframes = [
            { transform: 'translateY(-100%)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
          ];
          break;
        case 'slideOutTop':
          keyframes = [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-100%)', opacity: 0 }
          ];
          break;
        case 'pulseEffect':
          keyframes = [
            { transform: 'scale(1)' },
            { transform: 'scale(1.05)' },
            { transform: 'scale(1)' }
          ];
          options.iterations = 1;
          break;
        case 'buttonClick':
          keyframes = [
            { transform: 'scale(1)' },
            { transform: 'scale(0.95)' },
            { transform: 'scale(1)' }
          ];
          options.duration = this.animation.duration.fast;
          break;
        case 'prizeReveal':
          keyframes = [
            { opacity: 0, transform: 'scale(0.5) rotate(-10deg)' },
            { opacity: 1, transform: 'scale(1.1) rotate(5deg)', offset: 0.6 },
            { transform: 'scale(0.95) rotate(-2deg)', offset: 0.8 },
            { opacity: 1, transform: 'scale(1) rotate(0)' }
          ];
          options.duration = this.animation.duration.ultraSlow;
          break;
        default:
          return null;
      }

      // Виконуємо анімацію
      animation = element.animate(keyframes, options);

      // Зберігаємо анімацію для можливості подальшого керування
      this.activeAnimations.add(animation);

      // Видаляємо посилання на анімацію після завершення
      animation.onfinish = () => {
        this.activeAnimations.delete(animation);
      };

      return animation;
    } else {
      // Запасний варіант з класами CSS
      const animationClass = `animation-${animationType}`;
      const animationDuration = `${this.animation.duration.normal}ms`;

      element.style.animationDuration = animationDuration;
      element.classList.add(animationClass);

      // Видаляємо клас після завершення анімації
      setTimeout(() => {
        element.classList.remove(animationClass);
      }, this.animation.duration.normal);

      return null;
    }
  }

  /**
   * Анімація при наведенні на кнопку
   * @param {HTMLElement} button - Кнопка
   * @param {string} state - Стан наведення ('enter' або 'leave')
   */
  animateButtonHover(button, state) {
    if (!button) return;

    if (state === 'enter') {
      if (this.hasWebAnimationsSupport) {
        const animation = button.animate([
          { transform: 'translateY(0)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' },
          { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(0, 0, 0, 0.4)' }
        ], {
          duration: this.animation.duration.fast,
          easing: this.animation.timing.premium,
          fill: 'forwards'
        });

        this.activeAnimations.add(animation);

        animation.onfinish = () => {
          this.activeAnimations.delete(animation);
          button.style.transform = 'translateY(-3px)';
          button.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.4)';
        };
      } else {
        button.style.transform = 'translateY(-3px)';
        button.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.4)';
      }
    } else {
      if (this.hasWebAnimationsSupport) {
        const animation = button.animate([
          { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(0, 0, 0, 0.4)' },
          { transform: 'translateY(0)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }
        ], {
          duration: this.animation.duration.fast,
          easing: this.animation.timing.premium,
          fill: 'forwards'
        });

        this.activeAnimations.add(animation);

        animation.onfinish = () => {
          this.activeAnimations.delete(animation);
          button.style.transform = '';
          button.style.boxShadow = '';
        };
      } else {
        button.style.transform = '';
        button.style.boxShadow = '';
      }
    }
  }

  /**
   * Анімація при натисканні на кнопку
   * @param {HTMLElement} button - Кнопка
   */
  animateButtonClick(button) {
    if (!button) return;

    if (this.hasWebAnimationsSupport) {
      const animation = button.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.95)' },
        { transform: 'scale(1)' }
      ], {
        duration: this.animation.duration.fast,
        easing: this.animation.timing.bounce
      });

      this.activeAnimations.add(animation);

      animation.onfinish = () => {
        this.activeAnimations.delete(animation);
      };
    } else {
      button.classList.add('button-click');

      setTimeout(() => {
        button.classList.remove('button-click');
      }, this.animation.duration.fast);
    }
  }

  /**
   * Анімація при наведенні на картку розіграшу
   * @param {HTMLElement} card - Картка розіграшу
   * @param {string} state - Стан наведення ('enter' або 'leave')
   */
  animateCardHover(card, state) {
    if (!card) return;

    if (state === 'enter') {
      if (this.hasWebAnimationsSupport) {
        const animation = card.animate([
          { transform: 'translateY(0)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)' },
          { transform: 'translateY(-5px)', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)' }
        ], {
          duration: this.animation.duration.normal,
          easing: this.animation.timing.premium,
          fill: 'forwards'
        });

        this.activeAnimations.add(animation);

        animation.onfinish = () => {
          this.activeAnimations.delete(animation);
          card.style.transform = 'translateY(-5px)';
          card.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.4)';
        };
      } else {
        card.style.transform = 'translateY(-5px)';
        card.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.4)';
      }

      // Анімуємо дочірні елементи
      const viewDetailsHint = card.querySelector('.view-details-hint');
      if (viewDetailsHint) {
        viewDetailsHint.style.opacity = '1';
      }
    } else {
      if (this.hasWebAnimationsSupport) {
        const animation = card.animate([
          { transform: 'translateY(-5px)', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)' },
          { transform: 'translateY(0)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)' }
        ], {
          duration: this.animation.duration.normal,
          easing: this.animation.timing.premium,
          fill: 'forwards'
        });

        this.activeAnimations.add(animation);

        animation.onfinish = () => {
          this.activeAnimations.delete(animation);
          card.style.transform = '';
          card.style.boxShadow = '';
        };
      } else {
        card.style.transform = '';
        card.style.boxShadow = '';
      }

      // Анімуємо дочірні елементи
      const viewDetailsHint = card.querySelector('.view-details-hint');
      if (viewDetailsHint) {
        viewDetailsHint.style.opacity = '0';
      }
    }
  }

  /**
   * Анімація при наведенні на елемент статистики
   * @param {HTMLElement} statCard - Елемент статистики
   * @param {string} state - Стан наведення ('enter' або 'leave')
   */
  animateStat(statCard, state) {
    if (!statCard) return;

    const statValue = statCard.querySelector('.stat-value');

    if (state === 'enter') {
      if (this.hasWebAnimationsSupport) {
        const cardAnimation = statCard.animate([
          { transform: 'translateY(0)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' },
          { transform: 'translateY(-5px) scale(1.03)', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)' }
        ], {
          duration: this.animation.duration.normal,
          easing: this.animation.timing.premium,
          fill: 'forwards'
        });

        this.activeAnimations.add(cardAnimation);

        cardAnimation.onfinish = () => {
          this.activeAnimations.delete(cardAnimation);
          statCard.style.transform = 'translateY(-5px) scale(1.03)';
          statCard.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.4)';
        };

        if (statValue) {
          const valueAnimation = statValue.animate([
            { color: 'var(--premium-color)' },
            { color: '#00e8c7' }
          ], {
            duration: this.animation.duration.normal,
            easing: this.animation.timing.premium,
            fill: 'forwards'
          });

          this.activeAnimations.add(valueAnimation);

          valueAnimation.onfinish = () => {
            this.activeAnimations.delete(valueAnimation);
            statValue.style.color = '#00e8c7';
          };
        }
      } else {
        statCard.style.transform = 'translateY(-5px) scale(1.03)';
        statCard.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.4)';

        if (statValue) {
          statValue.style.color = '#00e8c7';
        }
      }
    } else {
      if (this.hasWebAnimationsSupport) {
        const cardAnimation = statCard.animate([
          { transform: 'translateY(-5px) scale(1.03)', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)' },
          { transform: 'translateY(0)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }
        ], {
          duration: this.animation.duration.normal,
          easing: this.animation.timing.premium,
          fill: 'forwards'
        });

        this.activeAnimations.add(cardAnimation);

        cardAnimation.onfinish = () => {
          this.activeAnimations.delete(cardAnimation);
          statCard.style.transform = '';
          statCard.style.boxShadow = '';
        };

        if (statValue) {
          const valueAnimation = statValue.animate([
            { color: '#00e8c7' },
            { color: 'var(--premium-color)' }
          ], {
            duration: this.animation.duration.normal,
            easing: this.animation.timing.premium,
            fill: 'forwards'
          });

          this.activeAnimations.add(valueAnimation);

          valueAnimation.onfinish = () => {
            this.activeAnimations.delete(valueAnimation);
            statValue.style.color = '';
          };
        }
      } else {
        statCard.style.transform = '';
        statCard.style.boxShadow = '';

        if (statValue) {
          statValue.style.color = '';
        }
      }
    }
  }

  /**
   * Анімація при відкритті модального вікна
   * @param {HTMLElement} modal - Модальне вікно
   */
  animateModalOpen(modal) {
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');

    if (!modalContent) return;

    modal.style.display = 'flex';

    if (this.hasWebAnimationsSupport) {
      // Анімація фону
      const backgroundAnimation = modal.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], {
        duration: this.animation.duration.normal,
        easing: this.animation.timing.easeOut
      });

      this.activeAnimations.add(backgroundAnimation);

      backgroundAnimation.onfinish = () => {
        this.activeAnimations.delete(backgroundAnimation);
      };

      // Анімація контенту
      const contentAnimation = modalContent.animate([
        { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' }
      ], {
        duration: this.animation.duration.normal,
        easing: this.animation.timing.bounce
      });

      this.activeAnimations.add(contentAnimation);

      contentAnimation.onfinish = () => {
        this.activeAnimations.delete(contentAnimation);
      };
    } else {
      modalContent.classList.add('modal-enter');

      setTimeout(() => {
        modalContent.classList.remove('modal-enter');
      }, this.animation.duration.normal);
    }

    modal.classList.add('open');
  }

  /**
   * Анімація при закритті модального вікна
   * @param {HTMLElement} modal - Модальне вікно
   */
  animateModalClose(modal) {
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');

    if (!modalContent) {
      modal.classList.remove('open');
      return;
    }

    if (this.hasWebAnimationsSupport) {
      // Анімація фону
      const backgroundAnimation = modal.animate([
        { opacity: 1 },
        { opacity: 0 }
      ], {
        duration: this.animation.duration.normal,
        easing: this.animation.timing.easeOut
      });

      this.activeAnimations.add(backgroundAnimation);

      // Анімація контенту
      const contentAnimation = modalContent.animate([
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.9)' }
      ], {
        duration: this.animation.duration.normal,
        easing: this.animation.timing.easeInOut
      });

      this.activeAnimations.add(contentAnimation);

      contentAnimation.onfinish = () => {
        this.activeAnimations.delete(contentAnimation);
        this.activeAnimations.delete(backgroundAnimation);

        modal.classList.remove('open');
        modal.style.display = 'none';
      };
    } else {
      modalContent.classList.add('modal-exit');

      setTimeout(() => {
        modal.classList.remove('open');
        modal.style.display = 'none';
        modalContent.classList.remove('modal-exit');
      }, this.animation.duration.normal);
    }
  }

  /**
   * Анімація при зміні вкладки
   * @param {string} tabName - Назва вкладки
   */
  animateTabChange(tabName) {
    const oldTabContent = document.querySelector('.tab-content.active');
    const newTabContent = document.getElementById(`${tabName}-raffles`);

    if (!oldTabContent || !newTabContent) return;

    if (this.hasWebAnimationsSupport) {
      // Анімація виходу для старої вкладки
      const exitAnimation = oldTabContent.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: 'translateX(-20px)' }
      ], {
        duration: this.animation.duration.fast,
        easing: this.animation.timing.easeInOut
      });

      this.activeAnimations.add(exitAnimation);

      exitAnimation.onfinish = () => {
        this.activeAnimations.delete(exitAnimation);

        oldTabContent.classList.remove('active');
        newTabContent.classList.add('active');

        // Анімація входу для нової вкладки
        const enterAnimation = newTabContent.animate([
          { opacity: 0, transform: 'translateX(20px)' },
          { opacity: 1, transform: 'translateX(0)' }
        ], {
          duration: this.animation.duration.fast,
          easing: this.animation.timing.premium
        });

        this.activeAnimations.add(enterAnimation);

        enterAnimation.onfinish = () => {
          this.activeAnimations.delete(enterAnimation);
        };
      };
    } else {
      oldTabContent.classList.remove('active');
      newTabContent.classList.add('active');

      newTabContent.style.animation = 'fadeIn 0.5s';

      setTimeout(() => {
        newTabContent.style.animation = '';
      }, this.animation.duration.normal);
    }
  }

  /**
   * Анімація повідомлення (toast)
   * @param {string} type - Тип повідомлення
   */
  animateToast(type) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;

    toast.className = 'toast-message';
    if (type) {
      toast.classList.add(type);
    }

    if (this.hasWebAnimationsSupport) {
      const animation = toast.animate([
        { opacity: 0, transform: 'translateY(-20px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: this.animation.duration.fast,
        easing: this.animation.timing.bounce
      });

      this.activeAnimations.add(animation);

      animation.onfinish = () => {
        this.activeAnimations.delete(animation);

        // Анімація зникнення через затримку
        setTimeout(() => {
          const exitAnimation = toast.animate([
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-20px)' }
          ], {
            duration: this.animation.duration.fast,
            easing: this.animation.timing.easeInOut
          });

          this.activeAnimations.add(exitAnimation);

          exitAnimation.onfinish = () => {
            this.activeAnimations.delete(exitAnimation);
            toast.classList.remove('show');
          };
        }, CONFIG.UI.TOAST_DURATION);
      };
    } else {
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
      }, CONFIG.UI.TOAST_DURATION);
    }
  }

  /**
   * Анімація оновлення контенту
   * @param {string} selector - Селектор елементів для анімації
   */
  animateContentUpdate(selector) {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;

    elements.forEach((element, index) => {
      setTimeout(() => {
        if (this.hasWebAnimationsSupport) {
          const animation = element.animate([
            { opacity: 0.7, transform: 'scale(0.98)' },
            { opacity: 1, transform: 'scale(1)' }
          ], {
            duration: this.animation.duration.fast,
            easing: this.animation.timing.premium
          });

          this.activeAnimations.add(animation);

          animation.onfinish = () => {
            this.activeAnimations.delete(animation);
          };
        } else {
          element.classList.add('content-update');

          setTimeout(() => {
            element.classList.remove('content-update');
          }, this.animation.duration.fast);
        }
      }, index * 50); // Поступова анімація елементів
    });
  }

  /**
   * Анімація оновлення статистики
   */
  animateStatsUpdate() {
    const statCards = document.querySelectorAll('.stat-card');
    if (!statCards.length) return;

    statCards.forEach((statCard, index) => {
      setTimeout(() => {
        const statValue = statCard.querySelector('.stat-value');

        if (this.hasWebAnimationsSupport) {
          // Анімація картки
          const cardAnimation = statCard.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.05)' },
            { transform: 'scale(1)' }
          ], {
            duration: this.animation.duration.normal,
            easing: this.animation.timing.elastic
          });

          this.activeAnimations.add(cardAnimation);

          cardAnimation.onfinish = () => {
            this.activeAnimations.delete(cardAnimation);
          };

          // Анімація значення, якщо воно є
          if (statValue) {
            const valueAnimation = statValue.animate([
              { color: 'var(--premium-color)', textShadow: '0 0 0 rgba(0, 201, 167, 0)' },
              { color: '#00e8c7', textShadow: '0 0 10px rgba(0, 201, 167, 0.5)' },
              { color: 'var(--premium-color)', textShadow: '0 0 0 rgba(0, 201, 167, 0)' }
            ], {
              duration: this.animation.duration.normal,
              easing: this.animation.timing.elastic
            });

            this.activeAnimations.add(valueAnimation);

            valueAnimation.onfinish = () => {
              this.activeAnimations.delete(valueAnimation);
            };
          }
        } else {
          statCard.classList.add('stat-update');

          if (statValue) {
            statValue.classList.add('value-update');
          }

          setTimeout(() => {
            statCard.classList.remove('stat-update');

            if (statValue) {
              statValue.classList.remove('value-update');
            }
          }, this.animation.duration.normal);
        }
      }, index * 100); // Поступова анімація елементів статистики
    });
  }

  /**
   * Анімація зміни статусу мережі
   * @param {boolean} isOnline - Чи онлайн
   */
  animateNetworkStatusChange(isOnline) {
    const offlineMessage = document.querySelector('.offline-message');

    if (isOnline) {
      if (offlineMessage) {
        if (this.hasWebAnimationsSupport) {
          const animation = offlineMessage.animate([
            { opacity: 1, height: offlineMessage.offsetHeight + 'px' },
            { opacity: 0, height: '0' }
          ], {
            duration: this.animation.duration.normal,
            easing: this.animation.timing.easeInOut
          });

          this.activeAnimations.add(animation);

          animation.onfinish = () => {
            this.activeAnimations.delete(animation);
            offlineMessage.remove();
          };
        } else {
          offlineMessage.style.opacity = '0';
          offlineMessage.style.height = '0';

          setTimeout(() => {
            offlineMessage.remove();
          }, this.animation.duration.normal);
        }
      }
    } else {
      // Якщо офлайн-повідомлення не існує, створюємо його
      if (!offlineMessage) {
        const container = document.querySelector('.raffles-container');
        if (!container) return;

        const newOfflineMessage = document.createElement('div');
        newOfflineMessage.className = 'offline-message';
        newOfflineMessage.innerHTML = `
          <div class="offline-message-icon">📶</div>
          <div class="offline-message-text">
            Ви перебуваєте в режимі офлайн.
            Показано кешовані дані. Деякі функції недоступні.
          </div>
        `;

        // Спочатку робимо елемент невидимим для анімації
        newOfflineMessage.style.opacity = '0';
        newOfflineMessage.style.height = '0';

        container.insertBefore(newOfflineMessage, container.firstChild);

        // Анімуємо появу
        if (this.hasWebAnimationsSupport) {
          const animation = newOfflineMessage.animate([
            { opacity: 0, height: '0' },
            { opacity: 1, height: '60px' } // Приблизна висота
          ], {
            duration: this.animation.duration.normal,
            easing: this.animation.timing.easeOut
          });

          this.activeAnimations.add(animation);

          animation.onfinish = () => {
            this.activeAnimations.delete(animation);
            newOfflineMessage.style.opacity = '1';
            newOfflineMessage.style.height = 'auto';
          };
        } else {
          setTimeout(() => {
            newOfflineMessage.style.opacity = '1';
            newOfflineMessage.style.height = 'auto';
          }, 10);
        }
      }
    }
  }

  /**
   * Анімація оновлення таймера
   * @param {HTMLElement} timerElement - Елемент таймера
   * @param {string} newValue - Нове значення
   */
  animateTimer(timerElement, newValue) {
    if (!timerElement) return;

    // Отримаємо поточне значення
    const currentValue = timerElement.textContent;

    // Якщо значення дійсно змінилося
    if (currentValue !== newValue) {
      if (this.hasWebAnimationsSupport) {
        const animation = timerElement.animate([
          { transform: 'rotateX(0deg)', opacity: 1 },
          { transform: 'rotateX(90deg)', opacity: 0, offset: 0.5 },
          { transform: 'rotateX(0deg)', opacity: 1 }
        ], {
          duration: this.animation.duration.fast,
          easing: this.animation.timing.premium
        });

        this.activeAnimations.add(animation);

        // Змінюємо значення в середині анімації
        setTimeout(() => {
          timerElement.textContent = newValue;
        }, this.animation.duration.fast / 2);

        animation.onfinish = () => {
          this.activeAnimations.delete(animation);
        };
      } else {
        timerElement.classList.add('flip');

        // Змінюємо значення в середині анімації
        setTimeout(() => {
          timerElement.textContent = newValue;
        }, this.animation.duration.fast / 2);

        setTimeout(() => {
          timerElement.classList.remove('flip');
        }, this.animation.duration.fast);
      }
    }
  }

  /**
   * Анімація прогрес-бару
   * @param {HTMLElement} progressBar - Елемент прогрес-бару
   * @param {number} fromPercent - Початковий відсоток
   * @param {number} toPercent - Кінцевий відсоток
   */
  animateProgress(progressBar, fromPercent, toPercent) {
    if (!progressBar) return;

    const progressElement = progressBar.querySelector('.progress');
    if (!progressElement) return;

    // Обмежуємо відсотки між 0 і 100
    fromPercent = Math.max(0, Math.min(100, fromPercent));
    toPercent = Math.max(0, Math.min(100, toPercent));

    // Якщо Web Animations API доступний
    if (this.hasWebAnimationsSupport) {
      const animation = progressElement.animate([
        { width: `${fromPercent}%` },
        { width: `${toPercent}%` }
      ], {
        duration: this.animation.duration.slow,
        easing: this.animation.timing.easeInOut
      });

      this.activeAnimations.add(animation);

      animation.onfinish = () => {
        this.activeAnimations.delete(animation);
        progressElement.style.width = `${toPercent}%`;
      };
    } else {
      progressElement.style.transition = `width ${this.animation.duration.slow}ms ${this.animation.timing.easeInOut}`;
      progressElement.style.width = `${toPercent}%`;
    }
  }

  /**
   * Додавання анімації "преміум світіння" до елемента
   * @param {HTMLElement} element - Елемент для анімації
   * @param {boolean} enabled - Увімкнути чи вимкнути
   */
  addPremiumGlow(element, enabled = true) {
    if (!element) return;

    if (enabled) {
      element.classList.add('premium-glow');
    } else {
      element.classList.remove('premium-glow');
    }
  }

  /**
   * Додавання анімації "плавання" до елемента
   * @param {HTMLElement} element - Елемент для анімації
   * @param {boolean} enabled - Увімкнути чи вимкнути
   */
  addFloatingAnimation(element, enabled = true) {
    if (!element) return;

    if (enabled) {
      if (this.hasWebAnimationsSupport) {
        const animation = element.animate([
          { transform: 'translateY(0px)' },
          { transform: 'translateY(-10px)' },
          { transform: 'translateY(0px)' }
        ], {
          duration: 3000,
          iterations: Infinity,
          easing: this.animation.timing.easeInOut
        });

        // Зберігаємо анімацію в елементі для можливості зупинки
        element._floatingAnimation = animation;
      } else {
        element.style.animation = 'floatAnimation 3s infinite ease-in-out';
      }
    } else {
      if (this.hasWebAnimationsSupport && element._floatingAnimation) {
        element._floatingAnimation.cancel();
        element._floatingAnimation = null;
      } else {
        element.style.animation = '';
      }
    }
  }

  /**
   * Анімована поява елемента
   * @param {HTMLElement} element - Елемент для анімації
   * @param {string} animationType - Тип анімації
   * @param {number} delay - Затримка анімації в мс
   */
  animateEntrance(element, animationType = 'fadeIn', delay = 0) {
    if (!element) return;

    // Приховуємо елемент спочатку
    element.style.opacity = '0';

    setTimeout(() => {
      this.animateElement(element, animationType);
    }, delay);
  }

  /**
   * Анімована поява для декількох елементів по черзі
   * @param {string} selector - CSS-селектор для елементів
   * @param {string} animationType - Тип анімації
   * @param {number} delayBetweenItems - Затримка між елементами в мс
   */
  animateEntranceSequence(selector, animationType = 'fadeIn', delayBetweenItems = 100) {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;

    elements.forEach((element, index) => {
      this.animateEntrance(element, animationType, index * delayBetweenItems);
    });
  }

  /**
   * Зупинка всіх активних анімацій
   */
  stopAllAnimations() {
    // Зупиняємо всі анімації з Web Animations API
    this.activeAnimations.forEach(animation => {
      animation.cancel();
    });

    this.activeAnimations.clear();

    // Також видаляємо CSS-анімації
    document.querySelectorAll('[class*="animation-"]').forEach(element => {
      element.className = element.className.replace(/\banimation-\S+\b/g, '');
    });

    WinixRaffles.logger.debug("Всі анімації зупинено");
  }

  /**
   * Знищення модуля анімацій
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this.initialized) {
      return Promise.resolve();
    }

    try {
      WinixRaffles.logger.log("Знищення модуля анімацій...");

      // Зупиняємо всі активні анімації
      this.stopAllAnimations();

      // Відписуємося від подій
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }

      // Видаляємо обробники подій
      document.querySelectorAll('.join-button, .mini-raffle-button, .share-button, .all-button').forEach(button => {
        button.removeEventListener('mouseenter', this.animateButtonHover);
        button.removeEventListener('mouseleave', this.animateButtonHover);
        button.removeEventListener('click', this.animateButtonClick);
      });

      document.querySelectorAll('.main-raffle, .mini-raffle, .history-card').forEach(card => {
        card.removeEventListener('mouseenter', this.animateCardHover);
        card.removeEventListener('mouseleave', this.animateCardHover);
      });

      // Видаляємо додані стилі
      const styleElement = document.getElementById('winix-animations-styles');
      if (styleElement) {
        styleElement.remove();
      }

      this.initialized = false;
      WinixRaffles.logger.log("Модуль анімацій успішно знищено");
      return Promise.resolve();
    } catch (error) {
      WinixRaffles.logger.error("Помилка знищення модуля анімацій:", error);
      return Promise.reject(error);
    }
  }
}

// Створюємо екземпляр класу анімацій
const animationsModule = new WinixAnimations();

// Реєструємо модуль анімацій у глобальній системі
WinixRaffles.registerModule('animations', {
  init: () => animationsModule.init(),
  destroy: () => animationsModule.destroy(),

  // Публічні методи для використання з інших модулів
  animateElement: (element, type) => animationsModule.animateElement(element, type),
  animateTimer: (element, newValue) => animationsModule.animateTimer(element, newValue),
  animateProgress: (progressBar, fromPercent, toPercent) =>
    animationsModule.animateProgress(progressBar, fromPercent, toPercent),
  animateModalOpen: (modal) => animationsModule.animateModalOpen(modal),
  animateModalClose: (modal) => animationsModule.animateModalClose(modal),
  addPremiumGlow: (element, enabled) => animationsModule.addPremiumGlow(element, enabled),
  addFloatingAnimation: (element, enabled) => animationsModule.addFloatingAnimation(element, enabled),
  animateEntrance: (element, type, delay) => animationsModule.animateEntrance(element, type, delay),
  animateEntranceSequence: (selector, type, delay) =>
    animationsModule.animateEntranceSequence(selector, type, delay),
  stopAllAnimations: () => animationsModule.stopAllAnimations()
});

export default animationsModule;