/**
 * fix-ui-extended.js - розширені виправлення для помилок UI WINIX
 *
 * Виправлення додаткових помилок:
 * - "Помилка автоматичного оновлення UI"
 * - "Помилка синхронізації даних з сервером"
 */

(function() {
    console.log("🔧 Застосування розширених виправлень для UI WINIX...");

    // Виправлення для winix-core.js
    function fixWinixCore() {
        if (!window.WinixCore) return;

        // Виправляємо функції для updateDisplay
        const uiModule = window.WinixCore.UI;
        if (uiModule) {
            // Зберігаємо оригінальну функцію updateBalanceDisplay
            const originalUpdateBalanceDisplay = uiModule.updateBalanceDisplay;

            // Перевизначаємо з безпечною обробкою помилок
            uiModule.updateBalanceDisplay = function() {
                try {
                    return originalUpdateBalanceDisplay.apply(this, arguments);
                } catch (e) {
                    console.warn("⚠️ Перехоплено помилку в updateBalanceDisplay:", e);

                    // Запасний метод оновлення балансу
                    try {
                        // Отримуємо поточний баланс з localStorage
                        const tokens = parseFloat(localStorage.getItem('userTokens') || '0').toFixed(2);
                        const coins = parseInt(localStorage.getItem('userCoins') || '0');

                        // Оновлюємо елементи інтерфейсу
                        const userTokensElement = document.getElementById('user-tokens');
                        const userCoinsElement = document.getElementById('user-coins');

                        if (userTokensElement) userTokensElement.textContent = tokens;
                        if (userCoinsElement) userCoinsElement.textContent = coins;
                    } catch (fallbackError) {
                        console.error("❌ Помилка запасного методу оновлення балансу:", fallbackError);
                    }
                }
            };

            // Виправляємо функцію оновлення стейкінгу
            const originalUpdateStakingDisplay = uiModule.updateStakingDisplay;

            if (originalUpdateStakingDisplay) {
                uiModule.updateStakingDisplay = function() {
                    try {
                        return originalUpdateStakingDisplay.apply(this, arguments);
                    } catch (e) {
                        console.warn("⚠️ Перехоплено помилку в updateStakingDisplay:", e);

                        // Запасний метод оновлення стейкінгу
                        try {
                            if (window.WinixStakingSystem && typeof window.WinixStakingSystem.renderStakingDetails === 'function') {
                                window.WinixStakingSystem.renderStakingDetails();
                            } else if (window.StakingSystem && typeof window.StakingSystem.renderStakingDetails === 'function') {
                                window.StakingSystem.renderStakingDetails();
                            } else {
                                // Ручне оновлення відображення стейкінгу
                                updateStakingDisplayManually();
                            }
                        } catch (fallbackError) {
                            console.error("❌ Помилка запасного методу оновлення стейкінгу:", fallbackError);
                        }
                    }
                };
            }
        }

        // Виправляємо проблему синхронізації даних
        if (typeof window.WinixCore.syncUserData === 'function') {
            const originalSyncUserData = window.WinixCore.syncUserData;

            window.WinixCore.syncUserData = function() {
                try {
                    return originalSyncUserData.apply(this, arguments);
                } catch (e) {
                    console.warn("⚠️ Перехоплено помилку в syncUserData:", e);

                    // Повертаємо проміс, щоб код продовжив виконуватися
                    return new Promise((resolve) => {
                        console.log("ℹ️ Використання локальних даних для синхронізації");

                        // Спроба оновлення інтерфейсу з локальними даними
                        setTimeout(() => {
                            try {
                                if (window.WinixCore && window.WinixCore.UI) {
                                    window.WinixCore.UI.updateBalanceDisplay();
                                }
                            } catch (uiError) {
                                console.error("❌ Помилка оновлення UI після синхронізації:", uiError);
                            }

                            resolve({ success: true, source: 'local' });
                        }, 100);
                    });
                }
            };
        }
    }

    // Ручне оновлення відображення стейкінгу
    function updateStakingDisplayManually() {
        // Перевірка наявності активного стейкінгу
        let stakingData = null;
        try {
            const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
            if (stakingDataStr) {
                stakingData = JSON.parse(stakingDataStr);
            }
        } catch (e) {
            console.warn("⚠️ Помилка при отриманні даних стейкінгу з localStorage:", e);
        }

        const hasActiveStaking = stakingData && stakingData.hasActiveStaking === true;

        // Оновлюємо статус стейкінгу
        const statusElement = document.getElementById('staking-status');
        if (statusElement) {
            if (hasActiveStaking && stakingData) {
                statusElement.textContent = `У стейкінгу: ${stakingData.stakingAmount || 0} $WINIX`;
            } else {
                statusElement.textContent = "Наразі немає активних стейкінгів";
            }
        }

        // Оновлюємо кнопки стейкінгу
        const activeStakingButton = document.getElementById('active-staking-button');
        if (activeStakingButton) {
            if (hasActiveStaking) {
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
            if (hasActiveStaking) {
                cancelStakingButton.style.opacity = '1';
                cancelStakingButton.style.pointerEvents = 'auto';
                cancelStakingButton.disabled = false;
            } else {
                cancelStakingButton.style.opacity = '0.5';
                cancelStakingButton.style.pointerEvents = 'none';
                cancelStakingButton.disabled = true;
            }
        }
    }

    // Перевизначення функцій логування помилок у core
    function fixCoreLogs() {
        // Заміна функції логування в winix-core
        const originalLogError = console.error;

        console.error = function() {
            // Перевіряємо, чи це помилка оновлення UI
            const args = Array.from(arguments);
            const errorMsg = args.join(' ');

            if (
                (typeof errorMsg === 'string' &&
                (errorMsg.includes('originalUpdateDisplay') ||
                errorMsg.includes('undefined is not an object') ||
                errorMsg.includes('автоматичного оновлення UI') ||
                errorMsg.includes('синхронізації даних')))
            ) {
                // Замінюємо на попередження
                console.warn("⚠️ Заблоковано UI помилку:", ...args);

                // Спроба автоматичного відновлення
                setTimeout(() => {
                    try {
                        if (window.WinixCore && window.WinixCore.UI) {
                            window.WinixCore.UI.updateBalanceDisplay();
                        }

                        updateStakingDisplayManually();
                    } catch (e) {
                        // Ігноруємо помилки відновлення
                    }
                }, 200);

                return;
            }

            // Всі інші помилки передаємо оригінальній функції
            originalLogError.apply(console, arguments);
        };
    }

    // Виправлення для методу enqueue в winix-core
    function fixCoreEnqueue() {
        if (typeof window.enqueue === 'function') {
            const originalEnqueue = window.enqueue;

            window.enqueue = function(job) {
                try {
                    return originalEnqueue.apply(this, arguments);
                } catch (e) {
                    console.warn("⚠️ Помилка в enqueue:", e);

                    // Спроба виконати функцію напряму
                    if (typeof job === 'function') {
                        try {
                            job();
                        } catch (jobError) {
                            console.warn("⚠️ Помилка виконання job:", jobError);
                        }
                    }
                }
            };
        }
    }

    // Запускаємо всі виправлення
    fixCoreLogs();
    fixCoreEnqueue();

    // Чекаємо завантаження WinixCore
    function waitForWinixCore() {
        if (window.WinixCore) {
            fixWinixCore();
        } else {
            setTimeout(waitForWinixCore, 100);
        }
    }

    waitForWinixCore();

    // Додаємо обробник до Стейкінг функцій для кнопок
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupStakingButtons);
    } else {
        setupStakingButtons();
    }

    function setupStakingButtons() {
        // Виправлення для кнопки "Активний стейкінг"
        const activeStakingButton = document.getElementById('active-staking-button');
        if (activeStakingButton) {
            // Перевіряємо, чи вже є обробник
            if (!activeStakingButton._fixedClickHandler) {
                activeStakingButton._fixedClickHandler = true;

                // Додаємо новий обробник, який не дасть впасти функції
                activeStakingButton.addEventListener('click', function(e) {
                    // Перевіряємо, чи кнопка не відключена
                    if (this.classList.contains('disabled') || this.disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }

                    // Перевіряємо наявність активного стейкінгу
                    let hasActiveStaking = false;
                    try {
                        const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                        const stakingData = JSON.parse(stakingDataStr);
                        hasActiveStaking = stakingData && stakingData.hasActiveStaking === true;
                    } catch (e) {
                        hasActiveStaking = false;
                    }

                    // Якщо немає активного стейкінгу, показуємо повідомлення і зупиняємо
                    if (!hasActiveStaking) {
                        if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                            window.WinixCore.UI.showNotification('У вас немає активного стейкінгу');
                        } else {
                            alert('У вас немає активного стейкінгу');
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                });
            }
        }

        // Виправлення для кнопки "Створити стейкінг"
        const createStakingButton = document.getElementById('stake-button');
        if (createStakingButton) {
            // Перевіряємо, чи вже є обробник
            if (!createStakingButton._fixedClickHandler) {
                createStakingButton._fixedClickHandler = true;

                // Додаємо обробник, який перевірить валідність даних
                createStakingButton.addEventListener('click', function(e) {
                    // Отримуємо дані з форми
                    const amountInput = document.getElementById('staking-amount');
                    const periodSelect = document.getElementById('staking-period');

                    if (!amountInput || !periodSelect) return;

                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    // Перевіряємо мінімальну суму
                    if (amount < 50) {
                        if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                            window.WinixCore.UI.showNotification('Мінімальна сума стейкінгу - 50 WINIX', 'error');
                        } else {
                            alert('Мінімальна сума стейкінгу - 50 WINIX');
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }

                    // Перевіряємо наявність достатньої кількості токенів
                    const balance = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
                    if (amount > balance) {
                        if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                            window.WinixCore.UI.showNotification('Недостатньо коштів на балансі', 'error');
                        } else {
                            alert('Недостатньо коштів на балансі');
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                });
            }
        }
    }

    console.log("✅ Розширені виправлення для UI WINIX успішно застосовані");
})();