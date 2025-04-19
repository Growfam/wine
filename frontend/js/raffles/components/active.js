/**
 * WINIX - Система розіграшів (active.js)
 * Оновлений модуль для роботи з активними розіграшами
 * Виправлено проблеми зі списанням жетонів та обробкою участі
 * @version 1.5.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше active.js');
        return;
    }

    // Підмодуль для активних розіграшів
    const active = {
        // Дані активних розіграшів
        raffles: [],

        // Час останнього оновлення
        lastUpdate: 0,

        // Інтервал кешування (30 секунд)
        cacheInterval: 30 * 1000,

        // Таймери зворотнього відліку
        countdownTimers: {},

        // Відстеження запитів участі
        participationRequests: {},

        // Ініціалізація модуля
        init: function() {
            console.log('🎲 Ініціалізація модуля активних розіграшів...');

            // Завантажуємо активні розіграші, якщо активна відповідна вкладка
            if (WinixRaffles.state.activeTab === 'active') {
                this.loadActiveRaffles();
            }

            // Додаємо обробники подій
            this.setupEventListeners();
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для кнопок участі та перегляду деталей розіграшів (делегування подій)
            document.addEventListener('click', (e) => {
                // Обробка кнопок участі в головному розіграші
                if (e.target.classList.contains('join-button')) {
                    const raffleId = e.target.getAttribute('data-raffle-id');
                    if (raffleId && !e.target.disabled && !e.target.classList.contains('processing')) {
                        e.preventDefault();

                        // Оптимізована перевірка наявності модуля
                        if (this.participationRequests[raffleId]) {
                            // Запобігаємо подвійним кліками
                            const now = Date.now();
                            if (now - this.participationRequests[raffleId] < 2000) {
                                if (typeof window.showToast === 'function') {
                                    window.showToast('Будь ласка, зачекайте завершення попереднього запиту', 'info');
                                }
                                return;
                            }
                        }

                        // Запам'ятовуємо час запиту
                        this.participationRequests[raffleId] = Date.now();

                        // Додаємо клас для індикації
                        e.target.classList.add('processing');
                        e.target.disabled = true;

                        // Зберігаємо оригінальний текст кнопки, якщо він ще не збережений
                        if (!e.target.getAttribute('data-original-text')) {
                            e.target.setAttribute('data-original-text', e.target.textContent);
                        }

                        // Змінюємо текст на "Обробка..."
                        e.target.textContent = 'Обробка...';

                        // Перевіряємо чи модуль участі ініціалізовано
                        if (WinixRaffles.participation) {
                            // Використовуємо правильну обробку промісів
                            WinixRaffles.participation.participateInRaffle(raffleId, 'main')
                                .then(result => {
                                    // Обробка успішної відповіді
                                    if (result.success) {
                                        console.log('✅ Успішна участь в розіграші:', result.message);

                                        // Перевіряємо, чи було списано жетони
                                        if (result.data && typeof result.data.new_coins_balance !== 'undefined') {
                                            // Оновлюємо відображення балансу
                                            const userCoinsElement = document.getElementById('user-coins');
                                            if (userCoinsElement) {
                                                userCoinsElement.textContent = result.data.new_coins_balance;
                                            }

                                            // Оновлюємо локальне сховище
                                            localStorage.setItem('userCoins', result.data.new_coins_balance.toString());
                                            localStorage.setItem('winix_coins', result.data.new_coins_balance.toString());
                                        } else {
                                            console.warn('⚠️ Сервер не повернув оновлений баланс жетонів');

                                            // Примусово оновлюємо баланс
                                            this.refreshUserBalance();
                                        }
                                    } else {
                                        // Якщо відповідь отримана, але участь не вдалася
                                        console.warn('⚠️ Помилка участі в розіграші:', result.message);
                                        if (typeof window.showToast === 'function') {
                                            window.showToast(result.message, 'warning');
                                        }
                                        // Відновлюємо стан кнопки
                                        this._resetButtonState(e.target, raffleId);
                                    }
                                })
                                .catch(error => {
                                    // Обробка помилок
                                    console.error('❌ Помилка участі в розіграші:', error);
                                    // Відновлюємо стан кнопки
                                    this._resetButtonState(e.target, raffleId);

                                    if (typeof window.showToast === 'function') {
                                        window.showToast(error.message || 'Помилка участі в розіграші', 'error');
                                    }
                                })
                                .finally(() => {
                                    // Видаляємо запит зі списку активних
                                    delete this.participationRequests[raffleId];
                                });
                        } else {
                            // Запасний варіант, якщо модуль участі не доступний
                            this.fallbackParticipate(raffleId, 'main')
                                .finally(() => {
                                    delete this.participationRequests[raffleId];
                                    this._resetButtonState(e.target, raffleId);
                                });
                        }
                    }
                }

                // Обробка кнопок участі у міні-розіграші
                if (e.target.classList.contains('mini-raffle-button')) {
                    const raffleId = e.target.getAttribute('data-raffle-id');
                    if (raffleId && !e.target.disabled && !e.target.classList.contains('processing')) {
                        e.preventDefault();

                        // Оптимізована перевірка наявності модуля
                        if (this.participationRequests[raffleId]) {
                            // Запобігаємо подвійним кліками
                            const now = Date.now();
                            if (now - this.participationRequests[raffleId] < 2000) {
                                if (typeof window.showToast === 'function') {
                                    window.showToast('Будь ласка, зачекайте завершення попереднього запиту', 'info');
                                }
                                return;
                            }
                        }

                        // Запам'ятовуємо час запиту
                        this.participationRequests[raffleId] = Date.now();

                        // Додаємо клас для індикації
                        e.target.classList.add('processing');
                        e.target.disabled = true;

                        // Зберігаємо оригінальний текст кнопки, якщо він ще не збережений
                        if (!e.target.getAttribute('data-original-text')) {
                            e.target.setAttribute('data-original-text', e.target.textContent);
                        }

                        // Змінюємо текст на "Обробка..."
                        e.target.textContent = 'Обробка...';

                        // Перевіряємо чи модуль участі ініціалізовано
                        if (WinixRaffles.participation) {
                            // Використовуємо правильну обробку промісів
                            WinixRaffles.participation.participateInRaffle(raffleId, 'daily')
                                .then(result => {
                                    // Обробка успішної відповіді
                                    if (result.success) {
                                        console.log('✅ Успішна участь в міні-розіграші:', result.message);

                                        // Перевіряємо, чи було списано жетони
                                        if (result.data && typeof result.data.new_coins_balance !== 'undefined') {
                                            // Оновлюємо відображення балансу
                                            const userCoinsElement = document.getElementById('user-coins');
                                            if (userCoinsElement) {
                                                userCoinsElement.textContent = result.data.new_coins_balance;
                                            }

                                            // Оновлюємо локальне сховище
                                            localStorage.setItem('userCoins', result.data.new_coins_balance.toString());
                                            localStorage.setItem('winix_coins', result.data.new_coins_balance.toString());
                                        } else {
                                            console.warn('⚠️ Сервер не повернув оновлений баланс жетонів');

                                            // Примусово оновлюємо баланс
                                            this.refreshUserBalance();
                                        }
                                    } else {
                                        // Якщо відповідь отримана, але участь не вдалася
                                        console.warn('⚠️ Помилка участі в міні-розіграші:', result.message);
                                        if (typeof window.showToast === 'function') {
                                            window.showToast(result.message, 'warning');
                                        }

                                        // Відновлюємо стан кнопки та її оригінальний текст
                                        this._resetButtonState(e.target, raffleId);
                                    }
                                })
                                .catch(error => {
                                    // Обробка помилок
                                    console.error('❌ Помилка участі в міні-розіграші:', error);

                                    // Відновлюємо стан кнопки та її оригінальний текст
                                    this._resetButtonState(e.target, raffleId);

                                    // Показуємо повідомлення про помилку
                                    if (typeof window.showToast === 'function') {
                                        window.showToast(error.message || 'Помилка участі в розіграші', 'error');
                                    }
                                })
                                .finally(() => {
                                    // Видаляємо запит зі списку активних
                                    delete this.participationRequests[raffleId];
                                });
                        } else {
                            // Запасний варіант, якщо модуль участі не доступний
                            this.fallbackParticipate(raffleId, 'daily')
                                .finally(() => {
                                    delete this.participationRequests[raffleId];
                                    this._resetButtonState(e.target, raffleId);
                                });
                        }
                    }
                }

                // Обробка кнопок перегляду деталей розіграшів
                if (e.target.classList.contains('raffle-details-button')) {
                    const raffleId = e.target.getAttribute('data-raffle-id');
                    if (raffleId) {
                        e.preventDefault();
                        this.showRaffleDetails(raffleId);
                    }
                }
            });

            // Обробник зміни вкладки
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    if (tabName === 'active') {
                        // Завантажуємо активні розіграші при переключенні на вкладку
                        this.loadActiveRaffles();
                    }
                });
            });

            // Додаємо обробник події для оновлення стану кнопок після участі
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful && event.detail.raffleId) {
                    // Оновлюємо стан кнопок для цього розіграшу
                    this.updateButtonsAfterParticipation(event.detail.raffleId, event.detail.ticketCount || 1);
                }
            });
        },

        /**
         * Примусове оновлення балансу жетонів користувача
         */
        refreshUserBalance: async function() {
            try {
                if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                    const response = await window.WinixAPI.getBalance();

                    if (response && response.status === 'success' && response.data) {
                        const newCoinsBalance = response.data.coins;

                        // Оновлюємо відображення балансу
                        const userCoinsElement = document.getElementById('user-coins');
                        if (userCoinsElement) {
                            userCoinsElement.textContent = newCoinsBalance;
                        }

                        // Оновлюємо локальне сховище
                        localStorage.setItem('userCoins', newCoinsBalance.toString());
                        localStorage.setItem('winix_coins', newCoinsBalance.toString());

                        console.log('✅ Баланс жетонів оновлено:', newCoinsBalance);
                    }
                }
            } catch (error) {
                console.error('❌ Помилка оновлення балансу:', error);
            }
        },

        /**
         * Оновити стан кнопок після успішної участі
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         */
        updateButtonsAfterParticipation: function(raffleId, ticketCount) {
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);

            buttons.forEach(button => {
                // Видаляємо клас обробки
                button.classList.remove('processing');

                // Розблоковуємо кнопку
                button.disabled = false;

                // Додаємо клас участі
                button.classList.add('participating');

                // Оновлюємо текст кнопки
                const isMini = button.classList.contains('mini-raffle-button');
                button.textContent = isMini ?
                    `Додати ще білет (${ticketCount})` :
                    `Додати ще білет (у вас: ${ticketCount})`;
            });
        },

        /**
         * Скидання стану кнопки
         * @param {HTMLElement} button - Елемент кнопки
         * @param {string} raffleId - ID розіграшу
         * @private
         */
        _resetButtonState: function(button, raffleId) {
            // Видаляємо клас обробки
            button.classList.remove('processing');
            button.disabled = false;

            // Перевіряємо участь у розіграші через модуль participation
            const isParticipating = WinixRaffles.participation &&
                                    WinixRaffles.participation.participatingRaffles &&
                                    WinixRaffles.participation.participatingRaffles.has(raffleId);

            if (isParticipating) {
                // Якщо користувач уже бере участь, відображаємо відповідний стан
                const ticketCount = WinixRaffles.participation.userRaffleTickets ?
                                   (WinixRaffles.participation.userRaffleTickets[raffleId] || 1) : 1;
                const isMini = button.classList.contains('mini-raffle-button');

                button.textContent = isMini ?
                    `Додати ще білет (${ticketCount})` :
                    `Додати ще білет (у вас: ${ticketCount})`;

                button.classList.add('participating');
            } else {
                // Відновлюємо оригінальний текст кнопки
                const originalText = button.getAttribute('data-original-text');

                if (originalText) {
                    button.textContent = originalText;
                } else {
                    // Встановлюємо стандартний текст, якщо оригінальний не знайдено
                    const entryFee = button.getAttribute('data-entry-fee') || '1';
                    button.textContent = button.classList.contains('mini-raffle-button') ?
                        'Взяти участь' :
                        `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                }

                button.classList.remove('participating');
            }
        },

        // Завантаження активних розіграшів
        loadActiveRaffles: async function(quiet = false) {
            if (WinixRaffles.state.isLoading) return;

            // Перевіряємо чи потрібно оновлювати кеш
            const now = Date.now();
            if (!quiet && now - this.lastUpdate < this.cacheInterval && this.raffles.length > 0) {
                console.log('🎲 Використовуємо кешовані дані активних розіграшів');
                this.renderActiveRaffles(this.raffles);
                return;
            }

            WinixRaffles.state.isLoading = true;

            if (!quiet) {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }
            }

            try {
                console.log('🎲 Завантаження активних розіграшів...');

                const response = await WinixAPI.apiRequest(WinixRaffles.config.activeRafflesEndpoint);
                console.log('👉 Отримана відповідь:', response);

                if (!quiet) {
                    if (typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }
                }

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    console.log('👉 Знайдено розіграшів:', response.data.length);
                    this.raffles = response.data;
                    this.lastUpdate = now;

                    // Зберігаємо в локальному сховищі
                    try {
                        localStorage.setItem('winix_active_raffles', JSON.stringify({
                            timestamp: now,
                            data: this.raffles
                        }));
                    } catch (e) {
                        console.warn('⚠️ Не вдалося зберегти дані в локальному сховищі:', e);
                    }

                    this.renderActiveRaffles(this.raffles);
                } else {
                    console.error('❌ Помилка завантаження активних розіграшів:',
                        response ? response.message || 'Невідома помилка' : 'Немає відповіді від сервера');
                    this.tryLoadFromLocalStorage();
                }
            } catch (error) {
                if (!quiet) {
                    if (typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }
                }

                console.error('❌ Помилка завантаження активних розіграшів:', error);
                if (error.message && error.message.includes('raffle_not_found')) {
                    // Показуємо спеціальне повідомлення користувачу
                    if (typeof window.showToast === 'function') {
                        window.showToast("Один або більше розіграшів вже завершено. Оновлюємо список...", "warning");
                    }

                    // Очищаємо локальний кеш розіграшів
                    try {
                        localStorage.removeItem('winix_active_raffles');
                    } catch (e) {
                        console.warn("⚠️ Не вдалося очистити кеш розіграшів:", e);
                    }

                    // Повторно завантажуємо розіграші після паузи
                    setTimeout(() => {
                        this.loadActiveRaffles(true);
                    }, 2000);
                }
                this.tryLoadFromLocalStorage();
            } finally {
                WinixRaffles.state.isLoading = false;
            }
        },

        // Спроба завантажити дані з локального сховища
        tryLoadFromLocalStorage: function() {
            try {
                const storedRaffles = localStorage.getItem('winix_active_raffles');
                if (storedRaffles) {
                    const parsedRaffles = JSON.parse(storedRaffles);

                    // Перевірка актуальності кешу
                    if (parsedRaffles && parsedRaffles.timestamp) {
                        const now = Date.now();
                        const cacheAge = now - parsedRaffles.timestamp;

                        // Якщо кеш старший за 30 хвилин, не використовуємо його
                        if (cacheAge > 30 * 60 * 1000) {
                            console.log('🎲 Кеш розіграшів застарів, не використовуємо');
                            this.renderEmptyActiveRaffles();
                            return;
                        }
                    }

                    if (parsedRaffles && Array.isArray(parsedRaffles.data) && parsedRaffles.data.length > 0) {
                        console.log('🎲 Використовуємо дані з локального сховища');
                        this.raffles = parsedRaffles.data;
                        this.renderActiveRaffles(this.raffles);
                        return;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Помилка завантаження даних з локального сховища:', e);
            }

            // Якщо не вдалося завантажити з локального сховища
            this.renderEmptyActiveRaffles();
        },

        // Відображення активних розіграшів
        renderActiveRaffles: function(raffles) {
            console.log('👉 renderActiveRaffles викликано з:', raffles);
            // Очищаємо всі таймери зворотного відліку
            this.clearAllCountdowns();

            // Якщо немає розіграшів
            if (!Array.isArray(raffles) || raffles.length === 0) {
                console.log('👉 Немає розіграшів для відображення');
                this.renderEmptyActiveRaffles();
                return;
            }

            // Розділяємо на головний та міні-розіграші
            const mainRaffles = raffles.filter(raffle => !raffle.is_daily);
            const miniRaffles = raffles.filter(raffle => raffle.is_daily);

            // Відображаємо головний розіграш
            this.renderMainRaffle(mainRaffles.length > 0 ? mainRaffles[0] : null);

            // Відображаємо міні-розіграші
            this.renderMiniRaffles(miniRaffles);

            // Оновлюємо кнопки участі
            if (WinixRaffles.participation) {
                WinixRaffles.participation.updateParticipationButtons();
            }
        },

        // Відображення головного розіграшу
        renderMainRaffle: function(raffle) {
            const mainRaffleContainer = document.querySelector('.main-raffle');
            if (!mainRaffleContainer) {
                console.error('❌ Контейнер головного розіграшу не знайдено');
                return;
            }

            // Якщо немає головного розіграшу
            if (!raffle) {
                mainRaffleContainer.innerHTML = `
                    <div class="main-raffle-content">
                        <h3 class="main-raffle-title">На даний момент немає активних головних розіграшів</h3>
                        <div class="main-raffle-prize">Незабаром буде опубліковано новий розіграш</div>
                    </div>
                `;
                return;
            }

            // Встановлюємо атрибут ID для подальшого використання
            if (raffle.id) {
                mainRaffleContainer.setAttribute('data-raffle-id', raffle.id);
            }

            // Розрахунок прогресу заповнення (максимум 100%)
            const progress = Math.min(Math.round((raffle.participants_count / 1000) * 100), 100);

            // Форматуємо дані за допомогою форматерів (якщо вони є)
            let imageUrl = raffle.image_url || 'assets/prize-poster.gif';
            let endTimeText = '';

            if (WinixRaffles.formatters) {
                endTimeText = WinixRaffles.formatters.formatEndTime(raffle.end_time);
            } else {
                // Запасний варіант, якщо форматери не доступні
                const endDate = new Date(raffle.end_time);
                endTimeText = `${endDate.getDate()}.${endDate.getMonth() + 1}.${endDate.getFullYear()} ${endDate.getHours()}:${endDate.getMinutes()}`;
            }

            mainRaffleContainer.innerHTML = `
                <img src="${imageUrl}" alt="${raffle.title}" class="main-raffle-image">
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

                    <div class="raffle-actions">
                        <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main" data-entry-fee="${raffle.entry_fee}">
                            Взяти участь за ${raffle.entry_fee} жетон${parseInt(raffle.entry_fee) > 1 ? 'и' : ''}
                        </button>
                        <button class="raffle-details-button" data-raffle-id="${raffle.id}">
                            Деталі
                        </button>
                    </div>
                </div>
            `;

            // Додаємо стилі для кнопки деталей, якщо їх ще немає
            this.addDetailButtonStyles();

            // Запускаємо таймер зворотного відліку
            this.startCountdown(raffle.id, new Date(raffle.end_time));
        },

        // Відображення міні-розіграшів
        renderMiniRaffles: function(raffles) {
            const miniRafflesContainer = document.querySelector('.mini-raffles-container');
            if (!miniRafflesContainer) {
                console.error('❌ Контейнер міні-розіграшів не знайдено');
                return;
            }

            // Якщо немає міні-розіграшів
            if (!Array.isArray(raffles) || raffles.length === 0) {
                miniRafflesContainer.innerHTML = `
                    <div class="mini-raffle">
                        <div class="mini-raffle-info">
                            <h3 class="mini-raffle-title">Щоденні розіграші</h3>
                            <div class="mini-raffle-prize">На даний момент немає активних щоденних розіграшів</div>
                            <div class="mini-raffle-time">Перевірте пізніше</div>
                        </div>
                    </div>
                `;
                return;
            }

            // Очищаємо контейнер
            miniRafflesContainer.innerHTML = '';

            // Додаємо міні-розіграші
            raffles.forEach(raffle => {
                miniRafflesContainer.appendChild(this.createMiniRaffleElement(raffle));
            });
        },

        // Створення елемента міні-розіграшу
        createMiniRaffleElement: function(raffle) {
            const miniRaffle = document.createElement('div');
            miniRaffle.className = 'mini-raffle';
            miniRaffle.setAttribute('data-raffle-id', raffle.id);

            // Форматуємо дані за допомогою форматерів (якщо вони є)
            let endTimeText = '';

            if (WinixRaffles.formatters) {
                endTimeText = WinixRaffles.formatters.formatEndTime(raffle.end_time);
            } else {
                // Запасний варіант, якщо форматери не доступні
                const endDate = new Date(raffle.end_time);
                const now = new Date();
                const isToday = endDate.getDate() === now.getDate() &&
                                endDate.getMonth() === now.getMonth() &&
                                endDate.getFullYear() === now.getFullYear();

                endTimeText = isToday
                    ? `сьогодні о ${endDate.getHours()}:${endDate.getMinutes().toString().padStart(2, '0')}`
                    : `${endDate.getDate()}.${endDate.getMonth() + 1}.${endDate.getFullYear()} о ${endDate.getHours()}:${endDate.getMinutes().toString().padStart(2, '0')}`;
            }

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
                <div class="mini-raffle-actions">
                    <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-raffle-type="daily" data-entry-fee="${raffle.entry_fee}">Взяти участь</button>
                    <button class="raffle-details-button mini" data-raffle-id="${raffle.id}">Деталі</button>
                </div>
            `;

            return miniRaffle;
        },

        /**
         * Додавання стилів для кнопки деталей
         */
        addDetailButtonStyles: function() {
            // Перевіряємо чи стилі вже додані
            if (document.getElementById('raffle-details-button-styles')) {
                return;
            }

            // Створюємо стилі
            const style = document.createElement('style');
            style.id = 'raffle-details-button-styles';
            style.textContent = `
                .raffle-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                }
                
                .join-button {
                    flex: 3;
                    background: linear-gradient(90deg, #4CAF50, #009688);
                    border: none;
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                    border-radius: 25px;
                    padding: 12px 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }
                
                .join-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
                }
                
                .join-button:active {
                    transform: translateY(1px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .raffle-details-button {
                    flex: 1;
                    background: linear-gradient(90deg, #4eb5f7, #3967c0);
                    border: none;
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                    border-radius: 25px;
                    padding: 10px 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    min-width: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    box-shadow: 0 4px 8px rgba(57, 103, 192, 0.3);
                }
                
                .raffle-details-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(57, 103, 192, 0.4);
                    background: linear-gradient(90deg, #5990f5, #4272d4);
                }
                
                .raffle-details-button:active {
                    transform: translateY(1px);
                    box-shadow: 0 2px 5px rgba(57, 103, 192, 0.3);
                }
                
                .raffle-details-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, 
                        rgba(255,255,255,0), 
                        rgba(255,255,255,0.3), 
                        rgba(255,255,255,0));
                    transition: all 0.6s ease;
                }
                
                .raffle-details-button:hover::before {
                    left: 100%;
                }
                
                .raffle-details-button svg,
                .raffle-details-button img {
                    width: 16px;
                    height: 16px;
                    opacity: 0.9;
                }
                
                .mini-raffle-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-left: 10px;
                }
                
                .mini-raffle-button {
                    background: linear-gradient(90deg, #4CAF50, #009688);
                    border: none;
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                    border-radius: 20px;
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .mini-raffle-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
                }
                
                .mini-raffle-button:active {
                    transform: translateY(1px);
                    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.2);
                }
                
                .raffle-details-button.mini {
                    font-size: 13px;
                    padding: 8px 12px;
                    background: linear-gradient(90deg, #4eb5f7, #3967c0);
                }
                
                /* Стан кнопки під час обробки запиту */
                .join-button.processing,
                .mini-raffle-button.processing {
                    opacity: 0.7;
                    pointer-events: none;
                    background: linear-gradient(90deg, #9e9e9e, #616161);
                }
                
                /* Стан кнопки для учасників */
                .join-button.participating,
                .mini-raffle-button.participating {
                    background: linear-gradient(90deg, #2196F3, #0D47A1);
                }
                
                /* Стан для вимкненої кнопки */
                .join-button:disabled,
                .mini-raffle-button:disabled,
                .raffle-details-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none !important;
                    box-shadow: none !important;
                }
                
                @media (max-width: 480px) {
                    .raffle-actions {
                        flex-direction: column;
                    }
                    
                    .mini-raffle-actions {
                        flex-direction: column;
                    }
                    
                    .raffle-details-button,
                    .join-button {
                        width: 100%;
                        padding: 10px;
                    }
                }
            `;

            // Додаємо стилі на сторінку
            document.head.appendChild(style);
        },

        // Відображення порожнього стану активних розіграшів
        renderEmptyActiveRaffles: function() {
            // Відображення порожнього головного розіграшу
            const mainRaffleContainer = document.querySelector('.main-raffle');
            if (mainRaffleContainer) {
                mainRaffleContainer.innerHTML = `
                    <div class="main-raffle-content">
                        <h3 class="main-raffle-title">На даний момент немає активних розіграшів</h3>
                        <div class="main-raffle-prize">Перевірте пізніше або оновіть сторінку</div>
                    </div>
                `;
            }

            // Відображення порожніх міні-розіграшів
            const miniRafflesContainer = document.querySelector('.mini-raffles-container');
            if (miniRafflesContainer) {
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
        },

        // Запуск таймера зворотного відліку
        startCountdown: function(raffleId, endTime) {
            // Очищаємо попередній таймер, якщо він є
            this.clearCountdown(raffleId);

            const updateTimer = () => {
                const now = new Date().getTime();
                const timeLeft = endTime.getTime() - now;

                // Якщо час вийшов, оновлюємо список розіграшів
                if (timeLeft <= 0) {
                    this.clearCountdown(raffleId);

                    // Оновлюємо елементи таймера
                    const days = document.getElementById(`days-${raffleId}`);
                    const hours = document.getElementById(`hours-${raffleId}`);
                    const minutes = document.getElementById(`minutes-${raffleId}`);
                    const seconds = document.getElementById(`seconds-${raffleId}`);

                    if (days) days.textContent = '00';
                    if (hours) hours.textContent = '00';
                    if (minutes) minutes.textContent = '00';
                    if (seconds) seconds.textContent = '00';

                    // Додаємо розіграш до невалідних
                    if (WinixRaffles.participation && typeof WinixRaffles.participation.addInvalidRaffleId === 'function') {
                        WinixRaffles.participation.addInvalidRaffleId(raffleId);
                    }

                    // Оновлюємо кнопки участі
                    if (WinixRaffles.participation && typeof WinixRaffles.participation.updateParticipationButtons === 'function') {
                        WinixRaffles.participation.updateParticipationButtons();
                    }

                    // Оновлюємо список розіграшів через 2 секунди
                    setTimeout(() => this.loadActiveRaffles(), 2000);
                    return;
                }

                // Використовуємо форматери, якщо вони є
                if (WinixRaffles.formatters) {
                    const timeObj = WinixRaffles.formatters.formatTimeLeft(timeLeft);
                    WinixRaffles.formatters.updateTimerElements(raffleId, timeObj);
                } else {
                    // Запасний варіант, якщо форматери не доступні
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                    // Оновлення елементів таймера
                    const daysEl = document.getElementById(`days-${raffleId}`);
                    const hoursEl = document.getElementById(`hours-${raffleId}`);
                    const minutesEl = document.getElementById(`minutes-${raffleId}`);
                    const secondsEl = document.getElementById(`seconds-${raffleId}`);

                    if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
                    if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
                    if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
                    if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
                }
            };

            // Запускаємо перше оновлення таймера
            updateTimer();

            // Запускаємо інтервал оновлення таймера (щосекунди)
            this.countdownTimers[raffleId] = setInterval(updateTimer, 1000);
        },

        // Очищення таймера зворотного відліку
        clearCountdown: function(raffleId) {
            if (this.countdownTimers[raffleId]) {
                clearInterval(this.countdownTimers[raffleId]);
                delete this.countdownTimers[raffleId];
            }
        },

        // Очищення всіх таймерів зворотного відліку
        clearAllCountdowns: function() {
            Object.keys(this.countdownTimers).forEach(raffleId => {
                clearInterval(this.countdownTimers[raffleId]);
                delete this.countdownTimers[raffleId];
            });
        },

        // Запасний варіант для участі в розіграші
        fallbackParticipate: async function(raffleId, raffleType) {
            const userId = WinixRaffles.state.telegramId || WinixAPI.getUserId();

            if (!userId) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Не вдалося визначити ваш ID', 'error');
                }
                return {
                    success: false,
                    message: 'Не вдалося визначити ваш ID'
                };
            }

            try {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: 1
                });

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                if (response.status === 'success') {
                    // Оновлюємо кнопку
                    const button = document.querySelector(`[data-raffle-id="${raffleId}"]`);
                    if (button) {
                        button.textContent = 'Ви вже берете участь';
                        button.classList.add('participating');
                        button.disabled = false;
                    }

                    // Показуємо повідомлення про успіх
                    if (typeof window.showToast === 'function') {
                        window.showToast('Ви успішно взяли участь у розіграші', 'success');
                    }

                    // Оновлюємо баланс користувача
                    if (response.data && response.data.new_coins_balance !== undefined) {
                        document.dispatchEvent(new CustomEvent('user-data-updated', {
                            detail: {
                                userData: {
                                    coins: response.data.new_coins_balance,
                                    server_synchronized: true
                                },
                                source: 'active.js'
                            }
                        }));

                        // Оновлюємо відображення жетонів
                        const userCoinsElement = document.getElementById('user-coins');
                        if (userCoinsElement) {
                            userCoinsElement.textContent = response.data.new_coins_balance;
                        }

                        // Оновлюємо локальне сховище
                        localStorage.setItem('userCoins', response.data.new_coins_balance.toString());
                        localStorage.setItem('winix_coins', response.data.new_coins_balance.toString());
                    } else {
                        // Якщо сервер не повернув баланс, примусово оновлюємо
                        this.refreshUserBalance();
                    }

                    return {
                        success: true,
                        data: response.data,
                        message: 'Ви успішно взяли участь у розіграші'
                    };
                } else {
                    if (typeof window.showToast === 'function') {
                        window.showToast(response.message || 'Помилка участі в розіграші', 'error');
                    }

                    return {
                        success: false,
                        message: response.message || 'Помилка участі в розіграші'
                    };
                }
            } catch (error) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                console.error('❌ Помилка участі в розіграші:', error);

                if (typeof window.showToast === 'function') {
                    window.showToast(error.message || 'Помилка при спробі участі в розіграші', 'error');
                }

                return {
                    success: false,
                    message: error.message || 'Помилка при спробі участі в розіграші'
                };
            }
        },

        // Показ деталей розіграшу
        showRaffleDetails: function(raffleId) {
            // Пошук розіграшу в наших даних
            const raffle = this.raffles.find(r => r.id === raffleId);

            if (!raffle) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Не вдалося знайти деталі розіграшу', 'error');
                }
                return;
            }

            // Визначення статусу участі (якщо доступно)
            let isParticipating = false;
            let ticketCount = 0;

            if (WinixRaffles.participation) {
                // Перевіряємо участь
                if (WinixRaffles.participation.participatingRaffles) {
                    isParticipating = WinixRaffles.participation.participatingRaffles.has(raffleId);
                }

                // Отримуємо кількість білетів
                if (WinixRaffles.participation.userRaffleTickets) {
                    ticketCount = WinixRaffles.participation.userRaffleTickets[raffleId] || 0;
                }
            }

            // Використовуємо глобальну функцію
            if (typeof window.showRaffleDetailsModal === 'function') {
                window.showRaffleDetailsModal(raffle, isParticipating, ticketCount);
            } else {
                // Якщо глобальної функції немає, показуємо просте модальне вікно
                this.showBasicRaffleDetails(raffle, isParticipating, ticketCount);
            }
        },

        // Просте модальне вікно з деталями розіграшу (запасний варіант)
        showBasicRaffleDetails: function(raffle, isParticipating, ticketCount) {
            // Якщо модального вікна немає, показуємо звичайне повідомлення
            const messageText = `
                Розіграш: ${raffle.title}
                Призовий фонд: ${raffle.prize_amount} ${raffle.prize_currency}
                Переможців: ${raffle.winners_count}
                Учасників: ${raffle.participants_count}
                ${isParticipating ? `Ваша участь: ${ticketCount} білет(ів)` : 'Ви ще не берете участь'}
            `;

            if (typeof window.alert === 'function') {
                window.alert(messageText);
            } else {
                console.log('Деталі розіграшу:', messageText);
            }
        },

        // Функція для визначення валідності UUID
        isValidUUID: function(id) {
            // Спочатку перевіряємо наявність UUID валідатора у WinixRaffles
            if (WinixRaffles.validators && typeof WinixRaffles.validators.isValidUUID === 'function') {
                return WinixRaffles.validators.isValidUUID(id);
            }

            // Потім перевіряємо валідатор у WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.isValidUUID === 'function') {
                return window.WinixAPI.isValidUUID(id);
            }

            // Запасний валідатор, якщо інші недоступні
            if (!id || typeof id !== 'string') return false;
            const fullUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return fullUUIDRegex.test(id);
        },

        // Оновлення активних розіграшів
        refreshActiveRaffles: function() {
            this.loadActiveRaffles(true);
        }
    };

    // Додаємо модуль активних розіграшів до головного модуля розіграшів
    window.WinixRaffles.active = active;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (WinixRaffles.state.isInitialized) {
            active.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                active.init();
            });
        }
    });
})();