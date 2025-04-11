/**
 * Компоненти для відображення карток розіграшів
 */

import WinixRaffles from '../globals.js';
import { formatDate, formatPlaces } from '../utils/formatters.js';
import { markElement, showToast } from '../utils/ui-helpers.js';

/**
 * Клас з компонентами для відображення карток розіграшів
 */
class RaffleCards {
    /**
     * Ініціалізація модуля карток
     */
    constructor() {
        console.log("🎮 WINIX Raffles: Ініціалізація компонентів карток");
    }

    /**
     * Відображення основного розіграшу
     * @param {HTMLElement} container - Контейнер для відображення
     * @param {Object} raffle - Дані розіграшу
     */
    displayMainRaffle(container, raffle) {
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
                        ${this.generatePrizeDistributionHTML(raffle.prize_distribution)}
                    </div>
                </div>

                <div class="main-raffle-participants">
                    <div class="participants-info">Учасників: <span class="participants-count">${raffle.participants_count || 0}</span></div>
                    <div class="share-container">
                        <button class="share-button" id="share-raffle-btn" data-raffle-id="${raffle.id}">Поділитися</button>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress" style="width: ${this.calculateProgressWidth(raffle)}%"></div>
                </div>

                <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">Взяти участь</button>
            </div>
        `;

        // Оновлюємо таймер
        if (WinixRaffles.active && typeof WinixRaffles.active._updateRaffleTimers === 'function') {
            WinixRaffles.active._updateRaffleTimers();
        }

        // Додаємо обробники подій
        const joinButton = container.querySelector('.join-button');
        if (joinButton) {
            joinButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                if (WinixRaffles.participation && typeof WinixRaffles.participation.openRaffleDetails === 'function') {
                    WinixRaffles.participation.openRaffleDetails(raffleId, raffleType);
                }
            });
        }

        // Додаємо обробник для кнопки "Поділитися"
        const shareButton = container.querySelector('#share-raffle-btn');
        if (shareButton) {
            shareButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
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
     */
    createMiniRaffleElement(raffle) {
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
                if (WinixRaffles.participation && typeof WinixRaffles.participation.openRaffleDetails === 'function') {
                    WinixRaffles.participation.openRaffleDetails(raffleId, raffleType);
                }
            });
        }

        return miniRaffle;
    }

    /**
     * Додавання елементу бонусу новачка
     * @param {HTMLElement} container - Контейнер для додавання
     */
    addNewbieBonusElement(container) {
        if (!container) return;

        const newbieBonus = document.createElement('div');
        newbieBonus.className = 'mini-raffle';
        newbieBonus.setAttribute('data-raffle-id', 'newbie');

        newbieBonus.innerHTML = `
            <div class="mini-raffle-info">
                <div class="mini-raffle-title">Бонус новачка</div>
                <div class="mini-raffle-cost">
                    <img class="token-icon" src="./assets/token-icon.png" alt="Жетон">
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
                        markElement(newbieBonus);

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
                        markElement(newbieBonus);
                    } else {
                        showToast(result.message || 'Помилка отримання бонусу');
                    }
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
                    markElement(newbieBonus);
                }
            }).catch(err => {
                console.error("Помилка перевірки статусу бонусу:", err);
            });
        }
    }

    /**
     * Генерація HTML для розподілу призів
     * @param {Object} prizeDistribution - Об'єкт з розподілом призів
     * @returns {string} - HTML-розмітка
     */
    generatePrizeDistributionHTML(prizeDistribution) {
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
     * Розрахунок ширини прогрес-бару
     * @param {Object} raffle - Дані розіграшу
     * @returns {number} - Ширина прогрес-бару
     */
    calculateProgressWidth(raffle) {
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
const raffleCards = new RaffleCards();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.components = WinixRaffles.components || {};
WinixRaffles.components.displayMainRaffle = raffleCards.displayMainRaffle.bind(raffleCards);
WinixRaffles.components.createMiniRaffleElement = raffleCards.createMiniRaffleElement.bind(raffleCards);
WinixRaffles.components.addNewbieBonusElement = raffleCards.addNewbieBonusElement.bind(raffleCards);
WinixRaffles.components.generatePrizeDistributionHTML = raffleCards.generatePrizeDistributionHTML.bind(raffleCards);
WinixRaffles.components.calculateProgressWidth = raffleCards.calculateProgressWidth.bind(raffleCards);

// Експортуємо модуль
export default raffleCards;