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
        if (WinixRaffles && WinixRaffles.events) {
            WinixRaffles.events.on('display-bonus-claimed', (data) => {
                if (data && data.element) {
                    this._showBonusClaimed(data.element, data.container);
                }
            });
        }
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

        if (container && typeof markElement === 'function') {
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
            // Перевіряємо наявність end_time та його валідність
            if (!raffle.end_time) {
                throw new Error("Відсутня дата завершення розіграшу");
            }

            const now = new Date();
            const endTime = new Date(raffle.end_time);

            // Перевіряємо, чи є endTime валідним об'єктом Date
            if (isNaN(endTime.getTime())) {
                throw new Error("Невалідна дата завершення розіграшу");
            }

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
        let progressWidth = 0;
        try {
            // Перевіряємо наявність start_time та end_time
            if (raffle.start_time && raffle.end_time) {
                progressWidth = calculateProgressByTime(raffle.start_time, raffle.end_time);
            }
        } catch (error) {
            console.error("Помилка розрахунку прогресу:", error);
        }

        // Перевіряємо наявність необхідних полів
        const title = raffle.title || 'Розіграш';
        const entryFee = raffle.entry_fee || 0;
        const prizeAmount = raffle.prize_amount || 0;
        const prizeCurrency = raffle.prize_currency || 'WINIX';
        const winnersCount = raffle.winners_count || 1;
        const participantsCount = raffle.participants_count || 0;
        const imageUrl = raffle.image_url || '/assets/prize-poster.gif';
        const raffleId = raffle.id || 'unknown';

        // Безпечно отримуємо дані для розподілу призів
        let prizeDistributionHTML = '';
        try {
            if (raffle.prize_distribution && typeof raffle.prize_distribution === 'object') {
                prizeDistributionHTML = generatePrizeDistributionHTML(raffle.prize_distribution);
            } else {
                prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
            }
        } catch (error) {
            console.error("Помилка генерації розподілу призів:", error);
            prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Помилка відображення</span></div>';
        }

        // Створюємо HTML для основного розіграшу
        container.innerHTML = `
            <img class="main-raffle-image" src="${imageUrl}" alt="${title}">
            <div class="main-raffle-content">
                <div class="main-raffle-header">
                    <h3 class="main-raffle-title">${title}</h3>
                    <div class="main-raffle-cost">
                        <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
                        <span>${entryFee} жетон${entryFee !== 1 ? 'и' : ''}</span>
                    </div>
                </div>

                <span class="main-raffle-prize">${prizeAmount} ${prizeCurrency}</span>

                ${timeLeftHTML}

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
        miniRaffle.setAttribute('data-raffle-id', raffle.id || 'unknown');

        // Розраховуємо час, що залишився
        let timeLeftText = '';
        try {
            // Перевіряємо наявність end_time та його валідність
            if (!raffle.end_time) {
                throw new Error("Відсутня дата завершення розіграшу");
            }

            const now = new Date();
            const endTime = new Date(raffle.end_time);

            // Перевіряємо, чи є endTime валідним об'єктом Date
            if (isNaN(endTime.getTime())) {
                throw new Error("Невалідна дата завершення розіграшу");
            }

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
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
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
                        if (typeof markElement === 'function') {
                            markElement(newbieBonus);
                        }
                    }
                }).catch(err => {
                    console.error("Помилка перевірки статусу бонусу:", err);
                });
            }
        } catch (error) {
            console.error("Критична помилка при перевірці статусу бонусу:", error);
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
if (WinixRaffles) {
    WinixRaffles.components = WinixRaffles.components || {};
    WinixRaffles.components.displayMainRaffle = raffleCards.displayMainRaffle.bind(raffleCards);
    WinixRaffles.components.createMiniRaffleElement = raffleCards.createMiniRaffleElement.bind(raffleCards);
    WinixRaffles.components.addNewbieBonusElement = raffleCards.addNewbieBonusElement.bind(raffleCards);

    // Для зворотної сумісності додаємо також метод знищення
    WinixRaffles.components.destroy = raffleCards.destroy.bind(raffleCards);
}

// Експортуємо модуль
export default raffleCards;