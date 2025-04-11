/**
 * index.js - Головний інтеграційний модуль для всіх функцій розіграшів
 * Об'єднує всі підмодулі та експортує єдиний інтерфейс для роботи з розіграшами
 */

import WinixRaffles from './globals.js';
import activeRaffles from './modules/active.js';
import history from './modules/history.js';
import stats from './modules/stats.js';
import cards from './components/cards.js';
import participation from './modules/participation.js';
import modals from './components/modals.js';
import admin from './admin/index.js';
import {
    formatDate,
    formatCurrency,
    formatNumber
} from './utils/formatters.js';
import {
    showToast,
    showLoading,
    hideLoading,
    showConfirm
} from './utils/ui-helpers.js';

/**
 * Клас для управління модулями розіграшів і забезпечення єдиної точки входу
 */
class RafflesModule {
    constructor() {
        // Зберігаємо посилання на підмодулі для доступу до їх функцій
        this.activeRaffles = activeRaffles;
        this.history = history;
        this.stats = stats;
        this.cards = cards;
        this.participation = participation;
        this.modals = modals;
        this.admin = admin;

        // Зберігаємо посилання на утиліти для зручного доступу
        this.formatters = {
            formatDate,
            formatCurrency,
            formatNumber
        };

        this.ui = {
            showToast,
            showLoading,
            hideLoading,
            showConfirm
        };

        // Прапорець ініціалізації
        this._initialized = false;

        // Список обробників подій для можливості видалення
        this._eventListeners = [];
    }

    /**
     * Ініціалізація всіх модулів розіграшів
     */
    init() {
        if (this._initialized) {
            console.warn("Raffles Module: Модуль уже ініціалізовано");
            return this;
        }

        console.log("🎮 Raffles Module: Ініціалізація основного модуля розіграшів");

        // Додаємо обробники подій для перемикання вкладок
        this._initTabSwitching();

        // Ініціалізуємо підмодулі
        this.activeRaffles.init();
        this.history.init();
        this.modals.init();
        this.stats.init();
        this.participation.init();

        // Перевіряємо, чи користувач є адміністратором
        this._checkAdminAccess();

        // Підписуємося на події
        this._setupEventListeners();

        // Експортуємо глобальні функції
        this.exportGlobalFunctions();

        // Встановлюємо прапорець ініціалізації
        this._initialized = true;

        console.log("✅ Raffles Module: Ініціалізацію завершено");

        return this;
    }

    /**
     * Переключення між вкладками розіграшів
     * @param {string} tabName - Назва вкладки для активації
     */
    switchTab(tabName) {
        console.log(`🎮 Raffles: Переключення на вкладку ${tabName}`);

        // Оновлюємо активну вкладку
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabSections = document.querySelectorAll('.tab-content');

        // Знімаємо активний стан з усіх вкладок і секцій
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabSections.forEach(section => section.classList.remove('active'));

        // Додаємо активний стан до вибраної вкладки і секції
        const activeTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        const activeTabSection = document.getElementById(`${tabName}-raffles`);

        if (activeTabButton) activeTabButton.classList.add('active');
        if (activeTabSection) activeTabSection.classList.add('active');

        // Емітуємо подію про зміну вкладки
        WinixRaffles.events.emit('tab-switched', { tab: tabName });

        // Викликаємо відповідні функції в залежності від вкладки
        if (tabName === 'past' || tabName === 'history') {
            this.history.displayHistory('history-container');
        } else if (tabName === 'active') {
            this.activeRaffles.displayRaffles();
        } else if (tabName === 'stats') {
            this.stats.displayUserStats('user-stats-container');
        } else if (tabName === 'admin' && this._isAdmin) {
            this.admin.displayRafflesList();
        }
    }

    /**
     * Перевірка наявності адміністраторських прав
     * @private
     */
    async _checkAdminAccess() {
        try {
            // Перевіряємо наявність модуля AdminAPI
            if (window.AdminAPI && typeof window.AdminAPI.getAdminId === 'function') {
                const adminId = window.AdminAPI.getAdminId();
                if (adminId) {
                    this._isAdmin = true;

                    // Ініціалізуємо адміністративний модуль
                    if (document.getElementById('admin-raffles-container')) {
                        this.admin.init();
                    }

                    console.log("👑 Raffles Module: Виявлено адміністраторські права");
                }
            }
        } catch (error) {
            console.error('Помилка перевірки адміністративного доступу:', error);
            this._isAdmin = false;
        }
    }

