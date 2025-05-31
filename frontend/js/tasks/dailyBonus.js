/**
 * Модуль Daily Bonus для системи завдань WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V3 - Використовує централізовані утиліти
 */

window.DailyBonusManager = (function() {
    'use strict';

    console.log('🎁 [DailyBonus-V3] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // Namespace для кешування
    const CACHE_NAMESPACE = CacheManager.NAMESPACES.DAILY;

    // RequestManager клієнт
    const apiClient = RequestManager.createClient('dailyBonus');

    // EventBus namespace
    const eventBus = EventBus.createNamespace('dailyBonus');

    // Стан модуля (мінімальний)
    const state = {
        userId: null,
        isInitialized: false,
        isProcessingClaim: false,
        unsubscribeCallbacks: []
    };

    // Конфігурація
    const config = {
        maxDays: 30,
        claimDebounceTime: 5000,
        updateIntervalMs: 60000
    };

    /**
     * Ініціалізація модуля
     */
    async function init(userId) {
        console.log('🚀 [DailyBonus-V3] Початок ініціалізації');

        if (state.isInitialized) {
            console.log('✅ [DailyBonus-V3] Вже ініціалізовано');
            return;
        }

        state.userId = userId;

        try {
            // Завантажуємо дані з кешу для швидкого старту
            const cachedData = CacheManager.get(CACHE_NAMESPACE, `status_${userId}`);
            if (cachedData) {
                updateUIFromData(cachedData);
            }

            // Завантажуємо свіжі дані
            await loadDailyBonusState();

            // Підписуємось на події
            setupEventSubscriptions();

            // Налаштовуємо періодичне оновлення
            setupPeriodicUpdate();

            state.isInitialized = true;

            // Емітуємо подію готовності
            EventBus.emit('manager.daily.ready', { userId });

            console.log('✅ [DailyBonus-V3] Модуль ініціалізовано');

        } catch (error) {
            console.error('❌ [DailyBonus-V3] Помилка ініціалізації:', error);
            window.TasksUtils.showToast('Помилка завантаження щоденного бонусу', 'error');
            throw error;
        }
    }

    /**
     * Завантаження стану з бекенду
     */
    async function loadDailyBonusState(forceRefresh = false) {
        console.log('📂 [DailyBonus-V3] Завантаження стану');

        const cacheKey = `status_${state.userId}`;

        // Перевіряємо кеш
        if (!forceRefresh) {
            const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (cached) {
                updateUIFromData(cached);
                return cached;
            }
        }

        try {
            // API виклик через RequestManager
const response = await apiClient.execute(
    `daily_claim_${state.userId}_${Date.now()}`,
    () => window.TasksAPI.daily.claim(state.userId),
    { priority: 'high', deduplicate: false }
);
            console.log('📊 [DailyBonus-V3] Відповідь сервера:', response);

            // Обробка різних форматів відповіді
            if (response?.status === 'success' && response.data) {
                const data = response.data;

                // Кешуємо результат
                CacheManager.set(CACHE_NAMESPACE, cacheKey, data);

                // Оновлюємо Store
                updateStoreFromData(data);

                // Оновлюємо UI
                updateUIFromData(data);

                return data;
            }

            throw new Error('Invalid response format');

        } catch (error) {
            console.error('❌ [DailyBonus-V3] Помилка завантаження:', error);

            // Використовуємо кешовані дані при помилці
            const fallback = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (fallback) {
                updateUIFromData(fallback);
                return fallback;
            }

            throw error;
        }
    }

    /**
     * Оновлення Store з даних
     */
    function updateStoreFromData(data) {
        const store = window.TasksStore;
        if (!store) return;

        // Батчимо оновлення через actions
        store.actions.setDailyStreak(data.current_streak || 0);
        store.actions.setClaimedDays(data.claimed_days || []);

        if (data.total_claimed) {
            store.actions.updateDailyTotalClaimed({
                winix: data.total_claimed.winix || 0,
                tickets: data.total_claimed.tickets || 0
            });
        }
    }

    /**
     * Оновлення UI з даних
     */
    function updateUIFromData(data) {
        console.log('🔄 [DailyBonus-V3] Оновлення UI з даних:', data);

        // Оновлюємо прогрес місяця
        updateMonthProgress(data);

        // Оновлюємо останні дні
        updateRecentDays(data);

        // Оновлюємо календар
        updateCalendar(data);

        // Оновлюємо статистику
        updateStreakStats(data);

        // Оновлюємо кнопку
        updateClaimButton(data);
    }

    /**
     * Оновлення прогресу місяця
     */
    function updateMonthProgress(data) {
    // Шукаємо правильні елементи згідно CSS
    const container = document.querySelector('.month-progress-container');
    if (!container) return;

    const progressFill = container.querySelector('.month-progress-fill');
    const progressText = container.querySelector('.month-progress-text');

    // Оновлюємо статистику
    const daysCompleted = container.querySelector('.progress-stat-value.days');
    const currentStreak = container.querySelector('.progress-stat-value.streak');

    if (progressFill) {
        const progress = ((data.current_day_number || 0) / 30) * 100;
        progressFill.style.width = `${progress}%`;
    }

    if (progressText) {
        progressText.textContent = `День ${data.current_day_number || 0} з 30`;
    }

    if (daysCompleted) {
        daysCompleted.textContent = data.current_day_number || 0;
    }

    if (currentStreak) {
        currentStreak.textContent = data.current_streak || 0;
    }
}

    /**
     * Оновлення останніх днів
     */
   function updateRecentDays(data) {
    const container = document.querySelector('.recent-days-grid');
    if (!container) return;

    const today = new Date();
    const recentDays = [];

    // Генеруємо останні 5 днів
    for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayNum = date.getDate();

        const isClaimed = data.claimed_days?.includes(dateStr);
        const isToday = i === 0;

        recentDays.push({
            date: dateStr,
            dayNum: dayNum,
            isClaimed: isClaimed,
            isToday: isToday,
            canClaim: isToday && data.can_claim_today,
            reward: data.calendar_rewards?.[dayNum] || { winix: 20 + (dayNum * 2), tickets: 0 }
        });
    }

    // Рендеримо HTML згідно CSS
    container.innerHTML = recentDays.map(day => `
        <div class="recent-day-card ${day.isClaimed ? 'claimed' : ''} ${day.isToday ? 'today' : ''}">
            <div class="recent-day-number">${day.dayNum}</div>
            <div class="recent-day-label">${day.isToday ? 'Сьогодні' : ''}</div>
            <div class="recent-day-rewards">
                <div class="recent-day-reward winix">
                    <span class="reward-icon-small winix-icon-small"></span>
                    ${day.reward.winix}
                </div>
                ${day.reward.tickets > 0 ? `
                    <div class="recent-day-reward tickets">
                        <span class="reward-icon-small ticket-icon-small"></span>
                        ${day.reward.tickets}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}
    /**
     * Оновлення календаря
     */
function updateCalendar(data) {
    const container = document.querySelector('.calendar-grid');
    if (!container) return;

    const today = new Date();
    const currentDay = today.getDate();
    const calendarDays = [];

    // Генеруємо 30 днів
    for (let day = 1; day <= 30; day++) {
        const date = new Date(today.getFullYear(), today.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];

        const isClaimed = data.claimed_days?.some(d => {
            const claimedDate = new Date(d);
            return claimedDate.getDate() === day;
        });

        const isToday = day === currentDay;
        const isFuture = day > currentDay;
        const isSpecial = [7, 14, 21, 30].includes(day); // Спеціальні дні з tickets

        const dayReward = data.calendar_rewards?.[day] || {
            winix: 20 + (day * 2),
            tickets: isSpecial ? Math.floor(day / 7) : 0
        };

        calendarDays.push({
            day: day,
            date: dateStr,
            isClaimed: isClaimed,
            isToday: isToday,
            isFuture: isFuture,
            isSpecial: isSpecial,
            canClaim: isToday && data.can_claim_today,
            reward: dayReward
        });
    }

    // Рендеримо HTML згідно CSS
    container.innerHTML = calendarDays.map(day => `
        <div class="calendar-day ${day.isClaimed ? 'claimed' : ''} ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''} ${day.isSpecial ? 'special' : ''}"
             data-day="${day.day}">
            <div class="calendar-day-number">${day.day}</div>
            <div class="calendar-day-reward">${day.reward.winix}</div>
            ${day.reward.tickets > 0 ? '<div class="calendar-ticket-badge"></div>' : ''}
        </div>
    `).join('');
}

    /**
     * Оновлення статистики стріків
     */
function updateStreakStats(data) {
    // Оновлюємо статистику
    const totalWinix = document.getElementById('total-winix');
    const totalTickets = document.getElementById('total-tickets');

    if (totalWinix && data.total_claimed) {
        totalWinix.textContent = (data.total_claimed.winix || 0).toLocaleString();
    }

    if (totalTickets && data.total_claimed) {
        totalTickets.textContent = (data.total_claimed.tickets || 0).toLocaleString();
    }
}

    /**
     * Оновлення кнопки отримання
     */
    function updateClaimButton(data) {
        const button = document.getElementById('claim-daily-button');
        if (!button) return;

        const canClaim = data.can_claim_today;

        // Оновлюємо стан кнопки
        button.disabled = !canClaim || state.isProcessingClaim;
        button.className = `claim-daily-button ${canClaim ? 'available' : 'claimed'}`;

        if (state.isProcessingClaim) {
            button.innerHTML = '<span class="button-text">Обробка...</span>';
        } else if (canClaim) {
            let btnText = 'Отримати щоденний бонус';
            if (data.today_reward) {
                btnText = `Отримати ${data.today_reward.winix} WINIX`;
                if (data.today_reward.tickets > 0) {
                    btnText += ` + ${data.today_reward.tickets} tickets`;
                }
            }
            button.innerHTML = `<span class="button-text">${btnText}</span>`;
        } else {
            button.innerHTML = '<span class="button-text">Отримано сьогодні</span>';

            if (data.next_available_date) {
                const timeUntil = getTimeUntilNext(data.next_available_date);
                button.innerHTML += `<span class="timer">${timeUntil}</span>`;
            }
        }
    }

    /**
 * Перевірити та оновити статус після помилки
 */
async function checkAndUpdateStatus() {
    try {
        const status = await loadDailyBonusState(true);
        if (status) {
            updateUIFromData(status);
        }
    } catch (error) {
        console.error('❌ [DailyBonus-V3] Помилка оновлення статусу:', error);
    }
}

    /**
     * Отримати щоденний бонус
     */
    const claimDailyBonus = window.TasksUtils.debounce(async function() {
    console.log('🎁 [DailyBonus-V3] Отримання бонусу');

    if (state.isProcessingClaim) {
        console.warn('⚠️ [DailyBonus-V3] Вже обробляється');
        return;
    }

    state.isProcessingClaim = true;

    // Оновлюємо UI
    EventBus.emit('claimStarted');
    updateClaimButton({ can_claim_today: false });

    try {
        // API виклик через RequestManager
const response = await apiClient.execute(
    `status_${state.userId}`,
    () => window.TasksAPI.daily.getStatus(state.userId),
    { priority: 'high', deduplicate: false }
);

        console.log('📊 [DailyBonus-V3] Відповідь сервера:', response);

        // Перевіряємо успішну відповідь
        if (response?.status === 'success' && response.data) {
            const data = response.data;

            // Інвалідуємо кеш
            CacheManager.invalidate(CACHE_NAMESPACE, `status_${state.userId}`);

            // Оновлюємо Store
            window.TasksStore.actions.claimDailyBonus(data.reward);
            window.TasksStore.actions.addClaimedDay(data.day_number);

            // Емітуємо подію успіху
            EventBus.emit(EventBus.EVENTS.DAILY_CLAIMED, {
                reward: data.reward,
                day: data.day_number,
                streak: data.new_streak
            });

            // Показуємо анімацію через EventBus
            eventBus.emit('showRewardAnimation', data.reward);

            // Показуємо повідомлення
            window.TasksUtils.showToast(
                `Отримано: +${data.reward.winix} WINIX${data.reward.tickets ? ` та +${data.reward.tickets} tickets` : ''}`,
                'success'
            );

            // Оновлюємо дані
            await loadDailyBonusState(true);

            console.log('✅ [DailyBonus-V3] Бонус успішно отримано');

        } else {
            // Обробка помилки від сервера
            console.warn('⚠️ [DailyBonus-V3] Сервер повернув помилку:', response);

            if (response?.code === 'daily_already_claimed' ||
                response?.message?.includes('вже отримано')) {
                await loadDailyBonusState(true);
                window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'info');
            } else {
                throw new Error(response?.message || 'Помилка отримання бонусу');
            }
        }

    } catch (error) {
        console.error('❌ [DailyBonus-V3] Помилка:', error);

        // Детальна обробка помилок
        if (error.status === 400) {
            // Парсимо помилку від сервера
            const errorData = error.data || {};

            if (errorData.code === 'daily_already_claimed' ||
                errorData.message?.includes('вже отримано')) {
                await loadDailyBonusState(true);
                window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'info');
            } else if (errorData.code === 'daily_claim_error') {
                await loadDailyBonusState(true);
                window.TasksUtils.showToast(
                    errorData.message || 'Помилка отримання бонусу',
                    'error'
                );
            } else {
                window.TasksUtils.showToast('Помилка отримання бонусу', 'error');
            }
        } else if (error.status === 429) {
            window.TasksUtils.showToast('Забагато запитів. Спробуйте через хвилину', 'warning');
        } else {
            window.TasksUtils.showToast(
                error.message || 'Помилка отримання бонусу',
                'error'
            );
        }

    } finally {
        state.isProcessingClaim = false;
        EventBus.emit('claimCompleted');

        // Оновлюємо UI незалежно від результату
        const currentData = CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`);
        if (currentData) {
            updateClaimButton(currentData);
        }
    }
}, config.claimDebounceTime);

    /**
     * Налаштування підписок на події
     */
    function setupEventSubscriptions() {
        // Підписка на оновлення даних
        const unsubDataUpdate = EventBus.on('daily.status.updated', (data) => {
            console.log('📊 [DailyBonus-V3] Отримано оновлення статусу');
            updateUIFromData(data);
        });

        // Підписка на UI події
        const unsubUIUpdate = EventBus.on('ui.daily.refresh', () => {
            loadDailyBonusState(true);
        });

        // Підписка на зміну вкладки
        const unsubTabChange = EventBus.on(EventBus.EVENTS.TAB_CHANGED, (data) => {
            if (data.newTab === 'daily') {
                checkForNewDay();
            }
        });

        // Зберігаємо callbacks для відписки
        state.unsubscribeCallbacks.push(unsubDataUpdate, unsubUIUpdate, unsubTabChange);

        // Обробник кнопки
        const button = document.getElementById('claim-daily-button');
        if (button) {
            button.addEventListener('click', claimDailyBonus);
        }

        // Делегування для календаря
        const calendar = document.getElementById('daily-calendar');
        if (calendar) {
            calendar.addEventListener('click', handleCalendarClick);
        }
    }

    /**
     * Обробка кліків на календарі
     */
    const handleCalendarClick = window.TasksUtils.throttle((e) => {
        const dayCell = e.target.closest('.calendar-day');
        if (!dayCell) return;

        const day = parseInt(dayCell.getAttribute('data-day'));
        EventBus.emit('calendar.dayClicked', { day });
    }, 500);

    /**
     * Налаштування періодичного оновлення
     */
    function setupPeriodicUpdate() {
        // Використовуємо RequestManager для планування
        const checkInterval = setInterval(() => {
            if (!document.hidden) {
                checkForNewDay();
            }
        }, config.updateIntervalMs);

        // Зберігаємо для очищення
        state.unsubscribeCallbacks.push(() => clearInterval(checkInterval));

        // Оновлення таймера кожну секунду
        const timerInterval = setInterval(() => {
            const button = document.getElementById('claim-daily-button');
            if (button && button.querySelector('.timer')) {
                const cached = CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`);
                if (cached && !cached.can_claim_today && cached.next_available_date) {
                    const timeUntil = getTimeUntilNext(cached.next_available_date);
                    const timerSpan = button.querySelector('.timer');
                    if (timerSpan) {
                        timerSpan.textContent = timeUntil;
                    }
                }
            }
        }, 1000);

        state.unsubscribeCallbacks.push(() => clearInterval(timerInterval));
    }

    /**
     * Перевірка нового дня
     */
    async function checkForNewDay() {
        const cached = CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`);

        if (cached && !cached.can_claim_today && cached.next_available_date) {
            const now = Date.now();
            const nextTime = new Date(cached.next_available_date).getTime();

            if (now >= nextTime) {
                console.log('🆕 [DailyBonus-V3] Новий день!');
                await loadDailyBonusState(true);

                // Сповіщаємо про новий бонус
                EventBus.emit('daily.newDayAvailable');
            }
        }
    }

    /**
     * Отримати час до наступного бонусу
     */
    function getTimeUntilNext(nextClaimTime) {
        const now = Date.now();
        const next = new Date(nextClaimTime).getTime();
        const diff = Math.max(0, next - now);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        const cached = CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`);
        if (!cached) return null;

        return {
            currentStreak: cached.current_streak || 0,
            longestStreak: cached.longest_streak || 0,
            currentDay: cached.current_day_number || 0,
            totalWinix: cached.total_claimed?.winix || 0,
            totalTickets: cached.total_claimed?.tickets || 0,
            completionRate: ((cached.current_day_number || 0) / config.maxDays * 100).toFixed(1) + '%',
            daysUntilReset: config.maxDays - (cached.current_day_number || 0)
        };
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [DailyBonus-V3] Знищення модуля');

        // Відписуємось від всіх подій
        state.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });

        // Очищаємо стан
        state.isInitialized = false;
        state.isProcessingClaim = false;
        state.unsubscribeCallbacks = [];

        console.log('✅ [DailyBonus-V3] Модуль знищено');
    }

    console.log('✅ [DailyBonus-V3] Модуль готовий (Централізовані утиліти)');

    // Публічний API
    return {
        init,
        claimDailyBonus,
        loadDailyBonusState,
        getStatistics,
        destroy,

        // Для зовнішнього доступу
        getState: () => ({
            canClaim: CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`)?.can_claim_today || false,
            currentDay: CacheManager.get(CACHE_NAMESPACE, `status_${state.userId}`)?.current_day_number || 0,
            isProcessing: state.isProcessingClaim
        })
    };

})();

console.log('✅ [DailyBonus-V3] Модуль експортовано глобально');