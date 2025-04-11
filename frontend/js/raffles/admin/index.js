/**
 * index.js - Головний модуль адміністрування розіграшів
 * Відповідає за управління розіграшами в адмін-панелі
 */

import AdminAPI from '../../api/admin-api.js';
import { formatDate, formatCurrency } from '../formatters.js';
import { showToast, showConfirm } from '../ui-helpers.js';

class RaffleAdmin {
    constructor() {
        this._isLoading = false;
        this._rafflesList = [];
        this._currentPage = 1;
        this._itemsPerPage = 10;
        this._totalItems = 0;
        this._statusFilter = null;
        this._raffleDetailsCache = {};
    }

    /**
     * Ініціалізація модуля адміністрування розіграшів
     */
    init() {
        console.log("🎮 Admin Raffles: Ініціалізація адмін-модуля розіграшів");

        // Перевіряємо наявність контейнера для адмін-панелі
        const container = document.getElementById('admin-raffles-container');
        if (container) {
            // Додаємо стилі для адмін-панелі
            this._createAdminStyles();

            // Відображаємо список розіграшів
            this.displayRafflesList();
        }

        console.log("✅ Admin Raffles: Ініціалізацію завершено");
    }

    /**
     * Отримання всіх розіграшів для адмін-панелі
     * @param {number} page - Номер сторінки
     * @param {string} statusFilter - Фільтр за статусом
     * @returns {Promise<Object>} - Результат запиту
     */
    async getAllRaffles(page = 1, statusFilter = null) {
        try {
            if (this._isLoading) {
                console.log("⏳ Admin Raffles: Завантаження вже виконується");
                return;
            }

            this._isLoading = true;
            this._showAdminLoader();

            // Збереження поточного стану
            this._currentPage = page;
            this._statusFilter = statusFilter;

            // Будуємо URL із параметрами
            let url = '/api/admin/raffles';
            let params = [];

            if (statusFilter) {
                params.push(`status=${statusFilter}`);
            }

            params.push(`page=${page}`);
            params.push(`limit=${this._itemsPerPage}`);

            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            // Виконуємо запит з адмін-заголовком
            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest(url, 'GET', null, headers);

            this._hideAdminLoader();
            this._isLoading = false;

            if (response.status === 'success') {
                this._rafflesList = response.data || [];
                this._totalItems = response.pagination?.total || this._rafflesList.length;

                return {
                    raffles: this._rafflesList,
                    pagination: {
                        currentPage: this._currentPage,
                        totalPages: Math.ceil(this._totalItems / this._itemsPerPage),
                        totalItems: this._totalItems
                    }
                };
            } else {
                throw new Error(response.message || 'Помилка отримання розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка отримання розіграшів:', error);
            this._hideAdminLoader();
            this._isLoading = false;
            this._showAdminError('Помилка завантаження розіграшів: ' + error.message);
            return null;
        }
    }

    /**
     * Отримання деталей конкретного розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Деталі розіграшу
     */
    async getRaffleDetails(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            // Перевіряємо кеш
            if (this._raffleDetailsCache[raffleId]) {
                return this._raffleDetailsCache[raffleId];
            }

            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest(`/api/admin/raffles/${raffleId}`, 'GET', null, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                // Зберігаємо в кеш
                this._raffleDetailsCache[raffleId] = response.data;
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка отримання деталей розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
            this._hideAdminLoader();
            this._showAdminError('Помилка завантаження деталей розіграшу: ' + error.message);
            return null;
        }
    }

    /**
     * Створення нового розіграшу
     * @param {Object} raffleData - Дані розіграшу
     * @returns {Promise<Object>} - Результат операції
     */
    async createRaffle(raffleData) {
        try {
            if (!raffleData) {
                throw new Error('Дані розіграшу не вказано');
            }

            // Валідація обов'язкових полів
            const requiredFields = ['title', 'prize_amount', 'prize_currency', 'entry_fee', 'start_time', 'end_time', 'winners_count'];
            const missingFields = requiredFields.filter(field => !raffleData[field]);

            if (missingFields.length > 0) {
                throw new Error(`Відсутні обов'язкові поля: ${missingFields.join(', ')}`);
            }

            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest('/api/admin/raffles', 'POST', raffleData, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                this._showAdminSuccess('Розіграш успішно створено');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка створення розіграшу');
            }
        } catch (error) {
            console.error('❌ Помилка створення розіграшу:', error);
            this._hideAdminLoader();
            this._showAdminError('Помилка створення розіграшу: ' + error.message);
            return null;
        }
    }

    /**
     * Оновлення існуючого розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {Object} updateData - Дані для оновлення
     * @returns {Promise<Object>} - Результат операції
     */
    async updateRaffle(raffleId, updateData) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            if (!updateData || Object.keys(updateData).length === 0) {
                throw new Error('Дані для оновлення не вказано');
            }

            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest(`/api/admin/raffles/${raffleId}`, 'PUT', updateData, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._raffleDetailsCache[raffleId];

                this._showAdminSuccess('Розіграш успішно оновлено');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка оновлення розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка оновлення розіграшу ${raffleId}:`, error);
            this._hideAdminLoader();
            this._showAdminError('Помилка оновлення розіграшу: ' + error.message);
            return null;
        }
    }

    /**
     * Видалення розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<boolean>} - Результат операції
     */
    async deleteRaffle(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            // Запитуємо підтвердження
            const confirmed = await showConfirm('Ви впевнені, що хочете видалити цей розіграш? Ця дія не може бути скасована.');
            if (!confirmed) {
                return false;
            }

            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest(`/api/admin/raffles/${raffleId}`, 'DELETE', null, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._raffleDetailsCache[raffleId];

                this._showAdminSuccess('Розіграш успішно видалено');
                return true;
            } else {
                throw new Error(response.message || 'Помилка видалення розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка видалення розіграшу ${raffleId}:`, error);
            this._hideAdminLoader();
            this._showAdminError('Помилка видалення розіграшу: ' + error.message);
            return false;
        }
    }

    /**
     * Завершення розіграшу і визначення переможців
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Результат операції
     */
    async finishRaffle(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            // Запитуємо підтвердження
            const confirmed = await showConfirm('Ви впевнені, що хочете завершити цей розіграш зараз? Будуть визначені переможці.');
            if (!confirmed) {
                return null;
            }

            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest(`/api/admin/raffles/${raffleId}/finish`, 'POST', null, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._raffleDetailsCache[raffleId];

                this._showAdminSuccess('Розіграш успішно завершено. Переможці визначені.');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка завершення розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка завершення розіграшу ${raffleId}:`, error);
            this._hideAdminLoader();
            this._showAdminError('Помилка завершення розіграшу: ' + error.message);
            return null;
        }
    }

    /**
     * Отримання учасників розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Дані учасників
     */
    async getRaffleParticipants(raffleId) {
        try {
            if (!raffleId) {
                throw new Error('ID розіграшу не вказано');
            }

            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest(`/api/admin/raffles/${raffleId}/participants`, 'GET', null, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка отримання учасників розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання учасників розіграшу ${raffleId}:`, error);
            this._hideAdminLoader();
            this._showAdminError('Помилка завантаження учасників: ' + error.message);
            return null;
        }
    }

    /**
     * Перевірка та завершення прострочених розіграшів
     * @returns {Promise<Object>} - Результат операції
     */
    async checkExpiredRaffles() {
        try {
            this._showAdminLoader();

            const headers = {
                'X-Admin-User-Id': AdminAPI.getAdminId()
            };

            const response = await AdminAPI.apiRequest('/api/admin/raffles/check-expired', 'POST', null, headers);

            this._hideAdminLoader();

            if (response.status === 'success') {
                const finishedCount = response.finished_count || 0;

                if (finishedCount > 0) {
                    this._showAdminSuccess(`Завершено ${finishedCount} прострочених розіграшів`);
                } else {
                    this._showAdminInfo('Прострочені розіграші не знайдено');
                }

                return response;
            } else {
                throw new Error(response.message || 'Помилка перевірки розіграшів');
            }
        } catch (error) {
            console.error('❌ Помилка перевірки прострочених розіграшів:', error);
            this._hideAdminLoader();
            this._showAdminError('Помилка перевірки розіграшів: ' + error.message);
            return null;
        }
    }

    /**
     * Відображення списку розіграшів в адмін-панелі
     */
    async displayRafflesList() {
        const rafflesContainer = document.getElementById('admin-raffles-container');
        if (!rafflesContainer) {
            console.error('Контейнер для списку розіграшів не знайдено');
            return;
        }

        // Отримуємо розіграші
        const result = await this.getAllRaffles(this._currentPage, this._statusFilter);

        if (!result) {
            rafflesContainer.innerHTML = '<div class="admin-error-message">Помилка завантаження розіграшів</div>';
            return;
        }

        const { raffles, pagination } = result;

        // Створюємо таблицю розіграшів
        let tableHTML = `
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
            tableHTML += `
                <tr>
                    <td colspan="9" class="no-data">Розіграші не знайдено</td>
                </tr>
            `;
        } else {
            // Додаємо рядки для кожного розіграшу
            raffles.forEach(raffle => {
                const endDate = new Date(raffle.end_time);
                const formattedDate = formatDate(raffle.end_time);

                const statusClass =
                    raffle.status === 'active' ? 'status-active' :
                    raffle.status === 'completed' ? 'status-completed' :
                    'status-cancelled';

                const statusText =
                    raffle.status === 'active' ? 'Активний' :
                    raffle.status === 'completed' ? 'Завершено' :
                    'Скасовано';

                tableHTML += `
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

        tableHTML += `
                </tbody>
            </table>
        `;

        // Додаємо пагінацію
        if (pagination.totalPages > 1) {
            tableHTML += `
                <div class="admin-pagination">
                    <button id="prev-page" ${pagination.currentPage <= 1 ? 'disabled' : ''}>« Попередня</button>
                    <span>Сторінка ${pagination.currentPage} з ${pagination.totalPages}</span>
                    <button id="next-page" ${pagination.currentPage >= pagination.totalPages ? 'disabled' : ''}>Наступна »</button>
                </div>
            `;
        }

        // Вставляємо HTML в контейнер
        rafflesContainer.innerHTML = tableHTML;

        // Додаємо обробники подій
        this._addEventListeners();
    }

    /**
     * Додавання обробників подій до елементів інтерфейсу
     */
    _addEventListeners() {
        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            const status = e.target.value;
            this._statusFilter = status || null;
            this._currentPage = 1;
            this.displayRafflesList();
        });

        document.getElementById('add-raffle-btn')?.addEventListener('click', () => {
            this.openCreateRaffleModal();
        });

        document.getElementById('check-expired-btn')?.addEventListener('click', async () => {
            await this.checkExpiredRaffles();
            this.displayRafflesList();
        });

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

        // Додаємо обробники для кнопок дій
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
     * Відкриття модального вікна для створення розіграшу
     */
    openCreateRaffleModal() {
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
                        
                        <div class="form-group" id="prize-distribution-container">
                            <label>Розподіл призів</label>
                            <div class="prize-distribution-list" id="prize-distribution-list">
                                <div class="prize-distribution-item">
                                    <span>1 місце:</span>
                                    <input type="number" class="prize-amount" data-place="1" value="100" min="1" step="0.01">
                                    <span class="prize-currency">WINIX</span>
                                </div>
                            </div>
                            <small>* Розподіл призів буде автоматично розраховано відповідно до загальної суми призу</small>
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

        // Додаємо обробники подій для модального вікна
        this._setupCreateRaffleModalEvents(modal);
    }

    /**
     * Налаштування обробників подій для модального вікна створення розіграшу
     * @param {HTMLElement} modal - Елемент модального вікна
     */
    _setupCreateRaffleModalEvents(modal) {
        const closeBtn = modal.querySelector('.admin-modal-close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        const form = modal.querySelector('#create-raffle-form');
        const winnersCountInput = modal.querySelector('#winners_count');
        const prizeCurrencySelect = modal.querySelector('#prize_currency');
        const distributionList = modal.querySelector('#prize-distribution-list');

        // Оновлення розподілу призів при зміні кількості переможців
        winnersCountInput.addEventListener('change', () => {
            this._updatePrizeDistribution(parseInt(winnersCountInput.value), prizeCurrencySelect.value, distributionList);
        });

        // Оновлення валюти призу в розподілі
        prizeCurrencySelect.addEventListener('change', () => {
            const currencyElements = distributionList.querySelectorAll('.prize-currency');
            currencyElements.forEach(el => {
                el.textContent = prizeCurrencySelect.value;
            });
        });

        // Закриття модального вікна
        function closeModal() {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Збереження розіграшу
        saveBtn.addEventListener('click', async () => {
            // Перевірка валідності форми
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

            // Збираємо розподіл призів
            const prizeDistribution = {};
            distributionList.querySelectorAll('.prize-distribution-item').forEach(item => {
                const place = item.querySelector('.prize-amount').getAttribute('data-place');
                const amount = parseFloat(item.querySelector('.prize-amount').value);

                prizeDistribution[place] = {
                    amount: amount,
                    currency: formData.prize_currency
                };
            });

            formData.prize_distribution = prizeDistribution;

            // Створюємо розіграш
            const result = await this.createRaffle(formData);

            if (result) {
                closeModal();
                this.displayRafflesList(); // Оновлюємо список розіграшів
            }
        });

        // Ініціалізуємо розподіл призів
        this._updatePrizeDistribution(parseInt(winnersCountInput.value), prizeCurrencySelect.value, distributionList);
    }

    /**
     * Відкриття модального вікна для редагування розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openEditRaffleModal(raffleId) {
        // Отримуємо дані розіграшу
        const raffle = await this.getRaffleDetails(raffleId);

        if (!raffle) {
            this._showAdminError('Не вдалося отримати дані розіграшу');
            return;
        }

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'edit-raffle-modal';

        // Форматуємо дати для полів
        const startTime = new Date(raffle.start_time);
        const endTime = new Date(raffle.end_time);

        const startTimeStr = startTime.toISOString().slice(0, 16);
        const endTimeStr = endTime.toISOString().slice(0, 16);

        // Заповнюємо модальне вікно
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
                        
                        <div class="form-group" id="edit-prize-distribution-container">
                            <label>Розподіл призів</label>
                            <div class="prize-distribution-list" id="edit-prize-distribution-list">
                                <!-- Тут буде згенеровано розподіл призів -->
                            </div>
                            <small>* Розподіл призів буде автоматично розраховано відповідно до загальної суми призу</small>
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

        // Генеруємо розподіл призів
        const distributionList = modal.querySelector('#edit-prize-distribution-list');
        this._generatePrizeDistributionEditor(raffle, distributionList);

        // Додаємо обробники подій для модального вікна
        this._setupEditRaffleModalEvents(modal, raffleId);
    }

    /**
     * Генерація елементів редактора розподілу призів
     * @param {Object} raffle - Дані розіграшу
     * @param {HTMLElement} distributionList - Контейнер для елементів розподілу
     */
    _generatePrizeDistributionEditor(raffle, distributionList) {
        const prizeDistribution = raffle.prize_distribution || {};

        for (let i = 1; i <= raffle.winners_count; i++) {
            const place = i.toString();
            const item = document.createElement('div');
            item.className = 'prize-distribution-item';

            // Отримуємо суму для поточного місця
            const prizeData = prizeDistribution[place] || {};
            const amount = prizeData.amount || (i === 1 ? 100 : i <= 3 ? 50 : 25);
            const currency = prizeData.currency || raffle.prize_currency;

            item.innerHTML = `
                <span>${i} місце:</span>
                <input type="number" class="prize-amount" data-place="${i}" value="${amount}" min="1" step="0.01">
                <span class="prize-currency">${currency}</span>
            `;

            distributionList.appendChild(item);
        }
    }

    /**
     * Налаштування обробників подій для модального вікна редагування розіграшу
     * @param {HTMLElement} modal - Елемент модального вікна
     * @param {string} raffleId - ID розіграшу
     */
    _setupEditRaffleModalEvents(modal, raffleId) {
        const closeBtn = modal.querySelector('.admin-modal-close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        const form = modal.querySelector('#edit-raffle-form');
        const winnersCountInput = modal.querySelector('#edit-winners_count');
        const prizeCurrencySelect = modal.querySelector('#edit-prize_currency');
        const distributionList = modal.querySelector('#edit-prize-distribution-list');

        // Оновлення розподілу призів при зміні кількості переможців
        winnersCountInput.addEventListener('change', () => {
            this._updateEditPrizeDistribution(
                parseInt(winnersCountInput.value),
                prizeCurrencySelect.value,
                distributionList
            );
        });

        // Оновлення валюти призу в розподілі
        prizeCurrencySelect.addEventListener('change', () => {
            const currencyElements = distributionList.querySelectorAll('.prize-currency');
            currencyElements.forEach(el => {
                el.textContent = prizeCurrencySelect.value;
            });
        });

        // Закриття модального вікна
        function closeEditModal() {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }

        closeBtn.addEventListener('click', closeEditModal);
        cancelBtn.addEventListener('click', closeEditModal);

        // Збереження змін
        saveBtn.addEventListener('click', async () => {
            // Перевірка валідності форми
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

            // Збираємо розподіл призів
            const prizeDistribution = {};
            distributionList.querySelectorAll('.prize-distribution-item').forEach(item => {
                const place = item.querySelector('.prize-amount').getAttribute('data-place');
                const amount = parseFloat(item.querySelector('.prize-amount').value);

                prizeDistribution[place] = {
                    amount: amount,
                    currency: formData.prize_currency
                };
            });

            formData.prize_distribution = prizeDistribution;

            // Оновлюємо розіграш
            const result = await this.updateRaffle(raffleId, formData);

            if (result) {
                closeEditModal();
                this.displayRafflesList(); // Оновлюємо список розіграшів
            }
        });
    }

    /**
     * Оновлення елементів для редагування розподілу призів
     * @param {number} count - Кількість переможців
     * @param {string} currency - Валюта призу
     * @param {HTMLElement} distributionList - Контейнер для елементів розподілу
     */
    _updateEditPrizeDistribution(count, currency, distributionList) {
        // Зберігаємо поточні значення
        const currentValues = {};
        distributionList.querySelectorAll('.prize-distribution-item').forEach(item => {
            const place = item.querySelector('.prize-amount').getAttribute('data-place');
            const amount = parseFloat(item.querySelector('.prize-amount').value);
            currentValues[place] = amount;
        });

        // Очищаємо список
        distributionList.innerHTML = '';

        // Додаємо необхідну кількість полів
        for (let i = 1; i <= count; i++) {
            const item = document.createElement('div');
            item.className = 'prize-distribution-item';

            // Використовуємо збережене значення або розраховуємо нове
            const place = i.toString();
            const amount = currentValues[place] || (i === 1 ? 100 : i <= 3 ? 50 : 25);

            item.innerHTML = `
                <span>${i} місце:</span>
                <input type="number" class="prize-amount" data-place="${i}" value="${amount}" min="1" step="0.01">
                <span class="prize-currency">${currency}</span>
            `;

            distributionList.appendChild(item);
        }
    }

    /**
     * Оновлення розподілу призів
     * @param {number} count - Кількість переможців
     * @param {string} currency - Валюта призу
     * @param {HTMLElement} distributionList - Контейнер для елементів розподілу
     */
    _updatePrizeDistribution(count, currency, distributionList) {
        // Очищаємо список
        distributionList.innerHTML = '';

        // Додаємо необхідну кількість полів
        for (let i = 1; i <= count; i++) {
            const item = document.createElement('div');
            item.className = 'prize-distribution-item';

            // Розраховуємо суму для поточного місця (спрощена версія)
            const amount = i === 1 ? 100 : i <= 3 ? 50 : 25;

            item.innerHTML = `
                <span>${i} місце:</span>
                <input type="number" class="prize-amount" data-place="${i}" value="${amount}" min="1" step="0.01">
                <span class="prize-currency">${currency}</span>
            `;

            distributionList.appendChild(item);
        }
    }

    /**
     * Відкриття модального вікна з деталями розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openRaffleDetailsModal(raffleId) {
        // Отримуємо дані розіграшу
        const raffle = await this.getRaffleDetails(raffleId);

        if (!raffle) {
            this._showAdminError('Не вдалося отримати дані розіграшу');
            return;
        }

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'raffle-details-modal';

        // Форматуємо дати
        const startTimeStr = formatDate(raffle.start_time);
        const endTimeStr = formatDate(raffle.end_time);
        const createdAtStr = formatDate(raffle.created_at);

        // Визначаємо статус
        const statusClass =
            raffle.status === 'active' ? 'status-active' :
            raffle.status === 'completed' ? 'status-completed' :
            'status-cancelled';

        const statusText =
            raffle.status === 'active' ? 'Активний' :
            raffle.status === 'completed' ? 'Завершено' :
            'Скасовано';

        // Генеруємо HTML для розподілу призів
        const prizeDistributionHTML = this._generatePrizeDistributionHTML(raffle);

        // Генеруємо HTML для переможців (якщо є)
        const winnersHTML = this._generateRaffleWinnersHTML(raffle);

        // Заповнюємо модальне вікно
        modal.innerHTML = `
            <div class="admin-modal-content wide-modal">
                <div class="admin-modal-header">
                    <h2>Деталі розіграшу</h2>
                    <span class="admin-modal-close">&times;</span>
                </div>
                <div class="admin-modal-body">
                    <div class="raffle-details-container">
                        <div class="raffle-header">
                            <h2 class="raffle-title">${raffle.title}</h2>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        
                        <div class="details-row">
                            <div class="details-column">
                                <div class="details-section">
                                    <h3>Основна інформація</h3>
                                    <div class="details-grid">
                                        <div class="detail-item">
                                            <div class="detail-label">ID розіграшу:</div>
                                            <div class="detail-value">${raffle.id}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Тип:</div>
                                            <div class="detail-value">${raffle.is_daily ? 'Щоденний' : 'Звичайний'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Дата створення:</div>
                                            <div class="detail-value">${createdAtStr}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Створено:</div>
                                            <div class="detail-value">${raffle.created_by || 'System'}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="details-section">
                                    <h3>Часові рамки</h3>
                                    <div class="details-grid">
                                        <div class="detail-item">
                                            <div class="detail-label">Початок:</div>
                                            <div class="detail-value">${startTimeStr}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Завершення:</div>
                                            <div class="detail-value">${endTimeStr}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="details-section">
                                    <h3>Учасники</h3>
                                    <div class="details-grid">
                                        <div class="detail-item">
                                            <div class="detail-label">Кількість учасників:</div>
                                            <div class="detail-value">${raffle.participants_count || 0}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Вартість участі:</div>
                                            <div class="detail-value">${raffle.entry_fee} жетонів</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="details-column">
                                <div class="details-section">
                                    <h3>Опис розіграшу</h3>
                                    <div class="raffle-description">
                                        ${raffle.description || 'Опис відсутній'}
                                    </div>
                                </div>
                                
                                <div class="details-section">
                                    <h3>Призи</h3>
                                    <div class="details-grid">
                                        <div class="detail-item">
                                            <div class="detail-label">Загальний призовий фонд:</div>
                                            <div class="detail-value">${raffle.prize_amount} ${raffle.prize_currency}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Кількість переможців:</div>
                                            <div class="detail-value">${raffle.winners_count}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="prize-distribution">
                                        <h4>Розподіл призів:</h4>
                                        <div class="prize-list">
                                            ${prizeDistributionHTML}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${winnersHTML}
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button type="button" class="admin-button view-participants-btn">Переглянути учасників</button>
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

        // Налаштовуємо обробники подій
        this._setupDetailsModalEvents(modal, raffleId);
    }

    /**
     * Налаштування обробників подій для модального вікна з деталями розіграшу
     * @param {HTMLElement} modal - Елемент модального вікна
     * @param {string} raffleId - ID розіграшу
     */
    _setupDetailsModalEvents(modal, raffleId) {
        const closeBtn = modal.querySelector('.admin-modal-close');
        const cancelBtn = modal.querySelector('.close-btn');
        const viewParticipantsBtn = modal.querySelector('.view-participants-btn');

        // Закриття модального вікна
        function closeDetailsModal() {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }

        closeBtn.addEventListener('click', closeDetailsModal);
        cancelBtn.addEventListener('click', closeDetailsModal);

        // Перегляд учасників
        viewParticipantsBtn.addEventListener('click', () => {
            closeDetailsModal();
            this.openParticipantsModal(raffleId);
        });
    }

    /**
     * Генерування HTML для розподілу призів
     * @param {Object} raffle - Дані розіграшу
     * @returns {string} - HTML-розмітка
     */
    _generatePrizeDistributionHTML(raffle) {
        const prizeDistribution = raffle.prize_distribution || {};
        let html = '';

        for (let i = 1; i <= raffle.winners_count; i++) {
            const place = i.toString();
            const prizeData = prizeDistribution[place] || {};
            const amount = prizeData.amount || 0;
            const currency = prizeData.currency || raffle.prize_currency;

            html += `
                <div class="prize-item">
                    <span class="prize-place">${i} місце:</span>
                    <span class="prize-value">${amount} ${currency}</span>
                </div>
            `;
        }

        return html || '<div class="prize-item"><span class="prize-place">Інформація про призи відсутня</span></div>';
    }

    /**
     * Генерування HTML для переможців розіграшу
     * @param {Object} raffle - Дані розіграшу
     * @returns {string} - HTML-розмітка
     */
    _generateRaffleWinnersHTML(raffle) {
        if (raffle.status !== 'completed' || !raffle.winners || !Array.isArray(raffle.winners) || raffle.winners.length === 0) {
            return '';
        }

        let winnersHTML = `
            <div class="details-section">
                <h3>Переможці розіграшу</h3>
                <div class="winners-list">
        `;

        raffle.winners.forEach(winner => {
            winnersHTML += `
                <div class="winner-item">
                    <div class="winner-place">${winner.place} місце</div>
                    <div class="winner-info">
                        <span class="winner-username">${winner.username}</span>
                        <span class="winner-id">ID: ${winner.telegram_id}</span>
                    </div>
                    <div class="winner-prize">${winner.prize_amount} ${winner.prize_currency}</div>
                </div>
            `;
        });

        winnersHTML += `
                </div>
            </div>
        `;

        return winnersHTML;
    }

    /**
     * Відкриття модального вікна з учасниками розіграшу
     * @param {string} raffleId - ID розіграшу
     */
    async openParticipantsModal(raffleId) {
        // Отримуємо дані учасників
        const result = await this.getRaffleParticipants(raffleId);

        if (!result) {
            this._showAdminError('Не вдалося отримати дані учасників');
            return;
        }

        const { raffle, participants } = result;

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'participants-modal';

        // Заповнюємо модальне вікно
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

        // Налаштовуємо обробники подій
        this._setupParticipantsModalEvents(modal, raffle, participants);
    }

    /**
     * Налаштування обробників подій для модального вікна з учасниками
     * @param {HTMLElement} modal - Елемент модального вікна
     * @param {Object} raffle - Дані розіграшу
     * @param {Array} participants - Дані учасників
     */
    _setupParticipantsModalEvents(modal, raffle, participants) {
        const closeBtn = modal.querySelector('.admin-modal-close');
        const cancelBtn = modal.querySelector('.close-btn');
        const downloadBtn = modal.querySelector('.download-btn');

        // Закриття модального вікна
        function closeParticipantsModal() {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }

        closeBtn.addEventListener('click', closeParticipantsModal);
        cancelBtn.addEventListener('click', closeParticipantsModal);

        // Завантаження CSV
        downloadBtn.addEventListener('click', () => {
            // Генеруємо CSV
            let csv = 'Номер,Користувач,Telegram ID,Жетони,Дата участі,Статус\n';

            participants.forEach((participant, index) => {
                const statusText =
                    participant.is_winner ? 'Переможець' :
                    participant.status === 'refunded' ? 'Повернуто' :
                    'Учасник';

                const entryTime = new Date(participant.entry_time);
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
     * Показати індикатор завантаження
     */
    _showAdminLoader() {
        let loader = document.getElementById('admin-loader');

        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'admin-loader';
            loader.className = 'admin-loader';
            loader.innerHTML = '<div class="admin-spinner"></div>';
            document.body.appendChild(loader);
        }

        loader.style.display = 'flex';
    }

    /**
     * Приховати індикатор завантаження
     */
    _hideAdminLoader() {
        const loader = document.getElementById('admin-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * Показати повідомлення про помилку
     * @param {string} message - Текст повідомлення
     */
    _showAdminError(message) {
        this._showAdminNotification(message, 'error');
    }

    /**
     * Показати повідомлення про успіх
     * @param {string} message - Текст повідомлення
     */
    _showAdminSuccess(message) {
        this._showAdminNotification(message, 'success');
    }

    /**
     * Показати інформаційне повідомлення
     * @param {string} message - Текст повідомлення
     */
    _showAdminInfo(message) {
        this._showAdminNotification(message, 'info');
    }

    /**
     * Загальна функція для показу повідомлень
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення (info, success, error)
     */
    _showAdminNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.innerHTML = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }

    /**
     * Створення стилів для адмін-панелі розіграшів
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
            
            .status-won {
                background: rgba(255, 215, 0, 0.2);
                color: rgb(255, 215, 0);
            }
            
            .status-participated {
                background: rgba(33, 150, 243, 0.2);
                color: rgba(33, 150, 243, 1);
            }
            
            .status-refunded {
                background: rgba(156, 39, 176, 0.2);
                color: rgba(156, 39, 176, 1);
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
            
            /* Стилі для форми */
            .form-group {
                margin-bottom: 1rem;
            }
            
            .form-row {
                display: flex;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            
            .form-group.half {
                flex: 1;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.25rem;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .form-group input[type="text"],
            .form-group input[type="number"],
            .form-group input[type="datetime-local"],
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 0.5rem;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 0.25rem;
                background: rgba(0, 0, 0, 0.2);
                color: white;
            }
            
            .form-group textarea {
                resize: vertical;
                min-height: 100px;
            }
            
            .form-group.checkbox-group {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .form-group.checkbox-group input[type="checkbox"] {
                margin: 0;
            }
            
            .form-group.checkbox-group label {
                margin-bottom: 0;
            }
            
            .form-group small {
                display: block;
                margin-top: 0.25rem;
                color: rgba(255, 255, 255, 0.6);
                font-size: 0.75rem;
            }
            
            .prize-distribution-list {
                margin-top: 0.5rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .prize-distribution-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .prize-distribution-item span {
                min-width: 60px;
            }
            
            .prize-distribution-item input {
                flex: 1;
            }
            
            .prize-distribution-item .prize-currency {
                min-width: 60px;
                text-align: left;
            }
            
            /* Стилі для деталей розіграшу */
            .raffle-details-container {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            .raffle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            
            .raffle-title {
                margin: 0;
                font-size: 1.5rem;
                color: white;
            }
            
            .details-row {
                display: flex;
                gap: 1rem;
            }
            
            .details-column {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            .details-section {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 0.5rem;
                padding: 1rem;
                margin-bottom: 1rem;
            }
            
            .details-section h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1rem;
                color: white;
            }
            
            .details-section h4 {
                margin: 0.5rem 0;
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.5rem;
            }
            
            .detail-item {
                margin-bottom: 0.5rem;
            }
            
            .detail-label {
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.75rem;
                margin-bottom: 0.125rem;
            }
            
            .detail-value {
                color: white;
                font-size: 0.875rem;
                word-break: break-word;
            }
            
            .raffle-description {
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.875rem;
                line-height: 1.5;
            }
            
            .prize-list {
                margin-top: 0.5rem;
            }
            
            .prize-item {
                display: flex;
                justify-content: space-between;
                font-size: 0.875rem;
                margin-bottom: 0.25rem;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .prize-place {
                font-weight: bold;
            }
            
            .prize-value {
                color: rgba(255, 215, 0, 0.9);
            }
            
            /* Стилі для переможців */
            .winners-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                margin-top: 0.5rem;
            }
            
            .winner-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 0.25rem;
                padding: 0.5rem;
            }
            
            .winner-place {
                font-weight: bold;
                color: white;
                min-width: 80px;
            }
            
            .winner-info {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .winner-username {
                color: white;
                font-weight: bold;
            }
            
            .winner-id {
                color: rgba(255, 255, 255, 0.6);
                font-size: 0.75rem;
            }
            
            .winner-prize {
                color: rgba(255, 215, 0, 0.9);
                font-weight: bold;
            }
            
            /* Стилі для учасників */
            .participants-header {
                margin-bottom: 1rem;
                text-align: center;
            }
            
            .participants-header h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.25rem;
                color: white;
            }
            
            .participants-header p {
                margin: 0;
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.875rem;
            }
            
            .participants-table-container {
                max-height: 400px;
                overflow-y: auto;
            }
            
            /* Стилі для завантажувача */
            .admin-loader {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 2000;
                justify-content: center;
                align-items: center;
            }
            
            .admin-spinner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: rgb(30, 113, 161);
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Стилі для повідомлень */
            .admin-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 0.75rem 1rem;
                border-radius: 0.25rem;
                background: rgba(30, 39, 70, 0.9);
                color: white;
                font-size: 0.875rem;
                z-index: 2000;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                transform: translateX(calc(100% + 20px));
                transition: transform 0.3s ease;
            }
            
            .admin-notification.show {
                transform: translateX(0);
            }
            
            .admin-notification.success {
                background: rgba(76, 175, 80, 0.9);
            }
            
            .admin-notification.error {
                background: rgba(244, 67, 54, 0.9);
            }
            
            .admin-notification.info {
                background: rgba(33, 150, 243, 0.9);
            }
            
            /* Медіа-запити для адаптивності */
            @media (max-width: 768px) {
                .details-row {
                    flex-direction: column;
                }
                
                .details-grid {
                    grid-template-columns: 1fr;
                }
                
                .actions-cell {
                    flex-wrap: wrap;
                }
                
                .admin-table th, .admin-table td {
                    padding: 0.5rem 0.25rem;
                    font-size: 0.75rem;
                }
                
                .form-row {
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .prize-distribution-item {
                    flex-wrap: wrap;
                }
            }
        `;

        document.head.appendChild(styleElement);
    }

    /**
     * Обрізання тексту та доповнення трьома крапками
     * @param {string} text - Текст для обрізання
     * @param {number} maxLength - Максимальна довжина тексту
     * @returns {string} - Обрізаний текст
     */
    _truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

export default new RaffleAdmin();