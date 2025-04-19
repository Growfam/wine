/**
 * WINIX - Система розіграшів (statistics.js)
 * Модуль для роботи зі статистикою розіграшів користувача
 * Виправлена версія з покращеною обробкою даних профілю
 * @version 1.1.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше statistics.js');
        return;
    }

    // Підмодуль для статистики розіграшів
    const statistics = {
        // Дані статистики
        statsData: null,

        // Дані профілю (окремо від статистики для кращої діагностики)
        profileData: null,

        // Останній час оновлення
        lastUpdate: 0,

        // Інтервал кешування (5 хвилин)
        cacheInterval: 5 * 60 * 1000,

        // Лічильник спроб завантаження
        loadAttempts: 0,

        // Максимальна кількість спроб завантаження
        maxLoadAttempts: 3,

        // Ініціалізація модуля
        init: function() {
            console.log('📊 Ініціалізація модуля статистики розіграшів...');

            // Очищаємо лічильник спроб
            this.loadAttempts = 0;

            // Перевіряємо, чи потрібно відразу завантажити статистику
            if (WinixRaffles.state.activeTab === 'stats') {
                this.loadStatistics();
            }

            // Додаємо обробники подій
            this.setupEventListeners();
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для оновлення статистики при оновленні даних користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    // Перевіряємо, чи активна вкладка статистики
                    if (WinixRaffles.state.activeTab === 'stats') {
                        // Оновлюємо статистику із затримкою для уникнення конфліктів
                        setTimeout(() => {
                            this.loadStatistics(true);
                        }, 1000);
                    }
                }
            });

            // Обробник для оновлення статистики при успішній участі
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    // Оновлюємо кеш статистики як застарілий
                    this.lastUpdate = 0;
                }
            });
        },

        // Завантаження статистики розіграшів
        loadStatistics: async function(forceRefresh = false) {
            const userId = WinixRaffles.state.telegramId ||
                          (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function'
                           ? window.WinixAPI.getUserId() : null);

            if (!userId) {
                console.error('❌ Не вдалося визначити ID користувача для завантаження статистики');
                this.renderEmptyStatistics();
                return;
            }

            // Перевіряємо чи потрібно оновлювати кеш
            const now = Date.now();
            if (!forceRefresh && now - this.lastUpdate < this.cacheInterval && this.statsData) {
                console.log('📊 Використовуємо кешовану статистику розіграшів');
                this.renderStatistics(this.statsData);
                return;
            }

            // Збільшуємо лічильник спроб
            this.loadAttempts++;

            if (typeof window.showLoading === 'function') {
                window.showLoading();
            }

            try {
                console.log('📊 Завантаження статистики розіграшів...');

                // Отримуємо дані профілю користувача
                let response;

                // Перевіряємо наявність методу отримання даних користувача
                if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                    response = await window.WinixAPI.getUserData(true);
                } else if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                    // Запасний варіант - прямий запит до API
                    response = await window.WinixAPI.apiRequest(`user/${userId}/profile`, 'GET', null, {
                        suppressErrors: true,
                        timeout: 10000
                    });
                } else {
                    // Якщо API недоступне, пробуємо використати fetch
                    try {
                        const fetchResponse = await fetch(`/api/user/${userId}/profile`);
                        response = await fetchResponse.json();
                    } catch (fetchError) {
                        console.error('❌ Помилка fetch запиту:', fetchError);
                        throw new Error('API недоступне');
                    }
                }

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Зберігаємо повну відповідь для діагностики
                this.profileData = response;
                console.log('📊 Отримані дані профілю:', response);

                // Перевіряємо структуру відповіді
                if (response && response.status === 'success' && response.data) {
                    // Зберігаємо дані для статистики
                    this.statsData = this.extractStatisticsData(response.data);
                    this.lastUpdate = now;

                    // Зберігаємо в локальному сховищі
                    try {
                        localStorage.setItem('winix_raffle_statistics', JSON.stringify({
                            timestamp: now,
                            data: this.statsData
                        }));
                    } catch (e) {
                        console.warn('⚠️ Не вдалося зберегти статистику в локальному сховищі:', e);
                    }

                    // Скидаємо лічильник спроб після успішного завантаження
                    this.loadAttempts = 0;

                    // Відображаємо статистику
                    this.renderStatistics(this.statsData);

                    // Генеруємо подію про оновлення статистики
                    document.dispatchEvent(new CustomEvent('stats-updated', {
                        detail: { statsData: this.statsData }
                    }));
                } else if (response && response.status === 'error') {
                    console.error('❌ Помилка завантаження статистики:', response.message);
                    this.tryLoadFromLocalStorage();

                    // Спробуємо повторно завантажити через деякий час, якщо це не остання спроба
                    if (this.loadAttempts < this.maxLoadAttempts) {
                        setTimeout(() => {
                            this.loadStatistics(true);
                        }, 3000);
                    }
                } else {
                    console.error('❌ Неправильний формат відповіді:', response);
                    this.tryLoadFromLocalStorage();
                }
            } catch (error) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                console.error('❌ Помилка завантаження статистики розіграшів:', error);
                this.tryLoadFromLocalStorage();

                // Спробуємо повторно завантажити через деякий час, якщо це не остання спроба
                if (this.loadAttempts < this.maxLoadAttempts) {
                    setTimeout(() => {
                        this.loadStatistics(true);
                    }, 3000);
                }
            }
        },

        /**
         * Витягування даних статистики з профілю користувача
         * @param {Object} profileData - Дані профілю користувача
         * @returns {Object} - Дані статистики
         */
        extractStatisticsData: function(profileData) {
            // Створюємо об'єкт для даних статистики
            const statsData = {};

            // Копіюємо базові поля статистики
            if (profileData.participations_count !== undefined) {
                statsData.participations_count = profileData.participations_count;
            } else if (profileData.raffles_count !== undefined) {
                // Альтернативне поле
                statsData.participations_count = profileData.raffles_count;
            } else if (profileData.raffles && Array.isArray(profileData.raffles)) {
                // Якщо є масив розіграшів, рахуємо їх кількість
                statsData.participations_count = profileData.raffles.length;
            } else {
                statsData.participations_count = 0;
            }

            // Кількість виграшів
            if (profileData.wins_count !== undefined) {
                statsData.wins_count = profileData.wins_count;
            } else if (profileData.wins !== undefined) {
                statsData.wins_count = profileData.wins;
            } else {
                statsData.wins_count = 0;
            }

            // Загальна сума виграшів
            if (profileData.total_winnings !== undefined) {
                statsData.total_winnings = profileData.total_winnings;
            } else if (profileData.winnings !== undefined) {
                statsData.total_winnings = profileData.winnings;
            } else if (profileData.winnings_total !== undefined) {
                statsData.total_winnings = profileData.winnings_total;
            } else {
                // Приблизний розрахунок
                statsData.total_winnings = statsData.wins_count * 15000;
            }

            // Витрачені жетони
            if (profileData.tokens_spent !== undefined) {
                statsData.tokens_spent = profileData.tokens_spent;
            } else if (profileData.spent_tokens !== undefined) {
                statsData.tokens_spent = profileData.spent_tokens;
            } else if (profileData.coins_spent !== undefined) {
                statsData.tokens_spent = profileData.coins_spent;
            } else {
                // Приблизний розрахунок (в середньому 2 жетони за участь)
                statsData.tokens_spent = statsData.participations_count * 2;
            }

            // Додаткові дані статистики
            if (profileData.coins !== undefined) {
                statsData.coins = profileData.coins;
            }

            if (profileData.balance !== undefined) {
                statsData.balance = profileData.balance;
            }

            console.log('📊 Витягнуті дані статистики:', statsData);
            return statsData;
        },

        // Спроба завантажити статистику з локального сховища
        tryLoadFromLocalStorage: function() {
            try {
                const storedStats = localStorage.getItem('winix_raffle_statistics');
                if (storedStats) {
                    const parsedStats = JSON.parse(storedStats);
                    if (parsedStats && parsedStats.data) {
                        console.log('📊 Використовуємо статистику з локального сховища');
                        this.statsData = parsedStats.data;
                        this.renderStatistics(this.statsData);
                        return;
                    }
                }

                // Перевіряємо, чи є збережені дані участі
                this.tryExtractStatsFromParticipation();
            } catch (e) {
                console.warn('⚠️ Помилка завантаження статистики з локального сховища:', e);
                this.tryExtractStatsFromParticipation();
            }
        },

        /**
         * Спроба отримати статистику з даних про участь
         */
        tryExtractStatsFromParticipation: function() {
            // Перевіряємо наявність даних про участь
            if (WinixRaffles.participation && WinixRaffles.participation.participatingRaffles) {
                const participationCount = WinixRaffles.participation.participatingRaffles.size || 0;

                if (participationCount > 0) {
                    console.log('📊 Використовуємо дані про участь для статистики');

                    // Створюємо базову статистику на основі даних про участь
                    const statsData = {
                        participations_count: participationCount,
                        wins_count: 0, // Не можемо визначити
                        total_winnings: 0, // Не можемо визначити
                        tokens_spent: participationCount * 2 // Приблизна оцінка
                    };

                    this.statsData = statsData;
                    this.renderStatistics(statsData);
                    return;
                }
            }

            // Якщо не вдалося завантажити з жодного джерела
            this.renderEmptyStatistics();
        },

        // Відображення статистики розіграшів
        renderStatistics: function(userData) {
            if (!userData) {
                this.renderEmptyStatistics();
                return;
            }

            // Логуємо дані, що будуть відображатися
            console.log('📊 Відображення статистики:', userData);

            // Оновлюємо значення в блоках статистики
            this.updateStatValue('total-participated', userData.participations_count || 0);
            this.updateStatValue('total-wins', userData.wins_count || 0);
            this.updateStatValue('total-winix-won', userData.total_winnings || 0);
            this.updateStatValue('total-tokens-spent', userData.tokens_spent || 0);

            // Додатково оновлюємо баланс користувача, якщо він є
            if (userData.coins !== undefined) {
                const userCoinsElement = document.getElementById('user-coins');
                if (userCoinsElement) {
                    userCoinsElement.textContent = userData.coins;
                }
            }

            // Створюємо графік активності, якщо є контейнер
            this.createActivityChart();

            // Додаємо клас для анімації оновлення
            document.querySelectorAll('.stat-card').forEach(card => {
                card.classList.add('updated');

                // Видаляємо клас через 1 секунду
                setTimeout(() => {
                    card.classList.remove('updated');
                }, 1000);
            });
        },

        // Оновлення значення статистики
        updateStatValue: function(elementId, value) {
            const element = document.getElementById(elementId);
            if (element) {
                // Запам'ятовуємо старе значення для анімації
                const oldValue = element.textContent;

                // Форматуємо число з розділювачами
                const formattedValue = typeof value === 'number' ?
                    value.toLocaleString('uk-UA') : value;

                // Оновлюємо значення
                element.textContent = formattedValue;

                // Додаємо анімацію, якщо значення змінилося
                if (oldValue !== formattedValue) {
                    element.classList.add('stat-updated');

                    // Видаляємо клас через 1 секунду
                    setTimeout(() => {
                        element.classList.remove('stat-updated');
                    }, 1000);
                }
            } else {
                console.warn(`⚠️ Елемент з ID "${elementId}" не знайдено для оновлення статистики`);
            }
        },

        // Створення графіку активності
        createActivityChart: function() {
            const chartContainer = document.querySelector('.chart-placeholder');
            if (!chartContainer) {
                console.warn('⚠️ Контейнер для графіка не знайдено');
                return;
            }

            // Якщо немає достатньо даних для графіка
            if (!this.statsData || !this.statsData.participations_count) {
                chartContainer.innerHTML = '<span>Недостатньо даних для відображення графіку активності</span>';
                return;
            }

            // Створюємо прості демонстраційні дані для графіка
            const wins = this.statsData.wins_count || 0;
            const participations = this.statsData.participations_count || 0;
            const nonWinParticipations = participations - wins;

            // Перевіряємо наявність об'єкта Chart для створення графіка
            if (typeof Chart === 'undefined') {
                // Якщо Chart.js недоступний, створюємо простий графік через div
                chartContainer.innerHTML = `
                    <div class="simple-chart">
                        <div class="chart-bar">
                            <div class="chart-bar-inner wins" style="height: ${wins * 10}px;"></div>
                            <div class="chart-bar-label">Перемоги (${wins})</div>
                        </div>
                        <div class="chart-bar">
                            <div class="chart-bar-inner participations" style="height: ${nonWinParticipations * 5}px;"></div>
                            <div class="chart-bar-label">Участі без виграшу (${nonWinParticipations})</div>
                        </div>
                    </div>
                `;

                // Додаємо стилі для простого графіка
                const style = document.createElement('style');
                style.textContent = `
                    .simple-chart {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        height: 180px;
                        align-items: flex-end;
                        margin: 20px 0;
                    }
                    
                    .chart-bar {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        height: 100%;
                    }
                    
                    .chart-bar-inner {
                        width: 40px;
                        min-height: 10px;
                        border-radius: 4px 4px 0 0;
                    }
                    
                    .chart-bar-inner.wins {
                        background: linear-gradient(to top, #4CAF50, #81C784);
                    }
                    
                    .chart-bar-inner.participations {
                        background: linear-gradient(to top, #2196F3, #64B5F6);
                    }
                    
                    .chart-bar-label {
                        margin-top: 5px;
                        font-size: 0.8rem;
                        color: var(--text-secondary);
                        text-align: center;
                    }
                    
                    /* Нові стилі для анімації оновлення */
                    @keyframes stat-update-animation {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                    
                    .stat-updated {
                        animation: stat-update-animation 0.5s ease-in-out;
                        color: #4CAF50 !important;
                    }
                    
                    .stat-card.updated {
                        transition: all 0.3s ease;
                        box-shadow: 0 0 10px rgba(0, 201, 167, 0.5);
                    }
                `;
                document.head.appendChild(style);
            } else {
                // Тут мав би бути код для створення графіка через Chart.js
                // Але оскільки ми не включили Chart.js у залежності, залишаємо простий графік
                chartContainer.innerHTML = '<span>Для відображення детального графіка необхідна бібліотека Chart.js</span>';
            }
        },

        // Відображення порожньої статистики
        renderEmptyStatistics: function() {
            // Встановлюємо нульові значення для всіх полів статистики
            this.updateStatValue('total-participated', 0);
            this.updateStatValue('total-wins', 0);
            this.updateStatValue('total-winix-won', 0);
            this.updateStatValue('total-tokens-spent', 0);

            // Оновлюємо графік
            const chartContainer = document.querySelector('.chart-placeholder');
            if (chartContainer) {
                chartContainer.innerHTML = '<span>Недостатньо даних для відображення графіку активності</span>';
            }

            // Показуємо повідомлення про відсутність даних
            if (typeof window.showToast === 'function' && this.loadAttempts >= this.maxLoadAttempts) {
                window.showToast('Не вдалося завантажити статистику. Спробуйте пізніше.', 'warning');
            }
        },

        // Оновлення даних статистики
        refreshStatistics: function() {
            // Скидаємо лічильник спроб
            this.loadAttempts = 0;

            // Завантажуємо статистику з примусовим оновленням
            this.loadStatistics(true);
        },

        // Діагностична функція для отримання даних про профіль
        getProfileDiagnostics: function() {
            return {
                profileData: this.profileData,
                statsData: this.statsData,
                lastUpdate: this.lastUpdate,
                loadAttempts: this.loadAttempts
            };
        }
    };

    // Додаємо модуль статистики до основного модуля розіграшів
    WinixRaffles.statistics = statistics;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (WinixRaffles.state.isInitialized) {
            statistics.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                statistics.init();
            });
        }
    });
})();