/**
 * Головний інтеграційний модуль для системи завдань WINIX - Production Version
 * Координує роботу всіх підмодулів з proper error handling та server readiness check
 */

window.TasksIntegration = (function() {
    'use strict';

    console.log('🚀 [TasksIntegration] ===== ІНІЦІАЛІЗАЦІЯ ІНТЕГРАЦІЙНОГО МОДУЛЯ (PRODUCTION) =====');

    /**
     * Конструктор інтеграції
     */
    function TasksIntegration() {
        console.log('🔧 [TasksIntegration] Створення нового екземпляра TasksIntegration');

        this.managers = {
            flexEarn: null,
            dailyBonus: null,
            tasks: null,
            verification: null,
            tasksManager: null,
            walletChecker: null
        };

        this.state = {
            userId: null,
            isInitialized: false,
            currentTab: 'flex',
            walletConnected: false,
            isAuthenticating: false,
            serverAvailable: false,
            initializationAttempts: 0,
            maxRetries: 3
        };

        this.config = {
            autoSaveInterval: 30000, // 30 секунд
            syncInterval: 60000,     // 1 хвилина
            debugMode: window.TasksConstants?.DEBUG?.ENABLED || false,
            serverCheckTimeout: 10000, // 10 секунд для перевірки сервера
            retryDelay: 5000 // 5 секунд між спробами
        };

        console.log('📊 [TasksIntegration] Початкова конфігурація:', this.config);
    }

    /**
     * Перевірка доступності сервера
     */
    TasksIntegration.prototype.checkServerAvailability = async function() {
        console.log('🔍 [TasksIntegration] === ПЕРЕВІРКА ДОСТУПНОСТІ СЕРВЕРА ===');

        try {
            // Використовуємо базовий API для ping-запиту
            if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                console.error('❌ [TasksIntegration] Базовий API недоступний');
                return false;
            }

            // Простий ping запит до сервера
            const response = await Promise.race([
                window.WinixAPI.apiRequest('api/ping', 'GET', null, {
                    suppressErrors: true,
                    timeout: this.config.serverCheckTimeout
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Server check timeout')), this.config.serverCheckTimeout)
                )
            ]);

            if (response && (response.status === 'success' || response.pong)) {
                console.log('✅ [TasksIntegration] Сервер доступний');
                this.state.serverAvailable = true;
                return true;
            }

            console.warn('⚠️ [TasksIntegration] Сервер відповів, але статус невірний');
            return false;

        } catch (error) {
            console.error('❌ [TasksIntegration] Сервер недоступний:', error.message);
            this.state.serverAvailable = false;
            return false;
        }
    };

    /**
     * Показати сповіщення про недоступність сервера
     */
    TasksIntegration.prototype.showServerUnavailableUI = function() {
        console.log('🚫 [TasksIntegration] Показуємо UI недоступності сервера');

        const container = document.querySelector('.container') || document.body;

        // Видаляємо попереднє повідомлення якщо є
        const existingNotice = document.getElementById('server-unavailable-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        const notice = document.createElement('div');
        notice.id = 'server-unavailable-notice';
        notice.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        const attemptsText = this.state.initializationAttempts > 0
            ? ` (Спроба ${this.state.initializationAttempts}/${this.state.maxRetries})`
            : '';

        notice.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <div style="animation: spin 1s linear infinite;">⚠️</div>
                <div>
                    <strong>Сервер тимчасово недоступний${attemptsText}</strong><br>
                    <small>Перевіряємо підключення... Будь ласка, зачекайте</small>
                </div>
                <button id="manual-retry" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">Спробувати знову</button>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        container.insertBefore(notice, container.firstChild);

        // Додаємо обробник для кнопки повтору
        document.getElementById('manual-retry').addEventListener('click', () => {
            console.log('🔄 [TasksIntegration] Ручний повтор ініціалізації');
            this.init();
        });
    };

    /**
     * Приховати сповіщення про недоступність сервера
     */
    TasksIntegration.prototype.hideServerUnavailableUI = function() {
        const notice = document.getElementById('server-unavailable-notice');
        if (notice) {
            notice.remove();
            console.log('✅ [TasksIntegration] UI недоступності сервера приховано');
        }
    };

    /**
     * Ініціалізація системи
     */
    TasksIntegration.prototype.init = async function() {
        console.log('🎯 [TasksIntegration] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ СИСТЕМИ =====');
        console.log('🕐 [TasksIntegration] Час початку:', new Date().toISOString());

        this.state.initializationAttempts++;

        if (this.state.initializationAttempts > this.state.maxRetries) {
            console.error('❌ [TasksIntegration] Досягнуто максимальну кількість спроб ініціалізації');
            this.showCriticalError('Не вдалося підключитися до сервера після кількох спроб. Оновіть сторінку.');
            return null;
        }

        try {
            // Показуємо повідомлення про недоступність якщо це не перша спроба
            if (this.state.initializationAttempts > 1) {
                this.showServerUnavailableUI();
            }

            // КРОК 1: Перевіряємо доступність сервера
            console.log('🔍 [TasksIntegration] Крок 1: Перевірка сервера');
            const serverAvailable = await this.checkServerAvailability();

            if (!serverAvailable) {
                console.warn('⚠️ [TasksIntegration] Сервер недоступний, спробуємо пізніше');

                if (this.state.initializationAttempts < this.state.maxRetries) {
                    console.log(`⏳ [TasksIntegration] Повтор через ${this.config.retryDelay/1000} секунд`);
                    setTimeout(() => this.init(), this.config.retryDelay);
                    return null;
                } else {
                    throw new Error('Сервер недоступний після кількох спроб');
                }
            }

            // Приховуємо повідомлення про недоступність
            this.hideServerUnavailableUI();

            // КРОК 2: Перевіряємо наявність необхідних сервісів
            console.log('🔍 [TasksIntegration] Крок 2: Перевірка сервісів');
            this.checkRequiredServices();

            // КРОК 3: Авторизуємо користувача
            console.log('🔐 [TasksIntegration] Крок 3: Авторизація');
            await this.authenticateUser();

            // КРОК 4: Перевіряємо наявність необхідних модулів
            console.log('🔍 [TasksIntegration] Крок 4: Перевірка модулів');
            this.checkRequiredModules();

            // КРОК 5: Ініціалізуємо менеджери
            console.log('🔧 [TasksIntegration] Крок 5: Ініціалізація менеджерів');
            await this.initializeManagers();

            // КРОК 6: Налаштовуємо обробники подій
            console.log('🎯 [TasksIntegration] Крок 6: Налаштування подій');
            this.setupEventHandlers();

            // КРОК 7: Налаштовуємо автозбереження
            console.log('💾 [TasksIntegration] Крок 7: Автозбереження');
            this.setupAutoSave();

            // КРОК 8: Запускаємо початкову синхронізацію
            console.log('🔄 [TasksIntegration] Крок 8: Синхронізація');
            await this.initialSync();

            // Позначаємо як ініціалізовано
            this.state.isInitialized = true;
            this.state.initializationAttempts = 0; // Скидаємо лічильник при успіху

            console.log('✅ [TasksIntegration] ===== СИСТЕМА УСПІШНО ІНІЦІАЛІЗОВАНА =====');
            console.log('📊 [TasksIntegration] Поточний стан:', this.state);

            // Відстежуємо успішну ініціалізацію
            if (window.TasksServices?.Analytics) {
                window.TasksServices.Analytics.trackEvent('System', 'initialized', 'success');
            }

            return this;

        } catch (error) {
            console.error('❌ [TasksIntegration] КРИТИЧНА ПОМИЛКА ІНІЦІАЛІЗАЦІЇ:', error);
            console.error('❌ [TasksIntegration] Stack trace:', error.stack);

            // Якщо це помилка авторизації і ще є спроби
            if (error.message.includes('authentication') && this.state.initializationAttempts < this.state.maxRetries) {
                console.log(`⏳ [TasksIntegration] Повтор авторизації через ${this.config.retryDelay/1000} секунд`);
                setTimeout(() => this.init(), this.config.retryDelay);
                return null;
            }

            // Показуємо критичну помилку
            this.showCriticalError(error.message);
            return null;
        }
    };

    /**
     * Показати критичну помилку
     */
    TasksIntegration.prototype.showCriticalError = function(message) {
        console.error('💥 [TasksIntegration] Показ критичної помилки:', message);

        const container = document.querySelector('.container') || document.body;

        // Видаляємо попередні повідомлення
        const existingNotice = document.getElementById('server-unavailable-notice');
        if (existingNotice) existingNotice.remove();

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 20px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        errorDiv.innerHTML = `
            <div style="max-width: 400px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h2 style="color: #e74c3c; margin-bottom: 20px; font-size: 24px;">Помилка підключення</h2>
                <p style="margin-bottom: 20px; font-size: 16px; line-height: 1.5; color: #bdc3c7;">
                    ${message || 'Не вдалося підключитися до сервера'}
                </p>
                <div style="margin-bottom: 30px;">
                    <p style="color: #95a5a6; font-size: 14px; margin-bottom: 15px;">
                        Можливі причини:
                    </p>
                    <ul style="color: #95a5a6; font-size: 14px; text-align: left; display: inline-block;">
                        <li>Проблеми з інтернет-з'єднанням</li>
                        <li>Технічні роботи на сервері</li>
                        <li>Застаріла версія додатку</li>
                    </ul>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="window.location.reload()" style="
                        background: linear-gradient(135deg, #3498db, #2980b9);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        🔄 Оновити сторінку
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        background: rgba(255,255,255,0.1);
                        color: white;
                        border: 1px solid rgba(255,255,255,0.2);
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                        ❌ Закрити
                    </button>
                </div>
            </div>
        `;

        container.appendChild(errorDiv);
    };

    /**
     * Перевірити наявність обов'язкових сервісів
     */
    TasksIntegration.prototype.checkRequiredServices = function() {
        console.log('🔍 [TasksIntegration] Перевірка обов\'язкових сервісів...');

        const requiredServices = [
            'WinixAPI', // Базовий API (обов'язковий)
            'TasksConstants'
        ];

        const optionalServices = [
            'TasksStore',
            'TelegramValidator',
            'TasksUtils'
        ];

        const missing = requiredServices.filter(service => !window[service]);

        if (missing.length > 0) {
            console.error('❌ [TasksIntegration] Відсутні критичні сервіси:', missing);
            throw new Error(`Відсутні обов'язкові сервіси: ${missing.join(', ')}`);
        }

        // Перевіряємо опціональні
        optionalServices.forEach(service => {
            if (!window[service]) {
                console.warn(`⚠️ [TasksIntegration] Опціональний сервіс ${service} відсутній`);
            }
        });

        console.log('✅ [TasksIntegration] Всі обов\'язкові сервіси присутні');
    };

    /**
     * Авторизація користувача
     */
    TasksIntegration.prototype.authenticateUser = async function() {
        console.log('🔐 [TasksIntegration] === АВТОРИЗАЦІЯ КОРИСТУВАЧА ===');

        if (this.state.isAuthenticating) {
            console.log('⏸️ [TasksIntegration] Авторизація вже виконується');
            return;
        }

        this.state.isAuthenticating = true;

        try {
            // Перевіряємо наявність TelegramValidator
            if (!window.TelegramValidator) {
                console.warn('⚠️ [TasksIntegration] TelegramValidator недоступний, використовуємо fallback');

                // Fallback: отримуємо ID напряму з WinixAPI
                const userId = window.WinixAPI?.getUserId?.();
                if (!userId) {
                    throw new Error('Не вдалося отримати ID користувача');
                }

                this.state.userId = userId;
                console.log('✅ [TasksIntegration] Fallback авторизація успішна:', userId);
                return;
            }

            // Стандартна авторизація через TelegramValidator
            const validation = await window.TelegramValidator.validateTelegramAuth();

            if (!validation.valid) {
                throw new Error('Telegram authentication failed: ' + validation.error);
            }

            this.state.userId = validation.user.id || validation.user.telegram_id;
            console.log('✅ [TasksIntegration] Користувач авторизований:', this.state.userId);

            // Оновлюємо UI
            this.updateUserUI(validation.user);

        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка авторизації:', error);

            // Спробуємо fallback авторизацію
            try {
                const userId = window.WinixAPI?.getUserId?.();
                if (userId) {
                    this.state.userId = userId;
                    console.log('✅ [TasksIntegration] Fallback авторизація успішна');
                    return;
                }
            } catch (fallbackError) {
                console.error('❌ [TasksIntegration] Fallback авторизація провалена:', fallbackError);
            }

            throw new Error('Помилка авторизації. Перевірте підключення до інтернету та спробуйте оновити сторінку');
        } finally {
            this.state.isAuthenticating = false;
        }
    };

    /**
     * Оновити UI користувача
     */
    TasksIntegration.prototype.updateUserUI = function(user) {
        console.log('🔄 [TasksIntegration] Оновлення UI користувача');

        try {
            // Оновлюємо ID
            const userIdElement = document.getElementById('header-user-id');
            if (userIdElement && user) {
                userIdElement.textContent = user.id || user.telegram_id || '';
            }

            // Оновлюємо аватар
            const avatarElement = document.querySelector('.profile-avatar');
            if (avatarElement && user?.username) {
                avatarElement.textContent = user.username.charAt(0).toUpperCase();
            }

            // Оновлюємо баланси
            const winixElement = document.getElementById('user-winix');
            const ticketsElement = document.getElementById('user-tickets');

            if (winixElement && user?.balance) {
                winixElement.textContent = user.balance.winix || 0;
            }

            if (ticketsElement && user?.balance) {
                ticketsElement.textContent = user.balance.tickets || 0;
            }

            console.log('✅ [TasksIntegration] UI користувача оновлено');
        } catch (error) {
            console.warn('⚠️ [TasksIntegration] Помилка оновлення UI:', error);
        }
    };

    /**
     * Перевірити наявність необхідних модулів
     */
    TasksIntegration.prototype.checkRequiredModules = function() {
        console.log('🔍 [TasksIntegration] Перевірка необхідних модулів...');

        const requiredModules = {
            'TasksConstants': window.TasksConstants,
            'TasksUtils': window.TasksUtils
        };

        const optionalModules = [
            'FlexEarnManager', 'TasksManager', 'TaskVerification',
            'DailyBonusManager', 'TasksAPI', 'TasksStore',
            'TelegramValidator', 'WalletChecker', 'TasksServices'
        ];

        const missingRequired = [];

        Object.entries(requiredModules).forEach(([name, module]) => {
            if (!module) {
                missingRequired.push(name);
                console.error(`❌ [TasksIntegration] Відсутній обов'язковий модуль: ${name}`);
            } else {
                console.log(`✅ [TasksIntegration] Модуль ${name} знайдено`);
            }
        });

        // Перевіряємо опціональні модулі
        optionalModules.forEach(name => {
            if (!window[name]) {
                console.warn(`⚠️ [TasksIntegration] Опціональний модуль ${name} відсутній`);
            }
        });

        if (missingRequired.length > 0) {
            throw new Error(`Відсутні необхідні модулі: ${missingRequired.join(', ')}`);
        }

        console.log('✅ [TasksIntegration] Всі необхідні модулі присутні');
    };

    /**
     * Ініціалізувати менеджери
     */
    TasksIntegration.prototype.initializeManagers = async function() {
        console.log('🔧 [TasksIntegration] Ініціалізація менеджерів...');

        const userId = this.state.userId;

        try {
            // WalletChecker (опціональний)
            if (window.WalletChecker) {
                console.log('  🔧 [TasksIntegration] Ініціалізація WalletChecker...');
                try {
                    this.managers.walletChecker = window.WalletChecker;
                    await this.managers.walletChecker.init();
                    console.log('  ✅ [TasksIntegration] WalletChecker ініціалізовано');
                } catch (error) {
                    console.warn('  ⚠️ [TasksIntegration] Помилка ініціалізації WalletChecker:', error);
                    // Не критично, продовжуємо без гаманця
                }
            }

            // FlexEarn Manager (опціональний)
            if (window.FlexEarnManager) {
                console.log('  🔧 [TasksIntegration] Ініціалізація FlexEarnManager...');
                try {
                    this.managers.flexEarn = window.FlexEarnManager;
                    this.managers.flexEarn.init(userId);
                    console.log('  ✅ [TasksIntegration] FlexEarnManager ініціалізовано');
                } catch (error) {
                    console.warn('  ⚠️ [TasksIntegration] Помилка ініціалізації FlexEarnManager:', error);
                }
            }

            // Daily Bonus Manager (опціональний)
            if (window.DailyBonusManager) {
                console.log('  🔧 [TasksIntegration] Ініціалізація DailyBonusManager...');
                try {
                    this.managers.dailyBonus = window.DailyBonusManager;
                    await this.managers.dailyBonus.init(userId);
                    console.log('  ✅ [TasksIntegration] DailyBonusManager ініціалізовано');
                } catch (error) {
                    console.warn('  ⚠️ [TasksIntegration] Помилка ініціалізації DailyBonusManager:', error);
                }
            }

            // Tasks Manager (опціональний)
            if (window.TasksManager) {
                console.log('  🔧 [TasksIntegration] Ініціалізація TasksManager...');
                try {
                    this.managers.tasksManager = window.TasksManager;
                    await this.managers.tasksManager.init(userId);
                    console.log('  ✅ [TasksIntegration] TasksManager ініціалізовано');
                } catch (error) {
                    console.warn('  ⚠️ [TasksIntegration] Помилка ініціалізації TasksManager:', error);
                }
            }

            // Task Verification (опціональний)
            if (window.TaskVerification) {
                console.log('  🔧 [TasksIntegration] Ініціалізація TaskVerification...');
                try {
                    this.managers.verification = window.TaskVerification;
                    this.managers.verification.init();
                    console.log('  ✅ [TasksIntegration] TaskVerification готовий');
                } catch (error) {
                    console.warn('  ⚠️ [TasksIntegration] Помилка ініціалізації TaskVerification:', error);
                }
            }

            console.log('✅ [TasksIntegration] Всі доступні менеджери ініціалізовано');

        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка ініціалізації менеджерів:', error);
            // Не кидаємо критичну помилку, продовжуємо з тим що є
            console.warn('⚠️ [TasksIntegration] Продовжуємо роботу з обмеженою функціональністю');
        }
    };

    /**
     * Початкова синхронізація
     */
    TasksIntegration.prototype.initialSync = async function() {
        console.log('🔄 [TasksIntegration] === ПОЧАТКОВА СИНХРОНІЗАЦІЯ ===');

        try {
            // Запускаємо синхронізацію через SyncService якщо доступний
            if (window.TasksServices?.Sync) {
                await window.TasksServices.Sync.syncData();
                console.log('✅ [TasksIntegration] Початкова синхронізація завершена');
            } else {
                console.warn('⚠️ [TasksIntegration] SyncService недоступний, пропускаємо синхронізацію');
            }
        } catch (error) {
            console.warn('⚠️ [TasksIntegration] Помилка синхронізації:', error);
            // Не критично, продовжуємо роботу
        }
    };

    // Решта методів залишаються без змін...
    TasksIntegration.prototype.setupEventHandlers = function() {
        console.log('🎯 [TasksIntegration] Налаштування обробників подій...');

        const self = this;

        // Обробники для вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        console.log(`  📑 [TasksIntegration] Знайдено ${tabs.length} вкладок`);

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const tabName = this.getAttribute('data-tab');
                console.log(`  📑 [TasksIntegration] Клік на вкладку ${index}: ${tabName}`);

                self.switchTab(tabName);

                if (window.TasksServices?.Analytics) {
                    window.TasksServices.Analytics.trackEvent('Navigation', 'tab_switch', tabName);
                }
            });
        });

        // Обробник видимості сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.state.isInitialized) {
                console.log('👁️ [TasksIntegration] Сторінка стала видимою');
                this.onPageVisible();
            }
        });

        // Обробник онлайн/офлайн
        window.addEventListener('online', () => {
            console.log('🌐 [TasksIntegration] Підключення відновлено');
            this.onOnline();
        });

        window.addEventListener('offline', () => {
            console.log('📵 [TasksIntegration] Підключення втрачено');
            this.onOffline();
        });

        console.log('✅ [TasksIntegration] Обробники подій налаштовано');
    };

    TasksIntegration.prototype.switchTab = function(tabName) {
        console.log(`📑 [TasksIntegration] === ПЕРЕМИКАННЯ ВКЛАДКИ ===`);
        console.log(`📑 [TasksIntegration] Цільова вкладка: ${tabName}`);

        if (this.state.currentTab === tabName) {
            console.log('ℹ️ [TasksIntegration] Вкладка вже активна');
            return;
        }

        this.state.currentTab = tabName;

        if (window.TasksStore) {
            window.TasksStore.actions.setCurrentTab(tabName);
        }

        // Оновлюємо UI вкладок
        const tabs = document.querySelectorAll('.main-tabs .tab-button');
        const panes = document.querySelectorAll('.main-tab-pane');

        tabs.forEach(tab => {
            const isActive = tab.getAttribute('data-tab') === tabName;
            if (isActive) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        panes.forEach(pane => {
            const paneId = pane.id;
            const shouldBeActive = paneId === `${tabName}-tab`;

            if (shouldBeActive) {
                pane.classList.add('active');
                pane.style.display = 'block';
            } else {
                pane.classList.remove('active');
                pane.style.display = 'none';
            }
        });

        try {
            this.onTabSwitch(tabName);
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка при обробці перемикання вкладки:', error);
        }

        console.log('✅ [TasksIntegration] Перемикання вкладки завершено');
    };

    TasksIntegration.prototype.onTabSwitch = function(tabName) {
        console.log(`🔄 [TasksIntegration] Обробка перемикання на вкладку: ${tabName}`);

        try {
            switch(tabName) {
                case 'flex':
                    if (this.managers.flexEarn?.checkWalletConnection) {
                        this.managers.flexEarn.checkWalletConnection();
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
                    if (this.managers.tasksManager?.updateTasksUI) {
                        this.managers.tasksManager.updateTasksUI();
                    }
                    break;

                default:
                    console.warn(`  ⚠️ [TasksIntegration] Невідома вкладка: ${tabName}`);
            }
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка обробки вкладки:', error);
        }
    };

    TasksIntegration.prototype.setupAutoSave = function() {
        console.log('💾 [TasksIntegration] Налаштування автозбереження');

        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(() => {
            this.saveState();
        }, this.config.autoSaveInterval);

        console.log(`✅ [TasksIntegration] Автозбереження налаштовано (кожні ${this.config.autoSaveInterval/1000} сек)`);
    };

    TasksIntegration.prototype.saveState = function() {
        try {
            const stateToSave = {
                userId: this.state.userId,
                currentTab: this.state.currentTab,
                timestamp: Date.now()
            };

            if (window.TasksUtils?.storage) {
                window.TasksUtils.storage.setSecure('tasksSystemState', stateToSave);
            }
        } catch (error) {
            console.error('❌ [TasksIntegration] Помилка збереження стану:', error);
        }
    };

    TasksIntegration.prototype.onPageVisible = function() {
        console.log('👁️ [TasksIntegration] Обробка відновлення видимості...');

        if (window.TasksServices?.Auth?.checkSession) {
            window.TasksServices.Auth.checkSession();
        }

        if (window.TasksServices?.Sync?.syncData) {
            window.TasksServices.Sync.syncData();
        }

        this.onTabSwitch(this.state.currentTab);
    };

    TasksIntegration.prototype.onPageHidden = function() {
        this.saveState();
    };

    TasksIntegration.prototype.onOnline = function() {
        console.log('🌐 [TasksIntegration] Обробка відновлення з\'єднання...');

        this.showToast('З\'єднання відновлено', 'success');

        // Перевіряємо сервер і можливо перезапускаємо
        this.checkServerAvailability().then(available => {
            if (available && !this.state.isInitialized) {
                console.log('🔄 [TasksIntegration] Сервер знову доступний, перезапускаємо ініціалізацію');
                this.init();
            }
        });

        if (window.TasksServices?.Sync?.syncData) {
            window.TasksServices.Sync.syncData();
        }

        this.onTabSwitch(this.state.currentTab);
    };

    TasksIntegration.prototype.onOffline = function() {
        console.log('📵 [TasksIntegration] Обробка втрати з\'єднання...');
        this.showToast('З\'єднання втрачено. Функціональність обмежена', 'warning');
    };

    TasksIntegration.prototype.showToast = function(message, type = 'info') {
        console.log(`💬 [TasksIntegration] Toast: ${type} - ${message}`);
        if (window.TasksUtils?.showToast) {
            window.TasksUtils.showToast(message, type);
        }
    };

    TasksIntegration.prototype.destroy = function() {
        console.log('🧹 [TasksIntegration] Знищення системи...');

        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        Object.entries(this.managers).forEach(([name, manager]) => {
            if (manager && typeof manager.destroy === 'function') {
                try {
                    manager.destroy();
                } catch (error) {
                    console.error(`❌ [TasksIntegration] Помилка знищення ${name}:`, error);
                }
            }
        });

        this.saveState();
        console.log('✅ [TasksIntegration] Система знищена');
    };

    // Створюємо і повертаємо екземпляр
    const integration = new TasksIntegration();

    console.log('✅ [TasksIntegration] Інтеграційний модуль готовий до ініціалізації (Production)');

    return integration;

})();

// Автоматична ініціалізація при завантаженні DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 [TasksIntegration] DOM завантажено, запуск ініціалізації...');

    try {
        window.tasksIntegration = await window.TasksIntegration.init();

        if (window.tasksIntegration) {
            console.log('🎉 [TasksIntegration] Система завдань успішно запущена!');
        } else {
            console.log('⚠️ [TasksIntegration] Система в режимі очікування підключення до сервера');
        }
    } catch (error) {
        console.error('❌ [TasksIntegration] Критична помилка запуску:', error);
        // Помилка вже оброблена в init(), не дублюємо UI
    }
});