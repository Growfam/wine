/**
 * winix-id-monitor.js - Модуль для відстеження проблем з ID користувача
 * Додайте цей скрипт на всі сторінки додатку для діагностики і виправлення
 * проблем з ID користувача.
 */

(function() {
    // Об'єкт для моніторингу ID користувача
    const WinixIdMonitor = {
        // Налаштування
        settings: {
            debug: false,         // Виводити діагностичні повідомлення
            autoFix: true,        // Автоматично виправляти проблеми
            checkInterval: 10000, // Інтервал перевірки ID (мс)
        },

        // Історія змін ID
        idHistory: [],

        // Ініціалізація модуля
        init: function() {
            if (this.settings.debug) {
                console.log("🔍 ID Monitor: Ініціалізація модуля моніторингу ID");
            }

            // Перевіряємо поточний ID
            this.checkCurrentId();

            // Налаштовуємо моніторинг localStorage
            this.monitorLocalStorage();

            // Налаштовуємо регулярну перевірку ID
            this.setupPeriodicCheck();

            // Експортуємо публічний API
            window.WinixIdMonitor = {
                checkId: this.checkCurrentId.bind(this),
                fixId: this.fixInvalidId.bind(this),
                getValidId: this.getValidUserId.bind(this)
            };

            return true;
        },

        // Перевірка поточного ID
        checkCurrentId: function() {
            const telegramId = localStorage.getItem('telegram_user_id');
            const winixId = localStorage.getItem('winix_user_id');
            const userId = localStorage.getItem('userId');

            if (this.settings.debug) {
                console.log("🔍 ID Monitor: Поточні ID:", {
                    telegramId: telegramId,
                    winixId: winixId,
                    userId: userId
                });
            }

            // Перевіряємо валідність ID у localStorage
            let foundInvalid = false;

            if (telegramId && !this.isValidId(telegramId)) {
                foundInvalid = true;
                this.logInvalidId('telegram_user_id', telegramId);
            }

            if (winixId && !this.isValidId(winixId)) {
                foundInvalid = true;
                this.logInvalidId('winix_user_id', winixId);
            }

            if (userId && !this.isValidId(userId)) {
                foundInvalid = true;
                this.logInvalidId('userId', userId);
            }

            // Якщо знайдено невалідні ID і включено автоматичне виправлення
            if (foundInvalid && this.settings.autoFix) {
                this.fixInvalidId();
            }

            return !foundInvalid;
        },

        // Перевірка валідності ID
        isValidId: function(id) {
            return id &&
                   id !== 'undefined' &&
                   id !== 'null' &&
                   id !== undefined &&
                   id !== null &&
                   id.toString().trim() !== '';
        },

        // Логування невалідного ID
        logInvalidId: function(key, value) {
            console.warn(`⚠️ ID Monitor: Виявлено невалідний ID в ${key}: "${value}"`);

            this.idHistory.push({
                time: new Date().toISOString(),
                type: 'invalid_id',
                key: key,
                value: value,
                stack: new Error().stack,
                url: window.location.href
            });
        },

        // Виправлення невалідного ID
        fixInvalidId: function() {
            console.log("🔧 ID Monitor: Спроба виправлення невалідного ID");

            // Видаляємо невалідні ID з localStorage
            const keys = ['telegram_user_id', 'winix_user_id', 'userId'];

            keys.forEach(key => {
                const value = localStorage.getItem(key);
                if (value && !this.isValidId(value)) {
                    console.log(`🔧 ID Monitor: Видалення невалідного значення з ${key}: "${value}"`);
                    localStorage.removeItem(key);
                }
            });

            // Отримуємо валідний ID з доступних джерел
            const validId = this.getValidUserId();

            if (validId) {
                console.log(`✅ ID Monitor: Знайдено валідний ID: ${validId}`);

                // Зберігаємо в усі потрібні ключі localStorage
                localStorage.setItem('telegram_user_id', validId);

                // Оновлюємо ID в DOM елементах
                this.updateDomElements(validId);

                // Записуємо в історію
                this.idHistory.push({
                    time: new Date().toISOString(),
                    type: 'fix_id',
                    value: validId,
                    url: window.location.href
                });

                return true;
            } else {
                console.error("❌ ID Monitor: Не вдалося отримати валідний ID");
                return false;
            }
        },

        // Отримання валідного ID користувача з усіх можливих джерел
        getValidUserId: function() {
            // 1. Спробуємо отримати з API модуля
            if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
                const apiId = window.WinixAPI.getUserId();
                if (this.isValidId(apiId)) return apiId;
            }

            // 2. Спробуємо отримати з Telegram WebApp
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
                if (this.isValidId(tgUserId)) return tgUserId.toString();
            }

            // 3. Спробуємо отримати з DOM елементів
            const userIdElements = document.querySelectorAll('#user-id, #user-id-display');
            for (const element of userIdElements) {
                if (element && this.isValidId(element.textContent)) {
                    return element.textContent.trim();
                }
            }

            // 4. Спробуємо отримати з localStorage (валідні значення)
            const keys = ['telegram_user_id', 'winix_user_id', 'userId'];
            for (const key of keys) {
                const value = localStorage.getItem(key);
                if (this.isValidId(value)) return value;
            }

            // 5. Спробуємо отримати з URL параметрів
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (this.isValidId(urlId)) return urlId;

            // 6. Якщо нічого не знайдено, генеруємо новий ID
            const generatedId = '2449' + Math.floor(10000 + Math.random() * 90000);
            console.warn(`⚠️ ID Monitor: Сгенеровано тимчасовий ID: ${generatedId}`);

            return generatedId;
        },

        // Оновлення елементів DOM з ID користувача
        updateDomElements: function(userId) {
            const userIdElements = document.querySelectorAll('#user-id, #user-id-display');
            userIdElements.forEach(element => {
                if (element) element.textContent = userId;
            });
        },

        // Моніторинг змін в localStorage
        monitorLocalStorage: function() {
            const originalSetItem = localStorage.setItem;
            const monitor = this;

            localStorage.setItem = function(key, value) {
                // Моніторимо ключі, які містять ID
                if (key.toLowerCase().includes('id') || key.toLowerCase().includes('user')) {
                    if (monitor.settings.debug) {
                        console.log(`🔍 ID Monitor: localStorage.setItem('${key}', '${value}')`);
                    }

                    // Перевіряємо валідність ID
                    if (!monitor.isValidId(value)) {
                        console.warn(`⚠️ ID Monitor: Спроба запису невалідного значення в ${key}: "${value}"`);

                        // Записуємо в історію
                        monitor.idHistory.push({
                            time: new Date().toISOString(),
                            type: 'invalid_setItem',
                            key: key,
                            value: value,
                            stack: new Error().stack,
                            url: window.location.href
                        });

                        // Блокуємо запис невалідного значення, якщо увімкнено автоматичне виправлення
                        if (monitor.settings.autoFix && (key === 'telegram_user_id' || key === 'winix_user_id' || key === 'userId')) {
                            console.warn(`🛑 ID Monitor: Блокування запису невалідного значення в ${key}`);
                            return;
                        }
                    }
                }

                // Викликаємо оригінальний метод
                originalSetItem.call(this, key, value);
            };
        },

        // Налаштування регулярної перевірки ID
        setupPeriodicCheck: function() {
            const monitor = this;

            // Регулярна перевірка ID
            setInterval(function() {
                monitor.checkCurrentId();
            }, this.settings.checkInterval);
        }
    };

    // Ініціалізуємо модуль
    WinixIdMonitor.init();
})();