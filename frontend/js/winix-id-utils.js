// Функція для безпечного відображення ID користувача
function updateUserIdDisplay() {
    // Отримуємо елементи для відображення ID
    const userIdElements = document.querySelectorAll('#user-id, #user-id-display');

    if (userIdElements.length === 0) return;

    // Функція перевірки валідності ID
    function isValidId(id) {
        return id &&
               id !== 'undefined' &&
               id !== 'null' &&
               id !== undefined &&
               id !== null &&
               id.toString().trim() !== '';
    }

    // Пріоритетні джерела отримання ID
    let userId = null;

    // 1. Спробуємо отримати з WinixAPI, якщо доступно
    if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
        userId = window.WinixAPI.getUserId();
    }

    // 2. Якщо WinixAPI недоступний або повернув невалідний ID, спробуємо з localStorage
    if (!isValidId(userId)) {
        const keys = ['telegram_user_id', 'winix_user_id', 'userId'];
        for (const key of keys) {
            const storedId = localStorage.getItem(key);
            if (isValidId(storedId)) {
                userId = storedId;
                break;
            }
        }
    }

    // 3. Якщо localStorage не допоміг, спробуємо отримати з Telegram WebApp
    if (!isValidId(userId) && window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
        if (isValidId(tgUserId)) {
            userId = tgUserId.toString();
            // Зберігаємо валідний ID в localStorage
            localStorage.setItem('telegram_user_id', userId);
        }
    }

    // 4. Якщо нічого не знайдено, генеруємо унікальний ID як останній варіант
    if (!isValidId(userId)) {
        userId = '2449' + Math.floor(10000 + Math.random() * 90000);
        localStorage.setItem('telegram_user_id', userId);
        console.warn("⚠️ Сгенеровано тимчасовий ID користувача:", userId);
    }

    // Оновлюємо всі елементи ID на сторінці
    userIdElements.forEach(element => {
        element.textContent = userId;
    });

    return userId;
}

// Викликаємо функцію при завантаженні сторінки
document.addEventListener('DOMContentLoaded', updateUserIdDisplay);

// Також запускаємо, якщо DOM вже завантажений
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    updateUserIdDisplay();
}