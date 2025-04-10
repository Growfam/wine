/**
 * raffle_history.js - Модуль для відображення детальної історії розіграшів WINIX
 */

(function() {
    'use strict';

    console.log("🎮 Raffle History: Ініціалізація модуля історії розіграшів");

    // ======== ПРИВАТНІ ЗМІННІ ========
    let _isLoading = false;
    let _historyData = [];

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З API ========

    /**
     * Отримання історії розіграшів користувача
     */
    async function getRaffleHistory() {
        try {
            if (_isLoading) {
                console.log("⏳ Raffle History: Завантаження вже виконується");
                return _historyData;
            }

            _isLoading = true;
            showHistoryLoader();

            // Отримуємо дані з API
            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles-history`, 'GET');
            hideHistoryLoader();
            _isLoading = false;

            if (response.status === 'success') {
                _historyData = response.data || [];
                console.log(`✅ Raffle History: Отримано ${_historyData.length} записів історії`);
                return _historyData;
            } else {
                throw new Error(response.message || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання історії розіграшів:', error);
            hideHistoryLoader();
            _isLoading = false;
            return [];
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З UI ========

    /**
     * Відображення історії розіграшів у вибраному контейнері
     * @param {string} containerId - ID контейнера для відображення історії
     */
    async function displayHistory(containerId = 'history-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер з ID '${containerId}' не знайдено`);
            return;
        }

        // Отримуємо дані історії
        const history = await getRaffleHistory();

        // Якщо дані відсутні або порожні
        if (!history || history.length === 0) {
            container.innerHTML = createEmptyHistoryHTML();
            return;
        }

        // Розділяємо історію на виграшні розіграші та звичайні участі
        const wonRaffles = history.filter(item => item.status === 'won');
        const participatedRaffles = history.filter(item => item.status !== 'won');

        // Створюємо HTML для відображення
        let historyHTML = `
            <div class="history-stats">
                <div class="stats-item">
                    <div class="stats-value">${history.length}</div>
                    <div class="stats-label">Всього розіграшів</div>
                </div>
                <div class="stats-item">
                    <div class="stats-value">${wonRaffles.length}</div>
                    <div class="stats-label">Перемог</div>
                </div>
                <div class="stats-item">
                    <div class="stats-value">${getTotalPrizeAmount(wonRaffles)}</div>
                    <div class="stats-label">WINIX виграно</div>
                </div>
            </div>
        `;

        // Додаємо секцію "Мої перемоги" якщо є виграші
        if (wonRaffles.length > 0) {
            historyHTML += `
                <div class="history-section">
                    <h3 class="section-title">Мої перемоги</h3>
                    <div class="history-cards">
                        ${wonRaffles.map(createWinnerCardHTML).join('')}
                    </div>
                </div>
            `;
        }

        // Додаємо секцію участі
        historyHTML += `
            <div class="history-section">
                <h3 class="section-title">Історія участі</h3>
                <div class="history-cards">
                    ${participatedRaffles.length > 0 
                        ? participatedRaffles.map(createHistoryCardHTML).join('')
                        : '<div class="empty-history-section">У вас поки немає участі в розіграшах</div>'}
                </div>
            </div>
        `;

        // Вставляємо HTML в контейнер
        container.innerHTML = historyHTML;

        // Додаємо обробники подій
        addHistoryCardEventListeners();
    }

    /**
     * Створити HTML для картки перемоги
     * @param {Object} item - Дані розіграшу
     */
    function createWinnerCardHTML(item) {
        const badgeHTML = getBadgeHTML(item);

        return `
            <div class="history-card winner-card" data-raffle-id="${item.raffle_id}">
                ${badgeHTML}
                <div class="history-card-content">
                    <div class="history-card-header">
                        <div class="history-card-title">${item.title}</div>
                        <div class="history-card-date">${item.date}</div>
                    </div>
                    <div class="history-card-prize">${item.prize}</div>
                    <div class="history-card-result win-result">${item.result}</div>
                    <div class="view-details">Натисніть для деталей</div>
                </div>
            </div>
        `;
    }

    /**
     * Створити HTML для картки участі в розіграші
     * @param {Object} item - Дані розіграшу
     */
    function createHistoryCardHTML(item) {
        const badgeHTML = getBadgeHTML(item);

        return `
            <div class="history-card" data-raffle-id="${item.raffle_id}">
                ${badgeHTML}
                <div class="history-card-content">
                    <div class="history-card-header">
                        <div class="history-card-title">${item.title}</div>
                        <div class="history-card-date">${item.date}</div>
                    </div>
                    <div class="history-card-prize">${item.prize}</div>
                    <div class="history-card-result">${item.result}</div>
                    <div class="history-card-entry">Використано жетонів: ${item.entry_count}</div>
                    <div class="view-details">Натисніть для деталей</div>
                </div>
            </div>
        `;
    }

    /**
     * Створити HTML для пустої історії
     */
    function createEmptyHistoryHTML() {
        return `
            <div class="empty-history">
                <div class="empty-history-icon">🎮</div>
                <h3>Історія розіграшів порожня</h3>
                <p>Ви ще не брали участі в розіграшах WINIX. Спробуйте свою удачу вже сьогодні!</p>
                <button class="join-raffle-btn" onclick="window.location.href='raffles.html'">Перейти до розіграшів</button>
            </div>
        `;
    }

    /**
     * Отримати HTML для бейджа розіграшу
     * @param {Object} item - Дані розіграшу
     */
    function getBadgeHTML(item) {
        if (item.status === 'won') {
            return `<div class="history-card-badge winner-badge">Перемога</div>`;
        } else if (item.is_daily) {
            return `<div class="history-card-badge daily-badge">Щоденний</div>`;
        }
        return '';
    }

    /**
     * Отримати загальну суму виграшів
     * @param {Array} wonRaffles - Масив виграних розіграшів
     */
    function getTotalPrizeAmount(wonRaffles) {
        let total = 0;

        wonRaffles.forEach(raffle => {
            // Витягуємо числову суму з рядка призу
            const match = raffle.prize.match(/\d+(\.\d+)?/);
            if (match) {
                total += parseFloat(match[0]);
            }
        });

        return total.toLocaleString('uk-UA');
    }

    /**
     * Додати обробники подій для карток історії
     */
    function addHistoryCardEventListeners() {
        document.querySelectorAll('.history-card').forEach(card => {
            card.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const historyItem = _historyData.find(item => item.raffle_id === raffleId);

                if (historyItem) {
                    showRaffleDetailsModal(historyItem);
                }
            });
        });
    }

    /**
     * Показати модальне вікно з деталями розіграшу
     * @param {Object} raffleData - Дані розіграшу
     */
    function showRaffleDetailsModal(raffleData) {
        // Видаляємо існуюче модальне вікно, якщо воно є
        let existingModal = document.getElementById('raffle-history-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.id = 'raffle-history-modal';
        modal.className = 'raffle-modal';

        // Генеруємо HTML для переможців
        const winnersHTML = generateWinnersListHTML(raffleData.winners);

        // Визначаємо статус і клас статусу
        const statusClass = raffleData.status === 'won' ? 'win-status' : 'participated-status';
        const statusText = raffleData.status === 'won' ? 'Ви перемогли' : 'Участь без перемоги';

        // Визначаємо тип розіграшу
        const raffleType = raffleData.is_daily ? 'Щоденний розіграш' : 'Гранд розіграш';

        // Формуємо HTML для модального вікна
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${raffleData.title}</h2>
                    <span class="modal-close">×</span>
                </div>
                
                <div class="raffle-details-info">
                    <div class="detail-row">
                        <div class="detail-label">Дата:</div>
                        <div class="detail-value">${raffleData.date}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Тип:</div>
                        <div class="detail-value">${raffleType}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Призовий фонд:</div>
                        <div class="detail-value prize-value">${raffleData.prize}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Ваш результат:</div>
                        <div class="detail-value ${statusClass}">${statusText}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Використано жетонів:</div>
                        <div class="detail-value">${raffleData.entry_count}</div>
                    </div>
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
            closeButton.addEventListener('click', function() {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            });
        }

        const closeActionButton = modal.querySelector('#close-history-btn');
        if (closeActionButton) {
            closeActionButton.addEventListener('click', function() {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            });
        }

        // Показуємо модальне вікно
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });

        return modal;
    }

    /**
     * Генерування HTML для списку переможців
     * @param {Array} winners - Масив переможців
     */
    function generateWinnersListHTML(winners) {
        if (!winners || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        return winners.map(winner => {
            // Визначаємо клас для місця (top-1, top-2, top-3)
            const placeClass = winner.place <= 3 ? `top-${winner.place}` : '';
            const bgColor = winner.place === 1 ? 'linear-gradient(145deg, #FFD700, #FFA500)' :
                            winner.place === 2 ? 'linear-gradient(145deg, #C0C0C0, #A9A9A9)' :
                            winner.place === 3 ? 'linear-gradient(145deg, #CD7F32, #A0522D)' :
                            'rgba(0, 0, 0, 0.3)';
            const boxShadow = winner.place <= 3 ?
                            `box-shadow: 0 0 8px ${winner.place === 1 ? 'rgba(255, 215, 0, 0.5)' : 
                                          winner.place === 2 ? 'rgba(192, 192, 192, 0.5)' : 
                                          'rgba(205, 127, 50, 0.5)'};` : '';

            // Визначаємо, чи це поточний користувач
            const currentUserClass = winner.isCurrentUser ? 'current-user' : '';

            // Формуємо HTML для одного переможця
            return `
                <div class="winner-item ${currentUserClass}" ${winner.isCurrentUser ? 'title="Це ви!"' : ''}>
                    <div class="winner-place" style="background: ${bgColor}; ${boxShadow}">
                        <span>${winner.place}</span>
                    </div>
                    <div class="winner-info">
                        <div class="winner-name">${winner.username}</div>
                        <div class="winner-id">ID: ${winner.userId}</div>
                    </div>
                    <div class="winner-prize">${winner.prize}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Показати індикатор завантаження для історії
     */
    function showHistoryLoader() {
        const container = document.getElementById('history-container');
        if (!container) return;

        // Перевіряємо, чи вже є лоадер
        let loader = container.querySelector('.history-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'history-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <div class="loader-text">Завантаження історії...</div>
            `;
            container.innerHTML = '';
            container.appendChild(loader);
        }
    }

    /**
     * Приховати індикатор завантаження для історії
     */
    function hideHistoryLoader() {
        const container = document.getElementById('history-container');
        if (!container) return;

        const loader = container.querySelector('.history-loader');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Додати стилі для історії розіграшів
     */
    function addHistoryStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* Стилі для історії розіграшів */
            .history-stats {
                display: flex;
                justify-content: space-between;
                margin-bottom: 1.5rem;
                background: var(--bg-card);
                border-radius: var(--card-border-radius);
                padding: 1rem;
                box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.3);
            }
            
            .stats-item {
                text-align: center;
                flex: 1;
            }
            
            .stats-value {
                font-size: 1.5rem;
                font-weight: bold;
                color: var(--text-color);
                margin-bottom: 0.25rem;
            }
            
            .stats-label {
                font-size: 0.75rem;
                color: var(--text-secondary);
            }
            
            .history-section {
                margin-bottom: 2rem;
            }
            
            .section-title {
                font-size: 1.25rem;
                font-weight: bold;
                margin-bottom: 1rem;
                color: var(--text-color);
                text-shadow: 0 0 5px rgba(0, 201, 167, 0.3);
            }
            
            .history-cards {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 1rem;
            }
            
            .history-card {
                background: var(--bg-item);
                border-radius: var(--item-border-radius);
                overflow: hidden;
                position: relative;
                box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.3);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                cursor: pointer;
            }
            
            .history-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);
            }
            
            .history-card-badge {
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                font-weight: bold;
                z-index: 1;
            }
            
            .winner-badge {
                background: rgba(255, 215, 0, 0.2);
                color: rgb(255, 215, 0);
            }
            
            .daily-badge {
                background: rgba(33, 150, 243, 0.2);
                color: rgba(33, 150, 243, 1);
            }
            
            .winner-card {
                background: linear-gradient(145deg, rgba(26, 26, 46, 0.9), rgba(15, 52, 96, 0.9));
                border: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            .history-card-content {
                padding: 1rem;
            }
            
            .history-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 0.5rem;
            }
            
            .history-card-title {
                font-weight: bold;
                color: var(--text-color);
                margin-right: 0.5rem;
            }
            
            .history-card-date {
                font-size: 0.75rem;
                color: var(--text-secondary);
                white-space: nowrap;
            }
            
            .history-card-prize {
                font-size: 1.25rem;
                font-weight: bold;
                color: var(--premium-color);
                margin-bottom: 0.5rem;
            }
            
            .history-card-result {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin-bottom: 0.5rem;
            }
            
            .win-result {
                color: var(--premium-color);
                font-weight: bold;
            }
            
            .history-card-entry {
                font-size: 0.75rem;
                color: var(--text-secondary);
                margin-bottom: 0.5rem;
            }
            
            .view-details {
                font-size: 0.75rem;
                color: rgba(0, 201, 167, 0.7);
                text-align: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .history-card:hover .view-details {
                opacity: 1;
            }
            
            .empty-history {
                text-align: center;
                padding: 2rem 1rem;
                background: var(--bg-card);
                border-radius: var(--card-border-radius);
                box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.3);
            }
            
            .empty-history-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                animation: pulse 2s infinite ease-in-out;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 0.7; }
            }
            
            .empty-history h3 {
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
                color: var(--text-color);
            }
            
            .empty-history p {
                color: var(--text-secondary);
                margin-bottom: 1.5rem;
            }
            
            .join-raffle-btn {
                background: linear-gradient(90deg, #2D6EB6, #52C0BD);
                border: none;
                border-radius: 1.25rem;
                padding: 0.75rem 1.5rem;
                color: white;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.3);
            }
            
            .join-raffle-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);
            }
            
            .empty-history-section {
                text-align: center;
                padding: 1.5rem;
                background: rgba(0, 0, 0, 0.2);
                border-radius: var(--item-border-radius);
                color: var(--text-secondary);
            }
            
            /* Стилі для модального вікна з деталями розіграшу */
            .raffle-details-info {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 0.75rem;
                padding: 1rem;
                margin-bottom: 1.5rem;
            }
            
            .detail-row {
                display: flex;
                margin-bottom: 0.75rem;
            }
            
            .detail-row:last-child {
                margin-bottom: 0;
            }
            
            .detail-label {
                width: 40%;
                font-size: 0.875rem;
                color: var(--text-secondary);
            }
            
            .detail-value {
                width: 60%;
                font-size: 0.875rem;
                color: var(--text-color);
                font-weight: bold;
            }
            
            .prize-value {
                color: var(--premium-color);
            }
            
            .win-status {
                color: var(--premium-color);
            }
            
            .participated-status {
                color: var(--text-secondary);
            }
            
            .winners-container {
                margin-bottom: 1.5rem;
            }
            
            .winners-container h3 {
                font-size: 1.125rem;
                margin-bottom: 1rem;
                color: var(--text-color);
            }
            
            .winners-list {
                max-height: 280px;
                overflow-y: auto;
                padding-right: 0.5rem;
            }
            
            .winner-item {
                display: flex;
                align-items: center;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 0.5rem;
                padding: 0.75rem;
                margin-bottom: 0.5rem;
            }
            
            .winner-item.current-user {
                background: rgba(0, 201, 167, 0.2);
                border: 1px solid rgba(0, 201, 167, 0.3);
            }
            
            .winner-place {
                width: 2rem;
                height: 2rem;
                min-width: 2rem;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-right: 0.75rem;
                font-weight: bold;
                color: white;
            }
            
            .winner-info {
                flex: 1;
            }
            
            .winner-name {
                font-weight: bold;
                color: var(--text-color);
                margin-bottom: 0.25rem;
            }
            
            .current-user .winner-name {
                color: var(--premium-color);
            }
            
            .winner-id {
                font-size: 0.75rem;
                color: var(--text-secondary);
            }
            
            .winner-prize {
                font-weight: bold;
                color: var(--premium-color);
                white-space: nowrap;
                margin-left: 0.5rem;
            }
            
            .no-winners {
                text-align: center;
                padding: 1.5rem;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 0.5rem;
                color: var(--text-secondary);
            }
            
            /* Стилі для лоадера */
            .history-loader {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
            }
            
            .loader-spinner {
                width: 3rem;
                height: 3rem;
                border: 0.25rem solid rgba(0, 201, 167, 0.3);
                border-top: 0.25rem solid var(--secondary-color);
                border-radius: 50%;
                animation: spinner 1s linear infinite;
                margin-bottom: 1rem;
            }
            
            .loader-text {
                color: var(--text-secondary);
            }
            
            @keyframes spinner {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Медіа-запити для адаптивності */
            @media (max-width: 768px) {
                .history-cards {
                    grid-template-columns: 1fr;
                }
                
                .history-stats {
                    flex-direction: row;
                    flex-wrap: wrap;
                }
                
                .stats-item {
                    flex-basis: 33%;
                    margin-bottom: 0.5rem;
                }
            }
            
            @media (max-width: 480px) {
                .history-card-header {
                    flex-direction: column;
                }
                
                .history-card-date {
                    margin-top: 0.25rem;
                }
                
                .detail-row {
                    flex-direction: column;
                }
                
                .detail-label, .detail-value {
                    width: 100%;
                }
                
                .detail-label {
                    margin-bottom: 0.25rem;
                }
                
                .winner-item {
                    flex-wrap: wrap;
                }
                
                .winner-prize {
                    width: 100%;
                    margin-left: 2.75rem;
                    margin-top: 0.5rem;
                }
            }
        `;

        document.head.appendChild(styleElement);
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація модуля історії розіграшів
     */
    function init() {
        console.log("🎮 Raffle History: Ініціалізація...");

        // Додаємо стилі
        addHistoryStyles();

        // Перевіряємо, чи є на сторінці контейнер для історії
        const historyContainer = document.getElementById('history-container');
        if (historyContainer) {
            // Автоматично відображаємо історію
            displayHistory('history-container');
        }

        console.log("✅ Raffle History: Ініціалізацію завершено");
    }

    // Експортуємо публічний API
    window.RaffleHistory = {
        init,
        displayHistory,
        getRaffleHistory,
        showRaffleDetailsModal
    };

    // Ініціалізуємо модуль при завантаженні документа
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();