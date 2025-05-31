/**
 * Redux-подібний стор для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ - з батчінгом оновлень та кешуванням
 */

window.TasksStore = (function() {
    'use strict';

    console.log('🏪 [TasksStore] ===== ІНІЦІАЛІЗАЦІЯ СТОРУ (ОПТИМІЗОВАНИЙ) =====');

    // Початковий стан
    const initialState = {
        // Користувач
        user: {
            id: null,
            telegramId: null,
            username: null,
            balance: {
                winix: 0,
                tickets: 0,
                flex: 0
            },
            lastSync: null
        },

        // Гаманець
        wallet: {
            connected: false,
            address: null,
            chainId: null,
            provider: null,
            lastCheck: null,
            checking: false,
            flexBalance: 0
        },

        // Flex Earn
        flexEarn: {
            levels: {
                BRONZE: { claimed: false, lastClaim: null, available: false },
                SILVER: { claimed: false, lastClaim: null, available: false },
                GOLD: { claimed: false, lastClaim: null, available: false },
                PLATINUM: { claimed: false, lastClaim: null, available: false },
                DIAMOND: { claimed: false, lastClaim: null, available: false }
            },
            flexBalance: 0,
            lastBalanceCheck: null,
            checking: false,
            claiming: false
        },

        // Daily Bonus
        dailyBonus: {
            currentStreak: 0,
            longestStreak: 0,
            lastClaimDate: null,
            claimedDays: [], // масив дат
            ticketDays: [], // дні коли були tickets
            totalClaimed: {
                winix: 0,
                tickets: 0
            },
            nextTicketDay: null,
            claiming: false,
            isClaiming: false // додано для сумісності
        },

        // Завдання
        tasks: {
            social: {},
            limited: {},
            partner: {},
            daily: {},
            loading: false,
            lastUpdate: null
        },

        // UI стан
        ui: {
            currentTab: 'flex',
            loading: false,
            error: null,
            toasts: []
        },

        // Мережа
        network: {
            online: navigator.onLine,
            lastOnline: Date.now()
        }
    };

    // Поточний стан
    let state = window.TasksUtils.deepClone(initialState);

    // Слухачі змін
    const listeners = new Set();

    // Історія дій (для налагодження)
    const actionHistory = [];
    const MAX_HISTORY_LENGTH = 50;

    // Батчінг оновлень
    let updateQueue = [];
    let isProcessingQueue = false;
    const BATCH_DELAY = 16; // 1 frame (60fps)

    // Кешування селекторів
    const selectorCache = new Map();
    let lastStateForCache = null;

    // Типи дій
    const ActionTypes = {
        // User actions
        SET_USER: 'SET_USER',
        UPDATE_BALANCE: 'UPDATE_BALANCE',

        // Wallet actions
        SET_WALLET_CONNECTED: 'SET_WALLET_CONNECTED',
        SET_WALLET_ADDRESS: 'SET_WALLET_ADDRESS',
        SET_WALLET_CHECKING: 'SET_WALLET_CHECKING',
        DISCONNECT_WALLET: 'DISCONNECT_WALLET',

        // Flex Earn actions
        SET_FLEX_BALANCE: 'SET_FLEX_BALANCE',
        SET_FLEX_LEVEL_CLAIMED: 'SET_FLEX_LEVEL_CLAIMED',
        SET_FLEX_LEVEL_AVAILABLE: 'SET_FLEX_LEVEL_AVAILABLE',
        SET_FLEX_CHECKING: 'SET_FLEX_CHECKING',
        SET_FLEX_CLAIMING: 'SET_FLEX_CLAIMING',
        RESET_FLEX_DAILY: 'RESET_FLEX_DAILY',

        // Daily Bonus actions
        SET_DAILY_STREAK: 'SET_DAILY_STREAK',
        CLAIM_DAILY_BONUS: 'CLAIM_DAILY_BONUS',
        ADD_TICKET_DAY: 'ADD_TICKET_DAY',
        SET_DAILY_CLAIMING: 'SET_DAILY_CLAIMING',
        RESET_DAILY_BONUS: 'RESET_DAILY_BONUS',
        ADD_CLAIMED_DAY: 'ADD_CLAIMED_DAY',
        SET_CLAIMED_DAYS: 'SET_CLAIMED_DAYS',
        UPDATE_DAILY_TOTAL_CLAIMED: 'UPDATE_DAILY_TOTAL_CLAIMED',

        // Tasks actions
        SET_TASKS: 'SET_TASKS',
        UPDATE_TASK_STATUS: 'UPDATE_TASK_STATUS',
        SET_TASKS_LOADING: 'SET_TASKS_LOADING',

        // UI actions
        SET_CURRENT_TAB: 'SET_CURRENT_TAB',
        SET_LOADING: 'SET_LOADING',
        SET_ERROR: 'SET_ERROR',
        ADD_TOAST: 'ADD_TOAST',
        REMOVE_TOAST: 'REMOVE_TOAST',

        // Network actions
        SET_ONLINE: 'SET_ONLINE',

        // Global actions
        RESET_STATE: 'RESET_STATE',
        HYDRATE_STATE: 'HYDRATE_STATE',
        CLEAR_USER: 'CLEAR_USER'
    };

    /**
     * Батчінг dispatch - групування оновлень
     */
    function batchedDispatch(action) {
        updateQueue.push(action);

        if (!isProcessingQueue) {
            isProcessingQueue = true;

            // Використовуємо requestAnimationFrame для оптимальної продуктивності
            requestAnimationFrame(() => {
                processBatchedUpdates();
            });
        }
    }

    /**
     * Обробка батчових оновлень
     */
    function processBatchedUpdates() {
        if (updateQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }

        console.log(`📦 [TasksStore] Обробка ${updateQueue.length} батчових оновлень`);

        const actions = [...updateQueue];
        updateQueue = [];

        // Зберігаємо початковий стан
        const initialBatchState = state;

        // Обробляємо всі дії
        actions.forEach(action => {
            const prevState = state;
            state = rootReducer(state, action);

            // Зберігаємо в історію
            if (actionHistory.length >= MAX_HISTORY_LENGTH) {
                actionHistory.shift();
            }

            actionHistory.push({
                action,
                timestamp: Date.now(),
                prevState: window.TasksUtils.deepClone(prevState)
            });
        });

        // Очищаємо кеш селекторів якщо стан змінився
        if (state !== initialBatchState) {
            clearSelectorCache();

            // Зберігаємо в localStorage
            saveStateToStorage();

            // Повідомляємо слухачів один раз для всіх змін
            notifyListeners(actions, initialBatchState);
        }

        isProcessingQueue = false;

        // Якщо є нові оновлення в черзі, обробляємо їх
        if (updateQueue.length > 0) {
            requestAnimationFrame(() => {
                processBatchedUpdates();
            });
        }
    }

    /**
     * Dispatch - відправка дії до стору
     */
    function dispatch(action) {
        console.log('📤 [TasksStore] Dispatch action:', action.type);
        console.log('  📊 Payload:', action.payload);

        // Для критичних дій - миттєва обробка
        const criticalActions = [
            ActionTypes.UPDATE_BALANCE,
            ActionTypes.CLAIM_DAILY_BONUS,
            ActionTypes.SET_DAILY_CLAIMING,
            ActionTypes.SET_FLEX_CLAIMING
        ];

        if (criticalActions.includes(action.type)) {
            // Миттєва обробка
            const prevState = state;
            state = rootReducer(state, action);

            if (state !== prevState) {
                clearSelectorCache();
                saveStateToStorage();
                notifyListeners([action], prevState);
            }
        } else {
            // Батчова обробка
            batchedDispatch(action);
        }

        return action;
    }

    /**
     * Кореневий reducer
     */
    function rootReducer(state = initialState, action) {
        console.log('🔄 [TasksStore] Reducer обробляє:', action.type);

        return {
            user: userReducer(state.user, action),
            wallet: walletReducer(state.wallet, action),
            flexEarn: flexEarnReducer(state.flexEarn, action),
            dailyBonus: dailyBonusReducer(state.dailyBonus, action),
            tasks: tasksReducer(state.tasks, action),
            ui: uiReducer(state.ui, action),
            network: networkReducer(state.network, action)
        };
    }

    /**
     * User Reducer - ВИПРАВЛЕНО для правильної обробки балансу
     */
    function userReducer(state = initialState.user, action) {
        switch(action.type) {
            case ActionTypes.SET_USER:
                console.log('  👤 [TasksStore] Встановлення користувача');
                return { ...state, ...action.payload };

            case ActionTypes.UPDATE_BALANCE:
                console.log('  💰 [TasksStore] Оновлення балансу');
                console.log('    📊 Поточний баланс:', state.balance);
                console.log('    📊 Новий баланс:', action.payload);

                // Обробляємо різні формати балансу
                let newBalance = { ...state.balance };

                // Якщо payload містить winix/tickets - використовуємо напряму
                if (action.payload.winix !== undefined || action.payload.tickets !== undefined) {
                    newBalance.winix = action.payload.winix !== undefined ? action.payload.winix : state.balance.winix;
                    newBalance.tickets = action.payload.tickets !== undefined ? action.payload.tickets : state.balance.tickets;
                    console.log('    ✅ Використовуємо формат winix/tickets');
                }
                // Якщо payload містить balance/coins - конвертуємо
                else if (action.payload.balance !== undefined || action.payload.coins !== undefined) {
                    newBalance.winix = action.payload.balance !== undefined ? action.payload.balance : state.balance.winix;
                    newBalance.tickets = action.payload.coins !== undefined ? action.payload.coins : state.balance.tickets;
                    console.log('    ⚠️ Конвертуємо формат balance/coins в winix/tickets');
                }
                // Якщо payload містить flex - оновлюємо
                if (action.payload.flex !== undefined) {
                    newBalance.flex = action.payload.flex;
                }

                console.log('    📊 Фінальний баланс:', newBalance);

                return {
                    ...state,
                    balance: newBalance,
                    lastSync: Date.now()
                };

            case ActionTypes.CLEAR_USER:
                return initialState.user;

            case ActionTypes.HYDRATE_STATE:
                return action.payload.user || state;

            case ActionTypes.RESET_STATE:
                return initialState.user;

            default:
                return state;
        }
    }

    /**
     * Wallet Reducer
     */
    function walletReducer(state = initialState.wallet, action) {
        switch(action.type) {
            case ActionTypes.SET_WALLET_CONNECTED:
                console.log('  🔌 [TasksStore] Встановлення статусу підключення гаманця');
                return {
                    ...state,
                    connected: action.payload,
                    lastCheck: Date.now()
                };

            case ActionTypes.SET_WALLET_ADDRESS:
                console.log('  📍 [TasksStore] Встановлення адреси гаманця');
                return {
                    ...state,
                    address: action.payload.address,
                    addressFriendly: action.payload.addressFriendly,
                    chainId: action.payload.chainId,
                    provider: action.payload.provider
                };

            case ActionTypes.SET_WALLET_CHECKING:
                console.log('  🔍 [TasksStore] Встановлення стану перевірки гаманця');
                return { ...state, checking: action.payload };

            case ActionTypes.DISCONNECT_WALLET:
                console.log('  🔌 [TasksStore] Відключення гаманця');
                return {
                    ...initialState.wallet,
                    lastCheck: Date.now()
                };

            case ActionTypes.SET_FLEX_BALANCE:
                console.log('  💎 [TasksStore] Встановлення FLEX балансу в гаманці');
                return {
                    ...state,
                    flexBalance: action.payload
                };

            case ActionTypes.HYDRATE_STATE:
                return action.payload.wallet || state;

            case ActionTypes.RESET_STATE:
                return initialState.wallet;

            default:
                return state;
        }
    }

    /**
     * Flex Earn Reducer
     */
    function flexEarnReducer(state = initialState.flexEarn, action) {
        switch(action.type) {
            case ActionTypes.SET_FLEX_BALANCE:
                console.log('  💎 [TasksStore] Встановлення балансу FLEX');
                return {
                    ...state,
                    flexBalance: action.payload,
                    lastBalanceCheck: Date.now()
                };

            case ActionTypes.SET_FLEX_LEVEL_CLAIMED:
                console.log('  ✅ [TasksStore] Встановлення статусу отримання рівня');
                return {
                    ...state,
                    levels: {
                        ...state.levels,
                        [action.payload.level]: {
                            ...state.levels[action.payload.level],
                            claimed: true,
                            lastClaim: Date.now()
                        }
                    }
                };

            case ActionTypes.SET_FLEX_LEVEL_AVAILABLE:
                console.log('  🎯 [TasksStore] Встановлення доступності рівня');
                return {
                    ...state,
                    levels: {
                        ...state.levels,
                        [action.payload.level]: {
                            ...state.levels[action.payload.level],
                            available: action.payload.available
                        }
                    }
                };

            case ActionTypes.SET_FLEX_CHECKING:
                console.log('  🔍 [TasksStore] Встановлення стану перевірки FLEX');
                return { ...state, checking: action.payload };

            case ActionTypes.SET_FLEX_CLAIMING:
                console.log('  🎁 [TasksStore] Встановлення стану отримання винагороди');
                return { ...state, claiming: action.payload };

            case ActionTypes.RESET_FLEX_DAILY:
                console.log('  🔄 [TasksStore] Скидання щоденних винагород FLEX');
                const resetLevels = {};
                Object.keys(state.levels).forEach(level => {
                    resetLevels[level] = {
                        ...state.levels[level],
                        claimed: false
                    };
                });
                return { ...state, levels: resetLevels };

            case ActionTypes.HYDRATE_STATE:
                return action.payload.flexEarn || state;

            case ActionTypes.RESET_STATE:
                return initialState.flexEarn;

            default:
                return state;
        }
    }

    /**
     * Daily Bonus Reducer - розширено новими діями
     */
    function dailyBonusReducer(state = initialState.dailyBonus, action) {
        switch(action.type) {
            case ActionTypes.SET_DAILY_STREAK:
                console.log('  🔥 [TasksStore] Встановлення серії днів');
                return {
                    ...state,
                    currentStreak: action.payload.current,
                    longestStreak: Math.max(state.longestStreak, action.payload.current)
                };

            case ActionTypes.CLAIM_DAILY_BONUS:
                console.log('  🎁 [TasksStore] Отримання щоденного бонусу');
                const today = new Date().toDateString();
                return {
                    ...state,
                    lastClaimDate: today,
                    claimedDays: [...state.claimedDays, today],
                    currentStreak: state.currentStreak + 1,
                    totalClaimed: {
                        winix: state.totalClaimed.winix + (action.payload.winix || 0),
                        tickets: state.totalClaimed.tickets + (action.payload.tickets || 0)
                    }
                };

            case ActionTypes.ADD_TICKET_DAY:
                console.log('  🎟️ [TasksStore] Додавання дня з квитками');
                return {
                    ...state,
                    ticketDays: [...state.ticketDays, action.payload]
                };

            case ActionTypes.SET_DAILY_CLAIMING:
                console.log('  🔄 [TasksStore] Встановлення стану отримання бонусу');
                return {
                    ...state,
                    claiming: action.payload,
                    isClaiming: action.payload // для сумісності
                };

            case ActionTypes.ADD_CLAIMED_DAY:
                console.log('  📅 [TasksStore] Додавання дня отримання бонусу');
                if (!state.claimedDays.includes(action.payload)) {
                    return {
                        ...state,
                        claimedDays: [...state.claimedDays, action.payload]
                    };
                }
                return state;

            case ActionTypes.SET_CLAIMED_DAYS:
                console.log('  📅 [TasksStore] Встановлення днів отримання бонусів');
                return {
                    ...state,
                    claimedDays: action.payload || []
                };

            case ActionTypes.UPDATE_DAILY_TOTAL_CLAIMED:
                console.log('  💰 [TasksStore] Оновлення загальної суми отриманих бонусів');
                return {
                    ...state,
                    totalClaimed: {
                        winix: action.payload.winix || 0,
                        tickets: action.payload.tickets || 0
                    }
                };

            case ActionTypes.RESET_DAILY_BONUS:
                console.log('  🔄 [TasksStore] Скидання щоденного бонусу');
                return initialState.dailyBonus;

            case ActionTypes.HYDRATE_STATE:
                return action.payload.dailyBonus || state;

            case ActionTypes.RESET_STATE:
                return initialState.dailyBonus;

            default:
                return state;
        }
    }

    /**
     * Tasks Reducer
     */
    function tasksReducer(state = initialState.tasks, action) {
        switch(action.type) {
            case ActionTypes.SET_TASKS:
                console.log('  📋 [TasksStore] Встановлення завдань');
                return {
                    ...state,
                    [action.payload.type]: action.payload.tasks,
                    lastUpdate: Date.now()
                };

            case ActionTypes.UPDATE_TASK_STATUS:
                console.log('  ✏️ [TasksStore] Оновлення статусу завдання');
                const { type, taskId, status } = action.payload;
                return {
                    ...state,
                    [type]: {
                        ...state[type],
                        [taskId]: {
                            ...state[type][taskId],
                            status: status,
                            lastUpdate: Date.now()
                        }
                    }
                };

            case ActionTypes.SET_TASKS_LOADING:
                console.log('  ⏳ [TasksStore] Встановлення стану завантаження завдань');
                return { ...state, loading: action.payload };

            case ActionTypes.HYDRATE_STATE:
                return action.payload.tasks || state;

            case ActionTypes.RESET_STATE:
                return initialState.tasks;

            default:
                return state;
        }
    }

    /**
     * UI Reducer
     */
    function uiReducer(state = initialState.ui, action) {
        switch(action.type) {
            case ActionTypes.SET_CURRENT_TAB:
                console.log('  📑 [TasksStore] Встановлення поточної вкладки');
                return { ...state, currentTab: action.payload };

            case ActionTypes.SET_LOADING:
                console.log('  ⏳ [TasksStore] Встановлення стану завантаження');
                return { ...state, loading: action.payload };

            case ActionTypes.SET_ERROR:
                console.log('  ❌ [TasksStore] Встановлення помилки');
                return { ...state, error: action.payload };

            case ActionTypes.ADD_TOAST:
                console.log('  💬 [TasksStore] Додавання toast повідомлення');
                return {
                    ...state,
                    toasts: [...state.toasts, {
                        id: window.TasksUtils.generateId(),
                        ...action.payload,
                        timestamp: Date.now()
                    }]
                };

            case ActionTypes.REMOVE_TOAST:
                console.log('  🗑️ [TasksStore] Видалення toast повідомлення');
                return {
                    ...state,
                    toasts: state.toasts.filter(t => t.id !== action.payload)
                };

            case ActionTypes.HYDRATE_STATE:
                return action.payload.ui || state;

            case ActionTypes.RESET_STATE:
                return initialState.ui;

            default:
                return state;
        }
    }

    /**
     * Network Reducer
     */
    function networkReducer(state = initialState.network, action) {
        switch(action.type) {
            case ActionTypes.SET_ONLINE:
                console.log('  🌐 [TasksStore] Встановлення статусу мережі');
                return {
                    ...state,
                    online: action.payload,
                    lastOnline: action.payload ? Date.now() : state.lastOnline
                };

            case ActionTypes.HYDRATE_STATE:
                return action.payload.network || state;

            case ActionTypes.RESET_STATE:
                return initialState.network;

            default:
                return state;
        }
    }

    /**
     * Підписка на зміни стану - ОПТИМІЗОВАНА
     */
    function subscribe(listener) {
        console.log('👂 [TasksStore] Додавання слухача');

        // Обгортаємо listener для оптимізації
        const wrappedListener = function(state, prevState, actions) {
            // Використовуємо requestAnimationFrame для уникнення блокування UI
            requestAnimationFrame(() => {
                try {
                    listener(state, prevState, actions);
                } catch (error) {
                    console.error('❌ [TasksStore] Помилка в слухачі:', error);
                }
            });
        };

        listeners.add(wrappedListener);

        // Повертаємо функцію відписки
        return function unsubscribe() {
            console.log('🔇 [TasksStore] Видалення слухача');
            listeners.delete(wrappedListener);
        };
    }

    /**
     * Повідомлення слухачів - ОПТИМІЗОВАНА
     */
    function notifyListeners(actions, prevState) {
        console.log(`📢 [TasksStore] Повідомлення ${listeners.size} слухачів`);

        // Для батчових оновлень передаємо масив дій
        const actionInfo = actions.length === 1 ? actions[0] : { type: 'BATCH_UPDATE', actions };

        listeners.forEach(listener => {
            listener(state, prevState, actionInfo);
        });
    }

    /**
     * Отримати поточний стан
     */
    function getState() {
        return state;
    }

    /**
     * Очищення кешу селекторів
     */
    function clearSelectorCache() {
        selectorCache.clear();
        lastStateForCache = null;
    }

    /**
     * Кешований селектор
     */
    function createCachedSelector(name, selector) {
        return function() {
            // Перевіряємо чи стан змінився
            if (lastStateForCache !== state) {
                clearSelectorCache();
                lastStateForCache = state;
            }

            // Перевіряємо кеш
            if (selectorCache.has(name)) {
                return selectorCache.get(name);
            }

            // Обчислюємо і кешуємо результат
            const result = selector();
            selectorCache.set(name, result);
            return result;
        };
    }

    /**
     * Селектори - ОПТИМІЗОВАНІ З КЕШУВАННЯМ
     */
    const selectors = {
        // User selectors
        getUserId: createCachedSelector('userId', () => state.user.id),
        getUserBalance: createCachedSelector('userBalance', () => state.user.balance),
        getWinixBalance: createCachedSelector('winixBalance', () => state.user.balance.winix),
        getTicketsBalance: createCachedSelector('ticketsBalance', () => state.user.balance.tickets),

        // Wallet selectors
        isWalletConnected: createCachedSelector('walletConnected', () => state.wallet.connected),
        getWalletAddress: createCachedSelector('walletAddress', () => state.wallet.address),
        getWalletFlexBalance: createCachedSelector('walletFlexBalance', () => state.wallet.flexBalance),

        // Flex selectors
        getFlexBalance: createCachedSelector('flexBalance', () => state.flexEarn.flexBalance || state.wallet.flexBalance),
        getFlexLevel: (level) => state.flexEarn.levels[level],
        isFlexLevelClaimed: (level) => state.flexEarn.levels[level]?.claimed || false,
        isFlexLevelAvailable: (level) => state.flexEarn.levels[level]?.available || false,

        // Daily bonus selectors - розширено
        getCurrentStreak: createCachedSelector('currentStreak', () => state.dailyBonus.currentStreak),
        getLastClaimDate: createCachedSelector('lastClaimDate', () => state.dailyBonus.lastClaimDate),
        canClaimDailyBonus: createCachedSelector('canClaimDaily', () => {
            const lastClaim = state.dailyBonus.lastClaimDate;
            if (!lastClaim) return true;
            return window.TasksUtils.isNewDay(lastClaim);
        }),
        getDailyBonus: createCachedSelector('dailyBonus', () => state.dailyBonus),
        getDailyStreak: createCachedSelector('dailyStreak', () => state.dailyBonus.currentStreak),
        getClaimedDays: createCachedSelector('claimedDays', () => state.dailyBonus.claimedDays),
        isDailyClaiming: createCachedSelector('dailyClaiming', () => state.dailyBonus.claiming || state.dailyBonus.isClaiming),
        getTotalClaimed: createCachedSelector('totalClaimed', () => state.dailyBonus.totalClaimed),
        getTicketDays: createCachedSelector('ticketDays', () => state.dailyBonus.ticketDays),

        // UI selectors
        getCurrentTab: createCachedSelector('currentTab', () => state.ui.currentTab),
        isLoading: createCachedSelector('isLoading', () => state.ui.loading),
        getError: createCachedSelector('error', () => state.ui.error),

        // Network selectors
        isOnline: createCachedSelector('isOnline', () => state.network.online)
    };

    /**
     * Action creators - розширено для Daily Bonus
     */
    const actions = {
        // User actions
        setUser: (userData) => dispatch({ type: ActionTypes.SET_USER, payload: userData }),
        updateBalance: (balances) => {
            console.log('🎯 [TasksStore] Action creator updateBalance викликано з:', balances);
            return dispatch({ type: ActionTypes.UPDATE_BALANCE, payload: balances });
        },
        clearUser: () => dispatch({ type: ActionTypes.CLEAR_USER }),

        // Wallet actions
        setWalletConnected: (connected) => dispatch({ type: ActionTypes.SET_WALLET_CONNECTED, payload: connected }),
        setWalletAddress: (data) => dispatch({ type: ActionTypes.SET_WALLET_ADDRESS, payload: data }),
        setWalletChecking: (checking) => dispatch({ type: ActionTypes.SET_WALLET_CHECKING, payload: checking }),
        disconnectWallet: () => dispatch({ type: ActionTypes.DISCONNECT_WALLET }),

        // Flex actions
        setFlexBalance: (balance) => dispatch({ type: ActionTypes.SET_FLEX_BALANCE, payload: balance }),
        setFlexLevelClaimed: (level) => dispatch({ type: ActionTypes.SET_FLEX_LEVEL_CLAIMED, payload: { level } }),
        setFlexLevelAvailable: (level, available) => dispatch({
            type: ActionTypes.SET_FLEX_LEVEL_AVAILABLE,
            payload: { level, available }
        }),
        setFlexChecking: (checking) => dispatch({ type: ActionTypes.SET_FLEX_CHECKING, payload: checking }),
        setFlexClaiming: (claiming) => dispatch({ type: ActionTypes.SET_FLEX_CLAIMING, payload: claiming }),
        resetFlexDaily: () => dispatch({ type: ActionTypes.RESET_FLEX_DAILY }),

        // Daily bonus actions - розширено новими методами
        setDailyStreak: (current) => dispatch({ type: ActionTypes.SET_DAILY_STREAK, payload: { current } }),
        claimDailyBonus: (rewards) => dispatch({ type: ActionTypes.CLAIM_DAILY_BONUS, payload: rewards }),
        addTicketDay: (date) => dispatch({ type: ActionTypes.ADD_TICKET_DAY, payload: date }),
        setDailyClaiming: (claiming) => dispatch({ type: ActionTypes.SET_DAILY_CLAIMING, payload: claiming }),
        addClaimedDay: (day) => dispatch({ type: ActionTypes.ADD_CLAIMED_DAY, payload: day }),
        setClaimedDays: (days) => dispatch({ type: ActionTypes.SET_CLAIMED_DAYS, payload: days }),
        updateDailyTotalClaimed: (totals) => dispatch({
            type: ActionTypes.UPDATE_DAILY_TOTAL_CLAIMED,
            payload: totals
        }),
        resetDailyBonus: () => dispatch({ type: ActionTypes.RESET_DAILY_BONUS }),

        // Tasks actions
        setTasks: (type, tasks) => dispatch({ type: ActionTypes.SET_TASKS, payload: { type, tasks } }),
        updateTaskStatus: (type, taskId, status) => dispatch({
            type: ActionTypes.UPDATE_TASK_STATUS,
            payload: { type, taskId, status }
        }),
        setTasksLoading: (loading) => dispatch({ type: ActionTypes.SET_TASKS_LOADING, payload: loading }),

        // UI actions
        setCurrentTab: (tab) => dispatch({ type: ActionTypes.SET_CURRENT_TAB, payload: tab }),
        setLoading: (loading) => dispatch({ type: ActionTypes.SET_LOADING, payload: loading }),
        setError: (error) => dispatch({ type: ActionTypes.SET_ERROR, payload: error }),
        addToast: (toast) => dispatch({ type: ActionTypes.ADD_TOAST, payload: toast }),
        removeToast: (id) => dispatch({ type: ActionTypes.REMOVE_TOAST, payload: id }),

        // Network actions
        setOnline: (online) => dispatch({ type: ActionTypes.SET_ONLINE, payload: online }),

        // Global actions
        resetState: () => dispatch({ type: ActionTypes.RESET_STATE }),
        hydrateState: (savedState) => dispatch({ type: ActionTypes.HYDRATE_STATE, payload: savedState })
    };

    /**
     * Збереження стану в sessionStorage - ДЕБАУНСОВАНЕ
     */
    const saveStateToStorage = window.TasksUtils.debounce(function() {
        console.log('💾 [TasksStore] Збереження стану в sessionStorage');

        try {
            const stateToSave = {
                user: state.user,
                flexEarn: {
                    levels: state.flexEarn.levels,
                    flexBalance: state.flexEarn.flexBalance
                },
                dailyBonus: state.dailyBonus,
                ui: {
                    currentTab: state.ui.currentTab
                }
            };

            // Використовуємо sessionStorage для безпеки
            sessionStorage.setItem('tasksStoreState', JSON.stringify(stateToSave));
            console.log('✅ [TasksStore] Стан збережено в sessionStorage');
        } catch (error) {
            console.error('❌ [TasksStore] Помилка збереження стану:', error);
        }
    }, 1000); // 1 секунда дебаунс

    /**
     * Завантаження стану з sessionStorage
     */
    function loadStateFromStorage() {
        console.log('📂 [TasksStore] Завантаження стану з sessionStorage');

        try {
            const savedStateStr = sessionStorage.getItem('tasksStoreState');
            if (savedStateStr) {
                const savedState = JSON.parse(savedStateStr);
                console.log('✅ [TasksStore] Знайдено збережений стан');

                // Валідуємо дані перед використанням
                if (savedState && typeof savedState === 'object') {
                    actions.hydrateState(savedState);
                }
            } else {
                console.log('📭 [TasksStore] Збережений стан не знайдено');
            }
        } catch (error) {
            console.error('❌ [TasksStore] Помилка завантаження стану:', error);
            // Очищаємо пошкоджені дані
            sessionStorage.removeItem('tasksStoreState');
        }
    }

    /**
     * Ініціалізація стору
     */
    function init() {
        console.log('🚀 [TasksStore] Ініціалізація стору');

        // Завантажуємо збережений стан
        loadStateFromStorage();

        // Налаштовуємо слухачі мережі
        window.addEventListener('online', () => actions.setOnline(true));
        window.addEventListener('offline', () => actions.setOnline(false));

        console.log('✅ [TasksStore] Стор ініціалізовано');
        console.log('📊 [TasksStore] Початковий стан:', state);
    }

    // Автоматична ініціалізація
    init();

    console.log('✅ [TasksStore] Redux-подібний стор готовий до використання (ОПТИМІЗОВАНИЙ)');

    // Публічний API
    return {
        dispatch,
        subscribe,
        getState,
        selectors,
        actions,
        ActionTypes
    };

})();

console.log('✅ [TasksStore] Модуль стору експортовано глобально (ОПТИМІЗОВАНИЙ)');