/**
 * WINIX - Система розіграшів (participation.js)
 * Модуль для обробки участі користувача в розіграшах
 * Оновлена версія - дозволяє багаторазову участь
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше participation.js');
        return;
    }

    // Підмодуль для участі в розіграшах
    const participation = {
        // Множина ID розіграшів, у яких користувач уже бере участь (для відстеження)
        participatingRaffles: new Set(),

        // Кількість білетів користувача для кожного розіграшу
        userRaffleTickets: {},

        // Кеш недійсних розіграшів (для кращої роботи UI)
        invalidRaffleIds: new Set(),

        // Час останньої участі (для запобігання надмірній кількості запитів)
        lastParticipationTime: 0,

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // Завантаження розіграшів користувача
            this.loadUserRaffles();

            // Додаємо обробники подій
            this.setupEventListeners();
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для кнопок участі в розіграшах
            document.addEventListener('click', (e) => {
                // Кнопка участі в головному розіграші
                if (e.target.classList.contains('join-button')) {
                    const raffleId = e.target.getAttribute('data-raffle-id');
                    if (raffleId) {
                        e.preventDefault();
                        this.participateInRaffle(raffleId, 'main');
                    }
                }

                // Кнопка участі в міні-розіграші
                if (e.target.classList.contains('mini-raffle-button')) {
                    const raffleId = e.target.getAttribute('data-raffle-id');
                    if (raffleId) {
                        e.preventDefault();
                        this.participateInRaffle(raffleId, 'daily');
                    }
                }
            });

            // Обробник для оновлення даних користувача (щоб оновити множину участі)
            document.addEventListener('user-data-updated', () => {
                this.loadUserRaffles();
            });
        },

        // Завантаження розіграшів користувача
        loadUserRaffles: async function() {
            const userId = WinixRaffles.state.telegramId || WinixAPI.getUserId();
            if (!userId) return;

            try {
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true
                });

                if (response.status === 'success' && Array.isArray(response.data)) {
                    // Очищаємо та заповнюємо множину розіграшів, у яких бере участь користувач
                    this.participatingRaffles.clear();
                    this.userRaffleTickets = {};

                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            // Додаємо до множини участі
                            this.participatingRaffles.add(raffle.raffle_id);

                            // Зберігаємо кількість білетів
                            this.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
                        }
                    });

                    console.log(`✅ Користувач бере участь у ${this.participatingRaffles.size} розіграшах`);

                    // Оновлюємо кнопки участі
                    this.updateParticipationButtons();
                }
            } catch (error) {
                console.error('❌ Помилка завантаження розіграшів користувача:', error);
            }
        },

        // Оновлення кнопок участі в розіграшах
        updateParticipationButtons: function() {
            // Оновлюємо кнопку головного розіграшу
            document.querySelectorAll('.join-button').forEach(button => {
                const raffleId = button.getAttribute('data-raffle-id');

                // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                if (raffleId && this.participatingRaffles.has(raffleId)) {
                    const ticketCount = this.userRaffleTickets[raffleId] || 1;
                    button.textContent = `Додати ще білет (у вас: ${ticketCount})`;

                    // Змінюємо клас, але не додаємо disabled
                    button.classList.add('participating');
                    button.disabled = false;
                }

                if (raffleId && this.invalidRaffleIds.has(raffleId)) {
                    button.textContent = 'Розіграш завершено';
                    button.classList.add('disabled');
                    button.disabled = true;
                }
            });

            // Оновлюємо кнопки міні-розіграшів
            document.querySelectorAll('.mini-raffle-button').forEach(button => {
                const raffleId = button.getAttribute('data-raffle-id');

                // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                if (raffleId && this.participatingRaffles.has(raffleId)) {
                    const ticketCount = this.userRaffleTickets[raffleId] || 1;
                    button.textContent = `Додати ще білет (${ticketCount})`;

                    // Змінюємо клас, але не додаємо disabled
                    button.classList.add('participating');
                    button.disabled = false;
                }

                if (raffleId && this.invalidRaffleIds.has(raffleId)) {
                    button.textContent = 'Розіграш завершено';
                    button.classList.add('disabled');
                    button.disabled = true;
                }
            });
        },

        /**
 * Участь у розіграші
 * @param {string} raffleId - ID розіграшу
 * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
 * @returns {Promise<boolean>} Результат участі
 */
participateInRaffle: async function(raffleId, raffleType) {
    const userId = WinixRaffles.state.telegramId || WinixAPI.getUserId();

    if (!userId) {
        window.showToast('Не вдалося визначити ваш ID', 'error');
        return false;
    }

    // Мінімальне обмеження частоти запитів (2 секунди)
    const now = Date.now();
    if (now - this.lastParticipationTime < 2000) {
        console.log("⏳ Занадто частий запит на участь, зачекайте 2 секунди");
        // Просто продовжуємо виконання без блокування
    }

    // Оновлюємо час останньої участі
    this.lastParticipationTime = now;

    try {
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        // Визначення кількості жетонів для участі
        let entryCount = 1;

        // Виконуємо запит на участь
        const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
            raffle_id: raffleId,
            entry_count: entryCount
        });

        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }

        if (response.status === 'success') {
            // Додаємо розіграш до множини участі
            this.participatingRaffles.add(raffleId);

            // Інкрементуємо кількість білетів
            this.userRaffleTickets[raffleId] = (this.userRaffleTickets[raffleId] || 0) + 1;

            // Оновлюємо кнопки участі
            this.updateParticipationButtons();

            // Визначаємо, чи користувач уже бере участь
            const isAlreadyParticipating = this.userRaffleTickets[raffleId] > 1;

            // Показуємо повідомлення про успіх
            let message = isAlreadyParticipating
                ? `Додано ще один білет! Тепер у вас ${this.userRaffleTickets[raffleId]} білетів`
                : 'Ви успішно взяли участь у розіграші';

            // Показуємо повідомлення про бонус, якщо є
            if (response.data && response.data.bonus_amount) {
                message += `. Бонус: ${response.data.bonus_amount} ${response.data.bonus_currency || 'WINIX'}`;
            }

            if (typeof window.showToast === 'function') {
                window.showToast(message, 'success');
            } else {
                console.log(`✅ ${message}`);
            }

            // Оновлюємо баланс користувача
            if (response.data && response.data.new_coins_balance !== undefined) {
                document.dispatchEvent(new CustomEvent('user-data-updated', {
    detail: {
        userData: { coins: response.data.new_coins_balance }
    },
    source: 'participation.js'
}));
            }

            return true;
        } else {
            // Обробка помилок
            const errorMessage = response.message || "Помилка участі в розіграші";

            if (typeof window.showToast === 'function') {
                window.showToast(errorMessage, 'error');
            } else {
                console.error(`❌ ${errorMessage}`);
            }

            return false;
        }
    } catch (error) {
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }

        console.error('❌ Помилка участі в розіграші:', error);

        // Показуємо користувачу повідомлення про помилку
        const errorMessage = error.message || "Помилка при спробі участі в розіграші";

        if (typeof window.showToast === 'function') {
            window.showToast(errorMessage, 'error');
        }

        return false;
    }
},

        // Очищення списку недійсних розіграшів
        clearInvalidRaffleIds: function() {
            this.invalidRaffleIds.clear();
            console.log('🧹 Очищено список недійсних розіграшів');
        }
    };

    // Додаємо модуль участі до основного модуля розіграшів
    WinixRaffles.participation = participation;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (WinixRaffles.state.isInitialized) {
            participation.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                participation.init();
            });
        }
    });
})();