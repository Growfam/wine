(function() {
    console.log("🔒 Монтуємо захист від подвійних модальних вікон...");

    // Запобігти дублюванню
    if (window.modalFixApplied) return;
    window.modalFixApplied = true;

    // Зберігаємо справжні функції до того, як їх хтось перевизначить
    const originalFunctions = {
        createInputModal: window.createInputModal,
        simpleAlert: window.simpleAlert,
        showNotification: window.showNotification
    };

    // Зберігаємо стан відкритих вікон
    let modalState = {
        isModalOpen: false,
        isAlertOpen: false,
        isNotificationOpen: false,
        lastOpenTime: 0
    };

    // Створюємо стилі для наших модальних вікон
    const styles = document.createElement('style');
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
        }
        
        .modal-fix-title {
            font-size: 18px;
            font-weight: 500;
            text-align: center;
            color: #fff;
            margin-bottom: 5px;
            text-shadow: 0 0 10px rgba(0, 201, 167, 0.5);
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
    `;
    document.head.appendChild(styles);

    // ПОВНА заміна функції createInputModal
    window.createInputModal = function(title, onConfirm) {
        console.log("🔒 Використовуємо захищену версію createInputModal:", title);

        // Запобігаємо подвійному відкриттю
        if (modalState.isModalOpen || Date.now() - modalState.lastOpenTime < 500) {
            console.log("🚫 Запобігаємо подвійному відкриттю модального вікна");
            return null;
        }

        modalState.isModalOpen = true;
        modalState.lastOpenTime = Date.now();

        // Видаляємо всі існуючі модальні вікна
        document.querySelectorAll('.modal-overlay, .winix-modal-overlay, .alert-overlay, .modal-fix-overlay').forEach(modal => modal.remove());

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
            modalState.isModalOpen = false;
        };

        confirmButton.onclick = function() {
            const amount = parseFloat(input.value);
            if (isNaN(amount) || amount <= 0) {
                input.style.borderColor = '#ff3860';
                setTimeout(() => input.style.borderColor = '', 500);
                return;
            }
            overlay.remove();
            modalState.isModalOpen = false;
            if (typeof onConfirm === 'function') {
                onConfirm(amount);
            }
        };

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

    console.log("✅ Захист від подвійних модальних вікон активовано");
})();