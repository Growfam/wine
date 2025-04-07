/**
 * staking.js
 *
 * Модуль для управління функціональністю стейкінгу
 * Включає функції для створення стейкінгу, додавання коштів, скасування та розрахунку нагород
 */

// Замикання для уникнення конфліктів з глобальними змінними
(function() {
    'use strict';

    // Конфігурація системи стейкінгу
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

    // Прапорець для запобігання одночасним запитам
    let isProcessingRequest = false;

    // ================= API ЗАПИТИ =================

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} - Результат операції
     */
    function createStaking(amount, period) {
        if (isProcessingRequest) {
            return Promise.resolve({
                success: false,
                message: "Запит вже обробляється"
            });
        }

        isProcessingRequest = true;
        showLoading("Створення стейкінгу...");

        return new Promise((resolve, reject) => {
            // Перевіряємо валідність суми та періоду
            const validationResult = validateStakingParams(amount, period);
            if (!validationResult.isValid) {
                hideLoading();
                isProcessingRequest = false;
                resolve({
                    success: false,
                    message: validationResult.message
                });
                return;
            }

            // Використовуємо API для створення стейкінгу
            if (window.WinixAPI && typeof window.WinixAPI.createStaking === 'function') {
                window.WinixAPI.createStaking(Math.floor(amount), period)
                    .then(result => {
                        hideLoading();
                        isProcessingRequest = false;

                        if (result.status === 'success') {
                            // Зберігаємо дані стейкінгу в localStorage
                            if (result.data && result.data.staking) {
                                localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                                localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                            }

                            // Оновлюємо баланс
                            if (result.data && result.data.balance !== undefined) {
                                localStorage.setItem('userTokens', result.data.balance.toString());
                                localStorage.setItem('winix_balance', result.data.balance.toString());
                            }

                            // Відправляємо подію оновлення стейкінгу
                            document.dispatchEvent(new CustomEvent('staking-updated'));

                            resolve({
                                success: true,
                                message: "Стейкінг успішно створено",
                                data: result.data
                            });
                        } else {
                            resolve({
                                success: false,
                                message: result.message || "Помилка створення стейкінгу"
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Помилка API запиту створення стейкінгу:", error);
                        hideLoading();
                        isProcessingRequest = false;
                        resolve({
                            success: false,
                            message: error.message || "Помилка з'єднання з сервером"
                        });
                    });
            } else {
                // Якщо API не доступне, використовуємо звичайний fetch
                const userId = getUserId();

                fetch(`/api/user/${userId}/staking`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        stakingAmount: Math.floor(amount),
                        period: period
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Помилка сервера: ${response.status}`);
                    }
                    return response.json();
                })
                .then(result => {
                    hideLoading();
                    isProcessingRequest = false;

                    if (result.status === 'success') {
                        // Зберігаємо дані стейкінгу в localStorage
                        if (result.data && result.data.staking) {
                            localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                            localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                        }

                        // Оновлюємо баланс
                        if (result.data && result.data.balance !== undefined) {
                            localStorage.setItem('userTokens', result.data.balance.toString());
                            localStorage.setItem('winix_balance', result.data.balance.toString());
                        }

                        // Відправляємо подію оновлення стейкінгу
                        document.dispatchEvent(new CustomEvent('staking-updated'));

                        resolve({
                            success: true,
                            message: "Стейкінг успішно створено",
                            data: result.data
                        });
                    } else {
                        resolve({
                            success: false,
                            message: result.message || "Помилка створення стейкінгу"
                        });
                    }
                })
                .catch(error => {
                    console.error("Помилка fetch запиту створення стейкінгу:", error);
                    hideLoading();
                    isProcessingRequest = false;
                    resolve({
                        success: false,
                        message: error.message || "Помилка з'єднання з сервером"
                    });
                });
            }
        });
    }

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {number} amount - Сума для додавання
     * @returns {Promise<Object>} - Результат операції
     */
    function addToStaking(amount) {
        if (isProcessingRequest) {
            return Promise.resolve({
                success: false,
                message: "Запит вже обробляється"
            });
        }

        isProcessingRequest = true;
        showLoading("Додавання коштів до стейкінгу...");

        return new Promise((resolve, reject) => {
            // Перевіряємо, чи є активний стейкінг
            const stakingData = getStakingData();
            if (!stakingData || !stakingData.hasActiveStaking) {
                hideLoading();
                isProcessingRequest = false;
                resolve({
                    success: false,
                    message: "У вас немає активного стейкінгу"
                });
                return;
            }

            const stakingId = stakingData.stakingId;

            // Перевіряємо валідність суми
            const validationResult = validateAmount(amount);
            if (!validationResult.isValid) {
                hideLoading();
                isProcessingRequest = false;
                resolve({
                    success: false,
                    message: validationResult.message
                });
                return;
            }

            // Використовуємо API для додавання коштів
            if (window.WinixAPI && typeof window.WinixAPI.addToStaking === 'function') {
                window.WinixAPI.addToStaking(Math.floor(amount), stakingId)
                    .then(result => {
                        hideLoading();
                        isProcessingRequest = false;

                        if (result.status === 'success') {
                            // Оновлюємо дані стейкінгу
                            if (result.data && result.data.staking) {
                                localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                                localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                            }

                            // Оновлюємо баланс
                            if (result.data && result.data.balance !== undefined) {
                                localStorage.setItem('userTokens', result.data.balance.toString());
                                localStorage.setItem('winix_balance', result.data.balance.toString());
                            }

                            // Відправляємо подію оновлення стейкінгу
                            document.dispatchEvent(new CustomEvent('staking-updated'));

                            resolve({
                                success: true,
                                message: `Додано ${amount} WINIX до стейкінгу`,
                                data: result.data
                            });
                        } else {
                            resolve({
                                success: false,
                                message: result.message || "Помилка додавання до стейкінгу"
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Помилка API запиту додавання до стейкінгу:", error);
                        hideLoading();
                        isProcessingRequest = false;
                        resolve({
                            success: false,
                            message: error.message || "Помилка з'єднання з сервером"
                        });
                    });
            } else {
                // Якщо API не доступне, використовуємо звичайний fetch
                const userId = getUserId();

                fetch(`/api/user/${userId}/staking/${stakingId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        additionalAmount: Math.floor(amount)
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Помилка сервера: ${response.status}`);
                    }
                    return response.json();
                })
                .then(result => {
                    hideLoading();
                    isProcessingRequest = false;

                    if (result.status === 'success') {
                        // Оновлюємо дані стейкінгу
                        if (result.data && result.data.staking) {
                            localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                            localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                        }

                        // Оновлюємо баланс
                        if (result.data && result.data.balance !== undefined) {
                            localStorage.setItem('userTokens', result.data.balance.toString());
                            localStorage.setItem('winix_balance', result.data.balance.toString());
                        }

                        // Відправляємо подію оновлення стейкінгу
                        document.dispatchEvent(new CustomEvent('staking-updated'));

                        resolve({
                            success: true,
                            message: `Додано ${amount} WINIX до стейкінгу`,
                            data: result.data
                        });
                    } else {
                        resolve({
                            success: false,
                            message: result.message || "Помилка додавання до стейкінгу"
                        });
                    }
                })
                .catch(error => {
                    console.error("Помилка fetch запиту додавання до стейкінгу:", error);
                    hideLoading();
                    isProcessingRequest = false;
                    resolve({
                        success: false,
                        message: error.message || "Помилка з'єднання з сервером"
                    });
                });
            }
        });
    }

    /**
     * Скасування стейкінгу
     * @returns {Promise<Object>} - Результат операції
     */
    function cancelStaking() {
        if (isProcessingRequest) {
            return Promise.resolve({
                success: false,
                message: "Запит вже обробляється"
            });
        }

        isProcessingRequest = true;
        showLoading("Скасування стейкінгу...");

        return new Promise((resolve, reject) => {
            // Перевіряємо, чи є активний стейкінг
            const stakingData = getStakingData();
            if (!stakingData || !stakingData.hasActiveStaking) {
                hideLoading();
                isProcessingRequest = false;
                resolve({
                    success: false,
                    message: "У вас немає активного стейкінгу"
                });
                return;
            }

            const stakingId = stakingData.stakingId;

            // Використовуємо API для скасування стейкінгу
            if (window.WinixAPI && typeof window.WinixAPI.cancelStaking === 'function') {
                window.WinixAPI.cancelStaking(stakingId)
                    .then(result => {
                        hideLoading();
                        isProcessingRequest = false;

                        if (result.status === 'success') {
                            // Видаляємо дані стейкінгу
                            localStorage.removeItem('stakingData');
                            localStorage.removeItem('winix_staking');

                            // Оновлюємо баланс
                            if (result.data && result.data.newBalance !== undefined) {
                                localStorage.setItem('userTokens', result.data.newBalance.toString());
                                localStorage.setItem('winix_balance', result.data.newBalance.toString());
                            }

                            // Відправляємо подію оновлення стейкінгу
                            document.dispatchEvent(new CustomEvent('staking-updated'));

                            resolve({
                                success: true,
                                message: result.message || "Стейкінг успішно скасовано",
                                data: result.data
                            });
                        } else {
                            resolve({
                                success: false,
                                message: result.message || "Помилка скасування стейкінгу"
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Помилка API запиту скасування стейкінгу:", error);
                        hideLoading();
                        isProcessingRequest = false;
                        resolve({
                            success: false,
                            message: error.message || "Помилка з'єднання з сервером"
                        });
                    });
            } else {
                // Якщо API не доступне, використовуємо звичайний fetch
                const userId = getUserId();

                fetch(`/api/user/${userId}/staking/${stakingId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        timestamp: Date.now()
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Помилка сервера: ${response.status}`);
                    }
                    return response.json();
                })
                .then(result => {
                    hideLoading();
                    isProcessingRequest = false;

                    if (result.status === 'success') {
                        // Видаляємо дані стейкінгу
                        localStorage.removeItem('stakingData');
                        localStorage.removeItem('winix_staking');

                        // Оновлюємо баланс
                        if (result.data && result.data.newBalance !== undefined) {
                            localStorage.setItem('userTokens', result.data.newBalance.toString());
                            localStorage.setItem('winix_balance', result.data.newBalance.toString());
                        }

                        // Відправляємо подію оновлення стейкінгу
                        document.dispatchEvent(new CustomEvent('staking-updated'));

                        resolve({
                            success: true,
                            message: result.message || "Стейкінг успішно скасовано",
                            data: result.data
                        });
                    } else {
                        resolve({
                            success: false,
                            message: result.message || "Помилка скасування стейкінгу"
                        });
                    }
                })
                .catch(error => {
                    console.error("Помилка fetch запиту скасування стейкінгу:", error);
                    hideLoading();
                    isProcessingRequest = false;
                    resolve({
                        success: false,
                        message: error.message || "Помилка з'єднання з сервером"
                    });
                });
            }
        });
    }

    /**
     * Отримання даних стейкінгу
     * @returns {Promise<Object>} - Деталі стейкінгу
     */
    function getStakingDetails() {
        return new Promise((resolve, reject) => {
            // Спочатку перевіряємо локальне сховище
            const localData = getStakingData();

            // Використовуємо WinixAPI для отримання актуальних даних
            if (window.WinixAPI && typeof window.WinixAPI.getStakingData === 'function') {
                window.WinixAPI.getStakingData()
                    .then(result => {
                        if (result.status === 'success' && result.data) {
                            // Оновлюємо локальні дані
                            localStorage.setItem('stakingData', JSON.stringify(result.data));
                            localStorage.setItem('winix_staking', JSON.stringify(result.data));

                            // Відправляємо подію оновлення стейкінгу
                            document.dispatchEvent(new CustomEvent('staking-updated'));

                            resolve(result.data);
                        } else {
                            // Використовуємо локальні дані, якщо не вдалося отримати з сервера
                            resolve(localData);
                        }
                    })
                    .catch(error => {
                        console.error("Помилка отримання даних стейкінгу:", error);
                        // Використовуємо локальні дані при помилці
                        resolve(localData);
                    });
            } else {
                // Якщо API не доступне, використовуємо локальні дані
                resolve(localData);
            }
        });
    }

    // ================= ДОПОМІЖНІ ФУНКЦІЇ =================

    /**
     * Отримання даних стейкінгу з локального сховища
     * @returns {Object} - Дані стейкінгу
     */
    function getStakingData() {
        try {
            // Спробуємо отримати з localStorage
            const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
            if (stakingDataStr) {
                return JSON.parse(stakingDataStr);
            }

            // Якщо немає даних, повертаємо об'єкт за замовчуванням
            return {
                hasActiveStaking: false,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };
        } catch (e) {
            console.error("Помилка при отриманні даних стейкінгу з localStorage:", e);

            // При помилці повертаємо об'єкт за замовчуванням
            return {
                hasActiveStaking: false,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };
        }
    }

    /**
     * Перевірка наявності активного стейкінгу
     * @returns {boolean} - true, якщо є активний стейкінг
     */
    function hasActiveStaking() {
        try {
            // Спробуємо отримати з localStorage
            const stakingData = getStakingData();
            return stakingData && stakingData.hasActiveStaking === true;
        } catch (e) {
            console.error("Помилка при перевірці наявності активного стейкінгу:", e);
            return false;
        }
    }

    /**
     * Розрахунок очікуваної винагороди
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу (7, 14 або 28 днів)
     * @returns {number} - Очікувана винагорода
     */
    function calculateRewards(amount, period) {
        try {
            // Перевірка параметрів
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || isNaN(period)) {
                return 0;
            }

            // Отримуємо відсоток винагороди залежно від періоду
            const rewardPercent = STAKING_CONFIG.rewardRates[period] || 0;

            // Розраховуємо винагороду
            const reward = (amount * rewardPercent) / 100;

            return parseFloat(reward.toFixed(2));
        } catch (e) {
            console.error("Помилка при розрахунку винагороди:", e);
            return 0;
        }
    }

    /**
     * Розрахунок штрафу за дострокове скасування
     * @param {number} amount - Сума стейкінгу
     * @returns {Object} - Дані про штраф
     */
    function calculatePenalty(amount) {
        try {
            // Перевірка параметрів
            amount = parseFloat(amount);

            if (isNaN(amount)) {
                return {
                    penaltyPercent: STAKING_CONFIG.cancellationFee * 100,
                    penaltyAmount: 0,
                    amountAfterPenalty: 0
                };
            }

            // Розраховуємо штраф
            const penaltyAmount = amount * STAKING_CONFIG.cancellationFee;
            const amountAfterPenalty = amount - penaltyAmount;

            return {
                penaltyPercent: STAKING_CONFIG.cancellationFee * 100,
                penaltyAmount: parseFloat(penaltyAmount.toFixed(2)),
                amountAfterPenalty: parseFloat(amountAfterPenalty.toFixed(2))
            };
        } catch (e) {
            console.error("Помилка при розрахунку штрафу:", e);
            return {
                penaltyPercent: STAKING_CONFIG.cancellationFee * 100,
                penaltyAmount: 0,
                amountAfterPenalty: 0
            };
        }
    }

    /**
     * Підтвердження скасування стейкінгу з відображенням штрафу
     * @param {Function} onConfirm - Функція, яка викликається при підтвердженні
     * @returns {boolean} - true, якщо користувач підтвердив
     */
    function confirmCancel(onConfirm) {
        try {
            // Отримуємо дані стейкінгу
            const stakingData = getStakingData();

            if (!stakingData || !stakingData.hasActiveStaking) {
                alert("У вас немає активного стейкінгу");
                return false;
            }

            // Розраховуємо штраф
            const penalty = calculatePenalty(stakingData.stakingAmount);

            // Формуємо повідомлення
            const message = `Ви впевнені, що хочете скасувати стейкінг?\n\n` +
                            `Сума стейкінгу: ${stakingData.stakingAmount} WINIX\n` +
                            `Штраф (${penalty.penaltyPercent}%): ${penalty.penaltyAmount} WINIX\n` +
                            `Ви отримаєте: ${penalty.amountAfterPenalty} WINIX`;

            // Запитуємо підтвердження
            if (confirm(message)) {
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
                return true;
            }

            return false;
        } catch (e) {
            console.error("Помилка при підтвердженні скасування:", e);
            return false;
        }
    }

    /**
     * Перевірка валідності параметрів стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу
     * @returns {Object} - Результат перевірки
     */
    function validateStakingParams(amount, period) {
        try {
            // Перевірка суми
            const amountValidation = validateAmount(amount);
            if (!amountValidation.isValid) {
                return amountValidation;
            }

            // Перевірка періоду
            period = parseInt(period);

            if (isNaN(period)) {
                return {
                    isValid: false,
                    message: "Період стейкінгу має бути числом"
                };
            }

            if (!STAKING_CONFIG.allowedPeriods.includes(period)) {
                return {
                    isValid: false,
                    message: `Період стейкінгу має бути одним із: ${STAKING_CONFIG.allowedPeriods.join(', ')} днів`
                };
            }

            return {
                isValid: true,
                message: ""
            };
        } catch (e) {
            console.error("Помилка при валідації параметрів стейкінгу:", e);
            return {
                isValid: false,
                message: "Помилка при валідації параметрів стейкінгу"
            };
        }
    }

    /**
     * Перевірка валідності суми
     * @param {number} amount - Сума для перевірки
     * @returns {Object} - Результат перевірки
     */
    function validateAmount(amount) {
        try {
            // Перевірка на число
            amount = parseFloat(amount);

            if (isNaN(amount)) {
                return {
                    isValid: false,
                    message: "Сума має бути числом"
                };
            }

            // Перевірка на мінімальну суму
            if (amount < STAKING_CONFIG.minAmount) {
                return {
                    isValid: false,
                    message: `Мінімальна сума стейкінгу: ${STAKING_CONFIG.minAmount} WINIX`
                };
            }

            // Перевірка на ціле число
            if (amount !== Math.floor(amount)) {
                return {
                    isValid: false,
                    message: "Сума стейкінгу має бути цілим числом"
                };
            }

            // Перевірка на достатність балансу
            const balance = getUserBalance();
            if (amount > balance) {
                return {
                    isValid: false,
                    message: `Недостатньо коштів. Ваш баланс: ${balance} WINIX`
                };
            }

            // Перевірка на максимально дозволену суму
            const maxAllowedAmount = Math.floor(balance * STAKING_CONFIG.maxBalancePercentage);
            if (amount > maxAllowedAmount) {
                return {
                    isValid: false,
                    message: `Максимальна сума: ${maxAllowedAmount} WINIX (${STAKING_CONFIG.maxBalancePercentage*100}% від балансу)`
                };
            }

            return {
                isValid: true,
                message: ""
            };
        } catch (e) {
            console.error("Помилка при валідації суми:", e);
            return {
                isValid: false,
                message: "Помилка при валідації суми"
            };
        }
    }

    /**
     * Отримання ID користувача
     * @returns {string} - ID користувача
     */
    function getUserId() {
        // Використовуємо WinixAPI, якщо доступний
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            return window.WinixAPI.getUserId();
        }

        // Спробуємо отримати з localStorage
        const storedId = localStorage.getItem('telegram_user_id') || localStorage.getItem('userId');
        if (storedId) {
            return storedId;
        }

        // Як крайній варіант, генеруємо випадковий ID
        return '2449' + Math.floor(10000 + Math.random() * 90000);
    }

    /**
     * Отримання балансу користувача
     * @returns {number} - Баланс користувача
     */
    function getUserBalance() {
        try {
            // Отримуємо з localStorage
            const balanceStr = localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0';
            const balance = parseFloat(balanceStr);

            return isNaN(balance) ? 0 : balance;
        } catch (e) {
            console.error("Помилка при отриманні балансу:", e);
            return 0;
        }
    }

    /**
     * Показати індикатор завантаження
     * @param {string} message - Повідомлення
     */
    function showLoading(message = "Завантаження...") {
        try {
            // Спробуємо використати існуючий індикатор
            if (window.showLoading) {
                window.showLoading(message);
                return;
            }

            // Створюємо власний індикатор
            let loadingElement = document.getElementById('staking-loading-indicator');

            if (!loadingElement) {
                loadingElement = document.createElement('div');
                loadingElement.id = 'staking-loading-indicator';
                loadingElement.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    flex-direction: column;
                    z-index: 9999;
                `;

                const spinner = document.createElement('div');
                spinner.style.cssText = `
                    width: 50px;
                    height: 50px;
                    border: 5px solid rgba(0, 201, 167, 0.3);
                    border-radius: 50%;
                    border-top-color: #4eb5f7;
                    animation: spin 1s ease-in-out infinite;
                    margin-bottom: 10px;
                `;

                const messageElement = document.createElement('div');
                messageElement.style.cssText = `
                    color: white;
                    font-size: 16px;
                `;
                messageElement.textContent = message;

                // Додаємо стилі для анімації
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;

                document.head.appendChild(style);
                loadingElement.appendChild(spinner);
                loadingElement.appendChild(messageElement);
                document.body.appendChild(loadingElement);
            } else {
                // Оновлюємо текст повідомлення
                const messageElement = loadingElement.querySelector('div:nth-child(2)');
                if (messageElement) {
                    messageElement.textContent = message;
                }

                // Показуємо індикатор
                loadingElement.style.display = 'flex';
            }
        } catch (e) {
            console.error("Помилка при показі індикатора завантаження:", e);
        }
    }

    /**
     * Приховати індикатор завантаження
     */
    function hideLoading() {
        try {
            // Спробуємо використати існуючу функцію
            if (window.hideLoading) {
                window.hideLoading();
                return;
            }

            // Приховуємо власний індикатор
            const loadingElement = document.getElementById('staking-loading-indicator');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        } catch (e) {
            console.error("Помилка при приховуванні індикатора завантаження:", e);
        }
    }

    /**
     * Оновлення інформації про стейкінг на сторінці
     */
    function renderStakingDetails() {
        try {
            // Отримуємо дані стейкінгу
            const stakingData = getStakingData();

            // Оновлюємо статус стейкінгу
            const statusElement = document.getElementById('staking-status');
            if (statusElement) {
                if (stakingData && stakingData.hasActiveStaking) {
                    statusElement.textContent = `У стейкінгу: ${stakingData.stakingAmount} $WINIX`;
                } else {
                    statusElement.textContent = "Наразі немає активних стейкінгів";
                }
            }

            // Якщо відкрите модальне вікно, оновлюємо його вміст
            const modal = document.getElementById('staking-modal');
            if (modal && modal.classList.contains('active')) {
                // Оновлюємо дані в модальному вікні
                document.getElementById('modal-staking-amount').textContent = `${stakingData.stakingAmount || 0} $WINIX`;
                document.getElementById('modal-staking-period').textContent = `${stakingData.period || 0} днів`;
                document.getElementById('modal-staking-reward-percent').textContent = `${stakingData.rewardPercent || 0}%`;
                document.getElementById('modal-staking-expected-reward').textContent = `${stakingData.expectedReward || 0} $WINIX`;
                document.getElementById('modal-staking-remaining-days').textContent = stakingData.remainingDays || 0;
            }

            // Оновлюємо доступність кнопок
            updateButtonsState(stakingData && stakingData.hasActiveStaking);
        } catch (e) {
            console.error("Помилка при оновленні відображення стейкінгу:", e);
        }
    }

    /**
     * Оновлення стану кнопок залежно від наявності активного стейкінгу
     * @param {boolean} hasStaking - Чи є активний стейкінг
     */
    function updateButtonsState(hasStaking) {
        try {
            // Кнопка "Активний стейкінг"
            const activeStakingButton = document.getElementById('active-staking-button');
            if (activeStakingButton) {
                if (hasStaking) {
                    activeStakingButton.classList.remove('disabled');
                    activeStakingButton.disabled = false;
                } else {
                    activeStakingButton.classList.add('disabled');
                    activeStakingButton.disabled = true;
                }
            }

            // Кнопка "Скасувати стейкінг"
            const cancelStakingButton = document.getElementById('cancel-staking-button');
            if (cancelStakingButton) {
                if (hasStaking) {
                    cancelStakingButton.style.opacity = '1';
                    cancelStakingButton.style.pointerEvents = 'auto';
                    cancelStakingButton.disabled = false;
                } else {
                    cancelStakingButton.style.opacity = '0.5';
                    cancelStakingButton.style.pointerEvents = 'none';
                    cancelStakingButton.disabled = true;
                }
            }
        } catch (e) {
            console.error("Помилка при оновленні стану кнопок:", e);
        }
    }

    // ================= ПУБЛІЧНЕ API =================

    // Експортуємо публічні функції
    window.WinixStakingSystem = {
        // API запити
        createStaking,
        addToStaking,
        cancelStaking,
        getStakingDetails,

        // Допоміжні функції
        getStakingData,
        hasActiveStaking,
        calculateRewards,
        calculatePenalty,
        confirmCancel,

        // Функції для UI
        renderStakingDetails,
        updateButtonsState,

        // Конфігурація
        config: STAKING_CONFIG
    };

    // Слухаємо події для оновлення UI
    document.addEventListener('staking-updated', renderStakingDetails);
    document.addEventListener('winix-initialized', renderStakingDetails);

    // Ініціалізуємо відображення при завантаженні
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderStakingDetails);
    } else {
        renderStakingDetails();
    }

    console.log("✅ Модуль стейкінгу успішно ініціалізовано");

    /**
 * Локальний розрахунок очікуваної винагороди за стейкінг без API
 * @param {number} amount - Сума стейкінгу
 * @param {number} period - Період стейкінгу в днях
 * @returns {number} - Очікувана винагорода
 */
function calculateExpectedReward(amount, period) {
    try {
        // Перевірка параметрів
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
        console.error('Помилка локального розрахунку винагороди:', e);
        return 0;
    }
}

// Додаємо функцію до WinixStakingSystem
window.WinixStakingSystem.calculateExpectedReward = calculateExpectedReward;

})();