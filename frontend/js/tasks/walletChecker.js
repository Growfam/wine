/**
 * Модуль перевірки TON гаманця для системи завдань WINIX
 * Інтеграція з TON Connect
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
        connectionAttempts: 0
    };

    // Конфігурація
    const config = {
        checkIntervalMs: 5 * 60 * 1000, // 5 хвилин
        maxConnectionAttempts: 3,
        manifestUrl: 'https://winix.com/tonconnect-manifest.json',
        apiTimeout: 10000 // 10 секунд
    };

    /**
     * Ініціалізація модуля
     */
    async function init() {
        console.log('🚀 [WalletChecker] Початок ініціалізації');
        console.log('⚙️ [WalletChecker] Конфігурація:', config);

        try {
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
            throw error;
        }
    }

    /**
     * Ініціалізація TON Connect UI
     */
    async function initializeTonConnect() {
        console.log('🔧 [WalletChecker] Ініціалізація TON Connect UI...');

        try {
            state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
                manifestUrl: config.manifestUrl,
                buttonRootId: 'ton-connect-button'
            });

            console.log('✅ [WalletChecker] TON Connect UI ініціалізовано');
            console.log('📊 [WalletChecker] Manifest URL:', config.manifestUrl);

            // Підписуємось на зміни статусу
            state.tonConnectUI.onStatusChange(wallet => {
                console.log('🔄 [WalletChecker] Статус гаманця змінився:', wallet);
                handleWalletStatusChange(wallet);
            });

        } catch (error) {
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

                // Оновлюємо стан в сторі
                store.actions.setWalletConnected(true);
                store.actions.setWalletAddress({
                    address: wallet.account.address,
                    chainId: wallet.account.chain,
                    provider: wallet.device.appName
                });

                // Перевіряємо статус на бекенді
                await checkWalletOnBackend(wallet.account.address);

                // Перевіряємо баланс FLEX
                await checkFlexBalance(wallet.account.address);

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
     * Перевірка статусу гаманця на бекенді
     */
    async function checkWalletOnBackend(address) {
        console.log('🌐 [WalletChecker] Перевірка статусу на бекенді...');
        console.log('📍 [WalletChecker] Адреса для перевірки:', address);

        const userId = window.TasksStore.selectors.getUserId();
        if (!userId) {
            console.error('❌ [WalletChecker] User ID не знайдено');
            return;
        }

        try {
            const response = await window.TasksUtils.apiCall(`/wallet/status/${userId}`, {
                method: 'POST',
                body: {
                    address: address,
                    timestamp: Date.now()
                }
            });

            console.log('✅ [WalletChecker] Відповідь від бекенду:', response);

            if (response.status === 'success') {
                console.log('✅ [WalletChecker] Гаманець підтверджено на бекенді');

                // Якщо це перше підключення - нараховуємо бонус
                if (response.firstConnection) {
                    console.log('🎁 [WalletChecker] Перше підключення! Нараховуємо бонус');
                    await claimFirstConnectionBonus();
                }
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка перевірки на бекенді:', error);
            // Не блокуємо роботу при помилці бекенду
        }
    }

    /**
     * Перевірка балансу FLEX
     */
    async function checkFlexBalance(address) {
        console.log('💎 [WalletChecker] Перевірка балансу FLEX...');

        const userId = window.TasksStore.selectors.getUserId();
        if (!userId) {
            console.error('❌ [WalletChecker] User ID не знайдено');
            return;
        }

        try {
            const response = await window.TasksUtils.apiCall(`/flex/balance/${userId}`, {
                method: 'GET',
                headers: {
                    'X-Wallet-Address': address
                }
            });

            console.log('💰 [WalletChecker] Баланс FLEX:', response);

            if (response.balance !== undefined) {
                const balance = parseInt(response.balance);
                console.log('✅ [WalletChecker] Баланс отримано:', window.TasksUtils.formatNumber(balance));

                // Оновлюємо баланс в сторі
                window.TasksStore.actions.setFlexBalance(balance);
                window.TasksStore.actions.updateBalance({ flex: balance });

                // Перевіряємо доступні рівні
                checkAvailableLevels(balance);
            }

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка отримання балансу:', error);
            window.TasksUtils.showToast('Помилка отримання балансу FLEX', 'error');
        }
    }

    /**
     * Перевірка доступних рівнів
     */
    function checkAvailableLevels(flexBalance) {
        console.log('🎯 [WalletChecker] Перевірка доступних рівнів...');
        console.log('💎 [WalletChecker] Поточний баланс:', window.TasksUtils.formatNumber(flexBalance));

        const levels = window.TasksConstants.FLEX_LEVELS;
        let availableCount = 0;

        Object.entries(levels).forEach(([levelKey, levelData]) => {
            const isAvailable = flexBalance >= levelData.required;
            const isClaimed = window.TasksStore.selectors.isFlexLevelClaimed(levelKey);

            console.log(`📊 [WalletChecker] ${levelKey}:`, {
                required: window.TasksUtils.formatNumber(levelData.required),
                available: isAvailable,
                claimed: isClaimed
            });

            // Оновлюємо доступність рівня
            window.TasksStore.actions.setFlexLevelAvailable(levelKey, isAvailable);

            if (isAvailable && !isClaimed) {
                availableCount++;
            }
        });

        console.log(`✅ [WalletChecker] Доступно рівнів для отримання: ${availableCount}`);

        if (availableCount > 0) {
            window.TasksUtils.showToast(`Доступно ${availableCount} винагород!`, 'success');
        }
    }

    /**
     * Показати UI для підключення гаманця
     */
    function showWalletConnectionUI() {
        console.log('🔌 [WalletChecker] Показуємо UI для підключення');

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
            await state.tonConnectUI.disconnect();
            console.log('✅ [WalletChecker] Гаманець відключено');

            // Оновлюємо стан
            window.TasksStore.actions.disconnectWallet();

            // Показуємо UI для підключення
            showWalletConnectionUI();

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка відключення:', error);
        }
    }

    /**
     * Обробка зміни статусу гаманця
     */
    function handleWalletStatusChange(wallet) {
        console.log('🔄 [WalletChecker] === ОБРОБКА ЗМІНИ СТАТУСУ ===');

        if (wallet) {
            console.log('✅ [WalletChecker] Гаманець підключено:', wallet);

            // Скидаємо лічильник спроб
            state.connectionAttempts = 0;

            // Перевіряємо підключення
            checkWalletConnection();

        } else {
            console.log('❌ [WalletChecker] Гаманець відключено');

            // Оновлюємо стан
            window.TasksStore.actions.disconnectWallet();
            showWalletConnectionUI();
        }
    }

    /**
     * Нарахування бонусу за перше підключення
     */
    async function claimFirstConnectionBonus() {
        console.log('🎁 [WalletChecker] === НАРАХУВАННЯ БОНУСУ ЗА ПЕРШЕ ПІДКЛЮЧЕННЯ ===');

        const FIRST_CONNECTION_BONUS = {
            winix: 100,
            tickets: 5
        };

        try {
            // Показуємо повідомлення
            window.TasksUtils.showToast(
                `Вітаємо! +${FIRST_CONNECTION_BONUS.winix} WINIX та +${FIRST_CONNECTION_BONUS.tickets} tickets за підключення гаманця!`,
                'success'
            );

            // Оновлюємо баланси
            const currentBalance = window.TasksStore.selectors.getUserBalance();
            window.TasksStore.actions.updateBalance({
                winix: currentBalance.winix + FIRST_CONNECTION_BONUS.winix,
                tickets: currentBalance.tickets + FIRST_CONNECTION_BONUS.tickets
            });

            console.log('✅ [WalletChecker] Бонус нараховано:', FIRST_CONNECTION_BONUS);

        } catch (error) {
            console.error('❌ [WalletChecker] Помилка нарахування бонусу:', error);
        }
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

                // Перенаправляємо на сторінку wallet.html
                console.log('🚀 [WalletChecker] Перенаправлення на wallet.html');
                window.location.href = 'wallet.html';
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
            connectionAttempts: state.connectionAttempts
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
            state.tonConnectUI.disconnect();
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