    /**
     * Ініціалізація функцій переключення вкладок
     * @private
     */
    _initTabSwitching() {
        // Обробники подій для перемикання вкладок
        const tabButtons = document.querySelectorAll('.tab-button');
        if (tabButtons.length > 0) {
            tabButtons.forEach(button => {
                const clickHandler = () => {
                    const tabName = button.getAttribute('data-tab');
                    this.switchTab(tabName);
                };

                button.addEventListener('click', clickHandler);

                // Зберігаємо обробник для можливості видалення
                this._eventListeners.push({
                    element: button,
                    event: 'click',
                    handler: clickHandler
                });
            });
        }
    }

    /**
     * Встановлення обробників подій
     * @private
     */
    _setupEventListeners() {
        // Обробник ініціалізації сервісу
        const initHandler = () => {
            if (!this._initialized) {
                this.init();
            }
        };

        document.addEventListener('winix-initialized', initHandler);

        // Зберігаємо обробник для можливості видалення
        this._eventListeners.push({
            element: document,
            event: 'winix-initialized',
            handler: initHandler
        });

        // Обробник події оновлення даних користувача
        const userDataHandler = (event) => {
            if (event.detail && event.detail.isAdmin) {
                this._isAdmin = true;
                // Ініціалізуємо адміністративний модуль, якщо доступний
                if (document.getElementById('admin-raffles-container') && this.admin) {
                    this.admin.init();
                }
            }
        };

        document.addEventListener('user-data-updated', userDataHandler);

        // Зберігаємо обробник для можливості видалення
        this._eventListeners.push({
            element: document,
            event: 'user-data-updated',
            handler: userDataHandler
        });
    }

    /**
     * Видалення обробників подій
     * @private
     */
    _removeEventListeners() {
        // Видаляємо всі збережені обробники
        this._eventListeners.forEach(listener => {
            if (listener.element) {
                listener.element.removeEventListener(listener.event, listener.handler);
            }
        });

        // Очищаємо масив
        this._eventListeners = [];
    }

    /**
     * Експорт всіх необхідних функцій для використання в інших модулях
     */
    exportGlobalFunctions() {
        window.rafflesModule = this;

        // Додаємо функції для глобального використання
        window.openRaffleDetails = (raffleId, raffleType) => {
            WinixRaffles.events.emit('open-raffle-details', { raffleId, raffleType });
        };

        window.showRaffleHistoryDetails = (raffleData) => {
            WinixRaffles.events.emit('show-history-details', { raffleData });
        };

        // Створюємо об'єкт rafflesFunctions для зворотної сумісності зі старим кодом
        window.rafflesFunctions = {
            switchTab: this.switchTab.bind(this),
            loadRaffleHistory: this.history.displayHistory.bind(this.history),
            resetAllStates: this.resetAllStates.bind(this)
        };

        return this;
    }

    /**
     * Скидання всіх станів
     */
    resetAllStates() {
        // Скидання станів у всіх модулях
        this.activeRaffles.resetAllStates();

        if (this.history && typeof this.history.resetRequestState === 'function') {
            this.history.resetRequestState();
        }

        // Закриття всіх модальних вікон
        this.modals.closeAllModals();

        // Приховування лоадерів
        WinixRaffles.loader.hideAll();

        return this;
    }

    /**
     * Знищення модуля і звільнення ресурсів
     */
    destroy() {
        if (!this._initialized) {
            return this;
        }

        console.log("🚫 Raffles Module: Знищення модулів розіграшів");

        // Скидаємо всі стани
        this.resetAllStates();

        // Видаляємо обробники подій
        this._removeEventListeners();

        // Знищуємо підмодулі
        if (this.activeRaffles && typeof this.activeRaffles.destroy === 'function') {
            this.activeRaffles.destroy();
        }

        if (this.history && typeof this.history.destroy === 'function') {
            this.history.destroy();
        }

        if (this.stats && typeof this.stats.destroy === 'function') {
            this.stats.destroy();
        }

        if (this.modals && typeof this.modals.destroy === 'function') {
            this.modals.destroy();
        }

        if (this.participation && typeof this.participation.destroy === 'function') {
            this.participation.destroy();
        }

        if (this.admin && typeof this.admin.destroy === 'function') {
            this.admin.destroy();
        }

        // Скидаємо прапорець ініціалізації
        this._initialized = false;

        console.log("✅ Raffles Module: Модулі успішно знищено");

        return this;
    }
}

// Створюємо екземпляр модуля
const rafflesModule = new RafflesModule();

// Експортуємо модуль
export default rafflesModule;

// Автоматична ініціалізація при завантаженні
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        rafflesModule.init();
    });
} else {
    // У випадку, якщо DOM вже завантажено
    setTimeout(() => {
        rafflesModule.init();
    }, 100);
}