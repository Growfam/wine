/**
 * Головний інтеграційний модуль для системи завдань WINIX - Ultra Universal Version
 * Універсальна координація всіх підмодулів з максимальною гнучкістю
 */

window.TasksIntegration = (function() {
    'use strict';

    console.log('🚀 [TASKS-INTEGRATION] ===== ЗАВАНТАЖЕННЯ МОДУЛЯ TASKS INTEGRATION =====');
    console.log('📦 [TASKS-INTEGRATION] Версія: Ultra Universal 2.0');
    console.log('🕐 [TASKS-INTEGRATION] Час завантаження:', new Date().toISOString());

    /**
     * Конструктор інтеграції
     */
    function TasksIntegration() {
        console.log('🏗️ [TASKS-INTEGRATION] Створення екземпляру TasksIntegration');

        // Стан системи
        this.state = {
            userId: null,
            isInitialized: false,
            initializationAttempts: 0,
            maxRetries: 5,
            currentTab: 'flex',
            walletConnected: false,
            serverAvailable: false,
            moduleStatuses: {
                flexEarn: false,
                dailyBonus: false,
                tasksManager: false,
                taskVerification: false,
                walletChecker: false,
                services: false,
                store: false,
                api: false
            },
            lastSyncTime: null,
            errorCount: 0
        };

        // Менеджери
        this.managers = {
            flexEarn: null,
            dailyBonus: null,
            tasksManager: null,
            taskVerification: null,
            walletChecker: null
        };

        // Конфігурація
        this.config = {
            autoSaveInterval: 30000, // 30 секунд
            syncInterval: 60000,     // 1 хвилина
            healthCheckInterval: 30000, // 30 секунд
            retryDelay: 5000,        // 5 секунд
            debugMode: false,
            fallbackMode: false
        };

        // Інтервали
        this.intervals = {
            autoSave: null,
            sync: null,
            healthCheck: null
        };

        console.log('✅ [TASKS-INTEGRATION] Екземпляр створено:', this);
    }

    /**
     * Ініціалізація системи з максимальною гнучкістю
     */
    TasksIntegration.prototype.init = async function() {
        console.log('🎯 [TASKS-INTEGRATION] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ СИСТЕМИ =====');
        console.log('🕐 [TASKS-INTEGRATION] Час початку:', new Date().toISOString());
        console.log('📊 [TASKS-INTEGRATION] Спроба ініціалізації #' + (this.state.initializationAttempts + 1));

        this.state.initializationAttempts++;

        try {
            // КРОК 1: Базова перевірка середовища
            console.log('🔍 [TASKS-INTEGRATION] Крок 1: Перевірка середовища...');
            const envCheck = this.checkEnvironment();
            console.log('📊 [TASKS-INTEGRATION] Результат перевірки середовища:', envCheck);

            // КРОК 2: Отримання User ID з різних джерел
            console.log('🔍 [TASKS-INTEGRATION] Крок 2: Отримання ID користувача...');
            this.state.userId = await this.getUserId();
            console.log('📊 [TASKS-INTEGRATION] Результат getUserId:', {
                userId: this.state.userId,
                type: typeof this.state.userId,
                isValid: !!this.state.userId
            });

            if (!this.state.userId) {
                console.error('❌ [TASKS-INTEGRATION] КРИТИЧНА ПОМИЛКА: ID користувача відсутній');

                if (this.state.initializationAttempts < this.state.maxRetries) {
                    console.log('⏳ [TASKS-INTEGRATION] Повторна спроба через ' + (this.config.retryDelay/1000) + ' секунд...');
                    setTimeout(() => this.init(), this.config.retryDelay);
                    return null;
                } else {
                    this.showCriticalError('Не вдалося отримати ID користувача після ' + this.state.maxRetries + ' спроб');
                    throw new Error('User ID не знайдено після максимальної кількості спроб');
                }
            }

            console.log('✅ [TASKS-INTEGRATION] ID користувача успішно отримано:', this.state.userId);

            // КРОК 3: Завантаження збереженого стану
            console.log('📂 [TASKS-INTEGRATION] Крок 3: Завантаження збереженого стану...');
            this.loadSavedState();

            // КРОК 4: Перевірка доступності модулів
            console.log('🔍 [TASKS-INTEGRATION] Крок 4: Перевірка модулів...');
            this.checkModulesAvailability();

            // КРОК 5: Перевірка доступності сервера
            console.log('🌐 [TASKS-INTEGRATION] Крок 5: Перевірка сервера...');
            this.state.serverAvailable = await this.checkServerAvailability();

            if (!this.state.serverAvailable) {
                console.warn('⚠️ [TASKS-INTEGRATION] Сервер недоступний, працюємо в офлайн режимі');
                this.config.fallbackMode = true;
                this.showOfflineNotice();
            }

            // КРОК 6: Ініціалізація Store якщо доступний
            console.log('🏪 [TASKS-INTEGRATION] Крок 6: Ініціалізація Store...');
            await this.initStore();

            // КРОК 7: Авторизація користувача (з fallback)
            if (this.state.serverAvailable) {
                console.log('🔐 [TASKS-INTEGRATION] Крок 7: Авторизація користувача...');
                await this.authenticateUser();
            } else {
                console.log('⏸️ [TASKS-INTEGRATION] Пропускаємо авторизацію - офлайн режим');
            }

            // КРОК 8: Ініціалізація менеджерів
            console.log('🔧 [TASKS-INTEGRATION] Крок 8: Ініціалізація менеджерів...');
            await this.initializeManagers();

            // КРОК 9: Ініціалізація UI
            console.log('🎨 [TASKS-INTEGRATION] Крок 9: Ініціалізація UI...');
            this.initUI();

            // КРОК 10: Налаштування обробників подій
            console.log('🎯 [TASKS-INTEGRATION] Крок 10: Налаштування подій...');
            this.setupEventHandlers();

            // КРОК 11: Початкова синхронізація
            if (this.state.serverAvailable) {
                console.log('🔄 [TASKS-INTEGRATION] Крок 11: Початкова синхронізація...');
                await this.initialSync();
            }

            // КРОК 12: Запуск автоматичних процесів
            console.log('⏰ [TASKS-INTEGRATION] Крок 12: Запуск автопроцесів...');
            this.startAutoProcesses();

            // Позначаємо як ініціалізовано
            this.state.isInitialized = true;
            this.state.initializationAttempts = 0;

            console.log('🎉 [TASKS-INTEGRATION] ===== СИСТЕМА УСПІШНО ІНІЦІАЛІЗОВАНА =====');
            console.log('📊 [TASKS-INTEGRATION] Фінальний стан:', {
                userId: this.state.userId,
                serverAvailable: this.state.serverAvailable,
                moduleStatuses: this.state.moduleStatuses,
                fallbackMode: this.config.fallbackMode
            });

            // Зберігаємо стан
            this.saveState();

            return this;

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] КРИТИЧНА ПОМИЛКА ІНІЦІАЛІЗАЦІЇ:', error);
            console.error('❌ [TASKS-INTEGRATION] Stack trace:', error.stack);
            console.error('❌ [TASKS-INTEGRATION] Стан системи:', this.state);

            this.state.errorCount++;

            // Спробуємо ще раз якщо є спроби
            if (this.state.initializationAttempts < this.state.maxRetries) {
                console.log('⏳ [TASKS-INTEGRATION] Спроба #' + (this.state.initializationAttempts + 1) + ' через ' + (this.config.retryDelay/1000) + ' секунд...');
                setTimeout(() => this.init(), this.config.retryDelay);
                return null;
            } else {
                console.error('❌ [TASKS-INTEGRATION] Досягнуто максимальну кількість спроб');
                this.showCriticalError(error.message);
                return null;
            }
        }
    };

    /**
     * Отримання User ID з різних джерел (як в реферальній системі)
     */
    TasksIntegration.prototype.getUserId = async function() {
        console.log('🔍 [TASKS-INTEGRATION] === getUserId START ===');
        console.log('🔍 [TASKS-INTEGRATION] Доступні глобальні об\'єкти:', {
            hasWindow: typeof window !== 'undefined',
            hasWinixAPI: typeof window.WinixAPI !== 'undefined',
            hasTasksAPI: typeof window.TasksAPI !== 'undefined',
            hasTelegram: typeof window.Telegram !== 'undefined',
            hasTelegramWebApp: window.Telegram && typeof window.Telegram.WebApp !== 'undefined'
        });

        // Спочатку пробуємо з WinixAPI
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            console.log('🔍 [TASKS-INTEGRATION] Спроба отримати ID через WinixAPI...');
            try {
                const apiId = window.WinixAPI.getUserId();
                console.log('🔍 [TASKS-INTEGRATION] WinixAPI.getUserId() повернув:', {
                    value: apiId,
                    type: typeof apiId,
                    isValid: apiId && apiId !== 'undefined' && apiId !== 'null'
                });

                if (apiId && apiId !== 'undefined' && apiId !== 'null') {
                    const numericId = parseInt(apiId);
                    console.log('✅ [TASKS-INTEGRATION] ID успішно отримано з WinixAPI:', numericId);
                    return numericId;
                }
            } catch (e) {
                console.warn('⚠️ [TASKS-INTEGRATION] Помилка виклику WinixAPI.getUserId():', e);
            }
        }

        // Потім пробуємо з Telegram
        console.log('🔍 [TASKS-INTEGRATION] Спроба отримати ID через Telegram WebApp...');
        if (window.Telegram && window.Telegram.WebApp) {
            console.log('📊 [TASKS-INTEGRATION] Telegram WebApp доступний. initDataUnsafe:',
                window.Telegram.WebApp.initDataUnsafe);

            if (window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {
                const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
                console.log('✅ [TASKS-INTEGRATION] ID успішно отримано з Telegram:', tgUserId);
                return parseInt(tgUserId);
            }
        }

        // Потім зі Store якщо вже був авторизований
        if (window.TasksStore && window.TasksStore.selectors && window.TasksStore.selectors.getUserId) {
            console.log('🔍 [TASKS-INTEGRATION] Спроба отримати ID з TasksStore...');
            const storeId = window.TasksStore.selectors.getUserId();
            if (storeId) {
                console.log('✅ [TASKS-INTEGRATION] ID успішно отримано з Store:', storeId);
                return parseInt(storeId);
            }
        }

        // Потім з localStorage/sessionStorage
        console.log('🔍 [TASKS-INTEGRATION] Спроба отримати ID з localStorage...');
        const telegramId = localStorage.getItem('telegram_user_id');
        const userId = localStorage.getItem('user_id');
        const sessionId = sessionStorage.getItem('winix_user_id');

        console.log('📊 [TASKS-INTEGRATION] Дані зі сховищ:', {
            telegram_user_id: telegramId,
            user_id: userId,
            session_user_id: sessionId
        });

        const storedId = sessionId || telegramId || userId;
        if (storedId) {
            const numericId = parseInt(storedId);
            console.log('📊 [TASKS-INTEGRATION] Конвертація ID:', {
                original: storedId,
                numeric: numericId,
                isNaN: isNaN(numericId)
            });

            if (!isNaN(numericId)) {
                console.log('✅ [TASKS-INTEGRATION] ID успішно отримано зі сховища:', numericId);
                return numericId;
            }
        }

        // Якщо нічого немає - повертаємо null
        console.error('❌ [TASKS-INTEGRATION] === getUserId FAILED - ID не знайдено в жодному джерелі ===');
        return null;
    };

    /**
     * Перевірка середовища
     */
    TasksIntegration.prototype.checkEnvironment = function() {
        console.log('🌍 [TASKS-INTEGRATION] === ПЕРЕВІРКА СЕРЕДОВИЩА ===');

        const env = {
            isTelegram: !!(window.Telegram && window.Telegram.WebApp),
            isWebApp: window.location.protocol.includes('http'),
            hasLocalStorage: typeof localStorage !== 'undefined',
            hasSessionStorage: typeof sessionStorage !== 'undefined',
            hasIndexedDB: 'indexedDB' in window,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
        };

        console.log('📊 [TASKS-INTEGRATION] Середовище:', env);
        return env;
    };

    /**
     * Перевірка доступності модулів
     */
    TasksIntegration.prototype.checkModulesAvailability = function() {
        console.log('📦 [TASKS-INTEGRATION] === ПЕРЕВІРКА ДОСТУПНОСТІ МОДУЛІВ ===');

        // Перевіряємо кожен модуль
        const modules = {
            flexEarn: window.FlexEarnManager,
            dailyBonus: window.DailyBonusManager,
            tasksManager: window.TasksManager,
            taskVerification: window.TaskVerification,
            walletChecker: window.WalletChecker,
            services: window.TasksServices,
            store: window.TasksStore,
            api: window.TasksAPI
        };

        Object.entries(modules).forEach(([name, module]) => {
            const isAvailable = !!module;
            this.state.moduleStatuses[name] = isAvailable;

            console.log(`${isAvailable ? '✅' : '❌'} [TASKS-INTEGRATION] Модуль ${name}: ${isAvailable ? 'доступний' : 'відсутній'}`);
        });

        // Підраховуємо статистику
        const totalModules = Object.keys(this.state.moduleStatuses).length;
        const availableModules = Object.values(this.state.moduleStatuses).filter(status => status).length;

        console.log('📊 [TASKS-INTEGRATION] Статистика модулів:', {
            всього: totalModules,
            доступно: availableModules,
            відсутні: totalModules - availableModules,
            відсоток: Math.round((availableModules / totalModules) * 100) + '%'
        });

        return this.state.moduleStatuses;
    };

    /**
     * Перевірка доступності сервера
     */
    TasksIntegration.prototype.checkServerAvailability = async function() {
    console.log('🌐 [TASKS-INTEGRATION] === ПЕРЕВІРКА ДОСТУПНОСТІ СЕРВЕРА ===');

    try {
        if (!window.WinixAPI && !window.TasksAPI) {
            console.warn('⚠️ [TASKS-INTEGRATION] API модулі недоступні');
            return false;
        }

        let response;
        if (window.WinixAPI && window.WinixAPI.apiRequest) {
            console.log('🔄 [TASKS-INTEGRATION] Ping через WinixAPI...');
            response = await window.WinixAPI.apiRequest('/api/ping', 'GET', null, {
                suppressErrors: true,
                timeout: 5000,
                skipHealthCheck: true
            });
        }

        // ОНОВЛЕНА ПЕРЕВІРКА - додаємо перевірку на status === 'ok'
        const isAvailable = !!(response && (
            response.status === 'success' ||
            response.status === 'ok' ||      // ДОДАНО
            response.pong === true ||
            response.message === 'API is running'  // ДОДАНО
        ));

        console.log(`${isAvailable ? '✅' : '❌'} [TASKS-INTEGRATION] Сервер ${isAvailable ? 'доступний' : 'недоступний'}`);
        console.log('📊 [TASKS-INTEGRATION] Ping response:', response);

        return isAvailable;

    } catch (error) {
        console.error('❌ [TASKS-INTEGRATION] Помилка перевірки сервера:', error);
        return false;
    }
};

    /**
     * Ініціалізація Store
     */
    TasksIntegration.prototype.initStore = async function() {
        console.log('🏪 [TASKS-INTEGRATION] === ІНІЦІАЛІЗАЦІЯ STORE ===');

        if (!window.TasksStore) {
            console.warn('⚠️ [TASKS-INTEGRATION] TasksStore недоступний');
            this.state.moduleStatuses.store = false;
            return;
        }

        try {
            // Підписуємось на зміни стану
            const unsubscribe = window.TasksStore.subscribe((state, prevState, action) => {
                console.log('🔄 [TASKS-INTEGRATION] Store змінився:', action.type);
                this.handleStateChange(state, prevState, action);
            });

            // Зберігаємо функцію відписки
            this._storeUnsubscribe = unsubscribe;

            console.log('✅ [TASKS-INTEGRATION] Store ініціалізовано');
            this.state.moduleStatuses.store = true;

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації Store:', error);
            this.state.moduleStatuses.store = false;
        }
    };

    /**
     * Авторизація користувача (з fallback)
     */
    TasksIntegration.prototype.authenticateUser = async function() {
        console.log('🔐 [TASKS-INTEGRATION] === АВТОРИЗАЦІЯ КОРИСТУВАЧА ===');

        try {
            // Використовуємо TasksServices якщо доступний
            if (window.TasksServices && window.TasksServices.Auth) {
                console.log('🔄 [TASKS-INTEGRATION] Авторизація через TasksServices...');
                const user = await window.TasksServices.Auth.initUser();

                console.log('✅ [TASKS-INTEGRATION] Користувач авторизований через Services:', user);
                this.updateUserUI(user);
                return;
            }

            // Fallback на TelegramValidator
            if (window.TelegramValidator) {
                console.log('🔄 [TASKS-INTEGRATION] Авторизація через TelegramValidator...');
                const validation = await window.TelegramValidator.validateTelegramAuth();

                if (validation.valid) {
                    console.log('✅ [TASKS-INTEGRATION] Користувач авторизований через Telegram');
                    this.updateUserUI(validation.user);
                    return;
                }
            }

            // Якщо нічого не спрацювало, але у нас є userId - працюємо з ним
            if (this.state.userId) {
                console.warn('⚠️ [TASKS-INTEGRATION] Працюємо з userId без повної авторизації');
                this.updateUserUI({ id: this.state.userId });
            }

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка авторизації:', error);
            // Не блокуємо роботу системи
            console.warn('⚠️ [TASKS-INTEGRATION] Продовжуємо без авторизації');
        }
    };

    /**
     * Ініціалізація менеджерів з максимальною гнучкістю
     */
    TasksIntegration.prototype.initializeManagers = async function() {
        console.log('🔧 [TASKS-INTEGRATION] === ІНІЦІАЛІЗАЦІЯ МЕНЕДЖЕРІВ ===');

        const userId = this.state.userId;
        let successCount = 0;
        let failureCount = 0;


// WalletChecker
// В функції initializeManagers (рядок ~920)
// WalletChecker повинен ініціалізуватися з userId
if (window.WalletChecker) {
    console.log('  🔧 [TASKS-INTEGRATION] Ініціалізація WalletChecker...');
    console.log('  👤 [TASKS-INTEGRATION] Передаємо userId:', userId);
    try {
        this.managers.walletChecker = window.WalletChecker;
        await this.managers.walletChecker.init(userId); // Передаємо userId!
        console.log('  ✅ [TASKS-INTEGRATION] WalletChecker ініціалізовано');
        successCount++;
    } catch (error) {
        console.warn('  ⚠️ [TASKS-INTEGRATION] Помилка WalletChecker:', error.message);
        failureCount++;
    }
}
        // FlexEarnManager
    if (window.FlexEarnManager) {
        console.log('  🔧 [TASKS-INTEGRATION] Ініціалізація FlexEarnManager...');
        try {
            this.managers.flexEarn = window.FlexEarnManager;
            // Передаємо userId та вказуємо що WalletChecker вже ініціалізований
            this.managers.flexEarn.init(userId, { skipWalletInit: true });
            console.log('  ✅ [TASKS-INTEGRATION] FlexEarnManager ініціалізовано');
            successCount++;
        } catch (error) {
            console.warn('  ⚠️ [TASKS-INTEGRATION] Помилка FlexEarnManager:', error.message);
            failureCount++;
        }
    }

        // DailyBonusManager
        if (window.DailyBonusManager) {
            console.log('  🔧 [TASKS-INTEGRATION] Ініціалізація DailyBonusManager...');
            try {
                this.managers.dailyBonus = window.DailyBonusManager;
                await this.managers.dailyBonus.init(userId);
                console.log('  ✅ [TASKS-INTEGRATION] DailyBonusManager ініціалізовано');
                successCount++;
            } catch (error) {
                console.warn('  ⚠️ [TASKS-INTEGRATION] Помилка DailyBonusManager:', error.message);
                failureCount++;
            }
        }

        // TasksManager
        if (window.TasksManager) {
            console.log('  🔧 [TASKS-INTEGRATION] Ініціалізація TasksManager...');
            try {
                this.managers.tasksManager = window.TasksManager;
                await this.managers.tasksManager.init(userId);
                console.log('  ✅ [TASKS-INTEGRATION] TasksManager ініціалізовано');
                successCount++;
            } catch (error) {
                console.warn('  ⚠️ [TASKS-INTEGRATION] Помилка TasksManager:', error.message);
                failureCount++;
            }
        }

        // TaskVerification
        if (window.TaskVerification) {
            console.log('  🔧 [TASKS-INTEGRATION] Ініціалізація TaskVerification...');
            try {
                this.managers.taskVerification = window.TaskVerification;
                this.managers.taskVerification.init();
                console.log('  ✅ [TASKS-INTEGRATION] TaskVerification ініціалізовано');
                successCount++;
            } catch (error) {
                console.warn('  ⚠️ [TASKS-INTEGRATION] Помилка TaskVerification:', error.message);
                failureCount++;
            }
        }

        console.log('📊 [TASKS-INTEGRATION] Результати ініціалізації менеджерів:', {
            успішно: successCount,
            помилки: failureCount,
            всього: successCount + failureCount
        });

        // Якщо жоден менеджер не ініціалізувався - це критична помилка
        if (successCount === 0) {
            console.error('❌ [TASKS-INTEGRATION] Жоден менеджер не був ініціалізований!');
            // Але не кидаємо помилку - можливо система зможе працювати в обмеженому режимі
        }
    };

    /**
     * Ініціалізація UI
     */
    TasksIntegration.prototype.initUI = function() {
        console.log('🎨 [TASKS-INTEGRATION] === ІНІЦІАЛІЗАЦІЯ UI ===');

        try {
            // Встановлюємо ID користувача в заголовку
            this.setUserIdInHeader();

            // Показуємо поточну вкладку
            this.showCurrentTab();

            // Оновлюємо статуси модулів
            this.updateModuleStatusUI();

            console.log('✅ [TASKS-INTEGRATION] UI ініціалізовано');

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації UI:', error);
        }
    };

    /**
     * Встановлення ID користувача в заголовку
     */
    TasksIntegration.prototype.setUserIdInHeader = function() {
        console.log('🏷️ [TASKS-INTEGRATION] === setUserIdInHeader START ===');

        const userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
        console.log('📊 [TASKS-INTEGRATION] Знайдено елементів для ID:', userIdElements.length);

        userIdElements.forEach((element, index) => {
            if (element) {
                const value = this.state.userId || 'Не визначено';
                console.log('🏷️ [TASKS-INTEGRATION] Встановлення ID в елемент ' + index + ':', {
                    element: element,
                    oldValue: element.textContent,
                    newValue: value
                });
                element.textContent = value;
            }
        });

        console.log('✅ [TASKS-INTEGRATION] === setUserIdInHeader COMPLETE ===');
    };

    /**
     * Оновлення UI користувача
     */
    TasksIntegration.prototype.updateUserUI = function(user) {
        console.log('🔄 [TASKS-INTEGRATION] === updateUserUI START ===');
        console.log('📊 [TASKS-INTEGRATION] Дані користувача:', user);

        try {
            // ID користувача
            const userIdElement = document.getElementById('header-user-id');
            if (userIdElement && user) {
                userIdElement.textContent = user.id || user.telegram_id || this.state.userId || '';
            }

            // Аватар
            const avatarElement = document.querySelector('.profile-avatar');
            if (avatarElement && user?.username) {
                avatarElement.textContent = user.username.charAt(0).toUpperCase();
            }

            // Баланси
            if (user?.balance) {
                const winixElement = document.getElementById('user-winix');
                const ticketsElement = document.getElementById('user-tickets');

                if (winixElement) {
                    winixElement.textContent = user.balance.winix || 0;
                }

                if (ticketsElement) {
                    ticketsElement.textContent = user.balance.tickets || 0;
                }
            }

            console.log('✅ [TASKS-INTEGRATION] UI користувача оновлено');

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка оновлення UI:', error);
        }
    };

    /**
     * Оновлення статусів модулів в UI
     */
    TasksIntegration.prototype.updateModuleStatusUI = function() {
        console.log('📊 [TASKS-INTEGRATION] Оновлення статусів модулів в UI');

        // Можна додати візуальну індикацію статусу модулів
        const statusContainer = document.getElementById('module-status');
        if (statusContainer) {
            const activeModules = Object.values(this.state.moduleStatuses).filter(status => status).length;
            const totalModules = Object.keys(this.state.moduleStatuses).length;

            statusContainer.innerHTML = `
                <div class="module-status-indicator">
                    <span class="status-text">Модулі: ${activeModules}/${totalModules}</span>
                    <span class="status-icon ${activeModules === totalModules ? 'all-active' : 'partial-active'}"></span>
                </div>
            `;
        }
    };

    /**
     * Налаштування обробників подій
     */
    TasksIntegration.prototype.setupEventHandlers = function() {
        console.log('🎯 [TASKS-INTEGRATION] === НАЛАШТУВАННЯ ОБРОБНИКІВ ПОДІЙ ===');

        // Обробники для вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        console.log(`  📑 [TASKS-INTEGRATION] Знайдено ${tabs.length} вкладок`);

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const tabName = tab.getAttribute('data-tab');
                console.log(`  📑 [TASKS-INTEGRATION] Клік на вкладку ${index}: ${tabName}`);

                this.switchTab(tabName);
            });
        });

        // Обробник видимості сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.state.isInitialized) {
                console.log('👁️ [TASKS-INTEGRATION] Сторінка стала видимою');
                this.onPageVisible();
            } else {
                console.log('👁️ [TASKS-INTEGRATION] Сторінка прихована');
                this.onPageHidden();
            }
        });

        // Обробник онлайн/офлайн
        window.addEventListener('online', () => {
            console.log('🌐 [TASKS-INTEGRATION] Підключення відновлено');
            this.onOnline();
        });

        window.addEventListener('offline', () => {
            console.log('📵 [TASKS-INTEGRATION] Підключення втрачено');
            this.onOffline();
        });

        // Обробник закриття сторінки
        window.addEventListener('beforeunload', () => {
            console.log('🚪 [TASKS-INTEGRATION] Закриття сторінки');
            this.saveState();
        });

        console.log('✅ [TASKS-INTEGRATION] Обробники подій налаштовано');
    };

    /**
     * Початкова синхронізація
     */
    TasksIntegration.prototype.initialSync = async function() {
        console.log('🔄 [TASKS-INTEGRATION] === ПОЧАТКОВА СИНХРОНІЗАЦІЯ ===');

        try {
            if (window.TasksServices && window.TasksServices.Sync) {
                await window.TasksServices.Sync.syncData();
                console.log('✅ [TASKS-INTEGRATION] Синхронізація через Services завершена');
            } else {
                console.log('⏸️ [TASKS-INTEGRATION] TasksServices недоступний, пропускаємо синхронізацію');
            }

            this.state.lastSyncTime = Date.now();

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка синхронізації:', error);
            // Не блокуємо роботу системи
        }
    };

    /**
     * Запуск автоматичних процесів
     */
    TasksIntegration.prototype.startAutoProcesses = function() {
        console.log('⏰ [TASKS-INTEGRATION] === ЗАПУСК АВТОПРОЦЕСІВ ===');

        // Автозбереження стану
        this.intervals.autoSave = setInterval(() => {
            console.log('💾 [TASKS-INTEGRATION] Автозбереження стану');
            this.saveState();
        }, this.config.autoSaveInterval);

        // Синхронізація даних
        if (this.state.serverAvailable) {
            this.intervals.sync = setInterval(() => {
                console.log('🔄 [TASKS-INTEGRATION] Автоматична синхронізація');
                this.syncData();
            }, this.config.syncInterval);
        }

        // Перевірка здоров'я системи
        this.intervals.healthCheck = setInterval(() => {
            console.log('🏥 [TASKS-INTEGRATION] Перевірка здоров\'я системи');
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        console.log('✅ [TASKS-INTEGRATION] Автопроцеси запущено');
    };

    /**
     * Перемикання вкладки
     */
    TasksIntegration.prototype.switchTab = function(tabName) {
        console.log(`📑 [TASKS-INTEGRATION] === ПЕРЕМИКАННЯ ВКЛАДКИ НА: ${tabName} ===`);

        const prevTab = this.state.currentTab;
        this.state.currentTab = tabName;

        // Оновлюємо Store якщо доступний
        if (window.TasksStore) {
            window.TasksStore.actions.setCurrentTab(tabName);
        }

        // Оновлюємо UI
        this.updateTabUI(tabName);

        // Викликаємо відповідний менеджер
        this.onTabSwitch(tabName);

        console.log('✅ [TASKS-INTEGRATION] Вкладка перемкнута з', prevTab, 'на', tabName);
    };

    /**
     * Оновлення UI вкладок
     */
    TasksIntegration.prototype.updateTabUI = function(activeTab) {
        console.log('🎨 [TASKS-INTEGRATION] Оновлення UI вкладок');

        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        const panes = document.querySelectorAll('.main-tab-pane');

        tabs.forEach(tab => {
            const isActive = tab.getAttribute('data-tab') === activeTab;
            tab.classList.toggle('active', isActive);
        });

        panes.forEach(pane => {
            const paneId = pane.id;
            const shouldBeActive = paneId === `${activeTab}-tab`;
            pane.classList.toggle('active', shouldBeActive);
            pane.style.display = shouldBeActive ? 'block' : 'none';
        });
    };

    /**
     * Обробка перемикання вкладки
     */
    TasksIntegration.prototype.onTabSwitch = function(tabName) {
        console.log(`🔄 [TASKS-INTEGRATION] Обробка перемикання на вкладку: ${tabName}`);

        try {
            switch(tabName) {
                case 'flex':
                    if (this.managers.flexEarn?.checkWalletConnection) {
                        this.managers.flexEarn.checkWalletConnection();
                    }
                    break;

                case 'daily':
                    if (this.managers.dailyBonus?.updateDailyBonusUI) {
                        this.managers.dailyBonus.updateDailyBonusUI();
                    }
                    break;

                case 'social':
                case 'limited':
                case 'partner':
                    if (this.managers.tasksManager?.updateTasksUI) {
                        this.managers.tasksManager.updateTasksUI();
                    }
                    break;

                default:
                    console.warn(`⚠️ [TASKS-INTEGRATION] Невідома вкладка: ${tabName}`);
            }
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка обробки вкладки:', error);
        }
    };

    /**
     * Показати поточну вкладку
     */
    TasksIntegration.prototype.showCurrentTab = function() {
        console.log('📑 [TASKS-INTEGRATION] Показуємо поточну вкладку:', this.state.currentTab);
        this.updateTabUI(this.state.currentTab);
    };

    /**
     * Збереження стану
     */
    TasksIntegration.prototype.saveState = function() {
        console.log('💾 [TASKS-INTEGRATION] === ЗБЕРЕЖЕННЯ СТАНУ ===');

        try {
            const stateToSave = {
                userId: this.state.userId,
                currentTab: this.state.currentTab,
                walletConnected: this.state.walletConnected,
                lastSyncTime: this.state.lastSyncTime,
                moduleStatuses: this.state.moduleStatuses,
                timestamp: Date.now()
            };

            localStorage.setItem('tasksIntegrationState', JSON.stringify(stateToSave));
            console.log('✅ [TASKS-INTEGRATION] Стан збережено:', stateToSave);

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка збереження стану:', error);
        }
    };

    /**
     * Завантаження збереженого стану
     */
    TasksIntegration.prototype.loadSavedState = function() {
        console.log('📂 [TASKS-INTEGRATION] === ЗАВАНТАЖЕННЯ ЗБЕРЕЖЕНОГО СТАНУ ===');

        try {
            const savedState = localStorage.getItem('tasksIntegrationState');

            if (savedState) {
                const parsed = JSON.parse(savedState);
                console.log('📊 [TASKS-INTEGRATION] Знайдено збережений стан:', parsed);

                // Перевіряємо чи це стан для поточного користувача
                if (parsed.userId === this.state.userId) {
                    // Відновлюємо деякі значення
                    this.state.currentTab = parsed.currentTab || 'flex';
                    this.state.walletConnected = parsed.walletConnected || false;
                    this.state.lastSyncTime = parsed.lastSyncTime || null;

                    console.log('✅ [TASKS-INTEGRATION] Стан відновлено');
                } else {
                    console.log('🔄 [TASKS-INTEGRATION] Збережений стан для іншого користувача, ігноруємо');
                }
            } else {
                console.log('📭 [TASKS-INTEGRATION] Збережений стан не знайдено');
            }

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка завантаження стану:', error);
        }
    };

    /**
     * Синхронізація даних
     */
    TasksIntegration.prototype.syncData = async function() {
        console.log('🔄 [TASKS-INTEGRATION] === СИНХРОНІЗАЦІЯ ДАНИХ ===');

        if (!this.state.serverAvailable) {
            console.log('⏸️ [TASKS-INTEGRATION] Сервер недоступний, пропускаємо синхронізацію');
            return;
        }

        try {
            if (window.TasksServices && window.TasksServices.Sync) {
                await window.TasksServices.Sync.syncData();
            }

            this.state.lastSyncTime = Date.now();
            console.log('✅ [TASKS-INTEGRATION] Синхронізація завершена');

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка синхронізації:', error);
        }
    };

    /**
     * Перевірка здоров'я системи
     */
    TasksIntegration.prototype.performHealthCheck = async function() {
        console.log('🏥 [TASKS-INTEGRATION] === ПЕРЕВІРКА ЗДОРОВ\'Я ===');

        const health = {
            serverAvailable: await this.checkServerAvailability(),
            modulesActive: Object.values(this.state.moduleStatuses).filter(s => s).length,
            errorCount: this.state.errorCount,
            uptime: Date.now() - (this.state.initTime || Date.now()),
            lastSync: this.state.lastSyncTime ? Date.now() - this.state.lastSyncTime : null
        };

        console.log('📊 [TASKS-INTEGRATION] Стан здоров\'я:', health);

        // Якщо сервер знову доступний після недоступності
        if (health.serverAvailable && !this.state.serverAvailable) {
            console.log('🌐 [TASKS-INTEGRATION] Сервер знову доступний!');
            this.state.serverAvailable = true;
            this.hideOfflineNotice();
            await this.syncData();
        }

        // Якщо сервер став недоступний
        if (!health.serverAvailable && this.state.serverAvailable) {
            console.log('📵 [TASKS-INTEGRATION] Сервер став недоступний!');
            this.state.serverAvailable = false;
            this.showOfflineNotice();
        }

        return health;
    };

    /**
     * Обробка зміни стану Store
     */
    TasksIntegration.prototype.handleStateChange = function(state, prevState, action) {
        console.log('🔄 [TASKS-INTEGRATION] Store state змінився:', action.type);

        // Обробляємо специфічні зміни
        if (state.wallet.connected !== prevState.wallet.connected) {
            console.log('👛 [TASKS-INTEGRATION] Статус гаманця змінився:', state.wallet.connected);
            this.state.walletConnected = state.wallet.connected;
        }

        if (state.ui.currentTab !== prevState.ui.currentTab) {
            console.log('📑 [TASKS-INTEGRATION] Вкладка змінилася через Store:', state.ui.currentTab);
            this.state.currentTab = state.ui.currentTab;
            this.updateTabUI(state.ui.currentTab);
        }
    };

    /**
     * Обробники подій видимості
     */
    TasksIntegration.prototype.onPageVisible = function() {
        console.log('👁️ [TASKS-INTEGRATION] === СТОРІНКА ВИДИМА ===');

        // Синхронізуємо дані якщо давно не синхронізували
        if (this.state.lastSyncTime) {
            const timeSinceSync = Date.now() - this.state.lastSyncTime;
            if (timeSinceSync > 60000) { // 1 хвилина
                this.syncData();
            }
        }

        // Оновлюємо поточну вкладку
        this.onTabSwitch(this.state.currentTab);
    };

    TasksIntegration.prototype.onPageHidden = function() {
        console.log('👁️ [TASKS-INTEGRATION] === СТОРІНКА ПРИХОВАНА ===');
        this.saveState();
    };

    /**
     * Обробники мережі
     */
    TasksIntegration.prototype.onOnline = async function() {
        console.log('🌐 [TASKS-INTEGRATION] === ПІДКЛЮЧЕННЯ ВІДНОВЛЕНО ===');

        this.showToast('З\'єднання відновлено', 'success');

        // Перевіряємо сервер
        this.state.serverAvailable = await this.checkServerAvailability();

        if (this.state.serverAvailable) {
            // Синхронізуємо дані
            await this.syncData();

            // Запускаємо автопроцеси якщо вони зупинені
            if (!this.intervals.sync) {
                this.intervals.sync = setInterval(() => {
                    this.syncData();
                }, this.config.syncInterval);
            }
        }
    };

    TasksIntegration.prototype.onOffline = function() {
        console.log('📵 [TASKS-INTEGRATION] === ПІДКЛЮЧЕННЯ ВТРАЧЕНО ===');

        this.showToast('З\'єднання втрачено. Функціональність обмежена', 'warning');
        this.state.serverAvailable = false;

        // Зупиняємо синхронізацію
        if (this.intervals.sync) {
            clearInterval(this.intervals.sync);
            this.intervals.sync = null;
        }
    };

    /**
     * UI повідомлення
     */
    TasksIntegration.prototype.showToast = function(message, type = 'info') {
        console.log(`💬 [TASKS-INTEGRATION] Toast: ${type} - ${message}`);

        if (window.TasksUtils && window.TasksUtils.showToast) {
            window.TasksUtils.showToast(message, type);
        } else {
            // Fallback на alert
            console.warn('⚠️ [TASKS-INTEGRATION] TasksUtils недоступний, використовуємо console');
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    };

    TasksIntegration.prototype.showOfflineNotice = function() {
        console.log('📵 [TASKS-INTEGRATION] Показуємо повідомлення про офлайн режим');

        const notice = document.getElementById('offline-notice');
        if (notice) {
            notice.style.display = 'block';
        } else {
            this.showToast('Працюємо в офлайн режимі', 'warning');
        }
    };

    TasksIntegration.prototype.hideOfflineNotice = function() {
        console.log('🌐 [TASKS-INTEGRATION] Приховуємо повідомлення про офлайн режим');

        const notice = document.getElementById('offline-notice');
        if (notice) {
            notice.style.display = 'none';
        }
    };

    TasksIntegration.prototype.showCriticalError = function(message) {
        console.error('💥 [TASKS-INTEGRATION] КРИТИЧНА ПОМИЛКА:', message);

        const errorDiv = document.createElement('div');
        errorDiv.className = 'critical-error-overlay';
        errorDiv.innerHTML = `
            <div class="critical-error-content">
                <div class="error-icon">⚠️</div>
                <h2>Помилка системи</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()">Оновити сторінку</button>
            </div>
        `;

        document.body.appendChild(errorDiv);
    };

    /**
     * Знищення системи
     */
    TasksIntegration.prototype.destroy = function() {
        console.log('🗑️ [TASKS-INTEGRATION] === ЗНИЩЕННЯ СИСТЕМИ ===');

        // Зберігаємо стан
        this.saveState();

        // Очищаємо інтервали
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });

        // Відписуємось від Store
        if (this._storeUnsubscribe) {
            this._storeUnsubscribe();
        }

        // Знищуємо менеджери
        Object.entries(this.managers).forEach(([name, manager]) => {
            if (manager && typeof manager.destroy === 'function') {
                try {
                    console.log(`🗑️ [TASKS-INTEGRATION] Знищення ${name}...`);
                    manager.destroy();
                } catch (error) {
                    console.error(`❌ [TASKS-INTEGRATION] Помилка знищення ${name}:`, error);
                }
            }
        });

        console.log('✅ [TASKS-INTEGRATION] Система знищена');
    };

    /**
     * Отримати статистику системи
     */
    TasksIntegration.prototype.getStatistics = function() {
        const stats = {
            userId: this.state.userId,
            isInitialized: this.state.isInitialized,
            serverAvailable: this.state.serverAvailable,
            moduleStatuses: this.state.moduleStatuses,
            activeModules: Object.values(this.state.moduleStatuses).filter(s => s).length,
            totalModules: Object.keys(this.state.moduleStatuses).length,
            errorCount: this.state.errorCount,
            lastSyncTime: this.state.lastSyncTime,
            uptime: Date.now() - (this.state.initTime || Date.now())
        };

        console.log('📊 [TASKS-INTEGRATION] Статистика системи:', stats);
        return stats;
    };

    // Створюємо екземпляр
    const integration = new TasksIntegration();

    console.log('✅ [TASKS-INTEGRATION] Модуль TasksIntegration готовий до ініціалізації');

    // Публічний API
    return integration;

})();

