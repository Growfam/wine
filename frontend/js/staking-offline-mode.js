/**
 * staking-offline-mode.js
 *
 * Цей скрипт додає функціонал офлайн-режиму для сторінки стейкінгу,
 * щоб запобігти зависанню при відсутності з'єднання з сервером.
 */

(function() {
    console.log("🔄 Ініціалізація офлайн-режиму стейкінгу");

    // Флаг, що показує, чи працюємо в офлайн режимі
    let isOfflineMode = false;

    // Таймаут для визначення зависання сторінки
    let pageLoadTimeout;

    // Функція для визначення, чи є з'єднання з сервером
    function checkServerConnection() {
        return new Promise((resolve) => {
            // Спроба зробити запит до серверу
            fetch('/ping')
                .then(response => {
                    if (response.ok) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                })
                .catch(() => {
                    resolve(false);
                });

            // Встановлюємо таймаут на випадок, якщо запит зависне
            setTimeout(() => resolve(false), 5000);
        });
    }

    // Функція для активації офлайн-режиму
    async function activateOfflineMode() {
        if (isOfflineMode) return; // Запобігаємо повторній активації

        isOfflineMode = true;
        console.log("🔴 Активовано офлайн-режим стейкінгу");

        // Виставляємо порожні дані стейкінгу
        const emptyStakingData = {
            hasActiveStaking: false,
            stakingAmount: 0,
            period: 0,
            rewardPercent: 0,
            expectedReward: 0,
            remainingDays: 0
        };

        // Зберігаємо в localStorage
        localStorage.setItem('stakingData', JSON.stringify(emptyStakingData));
        localStorage.setItem('winix_staking', JSON.stringify(emptyStakingData));

        // Оновлюємо відображення стейкінгу
        updateStakingDisplay();

        // Показуємо повідомлення користувачу
        showOfflineNotification();
    }

    // Функція для оновлення відображення стейкінгу в офлайн-режимі
    function updateStakingDisplay() {
        // Оновлюємо статус стейкінгу
        const stakingStatus = document.getElementById('staking-status');
        if (stakingStatus) {
            stakingStatus.innerHTML = '<span style="color:#ff9800">⚠️ Офлайн-режим</span>: Наразі немає активних стейкінгів';
        }

        // Змінюємо поведінку кнопок
        updateButtonsForOfflineMode();

        // Оновлюємо дані форми
        resetStakingForm();
    }

    // Функція для оновлення поведінки кнопок в офлайн-режимі
    function updateButtonsForOfflineMode() {
        // Змінюємо поведінку кнопки стейкінгу
        const stakeButton = document.getElementById('stake-button');
        if (stakeButton) {
            stakeButton.style.opacity = "0.7";
            stakeButton.style.background = "linear-gradient(90deg, #808080, #A9A9A9)";

            // Зберігаємо оригінальний обробник
            if (!stakeButton.dataset.originalHandler) {
                stakeButton.dataset.originalHandler = stakeButton.onclick ? "true" : "false";
            }

            stakeButton.onclick = function(e) {
                e.preventDefault();
                showNotification("Стейкінг недоступний в офлайн-режимі. Спробуйте пізніше, коли з'явиться з'єднання з сервером.", true);
                return false;
            };
        }

        // Змінюємо поведінку кнопки деталей
        const detailsButton = document.getElementById('details-button');
        if (detailsButton) {
            detailsButton.style.opacity = "0.5";
            detailsButton.style.pointerEvents = "none";
        }

        // Змінюємо поведінку кнопки скасування
        const cancelButton = document.getElementById('cancel-staking-button');
        if (cancelButton) {
            cancelButton.style.opacity = "0.5";
            cancelButton.style.pointerEvents = "none";
        }
    }

    // Функція для скидання форми стейкінгу
    function resetStakingForm() {
        const amountInput = document.getElementById('staking-amount');
        if (amountInput) {
            amountInput.value = "";
        }

        // Оновлюємо очікувану нагороду
        const rewardElement = document.getElementById('expected-reward');
        if (rewardElement) {
            rewardElement.textContent = "0.00";
        }
    }

    // Функція для відображення повідомлення
    function showNotification(message, isError = false) {
        // Якщо є функція simpleAlert, використовуємо її
        if (window.simpleAlert) {
            window.simpleAlert(message, isError);
            return;
        }

        // Інакше створюємо власне повідомлення
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.background = isError ? '#f44336' : '#4CAF50';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        notification.style.zIndex = '9999';
        notification.style.maxWidth = '90%';
        notification.textContent = message;

        document.body.appendChild(notification);

        // Автоматично видаляємо через 3 секунди
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    // Функція для відображення повідомлення про офлайн-режим
    function showOfflineNotification() {
        const offlineBar = document.createElement('div');
        offlineBar.id = 'offline-mode-bar';
        offlineBar.style.position = 'fixed';
        offlineBar.style.top = '0';
        offlineBar.style.left = '0';
        offlineBar.style.right = '0';
        offlineBar.style.background = '#ff9800';
        offlineBar.style.color = 'white';
        offlineBar.style.padding = '5px';
        offlineBar.style.textAlign = 'center';
        offlineBar.style.zIndex = '9999';
        offlineBar.style.fontSize = '14px';
        offlineBar.style.fontWeight = 'bold';
        offlineBar.innerHTML = '⚠️ Офлайн-режим: Деякі функції недоступні';

        if (!document.getElementById('offline-mode-bar')) {
            document.body.appendChild(offlineBar);

            // Додаємо кнопку для повторного підключення
            const reconnectButton = document.createElement('button');
            reconnectButton.textContent = 'Спробувати знову';
            reconnectButton.style.marginLeft = '10px';
            reconnectButton.style.padding = '2px 8px';
            reconnectButton.style.background = 'white';
            reconnectButton.style.color = '#ff9800';
            reconnectButton.style.border = 'none';
            reconnectButton.style.borderRadius = '4px';
            reconnectButton.style.cursor = 'pointer';

            reconnectButton.onclick = async function() {
                const isConnected = await checkServerConnection();
                if (isConnected) {
                    window.location.reload();
                } else {
                    showNotification("Все ще немає з'єднання з сервером. Спробуйте пізніше.", true);
                }
            };

            offlineBar.appendChild(reconnectButton);
        }
    }

    // Основна функція ініціалізації
    function init() {
        console.log("🔄 Ініціалізація стейкінгу в офлайн-режимі");

        // Встановлюємо таймаут для виявлення зависання
        pageLoadTimeout = setTimeout(() => {
            console.warn("⚠️ Виявлено зависання сторінки стейкінгу");
            activateOfflineMode();
        }, 8000);

        // Перевіряємо з'єднання з сервером
        checkServerConnection().then(isConnected => {
            if (!isConnected) {
                activateOfflineMode();
            } else {
                clearTimeout(pageLoadTimeout);
            }
        });

        // Встановлюємо обробник помилок для API запитів
        window.addEventListener('error', function(event) {
            if (event.message && event.message.includes('API')) {
                console.warn("⚠️ Виявлено помилку API:", event.message);
                activateOfflineMode();
            }
        });

        // Встановлюємо обробник незавершених промісів
        window.addEventListener('unhandledrejection', function(event) {
            console.warn("⚠️ Незавершений проміс:", event.reason);
            if (event.reason && (
                event.reason.toString().includes('API') ||
                event.reason.toString().includes('404') ||
                event.reason.toString().includes('timeout')
            )) {
                activateOfflineMode();
            }
        });
    }

    // Експортуємо публічний API
    window.StakingOfflineMode = {
        init,
        activateOfflineMode,
        isOfflineMode: () => isOfflineMode,
        updateStakingDisplay,
        showNotification
    };

    // Запускаємо ініціалізацію
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();