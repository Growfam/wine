/**
 * Модуль Daily Bonus для системи завдань WINIX
 * Управління щоденними винагородами
 */

window.DailyBonusManager = (function() {
    'use strict';

    console.log('🎁 [DailyBonus] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ЩОДЕННОГО БОНУСУ =====');

    // Стан модуля
    const state = {
        userId: null,
        isInitialized: false,
        currentDay: 0,
        ticketDaysThisWeek: [],
        nextTicketDay: null,
        updateInterval: null
    };

    // Конфігурація
    const config = {
        updateIntervalMs: 60000, // 1 хвилина
        ticketsPerWeek: 3,
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
            const response = await window.TasksUtils.apiCall(`/daily/status/${state.userId}`, {
                method: 'GET'
            });

            console.log('✅ [DailyBonus] Отримано стан з бекенду:', response);

            // Оновлюємо стан в сторі
            const store = window.TasksStore;
            if (response.currentStreak !== undefined) {
                store.actions.setDailyStreak(response.currentStreak);
            }

            // Оновлюємо локальний стан
            state.currentDay = response.currentDay || 0;
            state.ticketDaysThisWeek = response.ticketDaysThisWeek || [];

            // Розраховуємо наступний день з квитками
            calculateNextTicketDay();

            console.log('📊 [DailyBonus] Поточний стан:', {
                день: state.currentDay,
                серія: response.currentStreak,
                днівЗКвитками: state.ticketDaysThisWeek
            });

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка завантаження стану:', error);
            // Використовуємо локальні дані якщо бекенд недоступний
            loadLocalState();
        }
    }

    /**
     * Завантаження локального стану
     */
    function loadLocalState() {
        console.log('📂 [DailyBonus] Завантаження локального стану...');

        const store = window.TasksStore;
        const dailyBonus = store.getState().dailyBonus;

        state.currentDay = dailyBonus.claimedDays.length;
        state.ticketDaysThisWeek = dailyBonus.ticketDays.filter(day => {
            const dayDate = new Date(day);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return dayDate > weekAgo;
        });

        console.log('✅ [DailyBonus] Локальний стан завантажено');
    }

    /**
     * Оновлення UI щоденного бонусу
     */
    function updateDailyBonusUI() {
        console.log('🔄 [DailyBonus] === ОНОВЛЕННЯ UI ===');

        const store = window.TasksStore;
        const dailyBonus = store.getState().dailyBonus;

        // Оновлюємо календар
        updateCalendarUI(dailyBonus);

        // Оновлюємо статистику
        updateStatsUI(dailyBonus);

        // Оновлюємо кнопку отримання
        updateClaimButtonUI();

        console.log('✅ [DailyBonus] UI оновлено');
    }

    /**
     * Оновлення календаря
     */
    function updateCalendarUI(dailyBonus) {
        console.log('📅 [DailyBonus] Оновлення календаря...');

        const calendar = document.querySelector('.daily-calendar');
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
        cell.className = 'day-cell';
        cell.setAttribute('data-day', dayNumber);

        // Визначаємо стан дня
        const today = new Date();
        const dayDate = new Date(today);
        dayDate.setDate(dayDate.getDate() - dailyBonus.currentStreak + dayNumber - 1);

        const isClaimed = dailyBonus.claimedDays.some(claimedDate => {
            return new Date(claimedDate).toDateString() === dayDate.toDateString();
        });

        const isToday = dayNumber === dailyBonus.currentStreak + 1;
        const isFuture = dayNumber > dailyBonus.currentStreak + 1;

        // Встановлюємо класи
        if (isClaimed) {
            cell.classList.add('claimed');
        }
        if (isToday) {
            cell.classList.add('today');
        }
        if (isFuture) {
            cell.classList.add('future');
        }

        // Перевіряємо чи є квитки в цей день
        const hasTickets = dailyBonus.ticketDays.some(ticketDate => {
            return new Date(ticketDate).toDateString() === dayDate.toDateString();
        });

        // Вміст комірки
        cell.innerHTML = `
            <div class="day-number">${dayNumber}</div>
            <div class="day-reward">${getDayReward(dayNumber).winix}</div>
            ${hasTickets ? '<div class="ticket-indicator">🎟️</div>' : ''}
        `;

        return cell;
    }

    /**
     * Отримати винагороду для дня
     */
    function getDayReward(dayNumber) {
        return window.BonusCalculator.calculateDailyReward(dayNumber);
    }

    /**
     * Оновлення статистики
     */
    function updateStatsUI(dailyBonus) {
        console.log('📊 [DailyBonus] Оновлення статистики...');

        // Поточна серія
        const streakElement = document.getElementById('current-streak');
        if (streakElement) {
            streakElement.textContent = dailyBonus.currentStreak;
        }

        // Найдовша серія
        const longestStreakElement = document.getElementById('longest-streak');
        if (longestStreakElement) {
            longestStreakElement.textContent = dailyBonus.longestStreak;
        }

        // Зібрано winix
        const totalWinixElement = document.getElementById('total-winix-claimed');
        if (totalWinixElement) {
            totalWinixElement.textContent = window.TasksUtils.formatNumber(dailyBonus.totalClaimed.winix);
        }

        // Зібрано tickets
        const totalTicketsElement = document.getElementById('total-tickets-claimed');
        if (totalTicketsElement) {
            totalTicketsElement.textContent = dailyBonus.totalClaimed.tickets;
        }

        console.log('✅ [DailyBonus] Статистика оновлена');
    }

    /**
     * Оновлення кнопки отримання
     */
    function updateClaimButtonUI() {
        console.log('🔘 [DailyBonus] Оновлення кнопки отримання...');

        const button = document.querySelector('.claim-daily-button');
        if (!button) return;

        const canClaim = window.TasksStore.selectors.canClaimDailyBonus();
        const store = window.TasksStore;
        const dailyBonus = store.getState().dailyBonus;

        if (canClaim) {
            button.disabled = false;
            button.className = 'claim-daily-button available';

            // Розраховуємо винагороду
            const nextDay = dailyBonus.currentStreak + 1;
            const reward = getDayReward(nextDay);

            button.innerHTML = `
                <span class="button-text">Отримати ${reward.winix} WINIX</span>
                ${reward.tickets > 0 ? `<span class="bonus-tickets">+${reward.tickets} 🎟️</span>` : ''}
            `;
        } else {
            button.disabled = true;
            button.className = 'claim-daily-button claimed';

            // Показуємо час до наступного бонусу
            const timeUntilNext = window.TasksUtils.getTimeUntilMidnight();
            button.innerHTML = `
                <span class="button-text">Отримано сьогодні</span>
                <span class="timer">${timeUntilNext.formatted}</span>
            `;
        }

        console.log('✅ [DailyBonus] Кнопка оновлена');
    }

    /**
     * Отримати щоденний бонус
     */
    async function claimDailyBonus() {
        console.log('🎁 [DailyBonus] === ОТРИМАННЯ ЩОДЕННОГО БОНУСУ ===');

        const store = window.TasksStore;

        // Перевіряємо чи можна отримати
        if (!store.selectors.canClaimDailyBonus()) {
            console.warn('⚠️ [DailyBonus] Бонус вже отримано сьогодні');
            window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'warning');
            return;
        }

        // Встановлюємо стан отримання
        store.actions.setDailyClaiming(true);

        try {
            // Розраховуємо винагороду
            const nextDay = store.getState().dailyBonus.currentStreak + 1;
            const reward = window.BonusCalculator.calculateDailyReward(nextDay);

            console.log('💰 [DailyBonus] Розрахована винагорода:', reward);

            // Перевіряємо чи сьогодні день з квитками
            const isTicketDay = checkIfTicketDay();
            if (isTicketDay) {
                const ticketAmount = window.BonusCalculator.calculateTicketAmount(nextDay);
                reward.tickets = ticketAmount;
                console.log('🎟️ [DailyBonus] Сьогодні день з квитками! Кількість:', ticketAmount);
            }

            // Відправляємо запит на бекенд
            const response = await window.TasksUtils.apiCall(`/daily/claim/${state.userId}`, {
                method: 'POST',
                body: {
                    day: nextDay,
                    reward: reward,
                    timestamp: Date.now()
                }
            });

            console.log('✅ [DailyBonus] Відповідь від бекенду:', response);

            // Оновлюємо стан
            store.actions.claimDailyBonus(reward);

            if (reward.tickets > 0) {
                store.actions.addTicketDay(new Date().toISOString());
            }

            // Оновлюємо баланси
            const currentBalance = store.selectors.getUserBalance();
            store.actions.updateBalance({
                winix: currentBalance.winix + reward.winix,
                tickets: currentBalance.tickets + reward.tickets
            });

            // Показуємо анімацію
            showClaimAnimation(reward);

            // Оновлюємо UI
            updateDailyBonusUI();

            console.log('✅ [DailyBonus] Бонус успішно отримано!');

        } catch (error) {
            console.error('❌ [DailyBonus] Помилка отримання бонусу:', error);
            window.TasksUtils.showToast('Помилка отримання бонусу', 'error');

        } finally {
            store.actions.setDailyClaiming(false);
        }
    }

    /**
     * Перевірка чи сьогодні день з квитками
     */
    function checkIfTicketDay() {
        console.log('🎟️ [DailyBonus] Перевірка чи сьогодні день з квитками...');

        // Якщо вже є 3 дні з квитками цього тижня - точно ні
        if (state.ticketDaysThisWeek.length >= config.ticketsPerWeek) {
            console.log('❌ [DailyBonus] Вже видано максимум квитків цього тижня');
            return false;
        }

        // Рандомно визначаємо (30% шанс)
        const isTicketDay = Math.random() < 0.3;
        console.log(`🎲 [DailyBonus] Рандомна перевірка: ${isTicketDay ? 'ТАК' : 'НІ'}`);

        return isTicketDay;
    }

    /**
     * Розрахувати наступний день з квитками
     */
    function calculateNextTicketDay() {
        console.log('📅 [DailyBonus] Розрахунок наступного дня з квитками...');

        // Це приблизний розрахунок для UI
        const remainingTickets = config.ticketsPerWeek - state.ticketDaysThisWeek.length;
        const remainingDaysInWeek = 7 - (new Date().getDay() || 7);

        if (remainingTickets > 0 && remainingDaysInWeek > 0) {
            const probability = remainingTickets / remainingDaysInWeek;
            console.log(`📊 [DailyBonus] Ймовірність квитків: ${(probability * 100).toFixed(1)}%`);

            state.nextTicketDay = probability > 0.5 ? 'Високий шанс сьогодні!' : 'Можливо цього тижня';
        } else {
            state.nextTicketDay = 'Наступного тижня';
        }

        console.log('✅ [DailyBonus] Наступний день з квитками:', state.nextTicketDay);
    }

    /**
     * Показати анімацію отримання
     */
    function showClaimAnimation(reward) {
        console.log('🎊 [DailyBonus] Показуємо анімацію отримання');

        // Створюємо елемент анімації
        const animDiv = document.createElement('div');
        animDiv.className = 'daily-bonus-claimed';

        let content = `<div class="reward-amount">+${reward.winix} WINIX</div>`;
        if (reward.tickets > 0) {
            content += `<div class="reward-tickets">+${reward.tickets} TICKETS 🎟️</div>`;
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

            // Перевіряємо новий день
            if (window.TasksStore.selectors.canClaimDailyBonus()) {
                console.log('🆕 [DailyBonus] Новий день! Оновлюємо UI');
                updateDailyBonusUI();
            }

            // Оновлюємо таймер на кнопці
            updateClaimButtonUI();

        }, config.updateIntervalMs);

        console.log('✅ [DailyBonus] Таймер налаштовано');
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        console.log('🎯 [DailyBonus] Налаштування обробників подій');

        // Кнопка отримання
        const claimButton = document.querySelector('.claim-daily-button');
        if (claimButton) {
            claimButton.addEventListener('click', claimDailyBonus);
            console.log('✅ [DailyBonus] Обробник кнопки отримання додано');
        }

        // Клік на день в календарі
        const calendar = document.querySelector('.daily-calendar');
        if (calendar) {
            calendar.addEventListener('click', (e) => {
                const dayCell = e.target.closest('.day-cell');
                if (dayCell) {
                    const day = parseInt(dayCell.getAttribute('data-day'));
                    console.log(`📅 [DailyBonus] Клік на день ${day}`);
                    showDayDetails(day);
                }
            });
            console.log('✅ [DailyBonus] Обробник календаря додано');
        }
    }

    /**
     * Показати деталі дня
     */
    function showDayDetails(day) {
        console.log(`📋 [DailyBonus] Показуємо деталі дня ${day}`);

        const reward = getDayReward(day);
        const message = `День ${day}: ${reward.winix} WINIX` +
                       (reward.tickets > 0 ? ` + ${reward.tickets} tickets` : '');

        window.TasksUtils.showToast(message, 'info');
    }

    /**
     * Скинути щоденні дані (для нового місяця)
     */
    function resetMonthlyData() {
        console.log('🔄 [DailyBonus] === СКИДАННЯ МІСЯЧНИХ ДАНИХ ===');

        const store = window.TasksStore;
        store.actions.resetDailyBonus();

        // Очищаємо локальний стан
        state.currentDay = 0;
        state.ticketDaysThisWeek = [];

        // Оновлюємо UI
        updateDailyBonusUI();

        console.log('✅ [DailyBonus] Місячні дані скинуто');
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        const store = window.TasksStore;
        const dailyBonus = store.getState().dailyBonus;

        return {
            currentStreak: dailyBonus.currentStreak,
            longestStreak: dailyBonus.longestStreak,
            totalWinix: dailyBonus.totalClaimed.winix,
            totalTickets: dailyBonus.totalClaimed.tickets,
            daysCompleted: dailyBonus.claimedDays.length,
            completionRate: (dailyBonus.claimedDays.length / config.maxDays * 100).toFixed(1) + '%'
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

        // Зберігаємо стан
        const store = window.TasksStore;
        if (store) {
            window.TasksUtils.storage.set('dailyBonusState', store.getState().dailyBonus);
        }

        console.log('✅ [DailyBonus] Модуль знищено');
    }

    console.log('✅ [DailyBonus] Модуль щоденного бонусу готовий');

    // Публічний API
    return {
        init,
        claimDailyBonus,
        updateDailyBonusUI,
        resetMonthlyData,
        getStatistics,
        destroy
    };

})();

console.log('✅ [DailyBonus] Модуль експортовано глобально');