/**
 * WINIX - Система розіграшів (index.js)
 * Точка входу для системи розіграшів, підключає всі необхідні модулі
 */

(function() {
    'use strict';

    console.log('🎲 Ініціалізація системи розіграшів WINIX...');

    // Перевірка наявності API модуля
    if (typeof WinixAPI === 'undefined') {
        console.error('❌ WinixAPI не знайдено! Переконайтеся, що api.js підключено на сторінці.');
        return;
    }

    // Перевірка наявності основного модуля системи розіграшів
    if (typeof WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено на сторінці.');
        return;
    }

    // Анімації інтерфейсу
    const initAnimations = function() {
        // Анімація частинок на фоні
        const createParticles = function() {
            const containers = document.querySelectorAll('.particles-container');

            containers.forEach(container => {
                // Очищення контейнера перед створенням нових частинок
                container.innerHTML = '';

                for (let i = 0; i < 10; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'particle';

                    // Випадковий розмір
                    const size = Math.random() * 5 + 2;
                    particle.style.width = `${size}px`;
                    particle.style.height = `${size}px`;

                    // Випадкова початкова позиція
                    particle.style.left = `${Math.random() * 100}%`;
                    particle.style.top = `${Math.random() * 100}%`;

                    // Випадкова прозорість
                    particle.style.opacity = (Math.random() * 0.5 + 0.1).toString();

                    // Випадковий колір
                    const hue = Math.random() * 40 + 190; // Від блакитного до синього
                    particle.style.backgroundColor = `hsla(${hue}, 100%, 70%, 0.6)`;

                    // Випадкова анімація
                    const duration = Math.random() * 15 + 5;
                    particle.style.animationDuration = `${duration}s`;

                    container.appendChild(particle);
                }
            });
        };

        // Анімація прогрес-бару
        const animateProgressBars = function() {
            const progress = document.querySelector('.progress');
            if (progress) {
                setTimeout(() => {
                    progress.style.transition = 'width 1.5s ease-in-out';
                }, 500);
            }
        };

        // Запускаємо анімації
        createParticles();
        animateProgressBars();

        // Перезапуск анімацій при зміні вкладки
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                setTimeout(() => {
                    createParticles();
                    animateProgressBars();
                }, 100);
            });
        });
    };

    // Ініціалізація обробників для модальних вікон
    const initModalHandlers = function() {
        // Функція для показу модального вікна
        window.showModal = function(title, content) {
            // Перевіряємо, чи існує вже модальне вікно
            let modalWrapper = document.querySelector('.modal-wrapper');

            if (!modalWrapper) {
                // Створюємо модальне вікно
                modalWrapper = document.createElement('div');
                modalWrapper.className = 'modal-wrapper';
                modalWrapper.innerHTML = `
                    <div class="modal-overlay"></div>
                    <div class="modal">
                        <div class="modal-header">
                            <h3 class="modal-title"></h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-content"></div>
                    </div>
                `;

                document.body.appendChild(modalWrapper);

                // Додаємо обробник для закриття модального вікна
                modalWrapper.querySelector('.modal-close').addEventListener('click', () => {
                    modalWrapper.classList.remove('active');
                    setTimeout(() => {
                        modalWrapper.remove();
                    }, 300);
                });

                // Додаємо обробник для закриття при кліку на оверлей
                modalWrapper.querySelector('.modal-overlay').addEventListener('click', () => {
                    modalWrapper.querySelector('.modal-close').click();
                });
            }

            // Оновлюємо вміст модального вікна
            modalWrapper.querySelector('.modal-title').textContent = title;
            modalWrapper.querySelector('.modal-content').innerHTML = content;

            // Показуємо модальне вікно
            setTimeout(() => {
                modalWrapper.classList.add('active');
            }, 10);
        };
    };

    // Ініціалізація обробників сповіщень (тостів)
    const initToastHandlers = function() {
        // Функція для показу сповіщення
        window.showToast = function(message, type = 'info') {
            // Перевіряємо, чи існує контейнер для сповіщень
            let toastContainer = document.querySelector('.toast-container');

            if (!toastContainer) {
                // Створюємо контейнер для сповіщень
                toastContainer = document.createElement('div');
                toastContainer.className = 'toast-container';
                document.body.appendChild(toastContainer);
            }

            // Створюємо нове сповіщення
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = message;

            // Додаємо кнопку закриття
            const closeButton = document.createElement('button');
            closeButton.className = 'toast-close';
            closeButton.innerHTML = '&times;';
            closeButton.addEventListener('click', () => {
                toast.classList.add('toast-hide');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            });

            toast.appendChild(closeButton);

            // Додаємо сповіщення до контейнера
            toastContainer.appendChild(toast);

            // Показуємо сповіщення
            setTimeout(() => {
                toast.classList.add('toast-show');
            }, 10);

            // Автоматично закриваємо сповіщення через 5 секунд
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.classList.add('toast-hide');
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.remove();
                        }
                    }, 300);
                }
            }, 5000);
        };
    };

    // Ініціалізація індикатора завантаження
    const initLoadingIndicator = function() {
        // Функція для показу індикатора завантаження
        window.showLoading = function() {
            // Перевіряємо, чи існує індикатор завантаження
            let loadingWrapper = document.querySelector('.loading-wrapper');

            if (!loadingWrapper) {
                // Створюємо індикатор завантаження
                loadingWrapper = document.createElement('div');
                loadingWrapper.className = 'loading-wrapper';
                loadingWrapper.innerHTML = `
                    <div class="loading-overlay"></div>
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                `;

                document.body.appendChild(loadingWrapper);
            }

            // Показуємо індикатор завантаження
            setTimeout(() => {
                loadingWrapper.classList.add('active');
            }, 10);
        };

        // Функція для приховування індикатора завантаження
        window.hideLoading = function() {
            const loadingWrapper = document.querySelector('.loading-wrapper');

            if (loadingWrapper) {
                loadingWrapper.classList.remove('active');
            }
        };
    };

    // Функція ініціалізації допоміжних компонентів
    const initHelpers = function() {
        initAnimations();
        initModalHandlers();
        initToastHandlers();
        initLoadingIndicator();
    };

    // Додаємо CSS стилі для допоміжних компонентів
    const addHelperStyles = function() {
        const style = document.createElement('style');
        style.textContent = `
            /* Стилі для модальних вікон */
            .modal-wrapper {
                position: fixed;
                z-index: 1000;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            
            .modal-wrapper.active {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
            }
            
            .modal {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 500px;
                background: var(--bg-card);
                border-radius: var(--card-border-radius);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                border: 1px solid var(--border-color);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid var(--border-color);
            }
            
            .modal-title {
                margin: 0;
                color: var(--text-color);
                font-size: 1.2rem;
            }
            
            .modal-close {
                background: none;
                border: none;
                color: var(--text-color);
                font-size: 1.5rem;
                cursor: pointer;
            }
            
            .modal-content {
                padding: 15px;
                color: var(--text-color);
                max-height: 70vh;
                overflow-y: auto;
            }
            
            /* Стилі для сповіщень */
            .toast-container {
                position: fixed;
                z-index: 1100;
                top: 20px;
                right: 20px;
                width: 300px;
            }
            
            .toast {
                position: relative;
                margin-bottom: 10px;
                padding: 15px 35px 15px 15px;
                border-radius: 5px;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
                color: white;
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .toast-show {
                opacity: 1;
                transform: translateY(0);
            }
            
            .toast-hide {
                opacity: 0;
                transform: translateY(-20px);
            }
            
            .toast-info {
                background-color: #2196F3;
            }
            
            .toast-success {
                background-color: #4CAF50;
            }
            
            .toast-warning {
                background-color: #FF9800;
            }
            
            .toast-error {
                background-color: #F44336;
            }
            
            .toast-close {
                position: absolute;
                top: 5px;
                right: 5px;
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
            }
            
            /* Стилі для індикатора завантаження */
            .loading-wrapper {
                position: fixed;
                z-index: 1200;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            
            .loading-wrapper.active {
                opacity: 1;
                visibility: visible;
            }
            
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }
            
            .loading-spinner {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .spinner {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: var(--secondary-color);
                animation: spin 1s ease-in-out infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* Стилі для медалей (бейджів) */
            .medal-card.earned .medal-icon {
                filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
            }
            
            .medal-card.earned .medal-name {
                color: var(--premium-color);
                text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
            }
            
            /* Стилі для кнопок участі */
            .join-button.participating,
            .mini-raffle-button.participating {
                background: var(--secondary-gradient);
                opacity: 0.7;
                cursor: default;
            }
            
            /* Стилі для деталей розіграшу */
            .raffle-details-modal h3 {
                margin-top: 0;
                color: var(--premium-color);
                text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
            }
            
            .raffle-details-modal .raffle-info {
                margin-bottom: 15px;
            }
            
            .winners-list {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 5px;
                padding: 10px;
                margin-top: 15px;
            }
            
            .winners-list h4 {
                margin-top: 0;
                color: var(--secondary-color);
            }
            
            .winners-list ul {
                list-style-type: none;
                padding-left: 5px;
            }
            
            .winners-list li {
                margin-bottom: 5px;
                padding: 5px;
                border-radius: 3px;
            }
            
            .winners-list li.current-user {
                background: rgba(76, 175, 80, 0.2);
                font-weight: bold;
            }
        `;

        document.head.appendChild(style);
    };

    // Ініціалізація при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        // Додаємо стилі для допоміжних компонентів
        addHelperStyles();

        // Ініціалізуємо допоміжні компоненти
        initHelpers();

        console.log('✅ Система розіграшів WINIX повністю готова');
    });
})();