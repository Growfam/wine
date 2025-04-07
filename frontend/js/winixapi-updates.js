/**
 * winixapi-updates.js
 *
 * Цей файл містить оновлення та розширення для модуля WinixAPI.
 * Повинен підключатись ПІСЛЯ api.js, але ПЕРЕД іншими скриптами проекту.
 */

(function() {
    'use strict';

    // Перевіряємо наявність модуля WinixAPI
    if (!window.WinixAPI) {
        console.error("❌ Модуль WinixAPI не знайдено! Підключіть спочатку api.js");
        return;
    }

    console.log("🔄 Оновлення модуля WinixAPI...");

    // Зберігаємо оригінальні функції для сумісності
    const originalHandleApiError = window.WinixAPI.handleApiError;

    // Оновлюємо функцію handleApiError
    window.WinixAPI.handleApiError = function(error, operation = 'API операції', showToast = true) {
        // Запобігаємо дублюванню помилок - логуємо тільки один раз
        if (!error._logged) {
            console.error(`❌ Помилка ${operation}:`, error);
            error._logged = true;
        }

        // Щоб уникнути повторних сповіщень про ту саму помилку
        const now = Date.now();
        const lastErrorTime = window._lastErrorNotificationTime || 0;
        const lastErrorMessage = window._lastErrorMessage || '';
        const errorMessage = error.message || 'Невідома помилка';

        // Не показуємо те саме повідомлення частіше, ніж раз на 3 секунди
        const shouldShowToast = showToast &&
                               (now - lastErrorTime > 3000 || lastErrorMessage !== errorMessage);

        // Формуємо зрозуміле повідомлення залежно від типу помилки
        let userFriendlyMessage = '';

        if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
            userFriendlyMessage = `Не вдалося з'єднатися з сервером. Перевірте інтернет-з'єднання та спробуйте знову.`;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            userFriendlyMessage = `Час очікування відповіді від сервера вичерпано. Спробуйте знову пізніше.`;
        } else if (errorMessage.includes('404')) {
            userFriendlyMessage = `Сервер не може знайти потрібний ресурс. Спробуйте перезавантажити сторінку.`;
        } else if (errorMessage.includes('405')) {
            userFriendlyMessage = `Помилка API: метод не дозволений. Повідомте про помилку розробникам.`;
        } else if (errorMessage.includes('500')) {
            userFriendlyMessage = `Виникла помилка на сервері. Будь ласка, спробуйте пізніше.`;
        } else if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
            userFriendlyMessage = `Не вдалося отримати дані. Спробуйте перезавантажити сторінку.`;
        } else if (errorMessage.includes('ID користувача не знайдено')) {
            userFriendlyMessage = `Не вдалося визначити ваш ідентифікатор. Спробуйте вийти та увійти знову.`;
        } else {
            // Якщо немає спеціального обробника, використовуємо оригінальне повідомлення
            userFriendlyMessage = errorMessage;
        }

        // Показуємо повідомлення про помилку у випадку необхідності
        if (shouldShowToast) {
            // Зберігаємо час і текст останньої помилки
            window._lastErrorNotificationTime = now;
            window._lastErrorMessage = errorMessage;

            // Показуємо повідомлення з використанням доступних функцій
            if (typeof window.showModernNotification === 'function') {
                window.showModernNotification(userFriendlyMessage, true);
            } else if (typeof window.showToast === 'function') {
                window.showToast(userFriendlyMessage, 'error');
            } else if (typeof window.simpleAlert === 'function') {
                window.simpleAlert(userFriendlyMessage, true);
            } else if (typeof window.showMessage === 'function') {
                window.showMessage(userFriendlyMessage, true);
            } else {
                // Використовуємо оригінальну функцію як резервний варіант
                if (originalHandleApiError) {
                    return originalHandleApiError(error, operation);
                } else {
                    // Уникаємо надмірних спливаючих вікон - використовуємо alert тільки для критичних помилок
                    if (operation.includes('critical') || error.critical) {
                        alert(userFriendlyMessage);
                    }
                }
            }
        }

        // Відправляємо подію для можливого логування на сервері або інших обробників
        document.dispatchEvent(new CustomEvent('api-error', {
            detail: {
                errorType: error.name,
                message: errorMessage,
                operation: operation,
                timestamp: now
            }
        }));

        return userFriendlyMessage;
    };

    // Додаємо функцію для уніфікованого збереження даних користувача
    window.WinixAPI.saveUserDataLocally = function(userData, options = {}) {
        try {
            if (!userData) {
                console.warn("❌ saveUserDataLocally: Отримано порожні дані");
                return false;
            }

            const storedData = {};
            const timestamp = Date.now();
            const debugMode = window.WinixAPI._debugMode || false;

            // Журналювання, якщо увімкнено режим відлагодження
            if (debugMode) {
                console.log("💾 Збереження даних користувача в localStorage:", userData);
            }

            // Функція для безпечного збереження в localStorage
            const safeSetItem = (key, value) => {
                try {
                    if (value !== undefined && value !== null) {
                        // Перетворення нечислових значень у рядки
                        const stringValue = typeof value === 'object'
                                          ? JSON.stringify(value)
                                          : String(value);

                        localStorage.setItem(key, stringValue);
                        storedData[key] = value;
                        return true;
                    }
                    return false;
                } catch (e) {
                    console.warn(`❌ Помилка збереження "${key}" в localStorage:`, e);
                    return false;
                }
            };

            // Збереження загальних даних користувача
            if (userData.telegram_id) {
                safeSetItem('telegram_user_id', userData.telegram_id);
                safeSetItem('userId', userData.telegram_id);
            }

            if (userData.username) {
                safeSetItem('username', userData.username);
            }

            // Збереження балансів
            if (userData.balance !== undefined) {
                safeSetItem('userTokens', userData.balance);
                safeSetItem('winix_balance', userData.balance);
            }

            if (userData.coins !== undefined) {
                safeSetItem('userCoins', userData.coins);
                safeSetItem('winix_coins', userData.coins);
            }

            // Збереження даних стейкінгу
            if (userData.staking) {
                safeSetItem('stakingData', userData.staking);
                safeSetItem('winix_staking', userData.staking);
                safeSetItem('stakingDataCacheTime', timestamp);
            }

            // Збереження історії транзакцій
            if (userData.transactions) {
                safeSetItem('transactionsData', userData.transactions);
                safeSetItem('transactionsDataCacheTime', timestamp);
            }

            // Збереження налаштувань
            if (userData.settings) {
                safeSetItem('userSettings', userData.settings);
            }

            // Збереження додаткових даних, якщо вони є
            if (userData.additionalData) {
                Object.keys(userData.additionalData).forEach(key => {
                    safeSetItem(key, userData.additionalData[key]);
                });
            }

            // Збереження часової мітки оновлення
            safeSetItem('userDataTimestamp', timestamp);

            // Генеруємо подію про оновлення даних
            document.dispatchEvent(new CustomEvent('user-data-updated', {
                detail: {
                    updatedFields: Object.keys(storedData),
                    timestamp: timestamp
                }
            }));

            return true;
        } catch (error) {
            console.error("❌ Критична помилка збереження даних користувача:", error);
            return false;
        }
    };

    // Додаємо функцію отримання збережених даних
    window.WinixAPI.getUserDataFromStorage = function() {
        try {
            const userData = {
                telegram_id: localStorage.getItem('telegram_user_id') || localStorage.getItem('userId'),
                username: localStorage.getItem('username'),
                balance: parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0'),
                timestamp: parseInt(localStorage.getItem('userDataTimestamp') || '0')
            };

            // Спроба отримати дані стейкінгу
            try {
                const stakingData = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                if (stakingData) {
                    userData.staking = JSON.parse(stakingData);
                }
            } catch (e) {
                console.warn("❌ Помилка при отриманні даних стейкінгу з localStorage:", e);
            }

            // Спроба отримати історію транзакцій
            try {
                const transactionsData = localStorage.getItem('transactionsData');
                if (transactionsData) {
                    userData.transactions = JSON.parse(transactionsData);
                }
            } catch (e) {
                console.warn("❌ Помилка при отриманні історії транзакцій з localStorage:", e);
            }

            return userData;
        } catch (error) {
            console.error("❌ Помилка при отриманні даних користувача з localStorage:", error);
            return {
                telegram_id: null,
                balance: 0,
                coins: 0,
                error: error.message
            };
        }
    };

    // Оновлюємо реалізацію cancelStaking
    window.WinixAPI.cancelStaking = async function(stakingId = null) {
        try {
            // Показуємо індикатор завантаження
            if (typeof showLoading === 'function') {
                showLoading();
            }

            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error("Не вдалося отримати ID користувача");
            }

            // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
            let targetStakingId = stakingId;
            if (!targetStakingId) {
                try {
                    const stakingData = await window.WinixAPI.getStakingData();
                    if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                        throw new Error("У вас немає активного стейкінгу");
                    }
                    targetStakingId = stakingData.data.stakingId;
                } catch (error) {
                    throw new Error("Не вдалося отримати ID стейкінгу: " + error.message);
                }
            }

            // Виконуємо запит для скасування стейкінгу
            const response = await window.WinixAPI.apiRequest(
                `/api/user/${userId}/staking/${targetStakingId}/cancel`,
                'POST',
                {
                    confirm: true,
                    timestamp: Date.now()
                },
                {
                    operationName: 'скасування стейкінгу',
                    showToast: false // Обробимо помилку вручну
                }
            );

            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
            }

            // Обробляємо результат
            if (response.status === 'success') {
                // Оновлюємо дані
                if (response.data) {
                    // Зберігаємо оновлені дані користувача
                    window.WinixAPI.saveUserDataLocally({
                        balance: response.data.newBalance,
                        staking: {
                            hasActiveStaking: false,
                            stakingAmount: 0,
                            period: 0,
                            rewardPercent: 0,
                            expectedReward: 0,
                            remainingDays: 0
                        }
                    });

                    // Оновлюємо інтерфейс, якщо є така функція
                    if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateUI === 'function') {
                        window.WinixStakingSystem.updateUI(true);
                    }
                }

                // Показуємо повідомлення про успіх
                let message = "Стейкінг успішно скасовано";
                if (response.data && response.data.returnedAmount !== undefined &&
                    response.data.feeAmount !== undefined) {
                    message = `Стейкінг скасовано. Повернено: ${response.data.returnedAmount} WINIX. Комісія: ${response.data.feeAmount} WINIX.`;
                }

                if (typeof window.showModernNotification === 'function') {
                    window.showModernNotification(message, false, () => {
                        // Перезавантажуємо сторінку, якщо є функція плавного перезавантаження
                        if (window.WinixStakingSystem && typeof window.WinixStakingSystem.smoothReload === 'function') {
                            window.WinixStakingSystem.smoothReload();
                        } else {
                            window.location.reload();
                        }
                    });
                } else if (typeof window.showMessage === 'function') {
                    window.showMessage(message, false, () => {
                        if (window.WinixStakingSystem && typeof window.WinixStakingSystem.smoothReload === 'function') {
                            window.WinixStakingSystem.smoothReload();
                        } else {
                            window.location.reload();
                        }
                    });
                } else {
                    alert(message);
                    window.location.reload();
                }

                return {
                    success: true,
                    data: response.data,
                    message: message
                };
            } else {
                throw new Error(response.message || "Помилка скасування стейкінгу");
            }
        } catch (error) {
            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
            }

            // Обробляємо помилку
            window.WinixAPI.handleApiError(error, 'скасування стейкінгу', true);

            return {
                success: false,
                message: error.message || "Сталася помилка під час скасування стейкінгу"
            };
        }
    };

    // Патч для методу apiRequest, щоб зробити його більш стійким
    if (window.WinixAPI.apiRequest) {
        const originalApiRequest = window.WinixAPI.apiRequest;
        window.WinixAPI.apiRequest = async function(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
            try {
                // Патч для обробки випадку, коли data === undefined
                if (data === undefined) {
                    data = null;
                }

                // Додати обробку options, якщо вони невалідні
                if (options === null || typeof options !== 'object') {
                    options = {};
                }

                // Додаємо timestamp до GET-запитів щоб уникнути кешування
                if (method.toUpperCase() === 'GET' && endpoint.indexOf('?') === -1) {
                    endpoint += `?_t=${Date.now()}`;
                } else if (method.toUpperCase() === 'GET') {
                    endpoint += `&_t=${Date.now()}`;
                }

                return await originalApiRequest(endpoint, method, data, options, retries);
            } catch (e) {
                // Централізована обробка помилок
                const operationName = options.operationName || `API запит ${method} ${endpoint}`;
                const showToast = options.showToast !== false; // За замовчуванням показуємо toast

                window.WinixAPI.handleApiError(e, operationName, showToast);

                // Перевіряємо, чи треба продовжувати помилку далі
                if (options.throwError !== false) {
                    throw e; // Передаємо помилку далі для обробки у викликаючому коді
                }

                // Повертаємо стандартний об'єкт помилки
                return {
                    status: 'error',
                    message: e.message || 'Сталася помилка при виконанні запиту',
                    error: e
                };
            }
        };
    }

    // Генеруємо подію про оновлення WinixAPI
    document.dispatchEvent(new CustomEvent('winixapi-updated', {
        detail: {
            timestamp: Date.now(),
            version: '1.1.0'
        }
    }));

    console.log("✅ Модуль WinixAPI успішно оновлено!");
})();