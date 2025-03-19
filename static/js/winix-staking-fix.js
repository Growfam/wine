/**
 * winix-staking-fix.js
 *
 * Спеціальний файл для виправлення проблем зі стейкінгом в системі WINIX.
 * Цей файл має бути підключений останнім після всіх інших скриптів системи.
 */

(function() {
    console.log("🔄 WINIX-STAKING-FIX: Запуск виправлень системи стейкінгу...");

    // Приховуємо обробники подій, встановлені раніше
    window.eventListenersFixed = false;

    // Перевіряємо наявність основної системи
    if (!window.WinixCore || !window.WinixCore.Staking) {
        console.error("❌ WINIX-STAKING-FIX: Відсутня основна система! Неможливо виправити стейкінг.");
        return;
    }

    /**
     * Глибоке виправлення даних стейкінгу
     */
    function deepFixStakingData() {
        try {
            console.log("🔧 WINIX-STAKING-FIX: Глибоке виправлення даних стейкінгу...");

            // Отримуємо дані з localStorage
            const coreData = localStorage.getItem('winix_staking');
            console.log("WINIX-STAKING-FIX: Дані в localStorage:", coreData);

            if (!coreData) {
                console.log("WINIX-STAKING-FIX: Дані стейкінгу відсутні");
                return false;
            }

            // Розпаковуємо дані
            let stakingData;
            try {
                stakingData = JSON.parse(coreData);
                console.log("WINIX-STAKING-FIX: Розпаковані дані:", stakingData);
            } catch (e) {
                console.error("WINIX-STAKING-FIX: Помилка розпакування даних:", e);
                return false;
            }

            // Виправляємо дані, якщо потрібно
            let needsFixing = false;

            // Перевіряємо hasActiveStaking
            if (stakingData.stakingAmount > 0 && stakingData.hasActiveStaking !== true) {
                stakingData.hasActiveStaking = true;
                needsFixing = true;
                console.log("WINIX-STAKING-FIX: Виправлення hasActiveStaking");
            }

            // Перевіряємо очікувану винагороду
            if (stakingData.expectedReward === undefined && stakingData.stakingAmount > 0 && stakingData.period) {
                // Розраховуємо винагороду
                let rewardPercent = 7; // За замовчуванням

                if (stakingData.period === 7) rewardPercent = 3;
                else if (stakingData.period === 14) rewardPercent = 7;
                else if (stakingData.period === 28) rewardPercent = 15;

                stakingData.rewardPercent = rewardPercent;
                stakingData.expectedReward = stakingData.stakingAmount * (rewardPercent / 100);
                needsFixing = true;
                console.log("WINIX-STAKING-FIX: Виправлення expectedReward");
            }

            // Перевіряємо дати
            if (!stakingData.startDate) {
                const now = new Date();
                stakingData.startDate = now.toISOString();
                needsFixing = true;
                console.log("WINIX-STAKING-FIX: Виправлення startDate");
            }

            if (!stakingData.endDate && stakingData.startDate && stakingData.period) {
                const startDate = new Date(stakingData.startDate);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + stakingData.period);
                stakingData.endDate = endDate.toISOString();
                needsFixing = true;
                console.log("WINIX-STAKING-FIX: Виправлення endDate");
            }

            // Зберігаємо виправлені дані, якщо були зміни
            if (needsFixing) {
                localStorage.setItem('winix_staking', JSON.stringify(stakingData));
                localStorage.setItem('stakingData', JSON.stringify(stakingData));
                console.log("✅ WINIX-STAKING-FIX: Дані стейкінгу успішно виправлено");
                return true;
            }

            console.log("ℹ️ WINIX-STAKING-FIX: Виправлення даних не потрібне");
            return false;
        } catch (e) {
            console.error("❌ WINIX-STAKING-FIX: Помилка виправлення даних стейкінгу:", e);
            return false;
        }
    }

    /**
     * Додаткова допоміжна функція для WinixCore
     */
    function enhanceWinixCore() {
        try {
            console.log("🔧 WINIX-STAKING-FIX: Розширення WinixCore...");

            // Додаємо метод для відновлення стейкінгу
            window.WinixCore.Staking.restoreStaking = function() {
                return deepFixStakingData();
            };

            // Замінюємо методи WinixCore для більш надійної роботи
            const originalHasActiveStaking = window.WinixCore.Staking.hasActiveStaking;
            window.WinixCore.Staking.hasActiveStaking = function() {
                // Спочатку перевіряємо дані стейкінгу
                const stakingDataRaw = localStorage.getItem('winix_staking');
                if (stakingDataRaw) {
                    try {
                        const data = JSON.parse(stakingDataRaw);
                        // Якщо є стейкінг, але немає флага, то виправляємо
                        if (data.stakingAmount > 0 && !data.hasActiveStaking) {
                            data.hasActiveStaking = true;
                            localStorage.setItem('winix_staking', JSON.stringify(data));
                            console.log("WINIX-STAKING-FIX: Виправлено флаг hasActiveStaking");
                        }
                    } catch (e) {
                        console.error("WINIX-STAKING-FIX: Помилка перевірки даних стейкінгу:", e);
                    }
                }

                // Викликаємо оригінальний метод
                return originalHasActiveStaking.call(window.WinixCore.Staking);
            };

            // Додаємо кнопку відновлення стейкінгу (тільки для сторінки деталей стейкінгу)
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            if (currentPage === 'staking-details' && !document.getElementById('restore-staking-button')) {
                const buttonsContainer = document.querySelector('.buttons-container');
                if (buttonsContainer) {
                    const restoreButton = document.createElement('button');
                    restoreButton.id = 'restore-staking-button';
                    restoreButton.className = 'btn btn-secondary';
                    restoreButton.textContent = 'Відновити стейкінг';
                    restoreButton.style.marginTop = '10px';

                    restoreButton.addEventListener('click', function() {
                        const result = window.WinixCore.Staking.restoreStaking();
                        if (result) {
                            window.WinixCore.UI.showNotification("Дані стейкінгу відновлено! Оновіть сторінку.", window.WinixCore.MESSAGE_TYPES.SUCCESS,
                                () => window.location.reload());
                        } else {
                            window.WinixCore.UI.showNotification("Відновлення не потрібне або неможливе", window.WinixCore.MESSAGE_TYPES.INFO);
                        }
                    });

                    buttonsContainer.appendChild(restoreButton);
                }
            }

            console.log("✅ WINIX-STAKING-FIX: WinixCore успішно розширено");
            return true;
        } catch (e) {
            console.error("❌ WINIX-STAKING-FIX: Помилка розширення WinixCore:", e);
            return false;
        }
    }

    /**
     * Виправлення обробників подій стейкінгу без створення дублікатів
     */
    function fixEventHandlers() {
        // Перевіряємо, чи вже виправлено
        if (window.eventListenersFixed) {
            console.log("ℹ️ WINIX-STAKING-FIX: Обробники подій вже виправлено");
            return false;
        }

        try {
            // Перевіряємо, чи ми на сторінці стейкінгу або деталей стейкінгу
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            if (currentPage !== 'staking' && currentPage !== 'staking-details') return false;

            console.log("🔧 WINIX-STAKING-FIX: Виправлення обробників подій для сторінки", currentPage);

            if (currentPage === 'staking-details') {
                // Видаляємо всі існуючі обробники з document, щоб запобігти дублюванню
                // Це вирішує проблему додаткових обробників, доданих через делегування
                const oldHtmlElement = document.documentElement;
                const newHtmlElement = oldHtmlElement.cloneNode(true);
                oldHtmlElement.parentNode.replaceChild(newHtmlElement, oldHtmlElement);

                // Додаємо обробники подій наново
                setTimeout(() => {
                    // Кнопка додавання до стейкінгу
                    const addButton = document.getElementById('add-to-stake-button');
                    if (addButton) {
                        console.log("WINIX-STAKING-FIX: Налаштування кнопки додавання до стейкінгу");
                        addButton.addEventListener('click', async function(event) {
                            // Блокуємо стандартну поведінку та спливання події
                            event.preventDefault();
                            event.stopPropagation();

                            // Запитуємо суму для додавання
                            const amount = prompt("Введіть суму для додавання до стейкінгу:");

                            if (amount === null) return; // Натиснуто "Скасувати"

                            const numAmount = parseFloat(amount);
                            if (isNaN(numAmount) || numAmount <= 0) {
                                window.WinixCore.UI.showNotification("Введіть коректну суму", window.WinixCore.MESSAGE_TYPES.ERROR);
                                return;
                            }

                            // Перевіряємо дані стейкінгу
                            deepFixStakingData();

                            console.log("WINIX-STAKING-FIX: Виклик addToStaking з сумою:", numAmount);
                            const result = window.WinixCore.Staking.addToStaking(numAmount);
                            console.log("WINIX-STAKING-FIX: Результат addToStaking:", result);

                            if (result.success) {
                                window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.SUCCESS);
                                // Оновлюємо відображення
                                setTimeout(() => {
                                    window.WinixCore.UI.updateStakingDisplay();
                                }, 300);
                            } else {
                                window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.ERROR);
                            }

                            // Запобігаємо всплиттю події
                            return false;
                        });
                    }

                    // Кнопка скасування стейкінгу
                    const cancelButton = document.getElementById('cancel-staking-button');
                    if (cancelButton) {
                        console.log("WINIX-STAKING-FIX: Налаштування кнопки скасування стейкінгу");
                        cancelButton.addEventListener('click', function(event) {
                            // Блокуємо стандартну поведінку та спливання події
                            event.preventDefault();
                            event.stopPropagation();

                            // Перевіряємо дані стейкінгу
                            deepFixStakingData();

                            // Перевіряємо наявність стейкінгу
                            const hasStaking = window.WinixCore.Staking.hasActiveStaking();
                            console.log("WINIX-STAKING-FIX: Наявність стейкінгу:", hasStaking);

                            if (!hasStaking) {
                                window.WinixCore.UI.showNotification("У вас немає активного стейкінгу", window.WinixCore.MESSAGE_TYPES.WARNING);
                                // Повторно виправляємо дані та оновлюємо інтерфейс
                                deepFixStakingData();
                                setTimeout(() => {
                                    window.WinixCore.UI.updateStakingDisplay();
                                }, 300);
                                return false;
                            }

                            if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано 20% від суми стейкінгу як штраф.")) {
                                console.log("WINIX-STAKING-FIX: Виклик cancelStaking");
                                const result = window.WinixCore.Staking.cancelStaking();
                                console.log("WINIX-STAKING-FIX: Результат cancelStaking:", result);

                                if (result.success) {
                                    window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.SUCCESS,
                                        () => window.navigateTo('wallet.html'));
                                } else {
                                    window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.ERROR);
                                }
                            }

                            // Запобігаємо всплиттю події
                            return false;
                        });
                    }

                    window.eventListenersFixed = true;
                }, 100);
            }

            console.log("✅ WINIX-STAKING-FIX: Обробники подій успішно налаштовано");
            return true;
        } catch (e) {
            console.error("❌ WINIX-STAKING-FIX: Помилка виправлення обробників подій:", e);
            return false;
        }
    }

    // Запускаємо виправлення після повного завантаження сторінки з затримкою
    // щоб інші скрипти встигли встановити свої обробники
    window.addEventListener('load', function() {
        setTimeout(function() {
            // Виправляємо дані стейкінгу
            deepFixStakingData();

            // Розширюємо WinixCore
            enhanceWinixCore();

            // Виправляємо обробники подій
            fixEventHandlers();

            console.log("✅ WINIX-STAKING-FIX: Всі виправлення застосовано");
        }, 1000); // Збільшуємо затримку до 1000 мс
    });

    // Якщо сторінка вже завантажена
    if (document.readyState === 'complete') {
        setTimeout(function() {
            // Виправляємо дані стейкінгу
            deepFixStakingData();

            // Розширюємо WinixCore
            enhanceWinixCore();

            // Виправляємо обробники подій
            fixEventHandlers();

            console.log("✅ WINIX-STAKING-FIX: Всі виправлення застосовано (сторінка вже завантажена)");
        }, 1000); // Збільшуємо затримку до 1000 мс
    }

    console.log("✅ WINIX-STAKING-FIX: Модуль виправлень стейкінгу ініціалізовано");
})();