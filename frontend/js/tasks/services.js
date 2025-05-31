/**
 * Сервісні функції для системи завдань WINIX - Оптимізована версія V2
 * Intelligent sync, diff-based оновлення та централізоване кешування
 */

window.TasksServices = (function() {
    'use strict';

    console.log('🛠️ [TasksServices-V2] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО СЕРВІСНОГО МОДУЛЯ =====');

    // Централізований кеш для всіх сервісів
    const ServiceCache = {
        data: new Map(),
        checksums: new Map(),
        lastSync: new Map(),

        ttl: {
            apiHealth: 30000,        // 30 секунд
            userSession: 5 * 60000,  // 5 хвилин
            balance: 30000,          // 30 секунд
            tasks: 2 * 60000,        // 2 хвилини
            dailyStatus: 60000,      // 1 хвилина
            flexStatus: 60000        // 1 хвилина
        },

        set(key, data, customTTL) {
            const checksum = this.calculateChecksum(data);
            this.data.set(key, data);
            this.checksums.set(key, checksum);
            this.lastSync.set(key, Date.now());

            const ttl = customTTL || this.ttl[key.split('_')[0]] || 60000;
            setTimeout(() => this.invalidate(key), ttl);

            return checksum;
        },

        get(key) {
            const timestamp = this.lastSync.get(key);
            if (!timestamp) return null;

            const age = Date.now() - timestamp;
            const ttl = this.ttl[key.split('_')[0]] || 60000;

            if (age > ttl) {
                this.invalidate(key);
                return null;
            }

            return this.data.get(key);
        },

        hasChanged(key, newData) {
            const oldChecksum = this.checksums.get(key);
            if (!oldChecksum) return true;

            const newChecksum = this.calculateChecksum(newData);
            return oldChecksum !== newChecksum;
        },

        calculateChecksum(data) {
            // Простий checksum для порівняння
            return JSON.stringify(data).split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
        },

        getDiff(key, newData) {
            const oldData = this.data.get(key);
            if (!oldData) return { type: 'full', data: newData };

            return this.computeDiff(oldData, newData);
        },

        computeDiff(oldObj, newObj) {
            const diff = {
                added: {},
                modified: {},
                removed: {}
            };

            // Check for added/modified
            for (const key in newObj) {
                if (!(key in oldObj)) {
                    diff.added[key] = newObj[key];
                } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
                    diff.modified[key] = newObj[key];
                }
            }

            // Check for removed
            for (const key in oldObj) {
                if (!(key in newObj)) {
                    diff.removed[key] = true;
                }
            }

            const hasChanges = Object.keys(diff.added).length > 0 ||
                               Object.keys(diff.modified).length > 0 ||
                               Object.keys(diff.removed).length > 0;

            return hasChanges ? { type: 'diff', diff } : { type: 'none' };
        },

        invalidate(key) {
            this.data.delete(key);
            this.checksums.delete(key);
            this.lastSync.delete(key);
        },

        clear() {
            this.data.clear();
            this.checksums.clear();
            this.lastSync.clear();
        }
    };

    // Intelligent Sync Queue
    const SyncQueue = {
        queue: [],
        processing: false,
        priorities: {
            critical: 10,
            high: 7,
            normal: 5,
            low: 3
        },

        enqueue(task, priority = 'normal') {
            this.queue.push({
                task,
                priority: this.priorities[priority] || this.priorities.normal,
                timestamp: Date.now()
            });

            // Сортуємо по пріоритету
            this.queue.sort((a, b) => b.priority - a.priority);

            if (!this.processing) {
                this.process();
            }
        },

        async process() {
            if (this.queue.length === 0) {
                this.processing = false;
                return;
            }

            this.processing = true;
            const item = this.queue.shift();

            try {
                await item.task();
            } catch (error) {
                console.error('❌ [SyncQueue] Помилка виконання завдання:', error);
            }

            // Обробляємо наступне завдання
            setTimeout(() => this.process(), 100);
        }
    };

    // Стан сервісів
    const servicesState = {
        initialized: false,
        dependencies: {
            telegramValidator: false,
            tasksAPI: false,
            tasksStore: false,
            tasksConstants: false
        },
        apiAvailable: false,
        lastHealthCheck: 0,
        syncInProgress: false,
        lastFullSync: 0,
        userActivity: {
            lastAction: Date.now(),
            isActive: true
        }
    };

    /**
     * Перевірка готовності залежностей - ОПТИМІЗОВАНА
     */
    const checkDependencies = (() => {
        let lastCheck = 0;
        let lastResult = false;

        return function() {
            const now = Date.now();

            // Кешуємо результат на 5 секунд
            if (now - lastCheck < 5000 && lastResult) {
                return lastResult;
            }

            console.log('🔍 [TasksServices-V2] Перевірка залежностей...');

            servicesState.dependencies.telegramValidator = !!(window.TelegramValidator?.validateTelegramAuth);
            servicesState.dependencies.tasksAPI = !!(window.TasksAPI?.auth);
            servicesState.dependencies.tasksStore = !!(window.TasksStore?.actions);
            servicesState.dependencies.tasksConstants = !!(window.TasksConstants?.API_ENDPOINTS);

            lastResult = Object.values(servicesState.dependencies).every(ready => ready);
            lastCheck = now;

            console.log(`${lastResult ? '✅' : '❌'} [TasksServices-V2] Залежності готові:`, lastResult);

            return lastResult;
        };
    })();

    /**
     * Перевірка здоров'я API - ОПТИМІЗОВАНА з кешуванням
     */
    async function checkApiHealth(force = false) {
        const cacheKey = 'apiHealth';

        if (!force) {
            const cached = ServiceCache.get(cacheKey);
            if (cached !== null) {
                console.log('✅ [TasksServices-V2] API здоровий (кеш)');
                return cached;
            }
        }

        console.log('🏥 [TasksServices-V2] Перевірка здоров\'я API...');

        try {
            const response = await fetch('/api/ping', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            const isHealthy = response.ok;
            servicesState.apiAvailable = isHealthy;

            // Кешуємо результат
            ServiceCache.set(cacheKey, isHealthy);

            console.log(`${isHealthy ? '✅' : '❌'} [TasksServices-V2] API статус:`, response.status);
            return isHealthy;

        } catch (error) {
            console.error('❌ [TasksServices-V2] API недоступний:', error.message);
            servicesState.apiAvailable = false;
            ServiceCache.set(cacheKey, false);
            return false;
        }
    }

    /**
     * Сервіс авторизації - ОПТИМІЗОВАНИЙ
     */
    const AuthService = {
        isInitializing: false,
        retryCount: 0,
        maxRetries: 3,
        authPromise: null,

        /**
         * Ініціалізація користувача з кешуванням
         */
        async initUser() {
            console.log('👤 [AuthService-V2] === ІНІЦІАЛІЗАЦІЯ КОРИСТУВАЧА ===');

            // Уникаємо множинних викликів
            if (this.authPromise) {
                console.log('⏸️ [AuthService-V2] Повертаємо існуючий Promise');
                return this.authPromise;
            }

            this.authPromise = this._initUserInternal();

            try {
                const result = await this.authPromise;
                return result;
            } finally {
                this.authPromise = null;
            }
        },

        async _initUserInternal() {
            // Перевіряємо кеш сесії
            const cachedSession = ServiceCache.get('userSession');
            if (cachedSession) {
                console.log('✅ [AuthService-V2] Використовуємо кешовану сесію');
                this.updateUserUI(cachedSession);
                return cachedSession;
            }

            try {
                // Перевіряємо залежності
                if (!checkDependencies()) {
                    throw new Error('Система ініціалізується. Зачекайте...');
                }

                // Перевіряємо API
                const apiHealthy = await checkApiHealth();
                if (!apiHealthy) {
                    this.retryCount++;
                    if (this.retryCount >= this.maxRetries) {
                        throw new Error('Сервер тимчасово недоступний');
                    }
                    throw new Error(`Сервер недоступний. Спроба ${this.retryCount}/${this.maxRetries}`);
                }

                // Валідація Telegram
                console.log('🔄 [AuthService-V2] Валідація Telegram...');
                const validation = await window.TelegramValidator.validateTelegramAuth();

                if (!validation.valid) {
                    throw new Error('Telegram authentication failed: ' + validation.error);
                }

                const telegramUser = validation.user;

                // Завантажуємо профіль
                console.log('🔄 [AuthService-V2] Завантаження профілю...');
                const profile = await window.TasksAPI.user.getProfile(
                    telegramUser.telegram_id || telegramUser.id
                );

                if (!profile?.data) {
                    throw new Error('Не вдалося завантажити профіль користувача');
                }

                // Оновлюємо Store
                window.TasksStore.actions.setUser({
                    id: profile.data.id,
                    telegramId: telegramUser.telegram_id || telegramUser.id,
                    username: profile.data.username || telegramUser.username,
                    firstName: profile.data.first_name || telegramUser.first_name,
                    lastName: profile.data.last_name || telegramUser.last_name,
                    balance: profile.data.balance || { winix: 0, tickets: 0, flex: 0 }
                });

                // Кешуємо сесію
                ServiceCache.set('userSession', profile.data);

                // Оновлюємо UI
                this.updateUserUI(profile.data);

                // Скидаємо лічильник помилок
                this.retryCount = 0;

                console.log('✅ [AuthService-V2] Ініціалізація завершена');
                return profile.data;

            } catch (error) {
                console.error('❌ [AuthService-V2] Помилка ініціалізації:', error);

                // Показуємо помилку
                if (window.TasksUtils?.showToast) {
                    const errorMessage = error.message.includes('ініціалізується') ? 'info' : 'error';
                    window.TasksUtils.showToast(error.message, errorMessage);
                }

                throw error;
            }
        },

        /**
         * Оновити UI користувача
         */
        updateUserUI(user) {
            console.log('🔄 [AuthService-V2] Оновлення UI користувача');

            requestAnimationFrame(() => {
                // ID користувача
                const userIdElement = document.getElementById('header-user-id');
                if (userIdElement) {
                    userIdElement.textContent = user.telegram_id || user.id || '';
                }

                // Аватар
                const avatarElement = document.querySelector('.profile-avatar');
                if (avatarElement && user.username) {
                    avatarElement.textContent = user.username.charAt(0).toUpperCase();
                }

                // Баланси
                const winixElement = document.getElementById('user-winix');
                const ticketsElement = document.getElementById('user-tickets');

                if (winixElement) {
                    winixElement.textContent = user.balance?.winix || 0;
                }

                if (ticketsElement) {
                    ticketsElement.textContent = user.balance?.tickets || 0;
                }
            });
        },

        /**
         * Перевірити сесію - ОПТИМІЗОВАНА
         */
        async checkSession() {
            console.log('🔐 [AuthService-V2] Перевірка сесії');

            // Кешована перевірка
            const cachedSession = ServiceCache.get('userSession');
            if (cachedSession) {
                return true;
            }

            try {
                if (!window.TelegramValidator) {
                    return false;
                }

                const isAuth = window.TelegramValidator.isAuthenticated();

                if (!isAuth) {
                    console.warn('⚠️ [AuthService-V2] Користувач не авторизований');

                    if (window.TasksUtils?.showToast) {
                        window.TasksUtils.showToast('Сесія закінчилася. Оновіть сторінку', 'error');
                    }

                    setTimeout(() => window.location.reload(), 3000);
                    return false;
                }

                // Перевіряємо термін дії токену
                const token = window.TelegramValidator.getAuthToken();
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const exp = payload.exp * 1000;
                        const now = Date.now();

                        if (exp - now < 5 * 60 * 1000) { // Менше 5 хвилин
                            console.log('🔄 [AuthService-V2] Оновлення токену');
                            await window.TelegramValidator.refreshToken();
                        }
                    } catch (error) {
                        console.error('❌ [AuthService-V2] Помилка перевірки токену:', error);
                        window.TelegramValidator.clearAuthToken();
                        return false;
                    }
                }

                return true;

            } catch (error) {
                console.error('❌ [AuthService-V2] Помилка перевірки сесії:', error);
                return false;
            }
        }
    };

    /**
     * Сервіс синхронізації - INTELLIGENT SYNC
     */
    const SyncService = {
        syncInterval: null,
        lastSyncTime: 0,
        isSyncing: false,
        syncHistory: new Map(),

        /**
         * Запустити автоматичну синхронізацію
         */
        startAutoSync() {
            console.log('🔄 [SyncService-V2] === ЗАПУСК INTELLIGENT SYNC ===');

            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }

            // Адаптивний інтервал синхронізації
            const getAdaptiveInterval = () => {
                const isActive = servicesState.userActivity.isActive;
                const timeSinceLastAction = Date.now() - servicesState.userActivity.lastAction;

                // Якщо користувач неактивний більше 5 хв - рідша синхронізація
                if (!isActive || timeSinceLastAction > 5 * 60000) {
                    return 10 * 60000; // 10 хвилин
                }

                // Активний користувач - частіша синхронізація
                return 2 * 60000; // 2 хвилини
            };

            const syncLoop = () => {
                if (servicesState.apiAvailable) {
                    this.intelligentSync();
                }

                // Адаптуємо інтервал
                const nextInterval = getAdaptiveInterval();
                this.syncInterval = setTimeout(syncLoop, nextInterval);
            };

            // Запускаємо цикл
            syncLoop();

            console.log('✅ [SyncService-V2] Intelligent sync запущено');
        },

        /**
         * Intelligent синхронізація - тільки змінені дані
         */
        async intelligentSync() {
            console.log('🧠 [SyncService-V2] === INTELLIGENT SYNC ===');

            if (this.isSyncing) {
                console.log('⏸️ [SyncService-V2] Синхронізація вже виконується');
                return;
            }

            this.isSyncing = true;

            try {
                // Перевіряємо сесію
                const sessionValid = await AuthService.checkSession();
                if (!sessionValid) {
                    return;
                }

                const userId = window.TasksStore?.selectors?.getUserId();
                if (!userId) {
                    throw new Error('User ID відсутній');
                }

                // Визначаємо що потрібно синхронізувати
                const syncTasks = this.determineSyncTasks();

                console.log(`🎯 [SyncService-V2] Заплановано ${syncTasks.length} завдань синхронізації`);

                // Додаємо завдання в чергу з пріоритетами
                syncTasks.forEach(({ task, priority }) => {
                    SyncQueue.enqueue(task, priority);
                });

                this.lastSyncTime = Date.now();

            } catch (error) {
                console.error('❌ [SyncService-V2] Помилка синхронізації:', error);

                if (error.message.includes('User ID') || error.message.includes('авторизації')) {
                    if (window.TasksUtils?.showToast) {
                        window.TasksUtils.showToast('Помилка авторизації. Оновлюємо сторінку...', 'error');
                    }
                    setTimeout(() => window.location.reload(), 2000);
                }
            } finally {
                this.isSyncing = false;
            }
        },

        /**
         * Визначити завдання для синхронізації
         */
        determineSyncTasks() {
            const tasks = [];
            const now = Date.now();
            const userId = window.TasksStore?.selectors?.getUserId();

            // Баланс - висока пріоритет якщо активний
            if (servicesState.userActivity.isActive) {
                const lastBalanceSync = this.syncHistory.get('balance') || 0;
                if (now - lastBalanceSync > 30000) { // 30 сек
                    tasks.push({
                        task: () => this.syncBalance(userId),
                        priority: 'high'
                    });
                }
            }

            // Flex статус - якщо гаманець підключений
            if (window.TasksStore?.selectors?.isWalletConnected()) {
                const lastFlexSync = this.syncHistory.get('flex') || 0;
                if (now - lastFlexSync > 60000) { // 1 хв
                    tasks.push({
                        task: () => this.syncFlexStatus(userId),
                        priority: 'normal'
                    });
                }
            }

            // Daily bonus - раз на хвилину
            const lastDailySync = this.syncHistory.get('daily') || 0;
            if (now - lastDailySync > 60000) { // 1 хв
                tasks.push({
                    task: () => this.syncDailyBonus(userId),
                    priority: 'normal'
                });
            }

            // Завдання - якщо відкрита відповідна вкладка
            const currentTab = window.TasksStore?.selectors?.getCurrentTab();
            if (['social', 'limited', 'partner'].includes(currentTab)) {
                const lastTasksSync = this.syncHistory.get('tasks') || 0;
                if (now - lastTasksSync > 120000) { // 2 хв
                    tasks.push({
                        task: () => this.syncTasks(userId),
                        priority: 'low'
                    });
                }
            }

            return tasks;
        },

        /**
         * Синхронізація балансу - DIFF BASED
         */
        async syncBalance(userId) {
            console.log('💰 [SyncService-V2] Синхронізація балансу (diff-based)');

            const cacheKey = `balance_${userId}`;

            try {
                const response = await window.TasksAPI.user.getBalance(userId);

                if (response.status === 'success') {
                    const newBalance = response.balance || response.data;

                    // Перевіряємо чи змінилися дані
                    if (!ServiceCache.hasChanged(cacheKey, newBalance)) {
                        console.log('✅ [SyncService-V2] Баланс не змінився, пропускаємо оновлення');
                        return;
                    }

                    // Отримуємо diff
                    const diff = ServiceCache.getDiff(cacheKey, newBalance);
                    console.log('📊 [SyncService-V2] Diff балансу:', diff);

                    // Оновлюємо кеш
                    ServiceCache.set(cacheKey, newBalance);

                    // Оновлюємо Store
                    window.TasksStore.actions.updateBalance(newBalance);

                    // Оновлюємо UI тільки якщо є зміни
                    if (diff.type !== 'none') {
                        AuthService.updateUserUI({ balance: newBalance });
                    }

                    this.syncHistory.set('balance', Date.now());
                    return response;
                }

            } catch (error) {
                console.error('❌ [SyncService-V2] Помилка синхронізації балансу:', error);
                throw error;
            }
        },

        /**
         * Синхронізація Flex статусу
         */
        async syncFlexStatus(userId) {
            console.log('💎 [SyncService-V2] Синхронізація Flex статусу');

            const wallet = window.TasksStore?.selectors?.getWalletAddress();
            if (!wallet) {
                console.log('⏸️ [SyncService-V2] Гаманець не підключено');
                return { skipped: true };
            }

            if (window.FlexEarnManager) {
                await window.FlexEarnManager.checkFlexBalance();
                this.syncHistory.set('flex', Date.now());
                return { synced: true };
            }

            return { skipped: true };
        },

        /**
         * Синхронізація щоденного бонусу
         */
        async syncDailyBonus(userId) {
            console.log('🎁 [SyncService-V2] Синхронізація щоденного бонусу');

            const cacheKey = `daily_${userId}`;

            try {
                const response = await window.TasksAPI.daily.getStatus(userId);

                if (response.status === 'success') {
                    // Перевіряємо зміни
                    if (!ServiceCache.hasChanged(cacheKey, response.data)) {
                        console.log('✅ [SyncService-V2] Daily bonus не змінився');
                        return;
                    }

                    // Оновлюємо кеш
                    ServiceCache.set(cacheKey, response.data);

                    // Оновлюємо UI
                    if (window.DailyBonusManager?.updateDailyBonusUI) {
                        window.DailyBonusManager.updateDailyBonusUI();
                    }

                    this.syncHistory.set('daily', Date.now());
                    return response;
                }

            } catch (error) {
                console.error('❌ [SyncService-V2] Помилка синхронізації daily bonus:', error);
                throw error;
            }
        },

        /**
         * Синхронізація завдань
         */
        async syncTasks(userId) {
            console.log('📋 [SyncService-V2] Синхронізація завдань');

            const cacheKey = `tasks_${userId}`;

            try {
                const response = await window.TasksAPI.tasks.getList(userId);

                if (response.status === 'success' && response.data.tasks) {
                    // Перевіряємо зміни
                    const diff = ServiceCache.getDiff(cacheKey, response.data.tasks);

                    if (diff.type === 'none') {
                        console.log('✅ [SyncService-V2] Завдання не змінились');
                        return;
                    }

                    console.log('📊 [SyncService-V2] Diff завдань:', diff);

                    // Оновлюємо кеш
                    ServiceCache.set(cacheKey, response.data.tasks);

                    // Оновлюємо тільки змінені завдання
                    if (diff.type === 'diff') {
                        // Додані завдання
                        Object.entries(diff.diff.added).forEach(([type, tasks]) => {
                            const currentTasks = window.TasksStore.getState().tasks[type] || {};
                            window.TasksStore.actions.setTasks(type, { ...currentTasks, ...tasks });
                        });

                        // Змінені завдання
                        Object.entries(diff.diff.modified).forEach(([type, tasks]) => {
                            const currentTasks = window.TasksStore.getState().tasks[type] || {};
                            window.TasksStore.actions.setTasks(type, { ...currentTasks, ...tasks });
                        });

                        // Видалені завдання
                        Object.entries(diff.diff.removed).forEach(([type, taskIds]) => {
                            const currentTasks = { ...window.TasksStore.getState().tasks[type] };
                            taskIds.forEach(id => delete currentTasks[id]);
                            window.TasksStore.actions.setTasks(type, currentTasks);
                        });
                    } else {
                        // Повне оновлення
                        Object.entries(response.data.tasks).forEach(([type, tasks]) => {
                            window.TasksStore.actions.setTasks(type, tasks);
                        });
                    }

                    this.syncHistory.set('tasks', Date.now());
                    return response;
                }

            } catch (error) {
                console.error('❌ [SyncService-V2] Помилка синхронізації завдань:', error);
                throw error;
            }
        }
    };

    /**
     * Сервіс нотифікацій - без змін
     */
    const NotificationService = {
        showSuccess(message, duration = 3000) {
            console.log('✅ [NotificationService] Успіх:', message);
            window.TasksUtils?.showToast?.(message, 'success', duration);
            this.vibrate([50]);
        },

        showError(message, duration = 5000) {
            console.log('❌ [NotificationService] Помилка:', message);
            window.TasksUtils?.showToast?.(message, 'error', duration);
            this.vibrate([100, 50, 100]);
        },

        showWarning(message, duration = 4000) {
            console.log('⚠️ [NotificationService] Попередження:', message);
            window.TasksUtils?.showToast?.(message, 'warning', duration);
            this.vibrate([75]);
        },

        showInfo(message, duration = 3000) {
            console.log('ℹ️ [NotificationService] Інформація:', message);
            window.TasksUtils?.showToast?.(message, 'info', duration);
        },

        showReward(reward) {
            console.log('🎁 [NotificationService] Винагорода:', reward);

            let message = 'Отримано: ';
            const parts = [];

            if (reward.winix > 0) parts.push(`+${reward.winix} WINIX`);
            if (reward.tickets > 0) parts.push(`+${reward.tickets} tickets`);
            if (reward.flex > 0) parts.push(`+${reward.flex} FLEX`);

            message += parts.join(' та ');

            this.showSuccess(message, 4000);
            this.vibrate([50, 100, 50, 100, 50]);
        },

        vibrate(pattern) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                try {
                    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                } catch (e) {
                    if ('vibrate' in navigator) {
                        navigator.vibrate(pattern);
                    }
                }
            } else if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        }
    };

    /**
     * Сервіс аналітики - ОПТИМІЗОВАНИЙ
     */
    const AnalyticsService = {
        sessionId: null,
        eventQueue: [],
        flushInterval: null,

        init() {
            this.sessionId = this.generateSessionId();
            console.log('📊 [AnalyticsService] Сесія:', this.sessionId);

            // Батчинг подій
            this.flushInterval = setInterval(() => {
                this.flushEvents();
            }, 5000);
        },

        generateSessionId() {
            return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },

        trackEvent(category, action, label, value) {
            const event = {
                category,
                action,
                label,
                value,
                sessionId: this.sessionId,
                timestamp: Date.now()
            };

            console.log('📊 [AnalyticsService] Подія:', event);

            // Додаємо в чергу
            this.eventQueue.push(event);

            // Якщо черга велика - відправляємо одразу
            if (this.eventQueue.length >= 10) {
                this.flushEvents();
            }
        },

        async flushEvents() {
            if (this.eventQueue.length === 0) return;

            const events = [...this.eventQueue];
            this.eventQueue = [];

            try {
                // Telegram WebApp
                if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.sendData(JSON.stringify({
                        type: 'analytics_batch',
                        events
                    }));
                }

                // Backend
                if (servicesState.apiAvailable && window.TasksAPI) {
                    await window.TasksAPI.call('/analytics/batch', {
                        method: 'POST',
                        body: { events }
                    });
                }
            } catch (error) {
                console.error('❌ [AnalyticsService] Помилка відправки:', error);
                // Повертаємо події в чергу
                this.eventQueue.unshift(...events);
            }
        },

        trackPageView(pageName) {
            this.trackEvent('Navigation', 'page_view', pageName);
        },

        trackError(error, context) {
            const errorData = {
                name: error.name || 'UnknownError',
                message: error.message || 'Unknown error',
                stack: error.stack ? error.stack.substring(0, 500) : null,
                context
            };

            this.trackEvent('Error', errorData.name, context, 1);
        },

        trackTiming(category, variable, time) {
            this.trackEvent('Timing', category, variable, time);
        },

        destroy() {
            if (this.flushInterval) {
                clearInterval(this.flushInterval);
                this.flushEvents(); // Відправляємо залишки
            }
        }
    };

    /**
     * Сервіс валідації - без змін, вже оптимальний
     */
    const ValidationService = {
        validateTask(task) {
            console.log('🔍 [ValidationService] Валідація завдання:', task);

            const errors = [];

            if (!task.id) errors.push('ID завдання відсутній');
            if (!task.type) errors.push('Тип завдання відсутній');
            if (!task.title) errors.push('Назва завдання відсутня');
            if (!task.reward) errors.push('Винагорода відсутня');

            if (task.reward) {
                if (typeof task.reward.winix !== 'number' || task.reward.winix < 0) {
                    errors.push('Невірна винагорода WINIX');
                }
                if (task.reward.tickets && (typeof task.reward.tickets !== 'number' || task.reward.tickets < 0)) {
                    errors.push('Невірна винагорода tickets');
                }
            }

            if (errors.length > 0) {
                console.error('❌ [ValidationService] Помилки валідації:', errors);
                return { valid: false, errors };
            }

            console.log('✅ [ValidationService] Завдання валідне');
            return { valid: true };
        },

        validateWalletAddress(address) {
            console.log('🔍 [ValidationService] Валідація адреси:', address);

            const rules = window.TasksConstants?.VALIDATION_RULES?.WALLET_ADDRESS;

            if (rules && rules.isValid) {
                const isValid = rules.isValid(address);

                if (!isValid) {
                    console.error('❌ [ValidationService] Невірний формат адреси');
                    return { valid: false, error: 'Невірний формат адреси TON' };
                }
            } else {
                // Fallback валідація
                const isValid = /^(EQ|UQ)[a-zA-Z0-9_-]{46}$/.test(address) ||
                               /^-?[0-9]:[0-9a-fA-F]{64}$/.test(address);

                if (!isValid) {
                    console.error('❌ [ValidationService] Невірний формат адреси');
                    return { valid: false, error: 'Невірний формат адреси TON' };
                }
            }

            console.log('✅ [ValidationService] Адреса валідна');
            return { valid: true };
        },

        validateTelegramId(telegramId) {
            const rules = window.TasksConstants?.VALIDATION_RULES?.TELEGRAM_ID;
            const id = parseInt(telegramId);

            if (!id || isNaN(id)) {
                return { valid: false, error: 'Невірний формат ID' };
            }

            if (rules) {
                if (id < rules.MIN || id > rules.MAX) {
                    return { valid: false, error: 'ID поза допустимим діапазоном' };
                }
            }

            return { valid: true };
        }
    };

    /**
     * Відстеження активності користувача
     */
    function setupActivityTracking() {
        const activityEvents = ['click', 'keypress', 'mousemove', 'touchstart', 'scroll'];

        const updateActivity = window.TasksUtils.throttle(() => {
            servicesState.userActivity.lastAction = Date.now();
            servicesState.userActivity.isActive = true;
        }, 1000);

        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Перевірка неактивності
        setInterval(() => {
            const timeSinceLastAction = Date.now() - servicesState.userActivity.lastAction;
            servicesState.userActivity.isActive = timeSinceLastAction < 5 * 60000; // 5 хвилин
        }, 30000);
    }

    /**
     * Ініціалізація сервісів - ОПТИМІЗОВАНА
     */
    async function init() {
        console.log('🚀 [TasksServices-V2] Ініціалізація сервісів (Optimized)');

        try {
            // Чекаємо готовності залежностей
            const maxWaitTime = 10000;
            const startTime = Date.now();

            while (!checkDependencies() && (Date.now() - startTime) < maxWaitTime) {
                console.log('⏳ [TasksServices-V2] Очікування готовності залежностей...');
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!checkDependencies()) {
                throw new Error('Не вдалося ініціалізувати залежності');
            }

            // Ініціалізуємо сервіси
            AnalyticsService.init();
            setupActivityTracking();

            // Перевіряємо здоров'я API
            await checkApiHealth();

            // Запускаємо intelligent sync
            if (servicesState.apiAvailable) {
                SyncService.startAutoSync();
            } else {
                console.warn('⚠️ [TasksServices-V2] API недоступний, синхронізація відкладена');

                // Повторна спроба через 30 секунд
                setTimeout(async () => {
                    if (await checkApiHealth(true)) {
                        SyncService.startAutoSync();
                    }
                }, 30000);
            }

            servicesState.initialized = true;

            // Відстежуємо успішну ініціалізацію
            AnalyticsService.trackEvent('System', 'init', 'services_v2_optimized');

            console.log('✅ [TasksServices-V2] Сервіси ініціалізовано (Optimized)');

        } catch (error) {
            console.error('❌ [TasksServices-V2] Помилка ініціалізації:', error);
            AnalyticsService.trackError(error, 'services_init');
            throw error;
        }
    }

    /**
     * Знищення сервісів
     */
    function destroy() {
        console.log('🗑️ [TasksServices-V2] Знищення сервісів');

        // Зупиняємо синхронізацію
        if (SyncService.syncInterval) {
            clearInterval(SyncService.syncInterval);
        }

        // Очищаємо кеш
        ServiceCache.clear();

        // Знищуємо аналітику
        AnalyticsService.destroy();

        console.log('✅ [TasksServices-V2] Сервіси знищено');
    }

    console.log('✅ [TasksServices-V2] Сервісний модуль готовий (Optimized)');

    // Публічний API
    return {
        Auth: AuthService,
        Sync: SyncService,
        Notification: NotificationService,
        Analytics: AnalyticsService,
        Validation: ValidationService,
        init,
        checkDependencies,
        checkApiHealth,
        getState: () => servicesState,
        destroy,

        // Додаткові утиліти для тестування
        _cache: ServiceCache,
        _queue: SyncQueue
    };

})();

console.log('✅ [TasksServices-V2] Модуль експортовано глобально (Optimized)');