/**
 * staking.js
 *
 * Єдиний модуль для управління функціональністю стейкінгу WINIX.
 * Забезпечує інтерфейс для створення, додавання коштів, скасування стейкінгу та
 * оновлення відображення на сторінці.
 */

(function() {
    'use strict';

    console.log("🔄 Ініціалізація модуля стейкінгу...");

    // Перевіряємо наявність залежностей
    if (!window.WinixAPI) {
        console.warn("⚠️ Модуль WinixAPI не знайдено! Деякі функції будуть обмежені");
    }

    // Запобігання повторній ініціалізації
    if (window.WinixStakingSystem && window.WinixStakingSystemInitialized) {
        console.log("ℹ️ Модуль стейкінгу вже ініціалізовано");
        return;
    }

    // ======== КОНСТАНТИ ========

    // Конфігурація системи стейкінгу
    const CONFIG = {
        minAmount: 50,                 // Мінімальна сума стейкінгу
        maxBalancePercentage: 0.9,     // Максимально дозволений відсоток від балансу
        allowedPeriods: [7, 14, 28],   // Дозволені періоди стейкінгу
        rewardRates: {
            7: 4,    // 4% за 7 днів
            14: 9,   // 9% за 14 днів
            28: 15   // 15% за 28 днів
        },
        cancellationFee: 0.2,          // Штраф при скасуванні (20%)
        refreshInterval: 300000        // Інтервал автоматичного оновлення даних (5 хвилин)
    };

    // ID DOM елементів стейкінгу
    const DOM = {
        amountInput: 'staking-amount',
        periodSelect: 'staking-period',
        expectedReward: 'expected-reward',
        stakingStatus: 'staking-status',
        activeStakingButton: 'active-staking-button',
        cancelStakingButton: 'cancel-staking-button',
        stakeButton: 'stake-button',
        maxButton: 'max-button',

        // Елементи модального вікна
        modal: 'staking-modal',
        modalClose: 'modal-close',
        modalStakingAmount: 'modal-staking-amount',
        modalStakingPeriod: 'modal-staking-period',
        modalRewardPercent: 'modal-staking-reward-percent',
        modalExpectedReward: 'modal-staking-expected-reward',
        modalRemainingDays: 'modal-staking-remaining-days',
        modalAddButton: 'modal-add-to-stake-button',
        modalCancelButton: 'modal-cancel-staking-button'
    };

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Зберігає поточні дані стейкінгу
    let _currentStakingData = null;

    // Прапорці для запобігання одночасним запитам
    let _isProcessingRequest = false;
    let _isUpdatingDisplay = false;

    // Таймер для періодичного оновлення даних
    let _refreshTimer = null;

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM за ID
     * @param {string} id - ID елемента
     * @returns {HTMLElement} Елемент DOM або null
     */
    function getElement(id) {
        return document.getElementById(id);
    }

    /**
     * Перевірка валідності ID
     * @param {any} id - ID для перевірки
     * @returns {boolean} Чи ID валідний
     */
    function isValidId(id) {
        return id &&
               id !== 'undefined' &&
               id !== 'null' &&
               id !== undefined &&
               id !== null &&
               id.toString().trim() !== '';
    }

    /**
     * Показати повідомлення користувачу
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи є повідомлення помилкою
     * @param {Function} callback - Функція, яка викликається після закриття повідомлення
     */
    function showMessage(message, isError = false, callback = null) {
        // Запобігаємо показу порожніх повідомлень
        if (!message || message.trim() === '') {
            console.warn("Спроба показати порожнє повідомлення");
            if (callback) setTimeout(callback, 100);
            return;
        }

        try {
            // Спочатку перевіряємо наявність глобальних функцій
            if (window.showToast) {
                window.showToast(message, isError ? 'error' : 'success');
                if (callback) setTimeout(callback, 1500);
                return;
            }

            if (window.simpleAlert) {
                window.simpleAlert(message, isError, callback);
                return;
            }

            // Як останній варіант використовуємо стандартний alert
            alert(message);
            if (callback) callback();
        } catch (e) {
            console.error("Помилка при показі повідомлення:", e);
            alert(message);
            if (callback) callback();
        }
    }

    /**
     * Отримання поточного балансу користувача
     * @returns {number} Баланс користувача
     */
    function getBalance() {
        try {
            // Спочатку перевіряємо глобальні змінні
            if (window.WinixCore && typeof window.WinixCore.getBalance === 'function') {
                return window.WinixCore.getBalance();
            }

            // Потім перевіряємо WinixCore.Balance
            if (window.WinixCore && window.WinixCore.Balance && typeof window.WinixCore.Balance.getTokens === 'function') {
                return window.WinixCore.Balance.getTokens();
            }

            // Потім перевіряємо localStorage
            const balanceStr = localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0';
            const balance = parseFloat(balanceStr);
            return isNaN(balance) ? 0 : balance;
        } catch (e) {
            console.error('Помилка отримання балансу:', e);
            return 0;
        }
    }

    /**
 * Оновлення інтерфейсу після зміни даних стейкінгу
 * @param {boolean} forceRefresh - Примусово оновити дані з сервера
 */
async function updateUI(forceRefresh = false) {
    // Запобігання рекурсивним викликам
    if (_isUpdatingDisplay) {
        console.warn("Вже виконується оновлення інтерфейсу стейкінгу");
        return;
    }

    _isUpdatingDisplay = true;

    try {
        // Якщо потрібно, оновлюємо дані з сервера
        if (forceRefresh) {
            try {
                await fetchStakingData(true);
            } catch (error) {
                console.warn("Помилка оновлення даних стейкінгу:", error);
                // Продовжуємо з наявними даними
            }
        }

        const hasActiveStaking = _currentStakingData && _currentStakingData.hasActiveStaking;

        // Оновлення статусу стейкінгу
        const statusElement = getElement(DOM.stakingStatus);
        if (statusElement) {
            if (hasActiveStaking) {
                // Додаємо анімацію для привернення уваги
                statusElement.style.transition = 'all 0.3s ease';
                statusElement.style.color = '#4DB6AC';
                statusElement.style.fontWeight = 'bold';
                statusElement.textContent = `У стейкінгу: ${_currentStakingData.stakingAmount} $WINIX`;

                // Додаємо інформацію про очікувану винагороду
                if (_currentStakingData.expectedReward) {
                    statusElement.textContent += ` | Винагорода: ${_currentStakingData.expectedReward} $WINIX`;
                }

                // Додаємо інформацію про залишок днів
                if (_currentStakingData.remainingDays !== undefined) {
                    statusElement.textContent += ` | Залишилось: ${_currentStakingData.remainingDays} дн.`;
                }

                // Повертаємо початковий стиль через певний час
                setTimeout(() => {
                    statusElement.style.color = '';
                    statusElement.style.fontWeight = '';
                }, 2000);
            } else {
                statusElement.style.color = '';
                statusElement.style.fontWeight = '';
                statusElement.textContent = "Наразі немає активних стейкінгів";
            }
        }

        // Оновлюємо активність кнопок
        updateButtonsState(hasActiveStaking);

        // Оновлюємо введення даних стейкінгу, якщо немає активного стейкінгу
        if (!hasActiveStaking) {
            const amountInput = getElement(DOM.amountInput);
            const periodSelect = getElement(DOM.periodSelect);
            const expectedReward = getElement(DOM.expectedReward);

            if (amountInput && periodSelect && expectedReward) {
                // Скидаємо введені значення
                amountInput.value = '';

                // Встановлюємо значення селекта за замовчуванням
                periodSelect.value = '14'; // Або інше значення за замовчуванням

                // Оновлюємо очікувану винагороду
                calculateExpectedReward(0, parseInt(periodSelect.value))
                    .then(reward => {
                        expectedReward.textContent = reward.toFixed(2);
                    })
                    .catch(error => {
                        console.error("Помилка розрахунку очікуваної винагороди:", error);
                        expectedReward.textContent = '0.00';
                    });
            }
        }

        // Викликаємо глобальну подію оновлення стейкінгу з більш детальними даними
        document.dispatchEvent(new CustomEvent('staking-updated', {
            detail: {
                stakingData: _currentStakingData,
                hasActiveStaking: hasActiveStaking,
                timestamp: new Date().toISOString()
            }
        }));

        // Викликаємо додаткові функції оновлення, якщо вони є
        if (window.updateStakingButtons && typeof window.updateStakingButtons === 'function') {
            window.updateStakingButtons();
        }

        // Якщо є функція оновлення балансу, викликаємо її
        if (window.updateBalanceDisplay && typeof window.updateBalanceDisplay === 'function') {
            window.updateBalanceDisplay();
        }
    } catch (e) {
        console.error('Помилка оновлення інтерфейсу стейкінгу:', e);
    } finally {
        _isUpdatingDisplay = false;
    }
}

    /**
     * Оновлення стану кнопок залежно від наявності активного стейкінгу
     * @param {boolean} hasActiveStaking - Чи є активний стейкінг
     */
    function updateButtonsState(hasActiveStaking) {
        try {
            // Кнопка "Активний стейкінг"
            const activeStakingButton = getElement(DOM.activeStakingButton);
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
            const cancelStakingButton = getElement(DOM.cancelStakingButton);
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
        } catch (e) {
            console.error('Помилка оновлення стану кнопок:', e);
        }
    }

    // ======== ОСНОВНІ ФУНКЦІЇ СТЕЙКІНГУ ========

    /**
 * Отримання даних стейкінгу з сервера з оптимізацією кешування
 * @param {boolean} silent - Чи потрібно приховувати індикатор завантаження
 * @param {boolean} forceRefresh - Примусово оновити дані (ігнорує кеш)
 * @returns {Promise<Object>} Дані стейкінгу
 */
async function fetchStakingData(silent = false, forceRefresh = false) {
    try {
        // Перевірка кешу
        const now = Date.now();
        const cacheTime = parseInt(localStorage.getItem('stakingDataCacheTime') || '0');
        const cacheTTL = 30000; // 30 секунд

        if (!forceRefresh && _currentStakingData && (now - cacheTime < cacheTTL)) {
            console.log("Використовуємо кешовані дані стейкінгу");
            return _currentStakingData;
        }

        // Перевірка наявності API та ID користувача
        if (!window.WinixAPI || !window.WinixAPI.getStakingData) {
            throw new Error("API модуль не знайдено");
        }

        // Отримуємо ID користувача
        const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;

        if (!isValidId(userId)) {
            throw new Error("ID користувача не знайдено");
        }

        // Показуємо індикатор завантаження, якщо не silent режим
        if (!silent) {
            if (typeof showLoading === 'function') {
                showLoading();
            } else {
                showLoader();
            }
        }

        // Відправляємо запит з обмеженням часу очікування
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Таймаут запиту даних стейкінгу')), 10000);
        });

        const fetchPromise = window.WinixAPI.getStakingData();
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // Приховуємо індикатор завантаження
        if (!silent) {
            if (typeof hideLoading === 'function') {
                hideLoading();
            } else {
                hideLoader();
            }
        }

        if (response.status === 'success' && response.data) {
            // Зберігаємо дані стейкінгу
            _currentStakingData = response.data;

            // Оновлюємо кеш
            localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
            localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));
            localStorage.setItem('stakingDataCacheTime', now.toString());

            // Оновлюємо інтерфейс
            updateUI();

            return _currentStakingData;
        } else {
            throw new Error(response.message || 'Не вдалося отримати дані стейкінгу');
        }
    } catch (error) {
        // Приховуємо індикатор завантаження
        if (!silent) {
            if (typeof hideLoading === 'function') {
                hideLoading();
            } else {
                hideLoader();
            }
        }

        console.warn('Помилка отримання даних стейкінгу:', error);

        // Якщо запит не silent, показуємо помилку лише для серйозних проблем
        if (!silent && error.message !== 'Таймаут запиту даних стейкінгу') {
            showMessage('Не вдалося отримати дані стейкінгу. ' + error.message, true);
        }

        // Намагаємося отримати дані з localStorage
        try {
            const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
            if (stakingDataStr) {
                _currentStakingData = JSON.parse(stakingDataStr);
                updateUI();
                return _currentStakingData;
            }
        } catch (localError) {
            console.error('Помилка отримання даних стейкінгу з localStorage:', localError);
        }

        // Якщо не вдалося отримати дані ні з сервера, ні з localStorage
        _currentStakingData = {
            hasActiveStaking: false,
            stakingAmount: 0,
            period: 0,
            rewardPercent: 0,
            expectedReward: 0,
            remainingDays: 0
        };

        updateUI();
        return _currentStakingData;
    }
}

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу (7, 14, 28 днів)
     * @returns {Promise<Object>} Результат операції
     */
    async function createStaking(amount, period) {
        if (_isProcessingRequest) {
            showMessage('Зачекайте, виконується попередній запит', true);
            return { success: false, message: 'Вже виконується запит' };
        }

        _isProcessingRequest = true;

        try {
            // Валідація параметрів
            amount = parseInt(amount);
            period = parseInt(period);

            if (isNaN(amount) || amount < CONFIG.minAmount) {
                throw new Error(`Мінімальна сума стейкінгу: ${CONFIG.minAmount} WINIX`);
            }

            if (!CONFIG.allowedPeriods.includes(period)) {
                throw new Error(`Дозволені періоди стейкінгу: ${CONFIG.allowedPeriods.join(', ')} днів`);
            }

            const balance = getBalance();
            if (amount > balance) {
                throw new Error(`Недостатньо коштів. Ваш баланс: ${balance} WINIX`);
            }

            const maxAllowedAmount = Math.floor(balance * CONFIG.maxBalancePercentage);
            if (amount > maxAllowedAmount) {
                throw new Error(`Максимальна сума: ${maxAllowedAmount} WINIX (${Math.round(CONFIG.maxBalancePercentage * 100)}% від балансу)`);
            }

            // Перевірка наявності API та ID користувача
            if (!window.WinixAPI || !window.WinixAPI.createStaking) {
                throw new Error("API модуль не знайдено");
            }

            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;

            if (!isValidId(userId)) {
                throw new Error("ID користувача не знайдено");
            }

            // Створюємо стейкінг через API
            const response = await window.WinixAPI.createStaking(amount, period);

            if (response.status !== 'success') {
                throw new Error(response.message || 'Помилка створення стейкінгу');
            }

            // Оновлюємо дані стейкінгу
            if (response.data && response.data.staking) {
                _currentStakingData = response.data.staking;

                // Оновлюємо localStorage
                localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));

                // Оновлюємо баланс, якщо він є в відповіді
                if (response.data.balance !== undefined) {
                    localStorage.setItem('userTokens', response.data.balance.toString());
                    localStorage.setItem('winix_balance', response.data.balance.toString());

                    // Додатково викликаємо оновлення балансу, якщо є така функція
                    if (window.WinixCore && window.WinixCore.updateBalanceDisplay) {
                        window.WinixCore.updateBalanceDisplay();
                    } else if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.updateBalanceDisplay) {
                        window.WinixCore.UI.updateBalanceDisplay();
                    }
                }

                // Оновлюємо інтерфейс
                updateUI();

                // Показуємо повідомлення про успіх
                showMessage('Стейкінг успішно створено');

                return {
                    success: true,
                    data: response.data,
                    message: 'Стейкінг успішно створено'
                };
            } else {
                throw new Error('Відповідь сервера не містить даних стейкінгу');
            }
        } catch (error) {
            console.error('Помилка створення стейкінгу:', error);
            showMessage(error.message || 'Помилка створення стейкінгу', true);

            return {
                success: false,
                message: error.message || 'Помилка створення стейкінгу'
            };
        } finally {
            _isProcessingRequest = false;
        }
    }

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {number} amount - Сума для додавання
     * @returns {Promise<Object>} Результат операції
     */
    async function addToStaking(amount) {
        if (_isProcessingRequest) {
            showMessage('Зачекайте, виконується попередній запит', true);
            return { success: false, message: 'Вже виконується запит' };
        }

        _isProcessingRequest = true;

        try {
            // Перевіряємо наявність активного стейкінгу
            if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                // Спробуємо оновити дані стейкінгу
                await fetchStakingData(true);

                if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                    throw new Error('У вас немає активного стейкінгу');
                }
            }

            // Валідація суми
            amount = parseInt(amount);

            if (isNaN(amount) || amount <= 0) {
                throw new Error('Сума має бути додатним цілим числом');
            }

            const balance = getBalance();
            if (amount > balance) {
                throw new Error(`Недостатньо коштів. Ваш баланс: ${balance} WINIX`);
            }

            // Перевірка наявності API та ID користувача
            if (!window.WinixAPI || !window.WinixAPI.addToStaking) {
                throw new Error("API модуль не знайдено");
            }

            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;

            if (!isValidId(userId)) {
                throw new Error("ID користувача не знайдено");
            }

            // Додаємо кошти до стейкінгу через API
            const response = await window.WinixAPI.addToStaking(amount, _currentStakingData.stakingId);

            if (response.status !== 'success') {
                throw new Error(response.message || 'Помилка додавання коштів до стейкінгу');
            }

            // Оновлюємо дані стейкінгу
            if (response.data && response.data.staking) {
                _currentStakingData = response.data.staking;

                // Оновлюємо localStorage
                localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));

                // Оновлюємо баланс, якщо він є в відповіді
                if (response.data.balance !== undefined) {
                    localStorage.setItem('userTokens', response.data.balance.toString());
                    localStorage.setItem('winix_balance', response.data.balance.toString());

                    // Додатково викликаємо оновлення балансу, якщо є така функція
                    if (window.WinixCore && window.WinixCore.updateBalanceDisplay) {
                        window.WinixCore.updateBalanceDisplay();
                    } else if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.updateBalanceDisplay) {
                        window.WinixCore.UI.updateBalanceDisplay();
                    }
                }

                // Оновлюємо інтерфейс
                updateUI();

                // Показуємо повідомлення про успіх
                showMessage(`Додано ${amount} WINIX до стейкінгу`);

                return {
                    success: true,
                    data: response.data,
                    message: `Додано ${amount} WINIX до стейкінгу`
                };
            } else {
                throw new Error('Відповідь сервера не містить даних стейкінгу');
            }
        } catch (error) {
            console.error('Помилка додавання коштів до стейкінгу:', error);
            showMessage(error.message || 'Помилка додавання коштів до стейкінгу', true);

            return {
                success: false,
                message: error.message || 'Помилка додавання коштів до стейкінгу'
            };
        } finally {
            _isProcessingRequest = false;
        }
    }

    /**
     * Скасування стейкінгу
     * @returns {Promise<Object>} Результат операції
     */
    async function cancelStaking(skipConfirmation = false) {
    if (_isProcessingRequest) {
        showMessage('Зачекайте, виконується попередній запит', true);
        return { success: false, message: 'Вже виконується запит' };
    }

    _isProcessingRequest = true;

    try {
        // Перевіряємо наявність активного стейкінгу
        if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
            // Спробуємо оновити дані стейкінгу
            await fetchStakingData(true);

            if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                throw new Error('У вас немає активного стейкінгу');
            }
        }

        // Запитуємо підтвердження у користувача тільки якщо не передано skipConfirmation
        if (!skipConfirmation) {
            if (!confirm(`Ви впевнені, що хочете скасувати стейкінг?\n\nБуде утримано комісію ${CONFIG.cancellationFee * 100}% за дострокове скасування.`)) {
                _isProcessingRequest = false;
                return { success: false, message: 'Скасування відмінено користувачем' };
            }
        }

        // Перевірка наявності API та ID користувача
        if (!window.WinixAPI || !window.WinixAPI.cancelStaking) {
            throw new Error("API модуль не знайдено");
        }

        // Отримуємо ID користувача
        const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;

        if (!isValidId(userId)) {
            throw new Error("ID користувача не знайдено");
        }

        // Скасовуємо стейкінг через API
        const response = await window.WinixAPI.cancelStaking(_currentStakingData.stakingId);

        if (response.status !== 'success') {
            throw new Error(response.message || 'Помилка скасування стейкінгу');
        }

        // Оновлюємо дані стейкінгу
        if (response.data) {
            // Якщо є дані стейкінгу, оновлюємо їх
            if (response.data.staking) {
                _currentStakingData = response.data.staking;

                // Оновлюємо localStorage
                localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));
            } else {
                // Якщо немає даних стейкінгу, створюємо порожній об'єкт
                _currentStakingData = {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    period: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                };

                // Оновлюємо localStorage
                localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));
            }

            // Оновлюємо баланс, якщо він є в відповіді
            if (response.data.newBalance !== undefined) {
                localStorage.setItem('userTokens', response.data.newBalance.toString());
                localStorage.setItem('winix_balance', response.data.newBalance.toString());

                // Додатково викликаємо оновлення балансу, якщо є така функція
                if (window.WinixCore && window.WinixCore.updateBalanceDisplay) {
                    window.WinixCore.updateBalanceDisplay();
                } else if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.updateBalanceDisplay) {
                    window.WinixCore.UI.updateBalanceDisplay();
                } else if (typeof updateBalanceDisplay === 'function') {
                    updateBalanceDisplay();
                }
            }

            // Оновлюємо інтерфейс без перезавантаження сторінки
            updateUI();

            // Формуємо повідомлення про успіх з деталями
            let message = 'Стейкінг успішно скасовано';
            if (response.data.returnedAmount && response.data.feeAmount) {
                message += `. Повернено: ${response.data.returnedAmount} WINIX. Комісія: ${response.data.feeAmount} WINIX.`;
            }

            // Показуємо повідомлення про успіх
            showMessage(message);

            return {
                success: true,
                data: response.data,
                message: message
            };
        } else {
            throw new Error('Відповідь сервера не містить даних');
        }
    } catch (error) {
        console.error('Помилка скасування стейкінгу:', error);
        showMessage(error.message || 'Помилка скасування стейкінгу', true);

        return {
            success: false,
            message: error.message || 'Помилка скасування стейкінгу'
        };
    } finally {
        _isProcessingRequest = false;
    }
}

    /**
     * Розрахунок очікуваної винагороди
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу (7, 14, 28 днів)
     * @returns {Promise<number>} Очікувана винагорода
     */
    async function calculateExpectedReward(amount, period) {
        try {
            // Валідація параметрів
            amount = parseInt(amount) || 0;
            period = parseInt(period) || 14;

            if (amount <= 0) {
                return 0;
            }

            if (!CONFIG.allowedPeriods.includes(period)) {
                return 0;
            }

            // Спочатку спробуємо отримати результат через API
            if (window.WinixAPI && window.WinixAPI.calculateExpectedReward) {
                try {
                    const response = await window.WinixAPI.calculateExpectedReward(amount, period);

                    if (response.status === 'success' && response.data && response.data.reward !== undefined) {
                        return parseFloat(response.data.reward);
                    }
                } catch (apiError) {
                    console.warn('Не вдалося розрахувати винагороду через API:', apiError);
                }
            }

            // Якщо не вдалося отримати через API, розраховуємо локально
            const rewardPercent = CONFIG.rewardRates[period] || 9;
            const reward = (amount * rewardPercent) / 100;

            return parseFloat(reward.toFixed(2));
        } catch (error) {
            console.error('Помилка розрахунку очікуваної винагороди:', error);
            return 0;
        }
    }

    /**
     * Відновлення стейкінгу після помилок
     * @param {boolean} force - Примусове відновлення (скасування стейкінгу)
     * @returns {Promise<Object>} Результат операції
     */
    async function repairStaking(force = false) {
        if (_isProcessingRequest) {
            showMessage('Зачекайте, виконується попередній запит', true);
            return { success: false, message: 'Вже виконується запит' };
        }

        _isProcessingRequest = true;

        try {
            // Якщо примусове відновлення, запитуємо підтвердження
            if (force && !confirm('Ви впевнені, що хочете примусово відновити стан стейкінгу? Це може скасувати поточний стейкінг.')) {
                _isProcessingRequest = false;
                return { success: false, message: 'Відновлення відмінено користувачем' };
            }

            // Перевірка наявності API та ID користувача
            if (!window.WinixAPI || !window.WinixAPI.repairStaking) {
                throw new Error("API модуль не знайдено");
            }

            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;

            if (!isValidId(userId)) {
                throw new Error("ID користувача не знайдено");
            }

            // Викликаємо API для відновлення
            const response = await window.WinixAPI.repairStaking(force);

            if (response.status !== 'success') {
                throw new Error(response.message || 'Помилка відновлення стейкінгу');
            }

            // Оновлюємо дані стейкінгу
            await fetchStakingData(true);

            // Показуємо повідомлення про успіх
            showMessage(response.message || 'Стан стейкінгу успішно відновлено');

            return {
                success: true,
                data: response.data,
                message: response.message || 'Стан стейкінгу успішно відновлено'
            };
        } catch (error) {
            console.error('Помилка відновлення стейкінгу:', error);
            showMessage(error.message || 'Помилка відновлення стейкінгу', true);

            return {
                success: false,
                message: error.message || 'Помилка відновлення стейкінгу'
            };
        } finally {
            _isProcessingRequest = false;
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З МОДАЛЬНИМ ВІКНОМ ========

    /**
     * Показати модальне вікно з деталями стейкінгу
     */
    function showStakingModal() {
        try {
            // Перевіряємо наявність активного стейкінгу
            if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                showMessage('У вас немає активного стейкінгу', true);
                return;
            }

            // Оновлюємо дані в модальному вікні
            const modalStakingAmount = getElement(DOM.modalStakingAmount);
            const modalStakingPeriod = getElement(DOM.modalStakingPeriod);
            const modalRewardPercent = getElement(DOM.modalRewardPercent);
            const modalExpectedReward = getElement(DOM.modalExpectedReward);
            const modalRemainingDays = getElement(DOM.modalRemainingDays);

            if (modalStakingAmount) modalStakingAmount.textContent = `${_currentStakingData.stakingAmount || 0} $WINIX`;
            if (modalStakingPeriod) modalStakingPeriod.textContent = `${_currentStakingData.period || 0} днів`;
            if (modalRewardPercent) modalRewardPercent.textContent = `${_currentStakingData.rewardPercent || 0}%`;
            if (modalExpectedReward) modalExpectedReward.textContent = `${_currentStakingData.expectedReward || 0} $WINIX`;
            if (modalRemainingDays) modalRemainingDays.textContent = _currentStakingData.remainingDays || 0;

            // Показуємо модальне вікно
            const modal = getElement(DOM.modal);
            if (modal) modal.classList.add('active');
        } catch (error) {
            console.error('Помилка показу модального вікна:', error);
            showMessage('Помилка показу деталей стейкінгу', true);
        }
    }

    /**
     * Приховати модальне вікно
     */
    function hideStakingModal() {
        try {
            const modal = getElement(DOM.modal);
            if (modal) modal.classList.remove('active');
        } catch (error) {
            console.error('Помилка приховування модального вікна:', error);
        }
    }

    /**
     * Обробник додавання коштів до стейкінгу з модального вікна
     */
    function handleAddToStakeFromModal() {
        try {
            // Приховуємо модальне вікно
            hideStakingModal();

            // Запитуємо суму для додавання
            const amount = prompt('Введіть суму для додавання до стейкінгу:');

            if (amount === null || amount.trim() === '') {
                return; // Користувач скасував введення
            }

            const numAmount = parseInt(amount);

            if (isNaN(numAmount) || numAmount <= 0) {
                showMessage('Введіть коректну суму (ціле додатне число)', true);
                return;
            }

            // Додаємо кошти до стейкінгу
            addToStaking(numAmount)
                .then(result => {
                    if (result.success) {
                        // Після успішного додавання, оновлюємо сторінку
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                })
                .catch(error => {
                    console.error('Помилка додавання коштів до стейкінгу:', error);
                });
        } catch (error) {
            console.error('Помилка при додаванні до стейкінгу з модального вікна:', error);
            showMessage('Помилка додавання коштів до стейкінгу', true);
        }
    }

    // ======== ОБРОБНИКИ ПОДІЙ ========

    /**
     * Ініціалізація обробників подій
     */
    function initEventListeners() {
        try {
            // Оновлення очікуваної винагороди при зміні суми або періоду
            const amountInput = getElement(DOM.amountInput);
            const periodSelect = getElement(DOM.periodSelect);
            const expectedReward = getElement(DOM.expectedReward);

            if (amountInput && periodSelect && expectedReward) {
                // Функція оновлення очікуваної винагороди
                const updateReward = async () => {
                    try {
                        const amount = parseInt(amountInput.value) || 0;
                        const period = parseInt(periodSelect.value) || 14;

                        const reward = await calculateExpectedReward(amount, period);
                        if (expectedReward) {
                            expectedReward.textContent = reward.toFixed(2);
                        }
                    } catch (e) {
                        console.error("Помилка при оновленні очікуваної винагороди:", e);
                    }
                };

                // Клонуємо елементи, щоб видалити всі існуючі обробники
                const newAmountInput = amountInput.cloneNode(true);
                if (amountInput.parentNode) {
                    amountInput.parentNode.replaceChild(newAmountInput, amountInput);
                }

                const newPeriodSelect = periodSelect.cloneNode(true);
                if (periodSelect.parentNode) {
                    periodSelect.parentNode.replaceChild(newPeriodSelect, periodSelect);
                }

                // Додаємо нові обробники
                newAmountInput.addEventListener('input', updateReward);
                newPeriodSelect.addEventListener('change', updateReward);

                // Початкове оновлення
                updateReward();
            }

            // Кнопка Max
            const maxButton = getElement(DOM.maxButton);
            if (maxButton && amountInput) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newMaxButton = maxButton.cloneNode(true);
                if (maxButton.parentNode) {
                    maxButton.parentNode.replaceChild(newMaxButton, maxButton);
                }

                newMaxButton.addEventListener('click', function() {
                    const balance = getBalance();
                    const maxAllowed = Math.floor(balance * CONFIG.maxBalancePercentage);
                    const newAmountInput = getElement(DOM.amountInput);
                    if (newAmountInput) {
                        newAmountInput.value = maxAllowed;

                        // Викликаємо подію input для оновлення очікуваної винагороди
                        newAmountInput.dispatchEvent(new Event('input'));
                    }
                });
            }

            // Кнопка Створення стейкінгу
            const stakeButton = getElement(DOM.stakeButton);
            if (stakeButton && amountInput && periodSelect) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newStakeButton = stakeButton.cloneNode(true);
                if (stakeButton.parentNode) {
                    stakeButton.parentNode.replaceChild(newStakeButton, stakeButton);
                }

                newStakeButton.addEventListener('click', async () => {
                    const newAmountInput = getElement(DOM.amountInput);
                    const newPeriodSelect = getElement(DOM.periodSelect);

                    if (newAmountInput && newPeriodSelect) {
                        const amount = parseInt(newAmountInput.value) || 0;
                        const period = parseInt(newPeriodSelect.value) || 14;

                        // Створюємо стейкінг
                        await createStaking(amount, period);
                    }
                });
            }

            // Кнопка "Активний стейкінг"
            const activeStakingButton = getElement(DOM.activeStakingButton);
            if (activeStakingButton) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newActiveStakingButton = activeStakingButton.cloneNode(true);
                if (activeStakingButton.parentNode) {
                    activeStakingButton.parentNode.replaceChild(newActiveStakingButton, activeStakingButton);
                }

                newActiveStakingButton.addEventListener('click', showStakingModal);
            }

            // Кнопка "Скасувати стейкінг"
            const cancelStakingButton = getElement(DOM.cancelStakingButton);
            if (cancelStakingButton) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newCancelStakingButton = cancelStakingButton.cloneNode(true);
                if (cancelStakingButton.parentNode) {
                    cancelStakingButton.parentNode.replaceChild(newCancelStakingButton, cancelStakingButton);
                }

                newCancelStakingButton.addEventListener('click', cancelStaking);
            }

            // Кнопки в модальному вікні

            // Кнопка закриття модального вікна
            const modalCloseButton = getElement(DOM.modalClose);
            if (modalCloseButton) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newModalCloseButton = modalCloseButton.cloneNode(true);
                if (modalCloseButton.parentNode) {
                    modalCloseButton.parentNode.replaceChild(newModalCloseButton, modalCloseButton);
                }

                newModalCloseButton.addEventListener('click', hideStakingModal);
            }

            // Кнопка "Додати до стейкінгу" в модальному вікні
            const modalAddButton = getElement(DOM.modalAddButton);
            if (modalAddButton) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newModalAddButton = modalAddButton.cloneNode(true);
                if (modalAddButton.parentNode) {
                    modalAddButton.parentNode.replaceChild(newModalAddButton, modalAddButton);
                }

                newModalAddButton.addEventListener('click', handleAddToStakeFromModal);
            }

            // Кнопка "Скасувати стейкінг" в модальному вікні
            const modalCancelButton = getElement(DOM.modalCancelButton);
            if (modalCancelButton) {
                // Клонуємо елемент, щоб видалити всі існуючі обробники
                const newModalCancelButton = modalCancelButton.cloneNode(true);
                if (modalCancelButton.parentNode) {
                    modalCancelButton.parentNode.replaceChild(newModalCancelButton, modalCancelButton);
                }

                newModalCancelButton.addEventListener('click', () => {
                    hideStakingModal();
                    cancelStaking();
                });
            }

            // Глобальні події
            document.addEventListener('winix-initialized', async () => {
                await fetchStakingData(true);
            });

            // Закриття модального вікна при кліку поза ним
            const modal = getElement(DOM.modal);
            if (modal) {
                // Додаємо обробник події
                const modalClickHandler = (e) => {
                    if (e.target === modal) {
                        hideStakingModal();
                    }
                };

                // Видаляємо старий обробник перед додаванням нового
                modal.removeEventListener('click', modalClickHandler);
                modal.addEventListener('click', modalClickHandler);
            }
        } catch (error) {
            console.error('Помилка ініціалізації обробників подій:', error);
        }
    }

    /**
     * Запуск періодичного оновлення даних
     */
    function startAutoRefresh() {
        // Зупиняємо попередній таймер, якщо він є
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
        }

        // Запускаємо новий таймер
        _refreshTimer = setInterval(async () => {
            try {
                // Оновлюємо дані стейкінгу без індикатора завантаження
                await fetchStakingData(true);
            } catch (error) {
                console.warn('Помилка автоматичного оновлення даних стейкінгу:', error);
            }
        }, CONFIG.refreshInterval);
    }

    /**
     * Зупинка періодичного оновлення даних
     */
    function stopAutoRefresh() {
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
    }

    /**
     * Ініціалізація модуля стейкінгу
     */
    async function init() {
        try {
            // Отримуємо початкові дані стейкінгу
            await fetchStakingData();

            // Ініціалізуємо обробники подій
            initEventListeners();

            // Запускаємо автоматичне оновлення даних
            startAutoRefresh();

            // Встановлюємо флаг успішної ініціалізації
            window.WinixStakingSystemInitialized = true;

            console.log("✅ Модуль стейкінгу успішно ініціалізовано");
        } catch (error) {
            console.error('Помилка ініціалізації модуля стейкінгу:', error);
        }
    }

    // ======== ПУБЛІЧНИЙ API ========

    // Експортуємо публічні функції
    window.WinixStakingSystem = {
        // Основні функції стейкінгу
        getStakingData: () => _currentStakingData,
        hasActiveStaking: () => _currentStakingData && _currentStakingData.hasActiveStaking,
        createStaking,
        addToStaking,
        cancelStaking,
        calculateExpectedReward,
        repairStaking,

        // Функції для UI
        updateUI,
        updateButtonsState,
        showStakingModal,
        hideStakingModal,

        // Конфігурація
        config: CONFIG,

        // Події життєвого циклу
        refresh: () => fetchStakingData(true),
        startAutoRefresh,
        stopAutoRefresh,

        // Обробники подій кнопок (для використання іншими модулями)
        handleDetailsButton: showStakingModal,
        handleCancelStakingButton: cancelStaking,
        handleAddToStakeButton: handleAddToStakeFromModal,

        // Метод для оновлення відображення стейкінгу (для використання іншими модулями)
        updateStakingDisplay: updateUI
    };

    // Ініціалізуємо модуль при завантаженні
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /**
 * Функція для автоматичного виправлення стейкінгу при завантаженні сторінки
 */
