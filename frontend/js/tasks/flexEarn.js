/**
 * Модуль Flex Earn для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ - виправлено контекст this та додано кешування
 */

window.FlexEarnManager = (function() {
    'use strict';

    console.log('💎 [FlexEarn] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ FLEX EARN (ОПТИМІЗОВАНИЙ) =====');

    // Конфігурація Flex завдань (з констант)
    const FLEX_LEVELS = window.TasksConstants?.FLEX_LEVELS || {};

    // Стан модуля
    let state = {
        walletConnected: false,
        walletAddress: null,
        flexBalance: 0,
        claimedToday: {},
        lastClaimTime: {},
        userId: null,
        isLoading: false,
        autoCheckInterval: null,
        walletChecker: null,
        lastBalanceCheck: 0,
        balanceCache: null,
        cacheTimeout: 30000, // 30 секунд кеш
        isCheckingBalance: false,
        unsubscribeStore: null // Для збереження функції відписки
    };

    /**
     * Ініціалізація модуля
     */
    function init(userId) {
        console.log('🚀 [FlexEarn] Ініціалізація модуля');
        console.log('👤 [FlexEarn] User ID:', userId);
        console.log('📊 [FlexEarn] Конфігурація рівнів:', FLEX_LEVELS);

        state.userId = userId;

        // Завантажуємо збережений стан
        loadState();

        // Ініціалізуємо WalletChecker якщо доступний
        if (window.WalletChecker) {
            state.walletChecker = window.WalletChecker;
            state.walletChecker.init().catch(error => {
                console.error('❌ [FlexEarn] Помилка ініціалізації WalletChecker:', error);
            });
        }

        // Перевіряємо статус кошелька
        checkWalletConnection();

        // Налаштовуємо автоматичну перевірку
        setupAutoCheck();

        // Додаємо обробники подій
        setupEventHandlers();

        console.log('✅ [FlexEarn] Модуль ініціалізовано успішно');
        return {
            checkWalletConnection,
            checkFlexBalance,
            claimReward,
            getState: () => state,
            destroy
        };
    }

    /**
     * Перевірка підключення кошелька
     */
    async function checkWalletConnection() {
        console.log('🔍 [FlexEarn] === ПЕРЕВІРКА ПІДКЛЮЧЕННЯ КОШЕЛЬКА ===');
        console.log('📊 [FlexEarn] Поточний стан:', {
            walletConnected: state.walletConnected,
            walletAddress: state.walletAddress
        });

        // Показуємо індикатор завантаження
        showLoadingState();

        try {
            // Використовуємо WalletChecker якщо доступний
            if (state.walletChecker) {
                const isConnected = await state.walletChecker.checkWalletConnection();
                console.log('🎲 [FlexEarn] Результат перевірки WalletChecker:', isConnected);

                if (isConnected) {
                    const walletStatus = state.walletChecker.getStatus();
                    // Дані будуть оновлені через Store
                    return;
                }
            }

            // Альтернативна перевірка через API
            const response = await window.TasksAPI.wallet.checkStatus(state.userId);
            console.log('📊 [FlexEarn] Відповідь API:', response);

            if (response.connected) {
                state.walletConnected = true;
                state.walletAddress = response.address;
                console.log('✅ [FlexEarn] Кошелек підключено');
                console.log('📍 [FlexEarn] Адреса кошелька:', state.walletAddress);

                // Перевіряємо баланс FLEX
                await checkFlexBalance();

                // Показуємо завдання
                showFlexTasks();
            } else {
                state.walletConnected = false;
                state.walletAddress = null;
                console.log('❌ [FlexEarn] Кошелек не підключено');
                console.log('💡 [FlexEarn] Показуємо блок підключення кошелька');

                // Показуємо блок підключення
                showWalletConnect();
            }

        } catch (error) {
            console.error('❌ [FlexEarn] Помилка перевірки кошелька:', error);
            state.walletConnected = false;
            showWalletConnect();
        } finally {
            hideLoadingState();
            saveState();
        }
    }

    /**
     * Перевірка балансу FLEX токенів з кешуванням
     */
    async function checkFlexBalance(forceRefresh = false) {
        console.log('💰 [FlexEarn] === ПЕРЕВІРКА БАЛАНСУ FLEX ===');
        console.log('📍 [FlexEarn] Адреса для перевірки:', state.walletAddress);
        console.log('🔄 [FlexEarn] Примусове оновлення:', forceRefresh);

        if (!state.walletConnected || !state.walletAddress) {
            console.warn('⚠️ [FlexEarn] Кошелек не підключено, пропускаємо перевірку балансу');
            return;
        }

        // Перевіряємо чи вже виконується перевірка
        if (state.isCheckingBalance) {
            console.log('⏳ [FlexEarn] Перевірка вже виконується, пропускаємо');
            return;
        }

        // Перевіряємо кеш
        const now = Date.now();
        const timeSinceLastCheck = now - state.lastBalanceCheck;

        if (!forceRefresh && state.balanceCache !== null && timeSinceLastCheck < state.cacheTimeout) {
            console.log('📦 [FlexEarn] Використовуємо кешований баланс:', formatNumber(state.balanceCache));
            console.log('⏰ [FlexEarn] Час з останньої перевірки:', Math.floor(timeSinceLastCheck / 1000), 'сек');

            // Використовуємо кешований баланс
            state.flexBalance = state.balanceCache;
            updateFlexTasksUI();
            return;
        }

        state.isCheckingBalance = true;

        try {
            const oldBalance = state.flexBalance;

            // Отримуємо баланс з API
            const response = await window.TasksAPI.flex.getBalance(state.userId, state.walletAddress);

            state.flexBalance = parseInt(response.balance) || 0;
            state.balanceCache = state.flexBalance;
            state.lastBalanceCheck = now;

            console.log('💎 [FlexEarn] Баланс FLEX оновлено');
            console.log('  📊 Старий баланс:', formatNumber(oldBalance));
            console.log('  📊 Новий баланс:', formatNumber(state.flexBalance));
            console.log('  📈 Зміна:', formatNumber(state.flexBalance - oldBalance));

            // Оновлюємо Store
            window.TasksStore.actions.setFlexBalance(state.flexBalance);

            // Оновлюємо UI
            updateFlexTasksUI();

            // Перевіряємо доступні винагороди
            await checkAvailableRewards();

            saveState();

            console.log('✅ [FlexEarn] Перевірка балансу завершена');
        } catch (error) {
            console.error('❌ [FlexEarn] Помилка перевірки балансу:', error);

            // Якщо помилка не 429, показуємо повідомлення
            if (!error.message?.includes('429')) {
                window.TasksUtils.showToast('Помилка перевірки балансу FLEX', 'error');
            }
        } finally {
            state.isCheckingBalance = false;
        }
    }

    /**
     * Перевірка доступних винагород
     */
    async function checkAvailableRewards() {
        console.log('🎁 [FlexEarn] === ПЕРЕВІРКА ДОСТУПНИХ ВИНАГОРОД ===');
        console.log('💎 [FlexEarn] Поточний баланс FLEX:', formatNumber(state.flexBalance));

        try {
            // Перевіряємо рівні на бекенді
            const response = await window.TasksAPI.flex.checkLevels(state.userId, state.flexBalance);

            let availableCount = 0;
            let totalPotentialWinix = 0;
            let totalPotentialTickets = 0;

            // Оновлюємо стан рівнів з відповіді сервера
            Object.entries(response.levels).forEach(([level, levelData]) => {
                const levelConfig = FLEX_LEVELS[level];
                if (!levelConfig) return;

                const hasEnough = levelData.hasEnough;
                const claimedToday = levelData.claimedToday;

                // Оновлюємо стан
                state.claimedToday[level] = claimedToday;

                // Оновлюємо Store
                window.TasksStore.actions.setFlexLevelAvailable(level, hasEnough);

                console.log(`📊 [FlexEarn] ${level}:`, {
                    required: formatNumber(levelConfig.required),
                    hasEnough: hasEnough,
                    claimedToday: claimedToday,
                    canClaim: hasEnough && !claimedToday
                });

                if (hasEnough && !claimedToday) {
                    availableCount++;
                    totalPotentialWinix += levelConfig.rewards.winix;
                    totalPotentialTickets += levelConfig.rewards.tickets;
                }
            });

            console.log('🎯 [FlexEarn] Підсумок доступних винагород:', {
                доступноРівнів: availableCount,
                потенційніWinix: totalPotentialWinix,
                потенційніTickets: totalPotentialTickets
            });

            if (availableCount > 0) {
                window.TasksUtils.showToast(
                    `Доступно ${availableCount} ${availableCount === 1 ? 'винагорода' : 'винагороди'}!`,
                    'success'
                );
            }

        } catch (error) {
            console.error('❌ [FlexEarn] Помилка перевірки рівнів:', error);
        }
    }

   /**
     * Показати блок підключення кошелька
     */
    function showWalletConnect() {
        console.log('🔌 [FlexEarn] Показуємо блок підключення кошелька');

        const statusContainer = document.querySelector('.wallet-status-container');
        const tasksContainer = document.getElementById('flex-tasks');
        const connectedStatus = document.getElementById('wallet-connected-status');

        if (statusContainer) {
            statusContainer.style.display = 'block';
            console.log('✅ [FlexEarn] Блок статусу кошелька показано');
        } else {
            console.error('❌ [FlexEarn] Елемент .wallet-status-container не знайдено');
        }

        if (tasksContainer) {
            tasksContainer.style.display = 'none';
            console.log('✅ [FlexEarn] Контейнер завдань приховано');
        }

        // Приховуємо статус підключеного гаманця
        if (connectedStatus) {
            connectedStatus.style.display = 'none';
        }

        // Оновлюємо статус
        const statusText = document.getElementById('wallet-connection-status');
        if (statusText) {
            statusText.textContent = 'Кошелек не підключено';
        }
    }

    /**
     * Показати Flex завдання
     */
    function showFlexTasks() {
        console.log('📋 [FlexEarn] Показуємо Flex завдання');

        const statusContainer = document.querySelector('.wallet-status-container');
        const tasksContainer = document.getElementById('flex-tasks');

        if (statusContainer) {
            statusContainer.style.display = 'none';
            console.log('✅ [FlexEarn] Блок статусу кошелька приховано');
        }

        if (tasksContainer) {
            tasksContainer.style.display = 'block';
            console.log('✅ [FlexEarn] Контейнер завдань показано');
        } else {
            console.error('❌ [FlexEarn] Елемент #flex-tasks не знайдено');
        }

        // Показуємо статус підключеного гаманця якщо є адреса
        if (state.walletAddress) {
            const connectedStatus = document.getElementById('wallet-connected-status');
            if (connectedStatus) {
                connectedStatus.style.display = 'block';

                const addressDisplay = document.getElementById('wallet-address-display');
                if (addressDisplay) {
                    const formattedAddress = `${state.walletAddress.slice(0, 8)}...${state.walletAddress.slice(-6)}`;
                    addressDisplay.textContent = formattedAddress;
                }
            }
        }
    }

    /**
     * Оновити UI завдань
     */
    function updateFlexTasksUI() {
        console.log('🔄 [FlexEarn] === ОНОВЛЕННЯ UI ЗАВДАНЬ ===');

        Object.keys(FLEX_LEVELS).forEach(level => {
            const levelData = FLEX_LEVELS[level];
            const card = document.querySelector(`.flex-task-card[data-level="${level.toLowerCase()}"]`);

            if (!card) {
                console.warn(`⚠️ [FlexEarn] Картка для рівня ${level} не знайдена`);
                return;
            }

            // Оновлюємо прогрес
            const progress = Math.min((state.flexBalance / levelData.required) * 100, 100);
            const progressFill = card.querySelector(`.progress-fill`);
            const progressText = card.querySelector('.progress-text');

            console.log(`📊 [FlexEarn] Оновлення ${level}:`, {
                прогрес: progress.toFixed(2) + '%',
                баланс: formatNumber(state.flexBalance),
                потрібно: formatNumber(levelData.required)
            });

            if (progressFill) {
                progressFill.style.width = `${progress}%`;
            }

            if (progressText) {
                progressText.textContent = `${formatNumber(state.flexBalance)} / ${formatNumber(levelData.required)} FLEX`;
            }

            // Оновлюємо кнопку
            const claimButton = card.querySelector('.claim-button');
            if (claimButton) {
                updateClaimButton(claimButton, level, state.flexBalance >= levelData.required);
            }
        });

        console.log('✅ [FlexEarn] UI оновлено');
    }

    /**
     * Оновити стан кнопки отримання
     */
    function updateClaimButton(button, level, hasEnoughFlex) {
        const claimedToday = state.claimedToday[level];
        const canClaim = hasEnoughFlex && !claimedToday;

        console.log(`🔘 [FlexEarn] Оновлення кнопки ${level}:`, {
            hasEnoughFlex,
            claimedToday,
            canClaim
        });

        button.disabled = !canClaim;

        if (!hasEnoughFlex) {
            button.innerHTML = '<span class="button-text">Недостатньо FLEX</span>';
            button.className = 'claim-button ' + level.toLowerCase() + '-claim';
        } else if (claimedToday) {
            const nextClaimTime = getNextClaimTime(level);
            button.innerHTML = `<span class="button-text">Отримано сьогодні (${nextClaimTime})</span>`;
            button.className = 'claim-button ' + level.toLowerCase() + '-claim claimed';
        } else {
            button.innerHTML = '<span class="button-text">Отримати винагороду</span>';
            button.className = 'claim-button ' + level.toLowerCase() + '-claim available';
        }

        // Додаємо обробник кліку
        if (canClaim && !button.hasAttribute('data-handler')) {
            button.setAttribute('data-handler', 'true');
            button.addEventListener('click', () => claimReward(level));
            console.log(`✅ [FlexEarn] Додано обробник кліку для ${level}`);
        }
    }

    /**
     * Отримати винагороду з дебаунсом
     */
    const claimReward = window.TasksUtils.debounce(async function(level) {
        console.log('🎁 [FlexEarn] === ОТРИМАННЯ ВИНАГОРОДИ ===');
        console.log('📊 [FlexEarn] Рівень:', level);

        const levelData = FLEX_LEVELS[level];
        console.log('📋 [FlexEarn] Дані рівня:', levelData);

        if (!levelData) {
            console.error('❌ [FlexEarn] Невідомий рівень:', level);
            return;
        }

        if (state.flexBalance < levelData.required) {
            console.error('❌ [FlexEarn] Недостатньо FLEX для отримання винагороди');
            console.log('  💎 Поточний баланс:', formatNumber(state.flexBalance));
            console.log('  📊 Потрібно:', formatNumber(levelData.required));
            window.TasksUtils.showToast('Недостатньо FLEX токенів', 'error');
            return;
        }

        if (state.claimedToday[level]) {
            console.warn('⚠️ [FlexEarn] Винагорода вже отримана сьогодні');
            window.TasksUtils.showToast('Винагороду вже отримано сьогодні', 'warning');
            return;
        }

        console.log('🔄 [FlexEarn] Обробка запиту на отримання винагороди...');

        // Блокуємо кнопку
        const card = document.querySelector(`.flex-task-card[data-level="${level.toLowerCase()}"]`);
        const button = card?.querySelector('.claim-button');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="button-text">Обробка...</span>';
            console.log('🔒 [FlexEarn] Кнопка заблокована');
        }

        try {
            // Відправляємо запит на сервер
            const response = await window.TasksAPI.flex.claimReward(state.userId, level);

            console.log('💰 [FlexEarn] Відповідь сервера:', response);

            if (response.success) {
                // Оновлюємо стан
                state.claimedToday[level] = true;
                state.lastClaimTime[level] = Date.now();

                console.log('📝 [FlexEarn] Стан оновлено:', {
                    level,
                    claimedToday: true,
                    lastClaimTime: new Date(state.lastClaimTime[level]).toLocaleString()
                });

                // Оновлюємо Store
                window.TasksStore.actions.setFlexLevelClaimed(level);

                // Оновлюємо баланси
                updateBalances(response.reward.winix, response.reward.tickets);

                // Показуємо анімацію винагороди
                showRewardAnimation(levelData);

                // Оновлюємо UI
                updateClaimButton(button, level, true);

                // Зберігаємо стан
                saveState();

                console.log('✅ [FlexEarn] Винагорода успішно отримана!');

                // Логуємо статистику
                logClaimStatistics();
            } else {
                throw new Error(response.message || 'Помилка отримання винагороди');
            }

        } catch (error) {
            console.error('❌ [FlexEarn] Помилка отримання винагороди:', error);
            window.TasksUtils.showToast(error.message || 'Помилка отримання винагороди', 'error');

            // Відновлюємо кнопку
            if (button) {
                updateClaimButton(button, level, true);
            }
        }
    }, 1000); // 1 секунда дебаунс

    /**
     * Оновити баланси
     */
    function updateBalances(winix, tickets) {
        console.log('💰 [FlexEarn] === ОНОВЛЕННЯ БАЛАНСІВ ===');

        const currentBalance = window.TasksStore.selectors.getUserBalance();
        const newBalance = {
            winix: currentBalance.winix + winix,
            tickets: currentBalance.tickets + tickets
        };

        console.log('💎 [FlexEarn] Оновлення балансів:', {
            було: currentBalance,
            додано: { winix, tickets },
            стало: newBalance
        });

        // Оновлюємо Store
        window.TasksStore.actions.updateBalance(newBalance);

        // Оновлюємо UI
        const winixElement = document.getElementById('user-winix');
        const ticketsElement = document.getElementById('user-tickets');

        if (winixElement) {
            winixElement.textContent = newBalance.winix;
            winixElement.classList.add('updating');
            setTimeout(() => {
                winixElement.classList.remove('updating');
            }, 800);
        }

        if (ticketsElement) {
            ticketsElement.textContent = newBalance.tickets;
            ticketsElement.classList.add('updating');
            setTimeout(() => {
                ticketsElement.classList.remove('updating');
            }, 800);
        }

        console.log('✅ [FlexEarn] Баланси оновлено');
    }

    /**
     * Показати анімацію винагороди
     */
    function showRewardAnimation(levelData) {
        console.log('🎊 [FlexEarn] Показуємо анімацію винагороди для рівня:', levelData.name);

        // Створюємо елемент анімації
        const animDiv = document.createElement('div');
        animDiv.className = 'reward-claimed';

        // SVG іконка відповідно до рівня
        const iconSvg = getRewardIconSvg(levelData.name);

        animDiv.innerHTML = `
            <div class="reward-icon-large">${iconSvg}</div>
            <div>+${levelData.rewards.winix} WINIX</div>
            <div>+${levelData.rewards.tickets} TICKETS</div>
        `;

        document.body.appendChild(animDiv);
        console.log('✅ [FlexEarn] Елемент анімації додано до DOM');

        // Запускаємо анімацію
        setTimeout(() => {
            animDiv.classList.add('show');
        }, 10);

        // Видаляємо після анімації
        setTimeout(() => {
            animDiv.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(animDiv);
                console.log('✅ [FlexEarn] Елемент анімації видалено з DOM');
            }, 500);
        }, 2000);

        // Показуємо toast
        window.TasksUtils.showToast(
            `Отримано ${levelData.rewards.winix} WINIX та ${levelData.rewards.tickets} tickets!`,
            'success'
        );
    }

    /**
     * Отримати SVG іконку для винагороди
     */
    function getRewardIconSvg(level) {
        const svgIcons = {
            'Bronze': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="1.5"/><path d="M12 7V12L15 15" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="white"/></svg>',
            'Silver': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="1.5"/><path d="M12 2L14.5 8.5L21 9L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9L9.5 8.5L12 2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>',
            'Gold': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 8V14C4 18.42 7.16 22.21 12 23C16.84 22.21 20 18.42 20 14V8L12 2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            'Platinum': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M5 16L3 9L9 11L12 6L15 11L21 9L19 16H5Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 16L6 20H18L19 16" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>',
            'Diamond': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M6 3L3 9L12 21L21 9L18 3H6Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 9H21" stroke="white" stroke-width="1.5"/><path d="M12 3L8 9L12 21L16 9L12 3Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>'
        };

        return svgIcons[level] || svgIcons['Bronze'];
    }

    /**
     * Налаштувати автоматичну перевірку
     */
    function setupAutoCheck() {
        console.log('⏰ [FlexEarn] === НАЛАШТУВАННЯ АВТОМАТИЧНОЇ ПЕРЕВІРКИ ===');

        // Очищуємо попередній інтервал
        if (state.autoCheckInterval) {
            clearInterval(state.autoCheckInterval);
            console.log('🧹 [FlexEarn] Попередній інтервал очищено');
        }

        // Перевірка кожні 5 хвилин
        const intervalMs = window.TasksConstants.TIMERS.AUTO_CHECK_INTERVAL;

        console.log(`⏱️ [FlexEarn] Встановлюємо інтервал: ${intervalMs / 60 / 1000} хвилин`);

        state.autoCheckInterval = setInterval(() => {
            if (state.walletConnected) {
                console.log('🔄 [FlexEarn] === АВТОМАТИЧНА ПЕРЕВІРКА ===');
                console.log('🕐 [FlexEarn] Час:', new Date().toISOString());
                checkFlexBalance();
            } else {
                console.log('⏸️ [FlexEarn] Автоматична перевірка пропущена - кошелек не підключено');
            }
        }, intervalMs);

        console.log('✅ [FlexEarn] Автоматична перевірка налаштована');
    }

    /**
     * Налаштувати обробники подій
     */
    function setupEventHandlers() {
        console.log('🎯 [FlexEarn] === НАЛАШТУВАННЯ ОБРОБНИКІВ ПОДІЙ ===');

        // Обробник для вкладки Flex
        const flexTab = document.querySelector('.tab-button[data-tab="flex"]');
        if (flexTab) {
            flexTab.addEventListener('click', () => {
                console.log('📑 [FlexEarn] Клік на вкладку Flex Earn');
                if (state.walletConnected) {
                    console.log('🔄 [FlexEarn] Оновлюємо дані при переході на вкладку');
                    checkFlexBalance();
                }
            });
            console.log('✅ [FlexEarn] Обробник для вкладки Flex додано');
        } else {
            console.warn('⚠️ [FlexEarn] Вкладка Flex не знайдена');
        }

        // Обробник для кнопки підключення кошелька
        const connectButton = document.querySelector('.connect-wallet-redirect');
        if (connectButton) {
            connectButton.addEventListener('click', (e) => {
                console.log('🔌 [FlexEarn] Клік на кнопку підключення кошелька');
                console.log('🚀 [FlexEarn] Перенаправлення на wallet.html');
            });
            console.log('✅ [FlexEarn] Обробник для кнопки підключення додано');
        }

        // ВИПРАВЛЕНО: Використовуємо arrow function для збереження контексту this
        if (window.TasksStore) {
            // Зберігаємо функцію відписки
            state.unsubscribeStore = window.TasksStore.subscribe((storeState, prevState) => {
                // Тепер 'state' доступний тут через замикання
                // Перевіряємо зміни підключення кошелька
                if (storeState.wallet.connected !== prevState.wallet.connected) {
                    console.log('🔄 [FlexEarn] Статус кошелька змінився:', storeState.wallet.connected);
                    if (storeState.wallet.connected) {
                        state.walletConnected = true;
                        state.walletAddress = storeState.wallet.address;
                        showFlexTasks();
                        checkFlexBalance();
                    } else {
                        state.walletConnected = false;
                        state.walletAddress = null;
                        showWalletConnect();
                    }
                }

                // Перевіряємо зміни балансу FLEX
                if (storeState.flexEarn.flexBalance !== prevState.flexEarn.flexBalance) {
                    console.log('💎 [FlexEarn] Баланс FLEX змінився в Store:', storeState.flexEarn.flexBalance);
                    state.flexBalance = storeState.flexEarn.flexBalance;
                    updateFlexTasksUI();
                }
            });

            console.log('✅ [FlexEarn] Підписка на Store встановлена');
        }

        console.log('✅ [FlexEarn] Всі обробники подій налаштовано');
    }

    /**
     * Отримати час наступного отримання
     */
    function getNextClaimTime(level) {
        const lastClaim = state.lastClaimTime[level];
        if (!lastClaim) return '00:00';

        const now = Date.now();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);

        const timeUntilMidnight = midnight.getTime() - now;
        const hours = Math.floor(timeUntilMidnight / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Показати стан завантаження
     */
    function showLoadingState() {
        console.log('⏳ [FlexEarn] Показуємо індикатор завантаження');
        state.isLoading = true;
        window.TasksStore?.actions.setFlexChecking(true);
    }

    /**
     * Приховати стан завантаження
     */
    function hideLoadingState() {
        console.log('✅ [FlexEarn] Приховуємо індикатор завантаження');
        state.isLoading = false;
        window.TasksStore?.actions.setFlexChecking(false);
    }

    /**
     * Зберегти стан
     */
    function saveState() {
        console.log('💾 [FlexEarn] Збереження стану...');
        try {
            const stateToSave = {
                walletConnected: state.walletConnected,
                walletAddress: state.walletAddress,
                flexBalance: state.flexBalance,
                claimedToday: state.claimedToday,
                lastClaimTime: state.lastClaimTime,
                userId: state.userId,
                lastBalanceCheck: state.lastBalanceCheck,
                balanceCache: state.balanceCache
            };

            window.TasksUtils.storage.set('flexEarnState', stateToSave);
            console.log('✅ [FlexEarn] Стан збережено:', stateToSave);
        } catch (error) {
            console.error('❌ [FlexEarn] Помилка збереження стану:', error);
        }
    }

    /**
     * Завантажити стан
     */
    function loadState() {
        console.log('📂 [FlexEarn] Завантаження збереженого стану...');
        try {
            const savedState = window.TasksUtils.storage.get('flexEarnState');
            if (savedState) {
                // Перевіряємо чи це дані поточного користувача
                if (savedState.userId === state.userId) {
                    Object.assign(state, savedState);
                    console.log('✅ [FlexEarn] Стан завантажено:', savedState);

                    // Перевіряємо чи винагороди були отримані сьогодні
                    checkDailyReset();
                } else {
                    console.log('🔄 [FlexEarn] Збережений стан для іншого користувача, ігноруємо');
                }
            } else {
                console.log('📭 [FlexEarn] Збережений стан не знайдено');
            }
        } catch (error) {
            console.error('❌ [FlexEarn] Помилка завантаження стану:', error);
        }
    }

    /**
     * Перевірити чи потрібно скинути щоденні дані
     */
    function checkDailyReset() {
        console.log('📅 [FlexEarn] Перевірка щоденного скидання...');

        const now = new Date();
        const today = now.toDateString();
        const lastResetDate = window.TasksUtils.storage.get('flexEarnLastReset');

        console.log('📊 [FlexEarn] Дати:', {
            сьогодні: today,
            останнійСкид: lastResetDate
        });

        if (lastResetDate !== today) {
            console.log('🔄 [FlexEarn] Новий день, скидаємо щоденні дані');
            state.claimedToday = {};
            window.TasksUtils.storage.set('flexEarnLastReset', today);

            // Оновлюємо Store
            window.TasksStore?.actions.resetFlexDaily();

            saveState();
        } else {
            console.log('✅ [FlexEarn] Це той самий день, дані актуальні');
        }
    }

    /**
     * Форматувати число
     */
    function formatNumber(num) {
        return window.TasksUtils?.formatNumber(num) || num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Логування статистики отримання
     */
    function logClaimStatistics() {
        console.log('📊 [FlexEarn] === СТАТИСТИКА ОТРИМАННЯ ВИНАГОРОД ===');

        let totalClaimedToday = 0;
        let totalWinixToday = 0;
        let totalTicketsToday = 0;

        Object.keys(state.claimedToday).forEach(level => {
            if (state.claimedToday[level]) {
                totalClaimedToday++;
                const levelData = FLEX_LEVELS[level];
                totalWinixToday += levelData.rewards.winix;
                totalTicketsToday += levelData.rewards.tickets;
            }
        });

        console.log('📈 [FlexEarn] Сьогодні отримано:', {
            рівнів: totalClaimedToday,
            winix: totalWinixToday,
            tickets: totalTicketsToday
        });
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [FlexEarn] === ЗНИЩЕННЯ МОДУЛЯ ===');

        if (state.autoCheckInterval) {
            clearInterval(state.autoCheckInterval);
            console.log('✅ [FlexEarn] Інтервал автоперевірки очищено');
        }

        // Відписуємось від Store
        if (state.unsubscribeStore) {
            state.unsubscribeStore();
            console.log('✅ [FlexEarn] Відписка від Store виконана');
        }

        saveState();
        console.log('✅ [FlexEarn] Модуль знищено');
    }

    // Публічний API
    return {
        init,
        checkWalletConnection,
        checkFlexBalance,
        claimReward,
        getState: () => state,
        destroy
    };
})();

console.log('✅ [FlexEarn] Модуль FlexEarnManager завантажено (ОПТИМІЗОВАНИЙ)');