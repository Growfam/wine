/**
 * index.js - Головний інтеграційний модуль для всіх функцій розіграшів
 * Об'єднує всі підмодулі та експортує єдиний інтерфейс для роботи з розіграшами
 */

import activeRaffles from './active.js';
import history from './history.js';
import stats from './stats.js';
import cards from './cards.js';
import participation from './participation.js';
import modals from './components/modals.js';
import admin from './admin/index.js';
import { formatDate, formatCurrency, formatNumber } from './formatters.js';
import { showToast, showLoading, hideLoading, showConfirm } from './ui-helpers.js';

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
    }

    /**
     * Ініціалізація всіх модулів розіграшів
     */
    init() {
        console.log("🎮 Raffles Module: Ініціалізація основного модуля розіграшів");

        // Ініціалізуємо підмодулі
        this.activeRaffles.init();
        this.history.init();
        this.modals.init();

        // Перевіряємо, чи користувач є адміністратором
        this._checkAdminAccess();

        // Ініціалізуємо функції переключення вкладок
        this._initTabSwitching();

        console.log("✅ Raffles Module: Ініціалізацію завершено");
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

        // Викликаємо відповідні функції в залежності від вкладки
        if (tabName === 'past' || tabName === 'history') {
            this.history.displayHistory('history-container');
        } else if (tabName === 'active') {
            this.activeRaffles.displayActiveRaffles();
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
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    this.switchTab(tabName);
                });
            });
        }

        // Створюємо глобальну функцію переключення вкладок
        window.switchRaffleTab = this.switchTab.bind(this);
    }

    /**
     * Відкриття деталей розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
     */
    openRaffleDetails(raffleId, raffleType) {
        this.modals.openRaffleDetails(raffleId, raffleType);
    }

    /**
     * Експорт всіх необхідних функцій для використання в інших модулях
     */
    exportGlobalFunctions() {
        window.rafflesModule = this;

        // Додаємо функції для глобального використання
        window.openRaffleDetails = this.openRaffleDetails.bind(this);
        window.showRaffleHistoryDetails = this.modals.showRaffleHistoryDetails.bind(this.modals);

        // Створюємо об'єкт rafflesFunctions для зворотної сумісності зі старим кодом
        window.rafflesFunctions = {
            switchTab: this.switchTab.bind(this),
            loadRaffleHistory: this.history.displayHistory.bind(this.history),
            resetAllStates: this.activeRaffles.resetAllStates.bind(this.activeRaffles)
        };
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
        rafflesModule.exportGlobalFunctions();
    });
} else {
    // У випадку, якщо DOM вже завантажено
    setTimeout(() => {
        rafflesModule.init();
        rafflesModule.exportGlobalFunctions();
    }, 100);
}