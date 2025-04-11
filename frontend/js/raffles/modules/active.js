/**
 * active.js - Модуль для роботи з активними розіграшами WINIX
 */

import WinixRaffles from '../globals.js';
import api from '../services/api.js';
import { showLoading, hideLoading, showToast } from '../utils/ui-helpers.js';
import { padZero } from '../utils/formatters.js';

// Приватні змінні
let _activeRaffles = null;
let _isLoading = false;
let _lastRafflesUpdateTime = 0;
const RAFFLES_CACHE_TTL = 60000; // 1 хвилина
let _loadingTimeoutId = null;

/**
 * Модуль активних розіграшів
 */
class ActiveRaffles {
    /**
     * Ініціалізація модуля
     */
    init() {
        console.log("🎮 Активні розіграші: Ініціалізація...");

        // Обробники подій для перемикання вкладок
        const tabButtons = document.querySelectorAll('.tab-button');
        if (tabButtons.length > 0) {
            console.log(`Знайдено ${tabButtons.length} кнопок вкладок`);
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    this.switchTab(tabName);
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
    }

    /**
     * Отримання активних розіграшів з API
     * @param {boolean} forceRefresh - Примусове оновлення даних
     * @returns {Promise<Array>} Список активних розіграшів
     */
    async getActiveRaffles(forceRefresh = false) {
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

            showLoading('Завантаження розіграшів...');

            // Виконуємо запит до API
            const response = await api.apiRequest('/api/raffles', 'GET', null, {
                timeout: 15000,
                suppressErrors: true,
                forceCleanup: forceRefresh
            });

            // ЗАВЖДИ приховуємо лоадер і скидаємо прапорець
            hideLoading();
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
            hideLoading();
            _isLoading = false;

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
     * Відображення активних розіграшів
     */
    async displayRaffles() {
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
            const raffles = await this.getActiveRaffles(true);

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
                this._displayMainRaffle(mainRaffleContainer, mainRaffles[0]);
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
                        const miniRaffleElement = this._createMiniRaffleElement(raffle);
                        miniRafflesContainer.appendChild(miniRaffleElement);
                    });
                } else {
                    // Додаємо елемент для бонусу новачка, якщо міні-розіграшів немає
                    this._addNewbieBonusElement(miniRafflesContainer);
                }
            }

            // Активуємо таймери
            this._startRaffleTimers();

            // Оновлюємо статистику
            this._updateStatistics();
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
     * Функція переключення вкладок
     * @param {string} tabName - Назва вкладки для активації
     */
    switchTab(tabName) {
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
            if (WinixRaffles.history && typeof WinixRaffles.history.displayHistory === 'function') {
                WinixRaffles.history.displayHistory('history-container');
            }
        } else if (tabName === 'active') {
            // Оновлюємо активні розіграші
            this.displayRaffles();
        }
    }

    /**
     * Відкриття модального вікна з деталями розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу
     */
    openRaffleDetails(raffleId, raffleType) {
        if (WinixRaffles.participation && typeof WinixRaffles.participation.openRaffleDetails === 'function') {
            WinixRaffles.participation.openRaffleDetails(raffleId, raffleType);
        }
    }

    /**
     * Очищення всіх станів модуля
     */
    resetAllStates() {
        // Скидаємо прапорці
        _isLoading = false;

        // Очищаємо таймаути
        if (_loadingTimeoutId) {
            clearTimeout(_loadingTimeoutId);
            _loadingTimeoutId = null;
        }

        // Приховуємо лоадери
        hideLoading();

        // Очищаємо активні запити через API
        api.forceCleanupRequests();

        console.log("🔄 Raffles: Примусове скидання всіх станів");
        return true;
    }

    /**
     * Відображення основного розіграшу
     * @param {HTMLElement} container - Контейнер для відображення
     * @param {Object} raffle - Дані розіграшу
     * @private
     */
    _displayMainRaffle(container, raffle) {
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
                        ${this._generatePrizeDistributionHTML(raffle.prize_distribution)}
                    </div>
                </div>

                <div class="main-raffle-participants">
                    <div class="participants-info">Учасників: <span class="participants-count">${raffle.participants_count || 0}</span></div>
                    <div class="share-container">
                        <button class="share-button" id="share-raffle-btn" data-raffle-id="${raffle.id}">Поділитися</button>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress" style="width: ${this._calculateProgressWidth(raffle)}%"></div>
                </div>

                <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">Взяти участь</button>
            </div>
        `;

        // Оновлюємо таймер
        this._updateRaffleTimers();

        // Додаємо обробники подій
        const joinButton = container.querySelector('.join-button');
        if (joinButton) {
            joinButton.addEventListener('click', () => {
                const raffleId = joinButton.getAttribute('data-raffle-id');
                const raffleType = joinButton.getAttribute('data-raffle-type');
                this.openRaffleDetails(raffleId, raffleType);
            });
        }

        // Додаємо обробник для кнопки "Поділитися"
        const shareButton = container.querySelector('#share-raffle-btn');
        if (shareButton) {
            shareButton.addEventListener('click', () => {
                const raffleId = shareButton.getAttribute('data-raffle-id');
                if (WinixRaffles.participation && typeof WinixRaffles.participation.shareRaffle === 'function') {
                    WinixRaffles.participation.shareRaffle(raffleId);
                }
            });
        }
    }

    /**
     * Створення елементу міні-розіграшу
     * @param {Object} raffle - Дані розіграшу
     * @returns {HTMLElement} Елемент міні-розіграшу
     * @private
     */
    _createMiniRaffleElement(raffle) {
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
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                const raffleId = button.getAttribute('data-raffle-id');
                const raffleType = button.getAttribute('data-raffle-type');
                this.openRaffleDetails(raffleId, raffleType);
            });
        }

        return miniRaffle;
    }

    /**
     * Додавання елементу бонусу новачка
     * @param {HTMLElement} container - Контейнер для додавання
     * @private
     */
    _addNewbieBonusElement(container) {
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
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (WinixRaffles.participation && typeof WinixRaffles.participation.claimNewbieBonus === 'function') {
                    const result = await WinixRaffles.participation.claimNewbieBonus();

                    if (result.status === 'success') {
                        showToast(`Ви отримали ${result.data.amount} WINIX як бонус новачка!`);

                        // Деактивуємо кнопку
                        button.textContent = 'Отримано';
                        button.disabled = true;
                        button.style.opacity = '0.6';
                        button.style.cursor = 'default';

                        // Додаємо водяний знак
                        WinixRaffles.utils.markElement(newbieBonus);

                        // Оновлюємо баланс
                        WinixRaffles.participation.updateUserBalance();
                    } else if (result.status === 'already_claimed') {
                        showToast('Ви вже отримали бонус новачка');

                        // Деактивуємо кнопку
                        button.textContent = 'Отримано';
                        button.disabled = true;
                        button.style.opacity = '0.6';
                        button.style.cursor = 'default';

                        // Додаємо водяний знак
                        WinixRaffles.utils.markElement(newbieBonus);
                    } else {
                        showToast(result.message || 'Помилка отримання бонусу');
                    }
                }
            });
        }

        container.appendChild(newbieBonus);

        // Перевіряємо, чи вже отримано бонус
        api.getUserData().then(userData => {
            if (userData && userData.data && userData.data.newbie_bonus_claimed) {
                // Деактивуємо кнопку
                if (button) {
                    button.textContent = 'Отримано';
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'default';
                }

                // Додаємо водяний знак
                WinixRaffles.utils.markElement(newbieBonus);
            }
        }).catch(err => {
            console.error("Помилка перевірки статусу бонусу:", err);
        });
    }

    /**
     * Запуск таймерів для розіграшів
     * @private
     */
    _startRaffleTimers() {
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
    }

    /**
     * Оновлення таймерів для розіграшів
     * @private
     */
    _updateRaffleTimers() {
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
    }

    /**
     * Оновлення статистики розіграшів
     * @private
     */
    _updateStatistics() {
        // Перевіряємо наявність статистики
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;

        // Використовуємо модуль статистики
        if (WinixRaffles.stats && typeof WinixRaffles.stats.updateStatistics === 'function') {
            WinixRaffles.stats.updateStatistics();
        }
    }

    /**
     * Налаштування кнопок участі у розіграшах
     * @private
     */
    _setupRaffleButtons() {
        // Налаштовуємо кнопки участі для основного розіграшу
        const mainJoinBtn = document.getElementById('main-join-btn');
        if (mainJoinBtn) {
            mainJoinBtn.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                const inputId = 'main-token-amount';

                if (WinixRaffles.participation && typeof WinixRaffles.participation.participateInRaffleUI === 'function') {
                    WinixRaffles.participation.participateInRaffleUI(raffleId, raffleType, inputId);
                }
            });
        }

        // Налаштовуємо кнопки участі для щоденного розіграшу
        const dailyJoinBtn = document.getElementById('daily-join-btn');
        if (dailyJoinBtn) {
            dailyJoinBtn.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                const inputId = 'daily-token-amount';

                if (WinixRaffles.participation && typeof WinixRaffles.participation.participateInRaffleUI === 'function') {
                    WinixRaffles.participation.participateInRaffleUI(raffleId, raffleType, inputId);
                }
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
     * Генерація HTML для розподілу призів
     * @param {Object} prizeDistribution - Об'єкт з розподілом призів
     * @returns {string} - HTML-розмітка
     * @private
     */
    _generatePrizeDistributionHTML(prizeDistribution) {
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
            const placesText = this._formatPlaces(group.places);

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
     * @param {Array<number>} places - Список місць
     * @returns {string} - Відформатований текст місць
     * @private
     */
    _formatPlaces(places) {
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
     * @param {Object} raffle - Дані розіграшу
     * @returns {number} - Ширина прогрес-бару у відсотках
     * @private
     */
    _calculateProgressWidth(raffle) {
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
}

// Створюємо екземпляр класу
const activeRafflesModule = new ActiveRaffles();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.active = activeRafflesModule;

console.log("🎮 WINIX Raffles: Ініціалізація модуля активних розіграшів");

// Експортуємо модуль для використання в інших файлах
export default activeRafflesModule;