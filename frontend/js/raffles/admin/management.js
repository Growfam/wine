/**
 * management.js - Модуль для управління розіграшами в адмін-панелі
 * Надає функції для створення, редагування та управління розіграшами
 */

import api from '../services/api.js';
import { showToast, showConfirm } from '../utils/ui-helpers.js';
import { formatDate } from '../utils/formatters.js';

/**
 * Клас для управління розіграшами
 * @class RaffleManagement
 */
class RaffleManagement {
    /**
     * Конструктор
     */
    constructor() {
        this._isLoading = false;
        this._currentPage = 1;
        this._itemsPerPage = 10;
        this._statusFilter = null;
        this._typeFilter = null;
        this._totalItems = 0;
        this._rafflesList = [];
        this._raffleDetailsCache = {};
    }

    /**
     * Ініціалізація менеджера розіграшів
     */
    init() {
        // Перевіряємо, чи є необхідні DOM елементи
        const container = document.getElementById('admin-raffles-container');
        if (!container) {
            console.warn("Контейнер адмін-розіграшів не знайдено");
            return;
        }

        // Додаємо стилі для адмін-панелі, якщо вони потрібні
        this._createAdminStyles();

        // Відображаємо список розіграшів
        this.displayRafflesList();

        console.log("✅ Raffle Management: Ініціалізацію завершено");
    }

    /**
     * Створення стилів для адмін-панелі розіграшів
     * @private
     */
    _createAdminStyles() {
        // Перевіряємо, чи вже є стилі
        if (document.getElementById('admin-raffles-styles')) {
            return;
        }

        const styleElement = document.createElement('style');
        styleElement.id = 'admin-raffles-styles';
        styleElement.textContent = `
            /* Стилі для адмін-панелі розіграшів */
            .admin-filters {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            
            .filter-group {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .admin-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1rem;
                background: rgba(30, 39, 70, 0.8);
                border-radius: 0.5rem;
                overflow: hidden;
            }
            
            .admin-table th, .admin-table td {
                padding: 0.75rem;
                text-align: left;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .admin-table th {
                background: rgba(20, 30, 60, 0.7);
                color: white;
                font-weight: bold;
            }
            
            .admin-table tr:hover td {
                background: rgba(30, 113, 161, 0.1);
            }
            
            .admin-table .no-data {
                text-align: center;
                padding: 2rem;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .admin-button {
                background: linear-gradient(90deg, #2D6EB6, #52C0BD);
                border: none;
                border-radius: 0.5rem;
                padding: 0.5rem 1rem;
                color: white;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .admin-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .admin-button:active {
                transform: translateY(0);
            }
            
            .status-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                font-weight: bold;
            }
            
            .status-active {
                background: rgba(0, 201, 167, 0.2);
                color: rgba(0, 201, 167, 1);
            }
            
            .status-completed {
                background: rgba(76, 175, 80, 0.2);
                color: rgba(76, 175, 80, 1);
            }
            
            .status-cancelled {
                background: rgba(244, 67, 54, 0.2);
                color: rgba(244, 67, 54, 1);
            }
            
            .actions-cell {
                white-space: nowrap;
                display: flex;
                gap: 0.25rem;
            }
            
            .action-btn {
                background: transparent;
                border: none;
                cursor: pointer;
                font-size: 1rem;
                padding: 0.25rem;
                border-radius: 0.25rem;
                transition: all 0.2s ease;
            }
            
            .action-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .admin-pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 1rem;
                margin-top: 1rem;
            }
            
            .admin-pagination button {
                background: rgba(30, 39, 70, 0.8);
                border: none;
                border-radius: 0.25rem;
                padding: 0.5rem 1rem;
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .admin-pagination button:hover:not(:disabled) {
                background: rgba(30, 113, 161, 0.8);
            }
            
            .admin-pagination button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Стилі для модальних вікон */
            .admin-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .admin-modal.show {
                display: flex;
                opacity: 1;
            }
            
            .admin-modal-content {
                background: linear-gradient(145deg, rgba(26, 26, 46, 0.95), rgba(15, 52, 96, 0.95));
                border-radius: 0.5rem;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                animation: modalFadeIn 0.3s ease;
            }
            
            .admin-modal-content.wide-modal {
                max-width: 900px;
            }
            
            @keyframes modalFadeIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            .admin-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .admin-modal-header h2 {
                margin: 0;
                color: white;
                font-size: 1.25rem;
            }
            
            .admin-modal-close {
                color: rgba(255, 255, 255, 0.7);
                font-size: 1.5rem;
                cursor: pointer;
                transition: color 0.2s ease;
            }
            
            .admin-modal-close:hover {
                color: white;
            }
            
            .admin-modal-body {
                padding: 1rem;
                overflow-y: auto;
            }
            
            .admin-modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 0.5rem;
                padding: 1rem;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
        `;

        document.head.appendChild(styleElement);
    }