async function autoRepairStaking() {
    try {
        console.log("🔧 Запуск автоматичного виправлення стейкінгу...");

        // Перевіряємо наявність API
        if (!window.WinixAPI || !window.WinixAPI.repairStaking) {
            console.warn("⚠️ API виправлення стейкінгу недоступне");
            return;
        }

        // Отримуємо ID користувача
        const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;
        if (!userId) {
            console.warn("⚠️ Не вдалося отримати ID користувача для виправлення стейкінгу");
            return;
        }

        console.log(`🔍 Запуск виправлення стейкінгу для користувача ${userId}...`);

        // Запускаємо легке відновлення без скасування
        const result = await window.WinixAPI.repairStaking(false);
        console.log("✅ Результат автоматичного виправлення:", result);

        // Оновлюємо дані після виправлення
        if (window.WinixStakingSystem && window.WinixStakingSystem.refresh) {
            console.log("🔄 Оновлення даних стейкінгу після ремонту...");
            await window.WinixStakingSystem.refresh();
        }

        // Додаємо додаткову перевірку на історію стейкінгу, якщо є
        if (window.WinixAPI && window.WinixAPI.getStakingHistory) {
            try {
                const historyResult = await window.WinixAPI.getStakingHistory();
                console.log("📚 Історія стейкінгу перевірена:",
                            historyResult.status === 'success' ? "успішно" : "з помилками");
            } catch (e) {
                console.warn("⚠️ Помилка перевірки історії стейкінгу:", e);
            }
        }
    } catch (e) {
        console.error("❌ Критична помилка автоматичного виправлення стейкінгу:", e);
    }
}

