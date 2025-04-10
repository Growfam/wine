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

    // ДОДАНО: Кеш деталей розіграшів
    let _raffleDetailsCache = {};

    // Формати дати
    const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // ДОДАНО: Таймаути для очищення станів
    let _participationTimeoutId = null;
    let _loadingTimeoutId = null;

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

            // ДОДАНО: Автоматичне скидання зависаючих запитів
            if (_isLoadingRaffles && (now - _lastRafflesUpdateTime > 30000)) {
                console.warn("⚠️ Raffles: Виявлено зависаючий запит розіграшів, скидаємо стан");
                _isLoadingRaffles = false;
                if (_loadingTimeoutId) {
                    clearTimeout(_loadingTimeoutId);
                    _loadingTimeoutId = null;
                }
            }

            if (_isLoadingRaffles) {
                console.log("⏳ Raffles: Завантаження розіграшів вже виконується");
                return _activeRaffles || [];
            }

            _isLoadingRaffles = true;
            _lastRafflesUpdateTime = now;

            // ДОДАНО: Встановлюємо таймаут для автоматичного скидання
            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
            }
            _loadingTimeoutId = setTimeout(() => {
                if (_isLoadingRaffles) {
                    console.warn("⚠️ Raffles: Завантаження розіграшів триває занадто довго, скидаємо стан");
                    _isLoadingRaffles = false;
                }
            }, 30000); // 30 секунд

            showLoading('Завантаження розіграшів...');

            // ЗМІНЕНО: Додаємо кращі параметри для API запиту
            const response = await window.WinixAPI.apiRequest('/api/raffles', 'GET', null, {
                timeout: 15000,
                suppressErrors: true,
                forceCleanup: forceRefresh
            });

            // ЗАВЖДИ приховуємо лоадер і скидаємо прапорець
            hideLoading();
            _isLoadingRaffles = false;

            // Очищаємо таймаут
            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
                _loadingTimeoutId = null;
            }

            if (response && response.status === 'success') {
                _activeRaffles = response.data || [];
                _lastRafflesUpdateTime = now;

                console.log(`✅ Raffles: Отримано ${_activeRaffles.length} активних розіграшів`);

                // Оновлюємо статистику
                updateStatistics();

                return _activeRaffles;
            } else {
                // ДОДАНО: Краща обробка помилок
                console.error("❌ Raffles: Помилка отримання розіграшів:", response?.message || "Невідома помилка");

                // Якщо є кешовані дані, використовуємо їх
                if (_activeRaffles) {
                    console.warn("📋 Raffles: Використання кешованих даних після помилки");
                    return _activeRaffles;
                }

                throw new Error((response && response.message) || 'Помилка отримання розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання активних розіграшів:', error);

            // ЗАВЖДИ скидаємо прапорці
            hideLoading();
            _isLoadingRaffles = false;

            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
                _loadingTimeoutId = null;
            }

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

            // ДОДАНО: Перевіряємо кеш
            if (_raffleDetailsCache[raffleId]) {
                console.log(`📋 Raffles: Використання кешованих даних для розіграшу ${raffleId}`);
                return _raffleDetailsCache[raffleId];
            }

            showLoading('Завантаження деталей розіграшу...');

            // ЗМІНЕНО: Покращені параметри запиту
            const response = await window.WinixAPI.apiRequest(`/api/raffles/${raffleId}`, 'GET', null, {
                timeout: 10000,
                suppressErrors: true,
                forceCleanup: true
            });

            hideLoading();

            if (response && response.status === 'success') {
                // ДОДАНО: Кешуємо отримані дані
                if (response.data) {
                    _raffleDetailsCache[raffleId] = response.data;
                }
                return response.data;
            } else {
                throw new Error((response && response.message) || 'Помилка отримання деталей розіграшу');
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

            showLoading('Завантаження ваших розіграшів...');

            // ЗМІНЕНО: Додано кращі параметри запиту
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles`, 'GET', null, {
                timeout: 10000,
                suppressErrors: true
            });

            hideLoading();

            if (response && response.status === 'success') {
                _userRaffles = response.data || [];

                // Оновлюємо статистику участі
                updateParticipationStats();

                return _userRaffles;
            } else {
                throw new Error((response && response.message) || 'Помилка отримання розіграшів користувача');
            }
        } catch (error) {
            console.error('❌ Помилка отримання розіграшів користувача:', error);
            hideLoading();

            // Повертаємо кешовані дані у випадку помилки
            if (_userRaffles) {
                return _userRaffles;
            }

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

            showLoading('Завантаження історії розіграшів...');

            // ЗМІНЕНО: Виправлений запит з кращими параметрами
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles-history`, 'GET', null, {
                timeout: 15000,
                suppressErrors: true,
                forceCleanup: true
            });

            hideLoading();

            if (response && response.status === 'success') {
                // Перевіряємо, що response.data - це масив
                if (!Array.isArray(response.data)) {
                    console.warn("Отримано некоректні дані історії:", response.data);
                    _rafflesHistory = [];
                    return [];
                }

                _rafflesHistory = response.data;

                // Оновлюємо загальну статистику на основі історії
                updateHistoryStats();

                return _rafflesHistory;
            } else {
                // ДОДАНО: Перевіряємо, чи це фолбек
                if (response && response.source && response.source.includes('fallback')) {
                    console.warn(`Raffles: Отримано фолбек відповідь для історії: ${response.source}`);

                    // Якщо є дані, використовуємо їх
                    if (Array.isArray(response.data)) {
                        _rafflesHistory = response.data;
                        return _rafflesHistory;
                    }
                }

                throw new Error((response && response.message) || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання історії розіграшів:', error);
            hideLoading();
            showToast('Не вдалося завантажити історію розіграшів. Спробуйте пізніше.');

            // Перевіряємо кешовані дані
            if (_rafflesHistory && Array.isArray(_rafflesHistory)) {
                return _rafflesHistory;
            }

            // Завжди повертаємо масив при помилці
            _rafflesHistory = [];
            return [];
        }
    }

    /**
     * Участь у розіграші
     */
    async function participateInRaffle(raffleId, entryCount = 1) {
        try {
            // ДОДАНО: Автоматичне скидання зависаючих запитів
            const now = Date.now();
            if (_isParticipating && !_participationTimeoutId) {
                console.warn("⚠️ Raffles: Виявлено потенційно зависаючий запит участі, скидаємо");
                _isParticipating = false;
            }

            if (_isParticipating) {
                console.log("⏳ Raffles: Участь у розіграші вже виконується");
                return { status: 'error', message: 'Участь у розіграші вже виконується' };
            }

            _isParticipating = true;

            // ДОДАНО: Встановлюємо таймаут для автоматичного скидання
            if (_participationTimeoutId) {
                clearTimeout(_participationTimeoutId);
            }
            _participationTimeoutId = setTimeout(() => {
                if (_isParticipating) {
                    console.warn("⚠️ Raffles: Участь у розіграші триває занадто довго, скидаємо стан");
                    _isParticipating = false;
                }
            }, 30000); // 30 секунд

            showLoading('Беремо участь у розіграші...');

            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // ЗМІНЕНО: Покращені параметри запиту
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/participate-raffle`, 'POST', {
                raffle_id: raffleId,
                entry_count: entryCount
            }, {
                timeout: 15000,
                suppressErrors: true,
                forceCleanup: true
            });

            // ЗАВЖДИ приховуємо лоадер і скидаємо прапорці
            hideLoading();
            _isParticipating = false;

            // Очищаємо таймаут
            if (_participationTimeoutId) {
                clearTimeout(_participationTimeoutId);
                _participationTimeoutId = null;
            }

            if (response && response.status === 'success') {
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
                throw new Error((response && response.message) || 'Помилка участі в розіграші');
            }
        } catch (error) {
            console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

            // ЗАВЖДИ скидаємо прапорці та приховуємо лоадер
            hideLoading();
            _isParticipating = false;

            if (_participationTimeoutId) {
                clearTimeout(_participationTimeoutId);
                _participationTimeoutId = null;
            }

            return { status: 'error', message: error.message || 'Помилка участі в розіграші' };
        }
    }

    /**
     * Отримання бонусу новачка
     */
    async function claimNewbieBonus() {
        try {
            showLoading('Отримуємо бонус новачка...');

            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // ЗМІНЕНО: Покращені параметри запиту
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST', null, {
                timeout: 10000,
                suppressErrors: true
            });

            hideLoading();

            if (response && (response.status === 'success' || response.status === 'already_claimed')) {
                // Оновлюємо баланс WINIX у користувача
                await updateUserBalance();

                return {
                    status: response.status,
                    message: response.message || 'Бонус новачка успішно отримано',
                    data: response.data
                };
            } else {
                throw new Error((response && response.message) || 'Помилка отримання бонусу новачка');
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
        const miniRafflesContainer = document.querySelector('.mini-raffles-container');

        if (!mainRaffleContainer && !miniRafflesContainer) {
            console.error("❌ Raffles: Не знайдено контейнери для розіграшів");
            return;
        }

        // Показуємо індикатор завантаження
        showLoading('Завантаження розіграшів...');

        try {
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
        } catch (error) {
            console.error("Помилка при завантаженні активних розіграшів:", error);
            hideLoading();

            // Показуємо повідомлення про помилку
            showToast('Не вдалося завантажити розіграші. Спробуйте пізніше.');

            if (mainRaffleContainer) {
                mainRaffleContainer.innerHTML = `
                    <div class="empty-raffles">
                        <div class="empty-raffles-icon">❌</div>
                        <h3>Помилка завантаження</h3>
                        <p>Сталася помилка при спробі завантажити розіграші. Спробуйте оновити сторінку.</p>
                        <button class="join-raffle-btn" onclick="location.reload()">Оновити сторінку</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Відображення основного розіграшу
     */
    function displayMainRaffle(container, raffle) {
        if (!container || !raffle) return;

        // Створюємо HTML для основного розіграшу
        container.innerHTML = `
            <img class="main-raffle-image" src="${raffle.image_url || '/assets/prize-poster.gif'}" alt="${raffle.title}">
            <div class="main-raffle-content">
                <div class="main-raffle-header">
                    <h3 class="main-raffle-title">${raffle.title}</h3>
                    <div class="main-raffle-cost">
                        <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
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
        const joinButton = container.querySelector('.join-button');
        if (joinButton) {
            joinButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                openRaffleDetails(raffleId, raffleType);
            });
        }

        // Додаємо обробник для кнопки "Поділитися"
        const shareButton = container.querySelector('#share-raffle-btn');
        if (shareButton) {
            shareButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                shareRaffle(raffleId);
            });
        }
    }

    /**
     * Генерація HTML для розподілу призів
     */
    function generatePrizeDistributionHTML(prizeDistribution) {
        if (!prizeDistribution || typeof prizeDistribution !== 'object' || Object.keys(prizeDistribution).length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        let html = '';
        const places = Object.keys(prizeDistribution).sort((a, b) => parseInt(a) - parseInt(b));

        // Групуємо місця з однаковими призами
        const groupedPrizes = {};

        places.forEach(place => {
            const prize = prizeDistribution[place];
            if (!prize) return;

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
        if (!places || !Array.isArray(places) || places.length === 0) {
            return "Невідомо";
        }

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
        if (!raffle || !raffle.start_time || !raffle.end_time) {
            return 0;
        }

        try {
            const now = Date.now();
            const startTime = new Date(raffle.start_time).getTime();
            const endTime = new Date(raffle.end_time).getTime();

            if (isNaN(startTime) || isNaN(endTime)) {
                return 0;
            }

            const totalDuration = endTime - startTime;
            if (totalDuration <= 0) {
                return 0;
            }

            const elapsed = now - startTime;
            return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        } catch (error) {
            console.error("Помилка розрахунку прогресу:", error);
            return 0;
        }
    }

    /**
     * Оновлення таймера для основного розіграшу
     */
    function updateMainRaffleTimer(raffle) {
        const daysElement = document.querySelector('#days');
        const hoursElement = document.querySelector('#hours');
        const minutesElement = document.querySelector('#minutes');

        if (!daysElement || !hoursElement || !minutesElement || !raffle || !raffle.end_time) return;

        const updateTimer = () => {
            try {
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
                        }).catch(err => {
                            console.error("Помилка оновлення після завершення таймера:", err);
                        });
                    }, 5000);
                }
            } catch (error) {
                console.error("Помилка оновлення таймера:", error);
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
        if (!raffle) return null;

        // Створюємо контейнер
        const miniRaffle = document.createElement('div');
        miniRaffle.className = 'mini-raffle';
        miniRaffle.setAttribute('data-raffle-id', raffle.id);

        // Розраховуємо час, що залишився
        let timeLeftText = '';
        try {
            const now = new Date();
            const endTime = new Date(raffle.end_time);
            const timeLeft = endTime - now;

            if (timeLeft > 0) {
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                timeLeftText = `Залишилось: ${hours} год ${minutes} хв`;
            } else {
                timeLeftText = 'Завершується';
            }
        } catch (error) {
            console.error("Помилка розрахунку часу міні-розіграшу:", error);
            timeLeftText = 'Час не визначено';
        }

        // Форматуємо кількість переможців
        const winnersCount = raffle.winners_count || 1;
        const winnersText = `${raffle.prize_amount} ${raffle.prize_currency} (${winnersCount} переможців)`;

        // Формуємо HTML
        miniRaffle.innerHTML = `
            <div class="mini-raffle-info">
                <div class="mini-raffle-title">${raffle.title}</div>
                <div class="mini-raffle-cost">
                    <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
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
            button.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();

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
        if (!container) return;

        const newbieBonus = document.createElement('div');
        newbieBonus.className = 'mini-raffle';
        newbieBonus.setAttribute('data-raffle-id', 'newbie');

        newbieBonus.innerHTML = `
            <div class="mini-raffle-info">
                <div class="mini-raffle-title">Бонус новачка</div>
                <div class="mini-raffle-cost">
                    <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
                    <span>0 жетонів</span>
                </div>
                <div class="mini-raffle-prize">500 WINIX + 1 жетон</div>
                <div class="mini-raffle-time">Доступно тільки новим користувачам</div>
            </div>
            <button class="mini-raffle-button" data-raffle-id="newbie">Отримати</button>
        `;

        const button = newbieBonus.querySelector('.mini-raffle-button');
        if (button) {
            button.addEventListener('click', async function(event) {
                event.preventDefault();
                event.stopPropagation();

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
        if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
            window.WinixAPI.getUserData().then(userData => {
                if (userData && userData.data && userData.data.newbie_bonus_claimed) {
                    // Деактивуємо кнопку
                    if (button) {
                        button.textContent = 'Отримано';
                        button.disabled = true;
                        button.style.opacity = '0.6';
                        button.style.cursor = 'default';
                    }

                    // Додаємо водяний знак
                    markNewbieBonus(newbieBonus);
                }
            }).catch(err => {
                console.error("Помилка перевірки статусу бонусу:", err);
            });
        }
    }

    /**
     * Відображення історії розіграшів
     */
    async function displayRafflesHistory() {
        console.log("🎮 Raffles: Відображення історії розіграшів");

        // Якщо доступний модуль історії, використовуємо його
        if (window.RaffleHistory && typeof window.RaffleHistory.displayHistory === 'function') {
            window.RaffleHistory.displayHistory('history-container');
            return;
        }

        // Отримуємо контейнер для історії
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) {
            console.error("❌ Raffles: Не знайдено контейнер для історії розіграшів");
            return;
        }

        // Показуємо індикатор завантаження
        showLoading('Завантаження історії розіграшів...');

        try {
            // Отримуємо історію розіграшів
            const history = await getRafflesHistory();

            // Приховуємо індикатор завантаження
            hideLoading();

            // Очищаємо контейнер
            historyContainer.innerHTML = '';

            // Перевіряємо наявність даних
            if (!history || !Array.isArray(history) || history.length === 0) {
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
            // ВАЖЛИВО: Додаємо додаткову перевірку перед фільтрацією
            let wonRaffles = [];
            let participatedRaffles = [];

            try {
                wonRaffles = history.filter(item => item && item.status === 'won');
                participatedRaffles = history.filter(item => item && item.status !== 'won');
            } catch (error) {
                console.error("Помилка при фільтрації даних історії:", error);
                // У випадку помилки показуємо повідомлення
                historyContainer.innerHTML = `
                    <div class="empty-history">
                        <div class="empty-history-icon">❌</div>
                        <h3>Помилка обробки даних</h3>
                        <p>Виникла помилка при обробці даних історії. Спробуйте оновити сторінку.</p>
                        <button class="join-raffle-btn" onclick="location.reload()">Оновити сторінку</button>
                    </div>
                `;
                return;
            }

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

                    // ЗМІНЕНО: Спочатку шукаємо в масиві історії
                    const historyItem = history.find(item => item && item.raffle_id === raffleId);

                    if (historyItem) {
                        // ДОДАНО: Використовуємо модуль історії, якщо доступний
                        if (window.RaffleHistory && typeof window.RaffleHistory.showRaffleHistoryDetails === 'function') {
                            window.RaffleHistory.showRaffleHistoryDetails(historyItem);
                        } else {
                            showRaffleHistoryDetails(historyItem);
                        }
                    } else {
                        // Якщо не знайдено в масиві, отримуємо деталі з API
                        // ЗМІНЕНО: Правильне використання API для деталей історії
                        const userId = window.WinixAPI.getUserId();

                        if (userId) {
                            showLoading('Завантаження деталей розіграшу...');

                            window.WinixAPI.apiRequest(
                                `/api/user/${userId}/raffles-history/${raffleId}`,
                                'GET',
                                null,
                                { timeout: 8000, suppressErrors: true }
                            ).then(response => {
                                hideLoading();

                                if (response && response.status === 'success' && response.data) {
                                    if (window.RaffleHistory && typeof window.RaffleHistory.showRaffleHistoryDetails === 'function') {
                                        window.RaffleHistory.showRaffleHistoryDetails(response.data);
                                    } else {
                                        showRaffleHistoryDetails(response.data);
                                    }
                                } else {
                                    showToast('Не вдалося отримати деталі розіграшу');
                                }
                            }).catch(error => {
                                hideLoading();
                                console.error('Помилка отримання деталей розіграшу:', error);
                                showToast('Не вдалося отримати деталі розіграшу');
                            });
                        } else {
                            showToast('Не вдалося отримати ID користувача');
                        }
                    }
                });
            });

            // Оновлюємо статистику на основі історії
            updateHistoryStats();
        } catch (error) {
            console.error('Помилка при відображенні історії розіграшів:', error);
            hideLoading();

            // Показуємо повідомлення про помилку
            historyContainer.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">❌</div>
                    <h3>Помилка завантаження історії</h3>
                    <p>Не вдалося завантажити історію розіграшів. Спробуйте пізніше.</p>
                    <button class="join-raffle-btn" onclick="window.location.reload()">Оновити сторінку</button>
                </div>
            `;
        }
    }

    /**
     * Створення HTML для картки історії
     */
    function createHistoryCardHTML(item) {
        if (!item) return '';

        const statusClass = item.status === 'won' ? 'won' : 'participated';
        const statusText = item.status === 'won' ? 'Виграно' : 'Участь';

        return `
            <div class="history-card" data-raffle-id="${item.raffle_id}">
                <div class="history-date">${item.date || 'Дата не вказана'}</div>
                <div class="history-title">${item.title || 'Розіграш'}</div>
                <div class="history-prize">${item.prize || '0 WINIX'}</div>
                <div class="history-details">
                    <div class="history-entry">Використано жетонів: ${item.entry_count || 0}</div>
                    <div class="history-status ${statusClass}">${statusText}</div>
                </div>
                <div class="history-result">${item.result || 'Результат невідомий'}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            </div>
        `;
    }

    /**
     * Показати деталі історії розіграшу
     */
    function showRaffleHistoryDetails(raffleData) {
        // Використовуємо RaffleHistory модуль, якщо він доступний
        if (window.RaffleHistory && typeof window.RaffleHistory.showRaffleHistoryDetails === 'function') {
            window.RaffleHistory.showRaffleHistoryDetails(raffleData);
            return;
        }

        if (!raffleData) {
            showToast('Не вдалося отримати дані розіграшу');
            return;
        }

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
        if (raffleData.winners && Array.isArray(raffleData.winners) && raffleData.winners.length > 0) {
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
                        <div class="detail-value">${raffleData.date || 'Не вказано'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Приз:</div>
                        <div class="detail-value prize-value">${raffleData.prize || '0 WINIX'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Використано жетонів:</div>
                        <div class="detail-value">${raffleData.entry_count || 0}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Результат:</div>
                        <div class="detail-value ${raffleData.status === 'won' ? 'win-status' : 'participated-status'}">
                            ${raffleData.result || 'Результат невідомий'}
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
        if (!winners || !Array.isArray(winners) || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        return winners.map(winner => {
            if (!winner) return '';

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
                        <div class="winner-name">${winner.username || 'Користувач'}</div>
                        <div class="winner-id">ID: ${winner.userId || 'невідомо'}</div>
                    </div>
                    <div class="winner-prize">${winner.prize || '0 WINIX'}</div>
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
        try {
            // Оновлюємо таймер головного розіграшу
            const daysElement = document.querySelector('#days');
            const hoursElement = document.querySelector('#hours');
            const minutesElement = document.querySelector('#minutes');

            if (daysElement && hoursElement && minutesElement && _activeRaffles && Array.isArray(_activeRaffles) && _activeRaffles.length > 0) {
                // Знаходимо основний розіграш
                const mainRaffle = _activeRaffles.find(raffle => !raffle.is_daily);

                if (mainRaffle && mainRaffle.end_time) {
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
                        }).catch(err => {
                            console.error("Помилка оновлення після завершення таймера:", err);
                        });
                    }
                }
            }

            // Оновлюємо таймери міні-розіграшів
            const miniRaffleTimeElements = document.querySelectorAll('.mini-raffle-time');

            if (miniRaffleTimeElements.length > 0 && _activeRaffles && Array.isArray(_activeRaffles) && _activeRaffles.length > 0) {
                // Знаходимо щоденні розіграші
                const dailyRaffles = _activeRaffles.filter(raffle => raffle && raffle.is_daily);

                if (dailyRaffles.length > 0) {
                    const miniRaffles = document.querySelectorAll('.mini-raffle');

                    miniRaffles.forEach(raffleElement => {
                        const raffleId = raffleElement.getAttribute('data-raffle-id');
                        const timeElement = raffleElement.querySelector('.mini-raffle-time');

                        if (!timeElement || raffleId === 'newbie') return;

                        const raffle = dailyRaffles.find(r => r.id === raffleId);
                        if (!raffle || !raffle.end_time) return;

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
                            }).catch(err => {
                                console.error("Помилка оновлення після завершення таймера міні-розіграшу:", err);
                            });
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Помилка оновлення таймерів:", error);
        }
    }

    /**
     * Відкриття модального вікна з деталями розіграшу
     */
    function openRaffleDetails(raffleId, raffleType) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано');
            return;
        }

        // Перевіряємо наявність жетонів
        if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
            window.WinixAPI.getUserData().then(userData => {
                const coinsBalance = userData.data?.coins || 0;

                if (coinsBalance < 1) {
                    showToast('Для участі в розіграші потрібен щонайменше 1 жетон');
                    return;
                }

                // ЗМІНЕНО: Перевіряємо кеш
                if (_raffleDetailsCache[raffleId]) {
                    console.log(`📋 Raffles: Використання кешованих даних для розіграшу ${raffleId}`);
                    processRaffleDetails(_raffleDetailsCache[raffleId], raffleType);
                    return;
                }

                // Отримуємо дані розіграшу
                getRaffleDetails(raffleId).then(raffleData => {
                    if (!raffleData) {
                        showToast('Помилка отримання даних розіграшу');
                        return;
                    }

                    // Обробляємо деталі розіграшу
                    processRaffleDetails(raffleData, raffleType);
                }).catch(error => {
                    console.error('Помилка отримання деталей розіграшу:', error);
                    showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.');
                });
            }).catch(error => {
                console.error('Помилка отримання даних користувача:', error);
                showToast('Не вдалося отримати дані користувача. Спробуйте пізніше.');
            });
        } else {
            showToast('API не ініціалізовано коректно. Оновіть сторінку.');
        }
    }

    /**
     * Обробка деталей розіграшу
     */
    function processRaffleDetails(raffleData, raffleType) {
        if (!raffleData) {
            showToast('Помилка отримання даних розіграшу');
            return;
        }

        // Відкриваємо відповідне модальне вікно
        const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
        const modal = document.getElementById(modalId);

        if (!modal) {
            console.error(`Модальне вікно з id ${modalId} не знайдено`);
            showToast('Помилка відображення деталей розіграшу');
            return;
        }

        // Встановлюємо значення полів у модальному вікні
        const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '1';

            // Отримуємо баланс жетонів
            const userData = window.WinixAPI.getUserData().then(userData => {
                const coinsBalance = userData.data?.coins || 0;

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
            }).catch(error => {
                console.error("Помилка отримання балансу:", error);
                // За замовчуванням, встановлюємо максимум 10
                input.max = 10;
            });
        }

        const btnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
        const joinBtn = document.getElementById(btnId);

        if (joinBtn) {
            joinBtn.setAttribute('data-raffle-id', raffleData.id);
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

        // Додаємо обробник для закриття модального вікна
        const closeButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                modal.classList.remove('open');
            });
        });
    }

    /**
     * Функція обробки натискання на кнопку участі в розіграші
     */
    async function participateInRaffleUI(raffleId, raffleType, inputId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано');
            return;
        }

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

        try {
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
                await updateUserBalance();

                // Показуємо повідомлення про успіх
                showToast(result.message);

                // Якщо є бонус, показуємо повідомлення про нього
                if (result.data && result.data.bonus_amount) {
                    setTimeout(() => {
                        showToast(`Вітаємо! Ви отримали ${result.data.bonus_amount} WINIX як бонус!`);
                    }, 3000);
                }
            } else {
                // Показуємо повідомлення про помилку
                showToast(result.message);
            }
        } catch (error) {
            console.error('Помилка при участі в розіграші:', error);
            showToast('Сталася помилка при участі в розіграші. Спробуйте пізніше.');
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
        if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
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

                        if (history && Array.isArray(history) && history.length > 0) {
                            const wonRaffles = history.filter(item => item && item.status === 'won');

                            wonRaffles.forEach(raffle => {
                                if (!raffle || !raffle.prize) return;

                                // Витягуємо числову суму з рядка призу
                                const match = raffle.prize.match(/\d+(\.\d+)?/);
                                if (match) {
                                    totalWinix += parseFloat(match[0]);
                                }
                            });
                        }

                        winixWonElement.textContent = totalWinix.toLocaleString('uk-UA');
                    }).catch(error => {
                        console.error('Помилка отримання історії для статистики:', error);
                    });
                }

                if (tokensSpentElement) {
                    tokensSpentElement.textContent = userStats.tokens_spent || 0;
                }
            }).catch(error => {
                console.error('Помилка отримання даних користувача для статистики:', error);
            });
        }
    }

    /**
     * Оновлення статистики участі
     */
    function updateParticipationStats() {
        // Отримуємо дані про розіграші користувача
        getUserRaffles().then(userRaffles => {
            if (!userRaffles || !Array.isArray(userRaffles) || userRaffles.length === 0) return;

            // Отримуємо дані користувача
            if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                window.WinixAPI.getUserData().then(userData => {
                    if (!userData || !userData.data) return;

                    // Оновлюємо лічильник участі
                    const participations = userRaffles.length;
                    const userStats = userData.data;

                    // Якщо вони відрізняються, оновлюємо на сервері
                    if (participations !== userStats.participations_count) {
                        try {
                            window.WinixAPI.apiRequest(`/api/user/${userData.data.telegram_id}/statistics`, 'POST', {
                                participations_count: participations
                            }, {
                                suppressErrors: true
                            });
                        } catch (error) {
                            console.error('Помилка оновлення статистики участі:', error);
                        }
                    }

                    // Оновлюємо відображення
                    updateStatistics();
                }).catch(error => {
                    console.error('Помилка отримання даних користувача для статистики участі:', error);
                });
            }
        }).catch(error => {
            console.error('Помилка отримання розіграшів користувача для статистики:', error);
        });
    }

    /**
     * Оновлення статистики на основі історії
     */
    function updateHistoryStats() {
        // Отримуємо історію розіграшів
        getRafflesHistory().then(history => {
            if (!history || !Array.isArray(history) || history.length === 0) return;

            // Підраховуємо кількість перемог
            const wins = history.filter(item => item && item.status === 'won').length;

            // Отримуємо дані користувача
            if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                window.WinixAPI.getUserData().then(userData => {
                    if (!userData || !userData.data) return;

                    const userStats = userData.data;

                    // Якщо кількість перемог відрізняється, оновлюємо на сервері
                    if (wins !== userStats.wins_count) {
                        try {
                            window.WinixAPI.apiRequest(`/api/user/${userData.data.telegram_id}/statistics`, 'POST', {
                                wins_count: wins
                            }, {
                                suppressErrors: true
                            });
                        } catch (error) {
                            console.error('Помилка оновлення статистики перемог:', error);
                        }
                    }

                    // Оновлюємо відображення
                    updateStatistics();
                }).catch(error => {
                    console.error('Помилка отримання даних користувача для статистики історії:', error);
                });
            }
        }).catch(error => {
            console.error('Помилка отримання історії для статистики перемог:', error);
        });
    }

    /**
     * Оновлення балансу користувача
     */
    async function updateUserBalance() {
        try {
            // Перевіряємо наявність глобальної функції
            if (window.WinixAPI && window.WinixAPI.getBalance) {
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

            return true;
        } catch (error) {
            console.error('Помилка оновлення балансу:', error);
            return false;
        }
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
            }).catch(error => {
                console.error('Помилка отримання даних розіграшу для поширення:', error);
                showToast('Не вдалося отримати дані розіграшу для поширення');
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

        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return '';
            }
            return dateTimeFormat.format(date);
        } catch (error) {
            console.error('Помилка форматування дати:', error);
            return '';
        }
    }

    /**
     * Додавання ведучого нуля до числа
     */
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    /**
     * Показати індикатор завантаження
     */
    function showLoading(message = 'Завантаження...') {
        // Спочатку перевіряємо, чи є глобальна функція
        if (window.showLoading && typeof window.showLoading === 'function') {
            try {
                return window.showLoading(message);
            } catch (e) {
                console.warn("Помилка використання глобального showLoading:", e);
            }
        }

        // Запасний варіант, якщо глобальна функція не працює
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');
    }

    /**
     * Приховати індикатор завантаження
     */
    function hideLoading() {
        // Спочатку перевіряємо, чи є глобальна функція
        if (window.hideLoading && typeof window.hideLoading === 'function') {
            try {
                return window.hideLoading();
            } catch (e) {
                console.warn("Помилка використання глобального hideLoading:", e);
            }
        }

        // Запасний варіант, якщо глобальна функція не працює
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
    }

    /**
     * Показати повідомлення toast
     */
    function showToast(message, duration = 3000) {
        // Перевіряємо наявність глобальної функції
        if (window.showToast && typeof window.showToast === 'function') {
            try {
                return window.showToast(message, duration);
            } catch (e) {
                console.warn("Помилка використання глобального showToast:", e);
            }
        }

        // Запасний варіант, якщо глобальна функція відсутня
        const toast = document.getElementById('toast-message');
        if (!toast) {
            // Створюємо елемент toast
            const newToast = document.createElement('div');
            newToast.id = 'toast-message';
            newToast.className = 'toast-message';
            document.body.appendChild(newToast);

            // Додаємо стилі, якщо їх немає
            if (!document.getElementById('toast-styles')) {
                const style = document.createElement('style');
                style.id = 'toast-styles';
                style.textContent = `
                    .toast-message {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%) translateY(100px);
                        background: rgba(0, 0, 0, 0.7);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 8px;
                        z-index: 10000;
                        opacity: 0;
                        transition: transform 0.3s, opacity 0.3s;
                        font-size: 16px;
                        max-width: 90%;
                        text-align: center;
                    }
                    .toast-message.show {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                `;
                document.head.appendChild(style);
            }

            setTimeout(() => showToast(message, duration), 100);
            return;
        }

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
        if (!container) return;

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
        const tabSections = document.querySelectorAll('.tab-content');

        // Знімаємо активний стан з усіх вкладок і секцій
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabSections.forEach(section => section.classList.remove('active'));

        // Додаємо активний стан до вибраної вкладки і секції
        const activeTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        const activeTabSection = document.getElementById(`${tabName}-raffles`);

        if (activeTabButton) activeTabButton.classList.add('active');
        if (activeTabSection) activeTabSection.classList.add('active');

        // Якщо це вкладка з історією, оновлюємо її
        if (tabName === 'past' || tabName === 'history') {
            if (window.RaffleHistory && typeof window.RaffleHistory.displayHistory === 'function') {
                window.RaffleHistory.displayHistory('history-container');
            } else {
                displayRafflesHistory();
            }
        } else if (tabName === 'active') {
            // Оновлюємо активні розіграші
            displayActiveRaffles();
        }
    }

    /**
     * Налаштування кнопок участі у розіграшах
     */
    function setupRaffleButtons() {
        // Налаштовуємо кнопки участі для основного розіграшу
        const mainJoinBtn = document.getElementById('main-join-btn');
        if (mainJoinBtn) {
            mainJoinBtn.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                const inputId = 'main-token-amount';

                participateInRaffleUI(raffleId, raffleType, inputId);
            });
        }

        // Налаштовуємо кнопки участі для щоденного розіграшу
        const dailyJoinBtn = document.getElementById('daily-join-btn');
        if (dailyJoinBtn) {
            dailyJoinBtn.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                const inputId = 'daily-token-amount';

                participateInRaffleUI(raffleId, raffleType, inputId);
            });
        }

        // Налаштовуємо кнопки "Всі" для встановлення максимальної кількості жетонів
        const mainAllBtn = document.getElementById('main-all-tokens-btn');
        if (mainAllBtn) {
            mainAllBtn.addEventListener('click', function() {
                const input = document.getElementById('main-token-amount');
                if (input) {
                    input.value = input.max || 1;
                }
            });
        }

        const dailyAllBtn = document.getElementById('daily-all-tokens-btn');
        if (dailyAllBtn) {
            dailyAllBtn.addEventListener('click', function() {
                const input = document.getElementById('daily-token-amount');
                if (input) {
                    input.value = input.max || 1;
                }
            });
        }
    }

    /**
     * Очищення всіх станів модуля
     */
    function resetAllStates() {
        // Скидаємо всі прапорці
        _isParticipating = false;
        _isLoadingRaffles = false;

        // Очищаємо таймаути
        if (_participationTimeoutId) {
            clearTimeout(_participationTimeoutId);
            _participationTimeoutId = null;
        }

        if (_loadingTimeoutId) {
            clearTimeout(_loadingTimeoutId);
            _loadingTimeoutId = null;
        }

        // Очищаємо кеші
        _raffleDetailsCache = {};

        // Приховуємо лоадери
        hideLoading();

        // Очищаємо активні запити через API
        if (window.WinixAPI && typeof window.WinixAPI.forceCleanupRequests === 'function') {
            window.WinixAPI.forceCleanupRequests();
        }

        // Скидаємо стан модуля історії, якщо він доступний
        if (window.RaffleHistory && typeof window.RaffleHistory.resetRequestState === 'function') {
            window.RaffleHistory.resetRequestState();
        }

        console.log("🔄 Raffles: Примусове скидання всіх станів");
        return true;
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація модуля розіграшів
     */
    function init() {
        console.log("🎮 Raffles: Ініціалізація...");

        // Перевіряємо готовність DOM
        if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
            console.log("DOM ще не готовий, відкладаємо ініціалізацію");
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        try {
            // ВАЖЛИВО: Перевіряємо наявність необхідних функцій API
            if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                console.error("API модуль не готовий, ініціалізацію відкладено");
                setTimeout(init, 500); // Спробуємо пізніше
                return;
            }

            // Обробники подій для перемикання вкладок
            const tabButtons = document.querySelectorAll('.tab-button');
            if (tabButtons.length > 0) {
                console.log(`Знайдено ${tabButtons.length} кнопок вкладок`);
                tabButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const tabName = this.getAttribute('data-tab');
                        switchTab(tabName);
                    });
                });
            } else {
                console.warn("⚠️ Кнопки вкладок не знайдено");
            }

            // Отримуємо дані активних розіграшів
            getActiveRaffles().then(() => {
                // Відображаємо активні розіграші
                displayActiveRaffles();
            }).catch(error => {
                console.error("Помилка при отриманні активних розіграшів:", error);

                // ДОДАНО: Спроба відновлення після помилки
                resetAllStates();

                // Відображаємо повідомлення про помилку
                const mainRaffleContainer = document.querySelector('.main-raffle');
                if (mainRaffleContainer) {
                    mainRaffleContainer.innerHTML = `
                        <div class="empty-raffles">
                            <div class="empty-raffles-icon">❌</div>
                            <h3>Помилка завантаження</h3>
                            <p>Сталася помилка при спробі завантажити розіграші. Спробуйте оновити сторінку.</p>
                            <button class="join-raffle-btn" onclick="location.reload()">Оновити сторінку</button>
                        </div>
                    `;
                }
            });

            // Налаштовуємо кнопки закриття для модальних вікон
            document.querySelectorAll('.modal-close, .cancel-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const modal = this.closest('.raffle-modal');
                    if (modal) modal.classList.remove('open');
                });
            });

            // Налаштовуємо кнопки участі у розіграшах
            setupRaffleButtons();

            console.log("✅ Raffles: Ініціалізацію завершено");
        } catch (error) {
            console.error("Критична помилка при ініціалізації модуля розіграшів:", error);

            // Скидаємо всі стани у випадку помилки
            resetAllStates();
        }
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
        updateStatistics,
        shareRaffle,
        resetAllStates
    };

    // Глобальна функція відкриття розіграшу
    window.openRaffleDetails = openRaffleDetails;

    // Функція перемикання вкладок
    window.switchRaffleTab = switchTab;

    // Додаємо init в глобальний об'єкт
    window.rafflesFunctions = {
        switchTab,
        loadRaffleHistory: displayRafflesHistory,
        resetAllStates
    };

    // Ініціалізуємо модуль при завантаженні документа
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // У випадку, якщо DOM вже завантажено
        setTimeout(init, 100);
    }
})();