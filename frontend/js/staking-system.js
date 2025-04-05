/**
 * simple-staking-system.js
 * Спрощена система стейкінгу для WINIX
 */

(function() {
    console.log("🚀 Ініціалізація спрощеної системи стейкінгу WINIX");

    // Запобігаємо повторній ініціалізації
    if (window.WinixStakingSystem) {
        console.log("⚠️ Система стейкінгу вже ініціалізована");
        return window.WinixStakingSystem;
    }

    // Налаштування стейкінгу
    const STAKING_CONFIG = {
        minAmount: 50,
        rewardRates: {
            7: 4,  // 4% за 7 днів
            14: 9, // 9% за 14 днів
            28: 15 // 15% за 28 днів
        }
    };

    // Глобальний прапорець для запобігання одночасним запитам
    let _isProcessingStakingAction = false;

    // Функції для роботи з localStorage
    function getStorage(key, defaultValue = null, parse = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return parse ? JSON.parse(value) : value;
        } catch (e) {
            console.error(`Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    function setStorage(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            console.error(`Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    // Отримання поточного балансу користувача
    function getUserBalance() {
        const balance = parseFloat(getStorage('userTokens', '0'));
        return isNaN(balance) ? 0 : balance;
    }

    // Показ повідомлення користувачу
    function showAlert(message, isError = false, callback = null) {
        if (window.simpleAlert) {
            window.simpleAlert(message, isError, callback);
            return;
        }

        alert(message);
        if (callback) callback();
    }

    // Показати/приховати індикатор завантаження
    function showLoadingSpinner(message = "Завантаження...") {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            const loadingText = spinner.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = message;
            spinner.classList.add('show');
        }
    }

    function hideLoadingSpinner() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
    }

    // Функція для отримання поточного ID користувача
    function getUserId() {
        let userId = getStorage('telegram_user_id', '');

        // Якщо ID не знайдено в localStorage, спробуємо знайти в DOM
        if (!userId) {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userId = userIdElement.textContent.trim();
                if (userId) setStorage('telegram_user_id', userId);
            }
        }

        return userId;
    }

    /**
     * Розрахунок очікуваної винагороди
     */
    function calculateExpectedReward(amount, period) {
        try {
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || isNaN(period) || amount <= 0) {
                return 0;
            }

            const rewardPercent = STAKING_CONFIG.rewardRates[period] || 9; // За замовчуванням 9%
            const reward = (amount * rewardPercent) / 100;

            return parseFloat(reward.toFixed(2));
        } catch (e) {
            console.error('Помилка розрахунку винагороди:', e);
            return 0;
        }
    }

    /**
     * Функція створення стейкінгу
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
            // Валідація вхідних даних
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || amount <= 0) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: "Введіть коректну суму більше нуля"
                };
            }

            if (amount < STAKING_CONFIG.minAmount) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: `Мінімальна сума стейкінгу: ${STAKING_CONFIG.minAmount} WINIX`
                };
            }

            const balance = getUserBalance();
            if (amount > balance) {
                _isProcessingStakingAction = false;
                return {
                    success: false,
                    message: `Недостатньо коштів. Ваш баланс: ${balance} WINIX`
                };
            }

            // Показуємо індикатор завантаження
            showLoadingSpinner("Створення стейкінгу...");

            try {
                // Використовуємо API для створення стейкінгу
                const result = await window.WinixAPI.apiRequest(`/api/user/${getUserId()}/staking`, 'POST', {
                    stakingAmount: Math.floor(amount),
                    period: period
                });

                // Приховуємо індикатор
                hideLoadingSpinner();

                if (result.status === 'success') {
                    // Зберігаємо дані стейкінгу
                    if (result.data && result.data.staking) {
                        setStorage('stakingData', result.data.staking);
                    }

                    // Оновлюємо баланс
                    if (result.data && result.data.balance !== undefined) {
                        setStorage('userTokens', result.data.balance.toString());
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
                console.error("Помилка запиту при створенні стейкінгу:", error);
                return {
                    success: false,
                    message: "Помилка з'єднання з сервером"
                };
            }
        } catch (error) {
            console.error("Помилка створення стейкінгу:", error);
            hideLoadingSpinner();

            return {
                success: false,
                message: error.message || "Невідома помилка"
            };
        } finally {
            _isProcessingStakingAction = false;
        }
    }

    /**
     * Функція для отримання даних стейкінгу
     */
    async function getStakingData() {
        try {
            const userId = getUserId();
            if (!userId) {
                return null;
            }

            // Використовуємо API для отримання даних стейкінгу
            const result = await window.WinixAPI.apiRequest(`/api/user/${userId}/staking`, 'GET');

            if (result.status === 'success' && result.data) {
                // Зберігаємо дані в localStorage для кешування
                setStorage('stakingData', result.data);
                return result.data;
            }

            // Якщо запит не вдалий, спробуємо повернути кешовані дані
            const cachedData = getStorage('stakingData', null, true);
            return cachedData;
        } catch (error) {
            console.error("Помилка отримання даних стейкінгу:", error);
            // Повертаємо кешовані дані у випадку помилки
            return getStorage('stakingData', null, true);
        }
    }

    /**
     * Перевірка наявності активного стейкінгу
     */
    function hasActiveStaking() {
        const stakingData = getStorage('stakingData', null, true);
        return stakingData && stakingData.hasActiveStaking === true;
    }

    /**
     * Оновлення відображення стейкінгу на сторінці
     */
    async function updateStakingDisplay() {
        try {
            // Отримуємо дані стейкінгу (спочатку з кешу, потім з сервера)
            const stakingData = hasActiveStaking() ?
                getStorage('stakingData', null, true) :
                await getStakingData();

            const hasStaking = stakingData && stakingData.hasActiveStaking;

            console.log("Оновлення відображення стейкінгу:", hasStaking);

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
                const stakeButton = document.getElementById('stake-button');
                const detailsButton = document.getElementById('details-button');

                if (stakeButton) {
                    stakeButton.style.opacity = hasStaking ? '0.5' : '1';
                    stakeButton.style.pointerEvents = hasStaking ? 'none' : 'auto';
                }

                if (detailsButton) {
                    detailsButton.style.opacity = hasStaking ? '1' : '0.5';
                    detailsButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
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
                if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays || 0;

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

                // Перевіряємо, чи стейкінг завершено
                if (stakingData.remainingDays <= 0) {
                    showAlert(`Ваш стейкінг завершено! Ви отримали ${stakingData.expectedReward} $WINIX!`, false, function() {
                        window.location.href = "staking.html";
                    });
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

    /**
     * Функція для встановлення максимальної суми стейкінгу
     */
    function setMaxStakingAmount() {
        try {
            // Отримуємо поточний баланс
            const balance = getUserBalance();

            // Встановлюємо значення в поле вводу
            const amountInput = document.getElementById('staking-amount');
            if (amountInput) {
                amountInput.value = balance > 0 ? Math.floor(balance).toString() : '0';

                // Запускаємо перерахунок очікуваної винагороди
                updateExpectedReward();
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

        // Розраховуємо локально
        const reward = calculateExpectedReward(amount, period);
        rewardDisplay.textContent = reward.toFixed(2);
    }

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
            showLoadingSpinner("Створення стейкінгу...");

            // Створюємо стейкінг через основну функцію
            createStaking(amount, period)
                .then(result => {
                    // Приховуємо індикатор завантаження
                    hideLoadingSpinner();

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
                    hideLoadingSpinner();

                    console.error("Помилка при створенні стейкінгу:", error);
                    if (stakeButton) stakeButton.disabled = false;
                    showAlert("Сталася помилка. Спробуйте ще раз.", true);
                });
        } catch (error) {
            // Приховуємо індикатор завантаження
            hideLoadingSpinner();

            console.error("Помилка при обробці кнопки створення стейкінгу:", error);
            showAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    /**
     * Обробник кнопки "Деталі стейкінгу"
     */
    function handleDetailsButton() {
        console.log("📋 Перехід до деталей стейкінгу");

        try {
            // Перевіряємо наявність активного стейкінгу
            if (hasActiveStaking()) {
                window.location.href = "staking-details.html";
            } else {
                showAlert("У вас немає активного стейкінгу", true);
            }
        } catch (error) {
            console.error("Помилка при обробці кнопки деталей:", error);
            showAlert("Сталася помилка. Спробуйте ще раз.", true);
        }
    }

    // Ініціалізація системи стейкінгу на різних сторінках
    function initStakingSystem() {
        console.log("🔧 Ініціалізація системи стейкінгу");

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

            const maxButton = document.getElementById('max-button');
            if (maxButton) {
                maxButton.addEventListener('click', setMaxStakingAmount);
            }

            // Налаштовуємо поле введення суми
            setupStakingAmountInput();

            // Оновлюємо відображення стейкінгу
            updateStakingDisplay();
        }
        else if (currentPage === 'staking-details.html') {
            console.log("📋 Ініціалізація сторінки деталей стейкінгу");

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

    // Створюємо публічний API для системи стейкінгу
    window.WinixStakingSystem = {
        // Основні функції
        getStakingData,
        hasActiveStaking,
        createStaking,
        calculateExpectedReward,

        // Обробники подій для кнопок
        handleStakeButton,
        handleDetailsButton,

        // Допоміжні функції
        updateStakingDisplay,
        updateExpectedReward,
        setMaxStakingAmount,
        showAlert,

        // Конфігурація
        CONFIG: STAKING_CONFIG
    };

    // Створюємо глобальні функції для підтримки старих скриптів
    window.handleStakeButton = handleStakeButton;
    window.handleDetailsButton = handleDetailsButton;
    window.updateStakingDisplay = updateStakingDisplay;
    window.updateExpectedReward = updateExpectedReward;
    window.setMaxStakingAmount = setMaxStakingAmount;

    console.log("✅ Систему стейкінгу успішно ініціалізовано");

    return window.WinixStakingSystem;
})();