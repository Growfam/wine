/**
 * staking.js - Функціональність стейкінгу WINIX
 */

(function() {
    'use strict';

    console.log("🔄 Staking: Ініціалізація модуля стейкінгу");

    // ======== КОНСТАНТИ ========

    // Конфігурація стейкінгу
    const CONFIG = {
        minAmount: 50,                 // Мінімальна сума стейкінгу
        maxBalancePercentage: 0.9,     // Максимальний відсоток від балансу
        allowedPeriods: [7, 14, 28],   // Дозволені періоди стейкінгу
        rewardRates: {
            7: 4,    // 4% за 7 днів
            14: 9,   // 9% за 14 днів
            28: 15   // 15% за 28 днів
        },
        cancellationFee: 0.2,          // Штраф при скасуванні (20%)
        refreshInterval: 300000,       // Інтервал оновлення (5 хвилин)
    };

    // ID DOM елементів
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

    // Поточні дані стейкінгу
    let _currentStakingData = null;

    // Прапорець для запобігання одночасним запитам
    let _isProcessingRequest = false;

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM
     * @param {string} id - ID елемента
     */
    function getElement(id) {
        return document.getElementById(id);
    }

    /**
     * Отримання поточного балансу
     */
    function getBalance() {
        try {
            if (window.WinixCore && typeof window.WinixCore.getBalance === 'function') {
                return window.WinixCore.getBalance();
            }

            return parseFloat(localStorage.getItem('userTokens') ||
                             localStorage.getItem('winix_balance') || '0');
        } catch (e) {
            console.error('Помилка отримання балансу:', e);
            return 0;
        }
    }

    /**
     * Розрахунок очікуваної винагороди
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     */
    function calculateExpectedReward(amount, period) {
        try {
            amount = parseInt(amount) || 0;
            period = parseInt(period) || 14;

            if (amount <= 0) {
                return 0;
            }

            // Використовуємо конфігурацію для розрахунку
            const rewardPercent = CONFIG.rewardRates[period] || 9;
            const reward = (amount * rewardPercent) / 100;

            return parseFloat(reward.toFixed(2));
        } catch (e) {
            console.error('Помилка розрахунку очікуваної винагороди:', e);
            return 0;
        }
    }

    // ======== ОСНОВНІ ФУНКЦІЇ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу з сервера
     * @param {boolean} forceRefresh - Примусово оновити дані
     */
    async function fetchStakingData(forceRefresh = false) {
        try {
            if (window.WinixAPI && typeof window.WinixAPI.getStakingData === 'function') {
                // Показуємо індикатор завантаження, якщо потрібно
                const showingLoader = !silent && typeof window.showLoading === 'function';
                if (showingLoader) {
                    window.showLoading('Отримання даних стейкінгу...');
                }

                // Виконуємо запит
                const response = await window.WinixAPI.getStakingData();

                // Приховуємо індикатор
                if (showingLoader && typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Обробляємо результат
                if (response.status === 'success' && response.data) {
                    _currentStakingData = response.data;

                    // Зберігаємо в localStorage
                    localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                    localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));
                    localStorage.setItem('stakingDataCacheTime', Date.now().toString());

                    // Оновлюємо інтерфейс
                    updateUI();

                    return _currentStakingData;
                } else {
                    throw new Error(response.message || 'Не вдалося отримати дані стейкінгу');
                }
            } else {
                // Зчитуємо дані з localStorage, якщо API недоступне
                const stakingDataStr = localStorage.getItem('stakingData') ||
                                      localStorage.getItem('winix_staking');

                if (stakingDataStr) {
                    _currentStakingData = JSON.parse(stakingDataStr);
                    updateUI();
                    return _currentStakingData;
                } else {
                    // Встановлюємо пусті дані
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
        } catch (error) {
            console.error('Помилка отримання даних стейкінгу:', error);

            // Використовуємо кешовані дані
            try {
                const stakingDataStr = localStorage.getItem('stakingData') ||
                                      localStorage.getItem('winix_staking');

                if (stakingDataStr) {
                    _currentStakingData = JSON.parse(stakingDataStr);
                } else {
                    _currentStakingData = {
                        hasActiveStaking: false,
                        stakingAmount: 0,
                        period: 0,
                        rewardPercent: 0,
                        expectedReward: 0,
                        remainingDays: 0
                    };
                }
            } catch (e) {
                _currentStakingData = {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    period: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                };
            }

            updateUI();
            return _currentStakingData;
        }
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     */
    async function createStaking(amount, period) {
        if (_isProcessingRequest) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Зачекайте, виконується попередній запит', true);
            }
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

            // Показуємо індикатор завантаження
            if (typeof window.showLoading === 'function') {
                window.showLoading('Створення стейкінгу...');
            }

            // Створюємо стейкінг через API
            const response = await window.WinixAPI.createStaking(amount, period);

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

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

                    // Оновлюємо баланс, якщо є така функція
                    if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
                        window.WinixCore.updateBalanceDisplay();
                    }
                }

                // Оновлюємо інтерфейс
                updateUI();

                // Показуємо повідомлення про успіх
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Стейкінг успішно створено');
                }

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

            if (typeof window.showNotification === 'function') {
                window.showNotification(error.message || 'Помилка створення стейкінгу', true);
            }

            return {
                success: false,
                message: error.message || 'Помилка створення стейкінгу'
            };
        } finally {
            _isProcessingRequest = false;
        }
    }

    /**
     * Додавання коштів до стейкінгу
     * @param {number} amount - Сума для додавання
     */
    async function addToStaking(amount) {
        if (_isProcessingRequest) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Зачекайте, виконується попередній запит', true);
            }
            return { success: false, message: 'Вже виконується запит' };
        }

        _isProcessingRequest = true;

        try {
            // Перевіряємо наявність активного стейкінгу
            if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                // Оновлюємо дані стейкінгу
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

            // Показуємо індикатор завантаження
            if (typeof window.showLoading === 'function') {
                window.showLoading('Додавання до стейкінгу...');
            }

            // Додаємо кошти до стейкінгу через API
            const response = await window.WinixAPI.addToStaking(amount, _currentStakingData.stakingId);

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

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

                    // Оновлюємо баланс, якщо є така функція
                    if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
                        window.WinixCore.updateBalanceDisplay();
                    }
                }

                // Оновлюємо інтерфейс
                updateUI();

                // Показуємо повідомлення про успіх
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`Додано ${amount} WINIX до стейкінгу`);
                }

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

            if (typeof window.showNotification === 'function') {
                window.showNotification(error.message || 'Помилка додавання коштів до стейкінгу', true);
            }

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
 */
