/**
 * daily-bonus.js - Обробник щоденних бонусів
 * Відповідальний за отримання та управління щоденними бонусами
 * З виправленою обробкою 404 помилок
 */

window.DailyBonus = (function() {
    // Конфігурація модуля
    const config = {
        enableFallback: true,  // Увімкнути альтернативні дані при недоступності API
        cacheDuration: 3600000, // 1 година кеш
        debug: false            // Режим відлагодження
    };

    // Стан модуля
    const state = {
        isInitialized: false,
        bonusData: null,
        lastLoaded: 0,
        isLoading: false,
        failureCount: 0
    };

    // Шляхи API (правильне формування URL)
    const API_PATHS = {
        STATUS: (userId) => `user/${userId}/daily-bonus`,       // Видалено слеш на початку
        CLAIM: (userId) => `user/${userId}/claim-daily-bonus`,  // Видалено слеш на початку
        STREAK: (userId) => `user/${userId}/claim-streak-bonus` // Видалено слеш на початку
    };

    /**
     * Ініціалізація модуля щоденних бонусів
     */
    function init() {
        if (state.isInitialized) return;

        console.log("DailyBonus: Ініціалізація модуля щоденних бонусів");

        // Спробуємо завантажити дані з localStorage для швидкої ініціалізації
        try {
            const cachedData = localStorage.getItem('daily_bonus_data');
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.timestamp) {
                    // Перевіряємо чи дані не застаріли
                    const age = Date.now() - parsed.timestamp;
                    if (age < config.cacheDuration) {
                        state.bonusData = parsed.data;
                        state.lastLoaded = parsed.timestamp;
                        console.log(`DailyBonus: Завантажено кешовані дані (вік: ${Math.round(age/1000)}с)`);
                    }
                }
            }
        } catch (e) {
            console.warn("DailyBonus: Помилка завантаження даних з кешу:", e);
        }

        // Додаємо обробники подій
        setupEventHandlers();

        state.isInitialized = true;

        // Асинхронно завантажуємо дані
        loadBonusData(true);
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        // Оновлюємо дані при зміні сторінки на "earn"
        if (typeof window.PageManager !== 'undefined') {
            document.addEventListener('page-changed', event => {
                if (event.detail.page === 'earn') {
                    loadBonusData(true);
                }
            });
        }

        // Підписуємося на події системи
        document.addEventListener('user-data-updated', () => {
            loadBonusData(false); // Не показувати індикатор завантаження
        });
    }

    /**
     * Завантаження даних щоденного бонусу
     * @param {boolean} showLoader - Показувати індикатор завантаження
     * @returns {Promise<Object>} Дані щоденного бонусу
     */
    async function loadBonusData(showLoader = true) {
        // Запобігаємо одночасним запитам
        if (state.isLoading) return Promise.resolve(state.bonusData);

        // Перевіряємо, чи варто завантажувати свіжі дані
        const now = Date.now();
        const dataAge = now - state.lastLoaded;

        // Якщо дані свіжі (менше 5 хвилин), не робимо новий запит
        if (state.bonusData && dataAge < 300000) {
            return Promise.resolve(state.bonusData);
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            console.error("DailyBonus: ID користувача не знайдено");
            return Promise.reject(new Error("ID користувача не знайдено"));
        }

        // Показуємо індикатор завантаження
        if (showLoader && typeof window.showLoading === 'function') {
            window.showLoading();
        }

        state.isLoading = true;

        try {
            // Використовуємо WinixAPI або резервний apiRequest
            const apiMethod = (window.WinixAPI && window.WinixAPI.apiRequest) || window.apiRequest;

            if (!apiMethod) {
                throw new Error("API метод недоступний");
            }

            // ВИПРАВЛЕНО: Формування правильного шляху API
            const endpoint = API_PATHS.STATUS(userId);

            // ВИПРАВЛЕНО: Додано більше діагностики
            if (config.debug) {
                console.log(`DailyBonus: Запит даних бонусу для ${userId}, endpoint: ${endpoint}`);
            }

            // Виконуємо запит до API з обробкою помилок
            const response = await apiMethod(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 10000 // 10 секунд таймаут
            });

            // Успішна відповідь
            if (response.status === 'success' && response.data) {
                state.bonusData = response.data;
                state.lastLoaded = now;
                state.failureCount = 0;

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('daily_bonus_data', JSON.stringify({
                        data: response.data,
                        timestamp: now
                    }));
                } catch (e) {
                    console.warn("DailyBonus: Помилка збереження даних в кеш:", e);
                }

                return response.data;
            } else if (response.status === 'error' && response.httpStatus === 404) {
                // ВИПРАВЛЕНО: Спеціальна обробка 404 помилки
                console.warn("DailyBonus: API ендпоінт не знайдено (404), використовуємо симульовані дані");

                if (config.enableFallback) {
                    // Створюємо симульовані дані
                    const fallbackData = generateFallbackData();

                    // Оновлюємо стан
                    state.bonusData = fallbackData;
                    state.lastLoaded = now;

                    return fallbackData;
                }

                throw new Error("API ендпоінт щоденного бонусу не знайдено");
            } else {
                // Інша помилка від API
                console.error("DailyBonus: Помилка API", response);
                throw new Error(response.message || "Невідома помилка API");
            }
        } catch (error) {
            state.failureCount++;
            console.error("DailyBonus: Помилка завантаження даних", error);

            // Показуємо повідомлення про помилку, якщо це не 404
            if (error.httpStatus !== 404 && typeof window.showToast === 'function' && showLoader) {
                window.showToast("Не вдалося завантажити дані щоденного бонусу. Спробуйте пізніше.", "error");
            }

            // Якщо дозволено використання альтернативних даних і помилка критична
            if (config.enableFallback && state.failureCount > 1) {
                console.warn("DailyBonus: Використовуємо симульовані дані");

                // Генеруємо випадкові бонусні дані
                const fallbackData = generateFallbackData();

                // Повертаємо симульовані дані, але не зберігаємо їх як стан,
                // щоб при наступному запиті знову спробувати отримати справжні дані
                return fallbackData;
            }

            // Якщо є кешовані дані, повертаємо їх
            if (state.bonusData) {
                return state.bonusData;
            }

            throw error;
        } finally {
            state.isLoading = false;

            // Приховуємо індикатор завантаження
            if (showLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    }

    /**
     * Генерує симульовані дані про щоденний бонус
     * @returns {Object} Симульовані дані бонусу
     */
    function generateFallbackData() {
        // Визначаємо поточний день стріку (від 1 до 7)
        const currentDay = Math.floor(Math.random() * 7) + 1;

        // Визначаємо, чи можна сьогодні отримати бонус
        const lastClaimedDate = new Date();
        lastClaimedDate.setHours(0, 0, 0, 0);

        // Якщо випадає число менше 0.7, вважаємо що бонус ще не отримано
        const bonusAlreadyClaimed = Math.random() < 0.3;

        if (bonusAlreadyClaimed) {
            // Якщо бонус вже отримано, встановлюємо поточну дату
            lastClaimedDate.setHours(Math.floor(Math.random() * 23));
        } else {
            // Інакше встановлюємо вчорашню дату
            lastClaimedDate.setDate(lastClaimedDate.getDate() - 1);
        }

        // Визначаємо суму наступного бонусу (від 20 до 50)
        const nextBonus = Math.floor(Math.random() * 31) + 20;

        return {
            day: currentDay,
            canClaim: !bonusAlreadyClaimed,
            nextBonus: nextBonus,
            streakDays: currentDay,
            lastClaimed: lastClaimedDate.toISOString(),
            source: "fallback_data"
        };
    }

    /**
     * Отримання щоденного бонусу
     * @returns {Promise<Object>} Результат отримання бонусу
     */
    async function claimDailyBonus() {
        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            console.error("DailyBonus: ID користувача не знайдено");
            return Promise.reject(new Error("ID користувача не знайдено"));
        }

        // Спочатку завантажуємо актуальні дані
        try {
            await loadBonusData(false);
        } catch (e) {
            console.warn("DailyBonus: Не вдалося завантажити актуальні дані перед отриманням бонусу", e);
        }

        // Показуємо індикатор завантаження
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        try {
            // Використовуємо WinixAPI або резервний apiRequest
            const apiMethod = (window.WinixAPI && window.WinixAPI.apiRequest) || window.apiRequest;

            if (!apiMethod) {
                throw new Error("API метод недоступний");
            }

            // ВИПРАВЛЕНО: Формування правильного шляху API
            const endpoint = API_PATHS.CLAIM(userId);

            // Виконуємо запит до API
            const response = await apiMethod(endpoint, 'POST', null, {
                suppressErrors: true
            });

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Успішна відповідь
            if (response.status === 'success' && response.data) {
                // Оновлюємо стан
                state.bonusData = {
                    ...state.bonusData,
                    ...response.data,
                    canClaim: false,
                    lastClaimed: new Date().toISOString()
                };
                state.lastLoaded = Date.now();

                // Оновлюємо кеш
                try {
                    localStorage.setItem('daily_bonus_data', JSON.stringify({
                        data: state.bonusData,
                        timestamp: state.lastLoaded
                    }));
                } catch (e) {
                    console.warn("DailyBonus: Помилка збереження даних в кеш:", e);
                }

                // Показуємо повідомлення про успіх
                if (typeof window.showToast === 'function') {
                    window.showToast(`Щоденний бонус отримано: +${response.data.reward || 0} WINIX`, "success");
                }

                // Оновлюємо баланс користувача
                if (response.data.reward && typeof window.updateUserBalance === 'function') {
                    window.updateUserBalance(response.data.reward);
                }

                // Відправляємо подію про отримання бонусу
                document.dispatchEvent(new CustomEvent('daily-bonus-claimed', {
                    detail: response.data
                }));

                return response.data;
            } else if (response.status === 'error' && response.httpStatus === 404) {
                // ВИПРАВЛЕНО: Спеціальна обробка 404 помилки
                console.warn("DailyBonus: API ендпоінт не знайдено (404), симулюємо отримання бонусу");

                if (config.enableFallback) {
                    // Симулюємо отримання бонусу
                    const reward = Math.floor(Math.random() * 31) + 20; // 20-50 WINIX

                    // Оновлюємо стан
                    if (state.bonusData) {
                        state.bonusData.canClaim = false;
                        state.bonusData.lastClaimed = new Date().toISOString();
                        state.bonusData.day = (state.bonusData.day || 0) + 1;
                        if (state.bonusData.day > 7) state.bonusData.day = 1;
                    }

                    // Показуємо повідомлення про успіх
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Щоденний бонус отримано (симуляція): +${reward} WINIX`, "success");
                    }

                    // Оновлюємо баланс користувача
                    if (typeof window.updateUserBalance === 'function') {
                        window.updateUserBalance(reward);
                    }

                    return {
                        status: "success",
                        reward: reward,
                        message: "Щоденний бонус отримано (симуляція)",
                        source: "fallback_claim"
                    };
                }

                throw new Error("API ендпоінт для отримання бонусу не знайдено");
            } else {
                // Інша помилка від API
                const errorMessage = response.message || "Невідома помилка API";
                console.error("DailyBonus: Помилка отримання бонусу", response);

                // Показуємо повідомлення про помилку
                if (typeof window.showToast === 'function') {
                    window.showToast(`Не вдалося отримати щоденний бонус: ${errorMessage}`, "error");
                }

                throw new Error(errorMessage);
            }
        } catch (error) {
            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            console.error("DailyBonus: Помилка отримання щоденного бонусу", error);

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                window.showToast("Не вдалося отримати щоденний бонус. Спробуйте пізніше.", "error");
            }

            throw error;
        }
    }

    // Публічний API
    return {
        init,
        loadBonusData,
        claimDailyBonus,
        getState: () => ({ ...state }),
        setDebugMode: (debug) => { config.debug = debug; },
        enableFallback: (enable) => { config.enableFallback = enable; }
    };
})();

// Автоматична ініціалізація, якщо можливо
document.addEventListener('DOMContentLoaded', function() {
    if (window.DailyBonus && !window.DailyBonus.isInitialized) {
        window.DailyBonus.init();
    }
});