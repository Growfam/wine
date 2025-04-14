/**
 * WINIX - Система розіграшів (animations.js)
 * Модуль для анімацій та візуальних ефектів
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше animations.js');
        return;
    }

    // Підмодуль для анімацій
    const animations = {
        // Налаштування
        settings: {
            enableParticles: true,     // Частинки на заголовках вкладок
            enableFadeEffects: true,   // Ефекти плавної появи
            enablePulseEffects: true,  // Пульсуючі ефекти
            enableConfetti: true       // Конфетті при успішних діях
        },

        // Поточний стан
        state: {
            confettiActive: false,
            particlesContainers: []
        },

        // Ініціалізація модуля
        init: function() {
            console.log('✨ Ініціалізація модуля анімацій...');

            // Завантажуємо налаштування з localStorage
            this.loadSettings();

            // Ініціалізуємо анімації
            this.initAnimations();

            // Додаємо обробники подій
            this.setupEventListeners();
        },

        // Завантаження налаштувань
        loadSettings: function() {
            try {
                const savedSettings = localStorage.getItem('winix_animation_settings');
                if (savedSettings) {
                    const parsedSettings = JSON.parse(savedSettings);
                    // Об'єднуємо збережені налаштування з налаштуваннями за замовчуванням
                    this.settings = { ...this.settings, ...parsedSettings };
                }
            } catch (e) {
                console.warn('⚠️ Помилка завантаження налаштувань анімації:', e);
            }
        },

        // Збереження налаштувань
        saveSettings: function() {
            try {
                localStorage.setItem('winix_animation_settings', JSON.stringify(this.settings));
            } catch (e) {
                console.warn('⚠️ Помилка збереження налаштувань анімації:', e);
            }
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для перемикачів вкладок
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    // Анімуємо активну вкладку
                    const tabName = button.getAttribute('data-tab');
                    if (tabName) {
                        setTimeout(() => {
                            this.animateActiveTab(tabName);
                        }, 100);
                    }
                });
            });

            // Обробник для кнопок участі (для анімації конфетті при успіху)
            document.addEventListener('click', (e) => {
                if ((e.target.classList.contains('join-button') ||
                    e.target.classList.contains('mini-raffle-button')) &&
                    !e.target.classList.contains('participating') &&
                    !e.target.disabled) {

                    const raffleId = e.target.getAttribute('data-raffle-id');
                    const button = e.target;

                    // Анімуємо натискання
                    this.animateButtonPress(button);

                    // Додаємо обробник події успішної участі
                    const successHandler = (event) => {
                        if (event.detail && event.detail.successful &&
                            event.detail.raffleId === raffleId) {

                            // Запускаємо конфетті при успішній участі
                            this.showSuccessConfetti(button);

                            // Видаляємо обробник після використання
                            document.removeEventListener('raffle-participation', successHandler);
                        }
                    };

                    document.addEventListener('raffle-participation', successHandler);
                }
            });

            // Обробник для анімації бейджів на вкладці статистики
            document.addEventListener('user-data-updated', () => {
                // Анімуємо медалі, якщо відкрита вкладка статистики
                if (WinixRaffles.state.activeTab === 'stats') {
                    this.animateBadges();
                }
            });
        },

        // Ініціалізація анімацій
        initAnimations: function() {
            // Запам'ятовуємо всі контейнери частинок
            this.state.particlesContainers = Array.from(document.querySelectorAll('.particles-container'));

            // Створюємо частинки для активної вкладки
            if (this.settings.enableParticles) {
                this.createParticles();
            }

            // Анімуємо активну вкладку
            this.animateActiveTab(WinixRaffles.state.activeTab);

            // Анімуємо прогрес-бари
            this.animateProgressBars();
        },

        // Анімація активної вкладки
        animateActiveTab: function(tabName) {
            if (!this.settings.enableFadeEffects) return;

            // Знаходимо контейнер активної вкладки
            const tabContent = document.getElementById(`${tabName}-raffles`);
            if (!tabContent) return;

            // Додаємо CSS клас з анімацією для елементів вкладки
            const elementsToAnimate = tabContent.querySelectorAll('.section-header, .main-raffle, .mini-raffle, .history-card, .stat-card');

            elementsToAnimate.forEach((element, index) => {
                // Видаляємо попередню анімацію
                element.style.animation = 'none';
                element.offsetHeight; // Форсуємо reflow

                // Додаємо анімацію з затримкою залежно від індексу
                const delay = index * 0.1;
                element.style.animation = `fadeIn 0.5s ease-out ${delay}s forwards`;
            });

            // Оновлюємо частинки
            if (this.settings.enableParticles) {
                this.createParticles();
            }
        },

        // Створення частинок на фоні
        createParticles: function() {
            if (!this.settings.enableParticles) return;

            this.state.particlesContainers.forEach(container => {
                // Очищуємо контейнер
                container.innerHTML = '';

                // Кількість частинок залежить від розміру контейнера
                const containerRect = container.getBoundingClientRect();
                const containerArea = containerRect.width * containerRect.height;

                // Обмежуємо кількість частинок для продуктивності
                const particleCount = Math.min(Math.floor(containerArea / 3000), 15);

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

                    container.appendChild(particle);
                }
            });
        },

        // Анімація прогрес-барів
        animateProgressBars: function() {
            if (!this.settings.enableFadeEffects) return;

            const progressBars = document.querySelectorAll('.progress-bar .progress');

            progressBars.forEach(progress => {
                // Спочатку встановлюємо ширину 0
                progress.style.width = '0';

                // Потім анімуємо до потрібної ширини
                setTimeout(() => {
                    const targetWidth = progress.getAttribute('data-width') || '75%';
                    progress.style.transition = 'width 1.5s ease-in-out';
                    progress.style.width = targetWidth;
                }, 500);
            });
        },

        // Анімація бейджів
        animateBadges: function() {
            if (!this.settings.enablePulseEffects) return;

            const medals = document.querySelectorAll('.medal-card.earned:not(.animated)');

            medals.forEach(medal => {
                // Додаємо клас, щоб не анімувати повторно
                medal.classList.add('animated');

                // Додаємо анімацію пульсації
                medal.style.animation = 'pulse 2s ease-in-out';

                // Видаляємо анімацію після її завершення
                medal.addEventListener('animationend', () => {
                    medal.style.animation = '';
                }, { once: true });
            });
        },

        // Анімація натискання кнопки
        animateButtonPress: function(button) {
            if (!this.settings.enableFadeEffects) return;

            // Додаємо клас для анімації натискання
            button.classList.add('button-pressed');

            // Видаляємо клас після завершення анімації
            setTimeout(() => {
                button.classList.remove('button-pressed');
            }, 300);
        },

        // Показ конфетті при успішній дії
        showSuccessConfetti: function(targetElement) {
            if (!this.settings.enableConfetti || this.state.confettiActive) return;

            // Позначаємо, що конфетті активне
            this.state.confettiActive = true;

            // Отримуємо позицію елемента
            const rect = targetElement.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // Створюємо контейнер для конфетті
            const confettiContainer = document.createElement('div');
            confettiContainer.className = 'confetti-container';
            confettiContainer.style.position = 'fixed';
            confettiContainer.style.left = '0';
            confettiContainer.style.top = '0';
            confettiContainer.style.width = '100%';
            confettiContainer.style.height = '100%';
            confettiContainer.style.pointerEvents = 'none';
            confettiContainer.style.zIndex = '9999';

            document.body.appendChild(confettiContainer);

            // Створюємо конфетті
            const colors = ['#FFD700', '#00dfd1', '#4eb5f7', '#7F00FF', '#FF9800'];
            const confettiCount = 50;

            for (let i = 0; i < confettiCount; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';

                // Випадковий розмір
                const size = Math.random() * 10 + 5;
                confetti.style.width = `${size}px`;
                confetti.style.height = `${size}px`;

                // Випадковий колір
                const colorIndex = Math.floor(Math.random() * colors.length);
                confetti.style.backgroundColor = colors[colorIndex];
                confetti.style.borderRadius = '50%';

                // Випадкова початкова позиція
                confetti.style.position = 'absolute';
                confetti.style.left = `${x}px`;
                confetti.style.top = `${y}px`;

                // Випадкова анімація
                const angle = Math.random() * 360;
                const distance = Math.random() * 100 + 50;
                const animationDuration = Math.random() * 2 + 1;

                confetti.style.transform = 'translate(-50%, -50%)';
                confetti.style.transition = `all ${animationDuration}s ease-out`;

                confettiContainer.appendChild(confetti);

                // Запускаємо анімацію через setTimeout, щоб дати браузеру час відобразити початковий стан
                setTimeout(() => {
                    const targetX = x + distance * Math.cos(angle * Math.PI / 180);
                    const targetY = y + distance * Math.sin(angle * Math.PI / 180);

                    confetti.style.left = `${targetX}px`;
                    confetti.style.top = `${targetY}px`;
                    confetti.style.opacity = '0';
                }, 10);
            }

            // Видаляємо конфетті через 3 секунди
            setTimeout(() => {
                confettiContainer.remove();
                this.state.confettiActive = false;
            }, 3000);
        },

        // Включення/відключення всіх анімацій
        toggleAllAnimations: function(enabled) {
            this.settings.enableParticles = enabled;
            this.settings.enableFadeEffects = enabled;
            this.settings.enablePulseEffects = enabled;
            this.settings.enableConfetti = enabled;

            this.saveSettings();

            if (enabled) {
                this.initAnimations();
            } else {
                // Видаляємо всі частинки
                this.state.particlesContainers.forEach(container => {
                    container.innerHTML = '';
                });
            }
        },

        // Додавання CSS стилів для анімацій
        addAnimationStyles: function() {
            // Перевіряємо, чи вже додано стилі
            if (document.getElementById('winix-animation-styles')) return;

            const style = document.createElement('style');
            style.id = 'winix-animation-styles';
            style.textContent = `
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.7; }
                }
                
                .button-pressed {
                    transform: scale(0.95);
                    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.3) !important;
                    transition: transform 0.1s ease, box-shadow 0.1s ease !important;
                }
                
                .medal-card.earned .medal-icon {
                    filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
                }
                
                .claim-hint {
                    position: absolute;
                    bottom: 5px;
                    left: 0;
                    right: 0;
                    text-align: center;
                    font-size: 0.7rem;
                    color: var(--premium-color);
                    animation: pulse 2s infinite;
                }
            `;

            document.head.appendChild(style);
        }
    };

    // Додаємо модуль анімацій до основного модуля розіграшів
    WinixRaffles.animations = animations;

    // Додаємо стилі для анімацій
    animations.addAnimationStyles();

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (WinixRaffles.state.isInitialized) {
            animations.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                animations.init();
            });
        }
    });
})();