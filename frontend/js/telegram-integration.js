/**
 * telegram-integration.js - Модуль для інтеграції з Telegram Mini App
 * Забезпечує взаємодію з Telegram Web App API
 */

(function() {
    'use strict';

    console.log("🚀 TelegramIntegration: Ініціалізація інтеграції з Telegram Mini App");

    // Об'єкт для роботи з Telegram Web App
    const TelegramApp = {
        // Змінні для зберігання стану
        webApp: null,
        userData: null,
        themeParams: null,
        isInitialized: false,

        /**
         * Ініціалізація Telegram Web App
         */
        init: function() {
            console.log("Ініціалізація Telegram Web App");

            // Перевіряємо наявність Telegram WebApp API
            if (window.Telegram && window.Telegram.WebApp) {
                this.webApp = window.Telegram.WebApp;

                try {
                    // Розширюємо вікно додатку
                    this.webApp.expand();

                    // Отримуємо дані користувача і теми
                    this.userData = this.webApp.initDataUnsafe && this.webApp.initDataUnsafe.user ?
                                    this.webApp.initDataUnsafe.user : null;
                    this.themeParams = this.webApp.themeParams || null;

                    // Застосовуємо тему Telegram
                    this.applyTheme();

                    // Зберігаємо ID користувача для використання в API
                    if (this.userData && this.userData.id) {
                        localStorage.setItem('telegram_user_id', this.userData.id.toString());
                        console.log("✅ Отримано Telegram ID:", this.userData.id);
                    } else {
                        console.warn("⚠️ Не вдалося отримати ID користувача з WebApp");
                    }

                    this.isInitialized = true;
                    console.log("✅ Telegram WebApp успішно ініціалізовано");

                    // Подія для інших компонентів
                    window.dispatchEvent(new CustomEvent('telegramWebAppReady', {
                        detail: { userData: this.userData }
                    }));
                } catch (e) {
                    console.error("❌ Помилка ініціалізації Telegram WebApp:", e);
                }
            } else {
                console.error("❌ Telegram WebApp API не знайдено. Перевірте підключення telegram-web-app.js");
            }

            return this.isInitialized;
        },

        /**
         * Застосування теми Telegram до інтерфейсу
         */
        applyTheme: function() {
            if (!this.themeParams) return;

            // Отримуємо колір тексту, фону і акценту
            const textColor = this.themeParams.text_color || '#ffffff';
            const bgColor = this.themeParams.bg_color || '#1A1A2E';
            const buttonColor = this.themeParams.button_color || '#00C9A7';
            const buttonTextColor = this.themeParams.button_text_color || '#ffffff';

            // Створюємо CSS для теми
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    --tg-text-color: ${textColor};
                    --tg-bg-color: ${bgColor};
                    --tg-button-color: ${buttonColor};
                    --tg-button-text-color: ${buttonTextColor};
                }
                
                .tg-button {
                    background-color: var(--tg-button-color) !important;
                    color: var(--tg-button-text-color) !important;
                }
            `;
            document.head.appendChild(style);

            console.log("Тему Telegram застосовано");
        },

        /**
         * Отримання Telegram ID користувача
         */
        getUserId: function() {
            if (this.userData && this.userData.id) {
                return this.userData.id.toString();
            }

            // Спроба отримати з localStorage
            return localStorage.getItem('telegram_user_id');
        },

        /**
         * Отримання імені користувача
         */
        getUserName: function() {
            if (!this.userData) return null;

            return this.userData.first_name || this.userData.username || "Користувач";
        },

        /**
         * Показати спливаюче повідомлення через Telegram
         */
        showAlert: function(message) {
            if (this.webApp && this.webApp.showAlert) {
                this.webApp.showAlert(message);
                return true;
            }

            // Запасний варіант, якщо Telegram WebApp недоступний
            alert(message);
            return false;
        },

        /**
         * Показати вікно підтвердження через Telegram
         */
        showConfirm: function(message, callback) {
            if (this.webApp && this.webApp.showConfirm) {
                this.webApp.showConfirm(message, callback);
                return true;
            }

            // Запасний варіант
            const result = confirm(message);
            if (callback) {
                callback(result);
            }
            return false;
        },

        /**
         * Закрити міні-додаток
         */
        close: function() {
            if (this.webApp && this.webApp.close) {
                this.webApp.close();
            }
        },

        /**
         * Поширити розіграш через Telegram
         */
        shareRaffle: function(raffleId, raffleTitle) {
            const shareText = `🎮 WINIX: ${raffleTitle}\n\nДолучайся до розіграшу з крутими призами! Бери участь і вигравай.`;

            if (this.webApp && this.webApp.shareUrl) {
                const url = `https://t.me/YOUR_BOT_USERNAME/app?raffle_id=${raffleId}`;
                this.webApp.shareUrl({
                    url: url,
                    text: shareText
                });
                return true;
            }

            // Запасний варіант - просто копіюємо текст
            navigator.clipboard.writeText(shareText).then(() => {
                if (window.showToast) {
                    window.showToast('Текст для поширення скопійовано в буфер обміну');
                }
            });
            return false;
        },

        /**
         * Підписка на параметр start
         */
        onStartParamReceived: function(callback) {
            // Перевіряємо наявність startParam
            if (this.webApp && this.webApp.initDataUnsafe && this.webApp.initDataUnsafe.start_param) {
                const startParam = this.webApp.initDataUnsafe.start_param;
                console.log("Отримано start_param:", startParam);

                if (callback) {
                    callback(startParam);
                }
            }
        },

        /**
         * Обробка запрошення через реферальне посилання
         */
        handleReferralStart: function() {
            this.onStartParamReceived(function(startParam) {
                // Перевіряємо, чи це реферальне посилання
                if (startParam.startsWith('ref_')) {
                    const referrerId = startParam.substring(4);
                    console.log("Користувач прийшов за реферальним посиланням від:", referrerId);

                    // Зберігаємо реферальний ID
                    localStorage.setItem('referrer_id', referrerId);

                    // Якщо є функція обробки реферальних запрошень, викликаємо її
                    if (window.processReferral) {
                        window.processReferral(referrerId);
                    }
                }

                // Перевіряємо, чи це посилання на конкретний розіграш
                if (startParam.startsWith('raffle_')) {
                    const raffleId = startParam.substring(7);
                    console.log("Користувач прийшов на конкретний розіграш:", raffleId);

                    // Якщо є функція для відкриття розіграшу, викликаємо її
                    if (window.openRaffleDetails) {
                        // Обгортаємо в setTimeout, щоб DOM встиг завантажитись
                        setTimeout(() => {
                            window.openRaffleDetails(raffleId);
                        }, 500);
                    }
                }
            });
        }
    };

    // Ініціалізуємо при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            TelegramApp.init();
            TelegramApp.handleReferralStart();
        });
    } else {
        TelegramApp.init();
        TelegramApp.handleReferralStart();
    }

    // Експортуємо публічний API
    window.TelegramApp = TelegramApp;
})();