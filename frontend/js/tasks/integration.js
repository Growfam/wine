/**
 * Головний інтеграційний модуль для системи завдань WINIX - Production Version
 * Координує роботу всіх підмодулів без Mock даних
 */

window.TasksIntegration = (function() {
    'use strict';

    console.log('🚀 [TasksIntegration] ===== ІНІЦІАЛІЗАЦІЯ ІНТЕГРАЦІЙНОГО МОДУЛЯ (PRODUCTION) =====');

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
            // Перевіряємо наявність необхідних сервісів
            this.checkRequiredServices();

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
            if (window.TasksServices?.Analytics) {
                window.TasksServices.Analytics.trackEvent('System', 'initialized', 'success');
            }

            return this;

        } catch (error) {
            console.error('❌ [TasksIntegration] КРИТИЧНА ПОМИЛКА ІНІЦІАЛІЗАЦІЇ:', error);
            console.error('❌ [TasksIntegration] Stack trace:', error.stack);

            // Показуємо користувачу помилку
            this.showError('Помилка ініціалізації системи. Перевірте підключення до інтернету та оновіть сторінку');

            throw error;
        }
    };

    /**
     * Перевірити наявність обов'язкових сервісів
     */
    TasksIntegration.prototype.checkRequiredServices = function() {
        console.log('🔍 [TasksIntegration] Перевірка обов`язкових сервісів...');

        const requiredServices = [
            'TasksAPI',
            'TasksStore',
            'TelegramValidator',
            'TasksConstants'
        ];

        const missing = requiredServices.filter(service => !window[service]);

        if (missing.length > 0) {
            throw new Error(`Відсутні обов'язкові сервіси: ${missing.join(', ')}`);
        }

        console.log('✅ [TasksIntegration] Всі обов`язкові сервіси присутні');
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
            // Тільки реальна авторизація через AuthService
            if (!window.TasksServices?.Auth) {
                throw new Error('Auth service not available');
            }

            const user = await window.TasksServices.Auth.initUser();
            this.state.userId = user.id;
            console.log('✅ [TasksIntegration] Користувач авторизований:', user.id);

            // Оновлюємо UI
            this.updateUserUI(user);

        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка авторизації:', error);
            this.showError('Помилка авторизації. Перевірте підключення до інтернету та оновіть сторінку');
            throw error;
        } finally {
            this.state.isAuthenticating = false;
        }
    };

    /**
     * Оновити UI користувача
     */
    TasksIntegration.prototype.updateUserUI = function(user) {
        console.log('🔄 [TasksIntegration] Оновлення UI користувача');

        // Оновлюємо ID
        const userIdElement = document.getElementById('header-user-id');
        if (userIdElement) {
            userIdElement.textContent = user.id || '';
        }

        // Оновлюємо аватар
        const avatarElement = document.querySelector('.profile-avatar');
        if (avatarElement && user.username) {
            avatarElement.textContent = user.username.charAt(0).toUpperCase();
        }

        // Оновлюємо баланси
        const winixElement = document.getElementById('user-winix');
        const ticketsElement = document.getElementById('user-tickets');

        if (winixElement) {
            winixElement.textContent = user.balance?.winix || 0;
        }

        if (ticketsElement) {
            ticketsElement.textContent = user.balance?.tickets || 0;
        }
    };

    /**
     * Перевірити наявність необхідних модулів
     */
    TasksIntegration.prototype.checkRequiredModules = function() {
        console.log('🔍 [TasksIntegration] Перевірка необхідних модулів...');

        const requiredModules = {
            'FlexEarnManager': window.FlexEarnManager,
            'TasksConstants': window.TasksConstants,
            'TasksManager': window.TasksManager,
            'TaskVerification': window.TaskVerification,
            'DailyBonusManager': window.DailyBonusManager,
            'TasksAPI': window.TasksAPI,
            'TasksStore': window.TasksStore,
            'TasksUtils': window.TasksUtils
        };

        const missingModules = [];
        const optionalModules = ['TelegramValidator', 'WalletChecker', 'TasksServices'];

        Object.entries(requiredModules).forEach(([name, module]) => {
            if (!module) {
                missingModules.push(name);
                console.error(`❌ [TasksIntegration] Відсутній модуль: ${name}`);
            } else {
                console.log(`✅ [TasksIntegration] Модуль ${name} знайдено`);
            }
        });

        // Перевіряємо опціональні модулі
        optionalModules.forEach(name => {
            if (!window[name]) {
                console.warn(`⚠️ [TasksIntegration] Опціональний модуль ${name} відсутній`);
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

        try {
            // WalletChecker
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

        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка ініціалізації менеджерів:', error);
            throw error;
        }
    };

    /**
     * Початкова синхронізація
     */
    TasksIntegration.prototype.initialSync = async function() {
        console.log('🔄 [TasksIntegration] === ПОЧАТКОВА СИНХРОНІЗАЦІЯ ===');

        try {
            // Запускаємо синхронізацію через SyncService
            if (window.TasksServices?.Sync) {
                await window.TasksServices.Sync.syncData();
                console.log('✅ [TasksIntegration] Початкова синхронізація завершена');
            }
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

        // Зберігаємо посилання на this для використання в обробниках
        const self = this;

        // Обробники для вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        console.log(`  📑 [TasksIntegration] Знайдено ${tabs.length} вкладок`);

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const tabName = this.getAttribute('data-tab');
                console.log(`  📑 [TasksIntegration] Клік на вкладку ${index}: ${tabName}`);

                // Використовуємо збережене посилання на self
                self.switchTab(tabName);

                // Відстежуємо перемикання вкладок
                if (window.TasksServices?.Analytics) {
                    window.TasksServices.Analytics.trackEvent('Navigation', 'tab_switch', tabName);
                }
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
            if (window.TasksServices?.Analytics) {
                window.TasksServices.Analytics.trackError(event.reason, 'unhandled_promise');
            }
        });

        console.log('✅ [TasksIntegration] Обробники подій налаштовано');
    };

    /**
     * Перемикання вкладок
     */
    TasksIntegration.prototype.switchTab = function(tabName) {
        console.log(`📑 [TasksIntegration] === ПЕРЕМИКАННЯ ВКЛАДКИ ===`);
        console.log(`📑 [TasksIntegration] Цільова вкладка: ${tabName}`);
        console.log(`📑 [TasksIntegration] Попередня вкладка: ${this.state.currentTab}`);

        // Перевіряємо чи вкладка змінилась
        if (this.state.currentTab === tabName) {
            console.log('ℹ️ [TasksIntegration] Вкладка вже активна');
            return;
        }

        this.state.currentTab = tabName;

        // Оновлюємо Store
        if (window.TasksStore) {
            window.TasksStore.actions.setCurrentTab(tabName);
        }

        // Оновлюємо UI вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        const panes = document.querySelectorAll('.main-tab-pane');

        console.log(`📑 [TasksIntegration] Оновлення UI для ${tabs.length} вкладок та ${panes.length} панелей`);

        // Оновлюємо вкладки
        tabs.forEach(tab => {
            const isActive = tab.getAttribute('data-tab') === tabName;
            if (isActive) {
                tab.classList.add('active');
                console.log(`  ✅ [TasksIntegration] Вкладка ${tabName} активована`);
            } else {
                tab.classList.remove('active');
            }
        });

        // Оновлюємо панелі контенту
        panes.forEach(pane => {
            const paneId = pane.id;
            const shouldBeActive = paneId === `${tabName}-tab`;

            if (shouldBeActive) {
                pane.classList.add('active');
                pane.style.display = 'block';
                console.log(`  ✅ [TasksIntegration] Панель ${paneId} показана`);
            } else {
                pane.classList.remove('active');
                pane.style.display = 'none';
            }
        });

        // Виконуємо дії специфічні для вкладки
        try {
            this.onTabSwitch(tabName);
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка при обробці перемикання вкладки:', error);
        }

        console.log('✅ [TasksIntegration] Перемикання вкладки завершено');
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

            if (window.TasksUtils?.storage) {
                window.TasksUtils.storage.setSecure('tasksSystemState', stateToSave);
                console.log('✅ [TasksIntegration] Стан збережено:', stateToSave);
            }
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
        if (window.TasksServices?.Auth) {
            window.TasksServices.Auth.checkSession();
        }

        // Синхронізуємо дані
        if (window.TasksServices?.Sync) {
            window.TasksServices.Sync.syncData();
        }

        // Оновлюємо дані поточної вкладки
        this.onTabSwitch(this.state.currentTab);
    };

    /**
     * Обробка приховування сторінки
     */
    TasksIntegration.prototype.onPageHidden = function() {
        console.log('👁️ [TasksIntegration] Обробка приховування сторінки...');
        this.saveState();
    };

    /**
     * Обробка відновлення з'єднання
     */
    TasksIntegration.prototype.onOnline = function() {
        console.log('🌐 [TasksIntegration] Обробка відновлення з\'єднання...');

        this.showToast('З\'єднання відновлено', 'success');

        // Синхронізуємо дані
        if (window.TasksServices?.Sync) {
            window.TasksServices.Sync.syncData();
        }

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
        if (window.TasksUtils?.showToast) {
            window.TasksUtils.showToast(message, type);
        }
    };

    /**
     * Показати помилку
     */
    TasksIntegration.prototype.showError = function(message) {
        console.error('❌ [TasksIntegration] Помилка:', message);
        this.showToast(message, 'error');
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
                try {
                    manager.destroy();
                } catch (error) {
                    console.error(`  ❌ [TasksIntegration] Помилка знищення ${name}:`, error);
                }
            }
        });

        // Зберігаємо фінальний стан
        this.saveState();

        console.log('✅ [TasksIntegration] Система знищена');
    };

    // Створюємо і повертаємо екземпляр
    const integration = new TasksIntegration();

    console.log('✅ [TasksIntegration] Інтеграційний модуль готовий до ініціалізації (Production)');

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

        // Показуємо користувачу повідомлення про помилку
        const container = document.querySelector('.container');
        if (container) {
            const notice = document.createElement('div');
            notice.style.cssText = 'background: #e74c3c; color: white; padding: 15px; text-align: center; margin-bottom: 10px; border-radius: 8px;';
            notice.innerHTML = `
                <strong>Помилка ініціалізації системи</strong><br>
                Перевірте підключення до інтернету та оновіть сторінку
            `;
            container.insertBefore(notice, container.firstChild);
        }
    }
});