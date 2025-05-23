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
            tasksManager: null
        };

        this.state = {
            userId: null,
            isInitialized: false,
            currentTab: 'flex',
            walletConnected: false
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
    TasksIntegration.prototype.init = function() {
        console.log('🎯 [TasksIntegration] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ СИСТЕМИ =====');
        console.log('🕐 [TasksIntegration] Час початку:', new Date().toISOString());

        try {
            // Отримуємо ID користувача
            this.state.userId = this.getUserId();
            console.log('👤 [TasksIntegration] User ID:', this.state.userId);

            if (!this.state.userId) {
                throw new Error('Не вдалося отримати ID користувача');
            }

            // Перевіряємо наявність необхідних модулів
            this.checkRequiredModules();

            // Ініціалізуємо менеджери
            this.initializeManagers();

            // Налаштовуємо обробники подій
            this.setupEventHandlers();

            // Налаштовуємо автозбереження
            this.setupAutoSave();

            // Перевіряємо стан кошелька при ініціалізації
            this.checkWalletStatus();

            // Позначаємо як ініціалізовано
            this.state.isInitialized = true;

            console.log('✅ [TasksIntegration] ===== СИСТЕМА УСПІШНО ІНІЦІАЛІЗОВАНА =====');
            console.log('📊 [TasksIntegration] Поточний стан:', this.state);

            return this;

        } catch (error) {
            console.error('❌ [TasksIntegration] КРИТИЧНА ПОМИЛКА ІНІЦІАЛІЗАЦІЇ:', error);
            console.error('❌ [TasksIntegration] Stack trace:', error.stack);
            this.showError('Помилка ініціалізації системи: ' + error.message);
            throw error;
        }
    };

    /**
     * Отримати ID користувача
     */
    TasksIntegration.prototype.getUserId = function() {
        console.log('🔍 [TasksIntegration] Отримання ID користувача...');

        // Спроба отримати з Telegram WebApp
        if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
            const tgId = parseInt(window.Telegram.WebApp.initDataUnsafe.user.id);
            console.log('✅ [TasksIntegration] ID з Telegram:', tgId);
            return tgId;
        }

        // Спроба отримати з localStorage
        const storedId = localStorage.getItem('telegram_user_id') || localStorage.getItem('user_id');
        if (storedId) {
            const numericId = parseInt(storedId);
            console.log('✅ [TasksIntegration] ID з localStorage:', numericId);
            return numericId;
        }

        // Демо режим
        if (this.config.debugMode) {
            const demoId = 123456789;
            console.warn('⚠️ [TasksIntegration] Використовується демо ID:', demoId);
            return demoId;
        }

        console.error('❌ [TasksIntegration] Не вдалося отримати ID користувача');
        return null;
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
            'DailyBonusManager': window.DailyBonusManager
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
    TasksIntegration.prototype.initializeManagers = function() {
        console.log('🔧 [TasksIntegration] Ініціалізація менеджерів...');

        // FlexEarn Manager
        if (window.FlexEarnManager) {
            console.log('  🔧 [TasksIntegration] Ініціалізація FlexEarnManager...');
            this.managers.flexEarn = window.FlexEarnManager;
            this.managers.flexEarn.init(this.state.userId);
            console.log('  ✅ [TasksIntegration] FlexEarnManager ініціалізовано');
        }

        // Daily Bonus Manager
        if (window.DailyBonusManager) {
            console.log('  🔧 [TasksIntegration] Ініціалізація DailyBonusManager...');
            this.managers.dailyBonus = window.DailyBonusManager;
            this.managers.dailyBonus.init(this.state.userId);
            console.log('  ✅ [TasksIntegration] DailyBonusManager ініціалізовано');
        }

        // Tasks Manager
        if (window.TasksManager) {
            console.log('  🔧 [TasksIntegration] Ініціалізація TasksManager...');
            this.managers.tasksManager = window.TasksManager;
            this.managers.tasksManager.init(this.state.userId);
            console.log('  ✅ [TasksIntegration] TasksManager ініціалізовано');
        }

        // Task Verification
        if (window.TaskVerification) {
            console.log('  🔧 [TasksIntegration] Ініціалізація TaskVerification...');
            this.managers.verification = window.TaskVerification;
            // TaskVerification ініціалізується в TasksManager
            console.log('  ✅ [TasksIntegration] TaskVerification готовий');
        }

        console.log('✅ [TasksIntegration] Всі менеджери ініціалізовано');
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

        console.log('✅ [TasksIntegration] Обробники подій налаштовано');
    };

    /**
     * Перемикання вкладок
     */
    TasksIntegration.prototype.switchTab = function(tabName) {
        console.log(`📑 [TasksIntegration] Перемикання на вкладку: ${tabName}`);

        this.state.currentTab = tabName;

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
                if (this.managers.flexEarn && this.state.walletConnected) {
                    console.log('  🔄 [TasksIntegration] Оновлення Flex даних...');
                    this.managers.flexEarn.checkFlexBalance();
                }
                break;

            case 'daily':
                if (this.managers.dailyBonus) {
                    console.log('  🔄 [TasksIntegration] Оновлення Daily Bonus...');
                    this.managers.dailyBonus.updateDailyBonusUI();
                }
                break;

            case 'social':
                if (this.managers.tasksManager) {
                    console.log('  🔄 [TasksIntegration] Оновлення Social завдань...');
                    this.managers.tasksManager.updateTasksUI();
                }
                break;

            case 'limited':
                if (this.managers.tasksManager) {
                    console.log('  🔄 [TasksIntegration] Оновлення Limited завдань...');
                    this.managers.tasksManager.updateTasksUI();
                }
                break;

            case 'partner':
                if (this.managers.tasksManager) {
                    console.log('  🔄 [TasksIntegration] Оновлення Partner завдань...');
                    this.managers.tasksManager.updateTasksUI();
                }
                break;

            default:
                console.warn(`  ⚠️ [TasksIntegration] Невідома вкладка: ${tabName}`);
        }
    };

    /**
     * Перевірка статусу кошелька
     */
    TasksIntegration.prototype.checkWalletStatus = function() {
        console.log('🔍 [TasksIntegration] Перевірка статусу кошелька при ініціалізації...');

        // Якщо на вкладці Flex - перевіряємо кошелек
        if (this.state.currentTab === 'flex' && this.managers.flexEarn) {
            this.managers.flexEarn.checkWalletConnection();
        }
    };

    /**
     * Налаштувати автозбереження
     */
    TasksIntegration.prototype.setupAutoSave = function() {
        console.log('💾 [TasksIntegration] Налаштування автозбереження...');

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

            localStorage.setItem('tasksSystemState', JSON.stringify(stateToSave));
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

        // Оновлюємо дані
        this.onTabSwitch(this.state.currentTab);
    };

    /**
     * Обробка втрати з'єднання
     */
    TasksIntegration.prototype.onOffline = function() {
        console.log('📵 [TasksIntegration] Обробка втрати з\'єднання...');

        this.showToast('З\'єднання втрачено', 'error');
    };

    /**
     * Показати повідомлення
     */
    TasksIntegration.prototype.showToast = function(message, type = 'info') {
        console.log(`💬 [TasksIntegration] Toast: ${type} - ${message}`);

        const toast = document.getElementById('toast-message');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast-message show ' + type;

            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
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

        // Очищуємо інтервали
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Знищуємо менеджери
        Object.values(this.managers).forEach(manager => {
            if (manager && typeof manager.destroy === 'function') {
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
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 [TasksIntegration] DOM завантажено, запуск ініціалізації...');

    try {
        window.tasksIntegration = window.TasksIntegration.init();
        console.log('🎉 [TasksIntegration] Система завдань успішно запущена!');
    } catch (error) {
        console.error('❌ [TasksIntegration] Не вдалося запустити систему:', error);
    }
});