async function cancelStaking() {
    if (_isProcessingRequest) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Зачекайте, виконується попередній запит', true);
        }
        return { success: false, message: 'Вже виконується запит' };
    }

    _isProcessingRequest = true;

    try {
        // Показуємо індикатор завантаження
        if (typeof window.showLoading === 'function') {
            window.showLoading('Скасування стейкінгу...');
        }

        // Перевіряємо наявність активного стейкінгу
        if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
            await fetchStakingData(true);

            if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                throw new Error('У вас немає активного стейкінгу');
            }
        }

        const stakingId = _currentStakingData.stakingId;
        if (!stakingId) {
            throw new Error('Не вдалося визначити ID стейкінгу');
        }

        // Запитуємо підтвердження
        let userConfirmed = false;

        if (typeof window.showModernConfirm === 'function') {
            userConfirmed = await new Promise(resolve => {
                window.showModernConfirm(
                    "Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.",
                    () => resolve(true),
                    () => resolve(false)
                );
            });
        } else {
            userConfirmed = confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.");
        }

        if (!userConfirmed) {
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
            _isProcessingRequest = false;
            return { success: false, message: "Скасовано користувачем" };
        }

        // Отримуємо ID користувача
        const userId = window.WinixAPI.getUserId();

        if (!userId) {
            throw new Error('Не вдалося отримати ID користувача');
        }

        // Виконуємо запит напряму через fetch з правильними параметрами
        const response = await fetch(`/api/user/${userId}/staking/${stakingId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                confirm: true,
                timestamp: Date.now()
            })
        });

        // Приховуємо індикатор завантаження
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Помилка сервера: ${response.status}`);
        }

        const result = await response.json();

        // Очищаємо дані стейкінгу
        _currentStakingData = {
            hasActiveStaking: false,
            stakingAmount: 0,
            period: 0,
            rewardPercent: 0,
            expectedReward: 0,
            remainingDays: 0
        };

        // Очищаємо кеш
        localStorage.removeItem('stakingData');
        localStorage.removeItem('winix_staking');

        // Оновлюємо баланс, якщо є у відповіді
        if (result.data && result.data.newBalance !== undefined) {
            localStorage.setItem('userTokens', result.data.newBalance.toString());
            localStorage.setItem('winix_balance', result.data.newBalance.toString());

            // Оновлюємо відображення
            if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
                window.WinixCore.updateBalanceDisplay();
            }
        }

        // Оновлюємо інтерфейс
        updateUI();

        // Показуємо повідомлення про успіх
        let message = "Стейкінг успішно скасовано";
        if (result.data && result.data.returnedAmount && result.data.feeAmount) {
            message = `Стейкінг скасовано. Повернено: ${result.data.returnedAmount} WINIX. Комісія: ${result.data.feeAmount} WINIX.`;
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification(message, false, () => {
                // Плавно перезавантажуємо сторінку для оновлення даних
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            });
        }

        return { success: true, data: result.data, message };
    } catch (error) {
        console.error("Помилка під час скасування стейкінгу:", error);

        // Приховуємо індикатор завантаження
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }

        // Показуємо повідомлення про помилку
        if (typeof window.showNotification === 'function') {
            window.showNotification(error.message || "Сталася помилка під час скасування стейкінгу", true);
        }

        return { success: false, message: error.message };
    } finally {
        _isProcessingRequest = false;
    }
}

    // ======== ФУНКЦІЇ ІНТЕРФЕЙСУ ========

    /**
     * Оновлення інтерфейсу
     */
    function updateUI() {
        try {
            const hasActiveStaking = _currentStakingData && _currentStakingData.hasActiveStaking;

            // Оновлення статусу стейкінгу
            const statusElement = getElement(DOM.stakingStatus);
            if (statusElement) {
                if (hasActiveStaking) {
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
                } else {
                    statusElement.style.color = '';
                    statusElement.style.fontWeight = '';
                    statusElement.textContent = "Наразі немає активних стейкінгів";
                }
            }

            // Оновлюємо активність кнопок
            updateButtonsState(hasActiveStaking);
        } catch (e) {
            console.error('Помилка оновлення інтерфейсу стейкінгу:', e);
        }
    }

    /**
     * Оновлення стану кнопок
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

    /**
     * Показати модальне вікно стейкінгу
     */
    function showStakingModal() {
        try {
            // Перевіряємо наявність активного стейкінгу
            if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('У вас немає активного стейкінгу', true);
                }
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

            if (typeof window.showNotification === 'function') {
                window.showNotification('Помилка показу деталей стейкінгу', true);
            }
        }
    }

    /**
     * Приховати модальне вікно стейкінгу
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

            // Запитуємо суму
            if (typeof window.showInputModal === 'function') {
                window.showInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
                    const numAmount = parseInt(amount);
                    if (isNaN(numAmount) || numAmount <= 0) {
                        if (typeof window.showNotification === 'function') {
                            window.showNotification('Введіть коректну суму (ціле додатне число)', true);
                        }
                        return;
                    }

                    // Додаємо кошти до стейкінгу
                    addToStaking(numAmount);
                });
            } else {
                // Використовуємо стандартний prompt
                const amount = prompt('Введіть суму для додавання до стейкінгу:');
                if (amount === null || amount.trim() === '') {
                    return; // Користувач скасував введення
                }

                const numAmount = parseInt(amount);
                if (isNaN(numAmount) || numAmount <= 0) {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('Введіть коректну суму (ціле додатне число)', true);
                    }
                    return;
                }

                // Додаємо кошти до стейкінгу
                addToStaking(numAmount);
            }
        } catch (error) {
            console.error('Помилка при додаванні до стейкінгу з модального вікна:', error);

            if (typeof window.showNotification === 'function') {
                window.showNotification('Помилка додавання коштів до стейкінгу', true);
            }
        }
    }

    /**
     * Оновлення очікуваної винагороди при зміні введених даних
     */
    function updateReward() {
        try {
            // Отримуємо елементи
            const amountInput = getElement(DOM.amountInput);
            const periodSelect = getElement(DOM.periodSelect);
            const expectedReward = getElement(DOM.expectedReward);

            if (!amountInput || !periodSelect || !expectedReward) {
                return;
            }

            // Отримуємо поточні значення
            const amount = parseInt(amountInput.value) || 0;
            const period = parseInt(periodSelect.value) || 14;

            // Показуємо стан завантаження
            expectedReward.classList.add('calculating');

            // Розраховуємо винагороду
            const reward = calculateExpectedReward(amount, period);

            // Оновлюємо відображення
            expectedReward.textContent = reward.toFixed(2);
            expectedReward.classList.remove('calculating');
            expectedReward.classList.add('value-updated');

            // Прибираємо клас анімації через деякий час
            setTimeout(() => {
                expectedReward.classList.remove('value-updated');
            }, 500);
        } catch (error) {
            console.error("Помилка при оновленні очікуваної винагороди:", error);
        }
    }

    /**
     * Ініціалізація обробників подій
     */
    function initEventListeners() {
        try {
            // Оновлення очікуваної винагороди при зміні суми або періоду
            const amountInput = getElement(DOM.amountInput);
            const periodSelect = getElement(DOM.periodSelect);

            if (amountInput) {
                amountInput.addEventListener('input', updateReward);
            }

            if (periodSelect) {
                periodSelect.addEventListener('change', updateReward);
            }

            // Кнопка Max
            const maxButton = getElement(DOM.maxButton);
            if (maxButton && amountInput) {
                maxButton.addEventListener('click', function() {
                    const balance = getBalance();
                    const maxAllowed = Math.floor(balance * CONFIG.maxBalancePercentage);

                    amountInput.value = maxAllowed;

                    // Викликаємо подію input для оновлення очікуваної винагороди
                    amountInput.dispatchEvent(new Event('input'));

                    // Додаємо анімацію натискання
                    maxButton.classList.add('active');
                    setTimeout(() => {
                        maxButton.classList.remove('active');
                    }, 300);
                });
            }

            // Кнопка "Створення стейкінгу"
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

            // Закриття модального вікна при кліку поза ним
            const modal = getElement(DOM.modal);
            if (modal) {
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        hideStakingModal();
                    }
                });
            }

            // Кнопка "Назад"
            const backButton = document.getElementById('back-button');
            if (backButton) {
                backButton.addEventListener('click', function() {
                    window.location.href = "wallet.html";
                });
            }

            // Початкове оновлення очікуваної винагороди
            setTimeout(updateReward, 100);
        } catch (error) {
            console.error('Помилка ініціалізації обробників подій:', error);
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

            console.log("✅ Staking: Модуль стейкінгу успішно ініціалізовано");

            // Викликаємо подію ініціалізації стейкінгу
            document.dispatchEvent(new CustomEvent('staking-initialized'));
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

        // Функції для UI
        updateUI,
        updateButtonsState,
        showStakingModal,
        hideStakingModal,

        // Обробники подій
        handleDetailsButton: showStakingModal,
        handleCancelStakingButton: cancelStaking,
        handleAddToStakeButton: handleAddToStakeFromModal,

        // Метод для оновлення
        refresh: () => fetchStakingData(true)
    };

    // Ініціалізуємо модуль при завантаженні
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();