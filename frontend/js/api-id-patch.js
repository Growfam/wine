/**
 * api-id-patch.js
 *
 * Патч для виправлення проблем з ID користувача в API та модулі стейкінгу
 */

(function() {
    console.log("🔄 Застосування патчів для API та стейкінгу...");

    // Перевіряємо, чи завантажено модуль управління ID
    if (!window.UserIdManager) {
        console.error("❌ Модуль UserIdManager не знайдено! Спочатку підключіть user-id-manager.js");
        return;
    }

    /**
     * Патч для WinixAPI.getStakingData
     */
    function patchStakingApi() {
        if (window.WinixAPI && window.WinixAPI.getStakingData) {
            const originalGetStakingData = window.WinixAPI.getStakingData;

            window.WinixAPI.getStakingData = async function() {
                // Отримуємо ID користувача через менеджер
                const userId = window.UserIdManager.getUserId();

                if (!userId) {
                    console.error("🚫 Не вдалося отримати ID користувача для запиту стейкінгу!");
                    return { status: 'error', message: 'ID користувача не знайдено' };
                }

                console.log(`🔄 Запит на отримання даних стейкінгу для користувача ${userId}`);

                try {
                    // Використовуємо оригінальну функцію, але з правильним ID
                    return await originalGetStakingData();
                } catch (error) {
                    console.error("❌ Помилка отримання даних стейкінгу:", error);
                    return { status: 'error', message: error.message || 'Помилка запиту даних стейкінгу' };
                }
            };

            console.log("✅ Функцію WinixAPI.getStakingData успішно патчено");
        }
    }

    /**
     * Патч для WinixStakingSystem
     */
    function patchStakingSystem() {
        if (window.WinixStakingSystem) {
            // Патч для отримання даних стейкінгу
            if (window.WinixStakingSystem.getStakingData) {
                const originalGetStakingData = window.WinixStakingSystem.getStakingData;

                window.WinixStakingSystem.getStakingData = function() {
                    // Оновлюємо ID користувача в DOM перед запитом
                    const userId = window.UserIdManager.getUserId();
                    if (userId) {
                        window.UserIdManager.updateDomElements(userId);
                    }

                    return originalGetStakingData();
                };

                console.log("✅ Функцію WinixStakingSystem.getStakingData успішно патчено");
            }

            // Патч для створення стейкінгу
            if (window.WinixStakingSystem.createStaking) {
                const originalCreateStaking = window.WinixStakingSystem.createStaking;

                window.WinixStakingSystem.createStaking = async function(amount, period) {
                    // Оновлюємо ID користувача в DOM перед запитом
                    const userId = window.UserIdManager.getUserId();
                    if (userId) {
                        window.UserIdManager.updateDomElements(userId);
                    }

                    return await originalCreateStaking(amount, period);
                };

                console.log("✅ Функцію WinixStakingSystem.createStaking успішно патчено");
            }
        }
    }

    /**
     * Патч для оновлення DOM елементів ID перед критичними операціями
     */
    function setupDomObserver() {
        // Спостереження за змінами в DOM для оновлення ID
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    // Перевіряємо, чи були додані або змінені елементи з ID користувача
                    const idElements = document.querySelectorAll('#user-id, .user-id-value, [data-user-id]');
                    if (idElements.length > 0) {
                        const userId = window.UserIdManager.getUserId();
                        if (userId) {
                            window.UserIdManager.updateDomElements(userId);
                        }
                    }
                }
            });
        });

        // Спостерігаємо за змінами в усьому документі
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'class', 'data-user-id']
        });

        console.log("✅ Спостереження за DOM для оновлення ID успішно налаштовано");
    }

    /**
     * Патч для функцій навігації
     */
    function patchNavigation() {
        // Патч для window.navigateTo
        if (typeof window.navigateTo === 'function') {
            const originalNavigateTo = window.navigateTo;

            window.navigateTo = function(page) {
                // Зберігаємо ID користувача перед навігацією
                const userId = window.UserIdManager.getUserId();
                if (userId) {
                    window.UserIdManager.saveUserId(userId);

                    // Додаємо ID до URL, якщо його там ще немає
                    if (page.indexOf('?') === -1) {
                        page += `?id=${userId}`;
                    } else if (page.indexOf('id=') === -1) {
                        page += `&id=${userId}`;
                    }
                }

                // Викликаємо оригінальну функцію з модифікованою сторінкою
                return originalNavigateTo(page);
            };

            console.log("✅ Функцію window.navigateTo успішно патчено");
        }
    }

    /**
     * Основна функція ініціалізації патчів
     */
    function init() {
        // Ініціалізуємо модуль управління ID
        window.UserIdManager.init();

        // Додаємо патчі для різних модулів
        patchStakingApi();
        patchStakingSystem();
        patchNavigation();
        setupDomObserver();

        // Додаємо обробник для оновлення ID при завантаженні сторінки
        window.addEventListener('load', function() {
            const userId = window.UserIdManager.getUserId();
            if (userId) {
                console.log("🔄 Оновлення ID користувача на сторінці після завантаження:", userId);
                window.UserIdManager.updateDomElements(userId);
            }
        });

        console.log("✅ Патчі успішно ініціалізовано");
    }

    // Запускаємо ініціалізацію
    init();
})();