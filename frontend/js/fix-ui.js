/**
 * fix-ui.js - виправлення помилок оновлення UI WINIX
 *
 * Цей файл вирішує проблеми TypeError з 'originalUpdateDisplay.apply'
 * та інші помилки, пов'язані з оновленням інтерфейсу
 */

(function() {
    console.log("🔧 Застосування виправлень для UI WINIX...");

    // Виправлення помилки "undefined is not an object (evaluating 'originalUpdateDisplay.apply')"
    window.safeUpdateDisplay = function(element, content) {
        try {
            if (element) {
                if (typeof content === 'undefined' || content === null) {
                    content = '';
                }
                element.textContent = content;
            }
        } catch (e) {
            console.error("Помилка оновлення відображення:", e);
        }
    };

    // Загальне виправлення для всіх функцій оновлення UI
    function patchUIFunction(obj, methodName) {
        if (!obj || !obj[methodName] || typeof obj[methodName] !== 'function') {
            return false;
        }

        const originalMethod = obj[methodName];

        obj[methodName] = function() {
            try {
                return originalMethod.apply(this, arguments);
            } catch (error) {
                console.warn(`Перехоплено помилку в ${methodName}:`, error);

                // Резервний механізм оновлення UI при помилці
                try {
                    // Спроба оновити баланс
                    if (window.WinixCore && window.WinixCore.UI) {
                        window.WinixCore.UI.updateBalanceDisplay();
                    }

                    // Спроба оновити дані стейкінгу
                    updateStakingDataFallback();
                } catch (fallbackError) {
                    console.error("Помилка в резервному оновленні UI:", fallbackError);
                }

                return null;
            }
        };

        return true;
    }

    // Резервний механізм оновлення даних стейкінгу
    function updateStakingDataFallback() {
        try {
            // Елементи стейкінгу
            const expectedRewardElement = document.getElementById('expected-reward');
            if (expectedRewardElement) {
                // Отримуємо значення суми та періоду
                const amountInput = document.getElementById('staking-amount');
                const periodSelect = document.getElementById('staking-period');

                if (amountInput && periodSelect) {
                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    // Розраховуємо локально винагороду
                    const rates = { 7: 4, 14: 9, 28: 15 };
                    const percent = rates[period] || 9;
                    const reward = (amount * percent) / 100;

                    // Оновлюємо відображення
                    expectedRewardElement.textContent = reward.toFixed(2);
                }
            }

            // Оновлюємо статус стейкінгу
            const stakingStatusElement = document.getElementById('staking-status');
            if (stakingStatusElement) {
                // Перевіряємо наявність даних стейкінгу
                let stakingData;
                try {
                    const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                    stakingData = JSON.parse(stakingDataStr);
                } catch (e) {
                    stakingData = null;
                }

                if (stakingData && stakingData.hasActiveStaking) {
                    stakingStatusElement.textContent = `У стейкінгу: ${stakingData.stakingAmount || 0} $WINIX`;
                } else {
                    stakingStatusElement.textContent = "Наразі немає активних стейкінгів";
                }
            }

            // Підключаємо кнопки
            setupButtonsFallback();
        } catch (e) {
            console.error("Помилка резервного оновлення даних стейкінгу:", e);
        }
    }

    // Резервне налаштування кнопок
    function setupButtonsFallback() {
        // Перевірка наявності активного стейкінгу
        let hasStaking = false;
        try {
            const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
            const stakingData = JSON.parse(stakingDataStr);
            hasStaking = stakingData && stakingData.hasActiveStaking === true;
        } catch (e) {
            hasStaking = false;
        }

        // Кнопка "Активний стейкінг"
        const activeStakingButton = document.getElementById('active-staking-button');
        if (activeStakingButton) {
            if (hasStaking) {
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
            if (hasStaking) {
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

    // Виправлення для API запитів стейкінгу
    function patchStakingAPI() {
        if (!window.WinixAPI) return;

        // Фіксимо запит винагороди
        const paths = [
            'calculateExpectedReward',
            'getStakingData',
            'addToStaking',
            'cancelStaking'
        ];

        paths.forEach(path => {
            if (window.WinixAPI[path] && typeof window.WinixAPI[path] === 'function') {
                const original = window.WinixAPI[path];

                window.WinixAPI[path] = function() {
                    return new Promise((resolve, reject) => {
                        original.apply(this, arguments)
                            .then(resolve)
                            .catch(error => {
                                console.warn(`Помилка API ${path}:`, error);

                                // Для calculateExpectedReward робимо локальний розрахунок
                                if (path === 'calculateExpectedReward') {
                                    const args = arguments;
                                    const amount = args[0] || 0;
                                    const period = args[1] || 14;

                                    // Локальний розрахунок винагороди
                                    const rates = { 7: 4, 14: 9, 28: 15 };
                                    const percent = rates[period] || 9;
                                    const reward = (amount * percent) / 100;

                                    resolve({
                                        status: 'success',
                                        data: {
                                            amount: amount,
                                            period: period,
                                            reward: parseFloat(reward.toFixed(2)),
                                            source: 'local_fallback'
                                        }
                                    });
                                } else {
                                    reject(error);
                                }
                            });
                    });
                };
            }
        });
    }

    // Фіксимо проблеми MutationObserver
    function fixMutationObserver() {
        const originalObserve = MutationObserver.prototype.observe;

        if (originalObserve) {
            MutationObserver.prototype.observe = function(target, options) {
                if (!(target instanceof Node)) {
                    console.warn('Помилка: target для MutationObserver не є Node. Ігноруємо.');
                    return;
                }

                return originalObserve.call(this, target, options);
            };
        }
    }

    // Перехоплення помилок для всіх UI функцій
    function patchAllUIFunctions() {
        // WinixCore UI
        if (window.WinixCore && window.WinixCore.UI) {
            patchUIFunction(window.WinixCore.UI, 'updateBalanceDisplay');
            patchUIFunction(window.WinixCore.UI, 'updateTransactionsList');
            patchUIFunction(window.WinixCore.UI, 'updateStakingDisplay');
            patchUIFunction(window.WinixCore.UI, 'showNotification');
        }

        // WinixStakingSystem
        if (window.WinixStakingSystem) {
            patchUIFunction(window.WinixStakingSystem, 'renderStakingDetails');
            patchUIFunction(window.WinixStakingSystem, 'updateButtonsState');
        }

        // Для зворотної сумісності також перевіряємо StakingSystem
        if (window.StakingSystem) {
            patchUIFunction(window.StakingSystem, 'renderStakingDetails');
            patchUIFunction(window.StakingSystem, 'updateButtonsState');
        }
    }

    // Виконуємо всі виправлення
    fixMutationObserver();
    patchStakingAPI();

    // Чекаємо повного завантаження DOM для патчингу UI функцій
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchAllUIFunctions);
    } else {
        patchAllUIFunctions();
    }

    // Перевіряємо наявність оновлення для WinixStakingSystem з StakingSystem
    function migrateStakingSystem() {
        if (window.StakingSystem && !window.WinixStakingSystem) {
            console.log("🔄 Міграція StakingSystem -> WinixStakingSystem");
            window.WinixStakingSystem = Object.assign({}, window.StakingSystem);
        }
    }

    // Викликаємо міграцію негайно і після завантаження DOM
    migrateStakingSystem();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', migrateStakingSystem);
    }

    // Встановлюємо глобальні перехоплювачі помилок
    window.addEventListener('error', function(e) {
        if (e.error && e.error.message && (
            e.error.message.includes('originalUpdateDisplay') ||
            e.error.message.includes('undefined is not an object')
        )) {
            console.warn('Перехоплено помилку UI:', e.error);
            e.preventDefault();
            e.stopPropagation();

            // Спроба оновити UI при помилці
            try {
                updateStakingDataFallback();
            } catch (e) {
                // Ігноруємо додаткові помилки
            }

            return false;
        }
    });

    console.log("✅ Виправлення для UI WINIX успішно застосовані");
})();