// Запускаємо автоматичне виправлення через 2 секунди після завантаження
document.addEventListener('DOMContentLoaded', function() {
    console.log("📝 Встановлено таймер автоматичного виправлення стейкінгу");
    setTimeout(autoRepairStaking, 2000);
});

// Додаємо обробник для Telegram WebApp події viewportChanged
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.onEvent('viewportChanged', function() {
        console.log("📱 Розмір вікна змінено, додаткова перевірка стейкінгу...");
        setTimeout(async function() {
            // Оновлюємо дані стейкінгу
            if (window.WinixStakingSystem && window.WinixStakingSystem.refresh) {
                await window.WinixStakingSystem.refresh();
            }
        }, 500);
    });
}

/**
 * Додавання кошти до стейкінгу з обробкою помилок
 * @param {number} amount - Сума для додавання
 * @returns {Promise<boolean>} - Результат операції
 */
async function safeAddToStaking(amount) {
    try {
        // Перевіряємо наявність API
        if (!window.WinixAPI || !window.WinixAPI.addToStaking) {
            throw new Error("API додавання до стейкінгу недоступне");
        }

        // Отримуємо ID користувача
        const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;
        if (!userId) {
            throw new Error("Не вдалося отримати ID користувача");
        }

        // Перевіряємо, чи є активний стейкінг
        const stakingData = await window.WinixAPI.getStakingData();
        if (!stakingData || !stakingData.data || !stakingData.data.hasActiveStaking) {
            throw new Error("У вас немає активного стейкінгу");
        }

        // Перевіряємо валідність суми
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума має бути додатним цілим числом");
        }

        // Додаємо до стейкінгу
        const result = await window.WinixAPI.addToStaking(amount, stakingData.data.stakingId);

        // Перевіряємо результат
        if (result.status !== 'success') {
            throw new Error(result.message || "Помилка додавання до стейкінгу");
        }

        // Оновлюємо відображення
        if (window.WinixStakingSystem && window.WinixStakingSystem.refresh) {
            await window.WinixStakingSystem.refresh();
        }

        return true;
    } catch (error) {
        console.error("❌ Помилка безпечного додавання до стейкінгу:", error);

        // Показуємо повідомлення про помилку
        if (window.simpleAlert) {
            window.simpleAlert(error.message || "Помилка додавання до стейкінгу", true);
        } else if (window.showToast) {
            window.showToast(error.message || "Помилка додавання до стейкінгу", "error");
        } else {
            alert(error.message || "Помилка додавання до стейкінгу");
        }

        return false;
    }
}

