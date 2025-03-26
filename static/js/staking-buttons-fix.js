/**
 * staking-buttons-fix.js
 * Уніфікована система для керування кнопками стейкінгу у WINIX.
 */

(function() {
    console.log("🔒 Запуск централізованої системи керування кнопками стейкінгу");

    // Запобігаємо повторній ініціалізації
    if (window.WinixStakingButtonsFixed) {
        console.log("⚠️ Систему керування кнопками стейкінгу вже ініціалізовано");
        return;
    }

    // Позначаємо, що систему вже ініціалізовано
    window.WinixStakingButtonsFixed = true;

    // Глобальний прапорець для запобігання повторним кліком
    let isProcessingStakingAction = false;

    // Функція для очищення всіх обробників з елемента та додавання нового
    function setupCleanButton(buttonId, clickHandler) {
        // Виконуємо після повного завантаження DOM
        function initButton() {
            const button = document.getElementById(buttonId);
            if (!button) return;

            console.log(`🔄 Налаштування кнопки ${buttonId} з єдиним обробником`);

            // Створюємо клон кнопки без обробників
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            // Додаємо єдиний обробник
            newButton.addEventListener('click', clickHandler);
        }

        // Ініціалізація при завантаженні DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initButton);
        } else {
            initButton();
        }

        // Повторна ініціалізація при зміні сторінки AJAX
        document.addEventListener('winix-initialized', initButton);
    }

    // Обробник для кнопки додавання до стейкінгу
    function handleAddToStakeButton() {
        // Запобігаємо повторному відкриттю
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        isProcessingStakingAction = true;
        console.log("💼 Виклик модального вікна для додавання до стейкінгу");

        try {
            // Використовуємо централізовану функцію створення модальних вікон
            window.createInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
                console.log(`💼 Отримано суму для додавання: ${amount}`);

                // Перевіряємо наявність активного стейкінгу
                let hasActiveStaking = false;
                if (window.WinixCore && window.WinixCore.Staking) {
                    hasActiveStaking = window.WinixCore.Staking.hasActiveStaking();
                } else if (window.stakingSystem) {
                    hasActiveStaking = window.stakingSystem.hasActiveStaking();
                }

                if (!hasActiveStaking) {
                    window.simpleAlert("У вас немає активного стейкінгу", true);
                    return;
                }

                // Перевіряємо баланс
                let balance = 0;
                if (window.WinixCore && window.WinixCore.Balance) {
                    balance = window.WinixCore.Balance.getTokens();
                } else if (window.balanceSystem) {
                    balance = window.balanceSystem.getTokens();
                } else {
                    balance = parseFloat(localStorage.getItem('userTokens') || '0');
                }

                if (amount > balance) {
                    window.simpleAlert(`Недостатньо коштів. Ваш баланс: ${balance.toFixed(2)} $WINIX`, true);
                    return;
                }

                // Додаємо кошти до стейкінгу
                if (window.WinixCore && window.WinixCore.Staking) {
                    const result = window.WinixCore.Staking.addToStaking(amount);
                    if (result.success) {
                        window.simpleAlert(`Додано ${amount.toFixed(2)} $WINIX до стейкінгу`, false, function() {
                            // Оновлюємо UI після успішного додавання
                            if (window.WinixCore && window.WinixCore.UI) {
                                window.WinixCore.UI.updateStakingDisplay();
                                window.WinixCore.UI.updateBalanceDisplay();
                            }
                        });
                    } else {
                        window.simpleAlert(result.message || "Помилка додавання до стейкінгу", true);
                    }
                } else if (window.stakingSystem) {
                    const result = window.stakingSystem.addToStaking(amount);
                    if (result.success) {
                        window.simpleAlert(`Додано ${amount.toFixed(2)} $WINIX до стейкінгу`, false, function() {
                            // Оновлюємо UI після успішного додавання
                            window.stakingSystem.updateStakingDisplay();
                            if (window.balanceSystem) {
                                window.balanceSystem.updateDisplay();
                            }
                        });
                    } else {
                        window.simpleAlert(result.message || "Помилка додавання до стейкінгу", true);
                    }
                } else {
                    window.simpleAlert("Помилка: системи стейкінгу не знайдено", true);
                }
            });
        } catch (error) {
            console.error("Помилка при обробці кнопки додавання до стейкінгу:", error);
            window.simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
        } finally {
            // Скидаємо прапорець блокування через невеликий проміжок часу
            setTimeout(function() {
                isProcessingStakingAction = false;
            }, 500);
        }
    }

    // Обробник для кнопки скасування стейкінгу
    function handleCancelStakingButton() {
        // Запобігаємо повторному відкриттю
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        isProcessingStakingAction = true;
        console.log("💼 Обробка скасування стейкінгу");

        try {
            // Перевіряємо наявність активного стейкінгу
            let hasActiveStaking = false;
            if (window.WinixCore && window.WinixCore.Staking) {
                hasActiveStaking = window.WinixCore.Staking.hasActiveStaking();
            } else if (window.stakingSystem) {
                hasActiveStaking = window.stakingSystem.hasActiveStaking();
            }

            if (!hasActiveStaking) {
                window.simpleAlert("У вас немає активного стейкінгу", true);
                return;
            }

            if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано 20% від суми стейкінгу як штраф.")) {
                if (window.WinixCore && window.WinixCore.Staking) {
                    const result = window.WinixCore.Staking.cancelStaking();
                    if (result.success) {
                        window.simpleAlert(result.message || "Стейкінг успішно скасовано", false, function() {
                            window.location.href = "wallet.html";
                        });
                    } else {
                        window.simpleAlert(result.message || "Помилка скасування стейкінгу", true);
                    }
                } else if (window.stakingSystem) {
                    const result = window.stakingSystem.cancelStaking();
                    if (result.success) {
                        window.simpleAlert(result.message || "Стейкінг успішно скасовано", false, function() {
                            window.location.href = "wallet.html";
                        });
                    } else {
                        window.simpleAlert(result.message || "Помилка скасування стейкінгу", true);
                    }
                } else {
                    window.simpleAlert("Помилка: системи стейкінгу не знайдено", true);
                }
            }
        } catch (error) {
            console.error("Помилка при обробці кнопки скасування стейкінгу:", error);
            window.simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
        } finally {
            // Скидаємо прапорець блокування через невеликий проміжок часу
            setTimeout(function() {
                isProcessingStakingAction = false;
            }, 500);
        }
    }

    // Обробник для кнопки "Застейкати"
    function handleStakeButton() {
        // Запобігаємо повторному відкриттю
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        isProcessingStakingAction = true;
        console.log("💼 Обробка створення стейкінгу");

        try {
            // Отримуємо значення з полів
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');

            if (!amountInput || !periodSelect) {
                window.simpleAlert("Не вдалося знайти поля для стейкінгу", true);
                return;
            }

            const amount = parseFloat(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                window.simpleAlert("Введіть коректну суму", true);
                return;
            }

            const period = parseInt(periodSelect.value);
            if (isNaN(period) || ![7, 14, 28].includes(period)) {
                window.simpleAlert("Виберіть коректний період стейкінгу", true);
                return;
            }

            // Перевіряємо наявність активного стейкінгу
            let hasActiveStaking = false;
            if (window.WinixCore && window.WinixCore.Staking) {
                hasActiveStaking = window.WinixCore.Staking.hasActiveStaking();
            } else if (window.stakingSystem) {
                hasActiveStaking = window.stakingSystem.hasActiveStaking();
            }

            if (hasActiveStaking) {
                window.simpleAlert("У вас вже є активний стейкінг", true);
                return;
            }

            // Перевіряємо баланс
            let balance = 0;
            if (window.WinixCore && window.WinixCore.Balance) {
                balance = window.WinixCore.Balance.getTokens();
            } else if (window.balanceSystem) {
                balance = window.balanceSystem.getTokens();
            }

            if (amount > balance) {
                window.simpleAlert(`Недостатньо коштів. Ваш баланс: ${balance.toFixed(2)} $WINIX`, true);
                return;
            }

            // Створюємо стейкінг
            if (window.WinixCore && window.WinixCore.Staking) {
                const result = window.WinixCore.Staking.createStaking(amount, period);
                if (result.success) {
                    window.simpleAlert("Стейкінг успішно створено!", false, function() {
                        window.location.href = "staking-details.html";
                    });
                } else {
                    window.simpleAlert(result.message || "Помилка створення стейкінгу", true);
                }
            } else if (window.stakingSystem) {
                const result = window.stakingSystem.createStaking(amount, period);
                if (result.success) {
                    window.simpleAlert("Стейкінг успішно створено!", false, function() {
                        window.location.href = "staking-details.html";
                    });
                } else {
                    window.simpleAlert(result.message || "Помилка створення стейкінгу", true);
                }
            } else {
                window.simpleAlert("Помилка: системи стейкінгу не знайдено", true);
            }
        } catch (error) {
            console.error("Помилка при обробці кнопки створення стейкінгу:", error);
            window.simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
        } finally {
            // Скидаємо прапорець блокування через невеликий проміжок часу
            setTimeout(function() {
                isProcessingStakingAction = false;
            }, 500);
        }
    }

    // Обробник для кнопки "Деталі стейкінгу"
    function handleDetailsButton() {
        console.log("💼 Перехід до деталей стейкінгу");

        try {
            // Перевіряємо наявність активного стейкінгу
            let hasActiveStaking = false;
            if (window.WinixCore && window.WinixCore.Staking) {
                hasActiveStaking = window.WinixCore.Staking.hasActiveStaking();
            } else if (window.stakingSystem) {
                hasActiveStaking = window.stakingSystem.hasActiveStaking();
            }

            if (!hasActiveStaking) {
                window.simpleAlert("У вас немає активного стейкінгу", true);
                return;
            }

            // Переходимо на сторінку деталей стейкінгу
            window.location.href = "staking-details.html";
        } catch (error) {
            console.error("Помилка при обробці кнопки деталей стейкінгу:", error);
            window.simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    // Встановлюємо обробники для всіх кнопок стейкінгу
    setupCleanButton('add-to-stake-button', handleAddToStakeButton);
    setupCleanButton('cancel-staking-button', handleCancelStakingButton);
    setupCleanButton('stake-button', handleStakeButton);
    setupCleanButton('details-button', handleDetailsButton);

    // Експортуємо функції для можливого використання в інших місцях
    window.WinixStakingButtons = {
        setupAddButton: function() { setupCleanButton('add-to-stake-button', handleAddToStakeButton); },
        setupCancelButton: function() { setupCleanButton('cancel-staking-button', handleCancelStakingButton); },
        setupStakeButton: function() { setupCleanButton('stake-button', handleStakeButton); },
        setupDetailsButton: function() { setupCleanButton('details-button', handleDetailsButton); }
    };

    console.log("✅ Централізовану систему керування кнопками стейкінгу успішно ініціалізовано");
})();