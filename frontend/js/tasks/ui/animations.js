/**
 * Premium Animations - модуль анімацій преміум-класу для системи завдань
 * Відповідає за вражаючі візуальні ефекти при отриманні винагород
 */

// Створюємо namespace для UI компонентів
window.UI = window.UI || {};

window.UI.Animations = (function() {
    // Налаштування анімацій
    const config = {
        enabled: true,                // Чи включені анімації
        adaptiveMode: true,           // Адаптація під потужність пристрою
        rewardDuration: 2500,         // Тривалість анімації нагороди (мс)
        bonusTokenDuration: 3000,     // Тривалість анімації для жетонів бонусу (мс)
        cycleCompletionDuration: 4000, // Тривалість анімації для бонусу завершення циклу (мс)
        confettiCount: {              // Кількість частинок для різних пристроїв
            low: 20,
            medium: 40,
            high: 60
        },
        particleColors: [             // Кольори частинок
            '#4EB5F7', '#00C9A7', '#AD6EE5', '#FFD700', '#52C0BD'
        ],
        specialDayColors: [           // Кольори для особливих днів (з жетонами)
            '#FFD700', '#FFA500', '#FF8C00'
        ]
    };

    // Стан анімацій
    const state = {
        initialized: false,             // Чи були ініціалізовані анімації
        devicePerformance: 'high',      // Продуктивність пристрою
        animationsInProgress: 0,        // Кількість анімацій в процесі
        timers: {}                      // Збереження таймерів
    };

    /**
     * Ініціалізація модуля анімацій
     */
    function init() {
        console.log('UI.Animations: Ініціалізація преміальних анімацій...');

        // Запобігаємо повторній ініціалізації
        if (state.initialized) return;

        // Визначаємо продуктивність пристрою
        detectDevicePerformance();

        // Додаємо стилі для преміальних анімацій
        injectAnimationStyles();

        // Налаштування обробників подій
        setupEventHandlers();

        // Встановлюємо флаг ініціалізації
        state.initialized = true;

        console.log(`UI.Animations: Ініціалізація завершена (режим: ${state.devicePerformance})`);
    }

    /**
     * Визначення продуктивності пристрою
     */
    function detectDevicePerformance() {
        try {
            // Виконуємо простий тест продуктивності
            const startTime = performance.now();
            let counter = 0;
            for (let i = 0; i < 500000; i++) {
                counter++;
            }
            const duration = performance.now() - startTime;

            // Визначаємо категорію пристрою
            if (duration > 50) {
                state.devicePerformance = 'low';
            } else if (duration > 20) {
                state.devicePerformance = 'medium';
            } else {
                state.devicePerformance = 'high';
            }

            console.log(`UI.Animations: Продуктивність пристрою: ${state.devicePerformance}`);

            // Адаптація для мобільних пристроїв
            if (window.innerWidth < 768 && state.devicePerformance !== 'low') {
                state.devicePerformance = 'medium';
            }

        } catch (e) {
            console.warn('UI.Animations: Помилка визначення продуктивності:', e);
            state.devicePerformance = 'medium'; // За замовчуванням
        }
    }

    /**
     * Додавання CSS стилів для преміальних анімацій
     */
    function injectAnimationStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('premium-animations-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'premium-animations-styles';
        styleElement.textContent = `
            /* Основний контейнер для анімації винагороди */
            .premium-reward-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                z-index: 10000;
                perspective: 1000px;
            }
            
            /* Фон затемнення */
            .premium-reward-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.4);
                opacity: 0;
                transition: opacity 0.5s ease;
                backdrop-filter: blur(5px);
            }
            
            .premium-reward-overlay.show {
                opacity: 1;
            }
            
            /* Картка винагороди */
            .premium-reward-card {
                position: relative;
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.85), rgba(15, 23, 42, 0.95));
                color: white;
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 
                            0 0 0 1px rgba(78, 181, 247, 0.2) inset,
                            0 0 30px rgba(0, 201, 167, 0.5);
                padding: 30px 40px;
                transform: scale(0.8) rotateX(20deg);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                text-align: center;
                overflow: hidden;
                width: 90%;
                max-width: 350px;
                backdrop-filter: blur(10px);
            }
            
            .premium-reward-card.show {
                transform: scale(1) rotateX(0);
                opacity: 1;
            }
            
            /* Заголовок винагороди */
            .premium-reward-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
                text-shadow: 0 0 10px rgba(0, 201, 167, 0.7);
                position: relative;
            }
            
            /* Світіння навколо заголовка */
            .premium-reward-title::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 80%;
                height: 20px;
                background: radial-gradient(rgba(0, 201, 167, 0.3), transparent 70%);
                transform: translate(-50%, -50%);
                z-index: -1;
                border-radius: 50%;
                filter: blur(10px);
            }
            
            /* Іконка винагороди */
            .premium-reward-icon {
                position: relative;
                width: 100px;
                height: 100px;
                margin: 15px auto;
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow: 0 0 20px rgba(0, 201, 167, 0.7);
                animation: icon-pulse 2s infinite ease-in-out;
                overflow: hidden;
                transform: scale(0);
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s;
            }
            
            /* Спеціальна іконка для жетонів */
            .premium-reward-icon.token-icon {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.7);
                animation: token-icon-pulse 2s infinite ease-in-out;
            }
            
            /* Спеціальна іконка для завершення циклу */
            .premium-reward-icon.cycle-completion-icon {
                background: linear-gradient(135deg, #FFD700, #00C9A7, #4eb5f7);
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
                animation: completion-icon-pulse 2s infinite ease-in-out;
            }
            
            .premium-reward-card.show .premium-reward-icon {
                transform: scale(1);
            }
            
            /* Значок всередині іконки */
            .premium-reward-icon-inner {
                width: 100%;
                height: 100%;
                position: relative;
                transition: all 0.3s ease;
                filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
            }
            
            /* Світіння навколо іконки */
            .premium-reward-icon::after {
                content: '';
                position: absolute;
                top: -20%;
                left: -20%;
                width: 140%;
                height: 140%;
                background: radial-gradient(rgba(0, 201, 167, 0.3), transparent 70%);
                z-index: -1;
                border-radius: 50%;
                filter: blur(15px);
            }
            
            .premium-reward-icon.token-icon::after {
                background: radial-gradient(rgba(255, 215, 0, 0.3), transparent 70%);
            }
            
            .premium-reward-icon.cycle-completion-icon::after {
                background: radial-gradient(rgba(255, 215, 0, 0.4), transparent 80%);
                animation: rotate-glow 10s linear infinite;
            }
            
            /* Частинки всередині іконки */
            .premium-reward-particles {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                border-radius: 50%;
            }
            
            .premium-reward-particle {
                position: absolute;
                width: 5px;
                height: 5px;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 50%;
                pointer-events: none;
                animation: particle-float 2s infinite linear;
            }
            
            /* Кількість винагороди */
            .premium-reward-amount {
                font-size: 36px;
                font-weight: bold;
                color: #FFD700;
                margin: 10px 0;
                text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                transform: scale(0);
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
            }
            
            .premium-reward-card.show .premium-reward-amount {
                transform: scale(1);
            }
            
            /* Стилі для мультивинагороди (день + жетони) */
            .premium-multi-rewards {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .premium-multi-reward-item {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transform: scale(0);
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .premium-reward-card.show .premium-multi-reward-item {
                transform: scale(1);
            }
            
            .premium-multi-reward-item:nth-child(1) {
                transition-delay: 0.3s;
            }
            
            .premium-multi-reward-item:nth-child(2) {
                transition-delay: 0.5s;
            }
            
            .premium-multi-reward-item:nth-child(3) {
                transition-delay: 0.7s;
            }
            
            .premium-multi-reward-item .premium-reward-amount {
                margin: 0;
                font-size: 28px;
            }
            
            /* Іконка валюти біля суми */
            .premium-reward-currency-icon {
                width: 24px;
                height: 24px;
                position: relative;
                display: inline-block;
            }
            
            /* Тип винагороди */
            .premium-reward-type {
                font-size: 18px;
                color: rgba(255, 255, 255, 0.8);
                margin-bottom: 15px;
                transform: translateY(20px);
                opacity: 0;
                transition: all 0.5s ease 0.4s;
            }
            
            .premium-reward-card.show .premium-reward-type {
                transform: translateY(0);
                opacity: 1;
            }
            
            /* Кнопка прийняття винагороди */
            .premium-reward-button {
                padding: 12px 30px;
                font-size: 16px;
                font-weight: bold;
                color: white;
                background: linear-gradient(90deg, #4eb5f7, #00C9A7);
                border: none;
                border-radius: 30px;
                cursor: pointer;
                transform: translateY(20px);
                opacity: 0;
                transition: all 0.3s ease, transform 0.5s ease 0.5s, opacity 0.5s ease 0.5s;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(0, 201, 167, 0.2) inset;
            }
            
            /* Золота кнопка для особливих подій */
            .premium-reward-button.gold-button {
                background: linear-gradient(90deg, #FFD700, #FFA500);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(255, 215, 0, 0.2) inset;
            }
            
            .premium-reward-card.show .premium-reward-button {
                transform: translateY(0);
                opacity: 1;
            }
            
            .premium-reward-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 201, 167, 0.5);
            }
            
            .premium-reward-button.gold-button:hover {
                box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 215, 0, 0.5);
            }
            
            .premium-reward-button:active {
                transform: translateY(0);
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
            }
            
            /* Фонові елементи та декорації */
            .premium-reward-decoration {
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(rgba(78, 181, 247, 0.1), transparent);
                z-index: -1;
                transform: scale(0);
                transition: transform 1s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .premium-reward-decoration-1 {
                top: -50px;
                left: -50px;
                width: 200px;
                height: 200px;
                transition-delay: 0.2s;
            }
            
            .premium-reward-decoration-2 {
                bottom: -70px;
                right: -70px;
                width: 250px;
                height: 250px;
                background: radial-gradient(rgba(0, 201, 167, 0.1), transparent);
                transition-delay: 0.3s;
            }
            
            /* Золоті декорації для особливих подій */
            .premium-reward-decoration.gold-decoration {
                background: radial-gradient(rgba(255, 215, 0, 0.1), transparent);
            }
            
            .premium-reward-card.show .premium-reward-decoration {
                transform: scale(1);
            }
            
            /* Конфетті для ефекту святкування */
            .premium-confetti-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
                overflow: hidden;
            }
            
            .premium-confetti {
                position: absolute;
                width: 10px;
                height: 10px;
                pointer-events: none;
                z-index: 9998;
                opacity: 0.8;
                transform-origin: center;
            }
            
            /* Значок для виконання всього циклу */
            .premium-completion-badge {
                position: absolute;
                top: -15px;
                right: -15px;
                width: 50px;
                height: 50px;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #1A1A2E;
                font-weight: bold;
                font-size: 14px;
                transform: scale(0);
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s;
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
                z-index: 10;
            }
            
            .premium-reward-card.show .premium-completion-badge {
                transform: scale(1);
            }
            
            /* Анімація для частинок всередині іконки */
            @keyframes particle-float {
                0% { transform: translateY(0) rotate(0deg); }
                100% { transform: translateY(-20px) rotate(360deg); opacity: 0; }
            }
            
            /* Анімація пульсації іконки */
            @keyframes icon-pulse {
                0% { box-shadow: 0 0 20px rgba(0, 201, 167, 0.5); }
                50% { box-shadow: 0 0 30px rgba(0, 201, 167, 0.8), 0 0 50px rgba(0, 201, 167, 0.4); }
                100% { box-shadow: 0 0 20px rgba(0, 201, 167, 0.5); }
            }
            
            /* Анімація пульсації для жетонів */
            @keyframes token-icon-pulse {
                0% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
                50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 50px rgba(255, 215, 0, 0.4); }
                100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
            }
            
            /* Анімація пульсації для завершення циклу */
            @keyframes completion-icon-pulse {
                0% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
                30% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 50px rgba(255, 215, 0, 0.4); }
                60% { box-shadow: 0 0 30px rgba(0, 201, 167, 0.8), 0 0 50px rgba(0, 201, 167, 0.4); }
                100% { box-shadow: 0 0 20px rgba(78, 181, 247, 0.5); }
            }
            
            /* Обертання світіння */
            @keyframes rotate-glow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            /* Адаптивний дизайн */
            @media (max-width: 480px) {
                .premium-reward-card {
                    padding: 25px 30px;
                }
                
                .premium-reward-title {
                    font-size: 20px;
                }
                
                .premium-reward-icon {
                    width: 80px;
                    height: 80px;
                    margin: 10px auto;
                }
                
                .premium-reward-amount {
                    font-size: 30px;
                }
                
                .premium-multi-reward-item .premium-reward-amount {
                    font-size: 24px;
                }
                
                .premium-reward-type {
                    font-size: 16px;
                }
                
                .premium-reward-button {
                    padding: 10px 25px;
                    font-size: 15px;
                }
                
                .premium-completion-badge {
                    width: 40px;
                    height: 40px;
                    font-size: 12px;
                }
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        // Обробники подій для анімацій завдань
        document.addEventListener('task-completed', function(event) {
            if (event.detail && event.detail.taskId) {
                animateSuccessfulCompletion(event.detail.taskId);
            }
        });

        // Обробник для щоденних бонусів
        document.addEventListener('daily-bonus-claimed', function(event) {
            if (event.detail) {
                const { token_amount, cycle_completed } = event.detail;

                // Якщо отримано жетони, відтворюємо спеціальну анімацію
                if (token_amount && token_amount > 0) {
                    // Це буде викликано автоматично через TaskRewards
                }

                // Якщо завершено цикл, відтворюємо спеціальну анімацію
                if (cycle_completed && event.detail.completion_bonus) {
                    setTimeout(() => {
                        showCycleCompletionAnimation(event.detail.completion_bonus);
                    }, 3000); // Затримка, щоб основна анімація винагороди вже завершилась
                }
            }
        });

        // Обробник зміни розміру вікна для адаптації анімацій
        window.addEventListener('resize', debounce(function() {
            // Адаптуємо анімації під новий розмір
            if (window.innerWidth < 768 && state.devicePerformance === 'high') {
                state.devicePerformance = 'medium';
            }
        }, 300));
    }

    /**
     * Ініціалізація анімацій на сторінці
     */
    function initPageAnimations() {
        console.log('UI.Animations: Ініціалізація анімацій сторінки');

        // Якщо анімації не ініціалізовані, спочатку ініціалізуємо модуль
        if (!state.initialized) {
            init();
        }

        // Знаходимо всі елементи з анімаціями
        const animatedElements = document.querySelectorAll('[data-animation]');

        // Застосовуємо анімації до елементів
        animatedElements.forEach(element => {
            const animationType = element.dataset.animation;
            if (animationType) {
                element.classList.add(`animate-${animationType}`);
            }
        });

        // Додаємо анімації до прогрес-барів
        const progressBars = document.querySelectorAll('.progress-fill');
        progressBars.forEach(bar => {
            if (bar.parentElement && bar.parentElement.dataset && bar.parentElement.dataset.taskId) {
                const progress = parseFloat(bar.style.width) || 0;
                showProgressAnimation(bar.parentElement.dataset.taskId, progress);
            }
        });

        console.log('UI.Animations: Анімації сторінки ініціалізовано');
        return true;
    }

    /**
     * Показати преміальну анімацію отримання винагороди
     * @param {Object} reward - Об'єкт винагороди {amount: число, type: 'tokens'|'coins'}
     * @param {Object} options - Додаткові параметри
     */
    function showReward(reward, options = {}) {
        // Параметри за замовчуванням
        const settings = {
            duration: config.rewardDuration,
            showConfetti: true,
            autoClose: true,
            onClose: null,
            specialDay: false,         // Чи є це особливий день (з жетонами)
            id: `reward_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // Унікальний ID
            ...options
        };

        // Формуємо дані про винагороду
        const rewardAmount = reward.amount;
        const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';

        // Визначаємо іконку в залежності від типу
        const iconType = reward.type === 'tokens' ? 'token' : 'coin';

        // Задаємо тривалість анімації залежно від типу винагороди
        if (reward.type === 'coins' && settings.specialDay) {
            settings.duration = config.bonusTokenDuration;
        }

        // Показуємо конфетті, якщо це включено
        if (settings.showConfetti) {
            createPremiumConfetti(settings.specialDay);
        }

        // Створюємо контейнер для анімації
        const container = document.createElement('div');
        container.className = 'premium-reward-container';

        // Створюємо затемнений фон
        const overlay = document.createElement('div');
        overlay.className = 'premium-reward-overlay';

        // Створюємо картку винагороди
        const card = document.createElement('div');
        card.className = 'premium-reward-card';

        // Визначаємо іконку залежно від типу винагороди
        let iconClass = '';
        if (reward.type === 'coins' && settings.specialDay) {
            iconClass = 'token-icon';
        }

        // Наповнюємо картку контентом
        card.innerHTML = `
            <div class="premium-reward-decoration ${settings.specialDay ? 'gold-decoration' : ''} premium-reward-decoration-1"></div>
            <div class="premium-reward-decoration ${settings.specialDay ? 'gold-decoration' : ''} premium-reward-decoration-2"></div>
            
            <div class="premium-reward-title">${settings.specialDay ? 'Особливий день!' : 'Вітаємо!'}</div>
            
            <div class="premium-reward-icon ${iconClass}">
                <div class="premium-reward-icon-inner" data-icon-type="${iconType}"></div>
                <div class="premium-reward-particles"></div>
            </div>
            
            <div class="premium-reward-amount">
                +${rewardAmount} <span class="premium-reward-currency-icon" data-icon-type="${iconType}-small"></span>
            </div>
            
            <div class="premium-reward-type">Ви отримали ${rewardType}</div>
            
            <button class="premium-reward-button ${settings.specialDay ? 'gold-button' : ''}">Чудово!</button>
        `;

        // Додаємо частинки всередині іконки
        const particlesContainer = card.querySelector('.premium-reward-particles');
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'premium-reward-particle';

            // Встановлюємо випадкову позицію та затримку
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 2}s`;

            // Встановлюємо колір частинок для особливих днів
            if (settings.specialDay) {
                const colorIndex = Math.floor(Math.random() * config.specialDayColors.length);
                particle.style.backgroundColor = config.specialDayColors[colorIndex];
            }

            particlesContainer.appendChild(particle);
        }

        // Збираємо все разом
        container.appendChild(overlay);
        container.appendChild(card);
        document.body.appendChild(container);

        // Відтворюємо звук успіху
        playSound(settings.specialDay ? 'special' : 'success');

        // Показуємо анімацію з невеликою затримкою
        setTimeout(() => {
            overlay.classList.add('show');
            card.classList.add('show');
        }, 100);

        // Додаємо обробник для кнопки
        const button = card.querySelector('.premium-reward-button');
        button.addEventListener('click', () => {
            closeRewardAnimation();
        });

        // Оновлюємо баланс користувача
        updateUserBalance(reward);

        // Автоматично закриваємо через вказаний час
        if (settings.autoClose) {
            const timerId = `reward_${settings.id}`;
            state.timers[timerId] = setTimeout(() => {
                closeRewardAnimation();
            }, settings.duration);
        }

        // Функція закриття анімації
        function closeRewardAnimation() {
            // Очищаємо таймер з унікальним ID
            const timerId = `reward_${settings.id}`;
            if (state.timers[timerId]) {
                clearTimeout(state.timers[timerId]);
                delete state.timers[timerId];
            }

            // Приховуємо елементи
            overlay.classList.remove('show');
            card.classList.remove('show');

            // Видаляємо контейнер після завершення анімації
            setTimeout(() => {
                container.remove();

                // Викликаємо callback, якщо він є
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, 500);
        }
    }

/**
 * Показ анімації для щоденного бонусу
 * @param {number} winixAmount - Кількість WINIX
 * @param {number} tokenAmount - Кількість жетонів
 * @param {boolean} cycleCompleted - Чи завершений цикл
 * @param {Object} completionBonus - Бонус за завершення циклу
 */
function showDailyBonusReward(winixAmount, tokenAmount, cycleCompleted, completionBonus) {
    // Якщо цикл завершено, спочатку показуємо звичайний бонус
    if (cycleCompleted && completionBonus) {
        // Спочатку показуємо основний бонус
        showReward({
            type: 'tokens',
            amount: winixAmount
        }, {
            duration: config.rewardDuration,
            autoClose: true,
            showConfetti: true
        });

        // Якщо є жетони, показуємо з затримкою
        if (tokenAmount > 0) {
            setTimeout(() => {
                showReward({
                    type: 'coins',
                    amount: tokenAmount
                }, {
                    duration: config.bonusTokenDuration,
                    autoClose: true,
                    showConfetti: true,
                    specialDay: true
                });
            }, 1500);
        }

        // Потім з затримкою показуємо бонус за завершення
        setTimeout(() => {
            showCycleCompletionAnimation(completionBonus);
        }, tokenAmount > 0 ? 3500 : 2000);
    } else {
        // Для звичайного щоденного бонусу
        const settings = {
            duration: tokenAmount ? config.bonusTokenDuration : config.rewardDuration,
            autoClose: true,
            showConfetti: true
        };

        // Показуємо WINIX нагороду
        showReward({
            type: 'tokens',
            amount: winixAmount
        }, settings);

        // Якщо є жетони, показуємо з затримкою
        if (tokenAmount > 0) {
            setTimeout(() => {
                showReward({
                    type: 'coins',
                    amount: tokenAmount
                }, {
                    ...settings,
                    specialDay: true
                });
            }, 1500);
        }
    }
}

    /**
     * Показати анімацію бонусу за завершення 30-денного циклу
     * @param {Object} bonusData - Дані про бонус {amount: число, tokens: число, badge: рядок}
     */
    function showCycleCompletionAnimation(bonusData) {
        // Параметри анімації
        const settings = {
            duration: config.cycleCompletionDuration,
            showConfetti: true,
            autoClose: true,
            id: `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` // Унікальний ID
        };

        // Показуємо золоте конфетті
        if (settings.showConfetti) {
            createPremiumConfetti(true, 1.5); // Збільшена інтенсивність
        }

        // Створюємо контейнер для анімації
        const container = document.createElement('div');
        container.className = 'premium-reward-container';

        // Створюємо затемнений фон
        const overlay = document.createElement('div');
        overlay.className = 'premium-reward-overlay';

        // Створюємо картку винагороди
        const card = document.createElement('div');
        card.className = 'premium-reward-card';

        // Створюємо значок для завершення циклу
        const completionBadge = document.createElement('div');
        completionBadge.className = 'premium-completion-badge';
        completionBadge.textContent = '30/30';

        // Наповнюємо картку контентом
        card.innerHTML = `
            <div class="premium-reward-decoration gold-decoration premium-reward-decoration-1"></div>
            <div class="premium-reward-decoration gold-decoration premium-reward-decoration-2"></div>
            
            <div class="premium-reward-title">Цикл завершено!</div>
            
            <div class="premium-reward-icon cycle-completion-icon">
                <div class="premium-reward-icon-inner" data-icon-type="token"></div>
                <div class="premium-reward-particles"></div>
            </div>
            
            <div class="premium-multi-rewards">
                <div class="premium-multi-reward-item">
                    <div class="premium-reward-amount">
                        +${bonusData.amount} <span class="premium-reward-currency-icon" data-icon-type="token-small"></span>
                    </div>
                </div>
                <div class="premium-multi-reward-item">
                    <div class="premium-reward-amount">
                        +${bonusData.tokens} <span class="premium-reward-currency-icon" data-icon-type="coin-small"></span>
                    </div>
                </div>
            </div>
            
            <div class="premium-reward-type">Ви завершили 30-денний цикл і отримали бонус!</div>
            <div class="premium-reward-type">Значок: "${bonusData.badge}"</div>
            
            <button class="premium-reward-button gold-button">Чудово!</button>
        `;

        // Додаємо частинки всередині іконки
        const particlesContainer = card.querySelector('.premium-reward-particles');
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'premium-reward-particle';

            // Встановлюємо випадкову позицію та затримку
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 2}s`;

            // Встановлюємо колір частинок для особливих днів
            const colorIndex = Math.floor(Math.random() * config.specialDayColors.length);
            particle.style.backgroundColor = config.specialDayColors[colorIndex];

            particlesContainer.appendChild(particle);
        }

        // Збираємо все разом
        card.appendChild(completionBadge);
        container.appendChild(overlay);
        container.appendChild(card);
        document.body.appendChild(container);

        // Відтворюємо звук успіху
        playSound('special');

        // Показуємо анімацію з невеликою затримкою
        setTimeout(() => {
            overlay.classList.add('show');
            card.classList.add('show');
        }, 100);

        // Додаємо обробник для кнопки
        const button = card.querySelector('.premium-reward-button');
        button.addEventListener('click', () => {
            closeAnimation();
        });

        // Автоматично закриваємо через вказаний час
        if (settings.autoClose) {
            const timerId = `cycle_${settings.id}`;
            state.timers[timerId] = setTimeout(() => {
                closeAnimation();
            }, settings.duration);
        }

        // Функція закриття анімації
        function closeAnimation() {
            // Очищаємо таймер з унікальним ID
            const timerId = `cycle_${settings.id}`;
            if (state.timers[timerId]) {
                clearTimeout(state.timers[timerId]);
                delete state.timers[timerId];
            }

            // Приховуємо елементи
            overlay.classList.remove('show');
            card.classList.remove('show');

            // Видаляємо контейнер після завершення анімації
            setTimeout(() => {
                container.remove();
            }, 500);
        }
    }

    /**
     * Створення преміальних конфетті для анімації
     * @param {boolean} isSpecial - Чи є це особливий день (для золотих конфетті)
     * @param {number} intensityMultiplier - Множник для кількості конфетті
     */
    function createPremiumConfetti(isSpecial = false, intensityMultiplier = 1) {
        // Визначаємо кількість конфетті в залежності від продуктивності
        let confettiCount;
        switch (state.devicePerformance) {
            case 'low':
                confettiCount = config.confettiCount.low;
                break;
            case 'medium':
                confettiCount = config.confettiCount.medium;
                break;
            default:
                confettiCount = config.confettiCount.high;
        }

        // Застосовуємо множник інтенсивності
        confettiCount = Math.round(confettiCount * intensityMultiplier);

        // Створюємо контейнер для конфетті
        const container = document.createElement('div');
        container.className = 'premium-confetti-container';
        document.body.appendChild(container);

        // Кольори конфетті залежно від типу події
        const colors = isSpecial ? config.specialDayColors : config.particleColors;

        // Створюємо конфетті
        for (let i = 0; i < confettiCount; i++) {
            // Створення елементу конфетті
            const confetti = document.createElement('div');
            confetti.className = 'premium-confetti';

            // Випадковий тип фігури (коло, квадрат, прямокутник)
            const shapeType = Math.floor(Math.random() * 3);
            if (shapeType === 0) {
                confetti.style.borderRadius = '50%';
            } else if (shapeType === 1) {
                confetti.style.borderRadius = '2px';
                confetti.style.width = `${Math.random() * 15 + 5}px`;
                confetti.style.height = `${Math.random() * 10 + 5}px`;
            }

            // Випадковий розмір
            const size = Math.random() * 15 + 5;
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;

            // Випадковий колір
            const color = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.backgroundColor = color;
            confetti.style.boxShadow = `0 0 6px ${color}`;

            // Початкова позиція у верхній частині екрану
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.top = `-50px`;

            // Додаємо конфетті до контейнера
            container.appendChild(confetti);

            // Анімуємо конфетті
            const animationDuration = Math.random() * 3 + 2;
            const horizontal = Math.random() * 100 - 50; // Горизонтальний зсув
            const finalRotation = Math.random() * 720 - 360; // Обертання

            // Створюємо анімацію для конфетті
            const animation = confetti.animate([
                {
                    transform: 'translate(0, 0) rotate(0deg)',
                    opacity: 1
                },
                {
                    transform: `translate(${horizontal}px, ${window.innerHeight + 100}px) rotate(${finalRotation}deg)`,
                    opacity: 0
                }
            ], {
                duration: animationDuration * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
                fill: 'forwards'
            });

            // Видаляємо конфетті після завершення анімації
            animation.onfinish = () => {
                confetti.remove();

                // Видаляємо контейнер, якщо всі конфетті закінчили анімацію
                if (container.children.length === 0) {
                    container.remove();
                }
            };
        }
    }

    /**
     * Оновлення балансу користувача
     * @param {Object} reward - Об'єкт винагороди {amount: число, type: 'tokens'|'coins'}
     */
    function updateUserBalance(reward) {
        if (reward.type === 'tokens') {
            // Оновлюємо баланс токенів
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                const newBalance = currentBalance + reward.amount;
                userTokensElement.textContent = newBalance.toFixed(2);

                // Додаємо клас для анімації оновлення
                userTokensElement.classList.add('increasing');
                setTimeout(() => {
                    userTokensElement.classList.remove('increasing');
                }, 2000);

                // Зберігаємо значення в localStorage
                localStorage.setItem('userTokens', newBalance.toString());
            }
        } else if (reward.type === 'coins') {
            // Оновлюємо баланс жетонів
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                const newBalance = currentBalance + reward.amount;
                userCoinsElement.textContent = newBalance.toString();

                // Додаємо клас для анімації оновлення
                userCoinsElement.classList.add('increasing');
                setTimeout(() => {
                    userCoinsElement.classList.remove('increasing');
                }, 2000);

                // Зберігаємо значення в localStorage
                localStorage.setItem('userCoins', newBalance.toString());
            }
        }

        // Генеруємо подію про оновлення балансу
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                type: reward.type,
                amount: reward.amount
            }
        }));
    }

    /**
     * Анімація успішного виконання завдання
     * @param {string} taskId - ID завдання
     */
    function animateSuccessfulCompletion(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Додаємо клас для анімації
        taskElement.classList.add('success-pulse');

        // Додаємо ефект частинок навколо завдання
        createTaskConfetti(taskElement);

        // Відтворюємо звук успіху
        playSound('success');

        // Видаляємо класи анімації через 2 секунди
        setTimeout(() => {
            taskElement.classList.remove('success-pulse');
        }, 2000);
    }

    /**
     * Створення конфетті для анімації завдання
     * @param {HTMLElement} taskElement - DOM елемент завдання
     */
    function createTaskConfetti(taskElement) {
        // Пропускаємо на слабких пристроях
        if (state.devicePerformance === 'low') return;

        // Кількість частинок
        const particleCount = state.devicePerformance === 'medium' ? 15 : 25;

        // Отримуємо розміри та позицію елемента
        const rect = taskElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Створюємо частинки
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.width = `${Math.random() * 8 + 4}px`;
            particle.style.height = `${Math.random() * 8 + 4}px`;
            particle.style.backgroundColor = config.particleColors[Math.floor(Math.random() * config.particleColors.length)];
            particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            particle.style.top = `${centerY}px`;
            particle.style.left = `${centerX}px`;
            particle.style.position = 'fixed';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.transform = 'translate(-50%, -50%)';

            // Додаємо до документу
            document.body.appendChild(particle);

            // Анімуємо частинку
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50;
            const duration = Math.random() * 1.5 + 0.5;

            const animation = particle.animate([
                {
                    transform: 'translate(-50%, -50%) scale(0.3)',
                    opacity: 1
                },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1.2) rotate(${Math.random() * 360}deg)`,
                    opacity: 0
                }
            ], {
                duration: duration * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
                fill: 'forwards'
            });

            // Видаляємо частинку після завершення анімації
            animation.onfinish = () => {
                particle.remove();
            };
        }
    }

    /**
     * Відтворення звукового ефекту
     * @param {string} type - Тип звуку ('success', 'error', 'click', 'special')
     */
    function playSound(type) {
        // Перевіряємо налаштування звуку користувача
        const soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';
        if (!soundsEnabled) return;

        let soundUrl;

        // Визначаємо URL звуку
        switch (type) {
            case 'success':
                soundUrl = 'assets/sounds/success.mp3';
                break;
            case 'error':
                soundUrl = 'assets/sounds/error.mp3';
                break;
            case 'click':
                soundUrl = 'assets/sounds/click.mp3';
                break;
            case 'special':
                soundUrl = 'assets/sounds/special.mp3';
                break;
            default:
                return;
        }

        try {
            // Створюємо аудіо елемент
            const audio = new Audio(soundUrl);
            audio.volume = 0.5;

            // Відтворюємо звук
            audio.play().catch(error => {
                console.warn('Не вдалося відтворити звук:', error);
            });
        } catch (e) {
            console.warn('Помилка відтворення звуку:', e);
        }
    }

    /**
     * Показати анімацію прогресу для завдання
     * @param {string} taskId - ID завдання
     * @param {number} progress - Значення прогресу (0-100)
     */
    function showProgressAnimation(taskId, progress) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const progressBar = taskElement.querySelector('.progress-fill');
        if (progressBar) {
            // Зберігаємо поточне значення
            const currentWidth = parseFloat(progressBar.style.width) || 0;

            // Встановлюємо нове значення з анімацією
            progressBar.style.transition = 'width 1s cubic-bezier(0.1, 0.8, 0.2, 1)';
            progressBar.style.width = `${progress}%`;

            // Додаємо ефект пульсації якщо прогрес збільшився
            if (progress > currentWidth) {
                progressBar.classList.add('pulse');
                setTimeout(() => {
                    progressBar.classList.remove('pulse');
                }, 1000);
            }
        }
    }

    /**
     * Функція для відкладеного виконання
     * @param {Function} func - Функція для виконання
     * @param {number} wait - Час затримки у мс
     */
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    /**
     * Анімація для дня з жетонами у щоденному бонусі
     * @param {HTMLElement} dayElement - Елемент дня
     */
    function animateTokenDay(dayElement) {
        if (!dayElement) return;

        // Додаємо класи для анімації
        dayElement.classList.add('token-day-pulse');

        // Створюємо ефект світіння
        const glow = document.createElement('div');
        glow.className = 'token-day-glow';
        glow.style.position = 'absolute';
        glow.style.top = '0';
        glow.style.left = '0';
        glow.style.width = '100%';
        glow.style.height = '100%';
        glow.style.borderRadius = 'inherit';
        glow.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.7)';
        glow.style.animation = 'token-day-pulse 2s infinite ease-in-out';
        glow.style.zIndex = '-1';

        // Додаємо стилі для анімації, якщо вони ще не додані
        if (!document.getElementById('token-day-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'token-day-animation-styles';
            style.textContent = `
                @keyframes token-day-pulse {
                    0% { opacity: 0.5; transform: scale(0.95); }
                    50% { opacity: 1; transform: scale(1.05); }
                    100% { opacity: 0.5; transform: scale(0.95); }
                }
            `;
            document.head.appendChild(style);
        }

        // Якщо у елемента є стилі position: relative, додаємо ефект
        const position = window.getComputedStyle(dayElement).position;
        if (position === 'static') {
            dayElement.style.position = 'relative';
        }

        dayElement.appendChild(glow);

        // Відтворюємо звук
        playSound('click');

        // Видаляємо ефект через 3 секунди
        setTimeout(() => {
            dayElement.classList.remove('token-day-pulse');
            glow.remove();
        }, 3000);
    }

    // Ініціалізуємо модуль при завантаженні
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        showReward,
        showProgressAnimation,
        playSound,
        animateSuccessfulCompletion,
        createPremiumConfetti,
        initPageAnimations,
        showCycleCompletionAnimation,
        showDailyBonusReward,
        animateTokenDay

    };
})();