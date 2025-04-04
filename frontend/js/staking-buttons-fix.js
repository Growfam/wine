/**
 * staking-buttons-fix.js
 * Оптимізована версія системи керування кнопками стейкінгу у WINIX.
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
        input.step = '1'; // Тільки цілі числа
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
            const amount = parseInt(input.value, 10);
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
        // Перевіряємо, чи процес вже запущений
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        // Блокуємо можливість повторного кліку
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

            // Отримуємо дані стейкінгу
            fetch(`/api/user/${userId}/staking`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Помилка отримання даних стейкінгу. Статус: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Приховуємо індикатор завантаження
                    if (spinner) spinner.classList.remove('show');

                    // Перевірка відповіді
                    if (data.status !== 'success' || !data.data || !data.data.hasActiveStaking) {
                        simpleAlert("У вас немає активного стейкінгу", true);
                        isProcessingStakingAction = false;
                        return;
                    }

                    const stakingData = data.data;
                    const stakingId = stakingData.stakingId;

                    // Запитуємо підтвердження
                    if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.")) {
                        // Блокуємо всі кнопки
                        const buttons = document.querySelectorAll('button');
                        buttons.forEach(btn => { if (btn) btn.disabled = true; });

                        // Показуємо індикатор завантаження знову
                        if (spinner) spinner.classList.add('show');

                        // Відправляємо запит на скасування
                        console.log(`Відправляємо запит на скасування стейкінгу: ${stakingId}`);

                        fetch(`/api/user/${userId}/staking/${stakingId}/cancel`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                        })
                        .then(response => {
                            if (spinner) spinner.classList.remove('show');

                            if (!response.ok) {
                                throw new Error(`HTTP помилка при скасуванні! Статус: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(result => {
                            // Розблоковуємо кнопки
                            buttons.forEach(btn => { if (btn) btn.disabled = false; });

                            if (result.status === 'success') {
                                // Видаляємо дані стейкінгу з УСІХ місць локального сховища
                                localStorage.removeItem('stakingData');
                                localStorage.removeItem('winix_staking');
                                sessionStorage.removeItem('stakingData');
                                sessionStorage.removeItem('winix_staking');

                                // Оновлюємо баланс у локальному сховищі
                                if (result.data && result.data.newBalance !== undefined) {
                                    localStorage.setItem('userTokens', result.data.newBalance.toString());
                                    localStorage.setItem('winix_balance', result.data.newBalance.toString());

                                    // Також оновимо в сесії
                                    sessionStorage.setItem('userTokens', result.data.newBalance.toString());
                                    sessionStorage.setItem('winix_balance', result.data.newBalance.toString());
                                }

                                // Примусово перезавантажуємо сторінку для повного оновлення стану
                                simpleAlert(result.message || "Стейкінг успішно скасовано", false, function() {
                                    window.location.href = "wallet.html";
                                });
                            } else {
                                simpleAlert(result.message || "Помилка скасування стейкінгу", true);
                                isProcessingStakingAction = false;
                            }
                        })
                        .catch(error => {
                            console.error("Помилка при скасуванні стейкінгу:", error);
                            if (spinner) spinner.classList.remove('show');
                            buttons.forEach(btn => { if (btn) btn.disabled = false; });
                            simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                            isProcessingStakingAction = false;
                        });
                    } else {
                        // Користувач скасував дію
                        isProcessingStakingAction = false;
                    }
                })
                .catch(error => {
                    console.error("Помилка при перевірці стейкінгу:", error);
                    if (spinner) spinner.classList.remove('show');
                    simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                    isProcessingStakingAction = false;
                });
        } catch (generalError) {
            console.error("Загальна помилка при скасуванні стейкінгу:", generalError);
            isProcessingStakingAction = false;
            simpleAlert("Сталася помилка. Спробуйте пізніше.", true);
        }
    }

    /**
     * Обробник для кнопки додавання до стейкінгу без власної логіки валідації
     */
    function handleAddToStakeButton() {
        // Запобігаємо паралельним діям
        if (isProcessingStakingAction) {
            console.log("🚫 Дія стейкінгу вже обробляється");
            return;
        }

        // Блокуємо можливість повторного кліку
        isProcessingStakingAction = true;
        console.log("💼 Підготовка до додавання токенів до стейкінгу");

        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                simpleAlert("Не вдалося визначити ID користувача", true);
                isProcessingStakingAction = false;
                return;
            }

            // Показуємо модальне вікно для введення суми
            createInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
                // Підготовка UI
                const spinner = document.getElementById('loading-spinner');
                const buttons = document.querySelectorAll('button');
                buttons.forEach(btn => { if (btn) btn.disabled = true; });
                if (spinner) spinner.classList.add('show');

                // Перевірка активного стейкінгу
                fetch(`/api/user/${userId}/staking`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Помилка отримання даних стейкінгу. Статус: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(stakingData => {
                        // Перевірка на наявність активного стейкінгу (виправлена логіка!)
                        if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                            throw new Error("Немає активного стейкінгу");
                        }

                        const stakingId = stakingData.data.stakingId;
                        console.log(`Знайдено активний стейкінг з ID: ${stakingId}, додаємо ${amount} WINIX`);

                        // Додавання до стейкінгу через API
                        return fetch(`/api/user/${userId}/staking/${stakingId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ additionalAmount: Math.floor(amount) })
                        });
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP помилка: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(result => {
                        if (spinner) spinner.classList.remove('show');
                        buttons.forEach(btn => { if (btn) btn.disabled = false; });

                        if (result.status === 'success') {
                            // Оновлюємо локальні дані
                            if (result.data.balance !== undefined) {
                                localStorage.setItem('userTokens', result.data.balance.toString());
                                localStorage.setItem('winix_balance', result.data.balance.toString());

                                // Також оновимо в сесії
                                sessionStorage.setItem('userTokens', result.data.balance.toString());
                                sessionStorage.setItem('winix_balance', result.data.balance.toString());
                            }

                            if (result.data.staking) {
                                localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                                localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));

                                // Також оновимо в сесії
                                sessionStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                                sessionStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                            }

                            // Примусово перезавантажуємо сторінку для повного оновлення стану
                            simpleAlert(`Додано ${amount} $WINIX до стейкінгу`, false, function() {
                                window.location.reload();
                            });
                        } else {
                            simpleAlert(result.message || "Помилка додавання до стейкінгу", true);
                        }

                        isProcessingStakingAction = false;
                    })
                    .catch(error => {
                        console.error("Помилка при додаванні до стейкінгу:", error);
                        if (spinner) spinner.classList.remove('show');
                        buttons.forEach(btn => { if (btn) btn.disabled = false; });
                        simpleAlert(error.message || "Сталася помилка. Спробуйте ще раз.", true);
                        isProcessingStakingAction = false;
                    });
            });
        } catch (generalError) {
            console.error("Загальна помилка при додаванні до стейкінгу:", generalError);
            isProcessingStakingAction = false;
            simpleAlert("Сталася помилка. Спробуйте пізніше.", true);
        }
    }

    /**
     * Обробник для кнопки "Застейкати" - всі перевірки та розрахунки на бекенді
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

            // Отримуємо значення без власної валідації
            const amount = parseInt(amountInput.value, 10);
            const period = parseInt(periodSelect.value, 10);

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

            // Відправляємо запит на створення стейкінгу (всю валідацію робить сервер)
            fetch(`/api/user/${userId}/staking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stakingAmount: amount,
                    period: period
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP помилка: ${response.status}`);
                }
                return response.json();
            })
            .then(result => {
                if (stakeButton) stakeButton.disabled = false;

                if (result.status === 'success') {
                    // Оновлюємо дані в localStorage
                    if (result.data && result.data.staking) {
                        // Зберігаємо дані для доступу в офлайні
                        localStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                        localStorage.setItem('winix_staking', JSON.stringify(result.data.staking));

                        // Також оновимо в сесії
                        sessionStorage.setItem('stakingData', JSON.stringify(result.data.staking));
                        sessionStorage.setItem('winix_staking', JSON.stringify(result.data.staking));
                    }

                    // Оновлюємо баланс
                    if (result.data && result.data.balance !== undefined) {
                        localStorage.setItem('userTokens', result.data.balance.toString());
                        localStorage.setItem('winix_balance', result.data.balance.toString());

                        // Також оновимо в сесії
                        sessionStorage.setItem('userTokens', result.data.balance.toString());
                        sessionStorage.setItem('winix_balance', result.data.balance.toString());
                    }

                    // Оновлюємо відображення
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
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Помилка отримання даних стейкінгу. Статус: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'success' && data.data && data.data.hasActiveStaking) {
                        // Зберігаємо дані для доступу на сторінці деталей
                        localStorage.setItem('stakingData', JSON.stringify(data.data));
                        localStorage.setItem('winix_staking', JSON.stringify(data.data));

                        // Також оновимо в сесії
                        sessionStorage.setItem('stakingData', JSON.stringify(data.data));
                        sessionStorage.setItem('winix_staking', JSON.stringify(data.data));

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

    /**
     * Функція для розрахунку очікуваної винагороди від сервера
     */
    function updateExpectedReward() {
        // Отримуємо значення як числа
        const amountInput = document.getElementById('staking-amount');
        const periodSelect = document.getElementById('staking-period');
        const rewardDisplay = document.getElementById('expected-reward');

        if (!amountInput || !periodSelect || !rewardDisplay) return;

        // Перетворюємо на ціле число, використовуючи parseInt з основою 10
        const amount = parseInt(amountInput.value, 10) || 0;
        const period = parseInt(periodSelect.value, 10) || 14;

        if (amount <= 0) {
            rewardDisplay.textContent = '0.00';
            return;
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            console.error("Не вдалося визначити ID користувача для розрахунку винагороди");
            // Використовуємо резервний розрахунок
            let rewardPercent;
            switch(period) {
                case 7: rewardPercent = 4; break;
                case 14: rewardPercent = 9; break;
                case 28: rewardPercent = 15; break;
                default: rewardPercent = 9;
            }
            const reward = (amount * rewardPercent) / 100;
            rewardDisplay.textContent = reward.toFixed(2);
            return;
        }

        // Використовуємо API для точного розрахунку
        fetch(`/api/user/${userId}/staking/calculate-reward?amount=${amount}&period=${period}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Помилка отримання даних з сервера');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success' && data.data) {
                    // Виводимо з фіксованою точністю
                    rewardDisplay.textContent = parseFloat(data.data.reward).toFixed(2);
                } else {
                    // Якщо помилка API, використовуємо власний розрахунок
                    let rewardPercent;
                    switch(period) {
                        case 7: rewardPercent = 4; break;
                        case 14: rewardPercent = 9; break;
                        case 28: rewardPercent = 15; break;
                        default: rewardPercent = 9;
                    }

                    const reward = (amount * rewardPercent) / 100;
                    rewardDisplay.textContent = reward.toFixed(2);
                }
            })
            .catch(error => {
                console.error('Помилка розрахунку винагороди:', error);

                // Резервний розрахунок
                let rewardPercent;
                switch(period) {
                    case 7: rewardPercent = 4; break;
                    case 14: rewardPercent = 9; break;
                    case 28: rewardPercent = 15; break;
                    default: rewardPercent = 9;
                }

                const reward = (amount * rewardPercent) / 100;
                rewardDisplay.textContent = reward.toFixed(2);
            });
    }

    /**
     * Функція для налаштування поля введення суми та розрахунку винагороди
     */
    function setupStakingAmountInput() {
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
    }

    // Оновлення виду кнопок стейкінгу (активація/деактивація)
    function updateStakingButtons() {
        try {
            const hasActiveStaking = localStorage.getItem('stakingData') ?
                JSON.parse(localStorage.getItem('stakingData')).hasActiveStaking : false;

            // Кнопки деталей та скасування
            const detailsButton = document.getElementById('details-button');
            const cancelButton = document.getElementById('cancel-staking-button');

            if (detailsButton) {
                detailsButton.style.opacity = hasActiveStaking ? '1' : '0.5';
                detailsButton.style.pointerEvents = hasActiveStaking ? 'auto' : 'none';
            }

            if (cancelButton) {
                cancelButton.style.opacity = hasActiveStaking ? '1' : '0.5';
                cancelButton.style.pointerEvents = hasActiveStaking ? 'auto' : 'none';
            }

            // Статус стейкінгу
            const statusElement = document.getElementById('staking-status');
            if (statusElement) {
                if (hasActiveStaking) {
                    const stakingData = JSON.parse(localStorage.getItem('stakingData'));
                    statusElement.textContent = `У стейкінгу: ${stakingData.stakingAmount} $WINIX`;
                } else {
                    statusElement.textContent = "Наразі немає активних стейкінгів";
                }
            }
        } catch (e) {
            console.error("Помилка оновлення кнопок стейкінгу:", e);
        }
    }

    // Додаємо функцію глобального доступу до модалок
    window.createInputModal = createInputModal;

    // Додаємо функцію глобального доступу до сповіщень
    window.simpleAlert = simpleAlert;

    // Налаштовуємо поле введення суми при завантаженні
    document.addEventListener('DOMContentLoaded', function() {
        setupStakingAmountInput();
        updateStakingButtons();
    });

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
        setupDetailsButton: function() { setupCleanButton('details-button', handleDetailsButton); },
        updateExpectedReward: updateExpectedReward
    };

    console.log("✅ Систему керування кнопками стейкінгу успішно ініціалізовано");
})();