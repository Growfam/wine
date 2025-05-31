/**
 * Модуль Flex Earn для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V3 - Використовує централізовані утиліти
 */

window.FlexEarnManager = (function() {
    'use strict';

    console.log('💎 [FlexEarn-V3] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // Конфігурація Flex рівнів
    const FLEX_LEVELS = window.TasksConstants?.FLEX_LEVELS || {};

    // Namespace для кешування
    const CACHE_NAMESPACE = CacheManager.NAMESPACES.FLEX;

    // RequestManager клієнт
    const apiClient = RequestManager.createClient('flexEarn');

    // EventBus namespace
    const eventBus = EventBus.createNamespace('flexEarn');

    // Мінімальний стан
    const state = {
        userId: null,
        isInitialized: false,
        walletChecker: null,
        unsubscribeCallbacks: []
    };

    /**
     * Ініціалізація модуля
     */
    async function init(userId) {
        console.log('🚀 [FlexEarn-V3] Початок ініціалізації');

        if (state.isInitialized) {
            console.log('✅ [FlexEarn-V3] Вже ініціалізовано');
            return;
        }

        state.userId = userId;

        try {
            // Ініціалізуємо WalletChecker якщо доступний
            if (window.WalletChecker) {
                state.walletChecker = window.WalletChecker;
                await state.walletChecker.init();
            }

            // Підписуємось на події
            setupEventSubscriptions();

            // Перевіряємо початковий стан
            await checkInitialState();

            state.isInitialized = true;

            // Емітуємо подію готовності
            EventBus.emit('manager.flex.ready', { userId });

            console.log('✅ [FlexEarn-V3] Модуль ініціалізовано');

        } catch (error) {
            console.error('❌ [FlexEarn-V3] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Перевірка початкового стану
     */
    async function checkInitialState() {
        // Отримуємо стан гаманця зі Store
        const store = window.TasksStore;
        const isWalletConnected = store?.selectors.isWalletConnected();
        const walletAddress = store?.selectors.getWalletAddress();

        if (isWalletConnected && walletAddress) {
            console.log('✅ [FlexEarn-V3] Гаманець підключено:', walletAddress);
            await checkFlexBalance();
            showFlexTasks();
        } else {
            console.log('❌ [FlexEarn-V3] Гаманець не підключено');
            showWalletConnect();
        }
    }

    /**
     * Перевірка балансу FLEX
     */
    async function checkFlexBalance(forceRefresh = false) {
        console.log('💰 [FlexEarn-V3] Перевірка балансу FLEX');

        const walletAddress = window.TasksStore?.selectors.getWalletAddress();
        if (!walletAddress) {
            console.warn('⚠️ [FlexEarn-V3] Адреса гаманця відсутня');
            return;
        }

        const cacheKey = `balance_${walletAddress}`;

        // Перевіряємо кеш
        if (!forceRefresh) {
            const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (cached !== null) {
                updateFlexUI(cached);
                return cached;
            }
        }

        try {
            // API виклик через RequestManager
            const response = await apiClient.execute(
                cacheKey,
                () => window.TasksAPI.flex.getBalance(state.userId, walletAddress),
                { priority: 'normal', deduplicate: !forceRefresh }
            );

            if (response?.balance !== undefined) {
                const balance = parseInt(response.balance) || 0;

                // Кешуємо результат
                CacheManager.set(CACHE_NAMESPACE, cacheKey, balance);

                // Оновлюємо Store
                window.TasksStore.actions.setFlexBalance(balance);

                // Оновлюємо UI
                updateFlexUI(balance);

                // Перевіряємо доступні винагороди
                checkAvailableRewards(balance);

                return balance;
            }

        } catch (error) {
            console.error('❌ [FlexEarn-V3] Помилка перевірки балансу:', error);

            // Використовуємо кешоване значення при помилці
            const fallback = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (fallback !== null) {
                updateFlexUI(fallback);
            }
        }
    }

    /**
     * Перевірка доступних винагород
     */
    async function checkAvailableRewards(flexBalance) {
        console.log('🎁 [FlexEarn-V3] Перевірка доступних винагород');

        const cacheKey = `levels_${state.userId}_${flexBalance}`;

        // Перевіряємо кеш
        const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
        if (cached) {
            updateLevelsUI(cached);
            return;
        }

        try {
            // Перевіряємо рівні на бекенді
            const response = await apiClient.execute(
                `check_levels_${flexBalance}`,
                () => window.TasksAPI.flex.checkLevels(state.userId, flexBalance),
                { priority: 'low' }
            );

            if (response?.levels) {
                // Кешуємо результат
                CacheManager.set(CACHE_NAMESPACE, cacheKey, response.levels);

                // Оновлюємо Store для кожного рівня
                Object.entries(response.levels).forEach(([level, levelData]) => {
                    window.TasksStore.actions.setFlexLevelAvailable(level, levelData.hasEnough);
                });

                // Оновлюємо UI
                updateLevelsUI(response.levels);

                // Рахуємо доступні винагороди
                const availableCount = Object.values(response.levels)
                    .filter(l => l.hasEnough && !l.claimedToday).length;

                if (availableCount > 0) {
                    EventBus.emit('rewards.available', { count: availableCount });
                }
            }

        } catch (error) {
            console.error('❌ [FlexEarn-V3] Помилка перевірки рівнів:', error);
        }
    }

    /**
     * Отримати винагороду
     */
    const claimReward = window.TasksUtils.debounce(async function(level) {
        console.log('🎁 [FlexEarn-V3] Отримання винагороди:', level);

        const levelData = FLEX_LEVELS[level];
        if (!levelData) {
            console.error('❌ [FlexEarn-V3] Невідомий рівень:', level);
            return;
        }

        // Перевіряємо через Store
        const flexBalance = window.TasksStore.selectors.getFlexBalance();
        const isClaimed = window.TasksStore.selectors.isFlexLevelClaimed(level);

        if (flexBalance < levelData.required) {
            window.TasksUtils.showToast('Недостатньо FLEX токенів', 'error');
            return;
        }

        if (isClaimed) {
            window.TasksUtils.showToast('Винагороду вже отримано сьогодні', 'warning');
            return;
        }

        // Блокуємо кнопку через EventBus
        eventBus.emit('claim.started', { level });

        try {
            // API виклик
            const response = await apiClient.execute(
                `claim_${level}`,
                () => window.TasksAPI.flex.claimReward(state.userId, level),
                { priority: 'high', deduplicate: false }
            );

            if (response?.success) {
                // Інвалідуємо кеші
                CacheManager.invalidateNamespace(CACHE_NAMESPACE);

                // Оновлюємо Store
                window.TasksStore.actions.setFlexLevelClaimed(level);

                // Емітуємо подію успіху
                EventBus.emit(EventBus.EVENTS.FLEX_LEVEL_CLAIMED, {
                    level,
                    reward: response.reward
                });

                // Показуємо анімацію
                eventBus.emit('showRewardAnimation', {
                    level,
                    reward: levelData.rewards
                });

                console.log('✅ [FlexEarn-V3] Винагорода отримана');

                // Оновлюємо баланс через 2 секунди
                setTimeout(() => checkFlexBalance(true), 2000);

            } else {
                throw new Error(response?.message || 'Помилка отримання винагороди');
            }

        } catch (error) {
            console.error('❌ [FlexEarn-V3] Помилка:', error);
            window.TasksUtils.showToast(error.message || 'Помилка отримання винагороди', 'error');

        } finally {
            eventBus.emit('claim.completed', { level });
        }
    }, 1000);

    /**
     * Оновлення UI Flex завдань
     */
    function updateFlexUI(flexBalance) {
        // Використовуємо EventBus для оновлення UI
        EventBus.emit(EventBus.EVENTS.UI_UPDATE, {
            component: 'flexEarn',
            data: { flexBalance }
        });

        // Оновлюємо прогрес для кожного рівня
        Object.entries(FLEX_LEVELS).forEach(([level, levelData]) => {
            const progress = Math.min((flexBalance / levelData.required) * 100, 100);

            eventBus.emit('level.progressUpdate', {
                level,
                progress,
                current: flexBalance,
                required: levelData.required
            });
        });
    }

    /**
     * Оновлення UI рівнів
     */
    function updateLevelsUI(levelsData) {
        Object.entries(levelsData).forEach(([level, data]) => {
            eventBus.emit('level.statusUpdate', {
                level,
                hasEnough: data.hasEnough,
                claimedToday: data.claimedToday
            });
        });
    }

    /**
     * Показати блок підключення гаманця
     */
    function showWalletConnect() {
        EventBus.emit('ui.showWalletConnect');

        // Простіше оновлення DOM
        const statusContainer = document.querySelector('.wallet-status-container');
        const tasksContainer = document.getElementById('flex-tasks');

        if (statusContainer) statusContainer.style.display = 'block';
        if (tasksContainer) tasksContainer.style.display = 'none';
    }

    /**
     * Показати Flex завдання
     */
    function showFlexTasks() {
        EventBus.emit('ui.showFlexTasks');

        // Простіше оновлення DOM
        const statusContainer = document.querySelector('.wallet-status-container');
        const tasksContainer = document.getElementById('flex-tasks');

        if (statusContainer) statusContainer.style.display = 'none';
        if (tasksContainer) tasksContainer.style.display = 'block';
    }

    /**
     * Налаштування підписок на події
     */
    function setupEventSubscriptions() {
        // Підписка на підключення гаманця
        const unsubWalletConnected = EventBus.on(EventBus.EVENTS.WALLET_CONNECTED, async () => {
            console.log('👛 [FlexEarn-V3] Гаманець підключено');
            showFlexTasks();
            await checkFlexBalance(true);
        });

        // Підписка на відключення гаманця
        const unsubWalletDisconnected = EventBus.on(EventBus.EVENTS.WALLET_DISCONNECTED, () => {
            console.log('👛 [FlexEarn-V3] Гаманець відключено');
            showWalletConnect();
            CacheManager.invalidateNamespace(CACHE_NAMESPACE);
        });

        // Підписка на оновлення балансу FLEX
        const unsubFlexUpdate = EventBus.on(EventBus.EVENTS.FLEX_BALANCE_UPDATED, (data) => {
            console.log('💎 [FlexEarn-V3] Баланс FLEX оновлено:', data.newBalance);
            updateFlexUI(data.newBalance);
            checkAvailableRewards(data.newBalance);
        });

        // Підписка на зміну вкладки
        const unsubTabChange = EventBus.on(EventBus.EVENTS.TAB_CHANGED, (data) => {
            if (data.newTab === 'flex' && window.TasksStore?.selectors.isWalletConnected()) {
                checkFlexBalance();
            }
        });

        // Підписка на запит оновлення
        const unsubRefresh = EventBus.on('flex.refresh', () => {
            checkFlexBalance(true);
        });

        // Делегування для кнопок claim
        document.addEventListener('click', handleClaimClick);

        // Зберігаємо callbacks для відписки
        state.unsubscribeCallbacks.push(
            unsubWalletConnected,
            unsubWalletDisconnected,
            unsubFlexUpdate,
            unsubTabChange,
            unsubRefresh,
            () => document.removeEventListener('click', handleClaimClick)
        );
    }

    /**
     * Обробка кліків на кнопки claim
     */
    function handleClaimClick(e) {
        const claimButton = e.target.closest('.claim-button');
        if (!claimButton) return;

        const card = claimButton.closest('.flex-task-card');
        if (!card) return;

        const level = card.getAttribute('data-level')?.toUpperCase();
        if (level && FLEX_LEVELS[level]) {
            claimReward(level);
        }
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        const flexBalance = window.TasksStore?.selectors.getFlexBalance() || 0;
        let totalClaimedToday = 0;
        let totalPotentialRewards = { winix: 0, tickets: 0 };

        Object.entries(FLEX_LEVELS).forEach(([level, levelData]) => {
            const isClaimed = window.TasksStore?.selectors.isFlexLevelClaimed(level);
            const isAvailable = flexBalance >= levelData.required;

            if (isClaimed) {
                totalClaimedToday++;
            } else if (isAvailable) {
                totalPotentialRewards.winix += levelData.rewards.winix;
                totalPotentialRewards.tickets += levelData.rewards.tickets;
            }
        });

        return {
            flexBalance,
            totalClaimedToday,
            totalPotentialRewards,
            levelsUnlocked: Object.values(FLEX_LEVELS).filter(l => flexBalance >= l.required).length
        };
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [FlexEarn-V3] Знищення модуля');

        // Відписуємось від всіх подій
        state.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });

        // Очищаємо стан
        state.isInitialized = false;
        state.unsubscribeCallbacks = [];

        console.log('✅ [FlexEarn-V3] Модуль знищено');
    }

    console.log('✅ [FlexEarn-V3] Модуль готовий (Централізовані утиліти)');

    // Публічний API
    return {
        init,
        checkFlexBalance,
        claimReward,
        getStatistics,
        destroy,

        // Для зовнішнього доступу
        getState: () => ({
            isInitialized: state.isInitialized,
            flexBalance: window.TasksStore?.selectors.getFlexBalance() || 0,
            walletConnected: window.TasksStore?.selectors.isWalletConnected() || false
        })
    };

})();

console.log('✅ [FlexEarn-V3] Модуль експортовано глобально');