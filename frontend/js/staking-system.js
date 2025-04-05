/**
 * staking-system.js
 *
 * Оновлена система управління стейкінгом для WINIX
 * Повністю замінює staking-buttons-fix.js і emergency-staking.js
 * Використовує єдиний API модуль для всіх запитів
 */

(function() {
    console.log("🚀 Ініціалізація системи стейкінгу WINIX");

    // Запобігаємо повторній ініціалізації
    if (window.WinixStakingSystem) {
        console.log("⚠️ Система стейкінгу вже ініціалізована");
        return window.WinixStakingSystem;
    }

    // --------------- ПРИВАТНІ ЗМІННІ ---------------

    // Глобальний прапорець для запобігання одночасним запитам
    let _isProcessingStakingAction = false;

    // Флаг для відслідковування, чи відображається модальне вікно
    let _isModalVisible = false;

    // Налаштування стейкінгу
    const STAKING_CONFIG = {
        minAmount: 50,                 // Мінімальна сума стейкінгу
        maxBalancePercentage: 0.9,     // Максимально дозволений відсоток від балансу
        allowedPeriods: [7, 14, 28],   // Дозволені періоди стейкінгу
        rewardRates: {
            7: 4,    // 4% за 7 днів
            14: 9,   // 9% за 14 днів
            28: 15   // 15% за 28 днів
        },
        cancellationFee: 0.2  // Штраф при скасуванні (20%)
    };

    // Ключі для локального сховища
    const STORAGE_KEYS = {
        USER_TOKENS: 'userTokens',
        WINIX_BALANCE: 'winix_balance',
        STAKING_DATA: 'stakingData',
        WINIX_STAKING: 'winix_staking',
        STAKING_HISTORY: 'stakingHistory',
        USER_ID: 'telegram_user_id'
    };

    // --------------- ДОПОМІЖНІ ФУНКЦІЇ ---------------

    /**
     * Безпечне отримання даних з локального сховища
     * @param {string} key - Ключ для отримання даних
     * @param {*} defaultValue - Значення за замовчуванням
     * @param {boolean} parse - Чи потрібно парсити JSON
     * @returns {*} Отримані дані або значення за замовчуванням
     */
    function getFromStorage(key, defaultValue = null, parse = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return parse ? JSON.parse(value) : value;
        } catch (e) {
            console.error(`Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Безпечне збереження даних у всі сховища
     * @param {string} key - Ключ для збереження
     * @param {*} value - Значення для збереження
     * @returns {boolean} Результат операції
     */
    function updateStorage(key, value) {
        try {
            // Перетворюємо на рядок, якщо це об'єкт
            const valueToStore = typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value);

            // Зберігаємо в localStorage
            localStorage.setItem(key, valueToStore);

            // Зберігаємо в sessionStorage (якщо доступне)
            try { sessionStorage.setItem(key, valueToStore); } catch(e) {}

            // Оновлюємо альтернативні ключі
            if (key === STORAGE_KEYS.STAKING_DATA) {
                localStorage.setItem(STORAGE_KEYS.WINIX_STAKING, valueToStore);
                try { sessionStorage.setItem(STORAGE_KEYS.WINIX_STAKING, valueToStore); } catch(e) {}
            }
            else if (key === STORAGE_KEYS.USER_TOKENS) {
                localStorage.setItem(STORAGE_KEYS.WINIX_BALANCE, valueToStore);
                try { sessionStorage.setItem(STORAGE_KEYS.WINIX_BALANCE, valueToStore); } catch(e) {}
            }

            return true;
        } catch (e) {
            console.error(`Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Видалення даних з усіх сховищ
     * @param {string} key - Ключ для видалення
     */
    function removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
            try { sessionStorage.removeItem(key); } catch(e) {}

            // Видаляємо альтернативні ключі
            if (key === STORAGE_KEYS.STAKING_DATA) {
                localStorage.removeItem(STORAGE_KEYS.WINIX_STAKING);
                try { sessionStorage.removeItem(STORAGE_KEYS.WINIX_STAKING); } catch(e) {}
            }
            else if (key === STORAGE_KEYS.USER_TOKENS) {
                localStorage.removeItem(STORAGE_KEYS.WINIX_BALANCE);
                try { sessionStorage.removeItem(STORAGE_KEYS.WINIX_BALANCE); } catch(e) {}
            }
        } catch (e) {
            console.error(`Помилка видалення ${key} з localStorage:`, e);
        }
    }

    /**
     * Отримання поточного ID користувача з різних джерел
     * і нормалізація значення (перевірка на undefined, null, тощо)
     */
    function getUserId() {
        try {
            // Спочатку пробуємо отримати з localStorage
            let userId = getFromStorage(STORAGE_KEYS.USER_ID, '');

            // Перевіряємо, чи ID валідний
            if (!userId || userId === 'undefined' || userId === 'null') {
                // Пробуємо знайти в URL-параметрах
                const urlParams = new URLSearchParams(window.location.search);
                userId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');

                if (userId) {
                    // Зберігаємо знайдений ID
                    updateStorage(STORAGE_KEYS.USER_ID, userId);
                } else {
                    // Пробуємо знайти в DOM
                    const userIdElement = document.getElementById('user-id');
                    if (userIdElement && userIdElement.textContent) {
                        userId = userIdElement.textContent.trim();
                        if (userId) {
                            updateStorage(STORAGE_KEYS.USER_ID, userId);
                        }
                    }
                }
            }

            // Оновлюємо DOM-елемент з ID, якщо він є
            if (userId) {
                const userIdElements = document.querySelectorAll('#user-id, #display-user-id');
                userIdElements.forEach(element => {
                    if (element) element.textContent = userId;
                });
            }

            return userId;
        } catch (e) {
            console.error("Помилка отримання ID користувача:", e);
            return '';
        }
    }

    /**
     * Отримання поточного балансу користувача
     * @returns {number} Поточний баланс
     */
    function getUserBalance() {
        const balance = parseFloat(getFromStorage(STORAGE_KEYS.USER_TOKENS, '0'));
        return isNaN(balance) ? 0 : balance;
    }

    /**
     * Безпечний показ повідомлень з підтримкою різних методів
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи є це повідомлення про помилку
     * @param {Function} callback - Функція, яка викликається після закриття повідомлення
     * @returns {Promise} Проміс, який резолвиться після закриття повідомлення
     */
    function showAlert(message, isError = false, callback = null) {
        console.log(`${isError ? "❌" : "✅"} ${message}`);

        return new Promise((resolve) => {
            // Спочатку пробуємо використати існуючі функції
            if (window.simpleAlert) {
                window.simpleAlert(message, isError, callback);
                resolve();
                return;
            }

            if (window.showToast) {
                window.showToast(message);
                if (callback) setTimeout(callback, 3000);
                resolve();
                return;
            }

            // Перевіряємо, чи є WinixAPI для можливого використання handleApiError
            if (isError && window.WinixAPI && typeof window.WinixAPI.handleApiError === 'function') {
                message = window.WinixAPI.handleApiError(new Error(message), 'операції стейкінгу');
            }

            // Створюємо власне модальне вікно для повідомлення
            const alertOverlay = document.createElement('div');
            alertOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                backdrop-filter: blur(3px);
                animation: alertFadeIn 0.3s ease;
            `;

            // Додаємо анімацію
            const style = document.createElement('style');
            style.textContent = `
                @keyframes alertFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes alertContentFadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);

            // Створюємо контейнер для повідомлення
            const alertContent = document.createElement('div');
            alertContent.style.cssText = `
                background: ${isError ? 'linear-gradient(135deg, #2B1E29, #421E2D)' : 'linear-gradient(135deg, #1E2B3A, #1E3B4A)'};
                border: 1px solid ${isError ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 201, 167, 0.3)'};
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                padding: 20px;
                text-align: center;
                color: white;
                max-width: 80%;
                animation: alertContentFadeIn 0.3s ease;
            `;

            // Додаємо текст повідомлення
            const messageElement = document.createElement('div');
            messageElement.textContent = message;
            messageElement.style.cssText = `
                margin-bottom: 20px;
                font-size: 16px;
            `;

            // Додаємо кнопку ОК
            const okButton = document.createElement('button');
            okButton.textContent = 'OK';
            okButton.style.cssText = `
                background: linear-gradient(90deg, #1E3A5F, #16213E, #1A7A6B);
                border: none;
                border-radius: 10px;
                color: white;
                padding: 8px 25px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.3s ease;
            `;

            // Додаємо обробник для кнопки
            okButton.addEventListener('mouseenter', () => {
                okButton.style.transform = 'scale(1.05)';
            });

            okButton.addEventListener('mouseleave', () => {
                okButton.style.transform = 'scale(1)';
            });

            okButton.addEventListener('click', () => {
                document.body.removeChild(alertOverlay);
                if (callback) callback();
                resolve();
            });

            // Складаємо все разом
            alertContent.appendChild(messageElement);
            alertContent.appendChild(okButton);
            alertOverlay.appendChild(alertContent);
            document.body.appendChild(alertOverlay);

            // Закриття по Esc або через 10 секунд
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(alertOverlay);
                    document.removeEventListener('keydown', handleKeyDown);
                    if (callback) callback();
                    resolve();
                }
            };
            document.addEventListener('keydown', handleKeyDown);

            // Автоматичне закриття через 10 секунд
            setTimeout(() => {
                if (document.body.contains(alertOverlay)) {
                    document.body.removeChild(alertOverlay);
                    if (callback) callback();
                    resolve();
                }
            }, 10000);
        });
    }

    /**
     * Функція для створення модального вікна з введенням суми
     * @param {string} title - Заголовок вікна
     * @param {Function} onConfirm - Функція виклику при підтвердженні
     * @param {Object} options - Додаткові параметри
     * @returns {HTMLElement} Елемент модального вікна
     */
    function showInputModal(title, onConfirm, options = {}) {
        // Якщо вже показується модальне вікно, не створюємо нове
        if (_isModalVisible) {
            console.warn("Модальне вікно вже відображається, пропускаємо створення нового");
            return null;
        }

        _isModalVisible = true;

        // Використовуємо існуючі функції, якщо вони є
        if (window.createInputModal) {
            const modal = window.createInputModal(title, (amount) => {
                _isModalVisible = false;
                onConfirm(amount);
            }, options);

            // Додаємо обробник для закриття модального вікна
            const closeHandler = () => {
                _isModalVisible = false;
            };

            // Шукаємо кнопку закриття
            const closeButton = modal.querySelector('.modal-close, .cancel-button');
            if (closeButton) {
                closeButton.addEventListener('click', closeHandler);
            }

            return modal;
        }

        // Запасний варіант - створюємо своє модальне вікно
        return createCustomInputModal(title, (amount) => {
            _isModalVisible = false;
            onConfirm(amount);
        }, options);
    }

    /**
     * Створення власного модального вікна з удосконаленим дизайном
     * @param {string} title - Заголовок вікна
     * @param {Function} onConfirm - Функція виклику при підтвердженні
     * @param {Object} options - Додаткові параметри
     * @returns {HTMLElement} Елемент модального вікна
     */
    function createCustomInputModal(title, onConfirm, options = {}) {
        // Параметри за замовчуванням
        const defaults = {
            min: 1,
            max: 1000000,
            step: 1,
            placeholder: 'Введіть суму',
            confirmText: 'Підтвердити',
            cancelText: 'Скасувати'
        };

        // Об'єднуємо з переданими параметрами
        const settings = {...defaults, ...options};

        // Створюємо затемнений фон
        const overlay = document.createElement('div');
        overlay.className = 'winix-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9998;
            opacity: 0;
            transition: opacity 0.3s ease;
            backdrop-filter: blur(3px);
        `;

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.className = 'winix-modal';
        modal.style.cssText = `
            background: linear-gradient(135deg, #2B3144, #1A1F2F);
            border-radius: 15px;
            padding: 25px;
            width: 85%;
            max-width: 350px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            transform: scale(0.9);
            transition: transform 0.3s ease;
            color: white;
            border: 1px solid rgba(0, 201, 167, 0.2);
        `;

        // Створюємо заголовок
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = title || "Введіть суму";
        modalTitle.style.cssText = `
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 600;
            text-align: center;
            color: #ffffff;
        `;

        // Створюємо поле вводу
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            position: relative;
            margin-bottom: 25px;
        `;

        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = settings.placeholder;
        input.min = settings.min;
        input.max = settings.max;
        input.step = settings.step;
        input.style.cssText = `
            width: 100%;
            padding: 15px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            color: white;
            font-size: 16px;
            outline: none;
            transition: border-color 0.3s;
            box-sizing: border-box;
        `;

        // Додаємо балансовий індикатор
        const balanceIndicator = document.createElement('div');
        balanceIndicator.style.cssText = `
            font-size: 14px;
            text-align: right;
            margin-top: 8px;
            color: rgba(255, 255, 255, 0.7);
        `;
        balanceIndicator.innerHTML = `Поточний баланс: <span style="color: #00C9A7">${getUserBalance().toFixed(2)}</span> WINIX`;

        // Створюємо кнопки
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            gap: 15px;
        `;

        const cancelButton = document.createElement('button');
        cancelButton.textContent = settings.cancelText;
        cancelButton.style.cssText = `
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
        `;

        const confirmButton = document.createElement('button');
        confirmButton.textContent = settings.confirmText;
        confirmButton.style.cssText = `
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 10px;
            background: linear-gradient(135deg, #00BFA5, #00CFBB);
            color: white;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.3s;
        `;

        // Функція для закриття модального вікна
        function closeModal() {
            overlay.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';

            setTimeout(() => {
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
                _isModalVisible = false;
            }, 300);
        }

        // Додаємо обробники
        cancelButton.addEventListener('click', closeModal);
        confirmButton.addEventListener('click', function() {
            const amount = parseFloat(input.value);
            if (!isNaN(amount) && amount > 0) {
                closeModal();
                onConfirm(amount);
            } else {
                input.style.borderColor = '#FF3B58';

                // Анімація помилки (тряска)
                input.animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(5px)' },
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(5px)' },
                    { transform: 'translateX(0)' }
                ], {
                    duration: 500,
                    easing: 'ease'
                });

                showAlert('Введіть коректну суму', true);
            }
        });

        // Додаємо обробник для клавіші Enter
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                confirmButton.click();
            }
        });

        // Додаємо обробник для зміни вводу (валідація на льоту)
        input.addEventListener('input', function() {
            // Перевіряємо, чи введено коректне значення
            const amount = parseFloat(input.value);
            if (!isNaN(amount) && amount > 0) {
                input.style.borderColor = 'rgba(0, 201, 167, 0.6)';
            } else {
                input.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
        });

        // Збираємо модальне вікно
        inputContainer.appendChild(input);
        inputContainer.appendChild(balanceIndicator);
        buttonsContainer.appendChild(cancelButton);
        buttonsContainer.appendChild(confirmButton);

        modal.appendChild(modalTitle);
        modal.appendChild(inputContainer);
        modal.appendChild(buttonsContainer);
        overlay.appendChild(modal);

        // Додаємо до DOM і запускаємо анімацію
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
            input.focus();
        }, 10);

        // Додаємо обробник для закриття по Escape
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        return overlay;
    }

    /**
     * Функція для валідації суми стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} balance - Поточний баланс користувача
     * @returns {Object} Результат валідації
     */
    function validateStakingAmount(amount, balance) {
        // Перевірка на число
        if (isNaN(amount) || amount <= 0) {
            return {
                isValid: false,
                message: "Введіть коректну суму більше нуля"
            };
        }

        // Перевірка, що сума є цілим числом
        if (amount !== Math.floor(amount)) {
            return {
                isValid: false,
                message: "Сума стейкінгу має бути цілим числом"
            };
        }

        // Перевірка на мінімальну суму
        if (amount < STAKING_CONFIG.minAmount) {
            return {
                isValid: false,
                message: `Мінімальна сума стейкінгу: ${STAKING_CONFIG.minAmount} WINIX`
            };
        }

        // Перевірка на максимальну суму відносно балансу
        const maxAllowedAmount = Math.floor(balance * STAKING_CONFIG.maxBalancePercentage);
        if (amount > maxAllowedAmount) {
            return {
                isValid: false,
                message: `Максимальна сума: ${maxAllowedAmount} WINIX (${STAKING_CONFIG.maxBalancePercentage*100}% від балансу)`
            };
        }

        // Перевірка на достатність балансу
        if (amount > balance) {
            return {
                isValid: false,
                message: `Недостатньо коштів. Ваш баланс: ${balance} WINIX`
            };
        }

        return {
            isValid: true,
            message: ""
        };
    }

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {number} Очікувана винагорода
     */
    function calculateExpectedReward(amount, period) {
        try {
            // Базова перевірка даних
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || isNaN(period) || amount <= 0 || period <= 0) {
                return 0;
            }

            // Отримуємо відсоток відповідно до періоду
            const rewardPercent = STAKING_CONFIG.rewardRates[period] || 9; // За замовчуванням 9%

            // Розраховуємо винагороду
            const reward = (amount * rewardPercent) / 100;

            return parseFloat(reward.toFixed(2));
        } catch (e) {
            console.error('Помилка розрахунку винагороди:', e);
            return 0;
        }
    }

    /**
     * Показати індикатор завантаження
     * @param {string} message - Повідомлення для відображення
     */
    function showProgressIndicator(message) {
        // Видаляємо попередні індикатори
        hideProgressIndicator();

        // Створюємо елемент
        const progressElement = document.createElement('div');
        progressElement.id = 'winix-progress-indicator';
        progressElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(26, 31, 47, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-size: 16px;
            opacity: 0;
            transition: opacity 0.3s ease;
            backdrop-filter: blur(3px);
        `;

        // Додаємо спіннер
        const spinner = document.createElement('div');
        spinner.className = 'winix-spinner';
        spinner.style.cssText = `
            width: 45px;
            height: 45px;
            border: 3px solid rgba(0, 207, 187, 0.3);
            border-radius: 50%;
            border-top-color: #00CFBB;
            animation: winix-spin 1s linear infinite;
            margin-bottom: 20px;
        `;

        // Додаємо стилі для анімації
        const style = document.createElement('style');
        style.textContent = `
            @keyframes winix-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Додаємо повідомлення
        const messageElement = document.createElement('div');
        messageElement.textContent = message || 'Завантаження...';
        messageElement.style.cssText = `
            font-size: 16px;
            font-weight: 500;
            color: white;
            text-align: center;
            max-width: 80%;
        `;

        // Додаємо ID користувача для прозорості
        const userId = getUserId();
        if (userId) {
            const userIdElement = document.createElement('div');
            userIdElement.textContent = `ID користувача: ${userId}`;
            userIdElement.style.cssText = `
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 10px;
            `;
            progressElement.appendChild(userIdElement);
        }

        // Складаємо все разом
        progressElement.appendChild(spinner);
        progressElement.appendChild(messageElement);
        document.body.appendChild(progressElement);

        // Запускаємо анімацію
        setTimeout(() => {
            progressElement.style.opacity = '1';
        }, 10);
    }

    /**
     * Сховати індикатор завантаження
     */
    function hideProgressIndicator() {
        const progressElement = document.getElementById('winix-progress-indicator');
        if (progressElement) {
            progressElement.style.opacity = '0';
            setTimeout(() => {
                if (progressElement.parentNode) {
                    progressElement.parentNode.removeChild(progressElement);
                }
            }, 300);
        }
    }

    // --------------- ОСНОВНІ ФУНКЦІЇ СТЕЙКІНГУ ---------------

    /**
     * Отримання даних стейкінгу
     * @returns {Object} Дані активного стейкінгу
     */
    function getStakingData() {
        // Отримуємо дані з локального сховища
        const stakingData = getFromStorage(STORAGE_KEYS.STAKING_DATA, null, true);

        // Якщо немає даних, повертаємо об'єкт за замовчуванням
        if (!stakingData) {
            return {
                hasActiveStaking: false,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };
        }

        return stakingData;
    }

    /**
     * Перевірка наявності активного стейкінгу
     * @returns {boolean} Чи є активний стейкінг
     */
    function hasActiveStaking() {
        const stakingData = getFromStorage(STORAGE_KEYS.STAKING_DATA, null, true);
        return stakingData && stakingData.hasActiveStaking === true;
    }

    /**
     * Функція для синхронізації даних стейкінгу з сервера
     * @returns {Promise<Object>} Проміс з результатами синхронізації
     */
    async function syncStakingFromServer() {
        let syncIndicator = null;

        try {
            // Перевірка наявності API
            if (!window.WinixAPI || typeof window.WinixAPI.getStakingData !== 'function') {
                console.error("❌ API модуль не ініціалізовано або метод getStakingData недоступний");
                throw new Error("API модуль не готовий");
            }

            // Безпечно створюємо індикатор
            try {
                syncIndicator = document.createElement('div');
                syncIndicator.className = 'winix-sync-indicator';
                syncIndicator.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(0, 207, 187, 0.3);
                    border-radius: 50%;
                    border-top-color: #00CFBB;
                    animation: winix-spin 1s linear infinite;
                    z-index: 9980;
                `;
                document.body.appendChild(syncIndicator);

                // Додаємо стилі анімації, якщо ще немає
                if (!document.getElementById('winix-animations')) {
                    const style = document.createElement('style');
                    style.id = 'winix-animations';
                    style.textContent = `
                        @keyframes winix-spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `;
                    document.head.appendChild(style);
                }
            } catch (domError) {
                console.warn("⚠️ Не вдалося створити індикатор синхронізації:", domError);
                // Продовжуємо без індикатора
            }

            console.log("🔄 Синхронізація даних стейкінгу з сервера");

            // Отримуємо дані стейкінгу через API
            const data = await window.WinixAPI.getStakingData();

            if (data && data.status === 'success' && data.data) {
                // Зберігаємо отримані дані
                updateStorage(STORAGE_KEYS.STAKING_DATA, data.data);

                // Оновлюємо відображення
                if (typeof updateStakingDisplay === 'function') {
                    updateStakingDisplay();
                }

                console.log("✅ Успішна синхронізація даних стейкінгу");
                return data.data;
            }

            console.error("❌ Стейкінг не синхронізовано: некоректна відповідь сервера");
            throw new Error(data?.message || "Некоректна відповідь сервера");
        } catch (error) {
            console.error("❌ Помилка синхронізації стейкінгу:", error);
            throw error;
        } finally {
            // Гарантоване видалення індикатора
            if (syncIndicator && syncIndicator.parentNode) {
                try {
                    syncIndicator.parentNode.removeChild(syncIndicator);
                } catch (e) {
                    console.warn("⚠️ Не вдалося видалити індикатор синхронізації:", e);
                }
            } else {
                try {
                    const indicator = document.querySelector('.winix-sync-indicator');
                    if (indicator && indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                } catch (e) {
                    console.warn("⚠️ Не вдалося знайти та видалити індикатор синхронізації:", e);
                }
            }
        }
    }

    /**
     * Синхронізація історії стейкінгу з сервера
     * @returns {Promise} Проміс з результатом синхронізації
     */
    async function syncStakingHistoryFromServer() {
        try {
            // Використовуємо API модуль для отримання історії стейкінгу
            const data = await window.WinixAPI.getStakingHistory();

            if (data.status === 'success' && Array.isArray(data.data)) {
                // Зберігаємо отриману історію
                updateStorage(STORAGE_KEYS.STAKING_HISTORY, data.data);
                return data.data;
            }

            throw new Error("Неочікувана відповідь сервера");
        } catch (error) {
            console.error("Помилка синхронізації історії стейкінгу:", error);
            throw error;
        }
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} Проміс з результатом операції
     */
    async function createStaking(amount, period) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            // Перевіряємо суму через функцію валідації
            const balance = getUserBalance();
            const validation = validateStakingAmount(amount, balance);

            if (!validation.isValid) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: validation.message
                };
            }

            // Показуємо індикатор завантаження
            showProgressIndicator("Створення стейкінгу...");

            // Використовуємо API модуль для створення стейкінгу
            const result = await window.WinixAPI.createStaking(Math.floor(amount), period);

            // Приховуємо індикатор
            hideProgressIndicator();

            if (result.status === 'success') {
                // Зберігаємо дані стейкінгу
                if (result.data && result.data.staking) {
                    updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                }

                // Оновлюємо баланс
                if (result.data && result.data.balance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.balance);
                }

                return {
                    success: true,
                    message: "Стейкінг успішно створено",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка створення стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка створення стейкінгу:", error);
            hideProgressIndicator();

            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Додавання коштів до стейкінгу
     * @param {number} amount - Сума для додавання
     * @returns {Promise} Проміс з результатом операції
     */
    async function addToStaking(amount) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            // Перевіряємо наявність активного стейкінгу
            const stakingData = await window.WinixAPI.getStakingData();

            if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "У вас немає активного стейкінгу"
                };
            }

            const stakingId = stakingData.data.stakingId;

            // Перевіряємо суму через функцію валідації
            const balance = getUserBalance();
            const validation = validateStakingAmount(amount, balance);

            if (!validation.isValid) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: validation.message
                };
            }

            // Показуємо індикатор завантаження
            showProgressIndicator("Додавання коштів до стейкінгу...");

            // Використовуємо API модуль для додавання коштів до стейкінгу
            const result = await window.WinixAPI.addToStaking(Math.floor(amount), stakingId);

            // Приховуємо індикатор
            hideProgressIndicator();

            if (result.status === 'success') {
                // Оновлюємо дані стейкінгу
                if (result.data && result.data.staking) {
                    updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                }

                // Оновлюємо баланс
                if (result.data && result.data.balance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.balance);
                }

                return {
                    success: true,
                    message: `Додано ${amount} WINIX до стейкінгу`,
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка додавання до стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка додавання до стейкінгу:", error);
            hideProgressIndicator();
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Скасування стейкінгу
     * @returns {Promise} Проміс з результатом операції
     */
    async function cancelStaking() {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            // Перевіряємо наявність активного стейкінгу
            const stakingData = await window.WinixAPI.getStakingData();

            if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "У вас немає активного стейкінгу"
                };
            }

            const stakingId = stakingData.data.stakingId;

            // Показуємо індикатор завантаження
            showProgressIndicator("Скасування стейкінгу...");

            // Використовуємо API модуль для скасування стейкінгу
            const result = await window.WinixAPI.cancelStaking(stakingId);

            // Приховуємо індикатор
            hideProgressIndicator();

            if (result.status === 'success') {
                // Видаляємо дані стейкінгу з УСІХ місць
                removeFromStorage(STORAGE_KEYS.STAKING_DATA);

                // Оновлюємо баланс
                if (result.data && result.data.newBalance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.newBalance);
                }

                return {
                    success: true,
                    message: result.message || "Стейкінг успішно скасовано",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка скасування стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка скасування стейкінгу:", error);
            hideProgressIndicator();
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Оновлення очікуваної винагороди через API
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу
     * @returns {Promise<number>} Очікувана винагорода
     */
    async function getExpectedRewardFromServer(amount, period) {
        try {
            // Базова перевірка даних
            amount = parseInt(amount);
            period = parseInt(period);

            if (isNaN(amount) || isNaN(period) || amount <= 0 || !STAKING_CONFIG.allowedPeriods.includes(period)) {
                return calculateExpectedReward(amount, period);
            }

            // Використовуємо API модуль для розрахунку очікуваної винагороди
            // Перевіряємо наявність нового методу в API
            if (window.WinixAPI && typeof window.WinixAPI.calculateExpectedReward === 'function') {
                const result = await window.WinixAPI.calculateExpectedReward(amount, period);

                if (result.status === 'success' && result.data && typeof result.data.reward === 'number') {
                    return parseFloat(result.data.reward.toFixed(2));
                }
            }

            // Якщо новий метод недоступний, спробуємо використати стандартний API-запит
            const userId = getUserId();
            const result = await fetch(`/api/user/${userId}/staking/calculate-reward?amount=${amount}&period=${period}`);
            const data = await result.json();

            if (data.status === 'success' && data.data && typeof data.data.reward === 'number') {
                return parseFloat(data.data.reward.toFixed(2));
            }

            // Якщо щось пішло не так, використовуємо локальний розрахунок
            return calculateExpectedReward(amount, period);
        } catch (error) {
            console.error("Помилка отримання очікуваної винагороди:", error);
            // Якщо помилка, використовуємо локальний розрахунок
            return calculateExpectedReward(amount, period);
        }
    }

    /**
     * Відновлення проблем зі стейкінгом
     * @param {boolean} force - Примусове відновлення
     * @returns {Promise} Результат відновлення
     */
    async function repairStaking(force = false) {
        if (_isProcessingStakingAction) {
            return {
                success: false,
                message: "Запит вже обробляється"
            };
        }

        _isProcessingStakingAction = true;

        try {
            const userId = getUserId();
            if (!userId) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "ID користувача не знайдено"
                };
            }

            // Показуємо індикатор завантаження
            showProgressIndicator("Відновлення стейкінгу...");

            // Використовуємо API для відновлення
            let result;

            // Перевіряємо наявність нового API
            if (window.WinixAPI && typeof window.WinixAPI.repairStaking === 'function') {
                result = await window.WinixAPI.repairStaking(force);
            } else {
                // Запасний варіант - прямий запит
                const response = await fetch(`/api/user/${userId}/staking/repair`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ force: force })
                });

                result = await response.json();
            }

            // Приховуємо індикатор
            hideProgressIndicator();

            if (result.status === 'success') {
                // Оновлюємо локальні дані
                if (result.data && result.data.staking) {
                    updateStorage(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                }

                // Оновлюємо баланс, якщо є
                if (result.data && result.data.balance !== undefined) {
                    updateStorage(STORAGE_KEYS.USER_TOKENS, result.data.balance);
                }

                return {
                    success: true,
                    message: result.message || "Стейкінг успішно відновлено",
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    message: result.message || "Помилка відновлення стейкінгу"
                };
            }
        } catch (error) {
            console.error("Помилка відновлення стейкінгу:", error);
            hideProgressIndicator();
            return {
                success: false,
                message: error.message || "Помилка з'єднання з сервером"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    // --------------- ОБРОБНИКИ ПОДІЙ ДЛЯ СТОРІНОК ---------------

    /**
     * Обробник кнопки "Застейкати"
     */
    function handleStakeButton() {
        // Запобігаємо повторному відкриттю
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("💰 Обробка створення стейкінгу");

        try {
            // Отримуємо значення з полів
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');

            if (!amountInput || !periodSelect) {
                showAlert("Не вдалося знайти поля для стейкінгу", true);
                return;
            }

            // Отримуємо значення без власної валідації
            const amount = parseInt(amountInput.value, 10);
            const period = parseInt(periodSelect.value, 10);

            // Блокуємо кнопку та показуємо індикатор завантаження
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) stakeButton.disabled = true;

            // Показуємо індикатор завантаження
            showProgressIndicator("Створення стейкінгу...");

            // Створюємо стейкінг через основну функцію
            createStaking(amount, period)
                .then(result => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    // Розблоковуємо кнопку
                    if (stakeButton) stakeButton.disabled = false;

                    if (result.success) {
                        // Показуємо повідомлення про успіх
                        showAlert("Стейкінг успішно створено!", false, function() {
                            window.location.href = "staking-details.html";
                        });
                    } else {
                        showAlert(result.message || "Помилка створення стейкінгу", true);
                    }
                })
                .catch(error => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    console.error("Помилка при створенні стейкінгу:", error);
                    if (stakeButton) stakeButton.disabled = false;
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                });
        } catch (error) {
            // Приховуємо індикатор завантаження
            hideProgressIndicator();

            console.error("Помилка при обробці кнопки створення стейкінгу:", error);
            showAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    /**
     * Обробник кнопки "Додати до стейкінгу"
     */
    function handleAddToStakeButton() {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("💰 Підготовка до додавання коштів до стейкінгу");

        // Стаємо в інтерактивний режим
        _isProcessingStakingAction = true;

        // Показуємо модальне вікно для введення суми
        showInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
            // Блокуємо всі кнопки
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => { if (btn) btn.disabled = true; });

            // Показуємо індикатор завантаження
            showProgressIndicator("Додавання коштів до стейкінгу...");

            // Додаємо кошти до стейкінгу через основну функцію
            addToStaking(amount)
                .then(result => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    // Розблоковуємо кнопки
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });

                    if (result.success) {
                        // Показуємо повідомлення та перезавантажуємо сторінку
                        showAlert(`Додано ${amount} $WINIX до стейкінгу`, false, function() {
                            window.location.reload();
                        });
                    } else {
                        showAlert(result.message || "Помилка додавання до стейкінгу", true);
                        _isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    console.error("Помилка при додаванні до стейкінгу:", error);
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                    _isProcessingStakingAction = false;
                });
        });
    }

    /**
     * Обробник кнопки "Скасувати стейкінг"
     */
    function handleCancelStakingButton() {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("🗑️ Обробка скасування стейкінгу");
        _isProcessingStakingAction = true;

        // Запитуємо підтвердження
        if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.")) {
            // Блокуємо всі кнопки
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => { if (btn) btn.disabled = true; });

            // Показуємо індикатор завантаження
            showProgressIndicator("Скасування стейкінгу...");

            // Скасовуємо стейкінг через основну функцію
            cancelStaking()
                .then(result => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    // Розблоковуємо кнопки
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });

                    if (result.success) {
                        // Показуємо повідомлення про успіх і перенаправляємо
                        showAlert(result.message || "Стейкінг успішно скасовано", false, function() {
                            // Визначаємо поточну сторінку та перенаправляємо відповідно
                            const currentPage = window.location.pathname.split('/').pop();
                            if (currentPage === 'staking-details.html') {
                                window.location.href = "wallet.html";
                            } else {
                                window.location.reload();
                            }
                        });
                    } else {
                        showAlert(result.message || "Помилка скасування стейкінгу", true);
                        _isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    console.error("Помилка при скасуванні стейкінгу:", error);
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                    _isProcessingStakingAction = false;
                });
        } else {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Обробник кнопки "Деталі стейкінгу"
     */
    function handleDetailsButton() {
        console.log("📋 Перехід до деталей стейкінгу");

        try {
            // Отримуємо дані стейкінгу локально
            const stakingData = getStakingData();

            // Якщо є активний стейкінг, переходимо на сторінку деталей
            if (stakingData && stakingData.hasActiveStaking) {
                window.location.href = "staking-details.html";
            } else {
                showAlert("У вас немає активного стейкінгу", true);
            }
        } catch (error) {
            console.error("Помилка при обробці кнопки деталей:", error);
            showAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    /**
     * Обробник кнопки ремонту стейкінгу
     */
    function handleRepairButton() {
        if (_isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        console.log("🔧 Обробка ремонту стейкінгу");
        _isProcessingStakingAction = true;

        // Запитуємо підтвердження
        if (confirm("Ви дійсно хочете спробувати відновити дані стейкінгу? Це може допомогти при проблемах з відображенням стейкінгу.")) {
            // Блокуємо всі кнопки
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => { if (btn) btn.disabled = true; });

            // Показуємо індикатор завантаження
            showProgressIndicator("Відновлення даних стейкінгу...");

            // Викликаємо функцію ремонту
            repairStaking(true)  // true для примусового відновлення
                .then(result => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    // Розблоковуємо кнопки
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });

                    if (result.success) {
                        // Показуємо повідомлення про успіх і перезавантажуємо сторінку
                        showAlert(result.message || "Дані стейкінгу успішно відновлено", false, function() {
                            window.location.reload();
                        });
                    } else {
                        showAlert(result.message || "Помилка відновлення даних стейкінгу", true);
                        _isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    // Приховуємо індикатор завантаження
                    hideProgressIndicator();

                    console.error("Помилка при відновленні даних стейкінгу:", error);
                    buttons.forEach(btn => { if (btn) btn.disabled = false; });
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                    _isProcessingStakingAction = false;
                });
        } else {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Функція для встановлення максимальної суми стейкінгу
     */
    function setMaxStakingAmount() {
        try {
            // Отримуємо поточний баланс
            const balance = getUserBalance();

            // Обчислюємо максимально дозволену суму (90% від балансу)
            const maxAllowed = Math.floor(balance * STAKING_CONFIG.maxBalancePercentage);

            // Встановлюємо значення в поле вводу
            const amountInput = document.getElementById('staking-amount');
            if (amountInput) {
                amountInput.value = maxAllowed > 0 ? maxAllowed.toString() : '0';

                // Запускаємо перерахунок очікуваної винагороди
                updateExpectedReward();

                // Анімуємо поле для привертання уваги
                amountInput.style.transition = 'all 0.3s ease';
                amountInput.style.borderColor = 'rgba(0, 201, 167, 0.8)';
                amountInput.style.boxShadow = '0 0 10px rgba(0, 201, 167, 0.4)';

                setTimeout(() => {
                    amountInput.style.borderColor = '';
                    amountInput.style.boxShadow = '';
                }, 1000);
            }
        } catch (e) {
            console.error('Помилка при встановленні максимальної суми:', e);
        }
    }

    /**
     * Оновлення очікуваної винагороди на сторінці
     */
    function updateExpectedReward() {
        const amountInput = document.getElementById('staking-amount');
        const periodSelect = document.getElementById('staking-period');
        const rewardDisplay = document.getElementById('expected-reward');

        if (!amountInput || !periodSelect || !rewardDisplay) return;

        // Отримуємо значення з полів
        const amount = parseInt(amountInput.value, 10) || 0;
        const period = parseInt(periodSelect.value, 10) || 14;

        if (amount <= 0) {
            rewardDisplay.textContent = '0.00';
            return;
        }

        // Відображаємо "..." поки обчислюється винагорода
        rewardDisplay.textContent = '...';

        // Отримуємо очікувану винагороду з сервера
        getExpectedRewardFromServer(amount, period)
            .then(reward => {
                // Анімуємо зміну значення
                rewardDisplay.style.transition = 'all 0.3s ease';
                rewardDisplay.style.color = '#00C9A7';
                rewardDisplay.textContent = reward.toFixed(2);

                setTimeout(() => {
                    rewardDisplay.style.color = '';
                }, 1000);
            })
            .catch(error => {
                console.error('Помилка отримання очікуваної винагороди:', error);

                // Використовуємо локальний розрахунок
                const localReward = calculateExpectedReward(amount, period);
                rewardDisplay.textContent = localReward.toFixed(2);
            });
    }

    /**
     * Оновлення відображення стейкінгу на сторінці
     */
    function updateStakingDisplay() {
        try {
            // Отримуємо дані стейкінгу
            const stakingData = getStakingData();
            const hasStaking = stakingData && stakingData.hasActiveStaking;

            console.log("🔄 Оновлення відображення стейкінгу:", hasStaking);

            // Якщо ми на сторінці стейкінгу
            if (window.location.href.includes('staking.html')) {
                // Оновлюємо статус стейкінгу
                const statusElement = document.getElementById('staking-status');
                if (statusElement) {
                    statusElement.textContent = hasStaking
                        ? `У стейкінгу: ${stakingData.stakingAmount} $WINIX`
                        : "Наразі немає активних стейкінгів";
                }

                // Оновлюємо видимість кнопок
                const detailsButton = document.getElementById('details-button');
                const cancelButton = document.getElementById('cancel-staking-button');
                const repairButton = document.getElementById('repair-staking-button');

                if (detailsButton) {
                    detailsButton.style.opacity = hasStaking ? '1' : '0.5';
                    detailsButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                }

                if (cancelButton) {
                    cancelButton.style.opacity = hasStaking ? '1' : '0.5';
                    cancelButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                }

                // Показуємо кнопку ремонту тільки для адміністраторів (ID починається з 999)
                if (repairButton) {
                    const userId = getUserId();
                    const isAdmin = userId && userId.startsWith('999');

                    repairButton.style.display = isAdmin ? 'block' : 'none';
                }
            }
            // Якщо ми на сторінці деталей стейкінгу
            else if (window.location.href.includes('staking-details.html')) {
                // Якщо немає активного стейкінгу, перенаправляємо на сторінку стейкінгу
                if (!hasStaking) {
                    showAlert("У вас немає активного стейкінгу", false, function() {
                        window.location.href = "staking.html";
                    });
                    return;
                }

                // Оновлюємо елементи інтерфейсу
                const amountElement = document.getElementById('staking-amount');
                const periodElement = document.getElementById('staking-period');
                const rewardPercentElement = document.getElementById('staking-reward-percent');
                const expectedRewardElement = document.getElementById('staking-expected-reward');
                const remainingDaysElement = document.getElementById('staking-remaining-days');
                const endDateElement = document.getElementById('staking-end-date');

                if (amountElement) amountElement.textContent = `${stakingData.stakingAmount} $WINIX`;
                if (periodElement) periodElement.textContent = `${stakingData.period} днів`;
                if (rewardPercentElement) rewardPercentElement.textContent = `${stakingData.rewardPercent}%`;
                if (expectedRewardElement) expectedRewardElement.textContent = `${stakingData.expectedReward} $WINIX`;
                if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays ? stakingData.remainingDays.toString() : '0';

                // Форматуємо дату закінчення, якщо елемент і дата присутні
                if (endDateElement && stakingData.endDate) {
                    const endDate = new Date(stakingData.endDate);
                    if (!isNaN(endDate.getTime())) {
                        const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
                        endDateElement.textContent = endDate.toLocaleDateString('uk-UA', dateOptions);
                    } else {
                        endDateElement.textContent = '-';
                    }
                }

                // Показуємо кнопку ремонту тільки для адміністраторів (ID починається з 999)
                const repairButton = document.getElementById('repair-staking-button');
                if (repairButton) {
                    const userId = getUserId();
                    const isAdmin = userId && userId.startsWith('999');

                    repairButton.style.display = isAdmin ? 'block' : 'none';
                }
            }
            // Якщо ми на головній сторінці гаманця
            else if (window.location.href.includes('wallet.html')) {
                // Оновлюємо інформацію про стейкінг
                const stakingBalanceElement = document.getElementById('staking-amount');
                const stakingRewardsElement = document.getElementById('rewards-amount');

                if (stakingBalanceElement) {
                    stakingBalanceElement.textContent = hasStaking ? stakingData.stakingAmount.toString() : '0';
                }

                if (stakingRewardsElement) {
                    stakingRewardsElement.textContent = hasStaking ? stakingData.expectedReward.toString() : '0';
                }
            }
        } catch (e) {
            console.error('Помилка оновлення відображення стейкінгу:', e);
        }
    }

    /**
     * Функція для налаштування поля введення суми та розрахунку винагороди
     */
    function setupStakingAmountInput() {
        try {
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');

            if (amountInput) {
                // Дозволяємо тільки цілі числа
                amountInput.addEventListener('input', function() {
                    // Заміна всіх нецифрових символів
                    this.value = this.value.replace(/[^0-9]/g, '');

                    // Оновлення розрахунку винагороди
                    updateExpectedReward();
                });
            }

            if (periodSelect) {
                periodSelect.addEventListener('change', updateExpectedReward);
            }

            // Початковий розрахунок
            updateExpectedReward();
        } catch (e) {
            console.error('Помилка при налаштуванні полів стейкінгу:', e);
        }
    }

    // --------------- ІНІЦІАЛІЗАЦІЯ СИСТЕМИ ---------------

    /**
     * Ініціалізація системи стейкінгу на різних сторінках
     */
    function initStakingSystem() {
        console.log("🔧 Ініціалізація системи стейкінгу");

        // Отримуємо ID користувача з різних джерел
        const userId = getUserId();
        console.log("🆔 ID користувача:", userId);

        // Автоматичне скидання якщо потрібно
        function autoResetIfNeeded() {
            try {
                // Перевіряємо логіку стейкінгу
                const stakingData = getFromStorage(STORAGE_KEYS.STAKING_DATA, null, true);

                // Якщо дані пошкоджені або в неконсистентному стані
                if (stakingData && (
                    typeof stakingData !== 'object' ||
                    (stakingData.hasActiveStaking === true && !stakingData.stakingId) ||
                    (stakingData.stakingAmount && isNaN(parseFloat(stakingData.stakingAmount)))
                )) {
                    console.warn("Виявлено пошкоджені дані стейкінгу, автоматичне скидання");

                    // Видаляємо дані локально
                    localStorage.removeItem('winix_staking');
                    localStorage.removeItem('stakingData');

                    return true; // Дані були скинуті
                }

                return false; // Дані в порядку
            } catch (e) {
                console.error("Помилка при перевірці даних стейкінгу:", e);
                return false;
            }
        }

        // Автоматичне скидання якщо потрібно
        if (autoResetIfNeeded()) {
            console.log("Дані стейкінгу скинуто, сторінка оновлюється");
            setTimeout(() => window.location.reload(), 100);
            return; // Припиняємо ініціалізацію, бо буде перезавантаження
        }

        // Визначаємо поточну сторінку
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Налаштовуємо обробники на основі поточної сторінки
        if (currentPage === 'staking.html') {
            console.log("📋 Ініціалізація сторінки стейкінгу");

            // Налаштовуємо основні кнопки
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) {
                stakeButton.addEventListener('click', handleStakeButton);
            }

            const detailsButton = document.getElementById('details-button');
            if (detailsButton) {
                detailsButton.addEventListener('click', handleDetailsButton);
            }

            const cancelButton = document.getElementById('cancel-staking-button');
            if (cancelButton) {
                cancelButton.addEventListener('click', handleCancelStakingButton);
            }

            const maxButton = document.getElementById('max-button');
            if (maxButton) {
                maxButton.addEventListener('click', setMaxStakingAmount);
            }

            // Додаємо кнопку ремонту для адміністраторів
            const repairButtonElement = document.getElementById('repair-staking-button');
            if (repairButtonElement) {
                repairButtonElement.addEventListener('click', handleRepairButton);

                // Показуємо кнопку тільки для адміністраторів (ID починається з 999)
                const isAdmin = userId && userId.startsWith('999');
                repairButtonElement.style.display = isAdmin ? 'block' : 'none';
            }

            // Налаштовуємо поле введення суми
            setupStakingAmountInput();

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();
        }
        else if (currentPage === 'staking-details.html') {
            console.log("📋 Ініціалізація сторінки деталей стейкінгу");

            // Налаштовуємо основні кнопки
            const addToStakeButton = document.getElementById('add-to-stake-button');
            if (addToStakeButton) {
                addToStakeButton.addEventListener('click', handleAddToStakeButton);
            }

            const cancelButton = document.getElementById('cancel-staking-button');
            if (cancelButton) {
                cancelButton.addEventListener('click', handleCancelStakingButton);
            }

            // Налаштовуємо кнопку ремонту для адміністраторів
            const repairButton = document.getElementById('repair-staking-button');
            if (repairButton) {
                repairButton.addEventListener('click', handleRepairButton);

                // Показуємо кнопку тільки для адміністраторів (ID починається з 999)
                const isAdmin = userId && userId.startsWith('999');
                repairButton.style.display = isAdmin ? 'block' : 'none';
            }

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();
        }
        else if (currentPage === 'wallet.html') {
            console.log("📋 Ініціалізація стейкінгу на сторінці гаманця");

            // Налаштовуємо кнопку стейкінгу
            const stakingButton = document.getElementById('staking-button');
            if (stakingButton) {
                stakingButton.addEventListener('click', function() {
                    window.location.href = 'staking.html';
                });
            }

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();
        }

        // Синхронізація даних з сервером
        if (window.WinixAPI) {
            syncStakingFromServer().catch(error => console.error("Помилка синхронізації стейкінгу:", error));
        } else {
            console.warn("WinixAPI недоступний, синхронізація з сервером неможлива");
        }
    }

    // Запускаємо ініціалізацію після завантаження DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStakingSystem);
    } else {
        initStakingSystem();
    }

    // Запускаємо при подіях Winix
    document.addEventListener('winix-initialized', initStakingSystem);
    document.addEventListener('winix-core-initialized', initStakingSystem);
    document.addEventListener('winix-api-initialized', initStakingSystem);

    // --------------- ПУБЛІЧНЕ API ---------------

    // Створюємо публічний API для системи стейкінгу
    window.WinixStakingSystem = {
        // Основні функції
        getStakingData,
        hasActiveStaking,
        syncStakingFromServer,
        syncStakingHistoryFromServer,
        createStaking,
        addToStaking,
        cancelStaking,
        getExpectedRewardFromServer,
        calculateExpectedReward,
        repairStaking,

        // Обробники подій для кнопок
        handleStakeButton,
        handleAddToStakeButton,
        handleCancelStakingButton,
        handleDetailsButton,
        handleRepairButton,

        // Допоміжні функції
        updateStakingDisplay,
        updateExpectedReward,
        setMaxStakingAmount,
        showAlert,
        showInputModal,
        showProgressIndicator,
        hideProgressIndicator,

        // ID користувача
        getUserId,

        // Конфігурація
        CONFIG: STAKING_CONFIG
    };

    // Створюємо глобальні функції для підтримки старих скриптів
    window.handleStakeButton = handleStakeButton;
    window.handleAddToStakeButton = handleAddToStakeButton;
    window.handleCancelStakingButton = handleCancelStakingButton;
    window.handleDetailsButton = handleDetailsButton;
    window.updateStakingDisplay = updateStakingDisplay;
    window.updateExpectedReward = updateExpectedReward;
    window.setMaxStakingAmount = setMaxStakingAmount;

    console.log("✅ Систему стейкінгу успішно ініціалізовано");

    return window.WinixStakingSystem;
})();