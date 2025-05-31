/**
 * Оптимізовані сервісні функції для системи завдань WINIX
 * Використовує централізовані утиліти без дублювання функціоналу
 */

window.TasksServices = (function() {
    'use strict';

    console.log('🛠️ [TasksServices] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО СЕРВІСНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // RequestManager клієнт для сервісів
    const requestClient = RequestManager.createClient('services');

    // EventBus namespace для сервісів
    const eventBus = EventBus.createNamespace('services');

    // Стан сервісів
    const servicesState = {
        initialized: false,
        dependencies: {
            telegramValidator: false,
            tasksAPI: false,
            tasksStore: false,
            tasksConstants: false
        },
        userActivity: {
            lastAction: Date.now(),
            isActive: true
        }
    };

    /**
     * Перевірка готовності залежностей
     */
    function checkDependencies() {
        console.log('🔍 [TasksServices] Перевірка залежностей...');

        servicesState.dependencies.telegramValidator = !!(window.TelegramValidator?.validateTelegramAuth);
        servicesState.dependencies.tasksAPI = !!(window.TasksAPI?.auth);
        servicesState.dependencies.tasksStore = !!(window.TasksStore?.actions);
        servicesState.dependencies.tasksConstants = !!(window.TasksConstants?.API_ENDPOINTS);

        const allReady = Object.values(servicesState.dependencies).every(ready => ready);

        console.log(`${allReady ? '✅' : '❌'} [TasksServices] Залежності готові:`, allReady);

        return allReady;
    }

    /**
     * Сервіс авторизації
     */
    const AuthService = {
        /**
         * Ініціалізація користувача
         */
        async initUser() {
            console.log('👤 [AuthService] === ІНІЦІАЛІЗАЦІЯ КОРИСТУВАЧА ===');

            // Перевіряємо кеш сесії
            const cachedSession = CacheManager.get(CacheManager.NAMESPACES.USER, 'session');
            if (cachedSession) {
                console.log('✅ [AuthService] Використовуємо кешовану сесію');
                this.updateUserUI(cachedSession);
                return cachedSession;
            }

            try {
                // Перевіряємо залежності
                if (!checkDependencies()) {
                    throw new Error('Система ініціалізується. Зачекайте...');
                }

                // Валідація Telegram
                console.log('🔄 [AuthService] Валідація Telegram...');
                const validation = await window.TelegramValidator.validateTelegramAuth();

                if (!validation.valid) {
                    throw new Error('Telegram authentication failed: ' + validation.error);
                }

                const telegramUser = validation.user;

                // Завантажуємо профіль через RequestManager
                console.log('🔄 [AuthService] Завантаження профілю...');
                const profile = await requestClient.execute(
                    `profile_${telegramUser.telegram_id}`,
                    () => window.TasksAPI.user.getProfile(telegramUser.telegram_id || telegramUser.id),
                    { priority: 'high' }
                );

                if (!profile?.data) {
                    throw new Error('Не вдалося завантажити профіль користувача');
                }

                // Оновлюємо Store
                window.TasksStore.actions.setUser({
                    id: profile.data.id,
                    telegramId: telegramUser.telegram_id || telegramUser.id,
                    username: profile.data.username || telegramUser.username,
                    balance: profile.data.balance || { winix: 0, tickets: 0, flex: 0 }
                });

                // Кешуємо сесію
                CacheManager.set(CacheManager.NAMESPACES.USER, 'session', profile.data);

                // Емітуємо подію
                EventBus.emit(EventBus.EVENTS.USER_LOGGED_IN, {
                    userId: profile.data.id,
                    user: profile.data
                });

                // Оновлюємо UI
                this.updateUserUI(profile.data);

                console.log('✅ [AuthService] Ініціалізація завершена');
                return profile.data;

            } catch (error) {
                console.error('❌ [AuthService] Помилка ініціалізації:', error);

                EventBus.emit(EventBus.EVENTS.APP_ERROR, {
                    service: 'auth',
                    error: error.message
                });

                throw error;
            }
        },

        /**
         * Оновити UI користувача
         */
        updateUserUI(user) {
            console.log('🔄 [AuthService] Оновлення UI користувача');

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
         * Перевірити сесію
         */
        async checkSession() {
            console.log('🔐 [AuthService] Перевірка сесії');

            // Кешована перевірка
            const cachedSession = CacheManager.get(CacheManager.NAMESPACES.USER, 'session');
            if (cachedSession) {
                return true;
            }

            try {
                if (!window.TelegramValidator) {
                    return false;
                }

                const isAuth = window.TelegramValidator.isAuthenticated();

                if (!isAuth) {
                    console.warn('⚠️ [AuthService] Користувач не авторизований');

                    EventBus.emit(EventBus.EVENTS.USER_LOGGED_OUT);

                    NotificationService.showError('Сесія закінчилася. Оновіть сторінку');

                    setTimeout(() => window.location.reload(), 3000);
                    return false;
                }

                return true;

            } catch (error) {
                console.error('❌ [AuthService] Помилка перевірки сесії:', error);
                return false;
            }
        }
    };

    /**
     * Сервіс синхронізації
     */
    const SyncService = {
        syncInterval: null,
        syncSubscriptions: new Map(),

        /**
         * Запустити автоматичну синхронізацію
         */
        startAutoSync() {
            console.log('🔄 [SyncService] === ЗАПУСК АВТОСИНХРОНІЗАЦІЇ ===');

            // Підписуємось на події для smart sync
            this.setupEventSubscriptions();

            // Запускаємо періодичну синхронізацію
            this.syncInterval = setInterval(() => {
                if (servicesState.userActivity.isActive) {
                    this.performSync();
                }
            }, 2 * 60 * 1000); // 2 хвилини

            console.log('✅ [SyncService] Автосинхронізація запущена');
        },

        /**
         * Налаштування підписок на події
         */
        setupEventSubscriptions() {
            // Реагуємо на критичні події
            this.syncSubscriptions.set('balance',
                EventBus.on(EventBus.EVENTS.TASK_COMPLETED, () => {
                    this.syncBalance();
                })
            );

            this.syncSubscriptions.set('wallet',
                EventBus.on(EventBus.EVENTS.WALLET_CONNECTED, () => {
                    this.syncWalletData();
                })
            );

            this.syncSubscriptions.set('daily',
                EventBus.on(EventBus.EVENTS.DAILY_CLAIMED, () => {
                    setTimeout(() => this.syncDailyBonus(), 1000);
                })
            );
        },

        /**
         * Виконати синхронізацію
         */
        async performSync() {
            console.log('🔄 [SyncService] === ВИКОНАННЯ СИНХРОНІЗАЦІЇ ===');

            const userId = window.TasksStore?.selectors?.getUserId();
            if (!userId) {
                console.warn('⚠️ [SyncService] User ID відсутній');
                return;
            }

            // Визначаємо що потрібно синхронізувати
            const syncTasks = [];

            // Баланс - завжди
            syncTasks.push(this.syncBalance(userId));

            // Flex - якщо гаманець підключений
            if (window.TasksStore?.selectors?.isWalletConnected()) {
                syncTasks.push(this.syncFlexBalance(userId));
            }

            // Daily bonus - раз на хвилину
            const lastDailySync = CacheManager.get(CacheManager.NAMESPACES.TEMP, 'lastDailySync') || 0;
            if (Date.now() - lastDailySync > 60000) {
                syncTasks.push(this.syncDailyBonus(userId));
            }

            // Виконуємо всі завдання паралельно
            try {
                await Promise.all(syncTasks);
                console.log('✅ [SyncService] Синхронізація завершена');
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації:', error);
            }
        },

        /**
         * Синхронізація балансу
         */
        async syncBalance(userId) {
            userId = userId || window.TasksStore?.selectors?.getUserId();
            if (!userId) return;

            console.log('💰 [SyncService] Синхронізація балансу');

            try {
                const response = await requestClient.execute(
                    `balance_${userId}`,
                    () => window.TasksAPI.user.getBalance(userId),
                    { deduplicate: false } // Завжди свіжі дані
                );

                if (response?.status === 'success' && response.data) {
                    // Перевіряємо чи змінився баланс
                    const hasChanged = CacheManager.update(
                        CacheManager.NAMESPACES.BALANCE,
                        userId,
                        response.data
                    );

                    if (hasChanged) {
                        window.TasksStore.actions.updateBalance(response.data);
                    }
                }
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації балансу:', error);
            }
        },

        /**
         * Синхронізація Flex балансу
         */
        async syncFlexBalance(userId) {
            const wallet = window.TasksStore?.selectors?.getWalletAddress();
            if (!wallet) return;

            console.log('💎 [SyncService] Синхронізація Flex балансу');

            try {
                const response = await requestClient.execute(
                    `flex_balance_${wallet}`,
                    () => window.TasksAPI.flex.getBalance(userId, wallet)
                );

                if (response?.balance !== undefined) {
                    window.TasksStore.actions.setFlexBalance(parseInt(response.balance));
                }
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації Flex:', error);
            }
        },

        /**
         * Синхронізація Daily Bonus
         */
        async syncDailyBonus(userId) {
            console.log('🎁 [SyncService] Синхронізація Daily Bonus');

            CacheManager.set(CacheManager.NAMESPACES.TEMP, 'lastDailySync', Date.now());

            try {
                const response = await requestClient.execute(
                    `daily_status_${userId}`,
                    () => window.TasksAPI.daily.getStatus(userId)
                );

                if (response?.status === 'success') {
                    // Емітуємо подію для DailyBonusManager
                    EventBus.emit('daily.status.updated', response.data);
                }
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації Daily:', error);
            }
        },

        /**
         * Синхронізація даних гаманця
         */
        async syncWalletData() {
            const userId = window.TasksStore?.selectors?.getUserId();
            if (!userId) return;

            console.log('👛 [SyncService] Синхронізація даних гаманця');

            try {
                const response = await requestClient.execute(
                    `wallet_status_${userId}`,
                    () => window.TasksAPI.wallet.checkStatus(userId)
                );

                if (response?.status === 'success' && response.data) {
                    // Емітуємо подію
                    EventBus.emit('wallet.status.updated', response.data);
                }
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації гаманця:', error);
            }
        },

        /**
         * Зупинити синхронізацію
         */
        stopAutoSync() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }

            // Відписуємось від подій
            this.syncSubscriptions.forEach(unsubscribe => unsubscribe());
            this.syncSubscriptions.clear();

            console.log('⏹️ [SyncService] Автосинхронізація зупинена');
        }
    };

    /**
     * Сервіс нотифікацій
     */
    const NotificationService = {
        showSuccess(message, duration = 3000) {
            console.log('✅ [NotificationService] Успіх:', message);
            window.TasksUtils?.showToast?.(message, 'success', duration);
            this.vibrate([50]);

            // Емітуємо подію
            eventBus.emit('notification.shown', { type: 'success', message });
        },

        showError(message, duration = 5000) {
            console.log('❌ [NotificationService] Помилка:', message);
            window.TasksUtils?.showToast?.(message, 'error', duration);
            this.vibrate([100, 50, 100]);

            eventBus.emit('notification.shown', { type: 'error', message });
        },

        showWarning(message, duration = 4000) {
            console.log('⚠️ [NotificationService] Попередження:', message);
            window.TasksUtils?.showToast?.(message, 'warning', duration);
            this.vibrate([75]);

            eventBus.emit('notification.shown', { type: 'warning', message });
        },

        showInfo(message, duration = 3000) {
            console.log('ℹ️ [NotificationService] Інформація:', message);
            window.TasksUtils?.showToast?.(message, 'info', duration);

            eventBus.emit('notification.shown', { type: 'info', message });
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

            eventBus.emit('reward.received', reward);
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
     * Сервіс аналітики
     */
    const AnalyticsService = {
        sessionId: null,

        init() {
            this.sessionId = this.generateSessionId();
            console.log('📊 [AnalyticsService] Сесія:', this.sessionId);

            // Підписуємось на всі події для логування
            EventBus.on('*', (data, context) => {
                if (context.event && !context.event.startsWith('analytics.')) {
                    this.trackEvent('System', context.event, JSON.stringify(data));
                }
            });
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

            // Використовуємо CacheManager для батчингу
            const events = CacheManager.get(CacheManager.NAMESPACES.TEMP, 'analytics_batch') || [];
            events.push(event);
            CacheManager.set(CacheManager.NAMESPACES.TEMP, 'analytics_batch', events);

            // Відправляємо якщо накопичилось багато
            if (events.length >= 10) {
                this.flushEvents();
            }
        },

        async flushEvents() {
            const events = CacheManager.get(CacheManager.NAMESPACES.TEMP, 'analytics_batch') || [];
            if (events.length === 0) return;

            // Очищаємо кеш
            CacheManager.invalidate(CacheManager.NAMESPACES.TEMP, 'analytics_batch');

            try {
                // Telegram WebApp
                if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.sendData(JSON.stringify({
                        type: 'analytics_batch',
                        events
                    }));
                }
            } catch (error) {
                console.error('❌ [AnalyticsService] Помилка відправки:', error);
            }
        },

        trackPageView(pageName) {
            this.trackEvent('Navigation', 'page_view', pageName);
        },

        trackError(error, context) {
            this.trackEvent('Error', error.name || 'UnknownError', context, 1);
        },

        trackTiming(category, variable, time) {
            this.trackEvent('Timing', category, variable, time);
        }
    };

    /**
     * Сервіс валідації
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
        const updateActivity = window.TasksUtils.throttle(() => {
            servicesState.userActivity.lastAction = Date.now();
            servicesState.userActivity.isActive = true;
        }, 1000);

        ['click', 'keypress', 'mousemove', 'touchstart', 'scroll'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Перевірка неактивності
        setInterval(() => {
            const timeSinceLastAction = Date.now() - servicesState.userActivity.lastAction;
            servicesState.userActivity.isActive = timeSinceLastAction < 5 * 60000; // 5 хвилин
        }, 30000);
    }

    /**
     * Ініціалізація сервісів
     */
    async function init() {
        console.log('🚀 [TasksServices] Ініціалізація сервісів');

        try {
            // Чекаємо готовності залежностей
            const maxWaitTime = 10000;
            const startTime = Date.now();

            while (!checkDependencies() && (Date.now() - startTime) < maxWaitTime) {
                console.log('⏳ [TasksServices] Очікування готовності залежностей...');
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!checkDependencies()) {
                throw new Error('Не вдалося ініціалізувати залежності');
            }

            // Ініціалізуємо сервіси
            AnalyticsService.init();
            setupActivityTracking();

            // Запускаємо автосинхронізацію після успішної авторизації
            EventBus.once(EventBus.EVENTS.USER_LOGGED_IN, () => {
                SyncService.startAutoSync();
            });

            servicesState.initialized = true;

            console.log('✅ [TasksServices] Сервіси ініціалізовано');

        } catch (error) {
            console.error('❌ [TasksServices] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Знищення сервісів
     */
    function destroy() {
        console.log('🗑️ [TasksServices] Знищення сервісів');

        // Зупиняємо синхронізацію
        SyncService.stopAutoSync();

        // Відправляємо залишки аналітики
        AnalyticsService.flushEvents();

        // Відписуємось від подій
        eventBus.clear();

        console.log('✅ [TasksServices] Сервіси знищено');
    }

    console.log('✅ [TasksServices] Сервісний модуль готовий');

    // Публічний API
    return {
        Auth: AuthService,
        Sync: SyncService,
        Notification: NotificationService,
        Analytics: AnalyticsService,
        Validation: ValidationService,
        init,
        checkDependencies,
        getState: () => servicesState,
        destroy
    };

})();

console.log('✅ [TasksServices] Модуль експортовано глобально');