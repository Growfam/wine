/**
 * WINIX - Система розіграшів (active.js)
 * Оновлений модуль для роботи з активними розіграшами
 * Додано функціонал деталей розіграшів
 * @version 1.3.0
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
                    if (raffleId) {
                        e.preventDefault();
                        // Перевіряємо чи модуль участі ініціалізовано
                        if (WinixRaffles.participation) {
                            WinixRaffles.participation.participateInRaffle(raffleId, 'main');
                        } else {
                            // Запасний варіант, якщо модуль участі не доступний
                            this.fallbackParticipate(raffleId, 'main');
                        }
                    }
                }

                // Обробка кнопок участі у міні-розіграші
                if (e.target.classList.contains('mini-raffle-button')) {
                    const raffleId = e.target.getAttribute('data-raffle-id');
                    if (raffleId) {
                        e.preventDefault();
                        // Перевіряємо чи модуль участі ініціалізовано
                        if (WinixRaffles.participation) {
                            WinixRaffles.participation.participateInRaffle(raffleId, 'daily');
                        } else {
                            // Запасний варіант, якщо модуль участі не доступний
                            this.fallbackParticipate(raffleId, 'daily');
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
                        <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">
                            Взяти участь за ${raffle.entry_fee} жетони
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
                    <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-raffle-type="daily">Взяти участь</button>
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
                window.showToast('Не вдалося визначити ваш ID', 'error');
                return;
            }

            try {
                window.showLoading();

                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: 1
                });

                window.hideLoading();

                if (response.status === 'success') {
                    // Оновлюємо кнопку
                    const button = document.querySelector(`[data-raffle-id="${raffleId}"]`);
                    if (button) {
                        button.textContent = 'Ви вже берете участь';
                        button.classList.add('participating');
                        button.disabled = true;
                    }

                    // Показуємо повідомлення про успіх
                    window.showToast('Ви успішно взяли участь у розіграші', 'success');

                    // Оновлюємо баланс користувача
                    if (response.data && response.data.new_coins_balance !== undefined) {
                        document.dispatchEvent(new CustomEvent('user-data-updated', {
                            detail: { coins: response.data.new_coins_balance }
                        }));
                    }
                } else {
                    window.showToast(response.message || 'Помилка участі в розіграші', 'error');
                }
            } catch (error) {
                window.hideLoading();
                console.error('❌ Помилка участі в розіграші:', error);
                window.showToast('Помилка при спробі участі в розіграші', 'error');
            }
        },

        // Показ деталей розіграшу
        showRaffleDetails: function(raffleId) {
            // Пошук розіграшу в наших даних
            const raffle = this.raffles.find(r => r.id === raffleId);

            if (!raffle) {
                window.showToast('Не вдалося знайти деталі розіграшу', 'error');
                return;
            }

            // Визначення статусу участі (якщо доступно)
            const isParticipating = WinixRaffles.participation &&
                WinixRaffles.participation.participatingRaffles &&
                WinixRaffles.participation.participatingRaffles.has(raffleId);

            // Кількість білетів (якщо доступно)
            const ticketCount = WinixRaffles.participation &&
                WinixRaffles.participation.userRaffleTickets ?
                (WinixRaffles.participation.userRaffleTickets[raffleId] || 0) : 0;

            // Використовуємо глобальну функцію
            window.showRaffleDetailsModal(raffle, isParticipating, ticketCount);
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