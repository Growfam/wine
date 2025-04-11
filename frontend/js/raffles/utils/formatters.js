/**
 * Утилітарні функції для форматування даних
 */

(function() {
    'use strict';

    console.log("🎮 WINIX Raffles: Ініціалізація утиліт форматування");

    // Формати дати
    const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Форматування дати
    function formatDate(timestamp) {
        if (!timestamp) return '';

        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return '';
            }
            return dateTimeFormat.format(date);
        } catch (error) {
            console.error('Помилка форматування дати:', error);
            return '';
        }
    }

    // Форматування валюти
    function formatCurrency(amount, currency = 'WINIX') {
        return new Intl.NumberFormat('uk-UA').format(amount) + ' ' + currency;
    }

    // Додавання ведучого нуля до числа
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    // Функція форматування списку місць
    function formatPlaces(places) {
        if (!places || !Array.isArray(places) || places.length === 0) {
            return "Невідомо";
        }

        if (places.length === 1) {
            return `${places[0]} місце`;
        }

        // Шукаємо послідовні місця
        places.sort((a, b) => a - b);

        const ranges = [];
        let start = places[0];
        let end = places[0];

        for (let i = 1; i < places.length; i++) {
            if (places[i] === end + 1) {
                end = places[i];
            } else {
                if (start === end) {
                    ranges.push(`${start}`);
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = end = places[i];
            }
        }

        if (start === end) {
            ranges.push(`${start}`);
        } else {
            ranges.push(`${start}-${end}`);
        }

        return ranges.join(', ') + ' місця';
    }

    // Експортуємо форматери
    window.WinixRaffles.utils.formatters = {
        formatDate,
        formatCurrency,
        padZero,
        formatPlaces
    };

    // Додаємо форматери напряму в utils для зручності доступу
    window.WinixRaffles.utils.formatDate = formatDate;
    window.WinixRaffles.utils.formatCurrency = formatCurrency;
    window.WinixRaffles.utils.padZero = padZero;
    window.WinixRaffles.utils.formatPlaces = formatPlaces;
})();