// Глобальна функція ініціалізації
window.initTasksSystem = function() {
    console.log('🎬 [GLOBAL] === initTasksSystem START ===');
    console.log('🕐 [GLOBAL] Час виклику:', new Date().toISOString());

    return new Promise(function(resolve, reject) {
        try {
            console.log('🏗️ [GLOBAL] Створення екземпляру TasksIntegration...');

            console.log('🚀 [GLOBAL] Запуск integration.init()...');
            window.TasksIntegration.init()
                .then(function(result) {
                    // Зберігаємо екземпляр глобально для налагодження
                    window.TasksIntegrationInstance = result;
                    console.log('✅ [GLOBAL] Екземпляр збережено в window.TasksIntegrationInstance');

                    console.log('🏁 [GLOBAL] === initTasksSystem SUCCESS ===');
                    resolve(result);
                })
                .catch(function(error) {
                    console.error('💥 [GLOBAL] === initTasksSystem FAILED ===');
                    console.error('💥 [GLOBAL] Помилка:', error);
                    reject(error);
                });
        } catch (error) {
            console.error('💥 [GLOBAL] Критична помилка в try-catch блоці');
            console.error('💥 [GLOBAL] Деталі:', error);
            reject(error);
        }
    });
};

// Автоматична ініціалізація при завантаженні DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 [GLOBAL] DOM завантажено, запуск ініціалізації...');

    try {
        window.tasksIntegration = await window.initTasksSystem();

        if (window.tasksIntegration) {
            console.log('🎉 [GLOBAL] Система завдань успішно запущена!');
        } else {
            console.log('⚠️ [GLOBAL] Система в режимі очікування');
        }
    } catch (error) {
        console.error('❌ [GLOBAL] Критична помилка запуску:', error);
    }
});

console.log('✅ [GLOBAL] window.initTasksSystem функція зареєстрована');