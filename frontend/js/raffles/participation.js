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

        // Участь у розіграші
        participateInRaffle: async function(raffleId, raffleType) {
            const userId = WinixRaffles.state.telegramId || WinixAPI.getUserId();

            if (!userId) {
                window.showToast('Не вдалося визначити ваш ID', 'error');
                return false;
            }

            // Перевірка чи розіграш валідний
            if (this.invalidRaffleIds.has(raffleId)) {
                window.showToast('Цей розіграш уже завершено або недоступний', 'warning');
                return false;
            }

            // Відстежуємо чи користувач уже бере участь (але не блокуємо участь)
            const isAlreadyParticipating = this.participatingRaffles.has(raffleId);
            const currentTickets = this.userRaffleTickets[raffleId] || 0;

            // Запобігання надмірним запитам (не частіше ніж раз на 2 секунди)
            const now = Date.now();
            if (now - this.lastParticipationTime < 2000) {
                window.showToast('Зачекайте перед наступною спробою', 'warning');
                return false;
            }

            try {
                window.showLoading();

                // Визначення кількості жетонів для участі
                let entryCount = 1;

                // Для головного розіграшу отримуємо кількість жетонів з кнопки
                if (raffleType === 'main') {
                    const joinButton = document.querySelector(`.join-button[data-raffle-id="${raffleId}"]`);
                    if (joinButton) {
                        const costMatch = joinButton.textContent.match(/\d+/);
                        if (costMatch) {
                            entryCount = parseInt(costMatch[0]);
                        }
                    }
                }

                console.log(`🎲 Участь у розіграші ${raffleId} (тип: ${raffleType}, жетонів: ${entryCount})`);

                // Виконуємо запит на участь
                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: entryCount
                });

                window.hideLoading();

                if (response.status === 'success') {
                    // Додаємо розіграш до множини участі
                    this.participatingRaffles.add(raffleId);

                    // Інкрементуємо кількість білетів
                    this.userRaffleTickets[raffleId] = (this.userRaffleTickets[raffleId] || 0) + 1;

                    // Оновлюємо кнопки участі
                    this.updateParticipationButtons();

                    // Показуємо повідомлення про успіх
                    let message = isAlreadyParticipating
                        ? `Додано ще один білет! Тепер у вас ${this.userRaffleTickets[raffleId]} білетів`
                        : 'Ви успішно взяли участь у розіграші';

                    // Додаємо інформацію про бонус, якщо є
                    if (response.data && response.data.bonus_amount) {
                        message += `. Бонус: ${response.data.bonus_amount} ${response.data.bonus_currency || 'WINIX'}`;
                    }

                    window.showToast(message, 'success');

                    // Створюємо подію для сповіщення про успішну участь
                    document.dispatchEvent(new CustomEvent('raffle-participation', {
                        detail: {
                            successful: true,
                            raffleId: raffleId,
                            ticketCount: this.userRaffleTickets[raffleId]
                        }
                    }));

                    // Оновлюємо баланс користувача
                    if (response.data && response.data.new_coins_balance !== undefined) {
                        document.dispatchEvent(new CustomEvent('user-data-updated', {
                            detail: { coins: response.data.new_coins_balance }
                        }));
                    }

                    // Зберігаємо час останньої участі
                    this.lastParticipationTime = now;

                    return true;
                } else {
                    // Обробка помилок
                    if (response.code === 'insufficient_tokens') {
                        window.showToast('Недостатньо жетонів для участі в розіграші', 'error');
                    } else if (response.code === 'raffle_not_found' || response.code === 'invalid_raffle_id') {
                        this.invalidRaffleIds.add(raffleId);
                        this.updateParticipationButtons();
                        window.showToast('Розіграш не знайдено або вже завершено', 'warning');
                    } else {
                        window.showToast(response.message || 'Помилка участі в розіграші', 'error');
                    }

                    return false;
                }
            } catch (error) {
                window.hideLoading();
                console.error('❌ Помилка участі в розіграші:', error);

                // Обробка помилок валідації UUID
                if (error.message && error.message.includes('UUID')) {
                    this.invalidRaffleIds.add(raffleId);
                    this.updateParticipationButtons();
                    window.showToast('Недійсний ідентифікатор розіграшу', 'warning');
                } else {
                    window.showToast('Помилка при спробі участі в розіграші', 'error');
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