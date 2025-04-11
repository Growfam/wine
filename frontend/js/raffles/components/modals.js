/**
 * modals.js - Модуль для роботи з модальними вікнами розіграшів
 * Відповідає за створення та управління модальними вікнами для розіграшів
 */

import { formatDate } from '../utils/formatters.js';
import { showToast, getElement } from '../utils/ui-helpers.js';
import api from '../services/api.js';
import WinixRaffles from '../globals.js';

/**
 * Клас для управління модальними вікнами розіграшів
 */
class RaffleModals {
    /**
     * Конструктор класу
     */
    constructor() {
        this._modals = {};
        this._activeModals = [];
        this._eventListeners = [];
    }

    /**
     * Ініціалізація модальних вікон для розіграшів
     */
    init() {
        // Додаємо обробники подій для існуючих модальних вікон
        this._setupExistingModals();

        // Додаємо обробники для взаємодії з іншими модулями через події
        this._setupGlobalEventListeners();

        console.log("🖼️ Raffle Modals: Ініціалізовано");
    }

    /**
     * Налаштування існуючих модальних вікон на сторінці
     * @private
     */
    _setupExistingModals() {
        // Знаходимо всі модальні вікна на сторінці
        const modals = document.querySelectorAll('.raffle-modal');

        modals.forEach(modal => {
            const modalId = modal.id;
            if (!modalId) return;

            // Зберігаємо посилання на модальне вікно
            this._modals[modalId] = modal;

            // Додаємо обробники для закриття
            const closeButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
            closeButtons.forEach(btn => {
                const closeHandler = () => this.closeModal(modalId);
                btn.addEventListener('click', closeHandler);

                // Зберігаємо обробник для можливості видалення
                this._eventListeners.push({
                    element: btn,
                    event: 'click',
                    handler: closeHandler
                });
            });

            // Закриття модального вікна по кліку на фон (якщо клік був саме на фоні)
            const backgroundClickHandler = (e) => {
                if (e.target === modal) {
                    this.closeModal(modalId);
                }
            };

            modal.addEventListener('click', backgroundClickHandler);

            // Зберігаємо обробник для можливості видалення
            this._eventListeners.push({
                element: modal,
                event: 'click',
                handler: backgroundClickHandler
            });
        });
    }

    /**
     * Налаштування глобальних обробників подій
     * @private
     */
    _setupGlobalEventListeners() {
        // Обробник для показу деталей історії розіграшу
        WinixRaffles.events.on('show-history-details', (data) => {
            if (data && data.raffleData) {
                this.showRaffleHistoryDetails(data.raffleData);
            }
        });
    }

    /**
     * Показати деталі розіграшу з історії
     * @param {Object} raffleData - Дані розіграшу
     */
    showRaffleHistoryDetails(raffleData) {
        if (!raffleData) {
            showToast('Не вдалося отримати дані розіграшу', 'error');
            return;
        }

        // Видаляємо існуюче модальне вікно історії, якщо воно є
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
            winnersHTML = this._generateWinnersListHTML(raffleData.winners);
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
            const closeHandler = () => {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            };

            closeButton.addEventListener('click', closeHandler);

            // Зберігаємо обробник
            this._eventListeners.push({
                element: closeButton,
                event: 'click',
                handler: closeHandler
            });
        }

        const closeActionButton = modal.querySelector('#close-history-btn');
        if (closeActionButton) {
            const closeHandler = () => {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            };

            closeActionButton.addEventListener('click', closeHandler);

            // Зберігаємо обробник
            this._eventListeners.push({
                element: closeActionButton,
                event: 'click',
                handler: closeHandler
            });
        }

