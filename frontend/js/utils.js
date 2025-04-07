/**
 * ui.js - Елементи інтерфейсу WINIX
 */

(function() {
    'use strict';

    console.log("🔄 UI: Ініціалізація елементів інтерфейсу");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Прапорець для індикатора завантаження
    let _loaderVisible = false;

    // Прапорець для запобігання рекурсивним сповіщенням
    let _isShowingNotification = false;

    // Остання показана помилка
    let _lastErrorNotificationTime = 0;
    let _lastErrorMessage = '';

    // ======== ІНДИКАТОРИ ЗАВАНТАЖЕННЯ ========

    /**
     * Показати індикатор завантаження
     * @param {string} message - Повідомлення
     */
    function showLoading(message = 'Завантаження...') {
        try {
            // Якщо індикатор вже показаний, просто оновлюємо повідомлення
            if (_loaderVisible) {
                const loaderMessage = document.querySelector('#loading-spinner .message');
                if (loaderMessage) loaderMessage.textContent = message;
                return;
            }

            // Створюємо індикатор, якщо його немає
            let loader = document.getElementById('loading-spinner');

            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'loading-spinner';
                loader.innerHTML = `
                    <div class="spinner"></div>
                    <div class="message">${message}</div>
                `;

                // Додаємо стилі
                loader.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                `;

                // Додаємо лічильник використань
                loader.dataset.useCount = '1';

                document.body.appendChild(loader);
            } else {
                // Якщо індикатор вже існує, оновлюємо повідомлення
                const loaderMessage = loader.querySelector('.message');
                if (loaderMessage) loaderMessage.textContent = message;

                // Оновлюємо лічильник використань
                const useCount = parseInt(loader.dataset.useCount || '0') + 1;
                loader.dataset.useCount = useCount.toString();

                // Показуємо індикатор
                loader.style.display = 'flex';
            }

            _loaderVisible = true;
        } catch (e) {
            console.error('Помилка показу індикатора завантаження:', e);
        }
    }

    /**
     * Приховати індикатор завантаження
     */
    function hideLoading() {
        try {
            const loader = document.getElementById('loading-spinner');
            if (!loader) {
                _loaderVisible = false;
                return;
            }

            // Зменшуємо лічильник використань
            let useCount = parseInt(loader.dataset.useCount || '1') - 1;

            // Якщо лічильник досяг нуля, приховуємо індикатор
            if (useCount <= 0) {
                loader.style.display = 'none';
                loader.dataset.useCount = '0';
                _loaderVisible = false;
            } else {
                // Інакше просто оновлюємо лічильник
                loader.dataset.useCount = useCount.toString();
            }
        } catch (e) {
            console.error('Помилка приховування індикатора завантаження:', e);
            _loaderVisible = false;
        }
    }

    // ======== ПОВІДОМЛЕННЯ ========

    /**
     * Показати повідомлення користувачу
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи є повідомлення помилкою
     * @param {Function} callback - Функція зворотного виклику
     */
    function showNotification(message, isError = false, callback = null) {
        // Запобігаємо показу порожніх повідомлень
        if (!message || message.trim() === '') {
            if (callback) setTimeout(callback, 100);
            return;
        }

        try {
            // Запобігаємо рекурсивним викликам
            if (_isShowingNotification) {
                // Якщо рекурсивний виклик, використовуємо alert
                if (isError) alert(message);
                if (callback) setTimeout(callback, 100);
                return;
            }

            _isShowingNotification = true;

            // Перевіряємо, чи контейнер для повідомлень вже існує
            let container = document.getElementById('notification-container');

            if (!container) {
                container = document.createElement('div');
                container.id = 'notification-container';
                container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    width: 300px;
                `;
                document.body.appendChild(container);
            }

            // Створюємо повідомлення
            const notification = document.createElement('div');
            notification.className = `notification ${isError ? 'error' : 'success'}`;
            notification.innerHTML = message;
            notification.style.cssText = `
                padding: 15px 20px;
                margin-bottom: 10px;
                border-radius: 8px;
                color: white;
                animation: slideIn 0.3s ease;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                cursor: pointer;
                background-color: ${isError ? '#e74c3c' : '#2ecc71'};
            `;

            // Додаємо анімацію
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);

            // Додаємо повідомлення до контейнера
            container.appendChild(notification);

            // Закриття повідомлення при кліку
            notification.addEventListener('click', () => {
                notification.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            });

            // Автоматичне закриття
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    notification.remove();
                    if (callback) callback();
                }, 300);
            }, 5000);

            _isShowingNotification = false;
        } catch (e) {
            console.error('Помилка показу повідомлення:', e);

            // Якщо не вдалося створити повідомлення, використовуємо alert
            alert(message);
            if (callback) callback();

            _isShowingNotification = false;
        }
    }

    /**
     * Показати модерне повідомлення з підтвердженням
     * @param {string} message - Повідомлення
     * @param {Function} onConfirm - Функція для підтвердження
     * @param {Function} onCancel - Функція для скасування
     */
    function showModernConfirm(message, onConfirm, onCancel) {
        try {
            // Перевіряємо, чи overlay вже існує
            let overlay = document.getElementById('dialog-overlay');

            if (!overlay) {
                // Створюємо основні елементи
                overlay = document.createElement('div');
                overlay.id = 'dialog-overlay';
                overlay.className = 'modern-dialog-overlay';

                const dialog = document.createElement('div');
                dialog.id = 'dialog';
                dialog.className = 'modern-dialog';

                const title = document.createElement('div');
                title.id = 'dialog-title';
                title.className = 'modern-dialog-title';
                title.textContent = 'Підтвердження';

                const content = document.createElement('div');
                content.id = 'dialog-content';
                content.className = 'modern-dialog-content';

                const buttons = document.createElement('div');
                buttons.className = 'modern-dialog-buttons';

                const cancelButton = document.createElement('button');
                cancelButton.id = 'dialog-cancel';
                cancelButton.className = 'modern-dialog-button modern-dialog-button-secondary';
                cancelButton.textContent = 'Скасувати';

                const confirmButton = document.createElement('button');
                confirmButton.id = 'dialog-confirm';
                confirmButton.className = 'modern-dialog-button modern-dialog-button-primary';
                confirmButton.textContent = 'Підтвердити';

                // Збираємо структуру
                buttons.appendChild(cancelButton);
                buttons.appendChild(confirmButton);
                dialog.appendChild(title);
                dialog.appendChild(content);
                dialog.appendChild(buttons);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                // Додаємо стилі для модального вікна
                const style = document.createElement('style');
                style.textContent = `
                    .modern-dialog-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.7);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 2000;
                        opacity: 0;
                        visibility: hidden;
                        transition: opacity 0.3s, visibility 0.3s;
                    }
                    .modern-dialog-overlay.active {
                        opacity: 1;
                        visibility: visible;
                    }
                    .modern-dialog {
                        background: rgba(30, 39, 70, 0.8);
                        border-radius: 1.5rem;
                        padding: 1.5rem;
                        width: 90%;
                        max-width: 350px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                        border: 1px solid rgba(78, 181, 247, 0.2);
                        transform: scale(0.9);
                        opacity: 0;
                        transition: transform 0.3s, opacity 0.3s;
                    }
                    .modern-dialog-overlay.active .modern-dialog {
                        transform: scale(1);
                        opacity: 1;
                    }
                    .modern-dialog-title {
                        font-size: 1.25rem;
                        font-weight: bold;
                        margin-bottom: 1rem;
                        color: #4eb5f7;
                        text-align: center;
                    }
                    .modern-dialog-content {
                        margin-bottom: 1.5rem;
                        text-align: center;
                        color: white;
                    }
                    .modern-dialog-buttons {
                        display: flex;
                        justify-content: center;
                        gap: 1rem;
                    }
                    .modern-dialog-button {
                        padding: 0.75rem 1.25rem;
                        border: none;
                        border-radius: 0.75rem;
                        font-size: 1rem;
                        font-weight: bold;
                        cursor: pointer;
                        transition: transform 0.2s, background-color 0.2s;
                    }
                    .modern-dialog-button:active {
                        transform: scale(0.98);
                    }
                    .modern-dialog-button-primary {
                        background: linear-gradient(90deg, #1A1A2E, #0F3460, #00C9A7);
                        color: white;
                    }
                    .modern-dialog-button-secondary {
                        background: rgba(255, 255, 255, 0.1);
                        color: white;
                    }
                `;
                document.head.appendChild(style);
            }

            // Отримуємо елементи діалогу
            const dialog = document.getElementById('dialog');
            const dialogTitle = document.getElementById('dialog-title');
            const dialogContent = document.getElementById('dialog-content');
            const dialogCancel = document.getElementById('dialog-cancel');
            const dialogConfirm = document.getElementById('dialog-confirm');

            // Оновлюємо вміст
            dialogContent.textContent = message;

            // Оновлюємо обробники подій
            const closeDialog = () => {
                overlay.classList.remove('active');
            };

            dialogCancel.onclick = () => {
                closeDialog();
                if (onCancel) onCancel();
            };

            dialogConfirm.onclick = () => {
                closeDialog();
                if (onConfirm) onConfirm();
            };

            // Відображаємо діалог
            overlay.classList.add('active');
        } catch (e) {
            console.error('Помилка відображення підтвердження:', e);

            // Резервний варіант - стандартний confirm
            if (confirm(message)) {
                if (onConfirm) onConfirm();
            } else {
                if (onCancel) onCancel();
            }
        }
    }

    /**
     * Показати діалог введення
     * @param {string} message - Повідомлення
     * @param {Function} callback - Функція зворотного виклику з введеним значенням
     */
    function showInputModal(message, callback) {
        try {
            // Створюємо overlay
            const overlay = document.createElement('div');
            overlay.className = 'modern-dialog-overlay active';

            // Створюємо діалог
            const dialog = document.createElement('div');
            dialog.className = 'modern-input-dialog';

            // Заголовок
            const title = document.createElement('div');
            title.className = 'modern-input-dialog-title';
            title.textContent = message;

            // Поле введення
            const input = document.createElement('input');
            input.className = 'modern-input-field';
            input.type = 'text';
            input.placeholder = 'Введіть значення';

            // Кнопки
            const buttons = document.createElement('div');
            buttons.className = 'modern-dialog-buttons';

            const cancelButton = document.createElement('button');
            cancelButton.className = 'modern-dialog-button modern-dialog-button-secondary';
            cancelButton.textContent = 'Скасувати';

            const confirmButton = document.createElement('button');
            confirmButton.className = 'modern-dialog-button modern-dialog-button-primary';
            confirmButton.textContent = 'Підтвердити';

            // Збираємо структуру
            buttons.appendChild(cancelButton);
            buttons.appendChild(confirmButton);
            dialog.appendChild(title);
            dialog.appendChild(input);
            dialog.appendChild(buttons);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Додаємо стилі для поля введення
            const style = document.createElement('style');
            style.textContent = `
                .modern-input-dialog {
                    background: rgba(30, 39, 70, 0.8);
                    border-radius: 1.5rem;
                    padding: 1.5rem;
                    width: 90%;
                    max-width: 350px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(78, 181, 247, 0.2);
                }
                .modern-input-dialog-title {
                    font-size: 1.125rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: #4eb5f7;
                    text-align: center;
                }
                .modern-input-field {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: rgba(20, 30, 60, 0.7);
                    color: white;
                    border: 1px solid rgba(0, 201, 167, 0.3);
                    border-radius: 0.75rem;
                    margin-bottom: 1.25rem;
                    font-size: 1rem;
                    box-shadow: inset 0 0.125rem 0.3125rem rgba(0, 0, 0, 0.2);
                    transition: all 0.3s ease;
                }
                .modern-input-field:focus {
                    outline: none;
                    border-color: rgba(0, 201, 167, 0.8);
                    box-shadow: 0 0 0.625rem rgba(0, 201, 167, 0.4), inset 0 0.125rem 0.3125rem rgba(0, 0, 0, 0.2);
                }
            `;
            document.head.appendChild(style);

            // Обробники подій
            const closeModal = () => {
                overlay.remove();
            };

            cancelButton.onclick = () => {
                closeModal();
            };

            confirmButton.onclick = () => {
                const value = input.value.trim();
                closeModal();
                if (callback) callback(value);
            };

            // Фокус на полі введення
            setTimeout(() => input.focus(), 100);

            // Обробка Enter
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = input.value.trim();
                    closeModal();
                    if (callback) callback(value);
                }
            });
        } catch (e) {
            console.error('Помилка відображення діалогу введення:', e);

            // Резервний варіант - стандартний prompt
            const value = prompt(message);
            if (callback) callback(value);
        }
    }

    /**
     * Обробка помилок API
     * @param {Error} error - Об'єкт помилки
     * @param {string} operation - Назва операції
     * @param {boolean} showToast - Чи показувати повідомлення
     */
    function handleApiError(error, operation = 'API операції', showToast = true) {
        // Запобігаємо дублюванню помилок
        if (!error._logged) {
            console.error(`❌ Помилка ${operation}:`, error.message || error);
            // Безпечно встановлюємо властивість _logged
            try {
                error._logged = true;
            } catch (e) {}
        }

        // Уникаємо повторних повідомлень
        const now = Date.now();
        const errorMessage = error.message || 'Невідома помилка';

        // Показуємо повідомлення не частіше, ніж раз на 3 секунди
        const shouldShowToast = showToast &&
                               (now - _lastErrorNotificationTime > 3000 ||
                                _lastErrorMessage !== errorMessage);

        // Форматуємо зрозуміле повідомлення
        let userFriendlyMessage = '';

        if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
            userFriendlyMessage = "Не вдалося з'єднатися з сервером. Перевірте з'єднання з інтернетом.";
        } else if (errorMessage.includes('timeout')) {
            userFriendlyMessage = "Час очікування відповіді від сервера вичерпано. Спробуйте знову.";
        } else if (errorMessage.includes('404')) {
            userFriendlyMessage = "Запитаний ресурс недоступний.";
        } else if (errorMessage.includes('500')) {
            userFriendlyMessage = "Виникла помилка на сервері. Спробуйте пізніше.";
        } else if (errorMessage.includes('користувача не знайдено')) {
            userFriendlyMessage = "Не вдалося ідентифікувати користувача. Спробуйте перезавантажити сторінку.";
        } else {
            userFriendlyMessage = errorMessage;
        }

        // Показуємо повідомлення
        if (shouldShowToast) {
            _lastErrorNotificationTime = now;
            _lastErrorMessage = errorMessage;

            showNotification(userFriendlyMessage, true);
        }

        return userFriendlyMessage;
    }

    // ======== ГЛОБАЛЬНІ ФУНКЦІЇ ========

    // Експортуємо функції для використання іншими модулями
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.showNotification = showNotification;
    window.showToast = showNotification; // Для сумісності
    window.simpleAlert = showNotification; // Для сумісності
    window.showMessage = showNotification; // Для сумісності
    window.showModernNotification = showNotification; // Для сумісності
    window.showModernConfirm = showModernConfirm;
    window.showInputModal = showInputModal;
    window.handleApiError = handleApiError;

    console.log("✅ UI: Елементи інтерфейсу успішно ініціалізовано");
})();