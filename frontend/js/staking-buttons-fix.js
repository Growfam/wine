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
     * Обробник для кнопки додавання до стейкінгу
     */
   /**
 * Обробник для кнопки скасування стейкінгу
 */
function handleCancelStakingButton() {
    // Запобігаємо повторному відкриттю
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

        // Показуємо індикатор завантаження, якщо він є
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

                    // Відправляємо запит на скасування стейкінгу
                    console.log("Відправляємо запит на скасування стейкінгу:", data.data.stakingId);

                    fetch(`/api/user/${userId}/staking/${data.data.stakingId}/cancel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}) // Важливо! Передаємо пустий об'єкт замість всіх даних стейкінгу
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

                            // Оновлюємо відображення
                            if (window.WinixCore && window.WinixCore.UI) {
                                window.WinixCore.UI.updateBalanceDisplay();
                                window.WinixCore.UI.updateStakingDisplay();
                            }

                            // Показуємо повідомлення про успіх
                            simpleAlert(result.message || "Стейкінг успішно скасовано", false, function() {
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
 * Обробник для кнопки додавання до стейкінгу
 */
function handleAddToStakeButton() {
    // Запобігаємо повторному відкриттю
    if (isProcessingStakingAction) {
        console.log("🚫 Дія стейкінгу вже обробляється");
        return;
    }

    isProcessingStakingAction = true;
    console.log("💼 Виклик модального вікна для додавання до стейкінгу");

    try {
        createInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
            console.log(`💼 Отримано суму для додавання: ${amount}`);

            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                simpleAlert("Не вдалося визначити ID користувача", true);
                isProcessingStakingAction = false;
                return;
            }

            // Показуємо індикатор завантаження, якщо він є
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
                    if (data.status !== 'success' || !data.data || !data.data.hasActiveStaking) {
                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        simpleAlert("У вас немає активного стейкінгу", true);
                        isProcessingStakingAction = false;
                        return;
                    }

                    // Блокуємо всі кнопки стейкінгу
                    const buttons = document.querySelectorAll('#stake-button, #cancel-staking-button, #add-to-stake-button');
                    buttons.forEach(btn => {
                        if (btn) btn.disabled = true;
                    });

                    // Відправляємо запит на додавання до стейкінгу
                    console.log("Відправляємо запит на додавання до стейкінгу:", data.data.stakingId);

                    fetch(`/api/user/${userId}/staking/${data.data.stakingId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            additionalAmount: amount
                        })
                    })
                    .then(response => {
                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        if (!response.ok) {
                            throw new Error(`HTTP помилка при додаванні! Статус: ${response.status}`);
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
                            // Оновлюємо локальні дані
                            if (result.data && result.data.staking) {
                                // Зберігаємо дані для доступу в офлайні
                                const stakingStr = JSON.stringify(result.data.staking);
                                localStorage.setItem('stakingData', stakingStr);
                                localStorage.setItem('winix_staking', stakingStr);

                                // Додатково зберігаємо оновлений баланс
                                if (result.data.balance !== undefined) {
                                    localStorage.setItem('userTokens', result.data.balance.toString());
                                    localStorage.setItem('winix_balance', result.data.balance.toString());
                                }
                            }

                            // Оновлюємо відображення
                            if (window.WinixCore && window.WinixCore.UI) {
                                window.WinixCore.UI.updateBalanceDisplay();
                                window.WinixCore.UI.updateStakingDisplay();
                            }

                            simpleAlert(`Додано ${amount.toFixed(2)} $WINIX до стейкінгу`, false);
                        } else {
                            simpleAlert(result.message || "Помилка додавання до стейкінгу", true);
                        }
                    })
                    .catch(error => {
                        console.error("Помилка при додаванні до стейкінгу:", error);

                        // Приховуємо індикатор завантаження
                        if (spinner) spinner.classList.remove('show');

                        // Розблоковуємо кнопки
                        buttons.forEach(btn => {
                            if (btn) btn.disabled = false;
                        });

                        simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                        isProcessingStakingAction = false;
                    });
                })
                .catch(error => {
                    console.error("Помилка при перевірці стейкінгу:", error);

                    // Приховуємо індикатор завантаження
                    if (spinner) spinner.classList.remove('show');

                    simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
                    isProcessingStakingAction = false;
                });
        });
    } catch (error) {
        console.error("Помилка при обробці кнопки додавання до стейкінгу:", error);
        simpleAlert("Сталася помилка. Спробуйте ще раз.", true);
    } finally {
        // Скидаємо прапорець блокування через невеликий проміжок часу
        setTimeout(function() {
            isProcessingStakingAction = false;
        }, 500);
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

            const amount = parseFloat(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                simpleAlert("Введіть коректну суму", true);
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

    console.log("✅ Систему керування кнопками стейкінгу успішно ініціалізовано");
})();