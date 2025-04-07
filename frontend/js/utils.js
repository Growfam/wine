/**
 * utils.js
 *
 * Хелперні функції для роботи з датами, форматуванням та розрахунками,
 * які використовуються в системі стейкінгу WINIX
 */

(function() {
    'use strict';

    // ================= ФУНКЦІЇ ДЛЯ РОБОТИ З ДАТАМИ =================

    /**
     * Форматування дати у зручний для користувача формат
     * @param {string|Date} date - Дата для форматування
     * @param {string} format - Формат виводу (default: 'DD.MM.YYYY')
     * @returns {string} - Форматована дата
     */
    function formatDate(date, format = 'DD.MM.YYYY') {
        try {
            // Якщо дата передана як рядок, конвертуємо в об'єкт Date
            const dateObj = typeof date === 'string' ? new Date(date) : date;

            // Перевіряємо валідність дати
            if (!(dateObj instanceof Date) || isNaN(dateObj)) {
                return '';
            }

            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const year = dateObj.getFullYear();
            const hours = dateObj.getHours().toString().padStart(2, '0');
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const seconds = dateObj.getSeconds().toString().padStart(2, '0');

            // Заміна плейсхолдерів
            return format
                .replace('DD', day)
                .replace('MM', month)
                .replace('YYYY', year)
                .replace('HH', hours)
                .replace('mm', minutes)
                .replace('ss', seconds);
        } catch (e) {
            console.error('Помилка форматування дати:', e);
            return '';
        }
    }

    /**
     * Розрахунок різниці в днях між двома датами
     * @param {string|Date} startDate - Початкова дата
     * @param {string|Date} endDate - Кінцева дата
     * @returns {number} - Кількість днів
     */
    function getDaysDifference(startDate, endDate) {
        try {
            // Конвертуємо рядки в об'єкти Date, якщо потрібно
            const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
            const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

            // Перевіряємо валідність дат
            if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start) || isNaN(end)) {
                return 0;
            }

            // Розраховуємо різницю в мілісекундах і конвертуємо в дні
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays;
        } catch (e) {
            console.error('Помилка розрахунку різниці в днях:', e);
            return 0;
        }
    }

    /**
     * Розрахунок залишку часу до завершення стейкінгу
     * @param {string|Date} endDate - Дата завершення стейкінгу
     * @returns {Object} - Об'єкт з кількістю днів, годин, хвилин
     */
    function getTimeRemaining(endDate) {
        try {
            // Конвертуємо рядок в об'єкт Date, якщо потрібно
            const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

            // Перевіряємо валідність дати
            if (!(end instanceof Date) || isNaN(end)) {
                return {
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    total: 0
                };
            }

            const now = new Date();

            // Якщо стейкінг вже завершився, повертаємо нулі
            if (end < now) {
                return {
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    total: 0
                };
            }

            // Розраховуємо різницю в мілісекундах
            const total = end - now;

            // Конвертуємо в дні, години, хвилини, секунди
            const seconds = Math.floor((total / 1000) % 60);
            const minutes = Math.floor((total / 1000 / 60) % 60);
            const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
            const days = Math.floor(total / (1000 * 60 * 60 * 24));

            return {
                days,
                hours,
                minutes,
                seconds,
                total
            };
        } catch (e) {
            console.error('Помилка розрахунку залишку часу:', e);
            return {
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
                total: 0
            };
        }
    }

    /**
     * Форматування залишку часу у зручний для користувача формат
     * @param {Object} timeRemaining - Об'єкт з кількістю днів, годин, хвилин
     * @returns {string} - Форматований залишок часу
     */
    function formatTimeRemaining(timeRemaining) {
        try {
            if (!timeRemaining) {
                return '0 днів';
            }

            const { days, hours, minutes } = timeRemaining;

            if (days > 0) {
                return `${days} ${pluralize(days, 'день', 'дня', 'днів')}`;
            }

            if (hours > 0) {
                return `${hours} ${pluralize(hours, 'година', 'години', 'годин')}`;
            }

            return `${minutes} ${pluralize(minutes, 'хвилина', 'хвилини', 'хвилин')}`;
        } catch (e) {
            console.error('Помилка форматування залишку часу:', e);
            return '0 днів';
        }
    }

    // ================= ФУНКЦІЇ ФОРМАТУВАННЯ ТА РОЗРАХУНКІВ =================

    /**
     * Форматування числа як грошової суми
     * @param {number} amount - Сума для форматування
     * @param {number} decimals - Кількість знаків після коми
     * @param {string} currency - Валюта
     * @returns {string} - Форматована сума
     */
    function formatCurrency(amount, decimals = 2, currency = 'WINIX') {
        try {
            // Перевіряємо валідність суми
            if (isNaN(amount)) {
                return `0 ${currency}`;
            }

            // Форматуємо суму
            const formattedAmount = parseFloat(amount).toFixed(decimals);

            // Додаємо розділювачі для тисяч
            const parts = formattedAmount.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

            // Повертаємо форматовану суму з валютою
            return `${parts.join('.')} ${currency}`;
        } catch (e) {
            console.error('Помилка форматування суми:', e);
            return `0 ${currency}`;
        }
    }

    /**
     * Розрахунок відсотків на клієнті
     * @param {number} amount - Сума
     * @param {number} percent - Відсоток
     * @param {number} decimals - Кількість знаків після коми
     * @returns {number} - Результат розрахунку
     */
    function calculatePercent(amount, percent, decimals = 2) {
        try {
            // Перевіряємо валідність параметрів
            if (isNaN(amount) || isNaN(percent)) {
                return 0;
            }

            // Розраховуємо відсоток
            const result = (amount * percent) / 100;

            // Округлюємо до вказаної кількості знаків після коми
            return parseFloat(result.toFixed(decimals));
        } catch (e) {
            console.error('Помилка розрахунку відсотків:', e);
            return 0;
        }
    }

    /**
     * Розрахунок дохідності стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} reward - Винагорода
     * @param {number} days - Кількість днів
     * @returns {number} - Річна дохідність у відсотках
     */
    function calculateAPY(amount, reward, days) {
        try {
            // Перевіряємо валідність параметрів
            if (isNaN(amount) || isNaN(reward) || isNaN(days) || amount <= 0 || days <= 0) {
                return 0;
            }

            // Розраховуємо відсоток за період
            const periodPercent = (reward / amount) * 100;

            // Розраховуємо річну дохідність
            const periodsInYear = 365 / days;
            const apy = periodPercent * periodsInYear;

            // Округлюємо до двох знаків після коми
            return parseFloat(apy.toFixed(2));
        } catch (e) {
            console.error('Помилка розрахунку річної дохідності:', e);
            return 0;
        }
    }

    // ================= ДОПОМІЖНІ ФУНКЦІЇ =================

    /**
     * Вибір правильної форми слова залежно від числа
     * @param {number} count - Число
     * @param {string} form1 - Форма для 1 (день)
     * @param {string} form2 - Форма для 2-4 (дня)
     * @param {string} form3 - Форма для 5+ (днів)
     * @returns {string} - Правильна форма слова
     */
    function pluralize(count, form1, form2, form3) {
        try {
            // Перевіряємо валідність числа
            count = Math.abs(count);

            // Особливі випадки для чисел з 11 по 19
            if (count % 100 >= 11 && count % 100 <= 19) {
                return form3;
            }

            // Визначаємо форму за останньою цифрою
            const lastDigit = count % 10;

            if (lastDigit === 1) {
                return form1;
            }

            if (lastDigit >= 2 && lastDigit <= 4) {
                return form2;
            }

            return form3;
        } catch (e) {
            console.error('Помилка вибору форми слова:', e);
            return form3;
        }
    }

    /**
     * Зберігання даних у локальному сховищі
     * @param {string} key - Ключ
     * @param {any} value - Значення
     * @returns {boolean} - Результат операції
     */
    function saveToStorage(key, value) {
        try {
            // Для об'єктів і масивів використовуємо JSON.stringify
            if (typeof value === 'object' && value !== null) {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }

            return true;
        } catch (e) {
            console.error(`Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Отримання даних з локального сховища
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значення за замовчуванням
     * @param {boolean} isJSON - Чи парсити як JSON
     * @returns {any} - Отримане значення
     */
    function getFromStorage(key, defaultValue = null, isJSON = false) {
        try {
            const value = localStorage.getItem(key);

            if (value === null) {
                return defaultValue;
            }

            if (isJSON) {
                return JSON.parse(value);
            }

            return value;
        } catch (e) {
            console.error(`Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Генерація унікального ідентифікатора
     * @returns {string} - Унікальний ідентифікатор
     */
    function generateUniqueId() {
        try {
            return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
        } catch (e) {
            console.error('Помилка генерації унікального ідентифікатора:', e);
            return Date.now().toString();
        }
    }

    // ================= ЕКСПОРТ ФУНКЦІЙ =================

    // Експортуємо функції для використання в інших модулях
    window.WinixUtils = {
        // Функції для роботи з датами
        formatDate,
        getDaysDifference,
        getTimeRemaining,
        formatTimeRemaining,

        // Функції форматування та розрахунків
        formatCurrency,
        calculatePercent,
        calculateAPY,

        // Допоміжні функції
        pluralize,
        saveToStorage,
        getFromStorage,
        generateUniqueId
    };

    console.log("✅ Утиліти WINIX успішно ініціалізовано");
})();