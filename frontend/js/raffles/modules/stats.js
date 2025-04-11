/**
 * stats.js - Модуль для роботи зі статистикою розіграшів
 * Відповідає за обчислення і відображення статистики розіграшів для користувача
 */

import { formatCurrency, formatNumber } from './formatters.js';
import { showToast } from '../../ui.js';
import WinixAPI from '../../api.js';

class RaffleStats {
    constructor() {
        this._statsData = null;
        this._charts = {};
        this._isLoading = false;
        this._lastUpdate = 0;
        this._updateInterval = 300000; // 5 хвилин
    }

    /**
     * Отримання персональної статистики розіграшів користувача
     * @param {boolean} forceRefresh - Примусове оновлення даних
     * @returns {Promise<Object>} - Дані статистики
     */
    async getUserRaffleStats(forceRefresh = false) {
        try {
            const now = Date.now();

            // Перевіряємо кеш, якщо не потрібно примусове оновлення
            if (!forceRefresh && this._statsData && (now - this._lastUpdate < this._updateInterval)) {
                console.log("📋 Raffles Stats: Використання кешованих даних статистики");
                return this._statsData;
            }

            if (this._isLoading) {
                console.log("⏳ Raffles Stats: Завантаження вже виконується");
                return this._statsData;
            }

            this._isLoading = true;
            this._showStatsLoader();

            // Отримуємо ID користувача
            const userId = await WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Отримуємо дані з API
            const response = await WinixAPI.apiRequest(`/api/user/${userId}/stats/raffles`, 'GET');

            this._hideStatsLoader();
            this._isLoading = false;
            this._lastUpdate = now;

            if (response.status === 'success') {
                this._statsData = response.data || {};
                console.log(`✅ Raffle Stats: Отримано дані статистики користувача`, this._statsData);
                return this._statsData;
            } else {
                throw new Error(response.message || 'Помилка отримання статистики розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання статистики розіграшів:', error);
            this._hideStatsLoader();
            this._isLoading = false;
            showToast('Помилка завантаження статистики: ' + error.message);
            return null;
        }
    }

    /**
     * Відображення статистики користувача
     * @param {string} containerId - ID контейнера для відображення
     * @param {boolean} forceRefresh - Примусове оновлення даних
     */
    async displayUserStats(containerId = 'user-stats-container', forceRefresh = false) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер з ID '${containerId}' не знайдено`);
            return;
        }

        try {
            // Отримуємо дані статистики
            const stats = await this.getUserRaffleStats(forceRefresh);

            if (!stats) {
                container.innerHTML = this._createErrorMessageHTML(containerId);
                return;
            }

            // Формуємо HTML для відображення
            container.innerHTML = this._createUserStatsHTML(stats);

            // Додаємо обробники подій
            this._addUserStatsEventListeners(containerId);

            // Якщо доступні графіки, ініціалізуємо їх
            if (typeof Chart !== 'undefined') {
                this._initUserCharts(stats);
            } else {
                console.warn("Chart.js не знайдено, графіки не будуть відображені");
            }
        } catch (error) {
            console.error('Помилка відображення статистики:', error);
            container.innerHTML = this._createErrorMessageHTML(containerId);
        }
    }

    /**
     * Отримання історії розіграшів за період
     * @param {string} period - Період (week, month, year, all)
     * @returns {Promise<Object>} - Дані історії
     */
    async getRaffleHistory(period = 'month') {
        try {
            this._showStatsLoader();

            // Отримуємо ID користувача
            const userId = await WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Отримуємо дані з API
            const response = await WinixAPI.apiRequest(`/api/user/${userId}/stats/raffles/history?period=${period}`, 'GET');

            this._hideStatsLoader();

            if (response.status === 'success') {
                console.log(`✅ Raffle Stats: Отримано історію розіграшів за період ${period}`, response.data);
                return response.data || {};
            } else {
                throw new Error(response.message || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання історії розіграшів за період ${period}:`, error);
            this._hideStatsLoader();
            showToast('Помилка завантаження історії: ' + error.message);
            return null;
        }
    }

    /**
     * Оновлення статистики користувача
     * @param {string} containerId - ID контейнера
     */
    async refreshStats(containerId = 'user-stats-container') {
        await this.displayUserStats(containerId, true);
    }

    /**
     * Експорт даних статистики
     */
    async exportStatsData() {
        if (!this._statsData) {
            showToast('Немає даних для експорту');
            return;
        }

        try {
            // Генеруємо дані для CSV
            let csvContent = "data:text/csv;charset=utf-8,";

            // Заголовок CSV з часом експорту
            const now = new Date();
            csvContent += `WINIX Raffle Stats - Export Date: ${now.toLocaleString()}\r\n\r\n`;

            // Додаємо основні метрики
            csvContent += "Metric,Value\r\n";

            // Додаємо всі дані зі statsData
            Object.entries(this._statsData).forEach(([key, value]) => {
                // Пропускаємо складні об'єкти
                if (typeof value !== 'object') {
                    csvContent += `${key},${value}\r\n`;
                }
            });

            // Створюємо посилання для завантаження
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `raffle_stats_${now.toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);

            // Клікаємо на посилання для запуску завантаження
            link.click();

            // Видаляємо посилання
            document.body.removeChild(link);

            // Показуємо повідомлення про успіх
            showToast('Статистику успішно експортовано');
        } catch (error) {
            console.error('Помилка експорту статистики:', error);
            showToast('Не вдалося експортувати статистику');
        }
    }

    /**
     * Створення HTML для статистики користувача
     * @param {Object} stats - Дані статистики
     * @returns {string} - HTML-розмітка
     */
    _createUserStatsHTML(stats) {
        return `
            <div class="stats-dashboard user-stats">
                <div class="stats-header">
                    <h2 class="stats-title">Ваша статистика розіграшів</h2>
                    <button class="stats-refresh-btn" id="refresh-stats-btn">
                        <span class="refresh-icon">🔄</span> Оновити
                    </button>
                </div>
                
                <div class="stats-summary">
                    <div class="stats-card">
                        <div class="stats-card-value">${stats.total_participated || 0}</div>
                        <div class="stats-card-label">Всього розіграшів</div>
                        <div class="stats-card-icon">🎮</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-value">${stats.wins_count || 0}</div>
                        <div class="stats-card-label">Перемог</div>
                        <div class="stats-card-icon">🏆</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-value">${formatCurrency(stats.total_winix_won || 0)}</div>
                        <div class="stats-card-label">WINIX виграно</div>
                        <div class="stats-card-icon">💰</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-value">${stats.total_tokens_spent || 0}</div>
                        <div class="stats-card-label">Витрачено жетонів</div>
                        <div class="stats-card-icon">🎟️</div>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3 class="stats-section-title">Розподіл участі в розіграшах</h3>
                    <div class="stats-charts">
                        <div class="stats-chart-container">
                            <canvas id="raffle-types-chart"></canvas>
                        </div>
                        <div class="stats-chart-container">
                            <canvas id="raffle-status-chart"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3 class="stats-section-title">Історія участі в розіграшах</h3>
                    <div class="stats-period-selector" id="history-period-selector">
                        <button class="period-btn" data-period="week">Тиждень</button>
                        <button class="period-btn active" data-period="month">Місяць</button>
                        <button class="period-btn" data-period="year">Рік</button>
                        <button class="period-btn" data-period="all">Всі</button>
                    </div>
                    <div class="stats-chart-container large-chart">
                        <canvas id="participation-history-chart"></canvas>
                    </div>
                </div>
                
                <div class="stats-insights">
                    <h3 class="stats-section-title">Статистичні висновки</h3>
                    <div class="insights-container" id="user-insights-container">
                        <div class="insight-item">
                            <div class="insight-icon">🏆</div>
                            <div class="insight-content">
                                <div class="insight-title">Успішність участі</div>
                                <div class="insight-value">${this._calculateWinRate(stats)}%</div>
                                <div class="insight-description">перемог від усіх участей</div>
                            </div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-icon">📈</div>
                            <div class="insight-content">
                                <div class="insight-title">Ефективність жетонів</div>
                                <div class="insight-value">${this._calculateTokenEfficiency(stats)}</div>
                                <div class="insight-description">WINIX за 1 жетон</div>
                            </div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-icon">🎟️</div>
                            <div class="insight-content">
                                <div class="insight-title">Середня участь</div>
                                <div class="insight-value">${this._calculateAvgTokensPerRaffle(stats)}</div>
                                <div class="insight-description">жетонів на розіграш</div>
                            </div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-icon">⭐</div>
                            <div class="insight-content">
                                <div class="insight-title">Найкраще місце</div>
                                <div class="insight-value">${stats.best_place || '-'}</div>
                                <div class="insight-description">найвища позиція</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="stats-achievements">
                    <h3 class="stats-section-title">Досягнення</h3>
                    <div class="achievements-grid">
                        ${this._generateAchievementsHTML(stats.achievements || {})}
                    </div>
                </div>

                <div class="stats-footer">
                    <button class="stats-export-btn" id="export-stats-btn">
                        <span class="export-icon">📊</span> Експортувати статистику
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Створення HTML для повідомлення про помилку
     * @param {string} containerId - ID контейнера для відображення
     * @returns {string} - HTML-розмітка
     */
    _createErrorMessageHTML(containerId) {
        return `
            <div class="stats-error">
                <div class="stats-error-icon">❌</div>
                <div class="stats-error-message">Не вдалося завантажити статистику розіграшів</div>
                <button class="stats-retry-btn" onclick="window.rafflesModule.stats.refreshStats('${containerId}')">Спробувати ще раз</button>
            </div>
        `;
    }

    /**
     * Додавання обробників подій для елементів статистики
     * @param {string} containerId - ID контейнера для відображення
     */
    _addUserStatsEventListeners(containerId) {
        // Обробник оновлення статистики
        document.getElementById('refresh-stats-btn')?.addEventListener('click', () => {
            this.refreshStats(containerId);
        });

        // Обробник експорту статистики
        document.getElementById('export-stats-btn')?.addEventListener('click', () => {
            this.exportStatsData();
        });

        // Обробник для кнопок періоду історії
        document.querySelectorAll('#history-period-selector .period-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                // Знімаємо активний клас з усіх кнопок
                document.querySelectorAll('#history-period-selector .period-btn').forEach(b => {
                    b.classList.remove('active');
                });

                // Додаємо активний клас до натиснутої кнопки
                btn.classList.add('active');

                // Отримуємо вибраний період
                const period = btn.getAttribute('data-period');

                // Оновлюємо графік історії
                await this._updateHistoryChart(period);
            });
        });
    }

    /**
     * Ініціалізація графіків для панелі користувача
     * @param {Object} stats - Дані статистики користувача
     */
    _initUserCharts(stats) {
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js не знайдено, графіки не будуть відображені");
            return;
        }

        // Графік типів розіграшів (пончик)
        this._initRaffleTypesChart(stats);

        // Графік статусів розіграшів (пончик)
        this._initRaffleStatusChart(stats);

        // Графік історії участі (лінійний)
        // Початково завантажуємо дані за місяць
        this._updateHistoryChart('month');
    }

    /**
     * Ініціалізація графіка типів розіграшів
     * @param {Object} stats - Дані статистики користувача
     */
    _initRaffleTypesChart(stats) {
        const ctx = document.getElementById('raffle-types-chart');
        if (!ctx) return;

        // Підготовка даних
        const typeData = {
            labels: ['Щоденні', 'Джекпот'],
            datasets: [{
                data: [
                    stats.daily_participated || 0,
                    stats.jackpot_participated || 0
                ],
                backgroundColor: [
                    'rgba(33, 150, 243, 1)',
                    'rgba(0, 201, 167, 1)'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        };

        // Налаштування графіка
        const config = {
            type: 'doughnut',
            data: typeData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'white',
                            font: {
                                size: 12
                            },
                            padding: 20
                        }
                    },
                    title: {
                        display: true,
                        text: 'Типи розіграшів',
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        };

        // Створюємо графік
        if (this._charts.typeChart) {
            this._charts.typeChart.destroy();
        }

        this._charts.typeChart = new Chart(ctx, config);
    }

    /**
     * Ініціалізація графіка статусів розіграшів
     * @param {Object} stats - Дані статистики користувача
     */
    _initRaffleStatusChart(stats) {
        const ctx = document.getElementById('raffle-status-chart');
        if (!ctx) return;

        // Підготовка даних
        const statusData = {
            labels: ['Перемоги', 'Участь без перемоги'],
            datasets: [{
                data: [
                    stats.wins_count || 0,
                    (stats.total_participated || 0) - (stats.wins_count || 0)
                ],
                backgroundColor: [
                    'rgba(255, 215, 0, 1)',
                    'rgba(78, 181, 247, 1)'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        };

        // Налаштування графіка
        const config = {
            type: 'doughnut',
            data: statusData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'white',
                            font: {
                                size: 12
                            },
                            padding: 20
                        }
                    },
                    title: {
                        display: true,
                        text: 'Результати участі',
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        };

        // Створюємо графік
        if (this._charts.statusChart) {
            this._charts.statusChart.destroy();
        }

        this._charts.statusChart = new Chart(ctx, config);
    }

    /**
     * Оновлення графіка історії участі
     * @param {string} period - Період (week, month, year, all)
     */
    async _updateHistoryChart(period = 'month') {
        const ctx = document.getElementById('participation-history-chart');
        if (!ctx) return;

        // Отримуємо дані історії за вказаний період
        const historyData = await this.getRaffleHistory(period);
        if (!historyData || !historyData.dates || !historyData.participation) {
            return;
        }

        // Підготовка даних для графіка
        const chartData = {
            labels: historyData.dates,
            datasets: [
                {
                    label: 'Всього участей',
                    data: historyData.participation,
                    borderColor: 'rgba(33, 150, 243, 1)',
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;

                        if (!chartArea) {
                            return 'rgba(33, 150, 243, 1)';
                        }

                        // Створюємо градієнт
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(33, 150, 243, 0.1)');
                        gradient.addColorStop(1, 'rgba(33, 150, 243, 0.4)');

                        return gradient;
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    yAxisID: 'y'
                },
                {
                    label: 'Перемоги',
                    data: historyData.wins || [],
                    borderColor: 'rgba(255, 215, 0, 1)',
                    backgroundColor: 'rgba(255, 215, 0, 1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointStyle: 'rect',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    yAxisID: 'y1'
                }
            ]
        };

        // Налаштування графіка
        const config = {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'white',
                            font: {
                                size: 12
                            },
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: true,
                        text: `Історія участі в розіграшах (${this._getPeriodName(period)})`,
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Кількість участей',
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Кількість перемог',
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        };

        // Створюємо або оновлюємо графік
        if (this._charts.historyChart) {
            this._charts.historyChart.destroy();
        }

        this._charts.historyChart = new Chart(ctx, config);
    }

    /**
     * Генерування HTML для досягнень користувача
     * @param {Object} achievements - Об'єкт з досягненнями
     * @returns {string} - HTML-розмітка
     */
    _generateAchievementsHTML(achievements) {
        if (Object.keys(achievements).length === 0) {
            return `
                <div class="empty-achievements">
                    <div class="empty-icon">🏆</div>
                    <p>Досягнення поки відсутні. Беріть участь у розіграшах, щоб розблокувати досягнення!</p>
                </div>
            `;
        }

        return Object.entries(achievements).map(([id, achievement]) => {
            const isUnlocked = achievement.unlocked;
            const progressText = achievement.progress_type === 'count'
                ? `${achievement.current_progress}/${achievement.required_progress}`
                : `${achievement.current_progress}%`;

            const progressWidth = Math.min(100, Math.max(0,
                achievement.progress_type === 'count'
                    ? (achievement.current_progress / achievement.required_progress) * 100
                    : achievement.current_progress
            ));

            return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <div class="achievement-title">
                            ${achievement.title}
                            ${!isUnlocked ? '<span class="lock-icon">🔒</span>' : ''}
                        </div>
                        <div class="achievement-description">${achievement.description}</div>
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress" style="width: ${progressWidth}%"></div>
                        </div>
                        <div class="achievement-progress-text">${progressText}</div>
                    </div>
                    <div class="achievement-reward">
                        <div class="reward-label">Нагорода:</div>
                        <div class="reward-value">${achievement.reward}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Обчислення відсотка перемог
     * @param {Object} stats - Дані статистики користувача
     * @returns {number} - Відсоток перемог
     */
    _calculateWinRate(stats) {
        const totalParticipated = stats.total_participated || 0;
        const winsCount = stats.wins_count || 0;

        if (totalParticipated === 0) return 0;
        return Math.round((winsCount / totalParticipated) * 100);
    }

    /**
     * Обчислення ефективності жетонів (WINIX на 1 жетон)
     * @param {Object} stats - Дані статистики користувача
     * @returns {string} - Ефективність жетонів
     */
    _calculateTokenEfficiency(stats) {
        const totalWinixWon = stats.total_winix_won || 0;
        const totalTokensSpent = stats.total_tokens_spent || 0;

        if (totalTokensSpent === 0) return '0';
        return (totalWinixWon / totalTokensSpent).toFixed(2);
    }

    /**
     * Обчислення середньої кількості жетонів на розіграш
     * @param {Object} stats - Дані статистики користувача
     * @returns {string} - Середня кількість жетонів
     */
    _calculateAvgTokensPerRaffle(stats) {
        const totalTokensSpent = stats.total_tokens_spent || 0;
        const totalParticipated = stats.total_participated || 0;

        if (totalParticipated === 0) return '0';
        return (totalTokensSpent / totalParticipated).toFixed(1);
    }

    /**
     * Отримання назви періоду
     * @param {string} period - Код періоду
     * @returns {string} - Назва періоду
     */
    _getPeriodName(period) {
        switch (period) {
            case 'week': return 'тиждень';
            case 'month': return 'місяць';
            case 'year': return 'рік';
            case 'all': return 'весь час';
            default: return period;
        }
    }

    /**
     * Показати індикатор завантаження для статистики
     */
    _showStatsLoader() {
        if (typeof window.showLoading === 'function') {
            window.showLoading('Завантаження статистики...');
            return;
        }

        // Запасний варіант, якщо глобальна функція відсутня
        let loader = document.getElementById('stats-loader');

        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'stats-loader';
            loader.className = 'stats-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <div class="loader-text">Завантаження статистики...</div>
            `;
            document.body.appendChild(loader);
        }

        loader.style.display = 'flex';
    }

    /**
     * Приховати індикатор завантаження для статистики
     */
    _hideStatsLoader() {
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
            return;
        }

        // Запасний варіант, якщо глобальна функція відсутня
        const loader = document.getElementById('stats-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

export default new RaffleStats();