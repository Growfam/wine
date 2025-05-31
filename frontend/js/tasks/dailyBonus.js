/**
 * Модуль Daily Bonus для системи завдань WINIX
 * Управління щоденними винагородами з новою системою
 * Виправлено обробку скидання серії
 */

window.DailyBonusManager = (function() {
    'use strict';

    console.log('🎁 [DailyBonus] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ЩОДЕННОГО БОНУСУ =====');

    /*
     * ВАЖЛИВО: Додайте ці CSS стилі для правильної роботи кнопки:
     *
     * .claim-daily-button {
     *     padding: 12px 24px;
     *     border-radius: 8px;
     *     border: none;
     *     font-weight: 600;
     *     cursor: pointer;
     *     transition: all 0.3s ease;
     * }
     *
     * .claim-daily-button.available {
     *     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     *     color: white;
     * }
     *
     * .claim-daily-button.available:hover {
     *     transform: translateY(-2px);
     *     box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
     * }
     *
     * .claim-daily-button.claimed {
     *     background: #e0e0e0;
     *     color: #999;
     *     cursor: not-allowed !important;
     * }
     *
     * .claim-daily-button:disabled {
     *     opacity: 0.6;
     *     cursor: not-allowed !important;
     *     pointer-events: none;
     * }
     *
     * .claim-daily-button.claiming {
     *     background: #f0f0f0;
     *     color: #666;
     * }
     *
     * .claim-daily-button .timer {
     *     display: block;
     *     font-size: 14px;
     *     margin-top: 4px;
     *     font-weight: normal;
     * }
     *
     * .claim-daily-button.pulse-animation {
     *     animation: pulse 2s infinite;
     * }
     *
     * @keyframes pulse {
     *     0% { transform: scale(1); }
     *     50% { transform: scale(1.05); }
     *     100% { transform: scale(1); }
     * }
     *
     * .reset-badge {
     *     display: inline-block;
     *     background: #ff6b6b;
     *     color: white;
     *     padding: 2px 8px;
     *     border-radius: 4px;
     *     font-size: 12px;
     *     margin-left: 8px;
     * }
     *
     * .claim-now-badge {
     *     position: absolute;
     *     top: -8px;
     *     right: -8px;
     *     background: #ff6b6b;
     *     color: white;
     *     padding: 2px 6px;
     *     border-radius: 4px;
     *     font-size: 10px;
     *     font-weight: bold;
     * }
     */

    // Стан модуля
    const state = {
        userId: null,
        isInitialized: false,
        currentDay: 0,
        currentStreak: 0,
        longestStreak: 0,
        canClaim: false,
        nextClaimTime: null,
        todayReward: null,
        calendarRewards: null,
        updateInterval: null,
        claimedDays: [],
        isResetting: false,  // Додано для відстеження скидання серії
        lastSyncTime: null,  // Додано для контролю частоти оновлень
        isProcessingClaim: false  // Додано для запобігання подвійних кліків
    };

    // Конфігурація
    const config = {
        updateIntervalMs: 60000, // 1 хвилина
        maxDays: 30,
        minSyncInterval: 5000,   // Мінімум 5 секунд між синхронізаціями
        maxRetries: 3,           // Максимум спроб при помилках
        debugMode: false         // Режим налагодження
    };

    /**
     * Ініціалізація модуля
     */
    async function init(userId) {
        console.log('🚀 [DailyBonus] Початок ініціалізації');
        console.log('👤 [DailyBonus] User ID:', userId);
        console.log('⚙️ [DailyBonus] Конфігурація:', config);

        state.userId = userId;

        // Встановлюємо початковий стан кнопки (заблокована)
        const button = document.getElementById('claim-daily-button');
        if (button) {
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = '<span class="button-text">Завантаження...</span>';
        }

        try {
            // Завантажуємо стан з бекенду
            await loadDailyBonusState();

            // Оновлюємо UI
            updateDailyBonusUI();

            // Налаштовуємо таймер оновлення
            setupUpdateTimer();

            // Налаштовуємо обробники подій
            setupEventHandlers();

            state.isInitialized = true;
            console.log('✅ [DailyBonus] Модуль успішно ініціалізовано');
            console.log('  📊 Фінальний стан:', {
                canClaim: state.canClaim,
                currentDay: state.currentDay,
                currentStreak: state.currentStreak,
                buttonDisabled: button ? button.disabled : 'button not found'
            });

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка ініціалізації:', error);

            // У випадку помилки - блокуємо кнопку
            if (button) {
                button.disabled = true;
                button.classList.remove('loading');
                button.classList.add('error');
                button.innerHTML = '<span class="button-text">Помилка завантаження</span>';
            }

            window.TasksUtils.showToast('Помилка завантаження щоденного бонусу', 'error');
            throw error;
        }
    }

    /**
     * Завантаження стану з бекенду з автоматичним refresh при необхідності
     */
    async function loadDailyBonusState(forceRefresh = false) {
        console.log('📂 [DailyBonus] Завантаження стану з бекенду...');

        // Перевіряємо чи не занадто часто оновлюємо
        if (!forceRefresh && state.lastSyncTime) {
            const timeSinceLastSync = Date.now() - state.lastSyncTime;
            if (timeSinceLastSync < config.minSyncInterval) {
                console.log('⏳ [DailyBonus] Занадто рано для оновлення, пропускаємо');
                return;
            }
        }

        let retries = 0;
        let lastError = null;

        while (retries < config.maxRetries) {
            try {
                let response = await window.TasksAPI.daily.getStatus(state.userId);
                console.log('✅ [DailyBonus] Отримано стан з бекенду:', response);

                // Перевіряємо валідність даних
                if (response.data) {
                    const data = response.data;

                    // Детектуємо скидання серії
                    const wasReset = state.currentStreak > 0 && data.current_streak === 0 && data.current_day_number === 1;
                    if (wasReset) {
                        console.warn('🔄 [DailyBonus] Виявлено скидання серії!');
                        state.isResetting = true;
                    }

                    // Автоматичний refresh при невалідних даних
                    const needsRefresh = data.can_claim_today && data.next_claim_in_hours > 0;
                    const hasInconsistentData = data.can_claim_today === false && (!data.next_available_date || new Date(data.next_available_date) <= new Date());

                    if (needsRefresh || hasInconsistentData) {
                        console.warn('⚠️ [DailyBonus] Невалідні дані, робимо refresh');

                        try {
                            // Викликаємо refresh
                            await window.TasksAPI.daily.refresh(state.userId);
                            console.log('✅ [DailyBonus] Refresh виконано');

                            // Повторно завантажуємо статус
                            response = await window.TasksAPI.daily.getStatus(state.userId);
                            console.log('✅ [DailyBonus] Статус оновлено після refresh:', response);
                        } catch (refreshError) {
                            console.error('❌ [DailyBonus] Помилка refresh:', refreshError);
                            // Продовжуємо з поточними даними
                        }
                    }
                }

                if (response.status === 'success' && response.data) {
                    const data = response.data;

                    // Оновлюємо локальний стан
                    state.currentDay = data.current_day_number || 0;
                    state.currentStreak = data.current_streak || 0;
                    state.longestStreak = data.longest_streak || 0;
                    state.canClaim = Boolean(data.can_claim_today); // Явне приведення до boolean
                    state.nextClaimTime = data.next_available_date || null;
                    state.todayReward = data.today_reward || null;
                    state.calendarRewards = data.calendar_rewards || [];
                    state.claimedDays = data.claimed_days || [];
                    state.lastSyncTime = Date.now();

                    // Додаткова перевірка консистентності даних
                    if (state.canClaim && state.nextClaimTime) {
                        const now = new Date();
                        const next = new Date(state.nextClaimTime);
                        if (next > now) {
                            console.warn('⚠️ [DailyBonus] Некоректні дані: canClaim=true але nextClaimTime в майбутньому');
                            state.canClaim = false;
                        }
                    }

                    // Якщо було скидання серії, показуємо повідомлення
                    if (state.isResetting) {
                        window.TasksUtils.showToast('Серія скинута на день 1. Можете отримати бонус!', 'info');
                        state.isResetting = false;
                    }

                    // Оновлюємо стан в сторі
                    updateStoreState();

                    console.log('📊 [DailyBonus] Поточний стан:', {
                        Daily: state.currentDay,
                        Seria: state.currentStreak,
                        Claim: state.canClaim,
                        NextTime: state.nextClaimTime,
                        ClaimedDays: state.claimedDays
                    });

                    return; // Успішно завантажено
                } else {
                    throw new Error('Invalid response format');
                }

            } catch (error) {
                lastError = error;
                retries++;
                console.error(`❌ [DailyBonus] Помилка завантаження (спроба ${retries}/${config.maxRetries}):`, error);

                if (retries < config.maxRetries) {
                    // Чекаємо перед повторною спробою
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
            }
        }

        // Якщо всі спроби невдалі
        console.error('❌ [DailyBonus] Не вдалося завантажити стан після всіх спроб:', lastError);

        // Встановлюємо дефолтні значення при помилці
        state.currentDay = 0;
        state.currentStreak = 0;
        state.longestStreak = 0;
        state.canClaim = false;
        state.claimedDays = [];

        window.TasksUtils.showToast('Помилка завантаження щоденного бонусу', 'error');
    }

    /**
     * Оновлення стану в сторі
     */
    function updateStoreState() {
        const store = window.TasksStore;
        if (!store || !store.actions) {
            console.warn('⚠️ [DailyBonus] TasksStore не доступний');
            return;
        }

        // Оновлюємо серію
        if (store.actions.setDailyStreak) {
            store.actions.setDailyStreak(state.currentStreak);
        }

        // Оновлюємо claimed days
        if (store.actions.setClaimedDays) {
            store.actions.setClaimedDays(state.claimedDays);
        } else if (store.actions.addClaimedDay) {
            // Fallback якщо немає setClaimedDays
            state.claimedDays.forEach(day => {
                store.actions.addClaimedDay(day);
            });
        }

        // Додаткова синхронізація
        if (store.actions.updateDailyTotalClaimed) {
            const totalWinix = state.calendarRewards
                .filter((_, index) => state.claimedDays.includes(index + 1))
                .reduce((sum, reward) => sum + (reward.winix || 0), 0);

            const totalTickets = state.calendarRewards
                .filter((_, index) => state.claimedDays.includes(index + 1))
                .reduce((sum, reward) => sum + (reward.tickets || 0), 0);

            store.actions.updateDailyTotalClaimed({
                winix: totalWinix,
                tickets: totalTickets
            });
        }
    }

    /**
     * Оновлення UI щоденного бонусу
     */
    function updateDailyBonusUI() {
        console.log('🔄 [DailyBonus] === ОНОВЛЕННЯ UI ===');

        const store = window.TasksStore;
        const dailyBonus = store ? store.getState().dailyBonus : {};

        // Оновлюємо прогрес бар місяця
        updateMonthProgressUI(dailyBonus);

        // Оновлюємо останні 5 днів
        updateRecentDaysUI(dailyBonus);

        // Оновлюємо календар
        updateCalendarUI(dailyBonus);

        // Оновлюємо статистику
        updateStatsUI(dailyBonus);

        // Оновлюємо кнопку отримання
        updateClaimButtonUI();

        console.log('✅ [DailyBonus] UI оновлено');
    }

    /**
     * Оновлення прогрес бару місяця
     */
    function updateMonthProgressUI(dailyBonus) {
        console.log('📊 [DailyBonus] Оновлення прогрес бару місяця...');

        const progressFill = document.getElementById('month-progress-fill');
        const daysCompleted = document.getElementById('days-completed');
        const currentStreakSpan = document.getElementById('current-streak');
        const longestStreakSpan = document.getElementById('longest-streak');

        if (progressFill) {
            const progress = (state.currentDay / config.maxDays) * 100;
            progressFill.style.width = `${progress}%`;

            // Додаємо анімацію при зміні
            progressFill.style.transition = 'width 0.5s ease-out';
        }

        if (daysCompleted) {
            daysCompleted.textContent = state.currentDay;
        }

        if (currentStreakSpan) {
            currentStreakSpan.textContent = state.currentStreak;

            // Підсвічуємо при скиданні серії
            if (state.currentStreak === 0 && state.currentDay > 0) {
                currentStreakSpan.style.color = '#ff6b6b';
                setTimeout(() => {
                    currentStreakSpan.style.color = '';
                }, 3000);
            }
        }

        if (longestStreakSpan) {
            longestStreakSpan.textContent = state.longestStreak;
        }

        console.log('✅ [DailyBonus] Прогрес бар оновлено');
    }

    /**
     * Оновлення останніх 5 днів
     */
    function updateRecentDaysUI(dailyBonus) {
        console.log('📅 [DailyBonus] Оновлення останніх 5 днів...');

        const recentDaysGrid = document.getElementById('recent-days-grid');
        if (!recentDaysGrid) return;

        recentDaysGrid.innerHTML = '';

        // Визначаємо останні 5 днів
        const currentDay = state.currentDay;
        const nextClaimDay = state.canClaim ? state.currentDay + 1 : state.currentDay;
        const startDay = Math.max(1, nextClaimDay - 2);
        const endDay = Math.min(startDay + 4, config.maxDays);

        for (let day = startDay; day <= endDay; day++) {
            const dayCard = createRecentDayCard(day, dailyBonus, currentDay);
            recentDaysGrid.appendChild(dayCard);
        }

        console.log('✅ [DailyBonus] Останні дні оновлено');
    }

    /**
     * Створення картки останнього дня
     */
    function createRecentDayCard(dayNumber, dailyBonus, currentDay) {
        const card = document.createElement('div');
        card.className = 'recent-day-card';

        // Визначаємо стан дня з урахуванням скидання серії
        const isToday = state.canClaim && dayNumber === state.currentDay + 1;
        const isClaimed = state.claimedDays.includes(dayNumber);
        const isFuture = dayNumber > state.currentDay + 1 && !isClaimed;

        if (isToday) {
            card.classList.add('today');
            // Додаємо пульсуючу анімацію для привернення уваги
            card.style.animation = 'pulse 2s infinite';
        }
        if (isClaimed) card.classList.add('claimed');
        if (isFuture) card.classList.add('future');

        // Отримуємо дані про винагороду з календаря
        const rewardData = state.calendarRewards ?
            state.calendarRewards.find(r => r.day === dayNumber) : null;

        const rewardDisplay = rewardData || { winix: '?', tickets: 0 };

        card.innerHTML = `
            <div class="recent-day-number">${dayNumber}</div>
            <div class="recent-day-label">День</div>
            <div class="recent-day-rewards">
                <div class="recent-day-reward winix">
                    <span class="reward-icon-small winix-icon-small"></span>
                    ${rewardDisplay.winix}
                </div>
                ${rewardDisplay.tickets > 0 ? `
                    <div class="recent-day-reward tickets">
                        <span class="reward-icon-small ticket-icon-small"></span>
                        ${rewardDisplay.tickets}
                    </div>
                ` : ''}
            </div>
            ${isToday ? '<div class="claim-now-badge">Отримати!</div>' : ''}
        `;

        return card;
    }

    /**
     * Оновлення календаря
     */
    function updateCalendarUI(dailyBonus) {
        console.log('📅 [DailyBonus] Оновлення календаря...');

        const calendar = document.getElementById('daily-calendar');
        if (!calendar) {
            console.warn('⚠️ [DailyBonus] Елемент календаря не знайдено');
            return;
        }

        // Очищаємо календар
        calendar.innerHTML = '';

        // Отримуємо список claimed days з state
        const claimedDays = state.claimedDays || [];

        // Створюємо дні
        for (let day = 1; day <= config.maxDays; day++) {
            const dayCell = createDayCell(day, dailyBonus, claimedDays);
            calendar.appendChild(dayCell);
        }

        console.log('✅ [DailyBonus] Календар оновлено з claimed days:', claimedDays);
    }

    /**
     * Створення комірки дня
     */
    function createDayCell(dayNumber, dailyBonus, claimedDays) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.setAttribute('data-day', dayNumber);

        // Визначаємо стан дня
        const isClaimed = claimedDays.includes(dayNumber);
        const isToday = state.canClaim && dayNumber === state.currentDay + 1;
        const isFuture = dayNumber > state.currentDay + 1 && !isClaimed;
        const isPast = dayNumber < state.currentDay + 1 && !isClaimed && !state.canClaim;

        // Встановлюємо класи
        if (isClaimed) cell.classList.add('claimed');
        if (isToday) {
            cell.classList.add('today');
            cell.classList.add('available');
        }
        if (isFuture) cell.classList.add('future');
        if (isPast) cell.classList.add('missed'); // Пропущені дні

        // Отримуємо дані про винагороду з календаря
        const rewardData = state.calendarRewards ?
            state.calendarRewards.find(r => r.day === dayNumber) : null;

        const hasTickets = rewardData && rewardData.tickets > 0;

        // Спеціальні дні з білетами
        if (hasTickets) {
            cell.classList.add('special');
        }

        // Відображення винагороди
        const rewardDisplay = rewardData || { winix: '?', tickets: 0 };

        // Вміст комірки
        cell.innerHTML = `
            <div class="calendar-day-number">${dayNumber}</div>
            <div class="calendar-day-reward">${rewardDisplay.winix}</div>
            ${hasTickets ? `<div class="calendar-ticket-badge">${rewardDisplay.tickets}</div>` : ''}
            ${isToday ? '<div class="pulse-indicator"></div>' : ''}
        `;

        return cell;
    }

    /**
     * Оновлення статистики
     */
    function updateStatsUI(dailyBonus) {
        console.log('📊 [DailyBonus] Оновлення статистики...');

        // Додатково можемо показати загальну статистику
        const totalClaimed = dailyBonus.totalClaimed || { winix: 0, tickets: 0 };
        console.log('📊 [DailyBonus] Загальна статистика:', totalClaimed);

        // Показуємо попередження при скиданні серії
        const streakResetWarning = document.getElementById('streak-reset-warning');
        if (streakResetWarning) {
            if (state.currentStreak === 0 && state.currentDay > 0) {
                streakResetWarning.style.display = 'block';
                streakResetWarning.textContent = 'Серія скинута! Не пропускайте дні щоб зберегти серію.';
            } else {
                streakResetWarning.style.display = 'none';
            }
        }

        console.log('✅ [DailyBonus] Статистика оновлена');
    }

    /**
     * Оновлення кнопки отримання
     */
    function updateClaimButtonUI() {
        console.log('🔘 [DailyBonus] Оновлення кнопки отримання...');
        console.log('  📊 Стан кнопки:', {
            canClaim: state.canClaim,
            nextClaimTime: state.nextClaimTime,
            currentDay: state.currentDay,
            currentStreak: state.currentStreak
        });

        const button = document.getElementById('claim-daily-button');
        if (!button) {
            console.warn('⚠️ [DailyBonus] Кнопка не знайдена!');
            return;
        }

        // Очищаємо всі класи і стилі
        button.className = 'claim-daily-button';
        button.style.cursor = '';

        // ГОЛОВНА ЛОГІКА: Перевіряємо чи можна отримати бонус
        if (state.canClaim === true) {
            // МОЖНА ОТРИМАТИ - розблоковуємо кнопку
            button.disabled = false;
            button.classList.add('available');
            button.style.cursor = 'pointer';

            // Додаємо анімацію для привернення уваги
            if (state.currentStreak === 0 && state.currentDay > 0) {
                button.classList.add('pulse-animation');
            }

            // Якщо маємо дані про сьогоднішню винагороду
            if (state.todayReward) {
                let btnText = `Отримати ${state.todayReward.winix} WINIX`;
                if (state.todayReward.tickets > 0) {
                    btnText += ` + ${state.todayReward.tickets} tickets`;
                }
                button.innerHTML = `
                    <span class="button-text">${btnText}</span>
                    ${state.currentStreak === 0 ? '<span class="reset-badge">Серія скинута!</span>' : ''}
                `;
            } else {
                button.innerHTML = '<span class="button-text">Отримати щоденний бонус</span>';
            }

            console.log('✅ [DailyBonus] Кнопка РОЗБЛОКОВАНА - можна отримати бонус');
        } else {
            // НЕ МОЖНА ОТРИМАТИ - блокуємо кнопку
            button.disabled = true;
            button.classList.add('claimed');
            button.style.cursor = 'not-allowed';

            // Показуємо час до наступного бонусу
            if (state.nextClaimTime) {
                const now = new Date();
                const nextTime = new Date(state.nextClaimTime);

                if (nextTime > now) {
                    const timeUntilNext = getTimeUntilNext(state.nextClaimTime);
                    button.innerHTML = `
                        <span class="button-text">Отримано сьогодні</span>
                        <span class="timer">${timeUntilNext}</span>
                    `;
                } else {
                    // Час вже минув, але сервер ще не оновив стан
                    button.innerHTML = `
                        <span class="button-text">Оновлення статусу...</span>
                    `;
                    // Запускаємо оновлення стану
                    setTimeout(() => loadDailyBonusState(true), 1000);
                }
            } else {
                button.innerHTML = '<span class="button-text">Отримано сьогодні</span>';
            }

            console.log('✅ [DailyBonus] Кнопка ЗАБЛОКОВАНА - потрібно чекати');
        }

        // Додаємо додатковий обробник для запобігання кліків при disabled
        button.onclick = function(e) {
            if (button.disabled || !state.canClaim) {
                e.preventDefault();
                e.stopPropagation();
                console.warn('⚠️ [DailyBonus] Клік заблоковано - бонус недоступний');

                // Показуємо повідомлення
                if (state.nextClaimTime) {
                    const timeUntilNext = getTimeUntilNext(state.nextClaimTime);
                    window.TasksUtils.showToast(`Наступний бонус через ${timeUntilNext}`, 'warning');
                } else {
                    window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'warning');
                }
                return false;
            }
        };

        console.log('✅ [DailyBonus] Кнопка оновлена. Стан:', button.disabled ? 'ЗАБЛОКОВАНА' : 'АКТИВНА');
    }

    /**
     * Отримати час до наступного бонусу
     */
    function getTimeUntilNext(nextClaimTime) {
        const now = Date.now();
        const next = new Date(nextClaimTime).getTime();
        const diff = next - now;

        if (diff <= 0) return '00:00:00';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Отримати щоденний бонус
     */
    async function claimDailyBonus() {
        console.log('🎁 [DailyBonus] === ОТРИМАННЯ ЩОДЕННОГО БОНУСУ ===');

        // Перевіряємо чи вже обробляється запит
        if (state.isProcessingClaim) {
            console.warn('⚠️ [DailyBonus] Вже обробляється попередній запит');
            return;
        }

        // ДОДАТКОВА ПЕРЕВІРКА: чи дійсно можна отримати бонус
        if (!state.canClaim) {
            console.warn('⚠️ [DailyBonus] Спроба отримати бонус коли canClaim = false');
            window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'warning');

            // Оновлюємо стан з сервера на всяк випадок
            await loadDailyBonusState(true);
            updateDailyBonusUI();
            return;
        }

        // Встановлюємо флаг обробки
        state.isProcessingClaim = true;

        const store = window.TasksStore;

        // Блокуємо кнопку одразу
        const button = document.getElementById('claim-daily-button');
        if (button) {
            button.disabled = true;
            button.classList.remove('available');
            button.classList.add('claiming');
            button.innerHTML = '<span class="button-text">Отримання...</span>';
            button.style.cursor = 'wait';
        }

        // Встановлюємо стан отримання
        if (store) {
            store.actions.setDailyClaiming(true);
        }

        try {
            // Відправляємо запит на бекенд
            const response = await window.TasksAPI.daily.claim(state.userId);

            console.log('✅ [DailyBonus] Відповідь від бекенду:', response);

            if (response.status === 'success' && response.data) {
                const data = response.data;

                // Оновлюємо локальний стан
                state.canClaim = false;
                state.currentDay = data.day_number;
                state.currentStreak = data.new_streak;
                state.nextClaimTime = data.next_available;

                // Додаємо день до claimed days
                if (!state.claimedDays.includes(data.day_number)) {
                    state.claimedDays.push(data.day_number);
                }

                // Оновлюємо стан в сторі
                if (store) {
                    store.actions.claimDailyBonus(data.reward);

                    if (data.reward.tickets > 0) {
                        store.actions.addTicketDay(new Date().toISOString());
                    }

                    // Додаємо claimed day
                    store.actions.addClaimedDay(data.day_number);

                    // Оновлюємо баланси
                    const currentBalance = store.selectors.getUserBalance();
                    store.actions.updateBalance({
                        winix: currentBalance.winix + data.reward.winix,
                        tickets: currentBalance.tickets + (data.reward.tickets || 0)
                    });
                }

                // Показуємо анімацію
                showClaimAnimation(data.reward);

                // Оновлюємо UI через невелику затримку
                setTimeout(() => {
                    updateDailyBonusUI();
                }, 1500);

                console.log('✅ [DailyBonus] Бонус успішно отримано!');
            } else {
                throw new Error(response.message || 'Помилка отримання бонусу');
            }

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка отримання бонусу:', error);

            // Перевіряємо типи помилок
            if (error.message) {
                if (error.message.includes('вже отримано') ||
                    error.message.includes('Бонус вже отримано') ||
                    error.message.includes('ще недоступний')) {
                    // Оновлюємо стан з сервера
                    state.canClaim = false;
                    await loadDailyBonusState(true);
                    updateDailyBonusUI();
                    window.TasksUtils.showToast('Бонус вже отримано або ще недоступний', 'warning');
                } else if (error.message.includes('Занадто рано')) {
                    // Показуємо скільки часу залишилось
                    window.TasksUtils.showToast(error.message, 'warning');
                    state.canClaim = false;
                    updateDailyBonusUI();
                } else {
                    window.TasksUtils.showToast(error.message || 'Помилка отримання бонусу', 'error');
                }
            } else {
                window.TasksUtils.showToast('Помилка отримання бонусу', 'error');
            }

        } finally {
            // Знімаємо флаг обробки
            state.isProcessingClaim = false;

            if (store) {
                store.actions.setDailyClaiming(false);
            }

            // Повертаємо кнопку в нормальний стан
            if (button) {
                button.classList.remove('claiming');
            }
            updateClaimButtonUI();
        }
    }

    /**
     * Показати анімацію отримання
     */
    function showClaimAnimation(reward) {
        console.log('🎊 [DailyBonus] Показуємо анімацію отримання');

        // Створюємо елемент анімації
        const animDiv = document.createElement('div');
        animDiv.className = 'daily-bonus-claimed';

        let content = `
            <div class="reward-amount">
                <span class="winix-icon"></span>
                +${reward.winix} WINIX
            </div>
        `;

        if (reward.tickets > 0) {
            content += `
                <div class="reward-tickets">
                    <span class="ticket-icon"></span>
                    +${reward.tickets} TICKETS
                </div>
            `;
        }

        // Додаємо інформацію про серію
        if (state.currentStreak > 1) {
            content += `
                <div class="streak-info">
                    Серія: ${state.currentStreak} днів!
                </div>
            `;
        }

        animDiv.innerHTML = content;
        document.body.appendChild(animDiv);

        // Запускаємо анімацію
        setTimeout(() => {
            animDiv.classList.add('show');
        }, 10);

        // Видаляємо після анімації
        setTimeout(() => {
            animDiv.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(animDiv);
            }, 500);
        }, 2500);

        // Toast повідомлення
        let message = `Отримано ${reward.winix} WINIX`;
        if (reward.tickets > 0) {
            message += ` та ${reward.tickets} tickets!`;
        }
        window.TasksUtils.showToast(message, 'success');
    }

    /**
     * Налаштування таймера оновлення
     */
    function setupUpdateTimer() {
        console.log('⏰ [DailyBonus] Налаштування таймера оновлення');

        // Очищаємо попередній таймер
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        // Оновлюємо кожну хвилину
        state.updateInterval = setInterval(() => {
            console.log('🔄 [DailyBonus] Періодичне оновлення');

            // Оновлюємо таймер на кнопці
            updateClaimButtonUI();

            // Перевіряємо чи настав новий день
            checkForNewDay();

        }, config.updateIntervalMs);

        // Також оновлюємо кожну секунду для точного таймера
        setInterval(() => {
            if (!state.canClaim && state.nextClaimTime) {
                updateClaimButtonUI();
            }
        }, 1000);

        console.log('✅ [DailyBonus] Таймер налаштовано');
    }

    /**
     * Перевірка нового дня
     */
    async function checkForNewDay() {
        console.log('🔍 [DailyBonus] Перевірка нового дня...');
        console.log('  📊 Поточний стан:', {
            canClaim: state.canClaim,
            nextClaimTime: state.nextClaimTime,
            now: new Date().toISOString()
        });

        if (!state.canClaim && state.nextClaimTime) {
            const now = Date.now();
            const next = new Date(state.nextClaimTime).getTime();

            if (now >= next) {
                console.log('🆕 [DailyBonus] Новий день! Оновлюємо стан');
                await loadDailyBonusState(true);
                updateDailyBonusUI();

                // Показуємо повідомлення тільки якщо дійсно можна отримати
                if (state.canClaim) {
                    window.TasksUtils.showToast('Новий щоденний бонус доступний!', 'info');
                }
            }
        }

        // Додаткова перевірка на десинхронізацію UI
        const button = document.getElementById('claim-daily-button');
        if (button) {
            const shouldBeDisabled = !state.canClaim;
            const isDisabled = button.disabled;

            if (isDisabled !== shouldBeDisabled) {
                console.warn('⚠️ [DailyBonus] UI десинхронізація виявлена!');
                console.log('  📊 Кнопка disabled:', isDisabled);
                console.log('  📊 Повинна бути disabled:', shouldBeDisabled);
                console.log('  📊 state.canClaim:', state.canClaim);
                updateClaimButtonUI();
            }
        }
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        console.log('🎯 [DailyBonus] Налаштування обробників подій');

        // Кнопка отримання
        const claimButton = document.getElementById('claim-daily-button');
        if (claimButton) {
            // Видаляємо старі обробники
            claimButton.removeEventListener('click', claimDailyBonus);

            // Додаємо новий обробник з перевіркою
            claimButton.addEventListener('click', function(e) {
                e.preventDefault();

                // Перевіряємо чи вже обробляється
                if (state.isProcessingClaim) {
                    console.warn('⚠️ [DailyBonus] Клік ігнорується - вже обробляється');
                    return false;
                }

                // Перевіряємо чи можна клікати
                if (claimButton.disabled || !state.canClaim) {
                    console.warn('⚠️ [DailyBonus] Клік на заблоковану кнопку');

                    if (state.nextClaimTime) {
                        const timeUntilNext = getTimeUntilNext(state.nextClaimTime);
                        window.TasksUtils.showToast(`Наступний бонус через ${timeUntilNext}`, 'warning');
                    } else {
                        window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'warning');
                    }
                    return false;
                }

                // Викликаємо функцію отримання бонусу
                claimDailyBonus();
            });

            console.log('✅ [DailyBonus] Обробник кнопки отримання додано');
        }

        // Клік на день в календарі
        const calendar = document.getElementById('daily-calendar');
        if (calendar) {
            calendar.addEventListener('click', async (e) => {
                const dayCell = e.target.closest('.calendar-day');
                if (dayCell) {
                    const day = parseInt(dayCell.getAttribute('data-day'));
                    console.log(`📅 [DailyBonus] Клік на день ${day}`);
                    await showDayDetails(day);
                }
            });
            console.log('✅ [DailyBonus] Обробник календаря додано');
        }

        // Кнопка примусового оновлення (якщо є)
        const refreshButton = document.getElementById('daily-refresh-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                console.log('🔄 [DailyBonus] Примусове оновлення...');
                refreshButton.disabled = true;
                refreshButton.textContent = 'Оновлення...';

                try {
                    await loadDailyBonusState(true);
                    updateDailyBonusUI();
                    window.TasksUtils.showToast('Статус оновлено', 'success');
                } catch (error) {
                    window.TasksUtils.showToast('Помилка оновлення', 'error');
                } finally {
                    refreshButton.disabled = false;
                    refreshButton.textContent = 'Оновити';
                }
            });
            console.log('✅ [DailyBonus] Обробник кнопки оновлення додано');
        }

        // Обробник зміни видимості сторінки
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && state.isInitialized) {
                console.log('👁️ [DailyBonus] Сторінка знову активна, перевіряємо стан');
                checkForNewDay();
            }
        });

        // Обробник фокусу вікна
        window.addEventListener('focus', function() {
            if (state.isInitialized) {
                console.log('🎯 [DailyBonus] Вікно в фокусі, перевіряємо стан');
                checkForNewDay();
            }
        });
    }

    /**
     * Показати деталі дня
     */
    async function showDayDetails(day) {
        console.log(`📋 [DailyBonus] Показуємо деталі дня ${day}`);

        try {
            // Знаходимо дані дня в календарі
            const dayData = state.calendarRewards ?
                state.calendarRewards.find(r => r.day === day) : null;

            if (dayData) {
                let message = `День ${day}: ${dayData.winix} WINIX`;
                if (dayData.tickets > 0) {
                    message += ` + ${dayData.tickets} tickets`;
                }

                // Додаємо інформацію про статус
                const isClaimed = state.claimedDays.includes(day);
                const isToday = state.canClaim && day === state.currentDay + 1;

                if (isClaimed) {
                    message += ' ✓ Отримано';
                } else if (isToday) {
                    message += ' 🎁 Доступно зараз!';
                } else if (day < state.currentDay + 1 && !state.canClaim) {
                    message += ' ❌ Пропущено';
                }

                window.TasksUtils.showToast(message, 'info');
            } else {
                // Запитуємо розрахунок винагороди з сервера
                const response = await window.TasksAPI.daily.calculateReward(state.userId, day);

                if (response.status === 'success' && response.data) {
                    const reward = response.data.reward;
                    const message = `День ${day}: ${reward.winix} WINIX` +
                                   (reward.tickets > 0 ? ` + ${reward.tickets} tickets` : '');

                    window.TasksUtils.showToast(message, 'info');
                }
            }
        } catch (error) {
            console.error('❌ [DailyBonus] Помилка отримання деталей дня:', error);
        }
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        const store = window.TasksStore;
        const dailyBonus = store ? store.getState().dailyBonus : {};

        return {
            currentStreak: state.currentStreak,
            longestStreak: state.longestStreak,
            currentDay: state.currentDay,
            totalWinix: dailyBonus.totalClaimed?.winix || 0,
            totalTickets: dailyBonus.totalClaimed?.tickets || 0,
            completionRate: (state.currentDay / config.maxDays * 100).toFixed(1) + '%',
            daysUntilReset: config.maxDays - state.currentDay,
            isStreakActive: state.currentStreak > 0
        };
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [DailyBonus] === ЗНИЩЕННЯ МОДУЛЯ ===');

        // Очищаємо таймер
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        // Очищаємо стан
        Object.keys(state).forEach(key => {
            if (typeof state[key] !== 'function') {
                state[key] = null;
            }
        });

        console.log('✅ [DailyBonus] Модуль знищено');
    }

    console.log('✅ [DailyBonus] Модуль щоденного бонусу готовий');

    // Публічний API
    return {
        init,
        claimDailyBonus,
        updateDailyBonusUI,
        getStatistics,
        loadDailyBonusState,
        destroy,

        // Додаткові методи для діагностики
        getState: function() {
            return {
                canClaim: state.canClaim,
                currentDay: state.currentDay,
                currentStreak: state.currentStreak,
                nextClaimTime: state.nextClaimTime,
                isInitialized: state.isInitialized
            };
        },

        forceUpdateButton: function() {
            console.log('🔧 [DailyBonus] Примусове оновлення кнопки');
            updateClaimButtonUI();
        }
    };

})();

console.log('✅ [DailyBonus] Модуль експортовано глобально');