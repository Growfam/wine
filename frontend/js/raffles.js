/**
 * raffles.js - Модуль для роботи з розіграшами WINIX
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

            // Отримуємо дані з API
            const response = await window.WinixAPI.apiRequest('/api/raffles', 'GET');

            if (response.status === 'success') {
                _activeRaffles = response.data;
                _lastRafflesUpdateTime = now;

                console.log(`✅ Raffles: Отримано ${_activeRaffles.length} активних розіграшів`);
                return _activeRaffles;
            } else {
                throw new Error(response.message || 'Помилка отримання розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання активних розіграшів:', error);
            // Повертаємо кешовані дані у випадку помилки
            return _activeRaffles || [];
        } finally {
            _isLoadingRaffles = false;
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

            const response = await window.WinixAPI.apiRequest(`/api/raffles/${raffleId}`, 'GET');

            if (response.status === 'success') {
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
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

            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles`, 'GET');

            if (response.status === 'success') {
                _userRaffles = response.data;
                return _userRaffles;
            } else {
                throw new Error(response.message || 'Помилка отримання розіграшів користувача');
            }
        } catch (error) {
            console.error('❌ Помилка отримання розіграшів користувача:', error);
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

            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles-history`, 'GET');

            if (response.status === 'success') {
                _rafflesHistory = response.data;
                return _rafflesHistory;
            } else {
                throw new Error(response.message || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання історії розіграшів:', error);
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

            if (response.status === 'success') {
                // Оновлюємо кеш активних розіграшів
                await getActiveRaffles(true);

                // Оновлюємо кеш розіграшів користувача
                await getUserRaffles();

                // Оновлюємо баланс монет у користувача
                if (window.WinixAPI.getBalance) {
                    await window.WinixAPI.getBalance();
                }

                return {
                    status: 'success',
                    message: response.data.message || 'Ви успішно взяли участь у розіграші',
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Помилка участі в розіграші');
            }
        } catch (error) {
            console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);
            hideLoading();
            return { status: 'error', message: error.message || 'Помилка участі в розіграші' };
        } finally {
            _isParticipating = false;
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
                if (window.WinixAPI.getBalance) {
                    await window.WinixAPI.getBalance();
                }

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

        // Отримуємо активні розіграші
        const raffles = await getActiveRaffles();

        if (!raffles || raffles.length === 0) {
            console.log("ℹ️ Raffles: Активні розіграші не знайдено");
            return;
        }

        // Створюємо список основних і міні-розіграшів
        const mainRaffles = raffles.filter(raffle => !raffle.is_daily);
        const miniRaffles = raffles.filter(raffle => raffle.is_daily);

        // Відображаємо основний розіграш
        if (mainRaffleContainer && mainRaffles.length > 0) {
            displayMainRaffle(mainRaffleContainer, mainRaffles[0]);
        }

        // Відображаємо міні-розіграші
        if (miniRafflesContainer && miniRaffles.length > 0) {
            // Очищаємо контейнер
            miniRafflesContainer.innerHTML = '';

            // Додаємо кожен міні-розіграш
            miniRaffles.forEach(raffle => {
                const miniRaffleElement = createMiniRaffleElement(raffle);
                miniRafflesContainer.appendChild(miniRaffleElement);
            });
        }

        // Активуємо таймери
        startRaffleTimers();
    }

    /**
     * Відображення основного розіграшу
     */
    function displayMainRaffle(container, raffle) {
        if (!container || !raffle) return;

        // Отримуємо елементи основного розіграшу
        const titleElement = container.querySelector('.main-raffle-title');
        const prizeElement = container.querySelector('.main-raffle-prize');
        const participantsCountElement = container.querySelector('.participants-count');
        const progressBar = container.querySelector('.progress');
        const joinButton = container.querySelector('.join-button');

        // Оновлюємо дані
        if (titleElement) titleElement.textContent = raffle.title;

        if (prizeElement) {
            prizeElement.textContent = `${raffle.prize_amount} ${raffle.prize_currency}`;
        }

        if (participantsCountElement) {
            participantsCountElement.textContent = raffle.participants_count || 0;
        }

        if (progressBar) {
            // Розраховуємо прогрес
            const now = Date.now();
            const startTime = raffle.start_time;
            const endTime = raffle.end_time;
            const totalDuration = endTime - startTime;
            const elapsed = now - startTime;
            const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

            progressBar.style.width = `${progress}%`;
        }

        if (joinButton) {
            joinButton.setAttribute('data-raffle-id', raffle.id);
            joinButton.setAttribute('data-raffle-type', 'main');

            // Додаємо обробник натискання
            joinButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                openRaffleDetails(raffleId, 'main');
            });
        }

        // Оновлюємо дані для таймера
        const daysElement = container.querySelector('#days');
        const hoursElement = container.querySelector('#hours');
        const minutesElement = container.querySelector('#minutes');

        if (daysElement && hoursElement && minutesElement) {
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
            }
        }
    }

    /**
     * Створення елементу міні-розіграшу
     */
    function createMiniRaffleElement(raffle) {
        // Створюємо контейнер
        const miniRaffle = document.createElement('div');
        miniRaffle.className = 'mini-raffle';

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
                    У вас ще немає участі в розіграшах
                </div>
            `;
            return;
        }

        // Додаємо кожен запис історії
        history.forEach(item => {
            const historyCard = document.createElement('div');
            historyCard.className = 'history-card';

            // Визначаємо статус
            let statusClass = '';
            let statusText = '';

            if (item.status === 'won') {
                statusClass = 'won';
                statusText = 'Виграно';
            } else {
                statusClass = 'participated';
                statusText = 'Участь';
            }

            historyCard.innerHTML = `
                <div class="history-date">${item.date}</div>
                <div class="history-prize">${item.prize}</div>
                <div class="history-winners">${item.result}</div>
                <div class="history-status ${statusClass}">${statusText}</div>
            `;

            // Додаємо обробник натискання
            historyCard.addEventListener('click', function() {
                createRaffleDetailsModal(item);
            });

            historyContainer.appendChild(historyCard);
        });
    }

    /**
     * Створення модального вікна з деталями розіграшу з історії
     */
    function createRaffleDetailsModal(raffleData) {
        // Видаляємо існуюче модальне вікно, якщо воно є
        let existingModal = document.getElementById('raffle-history-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.id = 'raffle-history-modal';
        modal.className = 'raffle-modal';

        // Генеруємо список переможців, якщо вони є
        let winnersListHTML = '';
        if (raffleData.winners && raffleData.winners.length > 0) {
            winnersListHTML = generateWinnersListHTML(raffleData.winners);
        } else {
            winnersListHTML = '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        // Формуємо HTML для модального вікна
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Деталі розіграшу</h2>
                    <span class="modal-close">×</span>
                </div>
                
                <div class="prize-details">
                    <div class="detail-item">
                        <div class="detail-label">Дата:</div>
                        <div class="detail-value">${raffleData.date}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Приз:</div>
                        <div class="detail-value">${raffleData.prize}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Статус:</div>
                        <div class="detail-value ${raffleData.status}">${raffleData.result}</div>
                    </div>
                </div>
                
                <div class="participation-info">
                    <h3>Переможці</h3>
                    <div style="margin-top: 16px; max-height: 280px; overflow-y: auto; padding-right: 8px;">
                        ${winnersListHTML}
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

        return modal;
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
            const placeClass = winner.place <= 3 ? `top-${winner.place}` : '';
            const bgColor = winner.place === 1 ? 'linear-gradient(145deg, #FFD700, #FFA500)' :
                            winner.place === 2 ? 'linear-gradient(145deg, #C0C0C0, #A9A9A9)' :
                            winner.place === 3 ? 'linear-gradient(145deg, #CD7F32, #A0522D)' :
                            'rgba(0, 0, 0, 0.3)';
            const boxShadow = winner.place <= 3 ?
                            `box-shadow: 0 0 8px ${winner.place === 1 ? 'rgba(255, 215, 0, 0.5)' : 
                                          winner.place === 2 ? 'rgba(192, 192, 192, 0.5)' : 
                                          'rgba(205, 127, 50, 0.5)'};` : '';

            // Формуємо HTML для одного переможця
            return `
                <div style="display: flex; align-items: center; background: ${winner.isCurrentUser ? 'linear-gradient(145deg, rgba(30, 113, 161, 0.5), rgba(0, 201, 167, 0.3))' : 'rgba(30, 39, 70, 0.5)'};
                          border-radius: 8px; padding: 10px; margin-bottom: 8px; ${winner.isCurrentUser ? 'border: 1px solid rgba(0, 201, 167, 0.5);' : ''}">
                    <div style="width: 36px; height: 36px; min-width: 36px; background: ${bgColor};
                             border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-right: 12px;
                             ${boxShadow}">
                        <span style="font-weight: bold; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${winner.place}</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: ${winner.isCurrentUser ? '#FFD700' : 'white'};
                                  ${winner.isCurrentUser ? 'text-shadow: 0 0 3px rgba(255, 215, 0, 0.5);' : ''}">
                            ${winner.username}
                        </div>
                        <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.7);">
                            ID: ${winner.userId}
                        </div>
                    </div>
                    <div style="background: linear-gradient(90deg, #FFD700, #00C9A7); padding: 5px 10px; border-radius: 20px; 
                              font-weight: bold; color: #1A1A2E; font-size: 0.875rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">
                        ${winner.prize}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Запуск таймерів для розіграшів
     */
    function startRaffleTimers() {
        // Запускаємо оновлення таймерів кожну хвилину
        setInterval(updateRaffleTimers, 60000);

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
                miniRaffleTimeElements.forEach((timeElement, index) => {
                    if (index < dailyRaffles.length) {
                        const raffle = dailyRaffles[index];
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
            const coinsBalance = userData.coins || 0;

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
                if (input) input.value = '1';

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
                } else {
                    const titleElement = document.getElementById('main-modal-title');
                    if (titleElement) titleElement.textContent = raffleData.title || 'Гранд Розіграш';

                    const prizeElement = document.getElementById('main-prize-value');
                    if (prizeElement) prizeElement.textContent = `${raffleData.prize_amount} ${raffleData.prize_currency} (${raffleData.winners_count} переможців)`;

                    const participantsElement = document.getElementById('main-participants');
                    if (participantsElement) participantsElement.textContent = raffleData.participants_count || '0';

                    const endDateElement = document.getElementById('main-end-time');
                    if (endDateElement) endDateElement.textContent = formatDate(raffleData.end_time);
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

        // Беремо участь у розіграші
        const result = await participateInRaffle(raffleId, entryCount);

        if (result.status === 'success') {
            // Закриваємо модальне вікно
            if (modal) modal.classList.remove('open');

            // Оновлюємо відображення розіграшів
            await displayActiveRaffles();

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
    }

    /**
     * Функція обробки переключення вкладок
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
                const modal = this.closest('.raffle-modal');
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
                if (userData.newbie_bonus_claimed) {
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
        claimNewbieBonus
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