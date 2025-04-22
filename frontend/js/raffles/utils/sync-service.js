/**
 * WINIX - Централізований сервіс синхронізації даних
 * Оптимізована версія, яка координується з WinixCore для уникнення дублювання функціональності
 * @version 1.2.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше sync-service.js');
        return;
    }

    // Перевірка наявності WinixCore
    const hasWinixCore = () => {
        try {
            return window.WinixCore &&
                   typeof window.WinixCore.refreshBalance === 'function' &&
                   typeof window.WinixCore.syncUserData === 'function' &&
                   typeof window.WinixCore.registerEventHandler === 'function';
        } catch (e) {
            console.error("❌ Помилка перевірки WinixCore:", e);
            return false;
        }
    };

    // Перевірка наявності ErrorHandler
    const hasErrorHandler = () => {
        try {
            return window.WinixRaffles &&
                   window.WinixRaffles.errorHandler &&
                   typeof window.WinixRaffles.errorHandler.showUserFriendlyError === 'function';
        } catch (e) {
            console.error("❌ Помилка перевірки ErrorHandler:", e);
            return false;
        }
    };

    // Функція для безпечної роботи з помилками
    function handleSyncError(error, functionName, details = {}) {
        console.error(`❌ Помилка у функції ${functionName}:`, error);

        // Якщо є централізований обробник помилок, використовуємо його
        if (hasErrorHandler()) {
            window.WinixRaffles.errorHandler.handleRaffleError(error, {
                module: 'sync-service.js',
                function: functionName,
                details: details
            });
            return;
        }

        // Якщо WinixCore та його система подій доступні
        if (hasWinixCore()) {
            window.WinixCore.triggerEvent('error', {
                message: `Помилка синхронізації: ${error.message}`,
                originalError: error,
                module: 'sync-service.js',
                function: functionName,
                details: details
            });
            return;
        }

        // Запасний варіант - просто показуємо повідомлення, якщо можливо
        if (typeof window.showToast === 'function') {
            window.showToast(`Помилка синхронізації: ${error.message || 'Щось пішло не так'}`, 'error');
        }
    }

    // Сервіс синхронізації даних
    const syncService = {
        // Час останньої синхронізації для різних типів даних
        lastSync: {
            balance: 0,
            participation: 0,
            statistics: 0,
            raffles: 0
        },

        // Статус синхронізації
        isSyncing: false,

        // Налаштування інтервалів синхронізації (мс)
        syncIntervals: {
            balance: 30000,        // 30 секунд
            participation: 60000,  // 1 хвилина
            statistics: 120000,    // 2 хвилини
            raffles: 180000        // 3 хвилини
        },

        // Прапорець примусового оновлення
        forceRefresh: false,

        // Чергa запитів на синхронізацію
        syncQueue: [],

        // Таймер періодичної синхронізації
        syncInterval: null,

        // Ініціалізація сервісу
        init: function() {
            console.log('🔄 Ініціалізація сервісу синхронізації даних WINIX...');

            // Перевіряємо, чи ініціалізований WinixCore і реєструємо з ним обробники подій
            if (hasWinixCore()) {
                this._registerCoreEventHandlers();
            }

            // Додаємо інші обробники подій, якщо WinixCore недоступний або не має системи подій
            this._setupEventListeners();

            // Запускаємо фоновий процес синхронізації
            this._startBackgroundSync();

            console.log('✅ Сервіс синхронізації даних успішно ініціалізовано');
        },

        // Реєстрація обробників подій WinixCore
        _registerCoreEventHandlers: function() {
            if (!hasWinixCore()) return;

            // Реєструємо обробник для кожної ключової події
            window.WinixCore.registerEventHandler('balance-updated', (detail) => {
                console.log('🔄 SyncService: Отримано подію оновлення балансу');
                this.lastSync.balance = Date.now();
            }, { source: 'sync-service.js' });

            window.WinixCore.registerEventHandler('user-data-updated', (detail) => {
                console.log('🔄 SyncService: Отримано подію оновлення даних користувача');
                // Оновлюємо чи не оновлюємо участь у розіграшах залежно від джерела
                if (detail.source !== 'sync-service.js') {
                    setTimeout(() => this.syncParticipation(false), 1000);
                }
            }, { source: 'sync-service.js' });

            window.WinixCore.registerEventHandler('network-online', () => {
                console.log('🔄 SyncService: Відновлено з\'єднання з мережею, виконуємо синхронізацію');
                this.syncAll(true);
            }, { source: 'sync-service.js' });

            window.WinixCore.registerEventHandler('raffle-participation', (detail) => {
                if (detail.successful) {
                    console.log('🔄 SyncService: Успішна участь у розіграші, оновлюємо дані');
                    this.syncBalance(true);
                    this.syncParticipation(true);
                }
            }, { source: 'sync-service.js' });

            console.log('✅ SyncService: Зареєстровано обробники подій WinixCore');
        },

        // Налаштування обробників подій
        _setupEventListeners: function() {
            // Реєструємо додаткові обробники, тільки якщо немає WinixCore або його системи подій
            if (!hasWinixCore()) {
                // Синхронізація після успішної участі в розіграші через DOM події
                document.addEventListener('raffle-participation', (event) => {
                    if (event.detail && event.detail.successful) {
                        console.log('🔄 SyncService: Успішна участь у розіграші, оновлюємо дані (DOM подія)');
                        this.syncBalance(true);
                        this.syncParticipation(true);
                    }
                });

                // Синхронізація при поверненні на сторінку
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        console.log('🔄 SyncService: Повернення на сторінку, перевіряємо необхідність синхронізації');
                        this.syncAll(false); // Не примусово, тільки якщо минув час інтервалу
                    }
                });

                // Синхронізація при відновленні з'єднання
                window.addEventListener('online', () => {
                    console.log('🔄 SyncService: Відновлено з\'єднання з мережею, виконуємо синхронізацію (DOM подія)');
                    this.syncAll(true);
                });
            }

            // Синхронізація при переключенні вкладок - завжди через DOM події
            document.querySelectorAll('.tab-button').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.getAttribute('data-tab');
                    console.log(`🔄 SyncService: Перемикання на вкладку ${tabName}`);

                    if (tabName === 'active') {
                        this.syncRaffles(false);
                        this.syncParticipation(false);
                    } else if (tabName === 'stats') {
                        this.syncStatistics(true); // Примусово синхронізуємо статистику при переході на вкладку
                    } else if (tabName === 'history') {
                        // Тут можна додати синхронізацію історії розіграшів
                    }
                });
            });
        },

        // Запуск фонового процесу синхронізації
        _startBackgroundSync: function() {
            // Очищаємо попередній інтервал, якщо він був
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }

            // Запускаємо першу синхронізацію через 5 секунд після завантаження
            setTimeout(() => {
                this.syncAll(true);
            }, 5000);

            // Регулярна перевірка необхідності синхронізації
            this.syncInterval = setInterval(() => {
                const now = Date.now();

                // Перевіряємо чи ми онлайн
                if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                    console.log('⚠️ SyncService: Пристрій офлайн, пропускаємо синхронізацію');
                    return;
                }

                // Перевіряємо необхідність синхронізації для кожного типу даних
                if (now - this.lastSync.balance > this.syncIntervals.balance) {
                    this.syncBalance(false);
                }

                if (now - this.lastSync.participation > this.syncIntervals.participation) {
                    this.syncParticipation(false);
                }

                if (now - this.lastSync.statistics > this.syncIntervals.statistics) {
                    this.syncStatistics(false);
                }

                if (now - this.lastSync.raffles > this.syncIntervals.raffles) {
                    this.syncRaffles(false);
                }
            }, 60000); // Перевірка кожну хвилину

            console.log('🔄 SyncService: Запущено фоновий процес синхронізації');
        },

        // Зупинка процесу синхронізації
        stopBackgroundSync: function() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
                console.log('⏹️ SyncService: Зупинено фоновий процес синхронізації');
            }
        },

        // Синхронізація всіх даних
        syncAll: function(force = false) {
            console.log('🔄 SyncService: Запуск повної синхронізації даних' + (force ? ' (примусово)' : ''));

            // Якщо є WinixCore з методом syncUserData, делегуємо йому синхронізацію основних даних
            if (hasWinixCore()) {
                window.WinixCore.syncUserData(force)
                    .then(result => {
                        if (result.success) {
                            console.log('✅ SyncService: Успішна синхронізація через WinixCore');
                            this.lastSync.balance = Date.now();
                        }
                    })
                    .catch(error => {
                        console.error('❌ SyncService: Помилка синхронізації через WinixCore:', error);
                    });
            } else {
                // Якщо немає WinixCore, використовуємо власні методи
                this.syncBalance(force);
            }

            // Відкладаємо запити з інтервалом для зменшення навантаження
            setTimeout(() => {
                this.syncParticipation(force);
            }, 1000);

            setTimeout(() => {
                this.syncRaffles(force);
            }, 2000);

            setTimeout(() => {
                this.syncStatistics(force);
            }, 3000);

            return Promise.resolve(true);
        },

        // Синхронізація балансу
        syncBalance: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.balance < this.syncIntervals.balance) {
                console.log('⏱️ SyncService: Пропуск синхронізації балансу (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('balance', async () => {
                console.log('💰 SyncService: Синхронізація балансу...');

                try {
                    // Використовуємо WinixCore для оновлення балансу, якщо доступний
                    if (hasWinixCore()) {
                        const response = await window.WinixCore.refreshBalance(force);

                        if (response && response.success) {
                            // Оновлюємо час синхронізації
                            this.lastSync.balance = Date.now();
                            console.log('✅ SyncService: Баланс успішно синхронізовано через WinixCore');
                            return true;
                        } else {
                            console.warn('⚠️ SyncService: Помилка синхронізації балансу через WinixCore:', response?.message);
                            // Спробуємо використати запасний метод
                        }
                    }

                    // Запасний метод через API, якщо WinixCore недоступний або повернув помилку
                    if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                        const response = await window.WinixAPI.getBalance();

                        if (response && response.status === 'success' && response.data) {
                            // Оновлюємо час синхронізації
                            this.lastSync.balance = Date.now();

                            // Передаємо результати в WinixCore, якщо він доступний
                            if (hasWinixCore() && typeof window.WinixCore.updateLocalBalance === 'function') {
                                window.WinixCore.updateLocalBalance(
                                    response.data.coins,
                                    'sync-service',
                                    true // Підтверджено сервером
                                );
                            } else {
                                // Якщо WinixCore недоступний, оновлюємо самостійно
                                this._legacyUpdateBalanceData(response.data);
                            }

                            console.log('✅ SyncService: Баланс успішно синхронізовано через API');
                            return true;
                        } else {
                            console.warn('⚠️ SyncService: Помилка синхронізації балансу через API:', response?.message);
                            return false;
                        }
                    } else {
                        console.warn('⚠️ SyncService: API для синхронізації балансу недоступний');
                        return false;
                    }
                } catch (error) {
                    handleSyncError(error, 'syncBalance', { force });
                    return false;
                }
            });
        },

        // Застарілий метод оновлення даних балансу
        // Використовується тільки якщо WinixCore недоступний
        _legacyUpdateBalanceData: function(data) {
            if (!data) return;
            console.log("⚠️ SyncService: Використовується застарілий метод оновлення балансу. Рекомендуємо оновити до WinixCore.");

            // Оновлюємо локальні сховища
            if (data.coins !== undefined) {
                const oldCoins = parseInt(localStorage.getItem('userCoins') || '0');
                const newCoins = data.coins;

                // Логуємо зміну балансу
                if (oldCoins !== newCoins) {
                    console.log(`💰 SyncService: Оновлення балансу жетонів: ${oldCoins} -> ${newCoins}, різниця: ${newCoins - oldCoins}`);
                }

                localStorage.setItem('userCoins', newCoins.toString());
                localStorage.setItem('winix_coins', newCoins.toString());
                localStorage.setItem('winix_server_sync_ts', Date.now().toString());

                // Оновлюємо відображення в інтерфейсі
                const userCoinsElement = document.getElementById('user-coins');
                if (userCoinsElement) {
                    // Анімація зміни балансу
                    if (newCoins > oldCoins) {
                        userCoinsElement.classList.add('increasing');
                        setTimeout(() => userCoinsElement.classList.remove('increasing'), 1000);
                    } else if (newCoins < oldCoins) {
                        userCoinsElement.classList.add('decreasing');
                        setTimeout(() => userCoinsElement.classList.remove('decreasing'), 1000);
                    }

                    userCoinsElement.textContent = newCoins;
                }

                // Генеруємо подію оновлення балансу
                document.dispatchEvent(new CustomEvent('balance-updated', {
                    detail: {
                        oldBalance: oldCoins,
                        newBalance: newCoins,
                        source: 'sync-service-legacy',
                        timestamp: Date.now()
                    }
                }));
            }

            if (data.balance !== undefined) {
                const newBalance = data.balance;
                localStorage.setItem('userTokens', newBalance.toString());
                localStorage.setItem('winix_balance', newBalance.toString());

                // Оновлюємо відображення в інтерфейсі
                const userTokensElement = document.getElementById('user-tokens');
                if (userTokensElement) {
                    userTokensElement.textContent = newBalance;
                }
            }

            // Оновлюємо час оновлення балансу
            localStorage.setItem('winix_balance_update_time', Date.now().toString());
        },

        // Синхронізація участі в розіграшах
        syncParticipation: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.participation < this.syncIntervals.participation) {
                console.log('⏱️ SyncService: Пропуск синхронізації участі (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('participation', async () => {
                console.log('🎟️ SyncService: Синхронізація даних про участь...');

                try {
                    // Перевіряємо наявність модуля участі
                    if (!window.WinixRaffles || !window.WinixRaffles.participation) {
                        console.warn('⚠️ SyncService: Модуль участі недоступний');
                        return false;
                    }

                    // Перевіряємо чи є функція завантаження участі
                    if (typeof window.WinixRaffles.loadUserParticipation === 'function') {
                        const result = await window.WinixRaffles.loadUserParticipation(force);

                        if (result && result.success) {
                            // Оновлюємо час синхронізації
                            this.lastSync.participation = Date.now();
                            console.log('✅ SyncService: Дані про участь успішно синхронізовано');
                            return true;
                        } else {
                            console.warn('⚠️ SyncService: Помилка синхронізації даних участі:', result?.message);
                            return false;
                        }
                    } else if (window.WinixRaffles.participation && typeof window.WinixRaffles.participation.loadUserRaffles === 'function') {
                        // Альтернативний метод
                        const result = await window.WinixRaffles.participation.loadUserRaffles(force);

                        if (result && result.success) {
                            // Оновлюємо час синхронізації
                            this.lastSync.participation = Date.now();
                            console.log('✅ SyncService: Дані про участь успішно синхронізовано через альтернативний метод');
                            return true;
                        } else {
                            console.warn('⚠️ SyncService: Помилка синхронізації даних участі через альтернативний метод:', result?.message);
                            return false;
                        }
                    } else {
                        console.warn('⚠️ SyncService: Метод завантаження даних участі недоступний');
                        return false;
                    }
                } catch (error) {
                    handleSyncError(error, 'syncParticipation', { force });
                    return false;
                }
            });
        },

        // Синхронізація статистики
        syncStatistics: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.statistics < this.syncIntervals.statistics) {
                console.log('⏱️ SyncService: Пропуск синхронізації статистики (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('statistics', async () => {
                console.log('📊 SyncService: Синхронізація статистики...');

                try {
                    // Перевіряємо наявність модуля статистики
                    if (!window.WinixRaffles || !window.WinixRaffles.statistics) {
                        console.warn('⚠️ SyncService: Модуль статистики недоступний');
                        return false;
                    }

                    // Перевіряємо, чи поточна вкладка - статистика
                    const statsTab = document.querySelector('.tab-button[data-tab="stats"]');
                    const isStatsActive = statsTab && statsTab.classList.contains('active');

                    // Завантажуємо статистику з примусовим оновленням
                    if (isStatsActive || force) {
                        if (typeof window.WinixRaffles.statistics.loadStatistics === 'function') {
                            const result = await window.WinixRaffles.statistics.loadStatistics(force);

                            if (result && result.success) {
                                // Оновлюємо час синхронізації
                                this.lastSync.statistics = Date.now();
                                console.log('✅ SyncService: Статистика успішно синхронізована');
                                return true;
                            } else {
                                console.warn('⚠️ SyncService: Помилка синхронізації статистики:', result?.message);
                                return false;
                            }
                        } else {
                            console.warn('⚠️ SyncService: Метод завантаження статистики недоступний');
                            return false;
                        }
                    } else {
                        console.log('⏩ SyncService: Пропуск синхронізації статистики (неактивна вкладка)');
                        return false;
                    }
                } catch (error) {
                    handleSyncError(error, 'syncStatistics', { force });
                    return false;
                }
            });
        },

        // Синхронізація даних розіграшів
        syncRaffles: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.raffles < this.syncIntervals.raffles) {
                console.log('⏱️ SyncService: Пропуск синхронізації розіграшів (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('raffles', async () => {
                console.log('🎮 SyncService: Синхронізація даних розіграшів...');

                try {
                    // Перевіряємо наявність модуля активних розіграшів
                    if (!window.WinixRaffles) {
                        console.warn('⚠️ SyncService: Модуль WinixRaffles недоступний');
                        return false;
                    }

                    // Перевіряємо, чи поточна вкладка - активні розіграші
                    const activeTab = document.querySelector('.tab-button[data-tab="active"]');
                    const isActiveTabActive = activeTab && activeTab.classList.contains('active');

                    // Завантажуємо розіграші з примусовим оновленням
                    if (isActiveTabActive || force) {
                        if (window.WinixRaffles.active && typeof window.WinixRaffles.active.loadActiveRaffles === 'function') {
                            const result = await window.WinixRaffles.active.loadActiveRaffles(force);

                            if (result && result.success) {
                                // Оновлюємо час синхронізації
                                this.lastSync.raffles = Date.now();
                                console.log('✅ SyncService: Дані розіграшів успішно синхронізовано');
                                return true;
                            } else {
                                console.warn('⚠️ SyncService: Помилка синхронізації розіграшів через active:', result?.message);
                                return false;
                            }
                        } else if (typeof window.WinixRaffles.loadActiveRaffles === 'function') {
                            // Альтернативний метод
                            const result = await window.WinixRaffles.loadActiveRaffles(force);

                            if (result && result.success) {
                                // Оновлюємо час синхронізації
                                this.lastSync.raffles = Date.now();
                                console.log('✅ SyncService: Дані розіграшів успішно синхронізовано через основний модуль');
                                return true;
                            } else {
                                console.warn('⚠️ SyncService: Помилка синхронізації розіграшів:', result?.message);
                                return false;
                            }
                        } else {
                            console.warn('⚠️ SyncService: Метод завантаження розіграшів недоступний');
                            return false;
                        }
                    } else {
                        console.log('⏩ SyncService: Пропуск синхронізації розіграшів (неактивна вкладка)');
                        return false;
                    }
                } catch (error) {
                    handleSyncError(error, 'syncRaffles', { force });
                    return false;
                }
            });
        },

        // Додавання запиту в чергу синхронізації
        _addToSyncQueue: function(type, syncFunction) {
            return new Promise((resolve, reject) => {
                // Створюємо об'єкт запиту
                const syncRequest = {
                    type: type,
                    function: syncFunction,
                    resolve: resolve,
                    reject: reject,
                    timestamp: Date.now()
                };

                // Додаємо запит в чергу
                this.syncQueue.push(syncRequest);

                // Запускаємо обробку черги, якщо вона ще не запущена
                if (!this.isSyncing) {
                    this._processSyncQueue();
                }
            });
        },

        // Обробка черги синхронізації
        _processSyncQueue: async function() {
            if (this.isSyncing || this.syncQueue.length === 0) {
                return;
            }

            this.isSyncing = true;

            try {
                // Беремо перший запит з черги
                const nextSync = this.syncQueue.shift();

                // Виконуємо функцію синхронізації
                const result = await nextSync.function();

                // Вирішуємо проміс
                nextSync.resolve(result);
            } catch (error) {
                handleSyncError(error, '_processSyncQueue');

                // Відхиляємо проміс для поточного запиту
                if (this.syncQueue.length > 0) {
                    this.syncQueue[0].reject(error);
                    this.syncQueue.shift();
                }
            } finally {
                this.isSyncing = false;

                // Продовжуємо обробку черги, якщо в ній ще є запити
                if (this.syncQueue.length > 0) {
                    setTimeout(() => {
                        this._processSyncQueue();
                    }, 500); // Невелика затримка між запитами
                }
            }
        },

        // Отримання поточного стану синхронізації
        getState: function() {
            return {
                lastSync: {...this.lastSync},
                isSyncing: this.isSyncing,
                queueLength: this.syncQueue.length
            };
        },

        // Очищення стану
        reset: function() {
            console.log('🔄 SyncService: Скидання стану...');

            // Зупиняємо фоновий процес синхронізації
            this.stopBackgroundSync();

            // Очищаємо чергу
            this.syncQueue = [];
            this.isSyncing = false;

            // Скидаємо час останньої синхронізації
            this.lastSync = {
                balance: 0,
                participation: 0,
                statistics: 0,
                raffles: 0
            };

            console.log('✅ SyncService: Стан скинуто');
        }
    };

    // Додаємо сервіс синхронізації до головного модуля розіграшів
    window.WinixRaffles.syncService = syncService;

    // Ініціалізуємо сервіс при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        // Перевіряємо, чи не ініціалізований WinixCore ще
        if (hasWinixCore()) {
            // Якщо WinixCore ініціалізований, просто запускаємо sync-service
            if (window.WinixCore.isInitialized && window.WinixCore.isInitialized()) {
                syncService.init();
            } else {
                // Якщо WinixCore ще не ініціалізований, чекаємо на його ініціалізацію
                window.WinixCore.registerEventHandler('core-initialized', function() {
                    console.log('🔄 SyncService: Отримано подію ініціалізації WinixCore');
                    syncService.init();
                }, { source: 'sync-service.js', once: true });
            }
        } else if (window.WinixRaffles.state && window.WinixRaffles.state.isInitialized) {
            // Якщо WinixCore недоступний, але WinixRaffles ініціалізований
            syncService.init();
        } else {
            // Якщо WinixRaffles ще не ініціалізований, чекаємо на його ініціалізацію
            document.addEventListener('winix-raffles-initialized', function() {
                syncService.init();
            });
        }
    });

    // Очищення ресурсів перед закриттям сторінки
    window.addEventListener('beforeunload', function() {
        if (syncService.syncInterval) {
            clearInterval(syncService.syncInterval);
        }
    });

    console.log('✅ Модуль сервісу синхронізації успішно завантажено (v1.2.0)');
})();