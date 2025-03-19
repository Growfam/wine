/**
 * winix-debug.js
 *
 * Інструменти для виявлення і виправлення помилок в системі WINIX.
 * Цей файл повинен бути підключений останнім після всіх інших скриптів системи.
 */

(function() {
    console.log("🔍 WINIX-DEBUG: Запуск інструментів налагодження...");

    // Об'єкт для функцій налагодження
    window.WinixDebug = {
        // Версія інструментів налагодження
        version: '1.0.0',

        // Увімкнення/вимкнення розширеного логування
        enableVerboseLogging: false,

        /**
         * Перевірка стану системи
         * @returns {Object} Статус системи
         */
        checkSystemStatus: function() {
            const status = {
                core: !!window.WinixCore,
                coreInitialized: !!window.WinixCoreInitialized,
                connector: typeof initPage !== 'undefined',
                fix: typeof window.balanceSystem !== 'undefined',
                initState: !!window.WinixInitState,
                fullyInitialized: window.WinixInitState ? window.WinixInitState.isFullyInitialized : false
            };

            console.log("🔍 WINIX-DEBUG: Статус системи:", status);
            return status;
        },

        /**
         * Перевірка наявності конфліктів в localStorage
         * @returns {Object} Знайдені конфлікти
         */
        checkStorageConflicts: function() {
            const conflicts = {};
            const keyMappings = {
                'winix_balance': 'userTokens',
                'winix_coins': 'userCoins',
                'winix_staking': 'stakingData',
                'winix_transactions': 'transactions'
            };

            for (const [coreKey, fixKey] of Object.entries(keyMappings)) {
                const coreData = localStorage.getItem(coreKey);
                const fixData = localStorage.getItem(fixKey);

                if (coreData && fixData && coreData !== fixData) {
                    conflicts[coreKey] = {
                        coreValue: coreData,
                        fixValue: fixData
                    };
                }
            }

            if (Object.keys(conflicts).length > 0) {
                console.warn("⚠️ WINIX-DEBUG: Знайдено конфлікти в localStorage:", conflicts);
            } else {
                console.log("✅ WINIX-DEBUG: Конфліктів в localStorage не знайдено");
            }

            return conflicts;
        },

        /**
         * Виправлення конфліктів в localStorage
         * @returns {boolean} Успішність операції
         */
        fixStorageConflicts: function() {
            try {
                const conflicts = this.checkStorageConflicts();

                if (Object.keys(conflicts).length === 0) {
                    return true; // Нічого виправляти
                }

                // Виправляємо конфлікти, надаючи перевагу coreKey
                for (const [coreKey, conflict] of Object.entries(conflicts)) {
                    const fixKey = Object.entries(keyMappings).find(([key, value]) => key === coreKey)[1];
                    localStorage.setItem(fixKey, conflict.coreValue);
                }

                console.log("✅ WINIX-DEBUG: Конфлікти в localStorage виправлено");
                return true;
            } catch (e) {
                console.error("❌ WINIX-DEBUG: Помилка виправлення конфліктів:", e);
                return false;
            }
        },

        /**
         * Перевірка наявності дублюючих обробників подій
         * @returns {Object} Знайдені дублікати
         */
        checkDuplicateEventListeners: function() {
            const duplicates = {};
            const importantButtons = [
                'stake-button',
                'cancel-staking-button',
                'add-to-stake-button',
                'details-button',
                'send-button',
                'receive-button',
                'claim-daily',
                'twitter-verify',
                'telegram-verify',
                'youtube-verify'
            ];

            // Перевіряємо кожну кнопку
            importantButtons.forEach(id => {
                const button = document.getElementById(id);
                if (!button) return;

                // Отримуємо кількість обробників (не прямий спосіб)
                // В браузерах немає прямого API для отримання кількості слухачів
                const cloned = button.cloneNode(true);
                const buttonsWithListeners = [button, cloned];

                // Додаємо тестовий обробник
                let clickCount = 0;
                buttonsWithListeners.forEach(btn => {
                    btn.addEventListener('click', function testHandler() {
                        clickCount++;
                        btn.removeEventListener('click', testHandler);
                    });
                });

                // Дублюємо клік
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });

                button.dispatchEvent(clickEvent);
                cloned.dispatchEvent(clickEvent);

                // Якщо клікі спрацювали по-різному, це може вказувати на дублювання обробників
                if (clickCount !== 2) {
                    duplicates[id] = true;
                }
            });

            if (Object.keys(duplicates).length > 0) {
                console.warn("⚠️ WINIX-DEBUG: Можливі дублікати обробників подій:", duplicates);
            } else {
                console.log("✅ WINIX-DEBUG: Дублікатів обробників подій не знайдено");
            }

            return duplicates;
        },

        /**
         * Виправлення дублюючих обробників подій
         * @returns {boolean} Успішність операції
         */
        fixDuplicateEventListeners: function() {
            try {
                const duplicates = Object.keys(this.checkDuplicateEventListeners());

                if (duplicates.length === 0) {
                    return true; // Нічого виправляти
                }

                // Замінюємо кнопки з дублікатами на нові
                duplicates.forEach(id => {
                    const button = document.getElementById(id);
                    if (!button) return;

                    const newButton = button.cloneNode(true);
                    button.parentNode.replaceChild(newButton, button);

                    // Додаємо необхідний обробник в залежності від ID кнопки
                    if (id === 'stake-button' && window.WinixCore && window.WinixCore.Staking) {
                        newButton.addEventListener('click', function() {
                            const amountInput = document.getElementById('staking-amount');
                            if (!amountInput) {
                                window.WinixCore.UI.showNotification("Не вдалося знайти поле суми", window.WinixCore.MESSAGE_TYPES.ERROR);
                                return;
                            }

                            const amount = parseFloat(amountInput.value);
                            if (isNaN(amount) || amount <= 0) {
                                window.WinixCore.UI.showNotification("Введіть коректну суму", window.WinixCore.MESSAGE_TYPES.ERROR);
                                return;
                            }

                            const periodSelect = document.getElementById('staking-period');
                            const period = parseInt(periodSelect ? periodSelect.value : 14);

                            const result = window.WinixCore.Staking.createStaking(amount, period);

                            if (result.success) {
                                window.WinixCore.UI.showNotification("Стейкінг успішно створено!", window.WinixCore.MESSAGE_TYPES.SUCCESS,
                                    () => window.navigateTo('staking-details.html'));
                            }
                        });
                    }
                    // Додати інші кнопки за необхідності
                });

                console.log("✅ WINIX-DEBUG: Дублікати обробників подій виправлено");
                return true;
            } catch (e) {
                console.error("❌ WINIX-DEBUG: Помилка виправлення дублікатів обробників:", e);
                return false;
            }
        },

        /**
         * Форсоване оновлення інтерфейсу
         * @returns {boolean} Успішність операції
         */
        forceUIUpdate: function() {
            try {
                console.log("🔄 WINIX-DEBUG: Форсоване оновлення інтерфейсу...");

                // Оновлюємо баланс
                if (window.WinixCore && window.WinixCore.UI) {
                    window.WinixCore.UI.updateBalanceDisplay();
                    window.WinixCore.UI.updateStakingDisplay();
                    window.WinixCore.UI.updateTransactionsList('transaction-list', 3);
                }

                // Перевіряємо наявність альтернативних систем
                if (window.balanceSystem) {
                    window.balanceSystem.updateDisplay();
                }

                if (window.stakingSystem) {
                    window.stakingSystem.updateStakingDisplay();
                }

                console.log("✅ WINIX-DEBUG: Інтерфейс оновлено");
                return true;
            } catch (e) {
                console.error("❌ WINIX-DEBUG: Помилка оновлення інтерфейсу:", e);
                return false;
            }
        },

        /**
         * Виправлення всіх відомих проблем
         * @returns {boolean} Успішність операції
         */
        fixAllIssues: function() {
            console.log("🔄 WINIX-DEBUG: Запуск повного виправлення системи...");

            const results = {
                storageConflicts: this.fixStorageConflicts(),
                duplicateEventListeners: this.fixDuplicateEventListeners(),
                uiUpdate: this.forceUIUpdate()
            };

            const allFixed = Object.values(results).every(result => result === true);

            if (allFixed) {
                console.log("✅ WINIX-DEBUG: Всі проблеми успішно виправлено");
            } else {
                console.warn("⚠️ WINIX-DEBUG: Деякі проблеми не вдалося виправити:", results);
            }

            return allFixed;
        },

        /**
         * Перезапуск системи
         * @returns {boolean} Успішність операції
         */
        restartSystem: function() {
            try {
                console.log("🔄 WINIX-DEBUG: Перезапуск системи...");

                // Скидаємо стан ініціалізації
                window.WinixCoreInitialized = false;

                if (window.WinixInitState) {
                    window.WinixInitState.coreInitialized = false;
                    window.WinixInitState.connectorInitialized = false;
                    window.WinixInitState.fixInitialized = false;
                }

                // Ініціалізуємо системи заново
                if (window.WinixCore) {
                    window.WinixCore.init();
                    window.WinixCoreInitialized = true;
                    document.dispatchEvent(new CustomEvent('winix-core-initialized'));
                }

                // Оновлюємо інтерфейс
                this.forceUIUpdate();

                console.log("✅ WINIX-DEBUG: Система успішно перезапущена");
                return true;
            } catch (e) {
                console.error("❌ WINIX-DEBUG: Помилка перезапуску системи:", e);
                return false;
            }
        },

        /**
         * Увімкнення режиму розробника (додаткове логування)
         */
        enableDevMode: function() {
            this.enableVerboseLogging = true;
            console.log("🔧 WINIX-DEBUG: Режим розробника увімкнено");

            // Додаємо кнопку керування режимом налагодження, якщо її ще немає
            if (!document.getElementById('debug-toggle')) {
                const debugButton = document.createElement('button');
                debugButton.id = 'debug-toggle';
                debugButton.textContent = 'Debug Mode';
                debugButton.style.position = 'fixed';
                debugButton.style.bottom = '10px';
                debugButton.style.right = '10px';
                debugButton.style.zIndex = '9999';
                debugButton.style.padding = '5px 10px';
                debugButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                debugButton.style.color = 'white';
                debugButton.style.border = 'none';
                debugButton.style.borderRadius = '4px';
                debugButton.style.cursor = 'pointer';

                debugButton.addEventListener('click', () => {
                    if (this.enableVerboseLogging) {
                        this.disableDevMode();
                        debugButton.textContent = 'Debug Off';
                        debugButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    } else {
                        this.enableDevMode();
                        debugButton.textContent = 'Debug On';
                        debugButton.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
                    }
                });

                document.body.appendChild(debugButton);
            }
        },

        /**
         * Вимкнення режиму розробника
         */
        disableDevMode: function() {
            this.enableVerboseLogging = false;
            console.log("🔧 WINIX-DEBUG: Режим розробника вимкнено");
        }
    };

    // Встановлюємо обробник для автоматичного виправлення проблем після повної ініціалізації
    document.addEventListener('winix-initialized', function() {
        console.log("🔄 WINIX-DEBUG: Система ініціалізована, перевіряємо на наявність проблем...");
        setTimeout(function() {
            window.WinixDebug.checkSystemStatus();
            window.WinixDebug.checkStorageConflicts();
            window.WinixDebug.forceUIUpdate();
        }, 500);
    });

    // Виконуємо перевірку статусу системи після завантаження сторінки
    window.addEventListener('load', function() {
        setTimeout(function() {
            window.WinixDebug.checkSystemStatus();
        }, 1000);
    });

    console.log("✅ WINIX-DEBUG: Інструменти налагодження готові");
})();