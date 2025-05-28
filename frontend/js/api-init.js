/**
 * API Initialization - забезпечує правильний порядок ініціалізації
 * CRITICAL: Цей файл повинен завантажуватися ПЕРШИМ
 */
(function() {
    'use strict';

    console.log('🔧 API Init: Початок ініціалізації');

    // Блокуємо всі API запити до готовності системи
    window._WINIX_READY = false;
    window._WINIX_USER_ID = null;

    // Глобальний об'єкт для відстеження стану
    window.WinixInit = {
        modules: {
            telegram: false,
            api: false,
            auth: false,
            core: false
        },

        // Отримання Telegram ID одразу при завантаженні
        initTelegram: function() {
            console.log('🔍 Перевірка Telegram WebApp...');

            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();

                    // Отримуємо ID користувача
                    if (window.Telegram.WebApp.initDataUnsafe?.user?.id) {
                        const userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                        window._WINIX_USER_ID = userId;

                        // Зберігаємо в localStorage
                        localStorage.setItem('telegram_user_id', userId);

                        // Оновлюємо DOM елемент
                        const userIdElement = document.getElementById('user-id');
                        if (userIdElement) {
                            userIdElement.textContent = userId;
                        }

                        console.log('✅ Telegram ID отримано:', userId);
                        this.modules.telegram = true;
                        this.checkAllReady();
                        return true;
                    }
                } catch (e) {
                    console.error('❌ Помилка ініціалізації Telegram:', e);
                }
            }

            console.error('❌ Telegram WebApp недоступний або немає ID користувача');
            return false;
        },

        checkModule: function(moduleName) {
            this.modules[moduleName] = true;
            console.log(`✅ Module ready: ${moduleName}`);
            this.checkAllReady();
        },

        checkAllReady: function() {
            // Перевіряємо чи всі критичні модулі готові
            const criticalModules = ['telegram', 'api', 'auth'];
            const criticalReady = criticalModules.every(m => this.modules[m] === true);

            if (criticalReady && !window._WINIX_READY) {
                window._WINIX_READY = true;
                console.log('🎉 Система готова до роботи! User ID:', window._WINIX_USER_ID);
                document.dispatchEvent(new CustomEvent('winix-ready', {
                    detail: { userId: window._WINIX_USER_ID }
                }));
            }
        },

        waitForReady: function() {
            return new Promise((resolve) => {
                if (window._WINIX_READY) {
                    resolve(window._WINIX_USER_ID);
                } else {
                    document.addEventListener('winix-ready', (e) => {
                        resolve(e.detail.userId);
                    }, { once: true });
                }
            });
        }
    };

    // Ініціалізуємо Telegram одразу
    window.WinixInit.initTelegram();
})();