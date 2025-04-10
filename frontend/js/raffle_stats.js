/**
 * raffle_stats.js - Модуль для аналітики та статистики розіграшів WINIX
 */

(function() {
    'use strict';

    console.log("📊 Raffle Stats: Ініціалізація модуля статистики розіграшів");

    // ======== ПРИВАТНІ ЗМІННІ ========
    let _isLoading = false;
    let _statsData = null;
    let _charts = {};

    // Кольори для графіків
    const CHART_COLORS = {
        primary: 'rgba(0, 201, 167, 1)',
        secondary: 'rgba(78, 181, 247, 1)',
        accent: 'rgba(255, 215, 0, 1)',
        danger: 'rgba(244, 67, 54, 1)',
        info: 'rgba(33, 150, 243, 1)',
        blue: 'rgba(41, 98, 255, 1)',
        teal: 'rgba(0, 181, 173, 1)',
        green: 'rgba(76, 175, 80, 1)',
        purple: 'rgba(156, 39, 176, 1)',
        orange: 'rgba(255, 152, 0, 1)',

        // Градієнти
        primaryGradient: ['rgba(0, 201, 167, 0.8)', 'rgba(0, 201, 167, 0.2)'],
        secondaryGradient: ['rgba(78, 181, 247, 0.8)', 'rgba(78, 181, 247, 0.2)'],
        accentGradient: ['rgba(255, 215, 0, 0.8)', 'rgba(255, 215, 0, 0.2)'],
    };

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З API ========

    /**
     * Отримання даних статистики розіграшів
     */
    async function getRaffleStats() {
        try {
            if (_isLoading) {
                console.log("⏳ Raffle Stats: Завантаження вже виконується");
                return _statsData;
            }

            _isLoading = true;
            showStatsLoader();

            // Отримуємо дані з API
            const response = await window.AdminAPI.apiRequest('/api/admin/stats/raffles', 'GET', null, {
                'X-Admin-User-Id': window.AdminAPI.getAdminId()
            });

            hideStatsLoader();
            _isLoading = false;

            if (response.status === 'success') {
                _statsData = response.data || {};
                console.log(`✅ Raffle Stats: Отримано дані статистики`, _statsData);
                return _statsData;
            } else {
                throw new Error(response.message || 'Помилка отримання статистики розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання статистики розіграшів:', error);
            hideStatsLoader();
            _isLoading = false;
            showStatsError('Помилка завантаження статистики: ' + error.message);
            return null;
        }
    }

    /**
     * Отримання історії розіграшів за період
     * @param {string} period - Період (week, month, year, all)
     */
    async function getRaffleHistory(period = 'month') {
        try {
            showStatsLoader();

            // Отримуємо дані з API
            const response = await window.AdminAPI.apiRequest(`/api/admin/stats/raffles/history?period=${period}`, 'GET', null, {
                'X-Admin-User-Id': window.AdminAPI.getAdminId()
            });

            hideStatsLoader();

            if (response.status === 'success') {
                console.log(`✅ Raffle Stats: Отримано історію розіграшів за період ${period}`, response.data);
                return response.data || {};
            } else {
                throw new Error(response.message || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання історії розіграшів за період ${period}:`, error);
            hideStatsLoader();
            showStatsError('Помилка завантаження історії: ' + error.message);
            return null;
        }
    }

    /**
     * Отримання статистики учасників розіграшів
     */
    async function getParticipantsStats() {
        try {
            showStatsLoader();

            // Отримуємо дані з API
            const response = await window.AdminAPI.apiRequest('/api/admin/stats/raffles/participants', 'GET', null, {
                'X-Admin-User-Id': window.AdminAPI.getAdminId()
            });

            hideStatsLoader();

            if (response.status === 'success') {
                console.log(`✅ Raffle Stats: Отримано статистику учасників`, response.data);
                return response.data || {};
            } else {
                throw new Error(response.message || 'Помилка отримання статистики учасників');
            }
        } catch (error) {
            console.error('❌ Помилка отримання статистики учасників:', error);
            hideStatsLoader();
            showStatsError('Помилка завантаження даних учасників: ' + error.message);
            return null;
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З UI ========

    /**
     * Відображення панелі статистики
     * @param {string} containerId - ID контейнера для відображення
     */
    async function displayStatsPanel(containerId = 'raffles-stats-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер з ID '${containerId}' не знайдено`);
            return;
        }

        // Отримуємо дані статистики
        const stats = await getRaffleStats();
        if (!stats) {
            container.innerHTML = `
                <div class="stats-error">
                    <div class="stats-error-icon">❌</div>
                    <div class="stats-error-message">Не вдалося завантажити статистику розіграшів</div>
                    <button class="stats-retry-btn" onclick="window.RaffleStats.displayStatsPanel('${containerId}')">Спробувати ще раз</button>
                </div>
            `;
            return;
        }

        // Створюємо HTML для панелі статистики
        const statsPanelHTML = `
            <div class="stats-dashboard">
                <div class="stats-header">
                    <h2 class="stats-title">Статистика розіграшів WINIX</h2>
                    <div class="stats-actions">
                        <button class="stats-refresh-btn" id="refresh-stats-btn">
                            <span class="refresh-icon">🔄</span> Оновити
                        </button>
                        <button class="stats-export-btn" id="export-stats-btn">
                            <span class="export-icon">📊</span> Експорт
                        </button>
                    </div>
                </div>
                
                <div class="stats-summary">
                    <div class="stats-card">
                        <div class="stats-card-value">${stats.total_raffles || 0}</div>
                        <div class="stats-card-label">Всього розіграшів</div>
                        <div class="stats-card-icon">🎮</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-value">${stats.active_raffles || 0}</div>
                        <div class="stats-card-label">Активних розіграшів</div>
                        <div class="stats-card-icon">🔄</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-value">${stats.total_participants || 0}</div>
                        <div class="stats-card-label">Всього учасників</div>
                        <div class="stats-card-icon">👥</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-card-value">${formatCurrency(stats.total_prize_amount || 0)}</div>
                        <div class="stats-card-label">Загальний фонд</div>
                        <div class="stats-card-icon">💰</div>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3 class="stats-section-title">Розподіл розіграшів</h3>
                    <div class="stats-charts">
                        <div class="stats-chart-container">
                            <canvas id="raffles-status-chart"></canvas>
                        </div>
                        <div class="stats-chart-container">
                            <canvas id="raffles-type-chart"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3 class="stats-section-title">Активність по розіграшах</h3>
                    <div class="stats-period-selector" id="history-period-selector">
                        <button class="period-btn" data-period="week">Тиждень</button>
                        <button class="period-btn active" data-period="month">Місяць</button>
                        <button class="period-btn" data-period="year">Рік</button>
                        <button class="period-btn" data-period="all">Всі</button>
                    </div>
                    <div class="stats-chart-container large-chart">
                        <canvas id="raffles-history-chart"></canvas>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3 class="stats-section-title">Аналіз учасників</h3>
                    <div class="stats-charts">
                        <div class="stats-chart-container">
                            <canvas id="participants-distribution-chart"></canvas>
                        </div>
                        <div class="stats-chart-container">
                            <canvas id="tokens-used-chart"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="stats-insights">
                    <h3 class="stats-section-title">Статистичні висновки</h3>
                    <div class="insights-container" id="stats-insights-container">
                        <div class="insight-item">
                            <div class="insight-icon">🏆</div>
                            <div class="insight-content">
                                <div class="insight-title">Успішність розіграшів</div>
                                <div class="insight-value">${stats.completion_rate || 0}%</div>
                                <div class="insight-description">розіграшів успішно завершено</div>
                            </div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-icon">📈</div>
                            <div class="insight-content">
                                <div class="insight-title">Середня кількість учасників</div>
                                <div class="insight-value">${stats.avg_participants || 0}</div>
                                <div class="insight-description">учасників на розіграш</div>
                            </div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-icon">🎟️</div>
                            <div class="insight-content">
                                <div class="insight-title">Середнє використання жетонів</div>
                                <div class="insight-value">${stats.avg_tokens_per_user || 0}</div>
                                <div class="insight-description">жетонів на користувача</div>
                            </div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-icon">⚡</div>
                            <div class="insight-content">
                                <div class="insight-title">Найактивніший день</div>
                                <div class="insight-value">${stats.most_active_day || 'Н/Д'}</div>
                                <div class="insight-description">день з найбільшою активністю</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Вставляємо HTML в контейнер
        container.innerHTML = statsPanelHTML;

        // Ініціалізуємо графіки
        initCharts(stats);

        // Додаємо обробники подій
        document.getElementById('refresh-stats-btn')?.addEventListener('click', () => {
            refreshStats(containerId);
        });

        document.getElementById('export-stats-btn')?.addEventListener('click', () => {
            exportStatsData();
        });

        // Обробник для кнопок періоду історії
        document.querySelectorAll('#history-period-selector .period-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                // Знімаємо активний клас з усіх кнопок
                document.querySelectorAll('#history-period-selector .period-btn').forEach(b => {
                    b.classList.remove('active');
                });

                // Додаємо активний клас до натиснутої кнопки
                this.classList.add('active');

                // Отримуємо вибраний період
                const period = this.getAttribute('data-period');

                // Оновлюємо графік історії
                await updateHistoryChart(period);
            });
        });

        // Запускаємо завантаження додаткових даних
        loadParticipantsData();
    }

    /**
     * Ініціалізація графіків на основі отриманих даних
     * @param {Object} stats - Дані статистики
     */
    function initCharts(stats) {
        // Графік статусів розіграшів (пончик)
        initRafflesStatusChart(stats);

        // Графік типів розіграшів (пончик)
        initRafflesTypeChart(stats);

        // Графік історії розіграшів (лінійний)
        // Початково завантажуємо дані за місяць
        updateHistoryChart('month');

        // Графіки учасників будуть завантажені після отримання додаткових даних
    }

    /**
     * Ініціалізація графіка статусів розіграшів
     * @param {Object} stats - Дані статистики
     */
    function initRafflesStatusChart(stats) {
        const ctx = document.getElementById('raffles-status-chart');
        if (!ctx) return;

        // Підготовка даних
        const statusData = {
            labels: ['Активні', 'Завершені', 'Скасовані'],
            datasets: [{
                data: [
                    stats.active_raffles || 0,
                    stats.completed_raffles || 0,
                    stats.cancelled_raffles || 0
                ],
                backgroundColor: [
                    CHART_COLORS.info,
                    CHART_COLORS.green,
                    CHART_COLORS.danger
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
                        text: 'Статуси розіграшів',
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
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        };

        // Створюємо графік
        if (_charts.statusChart) {
            _charts.statusChart.destroy();
        }

        _charts.statusChart = new Chart(ctx, config);
    }

    /**
     * Ініціалізація графіка типів розіграшів
     * @param {Object} stats - Дані статистики
     */
    function initRafflesTypeChart(stats) {
        const ctx = document.getElementById('raffles-type-chart');
        if (!ctx) return;

        // Підготовка даних
        const typeData = {
            labels: ['Щоденні', 'Звичайні'],
            datasets: [{
                data: [
                    stats.daily_raffles || 0,
                    (stats.total_raffles || 0) - (stats.daily_raffles || 0)
                ],
                backgroundColor: [
                    CHART_COLORS.accent,
                    CHART_COLORS.primary
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
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        };

        // Створюємо графік
        if (_charts.typeChart) {
            _charts.typeChart.destroy();
        }

        _charts.typeChart = new Chart(ctx, config);
    }

    /**
     * Оновлення графіка історії розіграшів
     * @param {string} period - Період (week, month, year, all)
     */
    async function updateHistoryChart(period = 'month') {
        const ctx = document.getElementById('raffles-history-chart');
        if (!ctx) return;

        // Отримуємо дані історії за вказаний період
        const historyData = await getRaffleHistory(period);
        if (!historyData || !historyData.dates || !historyData.participants || !historyData.raffles) {
            return;
        }

        // Підготовка даних для графіка
        const chartData = {
            labels: historyData.dates,
            datasets: [
                {
                    label: 'Учасники',
                    data: historyData.participants,
                    borderColor: CHART_COLORS.info,
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;

                        if (!chartArea) {
                            return CHART_COLORS.info;
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
                    label: 'Розіграші',
                    data: historyData.raffles,
                    borderColor: CHART_COLORS.accent,
                    backgroundColor: CHART_COLORS.accent,
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
                        text: `Історія активності розіграшів (${getPeriodName(period)})`,
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
                            text: 'Кількість учасників',
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
                            text: 'Кількість розіграшів',
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
        if (_charts.historyChart) {
            _charts.historyChart.destroy();
        }

        _charts.historyChart = new Chart(ctx, config);
    }

    /**
     * Завантаження даних про учасників і оновлення відповідних графіків
     */
    async function loadParticipantsData() {
        // Отримуємо дані про учасників
        const participantsData = await getParticipantsStats();
        if (!participantsData) {
            return;
        }

        // Ініціалізуємо графіки учасників
        initParticipantsDistributionChart(participantsData);
        initTokensUsedChart(participantsData);
    }

    /**
     * Ініціалізація графіка розподілу учасників за кількістю розіграшів
     * @param {Object} data - Дані про учасників
     */
    function initParticipantsDistributionChart(data) {
        const ctx = document.getElementById('participants-distribution-chart');
        if (!ctx) return;

        // Підготовка даних
        const participantsData = {
            labels: ['1 розіграш', '2-5 розіграшів', '6-10 розіграшів', '11+ розіграшів'],
            datasets: [{
                label: 'Кількість користувачів',
                data: [
                    data.single_participation || 0,
                    data.few_participations || 0,
                    data.moderate_participations || 0,
                    data.many_participations || 0
                ],
                backgroundColor: [
                    CHART_COLORS.blue,
                    CHART_COLORS.teal,
                    CHART_COLORS.primary,
                    CHART_COLORS.purple
                ],
                borderWidth: 0
            }]
        };

        // Налаштування графіка
        const config = {
            type: 'bar',
            data: participantsData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Розподіл учасників',
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
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${value} користувачів (${percentage}%)`;
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
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        };

        // Створюємо графік
        if (_charts.participantsChart) {
            _charts.participantsChart.destroy();
        }

        _charts.participantsChart = new Chart(ctx, config);
    }

    /**
     * Ініціалізація графіка використання жетонів
     * @param {Object} data - Дані про використання жетонів
     */
    function initTokensUsedChart(data) {
        const ctx = document.getElementById('tokens-used-chart');
        if (!ctx) return;

        // Підготовка даних
        const tokensData = {
            labels: Object.keys(data.tokens_distribution || {}),
            datasets: [{
                label: 'Кількість користувачів',
                data: Object.values(data.tokens_distribution || {}),
                backgroundColor: CHART_COLORS.secondaryGradient[0],
                borderColor: CHART_COLORS.secondary,
                borderWidth: 2
            }]
        };

        // Налаштування графіка
        const config = {
            type: 'bar',
            data: tokensData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Витрати жетонів',
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Кількість жетонів',
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Кількість користувачів',
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        };

        // Створюємо графік
        if (_charts.tokensChart) {
            _charts.tokensChart.destroy();
        }

        _charts.tokensChart = new Chart(ctx, config);
    }

    /**
     * Оновлення всіх даних статистики
     * @param {string} containerId - ID контейнера
     */
    async function refreshStats(containerId) {
        // Скидаємо кеш даних
        _statsData = null;

        // Оновлюємо відображення
        await displayStatsPanel(containerId);
    }

    /**
     * Експорт даних статистики в CSV
     */
    function exportStatsData() {
        if (!_statsData) {
            showStatsError('Немає даних для експорту');
            return;
        }

        // Генеруємо дані для CSV
        let csvContent = "data:text/csv;charset=utf-8,";

        // Заголовок CSV з часом експорту
        const now = new Date();
        csvContent += `WINIX Raffle Stats - Export Date: ${now.toLocaleString()}\r\n\r\n`;

        // Додаємо основні метрики
        csvContent += "Metric,Value\r\n";
        csvContent += `Total Raffles,${_statsData.total_raffles || 0}\r\n`;
        csvContent += `Active Raffles,${_statsData.active_raffles || 0}\r\n`;
        csvContent += `Completed Raffles,${_statsData.completed_raffles || 0}\r\n`;
        csvContent += `Cancelled Raffles,${_statsData.cancelled_raffles || 0}\r\n`;
        csvContent += `Daily Raffles,${_statsData.daily_raffles || 0}\r\n`;
        csvContent += `Regular Raffles,${(_statsData.total_raffles || 0) - (_statsData.daily_raffles || 0)}\r\n`;
        csvContent += `Total Participants,${_statsData.total_participants || 0}\r\n`;
        csvContent += `Total Prize Amount,${_statsData.total_prize_amount || 0}\r\n`;
        csvContent += `Completion Rate,${_statsData.completion_rate || 0}%\r\n`;
        csvContent += `Average Participants,${_statsData.avg_participants || 0}\r\n`;
        csvContent += `Average Tokens Per User,${_statsData.avg_tokens_per_user || 0}\r\n`;
        csvContent += `Most Active Day,${_statsData.most_active_day || 'N/A'}\r\n`;

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
        showStatsSuccess('Статистику успішно експортовано');
    }

    /**
     * Показати індикатор завантаження для статистики
     */
    function showStatsLoader() {
        const existingLoader = document.getElementById('stats-loader');
        if (existingLoader) return;

        const loader = document.createElement('div');
        loader.id = 'stats-loader';
        loader.className = 'stats-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <div class="loader-text">Завантаження статистики...</div>
        `;

        document.body.appendChild(loader);
    }

    /**
     * Приховати індикатор завантаження для статистики
     */
    function hideStatsLoader() {
        const loader = document.getElementById('stats-loader');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Показати повідомлення про помилку
     * @param {string} message - Текст повідомлення
     */
    function showStatsError(message) {
        showStatsNotification(message, 'error');
    }

    /**
     * Показати повідомлення про успіх
     * @param {string} message - Текст повідомлення
     */
    function showStatsSuccess(message) {
        showStatsNotification(message, 'success');
    }

    /**
     * Показати системне повідомлення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення (error, success, info)
     */
    function showStatsNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `stats-notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Показуємо повідомлення
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Приховуємо повідомлення через 5 секунд
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }

    // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

    /**
     * Форматування валюти
     * @param {number} amount - Сума
     * @param {string} currency - Валюта
     */
    function formatCurrency(amount, currency = 'WINIX') {
        return new Intl.NumberFormat('uk-UA').format(amount) + ' ' + currency;
    }

    /**
     * Отримання назви періоду
     * @param {string} period - Код періоду
     */
    function getPeriodName(period) {
        switch (period) {
            case 'week': return 'тиждень';
            case 'month': return 'місяць';
            case 'year': return 'рік';
            case 'all': return 'весь час';
            default: return period;
        }
    }

    /**
     * Додати стилі для статистики
     */
    function addStatsStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* Стилі для панелі статистики */
            .stats-dashboard {
                width: 100%;
                max-width: 1200px;
                margin: 0 auto;
                padding: 1.5rem;
                background: rgba(26, 26, 46, 0.7);
                border-radius: 1rem;
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.3);
            }
            
            .stats-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 1rem;
            }
            
            .stats-title {
                font-size: 1.5rem;
                font-weight: bold;
                color: white;
                margin: 0;
            }
            
            .stats-actions {
                display: flex;
                gap: 0.75rem;
            }
            
            .stats-refresh-btn, .stats-export-btn {
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                color: white;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .stats-refresh-btn:hover, .stats-export-btn:hover {
                background: rgba(0, 0, 0, 0.4);
                transform: translateY(-2px);
            }
            
            .refresh-icon, .export-icon {
                font-size: 1rem;
            }
            
            .stats-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            
            .stats-card {
                background: rgba(30, 39, 70, 0.6);
                border-radius: 0.75rem;
                padding: 1.25rem;
                position: relative;
                overflow: hidden;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            
            .stats-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.2);
            }
            
            .stats-card-value {
                font-size: 2rem;
                font-weight: bold;
                color: white;
                margin-bottom: 0.5rem;
            }
            
            .stats-card-label {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .stats-card-icon {
                position: absolute;
                top: 1rem;
                right: 1rem;
                font-size: 2.5rem;
                opacity: 0.2;
                transform: rotate(10deg);
            }
            
            .stats-section {
                margin-bottom: 2.5rem;
            }
            
            .stats-section-title {
                font-size: 1.25rem;
                font-weight: bold;
                margin-bottom: 1rem;
                color: white;
            }
            
            .stats-charts {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 1.5rem;
            }
            
            .stats-chart-container {
                background: rgba(30, 39, 70, 0.4);
                border-radius: 0.75rem;
                padding: 1rem;
                height: 300px;
                position: relative;
            }
            
            .stats-chart-container.large-chart {
                grid-column: 1 / -1;
                height: 400px;
            }
            
            .stats-period-selector {
                display: flex;
                justify-content: center;
                margin-bottom: 1rem;
                gap: 0.5rem;
            }
            
            .period-btn {
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 0.5rem;
                padding: 0.375rem 0.75rem;
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .period-btn:hover {
                background: rgba(0, 0, 0, 0.4);
                color: white;
            }
            
            .period-btn.active {
                background: rgba(0, 201, 167, 0.2);
                border-color: rgba(0, 201, 167, 0.5);
                color: white;
            }
            
            .stats-insights {
                margin-top: 2rem;
            }
            
            .insights-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: C:\Users\Olexiy\AppData\Local\Programs\Microsoft VS Code\resources\app\out\vs\code\electron-sandbox\workbench\workbench.html1rem;
                margin-bottom: 2rem;
            }
            
            .insight-item {
                background: rgba(30, 39, 70, 0.4);
                border-radius: 0.75rem;
                padding: 1.25rem;
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .insight-icon {
                font-size: 2rem;
                min-width: 2.5rem;
                height: 2.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 0.5rem;
            }
            
            .insight-content {
                flex: 1;
            }
            
            .insight-title {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 0.25rem;
            }
            
            .insight-value {
                font-size: 1.5rem;
                font-weight: bold;
                color: white;
                margin-bottom: 0.25rem;
            }
            
            .insight-description {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.5);
            }
            
            /* Стилі для помилки */
            .stats-error {
                background: rgba(244, 67, 54, 0.1);
                border: 1px solid rgba(244, 67, 54, 0.3);
                border-radius: 0.75rem;
                padding: 2rem;
                text-align: center;
                margin: 2rem auto;
                max-width: 500px;
            }
            
            .stats-error-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                color: rgba(244, 67, 54, 0.8);
            }
            
            .stats-error-message {
                font-size: 1.125rem;
                color: white;
                margin-bottom: 1.5rem;
            }
            
            .stats-retry-btn {
                background: rgba(244, 67, 54, 0.2);
                border: 1px solid rgba(244, 67, 54, 0.5);
                border-radius: 0.5rem;
                padding: 0.75rem 1.5rem;
                color: white;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .stats-retry-btn:hover {
                background: rgba(244, 67, 54, 0.3);
                transform: translateY(-2px);
            }
            
            /* Стилі для лоадера */
            .stats-loader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            
            .loader-spinner {
                width: 4rem;
                height: 4rem;
                border: 0.375rem solid rgba(0, 201, 167, 0.3);
                border-top: 0.375rem solid rgba(0, 201, 167, 1);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 1rem;
            }
            
            .loader-text {
                color: white;
                font-size: 1.125rem;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Стилі для повідомлень */
            .stats-notification {
                position: fixed;
                top: 1.5rem;
                right: 1.5rem;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                background: rgba(30, 39, 70, 0.9);
                color: white;
                font-size: 0.875rem;
                z-index: 10000;
                transform: translateX(calc(100% + 1.5rem));
                transition: transform 0.3s ease;
                box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.5);
                max-width: 300px;
            }
            
            .stats-notification.show {
                transform: translateX(0);
            }
            
            .stats-notification.error {
                background: rgba(244, 67, 54, 0.9);
                border-left: 0.25rem solid rgb(244, 67, 54);
            }
            
            .stats-notification.success {
                background: rgba(76, 175, 80, 0.9);
                border-left: 0.25rem solid rgb(76, 175, 80);
            }
            
            .stats-notification.info {
                background: rgba(33, 150, 243, 0.9);
                border-left: 0.25rem solid rgb(33, 150, 243);
            }
            
            /* Медіа-запити для адаптивності */
            @media (max-width: 768px) {
                .stats-dashboard {
                    padding: 1rem;
                }
                
                .stats-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 1rem;
                }
                
                .stats-charts {
                    grid-template-columns: 1fr;
                }
                
                .insights-container {
                    grid-template-columns: 1fr;
                }
                
                .stats-chart-container {
                    height: 250px;
                }
                
                .stats-chart-container.large-chart {
                    height: 300px;
                }
            }
        `;

        document.head.appendChild(styleElement);
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація модуля статистики розіграшів
     */
    function init() {
        console.log("📊 Raffle Stats: Ініціалізація...");

        // Перевіряємо наявність бібліотеки Chart.js
        if (typeof Chart === 'undefined') {
            // Додаємо Chart.js, якщо його немає
            const chartScript = document.createElement('script');
            chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js';
            chartScript.onload = function() {
                console.log("📊 Chart.js успішно завантажено");
                completeInit();
            };
            chartScript.onerror = function() {
                console.error("❌ Помилка завантаження Chart.js");
            };
            document.head.appendChild(chartScript);
        } else {
            completeInit();
        }
    }

    /**
     * Завершення ініціалізації після завантаження необхідних бібліотек
     */
    function completeInit() {
        // Додаємо стилі
        addStatsStyles();

        // Перевіряємо, чи є на сторінці контейнер для статистики
        const statsContainer = document.getElementById('raffles-stats-container');
        if (statsContainer) {
            // Автоматично відображаємо панель статистики
            displayStatsPanel('raffles-stats-container');
        }

        console.log("✅ Raffle Stats: Ініціалізацію завершено");
    }

    // Експортуємо публічний API
    window.RaffleStats = {
        init,
        displayStatsPanel,
        getRaffleStats,
        getRaffleHistory,
        getParticipantsStats,
        refreshStats,
        exportStatsData
    };

    // Ініціалізуємо модуль при завантаженні документа
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();