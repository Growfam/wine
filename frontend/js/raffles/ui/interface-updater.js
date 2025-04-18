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
                
                /* Стилі для кнопки деталей */
                .details-button {
                    background: linear-gradient(to right, rgba(78, 181, 247, 0.9), rgba(0, 201, 167, 0.9));
                    color: white;
                    border: none;
                    border-radius: 15px;
                    padding: 5px 15px;
                    font-size: 0.9em;
                    cursor: pointer;
                    margin-top: 10px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                }
                
                .details-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                }
                
                .details-button:active {
                    transform: translateY(0);
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

            // Створюємо кнопку деталей
            const detailsButton = document.createElement('button');
            detailsButton.className = 'details-button';
            detailsButton.setAttribute('data-raffle-id', raffleId);
            detailsButton.textContent = 'Деталі розіграшу';

            // Додаємо обробник події
            detailsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Відкриваємо модальне вікно з деталями розіграшу
                if (window.WinixRaffles.modal && typeof window.WinixRaffles.modal.showRaffleDetails === 'function') {
                    window.WinixRaffles.modal.showRaffleDetails(raffleId);
                } else {
                    // Запасний варіант, якщо модуль modal не доступний
                    this.showFallbackRaffleDetails(raffleId);
                }
            });

            // Додаємо кнопку до контейнера
            buttonContainer.appendChild(detailsButton);
        },

        /**
         * Запасний варіант показу деталей розіграшу
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

            // Створюємо просте модальне вікно
            const modalHTML = `
                <div id="simple-modal" class="simple-modal-overlay">
                    <div class="simple-modal-content">
                        <div class="simple-modal-header">
                            <h3>${raffle.title || 'Деталі розіграшу'}</h3>
                            <button class="simple-modal-close">&times;</button>
                        </div>
                        <div class="simple-modal-body">
                            <div class="raffle-details-image">
                                <img src="${raffle.image_url || 'assets/prize-default.png'}" alt="${raffle.title}" 
                                     onerror="this.src='assets/prize-default.png'">
                            </div>
                            <div class="raffle-details-info">
                                <p><strong>Призовий фонд:</strong> ${raffle.prize_amount || 0} ${raffle.prize_currency || 'WINIX'}</p>
                                <p><strong>Кількість переможців:</strong> ${raffle.winners_count || 1}</p>
                                <p><strong>Учасників:</strong> ${raffle.participants_count || 0}</p>
                                <p><strong>Вартість участі:</strong> ${raffle.entry_fee || 1} жетон${raffle.entry_fee > 1 ? 'и' : ''}</p>
                                <p><strong>Завершення:</strong> ${this.formatDateTime(raffle.end_time)}</p>
                            </div>
                            <div class="raffle-details-description">
                                <h4>Опис розіграшу:</h4>
                                <p>${raffle.description || 'Детальний опис відсутній'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Додаємо стилі для модального вікна
            const modalStyle = document.createElement('style');
            modalStyle.textContent = `
                .simple-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .simple-modal-content {
                    background: #fff;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }
                
                .simple-modal-header {
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #eee;
                }
                
                .simple-modal-header h3 {
                    margin: 0;
                    color: #333;
                }
                
                .simple-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                }
                
                .simple-modal-body {
                    padding: 15px;
                }
                
                .raffle-details-image {
                    text-align: center;
                    margin-bottom: 15px;
                }
                
                .raffle-details-image img {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: 8px;
                }
                
                .raffle-details-info {
                    margin-bottom: 15px;
                }
                
                .raffle-details-info p {
                    margin: 5px 0;
                }
                
                .raffle-details-description {
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                }
                
                .raffle-details-description h4 {
                    margin-top: 0;
                }
            `;

            // Додаємо елементи до DOM
            document.head.appendChild(modalStyle);
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            // Додаємо обробник для закриття
            const closeButton = document.querySelector('.simple-modal-close');
            const modalOverlay = document.getElementById('simple-modal');

            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modalContainer);
                });
            }

            if (modalOverlay) {
                modalOverlay.addEventListener('click', (e) => {
                    if (e.target === modalOverlay) {
                        document.body.removeChild(modalContainer);
                    }
                });
            }
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