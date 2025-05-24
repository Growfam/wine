/**
 * Сервісні функції для системи завдань WINIX
 * Координація роботи між модулями
 */

window.TasksServices = (function() {
    'use strict';

    console.log('🛠️ [TasksServices] ===== ІНІЦІАЛІЗАЦІЯ СЕРВІСНОГО МОДУЛЯ =====');

    /**
     * Сервіс авторизації
     */
    const AuthService = {
        /**
         * Ініціалізація користувача
         */
        async initUser() {
            console.log('👤 [AuthService] === ІНІЦІАЛІЗАЦІЯ КОРИСТУВАЧА ===');

            try {
                // Валідуємо Telegram дані
                const validation = await window.TelegramValidator.validateTelegramAuth();

                if (!validation.valid) {
                    throw new Error('Telegram authentication failed: ' + validation.error);
                }

                console.log('✅ [AuthService] Telegram валідація пройдена');

                const telegramUser = validation.user;
                console.log('📱 [AuthService] Telegram користувач:', {
                    id: telegramUser.id,
                    username: telegramUser.username
                });

                // Завантажуємо профіль з бекенду
                const profile = await window.TasksAPI.user.getProfile(telegramUser.id);
                console.log('✅ [AuthService] Профіль завантажено:', profile);

                // Оновлюємо стор
                window.TasksStore.actions.setUser({
                    id: profile.id,
                    telegramId: telegramUser.id,
                    username: profile.username || telegramUser.username,
                    firstName: profile.firstName || telegramUser.firstName,
                    lastName: profile.lastName || telegramUser.lastName,
                    balance: profile.balance || { winix: 0, tickets: 0, flex: 0 }
                });

                // Оновлюємо UI
                this.updateUserUI(profile);

                return profile;

            } catch (error) {
                console.error('❌ [AuthService] Помилка ініціалізації користувача:', error);

                // Показуємо повідомлення користувачу
                window.TasksUtils.showToast(
                    'Помилка авторизації. Оновіть сторінку',
                    'error'
                );

                throw error;
            }
        },

        /**
         * Оновити UI користувача
         */
        updateUserUI(user) {
            console.log('🔄 [AuthService] Оновлення UI користувача');

            // Оновлюємо ID
            const userIdElement = document.getElementById('header-user-id');
            if (userIdElement) {
                userIdElement.textContent = user.id;
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
                winixElement.textContent = user.balance.winix || 0;
            }

            if (ticketsElement) {
                ticketsElement.textContent = user.balance.tickets || 0;
            }
        },

        /**
         * Перевірити сесію
         */
        async checkSession() {
            console.log('🔐 [AuthService] Перевірка сесії');

            const isAuth = window.TelegramValidator.isAuthenticated();

            if (!isAuth) {
                console.warn('⚠️ [AuthService] Користувач не авторизований');
                return false;
            }

            // Спробуємо оновити токен якщо потрібно
            const token = window.TelegramValidator.getAuthToken();
            if (token) {
                // Перевіряємо термін дії токена
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const exp = payload.exp * 1000;
                    const now = Date.now();

                    if (exp - now < 5 * 60 * 1000) { // Менше 5 хвилин
                        console.log('🔄 [AuthService] Оновлення токену');
                        await window.TelegramValidator.refreshToken();
                    }
                } catch (error) {
                    console.error('❌ [AuthService] Помилка перевірки токену:', error);
                }
            }

            return true;
        }
    };

    /**
     * Сервіс синхронізації
     */
    const SyncService = {
        syncInterval: null,
        lastSyncTime: 0,
        isSyncing: false,

        /**
         * Запустити автоматичну синхронізацію
         */
        startAutoSync() {
            console.log('🔄 [SyncService] === ЗАПУСК АВТОСИНХРОНІЗАЦІЇ ===');

            // Очищаємо попередній інтервал
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }

            // Синхронізація кожні 5 хвилин
            const SYNC_INTERVAL = window.TasksConstants.TIMERS.AUTO_CHECK_INTERVAL;

            this.syncInterval = setInterval(() => {
                this.syncData();
            }, SYNC_INTERVAL);

            console.log(`✅ [SyncService] Автосинхронізація запущена (кожні ${SYNC_INTERVAL/1000/60} хв)`);
        },

        /**
         * Синхронізувати дані
         */
        async syncData() {
            console.log('🔄 [SyncService] === СИНХРОНІЗАЦІЯ ДАНИХ ===');
            console.log('🕐 [SyncService] Час:', new Date().toISOString());

            // Перевіряємо чи вже йде синхронізація
            if (this.isSyncing) {
                console.log('⏸️ [SyncService] Синхронізація вже виконується');
                return;
            }

            // Перевіряємо чи минуло достатньо часу
            const now = Date.now();
            const timeSinceLastSync = now - this.lastSyncTime;

            if (timeSinceLastSync < 30000) { // 30 секунд
                console.log('⏸️ [SyncService] Занадто рано для синхронізації');
                return;
            }

            this.isSyncing = true;
            this.lastSyncTime = now;

            try {
                // Перевіряємо сесію
                const sessionValid = await AuthService.checkSession();
                if (!sessionValid) {
                    console.error('❌ [SyncService] Невалідна сесія');
                    return;
                }

                const userId = window.TasksStore.selectors.getUserId();
                if (!userId) {
                    console.warn('⚠️ [SyncService] User ID не знайдено');
                    return;
                }

                // Паралельно завантажуємо всі дані
                const promises = [
                    this.syncBalance(userId),
                    this.syncFlexStatus(userId),
                    this.syncDailyBonus(userId),
                    this.syncTasks(userId)
                ];

                const results = await Promise.allSettled(promises);

                // Логуємо результати
                results.forEach((result, index) => {
                    const syncType = ['Balance', 'Flex', 'Daily', 'Tasks'][index];
                    if (result.status === 'fulfilled') {
                        console.log(`✅ [SyncService] ${syncType} синхронізовано`);
                    } else {
                        console.error(`❌ [SyncService] Помилка синхронізації ${syncType}:`, result.reason);
                    }
                });

                console.log('✅ [SyncService] Синхронізація завершена');

            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації:', error);
            } finally {
                this.isSyncing = false;
            }
        },

        /**
         * Синхронізація балансу
         */
        async syncBalance(userId) {
            console.log('💰 [SyncService] Синхронізація балансу...');

            const response = await window.TasksAPI.user.getBalance(userId);
            window.TasksStore.actions.updateBalance(response.balance);

            // Оновлюємо UI
            AuthService.updateUserUI({
                balance: response.balance
            });

            return response;
        },

        /**
         * Синхронізація Flex статусу
         */
        async syncFlexStatus(userId) {
            console.log('💎 [SyncService] Синхронізація Flex статусу...');

            const wallet = window.TasksStore.selectors.getWalletAddress();
            if (!wallet) {
                console.log('⏸️ [SyncService] Гаманець не підключено');
                return null;
            }

            if (window.FlexEarnManager) {
                await window.FlexEarnManager.checkFlexBalance();
            }

            return { synced: true };
        },

        /**
         * Синхронізація щоденного бонусу
         */
        async syncDailyBonus(userId) {
            console.log('🎁 [SyncService] Синхронізація щоденного бонусу...');

            const response = await window.TasksAPI.daily.getStatus(userId);

            // Оновлюємо UI через менеджер
            if (window.DailyBonusManager && window.DailyBonusManager.updateDailyBonusUI) {
                window.DailyBonusManager.updateDailyBonusUI();
            }

            return response;
        },

        /**
         * Синхронізація завдань
         */
        async syncTasks(userId) {
            console.log('📋 [SyncService] Синхронізація завдань...');

            const response = await window.TasksAPI.tasks.getList(userId);

            // Оновлюємо завдання в сторі
            if (response.tasks) {
                Object.entries(response.tasks).forEach(([type, tasks]) => {
                    window.TasksStore.actions.setTasks(type, tasks);
                });
            }

            return response;
        }
    };

    /**
     * Сервіс нотифікацій
     */
    const NotificationService = {
        /**
         * Показати успішну нотифікацію
         */
        showSuccess(message, duration = 3000) {
            console.log('✅ [NotificationService] Успіх:', message);
            window.TasksUtils.showToast(message, 'success', duration);

            // Вібрація на мобільних
            this.vibrate([50]);
        },

        /**
         * Показати помилку
         */
        showError(message, duration = 5000) {
            console.log('❌ [NotificationService] Помилка:', message);
            window.TasksUtils.showToast(message, 'error', duration);

            // Довша вібрація для помилок
            this.vibrate([100, 50, 100]);
        },

        /**
         * Показати попередження
         */
        showWarning(message, duration = 4000) {
            console.log('⚠️ [NotificationService] Попередження:', message);
            window.TasksUtils.showToast(message, 'warning', duration);

            this.vibrate([75]);
        },

        /**
         * Показати інформацію
         */
        showInfo(message, duration = 3000) {
            console.log('ℹ️ [NotificationService] Інформація:', message);
            window.TasksUtils.showToast(message, 'info', duration);
        },

        /**
         * Показати нотифікацію винагороди
         */
        showReward(reward) {
            console.log('🎁 [NotificationService] Винагорода:', reward);

            let message = '';
            if (reward.winix > 0) {
                message += `+${reward.winix} WINIX`;
            }
            if (reward.tickets > 0) {
                if (message) message += ' та ';
                message += `+${reward.tickets} tickets`;
            }

            this.showSuccess(message, 4000);

            // Святкова вібрація
            this.vibrate([50, 100, 50, 100, 50]);
        },

        /**
         * Вібрація (якщо підтримується)
         */
        vibrate(pattern) {
            if ('vibrate' in navigator && window.Telegram?.WebApp?.HapticFeedback) {
                try {
                    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                } catch (e) {
                    // Fallback до стандартної вібрації
                    navigator.vibrate(pattern);
                }
            }
        }
    };

    /**
     * Сервіс аналітики
     */
    const AnalyticsService = {
        sessionId: null,

        /**
         * Ініціалізація аналітики
         */
        init() {
            this.sessionId = this.generateSessionId();
            console.log('📊 [AnalyticsService] Сесія:', this.sessionId);
        },

        /**
         * Генерація ID сесії
         */
        generateSessionId() {
            return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },

        /**
         * Відстежити подію
         */
        trackEvent(category, action, label, value) {
            console.log('📊 [AnalyticsService] Подія:', {
                category,
                action,
                label,
                value,
                sessionId: this.sessionId
            });

            // Telegram WebApp аналітика
            if (window.Telegram?.WebApp) {
                try {
                    window.Telegram.WebApp.sendData(JSON.stringify({
                        type: 'analytics',
                        event: {
                            category,
                            action,
                            label,
                            value,
                            sessionId: this.sessionId,
                            timestamp: Date.now()
                        }
                    }));
                } catch (error) {
                    console.error('❌ [AnalyticsService] Помилка відправки в Telegram:', error);
                }
            }

            // Відправка на бекенд
            if (window.TasksAPI) {
                window.TasksAPI.call('/analytics/event', {
                    method: 'POST',
                    body: {
                        category,
                        action,
                        label,
                        value,
                        sessionId: this.sessionId,
                        timestamp: Date.now()
                    }
                }).catch(error => {
                    console.error('❌ [AnalyticsService] Помилка відправки на бекенд:', error);
                });
            }
        },

        /**
         * Відстежити перегляд сторінки
         */
        trackPageView(pageName) {
            console.log('📄 [AnalyticsService] Перегляд сторінки:', pageName);
            this.trackEvent('Navigation', 'page_view', pageName);
        },

        /**
         * Відстежити помилку
         */
        trackError(error, context) {
            console.log('🐛 [AnalyticsService] Помилка:', error, context);
            this.trackEvent('Error', error.name || 'Unknown', context, 1);
        },

        /**
         * Відстежити час виконання
         */
        trackTiming(category, variable, time) {
            console.log('⏱️ [AnalyticsService] Час виконання:', {
                category,
                variable,
                time: time + 'ms'
            });
            this.trackEvent('Timing', category, variable, time);
        }
    };

    /**
     * Сервіс кешування
     */
    const CacheService = {
        cache: new Map(),

        /**
         * Отримати з кешу
         */
        get(key) {
            const item = this.cache.get(key);
            if (!item) return null;

            // Перевіряємо термін дії
            if (item.expires && item.expires < Date.now()) {
                this.cache.delete(key);
                return null;
            }

            console.log(`📦 [CacheService] Отримано з кешу: ${key}`);
            return item.value;
        },

        /**
         * Зберегти в кеш
         */
        set(key, value, ttl = 300000) { // 5 хвилин за замовчуванням
            console.log(`💾 [CacheService] Збережено в кеш: ${key}`);

            this.cache.set(key, {
                value,
                expires: ttl ? Date.now() + ttl : null,
                timestamp: Date.now()
            });

            // Обмежуємо розмір кешу
            if (this.cache.size > 100) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
        },

        /**
         * Видалити з кешу
         */
        delete(key) {
            console.log(`🗑️ [CacheService] Видалено з кешу: ${key}`);
            this.cache.delete(key);
        },

        /**
         * Очистити весь кеш
         */
        clear() {
            console.log('🧹 [CacheService] Кеш очищено');
            this.cache.clear();
        },

        /**
         * Отримати розмір кешу
         */
        size() {
            return this.cache.size;
        },

        /**
         * Отримати статистику кешу
         */
        getStats() {
            let totalSize = 0;
            let expiredCount = 0;
            const now = Date.now();

            this.cache.forEach((item, key) => {
                if (item.expires && item.expires < now) {
                    expiredCount++;
                }
                totalSize += JSON.stringify(item.value).length;
            });

            return {
                entries: this.cache.size,
                expired: expiredCount,
                sizeKB: (totalSize / 1024).toFixed(2)
            };
        }
    };

    /**
     * Сервіс валідації
     */
    const ValidationService = {
        /**
         * Валідація завдання
         */
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

        /**
         * Валідація транзакції
         */
        validateTransaction(transaction) {
            console.log('🔍 [ValidationService] Валідація транзакції:', transaction);

            const errors = [];

            if (!transaction.amount || transaction.amount <= 0) {
                errors.push('Невірна сума транзакції');
            }

            if (!transaction.type || !['claim', 'spend', 'bonus'].includes(transaction.type)) {
                errors.push('Невірний тип транзакції');
            }

            if (!transaction.userId) {
                errors.push('ID користувача відсутній');
            }

            if (!transaction.timestamp || transaction.timestamp > Date.now()) {
                errors.push('Невірна мітка часу');
            }

            if (errors.length > 0) {
                console.error('❌ [ValidationService] Помилки валідації:', errors);
                return { valid: false, errors };
            }

            console.log('✅ [ValidationService] Транзакція валідна');
            return { valid: true };
        },

        /**
         * Валідація адреси гаманця
         */
        validateWalletAddress(address) {
            console.log('🔍 [ValidationService] Валідація адреси:', address);

            // TON адреса має бути 48 символів
            const isValid = /^[a-zA-Z0-9_-]{48}$/.test(address);

            if (!isValid) {
                console.error('❌ [ValidationService] Невірний формат адреси');
                return { valid: false, error: 'Невірний формат адреси TON' };
            }

            console.log('✅ [ValidationService] Адреса валідна');
            return { valid: true };
        }
    };

    /**
     * Ініціалізація сервісів
     */
    function init() {
        console.log('🚀 [TasksServices] Ініціалізація сервісів');

        // Ініціалізуємо аналітику
        AnalyticsService.init();

        // Запускаємо автосинхронізацію
        SyncService.startAutoSync();

        // Відстежуємо початок роботи
        AnalyticsService.trackEvent('System', 'init', 'services');

        console.log('✅ [TasksServices] Сервіси ініціалізовано');
    }

    // Автоматична ініціалізація з затримкою
    setTimeout(init, 100);

    console.log('✅ [TasksServices] Сервісний модуль готовий');

    // Публічний API
    return {
        Auth: AuthService,
        Sync: SyncService,
        Notification: NotificationService,
        Analytics: AnalyticsService,
        Cache: CacheService,
        Validation: ValidationService
    };

})();

console.log('✅ [TasksServices] Модуль експортовано глобально');