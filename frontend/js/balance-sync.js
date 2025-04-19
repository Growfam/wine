/**
 * WINIX - Система синхронізації балансу
 * Допоміжний модуль для вирішення проблем з розсинхронізацією балансу жетонів
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Запобігаємо подвійній ініціалізації
    if (window.WinixBalanceSync) {
        console.log("🔄 Модуль синхронізації балансу вже ініціалізовано");
        return;
    }

    // Створюємо модуль синхронізації балансу
    window.WinixBalanceSync = {
        // Поточні дані про баланс
        currentBalance: null,
        lastUpdateTime: 0,
        updateRequests: 0,
        pendingSync: false,
        syncQueue: [],
        syncInterval: null,
        syncThrottleTimeout: null,

        // Ініціалізація модуля
        init: function() {
            console.log("🔄 Ініціалізація модуля синхронізації балансу");

            // Отримуємо поточний баланс
            this.loadInitialBalance();

            // Налаштовуємо обробники подій
            this.setupEventListeners();

            // Запускаємо періодичну синхронізацію
            this.startPeriodicSync();

            console.log("✅ Модуль синхронізації балансу успішно ініціалізовано");
        },

        // Завантаження початкового балансу
        loadInitialBalance: function() {
            try {
                // Спочатку пробуємо отримати з DOM
                const coinsElement = document.getElementById('user-coins');
                if (coinsElement) {
                    this.currentBalance = parseInt(coinsElement.textContent) || 0;
                } else {
                    // Інакше з localStorage
                    this.currentBalance = parseInt(localStorage.getItem('userCoins') ||
                                                 localStorage.getItem('winix_coins')) || 0;
                }

                this.lastUpdateTime = Date.now();
                console.log(`📊 Початковий баланс: ${this.currentBalance} жетонів`);
            } catch (error) {
                console.warn("⚠️ Помилка завантаження початкового балансу:", error);
                this.currentBalance = 0;
            }
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник події оновлення балансу
            document.addEventListener('balance-updated', (event) => {
                if (event.detail && typeof event.detail.newBalance === 'number') {
                    this.processBalanceUpdate(
                        event.detail.newBalance,
                        event.detail.source || 'unknown',
                        event.detail.timestamp || Date.now()
                    );
                }
            });

            // Обробник події оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData &&
                    typeof event.detail.userData.coins === 'number') {

                    this.processBalanceUpdate(
                        event.detail.userData.coins,
                        event.detail.source || 'user-data',
                        event.detail.userData.last_update || Date.now()
                    );
                }
            });

            // Обробник для події участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    // Через 1 секунду після успішної участі синхронізуємо баланс
                    setTimeout(() => {
                        this.syncServerBalance();
                    }, 1000);
                }
            });

            // Обробник зміни видимості вкладки
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    console.log("🔄 Вкладка стала видимою, синхронізуємо баланс");
                    this.syncServerBalance();
                }
            });
        },

        // Обробка оновлення балансу
        processBalanceUpdate: function(newBalance, source, timestamp) {
            // Запобігаємо невалідним значенням
            if (typeof newBalance !== 'number' || isNaN(newBalance)) {
                console.warn(`⚠️ Отримано невалідне значення балансу: ${newBalance}`);
                return;
            }

            // Якщо джерело - сервер, завжди приймаємо нове значення
            const isServerSource = source === 'server' || source === 'api';

            // Перевіряємо, чи змінився баланс і чи це свіжіші дані
            if (newBalance !== this.currentBalance || isServerSource) {
                console.log(`📊 Оновлення балансу: ${this.currentBalance} -> ${newBalance} (джерело: ${source})`);

                // Запам'ятовуємо старе значення для анімації
                const oldBalance = this.currentBalance;

                // Оновлюємо поточне значення
                this.currentBalance = newBalance;
                this.lastUpdateTime = timestamp || Date.now();

                // Оновлюємо відображення
                this.updateBalanceDisplay(oldBalance, newBalance);

                // Якщо це не запит із сервера, запланувати синхронізацію
                if (!isServerSource) {
                    this.throttleSyncRequest();
                }
            }
        },

        // Обмеження частоти запитів синхронізації
        throttleSyncRequest: function() {
            if (this.syncThrottleTimeout) {
                clearTimeout(this.syncThrottleTimeout);
            }

            this.syncThrottleTimeout = setTimeout(() => {
                this.syncServerBalance();
                this.syncThrottleTimeout = null;
            }, 3000); // Затримка 3 секунди перед синхронізацією
        },

        // Оновлення відображення балансу з анімацією
        updateBalanceDisplay: function(oldBalance, newBalance) {
            const coinsElement = document.getElementById('user-coins');
            if (!coinsElement) return;

            // Оновлюємо текст
            coinsElement.textContent = newBalance;

            // Додаємо анімацію в залежності від зміни
            if (newBalance < oldBalance) {
                coinsElement.classList.remove('increasing');
                coinsElement.classList.add('decreasing');
                setTimeout(() => {
                    coinsElement.classList.remove('decreasing');
                }, 1000);
            } else if (newBalance > oldBalance) {
                coinsElement.classList.remove('decreasing');
                coinsElement.classList.add('increasing');
                setTimeout(() => {
                    coinsElement.classList.remove('increasing');
                }, 1000);
            }

            // Оновлюємо localStorage
            localStorage.setItem('userCoins', newBalance.toString());
            localStorage.setItem('winix_coins', newBalance.toString());
            localStorage.setItem('winix_balance_update_time', Date.now().toString());
        },

        // Запуск періодичної синхронізації
        startPeriodicSync: function() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }

            // Синхронізуємо кожні 2 хвилини
            this.syncInterval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    this.syncServerBalance();
                }
            }, 2 * 60 * 1000);
        },

        // Синхронізація балансу з сервером
        syncServerBalance: async function() {
            // Не запускаємо паралельні синхронізації
            if (this.pendingSync) return;

            this.pendingSync = true;
            this.updateRequests++;

            try {
                console.log("🔄 Синхронізація балансу з сервером...");

                // Отримуємо баланс через API
                if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                    const response = await window.WinixAPI.getBalance();

                    if (response && response.status === 'success' && response.data) {
                        const serverBalance = response.data.coins;

                        // Генеруємо подію про оновлення з сервера
                        document.dispatchEvent(new CustomEvent('balance-updated', {
                            detail: {
                                oldBalance: this.currentBalance,
                                newBalance: serverBalance,
                                source: 'server',
                                timestamp: Date.now()
                            }
                        }));

                        console.log(`✅ Синхронізацію завершено: ${serverBalance} жетонів`);
                    }
                } else {
                    console.warn("⚠️ API недоступне для синхронізації балансу");
                }
            } catch (error) {
                console.error("❌ Помилка синхронізації балансу:", error);
            } finally {
                this.pendingSync = false;
            }
        },

        // Отримання поточного балансу
        getBalance: function() {
            return this.currentBalance;
        },

        // Форсоване оновлення балансу
        forceUpdate: function() {
            this.syncServerBalance();
        }
    };

    // Ініціалізуємо модуль при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', () => {
        // Відкладаємо ініціалізацію для впевненості, що інші модулі завантажаться
        setTimeout(() => {
            window.WinixBalanceSync.init();
        }, 500);
    });

    // Якщо сторінка вже завантажена, ініціалізуємо зараз
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            window.WinixBalanceSync.init();
        }, 500);
    }
})();