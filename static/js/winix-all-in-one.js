/**
 * winix-all-in-one.js
 *
 * Об'єднаний файл виправлень для системи WINIX, який включає всі необхідні виправлення
 * з winix-fix.js, winix-debug.js, winix-staking-fix.js і winix-ui-fix.js
 * а також додаткові виправлення для навігації та стилів повідомлень.
 *
 * Цей файл повинен бути підключений останнім після основних скриптів:
 * - winix-init.js
 * - winix-core.js
 * - winix-connector.js
 */

(function() {
    console.log("🚀 WINIX-ALL-IN-ONE: Запуск єдиної системи виправлень...");

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
                return new Promise((resolve) => {
                    // Видаляємо попередні повідомлення, якщо вони є
                    const existingOverlays = document.querySelectorAll('.alert-overlay');
                    existingOverlays.forEach(overlay => {
                        overlay.parentNode.removeChild(overlay);
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

                    // Додаємо стилі (взяті з наданих файлів)
                    const style = document.createElement('style');
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

                    // Додаємо елементи та стилі на сторінку
                    container.appendChild(messageElement);
                    container.appendChild(button);
                    overlay.appendChild(container);
                    document.head.appendChild(style);
                    document.body.appendChild(overlay);

                    // Обробник для кнопки OK
                    button.addEventListener('click', function() {
                        overlay.parentNode.removeChild(overlay);
                        if (typeof callback === 'function') {
                            callback();
                        }
                        resolve();
                    });
                });
            };

            // Якщо в системі є WinixCore, замінюємо його функцію показу повідомлень
            if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                const originalShowNotification = window.WinixCore.UI.showNotification;

                window.WinixCore.UI.showNotification = function(message, type, callback) {
                    // Визначаємо, чи це помилка
                    const isError = (
                        type === 'error' ||
                        type === 'ERROR' ||
                        (window.WinixCore.MESSAGE_TYPES && type === window.WinixCore.MESSAGE_TYPES.ERROR)
                    );

                    // Викликаємо нашу стильну функцію
                    return window.simpleAlert(message, isError, callback);
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
                let rewardPercent = 7; // За замовчуванням

                if (stakingData.period === 7) rewardPercent = 4;
                else if (stakingData.period === 14) rewardPercent = 9;
                else if (stakingData.period === 28) rewardPercent = 15;

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
                const sourceValue = localStorage.getItem(sourceKey);
                if (sourceValue !== null) {
                    const targetValue = localStorage.getItem(targetKey);
                    // Якщо значення вже існує і відрізняється, беремо більш нове/логічне
                    if (targetValue !== null && targetValue !== sourceValue) {
                        try {
                            // Для стейкінгу обираємо об'єкт з hasActiveStaking
                            if (sourceKey === 'winix_staking' || sourceKey === 'stakingData') {
                                const sourceData = JSON.parse(sourceValue);
                                const targetData = JSON.parse(targetValue);

                                if (sourceData.hasActiveStaking && !targetData.hasActiveStaking) {
                                    localStorage.setItem(targetKey, sourceValue);
                                } else if (!sourceData.hasActiveStaking && targetData.hasActiveStaking) {
                                    localStorage.setItem(sourceKey, targetValue);
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
                        } catch (e) {
                            log('error', `Помилка синхронізації ${sourceKey} з ${targetKey}:`, e);
                            // У випадку помилки просто копіюємо
                            localStorage.setItem(targetKey, sourceValue);
                        }
                    }
                    // Якщо цільового значення немає, просто копіюємо
                    else if (targetValue === null) {
                        localStorage.setItem(targetKey, sourceValue);
                    }
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
                backButton.parentNode.replaceChild(newBackButton, backButton);

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
                const newNavItem = navItem.cloneNode(true);
                navItem.parentNode.replaceChild(newNavItem, navItem);

                // Додаємо новий обробник
                newNavItem.addEventListener('click', function() {
                    const section = this.getAttribute('data-section');
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
                            url = 'index.html';
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
                            url = 'general.html';
                            break;
                        default:
                            url = section + '.html';
                    }

                    // Переходимо за посиланням
                    window.location.href = url;
                });
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

            // Запобігаємо глобальному клонуванню документа, яке призводить до втрати всіх обробників
            window.dangerousCloneDocument = function() {
                log('warn', 'Спроба клонування всього документа заблокована - це може призвести до втрати всіх обробників подій');
                return false;
            };

            // Замінюємо оригінальний метод Node.prototype.cloneNode більш безпечною версією
            const originalCloneNode = Node.prototype.cloneNode;
            Node.prototype.cloneNode = function(deep) {
                // Якщо хтось намагається клонувати цілий документ або html-елемент
                if (this === document || this === document.documentElement) {
                    log('warn', 'Спроба клонування documentElement заблокована');

                    // Замість цього починаємо пофрагментно переприв'язувати обробники
                    fixNavigation();
                    fixStakingButtons();

                    // Повертаємо оригінальний елемент
                    return this;
                }

                // В інших випадках дозволяємо клонування
                return originalCloneNode.call(this, deep);
            };

            log('info', 'Виправлення дублікатів обробників подій успішно застосовано');
            return true;
        } catch (e) {
            log('error', 'Помилка виправлення дублікатів обробників подій:', e);

            // Відновлюємо оригінальний метод
            if (originalCloneNode) {
                Node.prototype.cloneNode = originalCloneNode;
            }

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
            }

            // 5. Виправляємо дублікати обробників подій
            fixDuplicateEventListeners();

            // 6. Виправляємо навігацію
            fixNavigation();

            // 7. Встановлюємо глобальні функції для сумісності
            window.fixNavigation = fixNavigation;
            window.fixStakingData = fixStakingData;
            window.simpleAlert = window.simpleAlert || function(message, isError, callback) {
                alert(message);
                if (callback) callback();
            };

            log('info', 'Всі виправлення успішно запущено');
            return true;
        } catch (e) {
            log('error', 'Помилка запуску виправлень:', e);
            return false;
        }
    }

    // Виконуємо всі виправлення при завантаженні сторінки
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

    // Якщо сторінка вже завантажена
    if (document.readyState === 'complete') {
        runAllFixes();
        console.log("✅ WINIX-ALL-IN-ONE: Всі виправлення успішно застосовано (сторінка вже завантажена)");
    }

    console.log("✅ WINIX-ALL-IN-ONE: Модуль виправлень ініціалізовано");

    // Запобігання дублюванню обробників подій для важливих елементів
    function preventDuplicateEventListeners(elementIds) {
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // Клонуємо елемент, щоб видалити всі попередні обробники
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                console.log(`Обробники подій очищено для елемента '${id}'`);
            }
        });
    }
    })();