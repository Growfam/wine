/**
 * Premium Animations - вдосконалений модуль анімацій преміум-класу для системи завдань
 * Відповідає за високоякісні візуальні ефекти з оптимізованою продуктивністю
 * Версія 2.0.0
 */

// Створюємо namespace для UI компонентів
window.UI = window.UI || {};

window.UI.Animations = (function() {
    // Покращені налаштування анімацій
    const config = {
        enabled: true,                // Чи включені анімації
        adaptiveMode: true,           // Адаптація під потужність пристрою
        rewardDuration: 3000,         // Тривалість анімації нагороди (мс)
        bonusTokenDuration: 3500,     // Тривалість анімації для жетонів бонусу (мс)
        cycleCompletionDuration: 4500, // Тривалість анімації для бонусу завершення циклу (мс)
        confettiCount: {              // Кількість частинок для різних пристроїв
            low: 25,
            medium: 50,
            high: 75
        },
        particleColors: [             // Кольори частинок
            '#4EB5F7', '#00C9A7', '#AD6EE5', '#FFD700', '#52C0BD', '#9C27B0'
        ],
        specialDayColors: [           // Кольори для особливих днів (з жетонами)
            '#FFD700', '#FFA500', '#FF8C00', '#FFC107'
        ],
        soundEffects: {               // Гучність звукових ефектів
            volume: 0.4,
            enabled: true
        },
        animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Покращена функція анімації
    };

    // Стан анімацій
    const state = {
        initialized: false,             // Чи були ініціалізовані анімації
        devicePerformance: 'high',      // Продуктивність пристрою
        animationsInProgress: 0,        // Кількість анімацій в процесі
        timers: {},                     // Збереження таймерів
        soundsLoaded: false,            // Чи завантажено звуки
        soundInstances: {},             // Об'єкти звуків
        lastAnimationTime: 0,           // Час останньої анімації для запобігання перекриття
        enableHighQualityEffects: true  // Чи включені високоякісні ефекти
    };

    /**
     * Ініціалізація модуля анімацій
     * @param {Object} options - Додаткові опції конфігурації
     */
    function init(options = {}) {
        console.log('UI.Animations: Ініціалізація преміальних анімацій...');

        // Запобігаємо повторній ініціалізації
        if (state.initialized) return;

        // Оновлюємо конфігурацію з переданими опціями
        Object.assign(config, options);

        // Визначаємо продуктивність пристрою
        detectDevicePerformance();

        // Додаємо стилі для преміальних анімацій
        injectAnimationStyles();

        // Попередньо завантажуємо звуки, якщо увімкнено
        if (config.soundEffects.enabled) {
            preloadSounds();
        }

        // Налаштування обробників подій
        setupEventHandlers();

        // Встановлюємо флаг ініціалізації
        state.initialized = true;

        console.log(`UI.Animations: Ініціалізація завершена (режим: ${state.devicePerformance}, високоякісні ефекти: ${state.enableHighQualityEffects ? 'увімкнено' : 'вимкнено'})`);
    }

    /**
     * Визначення продуктивності пристрою з покращеною логікою
     */
    function detectDevicePerformance() {
        try {
            // Перевіряємо наявність збереженого налаштування
            const savedPerformance = localStorage.getItem('devicePerformance');
            if (savedPerformance) {
                state.devicePerformance = savedPerformance;
                console.log(`UI.Animations: Завантажено збережений режим продуктивності: ${state.devicePerformance}`);
                return;
            }

            // Виконуємо більш точний тест продуктивності
            const startTime = performance.now();

            // Виконуємо обчислювально складні операції
            let counter = 0;
            const iterations = 800000;
            for (let i = 0; i < iterations; i++) {
                counter += Math.sqrt(i * Math.sin(i));
            }

            const duration = performance.now() - startTime;

            // Визначаємо категорію пристрою
            if (duration > 80) {
                state.devicePerformance = 'low';
                state.enableHighQualityEffects = false;
            } else if (duration > 40) {
                state.devicePerformance = 'medium';
                state.enableHighQualityEffects = window.innerWidth >= 768; // На планшетах і більших екранах
            } else {
                state.devicePerformance = 'high';
                state.enableHighQualityEffects = true;
            }

            console.log(`UI.Animations: Визначено продуктивність пристрою: ${state.devicePerformance} (тривалість тесту: ${duration.toFixed(2)}ms)`);

            // Додаткова адаптація для мобільних пристроїв
            if (window.innerWidth < 600) {
                if (state.devicePerformance === 'high') {
                    state.devicePerformance = 'medium';
                }

                // Перевіряємо частоту оновлення екрана через RAF
                let frameCount = 0;
                let lastTime = performance.now();
                let rafId;

                function countFrame() {
                    frameCount++;
                    const currentTime = performance.now();

                    if (currentTime - lastTime >= 1000) {
                        const fps = frameCount * 1000 / (currentTime - lastTime);
                        console.log(`UI.Animations: Виявлено FPS: ${fps.toFixed(1)}`);

                        // Якщо FPS низький, знижуємо якість ефектів
                        if (fps < 45 && state.devicePerformance !== 'low') {
                            state.devicePerformance = 'low';
                            state.enableHighQualityEffects = false;
                            console.log('UI.Animations: Автоматично знижено якість ефектів через низький FPS');
                        }

                        // Зберігаємо налаштування
                        localStorage.setItem('devicePerformance', state.devicePerformance);

                        cancelAnimationFrame(rafId);
                        return;
                    }

                    rafId = requestAnimationFrame(countFrame);
                }

                rafId = requestAnimationFrame(countFrame);
            }

        } catch (e) {
            console.warn('UI.Animations: Помилка визначення продуктивності:', e);
            state.devicePerformance = 'medium'; // За замовчуванням
            state.enableHighQualityEffects = false;
        }
    }

    /**
     * Додавання покращених CSS стилів для преміальних анімацій
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
                perspective: 1200px;
            }
            
            /* Фон затемнення з розмиттям */
            .premium-reward-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                opacity: 0;
                transition: opacity 0.7s ease;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
            
            .premium-reward-overlay.show {
                opacity: 1;
            }
            
            /* Картка винагороди з покращеними ефектами */
            .premium-reward-card {
                position: relative;
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.85), rgba(15, 23, 42, 0.95));
                color: white;
                border-radius: 24px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), 
                            0 0 0 1px rgba(78, 181, 247, 0.3) inset,
                            0 0 40px rgba(0, 201, 167, 0.6);
                padding: 40px;
                transform: scale(0.8) rotateX(20deg) translateY(20px);
                opacity: 0;
                transition: all 0.7s ${config.animationTimingFunction};
                text-align: center;
                overflow: hidden;
                width: 90%;
                max-width: 400px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            
            .premium-reward-card.show {
                transform: scale(1) rotateX(0) translateY(0);
                opacity: 1;
            }
            
            /* Заголовок винагороди з покращеним світінням */
            .premium-reward-title {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                text-shadow: 0 0 15px rgba(0, 201, 167, 0.8);
                position: relative;
                letter-spacing: 0.5px;
            }
            
            /* Світіння навколо заголовка */
            .premium-reward-title::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 100%;
                height: 30px;
                background: radial-gradient(rgba(0, 201, 167, 0.4), transparent 70%);
                transform: translate(-50%, -50%);
                z-index: -1;
                border-radius: 50%;
                filter: blur(15px);
            }
            
            /* Іконка винагороди з покращеною анімацією */
            .premium-reward-icon {
                position: relative;
                width: 120px;
                height: 120px;
                margin: 25px auto;
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow: 0 0 30px rgba(0, 201, 167, 0.8);
                animation: icon-pulse 3s infinite ease-in-out;
                overflow: hidden;
                transform: scale(0);
                transition: transform 0.8s ${config.animationTimingFunction} 0.3s;
            }
            
            /* Спеціальна іконка для жетонів */
            .premium-reward-icon.token-icon {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
                animation: token-icon-pulse 3s infinite ease-in-out;
            }
            
            /* Спеціальна іконка для завершення циклу */
            .premium-reward-icon.cycle-completion-icon {
                background: linear-gradient(135deg, #FFD700, #00C9A7, #4eb5f7);
                box-shadow: 0 0 40px rgba(255, 215, 0, 0.9);
                animation: completion-icon-pulse 3s infinite ease-in-out;
            }
            
            .premium-reward-card.show .premium-reward-icon {
                transform: scale(1);
            }
            
            /* Значок всередині іконки з кращим світінням */
            .premium-reward-icon-inner {
                width: 100%;
                height: 100%;
                position: relative;
                transition: all 0.5s ease;
                filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.7));
            }
            
            /* Додаткове світіння навколо іконки */
            .premium-reward-icon::after {
                content: '';
                position: absolute;
                top: -20%;
                left: -20%;
                width: 140%;
                height: 140%;
                background: radial-gradient(rgba(0, 201, 167, 0.4), transparent 70%);
                z-index: -1;
                border-radius: 50%;
                filter: blur(20px);
            }
            
            .premium-reward-icon.token-icon::after {
                background: radial-gradient(rgba(255, 215, 0, 0.4), transparent 70%);
            }
            
            .premium-reward-icon.cycle-completion-icon::after {
                background: radial-gradient(rgba(255, 215, 0, 0.5), transparent 80%);
                animation: rotate-glow 12s linear infinite;
            }
            
            /* Покращені частинки всередині іконки */
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
                width: 6px;
                height: 6px;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 50%;
                pointer-events: none;
                animation: particle-float 2.5s infinite linear;
            }
            
            /* Кількість винагороди з кращими ефектами */
            .premium-reward-amount {
                font-size: 42px;
                font-weight: bold;
                color: #FFD700;
                margin: 15px 0;
                text-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
                transform: scale(0);
                transition: transform 0.8s ${config.animationTimingFunction} 0.4s;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
            }
            
            .premium-reward-card.show .premium-reward-amount {
                transform: scale(1);
            }
            
            /* Покращені стилі для мультивинагороди (день + жетони) */
            .premium-multi-rewards {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
            }
            
            .premium-multi-reward-item {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transform: scale(0);
                transition: transform 0.7s ${config.animationTimingFunction};
                background: rgba(255, 255, 255, 0.05);
                padding: 10px 20px;
                border-radius: 20px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
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
                font-size: 32px;
            }
            
            /* Іконка валюти біля суми з покращеним світінням */
            .premium-reward-currency-icon {
                width: 28px;
                height: 28px;
                position: relative;
                display: inline-block;
                filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.7));
            }
            
            /* Тип винагороди */
            .premium-reward-type {
                font-size: 18px;
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 20px;
                transform: translateY(20px);
                opacity: 0;
                transition: all 0.7s ease 0.5s;
            }
            
            .premium-reward-card.show .premium-reward-type {
                transform: translateY(0);
                opacity: 1;
            }
            
            /* Кнопка прийняття винагороди з покращеним ефектом */
            .premium-reward-button {
                padding: 14px 35px;
                font-size: 18px;
                font-weight: bold;
                color: white;
                background: linear-gradient(90deg, #4eb5f7, #00C9A7);
                border: none;
                border-radius: 30px;
                cursor: pointer;
                transform: translateY(20px);
                opacity: 0;
                transition: all 0.3s ease, transform 0.7s ease 0.6s, opacity 0.7s ease 0.6s;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(0, 201, 167, 0.2) inset;
                position: relative;
                overflow: hidden;
            }
            
            /* Золота кнопка для особливих подій з анімованою обводкою */
            .premium-reward-button.gold-button {
                background: linear-gradient(90deg, #FFD700, #FFA500);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(255, 215, 0, 0.2) inset;
                position: relative;
            }
            
            .premium-reward-button.gold-button::before {
                content: '';
                position: absolute;
                inset: -2px;
                background: linear-gradient(90deg, #FFD700, #FFA500, #FFD700);
                border-radius: 32px;
                z-index: -1;
                animation: border-rotate 3s linear infinite;
            }
            
            .premium-reward-card.show .premium-reward-button {
                transform: translateY(0);
                opacity: 1;
            }
            
            .premium-reward-button::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 70%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                transform: skewX(-20deg);
                transition: 0.5s;
            }
            
            .premium-reward-button:hover::after {
                left: 150%;
            }
            
            .premium-reward-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 12px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 201, 167, 0.5);
            }
            
            .premium-reward-button.gold-button:hover {
                box-shadow: 0 12px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(255, 215, 0, 0.5);
            }
            
            .premium-reward-button:active {
                transform: translateY(0);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            
            /* Фонові елементи та покращені декорації */
            .premium-reward-decoration {
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(rgba(78, 181, 247, 0.2), transparent);
                z-index: -1;
                transform: scale(0);
                transition: transform 1.2s ${config.animationTimingFunction};
                filter: blur(2px);
            }
            
            .premium-reward-decoration-1 {
                top: -80px;
                left: -80px;
                width: 250px;
                height: 250px;
                transition-delay: 0.2s;
            }
            
            .premium-reward-decoration-2 {
                bottom: -100px;
                right: -100px;
                width: 300px;
                height: 300px;
                background: radial-gradient(rgba(0, 201, 167, 0.2), transparent);
                transition-delay: 0.4s;
            }
            
            /* Золоті декорації для особливих подій */
            .premium-reward-decoration.gold-decoration {
                background: radial-gradient(rgba(255, 215, 0, 0.2), transparent);
            }
            
            .premium-reward-card.show .premium-reward-decoration {
                transform: scale(1);
            }
            
            /* Конфетті для ефекту святкування з покращеною анімацією */
            .premium-confetti-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
                overflow: hidden;
                perspective: 1000px;
            }
            
            .premium-confetti {
                position: absolute;
                width: 12px;
                height: 12px;
                pointer-events: none;
                z-index: 9998;
                opacity: 0.8;
                transform-origin: center;
                box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
            }
            
            /* Значок для виконання всього циклу з анімованим свіченням */
            .premium-completion-badge {
                position: absolute;
                top: -20px;
                right: -20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #1A1A2E;
                font-weight: bold;
                font-size: 16px;
                transform: scale(0);
                transition: transform 0.7s ${config.animationTimingFunction} 0.9s;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
                z-index: 10;
                border: 2px solid rgba(255, 255, 255, 0.7);
            }
            
            .premium-reward-card.show .premium-completion-badge {
                transform: scale(1);
                animation: badge-pulse 2s 1s infinite alternate;
            }
            
            @keyframes badge-pulse {
                0% { transform: scale(1); box-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
                100% { transform: scale(1.1); box-shadow: 0 0 30px rgba(255, 215, 0, 1); }
            }
            
            /* Анімація для частинок всередині іконки */
            @keyframes particle-float {
                0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                100% { transform: translateY(-30px) rotate(360deg); opacity: 0; }
            }
            
            /* Анімація пульсації іконки */
            @keyframes icon-pulse {
                0% { box-shadow: 0 0 20px rgba(0, 201, 167, 0.5); }
                50% { box-shadow: 0 0 40px rgba(0, 201, 167, 0.9), 0 0 60px rgba(0, 201, 167, 0.4); }
                100% { box-shadow: 0 0 20px rgba(0, 201, 167, 0.5); }
            }
            
            /* Анімація пульсації для жетонів */
            @keyframes token-icon-pulse {
                0% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
                50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.9), 0 0 60px rgba(255, 215, 0, 0.4); }
                100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
            }
            
            /* Анімація пульсації для завершення циклу */
            @keyframes completion-icon-pulse {
                0% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
                30% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.9), 0 0 60px rgba(255, 215, 0, 0.4); }
                60% { box-shadow: 0 0 40px rgba(0, 201, 167, 0.9), 0 0 60px rgba(0, 201, 167, 0.4); }
                100% { box-shadow: 0 0 20px rgba(78, 181, 247, 0.5); }
            }
            
            /* Обертання світіння */
            @keyframes rotate-glow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            /* Анімація обертання для обводки кнопки */
            @keyframes border-rotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Успішне виконання завдання */
            .task-item.success-pulse {
                animation: task-success-pulse 1.5s ease-out;
                position: relative;
                z-index: 2;
            }
            
            @keyframes task-success-pulse {
                0% { transform: scale(1); box-shadow: 0 5px 15px rgba(0, 201, 167, 0); }
                50% { transform: scale(1.03); box-shadow: 0 10px 30px rgba(0, 201, 167, 0.5); }
                100% { transform: scale(1); box-shadow: 0 5px 15px rgba(0, 201, 167, 0); }
            }
            
            /* Індикатор прогресу */
            .progress-fill.pulse {
                animation: progress-bar-pulse 1.2s ease-out;
            }
            
            @keyframes progress-bar-pulse {
                0% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5); }
                70% { box-shadow: 0 0 0 10px rgba(0, 201, 167, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0); }
            }
            
            /* Анімація для дня з жетонами */
            .token-day-pulse {
                animation: token-day-glow 2s infinite alternate ease-in-out;
            }
            
            @keyframes token-day-glow {
                0% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
                100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.9); }
            }
            
            /* Адаптивність для різних пристроїв */
            @media (max-width: 600px) {
                .premium-reward-card {
                    padding: 30px 20px;
                    max-width: 340px;
                }
                
                .premium-reward-title {
                    font-size: 24px;
                }
                
                .premium-reward-icon {
                    width: 100px;
                    height: 100px;
                    margin: 15px auto;
                }
                
                .premium-reward-amount {
                    font-size: 36px;
                }
                
                .premium-multi-reward-item .premium-reward-amount {
                    font-size: 28px;
                }
                
                .premium-reward-button {
                    padding: 12px 30px;
                    font-size: 16px;
                }
                
                .premium-completion-badge {
                    width: 50px;
                    height: 50px;
                    font-size: 14px;
                }
            }
            
            /* CSS для балансу, що оновлюється */
            @keyframes balance-highlight {
                0% { color: inherit; text-shadow: none; }
                50% { color: #4eb5f7; text-shadow: 0 0 10px rgba(78, 181, 247, 0.8); }
                100% { color: inherit; text-shadow: none; }
            }
            
            .balance-updated {
                animation: balance-highlight 1.2s ease;
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Попереднє завантаження звуків для кращої продуктивності
     */
    function preloadSounds() {
        try {
            // Перевіряємо, чи звуки вже завантажені
            if (state.soundsLoaded) return;

            // Перевіряємо, чи звуки загалом вимкнено користувачем
            const soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';
            if (!soundsEnabled) {
                config.soundEffects.enabled = false;
                return;
            }

            // Завантажуємо звуки для різних типів подій
            const soundsToLoad = {
                success: 'assets/sounds/success.mp3',
                error: 'assets/sounds/error.mp3',
                click: 'assets/sounds/click.mp3',
                special: 'assets/sounds/special.mp3',
                reward: 'assets/sounds/reward.mp3',
                complete: 'assets/sounds/complete.mp3'
            };

            // Функція для завантаження одного звуку
            const loadSound = (type, url) => {
                const audio = new Audio();

                // Встановлюємо ідентифікатор для налагодження
                audio.dataset.soundType = type;

                // Встановлюємо корисні властивості та події
                audio.preload = 'auto';
                audio.volume = config.soundEffects.volume;

                // Зберігаємо у стані
                state.soundInstances[type] = audio;

                // Завантажуємо
                audio.src = url;

                // Додаємо обробник помилки
                audio.onerror = () => {
                    console.warn(`UI.Animations: Не вдалося завантажити звук: ${type} (${url})`);
                    delete state.soundInstances[type];
                };
            };

            // Завантажуємо всі звуки
            Object.entries(soundsToLoad).forEach(([type, url]) => {
                loadSound(type, url);
            });

            // Встановлюємо флаг завантаження
            state.soundsLoaded = true;
            console.log('UI.Animations: Звуки попередньо завантажені');
        } catch (e) {
            console.warn('UI.Animations: Помилка завантаження звуків:', e);
            state.soundsLoaded = false;
        }
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        try {
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

            // Обробник зміни видимості вкладки для оптимізації ресурсів
            document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'hidden') {
                    // Зупиняємо всі анімації або ставимо їх на паузу
                    // для економії ресурсів
                } else if (document.visibilityState === 'visible') {
                    // Відновлюємо анімації, якщо вони були призупинені
                }
            });

            // Добавляємо оптимізований обробник анімацій для мобільних пристроїв
            if ('ontouchstart' in window) {
                document.addEventListener('touchstart', function() {
                    // Оптимізація для прогресу на тач-пристроях
                }, { passive: true });
            }
        } catch (error) {
            console.error('UI.Animations: Помилка налаштування обробників подій:', error);
        }
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

        // Додаємо анімації до завдань та інтерактивних елементів
        document.querySelectorAll('.task-item').forEach((task, index) => {
            // Додаємо затримку для ефекту каскадної появи
            setTimeout(() => {
                task.style.opacity = '0';
                task.style.transform = 'translateY(20px)';
                task.style.transition = 'all 0.5s ease';

                setTimeout(() => {
                    task.style.opacity = '1';
                    task.style.transform = 'translateY(0)';
                }, 50);
            }, index * 100);
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
        // Перевіряємо, чи можемо відобразити анімацію зараз
        const now = Date.now();
        if (now - state.lastAnimationTime < 500) {
            // Занадто рано для нової анімації, додаємо затримку
            setTimeout(() => showReward(reward, options), 700);
            return;
        }

        state.lastAnimationTime = now;
        state.animationsInProgress++;

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

        // Визначаємо кількість частинок залежно від продуктивності
        const particleCount = state.enableHighQualityEffects ? 15 : 10;

        for (let i = 0; i < particleCount; i++) {
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

            // Додаємо ефект натискання кнопки
            playSound('click');
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
                state.animationsInProgress--;

                // Викликаємо callback, якщо він є
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, 700);
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
                showConfetti: true,
                onClose: () => {
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
                                specialDay: true,
                                onClose: () => {
                                    // Потім з затримкою показуємо бонус за завершення
                                    setTimeout(() => {
                                        showCycleCompletionAnimation(completionBonus);
                                    }, 700);
                                }
                            });
                        }, 700);
                    } else {
                        // Якщо нема жетонів, одразу показуємо бонус за завершення
                        setTimeout(() => {
                            showCycleCompletionAnimation(completionBonus);
                        }, 700);
                    }
                }
            });
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
            }, {
                ...settings,
                onClose: () => {
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
                        }, 700);
                    }
                }
            });
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

        // Наповнюємо картку контентом з покращеним розміщенням
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

        // Додаємо частинки всередині іконки з більшою інтенсивністю
        const particlesContainer = card.querySelector('.premium-reward-particles');

        const particleCount = state.enableHighQualityEffects ? 20 : 15;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'premium-reward-particle';

            // Встановлюємо випадкову позицію та затримку
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 2}s`;

            // Встановлюємо колір частинок для особливих днів
            const colorIndex = Math.floor(Math.random() * config.specialDayColors.length);
            particle.style.backgroundColor = config.specialDayColors[colorIndex];

            // Доповнюємо розмір та форму для високоякісних ефектів
            if (state.enableHighQualityEffects) {
                particle.style.width = `${5 + Math.random() * 5}px`;
                particle.style.height = `${5 + Math.random() * 5}px`;
                particle.style.boxShadow = `0 0 ${5 + Math.random() * 5}px ${config.specialDayColors[colorIndex]}`;

                // Додаємо різноманітність форм
                if (Math.random() > 0.7) {
                    particle.style.borderRadius = '2px';
                    particle.style.transform = `rotate(${Math.random() * 360}deg)`;
                }
            }

            particlesContainer.appendChild(particle);
        }

        // Збираємо все разом
        card.appendChild(completionBadge);
        container.appendChild(overlay);
        container.appendChild(card);
        document.body.appendChild(container);

        // Відтворюємо звук успіху (спеціальний звук для завершення)
        playSound('complete');

        // Показуємо анімацію з невеликою затримкою
        setTimeout(() => {
            overlay.classList.add('show');
            card.classList.add('show');
        }, 100);

        // Додаємо обробник для кнопки
        const button = card.querySelector('.premium-reward-button');
        button.addEventListener('click', () => {
            closeAnimation();
            playSound('click');
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
                state.animationsInProgress--;
            }, 700);
        }
    }

    /**
     * Створення преміальних конфетті для анімації
     * @param {boolean} isSpecial - Чи є це особливий день (для золотих конфетті)
     * @param {number} intensityMultiplier - Множник для кількості конфетті
     */
    function createPremiumConfetti(isSpecial = false, intensityMultiplier = 1) {
        // Якщо низька продуктивність, зменшуємо ефекти
        if (state.devicePerformance === 'low' && !state.enableHighQualityEffects) {
            intensityMultiplier *= 0.7;
        }

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

            // Випадковий тип фігури (коло, квадрат, прямокутник, зірка)
            const shapeType = Math.floor(Math.random() * 4);

            if (shapeType === 0) {
                confetti.style.borderRadius = '50%';
            } else if (shapeType === 1) {
                confetti.style.borderRadius = '2px';
                confetti.style.width = `${Math.random() * 15 + 7}px`;
                confetti.style.height = `${Math.random() * 10 + 7}px`;
            } else if (shapeType === 2 && state.enableHighQualityEffects) {
                // Створюємо форму п'ятикутника для високоякісних ефектів
                const size = Math.random() * 15 + 10;
                confetti.style.width = `${size}px`;
                confetti.style.height = `${size}px`;
                confetti.style.clipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
            } else if (state.enableHighQualityEffects) {
                // Створюємо форму зірки для високоякісних ефектів
                const size = Math.random() * 15 + 10;
                confetti.style.width = `${size}px`;
                confetti.style.height = `${size}px`;
                confetti.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
            } else {
                // Для низької продуктивності - звичайний квадрат
                confetti.style.borderRadius = '2px';
            }

            // Випадковий розмір
            const size = Math.random() * 15 + 7;
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;

            // Випадковий колір
            const color = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.backgroundColor = color;

            // Додаємо світіння для високоякісних ефектів
            if (state.enableHighQualityEffects) {
                confetti.style.boxShadow = `0 0 8px ${color}`;
            }

            // Початкова позиція у верхній частині екрану
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.top = `-50px`;

            // Додаємо конфетті до контейнера
            container.appendChild(confetti);

            // Анімуємо конфетті з більш реалістичною фізикою
            const animationDuration = Math.random() * 3 + 2;
            const horizontal = Math.random() * 100 - 50; // Горизонтальний зсув
            const horizontalDrift = Math.random() * 50 - 25; // Додатковий дрейф під час падіння
            const finalRotation = Math.random() * 720 - 360; // Обертання

            // Визначаємо ключові кадри анімації з природними коливаннями
            const keyframes = [
                {
                    transform: 'translate(0, 0) rotate(0deg)',
                    opacity: 1
                },
                {
                    transform: `translate(${horizontal * 0.3 + horizontalDrift * 0.3}px, ${window.innerHeight * 0.3}px) rotate(${finalRotation * 0.3}deg)`,
                    opacity: 0.9
                },
                {
                    transform: `translate(${horizontal * 0.6 + horizontalDrift * 0.7}px, ${window.innerHeight * 0.6}px) rotate(${finalRotation * 0.6}deg)`,
                    opacity: 0.7
                },
                {
                    transform: `translate(${horizontal + horizontalDrift}px, ${window.innerHeight + 100}px) rotate(${finalRotation}deg)`,
                    opacity: 0
                }
            ];

            // Створюємо анімацію для конфетті з природним уповільненням у кінці
            const animation = confetti.animate(keyframes, {
                duration: animationDuration * 1000,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
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

                    // Додаємо клас для стандартної анімації балансу
                    userTokensElement.classList.add('balance-updated');
                    setTimeout(() => {
                        userTokensElement.classList.remove('balance-updated');
                    }, 2000);
                }, 2000);

                // Зберігаємо значення в localStorage
                try {
                    localStorage.setItem('userTokens', newBalance.toString());
                } catch (e) {
                    console.warn('UI.Animations: Не вдалося зберегти баланс токенів:', e);
                }
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

                    // Додаємо клас для стандартної анімації балансу
                    userCoinsElement.classList.add('balance-updated');
                    setTimeout(() => {
                        userCoinsElement.classList.remove('balance-updated');
                    }, 2000);
                }, 2000);

                // Зберігаємо значення в localStorage
                try {
                    localStorage.setItem('userCoins', newBalance.toString());
                } catch (e) {
                    console.warn('UI.Animations: Не вдалося зберегти баланс жетонів:', e);
                }
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
        if (state.devicePerformance === 'low' && !state.enableHighQualityEffects) {
            return;
        }

        // Кількість частинок з урахуванням продуктивності
        const particleCount = state.devicePerformance === 'medium' ? 15 : (state.enableHighQualityEffects ? 25 : 20);

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

            // Додаємо різноманітність форм
            if (Math.random() > 0.7 && state.enableHighQualityEffects) {
                particle.style.clipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
            } else {
                particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            }

            particle.style.top = `${centerY}px`;
            particle.style.left = `${centerX}px`;
            particle.style.position = 'fixed';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.transform = 'translate(-50%, -50%)';

            // Додаємо світіння для високоякісних ефектів
            if (state.enableHighQualityEffects) {
                particle.style.boxShadow = `0 0 8px ${particle.style.backgroundColor}`;
            }

            // Додаємо до документу
            document.body.appendChild(particle);

            // Анімуємо частинку з більш природним рухом
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50;
            const duration = Math.random() * 1.5 + 0.5;

            // Проміжні кадри для плавності
            const keyframes = [
                {
                    transform: 'translate(-50%, -50%) scale(0.3)',
                    opacity: 1
                },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance * 0.3}px), calc(-50% + ${Math.sin(angle) * distance * 0.3}px)) scale(0.8) rotate(${Math.random() * 180}deg)`,
                    opacity: 0.8
                },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance * 0.7}px), calc(-50% + ${Math.sin(angle) * distance * 0.7}px)) scale(1.1) rotate(${Math.random() * 270}deg)`,
                    opacity: 0.5
                },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1.2) rotate(${Math.random() * 360}deg)`,
                    opacity: 0
                }
            ];

            const animation = particle.animate(keyframes, {
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
     * @param {string} type - Тип звуку ('success', 'error', 'click', 'special', 'reward', 'complete')
     */
    function playSound(type) {
        // Перевіряємо налаштування звуку користувача
        if (!config.soundEffects.enabled) return;

        // Перевіряємо локальні налаштування звуку
        const soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';
        if (!soundsEnabled) return;

        try {
            // Якщо звуки завантажено, використовуємо їх
            if (state.soundsLoaded && state.soundInstances[type]) {
                const audio = state.soundInstances[type];

                // Скидаємо поточне відтворення, якщо є
                audio.pause();
                audio.currentTime = 0;

                // Відтворюємо звук
                audio.volume = config.soundEffects.volume;
                audio.play().catch(error => {
                    console.warn('UI.Animations: Не вдалося відтворити звук:', error);
                });

                return;
            }

            // Якщо звуки не завантажено, використовуємо базові url
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
                case 'reward':
                    soundUrl = 'assets/sounds/reward.mp3';
                    break;
                case 'complete':
                    soundUrl = 'assets/sounds/complete.mp3';
                    break;
                default:
                    soundUrl = 'assets/sounds/click.mp3';
            }

            // Створюємо аудіо елемент
            const audio = new Audio(soundUrl);
            audio.volume = config.soundEffects.volume;

            // Відтворюємо звук
            audio.play().catch(error => {
                console.warn('UI.Animations: Не вдалося відтворити звук:', error);
            });
        } catch (e) {
            console.warn('UI.Animations: Помилка відтворення звуку:', e);
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
                }, 1200);

                // Якщо прогрес більше 95%, додаємо ефект світіння для завершення
                if (progress > 95) {
                    progressBar.classList.add('glow');
                    playSound('click');
                } else {
                    progressBar.classList.remove('glow');
                }
            }

            // Якщо прогрес досяг 100%, виконуємо додаткову анімацію
            if (progress >= 100 && currentWidth < 100) {
                // Відтворюємо звук завершення
                playSound('success');

                // Додаємо клас до батьківського елемента
                setTimeout(() => {
                    taskElement.classList.add('completed');
                }, 300);
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

            // Плавно прибираємо світіння
            glow.style.opacity = '1';
            glow.style.transition = 'opacity 1s ease';
            glow.style.opacity = '0';

            setTimeout(() => {
                if (glow.parentNode) {
                    glow.parentNode.removeChild(glow);
                }
            }, 1000);
        }, 3000);
    }

    /**
     * Оптимізована анімація для списків завдань
     * @param {NodeList|Array} items - Елементи для анімації
     * @param {string} animation - Тип анімації
     * @param {number} delay - Затримка між елементами (мс)
     */
    function animateItems(items, animation = 'fade-in', delay = 50) {
        if (!items || items.length === 0) return;

        // Анімації для різних типів
        const animations = {
            'fade-in': {
                start: { opacity: '0', transform: 'translateY(20px)' },
                end: { opacity: '1', transform: 'translateY(0)' }
            },
            'slide-in': {
                start: { opacity: '0', transform: 'translateX(-20px)' },
                end: { opacity: '1', transform: 'translateX(0)' }
            },
            'scale-in': {
                start: { opacity: '0', transform: 'scale(0.9)' },
                end: { opacity: '1', transform: 'scale(1)' }
            }
        };

        // Отримуємо параметри анімації
        const anim = animations[animation] || animations['fade-in'];

        // Адаптуємо затримку на основі кількості елементів
        let adjustedDelay = delay;
        if (items.length > 10) {
            adjustedDelay = Math.max(20, delay / 2);
        }

        // Анімуємо кожен елемент
        Array.from(items).forEach((item, index) => {
            // Встановлюємо початковий стан
            Object.entries(anim.start).forEach(([prop, value]) => {
                item.style[prop] = value;
            });

            // Встановлюємо перехід
            item.style.transition = `all 0.5s ${config.animationTimingFunction}`;

            // Анімуємо з затримкою
            setTimeout(() => {
                Object.entries(anim.end).forEach(([prop, value]) => {
                    item.style[prop] = value;
                });
            }, index * adjustedDelay);
        });
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
        animateTokenDay,
        animateItems,
        updateUserBalance,

        // Додаткові методи для гнучкості
        setPerformanceMode: (mode) => {
            if (['low', 'medium', 'high'].includes(mode)) {
                state.devicePerformance = mode;
                state.enableHighQualityEffects = mode === 'high';
                localStorage.setItem('devicePerformance', mode);
                console.log(`UI.Animations: Режим продуктивності змінено на: ${mode}`);
                return true;
            }
            return false;
        },

        getConfig: () => ({...config}),

        getState: () => ({
            devicePerformance: state.devicePerformance,
            enableHighQualityEffects: state.enableHighQualityEffects,
            animationsInProgress: state.animationsInProgress,
            initialized: state.initialized
        })
    };
})();