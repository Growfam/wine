/**
 * Модуль перевірки TON гаманця для системи завдань WINIX
 * Інтеграція з TON Connect та сервером
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
        userId: null
    };

    // Конфігурація
    const config = {
        checkIntervalMs: window.TasksConstants?.TIMERS?.AUTO_CHECK_INTERVAL || 5 * 60 * 1000,
        maxConnectionAttempts: 3,
        manifestUrl: window.TasksConstants?.TON_CONNECT?.MANIFEST_URL || '/tonconnect-manifest.json',
        network: window.TasksConstants?.TON_CONNECT?.NETWORK || 'mainnet'
    };

    /**
     * Ініціалізація модуля
     */
async function init(userId = null) {
    console.log('🚀 [WalletChecker] Початок ініціалізації');
    console.log('⚙️ [WalletChecker] Конфігурація:', config);
    console.log('👤 [WalletChecker] Переданий userId:', userId);

    try {
        // Пріоритет: 1) переданий параметр, 2) Store, 3) WinixAPI
        if (userId) {
            state.userId = userId;
            console.log('✅ [WalletChecker] Використовуємо переданий userId:', userId);
        } else {
            // Спробуємо зі Store
            const storeUserId = window.TasksStore?.selectors?.getUserId?.();
            if (storeUserId) {
                state.userId = storeUserId;
                console.log('✅ [WalletChecker] userId отримано зі Store:', storeUserId);
            } else {
                // Спробуємо з WinixAPI
                const apiUserId = window.WinixAPI?.getUserId?.();
                if (apiUserId) {
                    state.userId = apiUserId;
                    console.log('✅ [WalletChecker] userId отримано з WinixAPI:', apiUserId);
                }
            }
        }

        // Конвертуємо в число якщо потрібно
        if (state.userId && typeof state.userId === 'string') {
            state.userId = parseInt(state.userId, 10);
            console.log('🔄 [WalletChecker] userId конвертовано в число:', state.userId);
        }

        if (!state.userId) {
            console.error('❌ [WalletChecker] User ID не знайдено в жодному джерелі');
            console.error('📊 [WalletChecker] Доступні джерела:', {
                parameter: userId,
                store: window.TasksStore?.selectors?.getUserId?.(),
                api: window.WinixAPI?.getUserId?.()
            });

            // Не кидаємо помилку одразу - даємо шанс працювати без userId
            console.warn('⚠️ [WalletChecker] Продовжуємо без userId - функціональність обмежена');
            // throw new Error('User ID not found');
        } else {
            console.log('✅ [WalletChecker] User ID успішно отримано:', state.userId);
        }

        console.log('✅ [WalletChecker] User ID отримано:', state.userId);

            // Перевіряємо наявність TON Connect
            if (!window.TON_CONNECT_UI) {
                console.error('❌ [WalletChecker] TON Connect UI не знайдено');
                throw new Error('TON Connect UI не завантажено');
            }

            // Ініціалізуємо TON Connect UI
            await initializeTonConnect();

            // Налаштовуємо слухачі подій
            setupEventListeners();

            // Запускаємо першу перевірку
            await checkWalletConnection();

            // Запускаємо періодичну перевірку
            startPeriodicCheck();

            state.isInitialized = true;
            console.log('✅ [WalletChecker] Модуль успішно ініціалізовано');

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка ініціалізації:', error);
            window.TasksUtils?.showToast('Помилка ініціалізації TON Connect', 'error');
            throw error;
        }
    }

   /**
 * Ініціалізація TON Connect UI
 */