    /**
     * Отримання списку розіграшів для адмін-панелі
     * @param {number} page - Номер сторінки
     * @param {string} statusFilter - Фільтр за статусом
     * @param {string} typeFilter - Фільтр за типом
     * @returns {Promise<Object>} - Список розіграшів та інформація про пагінацію
     */
    async getRafflesList(page = 1, statusFilter = null, typeFilter = null) {
        if (this._isLoading) {
            console.log("⏳ Raffle Management: Завантаження вже виконується");
            return null;
        }

        this._isLoading = true;
        this._showLoader();

        try {
            // Формуємо URL з параметрами
            let url = '/raffles';
            const params = [];

            if (statusFilter) {
                params.push(`status=${statusFilter}`);
            }

            if (typeFilter) {
                params.push(`type=${typeFilter}`);
            }

            params.push(`page=${page}`);
            params.push(`limit=${this._itemsPerPage}`);

            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            // Виконуємо запит
            const response = await api.apiRequest(url, 'GET');

            this._isLoading = false;
            this._hideLoader();

            if (response.status === 'success') {
                // Зберігаємо отримані дані
                this._rafflesList = response.data || [];
                this._totalItems = response.pagination?.total || this._rafflesList.length;
                this._currentPage = page;
                this._statusFilter = statusFilter;
                this._typeFilter = typeFilter;

                return {
                    raffles: this._rafflesList,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(this._totalItems / this._itemsPerPage),
                        totalItems: this._totalItems
                    }
                };
            } else {
                throw new Error(response.message || 'Помилка отримання списку розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання списку розіграшів:', error);
            this._isLoading = false;
            this._hideLoader();
            showToast('Помилка завантаження розіграшів: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Отримання деталей розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Деталі розіграшу
     */
    async getRaffleDetails(raffleId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return null;
        }

        // Перевіряємо кеш
        if (this._raffleDetailsCache[raffleId]) {
            return this._raffleDetailsCache[raffleId];
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest(`/raffles/${raffleId}`, 'GET');

            this._hideLoader();

            if (response.status === 'success') {
                // Кешуємо отримані дані
                this._raffleDetailsCache[raffleId] = response.data;
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка завантаження деталей розіграшу: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Створення нового розіграшу
     * @param {Object} raffleData - Дані нового розіграшу
     * @returns {Promise<Object>} - Результат створення
     */
    async createRaffle(raffleData) {
        if (!raffleData) {
            showToast('Дані розіграшу не вказано', 'error');
            return null;
        }

        // Валідація обов'язкових полів
        const requiredFields = ['title', 'prize_amount', 'prize_currency', 'entry_fee', 'start_time', 'end_time', 'winners_count'];
        const missingFields = requiredFields.filter(field => !raffleData[field]);

        if (missingFields.length > 0) {
            showToast(`Відсутні обов'язкові поля: ${missingFields.join(', ')}`, 'error');
            return null;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest('/raffles', 'POST', raffleData);

            this._hideLoader();

            if (response.status === 'success') {
                showToast('Розіграш успішно створено', 'success');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка створення розіграшу');
            }
        } catch (error) {
            console.error('❌ Помилка створення розіграшу:', error);
            this._hideLoader();
            showToast('Помилка створення розіграшу: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Оновлення існуючого розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {Object} updateData - Дані для оновлення
     * @returns {Promise<Object>} - Результат оновлення
     */
    async updateRaffle(raffleId, updateData) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return null;
        }

        if (!updateData || Object.keys(updateData).length === 0) {
            showToast('Дані для оновлення не вказано', 'error');
            return null;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest(`/raffles/${raffleId}`, 'PUT', updateData);

            this._hideLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._raffleDetailsCache[raffleId];

                showToast('Розіграш успішно оновлено', 'success');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка оновлення розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка оновлення розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка оновлення розіграшу: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Видалення розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<boolean>} - Результат видалення
     */
    async deleteRaffle(raffleId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return false;
        }

        // Запитуємо підтвердження
        const confirmed = await showConfirm('Ви впевнені, що хочете видалити цей розіграш? Ця дія не може бути скасована.');
        if (!confirmed) {
            return false;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest(`/raffles/${raffleId}`, 'DELETE');

            this._hideLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._raffleDetailsCache[raffleId];

                showToast('Розіграш успішно видалено', 'success');
                return true;
            } else {
                throw new Error(response.message || 'Помилка видалення розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка видалення розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка видалення розіграшу: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Завершення розіграшу і визначення переможців
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Результат завершення
     */
    async finishRaffle(raffleId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return null;
        }

        // Запитуємо підтвердження
        const confirmed = await showConfirm('Ви впевнені, що хочете завершити цей розіграш зараз? Будуть визначені переможці.');
        if (!confirmed) {
            return null;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest(`/raffles/${raffleId}/finish`, 'POST');

            this._hideLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._raffleDetailsCache[raffleId];

                showToast('Розіграш успішно завершено. Переможці визначені.', 'success');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка завершення розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка завершення розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка завершення розіграшу: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Отримання учасників розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Дані про учасників
     */
    async getRaffleParticipants(raffleId) {
        if (!raffleId) {
            showToast('ID розіграшу не вказано', 'error');
            return null;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest(`/raffles/${raffleId}/participants`, 'GET');

            this._hideLoader();

            if (response.status === 'success') {
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка отримання учасників розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання учасників розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка завантаження учасників: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Перевірка та завершення прострочених розіграшів
     * @returns {Promise<Object>} - Результат операції
     */
    async checkExpiredRaffles() {
        this._showLoader();

        try {
            // Виконуємо запит
            const response = await api.apiRequest('/raffles/check-expired', 'POST');

            this._hideLoader();

            if (response.status === 'success') {
                const finishedCount = response.finished_count || 0;

                if (finishedCount > 0) {
                    showToast(`Завершено ${finishedCount} прострочених розіграшів`, 'success');
                } else {
                    showToast('Прострочені розіграші не знайдено', 'info');
                }

                return response;
            } else {
                throw new Error(response.message || 'Помилка перевірки розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка перевірки прострочених розіграшів:', error);
            this._hideLoader();
            showToast('Помилка перевірки розіграшів: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Відображення списку розіграшів у контейнері адмін-панелі
     */
    async displayRafflesList() {
        const container = document.getElementById('admin-raffles-container');
        if (!container) {
            console.error('Контейнер для списку розіграшів не знайдено');
            return;
        }

        // Отримуємо дані
        const result = await this.getRafflesList(this._currentPage, this._statusFilter, this._typeFilter);
        if (!result) {
            container.innerHTML = '<div class="admin-error-message">Помилка завантаження розіграшів</div>';
            return;
        }

        const { raffles, pagination } = result;

        // Формуємо HTML таблиці
        let tableHTML = this._generateRafflesTable(raffles, pagination);

        // Вставляємо HTML у контейнер
        container.innerHTML = tableHTML;

        // Додаємо обробники подій
        this._setupEventListeners();
    }

    /**
     * Генерування HTML таблиці розіграшів
     * @param {Array} raffles - Список розіграшів
     * @param {Object} pagination - Дані пагінації
     * @returns {string} - HTML код таблиці
     * @private
     */
    _generateRafflesTable(raffles, pagination) {
        let html = `
            <div class="admin-filters">
                <div class="filter-group">
                    <label>Фільтр за статусом:</label>
                    <select id="status-filter">
                        <option value="">Всі</option>
                        <option value="active" ${this._statusFilter === 'active' ? 'selected' : ''}>Активні</option>
                        <option value="completed" ${this._statusFilter === 'completed' ? 'selected' : ''}>Завершені</option>
                        <option value="cancelled" ${this._statusFilter === 'cancelled' ? 'selected' : ''}>Скасовані</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Фільтр за типом:</label>
                    <select id="type-filter">
                        <option value="">Всі</option>
                        <option value="daily" ${this._typeFilter === 'daily' ? 'selected' : ''}>Щоденні</option>
                        <option value="main" ${this._typeFilter === 'main' ? 'selected' : ''}>Джекпоти</option>
                    </select>
                </div>
                <button id="add-raffle-btn" class="admin-button">Створити розіграш</button>
                <button id="check-expired-btn" class="admin-button">Перевірити прострочені</button>
            </div>

            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Назва</th>
                        <th>Приз</th>
                        <th>Вартість участі</th>
                        <th>Дата завершення</th>
                        <th>Учасників</th>
                        <th>Переможців</th>
                        <th>Статус</th>
                        <th>Дії</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (raffles.length === 0) {
            html += `
                <tr>
                    <td colspan="9" class="no-data">Розіграші не знайдено</td>
                </tr>
            `;
        } else {
            // Додаємо рядки для кожного розіграшу
            raffles.forEach(raffle => {
                const formattedDate = formatDate(raffle.end_time);

                const statusClass =
                    raffle.status === 'active' ? 'status-active' :
                    raffle.status === 'completed' ? 'status-completed' :
                    'status-cancelled';

                const statusText =
                    raffle.status === 'active' ? 'Активний' :
                    raffle.status === 'completed' ? 'Завершено' :
                    'Скасовано';

                html += `
                    <tr data-raffle-id="${raffle.id}">
                        <td>${this._truncateText(raffle.id, 8)}</td>
                        <td>${raffle.title}</td>
                        <td>${raffle.prize_amount} ${raffle.prize_currency}</td>
                        <td>${raffle.entry_fee} жетонів</td>
                        <td>${formattedDate}</td>
                        <td>${raffle.participants_count || 0}</td>
                        <td>${raffle.winners_count}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td class="actions-cell">
                            <button class="action-btn view-btn" data-raffle-id="${raffle.id}" title="Переглянути деталі">👁️</button>
                            ${raffle.status === 'active' ? `
                                <button class="action-btn edit-btn" data-raffle-id="${raffle.id}" title="Редагувати">✏️</button>
                                <button class="action-btn finish-btn" data-raffle-id="${raffle.id}" title="Завершити розіграш">🏁</button>
                                <button class="action-btn delete-btn" data-raffle-id="${raffle.id}" title="Видалити">🗑️</button>
                            ` : `
                                <button class="action-btn participants-btn" data-raffle-id="${raffle.id}" title="Учасники">👥</button>
                            `}
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                </tbody>
            </table>
        `;

        // Додаємо пагінацію якщо потрібно
        if (pagination.totalPages > 1) {
            html += `
                <div class="admin-pagination">
                    <button id="prev-page" ${pagination.currentPage <= 1 ? 'disabled' : ''}>« Попередня</button>
                    <span>Сторінка ${pagination.currentPage} з ${pagination.totalPages}</span>
                    <button id="next-page" ${pagination.currentPage >= pagination.totalPages ? 'disabled' : ''}>Наступна »</button>
                </div>
            `;
        }

        return html;
    }

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventListeners() {
        // Фільтри
        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this._statusFilter = e.target.value || null;
            this._currentPage = 1;
            this.displayRafflesList();
        });

        document.getElementById('type-filter')?.addEventListener('change', (e) => {
            this._typeFilter = e.target.value || null;
            this._currentPage = 1;
            this.displayRafflesList();
        });

        // Кнопка створення
        document.getElementById('add-raffle-btn')?.addEventListener('click', () => {
            this.openCreateRaffleModal();
        });

        // Кнопка перевірки прострочених
        document.getElementById('check-expired-btn')?.addEventListener('click', async () => {
            await this.checkExpiredRaffles();
            this.displayRafflesList();
        });

        // Пагінація
        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (this._currentPage > 1) {
                this._currentPage--;
                this.displayRafflesList();
            }
        });

        document.getElementById('next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this._totalItems / this._itemsPerPage);
            if (this._currentPage < totalPages) {
                this._currentPage++;
                this.displayRafflesList();
            }
        });

        // Кнопки дій
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const raffleId = e.target.getAttribute('data-raffle-id');
                this.openRaffleDetailsModal(raffleId);
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const raffleId = e.target.getAttribute('data-raffle-id');
                this.openEditRaffleModal(raffleId);
            });
        });

        document.querySelectorAll('.finish-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const raffleId = e.target.getAttribute('data-raffle-id');
                await this.finishRaffle(raffleId);
                this.displayRafflesList();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const raffleId = e.target.getAttribute('data-raffle-id');
                const success = await this.deleteRaffle(raffleId);
                if (success) {
                    this.displayRafflesList();
                }
            });
        });

        document.querySelectorAll('.participants-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const raffleId = e.target.getAttribute('data-raffle-id');
                this.openParticipantsModal(raffleId);
            });
        });
    }

    /**
     * Відкриття модального вікна створення розіграшу
     */
    async openCreateRaffleModal() {
        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'create-raffle-modal';

        // Отримуємо поточну дату та дату через тиждень для полів дат
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        const nowStr = now.toISOString().slice(0, 16);
        const nextWeekStr = nextWeek.toISOString().slice(0, 16);

        // Заповнюємо модальне вікно
        modal.innerHTML = `
            <div class="admin-modal-content">
                <div class="admin-modal-header">
                    <h2>Створення нового розіграшу</h2>
                    <span class="admin-modal-close">&times;</span>
                </div>
                <div class="admin-modal-body">
                    <form id="create-raffle-form">
                        <div class="form-group">
                            <label for="title">Назва розіграшу*</label>
                            <input type="text" id="title" name="title" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="description">Опис</label>
                            <textarea id="description" name="description" rows="3"></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half">
                                <label for="prize_amount">Сума призу*</label>
                                <input type="number" id="prize_amount" name="prize_amount" min="1" step="0.01" required>
                            </div>
                            
                            <div class="form-group half">
                                <label for="prize_currency">Валюта призу*</label>
                                <select id="prize_currency" name="prize_currency" required>
                                    <option value="WINIX" selected>WINIX</option>
                                    <option value="USDT">USDT</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half">
                                <label for="entry_fee">Вартість участі (жетони)*</label>
                                <input type="number" id="entry_fee" name="entry_fee" min="1" step="1" value="1" required>
                            </div>
                            
                            <div class="form-group half">
                                <label for="winners_count">Кількість переможців*</label>
                                <input type="number" id="winners_count" name="winners_count" min="1" step="1" value="1" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half">
                                <label for="start_time">Дата початку*</label>
                                <input type="datetime-local" id="start_time" name="start_time" value="${nowStr}" required>
                            </div>
                            
                            <div class="form-group half">
                                <label for="end_time">Дата завершення*</label>
                                <input type="datetime-local" id="end_time" name="end_time" value="${nextWeekStr}" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="image_url">URL зображення</label>
                            <input type="text" id="image_url" name="image_url" placeholder="assets/prize-poster.gif">
                        </div>
                        
                        <div class="form-group checkbox-group">
                            <input type="checkbox" id="is_daily" name="is_daily">
                            <label for="is_daily">Щоденний розіграш</label>
                        </div>
                    </form>
                </div>
                <div class="admin-modal-footer">
                    <button type="button" class="admin-button cancel-btn">Скасувати</button>
                    <button type="button" class="admin-button save-btn">Створити розіграш</button>
                </div>
            </div>
        `;

        // Додаємо модальне вікно на сторінку
        document.body.appendChild(modal);

        // Показуємо модальне вікно
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Додаємо обробники подій
        const closeBtn = modal.querySelector('.admin-modal-close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        const form = modal.querySelector('#create-raffle-form');

        // Функція закриття
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        };

        // Обробники для закриття
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Обробник для збереження
        saveBtn.addEventListener('click', async () => {
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Збираємо дані форми
            const formData = {
                title: form.querySelector('#title').value,
                description: form.querySelector('#description').value,
                prize_amount: parseFloat(form.querySelector('#prize_amount').value),
                prize_currency: form.querySelector('#prize_currency').value,
                entry_fee: parseInt(form.querySelector('#entry_fee').value),
                winners_count: parseInt(form.querySelector('#winners_count').value),
                start_time: new Date(form.querySelector('#start_time').value).toISOString(),
                end_time: new Date(form.querySelector('#end_time').value).toISOString(),
                image_url: form.querySelector('#image_url').value,
                is_daily: form.querySelector('#is_daily').checked,
            };

            // Створюємо розіграш
            const result = await this.createRaffle(formData);

            if (result) {
                closeModal();
                this.displayRafflesList();
            }
        });
    }

    /**
     * Відкриття модального вікна редагування розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openEditRaffleModal(raffleId) {
        const raffle = await this.getRaffleDetails(raffleId);

        if (!raffle) {
            showToast('Не вдалося отримати дані розіграшу');
            return;
        }

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'edit-raffle-modal';

        // Форматуємо дати
        const startTime = new Date(raffle.start_time);
        const endTime = new Date(raffle.end_time);

        const startTimeStr = startTime.toISOString().slice(0, 16);
        const endTimeStr = endTime.toISOString().slice(0, 16);

        modal.innerHTML = `
            <div class="admin-modal-content">
                <div class="admin-modal-header">
                    <h2>Редагування розіграшу</h2>
                    <span class="admin-modal-close">&times;</span>
                </div>
                <div class="admin-modal-body">
                    <form id="edit-raffle-form">
                        <div class="form-group">
                            <label for="edit-title">Назва розіграшу*</label>
                            <input type="text" id="edit-title" name="title" value="${raffle.title}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-description">Опис</label>
                            <textarea id="edit-description" name="description" rows="3">${raffle.description || ''}</textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half">
                                <label for="edit-prize_amount">Сума призу*</label>
                                <input type="number" id="edit-prize_amount" name="prize_amount" min="1" step="0.01" value="${raffle.prize_amount}" required>
                            </div>
                            
                            <div class="form-group half">
                                <label for="edit-prize_currency">Валюта призу*</label>
                                <select id="edit-prize_currency" name="prize_currency" required>
                                    <option value="WINIX" ${raffle.prize_currency === 'WINIX' ? 'selected' : ''}>WINIX</option>
                                    <option value="USDT" ${raffle.prize_currency === 'USDT' ? 'selected' : ''}>USDT</option>
                                    <option value="USD" ${raffle.prize_currency === 'USD' ? 'selected' : ''}>USD</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half">
                                <label for="edit-entry_fee">Вартість участі (жетони)*</label>
                                <input type="number" id="edit-entry_fee" name="entry_fee" min="1" step="1" value="${raffle.entry_fee}" required>
                            </div>
                            
                            <div class="form-group half">
                                <label for="edit-winners_count">Кількість переможців*</label>
                                <input type="number" id="edit-winners_count" name="winners_count" min="1" step="1" value="${raffle.winners_count}" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half">
                                <label for="edit-start_time">Дата початку*</label>
                                <input type="datetime-local" id="edit-start_time" name="start_time" value="${startTimeStr}" required>
                            </div>
                            
                            <div class="form-group half">
                                <label for="edit-end_time">Дата завершення*</label>
                                <input type="datetime-local" id="edit-end_time" name="end_time" value="${endTimeStr}" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-image_url">URL зображення</label>
                            <input type="text" id="edit-image_url" name="image_url" value="${raffle.image_url || ''}">
                        </div>
                        
                        <div class="form-group checkbox-group">
                            <input type="checkbox" id="edit-is_daily" name="is_daily" ${raffle.is_daily ? 'checked' : ''}>
                            <label for="edit-is_daily">Щоденний розіграш</label>
                        </div>
                    </form>
                </div>
                <div class="admin-modal-footer">
                    <button type="button" class="admin-button cancel-btn">Скасувати</button>
                    <button type="button" class="admin-button save-btn">Зберегти зміни</button>
                </div>
            </div>
        `;

        // Додаємо модальне вікно на сторінку
        document.body.appendChild(modal);

        // Показуємо модальне вікно
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Додаємо обробники подій
        const closeBtn = modal.querySelector('.admin-modal-close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        const form = modal.querySelector('#edit-raffle-form');

        // Функція закриття
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        };

        // Обробники для закриття
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Обробник для збереження
        saveBtn.addEventListener('click', async () => {
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Збираємо дані форми
            const formData = {
                title: form.querySelector('#edit-title').value,
                description: form.querySelector('#edit-description').value,
                prize_amount: parseFloat(form.querySelector('#edit-prize_amount').value),
                prize_currency: form.querySelector('#edit-prize_currency').value,
                entry_fee: parseInt(form.querySelector('#edit-entry_fee').value),
                winners_count: parseInt(form.querySelector('#edit-winners_count').value),
                start_time: new Date(form.querySelector('#edit-start_time').value).toISOString(),
                end_time: new Date(form.querySelector('#edit-end_time').value).toISOString(),
                image_url: form.querySelector('#edit-image_url').value,
                is_daily: form.querySelector('#edit-is_daily').checked,
            };

            // Оновлюємо розіграш
            const result = await this.updateRaffle(raffleId, formData);

            if (result) {
                closeModal();
                this.displayRafflesList();
            }
        });
    }

    /**
     * Відкриття модального вікна деталей розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openRaffleDetailsModal(raffleId) {
        console.log(`Відкриття модального вікна деталей розіграшу ${raffleId}`);
        const raffle = await this.getRaffleDetails(raffleId);

        if (!raffle) {
            showToast('Не вдалося отримати дані розіграшу');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'raffle-details-modal';

        // Визначаємо статус
        const statusClass =
            raffle.status === 'active' ? 'status-active' :
            raffle.status === 'completed' ? 'status-completed' :
            'status-cancelled';

        const statusText =
            raffle.status === 'active' ? 'Активний' :
            raffle.status === 'completed' ? 'Завершено' :
            'Скасовано';

        // Додаткова перевірка типу розіграшу
        const raffleType = raffle.is_daily ? 'Щоденний розіграш' : 'Джекпот';

        // Форматуємо дати
        const startTimeStr = formatDate(raffle.start_time);
        const endTimeStr = formatDate(raffle.end_time);

        modal.innerHTML = `
            <div class="admin-modal-content wide-modal">
                <div class="admin-modal-header">
                    <h2>Деталі розіграшу</h2>
                    <span class="admin-modal-close">&times;</span>
                </div>
                <div class="admin-modal-body">
                    <div class="raffle-header">
                        <h2>${raffle.title}</h2>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <div class="detail-label">ID розіграшу:</div>
                            <div class="detail-value">${raffle.id}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Тип:</div>
                            <div class="detail-value">${raffleType}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Призовий фонд:</div>
                            <div class="detail-value">${raffle.prize_amount} ${raffle.prize_currency}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Вартість участі:</div>
                            <div class="detail-value">${raffle.entry_fee} жетонів</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Кількість переможців:</div>
                            <div class="detail-value">${raffle.winners_count}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Початок:</div>
                            <div class="detail-value">${startTimeStr}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Завершення:</div>
                            <div class="detail-value">${endTimeStr}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Кількість учасників:</div>
                            <div class="detail-value">${raffle.participants_count || 0}</div>
                        </div>
                    </div>

                    <div class="raffle-description">
                        <h3>Опис</h3>
                        <p>${raffle.description || 'Опис відсутній'}</p>
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button type="button" class="admin-button view-participants-btn" data-raffle-id="${raffle.id}">Переглянути учасників</button>
                    <button type="button" class="admin-button close-btn">Закрити</button>
                </div>
            </div>
        `;

        // Додаємо модальне вікно на сторінку
        document.body.appendChild(modal);

        // Показуємо модальне вікно
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Додаємо обробники подій
        const closeBtn = modal.querySelector('.admin-modal-close');
        const closeActionBtn = modal.querySelector('.close-btn');
        const viewParticipantsBtn = modal.querySelector('.view-participants-btn');

        // Функція закриття
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        };

        // Обробники для закриття
        closeBtn.addEventListener('click', closeModal);
        closeActionBtn.addEventListener('click', closeModal);

        // Обробник для перегляду учасників
        viewParticipantsBtn.addEventListener('click', () => {
            closeModal();
            this.openParticipantsModal(raffleId);
        });
    }

    /**
     * Відкриття модального вікна зі списком учасників
     * @param {string} raffleId - ID розіграшу
     */
    async openParticipantsModal(raffleId) {
        console.log(`Відкриття модального вікна зі списком учасників розіграшу ${raffleId}`);
        const result = await this.getRaffleParticipants(raffleId);

        if (!result) {
            showToast('Не вдалося отримати список учасників');
            return;
        }

        const { raffle, participants } = result;

        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'participants-modal';

        modal.innerHTML = `
            <div class="admin-modal-content wide-modal">
                <div class="admin-modal-header">
                    <h2>Учасники розіграшу</h2>
                    <span class="admin-modal-close">&times;</span>
                </div>
                <div class="admin-modal-body">
                    <div class="participants-header">
                        <h3>${raffle.title}</h3>
                        <p>Загальна кількість учасників: ${participants.length}</p>
                    </div>
                    
                    <div class="participants-table-container">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Користувач</th>
                                    <th>Telegram ID</th>
                                    <th>Жетони</th>
                                    <th>Дата участі</th>
                                    <th>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${participants.length === 0 ? `
                                    <tr>
                                        <td colspan="6" class="no-data">Учасників не знайдено</td>
                                    </tr>
                                ` : ''}
                                
                                ${participants.map((participant, index) => {
                                    const statusClass = 
                                        participant.is_winner ? 'status-won' : 
                                        participant.status === 'refunded' ? 'status-refunded' : 
                                        'status-participated';
                                    
                                    const statusText = 
                                        participant.is_winner ? 'Переможець' : 
                                        participant.status === 'refunded' ? 'Повернуто' : 
                                        'Учасник';
                                    
                                    const entryTimeStr = formatDate(participant.entry_time);
                                    
                                    return `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${participant.username}</td>
                                            <td>${participant.telegram_id}</td>
                                            <td>${participant.entry_count}</td>
                                            <td>${entryTimeStr}</td>
                                            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button type="button" class="admin-button download-btn">Завантажити CSV</button>
                    <button type="button" class="admin-button close-btn">Закрити</button>
                </div>
            </div>
        `;

        // Додаємо модальне вікно на сторінку
        document.body.appendChild(modal);

        // Показуємо модальне вікно
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Додаємо обробники подій
        const closeBtn = modal.querySelector('.admin-modal-close');
        const closeActionBtn = modal.querySelector('.close-btn');
        const downloadBtn = modal.querySelector('.download-btn');

        // Функція закриття
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        };

        // Обробники для закриття
        closeBtn.addEventListener('click', closeModal);
        closeActionBtn.addEventListener('click', closeModal);

        // Обробник для завантаження CSV
        downloadBtn.addEventListener('click', () => {
            // Генеруємо CSV
            let csv = 'Номер,Користувач,Telegram ID,Жетони,Дата участі,Статус\n';

            participants.forEach((participant, index) => {
                const statusText =
                    participant.is_winner ? 'Переможець' :
                    participant.status === 'refunded' ? 'Повернуто' :
                    'Учасник';

                const entryTimeStr = formatDate(participant.entry_time);

                csv += `${index + 1},"${participant.username}",${participant.telegram_id},${participant.entry_count},"${entryTimeStr}","${statusText}"\n`;
            });

            // Створюємо посилання для завантаження
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `raffle-participants-${raffle.id}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    /**
     * Обрізання тексту до вказаної довжини з додаванням трьох крапок
     * @param {string} text - Текст для обрізання
     * @param {number} maxLength - Максимальна довжина
     * @returns {string} - Обрізаний текст
     * @private
     */
    _truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Показ індикатора завантаження
     * @private
     */
    _showLoader() {
        if (typeof window.showLoading === 'function') {
            window.showLoading('Завантаження...');
        }
    }

    /**
     * Приховування індикатора завантаження
     * @private
     */
    _hideLoader() {
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    }
}

// Експортуємо екземпляр класу
export default new RaffleManagement();