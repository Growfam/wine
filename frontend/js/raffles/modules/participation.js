/**
 * Модуль для участі в розіграшах WINIX
 */

import WinixRaffles from '../globals.js';
import { showLoading, hideLoading, showToast, copyToClipboard } from '../utils/ui-helpers.js';
import api from '../services/api.js';
import { formatDate } from '../utils/formatters.js';

// Приватні змінні
let _isParticipating = false;
let _participationTimeoutId = null;
let _raffleDetailsCache = {};

/**
 * Клас для роботи з участю в розіграшах
 */
class ParticipationModule {
    /**
     * Ініціалізація модуля
     */
    init() {
        console.log("🎮 Participation: Ініціалізація модуля участі в розіграшах");

        try {
            // Підписуємося на події
            this._setupEventListeners();

            console.log("✅ Participation: Модуль участі в розіграшах ініціалізовано");
        } catch (error) {
            console.error("❌ Помилка ініціалізації модуля участі в розіграшах:", error);
        }
    }

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventListeners() {
        try {
            // Підписуємося на подію відкриття деталей розіграшу
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.on('open-raffle-details', (data) => {
                    if (data && data.raffleId) {
                        this.openRaffleDetails(data.raffleId, data.raffleType);
                    }
                });

                // Підписуємося на подію поширення розіграшу
                WinixRaffles.events.on('share-raffle', (data) => {
                    if (data && data.raffleId) {
                        this.shareRaffle(data.raffleId);
                    }
                });

                // Підписуємося на подію отримання бонусу новачка
                WinixRaffles.events.on('claim-newbie-bonus', (data) => {
                    this.claimNewbieBonus(data && data.element, data && data.container);
                });
            }
        } catch (error) {
            console.error("❌ Помилка налаштування обробників подій:", error);
        }
    }

    /**
     * Видалення обробників подій
     * @private
     */
    _removeEventListeners() {
        // Якщо потрібно відписатися від подій
        // Наразі цей метод є заглушкою для майбутньої реалізації
    }

    /**
     * Отримання детальної інформації про розіграш
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} Дані про розіграш
     */
    async getRaffleDetails(raffleId) {
        try {
            if (!raffleId) {
    throw new Error('ID розіграшу не вказано');
}

// Перевіряємо формат UUID
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raffleId)) {
    console.error(`❌ Невалідний UUID розіграшу: ${raffleId}`);
    return { status: 'error', message: 'ID розіграшу має невірний формат' };
}

            // Перевіряємо кеш
            if (_raffleDetailsCache[raffleId]) {
                console.log(`📋 Raffles: Використання кешованих даних для розіграшу ${raffleId}`);
                return _raffleDetailsCache[raffleId];
            }

            // Використовуємо централізоване відображення лоадера
            showLoading('Завантаження деталей розіграшу...', `raffle-details-${raffleId}`);

            // Покращені параметри запиту
            const response = await api.apiRequest(`/api/raffles/${raffleId}`, 'GET', null, {
                timeout: 10000,
                suppressErrors: true,
                forceCleanup: true
            });

            // Завжди приховуємо лоадер
            hideLoading(`raffle-details-${raffleId}`);

            if (response && response.status === 'success') {
                // Кешуємо отримані дані
                if (response.data) {
                    _raffleDetailsCache[raffleId] = response.data;
                }
                return response.data;
            } else {
                throw new Error((response && response.message) || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
            // Завжди приховуємо лоадер
            hideLoading(`raffle-details-${raffleId}`);
            showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.', 'error');
            return null;
        }
    }

    /**
     * Участь у розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {number} entryCount - Кількість жетонів для участі
     * @returns {Promise<Object>} Результат участі
     */
    async participateInRaffle(raffleId, entryCount = 1) {
    try {
        if (!raffleId) {
            throw new Error('ID розіграшу не вказано');
        }

        // Перевіряємо валідність UUID
        if (raffleId === "unknown" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raffleId)) {
            console.error(`❌ Невалідний UUID розіграшу: ${raffleId}`);
            return {
                status: 'error',
                message: 'ID розіграшу має невірний формат'
            };
        }

        // Перевіряємо коректність entryCount
        if (isNaN(entryCount) || entryCount <= 0) {
            throw new Error('Кількість жетонів повинна бути більшою за нуль');
        }

        // Автоматичне скидання зависаючих запитів
        const now = Date.now();
        if (_isParticipating && _participationTimeoutId === null) {
            console.warn("⚠️ Raffles: Виявлено потенційно зависаючий запит участі, скидаємо");
            _isParticipating = false;
        }

        if (_isParticipating) {
            console.log("⏳ Raffles: Участь у розіграші вже виконується");
            return { status: 'error', message: 'Участь у розіграші вже виконується' };
        }

        _isParticipating = true;

        // Встановлюємо таймаут для автоматичного скидання
        if (_participationTimeoutId) {
            clearTimeout(_participationTimeoutId);
        }
        _participationTimeoutId = setTimeout(() => {
            if (_isParticipating) {
                console.warn("⚠️ Raffles: Участь у розіграші триває занадто довго, скидаємо стан");
                _isParticipating = false;
                _participationTimeoutId = null;
            }
        }, 30000); // 30 секунд

        // Використовуємо централізоване відображення лоадера
        showLoading('Беремо участь у розіграші...', `participate-${raffleId}`);

        const userId = api.getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        // Покращені параметри запиту
        const response = await api.apiRequest(`/api/user/${userId}/participate-raffle`, 'POST', {
            raffle_id: raffleId,
            entry_count: entryCount
        }, {
            timeout: 15000,
            suppressErrors: true,
            forceCleanup: true
        });

        // ЗАВЖДИ приховуємо лоадер і скидаємо прапорці
        hideLoading(`participate-${raffleId}`);
        _isParticipating = false;

        // Очищаємо таймаут
        if (_participationTimeoutId) {
            clearTimeout(_participationTimeoutId);
            _participationTimeoutId = null;
        }

        if (response && response.status === 'success') {
            // Оновлюємо баланс користувача
            await this.updateUserBalance();

            // Оповіщаємо про успішну участь
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.emit('raffle-participated', {
                    raffleId: raffleId,
                    entryCount: entryCount,
                    timestamp: Date.now()
                });
            }

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
        hideLoading(`participate-${raffleId}`);
        _isParticipating = false;

        if (_participationTimeoutId) {
            clearTimeout(_participationTimeoutId);
            _participationTimeoutId = null;
        }

        return { status: 'error', message: error.message || 'Помилка участі в розіграші' };
    }
}

    /**
     * Відкриття модального вікна з деталями розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу
     */
    async openRaffleDetails(raffleId, raffleType) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return;
        }

        // Нормалізуємо тип розіграшу
        raffleType = raffleType || 'main';

        try {
            // Перевіряємо наявність жетонів
            let userData;
            try {
                userData = await api.getUserData();
            } catch (userError) {
                console.error("Помилка отримання даних користувача:", userError);
                userData = { data: { coins: 0 } };
            }

            const coinsBalance = userData && userData.data ? (userData.data.coins || 0) : 0;

            if (coinsBalance < 1) {
                showToast('Для участі в розіграші потрібен щонайменше 1 жетон', 'warning');
                return;
            }

            // Перевіряємо кеш
            if (_raffleDetailsCache[raffleId]) {
                console.log(`📋 Raffles: Використання кешованих даних для розіграшу ${raffleId}`);
                this.processRaffleDetails(_raffleDetailsCache[raffleId], raffleType);
                return;
            }

            // Отримуємо дані розіграшу
            const raffleData = await this.getRaffleDetails(raffleId);
            if (!raffleData) {
                showToast('Помилка отримання даних розіграшу', 'error');
                return;
            }

            // Обробляємо деталі розіграшу
            this.processRaffleDetails(raffleData, raffleType);
        } catch (error) {
            console.error('Помилка відкриття деталей розіграшу:', error);
            showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.', 'error');
        }
    }

    /**
     * Обробка деталей розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @param {string} raffleType - Тип розіграшу
     */
    async processRaffleDetails(raffleData, raffleType) {
        if (!raffleData) {
            showToast('Помилка отримання даних розіграшу', 'error');
            return;
        }

        // Нормалізуємо тип розіграшу
        raffleType = raffleType || 'main';

        // Відкриваємо відповідне модальне вікно
        const modalId = (raffleType === 'daily') ? 'daily-raffle-modal' : 'main-raffle-modal';
        const modal = document.getElementById(modalId);

        if (!modal) {
            console.error(`Модальне вікно з id ${modalId} не знайдено`);
            showToast('Помилка відображення деталей розіграшу', 'error');
            return;
        }

        try {
            // Отримуємо баланс жетонів
            let userData;
            try {
                userData = await api.getUserData();
            } catch (userError) {
                console.error("Помилка отримання даних користувача:", userError);
                userData = { data: { coins: 0 } };
            }

            const coinsBalance = userData && userData.data ? (userData.data.coins || 0) : 0;

            // Встановлюємо значення полів у модальному вікні
            const inputId = (raffleType === 'daily') ? 'daily-token-amount' : 'main-token-amount';
            const input = document.getElementById(inputId);

            if (input) {
                input.value = '1';

                // Встановлюємо максимальне значення рівне балансу жетонів
                const tokenCost = (raffleType === 'daily') ? 1 : 3;
                const maxTickets = Math.floor(coinsBalance / tokenCost);
                input.max = maxTickets;

                // Показуємо кнопку "ВСІ", якщо баланс більше 1
                const allButtonId = (raffleType === 'daily') ? 'daily-all-tokens-btn' : 'main-all-tokens-btn';
                const allButton = document.getElementById(allButtonId);

                if (allButton) {
                    if (coinsBalance > tokenCost) {
                        allButton.style.display = 'block';

                        // Додаємо обробник для кнопки "ВСІ"
                        allButton.onclick = function() {
                            if (input) {
                                input.value = maxTickets;
                            }
                        };
                    } else {
                        allButton.style.display = 'none';
                    }
                }
            }

            // Налаштовуємо кнопку участі
            const btnId = (raffleType === 'daily') ? 'daily-join-btn' : 'main-join-btn';
            const joinBtn = document.getElementById(btnId);

            if (joinBtn) {
                joinBtn.setAttribute('data-raffle-id', raffleData.id || 'unknown');
                joinBtn.setAttribute('data-raffle-type', raffleType);

                // Додаємо обробник натискання
                joinBtn.onclick = () => {
                    const raffleId = joinBtn.getAttribute('data-raffle-id');
                    if (!raffleId) {
                        console.error("ID розіграшу не знайдено");
                        return;
                    }

                    const raffleType = joinBtn.getAttribute('data-raffle-type') || 'main';
                    const inputId = (raffleType === 'daily') ? 'daily-token-amount' : 'main-token-amount';

                    this.participateInRaffleUI(raffleId, raffleType, inputId);
                };
            }

            // Оновлюємо дані в модальному вікні в залежності від типу
            if (raffleType === 'daily') {
                this._updateDailyRaffleModal(raffleData);
            } else {
                this._updateMainRaffleModal(raffleData);
            }

            // Відкриваємо модальне вікно
            modal.classList.add('open');

            // Додаємо обробник для закриття модального вікна
            const closeButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
            if (closeButtons && closeButtons.length > 0) {
                closeButtons.forEach(btn => {
                    if (btn) {
                        btn.addEventListener('click', function() {
                            modal.classList.remove('open');
                        });
                    }
                });
            } else {
                console.warn(`Не знайдено кнопки закриття для модального вікна ${modalId}`);
            }
        } catch (error) {
            console.error('Помилка обробки деталей розіграшу:', error);
            showToast('Помилка відображення деталей розіграшу', 'error');
        }
    }

    /**
     * Оновлення полів у модальному вікні для щоденного розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @private
     */
    _updateDailyRaffleModal(raffleData) {
        if (!raffleData) return;

        try {
            const titleElement = document.getElementById('daily-modal-title');
            if (titleElement) {
                titleElement.textContent = raffleData.title || 'Щоденний розіграш';
            }

            const prizeElement = document.getElementById('daily-prize-value');
            if (prizeElement) {
                const prizeAmount = raffleData.prize_amount || 0;
                const prizeCurrency = raffleData.prize_currency || 'WINIX';
                const winnersCount = raffleData.winners_count || 1;
                prizeElement.textContent = `${prizeAmount} ${prizeCurrency} (${winnersCount} переможців)`;
            }

            const participantsElement = document.getElementById('daily-participants');
            if (participantsElement) {
                participantsElement.textContent = raffleData.participants_count || '0';
            }

            const endDateElement = document.getElementById('daily-end-time');
            if (endDateElement && raffleData.end_time) {
                try {
                    endDateElement.textContent = formatDate(raffleData.end_time);
                } catch (dateError) {
                    console.error("Помилка форматування дати:", dateError);
                    endDateElement.textContent = 'Дата не вказана';
                }
            }

            const descriptionElement = document.getElementById('daily-description');
            if (descriptionElement) {
                descriptionElement.textContent = raffleData.description ||
                    'Щоденний розіграш з призами для переможців! Використайте жетони для участі.';
            }

            // Оновлюємо зображення, якщо воно є
            const imageElement = document.getElementById('daily-prize-image');
            if (imageElement && raffleData.image_url) {
                imageElement.src = raffleData.image_url;
            }
        } catch (error) {
            console.error("Помилка оновлення модального вікна щоденного розіграшу:", error);
        }
    }

    /**
     * Оновлення полів у модальному вікні для основного розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @private
     */
    _updateMainRaffleModal(raffleData) {
        if (!raffleData) return;

        try {
            const titleElement = document.getElementById('main-modal-title');
            if (titleElement) {
                titleElement.textContent = raffleData.title || 'Гранд Розіграш';
            }

            const prizeElement = document.getElementById('main-prize-value');
            if (prizeElement) {
                const prizeAmount = raffleData.prize_amount || 0;
                const prizeCurrency = raffleData.prize_currency || 'WINIX';
                const winnersCount = raffleData.winners_count || 1;
                prizeElement.textContent = `${prizeAmount} ${prizeCurrency} (${winnersCount} переможців)`;
            }

            const participantsElement = document.getElementById('main-participants');
            if (participantsElement) {
                participantsElement.textContent = raffleData.participants_count || '0';
            }

            const endDateElement = document.getElementById('main-end-time');
            if (endDateElement && raffleData.end_time) {
                try {
                    endDateElement.textContent = formatDate(raffleData.end_time);
                } catch (dateError) {
                    console.error("Помилка форматування дати:", dateError);
                    endDateElement.textContent = 'Дата не вказана';
                }
            }

            const descriptionElement = document.getElementById('main-description');
            if (descriptionElement) {
                descriptionElement.textContent = raffleData.description ||
                    'Грандіозний розіграш з чудовими призами! Використайте жетони для участі та збільшіть свої шанси на перемогу.';
            }

            // Оновлюємо зображення, якщо воно є
            const imageElement = document.getElementById('main-prize-image');
            if (imageElement && raffleData.image_url) {
                imageElement.src = raffleData.image_url;
            }

            // Оновлюємо розподіл призів, якщо є
            const prizeDistributionElement = document.getElementById('main-prize-distribution');
            if (prizeDistributionElement) {
                if (raffleData.prize_distribution && typeof raffleData.prize_distribution === 'object' &&
                    WinixRaffles && WinixRaffles.utils && typeof WinixRaffles.utils.generatePrizeDistributionHTML === 'function') {
                    try {
                        prizeDistributionElement.innerHTML = WinixRaffles.utils.generatePrizeDistributionHTML(raffleData.prize_distribution);
                    } catch (prizeError) {
                        console.error("Помилка генерації розподілу призів:", prizeError);
                        prizeDistributionElement.innerHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
                    }
                } else {
                    prizeDistributionElement.innerHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
                }
            }
        } catch (error) {
            console.error("Помилка оновлення модального вікна основного розіграшу:", error);
        }
    }

    /**
     * Функція обробки натискання на кнопку участі в розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу
     * @param {string} inputId - ID поля введення кількості жетонів
     */
    async participateInRaffleUI(raffleId, raffleType, inputId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return;
        }

        try {
            // Отримуємо кількість жетонів
            const input = document.getElementById(inputId);
            let entryCount = 1;

            if (input) {
                // Перетворюємо значення в число
                entryCount = parseInt(input.value || '1');
                // Перевіряємо, що значення є числом
                if (isNaN(entryCount) || entryCount <= 0) {
                    showToast('Кількість жетонів має бути більше нуля', 'warning');
                    return;
                }
            } else {
                console.warn(`Елемент вводу з ID ${inputId} не знайдено`);
            }

            // Отримуємо модальне вікно
            const modalId = (raffleType === 'daily') ? 'daily-raffle-modal' : 'main-raffle-modal';
            const modal = document.getElementById(modalId);

            // Перевіряємо, чи достатньо жетонів
            let userData;
            try {
                userData = await api.getUserData();
            } catch (userError) {
                console.error("Помилка отримання даних користувача:", userError);
                userData = { data: { coins: 0 } };
            }

            const coinsBalance = userData && userData.data ? (userData.data.coins || 0) : 0;
            const tokenCost = (raffleType === 'daily') ? 1 : 3;
            const totalCost = entryCount * tokenCost;

            if (coinsBalance < totalCost) {
                showToast(`Недостатньо жетонів. Потрібно ${totalCost}, у вас ${coinsBalance}`, 'warning');
                return;
            }

            // Беремо участь у розіграші
            const result = await this.participateInRaffle(raffleId, entryCount);

            if (result && result.status === 'success') {
                // Закриваємо модальне вікно
                if (modal) {
                    modal.classList.remove('open');
                }

                // Оновлюємо баланс
                await this.updateUserBalance();

                // Показуємо повідомлення про успіх
                showToast(result.message || 'Ви успішно взяли участь у розіграші', 'success');

                // Якщо є бонус, показуємо повідомлення про нього
                if (result.data && result.data.bonus_amount) {
                    setTimeout(() => {
                        showToast(`Вітаємо! Ви отримали ${result.data.bonus_amount} WINIX як бонус!`, 'success');
                    }, 3000);
                }
            } else {
                // Показуємо повідомлення про помилку
                showToast(result && result.message ? result.message : 'Помилка участі в розіграші', 'error');
            }
        } catch (error) {
            console.error('Помилка при участі в розіграші:', error);
            showToast('Сталася помилка при участі в розіграші. Спробуйте пізніше.', 'error');
        }
    }

    /**
     * Отримання бонусу новачка
     * @param {HTMLElement} [button] - Кнопка бонусу новачка
     * @param {HTMLElement} [container] - Контейнер елементу бонусу
     * @returns {Promise<Object>} Результат отримання бонусу
     */
    async claimNewbieBonus(button, container) {
        try {
            showLoading('Отримуємо бонус новачка...', 'newbie-bonus');

            const userId = api.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            // Покращені параметри запиту
            const response = await api.apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST', null, {
                timeout: 10000,
                suppressErrors: true
            });

            hideLoading('newbie-bonus');

            if (response && (response.status === 'success' || response.status === 'already_claimed')) {
                // Оновлюємо баланс WINIX у користувача
                await this.updateUserBalance();

                if (response.status === 'success') {
                    showToast(`Ви отримали ${response.data && response.data.amount ? response.data.amount : 500} WINIX як бонус новачка!`, 'success');

                    // Деактивуємо кнопку, якщо вона передана
                    if (button) {
                        button.textContent = 'Отримано';
                        button.disabled = true;
                        button.style.opacity = '0.6';
                        button.style.cursor = 'default';
                    }

                    // Додаємо водяний знак, якщо контейнер переданий
                    if (container && WinixRaffles && WinixRaffles.utils &&
                        typeof WinixRaffles.utils.markElement === 'function') {
                        WinixRaffles.utils.markElement(container);
                    }
                } else if (response.status === 'already_claimed') {
                    showToast('Ви вже отримали бонус новачка', 'info');

                    // Деактивуємо кнопку, якщо вона передана
                    if (button) {
                        button.textContent = 'Отримано';
                        button.disabled = true;
                        button.style.opacity = '0.6';
                        button.style.cursor = 'default';
                    }

                    // Додаємо водяний знак, якщо контейнер переданий
                    if (container && WinixRaffles && WinixRaffles.utils &&
                        typeof WinixRaffles.utils.markElement === 'function') {
                        WinixRaffles.utils.markElement(container);
                    }
                }

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
            hideLoading('newbie-bonus');
            showToast(error.message || 'Помилка отримання бонусу новачка', 'error');
            return { status: 'error', message: error.message || 'Помилка отримання бонусу новачка' };
        }
    }

    /**
     * Оновлення балансу користувача
     * @returns {Promise<boolean>} Результат оновлення
     */
    async updateUserBalance() {
        try {
            // Перевіряємо наявність глобальної функції
            if (api && typeof api.getBalance === 'function') {
                await api.getBalance();
                return true;
            } else {
                // Альтернативний метод оновлення
                const userData = await api.getUserData(true);

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

                return true;
            }
        } catch (error) {
            console.error('Помилка оновлення балансу:', error);
            return false;
        } finally {
            // Відправляємо подію про оновлення балансу
            if (WinixRaffles && WinixRaffles.events) {
                WinixRaffles.events.emit('balance-updated', {
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Поділитися розіграшем
     * @param {string} raffleId - ID розіграшу
     */
    async shareRaffle(raffleId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return;
        }

        try {
            // Отримуємо дані розіграшу
            const raffleData = await this.getRaffleDetails(raffleId);
            if (!raffleData) {
                showToast('Не вдалося отримати дані розіграшу', 'error');
                return;
            }

            // Безпечно отримуємо поля розіграшу
            const title = raffleData.title || 'Розіграш';
            const prizeAmount = raffleData.prize_amount || 0;
            const prizeCurrency = raffleData.prize_currency || 'WINIX';
            const winnersCount = raffleData.winners_count || 1;

            // Формуємо повідомлення для поширення
            const shareText = `🎮 Розіграш WINIX: ${title}\n\n` +
                            `💰 Призовий фонд: ${prizeAmount} ${prizeCurrency}\n` +
                            `🏆 Кількість переможців: ${winnersCount}\n\n` +
                            `Бери участь і вигравай призи! 🚀`;

            // Перевіряємо наявність Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    // Використовуємо метод Telegram для поширення
                    if (typeof window.Telegram.WebApp.switchInlineQuery === 'function') {
                        window.Telegram.WebApp.switchInlineQuery(shareText, ['users', 'groups']);
                        return;
                    }
                } catch (telegramError) {
                    console.warn('Помилка використання Telegram WebApp:', telegramError);
                }
            }

            // Запасний варіант - Web Share API
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `Розіграш WINIX: ${title}`,
                        text: shareText
                    });
                    showToast('Розіграш успішно поширено', 'success');
                    return;
                } catch (shareError) {
                    // Користувач відмінив поширення або сталася помилка
                    if (shareError.name !== 'AbortError') {
                        console.error('Помилка поширення:', shareError);
                    }
                }
            }

            // Останній запасний варіант - копіювання в буфер обміну
            if (typeof copyToClipboard === 'function') {
                await copyToClipboard(shareText);
                showToast('Текст розіграшу скопійовано в буфер обміну', 'success');
            } else {
                // Примітивний варіант копіювання
                const textarea = document.createElement('textarea');
                textarea.value = shareText;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();

                try {
                    document.execCommand('copy');
                    showToast('Текст розіграшу скопійовано в буфер обміну', 'success');
                } catch (copyError) {
                    console.error('Помилка копіювання:', copyError);
                    showToast('Не вдалося скопіювати текст', 'error');
                }

                document.body.removeChild(textarea);
            }
        } catch (error) {
            console.error('Помилка поширення розіграшу:', error);
            showToast('Не вдалося поділитися розіграшем', 'error');
        }
    }

    /**
     * Очищення ресурсів і кешу при знищенні модуля
     */
    destroy() {
        try {
            // Очищаємо таймаути
            if (_participationTimeoutId) {
                clearTimeout(_participationTimeoutId);
                _participationTimeoutId = null;
            }

            // Скидаємо прапорці
            _isParticipating = false;

            // Очищаємо кеш
            _raffleDetailsCache = {};

            // Видаляємо обробники подій
            this._removeEventListeners();

            console.log("🚫 Participation: Модуль участі в розіграшах закрито");
        } catch (error) {
            console.error("Помилка при знищенні модуля участі в розіграшах:", error);
        }
    }
}

// Створюємо екземпляр класу
const participationModule = new ParticipationModule();

// Додаємо в глобальний об'єкт для зворотної сумісності
if (WinixRaffles) {
    WinixRaffles.participation = participationModule;
}

// Автоматична ініціалізація при завантаженні
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => participationModule.init());
} else {
    setTimeout(() => participationModule.init(), 100);
}

export default participationModule;