async function initializeTonConnect() {
    console.log('🔧 [WalletChecker] Ініціалізація TON Connect UI...');

    try {
        // Перевіряємо чи вже існує кнопка TON Connect
        const existingButton = document.querySelector('tc-root');
        if (existingButton) {
            console.log('⚠️ [WalletChecker] TON Connect вже ініціалізовано, пропускаємо');

            // Якщо є глобальний об'єкт tonConnectUI, використовуємо його
            if (window.tonConnectUI) {
                state.tonConnectUI = window.tonConnectUI;
                console.log('✅ [WalletChecker] Використовуємо існуючий TON Connect UI');

                // Підписуємось на зміни статусу
                state.tonConnectUI.onStatusChange(wallet => {
                    console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
                    handleWalletStatusChange(wallet);
                });

                return;
            }
        }

        // Створюємо новий екземпляр тільки якщо його немає
        state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
            manifestUrl: config.manifestUrl,
            buttonRootId: 'ton-connect-button'
        });

        // Зберігаємо глобально для інших модулів
        window.tonConnectUI = state.tonConnectUI;

        console.log('✅ [WalletChecker] TON Connect UI ініціалізовано');
        console.log('📊 [WalletChecker] Manifest URL:', config.manifestUrl);

        // Підписуємось на зміни статусу
        state.tonConnectUI.onStatusChange(wallet => {
            console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
            handleWalletStatusChange(wallet);
        });

    } catch (error) {
        // Якщо помилка пов'язана з дублікатом custom element
        if (error.message && error.message.includes('Cannot define multiple custom elements')) {
            console.warn('⚠️ [WalletChecker] TON Connect вже визначено, спробуємо використати існуючий');

            // Чекаємо трохи і пробуємо знайти існуючий
            await new Promise(resolve => setTimeout(resolve, 100));

            if (window.tonConnectUI) {
                state.tonConnectUI = window.tonConnectUI;
                console.log('✅ [WalletChecker] Використовуємо існуючий TON Connect UI (після помилки)');
                return;
            }
        }

        console.error('❌ [WalletChecker] Помилка ініціалізації TON Connect:', error);
        throw error;
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

                // Перевіряємо/реєструємо гаманець на бекенді
                await verifyWalletOnBackend(wallet);

                state.lastCheckTime = Date.now();
                return true;

            } else {
                console.log('❌ [WalletChecker] Гаманець не підключено');

                // Оновлюємо стан
                store.actions.setWalletConnected(false);
                store.actions.disconnectWallet();

                // Показуємо UI для підключення
                showWalletConnectionUI();

                return false;
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка перевірки:', error);
            store.actions.setError('Помилка перевірки гаманця');
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

    // ВАЖЛИВО: Отримуємо правильну адресу
    const address = wallet.account.address;

    // Перевіряємо що це валідна TON адреса
    if (!address || (!address.startsWith('EQ') && !address.startsWith('UQ'))) {
        console.error('❌ [WalletChecker] Невалідна адреса гаманця:', address);
        throw new Error('Невалідна адреса TON гаманця');
    }

    const chain = wallet.account.chain || '-239';
    const publicKey = wallet.account.publicKey;

    console.log('📊 [WalletChecker] Дані для верифікації:', {
        userId: state.userId,
        address: address,  // <-- ЦЕ МАЄ БУТИ TON АДРЕСА!
        chain: chain,
        provider: wallet.device.appName
    });

    try {
        // Спочатку перевіряємо статус
        const statusResponse = await window.TasksAPI.wallet.checkStatus(state.userId);

        if (statusResponse.connected && statusResponse.address === address) {
            console.log('✅ [WalletChecker] Гаманець вже зареєстрований');
            updateWalletState(wallet, statusResponse);
            await checkFlexBalance(address);
            return;
        }

        // Реєструємо гаманець - userId в URL, адреса в body
        console.log('🔄 [WalletChecker] Реєстрація гаманця на сервері...');

        const connectResponse = await window.TasksAPI.wallet.connect(
            state.userId,  // userId для URL
            {
                address: address,  // TON адреса в body!
                chain: chain,
                publicKey: publicKey,
                provider: wallet.device.appName,
                timestamp: Date.now()
            }
        );

        console.log('✅ [WalletChecker] Відповідь від сервера:', connectResponse);

        if (connectResponse.success) {
            updateWalletState(wallet, connectResponse);

            if (connectResponse.firstConnection) {
                console.log('🎁 [WalletChecker] Перше підключення! Бонус нарахований');
                showFirstConnectionBonus(connectResponse.bonus);
            }

            await checkFlexBalance(address);
        } else {
            throw new Error(connectResponse.message || 'Failed to connect wallet');
        }

    } catch (error) {
        console.error('❌ [WalletChecker] Помилка верифікації на бекенді:', error);

        // Якщо помилка про невалідну адресу - показуємо детальніше
        if (error.message.includes('Невалідна адреса')) {
            window.TasksUtils?.showToast(
                'Невалідна адреса TON гаманця. Переконайтесь що гаманець підключений правильно.',
                'error'
            );
        } else {
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
        store.actions.setWalletAddress({
            address: wallet.account.address,
            chainId: wallet.account.chain,
            provider: wallet.device.appName
        });

        // Якщо сервер повернув додаткові дані
        if (serverData.flexBalance !== undefined) {
            store.actions.setFlexBalance(serverData.flexBalance);
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

        try {
            // Запитуємо сервер про доступні рівні
            const response = await window.TasksAPI.flex.checkLevels(state.userId, flexBalance);

            let availableCount = 0;

            Object.entries(response.levels).forEach(([levelKey, levelData]) => {
                // Оновлюємо доступність рівня в Store
                window.TasksStore.actions.setFlexLevelAvailable(levelKey, levelData.available);

                if (levelData.available && !levelData.claimedToday) {
                    availableCount++;
                }

                console.log(`📊 [WalletChecker] ${levelKey}:`, levelData);
            });

            console.log(`✅ [WalletChecker] Доступно рівнів для отримання: ${availableCount}`);

            if (availableCount > 0) {
                window.TasksUtils.showToast(
                    `Доступно ${availableCount} ${availableCount === 1 ? 'винагорода' : 'винагороди'}!`,
                    'success'
                );
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка перевірки рівнів:', error);
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

        console.log('✅ [WalletChecker] UI оновлено');
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
     * Підключити гаманець
     */
    async function connectWallet() {
        console.log('🔌 [WalletChecker] === ПІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        if (!state.tonConnectUI) {
            console.error('❌ [WalletChecker] TON Connect UI не ініціалізовано');
            return;
        }

        state.connectionAttempts++;
        console.log(`🔄 [WalletChecker] Спроба підключення #${state.connectionAttempts}`);

        try {
            // Відкриваємо модальне вікно підключення
            await state.tonConnectUI.connectWallet();
            console.log('✅ [WalletChecker] Запит на підключення відправлено');

            // Показуємо повідомлення
            window.TasksUtils.showToast('Оберіть гаманець для підключення', 'info');

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка підключення:', error);

            if (state.connectionAttempts >= config.maxConnectionAttempts) {
                console.error('❌ [WalletChecker] Досягнуто максимальну кількість спроб');
                window.TasksUtils.showToast('Не вдалося підключити гаманець. Спробуйте пізніше', 'error');
                state.connectionAttempts = 0;
            }
        }
    }

    /**
     * Відключити гаманець
     */
    async function disconnectWallet() {
        console.log('🔌 [WalletChecker] === ВІДКЛЮЧЕННЯ ГАМАНЦЯ ===');

        if (!state.tonConnectUI) {
            console.error('❌ [WalletChecker] TON Connect UI не ініціалізовано');
            return;
        }

        try {
            // Відключаємо на бекенді
            await window.TasksAPI.wallet.disconnect(state.userId);

            // Відключаємо в TON Connect
            await state.tonConnectUI.disconnect();

            console.log('✅ [WalletChecker] Гаманець відключено');

            // Оновлюємо стан
            window.TasksStore.actions.disconnectWallet();

            // Показуємо UI для підключення
            showWalletConnectionUI();

            window.TasksUtils.showToast('Гаманець відключено', 'info');

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

        if (wallet) {
            console.log('✅ [WalletChecker] Гаманець підключено:', wallet);

            // Скидаємо лічильник спроб
            state.connectionAttempts = 0;

            // Верифікуємо на бекенді
            try {
                await verifyWalletOnBackend(wallet);
            } catch (error) {
                // Якщо помилка верифікації - відключаємо
                console.error('❌ [WalletChecker] Помилка верифікації, відключаємо гаманець');
                await disconnectWallet();
            }

        } else {
            console.log('❌ [WalletChecker] Гаманець відключено');

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
        if (bonus.winix) message += `+${bonus.winix} WINIX`;
        if (bonus.tickets) message += ` та +${bonus.tickets} tickets`;

        window.TasksUtils.showToast(message, 'success', 5000);

        // Оновлюємо баланси
        const currentBalance = window.TasksStore.selectors.getUserBalance();
        window.TasksStore.actions.updateBalance({
            winix: currentBalance.winix + (bonus.winix || 0),
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

        // Кнопка підключення в нашому UI
        const connectButton = document.querySelector('.connect-wallet-redirect');
        if (connectButton) {
            connectButton.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('🖱️ [WalletChecker] Клік на кнопку підключення');

                // Якщо на сторінці earn - відкриваємо TON Connect
                if (window.location.pathname.includes('earn')) {
                    await connectWallet();
                } else {
                    // Інакше перенаправляємо на wallet.html
                    console.log('🚀 [WalletChecker] Перенаправлення на wallet.html');
                    window.location.href = 'wallet.html';
                }
            });
            console.log('✅ [WalletChecker] Обробник кнопки підключення додано');
        }

        // Слухач видимості сторінки
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.isInitialized) {
                console.log('👁️ [WalletChecker] Сторінка стала видимою, перевіряємо гаманець');
                checkWalletConnection();
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
            userId: state.userId
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
            // Не відключаємо автоматично, просто очищаємо слухачі
            state.tonConnectUI = null;
        }

        // Очищаємо стан
        state.isInitialized = false;
        state.lastCheckTime = null;
        state.connectionAttempts = 0;

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