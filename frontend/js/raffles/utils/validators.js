/**
 * WINIX - Система розіграшів (validators.js)
 * Модуль з функціями валідації для системи розіграшів
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше validators.js');
        return;
    }

    // Об'єкт з функціями валідації
    const validators = {
        /**
         * Перевірка валідності UUID
         * @param {string} id - UUID для перевірки
         * @returns {boolean} - Результат перевірки
         */
        isValidUUID: function(id) {
            if (!id || typeof id !== 'string') return false;

            // Регулярний вираз для перевірки формату UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuidRegex.test(id);
        },

        /**
         * Перевірка чи розіграш активний
         * @param {string} raffleId - ID розіграшу для перевірки
         * @param {Array} activeRaffles - Масив активних розіграшів
         * @returns {boolean} - Результат перевірки
         */
        isRaffleActive: function(raffleId, activeRaffles) {
            if (!this.isValidUUID(raffleId)) return false;

            if (!Array.isArray(activeRaffles)) {
                activeRaffles = WinixRaffles.state.activeRaffles || [];
            }

            // Перевірка наявності розіграшу в списку активних
            return activeRaffles.some(raffle => raffle.id === raffleId);
        },

        /**
         * Перевірка чи користувач бере участь у розіграші
         * @param {string} raffleId - ID розіграшу для перевірки
         * @returns {boolean} - Результат перевірки
         */
        isUserParticipating: function(raffleId) {
            if (!this.isValidUUID(raffleId)) return false;

            // Перевіряємо у модулі participation, якщо він є
            if (WinixRaffles.participation && WinixRaffles.participation.participatingRaffles) {
                return WinixRaffles.participation.participatingRaffles.has(raffleId);
            }

            // Альтернативна перевірка через state
            if (Array.isArray(WinixRaffles.state.userRaffles)) {
                return WinixRaffles.state.userRaffles.some(raffle =>
                    raffle.raffle_id === raffleId || raffle.id === raffleId
                );
            }

            return false;
        },

        /**
         * Перевірка чи достатньо жетонів для участі
         * @param {number} requiredTokens - Необхідна кількість жетонів
         * @returns {boolean} - Результат перевірки
         */
        hasEnoughTokens: function(requiredTokens) {
            if (isNaN(requiredTokens) || requiredTokens <= 0) return true;

            // Отримуємо поточну кількість жетонів користувача
            let userTokens = 0;

            // Спроба отримати з DOM
            const userCoinsElement = document.querySelector('.user-coins');
            if (userCoinsElement) {
                userTokens = parseInt(userCoinsElement.textContent) || 0;
            } else {
                // Спроба отримати з localStorage
                userTokens = parseInt(localStorage.getItem('userCoins') || '0');
            }

            return userTokens >= requiredTokens;
        },

        /**
         * Перевірка чи часовий проміжок розіграшу коректний
         * @param {Date|number|string} startTime - Час початку розіграшу
         * @param {Date|number|string} endTime - Час завершення розіграшу
         * @returns {boolean} - Результат перевірки
         */
        isRaffleTimeValid: function(startTime, endTime) {
            // Конвертуємо в об'єкти Date
            const start = new Date(startTime);
            const end = new Date(endTime);
            const now = new Date();

            // Перевіряємо валідність дат
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return false;
            }

            // Перевіряємо, що кінцева дата пізніше початкової
            if (end <= start) {
                return false;
            }

            // Перевіряємо, що розіграш ще не завершився
            return end > now;
        },

        /**
         * Розрахунок залишку часу до кінця розіграшу
         * @param {Date|number|string} endTime - Час завершення розіграшу
         * @returns {Object|null} - Об'єкт з форматованим часом або null якщо час вийшов
         */
        calculateTimeLeft: function(endTime) {
            const end = new Date(endTime);
            const now = new Date();

            // Перевіряємо валідність дати
            if (isNaN(end.getTime())) {
                return null;
            }

            // Обчислюємо різницю в мілісекундах
            const diffMs = end - now;

            // Перевіряємо, чи час не вийшов
            if (diffMs <= 0) {
                return null;
            }

            // Розраховуємо дні, години, хвилини, секунди
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            return {
                days,
                hours,
                minutes,
                seconds,
                total: diffMs,
                formatted: {
                    days: days.toString().padStart(2, '0'),
                    hours: hours.toString().padStart(2, '0'),
                    minutes: minutes.toString().padStart(2, '0'),
                    seconds: seconds.toString().padStart(2, '0')
                }
            };
        },

        /**
         * Перевірка чи рядок містить тільки цифри
         * @param {string} str - Рядок для перевірки
         * @returns {boolean} - Результат перевірки
         */
        isNumeric: function(str) {
            if (typeof str !== 'string') {
                return false;
            }
            return /^\d+$/.test(str);
        },

        /**
         * Перевірка чи розіграш вже завершився
         * @param {string} raffleId - ID розіграшу для перевірки
         * @param {Array} pastRaffles - Масив минулих розіграшів
         * @returns {boolean} - Результат перевірки
         */
        isRaffleCompleted: function(raffleId, pastRaffles) {
            if (!this.isValidUUID(raffleId)) return false;

            if (!Array.isArray(pastRaffles)) {
                // Спроба отримати з WinixRaffles
                pastRaffles = WinixRaffles.state.pastRaffles || [];

                // Спроба отримати з WinixRaffles.history
                if (pastRaffles.length === 0 && WinixRaffles.history) {
                    pastRaffles = WinixRaffles.history.historyData || [];
                }
            }

            // Перевірка наявності розіграшу в списку минулих
            return pastRaffles.some(raffle =>
                raffle.raffle_id === raffleId || raffle.id === raffleId
            );
        },

        /**
         * Валідація вхідних даних для участі в розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {number} entryCount - Кількість жетонів для участі
         * @returns {Object} - Результат валідації {isValid, errors}
         */
        validateParticipationData: function(raffleId, entryCount) {
            const errors = [];

            // Валідація ID розіграшу
            if (!this.isValidUUID(raffleId)) {
                errors.push('Невалідний ідентифікатор розіграшу');
            }

            // Валідація кількості жетонів
            if (isNaN(entryCount) || entryCount <= 0 || entryCount > 100) {
                errors.push('Невалідна кількість жетонів для участі');
            }

            // Перевірка участі
            if (this.isUserParticipating(raffleId)) {
                errors.push('Ви вже берете участь у цьому розіграші');
            }

            // Перевірка достатньої кількості жетонів
            if (!this.hasEnoughTokens(entryCount)) {
                errors.push('Недостатньо жетонів для участі');
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        }
    };

    // Додаємо валідатори до WinixRaffles
    WinixRaffles.validators = validators;

    console.log('✅ Модуль валідації успішно ініціалізовано');
})();