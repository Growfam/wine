/**
 * WINIX - Централізований сервіс синхронізації даних
 * Цей файл потрібно додати у директорію frontend/js/raffles/utils/
 * Назва файлу: sync-service.js
 * @version 1.1.0
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
                   typeof window.WinixCore.syncUserData === 'function';
        } catch (e) {
            console.error("❌ Помилка перевірки WinixCore:", e);
            return false;
        }
    };

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

        // Ініціалізація сервісу
        init: function() {
            console.log('🔄 Ініціалізація сервісу синхронізації даних WINIX...');

            // Додаємо обробники подій
            this._setupEventListeners();

            // Запускаємо фоновий процес синхронізації
            this._startBackgroundSync();

            console.log('✅ Сервіс синхронізації даних успішно ініціалізовано');
        },

        // Налаштування обробників подій
        _setupEventListeners: function() {
            // Синхронізація після успішної участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    // Оновлюємо баланс та участь негайно
                    this.syncBalance(true);
                    this.syncParticipation(true);

                    // Відкладаємо оновлення статистики для зменшення навантаження
                    setTimeout(() => {
                        this.syncStatistics(true);
                    }, 1000);
                }
            });

            // Синхронізація при поверненні на сторінку
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.syncAll(false); // Не примусово, тільки якщо минув час інтервалу
                }
            });

            // Синхронізація при переключенні вкладок
            document.querySelectorAll('.tab-button').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.getAttribute('data-tab');
                    if (tabName === 'active') {
                        this.syncParticipation(false);
                    } else if (tabName === 'stats') {
                        this.syncStatistics(true); // Примусово синхронізуємо статистику при переході на вкладку
                    }
                });
            });
        },

        // Запуск фонового процесу синхронізації
        _startBackgroundSync: function() {
            // Запускаємо першу синхронізацію через 5 секунд після завантаження
            setTimeout(() => {
                this.syncAll(true);
            }, 5000);

            // Регулярна перевірка необхідності синхронізації
            setInterval(() => {
                const now = Date.now();

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
        },

        // Синхронізація всіх даних
        syncAll: function(force = false) {
            console.log('🔄 Запуск повної синхронізації даних' + (force ? ' (примусово)' : ''));

            // Відкладаємо запити з інтервалом для зменшення навантаження
            this.syncBalance(force);

            setTimeout(() => {
                this.syncParticipation(force);
            }, 1000);

            setTimeout(() => {
                this.syncRaffles(force);
            }, 2000);

            setTimeout(() => {
                this.syncStatistics(force);
            }, 3000);
        },

        // Синхронізація балансу
        syncBalance: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.balance < this.syncIntervals.balance) {
                console.log('⏱️ Пропуск синхронізації балансу (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Перевіряємо блокування балансу в WinixCore
            if (hasWinixCore() && window.WinixCore.isBalanceUpdateLocked && window.WinixCore.isBalanceUpdateLocked()) {
                if (!force) {
                    console.log('🔒 Пропуск синхронізації балансу (баланс заблоковано)');
                    return Promise.resolve(false);
                } else {
                    console.log('⚠️ Примусова синхронізація балансу попри блокування');
                }
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('balance', async () => {
                console.log('💰 Синхронізація балансу...');

                try {
                    // Використовуємо WinixCore для оновлення балансу, якщо доступний
                    if (hasWinixCore()) {
                        const response = await window.WinixCore.refreshBalance(force);

                        if (response && response.success) {
                            // Оновлюємо час синхронізації
                            this.lastSync.balance = Date.now();
                            console.log('✅ Баланс успішно синхронізовано через WinixCore');
                            return true;
                        } else {
                            console.warn('⚠️ Помилка синхронізації балансу через WinixCore:', response?.message);
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

                            console.log('✅ Баланс успішно синхронізовано через API');
                            return true;
                        } else {
                            console.warn('⚠️ Помилка синхронізації балансу через API:', response?.message);
                            return false;
                        }
                    } else {
                        console.warn('⚠️ API для синхронізації балансу недоступний');
                        return false;
                    }
                } catch (error) {
                    console.error('❌ Помилка синхронізації балансу:', error);
                    return false;
                }
            });
        },

        // Застарілий метод оновлення даних балансу
        // Використовується тільки якщо WinixCore недоступний
        _legacyUpdateBalanceData: function(data) {
            if (!data) return;
            console.log("⚠️ Використовується застарілий метод оновлення балансу. Рекомендуємо оновити до WinixCore.");

            // Оновлюємо локальні сховища
            if (data.coins !== undefined) {
                const oldCoins = parseInt(localStorage.getItem('userCoins') || '0');
                const newCoins = data.coins;

                // Логуємо зміну балансу
                if (oldCoins !== newCoins) {
                    console.log(`💰 sync-service: Оновлення балансу жетонів: ${oldCoins} -> ${newCoins}, різниця: ${newCoins - oldCoins}`);
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
                console.log('⏱️ Пропуск синхронізації участі (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('participation', async () => {
                console.log('🎟️ Синхронізація даних про участь...');

                try {
                    // Перевіряємо наявність модуля участі
                    if (!window.WinixRaffles || !window.WinixRaffles.participation) {
                        console.warn('⚠️ Модуль участі недоступний');
                        return false;
                    }

                    // Використовуємо метод завантаження з примусовим оновленням
                    await window.WinixRaffles.participation.loadUserRaffles(true);

                    // Оновлюємо час синхронізації
                    this.lastSync.participation = Date.now();

                    // Оновлюємо відображення кнопок участі
                    window.WinixRaffles.participation.updateParticipationButtons();

                    console.log('✅ Дані про участь успішно синхронізовано');
                    return true;
                } catch (error) {
                    console.error('❌ Помилка синхронізації участі:', error);
                    return false;
                }
            });
        },

        // Синхронізація статистики
        syncStatistics: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.statistics < this.syncIntervals.statistics) {
                console.log('⏱️ Пропуск синхронізації статистики (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('statistics', async () => {
                console.log('📊 Синхронізація статистики...');

                try {
                    // Перевіряємо наявність модуля статистики
                    if (!window.WinixRaffles || !window.WinixRaffles.statistics) {
                        console.warn('⚠️ Модуль статистики недоступний');
                        return false;
                    }

                    // Перевіряємо, чи поточна вкладка - статистика
                    const statsTab = document.querySelector('.tab-button[data-tab="stats"]');
                    const isStatsActive = statsTab && statsTab.classList.contains('active');

                    // Завантажуємо статистику з примусовим оновленням
                    if (isStatsActive || force) {
                        window.WinixRaffles.statistics.loadStatistics(true);
                    }

                    // Оновлюємо час синхронізації
                    this.lastSync.statistics = Date.now();

                    console.log('✅ Статистика успішно синхронізована');
                    return true;
                } catch (error) {
                    console.error('❌ Помилка синхронізації статистики:', error);
                    return false;
                }
            });
        },

        // Синхронізація даних розіграшів
        syncRaffles: function(force = false) {
            const now = Date.now();

            // Перевіряємо необхідність синхронізації
            if (!force && now - this.lastSync.raffles < this.syncIntervals.raffles) {
                console.log('⏱️ Пропуск синхронізації розіграшів (недавно оновлено)');
                return Promise.resolve(false);
            }

            // Додаємо запит в чергу
            return this._addToSyncQueue('raffles', async () => {
                console.log('🎮 Синхронізація даних розіграшів...');

                try {
                    // Перевіряємо наявність модуля активних розіграшів
                    if (!window.WinixRaffles || !window.WinixRaffles.active) {
                        console.warn('⚠️ Модуль активних розіграшів недоступний');
                        return false;
                    }

                    // Перевіряємо, чи поточна вкладка - активні розіграші
                    const activeTab = document.querySelector('.tab-button[data-tab="active"]');
                    const isActiveTabActive = activeTab && activeTab.classList.contains('active');

                    // Завантажуємо розіграші з примусовим оновленням
                    if (isActiveTabActive || force) {
                        await window.WinixRaffles.active.loadActiveRaffles(true);
                    }

                    // Оновлюємо час синхронізації
                    this.lastSync.raffles = Date.now();

                    console.log('✅ Дані розіграшів успішно синхронізовано');
                    return true;
                } catch (error) {
                    console.error('❌ Помилка синхронізації розіграшів:', error);
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
                console.error('❌ Помилка обробки черги синхронізації:', error);

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
        }
    };

    // Додаємо сервіс синхронізації до головного модуля розіграшів
    window.WinixRaffles.syncService = syncService;

    // Ініціалізуємо сервіс при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (window.WinixRaffles.state.isInitialized) {
            syncService.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                syncService.init();
            });
        }
    });

    console.log('✅ Модуль сервісу синхронізації успішно завантажено');
})();