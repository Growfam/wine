/**
 * Головний інтеграційний модуль для системи завдань WINIX
 * СПРОЩЕНА ВЕРСІЯ V3 - використовує balance/coins напряму без конвертації
 * ПОВНІСТЮ ВИПРАВЛЕНА ВЕРСІЯ
 */
window.TasksIntegration = (function() {
    'use strict';

    console.log('📦 [TASKS-INTEGRATION] Завантаження модуля TasksIntegration...');

    function TasksIntegration() {
        console.log('🏗️ [TASKS-INTEGRATION] Створення екземпляру TasksIntegration');
        this.userId = null;
        this.store = null;
        this.isInitialized = false;
        this.managers = {};
        console.log('✅ [TASKS-INTEGRATION] Екземпляр створено:', this);
    }

    /**
     * Ініціалізація системи завдань
     */
    TasksIntegration.prototype.init = function() {
        var self = this;
        console.log('🚀 [TASKS-INTEGRATION] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ =====');
        console.log('🕐 [TASKS-INTEGRATION] Час початку:', new Date().toISOString());

        return new Promise(function(resolve, reject) {
            try {
                console.log('🔍 [TASKS-INTEGRATION] Крок 1: Отримання ID користувача...');

                // Отримуємо ID користувача
                self.userId = self.getUserId();
                console.log('📊 [TASKS-INTEGRATION] Результат getUserId:', {
                    userId: self.userId,
                    type: typeof self.userId,
                    isValid: !!self.userId
                });

                if (!self.userId) {
                    var error = new Error('Не вдалося отримати ID користувача. Переконайтеся, що ви авторизовані.');
                    console.error('❌ [TASKS-INTEGRATION] КРИТИЧНА ПОМИЛКА: ID користувача відсутній');
                    self.showErrorMessage(error.message);
                    throw error;
                }

                console.log('✅ [TASKS-INTEGRATION] ID користувача успішно отримано:', self.userId);

                // Ініціалізуємо сховище
                console.log('🔧 [TASKS-INTEGRATION] Крок 2: Ініціалізація сховища...');
                self.initStore();

                // Ініціалізуємо UI
                console.log('🎨 [TASKS-INTEGRATION] Крок 3: Ініціалізація UI...');
                self.initUI()
                    .then(function() {
                        console.log('✅ [TASKS-INTEGRATION] UI успішно ініціалізовано');
                        console.log('📊 [TASKS-INTEGRATION] Крок 4: Завантаження початкових даних...');

                        // Завантажуємо початкові дані
                        return self.loadInitialData();
                    })
                    .then(function() {
                        console.log('✅ [TASKS-INTEGRATION] Початкові дані завантажено');
                        console.log('🎯 [TASKS-INTEGRATION] Крок 5: Встановлення обробників подій...');

                        // Встановлюємо обробники подій
                        self.setupEventListeners();

                        // Ініціалізуємо менеджери
                        console.log('🔧 [TASKS-INTEGRATION] Крок 6: Ініціалізація менеджерів...');
                        self.initializeManagers();

                        self.isInitialized = true;
                        console.log('🎉 [TASKS-INTEGRATION] ===== ІНІЦІАЛІЗАЦІЯ ЗАВЕРШЕНА =====');
                        console.log('📊 [TASKS-INTEGRATION] Фінальний стан:', {
                            userId: self.userId,
                            storeInitialized: !!self.store,
                            isInitialized: self.isInitialized
                        });
                        resolve(self);
                    })
                    .catch(function(error) {
                        console.error('❌ [TASKS-INTEGRATION] Помилка під час ініціалізації');
                        console.error('❌ [TASKS-INTEGRATION] Деталі:', error);
                        self.showErrorMessage('Помилка ініціалізації: ' + error.message);
                        reject(error);
                    });
            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION] КРИТИЧНА ПОМИЛКА в блоці try-catch');
                console.error('❌ [TASKS-INTEGRATION] Деталі:', error);
                self.showErrorMessage('Критична помилка: ' + error.message);
                reject(error);
            }
        });
    };

    /**
     * Отримує ID користувача з різних джерел - ВИПРАВЛЕНО
     */
    TasksIntegration.prototype.getUserId = function() {
        console.log('🔍 [TASKS-INTEGRATION] === getUserId START ===');

        // Масив функцій для отримання ID з різних джерел
        var sources = [
            // 1. Telegram WebApp (найнадійніше)
            function() {
                if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                    return window.Telegram.WebApp.initDataUnsafe.user.id;
                }
                return null;
            },
            // 2. WinixAPI
            function() {
                if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
                    return window.WinixAPI.getUserId();
                }
                return null;
            },
            // 3. LocalStorage
            function() {
                return localStorage.getItem('telegram_user_id') || localStorage.getItem('user_id');
            },
            // 4. TasksAPI
            function() {
                if (window.TasksAPI && typeof window.TasksAPI.getUserId === 'function') {
                    return window.TasksAPI.getUserId();
                }
                return null;
            }
        ];

        // Перевіряємо кожне джерело
        for (var i = 0; i < sources.length; i++) {
            try {
                var id = sources[i]();
                console.log(`🔍 [TASKS-INTEGRATION] Джерело ${i + 1}:`, id);

                if (id && id !== 'undefined' && id !== 'null') {
                    var numericId = parseInt(id);
                    if (!isNaN(numericId) && numericId > 0) {
                        console.log('✅ [TASKS-INTEGRATION] ID знайдено:', numericId);
                        return numericId;
                    }
                }
            } catch (e) {
                console.warn(`⚠️ [TASKS-INTEGRATION] Помилка в джерелі ${i + 1}:`, e);
            }
        }

        console.error('❌ [TASKS-INTEGRATION] ID не знайдено!');
        return null;
    };

    /**
     * Ініціалізує Redux сховище (якщо доступне)
     */
    TasksIntegration.prototype.initStore = function() {
        console.log('🔧 [TASKS-INTEGRATION] === initStore START ===');

        // Перевіряємо чи є TasksStore
        if (window.TasksStore) {
            console.log('📊 [TASKS-INTEGRATION] TasksStore знайдено');
            this.store = window.TasksStore;

            // Підписуємося на зміни якщо є метод subscribe
            if (typeof this.store.subscribe === 'function') {
                var self = this;
                var unsubscribe = this.store.subscribe(function(state, prevState, action) {
                    console.log('🔄 [TASKS-INTEGRATION] Store state змінився:', action ? action.type : 'unknown');
                    self.handleStateChange(state, prevState, action);
                });

                console.log('✅ [TASKS-INTEGRATION] Підписка на зміни store встановлена');
            }
        } else {
            console.warn('⚠️ [TASKS-INTEGRATION] TasksStore недоступний, працюємо без нього');
        }

        console.log('✅ [TASKS-INTEGRATION] === initStore COMPLETE ===');
    };

    /**
     * Ініціалізує інтерфейс користувача
     */
    TasksIntegration.prototype.initUI = function() {
        var self = this;
        console.log('🎨 [TASKS-INTEGRATION] === initUI START ===');

        return new Promise(function(resolve, reject) {
            try {
                // Встановлюємо ID користувача в заголовку
                console.log('🎨 [TASKS-INTEGRATION] Крок 1: Встановлення ID в заголовку...');
                self.setUserIdInHeader();

                // Показуємо поточну вкладку
                console.log('🎨 [TASKS-INTEGRATION] Крок 2: Показуємо початкову вкладку...');
                self.showTab('flex'); // Flex як основна вкладка

                console.log('✅ [TASKS-INTEGRATION] === initUI SUCCESS ===');
                resolve();
            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION] === initUI FAILED ===');
                console.error('❌ [TASKS-INTEGRATION] Помилка:', error);
                reject(error);
            }
        });
    };

    /**
     * Встановлює ID користувача в заголовку
     */
    TasksIntegration.prototype.setUserIdInHeader = function() {
        console.log('🏷️ [TASKS-INTEGRATION] === setUserIdInHeader START ===');

        var userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
        console.log('📊 [TASKS-INTEGRATION] Знайдено елементів для ID:', userIdElements.length);

        var self = this;
        userIdElements.forEach(function(element, index) {
            if (element) {
                var value = self.userId || 'Не визначено';
                console.log('🏷️ [TASKS-INTEGRATION] Встановлення ID в елемент ' + index + ':', {
                    element: element,
                    oldValue: element.textContent,
                    newValue: value
                });
                element.textContent = value;
            }
        });

        console.log('✅ [TASKS-INTEGRATION] === setUserIdInHeader COMPLETE ===');
    };

    /**
     * Ініціалізує менеджери завдань - ПОВНІСТЮ ВИПРАВЛЕНО
     */
    TasksIntegration.prototype.initializeManagers = function() {
        console.log('🔧 [TASKS-INTEGRATION] === initializeManagers START ===');

        var self = this;

        // FlexEarnManager
        if (window.FlexEarnManager) {
            console.log('💎 [TASKS-INTEGRATION] Ініціалізація FlexEarnManager...');
            try {
                this.managers.flexEarn = window.FlexEarnManager;
                this.managers.flexEarn.init(this.userId);
                console.log('✅ [TASKS-INTEGRATION] FlexEarnManager ініціалізовано');
            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації FlexEarnManager:', error);
            }
        }

        // DailyBonusManager
        if (window.DailyBonusManager) {
            console.log('📅 [TASKS-INTEGRATION] Ініціалізація DailyBonusManager...');
            try {
                this.managers.dailyBonus = window.DailyBonusManager;
                this.managers.dailyBonus.init(this.userId);
                console.log('✅ [TASKS-INTEGRATION] DailyBonusManager ініціалізовано');
            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації DailyBonusManager:', error);
            }
        }

        // TasksManager - ВИПРАВЛЕНО для правильної async обробки
        if (window.TasksManager) {
            console.log('📋 [TASKS-INTEGRATION] Ініціалізація TasksManager...');
            console.log('📋 [TASKS-INTEGRATION] Передаємо userId:', this.userId);

            // Перевіряємо чи userId валідний
            if (!this.userId) {
                console.error('❌ [TASKS-INTEGRATION] userId відсутній для TasksManager!');
                return;
            }

            try {
                this.managers.tasks = window.TasksManager;

                // TasksManager.init() повертає Promise
                var initPromise = this.managers.tasks.init(this.userId);

                // Перевіряємо чи це Promise
                if (initPromise && typeof initPromise.then === 'function') {
                    initPromise
                        .then(function() {
                            console.log('✅ [TASKS-INTEGRATION] TasksManager повністю ініціалізовано!');

                            // ВАЖЛИВО: Форсуємо оновлення UI після ініціалізації
                            setTimeout(function() {
                                console.log('🔄 [TASKS-INTEGRATION] Форсуємо оновлення UI завдань');
                                if (self.managers.tasks && self.managers.tasks.updateTasksUI) {
                                    self.managers.tasks.updateTasksUI();
                                }

                                // Додатково перевіряємо стан
                                var tasksState = window.TasksStore?.getState()?.tasks;
                                console.log('📋 [TASKS-INTEGRATION] Стан завдань після ініціалізації:', {
                                    social: Object.keys(tasksState?.social || {}).length,
                                    limited: Object.keys(tasksState?.limited || {}).length,
                                    partner: Object.keys(tasksState?.partner || {}).length,
                                    daily: Object.keys(tasksState?.daily || {}).length
                                });
                            }, 500);
                        })
                        .catch(function(error) {
                            console.error('❌ [TASKS-INTEGRATION] Помилка async ініціалізації TasksManager:', error);
                            console.error('❌ [TASKS-INTEGRATION] Stack trace:', error.stack);
                        });
                } else {
                    console.log('⚠️ [TASKS-INTEGRATION] TasksManager.init() не повернув Promise');
                    console.log('✅ [TASKS-INTEGRATION] TasksManager ініціалізовано (sync)');

                    // Форсуємо оновлення UI
                    setTimeout(function() {
                        if (self.managers.tasks && self.managers.tasks.updateTasksUI) {
                            self.managers.tasks.updateTasksUI();
                        }
                    }, 500);
                }

            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION] Критична помилка ініціалізації TasksManager:', error);
                console.error('❌ [TASKS-INTEGRATION] Error details:', {
                    message: error.message,
                    stack: error.stack,
                    userId: this.userId,
                    hasTasksManager: !!window.TasksManager
                });
            }
        } else {
            console.error('❌ [TASKS-INTEGRATION] window.TasksManager НЕ ЗНАЙДЕНО!');
        }

        // WalletChecker
        if (window.WalletChecker) {
            console.log('👛 [TASKS-INTEGRATION] Ініціалізація WalletChecker...');
            try {
                this.managers.wallet = window.WalletChecker;
                this.managers.wallet.init(this.userId);
                console.log('✅ [TASKS-INTEGRATION] WalletChecker ініціалізовано');
            } catch (error) {
                console.error('❌ [TASKS-INTEGRATION] Помилка ініціалізації WalletChecker:', error);
            }
        }

        console.log('✅ [TASKS-INTEGRATION] === initializeManagers COMPLETE ===');
        console.log('📋 [TASKS-INTEGRATION] Фінальний стан менеджерів:', {
            flexEarn: !!this.managers.flexEarn,
            dailyBonus: !!this.managers.dailyBonus,
            tasks: !!this.managers.tasks,
            wallet: !!this.managers.wallet
        });
    };

    /**
     * Завантажує початкові дані - СПРОЩЕНА ВЕРСІЯ БЕЗ КОНВЕРТАЦІЇ
     */
    TasksIntegration.prototype.loadInitialData = function() {
        var self = this;
        console.log('📊 [TASKS-INTEGRATION] === loadInitialData START ===');

        // Завантажуємо дані паралельно
        var promises = [];

        // Профіль користувача
        if (window.TasksAPI && window.TasksAPI.user && window.TasksAPI.user.getProfile) {
            promises.push(
                window.TasksAPI.user.getProfile(this.userId)
                    .then(function(response) {
                        console.log('👤 [TASKS-INTEGRATION] Профіль отримано:', response);

                        if (response && response.status === 'success' && response.data) {
                            // Використовуємо дані напряму без конвертації
                            self.updateBalanceDisplay(response.data);

                            // Оновлюємо Store якщо є
                            if (window.TasksStore) {
                                window.TasksStore.actions.updateBalance(response.data);

                                // Оновлюємо дані користувача
                                const userData = {
                                    id: self.userId,
                                    telegramId: self.userId,
                                    username: response.data.username || 'User',
                                    balance: response.data
                                };
                                window.TasksStore.actions.setUser(userData);
                            }
                        }

                        return response;
                    })
                    .catch(function(error) {
                        console.error('❌ [TASKS-INTEGRATION] Помилка отримання профілю:', error);
                        // Встановлюємо дефолтні значення
                        self.updateBalanceDisplay({ balance: 0, coins: 0 });
                        return null;
                    })
            );
        }

        // Баланс користувача - окремий запит
        if (window.TasksAPI && window.TasksAPI.user && window.TasksAPI.user.getBalance) {
            promises.push(
                window.TasksAPI.user.getBalance(this.userId)
                    .then(function(response) {
                        console.log('💰 [TASKS-INTEGRATION] Баланс отримано:', response);

                        if (response && response.status === 'success' && response.data) {
                            // Використовуємо дані напряму
                            self.updateBalanceDisplay(response.data);

                            // Оновлюємо Store
                            if (window.TasksStore) {
                                window.TasksStore.actions.updateBalance(response.data);
                            }
                        }

                        return response;
                    })
                    .catch(function(error) {
                        console.error('❌ [TASKS-INTEGRATION] Помилка отримання балансу:', error);
                        return null;
                    })
            );
        }

        // Статус гаманця
        if (window.TasksAPI && window.TasksAPI.wallet && window.TasksAPI.wallet.checkStatus) {
            promises.push(
                window.TasksAPI.wallet.checkStatus(this.userId)
                    .then(function(response) {
                        console.log('👛 [TASKS-INTEGRATION] Статус гаманця:', response);

                        // Якщо гаманець підключений і є FLEX баланс
                        if (response.status === 'success' && response.data) {
                            if (response.data.balance && response.data.balance.flex !== undefined) {
                                // Оновлюємо FLEX баланс в Store
                                if (window.TasksStore) {
                                    window.TasksStore.actions.setFlexBalance(response.data.balance.flex);
                                }
                            }
                        }

                        return response;
                    })
                    .catch(function(error) {
                        console.error('❌ [TASKS-INTEGRATION] Помилка перевірки гаманця:', error);
                        return null;
                    })
            );
        }

        // Список завдань
        if (window.TasksAPI && window.TasksAPI.tasks && window.TasksAPI.tasks.getList) {
            promises.push(
                window.TasksAPI.tasks.getList(this.userId, 'all')
                    .then(function(response) {
                        console.log('📋 [TASKS-INTEGRATION] Завдання отримано:', response);
                        return response;
                    })
                    .catch(function(error) {
                        console.error('❌ [TASKS-INTEGRATION] Помилка отримання завдань:', error);
                        return null;
                    })
            );
        }

        // Запускаємо періодичне оновлення балансу
        this.startBalanceUpdates();

        return Promise.all(promises)
            .then(function(results) {
                console.log('✅ [TASKS-INTEGRATION] Початкові дані завантажено');
                console.log('📊 [TASKS-INTEGRATION] Результати:', results);
                return results;
            });
    };

    /**
     * Запуск періодичного оновлення балансу
     */
    TasksIntegration.prototype.startBalanceUpdates = function() {
        var self = this;
        console.log('⏰ [TASKS-INTEGRATION] Запуск періодичного оновлення балансу');

        // Оновлюємо баланс кожні 30 секунд
        setInterval(function() {
            if (self.userId && window.TasksAPI && window.TasksAPI.user && window.TasksAPI.user.getBalance) {
                window.TasksAPI.user.getBalance(self.userId)
                    .then(function(response) {
                        console.log('🔄 [TASKS-INTEGRATION] Періодичне оновлення балансу:', response);

                        if (response && response.status === 'success' && response.data) {
                            // Використовуємо дані напряму
                            self.updateBalanceDisplay(response.data);

                            // Оновлюємо Store
                            if (window.TasksStore) {
                                window.TasksStore.actions.updateBalance(response.data);
                            }
                        }
                    })
                    .catch(function(error) {
                        console.error('❌ [TASKS-INTEGRATION] Помилка періодичного оновлення:', error);
                    });
            }
        }, 30000); // 30 секунд
    };

    /**
     * Оновлює відображення балансу - ВИПРАВЛЕНА ВЕРСІЯ ДЛЯ ПРАВИЛЬНИХ ID
     */
    TasksIntegration.prototype.updateBalanceDisplay = function(data) {
        console.log('💰 [TASKS-INTEGRATION] === updateBalanceDisplay START ===');
        console.log('📊 [TASKS-INTEGRATION] Отримані дані:', data);

        if (!data) {
            console.warn('⚠️ [TASKS-INTEGRATION] Дані відсутні');
            return;
        }

        // Використовуємо дані напряму без конвертації
        var balance = parseInt(data.balance) || 0;
        var coins = parseInt(data.coins) || 0;

        // Оновлюємо Winix (balance) - використовуємо user-tokens
        var tokensElement = document.getElementById('user-tokens');
        if (tokensElement) {
            tokensElement.textContent = balance.toLocaleString();
            console.log('💎 [TASKS-INTEGRATION] Winix (balance) оновлено:', balance);
        } else {
            console.warn('⚠️ [TASKS-INTEGRATION] Елемент #user-tokens не знайдено');
        }

        // Оновлюємо Tickets (coins) - використовуємо user-coins
        var coinsElement = document.getElementById('user-coins');
        if (coinsElement) {
            coinsElement.textContent = coins.toLocaleString();
            console.log('🎟️ [TASKS-INTEGRATION] Tickets (coins) оновлено:', coins);
        } else {
            console.warn('⚠️ [TASKS-INTEGRATION] Елемент #user-coins не знайдено');
        }

        console.log('✅ [TASKS-INTEGRATION] === updateBalanceDisplay COMPLETE ===');
    };

    /**
     * Встановлює обробники подій
     */
    TasksIntegration.prototype.setupEventListeners = function() {
        console.log('🎯 [TASKS-INTEGRATION] === setupEventListeners START ===');

        var self = this;

        // Обробники вкладок
        var tabs = document.querySelectorAll('.main-tabs .tab-button');
        console.log('📑 [TASKS-INTEGRATION] Знайдено вкладок:', tabs.length);

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                var tabName = tab.getAttribute('data-tab');
                console.log('📑 [TASKS-INTEGRATION] Клік на вкладку:', tabName);
                self.showTab(tabName);
            });
        });

        // Глобальний обробник кліків (для динамічних елементів)
        document.addEventListener('click', function(event) {
            // Обробка кнопок завдань
            if (event.target.classList.contains('task-action-button')) {
                var taskId = event.target.getAttribute('data-task-id');
                var action = event.target.getAttribute('data-action');
                console.log('📋 [TASKS-INTEGRATION] Дія завдання:', action, 'ID:', taskId);
                self.handleTaskAction(taskId, action);
            }

            // Обробка підключення гаманця
            if (event.target.classList.contains('connect-wallet-redirect')) {
                event.preventDefault();
                event.stopPropagation();
                console.log('👛 [TASKS-INTEGRATION] Клік на підключення гаманця');
                self.handleWalletConnect();
            }

            // Обробка claim бонусів
            if (event.target.classList.contains('claim-bonus-button')) {
                var bonusType = event.target.getAttribute('data-bonus-type');
                console.log('🎁 [TASKS-INTEGRATION] Claim бонус:', bonusType);
                self.handleClaimBonus(bonusType);
            }
        });

        // Підписуємось на події оновлення балансу
        document.addEventListener('balance-updated', function(event) {
            console.log('📈 [TASKS-INTEGRATION] Подія оновлення балансу:', event.detail);
            if (event.detail && event.detail.balance) {
                self.updateBalanceDisplay(event.detail.balance);
            }
        });

        // Підписуємось на події завершення завдань
        document.addEventListener('task-completed', function(event) {
            console.log('✅ [TASKS-INTEGRATION] Завдання виконано:', event.detail);
            if (event.detail && event.detail.reward) {
                // Оновлюємо баланс після отримання винагороди
                setTimeout(function() {
                    self.loadInitialData();
                }, 1000);
            }
        });

        console.log('✅ [TASKS-INTEGRATION] === setupEventListeners COMPLETE ===');
    };

    /**
     * Показує вкладку
     */
    TasksIntegration.prototype.showTab = function(tabName) {
        console.log('📑 [TASKS-INTEGRATION] === showTab:', tabName, '===');

        // Приховуємо всі вкладки
        var allPanes = document.querySelectorAll('.main-tab-pane');
        allPanes.forEach(function(pane) {
            pane.style.display = 'none';
            pane.classList.remove('active');
        });

        // Показуємо потрібну вкладку
        var targetPane = document.getElementById(tabName + '-tab');
        if (targetPane) {
            targetPane.style.display = 'block';
            targetPane.classList.add('active');
            console.log('✅ [TASKS-INTEGRATION] Вкладка показана:', tabName);
        } else {
            console.error('❌ [TASKS-INTEGRATION] Вкладка не знайдена:', tabName);
        }

        // Оновлюємо активну кнопку
        var allTabs = document.querySelectorAll('.main-tabs .tab-button');
        allTabs.forEach(function(tab) {
            tab.classList.remove('active');
        });

        var activeTab = document.querySelector('.main-tabs .tab-button[data-tab="' + tabName + '"]');
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Викликаємо відповідний менеджер
        this.onTabChange(tabName);
    };

    /**
     * Обробка зміни вкладки
     */
    TasksIntegration.prototype.onTabChange = function(tabName) {
        console.log('🔄 [TASKS-INTEGRATION] === onTabChange:', tabName, '===');

        switch(tabName) {
            case 'flex':
                if (this.managers.flexEarn && this.managers.flexEarn.checkWalletConnection) {
                    this.managers.flexEarn.checkWalletConnection();
                }
                break;

            case 'daily':
                if (this.managers.dailyBonus && this.managers.dailyBonus.updateDailyBonusUI) {
                    this.managers.dailyBonus.updateDailyBonusUI();
                }
                break;

            case 'social':
            case 'limited':
            case 'partner':
                if (this.managers.tasks && this.managers.tasks.updateTasksUI) {
                    this.managers.tasks.updateTasksUI();
                }
                break;

            default:
                console.log('⚠️ [TASKS-INTEGRATION] Невідома вкладка:', tabName);
        }
    };

    /**
     * Обробка дій завдань
     */
    TasksIntegration.prototype.handleTaskAction = function(taskId, action) {
        console.log('📋 [TASKS-INTEGRATION] === handleTaskAction ===');
        console.log('📊 [TASKS-INTEGRATION] Task ID:', taskId, 'Action:', action);

        if (!this.managers.tasks) {
            console.error('❌ [TASKS-INTEGRATION] TasksManager недоступний');
            return;
        }

        switch(action) {
            case 'start':
                this.managers.tasks.startTask(taskId);
                break;
            case 'verify':
                this.managers.tasks.verifyTask(taskId);
                break;
            case 'claim':
                this.managers.tasks.claimReward(taskId);
                break;
            default:
                console.warn('⚠️ [TASKS-INTEGRATION] Невідома дія:', action);
        }
    };

    /**
     * Обробка підключення гаманця
     */
    TasksIntegration.prototype.handleWalletConnect = function() {
        console.log('👛 [TASKS-INTEGRATION] === handleWalletConnect ===');

        if (this.managers.wallet && this.managers.wallet.connectWallet) {
            this.managers.wallet.connectWallet();
        } else {
            console.error('❌ [TASKS-INTEGRATION] WalletChecker недоступний');
            this.showErrorMessage('Помилка підключення гаманця');
        }
    };

    /**
     * Обробка отримання бонусів
     */
    TasksIntegration.prototype.handleClaimBonus = function(bonusType) {
        console.log('🎁 [TASKS-INTEGRATION] === handleClaimBonus ===');
        console.log('📊 [TASKS-INTEGRATION] Bonus type:', bonusType);

        switch(bonusType) {
            case 'daily':
                if (this.managers.dailyBonus && this.managers.dailyBonus.claimDailyBonus) {
                    this.managers.dailyBonus.claimDailyBonus();
                }
                break;

            case 'flex':
                if (this.managers.flexEarn && this.managers.flexEarn.claimFlexReward) {
                    this.managers.flexEarn.claimFlexReward();
                }
                break;

            default:
                console.warn('⚠️ [TASKS-INTEGRATION] Невідомий тип бонусу:', bonusType);
        }
    };

    /**
     * Обробка зміни стану Store
     */
    TasksIntegration.prototype.handleStateChange = function(state, prevState, action) {
        console.log('🔄 [TASKS-INTEGRATION] Store state змінився:', action ? action.type : 'unknown');

        // Оновлюємо баланс якщо змінився
        if (state && prevState && state.user && prevState.user) {
            if (state.user.balance !== prevState.user.balance) {
                console.log('💰 [TASKS-INTEGRATION] Баланс змінився в Store');
                this.updateBalanceDisplay(state.user.balance);
            }
        }
    };

    /**
     * Показує повідомлення про успіх
     */
    TasksIntegration.prototype.showSuccessMessage = function(message) {
        console.log('✅ [TASKS-INTEGRATION] showSuccessMessage:', message);

        if (window.TasksUtils && window.TasksUtils.showToast) {
            window.TasksUtils.showToast(message, 'success');
        } else {
            // Fallback на простий toast
            var toast = document.getElementById('toast-message');
            if (toast) {
                toast.textContent = message;
                toast.classList.add('show', 'success');
                setTimeout(function() {
                    toast.classList.remove('show', 'success');
                }, 3000);
            }
        }
    };

    /**
     * Показує повідомлення про помилку
     */
    TasksIntegration.prototype.showErrorMessage = function(message) {
        console.error('❌ [TASKS-INTEGRATION] showErrorMessage:', message);

        if (window.TasksUtils && window.TasksUtils.showToast) {
            window.TasksUtils.showToast(message, 'error');
        } else {
            // Fallback на простий toast
            var toast = document.getElementById('toast-message');
            if (toast) {
                toast.textContent = message;
                toast.classList.add('show', 'error');
                setTimeout(function() {
                    toast.classList.remove('show', 'error');
                }, 5000);
            }
        }
    };

    console.log('✅ [TASKS-INTEGRATION] Модуль TasksIntegration завантажено');
    return TasksIntegration;
})();

