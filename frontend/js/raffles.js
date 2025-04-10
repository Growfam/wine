/**
 * raffles.js - Основний модуль для роботи з розіграшами WINIX
 */

(function() {
    'use strict';

    console.log("🎮 Raffles: Ініціалізація модуля розіграшів");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Для відстеження статусу операцій
    let _isParticipating = false;
    let _isLoadingRaffles = false;

    // Час останніх запитів
    let _lastRafflesUpdateTime = 0;
    const RAFFLES_CACHE_TTL = 60000; // 1 хвилина

    // Кешовані дані розіграшів
    let _activeRaffles = null;
    let _userRaffles = null;
    let _rafflesHistory = null;

    // Формати дати
    const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З API ========

    /**
     * Отримання активних розіграшів
     */
    async function getActiveRaffles(forceRefresh = false) {
        try {
            // Перевіряємо кеш
            const now = Date.now();
            if (!forceRefresh && _activeRaffles && (now - _lastRafflesUpdateTime < RAFFLES_CACHE_TTL)) {
                console.log("📋 Raffles: Використання кешованих даних активних розіграшів");
                return _activeRaffles;
            }

            if (_isLoadingRaffles) {
                console.log("⏳ Raffles: Завантаження розіграшів вже виконується");
                return _activeRaffles || [];
            }

            _isLoadingRaffles = true;
            showLoading();

            // Отримуємо дані з API
            const response = await window.WinixAPI.apiRequest('/api/raffles', 'GET');

            hideLoading();
            _isLoadingRaffles = false;

            if (response.status === 'success') {
                _activeRaffles = response.data;
                _lastRafflesUpdateTime = now;

                console.log(`✅ Raffles: Отримано ${_activeRaffles.length} активних розіграшів`);

                // Оновлюємо статистику
                updateStatistics();

                return _activeRaffles;
            } else {
                throw new Error(response.message || 'Помилка отримання розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання активних розіграшів:', error);
            hideLoading();
            _isLoadingRaffles = false;

            // Показуємо повідомлення про помилку
            showToast('Не вдалося завантажити розіграші. Спробуйте пізніше.');

            // Повертаємо кешовані дані у випадку помилки
            return _activeRaffles || [];
        }
    }

    /**
     * Отримання детальної інформації про розіграш
     */
    async function getRaffleDetails(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            showLoading();
            const response = await window.WinixAPI.apiRequest(`/api/raffles/${raffleId}`, 'GET');
            hideLoading();

            if (response.status === 'success') {
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
            hideLoading();
            showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.');
            return null;
        }
    }

    /**
     * Отримання розіграшів, у яких бере участь користувач
     */
    async function getUserRaffles() {
        try {
            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            showLoading();
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles`, 'GET');
            hideLoading();

            if (response.status === 'success') {
                _userRaffles = response.data;

                // Оновлюємо статистику участі
                updateParticipationStats();

                return _userRaffles;
            } else {
                throw new Error(response.message || 'Помилка отримання розіграшів користувача');
            }
        } catch (error) {
            console.error('❌ Помилка отримання розіграшів користувача:', error);
            hideLoading();
            return [];
        }
    }

    /**
     * Отримання історії участі в розіграшах
     */
    async function getRafflesHistory() {
        try {
            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            showLoading();
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles-history`, 'GET');
            hideLoading();

            if (response.status === 'success') {
                _rafflesHistory = response.data;

                // Оновлюємо загальну статистику на основі історії
                updateHistoryStats();

                return _rafflesHistory;
            } else {
                throw new Error(response.message || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання історії розіграшів:', error);
            hideLoading();
            showToast('Не вдалося завантажити історію розіграшів. Спробуйте пізніше.');
            return [];
        }
    }

    /**
     * Участь у розіграші
     */
    async function participateInRaffle(raffleId, entryCount = 1) {
        try {
            if (_isParticipating) {
                console.log("⏳ Raffles: Участь у розіграші вже виконується");
                return { status: 'error', message: 'Участь у розіграші вже виконується' };
            }

            _isParticipating = true;
            showLoading();

            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/participate-raffle`, 'POST', {
                raffle_id: raffleId,
                entry_count: entryCount
            });

            hideLoading();
            _isParticipating = false;

            if (response.status === 'success') {
                // Оновлюємо кеш активних розіграшів
                await getActiveRaffles(true);

                // Оновлюємо кеш розіграшів користувача
                await getUserRaffles();

                // Оновлюємо баланс монет у користувача
                await updateUserBalance();

                // Оновлюємо статистику користувача
                updateStatistics();

                return {
                    status: 'success',
                    message: response.data?.message || 'Ви успішно взяли участь у розіграші',
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Помилка участі в розіграші');
            }
        } catch (error) {
            console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);
            hideLoading();
            _isParticipating = false;
            return { status: 'error', message: error.message || 'Помилка участі в розіграші' };
        }
    }

    /**
     * Отримання бонусу новачка
     */
    async function claimNewbieBonus() {
        try {
            showLoading();

            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST');
            hideLoading();

            if (response.status === 'success' || response.status === 'already_claimed') {
                // Оновлюємо баланс WINIX у користувача
                await updateUserBalance();

                return {
                    status: response.status,
                    message: response.message || 'Бонус новачка успішно отримано',
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Помилка отримання бонусу новачка');
            }
        } catch (error) {
            console.error('❌ Помилка отримання бонусу новачка:', error);
            hideLoading();
            return { status: 'error', message: error.message || 'Помилка отримання бонусу новачка' };
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З UI ========

    /**
     * Відображення даних активних розіграшів на сторінці
     */
    async function displayActiveRaffles() {
        console.log("🎮 Raffles: Відображення активних розіграшів");

        // Отримуємо контейнери для розіграшів
        const mainRaffleContainer = document.querySelector('.main-raffle');
        const miniRafflesContainer = document.querySelector('.mini-raffles-title')?.nextElementSibling;

        if (!mainRaffleContainer && !miniRafflesContainer) {
            console.log("❌ Raffles: Не знайдено контейнери для розіграшів");
            return;
        }

        // Показуємо індикатор завантаження
        showLoading();

        // Отримуємо активні розіграші
        const raffles = await getActiveRaffles(true);

        // Приховуємо індикатор завантаження
        hideLoading();

        if (!raffles || raffles.length === 0) {
            console.log("ℹ️ Raffles: Активні розіграші не знайдено");

            // Показуємо повідомлення про відсутність розіграшів
            if (mainRaffleContainer) {
                mainRaffleContainer.innerHTML = `
                    <div class="empty-raffles">
                        <div class="empty-raffles-icon">🎮</div>
                        <h3>Немає активних розіграшів</h3>
                        <p>На даний момент немає доступних розіграшів. Перевірте пізніше!</p>
                    </div>
                `;
            }

            return;
        }

        // Створюємо список основних і міні-розіграшів
        const mainRaffles = raffles.filter(raffle => !raffle.is_daily);
        const miniRaffles = raffles.filter(raffle => raffle.is_daily);

        // Відображаємо основний розіграш
        if (mainRaffleContainer && mainRaffles.length > 0) {
            displayMainRaffle(mainRaffleContainer, mainRaffles[0]);
        } else if (mainRaffleContainer) {
            // Якщо немає основних розіграшів, показуємо повідомлення
            mainRaffleContainer.innerHTML = `
                <div class="empty-main-raffle">
                    <div class="empty-raffles-icon">🎮</div>
                    <h3>Немає активних розіграшів</h3>
                    <p>Скоро будуть нові розіграші. Слідкуйте за оновленнями!</p>
                </div>
            `;
        }

        // Відображаємо міні-розіграші
        if (miniRafflesContainer) {
            // Очищаємо контейнер
            miniRafflesContainer.innerHTML = '';

            if (miniRaffles.length > 0) {
                // Додаємо кожен міні-розіграш
                miniRaffles.forEach(raffle => {
                    const miniRaffleElement = createMiniRaffleElement(raffle);
                    miniRafflesContainer.appendChild(miniRaffleElement);
                });
            } else {
                // Додаємо елемент для бонусу новачка, якщо міні-розіграшів немає
                addNewbieBonusElement(miniRafflesContainer);
            }
        }

        // Активуємо таймери
        startRaffleTimers();

        // Оновлюємо статистику
        updateStatistics();
    }

    /**
     * Відображення основного розіграшу
     */
    function displayMainRaffle(container, raffle) {
        if (!container || !raffle) return;

        // Створюємо HTML для основного розіграшу
        container.innerHTML = `
            <img class="main-raffle-image" src="${raffle.image_url || 'assets/prize-poster.gif'}" alt="${raffle.title}">
            <div class="main-raffle-content">
                <div class="main-raffle-header">
                    <h3 class="main-raffle-title">${raffle.title}</h3>
                    <div class="main-raffle-cost">
                        <img class="token-icon" src="assets/token-icon.png" alt="Жетон">
                        <span>${raffle.entry_fee} жетон${raffle.entry_fee !== 1 ? 'и' : ''}</span>
                    </div>
                </div>

                <span class="main-raffle-prize">${raffle.prize_amount} ${raffle.prize_currency}</span>

                <div class="timer-container">
                    <div class="timer-block">
                        <span class="timer-value" id="days">00</span>
                        <span class="timer-label">днів</span>
                    </div>
                    <div class="timer-block">
                        <span class="timer-value" id="hours">00</span>
                        <span class="timer-label">год</span>
                    </div>
                    <div class="timer-block">
                        <span class="timer-value" id="minutes">00</span>
                        <span class="timer-label">хв</span>
                    </div>
                </div>

                <div class="prize-distribution">
                    <div class="prize-distribution-title">Розподіл призів (${raffle.winners_count} переможців):</div>
                    <div class="prize-list">
                        ${generatePrizeDistributionHTML(raffle.prize_distribution)}
                    </div>
                </div>

                <div class="main-raffle-participants">
                    <div class="participants-info">Учасників: <span class="participants-count">${raffle.participants_count || 0}</span></div>
                    <div class="share-container">
                        <button class="share-button" id="share-raffle-btn" data-raffle-id="${raffle.id}">Поділитися</button>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress" style="width: ${calculateProgressWidth(raffle)}%"></div>
                </div>

                <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">Взяти участь</button>
            </div>
        `;

        // Оновлюємо таймер
        updateMainRaffleTimer(raffle);

        // Додаємо обробники подій
        container.querySelector('.join-button').addEventListener('click', function() {
            const raffleId = this.getAttribute('data-raffle-id');
            const raffleType = this.getAttribute('data-raffle-type');
            openRaffleDetails(raffleId, raffleType);
        });

        // Додаємо обробник для кнопки "Поділитися"
        container.querySelector('#share-raffle-btn').addEventListener('click', function() {
            const raffleId = this.getAttribute('data-raffle-id');
            shareRaffle(raffleId);
        });
    }

    /**
     * Генерація HTML для розподілу призів
     */
    function generatePrizeDistributionHTML(prizeDistribution) {
        if (!prizeDistribution || Object.keys(prizeDistribution).length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        let html = '';
        const places = Object.keys(prizeDistribution).sort((a, b) => parseInt(a) - parseInt(b));

        // Групуємо місця з однаковими призами
        const groupedPrizes = {};

        places.forEach(place => {
            const prize = prizeDistribution[place];
            const key = `${prize.amount}-${prize.currency}`;

            if (!groupedPrizes[key]) {
                groupedPrizes[key] = {
                    amount: prize.amount,
                    currency: prize.currency,
                    places: []
                };
            }

            groupedPrizes[key].places.push(parseInt(place));
        });

        // Створюємо HTML для кожної групи призів
        for (const key in groupedPrizes) {
            const group = groupedPrizes[key];
            const placesText = formatPlaces(group.places);

            html += `
                <div class="prize-item">
                    <span class="prize-place">${placesText}:</span>
                    <span class="prize-value">${group.amount} ${group.currency}</span>
                </div>
            `;
        }

        return html;
    }

    /**
     * Форматування списку місць
     */
    function formatPlaces(places) {
        if (places.length === 1) {
            return `${places[0]} місце`;
        }

        // Шукаємо послідовні місця
        places.sort((a, b) => a - b);

        const ranges = [];
        let start = places[0];
        let end = places[0];

        for (let i = 1; i < places.length; i++) {
            if (places[i] === end + 1) {
                end = places[i];
            } else {
                if (start === end) {
                    ranges.push(`${start}`);
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = end = places[i];
            }
        }

        if (start === end) {
            ranges.push(`${start}`);
        } else {
            ranges.push(`${start}-${end}`);
        }

        return ranges.join(', ') + ' місця';
    }

    /**
     * Розрахунок ширини прогрес-бару
     */
    function calculateProgressWidth(raffle) {
        const now = Date.now();
        const startTime = new Date(raffle.start_time).getTime();
        const endTime = new Date(raffle.end_time).getTime();
        const totalDuration = endTime - startTime;
        const elapsed = now - startTime;

        return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    }

    /**
     * Оновлення таймера для основного розіграшу
     */
    function updateMainRaffleTimer(raffle) {
        const daysElement = document.querySelector('#days');
        const hoursElement = document.querySelector('#hours');
        const minutesElement = document.querySelector('#minutes');

        if (!daysElement || !hoursElement || !minutesElement) return;

        const updateTimer = () => {
            const now = new Date();
            const endTime = new Date(raffle.end_time);
            const timeLeft = endTime - now;

            if (timeLeft > 0) {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                daysElement.textContent = padZero(days);
                hoursElement.textContent = padZero(hours);
                minutesElement.textContent = padZero(minutes);
            } else {
                daysElement.textContent = '00';
                hoursElement.textContent = '00';
                minutesElement.textContent = '00';

                // Розіграш завершено, оновлюємо дані
                clearInterval(timerInterval);
                setTimeout(() => {
                    getActiveRaffles(true).then(() => {
                        displayActiveRaffles();
                    });
                }, 5000);
            }
        };

        // Відразу оновлюємо таймер
        updateTimer();

        // Оновлюємо таймер кожну хвилину
        const timerInterval = setInterval(updateTimer, 60000);

        // Зберігаємо інтервал для можливого очищення
        window._raffleTimerIntervals = window._raffleTimerIntervals || [];
        window._raffleTimerIntervals.push(timerInterval);
    }

    /**
     * Створення елементу міні-розіграшу
     */
    function createMiniRaffleElement(raffle) {
        // Створюємо контейнер
        const miniRaffle = document.createElement('div');
        miniRaffle.className = 'mini-raffle';
        miniRaffle.setAttribute('data-raffle-id', raffle.id);

        // Розраховуємо час, що залишився
        const now = new Date();
        const endTime = new Date(raffle.end_time);
        const timeLeft = endTime - now;

        let timeLeftText = '';
        if (timeLeft > 0) {
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            timeLeftText = `Залишилось: ${hours} год ${minutes} хв`;
        } else {
            timeLeftText = 'Завершується';
        }

        // Форматуємо кількість переможців
        const winnersCount = raffle.winners_count || 1;
        const winnersText = `${raffle.prize_amount} ${raffle.prize_currency} (${winnersCount} переможців)`;

        // Формуємо HTML
        miniRaffle.innerHTML = `
            <div class="mini-raffle-info">
                <div class="mini-raffle-title">${raffle.title}</div>
                <div class="mini-raffle-cost">
                    <img class="token-icon" src="assets/token-icon.png" alt="Жетон">
                    <span>${raffle.entry_fee} жетон${raffle.entry_fee !== 1 ? 'и' : ''}</span>
                </div>
                <div class="mini-raffle-prize">${winnersText}</div>
                <div class="mini-raffle-time">${timeLeftText}</div>
            </div>
            <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-raffle-type="daily">Участь</button>
        `;

        // Додаємо обробник натискання
        const button = miniRaffle.querySelector('.mini-raffle-button');
        if (button) {
            button.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                openRaffleDetails(raffleId, raffleType);
            });
        }

        return miniRaffle;
    }

    /**
     * Додавання елементу бонусу новачка
     */
    function addNewbieBonusElement(container) {
        const newbieBonus = document.createElement('div');
        newbieBonus.className = 'mini-raffle';
        newbieBonus.setAttribute('data-raffle-id', 'newbie');

        newbieBonus.innerHTML = `
            <div class="mini-raffle-info">
                <div class="mini-raffle-title">Бонус новачка</div>
                <div class="mini-raffle-cost">
                    <img class="token-icon" src="assets/token-icon.png" alt="Жетон">
                    <span>0 жетонів</span>
                </div>
                <div class="mini-raffle-prize">500 WINIX + 1 жетон</div>
                <div class="mini-raffle-time">Доступно тільки новим користувачам</div>
            </div>
            <button class="mini-raffle-button" data-raffle-id="newbie">Отримати</button>
        `;

        const button = newbieBonus.querySelector('.mini-raffle-button');
        if (button) {
            button.addEventListener('click', async function() {
                const result = await claimNewbieBonus();

                if (result.status === 'success') {
                    showToast(`Ви отримали ${result.data.amount} WINIX як бонус новачка!`);

                    // Деактивуємо кнопку
                    this.textContent = 'Отримано';
                    this.disabled = true;
                    this.style.opacity = '0.6';
                    this.style.cursor = 'default';

                    // Додаємо водяний знак
                    markNewbieBonus(newbieBonus);

                    // Оновлюємо баланс
                    updateUserBalance();
                } else if (result.status === 'already_claimed') {
                    showToast('Ви вже отримали бонус новачка');

                    // Деактивуємо кнопку
                    this.textContent = 'Отримано';
                    this.disabled = true;
                    this.style.opacity = '0.6';
                    this.style.cursor = 'default';

                    // Додаємо водяний знак
                    markNewbieBonus(newbieBonus);
                } else {
                    showToast(result.message || 'Помилка отримання бонусу');
                }
            });
        }

        container.appendChild(newbieBonus);

        // Перевіряємо, чи вже отримано бонус
        window.WinixAPI.getUserData().then(userData => {
            if (userData.data && userData.data.newbie_bonus_claimed) {
                // Деактивуємо кнопку
                button.textContent = 'Отримано';
                button.disabled = true;
                button.style.opacity = '0.6';
                button.style.cursor = 'default';

                // Додаємо водяний знак
                markNewbieBonus(newbieBonus);
            }
        });
    }

    /**
     * Відображення історії розіграшів
     */
    async function displayRafflesHistory() {
        console.log("🎮 Raffles: Відображення історії розіграшів");

        // Отримуємо контейнер для історії
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) {
            console.log("❌ Raffles: Не знайдено контейнер для історії розіграшів");
            return;
        }

        // Показуємо індикатор завантаження
        showLoading();

        // Отримуємо історію розіграшів
        const history = await getRafflesHistory();

        // Приховуємо індикатор завантаження
        hideLoading();

        // Очищаємо контейнер
        historyContainer.innerHTML = '';

        // Перевіряємо наявність даних
        if (!history || history.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">🎮</div>
                    <h3>Історія розіграшів порожня</h3>
                    <p>Ви ще не брали участі в розіграшах WINIX. Спробуйте свою удачу вже сьогодні!</p>
                    <button class="join-raffle-btn" onclick="window.switchRaffleTab('active')">Перейти до розіграшів</button>
                </div>
            `;
            return;
        }

        // Розділяємо історію на виграшні розіграші та звичайні участі
        const wonRaffles = history.filter(item => item.status === 'won');
        const participatedRaffles = history.filter(item => item.status !== 'won');

        // Додаємо переможні розіграші, якщо є
        if (wonRaffles.length > 0) {
            historyContainer.innerHTML += `
                <div class="history-section">
                    <h3 class="section-title">Мої перемоги</h3>
                    <div class="history-cards-wrapper">
                        ${wonRaffles.map(createHistoryCardHTML).join('')}
                    </div>
                </div>
            `;
        }

        // Додаємо звичайні розіграші
        historyContainer.innerHTML += `
            <div class="history-section">
                <h3 class="section-title">Участь у розіграшах</h3>
                <div class="history-cards-wrapper">
                    ${participatedRaffles.length > 0 
                      ? participatedRaffles.map(createHistoryCardHTML).join('')
                      : '<div class="empty-history-section">У вас поки немає звичайної участі в розіграшах</div>'}
                </div>
            </div>
        `;

        // Додаємо обробники подій
        document.querySelectorAll('.history-card').forEach(card => {
            card.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const historyItem = history.find(item => item.raffle_id === raffleId);

                if (historyItem) {
                    showRaffleHistoryDetails(historyItem);
                }
            });
        });

        // Оновлюємо статистику на основі історії
        updateHistoryStats();
    }

    /**
     * Створення HTML для картки історії
     */
    function createHistoryCardHTML(item) {
        const statusClass = item.status === 'won' ? 'won' : 'participated';
        const statusText = item.status === 'won' ? 'Виграно' : 'Участь';

        return `
            <div class="history-card" data-raffle-id="${item.raffle_id}">
                <div class="history-date">${item.date}</div>
                <div class="history-title">${item.title}</div>
                <div class="history-prize">${item.prize}</div>
                <div class="history-details">
                    <div class="history-entry">Використано жетонів: ${item.entry_count}</div>
                    <div class="history-status ${statusClass}">${statusText}</div>
                </div>
                <div class="history-result">${item.result}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            </div>
        `;
    }

    /**
     * Показати деталі історії розіграшу
     */
    function showRaffleHistoryDetails(raffleData) {
        // Видаляємо існуюче модальне вікно, якщо воно є
        const existingModal = document.getElementById('raffle-history-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.id = 'raffle-history-modal';
        modal.className = 'raffle-modal';

        // Генеруємо список переможців, якщо вони є
        let winnersHTML = '';
        if (raffleData.winners && raffleData.winners.length > 0) {
            winnersHTML = generateWinnersListHTML(raffleData.winners);
        } else {
            winnersHTML = '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        // Формуємо HTML для модального вікна
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${raffleData.title || 'Деталі розіграшу'}</h2>
                    <span class="modal-close">×</span>
                </div>
                
                <div class="prize-details">
                    <div class="detail-item">
                        <div class="detail-label">Дата:</div>
                        <div class="detail-value">${raffleData.date}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Приз:</div>
                        <div class="detail-value prize-value">${raffleData.prize}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Використано жетонів:</div>
                        <div class="detail-value">${raffleData.entry_count}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Результат:</div>
                        <div class="detail-value ${raffleData.status === 'won' ? 'win-status' : 'participated-status'}">
                            ${raffleData.result}
                        </div>
                    </div>
                </div>
                
                <div class="winners-container">
                    <h3>Переможці розіграшу</h3>
                    <div class="winners-list">
                        ${winnersHTML}
                    </div>
                </div>
                
                <button class="join-button" id="close-history-btn">ЗАКРИТИ</button>
            </div>
        `;

        // Додаємо модальне вікно на сторінку
        document.body.appendChild(modal);

        // Додаємо обробники подій
        const closeButton = modal.querySelector('.modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            });
        }

        const closeActionButton = modal.querySelector('#close-history-btn');
        if (closeActionButton) {
            closeActionButton.addEventListener('click', function() {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            });
        }

        // Показуємо модальне вікно
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });
    }

    /**
     * Генерування HTML для списку переможців
     */
    function generateWinnersListHTML(winners) {
        if (!winners || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        return winners.map(winner => {
            // Визначаємо клас для місця (top-1, top-2, top-3)
            const placeClass = winner.place <= 3 ? `place-${winner.place}` : 'default-place';

            // Визначаємо, чи це поточний користувач
            const currentUserClass = winner.isCurrentUser ? 'current-user' : '';

            // Формуємо HTML для одного переможця
            return `
                <div class="winner-item ${currentUserClass}" ${winner.isCurrentUser ? 'title="Це ви!"' : ''}>
                    <div class="winner-place ${placeClass}">
                        <span>${winner.place}</span>
                    </div>
                    <div class="winner-info">
                        <div class="winner-name">${winner.username}</div>
                        <div class="winner-id">ID: ${winner.userId}</div>
                    </div>
                    <div class="winner-prize">${winner.prize}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Запуск таймерів для розіграшів
     */
    function startRaffleTimers() {
        // Очищаємо існуючі таймери
        if (window._raffleTimerIntervals) {
            window._raffleTimerIntervals.forEach(interval => clearInterval(interval));
            window._raffleTimerIntervals = [];
        }

        // Запускаємо оновлення таймерів кожну хвилину
        const interval = setInterval(updateRaffleTimers, 60000);
        window._raffleTimerIntervals = [interval];

        // Відразу запускаємо оновлення
        updateRaffleTimers();
    }

    /**
     * Оновлення таймерів для розіграшів
     */
    function updateRaffleTimers() {
        // Оновлюємо таймер головного розіграшу
        const daysElement = document.querySelector('#days');
        const hoursElement = document.querySelector('#hours');
        const minutesElement = document.querySelector('#minutes');

        if (daysElement && hoursElement && minutesElement && _activeRaffles && _activeRaffles.length > 0) {
            // Знаходимо основний розіграш
            const mainRaffle = _activeRaffles.find(raffle => !raffle.is_daily);

            if (mainRaffle) {
                const now = new Date();
                const endTime = new Date(mainRaffle.end_time);
                const timeLeft = endTime - now;

                if (timeLeft > 0) {
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                    daysElement.textContent = padZero(days);
                    hoursElement.textContent = padZero(hours);
                    minutesElement.textContent = padZero(minutes);
                } else {
                    daysElement.textContent = '00';
                    hoursElement.textContent = '00';
                    minutesElement.textContent = '00';

                    // Розіграш завершено, оновлюємо дані
                    getActiveRaffles(true).then(() => {
                        displayActiveRaffles();
                    });
                }
            }
        }

        // Оновлюємо таймери міні-розіграшів
        const miniRaffleTimeElements = document.querySelectorAll('.mini-raffle-time');

        if (miniRaffleTimeElements.length > 0 && _activeRaffles && _activeRaffles.length > 0) {
            // Знаходимо щоденні розіграші
            const dailyRaffles = _activeRaffles.filter(raffle => raffle.is_daily);

            if (dailyRaffles.length > 0) {
                const miniRaffles = document.querySelectorAll('.mini-raffle');

                miniRaffles.forEach(raffleElement => {
                    const raffleId = raffleElement.getAttribute('data-raffle-id');
                    const timeElement = raffleElement.querySelector('.mini-raffle-time');

                    if (!timeElement || raffleId === 'newbie') return;

                    const raffle = dailyRaffles.find(r => r.id === raffleId);
                    if (!raffle) return;

                    const now = new Date();
                    const endTime = new Date(raffle.end_time);
                    const timeLeft = endTime - now;

                    if (timeLeft > 0) {
                        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        timeElement.textContent = `Залишилось: ${hours} год ${minutes} хв`;
                    } else {
                        timeElement.textContent = 'Завершується';

                        // Розіграш завершено, оновлюємо дані
                        getActiveRaffles(true).then(() => {
                            displayActiveRaffles();
                        });
                    }
                });
            }
        }
    }

    /**
     * Відкриття модального вікна з деталями розіграшу
     */
    function openRaffleDetails(raffleId, raffleType) {
        // Перевіряємо наявність жетонів
        window.WinixAPI.getUserData().then(userData => {
            const coinsBalance = userData.data?.coins || 0;

            if (coinsBalance < 1) {
                showToast('Для участі в розіграші потрібен щонайменше 1 жетон');
                return;
            }

            // Отримуємо дані розіграшу
            getRaffleDetails(raffleId).then(raffleData => {
                if (!raffleData) {
                    showToast('Помилка отримання даних розіграшу');
                    return;
                }

                // Відкриваємо відповідне модальне вікно
                const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
                const modal = document.getElementById(modalId);

                if (!modal) {
                    console.error(`Модальне вікно з id ${modalId} не знайдено`);
                    return;
                }

                // Встановлюємо значення полів у модальному вікні
                const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = '1';

                    // Встановлюємо максимальне значення рівне балансу жетонів
                    const tokenCost = raffleType === 'daily' ? 1 : 3;
                    const maxTickets = Math.floor(coinsBalance / tokenCost);
                    input.max = maxTickets;

                    // Показуємо кнопку "ВСІ", якщо баланс більше 1
                    const allButtonId = raffleType === 'daily' ? 'daily-all-tokens-btn' : 'main-all-tokens-btn';
                    const allButton = document.getElementById(allButtonId);

                    if (allButton) {
                        if (coinsBalance > tokenCost) {
                            allButton.style.display = 'block';

                            // Додаємо обробник для кнопки "ВСІ"
                            allButton.onclick = function() {
                                input.value = maxTickets;
                            };
                        } else {
                            allButton.style.display = 'none';
                        }
                    }
                }

                const btnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
                const joinBtn = document.getElementById(btnId);

                if (joinBtn) {
                    joinBtn.setAttribute('data-raffle-id', raffleId);
                    joinBtn.setAttribute('data-raffle-type', raffleType);

                    // Додаємо обробник натискання
                    joinBtn.onclick = function() {
                        const raffleId = this.getAttribute('data-raffle-id');
                        const raffleType = this.getAttribute('data-raffle-type');
                        const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';

                        participateInRaffleUI(raffleId, raffleType, inputId);
                    };
                }

                // Оновлюємо дані в модальному вікні
                if (raffleType === 'daily') {
                    const titleElement = document.getElementById('daily-modal-title');
                    if (titleElement) titleElement.textContent = raffleData.title || 'Щоденний розіграш';

                    const prizeElement = document.getElementById('daily-prize-value');
                    if (prizeElement) prizeElement.textContent = `${raffleData.prize_amount} ${raffleData.prize_currency} (${raffleData.winners_count} переможців)`;

                    const participantsElement = document.getElementById('daily-participants');
                    if (participantsElement) participantsElement.textContent = raffleData.participants_count || '0';

                    const endDateElement = document.getElementById('daily-end-time');
                    if (endDateElement) endDateElement.textContent = formatDate(raffleData.end_time);

                    const descriptionElement = document.getElementById('daily-description');
                    if (descriptionElement) descriptionElement.textContent = raffleData.description || 'Щоденний розіграш з призами для переможців! Використайте жетони для участі.';

                    // Оновлюємо зображення, якщо воно є
                    const imageElement = document.getElementById('daily-prize-image');
                    if (imageElement && raffleData.image_url) {
                        imageElement.src = raffleData.image_url;
                    }
                } else {
                    const titleElement = document.getElementById('main-modal-title');
                    if (titleElement) titleElement.textContent = raffleData.title || 'Гранд Розіграш';

                    const prizeElement = document.getElementById('main-prize-value');
                    if (prizeElement) prizeElement.textContent = `${raffleData.prize_amount} ${raffleData.prize_currency} (${raffleData.winners_count} переможців)`;

                    const participantsElement = document.getElementById('main-participants');
                    if (participantsElement) participantsElement.textContent = raffleData.participants_count || '0';

                    const endDateElement = document.getElementById('main-end-time');
                    if (endDateElement) endDateElement.textContent = formatDate(raffleData.end_time);

                    const descriptionElement = document.getElementById('main-description');
                    if (descriptionElement) descriptionElement.textContent = raffleData.description || 'Грандіозний розіграш з чудовими призами! Використайте жетони для участі та збільшіть свої шанси на перемогу.';

                    // Оновлюємо зображення, якщо воно є
                    const imageElement = document.getElementById('main-prize-image');
                    if (imageElement && raffleData.image_url) {
                        imageElement.src = raffleData.image_url;
                    }
                }

                // Відкриваємо модальне вікно
                modal.classList.add('open');
            });
        });
    }

    /**
     * Функція обробки натискання на кнопку участі в розіграші
     */
    async function participateInRaffleUI(raffleId, raffleType, inputId) {
        // Отримуємо кількість жетонів
        const input = document.getElementById(inputId);
        const entryCount = parseInt(input?.value || '1') || 1;

        // Отримуємо модальне вікно
        const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
        const modal = document.getElementById(modalId);

        // Перевіряємо коректність введення
        if (entryCount <= 0) {
            showToast('Кількість жетонів має бути більше нуля');
            return;
        }

        // Перевіряємо, чи достатньо жетонів
        const userData = await window.WinixAPI.getUserData();
        const coinsBalance = userData.data?.coins || 0;
        const tokenCost = raffleType === 'daily' ? 1 : 3;
        const totalCost = entryCount * tokenCost;

        if (coinsBalance < totalCost) {
            showToast(`Недостатньо жетонів. Потрібно ${totalCost}, у вас ${coinsBalance}`);
            return;
        }

        // Беремо участь у розіграші
        const result = await participateInRaffle(raffleId, entryCount);

        if (result.status === 'success') {
            // Закриваємо модальне вікно
            if (modal) modal.classList.remove('open');

            // Оновлюємо відображення розіграшів
            await displayActiveRaffles();

            // Оновлюємо баланс
            updateUserBalance();

            // Показуємо повідомлення про успіх
            showToast(result.message);

            // Якщо є бонус, показуємо повідомлення про нього
            if (result.data && result.data.bonus_amount) {
                setTimeout(() => {
                    showToast(`Вітаємо! Ви отримали ${result.data.bonus_amount} WINIX як бонус!`);
                }, 3000);
            }

            // Оновлюємо бейджі
            updateBadges();
        } else {
            // Показуємо повідомлення про помилку
            showToast(result.message);
        }
    }

    /**
     * Оновлення статистики розіграшів
     */
    function updateStatistics() {
        // Перевіряємо наявність статистики
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;

        // Отримуємо дані користувача
        window.WinixAPI.getUserData().then(userData => {
            if (!userData || !userData.data) return;

            // Оновлюємо загальну статистику участі
            const userStats = userData.data;

            // Знаходимо елементи статистики
            const participationsElement = document.getElementById('total-participated');
            const winsElement = document.getElementById('total-wins');
            const winixWonElement = document.getElementById('total-winix-won');
            const tokensSpentElement = document.getElementById('total-tokens-spent');

            if (participationsElement) {
                participationsElement.textContent = userStats.participations_count || 0;
            }

            if (winsElement) {
                winsElement.textContent = userStats.wins_count || 0;
            }

            if (winixWonElement) {
                // Тут потрібно отримати дані про виграні WINIX з історії
                getRafflesHistory().then(history => {
                    // Рахуємо суму всіх виграшів
                    let totalWinix = 0;

                    if (history && history.length > 0) {
                        const wonRaffles = history.filter(item => item.status === 'won');

                        wonRaffles.forEach(raffle => {
                            // Витягуємо числову суму з рядка призу
                            const match = raffle.prize.match(/\d+(\.\d+)?/);
                            if (match) {
                                totalWinix += parseFloat(match[0]);
                            }
                        });
                    }

                    winixWonElement.textContent = totalWinix.toLocaleString('uk-UA');
                });
            }

            if (tokensSpentElement) {
                tokensSpentElement.textContent = userStats.tokens_spent || 0;
            }
        });
    }

    /**
     * Оновлення статистики участі
     */
    function updateParticipationStats() {
        // Отримуємо дані про розіграші користувача
        getUserRaffles().then(userRaffles => {
            if (!userRaffles || userRaffles.length === 0) return;

            // Отримуємо дані користувача
            window.WinixAPI.getUserData().then(userData => {
                if (!userData || !userData.data) return;

                // Оновлюємо лічильник участі
                const participations = userRaffles.length;
                const userStats = userData.data;

                // Якщо вони відрізняються, оновлюємо на сервері
                if (participations !== userStats.participations_count) {
                    window.WinixAPI.apiRequest(`/api/user/${userData.data.telegram_id}/statistics`, 'POST', {
                        participations_count: participations
                    });
                }

                // Оновлюємо відображення
                updateStatistics();
            });
        });
    }

    /**
     * Оновлення статистики на основі історії
     */
    function updateHistoryStats() {
        // Отримуємо історію розіграшів
        getRafflesHistory().then(history => {
            if (!history || history.length === 0) return;

            // Підраховуємо кількість перемог
            const wins = history.filter(item => item.status === 'won').length;

            // Отримуємо дані користувача
            window.WinixAPI.getUserData().then(userData => {
                if (!userData || !userData.data) return;

                const userStats = userData.data;

                // Якщо кількість перемог відрізняється, оновлюємо на сервері
                if (wins !== userStats.wins_count) {
                    window.WinixAPI.apiRequest(`/api/user/${userData.data.telegram_id}/statistics`, 'POST', {
                        wins_count: wins
                    });
                }

                // Оновлюємо відображення
                updateStatistics();
            });
        });
    }

    /**
     * Оновлення балансу користувача
     */
    async function updateUserBalance() {
        // Перевіряємо наявність глобальної функції
        if (window.WinixAPI.getBalance) {
            await window.WinixAPI.getBalance();
        } else {
            // Альтернативний метод оновлення
            await window.WinixAPI.getUserData(true);

            // Оновлюємо відображення балансу
            const userData = await window.WinixAPI.getUserData();

            if (userData && userData.data) {
                // Оновлюємо елементи інтерфейсу
                const coinsElement = document.getElementById('user-coins');
                const tokensElement = document.getElementById('user-tokens');

                if (coinsElement) {
                    coinsElement.textContent = userData.data.coins || 0;
                }

                if (tokensElement) {
                    tokensElement.textContent = userData.data.balance || 0;
                }
            }
        }

        // Оновлюємо статистику
        updateStatistics();
    }

    /**
     * Оновлення бейджів
     */
    function updateBadges() {
        // Отримуємо дані користувача
        window.WinixAPI.getUserData(true).then(userData => {
            if (!userData || !userData.data) return;

            const badges = userData.data.badges || {};

            // Оновлюємо бейджі на сторінці
            Object.keys(badges).forEach(badgeId => {
                const badge = badges[badgeId];
                const badgeElement = document.getElementById(`badge-${badgeId}`);

                if (badgeElement && badge.unlocked) {
                    // Додаємо клас для розблокованого бейджа
                    badgeElement.classList.add('badge-completed');

                    // Додаємо водяний знак
                    if (!badgeElement.querySelector('.badge-watermark')) {
                        const watermark = document.createElement('div');
                        watermark.className = 'badge-watermark';
                        watermark.innerHTML = '<div class="badge-watermark-text">ОТРИМАНО</div>';
                        badgeElement.appendChild(watermark);
                    }

                    // Видаляємо іконку замка
                    const lockIcon = badgeElement.querySelector('.lock-icon');
                    if (lockIcon) {
                        lockIcon.remove();
                    }

                    // Змінюємо опис винагороди
                    const rewardElement = badgeElement.querySelector('.badge-reward');
                    if (rewardElement) {
                        rewardElement.textContent = 'Нагороду отримано';
                    }
                }
            });
        });
    }

    /**
     * Поділитися розіграшем
     */
    function shareRaffle(raffleId) {
        // Перевіряємо наявність Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            // Отримуємо дані розіграшу
            getRaffleDetails(raffleId).then(raffleData => {
                if (!raffleData) {
                    showToast('Не вдалося отримати дані розіграшу');
                    return;
                }

                // Формуємо повідомлення для поширення
                const shareText = `🎮 Розіграш WINIX: ${raffleData.title}\n\n` +
                                 `💰 Призовий фонд: ${raffleData.prize_amount} ${raffleData.prize_currency}\n` +
                                 `🏆 Кількість переможців: ${raffleData.winners_count}\n\n` +
                                 `Бери участь і вигравай призи! 🚀`;

                // Використовуємо метод Telegram для поширення
                if (window.Telegram.WebApp.switchInlineQuery) {
                    window.Telegram.WebApp.switchInlineQuery(shareText, ['users', 'groups']);
                    return;
                }

                if (navigator.share) {
                    navigator.share({
                        title: `Розіграш WINIX: ${raffleData.title}`,
                        text: shareText
                    })
                    .then(() => {
                        showToast('Розіграш успішно поширено');
                    })
                    .catch(error => {
                        console.error('Помилка поширення:', error);
                        showToast('Не вдалося поширити розіграш');
                    });
                } else {
                    // Копіюємо в буфер обміну
                    navigator.clipboard.writeText(shareText)
                        .then(() => {
                            showToast('Текст розіграшу скопійовано в буфер обміну');
                        })
                        .catch(error => {
                            console.error('Помилка копіювання:', error);
                            showToast('Не вдалося скопіювати текст розіграшу');
                        });
                }
            });
        } else {
            showToast('Ця функція доступна тільки в Telegram');
        }
    }

    // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

    /**
     * Форматування дати
     */
    function formatDate(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        return dateTimeFormat.format(date);
    }

    /**
     * Додавання ведучого нуля до числа
     */
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    /**
     * Показати спінер завантаження
     */
    function showLoading() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');
    }

    /**
     * Приховати спінер завантаження
     */
    function hideLoading() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
    }

    /**
     * Показати повідомлення toast
     */
    function showToast(message, duration = 3000) {
        // Перевіряємо наявність глобальної функції
        if (window.showToast) {
            window.showToast(message, duration);
            return;
        }

        // Запасний варіант, якщо глобальна функція відсутня
        const toast = document.getElementById('toast-message');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    /**
     * Додавання водяного знаку до блоку з бонусом новачка
     */
    function markNewbieBonus(container) {
        // Перевіряємо, чи вже є водяний знак
        if (container.querySelector('.watermark')) {
            return;
        }

        // Створюємо водяний знак
        const watermark = document.createElement('div');
        watermark.className = 'watermark';
        watermark.style.position = 'absolute';
        watermark.style.top = '0';
        watermark.style.left = '0';
        watermark.style.width = '100%';
        watermark.style.height = '100%';
        watermark.style.display = 'flex';
        watermark.style.justifyContent = 'center';
        watermark.style.alignItems = 'center';
        watermark.style.pointerEvents = 'none';

        // Створюємо затемнення
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';

        // Створюємо текст
        const text = document.createElement('div');
        text.textContent = 'ОТРИМАНО';
        text.style.position = 'absolute';
        text.style.transform = 'rotate(-30deg)';
        text.style.fontSize = '24px';
        text.style.fontWeight = 'bold';
        text.style.color = 'white';
        text.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.7)';

        // Додаємо елементи
        watermark.appendChild(overlay);
        watermark.appendChild(text);

        // Якщо контейнер не має position: relative, додаємо його
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        container.appendChild(watermark);
    }

    /**
     * Функція переключення вкладок
     */
    function switchTab(tabName) {
        console.log(`🎮 Raffles: Переключення на вкладку ${tabName}`);

        // Оновлюємо активну вкладку
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabSections = document.querySelectorAll('.raffles-section');

        // Знімаємо активний стан з усіх вкладок і секцій
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabSections.forEach(section => section.classList.remove('active'));

        // Додаємо активний стан до вибраної вкладки і секції
        const activeTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        const activeTabSection = document.getElementById(`${tabName}-raffles`);

        if (activeTabButton) activeTabButton.classList.add('active');
        if (activeTabSection) activeTabSection.classList.add('active');

        // Якщо це вкладка з історією, оновлюємо її
        if (tabName === 'past') {
            displayRafflesHistory();
        } else if (tabName === 'active') {
            // Оновлюємо активні розіграші
            displayActiveRaffles();
        }
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація модуля розіграшів
     */
    function init() {
        console.log("🎮 Raffles: Ініціалізація...");

        // Отримуємо дані активних розіграшів
        getActiveRaffles().then(() => {
            // Відображаємо активні розіграші
            displayActiveRaffles();
        });

        // Оновлюємо бейджі користувача
        updateBadges();

        // Налаштовуємо обробники подій для перемикання вкладок
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                switchTab(tabName);
            });
        });

        // Налаштовуємо кнопки закриття для модальних вікон
        const closeButtons = document.querySelectorAll('.modal-close');
        closeButtons.forEach(button => {
            button.addEventListener('click', function() {
                const modal = this.closest('.raffle-modal, .daily-raffle-modal');
                if (modal) modal.classList.remove('open');
            });
        });

        // Налаштовуємо кнопку для отримання бонусу новачка, якщо вона є
        const newbieButton = document.querySelector('.mini-raffle-button[data-raffle-id="newbie"]');
        if (newbieButton) {
            newbieButton.addEventListener('click', async function() {
                const result = await claimNewbieBonus();

                if (result.status === 'success') {
                    showToast(`Ви отримали ${result.data.amount} WINIX як бонус новачка!`);

                    // Змінюємо текст кнопки і деактивуємо її
                    this.textContent = 'Отримано';
                    this.disabled = true;
                    this.style.opacity = '0.6';
                    this.style.cursor = 'default';

                    // Додаємо водяний знак до контейнера з бонусом
                    const container = this.closest('.mini-raffle');
                    if (container) {
                        markNewbieBonus(container);
                    }
                } else if (result.status === 'already_claimed') {
                    showToast('Ви вже отримали бонус новачка');

                    // Змінюємо текст кнопки і деактивуємо її
                    this.textContent = 'Отримано';
                    this.disabled = true;
                    this.style.opacity = '0.6';
                    this.style.cursor = 'default';

                    // Додаємо водяний знак до контейнера з бонусом
                    const container = this.closest('.mini-raffle');
                    if (container) {
                        markNewbieBonus(container);
                    }
                } else {
                    showToast(result.message || 'Помилка отримання бонусу');
                }
            });

            // Перевіряємо, чи бонус вже отримано
            window.WinixAPI.getUserData().then(userData => {
                if (userData.data && userData.data.newbie_bonus_claimed) {
                    newbieButton.textContent = 'Отримано';
                    newbieButton.disabled = true;
                    newbieButton.style.opacity = '0.6';
                    newbieButton.style.cursor = 'default';

                    // Додаємо водяний знак до контейнера з бонусом
                    const container = newbieButton.closest('.mini-raffle');
                    if (container) {
                        markNewbieBonus(container);
                    }
                }
            });
        }

        console.log("✅ Raffles: Ініціалізацію завершено");
    }

    // Експортуємо публічний API
    window.RafflesModule = {
        init,
        getActiveRaffles,
        getRaffleDetails,
        getUserRaffles,
        getRafflesHistory,
        participateInRaffle,
        displayActiveRaffles,
        displayRafflesHistory,
        openRaffleDetails,
        switchTab,
        claimNewbieBonus,
        updateUserBalance,
        updateBadges,
        updateStatistics,
        shareRaffle
    };

    // Глобальна функція відкриття розіграшу
    window.openRaffleDetails = openRaffleDetails;

    // Функція перемикання вкладок
    window.switchRaffleTab = switchTab;

    // Додаємо init в глобальний об'єкт
    window.rafflesFunctions = {
        switchTab,
        loadRaffleHistory: displayRafflesHistory
    };

    // Ініціалізуємо модуль при завантаженні документа
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();