/**
 * winix-all-in-one.js
 *
 * Об'єднаний файл виправлень для системи WINIX, який включає всі необхідні виправлення
 * з winix-fix.js, winix-debug.js, winix-staking-fix.js і winix-ui-fix.js
 * а також додаткові виправлення для навігації та стилів повідомлень.
 *
 * Використовує єдиний API модуль для всіх запитів до сервера.
 *
 * Цей файл повинен бути підключений останнім після основних скриптів:
 * - winix-init.js
 * - winix-core.js
 * - winix-connector.js
 * - api.js
 */

(function() {
    console.log("🚀 WINIX-ALL-IN-ONE: Запуск єдиної системи виправлень...");

    // Запобігаємо повторній ініціалізації
    if (window.WinixAllInOneInitialized) {
        console.log("ℹ️ WINIX-ALL-IN-ONE: Вже ініціалізовано");
        return;
    }

    // Глобальні налаштування
    const WINIX_SETTINGS = {
        debug: false,                  // Режим відлагодження
        autoRestoreStaking: true,      // Автоматичне відновлення даних стейкінгу
        fixDuplicateEventListeners: true, // Виправлення дублюючих обробників подій
        styledNotifications: true,     // Стильні сповіщення
        navigatioFixes: true,          // Виправлення навігації
        stakingCancelFee: 0.2,         // Комісія при скасуванні стейкінгу (20%)
        defaultGradient: 'linear-gradient(90deg, #1A1A2E, #0F3460, #00C9A7)' // Основний градієнт
    };

    // Перевіряємо наявність API модуля
    if (!window.WinixAPI) {
        console.warn("⚠️ WINIX-ALL-IN-ONE: API модуль не знайдено! Рекомендуємо підключити api.js");
    }

    // ====================== ДОПОМІЖНІ ФУНКЦІЇ ======================

    /**
     * Логування з префіксом системи
     * @param {string} type Тип повідомлення (log, error, warn, info)
     * @param {string} message Повідомлення
     * @param {any} data Додаткові дані (опціонально)
     */
    function log(type, message, data) {
        if (!WINIX_SETTINGS.debug && type !== 'error') return;

        const prefix = '🔧 WINIX-ALL-IN-ONE';

        switch (type) {
            case 'error':
                console.error(`${prefix} ПОМИЛКА:`, message, data);
                break;
            case 'warn':
                console.warn(`${prefix} ПОПЕРЕДЖЕННЯ:`, message, data);
                break;
            case 'info':
                console.info(`${prefix} ІНФО:`, message, data);
                break;
            default:
                console.log(`${prefix}:`, message, data);
        }
    }

    /**
     * Безпечне отримання даних з localStorage
     * @param {string} key Ключ
     * @param {any} defaultValue Значення за замовчуванням
     * @param {boolean} isJSON Чи парсити як JSON
     * @returns {any} Отримане значення
     */
    function getStorage(key, defaultValue, isJSON = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;

            if (isJSON) {
                return JSON.parse(value);
            }

            // Якщо це число, парсимо як число
            if (!isNaN(parseFloat(value))) {
                return parseFloat(value);
            }

            return value;
        } catch (e) {
            log('error', `Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Безпечне збереження даних в localStorage
     * @param {string} key Ключ
     * @param {any} value Значення
     * @returns {boolean} Успішність операції
     */
    function setStorage(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            log('error', `Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Генерація унікального ID
     * @returns {string} Унікальний ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Перевірка валідності ID
     * @param {any} id - ID для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isValidId(id) {
        return id &&
            id !== 'undefined' &&
            id !== 'null' &&
            id !== undefined &&
            id !== null &&
            id.toString().trim() !== '';
    }

    // ====================== СТИЛЬНІ ПОВІДОМЛЕННЯ ======================

    /**
     * Налаштування стильних повідомлень з градієнтами та анімаціями
     */
    function setupStyledNotifications() {
        try {
            log('info', 'Налаштування стильних повідомлень');

            // Перевіряємо, чи вже додано функцію simpleAlert
            if (window.simpleAlert) {
                log('info', 'Функція simpleAlert вже існує');
                return true;
            }

            // Створюємо глобальний об'єкт для UI-функцій
            window.winixUI = window.winixUI || {};

            /**
             * Функція для показу стильних повідомлень
             * @param {string} message Текст повідомлення
             * @param {boolean} isError Чи це повідомлення про помилку
             * @param {Function} callback Функція зворотного виклику
             * @returns {Promise} Promise, який виконається після закриття повідомлення
             */
            window.simpleAlert = window.winixUI.simpleAlert = function(message, isError = false, callback) {
                if (!message || typeof message !== 'string') {
                    log('warn', 'Спроба показати порожнє або невалідне повідомлення');
                    message = 'Помилка відображення повідомлення';
                }

                return new Promise((resolve) => {
                    try {
                        // Видаляємо попередні повідомлення, якщо вони є
                        const existingOverlays = document.querySelectorAll('.alert-overlay');
                        existingOverlays.forEach(overlay => {
                            try {
                                overlay.parentNode.removeChild(overlay);
                            } catch (e) {
                                log('warn', 'Помилка видалення існуючого overlay:', e);
                            }
                        });

                        // Створюємо елементи повідомлення
                        const overlay = document.createElement('div');
                        overlay.className = 'alert-overlay';

                        const container = document.createElement('div');
                        container.className = 'alert-container ' + (isError ? 'error' : 'success');

                        const messageElement = document.createElement('div');
                        messageElement.className = 'alert-message';
                        messageElement.textContent = message;

                        const button = document.createElement('button');
                        button.className = 'alert-button';
                        button.textContent = 'OK';

                        // Додаємо стилі
                        if (!document.getElementById('winix-styled-alerts-css')) {
                            const style = document.createElement('style');
                            style.id = 'winix-styled-alerts-css';
                            style.textContent = `
                                /* Стилі для сповіщень */
                                .alert-overlay {
                                    position: fixed;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    bottom: 0;
                                    background: rgba(0, 0, 0, 0.5);
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    z-index: 1000;
                                    backdrop-filter: blur(0.1875rem); /* 3px */
                                    animation: fadeIn 0.2s ease-out;
                                }

                                @keyframes fadeIn {
                                    from { opacity: 0; }
                                    to { opacity: 1; }
                                }

                                .alert-container {
                                    width: 85%;
                                    max-width: 21.875rem; /* 350px */
                                    border-radius: 0.9375rem; /* 15px */
                                    padding: 1.25rem; /* 20px */
                                    box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4);
                                    display: flex;
                                    flex-direction: column;
                                    gap: 1.25rem; /* 20px */
                                    animation: bounceIn 0.3s ease-out;
                                }

                                .alert-container.success {
                                    background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(15, 52, 96, 0.95));
                                    border: 0.0625rem solid rgba(0, 201, 167, 0.5); /* 1px */
                                    box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4), 0 0 0.9375rem rgba(0, 201, 167, 0.3);
                                }

                                .alert-container.error {
                                    background: linear-gradient(135deg, rgba(46, 26, 26, 0.95), rgba(96, 15, 15, 0.95));
                                    border: 0.0625rem solid rgba(201, 0, 0, 0.5); /* 1px */
                                    box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.4), 0 0 0.9375rem rgba(201, 0, 0, 0.3);
                                }

                                @keyframes bounceIn {
                                    0% { transform: scale(0.5); opacity: 0; }
                                    70% { transform: scale(1.05); }
                                    100% { transform: scale(1); opacity: 1; }
                                }

                                .alert-message {
                                    text-align: center;
                                    font-size: 1rem; /* 16px */
                                    color: #fff;
                                }

                                .alert-button {
                                    align-self: center;
                                    width: 6.25rem; /* 100px */
                                    height: 2.5rem; /* 40px */
                                    border-radius: 0.625rem; /* 10px */
                                    font-size: 1rem; /* 16px */
                                    font-weight: 500;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                    border: none;
                                    background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
                                    color: #fff;
                                    box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.2);
                                }

                                .alert-button:active {
                                    transform: scale(0.97);
                                }
                            `;
                            document.head.appendChild(style);
                        }

                        // Додаємо елементи та стилі на сторінку
                        container.appendChild(messageElement);
                        container.appendChild(button);
                        overlay.appendChild(container);
                        document.body.appendChild(overlay);

                        // Обробник для кнопки OK
                        button.addEventListener('click', function() {
                            try {
                                overlay.parentNode.removeChild(overlay);
                            } catch (e) {
                                log('warn', 'Помилка видалення overlay:', e);
                            }

                            if (typeof callback === 'function') {
                                callback();
                            }
                            resolve();
                        });
                    } catch (e) {
                        log('error', 'Помилка при показі стильного повідомлення:', e);

                        // Резервний варіант - звичайний alert
                        alert(message);

                        if (typeof callback === 'function') {
                            callback();
                        }
                        resolve();
                    }
                });
            };

            // Додаємо функцію сповіщень
            window.showToast = window.winixUI.showToast = function(message, type = 'success', duration = 3000) {
                if (!message || typeof message !== 'string') {
                    log('warn', 'Спроба показати порожнє або невалідне сповіщення');
                    message = 'Помилка відображення сповіщення';
                }

                try {
                    // Видаляємо попередні сповіщення
                    const existingToasts = document.querySelectorAll('.winix-toast');
                    existingToasts.forEach(toast => {
                        try {
                            toast.parentNode.removeChild(toast);
                        } catch (e) {
                            log('warn', 'Помилка видалення існуючого toast:', e);
                        }
                    });

                    // Додаємо стилі для сповіщень, якщо вони ще не додані
                    if (!document.getElementById('winix-toast-css')) {
                        const style = document.createElement('style');
                        style.id = 'winix-toast-css';
                        style.textContent = `
                            .winix-toast {
                                position: fixed;
                                bottom: 20px;
                                left: 50%;
                                transform: translateX(-50%);
                                padding: 12px 20px;
                                border-radius: 10px;
                                color: white;
                                font-size: 16px;
                                z-index: 1000;
                                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                                animation: toast-in-out 0.5s ease-in-out;
                            }
                            
                            .winix-toast.success {
                                background: linear-gradient(90deg, #00C9A7, #0F3460);
                                border-left: 4px solid #00C9A7;
                            }
                            
                            .winix-toast.error {
                                background: linear-gradient(90deg, #CF0A0A, #7E1717);
                                border-left: 4px solid #CF0A0A;
                            }
                            
                            .winix-toast.info {
                                background: linear-gradient(90deg, #4285F4, #0F3460);
                                border-left: 4px solid #4285F4;
                            }
                            
                            .winix-toast.warning {
                                background: linear-gradient(90deg, #FFC107, #FF8F00);
                                border-left: 4px solid #FFC107;
                            }
                            
                            @keyframes toast-in-out {
                                0% { opacity: 0; transform: translate(-50%, 20px); }
                                10% { opacity: 1; transform: translate(-50%, 0); }
                                90% { opacity: 1; transform: translate(-50%, 0); }
                                100% { opacity: 0; transform: translate(-50%, -20px); }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    // Створюємо елемент сповіщення
                    const toast = document.createElement('div');
                    toast.className = `winix-toast ${type}`;
                    toast.textContent = message;
                    document.body.appendChild(toast);

                    // Автоматичне видалення сповіщення
                    setTimeout(() => {
                        try {
                            if (toast.parentNode) {
                                toast.parentNode.removeChild(toast);
                            }
                        } catch (e) {
                            log('warn', 'Помилка видалення toast:', e);
                        }
                    }, duration);
                } catch (e) {
                    log('error', 'Помилка при показі toast:', e);
                }
            };

            // Якщо в системі є WinixCore, замінюємо його функцію показу повідомлень
            if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                const originalShowNotification = window.WinixCore.UI.showNotification;

                window.WinixCore.UI.showNotification = function(message, type, callback) {
                    try {
                        // Визначаємо, чи це помилка
                        const isError = (
                            type === 'error' ||
                            type === 'ERROR' ||
                            (window.WinixCore.MESSAGE_TYPES && type === window.WinixCore.MESSAGE_TYPES.ERROR)
                        );

                        // Викликаємо нашу стильну функцію
                        return window.simpleAlert(message, isError, callback);
                    } catch (e) {
                        log('error', 'Помилка при заміні функції showNotification:', e);
                        // Викликаємо оригінальну функцію як запасний варіант
                        return originalShowNotification.call(window.WinixCore.UI, message, type, callback);
                    }
                };
            }

            log('info', 'Стильні повідомлення успішно налаштовано');
            return true;
        } catch (e) {
            log('error', 'Помилка налаштування стильних повідомлень:', e);
            return false;
        }
    }

    // ====================== ВИПРАВЛЕННЯ СТЕЙКІНГУ ======================

    /**
     * Глибоке виправлення даних стейкінгу
     */
    function fixStakingData() {
        try {
            log('info', 'Виправлення даних стейкінгу');

            // Синхронізуємо між ключами localStorage
            syncStorageKeys();

            // Перевіряємо наявність даних стейкінгу
            const coreData = localStorage.getItem('winix_staking');
            const fixData = localStorage.getItem('stakingData');

            // Використовуємо наявні дані
            let dataToFix = null;
            if (coreData) {
                dataToFix = coreData;
            } else if (fixData) {
                dataToFix = fixData;
                // Копіюємо в основний ключ
                localStorage.setItem('winix_staking', fixData);
            } else {
                log('info', 'Даних стейкінгу не знайдено');
                return false;
            }

            // Розпаковуємо дані
            let stakingData;
            try {
                stakingData = JSON.parse(dataToFix);
                log('info', 'Розпаковані дані стейкінгу:', stakingData);
            } catch (e) {
                log('error', 'Помилка розпакування даних стейкінгу:', e);
                return false;
            }

            // Виправляємо дані
            let needsFixing = false;

            // Перевіряємо hasActiveStaking
            if (stakingData.stakingAmount > 0 && stakingData.hasActiveStaking !== true) {
                stakingData.hasActiveStaking = true;
                needsFixing = true;
                log('info', 'Виправлення hasActiveStaking');
            }

            // Перевіряємо очікувану винагороду
            if (stakingData.expectedReward === undefined && stakingData.stakingAmount > 0 && stakingData.period) {
                // Розраховуємо винагороду
                let rewardPercent;
                if (stakingData.period === 7) rewardPercent = 4;
                else if (stakingData.period === 14) rewardPercent = 9;
                else if (stakingData.period === 28) rewardPercent = 15;
                else rewardPercent = 7; // За замовчуванням

                stakingData.rewardPercent = rewardPercent;
                stakingData.expectedReward = stakingData.stakingAmount * (rewardPercent / 100);
                needsFixing = true;
                log('info', 'Виправлення expectedReward');
            }

            // Перевіряємо дати
            if (!stakingData.startDate) {
                const now = new Date();
                stakingData.startDate = now.toISOString();
                needsFixing = true;
                log('info', 'Виправлення startDate');
            }

            if (!stakingData.endDate && stakingData.startDate && stakingData.period) {
                const startDate = new Date(stakingData.startDate);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + stakingData.period);
                stakingData.endDate = endDate.toISOString();
                needsFixing = true;
                log('info', 'Виправлення endDate');
            }

            // Оновлюємо remainingDays
            if (stakingData.hasActiveStaking && stakingData.endDate) {
                const now = new Date();
                const endDate = new Date(stakingData.endDate);
                const diffTime = endDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                stakingData.remainingDays = Math.max(0, diffDays);
                needsFixing = true;
                log('info', 'Оновлення remainingDays');
            }

            // Зберігаємо виправлені дані
            if (needsFixing) {
                localStorage.setItem('winix_staking', JSON.stringify(stakingData));
                localStorage.setItem('stakingData', JSON.stringify(stakingData));
                log('info', 'Дані стейкінгу успішно виправлено');
                return true;
            }

            log('info', 'Виправлення даних стейкінгу не потрібне');
            return false;
        } catch (e) {
            log('error', 'Помилка виправлення даних стейкінгу:', e);
            return false;
        }
    }

    /**
     * Синхронізація ключів локального сховища
     */
    function syncStorageKeys() {
        try {
            log('info', 'Синхронізація ключів локального сховища');

            // Мапування ключів
            const keyMappings = {
                'winix_balance': 'userTokens',
                'userTokens': 'winix_balance',
                'winix_coins': 'userCoins',
                'userCoins': 'winix_coins',
                'winix_staking': 'stakingData',
                'stakingData': 'winix_staking',
                'winix_transactions': 'transactions',
                'transactions': 'winix_transactions'
            };

            // Синхронізуємо ключі
            for (const [sourceKey, targetKey] of Object.entries(keyMappings)) {
                try {
                    const sourceValue = localStorage.getItem(sourceKey);
                    if (sourceValue !== null) {
                        const targetValue = localStorage.getItem(targetKey);
                        // Якщо значення вже існує і відрізняється, беремо більш нове/логічне
                        if (targetValue !== null && targetValue !== sourceValue) {
                            // Для стейкінгу обираємо об'єкт з hasActiveStaking
                            if (sourceKey === 'winix_staking' || sourceKey === 'stakingData') {
                                try {
                                    const sourceData = JSON.parse(sourceValue);
                                    const targetData = JSON.parse(targetValue);

                                    console.log(`Синхронізую ключі ${sourceKey} і ${targetKey}`, sourceData, targetData);

                                    // Перевіряємо, який об'єкт має активний стейкінг
                                    const sourceHasActive = sourceData && sourceData.hasActiveStaking;
                                    const targetHasActive = targetData && targetData.hasActiveStaking;

                                    if (sourceHasActive && !targetHasActive) {
                                        console.log(`Копіюю активний стейкінг з ${sourceKey} в ${targetKey}`);
                                        localStorage.setItem(targetKey, sourceValue);
                                    } else if (!sourceHasActive && targetHasActive) {
                                        console.log(`Копіюю активний стейкінг з ${targetKey} в ${sourceKey}`);
                                        localStorage.setItem(sourceKey, targetValue);
                                    } else if (sourceHasActive && targetHasActive) {
                                        // Якщо обидва активні, порівнюємо за датою створення або сумою
                                        const sourceTime = sourceData.creationTimestamp || 0;
                                        const targetTime = targetData.creationTimestamp || 0;

                                        if (sourceTime > targetTime) {
                                            console.log(`Використовую новіший стейкінг з ${sourceKey}`);
                                            localStorage.setItem(targetKey, sourceValue);
                                        } else if (targetTime > sourceTime) {
                                            console.log(`Використовую новіший стейкінг з ${targetKey}`);
                                            localStorage.setItem(sourceKey, targetValue);
                                        }
                                    }
                                } catch (e) {
                                    console.error(`Помилка синхронізації ключів стейкінгу (${sourceKey}, ${targetKey}):`, e);
                                    // У випадку помилки, безпечно копіюємо одне значення в інше
                                    localStorage.setItem(targetKey, sourceValue);
                                }
                            }
                            // Для балансу обираємо більше значення
                            else if (sourceKey === 'winix_balance' || sourceKey === 'userTokens') {
                                const sourceAmount = parseFloat(sourceValue);
                                const targetAmount = parseFloat(targetValue);

                                if (!isNaN(sourceAmount) && !isNaN(targetAmount)) {
                                    if (sourceAmount > targetAmount) {
                                        localStorage.setItem(targetKey, sourceValue);
                                    } else {
                                        localStorage.setItem(sourceKey, targetValue);
                                    }
                                }
                            }
                            // Для решти просто копіюємо
                            else {
                                localStorage.setItem(targetKey, sourceValue);
                            }
                        }
                        // Якщо цільового значення немає, просто копіюємо
                        else if (targetValue === null) {
                            localStorage.setItem(targetKey, sourceValue);
                        }
                    }
                } catch (e) {
                    log('error', `Помилка синхронізації ${sourceKey} з ${targetKey}:`, e);
                }
            }

            log('info', 'Ключі локального сховища успішно синхронізовано');
            return true;
        } catch (e) {
            log('error', 'Помилка синхронізації ключів локального сховища:', e);
            return false;
        }
    }

    // ====================== ВИПРАВЛЕННЯ НАВІГАЦІЇ ======================

    /**
     * Виправлення навігації в додатку
     */
    function fixNavigation() {
        try {
            log('info', 'Виправлення навігації');

            // Перевіряємо, чи потрібно виправляти навігацію
            if (!WINIX_SETTINGS.navigatioFixes) {
                log('info', 'Виправлення навігації вимкнено в налаштуваннях');
                return false;
            }

            // Виправлення кнопки "Назад"
            const backButton = document.getElementById('back-button');
            if (backButton) {
                // Видаляємо всі існуючі обробники з кнопки "Назад"
                const newBackButton = backButton.cloneNode(true);
                if (backButton.parentNode) {
                    backButton.parentNode.replaceChild(newBackButton, backButton);
                }

                // Додаємо новий обробник
                newBackButton.addEventListener('click', function() {
                    log('info', 'Клік на кнопці "Назад"');

                    // Зберігаємо поточний баланс перед навігацією
                    if (window.WinixCore && window.WinixCore.Balance) {
                        const tokens = window.WinixCore.Balance.getTokens();
                        sessionStorage.setItem('lastBalance', tokens.toString());
                    } else if (window.balanceSystem) {
                        const tokens = window.balanceSystem.getTokens();
                        sessionStorage.setItem('lastBalance', tokens.toString());
                    }

                    sessionStorage.setItem('navigationTime', Date.now().toString());

                    // Визначаємо, на яку сторінку повертатися
                    const currentPage = window.location.pathname.split('/').pop();

                    if (currentPage === 'staking-details.html') {
                        window.location.href = 'staking.html';
                    } else if (currentPage === 'staking.html') {
                        window.location.href = 'wallet.html';
                    } else {
                        window.history.back();
                    }
                });

                log('info', 'Кнопку "Назад" успішно налаштовано');
            }

            // Виправлення навігаційного меню
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(navItem => {
                // Видаляємо всі існуючі обробники з елементів навігації
                try {
                    const newNavItem = navItem.cloneNode(true);
                    if (navItem.parentNode) {
                        navItem.parentNode.replaceChild(newNavItem, navItem);
                    }

                    // Додаємо новий обробник
                    newNavItem.addEventListener('click', function() {
                        const section = this.getAttribute('data-section');
                        if (!section) return;

                        log('info', `Клік на елементі навігації "${section}"`);

                        // Оновлюємо класи активності
                        document.querySelectorAll('.nav-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        this.classList.add('active');

                        // Зберігаємо поточний баланс перед навігацією
                        if (window.WinixCore && window.WinixCore.Balance) {
                            const tokens = window.WinixCore.Balance.getTokens();
                            const coins = window.WinixCore.Balance.getCoins();
                            sessionStorage.setItem('lastBalance', tokens.toString());
                            sessionStorage.setItem('lastCoins', coins.toString());
                        } else if (window.balanceSystem) {
                            const tokens = window.balanceSystem.getTokens();
                            const coins = window.balanceSystem.getCoins();
                            sessionStorage.setItem('lastBalance', tokens.toString());
                            sessionStorage.setItem('lastCoins', coins.toString());
                        }

                        sessionStorage.setItem('navigationTime', Date.now().toString());

                        // Визначаємо URL для переходу
                        let url = '';
                        switch (section) {
                            case 'home':
                                url = 'original-index.html';
                                break;
                            case 'earn':
                                url = 'earn.html';
                                break;
                            case 'referrals':
                                url = 'referrals.html';
                                break;
                            case 'wallet':
                                url = 'wallet.html';
                                break;
                            case 'general':
                                if (window.simpleAlert) {
                                    window.simpleAlert("Ця функція буде доступна пізніше");
                                    return; // Запобігаємо навігації
                                } else if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                                    window.WinixCore.UI.showNotification("Ця функція буде доступна пізніше", window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.INFO : 'info');
                                    return; // Запобігаємо навігації
                                } else {
                                    alert("Ця функція буде доступна пізніше");
                                    return; // Запобігаємо навігації
                                }
                            default:
                                url = section + '.html';
                        }

                        // Переходимо за посиланням
                        window.location.href = url;
                    });
                } catch (e) {
                    log('error', 'Помилка обробки навігаційного елемента:', e);
                }
            });

            log('info', 'Навігаційне меню успішно налаштовано');

            // Створюємо глобальний об'єкт для додаткових функцій навігації
            window.WinixNavigation = {
                // Функція для переходу на іншу сторінку зі збереженням поточного стану
                navigateTo: function(page) {
                    try {
                        log('info', `Навігація до ${page}`);

                        // Зберігаємо поточний баланс перед навігацією
                        if (window.WinixCore && window.WinixCore.Balance) {
                            if (typeof window.WinixCore.Balance.getTokens === 'function') {
                                const tokens = window.WinixCore.Balance.getTokens();
                                sessionStorage.setItem('lastBalance', tokens.toString());
                            }

                            if (typeof window.WinixCore.Balance.getCoins === 'function') {
                                const coins = window.WinixCore.Balance.getCoins();
                                sessionStorage.setItem('lastCoins', coins.toString());
                            }
                        } else if (window.balanceSystem) {
                            if (typeof window.balanceSystem.getTokens === 'function') {
                                const tokens = window.balanceSystem.getTokens();
                                sessionStorage.setItem('lastBalance', tokens.toString());
                            }

                            if (typeof window.balanceSystem.getCoins === 'function') {
                                const coins = window.balanceSystem.getCoins();
                                sessionStorage.setItem('lastCoins', coins.toString());
                            }
                        }

                        sessionStorage.setItem('navigationTime', Date.now().toString());

                        // Переходимо на іншу сторінку
                        window.location.href = page;

                        return true;
                    } catch (e) {
                        log('error', `Помилка навігації до ${page}:`, e);
                        return false;
                    }
                },

                // Функція для повернення назад
                goBack: function() {
                    try {
                        log('info', 'Повернення назад');

                        // Зберігаємо поточний баланс перед навігацією
                        if (window.WinixCore && window.WinixCore.Balance) {
                            const tokens = window.WinixCore.Balance.getTokens();
                            sessionStorage.setItem('lastBalance', tokens.toString());
                        } else if (window.balanceSystem) {
                            const tokens = window.balanceSystem.getTokens();
                            sessionStorage.setItem('lastBalance', tokens.toString());
                        }

                        sessionStorage.setItem('navigationTime', Date.now().toString());

                        // Повертаємося назад
                        window.history.back();

                        return true;
                    } catch (e) {
                        log('error', 'Помилка повернення назад:', e);
                        return false;
                    }
                },

                // Функція для оновлення обробників навігації
                refreshNavigationHandlers: function() {
                    return fixNavigation();
                }
            };

            // Встановлюємо на глобальному рівні для зручності
            window.navigateTo = window.WinixNavigation.navigateTo;
            window.goBack = window.WinixNavigation.goBack;

            log('info', 'Навігацію успішно виправлено');
            return true;
        } catch (e) {
            log('error', 'Помилка виправлення навігації:', e);
            return false;
        }
    }

    // ====================== ВИПРАВЛЕННЯ ДУБЛІКАТІВ ОБРОБНИКІВ ПОДІЙ ======================

    /**
     * Виправлення дублікатів обробників подій для всіх ключових елементів
     */
    function fixDuplicateEventListeners() {
        try {
            log('info', 'Виправлення дублікатів обробників подій');

            // Перевіряємо, чи потрібно виправляти дублікати
            if (!WINIX_SETTINGS.fixDuplicateEventListeners) {
                log('info', 'Виправлення дублікатів обробників подій вимкнено в налаштуваннях');
                return false;
            }

            // Список усіх важливих елементів, які потенційно можуть мати дублюючі обробники
            const importantElements = [
                'back-button',
                'stake-button',
                'cancel-staking-button',
                'add-to-stake-button',
                'details-button',
                'max-button',
                'staking-amount',
                'staking-period'
            ];

            // Створюємо функцію для безпечного клонування елементів
            const safeClone = function(element) {
                if (!element || !element.parentNode) return element;

                try {
                    const clone = element.cloneNode(true);
                    element.parentNode.replaceChild(clone, element);
                    return clone;
                } catch (e) {
                    log('error', `Помилка при клонуванні елемента ${element.id || 'без ID'}:`, e);
                    return element;
                }
            };

            // Запобігаємо глобальному клонуванню документа, яке призводить до втрати всіх обробників
            window.dangerousCloneDocument = function() {
                log('warn', 'Спроба клонування всього документа заблокована - це може призвести до втрати всіх обробників подій');
                return false;
            };

            // Обробляємо важливі елементи і видаляємо всі дублюючі обробники
            importantElements.forEach(elementId => {
                const element = document.getElementById(elementId);
                if (element) {
                    safeClone(element);
                    log('info', `Очищено обробники для елемента ${elementId}`);
                }
            });

            log('info', 'Виправлення дублікатів обробників подій успішно застосовано');
            return true;
        } catch (e) {
            log('error', 'Помилка виправлення дублікатів обробників подій:', e);
            return false;
        }
    }

    // ====================== ВІДНОВЛЕННЯ ДАНИХ СТЕЙКІНГУ ======================

    /**
     * Спроба відновлення даних стейкінгу з сервера
     */
    function restoreStakingData() {
        try {
            console.log("🔄 Спроба відновлення даних стейкінгу з сервера");

            // Перевіряємо наявність API модуля
            if (!window.WinixAPI || typeof window.WinixAPI.getStakingData !== 'function') {
                console.warn("⚠️ API модуль не знайдено або відсутня функція getStakingData");
                return false;
            }

            // Перевіряємо наявність валідного ID користувача
            if (window.WinixAPI.getUserId && !isValidId(window.WinixAPI.getUserId())) {
                console.warn("⚠️ Відсутній валідний ID користувача");
                return false;
            }

            // Використовуємо API модуль для отримання даних стейкінгу
            window.WinixAPI.getStakingData()
                .then(data => {
                    if (data.status === 'success' && data.data) {
                        console.log("✅ Отримано дані стейкінгу з сервера:", data.data);

                        // Зберігаємо дані в обох ключах
                        const stakingStr = JSON.stringify(data.data);
                        try {
                            localStorage.setItem('stakingData', stakingStr);
                            localStorage.setItem('winix_staking', stakingStr);
                        } catch (e) {
                            console.error("❌ Помилка збереження даних стейкінгу в localStorage:", e);
                        }

                        // Оновлюємо інтерфейс, якщо можливо
                        if (window.updateStakingDisplay) {
                            window.updateStakingDisplay();
                        } else if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateStakingDisplay === 'function') {
                            window.WinixCore.UI.updateStakingDisplay();
                        } else if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function') {
                            window.WinixStakingSystem.updateStakingDisplay();
                        }

                        return true;
                    } else {
                        console.warn("⚠️ Не вдалося отримати дані стейкінгу з сервера", data);
                        return false;
                    }
                })
                .catch(error => {
                    console.error("❌ Помилка при відновленні даних стейкінгу:", error);
                    return false;
                });

            return true;
        } catch (e) {
            console.error("❌ Помилка функції відновлення даних стейкінгу:", e);
            return false;
        }
    }

    // ====================== ЗАПУСК ВСІХ ВИПРАВЛЕНЬ ======================

    /**
     * Основна функція запуску всіх виправлень
     */
    function runAllFixes() {
        try {
            log('info', 'Запуск всіх виправлень');

            // 1. Включаємо режим відлагодження, якщо потрібно
            if (WINIX_SETTINGS.debug) {
                console.log("🔧 WINIX-ALL-IN-ONE: Режим відлагодження увімкнено");
                if (window.WinixAPI) {
                    window.WinixAPI.setDebugMode(true);
                }
            }

            // 2. Синхронізуємо ключі локального сховища
            syncStorageKeys();

            // 3. Налаштовуємо стильні повідомлення
            if (WINIX_SETTINGS.styledNotifications) {
                setupStyledNotifications();
            }

            // 4. Виправляємо дані стейкінгу
            if (WINIX_SETTINGS.autoRestoreStaking) {
                fixStakingData();
                // Асинхронно відновлюємо дані стейкінгу з сервера
                setTimeout(restoreStakingData, 1000);
            }

            // 5. Виправляємо дублікати обробників подій
            fixDuplicateEventListeners();

            // 6. Виправляємо навігацію
            fixNavigation();

            // 7. Встановлюємо глобальні функції для сумісності
            window.fixNavigation = fixNavigation;
            window.fixStakingData = fixStakingData;

            if (!window.simpleAlert) {
                window.simpleAlert = function(message, isError, callback) {
                    alert(message);
                    if (callback) callback();
                };
            }

            // Встановлюємо флаг успішної ініціалізації
            window.WinixAllInOneInitialized = true;

            log('info', 'Всі виправлення успішно запущено');
            return true;
        } catch (e) {
            log('error', 'Помилка запуску виправлень:', e);
            return false;
        }
    }

    // Виконуємо всі виправлення при завантаженні сторінки
    if (document.readyState === 'loading') {
        window.addEventListener('load', function() {
            // Запускаємо всі виправлення
            runAllFixes();

            // Встановлюємо глобальний обробник помилок
            window.onerror = function(message, source, lineno, colno, error) {
                if (WINIX_SETTINGS.debug) {
                    console.error(`🔧 WINIX-ALL-IN-ONE: Помилка JavaScript: ${message} у ${source}:${lineno}:${colno}`);
                }
                return true;
            };

            console.log("✅ WINIX-ALL-IN-ONE: Всі виправлення успішно застосовано");
        });
    }
    // Якщо сторінка вже завантажена
    else {
        runAllFixes();
        console.log("✅ WINIX-ALL-IN-ONE: Всі виправлення успішно застосовано (сторінка вже завантажена)");
    }

    // Також виконаємо відновлення даних стейкінгу при повному завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        if (WINIX_SETTINGS.autoRestoreStaking) {
            // Відновлюємо дані стейкінгу за розкладом
            setTimeout(restoreStakingData, 2000);
        }
    });

    console.log("✅ WINIX-ALL-IN-ONE: Модуль виправлень ініціалізовано");
})();