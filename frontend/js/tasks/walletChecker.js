/**
 * Модуль перевірки TON гаманця для системи завдань WINIX
 * ВИПРАВЛЕНА ВЕРСІЯ - з правильним відображенням статусу та відключенням
 */

window.WalletChecker = (function() {
    'use strict';

    console.log('👛 [WalletChecker] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ПЕРЕВІРКИ ГАМАНЦЯ =====');

    // Стан модуля
    const state = {
        tonConnectUI: null,
        checkInterval: null,
        isInitialized: false,
        lastCheckTime: null,
        connectionAttempts: 0,
        userId: null,
        isConnecting: false,
        initPromise: null,
        lastApiCallTime: 0,
        apiCallDelay: 2000,
        walletCache: null,
        lastWalletAddress: null
    };

    // Конфігурація
    const config = {
        checkIntervalMs: window.TasksConstants?.TIMERS?.AUTO_CHECK_INTERVAL || 5 * 60 * 1000,
        maxConnectionAttempts: 3,
        manifestUrl: window.TasksConstants?.TON_CONNECT?.MANIFEST_URL || '/tonconnect-manifest.json',
        network: window.TasksConstants?.TON_CONNECT?.NETWORK || 'mainnet'
    };

    /**
     * Ініціалізація модуля з захистом від множинних викликів
     */
    async function init(userId = null) {
        console.log('🚀 [WalletChecker] Початок ініціалізації');

        if (state.isInitialized) {
            console.log('✅ [WalletChecker] Модуль вже ініціалізовано');
            return true;
        }

        if (state.initPromise) {
            console.log('⏳ [WalletChecker] Ініціалізація вже в процесі, чекаємо...');
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
     * Внутрішня функція ініціалізації
     */
    async function initInternal(userId) {
        try {
            if (userId) {
                state.userId = userId;
                console.log('✅ [WalletChecker] Використовуємо переданий userId:', userId);
            } else {
                state.userId = await getUserIdFromSources();
                console.log('✅ [WalletChecker] userId отримано:', state.userId);
            }

            if (state.userId && typeof state.userId === 'string') {
                state.userId = parseInt(state.userId, 10);
                console.log('🔄 [WalletChecker] userId конвертовано в число:', state.userId);
            }

            if (!state.userId) {
                console.warn('⚠️ [WalletChecker] User ID не знайдено - функціональність обмежена');
            }

            await waitForTonConnectUI();
            await initializeTonConnect();
            setupEventListeners();

            setTimeout(() => {
                startPeriodicCheck();
            }, 10000);

            state.isInitialized = true;
            console.log('✅ [WalletChecker] Модуль успішно ініціалізовано');

            window._walletCheckerState = state;

            return true;

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка ініціалізації:', error);
            window.TasksUtils?.showToast('Помилка ініціалізації TON Connect', 'error');
            throw error;
        }
    }

    /**
     * Отримання userId з різних джерел
     */
    async function getUserIdFromSources() {
        console.log('🔍 [WalletChecker] Пошук userId...');

        const syncSources = [
            () => window.TasksStore?.selectors?.getUserId?.(),
            () => window.WinixAPI?.getUserId?.(),
            () => window.TasksIntegrationInstance?.userId,
            () => localStorage.getItem('telegram_user_id'),
            () => localStorage.getItem('user_id'),
            () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id
        ];

        for (const source of syncSources) {
            try {
                const id = source();
                if (id && id !== 'undefined' && id !== 'null') {
                    return id;
                }
            } catch (e) {
                continue;
            }
        }

        console.log('⏳ [WalletChecker] userId не знайдено одразу, чекаємо...');

        return new Promise((resolve) => {
            let attempts = 0;
            const checkInterval = setInterval(() => {
                attempts++;

                for (const source of syncSources) {
                    try {
                        const id = source();
                        if (id && id !== 'undefined' && id !== 'null') {
                            clearInterval(checkInterval);
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
    }

    /**
     * Чекаємо на завантаження TON Connect UI
     */
    async function waitForTonConnectUI() {
        console.log('⏳ [WalletChecker] Очікування TON Connect UI...');

        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20;

            const checkInterval = setInterval(() => {
                attempts++;

                if (window.TON_CONNECT_UI) {
                    clearInterval(checkInterval);
                    console.log('✅ [WalletChecker] TON Connect UI знайдено');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('❌ [WalletChecker] TON Connect UI не завантажено');
                    reject(new Error('TON Connect UI не завантажено'));
                }
            }, 500);
        });
    }

    /**
     * Ініціалізація TON Connect UI
     */
    async function initializeTonConnect() {
        console.log('🔧 [WalletChecker] Ініціалізація TON Connect UI...');

        try {
            if (window.tonConnectUI) {
                console.log('✅ [WalletChecker] Використовуємо існуючий TON Connect UI');
                state.tonConnectUI = window.tonConnectUI;

                state.tonConnectUI.onStatusChange(wallet => {
                    console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
                    handleWalletStatusChange(wallet);
                });

                return;
            }

            console.log('🔨 [WalletChecker] Створюємо новий TON Connect UI...');

            state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: config.manifestUrl,
                buttonRootId: 'ton-connect-button',
                actionsConfiguration: {
                    twaReturnUrl: 'https://t.me/WINIX_Official_bot'
                }
            });

            window.tonConnectUI = state.tonConnectUI;

            state.tonConnectUI.onStatusChange(wallet => {
                console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
                handleWalletStatusChange(wallet);
            });

            console.log('✅ [WalletChecker] TON Connect UI створено та налаштовано');

        } catch (error) {
            if (error.message?.includes('Cannot define multiple custom elements')) {
                console.warn('⚠️ [WalletChecker] TON Connect вже визначено, використовуємо існуючий');

                await new Promise(resolve => setTimeout(resolve, 500));

                if (window.tonConnectUI) {
                    state.tonConnectUI = window.tonConnectUI;
                    console.log('✅ [WalletChecker] Використовуємо існуючий TON Connect UI');
                    return;
                }
            }

            throw error;
        }
    }

    /**
     * Затримка для API викликів
     */
    async function rateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - state.lastApiCallTime;

        if (timeSinceLastCall < state.apiCallDelay) {
            const waitTime = state.apiCallDelay - timeSinceLastCall;
            console.log(`⏳ [WalletChecker] Rate limit: чекаємо ${waitTime}мс`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        state.lastApiCallTime = Date.now();
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
        console.log('💎 [WalletChecker] Показуємо статус підключеного гаманця');

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
        console.log('🔌 [WalletChecker] Показуємо UI для підключення');

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
     * Перевірка підключення гаманця
     */
    async function checkWalletConnection() {
        console.log('🔍 [WalletChecker] === ПЕРЕВІРКА ПІДКЛЮЧЕННЯ ГАМАНЦЯ ===');
        console.log('🕐 [WalletChecker] Час перевірки:', new Date().toISOString());

        const store = window.TasksStore;
        if (!store) {
            console.error('❌ [WalletChecker] Store не знайдено');
            return false;
        }

        store.actions.setWalletChecking(true);

        try {
            const isConnected = state.tonConnectUI?.connected || false;
            console.log('📊 [WalletChecker] TON Connect статус:', isConnected);

            if (isConnected) {
                const wallet = state.tonConnectUI.wallet;
                console.log('✅ [WalletChecker] Гаманець підключено');
                console.log('📍 [WalletChecker] Адреса:', wallet.account.address);
                console.log('🏷️ [WalletChecker] Провайдер:', wallet.device.appName);

                state.lastWalletAddress = wallet.account.address;

                showWalletConnectedStatus(wallet.account.address);

                await rateLimit();
                await verifyWalletOnBackend(wallet);

                state.lastCheckTime = Date.now();
                return true;

            } else {
                console.log('❌ [WalletChecker] Гаманець не підключено');

                state.walletCache = null;
                state.lastWalletAddress = null;

                store.actions.setWalletConnected(false);
                store.actions.disconnectWallet();

                showWalletConnectionUI();

                return false;
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка перевірки:', error);

            if (error.message?.includes('429')) {
                console.warn('⚠️ [WalletChecker] Rate limit exceeded, збільшуємо затримку');
                state.apiCallDelay = Math.min(state.apiCallDelay * 2, 60000);
            }

            if (!error.message?.includes('400') && !error.message?.includes('429')) {
                store.actions.setError('Помилка перевірки гаманця');
            }

            return false;

        } finally {
            store.actions.setWalletChecking(false);
            console.log('✅ [WalletChecker] Перевірка завершена');
        }
    }

    /**
     * Верифікація гаманця на бекенді
     */
    async function verifyWalletOnBackend(wallet) {
        console.log('🌐 [WalletChecker] === ВЕРИФІКАЦІЯ НА БЕКЕНДІ ===');

        if (!wallet || !wallet.account || !wallet.account.address) {
            console.error('❌ [WalletChecker] Wallet або адреса відсутні');
            throw new Error('Гаманець не підключено або адреса відсутня');
        }

        // TON Connect v2+ повинен надавати обидві адреси
const rawAddress = wallet.account.address;
const userFriendlyAddress = wallet.account.publicKey
    ? await formatAddressToUserFriendly(rawAddress, wallet.account.publicKey)
    : rawAddress;

// Або перевірте чи є метод в TON Connect
const tonConnectAddress = state.tonConnectUI.account?.address;
const tonConnectFriendlyAddress = state.tonConnectUI.account?.addressFriendly
    || state.tonConnectUI.account?.userFriendlyAddress;

console.log('📍 Адреси від TON Connect:', {
    raw: rawAddress,
    friendly: userFriendlyAddress,
    tonConnectAddress: tonConnectAddress,
    tonConnectFriendly: tonConnectFriendlyAddress
});

const walletData = {
    address: rawAddress,
    addressFriendly: userFriendlyAddress || tonConnectFriendlyAddress || rawAddress,
    chain: chain,
    publicKey: publicKey,
    provider: wallet.device.appName || 'unknown',
    timestamp: Date.now()
};

        console.log('🔍 [WalletChecker] ДЕТАЛЬНИЙ АНАЛІЗ WALLET OBJECT:');
console.log('📦 Повний wallet об\'єкт:', wallet);
console.log('📦 wallet.account:', wallet.account);
console.log('📦 Всі ключі wallet.account:', Object.keys(wallet.account));
console.log('📦 address формат:', address);
console.log('📦 Чи починається з 0:?', address.startsWith('0:'));
console.log('📦 Чи починається з UQ?', address.startsWith('UQ'));

        if (!address || typeof address !== 'string' || address.length < 10) {
            console.error('❌ [WalletChecker] Невалідний формат адреси:', address);
            throw new Error('Невалідний формат адреси TON гаманця');
        }

        console.log('✅ [WalletChecker] Адреса для верифікації:', address);

        const chain = wallet.account.chain || '-239';
        const publicKey = wallet.account.publicKey || '';

        console.log('📊 [WalletChecker] Дані для верифікації:', {
            userId: state.userId,
            address: address,
            chain: chain,
            provider: wallet.device.appName
        });

        try {
            await rateLimit();

            if (state.walletCache && state.walletCache.address === address) {
                console.log('📦 [WalletChecker] Використовуємо кешовані дані гаманця');
                updateWalletState(wallet, state.walletCache);
                await checkFlexBalance(address);
                return;
            }

            const statusResponse = await window.TasksAPI.wallet.checkStatus(state.userId);
            console.log('📊 [WalletChecker] Статус відповідь:', statusResponse);

            if (statusResponse.data && statusResponse.data.connected && statusResponse.data.address === address) {
                console.log('✅ [WalletChecker] Гаманець вже зареєстрований');

                state.walletCache = statusResponse.data;
                updateWalletState(wallet, statusResponse.data);

                await rateLimit();
                await checkFlexBalance(address);
                return;
            }

            await rateLimit();

            console.log('🔄 [WalletChecker] Реєстрація гаманця на сервері...');

// Спробуємо отримати addressFriendly з різних джерел
let addressFriendly = null;

// Варіант 1: Можливо є в іншому полі
if (wallet.account.addressFriendly) {
    addressFriendly = wallet.account.addressFriendly;
} else if (wallet.account.friendlyAddress) {
    addressFriendly = wallet.account.friendlyAddress;
} else if (wallet.account.userFriendlyAddress) {
    addressFriendly = wallet.account.userFriendlyAddress;
}

// Логування для дебагу
console.log('🔍 [WalletChecker] Пошук addressFriendly:', {
    addressFriendly: addressFriendly,
    address: address,
    allKeys: Object.keys(wallet.account)
});

const walletData = {
    address: address,
    addressFriendly: addressFriendly || address, // Використовуємо address як fallback
    chain: chain,
    publicKey: publicKey,
    provider: wallet.device.appName || 'unknown',
    timestamp: Date.now()
};

            console.log('📤 [WalletChecker] Дані для реєстрації:', walletData);

            const connectResponse = await window.TasksAPI.wallet.connect(state.userId, walletData);

            console.log('✅ [WalletChecker] Відповідь від сервера:', connectResponse);

            if (connectResponse.status === 'success') {
                state.walletCache = connectResponse.data.wallet;
                updateWalletState(wallet, connectResponse.data);

                if (connectResponse.data && connectResponse.data.first_connection) {
                    console.log('🎁 [WalletChecker] Перше підключення! Бонус нарахований');
                    showFirstConnectionBonus(connectResponse.data.bonus);
                }

                await rateLimit();
                await checkFlexBalance(address);
            } else {
                throw new Error(connectResponse.message || 'Failed to connect wallet');
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка верифікації на бекенді:', error);

            if (error.data && error.data.error_code === 'WALLET_ALREADY_CONNECTED') {
                console.log('⚠️ [WalletChecker] Гаманець вже підключений до іншого акаунта');
                window.TasksUtils?.showToast('Цей гаманець вже підключений до іншого акаунта', 'error');
                await disconnectWallet();
                return;
            }

            if (error.data && error.data.error_code === 'INVALID_ADDRESS') {
                console.error('❌ [WalletChecker] Невалідна адреса гаманця');
                window.TasksUtils?.showToast('Невалідна адреса TON гаманця', 'error');
                return;
            }

            if (!error.message?.includes('400') && !error.message?.includes('429')) {
                window.TasksUtils?.showToast(
                    error.message || 'Помилка підключення гаманця',
                    'error'
                );
            }

            throw error;
        }
    }

    /**
     * Оновити стан гаманця в Store
     */
    function updateWalletState(wallet, serverData) {
        console.log('🔄 [WalletChecker] Оновлення стану гаманця');

        const store = window.TasksStore;

        store.actions.setWalletConnected(true);

        const walletData = serverData.wallet || serverData;

        store.actions.setWalletAddress({
            address: wallet.account.address,
            chainId: wallet.account.chain,
            provider: wallet.device.appName,
            connected_at: walletData.connected_at,
            status: walletData.status
        });

        if (serverData.balance && serverData.balance.flex !== undefined) {
            store.actions.setFlexBalance(serverData.balance.flex);
        }

        showWalletConnectedStatus(wallet.account.address);
    }

    /**
     * Перевірка балансу FLEX
     */
    async function checkFlexBalance(address) {
        console.log('💎 [WalletChecker] === ПЕРЕВІРКА БАЛАНСУ FLEX ===');

        try {
            const response = await window.TasksAPI.flex.getBalance(state.userId, address);

            console.log('💰 [WalletChecker] Баланс FLEX:', response);

            if (response.balance !== undefined) {
                const balance = parseInt(response.balance);
                console.log('✅ [WalletChecker] Баланс отримано:', window.TasksUtils.formatNumber(balance));

                window.TasksStore.actions.setFlexBalance(balance);
                window.TasksStore.actions.updateBalance({ flex: balance });

                await checkAvailableLevels(balance);
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка отримання балансу:', error);
        }
    }

    /**
     * Перевірка доступних рівнів
     */
    async function checkAvailableLevels(flexBalance) {
        console.log('🎯 [WalletChecker] Перевірка доступних рівнів...');
        console.log('💎 [WalletChecker] Поточний баланс:', window.TasksUtils.formatNumber(flexBalance));

        const flexLevels = window.TasksConstants?.FLEX_LEVELS || {};
        let availableCount = 0;

        Object.entries(flexLevels).forEach(([levelKey, levelData]) => {
            const isAvailable = flexBalance >= levelData.required;

            window.TasksStore.actions.setFlexLevelAvailable(levelKey, isAvailable);

            if (isAvailable) {
                availableCount++;
            }

            console.log(`📊 [WalletChecker] ${levelKey}: ${isAvailable ? 'доступний' : 'недоступний'}`);
        });

        console.log(`✅ [WalletChecker] Доступно рівнів: ${availableCount}`);

        if (availableCount > 0) {
            window.TasksUtils.showToast(
                `Доступно ${availableCount} ${availableCount === 1 ? 'рівень' : 'рівнів'} для отримання винагород!`,
                'success'
            );
        }
    }

    /**
     * Підключити гаманець
     */
    async function connectWallet() {
        console.log('🔌 [WalletChecker] === ПІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        if (state.tonConnectUI?.connected) {
            console.log('⚠️ [WalletChecker] Гаманець вже підключено');
            window.TasksUtils?.showToast('Гаманець вже підключено', 'info');
            await checkWalletConnection();
            return;
        }

        if (state.isConnecting) {
            console.log('⏸️ [WalletChecker] Підключення вже в процесі, ігноруємо');
            return;
        }

        if (!state.isInitialized) {
            console.log('⚠️ [WalletChecker] Модуль не ініціалізовано, запускаємо ініціалізацію...');

            try {
                await init();
            } catch (error) {
                console.error('❌ [WalletChecker] Помилка ініціалізації:', error);
                window.TasksUtils?.showToast('Помилка ініціалізації системи гаманця', 'error');
                return;
            }
        }

        if (!state.tonConnectUI) {
            console.error('❌ [WalletChecker] TON Connect UI не доступний після ініціалізації');
            window.TasksUtils?.showToast('Система підключення гаманця не готова', 'error');
            return;
        }

        state.isConnecting = true;
        state.connectionAttempts++;
        console.log(`🔄 [WalletChecker] Спроба підключення #${state.connectionAttempts}`);

        try {
            updateConnectButton(true);

            await state.tonConnectUI.connectWallet();
            console.log('✅ [WalletChecker] Запит на підключення відправлено');

            window.TasksUtils.showToast('Оберіть гаманець для підключення', 'info');

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка підключення:', error);

            if (error.message?.includes('wallet already connected')) {
                console.log('⚠️ [WalletChecker] Гаманець вже був підключений, оновлюємо стан');
                await checkWalletConnection();
                return;
            }

            if (state.connectionAttempts >= config.maxConnectionAttempts) {
                console.error('❌ [WalletChecker] Досягнуто максимальну кількість спроб');
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
        console.log('🔌 [WalletChecker] === ВІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        const confirmed = confirm('Ви впевнені, що хочете відключити гаманець?');
        if (!confirmed) {
            console.log('❌ [WalletChecker] Відключення скасовано користувачем');
            return;
        }

        try {
            if (state.tonConnectUI?.connected) {
                await state.tonConnectUI.disconnect();
            }

            console.log('✅ [WalletChecker] Гаманець відключено');

            state.walletCache = null;
            state.lastWalletAddress = null;

            window.TasksStore.actions.disconnectWallet();

            showWalletConnectionUI();

            window.TasksUtils.showToast('Гаманець відключено', 'info');

            if (state.userId) {
                try {
                    await window.TasksAPI.wallet.disconnect(state.userId);
                    console.log('✅ [WalletChecker] Бекенд сповіщено про відключення');
                } catch (error) {
                    console.warn('⚠️ [WalletChecker] Помилка сповіщення бекенду:', error);
                }
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка відключення:', error);
            window.TasksUtils.showToast('Помилка відключення гаманця', 'error');
        }
    }

    /**
     * Обробка зміни статусу гаманця
     */
    async function handleWalletStatusChange(wallet) {
        console.log('🔄 [WalletChecker] === ОБРОБКА ЗМІНИ СТАТУСУ ===');

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (wallet) {
            console.log('✅ [WalletChecker] Гаманець підключено:', wallet);

            state.connectionAttempts = 0;
            state.isConnecting = false;

            updateConnectButton(false);

            state.lastWalletAddress = wallet.account.address;

            try {
                await rateLimit();
                await verifyWalletOnBackend(wallet);
            } catch (error) {
                console.error('❌ [WalletChecker] Помилка верифікації:', error);

                if (!error.message?.includes('400') && !error.message?.includes('429')) {
                    if (error.message?.includes('Network error') || error.message?.includes('500')) {
                        await disconnectWallet();
                    }
                }
            }

        } else {
            console.log('❌ [WalletChecker] Гаманець відключено');

            state.walletCache = null;
            state.lastWalletAddress = null;

            window.TasksStore.actions.disconnectWallet();
            showWalletConnectionUI();
        }
    }

    /**
     * Показати бонус за перше підключення
     */
    function showFirstConnectionBonus(bonus) {
        console.log('🎁 [WalletChecker] === БОНУС ЗА ПЕРШЕ ПІДКЛЮЧЕННЯ ===');

        if (!bonus || (!bonus.winix && !bonus.tickets)) {
            console.warn('⚠️ [WalletChecker] Бонус не наданий');
            return;
        }

        let message = 'Вітаємо! Бонус за підключення гаманця: ';
        if (bonus.winix || bonus.amount) {
            const amount = bonus.winix || bonus.amount;
            message += `+${amount} WINIX`;
        }
        if (bonus.tickets) {
            message += ` та +${bonus.tickets} tickets`;
        }

        window.TasksUtils.showToast(message, 'success', 5000);

        const currentBalance = window.TasksStore.selectors.getUserBalance();
        const winixBonus = bonus.winix || bonus.amount || 0;

        window.TasksStore.actions.updateBalance({
            winix: currentBalance.winix + winixBonus,
            tickets: currentBalance.tickets + (bonus.tickets || 0)
        });

        console.log('✅ [WalletChecker] Бонус нараховано:', bonus);
    }

    /**
     * Запуск періодичної перевірки
     */
    function startPeriodicCheck() {
        console.log('⏰ [WalletChecker] Запуск періодичної перевірки');
        console.log(`⏱️ [WalletChecker] Інтервал: ${config.checkIntervalMs / 1000 / 60} хвилин`);

        if (state.checkInterval) {
            clearInterval(state.checkInterval);
        }

        state.checkInterval = setInterval(() => {
            console.log('🔄 [WalletChecker] === ПЕРІОДИЧНА ПЕРЕВІРКА ===');
            checkWalletConnection();
        }, config.checkIntervalMs);

        console.log('✅ [WalletChecker] Періодична перевірка запущена');
    }

    /**
     * Зупинка періодичної перевірки
     */
    function stopPeriodicCheck() {
        console.log('⏹️ [WalletChecker] Зупинка періодичної перевірки');

        if (state.checkInterval) {
            clearInterval(state.checkInterval);
            state.checkInterval = null;
            console.log('✅ [WalletChecker] Періодична перевірка зупинена');
        }
    }

    /**
     * Налаштування слухачів подій
     */
    function setupEventListeners() {
        console.log('🎯 [WalletChecker] Налаштування слухачів подій');

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.isInitialized) {
                const timeSinceLastCheck = Date.now() - (state.lastCheckTime || 0);
                if (timeSinceLastCheck > 60000) {
                    console.log('👁️ [WalletChecker] Сторінка стала видимою, перевіряємо гаманець');
                    checkWalletConnection();
                }
            }
        });

        window.addEventListener('focus', () => {
            if (state.isInitialized) {
                const timeSinceLastCheck = Date.now() - (state.lastCheckTime || 0);
                if (timeSinceLastCheck > 60000) {
                    console.log('🔍 [WalletChecker] Вікно у фокусі, перевіряємо гаманець');
                    checkWalletConnection();
                }
            }
        });

        // Обробник кнопки відключення
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'wallet-disconnect-btn' || e.target.closest('#wallet-disconnect-btn')) {
                e.preventDefault();
                e.stopPropagation();
                await disconnectWallet();
            }
        });

        console.log('✅ [WalletChecker] Слухачі подій налаштовано');
    }

    /**
     * Отримати статус модуля
     */
    function getStatus() {
        return {
            initialized: state.isInitialized,
            connected: state.tonConnectUI?.connected || false,
            lastCheck: state.lastCheckTime,
            connectionAttempts: state.connectionAttempts,
            userId: state.userId,
            isConnecting: state.isConnecting,
            lastWalletAddress: state.lastWalletAddress,
            hasCachedData: !!state.walletCache
        };
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [WalletChecker] === ЗНИЩЕННЯ МОДУЛЯ ===');

        stopPeriodicCheck();

        if (state.tonConnectUI) {
            state.tonConnectUI = null;
        }

        state.isInitialized = false;
        state.lastCheckTime = null;
        state.connectionAttempts = 0;
        state.isConnecting = false;
        state.initPromise = null;
        state.walletCache = null;
        state.lastWalletAddress = null;

        console.log('✅ [WalletChecker] Модуль знищено');
    }

    console.log('✅ [WalletChecker] Модуль перевірки гаманця готовий');

    // Публічний API
    return {
        init,
        checkWalletConnection,
        connectWallet,
        disconnectWallet,
        checkFlexBalance,
        getStatus,
        destroy
    };

})();

console.log('✅ [WalletChecker] Модуль експортовано глобально');