/**
 * Telegram WebApp User Authorization
 */

(function() {
    const TelegramAuth = {
        userData: null,

        init: function() {
            console.log("🔄 Ініціалізація Telegram Auth");

            const tg = window.Telegram?.WebApp;

            if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                const user = tg.initDataUnsafe.user;

                if (user.id && user.id !== 12345678) {
                    this.userData = user;
                    console.log("✅ Отримано реальні дані користувача:", user);

                    localStorage.setItem('telegram_user_id', user.id);
                    this.updateUserIdElement(user.id);
                    this.authorizeUser(user);
                } else {
                    console.error("❌ Отримано тестові або некоректні дані користувача:", user);
                }
            } else {
                console.error("❌ Telegram WebApp або дані користувача недоступні");
            }
        },

        updateUserIdElement: function(userId) {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
                console.log("✅ Оновлено ID користувача на сторінці:", userId);
            } else {
                console.warn("⚠️ Елемент для ID користувача не знайдено");
            }
        },

        authorizeUser: function(userData) {
            console.log("🔄 Авторизація користувача на сервері:", userData);

            fetch('/api/auth', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id: userData.id,
                    username: userData.username,
                    first_name: userData.first_name,
                    last_name: userData.last_name
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log("✅ Авторизація на сервері успішна", data);
                    document.dispatchEvent(new CustomEvent('telegram-auth-success', {detail: data.data}));
                } else {
                    console.error("❌ Помилка авторизації на сервері", data);
                }
            })
            .catch(err => console.error("❌ Виникла помилка при авторизації:", err));
        }
    };

    document.addEventListener('DOMContentLoaded', () => TelegramAuth.init());
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        TelegramAuth.init();
    }
})();