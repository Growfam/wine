/**
 * TaskManager - Покращений модуль для управління завданнями
 * Premium Edition: оптимізовано швидкість, покращено дизайн, додано анімації
 * @version 2.2.0
 */

window.TaskManager = (function() {
    // Приватні змінні модуля
    let socialTasks = [];
    let limitedTasks = [];
    let partnerTasks = [];
    let referralTasks = [];
    let userProgress = {};
    let initialized = false;
    let activeTabType = 'social'; // Відслідковуємо активну вкладку

    // ВИПРАВЛЕННЯ 1: Покращена система стану перемикання вкладок
    let tabSwitchInProgress = false;
    let pendingTabSwitch = null;
    let tabSwitchWatchdog = null;
    const TAB_SWITCH_TIMEOUT = 2000; // 2 секунди таймаут для автоматичного скидання стану
    const TAB_SWITCH_RECOVERY_ATTEMPTS = 3; // Кількість спроб автоматичного відновлення

    // Типи винагород
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Контроль операцій
    const operationStatus = {
        tasksLoading: false,
        verificationInProgress: {},
        lastVerificationTime: {},
        lastOperationId: null,
        domReady: false,
        // ВИПРАВЛЕННЯ 1: Додатково відстежуємо помилки перемикання вкладок
        tabSwitchErrors: 0,
        lastTabSwitchError: null
    };

    // DOM-елементи
    const domElements = {
        socialTasksContainer: null,
        limitedTasksContainer: null,
        partnersTasksContainer: null,
        referralTasksContainer: null,
        tabButtons: null,
        contentSections: null,
        // ВИПРАВЛЕННЯ 5: Додаємо відстеження елемента кнопки бонусу
        dailyBonusButton: null
    };

    // Конфігурація обробки помилок
    const errorHandlingConfig = {
        maxRetries: 3,
        retryInterval: 1500,
        showTechnicalDetails: false
    };

    // Конфігурація преміальних анімацій
    const animationConfig = {
        enabled: true,
        taskAppearDuration: 350, // ms
        taskAppearDelay: 50, // ms between tasks
        leaderboardAppearDuration: 450, // ms
        leaderboardAppearDelay: 70, // ms between items
        usePremiumEffects: true,
        useReducedMotion: false,
        tabSwitchDelay: 300 // Затримка для перемикання вкладок
    };

    // Налаштування преміальної теми
    const themeConfig = {
        useGlassEffect: true,   // Скляний ефект для карток
        useShadowEffect: true,  // Преміальні тіні
        useRoundedCorners: true, // Заокруглені кути
        useAnimatedGradients: true, // Анімовані градієнти
        colorScheme: 'dark'     // 'dark' або 'light'
    };

    /**
     * Безпечна перевірка includes з обробкою undefined
     * @param {string|undefined} str - Рядок для перевірки
     * @param {string} substring - Підрядок для пошуку
     * @returns {boolean} Результат
     */
    function safeIncludes(str, substring) {
        if (!str || typeof str !== 'string') return false;
        return str.includes(substring);
    }

    /**
     * Безпечне отримання ID користувача з обробкою помилок
     * @returns {string|null} ID користувача або null
     */
    function safeGetUserId() {
        try {
            // Спробуємо отримати ID користувача через звичайну функцію getUserId
            if (typeof window.getUserId === 'function') {
                const userId = window.getUserId();
                if (userId) {
                    return userId;
                }
            }

            // Спробуємо знайти ID в localStorage
            try {
                const storedId = localStorage.getItem('telegram_user_id');
                if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                    return storedId;
                }
            } catch (e) {
                // Ігноруємо помилки localStorage
            }

            // Спробуємо отримати з DOM
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const userId = userIdElement.textContent.trim();
                    if (userId) {
                        return userId;
                    }
                }
            } catch (e) {
                // Ігноруємо помилки DOM
            }

            // Спробуємо отримати з URL-параметрів
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (id) {
                    return id;
                }
            } catch (e) {
                // Ігноруємо помилки URL
            }

            console.warn('TaskManager: ID користувача не знайдено');
            return null;
        } catch (error) {
            console.error('TaskManager: Помилка отримання ID:', error);
            return null;
        }
    }

    /**
     * Діагностика системи
     */
    function diagnoseSystemState() {
        console.group('TaskManager: Діагностика системи');
        console.log('DOM готовий:', document.readyState);
        console.log('API доступний:', !!window.API);
        console.log('API_PATHS доступний:', !!window.API_PATHS);

        if (window.API_PATHS && window.API_PATHS.TASKS) {
            console.log('API_PATHS.TASKS.SOCIAL:', window.API_PATHS.TASKS.SOCIAL);
            console.log('API_PATHS.TASKS.LIMITED:', window.API_PATHS.TASKS.LIMITED);
            console.log('API_PATHS.TASKS.PARTNER:', window.API_PATHS.TASKS.PARTNER);
            console.log('API_PATHS.TASKS.REFERRAL:', window.API_PATHS.TASKS.REFERRAL);
        }

        console.log('TaskProgressManager доступний:', !!window.TaskProgressManager);
        console.log('SocialTask доступний:', !!window.SocialTask);
        console.log('DailyBonus доступний:', !!window.DailyBonus);
        console.log('Стан initialized:', initialized);
        console.groupEnd();
    }

    /**
     * Ініціалізація TaskManager
     */
    function init() {
        console.log('TaskManager: Початок ініціалізації...');

        // Перевіряємо чи потрібно використовувати режим зниженої анімації
        checkReducedMotion();

        // Додаємо преміальні стилі, якщо увімкнена відповідна опція
        if (themeConfig.useGlassEffect || themeConfig.useShadowEffect) {
            injectPremiumStyles();
        }

        // Перевіряємо стан системи перед ініціалізацією
        diagnoseSystemState();

        // Запобігаємо повторній ініціалізації
        if (initialized) {
            console.log('TaskManager: Вже ініціалізовано');
            return;
        }

        // Перевіряємо готовність DOM
        if (document.readyState === 'loading') {
            console.log('TaskManager: DOM не готовий, чекаємо завершення завантаження...');
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Перевіряємо доступність API
        if (!isApiAvailable()) {
            console.error('TaskManager: API недоступне! Спробуємо повторити ініціалізацію пізніше.');

            // Спробуємо ініціалізувати повторно через деякий час
            setTimeout(init, 1000);
            return;
        }

        // Перевіряємо наявність API_PATHS і додаємо запасні варіанти за потреби
        if (!window.API_PATHS || !window.API_PATHS.TASKS) {
            console.error('TaskManager: API_PATHS.TASKS недоступне!');

            // Створюємо базові шляхи, якщо їх немає
            if (!window.API_PATHS) {
                window.API_PATHS = {};
            }

            if (!window.API_PATHS.TASKS) {
                window.API_PATHS.TASKS = {
                    SOCIAL: 'quests/tasks/social',
                    LIMITED: 'quests/tasks/limited',
                    PARTNER: 'quests/tasks/partner'
                };
            }
        }

        // Додаємо шлях для реферальних завдань, якщо його немає
        if (!window.API_PATHS.TASKS.REFERRAL) {
            console.log('TaskManager: Шлях REFERRAL не знайдено, буде використано SOCIAL');
            window.API_PATHS.TASKS.REFERRAL = window.API_PATHS.TASKS.SOCIAL;
        }

        // Перевіряємо, чи існує TaskProgressManager
        if (window.TaskProgressManager && typeof window.TaskProgressManager.getTaskProgress === 'function') {
            console.log('TaskManager: TaskProgressManager знайдено, синхронізуємо інтерфейси...');

            // Створюємо посилання на getTaskProgress, якщо це функція
            if (!window.TaskManager.getTaskProgress) {
                window.TaskManager.getTaskProgress = window.TaskProgressManager.getTaskProgress;
            }
        }

        console.log('TaskManager: Знаходимо DOM елементи...');
        // Знаходимо необхідні DOM-елементи
        findDomElements();

        // ВИПРАВЛЕННЯ 2: Підписуємось на події помилок DOM
        setupErrorHandlers();

        // ВИПРАВЛЕННЯ 1: Покращене налаштування перемикачів вкладок
        setupTabSwitching();

        // ВИПРАВЛЕННЯ 4: Покращено керування кнопками запрошення
        setupButtonVisibility();

        // ВИПРАВЛЕННЯ 5: Налаштування координації з DailyBonus
        setupDailyBonusCoordination();

        // Налаштування відстеження прогресу
        setupProgressTracking();

        // Завантаження завдань
        loadTasks();

        // ВИПРАВЛЕННЯ 3: Регулярне оновлення прогрес-барів
        setupProgressBarUpdates();

        // Встановлюємо флаг ініціалізації
        initialized = true;
        console.log('TaskManager: Ініціалізацію завершено');

        // Інформуємо інші модулі про завершення ініціалізації
        document.dispatchEvent(new CustomEvent('taskmanager-initialized'));
    }

    /**
     * ВИПРАВЛЕННЯ 2: Налаштування обробників помилок
     */
    function setupErrorHandlers() {
        // Відслідковуємо помилки JavaScript
        window.addEventListener('error', function(event) {
            // Фокусуємося лише на помилках DOM і CSS
            if (event.target &&
                (event.target.tagName === 'LINK' ||
                 event.target.tagName === 'STYLE' ||
                 event.target.tagName === 'SCRIPT')) {
                console.warn('TaskManager: Зафіксовано помилку завантаження ресурсу:', event);

                // Якщо це CSS-файл і він впливає на вкладки, виконуємо відновлення
                if (event.target.tagName === 'LINK' && event.target.href.includes('style')) {
                    console.log('TaskManager: Застосовуємо екстрені CSS правила для вкладок');
                    injectEmergencyStyles();
                }
            }
        }, true);

        // MutationObserver для відстеження змін в DOM
        const observer = new MutationObserver(function(mutations) {
            let contentChanged = false;

            mutations.forEach(function(mutation) {
                // Якщо видалено елементи або додано нові
                if (mutation.type === 'childList' &&
                    (mutation.removedNodes.length > 0 || mutation.addedNodes.length > 0)) {
                    // Перевіряємо, чи стосується це секції контенту
                    if (mutation.target.classList &&
                        (mutation.target.classList.contains('content-section') ||
                         mutation.target.closest('.content-section'))) {
                        contentChanged = true;
                    }

                    // Перевіряємо, чи не видалено щоденний бонус
                    if (mutation.removedNodes.length) {
                        Array.from(mutation.removedNodes).forEach(node => {
                            if (node.id === 'claim-daily' ||
                                (node.querySelector && node.querySelector('#claim-daily'))) {
                                console.warn('TaskManager: Виявлено видалення кнопки щоденного бонусу, відновлюємо');
                                restoreDailyBonusButton();
                            }
                        });
                    }
                }
            });

            // Якщо змінився контент, перевіряємо наявність порожніх вкладок
            if (contentChanged) {
                setTimeout(checkEmptyTabs, 100);
            }
        });

        // Запускаємо спостереження за всім body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * ВИПРАВЛЕННЯ 2: Вставка екстрених стилів у випадку помилок CSS
     */
    function injectEmergencyStyles() {
        const emergencyStyle = document.createElement('style');
        emergencyStyle.id = 'emergency-tab-styles';
        emergencyStyle.textContent = `
            /* Аварійні стилі для забезпечення роботи вкладок */
            .content-section {
                display: none;
            }
            .content-section.active {
                display: block !important;
            }
            .tab {
                cursor: pointer;
            }
            .tab.active {
                background: linear-gradient(135deg, #4eb5f7, #00C9A7) !important;
                color: white !important;
                font-weight: bold;
            }
            
            /* Забезпечення видимості кнопки бонусу */
            #claim-daily, .claim-button {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(emergencyStyle);
    }

    /**
     * ВИПРАВЛЕННЯ 2: Перевірка і виправлення порожніх вкладок
     */
    function checkEmptyTabs() {
        const activeSection = document.querySelector('.content-section.active');
        if (!activeSection) return;

        // Перевіряємо, чи вкладка має хоч якийсь контент
        if (!activeSection.innerHTML.trim() || activeSection.style.opacity === '0') {
            console.warn(`TaskManager: Виявлено порожню вкладку: ${activeTabType}, відновлюємо контент`);

            // Встановлюємо базові стилі для відображення
            activeSection.style.display = 'block';
            activeSection.style.opacity = '1';

            // Оновлюємо вміст вкладки
            refreshActiveTab();

            // Надсилаємо подію для діагностики
            document.dispatchEvent(new CustomEvent('tab-content-recovered', {
                detail: { tabType: activeTabType }
            }));
        }
    }

    /**
     * ВИПРАВЛЕННЯ 5: Налаштування взаємодії з модулем DailyBonus
     */
    function setupDailyBonusCoordination() {
        // Знаходимо кнопку бонусу і зберігаємо посилання
        domElements.dailyBonusButton = document.getElementById('claim-daily');

        // Підписуємось на подію ініціалізації DailyBonus
        document.addEventListener('daily-bonus-initialized', function() {
            console.log('TaskManager: Отримано подію ініціалізації DailyBonus');
            // Відправляємо інформацію про наші правила щодо кнопок
            document.dispatchEvent(new CustomEvent('safe-buttons-list', {
                detail: {
                    buttonIds: ['claim-daily'],
                    preserveElement: true
                }
            }));
        });

        // Підписуємось на запити від DailyBonus щодо TaskManager
        document.addEventListener('daily-bonus-taskmanager-check', function(event) {
            document.dispatchEvent(new CustomEvent('taskmanager-status', {
                detail: {
                    initialized: initialized,
                    activeTab: activeTabType,
                    ready: operationStatus.domReady
                }
            }));
        });

        // Повідомляємо DailyBonus про готовність, якщо він уже доступний
        if (window.DailyBonus) {
            console.log('TaskManager: DailyBonus доступний, повідомляємо про готовність TaskManager');
            if (typeof window.DailyBonus.notifyTaskManagerReady === 'function') {
                window.DailyBonus.notifyTaskManagerReady(true);
            }
        }
    }

    /**
     * ВИПРАВЛЕННЯ 5: Відновлення кнопки щоденного бонусу при необхідності
     */
    function restoreDailyBonusButton() {
        // Якщо у нас є збережена кнопка і вона відсутня в DOM, відновлюємо
        if (!document.getElementById('claim-daily')) {
            console.log('TaskManager: Відновлення кнопки щоденного бонусу');

            // Спершу перевіряємо, чи існує контейнер бонусу
            const bonusContainer = document.querySelector('.daily-bonus');
            if (bonusContainer) {
                // Перевіряємо, чи був раніше збережений елемент кнопки
                if (domElements.dailyBonusButton) {
                    // Клонуємо збережену кнопку для відновлення
                    const newButton = domElements.dailyBonusButton.cloneNode(true);
                    bonusContainer.appendChild(newButton);

                    // Оновлюємо посилання
                    domElements.dailyBonusButton = newButton;

                    // Додаємо обробник подій
                    if (window.DailyBonus && typeof window.DailyBonus.handleClaimButtonClick === 'function') {
                        newButton.addEventListener('click', window.DailyBonus.handleClaimButtonClick);
                    }

                    console.log('TaskManager: Кнопка щоденного бонусу відновлена');
                } else {
                    // Створюємо нову кнопку
                    const newButton = document.createElement('button');
                    newButton.id = 'claim-daily';
                    newButton.className = 'claim-button';
                    newButton.textContent = 'Отримати бонус';
                    bonusContainer.appendChild(newButton);

                    // Зберігаємо посилання
                    domElements.dailyBonusButton = newButton;

                    console.log('TaskManager: Створено нову кнопку щоденного бонусу');
                }

                // Надсилаємо подію про відновлення
                document.dispatchEvent(new CustomEvent('daily-bonus-button-restored'));
            } else {
                console.warn('TaskManager: Не знайдено контейнер для щоденного бонусу');
            }
        }
    }

    /**
     * Перевірка та встановлення режиму зниженої анімації
     */
    function checkReducedMotion() {
        try {
            // Перевіряємо налаштування користувача щодо зменшеної анімації
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // Додатково перевіряємо локальне збереження налаштувань
            const savedPreference = localStorage.getItem('reduced_animations');

            if (prefersReducedMotion || savedPreference === 'true') {
                animationConfig.useReducedMotion = true;
                animationConfig.taskAppearDuration = 150;
                animationConfig.taskAppearDelay = 20;
                animationConfig.leaderboardAppearDuration = 200;
                animationConfig.leaderboardAppearDelay = 30;

                // Зменшуємо використання преміальних ефектів
                themeConfig.useAnimatedGradients = false;
            }
        } catch (e) {
            console.warn('TaskManager: Помилка перевірки налаштувань анімації:', e);
        }
    }

    /**
     * Додавання преміальних стилів
     */
    function injectPremiumStyles() {
        if (document.getElementById('premium-task-styles')) return;

        const style = document.createElement('style');
        style.id = 'premium-task-styles';
        style.textContent = `
            /* Преміальні стилі для завдань */
            .task-item {
                background: ${themeConfig.useGlassEffect ? 
                    'rgba(20, 30, 60, 0.7)' : 
                    'rgba(26, 32, 58, 0.95)'};
                border-radius: 16px;
                border: 1px solid rgba(78, 181, 247, 0.2);
                box-shadow: ${themeConfig.useShadowEffect ? 
                    '0 10px 25px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.1)' : 
                    '0 5px 15px rgba(0, 0, 0, 0.15)'};
                backdrop-filter: ${themeConfig.useGlassEffect ? 'blur(10px)' : 'none'};
                transition: all 0.3s ease;
                transform: translateY(20px);
                opacity: 0;
                overflow: hidden;
                position: relative;
            }
            
            .task-item.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .task-item:hover {
                transform: ${animationConfig.useReducedMotion ? 'none' : 'translateY(-3px)'};
                box-shadow: ${themeConfig.useShadowEffect ? 
                    '0 15px 35px rgba(0, 0, 0, 0.3), inset 0 1px 3px rgba(255, 255, 255, 0.2)' : 
                    '0 8px 20px rgba(0, 0, 0, 0.2)'};
            }
            
            .task-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${themeConfig.useAnimatedGradients ? 
                    'radial-gradient(circle at 70% 80%, rgba(78, 181, 247, 0.1), transparent 70%)' : 
                    'none'};
                opacity: 0;
                transition: opacity 0.5s ease;
                z-index: 0;
                pointer-events: none;
            }
            
            .task-item:hover::before {
                opacity: ${themeConfig.useAnimatedGradients ? '1' : '0'};
            }
            
            .task-item.completed {
                border-left: 4px solid #4caf50;
            }
            
            .task-item.ready-to-verify {
                border-left: 4px solid #4eb5f7;
            }
            
            .task-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                position: relative;
                z-index: 1;
            }
            
            .task-title {
                font-weight: bold;
                font-size: 16px;
                color: white;
            }
            
            .task-description {
                color: rgba(255, 255, 255, 0.8);
                font-size: 14px;
                margin-bottom: 15px;
                position: relative;
                z-index: 1;
            }
            
            .task-reward {
                color: #FFD700;
                font-weight: bold;
                background: rgba(255, 215, 0, 0.1);
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 14px;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 5px;
                box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
            }
            
            .token-symbol {
                font-size: 12px;
                opacity: 0.9;
            }
            
            .task-progress {
                margin-top: 15px;
                margin-bottom: 15px;
            }
            
            .progress-text {
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.8);
                margin-bottom: 5px;
            }
            
            .progress-bar-container {
                height: 8px;
                background: rgba(20, 30, 60, 0.4);
                border-radius: 10px;
                overflow: hidden;
            }
            
            /* ВИПРАВЛЕННЯ 3: Покращена специфічність CSS для прогрес-барів */
            .progress-fill {
                height: 100% !important;
                background: linear-gradient(90deg, #4eb5f7, #00C9A7) !important;
                border-radius: 10px !important;
                box-shadow: 0 0 10px rgba(0, 201, 167, 0.4) !important;
                transition: width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) !important;
                min-width: 0% !important;
                max-width: 100% !important;
            }
            
            .progress-fill.complete {
                animation: progress-complete-pulse 2s infinite;
            }
            
            @keyframes progress-complete-pulse {
                0% {
                    box-shadow: 0 0 5px rgba(0, 201, 167, 0.4);
                }
                50% {
                    box-shadow: 0 0 15px rgba(0, 201, 167, 0.7);
                }
                100% {
                    box-shadow: 0 0 5px rgba(0, 201, 167, 0.4);
                }
            }
            
            .task-action {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 10px;
                position: relative;
                z-index: 1;
            }
            
            .action-button {
                background: linear-gradient(90deg, #4eb5f7, #00C9A7);
                color: white;
                border: none;
                border-radius: 10px;
                padding: 10px 20px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                position: relative;
                overflow: hidden;
            }
            
            .action-button::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
                transform: scale(0);
                transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                border-radius: 50%;
            }
            
            .action-button:hover::before {
                transform: scale(1);
            }
            
            .action-button:hover {
                transform: ${animationConfig.useReducedMotion ? 'none' : 'translateY(-2px)'};
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            
            .action-button:active {
                transform: translateY(1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            .completed-label {
                display: inline-block;
                color: #4caf50;
                font-weight: bold;
                padding: 10px 20px;
                border-radius: 10px;
                background: rgba(76, 175, 80, 0.1);
                border: 1px solid rgba(76, 175, 80, 0.3);
            }
            
            /* ВИПРАВЛЕННЯ 5: Спеціальні правила для кнопки бонусу */
            #claim-daily, .claim-button {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            
            #daily-bonus-container .claim-button:disabled {
                opacity: 0.7 !important;
                cursor: not-allowed !important;
            }
            
            /* ВИПРАВЛЕННЯ 4: Правила для кнопок запрошення */
            .invite-button-container {
                display: none;
            }
            
            /* Преміальні стилі для лідерської дошки */
            .leaderboard-item {
                background: ${themeConfig.useGlassEffect ? 
                    'rgba(20, 30, 60, 0.7)' : 
                    'rgba(26, 32, 58, 0.95)'};
                border-radius: 16px;
                border: 1px solid rgba(78, 181, 247, 0.2);
                box-shadow: ${themeConfig.useShadowEffect ? 
                    '0 10px 25px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.1)' : 
                    '0 5px 15px rgba(0, 0, 0, 0.15)'};
                backdrop-filter: ${themeConfig.useGlassEffect ? 'blur(10px)' : 'none'};
                padding: 12px 15px;
                margin-bottom: 10px;
                transition: all 0.3s ease;
                transform: translateY(20px);
                opacity: 0;
                position: relative;
                overflow: hidden;
            }
            
            .leaderboard-item.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .leaderboard-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${themeConfig.useAnimatedGradients ? 
                    'linear-gradient(135deg, rgba(78, 181, 247, 0.05), transparent 70%)' : 
                    'none'};
                z-index: 0;
            }
            
            .leaderboard-item:hover {
                transform: ${animationConfig.useReducedMotion ? 'none' : 'translateY(-3px)'};
                box-shadow: ${themeConfig.useShadowEffect ? 
                    '0 15px 35px rgba(0, 0, 0, 0.3), inset 0 1px 3px rgba(255, 255, 255, 0.2)' : 
                    '0 8px 20px rgba(0, 0, 0, 0.2)'};
            }
            
            .position {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                background: linear-gradient(90deg, #4eb5f7, #b251f7);
                color: white;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                position: relative;
                z-index: 1;
            }
            
            .position.top-3 {
                background: linear-gradient(90deg, #FFD700, #FFA500);
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
                animation: top-position-glow 2s infinite alternate;
            }
            
            @keyframes top-position-glow {
                0% {
                    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                }
                100% {
                    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.3);
                }
            }
            
            .leaderboard-item.current-user {
                background: rgba(0, 201, 167, 0.1);
                border: 1px solid rgba(0, 201, 167, 0.3);
                box-shadow: 0 0 15px rgba(0, 201, 167, 0.2);
                animation: highlight-pulse 3s infinite alternate;
            }
            
            @keyframes highlight-pulse {
                0% {
                    box-shadow: 0 0 10px rgba(0, 201, 167, 0.2);
                }
                100% {
                    box-shadow: 0 0 20px rgba(0, 201, 167, 0.4);
                }
            }
            
            /* Преміальні стилі для вкладок */
            .tabs {
                background: ${themeConfig.useGlassEffect ? 
                    'rgba(15, 23, 42, 0.5)' : 
                    'rgba(15, 23, 42, 0.8)'};
                backdrop-filter: ${themeConfig.useGlassEffect ? 'blur(10px)' : 'none'};
                border-radius: 16px;
                padding: 5px;
                display: flex;
                margin-bottom: 15px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(78, 181, 247, 0.1);
                position: relative;
                overflow: hidden;
            }
            
            .tabs::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg,
                    transparent 0%,
                    rgba(78, 181, 247, 0.3) 20%,
                    rgba(0, 201, 167, 0.3) 50%,
                    rgba(78, 181, 247, 0.3) 80%,
                    transparent 100%);
            }
            
            .tab {
                flex: 1;
                text-align: center;
                padding: 12px;
                font-size: 14px;
                font-weight: bold;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                border-radius: 12px;
                transition: all 0.3s ease;
                position: relative;
                z-index: 1;
            }
            
            .tab.active {
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                color: white;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            
            .tab:not(.active):hover {
                color: rgba(255, 255, 255, 0.9);
                background: rgba(255, 255, 255, 0.1);
            }
            
            .tab.active::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(rgba(0, 201, 167, 0.2), transparent 70%);
                transform: rotate(0deg);
                animation: rotate-glow 15s linear infinite;
                opacity: 0.3;
                pointer-events: none;
                z-index: -1;
            }
            
            @keyframes rotate-glow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            /* Анімації для преміальних ефектів */
            @keyframes gradient-shift {
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
            
            .success-pulse {
                animation: success-animation 1s;
            }
            
            @keyframes success-animation {
                0% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5);
                }
                70% {
                    box-shadow: 0 0 0 15px rgba(0, 201, 167, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0);
                }
            }
            
            /* Стилі для порожніх секцій */
            .no-tasks, .task-loader, .leaderboard-loader {
                background: rgba(20, 30, 60, 0.4);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
                margin: 20px 0;
                border: 1px solid rgba(78, 181, 247, 0.1);
                backdrop-filter: ${themeConfig.useGlassEffect ? 'blur(10px)' : 'none'};
            }
            
            .task-loader, .leaderboard-loader {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            
            .loader-spinner {
                width: 20px;
                height: 20px;
                border: 3px solid rgba(78, 181, 247, 0.3);
                border-radius: 50%;
                border-top-color: #4eb5f7;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* ВИПРАВЛЕННЯ 2: Критичні правила для контентних секцій */
            .content-section {
                display: none;
                z-index: 1;
                position: relative;
            }
            
            .content-section.active {
                display: block !important;
                opacity: 1 !important;
                z-index: 2;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * ВИПРАВЛЕННЯ 4: Покращене керування кнопками та видимістю
     */
    function setupButtonVisibility() {
        // Замість видалення кнопок запрошення, створюємо систему керування видимістю

        // Створюємо масив правил для кнопок
        const buttonRules = [
            // Стандартні кнопки запрошення, які потрібно приховати
            {
                selector: '.invite-friends-button, .action-button[data-action="invite"], [data-lang-key="earn.invite_friends"]',
                action: 'hide',
                container: true
            },
            // Винятки - кнопки, які потрібно залишити видимими
            {
                selector: '#claim-daily, .claim-button, button[id="claim-daily"]',
                action: 'show',
                priority: 1000 // Високий пріоритет
            }
        ];

        // Застосовуємо правила
        applyButtonVisibilityRules();

        // Додаємо спостерігач для застосування правил до нових елементів
        const observer = new MutationObserver(function(mutations) {
            let shouldApplyRules = false;

            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    shouldApplyRules = true;
                }
            });

            if (shouldApplyRules) {
                setTimeout(applyButtonVisibilityRules, 100);
            }
        });

        // Починаємо спостереження
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Функція застосування правил видимості
        function applyButtonVisibilityRules() {
            // Сортуємо правила за пріоритетом (вищий пріоритет застосовується останнім)
            const sortedRules = [...buttonRules].sort((a, b) =>
                (a.priority || 0) - (b.priority || 0)
            );

            // Застосовуємо правила
            sortedRules.forEach(rule => {
                document.querySelectorAll(rule.selector).forEach(element => {
                    // Перевіряємо винятки (шукаємо спеціальні атрибути чи ієрархію)
                    let shouldApply = true;

                    // Якщо елемент - кнопка бонусу, завжди показуємо його
                    if (element.id === 'claim-daily' || element.classList.contains('claim-button')) {
                        if (rule.action === 'hide') {
                            shouldApply = false;
                        }
                    }

                    // Перевіряємо, чи це частина контейнера щоденного бонусу
                    if (rule.container && element.closest('#daily-bonus-container')) {
                        shouldApply = false;
                    }

                    // Застосовуємо дію
                    if (shouldApply) {
                        if (rule.action === 'hide') {
                            // Або приховуємо в контейнері
                            const parent = element.parentElement;
                            if (parent && !parent.classList.contains('invite-button-container')) {
                                const container = document.createElement('div');
                                container.className = 'invite-button-container';
                                container.style.display = 'none';
                                parent.insertBefore(container, element);
                                container.appendChild(element);
                            } else {
                                // Або просто приховуємо
                                element.style.display = 'none';
                            }
                        } else if (rule.action === 'show') {
                            // Показуємо елемент і відмічаємо як захищений
                            element.style.display = 'block';
                            element.setAttribute('data-protected', 'true');
                        }
                    }
                });
            });
        }
    }

    /**
     * ВИПРАВЛЕННЯ 3: Покращена система відстеження прогресу
     */
    function setupProgressTracking() {
        // Використовуємо MutationObserver для відстеження змін прогресу
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' ||
                    (mutation.type === 'childList' && mutation.target.classList.contains('progress-text'))) {

                    // Перевіряємо, чи пов'язаний цей елемент з прогрес-баром
                    const taskElement = mutation.target.closest('.task-item');
                    if (taskElement) {
                        updateProgressBarForTask(taskElement);
                    }
                }
            });
        });

        // Спостерігаємо за змінами в контенті завдань
        const containers = [
            document.getElementById('social-tasks-container'),
            document.getElementById('limited-tasks-container'),
            document.getElementById('partners-tasks-container'),
            document.getElementById('referral-tasks-container')
        ];

        containers.forEach(container => {
            if (container) {
                observer.observe(container, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
            }
        });

        // Підписуємось на події оновлення прогресу
        document.addEventListener('task-progress-updated', function(event) {
            const { taskId, progressData } = event.detail;

            // Оновлюємо прогрес відповідного завдання
            updateTaskProgress(taskId, progressData);
        });
    }

    /**
     * ВИПРАВЛЕННЯ 3: Оновлення прогрес-барів за розкладом
     */
    function setupProgressBarUpdates() {
        // Початкове оновлення всіх прогрес-барів
        setTimeout(updateAllProgressBars, 1000);

        // Регулярне оновлення прогрес-барів
        setInterval(updateAllProgressBars, 5000);
    }

    /**
     * ВИПРАВЛЕННЯ 3: Оновлення прогрес-бару для конкретного завдання
     */
    function updateProgressBarForTask(taskElement) {
        if (!taskElement) return;

        // Отримуємо інформацію про прогрес
        const progressText = taskElement.querySelector('.progress-text');
        if (!progressText) return;

        // Отримуємо цифрові значення з тексту
        const progressInfo = progressText.textContent;
        const match = progressInfo.match(/(\d+)\s*\/\s*(\d+)/);

        if (match && match.length === 3) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);

            if (!isNaN(current) && !isNaN(total) && total > 0) {
                // Розраховуємо відсоток
                const percent = Math.min(100, Math.floor((current / total) * 100));

                // Знаходимо елемент прогрес-бару
                const progressFill = taskElement.querySelector('.progress-fill');
                if (progressFill) {
                    // Застосовуємо стилі з високою специфічністю
                    progressFill.setAttribute('style', `width: ${percent}% !important`);

                    // Якщо досягнуто 100%, додатково оновлюємо клас
                    if (percent >= 100) {
                        progressFill.classList.add('complete');

                        // Позначаємо завдання як завершене, якщо воно ще не позначене
                        if (!taskElement.classList.contains('completed')) {
                            taskElement.classList.add('completed');

                            // Створюємо подію про завершення завдання
                            const taskId = taskElement.getAttribute('data-task-id');
                            if (taskId) {
                                document.dispatchEvent(new CustomEvent('task-completed', {
                                    detail: { taskId, automatic: true }
                                }));
                            }
                        }
                    } else {
                        progressFill.classList.remove('complete');
                    }
                }
            }
        }
    }

    /**
     * ВИПРАВЛЕННЯ 3: Оновлення всіх прогрес-барів
     */
    function updateAllProgressBars() {
        // Оновлюємо всі прогрес-бари на сторінці
        document.querySelectorAll('.task-item').forEach(updateProgressBarForTask);
    }

    /**
     * Знаходження DOM-елементів
     */
    function findDomElements() {
        // Перевіряємо готовність DOM
        if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
            console.log('TaskManager: DOM ще не готовий, очікування...');
            setTimeout(findDomElements, 100);
            return;
        }

        domElements.socialTasksContainer = document.getElementById('social-tasks-container');
        domElements.limitedTasksContainer = document.getElementById('limited-tasks-container');
        domElements.partnersTasksContainer = document.getElementById('partners-tasks-container');
        domElements.referralTasksContainer = document.getElementById('referral-tasks-container');
        domElements.tabButtons = document.querySelectorAll('.tab');
        domElements.contentSections = document.querySelectorAll('.content-section');
        domElements.dailyBonusButton = document.getElementById('claim-daily');

        // Діагностичне повідомлення з результатами пошуку
        console.log('TaskManager: DOM-елементи знайдено:');
        console.log('socialTasksContainer =', domElements.socialTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('limitedTasksContainer =', domElements.limitedTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('partnersTasksContainer =', domElements.partnersTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('referralTasksContainer =', domElements.referralTasksContainer ? 'знайдено' : 'не знайдено');
        console.log('dailyBonusButton =', domElements.dailyBonusButton ? 'знайдено' : 'не знайдено');

        // Визначаємо статус готовності DOM
        operationStatus.domReady = domElements.socialTasksContainer !== null;
    }

    /**
     * ВИПРАВЛЕННЯ 1: Повністю перероблене налаштування перемикачів вкладок
     */
    function setupTabSwitching() {
        console.log('TaskManager: Налаштування перемикачів вкладок');

        if (!domElements.tabButtons || domElements.tabButtons.length === 0) {
            console.warn('TaskManager: Кнопки вкладок не знайдено');
            return;
        }

        // Спочатку видаляємо всі обробники подій
        domElements.tabButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
        });

        // Оновлюємо посилання
        domElements.tabButtons = document.querySelectorAll('.tab');
        const tabButtons = Array.from(domElements.tabButtons);
        const contentSections = Array.from(domElements.contentSections);

        // Додаємо обробники для кожної вкладки
        tabButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const tabType = this.getAttribute('data-tab');

                // Запобігаємо перемиканню, якщо процес вже запущений
                if (tabSwitchInProgress) {
                    console.log('Відкладаємо перемикання на:', tabType);
                    pendingTabSwitch = tabType;
                    return;
                }

                // Запобігаємо зайвій роботі, якщо вкладка вже активна
                if (tabType === activeTabType) {
                    console.log('Вкладка вже активна:', tabType);
                    return;
                }

                // ВИПРАВЛЕННЯ 1: Встановлюємо watchdog таймер для автоматичного скидання стану
                clearTimeout(tabSwitchWatchdog);
                tabSwitchWatchdog = setTimeout(() => {
                    if (tabSwitchInProgress) {
                        console.warn('TaskManager: Сторожовий таймер вкладок спрацював, скидаємо стан');
                        tabSwitchInProgress = false;

                        // Перевіряємо, чи є відкладене перемикання
                        if (pendingTabSwitch) {
                            const tabToSwitch = pendingTabSwitch;
                            pendingTabSwitch = null;
                            const pendingTab = document.querySelector(`.tab[data-tab="${tabToSwitch}"]`);
                            if (pendingTab) {
                                console.log('Виконуємо відкладене перемикання на:', tabToSwitch);
                                setTimeout(() => pendingTab.click(), 100);
                            }
                        }

                        // Записуємо помилку для діагностики
                        operationStatus.tabSwitchErrors++;
                        operationStatus.lastTabSwitchError = {
                            timestamp: Date.now(),
                            activeTab: activeTabType,
                            attemptedTab: tabType
                        };
                    }
                }, TAB_SWITCH_TIMEOUT);

                // Починаємо процес перемикання
                tabSwitchInProgress = true;
                console.log('Перемикання на вкладку:', tabType);

                // ВИПРАВЛЕННЯ 2: Змінено порядок операцій для уникнення мерехтіння

                // 1. Знімаємо клас active з усіх вкладок
                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                });

                // 2. Додаємо клас active поточній вкладці
                this.classList.add('active');

                // 3. Оновлюємо активну вкладку
                const previousTab = activeTabType;
                activeTabType = tabType;

                // 4. Знаходимо потрібну секцію
                const targetSection = document.getElementById(`${tabType}-content`);
                if (!targetSection) {
                    console.error('Контейнер вкладки не знайдено:', tabType);
                    tabSwitchInProgress = false;
                    clearTimeout(tabSwitchWatchdog);
                    return;
                }

                // 5. Підготовка до перемикання - встановлюємо стилі нової вкладки
                targetSection.style.display = 'block';
                targetSection.style.opacity = '0';

                // 6. Плавно приховуємо старий контент і показуємо новий
                contentSections.forEach(section => {
                    if (section !== targetSection) {
                        // Приховуємо інші секції з анімацією
                        section.style.opacity = '0';

                        // ВИПРАВЛЕННЯ 2: Використовуємо setTimeout для гарантування правильної послідовності
                        setTimeout(() => {
                            section.classList.remove('active');
                            section.style.display = 'none';
                        }, 250);
                    }
                });

                // 7. Показуємо нову вкладку з анімацією
                setTimeout(() => {
                    // ВИПРАВЛЕННЯ 2: Явно встановлюємо потрібні стилі
                    targetSection.style.display = 'block';
                    targetSection.classList.add('active');

                    // Затримка для уникнення проблем з анімацією
                    setTimeout(() => {
                        targetSection.style.opacity = '1';

                        // Оновлюємо вміст вкладки залежно від типу
                        refreshTabContent(tabType, previousTab);

                        // Відкладене завершення переходу
                        setTimeout(() => {
                            // Завершуємо процес перемикання
                            tabSwitchInProgress = false;
                            clearTimeout(tabSwitchWatchdog);

                            // Перевіряємо, чи є відкладене перемикання
                            if (pendingTabSwitch) {
                                const tabToSwitch = pendingTabSwitch;
                                pendingTabSwitch = null;

                                const pendingTab = document.querySelector(`.tab[data-tab="${tabToSwitch}"]`);
                                if (pendingTab) {
                                    console.log('Виконуємо відкладене перемикання на:', tabToSwitch);
                                    setTimeout(() => pendingTab.click(), 100);
                                }
                            }

                            // Перевіряємо наявність контенту
                            setTimeout(checkEmptyTabs, 100);
                        }, 300);
                    }, 50);
                }, 250);

                // Зберігаємо активну вкладку
                try {
                    localStorage.setItem('active_tasks_tab', tabType);
                } catch (e) {
                    console.warn('Помилка збереження вкладки:', e.message);
                }
            });
        });

        // Відновлюємо активну вкладку з localStorage
        try {
            const savedTab = localStorage.getItem('active_tasks_tab');
            if (savedTab) {
                const savedTabButton = document.querySelector(`.tab[data-tab="${savedTab}"]`);
                if (savedTabButton) {
                    setTimeout(() => {
                        savedTabButton.click();
                    }, 800);
                } else if (tabButtons.length > 0) {
                    setTimeout(() => {
                        tabButtons[0].click();
                    }, 800);
                }
            } else if (tabButtons.length > 0) {
                setTimeout(() => {
                    tabButtons[0].click();
                }, 800);
            }
        } catch (e) {
            console.warn('Помилка відновлення вкладки:', e.message);
            if (tabButtons.length > 0) {
                setTimeout(() => {
                    tabButtons[0].click();
                }, 800);
            }
        }
    }

    /**
     * ВИПРАВЛЕННЯ 2: Оновлення вмісту вкладки при перемиканні
     */
    function refreshTabContent(tabType, previousTab) {
        console.log(`TaskManager: Оновлення вмісту вкладки ${tabType} (попередня: ${previousTab})`);

        // Завантажуємо контент залежно від типу вкладки
        switch (tabType) {
            case 'social':
                renderSocialTasks();
                renderReferralTasks();
                break;
            case 'limited':
                renderLimitedTasks();
                break;
            case 'partners':
                renderPartnerTasks();
                break;
        }

        // Оновлюємо прогрес-бари
        setTimeout(updateAllProgressBars, 300);

        // Прикріплюємо обробники подій
        setTimeout(attachEventHandlers, 350);

        // Перевіряємо видимість кнопки бонусу
        if (tabType === 'social' && !document.getElementById('claim-daily')) {
            restoreDailyBonusButton();
        }
    }

    /**
     * Перевірка доступності API
     */
    function isApiAvailable() {
        const apiAvailable = window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function';
        const apiPathsAvailable = window.API_PATHS && window.API_PATHS.TASKS;

        if (!apiAvailable) {
            console.error('TaskManager: API не доступне (window.API відсутній або не має методів get/post)');
        }

        if (!apiPathsAvailable) {
            console.error('TaskManager: API_PATHS.TASKS не доступне');
        }

        return apiAvailable && apiPathsAvailable;
    }

    /**
     * Завантаження завдань
     */
    async function loadTasks() {
        console.log('TaskManager: Починаємо завантаження завдань...');

        try {
            // Запобігаємо одночасним запитам
            if (operationStatus.tasksLoading) {
                console.log('TaskManager: Завантаження вже виконується, пропускаємо');
                return;
            }

            // Перевіряємо готовність DOM
            if (!operationStatus.domReady) {
                console.log('TaskManager: DOM не готовий, повторна спроба через 100мс');
                setTimeout(loadTasks, 100);
                return;
            }

            operationStatus.tasksLoading = true;

            // Перевіряємо доступність API
            if (!isApiAvailable()) {
                throw new Error('API_NOT_AVAILABLE');
            }

            // Показуємо покращений індикатор завантаження в контейнерах
            if (domElements.socialTasksContainer) {
                domElements.socialTasksContainer.innerHTML = `
                    <div class="task-loader">
                        <div class="loader-spinner"></div>
                        <span>Завантаження завдань...</span>
                    </div>`;
            }
            if (domElements.limitedTasksContainer) {
                domElements.limitedTasksContainer.innerHTML = `
                    <div class="task-loader">
                        <div class="loader-spinner"></div>
                        <span>Завантаження завдань...</span>
                    </div>`;
            }
            if (domElements.partnersTasksContainer) {
                domElements.partnersTasksContainer.innerHTML = `
                    <div class="task-loader">
                        <div class="loader-spinner"></div>
                        <span>Завантаження завдань...</span>
                    </div>`;
            }
            if (domElements.referralTasksContainer) {
                domElements.referralTasksContainer.innerHTML = `
                    <div class="task-loader">
                        <div class="loader-spinner"></div>
                        <span>Завантаження завдань...</span>
                    </div>`;
            }

            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.warn('TaskManager: ID користувача не знайдено, завантаження може бути обмежене');
                // Продовжуємо виконання, оскільки деякі API можуть не вимагати ID
            }

            // Перевіряємо необхідні API шляхи
            if (!window.API_PATHS.TASKS.SOCIAL) {
                console.error('TaskManager: API_PATHS.TASKS.SOCIAL не знайдено!');
                throw new Error('API_PATH_SOCIAL_NOT_FOUND');
            }

            // Перевіряємо і встановлюємо шлях для реферальних завдань
            if (!window.API_PATHS.TASKS.REFERRAL) {
                console.log('TaskManager: API_PATHS.TASKS.REFERRAL не знайдено, використовуємо SOCIAL');
                window.API_PATHS.TASKS.REFERRAL = window.API_PATHS.TASKS.SOCIAL;
            }

            // Логуємо URL-шляхи які використовуються
            console.log('TaskManager: URL для соціальних завдань =', window.API_PATHS.TASKS.SOCIAL);
            console.log('TaskManager: URL для лімітованих завдань =', window.API_PATHS.TASKS.LIMITED);
            console.log('TaskManager: URL для партнерських завдань =', window.API_PATHS.TASKS.PARTNER);
            console.log('TaskManager: URL для реферальних завдань =', window.API_PATHS.TASKS.REFERRAL);

            try {
                // Спробуємо завантажити соціальні завдання
                console.log('TaskManager: Запит соціальних завдань...');
                const socialResponse = await window.API.get(window.API_PATHS.TASKS.SOCIAL);

                let socialTasksData = extractTasksFromResponse(socialResponse);

                if (socialTasksData.length > 0) {
                    // Розділяємо соціальні й реферальні завдання
                    const { regular, referral } = splitSocialTasks(socialTasksData);
                    socialTasks = regular;
                    referralTasks = referral;

                    // Виконуємо рендеринг тільки якщо активна відповідна вкладка
                    if (activeTabType === 'social') {
                        renderSocialTasks();
                        renderReferralTasks();
                    }
                } else {
                    if (domElements.socialTasksContainer && activeTabType === 'social') {
                        domElements.socialTasksContainer.innerHTML =
                            '<div class="no-tasks">Завдання не знайдені. Спробуйте пізніше.</div>';
                    }
                    if (domElements.referralTasksContainer && activeTabType === 'social') {
                        domElements.referralTasksContainer.innerHTML =
                            '<div class="no-tasks">Реферальні завдання не знайдені.</div>';
                    }
                }

                // Завантажуємо лімітовані завдання
                console.log('TaskManager: Запит лімітованих завдань...');
                const limitedResponse = await window.API.get(window.API_PATHS.TASKS.LIMITED);
                let limitedTasksData = extractTasksFromResponse(limitedResponse);

                if (limitedTasksData.length > 0) {
                    limitedTasks = normalizeTasksData(limitedTasksData);

                    // Виконуємо рендеринг тільки якщо активна відповідна вкладка
                    if (activeTabType === 'limited') {
                        renderLimitedTasks();
                    }
                } else if (domElements.limitedTasksContainer && activeTabType === 'limited') {
                    domElements.limitedTasksContainer.innerHTML =
                        '<div class="no-tasks">Лімітовані завдання не знайдені.</div>';
                }

                // Завантажуємо партнерські завдання
                console.log('TaskManager: Запит партнерських завдань...');
                const partnerResponse = await window.API.get(window.API_PATHS.TASKS.PARTNER);
                let partnerTasksData = extractTasksFromResponse(partnerResponse);

                if (partnerTasksData.length > 0) {
                    partnerTasks = normalizeTasksData(partnerTasksData);

                    // Виконуємо рендеринг тільки якщо активна відповідна вкладка
                    if (activeTabType === 'partners') {
                        renderPartnerTasks();
                    }
                } else if (domElements.partnersTasksContainer && activeTabType === 'partners') {
                    domElements.partnersTasksContainer.innerHTML =
                        '<div class="no-tasks">Партнерські завдання не знайдені.</div>';
                }

                // Завантажуємо прогрес користувача, якщо є ID
                if (userId) {
                    try {
                        console.log('TaskManager: Запит прогресу користувача...');
                        // ВИПРАВЛЕНО: змінено шлях до ендпоінту прогресу користувача
                        const progressResponse = await window.API.get('quests/user-progress/all');

                        if (progressResponse.status === 'success' && progressResponse.data) {
                            userProgress = progressResponse.data;
                            console.log('TaskManager: Прогрес користувача отримано');

                            // Оновлюємо відображення з урахуванням прогресу
                            refreshActiveTab();
                        }
                    } catch (progressError) {
                        console.warn('TaskManager: Помилка отримання прогресу користувача:', progressError);

                        // Спробуємо альтернативний шлях
                        try {
                            const alternativeProgressResponse = await window.API.get('quests/user-progress');
                            if (alternativeProgressResponse.status === 'success' && alternativeProgressResponse.data) {
                                userProgress = alternativeProgressResponse.data;
                                console.log('TaskManager: Прогрес користувача отримано через альтернативний ендпоінт');
                                refreshActiveTab();
                            }
                        } catch (altError) {
                            console.warn('TaskManager: Помилка отримання прогресу через альтернативний ендпоінт:', altError);
                        }
                    }
                }

            } catch (error) {
                console.error('TaskManager: Помилка при виконанні запиту:', error);

                // Показуємо стильне повідомлення про помилку в контейнерах
                const errorHtml = `
                    <div class="no-tasks">
                        <div style="margin-bottom: 10px; color: #f44336;">🔄 Помилка завантаження завдань</div>
                        <div style="font-size: 14px; opacity: 0.8;">Перевірте з'єднання з інтернетом або спробуйте пізніше</div>
                        <button class="action-button" style="margin-top: 15px; padding: 8px 15px;" onclick="window.TaskManager.loadTasks()">
                            Спробувати знову
                        </button>
                    </div>`;

                if (domElements.socialTasksContainer && activeTabType === 'social') {
                    domElements.socialTasksContainer.innerHTML = errorHtml;
                }
                if (domElements.limitedTasksContainer && activeTabType === 'limited') {
                    domElements.limitedTasksContainer.innerHTML = errorHtml;
                }
                if (domElements.partnersTasksContainer && activeTabType === 'partners') {
                    domElements.partnersTasksContainer.innerHTML = errorHtml;
                }
                if (domElements.referralTasksContainer && activeTabType === 'social') {
                    domElements.referralTasksContainer.innerHTML = errorHtml;
                }

                // Генеруємо подію про помилку
                document.dispatchEvent(new CustomEvent('tasks-loading-error', {
                    detail: { error: error }
                }));
            }

        } catch (error) {
            console.error('TaskManager: Загальна помилка завантаження завдань:', error);

            // Показуємо загальне повідомлення про помилку
            showErrorMessage('Не вдалося завантажити завдання: ' + error.message);

            // Генеруємо подію про помилку
            document.dispatchEvent(new CustomEvent('tasks-loading-error', {
                detail: { error: error }
            }));
        } finally {
            operationStatus.tasksLoading = false;
            console.log('TaskManager: Завершено спробу завантаження завдань');

            // Генеруємо подію про завершення завантаження
            document.dispatchEvent(new CustomEvent('tasks-loading-completed'));
        }
    }

    /**
     * Оновлення відображення лише для активної вкладки
     */
    function refreshActiveTab() {
        console.log('TaskManager: Оновлення активної вкладки:', activeTabType);

        switch (activeTabType) {
            case 'social':
                renderSocialTasks();
                renderReferralTasks();
                break;
            case 'limited':
                renderLimitedTasks();
                break;
            case 'partners':
                renderPartnerTasks();
                break;
        }

        // Додаємо додаткову затримку для прикріплення обробників
        setTimeout(attachEventHandlers, 300);

        // ДОДАНО: Виправляємо прогрес-бари
        setTimeout(updateAllProgressBars, 500);
    }

    /**
     * Допоміжна функція для витягування завдань з відповіді
     */
    function extractTasksFromResponse(response) {
        let tasksData = [];

        if (response.status === 'success' && response.data && response.data.tasks) {
            tasksData = response.data.tasks;
        } else if (response.status === 'success' && response.data && Array.isArray(response.data)) {
            tasksData = response.data;
        } else if (response.success && response.data) {
            tasksData = Array.isArray(response.data) ? response.data :
                (response.data.tasks || []);
        } else if (Array.isArray(response)) {
            tasksData = response;
        } else if (response.tasks && Array.isArray(response.tasks)) {
            tasksData = response.tasks;
        }

        return tasksData;
    }

    /**
     * Розділення соціальних завдань на звичайні та реферальні
     */
    function splitSocialTasks(tasks) {
        const regular = [];
        const referral = [];

        tasks.forEach(task => {
            if (task.tags && Array.isArray(task.tags) && task.tags.includes('referral')) {
                referral.push(task);
            } else if (task.type === 'referral' ||
                       (task.title && task.title.toLowerCase().includes('referral')) ||
                       (task.title && task.title.toLowerCase().includes('запроси')) ||
                       (task.title && task.title.toLowerCase().includes('запросити'))) {
                referral.push(task);
            } else {
                regular.push(task);
            }
        });

        console.log('TaskManager: Розділення завдань - звичайні:', regular.length, 'реферальні:', referral.length);
        return { regular, referral };
    }

    /**
     * Нормалізація даних завдань
     */
    function normalizeTasksData(tasks) {
        console.log('TaskManager: Нормалізація даних завдань, отримано:', tasks.length, 'завдань');

        if (!Array.isArray(tasks)) {
            console.warn('TaskManager: tasks не є масивом, тип:', typeof tasks);
            return [];
        }

        return tasks.map(task => {
            // Створюємо копію завдання
            const normalizedTask = { ...task };

            // Перевіряємо наявність обов'язкових полів
            normalizedTask.id = normalizedTask.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            normalizedTask.title = normalizedTask.title || 'Завдання';
            normalizedTask.description = normalizedTask.description || 'Опис завдання';

            // Нормалізуємо тип винагороди
            if (normalizedTask.reward_type) {
                const lowerType = normalizedTask.reward_type.toLowerCase();
                if (safeIncludes(lowerType, 'token') || safeIncludes(lowerType, 'winix')) {
                    normalizedTask.reward_type = REWARD_TYPES.TOKENS;
                } else if (safeIncludes(lowerType, 'coin') || safeIncludes(lowerType, 'жетон')) {
                    normalizedTask.reward_type = REWARD_TYPES.COINS;
                }
            } else {
                normalizedTask.reward_type = REWARD_TYPES.TOKENS;
            }

            // Нормалізуємо суму винагороди
            normalizedTask.reward_amount = parseFloat(normalizedTask.reward_amount) || 10;

            // Нормалізуємо цільове значення
            normalizedTask.target_value = parseInt(normalizedTask.target_value) || 1;

            return normalizedTask;
        });
    }

    /**
     * Відображення соціальних завдань
     */
    function renderSocialTasks() {
        console.log('TaskManager: Відображення соціальних завдань, кількість:', socialTasks.length);

        if (!domElements.socialTasksContainer) {
            console.warn('TaskManager: Контейнер для соціальних завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.socialTasksContainer.innerHTML = '';

        if (socialTasks.length === 0) {
            domElements.socialTasksContainer.innerHTML =
                '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        socialTasks.forEach((task, index) => {
            if (window.SocialTask && typeof window.SocialTask.create === 'function') {
                try {
                    const taskElement = window.SocialTask.create(task, userProgress[task.id]);

                    // Додаємо затримку для анімації появи, якщо увімкнено
                    if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                        taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                        taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;

                        // Додаємо клас show з затримкою для плавної анімації
                        setTimeout(() => {
                            taskElement.classList.add('show');
                        }, 50);
                    } else {
                        taskElement.classList.add('show');
                    }

                    domElements.socialTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента соціального завдання:', error);
                    // Запасний варіант
                    domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
                }
            } else {
                console.warn('TaskManager: SocialTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант з анімацією
                const taskHtml = createBasicTaskElement(task, userProgress[task.id]);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = taskHtml;
                const taskElement = tempDiv.firstChild;

                if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                    taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                    taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;
                    setTimeout(() => {
                        taskElement.classList.add('show');
                    }, 50);
                } else {
                    taskElement.classList.add('show');
                }

                domElements.socialTasksContainer.appendChild(taskElement);
            }
        });

        // Прикріплюємо обробники подій до нових елементів
        setTimeout(attachEventHandlers, 100);

        // ДОДАНО: Виправляємо прогрес-бари
        setTimeout(updateAllProgressBars, 300);
    }

    /**
     * Відображення реферальних завдань
     */
    function renderReferralTasks() {
        console.log('TaskManager: Відображення реферальних завдань, кількість:', referralTasks.length);

        if (!domElements.referralTasksContainer) {
            console.warn('TaskManager: Контейнер для реферальних завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.referralTasksContainer.innerHTML = '';

        if (referralTasks.length === 0) {
            domElements.referralTasksContainer.innerHTML =
                '<div class="no-tasks">Немає доступних реферальних завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        referralTasks.forEach((task, index) => {
            if (window.SocialTask && typeof window.SocialTask.create === 'function') {
                try {
                    const taskElement = window.SocialTask.create(task, userProgress[task.id]);

                    // Додаємо затримку для анімації появи, якщо увімкнено
                    if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                        taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                        taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;

                        // Додаємо клас show з затримкою для плавної анімації
                        setTimeout(() => {
                            taskElement.classList.add('show');
                        }, 50);
                    } else {
                        taskElement.classList.add('show');
                    }

                    domElements.referralTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента реферального завдання:', error);
                    // Запасний варіант
                    domElements.referralTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
                }
            } else {
                console.warn('TaskManager: SocialTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант з анімацією
                const taskHtml = createBasicTaskElement(task, userProgress[task.id]);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = taskHtml;
                const taskElement = tempDiv.firstChild;

                if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                    taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                    taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;
                    setTimeout(() => {
                        taskElement.classList.add('show');
                    }, 50);
                } else {
                    taskElement.classList.add('show');
                }

                domElements.referralTasksContainer.appendChild(taskElement);
            }
        });

        // Прикріплюємо обробники подій до нових елементів
        setTimeout(attachEventHandlers, 100);

        // ДОДАНО: Виправляємо прогрес-бари
        setTimeout(updateAllProgressBars, 300);
    }

    /**
     * Відображення лімітованих завдань
     */
    function renderLimitedTasks() {
        console.log('TaskManager: Відображення лімітованих завдань, кількість:', limitedTasks.length);

        if (!domElements.limitedTasksContainer) {
            console.warn('TaskManager: Контейнер для лімітованих завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.limitedTasksContainer.innerHTML = '';

        if (limitedTasks.length === 0) {
            domElements.limitedTasksContainer.innerHTML =
                '<div class="no-tasks">Немає доступних лімітованих завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        limitedTasks.forEach((task, index) => {
            if (window.LimitedTask && typeof window.LimitedTask.create === 'function') {
                try {
                    const taskElement = window.LimitedTask.create(task, userProgress[task.id]);

                    // Додаємо затримку для анімації появи, якщо увімкнено
                    if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                        taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                        taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;

                        // Додаємо клас show з затримкою для плавної анімації
                        setTimeout(() => {
                            taskElement.classList.add('show');
                        }, 50);
                    } else {
                        taskElement.classList.add('show');
                    }

                    domElements.limitedTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента лімітованого завдання:', error);
                    // Запасний варіант
                    domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
                }
            } else {
                console.warn('TaskManager: LimitedTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант з анімацією
                const taskHtml = createBasicTaskElement(task, userProgress[task.id], true);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = taskHtml;
                const taskElement = tempDiv.firstChild;

                if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                    taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                    taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;
                    setTimeout(() => {
                        taskElement.classList.add('show');
                    }, 50);
                } else {
                    taskElement.classList.add('show');
                }

                domElements.limitedTasksContainer.appendChild(taskElement);
            }
        });

        // Прикріплюємо обробники подій до нових елементів
        setTimeout(attachEventHandlers, 100);

        // ДОДАНО: Виправляємо прогрес-бари
        setTimeout(updateAllProgressBars, 300);
    }

    /**
     * Відображення партнерських завдань
     */
    function renderPartnerTasks() {
        console.log('TaskManager: Відображення партнерських завдань, кількість:', partnerTasks.length);

        if (!domElements.partnersTasksContainer) {
            console.warn('TaskManager: Контейнер для партнерських завдань не знайдено');
            return;
        }

        // Очищаємо контейнер
        domElements.partnersTasksContainer.innerHTML = '';

        if (partnerTasks.length === 0) {
            domElements.partnersTasksContainer.innerHTML =
                '<div class="no-tasks">Немає доступних партнерських завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        partnerTasks.forEach((task, index) => {
            if (window.PartnerTask && typeof window.PartnerTask.create === 'function') {
                try {
                    const taskElement = window.PartnerTask.create(task, userProgress[task.id]);

                    // Додаємо затримку для анімації появи, якщо увімкнено
                    if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                        taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                        taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;

                        // Додаємо клас show з затримкою для плавної анімації
                        setTimeout(() => {
                            taskElement.classList.add('show');
                        }, 50);
                    } else {
                        taskElement.classList.add('show');
                    }

                    domElements.partnersTasksContainer.appendChild(taskElement);
                } catch (error) {
                    console.error('TaskManager: Помилка створення елемента партнерського завдання:', error);
                    // Запасний варіант
                    domElements.partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
                }
            } else {
                console.warn('TaskManager: PartnerTask.create не знайдено, використовуємо базовий шаблон');
                // Запасний варіант з анімацією
                const taskHtml = createBasicTaskElement(task, userProgress[task.id]);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = taskHtml;
                const taskElement = tempDiv.firstChild;

                if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                    taskElement.style.transitionDuration = `${animationConfig.taskAppearDuration}ms`;
                    taskElement.style.transitionDelay = `${index * animationConfig.taskAppearDelay}ms`;
                    setTimeout(() => {
                        taskElement.classList.add('show');
                    }, 50);
                } else {
                    taskElement.classList.add('show');
                }

                domElements.partnersTasksContainer.appendChild(taskElement);
            }
        });

        // Прикріплюємо обробники подій до нових елементів
        setTimeout(attachEventHandlers, 100);

        // ДОДАНО: Виправляємо прогрес-бари
        setTimeout(updateAllProgressBars, 300);
    }

    /**
     * Оновлення всіх завдань
     */
    function refreshAllTasks() {
        console.log('TaskManager: Оновлення всіх завдань');

        // Оновлюємо тільки активну вкладку для підвищення продуктивності
        refreshActiveTab();

        // Додаємо невелику затримку, щоб дати DOM оновитися
        setTimeout(() => {
            // Прикріплюємо обробники подій до кнопок
            attachEventHandlers();

            // Перевіряємо наявність кнопки бонусу
            if (activeTabType === 'social' && !document.getElementById('claim-daily')) {
                restoreDailyBonusButton();
            }

            // Оновлюємо всі прогрес-бари
            updateAllProgressBars();
        }, 300);
    }

    /**
     * Додавання обробників до кнопок завдань
     */
    function attachEventHandlers() {
        // Прикріплюємо обробники подій до всіх кнопок дій
        document.querySelectorAll('.action-button[data-action]').forEach(button => {
            // Перевіряємо, чи вже додано обробник
            if (button.getAttribute('data-handler-attached') === 'true') {
                return;
            }

            // Отримуємо дані кнопки
            const action = button.getAttribute('data-action');
            const taskId = button.getAttribute('data-task-id');

            if (!taskId) return;

            // Додаємо обробник відповідно до дії
            if (action === 'start') {
                button.addEventListener('click', function() {
                    startTask(taskId);
                });
            } else if (action === 'verify') {
                button.addEventListener('click', function() {
                    verifyTask(taskId);
                });
            }

            // Позначаємо, що обробник прикріплено
            button.setAttribute('data-handler-attached', 'true');
        });
    }

    /**
     * Оновлення відображення конкретного завдання
     * @param {string} taskId - ID завдання
     */
    function refreshTaskDisplay(taskId) {
        console.log('TaskManager: Оновлення відображення завдання:', taskId);

        // Перебираємо всі типи завдань
        [socialTasks, referralTasks, limitedTasks, partnerTasks].forEach((taskArray, index) => {
            const task = taskArray.find(t => t.id === taskId);
            if (task) {
                // Визначаємо, до якого контейнера відноситься завдання
                let container;
                switch (index) {
                    case 0: container = domElements.socialTasksContainer; break;
                    case 1: container = domElements.referralTasksContainer; break;
                    case 2: container = domElements.limitedTasksContainer; break;
                    case 3: container = domElements.partnersTasksContainer; break;
                }

                if (container) {
                    // Знаходимо елемент завдання
                    const taskElement = container.querySelector(`[data-task-id="${taskId}"]`);
                    if (taskElement) {
                        // Визначаємо тип завдання і використовуємо відповідний компонент
                        try {
                            let newTaskElement;

                            switch (index) {
                                case 0:
                                case 1:
                                    if (window.SocialTask && typeof window.SocialTask.create === 'function') {
                                        newTaskElement = window.SocialTask.create(task, userProgress[task.id]);
                                    }
                                    break;
                                case 2:
                                    if (window.LimitedTask && typeof window.LimitedTask.create === 'function') {
                                        newTaskElement = window.LimitedTask.create(task, userProgress[task.id]);
                                    }
                                    break;
                                case 3:
                                    if (window.PartnerTask && typeof window.PartnerTask.create === 'function') {
                                        newTaskElement = window.PartnerTask.create(task, userProgress[task.id]);
                                    }
                                    break;
                            }

                            // Якщо вдалося створити новий елемент, замінюємо старий
                            if (newTaskElement) {
                                // Зберігаємо класи анімації
                                if (taskElement.classList.contains('show')) {
                                    newTaskElement.classList.add('show');
                                }

                                // Анімуємо оновлення, якщо увімкнено
                                if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                                    taskElement.style.transition = 'opacity 0.3s ease';
                                    taskElement.style.opacity = '0';

                                    setTimeout(() => {
                                        // Замінюємо елемент
                                        taskElement.replaceWith(newTaskElement);

                                        // Анімуємо появу нового елемента
                                        setTimeout(() => {
                                            newTaskElement.style.opacity = '1';

                                            // Додаємо обробники до кнопок нового елемента
                                            const buttons = newTaskElement.querySelectorAll('.action-button[data-action]');
                                            buttons.forEach(button => {
                                                const action = button.getAttribute('data-action');
                                                if (action === 'start') {
                                                    button.addEventListener('click', () => startTask(taskId));
                                                } else if (action === 'verify') {
                                                    button.addEventListener('click', () => verifyTask(taskId));
                                                }
                                                button.setAttribute('data-handler-attached', 'true');
                                            });

                                            // Оновлюємо прогрес-бар
                                            updateProgressBarForTask(newTaskElement);
                                        }, 50);
                                    }, 300);
                                } else {
                                    // Замінюємо без анімації
                                    taskElement.replaceWith(newTaskElement);

                                    // Додаємо обробники до кнопок нового елемента
                                    const buttons = newTaskElement.querySelectorAll('.action-button[data-action]');
                                    buttons.forEach(button => {
                                        const action = button.getAttribute('data-action');
                                        if (action === 'start') {
                                            button.addEventListener('click', () => startTask(taskId));
                                        } else if (action === 'verify') {
                                            button.addEventListener('click', () => verifyTask(taskId));
                                        }
                                        button.setAttribute('data-handler-attached', 'true');
                                    });

                                    // Оновлюємо прогрес-бар
                                    updateProgressBarForTask(newTaskElement);
                                }
                            } else {
                                // Запасний варіант - оновлюємо через innerHTML
                                const isLimited = index === 2; // Це лімітоване завдання
                                const newTaskHtml = createBasicTaskElement(task, userProgress[task.id], isLimited);

                                // Створюємо тимчасовий елемент
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = newTaskHtml;
                                const newElement = tempDiv.firstChild;

                                // Додаємо клас show, якщо він був
                                if (taskElement.classList.contains('show')) {
                                    newElement.classList.add('show');
                                }

                                // Анімуємо оновлення, якщо увімкнено
                                if (animationConfig.enabled && !animationConfig.useReducedMotion) {
                                    taskElement.style.transition = 'opacity 0.3s ease';
                                    taskElement.style.opacity = '0';

                                    setTimeout(() => {
                                        taskElement.replaceWith(newElement);

                                        setTimeout(() => {
                                            newElement.style.opacity = '1';

                                            // Додаємо обробники до кнопок
                                            attachEventHandlers();

                                            // Оновлюємо прогрес-бар
                                            updateProgressBarForTask(newElement);
                                        }, 50);
                                    }, 300);
                                } else {
                                    // Замінюємо без анімації
                                    taskElement.replaceWith(newElement);

                                    // Додаємо обробники до кнопок
                                    attachEventHandlers();

                                    // Оновлюємо прогрес-бар
                                    updateProgressBarForTask(newElement);
                                }
                            }
                        } catch (error) {
                            console.error('TaskManager: Помилка оновлення елемента завдання:', error);
                            // Запасний варіант - оновлюємо через innerHTML
                            const isLimited = index === 2; // Це лімітоване завдання
                            taskElement.outerHTML = createBasicTaskElement(task, userProgress[task.id], isLimited);

                            // Прикріплюємо обробники після оновлення DOM
                            setTimeout(attachEventHandlers, 50);

                            // Оновлюємо прогрес-бар для нового елемента
                            setTimeout(() => {
                                const newElement = container.querySelector(`[data-task-id="${taskId}"]`);
                                if (newElement) {
                                    updateProgressBarForTask(newElement);
                                }
                            }, 100);
                        }
                    }
                }
            }
        });
    }

    /**
     * Запуск завдання
     * @param {string} taskId - ID завдання
     */
    async function startTask(taskId) {
        console.log('TaskManager: Запуск завдання:', taskId);

        try {
            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.error('TaskManager: ID користувача не знайдено, неможливо запустити завдання');
                showErrorMessage('Для виконання завдання необхідно авторизуватися');
                return false;
            }

            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) {
                console.error('TaskManager: Завдання не знайдено:', taskId);
                showErrorMessage('Завдання не знайдено');
                return false;
            }

            // Знаходимо кнопку та додаємо клас завантаження
            const button = document.querySelector(`.action-button[data-task-id="${taskId}"][data-action="start"]`);
            if (button) {
                button.disabled = true;
                button.textContent = 'Завантаження...';

                if (animationConfig.enabled) {
                    button.style.opacity = '0.7';

                    // Додаємо анімацію завантаження
                    const loadingElement = document.createElement('div');
                    loadingElement.style.position = 'absolute';
                    loadingElement.style.top = '50%';
                    loadingElement.style.left = '50%';
                    loadingElement.style.transform = 'translate(-50%, -50%)';
                    loadingElement.style.width = '20px';
                    loadingElement.style.height = '20px';
                    loadingElement.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                    loadingElement.style.borderTop = '2px solid white';
                    loadingElement.style.borderRadius = '50%';
                    loadingElement.style.animation = 'spin 1s linear infinite';

                    button.appendChild(loadingElement);
                }
            }

            // Виконуємо запит до API
            const response = await window.API.post(`quests/tasks/${taskId}/start`);

            if (response.status === 'success' || response.success) {
                console.log('TaskManager: Завдання успішно запущено:', taskId);

                // Відновлюємо кнопку
                if (button) {
                    button.disabled = false;
                    button.textContent = task.action_label || 'Виконати';
                    button.style.opacity = '1';
                }

                // Оновлюємо прогрес
                if (response.data && response.data.progress) {
                    userProgress[taskId] = response.data.progress;
                } else {
                    // Встановлюємо базовий прогрес, якщо він не повернувся з сервера
                    userProgress[taskId] = userProgress[taskId] || {
                        status: 'started',
                        progress_value: 0,
                        task_id: taskId
                    };
                }

                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Показуємо користувачу повідомлення про успіх
                if (window.UI && window.UI.Notifications && typeof window.UI.Notifications.showSuccess === 'function') {
                    window.UI.Notifications.showSuccess('Завдання активовано!');
                } else if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage('Завдання активовано!');
                }

                // Якщо є URL дії, відкриваємо його
                if (task.action_url) {
                    // Пробуємо використати SocialTask для безпечної валідації URL
                    if (window.SocialTask && typeof window.SocialTask.validateUrl === 'function') {
                        const safeUrl = window.SocialTask.validateUrl(task.action_url);
                        if (safeUrl) {
                            // Додаємо невелику затримку перед відкриттям URL
                            setTimeout(() => {
                                window.open(safeUrl, '_blank', 'noopener,noreferrer');
                            }, 300);
                        } else {
                            showErrorMessage('Неможливо відкрити це посилання через проблеми безпеки');
                        }
                    } else {
                        // Запасний варіант - просто відкриваємо URL
                        setTimeout(() => {
                            window.open(task.action_url, '_blank', 'noopener,noreferrer');
                        }, 300);
                    }
                }

                return true;
            } else {
                console.error('TaskManager: Помилка запуску завдання:', response.message || 'Невідома помилка');

                // Відновлюємо кнопку
                if (button) {
                    button.disabled = false;
                    button.textContent = task.action_label || 'Виконати';
                    button.style.opacity = '1';
                }

                showErrorMessage(response.message || 'Помилка запуску завдання');
                return false;
            }
        } catch (error) {
            console.error('TaskManager: Помилка запуску завдання:', error);
            showErrorMessage('Не вдалося запустити завдання: ' + error.message);
            return false;
        }
    }

    /**
     * Перевірка виконання завдання
     * @param {string} taskId - ID завдання
     */
    async function verifyTask(taskId) {
        console.log('TaskManager: Перевірка виконання завдання:', taskId);

        try {
            // Запобігаємо повторним запитам для одного завдання
            if (operationStatus.verificationInProgress[taskId]) {
                console.log('TaskManager: Перевірка вже виконується для завдання', taskId);
                return false;
            }

            operationStatus.verificationInProgress[taskId] = true;

            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.error('TaskManager: ID користувача не знайдено, неможливо перевірити завдання');
                showErrorMessage('Для перевірки завдання необхідно авторизуватися');
                operationStatus.verificationInProgress[taskId] = false;
                return false;
            }

            // Знаходимо кнопку та додаємо клас завантаження
            const button = document.querySelector(`.action-button[data-task-id="${taskId}"][data-action="verify"]`);
            if (button) {
                button.disabled = true;
                button.textContent = 'Перевірка...';

                if (animationConfig.enabled) {
                    button.style.opacity = '0.7';

                    // Додаємо анімацію завантаження
                    const loadingElement = document.createElement('div');
                    loadingElement.style.position = 'absolute';
                    loadingElement.style.top = '50%';
                    loadingElement.style.left = '50%';
                    loadingElement.style.transform = 'translate(-50%, -50%)';
                    loadingElement.style.width = '20px';
                    loadingElement.style.height = '20px';
                    loadingElement.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                    loadingElement.style.borderTop = '2px solid white';
                    loadingElement.style.borderRadius = '50%';
                    loadingElement.style.animation = 'spin 1s linear infinite';

                    button.appendChild(loadingElement);
                }
            }

            // Виконуємо запит до API
            const response = await window.API.post(`quests/tasks/${taskId}/verify`);

            if (response.status === 'success' || response.success) {
                console.log('TaskManager: Завдання успішно перевірено:', taskId);

                // Оновлюємо прогрес
                if (response.data && response.data.progress) {
                    userProgress[taskId] = response.data.progress;
                } else if (response.progress) {
                    userProgress[taskId] = response.progress;
                } else {
                    // Встановлюємо прогрес як завершений
                    userProgress[taskId] = userProgress[taskId] || {};
                    userProgress[taskId].status = 'completed';
                    userProgress[taskId].progress_value = userProgress[taskId].target_value || 1;
                }

                // Оновлюємо відображення з анімацією
                const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
                if (taskElement && animationConfig.enabled && !animationConfig.useReducedMotion) {
                    // Додаємо клас для анімації успіху
                    taskElement.classList.add('success-pulse');

                    // Створюємо ефект частинок для наочності
                    createCompletionParticles(taskElement);

                    // Через 1 секунду оновлюємо відображення
                    setTimeout(() => {
                        taskElement.classList.remove('success-pulse');
                        refreshTaskDisplay(taskId);
                    }, 1000);
                } else {
                    // Оновлюємо без анімації
                    refreshTaskDisplay(taskId);
                }

                // Показуємо повідомлення про успіх з використанням UI.Notifications, якщо доступно
                if (window.UI && window.UI.Notifications && typeof window.UI.Notifications.showSuccess === 'function') {
                    window.UI.Notifications.showSuccess(response.message || 'Завдання успішно виконано!');
                } else {
                    showSuccessMessage(response.message || 'Завдання успішно виконано!');
                }

                // Якщо є винагорода, оновлюємо баланс
                if (response.data && response.data.reward) {
                    updateBalance(response.data.reward);
                } else if (response.reward) {
                    updateBalance(response.reward);
                }

                // Запам'ятовуємо час останньої перевірки
                operationStatus.lastVerificationTime[taskId] = Date.now();

                operationStatus.verificationInProgress[taskId] = false;
                return true;
            } else {
                console.error('TaskManager: Помилка перевірки завдання:', response.message || 'Невідома помилка');

                // Відновлюємо кнопку
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Перевірити';
                    button.style.opacity = '1';
                }

                // Показуємо повідомлення про помилку
                showErrorMessage(response.message || 'Помилка перевірки завдання');

                operationStatus.verificationInProgress[taskId] = false;
                return false;
            }
        } catch (error) {
            console.error('TaskManager: Помилка перевірки завдання:', error);

            // Відновлюємо кнопку, якщо вона є
            const button = document.querySelector(`.action-button[data-task-id="${taskId}"][data-action="verify"]`);
            if (button) {
                button.disabled = false;
                button.textContent = 'Перевірити';
                button.style.opacity = '1';
            }

            showErrorMessage('Не вдалося перевірити завдання: ' + error.message);
            operationStatus.verificationInProgress[taskId] = false;
            return false;
        }
    }

    /**
     * Оновлення балансу користувача
     * @param {Object} reward - Інформація про винагороду
     */
    function updateBalance(reward) {
        // Спочатку пробуємо використати TaskRewards
        if (window.TaskRewards && typeof window.TaskRewards.updateBalance === 'function') {
            window.TaskRewards.updateBalance(reward);
            return;
        }

        // Пробуємо використати Core
        if (window.WinixCore && typeof window.WinixCore.updateLocalBalance === 'function') {
            if (reward.type === REWARD_TYPES.COINS) {
                // Оновлюємо жетони
                const amount = parseFloat(reward.amount) || 0;
                window.WinixCore.updateLocalBalance(amount, 'task_reward', true);
            } else {
                // Для токенів наразі немає окремої функції
                console.log('TaskManager: Отримано винагороду в токенах:', reward.amount);
            }
            return;
        }

        // Запасний варіант - оновлюємо через DOM
        try {
            if (reward.type === REWARD_TYPES.TOKENS) {
                const tokensElement = document.getElementById('user-tokens');
                if (tokensElement) {
                    const currentBalance = parseFloat(tokensElement.textContent) || 0;
                    const newBalance = currentBalance + parseFloat(reward.amount);
                    tokensElement.textContent = newBalance.toFixed(2);

                   // Додаємо преміальну анімацію оновлення
                    coinsElement.classList.add('increasing');
                    setTimeout(() => {
                        coinsElement.classList.remove('increasing');
                    }, 2000);

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('userCoins', newBalance.toString());
                    } catch (e) {
                        console.warn('TaskManager: Помилка збереження балансу в localStorage:', e);
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
        } catch (e) {
            console.error('TaskManager: Помилка оновлення балансу:', e);
        }
    }

    /**
     * Пошук завдання за ID
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Знайдене завдання або null
     */
    function findTaskById(taskId) {
        // Перебираємо всі масиви завдань
        return socialTasks.find(t => t.id === taskId) ||
               referralTasks.find(t => t.id === taskId) ||
               limitedTasks.find(t => t.id === taskId) ||
               partnerTasks.find(t => t.id === taskId) ||
               null;
    }

    /**
     * Оновлення прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     */
    function updateTaskProgress(taskId, progressData) {
        console.log('TaskManager: Оновлення прогресу завдання:', taskId, progressData);

        // Перевіряємо наявність TaskProgressManager
        if (window.TaskProgressManager && typeof window.TaskProgressManager.updateTaskProgress === 'function') {
            // Делегуємо оновлення до TaskProgressManager
            return window.TaskProgressManager.updateTaskProgress(taskId, progressData);
        }

        // Запасний варіант - оновлюємо локально
        userProgress[taskId] = { ...userProgress[taskId], ...progressData };

        // Оновлюємо відображення
        refreshTaskDisplay(taskId);

        // Генеруємо подію про оновлення прогресу
        document.dispatchEvent(new CustomEvent('task-progress-updated', {
            detail: {
                taskId: taskId,
                progressData: progressData,
                source: 'TaskManager'
            }
        }));

        return true;
    }

    /**
     * Отримання прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Прогрес завдання або null
     */
    function getTaskProgress(taskId) {
        // Перевіряємо наявність TaskProgressManager
        if (window.TaskProgressManager && typeof window.TaskProgressManager.getTaskProgress === 'function') {
            // Делегуємо отримання до TaskProgressManager
            return window.TaskProgressManager.getTaskProgress(taskId);
        }

        // Запасний варіант - повертаємо локальний прогрес
        return userProgress[taskId] || null;
    }

    /**
     * Створення частинок для анімації завершення завдання
     * @param {HTMLElement} element - DOM елемент завдання
     */
    function createCompletionParticles(element) {
        if (!element || !animationConfig.enabled || animationConfig.useReducedMotion) return;

        // Кількість частинок
        const particleCount = 20;

        // Кольори частинок
        const colors = ['#4eb5f7', '#00C9A7', '#4CAF50', '#FFD700'];

        // Розміри і позиція елемента
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Створюємо контейнер для частинок, якщо його ще немає
        let container = document.getElementById('particles-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'particles-container';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }

        // Створюємо частинки
        for (let i = 0; i < particleCount; i++) {
            // Створюємо елемент частинки
            const particle = document.createElement('div');

            // Випадковий розмір між 6 і 14 пікселів
            const size = Math.random() * 8 + 6;

            // Стилізуємо частинку
            particle.style.position = 'absolute';
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            particle.style.pointerEvents = 'none';
            particle.style.boxShadow = '0 0 5px rgba(0, 201, 167, 0.8)';
            particle.style.zIndex = '1000';
            particle.style.transform = 'translate(-50%, -50%)';

            // Додаємо частинку до контейнера
            container.appendChild(particle);

            // Анімуємо частинку
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 120 + 60;
            const duration = Math.random() * 1000 + 800;

            // Створюємо анімацію для частинки
            particle.animate([
                {
                    transform: 'translate(-50%, -50%) scale(0.3)',
                    opacity: 1
                },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1) rotate(${Math.random() * 360}deg)`,
                    opacity: 0
                }
            ], {
                duration: duration,
                easing: 'cubic-bezier(0.11, 0.8, 0.67, 1.4)',
                fill: 'forwards'
            });

            // Видаляємо частинку після завершення анімації
            setTimeout(() => {
                particle.remove();
            }, duration);
        }
    }

    /**
     * Створення базового елементу завдання (запасний варіант)
     */
    function createBasicTaskElement(task, progress, isLimited = false) {
        const completed = progress && progress.status === 'completed';
        const started = progress && progress.status === 'started';
        const progressValue = progress ? progress.progress_value : 0;
        const progressPercent = Math.min(100, Math.round((progressValue / task.target_value) * 100)) || 0;

        // Форматуємо тип нагороди
        const rewardType = task.reward_type === REWARD_TYPES.TOKENS ? '$WINIX' : 'жетонів';

        let timerHtml = '';
        if (isLimited && task.end_date) {
            const endDate = new Date(task.end_date);
            const now = new Date();
            const timeLeft = endDate - now;

            if (timeLeft > 0) {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                timerHtml = `<div class="timer-container"><span class="timer-icon">⏰</span> <span class="timer-value" data-end-date="${task.end_date}">${days}д ${hours}г</span></div>`;
            } else {
                timerHtml = `<div class="timer-container expired"><span class="timer-icon">⏰</span> <span data-lang-key="earn.expired">Закінчено</span></div>`;
            }
        }

        // Додаємо інформацію про партнера, якщо є
        let partnerLabel = '';
        if (task.partner_name) {
            partnerLabel = `<div class="partner-label">Партнер: ${escapeHtml(task.partner_name)}</div>`;
        }

        // Вибираємо кнопки для відображення залежно від статусу
        let actionButtons = '';
        if (completed) {
            actionButtons = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
        } else if (started) {
            actionButtons = `<button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`;
        } else {
            actionButtons = `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>`;
        }

        // Збираємо HTML з покращеними стилями
        return `
            <div class="task-item" data-task-id="${task.id}" data-task-type="${task.type || 'social'}" data-target-value="${task.target_value}">
                ${partnerLabel}
                <div class="task-header">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${completed ? 
                      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                      `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${rewardType}</span></div>${timerHtml}`
                    }
                </div>
                <div class="task-description">${escapeHtml(task.description)}</div>
                ${task.target_value > 1 ? 
                  `<div class="task-progress">
                       <div class="progress-text">
                           <span>${progressValue}/${task.target_value} ${task.progress_label || ''}</span>
                           <span>${progressPercent}%</span>
                       </div>
                       <div class="progress-bar-container">
                           <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                       </div>
                   </div>` : ''
                }
                <div class="task-action">
                    ${actionButtons}
                </div>
            </div>
        `;
    }

    /**
     * Функція для безпечного виведення HTML
     */
    function escapeHtml(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        console.error('TaskManager:', message);

        // Пробуємо використати UI.Notifications
        if (window.UI && window.UI.Notifications && typeof window.UI.Notifications.showError === 'function') {
            window.UI.Notifications.showError(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            toastElement.textContent = message;
            toastElement.className = 'toast-message error';
            toastElement.classList.add('show');

            // Автоматично приховуємо повідомлення через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            // Якщо toast-елемент не знайдено, створюємо його динамічно
            console.log('TaskManager: toast-message не знайдено, створюємо динамічно');

            const newToast = document.createElement('div');
            newToast.id = 'toast-message';
            newToast.className = 'toast-message error show';
            newToast.textContent = message;
            newToast.style.position = 'fixed';
            newToast.style.top = '20px';
            newToast.style.left = '50%';
            newToast.style.transform = 'translateX(-50%)';
            newToast.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
            newToast.style.color = 'white';
            newToast.style.padding = '12px 20px';
            newToast.style.borderRadius = '10px';
            newToast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            newToast.style.zIndex = '9999';
            newToast.style.backdropFilter = 'blur(10px)';

            document.body.appendChild(newToast);

            // Автоматично приховуємо повідомлення через 5 секунд
            setTimeout(() => {
                newToast.style.opacity = '0';
                setTimeout(() => {
                    newToast.remove();
                }, 300);
            }, 5000);
        }
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        console.log('TaskManager:', message);

        // Пробуємо використати UI.Notifications
        if (window.UI && window.UI.Notifications && typeof window.UI.Notifications.showSuccess === 'function') {
            window.UI.Notifications.showSuccess(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            toastElement.textContent = message;
            toastElement.className = 'toast-message success';
            toastElement.classList.add('show');

            // Автоматично приховуємо повідомлення через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            // Якщо toast-елемент не знайдено, створюємо його динамічно
            console.log('TaskManager: toast-message не знайдено, створюємо динамічно');

            const newToast = document.createElement('div');
            newToast.id = 'toast-message';
            newToast.className = 'toast-message success show';
            newToast.textContent = message;
            newToast.style.position = 'fixed';
            newToast.style.top = '20px';
            newToast.style.left = '50%';
            newToast.style.transform = 'translateX(-50%)';
            newToast.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
            newToast.style.color = 'white';
            newToast.style.padding = '12px 20px';
            newToast.style.borderRadius = '10px';
            newToast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            newToast.style.zIndex = '9999';
            newToast.style.backdropFilter = 'blur(10px)';

            document.body.appendChild(newToast);

            // Автоматично приховуємо повідомлення через 5 секунд
            setTimeout(() => {
                newToast.style.opacity = '0';
                setTimeout(() => {
                    newToast.remove();
                }, 300);
            }, 5000);
        }
    }

    /**
     * Діагностика стану TaskManager
     */
    function getManagerState() {
        return {
            initialized: initialized,
            activeTabType: activeTabType,
            tabSwitchInProgress: tabSwitchInProgress,
            pendingTabSwitch: pendingTabSwitch,
            operationStatus: { ...operationStatus },
            tasksData: {
                socialTasksCount: socialTasks.length,
                limitedTasksCount: limitedTasks.length,
                partnerTasksCount: partnerTasks.length,
                referralTasksCount: referralTasks.length
            },
            domElements: {
                socialTasksContainer: !!domElements.socialTasksContainer,
                limitedTasksContainer: !!domElements.limitedTasksContainer,
                partnersTasksContainer: !!domElements.partnersTasksContainer,
                referralTasksContainer: !!domElements.referralTasksContainer,
                tabButtons: domElements.tabButtons ? domElements.tabButtons.length : 0,
                contentSections: domElements.contentSections ? domElements.contentSections.length : 0,
                dailyBonusButton: !!domElements.dailyBonusButton
            }
        };
    }

    /**
     * Скинути стан перемикання вкладок
     */
    function resetTabSwitchState() {
        console.log('TaskManager: Скидання стану перемикання вкладок');
        tabSwitchInProgress = false;
        clearTimeout(tabSwitchWatchdog);

        // Якщо є відкладене перемикання, виконуємо його
        if (pendingTabSwitch) {
            const tabToSwitch = pendingTabSwitch;
            pendingTabSwitch = null;
            const pendingTab = document.querySelector(`.tab[data-tab="${tabToSwitch}"]`);
            if (pendingTab) {
                console.log('TaskManager: Виконуємо відкладене перемикання на:', tabToSwitch);
                setTimeout(() => pendingTab.click(), 100);
            }
        }
    }

    // Початкове налаштування спостерігача за розміром вікна для адаптивності
    window.addEventListener('resize', function() {
        setTimeout(updateAllProgressBars, 300);
    });

    // Ініціалізація при завантаженні
    document.addEventListener('DOMContentLoaded', function() {
        init();
    });

    // Перевірка на попереднє завантаження DOM
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    }

    // Публічний API модуля
    return {
        init,
        loadTasks,
        renderSocialTasks,
        renderLimitedTasks,
        renderPartnerTasks,
        renderReferralTasks,
        setupProgressTracking,
        refreshAllTasks,
        refreshTaskDisplay,
        startTask,
        verifyTask,
        findTaskById,
        updateTaskProgress,
        getTaskProgress,
        showErrorMessage,
        showSuccessMessage,
        diagnoseSystemState,
        safeGetUserId,
        createCompletionParticles,
        updateAllProgressBars,
        updateProgressBarForTask,
        resetTabSwitchState,
        getManagerState,
        refreshActiveTab,
        restoreDailyBonusButton,
        // Допоміжні функції для тестування і відлагодження
        setupErrorHandlers,
        setupButtonVisibility,
        setupDailyBonusCoordination,
        // Конфігурація
        setAnimationConfig: (config) => Object.assign(animationConfig, config),
        setThemeConfig: (config) => Object.assign(themeConfig, config),
        // Константи
        REWARD_TYPES,
        // Доступ до даних (тільки для читання)
        get userProgress() { return { ...userProgress }; },
        get domElements() { return { ...domElements }; },
        get initialized() { return initialized; },
        get animationConfig() { return { ...animationConfig }; },
        get themeConfig() { return { ...themeConfig }; },
        get activeTabType() { return activeTabType; }
    };
})();