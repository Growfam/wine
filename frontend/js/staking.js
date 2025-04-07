/**
 * staking.js
 *
 * Єдиний модуль для управління функціональністю стейкінгу WINIX.
 * Забезпечує інтерфейс для створення, додавання коштів, скасування стейкінгу та
 * оновлення відображення на сторінці.
 */

(function() {
    'use strict';

    // Перевіряємо наявність залежностей
    if (!window.WinixAPI) {
        console.error("❌ Помилка: Модуль WinixAPI не знайдено!");
        return;
    }

    console.log("🔄 Ініціалізація модуля стейкінгу...");

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

    // Прапорець для запобігання одночасним запитам
    let _isProcessingRequest = false;

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
     * Показати повідомлення користувачу
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи є повідомлення помилкою
     * @param {Function} callback - Функція, яка викликається після закриття повідомлення
     */
    function showMessage(message, isError = false, callback = null) {
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
     */
    function updateUI() {
        try {
            const hasActiveStaking = _currentStakingData && _currentStakingData.hasActiveStaking;

            // Оновлення статусу стейкінгу
            const statusElement = getElement(DOM.stakingStatus);
            if (statusElement) {
                if (hasActiveStaking) {
                    statusElement.textContent = `У стейкінгу: ${_currentStakingData.stakingAmount} $WINIX`;
                } else {
                    statusElement.textContent = "Наразі немає активних стейкінгів";
                }
            }

            // Оновлюємо активність кнопок
            updateButtonsState(hasActiveStaking);

            // Викликаємо глобальну подію оновлення стейкінгу
            document.dispatchEvent(new CustomEvent('staking-updated', {
                detail: { stakingData: _currentStakingData }
            }));
        } catch (e) {
            console.error('Помилка оновлення інтерфейсу стейкінгу:', e);
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
     * Отримання даних стейкінгу з сервера
     * @param {boolean} silent - Чи потрібно приховувати індикатор завантаження
     * @returns {Promise<Object>} Дані стейкінгу
     */
    async function fetchStakingData(silent = false) {
        try {
            const response = await window.WinixAPI.getStakingData();

            if (response.status === 'success' && response.data) {
                // Зберігаємо дані стейкінгу
                _currentStakingData = response.data;

                // Зберігаємо також в localStorage для сумісності з іншими скриптами
                localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));

                // Оновлюємо інтерфейс
                updateUI();

                return _currentStakingData;
            } else {
                throw new Error(response.message || 'Не вдалося отримати дані стейкінгу');
            }
        } catch (error) {
            console.error('Помилка отримання даних стейкінгу:', error);

            // Якщо запит не silent, показуємо помилку
            if (!silent) {
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
                    if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
                        window.WinixCore.updateBalanceDisplay();
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
                    if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
                        window.WinixCore.updateBalanceDisplay();
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
    async function cancelStaking() {
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

            // Запитуємо підтвердження у користувача
            if (!confirm(`Ви впевнені, що хочете скасувати стейкінг?\n\nБуде утримано комісію ${CONFIG.cancellationFee * 100}% за дострокове скасування.`)) {
                _isProcessingRequest = false;
                return { success: false, message: 'Скасування відмінено користувачем' };
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
                    if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
                        window.WinixCore.updateBalanceDisplay();
                    }
                }

                // Оновлюємо інтерфейс
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
            try {
                const response = await window.WinixAPI.calculateExpectedReward(amount, period);

                if (response.status === 'success' && response.data && response.data.reward !== undefined) {
                    return parseFloat(response.data.reward);
                }
            } catch (apiError) {
                console.warn('Не вдалося розрахувати винагороду через API:', apiError);
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
                const updateReward = async () => {
                    const amount = parseInt(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;
                    const reward = await calculateExpectedReward(amount, period);
                    expectedReward.textContent = reward.toFixed(2);
                };

                amountInput.addEventListener('input', updateReward);
                periodSelect.addEventListener('change', updateReward);

                // Початкове оновлення
                updateReward();
            }

            // Кнопка Max
            const maxButton = getElement(DOM.maxButton);
            if (maxButton && amountInput) {
                maxButton.addEventListener('click', () => {
                    const balance = getBalance();
                    const maxAllowed = Math.floor(balance * CONFIG.maxBalancePercentage);
                    amountInput.value = maxAllowed;

                    // Викликаємо подію input для оновлення очікуваної винагороди
                    amountInput.dispatchEvent(new Event('input'));
                });
            }

            // Кнопка Створення стейкінгу
            const stakeButton = getElement(DOM.stakeButton);
            if (stakeButton && amountInput && periodSelect) {
                stakeButton.addEventListener('click', async () => {
                    const amount = parseInt(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    // Створюємо стейкінг
                    await createStaking(amount, period);
                });
            }

            // Кнопка "Активний стейкінг"
            const activeStakingButton = getElement(DOM.activeStakingButton);
            if (activeStakingButton) {
                activeStakingButton.addEventListener('click', showStakingModal);
            }

            // Кнопка "Скасувати стейкінг"
            const cancelStakingButton = getElement(DOM.cancelStakingButton);
            if (cancelStakingButton) {
                cancelStakingButton.addEventListener('click', cancelStaking);
            }

            // Кнопки в модальному вікні

            // Кнопка закриття модального вікна
            const modalCloseButton = getElement(DOM.modalClose);
            if (modalCloseButton) {
                modalCloseButton.addEventListener('click', hideStakingModal);
            }

            // Кнопка "Додати до стейкінгу" в модальному вікні
            const modalAddButton = getElement(DOM.modalAddButton);
            if (modalAddButton) {
                modalAddButton.addEventListener('click', handleAddToStakeFromModal);
            }

            // Кнопка "Скасувати стейкінг" в модальному вікні
            const modalCancelButton = getElement(DOM.modalCancelButton);
            if (modalCancelButton) {
                modalCancelButton.addEventListener('click', () => {
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
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        hideStakingModal();
                    }
                });
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
        stopAutoRefresh
    };

    // Ініціалізуємо модуль при завантаженні
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();