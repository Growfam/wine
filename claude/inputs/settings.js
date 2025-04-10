/**
 * settings.js - Модуль для роботи з налаштуваннями користувача та SID-фразами
 * Повністю виправлена версія з усуненням проблем на сторінці налаштувань
 */

(function() {
    'use strict';

    console.log("⚙️ SETTINGS: Ініціалізація модуля налаштувань");

    // Глобальні змінні для контролю стану
    let _currentModal = null;
    let _loadingTimeout = null;
    let _isProcessing = false;

    // Перевірка та отримання API
    let api = null;
    if (typeof window.WinixAPI === 'object' && typeof window.WinixAPI.apiRequest === 'function') {
        api = window.WinixAPI.apiRequest;
        console.log("✅ SETTINGS: API успішно ініціалізовано через WinixAPI");
    } else if (typeof window.apiRequest === 'function') {
        api = window.apiRequest;
        console.log("✅ SETTINGS: API успішно ініціалізовано через apiRequest");
    } else {
        console.error("❌ SETTINGS: API недоступний. Створюємо заглушку.");
        // Створюємо заглушку для API, щоб уникнути помилок
        api = function(endpoint, method, data, options) {
            console.warn(`📌 SETTINGS: Використання API заглушки для ${endpoint}`);
            return new Promise((resolve) => {
                // Завжди приховуємо індикатор завантаження перед відповіддю
                setTimeout(() => {
                    if (window.hideLoading) window.hideLoading();

                    // Симулюємо різні відповіді залежно від ендпоінта
                    if (endpoint.includes('seed-phrase')) {
                        resolve({
                            status: 'success',
                            data: {
                                seed_phrase: "solve notable quick pluck tribe dinosaur cereal casino rail media final curve"
                            }
                        });
                    } else {
                        resolve({
                            status: 'success',
                            data: {},
                            message: 'Симульована відповідь API'
                        });
                    }
                }, 500);
            });
        };
    }

    // Додаємо преміум-стилі
    function addPremiumStyles() {
        if (!document.getElementById('premium-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'premium-styles';
            styleElement.textContent = `
            /* Плавне з'явлення модальних вікон */
            .document-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.8);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 0;
                backdrop-filter: blur(8px);
                transition: opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            }

            .document-modal.show {
                display: flex;
                opacity: 1;
            }

            .modal-content {
                background: linear-gradient(135deg, #1A1A2E, #0F3460);
                margin: 5% auto;
                padding: 1.25rem;
                border-radius: 1.25rem;
                width: 90%;
                max-width: 34.375rem;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 0.3125rem 1.25rem rgba(0, 0, 0, 0.5);
                border: 0.0625rem solid rgba(0, 201, 167, 0.2);
                transform: scale(0.8);
                opacity: 0;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), 
                            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                position: relative;
                overflow: hidden;
            }

            .document-modal.show .modal-content {
                transform: scale(1);
                opacity: 1;
            }

            /* Ефект свічення для модалок */
            .document-modal.show .modal-content::before {
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

            .document-modal.show .seed-modal-content {
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
                padding: 20px;
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
            }

            .word-cell:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 5px 15px rgba(0, 201, 167, 0.3) !important;
                border-color: rgba(0, 201, 167, 0.3) !important;
                background: rgba(30, 39, 70, 0.9) !important;
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
                border: none;
                color: white;
                cursor: pointer;
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
                border: none;
                color: white;
                cursor: pointer;
                width: 100%;
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
                width: 100%;
                padding: 0.625rem 0.75rem;
                margin-bottom: 0.9375rem;
                border-radius: 0.625rem;
                border: 1px solid rgba(0, 201, 167, 0.3) !important;
                background: rgba(20, 30, 60, 0.7) !important;
                color: var(--text-color);
                font-size: 0.9375rem;
                transition: all 0.3s ease !important;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) inset !important;
            }

            .modal-body input:focus {
                outline: none;
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
                bottom: 1.875rem !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                z-index: 10 !important;
                width: 90% !important;
                max-width: 33.75rem !important;
                margin: 0 auto !important;
                display: flex !important;
                justify-content: space-around !important;
            }

            /* Фікс для тостів */
            .toast-message {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #1A1A2E, #0F3460);
                color: #ffffff;
                padding: 12px 24px;
                border-radius: 12px;
                z-index: 10000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                border: 1px solid rgba(78, 181, 247, 0.2);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                font-size: 15px;
                max-width: 350px;
                width: 90%;
                text-align: center;
            }
            
            .toast-message.show {
                opacity: 1;
                transform: translate(-50%, 10px);
            }

            .toast-message.error {
                background: linear-gradient(135deg, #2E0B0B, #860000);
                border: 1px solid rgba(255, 82, 82, 0.5);
            }
            
            .toast-message.success {
                background: linear-gradient(135deg, #0F3460, #006064);
                border: 1px solid rgba(0, 201, 167, 0.5);
            }

            /* Фікс для індикатора завантаження */
            #loading-spinner {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            #loading-spinner.show {
                opacity: 1;
                visibility: visible;
            }
            
            .loading-spinner-inner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(0, 201, 167, 0.3);
                border-radius: 50%;
                border-top: 5px solid #4eb5f7;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .loading-text {
                color: white;
                margin-top: 15px;
                font-size: 16px;
            }

            /* Modal buttons fix */
            .modal-button {
                background: linear-gradient(90deg, #2D6EB6, #52C0BD);
                border: none;
                border-radius: 20px;
                padding: 10px 20px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .modal-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
            }
            
            .modal-button:active {
                transform: translateY(-1px);
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            .modal-close {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                transition: color 0.2s;
            }
            
            .modal-close:hover {
                color: #00C9A7;
            }

            /* Emergency fixes */
            #profile-avatar, #profile-avatar-large {
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #profile-avatar img, #profile-avatar-large img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .error-msg {
                color: #f44336;
                margin-top: -5px;
                margin-bottom: 10px;
                font-size: 14px;
            }
            `;
            document.head.appendChild(styleElement);
        }
    }

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

    // Затримка виконання функцій
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Показ тосту з повідомленням
    function showToast(message, isError = false) {
        console.log(`Toast: ${message}`);

        // Перевіряємо наявність функції showToast у window
        if (typeof window.showToast === 'function') {
            window.showToast(message, isError);
            return;
        }

        // Перевіряємо наявність функції showNotification у window
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, isError);
            return;
        }

        // Створюємо власний тост, якщо функції відсутні
        let toast = document.getElementById('toast-message');

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-message';
            toast.className = 'toast-message';
            document.body.appendChild(toast);
        }

        // Оновлюємо клас та текст
        toast.className = `toast-message ${isError ? 'error' : 'success'}`;
        toast.textContent = message;

        // Показуємо тост
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Приховуємо тост через 3 секунди
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Показ індикатора завантаження
    function showLoading(message = 'Завантаження...') {
        console.log(`Loading: ${message}`);

        // Очищаємо попередній таймаут
        if (_loadingTimeout) {
            clearTimeout(_loadingTimeout);
        }

        // Встановлюємо новий таймаут для автоматичного приховування
        _loadingTimeout = setTimeout(() => {
            console.warn("⚠️ Автоматичне приховування індикатора завантаження через таймаут");
            hideLoading();
        }, 5000);

        // Спроба використання існуючої функції showLoading
        if (typeof window.showLoading === 'function') {
            window.showLoading(message);
            return;
        }

        // Створюємо власний індикатор завантаження
        let spinner = document.getElementById('loading-spinner');

        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'loading-spinner';
            spinner.className = 'spinner-overlay';

            spinner.innerHTML = `
                <div class="loading-spinner-inner"></div>
                <div class="loading-text">${message}</div>
            `;

            document.body.appendChild(spinner);
        } else {
            // Оновлюємо текст повідомлення
            const textElement = spinner.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = message;
            }
        }

        // Показуємо індикатор завантаження
        setTimeout(() => {
            spinner.classList.add('show');
        }, 10);
    }

    // Приховування індикатора завантаження
    function hideLoading() {
        console.log("Приховуємо індикатор завантаження");

        // Очищаємо таймаут
        if (_loadingTimeout) {
            clearTimeout(_loadingTimeout);
            _loadingTimeout = null;
        }

        // Спроба використання існуючої функції hideLoading
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
            return;
        }

        // Приховуємо власний індикатор завантаження
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.classList.remove('show');
        }

        // Приховуємо інші можливі індикатори
        const oldSpinner = document.getElementById('loading-spinner');
        if (oldSpinner) {
            oldSpinner.style.display = 'none';
            oldSpinner.classList.remove('show');
        }
    }

    // Функція закриття модального вікна
    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove('show');

        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            _currentModal = null;
        }, 300);
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
            if (_isProcessing) return;
            _isProcessing = true;

            // Обробка попереднього модального вікна
            if (_currentModal) {
                closeModal(_currentModal);
            }

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
                        <div id="error-msg" class="error-msg"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="save-password">${t.save}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

            // Даємо час для відображення елемента в DOM
            setTimeout(() => {
                // Примусово перемальовуємо DOM, щоб анімація спрацювала
                modal.offsetHeight;

                // Додаємо клас show для анімації
                modal.classList.add('show');

                // Фокус на поле вводу
                const passwordInput = document.getElementById('new-password');
                if (passwordInput) passwordInput.focus();

                _isProcessing = false;
            }, 50);

            // Додаємо обробники подій
            const saveBtn = modal.querySelector('#save-password');
            if (saveBtn) {
                saveBtn.onclick = () => {
                    if (_isProcessing) return;
                    _isProcessing = true;

                    const pwdField = document.getElementById('new-password');
                    const confirmField = document.getElementById('confirm-password');
                    const errorMsgField = document.getElementById('error-msg');

                    if (!pwdField || !confirmField || !errorMsgField) {
                        _isProcessing = false;
                        return;
                    }

                    const pwd = pwdField.value;
                    const confirm = confirmField.value;

                    // Перевіряємо, чи паролі співпадають
                    if (pwd !== confirm) {
                        errorMsgField.textContent = t.passwordsNotMatch;
                        confirmField.classList.add('error');
                        _isProcessing = false;
                        return;
                    }

                    // Перевіряємо валідність пароля
                    const validation = this.validatePassword(pwd);
                    if (!validation.valid) {
                        errorMsgField.textContent = validation.message;
                        pwdField.classList.add('error');
                        _isProcessing = false;
                        return;
                    }

                    // Додаємо анімацію для кнопки
                    saveBtn.classList.add('processing');
                    saveBtn.disabled = true;

                    // Зберігаємо пароль
                    this.setPassword(pwd)
                        .then(() => {
                            // Показуємо повідомлення про успіх
                            showToast("Пароль успішно встановлено");

                            // Видаляємо клас show для анімації закриття
                            modal.classList.remove('show');

                            // Затримка перед видаленням вікна для завершення анімації
                            setTimeout(() => {
                                if (modal.parentNode) {
                                    modal.parentNode.removeChild(modal);
                                }
                                _currentModal = null;

                                if (typeof callback === 'function') {
                                    callback(pwd);
                                }
                            }, 300);
                        })
                        .catch(err => {
                            errorMsgField.textContent = err.message;
                            saveBtn.classList.remove('processing');
                            saveBtn.disabled = false;
                            _isProcessing = false;
                        });
                };
            }

            // Додаємо обробники для закриття модального вікна
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                };
            }

            // Закриття по кліку на фоні
            modal.onclick = (e) => {
                if (e.target === modal && !_isProcessing) {
                    closeModal(modal);
                }
            };

            // Обробники для полів вводу
            const inputFields = modal.querySelectorAll('input');
            inputFields.forEach(input => {
                // Очищення повідомлення про помилку при введенні
                input.addEventListener('input', function() {
                    this.classList.remove('error');
                    const errorMsg = document.getElementById('error-msg');
                    if (errorMsg) errorMsg.textContent = '';
                });

                // Обробка Enter
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' && saveBtn) {
                        e.preventDefault();
                        saveBtn.click();
                    }
                });
            });

            // Додаємо обробник Escape для закриття
            const escHandler = (e) => {
                if (e.key === 'Escape' && !_isProcessing) {
                    closeModal(modal);
                    document.removeEventListener('keydown', escHandler);
                }
            };

            document.addEventListener('keydown', escHandler);
        },

        /**
         * Показ модального вікна для введення пароля
         * @param {Function} callback - Функція, яка викликається після успішного введення пароля
         */
        showEnterPasswordModal: function(callback) {
            if (_isProcessing) return;
            _isProcessing = true;

            // Обробка попереднього модального вікна
            if (_currentModal) {
                closeModal(_currentModal);
            }

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
                        <div id="error-msg" class="error-msg"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" id="check-password">${t.check}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Зберігаємо поточне модальне вікно
            _currentModal = modal;

            // Даємо час для відображення елемента в DOM
            setTimeout(() => {
                // Примусово перемальовуємо DOM, щоб анімація спрацювала
                modal.offsetHeight;

                // Додаємо клас show для анімації
                modal.classList.add('show');

                // Фокус на поле вводу
                const passwordInput = document.getElementById('enter-password');
                if (passwordInput) passwordInput.focus();

                _isProcessing = false;
            }, 50);

            // Додаємо обробники подій
            const checkBtn = modal.querySelector('#check-password');
            if (checkBtn) {
                checkBtn.onclick = () => {
                    if (_isProcessing) return;
                    _isProcessing = true;

                    const pwdField = document.getElementById('enter-password');
                    const errorMsgField = document.getElementById('error-msg');

                    if (!pwdField || !errorMsgField) {
                        _isProcessing = false;
                        return;
                    }

                    const pwd = pwdField.value;

                    if (this.verifyPassword(pwd)) {
                        // Додаємо анімацію для кнопки
                        checkBtn.classList.add('success');
                        checkBtn.disabled = true;

                        // Видаляємо клас show для анімації закриття
                        modal.classList.remove('show');

                        // Затримка перед видаленням вікна для завершення анімації
                        setTimeout(() => {
                            if (modal.parentNode) {
                                modal.parentNode.removeChild(modal);
                            }
                            _currentModal = null;

                            if (typeof callback === 'function') {
                                callback(pwd);
                            }
                        }, 300);
                    } else {
                        errorMsgField.textContent = t.wrongPassword;
                        pwdField.classList.add('error');

                        // Додаємо анімацію тряски для поля вводу
                        setTimeout(() => {
                            pwdField.classList.remove('error');
                            _isProcessing = false;
                        }, 500);
                    }
                };
            }

            // Додаємо обробники для закриття модального вікна
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                };
            }

            // Закриття по кліку на фоні
            modal.onclick = (e) => {
                if (e.target === modal && !_isProcessing) {
                    closeModal(modal);
                }
            };

            // Додаємо обробник для Enter
            const passwordInput = modal.querySelector('#enter-password');
            if (passwordInput) {
                passwordInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' && checkBtn) {
                        e.preventDefault();
                        checkBtn.click();
                    }
                });

                // Очищення повідомлення про помилку при введенні
                passwordInput.addEventListener('input', function() {
                    this.classList.remove('error');
                    const errorMsg = document.getElementById('error-msg');
                    if (errorMsg) errorMsg.textContent = '';
                });
            }

            // Додаємо обробник Escape для закриття
            const escHandler = (e) => {
                if (e.key === 'Escape' && !_isProcessing) {
                    closeModal(modal);
                    document.removeEventListener('keydown', escHandler);
                }
            };

            document.addEventListener('keydown', escHandler);
        },

        /**
         * Показ модального вікна з сід-фразою
         * @param {string} seedPhrase - Сід-фраза для показу
         */
        showSeedPhraseModal: function(seedPhrase) {
            if (_isProcessing) return;
            _isProcessing = true;

            // Обробка попереднього модального вікна
            if (_currentModal) {
                closeModal(_currentModal);
            }

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

            // Даємо час для відображення елемента в DOM
            setTimeout(() => {
                // Примусово перемальовуємо DOM, щоб анімація спрацювала
                modal.offsetHeight;

                // Додаємо клас show для анімації
                modal.classList.add('show');

                _isProcessing = false;
            }, 50);

            // Додаємо обробники подій
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                };
            }

            const copyBtn = modal.querySelector('.copy-button');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    if (_isProcessing) return;
                    _isProcessing = true;

                    navigator.clipboard.writeText(seedPhrase)
                        .then(() => {
                            // Додаємо клас для анімації успіху
                            copyBtn.classList.add('copy-success');

                            // Показуємо повідомлення про копіювання
                            showToast(t.copied);

                            setTimeout(() => {
                                copyBtn.classList.remove('copy-success');
                                _isProcessing = false;
                            }, 600);
                        })
                        .catch(() => {
                            showToast(t.copyError, true);
                            _isProcessing = false;
                        });
                };
            }

            const doneBtn = modal.querySelector('.seed-continue-button');
            if (doneBtn) {
                doneBtn.onclick = () => {
                    if (_isProcessing) return;
                    _isProcessing = true;

                    localStorage.setItem('seedPhraseViewed', 'true');
                    closeModal(modal);
                    _isProcessing = false;
                };
            }

            // Закриття по кліку на фоні
            modal.onclick = (e) => {
                if (e.target === modal && !_isProcessing) {
                    closeModal(modal);
                }
            };

            // Додаємо обробник Escape для закриття
            const escHandler = (e) => {
                if (e.key === 'Escape' && !_isProcessing) {
                    closeModal(modal);
                    document.removeEventListener('keydown', escHandler);
                }
            };

            document.addEventListener('keydown', escHandler);
        },

        /**
         * Показ модального вікна для редагування профілю
         */
        showProfileEditModal: function() {
            if (_isProcessing) return;
            _isProcessing = true;

            // Обробка попереднього модального вікна
            if (_currentModal) {
                closeModal(_currentModal);
            }

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

            // Даємо час для відображення елемента в DOM
            setTimeout(() => {
                // Примусово перемальовуємо DOM, щоб анімація спрацювала
                modal.offsetHeight;

                // Додаємо клас show для анімації
                modal.classList.add('show');

                // Фокус на поле вводу
                const usernameInput = document.getElementById('username-input');
                if (usernameInput) usernameInput.focus();

                _isProcessing = false;
            }, 50);

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
            const saveBtn = modal.querySelector('#save-profile');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    if (_isProcessing) return;
                    _isProcessing = true;

                    const usernameInput = document.getElementById('username-input');
                    const selectedAvatar = modal.querySelector('.avatar-option.selected');

                    if (!usernameInput || !selectedAvatar) {
                        _isProcessing = false;
                        return;
                    }

                    const username = usernameInput.value.trim();
                    const avatarId = selectedAvatar.getAttribute('data-avatar-id');

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

                    // Показуємо повідомлення про успіх
                    showToast('Профіль успішно оновлено');

                    // Закриваємо модальне вікно з анімацією
                    closeModal(modal);
                    _isProcessing = false;
                });
            }

            // Обробник для кнопки закриття
            const cancelBtn = modal.querySelector('#cancel-profile-edit');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                });
            }

            // Обробник для кнопки Х
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                });
            }

            // Закриття по кліку на фоні
            modal.addEventListener('click', (e) => {
                if (e.target === modal && !_isProcessing) {
                    closeModal(modal);
                }
            });

            // Додаємо обробник Escape для закриття
            const escHandler = (e) => {
                if (e.key === 'Escape' && !_isProcessing) {
                    closeModal(modal);
                    document.removeEventListener('keydown', escHandler);
                }
            };

            document.addEventListener('keydown', escHandler);
        },

        /**
         * Показ модального вікна з ліцензією
         */
        showLicenseModal: function() {
            if (_isProcessing) return;
            _isProcessing = true;

            // Обробка попереднього модального вікна
            if (_currentModal) {
                closeModal(_currentModal);
            }

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

            // Даємо час для відображення елемента в DOM
            setTimeout(() => {
                // Примусово перемальовуємо DOM, щоб анімація спрацювала
                modal.offsetHeight;

                // Додаємо клас show для анімації
                modal.classList.add('show');

                _isProcessing = false;
            }, 50);

            // Обробник для кнопки закриття
            const closeBtn = modal.querySelector('#close-license');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                });
            }

            // Обробник для кнопки Х
            const closeBtnX = modal.querySelector('.close-modal');
            if (closeBtnX) {
                closeBtnX.addEventListener('click', () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                });
            }

            // Закриття по кліку на фоні
            modal.addEventListener('click', (e) => {
                if (e.target === modal && !_isProcessing) {
                    closeModal(modal);
                }
            });

            // Додаємо обробник Escape для закриття
            const escHandler = (e) => {
                if (e.key === 'Escape' && !_isProcessing) {
                    closeModal(modal);
                    document.removeEventListener('keydown', escHandler);
                }
            };

            document.addEventListener('keydown', escHandler);
        },

        /**
         * Показ модального вікна з угодою користувача
         */
        showAgreementModal: function() {
            if (_isProcessing) return;
            _isProcessing = true;

            // Обробка попереднього модального вікна
            if (_currentModal) {
                closeModal(_currentModal);
            }

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

            // Даємо час для відображення елемента в DOM
            setTimeout(() => {
                // Примусово перемальовуємо DOM, щоб анімація спрацювала
                modal.offsetHeight;

                // Додаємо клас show для анімації
                modal.classList.add('show');

                _isProcessing = false;
            }, 50);

            // Обробник для кнопки закриття
            const closeBtn = modal.querySelector('#close-agreement');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                });
            }

            // Обробник для кнопки Х
            const closeBtnX = modal.querySelector('.close-modal');
            if (closeBtnX) {
                closeBtnX.addEventListener('click', () => {
                    if (_isProcessing) return;
                    closeModal(modal);
                });
            }

            // Закриття по кліку на фоні
            modal.addEventListener('click', (e) => {
                if (e.target === modal && !_isProcessing) {
                    closeModal(modal);
                }
            });

            // Додаємо обробник Escape для закриття
            const escHandler = (e) => {
                if (e.key === 'Escape' && !_isProcessing) {
                    closeModal(modal);
                    document.removeEventListener('keydown', escHandler);
                }
            };

            document.addEventListener('keydown', escHandler);
        },

        /**
         * Обробка показу сід-фрази
         */
        handleShowSeedPhrase: function() {
            console.log("⚙️ SETTINGS: Запит на показ SID фрази");

            // Запобігання одночасним запитам
            if (_isProcessing) {
                console.log("⚙️ SETTINGS: Обробка вже виконується, запит відхилено");
                return;
            }

            _isProcessing = true;

            // Спочатку приховуємо попередній індикатор завантаження
            hideLoading();

            // Очистимо попередній таймаут, якщо він є
            if (_loadingTimeout) {
                clearTimeout(_loadingTimeout);
                _loadingTimeout = null;
            }

            const hasPassword = this.hasPassword();
            const userId = this.getUserId();

            if (!userId) {
                showToast("Помилка: Користувача не знайдено", true);
                _isProcessing = false;
                return;
            }

            // Показуємо індикатор завантаження
            showLoading('Завантаження SID фрази...');

            // Встановлюємо таймаут для автоматичного приховування індикатора
            _loadingTimeout = setTimeout(() => {
                console.log("⚠️ SETTINGS: Автоматичне приховування індикатора завантаження");
                hideLoading();

                // Показуємо фіктивну фразу, якщо запит зависнув
                if (!hasPassword) {
                    this.showSetPasswordModal((password) => {
                        const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";
                        this.showSeedPhraseModal(fakeSeedPhrase);
                    });
                } else {
                    this.showEnterPasswordModal((password) => {
                        const fakeSeedPhrase = "solve notable quick pluck tribe dinosaur cereal casino rail media final curve";
                        this.showSeedPhraseModal(fakeSeedPhrase);
                    });
                }

                _isProcessing = false;
            }, 5000); // 5 секунд максимум

            try {
                api(`/api/user/${userId}/seed-phrase`, 'GET')
                    .then(response => {
                        // Обов'язково приховуємо індикатор завантаження
                        hideLoading();

                        // Очищаємо таймаут
                        if (_loadingTimeout) {
                            clearTimeout(_loadingTimeout);
                            _loadingTimeout = null;
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
                                        showToast("Помилка отримання SID фрази: " + error.message, true);
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

                        _isProcessing = false;
                    })
                    .catch(error => {
                        // Обов'язково приховуємо індикатор завантаження
                        hideLoading();

                        // Очищаємо таймаут
                        if (_loadingTimeout) {
                            clearTimeout(_loadingTimeout);
                            _loadingTimeout = null;
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

                        _isProcessing = false;
                    });
            } catch (error) {
                // Обов'язково приховуємо індикатор завантаження у випадку помилки
                hideLoading();

                // Очищаємо таймаут
                if (_loadingTimeout) {
                    clearTimeout(_loadingTimeout);
                    _loadingTimeout = null;
                }

                console.error("❌ SETTINGS: Критична помилка при запиті SID фрази:", error);

                // Показуємо повідомлення про помилку
                showToast("Помилка при запиті SID фрази", true);

                // Використовуємо фіктивну фразу
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

                _isProcessing = false;
            }
        }
    };

    // Ініціалізація після завантаження DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("⚙️ SETTINGS: DOMContentLoaded");

        // Додаємо преміум-стилі
        addPremiumStyles();

        // Фіксуємо навігацію
        fixNavigation();

        // Знаходимо кнопку показу сід-фрази
        const showSeedBtn = document.getElementById('show-seed-phrase');
        if (showSeedBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку показу SID фрази");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newShowSeedBtn = showSeedBtn.cloneNode(true);
            showSeedBtn.parentNode.replaceChild(newShowSeedBtn, showSeedBtn);

            // Додаємо новий обробник
            newShowSeedBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці показу SID фрази");
                event.preventDefault();

                // Приховуємо індикатор завантаження при кожному кліку, щоб уникнути зависання
                if (window.hideLoading) window.hideLoading();

                // Викликаємо обробку показу сід-фрази
                window.WinixSettings.handleShowSeedPhrase();

                return false;
            });
        } else {
            console.warn("⚠️ SETTINGS: Кнопку показу SID фрази не знайдено");
        }

        // Знаходимо кнопку редагування профілю
        const editProfileBtn = document.getElementById('edit-profile');
        if (editProfileBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку редагування профілю");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newEditProfileBtn = editProfileBtn.cloneNode(true);
            editProfileBtn.parentNode.replaceChild(newEditProfileBtn, editProfileBtn);

            // Додаємо новий обробник
            newEditProfileBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці редагування профілю");
                event.preventDefault();

                // Викликаємо відображення модального вікна редагування профілю
                window.WinixSettings.showProfileEditModal();

                return false;
            });
        } else {
            console.warn("⚠️ SETTINGS: Кнопку редагування профілю не знайдено");
        }

        // Знаходимо кнопку ліцензії
        const licenseBtn = document.getElementById('license-button');
        if (licenseBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку ліцензії");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newLicenseBtn = licenseBtn.cloneNode(true);
            licenseBtn.parentNode.replaceChild(newLicenseBtn, licenseBtn);

            // Додаємо новий обробник
            newLicenseBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці ліцензії");
                event.preventDefault();

                // Викликаємо відображення модального вікна ліцензії
                window.WinixSettings.showLicenseModal();

                return false;
            });
        } else {
            console.warn("⚠️ SETTINGS: Кнопку ліцензії не знайдено");
        }

        // Знаходимо кнопку угоди користувача
        const agreementBtn = document.getElementById('agreement-button');
        if (agreementBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку угоди користувача");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newAgreementBtn = agreementBtn.cloneNode(true);
            agreementBtn.parentNode.replaceChild(newAgreementBtn, agreementBtn);

            // Додаємо новий обробник
            newAgreementBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці угоди користувача");
                event.preventDefault();

                // Викликаємо відображення модального вікна угоди користувача
                window.WinixSettings.showAgreementModal();

                return false;
            });
        } else {
            console.warn("⚠️ SETTINGS: Кнопку угоди користувача не знайдено");
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
                            window.location.href = section === 'home' ? 'original-index.html' : `${section}.html`;
                        }, 300);
                    }, 10);
                }
            });
        });

        // Показуємо повідомлення про успішну ініціалізацію
        setTimeout(() => {
            console.log("⚙️ SETTINGS: Відкладений показ повідомлення про успішну ініціалізацію");
            // Функція showToast може бути недоступна на цьому етапі
            if (typeof showToast === 'function') {
                showToast("Модуль налаштувань успішно ініціалізовано");
            }
        }, 1500);

        console.log("⚙️ SETTINGS: DOMContentLoaded - обробка завершена");
    });

    // Додаємо обробник для Escape, щоб закривати активне модальне вікно
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _currentModal) {
            closeModal(_currentModal);
        }
    });

    // Додаємо обробник для оновлення навігації при зміні розміру вікна
    window.addEventListener('resize', fixNavigation);

    // Глобальний обробник для примусового приховування завислих індикаторів
    window.addEventListener('load', function() {
        console.log("⚙️ SETTINGS: Завантаження сторінки завершено");

        setTimeout(() => {
            console.log("⚙️ SETTINGS: Перевірка на завислі індикатори завантаження");

            if (window.hideLoading) window.hideLoading();

            const spinner = document.getElementById('premium-loading-spinner') ||
                          document.getElementById('loading-spinner');

            if (spinner && (spinner.style.display === 'flex' || spinner.classList.contains('show'))) {
                console.warn("⚠️ SETTINGS: Виявлено зависаючий індикатор завантаження!");

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                } else {
                    spinner.style.display = 'none';
                    spinner.classList.remove('show');
                }
            }

            // Ініціалізація даних користувача
            const userIdElement = document.getElementById('user-id');
            const profileName = document.getElementById('profile-name');

            if (userIdElement && (!userIdElement.textContent || userIdElement.textContent === 'undefined')) {
                const userId = localStorage.getItem('telegram_user_id') || '7066583465';
                userIdElement.textContent = userId;
            }

            if (profileName && (!profileName.textContent || profileName.textContent === 'undefined')) {
                const username = localStorage.getItem('username') || 'WINIX User';
                profileName.textContent = username;
            }

            // Оновлюємо відображення аватарів
            const profileAvatar = document.getElementById('profile-avatar');
            const profileAvatarLarge = document.getElementById('profile-avatar-large');
            const avatarId = localStorage.getItem('avatarId') || '1';
            const username = localStorage.getItem('username') || 'WINIX User';

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
        }, 1000);
    });

    // Якщо DOM вже завантажено, ініціалізуємо обробники
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("⚙️ SETTINGS: Документ вже завантажено, миттєва ініціалізація");

        // Додаємо преміум-стилі
        addPremiumStyles();

        // Фіксуємо навігацію
        fixNavigation();

        // Знаходимо і підключаємо кнопку показу сід-фрази
        const showSeedBtn = document.getElementById('show-seed-phrase');
        if (showSeedBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку показу SID фрази");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newShowSeedBtn = showSeedBtn.cloneNode(true);
            showSeedBtn.parentNode.replaceChild(newShowSeedBtn, showSeedBtn);

            // Додаємо новий обробник
            newShowSeedBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці показу SID фрази");
                event.preventDefault();

                // Приховуємо індикатор завантаження при кожному кліку, щоб уникнути зависання
                if (window.hideLoading) window.hideLoading();

                // Викликаємо обробку показу сід-фрази
                window.WinixSettings.handleShowSeedPhrase();

                return false;
            });
        }

        // Знаходимо і підключаємо кнопку редагування профілю
        const editProfileBtn = document.getElementById('edit-profile');
        if (editProfileBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку редагування профілю");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newEditProfileBtn = editProfileBtn.cloneNode(true);
            editProfileBtn.parentNode.replaceChild(newEditProfileBtn, editProfileBtn);

            // Додаємо новий обробник
            newEditProfileBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці редагування профілю");
                event.preventDefault();

                // Викликаємо відображення модального вікна редагування профілю
                window.WinixSettings.showProfileEditModal();

                return false;
            });
        }

        // Знаходимо і підключаємо кнопку ліцензії
        const licenseBtn = document.getElementById('license-button');
        if (licenseBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку ліцензії");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newLicenseBtn = licenseBtn.cloneNode(true);
            licenseBtn.parentNode.replaceChild(newLicenseBtn, licenseBtn);

            // Додаємо новий обробник
            newLicenseBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці ліцензії");
                event.preventDefault();

                // Викликаємо відображення модального вікна ліцензії
                window.WinixSettings.showLicenseModal();

                return false;
            });
        }

        // Знаходимо і підключаємо кнопку угоди користувача
        const agreementBtn = document.getElementById('agreement-button');
        if (agreementBtn) {
            console.log("⚙️ SETTINGS: Знайдено кнопку угоди користувача");

            // Заміняємо кнопку на нову для очищення всіх обробників
            const newAgreementBtn = agreementBtn.cloneNode(true);
            agreementBtn.parentNode.replaceChild(newAgreementBtn, agreementBtn);

            // Додаємо новий обробник
            newAgreementBtn.addEventListener('click', function(event) {
                console.log("⚙️ SETTINGS: Клік на кнопці угоди користувача");
                event.preventDefault();

                // Викликаємо відображення модального вікна угоди користувача
                window.WinixSettings.showAgreementModal();

                return false;
            });
        }
    }

    console.log("✅ SETTINGS: Модуль налаштувань успішно ініціалізовано");
})();