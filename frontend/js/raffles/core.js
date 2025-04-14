/**
 * WINIX - Система розіграшів (core.js)
 * Основний модуль для керування функціоналом розіграшів WINIX
 * Взаємодіє з API бекенда та відображає дані у користувацькому інтерфейсі
 */

const WinixRaffles = {
    // Налаштування
    config: {
        autoRefreshInterval: 120000, // Інтервал автооновлення (2 хвилини)
        activeRafflesEndpoint: '/api/raffles',
        historyEndpoint: '/api/user/{userId}/raffles-history',
        participateEndpoint: '/api/user/{userId}/participate-raffle',
        userRafflesEndpoint: '/api/user/{userId}/raffles',
        statisticsEndpoint: '/api/user/{userId}/balance'
    },

    // Стан системи
    state: {
        activeTab: 'active',
        telegramId: null,
        activeRaffles: [],
        pastRaffles: [],
        userRaffles: [],
        userStats: null,
        refreshTimers: {},
        isInitialized: false,
        isLoading: false
    },

    // Ініціалізація системи
    init: function() {
        // Перевірка чи система вже ініціалізована
        if (this.state.isInitialized) return;

        console.log('🎲 Ініціалізація системи розіграшів WINIX...');

        // Отримання ID користувача
        this.state.telegramId = WinixAPI.getUserId();
        if (!this.state.telegramId) {
            console.warn('⚠️ ID користувача не знайдено! Деякі функції будуть недоступні.');
        }

        // Ініціалізація підсистем
        this.initTabs();
        this.initTimers();
        this.initEventListeners();

        // Завантаження даних
        this.loadInitialData();

        this.state.isInitialized = true;
        console.log('✅ Система розіграшів WINIX успішно ініціалізована');
    },

    // Ініціалізація вкладок
    initTabs: function() {
        const tabButtons = document.querySelectorAll('.tab-button');

        // Додаємо обробники для вкладок
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.activateTab(tabName);
            });
        });

        // Активуємо поточну вкладку (або вкладку за замовчуванням)
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');

        if (tabParam && ['active', 'past', 'stats'].includes(tabParam)) {
            this.activateTab(tabParam);
        } else {
            this.activateTab('active'); // Вкладка за замовчуванням
        }
    },

    // Активація вкладки
    activateTab: function(tabName) {
        // Оновлюємо стан
        this.state.activeTab = tabName;

        // Оновлюємо кнопки вкладок
        document.querySelectorAll('.tab-button').forEach(button => {
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Оновлюємо вміст вкладок
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === `${tabName}-raffles`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Завантажуємо дані для вкладки
        switch(tabName) {
            case 'active':
                this.loadActiveRaffles();
                break;
            case 'past':
                this.loadRafflesHistory();
                break;
            case 'stats':
                this.loadRafflesStatistics();
                break;
        }
    },

    // Ініціалізація таймерів
    initTimers: function() {
        // Очищення існуючих таймерів
        Object.values(this.state.refreshTimers).forEach(timer => {
            clearInterval(timer);
        });

        this.state.refreshTimers = {};

        // Таймер для автооновлення активних розіграшів
        this.state.refreshTimers.activeRaffles = setInterval(() => {
            if (this.state.activeTab === 'active') {
                this.loadActiveRaffles(true);
            }
        }, this.config.autoRefreshInterval);
    },

    // Ініціалізація обробників подій
    initEventListeners: function() {
        // Обробник для кнопок участі в розіграшах
        document.addEventListener('click', (e) => {
            // Головна кнопка участі
            if (e.target.classList.contains('join-button')) {
                const raffleId = e.target.getAttribute('data-raffle-id');
                const raffleType = e.target.getAttribute('data-raffle-type');

                if (raffleId) {
                    e.preventDefault();
                    this.participateInRaffle(raffleId, raffleType);
                }
            }

            // Міні-кнопки участі
            if (e.target.classList.contains('mini-raffle-button')) {
                const raffleId = e.target.getAttribute('data-raffle-id');
                const raffleType = e.target.getAttribute('data-raffle-type');

                if (raffleId) {
                    e.preventDefault();
                    this.participateInRaffle(raffleId, raffleType);
                }
            }

            // Картка історії
            if (e.target.closest('.history-card')) {
                const historyCard = e.target.closest('.history-card');
                const raffleId = historyCard.getAttribute('data-raffle-id');

                if (raffleId) {
                    e.preventDefault();
                    this.showRaffleDetails(raffleId);
                }
            }
        });

        // Обробник оновлення даних користувача
        document.addEventListener('user-data-updated', (e) => {
            // Оновлюємо відображення балансу
            this.updateUserBalance(e.detail);

            // Перевіряємо чи потрібно оновити розіграші
            if (this.state.activeTab === 'active') {
                this.updateParticipationButtons();
            }
        });
    },

    // Завантаження початкових даних
    loadInitialData: function() {
        // Завантажуємо баланс користувача
        this.loadUserBalance();

        // Завантажуємо розіграші, у яких бере участь користувач
        this.loadUserRaffles();
    },

    // Завантаження балансу користувача
    loadUserBalance: async function() {
        if (!this.state.telegramId) return;

        try {
            const response = await WinixAPI.getBalance();

            if (response.status === 'success' && response.data) {
                this.updateUserBalance(response.data);
            }
        } catch (error) {
            console.error('❌ Помилка завантаження балансу:', error);
        }
    },

    // Оновлення відображення балансу користувача
    updateUserBalance: function(userData) {
        // Оновлюємо відображення жетонів
        if (userData.coins !== undefined) {
            const coinsElements = document.querySelectorAll('.user-coins');
            coinsElements.forEach(element => {
                element.textContent = userData.coins;
            });
        }

        // Оновлюємо відображення балансу
        if (userData.balance !== undefined) {
            const balanceElements = document.querySelectorAll('.user-balance');
            balanceElements.forEach(element => {
                element.textContent = userData.balance;
            });
        }
    },

    // Завантаження розіграшів, у яких бере участь користувач
    loadUserRaffles: async function() {
        if (!this.state.telegramId) return;

        try {
            const endpoint = this.config.userRafflesEndpoint.replace('{userId}', this.state.telegramId);
            const response = await WinixAPI.apiRequest(endpoint);

            if (response.status === 'success' && Array.isArray(response.data)) {
                this.state.userRaffles = response.data;
                this.updateParticipationButtons();
            }
        } catch (error) {
            console.error('❌ Помилка завантаження розіграшів користувача:', error);
        }
    },

    // Оновлення кнопок участі в розіграшах
    updateParticipationButtons: function() {
        // Створюємо набір ID розіграшів, у яких бере участь користувач
        const participatingRaffles = new Set();
        this.state.userRaffles.forEach(raffle => {
            participatingRaffles.add(raffle.raffle_id);
        });

        // Оновлюємо головну кнопку участі
        const mainJoinButton = document.querySelector('.join-button');
        if (mainJoinButton) {
            const raffleId = mainJoinButton.getAttribute('data-raffle-id');

            if (raffleId && participatingRaffles.has(raffleId)) {
                mainJoinButton.textContent = 'Ви вже берете участь';
                mainJoinButton.classList.add('participating');
                mainJoinButton.disabled = true;
            }
        }

        // Оновлюємо кнопки міні-розіграшів
        const miniButtons = document.querySelectorAll('.mini-raffle-button');
        miniButtons.forEach(button => {
            const raffleId = button.getAttribute('data-raffle-id');

            if (raffleId && participatingRaffles.has(raffleId)) {
                button.textContent = 'Ви вже берете участь';
                button.classList.add('participating');
                button.disabled = true;
            }
        });
    },

    // Завантаження активних розіграшів
    loadActiveRaffles: async function(quiet = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;

        if (!quiet) {
            this.showLoading();
        }

        try {
            const response = await WinixAPI.apiRequest(this.config.activeRafflesEndpoint);

            if (response.status === 'success' && Array.isArray(response.data)) {
                this.state.activeRaffles = response.data;
                this.renderActiveRaffles(response.data);
            } else {
                console.error('❌ Неправильний формат відповіді:', response);
                this.renderEmptyActiveRaffles();
            }
        } catch (error) {
            console.error('❌ Помилка завантаження активних розіграшів:', error);
            this.renderEmptyActiveRaffles();
        } finally {
            this.state.isLoading = false;
            if (!quiet) {
                this.hideLoading();
            }
        }
    },

    // Відображення активних розіграшів
    renderActiveRaffles: function(raffles) {
        // Очищаємо всі таймери зворотного відліку
        Object.keys(this.state.refreshTimers).forEach(key => {
            if (key.startsWith('countdown_')) {
                clearInterval(this.state.refreshTimers[key]);
                delete this.state.refreshTimers[key];
            }
        });

        // Розділяємо на головний та міні-розіграші
        const mainRaffles = raffles.filter(raffle => !raffle.is_daily);
        const miniRaffles = raffles.filter(raffle => raffle.is_daily);

        // Відображаємо головний розіграш
        const mainRaffleContainer = document.querySelector('.main-raffle');
        if (mainRaffleContainer) {
            if (mainRaffles.length > 0) {
                const mainRaffle = mainRaffles[0];
                this.renderMainRaffle(mainRaffleContainer, mainRaffle);
            } else {
                mainRaffleContainer.innerHTML = `
                    <div class="main-raffle-content">
                        <h3 class="main-raffle-title">На даний момент немає активних головних розіграшів</h3>
                        <div class="main-raffle-prize">Незабаром буде опубліковано новий розіграш</div>
                    </div>
                `;
            }
        }

        // Відображаємо міні-розіграші
        const miniRafflesContainer = document.querySelector('.mini-raffles-container');
        if (miniRafflesContainer) {
            if (miniRaffles.length > 0) {
                miniRafflesContainer.innerHTML = '';
                miniRaffles.forEach(raffle => {
                    miniRafflesContainer.appendChild(this.createMiniRaffleElement(raffle));
                });
            } else {
                miniRafflesContainer.innerHTML = `
                    <div class="mini-raffle">
                        <div class="mini-raffle-info">
                            <h3 class="mini-raffle-title">Щоденні розіграші</h3>
                            <div class="mini-raffle-prize">На даний момент немає активних щоденних розіграшів</div>
                            <div class="mini-raffle-time">Перевірте пізніше</div>
                        </div>
                    </div>
                `;
            }
        }

        // Оновлюємо кнопки участі
        this.updateParticipationButtons();
    },

    // Відображення пустого стану активних розіграшів
    renderEmptyActiveRaffles: function() {
        const mainRaffleContainer = document.querySelector('.main-raffle');
        if (mainRaffleContainer) {
            mainRaffleContainer.innerHTML = `
                <div class="main-raffle-content">
                    <h3 class="main-raffle-title">Не вдалося завантажити розіграші</h3>
                    <div class="main-raffle-prize">Спробуйте оновити сторінку</div>
                </div>
            `;
        }

        const miniRafflesContainer = document.querySelector('.mini-raffles-container');
        if (miniRafflesContainer) {
            miniRafflesContainer.innerHTML = `
                <div class="mini-raffle">
                    <div class="mini-raffle-info">
                        <h3 class="mini-raffle-title">Помилка завантаження</h3>
                        <div class="mini-raffle-prize">Не вдалося завантажити щоденні розіграші</div>
                    </div>
                </div>
            `;
        }
    },

    // Відображення головного розіграшу
    renderMainRaffle: function(container, raffle) {
        const endTime = new Date(raffle.end_time);
        const formattedEndTime = this.formatDateTime(endTime);

        // Розрахунок прогресу заповнення
        const progress = Math.min(Math.round((raffle.participants_count / 1000) * 100), 100);

        container.innerHTML = `
            <img src="${raffle.image_url || 'assets/prize-poster.gif'}" alt="${raffle.title}" class="main-raffle-image">
            <div class="main-raffle-content">
                <div class="main-raffle-header">
                    <h3 class="main-raffle-title">${raffle.title}</h3>
                    <div class="main-raffle-cost">
                        <img src="assets/token-icon.png" alt="Жетони" class="token-icon">
                        <span>${raffle.entry_fee}</span>
                    </div>
                </div>

                <div class="main-raffle-prize">Призовий фонд: ${raffle.prize_amount} ${raffle.prize_currency}</div>

                <div class="timer-container" id="timer-container-${raffle.id}">
                    <div class="timer-block">
                        <div class="timer-value" id="days-${raffle.id}">00</div>
                        <div class="timer-label">Дні</div>
                    </div>
                    <div class="timer-block">
                        <div class="timer-value" id="hours-${raffle.id}">00</div>
                        <div class="timer-label">Години</div>
                    </div>
                    <div class="timer-block">
                        <div class="timer-value" id="minutes-${raffle.id}">00</div>
                        <div class="timer-label">Хвилини</div>
                    </div>
                    <div class="timer-block">
                        <div class="timer-value" id="seconds-${raffle.id}">00</div>
                        <div class="timer-label">Секунди</div>
                    </div>
                </div>

                <div class="main-raffle-participants">
                    <div class="participants-info">
                        Учасників: <span class="participants-count">${raffle.participants_count}</span>
                    </div>
                    <div class="participants-info">
                        Переможців: <span class="participants-count">${raffle.winners_count}</span>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress" style="width: ${progress}%"></div>
                </div>

                <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">
                    Взяти участь за ${raffle.entry_fee} жетони
                </button>
            </div>
        `;

        // Запускаємо таймер зворотного відліку
        this.startCountdown(raffle.id, endTime);
    },

    // Створення елемента міні-розіграшу
    createMiniRaffleElement: function(raffle) {
        const miniRaffle = document.createElement('div');
        miniRaffle.className = 'mini-raffle';

        // Форматування часу завершення
        const endTime = new Date(raffle.end_time);
        const now = new Date();
        const isToday = endTime.getDate() === now.getDate() &&
                        endTime.getMonth() === now.getMonth() &&
                        endTime.getFullYear() === now.getFullYear();

        const endTimeText = isToday
            ? `сьогодні о ${this.formatTime(endTime)}`
            : `${this.formatDate(endTime)} о ${this.formatTime(endTime)}`;

        miniRaffle.innerHTML = `
            <div class="mini-raffle-info">
                <h3 class="mini-raffle-title">${raffle.title}</h3>
                <div class="mini-raffle-cost">
                    <img src="assets/token-icon.png" alt="Жетони" class="token-icon">
                    <span>${raffle.entry_fee}</span>
                </div>
                <div class="mini-raffle-prize">Приз: ${raffle.prize_amount} ${raffle.prize_currency}</div>
                <div class="mini-raffle-time">Завершення: ${endTimeText}</div>
            </div>
            <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-raffle-type="daily">Взяти участь</button>
        `;

        return miniRaffle;
    },

    // Запуск таймера зворотного відліку
    startCountdown: function(raffleId, endTime) {
        // Очищаємо попередній таймер, якщо є
        if (this.state.refreshTimers[`countdown_${raffleId}`]) {
            clearInterval(this.state.refreshTimers[`countdown_${raffleId}`]);
        }

        const updateTimer = () => {
            const now = new Date().getTime();
            const timeLeft = endTime.getTime() - now;

            // Якщо час вийшов, оновлюємо список розіграшів
            if (timeLeft <= 0) {
                clearInterval(this.state.refreshTimers[`countdown_${raffleId}`]);

                document.getElementById(`days-${raffleId}`).textContent = '00';
                document.getElementById(`hours-${raffleId}`).textContent = '00';
                document.getElementById(`minutes-${raffleId}`).textContent = '00';
                document.getElementById(`seconds-${raffleId}`).textContent = '00';

                // Оновлюємо список розіграшів через 2 секунди
                setTimeout(() => this.loadActiveRaffles(), 2000);
                return;
            }

            // Розрахунок днів, годин, хвилин, секунд
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            // Оновлення елементів таймера
            document.getElementById(`days-${raffleId}`).textContent = days.toString().padStart(2, '0');
            document.getElementById(`hours-${raffleId}`).textContent = hours.toString().padStart(2, '0');
            document.getElementById(`minutes-${raffleId}`).textContent = minutes.toString().padStart(2, '0');
            document.getElementById(`seconds-${raffleId}`).textContent = seconds.toString().padStart(2, '0');
        };

        // Запускаємо перше оновлення таймера
        updateTimer();

        // Запускаємо інтервал оновлення таймера (щосекунди)
        this.state.refreshTimers[`countdown_${raffleId}`] = setInterval(updateTimer, 1000);
    },

    // Участь у розіграші
    participateInRaffle: async function(raffleId, raffleType) {
        if (!this.state.telegramId) {
            this.showErrorToast('Не вдалося визначити ваш ID користувача');
            return;
        }

        // Перевіряємо чи користувач вже бере участь у цьому розіграші
        if (this.state.userRaffles.some(raffle => raffle.raffle_id === raffleId)) {
            this.showToast('Ви вже берете участь у цьому розіграші', 'info');
            return;
        }

        this.showLoading();

        try {
            const endpoint = this.config.participateEndpoint.replace('{userId}', this.state.telegramId);

            const response = await WinixAPI.apiRequest(endpoint, 'POST', {
                raffle_id: raffleId,
                entry_count: 1
            });

            if (response.status === 'success') {
                // Додаємо розіграш до списку участі
                this.state.userRaffles.push({
                    raffle_id: raffleId,
                    entry_count: 1
                });

                // Оновлюємо кнопки участі
                this.updateParticipationButtons();

                // Якщо відповідь містить оновлений баланс жетонів
                if (response.data && response.data.new_coins_balance !== undefined) {
                    // Оновлюємо відображення жетонів
                    const coinsElements = document.querySelectorAll('.user-coins');
                    coinsElements.forEach(element => {
                        element.textContent = response.data.new_coins_balance;
                    });

                    // Генеруємо подію оновлення даних користувача
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: {
                            coins: response.data.new_coins_balance
                        }
                    }));
                }

                // Показуємо повідомлення про успіх
                this.showSuccessToast('Ви успішно взяли участь у розіграші');
            } else {
                if (response.code === 'insufficient_tokens') {
                    this.showErrorToast('Недостатньо жетонів для участі в розіграші');
                } else {
                    this.showErrorToast(response.message || 'Помилка участі в розіграші');
                }
            }
        } catch (error) {
            console.error('❌ Помилка участі в розіграші:', error);
            this.showErrorToast('Не вдалося взяти участь у розіграші');
        } finally {
            this.hideLoading();
        }
    },

    // Завантаження історії розіграшів
    loadRafflesHistory: async function() {
        if (!this.state.telegramId) {
            this.renderEmptyHistory();
            return;
        }

        if (this.state.isLoading) return;
        this.state.isLoading = true;

        this.showLoading();

        try {
            const endpoint = this.config.historyEndpoint.replace('{userId}', this.state.telegramId);
            const response = await WinixAPI.apiRequest(endpoint);

            if (response.status === 'success' && Array.isArray(response.data)) {
                this.state.pastRaffles = response.data;
                this.renderRafflesHistory(response.data);
            } else {
                console.error('❌ Неправильний формат відповіді:', response);
                this.renderEmptyHistory();
            }
        } catch (error) {
            console.error('❌ Помилка завантаження історії розіграшів:', error);
            this.renderEmptyHistory();
        } finally {
            this.state.isLoading = false;
            this.hideLoading();
        }
    },

    // Відображення історії розіграшів
    renderRafflesHistory: function(history) {
        const historyContainer = document.getElementById('history-container');

        if (!historyContainer) {
            console.error('❌ Контейнер історії не знайдено');
            return;
        }

        if (!history || history.length === 0) {
            this.renderEmptyHistory();
            return;
        }

        historyContainer.innerHTML = '';

        // Сортуємо за датою (від найновіших до найстаріших)
        const sortedHistory = [...history].sort((a, b) => {
            const dateA = new Date(a.date.split('.').reverse().join('-'));
            const dateB = new Date(b.date.split('.').reverse().join('-'));
            return dateB - dateA;
        });

        // Додаємо картки історії
        sortedHistory.forEach(raffle => {
            const historyCard = document.createElement('div');
            historyCard.className = `history-card ${raffle.status}`;
            historyCard.setAttribute('data-raffle-id', raffle.raffle_id);

            let statusText = 'Завершено';
            if (raffle.status === 'won') {
                statusText = 'Ви виграли!';
            } else if (raffle.status === 'participated') {
                statusText = 'Ви брали участь';
            }

            historyCard.innerHTML = `
                <div class="history-date">${raffle.date}</div>
                <div class="history-prize">${raffle.title}: ${raffle.prize}</div>
                <div class="history-winners">${raffle.result || 'Переможці визначені'}</div>
                <div class="history-status ${raffle.status}">${statusText}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            `;

            historyContainer.appendChild(historyCard);
        });
    },

    // Відображення порожньої історії
    renderEmptyHistory: function() {
        const historyContainer = document.getElementById('history-container');

        if (!historyContainer) {
            console.error('❌ Контейнер історії не знайдено');
            return;
        }

        historyContainer.innerHTML = `
            <div class="history-card">
                <div class="history-date">Історія відсутня</div>
                <div class="history-prize">У вас ще немає історії участі в розіграшах</div>
                <div class="history-winners">Візьміть участь у розіграшах, щоб побачити їх тут</div>
            </div>
        `;
    },

    // Показ деталей розіграшу
    showRaffleDetails: function(raffleId) {
        const raffle = this.state.pastRaffles.find(r => r.raffle_id === raffleId);

        if (!raffle) {
            this.showErrorToast('Не вдалося знайти деталі розіграшу');
            return;
        }

        // Формуємо HTML для модального вікна
        let winnersHtml = '';
        if (raffle.winners && raffle.winners.length > 0) {
            winnersHtml = `
                <div class="winners-list">
                    <h4>Переможці розіграшу:</h4>
                    <ul>
                        ${raffle.winners.map(winner => `
                            <li class="${winner.isCurrentUser ? 'current-user' : ''}">
                                ${winner.place}. ${winner.username} - ${winner.prize}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        const modalContent = `
            <div class="raffle-details-modal">
                <h3>${raffle.title}</h3>
                <div class="raffle-info">
                    <p><strong>Дата:</strong> ${raffle.date}</p>
                    <p><strong>Призовий фонд:</strong> ${raffle.prize}</p>
                    <p><strong>Ваша участь:</strong> ${raffle.entry_count} жетонів</p>
                    <p><strong>Результат:</strong> ${raffle.result}</p>
                </div>
                ${winnersHtml}
            </div>
        `;

        // Показуємо модальне вікно
        if (typeof window.showModal === 'function') {
            window.showModal('Деталі розіграшу', modalContent);
        } else {
            // Альтернативний варіант, якщо немає функції showModal
            alert(`${raffle.title}\n\nДата: ${raffle.date}\nПризовий фонд: ${raffle.prize}\nРезультат: ${raffle.result}`);
        }
    },

    // Завантаження статистики розіграшів
    loadRafflesStatistics: async function() {
        if (!this.state.telegramId) {
            this.renderEmptyStatistics();
            return;
        }

        if (this.state.isLoading) return;
        this.state.isLoading = true;

        this.showLoading();

        try {
            // Отримуємо дані користувача з розширеною інформацією
            const response = await WinixAPI.getUserData(true);

            if (response.status === 'success' && response.data) {
                this.state.userStats = response.data;
                this.renderRafflesStatistics(response.data);
            } else {
                console.error('❌ Неправильний формат відповіді:', response);
                this.renderEmptyStatistics();
            }
        } catch (error) {
            console.error('❌ Помилка завантаження статистики розіграшів:', error);
            this.renderEmptyStatistics();
        } finally {
            this.state.isLoading = false;
            this.hideLoading();
        }
    },

    // Відображення статистики розіграшів
    renderRafflesStatistics: function(userData) {
        // Оновлюємо елементи статистики
        this.updateStatElement('total-participated', userData.participations_count || 0);
        this.updateStatElement('total-wins', userData.wins_count || 0);
        this.updateStatElement('total-winix-won', userData.total_winnings || userData.wins_count * 15000 || 0);
        this.updateStatElement('total-tokens-spent', userData.tokens_spent || userData.participations_count * 2 || 0);

        // Оновлюємо бейджі
        this.updateBadges(userData.badges || {});
    },

    // Оновлення елемента статистики
    updateStatElement: function(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value.toLocaleString();
        }
    },

    // Оновлення бейджів
    updateBadges: function(badges) {
        // Оновлюємо візуальне відображення бейджів
    },

    // Відображення порожньої статистики
    renderEmptyStatistics: function() {
        // Встановлюємо значення за замовчуванням
        this.updateStatElement('total-participated', 0);
        this.updateStatElement('total-wins', 0);
        this.updateStatElement('total-winix-won', 0);
        this.updateStatElement('total-tokens-spent', 0);
    },

    // Допоміжні функції
    formatDate: function(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        // Форматуємо дату у вигляді DD.MM.YYYY
        return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    },

    formatTime: function(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        // Форматуємо час у вигляді HH:MM
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    formatDateTime: function(date) {
        // Повертаємо комбінацію дати та часу
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    // Функції для роботи з індикатором завантаження
    showLoading: function() {
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }
    },

    hideLoading: function() {
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    },

    // Функції для показу сповіщень
    showToast: function(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    },

    showSuccessToast: function(message) {
        this.showToast(message, 'success');
    },

    showErrorToast: function(message) {
        this.showToast(message, 'error');
    }
};

// Ініціалізація системи розіграшів після завантаження сторінки
document.addEventListener('DOMContentLoaded', function() {
    // Перевірка наявності API модуля
    if (typeof WinixAPI === 'undefined') {
        console.error('❌ WinixAPI не знайдено! Переконайтеся, що api.js підключено раніше raffles/core.js');
        return;
    }

    // Ініціалізація системи розіграшів
    WinixRaffles.init();
});

// Глобальний доступ до системи розіграшів
window.WinixRaffles = WinixRaffles;