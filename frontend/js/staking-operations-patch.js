/**
 * staking-operations-patch.js
 *
 * Комплексний патч для всіх операцій стейкінгу:
 * - Створення стейкінгу
 * - Додавання коштів до стейкінгу
 * - Скасування стейкінгу
 */

(function() {
    console.log("🔧 Застосування комплексного патчу для операцій стейкінгу...");

    // Перевіряємо наявність API модуля
    if (!window.WinixAPI) {
        console.error("❌ Не знайдено WinixAPI! Неможливо застосувати патч для операцій стейкінгу.");
        return;
    }

    // Функція для генерації унікального ID
    function generateUniqueId() {
        return 'stk_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    }

    // Функція локального розрахунку штрафу при скасуванні
    function calculateCancellationPenalty(amount) {
        const penaltyRate = 0.2; // 20%
        const penaltyAmount = amount * penaltyRate;
        return {
            originalAmount: amount,
            penaltyRate: penaltyRate,
            penaltyAmount: penaltyAmount,
            returnedAmount: amount - penaltyAmount
        };
    }

    // Функція оновлення інтерфейсу після змін стейкінгу
    function updateUI() {
        try {
            // Оновлюємо баланс
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateBalanceDisplay();
                window.WinixCore.UI.updateStakingDisplay();
            }

            // Оновлюємо статус стейкінгу
            const stakingStatus = document.getElementById('staking-status');
            if (stakingStatus) {
                try {
                    const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                    const stakingData = JSON.parse(stakingDataStr || '{}');

                    if (stakingData && stakingData.hasActiveStaking) {
                        stakingStatus.textContent = `У стейкінгу: ${stakingData.stakingAmount || 0} $WINIX`;
                    } else {
                        stakingStatus.textContent = "Наразі немає активних стейкінгів";
                    }
                } catch (e) {
                    stakingStatus.textContent = "Наразі немає активних стейкінгів";
                }
            }

            // Оновлюємо кнопки
            updateButtonState();

            // Відправляємо подію про оновлення стейкінгу
            document.dispatchEvent(new CustomEvent('staking-updated'));
        } catch (e) {
            console.error("❌ Помилка оновлення UI після операції стейкінгу:", e);
        }
    }

    // Функція оновлення стану кнопок
    function updateButtonState() {
        try {
            // Перевіряємо наявність активного стейкінгу
            let hasStaking = false;
            try {
                const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                const stakingData = JSON.parse(stakingDataStr || '{}');
                hasStaking = stakingData && stakingData.hasActiveStaking === true;
            } catch (e) {
                hasStaking = false;
            }

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
            console.error("❌ Помилка оновлення стану кнопок:", e);
        }
    }

    // Функція показу сповіщення для користувача
    function showNotification(message, type = 'success') {
        try {
            if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                window.WinixCore.UI.showNotification(message, type);
            } else if (window.showToast) {
                window.showToast(message);
            } else {
                alert(message);
            }
        } catch (e) {
            console.error("❌ Помилка показу сповіщення:", e);
            alert(message);
        }
    }

    // ================ ПАТЧІ ДЛЯ ОПЕРАЦІЙ СТЕЙКІНГУ ================

    // 1. ПАТЧ ДЛЯ СТВОРЕННЯ СТЕЙКІНГУ
    const originalCreateStaking = window.WinixAPI.createStaking;
    window.WinixAPI.createStaking = function(amount, period) {
        return new Promise((resolve) => {
            // Поточний баланс перед операцією
            const currentBalance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');

            // Перевірка валідності параметрів
            if (isNaN(amount) || amount < 50) {
                showNotification('Мінімальна сума стейкінгу - 50 WINIX', 'error');
                resolve({
                    status: 'error',
                    message: 'Мінімальна сума стейкінгу - 50 WINIX'
                });
                return;
            }

            if (amount > currentBalance) {
                showNotification('Недостатньо коштів на балансі', 'error');
                resolve({
                    status: 'error',
                    message: 'Недостатньо коштів на балансі'
                });
                return;
            }

            if (![7, 14, 28].includes(period)) {
                showNotification('Невірний період стейкінгу', 'error');
                resolve({
                    status: 'error',
                    message: 'Невірний період стейкінгу'
                });
                return;
            }

            // Спробуємо викликати оригінальну функцію
            originalCreateStaking(amount, period)
                .then(result => {
                    // Якщо запит успішний, просто повертаємо результат
                    resolve(result);
                })
                .catch(error => {
                    console.warn("⚠️ Помилка API створення стейкінгу. Використовуємо локальне резервне рішення:", error);

                    // Якщо сервер повернув помилку, створюємо стейкінг локально
                    try {
                        // Визначаємо відсоток винагороди
                        const rewardRates = {
                            7: 4,   // 4% за 7 днів
                            14: 9,  // 9% за 14 днів
                            28: 15  // 15% за 28 днів
                        };

                        const rewardPercent = rewardRates[period] || 9;
                        const expectedReward = (amount * rewardPercent) / 100;

                        // Створюємо локальні дані стейкінгу
                        const stakingData = {
                            hasActiveStaking: true,
                            stakingId: generateUniqueId(),
                            stakingAmount: amount,
                            period: period,
                            rewardPercent: rewardPercent,
                            expectedReward: expectedReward,
                            startDate: new Date().toISOString(),
                            endDate: new Date(Date.now() + period * 24 * 60 * 60 * 1000).toISOString(),
                            remainingDays: period,
                            source: 'local_fallback'
                        };

                        // Зберігаємо дані в localStorage
                        localStorage.setItem('stakingData', JSON.stringify(stakingData));
                        localStorage.setItem('winix_staking', JSON.stringify(stakingData));

                        // Оновлюємо баланс
                        const newBalance = currentBalance - amount;
                        localStorage.setItem('userTokens', newBalance.toString());
                        localStorage.setItem('winix_balance', newBalance.toString());

                        // Оновлюємо UI
                        updateUI();

                        // Показуємо сповіщення
                        showNotification('Стейкінг успішно створено (локально)', 'success');

                        // Повертаємо успішний результат
                        resolve({
                            status: 'success',
                            data: {
                                staking: stakingData,
                                balance: newBalance,
                                previous_balance: currentBalance
                            },
                            message: 'Стейкінг успішно створено (локально)'
                        });
                    } catch (e) {
                        console.error("❌ Помилка при локальному створенні стейкінгу:", e);

                        resolve({
                            status: 'error',
                            message: 'Не вдалося створити стейкінг'
                        });
                    }
                });
        });
    };

    // 2. ПАТЧ ДЛЯ ДОДАВАННЯ КОШТІВ ДО СТЕЙКІНГУ
    const originalAddToStaking = window.WinixAPI.addToStaking;
    window.WinixAPI.addToStaking = function(amount, stakingId = null) {
        return new Promise((resolve) => {
            // Поточний баланс і дані стейкінгу
            const currentBalance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
            let stakingData = null;

            try {
                const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                stakingData = JSON.parse(stakingDataStr || '{}');
            } catch (e) {
                console.warn("⚠️ Помилка при отриманні даних стейкінгу:", e);
            }

            // Перевірка наявності активного стейкінгу
            if (!stakingData || !stakingData.hasActiveStaking) {
                showNotification('У вас немає активного стейкінгу', 'error');
                resolve({
                    status: 'error',
                    message: 'У вас немає активного стейкінгу'
                });
                return;
            }

            // Перевірка валідності суми
            if (isNaN(amount) || amount <= 0) {
                showNotification('Введіть коректну суму', 'error');
                resolve({
                    status: 'error',
                    message: 'Введіть коректну суму'
                });
                return;
            }

            if (amount > currentBalance) {
                showNotification('Недостатньо коштів на балансі', 'error');
                resolve({
                    status: 'error',
                    message: 'Недостатньо коштів на балансі'
                });
                return;
            }

            // Використовуємо stakingId з даних, якщо не передано
            if (!stakingId && stakingData) {
                stakingId = stakingData.stakingId;
            }

            // Спробуємо викликати оригінальну функцію
            originalAddToStaking(amount, stakingId)
                .then(result => {
                    // Якщо запит успішний, просто повертаємо результат
                    resolve(result);
                })
                .catch(error => {
                    console.warn("⚠️ Помилка API додавання до стейкінгу. Використовуємо локальне резервне рішення:", error);

                    // Якщо сервер повернув помилку, додаємо кошти локально
                    try {
                        // Оновлюємо дані стейкінгу
                        const newAmount = stakingData.stakingAmount + amount;
                        const rewardPercent = stakingData.rewardPercent || 9;
                        const expectedReward = (newAmount * rewardPercent) / 100;

                        // Оновлюємо об'єкт даних стейкінгу
                        stakingData.stakingAmount = newAmount;
                        stakingData.expectedReward = expectedReward;
                        stakingData.source = 'local_fallback_add';

                        // Зберігаємо оновлені дані
                        localStorage.setItem('stakingData', JSON.stringify(stakingData));
                        localStorage.setItem('winix_staking', JSON.stringify(stakingData));

                        // Оновлюємо баланс
                        const newBalance = currentBalance - amount;
                        localStorage.setItem('userTokens', newBalance.toString());
                        localStorage.setItem('winix_balance', newBalance.toString());

                        // Оновлюємо UI
                        updateUI();

                        // Показуємо сповіщення
                        showNotification(`Додано ${amount} WINIX до стейкінгу (локально)`, 'success');

                        // Повертаємо успішний результат
                        resolve({
                            status: 'success',
                            data: {
                                staking: stakingData,
                                balance: newBalance,
                                previous_balance: currentBalance,
                                added_amount: amount
                            },
                            message: `Додано ${amount} WINIX до стейкінгу (локально)`
                        });
                    } catch (e) {
                        console.error("❌ Помилка при локальному додаванні до стейкінгу:", e);

                        resolve({
                            status: 'error',
                            message: 'Не вдалося додати кошти до стейкінгу'
                        });
                    }
                });
        });
    };

    // 3. ПАТЧ ДЛЯ СКАСУВАННЯ СТЕЙКІНГУ
    const originalCancelStaking = window.WinixAPI.cancelStaking;
    window.WinixAPI.cancelStaking = function(stakingId = null) {
        return new Promise((resolve) => {
            // Поточний баланс і дані стейкінгу
            const currentBalance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
            let stakingData = null;

            try {
                const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                stakingData = JSON.parse(stakingDataStr || '{}');
            } catch (e) {
                console.warn("⚠️ Помилка при отриманні даних стейкінгу:", e);
            }

            // Перевірка наявності активного стейкінгу
            if (!stakingData || !stakingData.hasActiveStaking) {
                showNotification('У вас немає активного стейкінгу', 'error');
                resolve({
                    status: 'error',
                    message: 'У вас немає активного стейкінгу'
                });
                return;
            }

            // Використовуємо stakingId з даних, якщо не передано
            if (!stakingId && stakingData) {
                stakingId = stakingData.stakingId;
            }

            // Спробуємо викликати оригінальну функцію
            originalCancelStaking(stakingId)
                .then(result => {
                    // Якщо запит успішний, просто повертаємо результат
                    resolve(result);
                })
                .catch(error => {
                    console.warn("⚠️ Помилка API скасування стейкінгу. Використовуємо локальне резервне рішення:", error);

                    // Якщо сервер повернув помилку, скасовуємо стейкінг локально
                    try {
                        // Розраховуємо штраф за дострокове скасування
                        const penalty = calculateCancellationPenalty(stakingData.stakingAmount);

                        // Оновлюємо баланс з урахуванням штрафу
                        const newBalance = currentBalance + penalty.returnedAmount;
                        localStorage.setItem('userTokens', newBalance.toString());
                        localStorage.setItem('winix_balance', newBalance.toString());

                        // Видаляємо дані стейкінгу
                        localStorage.removeItem('stakingData');
                        localStorage.removeItem('winix_staking');

                        // Оновлюємо UI
                        updateUI();

                        // Показуємо сповіщення
                        showNotification('Стейкінг успішно скасовано (локально)', 'success');

                        // Повертаємо успішний результат
                        resolve({
                            status: 'success',
                            data: {
                                newBalance: newBalance,
                                previous_balance: currentBalance,
                                penalty_amount: penalty.penaltyAmount,
                                returned_amount: penalty.returnedAmount,
                                original_amount: penalty.originalAmount
                            },
                            message: 'Стейкінг успішно скасовано (локально)'
                        });
                    } catch (e) {
                        console.error("❌ Помилка при локальному скасуванні стейкінгу:", e);

                        resolve({
                            status: 'error',
                            message: 'Не вдалося скасувати стейкінг'
                        });
                    }
                });
        });
    };

    // Перевіряємо наявність StakingSystem і забезпечуємо його працездатність
    if (window.StakingSystem && !window.WinixStakingSystem) {
        window.WinixStakingSystem = window.StakingSystem;
    }

    if (window.WinixStakingSystem) {
        // Патчимо функції StakingSystem
        if (window.WinixStakingSystem.createStaking) {
            const originalStakingCreate = window.WinixStakingSystem.createStaking;
            window.WinixStakingSystem.createStaking = function(amount, period) {
                return window.WinixAPI.createStaking(amount, period);
            };
        }

        if (window.WinixStakingSystem.addToStaking) {
            const originalStakingAdd = window.WinixStakingSystem.addToStaking;
            window.WinixStakingSystem.addToStaking = function(amount, stakingId) {
                return window.WinixAPI.addToStaking(amount, stakingId);
            };
        }

        if (window.WinixStakingSystem.cancelStaking) {
            const originalStakingCancel = window.WinixStakingSystem.cancelStaking;
            window.WinixStakingSystem.cancelStaking = function(stakingId) {
                return window.WinixAPI.cancelStaking(stakingId);
            };
        }
    }

    // Перевизначаємо функції отримання даних стейкінгу
    const originalGetStakingData = window.WinixAPI.getStakingData;
    window.WinixAPI.getStakingData = function() {
        return new Promise((resolve) => {
            originalGetStakingData()
                .then(result => {
                    resolve(result);
                })
                .catch(error => {
                    console.warn("⚠️ Помилка API отримання даних стейкінгу. Використовуємо локальні дані:", error);

                    try {
                        // Отримуємо дані з localStorage
                        const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                        const stakingData = JSON.parse(stakingDataStr || '{}');

                        resolve({
                            status: 'success',
                            data: stakingData || {
                                hasActiveStaking: false,
                                stakingAmount: 0,
                                period: 0,
                                rewardPercent: 0,
                                expectedReward: 0,
                                remainingDays: 0,
                                source: 'local_fallback_get'
                            }
                        });
                    } catch (e) {
                        console.error("❌ Помилка при отриманні локальних даних стейкінгу:", e);

                        resolve({
                            status: 'success',
                            data: {
                                hasActiveStaking: false,
                                stakingAmount: 0,
                                period: 0,
                                rewardPercent: 0,
                                expectedReward: 0,
                                remainingDays: 0,
                                source: 'local_fallback_empty'
                            }
                        });
                    }
                });
        });
    };

    // Додаємо обробники для кнопок скасування
    document.addEventListener('DOMContentLoaded', function() {
        // Кнопка "Скасувати стейкінг" на сторінці
        const cancelButton = document.getElementById('cancel-staking-button');
        if (cancelButton) {
            cancelButton.addEventListener('click', function(event) {
                event.preventDefault();

                // Підтвердження скасування
                if (confirm('Ви впевнені, що хочете скасувати стейкінг? Буде утримано штраф за дострокове скасування.')) {
                    // Показуємо індикатор завантаження
                    showNotification('Скасовуємо стейкінг...', 'info');

                    // Скасовуємо стейкінг
                    window.WinixAPI.cancelStaking()
                        .then(result => {
                            if (result.status === 'success') {
                                showNotification(result.message || 'Стейкінг успішно скасовано', 'success');
                                // Оновлюємо UI після успішного скасування
                                setTimeout(updateUI, 500);
                            } else {
                                showNotification(result.message || 'Помилка скасування стейкінгу', 'error');
                            }
                        })
                        .catch(error => {
                            console.error("❌ Помилка скасування стейкінгу:", error);
                            showNotification('Помилка скасування стейкінгу', 'error');
                        });
                }
            });
        }

        // Кнопка "Скасувати стейкінг" в модальному вікні
        const modalCancelButton = document.getElementById('modal-cancel-staking-button');
        if (modalCancelButton) {
            modalCancelButton.addEventListener('click', function(event) {
                event.preventDefault();

                // Закриваємо модальне вікно, якщо воно є
                const modal = document.getElementById('staking-modal');
                if (modal) {
                    modal.classList.remove('active');
                }

                // Підтвердження скасування
                if (confirm('Ви впевнені, що хочете скасувати стейкінг? Буде утримано штраф за дострокове скасування.')) {
                    // Показуємо індикатор завантаження
                    showNotification('Скасовуємо стейкінг...', 'info');

                    // Скасовуємо стейкінг
                    window.WinixAPI.cancelStaking()
                        .then(result => {
                            if (result.status === 'success') {
                                showNotification(result.message || 'Стейкінг успішно скасовано', 'success');
                                // Оновлюємо UI після успішного скасування
                                setTimeout(updateUI, 500);
                            } else {
                                showNotification(result.message || 'Помилка скасування стейкінгу', 'error');
                            }
                        })
                        .catch(error => {
                            console.error("❌ Помилка скасування стейкінгу:", error);
                            showNotification('Помилка скасування стейкінгу', 'error');
                        });
                }
            });
        }
    });

    console.log("✅ Комплексний патч для операцій стейкінгу успішно застосовано");
})();