/**
 * Головний інтеграційний модуль для системи завдань WINIX
 * Координує роботу всіх підмодулів
 */

window.TasksIntegration = (function() {
    'use strict';

    console.log('🚀 [TasksIntegration] ===== ІНІЦІАЛІЗАЦІЯ ІНТЕГРАЦІЙНОГО МОДУЛЯ =====');

    /**
     * Конструктор інтеграції
     */
    function TasksIntegration() {
        console.log('🔧 [TasksIntegration] Створення нового екземпляра TasksIntegration');

        this.managers = {
            flexEarn: null,
            dailyBonus: null,
            tasks: null,
            verification: null,
            tasksManager: null,
            walletChecker: null
        };

        this.state = {
            userId: null,
            isInitialized: false,
            currentTab: 'flex',
            walletConnected: false,
            isAuthenticating: false
        };

        this.config = {
            autoSaveInterval: 30000, // 30 секунд
            syncInterval: 60000,     // 1 хвилина
            debugMode: window.TasksConstants?.DEBUG?.ENABLED || false
        };

        console.log('📊 [TasksIntegration] Початкова конфігурація:', this.config);
    }

    /**
     * Ініціалізація системи
     */
    TasksIntegration.prototype.init = async function() {
        console.log('🎯 [TasksIntegration] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ СИСТЕМИ =====');
        console.log('🕐 [TasksIntegration] Час початку:', new Date().toISOString());

        try {
            // Спочатку авторизуємо користувача
            await this.authenticateUser();

            // Перевіряємо наявність необхідних модулів
            this.checkRequiredModules();

            // Ініціалізуємо менеджери
            await this.initializeManagers();

            // Налаштовуємо обробники подій
            this.setupEventHandlers();

            // Налаштовуємо автозбереження
            this.setupAutoSave();

            // Запускаємо початкову синхронізацію
            await this.initialSync();

            // Позначаємо як ініціалізовано
            this.state.isInitialized = true;

            console.log('✅ [TasksIntegration] ===== СИСТЕМА УСПІШНО ІНІЦІАЛІЗОВАНА =====');
            console.log('📊 [TasksIntegration] Поточний стан:', this.state);

            // Відстежуємо успішну ініціалізацію
            window.TasksServices?.Analytics?.trackEvent('System', 'initialized', 'success');

            return this;

        } catch (error) {
            console.error('❌ [TasksIntegration] КРИТИЧНА ПОМИЛКА ІНІЦІАЛІЗАЦІЇ:', error);
            console.error('❌ [TasksIntegration] Stack trace:', error.stack);

            // Відстежуємо помилку
            window.TasksServices?.Analytics?.trackError(error, 'init');

            this.showError('Помилка ініціалізації системи: ' + error.message);
            throw error;
        }
    };

    /**
     * Авторизація користувача
     */
    TasksIntegration.prototype.authenticateUser = async function() {
        console.log('🔐 [TasksIntegration] === АВТОРИЗАЦІЯ КОРИСТУВАЧА ===');

        if (this.state.isAuthenticating) {
            console.log('⏸️ [TasksIntegration] Авторизація вже виконується');
            return;
        }

        this.state.isAuthenticating = true;

        try {
            // Ініціалізуємо користувача через AuthService
            const user = await window.TasksServices.Auth.initUser();

            this.state.userId = user.id;
            console.log('✅ [TasksIntegration] Користувач авторизований:', user.id);

            // Відстежуємо успішну авторизацію
            window.TasksServices?.Analytics?.trackEvent('Auth', 'success', user.id);

        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка авторизації:', error);

            // Показуємо сторінку помилки або перенаправляємо
            this.showAuthError(error.message);
            throw new Error('Authentication failed');
        } finally {
            this.state.isAuthenticating = false;
        }
    };

    /**
     * Перевірити наявність необхідних модулів
     */
    TasksIntegration.prototype.checkRequiredModules = function() {
        console.log('🔍 [TasksIntegration] Перевірка необхідних модулів...');

        const requiredModules = {
            'TelegramValidator': window.TelegramValidator,
            'FlexEarnManager': window.FlexEarnManager,
            'TasksConstants': window.TasksConstants,
            'TasksManager': window.TasksManager,
            'TaskVerification': window.TaskVerification,
            'DailyBonusManager': window.DailyBonusManager,
            'WalletChecker': window.WalletChecker,
            'TasksAPI': window.TasksAPI,
            'TasksStore': window.TasksStore,
            'TasksServices': window.TasksServices,
            'TasksUtils': window.TasksUtils
        };

        const missingModules = [];

        Object.entries(requiredModules).forEach(([name, module]) => {
            if (!module) {
                missingModules.push(name);
                console.error(`❌ [TasksIntegration] Відсутній модуль: ${name}`);
            } else {
                console.log(`✅ [TasksIntegration] Модуль ${name} знайдено`);
            }
        });

        if (missingModules.length > 0) {
            throw new Error(`Відсутні необхідні модулі: ${missingModules.join(', ')}`);
        }

        console.log('✅ [TasksIntegration] Всі необхідні модулі присутні');
    };

    /**
     * Ініціалізувати менеджери
     */
    TasksIntegration.prototype.initializeManagers = async function() {
        console.log('🔧 [TasksIntegration] Ініціалізація менеджерів...');

        const userId = this.state.userId;

        // WalletChecker - ініціалізуємо першим для Flex
        if (window.WalletChecker) {
            console.log('  🔧 [TasksIntegration] Ініціалізація WalletChecker...');
            try {
                this.managers.walletChecker = window.WalletChecker;
                await this.managers.walletChecker.init();
                console.log('  ✅ [TasksIntegration] WalletChecker ініціалізовано');
            } catch (error) {
                console.error('  ❌ [TasksIntegration] Помилка ініціалізації WalletChecker:', error);
                // Не критично, продовжуємо без гаманця
            }
        }

        // FlexEarn Manager
        if (window.FlexEarnManager) {
            console.log('  🔧 [TasksIntegration] Ініціалізація FlexEarnManager...');
            this.managers.flexEarn = window.FlexEarnManager;
            this.managers.flexEarn.init(userId);
            console.log('  ✅ [TasksIntegration] FlexEarnManager ініціалізовано');
        }

        // Daily Bonus Manager
        if (window.DailyBonusManager) {
            console.log('  🔧 [TasksIntegration] Ініціалізація DailyBonusManager...');
            this.managers.dailyBonus = window.DailyBonusManager;
            await this.managers.dailyBonus.init(userId);
            console.log('  ✅ [TasksIntegration] DailyBonusManager ініціалізовано');
        }

        // Tasks Manager
        if (window.TasksManager) {
            console.log('  🔧 [TasksIntegration] Ініціалізація TasksManager...');
            this.managers.tasksManager = window.TasksManager;
            await this.managers.tasksManager.init(userId);
            console.log('  ✅ [TasksIntegration] TasksManager ініціалізовано');
        }

        // Task Verification
        if (window.TaskVerification) {
            console.log('  🔧 [TasksIntegration] Ініціалізація TaskVerification...');
            this.managers.verification = window.TaskVerification;
            this.managers.verification.init();
            console.log('  ✅ [TasksIntegration] TaskVerification готовий');
        }

        console.log('✅ [TasksIntegration] Всі менеджери ініціалізовано');
    };

    /**
     * Початкова синхронізація
     */
    TasksIntegration.prototype.initialSync = async function() {
        console.log('🔄 [TasksIntegration] === ПОЧАТКОВА СИНХРОНІЗАЦІЯ ===');

        try {
            // Запускаємо синхронізацію через SyncService
            await window.TasksServices.Sync.syncData();
            console.log('✅ [TasksIntegration] Початкова синхронізація завершена');
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка синхронізації:', error);
            // Не критично, продовжуємо роботу
        }
    };

    /**
     * Налаштувати обробники подій
     */
    TasksIntegration.prototype.setupEventHandlers = function() {
        console.log('🎯 [TasksIntegration] Налаштування обробників подій...');

        // Обробники для вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        console.log(`  📑 [TasksIntegration] Знайдено ${tabs.length} вкладок`);

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', (e) => {
                const tabName = tab.getAttribute('data-tab');
                console.log(`  📑 [TasksIntegration] Клік на вкладку ${index}: ${tabName}`);
                this.switchTab(tabName);

                // Відстежуємо перемикання вкладок
                window.TasksServices?.Analytics?.trackEvent('Navigation', 'tab_switch', tabName);
            });
        });

        // Обробник видимості сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ [TasksIntegration] Сторінка стала видимою');
                this.onPageVisible();
            } else {
                console.log('👁️ [TasksIntegration] Сторінка прихована');
                this.onPageHidden();
            }
        });

        // Обробник онлайн/офлайн
        window.addEventListener('online', () => {
            console.log('🌐 [TasksIntegration] Підключення відновлено');
            this.onOnline();
        });

        window.addEventListener('offline', () => {
            console.log('📵 [TasksIntegration] Підключення втрачено');
            this.onOffline();
        });

        // Обробник помилок
        window.addEventListener('unhandledrejection', (event) => {
            console.error('❌ [TasksIntegration] Необроблена помилка Promise:', event.reason);
            window.TasksServices?.Analytics?.trackError(event.reason, 'unhandled_promise');
        });

        console.log('✅ [TasksIntegration] Обробники подій налаштовано');
    };

    /**
     * Перемикання вкладок
     */
    TasksIntegration.prototype.switchTab = function(tabName) {
        console.log(`📑 [TasksIntegration] Перемикання на вкладку: ${tabName}`);

        this.state.currentTab = tabName;

        // Оновлюємо Store
        window.TasksStore.actions.setCurrentTab(tabName);

        // Оновлюємо UI вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        const panes = document.querySelectorAll('.main-tab-pane');

        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        panes.forEach(pane => {
            if (pane.id === `${tabName}-tab`) {
                pane.classList.add('active');
                console.log(`  ✅ [TasksIntegration] Панель ${tabName} активована`);
            } else {
                pane.classList.remove('active');
            }
        });

        // Виконуємо дії специфічні для вкладки
        this.onTabSwitch(tabName);
    };

    /**
     * Обробка перемикання вкладки
     */
    TasksIntegration.prototype.onTabSwitch = function(tabName) {
        console.log(`🔄 [TasksIntegration] Обробка перемикання на вкладку: ${tabName}`);

        switch(tabName) {
            case 'flex':
                if (this.managers.flexEarn) {
                    console.log('  🔄 [TasksIntegration] Перевірка статусу гаманця...');
                    this.managers.flexEarn.checkWalletConnection();
                }
                break;

            case 'daily':
                if (this.managers.dailyBonus) {
                    console.log('  🔄 [TasksIntegration] Оновлення Daily Bonus...');
                    this.managers.dailyBonus.updateDailyBonusUI();
                }
                break;

            case 'social':
            case 'limited':
            case 'partner':
                if (this.managers.tasksManager) {
                    console.log(`  🔄 [TasksIntegration] Оновлення ${tabName} завдань...`);
                    this.managers.tasksManager.updateTasksUI();
                }
                break;

            default:
                console.warn(`  ⚠️ [TasksIntegration] Невідома вкладка: ${tabName}`);
        }
    };

    /**
     * Налаштувати автозбереження
     */
    TasksIntegration.prototype.setupAutoSave = function() {
        console.log('💾 [TasksIntegration] Налаштування автозбереження');

        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(() => {
            this.saveState();
        }, this.config.autoSaveInterval);

        console.log(`✅ [TasksIntegration] Автозбереження налаштовано (кожні ${this.config.autoSaveInterval/1000} сек)`);
    };

    /**
     * Зберегти стан
     */
    TasksIntegration.prototype.saveState = function() {
        console.log('💾 [TasksIntegration] Збереження стану системи...');

        try {
            const stateToSave = {
                userId: this.state.userId,
                currentTab: this.state.currentTab,
                timestamp: Date.now()
            };

            window.TasksUtils.storage.setSecure('tasksSystemState', stateToSave);
            console.log('✅ [TasksIntegration] Стан збережено:', stateToSave);
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка збереження стану:', error);
        }
    };

    /**
     * Обробка видимості сторінки
     */
    TasksIntegration.prototype.onPageVisible = function() {
        console.log('👁️ [TasksIntegration] Обробка відновлення видимості...');

        // Перевіряємо сесію
        window.TasksServices?.Auth?.checkSession();

        // Синхронізуємо дані
        window.TasksServices?.Sync?.syncData();

        // Оновлюємо дані поточної вкладки
        this.onTabSwitch(this.state.currentTab);
    };

    /**
     * Обробка приховування сторінки
     */
    TasksIntegration.prototype.onPageHidden = function() {
        console.log('👁️ [TasksIntegration] Обробка приховування сторінки...');

        // Зберігаємо стан
        this.saveState();
    };

    /**
     * Обробка відновлення з'єднання
     */
    TasksIntegration.prototype.onOnline = function() {
        console.log('🌐 [TasksIntegration] Обробка відновлення з\'єднання...');

        this.showToast('З\'єднання відновлено', 'success');

        // Синхронізуємо дані
        window.TasksServices?.Sync?.syncData();

        // Оновлюємо дані
        this.onTabSwitch(this.state.currentTab);
    };

    /**
     * Обробка втрати з'єднання
     */
    TasksIntegration.prototype.onOffline = function() {
        console.log('📵 [TasksIntegration] Обробка втрати з\'єднання...');

        this.showToast('З\'єднання втрачено. Деякі функції можуть бути недоступні', 'warning');
    };

    /**
     * Показати повідомлення
     */
    TasksIntegration.prototype.showToast = function(message, type = 'info') {
        console.log(`💬 [TasksIntegration] Toast: ${type} - ${message}`);
        window.TasksUtils?.showToast(message, type);
    };

    /**
     * Показати помилку
     */
    TasksIntegration.prototype.showError = function(message) {
        console.error('❌ [TasksIntegration] Помилка:', message);
        this.showToast(message, 'error');
    };

    /**
     * Показати помилку авторизації
     */
    TasksIntegration.prototype.showAuthError = function(message) {
        console.error('❌ [TasksIntegration] Помилка авторизації:', message);

        // Показуємо спеціальну сторінку помилки
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div class="auth-error">
                    <h2>Помилка авторизації</h2>
                    <p>${message}</p>
                    <p>Будь ласка, відкрийте додаток через Telegram</p>
                    <button onclick="window.location.reload()">Оновити сторінку</button>
                </div>
            `;
        }
    };

    /**
     * Знищити інтеграцію
     */
    TasksIntegration.prototype.destroy = function() {
        console.log('🧹 [TasksIntegration] Знищення системи...');

        // Очищаємо інтервали
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Знищуємо менеджери
        Object.entries(this.managers).forEach(([name, manager]) => {
            if (manager && typeof manager.destroy === 'function') {
                console.log(`  🧹 [TasksIntegration] Знищення ${name}...`);
                manager.destroy();
            }
        });

        // Зберігаємо фінальний стан
        this.saveState();

        console.log('✅ [TasksIntegration] Система знищена');
    };

    // Створюємо і повертаємо екземпляр
    const integration = new TasksIntegration();

    console.log('✅ [TasksIntegration] Інтеграційний модуль готовий до ініціалізації');

    return integration;

})();

// Автоматична ініціалізація при завантаженні DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 [TasksIntegration] DOM завантажено, запуск ініціалізації...');

    try {
        window.tasksIntegration = await window.TasksIntegration.init();
        console.log('🎉 [TasksIntegration] Система завдань успішно запущена!');
    } catch (error) {
        console.error('❌ [TasksIntegration] Не вдалося запустити систему:', error);

        // Показуємо користувачу помилку
        document.body.innerHTML = `
            <div class="system-error">
                <h1>Помилка запуску</h1>
                <p>Не вдалося запустити систему завдань</p>
                <p>${error.message}</p>
                <button onclick="window.location.reload()">Перезавантажити</button>
            </div>
        `;
    }
});