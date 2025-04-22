/**
 * Єдина універсальна функція для перевірки валідності UUID
 * Рекомендована для використання в усіх модулях системи
 * @version 1.1.0
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

/**
 * Нормалізація UUID (видалення пробілів, переведення в нижній регістр)
 * @param {string} uuid - UUID для нормалізації
 * @returns {string} - Нормалізований UUID
 */
function normalizeUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return '';
    // Видаляємо всі пробіли і переводимо в нижній регістр
    return uuid.trim().toLowerCase();
}

/**
 * Конвертація UUID в стандартний формат з дефісами
 * @param {string} uuid - UUID для конвертації
 * @returns {string} - Сконвертований UUID або порожній рядок при помилці
 */
function formatUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return '';

    try {
        // Видаляємо всі нецифрові і не-букви
        const cleanUuid = uuid.replace(/[^a-fA-F0-9]/g, '');

        // Перевіряємо, чи вийшло 32 символи
        if (cleanUuid.length !== 32) return '';

        // Форматуємо у вигляді 8-4-4-4-12
        return `${cleanUuid.substr(0,8)}-${cleanUuid.substr(8,4)}-${cleanUuid.substr(12,4)}-${cleanUuid.substr(16,4)}-${cleanUuid.substr(20,12)}`;
    } catch (e) {
        console.error("Помилка форматування UUID:", e);
        return '';
    }
}

// Експортуємо функції, щоб їх можна було використовувати в різних модулях
if (typeof window !== 'undefined') {
    // Головна функція валідації
    window.isValidUUID = isValidUUID;

    // Додаткові функції для роботи з UUID
    window.normalizeUUID = normalizeUUID;
    window.formatUUID = formatUUID;

    // Створюємо глобальний простір імен для UUID-утиліт
    window.UUIDUtils = {
        isValid: isValidUUID,
        normalize: normalizeUUID,
        format: formatUUID
    };

    // Додаємо до WinixRaffles, якщо він існує
    if (window.WinixRaffles) {
        if (!window.WinixRaffles.validators) {
            window.WinixRaffles.validators = {};
        }

        // Перезаписуємо або додаємо функції UUID
        window.WinixRaffles.validators.isValidUUID = isValidUUID;
        window.WinixRaffles.validators.normalizeUUID = normalizeUUID;
        window.WinixRaffles.validators.formatUUID = formatUUID;
    }

    // Додаємо до WinixAPI, якщо він існує
    if (window.WinixAPI) {
        window.WinixAPI.isValidUUID = isValidUUID;
        window.WinixAPI.normalizeUUID = normalizeUUID;
        window.WinixAPI.formatUUID = formatUUID;
    }

    // Додаємо до WinixCore, якщо він існує
    if (window.WinixCore) {
        window.WinixCore.isValidUUID = isValidUUID;
        window.WinixCore.normalizeUUID = normalizeUUID;
        window.WinixCore.formatUUID = formatUUID;
    }

    console.log('✅ Уніфіковані функції для роботи з UUID успішно встановлені');
}