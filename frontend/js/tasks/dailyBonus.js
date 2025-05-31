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
            // Використовуємо RequestManager для API виклику
            const response = await apiClient.execute(
                cacheKey,
                () => window.TasksAPI.daily.getStatus(state.userId),
                { priority: 'normal', deduplicate: !forceRefresh }
            );

            if (response?.status === 'success' && response.data) {
                const data = response.data;

                // Кешуємо результат
                CacheManager.set(CACHE_NAMESPACE, cacheKey, data);

                // Оновлюємо Store
                updateStoreFromData(data);

                // Оновлюємо UI через EventBus
                eventBus.emit('dataLoaded', data);
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
        // Використовуємо EventBus для оновлення UI компонентів
        EventBus.emit(EventBus.EVENTS.UI_UPDATE, {
            component: 'dailyBonus',
            data: {
                currentDay: data.current_day_number || 0,
                currentStreak: data.current_streak || 0,
                longestStreak: data.longest_streak || 0,
                canClaim: data.can_claim_today || false,
                nextClaimTime: data.next_available_date || null,
                todayReward: data.today_reward || null,
                calendarRewards: data.calendar_rewards || [],
                claimedDays: data.claimed_days || []
            }
        });

        // Оновлюємо кнопку
        updateClaimButton(data);
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
                `claim_${state.userId}`,
                () => window.TasksAPI.daily.claim(state.userId),
                { priority: 'high', deduplicate: false }
            );

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
                EventBus.emit('showRewardAnimation', data.reward);

                // Оновлюємо дані
                await loadDailyBonusState(true);

                console.log('✅ [DailyBonus-V3] Бонус успішно отримано');
            } else {
                throw new Error(response?.message || 'Помилка отримання бонусу');
            }

        } catch (error) {
            console.error('❌ [DailyBonus-V3] Помилка:', error);

            // Обробка специфічних помилок
            if (error.message?.includes('вже отримано')) {
                await loadDailyBonusState(true);
                window.TasksUtils.showToast('Бонус вже отримано сьогодні', 'warning');
            } else if (error.message?.includes('429')) {
                window.TasksUtils.showToast('Забагато запитів. Спробуйте через хвилину', 'warning');
            } else {
                window.TasksUtils.showToast('Помилка отримання бонусу', 'error');
            }

        } finally {
            state.isProcessingClaim = false;
            EventBus.emit('claimCompleted');
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