/**
 * raffles.js
 *
 * Скрипт для керування функціоналом сторінки розіграшів у WINIX.
 * Забезпечує роботу з розіграшами, обробку участі користувачів, таймери, міні-розіграші,
 * бонуси для новачків, статистику та бейджі досягнень.
 */

(function() {
    console.log("🎲 WINIX-RAFFLES: Ініціалізація системи розіграшів...");

    // Запобігаємо повторній ініціалізації
    if (window.WinixRaffles) {
        console.log("✅ WinixRaffles вже ініціалізовано");
        return window.WinixRaffles;
    }

    // Глобальні змінні для роботи з розіграшами
    let isProcessingRaffle = false;
    let currentRaffleId = null;
    let isProcessingMiniRaffle = false;
    let raffleTimers = {};

    // Ключі для localStorage
    const STORAGE_KEYS = {
        RAFFLES_DATA: 'winix_raffles_data',
        MINI_RAFFLES_DATA: 'winix_mini_raffles_data',
        USER_RAFFLES: 'winix_user_raffles',
        RAFFLE_HISTORY: 'raffle_history', // Використовується в HTML-версії
        USER_BADGES: 'winix_user_badges',
        RAFFLE_STATISTICS: 'userStatistics', // Змінено відповідно до HTML-версії
        FIRST_RAFFLE_BONUS: 'first_raffle_participated', // Змінено відповідно до HTML-версії
        SHARE_BONUS: 'share_bonus_claimed', // Змінено відповідно до HTML-версії
        NEWBIE_BONUS: 'newbie_bonus_claimed', // Змінено відповідно до HTML-версії
        BADGE_REWARDS: 'winix_badge_rewards'
    };

    // Функція для безпечного отримання даних з localStorage
    function safeGetItem(key, defaultValue = null, parse = false) {
        try {
            const value = localStorage.getItem(key);

            if (value === null) return defaultValue;

            if (parse) {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    console.error(`Помилка парсингу JSON для ключа ${key}:`, e);
                    return defaultValue;
                }
            }

            return value;
        } catch (e) {
            console.error(`Помилка отримання даних з localStorage для ключа ${key}:`, e);
            return defaultValue;
        }
    }

    // Функція для безпечного збереження даних в localStorage
    function safeSetItem(key, value) {
        try {
            if (typeof value === 'object' && value !== null) {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            console.error(`Помилка збереження в localStorage для ключа ${key}:`, e);
            return false;
        }
    }

    // Функція для генерації унікального ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Функція для форматування часу в читабельний вигляд
    function formatTimeLeft(seconds) {
        if (seconds <= 0) return "Завершено";

        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return `${days}д ${hours}г`;
        } else if (hours > 0) {
            return `${hours}г ${minutes}хв`;
        } else {
            return `${minutes}хв ${seconds % 60}с`;
        }
    }

    // CSS стилі для виконаних завдань
    const completedTaskCSS = `
        .completed-task {
            background: linear-gradient(145deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1)) !important;
            border-left: 3px solid #4CAF50 !important;
            transition: all 0.3s ease;
        }
        .completed-task .mini-raffle-button {
            background: #4CAF50 !important;
            opacity: 0.7;
            cursor: default !important;
        }
        .completed-task .mini-raffle-time:after {
            content: " ✓ Виконано";
            color: #4CAF50;
            font-weight: bold;
        }
    `;

    // Додаємо стилі на сторінку
    const styleElement = document.createElement('style');
    styleElement.textContent = completedTaskCSS;
    document.head.appendChild(styleElement);

    // Створюємо основний об'єкт для роботи з розіграшами
    const RafflesManager = {
        /**
         * Ініціалізація системи розіграшів
         */
        init: function() {
            console.log("🎲 Ініціалізація системи розіграшів...");

            // Ініціалізуємо дані про розіграші, якщо їх ще немає
            this.initRafflesData();

            // Встановлюємо обробники подій
            this.setupEventHandlers();

            // Запускаємо таймери для розіграшів
            this.startRaffleTimers();

            // Оновлюємо UI елементи
            this.updateUIElements();

            // Перевіряємо статус бонусу новачка
            this.checkNewbieBonusStatus();

            console.log("✅ Система розіграшів успішно ініціалізована");

            return true;
        },

        /**
         * Перевірка та оновлення відображення статусу бонусу новачка
         */
        checkNewbieBonusStatus: function() {
            // Перевіряємо, чи був отриманий бонус новачка
            if (safeGetItem(STORAGE_KEYS.NEWBIE_BONUS, false)) {
                // Знаходимо блок бонусу новачка
                const newbieRaffleBlock = document.querySelector('.mini-raffle:has(.mini-raffle-button[data-raffle-id="newbie"])');
                const button = document.querySelector('.mini-raffle-button[data-raffle-id="newbie"]');

                if (newbieRaffleBlock && button) {
                    // Додаємо клас "виконано" до блоку
                    newbieRaffleBlock.classList.add('completed-task');

                    // Змінюємо стиль блоку для індикації виконаного завдання
                    newbieRaffleBlock.style.background = 'linear-gradient(145deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1))';
                    newbieRaffleBlock.style.borderLeft = '3px solid #4CAF50';

                    // Змінюємо вигляд кнопки
                    button.textContent = 'Отримано ✓';
                    button.disabled = true;
                    button.style.opacity = '0.7';
                    button.style.cursor = 'default';
                    button.style.background = '#4CAF50';

                    // Додаємо відмітку про виконане завдання
                    const titleElement = newbieRaffleBlock.querySelector('.mini-raffle-title');
                    if (titleElement && !titleElement.textContent.includes('✓')) {
                        titleElement.textContent += ' ✓';
                    }
                }
            }
        },

        /**
         * Оновлення UI елементів, які використовують переклади
         */
        updateUIElements: function() {
            try {
                // Встановлюємо явно текст "Розіграші WINIX"
                const rafflesTitleElement = document.querySelector('.raffles-title');
                if (rafflesTitleElement) {
                    rafflesTitleElement.textContent = "Розіграші WINIX";
                }

                // Оновлюємо інші елементи інтерфейсу
                this.updateStatisticsDisplay();

                // Оновлюємо відображення бейджів та їх нагород
                this.updateBadgesDisplay();
            } catch (error) {
                console.error("Помилка при оновленні UI елементів:", error);
            }
        },

        /**
         * Ініціалізація даних про розіграші
         */
        initRafflesData: function() {
            // Перевіряємо, чи вже є дані про розіграші
            const rafflesData = safeGetItem(STORAGE_KEYS.RAFFLES_DATA, null, true);

            if (!rafflesData) {
                // Створюємо демонстраційні дані для розіграшів
                const demoRaffles = [
                    {
                        id: 'raffle1',
                        title: 'GIVEAWEY',
                        prize: '250 USDT + 130k WINIX',
                        prizeDetails: '10 переможців з розподілом призів',
                        category: 'main',
                        maxParticipants: 500,
                        currentParticipants: 0,
                        endTime: this._getFutureDate(3),
                        minTokens: 1,
                        description: 'Грандіозний розіграш з призовим фондом 250 USDT та 130,000 WINIX! 10 щасливих переможців отримають цінні призи. Перше місце - 125$ та 10,000 WINIX, друге - 75$ та 8,000 WINIX, третє - 50$ та 5,000 WINIX. Місця з 4 по 10 отримають по 15,000 WINIX! Кожен додатковий жетон збільшує ваші шанси на перемогу!',
                        imageUrl: 'assets/prize-image.mp4',
                        prizeDistribution: [
                            { place: '1 місце', value: '125$ + 10000 WINIX' },
                            { place: '2 місце', value: '75$ + 8000 WINIX' },
                            { place: '3 місце', value: '50$ + 5000 WINIX' },
                            { place: '4-10 місця', value: '15000 WINIX кожному' }
                        ]
                    }
                ];

                // Зберігаємо дані
                safeSetItem(STORAGE_KEYS.RAFFLES_DATA, demoRaffles);

                console.log("🎲 Створено демонстраційні дані для розіграшів");
            }

            // Ініціалізуємо дані про міні-розіграші
            const miniRafflesData = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, null, true);

            if (!miniRafflesData) {
                // Створюємо демонстраційні дані для міні-розіграшів
                const demoMiniRaffles = [
                    {
                        id: 'mini1',
                        title: 'Міні-розіграш #24',
                        prize: '30,000 WINIX (15 переможців)',
                        category: 'daily',
                        endTime: this._getFutureDate(0.25), // 6 годин
                        minTokens: 1,
                        description: 'Щоденний міні-розіграш 30,000 WINIX для 15 щасливих переможців! Кожен переможець отримає по 2,000 WINIX. Розіграш триває 24 години.',
                        imageUrl: 'assets/daily-prize.mp4',
                        currentParticipants: 122
                    },
                    {
                        id: 'newbie',
                        title: 'Бонус новачкам',
                        prize: '150 WINIX кожному',
                        category: 'bonus',
                        endTime: null, // Завжди доступно
                        minTokens: 0,
                        description: 'Отримайте 150 WINIX як бонус новачка! Доступно для всіх нових користувачів платформи.'
                    }
                ];

                // Зберігаємо дані
                safeSetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, demoMiniRaffles);

                console.log("🎲 Створено демонстраційні дані для міні-розіграшів");
            }

            // Ініціалізуємо дані користувача, якщо їх ще немає
            const userRaffles = safeGetItem(STORAGE_KEYS.USER_RAFFLES, null, true);

            if (!userRaffles) {
                // Створюємо порожній об'єкт для розіграшів користувача
                safeSetItem(STORAGE_KEYS.USER_RAFFLES, {
                    participating: [],
                    won: []
                });

                console.log("🎲 Створено порожні дані про розіграші користувача");
            }

            // Ініціалізуємо історію розіграшів, якщо її ще немає
            const raffleHistory = safeGetItem(STORAGE_KEYS.RAFFLE_HISTORY, null, true);

            if (!raffleHistory) {
                // Створюємо демонстраційну історію розіграшів
                const demoHistory = [
                    {
                        id: generateId(),
                        title: '50 USDT',
                        prize: '50 USDT • 10 переможців',
                        winners: 10,
                        date: this._getPastDate(5),
                        status: 'won',
                        participated: true
                    },
                    {
                        id: generateId(),
                        title: '20,000 WINIX',
                        prize: '20,000 WINIX • 5 переможців',
                        winners: 5,
                        date: this._getPastDate(10),
                        status: 'participated',
                        participated: true
                    },
                    {
                        id: generateId(),
                        title: '100 USDT',
                        prize: '100 USDT • 3 переможці',
                        winners: 3,
                        date: this._getPastDate(25),
                        status: 'participated',
                        participated: true
                    }
                ];

                // Зберігаємо дані
                safeSetItem(STORAGE_KEYS.RAFFLE_HISTORY, demoHistory);

                console.log("🎲 Створено демонстраційну історію розіграшів");
            }

            // Ініціалізуємо статистику, якщо її ще немає
            const statistics = safeGetItem(STORAGE_KEYS.RAFFLE_STATISTICS, null, true);

            if (!statistics) {
                // Створюємо демонстраційні дані статистики
                const demoStatistics = {
                    participationsCount: 8,
                    winsCount: 2,
                    totalWinnings: 32500, // WINIX
                    referralsCount: 3
                };

                // Зберігаємо дані
                safeSetItem(STORAGE_KEYS.RAFFLE_STATISTICS, demoStatistics);

                console.log("🎲 Створено демонстраційні дані статистики");
            }

            // Ініціалізуємо бейджі та їх нагороди, якщо їх ще немає
            const badgeRewards = safeGetItem(STORAGE_KEYS.BADGE_REWARDS, null, true);

            if (!badgeRewards) {
                // Створюємо дані для бейджів та їх нагород
                const demoBadges = [
                    {
                        id: 'winner',
                        name: 'Переможець',
                        description: 'Виграйте будь-який розіграш',
                        reward: 5000,
                        unlocked: true,
                        icon: '🏆',
                        rewardClaimed: false
                    },
                    {
                        id: 'beginner',
                        name: 'Початківець',
                        description: 'Візьміть участь у 5 розіграшах',
                        reward: 7500,
                        unlocked: true,
                        icon: '🚀',
                        rewardClaimed: false
                    },
                    {
                        id: 'rich',
                        name: 'Багатій',
                        description: 'Виграйте 100,000 WINIX',
                        reward: 10000,
                        unlocked: false,
                        icon: '💰',
                        rewardClaimed: false
                    },
                    {
                        id: 'regular',
                        name: 'Постійний учасник',
                        description: 'Участь у 20 розіграшах',
                        reward: 20000,
                        unlocked: false,
                        icon: '🔄',
                        rewardClaimed: false
                    }
                ];

                // Зберігаємо дані
                safeSetItem(STORAGE_KEYS.BADGE_REWARDS, demoBadges);

                console.log("🎲 Створено дані про бейджі та їх нагороди");
            }
        },

        /**
         * Отримання майбутньої дати
         * @param {number} daysFromNow - Кількість днів від поточної дати
         * @returns {string} - Дата в ISO форматі
         * @private
         */
        _getFutureDate: function(daysFromNow) {
            const date = new Date();
            date.setDate(date.getDate() + daysFromNow);
            return date.toISOString();
        },

        /**
         * Отримання минулої дати
         * @param {number} daysAgo - Кількість днів до поточної дати
         * @returns {string} - Дата в ISO форматі
         * @private
         */
        _getPastDate: function(daysAgo) {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            return date.toISOString();
        },

        /**
         * Налаштування обробників подій
         */
        setupEventHandlers: function() {
            try {
                // Обробники для вкладок розіграшів (Активні та Минулі)
                document.querySelectorAll('.tab-button').forEach(button => {
                    button.addEventListener('click', function() {
                        // Знімаємо активний клас з усіх кнопок
                        document.querySelectorAll('.tab-button').forEach(btn => {
                            btn.classList.remove('active');
                        });

                        // Додаємо активний клас на вибрану кнопку
                        this.classList.add('active');

                        // Перемикаємо відображення розділів
                        const tabType = this.getAttribute('data-tab');
                        RafflesManager.switchRaffleSection(tabType);
                    });
                });

                // Обробники для кнопок участі в розіграші
                document.querySelectorAll('.join-button').forEach(button => {
                    button.addEventListener('click', function() {
                        const raffleId = this.getAttribute('data-raffle-id');
                        const raffleType = this.getAttribute('data-raffle-type') || 'main';
                        RafflesManager.openRaffleDetails(raffleId, raffleType);
                    });
                });

                // Обробники для міні-розіграшів
                document.querySelectorAll('.mini-raffle-button').forEach(button => {
                    button.addEventListener('click', function() {
                        const raffleId = this.getAttribute('data-raffle-id');
                        const raffleType = this.getAttribute('data-raffle-type') || 'daily';

                        if(raffleId === 'newbie') {
                            // Спеціальна обробка для бонусу новачкам
                            RafflesManager.claimNewbieBonus();
                        } else {
                            // Для звичайних міні-розіграшів
                            RafflesManager.openRaffleDetails(raffleId, raffleType);
                        }
                    });
                });

                // Обробник для кнопки поширення розіграшу
                const shareButton = document.getElementById('share-raffle-btn');
                if (shareButton) {
                    shareButton.addEventListener('click', function() {
                        RafflesManager.shareRaffle();
                    });
                }

                // Обробники для закриття модальних вікон
                document.getElementById('main-modal-close').addEventListener('click', function() {
                    document.getElementById('main-raffle-modal').classList.remove('open');
                });

                document.getElementById('daily-modal-close').addEventListener('click', function() {
                    document.getElementById('daily-raffle-modal').classList.remove('open');
                });

                // Обробники для кнопок MAX у модальних вікнах
                document.getElementById('main-max-tokens-btn').addEventListener('click', function() {
                    RafflesManager.setMaxTokens('main-token-amount');
                });

                document.getElementById('daily-max-tokens-btn').addEventListener('click', function() {
                    RafflesManager.setMaxTokens('daily-token-amount');
                });

                // Обробники для кнопок ВСІ у модальних вікнах
                document.getElementById('main-all-tokens-btn').addEventListener('click', function() {
                    RafflesManager.setAllTokens('main-token-amount');
                });

                document.getElementById('daily-all-tokens-btn').addEventListener('click', function() {
                    RafflesManager.setAllTokens('daily-token-amount');
                });

                // Обробники для кнопок участі в модальних вікнах
                document.getElementById('main-join-btn').addEventListener('click', function() {
                    const raffleId = this.getAttribute('data-raffle-id');
                    const raffleType = this.getAttribute('data-raffle-type') || 'main';
                    RafflesManager.participateInRaffle(raffleId, raffleType, 'main-token-amount');
                });

                document.getElementById('daily-join-btn').addEventListener('click', function() {
                    const raffleId = this.getAttribute('data-raffle-id');
                    const raffleType = this.getAttribute('data-raffle-type') || 'daily';
                    RafflesManager.participateInRaffle(raffleId, raffleType, 'daily-token-amount');
                });

                console.log("🎲 Обробники подій для розіграшів налаштовано");
                return true;
            } catch (error) {
                console.error("❌ Помилка при налаштуванні обробників подій:", error);
                return false;
            }
        },

        /**
         * Перемикання між секціями активних і минулих розіграшів
         * @param {string} section - Ідентифікатор секції ("active" або "past")
         */
        switchRaffleSection: function(section) {
            // Ховаємо всі секції
            const sections = document.querySelectorAll('.raffles-section');
            sections.forEach(s => {
                s.classList.remove('active');
            });

            // Показуємо вибрану секцію
            const activeSection = document.getElementById(`${section}-raffles`);
            if (activeSection) {
                activeSection.classList.add('active');
            }

            // Якщо вибрано "минулі", завантажуємо історію розіграшів
            if (section === 'past') {
                this.loadRaffleHistory();
            }
        },

        /**
         * Завантаження та відображення історії розіграшів
         */
        loadRaffleHistory: function() {
            // Отримуємо дані про історію розіграшів
            const raffleHistory = safeGetItem(STORAGE_KEYS.RAFFLE_HISTORY, [], true);

            // Заповнюємо контейнер історії
            const historyContainer = document.getElementById('history-container');
            if (!historyContainer) return;

            // Очищаємо контейнер
            historyContainer.innerHTML = '';

            // Якщо історія порожня, показуємо відповідне повідомлення
            if (raffleHistory.length === 0) {
                historyContainer.innerHTML = `
                    <div class="history-empty">
                        <p>У вас ще немає історії розіграшів. Візьміть участь у розіграшах, щоб відслідковувати вашу активність.</p>
                    </div>
                `;
                return;
            }

            // Сортуємо історію за датою (від нових до старих)
            const sortedHistory = [...raffleHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

            // Створюємо картки для кожного запису історії
            sortedHistory.forEach(item => {
                const date = new Date(item.date);
                const formattedDate = date.toLocaleDateString('uk-UA');

                const historyCard = document.createElement('div');
                historyCard.className = 'history-card';
                historyCard.innerHTML = `
                    <div class="history-date">${formattedDate}</div>
                    <div class="history-prize">${item.prize}</div>
                    <div class="history-winners">${item.status === 'won' ? 'Ви були серед переможців!' : 'Ви були учасником'}</div>
                    <div class="history-status ${item.status}">${item.status === 'won' ? 'Виграно' : 'Участь'}</div>
                `;

                historyContainer.appendChild(historyCard);
            });
        },

        /**
         * Запуск таймерів для розіграшів
         */
        startRaffleTimers: function() {
            try {
                // Запускаємо таймер для головного розіграшу
                this.startMainRaffleTimer();

                // Запускаємо таймери для міні-розіграшів
                this.updateMiniRaffleTimers();

                console.log("⏰ Таймери для розіграшів запущено");
                return true;
            } catch (error) {
                console.error("❌ Помилка при запуску таймерів:", error);
                return false;
            }
        },

        /**
         * Запуск таймера для головного розіграшу
         */
        startMainRaffleTimer: function() {
            // Отримуємо дані про головний розіграш
            const mainRaffle = this.getRaffleById('raffle1');

            if (!mainRaffle) return false;

            const endTime = new Date(mainRaffle.endTime);

            // Функція оновлення таймера
            function updateTimer() {
                const now = new Date();
                const diff = endTime - now;

                if (diff <= 0) {
                    // Розіграш завершено
                    document.getElementById('days').textContent = '00';
                    document.getElementById('hours').textContent = '00';
                    document.getElementById('minutes').textContent = '00';
                    document.getElementById('seconds').textContent = '00';
                    clearInterval(timerInterval);
                    return;
                }

                // Розрахунок днів, годин, хвилин та секунд
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                // Оновлення елементів таймера
                document.getElementById('days').textContent = String(days).padStart(2, '0');
                document.getElementById('hours').textContent = String(hours).padStart(2, '0');
                document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
                document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
            }

            // Початкове оновлення таймера
            updateTimer();

            // Запуск таймера з інтервалом 1 секунда
            const timerInterval = setInterval(updateTimer, 1000);

            // Зберігаємо таймер для можливості зупинки
            raffleTimers['main'] = timerInterval;

            return true;
        },

        /**
         * Оновлення таймерів для міні-розіграшів
         */
        updateMiniRaffleTimers: function() {
            // Отримуємо всі міні-розіграші
            const miniRaffles = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, [], true);

            // Для кожного міні-розіграшу оновлюємо відображення часу
            miniRaffles.forEach(raffle => {
                if (!raffle.endTime) return; // Пропускаємо розіграші без кінцевої дати

                const raffleTimeElements = document.querySelectorAll('.mini-raffle-time');

                raffleTimeElements.forEach(element => {
                    if (element.closest('.mini-raffle').querySelector('.mini-raffle-title').textContent.includes(raffle.title)) {
                        const endTime = new Date(raffle.endTime);
                        const now = new Date();
                        const diff = Math.floor((endTime - now) / 1000); // Різниця в секундах

                        if (diff <= 0) {
                            element.textContent = '⏰ Завершено';
                        } else {
                            const timeLeftText = formatTimeLeft(diff);
                            element.textContent = `⏰ Залишилось: ${timeLeftText}`;
                        }
                    }
                });
            });

            // Запускаємо повторне оновлення через хвилину
            setTimeout(() => this.updateMiniRaffleTimers(), 60000);
        },

        /**
         * Функція для встановлення максимальної кількості жетонів
         * @param {string} inputId - Ідентифікатор поля вводу
         */
        setMaxTokens: function(inputId) {
            const input = document.getElementById(inputId);
            const coinsBalance = parseInt(document.getElementById('user-coins').textContent);
            const maxAllowed = Math.min(coinsBalance, 50);
            input.value = maxAllowed;
        },

        /**
         * Функція для додавання всіх доступних жетонів у поле вводу
         * @param {string} inputId - Ідентифікатор поля вводу
         */
        setAllTokens: function(inputId) {
            const input = document.getElementById(inputId);
            const coinsBalance = parseInt(document.getElementById('user-coins').textContent);

            if (!input) return;

            if (coinsBalance <= 0) {
                this.showToast('У вас немає жетонів для участі в розіграші', 3000);
                return;
            }

            if (coinsBalance > 50) {
                input.value = 50;
                this.showToast('Максимально можна використати 50 жетонів', 2500);
            } else {
                input.value = coinsBalance;
            }

            this.showToast(`Додано всі доступні жетони: ${input.value}`, 2000);
        },

        /**
         * Відкриття деталей розіграшу
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         */
        openRaffleDetails: function(raffleId, raffleType) {
            // Перевіряємо наявність жетонів
            const coinsBalance = parseInt(document.getElementById('user-coins').textContent);

            // Отримуємо розіграш
            let raffle;

            // Якщо це головний розіграш
            if (raffleType === 'main') {
                raffle = this.getRaffleById(raffleId);
            } else {
                // Шукаємо в міні-розіграшах
                const miniRaffles = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, [], true);
                raffle = miniRaffles.find(r => r.id === raffleId);
            }

            if (!raffle) {
                this.showToast('Розіграш не знайдено', 3000);
                return;
            }

            // Перевіряємо, чи потрібні жетони для участі
            if (raffle.minTokens > 0 && coinsBalance < raffle.minTokens) {
                this.showToast(`Для участі в розіграші потрібно щонайменше ${raffle.minTokens} жетон`, 3000);
                return;
            }

            // Відкриваємо відповідне модальне вікно
            const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
            const modal = document.getElementById(modalId);

            if (!modal) {
                console.error(`Модальне вікно з ID ${modalId} не знайдено`);
                return;
            }

            // Заповнюємо дані для відповідного модального вікна
            if (raffleType === 'main') {
                this.fillMainRaffleModal(raffle);
            } else {
                this.fillDailyRaffleModal(raffle);
            }

            // За замовчуванням встановлюємо 1 жетон
            const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';
            document.getElementById(inputId).value = 1;

            // Змінюємо атрибут для ідентифікації розіграшу при участі
            const joinBtnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
            const joinBtn = document.getElementById(joinBtnId);

            if (joinBtn) {
                joinBtn.setAttribute('data-raffle-id', raffleId);
                joinBtn.setAttribute('data-raffle-type', raffleType);
            }

            // Відкриваємо модальне вікно
            modal.classList.add('open');
        },

        /**
         * Заповнення модального вікна для головного розіграшу
         * @param {Object} raffle - Об'єкт з даними розіграшу
         */
        fillMainRaffleModal: function(raffle) {
            document.getElementById('main-modal-title').textContent = raffle.title || 'Гранд Розіграш';
            document.getElementById('main-prize-value').textContent = raffle.prizeDetails || raffle.prize;

            // Форматуємо дату закінчення
            if (raffle.endTime) {
                const endDate = new Date(raffle.endTime);
                const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
                document.getElementById('main-end-time').textContent = endDate.toLocaleDateString('uk-UA', options);
            } else {
                document.getElementById('main-end-time').textContent = 'Не обмежено часом';
            }

            // Кількість учасників
            document.getElementById('main-participants').textContent =
                `${raffle.currentParticipants || 0}${raffle.maxParticipants ? `/${raffle.maxParticipants}` : ''}`;

            // Опис розіграшу
            document.getElementById('main-description').textContent = raffle.description || '';

            // Зображення розіграшу
            const imageElement = document.getElementById('main-prize-image');
            if (imageElement) {
                imageElement.src = raffle.imageUrl || 'assets/prize-image.mp4';
                imageElement.alt = raffle.title || 'Гранд Розіграш';
            }
        },

        /**
         * Заповнення модального вікна для щоденного розіграшу
         * @param {Object} raffle - Об'єкт з даними розіграшу
         */
        fillDailyRaffleModal: function(raffle) {
            document.getElementById('daily-modal-title').textContent = raffle.title || 'Щоденний розіграш';
            document.getElementById('daily-prize-value').textContent = raffle.prize;

            // Форматуємо дату закінчення
            if (raffle.endTime) {
                const endDate = new Date(raffle.endTime);
                const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
                document.getElementById('daily-end-time').textContent = endDate.toLocaleDateString('uk-UA', options);
            } else {
                document.getElementById('daily-end-time').textContent = 'Не обмежено часом';
            }

            // Кількість учасників
            document.getElementById('daily-participants').textContent = raffle.currentParticipants || 0;

            // Опис розіграшу
            document.getElementById('daily-description').textContent = raffle.description || '';

            // Зображення розіграшу
            const imageElement = document.getElementById('daily-prize-image');
            if (imageElement) {
                imageElement.src = raffle.imageUrl || 'assets/daily-prize.mp4';
                imageElement.alt = raffle.title || 'Щоденний розіграш';
            }
        },

        /**
         * Отримання бонусу для новачків
         */
        claimNewbieBonus: function() {
            // Перевіряємо, чи вже отримував користувач бонус
            if(safeGetItem(STORAGE_KEYS.NEWBIE_BONUS, false)) {
                this.showToast('Ви вже отримали бонус новачка!', 3000);
                return;
            }

            // Показуємо індикатор завантаження
            document.getElementById('loading-spinner').classList.add('show');

            // Імітуємо запит до сервера
            setTimeout(() => {
                try {
                    // Нараховуємо бонус (150 WINIX) через WinixCore, якщо доступно
                    if (window.WinixCore && window.WinixCore.Balance) {
                        window.WinixCore.Balance.addTokens(150, 'Бонус новачка');
                    } else {
                        // Резервний варіант через localStorage
                        const currentTokens = parseFloat(localStorage.getItem('userTokens') || '0');
                        localStorage.setItem('userTokens', (currentTokens + 150).toString());
                    }

                    // Позначаємо, що бонус отримано
                    safeSetItem(STORAGE_KEYS.NEWBIE_BONUS, true);

                    // Оновлюємо відображення балансу
                    if (window.WinixCore && window.WinixCore.UI) {
                        window.WinixCore.UI.updateBalanceDisplay();
                    } else {
                        const currentTokens = parseFloat(localStorage.getItem('userTokens') || '0');
                        document.getElementById('user-tokens').textContent = currentTokens.toFixed(2);
                    }

                    // Знаходимо блок бонусу новачка
                    const newbieRaffleBlock = document.querySelector('.mini-raffle:has(.mini-raffle-button[data-raffle-id="newbie"])');
                    const button = document.querySelector('.mini-raffle-button[data-raffle-id="newbie"]');

                    if (newbieRaffleBlock && button) {
                        // Додаємо клас "виконано" до блоку
                        newbieRaffleBlock.classList.add('completed-task');

                        // Змінюємо стиль блоку для індикації виконаного завдання
                        newbieRaffleBlock.style.background = 'linear-gradient(145deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1))';
                        newbieRaffleBlock.style.borderLeft = '3px solid #4CAF50';

                        // Змінюємо вигляд кнопки
                        button.textContent = 'Отримано ✓';
                        button.disabled = true;
                        button.style.opacity = '0.7';
                        button.style.cursor = 'default';
                        button.style.background = '#4CAF50';

                        // Додаємо відмітку про виконане завдання
                        const titleElement = newbieRaffleBlock.querySelector('.mini-raffle-title');
                        if (titleElement && !titleElement.textContent.includes('✓')) {
                            titleElement.textContent += ' ✓';
                        }

                        // Додаємо анімацію завершення завдання
                        newbieRaffleBlock.style.transition = 'all 0.5s ease';
                        setTimeout(() => {
                            newbieRaffleBlock.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
                            setTimeout(() => {
                                newbieRaffleBlock.style.boxShadow = 'none';
                            }, 1000);
                        }, 100);
                    }

                    // Показуємо повідомлення про успіх
                    this.showToast('Вітаємо! Ви отримали 150 WINIX як бонус новачка!', 3000);

                    // Додатково показуємо повідомлення про виконане завдання
                    setTimeout(() => {
                        this.showToast('Завдання "Бонус новачкам" виконано! ✓', 3000);
                    }, 3500);

                } catch (error) {
                    console.error('Помилка при отриманні бонусу новачка:', error);
                    this.showToast('Сталася помилка при отриманні бонусу', 3000);
                } finally {
                    // Приховуємо індикатор завантаження
                    document.getElementById('loading-spinner').classList.remove('show');
                }
            }, 1500);
        },

        /**
         * Поширення розіграшу
         */
        shareRaffle: function() {
            // Створюємо посилання для поширення
            const shareUrl = window.location.href + '?raffle=main';

            // Якщо доступний API поширення
            if (navigator.share) {
                navigator.share({
                    title: 'Гранд Розіграш WINIX',
                    text: 'Приєднуйтеся до розіграшу 250 USDT та 130,000 WINIX! 10 переможців отримають цінні призи.',
                    url: shareUrl
                })
                .then(() => {
                    this.showToast('Дякуємо за поширення!', 2000);
                    this.checkShareBonus();
                })
                .catch(error => console.log('Помилка поширення:', error));
            } else {
                // Запасний варіант - копіюємо посилання в буфер обміну
                navigator.clipboard.writeText(shareUrl)
                    .then(() => {
                        this.showToast('Посилання на розіграш скопійовано в буфер обміну!', 3000);
                        this.checkShareBonus();
                    })
                    .catch(err => console.error('Помилка при копіюванні:', err));
            }
        },

        /**
         * Перевірка та нарахування бонусу за поширення
         */
        checkShareBonus: function() {
            // Перевіряємо, чи вже було отримано бонус за поширення
            if(safeGetItem(STORAGE_KEYS.SHARE_BONUS, false)) {
                return; // Бонус вже був отриманий
            }

            // Додаємо 1 жетон за поширення через WinixCore
            if (window.WinixCore && window.WinixCore.Balance) {
                window.WinixCore.Balance.addCoins(1);
            } else {
                // Резервний варіант
                const currentCoins = parseInt(localStorage.getItem('userCoins') || '0');
                localStorage.setItem('userCoins', (currentCoins + 1).toString());
            }

            safeSetItem(STORAGE_KEYS.SHARE_BONUS, true);

            // Оновлюємо відображення балансу
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateBalanceDisplay();
            } else {
                const currentCoins = parseInt(localStorage.getItem('userCoins') || '0');
                document.getElementById('user-coins').textContent = currentCoins.toString();
            }

            // Показуємо повідомлення про бонус
            setTimeout(() => {
                this.showToast('Ви отримали +1 жетон за поширення розіграшу!', 3000);
            }, 3500);
        },

        /**
         * Участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @param {string} inputId - ID елементу вводу кількості жетонів
         */
        participateInRaffle: function(raffleId, raffleType, inputId) {
            if (isProcessingRaffle) {
                this.showToast('Вже виконується обробка розіграшу', 2000);
                return;
            }

            isProcessingRaffle = true;

            // Отримуємо кількість жетонів з відповідного поля вводу
            const tokenAmount = parseInt(document.getElementById(inputId).value) || 1;

            // Перевіряємо, чи є достатньо жетонів
            const coinsBalance = parseInt(document.getElementById('user-coins').textContent);

            if (tokenAmount <= 0) {
                this.showToast('Введіть коректну кількість жетонів', 3000);
                isProcessingRaffle = false;
                return;
            }

            if (tokenAmount > 50) {
                this.showToast('Максимальна кількість жетонів: 50', 3000);
                document.getElementById(inputId).value = 50;
                isProcessingRaffle = false;
                return;
            }

            if (coinsBalance < tokenAmount) {
                this.showToast('Недостатньо жетонів для участі', 3000);
                isProcessingRaffle = false;
                return;
            }

            // Показуємо індикатор завантаження
            document.getElementById('loading-spinner').classList.add('show');

            // Отримуємо розіграш
            let raffle;

            if (raffleType === 'main') {
                raffle = this.getRaffleById(raffleId);
            } else {
                const miniRaffles = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, [], true);
                raffle = miniRaffles.find(r => r.id === raffleId);
            }

            if (!raffle) {
                this.showToast('Розіграш не знайдено', 3000);
                document.getElementById('loading-spinner').classList.remove('show');
                isProcessingRaffle = false;
                return;
            }

            // Перевіряємо, чи не закінчився розіграш
            if (raffle.endTime) {
                const endTime = new Date(raffle.endTime);
                const now = new Date();

                if (endTime <= now) {
                    this.showToast('Розіграш вже закінчився', 3000);
                    document.getElementById('loading-spinner').classList.remove('show');
                    isProcessingRaffle = false;
                    return;
                }
            }

            // Імітація запиту до сервера - в реальному додатку тут був би запит
            setTimeout(() => {
                try {
                    // Перевіряємо, чи це перший розіграш для користувача
                    const participatedBefore = safeGetItem(STORAGE_KEYS.FIRST_RAFFLE_BONUS, false);
                    const isFirstRaffle = !participatedBefore;

                    // Зменшуємо баланс жетонів - використовуємо WinixCore, якщо він доступний
                    if (window.WinixCore && window.WinixCore.Balance) {
                        window.WinixCore.Balance.subtractCoins(tokenAmount);
                    } else {
                        // Резервний варіант із localStorage
                        const newCoinsBalance = coinsBalance - tokenAmount;
                        localStorage.setItem('userCoins', newCoinsBalance.toString());
                    }

                    // Якщо це перший розіграш, додаємо бонус 150 WINIX через WinixCore
                    if (isFirstRaffle) {
                        if (window.WinixCore && window.WinixCore.Balance) {
                            window.WinixCore.Balance.addTokens(150, 'Бонус за першу участь у розіграші');
                        } else {
                            // Резервний варіант із localStorage
                            const currentTokens = parseFloat(localStorage.getItem('userTokens') || '0');
                            localStorage.setItem('userTokens', (currentTokens + 150).toString());
                        }
                        safeSetItem(STORAGE_KEYS.FIRST_RAFFLE_BONUS, true);
                    }

                    // Оновлюємо дані розіграшу в залежності від типу
                    if (raffleType === 'main') {
                        const rafflesData = safeGetItem(STORAGE_KEYS.RAFFLES_DATA, [], true);

                        const updatedRafflesData = rafflesData.map(r => {
                            if (r.id === raffleId) {
                                return {
                                    ...r,
                                    currentParticipants: (r.currentParticipants || 0) + 1
                                };
                            }
                            return r;
                        });

                        // Зберігаємо оновлені дані
                        safeSetItem(STORAGE_KEYS.RAFFLES_DATA, updatedRafflesData);
                    } else {
                        // Оновлюємо дані міні-розіграшу
                        const miniRafflesData = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, [], true);

                        const updatedMiniRafflesData = miniRafflesData.map(r => {
                            if (r.id === raffleId) {
                                return {
                                    ...r,
                                    currentParticipants: (r.currentParticipants || 0) + 1
                                };
                            }
                            return r;
                        });

                        // Зберігаємо оновлені дані
                        safeSetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, updatedMiniRafflesData);
                    }

                    // Додаємо розіграш до списку участі користувача
                    const userRaffles = safeGetItem(STORAGE_KEYS.USER_RAFFLES, { participating: [], won: [] }, true);

                    // Перевіряємо, чи користувач вже бере участь у цьому розіграші
                    const alreadyParticipating = userRaffles.participating.some(r => r.raffleId === raffleId);

                    if (alreadyParticipating) {
                        // Оновлюємо кількість жетонів
                        userRaffles.participating = userRaffles.participating.map(r => {
                            if (r.raffleId === raffleId) {
                                return {
                                    ...r,
                                    tokenAmount: r.tokenAmount + tokenAmount
                                };
                            }
                            return r;
                        });
                    } else {
                        // Додаємо новий запис
                        userRaffles.participating.push({
                            raffleId,
                            title: raffle.title,
                            tokenAmount,
                            raffleType,
                            participationTime: new Date().toISOString()
                        });
                    }

                    // Зберігаємо оновлені дані користувача
                    safeSetItem(STORAGE_KEYS.USER_RAFFLES, userRaffles);

                    // Оновлюємо статистику участі
                    this.updateParticipationStatistics(tokenAmount);

                    // Оновлюємо відображення балансу
                    if (window.WinixCore && window.WinixCore.UI) {
                        window.WinixCore.UI.updateBalanceDisplay(); // Використовуємо функцію WinixCore, якщо доступна
                    } else {
                        // Резервний варіант оновлення UI
                        const newCoinsBalance = coinsBalance - tokenAmount;
                        document.getElementById('user-coins').textContent = newCoinsBalance.toString();

                        // Якщо був нарахований бонус за перший розіграш, оновлюємо відображення балансу токенів
                        if (isFirstRaffle) {
                            const newTokenBalance = parseFloat(localStorage.getItem('userTokens') || '0');
                            document.getElementById('user-tokens').textContent = newTokenBalance.toFixed(2);
                        }
                    }

                    // Оновлюємо дані про розіграш на сторінці
                    this.updateRaffleParticipation(raffleId, raffleType);

                    // Закриваємо модальне вікно
                    const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
                    document.getElementById(modalId).classList.remove('open');

                    // Формуємо повідомлення про успіх
                    let message = `Ви успішно взяли участь у розіграші ${tokenAmount > 1 ? `з ${tokenAmount} жетонами` : ''}`;
                    this.showToast(message, 3000);

                    // Якщо це перший розіграш, показуємо додаткове повідомлення про бонус
                    if (isFirstRaffle) {
                        setTimeout(() => {
                            this.showToast('Вітаємо! Ви отримали 150 WINIX як бонус за першу участь у розіграші!', 4000);
                        }, 3500);
                    }

                    // Додаємо запис в історію розіграшів
                    this.addToRaffleHistory(raffleId, raffleType, tokenAmount);
                } catch (error) {
                    console.error('Помилка при участі в розіграші:', error);
                    this.showToast('Сталася помилка при участі в розіграші', 3000);
                } finally {
                    // Приховуємо індикатор завантаження
                    document.getElementById('loading-spinner').classList.remove('show');
                    isProcessingRaffle = false;
                }
            }, 1500);
        },

        /**
         * Додавання запису в історію розіграшів
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @param {number} tokenAmount - Кількість використаних жетонів
         */
        addToRaffleHistory: function(raffleId, raffleType, tokenAmount) {
            // Отримуємо дані про розіграш
            let raffle;

            if (raffleType === 'main') {
                raffle = this.getRaffleById(raffleId);
            } else {
                const miniRaffles = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, [], true);
                raffle = miniRaffles.find(r => r.id === raffleId);
            }

            if (!raffle) return;

            // Отримуємо поточну історію
            const history = safeGetItem(STORAGE_KEYS.RAFFLE_HISTORY, [], true);

            // Додаємо новий запис
            history.push({
                id: generateId(),
                title: raffle.title,
                prize: raffle.prize,
                date: new Date().toISOString(),
                status: 'participated',
                participated: true,
                tokenAmount: tokenAmount
            });

            // Зберігаємо оновлену історію
            safeSetItem(STORAGE_KEYS.RAFFLE_HISTORY, history);
        },

        /**
         * Оновлення даних про розіграш після участі
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         */
        updateRaffleParticipation: function(raffleId, raffleType) {
            if (raffleType === 'main') {
                // Оновлюємо відображення на сторінці для головного розіграшу
                const participantsElement = document.querySelector('.participants-count');
                if (participantsElement) {
                    const [current, total] = participantsElement.textContent.split('/');
                    const newCurrent = parseInt(current) + 1;
                    participantsElement.textContent = `${newCurrent}/${total}`;

                    // Оновлюємо прогрес-бар
                    const progressBar = document.querySelector('.progress');
                    if (progressBar) {
                        const progressPercent = (newCurrent / parseInt(total)) * 100;
                        progressBar.style.width = `${progressPercent}%`;
                    }

                    // Оновлюємо відображення в модальному вікні
                    const modalParticipants = document.getElementById('main-participants');
                    if (modalParticipants) {
                        modalParticipants.textContent = `${newCurrent}/${total}`;
                    }
                }
            } else if (raffleType === 'daily') {
                // Оновлюємо відображення для щоденного розіграшу
                const dailyParticipants = document.getElementById('daily-participants');
                if (dailyParticipants) {
                    const currentParticipants = parseInt(dailyParticipants.textContent);
                    dailyParticipants.textContent = currentParticipants + 1;
                }
            }
        },

        /**
         * Оновлення статистики участі
         * @param {number} tokenAmount - Кількість жетонів для участі
         */
        updateParticipationStatistics: function(tokenAmount) {
            // Отримуємо статистику
            const statistics = safeGetItem(STORAGE_KEYS.RAFFLE_STATISTICS, {
                participationsCount: 0,
                winsCount: 0,
                totalWinnings: 0,
                referralsCount: 0
            }, true);

            // Оновлюємо кількість участей
            statistics.participationsCount += 1;

            // Оновлюємо відображення статистики на сторінці
            document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = statistics.participationsCount;

            // Перевіряємо досягнення і видаємо відповідні бейджі та нагороди
            this.checkBadgeAchievements(statistics.participationsCount);

            // Зберігаємо оновлену статистику
            safeSetItem(STORAGE_KEYS.RAFFLE_STATISTICS, statistics);
        },

        /**
         * Перевірка та нагородження за досягнення бейджів
         * @param {number} participationsCount - Кількість участей в розіграшах
         */
        checkBadgeAchievements: function(participationsCount) {
            // Отримуємо дані про бейджі
            const badges = safeGetItem(STORAGE_KEYS.BADGE_REWARDS, [], true);

            // Оновлюємо бейджі на основі статистики
            let updatedBadges = [...badges];

            // Перевіряємо бейдж "Початківець" - за участь у 5 розіграшах
            if (participationsCount >= 5) {
                const beginnerBadgeIndex = updatedBadges.findIndex(badge => badge.id === 'beginner');

                if (beginnerBadgeIndex !== -1 && !updatedBadges[beginnerBadgeIndex].unlocked) {
                    // Розблоковуємо бейдж
                    updatedBadges[beginnerBadgeIndex].unlocked = true;

                    // Оновлюємо відображення бейджу на сторінці
                    const beginnerBadge = document.querySelector('.badge-item:nth-child(2) .badge-icon');
                    if (beginnerBadge && beginnerBadge.classList.contains('locked')) {
                        beginnerBadge.classList.remove('locked');
                    }

                    // Виводимо повідомлення про розблокування і нагороду
                    setTimeout(() => {
                        const reward = updatedBadges[beginnerBadgeIndex].reward;
                        this.showToast(`Вітаємо! Ви розблокували бейдж "${updatedBadges[beginnerBadgeIndex].name}" і отримали ${reward} WINIX!`, 5000);

                        // Нараховуємо нагороду, якщо вона ще не була нарахована
                        if (!updatedBadges[beginnerBadgeIndex].rewardClaimed) {
                            // Нараховуємо нагороду через WinixCore
                            if (window.WinixCore && window.WinixCore.Balance) {
                                window.WinixCore.Balance.addTokens(
                                    reward,
                                    `Нагорода за бейдж "${updatedBadges[beginnerBadgeIndex].name}"`
                                );
                            } else {
                                // Резервний варіант
                                const currentTokens = parseFloat(localStorage.getItem('userTokens') || '0');
                                localStorage.setItem('userTokens', (currentTokens + reward).toString());

                                // Оновлюємо відображення балансу токенів
                                document.getElementById('user-tokens').textContent =
                                    (currentTokens + reward).toFixed(2);
                            }

                            // Позначаємо, що нагорода видана
                            updatedBadges[beginnerBadgeIndex].rewardClaimed = true;
                        }
                    }, 2000);
                }
            }

            // Перевіряємо бейдж "Постійний учасник" - за участь у 20 розіграшах
            if (participationsCount >= 20) {
                const regularBadgeIndex = updatedBadges.findIndex(badge => badge.id === 'regular');

                if (regularBadgeIndex !== -1 && !updatedBadges[regularBadgeIndex].unlocked) {
                    // Розблоковуємо бейдж
                    updatedBadges[regularBadgeIndex].unlocked = true;

                    // Виводимо повідомлення про розблокування і нагороду
                    setTimeout(() => {
                        const reward = updatedBadges[regularBadgeIndex].reward;
                        this.showToast(`Вітаємо! Ви розблокували бейдж "${updatedBadges[regularBadgeIndex].name}" і отримали ${reward} WINIX!`, 5000);

                        // Нараховуємо нагороду, якщо вона ще не була нарахована
                        if (!updatedBadges[regularBadgeIndex].rewardClaimed) {
                            // Нараховуємо нагороду через WinixCore
                            if (window.WinixCore && window.WinixCore.Balance) {
                                window.WinixCore.Balance.addTokens(
                                    reward,
                                    `Нагорода за бейдж "${updatedBadges[regularBadgeIndex].name}"`
                                );
                            } else {
                                // Резервний варіант
                                const currentTokens = parseFloat(localStorage.getItem('userTokens') || '0');
                                localStorage.setItem('userTokens', (currentTokens + reward).toString());

                                // Оновлюємо відображення балансу токенів
                                document.getElementById('user-tokens').textContent =
                                    (currentTokens + reward).toFixed(2);
                            }

                            // Позначаємо, що нагорода видана
                            updatedBadges[regularBadgeIndex].rewardClaimed = true;
                        }
                    }, 3500);
                }
            }

            // Зберігаємо оновлені дані про бейджі
            safeSetItem(STORAGE_KEYS.BADGE_REWARDS, updatedBadges);

            // Оновлюємо відображення бейджів
            this.updateBadgesDisplay();
        },

        /**
         * Оновлення відображення статистики
         */
        updateStatisticsDisplay: function() {
            // Отримуємо статистику
            const statistics = safeGetItem(STORAGE_KEYS.RAFFLE_STATISTICS, {
                participationsCount: 8,
                winsCount: 2,
                totalWinnings: 32500,
                referralsCount: 3
            }, true);

            try {
                // Оновлюємо відображення на сторінці
                document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = statistics.participationsCount;
                document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = statistics.winsCount;
                document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = statistics.totalWinnings.toLocaleString();
                document.querySelector('.stat-card:nth-child(4) .stat-value').textContent = statistics.referralsCount;
            } catch (error) {
                console.error('Помилка при оновленні відображення статистики:', error);
            }
        },

        /**
         * Оновлення відображення бейджів
         */
        updateBadgesDisplay: function() {
            try {
                // Отримуємо дані про бейджі
                const badges = safeGetItem(STORAGE_KEYS.BADGE_REWARDS, [], true);

                // Отримуємо контейнер для бейджів
                const badgesContainer = document.querySelector('.badges-grid');
                if (!badgesContainer) return;

                // Очищаємо контейнер
                badgesContainer.innerHTML = '';

                // Додаємо перші три бейджі (більше не показуємо, оскільки в HTML їх 3)
                const displayBadges = badges.slice(0, 3);

                displayBadges.forEach(badge => {
                    const badgeElement = document.createElement('div');
                    badgeElement.className = 'badge-item';

                    badgeElement.innerHTML = `
                        <div class="badge-icon${badge.unlocked ? '' : ' locked'}">${badge.icon}</div>
                        <div class="badge-name">${badge.name}</div>
                        <div class="badge-desc">${badge.description}</div>
                        <div class="badge-reward">+${badge.reward.toLocaleString()} WINIX</div>
                    `;

                    badgesContainer.appendChild(badgeElement);
                });

            } catch (error) {
                console.error('Помилка при оновленні відображення бейджів:', error);
            }
        },

        /**
         * Відображення повідомлення
         * @param {string} message - Текст повідомлення
         * @param {number} duration - Тривалість відображення в мілісекундах
         */
        showToast: function(message, duration = 3000) {
            const toast = document.getElementById('toast-message');
            if (!toast) return;

            toast.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        },

        /**
         * Отримання всіх активних розіграшів
         * @returns {Array} - Масив об'єктів розіграшів
         */
        getActiveRaffles: function() {
            const rafflesData = safeGetItem(STORAGE_KEYS.RAFFLES_DATA, [], true);

            // Фільтруємо тільки активні розіграші (не закінчились)
            const now = new Date();

            return rafflesData.filter(raffle => {
                const endTime = new Date(raffle.endTime);
                return endTime > now;
            });
        },

        /**
         * Отримання розіграшу за ID
         * @param {string} raffleId - ID розіграшу
         * @returns {Object|null} - Об'єкт розіграшу або null, якщо не знайдено
         */
        getRaffleById: function(raffleId) {
            const rafflesData = safeGetItem(STORAGE_KEYS.RAFFLES_DATA, [], true);
            return rafflesData.find(raffle => raffle.id === raffleId) || null;
        },

        /**
         * Отримання міні-розіграшу за ID
         * @param {string} raffleId - ID міні-розіграшу
         * @returns {Object|null} - Об'єкт міні-розіграшу або null, якщо не знайдено
         */
        getMiniRaffleById: function(raffleId) {
            const miniRafflesData = safeGetItem(STORAGE_KEYS.MINI_RAFFLES_DATA, [], true);
            return miniRafflesData.find(raffle => raffle.id === raffleId) || null;
        },

        /**
         * Отримання історії розіграшів користувача
         * @returns {Array} - Масив об'єктів історії розіграшів
         */
        getRaffleHistory: function() {
            return safeGetItem(STORAGE_KEYS.RAFFLE_HISTORY, [], true);
        },

        /**
         * Автоматичний вибір переможців (логіка вибору переможців)
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @param {number} winnersCount - Кількість переможців
         * @returns {Array} - Масив переможців
         */
        selectRaffleWinners: function(raffleId, raffleType, winnersCount) {
            // Отримуємо дані про участь користувачів у розіграші
            const userRaffles = safeGetItem(STORAGE_KEYS.USER_RAFFLES, { participating: [], won: [] }, true);

            // Знаходимо всіх учасників цього розіграшу
            const raffleParticipants = userRaffles.participating.filter(
                participant => participant.raffleId === raffleId
            );

            // Якщо немає учасників, повертаємо порожній масив
            if (raffleParticipants.length === 0) return [];

            // Створюємо масив білетів (чим більше жетонів - тим більше шансів)
            let tickets = [];

            raffleParticipants.forEach(participant => {
                // Додаємо учасника стільки разів, скільки у нього жетонів
                for (let i = 0; i < participant.tokenAmount; i++) {
                    tickets.push(participant);
                }
            });

            // Перемішуємо масив білетів випадковим чином
            tickets = this.shuffleArray(tickets);

            // Обираємо переможців (перші N учасників з перемішаного масиву)
            // При цьому перевіряємо унікальність, щоб один користувач не виграв кілька разів
            const winners = [];
            const winnerIds = new Set();

            for (const ticket of tickets) {
                // Якщо цей користувач ще не серед переможців, додаємо його
                if (!winnerIds.has(ticket.userId)) {
                    winnerIds.add(ticket.userId);
                    winners.push(ticket);

                    // Якщо обрали потрібну кількість переможців, завершуємо
                    if (winners.length >= winnersCount) break;
                }
            }

            console.log(`Обрано ${winners.length} переможців розіграшу ${raffleId}`);
            return winners;
        },

        /**
         * Випадкове перемішування масиву (алгоритм Фішера–Єйтса)
         * @param {Array} array - Масив для перемішування
         * @returns {Array} - Перемішаний масив
         */
        shuffleArray: function(array) {
            const newArray = [...array];

            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }

            return newArray;
        }
    };

    // Експортуємо об'єкт для використання на сторінці
    window.WinixRaffles = RafflesManager;

    // Автоматична ініціалізація при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Ініціалізуємо систему розіграшів
        RafflesManager.init();
    });

    // Якщо DOM вже завантажено, ініціалізуємо одразу
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        // Ініціалізуємо систему розіграшів
        RafflesManager.init();
    }

    console.log("🎲 WINIX-RAFFLES: Модуль розіграшів готовий до використання");
})();