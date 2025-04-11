/**
 * Модуль для роботи з активними розіграшами WINIX
 */

(function() {
    'use strict';

    console.log("🎮 WINIX Raffles: Ініціалізація модуля активних розіграшів");

    // Приватні змінні
    let _activeRaffles = null;
    let _isLoading = false;
    let _lastRafflesUpdateTime = 0;
    const RAFFLES_CACHE_TTL = 60000; // 1 хвилина
    let _loadingTimeoutId = null;

    // Модуль активних розіграшів
    const activeRafflesModule = {
        // Ініціалізація модуля
        init: function() {
            console.log("🎮 Активні розіграші: Ініціалізація...");

            // Обробники подій для перемикання вкладок
            const tabButtons = document.querySelectorAll('.tab-button');
            if (tabButtons.length > 0) {
                console.log(`Знайдено ${tabButtons.length} кнопок вкладок`);
                tabButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const tabName = this.getAttribute('data-tab');
                        activeRafflesModule.switchTab(tabName);
                    });
                });
            }

            // Отримуємо дані активних розіграшів
            this.getActiveRaffles().then(() => {
                // Відображаємо активні розіграші
                this.displayRaffles();
            }).catch(error => {
                console.error("Помилка при отриманні активних розіграшів:", error);
                // Скидаємо всі стани у випадку помилки
                this.resetAllStates();
            });

            // Налаштовуємо кнопки участі для розіграшів
            this._setupRaffleButtons();

            console.log("✅ Активні розіграші: Ініціалізацію завершено");
        },

        // Отримання активних розіграшів з API
        getActiveRaffles: async function(forceRefresh = false) {
            try {
                // Перевіряємо кеш
                const now = Date.now();
                if (!forceRefresh && _activeRaffles && (now - _lastRafflesUpdateTime < RAFFLES_CACHE_TTL)) {
                    console.log("📋 Raffles: Використання кешованих даних активних розіграшів");
                    return _activeRaffles;
                }

                // Автоматичне скидання зависаючих запитів
                if (_isLoading && (now - _lastRafflesUpdateTime > 30000)) {
                    console.warn("⚠️ Raffles: Виявлено зависаючий запит розіграшів, скидаємо стан");
                    _isLoading = false;
                    if (_loadingTimeoutId) {
                        clearTimeout(_loadingTimeoutId);
                        _loadingTimeoutId = null;
                    }
                }

                if (_isLoading) {
                    console.log("⏳ Raffles: Завантаження розіграшів вже виконується");
                    return _activeRaffles || [];
                }

                _isLoading = true;
                _lastRafflesUpdateTime = now;

                // Встановлюємо таймаут для автоматичного скидання
                if (_loadingTimeoutId) {
                    clearTimeout(_loadingTimeoutId);
                }
                _loadingTimeoutId = setTimeout(() => {
                    if (_isLoading) {
                        console.warn("⚠️ Raffles: Завантаження розіграшів триває занадто довго, скидаємо стан");
                        _isLoading = false;
                    }
                }, 30000); // 30 секунд

                window.WinixRaffles.utils.showLoading('Завантаження розіграшів...');

                // Виконуємо запит до API
                const response = await window.WinixAPI.apiRequest('/api/raffles', 'GET', null, {
                    timeout: 15000,
                    suppressErrors: true,
                    forceCleanup: forceRefresh
                });

                // ЗАВЖДИ приховуємо лоадер і скидаємо прапорець
                window.WinixRaffles.utils.hideLoading();
                _isLoading = false;

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
                    this._updateStatistics();

                    return _activeRaffles;
                } else {
                    // Краща обробка помилок
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
                window.WinixRaffles.utils.hideLoading();
                _isLoading = false;

                if (_loadingTimeoutId) {
                    clearTimeout(_loadingTimeoutId);
                    _loadingTimeoutId = null;
                }

                // Показуємо повідомлення про помилку
                window.WinixRaffles.utils.showToast('Не вдалося завантажити розіграші. Спробуйте пізніше.');

                // Повертаємо кешовані дані у випадку помилки
                return _activeRaffles || [];
            }
        },

        // Відображення активних розіграшів
        displayRaffles: async function() {
            console.log("🎮 Raffles: Відображення активних розіграшів");

            // Отримуємо контейнери для розіграшів
            const mainRaffleContainer = document.querySelector('.main-raffle');
            const miniRafflesContainer = document.querySelector('.mini-raffles-container');

            if (!mainRaffleContainer && !miniRafflesContainer) {
                console.error("❌ Raffles: Не знайдено контейнери для розіграшів");
                return;
            }

            // Показуємо індикатор завантаження
            window.WinixRaffles.utils.showLoading('Завантаження розіграшів...');

            try {
                // Отримуємо активні розіграші
                const raffles = await this.getActiveRaffles(true);

                // Приховуємо індикатор завантаження
                window.WinixRaffles.utils.hideLoading();

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
                    window.WinixRaffles.components.displayMainRaffle(mainRaffleContainer, mainRaffles[0]);
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
                            const miniRaffleElement = window.WinixRaffles.components.createMiniRaffleElement(raffle);
                            miniRafflesContainer.appendChild(miniRaffleElement);
                        });
                    } else {
                        // Додаємо елемент для бонусу новачка, якщо міні-розіграшів немає
                        window.WinixRaffles.components.addNewbieBonusElement(miniRafflesContainer);
                    }
                }

                // Активуємо таймери
                this._startRaffleTimers();

                // Оновлюємо статистику
                this._updateStatistics();
            } catch (error) {
                console.error("Помилка при завантаженні активних розіграшів:", error);
                window.WinixRaffles.utils.hideLoading();

                // Показуємо повідомлення про помилку
                window.WinixRaffles.utils.showToast('Не вдалося завантажити розіграші. Спробуйте пізніше.');

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
        },

        // Функція переключення вкладок
        switchTab: function(tabName) {
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
                window.WinixRaffles.history.displayHistory('history-container');
            } else if (tabName === 'active') {
                // Оновлюємо активні розіграші
                this.displayRaffles();
            }
        },

        // Відкриття модального вікна з деталями розіграшу
        openRaffleDetails: function(raffleId, raffleType) {
            window.WinixRaffles.participation.openRaffleDetails(raffleId, raffleType);
        },

        // Запуск таймерів для розіграшів
        _startRaffleTimers: function() {
            // Очищаємо існуючі таймери
            if (window._raffleTimerIntervals) {
                window._raffleTimerIntervals.forEach(interval => clearInterval(interval));
                window._raffleTimerIntervals = [];
            }

            // Запускаємо оновлення таймерів кожну хвилину
            const interval = setInterval(this._updateRaffleTimers.bind(this), 60000);
            window._raffleTimerIntervals = [interval];

            // Відразу запускаємо оновлення
            this._updateRaffleTimers();
        },

        // Оновлення таймерів для розіграшів
        _updateRaffleTimers: function() {
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

                            daysElement.textContent = window.WinixRaffles.utils.padZero(days);
                            hoursElement.textContent = window.WinixRaffles.utils.padZero(hours);
                            minutesElement.textContent = window.WinixRaffles.utils.padZero(minutes);
                        } else {
                            daysElement.textContent = '00';
                            hoursElement.textContent = '00';
                            minutesElement.textContent = '00';

                            // Розіграш завершено, оновлюємо дані
                            this.getActiveRaffles(true).then(() => {
                                this.displayRaffles();
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
                                this.getActiveRaffles(true).then(() => {
                                    this.displayRaffles();
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
        },

        // Оновлення статистики розіграшів
        _updateStatistics: function() {
            // Перевіряємо наявність статистики
            const statsGrid = document.querySelector('.stats-grid');
            if (!statsGrid) return;

            // Використовуємо модуль статистики
            if (window.WinixRaffles.stats && typeof window.WinixRaffles.stats.updateStatistics === 'function') {
                window.WinixRaffles.stats.updateStatistics();
            }
        },

        // Налаштування кнопок участі у розіграшах
        _setupRaffleButtons: function() {
            // Налаштовуємо кнопки участі для основного розіграшу
            const mainJoinBtn = document.getElementById('main-join-btn');
            if (mainJoinBtn) {
                mainJoinBtn.addEventListener('click', function() {
                    const raffleId = this.getAttribute('data-raffle-id');
                    const raffleType = this.getAttribute('data-raffle-type');
                    const inputId = 'main-token-amount';

                    window.WinixRaffles.participation.participateInRaffleUI(raffleId, raffleType, inputId);
                });
            }

            // Налаштовуємо кнопки участі для щоденного розіграшу
            const dailyJoinBtn = document.getElementById('daily-join-btn');
            if (dailyJoinBtn) {
                dailyJoinBtn.addEventListener('click', function() {
                    const raffleId = this.getAttribute('data-raffle-id');
                    const raffleType = this.getAttribute('data-raffle-type');
                    const inputId = 'daily-token-amount';

                    window.WinixRaffles.participation.participateInRaffleUI(raffleId, raffleType, inputId);
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
        },

        // Очищення всіх станів модуля
        resetAllStates: function() {
            // Скидаємо прапорці
            _isLoading = false;

            // Очищаємо таймаути
            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
                _loadingTimeoutId = null;
            }

            // Приховуємо лоадери
            window.WinixRaffles.utils.hideLoading();

            // Очищаємо активні запити через API
            if (window.WinixAPI && typeof window.WinixAPI.forceCleanupRequests === 'function') {
                window.WinixAPI.forceCleanupRequests();
            }

            console.log("🔄 Raffles: Примусове скидання всіх станів");
            return true;
        }
    };

    // Експортуємо модуль
    window.WinixRaffles.active = activeRafflesModule;
})();