/**
 * Єдина універсальна функція для перевірки валідності UUID
 * Рекомендована для використання в усіх модулях системи
 */

/**
 * Перевірка валідності UUID строго за стандартом
 * @param {string} id - UUID для перевірки
 * @returns {boolean} - true, якщо UUID валідний, false - інакше
 */
function isValidUUID(id) {
    // Базова перевірка типу та наявності значення
    if (!id || typeof id !== 'string') {
        return false;
    }

    // Перевірка на порожній рядок або невалідні значення
    if (id.trim() === '' || id === 'undefined' || id === 'null') {
        return false;
    }

    // Перевірка на мінімальну довжину (повний UUID має 36 символів)
    if (id.length < 32) {
        return false;
    }

    // Повна перевірка на відповідність формату UUID
    // Format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx де:
    // M - версія (1-5), N - варіант (8,9,a,b)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Спочатку швидка перевірка через регулярний вираз
    if (!uuidRegex.test(id)) {
        return false;
    }

    // Додаткова перевірка через об'єкт UUID (якщо доступно)
    try {
        // Це працює тільки в середовищах з підтримкою UUID (Node.js)
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
            const parts = id.split('-');
            if (parts.length !== 5) return false;

            // Перевірка довжини кожної частини
            if (parts[0].length !== 8 ||
                parts[1].length !== 4 ||
                parts[2].length !== 4 ||
                parts[3].length !== 4 ||
                parts[4].length !== 12) {
                return false;
            }
        }
    } catch (e) {
        // Ігноруємо помилки - використовуємо лише регулярний вираз
    }

    return true;
}

// Експортуємо функцію, щоб її можна було використовувати в різних модулях
if (typeof window !== 'undefined') {
    window.isValidUUID = isValidUUID;

    // Додаємо до WinixRaffles, якщо він існує
    if (window.WinixRaffles) {
        if (!window.WinixRaffles.validators) {
            window.WinixRaffles.validators = {};
        }
        window.WinixRaffles.validators.isValidUUID = isValidUUID;
    }

    // Додаємо до WinixAPI, якщо він існує
    if (window.WinixAPI) {
        window.WinixAPI.isValidUUID = isValidUUID;
    }

    console.log('✅ Уніфікована функція валідації UUID успішно встановлена');
}