// Глобальна функція ініціалізації
window.initTasksSystem = function() {
    console.log('🎬 [GLOBAL] === initTasksSystem START ===');
    console.log('🕐 [GLOBAL] Час виклику:', new Date().toISOString());

    return new Promise(function(resolve, reject) {
        try {
            console.log('🏗️ [GLOBAL] Створення екземпляру TasksIntegration...');
            var integration = new window.TasksIntegration();

            console.log('🚀 [GLOBAL] Запуск integration.init()...');
            integration.init()
                .then(function() {
                    // Зберігаємо екземпляр глобально для налагодження
                    window.TasksIntegrationInstance = integration;
                    console.log('✅ [GLOBAL] Екземпляр збережено в window.TasksIntegrationInstance');

                    console.log('🏁 [GLOBAL] === initTasksSystem SUCCESS ===');
                    resolve(integration);
                })
                .catch(function(error) {
                    console.error('💥 [GLOBAL] === initTasksSystem FAILED ===');
                    console.error('💥 [GLOBAL] Помилка:', error);
                    reject(error);
                });
        } catch (error) {
            console.error('💥 [GLOBAL] Критична помилка в try-catch блоці');
            console.error('💥 [GLOBAL] Деталі:', error);
            reject(error);
        }
    });
};

console.log('✅ [GLOBAL] window.initTasksSystem функція зареєстрована');