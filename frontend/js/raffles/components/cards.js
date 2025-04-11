/**
 * Компоненти для відображення карток розіграшів
 */

import WinixRaffles from '../globals.js';
import { formatTimeLeft, calculateProgressByTime, generatePrizeDistributionHTML } from '../utils/formatters.js';
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

        // Підписуємося на події для взаємодії з іншими модулями
        this._setupEventListeners();
    }

    /**
     * Підписка на події
     * @private
     */
    _setupEventListeners() {
        // Підписуємося на подію для бонусу новачка
        WinixRaffles.events.on('display-bonus-claimed', (data) => {
            if (data && data.element) {
                this._showBonusClaimed(data.element, data.container);
            }
        });
    }

    /**
     * Відображення отриманого бонусу
     * @param {HTMLElement} button - Кнопка бонусу
     * @param {HTMLElement} container - Контейнер елементу бонусу
     * @private
     */
    _showBonusClaimed(button, container) {
        if (button) {
            button.textContent = 'Отримано';
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'default';
        }

        if (container) {
            markElement(container);
        }
    }

    /**
     * Відображення основного розіграшу
     * @param {HTMLElement} container - Контейнер для відображення
     * @param {Object} raffle - Дані розіграшу
     */
    displayMainRaffle(container, raffle) {
        if (!container || !raffle) return;

        // Розраховуємо час, що залишився
        let timeLeftHTML = '';
        try {
            const now = new Date();
            const endTime = new Date(raffle.end_time);
            const timeLeft = endTime - now;

            if (timeLeft > 0) {
                const timeLeftData = formatTimeLeft(timeLeft);
                timeLeftHTML = `
                    <div class="timer-container">
                        <div class="timer-block">
                            <span class="timer-value" id="days">${timeLeftData.days}</span>
                            <span class="timer-label">днів</span>
                        </div>
                        <div class="timer-block">
                            <span class="timer-value" id="hours">${timeLeftData.hours}</span>
                            <span class="timer-label">год</span>
                        </div>
                        <div class="timer-block">
                            <span class="timer-value" id="minutes">${timeLeftData.minutes}</span>
                            <span class="timer-label">хв</span>
                        </div>
                    </div>
                `;
            } else {
                timeLeftHTML = `
                    <div class="timer-container">
                        <div class="timer-finished">Завершується</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error("Помилка розрахунку часу:", error);
            timeLeftHTML = `
                <div class="timer-container">
                    <div class="timer-error">Час не визначено</div>
                </div>
            `;
        }

        // Розраховуємо прогрес розіграшу
        const progressWidth = calculateProgressByTime(raffle.start_time, raffle.end_time);

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

                ${timeLeftHTML}

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
                    <div class="progress" style="width: ${progressWidth}%"></div>
                </div>

                <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">Взяти участь</button>
            </div>
        `;

        // Додаємо обробники подій
        const joinButton = container.querySelector('.join-button');
        if (joinButton) {
            joinButton.addEventListener('click', () => {
                const raffleId = joinButton.getAttribute('data-raffle-id');
                const raffleType = joinButton.getAttribute('data-raffle-type');

                // Генеруємо подію для відкриття деталей розіграшу
                WinixRaffles.events.emit('open-raffle-details', {
                    raffleId,
                    raffleType
                });
            });
        }

        // Додаємо обробник для кнопки "Поділитися"
        const shareButton = container.querySelector('#share-raffle-btn');
        if (shareButton) {
            shareButton.addEventListener('click', () => {
                const raffleId = shareButton.getAttribute('data-raffle-id');

                // Генеруємо подію для поширення розіграшу
                WinixRaffles.events.emit('share-raffle', { raffleId });
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
                const timeLeftData = formatTimeLeft(timeLeft, 'short');
                timeLeftText = `Залишилось: ${timeLeftData.text}`;
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

                // Генеруємо подію для відкриття деталей розіграшу
                WinixRaffles.events.emit('open-raffle-details', {
                    raffleId,
                    raffleType
                });
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

                // Генеруємо подію для отримання бонусу новачка
                WinixRaffles.events.emit('claim-newbie-bonus', {
                    element: button,
                    container: newbieBonus
                });
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
     * Знищення модуля
     */
    destroy() {
        // Код для видалення обробників подій і звільнення ресурсів
        console.log("🚫 RaffleCards: Модуль карток розіграшів знищено");
    }
}

// Створюємо екземпляр класу
const raffleCards = new RaffleCards();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.components = WinixRaffles.components || {};
WinixRaffles.components.displayMainRaffle = raffleCards.displayMainRaffle.bind(raffleCards);
WinixRaffles.components.createMiniRaffleElement = raffleCards.createMiniRaffleElement.bind(raffleCards);
WinixRaffles.components.addNewbieBonusElement = raffleCards.addNewbieBonusElement.bind(raffleCards);

// Для зворотної сумісності додаємо також метод знищення
WinixRaffles.components.destroy = raffleCards.destroy.bind(raffleCards);

// Експортуємо модуль
export default raffleCards;