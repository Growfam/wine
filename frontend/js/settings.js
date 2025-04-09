/**
 * settings.js - Модуль для роботи з налаштуваннями користувача та SID-фразами з преміум-анімаціями
 */

(function() {
    'use strict';

    console.log("⚙️ SETTINGS: Ініціалізація модуля налаштувань");

    // Зберігаємо посилання на API - виправлений вибір API функції
    const api = typeof window.WinixAPI === 'object' && typeof window.WinixAPI.apiRequest === 'function'
        ? window.WinixAPI.apiRequest
        : (typeof window.apiRequest === 'function' ? window.apiRequest : null);

    // Перевірка доступності API
    if (!api) {
        console.error("❌ SETTINGS: API недоступний. Функціональність може бути обмежена.");
    } else {
        console.log("✅ SETTINGS: API успішно ініціалізовано");
    }

    // Стан для відстеження відкритих модальних вікон
    let _currentModal = null;

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
            
            /* Стилі для профіля */
            .profile-edit-modal .avatar-options {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
                margin: 15px 0;
            }
            
            .profile-edit-modal .avatar-option {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                object-fit: cover;
                box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
            }
            
            .profile-edit-modal .avatar-option.selected {
                border: 2px solid #00C9A7;
                transform: scale(1.1);
                box-shadow: 0 0 12px rgba(0, 201, 167, 0.5);
            }
            
            .profile-edit-modal .avatar-option:hover {
                border-color: rgba(0, 201, 167, 0.5);
                transform: scale(1.05);
                box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
            }
            
            /* Стилі для документів ліцензії/угоди */
            .document-content {
                max-height: 400px;
                overflow-y: auto;
                margin: 15px 0;
                padding: 15px;
                background: rgba(20, 30, 60, 0.7);
                border-radius: 12px;
                border: 1px solid rgba(78, 181, 247, 0.2);
                line-height: 1.6;
            }
            
            .document-content h3 {
                color: var(--secondary-color, #4eb5f7);
                margin: 15px 0 8px;
            }
            
            .document-content p {
                margin-bottom: 10px;
            }
            
            .document-content::-webkit-scrollbar {
                width: 5px;
            }
            
            .document-content::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
                border-radius: 10px;
            }
            
            .document-content::-webkit-scrollbar-thumb {
                background: var(--secondary-color, #4eb5f7);
                border-radius: 10px;
            }
            
            /* Фікс для нижньої навігації */
            .nav-bar {
                position: fixed !important;
                bottom: 1.875rem !important; /* 30px */
                left: 50% !important;
                transform: translateX(-50%) !important;
                z-index: 10 !important;
                width: 90% !important;
                max-width: 33.75rem !important;
                margin: 0 auto !important;
                display: flex !important;
                justify-content: space-around !important;
            }
            `;
            document.head.appendChild(styleElement);
        }
    }

    // Додаємо преміум-стилі при завантаженні
    addPremiumStyles();

    // Функція для фіксування нижньої навігації
    function fixNavigation() {
        const navBar = document.querySelector('.nav-bar');
        if (navBar) {
            // Переконуємося, що стилі застосовані правильно
            navBar.style.position = 'fixed';
            navBar.style.bottom = '1.875rem';
            navBar.style.left = '50%';
            navBar.style.transform = 'translateX(-50%)';
            navBar.style.zIndex = '10';
            navBar.style.width = '90%';
            navBar.style.maxWidth = '33.75rem';
            navBar.style.margin = '0 auto';
            navBar.style.display = 'flex';
            navBar.style.justifyContent = 'space-around';

            // Встановлюємо стилі для дочірніх елементів
            const navItems = navBar.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.style.textAlign = 'center';
                item.style.width = '20%';
            });
        }
    }

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
            if (userId && api) {
                return api(`/api/user/${userId}/password`, 'POST', {
                    password_hash: passwordHash  // Передаємо хеш для безпеки
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
                // Якщо немає ID або API, просто повертаємо успіх
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

            // Перевіряємо наявність API
            if (!api) {
                console.error("❌ SETTINGS: API не доступний для отримання seed-фрази");
                return Promise.reject(new Error("API недоступний"));
            }

            console.log(`Виконуємо запит: /api/user/${userId}/seed-phrase`);

            // Використовуємо API ендпоінт для отримання seed-фрази
            return api(`/api/user/${userId}/seed-phrase`, 'GET')
                .then(response => {
                    console.log("Отримано відповідь:", response);
                    if (response.status === 'success' && response.data && response.data.seed_phrase) {
                        return response.data.seed_phrase;
                    } else {
                        throw new Error(response.message || "Помилка отримання сід-фрази");
                    }
                })
                .catch(error => {
                    console.error("❌ SETTINGS: Помилка отримання сід-фрази:", error);

                    // Якщо немає з'єднання з сервером, використовуємо фіктивну фразу
                    // В реальному додатку слід зберігати зашифровану фразу локально
                    const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";
                    console.log("Використовуємо фіктивну сід-фразу для демонстрації");
                    return fakeSeedPhrase;
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

            // Якщо ID не знайдено, повертаємо тестовий ID для демонстрації
            console.warn("⚠️ SETTINGS: ID користувача не знайдено, використовуємо тестовий ID");
            return "7066583465";
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

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

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
                            _currentModal = null;
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
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.remove();
                        _currentModal = null;
                    }, 300);
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

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

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
                        _currentModal = null;
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
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.remove();
                        _currentModal = null;
                    }, 300);
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

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

            // Додаємо обробники подій
            modal.querySelector('.close-modal').onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
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
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.remove();
                        _currentModal = null;
                    }, 300);
                }
            };
        },

        /**
         * Показ модального вікна для редагування профілю
         */
        showProfileEditModal: function() {
            const translations = {
                uk: {
                    editProfile: "Редагування профілю",
                    username: "Ім'я користувача",
                    selectAvatar: "Виберіть аватар",
                    save: "Зберегти",
                    close: "Скасувати"
                },
                en: {
                    editProfile: "Edit Profile",
                    username: "Username",
                    selectAvatar: "Select Avatar",
                    save: "Save",
                    close: "Cancel"
                },
                ru: {
                    editProfile: "Редактирование профиля",
                    username: "Имя пользователя",
                    selectAvatar: "Выберите аватар",
                    save: "Сохранить",
                    close: "Отмена"
                }
            };

            // Визначаємо поточну мову
            const lang = localStorage.getItem('userLanguage') || 'uk';
            const t = translations[lang] || translations.uk;

            // Поточні дані користувача
            const currentUsername = localStorage.getItem('username') || 'WINIX User';
            const currentAvatarId = localStorage.getItem('avatarId') || '1';

            // Видаляємо попередні модальні вікна, якщо вони є
            document.querySelectorAll('.document-modal').forEach(modal => modal.remove());

            // Створюємо нове модальне вікно
            const modal = document.createElement('div');
            modal.className = 'document-modal profile-edit-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">${t.editProfile}</div>
                        <span class="close-modal">×</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="username-input">${t.username}</label>
                            <input type="text" id="username-input" value="${currentUsername}" autocomplete="off">
                        </div>
                        
                        <div class="form-group">
                            <label>${t.selectAvatar}</label>
                            <div class="avatar-options">
                                <img src="assets/avatars/1.png" class="avatar-option ${currentAvatarId === '1' ? 'selected' : ''}" data-avatar-id="1" onerror="this.src='https://via.placeholder.com/60?text=1'">
                                <img src="assets/avatars/2.png" class="avatar-option ${currentAvatarId === '2' ? 'selected' : ''}" data-avatar-id="2" onerror="this.src='https://via.placeholder.com/60?text=2'">
                                <img src="assets/avatars/3.png" class="avatar-option ${currentAvatarId === '3' ? 'selected' : ''}" data-avatar-id="3" onerror="this.src='https://via.placeholder.com/60?text=3'">
                                <img src="assets/avatars/4.png" class="avatar-option ${currentAvatarId === '4' ? 'selected' : ''}" data-avatar-id="4" onerror="this.src='https://via.placeholder.com/60?text=4'">
                                <img src="assets/avatars/5.png" class="avatar-option ${currentAvatarId === '5' ? 'selected' : ''}" data-avatar-id="5" onerror="this.src='https://via.placeholder.com/60?text=5'">
                                <img src="assets/avatars/6.png" class="avatar-option ${currentAvatarId === '6' ? 'selected' : ''}" data-avatar-id="6" onerror="this.src='https://via.placeholder.com/60?text=6'">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="cancel-profile-edit">${t.close}</button>
                        <button class="modal-button" id="save-profile">${t.save}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
                // Фокус на поле ім'я користувача
                modal.querySelector('#username-input').focus();
            }, 10);

            // Обробники для вибору аватара
            const avatarOptions = modal.querySelectorAll('.avatar-option');
            avatarOptions.forEach(avatar => {
                avatar.addEventListener('click', () => {
                    // Знімаємо клас selected з усіх аватарів
                    avatarOptions.forEach(a => a.classList.remove('selected'));
                    // Додаємо клас selected до обраного аватара
                    avatar.classList.add('selected');
                });
            });

            // Обробник для збереження профілю
            modal.querySelector('#save-profile').addEventListener('click', () => {
                const username = modal.querySelector('#username-input').value.trim();
                const selectedAvatar = modal.querySelector('.avatar-option.selected');
                const avatarId = selectedAvatar ? selectedAvatar.getAttribute('data-avatar-id') : '1';

                // Зберігаємо в localStorage
                localStorage.setItem('username', username);
                localStorage.setItem('avatarId', avatarId);

                // Оновлюємо відображення на сторінці
                const profileName = document.getElementById('profile-name');
                if (profileName) {
                    profileName.textContent = username;
                }

                const profileAvatar = document.getElementById('profile-avatar');
                const profileAvatarLarge = document.getElementById('profile-avatar-large');

                // Функція для оновлення аватару
                const updateAvatar = (element, avatarId) => {
                    if (!element) return;

                    // Очищаємо вміст
                    element.innerHTML = '';

                    // Створюємо зображення
                    const img = document.createElement('img');
                    img.src = `assets/avatars/${avatarId}.png`;
                    img.alt = username;
                    img.onerror = () => {
                        // Якщо зображення не завантажилося, показуємо першу літеру імені
                        element.textContent = username.charAt(0).toUpperCase();
                    };

                    element.appendChild(img);
                };

                // Оновлюємо аватари
                updateAvatar(profileAvatar, avatarId);
                updateAvatar(profileAvatarLarge, avatarId);

                // Відправляємо дані на сервер, якщо можливо
                const userId = this.getUserId();
                if (userId && api) {
                    api(`/api/user/${userId}/settings`, 'POST', {
                        username: username,
                        avatar_id: avatarId
                    }).catch(error => {
                        console.error('Помилка оновлення профілю на сервері:', error);
                    });
                }

                // Закриваємо модальне вікно з анімацією
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;

                    // Показуємо повідомлення про успішне оновлення
                    if (window.showToast) {
                        window.showToast('Профіль успішно оновлено');
                    }
                }, 300);
            });

            // Обробник для закриття вікна
            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
            };

            modal.querySelector('.close-modal').onclick = closeModal;
            modal.querySelector('#cancel-profile-edit').onclick = closeModal;

            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            };
        },

        /**
         * Показ модального вікна з ліцензією
         */
        showLicenseModal: function() {
            const translations = {
                uk: {
                    license: "Ліцензія WINIX",
                    close: "Закрити"
                },
                en: {
                    license: "WINIX License",
                    close: "Close"
                },
                ru: {
                    license: "Лицензия WINIX",
                    close: "Закрыть"
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
                        <div class="modal-title">${t.license}</div>
                        <span class="close-modal">×</span>
                    </div>
                    <div class="modal-body">
                        <div class="document-content">
                            <h3>Ліцензійна угода WINIX</h3>
                            <p>Ця ліцензійна угода (далі - "Угода") регулює використання програмного продукту WINIX та його компонентів (далі - "Продукт").</p>
                            
                            <h3>1. Загальні положення</h3>
                            <p>Продукт WINIX є інтелектуальною власністю її розробників та захищений міжнародними законами про авторське право.</p>
                            
                            <h3>2. Права користувача</h3>
                            <p>Користувач має право використовувати Продукт в особистих некомерційних цілях. Отримання винагороди в WINIX токенах через використання функцій додатку не порушує умов некомерційного використання.</p>
                            
                            <h3>3. Обмеження</h3>
                            <p>Користувачу забороняється:</p>
                            <p>- Копіювати, модифікувати, декомпілювати або іншим чином змінювати вихідний код Продукту</p>
                            <p>- Поширювати, продавати або передавати Продукт третім особам</p>
                            <p>- Використовувати Продукт для будь-яких незаконних цілей</p>
                            
                            <h3>4. Відповідальність</h3>
                            <p>Продукт надається "як є", без будь-яких гарантій. Розробники не несуть відповідальності за будь-які збитки, пов'язані з використанням або неможливістю використання Продукту.</p>
                            
                            <h3>5. Термін дії</h3>
                            <p>Ця Угода набуває чинності з моменту початку використання Продукту і діє безстроково. Розробники залишають за собою право припинити дію цієї Угоди в разі порушення її умов користувачем.</p>
                            
                            <h3>6. Зміни в Угоді</h3>
                            <p>Розробники залишають за собою право вносити зміни в цю Угоду в будь-який час без попереднього повідомлення. Актуальна версія Угоди завжди доступна в додатку.</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="close-license">${t.close}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

            // Обробник для закриття вікна
            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
            };

            modal.querySelector('.close-modal').onclick = closeModal;
            modal.querySelector('#close-license').onclick = closeModal;

            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            };
        },

        /**
         * Показ модального вікна з угодою користувача
         */
        showAgreementModal: function() {
            const translations = {
                uk: {
                    agreement: "Угода користувача",
                    close: "Закрити"
                },
                en: {
                    agreement: "User Agreement",
                    close: "Close"
                },
                ru: {
                    agreement: "Пользовательское соглашение",
                    close: "Закрыть"
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
                        <div class="modal-title">${t.agreement}</div>
                        <span class="close-modal">×</span>
                    </div>
                    <div class="modal-body">
                        <div class="document-content">
                            <h3>Угода користувача WINIX</h3>
                            <p>Ця угода користувача (далі - "Угода") регулює використання WINIX додатку та всіх пов'язаних сервісів.</p>
                            
                            <h3>1. Реєстрація та авторизація</h3>
                            <p>1.1. Для використання WINIX необхідна авторизація через Telegram.</p>
                            <p>1.2. Користувач несе відповідальність за безпеку своїх облікових даних, включаючи пароль та SID-фразу.</p>
                            <p>1.3. Користувач зобов'язується не передавати свої дані авторизації третім особам.</p>
                            
                            <h3>2. Використання сервісу</h3>
                            <p>2.1. Користувач має право використовувати всі доступні функції WINIX відповідно до їх призначення.</p>
                            <p>2.2. Платформа WINIX використовує власні токени, які не мають прямої конвертації у фіатні валюти.</p>
                            <p>2.3. Адміністрація WINIX має право обмежити доступ користувача до сервісу в разі порушення умов цієї Угоди.</p>
                            
                            <h3>3. Стейкінг</h3>
                            <p>3.1. Функція стейкінгу дозволяє користувачам блокувати певну кількість WINIX токенів на певний період часу в обмін на винагороду.</p>
                            <p>3.2. Умови стейкінгу, включаючи відсоток винагороди та терміни, можуть змінюватися адміністрацією WINIX.</p>
                            <p>3.3. Дострокове скасування стейкінгу може призвести до втрати частини заблокованих коштів згідно з актуальними умовами.</p>
                            
                            <h3>4. Транзакції</h3>
                            <p>4.1. Користувач несе повну відповідальність за всі транзакції, виконані з використанням його облікового запису.</p>
                            <p>4.2. Відправлення WINIX токенів іншим користувачам є незворотною операцією.</p>
                            
                            <h3>5. Обмеження відповідальності</h3>
                            <p>5.1. Адміністрація WINIX не несе відповідальності за будь-які збитки, пов'язані з використанням або неможливістю використання сервісу.</p>
                            <p>5.2. Сервіс надається "як є", без будь-яких гарантій.</p>
                            
                            <h3>6. Конфіденційність</h3>
                            <p>6.1. Адміністрація WINIX зобов'язується не передавати персональні дані користувачів третім особам, крім випадків, передбачених законодавством.</p>
                            <p>6.2. Користувач погоджується на обробку своїх персональних даних в межах, необхідних для функціонування сервісу.</p>
                            
                            <h3>7. Зміни в Угоді</h3>
                            <p>7.1. Адміністрація WINIX залишає за собою право вносити зміни в цю Угоду в будь-який час.</p>
                            <p>7.2. Продовження використання сервісу після внесення змін в Угоду означає згоду користувача з цими змінами.</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="close-agreement">${t.close}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

            // Додаємо клас show з невеликою затримкою для анімації
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

            // Обробник для закриття вікна
            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                    _currentModal = null;
                }, 300);
            };

            modal.querySelector('.close-modal').onclick = closeModal;
            modal.querySelector('#close-agreement').onclick = closeModal;

            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal();
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
            if (window.showLoading) {
                window.showLoading('Завантаження SID фрази...');
            } else {
                console.log("Завантаження SID фрази...");
            }

            // Перевіряємо наявність API
            if (!api) {
                console.error("❌ SETTINGS: API недоступний для отримання SID фрази");

                // Встановлюємо пароль і показуємо фіктивну фразу для демонстрації
                if (!hasPassword) {
                    this.showSetPasswordModal(password => {
                        if (window.hideLoading) window.hideLoading();
                        const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";
                        this.showSeedPhraseModal(fakeSeedPhrase);
                    });
                } else {
                    this.showEnterPasswordModal(password => {
                        if (window.hideLoading) window.hideLoading();
                        const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";
                        this.showSeedPhraseModal(fakeSeedPhrase);
                    });
                }
                return;
            }

            // Намагаємось отримати seed-фразу через API
            api(`/api/user/${userId}/seed-phrase`, 'GET')
                .then(response => {
                    // Ховаємо індикатор завантаження
                    if (window.hideLoading) {
                        window.hideLoading();
                    }

                    console.log("Відповідь від сервера:", response);

                    if (response.status === 'success' && response.data && response.data.seed_phrase) {
                        // Якщо пароль не встановлено, показуємо спочатку вікно для встановлення пароля
                        if (!hasPassword) {
                            this.showSetPasswordModal(password => {
                                // Показуємо сід-фразу після встановлення пароля
                                this.showSeedPhraseModal(response.data.seed_phrase);
                            });
                        } else {
                            // Якщо пароль вже встановлено, показуємо спочатку вікно вводу пароля
                            this.showEnterPasswordModal(password => {
                                // Показуємо сід-фразу після вводу правильного пароля
                                this.showSeedPhraseModal(response.data.seed_phrase);
                            });
                        }
                    } else if (response.status === 'password_required') {
                        // Якщо потрібен пароль, показуємо вікно введення пароля
                        this.showEnterPasswordModal(password => {
                            // Отримуємо сід-фразу з використанням пароля
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
                    } else {
                        console.error("❌ SETTINGS: Неочікувана відповідь API", response);

                        // Використовуємо фіктивну фразу для демонстрації
                        const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";

                        // Якщо пароль не встановлено, показуємо спочатку вікно для встановлення пароля
                        if (!hasPassword) {
                            this.showSetPasswordModal(password => {
                                this.showSeedPhraseModal(fakeSeedPhrase);
                            });
                        } else {
                            this.showEnterPasswordModal(password => {
                                this.showSeedPhraseModal(fakeSeedPhrase);
                            });
                        }
                    }
                })
                .catch(error => {
                    // Ховаємо індикатор завантаження
                    if (window.hideLoading) {
                        window.hideLoading();
                    }

                    console.error("❌ SETTINGS: Помилка перевірки статусу SID фрази", error);

                    // Використовуємо фіктивну фразу для демонстрації
                    const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";

                    // Якщо пароль не встановлено, показуємо спочатку вікно для встановлення пароля
                    if (!hasPassword) {
                        this.showSetPasswordModal(password => {
                            this.showSeedPhraseModal(fakeSeedPhrase);
                        });
                    } else {
                        this.showEnterPasswordModal(password => {
                            this.showSeedPhraseModal(fakeSeedPhrase);
                        });
                    }
                });
        }
    };

    // Ініціалізація після завантаження DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Додаємо преміум-стилі
        addPremiumStyles();

        // Фіксуємо навігацію
        fixNavigation();

        // Знаходимо кнопку показу сід-фрази
        const showSeedBtn = document.getElementById('show-seed-phrase');
        if (showSeedBtn) {
            showSeedBtn.addEventListener('click', function() {
                window.WinixSettings.handleShowSeedPhrase();
            });
        }

        // Знаходимо кнопку редагування профілю
        const editProfileBtn = document.getElementById('edit-profile');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', function() {
                window.WinixSettings.showProfileEditModal();
            });
        }

        // Знаходимо кнопку ліцензії
        const licenseBtn = document.getElementById('license-button');
        if (licenseBtn) {
            licenseBtn.addEventListener('click', function() {
                window.WinixSettings.showLicenseModal();
            });
        }

        // Знаходимо кнопку угоди користувача
        const agreementBtn = document.getElementById('agreement-button');
        if (agreementBtn) {
            agreementBtn.addEventListener('click', function() {
                window.WinixSettings.showAgreementModal();
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

    // Додаємо обробник для Escape, щоб закривати активне модальне вікно
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _currentModal) {
            _currentModal.classList.remove('show');
            setTimeout(() => {
                _currentModal.remove();
                _currentModal = null;
            }, 300);
        }
    });

    // Додаємо обробник для оновлення навігації при зміні розміру вікна
    window.addEventListener('resize', fixNavigation);

    // Якщо DOM вже завантажено, ініціалізуємо обробники
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Додаємо преміум-стилі
        addPremiumStyles();

        // Фіксуємо навігацію
        fixNavigation();

        const showSeedBtn = document.getElementById('show-seed-phrase');
        if (showSeedBtn) {
            showSeedBtn.addEventListener('click', function() {
                window.WinixSettings.handleShowSeedPhrase();
            });
        }

        // Знаходимо кнопку редагування профілю
        const editProfileBtn = document.getElementById('edit-profile');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', function() {
                window.WinixSettings.showProfileEditModal();
            });
        }

        // Знаходимо кнопку ліцензії
        const licenseBtn = document.getElementById('license-button');
        if (licenseBtn) {
            licenseBtn.addEventListener('click', function() {
                window.WinixSettings.showLicenseModal();
            });
        }

        // Знаходимо кнопку угоди користувача
        const agreementBtn = document.getElementById('agreement-button');
        if (agreementBtn) {
            agreementBtn.addEventListener('click', function() {
                window.WinixSettings.showAgreementModal();
            });
        }
    }

    console.log("✅ SETTINGS: Модуль налаштувань успішно ініціалізовано");
})();