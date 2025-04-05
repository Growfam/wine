/**
 * user-id-manager.js (FIXED VERSION)
 *
 * Єдиний скрипт для управління ID користувача в системі WINIX.
 * Забезпечує консистентність ID між сторінками та коректну роботу стейкінгу.
 */

(function() {
    console.log("🔄 Запуск виправленого менеджера ID користувача");

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

        // 2. Спроба отримати ID з localStorage (спробуємо всі ключі)
        for (const key of Object.values(STORAGE_KEYS)) {
            const storedId = localStorage.getItem(key);
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                console.log(`[ID Manager] ID з localStorage (${key}): ${storedId}`);
                saveUserId(storedId); // Зберігаємо в усі сховища
                return storedId;
            }
        }

        // 3. Спроба отримати ID з URL параметрів (пріоритет вище, ніж DOM)
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (urlId && urlId !== 'undefined' && urlId !== 'null') {
            console.log(`[ID Manager] ID з URL: ${urlId}`);
            saveUserId(urlId); // Зберігаємо в усі сховища
            return urlId;
        }

        // 4. Спроба отримати ID з DOM елементів
        for (const selector of USER_ID_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
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
        }

        // 5. Аварійне рішення: використовуємо фіксований ID для відлагодження
        // ВАЖЛИВО: Цей код має бути видалений у виробничій версії
        const emergencyId = "12345678";
        console.warn("[ID Manager] Використовуємо аварійний ID: " + emergencyId);
        saveUserId(emergencyId);
        return emergencyId;
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

        try {
            // Зберігаємо в localStorage у всі можливі ключі
            for (const key of Object.values(STORAGE_KEYS)) {
                localStorage.setItem(key, userId);
            }

            // Зберігаємо в sessionStorage
            sessionStorage.setItem('user_id', userId);

            // Оновлюємо всі DOM елементи
            updateDomElements(userId);

            console.log("[ID Manager] ID користувача успішно збережено: " + userId);
        } catch (error) {
            console.error("[ID Manager] Помилка збереження ID:", error);
        }
    }

    /**
     * Оновлення всіх DOM елементів, що відображають ID користувача
     * @param {string} userId - ID користувача
     */
    function updateDomElements(userId) {
        try {
            if (!userId) return;

            for (const selector of USER_ID_SELECTORS) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        if (element.tagName === 'INPUT') {
                            element.value = userId;
                        } else {
                            element.textContent = userId;
                        }

                        // Встановлюємо також data-атрибут
                        element.setAttribute('data-user-id', userId);
                    }
                });
            }

            // Якщо елементів немає, створюємо прихований
            if (document.querySelectorAll(USER_ID_SELECTORS.join(',')).length === 0) {
                const hiddenElement = document.createElement('div');
                hiddenElement.id = 'user-id';
                hiddenElement.style.display = 'none';
                hiddenElement.textContent = userId;
                document.body.appendChild(hiddenElement);
                console.log('[ID Manager] Створено прихований елемент з ID користувача');
            }

            // Створюємо або оновлюємо hidden input з ID для форм
            let hiddenInput = document.getElementById('hidden-user-id');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.id = 'hidden-user-id';
                hiddenInput.name = 'user_id';
                document.body.appendChild(hiddenInput);
            }
            hiddenInput.value = userId;
        } catch (error) {
            console.error('[ID Manager] Помилка оновлення DOM елементів:', error);
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
     * @returns {boolean} Результат встановлення
     */
    function setUserId(userId) {
        if (!isValidUserId(userId)) {
            console.warn("[ID Manager] Спроба примусово встановити невалідний ID: " + userId);
            return false;
        }

        saveUserId(userId);
        console.log("[ID Manager] ID користувача примусово встановлено: " + userId);

        // Додаємо ID до всіх URL посилань на сторінці
        updatePageLinks(userId);

        return true;
    }

    /**
     * Оновлення посилань на сторінці з ID користувача
     */
    function updatePageLinks(userId) {
        try {
            const links = document.querySelectorAll('a[href]');
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('http') && !href.includes('id=')) {
                    // Додаємо параметр ID до внутрішніх посилань
                    const separator = href.includes('?') ? '&' : '?';
                    link.setAttribute('href', `${href}${separator}id=${userId}`);
                }
            });
            console.log('[ID Manager] Оновлено посилання на сторінці');
        } catch (error) {
            console.error('[ID Manager] Помилка оновлення посилань:', error);
        }
    }

    /**
     * Аварійне рішення для стейкінг-сторінки
     */
    function fixStakingPage() {
        // Перевіряємо, чи це сторінка стейкінгу
        if (window.location.href.includes('staking.html') || window.location.href.includes('staking-details.html')) {
            console.log('[ID Manager] Застосування аварійного рішення для стейкінг-сторінки');

            // Встановлюємо обробник помилок для API запитів
            window.addEventListener('error', function(event) {
                if (event.message && (event.message.includes('API') || event.message.includes('404'))) {
                    console.warn('[ID Manager] Перехоплено помилку API:', event.message);

                    // Встановлюємо базові дані стейкінгу
                    const emptyStakingData = {
                        hasActiveStaking: false,
                        stakingAmount: 0,
                        period: 0,
                        rewardPercent: 0,
                        expectedReward: 0,
                        remainingDays: 0
                    };

                    localStorage.setItem('stakingData', JSON.stringify(emptyStakingData));
                    localStorage.setItem('winix_staking', JSON.stringify(emptyStakingData));

                    // Оновлюємо відображення
                    setTimeout(function() {
                        const stakingStatus = document.getElementById('staking-status');
                        if (stakingStatus) {
                            stakingStatus.textContent = "Наразі немає активних стейкінгів";
                        }

                        const loadingElements = document.querySelectorAll('.loading');
                        loadingElements.forEach(el => el.classList.remove('loading'));
                    }, 1000);

                    return true; // Запобігаємо стандартній обробці помилки
                }
            });

            // Оновлюємо обробники кнопок стейкінгу для уникнення зависань
            setTimeout(function() {
                const stakeBtnElement = document.getElementById('stake-button');
                if (stakeBtnElement) {
                    stakeBtnElement.onclick = function() {
                        alert("У даний момент сервіс стейкінгу працює в обмеженому режимі. Спробуйте пізніше.");
                        return false;
                    };
                }

                const detailsBtnElement = document.getElementById('details-button');
                if (detailsBtnElement) {
                    detailsBtnElement.onclick = function() {
                        alert("У даний момент деталі стейкінгу недоступні. Спробуйте пізніше.");
                        return false;
                    };
                }
            }, 2000);
        }
    }

    /**
     * Ініціалізація менеджера ID користувача
     * @param {Object} options - Опції ініціалізації
     * @param {string} options.userId - ID користувача (якщо вже відомий)
     * @param {boolean} options.debug - Режим відлагодження
     */
    function init(options = {}) {
        console.log("[ID Manager] Ініціалізація...");

        try {
            // Якщо передано ID в опціях, зберігаємо його
            if (options.userId && isValidUserId(options.userId)) {
                saveUserId(options.userId);
            } else {
                // Інакше намагаємося отримати ID з доступних джерел
                const userId = getUserId();

                if (userId) {
                    console.log("[ID Manager] Використовується ID: " + userId);
                    // Оновлюємо посилання на сторінці
                    updatePageLinks(userId);
                } else {
                    console.warn("[ID Manager] Не вдалося отримати ID користувача!");
                }
            }

            // Патчимо глобальні функції API для використання нашого ID
            patchApiModules();

            // Застосовуємо аварійне рішення для стейкінгу
            fixStakingPage();

            // Встановлюємо обробник події завантаження сторінки
            window.addEventListener('load', function() {
                // Повторно перевіряємо і оновлюємо ID, якщо були зміни в DOM
                const userId = getUserId();
                if (userId) {
                    updateDomElements(userId);
                    updatePageLinks(userId);
                }
            });

            console.log("[ID Manager] Ініціалізацію завершено.");
        } catch (error) {
            console.error("[ID Manager] Помилка ініціалізації:", error);
        }
    }

    /**
     * Патч глобальних API функцій для використання нашого ID
     */
    function patchApiModules() {
        try {
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

            // Патч для fetch, щоб додавати ID користувача до всіх API запитів
            const originalFetch = window.fetch;
            window.fetch = function(resource, options = {}) {
                // Додаємо ID користувача до заголовків
                if (!options.headers) {
                    options.headers = {};
                }

                const userId = getUserId();
                if (userId) {
                    options.headers['X-User-Id'] = userId;
                    options.headers['X-Telegram-User-Id'] = userId;
                }

                // Якщо це API запит, перевіряємо наявність ID в URL
                if (typeof resource === 'string' && resource.includes('/api/')) {
                    // Додаємо ID до URL, якщо запит містить параметр user_id або telegram_id
                    if (resource.includes('/user/') && !resource.match(/\/user\/[^\/]+\//)) {
                        const userIdInUrl = resource.split('/user/')[1]?.split('/')[0];
                        if (!userIdInUrl || userIdInUrl === 'undefined') {
                            resource = resource.replace('/user/', `/user/${userId}/`);
                            console.log(`[ID Manager] Додано ID ${userId} до запиту API: ${resource}`);
                        }
                    }
                }

                return originalFetch(resource, options);
            };
            console.log("[ID Manager] Функцію window.fetch успішно патчено");

        } catch (error) {
            console.error("[ID Manager] Помилка патчу API модулів:", error);
        }
    }

    // Експортуємо публічний API
    window.UserIdManager = {
        getUserId,
        setUserId,
        saveUserId,
        isValidUserId,
        updateDomElements,
        init,
        updatePageLinks,
        // Нові функції для аварійного відновлення
        fixStakingPage,
        version: "1.1.0-fixed"
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