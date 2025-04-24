/**
 * Mock API - модуль для імітації запитів до бекенду
 * Використовується для розробки та тестування фронтенду без реального бекенду
 */

window.API = (function() {
    // Приватні змінні модуля
    const STORAGE_KEY = 'winix_mock_data';

    // Затримка для імітації мережевої затримки (мс)
    const DEFAULT_DELAY = 700;

    // ID поточного користувача
    let currentUserId = null;

    /**
     * Отримання ID поточного користувача
     */
    function getCurrentUserId() {
        if (currentUserId) return currentUserId;

        if (window.WinixAPI && window.WinixAPI.getUserId) {
            currentUserId = window.WinixAPI.getUserId();
            return currentUserId;
        }

        // Запасний варіант - отримання ID з DOM
        const userIdElement = document.getElementById('user-id');
        currentUserId = userIdElement ? userIdElement.textContent : '7066583465';

        return currentUserId;
    }

    /**
     * Допоміжна функція для генерації унікального ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Допоміжна функція затримки
     */
    function delay(ms = DEFAULT_DELAY) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Отримання збережених даних
     */
    function getStoredData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : getInitialData();
        } catch (e) {
            console.warn('Помилка отримання збережених даних:', e);
            return getInitialData();
        }
    }

    /**
     * Збереження даних
     */
    function storeData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('Помилка збереження даних:', e);
            return false;
        }
    }

    /**
     * Отримання початкових даних
     */
    function getInitialData() {
        return {
            tasks: {
                social: getSocialTasks(),
                limited: getLimitedTasks(),
                partners: getPartnerTasks()
            },
            userProgress: {},
            dailyBonus: getDailyBonusData(),
            leaderboard: getLeaderboardData()
        };
    }

    /**
     * Отримання моделі соціальних завдань
     */
    function getSocialTasks() {
        return [
            {
                id: 'social_telegram',
                title: 'Підписатися на Telegram',
                description: 'Підпишіться на наш офіційний Telegram канал для отримання останніх новин та оновлень',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 10,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://t.me/winix_official',
                action_label: 'Підписатися'
            },
            {
                id: 'social_twitter',
                title: 'Підписатися на Twitter',
                description: 'Підпишіться на наш Twitter акаунт та будьте в курсі останніх новин',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 15,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://twitter.com/winix_official',
                action_label: 'Підписатися'
            },
            {
                id: 'social_discord',
                title: 'Приєднатися до Discord',
                description: 'Приєднайтеся до нашої спільноти в Discord, спілкуйтеся з іншими учасниками та отримуйте підтримку',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 15,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://discord.gg/winix',
                action_label: 'Приєднатися'
            },
            {
                id: 'social_share',
                title: 'Поділитися з друзями',
                description: 'Розкажіть друзям про WINIX у соціальних мережах',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 20,
                target_value: 1,
                action_type: 'share',
                action_label: 'Поділитися'
            }
        ];
    }

    /**
     * Отримання моделі лімітованих завдань
     */
    function getLimitedTasks() {
        // Створюємо кінцеву дату через 3 дні
        const endDate1 = new Date();
        endDate1.setDate(endDate1.getDate() + 3);

        // Створюємо кінцеву дату через 5 днів
        const endDate2 = new Date();
        endDate2.setDate(endDate2.getDate() + 5);

        return [
            {
                id: 'limited_vote',
                title: 'Проголосувати за проект',
                description: 'Проголосуйте за WINIX на платформі CoinVote для підтримки проекту',
                type: 'limited',
                reward_type: 'tokens',
                reward_amount: 30,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://coinvote.cc/winix',
                action_label: 'Проголосувати',
                end_date: endDate1.toISOString()
            },
            {
                id: 'limited_game',
                title: 'Зіграти в мініГРУ',
                description: 'Зіграйте в нашу мініГру та отримайте бонус за досягнення 1000 очок',
                type: 'limited',
                reward_type: 'tokens',
                reward_amount: 50,
                target_value: 1,
                action_type: 'play',
                action_label: 'Грати',
                end_date: endDate2.toISOString()
            }
        ];
    }

    /**
     * Отримання моделі партнерських завдань
     */
    function getPartnerTasks() {
        return [
            {
                id: 'partner_exchange',
                title: 'Зареєструватися на біржі',
                description: 'Зареєструйтеся на нашій партнерській біржі та отримайте бонус',
                type: 'partner',
                reward_type: 'tokens',
                reward_amount: 100,
                target_value: 1,
                action_type: 'register',
                action_url: 'https://exchange.example.com/ref=winix',
                action_label: 'Зареєструватися'
            }
        ];
    }

    /**
     * Отримання моделі щоденного бонусу
     */
    function getDailyBonusData() {
        const currentDate = new Date().toISOString().split('T')[0];

        return {
            current_day: 1,
            claimed_today: false,
            last_claim_date: null,
            rewards: {
                1: 10,
                2: 20,
                3: 30,
                4: 40,
                5: 50,
                6: 60,
                7: 100
            }
        };
    }

    /**
     * Отримання моделі лідерської дошки
     */
    function getLeaderboardData() {
        const currentUserId = getCurrentUserId();

        return [
            { id: "9876543210", username: "CryptoWhale", referrals_count: 153, reward: 7650 },
            { id: "8765432109", username: "TokenMaster", referrals_count: 129, reward: 6450 },
            { id: "7654321098", username: "BlockchainGuru", referrals_count: 112, reward: 5600 },
            { id: "6543210987", username: "CoinHunter", referrals_count: 98, reward: 4900 },
            { id: "5432109876", username: "SatoshiFan", referrals_count: 87, reward: 4350 },
            { id: "4321098765", username: "CryptoKing", referrals_count: 76, reward: 3800 },
            { id: "3210987654", username: "TokenExplorer", referrals_count: 65, reward: 3250 },
            { id: "2109876543", username: "WinixLover", referrals_count: 54, reward: 2700 },
            { id: "1098765432", username: "CryptoNinja", referrals_count: 43, reward: 2150 },
            { id: "1234567890", username: "BlockGenius", referrals_count: 32, reward: 1600 },
            // Додаємо поточного користувача з випадковим значенням
            { id: currentUserId, username: "Ви", referrals_count: Math.floor(Math.random() * 30) + 1, reward: Math.floor(Math.random() * 30) * 50 }
        ];
    }

    /**
     * GET-запит
     */
    async function get(endpoint) {
        // Імітуємо мережеву затримку
        await delay();

        const data = getStoredData();
        const userId = getCurrentUserId();

        // Обробка різних ендпоінтів
        if (endpoint === '/quests/user-progress') {
            return {
                success: true,
                data: data.userProgress || {}
            };
        }

        else if (endpoint === '/quests/tasks/social') {
            return {
                success: true,
                data: data.tasks.social || []
            };
        }

        else if (endpoint === '/quests/tasks/limited') {
            return {
                success: true,
                data: data.tasks.limited || []
            };
        }

        else if (endpoint === '/quests/tasks/partners') {
            return {
                success: true,
                data: data.tasks.partners || []
            };
        }

        else if (endpoint === '/quests/daily-bonus/status') {
            return {
                success: true,
                data: data.dailyBonus || getDailyBonusData()
            };
        }

        else if (endpoint === '/leaderboard/referrals') {
            return {
                success: true,
                data: data.leaderboard || getLeaderboardData()
            };
        }

        // Якщо ендпоінт не знайдено
        return {
            success: false,
            message: 'Ендпоінт не знайдено'
        };
    }

    /**
     * POST-запит
     */
    async function post(endpoint, data = {}) {
        // Імітуємо мережеву затримку
        await delay();

        const storedData = getStoredData();
        const userId = getCurrentUserId();

        // Обробка різних ендпоінтів
        if (endpoint.startsWith('/quests/tasks/') && endpoint.endsWith('/start')) {
            // Отримуємо ID завдання з URL
            const taskId = endpoint.split('/')[3];

            // Ініціалізуємо прогрес користувача для цього завдання
            if (!storedData.userProgress[taskId]) {
                storedData.userProgress[taskId] = {
                    status: 'in_progress',
                    progress_value: 0,
                    start_date: new Date().toISOString()
                };
            }

            // Зберігаємо дані
            storeData(storedData);

            return {
                success: true,
                message: 'Завдання розпочато'
            };
        }

        else if (endpoint.startsWith('/quests/tasks/') && endpoint.endsWith('/verify')) {
            // Отримуємо ID завдання з URL
            const taskId = endpoint.split('/')[3];

            // Шукаємо завдання за ID
            let task = null;

            for (const category in storedData.tasks) {
                const foundTask = storedData.tasks[category].find(t => t.id === taskId);
                if (foundTask) {
                    task = foundTask;
                    break;
                }
            }

            if (!task) {
                return {
                    success: false,
                    message: 'Завдання не знайдено'
                };
            }

            // Оновлюємо прогрес
            if (!storedData.userProgress[taskId]) {
                storedData.userProgress[taskId] = {
                    status: 'in_progress',
                    progress_value: 0,
                    start_date: new Date().toISOString()
                };
            }

            const progress = storedData.userProgress[taskId];

            // Якщо завдання вже виконано, повертаємо відповідне повідомлення
            if (progress.status === 'completed') {
                return {
                    success: true,
                    message: 'Завдання вже виконано'
                };
            }

            // Якщо випадкове число більше 0.3, вважаємо завдання виконаним
            // Це імітує успішну перевірку в 70% випадків
            if (Math.random() > 0.3) {
                // Встановлюємо максимальний прогрес
                progress.progress_value = task.target_value;
                progress.status = 'completed';
                progress.completion_date = new Date().toISOString();

                // Зберігаємо дані
                storeData(storedData);

                return {
                    success: true,
                    message: 'Завдання успішно виконано!',
                    reward: {
                        type: task.reward_type,
                        amount: task.reward_amount
                    }
                };
            } else {
                // Збільшуємо прогрес, але не позначаємо як виконане
                progress.progress_value = Math.min(task.target_value - 1, progress.progress_value + 1);

                // Зберігаємо дані
                storeData(storedData);

                return {
                    success: false,
                    message: 'Умови завдання ще не виконані. Спробуйте пізніше.'
                };
            }
        }

        else if (endpoint === '/quests/daily-bonus/claim') {
            const dailyBonus = storedData.dailyBonus;

            // Перевіряємо, чи не отримано бонус сьогодні
            if (dailyBonus.claimed_today) {
                return {
                    success: false,
                    message: 'Ви вже отримали щоденний бонус сьогодні'
                };
            }

            // Отримуємо нагороду за поточний день
            const reward = dailyBonus.rewards[dailyBonus.current_day] || 10;

            // Оновлюємо дані щоденного бонусу
            dailyBonus.claimed_today = true;
            dailyBonus.last_claim_date = new Date().toISOString().split('T')[0];

            // Якщо це 7-й день, скидаємо до 1-го, інакше збільшуємо
            if (dailyBonus.current_day >= 7) {
                dailyBonus.current_day = 1;
            } else {
                dailyBonus.current_day += 1;
            }

            // Зберігаємо дані
            storeData(storedData);

            return {
                success: true,
                message: 'Щоденний бонус отримано!',
                data: {
                    reward: {
                        type: 'tokens',
                        amount: reward
                    }
                }
            };
        }

        // Якщо ендпоінт не знайдено
        return {
            success: false,
            message: 'Ендпоінт не знайдено'
        };
    }

    /**
     * Скидання моком даних
     */
    function resetMockData() {
        const initialData = getInitialData();
        storeData(initialData);
        return {
            success: true,
            message: 'Дані скинуто до початкових значень'
        };
    }

    // Публічний API модуля
    return {
        get,
        post,
        resetMockData,
        getCurrentUserId
    };
})();