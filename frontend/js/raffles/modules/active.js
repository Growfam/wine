/**
 * active.js - Модуль для роботи з активними розіграшами WINIX
 */

import WinixRaffles from '../globals.js';
import api from '../services/api.js';
import {
    showLoading,
    hideLoading,
    showToast
} from '../utils/ui-helpers.js';
import {
    formatTimeLeft,
    calculateProgressByTime,
    generatePrizeDistributionHTML
} from '../utils/formatters.js';

// Приватні змінні
let _activeRaffles = null;
let _isLoading = false;
let _lastRafflesUpdateTime = 0;
const RAFFLES_CACHE_TTL = 60000; // 1 хвилина
let _loadingTimeoutId = null;
let _timerIntervals = [];
let _requestId = 0; // Унікальний ідентифікатор запиту

/**
 * Перевірка, чи пристрій онлайн
 * @returns {boolean} Стан підключення
 */
function isOnline() {
    return typeof navigator.onLine === 'undefined' || navigator.onLine;
}

/**
 * Модуль активних розіграшів
 */
class ActiveRaffles {
    /**
     * Ініціалізація модуля
     */
    init() {
        console.log("🎮 Активні розіграші: Ініціалізація...");

        try {
            // Обробники подій для перемикання вкладок
            const tabButtons = document.querySelectorAll('.tab-button');
            if (tabButtons.length > 0) {
                console.log(`Знайдено ${tabButtons.length} кнопок вкладок`);
                tabButtons.forEach(button => {
                    if (button) {
                        button.addEventListener('click', () => {
                            const tabName = button.getAttribute('data-tab');
                            if (tabName) {
                                this.switchTab(tabName);
                            }
                        });
                    }
                });
            }

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline()) {
                console.warn("🎮 Активні розіграші: Пристрій офлайн, пропускаємо початковий запит");
                this.displayOfflineData();
                return;
            }

            // Отримуємо дані активних розіграшів
            this.getActiveRaffles().then(() => {
                // Відображаємо активні розіграші
                this.displayRaffles();
            }).catch(error => {
                console.error("Помилка при отриманні активних розіграшів:", error);
                // Скидаємо всі стани у випадку помилки
                this.resetAllStates();
                // Показуємо дані в офлайн режимі або помилку
                this.displayOfflineData();
            });

            // Налаштовуємо кнопки участі для розіграшів
            this._setupRaffleButtons();

            // Встановлюємо обробники подій для комунікації з іншими модулями
            this._setupEventListeners();

            console.log("✅ Активні розіграші: Ініціалізацію завершено");
        } catch (error) {
            console.error("❌ Критична помилка при ініціалізації модуля активних розіграшів:", error);
            this.resetAllStates();
            this.displayOfflineData();
        }
    }

    /**
     * Відображення даних в офлайн режимі або при помилці
     */
    displayOfflineData() {
        try {
            // Отримуємо контейнери для розіграшів
            const mainRaffleContainer = document.querySelector('.main-raffle');
            const miniRafflesContainer = document.querySelector('.mini-raffles-container');

            if (!mainRaffleContainer && !miniRafflesContainer) {
                console.error("❌ Raffles: Не знайдено контейнери для розіграшів");
                return;
            }

            // Завантажуємо локальні дані, якщо є
            const cachedRaffles = localStorage.getItem('winix_active_raffles');
            if (cachedRaffles) {
                try {
                    const parsedRaffles = JSON.parse(cachedRaffles);
                    if (Array.isArray(parsedRaffles) && parsedRaffles.length > 0) {
                        console.log("📋 Raffles: Використання кешованих даних розіграшів з localStorage");
                        _activeRaffles = parsedRaffles;
                        this.displayRaffles(parsedRaffles);
                        return;
                    }
                } catch (e) {
                    console.warn("⚠️ Raffles: Помилка парсингу кешованих даних:", e);
                }
            }

            // Якщо немає кешованих даних, показуємо повідомлення
            if (mainRaffleContainer) {
                let statusMessage = !isOnline()
                    ? "Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову."
                    : "Не вдалося завантажити розіграші. Спробуйте оновити сторінку.";

                mainRaffleContainer.innerHTML = `
                    <div class="empty-raffles">
                        <div class="empty-raffles-icon">⚠️</div>
                        <h3>Дані недоступні</h3>
                        <p>${statusMessage}</p>
                        <button class="join-raffle-btn" onclick="location.reload()">Оновити сторінку</button>
                    </div>
                `;
            }

            // Очищаємо контейнер міні-розіграшів
            if (miniRafflesContainer) {
                miniRafflesContainer.innerHTML = '';
                // Додаємо елемент для бонусу новачка
                this._addNewbieBonusElement(miniRafflesContainer);
            }
        } catch (error) {
            console.error("❌ Критична помилка відображення офлайн даних:", error);
        }
    }

    /**
     * Отримання активних розіграшів з API
     * @param {boolean} forceRefresh - Примусове оновлення даних
     * @returns {Promise<Array>} Список активних розіграшів
     */
    async getActiveRaffles(forceRefresh = false) {
        try {
            // Перевіряємо, чи пристрій онлайн
            if (!isOnline() && !forceRefresh) {
                console.warn("🎮 Активні розіграші: Пристрій офлайн, повертаємо кешовані дані");

                // Завантажуємо з локального сховища
                const cachedRaffles = localStorage.getItem('winix_active_raffles');
                if (cachedRaffles) {
                    try {
                        const parsedRaffles = JSON.parse(cachedRaffles);
                        if (Array.isArray(parsedRaffles)) {
                            _activeRaffles = parsedRaffles;
                            return _activeRaffles;
                        }
                    } catch (e) {
                        console.warn("⚠️ Raffles: Помилка парсингу кешованих даних:", e);
                    }
                }

                // Якщо немає кешованих даних, повертаємо поточні або порожній масив
                return _activeRaffles || [];
            }

            // Перевіряємо кеш
            const now = Date.now();
            if (!forceRefresh && _activeRaffles && (now - _lastRafflesUpdateTime < RAFFLES_CACHE_TTL)) {
                console.log("📋 Raffles: Використання кешованих даних активних розіграшів");
                return _activeRaffles;
            }

            // Автоматичне скидання зависаючих запитів
            if (_isLoading && (now - _lastRafflesUpdateTime > 30000)) {
                console.warn("⚠️ Raffles: Виявлено потенційно зависаючий запит розіграшів, скидаємо стан");
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
            const currentRequestId = ++_requestId;

            // Встановлюємо таймаут для автоматичного скидання
            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
            }
            _loadingTimeoutId = setTimeout(() => {
                if (_isLoading) {
                    console.warn("⚠️ Raffles: Завантаження розіграшів триває занадто довго, скидаємо стан");
                    _isLoading = false;
                }
            }, 20000); // 20 секунд

            // Використовуємо централізоване управління лоадером
            showLoading('Завантаження розіграшів...', 'active-raffles');

            // Виконуємо запит до API
            const response = await api.apiRequest('/api/raffles', 'GET', null, {
                timeout: 15000,
                suppressErrors: true,
                forceCleanup: forceRefresh
            });

            // Перевіряємо, чи це актуальний запит
            if (currentRequestId !== _requestId) {
                console.warn("⚠️ Raffles: Отримано відповідь для застарілого запиту, ігноруємо");
                hideLoading('active-raffles');
                return _activeRaffles || [];
            }

            // ЗАВЖДИ приховуємо лоадер і скидаємо прапорець
            hideLoading('active-raffles');
            _isLoading = false;

            // Очищаємо таймаут
            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
                _loadingTimeoutId = null;
            }

            if (response && response.status === 'success') {
                _activeRaffles = Array.isArray(response.data) ? response.data : [];
                _lastRafflesUpdateTime = now;

                // Зберігаємо дані в localStorage для offline доступу
                try {
                    localStorage.setItem('winix_active_raffles', JSON.stringify(_activeRaffles));
                } catch (e) {
                    console.warn("⚠️ Raffles: Помилка збереження даних в localStorage:", e);
                }

                console.log(`✅ Raffles: Отримано ${_activeRaffles.length} активних розіграшів`);

                // Генеруємо подію оновлення розіграшів
                if (WinixRaffles && WinixRaffles.events) {
                    WinixRaffles.events.emit('raffles-updated', {
                        count: _activeRaffles.length,
                        data: _activeRaffles
                    });
                }

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
            hideLoading('active-raffles');
            _isLoading = false;

            if (_loadingTimeoutId) {
                clearTimeout(_loadingTimeoutId);
                _loadingTimeoutId = null;
            }

            // Показуємо повідомлення про помилку
            showToast('Не вдалося завантажити розіграші. Спробуйте пізніше.', 'error');

            // Генеруємо подію про помилку
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.emit('raffles-error', {
                    message: error.message || 'Помилка отримання розіграшів',
                    error
                });
            }

            // Завантажуємо з локального сховища у випадку помилки
            const cachedRaffles = localStorage.getItem('winix_active_raffles');
            if (cachedRaffles) {
                try {
                    const parsedRaffles = JSON.parse(cachedRaffles);
                    if (Array.isArray(parsedRaffles)) {
                        console.warn("📋 Raffles: Використання даних з localStorage після помилки");
                        _activeRaffles = parsedRaffles;
                        return _activeRaffles;
                    }
                } catch (e) {
                    console.warn("⚠️ Raffles: Помилка парсингу кешованих даних:", e);
                }
            }

            // Повертаємо кешовані дані або порожній масив у випадку помилки
            return _activeRaffles || [];
        }
    }

    /**
     * Відображення активних розіграшів
     * @param {Array} forcedRaffles - Примусовий список розіграшів для відображення
     */
    async displayRaffles(forcedRaffles = null) {
        console.log("🎮 Raffles: Відображення активних розіграшів");

        // Отримуємо контейнери для розіграшів
        const mainRaffleContainer = document.querySelector('.main-raffle');
        const miniRafflesContainer = document.querySelector('.mini-raffles-container');

        if (!mainRaffleContainer && !miniRafflesContainer) {
            console.error("❌ Raffles: Не знайдено контейнери для розіграшів");
            return;
        }

        // Показуємо індикатор завантаження
        showLoading('Завантаження розіграшів...', 'active-raffles-display');

        try {
            // Отримуємо активні розіграші (або використовуємо вже надані)
            const raffles = forcedRaffles || await this.getActiveRaffles(!isOnline());

            // Приховуємо індикатор завантаження
            hideLoading('active-raffles-display');

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

                // Очищаємо контейнер міні-розіграшів
                if (miniRafflesContainer) {
                    miniRafflesContainer.innerHTML = '';
                    // Додаємо елемент для бонусу новачка
                    this._addNewbieBonusElement(miniRafflesContainer);
                }

                return;
            }

            // Створюємо список основних і міні-розіграшів
            const mainRaffles = Array.isArray(raffles) ?
                raffles.filter(raffle => raffle && raffle.is_daily === false) : [];
            const miniRaffles = Array.isArray(raffles) ?
                raffles.filter(raffle => raffle && raffle.is_daily === true) : [];

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
                        if (raffle) {
                            const miniRaffleElement = this._createMiniRaffleElement(raffle);
                            if (miniRaffleElement) {
                                miniRafflesContainer.appendChild(miniRaffleElement);
                            }
                        }
                    });
                } else {
                    // Додаємо елемент для бонусу новачка, якщо міні-розіграшів немає
                    this._addNewbieBonusElement(miniRafflesContainer);
                }
            }

            // Активуємо таймери
            this._startRaffleTimers();

            // Генеруємо подію про оновлення відображення
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.emit('raffles-displayed', {
                    mainCount: mainRaffles.length,
                    miniCount: miniRaffles.length
                });
            }
        } catch (error) {
            console.error("Помилка при завантаженні активних розіграшів:", error);
            hideLoading('active-raffles-display');

            // Показуємо повідомлення про помилку
            showToast('Не вдалося завантажити розіграші. Спробуйте пізніше.', 'error');

            if (mainRaffleContainer) {
                let errorMessage = !isOnline()
                    ? "Немає з'єднання з Інтернетом. Перевірте підключення."
                    : "Сталася помилка при спробі завантажити розіграші.";

                mainRaffleContainer.innerHTML = `
                    <div class="empty-raffles">
                        <div class="empty-raffles-icon">❌</div>
                        <h3>Помилка завантаження</h3>
                        <p>${errorMessage} Спробуйте оновити сторінку.</p>
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
        if (!tabName) {
            console.error("Назва вкладки не вказана");
            return;
        }

        console.log(`🎮 Raffles: Переключення на вкладку ${tabName}`);

        try {
            // Оновлюємо активну вкладку
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabSections = document.querySelectorAll('.tab-content');

            // Знімаємо активний стан з усіх вкладок і секцій
            if (tabButtons && tabButtons.length > 0) {
                tabButtons.forEach(btn => {
                    if (btn) btn.classList.remove('active');
                });
            }

            if (tabSections && tabSections.length > 0) {
                tabSections.forEach(section => {
                    if (section) section.classList.remove('active');
                });
            }

            // Додаємо активний стан до вибраної вкладки і секції
            const activeTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
            const activeTabSection = document.getElementById(`${tabName}-raffles`);

            if (activeTabButton) activeTabButton.classList.add('active');
            if (activeTabSection) activeTabSection.classList.add('active');

            // Генеруємо подію про зміну вкладки
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.emit('tab-switched', { tab: tabName });
            }

            // Якщо це вкладка з історією, повідомляємо через подію
            if (tabName === 'past' || tabName === 'history') {
                if (WinixRaffles && WinixRaffles.events) {
                    WinixRaffles.events.emit('history-tab-requested', {});
                }
            } else if (tabName === 'active') {
                // Оновлюємо активні розіграші, якщо ми онлайн
                if (isOnline()) {
                    this.displayRaffles();
                } else {
                    // В офлайн режимі показуємо кешовані дані
                    this.displayOfflineData();
                }
            }
        } catch (error) {
            console.error("Помилка при переключенні вкладок:", error);
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

        // Очищаємо інтервали таймерів
        this._stopRaffleTimers();

        // Приховуємо лоадери
        hideLoading('active-raffles');
        hideLoading('active-raffles-display');

        // Очищаємо активні запити через API
        if (api && typeof api.forceCleanupRequests === 'function') {
            api.forceCleanupRequests();
        }

        console.log("🔄 Raffles: Примусове скидання всіх станів");
        return true;
    }

    /**
     * Знищення модуля при вивантаженні сторінки
     */
    destroy() {
        try {
            // Зупиняємо таймери
            this._stopRaffleTimers();

            // Скидаємо стани
            this.resetAllStates();

            // Видаляємо обробники подій
            this._removeEventListeners();

            console.log("🚫 Raffles: Модуль активних розіграшів знищено");
        } catch (error) {
            console.error("Помилка при знищенні модуля активних розіграшів:", error);
        }
    }

    /**
     * Встановлення обробників подій для комунікації між модулями
     * @private
     */
    _setupEventListeners() {
        try {
            // Обробник події успішної участі в розіграші
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.on('raffle-participated', (data) => {
                    console.log('Отримано подію участі в розіграші:', data);
                    // Оновлюємо дані після успішної участі, якщо ми онлайн
                    if (isOnline()) {
                        this.getActiveRaffles(true).then(() => {
                            this.displayRaffles();
                        }).catch(error => {
                            console.error("Помилка оновлення даних після участі:", error);
                        });
                    }
                });
            }

            // Обробник події зміни стану мережі
            window.addEventListener('online', () => {
                console.log("🔄 Raffles: З'єднання з мережею відновлено");

                // Оновлюємо дані після відновлення з'єднання
                setTimeout(() => {
                    this.getActiveRaffles(true).then(() => {
                        this.displayRaffles();
                    }).catch(error => {
                        console.error("Помилка оновлення даних після відновлення з'єднання:", error);
                    });
                }, 1000);
            });

            window.addEventListener('offline', () => {
                console.warn("⚠️ Raffles: З'єднання з мережею втрачено");
            });
        } catch (error) {
            console.error("Помилка встановлення обробників подій:", error);
        }
    }

    /**
     * Видалення обробників подій
     * @private
     */
    _removeEventListeners() {
        try {
            // Видаляємо обробники подій мережі
            window.removeEventListener('online', () => {});
            window.removeEventListener('offline', () => {});

            // Якщо є власні обробники подій WinixRaffles, відписуємося від них
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.off('raffle-participated', () => {});
            }
        } catch (error) {
            console.error("Помилка видалення обробників подій:", error);
        }
    }

    /**
     * Відображення основного розіграшу
     * @param {HTMLElement} container - Контейнер для відображення
     * @param {Object} raffle - Дані розіграшу
     * @private
     */
    _displayMainRaffle(container, raffle) {
        if (!container || !raffle) {
            console.error("Не вказано контейнер або дані розіграшу");
            return;
        }

        try {
            // Перевіряємо наявність необхідних полів
            const title = raffle.title || 'Розіграш';
            const entryFee = raffle.entry_fee || 0;
            const prizeAmount = raffle.prize_amount || 0;
            const prizeCurrency = raffle.prize_currency || 'WINIX';
            const winnersCount = raffle.winners_count || 1;
            const participantsCount = raffle.participants_count || 0;
            const raffleId = raffle.id || 'unknown';

            // Розраховуємо безпечно прогрес
            let progressWidth = 0;
            if (raffle.start_time && raffle.end_time) {
                try {
                    progressWidth = calculateProgressByTime(raffle.start_time, raffle.end_time);
                } catch (e) {
                    console.error("Помилка розрахунку прогресу:", e);
                }
            }

            // Формуємо HTML для розподілу призів
            let prizeDistributionHTML = '';
            if (raffle.prize_distribution && typeof raffle.prize_distribution === 'object') {
                try {
                    prizeDistributionHTML = generatePrizeDistributionHTML(raffle.prize_distribution);
                } catch (e) {
                    console.error("Помилка генерації розподілу призів:", e);
                    prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Інформація недоступна</span></div>';
                }
            } else {
                prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
            }

            // Створюємо HTML для основного розіграшу
            container.innerHTML = `
                <img class="main-raffle-image" src="${raffle.image_url || '/assets/prize-poster.gif'}" alt="${title}" onerror="this.src='/assets/prize-poster.gif'">
                <div class="main-raffle-content">
                    <div class="main-raffle-header">
                        <h3 class="main-raffle-title">${title}</h3>
                        <div class="main-raffle-cost">
                            <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
                            <span>${entryFee} жетон${entryFee !== 1 ? 'и' : ''}</span>
                        </div>
                    </div>

                    <span class="main-raffle-prize">${prizeAmount} ${prizeCurrency}</span>

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
                        <div class="prize-distribution-title">Розподіл призів (${winnersCount} переможців):</div>
                        <div class="prize-list">
                            ${prizeDistributionHTML}
                        </div>
                    </div>

                    <div class="main-raffle-participants">
                        <div class="participants-info">Учасників: <span class="participants-count">${participantsCount}</span></div>
                        <div class="share-container">
                            <button class="share-button" id="share-raffle-btn" data-raffle-id="${raffleId}">Поділитися</button>
                        </div>
                    </div>

                    <div class="progress-bar">
                        <div class="progress" style="width: ${progressWidth}%"></div>
                    </div>

                    <button class="join-button" data-raffle-id="${raffleId}" data-raffle-type="main">Взяти участь</button>
                </div>
            `;

            // Оновлюємо таймер
            this._updateRaffleTimers();

            // Додаємо обробники подій
            const joinButton = container.querySelector('.join-button');
            if (joinButton) {
                joinButton.addEventListener('click', () => {
                    const raffleId = joinButton.getAttribute('data-raffle-id');
                    if (!raffleId) {
                        console.error("ID розіграшу не знайдено");
                        return;
                    }

                    const raffleType = joinButton.getAttribute('data-raffle-type') || 'main';

                    // Перевіряємо, чи ми онлайн
                    if (!isOnline()) {
                        showToast("Неможливо взяти участь без підключення до Інтернету", "error");
                        return;
                    }

                    // Генеруємо подію для відкриття деталей розіграшу
                    if (WinixRaffles && WinixRaffles.events) {
                        WinixRaffles.events.emit('open-raffle-details', {
                            raffleId,
                            raffleType
                        });
                    }
                });
            }

            // Додаємо обробник для кнопки "Поділитися"
            const shareButton = container.querySelector('#share-raffle-btn');
            if (shareButton) {
                shareButton.addEventListener('click', () => {
                    const raffleId = shareButton.getAttribute('data-raffle-id');
                    if (!raffleId) {
                        console.error("ID розіграшу не знайдено");
                        return;
                    }

                    // Генеруємо подію для поширення розіграшу
                    if (WinixRaffles && WinixRaffles.events) {
                        WinixRaffles.events.emit('share-raffle', { raffleId });
                    }
                });
            }
        } catch (error) {
            console.error("Помилка відображення основного розіграшу:", error);
            // Виводимо повідомлення про помилку у контейнер
            container.innerHTML = `
                <div class="raffle-error">
                    <div class="error-icon">⚠️</div>
                    <h3>Помилка відображення розіграшу</h3>
                    <p>Сталася помилка при відображенні даних розіграшу.</p>
                </div>
            `;
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

        try {
            // Створюємо контейнер
            const miniRaffle = document.createElement('div');
            miniRaffle.className = 'mini-raffle';
            miniRaffle.setAttribute('data-raffle-id', raffle.id || 'unknown');

            // Розраховуємо час, що залишився
            let timeLeftText = '';
            try {
                // Перевіряємо наявність та валідність дати завершення
                if (raffle.end_time) {
                    const now = new Date();
                    const endTime = new Date(raffle.end_time);

                    // Перевіряємо, чи валідна дата
                    if (!isNaN(endTime.getTime())) {
                        const timeLeft = endTime - now;

                        if (timeLeft > 0) {
                            const timeLeftData = formatTimeLeft(timeLeft, 'short');
                            timeLeftText = `Залишилось: ${timeLeftData.text}`;
                        } else {
                            timeLeftText = 'Завершується';
                        }
                    } else {
                        timeLeftText = 'Час не визначено';
                    }
                } else {
                    timeLeftText = 'Час не визначено';
                }
            } catch (error) {
                console.error("Помилка розрахунку часу міні-розіграшу:", error);
                timeLeftText = 'Час не визначено';
            }

            // Перевіряємо наявність необхідних полів
            const title = raffle.title || 'Розіграш';
            const entryFee = raffle.entry_fee || 0;
            const prizeAmount = raffle.prize_amount || 0;
            const prizeCurrency = raffle.prize_currency || 'WINIX';
            const winnersCount = raffle.winners_count || 1;
            const raffleId = raffle.id || 'unknown';

            // Форматуємо кількість переможців
            const winnersText = `${prizeAmount} ${prizeCurrency} (${winnersCount} переможців)`;

            // Формуємо HTML
            miniRaffle.innerHTML = `
                <div class="mini-raffle-info">
                    <div class="mini-raffle-title">${title}</div>
                    <div class="mini-raffle-cost">
                        <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
                        <span>${entryFee} жетон${entryFee !== 1 ? 'и' : ''}</span>
                    </div>
                    <div class="mini-raffle-prize">${winnersText}</div>
                    <div class="mini-raffle-time">${timeLeftText}</div>
                </div>
                <button class="mini-raffle-button" data-raffle-id="${raffleId}" data-raffle-type="daily">Участь</button>
            `;

            // Додаємо обробник натискання
            const button = miniRaffle.querySelector('.mini-raffle-button');
            if (button) {
                button.addEventListener('click', (event) => {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) {
                        console.error("ID розіграшу не знайдено");
                        return;
                    }

                    const raffleType = button.getAttribute('data-raffle-type') || 'daily';

                    // Перевіряємо, чи ми онлайн
                    if (!isOnline()) {
                        showToast("Неможливо взяти участь без підключення до Інтернету", "error");
                        return;
                    }

                    // Генеруємо подію для відкриття деталей розіграшу
                    if (WinixRaffles && WinixRaffles.events) {
                        WinixRaffles.events.emit('open-raffle-details', {
                            raffleId,
                            raffleType
                        });
                    }
                });
            }

            return miniRaffle;
        } catch (error) {
            console.error("Помилка створення елементу міні-розіграшу:", error);
            return null;
        }
    }

    /**
     * Додавання елементу бонусу новачка
     * @param {HTMLElement} container - Контейнер для додавання
     * @private
     */
    _addNewbieBonusElement(container) {
        if (!container) return;

        try {
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
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    // Перевіряємо, чи ми онлайн
                    if (!isOnline()) {
                        showToast("Неможливо отримати бонус без підключення до Інтернету", "error");
                        return;
                    }

                    // Генеруємо подію для отримання бонусу новачка
                    if (WinixRaffles && WinixRaffles.events) {
                        WinixRaffles.events.emit('claim-newbie-bonus', {
                            element: button,
                            container: newbieBonus
                        });
                    }
                });
            }

            container.appendChild(newbieBonus);

            // Перевіряємо, чи вже отримано бонус
            try {
                const newbieBonusClaimed = localStorage.getItem('newbie_bonus_claimed') === 'true';

                if (newbieBonusClaimed) {
                    // Деактивуємо кнопку
                    if (button) {
                        button.textContent = 'Отримано';
                        button.disabled = true;
                        button.style.opacity = '0.6';
                        button.style.cursor = 'default';
                    }

                    return;
                }

                if (api && typeof api.getUserData === 'function') {
                    api.getUserData()
                        .then(userData => {
                            if (userData && userData.data && userData.data.newbie_bonus_claimed) {
                                // Деактивуємо кнопку
                                if (button) {
                                    button.textContent = 'Отримано';
                                    button.disabled = true;
                                    button.style.opacity = '0.6';
                                    button.style.cursor = 'default';
                                }

                                // Зберігаємо статус в localStorage
                                localStorage.setItem('newbie_bonus_claimed', 'true');
                            }
                        })
                        .catch(err => {
                            console.error("Помилка перевірки статусу бонусу:", err);
                        });
                }
            } catch (error) {
                console.error("Помилка перевірки статусу бонусу:", error);
            }
        } catch (error) {
            console.error("Помилка створення елементу бонусу новачка:", error);
        }
    }

    /**
     * Запуск таймерів для розіграшів
     * @private
     */
    _startRaffleTimers() {
        // Очищаємо існуючі таймери
        this._stopRaffleTimers();

        // Запускаємо оновлення таймерів кожну хвилину
        const interval = setInterval(() => this._updateRaffleTimers(), 60000);
        _timerIntervals.push(interval);

        // Відразу запускаємо оновлення
        this._updateRaffleTimers();
    }

    /**
     * Зупинка таймерів
     * @private
     */
    _stopRaffleTimers() {
        if (_timerIntervals && _timerIntervals.length > 0) {
            _timerIntervals.forEach(interval => {
                if (interval) {
                    clearInterval(interval);
                }
            });
            _timerIntervals = [];
        }
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

            if (daysElement && hoursElement && minutesElement &&
                _activeRaffles && Array.isArray(_activeRaffles) && _activeRaffles.length > 0) {

                // Знаходимо основний розіграш
                const mainRaffle = _activeRaffles.find(raffle => raffle && raffle.is_daily === false);

                if (mainRaffle && mainRaffle.end_time) {
                    try {
                        const now = new Date();
                        const endTime = new Date(mainRaffle.end_time);

                        // Перевіряємо, чи валідна дата
                        if (!isNaN(endTime.getTime())) {
                            const timeLeft = endTime - now;

                            if (timeLeft > 0) {
                                const timeLeftData = formatTimeLeft(timeLeft);
                                daysElement.textContent = timeLeftData.days;
                                hoursElement.textContent = timeLeftData.hours;
                                minutesElement.textContent = timeLeftData.minutes;
                            } else {
                                daysElement.textContent = '00';
                                hoursElement.textContent = '00';
                                minutesElement.textContent = '00';

                                // Розіграш завершено, оновлюємо дані тільки якщо ми онлайн
                                if (isOnline()) {
                                    this.getActiveRaffles(true).then(() => {
                                        this.displayRaffles();
                                    }).catch(err => {
                                        console.error("Помилка оновлення після завершення таймера:", err);
                                    });
                                }
                            }
                        } else {
                            daysElement.textContent = '00';
                            hoursElement.textContent = '00';
                            minutesElement.textContent = '00';
                        }
                    } catch (error) {
                        console.error("Помилка оновлення таймера головного розіграшу:", error);
                        daysElement.textContent = '00';
                        hoursElement.textContent = '00';
                        minutesElement.textContent = '00';
                    }
                }
            }

            // Оновлюємо таймери міні-розіграшів
            const miniRaffleTimeElements = document.querySelectorAll('.mini-raffle-time');

            if (miniRaffleTimeElements && miniRaffleTimeElements.length > 0 &&
                _activeRaffles && Array.isArray(_activeRaffles) && _activeRaffles.length > 0) {

                // Знаходимо щоденні розіграші
                const dailyRaffles = _activeRaffles.filter(raffle => raffle && raffle.is_daily === true);

                if (dailyRaffles.length > 0) {
                    const miniRaffles = document.querySelectorAll('.mini-raffle');

                    if (miniRaffles && miniRaffles.length > 0) {
                        miniRaffles.forEach(raffleElement => {
                            if (!raffleElement) return;

                            const raffleId = raffleElement.getAttribute('data-raffle-id');
                            const timeElement = raffleElement.querySelector('.mini-raffle-time');

                            if (!timeElement || !raffleId || raffleId === 'newbie') return;

                            const raffle = dailyRaffles.find(r => r && r.id === raffleId);
                            if (!raffle || !raffle.end_time) return;

                            try {
                                const now = new Date();
                                const endTime = new Date(raffle.end_time);

                                // Перевіряємо, чи валідна дата
                                if (!isNaN(endTime.getTime())) {
                                    const timeLeft = endTime - now;

                                    if (timeLeft > 0) {
                                        const timeLeftData = formatTimeLeft(timeLeft, 'short');
                                        timeElement.textContent = `Залишилось: ${timeLeftData.text}`;
                                    } else {
                                        timeElement.textContent = 'Завершується';

                                        // Розіграш завершено, оновлюємо дані тільки якщо ми онлайн
                                        if (isOnline()) {
                                            this.getActiveRaffles(true).then(() => {
                                                this.displayRaffles();
                                            }).catch(err => {
                                                console.error("Помилка оновлення після завершення таймера міні-розіграшу:", err);
                                            });
                                        }
                                    }
                                } else {
                                    timeElement.textContent = 'Час не визначено';
                                }
                            } catch (error) {
                                console.error("Помилка оновлення таймера міні-розіграшу:", error);
                                timeElement.textContent = 'Час не визначено';
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Критична помилка оновлення таймерів:", error);
        }
    }

    /**
     * Налаштування кнопок участі у розіграшах
     * @private
     */
    _setupRaffleButtons() {
        // Кнопки обробляються через обробники подій, що відправляють повідомлення до інших модулів
        // Цей метод є заглушкою для майбутньої реалізації
    }
}

// Створюємо екземпляр класу
const activeRafflesModule = new ActiveRaffles();

// Додаємо в глобальний об'єкт для зворотної сумісності
if (WinixRaffles) {
    WinixRaffles.active = activeRafflesModule;
}

console.log("🎮 WINIX Raffles: Ініціалізація модуля активних розіграшів");

// Експортуємо модуль для використання в інших файлах
export default activeRafflesModule;