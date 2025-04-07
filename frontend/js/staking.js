/**
 * staking.js
 *
 * Єдиний модуль для управління функціональністю стейкінгу WINIX.
 * Забезпечує інтерфейс для створення, додавання коштів, скасування стейкінгу та
 * оновлення відображення на сторінці.
 *
 * Версія: 2.0
 * Дата останнього оновлення: 2025-04-07
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
        refreshInterval: 300000,       // Інтервал автоматичного оновлення даних (5 хвилин)
        cacheLifetime: 30000           // Час життя кешу (30 секунд)
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

    // Змінні для оптимізації оновлення інтерфейсу
    let _updateDebounceTimer = null;
    let _lastUpdateTime = 0;
    let _inputDebounceTimer = null;
    let _apiThrottleTimer = null;
    const UPDATE_THROTTLE_MS = 300; // Мінімальний інтервал між оновленнями
    const INPUT_DEBOUNCE_MS = 250; // Затримка для обробки введення користувача
    const API_THROTTLE_MS = 500; // Мінімальна затримка між API запитами

    // Лічильник API запитів
    let _apiRequestsInLastMinute = 0;
    const API_REQUESTS_RESET_INTERVAL = 60000; // 1 хвилина

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
            // Спочатку перевіряємо наявність сучасних повідомлень
            if (window.showModernNotification) {
                window.showModernNotification(message, isError, callback);
                return;
            }

            // Інакше використовуємо інші доступні методи
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
     * Оптимізована функція оновлення інтерфейсу з використанням throttling та debouncing
     * @param {boolean} forceUpdate - Примусово оновити, ігноруючи затримку
     * @returns {Promise<void>}
     */
    function optimizedUpdateUI(forceUpdate = false) {
        // Перевіряємо, чи не минуло достатньо часу з останнього оновлення
        const now = Date.now();
        if (!forceUpdate && now - _lastUpdateTime < UPDATE_THROTTLE_MS) {
            // Якщо минуло менше встановленого часу, відкладаємо оновлення (debounce)
            clearTimeout(_updateDebounceTimer);

            return new Promise(resolve => {
                _updateDebounceTimer = setTimeout(() => {
                    // Застосовуємо додаткову логіку для оптимізації
                    // Встановлюємо атрибут для уникнення паралельних оновлень
                    if (!window._uiUpdateInProgress) {
                        window._uiUpdateInProgress = true;

                        updateUI(true)
                            .then(result => {
                                window._uiUpdateInProgress = false;
                                resolve(result);
                            })
                            .catch(error => {
                                window._uiUpdateInProgress = false;
                                console.warn('Помилка оптимізованого оновлення UI:', error);
                                resolve();
                            });
                    } else {
                        console.log('Пропускаємо оновлення - вже виконується');
                        resolve();
                    }
                }, UPDATE_THROTTLE_MS);
            });
        }

        // Оновлюємо час останнього оновлення (throttling)
        _lastUpdateTime = now;

        // Перевіряємо, чи не виконується вже оновлення
        if (window._uiUpdateInProgress) {
            return Promise.resolve();
        }

        // Встановлюємо прапорець виконання
        window._uiUpdateInProgress = true;

        // Виконуємо звичайне оновлення
        return updateUI(forceUpdate)
            .then(result => {
                window._uiUpdateInProgress = false;
                return result;
            })
            .catch(error => {
                window._uiUpdateInProgress = false;
                console.warn('Помилка звичайного оновлення UI:', error);
                throw error;
            });
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

    /**
     * Плавне перезавантаження сторінки
     */
    function smoothReload() {
        // Показуємо плавну анімацію перед перезавантаженням
        const container = document.querySelector('.container');
        if (container) {
            container.style.transition = 'opacity 0.5s ease';
            container.style.opacity = '0.5';
        }

        // Затримка перед перезавантаженням для плавності анімації
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    // ======== ОСНОВНІ ФУНКЦІЇ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу з сервера з покращеним кешуванням та обробкою помилок
     * @param {boolean} silent - Чи потрібно приховувати індикатор завантаження
     * @param {boolean} forceRefresh - Примусово оновити дані (ігнорує кеш)
     * @returns {Promise<Object>} Дані стейкінгу
     */
    async function fetchStakingData(silent = false, forceRefresh = false) {
        // Для запобігання паралельним запитам
        if (window._fetchingStakingData && !forceRefresh) {
            console.log("Вже виконується запит даних стейкінгу, чекаємо...");

            // Чекаємо завершення поточного запиту
            try {
                await window._fetchStakingDataPromise;
                return _currentStakingData;
            } catch (error) {
                console.warn("Помилка очікування даних стейкінгу:", error);
                // Продовжуємо виконання - спробуємо ще раз
            }
        }

        // Створюємо новий проміс для відстеження цього запиту
        window._fetchStakingDataPromise = new Promise(async (resolve, reject) => {
            try {
                window._fetchingStakingData = true;

                // Перевірка кешу з більш гнучкою стратегією
                const now = Date.now();
                const cacheTime = parseInt(localStorage.getItem('stakingDataCacheTime') || '0');
                const cacheAge = now - cacheTime;

                // Визначаємо термін дії кешу залежно від обставин
                // Якщо є активний стейкінг, кеш живе менше
                let effectiveCacheLifetime = CONFIG.cacheLifetime;

                // Перевіряємо наявність активного стейкінгу в кешованих даних
                try {
                    const cachedData = JSON.parse(localStorage.getItem('stakingData') || '{}');
                    if (cachedData && cachedData.hasActiveStaking) {
                        // Для активного стейкінгу оновлюємо дані частіше
                        effectiveCacheLifetime = CONFIG.cacheLifetime / 2;

                        // Якщо залишилося мало днів, ще частіше оновлюємо
                        if (cachedData.remainingDays <= 1) {
                            effectiveCacheLifetime = CONFIG.cacheLifetime / 4;
                        }
                    }
                } catch (e) {
                    console.warn("Помилка при аналізі кешу стейкінгу:", e);
                }

                // Перевіряємо можливість використання кешу
                if (!forceRefresh && _currentStakingData && (cacheAge < effectiveCacheLifetime)) {
                    console.log(`Використовуємо кешовані дані стейкінгу (вік: ${Math.round(cacheAge/1000)}с)`);
                    window._fetchingStakingData = false;
                    resolve(_currentStakingData);
                    return _currentStakingData;
                }

                // Індикація швидкого завантаження для кращого UX
                let quickLoadTimer = null;
                let slowLoadTimer = null;
                const stakingStatus = getElement(DOM.stakingStatus);

                if (!silent && stakingStatus) {
                    // Зберігаємо початковий текст
                    const originalText = stakingStatus.textContent;

                    // Швидке оновлення інтерфейсу через 100мс
                    quickLoadTimer = setTimeout(() => {
                        stakingStatus.innerHTML = '<span class="loading-pulse">Оновлення даних</span>';
                    }, 100);

                    // Повне оновлення через 600мс (показуємо спіннер)
                    slowLoadTimer = setTimeout(() => {
                        if (!silent) {
                            if (typeof showLoading === 'function') {
                                showLoading();
                            } else if (typeof showLoader === 'function') {
                                showLoader();
                            }
                        }
                    }, 600);
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

                // Відправляємо запит з обмеженням часу очікування та повторними спробами
                let retryCount = 0;
                const MAX_RETRIES = 2;
                const RETRY_DELAY = 1000;

                async function attemptFetch() {
                    try {
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Таймаут запиту даних стейкінгу')), 10000);
                        });

                        const fetchPromise = window.WinixAPI.getStakingData();
                        return await Promise.race([fetchPromise, timeoutPromise]);
                    } catch (error) {
                        if (retryCount < MAX_RETRIES) {
                            console.log(`Спроба ${retryCount + 1}/${MAX_RETRIES} не вдалася, повторюємо через ${RETRY_DELAY}мс`);
                            retryCount++;
                            await new Promise(r => setTimeout(r, RETRY_DELAY));
                            return attemptFetch();
                        } else {
                            throw error;
                        }
                    }
                }

                // Виконуємо запит з можливістю повторних спроб
                const response = await attemptFetch();

                // Очищаємо таймери та приховуємо індикатори завантаження
                clearTimeout(quickLoadTimer);
                clearTimeout(slowLoadTimer);

                if (!silent) {
                    if (typeof hideLoading === 'function') {
                        hideLoading();
                    } else if (typeof hideLoader === 'function') {
                        hideLoader();
                    }

                    // Відновлюємо текст, якщо статус був змінений
                    if (stakingStatus && stakingStatus.querySelector('.loading-pulse')) {
                        stakingStatus.innerHTML = stakingStatus.textContent;
                    }
                }

                if (response.status === 'success' && response.data) {
                    // Аналізуємо отримані дані для виявлення змін
                    const previousData = _currentStakingData || {};
                    const newData = response.data;

                    // Перевіряємо, чи змінилися критичні дані
                    const hasSignificantChanges = (
                        !previousData.hasActiveStaking !== !newData.hasActiveStaking ||
                        previousData.stakingAmount !== newData.stakingAmount ||
                        previousData.remainingDays !== newData.remainingDays
                    );

                    // Зберігаємо дані стейкінгу
                    _currentStakingData = newData;

                    // Оновлюємо кеш
                    localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
                    localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));
                    localStorage.setItem('stakingDataCacheTime', now.toString());

                    // Оновлюємо інтерфейс з оптимізацією (форсуємо оновлення, якщо є значні зміни)
                    if (hasSignificantChanges) {
                        // Для значних змін оновлюємо UI примусово
                        updateUI(true);
                    } else {
                        // Для незначних змін застосовуємо оптимізацію
                        optimizedUpdateUI();
                    }

                    // Додаємо подію для інших модулів
                    document.dispatchEvent(new CustomEvent('staking-data-updated', {
                        detail: {
                            data: _currentStakingData,
                            hasSignificantChanges,
                            timestamp: now
                        }
                    }));

                    window._fetchingStakingData = false;
                    resolve(_currentStakingData);
                    return _currentStakingData;
                } else {
                    throw new Error(response.message || 'Не вдалося отримати дані стейкінгу');
                }
            } catch (error) {
                // Очищаємо індикатори завантаження
                if (!silent) {
                    if (typeof hideLoading === 'function') {
                        hideLoading();
                    } else if (typeof hideLoader === 'function') {
                        hideLoader();
                    }
                }

                console.warn('Помилка отримання даних стейкінгу:', error);

                // Показуємо помилку лише для серйозних проблем і не в тихому режимі
                if (!silent && error.message !== 'Таймаут запиту даних стейкінгу') {
                    // Використовуємо м'яке повідомлення про помилку, щоб не лякати користувача
                    showMessage('Перевірте з\'єднання з інтернетом. ' +
                                'Використовуємо кешовані дані стейкінгу.', true);
                }

                // Використовуємо стратегію "graceful degradation" - повертаємося до кешованих даних
                try {
                    const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                    if (stakingDataStr) {
                        console.log("Використовуємо кешовані дані стейкінгу з localStorage");
                        _currentStakingData = JSON.parse(stakingDataStr);

                        // Позначаємо дані як потенційно застарілі
                        _currentStakingData._fromCache = true;
                        _currentStakingData._cacheTimestamp = parseInt(localStorage.getItem('stakingDataCacheTime') || '0');

                        updateUI();
                        window._fetchingStakingData = false;
                        resolve(_currentStakingData);
                        return _currentStakingData;
                    }
                } catch (localError) {
                    console.error('Помилка отримання даних стейкінгу з localStorage:', localError);
                }

                // Якщо не вдалося отримати дані ні з API, ні з localStorage, повертаємо порожні дані
                _currentStakingData = {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    period: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0,
                    _error: error.message
                };

                updateUI();
                window._fetchingStakingData = false;
                reject(error);
                return _currentStakingData;
            }
        });

        try {
            return await window._fetchStakingDataPromise;
        } catch (error) {
            console.error("Критична помилка отримання даних стейкінгу:", error);
            return _currentStakingData || {
                hasActiveStaking: false,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0,
                _error: error.message
            };
        } finally {
            window._fetchingStakingData = false;
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

            // Показуємо індикатор завантаження
            if (typeof showLoading === 'function') {
                showLoading();
            }

            // Створюємо стейкінг через API
            const response = await window.WinixAPI.createStaking(amount, period);

            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
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

            // Показуємо індикатор завантаження
            if (typeof showLoading === 'function') {
                showLoading();
            }

            // Додаємо кошти до стейкінгу через API
            const response = await window.WinixAPI.addToStaking(amount, _currentStakingData.stakingId);

            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
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
    async function cancelStaking() {
        // Показуємо індикатор завантаження
        if (typeof showLoading === 'function') {
            showLoading();
        }

        try {
            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId();
            if (!userId) {
                throw new Error("Не вдалося отримати ID користувача");
            }

            // Отримуємо дані стейкінгу для визначення ID стейкінгу
            const stakingData = await window.WinixAPI.getStakingData();
            if (!stakingData || !stakingData.data || !stakingData.data.hasActiveStaking || !stakingData.data.stakingId) {
                throw new Error("Активний стейкінг не знайдено");
            }

            const stakingId = stakingData.data.stakingId;
            console.log(`Скасування стейкінгу з ID: ${stakingId}`);

            // Запитуємо підтвердження (тільки один раз)
            if (!window.showModernConfirm) {
                // Якщо немає сучасного підтвердження, використовуємо звичайний confirm
                if (!confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.")) {
                    if (typeof hideLoading === 'function') {
                        hideLoading();
                    }
                    return { success: false, message: "Скасовано користувачем" };
                }
            } else {
                // Використовуємо сучасне підтвердження
                return new Promise((resolve) => {
                    window.showModernConfirm(
                        "Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.",
                        async () => {
                            try {
                                // Безпосередній запит до API
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
                                if (typeof hideLoading === 'function') {
                                    hideLoading();
                                }

                                if (!response.ok) {
                                    // Спроба отримати текст помилки з відповіді
                                    let errorText = "";
                                    try {
                                        const errorData = await response.json();
                                        errorText = errorData.message || `Помилка сервера: ${response.status}`;
                                    } catch {
                                        errorText = `Помилка сервера: ${response.status}`;
                                    }

                                    console.error(`Помилка скасування стейкінгу: ${errorText}`);
                                    window.showModernNotification(errorText, true);
                                    resolve({ success: false, message: errorText });
                                    return;
                                }

                                const data = await response.json();

                                if (data.status === 'success') {
                                    // Очищаємо дані стейкінгу
                                    localStorage.removeItem('stakingData');
                                    localStorage.removeItem('winix_staking');

                                    // Оновлюємо баланс
                                    if (data.data && data.data.newBalance !== undefined) {
                                        localStorage.setItem('userTokens', data.data.newBalance.toString());
                                        localStorage.setItem('winix_balance', data.data.newBalance.toString());

                                        // Оновлюємо відображення
                                        if (typeof updateBalanceDisplay === 'function') {
                                            updateBalanceDisplay();
                                        }
                                    }

                                    // Показуємо повідомлення про успіх
                                    let message = "Стейкінг успішно скасовано";
                                    if (data.data && data.data.returnedAmount && data.data.feeAmount) {
                                        message = `Стейкінг скасовано. Повернено: ${data.data.returnedAmount} WINIX. Комісія: ${data.data.feeAmount} WINIX.`;
                                    }

                                    window.showModernNotification(message, false, () => {
                                        // Плавно перезавантажуємо сторінку для оновлення даних
                                        smoothReload();
                                    });

                                    resolve({ success: true, data: data.data, message });
                                } else {
                                    window.showModernNotification(data.message || "Помилка скасування стейкінгу", true);
                                    resolve({ success: false, message: data.message || "Помилка скасування стейкінгу" });
                                }
                            } catch (error) {
                                // Приховуємо індикатор завантаження
                                if (typeof hideLoading === 'function') {
                                    hideLoading();
                                }

                                console.error("Помилка під час скасування стейкінгу:", error);
                                window.showModernNotification(error.message || "Сталася помилка під час скасування стейкінгу", true);
                                resolve({ success: false, message: error.message });
                            }
                        },
                        () => {
                            // Приховуємо індикатор завантаження
                            if (typeof hideLoading === 'function') {
                                hideLoading();
                            }
                            resolve({ success: false, message: "Скасовано користувачем" });
                        }
                    );
                });
            }

            // Для випадку, коли використовується звичайний confirm
            // Безпосередній запит до API
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
            if (typeof hideLoading === 'function') {
                hideLoading();
            }

            if (!response.ok) {
                throw new Error(`Помилка сервера: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                // Очищаємо дані стейкінгу
                localStorage.removeItem('stakingData');
                localStorage.removeItem('winix_staking');

                // Оновлюємо баланс
                if (data.data && data.data.newBalance !== undefined) {
                    localStorage.setItem('userTokens', data.data.newBalance.toString());
                    localStorage.setItem('winix_balance', data.data.newBalance.toString());

                    // Оновлюємо відображення
                    if (typeof updateBalanceDisplay === 'function') {
                        updateBalanceDisplay();
                    }
                }

                // Показуємо повідомлення про успіх
                let message = "Стейкінг успішно скасовано";
                if (data.data && data.data.returnedAmount && data.data.feeAmount) {
                    message = `Стейкінг скасовано. Повернено: ${data.data.returnedAmount} WINIX. Комісія: ${data.data.feeAmount} WINIX.`;
                }

                if (typeof window.showModernNotification === 'function') {
                    window.showModernNotification(message, false, () => {
                        // Плавно перезавантажуємо сторінку для оновлення даних
                        smoothReload();
                    });
                } else {
                    alert(message);
                    smoothReload();
                }

                return { success: true, data: data.data, message };
            } else {
                if (typeof window.showModernNotification === 'function') {
                    window.showModernNotification(data.message || "Помилка скасування стейкінгу", true);
                } else {
                    alert(data.message || "Помилка скасування стейкінгу");
                }

                return { success: false, message: data.message || "Помилка скасування стейкінгу" };
            }
        } catch (error) {
            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
            }

            console.error("Помилка під час скасування стейкінгу:", error);

            if (typeof window.showModernNotification === 'function') {
                window.showModernNotification(error.message || "Сталася помилка під час скасування стейкінгу", true);
            } else {
                alert(error.message || "Сталася помилка під час скасування стейкінгу");
            }

            return { success: false, message: error.message };
        }
    }

    /**
     * Ініціалізація обробників подій з покращеним debouncing та throttling
     */
    function initEventListeners() {
        try {
            // Оновлення очікуваної винагороди при зміні суми або періоду
            const amountInput = getElement(DOM.amountInput);
            const periodSelect = getElement(DOM.periodSelect);
            const expectedReward = getElement(DOM.expectedReward);

            if (amountInput && periodSelect && expectedReward) {
                // Покращена функція оновлення очікуваної винагороди з оптимізованим дебаунсингом
                let updateRewardDebounceTimer;
                let lastCalculationTime = 0;
                let lastAmountValue = '';
                let lastPeriodValue = '';
                let pendingCalculation = false;

                const updateReward = () => {
                    // Отримуємо поточні значення
                    const amount = amountInput.value || '0';
                    const period = periodSelect.value || '14';

                    // Якщо значення не змінилися, не оновлюємо
                    if (amount === lastAmountValue && period === lastPeriodValue && !pendingCalculation) {
                        return;
                    }

                    // Зберігаємо поточні значення
                    lastAmountValue = amount;
                    lastPeriodValue = period;

                    // Очищаємо попередній таймер
                    clearTimeout(updateRewardDebounceTimer);

                    // Перевіряємо, чи треба застосувати throttling
                    const now = Date.now();
                    const elapsed = now - lastCalculationTime;

                    // Показуємо анімацію завантаження
                    if (!pendingCalculation) {
                        expectedReward.classList.add('calculating');
                        pendingCalculation = true;
                    }

                    // Встановлюємо затримку залежно від часу, що минув
                    const debounceDelay = elapsed < 1000 ? INPUT_DEBOUNCE_MS : 50;

                    updateRewardDebounceTimer = setTimeout(async () => {
                        try {
                            // Оновлюємо час останнього обчислення
                            lastCalculationTime = Date.now();

                            const numAmount = parseInt(amount) || 0;
                            const numPeriod = parseInt(period) || 14;

                            // Викликаємо API для розрахунку
                            const reward = await calculateExpectedReward(numAmount, numPeriod);

                            if (expectedReward) {
                                // Плавно оновлюємо значення з анімацією
                                const oldValue = parseFloat(expectedReward.textContent) || 0;
                                const newValue = reward;

                                // Видаляємо клас завантаження
                                expectedReward.classList.remove('calculating');

                                // Додаємо анімацію оновлення значення
                                expectedReward.classList.add('value-updated');

                                // Оновлюємо значення з плавною анімацією
                                animateNumberChange(expectedReward, oldValue, newValue, 500);

                                // Видаляємо клас анімації через деякий час
                                setTimeout(() => {
                                    expectedReward.classList.remove('value-updated');
                                }, 1500);
                            }

                            pendingCalculation = false;
                        } catch (e) {
                            console.error("Помилка при оновленні очікуваної винагороди:", e);
                            expectedReward.classList.remove('calculating');
                            pendingCalculation = false;
                        }
                    }, debounceDelay);
                };

                /**
                 * Функція для плавної анімації зміни числа
                 * @param {HTMLElement} element - Елемент для оновлення
                 * @param {number} startValue - Початкове значення
                 * @param {number} endValue - Кінцеве значення
                 * @param {number} duration - Тривалість анімації у мс
                 */
                function animateNumberChange(element, startValue, endValue, duration) {
                    // Якщо значення не змінилося, просто оновлюємо текст
                    if (startValue === endValue) {
                        element.textContent = endValue.toFixed(2);
                        return;
                    }

                    // Початковий час
                    const startTime = performance.now();
                    // Різниця між значеннями
                    const diff = endValue - startValue;

                    // Функція анімації
                    function animate(currentTime) {
                        // Скільки часу пройшло
                        const elapsedTime = currentTime - startTime;
                        // Відсоток завершення анімації
                        const progress = Math.min(elapsedTime / duration, 1);
                        // Застосовуємо easing-функцію для плавності
                        const easedProgress = easeOutCubic(progress);
                        // Обчислюємо поточне значення
                        const currentValue = startValue + diff * easedProgress;

                        // Оновлюємо текст
                        element.textContent = currentValue.toFixed(2);

                        // Продовжуємо анімацію, якщо не завершено
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        }
                    }

                    // Easing функція для плавної анімації
                    function easeOutCubic(x) {
                        return 1 - Math.pow(1 - x, 3);
                    }

                    // Запускаємо анімацію
                    requestAnimationFrame(animate);
                }

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

                        // Додаємо анімацію натискання
                        newMaxButton.classList.add('active');
                        setTimeout(() => {
                            newMaxButton.classList.remove('active');
                        }, 300);
                    }
                });
            }

            // Кнопка "Створення стейкінгу"
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

            // Автоматичне оновлення даних на сторінці з заданим інтервалом і подія
            document.addEventListener('staking-data-refresh', async (event) => {
                const forceRefresh = event.detail && event.detail.force;
                await fetchStakingData(true, forceRefresh);
            });

            // Оптимізації інтерфейсу
            setupScrollOptimization();
            setupSmoothButtonAnimations();
            setupApiRateLimiting();

        } catch (error) {
            console.error('Помилка ініціалізації обробників подій:', error);
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
     * Удосконалена функція для зменшення частоти запитів до API
     * Використовує комбінацію throttling та batch-requests
     */
    function setupApiRateLimiting() {
        // Скидаємо лічильник запитів кожну хвилину
        setInterval(() => {
            _apiRequestsInLastMinute = 0;
        }, API_REQUESTS_RESET_INTERVAL);

        // Зберігаємо запити для можливого батчингу
        const pendingRequests = {};
        let batchTimeout = null;

        // Перехоплюємо оригінальну функцію fetch
        const originalFetch = window.fetch;

        // Заміняємо fetch на нашу версію з обмеженням частоти та батчингом
        window.fetch = function(url, options) {
            // Перевіряємо, чи це API запит
            if (url.includes('/api/')) {
                _apiRequestsInLastMinute++;

                // Генеруємо унікальний ключ для цього запиту
                const requestKey = `${url}_${JSON.stringify(options?.body || '')}`;

                // Перевіряємо, чи такий запит вже в черзі
                if (pendingRequests[requestKey]) {
                    console.log(`Запит дубльований, повторно використовуємо проміс: ${url}`);
                    return pendingRequests[requestKey];
                }

                // Throttling для API запитів - обмежуємо кількість запитів в одиницю часу
                if (_apiRequestsInLastMinute > 20) {
                    const delayTime = API_THROTTLE_MS * (_apiRequestsInLastMinute - 20);
                    console.log(`Застосовуємо throttling: ${delayTime}ms для ${url}`);

                    // Створюємо проміс, який розв'яжеться із затримкою
                    const promise = new Promise((resolve) => {
                        setTimeout(() => {
                            delete pendingRequests[requestKey];
                            resolve(originalFetch(url, options));
                        }, delayTime);
                    });

                    // Зберігаємо проміс для запобігання дублюванню
                    pendingRequests[requestKey] = promise;
                    return promise;
                }

                // Для некритичних запитів можемо об'єднати їх (якщо вони однакові і йдуть підряд)
                if (url.includes('/get') || url.includes('/staking/history')) {
                    // Створюємо проміс для поточного запиту
                    const promise = new Promise((resolve) => {
                        clearTimeout(batchTimeout);
                        batchTimeout = setTimeout(() => {
                            delete pendingRequests[requestKey];
                            resolve(originalFetch(url, options));
                        }, 50); // Маленька затримка для можливого об'єднання запитів
                    });

                    // Зберігаємо проміс
                    pendingRequests[requestKey] = promise;
                    return promise;
                }
            }

            // Для всіх інших запитів використовуємо оригінальний fetch
            return originalFetch(url, options);
        };

        // Додаємо функцію для очищення черги запитів
        window.clearPendingApiRequests = function() {
            Object.keys(pendingRequests).forEach(key => delete pendingRequests[key]);
            console.log('Черга API запитів очищена');
        };
    }

    /**
     * Запобігання множинним запитам при прокрутці сторінки
     */
    function setupScrollOptimization() {
        let scrollTimer = null;
        const scrollThrottleMs = 200;

        window.addEventListener('scroll', () => {
            if (scrollTimer === null) {
                scrollTimer = setTimeout(() => {
                    scrollTimer = null;
                    // Тут можна додати код, який повинен виконуватися після прокрутки
                }, scrollThrottleMs);
            }
        }, { passive: true });
    }

    /**
     * Оптимізація анімації кнопок
     */
    function setupSmoothButtonAnimations() {
        // Знаходимо всі кнопки
        const buttons = document.querySelectorAll('button');

        buttons.forEach(button => {
            // Додаємо плавні переходи
            button.style.transition = 'transform 0.2s ease, opacity 0.2s ease, background-color 0.3s ease';

            // Додаємо обробники для анімації натискання
            button.addEventListener('mousedown', () => {
                button.style.transform = 'scale(0.98)';
            });

            button.addEventListener('mouseup', () => {
                button.style.transform = 'scale(1)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
            });
        });
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
            if (force && window.showModernConfirm) {
                return new Promise((resolve) => {
                    window.showModernConfirm(
                        'Ви впевнені, що хочете примусово відновити стан стейкінгу? Це може скасувати поточний стейкінг.',
                        async () => {
                            try {
                                const result = await performRepair(force);
                                resolve(result);
                            } catch (error) {
                                console.error("Помилка під час відновлення стейкінгу:", error);
                                showMessage(error.message || "Сталася помилка під час відновлення стейкінгу", true);
                                resolve({ success: false, message: error.message });
                            }
                        },
                        () => {
                            resolve({ success: false, message: "Відновлення відмінено користувачем" });
                        }
                    );
                });
            } else if (force) {
                // Якщо немає сучасного підтвердження, використовуємо звичайний confirm
                if (!confirm('Ви впевнені, що хочете примусово відновити стан стейкінгу? Це може скасувати поточний стейкінг.')) {
                    _isProcessingRequest = false;
                    return { success: false, message: 'Відновлення відмінено користувачем' };
                }
            }

            return await performRepair(force);
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

    /**
     * Виконання відновлення стейкінгу
     * @param {boolean} force - Примусове відновлення
     * @returns {Promise<Object>} Результат операції
     */
    async function performRepair(force) {
        try {
            // Перевірка наявності API та ID користувача
            if (!window.WinixAPI || !window.WinixAPI.repairStaking) {
                throw new Error("API модуль не знайдено");
            }

            // Отримуємо ID користувача
            const userId = window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null;

            if (!isValidId(userId)) {
                throw new Error("ID користувача не знайдено");
            }

            // Показуємо індикатор завантаження
            if (typeof showLoading === 'function') {
                showLoading();
            }

            // Викликаємо API для відновлення
            const response = await window.WinixAPI.repairStaking(force);

            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
            }

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
            // Приховуємо індикатор завантаження
            if (typeof hideLoading === 'function') {
                hideLoading();
            }

            throw error;
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

            // Перевіряємо наявність сучасних діалогів введення
            if (window.showModernPrompt) {
                window.showModernPrompt(
                    'Введіть суму для додавання до стейкінгу:',
                    (inputValue) => {
                        const amount = parseInt(inputValue);
                        if (isNaN(amount) || amount <= 0) {
                            showMessage('Введіть коректну суму (ціле додатне число)', true);
                            return;
                        }

                        // Додаємо кошти до стейкінгу
                        addToStaking(amount)
                            .then(result => {
                                if (result.success) {
                                    // Плавно перезавантажуємо сторінку
                                    setTimeout(smoothReload, 1500);
                                }
                            });
                    },
                    'Введіть суму (ціле число)',
                    ''
                );
                return;
            }

            // Якщо немає сучасних діалогів, використовуємо showInputModal
            if (window.showInputModal) {
                window.showInputModal('Введіть суму для додавання до стейкінгу:', function(amount) {
                    const numAmount = parseInt(amount);
                    if (isNaN(numAmount) || numAmount <= 0) {
                        showMessage('Введіть коректну суму (ціле додатне число)', true);
                        return;
                    }

                    // Додаємо кошти до стейкінгу
                    addToStaking(numAmount)
                        .then(result => {
                            if (result.success) {
                                // Плавно перезавантажуємо сторінку
                                setTimeout(smoothReload, 1500);
                            }
                        });
                });
                return;
            }

            // Якщо немає спеціальних функцій введення, використовуємо стандартний prompt
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
                        // Плавно перезавантажуємо сторінку
                        setTimeout(smoothReload, 1500);
                    }
                });
        } catch (error) {
            console.error('Помилка при додаванні до стейкінгу з модального вікна:', error);
            showMessage('Помилка додавання коштів до стейкінгу', true);
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
        optimizedUpdateUI,
        updateButtonsState,
        showStakingModal,
        hideStakingModal,

        // Конфігурація
        config: CONFIG,

        // Події життєвого циклу
        refresh: () => fetchStakingData(true, true),
        startAutoRefresh,
        stopAutoRefresh,

        // Обробники подій кнопок (для використання іншими модулями)
        handleDetailsButton: showStakingModal,
        handleCancelStakingButton: cancelStaking,
        handleAddToStakeButton: handleAddToStakeFromModal,

        // Метод для оновлення відображення стейкінгу (для використання іншими модулями)
        updateStakingDisplay: updateUI,

        // Методи для плавного UI
        smoothReload
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

    // Експорт додаткових функцій
    window.winixStakingFixes = {
        autoRepairStaking,
        showModernConfirm: window.showModernConfirm || function(){},
        showModernNotification: window.showModernNotification || function(){}
    };

    console.log("✅ Модуль стейкінгу успішно ініціалізовано");
})();