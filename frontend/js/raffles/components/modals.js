/**
 * modals.js - Модуль для роботи з модальними вікнами розіграшів
 * Відповідає за створення та управління модальними вікнами для розіграшів
 */

import { formatDate, formatCurrency } from '../utils/formatters.js';
import { showToast } from '../utils/ui-helpers.js';
import raffleParticipation from '../modules/participation.js';
import api from '../services/api.js';
import WinixRaffles from '../globals.js';

/**
 * Клас для управління модальними вікнами розіграшів
 */
class RaffleModals {
    /**
     * Конструктор класу
     */
    constructor() {
        this._modals = {};
        this._activeModals = [];
    }

    /**
     * Ініціалізація модальних вікон для розіграшів
     */
    init() {
        // Додаємо обробники подій для існуючих модальних вікон
        this._setupExistingModals();
        console.log("🖼️ Raffle Modals: Ініціалізовано");
    }

    /**
     * Налаштування існуючих модальних вікон на сторінці
     * @private
     */
    _setupExistingModals() {
        // Знаходимо всі модальні вікна на сторінці
        const modals = document.querySelectorAll('.raffle-modal');

        modals.forEach(modal => {
            const modalId = modal.id;
            if (!modalId) return;

            // Зберігаємо посилання на модальне вікно
            this._modals[modalId] = modal;

            // Додаємо обробники для закриття
            const closeButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.closeModal(modalId));
            });

