/**
 * raffle_history.js - Модуль для відображення детальної історії розіграшів WINIX
 */

(function() {
    'use strict';

    console.log("📋 Raffle History: Ініціалізація модуля історії розіграшів");

    // ======== ПРИВАТНІ ЗМІННІ ========
    let _isLoading = false;
    let _historyData = [];
    let _filters = {
        type: 'all', // 'all', 'daily', 'main'
        status: 'all', // 'all', 'won', 'participated'
        period: 'all' // 'all', 'week', 'month', 'year'
    };

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З API ========

    /**
     * Отримання історії розіграшів користувача
     * @param {Object} filters - Фільтри для історії
     */
    async function getRaffleHistory(filters = {}) {
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

            // Формуємо параметри запиту
            let queryParams = '';
            if (filters.type && filters.type !== 'all') {
                queryParams += `&type=${filters.type}`;
            }
            if (filters.status && filters.status !== 'all') {
                queryParams += `&status=${filters.status}`;
            }
            if (filters.period && filters.period !== 'all') {
                queryParams += `&period=${filters.period}`;
            }

            // Додаємо параметри до URL, якщо вони є
            const url = queryParams
                ? `/api/user/${userId}/raffles-history?${queryParams.substring(1)}`
                : `/api/user/${userId}/raffles-history`;

            const response = await window.WinixAPI.apiRequest(url, 'GET');

            hideHistoryLoader();
            _isLoading = false;

            if (response && response.status === 'success') {
                // Перевіряємо, що отримані дані - це масив
                if (!Array.isArray(response.data)) {
                    console.warn("Отримано некоректні дані історії:", response.data);
                    _historyData = [];
                    return _historyData;
                }

                _historyData = response.data;
                console.log(`✅ Raffle History: Отримано ${_historyData.length} записів історії`);

                // Зберігаємо поточні фільтри
                _filters = { ...filters };

                return _historyData;
            } else {
                throw new Error((response && response.message) || 'Помилка отримання історії розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання історії розіграшів:', error);
            hideHistoryLoader();
            _isLoading = false;
            showHistoryError('Не вдалося завантажити історію розіграшів');
            // Гарантуємо, що повертаємо масив
            _historyData = [];
            return _historyData;
        }
    }

    /**
     * Отримання детальної інформації про розіграш з історії
     * @param {string} raffleId - ID розіграшу
     */
    async function getRaffleHistoryDetails(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            showHistoryLoader();
            const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/raffles-history/${raffleId}`, 'GET');
            hideHistoryLoader();

            if (response && response.status === 'success') {
                return response.data;
            } else {
                throw new Error((response && response.message) || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
            hideHistoryLoader();
            showHistoryError('Не вдалося завантажити деталі розіграшу');
            return null;
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З UI ========

    /**
     * Відображення історії розіграшів у вибраному контейнері
     * @param {string} containerId - ID контейнера для відображення історії
     * @param {Object} filters - Фільтри для історії
     */
    async function displayHistory(containerId = 'history-container', filters = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер з ID '${containerId}' не знайдено`);
            return;
        }

        // Встановлюємо фільтри за замовчуванням, якщо не передані
        const currentFilters = {
            type: filters.type || _filters.type,
            status: filters.status || _filters.status,
            period: filters.period || _filters.period
        };

        try {
            // Отримуємо дані історії з фільтрами
            const history = await getRaffleHistory(currentFilters);

            // Якщо дані відсутні або порожні
            if (!history || !Array.isArray(history) || history.length === 0) {
                container.innerHTML = createEmptyHistoryHTML();
                return;
            }

            // Розділяємо історію на виграшні розіграші та звичайні участі
            let wonRaffles = [];
            let participatedRaffles = [];

            try {
                wonRaffles = history.filter(item => item && item.status === 'won');
                participatedRaffles = history.filter(item => item && item.status !== 'won');
            } catch (error) {
                console.error("Помилка при фільтрації історії:", error);
                container.innerHTML = createEmptyHistoryHTML('Помилка обробки даних. Спробуйте оновити сторінку.');
                return;
            }

            // Створюємо HTML для відображення
            let historyHTML = `
                <div class="history-filters">
                    <div class="filter-group">
                        <label>Тип:</label>
                        <select id="history-type-filter">
                            <option value="all" ${currentFilters.type === 'all' ? 'selected' : ''}>Усі типи</option>
                            <option value="daily" ${currentFilters.type === 'daily' ? 'selected' : ''}>Щоденні</option>
                            <option value="main" ${currentFilters.type === 'main' ? 'selected' : ''}>Джекпоти</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Статус:</label>
                        <select id="history-status-filter">
                            <option value="all" ${currentFilters.status === 'all' ? 'selected' : ''}>Усі статуси</option>
                            <option value="won" ${currentFilters.status === 'won' ? 'selected' : ''}>Перемоги</option>
                            <option value="participated" ${currentFilters.status === 'participated' ? 'selected' : ''}>Участь</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Період:</label>
                        <select id="history-period-filter">
                            <option value="all" ${currentFilters.period === 'all' ? 'selected' : ''}>Весь час</option>
                            <option value="week" ${currentFilters.period === 'week' ? 'selected' : ''}>Тиждень</option>
                            <option value="month" ${currentFilters.period === 'month' ? 'selected' : ''}>Місяць</option>
                            <option value="year" ${currentFilters.period === 'year' ? 'selected' : ''}>Рік</option>
                        </select>
                    </div>
                </div>

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
            if (wonRaffles.length > 0 && (currentFilters.status === 'all' || currentFilters.status === 'won')) {
                historyHTML += `
                    <div class="history-section">
                        <h3 class="section-title">Мої перемоги</h3>
                        <div class="history-cards">
                            ${wonRaffles.map(createWinnerCardHTML).join('')}
                        </div>
                    </div>
                `;
            }

            // Додаємо секцію участі, якщо відповідає фільтру
            if (participatedRaffles.length > 0 && (currentFilters.status === 'all' || currentFilters.status === 'participated')) {
                historyHTML += `
                    <div class="history-section">
                        <h3 class="section-title">Історія участі</h3>
                        <div class="history-cards">
                            ${participatedRaffles.map(createHistoryCardHTML).join('')}
                        </div>
                    </div>
                `;
            }

            // Вставляємо HTML в контейнер
            container.innerHTML = historyHTML;

            // Додаємо обробники подій для фільтрів
            document.getElementById('history-type-filter')?.addEventListener('change', function() {
                applyHistoryFilters(containerId);
            });

            document.getElementById('history-status-filter')?.addEventListener('change', function() {
                applyHistoryFilters(containerId);
            });

            document.getElementById('history-period-filter')?.addEventListener('change', function() {
                applyHistoryFilters(containerId);
            });

            // Додаємо обробники подій для карток історії
            addHistoryCardEventListeners();
        } catch (error) {
            console.error("Помилка відображення історії:", error);
            container.innerHTML = createEmptyHistoryHTML('Щось пішло не так. Спробуйте оновити сторінку.');
        }
    }

    /**
     * Застосування фільтрів історії
     * @param {string} containerId - ID контейнера для відображення
     */
    function applyHistoryFilters(containerId) {
        const typeFilter = document.getElementById('history-type-filter')?.value || 'all';
        const statusFilter = document.getElementById('history-status-filter')?.value || 'all';
        const periodFilter = document.getElementById('history-period-filter')?.value || 'all';

        // Оновлюємо відображення з новими фільтрами
        displayHistory(containerId, {
            type: typeFilter,
            status: statusFilter,
            period: periodFilter
        });
    }

    /**
     * Створити HTML для картки перемоги
     * @param {Object} item - Дані розіграшу
     */
    function createWinnerCardHTML(item) {
        if (!item) return '';

        try {
            const badgeHTML = getBadgeHTML(item);
            const placeHTML = getPlaceBadgeHTML(item.place);

            return `
                <div class="history-card winner-card" data-raffle-id="${item.raffle_id}">
                    ${badgeHTML}
                    ${placeHTML}
                    <div class="history-card-content">
                        <div class="history-card-header">
                            <div class="history-card-title">${item.title || 'Розіграш'}</div>
                            <div class="history-card-date">${item.date || 'Дата не вказана'}</div>
                        </div>
                        <div class="history-card-prize">${item.prize || '0 WINIX'}</div>
                        <div class="history-card-result win-result">${item.result || 'Виграно'}</div>
                        <div class="history-card-entry">Використано жетонів: ${item.entry_count || 0}</div>
                        <div class="view-details">Натисніть для деталей</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("Помилка створення картки переможця:", error);
            return '';
        }
    }

    /**
     * Створити HTML для картки участі в розіграші
     * @param {Object} item - Дані розіграшу
     */
    function createHistoryCardHTML(item) {
        if (!item) return '';

        try {
            const badgeHTML = getBadgeHTML(item);

            return `
                <div class="history-card" data-raffle-id="${item.raffle_id}">
                    ${badgeHTML}
                    <div class="history-card-content">
                        <div class="history-card-header">
                            <div class="history-card-title">${item.title || 'Розіграш'}</div>
                            <div class="history-card-date">${item.date || 'Дата не вказана'}</div>
                        </div>
                        <div class="history-card-prize">${item.prize || '0 WINIX'}</div>
                        <div class="history-card-result">${item.result || 'Участь'}</div>
                        <div class="history-card-entry">Використано жетонів: ${item.entry_count || 0}</div>
                        <div class="view-details">Натисніть для деталей</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("Помилка створення картки історії:", error);
            return '';
        }
    }

    /**
     * Створити HTML для пустої історії
     * @param {string} customMessage - Опціональне повідомлення
     */
    function createEmptyHistoryHTML(customMessage) {
        const message = customMessage || 'Ви ще не брали участі в розіграшах WINIX. Спробуйте свою удачу вже сьогодні!';

        return `
            <div class="empty-history">
                <div class="empty-history-icon">🎮</div>
                <h3>Історія розіграшів порожня</h3>
                <p>${message}</p>
                <button class="join-raffle-btn" onclick="window.location.href='raffles.html'">Перейти до розіграшів</button>
            </div>
        `;
    }

    /**
     * Отримати HTML для бейджа розіграшу
     * @param {Object} item - Дані розіграшу
     */
    function getBadgeHTML(item) {
        if (!item) return '';

        try {
            if (item.status === 'won') {
                return `<div class="history-card-badge winner-badge">Перемога</div>`;
            } else if (item.is_daily) {
                return `<div class="history-card-badge daily-badge">Щоденний</div>`;
            } else {
                return `<div class="history-card-badge jackpot-badge">Джекпот</div>`;
            }
        } catch (error) {
            console.error("Помилка отримання бейджа:", error);
            return '';
        }
    }

    /**
     * Отримати HTML для бейджа місця в розіграші
     * @param {number} place - Місце в розіграші
     */
    function getPlaceBadgeHTML(place) {
        if (!place) return '';

        try {
            let badgeClass = '';
            if (place === 1) badgeClass = 'place-1';
            else if (place === 2) badgeClass = 'place-2';
            else if (place === 3) badgeClass = 'place-3';
            else badgeClass = 'place-other';

            return `<div class="history-place-badge ${badgeClass}">${place} місце</div>`;
        } catch (error) {
            console.error("Помилка отримання бейджа місця:", error);
            return '';
        }
    }

    /**
     * Отримати загальну суму виграшів
     * @param {Array} wonRaffles - Масив виграних розіграшів
     */
    function getTotalPrizeAmount(wonRaffles) {
        if (!wonRaffles || !Array.isArray(wonRaffles)) {
            return '0';
        }

        let total = 0;

        try {
            wonRaffles.forEach(raffle => {
                if (!raffle || !raffle.prize) return;

                // Витягуємо числову суму з рядка призу (тільки для WINIX)
                const match = raffle.prize.match(/(\d+(?:\.\d+)?)\s*WINIX/i);
                if (match) {
                    total += parseFloat(match[1]);
                }
            });

            return total.toLocaleString('uk-UA');
        } catch (error) {
            console.error("Помилка розрахунку загальної суми виграшів:", error);
            return '0';
        }
    }

    /**
     * Додати обробники подій для карток історії
     */
    function addHistoryCardEventListeners() {
        try {
            document.querySelectorAll('.history-card').forEach(card => {
                card.addEventListener('click', function() {
                    const raffleId = this.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    const historyItem = _historyData.find(item => item && item.raffle_id === raffleId);

                    if (historyItem) {
                        showRaffleHistoryDetails(historyItem);
                    } else {
                        // Якщо не знайдено в масиві, спробуємо отримати з API
                        getRaffleHistoryDetails(raffleId).then(details => {
                            if (details) {
                                showRaffleHistoryDetails(details);
                            } else {
                                showHistoryError('Не вдалося отримати деталі розіграшу');
                            }
                        }).catch(error => {
                            console.error("Помилка отримання деталей розіграшу:", error);
                            showHistoryError('Помилка отримання деталей розіграшу');
                        });
                    }
                });
            });
        } catch (error) {
            console.error("Помилка додавання обробників подій для карток:", error);
        }
    }

    /**
     * Показати модальне вікно з деталями розіграшу
     */
    function showRaffleHistoryDetails(raffleData) {
        if (!raffleData) {
            showHistoryError('Не вдалося отримати дані розіграшу');
            return;
        }

        try {
            // Видаляємо існуюче модальне вікно, якщо воно є
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
                winnersHTML = generateWinnersListHTML(raffleData.winners);
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
        } catch (error) {
            console.error("Помилка відображення деталей розіграшу:", error);
            showHistoryError('Не вдалося відобразити деталі розіграшу');
            return null;
        }
    }

    /**
     * Генерування HTML для списку переможців
     * @param {Array} winners - Масив переможців
     */
    function generateWinnersListHTML(winners) {
        if (!winners || !Array.isArray(winners) || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        try {
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
        } catch (error) {
            console.error("Помилка генерування списку переможців:", error);
            return '<div class="no-winners">Помилка отримання списку переможців</div>';
        }
    }

    /**
     * Експорт історії розіграшів у CSV
     */
    function exportHistoryToCSV() {
        if (!_historyData || !Array.isArray(_historyData) || _historyData.length === 0) {
            showHistoryError('Немає даних для експорту');
            return;
        }

        try {
            // Генеруємо заголовки
            const headers = [
                'Дата',
                'Назва розіграшу',
                'Тип',
                'Приз',
                'Витрачено жетонів',
                'Результат',
                'Статус'
            ];

            // Генеруємо рядки даних
            const rows = _historyData.map(item => {
                if (!item) return ['-', '-', '-', '-', '-', '-', '-'];

                return [
                    item.date || '-',
                    item.title || 'Розіграш',
                    item.is_daily ? 'Щоденний' : 'Джекпот',
                    item.prize || '0 WINIX',
                    item.entry_count || 0,
                    item.result || '-',
                    item.status === 'won' ? 'Перемога' : 'Участь'
                ];
            });

            // Об'єднуємо все в CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Створюємо посилання для завантаження
            const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'winix_raffle_history.csv');
            document.body.appendChild(link);

            // Клікаємо на посилання
            link.click();

            // Видаляємо посилання
            document.body.removeChild(link);

            showHistorySuccess('Історію розіграшів успішно експортовано');
        } catch (error) {
            console.error('Помилка експорту історії:', error);
            showHistoryError('Не вдалося експортувати історію');
        }
    }

    /**
     * Показати індикатор завантаження для історії
     */
    function showHistoryLoader() {
        try {
            // Перевіряємо наявність глобальної функції
            if (window.showLoading && typeof window.showLoading === 'function') {
                return window.showLoading('Завантаження історії...');
            }

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
        } catch (error) {
            console.error("Помилка показу індикатора завантаження:", error);
        }
    }

    /**
     * Приховати індикатор завантаження для історії
     */
    function hideHistoryLoader() {
        try {
            // Перевіряємо наявність глобальної функції
            if (window.hideLoading && typeof window.hideLoading === 'function') {
                return window.hideLoading();
            }

            const container = document.getElementById('history-container');
            if (!container) return;

            const loader = container.querySelector('.history-loader');
            if (loader) {
                loader.remove();
            }
        } catch (error) {
            console.error("Помилка приховування індикатора завантаження:", error);
        }
    }

    /**
     * Показати повідомлення про помилку
     * @param {string} message - Текст повідомлення
     */
    function showHistoryError(message) {
        showHistoryNotification(message, 'error');
    }

    /**
     * Показати повідомлення про успіх
     * @param {string} message - Текст повідомлення
     */
    function showHistorySuccess(message) {
        showHistoryNotification(message, 'success');
    }

    /**
     * Показати системне повідомлення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення (error, success, info)
     */
    function showHistoryNotification(message, type = 'info') {
        try {
            // Перевіряємо наявність глобальної функції
            if (window.showToast) {
                return window.showToast(message);
            }

            const notification = document.createElement('div');
            notification.className = `history-notification ${type}`;
            notification.textContent = message;

            document.body.appendChild(notification);

            // Показуємо повідомлення
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);

            // Приховуємо повідомлення через 5 секунд
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }, 5000);
        } catch (error) {
            console.error("Помилка показу повідомлення:", error);
            // У випадку помилки, використовуємо alert як запасний варіант
            alert(message);
        }
    }

    /**
     * Додати стилі для історії розіграшів
     */
    function addHistoryStyles() {
        // Перевіряємо, чи вже є стилі
        if (document.getElementById('raffle-history-styles')) {
            return;
        }

        const styleElement = document.createElement('style');
        styleElement.id = 'raffle-history-styles';
        styleElement.textContent = `
            /* Стилі для історії розіграшів */
            .history-filters {
                display: flex;
                justify-content: space-between;
                margin-bottom: 1.5rem;
                background: var(--bg-item);
                border-radius: var(--item-border-radius);
                padding: 1rem;
                flex-wrap: wrap;
                gap: 0.75rem;
            }
            
            .filter-group {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .filter-group label {
                font-size: 0.875rem;
                color: var(--text-secondary);
                white-space: nowrap;
            }
            
            .filter-group select {
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 0.5rem;
                padding: 0.375rem 0.5rem;
                color: white;
                font-size: 0.875rem;
                cursor: pointer;
            }
            
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
                border: 1px solid rgba(78, 181, 247, 0.1);
            }
            
            .history-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);
                border-color: rgba(78, 181, 247, 0.3);
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
            
            .jackpot-badge {
                background: rgba(156, 39, 176, 0.2);
                color: rgba(156, 39, 176, 1);
            }
            
            .history-place-badge {
                position: absolute;
                top: 0.5rem;
                left: 0.5rem;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                font-weight: bold;
                z-index: 1;
            }
            
            .place-1 {
                background: linear-gradient(145deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
                color: rgb(255, 215, 0);
                border: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            .place-2 {
                background: linear-gradient(145deg, rgba(192, 192, 192, 0.2), rgba(169, 169, 169, 0.2));
                color: rgb(192, 192, 192);
                border: 1px solid rgba(192, 192, 192, 0.3);
            }
            
            .place-3 {
                background: linear-gradient(145deg, rgba(205, 127, 50, 0.2), rgba(160, 82, 45, 0.2));
                color: rgb(205, 127, 50);
                border: 1px solid rgba(205, 127, 50, 0.3);
            }
            
            .place-other {
                background: rgba(0, 0, 0, 0.2);
                color: rgba(255, 255, 255, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.1);
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
            
            /* Стилі для деталей розіграшу */
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
                gap: 0.75rem;
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
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
            }
            
            .winner-place.place-1 {
                background: linear-gradient(145deg, #FFD700, #FFA500);
                box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
            }
            
            .winner-place.place-2 {
                background: linear-gradient(145deg, #C0C0C0, #A9A9A9);
                box-shadow: 0 0 8px rgba(192, 192, 192, 0.5);
            }
            
            .winner-place.place-3 {
                background: linear-gradient(145deg, #CD7F32, #A0522D);
                box-shadow: 0 0 8px rgba(205, 127, 50, 0.5);
            }
            
            .winner-place.default-place {
                background: rgba(0, 0, 0, 0.3);
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
            
            .winner-place-value {
                color: var(--premium-color);
                font-size: 1rem;
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
            
            /* Стилі для повідомлень */
            .history-notification {
                position: fixed;
                top: 1.5rem;
                right: 1.5rem;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                background: rgba(30, 39, 70, 0.9);
                color: white;
                font-size: 0.875rem;
                z-index: 10000;
                transform: translateX(calc(100% + 1.5rem));
                transition: transform 0.3s ease;
                box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.5);
                max-width: 300px;
            }
            
            .history-notification.show {
                transform: translateX(0);
            }
            
            .history-notification.error {
                background: rgba(244, 67, 54, 0.9);
                border-left: 0.25rem solid rgb(244, 67, 54);
            }
            
            .history-notification.success {
                background: rgba(76, 175, 80, 0.9);
                border-left: 0.25rem solid rgb(76, 175, 80);
            }
            
            .history-notification.info {
                background: rgba(33, 150, 243, 0.9);
                border-left: 0.25rem solid rgb(33, 150, 243);
            }
            
            /* Кнопка експорту */
            .export-history-btn {
                background: var(--secondary-gradient);
                border: none;
                border-radius: 0.5rem;
                padding: 0.5rem 1rem;
                color: white;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-left: auto;
                margin-bottom: 1rem;
            }
            
            .export-history-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.3);
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
                
                .history-filters {
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .filter-group {
                    width: 100%;
                    justify-content: space-between;
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

    // ======== ПУБЛІЧНІ МЕТОДИ ========

    /**
     * Експорт функцій для глобального використання
     */
    const publicAPI = {
        /**
         * Ініціалізація модуля історії розіграшів
         */
        init() {
            console.log("📋 Raffle History: Ініціалізація...");

            try {
                // Перевіряємо готовність DOM
                if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
                    console.log("DOM ще не готовий, відкладаємо ініціалізацію");
                    document.addEventListener('DOMContentLoaded', publicAPI.init);
                    return;
                }

                // Додаємо стилі
                addHistoryStyles();

                // Перевіряємо, чи є на сторінці контейнер для історії
                const historyContainer = document.getElementById('history-container');
                if (historyContainer) {
                    // Додаємо кнопку експорту
                    const exportButton = document.createElement('button');
                    exportButton.className = 'export-history-btn';
                    exportButton.innerHTML = '<span>📊</span> Експорт історії';
                    exportButton.addEventListener('click', exportHistoryToCSV);

                    // Додаємо кнопку перед контейнером
                    historyContainer.parentNode.insertBefore(exportButton, historyContainer);

                    // Автоматично відображаємо історію
                    displayHistory('history-container');
                }

                console.log("✅ Raffle History: Ініціалізацію завершено");
            } catch (error) {
                console.error("Критична помилка ініціалізації модуля історії розіграшів:", error);
            }
        },

        /**
         * Відображення історії розіграшів
         * @param {string} containerId - ID контейнера для відображення історії
         * @param {Object} filters - Фільтри для історії
         */
        displayHistory,

        /**
         * Отримання історії розіграшів
         * @param {Object} filters - Фільтри для історії
         */
        getRaffleHistory,

        /**
         * Отримання детальної інформації про розіграш з історії
         * @param {string} raffleId - ID розіграшу
         */
        getRaffleHistoryDetails,

        /**
         * Показати модальне вікно з деталями розіграшу
         * @param {string} raffleId - ID розіграшу
         */
        showRaffleHistoryDetails,

        /**
         * Експорт історії розіграшів у CSV
         */
        exportHistoryToCSV
    };

    // Експортуємо публічний API
    window.RaffleHistory = publicAPI;

    // Ініціалізуємо модуль при завантаженні документа
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', publicAPI.init);
    } else {
        publicAPI.init();
    }

    return publicAPI;
})();