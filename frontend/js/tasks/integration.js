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
            // КРОК 0: Чекаємо на готовність критичних модулів
            console.log('⏳ [TASKS-INTEGRATION] Крок 0: Очікування готовності модулів...');

            let moduleWaitAttempts = 0;
            const maxWaitAttempts = 20; // 10 секунд максимум (20 * 500ms)

            while (moduleWaitAttempts < maxWaitAttempts) {
                const modulesReady = (
                    window.WinixAPI &&
                    typeof window.WinixAPI.apiRequest === 'function' &&
                    window.TasksAPI &&
                    window.TasksConstants &&
                    window.TasksUtils
                );

                if (modulesReady) {
                    console.log('✅ [TASKS-INTEGRATION] Всі критичні модулі готові');
                    break;
                }

                moduleWaitAttempts++;
                console.log(`⏳ [TASKS-INTEGRATION] Чекаємо на модулі... (${moduleWaitAttempts}/${maxWaitAttempts})`);

                // Показуємо які модулі ще не готові
                if (moduleWaitAttempts % 4 === 0) {
                    console.log('📊 [TASKS-INTEGRATION] Статус модулів:', {
                        WinixAPI: !!window.WinixAPI,
                        WinixAPI_apiRequest: !!(window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function'),
                        TasksAPI: !!window.TasksAPI,
                        TasksConstants: !!window.TasksConstants,
                        TasksUtils: !!window.TasksUtils
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Перевіряємо чи всі модулі завантажилися
            if (!window.WinixAPI || !window.TasksAPI) {
                console.error('❌ [TASKS-INTEGRATION] Критичні модулі не завантажилися');

                if (this.state.initializationAttempts < this.state.maxRetries) {
                    console.log('⏳ [TASKS-INTEGRATION] Повторна спроба через ' + (this.config.retryDelay/1000) + ' секунд...');
                    setTimeout(() => this.init(), this.config.retryDelay);
                    return null;
                } else {
                    this.showCriticalError('Не вдалося завантажити необхідні модулі');
                    throw new Error('Критичні модулі не завантажилися');
                }
            }

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
            this.state.errorCount++;

            if (this.state.initializationAttempts < this.state.maxRetries) {
                console.log('⏳ [TASKS-INTEGRATION] Спроба перезапуску через ' + (this.config.retryDelay/1000) + ' секунд...');
                setTimeout(() => this.init(), this.config.retryDelay);
            } else {
                this.showCriticalError('Система не змогла ініціалізуватися: ' + error.message);
            }

            throw error;
        }
    };

    /**
     * Перевірка середовища
     */
    TasksIntegration.prototype.checkEnvironment = function() {
        const checks = {
            telegram: !!(window.Telegram && window.Telegram.WebApp),
            tonconnect: !!window.TON_CONNECT_UI,
            winixApi: !!window.WinixAPI,
            tasksApi: !!window.TasksAPI,
            localStorage: this.testLocalStorage(),
            online: navigator.onLine
        };

        console.log('🔍 [TASKS-INTEGRATION] Результати перевірки середовища:', checks);
        return checks;
    };

    /**
     * Тест localStorage
     */
    TasksIntegration.prototype.testLocalStorage = function() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch(e) {
            return false;
        }
    };

    /**
     * Отримання ID користувача з різних джерел
     */
    TasksIntegration.prototype.getUserId = async function() {
        console.log('🔍 [TASKS-INTEGRATION] Пошук User ID...');

        // Спроба 1: WinixAPI
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            try {
                const apiUserId = window.WinixAPI.getUserId();
                if (apiUserId) {
                    console.log('✅ [TASKS-INTEGRATION] User ID знайдено через WinixAPI:', apiUserId);
                    return apiUserId;
                }
            } catch (e) {
                console.warn('⚠️ [TASKS-INTEGRATION] Помилка отримання ID через WinixAPI:', e);
            }
        }

        // Спроба 2: Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            try {
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                if (tgUser && tgUser.id) {
                    const tgUserId = tgUser.id.toString();
                    console.log('✅ [TASKS-INTEGRATION] User ID знайдено через Telegram:', tgUserId);
                    return tgUserId;
                }
            } catch (e) {
                console.warn('⚠️ [TASKS-INTEGRATION] Помилка отримання ID через Telegram:', e);
            }
        }

        // Спроба 3: LocalStorage
        try {
            const localUserId = localStorage.getItem('telegram_user_id') || localStorage.getItem('userId');
            if (localUserId) {
                console.log('✅ [TASKS-INTEGRATION] User ID знайдено в localStorage:', localUserId);
                return localUserId;
            }
        } catch (e) {
            console.warn('⚠️ [TASKS-INTEGRATION] Помилка читання localStorage:', e);
        }

        // Спроба 4: URL параметри
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlUserId = urlParams.get('user_id') || urlParams.get('userId') || urlParams.get('id');
            if (urlUserId) {
                console.log('✅ [TASKS-INTEGRATION] User ID знайдено в URL:', urlUserId);
                return urlUserId;
            }
        } catch (e) {
            console.warn('⚠️ [TASKS-INTEGRATION] Помилка читання URL параметрів:', e);
        }

        console.error('❌ [TASKS-INTEGRATION] User ID не знайдено в жодному джерелі');
        return null;
    };

    /**
     * Завантаження збереженого стану
     */
    TasksIntegration.prototype.loadSavedState = function() {
        try {
            const savedState = localStorage.getItem('tasksIntegrationState');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                console.log('📂 [TASKS-INTEGRATION] Завантажено збережений стан:', parsed);

                // Відновлюємо лише деякі поля
                this.state.walletConnected = parsed.walletConnected || false;
                this.state.currentTab = parsed.currentTab || 'flex';
                this.state.lastSyncTime = parsed.lastSyncTime || null;
            }
        } catch (e) {
            console.warn('⚠️ [TASKS-INTEGRATION] Помилка завантаження стану:', e);
        }
    };

    /**
     * Збереження стану
     */
    TasksIntegration.prototype.saveState = function() {
        try {
            const stateToSave = {
                walletConnected: this.state.walletConnected,
                currentTab: this.state.currentTab,
                lastSyncTime: this.state.lastSyncTime,
                savedAt: new Date().toISOString()
            };

            localStorage.setItem('tasksIntegrationState', JSON.stringify(stateToSave));
            console.log('💾 [TASKS-INTEGRATION] Стан збережено');
        } catch (e) {
            console.warn('⚠️ [TASKS-INTEGRATION] Помилка збереження стану:', e);
        }
    };

    /**
     * Перевірка доступності модулів
     */
    TasksIntegration.prototype.checkModulesAvailability = function() {
        this.state.moduleStatuses = {
            flexEarn: !!(window.FlexEarn || (window.TasksModules && window.TasksModules.FlexEarn)),
            dailyBonus: !!(window.DailyBonus || (window.TasksModules && window.TasksModules.DailyBonus)),
            tasksManager: !!(window.TasksManager || (window.TasksModules && window.TasksModules.TasksManager)),
            taskVerification: !!(window.TaskVerification || (window.TasksModules && window.TasksModules.TaskVerification)),
            walletChecker: !!(window.WalletChecker || (window.TasksModules && window.TasksModules.WalletChecker)),
            services: !!window.TasksServices,
            store: !!window.TasksStore,
            api: !!window.TasksAPI
        };

        console.log('📊 [TASKS-INTEGRATION] Статус модулів:', this.state.moduleStatuses);
    };

    /**
     * Перевірка доступності сервера
     */
    TasksIntegration.prototype.checkServerAvailability = async function() {
        if (!window.TasksAPI) {
            console.warn('⚠️ [TASKS-INTEGRATION] TasksAPI недоступний');
            return false;
        }

        try {
            const startTime = Date.now();
            const result = await window.TasksAPI.checkServerHealth();
            const responseTime = Date.now() - startTime;

            console.log(`✅ [TASKS-INTEGRATION] Сервер доступний (відповідь за ${responseTime}ms)`);
            return true;
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Сервер недоступний:', error.message);
            return false;
        }
    };

    /**
     * Ініціалізація Store
     */
    TasksIntegration.prototype.initStore = async function() {
        if (!window.TasksStore) {
            console.warn('⚠️ [TASKS-INTEGRATION] TasksStore недоступний');
            return;
        }

        try {
            console.log('🏪 [TASKS-INTEGRATION] Ініціалізація Store...');

            // Встановлюємо userId
            window.TasksStore.setUserId(this.state.userId);

            // Завантажуємо дані з localStorage
            await window.TasksStore.loadFromLocalStorage();

            console.log('✅ [TASKS-INTEGRATION] Store ініціалізовано');
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації Store:', error);
        }
    };

    /**
     * Авторизація користувача
     */
    TasksIntegration.prototype.authenticateUser = async function() {
        if (!window.WinixAuth) {
            console.warn('⚠️ [TASKS-INTEGRATION] WinixAuth недоступний');
            return;
        }

        try {
            console.log('🔐 [TASKS-INTEGRATION] Авторизація користувача...');
            const authResult = await window.WinixAuth.init();
            console.log('✅ [TASKS-INTEGRATION] Користувач авторизований:', authResult);
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка авторизації:', error);
            throw error;
        }
    };

    /**
     * Ініціалізація менеджерів
     */
    TasksIntegration.prototype.initializeManagers = async function() {
        console.log('🔧 [TASKS-INTEGRATION] Ініціалізація менеджерів...');

        // FlexEarn
        if (this.state.moduleStatuses.flexEarn) {
            try {
                const FlexEarnModule = window.FlexEarn || (window.TasksModules && window.TasksModules.FlexEarn);
                if (FlexEarnModule) {
                    this.managers.flexEarn = new FlexEarnModule(this.state.userId);
                    await this.managers.flexEarn.init();
                    console.log('✅ [TASKS-INTEGRATION] FlexEarn ініціалізовано');
                }
            } catch (e) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації FlexEarn:', e);
            }
        }

        // DailyBonus
        if (this.state.moduleStatuses.dailyBonus) {
            try {
                const DailyBonusModule = window.DailyBonus || (window.TasksModules && window.TasksModules.DailyBonus);
                if (DailyBonusModule) {
                    this.managers.dailyBonus = new DailyBonusModule(this.state.userId);
                    await this.managers.dailyBonus.init();
                    console.log('✅ [TASKS-INTEGRATION] DailyBonus ініціалізовано');
                }
            } catch (e) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації DailyBonus:', e);
            }
        }

        // TasksManager
        if (this.state.moduleStatuses.tasksManager) {
            try {
                const TasksManagerModule = window.TasksManager || (window.TasksModules && window.TasksModules.TasksManager);
                if (TasksManagerModule) {
                    this.managers.tasksManager = new TasksManagerModule(this.state.userId);
                    await this.managers.tasksManager.init();
                    console.log('✅ [TASKS-INTEGRATION] TasksManager ініціалізовано');
                }
            } catch (e) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації TasksManager:', e);
            }
        }

        // TaskVerification
        if (this.state.moduleStatuses.taskVerification) {
            try {
                const TaskVerificationModule = window.TaskVerification || (window.TasksModules && window.TasksModules.TaskVerification);
                if (TaskVerificationModule) {
                    this.managers.taskVerification = new TaskVerificationModule(this.state.userId);
                    console.log('✅ [TASKS-INTEGRATION] TaskVerification ініціалізовано');
                }
            } catch (e) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації TaskVerification:', e);
            }
        }

        // WalletChecker
        if (this.state.moduleStatuses.walletChecker) {
            try {
                const WalletCheckerModule = window.WalletChecker || (window.TasksModules && window.TasksModules.WalletChecker);
                if (WalletCheckerModule) {
                    this.managers.walletChecker = new WalletCheckerModule(this.state.userId);
                    console.log('✅ [TASKS-INTEGRATION] WalletChecker ініціалізовано');
                }
            } catch (e) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації WalletChecker:', e);
            }
        }
    };

    /**
     * Ініціалізація UI
     */
    TasksIntegration.prototype.initUI = function() {
        console.log('🎨 [TASKS-INTEGRATION] Ініціалізація UI...');

        // Приховуємо loader якщо є
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }

        // Показуємо основний контент
        const mainContent = document.getElementById('main-content') || document.querySelector('.container');
        if (mainContent) {
            mainContent.style.display = 'block';
        }

        // Активуємо поточну вкладку
        this.switchTab(this.state.currentTab);

        console.log('✅ [TASKS-INTEGRATION] UI ініціалізовано');
    };

    /**
     * Налаштування обробників подій
     */
    TasksIntegration.prototype.setupEventHandlers = function() {
        console.log('🎯 [TASKS-INTEGRATION] Налаштування обробників подій...');

        // Обробники табів
        const tabButtons = document.querySelectorAll('[data-tab]');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        // Обробник online/offline
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Обробник visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.handleVisibilityChange();
            }
        });

        // Custom events
        document.addEventListener('wallet-connected', (e) => this.handleWalletConnected(e));
        document.addEventListener('wallet-disconnected', (e) => this.handleWalletDisconnected(e));
        document.addEventListener('task-completed', (e) => this.handleTaskCompleted(e));
        document.addEventListener('balance-updated', (e) => this.handleBalanceUpdated(e));

        console.log('✅ [TASKS-INTEGRATION] Обробники подій налаштовано');
    };

    /**
     * Перемикання вкладок
     */
    TasksIntegration.prototype.switchTab = function(tabId) {
        console.log('🔄 [TASKS-INTEGRATION] Перемикання на вкладку:', tabId);

        // Оновлюємо стан
        this.state.currentTab = tabId;
        this.saveState();

        // Оновлюємо UI
        const allTabs = document.querySelectorAll('.tab-content');
        const allButtons = document.querySelectorAll('[data-tab]');

        allTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.id === tabId || tab.getAttribute('data-tab-content') === tabId) {
                tab.classList.add('active');
            }
        });

        allButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabId) {
                button.classList.add('active');
            }
        });

        // Виконуємо дії для конкретної вкладки
        switch(tabId) {
            case 'flex':
                if (this.managers.flexEarn) {
                    this.managers.flexEarn.onTabActivated();
                }
                break;
            case 'daily':
                if (this.managers.dailyBonus) {
                    this.managers.dailyBonus.onTabActivated();
                }
                break;
            case 'tasks':
                if (this.managers.tasksManager) {
                    this.managers.tasksManager.onTabActivated();
                }
                break;
        }
    };

    /**
     * Початкова синхронізація
     */
    TasksIntegration.prototype.initialSync = async function() {
        console.log('🔄 [TASKS-INTEGRATION] Початкова синхронізація...');

        try {
            // Синхронізуємо дані користувача
            if (window.TasksServices && window.TasksServices.syncUserData) {
                await window.TasksServices.syncUserData(this.state.userId);
            }

            // Оновлюємо час синхронізації
            this.state.lastSyncTime = new Date().toISOString();
            this.saveState();

            console.log('✅ [TASKS-INTEGRATION] Синхронізація завершена');
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка синхронізації:', error);
        }
    };

    /**
     * Запуск автоматичних процесів
     */
    TasksIntegration.prototype.startAutoProcesses = function() {
        console.log('⏰ [TASKS-INTEGRATION] Запуск автоматичних процесів...');

        // Автозбереження
        this.intervals.autoSave = setInterval(() => {
            this.saveState();
        }, this.config.autoSaveInterval);

        // Синхронізація
        if (this.state.serverAvailable) {
            this.intervals.sync = setInterval(() => {
                this.syncData();
            }, this.config.syncInterval);
        }

        // Health check
        this.intervals.healthCheck = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        console.log('✅ [TASKS-INTEGRATION] Автопроцеси запущено');
    };

    /**
     * Синхронізація даних
     */
    TasksIntegration.prototype.syncData = async function() {
        if (!this.state.serverAvailable) return;

        try {
            console.log('🔄 [TASKS-INTEGRATION] Синхронізація даних...');

            if (window.TasksServices && window.TasksServices.syncUserData) {
                await window.TasksServices.syncUserData(this.state.userId);
                this.state.lastSyncTime = new Date().toISOString();
                this.saveState();
            }
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION] Помилка синхронізації:', error);
        }
    };

    /**
     * Health check
     */
    TasksIntegration.prototype.performHealthCheck = async function() {
        const wasAvailable = this.state.serverAvailable;
        this.state.serverAvailable = await this.checkServerAvailability();

        if (!wasAvailable && this.state.serverAvailable) {
            console.log('🟢 [TASKS-INTEGRATION] Сервер знову доступний');
            this.handleOnline();
        } else if (wasAvailable && !this.state.serverAvailable) {
            console.log('🔴 [TASKS-INTEGRATION] Сервер недоступний');
            this.handleOffline();
        }
    };

    /**
     * Обробка повернення онлайн
     */
    TasksIntegration.prototype.handleOnline = function() {
        console.log('🟢 [TASKS-INTEGRATION] Повернення онлайн');

        this.hideOfflineNotice();
        this.config.fallbackMode = false;

        // Запускаємо синхронізацію
        this.syncData();

        // Перезапускаємо інтервали
        if (!this.intervals.sync) {
            this.intervals.sync = setInterval(() => {
                this.syncData();
            }, this.config.syncInterval);
        }
    };

    /**
     * Обробка переходу офлайн
     */
    TasksIntegration.prototype.handleOffline = function() {
        console.log('🔴 [TASKS-INTEGRATION] Перехід в офлайн режим');

        this.showOfflineNotice();
        this.config.fallbackMode = true;

        // Зупиняємо синхронізацію
        if (this.intervals.sync) {
            clearInterval(this.intervals.sync);
            this.intervals.sync = null;
        }
    };

    /**
     * Обробка зміни видимості
     */
    TasksIntegration.prototype.handleVisibilityChange = function() {
        console.log('👁️ [TASKS-INTEGRATION] Повернення до додатку');

        // Перевіряємо стан сервера
        this.performHealthCheck();

        // Оновлюємо дані якщо потрібно
        const timeSinceLastSync = Date.now() - new Date(this.state.lastSyncTime).getTime();
        if (timeSinceLastSync > 60000) { // Більше хвилини
            this.syncData();
        }
    };

    /**
     * Обробка підключення гаманця
     */
    TasksIntegration.prototype.handleWalletConnected = function(event) {
        console.log('💼 [TASKS-INTEGRATION] Гаманець підключено:', event.detail);

        this.state.walletConnected = true;
        this.saveState();

        // Оповіщаємо менеджери
        if (this.managers.flexEarn) {
            this.managers.flexEarn.onWalletConnected(event.detail);
        }
    };

    /**
     * Обробка відключення гаманця
     */
    TasksIntegration.prototype.handleWalletDisconnected = function(event) {
        console.log('💼 [TASKS-INTEGRATION] Гаманець відключено');

        this.state.walletConnected = false;
        this.saveState();

        // Оповіщаємо менеджери
        if (this.managers.flexEarn) {
            this.managers.flexEarn.onWalletDisconnected();
        }
    };

    /**
     * Обробка завершення завдання
     */
    TasksIntegration.prototype.handleTaskCompleted = function(event) {
        console.log('✅ [TASKS-INTEGRATION] Завдання виконано:', event.detail);

        // Синхронізуємо дані
        this.syncData();
    };

    /**
     * Обробка оновлення балансу
     */
    TasksIntegration.prototype.handleBalanceUpdated = function(event) {
        console.log('💰 [TASKS-INTEGRATION] Баланс оновлено:', event.detail);

        // Можна оновити UI або виконати інші дії
    };

    /**
     * Показати повідомлення про офлайн режим
     */
    TasksIntegration.prototype.showOfflineNotice = function() {
        const notice = document.getElementById('offline-notice');
        if (notice) {
            notice.style.display = 'block';
        } else {
            // Створюємо повідомлення якщо його немає
            const div = document.createElement('div');
            div.id = 'offline-notice';
            div.className = 'offline-notice';
            div.innerHTML = '⚠️ Працюємо в офлайн режимі. Деякі функції можуть бути недоступні.';
            document.body.insertBefore(div, document.body.firstChild);
        }
    };

    /**
     * Приховати повідомлення про офлайн режим
     */
    TasksIntegration.prototype.hideOfflineNotice = function() {
        const notice = document.getElementById('offline-notice');
        if (notice) {
            notice.style.display = 'none';
        }
    };

    /**
     * Показати критичну помилку
     */
    TasksIntegration.prototype.showCriticalError = function(message) {
        console.error('💥 [TASKS-INTEGRATION] КРИТИЧНА ПОМИЛКА:', message);

        const errorDiv = document.createElement('div');
        errorDiv.className = 'critical-error';
        errorDiv.innerHTML = `
            <h3>❌ Критична помилка</h3>
            <p>${message}</p>
            <button onclick="location.reload()">Перезавантажити</button>
        `;

        document.body.innerHTML = '';
        document.body.appendChild(errorDiv);
    };

    /**
     * Очищення ресурсів
     */
    TasksIntegration.prototype.destroy = function() {
        console.log('🧹 [TASKS-INTEGRATION] Очищення ресурсів...');

        // Зупиняємо інтервали
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });

        // Знищуємо менеджери
        Object.values(this.managers).forEach(manager => {
            if (manager && typeof manager.destroy === 'function') {
                manager.destroy();
            }
        });

        // Зберігаємо стан
        this.saveState();

        console.log('✅ [TASKS-INTEGRATION] Ресурси очищено');
    };

    // Повертаємо конструктор
    return TasksIntegration;

})();

// Експортуємо для глобального використання
console.log('✅ [TASKS-INTEGRATION] Модуль TasksIntegration експортовано глобально');