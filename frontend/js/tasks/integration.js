/**
 * Головний інтеграційний модуль для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V4 - з централізованим кешуванням та усуненням циклічностей
 */
window.TasksIntegration = (function() {
    'use strict';

    console.log('📦 [TASKS-INTEGRATION-V4] Завантаження оптимізованого модуля...');

    // Централізований кеш менеджер
    const CacheManager = {
        cache: new Map(),
        timestamps: new Map(),
        ttl: {
            profile: 5 * 60 * 1000,      // 5 хвилин
            balance: 30 * 1000,          // 30 секунд
            tasks: 2 * 60 * 1000,        // 2 хвилини
            walletStatus: 60 * 1000,     // 1 хвилина
            dailyStatus: 60 * 1000       // 1 хвилина
        },

        set(key, data, customTTL) {
            this.cache.set(key, data);
            this.timestamps.set(key, Date.now());

            // Автоматичне очищення після TTL
            const ttl = customTTL || this.ttl[key.split('_')[0]] || 60000;
            setTimeout(() => this.invalidate(key), ttl);
        },

        get(key) {
            const timestamp = this.timestamps.get(key);
            if (!timestamp) return null;

            const age = Date.now() - timestamp;
            const ttl = this.ttl[key.split('_')[0]] || 60000;

            if (age > ttl) {
                this.invalidate(key);
                return null;
            }

            return this.cache.get(key);
        },

        invalidate(key) {
            this.cache.delete(key);
            this.timestamps.delete(key);
        },

        clear() {
            this.cache.clear();
            this.timestamps.clear();
        }
    };

    // Request Queue для об'єднання запитів
    const RequestQueue = {
        pending: new Map(),

        async enqueue(key, requestFn) {
            // Якщо запит вже виконується - повертаємо існуючий Promise
            if (this.pending.has(key)) {
                console.log(`📦 [RequestQueue] Повертаємо існуючий запит: ${key}`);
                return this.pending.get(key);
            }

            // Створюємо новий запит
            const promise = requestFn().finally(() => {
                this.pending.delete(key);
            });

            this.pending.set(key, promise);
            return promise;
        }
    };

    function TasksIntegration() {
        console.log('🏗️ [TASKS-INTEGRATION-V4] Створення екземпляру');
        this.userId = null;
        this.store = null;
        this.isInitialized = false;
        this.managers = {};
        this.updateTimers = new Map();
        this.lastUpdateTimes = new Map();
        this.storeUnsubscribe = null;

        // Оптимізовані оновлення UI
        this.pendingUIUpdates = new Set();
        this.uiUpdateFrame = null;

        console.log('✅ [TASKS-INTEGRATION-V4] Екземпляр створено');
    }

    /**
     * Ініціалізація системи завдань - ОПТИМІЗОВАНА
     */
    TasksIntegration.prototype.init = function() {
        var self = this;
        console.log('🚀 [TASKS-INTEGRATION-V4] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ =====');

        return new Promise(function(resolve, reject) {
            try {
                // Крок 1: Отримання ID користувача
                self.userId = self.getUserId();
                if (!self.userId) {
                    throw new Error('Не вдалося отримати ID користувача');
                }

                console.log('✅ [TASKS-INTEGRATION-V4] ID користувача:', self.userId);

                // Крок 2: Ініціалізація сховища
                self.initStore();

                // Крок 3: Швидка ініціалізація UI з кешованими даними
                self.initUIWithCache();

                // Крок 4: Асинхронне завантаження даних з smart-оновленням
                self.smartDataLoad().then(function() {
                    // Крок 5: Ініціалізація менеджерів
                    self.initializeManagers();

                    // Крок 6: Налаштування smart polling
                    self.setupSmartPolling();

                    // Крок 7: Оптимізовані обробники подій
                    self.setupOptimizedEventListeners();

                    self.isInitialized = true;
                    console.log('🎉 [TASKS-INTEGRATION-V4] ===== ІНІЦІАЛІЗАЦІЯ ЗАВЕРШЕНА =====');
                    resolve(self);
                }).catch(reject);

            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION-V4] Критична помилка:', error);
                reject(error);
            }
        });
    };

    /**
     * Швидка ініціалізація UI з кешованими даними
     */
    TasksIntegration.prototype.initUIWithCache = function() {
        console.log('🎨 [TASKS-INTEGRATION-V4] Швидка ініціалізація UI з кешу');

        // Встановлюємо ID
        this.setUserIdInHeader();

        // Завантажуємо кешовані дані зі sessionStorage
        var cachedData = window.TasksUtils.storage.get('lastUserData');
        if (cachedData && cachedData.userId === this.userId) {
            console.log('📦 [TASKS-INTEGRATION-V4] Використовуємо кешовані дані');
            this.updateBalanceDisplay(cachedData.balance || { balance: 0, coins: 0 });
        }

        // Показуємо початкову вкладку
        this.showTab('flex');
    };

    /**
     * Smart завантаження даних - тільки те що змінилось
     */
    TasksIntegration.prototype.smartDataLoad = async function() {
        console.log('🧠 [TASKS-INTEGRATION-V4] Smart завантаження даних');

        var self = this;

        // Перевіряємо кеш
        var cachedProfile = CacheManager.get(`profile_${this.userId}`);
        if (cachedProfile) {
            console.log('✅ [TASKS-INTEGRATION-V4] Використовуємо кешований профіль');
            self.processProfileData(cachedProfile);
        }

        // Завантажуємо тільки необхідні дані
        try {
            // Об'єднаний запит для профілю та балансу
            const profileData = await RequestQueue.enqueue(
                `profile_${this.userId}`,
                () => this.loadUserProfile()
            );

            // Обробляємо дані
            this.processProfileData(profileData);

            // Асинхронно завантажуємо решту даних
            this.loadSecondaryData();

        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION-V4] Помилка завантаження даних:', error);
            // Використовуємо fallback дані
            this.updateBalanceDisplay({ balance: 0, coins: 0 });
        }
    };

    /**
     * Завантаження профілю користувача - ОПТИМІЗОВАНО
     */
    TasksIntegration.prototype.loadUserProfile = async function() {
        console.log('👤 [TASKS-INTEGRATION-V4] Завантаження профілю');

        // Спочатку перевіряємо кеш
        var cached = CacheManager.get(`profile_${this.userId}`);
        if (cached) {
            return cached;
        }

        // Якщо кешу немає - робимо запит
        const response = await window.TasksAPI.user.getProfile(this.userId);

        if (response && response.status === 'success' && response.data) {
            // Кешуємо результат
            CacheManager.set(`profile_${this.userId}`, response);

            // Зберігаємо в sessionStorage для швидкого старту
            window.TasksUtils.storage.set('lastUserData', {
                userId: this.userId,
                balance: response.data,
                timestamp: Date.now()
            });

            return response;
        }

        throw new Error('Failed to load profile');
    };

    /**
     * Обробка даних профілю
     */
    TasksIntegration.prototype.processProfileData = function(response) {
        if (!response || !response.data) return;

        console.log('📊 [TASKS-INTEGRATION-V4] Обробка даних профілю');

        // Оновлюємо баланс через батчинг
        this.scheduleUIUpdate('balance', () => {
            this.updateBalanceDisplay(response.data);
        });

        // Оновлюємо Store
        if (window.TasksStore) {
            window.TasksStore.actions.updateBalance(response.data);

            const userData = {
                id: this.userId,
                telegramId: this.userId,
                username: response.data.username || 'User',
                balance: response.data
            };
            window.TasksStore.actions.setUser(userData);
        }
    };

    /**
     * Асинхронне завантаження вторинних даних
     */
    TasksIntegration.prototype.loadSecondaryData = function() {
        console.log('📋 [TASKS-INTEGRATION-V4] Завантаження вторинних даних');

        // Завантажуємо паралельно, але з низьким пріоритетом
        setTimeout(() => {
            // Статус гаманця
            this.checkWalletStatus();

            // Список завдань
            this.loadTasksList();
        }, 500);
    };

    /**
     * Перевірка статусу гаманця - з кешуванням
     */
    TasksIntegration.prototype.checkWalletStatus = async function() {
        const cacheKey = `wallet_${this.userId}`;

        try {
            const response = await RequestQueue.enqueue(cacheKey, async () => {
                // Перевіряємо кеш
                const cached = CacheManager.get(cacheKey);
                if (cached) return cached;

                // Робимо запит
                const result = await window.TasksAPI.wallet.checkStatus(this.userId);
                CacheManager.set(cacheKey, result);
                return result;
            });

            if (response.status === 'success' && response.data) {
                if (response.data.balance && response.data.balance.flex !== undefined) {
                    window.TasksStore?.actions.setFlexBalance(response.data.balance.flex);
                }
            }
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION-V4] Помилка перевірки гаманця:', error);
        }
    };

    /**
     * Завантаження списку завдань - з кешуванням
     */
    TasksIntegration.prototype.loadTasksList = async function() {
        const cacheKey = `tasks_${this.userId}`;

        try {
            const response = await RequestQueue.enqueue(cacheKey, async () => {
                // Перевіряємо кеш
                const cached = CacheManager.get(cacheKey);
                if (cached) return cached;

                // Робимо запит
                const result = await window.TasksAPI.tasks.getList(this.userId, 'all');
                CacheManager.set(cacheKey, result);
                return result;
            });

            console.log('📋 [TASKS-INTEGRATION-V4] Завдання завантажено');
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION-V4] Помилка завантаження завдань:', error);
        }
    };

    /**
     * Батчинг UI оновлень через requestAnimationFrame
     */
    TasksIntegration.prototype.scheduleUIUpdate = function(updateType, updateFn) {
        this.pendingUIUpdates.add({ type: updateType, fn: updateFn });

        if (!this.uiUpdateFrame) {
            this.uiUpdateFrame = requestAnimationFrame(() => {
                this.processPendingUIUpdates();
            });
        }
    };

    /**
     * Обробка всіх pending UI оновлень
     */
    TasksIntegration.prototype.processPendingUIUpdates = function() {
        console.log(`🎨 [TASKS-INTEGRATION-V4] Обробка ${this.pendingUIUpdates.size} UI оновлень`);

        // Групуємо оновлення по типу
        const updatesByType = new Map();

        this.pendingUIUpdates.forEach(update => {
            if (!updatesByType.has(update.type)) {
                updatesByType.set(update.type, []);
            }
            updatesByType.get(update.type).push(update.fn);
        });

        // Виконуємо оновлення
        updatesByType.forEach((updates, type) => {
            console.log(`  🔄 Оновлення ${type}: ${updates.length} операцій`);
            updates.forEach(fn => fn());
        });

        // Очищаємо
        this.pendingUIUpdates.clear();
        this.uiUpdateFrame = null;
    };

    /**
     * Оновлення відображення балансу - ОПТИМІЗОВАНА з debounce
     */
    TasksIntegration.prototype.updateBalanceDisplay = window.TasksUtils.debounce(function(data) {
        console.log('💰 [TASKS-INTEGRATION-V4] Оновлення балансу (debounced)');

        if (!data) return;

        var balance = parseInt(data.balance) || 0;
        var coins = parseInt(data.coins) || 0;

        var tokensElement = document.getElementById('user-tokens');
        if (tokensElement && tokensElement.textContent !== balance.toLocaleString()) {
            tokensElement.textContent = balance.toLocaleString();
        }

        var coinsElement = document.getElementById('user-coins');
        if (coinsElement && coinsElement.textContent !== coins.toLocaleString()) {
            coinsElement.textContent = coins.toLocaleString();
        }
    }, 300);

    /**
     * Smart Polling - оновлення тільки при необхідності
     */
    TasksIntegration.prototype.setupSmartPolling = function() {
        console.log('🔄 [TASKS-INTEGRATION-V4] Налаштування Smart Polling');

        var self = this;

        // Баланс - кожні 30 сек, але тільки якщо є активність
        this.setupPollingTimer('balance', 30000, async () => {
            // Перевіряємо чи був користувач активний
            if (this.isUserActive()) {
                await this.updateBalance();
            }
        });

        // Завдання - кожні 2 хв
        this.setupPollingTimer('tasks', 120000, () => {
            if (window.TasksStore?.selectors.getCurrentTab() === 'social' ||
                window.TasksStore?.selectors.getCurrentTab() === 'limited' ||
                window.TasksStore?.selectors.getCurrentTab() === 'partner') {
                this.loadTasksList();
            }
        });
    };

    /**
     * Налаштування таймера з перевіркою
     */
    TasksIntegration.prototype.setupPollingTimer = function(name, interval, callback) {
        // Очищаємо старий таймер
        if (this.updateTimers.has(name)) {
            clearInterval(this.updateTimers.get(name));
        }

        // Створюємо новий
        const timerId = setInterval(() => {
            const lastUpdate = this.lastUpdateTimes.get(name) || 0;
            const now = Date.now();

            // Перевіряємо чи минув мінімальний інтервал
            if (now - lastUpdate >= interval) {
                this.lastUpdateTimes.set(name, now);
                callback();
            }
        }, interval);

        this.updateTimers.set(name, timerId);
    };

    /**
     * Перевірка активності користувача
     */
    TasksIntegration.prototype.isUserActive = function() {
        // Перевіряємо останню активність
        const lastActivity = parseInt(sessionStorage.getItem('lastUserActivity') || '0');
        const now = Date.now();
        const inactiveTime = now - lastActivity;

        // Якщо користувач був неактивний більше 5 хв - не оновлюємо
        return inactiveTime < 5 * 60 * 1000;
    };

    /**
     * Оновлення балансу - ОПТИМІЗОВАНА
     */
    TasksIntegration.prototype.updateBalance = async function() {
        if (!this.userId) return;

        const cacheKey = `balance_${this.userId}`;

        try {
            const response = await RequestQueue.enqueue(cacheKey, async () => {
                // Швидка перевірка кешу (30 сек TTL)
                const cached = CacheManager.get(cacheKey);
                if (cached) return cached;

                const result = await window.TasksAPI.user.getBalance(this.userId);

                if (result && result.status === 'success') {
                    CacheManager.set(cacheKey, result, 30000); // 30 сек кеш
                }

                return result;
            });

            if (response && response.status === 'success' && response.data) {
                // Перевіряємо чи змінився баланс
                const currentBalance = window.TasksStore?.selectors.getUserBalance();
                const newBalance = response.data;

                if (currentBalance &&
                    currentBalance.winix === (newBalance.balance || 0) &&
                    currentBalance.tickets === (newBalance.coins || 0)) {
                    console.log('  ✅ Баланс не змінився, пропускаємо оновлення UI');
                    return;
                }

                // Оновлюємо через батчинг
                this.scheduleUIUpdate('balance', () => {
                    this.updateBalanceDisplay(response.data);
                });

                // Оновлюємо Store
                window.TasksStore?.actions.updateBalance(response.data);
            }
        } catch (error) {
            console.error('❌ [TASKS-INTEGRATION-V4] Помилка оновлення балансу:', error);
        }
    };

    /**
     * Ініціалізація менеджерів - ОПТИМІЗОВАНА
     */
    TasksIntegration.prototype.initializeManagers = function() {
        console.log('🔧 [TASKS-INTEGRATION-V4] Ініціалізація менеджерів');

        var self = this;

        // Ініціалізуємо менеджери послідовно для уникнення конфліктів
        const initManager = async (name, managerClass) => {
            if (window[managerClass]) {
                try {
                    console.log(`  🔧 Ініціалізація ${name}...`);
                    this.managers[name] = window[managerClass];

                    // Асинхронна ініціалізація
                    const initResult = this.managers[name].init(this.userId);

                    if (initResult && initResult.then) {
                        await initResult;
                    }

                    console.log(`  ✅ ${name} ініціалізовано`);
                } catch (error) {
                    console.error(`  ❌ Помилка ініціалізації ${name}:`, error);
                }
            }
        };

        // Послідовна ініціалізація для уникнення race conditions
        (async () => {
            await initManager('flexEarn', 'FlexEarnManager');
            await initManager('dailyBonus', 'DailyBonusManager');
            await initManager('tasks', 'TasksManager');
            await initManager('wallet', 'WalletChecker');
        })();
    };

    /**
     * Оптимізовані обробники подій
     */
    TasksIntegration.prototype.setupOptimizedEventListeners = function() {
        console.log('🎯 [TASKS-INTEGRATION-V4] Налаштування оптимізованих обробників');

        var self = this;

        // Відстеження активності користувача
        const activityEvents = ['click', 'keypress', 'mousemove', 'touchstart'];
        const updateActivity = window.TasksUtils.throttle(() => {
            sessionStorage.setItem('lastUserActivity', Date.now().toString());
        }, 1000);

        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Делегування подій для вкладок
        const tabContainer = document.querySelector('.main-tabs');
        if (tabContainer) {
            tabContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.tab-button');
                if (tab) {
                    const tabName = tab.getAttribute('data-tab');
                    self.showTab(tabName);
                }
            });
        }

        // Оптимізована підписка на Store з debounce
        if (window.TasksStore) {
            const handleStoreChange = window.TasksUtils.debounce((state, prevState, action) => {
                // Обробляємо тільки важливі зміни
                if (action.type === 'UPDATE_BALANCE' &&
                    state.user.balance !== prevState.user.balance) {
                    self.scheduleUIUpdate('balance', () => {
                        self.updateBalanceDisplay(state.user.balance);
                    });
                }
            }, 100);

            this.storeUnsubscribe = window.TasksStore.subscribe(handleStoreChange);
        }

        // Оптимізація видимості сторінки
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Зупиняємо оновлення при прихованій вкладці
                this.pausePolling();
            } else {
                // Відновлюємо при поверненні
                this.resumePolling();
            }
        });
    };

    /**
     * Призупинення polling
     */
    TasksIntegration.prototype.pausePolling = function() {
        console.log('⏸️ [TASKS-INTEGRATION-V4] Призупинення polling');

        this.updateTimers.forEach((timerId, name) => {
            clearInterval(timerId);
        });
    };

    /**
     * Відновлення polling
     */
    TasksIntegration.prototype.resumePolling = function() {
        console.log('▶️ [TASKS-INTEGRATION-V4] Відновлення polling');

        // Перевіряємо що пройшло з останнього оновлення
        const now = Date.now();

        this.lastUpdateTimes.forEach((lastTime, name) => {
            const elapsed = now - lastTime;

            // Якщо пройшло достатньо часу - оновлюємо одразу
            if (elapsed > 60000) { // 1 хв
                if (name === 'balance') this.updateBalance();
                else if (name === 'tasks') this.loadTasksList();
            }
        });

        // Перезапускаємо таймери
        this.setupSmartPolling();
    };

    /**
     * Показати вкладку - ОПТИМІЗОВАНА
     */
    TasksIntegration.prototype.showTab = function(tabName) {
        console.log('📑 [TASKS-INTEGRATION-V4] Показ вкладки:', tabName);

        // Використовуємо батчинг для UI оновлень
        this.scheduleUIUpdate('tab', () => {
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

        // Викликаємо менеджер тільки якщо потрібно
        requestIdleCallback(() => {
            this.onTabChange(tabName);
        });
    };

    /**
     * Обробка зміни вкладки - ОПТИМІЗОВАНА
     */
    TasksIntegration.prototype.onTabChange = function(tabName) {
        console.log('🔄 [TASKS-INTEGRATION-V4] Зміна вкладки:', tabName);

        // Оновлюємо тільки якщо менеджер готовий
        switch(tabName) {
            case 'flex':
                if (this.managers.flexEarn?.checkWalletConnection) {
                    // Перевіряємо кеш перед викликом
                    const cached = CacheManager.get(`wallet_${this.userId}`);
                    if (!cached) {
                        this.managers.flexEarn.checkWalletConnection();
                    }
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
                if (this.managers.tasks?.updateTasksUI) {
                    // Затримка для плавної анімації
                    setTimeout(() => {
                        this.managers.tasks.updateTasksUI();
                    }, 100);
                }
                break;
        }
    };

    // Решта методів залишається без змін, але з minor оптимізаціями...

    /**
     * Отримує ID користувача з різних джерел
     */
    TasksIntegration.prototype.getUserId = function() {
        console.log('🔍 [TASKS-INTEGRATION-V4] Отримання userId');

        // Кешуємо результат
        if (this.userId) return this.userId;

        var sources = [
            function() { return window.Telegram?.WebApp?.initDataUnsafe?.user?.id; },
            function() { return window.WinixAPI?.getUserId?.(); },
            function() { return localStorage.getItem('telegram_user_id'); },
            function() { return localStorage.getItem('user_id'); },
            function() { return window.TasksAPI?.getUserId?.(); }
        ];

        for (var i = 0; i < sources.length; i++) {
            try {
                var id = sources[i]();
                if (id && id !== 'undefined' && id !== 'null') {
                    var numericId = parseInt(id);
                    if (!isNaN(numericId) && numericId > 0) {
                        this.userId = numericId; // Кешуємо
                        return numericId;
                    }
                }
            } catch (e) {
                console.warn(`⚠️ [TASKS-INTEGRATION-V4] Помилка в джерелі ${i + 1}:`, e);
            }
        }

        return null;
    };

    /**
     * Ініціалізує Redux сховище
     */
    TasksIntegration.prototype.initStore = function() {
        console.log('🔧 [TASKS-INTEGRATION-V4] Ініціалізація Store');

        if (window.TasksStore) {
            this.store = window.TasksStore;
        } else {
            console.warn('⚠️ [TASKS-INTEGRATION-V4] TasksStore недоступний');
        }
    };

    /**
     * Встановлює ID користувача в заголовку
     */
    TasksIntegration.prototype.setUserIdInHeader = function() {
        var userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
        var value = this.userId || 'Не визначено';

        userIdElements.forEach(function(element) {
            if (element && element.textContent !== value) {
                element.textContent = value;
            }
        });
    };

    /**
     * Показує повідомлення про успіх
     */
    TasksIntegration.prototype.showSuccessMessage = function(message) {
        window.TasksUtils?.showToast?.(message, 'success') || console.log('✅', message);
    };

    /**
     * Показує повідомлення про помилку
     */
    TasksIntegration.prototype.showErrorMessage = function(message) {
        window.TasksUtils?.showToast?.(message, 'error') || console.error('❌', message);
    };

    /**
     * Очищення ресурсів
     */
    TasksIntegration.prototype.destroy = function() {
        console.log('🗑️ [TASKS-INTEGRATION-V4] Знищення модуля');

        // Зупиняємо всі таймери
        this.updateTimers.forEach(timerId => clearInterval(timerId));
        this.updateTimers.clear();

        // Відписуємось від Store
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }

        // Скасовуємо pending UI оновлення
        if (this.uiUpdateFrame) {
            cancelAnimationFrame(this.uiUpdateFrame);
        }

        // Очищаємо кеш
        CacheManager.clear();

        console.log('✅ [TASKS-INTEGRATION-V4] Модуль знищено');
    };

    console.log('✅ [TASKS-INTEGRATION-V4] Модуль TasksIntegration завантажено');
    return TasksIntegration;
})();

// Глобальна функція ініціалізації
window.initTasksSystem = function() {
    console.log('🎬 [GLOBAL] === initTasksSystem START (V4) ===');

    return new Promise(function(resolve, reject) {
        try {
            var integration = new window.TasksIntegration();

            integration.init()
                .then(function() {
                    window.TasksIntegrationInstance = integration;
                    console.log('🏁 [GLOBAL] === initTasksSystem SUCCESS (V4) ===');
                    resolve(integration);
                })
                .catch(reject);
        } catch (error) {
            console.error('💥 [GLOBAL] Критична помилка:', error);
            reject(error);
        }
    });
};

console.log('✅ [GLOBAL] window.initTasksSystem функція зареєстрована (V4)');