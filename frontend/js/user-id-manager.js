/**
 * user-id-manager.js
 *
 * Єдиний скрипт для управління ID користувача в системі WINIX.
 * Забезпечує консистентність ID між сторінками та коректну роботу стейкінгу.
 */

(function() {
    // Змінна для зберігання ID користувача
    let currentUserId = null;

    // Ключі для зберігання ID в localStorage
    const STORAGE_KEYS = {
        TELEGRAM_ID: 'telegram_user_id',
        USER_ID: 'userId',
        SESSION_ID: 'session_user_id'
    };

    // Перелік усіх можливих DOM елементів з ID користувача
    const USER_ID_SELECTORS = [
        '#user-id',
        '.user-id-value',
        '[data-user-id]'
    ];

    /**
     * Отримання ID користувача з різних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // 1. Спочатку перевіряємо, чи вже є ID в змінній
        if (currentUserId && currentUserId !== 'undefined' && currentUserId !== 'null') {
            console.log("[ID Manager] ID з кешу: " + currentUserId);
            return currentUserId;
        }

        // 2. Спроба отримати ID з localStorage
        for (const key of Object.values(STORAGE_KEYS)) {
            const storedId = localStorage.getItem(key);
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                console.log(`[ID Manager] ID з localStorage (${key}): ${storedId}`);
                saveUserId(storedId); // Зберігаємо в усі сховища
                return storedId;
            }
        }

        // 3. Спроба отримати ID з DOM елементів
        for (const selector of USER_ID_SELECTORS) {
            const element = document.querySelector(selector);
            if (element && element.textContent &&
                element.textContent.trim() !== '' &&
                element.textContent !== 'undefined' &&
                element.textContent !== 'null') {
                const domId = element.textContent.trim();
                console.log(`[ID Manager] ID з DOM (${selector}): ${domId}`);
                saveUserId(domId); // Зберігаємо в усі сховища
                return domId;
            }
        }

        // 4. Спроба отримати ID з URL параметрів
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (urlId && urlId !== 'undefined' && urlId !== 'null') {
            console.log(`[ID Manager] ID з URL: ${urlId}`);
            saveUserId(urlId); // Зберігаємо в усі сховища
            return urlId;
        }

        console.warn("[ID Manager] Не вдалося отримати ID користувача з жодного джерела!");
        return null;
    }

    /**
     * Зберігання ID користувача у всі можливі сховища
     * @param {string} userId - ID користувача
     */
    function saveUserId(userId) {
        if (!userId || userId === 'undefined' || userId === 'null') {
            console.warn("[ID Manager] Спроба зберегти невалідний ID: " + userId);
            return;
        }

        // Кешуємо ID в змінній
        currentUserId = userId;

        // Зберігаємо в localStorage
        for (const key of Object.values(STORAGE_KEYS)) {
            try {
                localStorage.setItem(key, userId);
            } catch (e) {
                console.error(`[ID Manager] Помилка збереження ${key} в localStorage:`, e);
            }
        }

        // Зберігаємо в sessionStorage
        try {
            sessionStorage.setItem('user_id', userId);
        } catch (e) {
            console.error("[ID Manager] Помилка збереження в sessionStorage:", e);
        }

        // Оновлюємо всі DOM елементи
        updateDomElements(userId);

        console.log("[ID Manager] ID користувача збережено: " + userId);
    }

    /**
     * Оновлення всіх DOM елементів, що відображають ID користувача
     * @param {string} userId - ID користувача
     */
    function updateDomElements(userId) {
        for (const selector of USER_ID_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    element.textContent = userId;
                    // Встановлюємо також data-атрибут
                    element.setAttribute('data-user-id', userId);
                }
            });
        }
    }

    /**
     * Перевірка, чи ID валідний
     * @param {string} userId - ID для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isValidUserId(userId) {
        return userId &&
               userId !== 'undefined' &&
               userId !== 'null' &&
               userId.trim() !== '';
    }

    /**
     * Примусове встановлення ID користувача (використовується після авторизації)
     * @param {string} userId - ID користувача
     */
    function setUserId(userId) {
        if (!isValidUserId(userId)) {
            console.warn("[ID Manager] Спроба примусово встановити невалідний ID: " + userId);
            return false;
        }

        saveUserId(userId);
        console.log("[ID Manager] ID користувача примусово встановлено: " + userId);
        return true;
    }

    /**
     * Ініціалізація менеджера ID користувача
     * @param {Object} options - Опції ініціалізації
     * @param {string} options.userId - ID користувача (якщо вже відомий)
     * @param {boolean} options.debug - Режим відлагодження
     */
    function init(options = {}) {
        console.log("[ID Manager] Ініціалізація...");

        // Якщо передано ID в опціях, зберігаємо його
        if (options.userId && isValidUserId(options.userId)) {
            saveUserId(options.userId);
        } else {
            // Інакше намагаємося отримати ID з доступних джерел
            const userId = getUserId();

            if (userId) {
                console.log("[ID Manager] Використовується ID: " + userId);
            } else {
                console.warn("[ID Manager] Не вдалося отримати ID користувача!");
            }
        }

        // Патчимо глобальні функції API для використання нашого ID
        patchApiModules();

        // Встановлюємо обробник події завантаження сторінки
        window.addEventListener('load', function() {
            // Повторно перевіряємо і оновлюємо ID, якщо були зміни в DOM
            const userId = getUserId();
            if (userId) {
                updateDomElements(userId);
            }
        });

        console.log("[ID Manager] Ініціалізацію завершено.");
    }

    /**
     * Патч глобальних API функцій для використання нашого ID
     */
    function patchApiModules() {
        // Патч для функції отримання ID у WinixAPI
        if (window.WinixAPI && window.WinixAPI.getUserId) {
            const originalGetUserId = window.WinixAPI.getUserId;
            window.WinixAPI.getUserId = function() {
                const id = getUserId();
                if (id) return id;
                return originalGetUserId();
            };
            console.log("[ID Manager] Функцію WinixAPI.getUserId успішно патчено");
        }

        // Патч для window.getUserId, якщо вона існує
        if (typeof window.getUserId === 'function') {
            const originalWindowGetUserId = window.getUserId;
            window.getUserId = function() {
                const id = getUserId();
                if (id) return id;
                return originalWindowGetUserId();
            };
            console.log("[ID Manager] Функцію window.getUserId успішно патчено");
        }
    }

    // Експортуємо публічний API
    window.UserIdManager = {
        getUserId,
        setUserId,
        saveUserId,
        isValidUserId,
        updateDomElements,
        init
    };

    // Автоматична ініціалізація при завантаженні скрипта
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            init();
        });
    } else {
        init();
    }

    console.log("[ID Manager] Модуль завантажено");
})();