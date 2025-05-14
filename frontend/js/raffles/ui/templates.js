/**
 * WINIX - Система розіграшів (templates.js)
 * Модуль з шаблонами та генераторами HTML для відображення розіграшів
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше templates.js');
        return;
    }

    // Підмодуль шаблонів
    const templates = {
        // Форматування чисел з розділювачами розрядів
        formatNumber: function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        // Форматування дати
        formatDate: function(date) {
            if (!(date instanceof Date)) {
                date = new Date(date);
            }

            if (isNaN(date.getTime())) {
                return 'Невідома дата';
            }

            return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
        },

        // Форматування часу
        formatTime: function(date) {
            if (!(date instanceof Date)) {
                date = new Date(date);
            }

            if (isNaN(date.getTime())) {
                return '00:00';
            }

            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        },

        // Форматування дати та часу
        formatDateTime: function(date) {
            return `${this.formatDate(date)} ${this.formatTime(date)}`;
        },

        // Форматування часу до завершення
        formatTimeLeft: function(endTime) {
            const now = new Date();
            const end = new Date(endTime);
            const diff = end - now;

            // Якщо час вийшов, повертаємо "Завершено"
            if (diff <= 0) {
                return 'Завершено';
            }

            // Розрахунок днів, годин, хвилин
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            // Форматування результату
            if (days > 0) {
                return `${days} дн. ${hours} год.`;
            } else if (hours > 0) {
                return `${hours} год. ${minutes} хв.`;
            } else {
                return `${minutes} хв.`;
            }
        },

        // Шаблон для головного розіграшу
        mainRaffleTemplate: function(raffle) {
            if (!raffle) return '';

            const endTime = new Date(raffle.end_time);
            const progress = Math.min(Math.round((raffle.participants_count / (raffle.max_participants || 1000)) * 100), 100);

            return `
                <img src="${raffle.image_url || 'assets/prize-poster.gif'}" alt="${raffle.title}" class="main-raffle-image">
                <div class="main-raffle-content">
                    <div class="main-raffle-header">
                        <h3 class="main-raffle-title">${raffle.title}</h3>
                        <div class="main-raffle-cost">
                            <img src="assets/token-icon.png" alt="Жетони" class="token-icon">
                            <span>${raffle.entry_fee}</span>
                        </div>
                    </div>

                    <div class="main-raffle-prize">Призовий фонд: ${this.formatNumber(raffle.prize_amount)} ${raffle.prize_currency}</div>

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
                            Учасників: <span class="participants-count">${this.formatNumber(raffle.participants_count)}</span>
                        </div>
                        <div class="participants-info">
                            Переможців: <span class="participants-count">${raffle.winners_count}</span>
                        </div>
                    </div>

                    <div class="progress-bar">
                        <div class="progress" style="width: ${progress}%"></div>
                    </div>

                    <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="main">
                        Взяти участь за ${raffle.entry_fee} жетони
                    </button>
                </div>
            `;
        },

        // Шаблон для міні-розіграшу
        miniRaffleTemplate: function(raffle) {
            if (!raffle) return '';

            // Форматування часу завершення
            const endTime = new Date(raffle.end_time);
            const now = new Date();
            const isToday = endTime.getDate() === now.getDate() &&
                            endTime.getMonth() === now.getMonth() &&
                            endTime.getFullYear() === now.getFullYear();

            const endTimeText = isToday
                ? `сьогодні о ${this.formatTime(endTime)}`
                : `${this.formatDate(endTime)} о ${this.formatTime(endTime)}`;

            return `
                <div class="mini-raffle-info">
                    <h3 class="mini-raffle-title">${raffle.title}</h3>
                    <div class="mini-raffle-cost">
                        <img src="assets/token-icon.png" alt="Жетони" class="token-icon">
                        <span>${raffle.entry_fee}</span>
                    </div>
                    <div class="mini-raffle-prize">Приз: ${this.formatNumber(raffle.prize_amount)} ${raffle.prize_currency}</div>
                    <div class="mini-raffle-time">Завершення: ${endTimeText}</div>
                </div>
                <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-raffle-type="daily">Взяти участь</button>
            `;
        },

        // Шаблон для пустого стану активних розіграшів
        emptyActiveRafflesTemplate: function() {
            return `
                <div class="main-raffle">
                    <div class="main-raffle-content">
                        <h3 class="main-raffle-title">На даний момент немає активних розіграшів</h3>
                        <div class="main-raffle-prize">Незабаром буде опубліковано нові розіграші</div>
                        <div class="timer-container">
                            <div class="timer-block">
                                <div class="timer-value">--</div>
                                <div class="timer-label">Дні</div>
                            </div>
                            <div class="timer-block">
                                <div class="timer-value">--</div>
                                <div class="timer-label">Години</div>
                            </div>
                            <div class="timer-block">
                                <div class="timer-value">--</div>
                                <div class="timer-label">Хвилини</div>
                            </div>
                            <div class="timer-block">
                                <div class="timer-value">--</div>
                                <div class="timer-label">Секунди</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <h2 class="mini-raffles-title">Щоденні розіграші</h2>
                
                <div class="mini-raffles-container">
                    <div class="mini-raffle">
                        <div class="mini-raffle-info">
                            <h3 class="mini-raffle-title">Щоденні розіграші</h3>
                            <div class="mini-raffle-prize">На даний момент немає активних щоденних розіграшів</div>
                            <div class="mini-raffle-time">Перевірте пізніше</div>
                        </div>
                    </div>
                </div>
            `;
        },

        // Шаблон для порожньої історії розіграшів
        emptyHistoryTemplate: function() {
            return `
                <div class="history-card">
                    <div class="history-date">Історія відсутня</div>
                    <div class="history-prize">У вас ще немає історії участі в розіграшах</div>
                    <div class="history-winners">Візьміть участь у розіграшах, щоб побачити їх тут</div>
                </div>
            `;
        },

        // Шаблон для картки історії
        historyCardTemplate: function(raffle) {
            if (!raffle) return '';

            let statusText = 'Завершено';
            if (raffle.status === 'won') {
                statusText = 'Ви виграли!';
            } else if (raffle.status === 'participated') {
                statusText = 'Ви брали участь';
            }

            return `
                <div class="history-date">${raffle.date}</div>
                <div class="history-prize">${raffle.title || 'Розіграш'}: ${raffle.prize}</div>
                <div class="history-winners">${raffle.result || 'Переможці визначені'}</div>
                <div class="history-status ${raffle.status || ''}">${statusText}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            `;
        },

        // Шаблон для деталей розіграшу
        raffleDetailsTemplate: function(raffle) {
            if (!raffle) return '';

            // Формування списку переможців
            let winnersHtml = '';
            if (raffle.winners && raffle.winners.length > 0) {
                winnersHtml = `
                    <div class="winners-list">
                        <h4>Переможці розіграшу:</h4>
                        <ul>
                            ${raffle.winners.map(winner => `
                                <li class="${winner.isCurrentUser ? 'current-user' : ''}">
                                    ${winner.place}. ${winner.username} - ${winner.prize}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }

            return `
                <div class="raffle-details-modal">
                    <h3>${raffle.title || 'Розіграш'}</h3>
                    <div class="raffle-info">
                        <p><strong>Дата:</strong> ${raffle.date}</p>
                        <p><strong>Призовий фонд:</strong> ${raffle.prize}</p>
                        <p><strong>Ваша участь:</strong> ${raffle.entry_count || 1} жетонів</p>
                        <p><strong>Результат:</strong> ${raffle.result || 'Розіграш завершено'}</p>
                    </div>
                    ${winnersHtml}
                </div>
            `;
        },

        // Шаблон для статистики
        statisticsTemplate: function(stats) {
            if (!stats) return '';

            // Отримання значень статистики з безпечними значеннями за замовчуванням
            const participated = stats.participations_count || 0;
            const wins = stats.wins_count || 0;
            const winixWon = stats.total_winnings || 0;
            const tokensSpent = stats.tokens_spent || participated * 2;

            return `
                <div class="statistics-container">
                    <div class="statistics-title">Ваша статистика участі</div>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value" id="total-participated">${this.formatNumber(participated)}</div>
                            <div class="stat-label">Участь у розіграшах</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="total-wins">${this.formatNumber(wins)}</div>
                            <div class="stat-label">Виграші</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="total-winix-won">${this.formatNumber(winixWon)}</div>
                            <div class="stat-label">WINIX виграно</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="total-tokens-spent">${this.formatNumber(tokensSpent)}</div>
                            <div class="stat-label">Витрачено жетонів</div>
                        </div>
                    </div>
                </div>
            `;
        },

        // Оновлення елемента статистики
        updateStatElement: function(id, value) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = this.formatNumber(value);

                // Додаємо анімацію оновлення
                element.classList.add('stat-updated');
                setTimeout(() => {
                    element.classList.remove('stat-updated');
                }, 1000);
            }
        }
    };

    // Додаємо модуль шаблонів до основного модуля розіграшів
    WinixRaffles.templates = templates;

    // Ініціалізація стилів для анімацій
    const addTemplateStyles = function() {
        const style = document.createElement('style');
        style.textContent = `
            /* Анімація оновлення статистики */
            @keyframes stat-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .stat-updated {
                animation: stat-pulse 0.5s ease-in-out;
                transition: color 0.3s ease;
                color: var(--premium-color) !important;
            }
        `;

        document.head.appendChild(style);
    };

    // Додаємо стилі при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', addTemplateStyles);

    console.log('📝 Модуль шаблонів успішно ініціалізовано');
})();