// Оновлення існуючих функцій у WinixStakingSystem (якщо доступні)
if (window.WinixStakingSystem) {
    // Зберігаємо оригінальні функції
    const originalAddToStaking = window.WinixStakingSystem.addToStaking;
    const originalRefresh = window.WinixStakingSystem.refresh;

    // Покращуємо функцію додавання до стейкінгу
    window.WinixStakingSystem.addToStaking = async function(amount) {
        try {
            // Спершу спробуємо безпечне додавання
            const result = await safeAddToStaking(amount);
            if (result === true) {
                return {success: true, message: "Додано до стейкінгу"};
            }

            // Якщо не вдалося, спробуємо оригінальну функцію
            if (originalAddToStaking && typeof originalAddToStaking === 'function') {
                return originalAddToStaking.call(this, amount);
            } else {
                throw new Error("Оригінальна функція додавання недоступна");
            }
        } catch (error) {
            console.error("Помилка перехопленого додавання до стейкінгу:", error);
            return {success: false, message: error.message || "Помилка додавання до стейкінгу"};
        }
    };

    // Покращуємо функцію оновлення
    window.WinixStakingSystem.refresh = async function() {
        try {
            // Спершу викликаємо оригінальну функцію
            if (originalRefresh && typeof originalRefresh === 'function') {
                await originalRefresh.call(this);
            }

            // Додаємо додаткову перевірку цілісності
            if (window.WinixAPI && window.WinixAPI.repairStaking) {
                await window.WinixAPI.repairStaking(false);
            }

            // Оновлюємо інтерфейс
            if (this.updateUI && typeof this.updateUI === 'function') {
                this.updateUI();
            }

            return true;
        } catch (error) {
            console.error("Помилка перехопленого оновлення стейкінгу:", error);
            return false;
        }
    };

    console.log("✅ Функції стейкінгу успішно вдосконалені");
}

// Експорт додаткових функцій
window.winixStakingFixes = {
    autoRepairStaking,
    safeAddToStaking
};

console.log("✅ Модуль виправлення стейкінгу успішно ініціалізовано");

})();