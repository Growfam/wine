/**
 * settings.js - Модуль для роботи з налаштуваннями користувача та SID-фразами з преміум-анімаціями
 */

(function() {
    'use strict';

    console.log("⚙️ SETTINGS: Ініціалізація модуля налаштувань");

    // Зберігаємо посилання на API
    const api = window.WinixAPI || window.apiRequest;

    // Додаємо преміум-стилі, якщо вони ще не додані
    function addPremiumStyles() {
        if (!document.getElementById('premium-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'premium-styles';
            styleElement.textContent = `
            /* Плавне з'явлення модальних вікон */
            .modal-overlay {
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                backdrop-filter: blur(8px) !important;
            }

            .modal-container {
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), 
                            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4),
                            0 0 0 1px rgba(78, 181, 247, 0.2) inset,
                            0 5px 15px rgba(0, 201, 167, 0.15) !important;
                overflow: hidden;
            }

            .modal-overlay.show .modal-container {
                transform: scale(1) !important;
                opacity: 1 !important;
            }

            /* Ефект свічення для модалок */
            .modal-overlay.show .modal-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, 
                    rgba(0, 201, 167, 0), 
                    rgba(0, 201, 167, 0.8), 
                    rgba(0, 201, 167, 0));
                animation: glow-line 2s infinite;
            }

            @keyframes glow-line {
                0% { opacity: 0.3; transform: translateX(-100%); }
                50% { opacity: 1; }
                100% { opacity: 0.3; transform: translateX(100%); }
            }

            /* Анімовані кнопки */
            .action-button, .form-button, .modal-button, .filter-button, .seed-continue-button, .copy-button {
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                overflow: hidden;
                position: relative;
            }

            .action-button::after, .form-button::after, .modal-button::after, .seed-continue-button::after, .copy-button::after {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
                opacity: 0;
                transition: opacity 0.8s;
                pointer-events: none;
            }

            .action-button:active::after, .form-button:active::after, .modal-button:active::after, .seed-continue-button:active::after, .copy-button:active::after {
                opacity: 1;
                transition: 0s;
            }

            /* Ефект пульсації для кнопок */
            @keyframes pulse-button {
                0% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(0, 201, 167, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0); }
            }

            /* Анімація для модальних вікон при відкритті/закритті */
            @keyframes modal-in {
                0% { transform: scale(0.8); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }

            @keyframes modal-out {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(0.8); opacity: 0; }
            }

            /* Клас преміум для seed фрази */
            .seed-modal-content {
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.95), rgba(15, 52, 96, 0.95)) !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 
                           0 0 0 1px rgba(78, 181, 247, 0.2) inset,
                           0 5px 15px rgba(0, 201, 167, 0.15) !important;
                transform: scale(0.9);
                opacity: 0;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), 
                           opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
            }

            .modal-overlay.show .seed-modal-content {
                transform: scale(1) !important;
                opacity: 1 !important;
            }

            /* Seed-фраза преміум ефекти */
            .restore-card {
                position: relative;
                overflow: hidden;
                background: linear-gradient(135deg, rgba(20, 30, 60, 0.9), rgba(10, 20, 40, 0.9)) !important;
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3),
                           0 0 0 1px rgba(78, 181, 247, 0.15) inset !important;
                border-radius: 16px !important;
            }

            .restore-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 50%;
                height: 100%;
                background: linear-gradient(90deg, 
                                           rgba(255, 255, 255, 0), 
                                           rgba(255, 255, 255, 0.08), 
                                           rgba(255, 255, 255, 0));
                transform: skewX(-25deg);
                animation: shine 3s infinite;
            }

            @keyframes shine {
                0% { left: -100%; }
                20% { left: 100%; }
                100% { left: 100%; }
            }

            /* Анімована сітка слів */
            .words-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin: 15px 0;
            }

            .word-cell {
                background: rgba(30, 39, 70, 0.8);
                border-radius: 10px;
                padding: 10px;
                text-align: center;
                border: 1px solid rgba(78, 181, 247, 0.15);
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateY(20px);
                animation: fadeInUp 0.5s forwards;
            }

            .word-cell:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 5px 15px rgba(0, 201, 167, 0.3) !important;
                border-color: rgba(0, 201, 167, 0.3) !important;
                background: rgba(30, 39, 70, 0.9) !important;
            }

            .word-cell:nth-child(1) { animation-delay: 0.1s; }
            .word-cell:nth-child(2) { animation-delay: 0.15s; }
            .word-cell:nth-child(3) { animation-delay: 0.2s; }
            .word-cell:nth-child(4) { animation-delay: 0.25s; }
            .word-cell:nth-child(5) { animation-delay: 0.3s; }
            .word-cell:nth-child(6) { animation-delay: 0.35s; }
            .word-cell:nth-child(7) { animation-delay: 0.4s; }
            .word-cell:nth-child(8) { animation-delay: 0.45s; }
            .word-cell:nth-child(9) { animation-delay: 0.5s; }
            .word-cell:nth-child(10) { animation-delay: 0.55s; }
            .word-cell:nth-child(11) { animation-delay: 0.6s; }
            .word-cell:nth-child(12) { animation-delay: 0.65s; }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .word-number {
                color: rgba(255, 255, 255, 0.5);
                font-size: 0.8em;
                margin-bottom: 2px;
            }

            .word-value {
                color: var(--secondary-color, #4eb5f7);
                font-weight: bold;
                font-size: 0.95em;
            }

            /* Кнопка копіювання з пульсацією */
            .copy-button {
                background: linear-gradient(90deg, #2D6EB6, #52C0BD) !important;
                padding: 10px 20px !important;
                border-radius: 30px !important;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important;
                position: relative;
                overflow: hidden;
                animation: pulse-button 2s infinite;
                width: auto !important;
                margin: 0 auto 10px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-weight: bold !important;
                gap: 8px !important;
            }

            .copy-button:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4) !important;
            }

            .copy-button:active {
                transform: translateY(-1px) !important;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3) !important;
            }

            .copy-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg,
                    rgba(255, 255, 255, 0),
                    rgba(255, 255, 255, 0.2),
                    rgba(255, 255, 255, 0));
                transition: all 0.6s;
            }

            .copy-button:hover::before {
                left: 100%;
            }

            /* Ефект успішного копіювання */
            .copy-success {
                animation: success-pulse 0.6s !important;
            }

            @keyframes success-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); background: linear-gradient(90deg, #00C9A7, #2D6EB6) !important; }
                100% { transform: scale(1); }
            }

            .seed-continue-button {
                background: linear-gradient(90deg, #2D6EB6, #52C0BD) !important;
                padding: 12px !important;
                border-radius: 16px !important;
                margin-top: 10px !important;
                font-weight: bold !important;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important;
                transition: all 0.3s ease !important;
            }

            .seed-continue-button:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4) !important;
            }

            .seed-continue-button:active {
                transform: translateY(-1px) !important;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3) !important;
            }

            /* Преміум стилі для поля вводу пароля */
            .modal-body input {
                transition: all 0.3s ease !important;
                border: 1px solid rgba(78, 181, 247, 0.3) !important;
                background: rgba(20, 30, 60, 0.7) !important;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) inset !important;
            }

            .modal-body input:focus {
                border-color: rgba(0, 201, 167, 0.5) !important;
                box-shadow: 0 0 10px rgba(0, 201, 167, 0.2) !important;
                transform: translateY(-2px) !important;
            }

            .modal-body input.error {
                animation: shake 0.5s !important;
                border-color: #f44336 !important;
                box-shadow: 0 0 10px rgba(244, 67, 54, 0.3) !important;
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }

            /* Модальне вікно з анімованим фоном */
            .document-modal.show {
                animation: modal-bg-fade-in 0.4s forwards !important;
            }

            @keyframes modal-bg-fade-in {
                from { background-color: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); }
                to { background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); }
            }

            /* Постійне свічення для модальних вікон */
            .modal-content, .seed-modal-content {
                position: relative;
                overflow: hidden;
            }

            .modal-content::after, .seed-modal-content::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                box-shadow: inset 0 0 20px rgba(0, 201, 167, 0.2);
                border-radius: inherit;
                opacity: 0;
                animation: inner-glow 3s infinite;
            }

            @keyframes inner-glow {
                0% { opacity: 0; }
                50% { opacity: 0.5; }
                100% { opacity: 0; }
            }

            /* Ефект для заголовків модальних вікон */
            .modal-title {
                background: linear-gradient(90deg, #fff, #4eb5f7, #fff);
                background-size: 200% auto;
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: gradient-text 3s linear infinite;
            }

            @keyframes gradient-text {
                0% { background-position: 0% center; }
                100% { background-position: 200% center; }
            }

            /* Індикатор завантаження */
            .spinner {
                border: 5px solid rgba(0, 201, 167, 0.3);
                border-radius: 50%;
                border-top: 5px solid var(--secondary-color, #4eb5f7);
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            `;
            document.head.appendChild(styleElement);
        }
    }

    // Додаємо преміум-стилі при завантаженні
    addPremiumStyles();

    // Об'єкт для експорту
    window.WinixSettings = {
        /**
         * Перевірка існування пароля
         * @returns {boolean} - true, якщо пароль встановлено
         */
        hasPassword: function() {
            const passwordHash = localStorage.getItem('passwordHash');
            const seedPhrasePasswordHash = localStorage.getItem('seedPhrasePasswordHash');
            return !!(passwordHash || seedPhrasePasswordHash);
        },

        /**
         * Встановлення пароля
         * @param {string} password - Новий пароль
         * @returns {Promise} - Результат операції
         */
        setPassword: function(password) {
            if (!password || password.length < 8) {
                return Promise.reject(new Error("Пароль має містити не менше 8 символів"));
            }

            // Перевіряємо, чи містить пароль достатню кількість літер
            if ((password.match(/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/g) || []).length < 5) {
                return Promise.reject(new Error("Пароль має містити не менше 5 літер"));
            }

            // Зберігаємо хеш пароля в localStorage для швидкої перевірки
            const passwordHash = this.hashPassword(password);
            localStorage.setItem('passwordHash', passwordHash);
            localStorage.setItem('seedPhrasePasswordHash', passwordHash);

            // Отримуємо ID користувача
            const userId = this.getUserId();

            // Якщо є ID користувача, оновлюємо пароль на сервері
            if (userId) {
                return api(`/api/user/${userId}/password`, 'POST', {
                    password: password  // На сервері буде правильно хешовано
                })
                .then(response => {
                    console.log("✅ SETTINGS: Пароль успішно оновлено на сервері");
                    return response;
                })
                .catch(error => {
                    console.error("❌ SETTINGS: Помилка оновлення пароля на сервері", error);
                    // Навіть якщо сервер не відповідає, ми зберегли пароль локально
                    return {
                        status: 'success',
                        message: 'Пароль збережено локально, але не вдалося оновити на сервері'
                    };
                });
            } else {
                // Якщо немає ID, просто повертаємо успіх
                return Promise.resolve({
                    status: 'success',
                    message: 'Пароль збережено локально'
                });
            }
        },

        /**
         * Перевірка пароля
         * @param {string} password - Пароль для перевірки
         * @returns {boolean} - true, якщо пароль правильний
         */
        verifyPassword: function(password) {
            const savedPassHash = localStorage.getItem('passwordHash');
            const savedSeedHash = localStorage.getItem('seedPhrasePasswordHash');
            const inputHash = this.hashPassword(password);

            return inputHash === savedPassHash || inputHash === savedSeedHash;
        },

        /**
         * Хешування пароля (проста імітація)
         * @param {string} password - Пароль для хешування
         * @returns {string} - Хеш пароля
         */
        hashPassword: function(password) {
            let hash = 0;
            if (password.length === 0) return hash.toString();
            for (let i = 0; i < password.length; i++) {
                const char = password.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString() + "winix";
        },

        /**
         * Отримання сід-фрази
         * @param {string} password - Пароль для перевірки
         * @returns {Promise<string>} - Результат операції
         */
        getSeedPhrase: function(password) {
            if (!this.verifyPassword(password)) {
                return Promise.reject(new Error("Неправильний пароль"));
            }

            // Отримуємо ID користувача
            const userId = this.getUserId();

            if (!userId) {
                return Promise.reject(new Error("ID користувача не знайдено"));
            }

            // Використовуємо новий захищений API ендпоінт
            return api(`/api/user/${userId}/seed-phrase/protected`, 'POST', {
                password: password
            })
            .then(response => {
                if (response.status === 'success' && response.data && response.data.seed_phrase) {
                    return response.data.seed_phrase;
                } else {
                    throw new Error(response.message || "Помилка отримання сід-фрази");
                }
            });
        },

        /**
         * Отримання ID користувача з доступних джерел
         * @returns {string|null} - ID користувача або null
         */
        getUserId: function() {
            // Перевірка в localStorage
            const localId = localStorage.getItem('telegram_user_id') || localStorage.getItem('userId');
            if (localId && localId !== 'undefined' && localId !== 'null') {
                return localId;
            }

            // Перевірка Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user) {

                const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id;
                if (telegramId) {
                    return telegramId.toString();
                }
            }

            // Перевірка DOM елементу
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const domId = userIdElement.textContent.trim();
                if (domId) {
                    return domId;
                }
            }

            // ID не знайдено
            return null;
        },

        /**
         * Валідація пароля
         * @param {string} password - Пароль для перевірки
         * @returns {Object} - Результат перевірки {valid: boolean, message: string}
         */
        validatePassword: function(password) {
            if (!password || password.length < 8)
                return { valid: false, message: "Пароль має містити не менше 8 символів" };

            // Перевіряємо, чи містить пароль достатню кількість літер
            if ((password.match(/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/g) || []).length < 5)
                return { valid: false, message: "Пароль має містити не менше 5 літер" };

            return { valid: true };
        },

        /**
         * Показ модального вікна для встановлення пароля
         * @param {Function} callback - Функція, яка викликається після успішного встановлення пароля
         */
        showSetPasswordModal: function(callback) {
            const translations = {
                uk: {
                    setPassword: "Встановлення паролю",
                    passwordRequirements: "Пароль має містити не менше 8 символів, включаючи 5 літер",
                    password: "Пароль",
                    confirm: "Підтвердження",
                    save: "Зберегти",
                    passwordsNotMatch: "Паролі не співпадають",
                    passwordTooShort: "Пароль має містити не менше 8 символів",
                    passwordFewLetters: "Пароль має містити не менше 5 літер"
                },
                en: {
                    setPassword: "Set Password",
                    passwordRequirements: "Password must contain at least 8 characters, including 5 letters",
                    password: "Password",
                    confirm: "Confirm",
                    save: "Save",
                    passwordsNotMatch: "Passwords do not match",
                    passwordTooShort: "Password must contain at least 8 characters",
                    passwordFewLetters: "Password must contain at least 5 letters"
                },
                ru: {
                    setPassword: "Установка пароля",
                    passwordRequirements: "Пароль должен содержать не менее 8 символов, включая 5 букв",
                    password: "Пароль",
                    confirm: "Подтверждение",
                    save: "Сохранить",
                    passwordsNotMatch: "Пароли не совпадают",
                    passwordTooShort: "Пароль должен содержать не менее 8 символов",
                    passwordFewLetters: "Пароль должен содержать не менее 5 букв"
                }
            };

            // Визначаємо поточну мову
            const lang = localStorage.getItem('userLanguage') || 'uk';
            const t = translations[lang] || translations.uk;

            // Видаляємо попередні модальні вікна, якщо вони є
            document.querySelectorAll('.document-modal').forEach(modal => modal.remove());

            // Створюємо нове модальне вікно
            const modal = document.createElement('div');
            modal.className = 'document-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">${t.setPassword}</div>
                        <span class="close-modal">×</span>
                    </div>
                    <div class="modal-body">
                        <p>${t.passwordRequirements}</p>
                        <input type="password" id="new-password" placeholder="${t.password}">
                        <input type="password" id="confirm-password" placeholder="${t.confirm}">
                        <div id="error-msg"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="save-password">${t.save}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

            // Додаємо обробники подій
            const saveBtn = modal.querySelector('#save-password');
            saveBtn.onclick = () => {
                const pwd = modal.querySelector('#new-password').value;
                const confirm = modal.querySelector('#confirm-password').value;
                const error = modal.querySelector('#error-msg');

                // Перевіряємо, чи паролі співпадають
                if (pwd !== confirm) {
                    error.textContent = t.passwordsNotMatch;
                    modal.querySelector('#confirm-password').classList.add('error');
                    return;
                }

                // Перевіряємо валідність пароля
                const validation = this.validatePassword(pwd);
                if (!validation.valid) {
                    error.textContent = validation.message;
                    modal.querySelector('#new-password').classList.add('error');
                    return;
                }

                // Додаємо анімацію для кнопки
                saveBtn.classList.add('processing');

                // Зберігаємо пароль
                this.setPassword(pwd)
                    .then(() => {
                        // Видаляємо клас show для анімації закриття
                        modal.classList.remove('show');

                        // Затримка перед видаленням вікна для завершення анімації
                        setTimeout(() => {
                            modal.remove();
                            if (typeof callback === 'function') {
                                callback(pwd);
                            }
                        }, 300);
                    })
                    .catch(err => {
                        error.textContent = err.message;
                        saveBtn.classList.remove('processing');
                    });
            };

            // Додаємо обробники для закриття модального вікна
            modal.querySelector('.close-modal').onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 300);
                }
            };

            // Додаємо обробники для полів вводу
            modal.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', function() {
                    this.classList.remove('error');
                    document.getElementById('error-msg').textContent = '';
                });

                // Додаємо обробник для Enter
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            });
        },

        /**
         * Показ модального вікна для введення пароля
         * @param {Function} callback - Функція, яка викликається після успішного введення пароля
         */
        showEnterPasswordModal: function(callback) {
            const translations = {
                uk: {
                    enterPassword: "Введіть пароль",
                    password: "Ваш пароль",
                    check: "Перевірити",
                    wrongPassword: "Невірний пароль"
                },
                en: {
                    enterPassword: "Enter Password",
                    password: "Your password",
                    check: "Check",
                    wrongPassword: "Wrong password"
                },
                ru: {
                    enterPassword: "Введите пароль",
                    password: "Ваш пароль",
                    check: "Проверить",
                    wrongPassword: "Неверный пароль"
                }
            };

            // Визначаємо поточну мову
            const lang = localStorage.getItem('userLanguage') || 'uk';
            const t = translations[lang] || translations.uk;

            // Видаляємо попередні модальні вікна, якщо вони є
            document.querySelectorAll('.document-modal').forEach(modal => modal.remove());

            // Створюємо нове модальне вікно
            const modal = document.createElement('div');
            modal.className = 'document-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">${t.enterPassword}</div>
                        <span class="close-modal">×</span>
                    </div>
                    <div class="modal-body">
                        <input type="password" id="enter-password" placeholder="${t.password}">
                        <div id="error-msg"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="check-password">${t.check}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
                // Встановлюємо фокус на поле вводу
                modal.querySelector('#enter-password').focus();
            }, 10);

            // Додаємо обробники подій
            const checkBtn = modal.querySelector('#check-password');
            checkBtn.onclick = () => {
                const pwd = modal.querySelector('#enter-password').value;
                const error = modal.querySelector('#error-msg');

                if (this.verifyPassword(pwd)) {
                    // Додаємо анімацію для кнопки
                    checkBtn.classList.add('success');

                    // Видаляємо клас show для анімації закриття
                    modal.classList.remove('show');

                    // Затримка перед видаленням вікна для завершення анімації
                    setTimeout(() => {
                        modal.remove();
                        if (typeof callback === 'function') {
                            callback(pwd);
                        }
                    }, 300);
                } else {
                    error.textContent = t.wrongPassword;
                    modal.querySelector('#enter-password').classList.add('error');

                    // Додаємо анімацію тряски для поля вводу
                    setTimeout(() => {
                        modal.querySelector('#enter-password').classList.remove('error');
                    }, 500);
                }
            };

            // Додаємо обробники для закриття модального вікна
            modal.querySelector('.close-modal').onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 300);
                }
            };

            // Додаємо обробник для Enter
            modal.querySelector('#enter-password').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    checkBtn.click();
                }
            });

            // Додаємо обробник для зняття помилки при введенні
            modal.querySelector('#enter-password').addEventListener('input', function() {
                this.classList.remove('error');
                document.getElementById('error-msg').textContent = '';
            });
        },

        /**
         * Показ модального вікна з сід-фразою
         * @param {string} seedPhrase - Сід-фраза для показу
         */
        showSeedPhraseModal: function(seedPhrase) {
            const translations = {
                uk: {
                    seedPhrase: "SID фраза",
                    yourSeedPhrase: "Ваша SID фраза",
                    saveSeed: "Збережіть цю фразу в надійному місці",
                    copy: "Копіювати",
                    copied: "Скопійовано",
                    copyError: "Помилка копіювання",
                    done: "Готово"
                },
                en: {
                    seedPhrase: "SID Phrase",
                    yourSeedPhrase: "Your SID Phrase",
                    saveSeed: "Save this phrase in a secure place",
                    copy: "Copy",
                    copied: "Copied",
                    copyError: "Copy error",
                    done: "Done"
                },
                ru: {
                    seedPhrase: "SID фраза",
                    yourSeedPhrase: "Ваша SID фраза",
                    saveSeed: "Сохраните эту фразу в надежном месте",
                    copy: "Копировать",
                    copied: "Скопировано",
                    copyError: "Ошибка копирования",
                    done: "Готово"
                }
            };

            // Визначаємо поточну мову
            const lang = localStorage.getItem('userLanguage') || 'uk';
            const t = translations[lang] || translations.uk;

            // Розбиваємо фразу на окремі слова
            const words = seedPhrase.split(' ');

            // Видаляємо попередні модальні вікна, якщо вони є
            document.querySelectorAll('.document-modal').forEach(modal => modal.remove());

            // Створюємо нове модальне вікно
            const modal = document.createElement('div');
            modal.className = 'document-modal';
            modal.innerHTML = `
                <div class="seed-modal-content">
                    <div class="modal-header">
                        <div class="modal-title">${t.seedPhrase}</div>
                        <span class="close-modal">×</span>
                    </div>
                    <div class="modal-body">
                        <div class="restore-card">
                            <div class="restore-title">${t.yourSeedPhrase}</div>
                            <div class="restore-subtitle">${t.saveSeed}</div>
                            <button class="copy-button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 4V16C8 16.5304 8.21071 17.0391 8.58579 17.4142C8.96086 17.7893 9.46957 18 10 18H18C18.5304 18 19.0391 17.7893 19.4142 17.4142C19.7893 17.0391 20 16.5304 20 16V7.242C20 6.97556 19.9467 6.71181 19.8433 6.46624C19.7399 6.22068 19.5885 5.99824 19.398 5.812L16.188 2.602C16.0018 2.41154 15.7793 2.26013 15.5338 2.15673C15.2882 2.05333 15.0244 2 14.758 2H10C9.46957 2 8.96086 2.21071 8.58579 2.58579C8.21071 2.96086 8 3.46957 8 4V4Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M16 18V20C16 20.5304 15.7893 21.0391 15.4142 21.4142C15.0391 21.7893 14.5304 22 14 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V9C4 8.46957 4.21071 7.96086 4.58579 7.58579C4.96086 7.21071 5.46957 7 6 7H8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${t.copy}
                            </button>
                            <div class="words-grid">
                                ${words.map((word, i) => `
                                    <div class="word-cell">
                                        <div class="word-number">${i + 1}.</div>
                                        <div class="word-value">${word}</div>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="seed-continue-button">${t.done}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

            // Додаємо обробники подій
            modal.querySelector('.close-modal').onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            modal.querySelector('.copy-button').onclick = () => {
                navigator.clipboard.writeText(seedPhrase)
                    .then(() => {
                        const copyBtn = modal.querySelector('.copy-button');
                        copyBtn.classList.add('copy-success');

                        if (window.showToast) {
                            window.showToast(t.copied);
                        } else {
                            // Створюємо власний тост
                            const toast = document.createElement('div');
                            toast.className = 'toast-message success';
                            toast.textContent = t.copied;
                            document.body.appendChild(toast);

                            setTimeout(() => {
                                toast.classList.add('show');
                            }, 10);

                            setTimeout(() => {
                                toast.classList.remove('show');
                                setTimeout(() => toast.remove(), 300);
                            }, 2000);
                        }

                        setTimeout(() => {
                            copyBtn.classList.remove('copy-success');
                        }, 600);
                    })
                    .catch(() => {
                        if (window.showToast) {
                            window.showToast(t.copyError, true);
                        } else {
                            alert(t.copyError);
                        }
                    });
            };

            modal.querySelector('.seed-continue-button').onclick = () => {
                localStorage.setItem('seedPhraseViewed', 'true');
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 300);
                }
            };
        },

        /**
         * Обробка показу сід-фрази
         */
        handleShowSeedPhrase: function() {
            console.log("⚙️ SETTINGS: Запит на показ SID фрази");

            const hasPassword = this.hasPassword();
            const userId = this.getUserId();

            if (!userId) {
                if (window.showToast) {
                    window.showToast("Помилка: Користувача не знайдено", true);
                } else {
                    alert("Помилка: Користувача не знайдено");
                }
                return;
            }

            // Показуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'flex';

            // Додаємо індикатор завантаження якщо його немає
            if (!spinner) {
                const newSpinner = document.createElement('div');
                newSpinner.id = 'loading-spinner';
                newSpinner.className = 'loading-indicator';
                newSpinner.innerHTML = `
                    <div class="spinner"></div>
                    <div class="loading-text">Завантаження...</div>
                `;
                document.body.appendChild(newSpinner);
                newSpinner.style.display = 'flex';
            }

            // Спочатку перевіряємо статус seed-фрази
            api(`/api/user/${userId}/seed-phrase`, 'GET')
                .then(response => {
                    // Ховаємо індикатор завантаження
                    if (spinner) spinner.style.display = 'none';
                    else document.getElementById('loading-spinner')?.remove();

                    if (response.status === 'password_required' || hasPassword) {
                        // Якщо потрібен пароль, показуємо вікно введення пароля
                        this.showEnterPasswordModal(password => {
                            // Після введення правильного пароля, отримуємо сід-фразу
                            this.getSeedPhrase(password)
                                .then(seedPhrase => {
                                    this.showSeedPhraseModal(seedPhrase);
                                })
                                .catch(error => {
                                    console.error("❌ SETTINGS: Помилка отримання SID фрази", error);
                                    if (window.showToast) {
                                        window.showToast("Помилка отримання SID фрази: " + error.message, true);
                                    } else {
                                        alert("Помилка отримання SID фрази: " + error.message);
                                    }
                                });
                        });
                    } else if (response.status === 'success' && response.data && response.data.seed_phrase) {
                        // Якщо пароль не потрібен і seed-фраза доступна, показуємо модальне вікно для встановлення пароля
                        this.showSetPasswordModal(password => {
                            // Показуємо сід-фразу після встановлення пароля
                            this.showSeedPhraseModal(response.data.seed_phrase);
                        });
                    } else {
                        console.error("❌ SETTINGS: Неочікувана відповідь API", response);
                        if (window.showToast) {
                            window.showToast("Помилка отримання SID фрази", true);
                        } else {
                            alert("Помилка отримання SID фрази");
                        }
                    }
                })
                .catch(error => {
                    // Ховаємо індикатор завантаження
                    if (spinner) spinner.style.display = 'none';
                    else document.getElementById('loading-spinner')?.remove();

                    console.error("❌ SETTINGS: Помилка перевірки статусу SID фрази", error);

                    // Якщо сталася помилка, показуємо стандартний процес
                    if (!hasPassword) {
                        // Якщо пароль не встановлено, спочатку показуємо вікно встановлення пароля
                        this.showSetPasswordModal(password => {
                            // Після встановлення пароля, намагаємося отримати сід-фразу
                            api(`/api/user/${userId}/seed-phrase/protected`, 'POST', { password })
                                .then(response => {
                                    if (response.status === 'success' && response.data && response.data.seed_phrase) {
                                        this.showSeedPhraseModal(response.data.seed_phrase);
                                    } else {
                                        if (window.showToast) {
                                            window.showToast("Помилка отримання SID фрази", true);
                                        } else {
                                            alert("Помилка отримання SID фрази");
                                        }
                                    }
                                })
                                .catch(error => {
                                    console.error("❌ SETTINGS: Помилка отримання SID фрази", error);
                                    if (window.showToast) {
                                        window.showToast("Помилка отримання SID фрази", true);
                                    } else {
                                        alert("Помилка отримання SID фрази");
                                    }
                                });
                        });
                    } else {
                        // Якщо пароль встановлено, спочатку запитуємо його
                        this.showEnterPasswordModal(password => {
                            // Після введення правильного пароля, намагаємося отримати сід-фразу
                            api(`/api/user/${userId}/seed-phrase/protected`, 'POST', { password })
                                .then(response => {
                                    if (response.status === 'success' && response.data && response.data.seed_phrase) {
                                        this.showSeedPhraseModal(response.data.seed_phrase);
                                    } else {
                                        if (window.showToast) {
                                            window.showToast("Помилка отримання SID фрази", true);
                                        } else {
                                            alert("Помилка отримання SID фрази");
                                        }
                                    }
                                })
                                .catch(error => {
                                    console.error("❌ SETTINGS: Помилка отримання SID фрази", error);
                                    if (window.showToast) {
                                        window.showToast("Помилка отримання SID фрази", true);
                                    } else {
                                        alert("Помилка отримання SID фрази");
                                    }
                                });
                        });
                    }
                });
        }
    };

    // Ініціалізація після завантаження DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Додаємо преміум-стилі
        addPremiumStyles();

        // Знаходимо кнопку показу сід-фрази
        const showSeedBtn = document.getElementById('show-seed-phrase');

        if (showSeedBtn) {
            showSeedBtn.addEventListener('click', function() {
                window.WinixSettings.handleShowSeedPhrase();
            });
        }

        // Додаємо обробники кліків для навігації
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function() {
                const section = this.getAttribute('data-section');
                if (section) {
                    // Додаємо анімацію преміум переходу
                    const transitionOverlay = document.createElement('div');
                    transitionOverlay.className = 'page-transition-overlay';
                    transitionOverlay.style.position = 'fixed';
                    transitionOverlay.style.top = '0';
                    transitionOverlay.style.left = '0';
                    transitionOverlay.style.width = '100%';
                    transitionOverlay.style.height = '100%';
                    transitionOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    transitionOverlay.style.backdropFilter = 'blur(10px)';
                    transitionOverlay.style.zIndex = '9999';
                    transitionOverlay.style.opacity = '0';
                    transitionOverlay.style.transition = 'opacity 0.3s ease';

                    document.body.appendChild(transitionOverlay);

                    // Анімуємо перехід
                    setTimeout(() => {
                        transitionOverlay.style.opacity = '1';

                        setTimeout(() => {
                            // Переходимо на нову сторінку
                            window.location.href = section === 'home' ? 'index.html' : `${section}.html`;
                        }, 300);
                    }, 10);
                }
            });
        });
    });

    // Якщо DOM вже завантажено, ініціалізуємо обробники
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Додаємо преміум-стилі
        addPremiumStyles();

        const showSeedBtn = document.getElementById('show-seed-phrase');

        if (showSeedBtn) {
            showSeedBtn.addEventListener('click', function() {
                window.WinixSettings.handleShowSeedPhrase();
            });
        }
    }

    console.log("✅ SETTINGS: Модуль налаштувань успішно ініціалізовано");
})();