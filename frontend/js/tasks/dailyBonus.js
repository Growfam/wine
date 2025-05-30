/**
 * Модуль Daily Bonus для системи завдань WINIX
 * Управління щоденними винагородами з новою системою
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
        calendarRewards: null,
        updateInterval: null,
        claimedDays: []
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

            if (response.status === 'success' && response.data) {
                const data = response.data;

                // Оновлюємо локальний стан
                state.currentDay = data.current_day_number || 0;
                state.currentStreak = data.current_streak || 0;
                state.longestStreak = data.longest_streak || 0;
                state.canClaim = data.can_claim_today || false;
                state.nextClaimTime = data.next_available_date || null;
                state.todayReward = data.today_reward || null;
                state.calendarRewards = data.calendar_rewards || [];
                state.claimedDays = data.claimed_days || [];

                // Оновлюємо стан в сторі
                const store = window.TasksStore;
                if (store) {
                    store.actions.setDailyStreak(state.currentStreak);

                    // Оновлюємо claimed days
                    if (state.claimedDays.length > 0) {
                        state.claimedDays.forEach(day => {
                            if (!store.getState().dailyBonus.claimedDays.includes(day)) {
                                store.actions.addClaimedDay(day);
                            }
                        });
                    }

                    // Оновлюємо статистику
                    if (data.statistics) {
                        store.actions.updateDailyTotalClaimed({
                            winix: data.statistics.total_winix_earned || 0,
                            tickets: data.statistics.total_tickets_earned || 0
                        });
                    }
                }

                console.log('📊 [DailyBonus] Поточний стан:', {
                    Daily: state.currentDay,
                    Seria: state.currentStreak,
                    Claim: state.canClaim,
                    NextTime: state.nextClaimTime
                });
            } else {
                throw new Error('Invalid response format');
            }

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
        const currentDay = state.currentDay;
        const startDay = Math.max(1, currentDay - 3);
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

        const isToday = dayNumber === currentDay + 1 && state.canClaim;
        const isClaimed = dayNumber <= currentDay;
        const isFuture = dayNumber > currentDay + 1;

        if (isToday) card.classList.add('today');
        if (isClaimed) card.classList.add('claimed');

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
        `;

        return card;
    }

    /**
     * Оновлення календаря
     */
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
    const currentDay = state.currentDay;
    const isClaimed = claimedDays.includes(dayNumber); // Використовуємо claimed_days з бекенду
    const isToday = dayNumber === currentDay + 1 && state.canClaim;
    const isFuture = dayNumber > currentDay + 1 && !isClaimed;

    // Встановлюємо класи
    if (isClaimed) cell.classList.add('claimed');
    if (isToday) cell.classList.add('today');
    if (isFuture) cell.classList.add('future');

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
    `;

    return cell;
}

    /**
     * Оновлення статистики
     */
    function updateStatsUI(dailyBonus) {
        console.log('📊 [DailyBonus] Оновлення статистики...');

        // Статистика оновлюється через updateMonthProgressUI

        // Додатково можемо показати загальну статистику
        const totalClaimed = dailyBonus.totalClaimed || { winix: 0, tickets: 0 };
        console.log('📊 [DailyBonus] Загальна статистика:', totalClaimed);

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
                let btnText = `Отримати ${state.todayReward.winix} WINIX`;
                if (state.todayReward.tickets > 0) {
                    btnText += ` + ${state.todayReward.tickets} tickets`;
                }
                button.innerHTML = `<span class="button-text">${btnText}</span>`;
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

                // Оновлюємо стан в сторі
                if (store) {
                    store.actions.claimDailyBonus(data.reward);

                    if (data.reward.tickets > 0) {
                        store.actions.addTicketDay(new Date().toISOString());
                    }

                    // Оновлюємо баланси
                    const currentBalance = store.selectors.getUserBalance();
                    store.actions.updateBalance({
                        winix: currentBalance.winix + data.reward.winix,
                        tickets: currentBalance.tickets + (data.reward.tickets || 0)
                    });
                }

                // Показуємо анімацію
                showClaimAnimation(data.reward);

                // Оновлюємо UI
                setTimeout(() => {
                    loadDailyBonusState().then(() => {
                        updateDailyBonusUI();
                    });
                }, 1500);

                console.log('✅ [DailyBonus] Бонус успішно отримано!');
            } else {
                throw new Error(response.message || 'Помилка отримання бонусу');
            }

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка отримання бонусу:', error);
            window.TasksUtils.showToast(error.message || 'Помилка отримання бонусу', 'error');

        } finally {
            if (store) {
                store.actions.setDailyClaiming(false);
            }
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
            // Знаходимо дані дня в календарі
            const dayData = state.calendarRewards ?
                state.calendarRewards.find(r => r.day === day) : null;

            if (dayData) {
                let message = `День ${day}: ${dayData.winix} WINIX`;
                if (dayData.tickets > 0) {
                    message += ` + ${dayData.tickets} tickets`;
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