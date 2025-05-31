/**
 * Оптимізований інтеграційний модуль для системи завдань WINIX
 * Використовує EventBus та централізовані утиліти для уникнення циклічностей
 */

window.TasksIntegration = (function() {
    'use strict';

    console.log('📦 [TasksIntegration] ===== ЗАВАНТАЖЕННЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    /**
     * Конструктор інтеграції
     */
    function TasksIntegration() {
        console.log('🏗️ [TasksIntegration] Створення екземпляру');

        this.userId = null;
        this.isInitialized = false;
        this.managers = new Map();
        this.eventSubscriptions = [];

        // RequestManager клієнт для цього модуля
        this.requestClient = RequestManager.createClient('integration');

        console.log('✅ [TasksIntegration] Екземпляр створено');
    }

    /**
     * Ініціалізація системи
     */
    TasksIntegration.prototype.init = async function() {
        console.log('🚀 [TasksIntegration] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ =====');

        try {
            // Крок 1: Отримання та валідація користувача
            await this.initializeUser();

            // Крок 2: Ініціалізація Store
            this.initializeStore();

            // Крок 3: Налаштування обробників подій
            this.setupEventHandlers();

            // Крок 4: Швидкий старт з кешованими даними
            this.quickStartWithCache();

            // Крок 5: Асинхронне завантаження даних
            this.loadDataAsync();

            // Крок 6: Ініціалізація менеджерів
            await this.initializeManagers();

            this.isInitialized = true;

            // Емітуємо подію готовності
            EventBus.emit(EventBus.EVENTS.APP_READY, {
                integration: true,
                userId: this.userId
            });

            console.log('🎉 [TasksIntegration] ===== ІНІЦІАЛІЗАЦІЯ ЗАВЕРШЕНА =====');

            return this;

        } catch (error) {
            console.error('❌ [TasksIntegration] Критична помилка:', error);
            EventBus.emit(EventBus.EVENTS.APP_ERROR, { error, module: 'integration' });
            throw error;
        }
    };

    /**
     * Ініціалізація користувача
     */
    TasksIntegration.prototype.initializeUser = async function() {
        console.log('👤 [TasksIntegration] Ініціалізація користувача');

        // Отримуємо ID користувача
        this.userId = await this.getUserId();

        if (!this.userId) {
            throw new Error('Не вдалося отримати ID користувача');
        }

        console.log('✅ [TasksIntegration] User ID:', this.userId);

        // Встановлюємо в header
        this.setUserIdInHeader();
    };

    /**
     * Отримання ID користувача
     */
    TasksIntegration.prototype.getUserId = async function() {
        console.log('🔍 [TasksIntegration] Пошук User ID');

        // Перевіряємо кеш
        const cached = CacheManager.get(CacheManager.NAMESPACES.USER, 'userId');
        if (cached) {
            return cached;
        }

        // Джерела ID
        const sources = [
            () => window.TasksStore?.selectors?.getUserId?.(),
            () => window.WinixAPI?.getUserId?.(),
            () => localStorage.getItem('telegram_user_id'),
            () => localStorage.getItem('user_id'),
            () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
            () => window.TasksAPI?.getUserId?.()
        ];

        // Синхронна перевірка
        for (const source of sources) {
            try {
                const id = source();
                if (id && id !== 'undefined' && id !== 'null') {
                    const numericId = parseInt(id);
                    if (!isNaN(numericId) && numericId > 0) {
                        // Кешуємо результат
                        CacheManager.set(CacheManager.NAMESPACES.USER, 'userId', numericId);
                        return numericId;
                    }
                }
            } catch (e) {
                console.warn('⚠️ [TasksIntegration] Помилка в джерелі:', e);
            }
        }

        // Якщо не знайдено - чекаємо на подію
        console.log('⏳ [TasksIntegration] Очікуємо User ID...');

        try {
            const eventData = await EventBus.waitFor(EventBus.EVENTS.USER_LOGGED_IN, 10000);
            if (eventData?.userId) {
                CacheManager.set(CacheManager.NAMESPACES.USER, 'userId', eventData.userId);
                return eventData.userId;
            }
        } catch (timeout) {
            console.error('❌ [TasksIntegration] Таймаут очікування User ID');
        }

        return null;
    };

    /**
     * Встановлення ID в header
     */
    TasksIntegration.prototype.setUserIdInHeader = function() {
        const userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
        const value = this.userId || 'Не визначено';

        userIdElements.forEach(element => {
            if (element) {
                element.textContent = value;
            }
        });
    };

    /**
     * Ініціалізація Store
     */
    TasksIntegration.prototype.initializeStore = function() {
        console.log('🏪 [TasksIntegration] Ініціалізація Store');

        if (!window.TasksStore) {
            console.warn('⚠️ [TasksIntegration] TasksStore недоступний');
            return;
        }

        // Підписуємось на зміни Store через EventBus
        this.eventSubscriptions.push(
            EventBus.on('store.updated', this.handleStoreUpdate.bind(this))
        );
    };

    /**
     * Обробка оновлень Store
     */
    TasksIntegration.prototype.handleStoreUpdate = function(data) {
        const { state, prevState, actions } = data;

        // Обробляємо тільки важливі зміни
        if (state.user.balance !== prevState.user.balance) {
            this.updateBalanceDisplay(state.user.balance);
        }

        if (state.ui.currentTab !== prevState.ui.currentTab) {
            this.handleTabChange(state.ui.currentTab);
        }
    };

    /**
     * Налаштування обробників подій
     */
    TasksIntegration.prototype.setupEventHandlers = function() {
        console.log('🎯 [TasksIntegration] Налаштування обробників подій');

        // Підписуємось на системні події
        this.eventSubscriptions.push(
            // Баланс
            EventBus.on(EventBus.EVENTS.BALANCE_UPDATED, (data) => {
                console.log('💰 [TasksIntegration] Оновлення балансу:', data);
                this.updateBalanceDisplay(data.newBalance);
            }),

            // Гаманець
            EventBus.on(EventBus.EVENTS.WALLET_CONNECTED, () => {
                console.log('👛 [TasksIntegration] Гаманець підключено');
                this.loadWalletData();
            }),

            EventBus.on(EventBus.EVENTS.WALLET_DISCONNECTED, () => {
                console.log('👛 [TasksIntegration] Гаманець відключено');
            }),

            // Завдання
            EventBus.on(EventBus.EVENTS.TASK_COMPLETED, (data) => {
                console.log('✅ [TasksIntegration] Завдання виконано:', data);
                this.refreshTasks();
            }),

            // Daily Bonus
            EventBus.on(EventBus.EVENTS.DAILY_CLAIMED, (data) => {
                console.log('🎁 [TasksIntegration] Daily bonus отримано:', data);
            }),

            // Вкладки
            EventBus.on(EventBus.EVENTS.TAB_CHANGED, (data) => {
                console.log('📑 [TasksIntegration] Зміна вкладки:', data);
                this.handleTabChange(data.newTab);
            })
        );

        // DOM події
        this.setupDOMEventHandlers();
    };

    /**
     * DOM обробники подій
     */
    TasksIntegration.prototype.setupDOMEventHandlers = function() {
        // Делегування подій для вкладок
        const tabContainer = document.querySelector('.main-tabs');
        if (tabContainer) {
            tabContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.tab-button');
                if (tab) {
                    const tabName = tab.getAttribute('data-tab');
                    this.showTab(tabName);
                }
            });
        }

        // Відстеження активності
        const updateActivity = window.TasksUtils.throttle(() => {
            sessionStorage.setItem('lastUserActivity', Date.now().toString());
        }, 1000);

        ['click', 'keypress', 'mousemove', 'touchstart'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Видимість сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isInitialized) {
                this.handlePageVisible();
            }
        });
    };

    /**
     * Швидкий старт з кешованими даними
     */
    TasksIntegration.prototype.quickStartWithCache = function() {
        console.log('⚡ [TasksIntegration] Швидкий старт з кешу');

        // Профіль користувача
        const cachedProfile = CacheManager.get(CacheManager.NAMESPACES.USER, `profile_${this.userId}`);
        if (cachedProfile) {
            this.processProfileData(cachedProfile);
        }

        // Баланс
        const cachedBalance = CacheManager.get(CacheManager.NAMESPACES.BALANCE, this.userId);
        if (cachedBalance) {
            this.updateBalanceDisplay(cachedBalance);
        }

        // Показуємо початкову вкладку
        this.showTab('flex');
    };

    /**
     * Асинхронне завантаження даних
     */
    TasksIntegration.prototype.loadDataAsync = function() {
        console.log('📊 [TasksIntegration] Асинхронне завантаження даних');

        // Використовуємо RequestManager для паралельного завантаження
        this.requestClient.batch([
            {
                id: `profile_${this.userId}`,
                fn: () => this.loadUserProfile()
            },
            {
                id: `wallet_status_${this.userId}`,
                fn: () => this.loadWalletStatus()
            },
            {
                id: `tasks_${this.userId}`,
                fn: () => this.loadTasks()
            }
        ]).then(results => {
            console.log('✅ [TasksIntegration] Всі дані завантажено');
        }).catch(error => {
            console.error('❌ [TasksIntegration] Помилка завантаження:', error);
        });
    };

    /**
     * Завантаження профілю
     */
    TasksIntegration.prototype.loadUserProfile = async function() {
        // Перевіряємо кеш
        const cached = CacheManager.get(CacheManager.NAMESPACES.USER, `profile_${this.userId}`);
        if (cached) {
            return cached;
        }

        const response = await window.TasksAPI.user.getProfile(this.userId);

        if (response?.status === 'success' && response.data) {
            // Кешуємо
            CacheManager.set(CacheManager.NAMESPACES.USER, `profile_${this.userId}`, response);

            // Обробляємо
            this.processProfileData(response);

            return response;
        }

        throw new Error('Failed to load profile');
    };

    /**
     * Обробка даних профілю
     */
    TasksIntegration.prototype.processProfileData = function(response) {
        if (!response?.data) return;

        // Оновлюємо Store
        window.TasksStore?.actions.setUser({
            id: this.userId,
            telegramId: this.userId,
            username: response.data.username || 'User',
            balance: response.data
        });

        // Оновлюємо баланс
        window.TasksStore?.actions.updateBalance(response.data);
    };

    /**
     * Завантаження статусу гаманця
     */
    TasksIntegration.prototype.loadWalletStatus = async function() {
        try {
            const response = await window.TasksAPI.wallet.checkStatus(this.userId);

            if (response?.status === 'success' && response.data) {
                EventBus.emit(EventBus.EVENTS.WALLET_CONNECTED, response.data);
            }

            return response;
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка перевірки гаманця:', error);
        }
    };

    /**
     * Завантаження даних гаманця
     */
    TasksIntegration.prototype.loadWalletData = async function() {
        const wallet = window.TasksStore?.selectors.getWalletAddress();
        if (!wallet) return;

        try {
            const response = await window.TasksAPI.flex.getBalance(this.userId, wallet);

            if (response?.balance !== undefined) {
                window.TasksStore?.actions.setFlexBalance(parseInt(response.balance));
            }
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка завантаження балансу FLEX:', error);
        }
    };

    /**
     * Завантаження завдань
     */
    TasksIntegration.prototype.loadTasks = async function() {
        try {
            const response = await window.TasksAPI.tasks.getList(this.userId, 'all');

            if (response?.status === 'success' && response.data?.tasks) {
                // Оновлюємо Store
                Object.entries(response.data.tasks).forEach(([type, tasks]) => {
                    window.TasksStore?.actions.setTasks(type, tasks);
                });
            }

            return response;
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка завантаження завдань:', error);
        }
    };

    /**
     * Оновлення завдань
     */
    TasksIntegration.prototype.refreshTasks = function() {
        // Інвалідуємо кеш
        CacheManager.invalidate(CacheManager.NAMESPACES.TASKS, `list_${this.userId}`);

        // Перезавантажуємо
        this.loadTasks();
    };

    /**
     * Ініціалізація менеджерів через прямий виклик
     */
    TasksIntegration.prototype.initializeManagers = async function() {
        console.log('🔧 [TasksIntegration] Ініціалізація менеджерів');

        try {
            // Ініціалізуємо Daily Bonus Manager
            if (window.DailyBonusManager) {
                await window.DailyBonusManager.init(this.userId);
                this.managers.set('dailyBonus', window.DailyBonusManager);
                console.log('✅ [TasksIntegration] DailyBonusManager ініціалізовано');
            }

            // Ініціалізуємо Tasks Manager
            if (window.TasksManager) {
                await window.TasksManager.init(this.userId);
                this.managers.set('tasks', window.TasksManager);
                console.log('✅ [TasksIntegration] TasksManager ініціалізовано');
            }

            // Ініціалізуємо Flex Earn Manager
            if (window.FlexEarnManager) {
                await window.FlexEarnManager.init(this.userId);
                this.managers.set('flexEarn', window.FlexEarnManager);
                console.log('✅ [TasksIntegration] FlexEarnManager ініціалізовано');
            }

            // Ініціалізуємо Wallet Checker
            if (window.WalletChecker) {
                await window.WalletChecker.init(this.userId);
                this.managers.set('wallet', window.WalletChecker);
                console.log('✅ [TasksIntegration] WalletChecker ініціалізовано');
            }

        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка ініціалізації менеджерів:', error);
            // Не блокуємо загальну ініціалізацію
        }
    };

    /**
     * Оновлення відображення балансу
     */
    TasksIntegration.prototype.updateBalanceDisplay = window.TasksUtils.debounce(function(data) {
        if (!data) return;

        const balance = parseInt(data.balance || data.winix) || 0;
        const coins = parseInt(data.coins || data.tickets) || 0;

        const tokensElement = document.getElementById('user-tokens');
        if (tokensElement) {
            tokensElement.textContent = balance.toLocaleString();
        }

        const coinsElement = document.getElementById('user-coins');
        if (coinsElement) {
            coinsElement.textContent = coins.toLocaleString();
        }
    }, 300);

    /**
     * Показати вкладку
     */
    TasksIntegration.prototype.showTab = function(tabName) {
        console.log('📑 [TasksIntegration] Показ вкладки:', tabName);

        // Оновлюємо Store
        window.TasksStore?.actions.setCurrentTab(tabName);

        // UI оновлення
        requestAnimationFrame(() => {
            // Приховуємо всі вкладки
            document.querySelectorAll('.main-tab-pane').forEach(pane => {
                pane.style.display = 'none';
                pane.classList.remove('active');
            });

            // Показуємо потрібну
            const targetPane = document.getElementById(tabName + '-tab');
            if (targetPane) {
                targetPane.style.display = 'block';
                targetPane.classList.add('active');
            }

            // Оновлюємо активну кнопку
            document.querySelectorAll('.main-tabs .tab-button').forEach(tab => {
                tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
            });
        });
    };

    /**
     * Обробка зміни вкладки
     */
    TasksIntegration.prototype.handleTabChange = function(tabName) {
        console.log('🔄 [TasksIntegration] Обробка зміни вкладки:', tabName);

        // Емітуємо подію для відповідного менеджера
        EventBus.emit(`tab.${tabName}.activated`, { userId: this.userId });
    };

    /**
     * Обробка видимості сторінки
     */
    TasksIntegration.prototype.handlePageVisible = function() {
        console.log('👁️ [TasksIntegration] Сторінка знову видима');

        // Перевіряємо чи потрібно оновити дані
        const lastUpdate = CacheManager.get(CacheManager.NAMESPACES.UI, 'lastUpdateTime') || 0;
        const timeSinceUpdate = Date.now() - lastUpdate;

        if (timeSinceUpdate > 60000) { // 1 хвилина
            // Оновлюємо критичні дані
            this.requestClient.execute(
                `balance_check_${this.userId}`,
                () => window.TasksAPI.user.getBalance(this.userId),
                { priority: 'high' }
            ).then(response => {
                if (response?.data) {
                    window.TasksStore?.actions.updateBalance(response.data);
                }
            });
        }

        CacheManager.set(CacheManager.NAMESPACES.UI, 'lastUpdateTime', Date.now());
    };

    /**
     * Знищення модуля
     */
    TasksIntegration.prototype.destroy = function() {
        console.log('🗑️ [TasksIntegration] Знищення модуля');

        // Відписуємось від подій
        this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
        this.eventSubscriptions = [];

        // Скасовуємо всі запити
        this.requestClient.cancelAll();

        // Очищаємо менеджери
        this.managers.clear();

        console.log('✅ [TasksIntegration] Модуль знищено');
    };

    console.log('✅ [TasksIntegration] Модуль TasksIntegration завантажено');

    return TasksIntegration;
})();

/**
 * Глобальна функція ініціалізації
 */
window.initTasksSystem = async function() {
    console.log('🎬 [GLOBAL] === initTasksSystem START (OPTIMIZED) ===');

    try {
        // Перевіряємо залежності
        const requiredModules = [
            'CacheManager',
            'RequestManager',
            'EventBus',
            'TasksStore',
            'TasksAPI',
            'TasksUtils'
        ];

        for (const module of requiredModules) {
            if (!window[module]) {
                throw new Error(`Модуль ${module} не завантажено`);
            }
        }

        // Створюємо та ініціалізуємо інтеграцію
        const integration = new window.TasksIntegration();
        await integration.init();

        // Зберігаємо глобально
        window.TasksIntegrationInstance = integration;

        console.log('🏁 [GLOBAL] === initTasksSystem SUCCESS (OPTIMIZED) ===');

        return integration;

    } catch (error) {
        console.error('💥 [GLOBAL] Критична помилка:', error);

        // Показуємо помилку користувачу
        if (window.TasksUtils?.showToast) {
            window.TasksUtils.showToast('Помилка ініціалізації системи', 'error');
        }

        throw error;
    }
};

console.log('✅ [GLOBAL] window.initTasksSystem функція зареєстрована (OPTIMIZED)');