/**
 * Модуль Daily Bonus для системи завдань WINIX
 * Управління щоденними винагородами (логіка на сервері)
 */

window.DailyBonusManager = (function() {
    'use strict';

    console.log('🎁 [DailyBonus] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ЩОДЕННОГО БОНУСУ =====');

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
        updateInterval: null
    };

    // Конфігурація
    const config = {
        updateIntervalMs: 60000, // 1 хвилина
        maxDays: 30
    };

    /**
     * Ініціалізація модуля
     */
    async function init(userId) {
        console.log('🚀 [DailyBonus] Початок ініціалізації');
        console.log('👤 [DailyBonus] User ID:', userId);
        console.log('⚙️ [DailyBonus] Конфігурація:', config);

        state.userId = userId;

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

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Завантаження стану з бекенду
     */
    async function loadDailyBonusState() {
        console.log('📂 [DailyBonus] Завантаження стану з бекенду...');

        try {
            const response = await window.TasksAPI.daily.getStatus(state.userId);

            console.log('✅ [DailyBonus] Отримано стан з бекенду:', response);

            // Оновлюємо локальний стан
            state.currentDay = response.currentDay || 0;
            state.currentStreak = response.currentStreak || 0;
            state.longestStreak = response.longestStreak || 0;
            state.canClaim = response.canClaim || false;
            state.nextClaimTime = response.nextClaimTime || null;
            state.todayReward = response.todayReward || null;

            // Оновлюємо стан в сторі
            const store = window.TasksStore;
            if (store) {
                store.actions.setDailyStreak(state.currentStreak);

                // Оновлюємо дані з відповіді сервера
                if (response.claimedDays) {
                    response.claimedDays.forEach(day => {
                        if (!store.getState().dailyBonus.claimedDays.includes(day)) {
                            store.actions.addClaimedDay(day);
                        }
                    });
                }

                if (response.totalClaimed) {
                    store.actions.updateDailyTotalClaimed(response.totalClaimed);
                }
            }

            console.log('📊 [DailyBonus] Поточний стан:', {
                Daily: state.currentDay,
                Seria: state.currentStreak,
                Claim: state.canClaim,
                NextTime: state.nextClaimTime
            });

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка завантаження стану:', error);
            window.TasksUtils.showToast('Помилка завантаження щоденного бонусу', 'error');
        }
    }

    /**
     * Оновлення UI щоденного бонусу
     */
    function updateDailyBonusUI() {
        console.log('🔄 [DailyBonus] === ОНОВЛЕННЯ UI ===');

        const store = window.TasksStore;
        const dailyBonus = store.getState().dailyBonus;

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
        }

        if (daysCompleted) {
            daysCompleted.textContent = state.currentDay;
        }

        if (currentStreakSpan) {
            currentStreakSpan.textContent = state.currentStreak;
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
        const currentDay = state.currentDay + 1; // Наступний день для отримання
        const startDay = Math.max(1, currentDay - 4);
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

        const isToday = dayNumber === currentDay && state.canClaim;
        const isClaimed = dayNumber < currentDay;
        const isFuture = dayNumber > currentDay;

        if (isToday) card.classList.add('today');
        if (isClaimed) card.classList.add('claimed');

        // Отримуємо дані про винагороду з сервера або показуємо приблизні
        const rewardDisplay = getRewardDisplay(dayNumber);

        card.innerHTML = `
            <div class="recent-day-number">${dayNumber}</div>
            <div class="recent-day-label">День</div>
            <div class="recent-day-rewards">
                <div class="recent-day-reward winix">
                    <span class="reward-icon-small winix-icon-small"></span>
                    ${rewardDisplay.winix}
                </div>
                ${rewardDisplay.tickets ? `
                    <div class="recent-day-reward tickets">
                        <span class="reward-icon-small ticket-icon-small"></span>
                        ${rewardDisplay.tickets}
                    </div>
                ` : ''}
            </div>
        `;

        return card;
    }

    /**
     * Отримати відображення винагороди
     */
    function getRewardDisplay(dayNumber) {
        // Якщо це поточний день і ми маємо дані з сервера
        if (dayNumber === state.currentDay + 1 && state.todayReward) {
            return {
                winix: state.todayReward.winix,
                tickets: state.todayReward.tickets || null
            };
        }

        // Інакше показуємо приблизні значення на основі UI конфігурації
        const uiRewards = window.TasksConstants.DAILY_BONUS.UI_REWARDS;

        // Знаходимо найближчу віху
        let display = '20+';
        Object.entries(uiRewards).forEach(([day, config]) => {
            if (dayNumber >= parseInt(day)) {
                display = config.display;
            }
        });

        return {
            winix: display,
            tickets: '?'
        };
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

        // Створюємо дні
        for (let day = 1; day <= config.maxDays; day++) {
            const dayCell = createDayCell(day, dailyBonus);
            calendar.appendChild(dayCell);
        }

        console.log('✅ [DailyBonus] Календар оновлено');
    }

    /**
     * Створення комірки дня
     */
    function createDayCell(dayNumber, dailyBonus) {
        console.log(`📅 [DailyBonus] Створення дня ${dayNumber}`);

        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.setAttribute('data-day', dayNumber);

        // Визначаємо стан дня
        const currentDay = state.currentDay + 1;
        const isClaimed = dayNumber < currentDay;
        const isToday = dayNumber === currentDay && state.canClaim;
        const isFuture = dayNumber > currentDay;

        // Встановлюємо класи
        if (isClaimed) cell.classList.add('claimed');
        if (isToday) cell.classList.add('today');
        if (isFuture) cell.classList.add('future');

        // Спеціальні дні (кожен 7-й день)
        if (dayNumber % 7 === 0) {
            cell.classList.add('special');
        }

        // Відображення винагороди
        const rewardDisplay = getRewardDisplay(dayNumber);

        // Вміст комірки
        cell.innerHTML = `
            <div class="calendar-day-number">${dayNumber}</div>
            <div class="calendar-day-reward">${rewardDisplay.winix}</div>
            ${rewardDisplay.tickets ? '<div class="calendar-ticket-badge"></div>' : ''}
        `;

        return cell;
    }

    /**
     * Оновлення статистики
     */
    function updateStatsUI(dailyBonus) {
        console.log('📊 [DailyBonus] Оновлення статистики...');

        // Елементи статистики оновлюються через updateMonthProgressUI
        console.log('✅ [DailyBonus] Статистика оновлена');
    }

    /**
     * Оновлення кнопки отримання
     */
    function updateClaimButtonUI() {
        console.log('🔘 [DailyBonus] Оновлення кнопки отримання...');

        const button = document.getElementById('claim-daily-button');
        if (!button) return;

        if (state.canClaim) {
            button.disabled = false;
            button.className = 'claim-daily-button available';

            // Якщо маємо дані про сьогоднішню винагороду
            if (state.todayReward) {
                button.innerHTML = `
                    <span class="button-text">Отримати ${state.todayReward.winix} WINIX</span>
                    ${state.todayReward.tickets > 0 ? `<span class="bonus-tickets">+${state.todayReward.tickets} tickets</span>` : ''}
                `;
            } else {
                button.innerHTML = '<span class="button-text">Отримати щоденний бонус</span>';
            }
        } else {
            button.disabled = true;
            button.className = 'claim-daily-button claimed';

            // Показуємо час до наступного бонусу
            if (state.nextClaimTime) {
                const timeUntilNext = getTimeUntilNext(state.nextClaimTime);
                button.innerHTML = `
                    <span class="button-text">Отримано сьогодні</span>
                    <span class="timer">${timeUntilNext}</span>
                `;
            } else {
                button.innerHTML = '<span class="button-text">Отримано сьогодні</span>';
            }
        }

        console.log('✅ [DailyBonus] Кнопка оновлена');
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

        const store = window.TasksStore;

        // Перевіряємо чи можна отримати
        if (!state.canClaim) {
            console.warn('⚠️ [DailyBonus] Бонус вже отримано сьогодні');
            window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'warning');
            return;
        }

        // Встановлюємо стан отримання
        store.actions.setDailyClaiming(true);

        try {
            // Відправляємо запит на бекенд
            const response = await window.TasksAPI.daily.claim(state.userId);

            console.log('✅ [DailyBonus] Відповідь від бекенду:', response);

            if (response.success) {
                // Оновлюємо локальний стан
                state.canClaim = false;
                state.currentDay = response.currentDay;
                state.currentStreak = response.currentStreak;
                state.nextClaimTime = response.nextClaimTime;

                // Оновлюємо стан в сторі
                store.actions.claimDailyBonus(response.reward);

                if (response.reward.tickets > 0) {
                    store.actions.addTicketDay(new Date().toISOString());
                }

                // Оновлюємо баланси
                const currentBalance = store.selectors.getUserBalance();
                store.actions.updateBalance({
                    winix: currentBalance.winix + response.reward.winix,
                    tickets: currentBalance.tickets + (response.reward.tickets || 0)
                });

                // Показуємо анімацію
                showClaimAnimation(response.reward);

                // Оновлюємо UI
                updateDailyBonusUI();

                console.log('✅ [DailyBonus] Бонус успішно отримано!');
            } else {
                throw new Error(response.message || 'Помилка отримання бонусу');
            }

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка отримання бонусу:', error);
            window.TasksUtils.showToast(error.message || 'Помилка отримання бонусу', 'error');

        } finally {
            store.actions.setDailyClaiming(false);
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
                <span class="winix-icon-small"></span>
                +${reward.winix} WINIX
            </div>
        `;

        if (reward.tickets > 0) {
            content += `
                <div class="reward-tickets">
                    <span class="ticket-icon-small"></span>
                    +${reward.tickets} TICKETS
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
        if (!state.canClaim && state.nextClaimTime) {
            const now = Date.now();
            const next = new Date(state.nextClaimTime).getTime();

            if (now >= next) {
                console.log('🆕 [DailyBonus] Новий день! Оновлюємо стан');
                await loadDailyBonusState();
                updateDailyBonusUI();
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
            claimButton.addEventListener('click', claimDailyBonus);
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
    }

    /**
     * Показати деталі дня
     */
    async function showDayDetails(day) {
        console.log(`📋 [DailyBonus] Показуємо деталі дня ${day}`);

        try {
            // Запитуємо розрахунок винагороди з сервера
            const response = await window.TasksAPI.daily.calculateReward(state.userId, day);

            const message = `День ${day}: ${response.winix} WINIX` +
                           (response.tickets > 0 ? ` + ${response.tickets} tickets` : '');

            window.TasksUtils.showToast(message, 'info');
        } catch (error) {
            console.error('❌ [DailyBonus] Помилка отримання деталей дня:', error);
        }
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        const store = window.TasksStore;
        const dailyBonus = store.getState().dailyBonus;

        return {
            currentStreak: state.currentStreak,
            longestStreak: state.longestStreak,
            currentDay: state.currentDay,
            totalWinix: dailyBonus.totalClaimed.winix,
            totalTickets: dailyBonus.totalClaimed.tickets,
            completionRate: (state.currentDay / config.maxDays * 100).toFixed(1) + '%'
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

        console.log('✅ [DailyBonus] Модуль знищено');
    }

    console.log('✅ [DailyBonus] Модуль щоденного бонусу готовий');

    // Публічний API
    return {
        init,
        claimDailyBonus,
        updateDailyBonusUI,
        getStatistics,
        destroy
    };

})();

console.log('✅ [DailyBonus] Модуль експортовано глобально');