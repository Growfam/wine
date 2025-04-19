/**
 * WINIX - Система розіграшів (interface-updater.js)
 * Модуль для оновлення інтерфейсу після дій користувача
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше interface-updater.js');
        return;
    }

    // Модуль для оновлення інтерфейсу
    const interfaceUpdater = {
        // Лічильник оновлень для відстеження
        updateCounter: 0,

        // Час останнього оновлення
        lastUpdateTime: 0,

        // Мінімальний інтервал між оновленнями (мс)
        minUpdateInterval: 300,

        // Запланована затримка оновлення
        updateDebounceTimeout: null,

        // Стан блокування інтерфейсу
        isUILocked: false,

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🔄 Ініціалізація модуля оновлення інтерфейсу...');

            // Додаємо обробники подій
            this.setupEventHandlers();

            // Створюємо стилі для анімацій оновлення
            this.createUpdateAnimationStyles();
        },

        /**
         * Налаштування обробників подій
         */
        setupEventHandlers: function() {
            // Обробник події успішної участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    this.handleSuccessfulParticipation(event.detail);
                }
            });

            // Обробник події оновлення балансу користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    this.updateUserBalanceDisplay(event.detail.userData);
                }
            });

            // Обробник видимості сторінки (для оновлення при поверненні)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Оновлюємо дані при поверненні на вкладку
                    this.scheduleUIUpdate();
                }
            });

            // Обробник після завершення завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                this.addDetailsButtons();
            });
        },

        /**
         * Створення стилів для анімацій оновлення
         */
        createUpdateAnimationStyles: function() {
            if (document.getElementById('interface-updater-styles')) return;

            const styleElement = document.createElement('style');
            styleElement.id = 'interface-updater-styles';
            styleElement.textContent = `
                /* Анімація пульсації при оновленні */
                @keyframes update-pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                
                /* Анімація світіння при оновленні */
                @keyframes update-glow {
                    0% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                    50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.7); }
                    100% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                }
                
                /* Клас для елементів, які оновилися */
                .element-updated {
                    animation: update-pulse 0.5s ease-in-out, update-glow 1s ease-in-out;
                }
                
                /* Преміальні стилі для кнопки деталей */
                .premium-details-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: linear-gradient(135deg, rgba(78, 181, 247, 0.8), rgba(0, 201, 167, 0.8));
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 500;
                    font-size: 14px;
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-top: 10px;
                    width: auto;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    position: relative;
                    overflow: hidden;
                }
                
                .premium-details-button::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
                    transform: scale(0);
                    transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    border-radius: 50%;
                }
                
                .premium-details-button::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(to bottom, transparent 70%, rgba(0, 0, 0, 0.2));
                    z-index: -1;
                }
                
                .premium-details-button:hover::before {
                    transform: scale(1);
                }
                
                .premium-details-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
                }
                
                .premium-details-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                }
                
                .premium-button-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                /* Анімація пульсації для привернення уваги */
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 5px rgba(78, 181, 247, 0.5); }
                    50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.8); }
                    100% { box-shadow: 0 0 5px rgba(78, 181, 247, 0.5); }
                }
                
                .pulse-animation {
                    animation: pulse-glow 2s infinite;
                }
                
                /* Стиль для кнопки участі, якщо вже беремо участь */
                .participating {
                    background: linear-gradient(to right, #4CAF50, #45a049);
                }
                
                /* Анімація для успішного додавання білета */
                @keyframes ticket-added {
                    0% { opacity: 0; transform: scale(0.8) translateY(10px); }
                    80% { opacity: 1; transform: scale(1.1) translateY(0); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                
                .ticket-added {
                    animation: ticket-added 0.5s ease-in-out forwards;
                }
            `;

            document.head.appendChild(styleElement);
        },

        /**
         * Обробка успішної участі в розіграші
         * @param {Object} data - Дані про участь
         */
        handleSuccessfulParticipation: function(data) {
            if (!data || !data.raffleId) return;

            // Оновлюємо вигляд кнопки
            this.updateParticipationButton(data.raffleId, data.ticketCount || 1);

            // Оновлюємо лічильник учасників розіграшу
            this.updateParticipantsCount(data.raffleId);

            // Анімуємо успішну участь
            this.animateSuccessfulParticipation(data.raffleId);

            // Додаємо кнопку "Деталі" якщо її ще немає
            this.addDetailsButtonToRaffle(data.raffleId);
        },

        /**
         * Оновлення кнопки участі в розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         */
        updateParticipationButton: function(raffleId, ticketCount) {
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);

            buttons.forEach(button => {
                // Видаляємо стан обробки
                button.classList.remove('processing');
                button.removeAttribute('data-processing');

                // Додаємо клас для учасників
                button.classList.add('participating');

                // Оновлюємо текст
                const isMini = button.classList.contains('mini-raffle-button');
                button.textContent = isMini ?
                    `Додати ще білет (${ticketCount})` :
                    `Додати ще білет (у вас: ${ticketCount})`;

                // Розблоковуємо кнопку
                button.disabled = false;
            });
        },

        /**
         * Оновлення лічильника учасників розіграшу
         * @param {string} raffleId - ID розіграшу
         */
        updateParticipantsCount: function(raffleId) {
            try {
                // Знаходимо елемент для оновлення кількості учасників
                const participantsElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                participantsElements.forEach(element => {
                    // Отримуємо поточне значення і збільшуємо його
                    const currentCount = parseInt(element.textContent.replace(/\s+/g, '')) || 0;
                    element.textContent = (currentCount + 1).toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Форматування з пробілами між розрядами

                    // Додаємо клас для анімації оновлення
                    element.classList.add('element-updated');

                    // Видаляємо клас через 1 секунду
                    setTimeout(() => {
                        element.classList.remove('element-updated');
                    }, 1000);
                });
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити лічильник учасників:", e);
            }
        },

        /**
         * Анімація успішної участі в розіграші
         * @param {string} raffleId - ID розіграшу
         */
        animateSuccessfulParticipation: function(raffleId) {
            // Анімуємо картку розіграшу
            const raffleCard = document.querySelector(`.raffle-card[data-raffle-id="${raffleId}"], .main-raffle-content`);
            if (raffleCard) {
                raffleCard.classList.add('element-updated');

                // Видаляємо клас через 1 секунду
                setTimeout(() => {
                    raffleCard.classList.remove('element-updated');
                }, 1000);
            }

            // Показуємо ефект додавання білета
            this.showTicketAddedEffect(raffleId);
        },

        /**
         * Ефект додавання білета
         * @param {string} raffleId - ID розіграшу
         */
        showTicketAddedEffect: function(raffleId) {
            const button = document.querySelector(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
            if (!button) return;

            // Створюємо елемент для анімації
            const ticketEffect = document.createElement('div');
            ticketEffect.className = 'ticket-added-effect';
            ticketEffect.style.cssText = `
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                color: #4CAF50;
                font-weight: bold;
                font-size: 14px;
                pointer-events: none;
                z-index: 100;
            `;
            ticketEffect.textContent = '+1 білет';

            // Додаємо елемент до кнопки
            button.style.position = 'relative';
            button.appendChild(ticketEffect);

            // Анімація
            ticketEffect.classList.add('ticket-added');

            // Видаляємо через 1.5 секунди
            setTimeout(() => {
                if (ticketEffect.parentNode) {
                    ticketEffect.parentNode.removeChild(ticketEffect);
                }
            }, 1500);
        },

        /**
         * Додавання кнопок деталей до всіх розіграшів
         */
        addDetailsButtons: function() {
            // Отримуємо всі карточки розіграшів
            const mainRaffle = document.querySelector('.main-raffle');
            const miniRaffles = document.querySelectorAll('.mini-raffle');

            // Додаємо до головного розіграшу, якщо він існує
            if (mainRaffle) {
                const raffleId = mainRaffle.getAttribute('data-raffle-id');
                if (raffleId) {
                    this.addDetailsButtonToRaffle(raffleId, 'main');
                }
            }

            // Додаємо до міні-розіграшів
            miniRaffles.forEach(raffle => {
                const raffleId = raffle.getAttribute('data-raffle-id');
                if (raffleId) {
                    this.addDetailsButtonToRaffle(raffleId, 'mini');
                }
            });
        },

        /**
         * Додавання кнопки деталей до конкретного розіграшу
         * Оновлена версія з преміальним стилем
         * @param {string} raffleId - ID розіграшу
         * @param {string} type - Тип розіграшу (main/mini)
         */
        addDetailsButtonToRaffle: function(raffleId, type = 'main') {
            // Перевіряємо, чи існує вже кнопка
            const existingButton = document.querySelector(`.details-button[data-raffle-id="${raffleId}"]`);
            if (existingButton) return;

            // Знаходимо контейнер для кнопки
            let buttonContainer;

            if (type === 'main') {
                // Для головного розіграшу
                buttonContainer = document.querySelector(`.main-raffle[data-raffle-id="${raffleId}"] .main-raffle-content, .main-raffle .main-raffle-content`);
            } else {
                // Для міні-розіграшу
                buttonContainer = document.querySelector(`.mini-raffle[data-raffle-id="${raffleId}"] .mini-raffle-info`);
            }

            if (!buttonContainer) return;

            // Створюємо кнопку деталей у преміальному стилі
            const detailsButton = document.createElement('button');
            detailsButton.className = 'details-button premium-details-button';
            detailsButton.setAttribute('data-raffle-id', raffleId);

            // Оновлений HTML для кнопки з іконкою та текстом
            detailsButton.innerHTML = `
                <span class="premium-button-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="1.5">
                        <circle cx="8" cy="8" r="7" />
                        <line x1="8" y1="4" x2="8" y2="8" />
                        <line x1="8" y1="11" x2="8" y2="12" />
                    </svg>
                </span>
                <span class="premium-button-text">Деталі розіграшу</span>
            `;

            // Додаємо обробник події
            detailsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Додаємо ефект пульсації при натисканні
                detailsButton.classList.add('pulse-animation');
                setTimeout(() => {
                    detailsButton.classList.remove('pulse-animation');
                }, 2000);

                // Відкриваємо модальне вікно з деталями розіграшу
                if (window.WinixRaffles.modal && typeof window.WinixRaffles.modal.showRaffleDetails === 'function') {
                    window.WinixRaffles.modal.showRaffleDetails(raffleId);
                } else if (window.showRaffleDetailsModal) {
                    // Запасний варіант - використовуємо глобальну функцію
                    const raffle = window.WinixRaffles.state.activeRaffles.find(r => r.id === raffleId);
                    if (raffle) {
                        // Перевіряємо, чи користувач бере участь
                        const isParticipating = window.WinixRaffles.participation &&
                                             window.WinixRaffles.participation.isUserParticipating &&
                                             window.WinixRaffles.participation.isUserParticipating(raffleId);

                        const ticketCount = window.WinixRaffles.participation &&
                                           window.WinixRaffles.participation.getUserTicketsCount &&
                                           window.WinixRaffles.participation.getUserTicketsCount(raffleId) || 0;

                        window.showRaffleDetailsModal(raffle, isParticipating, ticketCount);
                    } else {
                        // Запасний варіант, якщо модуль modal не доступний
                        this.showFallbackRaffleDetails(raffleId);
                    }
                } else {
                    // Запасний варіант, якщо модуль modal не доступний
                    this.showFallbackRaffleDetails(raffleId);
                }
            });

            // Додаємо кнопку до контейнера
            buttonContainer.appendChild(detailsButton);
        },

        /**
 * Запасний варіант показу деталей розіграшу у стилі wallet.html
 * @param {string} raffleId - ID розіграшу
 */
