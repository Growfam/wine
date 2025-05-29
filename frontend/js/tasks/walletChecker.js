/**
 * Модуль перевірки TON гаманця для системи завдань WINIX
 * ВИПРАВЛЕНА ВЕРСІЯ - вирішує проблему 400 помилки
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
        apiCallDelay: 2000, // Затримка між API викликами для уникнення 429
        walletCache: null, // Кеш даних гаманця
        lastWalletAddress: null // Остання відома адреса
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

        // Якщо вже ініціалізовано - повертаємо true
        if (state.isInitialized) {
            console.log('✅ [WalletChecker] Модуль вже ініціалізовано');
            return true;
        }

        // Якщо ініціалізація в процесі - чекаємо її завершення
        if (state.initPromise) {
            console.log('⏳ [WalletChecker] Ініціалізація вже в процесі, чекаємо...');
            return state.initPromise;
        }

        // Створюємо проміс для ініціалізації
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
            // Отримуємо userId
            if (userId) {
                state.userId = userId;
                console.log('✅ [WalletChecker] Використовуємо переданий userId:', userId);
            } else {
                state.userId = await getUserIdFromSources();
                console.log('✅ [WalletChecker] userId отримано:', state.userId);
            }

            // Конвертуємо в число якщо потрібно
            if (state.userId && typeof state.userId === 'string') {
                state.userId = parseInt(state.userId, 10);
                console.log('🔄 [WalletChecker] userId конвертовано в число:', state.userId);
            }

            if (!state.userId) {
                console.warn('⚠️ [WalletChecker] User ID не знайдено - функціональність обмежена');
            }

            // Чекаємо на TON Connect UI
            await waitForTonConnectUI();

            // Ініціалізуємо TON Connect UI
            await initializeTonConnect();

            // Налаштовуємо слухачі подій
            setupEventListeners();

            // Запускаємо періодичну перевірку з затримкою
            setTimeout(() => {
                startPeriodicCheck();
            }, 10000); // Затримка 10 секунд перед першою перевіркою

            state.isInitialized = true;
            console.log('✅ [WalletChecker] Модуль успішно ініціалізовано');

            // Робимо доступним глобально для діагностики
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

        // Синхронні джерела
        const syncSources = [
            () => window.TasksStore?.selectors?.getUserId?.(),
            () => window.WinixAPI?.getUserId?.(),
            () => window.TasksIntegrationInstance?.userId,
            () => localStorage.getItem('telegram_user_id'),
            () => localStorage.getItem('user_id'),
            () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id
        ];

        // Спробуємо синхронні джерела
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

        // Якщо не знайдено - чекаємо
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

                if (attempts > 10) { // 5 секунд
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
            const maxAttempts = 20; // 10 секунд

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
            // Перевіряємо чи вже існує екземпляр
            if (window.tonConnectUI) {
                console.log('✅ [WalletChecker] Використовуємо існуючий TON Connect UI');
                state.tonConnectUI = window.tonConnectUI;

                // Підписуємось на зміни статусу
                state.tonConnectUI.onStatusChange(wallet => {
                    console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
                    handleWalletStatusChange(wallet);
                });

                return;
            }

            // Створюємо новий екземпляр
            console.log('🔨 [WalletChecker] Створюємо новий TON Connect UI...');

            state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: config.manifestUrl,
                buttonRootId: 'ton-connect-button',
                actionsConfiguration: {
                    twaReturnUrl: 'https://t.me/WINIX_Official_bot'
                }
            });

            // Зберігаємо глобально
            window.tonConnectUI = state.tonConnectUI;

            // Підписуємось на зміни статусу
            state.tonConnectUI.onStatusChange(wallet => {
                console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
                handleWalletStatusChange(wallet);
            });

            console.log('✅ [WalletChecker] TON Connect UI створено та налаштовано');

        } catch (error) {
            // Обробка помилки дублікату custom element
            if (error.message?.includes('Cannot define multiple custom elements')) {
                console.warn('⚠️ [WalletChecker] TON Connect вже визначено, використовуємо існуючий');

                // Чекаємо і пробуємо знайти існуючий
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
     * Затримка для API викликів (проти 429 помилок)
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

        // Встановлюємо стан перевірки
        store.actions.setWalletChecking(true);

        try {
            // Перевіряємо чи підключено гаманець через TON Connect
            const isConnected = state.tonConnectUI?.connected || false;
            console.log('📊 [WalletChecker] TON Connect статус:', isConnected);

            if (isConnected) {
                const wallet = state.tonConnectUI.wallet;
                console.log('✅ [WalletChecker] Гаманець підключено');
                console.log('📍 [WalletChecker] Адреса:', wallet.account.address);
                console.log('🏷️ [WalletChecker] Провайдер:', wallet.device.appName);

                // Зберігаємо адресу для майбутнього використання
                state.lastWalletAddress = wallet.account.address;

                // Затримка перед API викликом
                await rateLimit();

                // Перевіряємо/реєструємо гаманець на бекенді
                await verifyWalletOnBackend(wallet);

                state.lastCheckTime = Date.now();
                return true;

            } else {
                console.log('❌ [WalletChecker] Гаманець не підключено');

                // Очищаємо кеш
                state.walletCache = null;
                state.lastWalletAddress = null;

                // Оновлюємо стан
                store.actions.setWalletConnected(false);
                store.actions.disconnectWallet();

                // Показуємо UI для підключення
                showWalletConnectionUI();

                return false;
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка перевірки:', error);

            // Обробка специфічних помилок
            if (error.message?.includes('429')) {
                console.warn('⚠️ [WalletChecker] Rate limit exceeded, збільшуємо затримку');
                state.apiCallDelay = Math.min(state.apiCallDelay * 2, 60000); // Макс 1 хвилина
            }

            // Не показуємо помилку користувачу для 400/429
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
     * Верифікація гаманця на бекенді - ВИПРАВЛЕНА ВЕРСІЯ
     */
    async function verifyWalletOnBackend(wallet) {
        console.log('🌐 [WalletChecker] === ВЕРИФІКАЦІЯ НА БЕКЕНДІ ===');

        // Перевіряємо наявність wallet object
        if (!wallet || !wallet.account || !wallet.account.address) {
            console.error('❌ [WalletChecker] Wallet або адреса відсутні');
            throw new Error('Гаманець не підключено або адреса відсутня');
        }

        const address = wallet.account.address;

        // Базова валідація TON адреси
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
            // Затримка перед API викликом
            await rateLimit();

            // Перевірка кешу
            if (state.walletCache && state.walletCache.address === address) {
                console.log('📦 [WalletChecker] Використовуємо кешовані дані гаманця');
                updateWalletState(wallet, state.walletCache);
                await checkFlexBalance(address);
                return;
            }

            // Спочатку перевіряємо статус
            const statusResponse = await window.TasksAPI.wallet.checkStatus(state.userId);
            console.log('📊 [WalletChecker] Статус відповідь:', statusResponse);

            if (statusResponse.data && statusResponse.data.connected && statusResponse.data.address === address) {
                console.log('✅ [WalletChecker] Гаманець вже зареєстрований');

                // Кешуємо дані
                state.walletCache = statusResponse.data;

                updateWalletState(wallet, statusResponse.data);

                // Затримка перед наступним викликом
                await rateLimit();
                await checkFlexBalance(address);
                return;
            }

            // Затримка перед реєстрацією
            await rateLimit();

            // Реєструємо гаманець
            console.log('🔄 [WalletChecker] Реєстрація гаманця на сервері...');

            // Формуємо дані для відправки
            const walletData = {
                address: address,
                chain: chain,
                publicKey: publicKey,
                provider: wallet.device.appName || 'unknown',
                timestamp: Date.now()
            };

            console.log('📤 [WalletChecker] Дані для реєстрації:', walletData);

            const connectResponse = await window.TasksAPI.wallet.connect(state.userId, walletData);

            console.log('✅ [WalletChecker] Відповідь від сервера:', connectResponse);

            if (connectResponse.status === 'success') {
                // Кешуємо дані
                state.walletCache = connectResponse.data.wallet;

                updateWalletState(wallet, connectResponse.data);

                if (connectResponse.data && connectResponse.data.first_connection) {
                    console.log('🎁 [WalletChecker] Перше підключення! Бонус нарахований');
                    showFirstConnectionBonus(connectResponse.data.bonus);
                }

                // Затримка перед перевіркою балансу
                await rateLimit();
                await checkFlexBalance(address);
            } else {
                throw new Error(connectResponse.message || 'Failed to connect wallet');
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка верифікації на бекенді:', error);

            // Якщо помилка 400 з даними про те що гаманець вже підключений
            if (error.data && error.data.error_code === 'WALLET_ALREADY_CONNECTED') {
                console.log('⚠️ [WalletChecker] Гаманець вже підключений до іншого акаунта');
                window.TasksUtils?.showToast('Цей гаманець вже підключений до іншого акаунта', 'error');
                // Відключаємо гаманець в UI
                await disconnectWallet();
                return;
            }

            // Обробка помилки невалідної адреси
            if (error.data && error.data.error_code === 'INVALID_ADDRESS') {
                console.error('❌ [WalletChecker] Невалідна адреса гаманця');
                window.TasksUtils?.showToast('Невалідна адреса TON гаманця', 'error');
                return;
            }

            // Не показуємо toast для кожної помилки 400/429
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

        // Оновлюємо стан підключення
        store.actions.setWalletConnected(true);

        // Використовуємо дані з сервера якщо є, інакше з wallet
        const walletData = serverData.wallet || serverData;

        store.actions.setWalletAddress({
            address: wallet.account.address,
            chainId: wallet.account.chain,
            provider: wallet.device.appName,
            connected_at: walletData.connected_at,
            status: walletData.status
        });

        // Якщо сервер повернув додаткові дані
        if (serverData.balance && serverData.balance.flex !== undefined) {
            store.actions.setFlexBalance(serverData.balance.flex);
        }

        // Показуємо Flex завдання
        showFlexTasks();
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

                // Оновлюємо баланс в сторі
                window.TasksStore.actions.setFlexBalance(balance);
                window.TasksStore.actions.updateBalance({ flex: balance });

                // Перевіряємо доступні рівні
                await checkAvailableLevels(balance);
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка отримання балансу:', error);
            // Не блокуємо роботу при помилці балансу
        }
    }

    /**
     * Перевірка доступних рівнів
     */
    async function checkAvailableLevels(flexBalance) {
        console.log('🎯 [WalletChecker] Перевірка доступних рівнів...');
        console.log('💎 [WalletChecker] Поточний баланс:', window.TasksUtils.formatNumber(flexBalance));

        // Локальна перевірка без API виклику
        const flexLevels = window.TasksConstants?.FLEX_LEVELS || {};
        let availableCount = 0;

        Object.entries(flexLevels).forEach(([levelKey, levelData]) => {
            const isAvailable = flexBalance >= levelData.required;

            // Оновлюємо доступність рівня в Store
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
     * Показати UI для підключення гаманця
     */
    function showWalletConnectionUI() {
        console.log('🔌 [WalletChecker] Показуємо UI для підключення');

        // Показуємо кнопку TON Connect якщо є
        const tonConnectButton = document.getElementById('ton-connect-button');
        if (tonConnectButton) {
            tonConnectButton.style.display = 'block';
        }

        // Оновлюємо текст статусу
        const statusText = document.getElementById('wallet-connection-status');
        if (statusText) {
            statusText.textContent = 'Гаманець не підключено';
        }

        // Показуємо блок підключення
        const statusContainer = document.querySelector('.wallet-status-container');
        if (statusContainer) {
            statusContainer.style.display = 'block';
        }

        // Приховуємо завдання
        const tasksContainer = document.getElementById('flex-tasks');
        if (tasksContainer) {
            tasksContainer.style.display = 'none';
        }
    }

    /**
     * Показати Flex завдання
     */
    function showFlexTasks() {
        console.log('📋 [WalletChecker] Показуємо Flex завдання');

        // Приховуємо кнопку TON Connect
        const tonConnectButton = document.getElementById('ton-connect-button');
        if (tonConnectButton) {
            tonConnectButton.style.display = 'none';
        }

        // Приховуємо блок підключення
        const statusContainer = document.querySelector('.wallet-status-container');
        if (statusContainer) {
            statusContainer.style.display = 'none';
        }

        // Показуємо завдання
        const tasksContainer = document.getElementById('flex-tasks');
        if (tasksContainer) {
            tasksContainer.style.display = 'block';
        }
    }

    /**
     * Підключити гаманець - ОНОВЛЕНА ВЕРСІЯ
     */
    async function connectWallet() {
        console.log('🔌 [WalletChecker] === ПІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        // Перевіряємо чи вже підключено
        if (state.tonConnectUI?.connected) {
            console.log('⚠️ [WalletChecker] Гаманець вже підключено');
            window.TasksUtils?.showToast('Гаманець вже підключено', 'info');

            // Оновлюємо UI
            await checkWalletConnection();
            return;
        }

        // Перевіряємо чи вже йде процес підключення
        if (state.isConnecting) {
            console.log('⏸️ [WalletChecker] Підключення вже в процесі, ігноруємо');
            return;
        }

        // Перевіряємо ініціалізацію
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
            // Оновлюємо UI кнопки
            updateConnectButton(true);

            // Відкриваємо модальне вікно підключення
            await state.tonConnectUI.connectWallet();
            console.log('✅ [WalletChecker] Запит на підключення відправлено');

            // Показуємо повідомлення
            window.TasksUtils.showToast('Оберіть гаманець для підключення', 'info');

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка підключення:', error);

            // Обробка специфічної помилки "вже підключено"
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
            // Відновлюємо UI кнопки через 3 секунди
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

        try {
            // Відключаємо в TON Connect
            if (state.tonConnectUI?.connected) {
                await state.tonConnectUI.disconnect();
            }

            console.log('✅ [WalletChecker] Гаманець відключено');

            // Очищаємо кеш
            state.walletCache = null;
            state.lastWalletAddress = null;

            // Оновлюємо стан
            window.TasksStore.actions.disconnectWallet();

            // Показуємо UI для підключення
            showWalletConnectionUI();

            window.TasksUtils.showToast('Гаманець відключено', 'info');

            // НЕ викликаємо API для відключення - це викликає 404

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

        // Затримка для уникнення спаму API
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (wallet) {
            console.log('✅ [WalletChecker] Гаманець підключено:', wallet);

            // Скидаємо лічильник спроб
            state.connectionAttempts = 0;
            state.isConnecting = false;

            // Оновлюємо UI
            updateConnectButton(false);

            // Зберігаємо адресу
            state.lastWalletAddress = wallet.account.address;

            // Верифікуємо на бекенді з затримкою
            try {
                await rateLimit();
                await verifyWalletOnBackend(wallet);
            } catch (error) {
                console.error('❌ [WalletChecker] Помилка верифікації:', error);

                // НЕ відключаємо гаманець автоматично при помилці 400/429
                if (!error.message?.includes('400') && !error.message?.includes('429')) {
                    // Тільки при критичних помилках
                    if (error.message?.includes('Network error') || error.message?.includes('500')) {
                        await disconnectWallet();
                    }
                }
            }

        } else {
            console.log('❌ [WalletChecker] Гаманець відключено');

            // Очищаємо кеш
            state.walletCache = null;
            state.lastWalletAddress = null;

            // Оновлюємо стан
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

        // Показуємо повідомлення
        let message = 'Вітаємо! Бонус за підключення гаманця: ';
        if (bonus.winix || bonus.amount) {
            const amount = bonus.winix || bonus.amount;
            message += `+${amount} WINIX`;
        }
        if (bonus.tickets) {
            message += ` та +${bonus.tickets} tickets`;
        }

        window.TasksUtils.showToast(message, 'success', 5000);

        // Оновлюємо баланси
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

        // Очищаємо попередній інтервал якщо є
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

        // Слухач видимості сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.isInitialized) {
                const timeSinceLastCheck = Date.now() - (state.lastCheckTime || 0);
                if (timeSinceLastCheck > 60000) { // 1 хвилина
                    console.log('👁️ [WalletChecker] Сторінка стала видимою, перевіряємо гаманець');
                    checkWalletConnection();
                }
            }
        });

        // Слухач фокусу вікна
        window.addEventListener('focus', () => {
            if (state.isInitialized) {
                const timeSinceLastCheck = Date.now() - (state.lastCheckTime || 0);
                if (timeSinceLastCheck > 60000) { // 1 хвилина
                    console.log('🔍 [WalletChecker] Вікно у фокусі, перевіряємо гаманець');
                    checkWalletConnection();
                }
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

        // Зупиняємо періодичну перевірку
        stopPeriodicCheck();

        // Відключаємо TON Connect UI
        if (state.tonConnectUI) {
            state.tonConnectUI = null;
        }

        // Очищаємо стан
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