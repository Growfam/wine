/**
 * modal-fix.js
 * Уніфікована система для управління модальними вікнами у WINIX.
 * Цей файл має бути підключений ОСТАННІМ, після всіх інших скриптів.
 */

(function() {
    console.log("🔒 Запуск єдиної системи модальних вікон WINIX...");

    // Запобігання повторній ініціалізації
    if (window.WinixModalSystem) {
        console.log("⚠️ Систему модальних вікон вже ініціалізовано");
        return;
    }

    // Створюємо глобальний об'єкт для керування модальними вікнами
    window.WinixModalSystem = {
        // Стан модальних вікон
        state: {
            isModalOpen: false,
            isAlertOpen: false,
            isNotificationOpen: false,
            lastOpenTime: 0
        },

        // Оригінальні функції, якщо потрібно буде відновити
        originalFunctions: {
            createInputModal: window.createInputModal,
            simpleAlert: window.simpleAlert,
            showNotification: window.showNotification
        },

        // Функція видалення всіх модальних вікон
        removeAllModals: function() {
            document.querySelectorAll('.modal-overlay, .winix-modal-overlay, .alert-overlay, .modal-fix-overlay').forEach(modal => {
                try {
                    modal.remove();
                } catch (e) {
                    console.error("Помилка при видаленні модального вікна:", e);
                }
            });
            this.state.isModalOpen = false;
            this.state.isAlertOpen = false;
        },

        // Функція видалення всіх сповіщень
        removeAllNotifications: function() {
            document.querySelectorAll('.winix-notification, .notification, .toast-message.show').forEach(notification => {
                try {
                    if (notification.classList.contains('toast-message')) {
                        notification.classList.remove('show');
                    } else {
                        notification.remove();
                    }
                } catch (e) {
                    console.error("Помилка при видаленні сповіщення:", e);
                }
            });
            this.state.isNotificationOpen = false;
        }
    };

    // Створюємо стилі для наших модальних вікон
    const styles = document.createElement('style');
    styles.id = 'winix-modal-styles';
    styles.innerHTML = `
        .modal-fix-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
            animation: winix-fade-in 0.2s ease-out;
        }
        
        .modal-fix-container {
            width: 85%;
            max-width: 350px;
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(15, 52, 96, 0.95));
            border-radius: 20px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 201, 167, 0.3);
            border: 1px solid rgba(0, 201, 167, 0.2);
            display: flex;
            flex-direction: column;
            gap: 20px;
            animation: winix-slide-up 0.3s ease-out;
        }
        
        .modal-fix-container.error {
            background: linear-gradient(135deg, rgba(46, 26, 26, 0.95), rgba(96, 15, 15, 0.95));
            border: 1px solid rgba(201, 0, 0, 0.2);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(201, 0, 0, 0.3);
        }
        
        .modal-fix-title {
            font-size: 18px;
            font-weight: 500;
            text-align: center;
            color: #fff;
            margin-bottom: 5px;
            text-shadow: 0 0 10px rgba(0, 201, 167, 0.5);
        }
        
        .modal-fix-message {
            text-align: center;
            font-size: 16px;
            color: #fff;
            margin-bottom: 10px;
        }
        
        .modal-fix-input {
            width: 100%;
            height: 45px;
            background: rgba(20, 30, 60, 0.6);
            border: 1px solid rgba(0, 201, 167, 0.3);
            border-radius: 12px;
            padding: 0 15px;
            color: #fff;
            font-size: 16px;
            box-sizing: border-box;
            transition: all 0.3s ease;
            box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.2);
            margin-bottom: 10px;
        }
        
        .modal-fix-input:focus {
            outline: none;
            border-color: rgba(0, 201, 167, 0.8);
            box-shadow: 0 0 10px rgba(0, 201, 167, 0.4), inset 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        
        .modal-fix-input.error {
            border-color: #ff3860;
            animation: winix-shake 0.5s;
        }
        
        .modal-fix-buttons {
            display: flex;
            justify-content: space-between;
            gap: 15px;
        }
        
        .modal-fix-button {
            flex: 1;
            height: 45px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            border: none;
        }
        
        .modal-fix-button.cancel {
            background: rgba(30, 39, 70, 0.6);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .modal-fix-button.confirm {
            background: linear-gradient(90deg, #2D6EB6, #52C0BD);
            color: #fff;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .modal-fix-button:active {
            transform: scale(0.97);
        }
        
        /* Анімації */
        @keyframes winix-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes winix-slide-up {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes winix-shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        /* Стилі для сповіщень */
        .winix-notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            background: linear-gradient(90deg, rgba(10, 20, 40, 0.95), rgba(20, 40, 80, 0.95));
            border-radius: 15px;
            color: white;
            font-size: 16px;
            min-width: 250px;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
            z-index: 9999;
            animation: winix-notification-in 0.5s forwards;
            border: 1px solid rgba(0, 201, 167, 0.3);
        }
        
        .winix-notification.success {
            background: linear-gradient(90deg, rgba(10, 40, 20, 0.95), rgba(0, 60, 40, 0.95));
            border: 1px solid rgba(0, 201, 167, 0.5);
        }
        
        .winix-notification.error {
            background: linear-gradient(90deg, rgba(40, 10, 10, 0.95), rgba(60, 0, 0, 0.95));
            border: 1px solid rgba(201, 0, 0, 0.5);
        }
        
        @keyframes winix-notification-in {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }
    `;
    document.head.appendChild(styles);

    // Заміна функції створення модального вікна
    window.createInputModal = function(title, onConfirm) {
        console.log("🔒 Виклик createInputModal:", title);

        // Запобігаємо подвійному відкриттю
        if (WinixModalSystem.state.isModalOpen ||
           (Date.now() - WinixModalSystem.state.lastOpenTime < 500)) {
            console.log("🚫 Запобігаємо подвійному відкриттю модального вікна");
            return null;
        }

        // Оновлюємо стан
        WinixModalSystem.state.isModalOpen = true;
        WinixModalSystem.state.lastOpenTime = Date.now();

        // Видаляємо всі існуючі модальні вікна
        WinixModalSystem.removeAllModals();

        // Створюємо модальне вікно
        const overlay = document.createElement('div');
        overlay.className = 'modal-fix-overlay';

        const container = document.createElement('div');
        container.className = 'modal-fix-container';

        const modalTitle = document.createElement('div');
        modalTitle.className = 'modal-fix-title';
        modalTitle.textContent = title || 'Введіть суму:';

        const input = document.createElement('input');
        input.className = 'modal-fix-input';
        input.type = 'number';
        input.min = '0';
        input.step = 'any';
        input.placeholder = 'Введіть суму';

        // Спробуємо отримати доступний баланс
        try {
            let balance = 0;
            if (window.WinixCore && window.WinixCore.Balance) {
                balance = window.WinixCore.Balance.getTokens();
            } else if (window.balanceSystem) {
                balance = window.balanceSystem.getTokens();
            } else {
                balance = parseFloat(localStorage.getItem('userTokens') || '0');
            }
            input.placeholder = `Введіть суму (макс: ${balance.toFixed(2)})`;
        } catch (e) {
            console.error("Помилка при отриманні балансу:", e);
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-fix-buttons';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'modal-fix-button cancel';
        cancelButton.textContent = 'Скасувати';

        const confirmButton = document.createElement('button');
        confirmButton.className = 'modal-fix-button confirm';
        confirmButton.textContent = 'OK';

        // Додаємо обробники
        cancelButton.onclick = function() {
            overlay.remove();
            WinixModalSystem.state.isModalOpen = false;
        };

        confirmButton.onclick = function() {
            const amount = parseFloat(input.value);
            if (isNaN(amount) || amount <= 0) {
                input.classList.add('error');
                setTimeout(() => input.classList.remove('error'), 500);
                return;
            }
            overlay.remove();
            WinixModalSystem.state.isModalOpen = false;
            if (typeof onConfirm === 'function') {
                onConfirm(amount);
            }
        };

        // Обробник клавіші Enter
        input.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                confirmButton.click();
            }
        });

        // Збираємо вікно
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        container.appendChild(modalTitle);
        container.appendChild(input);
        container.appendChild(buttonContainer);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Фокус на полі
        setTimeout(() => input.focus(), 100);

        return overlay;
    };

    // Заміна функції для показу повідомлень
    window.simpleAlert = function(message, isError = false, callback) {
        console.log("🔒 Виклик simpleAlert:", message, isError ? "(помилка)" : "");

        return new Promise((resolve) => {
            // Видаляємо всі існуючі модальні вікна
            WinixModalSystem.removeAllModals();

            // Оновлюємо стан
            WinixModalSystem.state.isAlertOpen = true;

            // Створюємо елементи повідомлення
            const overlay = document.createElement('div');
            overlay.className = 'modal-fix-overlay';

            const container = document.createElement('div');
            container.className = 'modal-fix-container' + (isError ? ' error' : '');

            const messageElement = document.createElement('div');
            messageElement.className = 'modal-fix-message';
            messageElement.textContent = message;

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'modal-fix-buttons';

            const confirmButton = document.createElement('button');
            confirmButton.className = 'modal-fix-button confirm';
            confirmButton.textContent = 'OK';
            confirmButton.style.width = '100%';

            // Додаємо обробник для кнопки
            confirmButton.onclick = function() {
                overlay.remove();
                WinixModalSystem.state.isAlertOpen = false;
                if (typeof callback === 'function') {
                    callback();
                }
                resolve();
            };

            // Збираємо елементи
            buttonContainer.appendChild(confirmButton);
            container.appendChild(messageElement);
            container.appendChild(buttonContainer);
            overlay.appendChild(container);
            document.body.appendChild(overlay);
        });
    };

    // Заміна функції для показу сповіщень
    window.showNotification = function(message, type = 'info', duration = 3000) {
        console.log("🔒 Виклик showNotification:", message, type);

        // Видаляємо всі існуючі сповіщення
        WinixModalSystem.removeAllNotifications();

        // Оновлюємо стан
        WinixModalSystem.state.isNotificationOpen = true;

        // Створюємо елемент сповіщення
        const notification = document.createElement('div');
        notification.className = 'winix-notification';
        notification.textContent = message;

        // Додаємо клас залежно від типу
        if (type === 'success' || type === 'SUCCESS') {
            notification.classList.add('success');
        } else if (type === 'error' || type === 'ERROR') {
            notification.classList.add('error');
        }

        // Додаємо сповіщення до сторінки
        document.body.appendChild(notification);

        // Видаляємо сповіщення після певного часу
        setTimeout(() => {
            try {
                notification.remove();
                WinixModalSystem.state.isNotificationOpen = false;
            } catch (e) {
                console.error("Помилка при видаленні сповіщення:", e);
            }
        }, duration);

        return notification;
    };

    // Додаємо функцію showToast як альтернативу showNotification
    window.showToast = function(message, duration = 3000) {
        return window.showNotification(message, 'info', duration);
    };

    // Експортуємо для можливого використання в інших місцях
    window.winixUI = window.winixUI || {};
    window.winixUI.simpleAlert = window.simpleAlert;
    window.winixUI.showNotification = window.showNotification;
    window.winixUI.showToast = window.showToast;

    console.log("✅ Єдину систему модальних вікон WINIX успішно активовано");
})();