/**
 * UI компонент для розіграшів - відображає розіграші та обробляє помилки
 * Додає кнопку оновлення та відображає статус перевірки розіграшів
 */

import WinixRaffles from '../globals.js';
import { showLoading, hideLoading, showToast } from '/ui-helpers.js';
import api from '../services/api.js';

/**
 * Клас UI компонента розіграшів
 */
class RafflesUIComponent {
    /**
     * Ініціалізація компонента
     */
    init() {
        console.log("🎮 RafflesUI: Ініціалізація UI компонента розіграшів");

        try {
            // Додаємо кнопку оновлення розіграшів на сторінку
            this._addRefreshButton();

            // Налаштування перехоплювачів подій
            this._setupEventListeners();

            console.log("✅ RafflesUI: Компонент успішно ініціалізовано");
        } catch (error) {
            console.error("❌ RafflesUI: Помилка ініціалізації:", error);
        }
    }

    /**
     * Додає кнопку оновлення розіграшів на сторінку
     * @private
     */
    _addRefreshButton() {
        try {
            // Перевіряємо, чи існує контейнер розіграшів
            const rafflesSection = document.querySelector('.raffles-section');
            if (!rafflesSection) return;

            // Перевіряємо, чи вже є кнопка оновлення
            if (document.getElementById('refresh-raffles-btn')) return;

            // Створюємо кнопку оновлення
            const refreshButton = document.createElement('button');
            refreshButton.id = 'refresh-raffles-btn';
            refreshButton.className = 'refresh-btn';
            refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Оновити список';

            // Додаємо обробник події
            refreshButton.addEventListener('click', () => {
                this.refreshRafflesList();
            });

            // Додаємо кнопку перед контейнером розіграшів
            const rafflesContainer = rafflesSection.querySelector('.raffles-container') ||
                                     rafflesSection.querySelector('.raffle-cards');

            if (rafflesContainer) {
                rafflesSection.insertBefore(refreshButton, rafflesContainer);
            } else {
                rafflesSection.appendChild(refreshButton);
            }

            // Додаємо стилі для кнопки
            const style = document.createElement('style');
            style.textContent = `
                .refresh-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #4e54c8;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    margin: 10px auto;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.3s;
                }
                
                .refresh-btn i {
                    margin-right: 8px;
                }
                
                .refresh-btn:hover {
                    background-color: #3f45a6;
                }
                
                .refresh-btn.refreshing i {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .raffle-status {
                    text-align: center;
                    margin: 10px 0;
                    font-size: 14px;
                    color: #666;
                }
            `;

            document.head.appendChild(style);

            // Додаємо елемент для відображення статусу розіграшів
            const statusElement = document.createElement('div');
            statusElement.id = 'raffle-status';
            statusElement.className = 'raffle-status';

            rafflesSection.insertBefore(statusElement, refreshButton.nextSibling);
        } catch (error) {
            console.error("RafflesUI: Помилка додавання кнопки оновлення:", error);
        }
    }

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventListeners() {
        try {
            if (WinixRaffles && WinixRaffles.events) {
                // Підписуємося на події оновлення розіграшів
                WinixRaffles.events.on('raffles-updated', (data) => {
                    this.updateRafflesStatus(data);
                });

                // Підписуємося на події помилок розіграшів
                WinixRaffles.events.on('raffle-error', (error) => {
                    this.handleRaffleError(error);
                });

                // Підписуємося на події оновлення розіграшів
                WinixRaffles.events.on('refresh-raffles', (data) => {
                    const force = data && data.force;
                    this.refreshRafflesList(force);
                });
            }

            // Обробник помилок API
            document.addEventListener('api-error', (event) => {
                const error = event.detail;

                // Якщо помилка з кодом raffleId, спробуємо виправити
                if (error && error.message &&
                    (error.message.includes('raffle_id') ||
                     error.message.includes('raffleId') ||
                     error.message.includes('розіграш'))) {

                    this.handleRaffleError(error);
                }
            });
        } catch (error) {
            console.error("RafflesUI: Помилка налаштування обробників подій:", error);
        }
    }

