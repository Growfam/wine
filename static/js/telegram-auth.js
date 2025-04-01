/**
 * Центральна система авторизації Telegram
 */

(function() {
    window.TelegramAuth = {
        // Зберігати дані користувача
        userData: null,

        // Ініціалізація
        init: function() {
            console.log("🔄 Ініціалізація Telegram Auth");

            // Відправляємо дані для дебагу
            this.sendDebugData({
                type: "telegram_data",
                data: window.Telegram?.WebApp?.initDataUnsafe || "not available",
                user: window.Telegram?.WebApp?.initDataUnsafe?.user || "not available",
                location: window.location.href,
                timestamp: new Date().toISOString()
            });

            // Перевіряємо, чи доступний Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                // Отримуємо дані користувача
                const tg = window.Telegram.WebApp;
                tg.ready();

                const user = tg.initDataUnsafe?.user;
                if (user && user.id) {
                    this.userData = user;
                    console.log("✅ Отримано дані користувача:", user);

                    // Зберігаємо ID в сховищі, щоб не втратити при переході між сторінками
                    localStorage.setItem('telegram_user_id', user.id);

                    // Оновлюємо елемент з ID на сторінці
                    this.updateUserIdElement(user.id);

                    // Авторизуємо користувача на сервері
                    this.authorizeUser(user);

                    return user;
                } else {
                    console.error("❌ Не вдалося отримати дані користувача з Telegram WebApp");

                    // Відправляємо деталі помилки
                    this.sendDebugData({
                        type: "error",
                        error: "No user data in WebApp",
                        webAppData: tg.initDataUnsafe,
                        timestamp: new Date().toISOString()
                    });

                    // Спроба відновити ID з localStorage
                    const savedId = localStorage.getItem('telegram_user_id');
                    if (savedId) {
                        console.log("ℹ️ Використовуємо збережений ID:", savedId);
                        this.updateUserIdElement(savedId);
                        return { id: savedId };
                    }
                }
            } else {
                console.error("❌ Telegram WebApp не доступний");

                // Відправляємо деталі помилки
                this.sendDebugData({
                    type: "error",
                    error: "Telegram WebApp not available",
                    navigator: navigator.userAgent,
                    timestamp: new Date().toISOString()
                });
            }

            return null;
        },

        // Функція для відправлення даних для дебагу
        sendDebugData: function(data) {
            console.log("📤 Відправлення дебаг-даних:", data);

            fetch('/api/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP помилка! Статус: ${response.status}`);
                }
                console.log("✅ Дебаг-дані успішно відправлено");
                return response.json();
            })
            .catch(error => console.error("❌ Помилка відправлення дебаг-даних:", error));
        },

        // Отримання ID поточного користувача
        getCurrentUserId: function() {
            // Спочатку перевіряємо збережені дані
            if (this.userData && this.userData.id) {
                return this.userData.id;
            }

            // Потім перевіряємо localStorage
            const savedId = localStorage.getItem('telegram_user_id');
            if (savedId) {
                return savedId;
            }

            // Потім перевіряємо елемент на сторінці
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const id = userIdElement.textContent.trim();
                if (id && id !== '12345678') {
                    return id;
                }
            }

            // Нарешті, намагаємося отримати з Telegram WebApp напряму
            if (window.Telegram && window.Telegram.WebApp) {
                const user = window.Telegram.WebApp.initDataUnsafe?.user;
                if (user && user.id) {
                    return user.id;
                }
            }

            console.error("❌ Не вдалося отримати ID користувача жодним способом");

            // Відправляємо деталі помилки
            this.sendDebugData({
                type: "error",
                error: "Failed to get user ID",
                element_id: document.getElementById('user-id')?.textContent || "not found",
                localStorage: localStorage.getItem('telegram_user_id') || "not found",
                timestamp: new Date().toISOString()
            });

            return null;
        },

        // Оновлення елемента з ID користувача
        updateUserIdElement: function(userId) {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
                console.log("✅ Оновлено елемент з ID користувача:", userId);
            } else {
                console.error("❌ Елемент з ID користувача не знайдено");

                // Відправляємо деталі помилки
                this.sendDebugData({
                    type: "error",
                    error: "User ID element not found",
                    userId: userId,
                    timestamp: new Date().toISOString()
                });
            }
        },

        // Авторизація користувача на сервері
        authorizeUser: function(userData) {
            console.log("🔄 Авторизація користувача на сервері:", userData);

            fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log("✅ Авторизація успішна:", data);

                    // Відправити подію про успішну авторизацію
                    document.dispatchEvent(new CustomEvent('telegram-auth-success', {
                        detail: data.data
                    }));
                } else {
                    console.error("❌ Помилка авторизації:", data);

                    // Відправляємо деталі помилки
                    this.sendDebugData({
                        type: "error",
                        error: "Auth request failed",
                        response: data,
                        userData: userData,
                        timestamp: new Date().toISOString()
                    });
                }
            })
            .catch(error => {
                console.error("❌ Помилка запиту авторизації:", error);

                // Відправляємо деталі помилки
                this.sendDebugData({
                    type: "error",
                    error: "Auth request exception",
                    message: error.message,
                    userData: userData,
                    timestamp: new Date().toISOString()
                });
            });
        }
    };

    // Автоматична ініціалізація
    document.addEventListener('DOMContentLoaded', function() {
        window.TelegramAuth.init();
    });

    // Якщо DOM вже завантажено, ініціалізуємо зараз
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        window.TelegramAuth.init();
    }
})();