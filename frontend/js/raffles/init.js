/**
 * WINIX - Система розіграшів (init.js)
 * Ініціалізація основного об'єкта WinixRaffles
 */

(function() {
    'use strict';

    // Перевірка наявності API модуля
    if (typeof WinixAPI === 'undefined') {
        console.error('❌ WinixAPI не знайдено! Переконайтеся, що api.js підключено перед init.js');
        return;
    }

    // Створення основного об'єкта WinixRaffles, якщо він ще не існує
    window.WinixRaffles = {
        // Поточний стан
        state: {
            isInitialized: false,
            activeTab: 'active',
            activeRaffles: [],
            pastRaffles: [],
            userRaffles: [],
            telegramId: null,
            isLoading: false,
            refreshTimers: {}
        },

        // Конфігурація
        config: {
            activeRafflesEndpoint: 'api/raffles/active',
            pastRafflesEndpoint: 'api/raffles/past',
            userRafflesEndpoint: 'api/user/raffles',
            autoRefreshInterval: 120000 // 2 хвилини
        },

        // Ініціалізація системи розіграшів
        init: function() {
            console.log('🎲 Ініціалізація системи розіграшів WINIX...');

            // Встановлення ID користувача
            this.state.telegramId = WinixAPI.getUserId();
            console.log(`🔑 ID користувача: ${this.state.telegramId}`);

            // Встановлення активної вкладки
            const activeTabBtn = document.querySelector('.tab-button.active');
            if (activeTabBtn) {
                this.state.activeTab = activeTabBtn.getAttribute('data-tab');
            }

            // Налаштування переключення вкладок
            this.setupTabSwitching();

            // Позначаємо, що система ініціалізована
            this.state.isInitialized = true;

            // Генеруємо подію про ініціалізацію
            document.dispatchEvent(new CustomEvent('winix-raffles-initialized'));

            console.log('✅ Система розіграшів WINIX успішно ініціалізована');

            return this;
        },

        // Налаштування переключення вкладок
        setupTabSwitching: function() {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');

            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');

                    // Оновлюємо активну вкладку в стані
                    this.state.activeTab = tabName;

                    // Деактивуємо всі вкладки
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));

                    // Активуємо обрану вкладку
                    button.classList.add('active');
                    document.getElementById(tabName + '-raffles').classList.add('active');

                    console.log(`🔄 Активовано вкладку: ${tabName}`);
                });
            });
        },

        // Безпечне завантаження активних розіграшів
        loadActiveRaffles: function() {
            // Цей метод буде перевизначений в active.js
            console.log('⚠️ Метод loadActiveRaffles ще не реалізовано');
        },

        // Безпечне завантаження історії розіграшів
        loadRaffleHistory: function() {
            // Цей метод буде перевизначений в history.js
            console.log('⚠️ Метод loadRaffleHistory ще не реалізовано');
        },

        // Безпечне завантаження статистики
        loadStatistics: function() {
            // Цей метод буде перевизначений в statistics.js
            console.log('⚠️ Метод loadStatistics ще не реалізовано');
        }
    };

    console.log('✅ Базовий об\'єкт WinixRaffles створено');
})();