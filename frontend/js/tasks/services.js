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
                // Отримуємо дані з Telegram
                const telegramUser = this.getTelegramUser();
                if (!telegramUser) {
                    throw new Error('Telegram user data not found');
                }

                console.log('📱 [AuthService] Telegram користувач:', telegramUser);

                // Завантажуємо профіль з бекенду
                const profile = await window.TasksAPI.user.getProfile(telegramUser.id);
                console.log('✅ [AuthService] Профіль завантажено:', profile);

                // Оновлюємо стор
                window.TasksStore.actions.setUser({
                    id: profile.id,
                    telegramId: telegramUser.id,
                    username: profile.username || telegramUser.username,
                    balance: profile.balance || { winix: 0, tickets: 0, flex: 0 }
                });

                return profile;

            } catch (error) {
                console.error('❌ [AuthService] Помилка ініціалізації користувача:', error);

                // Fallback для локальної розробки
                if (window.TasksConstants.DEBUG.ENABLED) {
                    console.warn('⚠️ [AuthService] Використовується демо користувач');
                    const demoUser = {
                        id: 123456789,
                        telegramId: 123456789,
                        username: 'demo_user',
                        balance: { winix: 1000, tickets: 10, flex: 0 }
                    };

                    window.TasksStore.actions.setUser(demoUser);
                    return demoUser;
                }

                throw error;
            }
        },

        /**
         * Отримати дані Telegram користувача
         */
        getTelegramUser() {
            console.log('📱 [AuthService] Отримання даних Telegram користувача');

            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                return window.Telegram.WebApp.initDataUnsafe.user;
            }

            // Спроба отримати з localStorage
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId) {
                return { id: parseInt(storedId), username: 'stored_user' };
            }

            return null;
        }
    };

    /**
     * Сервіс синхронізації
     */
    const SyncService = {
        syncInterval: null,
        lastSyncTime: 0,

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
            const SYNC_INTERVAL = 5 * 60 * 1000;

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

            // Перевіряємо чи минуло достатньо часу
            const now = Date.now();
            const timeSinceLastSync = now - this.lastSyncTime;

            if (timeSinceLastSync < 30000) { // 30 секунд
                console.log('⏸️ [SyncService] Занадто рано для синхронізації');
                return;
            }

            this.lastSyncTime = now;

            try {
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

                await Promise.allSettled(promises);

                console.log('✅ [SyncService] Синхронізація завершена');

            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації:', error);
            }
        },

        /**
         * Синхронізація балансу
         */
        async syncBalance(userId) {
            console.log('💰 [SyncService] Синхронізація балансу...');

            try {
                const response = await window.TasksAPI.user.getBalance(userId);
                window.TasksStore.actions.updateBalance(response.balance);
                console.log('✅ [SyncService] Баланс синхронізовано:', response.balance);
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації балансу:', error);
            }
        },

        /**
         * Синхронізація Flex статусу
         */
        async syncFlexStatus(userId) {
            console.log('💎 [SyncService] Синхронізація Flex статусу...');

            const wallet = window.TasksStore.selectors.getWalletAddress();
            if (!wallet) {
                console.log('⏸️ [SyncService] Гаманець не підключено');
                return;
            }

            try {
                await window.FlexEarnManager?.checkFlexBalance();
                console.log('✅ [SyncService] Flex статус синхронізовано');
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації Flex:', error);
            }
        },

        /**
         * Синхронізація щоденного бонусу
         */
        async syncDailyBonus(userId) {
            console.log('🎁 [SyncService] Синхронізація щоденного бонусу...');

            try {
                const response = await window.TasksAPI.daily.getStatus(userId);
                // Оновлюємо стан через менеджер
                if (window.DailyBonusManager) {
                    window.DailyBonusManager.updateDailyBonusUI();
                }
                console.log('✅ [SyncService] Щоденний бонус синхронізовано');
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації бонусу:', error);
            }
        },

        /**
         * Синхронізація завдань
         */
        async syncTasks(userId) {
            console.log('📋 [SyncService] Синхронізація завдань...');

            try {
                const response = await window.TasksAPI.tasks.getList(userId);
                // Оновлюємо завдання в сторі
                if (response.tasks) {
                    Object.entries(response.tasks).forEach(([type, tasks]) => {
                        window.TasksStore.actions.setTasks(type, tasks);
                    });
                }
                console.log('✅ [SyncService] Завдання синхронізовано');
            } catch (error) {
                console.error('❌ [SyncService] Помилка синхронізації завдань:', error);
            }
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
                message += ` +${reward.tickets} tickets`;
            }

            this.showSuccess(message, 4000);

            // Святкова вібрація
            this.vibrate([50, 100, 50, 100, 50]);
        },

        /**
         * Вібрація (якщо підтримується)
         */
        vibrate(pattern) {
            if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        }
    };

    /**
     * Сервіс аналітики
     */
    const AnalyticsService = {
        /**
         * Відстежити подію
         */
        trackEvent(category, action, label, value) {
            console.log('📊 [AnalyticsService] Подія:', {
                category,
                action,
                label,
                value
            });

            // Telegram WebApp аналітика
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify({
                    type: 'analytics',
                    event: { category, action, label, value },
                    timestamp: Date.now()
                }));
            }

            // Google Analytics (якщо підключено)
            if (window.gtag) {
                window.gtag('event', action, {
                    event_category: category,
                    event_label: label,
                    value: value
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
            this.trackEvent('Error', error.name || 'Unknown', context);
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
                expires: ttl ? Date.now() + ttl : null
            });
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

            if (!transaction.type) {
                errors.push('Тип транзакції відсутній');
            }

            if (!transaction.userId) {
                errors.push('ID користувача відсутній');
            }

            if (errors.length > 0) {
                console.error('❌ [ValidationService] Помилки валідації:', errors);
                return { valid: false, errors };
            }

            console.log('✅ [ValidationService] Транзакція валідна');
            return { valid: true };
        }
    };

    /**
     * Ініціалізація сервісів
     */
    function init() {
        console.log('🚀 [TasksServices] Ініціалізація сервісів');

        // Запускаємо автосинхронізацію
        SyncService.startAutoSync();

        console.log('✅ [TasksServices] Сервіси ініціалізовано');
    }

    // Автоматична ініціалізація
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