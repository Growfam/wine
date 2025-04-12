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
import admin from './admin/management.js';
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

// Додана змінна для контролю частоти запитів
window._lastRequestTime = 0;

/**
 * Перевірка, чи пристрій онлайн
 * @returns {boolean} Стан підключення
 */
function isOnline() {
    return typeof navigator.onLine === 'undefined' || navigator.onLine;
}

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

        // Прапорець, що відстежує процес ініціалізації
        this._initializationInProgress = false;

        // Лічильник спроб ініціалізації
        this._initializationAttempts = 0;

        // Максимальна кількість спроб ініціалізації
        this._maxInitializationAttempts = 3;

        // Таймаут для повторної спроби ініціалізації
        this._initializationTimeout = null;

        // Список обробників подій для можливості видалення
        this._eventListeners = [];
    }

    /**
     * Ініціалізація всіх модулів розіграшів
     * @param {boolean} forceInit - Примусова ініціалізація, навіть якщо в процесі
     * @returns {Promise<RafflesModule>} Екземпляр модуля
     */
    async init(forceInit = false) {
        // Якщо вже ініціалізовано або в процесі ініціалізації
        if (this._initialized && !forceInit) {
            console.warn("Raffles Module: Модуль уже ініціалізовано");
            return this;
        }

        // Запобігаємо паралельним викликам init
        if (this._initializationInProgress && !forceInit) {
            console.warn("Raffles Module: Ініціалізація вже виконується");
            return this;
        }

        // Очищаємо таймаут, якщо він є
        if (this._initializationTimeout) {
            clearTimeout(this._initializationTimeout);
            this._initializationTimeout = null;
        }

        this._initializationInProgress = true;
        this._initializationAttempts++;

        try {
            console.log("🎮 Raffles Module: Ініціалізація основного модуля розіграшів");

            // Додаємо обробники подій для перемикання вкладок
            this._initTabSwitching();

            // Ініціалізуємо підмодулі по черзі, з обробкою помилок
            // Порядок ініціалізації важливий для залежностей між модулями

            // Спочатку ініціалізуємо модалі, оскільки вони використовуються іншими модулями
            try {
                await Promise.resolve(this.modals.init());
                console.log("✅ Raffles Module: Модалі успішно ініціалізовано");
            } catch (error) {
                console.error("❌ Помилка ініціалізації модалей:", error);
                // Не критична помилка, продовжуємо ініціалізацію
            }

            // Ініціалізуємо активні розіграші
            try {
                await Promise.resolve(this.activeRaffles.init());
                console.log("✅ Raffles Module: Активні розіграші успішно ініціалізовано");
            } catch (error) {
                console.error("❌ Помилка ініціалізації активних розіграшів:", error);
                // Не критична помилка, продовжуємо ініціалізацію
            }

            // Ініціалізуємо історію і статистику паралельно,
            // але не чекаємо на їх завершення для продовження
            Promise.resolve(this.history.init()).catch(error => {
                console.error("❌ Помилка ініціалізації історії:", error);
            });

            Promise.resolve(this.stats.init()).catch(error => {
                console.error("❌ Помилка ініціалізації статистики:", error);
            });

            // Ініціалізуємо модуль участі
            try {
                await Promise.resolve(this.participation.init());
                console.log("✅ Raffles Module: Модуль участі успішно ініціалізовано");
            } catch (error) {
                console.error("❌ Помилка ініціалізації модуля участі:", error);
                // Не критична помилка, продовжуємо ініціалізацію
            }

            // Перевіряємо, чи користувач є адміністратором
            this._checkAdminAccess();

            // Підписуємося на події
            this._setupEventListeners();

            // Експортуємо глобальні функції
            this.exportGlobalFunctions();

            // Встановлюємо прапорець ініціалізації
            this._initialized = true;
            this._initializationInProgress = false;

            console.log("✅ Raffles Module: Ініціалізацію завершено");

            return this;
        } catch (error) {
            console.error("❌ Критична помилка при ініціалізації модуля розіграшів:", error);

            // Скидаємо прапорець ініціалізації в процесі
            this._initializationInProgress = false;

            // Якщо кількість спроб менша за максимальну, повторюємо ініціалізацію
            if (this._initializationAttempts < this._maxInitializationAttempts) {
                console.log(`🔄 Raffles Module: Повторна спроба ініціалізації (${this._initializationAttempts}/${this._maxInitializationAttempts})...`);

                // Очищаємо попередні стани
                this.resetAllStates();

                // Чекаємо 3 секунди перед повторною спробою
                this._initializationTimeout = setTimeout(() => {
                    this.init(true);
                }, 3000);
            } else {
                console.error("❌ Raffles Module: Досягнуто максимальної кількості спроб ініціалізації");

                // Показуємо повідомлення про помилку
                this.ui.showToast("Не вдалося ініціалізувати модуль розіграшів", "error");

                // Скидаємо лічильник спроб
                this._initializationAttempts = 0;
            }

            return this;
        }
    }

    /**
     * Переключення між вкладками розіграшів
     * @param {string} tabName - Назва вкладки для активації
     */
    switchTab(tabName) {
        if (!tabName) {
            console.error("Название вкладки не указано");
            return;
        }

        console.log(`🎮 Raffles: Переключення на вкладку ${tabName}`);

        try {
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
                // Перевіряємо, чи пристрій онлайн
                if (!isOnline()) {
                    this.ui.showToast("Історія недоступна без підключення до Інтернету", "warning");
                } else {
                    this.history.displayHistory('history-container');
                }
            } else if (tabName === 'active') {
                this.activeRaffles.displayRaffles();
            } else if (tabName === 'stats') {
                // Перевіряємо, чи модуль статистики має необхідну функцію
                if (this.stats && typeof this.stats.displayUserStats === 'function') {
                    // Перевіряємо, чи пристрій онлайн
                    if (!isOnline()) {
                        this.ui.showToast("Статистика недоступна без підключення до Інтернету", "warning");
                    } else {
                        this.stats.displayUserStats('user-stats-container');
                    }
                } else {
                    console.error("❌ Функція displayUserStats не знайдена в модулі статистики");
                    // Відображаємо резервне повідомлення
                    const container = document.getElementById('user-stats-container');
                    if (container) {
                        container.innerHTML = `
                            <div class="empty-stats">
                                <div class="empty-stats-icon">📊</div>
                                <h3>Статистика тимчасово недоступна</h3>
                                <p>Спробуйте оновити сторінку або повторіть спробу пізніше.</p>
                            </div>
                        `;
                    }
                }
            } else if (tabName === 'admin' && this._isAdmin) {
                // Перевіряємо, чи пристрій онлайн
                if (!isOnline()) {
                    this.ui.showToast("Адмін-панель недоступна без підключення до Інтернету", "warning");
                } else {
                    this.admin.displayRafflesList();
                }
            }
        } catch (error) {
            console.error("Помилка при переключенні вкладок:", error);
            this.ui.showToast("Помилка при зміні вкладки", "error");
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
        // Очищаємо попередні обробники, щоб уникнути дублювання
        this._removeEventListeners();

        // Обробники подій для перемикання вкладок
        const tabButtons = document.querySelectorAll('.tab-button');
        if (tabButtons.length > 0) {
            tabButtons.forEach(button => {
                const clickHandler = () => {
                    const tabName = button.getAttribute('data-tab');
                    if (tabName) {
                        this.switchTab(tabName);
                    }
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
            if (!this._initialized && !this._initializationInProgress) {
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

        // Обробники подій онлайн/офлайн
        const onlineHandler = () => {
            console.log("🎮 Raffles Module: З'єднання з мережею відновлено");

            // Оновлюємо активні дані
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                if (tabName) {
                    // Затримка для запобігання негайних запитів після відновлення з'єднання
                    setTimeout(() => {
                        this.switchTab(tabName);
                    }, 2000);
                }
            }
        };

        const offlineHandler = () => {
            console.warn("🎮 Raffles Module: З'єднання з мережею втрачено");
            this.ui.showToast("З'єднання з мережею втрачено. Деякі функції можуть бути недоступні.", "warning");
        };

        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        // Зберігаємо обробники
        this._eventListeners.push(
            { element: window, event: 'online', handler: onlineHandler },
            { element: window, event: 'offline', handler: offlineHandler }
        );
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
            // Перевіряємо, чи пристрій онлайн
            if (!isOnline()) {
                this.ui.showToast("Деталі розіграшу недоступні без підключення до Інтернету", "warning");
                return;
            }

            WinixRaffles.events.emit('open-raffle-details', { raffleId, raffleType });
        };

        window.showRaffleHistoryDetails = (raffleData) => {
            WinixRaffles.events.emit('show-history-details', { raffleData });
        };

        // Створюємо об'єкт rafflesFunctions для зворотної сумісності зі старим кодом
        window.rafflesFunctions = {
            switchTab: this.switchTab.bind(this),
            loadRaffleHistory: this.history.displayHistory.bind(this.history),
            resetAllStates: this.resetAllStates.bind(this),
            isOnline: isOnline
        };

        return this;
    }

    /**
     * Скидання всіх станів
     */
    resetAllStates() {
        // Скидання станів у всіх модулях
        try {
            if (this.activeRaffles && typeof this.activeRaffles.resetAllStates === 'function') {
                this.activeRaffles.resetAllStates();
            }
        } catch (e) {
            console.error("Помилка скидання стану активних розіграшів:", e);
        }

        try {
            if (this.history && typeof this.history.resetRequestState === 'function') {
                this.history.resetRequestState();
            }
        } catch (e) {
            console.error("Помилка скидання стану історії:", e);
        }

        // Закриття всіх модальних вікон
        try {
            if (this.modals && typeof this.modals.closeAllModals === 'function') {
                this.modals.closeAllModals();
            }
        } catch (e) {
            console.error("Помилка закриття модальних вікон:", e);
        }

        // Приховування лоадерів
        if (WinixRaffles && WinixRaffles.loader && typeof WinixRaffles.loader.hideAll === 'function') {
            WinixRaffles.loader.hideAll();
        }

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

        // Очищаємо таймаути
        if (this._initializationTimeout) {
            clearTimeout(this._initializationTimeout);
            this._initializationTimeout = null;
        }

        // Видаляємо обробники подій
        this._removeEventListeners();

        // Знищуємо підмодулі
        const destroyModule = (module, name) => {
            try {
                if (module && typeof module.destroy === 'function') {
                    module.destroy();
                    console.log(`🚫 Raffles Module: Модуль ${name} успішно знищено`);
                }
            } catch (e) {
                console.error(`Помилка знищення модуля ${name}:`, e);
            }
        };

        destroyModule(this.activeRaffles, 'активних розіграшів');
        destroyModule(this.history, 'історії');
        destroyModule(this.stats, 'статистики');
        destroyModule(this.modals, 'модальних вікон');
        destroyModule(this.participation, 'участі');
        destroyModule(this.admin, 'адміністрування');

        // Скидаємо прапорець ініціалізації
        this._initialized = false;
        this._initializationInProgress = false;
        this._initializationAttempts = 0;

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
        // Додаємо затримку для гарантованого завантаження інших модулів
        setTimeout(() => {
            rafflesModule.init().catch(e => {
                console.error("Помилка ініціалізації модуля розіграшів:", e);
            });
        }, 500);
    });
} else {
    // У випадку, якщо DOM вже завантажено
    setTimeout(() => {
        rafflesModule.init().catch(e => {
            console.error("Помилка ініціалізації модуля розіграшів:", e);
        });
    }, 500);
}