/**
 * management.js - Модуль для управління розіграшами в адмін-панелі
 * Надає функції для створення, редагування та управління розіграшами
 */

import { adminAPI } from '../services/api.js';
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

        // Відображаємо список розіграшів
        this.displayRafflesList();

        console.log("✅ Raffle Management: Ініціалізацію завершено");
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
            const response = await adminAPI.apiRequest(url, 'GET');

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
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}`, 'GET');

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
            const response = await adminAPI.apiRequest('/raffles', 'POST', raffleData);

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
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}`, 'PUT', updateData);

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
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}`, 'DELETE');

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
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}/finish`, 'POST');

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
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}/participants`, 'GET');

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
            const response = await adminAPI.apiRequest('/raffles/check-expired', 'POST');

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
        // Тут буде імплементація відкриття модального вікна створення розіграшу
        // Ця функція буде реалізована при розробці UI-компонентів
        console.log("Відкриття модального вікна створення розіграшу");
    }

    /**
     * Відкриття модального вікна редагування розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openEditRaffleModal(raffleId) {
        // Тут буде імплементація відкриття модального вікна редагування розіграшу
        // Ця функція буде реалізована при розробці UI-компонентів
        console.log(`Відкриття модального вікна редагування розіграшу ${raffleId}`);
    }

    /**
     * Відкриття модального вікна деталей розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openRaffleDetailsModal(raffleId) {
        // Тут буде імплементація відкриття модального вікна деталей розіграшу
        // Ця функція буде реалізована при розробці UI-компонентів
        console.log(`Відкриття модального вікна деталей розіграшу ${raffleId}`);
    }

    /**
     * Відкриття модального вікна зі списком учасників
     * @param {string} raffleId - ID розіграшу
     */
    async openParticipantsModal(raffleId) {
        // Тут буде імплементація відкриття модального вікна зі списком учасників
        // Ця функція буде реалізована при розробці UI-компонентів
        console.log(`Відкриття модального вікна зі списком учасників розіграшу ${raffleId}`);
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