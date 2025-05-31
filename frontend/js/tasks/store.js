/**
 * Оптимізований Redux-подібний стор для системи завдань WINIX
 * Використовує централізовані утиліти та EventBus для уникнення циклічностей
 */

window.TasksStore = (function() {
    'use strict';

    console.log('🏪 [TasksStore] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО СТОРУ =====');

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
            addressFriendly: null,
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
            claimedDays: [],
            ticketDays: [],
            totalClaimed: {
                winix: 0,
                tickets: 0
            },
            nextTicketDay: null,
            claiming: false
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

    // Middleware система
    const middleware = [];

    // Слухачі змін
    const listeners = new Set();

    // Батчинг через microtasks
    let updateQueue = [];
    let isFlushScheduled = false;

    // Використовуємо централізовані утиліти
    const { CacheManager, EventBus } = window;

    // Типи дій
    const ActionTypes = {
        // User actions
        SET_USER: 'SET_USER',
        UPDATE_BALANCE: 'UPDATE_BALANCE',
        CLEAR_USER: 'CLEAR_USER',

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
        HYDRATE_STATE: 'HYDRATE_STATE'
    };

    /**
     * Батчинг dispatch через microtasks
     */
    function scheduleFlush() {
        if (!isFlushScheduled) {
            isFlushScheduled = true;
            queueMicrotask(flushUpdateQueue);
        }
    }

    /**
     * Обробка батчових оновлень
     */
    function flushUpdateQueue() {
        if (updateQueue.length === 0) {
            isFlushScheduled = false;
            return;
        }

        const actions = [...updateQueue];
        updateQueue = [];
        isFlushScheduled = false;

        console.log(`📦 [TasksStore] Обробка ${actions.length} батчових оновлень`);

        // Зберігаємо початковий стан для порівняння
        const prevState = state;

        // Обробляємо всі дії
        actions.forEach(action => {
            state = rootReducer(state, action);
        });

        // Якщо стан змінився - повідомляємо
        if (state !== prevState) {
            // Кешуємо новий стан
            CacheManager.set(CacheManager.NAMESPACES.UI, 'currentState', state);

            // Зберігаємо в storage
            saveStateToStorage();

            // Повідомляємо слухачів через EventBus
            notifyListeners(actions, prevState);
        }
    }

    /**
     * Dispatch з middleware підтримкою
     */
    function dispatch(action) {
        // Проходимо через middleware
        let modifiedAction = action;

        for (const mw of middleware) {
            modifiedAction = mw(modifiedAction, getState, dispatch);
            if (!modifiedAction) return; // Middleware може скасувати action
        }

        // Критичні дії обробляємо одразу
        const criticalActions = [
            ActionTypes.UPDATE_BALANCE,
            ActionTypes.CLAIM_DAILY_BONUS,
            ActionTypes.SET_WALLET_CONNECTED
        ];

        if (criticalActions.includes(modifiedAction.type)) {
            // Миттєва обробка
            const prevState = state;
            state = rootReducer(state, modifiedAction);

            if (state !== prevState) {
                CacheManager.set(CacheManager.NAMESPACES.UI, 'currentState', state);
                saveStateToStorage();
                notifyListeners([modifiedAction], prevState);
            }
        } else {
            // Батчова обробка
            updateQueue.push(modifiedAction);
            scheduleFlush();
        }

        return modifiedAction;
    }

    /**
     * Кореневий reducer
     */
    function rootReducer(state = initialState, action) {
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
     * User Reducer
     */
    function userReducer(state = initialState.user, action) {
        switch(action.type) {
            case ActionTypes.SET_USER:
                return { ...state, ...action.payload };

            case ActionTypes.UPDATE_BALANCE: {
                const newBalance = { ...state.balance };

                // Підтримка різних форматів
                if (action.payload.winix !== undefined) {
                    newBalance.winix = action.payload.winix;
                } else if (action.payload.balance !== undefined) {
                    newBalance.winix = action.payload.balance;
                }

                if (action.payload.tickets !== undefined) {
                    newBalance.tickets = action.payload.tickets;
                } else if (action.payload.coins !== undefined) {
                    newBalance.tickets = action.payload.coins;
                }

                if (action.payload.flex !== undefined) {
                    newBalance.flex = action.payload.flex;
                }

                // Емітуємо подію через EventBus
                EventBus.emit(EventBus.EVENTS.BALANCE_UPDATED, {
                    oldBalance: state.balance,
                    newBalance,
                    change: {
                        winix: newBalance.winix - state.balance.winix,
                        tickets: newBalance.tickets - state.balance.tickets,
                        flex: newBalance.flex - state.balance.flex
                    }
                });

                return {
                    ...state,
                    balance: newBalance,
                    lastSync: Date.now()
                };
            }

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
            case ActionTypes.SET_WALLET_CONNECTED: {
                const connected = action.payload;

                // Емітуємо подію
                EventBus.emit(
                    connected ? EventBus.EVENTS.WALLET_CONNECTED : EventBus.EVENTS.WALLET_DISCONNECTED,
                    { wallet: state }
                );

                return {
                    ...state,
                    connected,
                    lastCheck: Date.now()
                };
            }

            case ActionTypes.SET_WALLET_ADDRESS:
                return {
                    ...state,
                    address: action.payload.address,
                    addressFriendly: action.payload.addressFriendly || action.payload.address,
                    chainId: action.payload.chainId,
                    provider: action.payload.provider
                };

            case ActionTypes.SET_WALLET_CHECKING:
                return { ...state, checking: action.payload };

            case ActionTypes.DISCONNECT_WALLET:
                EventBus.emit(EventBus.EVENTS.WALLET_DISCONNECTED, { wallet: state });
                return {
                    ...initialState.wallet,
                    lastCheck: Date.now()
                };

            case ActionTypes.SET_FLEX_BALANCE: {
                const newBalance = action.payload;

                if (newBalance !== state.flexBalance) {
                    EventBus.emit(EventBus.EVENTS.FLEX_BALANCE_UPDATED, {
                        oldBalance: state.flexBalance,
                        newBalance
                    });
                }

                return {
                    ...state,
                    flexBalance: newBalance
                };
            }

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
            case ActionTypes.SET_FLEX_BALANCE: {
                const newBalance = action.payload;

                if (newBalance !== state.flexBalance) {
                    EventBus.emit(EventBus.EVENTS.FLEX_BALANCE_UPDATED, {
                        oldBalance: state.flexBalance,
                        newBalance
                    });
                }

                return {
                    ...state,
                    flexBalance: newBalance,
                    lastBalanceCheck: Date.now()
                };
            }

            case ActionTypes.SET_FLEX_LEVEL_CLAIMED: {
                const level = action.payload.level;

                EventBus.emit(EventBus.EVENTS.FLEX_LEVEL_CLAIMED, {
                    level,
                    timestamp: Date.now()
                });

                return {
                    ...state,
                    levels: {
                        ...state.levels,
                        [level]: {
                            ...state.levels[level],
                            claimed: true,
                            lastClaim: Date.now()
                        }
                    }
                };
            }

            case ActionTypes.SET_FLEX_LEVEL_AVAILABLE: {
                const { level, available } = action.payload;

                if (available && !state.levels[level].available) {
                    EventBus.emit(EventBus.EVENTS.FLEX_LEVEL_AVAILABLE, { level });
                }

                return {
                    ...state,
                    levels: {
                        ...state.levels,
                        [level]: {
                            ...state.levels[level],
                            available
                        }
                    }
                };
            }

            case ActionTypes.SET_FLEX_CHECKING:
                return { ...state, checking: action.payload };

            case ActionTypes.SET_FLEX_CLAIMING:
                return { ...state, claiming: action.payload };

            case ActionTypes.RESET_FLEX_DAILY: {
                const resetLevels = {};
                Object.keys(state.levels).forEach(level => {
                    resetLevels[level] = {
                        ...state.levels[level],
                        claimed: false
                    };
                });
                return { ...state, levels: resetLevels };
            }

            case ActionTypes.HYDRATE_STATE:
                return action.payload.flexEarn || state;

            case ActionTypes.RESET_STATE:
                return initialState.flexEarn;

            default:
                return state;
        }
    }

    /**
     * Daily Bonus Reducer
     */
    function dailyBonusReducer(state = initialState.dailyBonus, action) {
        switch(action.type) {
            case ActionTypes.SET_DAILY_STREAK: {
                const newStreak = action.payload.current;

                if (newStreak !== state.currentStreak) {
                    EventBus.emit(EventBus.EVENTS.DAILY_STREAK_UPDATED, {
                        oldStreak: state.currentStreak,
                        newStreak
                    });
                }

                return {
                    ...state,
                    currentStreak: newStreak,
                    longestStreak: Math.max(state.longestStreak, newStreak)
                };
            }

            case ActionTypes.CLAIM_DAILY_BONUS: {
                const today = new Date().toDateString();

                EventBus.emit(EventBus.EVENTS.DAILY_CLAIMED, {
                    reward: action.payload,
                    day: state.currentStreak + 1
                });

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
            }

            case ActionTypes.ADD_TICKET_DAY:
                return {
                    ...state,
                    ticketDays: [...state.ticketDays, action.payload]
                };

            case ActionTypes.SET_DAILY_CLAIMING:
                return {
                    ...state,
                    claiming: action.payload
                };

            case ActionTypes.ADD_CLAIMED_DAY:
                if (!state.claimedDays.includes(action.payload)) {
                    return {
                        ...state,
                        claimedDays: [...state.claimedDays, action.payload]
                    };
                }
                return state;

            case ActionTypes.SET_CLAIMED_DAYS:
                return {
                    ...state,
                    claimedDays: action.payload || []
                };

            case ActionTypes.UPDATE_DAILY_TOTAL_CLAIMED:
                return {
                    ...state,
                    totalClaimed: {
                        winix: action.payload.winix || 0,
                        tickets: action.payload.tickets || 0
                    }
                };

            case ActionTypes.RESET_DAILY_BONUS:
                EventBus.emit(EventBus.EVENTS.DAILY_RESET);
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
                return {
                    ...state,
                    [action.payload.type]: action.payload.tasks,
                    lastUpdate: Date.now()
                };

            case ActionTypes.UPDATE_TASK_STATUS: {
                const { type, taskId, status } = action.payload;

                // Емітуємо події для різних статусів
                switch(status) {
                    case 'started':
                        EventBus.emit(EventBus.EVENTS.TASK_STARTED, { type, taskId });
                        break;
                    case 'completed':
                        EventBus.emit(EventBus.EVENTS.TASK_COMPLETED, { type, taskId });
                        break;
                    case 'failed':
                        EventBus.emit(EventBus.EVENTS.TASK_FAILED, { type, taskId });
                        break;
                    case 'claimed':
                        EventBus.emit(EventBus.EVENTS.TASK_CLAIMED, { type, taskId });
                        break;
                }

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
            }

            case ActionTypes.SET_TASKS_LOADING:
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
            case ActionTypes.SET_CURRENT_TAB: {
                const newTab = action.payload;

                if (newTab !== state.currentTab) {
                    EventBus.emit(EventBus.EVENTS.TAB_CHANGED, {
                        oldTab: state.currentTab,
                        newTab
                    });
                }

                return { ...state, currentTab: newTab };
            }

            case ActionTypes.SET_LOADING: {
                const loading = action.payload;

                EventBus.emit(
                    loading ? EventBus.EVENTS.LOADING_START : EventBus.EVENTS.LOADING_END
                );

                return { ...state, loading };
            }

            case ActionTypes.SET_ERROR: {
                if (action.payload) {
                    EventBus.emit(EventBus.EVENTS.APP_ERROR, { error: action.payload });
                }

                return { ...state, error: action.payload };
            }

            case ActionTypes.ADD_TOAST:
                return {
                    ...state,
                    toasts: [...state.toasts, {
                        id: window.TasksUtils.generateId(),
                        ...action.payload,
                        timestamp: Date.now()
                    }]
                };

            case ActionTypes.REMOVE_TOAST:
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
            case ActionTypes.SET_ONLINE: {
                const online = action.payload;

                EventBus.emit(
                    online ? EventBus.EVENTS.NETWORK_ONLINE : EventBus.EVENTS.NETWORK_OFFLINE
                );

                return {
                    ...state,
                    online,
                    lastOnline: online ? Date.now() : state.lastOnline
                };
            }

            case ActionTypes.HYDRATE_STATE:
                return action.payload.network || state;

            case ActionTypes.RESET_STATE:
                return initialState.network;

            default:
                return state;
        }
    }

    /**
     * Мемоізовані селектори
     */
    const selectors = createMemoizedSelectors();

    function createMemoizedSelectors() {
        const cache = new Map();
        const cacheKey = () => JSON.stringify(state);

        function memoize(name, fn) {
            return function() {
                const key = `${name}:${cacheKey()}`;

                if (cache.has(key)) {
                    return cache.get(key);
                }

                const result = fn();
                cache.set(key, result);

                // Обмежуємо розмір кешу
                if (cache.size > 100) {
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }

                return result;
            };
        }

        return {
            // User selectors
            getUserId: memoize('userId', () => state.user.id),
            getUserBalance: memoize('userBalance', () => state.user.balance),
            getWinixBalance: memoize('winixBalance', () => state.user.balance.winix),
            getTicketsBalance: memoize('ticketsBalance', () => state.user.balance.tickets),

            // Wallet selectors
            isWalletConnected: memoize('walletConnected', () => state.wallet.connected),
            getWalletAddress: memoize('walletAddress', () => state.wallet.address),
            getWalletFlexBalance: memoize('walletFlexBalance', () => state.wallet.flexBalance),

            // Flex selectors
            getFlexBalance: memoize('flexBalance', () =>
                state.flexEarn.flexBalance || state.wallet.flexBalance
            ),
            getFlexLevel: (level) => state.flexEarn.levels[level],
            isFlexLevelClaimed: (level) => state.flexEarn.levels[level]?.claimed || false,
            isFlexLevelAvailable: (level) => state.flexEarn.levels[level]?.available || false,

            // Daily bonus selectors
            getCurrentStreak: memoize('currentStreak', () => state.dailyBonus.currentStreak),
            getLastClaimDate: memoize('lastClaimDate', () => state.dailyBonus.lastClaimDate),
            canClaimDailyBonus: memoize('canClaimDaily', () => {
                const lastClaim = state.dailyBonus.lastClaimDate;
                if (!lastClaim) return true;
                return window.TasksUtils.isNewDay(lastClaim);
            }),
            getDailyBonus: memoize('dailyBonus', () => state.dailyBonus),
            getDailyStreak: memoize('dailyStreak', () => state.dailyBonus.currentStreak),
            getClaimedDays: memoize('claimedDays', () => state.dailyBonus.claimedDays),
            isDailyClaiming: memoize('dailyClaiming', () => state.dailyBonus.claiming),
            getTotalClaimed: memoize('totalClaimed', () => state.dailyBonus.totalClaimed),
            getTicketDays: memoize('ticketDays', () => state.dailyBonus.ticketDays),

            // Tasks selectors
            getTasks: (type) => state.tasks[type] || {},
            getTaskById: (type, id) => state.tasks[type]?.[id],
            isTasksLoading: memoize('tasksLoading', () => state.tasks.loading),

            // UI selectors
            getCurrentTab: memoize('currentTab', () => state.ui.currentTab),
            isLoading: memoize('isLoading', () => state.ui.loading),
            getError: memoize('error', () => state.ui.error),
            getToasts: memoize('toasts', () => state.ui.toasts),

            // Network selectors
            isOnline: memoize('isOnline', () => state.network.online),

            // Загальний стан
            getState: () => state
        };
    }

    /**
     * Action creators
     */
    const actions = {
        // User actions
        setUser: (userData) => dispatch({ type: ActionTypes.SET_USER, payload: userData }),
        updateBalance: (balances) => dispatch({ type: ActionTypes.UPDATE_BALANCE, payload: balances }),
        clearUser: () => dispatch({ type: ActionTypes.CLEAR_USER }),

        // Wallet actions
        setWalletConnected: (connected) =>
            dispatch({ type: ActionTypes.SET_WALLET_CONNECTED, payload: connected }),
        setWalletAddress: (data) =>
            dispatch({ type: ActionTypes.SET_WALLET_ADDRESS, payload: data }),
        setWalletChecking: (checking) =>
            dispatch({ type: ActionTypes.SET_WALLET_CHECKING, payload: checking }),
        disconnectWallet: () => dispatch({ type: ActionTypes.DISCONNECT_WALLET }),

        // Flex actions
        setFlexBalance: (balance) =>
            dispatch({ type: ActionTypes.SET_FLEX_BALANCE, payload: balance }),
        setFlexLevelClaimed: (level) =>
            dispatch({ type: ActionTypes.SET_FLEX_LEVEL_CLAIMED, payload: { level } }),
        setFlexLevelAvailable: (level, available) =>
            dispatch({ type: ActionTypes.SET_FLEX_LEVEL_AVAILABLE, payload: { level, available } }),
        setFlexChecking: (checking) =>
            dispatch({ type: ActionTypes.SET_FLEX_CHECKING, payload: checking }),
        setFlexClaiming: (claiming) =>
            dispatch({ type: ActionTypes.SET_FLEX_CLAIMING, payload: claiming }),
        resetFlexDaily: () => dispatch({ type: ActionTypes.RESET_FLEX_DAILY }),

        // Daily bonus actions
        setDailyStreak: (current) =>
            dispatch({ type: ActionTypes.SET_DAILY_STREAK, payload: { current } }),
        claimDailyBonus: (rewards) =>
            dispatch({ type: ActionTypes.CLAIM_DAILY_BONUS, payload: rewards }),
        addTicketDay: (date) =>
            dispatch({ type: ActionTypes.ADD_TICKET_DAY, payload: date }),
        setDailyClaiming: (claiming) =>
            dispatch({ type: ActionTypes.SET_DAILY_CLAIMING, payload: claiming }),
        addClaimedDay: (day) =>
            dispatch({ type: ActionTypes.ADD_CLAIMED_DAY, payload: day }),
        setClaimedDays: (days) =>
            dispatch({ type: ActionTypes.SET_CLAIMED_DAYS, payload: days }),
        updateDailyTotalClaimed: (totals) =>
            dispatch({ type: ActionTypes.UPDATE_DAILY_TOTAL_CLAIMED, payload: totals }),
        resetDailyBonus: () => dispatch({ type: ActionTypes.RESET_DAILY_BONUS }),

        // Tasks actions
        setTasks: (type, tasks) =>
            dispatch({ type: ActionTypes.SET_TASKS, payload: { type, tasks } }),
        updateTaskStatus: (type, taskId, status) =>
            dispatch({ type: ActionTypes.UPDATE_TASK_STATUS, payload: { type, taskId, status } }),
        setTasksLoading: (loading) =>
            dispatch({ type: ActionTypes.SET_TASKS_LOADING, payload: loading }),

        // UI actions
        setCurrentTab: (tab) =>
            dispatch({ type: ActionTypes.SET_CURRENT_TAB, payload: tab }),
        setLoading: (loading) =>
            dispatch({ type: ActionTypes.SET_LOADING, payload: loading }),
        setError: (error) =>
            dispatch({ type: ActionTypes.SET_ERROR, payload: error }),
        addToast: (toast) =>
            dispatch({ type: ActionTypes.ADD_TOAST, payload: toast }),
        removeToast: (id) =>
            dispatch({ type: ActionTypes.REMOVE_TOAST, payload: id }),

        // Network actions
        setOnline: (online) =>
            dispatch({ type: ActionTypes.SET_ONLINE, payload: online }),

        // Global actions
        resetState: () => dispatch({ type: ActionTypes.RESET_STATE }),
        hydrateState: (savedState) =>
            dispatch({ type: ActionTypes.HYDRATE_STATE, payload: savedState })
    };

    /**
     * Підписка на зміни
     */
    function subscribe(listener) {
        listeners.add(listener);

        return function unsubscribe() {
            listeners.delete(listener);
        };
    }

    /**
     * Повідомлення слухачів
     */
    function notifyListeners(actions, prevState) {
        // Використовуємо EventBus для уникнення прямих залежностей
        EventBus.emit('store.updated', {
            state,
            prevState,
            actions
        });

        // Також викликаємо прямих слухачів
        listeners.forEach(listener => {
            queueMicrotask(() => {
                try {
                    listener(state, prevState, actions.length === 1 ? actions[0] : actions);
                } catch (error) {
                    console.error('❌ [TasksStore] Помилка в слухачі:', error);
                }
            });
        });
    }

    /**
     * Middleware система
     */
    function applyMiddleware(...mws) {
        middleware.push(...mws);
    }

    /**
     * Збереження стану
     */
    const saveStateToStorage = window.TasksUtils.debounce(function() {
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

        sessionStorage.setItem('tasksStoreState', JSON.stringify(stateToSave));
    }, 1000);

    /**
     * Завантаження стану
     */
    function loadStateFromStorage() {
        try {
            const savedStateStr = sessionStorage.getItem('tasksStoreState');
            if (savedStateStr) {
                const savedState = JSON.parse(savedStateStr);
                actions.hydrateState(savedState);
            }
        } catch (error) {
            console.error('❌ [TasksStore] Помилка завантаження стану:', error);
            sessionStorage.removeItem('tasksStoreState');
        }
    }

    /**
     * Отримати поточний стан
     */
    function getState() {
        return state;
    }

    /**
     * Ініціалізація
     */
    function init() {
        console.log('🚀 [TasksStore] Ініціалізація стору');

        // Завантажуємо збережений стан
        loadStateFromStorage();

        // Налаштовуємо слухачі мережі
        window.addEventListener('online', () => actions.setOnline(true));
        window.addEventListener('offline', () => actions.setOnline(false));

        // Підписуємось на події CacheManager для синхронізації
        CacheManager.subscribe(CacheManager.NAMESPACES.BALANCE, (action, key, value) => {
            if (action === 'set' && value) {
                actions.updateBalance(value);
            }
        });

        // Емітуємо подію готовності
        EventBus.emit(EventBus.EVENTS.APP_READY, { store: true });

        console.log('✅ [TasksStore] Стор ініціалізовано');
    }

    // Автоматична ініціалізація
    init();

    console.log('✅ [TasksStore] Redux-подібний стор готовий (ОПТИМІЗОВАНИЙ)');

    // Публічний API
    return {
        dispatch,
        subscribe,
        getState,
        selectors,
        actions,
        ActionTypes,
        applyMiddleware
    };

})();

console.log('✅ [TasksStore] Модуль стору експортовано глобально');