    /**
     * Оновлення списку розіграшів
     * @param {boolean} force Примусове оновлення, навіть якщо недавно оновлювалися
     */
    refreshRafflesList(force = false) {
        try {
            // Отримуємо кнопку оновлення
            const refreshButton = document.getElementById('refresh-raffles-btn');

            // Перевіряємо, чи кнопка не в процесі оновлення
            if (refreshButton && refreshButton.classList.contains('refreshing') && !force) {
                return;
            }

            // Позначаємо кнопку як в процесі оновлення
            if (refreshButton) {
                refreshButton.classList.add('refreshing');
                refreshButton.disabled = true;
            }

            // Оновлюємо статус
            this.updateRafflesStatus({ message: 'Оновлення списку розіграшів...' });

            // Викликаємо оновлення через middleware
            if (WinixRaffles && WinixRaffles.middleware) {
                WinixRaffles.middleware.refreshActiveRaffleIds()
                    .then(raffleIds => {
                        // Оновлюємо після отримання результату
                        if (refreshButton) {
                            refreshButton.classList.remove('refreshing');
                            refreshButton.disabled = false;
                        }

                        // Перезавантажуємо сторінку, якщо примусове оновлення
                        if (force) {
                            showToast('Список розіграшів оновлено', 'success');

                            // Перезавантажуємо розіграші на сторінці
                            this.reloadRafflesUI();
                        }
                    })
                    .catch(error => {
                        console.error("RafflesUI: Помилка оновлення розіграшів:", error);

                        if (refreshButton) {
                            refreshButton.classList.remove('refreshing');
                            refreshButton.disabled = false;
                        }

                        showToast('Помилка оновлення списку розіграшів', 'error');

                        // Оновлюємо статус з помилкою
                        this.updateRafflesStatus({
                            message: 'Помилка оновлення списку розіграшів',
                            error: true
                        });
                    });
            } else {
                if (refreshButton) {
                    refreshButton.classList.remove('refreshing');
                    refreshButton.disabled = false;
                }

                // Якщо модуль middleware недоступний, оновлюємо сторінку
                showToast('Оновлення списку розіграшів...', 'info');
                setTimeout(() => location.reload(), 1000);
            }
        } catch (error) {
            console.error("RafflesUI: Помилка оновлення розіграшів:", error);

            // Відновлюємо стан кнопки
            const refreshButton = document.getElementById('refresh-raffles-btn');
            if (refreshButton) {
                refreshButton.classList.remove('refreshing');
                refreshButton.disabled = false;
            }

            showToast('Помилка оновлення списку розіграшів', 'error');
        }
    }

    /**
     * Оновлення відображення статусу розіграшів
     * @param {Object} data Дані про стан розіграшів
     */
    updateRafflesStatus(data = {}) {
        try {
            const statusElement = document.getElementById('raffle-status');
            if (!statusElement) return;

            if (data.message) {
                statusElement.textContent = data.message;

                if (data.error) {
                    statusElement.style.color = '#e74c3c';
                } else {
                    statusElement.style.color = '#666';
                }
            } else if (data.count !== undefined) {
                const timestamp = new Date(data.timestamp).toLocaleTimeString();
                statusElement.textContent = `Активних розіграшів: ${data.count} (оновлено о ${timestamp})`;
                statusElement.style.color = '#27ae60';
            } else {
                statusElement.textContent = '';
            }
        } catch (error) {
            console.error("RafflesUI: Помилка оновлення статусу розіграшів:", error);
        }
    }

