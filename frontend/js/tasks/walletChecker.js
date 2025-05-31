/**
 * Модуль перевірки TON гаманця для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V2 - Smart polling, інтелектуальне кешування та об'єднані перевірки
 */

window.WalletChecker = (function() {
    'use strict';

    console.log('👛 [WalletChecker-V2] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Централізований кеш для гаманця
    const WalletCache = {
        data: new Map(),
        checksums: new Map(),
        timestamps: new Map(),

        ttl: {
            walletStatus: 60000,     // 1 хвилина
            flexBalance: 30000,      // 30 секунд
            walletConnection: 5000,  // 5 секунд для швидких перевірок
            availableLevels: 120000  // 2 хвилини
        },

        set(key, data, customTTL) {
            const checksum = this.calculateChecksum(data);
            this.data.set(key, data);
            this.checksums.set(key, checksum);
            this.timestamps.set(key, Date.now());

            const ttl = customTTL || this.ttl[key] || 60000;
            setTimeout(() => this.invalidate(key), ttl);
        },

        get(key) {
            const timestamp = this.timestamps.get(key);
            if (!timestamp) return null;

            const age = Date.now() - timestamp;
            const ttl = this.ttl[key] || 60000;

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
            return JSON.stringify(data).split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
        },

        invalidate(key) {
            this.data.delete(key);
            this.checksums.delete(key);
            this.timestamps.delete(key);
        },

        clear() {
            this.data.clear();
            this.checksums.clear();
            this.timestamps.clear();
        }
    };

    // Request Manager для об'єднання запитів
    const RequestManager = {
        pending: new Map(),
        rateLimiter: {
            lastCall: 0,
            baseDelay: 2000,
            currentDelay: 2000,
            maxDelay: 60000,
            backoffMultiplier: 1.5
        },

        async execute(key, requestFn) {
            // Перевіряємо чи вже виконується такий запит
            if (this.pending.has(key)) {
                console.log(`📦 [RequestManager] Повертаємо існуючий запит: ${key}`);
                return this.pending.get(key);
            }

            // Rate limiting з експоненційним backoff
            await this.waitForRateLimit();

            // Створюємо запит
            const promise = requestFn()
                .then(result => {
                    // Успіх - скидаємо delay
                    this.rateLimiter.currentDelay = this.rateLimiter.baseDelay;
                    return result;
                })
                .catch(error => {
                    // Помилка - збільшуємо delay
                    if (error.message?.includes('429')) {
                        this.increaseDelay();
                    }
                    throw error;
                })
                .finally(() => {
                    this.pending.delete(key);
                });

            this.pending.set(key, promise);
            return promise;
        },

        async waitForRateLimit() {
            const now = Date.now();
            const timeSinceLastCall = now - this.rateLimiter.lastCall;

            if (timeSinceLastCall < this.rateLimiter.currentDelay) {
                const waitTime = this.rateLimiter.currentDelay - timeSinceLastCall;
                console.log(`⏳ [RequestManager] Rate limit: чекаємо ${waitTime}мс`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            this.rateLimiter.lastCall = Date.now();
        },

        increaseDelay() {
            const newDelay = Math.min(
                this.rateLimiter.currentDelay * this.rateLimiter.backoffMultiplier,
                this.rateLimiter.maxDelay
            );

            console.warn(`⚠️ [RequestManager] Збільшуємо затримку: ${this.rateLimiter.currentDelay}мс → ${newDelay}мс`);
            this.rateLimiter.currentDelay = newDelay;

            // Автоматичне зменшення через хвилину
            setTimeout(() => {
                if (this.rateLimiter.currentDelay > this.rateLimiter.baseDelay) {
                    this.rateLimiter.currentDelay = Math.max(
                        this.rateLimiter.baseDelay,
                        this.rateLimiter.currentDelay / this.rateLimiter.backoffMultiplier
                    );
                    console.log(`📉 [RequestManager] Зменшуємо затримку до ${this.rateLimiter.currentDelay}мс`);
                }
            }, 60000);
        }
    };

    // Smart Polling Manager
    const SmartPolling = {
        intervals: new Map(),
        lastChecks: new Map(),
        checkCounts: new Map(),

        baseIntervals: {
            walletConnection: 30000,    // 30 сек базовий
            flexBalance: 60000,         // 1 хв базовий
            availableLevels: 120000     // 2 хв базовий
        },

        start(name, callback) {
            console.log(`🔄 [SmartPolling] Запуск smart polling для ${name}`);

            // Очищаємо старий інтервал
            this.stop(name);

            // Функція для адаптивного інтервалу
            const getAdaptiveInterval = () => {
                const baseInterval = this.baseIntervals[name] || 60000;
                const checkCount = this.checkCounts.get(name) || 0;

                // Збільшуємо інтервал якщо нічого не змінюється
                const multiplier = Math.min(checkCount / 10, 5); // Максимум x5
                const adaptiveInterval = baseInterval * (1 + multiplier);

                // Враховуємо активність користувача
                const isUserActive = this.isUserActive();

                return isUserActive ? adaptiveInterval : adaptiveInterval * 2;
            };

            const runCheck = async () => {
                const lastCheck = this.lastChecks.get(name) || 0;
                const now = Date.now();

                // Пропускаємо якщо недавно перевіряли
                if (now - lastCheck < 5000) {
                    console.log(`⏸️ [SmartPolling] ${name}: занадто рано для перевірки`);
                    return;
                }

                console.log(`🔍 [SmartPolling] ${name}: виконання перевірки`);
                this.lastChecks.set(name, now);

                // Виконуємо callback і перевіряємо чи були зміни
                const hasChanges = await callback();

                // Оновлюємо лічильник
                if (hasChanges) {
                    this.checkCounts.set(name, 0); // Скидаємо якщо були зміни
                } else {
                    const count = this.checkCounts.get(name) || 0;
                    this.checkCounts.set(name, count + 1);
                }

                // Плануємо наступну перевірку з адаптивним інтервалом
                const nextInterval = getAdaptiveInterval();
                console.log(`⏱️ [SmartPolling] ${name}: наступна перевірка через ${Math.round(nextInterval/1000)}с`);

                const timerId = setTimeout(runCheck, nextInterval);
                this.intervals.set(name, timerId);
            };

            // Запускаємо першу перевірку
            runCheck();
        },

        stop(name) {
            const timerId = this.intervals.get(name);
            if (timerId) {
                clearTimeout(timerId);
                this.intervals.delete(name);
                console.log(`⏹️ [SmartPolling] Зупинено polling для ${name}`);
            }
        },

        stopAll() {
            this.intervals.forEach((timerId, name) => {
                clearTimeout(timerId);
                console.log(`⏹️ [SmartPolling] Зупинено polling для ${name}`);
            });
            this.intervals.clear();
        },

        isUserActive() {
            // Перевіряємо активність через sessionStorage
            const lastActivity = parseInt(sessionStorage.getItem('lastUserActivity') || '0');
            const inactiveTime = Date.now() - lastActivity;
            return inactiveTime < 5 * 60 * 1000; // 5 хвилин
        }
    };

    // Стан модуля
    const state = {
        tonConnectUI: null,
        isInitialized: false,
        lastCheckTime: null,
        connectionAttempts: 0,
        userId: null,
        isConnecting: false,
        initPromise: null,

        // Об'єднані дані для швидкого доступу
        currentWallet: {
            connected: false,
            address: null,
            rawAddress: null,
            provider: null,
            flexBalance: 0,
            lastUpdate: null
        },

        // Batch оновлення
        pendingUpdates: new Set(),
        updateFrame: null
    };

    // Конфігурація
    const config = {
        maxConnectionAttempts: 3,
        manifestUrl: window.TasksConstants?.TON_CONNECT?.MANIFEST_URL || '/tonconnect-manifest.json',
        network: window.TasksConstants?.TON_CONNECT?.NETWORK || 'mainnet'
    };

    /**
     * Ініціалізація модуля - ОПТИМІЗОВАНА
     */
    async function init(userId = null) {
        console.log('🚀 [WalletChecker-V2] Початок ініціалізації');

        if (state.isInitialized) {
            console.log('✅ [WalletChecker-V2] Модуль вже ініціалізовано');
            return true;
        }

        if (state.initPromise) {
            console.log('⏳ [WalletChecker-V2] Ініціалізація вже в процесі');
            return state.initPromise;
        }

        state.initPromise = initInternal(userId);

        try {
            const result = await state.initPromise;
            return result;
        } finally {
            state.initPromise = null;
        }
    }

    /**
     * Внутрішня ініціалізація
     */
    async function initInternal(userId) {
        try {
            // Отримуємо userId
            state.userId = userId || await getUserIdFromSources();

            if (state.userId && typeof state.userId === 'string') {
                state.userId = parseInt(state.userId, 10);
            }

            if (!state.userId) {
                console.warn('⚠️ [WalletChecker-V2] User ID не знайдено');
            }

            // Завантажуємо кешовані дані для швидкого старту
            loadCachedWalletData();

            // Ініціалізуємо TON Connect
            await waitForTonConnectUI();
            await initializeTonConnect();

            // Налаштовуємо обробники
            setupEventListeners();

            // Запускаємо smart polling
            startSmartPolling();

            state.isInitialized = true;
            console.log('✅ [WalletChecker-V2] Модуль успішно ініціалізовано');

            // Перша перевірка через 2 секунди
            setTimeout(() => checkWalletConnection(), 2000);

            return true;

        } catch (error) {
            console.error('❌ [WalletChecker-V2] Помилка ініціалізації:', error);
            window.TasksUtils?.showToast('Помилка ініціалізації TON Connect', 'error');
            throw error;
        }
    }

    /**
     * Завантаження кешованих даних гаманця
     */
    function loadCachedWalletData() {
        const cached = window.TasksUtils.storage.get('walletData');
        if (cached && cached.userId === state.userId) {
            console.log('📦 [WalletChecker-V2] Завантажено кешовані дані гаманця');
            state.currentWallet = { ...state.currentWallet, ...cached.wallet };

            // Оновлюємо UI одразу
            if (state.currentWallet.connected) {
                showWalletConnectedStatus(state.currentWallet.address);
            }
        }
    }

    /**
     * Збереження даних гаманця
     */
    function saveWalletData() {
        window.TasksUtils.storage.set('walletData', {
            userId: state.userId,
            wallet: state.currentWallet,
            timestamp: Date.now()
        });
    }

    /**
     * Отримання userId з різних джерел - кешована версія
     */
    const getUserIdFromSources = (() => {
        let cachedUserId = null;

        return async function() {
            if (cachedUserId) return cachedUserId;

            console.log('🔍 [WalletChecker-V2] Пошук userId...');

            const syncSources = [
                () => window.TasksStore?.selectors?.getUserId?.(),
                () => window.WinixAPI?.getUserId?.(),
                () => window.TasksIntegrationInstance?.userId,
                () => localStorage.getItem('telegram_user_id'),
                () => localStorage.getItem('user_id'),
                () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id
            ];

            // Швидка перевірка
            for (const source of syncSources) {
                try {
                    const id = source();
                    if (id && id !== 'undefined' && id !== 'null') {
                        cachedUserId = id;
                        return id;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Якщо не знайдено - чекаємо
            return new Promise((resolve) => {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;

                    for (const source of syncSources) {
                        try {
                            const id = source();
                            if (id && id !== 'undefined' && id !== 'null') {
                                clearInterval(checkInterval);
                                cachedUserId = id;
                                resolve(id);
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (attempts > 10) {
                        clearInterval(checkInterval);
                        resolve(null);
                    }
                }, 500);
            });
        };
    })();

    /**
     * Перевірка підключення гаманця - ОПТИМІЗОВАНА
     */
    async function checkWalletConnection() {
        console.log('🔍 [WalletChecker-V2] === ПЕРЕВІРКА ПІДКЛЮЧЕННЯ (ОПТИМІЗОВАНА) ===');

        const store = window.TasksStore;
        if (!store) {
            console.error('❌ [WalletChecker-V2] Store не знайдено');
            return false;
        }

        // Батчимо UI оновлення
        scheduleUpdate('checking', () => {
            store.actions.setWalletChecking(true);
        });

        try {
            const isConnected = state.tonConnectUI?.connected || false;
            console.log('📊 [WalletChecker-V2] TON Connect статус:', isConnected);

            if (isConnected) {
                const wallet = state.tonConnectUI.wallet;
                const addresses = extractWalletAddresses(wallet);

                if (!addresses) {
                    throw new Error('Не вдалося отримати адреси гаманця');
                }

                // Перевіряємо чи змінилась адреса
                const addressChanged = state.currentWallet.address !== addresses.userFriendly;

                if (!addressChanged) {
                    console.log('✅ [WalletChecker-V2] Адреса не змінилась, використовуємо кеш');

                    // Перевіряємо тільки якщо давно не перевіряли
                    const lastUpdate = state.currentWallet.lastUpdate || 0;
                    if (Date.now() - lastUpdate < 30000) { // 30 сек
                        return true;
                    }
                }

                // Оновлюємо дані
                state.currentWallet = {
                    connected: true,
                    address: addresses.userFriendly,
                    rawAddress: addresses.raw,
                    provider: wallet.device.appName,
                    lastUpdate: Date.now(),
                    flexBalance: state.currentWallet.flexBalance // Зберігаємо баланс
                };

                // Верифікуємо на бекенді тільки якщо потрібно
                await verifyWalletIfNeeded(wallet);

                state.lastCheckTime = Date.now();
                saveWalletData();

                // Оновлюємо UI
                scheduleUpdate('connected', () => {
                    showWalletConnectedStatus(addresses.userFriendly);
                });

                return true;

            } else {
                console.log('❌ [WalletChecker-V2] Гаманець не підключено');

                // Очищаємо дані
                state.currentWallet = {
                    connected: false,
                    address: null,
                    rawAddress: null,
                    provider: null,
                    flexBalance: 0,
                    lastUpdate: Date.now()
                };

                WalletCache.clear();
                saveWalletData();

                // Оновлюємо Store та UI
                scheduleUpdate('disconnected', () => {
                    store.actions.setWalletConnected(false);
                    store.actions.disconnectWallet();
                    showWalletConnectionUI();
                });

                return false;
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V2] Помилка перевірки:', error);

            if (!error.message?.includes('400') && !error.message?.includes('429')) {
                store.actions.setError('Помилка перевірки гаманця');
            }

            return false;

        } finally {
            scheduleUpdate('checking-complete', () => {
                store.actions.setWalletChecking(false);
            });
        }
    }

    /**
     * Верифікація гаманця тільки якщо потрібно
     */
    async function verifyWalletIfNeeded(wallet) {
        const addresses = extractWalletAddresses(wallet);
        const cacheKey = `wallet_status_${state.userId}`;

        // Перевіряємо кеш
        const cached = WalletCache.get(cacheKey);
        if (cached && cached.address === addresses.userFriendly) {
            console.log('✅ [WalletChecker-V2] Використовуємо кешований статус гаманця');
            updateWalletState(wallet, cached);

            // Перевіряємо баланс FLEX якщо давно не перевіряли
            const lastFlexCheck = WalletCache.timestamps.get('flexBalance') || 0;
            if (Date.now() - lastFlexCheck > 30000) {
                checkFlexBalanceOptimized(addresses.userFriendly);
            }

            return;
        }

        // Верифікуємо на бекенді
        await RequestManager.execute(
            `verify_wallet_${state.userId}`,
            () => verifyWalletOnBackend(wallet)
        );
    }

    /**
     * Верифікація гаманця на бекенді - ОПТИМІЗОВАНА
     */
    async function verifyWalletOnBackend(wallet) {
        console.log('🌐 [WalletChecker-V2] === ВЕРИФІКАЦІЯ НА БЕКЕНДІ ===');

        const addresses = extractWalletAddresses(wallet);

        if (!addresses) {
            throw new Error('Адреси гаманця відсутні');
        }

        try {
            // Перевіряємо статус
            const statusResponse = await window.TasksAPI.wallet.checkStatus(state.userId);

            if (statusResponse.data?.connected &&
                (statusResponse.data.address === addresses.userFriendly ||
                 statusResponse.data.address === addresses.raw)) {

                console.log('✅ [WalletChecker-V2] Гаманець вже зареєстрований');

                // Кешуємо
                WalletCache.set(`wallet_status_${state.userId}`, statusResponse.data);

                updateWalletState(wallet, statusResponse.data);

                // Асинхронно перевіряємо баланс
                checkFlexBalanceOptimized(addresses.userFriendly);

                return;
            }

            // Реєструємо гаманець
            console.log('🔄 [WalletChecker-V2] Реєстрація гаманця...');

            const walletData = {
                address: addresses.raw,
                addressFriendly: addresses.userFriendly,
                chain: wallet.account.chain || '-239',
                publicKey: wallet.account.publicKey || '',
                provider: wallet.device.appName || 'unknown',
                timestamp: Date.now()
            };

            const connectResponse = await window.TasksAPI.wallet.connect(state.userId, walletData);

            if (connectResponse.status === 'success') {
                // Кешуємо
                WalletCache.set(`wallet_status_${state.userId}`, connectResponse.data.wallet);

                updateWalletState(wallet, connectResponse.data);

                if (connectResponse.data?.first_connection) {
                    showFirstConnectionBonus(connectResponse.data.bonus);
                }

                // Асинхронно перевіряємо баланс
                checkFlexBalanceOptimized(addresses.userFriendly);
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V2] Помилка верифікації:', error);

            if (error.data?.error_code === 'WALLET_ALREADY_CONNECTED') {
                window.TasksUtils?.showToast('Цей гаманець вже підключений до іншого акаунта', 'error');
                await disconnectWallet();
            } else if (error.data?.error_code === 'INVALID_ADDRESS') {
                window.TasksUtils?.showToast('Невалідна адреса TON гаманця', 'error');
            }

            throw error;
        }
    }

    /**
     * Перевірка балансу FLEX - ОПТИМІЗОВАНА
     */
    async function checkFlexBalanceOptimized(address) {
        console.log('💎 [WalletChecker-V2] === ПЕРЕВІРКА FLEX (ОПТИМІЗОВАНА) ===');

        const cacheKey = 'flexBalance';

        // Перевіряємо кеш
        const cached = WalletCache.get(cacheKey);
        if (cached !== null) {
            console.log('📦 [WalletChecker-V2] Використовуємо кешований баланс FLEX:', cached);
            return false; // Немає змін
        }

        try {
            const response = await RequestManager.execute(
                `flex_balance_${address}`,
                () => window.TasksAPI.flex.getBalance(state.userId, address)
            );

            if (response.balance !== undefined) {
                const balance = parseInt(response.balance);
                const oldBalance = state.currentWallet.flexBalance;

                // Перевіряємо чи змінився баланс
                if (oldBalance === balance) {
                    console.log('✅ [WalletChecker-V2] Баланс FLEX не змінився');
                    WalletCache.set(cacheKey, balance);
                    return false;
                }

                console.log('💰 [WalletChecker-V2] Баланс FLEX змінився:', oldBalance, '→', balance);

                // Оновлюємо дані
                state.currentWallet.flexBalance = balance;
                WalletCache.set(cacheKey, balance);

                // Оновлюємо Store
                scheduleUpdate('flex-balance', () => {
                    window.TasksStore.actions.setFlexBalance(balance);
                    window.TasksStore.actions.updateBalance({ flex: balance });
                });

                // Асинхронно перевіряємо доступні рівні
                checkAvailableLevelsOptimized(balance);

                saveWalletData();

                return true; // Були зміни
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V2] Помилка отримання балансу:', error);
        }

        return false;
    }

    /**
     * Перевірка доступних рівнів - ОПТИМІЗОВАНА
     */
    async function checkAvailableLevelsOptimized(flexBalance) {
        console.log('🎯 [WalletChecker-V2] Перевірка доступних рівнів');

        const cacheKey = `available_levels_${flexBalance}`;

        // Перевіряємо кеш
        const cached = WalletCache.get(cacheKey);
        if (cached) {
            console.log('📦 [WalletChecker-V2] Використовуємо кешовані рівні');
            return false;
        }

        const flexLevels = window.TasksConstants?.FLEX_LEVELS || {};
        let availableCount = 0;
        const updates = [];

        Object.entries(flexLevels).forEach(([levelKey, levelData]) => {
            const isAvailable = flexBalance >= levelData.required;

            if (isAvailable) {
                availableCount++;
            }

            // Збираємо оновлення для батчингу
            updates.push({ level: levelKey, available: isAvailable });
        });

        // Батчимо оновлення Store
        scheduleUpdate('flex-levels', () => {
            updates.forEach(({ level, available }) => {
                window.TasksStore.actions.setFlexLevelAvailable(level, available);
            });
        });

        // Кешуємо результат
        WalletCache.set(cacheKey, { availableCount, updates });

        if (availableCount > 0) {
            window.TasksUtils.showToast(
                `Доступно ${availableCount} ${availableCount === 1 ? 'рівень' : 'рівнів'} для отримання винагород!`,
                'success'
            );
        }

        return availableCount > 0;
    }

    /**
     * Батчинг оновлень через requestAnimationFrame
     */
    function scheduleUpdate(type, updateFn) {
        state.pendingUpdates.add({ type, fn: updateFn });

        if (!state.updateFrame) {
            state.updateFrame = requestAnimationFrame(() => {
                processPendingUpdates();
            });
        }
    }

    /**
     * Обробка батчованих оновлень
     */
    function processPendingUpdates() {
        console.log(`🎨 [WalletChecker-V2] Обробка ${state.pendingUpdates.size} оновлень`);

        state.pendingUpdates.forEach(update => {
            try {
                update.fn();
            } catch (error) {
                console.error('❌ [WalletChecker-V2] Помилка оновлення:', error);
            }
        });

        state.pendingUpdates.clear();
        state.updateFrame = null;
    }

    /**
     * Запуск smart polling
     */
    function startSmartPolling() {
        console.log('🔄 [WalletChecker-V2] Запуск smart polling');

        // Перевірка підключення гаманця
        SmartPolling.start('walletConnection', async () => {
            const oldConnected = state.currentWallet.connected;
            await checkWalletConnection();
            return oldConnected !== state.currentWallet.connected;
        });

        // Перевірка балансу FLEX (тільки якщо підключено)
        SmartPolling.start('flexBalance', async () => {
            if (!state.currentWallet.connected || !state.currentWallet.address) {
                return false;
            }
            return await checkFlexBalanceOptimized(state.currentWallet.address);
        });
    }

    /**
     * Чекаємо на завантаження TON Connect UI
     */
    async function waitForTonConnectUI() {
        console.log('⏳ [WalletChecker-V2] Очікування TON Connect UI...');

        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20;

            const checkInterval = setInterval(() => {
                attempts++;

                if (window.TON_CONNECT_UI) {
                    clearInterval(checkInterval);
                    console.log('✅ [WalletChecker-V2] TON Connect UI знайдено');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('❌ [WalletChecker-V2] TON Connect UI не завантажено');
                    reject(new Error('TON Connect UI не завантажено'));
                }
            }, 500);
        });
    }

    /**
     * Ініціалізація TON Connect UI
     */
    async function initializeTonConnect() {
        console.log('🔧 [WalletChecker-V2] Ініціалізація TON Connect UI...');

        try {
            if (window.tonConnectUI) {
                console.log('✅ [WalletChecker-V2] Використовуємо існуючий TON Connect UI');
                state.tonConnectUI = window.tonConnectUI;

                state.tonConnectUI.onStatusChange(wallet => {
                    console.log('🔄 [WalletChecker-V2] Статус гаманця змінився');
                    handleWalletStatusChange(wallet);
                });

                return;
            }

            console.log('🔨 [WalletChecker-V2] Створюємо новий TON Connect UI...');

            state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: config.manifestUrl,
                buttonRootId: 'ton-connect-button',
                actionsConfiguration: {
                    twaReturnUrl: 'https://t.me/WINIX_Official_bot'
                }
            });

            window.tonConnectUI = state.tonConnectUI;

            state.tonConnectUI.onStatusChange(wallet => {
                console.log('🔄 [WalletChecker-V2] Статус гаманця змінився');
                handleWalletStatusChange(wallet);
            });

            console.log('✅ [WalletChecker-V2] TON Connect UI створено');

        } catch (error) {
            if (error.message?.includes('Cannot define multiple custom elements')) {
                console.warn('⚠️ [WalletChecker-V2] TON Connect вже визначено');

                await new Promise(resolve => setTimeout(resolve, 500));

                if (window.tonConnectUI) {
                    state.tonConnectUI = window.tonConnectUI;
                    console.log('✅ [WalletChecker-V2] Використовуємо існуючий TON Connect UI');
                    return;
                }
            }

            throw error;
        }
    }

    /**
     * Форматування адреси гаманця
     */
    function formatAddress(address) {
        if (!address || address.length < 20) return address;
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    }

    /**
     * Показати статус підключеного гаманця
     */
    function showWalletConnectedStatus(address) {
        console.log('💎 [WalletChecker-V2] Показуємо статус підключеного гаманця');

        const statusContainer = document.querySelector('.wallet-status-container');
        if (statusContainer) {
            statusContainer.style.display = 'none';
        }

        const connectedStatus = document.getElementById('wallet-connected-status');
        if (connectedStatus) {
            connectedStatus.style.display = 'block';

            const addressDisplay = document.getElementById('wallet-address-display');
            if (addressDisplay && address) {
                const formattedAddress = formatAddress(address);
                addressDisplay.textContent = formattedAddress;
            }
        }

        const tasksContainer = document.getElementById('flex-tasks');
        if (tasksContainer) {
            tasksContainer.style.display = 'block';
        }

        const tonConnectButton = document.getElementById('ton-connect-button');
        if (tonConnectButton) {
            tonConnectButton.style.display = 'none';
        }
    }

    /**
     * Показати UI для підключення гаманця
     */
    function showWalletConnectionUI() {
        console.log('🔌 [WalletChecker-V2] Показуємо UI для підключення');

        const connectedStatus = document.getElementById('wallet-connected-status');
        if (connectedStatus) {
            connectedStatus.style.display = 'none';
        }

        const statusContainer = document.querySelector('.wallet-status-container');
        if (statusContainer) {
            statusContainer.style.display = 'block';
        }

        const tasksContainer = document.getElementById('flex-tasks');
        if (tasksContainer) {
            tasksContainer.style.display = 'none';
        }

        const statusText = document.getElementById('wallet-connection-status');
        if (statusText) {
            statusText.textContent = 'Кошелек не підключено';
        }
    }

    /**
     * Отримати адреси з wallet об'єкта
     */
    function extractWalletAddresses(wallet) {
        if (!wallet?.account?.address) {
            return null;
        }

        const rawAddress = wallet.account.address;
        let userFriendlyAddress = null;

        // Список можливих полів
        const possibleFields = [
            'addressFriendly',
            'friendlyAddress',
            'userFriendlyAddress',
            'address_friendly',
            'user_friendly_address'
        ];

        for (const field of possibleFields) {
            if (wallet.account[field]) {
                userFriendlyAddress = wallet.account[field];
                break;
            }
        }

        // Якщо не знайдено, перевіряємо формат raw адреси
        if (!userFriendlyAddress) {
            if (rawAddress.startsWith('UQ') || rawAddress.startsWith('EQ')) {
                userFriendlyAddress = rawAddress;
            }
        }

        return {
            raw: rawAddress,
            userFriendly: userFriendlyAddress || rawAddress,
            needsConversion: !userFriendlyAddress && (rawAddress.startsWith('0:') || rawAddress.startsWith('-1:'))
        };
    }

    /**
     * Підключити гаманець - ОПТИМІЗОВАНА
     */
    async function connectWallet() {
        console.log('🔌 [WalletChecker-V2] === ПІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        if (state.tonConnectUI?.connected) {
            console.log('⚠️ [WalletChecker-V2] Гаманець вже підключено');
            window.TasksUtils?.showToast('Гаманець вже підключено', 'info');
            await checkWalletConnection();
            return;
        }

        if (state.isConnecting) {
            console.log('⏸️ [WalletChecker-V2] Підключення вже в процесі');
            return;
        }

        if (!state.isInitialized) {
            console.log('⚠️ [WalletChecker-V2] Модуль не ініціалізовано');
            try {
                await init();
            } catch (error) {
                console.error('❌ [WalletChecker-V2] Помилка ініціалізації:', error);
                window.TasksUtils?.showToast('Помилка ініціалізації системи гаманця', 'error');
                return;
            }
        }

        state.isConnecting = true;
        state.connectionAttempts++;

        try {
            updateConnectButton(true);

            await state.tonConnectUI.connectWallet();
            console.log('✅ [WalletChecker-V2] Запит на підключення відправлено');

            window.TasksUtils.showToast('Оберіть гаманець для підключення', 'info');

        } catch (error) {
            console.error('❌ [WalletChecker-V2] Помилка підключення:', error);

            if (error.message?.includes('wallet already connected')) {
                console.log('⚠️ [WalletChecker-V2] Гаманець вже був підключений');
                await checkWalletConnection();
                return;
            }

            if (state.connectionAttempts >= config.maxConnectionAttempts) {
                window.TasksUtils.showToast('Не вдалося підключити гаманець. Спробуйте пізніше', 'error');
                state.connectionAttempts = 0;
            } else {
                window.TasksUtils.showToast('Помилка підключення. Спробуйте ще раз', 'error');
            }
        } finally {
            state.isConnecting = false;
            setTimeout(() => updateConnectButton(false), 3000);
        }
    }

    /**
     * Оновити стан кнопки підключення
     */
    function updateConnectButton(isConnecting) {
        const buttons = document.querySelectorAll('.connect-wallet-redirect');
        buttons.forEach(button => {
            if (isConnecting) {
                button.disabled = true;
                button.textContent = 'Підключення...';
                button.style.opacity = '0.7';
            } else {
                button.disabled = false;
                button.textContent = 'Підключити кошелек';
                button.style.opacity = '';
            }
        });
    }

    /**
     * Відключити гаманець
     */
    async function disconnectWallet() {
        console.log('🔌 [WalletChecker-V2] === ВІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        const confirmed = confirm('Ви впевнені, що хочете відключити гаманець?');
        if (!confirmed) {
            console.log('❌ [WalletChecker-V2] Відключення скасовано');
            return;
        }

        try {
            if (state.tonConnectUI?.connected) {
                await state.tonConnectUI.disconnect();
            }

            console.log('✅ [WalletChecker-V2] Гаманець відключено');

            // Очищаємо всі дані
            state.currentWallet = {
                connected: false,
                address: null,
                rawAddress: null,
                provider: null,
                flexBalance: 0,
                lastUpdate: Date.now()
            };

            WalletCache.clear();
            saveWalletData();

            scheduleUpdate('disconnect', () => {
                window.TasksStore.actions.disconnectWallet();
                showWalletConnectionUI();
            });

            window.TasksUtils.showToast('Гаманець відключено', 'info');

            // Сповіщаємо бекенд
            if (state.userId) {
                try {
                    await window.TasksAPI.wallet.disconnect(state.userId);
                    console.log('✅ [WalletChecker-V2] Бекенд сповіщено');
                } catch (error) {
                    console.warn('⚠️ [WalletChecker-V2] Помилка сповіщення бекенду:', error);
                }
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V2] Помилка відключення:', error);
            window.TasksUtils.showToast('Помилка відключення гаманця', 'error');
        }
    }

    /**
     * Обробка зміни статусу гаманця
     */
    const handleWalletStatusChange = window.TasksUtils.debounce(async (wallet) => {
        console.log('🔄 [WalletChecker-V2] === ЗМІНА СТАТУСУ ГАМАНЦЯ ===');

        if (wallet) {
            console.log('✅ [WalletChecker-V2] Гаманець підключено');

            state.connectionAttempts = 0;
            state.isConnecting = false;

            updateConnectButton(false);

            const addresses = extractWalletAddresses(wallet);
            if (addresses) {
                state.currentWallet.address = addresses.userFriendly;
                state.currentWallet.rawAddress = addresses.raw;
                state.currentWallet.connected = true;
            }

            try {
                await verifyWalletOnBackend(wallet);
            } catch (error) {
                console.error('❌ [WalletChecker-V2] Помилка верифікації:', error);

                if (error.message?.includes('Network error') || error.message?.includes('500')) {
                    await disconnectWallet();
                }
            }

        } else {
            console.log('❌ [WalletChecker-V2] Гаманець відключено');

            state.currentWallet = {
                connected: false,
                address: null,
                rawAddress: null,
                provider: null,
                flexBalance: 0,
                lastUpdate: Date.now()
            };

            WalletCache.clear();
            saveWalletData();

            scheduleUpdate('status-disconnected', () => {
                window.TasksStore.actions.disconnectWallet();
                showWalletConnectionUI();
            });
        }
    }, 1000);

    /**
     * Оновити стан гаманця в Store
     */
    function updateWalletState(wallet, serverData) {
        console.log('🔄 [WalletChecker-V2] Оновлення стану гаманця');

        const store = window.TasksStore;

        scheduleUpdate('wallet-state', () => {
            store.actions.setWalletConnected(true);

            const walletData = serverData.wallet || serverData;
            const addresses = extractWalletAddresses(wallet);

            store.actions.setWalletAddress({
                address: walletData.address || addresses.userFriendly,
                rawAddress: walletData.raw_address || addresses.raw,
                chainId: wallet.account.chain,
                provider: wallet.device.appName,
                connected_at: walletData.connected_at,
                status: walletData.status
            });

            if (serverData.balance?.flex !== undefined) {
                store.actions.setFlexBalance(serverData.balance.flex);
            }

            showWalletConnectedStatus(walletData.address || addresses.userFriendly);
        });
    }

    /**
     * Показати бонус за перше підключення
     */
    function showFirstConnectionBonus(bonus) {
        if (!bonus || (!bonus.winix && !bonus.tickets && !bonus.amount)) {
            return;
        }

        let message = 'Вітаємо! Бонус за підключення гаманця: ';
        const winixAmount = bonus.winix || bonus.amount || 0;

        if (winixAmount > 0) {
            message += `+${winixAmount} WINIX`;
        }
        if (bonus.tickets) {
            message += ` та +${bonus.tickets} tickets`;
        }

        window.TasksUtils.showToast(message, 'success', 5000);

        scheduleUpdate('bonus', () => {
            const currentBalance = window.TasksStore.selectors.getUserBalance();

            window.TasksStore.actions.updateBalance({
                winix: currentBalance.winix + winixAmount,
                tickets: currentBalance.tickets + (bonus.tickets || 0)
            });
        });
    }

    /**
     * Налаштування слухачів подій
     */
    function setupEventListeners() {
        console.log('🎯 [WalletChecker-V2] Налаштування слухачів подій');

        // Видимість сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.isInitialized) {
                const timeSinceLastCheck = Date.now() - (state.lastCheckTime || 0);
                if (timeSinceLastCheck > 60000) {
                    console.log('👁️ [WalletChecker-V2] Сторінка активна, перевіряємо гаманець');
                    checkWalletConnection();
                }
            } else if (document.hidden) {
                // Призупиняємо polling при неактивній вкладці
                SmartPolling.stopAll();
            } else {
                // Відновлюємо polling
                startSmartPolling();
            }
        });

        // Фокус вікна
        window.addEventListener('focus', window.TasksUtils.debounce(() => {
            if (state.isInitialized) {
                const timeSinceLastCheck = Date.now() - (state.lastCheckTime || 0);
                if (timeSinceLastCheck > 60000) {
                    console.log('🔍 [WalletChecker-V2] Вікно у фокусі, перевіряємо гаманець');
                    checkWalletConnection();
                }
            }
        }, 1000));

        // Обробник кнопки відключення
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'wallet-disconnect-btn' || e.target.closest('#wallet-disconnect-btn')) {
                e.preventDefault();
                e.stopPropagation();
                await disconnectWallet();
            }
        });

        console.log('✅ [WalletChecker-V2] Слухачі подій налаштовано');
    }

    /**
     * Отримати статус модуля
     */
    function getStatus() {
        return {
            initialized: state.isInitialized,
            connected: state.currentWallet.connected,
            address: state.currentWallet.address,
            flexBalance: state.currentWallet.flexBalance,
            lastCheck: state.lastCheckTime,
            connectionAttempts: state.connectionAttempts,
            userId: state.userId,
            isConnecting: state.isConnecting,
            cacheSize: WalletCache.data.size,
            pendingRequests: RequestManager.pending.size,
            currentDelay: RequestManager.rateLimiter.currentDelay
        };
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [WalletChecker-V2] === ЗНИЩЕННЯ МОДУЛЯ ===');

        // Зупиняємо polling
        SmartPolling.stopAll();

        // Очищаємо кеш
        WalletCache.clear();

        // Скасовуємо pending оновлення
        if (state.updateFrame) {
            cancelAnimationFrame(state.updateFrame);
        }

        // Очищаємо TON Connect
        if (state.tonConnectUI) {
            state.tonConnectUI = null;
        }

        // Скидаємо стан
        state.isInitialized = false;
        state.lastCheckTime = null;
        state.connectionAttempts = 0;
        state.isConnecting = false;
        state.initPromise = null;
        state.currentWallet = {
            connected: false,
            address: null,
            rawAddress: null,
            provider: null,
            flexBalance: 0,
            lastUpdate: null
        };

        console.log('✅ [WalletChecker-V2] Модуль знищено');
    }

    console.log('✅ [WalletChecker-V2] Модуль перевірки гаманця готовий (ОПТИМІЗОВАНИЙ)');

    // Публічний API
    return {
        init,
        checkWalletConnection,
        connectWallet,
        disconnectWallet,
        checkFlexBalance: () => checkFlexBalanceOptimized(state.currentWallet.address),
        getStatus,
        destroy,

        // Для тестування
        _cache: WalletCache,
        _requestManager: RequestManager,
        _smartPolling: SmartPolling
    };

})();

console.log('✅ [WalletChecker-V2] Модуль експортовано глобально (ОПТИМІЗОВАНИЙ)');