        // Показуємо модальне вікно
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });

        // Зберігаємо посилання на модальне вікно
        this._modals['raffle-history-modal'] = modal;
        this._activeModals.push('raffle-history-modal');

        return modal;
    }

    /**
     * Генерування HTML для списку переможців
     * @param {Array} winners - Масив з переможцями
     * @returns {string} - HTML-розмітка
     * @private
     */
    _generateWinnersListHTML(winners) {
        if (!winners || !Array.isArray(winners) || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        // Сортуємо переможців за місцем (спочатку найвищі)
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
    }

    /**
     * Створення модального вікна конфірмації
     * @param {string} message - Повідомлення
     * @param {string} [confirmText='Так'] - Текст кнопки підтвердження
     * @param {string} [cancelText='Ні'] - Текст кнопки скасування
     * @returns {Promise<boolean>} - Результат підтвердження
     */
    showConfirm(message, confirmText = 'Так', cancelText = 'Ні') {
        return new Promise((resolve) => {
            // Створюємо унікальний ID для модального вікна
            const modalId = 'confirm-modal-' + Date.now();

            // Створюємо модальне вікно
            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'raffle-modal confirm-modal';

            modal.innerHTML = `
                <div class="modal-content confirm-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Підтвердження</h2>
                        <span class="modal-close">×</span>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn">${cancelText}</button>
                        <button class="confirm-btn">${confirmText}</button>
                    </div>
                </div>
            `;

            // Додаємо на сторінку
            document.body.appendChild(modal);

            // Додаємо обробники подій
            const closeButton = modal.querySelector('.modal-close');
            const cancelButton = modal.querySelector('.cancel-btn');
            const confirmButton = modal.querySelector('.confirm-btn');

            const closeHandler = () => {
                modal.classList.remove('open');
                setTimeout(() => {
                    modal.remove();
                    resolve(false);
                }, 300);
            };

            const confirmHandler = () => {
                modal.classList.remove('open');
                setTimeout(() => {
                    modal.remove();
                    resolve(true);
                }, 300);
            };

            // Призначаємо обробники
            closeButton.addEventListener('click', closeHandler);
            cancelButton.addEventListener('click', closeHandler);
            confirmButton.addEventListener('click', confirmHandler);

            // Показуємо модальне вікно
            setTimeout(() => {
                modal.classList.add('open');
                // Фокус на кнопці підтвердження
                confirmButton.focus();
            }, 10);
        });
    }

    /**
     * Відкриття модального вікна за його ID
     * @param {string} modalId - ID модального вікна
     */
    openModal(modalId) {
        const modal = this._modals[modalId] || getElement(`#${modalId}`);

        if (!modal) {
            console.error(`Модальне вікно з id ${modalId} не знайдено`);
            return;
        }

        // Додаємо клас для відображення
        modal.classList.add('open');

        // Додаємо до списку активних модальних вікон
        if (!this._activeModals.includes(modalId)) {
            this._activeModals.push(modalId);
        }

        // Блокуємо скролл на фоні
        document.body.style.overflow = 'hidden';
    }

    /**
     * Закриття модального вікна за його ID
     * @param {string} modalId - ID модального вікна
     */
    closeModal(modalId) {
        const modal = this._modals[modalId] || getElement(`#${modalId}`);

        if (!modal) return;

        // Видаляємо клас для приховування
        modal.classList.remove('open');

        // Видаляємо зі списку активних модальних вікон
        const index = this._activeModals.indexOf(modalId);
        if (index !== -1) {
            this._activeModals.splice(index, 1);
        }

        // Розблоковуємо скролл, якщо немає активних модальних вікон
        if (this._activeModals.length === 0) {
            document.body.style.overflow = '';
        }
    }

    /**
     * Закриття всіх відкритих модальних вікон
     */
    closeAllModals() {
        // Копіюємо масив, щоб уникнути проблем з ітерацією при змінах
        const activeModals = [...this._activeModals];

        activeModals.forEach(modalId => {
            this.closeModal(modalId);
        });

        // Розблоковуємо скролл
        document.body.style.overflow = '';
    }

    /**
     * Знищення модуля та звільнення ресурсів
     */
    destroy() {
        // Закриваємо всі відкриті модальні вікна
        this.closeAllModals();

        // Видаляємо всі обробники подій
        this._eventListeners.forEach(listener => {
            if (listener.element) {
                listener.element.removeEventListener(listener.event, listener.handler);
            }
        });

        // Очищаємо масиви
        this._eventListeners = [];
        this._activeModals = [];
        this._modals = {};

        console.log("🚫 Raffle Modals: Модуль знищено");
    }
}

// Створюємо екземпляр класу
const raffleModals = new RaffleModals();

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.modals = raffleModals;

// Ініціалізуємо модуль при завантаженні документа
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => raffleModals.init());
} else {
    setTimeout(() => raffleModals.init(), 100);
}

export default raffleModals;