            // Закриття модального вікна по кліку на фон (якщо клік був саме на фоні)
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modalId);
                }
            });
        });
    }

    /**
     * Відкриття модального вікна з деталями розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
     */
    async openRaffleDetails(raffleId, raffleType) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано');
            return;
        }

        try {
            // Перевіряємо наявність жетонів
            const userData = await api.getUserData();
            const coinsBalance = userData.data?.coins || 0;

            if (coinsBalance < 1) {
                showToast('Для участі в розіграші потрібен щонайменше 1 жетон');
                return;
            }

            // Отримуємо дані розіграшу
            const raffleData = await this._getRaffleDetails(raffleId);
            if (!raffleData) {
                showToast('Помилка отримання даних розіграшу');
                return;
            }

            // Обробляємо деталі розіграшу
            this._processRaffleDetails(raffleData, raffleType);
        } catch (error) {
            console.error('Помилка відкриття деталей розіграшу:', error);
            showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.');
        }
    }

    /**
     * Отримання деталей розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Дані розіграшу
     * @private
     */
    async _getRaffleDetails(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            if (typeof window.showLoading === 'function') {
                window.showLoading('Завантаження деталей розіграшу...');
            }

            const response = await api.apiRequest(`/api/raffles/${raffleId}`, 'GET');

            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            if (response && response.status === 'success') {
                return response.data;
            } else {
                throw new Error((response && response.message) || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);

            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.');
            return null;
        }
    }

    /**
     * Обробка деталей розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
     * @private
     */
    _processRaffleDetails(raffleData, raffleType) {
        if (!raffleData) {
            showToast('Помилка отримання даних розіграшу');
            return;
        }

        // Відкриваємо відповідне модальне вікно
        const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
        const modal = this._modals[modalId] || document.getElementById(modalId);

        if (!modal) {
            console.error(`Модальне вікно з id ${modalId} не знайдено`);
            showToast('Помилка відображення деталей розіграшу');
            return;
        }

        // Встановлюємо значення полів у модальному вікні
        this._updateModalFields(modal, raffleData, raffleType);

        // Відкриваємо модальне вікно
        this.openModal(modalId);
    }

    /**
     * Оновлення полів у модальному вікні
     * @param {HTMLElement} modal - Елемент модального вікна
     * @param {Object} raffleData - Дані розіграшу
     * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
     * @private
     */
    async _updateModalFields(modal, raffleData, raffleType) {
        // Отримуємо баланс жетонів
        const userData = await api.getUserData();
        const coinsBalance = userData.data?.coins || 0;

        // Встановлюємо поля для введення кількості жетонів
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

        // Налаштовуємо кнопку участі
        const btnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
        const joinBtn = document.getElementById(btnId);

        if (joinBtn) {
            joinBtn.setAttribute('data-raffle-id', raffleData.id);
            joinBtn.setAttribute('data-raffle-type', raffleType);

            // Додаємо обробник натискання
            joinBtn.onclick = () => {
                const raffleId = joinBtn.getAttribute('data-raffle-id');
                const raffleType = joinBtn.getAttribute('data-raffle-type');

                this._participateInRaffle(raffleId, raffleType, inputId);
            };
        }

        // Оновлюємо дані в модальному вікні в залежності від типу
        if (raffleType === 'daily') {
            this._updateDailyRaffleModal(raffleData);
        } else {
            this._updateMainRaffleModal(raffleData);
        }
    }

    /**
     * Оновлення полів у модальному вікні для щоденного розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @private
     */
    _updateDailyRaffleModal(raffleData) {
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
    }

    /**
     * Оновлення полів у модальному вікні для основного розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @private
     */
    _updateMainRaffleModal(raffleData) {
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

        // Оновлюємо розподіл призів, якщо є
        const prizeDistributionElement = document.getElementById('main-prize-distribution');
        if (prizeDistributionElement && raffleData.prize_distribution) {
            prizeDistributionElement.innerHTML = this._generatePrizeDistributionHTML(raffleData.prize_distribution);
        }
    }

    /**
     * Функція участі в розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
     * @param {string} inputId - ID поля для введення кількості жетонів
     * @private
     */
    async _participateInRaffle(raffleId, raffleType, inputId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано');
            return;
        }

        // Отримуємо кількість жетонів
        const input = document.getElementById(inputId);
        const entryCount = parseInt(input?.value || '1') || 1;

        // Отримуємо модальне вікно
        const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';

        // Перевіряємо коректність введення
        if (entryCount <= 0) {
            showToast('Кількість жетонів має бути більше нуля');
            return;
        }

        // Делегуємо участь у розіграші до відповідного модуля
        const result = await raffleParticipation.participateInRaffle(raffleId, entryCount);

        // Обробляємо результат
        if (result.status === 'success') {
            // Закриваємо модальне вікно
            this.closeModal(modalId);

            // Показуємо повідомлення про успіх
            showToast(result.message);

            // Якщо є бонус, показуємо повідомлення про нього
            if (result.data && result.data.bonus_amount) {
                setTimeout(() => {
                    showToast(`Вітаємо! Ви отримали ${result.data.bonus_amount} WINIX як бонус!`);
                }, 3000);
            }

            // Оновлюємо відображення розіграшів
            if (typeof WinixRaffles.active?.displayRaffles === 'function') {
                WinixRaffles.active.displayRaffles();
            }
        } else {
            // Показуємо повідомлення про помилку
            showToast(result.message);
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
     * @param {Array} places - Масив з місцями
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
     * Створення та відображення модального вікна з деталями розіграшу з історії
     * @param {Object} raffleData - Дані розіграшу з історії
     */
    showRaffleHistoryDetails(raffleData) {
        if (!raffleData) {
            showToast('Не вдалося отримати дані розіграшу');
            return;
        }

        // Видаляємо існуюче модальне вікно історії, якщо воно є
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
            winnersHTML = this._generateWinnersListHTML(raffleData.winners);
        } else {
            winnersHTML = '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        // Визначаємо статус і клас статусу
        const statusClass = raffleData.status === 'won' ? 'win-status' : 'participated-status';
        const statusText = raffleData.status === 'won' ? 'Ви перемогли' : 'Участь без перемоги';

        // Визначаємо тип розіграшу
        const raffleType = raffleData.is_daily ? 'Щоденний розіграш' : 'Гранд розіграш';

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
                        <div class="detail-label">Тип:</div>
                        <div class="detail-value">${raffleType}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Призовий фонд:</div>
                        <div class="detail-value prize-value">${raffleData.prize || '0 WINIX'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Ваш результат:</div>
                        <div class="detail-value ${statusClass}">${statusText}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Використано жетонів:</div>
                        <div class="detail-value">${raffleData.entry_count || 0}</div>
                    </div>
                    ${raffleData.status === 'won' ? `
                    <div class="detail-item">
                        <div class="detail-label">Ваше місце:</div>
                        <div class="detail-value winner-place-value">${raffleData.place || '-'}</div>
                    </div>
                    ` : ''}
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
            closeButton.addEventListener('click', () => {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            });
        }

        const closeActionButton = modal.querySelector('#close-history-btn');
        if (closeActionButton) {
            closeActionButton.addEventListener('click', () => {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            });
        }

        // Показуємо модальне вікно
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });

        // Зберігаємо посилання на модальне вікно
        this._modals['raffle-history-modal'] = modal;
        this._activeModals.push('raffle-history-modal');
    }

    /**
     * Генерування HTML для списку переможців
     * @param {Array} winners - Масив з переможцями
     * @returns {string} - HTML-розмітка
     * @private
     */
    _generateWinnersListHTML(winners) {
        if (!winners || !Array.isArray(winners) || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        // Сортуємо переможців за місцем
        const sortedWinners = [...winners].sort((a, b) => {
            if (!a || !b || !a.place || !b.place) return 0;
            return a.place - b.place;
        });

        return sortedWinners.map(winner => {
            if (!winner) return '';

            // Визначаємо клас для місця (top-1, top-2, top-3)
            const placeClass = winner.place <= 3 ? `place-${winner.place}` : 'default-place';

            // Визначаємо, чи це поточний користувач
            const currentUserClass = winner.isCurrentUser ? 'current-user' : '';

            // Формуємо HTML для одного переможця
            return `
                <div class="winner-item ${currentUserClass}" ${winner.isCurrentUser ? 'title="Це ви!"' : ''}>
                    <div class="winner-place ${placeClass}">
                        <span>${winner.place || '-'}</span>
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
     * Відкриття модального вікна за його ID
     * @param {string} modalId - ID модального вікна
     */
    openModal(modalId) {
        const modal = this._modals[modalId] || document.getElementById(modalId);
        if (!modal) {
            console.error(`Модальне вікно з id ${modalId} не знайдено`);
            return;
        }

        // Додаємо клас для відображення
        modal.classList.add('open');

        // Додаємо до списку активних модальних вікон
        if (!this._activeModals.includes(modalId)) {
            this._activeModals.push(modalId);
        }
    }

    /**
     * Закриття модального вікна за його ID
     * @param {string} modalId - ID модального вікна
     */
    closeModal(modalId) {
        const modal = this._modals[modalId] || document.getElementById(modalId);
        if (!modal) return;

        // Видаляємо клас для приховування
        modal.classList.remove('open');

        // Видаляємо зі списку активних модальних вікон
        const index = this._activeModals.indexOf(modalId);
        if (index !== -1) {
            this._activeModals.splice(index, 1);
        }
    }

    /**
     * Закриття всіх відкритих модальних вікон
     */
    closeAllModals() {
        // Копіюємо масив, щоб уникнути проблем з ітерацією при змінах
        const activeModals = [...this._activeModals];

        activeModals.forEach(modalId => {
            this.closeModal(modalId);
        });
    }
}

// Створюємо екземпляр класу
const raffleModals = new RaffleModals();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.modals = raffleModals;

export default raffleModals;