showFallbackRaffleDetails: function(raffleId) {
    // Шукаємо дані розіграшу
    let raffle = null;

    if (window.WinixRaffles.state.activeRaffles) {
        raffle = window.WinixRaffles.state.activeRaffles.find(r => r.id === raffleId);
    }

    if (!raffle) {
        window.showToast('Не вдалося знайти деталі розіграшу', 'error');
        return;
    }

    // Створюємо модальне вікно у стилі wallet.html
    // Додаємо стилі для модального вікна
    const modalStyles = `
        <style>
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                opacity: 1;
                visibility: visible;
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                backdrop-filter: blur(8px) !important;
            }
            
            .modal-container {
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.95), rgba(15, 52, 96, 0.95));
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(78, 181, 247, 0.15) inset;
                position: relative;
                padding: 0;
                max-width: 500px;
                width: 95%;
                margin: 0 auto;
                transform: scale(1);
                opacity: 1;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                animation: modal-appear 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            }
            
            .modal-container::before {
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
            
            @keyframes modal-appear {
                0% { transform: scale(0.8); opacity: 0; }
                70% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            
            .premium-modal-header {
                background: linear-gradient(90deg, rgba(30, 39, 70, 0.8), rgba(30, 39, 70, 0.9));
                padding: 20px;
                position: relative;
                border-bottom: 1px solid rgba(78, 181, 247, 0.2);
            }
            
            .premium-modal-title {
                font-size: 22px;
                font-weight: bold;
                color: white;
                margin: 0;
                text-align: center;
                text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
            }
            
            .premium-modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .premium-modal-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }
            
            .premium-raffle-details {
                padding: 20px;
            }
            
            .premium-raffle-image {
                width: 100%;
                height: 180px;
                object-fit: cover;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            
            .premium-raffle-title {
                font-size: 20px;
                font-weight: bold;
                color: #4CAF50;
                margin: 0 0 15px 0;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .premium-raffle-description {
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .premium-raffle-metadata {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                background: rgba(26, 32, 56, 0.5);
                padding: 15px;
                border-radius: 12px;
                margin-bottom: 20px;
            }
            
            .premium-metadata-item {
                display: flex;
                flex-direction: column;
            }
            
            .premium-metadata-label {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 5px;
            }
            
            .premium-metadata-value {
                font-size: 15px;
                font-weight: bold;
                color: white;
            }
            
            /* Кнопка закриття в стилі wallet.html */
            .premium-close-button {
                width: 100%;
                padding: 14px;
                background: linear-gradient(90deg, #1A1A2E, #0F3460, #00C9A7);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 15px;
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            }
            
            .premium-close-button::before {
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
            
            .premium-close-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
            }
            
            .premium-close-button:hover::before {
                left: 100%;
            }
            
            .premium-close-button:active {
                transform: translateY(0);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            
            @media (max-width: 450px) {
                .premium-raffle-metadata {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                
                .premium-metadata-item {
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .premium-metadata-label {
                    margin-bottom: 0;
                }
            }
        </style>
    `;

    // Форматуємо час завершення розіграшу
    const formattedEndDate = this.formatDateTime(raffle.end_time);

    // Створюємо HTML для модального вікна
    const modalHTML = `
        <div id="simple-modal" class="modal-overlay premium-modal">
            ${modalStyles}
            <div class="modal-container">
                <div class="premium-modal-header">
                    <h3 class="premium-modal-title">${raffle.title || 'Деталі розіграшу'}</h3>
                    <button class="premium-modal-close">&times;</button>
                </div>
                
                <div class="premium-raffle-details">
                    <img src="${raffle.image_url || 'assets/prize-default.png'}" alt="${raffle.title}" 
                        onerror="this.src='assets/prize-default.png'" class="premium-raffle-image">
                    
                    <h3 class="premium-raffle-title">${raffle.title}</h3>
                    
                    <p class="premium-raffle-description">${raffle.description || 'Детальний опис відсутній'}</p>
                    
                    <div class="premium-raffle-metadata">
                        <div class="premium-metadata-item">
                            <span class="premium-metadata-label">Призовий фонд:</span>
                            <span class="premium-metadata-value">${raffle.prize_amount || 0} ${raffle.prize_currency || 'WINIX'}</span>
                        </div>
                        
                        <div class="premium-metadata-item">
                            <span class="premium-metadata-label">Переможців:</span>
                            <span class="premium-metadata-value">${raffle.winners_count || 1}</span>
                        </div>
                        
                        <div class="premium-metadata-item">
                            <span class="premium-metadata-label">Вартість участі:</span>
                            <span class="premium-metadata-value">${raffle.entry_fee || 1} жетон${raffle.entry_fee > 1 ? 'и' : ''}</span>
                        </div>
                        
                        <div class="premium-metadata-item">
                            <span class="premium-metadata-label">Завершення:</span>
                            <span class="premium-metadata-value">${formattedEndDate}</span>
                        </div>
                        
                        <div class="premium-metadata-item">
                            <span class="premium-metadata-label">Учасників:</span>
                            <span class="premium-metadata-value">${raffle.participants_count || 0}</span>
                        </div>
                    </div>
                    
                    <button class="premium-close-button">Закрити</button>
                </div>
            </div>
        </div>
    `;

    // Додаємо елементи до DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Отримуємо посилання на модальне вікно
    const modalOverlay = document.getElementById('simple-modal');

    // Додаємо обробник для кнопки закриття
    const closeButton = modalOverlay.querySelector('.premium-modal-close');
    const closeButtonBottom = modalOverlay.querySelector('.premium-close-button');

    // Функція закриття модального вікна
    const closeModal = () => {
        // Додаємо клас для анімації закриття
        modalOverlay.classList.add('closing');

        // Чекаємо завершення анімації і видаляємо модальне вікно
        setTimeout(() => {
            if (document.body.contains(modalContainer)) {
                document.body.removeChild(modalContainer);
            }
        }, 400);
    };

    // Додаємо обробники для кнопок закриття
    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    if (closeButtonBottom) {
        closeButtonBottom.addEventListener('click', closeModal);
    }

    // Додаємо обробник для закриття при кліку на фон
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    // Додаємо обробник для кнопки Escape
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Показуємо модальне вікно (додаємо клас show після невеликої затримки для анімації)
    setTimeout(() => {
        modalOverlay.classList.add('show');
    }, 10);
},

        /**
         * Форматування дати і часу
         * @param {string|Date} dateTime - Дата і час
         * @returns {string} Відформатована дата і час
         */
        formatDateTime: function(dateTime) {
            if (!dateTime) return 'Невідомо';

            try {
                const date = new Date(dateTime);
                return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            } catch (e) {
                return 'Невідомо';
            }
        },

        /**
         * Оновлення відображення балансу користувача
         * @param {Object} userData - Дані користувача
         */
        updateUserBalanceDisplay: function(userData) {
            if (!userData) return;

            // Оновлюємо відображення жетонів
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement && userData.coins !== undefined) {
                const currentCoins = parseInt(userCoinsElement.textContent);
                const newCoins = userData.coins;

                // Анімація зміни, якщо значення відрізняється
                if (currentCoins !== newCoins) {
                    userCoinsElement.textContent = newCoins;
                    userCoinsElement.classList.add('element-updated');

                    // Видаляємо клас через 1 секунду
                    setTimeout(() => {
                        userCoinsElement.classList.remove('element-updated');
                    }, 1000);
                }
            }

            // Оновлюємо відображення балансу
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement && userData.balance !== undefined) {
                const currentBalance = parseFloat(userTokensElement.textContent.replace(/\s+/g, ''));
                const newBalance = userData.balance;

                // Анімація зміни, якщо значення відрізняється
                if (currentBalance !== newBalance) {
                    userTokensElement.textContent = this.formatNumberWithSpaces(newBalance);
                    userTokensElement.classList.add('element-updated');

                    // Видаляємо клас через 1 секунду
                    setTimeout(() => {
                        userTokensElement.classList.remove('element-updated');
                    }, 1000);
                }
            }
        },

        /**
         * Форматування числа з пробілами
         * @param {number} number - Число для форматування
         * @returns {string} Відформатоване число
         */
        formatNumberWithSpaces: function(number) {
            return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        /**
         * Планування оновлення інтерфейсу з затримкою
         */
        scheduleUIUpdate: function() {
            // Перевіряємо, чи минуло достатньо часу з останнього оновлення
            const now = Date.now();
            if (now - this.lastUpdateTime < this.minUpdateInterval) {
                // Якщо таймаут вже існує, не створюємо новий
                if (this.updateDebounceTimeout) return;

                // Планування з затримкою
                this.updateDebounceTimeout = setTimeout(() => {
                    this.performUIUpdate();
                    this.updateDebounceTimeout = null;
                }, this.minUpdateInterval);

                return;
            }

            // Виконуємо оновлення негайно
            this.performUIUpdate();
        },

        /**
         * Виконання оновлення інтерфейсу
         */
        performUIUpdate: function() {
            // Оновлюємо час останнього оновлення
            this.lastUpdateTime = Date.now();
            this.updateCounter++;

            // Перевіряємо, чи інтерфейс не заблоковано
            if (this.isUILocked) return;

            // Оновлюємо кнопки участі
            if (window.WinixRaffles.participation &&
                typeof window.WinixRaffles.participation.updateParticipationButtons === 'function') {
                window.WinixRaffles.participation.updateParticipationButtons();
            }

            // Додаємо кнопки деталей
            this.addDetailsButtons();
        },

        /**
         * Блокування оновлення інтерфейсу
         */
        lockUI: function() {
            this.isUILocked = true;
        },

        /**
         * Розблокування оновлення інтерфейсу
         */
        unlockUI: function() {
            this.isUILocked = false;

            // Відразу оновлюємо після розблокування
            this.scheduleUIUpdate();
        }
    };

    // Додаємо модуль до головного модуля розіграшів
    window.WinixRaffles.interfaceUpdater = interfaceUpdater;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (window.WinixRaffles.state.isInitialized) {
            interfaceUpdater.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                interfaceUpdater.init();
            });
        }
    });

    console.log('✅ Модуль оновлення інтерфейсу успішно завантажено');
})();