/**
 * WINIX - Система розіграшів (interface-updater.js)
 * Модуль для оновлення інтерфейсу після дій користувача
 * @version 1.2.0
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

        // ДОДАНО: Кеш поточного стану учасників для розіграшів
        participantsCache: {},

        // ДОДАНО: Кеш поточної кількості переможців для розіграшів
        winnersCache: {},

        // ДОДАНО: Останній час синхронізації кешу
        lastCacheSyncTime: 0,

        // ДОДАНО: Таймер автоматичного синхронізації
        autoSyncTimer: null,

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🔄 Ініціалізація модуля оновлення інтерфейсу...');

            // Ініціалізуємо кеш при старті
            this.initCache();

            // Додаємо обробники подій
            this.setupEventHandlers();

            // Створюємо стилі для анімацій оновлення
            this.createUpdateAnimationStyles();

            // ДОДАНО: Запускаємо періодичну синхронізацію
            this.startAutoSync();
        },

        /**
         * Ініціалізуємо кеш поточного стану
         */
        initCache: function() {
            try {
                // Спробуємо отримати базовий стан з DOM
                document.querySelectorAll('.raffle-card, .main-raffle').forEach(card => {
                    const raffleId = card.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Шукаємо елементи з кількістю учасників
                    const participantsEl = card.querySelector('.participants-count .count, .participants-info .participants-count');
                    if (participantsEl) {
                        const count = parseInt(participantsEl.textContent.replace(/\s+/g, '')) || 0;
                        this.participantsCache[raffleId] = count;
                    }

                    // Шукаємо елементи з кількістю переможців
                    const winnersEl = card.querySelector('.winners-count, .prize-winners-count');
                    if (winnersEl) {
                        const count = parseInt(winnersEl.textContent.replace(/\s+/g, '')) || 0;
                        this.winnersCache[raffleId] = count;
                    }
                });

                console.log('📊 Кеш ініціалізовано:', {
                    participants: this.participantsCache,
                    winners: this.winnersCache
                });

                // Зберігаємо час ініціалізації
                this.lastCacheSyncTime = Date.now();
            } catch (e) {
                console.warn('⚠️ Помилка ініціалізації кешу:', e);
            }
        },

        /**
         * Запуск автоматичної синхронізації
         */
        startAutoSync: function() {
            // Очищаємо попередній таймер, якщо він існує
            if (this.autoSyncTimer) {
                clearInterval(this.autoSyncTimer);
            }

            // Запускаємо періодичне оновлення кожні 30 секунд
            this.autoSyncTimer = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    this.syncUIWithServer();
                }
            }, 30000); // 30 секунд

            console.log('🔄 Автоматична синхронізація запущена');
        },

        /**
         * Синхронізуємо UI з сервером для коректного відображення
         */
        syncUIWithServer: function() {
            // Перевірка часу з останньої синхронізації
            const now = Date.now();
            if (now - this.lastCacheSyncTime < 5000) return; // Не оновлюємо частіше ніж раз на 5 секунд

            console.log('🔄 Синхронізація UI з сервером...');

            // Перевіряємо наявність активних розіграшів в системі
            if (!window.WinixRaffles || !window.WinixRaffles.state || !Array.isArray(window.WinixRaffles.state.activeRaffles)) {
                console.warn('⚠️ Не вдалося отримати дані про активні розіграші');
                return;
            }

            // Проходимо по всіх активних розіграшах і оновлюємо їхні дані
            window.WinixRaffles.state.activeRaffles.forEach(raffle => {
                if (!raffle || !raffle.id) return;

                const raffleId = raffle.id;

                // Оновлюємо кеш кількості учасників
                if (typeof raffle.participants_count === 'number') {
                    const oldCount = this.participantsCache[raffleId] || 0;
                    const newCount = raffle.participants_count;

                    // Якщо є розбіжність, оновлюємо
                    if (oldCount !== newCount) {
                        console.log(`📊 Синхронізація: учасники розіграшу ${raffleId}: ${oldCount} -> ${newCount}`);
                        this.participantsCache[raffleId] = newCount;
                        this.updateParticipantsCountDisplay(raffleId, newCount);
                    }
                }

                // Оновлюємо кеш кількості переможців
                if (typeof raffle.winners_count === 'number') {
                    const oldCount = this.winnersCache[raffleId] || 0;
                    const newCount = raffle.winners_count;

                    // Якщо є розбіжність, оновлюємо
                    if (oldCount !== newCount) {
                        console.log(`📊 Синхронізація: переможці розіграшу ${raffleId}: ${oldCount} -> ${newCount}`);
                        this.winnersCache[raffleId] = newCount;
                        this.updateWinnersCountDisplay(raffleId, newCount);
                    }
                }
            });

            // Оновлюємо час останньої синхронізації
            this.lastCacheSyncTime = now;
            console.log('✅ UI синхронізовано з сервером');
        },

        /**
         * Оновлення відображення кількості учасників
         */
        updateParticipantsCountDisplay: function(raffleId, count) {
            // Шукаємо відповідні елементи на сторінці
            const elements = document.querySelectorAll(
                `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                `.main-raffle[data-raffle-id="${raffleId}"] .participants-info .participants-count, ` +
                `.main-raffle .participants-info .participants-count`
            );

            if (elements.length === 0) return;

            elements.forEach(element => {
                const formattedCount = count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                element.textContent = formattedCount;

                // Додаємо анімацію оновлення
                element.classList.add('element-updated');

                // Видаляємо клас через 1 секунду
                setTimeout(() => {
                    element.classList.remove('element-updated');
                }, 1000);
            });
        },

        /**
         * Оновлення відображення кількості переможців
         */
        updateWinnersCountDisplay: function(raffleId, count) {
            // Шукаємо відповідні елементи на сторінці
            const elements = document.querySelectorAll(
                `.raffle-card[data-raffle-id="${raffleId}"] .winners-count, ` +
                `.main-raffle[data-raffle-id="${raffleId}"] .prize-winners-count, ` +
                `.main-raffle .prize-winners-count`
            );

            if (elements.length === 0) return;

            elements.forEach(element => {
                const formattedCount = count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                element.textContent = formattedCount;

                // Додаємо анімацію оновлення
                element.classList.add('element-updated');

                // Видаляємо клас через 1 секунду
                setTimeout(() => {
                    element.classList.remove('element-updated');
                }, 1000);
            });
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

                    // Запускаємо синхронізацію з сервером
                    setTimeout(() => {
                        this.syncUIWithServer();
                    }, 1000); // Затримка для дозволення іншим компонентам ініціалізуватися
                }
            });

            // Обробник після завершення завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                this.addDetailsButtons();

                // Синхронізуємо кеш після завантаження розіграшів
                setTimeout(() => {
                    this.initCache();
                    this.syncUIWithServer();
                }, 500);
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

            // ВИПРАВЛЕНО: Затримка перед оновленням для уникнення колізій
            setTimeout(() => {
                // Оновлюємо вигляд кнопки
                this.updateParticipationButton(data.raffleId, data.ticketCount || 1);

                // Оновлюємо лічильник учасників розіграшу з уникненням рейс-умов
                this.updateParticipantsCount(data.raffleId);

                // Анімуємо успішну участь
                this.animateSuccessfulParticipation(data.raffleId);

                // Додаємо кнопку "Деталі" якщо її ще немає
                this.addDetailsButtonToRaffle(data.raffleId);
            }, 300);

            // Запланована повна синхронізація через 3 секунди після участі
            // Дає серверу час обробити зміни
            setTimeout(() => {
                this.syncUIWithServer();
            }, 3000);
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
                // ВИПРАВЛЕНО: Використовуємо кеш для гарантування атомарного оновлення
                // Спочатку отримуємо поточне значення з кешу
                let currentCount = this.participantsCache[raffleId] || 0;

                // Збільшуємо на 1
                currentCount += 1;

                // Оновлюємо кеш
                this.participantsCache[raffleId] = currentCount;

                // Знаходимо елементи для оновлення кількості учасників
                const participantsElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle[data-raffle-id="${raffleId}"] .participants-info .participants-count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                participantsElements.forEach(element => {
                    // Встановлюємо нове значення з форматуванням
                    element.textContent = currentCount.toString()
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
                if (window.WinixRaffles.active && typeof window.WinixRaffles.active.showRaffleDetails === 'function') {
                    window.WinixRaffles.active.showRaffleDetails(raffleId);
                } else if (window.showRaffleDetailsModal) {
                    // Знаходимо дані розіграшу
                    const raffle = window.WinixRaffles.state.activeRaffles?.find(r => r.id === raffleId);
                    if (raffle) {
                        // Перевіряємо, чи користувач бере участь
                        const isParticipating = window.WinixRaffles.participation &&
                                             window.WinixRaffles.participation.participatingRaffles &&
                                             window.WinixRaffles.participation.participatingRaffles.has(raffleId);

                        const ticketCount = window.WinixRaffles.participation &&
                                           window.WinixRaffles.participation.userRaffleTickets &&
                                           window.WinixRaffles.participation.userRaffleTickets[raffleId] || 0;

                        window.showRaffleDetailsModal(raffle, isParticipating, ticketCount);
                    } else {
                        window.showToast('Не вдалося знайти дані про розіграш', 'error');
                    }
                }
            });

            // Додаємо кнопку до контейнера
            buttonContainer.appendChild(detailsButton);
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
                    // Додаємо клас залежно від того, збільшується чи зменшується значення
                    if (newCoins > currentCoins) {
                        userCoinsElement.classList.add('increasing');
                        setTimeout(() => userCoinsElement.classList.remove('increasing'), 1000);
                    } else if (newCoins < currentCoins) {
                        userCoinsElement.classList.add('decreasing');
                        setTimeout(() => userCoinsElement.classList.remove('decreasing'), 1000);
                    }

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

            // ДОДАНО: Синхронізуємо з сервером, але з затримкою
            setTimeout(() => {
                this.syncUIWithServer();
            }, 500);
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