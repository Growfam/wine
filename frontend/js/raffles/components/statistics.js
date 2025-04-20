/**
 * WINIX - Система розіграшів (statistics.js)
 * Вдосконалений модуль для роботи зі статистикою розіграшів користувача
 * @version 2.1.0
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

        // Історія статистики за періоди (для графіків)
        statsHistory: [],

        // Останній час оновлення
        lastUpdate: 0,

        // Інтервал кешування (3 хвилини)
        cacheInterval: 3 * 60 * 1000, // ВИПРАВЛЕНО: Зменшено для більш частого оновлення

        // Статус завантаження
        isLoading: false,

        // Чи були проблеми з останнім завантаженням
        hasLoadingErrors: false,

        // Чи потрібно оновити дані (використовується для відкладеного оновлення)
        needsUpdate: false,

        // Ідентифікатор таймера оновлення
        updateTimer: null,

        // ДОДАНО: Прапорець примусового оновлення
        forceUpdateOnNextShow: false,

        // Ініціалізація модуля
        init: function() {
            console.log('📊 Ініціалізація модуля статистики розіграшів...');

            // Спочатку спробуємо відновити дані з кешу
            this.restoreFromCache();

            // Перевіряємо, чи потрібно відразу завантажити статистику
            if (WinixRaffles.state.activeTab === 'stats') {
                this.loadStatistics();
            }

            // Додаємо обробники подій
            this.setupEventListeners();

            // Додаємо стилі для графіків
            this.injectChartStyles();
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник зміни вкладки
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    if (tabName === 'stats') {
                        // ВИПРАВЛЕННЯ: Оновлюємо при кожному переході на вкладку,
                        // або використовуємо кеш, якщо дані достатньо свіжі
                        const now = Date.now();
                        if (this.forceUpdateOnNextShow || now - this.lastUpdate > 60000) { // 1 хвилина
                            this.loadStatistics(this.forceUpdateOnNextShow);
                            this.forceUpdateOnNextShow = false; // Скидаємо прапорець
                        } else {
                            // Відображаємо кешовані дані, якщо вони існують
                            if (this.statsData) {
                                this.renderStatistics(this.statsData);
                            }
                        }
                    }
                });
            });

            // Обробник оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    // ВИПРАВЛЕННЯ: Відкладаємо оновлення, щоб не викликати надмірну кількість запитів
                    this.needsUpdate = true;
                    this.forceUpdateOnNextShow = true;

                    // Скасовуємо попередній таймер, якщо він існує
                    if (this.updateTimer) {
                        clearTimeout(this.updateTimer);
                    }

                    // Якщо ми на вкладці статистики, оновлюємо відразу,
                    // інакше встановлюємо прапорець для оновлення при наступному відображенні
                    if (WinixRaffles.state.activeTab === 'stats') {
                        this.updateTimer = setTimeout(() => {
                            if (this.needsUpdate) {
                                this.loadStatistics(true);
                                this.needsUpdate = false;
                            }
                        }, 2000); // Затримка у 2 секунди
                    }
                }
            });

            // Обробник події успішної участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    // ВИПРАВЛЕННЯ: Встановлюємо прапорці
                    this.needsUpdate = true;
                    this.forceUpdateOnNextShow = true;

                    // Якщо ми на вкладці статистики, оновлюємо через певний час
                    if (WinixRaffles.state.activeTab === 'stats') {
                        if (this.updateTimer) {
                            clearTimeout(this.updateTimer);
                        }

                        // Встановлюємо таймер на 3 секунди для дозволення серверу оновити дані
                        this.updateTimer = setTimeout(() => {
                            this.loadStatistics(true);
                            this.needsUpdate = false;
                        }, 3000);
                    }
                }
            });

            // Обробник видимості сторінки для оновлення при поверненні
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' &&
                    WinixRaffles.state.activeTab === 'stats') {

                    const now = Date.now();
                    // ВИПРАВЛЕННЯ: Примусово оновлювати якщо минуло більше 5 хвилин або встановлено прапорець
                    if (this.forceUpdateOnNextShow || now - this.lastUpdate > 300000) { // 5 хвилин
                        this.loadStatistics(true);
                        this.forceUpdateOnNextShow = false;
                    }
                }
            });

            // Кнопка оновлення статистики
            const refreshButton = document.getElementById('refresh-stats-button');
            if (refreshButton) {
                refreshButton.addEventListener('click', () => {
                    this.loadStatistics(true);
                });
            }
        },

        // Відновлення даних з кешу
        restoreFromCache: function() {
            try {
                const cachedStats = localStorage.getItem('winix_raffle_statistics');
                if (cachedStats) {
                    const parsedStats = JSON.parse(cachedStats);
                    if (parsedStats && parsedStats.timestamp && parsedStats.data) {
                        // Перевіряємо актуальність даних
                        const now = Date.now();
                        const cacheAge = now - parsedStats.timestamp;

                        if (cacheAge < 3600000) { // 1 година
                            console.log('📊 Відновлено статистику з кешу');
                            this.statsData = parsedStats.data;
                            this.lastUpdate = parsedStats.timestamp;

                            // Також відновлюємо історію, якщо вона є
                            if (parsedStats.history) {
                                this.statsHistory = parsedStats.history;
                            }

                            return true;
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ Помилка відновлення статистики з кешу:', e);
            }

            return false;
        },

        // Збереження даних у кеш
        saveToCache: function() {
            try {
                const cacheData = {
                    timestamp: this.lastUpdate,
                    data: this.statsData,
                    history: this.statsHistory
                };

                localStorage.setItem('winix_raffle_statistics', JSON.stringify(cacheData));
            } catch (e) {
                console.warn('⚠️ Помилка збереження статистики в кеш:', e);
            }
        },

        // Завантаження статистики розіграшів
        loadStatistics: async function(forceRefresh = false) {
            // Запобігаємо паралельним запитам
            if (this.isLoading) {
                console.log('📊 Завантаження статистики вже виконується...');
                return;
            }

            const userId = WinixRaffles.state.telegramId ||
                          (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function' ?
                           window.WinixAPI.getUserId() : null);

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

            this.isLoading = true;
            this.hasLoadingErrors = false;

            // Показуємо індикатор завантаження в блоках статистики
            this.showLoadingState();

            try {
                console.log('📊 Завантаження статистики розіграшів...');

                // ВИПРАВЛЕННЯ: Додано налаштування запиту для оптимізації
                const requestOptions = {
                    method: 'GET',
                    timeout: 10000,
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'X-Timestamp': now // Додаємо випадковий параметр для уникнення кешування
                    }
                };

                // Виконуємо запит із захистом від помилок
                let response;

                // Спочатку спробуємо отримати повні дані профілю з статистикою
                if (typeof window.WinixAPI !== 'undefined' && typeof window.WinixAPI.getUserData === 'function') {
                    response = await window.WinixAPI.getUserData(true, requestOptions);
                } else {
                    // Запасний варіант через прямий запит
                    response = await this.fallbackStatisticsRequest(userId, requestOptions);
                }

                // Обробка результату
                if (response && response.status === 'success' && response.data) {
                    // Зберігаємо і обробляємо дані
                    this.processStatisticsData(response.data, now);
                } else if (response && response.status === 'error') {
                    console.error('❌ Помилка завантаження статистики:', response.message);
                    this.hasLoadingErrors = true;

                    // Повідомлення для користувача, якщо це не просто тайм-аут або відсутність інтернету
                    if (response.message &&
                        !response.message.includes('timeout') &&
                        !response.message.includes('network')) {
                        this.showErrorMessage(response.message);
                    }

                    // Використовуємо кешовані дані
                    if (this.statsData) {
                        this.renderStatistics(this.statsData);
                    } else {
                        this.renderEmptyStatistics('Помилка завантаження даних');
                    }
                } else {
                    console.error('❌ Неправильний формат відповіді:', response);
                    this.hasLoadingErrors = true;

                    // Використовуємо кешовані дані або показуємо пусту статистику
                    if (this.statsData) {
                        this.renderStatistics(this.statsData);
                    } else {
                        this.renderEmptyStatistics('Неправильний формат відповіді');
                    }
                }
            } catch (error) {
                console.error('❌ Помилка завантаження статистики розіграшів:', error);
                this.hasLoadingErrors = true;

                // Використовуємо кешовані дані або показуємо пусту статистику
                if (this.statsData) {
                    this.renderStatistics(this.statsData);
                } else {
                    this.renderEmptyStatistics('Помилка завантаження даних');
                }
            } finally {
                this.isLoading = false;

                // Приховуємо індикатор завантаження
                this.hideLoadingState();
            }
        },

        // Запасний запит для отримання статистики
        fallbackStatisticsRequest: async function(userId, options = {}) {
            if (!userId) return null;

            try {
                const endpoint = `/api/user/${userId}/statistics`;

                if (typeof window.WinixAPI !== 'undefined' && typeof window.WinixAPI.apiRequest === 'function') {
                    // ВИПРАВЛЕННЯ: Передаємо додаткові опції для запиту
                    return await window.WinixAPI.apiRequest(endpoint, 'GET', null, {
                        suppressErrors: true,
                        hideLoader: true,
                        timeout: 10000,
                        headers: options.headers || {},
                        cache: 'no-cache'
                    });
                } else {
                    // Прямий запит через fetch, якщо WinixAPI недоступний
                    const fetchOptions = {
                        method: 'GET',
                        cache: 'no-cache',
                        headers: options.headers || {}
                    };

                    const response = await fetch(endpoint, fetchOptions);
                    return await response.json();
                }
            } catch (error) {
                console.error('❌ Помилка запасного запиту статистики:', error);
                return {
                    status: 'error',
                    message: error.message || 'Помилка запиту статистики'
                };
            }
        },

        // Обробка отриманих даних статистики
        processStatisticsData: function(data, timestamp) {
            if (!data) return;

            // Створюємо нормалізовані дані статистики
            const normalizedData = {
                participations_count: 0,
                wins_count: 0,
                total_winnings: 0,
                tokens_spent: 0,
                win_rate: 0,
                activity_data: [],
                last_participation: null,
                last_win: null
            };

            // Заповнюємо основні показники
            if (data.participations_count !== undefined) {
                normalizedData.participations_count = data.participations_count;
            } else if (data.totalParticipations !== undefined) {
                normalizedData.participations_count = data.totalParticipations;
            }

            if (data.wins_count !== undefined) {
                normalizedData.wins_count = data.wins_count;
            } else if (data.totalWins !== undefined) {
                normalizedData.wins_count = data.totalWins;
            }

            if (data.total_winnings !== undefined) {
                normalizedData.total_winnings = data.total_winnings;
            } else if (data.totalWinnings !== undefined) {
                normalizedData.total_winnings = data.totalWinnings;
            } else if (normalizedData.wins_count > 0) {
                // Якщо немає прямих даних, робимо розрахунок на основі кількості перемог
                // з середнім призом 15000 WINIX за перемогу
                normalizedData.total_winnings = normalizedData.wins_count * 15000;
            }

            if (data.tokens_spent !== undefined) {
                normalizedData.tokens_spent = data.tokens_spent;
            } else if (data.tokensSpent !== undefined) {
                normalizedData.tokens_spent = data.tokensSpent;
            } else if (normalizedData.participations_count > 0) {
                // Приблизний розрахунок витрачених жетонів
                // В середньому 2 жетони за участь
                normalizedData.tokens_spent = normalizedData.participations_count * 2;
            }

            // Розрахунок відсотка перемог
            if (normalizedData.participations_count > 0) {
                normalizedData.win_rate = (normalizedData.wins_count / normalizedData.participations_count) * 100;
            }

            // Обробка даних активності, якщо вони є
            if (data.activity_data && Array.isArray(data.activity_data)) {
                normalizedData.activity_data = data.activity_data;
            } else if (data.activityData && Array.isArray(data.activityData)) {
                normalizedData.activity_data = data.activityData;
            } else {
                // Якщо немає даних активності, створюємо випадкові дані для графіка
                // Це тимчасове рішення, в реальній системі потрібно отримати справжні дані
                normalizedData.activity_data = this.generateSampleActivityData(normalizedData.participations_count);
            }

            // Дані про останні події
            if (data.last_participation) {
                normalizedData.last_participation = data.last_participation;
            }

            if (data.last_win) {
                normalizedData.last_win = data.last_win;
            }

            // Зберігаємо оброблені дані
            this.statsData = normalizedData;
            this.lastUpdate = timestamp || Date.now();

            // Оновлюємо історію показників для графіків
            this.updateStatsHistory(normalizedData);

            // Зберігаємо у кеш
            this.saveToCache();

            // Відображаємо статистику
            this.renderStatistics(normalizedData);
        },

        // Оновлення історії статистики для графіків
        updateStatsHistory: function(newData) {
            if (!newData) return;

            // Максимальний розмір історії - 10 записів
            const MAX_HISTORY_SIZE = 10;

            // Створюємо новий запис з поточною датою
            const newEntry = {
                timestamp: Date.now(),
                participations: newData.participations_count,
                wins: newData.wins_count,
                winnings: newData.total_winnings,
                tokens: newData.tokens_spent
            };

            // Додаємо запис до історії
            this.statsHistory.push(newEntry);

            // Обмежуємо розмір історії
            if (this.statsHistory.length > MAX_HISTORY_SIZE) {
                this.statsHistory = this.statsHistory.slice(-MAX_HISTORY_SIZE);
            }
        },

        // Створення зразкових даних активності (для тимчасового рішення)
        generateSampleActivityData: function(totalParticipations) {
            const data = [];

            // Кількість зразкових даних
            const DAYS_COUNT = 7;

            // Якщо немає участей, повертаємо порожній масив
            if (!totalParticipations || totalParticipations <= 0) {
                return Array(DAYS_COUNT).fill(0).map((_, i) => ({
                    day: this.getDayName(i),
                    count: 0
                }));
            }

            // Розподіляємо загальну кількість участей на останні 7 днів
            // з випадковим розподілом
            let remaining = totalParticipations;

            for (let i = 0; i < DAYS_COUNT - 1; i++) {
                // Випадкова частка від залишку, але не більше 80%
                const maxShare = Math.min(0.8, (DAYS_COUNT - i - 1) / (DAYS_COUNT - i));
                const share = Math.random() * maxShare;

                const count = Math.round(remaining * share);
                remaining -= count;

                data.push({
                    day: this.getDayName(i),
                    count: count
                });
            }

            // Останній день отримує залишок
            data.push({
                day: this.getDayName(DAYS_COUNT - 1),
                count: remaining
            });

            return data;
        },

        // Отримання назви дня тижня за індексом
        getDayName: function(index) {
            const today = new Date();
            const targetDate = new Date(today);

            // Обчислюємо дату, віднімаючи потрібну кількість днів
            targetDate.setDate(today.getDate() - (6 - index));

            // Отримуємо день тижня
            const dayOfWeek = targetDate.getDay();

            // Локалізовані назви днів
            const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            return dayNames[dayOfWeek];
        },

        // Показ стану завантаження в елементах статистики
        showLoadingState: function() {
            // Встановлюємо клас loading для елементів статистики
            document.querySelectorAll('.stat-value').forEach(element => {
                element.classList.add('loading');
                element.setAttribute('data-original-value', element.textContent);
                element.textContent = '···';
            });

            // Додаємо клас loading для контейнера графіка
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                chartContainer.classList.add('loading');
            }
        },

        // Приховування стану завантаження
        hideLoadingState: function() {
            // Видаляємо клас loading з елементів статистики
            document.querySelectorAll('.stat-value.loading').forEach(element => {
                element.classList.remove('loading');

                // Відновлюємо оригінальне значення, якщо не було оновлень
                const originalValue = element.getAttribute('data-original-value');
                if (originalValue && element.textContent === '···') {
                    element.textContent = originalValue;
                }

                element.removeAttribute('data-original-value');
            });

            // Видаляємо клас loading з контейнера графіка
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                chartContainer.classList.remove('loading');
            }
        },

        // Показ повідомлення про помилку
        showErrorMessage: function(message) {
            // Якщо доступна функція showToast, використовуємо її
            if (typeof window.showToast === 'function') {
                window.showToast(message, 'error');
                return;
            }

            // Альтернативний варіант - створення власного повідомлення про помилку
            let errorContainer = document.getElementById('stats-error-message');

            if (!errorContainer) {
                errorContainer = document.createElement('div');
                errorContainer.id = 'stats-error-message';
                errorContainer.className = 'stats-error-message';

                // Стилі для повідомлення про помилку
                errorContainer.style.cssText = `
                    color: #e74c3c;
                    background-color: rgba(231, 76, 60, 0.1);
                    border-left: 3px solid #e74c3c;
                    padding: 10px 15px;
                    margin: 10px 0;
                    border-radius: 4px;
                    font-size: 14px;
                `;

                // Додаємо до контейнера статистики
                const statsContainer = document.querySelector('.statistics-container');
                if (statsContainer) {
                    statsContainer.prepend(errorContainer);
                } else {
                    // Якщо контейнер не знайдено, додаємо до тіла документа
                    document.body.prepend(errorContainer);
                }
            }

            // Встановлюємо текст повідомлення
            errorContainer.textContent = message || 'Помилка завантаження статистики';

            // Показуємо повідомлення
            errorContainer.style.display = 'block';

            // Автоматично ховаємо через 5 секунд
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        },

        // Відображення статистики розіграшів
        renderStatistics: function(userData) {
            if (!userData) {
                this.renderEmptyStatistics();
                return;
            }

            // Оновлюємо значення в блоках статистики з анімацією
            this.updateStatValue('total-participated', userData.participations_count || 0);
            this.updateStatValue('total-wins', userData.wins_count || 0);
            this.updateStatValue('total-winix-won', userData.total_winnings || 0);
            this.updateStatValue('total-tokens-spent', userData.tokens_spent || 0);

            // Створюємо графік активності
            this.createActivityChart(userData.activity_data);

            // Перевіряємо наявність елемента win-rate і оновлюємо його, якщо він є
            const winRateElement = document.getElementById('win-rate');
            if (winRateElement) {
                const winRate = userData.win_rate || 0;
                this.updateStatValue('win-rate', winRate.toFixed(1) + '%');
            }

            // Додаємо статус оновлення
            this.updateLastUpdateTime();

            // Оновлюємо статус кнопки оновлення
            const refreshButton = document.getElementById('refresh-stats-button');
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.classList.remove('loading');
            }
        },

        // Оновлення часу останнього оновлення
        updateLastUpdateTime: function() {
            const lastUpdateElement = document.getElementById('last-update-time');
            if (!lastUpdateElement) return;

            // Форматуємо час оновлення
            const now = new Date();
            const lastUpdate = new Date(this.lastUpdate);

            // Якщо оновлення було сьогодні, показуємо тільки час
            if (now.toDateString() === lastUpdate.toDateString()) {
                const time = lastUpdate.toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                lastUpdateElement.textContent = 'Оновлено о ' + time;
            } else {
                // Інакше показуємо і дату, і час
                const dateTime = lastUpdate.toLocaleString('uk-UA', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                lastUpdateElement.textContent = 'Оновлено ' + dateTime;
            }

            // Показуємо елемент
            lastUpdateElement.style.display = 'block';

            // Якщо були помилки, додаємо індикатор
            if (this.hasLoadingErrors) {
                lastUpdateElement.classList.add('has-errors');
                lastUpdateElement.title = 'Виникли проблеми при останньому оновленні даних';
            } else {
                lastUpdateElement.classList.remove('has-errors');
                lastUpdateElement.title = '';
            }
        },

        // Оновлення значення статистики з анімацією
        updateStatValue: function(elementId, value) {
            const element = document.getElementById(elementId);
            if (!element) return;

            // Отримуємо поточне та нове значення
            const currentValue = parseInt(element.textContent.replace(/\s+/g, '')) || 0;
            const newValue = typeof value === 'number' ? value : parseInt(value) || 0;

            // Якщо значення змінилося, запускаємо анімацію
            if (currentValue !== newValue) {
                // Зберігаємо початкове значення
                const startValue = currentValue;

                // Визначаємо крок анімації
                const diff = newValue - startValue;
                const duration = 1000; // мс
                const steps = 20;
                const step = diff / steps;

                // Анімуємо зміну
                let currentStep = 0;
                const animationInterval = setInterval(() => {
                    currentStep++;

                    if (currentStep >= steps) {
                        clearInterval(animationInterval);
                        // Встановлюємо кінцеве значення з форматуванням
                        element.textContent = this.formatNumber(newValue);
                        element.classList.add('stat-updated');

                        // Видаляємо клас через 1 секунду
                        setTimeout(() => {
                            element.classList.remove('stat-updated');
                        }, 1000);
                    } else {
                        // Встановлюємо проміжне значення
                        const intermediateValue = Math.round(startValue + step * currentStep);
                        element.textContent = this.formatNumber(intermediateValue);
                    }
                }, duration / steps);
            } else {
                // Якщо значення не змінилося, просто форматуємо його
                element.textContent = this.formatNumber(newValue);
            }
        },

        // Форматування числа з розділювачами розрядів
        formatNumber: function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        // Створення графіка активності
        createActivityChart: function(activityData) {
            const chartContainer = document.querySelector('.chart-container');
            if (!chartContainer) return;

            // Якщо немає даних для графіка, показуємо повідомлення
            if (!activityData || !Array.isArray(activityData) || activityData.length === 0) {
                chartContainer.innerHTML = '<div class="chart-placeholder">Недостатньо даних для відображення графіку активності</div>';
                return;
            }

            // Знаходимо максимальне значення для масштабування
            const maxValue = Math.max(...activityData.map(item => item.count || 0));

            // Якщо немає активності, показуємо порожній графік
            if (maxValue === 0) {
                chartContainer.innerHTML = '<div class="chart-placeholder">Немає даних про активність</div>';
                return;
            }

            // Очищаємо контейнер
            chartContainer.innerHTML = '';

            // Створюємо заголовок графіка
            const chartTitle = document.createElement('div');
            chartTitle.className = 'chart-title';
            chartTitle.textContent = 'Активність за останній тиждень';
            chartContainer.appendChild(chartTitle);

            // Створюємо контейнер для стовпців
            const barsContainer = document.createElement('div');
            barsContainer.className = 'chart-bars-container';
            chartContainer.appendChild(barsContainer);

            // Додаємо кожен стовпець
            activityData.forEach(item => {
                // Створюємо групу для стовпця
                const barGroup = document.createElement('div');
                barGroup.className = 'chart-bar-group';

                // Створюємо стовпець
                const bar = document.createElement('div');
                bar.className = 'chart-bar';

                // Обчислюємо висоту стовпця (у відсотках від максимального значення)
                const heightPercent = Math.max(5, (item.count / maxValue) * 100);
                bar.style.height = `${heightPercent}%`;

                // Додаємо анімацію появи
                bar.style.animation = 'grow-up 1s ease-out';

                // Додаємо атрибут з кількістю для підказки
                bar.setAttribute('data-count', item.count);

                // Додаємо підпис
                const label = document.createElement('div');
                label.className = 'chart-label';
                label.textContent = item.day;

                // Додаємо стовпець і підпис до групи
                barGroup.appendChild(bar);
                barGroup.appendChild(label);

                // Додаємо групу до контейнера
                barsContainer.appendChild(barGroup);
            });
        },

        // Відображення порожньої статистики
        renderEmptyStatistics: function(errorMessage = null) {
            // Встановлюємо нульові значення для всіх полів статистики
            this.updateStatValue('total-participated', 0);
            this.updateStatValue('total-wins', 0);
            this.updateStatValue('total-winix-won', 0);
            this.updateStatValue('total-tokens-spent', 0);

            // Якщо є win-rate, оновлюємо і його
            const winRateElement = document.getElementById('win-rate');
            if (winRateElement) {
                this.updateStatValue('win-rate', '0.0%');
            }

            // Оновлюємо графік
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                // Встановлюємо повідомлення залежно від наявності помилки
                if (errorMessage) {
                    chartContainer.innerHTML = `<div class="chart-placeholder error">${errorMessage}</div>`;
                } else {
                    chartContainer.innerHTML = '<div class="chart-placeholder">Недостатньо даних для відображення графіку активності</div>';
                }
            }

            // Оновлюємо статус кнопки оновлення
            const refreshButton = document.getElementById('refresh-stats-button');
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.classList.remove('loading');
            }
        },

        // Ін'єкція стилів для графіків
        injectChartStyles: function() {
            if (document.getElementById('statistics-chart-styles')) return;

            const style = document.createElement('style');
            style.id = 'statistics-chart-styles';
            style.textContent = `
                /* Стилі для контейнера графіка */
                .chart-container {
                    height: 200px;
                    margin: 20px 0;
                    padding: 15px;
                    background-color: rgba(30, 39, 70, 0.5);
                    border-radius: 10px;
                    position: relative;
                    transition: opacity 0.3s ease;
                }
                
                .chart-container.loading {
                    opacity: 0.5;
                }
                
                /* Заголовок графіка */
                .chart-title {
                    text-align: center;
                    color: #fff;
                    margin-bottom: 10px;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                /* Контейнер для стовпців */
                .chart-bars-container {
                    display: flex;
                    justify-content: space-around;
                    align-items: flex-end;
                    height: 150px;
                }
                
                /* Група для стовпця і підпису */
                .chart-bar-group {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: calc(100% / 8);
                    height: 100%;
                    position: relative;
                }
                
                /* Стовпець графіка */
                .chart-bar {
                    width: 80%;
                    background: linear-gradient(to top, rgba(78, 181, 247, 0.8), rgba(0, 201, 167, 0.8));
                    border-radius: 4px 4px 0 0;
                    transition: height 0.5s ease;
                    position: relative;
                }
                
                /* Підпис під стовпцем */
                .chart-label {
                    margin-top: 5px;
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 12px;
                }
                
                /* Підказка при наведенні */
                .chart-bar::before {
                    content: attr(data-count);
                    position: absolute;
                    top: -25px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12px;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                    white-space: nowrap;
                }
                
                .chart-bar:hover::before {
                    opacity: 1;
                }
                
                /* Анімація росту стовпця */
                @keyframes grow-up {
                    from { height: 0; }
                    to { height: var(--height); }
                }
                
                /* Коли немає даних для графіка */
                .chart-placeholder {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: rgba(255, 255, 255, 0.6);
                    text-align: center;
                    font-size: 14px;
                    width: 80%;
                }
                
                .chart-placeholder.error {
                    color: rgba(231, 76, 60, 0.8);
                }
                
                /* Стилі для анімації оновлення значень */
                @keyframes stat-pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                
                .stat-updated {
                    animation: stat-pulse 0.5s ease-in-out;
                    transition: color 0.3s ease;
                    color: rgba(0, 201, 167, 1) !important;
                }
                
                /* Стилі для значень в стані завантаження */
                .stat-value.loading {
                    opacity: 0.5;
                }
                
                /* Стилі для часу оновлення */
                #last-update-time {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                    text-align: center;
                    margin-top: 10px;
                }
                
                #last-update-time.has-errors {
                    color: rgba(231, 76, 60, 0.8);
                }
                
                /* Стилі для кнопки оновлення */
                #refresh-stats-button {
                    background: linear-gradient(90deg, rgba(78, 181, 247, 0.8), rgba(0, 201, 167, 0.8));
                    border: none;
                    border-radius: 20px;
                    color: white;
                    font-size: 14px;
                    padding: 8px 15px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    transition: all 0.3s ease;
                    margin: 10px auto;
                }
                
                #refresh-stats-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }
                
                #refresh-stats-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                #refresh-stats-button.loading::after {
                    content: "";
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-left: 5px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;

            document.head.appendChild(style);
        },

        // Оновлення даних статистики
        refreshStatistics: function() {
            // Блокуємо кнопку оновлення
            const refreshButton = document.getElementById('refresh-stats-button');
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.classList.add('loading');
            }

            // Запускаємо завантаження з примусовим оновленням
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