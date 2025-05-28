/**
 * loader.js - Система завантаження та ініціалізації WINIX
 * Забезпечує правильну послідовність завантаження модулів
 * @version 1.0.0
 */

(function() {
    'use strict';

    console.log('🚀 Loader: Початок завантаження системи');

    // Створюємо екран завантаження
    function createLoadingScreen() {
        const loader = document.createElement('div');
        loader.id = 'winix-loader';
        loader.innerHTML = `
            <div class="loader-container">
                <div class="loader-content">
                    <div class="loader-logo">
                        <div class="logo-hexagon">
                            <span class="logo-letter">W</span>
                        </div>
                        <div class="orbit-container">
                            <div class="orbit orbit-1"></div>
                            <div class="orbit orbit-2"></div>
                            <div class="orbit orbit-3"></div>
                        </div>
                    </div>
                    <div class="loader-text">
                        <h2>WINIX</h2>
                        <p id="loader-status">Ініціалізація...</p>
                    </div>
                    <div class="loader-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="loader-progress"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Додаємо стилі
        const style = document.createElement('style');
        style.textContent = `
            #winix-loader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #0a0b14;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 1;
                transition: opacity 0.5s ease-out;
            }

            #winix-loader.hiding {
                opacity: 0;
                pointer-events: none;
            }

            .loader-container {
                text-align: center;
                padding: 2rem;
            }

            .loader-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2rem;
            }

            .loader-logo {
                position: relative;
                width: 150px;
                height: 150px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .logo-hexagon {
                width: 100px;
                height: 100px;
                background: linear-gradient(135deg, #b366ff, #8b5cf6);
                clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 2;
                animation: hexagon-pulse 2s ease-in-out infinite;
            }

            @keyframes hexagon-pulse {
                0%, 100% {
                    transform: scale(1);
                    filter: brightness(1);
                }
                50% {
                    transform: scale(1.05);
                    filter: brightness(1.2);
                }
            }

            .logo-letter {
                font-size: 3rem;
                font-weight: 800;
                color: white;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
            }

            .orbit-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .orbit {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                border: 1px solid rgba(179, 102, 255, 0.3);
                border-radius: 50%;
                animation: orbit-rotate 15s linear infinite;
            }

            .orbit-1 {
                width: 120px;
                height: 120px;
                animation-duration: 15s;
            }

            .orbit-2 {
                width: 140px;
                height: 140px;
                animation-duration: 20s;
                animation-direction: reverse;
            }

            .orbit-3 {
                width: 160px;
                height: 160px;
                animation-duration: 25s;
            }

            @keyframes orbit-rotate {
                from { transform: translate(-50%, -50%) rotate(0deg); }
                to { transform: translate(-50%, -50%) rotate(360deg); }
            }

            .loader-text h2 {
                font-size: 2rem;
                font-weight: 700;
                color: white;
                margin: 0;
                letter-spacing: 0.2em;
                background: linear-gradient(45deg, #fff, #b366ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .loader-text p {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.6);
                margin: 0.5rem 0 0;
                animation: status-pulse 1.5s ease-in-out infinite;
            }

            @keyframes status-pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }

            .loader-progress {
                width: 200px;
                margin: 0 auto;
            }

            .progress-bar {
                width: 100%;
                height: 6px;
                background: rgba(179, 102, 255, 0.2);
                border-radius: 3px;
                overflow: hidden;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #b366ff, #8b5cf6);
                border-radius: 3px;
                width: 0%;
                transition: width 0.3s ease;
                box-shadow: 0 0 10px rgba(179, 102, 255, 0.5);
                position: relative;
                overflow: hidden;
            }

            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.3),
                    transparent
                );
                animation: shimmer 1.5s infinite;
            }

            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }

            /* Приховуємо основний контент поки йде завантаження */
            body.loading > *:not(#winix-loader):not(script):not(style) {
                display: none !important;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(loader);
        document.body.classList.add('loading');
    }

    // Оновлення статусу завантаження
    function updateLoaderStatus(status, progress) {
        const statusElement = document.getElementById('loader-status');
        const progressElement = document.getElementById('loader-progress');

        if (statusElement) {
            statusElement.textContent = status;
        }

        if (progressElement && typeof progress === 'number') {
            progressElement.style.width = `${progress}%`;
        }
    }

    // Приховування екрану завантаження
    function hideLoader() {
        const loader = document.getElementById('winix-loader');
        if (loader) {
            loader.classList.add('hiding');
            setTimeout(() => {
                loader.remove();
                document.body.classList.remove('loading');
            }, 500);
        }
    }

    // Головна функція ініціалізації
    async function initializeApp() {
        try {
            // Крок 1: Перевіряємо Telegram WebApp
            updateLoaderStatus('Перевірка Telegram...', 10);

            if (!window.Telegram || !window.Telegram.WebApp) {
                throw new Error('Telegram WebApp не знайдено');
            }

            // Ініціалізуємо Telegram WebApp
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();

            // Отримуємо ID користувача
            const telegramData = window.Telegram.WebApp.initDataUnsafe;
            if (!telegramData || !telegramData.user || !telegramData.user.id) {
                throw new Error('Не вдалося отримати ID користувача');
            }

            const userId = telegramData.user.id.toString();
            console.log('✅ Loader: Отримано Telegram ID:', userId);

            // Зберігаємо ID
            localStorage.setItem('telegram_user_id', userId);

            // Оновлюємо елемент на сторінці
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
            }

            // Крок 2: Чекаємо завантаження API модуля
            updateLoaderStatus('Завантаження API...', 30);
            await waitForAPI();

            // Крок 3: Авторизація
            updateLoaderStatus('Авторизація...', 50);
            await authorizeUser(telegramData.user);

            // Крок 4: Завантаження даних користувача
            updateLoaderStatus('Завантаження даних...', 70);
            await loadUserData();

            // Крок 5: Ініціалізація модулів
            updateLoaderStatus('Запуск системи...', 90);
            await initializeModules();

            // Завершення
            updateLoaderStatus('Готово!', 100);

            setTimeout(() => {
                hideLoader();
                console.log('✅ Loader: Система успішно завантажена');
            }, 500);

        } catch (error) {
            console.error('❌ Loader: Помилка ініціалізації:', error);
            updateLoaderStatus('Помилка: ' + error.message, 0);

            // Показуємо кнопку перезавантаження
            setTimeout(() => {
                const loaderContent = document.querySelector('.loader-content');
                if (loaderContent) {
                    const retryButton = document.createElement('button');
                    retryButton.textContent = 'Перезавантажити';
                    retryButton.style.cssText = `
                        margin-top: 20px;
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #b366ff, #8b5cf6);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    `;
                    retryButton.onclick = () => window.location.reload();
                    loaderContent.appendChild(retryButton);
                }
            }, 1000);
        }
    }

    // Чекаємо на завантаження API
    async function waitForAPI() {
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                console.log('✅ Loader: API модуль готовий');
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        throw new Error('API модуль не завантажився');
    }

    // Авторизація користувача
    async function authorizeUser(userData) {
        if (!window.WinixAuth || !window.WinixAuth.authorizeUser) {
            throw new Error('Модуль авторизації не готовий');
        }

        const authData = {
            ...userData,
            id: userData.id.toString(),
            telegram_id: userData.id.toString(),
            initData: window.Telegram.WebApp.initData
        };

        console.log('🔐 Loader: Авторизація з даними:', {
            id: authData.id,
            username: authData.username,
            hasInitData: !!authData.initData
        });

        const result = await window.WinixAuth.authorizeUser(authData);
        console.log('✅ Loader: Авторизація успішна');
        return result;
    }

    // Завантаження даних користувача
    async function loadUserData() {
        if (!window.WinixCore || !window.WinixCore.getUserData) {
            console.warn('⚠️ Loader: Core модуль не готовий, пропускаємо');
            return;
        }

        try {
            await window.WinixCore.getUserData(true);
            console.log('✅ Loader: Дані користувача завантажено');
        } catch (error) {
            console.warn('⚠️ Loader: Не вдалося завантажити дані:', error);
        }
    }

    // Ініціалізація модулів
    async function initializeModules() {
        // Тут можна додати ініціалізацію інших модулів
        console.log('✅ Loader: Модулі ініціалізовано');
    }

    // Запускаємо при завантаженні DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createLoadingScreen();
            initializeApp();
        });
    } else {
        createLoadingScreen();
        initializeApp();
    }

    // Експортуємо для глобального використання
    window.WinixLoader = {
        updateStatus: updateLoaderStatus,
        hide: hideLoader
    };

})();