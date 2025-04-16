/**
 * WINIX - Система розіграшів (statistics.js)
 * Модуль для роботи зі статистикою розіграшів користувача
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

        // Останній час оновлення
        lastUpdate: 0,

        // Інтервал кешування (5 хвилин)
        cacheInterval: 5 * 60 * 1000,

        // Ініціалізація модуля
        init: function() {
            console.log('📊 Ініціалізація модуля статистики розіграшів...');

            // Перевіряємо, чи потрібно відразу завантажити статистику
            if (WinixRaffles.state.activeTab === 'stats') {
                this.loadStatistics();
            }
        },

        // Завантаження статистики розіграшів
        loadStatistics: async function(forceRefresh = false) {
            const userId = WinixRaffles.state.telegramId || WinixAPI.getUserId();

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

            window.showLoading();

            try {
                console.log('📊 Завантаження статистики розіграшів...');

                // Отримуємо повні дані профілю користувача, які містять статистику
                const response = await WinixAPI.getUserData(true);

                window.hideLoading();

                if (response.status === 'success' && response.data) {
                    this.statsData = response.data;
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

                    this.renderStatistics(this.statsData);
                } else if (response.status === 'error') {
                    console.error('❌ Помилка завантаження статистики:', response.message);
                    this.tryLoadFromLocalStorage();
                } else {
                    console.error('❌ Неправильний формат відповіді:', response);
                    this.tryLoadFromLocalStorage();
                }
            } catch (error) {
                window.hideLoading();
                console.error('❌ Помилка завантаження статистики розіграшів:', error);
                this.tryLoadFromLocalStorage();
            }
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
            } catch (e) {
                console.warn('⚠️ Помилка завантаження статистики з локального сховища:', e);
            }

            // Якщо не вдалося завантажити з локального сховища
            this.renderEmptyStatistics();
        },

        // Відображення статистики розіграшів
        renderStatistics: function(userData) {
            if (!userData) {
                this.renderEmptyStatistics();
                return;
            }

            // Оновлюємо значення в блоках статистики
            this.updateStatValue('total-participated', userData.participations_count || 0);
            this.updateStatValue('total-wins', userData.wins_count || 0);

            // Обчислюємо загальну суму виграшів
            let totalWinnings = 0;
            if (userData.total_winnings) {
                // Якщо є в даних
                totalWinnings = userData.total_winnings;
            } else if (userData.wins_count) {
                // Прибл. розрахунок, якщо немає точних даних
                totalWinnings = userData.wins_count * 15000;
            }
            this.updateStatValue('total-winix-won', totalWinnings);

            // Обчислюємо витрачені жетони
            let tokensSpent = 0;
            if (userData.tokens_spent) {
                // Якщо є в даних
                tokensSpent = userData.tokens_spent;
            } else if (userData.participations_count) {
                // Прибл. розрахунок, якщо немає точних даних (середнє 2 жетони за участь)
                tokensSpent = userData.participations_count * 2;
            }
            this.updateStatValue('total-tokens-spent', tokensSpent);

            // Створюємо графік активності, якщо є контейнер
            this.createActivityChart();
        },

        // Оновлення значення статистики
        updateStatValue: function(elementId, value) {
            const element = document.getElementById(elementId);
            if (element) {
                // Форматуємо число з розділювачами
                element.textContent = typeof value === 'number' ?
                    value.toLocaleString('uk-UA') : value;
            }
        },

        // Створення графіку активності
        createActivityChart: function() {
            const chartContainer = document.querySelector('.chart-placeholder');
            if (!chartContainer) return;

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
        },

        // Оновлення даних статистики
        refreshStatistics: function() {
            this.loadStatistics(true);
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