    /**
     * Обробка помилок, пов'язаних з розіграшами
     * @param {Object} error Об'єкт з інформацією про помилку
     */
    handleRaffleError(error) {
        try {
            console.warn("RafflesUI: Обробка помилки розіграшу:", error);

            // Визначаємо тип помилки
            let errorType = 'unknown';
            let raffleId = null;

            // Спробуємо знайти ID розіграшу в повідомленні про помилку
            if (error.message) {
                const idMatch = error.message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                if (idMatch) {
                    raffleId = idMatch[0];
                }
            }

            // Якщо маємо епоінт з ID розіграшу, витягуємо звідти
            if (error.endpoint && error.endpoint.includes('raffles/')) {
                const idMatch = error.endpoint.match(/raffles\/([0-9a-f-]+)/i);
                if (idMatch && idMatch[1]) {
                    raffleId = idMatch[1];
                }
            }

            // Якщо це помилка 404, розіграш не знайдено
            if (error.status === 404 ||
                (error.message && error.message.includes('не знайдено')) ||
                (error.code && error.code === 'raffle_not_found')) {
                errorType = 'not_found';
            }
            // Якщо це помилка валідації UUID
            else if ((error.message && error.message.includes('UUID')) ||
                    (error.code && error.code === 'invalid_raffle_id')) {
                errorType = 'invalid_id';
            }

            // Виконуємо дії залежно від типу помилки
            if (errorType === 'not_found' || errorType === 'invalid_id') {
                // Очищуємо неіснуючий ID з кешу
                if (WinixRaffles && WinixRaffles.middleware) {
                    // Якщо знайшли ID розіграшу, видаляємо з локального сховища
                    if (raffleId) {
                        console.log(`RafflesUI: Очищення ID розіграшу ${raffleId} з кешу`);

                        // Оновлюємо список активних розіграшів
                        WinixRaffles.middleware.clearCache();
                    } else {
                        // Оновлюємо список активних розіграшів
                        WinixRaffles.middleware.refreshActiveRaffleIds();
                    }
                }

                // Показуємо повідомлення користувачу
                showToast('Розіграш не знайдено або вже завершено. Оновіть список.', 'warning');
            } else {
                // Для невідомих помилок просто показуємо повідомлення
                showToast('Виникла помилка при роботі з розіграшами. Спробуйте оновити список.', 'error');
            }

            // Оновлюємо статус з помилкою
            this.updateRafflesStatus({
                message: 'Виявлено помилку з розіграшами. Рекомендуємо оновити список.',
                error: true
            });
        } catch (err) {
            console.error("RafflesUI: Помилка обробки помилки розіграшу:", err);
        }
    }

    /**
     * Перезавантаження UI компонентів розіграшів на сторінці
     */
    reloadRafflesUI() {
        try {
            // Перевіряємо наявність основних компонентів
            if (!WinixRaffles) return;

            // Якщо є метод ініціалізації розіграшів, викликаємо його
            if (WinixRaffles.initRaffles && typeof WinixRaffles.initRaffles === 'function') {
                WinixRaffles.initRaffles();
            }

            // Якщо є метод завантаження розіграшів, викликаємо його
            if (WinixRaffles.loadRaffles && typeof WinixRaffles.loadRaffles === 'function') {
                WinixRaffles.loadRaffles();
            }

            // Якщо є модуль виведення активних розіграшів
            if (WinixRaffles.active && WinixRaffles.active.loadActiveRaffles) {
                WinixRaffles.active.loadActiveRaffles();
            }
        } catch (error) {
            console.error("RafflesUI: Помилка перезавантаження UI розіграшів:", error);
        }
    }
}

// Створюємо екземпляр класу
const rafflesUI = new RafflesUIComponent();

// Додаємо в глобальний об'єкт для доступу з інших модулів
if (WinixRaffles) {
    WinixRaffles.ui = rafflesUI;
}

// Автоматична ініціалізація при завантаженні
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => rafflesUI.init());
} else {
    setTimeout(() => rafflesUI.init(), 200);
}

export default rafflesUI;