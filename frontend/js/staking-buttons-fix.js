/**
 * staking-buttons.js
 * Оптимізована система для керування кнопками стейкінгу у WINIX.
 * Вся бізнес-логіка виконується на сервері, фронтенд лише відправляє запити.
 */

(function() {
    console.log("🔒 Запуск оптимізованої системи керування кнопками стейкінгу");

    // Запобігаємо повторній ініціалізації
    if (window.WinixStakingButtonsFixed) {
        console.log("⚠️ Систему керування кнопками стейкінгу вже ініціалізовано");
        return;
    }

    // Позначаємо, що систему вже ініціалізовано
    window.WinixStakingButtonsFixed = true;

    // Глобальний прапорець для запобігання повторним кліком
    let isProcessingStakingAction = false;

    /**
     * Отримання ідентифікатора користувача
     * @returns {string} ID користувача
     */
    function getUserId() {
        return localStorage.getItem('telegram_user_id') ||
               (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);
    }

    /**
     * Функція для створення стилізованого модального вікна введення суми
     * @param {string} title Заголовок модального вікна
     * @param {Function} onConfirm Callback після підтвердження
     */
    function createInputModal(title, onConfirm) {
        // Видаляємо всі наявні модальні вікна перед створенням нового
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.remove();
        });

        // Використовуємо переданий або базовий текст
        const modalTitle = title || 'Введіть суму:';
        const cancelText = 'Скасувати';
        const confirmText = 'OK';
        const inputPlaceholder = 'Введіть суму';

        // Створюємо елементи модального вікна
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const container = document.createElement('div');
        container.className = 'modal-container';

        const titleElement = document.createElement('div');
        titleElement.className = 'modal-title';
        titleElement.textContent = modalTitle;

        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';

        const input = document.createElement('input');
        input.className = 'modal-input';
        input.type = 'number';
        input.min = '0';
        input.step = 'any';
        input.placeholder = inputPlaceholder;
        input.value = '0';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-buttons';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'modal-button cancel-button';
        cancelButton.textContent = cancelText;

        const confirmButton = document.createElement('button');
        confirmButton.className = 'modal-button confirm-button';
        confirmButton.textContent = confirmText;

        // Складаємо елементи разом
        inputContainer.appendChild(input);
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        container.appendChild(titleElement);
        container.appendChild(inputContainer);
        container.appendChild(buttonContainer);
        overlay.appendChild(container);

        // Додаємо обробники подій
        cancelButton.addEventListener('click', function() {
            overlay.remove();
        });

        confirmButton.addEventListener('click', function() {
            const amount = parseFloat(input.value);
            if (isNaN(amount) || amount <= 0) {
                input.classList.add('error');
                setTimeout(() => input.classList.remove('error'), 500);
                return;
            }
            overlay.remove();
            if (typeof onConfirm === 'function') {
                onConfirm(amount);
            }
        });

        // Додаємо модальне вікно до сторінки
        document.body.appendChild(overlay);

        // Встановлюємо фокус на полі введення
        setTimeout(() => input.focus(), 100);

        return overlay;
    }

    /**
     * Проста функція для показу сповіщень
     * @param {string} message Текст повідомлення
     * @param {boolean} isError Чи це повідомлення про помилку
     * @param {Function} callback Функція, яка викликається після закриття
     */
    function simpleAlert(message, isError = false, callback = null) {
        if (window.winixUI && window.winixUI.simpleAlert) {
            return window.winixUI.simpleAlert(message, isError, callback);
        }

        // Створюємо просте сповіщення, якщо немає winixUI
        const overlay = document.createElement('div');
        overlay.className = 'alert-overlay';

        const container = document.createElement('div');
        container.className = isError ? 'alert-container error' : 'alert-container success';

        const messageElement = document.createElement('div');
        messageElement.className = 'alert-message';
        messageElement.textContent = message;

        const button = document.createElement('button');
        button.className = 'alert-button';
        button.textContent = 'OK';

        container.appendChild(messageElement);
        container.appendChild(button);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        button.addEventListener('click', function() {
            overlay.remove();
            if (callback) setTimeout(callback, 100);
        });

        return new Promise(resolve => {
            button.addEventListener('click', function() {
                resolve();
            });
        });
    }

    /**
     * Функція для валідації суми стейкінгу
     * @param {number} amount - Сума для валідації
     * @param {number} balance - Поточний баланс користувача
     * @returns {Object} Результат валідації {isValid, message}
     */
    function validateStakingAmount(amount, balance) {
        // Константи для валідації (синхронізовані з бекендом)
        const MIN_STAKING_AMOUNT = 50;
        const MAX_STAKING_PERCENTAGE = 0.9;

        // Перевірка на число
        if (isNaN(amount) || amount <= 0) {
            return {
                isValid: false,
                message: "Введіть коректну суму більше нуля"
            };
        }

        // Перевірка на мінімальну суму
        if (amount < MIN_STAKING_AMOUNT) {
            return {
                isValid: false,
                message: `Мінімальна сума стейкінгу: ${MIN_STAKING_AMOUNT} WINIX`
            };
        }

        // Перевірка на максимальну суму відносно балансу
        const maxAllowedAmount = balance * MAX_STAKING_PERCENTAGE;
        if (amount > maxAllowedAmount) {
            return {
                isValid: false,
                message: `Максимальна сума: ${maxAllowedAmount.toFixed(2)} WINIX (${MAX_STAKING_PERCENTAGE*100}% від балансу)`
            };
        }

        // Перевірка на достатність балансу
        if (amount > balance) {
            return {
                isValid: false,
                message: `Недостатньо коштів. Ваш баланс: ${balance.toFixed(2)} WINIX`
            };
        }

        return {
            isValid: true,
            message: ""
        };
    }

    /**
     * Функція для очищення всіх обробників з елемента та додавання нового
     * @param {string} buttonId ID кнопки
     * @param {Function} clickHandler Функція-обробник
     */
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

    /**
     * Обробник для кнопки скасування стейкінгу
     */
    function handleCancelStakingButton() {
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        isProcessingStakingAction = true;
        console.log("💼 Обробка скасування стейкінгу");

        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                simpleAlert("Не вдалося визначити ID користувача", true);
                isProcessingStakingAction = false;
                return;
            }

            // Показуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність активного стейкінгу через API
            fetch(`/api/user/${userId}/staking`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP помилка! Статус: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Приховуємо індикатор завантаження
                    if (spinner) spinner.classList.remove('show');

                    if (data.status !== 'success' || !data.data || !data.data.hasActiveStaking) {
                        simpleAlert("У вас немає активного стейкінгу", true);
                        isProcessingStakingAction = false;
                        return;
                    }

                    // Запитуємо підтвердження
                    if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.")) {
                        // Блокуємо всі кнопки стейкінгу
                        const buttons = document.querySelectorAll('#stake-button, #cancel-staking-button, #add-to-stake-button');
                        buttons.forEach(btn => {
                            if (btn) btn.disabled = true;
                        });

                        // Показуємо індикатор завантаження знову
                        if (spinner) spinner.classList.add('show');

                        // Зберігаємо дані стейкінгу перед надсиланням запиту
                        const stakingData = data.data;

                        // Відправляємо запит на скасування стейкінгу
                        console.log("Відправляємо запит на скасування стейкінгу:", stakingData.stakingId);

                        fetch(`/api/user/${userId}/staking/${stakingData.stakingId}/cancel`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(stakingData) // Важливо! Тепер надсилаємо повні дані стейкінгу!
                        })
                        .then(response => {
                            // Приховуємо індикатор завантаження
                            if (spinner) spinner.classList.remove('show');

                            if (!response.ok) {
                                throw new Error(`HTTP помилка при скасуванні! Статус: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(result => {
                            isProcessingStakingAction = false;

                            // Розблоковуємо кнопки
                            buttons.forEach(btn => {
                                if (btn) btn.disabled = false;
                            });

                            if (result.status === 'success') {
                                // Видаляємо дані стейкінгу з локального сховища
                                localStorage.removeItem('stakingData');
                                localStorage.removeItem('winix_staking');

                                // Оновлюємо баланс у локальному сховищі
                                if (result.data && result.data.newBalance !== undefined) {
                                    localStorage.setItem('userTokens', result.data.newBalance.toString());
                                    localStorage.setItem('winix_balance', result.data.newBalance.toString());
                                }

                                // Оновлюємо відображення
                                if (window.WinixCore && window.WinixCore.UI) {
                                    window.WinixCore.UI.updateBalanceDisplay();
                                    window.WinixCore.UI.updateStakingDisplay();
                                }

                                // Показуємо повідомлення про успіх і перевіряємо результати
                                simpleAlert(result.message || "Стейкінг успішно скасовано", false, function() {
                                    // Перевіряємо результати скасування через API
                                    setTimeout(() => {
                                        fetch(`/api/user/${userId}/balance`)
                                            .then(response => response.json())
                                            .then(balanceData => {
                                                if (balanceData.status === 'success') {
                                                    // Оновлюємо дані балансу локально ще раз для певності
                                                    localStorage.setItem('userTokens', balanceData.data.balance.toString());
                                                    localStorage.setItem('winix_balance', balanceData.data.balance.toString());

                                                    if (window.WinixCore && window.WinixCore.UI) {
                                                        window.WinixCore.UI.updateBalanceDisplay();
                                                    }
                                                }
                                            })
                                            .catch(err => console.error("Помилка при отриманні оновленого балансу:", err));
                                    }, 500);

                                    // Переходимо на сторінку гаманця
                                    window.location.href = "wallet.html";
                                });
                            } else {
                                simpleAlert(result.message || "Помилка скасування стейкінгу", true);
                            }
                        })
                        .catch(error => {
                            console.error("Помилка при скасуванні стейкінгу:", error);

                            // Приховуємо індикатор завантаження
                            if (spinner) spinner.classList.remove('show');

                            // Розблоковуємо кнопки
                            buttons.forEach(btn => {
                                if (btn) btn.disabled = false;
                            });

                            simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                            isProcessingStakingAction = false;
                        });
                    } else {
                        isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    console.error("Помилка при перевірці стейкінгу:", error);

                    // Приховуємо індикатор завантаження
                    if (spinner) spinner.classList.remove('show');

                    simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                    isProcessingStakingAction = false;
                });
        } catch (error) {
            console.error("Помилка при обробці кнопки скасування стейкінгу:", error);
            simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
            isProcessingStakingAction = false;
        }
    }


    /**
     * Обробник для кнопки додавання до стейкінгу з покращеною логікою
     * для гарантії узгодженості даних між фронтендом і бекендом
     */
    function handleAddToStakeButton() {
        // Запобігаємо паралельним діям
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        isProcessingStakingAction = true;
        console.log("💼 Підготовка до додавання токенів до стейкінгу");

        try {
            // Отримуємо поточний баланс
            const userId = getUserId();
            const balance = parseFloat(localStorage.getItem('userTokens') || '0');

            createInputModal('Введіть суму для додавання до стейкінгу:', async function(amount) {
                // Валідація введеної суми
                const additionalAmount = parseFloat(amount);

                // Поглиблена валідація
                const validation = validateStakingAmount(additionalAmount, balance);
                if (!validation.isValid) {
                    simpleAlert(validation.message, true);
                    isProcessingStakingAction = false;
                    return;
                }

                // Підготовка UI
                const spinner = document.getElementById('loading-spinner');
                const buttons = document.querySelectorAll('button');

                try {
                    // Показуємо індикатор завантаження
                    if (spinner) spinner.classList.add('show');
                    buttons.forEach(btn => btn.disabled = true);

                    // Перевірка активного стейкінгу
                    const stakingResponse = await fetch(`/api/user/${userId}/staking`);
                    const stakingData = await stakingResponse.json();

                    if (!stakingResponse.ok || stakingData.status !== 'success' ||
                        !stakingData.data || !stakingData.data.hasActiveStaking) {
                        throw new Error("Немає активного стейкінгу");
                    }

                    // Перевірка балансу
                    const balanceResponse = await fetch(`/api/user/${userId}/balance`);
                    const balanceData = await balanceResponse.json();

                    if (!balanceResponse.ok || balanceData.status !== 'success' ||
                        !balanceData.data || balanceData.data.balance < additionalAmount) {
                        throw new Error(`Недостатньо коштів. Ваш баланс: ${balanceData.data?.balance.toFixed(2) || 0} WINIX`);
                    }

                    // Додавання до стейкінгу
                    const addStakeResponse = await fetch(`/api/user/${userId}/staking/${stakingData.data.stakingId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            additionalAmount: additionalAmount,
                            currentStakingAmount: stakingData.data.stakingAmount
                        })
                    });

                    const addStakeResult = await addStakeResponse.json();

                    // Обробка результату
                    if (!addStakeResponse.ok || addStakeResult.status !== 'success') {
                        throw new Error(addStakeResult.message || "Помилка додавання до стейкінгу");
                    }

                    // Оновлення локального стану
                    const updatedBalance = addStakeResult.data?.balance;
                    const updatedStakingData = addStakeResult.data?.staking;

                    if (updatedBalance !== undefined) {
                        localStorage.setItem('userTokens', updatedBalance.toString());
                        localStorage.setItem('winix_balance', updatedBalance.toString());

                        // Оновлення балансу в UI
                        updateBalanceDisplays(updatedBalance);
                    }

                    if (updatedStakingData) {
                        const stakingStr = JSON.stringify(updatedStakingData);
                        localStorage.setItem('stakingData', stakingStr);
                        localStorage.setItem('winix_staking', stakingStr);

                        // Оновлення стейкінгу в UI
                        updateStakingDisplays();
                    }

                    // Успішне сповіщення
                    simpleAlert(`Додано ${additionalAmount.toFixed(2)} $WINIX до стейкінгу`, false);

                    // Додаткова перевірка через деякий час
                    setTimeout(async () => {
                        try {
                            const finalCheckResponse = await fetch(`/api/user/${userId}/staking`);
                            const finalCheckData = await finalCheckResponse.json();

                            if (finalCheckData.status === 'success' && finalCheckData.data?.hasActiveStaking) {
                                console.log("🔄 Остаточна перевірка стейкінгу:", finalCheckData.data);

                                // Додаткове оновлення локального стану
                                localStorage.setItem('stakingData', JSON.stringify(finalCheckData.data));
                                localStorage.setItem('winix_staking', JSON.stringify(finalCheckData.data));

                                updateStakingDisplays();
                            }
                        } catch (checkError) {
                            console.error("Помилка фінальної перевірки стейкінгу:", checkError);
                        }
                    }, 2000);

                } catch (error) {
                    console.error("Помилка при додаванні до стейкінгу:", error);
                    simpleAlert(error.message || "Сталася помилка. Спробуйте ще раз.", true);
                } finally {
                    // Приховуємо індикатор завантаження
                    if (spinner) spinner.classList.remove('show');
                    buttons.forEach(btn => btn.disabled = false);
                    isProcessingStakingAction = false;
                }
            });
        } catch (error) {
            console.error("Критична помилка при обробці додавання до стейкінгу:", error);
            simpleAlert("Сталася критична помилка. Спробуйте ще раз.", true);
            isProcessingStakingAction = false;
        }
    }

    // Допоміжні функції для оновлення UI
    function updateBalanceDisplays(balance) {
        const balanceElements = document.querySelectorAll('#user-tokens, #main-balance, .balance-amount, #current-balance, .balance-value');
        balanceElements.forEach(element => {
            if (element) {
                if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                    element.innerHTML = `${balance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                } else {
                    element.textContent = balance.toFixed(2);
                }
            }
        });

        // Виклик глобальних методів оновлення, якщо вони існують
        if (window.WinixCore && window.WinixCore.UI) {
            window.WinixCore.UI.updateBalanceDisplay();
        } else if (typeof updateBalanceDisplay === 'function') {
            updateBalanceDisplay();
        }
    }

    function updateStakingDisplays() {
        if (window.WinixCore && window.WinixCore.UI) {
            window.WinixCore.UI.updateStakingDisplay();
        } else if (typeof updateStakingDisplay === 'function') {
            updateStakingDisplay();
        }
    }

    /**
     * Оновлення відображення балансу на сторінці
     */
    function updateBalanceDisplay() {
        try {
            // Отримуємо поточний баланс з локального сховища
            const tokens = parseFloat(localStorage.getItem('userTokens') || '0');
            const coins = parseFloat(localStorage.getItem('userCoins') || '0');

            console.log(`🔄 Оновлення відображення балансу: ${tokens.toFixed(2)} WINIX, ${coins} жетонів`);

            // Оновлюємо всі елементи, які показують баланс токенів
            const tokenSelectors = [
                '#user-tokens',
                '#main-balance',
                '.balance-amount',
                '#current-balance',
                '.balance-value'
            ];

            tokenSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        // Якщо елемент має спеціальну розмітку для іконки, зберігаємо її
                        if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                            element.innerHTML = `${tokens.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                        } else {
                            element.textContent = tokens.toFixed(2);
                        }
                    }
                });
            });

            // Оновлюємо відображення жетонів
            const coinsSelectors = [
                '#user-coins',
                '.coins-amount',
                '.coins-value'
            ];

            coinsSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        element.textContent = coins.toFixed(0);
                    }
                });
            });
        } catch (e) {
            console.error('Помилка оновлення відображення балансу:', e);
        }
    }

    /**
     * Оновлення відображення стейкінгу на сторінці
     */
    function updateStakingDisplay() {
        try {
            // Отримуємо дані стейкінгу з локального сховища
            const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
            if (!stakingDataStr) {
                console.log("Немає даних стейкінгу для відображення");

                // Встановлюємо статус "немає активного стейкінгу"
                const statusElement = document.getElementById('staking-status');
                if (statusElement) {
                    statusElement.textContent = "Наразі немає активних стейкінгів";
                }

                // Деактивуємо кнопки
                const detailsButton = document.getElementById('details-button');
                if (detailsButton) {
                    detailsButton.style.opacity = '0.5';
                    detailsButton.style.pointerEvents = 'none';
                }

                const cancelButton = document.getElementById('cancel-staking-button');
                if (cancelButton) {
                    cancelButton.style.opacity = '0.5';
                    cancelButton.style.pointerEvents = 'none';
                }

                return;
            }

            // Парсимо дані стейкінгу
            const stakingData = JSON.parse(stakingDataStr);
            console.log("🔄 Оновлення відображення стейкінгу:", stakingData);

            if (stakingData && stakingData.hasActiveStaking) {
                // Оновлюємо статус стейкінгу
                const statusElement = document.getElementById('staking-status');
                if (statusElement) {
                    statusElement.textContent = `У стейкінгу: ${stakingData.stakingAmount} $WINIX`;
                }

                // Активуємо кнопки
                const detailsButton = document.getElementById('details-button');
                if (detailsButton) {
                    detailsButton.style.opacity = '1';
                    detailsButton.style.pointerEvents = 'auto';
                }

                const cancelButton = document.getElementById('cancel-staking-button');
                if (cancelButton) {
                    cancelButton.style.opacity = '1';
                    cancelButton.style.pointerEvents = 'auto';
                }

                // Оновлюємо відображення деталей стейкінгу, якщо знаходимося на сторінці деталей
                if (window.location.href.includes('staking-details.html')) {
                    const amountElement = document.getElementById('staking-amount');
                    const periodElement = document.getElementById('staking-period');
                    const rewardPercentElement = document.getElementById('staking-reward-percent');
                    const expectedRewardElement = document.getElementById('staking-expected-reward');
                    const remainingDaysElement = document.getElementById('staking-remaining-days');

                    if (amountElement) amountElement.textContent = `${stakingData.stakingAmount} $WINIX`;
                    if (periodElement) periodElement.textContent = `${stakingData.period} днів`;
                    if (rewardPercentElement) rewardPercentElement.textContent = `${stakingData.rewardPercent}%`;
                    if (expectedRewardElement) expectedRewardElement.textContent = `${stakingData.expectedReward} $WINIX`;
                    if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays.toString();
                }
            } else {
                // Встановлюємо статус "немає активного стейкінгу"
                const statusElement = document.getElementById('staking-status');
                if (statusElement) {
                    statusElement.textContent = "Наразі немає активних стейкінгів";
                }

                // Деактивуємо кнопки
                const detailsButton = document.getElementById('details-button');
                if (detailsButton) {
                    detailsButton.style.opacity = '0.5';
                    detailsButton.style.pointerEvents = 'none';
                }

                const cancelButton = document.getElementById('cancel-staking-button');
                if (cancelButton) {
                    cancelButton.style.opacity = '0.5';
                    cancelButton.style.pointerEvents = 'none';
                }
            }
        } catch (e) {
            console.error('Помилка оновлення відображення стейкінгу:', e);
        }
    }

    /**
     * Обробник для кнопки "Застейкати"
     */
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
                simpleAlert("Не вдалося знайти поля для стейкінгу", true);
                isProcessingStakingAction = false;
                return;
            }

            // Валідація суми
            const amount = parseFloat(amountInput.value);
            const balance = parseFloat(localStorage.getItem('userTokens') || '0');

            // Валідація суми
            const validation = validateStakingAmount(amount, balance);
            if (!validation.isValid) {
                simpleAlert(validation.message, true);
                isProcessingStakingAction = false;
                return;
            }

            const period = parseInt(periodSelect.value);
            if (isNaN(period) || ![7, 14, 28].includes(period)) {
                simpleAlert("Виберіть коректний період стейкінгу", true);
                isProcessingStakingAction = false;
                return;
            }

            // Блокуємо кнопку
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) stakeButton.disabled = true;

            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                simpleAlert("Не вдалося визначити ID користувача", true);
                if (stakeButton) stakeButton.disabled = false;
                isProcessingStakingAction = false;
                return;
            }

            // Відправляємо запит на створення стейкінгу
            fetch(`/api/user/${userId}/staking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stakingAmount: amount,
                    period: period
                })
            })
            .then(response => response.json())
            .then(result => {
                if (stakeButton) stakeButton.disabled = false;

                if (result.status === 'success') {
                    // Оновлюємо дані в localStorage
                    if (result.data && result.data.staking) {
                        // Зберігаємо дані для доступу в офлайні
                        localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                        localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                    }

                    // Оновлюємо баланс і відображення
                    if (window.WinixCore && window.WinixCore.UI) {
                        window.WinixCore.UI.updateBalanceDisplay();
                        window.WinixCore.UI.updateStakingDisplay();
                    }

                    // Повідомлення про успіх
                    simpleAlert("Стейкінг успішно створено!", false, function() {
                        window.location.href = "staking-details.html";
                    });
                } else {
                    simpleAlert(result.message || "Помилка створення стейкінгу", true);
                }
                isProcessingStakingAction = false;
            })
            .catch(error => {
                console.error("Помилка при створенні стейкінгу:", error);
                simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                if (stakeButton) stakeButton.disabled = false;
                isProcessingStakingAction = false;
            });
        } catch (error) {
            console.error("Помилка при обробці кнопки створення стейкінгу:", error);
            simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
            isProcessingStakingAction = false;
        }
    }

    /**
     * Обробник для кнопки "Деталі стейкінгу"
     */
    function handleDetailsButton() {
        console.log("💼 Перехід до деталей стейкінгу");

        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                simpleAlert("Не вдалося визначити ID користувача", true);
                return;
            }

            // Перевіряємо наявність активного стейкінгу через API
            fetch(`/api/user/${userId}/staking`)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success' && data.data && data.data.hasActiveStaking) {
                        // Переходимо на сторінку деталей стейкінгу
                        window.location.href = "staking-details.html";
                    } else {
                        simpleAlert("У вас немає активного стейкінгу", true);
                    }
                })
                .catch(error => {
                    console.error("Помилка перевірки стейкінгу:", error);

                    // Перевіряємо кешовані дані в разі помилки мережі
                    try {
                        const stakingData = JSON.parse(localStorage.getItem('stakingData') || '{}');
                        if (stakingData && stakingData.hasActiveStaking) {
                            window.location.href = "staking-details.html";
                        } else {
                            simpleAlert("У вас немає активного стейкінгу", true);
                        }
                    } catch (e) {
                        simpleAlert("Помилка перевірки даних стейкінгу", true);
                    }
                });
        } catch (error) {
            console.error("Помилка при обробці кнопки деталей стейкінгу:", error);
            simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    // Додаємо функцію глобального доступу до модалок
    window.createInputModal = createInputModal;

    // Додаємо функцію глобального доступу до сповіщень
    window.simpleAlert = simpleAlert;

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

    // Перевірка, що сума є цілим числом
if (amount !== Math.floor(amount)) {
    return {
        isValid: false,
        message: "Сума стейкінгу має бути цілим числом"
    };
}

    console.log("✅ Систему керування кнопками стейкінгу успішно ініціалізовано");
})();