/**
 * Модуль перевірки TON гаманця для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V3 - Використовує централізовані утиліти
 */

window.WalletChecker = (function() {
    'use strict';

    console.log('👛 [WalletChecker-V3] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // Namespace для кешування
    const CACHE_NAMESPACE = CacheManager.NAMESPACES.WALLET;

    // RequestManager клієнт
    const apiClient = RequestManager.createClient('wallet', {
        rateLimitDelay: 2000,
        maxRetries: 3
    });

    // EventBus namespace
    const eventBus = EventBus.createNamespace('wallet');

    // Мінімальний стан
    const state = {
        tonConnectUI: null,
        isInitialized: false,
        userId: null,
        isConnecting: false,
        initPromise: null,
        pollingInterval: null
    };

    // Конфігурація
    const config = {
        manifestUrl: window.TasksConstants?.TON_CONNECT?.MANIFEST_URL || '/tonconnect-manifest.json',
        network: window.TasksConstants?.TON_CONNECT?.NETWORK || 'mainnet',
        pollingIntervalMs: 30000 // 30 секунд
    };

    /**
     * Ініціалізація модуля
     */
    async function init(userId = null) {
        console.log('🚀 [WalletChecker-V3] Початок ініціалізації');

        if (state.isInitialized) {
            console.log('✅ [WalletChecker-V3] Вже ініціалізовано');
            return true;
        }

        if (state.initPromise) {
            console.log('⏳ [WalletChecker-V3] Ініціалізація в процесі');
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
            state.userId = userId || await getUserIdFromStore();

            if (!state.userId) {
                console.warn('⚠️ [WalletChecker-V3] User ID не знайдено');
            }

            // Завантажуємо кешовані дані
            const cachedWallet = CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`);
            if (cachedWallet) {
                updateWalletUI(cachedWallet);
            }

            // Ініціалізуємо TON Connect
            await initializeTonConnect();

            // Налаштовуємо підписки
            setupEventSubscriptions();

            // Запускаємо періодичну перевірку
            startPolling();

            state.isInitialized = true;

            // Емітуємо подію готовності
            EventBus.emit('manager.wallet.ready', { userId: state.userId });

            // Перша перевірка через 2 секунди
            setTimeout(() => checkWalletConnection(), 2000);

            console.log('✅ [WalletChecker-V3] Модуль ініціалізовано');
            return true;

        } catch (error) {
            console.error('❌ [WalletChecker-V3] Помилка ініціалізації:', error);
            window.TasksUtils?.showToast('Помилка ініціалізації TON Connect', 'error');
            throw error;
        }
    }

    /**
     * Отримання userId зі Store
     */
    async function getUserIdFromStore() {
        // Спочатку намагаємось отримати синхронно
        const userId = window.TasksStore?.selectors?.getUserId?.();
        if (userId) return userId;

        // Якщо не вдалось - чекаємо на подію
        return new Promise((resolve) => {
            const unsubscribe = EventBus.on(EventBus.EVENTS.USER_LOGGED_IN, (data) => {
                unsubscribe();
                resolve(data.userId);
            });

            // Таймаут 10 секунд
            setTimeout(() => {
                unsubscribe();
                resolve(null);
            }, 10000);
        });
    }

    /**
     * Ініціалізація TON Connect UI
     */
    async function initializeTonConnect() {
        console.log('🔧 [WalletChecker-V3] Ініціалізація TON Connect');

        // Перевіряємо чи вже існує
        if (window.tonConnectUI) {
            console.log('✅ [WalletChecker-V3] Використовуємо існуючий TON Connect UI');
            state.tonConnectUI = window.tonConnectUI;

            state.tonConnectUI.onStatusChange(handleWalletStatusChange);
            return;
        }

        // Чекаємо на завантаження
        await waitForTonConnectUI();

        try {
            state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: config.manifestUrl,
                buttonRootId: 'ton-connect-button',
                actionsConfiguration: {
                    twaReturnUrl: 'https://t.me/WINIX_Official_bot'
                }
            });

            window.tonConnectUI = state.tonConnectUI;

            state.tonConnectUI.onStatusChange(handleWalletStatusChange);

            console.log('✅ [WalletChecker-V3] TON Connect UI створено');

        } catch (error) {
            if (error.message?.includes('Cannot define multiple custom elements')) {
                console.warn('⚠️ [WalletChecker-V3] TON Connect вже визначено');

                await new Promise(resolve => setTimeout(resolve, 500));

                if (window.tonConnectUI) {
                    state.tonConnectUI = window.tonConnectUI;
                    state.tonConnectUI.onStatusChange(handleWalletStatusChange);
                    return;
                }
            }
            throw error;
        }
    }

    /**
     * Чекаємо на TON Connect UI
     */
    async function waitForTonConnectUI() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20;

            const checkInterval = setInterval(() => {
                attempts++;

                if (window.TON_CONNECT_UI) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('TON Connect UI не завантажено'));
                }
            }, 500);
        });
    }

    /**
     * Перевірка підключення гаманця
     */
    async function checkWalletConnection() {
        console.log('🔍 [WalletChecker-V3] Перевірка підключення');

        const store = window.TasksStore;
        if (!store) {
            console.error('❌ [WalletChecker-V3] Store не знайдено');
            return false;
        }

        // Оновлюємо стан перевірки
        store.actions.setWalletChecking(true);

        try {
            const isConnected = state.tonConnectUI?.connected || false;
            console.log('📊 [WalletChecker-V3] TON Connect статус:', isConnected);

            if (isConnected) {
                const wallet = state.tonConnectUI.wallet;
                const addresses = extractWalletAddresses(wallet);

                if (!addresses) {
                    throw new Error('Не вдалося отримати адреси гаманця');
                }

                // Перевіряємо кеш
                const cacheKey = `status_${state.userId}`;
                const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);

                if (cached && cached.address === addresses.userFriendly) {
                    console.log('✅ [WalletChecker-V3] Використовуємо кешований статус');
                    updateWalletState(wallet, cached);

                    // Перевіряємо баланс FLEX асинхронно
                    checkFlexBalance(addresses.userFriendly);

                    return true;
                }

                // Верифікуємо на бекенді
                await verifyWalletOnBackend(wallet);

                return true;

            } else {
                console.log('❌ [WalletChecker-V3] Гаманець не підключено');

                // Очищаємо дані
                CacheManager.invalidateNamespace(CACHE_NAMESPACE);

                // Оновлюємо Store
                store.actions.setWalletConnected(false);
                store.actions.disconnectWallet();

                // Оновлюємо UI
                updateWalletUI({ connected: false });

                return false;
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V3] Помилка перевірки:', error);

            if (!error.message?.includes('429')) {
                store.actions.setError('Помилка перевірки гаманця');
            }

            return false;

        } finally {
            store.actions.setWalletChecking(false);
        }
    }

    /**
     * Верифікація гаманця на бекенді
     */
    async function verifyWalletOnBackend(wallet) {
        console.log('🌐 [WalletChecker-V3] Верифікація на бекенді');

        const addresses = extractWalletAddresses(wallet);
        if (!addresses) {
            throw new Error('Адреси гаманця відсутні');
        }

        try {
            // Перевіряємо статус
            const statusResponse = await apiClient.execute(
                `check_status_${state.userId}`,
                () => window.TasksAPI.wallet.checkStatus(state.userId),
                { priority: 'high' }
            );

            if (statusResponse.data?.connected &&
                (statusResponse.data.address === addresses.userFriendly ||
                 statusResponse.data.address === addresses.raw)) {

                console.log('✅ [WalletChecker-V3] Гаманець вже зареєстрований');

                // Кешуємо
                CacheManager.set(CACHE_NAMESPACE, `status_${state.userId}`, statusResponse.data);

                updateWalletState(wallet, statusResponse.data);

                // Перевіряємо баланс FLEX
                checkFlexBalance(addresses.userFriendly);

                return;
            }

            // Реєструємо гаманець
            console.log('🔄 [WalletChecker-V3] Реєстрація гаманця');

            const walletData = {
                address: addresses.raw,
                addressFriendly: addresses.userFriendly,
                chain: wallet.account.chain || '-239',
                publicKey: wallet.account.publicKey || '',
                provider: wallet.device.appName || 'unknown',
                timestamp: Date.now()
            };

            const connectResponse = await apiClient.execute(
                `connect_${state.userId}`,
                () => window.TasksAPI.wallet.connect(state.userId, walletData),
                { priority: 'high', deduplicate: false }
            );

            if (connectResponse.status === 'success') {
                // Кешуємо
                CacheManager.set(CACHE_NAMESPACE, `status_${state.userId}`, connectResponse.data.wallet);

                updateWalletState(wallet, connectResponse.data);

                if (connectResponse.data?.first_connection) {
                    showFirstConnectionBonus(connectResponse.data.bonus);
                }

                // Перевіряємо баланс FLEX
                checkFlexBalance(addresses.userFriendly);
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V3] Помилка верифікації:', error);

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
     * Перевірка балансу FLEX
     */
    async function checkFlexBalance(address) {
        console.log('💎 [WalletChecker-V3] Перевірка балансу FLEX');

        const cacheKey = `flex_balance_${address}`;

        // Перевіряємо кеш
        const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
        if (cached !== null) {
            console.log('📦 [WalletChecker-V3] Використовуємо кешований баланс:', cached);
            updateFlexBalance(cached);
            return;
        }

        try {
            const response = await apiClient.execute(
                cacheKey,
                () => window.TasksAPI.flex.getBalance(state.userId, address),
                { priority: 'low' }
            );

            if (response.balance !== undefined) {
                const balance = parseInt(response.balance);

                // Кешуємо
                CacheManager.set(CACHE_NAMESPACE, cacheKey, balance, 30000); // 30 сек

                // Оновлюємо
                updateFlexBalance(balance);

                // Перевіряємо доступні рівні
                checkAvailableLevels(balance);
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V3] Помилка отримання балансу:', error);
        }
    }

    /**
     * Оновлення балансу FLEX
     */
    function updateFlexBalance(balance) {
        // Оновлюємо Store
        window.TasksStore.actions.setFlexBalance(balance);
        window.TasksStore.actions.updateBalance({ flex: balance });

        // Емітуємо подію
        EventBus.emit(EventBus.EVENTS.FLEX_BALANCE_UPDATED, {
            oldBalance: window.TasksStore.selectors.getFlexBalance(),
            newBalance: balance
        });
    }

    /**
     * Перевірка доступних рівнів
     */
    function checkAvailableLevels(flexBalance) {
        const flexLevels = window.TasksConstants?.FLEX_LEVELS || {};
        let availableCount = 0;

        Object.entries(flexLevels).forEach(([levelKey, levelData]) => {
            const isAvailable = flexBalance >= levelData.required;

            if (isAvailable) {
                availableCount++;
            }

            // Оновлюємо Store
            window.TasksStore.actions.setFlexLevelAvailable(levelKey, isAvailable);
        });

        if (availableCount > 0) {
            // Емітуємо подію доступних рівнів
            EventBus.emit(EventBus.EVENTS.FLEX_LEVEL_AVAILABLE, { count: availableCount });
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
        let userFriendlyAddress = wallet.account.addressFriendly ||
                                  wallet.account.friendlyAddress ||
                                  wallet.account.userFriendlyAddress;

        // Fallback для user-friendly адреси
        if (!userFriendlyAddress) {
            if (rawAddress.startsWith('UQ') || rawAddress.startsWith('EQ')) {
                userFriendlyAddress = rawAddress;
            }
        }

        return {
            raw: rawAddress,
            userFriendly: userFriendlyAddress || rawAddress
        };
    }

    /**
     * Підключити гаманець
     */
    async function connectWallet() {
        console.log('🔌 [WalletChecker-V3] Підключення гаманця');

        if (state.tonConnectUI?.connected) {
            console.log('⚠️ [WalletChecker-V3] Гаманець вже підключено');
            window.TasksUtils?.showToast('Гаманець вже підключено', 'info');
            await checkWalletConnection();
            return;
        }

        if (state.isConnecting) {
            console.log('⏸️ [WalletChecker-V3] Підключення вже в процесі');
            return;
        }

        state.isConnecting = true;

        try {
            updateConnectButton(true);

            await state.tonConnectUI.connectWallet();
            console.log('✅ [WalletChecker-V3] Запит на підключення відправлено');

            window.TasksUtils.showToast('Оберіть гаманець для підключення', 'info');

        } catch (error) {
            console.error('❌ [WalletChecker-V3] Помилка підключення:', error);

            if (error.message?.includes('wallet already connected')) {
                await checkWalletConnection();
                return;
            }

            window.TasksUtils.showToast('Помилка підключення гаманця', 'error');

        } finally {
            state.isConnecting = false;
            setTimeout(() => updateConnectButton(false), 3000);
        }
    }

    /**
     * Відключити гаманець
     */
    async function disconnectWallet() {
        console.log('🔌 [WalletChecker-V3] Відключення гаманця');

        const confirmed = confirm('Ви впевнені, що хочете відключити гаманець?');
        if (!confirmed) return;

        try {
            if (state.tonConnectUI?.connected) {
                await state.tonConnectUI.disconnect();
            }

            // Очищаємо кеш
            CacheManager.invalidateNamespace(CACHE_NAMESPACE);

            // Оновлюємо Store
            window.TasksStore.actions.disconnectWallet();

            // Оновлюємо UI
            updateWalletUI({ connected: false });

            window.TasksUtils.showToast('Гаманець відключено', 'info');

            // Сповіщаємо бекенд
            if (state.userId) {
                try {
                    await window.TasksAPI.wallet.disconnect(state.userId);
                } catch (error) {
                    console.warn('⚠️ [WalletChecker-V3] Помилка сповіщення бекенду:', error);
                }
            }

        } catch (error) {
            console.error('❌ [WalletChecker-V3] Помилка відключення:', error);
            window.TasksUtils.showToast('Помилка відключення гаманця', 'error');
        }
    }

    /**
     * Обробка зміни статусу гаманця
     */
    const handleWalletStatusChange = window.TasksUtils.debounce(async (wallet) => {
        console.log('🔄 [WalletChecker-V3] Зміна статусу гаманця');

        if (wallet) {
            console.log('✅ [WalletChecker-V3] Гаманець підключено');

            state.isConnecting = false;
            updateConnectButton(false);

            try {
                await verifyWalletOnBackend(wallet);
            } catch (error) {
                console.error('❌ [WalletChecker-V3] Помилка:', error);

                if (error.message?.includes('Network error')) {
                    await disconnectWallet();
                }
            }

        } else {
            console.log('❌ [WalletChecker-V3] Гаманець відключено');

            // Очищаємо кеш
            CacheManager.invalidateNamespace(CACHE_NAMESPACE);

            // Оновлюємо Store
            window.TasksStore.actions.disconnectWallet();

            // Оновлюємо UI
            updateWalletUI({ connected: false });
        }
    }, 1000);

    /**
     * Оновити стан гаманця в Store
     */
    function updateWalletState(wallet, serverData) {
        console.log('🔄 [WalletChecker-V3] Оновлення стану гаманця');

        const store = window.TasksStore;
        const addresses = extractWalletAddresses(wallet);

        store.actions.setWalletConnected(true);
        store.actions.setWalletAddress({
            address: serverData.address || addresses.userFriendly,
            rawAddress: serverData.raw_address || addresses.raw,
            chainId: wallet.account.chain,
            provider: wallet.device.appName,
            connected_at: serverData.connected_at,
            status: serverData.status
        });

        if (serverData.balance?.flex !== undefined) {
            store.actions.setFlexBalance(serverData.balance.flex);
        }

        // Оновлюємо UI
        updateWalletUI({
            connected: true,
            address: serverData.address || addresses.userFriendly
        });

        // Емітуємо подію
        EventBus.emit(EventBus.EVENTS.WALLET_CONNECTED, {
            address: serverData.address || addresses.userFriendly
        });
    }

    /**
     * Оновити UI гаманця
     */
    function updateWalletUI(walletData) {
        EventBus.emit('wallet.ui.update', walletData);

        // Мінімальне пряме оновлення
        if (walletData.connected) {
            const statusContainer = document.querySelector('.wallet-status-container');
            const tasksContainer = document.getElementById('flex-tasks');
            const connectedStatus = document.getElementById('wallet-connected-status');

            if (statusContainer) statusContainer.style.display = 'none';
            if (tasksContainer) tasksContainer.style.display = 'block';
            if (connectedStatus) connectedStatus.style.display = 'block';

            if (walletData.address) {
                const addressDisplay = document.getElementById('wallet-address-display');
                if (addressDisplay) {
                    addressDisplay.textContent = formatAddress(walletData.address);
                }
            }
        } else {
            const statusContainer = document.querySelector('.wallet-status-container');
            const tasksContainer = document.getElementById('flex-tasks');
            const connectedStatus = document.getElementById('wallet-connected-status');

            if (statusContainer) statusContainer.style.display = 'block';
            if (tasksContainer) tasksContainer.style.display = 'none';
            if (connectedStatus) connectedStatus.style.display = 'none';
        }
    }

    /**
     * Форматування адреси
     */
    function formatAddress(address) {
        if (!address || address.length < 20) return address;
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    }

    /**
     * Оновити кнопку підключення
     */
    function updateConnectButton(isConnecting) {
        const buttons = document.querySelectorAll('.connect-wallet-redirect');
        buttons.forEach(button => {
            button.disabled = isConnecting;
            button.textContent = isConnecting ? 'Підключення...' : 'Підключити кошелек';
            button.style.opacity = isConnecting ? '0.7' : '';
        });
    }

    /**
     * Показати бонус за перше підключення
     */
    function showFirstConnectionBonus(bonus) {
        if (!bonus || (!bonus.winix && !bonus.tickets && !bonus.amount)) {
            return;
        }

        const winixAmount = bonus.winix || bonus.amount || 0;
        let message = 'Вітаємо! Бонус за підключення гаманця: ';

        if (winixAmount > 0) {
            message += `+${winixAmount} WINIX`;
        }
        if (bonus.tickets) {
            message += ` та +${bonus.tickets} tickets`;
        }

        window.TasksUtils.showToast(message, 'success', 5000);

        // Оновлюємо баланс
        const currentBalance = window.TasksStore.selectors.getUserBalance();
        window.TasksStore.actions.updateBalance({
            winix: currentBalance.winix + winixAmount,
            tickets: currentBalance.tickets + (bonus.tickets || 0)
        });
    }

    /**
     * Запуск періодичної перевірки
     */
    function startPolling() {
        // Зупиняємо попередню
        stopPolling();

        state.pollingInterval = setInterval(() => {
            if (!document.hidden && state.isInitialized) {
                checkWalletConnection();
            }
        }, config.pollingIntervalMs);
    }

    /**
     * Зупинка періодичної перевірки
     */
    function stopPolling() {
        if (state.pollingInterval) {
            clearInterval(state.pollingInterval);
            state.pollingInterval = null;
        }
    }

    /**
     * Налаштування підписок на події
     */
    function setupEventSubscriptions() {
        // Видимість сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.isInitialized) {
                const lastCheck = CacheManager.get(CACHE_NAMESPACE, 'lastCheckTime') || 0;
                if (Date.now() - lastCheck > 60000) {
                    checkWalletConnection();
                }
            }
        });

        // Обробник кнопки відключення
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'wallet-disconnect-btn' ||
                e.target.closest('#wallet-disconnect-btn')) {
                e.preventDefault();
                await disconnectWallet();
            }
        });

        // Підписка на запит перевірки
        EventBus.on('wallet.check', () => {
            checkWalletConnection();
        });

        // Підписка на запит підключення
        EventBus.on('wallet.connect', () => {
            connectWallet();
        });
    }

    /**
     * Отримати статус
     */
    function getStatus() {
        return {
            initialized: state.isInitialized,
            connected: state.tonConnectUI?.connected || false,
            address: window.TasksStore?.selectors?.getWalletAddress(),
            flexBalance: window.TasksStore?.selectors?.getFlexBalance() || 0,
            userId: state.userId,
            isConnecting: state.isConnecting
        };
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [WalletChecker-V3] Знищення модуля');

        // Зупиняємо polling
        stopPolling();

        // Очищаємо стан
        state.isInitialized = false;
        state.isConnecting = false;
        state.tonConnectUI = null;

        console.log('✅ [WalletChecker-V3] Модуль знищено');
    }

    console.log('✅ [WalletChecker-V3] Модуль готовий');

    // Публічний API
    return {
        init,
        checkWalletConnection,
        connectWallet,
        disconnectWallet,
        checkFlexBalance: () => {
            const address = window.TasksStore?.selectors?.getWalletAddress();
            if (address) checkFlexBalance(address);
        },
        getStatus,
        destroy
    };

})();

console.log('✅ [WalletChecker-V3] Модуль експортовано глобально');