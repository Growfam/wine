  /**
 * emergency-id-fix.js
 *
 * Аварійне виправлення проблем з ID користувача
 * Скрипт для миттєвого виправлення проблем з ID при виникненні помилок
 */

(function() {
    console.log("🚨 Завантаження системи аварійного виправлення ID...");

    // Глобальний обробник помилок API
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
        // Перед запитом перевіряємо ID користувача
        checkAndFixUserId();

        // Виконуємо оригінальний запит
        return originalFetch(resource, options).catch(error => {
            // При помилці перевіряємо, чи це не проблема з ID
            if (error.message && (
                error.message.includes('user not found') ||
                error.message.includes('unauthorized') ||
                error.message.includes('403') ||
                error.message.includes('401')
            )) {
                console.warn("🔄 Можлива проблема з ID користувача, спроба виправлення...");
                const fixed = checkAndFixUserId(true);

                if (fixed) {
                    // Якщо ID виправлено, повторюємо запит
                    console.log("🔄 Повторний запит після виправлення ID...");
                    return originalFetch(resource, options);
                }
            }

            throw error;
        });
    };

    /**
     * Перевірка і виправлення ID користувача
     * @param {boolean} forceFix - Примусове виправлення
     * @returns {boolean} Результат виправлення
     */
    function checkAndFixUserId(forceFix = false) {
        try {
            // Перевіряємо наявність модуля управління ID
            if (!window.UserIdManager) {
                console.error("❌ Модуль UserIdManager не знайдено!");
                return tryLegacyIdFix();
            }

            // Отримуємо поточний ID
            const currentId = window.UserIdManager.getUserId();

            if (!currentId || forceFix) {
                console.warn("🚨 ID користувача відсутній або потребує виправлення");

                // Спроба отримати ID з усіх можливих джерел
                let newId = null;

                // 1. Спроба з localStorage (всі можливі ключі)
                const storageKeys = [
                    'telegram_user_id', 'userId', 'user_id',
                    'telegramUserId', 'winix_user_id', 'session_user_id'
                ];

                for (const key of storageKeys) {
                    const storedId = localStorage.getItem(key);
                    if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                        newId = storedId;
                        console.log(`🔄 Знайдено ID в localStorage (${key}): ${newId}`);
                        break;
                    }
                }

                // 2. Спроба з URL параметрів
                if (!newId) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                    if (urlId && urlId !== 'undefined' && urlId !== 'null') {
                        newId = urlId;
                        console.log(`🔄 Знайдено ID в URL: ${newId}`);
                    }
                }

                // 3. Спроба з DOM
                if (!newId) {
                    const idElements = document.querySelectorAll('#user-id, .user-id-value, [data-user-id]');
                    for (const element of idElements) {
                        if (element && element.textContent &&
                            element.textContent.trim() !== '' &&
                            element.textContent !== 'undefined' &&
                            element.textContent !== 'null') {
                            newId = element.textContent.trim();
                            console.log(`🔄 Знайдено ID в DOM: ${newId}`);
                            break;
                        }
                    }
                }

                // Якщо знайдено новий ID, зберігаємо його
                if (newId) {
                    window.UserIdManager.setUserId(newId);

                    // Оновлюємо DOM елементи
                    window.UserIdManager.updateDomElements(newId);

                    console.log("✅ ID користувача успішно виправлено:", newId);
                    return true;
                } else {
                    console.error("❌ Не вдалося знайти ID користувача в жодному джерелі");
                    return false;
                }
            } else {
                // ID вже існує, просто оновлюємо його у всіх місцях
                window.UserIdManager.updateDomElements(currentId);
                return true;
            }
        } catch (error) {
            console.error("❌ Помилка при виправленні ID:", error);
            return tryLegacyIdFix();
        }
    }

    /**
     * Резервне виправлення ID старим способом, якщо модуль управління ID недоступний
     * @returns {boolean} Результат виправлення
     */
    function tryLegacyIdFix() {
        try {
            console.log("🔄 Застосування резервного виправлення ID...");

            // Спроба отримати ID
            let userId = localStorage.getItem('telegram_user_id');

            if (!userId || userId === 'undefined' || userId === 'null') {
                userId = localStorage.getItem('userId');
            }

            if (!userId || userId === 'undefined' || userId === 'null') {
                const urlParams = new URLSearchParams(window.location.search);
                userId = urlParams.get('id') || urlParams.get('user_id');
            }

            if (!userId || userId === 'undefined' || userId === 'null') {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    userId = userIdElement.textContent.trim();
                }
            }

            if (userId && userId !== 'undefined' && userId !== 'null') {
                // Зберігаємо в усі можливі сховища
                localStorage.setItem('telegram_user_id', userId);
                localStorage.setItem('userId', userId);
                sessionStorage.setItem('user_id', userId);

                // Оновлюємо елементи DOM
                const userIdElement = document.getElementById('user-id');
                if (userIdElement) {
                    userIdElement.textContent = userId;
                }

                console.log("✅ ID користувача успішно виправлено (резервний спосіб):", userId);
                return true;
            }

            console.error("❌ Не вдалося знайти ID користувача (резервний спосіб)");
            return false;
        } catch (error) {
            console.error("❌ Помилка при резервному виправленні ID:", error);
            return false;
        }
    }

    // Додаємо кнопку аварійного відновлення ID
    function addEmergencyButton() {
        // Перевіряємо, чи кнопка вже існує
        if (document.getElementById('emergency-id-fix-button')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'emergency-id-fix-button';
        button.textContent = '🔄 Відновити ID';
        button.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 20px;
            background: linear-gradient(90deg, #FF5722, #E91E63);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            border: none;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            display: none;
        `;

        button.addEventListener('click', function() {
            const fixed = checkAndFixUserId(true);

            if (fixed) {
                alert('ID успішно відновлено. Сторінка буде перезавантажена.');
                window.location.reload();
            } else {
                alert('Не вдалося відновити ID. Спробуйте повернутися на головну сторінку.');
            }
        });

        document.body.appendChild(button);

        // Показуємо кнопку при виникненні помилок
        window.addEventListener('error', function(event) {
            if (event.error && (
                event.error.toString().includes('user not found') ||
                event.error.toString().includes('ID') ||
                event.error.toString().includes('unauthorized') ||
                event.error.toString().includes('403') ||
                event.error.toString().includes('401')
            )) {
                button.style.display = 'block';
            }
        });

        // Або при помилках Fetch API
        window.addEventListener('unhandledrejection', function(event) {
            if (event.reason && (
                event.reason.toString().includes('user not found') ||
                event.reason.toString().includes('ID') ||
                event.reason.toString().includes('unauthorized') ||
                event.reason.toString().includes('403') ||
                event.reason.toString().includes('401')
            )) {
                button.style.display = 'block';
            }
        });
    }

    // Ініціалізація аварійного виправлення
    function init() {
        // Запускаємо початкову перевірку ID
        setTimeout(function() {
            checkAndFixUserId();
        }, 500);

        // Додаємо аварійну кнопку
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addEmergencyButton);
        } else {
            addEmergencyButton();
        }

        console.log("✅ Система аварійного виправлення ID успішно завантажена");
    }

    // Запускаємо ініціалізацію
    init();
})();