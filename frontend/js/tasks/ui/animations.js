/**
 * UniAnimations - Оптимізована система анімацій з адаптацією під пристрої
 * Відповідає за:
 * - Анімації винагород та прогресу
 * - Визначення продуктивності пристрою
 * - Оптимізацію ефектів для різних пристроїв
 * - Звукові ефекти
 */

// Створюємо namespace для UI компонентів
window.UI = window.UI || {};

window.UI.Animations = (function() {
    // Налаштування анімацій з адаптивними рівнями ефектів
    const CONFIG = {
        enabled: true,                  // Чи включені анімації
        adaptiveMode: true,             // Адаптація під потужність пристрою
        deviceDetectionEnabled: true,   // Автоматичне визначення потужності пристрою
        forcedPerformanceLevel: null,   // Примусовий рівень (null, 'low', 'medium', 'high')
        savePreferences: true,          // Зберігати налаштування користувача
        preferenceKey: 'animation_level', // Ключ для зберігання налаштувань

        // Часи анімацій
        timings: {
            rewardDuration: {
                low: 2000,              // Для слабких пристроїв
                medium: 2500,           // Для середніх пристроїв
                high: 3000              // Для потужних пристроїв
            },
            progressBarDuration: 800,   // Тривалість анімації прогрес-бару
            notificationDuration: 300,  // Тривалість анімації сповіщень
            taskCompletionDuration: 2000, // Тривалість анімації завершення завдання
        },

        // Кількість частинок для різних рівнів продуктивності
        particles: {
            confetti: {
                low: 15,                // Для слабких пристроїв
                medium: 30,             // Для середніх пристроїв
                high: 60                // Для потужних пристроїв
            },
            reward: {
                low: 5,                 // Для слабких пристроїв
                medium: 15,             // Для середніх пристроїв
                high: 30                // Для потужних пристроїв
            },
            taskCompletion: {
                low: 10,                // Для слабких пристроїв
                medium: 20,             // Для середніх пристроїв
                high: 30                // Для потужних пристроїв
            }
        },

        // Кольори частинок
        particleColors: [
            '#4EB5F7', '#00C9A7', '#AD6EE5', '#FFD700', '#52C0BD'
        ],

        // Звуки
        sounds: {
            enabled: true,              // Звукові ефекти включені
            volume: 0.5                 // Гучність (0.0 - 1.0)
        },

        // Налаштування для мобільних пристроїв
        mobile: {
            reduceMotion: true,         // Зменшення анімацій на мобільних
            maxParticlesMultiplier: 0.6 // Множник максимальної кількості частинок
        },

        // Режим відлагодження
        debugMode: false
    };

    // Стан анімаційного модуля
    const state = {
        initialized: false,                 // Чи були ініціалізовані анімації
        devicePerformance: 'medium',        // Рівень продуктивності пристрою (low, medium, high)
        isMobileDevice: false,              // Чи мобільний пристрій
        prefersReducedMotion: false,        // Чи користувач надає перевагу зменшеним анімаціям
        animationsInProgress: 0,            // Кількість анімацій в процесі
        timers: {},                         // Збереження таймерів для можливості скасування
        rewardContainerId: 'uni-reward-container', // ID контейнера для анімації винагород
        audioElements: {},                  // Кеш аудіо елементів
        fpsStats: {                         // Статистика FPS для адаптивної оптимізації
            samples: [],
            average: 60,
            lastUpdate: 0
        }
    };

    /**
     * Ініціалізація модуля анімацій
     * @param {Object} options - Налаштування для перевизначення
     */
    function init(options = {}) {
        // Запобігання повторній ініціалізації
        if (state.initialized) return;

        log('Ініціалізація модуля оптимізованих анімацій...');

        // Застосовуємо користувацькі налаштування
        Object.assign(CONFIG, options);

        // Визначаємо можливості пристрою та налаштування користувача
        detectDeviceCapabilities();

        // Завантажуємо збережені налаштування
        loadUserPreferences();

        // Ін'єктуємо стилі для анімацій
        injectAnimationStyles();

        // Налаштування обробників подій
        setupEventHandlers();

        // Попередньо завантажуємо аудіофайли
        if (CONFIG.sounds.enabled) {
            preloadAudioFiles();
        }

        // Відмічаємо, що модуль ініціалізовано
        state.initialized = true;

        log(`Модуль оптимізованих анімацій ініціалізовано (режим: ${state.devicePerformance}, мобільний: ${state.isMobileDevice})`);
    }

    /**
     * Визначення можливостей пристрою
     */
    function detectDeviceCapabilities() {
        // Перевіряємо, чи це мобільний пристрій
        state.isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

        // Перевіряємо налаштування користувача щодо зменшення руху
        state.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Якщо вимкнено автоматичне визначення, або задано примусовий рівень
        if (!CONFIG.deviceDetectionEnabled || CONFIG.forcedPerformanceLevel) {
            state.devicePerformance = CONFIG.forcedPerformanceLevel || 'medium';
            log(`Використовуємо заданий рівень продуктивності: ${state.devicePerformance}`);
            return;
        }

        // Виконуємо базовий тест продуктивності
        log('Виконуємо тест продуктивності пристрою...');

        // 1. Перевіряємо функцію requestAnimationFrame та попередню інформацію про пристрій
        const hasRAF = typeof window.requestAnimationFrame === 'function';

        // 2. Виконуємо простий тест обчислювальної потужності
        const startTime = performance.now();
        let counter = 0;
        for (let i = 0; i < 1000000; i++) {
            counter++;
        }
        const duration = performance.now() - startTime;

        log(`Час виконання тесту: ${duration.toFixed(2)}ms`);

        // 3. Виконуємо тест візуальної продуктивності (FPS)
        // Створюємо тимчасовий елемент для анімацій
        const testElement = document.createElement('div');
        testElement.style.cssText = 'position: fixed; width: 10px; height: 10px; top: -100px; left: -100px; background: transparent;';
        document.body.appendChild(testElement);

        // Запускаємо анімацію на тестовому елементі
        let frames = 0;
        let lastFrameTime = performance.now();
        let fpsSamples = [];
        let rafId;

        function testFrame() {
            frames++;
            const now = performance.now();
            const delta = now - lastFrameTime;

            // Розрахунок FPS кожні 100мс
            if (delta >= 100) {
                const fps = Math.round((frames * 1000) / delta);
                fpsSamples.push(fps);
                frames = 0;
                lastFrameTime = now;
            }

            // Закінчуємо тест після 500мс
            if (now - startTime < 500) {
                rafId = requestAnimationFrame(testFrame);
            } else {
                // Прибираємо тестовий елемент
                if (testElement.parentNode) {
                    testElement.parentNode.removeChild(testElement);
                }

                // Розраховуємо середній FPS
                const avgFps = fpsSamples.reduce((sum, fps) => sum + fps, 0) / fpsSamples.length || 60;

                // Визначаємо категорію пристрою на основі тестів
                determinePerformanceLevel(duration, avgFps, hasRAF);
            }
        }

        // Запускаємо тест FPS, якщо підтримується
        if (hasRAF) {
            rafId = requestAnimationFrame(testFrame);
        } else {
            // Якщо RAF не підтримується, відразу визначаємо рівень продуктивності
            determinePerformanceLevel(duration, 30, false);
        }
    }

    /**
     * Визначення рівня продуктивності пристрою на основі тестів
     * @param {number} computeTime - Час виконання обчислювального тесту
     * @param {number} fps - Середній FPS з тесту візуальної продуктивності
     * @param {boolean} hasRAF - Чи підтримує пристрій requestAnimationFrame
     */
    function determinePerformanceLevel(computeTime, fps, hasRAF) {
        let performance = 'medium';

        // Обчислювальна потужність
        if (computeTime > 50) {
            performance = 'low';
        } else if (computeTime < 20) {
            performance = 'high';
        }

        // Візуальна продуктивність
        if (fps < 40) {
            performance = 'low';
        } else if (fps > 55 && performance !== 'low') {
            performance = 'high';
        }

        // Додаткові фактори
        if (!hasRAF) {
            performance = 'low'; // Відсутність RAF - показник слабкого пристрою
        }

        // Мобільні пристрої зазвичай мають обмеження
        if (state.isMobileDevice && performance === 'high') {
            performance = 'medium';
        }

        // Якщо користувач надає перевагу зменшеному руху, знижуємо рівень
        if (state.prefersReducedMotion && performance !== 'low') {
            performance = performance === 'high' ? 'medium' : 'low';
        }

        // Зберігаємо визначений рівень
        state.devicePerformance = performance;

        log(`Визначено рівень продуктивності: ${performance} (обчислення: ${computeTime.toFixed(2)}ms, FPS: ${fps.toFixed(1)})`);
    }

    /**
     * Завантаження налаштувань користувача
     */
    function loadUserPreferences() {
        if (!CONFIG.savePreferences) return;

        try {
            // Завантажуємо рівень анімацій користувача
            const savedLevel = localStorage.getItem(CONFIG.preferenceKey);
            if (savedLevel && ['low', 'medium', 'high'].includes(savedLevel)) {
                state.devicePerformance = savedLevel;
                log(`Завантажено збережений рівень анімацій: ${savedLevel}`);
            }

            // Завантажуємо налаштування звуку
            const soundsEnabled = localStorage.getItem('sounds_enabled');
            if (soundsEnabled !== null) {
                CONFIG.sounds.enabled = soundsEnabled === 'true';
            }
        } catch (e) {
            console.warn('Помилка завантаження налаштувань анімацій:', e);
        }
    }

    /**
     * Збереження налаштувань користувача
     */
    function saveUserPreferences() {
        if (!CONFIG.savePreferences) return;

        try {
            localStorage.setItem(CONFIG.preferenceKey, state.devicePerformance);
            localStorage.setItem('sounds_enabled', CONFIG.sounds.enabled.toString());
            log(`Збережено налаштування анімацій: ${state.devicePerformance}, звук: ${CONFIG.sounds.enabled}`);
        } catch (e) {
            console.warn('Помилка збереження налаштувань анімацій:', e);
        }
    }

    /**
     * Додавання CSS стилів для анімацій
     */
    function injectAnimationStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('uni-animations-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'uni-animations-styles';
        styleElement.textContent = `
            /* Оптимізовані анімації для різних пристроїв */
            
            /* Анімаційні спрайти та частинки */
            .uni-particle {
                position: absolute;
                pointer-events: none;
                z-index: 9998;
                will-change: transform, opacity;
            }
            
            /* Анімація для відображення балансу */
            #user-tokens.increasing,
            #user-coins.increasing {
                animation: balance-increase 1.5s ease-out;
                color: #4caf50;
            }
            
            #user-tokens.decreasing,
            #user-coins.decreasing {
                animation: balance-decrease 1.5s ease-out;
                color: #f44336;
            }
            
            @keyframes balance-increase {
                0% {
                    transform: scale(1);
                    color: inherit;
                }
                10% {
                    transform: scale(1.1);
                    color: #4caf50;
                }
                90% {
                    transform: scale(1.05);
                    color: #4caf50;
                }
                100% {
                    transform: scale(1);
                    color: inherit;
                }
            }
            
            @keyframes balance-decrease {
                0% {
                    transform: scale(1);
                    color: inherit;
                }
                10% {
                    transform: scale(1.1);
                    color: #f44336;
                }
                90% {
                    transform: scale(1.05);
                    color: #f44336;
                }
                100% {
                    transform: scale(1);
                    color: inherit;
                }
            }
            
            /* Основний контейнер для анімації винагороди */
            .uni-reward-container {
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
            .uni-reward-overlay {
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
            
            .uni-reward-overlay.show {
                opacity: 1;
            }
            
            /* Картка винагороди */
            .uni-reward-card {
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
            
            .uni-reward-card.show {
                transform: scale(1) rotateX(0);
                opacity: 1;
            }
            
            /* Вміст картки винагороди */
            .uni-reward-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
                text-shadow: 0 0 10px rgba(0, 201, 167, 0.7);
                position: relative;
            }
            
            .uni-reward-icon {
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
            
            .uni-reward-card.show .uni-reward-icon {
                transform: scale(1);
            }
            
            .uni-reward-amount {
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
            
            .uni-reward-card.show .uni-reward-amount {
                transform: scale(1);
            }
            
            .uni-reward-type {
                font-size: 18px;
                color: rgba(255, 255, 255, 0.8);
                margin-bottom: 15px;
                transform: translateY(20px);
                opacity: 0;
                transition: all 0.5s ease 0.4s;
            }
            
            .uni-reward-card.show .uni-reward-type {
                transform: translateY(0);
                opacity: 1;
            }
            
            .uni-reward-button {
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
                z-index: 2;
                position: relative;
            }
            
            .uni-reward-card.show .uni-reward-button {
                transform: translateY(0);
                opacity: 1;
            }
            
            .uni-reward-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 201, 167, 0.5);
            }
            
            /* Анімації для різних рівнів продуктивності */
            @keyframes icon-pulse {
                0% { box-shadow: 0 0 20px rgba(0, 201, 167, 0.5); }
                50% { box-shadow: 0 0 30px rgba(0, 201, 167, 0.8), 0 0 50px rgba(0, 201, 167, 0.4); }
                100% { box-shadow: 0 0 20px rgba(0, 201, 167, 0.5); }
            }
            
            /* Анімація для прогрес-бару */
            .progress-fill {
                transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .progress-fill.pulse {
                animation: pulse-progress 1s 1;
            }
            
            @keyframes pulse-progress {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
            
            /* Анімації для успішного виконання завдання */
            .task-item.success-pulse {
                animation: task-success-pulse 1s 1;
            }
            
            @keyframes task-success-pulse {
                0% { transform: translateY(0); }
                50% { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2); }
                100% { transform: translateY(0); }
            }
            
            /* Індикатор завантаження */
            .loading-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.625rem;
                width: 100%;
                height: 2.5rem;
            }
            
            .spinner {
                width: 1.5rem;
                height: 1.5rem;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #4eb5f7;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Адаптивні стилі для мобільних пристроїв */
            @media (max-width: 768px) {
                .uni-reward-card {
                    padding: 25px 30px;
                    max-width: 320px;
                }
                
                .uni-reward-title {
                    font-size: 20px;
                }
                
                .uni-reward-icon {
                    width: 80px;
                    height: 80px;
                    margin: 10px auto;
                }
                
                .uni-reward-amount {
                    font-size: 30px;
                }
                
                .uni-reward-type {
                    font-size: 16px;
                }
                
                .uni-reward-button {
                    padding: 10px 25px;
                    font-size: 15px;
                }
            }
            
            /* Стилі для пристроїв із низькою продуктивністю */
            @media (max-width: 480px), .performance-low {
                .uni-reward-card {
                    padding: 20px 25px;
                    max-width: 300px;
                }
                
                .uni-reward-title {
                    font-size: 18px;
                }
                
                .uni-reward-icon {
                    width: 70px;
                    height: 70px;
                    margin: 8px auto;
                }
                
                .uni-reward-amount {
                    font-size: 28px;
                }
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Попереднє завантаження аудіофайлів
     */
    function preloadAudioFiles() {
        const audioFiles = {
            'success': 'sounds/success.mp3',
            'error': 'sounds/error.mp3',
            'info': 'sounds/info.mp3',
            'reward': 'sounds/reward.mp3',
            'click': 'sounds/click.mp3'
        };

        Object.entries(audioFiles).forEach(([key, src]) => {
            try {
                const audio = new Audio();
                audio.src = src;
                audio.preload = 'auto';
                audio.volume = CONFIG.sounds.volume;
                state.audioElements[key] = audio;

                // Додаємо обробник для тихого завантаження
                audio.addEventListener('canplaythrough', () => {
                    log(`Аудіофайл "${key}" завантажено`);
                }, { once: true });

                // Встановлюємо обробник помилок
                audio.addEventListener('error', (e) => {
                    console.warn(`Помилка завантаження аудіофайлу "${key}":`, e);
                });
            } catch (e) {
                console.warn(`Не вдалося створити аудіоелемент для "${key}":`, e);
            }
        });
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

        // Обробник для адаптації анімацій при зміні розміру вікна
        window.addEventListener('resize', debounce(function() {
            // Визначаємо, чи це мобільний пристрій
            const wasMobile = state.isMobileDevice;
            state.isMobileDevice = window.innerWidth < 768;

            // Якщо змінився тип пристрою, адаптуємо анімації
            if (wasMobile !== state.isMobileDevice) {
                log(`Зміна типу пристрою: ${state.isMobileDevice ? 'мобільний' : 'десктоп'}`);

                // Оновлюємо налаштування анімацій
                if (state.isMobileDevice && state.devicePerformance === 'high') {
                    state.devicePerformance = 'medium';
                    saveUserPreferences();
                }
            }
        }, 300));

        // Обробник для медіа-запиту prefers-reduced-motion
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        function handleReducedMotionChange() {
            state.prefersReducedMotion = reducedMotionQuery.matches;
            log(`Змінено налаштування зменшення руху: ${state.prefersReducedMotion}`);

            // Якщо користувач надає перевагу зменшеному руху, адаптуємо рівень анімацій
            if (state.prefersReducedMotion && state.devicePerformance !== 'low') {
                state.devicePerformance = state.devicePerformance === 'high' ? 'medium' : 'low';
                saveUserPreferences();
            }
        }

        // Додаємо слухач для reducedMotionQuery
        if (typeof reducedMotionQuery.addEventListener === 'function') {
            reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
        } else if (typeof reducedMotionQuery.addListener === 'function') {
            // Для старіших браузерів
            reducedMotionQuery.addListener(handleReducedMotionChange);
        }

        // Встановлюємо обробник для сенсорного вводу
        document.addEventListener('touchstart', function() {
            if (!state.isMobileDevice) {
                state.isMobileDevice = true;
                log('Виявлено сенсорний ввід, переключаємося на мобільний режим');
            }
        }, { once: true });
    }

    /**
     * Встановлення рівня анімацій
     * @param {string} level - Рівень анімацій ('low', 'medium', 'high')
     */
    function setAnimationLevel(level) {
        if (!['low', 'medium', 'high'].includes(level)) {
            console.warn(`Невірний рівень анімацій: ${level}. Доступні опції: low, medium, high`);
            return;
        }

        state.devicePerformance = level;
        saveUserPreferences();

        log(`Встановлено рівень анімацій: ${level}`);

        // Додаємо відповідний клас для CSS
        document.documentElement.classList.remove('performance-low', 'performance-medium', 'performance-high');
        document.documentElement.classList.add(`performance-${level}`);

        // Додаємо або видаляємо класи для елементів, які мають спеціальні анімації
        const animatedElements = document.querySelectorAll('[data-animation]');
        animatedElements.forEach(element => {
            const animationType = element.dataset.animation;

            // Для елементів з розширеними анімаціями на потужних пристроях
            if (animationType === 'enhanced') {
                if (level === 'high') {
                    element.classList.add('animation-enhanced');
                } else {
                    element.classList.remove('animation-enhanced');
                }
            }

            // Для елементів, які мають бути відключені на слабких пристроях
            if (animationType === 'optional') {
                if (level === 'low') {
                    element.classList.add('animation-disabled');
                } else {
                    element.classList.remove('animation-disabled');
                }
            }
        });
    }

    /**
     * Включення/виключення звуків
     * @param {boolean} enabled - Чи включати звуки
     */
    function setSoundsEnabled(enabled) {
        CONFIG.sounds.enabled = enabled;
        saveUserPreferences();
        log(`Звуки ${enabled ? 'включено' : 'виключено'}`);
    }

    /**
     * Відтворення звукового ефекту
     * @param {string} type - Тип звуку ('success', 'error', 'info', 'reward', 'click')
     * @param {number} volume - Гучність (0.0 - 1.0), якщо не вказано, використовується значення з налаштувань
     */
    function playSound(type, volume = null) {
        // Якщо звуки вимкнені або не підтримуються, нічого не робимо
        if (!CONFIG.sounds.enabled || !window.Audio) return;

        // Якщо тип не вказаний або некоректний, нічого не робимо
        if (!type || !['success', 'error', 'info', 'reward', 'click', 'warning', 'question'].includes(type)) {
            return;
        }

        try {
            // Відображення для нестандартних типів
            if (type === 'warning') type = 'info';
            if (type === 'question') type = 'info';

            let audio = state.audioElements[type];

            // Якщо аудіо не попередньо завантажено, створюємо новий елемент
            if (!audio) {
                audio = new Audio(`sounds/${type}.mp3`);
                state.audioElements[type] = audio;
            }

            // Скидаємо попереднє відтворення
            audio.pause();
            audio.currentTime = 0;

            // Встановлюємо гучність
            audio.volume = volume !== null ? volume : CONFIG.sounds.volume;

            // Відтворюємо звук
            const playPromise = audio.play();

            // Обробляємо помилки відтворення (для деяких браузерів)
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    log(`Не вдалося відтворити звук ${type}: ${error.message}`);
                });
            }
        } catch (e) {
            log(`Помилка відтворення звуку ${type}: ${e.message}`);
        }
    }

    /**
     * Показати анімацію отримання винагороди
     * @param {Object} reward - Об'єкт винагороди {amount: число, type: 'tokens'|'coins'}
     * @param {Object} options - Додаткові параметри
     */
    function showReward(reward, options = {}) {
        // Перевіряємо, чи анімації включені
        if (!CONFIG.enabled) {
            // Якщо анімації вимкнені, оновлюємо тільки баланс
            updateUserBalance(reward);
            return;
        }

        // Нормалізуємо об'єкт винагороди
        const normalizedReward = normalizeReward(reward);

        // Параметри за замовчуванням
        const settings = {
            duration: CONFIG.timings.rewardDuration[state.devicePerformance],
            showConfetti: true,
            autoClose: true,
            onClose: null,
            ...options
        };

        // Формуємо дані про винагороду
        const rewardAmount = normalizedReward.amount;
        const rewardType = normalizedReward.type === 'tokens' ? '$WINIX' : 'жетонів';

        // Визначаємо іконку в залежності від типу
        const iconType = normalizedReward.type === 'tokens' ? 'token' : 'coin';

        // Видаляємо існуючий контейнер, якщо він є
        const existingContainer = document.getElementById(state.rewardContainerId);
        if (existingContainer) {
            document.body.removeChild(existingContainer);
        }

        // Показуємо конфетті, якщо це включено
        if (settings.showConfetti) {
            createRewardConfetti();
        }

        // Створюємо контейнер для анімації
        const container = document.createElement('div');
        container.id = state.rewardContainerId;
        container.className = 'uni-reward-container';

        // Створюємо затемнений фон
        const overlay = document.createElement('div');
        overlay.className = 'uni-reward-overlay';

        // Створюємо картку винагороди
        const card = document.createElement('div');
        card.className = 'uni-reward-card';

        // Наповнюємо картку контентом
        card.innerHTML = `
            <div class="uni-reward-title">Вітаємо!</div>
            
            <div class="uni-reward-icon">
                <div class="uni-reward-icon-inner" data-icon-type="${iconType}"></div>
            </div>
            
            <div class="uni-reward-amount">
                +${rewardAmount} <span class="uni-reward-currency-icon" data-icon-type="${iconType}-small"></span>
            </div>
            
            <div class="uni-reward-type">Ви отримали ${rewardType}</div>
            
            <button class="uni-reward-button">Чудово!</button>
        `;

        // Збираємо все разом
        container.appendChild(overlay);
        container.appendChild(card);
        document.body.appendChild(container);

        // Відтворюємо звук успіху
        playSound('reward');

        // Показуємо анімацію з невеликою затримкою
        setTimeout(() => {
            overlay.classList.add('show');
            card.classList.add('show');

            // Створюємо ефект частинок навколо іконки (для середніх і потужних пристроїв)
            if (state.devicePerformance !== 'low') {
                createIconParticles(card.querySelector('.uni-reward-icon'));
            }
        }, 100);

        // Додаємо обробник для кнопки
        const button = card.querySelector('.uni-reward-button');
        button.addEventListener('click', () => {
            closeRewardAnimation();
        });

        // Оновлюємо баланс користувача
        updateUserBalance(normalizedReward);

        // Автоматично закриваємо через вказаний час
        if (settings.autoClose) {
            state.timers.rewardClose = setTimeout(() => {
                closeRewardAnimation();
            }, settings.duration);
        }

        // Функція закриття анімації
        function closeRewardAnimation() {
            // Очищаємо таймер, якщо він існує
            if (state.timers.rewardClose) {
                clearTimeout(state.timers.rewardClose);
            }

            // Приховуємо елементи
            overlay.classList.remove('show');
            card.classList.remove('show');

            // Видаляємо контейнер після завершення анімації
            setTimeout(() => {
                if (container && container.parentNode) {
                    container.parentNode.removeChild(container);
                }

                // Викликаємо callback, якщо він є
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, 500);
        }
    }

    /**
     * Нормалізація об'єкту винагороди
     * @param {Object} reward - Об'єкт винагороди
     * @returns {Object} Нормалізований об'єкт
     */
    function normalizeReward(reward) {
        // Якщо вже правильний формат, повертаємо як є
        if (reward && typeof reward === 'object' &&
            (reward.type === 'tokens' || reward.type === 'coins') &&
            typeof reward.amount === 'number') {
            return {
                type: reward.type,
                amount: Math.abs(reward.amount)
            };
        }

        // Якщо передано тільки число, вважаємо це tokens
        if (typeof reward === 'number') {
            return {
                type: 'tokens',
                amount: Math.abs(reward)
            };
        }

        // Якщо передано об'єкт з неправильними полями, нормалізуємо
        if (reward && typeof reward === 'object') {
            // Визначаємо тип
            let type = 'tokens';
            if (reward.type) {
                type = reward.type.toLowerCase().includes('coin') ? 'coins' : 'tokens';
            }

            // Визначаємо суму
            let amount = 10;
            if (reward.amount !== undefined) {
                amount = Math.abs(parseFloat(reward.amount) || 10);
            } else if (reward.value !== undefined) {
                amount = Math.abs(parseFloat(reward.value) || 10);
            }

            return { type, amount };
        }

        // За замовчуванням
        return {
            type: 'tokens',
            amount: 10
        };
    }

    /**
     * Створення частинок для ікони винагороди
     * @param {HTMLElement} iconElement - DOM елемент іконки
     */
    function createIconParticles(iconElement) {
        if (!iconElement || state.devicePerformance === 'low') return;

        // Отримуємо розміри та позицію іконки
        const rect = iconElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Визначаємо кількість частинок залежно від продуктивності
        const count = CONFIG.particles.reward[state.devicePerformance];

        // Створюємо частинки
        for (let i = 0; i < count; i++) {
            // Визначаємо параметри частинки
            const size = Math.random() * 6 + 3;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 20 + 10;
            const duration = Math.random() * 1.5 + 1;
            const color = CONFIG.particleColors[Math.floor(Math.random() * CONFIG.particleColors.length)];

            // Створюємо елемент частинки
            const particle = document.createElement('div');
            particle.className = 'uni-particle';
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.backgroundColor = color;
            particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            particle.style.position = 'fixed';
            particle.style.boxShadow = `0 0 ${size/2}px ${color}`;
            particle.style.zIndex = '9999';

            // Початкова позиція частинки в центрі іконки
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;

            // Додаємо частинку до документу
            document.body.appendChild(particle);

            // Анімуємо частинку
            const animation = particle.animate([
                {
                    transform: `translate(-50%, -50%)`,
                    opacity: 1
                },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px))`,
                    opacity: 0
                }
            ], {
                duration: duration * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
                fill: 'forwards'
            });

            // Видаляємо частинку після завершення анімації
            animation.onfinish = () => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            };
        }
    }

    /**
     * Створення конфетті для анімації винагороди
     */
    function createRewardConfetti() {
        // Визначаємо кількість конфетті в залежності від продуктивності
        const confettiCount = CONFIG.particles.confetti[state.devicePerformance];

        // Зменшуємо кількість для мобільних пристроїв
        const finalCount = state.isMobileDevice ?
            Math.floor(confettiCount * CONFIG.mobile.maxParticlesMultiplier) :
            confettiCount;

        // Створюємо конфетті
        for (let i = 0; i < finalCount; i++) {
            // Визначаємо параметри конфетті
            const shape = Math.random() > 0.5 ? 'circle' : 'rect';
            const size = Math.random() * 15 + 5;
            const color = CONFIG.particleColors[Math.floor(Math.random() * CONFIG.particleColors.length)];
            const duration = Math.random() * 3 + 2;
            const startX = Math.random() * window.innerWidth;
            const startY = -50;
            const endX = startX + (Math.random() * 200 - 100);
            const endY = window.innerHeight + 50;
            const rotation = Math.random() * 720 - 360;

            // Створюємо елемент конфетті
            const confetti = document.createElement('div');
            confetti.className = 'uni-particle';
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.backgroundColor = color;
            confetti.style.borderRadius = shape === 'circle' ? '50%' : '2px';
            confetti.style.position = 'fixed';
            confetti.style.top = `${startY}px`;
            confetti.style.left = `${startX}px`;
            confetti.style.boxShadow = `0 0 ${size/3}px ${color}`;

            // Додаємо конфетті до документу
            document.body.appendChild(confetti);

            // Анімуємо конфетті
            const animation = confetti.animate([
                {
                    transform: `rotate(0deg)`,
                    opacity: 1
                },
                {
                    transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(${rotation}deg)`,
                    opacity: 0
                }
            ], {
                duration: duration * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
                fill: 'forwards'
            });

            // Видаляємо конфетті після завершення анімації
            animation.onfinish = () => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            };
        }
    }

    /**
     * Оновлення балансу користувача
     * @param {Object} reward - Об'єкт винагороди
     */
    function updateUserBalance(reward) {
        const normalizedReward = normalizeReward(reward);

        // Визначаємо тип для оновлення
        if (normalizedReward.type === 'tokens') {
            updateTokensBalance(normalizedReward.amount);
        } else if (normalizedReward.type === 'coins') {
            updateCoinsBalance(normalizedReward.amount);
        }
    }

    /**
     * Оновлення балансу токенів
     * @param {number} amount - Сума для додавання
     */
    function updateTokensBalance(amount) {
        // Оновлюємо баланс токенів
        const userTokensElement = document.getElementById('user-tokens');
        if (!userTokensElement) return;

        // Отримуємо поточне значення
        const currentBalance = parseFloat(userTokensElement.textContent) || 0;
        const newBalance = currentBalance + amount;

        // Оновлюємо відображення
        userTokensElement.textContent = newBalance.toFixed(2);

        // Додаємо клас для анімації оновлення
        userTokensElement.classList.remove('increasing');
        void userTokensElement.offsetWidth; // Перезапуск анімації
        userTokensElement.classList.add('increasing');

        // Зберігаємо в localStorage
        try {
            localStorage.setItem('userTokens', newBalance.toString());
            localStorage.setItem('winix_balance', newBalance.toString());
        } catch (e) {
            log(`Помилка збереження балансу токенів: ${e.message}`);
        }

        // Відправляємо подію оновлення балансу
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                oldBalance: currentBalance,
                newBalance: newBalance,
                type: 'tokens',
                amount: amount,
                source: 'ui_animations'
            }
        }));
    }

    /**
     * Оновлення балансу жетонів
     * @param {number} amount - Сума для додавання
     */
    function updateCoinsBalance(amount) {
        // Оновлюємо баланс жетонів
        const userCoinsElement = document.getElementById('user-coins');
        if (!userCoinsElement) return;

        // Отримуємо поточне значення
        const currentBalance = parseInt(userCoinsElement.textContent) || 0;
        const newBalance = currentBalance + amount;

        // Оновлюємо відображення
        userCoinsElement.textContent = newBalance.toString();

        // Додаємо клас для анімації оновлення
        userCoinsElement.classList.remove('increasing');
        void userCoinsElement.offsetWidth; // Перезапуск анімації
        userCoinsElement.classList.add('increasing');

        // Зберігаємо в localStorage
        try {
            localStorage.setItem('userCoins', newBalance.toString());
            localStorage.setItem('winix_coins', newBalance.toString());
        } catch (e) {
            log(`Помилка збереження балансу жетонів: ${e.message}`);
        }

        // Відправляємо подію оновлення балансу
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                oldBalance: currentBalance,
                newBalance: newBalance,
                type: 'coins',
                amount: amount,
                source: 'ui_animations'
            }
        }));
    }

    /**
     * Анімація успішного виконання завдання
     * @param {string} taskId - ID завдання
     */
    function animateSuccessfulCompletion(taskId) {
        // Перевіряємо, чи анімації включені
        if (!CONFIG.enabled) return;

        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Додаємо клас для анімації
        taskElement.classList.add('success-pulse');

        // Додаємо ефект частинок навколо завдання (для середніх і потужних пристроїв)
        if (state.devicePerformance !== 'low') {
            createTaskCompletionParticles(taskElement);
        }

        // Відтворюємо звук успіху
        playSound('success');

        // Видаляємо класи анімації через 2 секунди
        setTimeout(() => {
            taskElement.classList.remove('success-pulse');
        }, CONFIG.timings.taskCompletionDuration);
    }

    /**
     * Створення частинок для анімації завершення завдання
     * @param {HTMLElement} taskElement - DOM елемент завдання
     */
    function createTaskCompletionParticles(taskElement) {
        // Пропускаємо на слабких пристроях
        if (state.devicePerformance === 'low') return;

        // Кількість частинок
        const particleCount = CONFIG.particles.taskCompletion[state.devicePerformance];

        // Отримуємо розміри та позицію елемента
        const rect = taskElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Створюємо частинки
        for (let i = 0; i < particleCount; i++) {
            // Визначаємо параметри частинки
            const size = Math.random() * 8 + 4;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50;
            const duration = Math.random() * 1.5 + 0.5;
            const color = CONFIG.particleColors[Math.floor(Math.random() * CONFIG.particleColors.length)];

            // Створюємо елемент частинки
            const particle = document.createElement('div');
            particle.className = 'uni-particle';
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.backgroundColor = color;
            particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            particle.style.position = 'fixed';
            particle.style.top = `${centerY}px`;
            particle.style.left = `${centerX}px`;
            particle.style.boxShadow = `0 0 ${size/2}px ${color}`;
            particle.style.transform = 'translate(-50%, -50%)';

            // Додаємо частинку до документу
            document.body.appendChild(particle);

            // Анімуємо частинку
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
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            };
        }
    }

    /**
     * Показати анімацію прогресу для завдання
     * @param {string} taskId - ID завдання
     * @param {number} progress - Значення прогресу (0-100)
     */
    function showProgressAnimation(taskId, progress) {
        // Перевіряємо, чи анімації включені
        if (!CONFIG.enabled) return;

        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const progressBar = taskElement.querySelector('.progress-fill');
        if (!progressBar) return;

        // Зберігаємо поточне значення
        const currentWidth = parseFloat(progressBar.style.width) || 0;

        // Встановлюємо тривалість анімації
        const duration = `${CONFIG.timings.progressBarDuration / 1000}s`;
        progressBar.style.transition = `width ${duration} cubic-bezier(0.34, 1.56, 0.64, 1)`;

        // Встановлюємо нове значення з анімацією
        progressBar.style.width = `${progress}%`;

        // Додаємо ефект пульсації якщо прогрес збільшився
        if (progress > currentWidth) {
            // Видаляємо клас спочатку, щоб можна було перезапустити анімацію
            progressBar.classList.remove('pulse');
            void progressBar.offsetWidth; // Перезапуск анімації
            progressBar.classList.add('pulse');

            // Видаляємо клас після завершення анімації
            setTimeout(() => {
                progressBar.classList.remove('pulse');
            }, 1000);

            // Відтворюємо звук для значних змін прогресу
            if (progress - currentWidth >= 10) {
                playSound('info', 0.3);
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
     * Логування з перевіркою режиму налагодження
     * @param  {...any} args - Аргументи для логування
     */
    function log(...args) {
        if (CONFIG.debugMode) {
            console.log('[UniAnimations]', ...args);
        }
    }

    /**
     * Ініціалізація інтерактивних анімацій для всіх елементів
     */
    function initPageAnimations() {
        // Пропускаємо, якщо анімації вимкнені
        if (!CONFIG.enabled) return;

        // Перевіряємо, чи ініціалізовано модуль
        if (!state.initialized) init();

        // Додаємо відповідні класи для різних рівнів продуктивності
        document.documentElement.classList.remove('performance-low', 'performance-medium', 'performance-high');
        document.documentElement.classList.add(`performance-${state.devicePerformance}`);

        // Анімації для елементів з атрибутом data-animation
        const animatedElements = document.querySelectorAll('[data-animation]');
        animatedElements.forEach(element => {
            const animationType = element.dataset.animation;

            // Для елементів з розширеними анімаціями на потужних пристроях
            if (animationType === 'enhanced') {
                if (state.devicePerformance === 'high') {
                    element.classList.add('animation-enhanced');
                } else {
                    element.classList.remove('animation-enhanced');
                }
            }

            // Для елементів, які мають бути відключені на слабких пристроях
            if (animationType === 'optional') {
                if (state.devicePerformance === 'low') {
                    element.classList.add('animation-disabled');
                } else {
                    element.classList.remove('animation-disabled');
                }
            }

            // Для елементів з появою при прокрутці
            if (animationType === 'scroll') {
                setupScrollAnimation(element);
            }
        });

        log('Ініціалізовано анімації для всіх елементів на сторінці');
    }

    /**
     * Налаштування анімації появи елемента при прокрутці
     * @param {HTMLElement} element - DOM елемент для анімації
     */
    function setupScrollAnimation(element) {
        // Пропускаємо, якщо анімації вимкнені або це слабкий пристрій
        if (!CONFIG.enabled || (state.devicePerformance === 'low' && state.isMobileDevice)) {
            element.style.opacity = '1';
            element.style.transform = 'none';
            return;
        }

        // Визначаємо callback для Intersection Observer
        const callback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Елемент став видимим
                    entry.target.classList.add('animated-visible');
                    // Відписуємося від спостереження після першої появи
                    observer.unobserve(entry.target);
                }
            });
        };

        // Створюємо Intersection Observer
        const observer = new IntersectionObserver(callback, {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        });

        // Починаємо спостереження за елементом
        observer.observe(element);

        // Додаємо класи для початкового стану
        element.classList.add('animated-hidden');
    }

    /**
     * Ініціалізуємо модуль при завантаженні сторінки
     */
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        showReward,
        showProgressAnimation,
        playSound,
        animateSuccessfulCompletion,
        createRewardConfetti,
        initPageAnimations,
        setSoundsEnabled,
        setAnimationLevel,

        // Додаткові публічні методи
        getCurrentLevel: () => state.devicePerformance,
        isMobile: () => state.isMobileDevice,
        isInitialized: () => state.initialized,
        getConfig: () => ({ ...CONFIG })
    };
})();